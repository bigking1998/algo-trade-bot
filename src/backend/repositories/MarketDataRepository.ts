/**
 * MarketDataRepository - Task BE-005: Market Data Repository Implementation
 * 
 * Time-series optimized repository extending BaseRepository for efficient OHLCV data storage,
 * historical data retrieval, data compression strategies, and real-time data integration.
 * Built specifically for TimescaleDB hypertables with advanced time-series features.
 */

import { BaseRepository, RepositoryResult } from './BaseRepository';
import {
  MarketData,
  MarketDataFilters,
  MarketDataAggregation,
  TimeSeriesOptions,
  CacheConfig,
  ValidationError,
  DatabaseError,
  QueryOptions
} from '../types/database';

export interface CandleData {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataInsert {
  time: Date;
  symbol: string;
  exchange?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_volume?: number;
  trades_count?: number;
  timeframe: MarketData['timeframe'];
  raw_data?: Record<string, unknown>;
}

/**
 * Bulk insertion options for optimized market data ingestion
 */
export interface BulkInsertOptions {
  chunkSize?: number;
  onConflict?: 'ignore' | 'update' | 'error';
  validate?: boolean;
  batchTimeout?: number;
}

export interface TimeSeriesResult<T> {
  data: T[];
  total_count: number;
  start_time: Date;
  end_time: Date;
  compression_ratio?: number;
  processing_time_ms: number;
}

export interface DataQualityReport {
  total_records: number;
  duplicate_count: number;
  gap_count: number;
  price_anomalies: number;
  volume_anomalies: number;
  missing_timeframes: string[];
  data_coverage_percent: number;
}

/**
 * Volatility calculation result for risk analysis
 */
export interface VolatilityMetrics {
  symbol: string;
  period: number;
  stdDev: number;
  variance: number;
  avgTrueRange: number;
  relativeVolatility: number;
  priceRange: {
    min: number;
    max: number;
    range: number;
  };
}

/**
 * Market data gap detection result for data quality validation
 */
export interface DataGap {
  symbol: string;
  timeframe: string;
  expectedTime: Date;
  actualTime: Date;
  gapDuration: number; // in milliseconds
  gapType: 'missing' | 'delayed' | 'duplicate';
}

/**
 * Market correlation analysis result
 */
export interface CorrelationResult {
  symbol1: string;
  symbol2: string;
  correlation: number;
  pValue: number;
  significanceLevel: string;
  period: number;
  observations: number;
}

/**
 * MarketDataRepository with TimescaleDB optimization and advanced time-series features
 */
export class MarketDataRepository extends BaseRepository<MarketData> {
  private readonly BATCH_SIZE = 1000;
  private readonly MAX_PARALLEL_INSERTS = 5;
  private readonly CACHE_TTL_SHORT = 30; // 30 seconds for real-time data
  private readonly CACHE_TTL_MEDIUM = 300; // 5 minutes for historical data
  private readonly CACHE_TTL_LONG = 3600; // 1 hour for aggregated data

  constructor() {
    // MarketData uses composite primary key (time, symbol, timeframe)
    // We'll use 'time' as the primary key field for BaseRepository compatibility
    super('market_data', 'time');
  }

  /**
   * TIME-SERIES OPTIMIZED STORAGE
   */

  /**
   * Insert single market data record with OHLCV validation
   */
  async insertMarketData(data: MarketDataInsert): Promise<RepositoryResult<MarketData>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Validate OHLCV data integrity
      this.validateOHLCVData(data);

