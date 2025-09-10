/**
 * Task DB-003: Advanced TimescaleDB Optimization
 * 
 * This module implements comprehensive TimescaleDB optimization including:
 * - Hypertable configuration and chunk sizing optimization
 * - Compression policies for historical data
 * - Advanced indexing strategies for time-series queries
 * - Performance monitoring and automatic tuning
 * - Data retention and archival policies
 */

import { DatabaseManager } from './DatabaseManager';
import { EventEmitter } from 'events';

export interface HypertableConfig {
  tableName: string;
  timeColumn: string;
  partitionColumn?: string;
  chunkTimeInterval: string; // e.g., '1 day', '1 hour', '7 days'
  compressionPolicy?: {
    enabled: boolean;
    compressAfter: string; // e.g., '7 days', '1 month'
    compressionAlgorithm?: 'lz4' | 'zstd';
  };
  retentionPolicy?: {
    enabled: boolean;
    dropAfter: string; // e.g., '1 year', '6 months'
  };
}

export interface IndexConfig {
  tableName: string;
  indexName: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  condition?: string;
  includedColumns?: string[];
}

export interface CompressionStats {
  tableName: string;
  totalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  chunksTotal: number;
  chunksCompressed: number;
  compressionSavings: number;
}

export interface ChunkStats {
  tableName: string;
  schemaName: string;
  chunkName: string;
  rangeStart: Date;
  rangeEnd: Date;
  sizeBytes: number;
  compressed: boolean;
  rowCount: number;
}

export interface PerformanceMetrics {
  avgQueryTime: number;
  p95QueryTime: number;
  indexHitRatio: number;
  bufferHitRatio: number;
  activeConnections: number;
  slowQueries: Array<{
    query: string;
    avgTime: number;
    calls: number;
  }>;
}

export class TimescaleOptimizer extends EventEmitter {
  private dbManager: DatabaseManager;
  private optimizationInterval?: NodeJS.Timeout;
  private performanceMonitorInterval?: NodeJS.Timeout;
  private isOptimizing = false;

  constructor(databaseManager?: DatabaseManager) {
    super();
    this.dbManager = databaseManager || DatabaseManager.getInstance();
  }

