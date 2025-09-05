/**
 * MarketDataRepository Implementation - Task BE-005
 * 
 * Production-ready market data repository with TimescaleDB optimization,
 * high-frequency data processing, bulk insertion capabilities, and 
 * comprehensive time-series analysis features for algorithmic trading.
 */

import { BaseRepository, RepositoryResult } from './BaseRepository';
import { MarketData, CacheConfig, DatabaseError } from '../types/database';

/**
 * Market data query filters for flexible data retrieval
 */
export interface MarketDataFilters {
  symbols?: string[];
  exchanges?: string[];
  timeframes?: string[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  includeVolume?: boolean;
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

/**
 * Market data aggregation result for time-series analysis
 */
export interface MarketDataAggregation {
  symbol: string;
  timeframe: string;
  startTime: Date;
  endTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
  vwap: number; // Volume Weighted Average Price
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
  
  constructor() {
    super('market_data', 'time'); // time is the primary key for TimescaleDB hypertables
  }

  /**
   * BULK INSERTION METHODS FOR HIGH-FREQUENCY DATA
   */

  /**
   * Insert multiple candles with optimized batch processing
   * Handles conflicts and provides detailed insertion metrics
   */
  async insertBulkCandles(
    candles: Partial<MarketData>[],
    options: BulkInsertOptions = {}
  ): Promise<RepositoryResult<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    processingTimeMs: number;
  }>> {
    const startTime = Date.now();
    const {
      chunkSize = 1000,
      onConflict = 'ignore',
      validate = true,
      batchTimeout = 5000
    } = options;

    try {
      await this.ensureInitialized();

      if (validate) {
        const validationErrors = await this.validateBulkCandles(candles);
        if (validationErrors.length > 0) {
          return {
            success: false,
            error: {
              name: 'ValidationError',
              message: `Bulk validation failed: ${validationErrors.join(', ')}`
            } as DatabaseError,
            metadata: { executionTimeMs: Date.now() - startTime }
          };
        }
      }

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      // Process in chunks for optimal performance
      for (let i = 0; i < candles.length; i += chunkSize) {
        const chunk = candles.slice(i, i + chunkSize);
        const chunkResult = await this.insertCandleChunk(chunk, onConflict, batchTimeout);
        
        totalInserted += chunkResult.inserted;
        totalUpdated += chunkResult.updated;
        totalSkipped += chunkResult.skipped;
        totalErrors += chunkResult.errors;
      }

      // Invalidate related cache after bulk insertion
      await this.invalidateCache([
        'market_data:latest:*',
        'market_data:candles:*',
        'market_data:prices:*'
      ]);

      return {
        success: true,
        data: {
          inserted: totalInserted,
          updated: totalUpdated,
          skipped: totalSkipped,
          errors: totalErrors,
          processingTimeMs: Date.now() - startTime
        }
      };

    } catch (error) {
      return this.handleError(error, 'insertBulkCandles', { executionTimeMs: Date.now() - startTime });
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
        symbol: row.symbol,
        timeframe: row.timeframe,
        startTime: row.start_time,
        endTime: row.end_time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        tradeCount: row.trade_count,
        vwap: row.vwap
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
   * Override entity validation for market data
   */
  protected async validateEntity(entity: Partial<MarketData>, operation: 'create' | 'update'): Promise<void> {
    if (operation === 'create') {
      if (!entity.symbol) {
        throw new Error('Symbol is required for market data');
      }
      if (!entity.timeframe) {
        throw new Error('Timeframe is required for market data');
      }
      if (entity.open !== undefined && entity.open < 0) {
        throw new Error('Open price cannot be negative');
      }
      if (entity.high !== undefined && entity.low !== undefined && entity.high < entity.low) {
        throw new Error('High price cannot be less than low price');
      }
    }
  }
}