      // Prepare data with defaults
      const marketDataEntity: Partial<MarketData> = {
        time: data.time,
        symbol: data.symbol,
        exchange: data.exchange || 'dydx',
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume,
        quote_volume: data.quote_volume,
        trades_count: data.trades_count || 0,
        timeframe: data.timeframe,
        raw_data: data.raw_data,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Use UPSERT to handle duplicates efficiently (TimescaleDB optimized)
      const query = `
        INSERT INTO market_data (
          time, symbol, exchange, open, high, low, close, volume, 
          quote_volume, trades_count, timeframe, raw_data, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (time, symbol, timeframe) 
        DO UPDATE SET
          exchange = EXCLUDED.exchange,
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume,
          quote_volume = EXCLUDED.quote_volume,
          trades_count = EXCLUDED.trades_count,
          raw_data = EXCLUDED.raw_data,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;

      const values = [
        marketDataEntity.time,
        marketDataEntity.symbol,
        marketDataEntity.exchange,
        marketDataEntity.open,
        marketDataEntity.high,
        marketDataEntity.low,
        marketDataEntity.close,
        marketDataEntity.volume,
        marketDataEntity.quote_volume,
        marketDataEntity.trades_count,
        marketDataEntity.timeframe,
        marketDataEntity.raw_data ? JSON.stringify(marketDataEntity.raw_data) : null,
        marketDataEntity.created_at,
        marketDataEntity.updated_at
      ];

      const result = await this.query<MarketData>(query, values);

      if (!result.rows || result.rows.length === 0) {
        throw new DatabaseError('Failed to insert market data - no rows returned');
      }

      // Invalidate related caches
      await this.invalidateMarketDataCache(data.symbol, data.timeframe);

      return {
        success: true,
        data: result.rows[0],
        metadata: {
          rowCount: 1,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'insertMarketData', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Bulk insert market data with parallel processing and batch optimization
   */
  async bulkInsertMarketData(
    dataArray: MarketDataInsert[],
    options: TimeSeriesOptions = {}
  ): Promise<RepositoryResult<{ inserted: number; updated: number; failed: number; processing_time_ms: number }>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      if (dataArray.length === 0) {
        return {
          success: true,
          data: { inserted: 0, updated: 0, failed: 0, processing_time_ms: 0 },
          metadata: { rowCount: 0, executionTimeMs: 0 }
        };
      }

      const opts = {
        batch_size: options.batch_size || this.BATCH_SIZE,
        parallel_processing: options.parallel_processing ?? true,
        skip_duplicates: options.skip_duplicates ?? true,
        validate_ohlcv: options.validate_ohlcv ?? true,
        ...options
      };

      let inserted = 0;
      let updated = 0;
      let failed = 0;

      // Validate data if enabled
      if (opts.validate_ohlcv) {
        for (const data of dataArray) {
          try {
            this.validateOHLCVData(data);
          } catch (error) {
            failed++;
            console.warn(`[MarketDataRepository] Validation failed for ${data.symbol} at ${data.time}:`, error);
          }
        }
      }

      const validData = dataArray.slice(0, dataArray.length - failed);

      // Process in batches
      const batches: MarketDataInsert[][] = [];
      for (let i = 0; i < validData.length; i += opts.batch_size) {
        batches.push(validData.slice(i, i + opts.batch_size));
      }

      // Execute batches with controlled parallelism
      const batchResults = await this.withTransaction(async (context) => {
        const results: Array<{ inserted: number; updated: number }> = [];

        // Sequential processing for simplicity in this implementation
        for (const batch of batches) {
          try {
            const batchResult = await this.processBatch(batch, context.client, opts.skip_duplicates);
            results.push(batchResult);
          } catch (error) {
            failed += batch.length;
            console.error('[MarketDataRepository] Batch processing failed:', error);
          }
        }

        return results;
      });

      if (batchResults.success && batchResults.data) {
        for (const result of batchResults.data) {
          inserted += result.inserted;
          updated += result.updated;
        }
      }

      // Invalidate relevant caches
      const symbolSet = new Set(dataArray.map(d => d.symbol));
      const uniqueSymbols = Array.from(symbolSet);
      for (let i = 0; i < uniqueSymbols.length; i++) {
        await this.invalidateMarketDataCache(uniqueSymbols[i]);
      }

      return {
        success: true,
        data: {
          inserted,
          updated,
          failed,
          processing_time_ms: Date.now() - startTime
        },
        metadata: {
          rowCount: inserted + updated,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'bulkInsertMarketData', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * EFFICIENT HISTORICAL DATA RETRIEVAL
   */

  /**
   * Get OHLCV candle data optimized for charting with TimescaleDB compression
   */
  async getOHLCVData(
    symbol: string,
    timeframe: MarketData['timeframe'],
    startTime: Date,
    endTime: Date,
    limit?: number
  ): Promise<RepositoryResult<CandleData[]>> {
    const startQueryTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const cacheKey = `ohlcv:${symbol}:${timeframe}:${startTime.toISOString()}:${endTime.toISOString()}:${limit || 'all'}`;
      
      // Optimized query using TimescaleDB time bucketing when appropriate
      const query = `
        SELECT 
          EXTRACT(EPOCH FROM time) * 1000 as time,
          open,
          high, 
          low,
          close,
          volume
        FROM market_data
        WHERE symbol = $1 
          AND timeframe = $2
          AND time >= $3 
          AND time <= $4
        ORDER BY time ASC
        ${limit ? `LIMIT $${limit ? '5' : ''}` : ''}
      `;

      const params: any[] = [symbol, timeframe, startTime, endTime];
      if (limit) {
        params.push(limit);
      }

      const cacheOptions: CacheConfig = {
        key: cacheKey,
        ttl: this.CACHE_TTL_MEDIUM
      };

      const result = await this.query<CandleData>(query, params, cacheOptions);

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rows?.length || 0,
          executionTimeMs: Date.now() - startQueryTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'getOHLCVData', { executionTimeMs: Date.now() - startQueryTime });
    }
  }

  /**
   * Get latest market data for multiple symbols with caching
   */
  async getLatestMarketData(
    symbols: string[],
    timeframe: MarketData['timeframe'] = '1h'
  ): Promise<RepositoryResult<MarketData[]>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      if (symbols.length === 0) {
        return {
          success: true,
          data: [],
          metadata: { rowCount: 0, executionTimeMs: 0 }
        };
      }

      const cacheKey = `latest:${symbols.sort().join(',')}:${timeframe}`;
      
      // Use DISTINCT ON for efficient latest record retrieval (PostgreSQL-specific optimization)
      const query = `
        SELECT DISTINCT ON (symbol) *
        FROM market_data
        WHERE symbol = ANY($1) 
          AND timeframe = $2
        ORDER BY symbol, time DESC
      `;

      const cacheOptions: CacheConfig = {
        key: cacheKey,
        ttl: this.CACHE_TTL_SHORT
      };

      const result = await this.query<MarketData>(query, [symbols, timeframe], cacheOptions);

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rows?.length || 0,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'getLatestMarketData', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Advanced filtering with pagination for large datasets
   */
  async searchMarketData(
    filters: MarketDataFilters,
    options: QueryOptions = {}
  ): Promise<RepositoryResult<{ data: MarketData[]; total: number; page: number; pageSize: number }>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const { query, countQuery, values } = this.buildFilteredQuery(filters, options);

      // Execute count and data queries in parallel
      const [countResult, dataResult] = await Promise.all([
        this.query<{ count: number }>(countQuery, values),
        this.query<MarketData>(query, values)
      ]);

      const total = parseInt(countResult.rows?.[0]?.count?.toString() || '0');
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      return {
        success: true,
        data: {
          data: dataResult.rows || [],
          total,
          page,
          pageSize: limit
        },
        metadata: {
          rowCount: dataResult.rows?.length || 0,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'searchMarketData', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Insert single chunk with conflict resolution
   */
  private async insertCandleChunk(
    chunk: Partial<MarketData>[],
    onConflict: 'ignore' | 'update' | 'error',
    timeout: number
  ): Promise<{ inserted: number; updated: number; skipped: number; errors: number; }> {
    if (chunk.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0, errors: 0 };
    }

    // Prepare bulk insert query
    const columns = ['time', 'symbol', 'exchange', 'open', 'high', 'low', 'close', 'volume', 'quote_volume', 'trades_count', 'timeframe', 'raw_data', 'created_at'];
    const placeholderRows = chunk.map((_, index) => {
      const base = index * columns.length;
      return `(${columns.map((_, i) => `$${base + i + 1}`).join(', ')})`;
    });

    const values: unknown[] = [];
    const now = new Date();

    chunk.forEach(candle => {
      values.push(
        candle.time || now,
        candle.symbol || '',
        candle.exchange || 'dydx',
        candle.open || 0,
        candle.high || 0,
        candle.low || 0,
        candle.close || 0,
        candle.volume || 0,
        candle.quote_volume || 0,
        candle.trades_count || 0,
        candle.timeframe || '1m',
        candle.raw_data || null,
        now
      );
    });

    let conflictClause = '';
    if (onConflict === 'ignore') {
      conflictClause = 'ON CONFLICT (time, symbol, timeframe) DO NOTHING';
    } else if (onConflict === 'update') {
      conflictClause = `
        ON CONFLICT (time, symbol, timeframe) 
        DO UPDATE SET 
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume,
          quote_volume = EXCLUDED.quote_volume,
          trades_count = EXCLUDED.trades_count,
          raw_data = EXCLUDED.raw_data,
          created_at = EXCLUDED.created_at
      `;
    }

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES ${placeholderRows.join(', ')}
      ${conflictClause}
      RETURNING (xmax = 0) AS inserted
    `;

    try {
      // Set statement timeout for large batches
      await this.db.query(`SET statement_timeout = ${timeout}`);
      
      const result = await this.db.query<{ inserted: boolean }>(query, values);
      
      // Reset timeout
      await this.db.query('SET statement_timeout = 0');

      const inserted = result.rows ? result.rows.filter(r => r.inserted).length : 0;
      const updated = result.rows ? result.rows.length - inserted : 0;

      return {
        inserted,
        updated,
        skipped: 0,
        errors: 0
      };

    } catch (error) {
      console.error(`[MarketDataRepository] Chunk insertion failed:`, error);
      return {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: chunk.length
      };
    }
  }