  /**
   * Initialize TimescaleDB optimization system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing TimescaleDB optimizer...');

      await this.dbManager.initialize();
      
      // Verify TimescaleDB extension
      await this.verifyTimescaleDB();
      
      // Configure optimal settings
      await this.configureTimescaleDBSettings();
      
      // Start continuous optimization
      this.startContinuousOptimization();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      console.log('✅ TimescaleDB optimizer initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ TimescaleDB optimizer initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create optimized hypertable with advanced configuration
   */
  async createOptimizedHypertable(config: HypertableConfig): Promise<void> {
    try {
      console.log(`🔄 Creating optimized hypertable: ${config.tableName}`);

      const query = `
        -- Create hypertable with optimal chunk sizing
        SELECT create_hypertable(
          '${config.tableName}',
          '${config.timeColumn}',
          ${config.partitionColumn ? `'${config.partitionColumn}'` : 'NULL'},
          chunk_time_interval => INTERVAL '${config.chunkTimeInterval}',
          create_default_indexes => TRUE,
          if_not_exists => TRUE
        );
      `;

      await this.dbManager.query(query);

      // Configure compression policy if enabled
      if (config.compressionPolicy?.enabled) {
        await this.addCompressionPolicy(config.tableName, config.compressionPolicy);
      }

      // Configure retention policy if enabled
      if (config.retentionPolicy?.enabled) {
        await this.addRetentionPolicy(config.tableName, config.retentionPolicy);
      }

      console.log(`✅ Optimized hypertable created: ${config.tableName}`);
      this.emit('hypertable_created', config.tableName);

    } catch (error) {
      console.error(`❌ Failed to create hypertable ${config.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Add compression policy to hypertable
   */
  async addCompressionPolicy(
    tableName: string, 
    policy: NonNullable<HypertableConfig['compressionPolicy']>
  ): Promise<void> {
    try {
      console.log(`🔄 Adding compression policy to ${tableName}`);

      // Enable compression on the hypertable
      const algorithm = policy.compressionAlgorithm || 'lz4';
      await this.dbManager.query(`
        ALTER TABLE ${tableName} SET (
          timescaledb.compress,
          timescaledb.compress_segmentby = 'symbol, exchange',
          timescaledb.compress_orderby = 'time DESC',
          timescaledb.compress_chunk_time_interval = '1 day'
        );
      `);

      // Add compression policy
      await this.dbManager.query(`
        SELECT add_compression_policy(
          '${tableName}',
          INTERVAL '${policy.compressAfter}'
        );
      `);

      console.log(`✅ Compression policy added to ${tableName}`);
      this.emit('compression_policy_added', tableName);

    } catch (error) {
      console.error(`❌ Failed to add compression policy to ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Add retention policy to hypertable
   */
  async addRetentionPolicy(
    tableName: string,
    policy: NonNullable<HypertableConfig['retentionPolicy']>
  ): Promise<void> {
    try {
      console.log(`🔄 Adding retention policy to ${tableName}`);

      await this.dbManager.query(`
        SELECT add_retention_policy(
          '${tableName}',
          INTERVAL '${policy.dropAfter}'
        );
      `);

      console.log(`✅ Retention policy added to ${tableName}`);
      this.emit('retention_policy_added', tableName);

    } catch (error) {
      console.error(`❌ Failed to add retention policy to ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Create optimized indexes for time-series queries
   */
  async createOptimizedIndexes(configs: IndexConfig[]): Promise<void> {
    try {
      console.log('🔄 Creating optimized indexes...');

      for (const config of configs) {
        await this.createSingleIndex(config);
      }

      console.log('✅ All optimized indexes created');
      this.emit('indexes_optimized');

    } catch (error) {
      console.error('❌ Failed to create optimized indexes:', error);
      throw error;
    }
  }

  /**
   * Create a single optimized index
   */
  private async createSingleIndex(config: IndexConfig): Promise<void> {
    const columnsStr = config.columns.join(', ');
    const includeStr = config.includedColumns ? 
      ` INCLUDE (${config.includedColumns.join(', ')})` : '';
    const conditionStr = config.condition ? ` WHERE ${config.condition}` : '';

    const query = `
      CREATE INDEX IF NOT EXISTS ${config.indexName}
      ON ${config.tableName} 
      USING ${config.indexType} (${columnsStr})${includeStr}${conditionStr};
    `;

    await this.dbManager.query(query);
    console.log(`✅ Created index: ${config.indexName}`);
  }

  /**
   * Get compression statistics
   */
  async getCompressionStats(): Promise<CompressionStats[]> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
          COALESCE(compression_stats.compressed_heap_size, 0) as compressed_size_bytes,
          CASE 
            WHEN COALESCE(compression_stats.compressed_heap_size, 0) > 0 
            THEN ROUND(
              (1.0 - COALESCE(compression_stats.compressed_heap_size, 0)::float8 / 
               NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0)) * 100, 2
            )
            ELSE 0.0
          END as compression_ratio,
          COALESCE(compression_stats.total_chunks, 0) as chunks_total,
          COALESCE(compression_stats.compressed_chunks, 0) as chunks_compressed
        FROM timescaledb_information.hypertables h
        LEFT JOIN (
          SELECT 
            hypertable_schema,
            hypertable_name,
            SUM(compressed_heap_size) as compressed_heap_size,
            COUNT(*) as total_chunks,
            COUNT(CASE WHEN compressed_heap_size > 0 THEN 1 END) as compressed_chunks
          FROM timescaledb_information.chunks
          GROUP BY hypertable_schema, hypertable_name
        ) compression_stats ON h.hypertable_schema = compression_stats.hypertable_schema
                            AND h.hypertable_name = compression_stats.hypertable_name
        ORDER BY total_size_bytes DESC;
      `);

      return result.rows.map(row => ({
        tableName: `${row.schemaname}.${row.tablename}`,
        totalSizeBytes: parseInt(row.total_size_bytes),
        compressedSizeBytes: parseInt(row.compressed_size_bytes),
        compressionRatio: parseFloat(row.compression_ratio),
        chunksTotal: parseInt(row.chunks_total),
        chunksCompressed: parseInt(row.chunks_compressed),
        compressionSavings: parseInt(row.total_size_bytes) - parseInt(row.compressed_size_bytes)
      }));

    } catch (error) {
      console.error('❌ Failed to get compression stats:', error);
      throw error;
    }
  }

  /**
   * Get chunk statistics
   */
  async getChunkStats(tableName?: string): Promise<ChunkStats[]> {
    try {
      let whereClause = '';
      if (tableName) {
        const parts = tableName.split('.');
        const schema = parts.length > 1 ? parts[0] : 'public';
        const table = parts.length > 1 ? parts[1] : parts[0];
        whereClause = `WHERE hypertable_schema = '${schema}' AND hypertable_name = '${table}'`;
      }

      const result = await this.dbManager.query(`
        SELECT 
          hypertable_schema,
          hypertable_name,
          chunk_name,
          range_start,
          range_end,
          pg_size_pretty(chunk_size) as size_pretty,
          chunk_size as size_bytes,
          CASE WHEN compressed_heap_size > 0 THEN TRUE ELSE FALSE END as compressed,
          row_estimate
        FROM timescaledb_information.chunks
        ${whereClause}
        ORDER BY range_start DESC;
      `);

      return result.rows.map(row => ({
        tableName: `${row.hypertable_schema}.${row.hypertable_name}`,
        schemaName: row.hypertable_schema,
        chunkName: row.chunk_name,
        rangeStart: new Date(row.range_start),
        rangeEnd: new Date(row.range_end),
        sizeBytes: parseInt(row.size_bytes),
        compressed: row.compressed,
        rowCount: parseInt(row.row_estimate)
      }));

    } catch (error) {
      console.error('❌ Failed to get chunk stats:', error);
      throw error;
    }
  }

  /**
   * Optimize chunk sizing based on data patterns
   */
  async optimizeChunkSizing(tableName: string): Promise<void> {
    try {
      console.log(`🔄 Optimizing chunk sizing for ${tableName}`);

      // Analyze data patterns
      const patterns = await this.analyzeDataPatterns(tableName);
      
      // Calculate optimal chunk size based on:
      // 1. Data ingestion rate
      // 2. Query patterns
      // 3. Storage efficiency
      const optimalInterval = this.calculateOptimalChunkInterval(patterns);

      // Update chunk sizing if different from current
      if (optimalInterval !== patterns.currentInterval) {
        await this.dbManager.query(`
          SELECT set_chunk_time_interval('${tableName}', INTERVAL '${optimalInterval}');
        `);
        
        console.log(`✅ Chunk sizing optimized: ${tableName} -> ${optimalInterval}`);
        this.emit('chunk_sizing_optimized', { tableName, newInterval: optimalInterval });
      } else {
        console.log(`✅ Chunk sizing already optimal: ${tableName}`);
      }

    } catch (error) {
      console.error(`❌ Failed to optimize chunk sizing for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Compress old chunks manually
   */
  async compressOldChunks(tableName: string, olderThan: string): Promise<number> {
    try {
      console.log(`🔄 Compressing old chunks for ${tableName} older than ${olderThan}`);

      const result = await this.dbManager.query(`
        SELECT compress_chunk(i.chunk_name)
        FROM timescaledb_information.chunks i
        WHERE i.hypertable_name = '${tableName.split('.')[1] || tableName}'
          AND i.range_end < NOW() - INTERVAL '${olderThan}'
          AND NOT i.is_compressed;
      `);

      const compressedCount = result.rows.length;
      console.log(`✅ Compressed ${compressedCount} old chunks for ${tableName}`);
      
      this.emit('chunks_compressed', { tableName, count: compressedCount });
      return compressedCount;

    } catch (error) {
      console.error(`❌ Failed to compress old chunks for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // Query execution statistics
      const queryStatsResult = await this.dbManager.query(`
        SELECT 
          ROUND(AVG(mean_exec_time)::numeric, 2) as avg_query_time,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_exec_time)::numeric, 2) as p95_query_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_%'
          AND query NOT LIKE '%information_schema%'
          AND calls > 5;
      `);

      // Buffer cache hit ratio
      const cacheResult = await this.dbManager.query(`
        SELECT 
          ROUND(
            100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 2
          ) as buffer_hit_ratio
        FROM pg_statio_user_tables;
      `);

      // Index hit ratio
      const indexResult = await this.dbManager.query(`
        SELECT 
          ROUND(
            100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0), 2
          ) as index_hit_ratio
        FROM pg_statio_user_indexes;
      `);

      // Active connections
      const connectionResult = await this.dbManager.query(`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE state = 'active' AND query != '<IDLE>';
      `);

      // Slow queries
      const slowQueriesResult = await this.dbManager.query(`
        SELECT 
          LEFT(query, 100) as query,
          ROUND(mean_exec_time::numeric, 2) as avg_time,
          calls
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
          AND calls > 10
          AND query NOT LIKE '%pg_stat_%'
        ORDER BY mean_exec_time DESC
        LIMIT 10;
      `);

      return {
        avgQueryTime: queryStatsResult.rows[0]?.avg_query_time || 0,
        p95QueryTime: queryStatsResult.rows[0]?.p95_query_time || 0,
        indexHitRatio: parseFloat(indexResult.rows[0]?.index_hit_ratio || '0'),
        bufferHitRatio: parseFloat(cacheResult.rows[0]?.buffer_hit_ratio || '0'),
        activeConnections: parseInt(connectionResult.rows[0]?.active_connections || '0'),
        slowQueries: slowQueriesResult.rows.map(row => ({
          query: row.query,
          avgTime: parseFloat(row.avg_time),
          calls: parseInt(row.calls)
        }))
      };

    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Configure TimescaleDB-specific settings
   */
  private async configureTimescaleDBSettings(): Promise<void> {
    const settings = [
      // Enable parallel query execution
      "SET max_parallel_workers_per_gather = 4",
      
      // Optimize for time-series workloads
      "SET shared_preload_libraries = 'timescaledb'",
      
      // Configure memory settings for large datasets
      "SET work_mem = '256MB'",
      "SET effective_cache_size = '4GB'",
      
      // Optimize for write-heavy workloads
      "SET checkpoint_completion_target = 0.9",
      "SET checkpoint_timeout = '15min'",
      
      // Enable query statistics collection
      "SET shared_preload_libraries = 'pg_stat_statements'",
      "SET track_activity_query_size = 2048"
    ];

    for (const setting of settings) {
      try {
        await this.dbManager.query(setting);
      } catch (error) {
        // Some settings might not be changeable at runtime, log and continue
        console.warn(`⚠️ Could not apply setting: ${setting}`, error);
      }
    }
  }

  /**
   * Verify TimescaleDB installation and version
   */
  private async verifyTimescaleDB(): Promise<void> {
    const result = await this.dbManager.query(`
      SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
    `);

    if (result.rows.length === 0) {
      throw new Error('TimescaleDB extension not installed');
    }

    const version = result.rows[0].extversion;
    console.log(`✅ TimescaleDB version: ${version}`);
  }

  /**
   * Analyze data patterns for chunk optimization
   */
  private async analyzeDataPatterns(tableName: string): Promise<any> {
    const result = await this.dbManager.query(`
      SELECT 
        chunk_time_interval,
        COUNT(*) as total_chunks,
        AVG(pg_relation_size(chunk_schema||'.'||chunk_name)) as avg_chunk_size
      FROM timescaledb_information.chunks
      WHERE hypertable_name = '${tableName.split('.')[1] || tableName}'
      GROUP BY chunk_time_interval;
    `);

    return {
      currentInterval: result.rows[0]?.chunk_time_interval || '1 day',
      totalChunks: parseInt(result.rows[0]?.total_chunks || '0'),
      avgChunkSize: parseInt(result.rows[0]?.avg_chunk_size || '0')
    };
  }

  /**
   * Calculate optimal chunk interval based on data patterns
   */
  private calculateOptimalChunkInterval(patterns: any): string {
    // Simple heuristic - can be enhanced based on requirements
    const { avgChunkSize, totalChunks } = patterns;
    
    // Target chunk size: 25MB - 100MB
    const targetSize = 50 * 1024 * 1024; // 50MB
    
    if (avgChunkSize > targetSize * 2) {
      return '12 hours'; // Smaller chunks
    } else if (avgChunkSize < targetSize / 2) {
      return '3 days'; // Larger chunks
    } else {
      return '1 day'; // Current default is good
    }
  }

  /**
   * Start continuous optimization
   */
  private startContinuousOptimization(): void {
    // Run optimization every 6 hours
    this.optimizationInterval = setInterval(async () => {
      if (this.isOptimizing) return;
      
      this.isOptimizing = true;
      try {
        await this.runOptimizationCycle();
      } catch (error) {
        console.error('❌ Optimization cycle failed:', error);
        this.emit('optimization_error', error);
      } finally {
        this.isOptimizing = false;
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor performance every 5 minutes
    this.performanceMonitorInterval = setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics();
        this.emit('performance_metrics', metrics);
        
        // Alert on performance issues
        if (metrics.avgQueryTime > 1000) {
          this.emit('performance_alert', {
            type: 'slow_queries',
            message: `Average query time: ${metrics.avgQueryTime}ms`,
            severity: 'warning'
          });
        }
        
        if (metrics.bufferHitRatio < 95) {
          this.emit('performance_alert', {
            type: 'low_cache_hit',
            message: `Buffer hit ratio: ${metrics.bufferHitRatio}%`,
            severity: 'warning'
          });
        }
        
      } catch (error) {
        console.error('❌ Performance monitoring failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Run a complete optimization cycle
   */
  private async runOptimizationCycle(): Promise<void> {
    console.log('🔄 Running TimescaleDB optimization cycle...');
    
    try {
      // Get list of hypertables
      const hypertables = await this.dbManager.query(`
        SELECT hypertable_schema, hypertable_name 
        FROM timescaledb_information.hypertables;
      `);
      
      for (const table of hypertables.rows) {
        const tableName = `${table.hypertable_schema}.${table.hypertable_name}`;
        
        // Optimize chunk sizing
        await this.optimizeChunkSizing(tableName);
        
        // Compress old chunks (older than 7 days)
        await this.compressOldChunks(tableName, '7 days');
      }
      
      console.log('✅ TimescaleDB optimization cycle completed');
      this.emit('optimization_cycle_complete');
      
    } catch (error) {
      console.error('❌ Optimization cycle failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown optimizer and cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down TimescaleDB optimizer...');
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    
    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval);
    }
    
    console.log('✅ TimescaleDB optimizer shutdown complete');
    this.emit('shutdown');
  }
}

/**
 * Default configurations for common trading data tables
 */
export const getDefaultHypertableConfigs = (): HypertableConfig[] => [
  // Market data table - high frequency, compress after 1 day
  {
    tableName: 'market_data',
    timeColumn: 'time',
    partitionColumn: 'symbol',
    chunkTimeInterval: '1 day',
    compressionPolicy: {
      enabled: true,
      compressAfter: '1 day',
      compressionAlgorithm: 'lz4'
    },
    retentionPolicy: {
      enabled: true,
      dropAfter: '2 years'
    }
  },
  
  // Trade execution data - medium frequency
  {
    tableName: 'trades',
    timeColumn: 'created_at',
    chunkTimeInterval: '7 days',
    compressionPolicy: {
      enabled: true,
      compressAfter: '30 days',
      compressionAlgorithm: 'zstd'
    }
  },
  
  // Portfolio snapshots - low frequency
  {
    tableName: 'portfolio_snapshots',
    timeColumn: 'created_at',
    chunkTimeInterval: '30 days',
    compressionPolicy: {
      enabled: true,
      compressAfter: '90 days',
      compressionAlgorithm: 'zstd'
    }
  },
  
  // System logs - high frequency, shorter retention
  {
    tableName: 'system_logs',
    timeColumn: 'created_at',
    chunkTimeInterval: '1 day',
    compressionPolicy: {
      enabled: true,
      compressAfter: '7 days',
      compressionAlgorithm: 'lz4'
    },
    retentionPolicy: {
      enabled: true,
      dropAfter: '6 months'
    }
  }
];

/**
 * Default optimized indexes for time-series queries
 */
export const getDefaultIndexConfigs = (): IndexConfig[] => [
  // Market data indexes
  {
    tableName: 'market_data',
    indexName: 'idx_market_data_symbol_time',
    columns: ['symbol', 'time DESC'],
    indexType: 'btree'
  },
  {
    tableName: 'market_data',
    indexName: 'idx_market_data_symbol_timeframe_time',
    columns: ['symbol', 'timeframe', 'time DESC'],
    indexType: 'btree'
  },
  
  // Trade execution indexes
  {
    tableName: 'trades',
    indexName: 'idx_trades_strategy_time',
    columns: ['strategy_id', 'created_at DESC'],
    indexType: 'btree'
  },
  {
    tableName: 'trades',
    indexName: 'idx_trades_symbol_status_time',
    columns: ['symbol', 'status', 'created_at DESC'],
    indexType: 'btree'
  },
  
  // Portfolio snapshot indexes
  {
    tableName: 'portfolio_snapshots',
    indexName: 'idx_portfolio_snapshots_time',
    columns: ['created_at DESC'],
    indexType: 'btree'
  }
];

// Export singleton instance
let optimizerInstance: TimescaleOptimizer | null = null;

export const getTimescaleOptimizer = (databaseManager?: DatabaseManager): TimescaleOptimizer => {
  if (!optimizerInstance) {
    optimizerInstance = new TimescaleOptimizer(databaseManager);
  }
  return optimizerInstance;
};

export default TimescaleOptimizer;