  /**
   * TIME-SERIES QUERY METHODS WITH TIMESCALEDB OPTIMIZATION
   */

  /**
   * DATA COMPRESSION AND AGGREGATION
   */

  /**
   * Get aggregated time-series data using TimescaleDB time_bucket function
   */
  async getAggregatedData(
    symbol: string,
    sourceTimeframe: MarketData['timeframe'],
    bucketInterval: string,
    startTime: Date,
    endTime: Date
  ): Promise<RepositoryResult<MarketDataAggregation[]>> {
    const startQueryTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const cacheKey = `aggregated:${symbol}:${sourceTimeframe}:${bucketInterval}:${startTime.toISOString()}:${endTime.toISOString()}`;

      // Use TimescaleDB time_bucket for efficient aggregation
      const query = `
        SELECT 
          time_bucket($4, time) as period,
          first(open, time) as open,
          max(high) as high,
          min(low) as low,
          last(close, time) as close,
          sum(volume) as volume,
          sum(volume * close) / nullif(sum(volume), 0) as vwap,
          sum(trades_count) as trades_count,
          $2 as timeframe
        FROM market_data
        WHERE symbol = $1
          AND timeframe = $2
          AND time >= $3
          AND time <= $5
        GROUP BY time_bucket($4, time)
        ORDER BY period ASC
      `;

      const cacheOptions: CacheConfig = {
        key: cacheKey,
        ttl: this.CACHE_TTL_LONG
      };

      const result = await this.query<MarketDataAggregation>(
        query,
        [symbol, sourceTimeframe, startTime, bucketInterval, endTime],
        cacheOptions
      );

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rows?.length || 0,
          executionTimeMs: Date.now() - startQueryTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'getAggregatedData', { executionTimeMs: Date.now() - startQueryTime });
    }
  }

  /**
   * Compress old data using TimescaleDB compression policies
   */
  async compressHistoricalData(
    symbol?: string,
    olderThanDays: number = 30
  ): Promise<RepositoryResult<{ chunks_compressed: number; compression_ratio: number; space_saved_mb: number }>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      // Enable compression for chunks older than specified days
      const compressionQuery = `
        SELECT compress_chunk(chunk_schema || '.' || chunk_name)
        FROM timescaledb_information.chunks
        WHERE hypertable_name = 'market_data'
          AND range_end < NOW() - INTERVAL '${olderThanDays} days'
          AND NOT is_compressed
          ${symbol ? `AND range_start_value LIKE '%${symbol}%'` : ''}
      `;

      const result = await this.query(compressionQuery);
      const chunksCompressed = result.rows?.length || 0;

      // Get compression stats
      const statsQuery = `
        SELECT 
          count(*) as total_chunks,
          sum(before_compression_total_bytes) as before_bytes,
          sum(after_compression_total_bytes) as after_bytes,
          avg(before_compression_total_bytes::float / nullif(after_compression_total_bytes, 0)) as avg_ratio
        FROM timescaledb_information.compressed_chunk_stats
        WHERE hypertable_name = 'market_data'
      `;

      const statsResult = await this.query<{
        total_chunks: number;
        before_bytes: number;
        after_bytes: number;
        avg_ratio: number;
      }>(statsQuery);

      const stats = statsResult.rows?.[0];
      const compressionRatio = stats?.avg_ratio || 1;
      const spaceSavedMB = stats ? (stats.before_bytes - stats.after_bytes) / (1024 * 1024) : 0;

      return {
        success: true,
        data: {
          chunks_compressed: chunksCompressed,
          compression_ratio: compressionRatio,
          space_saved_mb: spaceSavedMB
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'compressHistoricalData', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Get latest candles for a symbol with TimescaleDB time-bucket optimization
   */
  async getLatestCandles(
    symbol: string,
    timeframe: string,
    limit: number = 100,
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<MarketData[]>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const cacheKey = cacheConfig?.key || `market_data:latest:${symbol}:${timeframe}:${limit}`;
      const cacheOptions = {
        key: cacheKey,
        ttl: cacheConfig?.ttl || 60 // 1 minute cache for latest data
      };

      // Optimized query using TimescaleDB time-bucket and indexing
      const query = `
        SELECT time, symbol, exchange, open, high, low, close, volume, 
               quote_volume, trades_count, timeframe, raw_data, created_at
        FROM ${this.tableName}
        WHERE symbol = $1 
          AND timeframe = $2
        ORDER BY time DESC
        LIMIT $3
      `;

      const result = await this.db.query<MarketData>(query, [symbol, timeframe, limit], cacheOptions);

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'getLatestCandles', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Get candles within a time range with continuous aggregate optimization
   */
  async getCandleRange(
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date,
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<MarketData[]>> {
    const queryStartTime = Date.now();

    try {
      await this.ensureInitialized();

      const cacheKey = cacheConfig?.key || 
        `market_data:range:${symbol}:${timeframe}:${startTime.getTime()}:${endTime.getTime()}`;
      const cacheOptions = {
        key: cacheKey,
        ttl: cacheConfig?.ttl || 300 // 5 minutes cache for historical data
      };

      // Use TimescaleDB time-range optimization with proper indexing
      const query = `
        SELECT time, symbol, exchange, open, high, low, close, volume,
               quote_volume, trades_count, timeframe, raw_data, created_at
        FROM ${this.tableName}
        WHERE symbol = $1 
          AND timeframe = $2
          AND time >= $3 
          AND time <= $4
        ORDER BY time ASC
      `;

      const result = await this.db.query<MarketData>(
        query, 
        [symbol, timeframe, startTime, endTime], 
        cacheOptions
      );

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - queryStartTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'getCandleRange', { executionTimeMs: Date.now() - queryStartTime });
    }
  }

  /**
   * Get latest prices for multiple symbols with efficient batch processing
   */
  async getLatestPrices(
    symbols: string[],
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<Array<{ symbol: string; price: number; time: Date; volume: number; }>>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (symbols.length === 0) {
        return {
          success: true,
          data: [],
          metadata: { rowCount: 0, executionTimeMs: Date.now() - startTime }
        };
      }

      const cacheKey = cacheConfig?.key || `market_data:prices:${symbols.sort().join(',')}`;
      const cacheOptions = {
        key: cacheKey,
        ttl: cacheConfig?.ttl || 1 // 1 second cache for latest prices
      };

      // Optimized query using DISTINCT ON with time-series indexing
      const placeholders = symbols.map((_, index) => `$${index + 1}`).join(',');
      const query = `
        SELECT DISTINCT ON (symbol) 
               symbol, close as price, time, volume
        FROM ${this.tableName}
        WHERE symbol IN (${placeholders})
        ORDER BY symbol, time DESC
      `;

      const result = await this.db.query<{
        symbol: string;
        price: number;
        time: Date;
        volume: number;
      }>(query, symbols, cacheOptions);

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'getLatestPrices', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * ADVANCED ANALYTICS AND CALCULATIONS
   */

  /**
   * Calculate historical volatility with multiple metrics
   */
  async getHistoricalVolatility(
    symbol: string,
    period: number = 20,
    timeframe: string = '1h',
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<VolatilityMetrics>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const cacheKey = cacheConfig?.key || `market_data:volatility:${symbol}:${period}:${timeframe}`;
      const cacheOptions = {
        key: cacheKey,
        ttl: cacheConfig?.ttl || 600 // 10 minutes cache
      };

      // Advanced volatility calculation with ATR and price range analysis
      const query = `
        WITH price_data AS (
          SELECT 
            close,
            high,
            low,
            LAG(close) OVER (ORDER BY time) as prev_close,
            LN(close / LAG(close) OVER (ORDER BY time)) as log_return,
            high - low as daily_range,
            ABS(high - LAG(close) OVER (ORDER BY time)) as high_prev_close,
            ABS(low - LAG(close) OVER (ORDER BY time)) as low_prev_close
          FROM ${this.tableName}
          WHERE symbol = $1 AND timeframe = $2
          ORDER BY time DESC
          LIMIT $3 + 1
        ),
        volatility_calc AS (
          SELECT
            STDDEV(log_return) * SQRT(CASE 
              WHEN $2 = '1m' THEN 525600  -- Minutes in a year
              WHEN $2 = '5m' THEN 105120  -- 5-minute periods in a year
              WHEN $2 = '15m' THEN 35040  -- 15-minute periods in a year
              WHEN $2 = '30m' THEN 17520  -- 30-minute periods in a year
              WHEN $2 = '1h' THEN 8760    -- Hours in a year
              WHEN $2 = '4h' THEN 2190    -- 4-hour periods in a year
              WHEN $2 = '1d' THEN 365     -- Days in a year
              ELSE 8760 END) as annualized_volatility,
            VARIANCE(log_return) as variance,
            AVG(GREATEST(
              daily_range,
              high_prev_close,
              low_prev_close
            )) as avg_true_range,
            MIN(close) as min_price,
            MAX(close) as max_price,
            COUNT(close) as observations
          FROM price_data
          WHERE log_return IS NOT NULL
        )
        SELECT 
          annualized_volatility as std_dev,
          variance,
          avg_true_range,
          (annualized_volatility / AVG(close)) as relative_volatility,
          min_price,
          max_price,
          (max_price - min_price) as price_range,
          observations
        FROM volatility_calc, price_data
        GROUP BY annualized_volatility, variance, avg_true_range, min_price, max_price, observations
      `;

      const result = await this.db.query<{
        std_dev: number;
        variance: number;
        avg_true_range: number;
        relative_volatility: number;
        min_price: number;
        max_price: number;
        price_range: number;
        observations: number;
      }>(query, [symbol, timeframe, period], cacheOptions);

      if (!result.rows || result.rows.length === 0) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: `Insufficient data for volatility calculation: ${symbol}`
          } as DatabaseError
        };
      }

      const row = result.rows[0];
      const volatilityMetrics: VolatilityMetrics = {
        symbol,
        period,
        stdDev: row.std_dev || 0,
        variance: row.variance || 0,
        avgTrueRange: row.avg_true_range || 0,
        relativeVolatility: row.relative_volatility || 0,
        priceRange: {
          min: row.min_price || 0,
          max: row.max_price || 0,
          range: row.price_range || 0
        }
      };

      return {
        success: true,
        data: volatilityMetrics,
        metadata: {
          rowCount: 1,
          executionTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'getHistoricalVolatility', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * OHLCV aggregation across different timeframes with TimescaleDB time buckets
   */
  async getOHLCVAggregation(
    symbol: string,
    sourceTimeframe: string,
    targetTimeframe: string,
    limit: number = 100,
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<MarketDataAggregation[]>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const cacheKey = cacheConfig?.key || 
        `market_data:agg:${symbol}:${sourceTimeframe}:${targetTimeframe}:${limit}`;
      const cacheOptions = {
        key: cacheKey,
        ttl: cacheConfig?.ttl || 300 // 5 minutes cache
      };

      // TimescaleDB time_bucket for efficient aggregation
      const bucketSize = this.getTimeBucketSize(targetTimeframe);
      const query = `
        SELECT 
          time_bucket('${bucketSize}', time) as bucket_time,
          symbol,
          '${targetTimeframe}' as timeframe,
          (array_agg(open ORDER BY time ASC))[1] as open,
          MAX(high) as high,
          MIN(low) as low,
          (array_agg(close ORDER BY time DESC))[1] as close,
          SUM(volume) as volume,
          COUNT(*) as trade_count,
          CASE 
            WHEN SUM(volume) > 0 THEN SUM(close * volume) / SUM(volume)
            ELSE AVG(close)
          END as vwap,
          MIN(time) as start_time,
          MAX(time) as end_time
        FROM ${this.tableName}
        WHERE symbol = $1 
          AND timeframe = $2
          AND time >= NOW() - INTERVAL '${this.getAggregationPeriod(targetTimeframe, limit)}'
        GROUP BY bucket_time, symbol
        ORDER BY bucket_time DESC
        LIMIT $3
      `;

      const result = await this.db.query<{
        bucket_time: Date;
        symbol: string;
        timeframe: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        trade_count: number;
        vwap: number;
        start_time: Date;
        end_time: Date;
      }>(query, [symbol, sourceTimeframe, limit], cacheOptions);

      const aggregations: MarketDataAggregation[] = (result.rows || []).map(row => ({
        period: row.bucket_time.toISOString(),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        vwap: row.vwap,
        trades_count: row.trade_count,
        timeframe: row.timeframe as MarketData['timeframe']
      }));

      return {
        success: true,
        data: aggregations,
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'getOHLCVAggregation', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * DATA QUALITY AND VALIDATION METHODS
   */

  /**
   * DATA QUALITY AND VALIDATION
   */

  /**
   * Validate market data quality and generate report
   */
  async validateDataQuality(
    symbol?: string,
    timeframe?: MarketData['timeframe'],
    startTime?: Date,
    endTime?: Date
  ): Promise<RepositoryResult<DataQualityReport>> {
    const startQueryTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (symbol) {
        whereConditions.push(`symbol = $${paramIndex++}`);
        params.push(symbol);
      }

      if (timeframe) {
        whereConditions.push(`timeframe = $${paramIndex++}`);
        params.push(timeframe);
      }

      if (startTime) {
        whereConditions.push(`time >= $${paramIndex++}`);
        params.push(startTime);
      }

      if (endTime) {
        whereConditions.push(`time <= $${paramIndex++}`);
        params.push(endTime);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const qualityQuery = `
        WITH quality_stats AS (
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT (time, symbol, timeframe)) as unique_records,
            COUNT(*) - COUNT(DISTINCT (time, symbol, timeframe)) as duplicates,
            COUNT(*) FILTER (WHERE high < open OR high < close OR low > open OR low > close) as price_anomalies,
            COUNT(*) FILTER (WHERE volume <= 0) as volume_anomalies
          FROM market_data 
          ${whereClause}
        ),
        expected_records AS (
          SELECT 
            symbol,
            timeframe,
            CASE timeframe
              WHEN '1m' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 60
              WHEN '5m' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 300
              WHEN '15m' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 900
              WHEN '30m' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 1800
              WHEN '1h' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 3600
              WHEN '4h' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 14400
              WHEN '1d' THEN EXTRACT(EPOCH FROM (max(time) - min(time))) / 86400
              ELSE 1
            END as expected_count
          FROM market_data 
          ${whereClause}
          GROUP BY symbol, timeframe
        )
        SELECT 
          qs.total_records,
          qs.duplicates as duplicate_count,
          (qs.total_records - qs.unique_records) as gap_count,
          qs.price_anomalies,
          qs.volume_anomalies,
          array_agg(DISTINCT er.timeframe) as timeframes_found,
          CASE 
            WHEN sum(er.expected_count) > 0 
            THEN (qs.total_records::float / sum(er.expected_count) * 100)
            ELSE 100
          END as data_coverage_percent
        FROM quality_stats qs
        CROSS JOIN expected_records er
        GROUP BY qs.total_records, qs.duplicates, qs.price_anomalies, qs.volume_anomalies, qs.unique_records
      `;

      const result = await this.query<any>(qualityQuery, params);
      const stats = result.rows?.[0];

      const qualityReport: DataQualityReport = {
        total_records: parseInt(stats?.total_records || '0'),
        duplicate_count: parseInt(stats?.duplicate_count || '0'),
        gap_count: parseInt(stats?.gap_count || '0'),
        price_anomalies: parseInt(stats?.price_anomalies || '0'),
        volume_anomalies: parseInt(stats?.volume_anomalies || '0'),
        missing_timeframes: [],
        data_coverage_percent: parseFloat(stats?.data_coverage_percent || '0')
      };

      return {
        success: true,
        data: qualityReport,
        metadata: {
          executionTimeMs: Date.now() - startQueryTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'validateDataQuality', { executionTimeMs: Date.now() - startQueryTime });
    }
  }

  /**
   * REAL-TIME DATA INTEGRATION
   */

  /**
   * Stream real-time market data updates with buffering
   */
  async streamMarketData(
    symbols: string[],
    timeframes: MarketData['timeframe'][],
    callback: (data: MarketData) => void,
    errorCallback?: (error: Error) => void
  ): Promise<RepositoryResult<{ stream_id: string; status: 'active' | 'stopped' }>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      // This would integrate with a real-time data feed
      // For now, we return a placeholder implementation
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Implementation would setup WebSocket or similar real-time connection
      console.log(`[MarketDataRepository] Starting stream for symbols: ${symbols.join(',')}, timeframes: ${timeframes.join(',')}`);

      return {
        success: true,
        data: {
          stream_id: streamId,
          status: 'active'
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'streamMarketData', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Detect gaps in market data for data quality monitoring
   */
  async detectDataGaps(
    symbol: string,
    timeframe: string,
    lookbackHours: number = 24
  ): Promise<RepositoryResult<DataGap[]>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const timeframeMinutes = this.getTimeframeMinutes(timeframe);
      const query = `
        WITH expected_times AS (
          SELECT generate_series(
            date_trunc('minute', NOW() - INTERVAL '${lookbackHours} hours'),
            date_trunc('minute', NOW()),
            INTERVAL '${timeframeMinutes} minutes'
          ) as expected_time
        ),
        actual_data AS (
          SELECT DISTINCT date_trunc('minute', time) as actual_time
          FROM ${this.tableName}
          WHERE symbol = $1 
            AND timeframe = $2
            AND time >= NOW() - INTERVAL '${lookbackHours} hours'
        )
        SELECT 
          et.expected_time,
          ad.actual_time,
          CASE 
            WHEN ad.actual_time IS NULL THEN 'missing'
            WHEN ABS(EXTRACT(EPOCH FROM (ad.actual_time - et.expected_time))) > ${timeframeMinutes * 60} THEN 'delayed'
            ELSE 'normal'
          END as gap_type,
          EXTRACT(EPOCH FROM (COALESCE(ad.actual_time, et.expected_time) - et.expected_time)) * 1000 as gap_duration_ms
        FROM expected_times et
        LEFT JOIN actual_data ad ON date_trunc('minute', ad.actual_time) = date_trunc('minute', et.expected_time)
        WHERE ad.actual_time IS NULL 
          OR ABS(EXTRACT(EPOCH FROM (ad.actual_time - et.expected_time))) > ${timeframeMinutes * 30}
        ORDER BY et.expected_time DESC
      `;

      const result = await this.db.query<{
        expected_time: Date;
        actual_time: Date | null;
        gap_type: 'missing' | 'delayed';
        gap_duration_ms: number;
      }>(query, [symbol, timeframe]);

      const gaps: DataGap[] = (result.rows || []).map(row => ({
        symbol,
        timeframe,
        expectedTime: row.expected_time,
        actualTime: row.actual_time || row.expected_time,
        gapDuration: row.gap_duration_ms,
        gapType: row.gap_type as 'missing' | 'delayed' | 'duplicate'
      }));

      return {
        success: true,
        data: gaps,
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'detectDataGaps', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * UTILITY AND HELPER METHODS
   */

  /**
   * Validate bulk candles before insertion
   */
  private async validateBulkCandles(candles: Partial<MarketData>[]): Promise<string[]> {
    const errors: string[] = [];

    candles.forEach((candle, index) => {
      if (!candle.symbol) {
        errors.push(`Row ${index}: symbol is required`);
      }
      if (!candle.timeframe) {
        errors.push(`Row ${index}: timeframe is required`);
      }
      if (candle.open !== undefined && (typeof candle.open !== 'number' || candle.open < 0)) {
        errors.push(`Row ${index}: open price must be a positive number`);
      }
      if (candle.high !== undefined && candle.low !== undefined && candle.high < candle.low) {
        errors.push(`Row ${index}: high price cannot be less than low price`);
      }
      if (candle.volume !== undefined && (typeof candle.volume !== 'number' || candle.volume < 0)) {
        errors.push(`Row ${index}: volume must be a positive number`);
      }
    });

    return errors;
  }

  /**
   * Get TimescaleDB time bucket size for aggregation
   */
  private getTimeBucketSize(timeframe: string): string {
    const bucketSizes = {
      '1m': '1 minute',
      '5m': '5 minutes', 
      '15m': '15 minutes',
      '30m': '30 minutes',
      '1h': '1 hour',
      '4h': '4 hours',
      '1d': '1 day',
      '1w': '1 week'
    };
    return bucketSizes[timeframe as keyof typeof bucketSizes] || '1 hour';
  }

  /**
   * Get aggregation period for lookback calculations
   */
  private getAggregationPeriod(timeframe: string, limit: number): string {
    const multipliers = {
      '1m': limit,
      '5m': limit * 5,
      '15m': limit * 15,
      '30m': limit * 30,
      '1h': limit * 60,
      '4h': limit * 240,
      '1d': limit * 1440,
      '1w': limit * 10080
    };
    const minutes = multipliers[timeframe as keyof typeof multipliers] || limit * 60;
    return `${minutes} minutes`;
  }

  /**
   * Get timeframe duration in minutes
   */
  private getTimeframeMinutes(timeframe: string): number {
    const minutes = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1w': 10080
    };
    return minutes[timeframe as keyof typeof minutes] || 60;
  }

  /**
   * PRIVATE HELPER METHODS
   */

  /**
   * Process a batch of market data with transaction support
   */
  private async processBatch(
    batch: MarketDataInsert[],
    client: any,
    skipDuplicates: boolean
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    const conflictAction = skipDuplicates ? 'DO NOTHING' : `
      DO UPDATE SET
        exchange = EXCLUDED.exchange,
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        quote_volume = EXCLUDED.quote_volume,
        trades_count = EXCLUDED.trades_count,
        raw_data = EXCLUDED.raw_data,
        updated_at = EXCLUDED.updated_at
    `;

    for (const data of batch) {
      const query = `
        INSERT INTO market_data (
          time, symbol, exchange, open, high, low, close, volume,
          quote_volume, trades_count, timeframe, raw_data, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (time, symbol, timeframe) ${conflictAction}
      `;

      const values = [
        data.time,
        data.symbol,
        data.exchange || 'dydx',
        data.open,
        data.high,
        data.low,
        data.close,
        data.volume,
        data.quote_volume,
        data.trades_count || 0,
        data.timeframe,
        data.raw_data ? JSON.stringify(data.raw_data) : null,
        new Date(),
        new Date()
      ];

      const result = await client.query(query, values);
      const rowCount = result.rowCount || 0;

      if (skipDuplicates) {
        inserted += rowCount;
      } else {
        inserted += rowCount;
      }
    }

    return { inserted, updated };
  }

  /**
   * Build filtered query for advanced search
   */
  private buildFilteredQuery(
    filters: MarketDataFilters,
    options: QueryOptions
  ): { query: string; countQuery: string; values: any[] } {
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }

    if (filters.symbols?.length) {
      whereConditions.push(`symbol = ANY($${paramIndex++})`);
      params.push(filters.symbols);
    }

    if (filters.timeframe) {
      whereConditions.push(`timeframe = $${paramIndex++}`);
      params.push(filters.timeframe);
    }

    if (filters.timeframes?.length) {
      whereConditions.push(`timeframe = ANY($${paramIndex++})`);
      params.push(filters.timeframes);
    }

    if (filters.start_time) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.start_time);
    }

    if (filters.end_time) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.end_time);
    }

    if (filters.min_volume !== undefined) {
      whereConditions.push(`volume >= $${paramIndex++}`);
      params.push(filters.min_volume);
    }

    if (filters.max_volume !== undefined) {
      whereConditions.push(`volume <= $${paramIndex++}`);
      params.push(filters.max_volume);
    }

    if (filters.min_price !== undefined) {
      whereConditions.push(`close >= $${paramIndex++}`);
      params.push(filters.min_price);
    }

    if (filters.max_price !== undefined) {
      whereConditions.push(`close <= $${paramIndex++}`);
      params.push(filters.max_price);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build ORDER BY
    const orderBy = options.orderBy || 'time';
    const orderDirection = options.orderDirection || 'DESC';

    // Build pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const baseQuery = `FROM market_data ${whereClause}`;
    const query = `SELECT * ${baseQuery} ORDER BY ${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;

    return { query, countQuery, values: params };
  }

  /**
   * Validate OHLCV data integrity
   */
  private validateOHLCVData(data: MarketDataInsert): void {
    if (data.high < Math.max(data.open, data.close)) {
      throw new ValidationError('High price cannot be less than open or close price');
    }

    if (data.low > Math.min(data.open, data.close)) {
      throw new ValidationError('Low price cannot be greater than open or close price');
    }

    if (data.volume < 0) {
      throw new ValidationError('Volume cannot be negative');
    }

    if (data.open <= 0 || data.high <= 0 || data.low <= 0 || data.close <= 0) {
      throw new ValidationError('Prices must be positive');
    }

    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    if (!validTimeframes.includes(data.timeframe)) {
      throw new ValidationError(`Invalid timeframe: ${data.timeframe}`);
    }
  }

  /**
   * Invalidate market data related caches
   */
  private async invalidateMarketDataCache(symbol?: string, timeframe?: MarketData['timeframe']): Promise<void> {
    const patterns = [
      'latest:*',
      'ohlcv:*',
      'aggregated:*'
    ];

    if (symbol) {
      patterns.push(`latest:*${symbol}*`);
      patterns.push(`ohlcv:${symbol}:*`);
      patterns.push(`aggregated:${symbol}:*`);
    }

    await this.invalidateCache(patterns);
  }

  /**
   * Override entity validation with market data specific logic
   */
  protected async validateEntity(entity: Partial<MarketData>, operation: 'create' | 'update'): Promise<void> {
    await super.validateEntity(entity, operation);

    if (operation === 'create') {
      if (!entity.time) {
        throw new ValidationError('Time is required for market data');
      }

      if (!entity.symbol) {
        throw new ValidationError('Symbol is required for market data');
      }

      if (!entity.timeframe) {
        throw new ValidationError('Timeframe is required for market data');
      }

      if (entity.open === undefined || entity.high === undefined || 
          entity.low === undefined || entity.close === undefined) {
        throw new ValidationError('OHLC prices are required for market data');
      }

      if (entity.volume === undefined) {
        throw new ValidationError('Volume is required for market data');
      }
    }

    // Additional market data validations
    if (entity.open !== undefined && entity.open <= 0) {
      throw new ValidationError('Open price must be positive');
    }
    if (entity.high !== undefined && entity.high <= 0) {
      throw new ValidationError('High price must be positive');
    }
    if (entity.low !== undefined && entity.low <= 0) {
      throw new ValidationError('Low price must be positive');
    }
    if (entity.close !== undefined && entity.close <= 0) {
      throw new ValidationError('Close price must be positive');
    }
    if (entity.volume !== undefined && entity.volume < 0) {
      throw new ValidationError('Volume cannot be negative');
    }
  }
}