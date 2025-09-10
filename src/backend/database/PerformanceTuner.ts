/**
 * Task DB-004: Database Performance Tuning and Query Optimization
 * 
 * This module implements comprehensive database performance tuning including:
 * - Advanced indexing strategies for high-performance queries
 * - Connection pooling optimization
 * - Query optimization and slow query analysis
 * - Memory and cache tuning
 * - Automatic performance monitoring and alerting
 */

import { DatabaseManager } from './DatabaseManager';
import { EventEmitter } from 'events';

export interface QueryPerformance {
  queryHash: string;
  query: string;
  calls: number;
  totalTimeMs: number;
  avgTimeMs: number;
  maxTimeMs: number;
  minTimeMs: number;
  stdDevTimeMs: number;
  rowsReturned: number;
  percentOfTotal: number;
}

export interface IndexUsage {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexSize: number;
  indexScans: number;
  tuplesRead: number;
  tuplesReturned: number;
  efficiency: number; // tuplesReturned / tuplesRead
  usage: 'high' | 'medium' | 'low' | 'unused';
}

export interface TableStats {
  schemaName: string;
  tableName: string;
  tableSize: number;
  indexSize: number;
  totalSize: number;
  liveRows: number;
  deadRows: number;
  vacuumCount: number;
  autoVacuumCount: number;
  analyzeCount: number;
  autoAnalyzeCount: number;
  lastVacuum?: Date;
  lastAutoVacuum?: Date;
  lastAnalyze?: Date;
  lastAutoAnalyze?: Date;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  utilization: number;
  avgWaitTime: number;
  connectionErrors: number;
}

export interface PerformanceAlert {
  type: 'slow_query' | 'unused_index' | 'high_load' | 'memory_pressure' | 'lock_contention';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceReport {
  timestamp: Date;
  overview: {
    avgQueryTime: number;
    slowestQueries: QueryPerformance[];
    topTables: TableStats[];
    connectionStats: ConnectionPoolStats;
  };
  indexAnalysis: {
    unusedIndexes: IndexUsage[];
    inefficientIndexes: IndexUsage[];
    recommendedIndexes: string[];
  };
  maintenanceRecommendations: string[];
  alerts: PerformanceAlert[];
}

export class PerformanceTuner extends EventEmitter {
  private dbManager: DatabaseManager;
  private monitoringInterval?: NodeJS.Timeout;
  private tuningInterval?: NodeJS.Timeout;
  private alerts: PerformanceAlert[] = [];
  private performanceHistory: PerformanceReport[] = [];

  constructor(databaseManager?: DatabaseManager) {
    super();
    this.dbManager = databaseManager || DatabaseManager.getInstance();
  }

  /**
   * Initialize performance tuning system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing database performance tuner...');

      await this.dbManager.initialize();
      
      // Enable query statistics collection
      await this.enableQueryStatistics();
      
      // Apply initial performance optimizations
      await this.applyInitialOptimizations();
      
      // Start continuous monitoring
      this.startPerformanceMonitoring();
      
      // Start automatic tuning
      this.startAutoTuning();
      
      console.log('✅ Database performance tuner initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Performance tuner initialization failed:', error);
      throw error;
    }
  }

  /**
   * Enable query statistics collection
   */
  async enableQueryStatistics(): Promise<void> {
    try {
      // Enable pg_stat_statements if not already enabled
      await this.dbManager.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
      
      // Reset statistics to start fresh
      await this.dbManager.query("SELECT pg_stat_statements_reset()");
      
      console.log('✅ Query statistics collection enabled');
    } catch (error) {
      console.warn('⚠️ Could not enable pg_stat_statements:', error);
    }
  }

  /**
   * Apply initial performance optimizations
   */
  async applyInitialOptimizations(): Promise<void> {
    try {
      console.log('🔄 Applying initial performance optimizations...');

      const optimizations = [
        // Memory settings
        "SET shared_buffers = '256MB'",
        "SET effective_cache_size = '1GB'",
        "SET work_mem = '16MB'",
        "SET maintenance_work_mem = '256MB'",
        
        // Query planner settings
        "SET random_page_cost = 1.1",
        "SET seq_page_cost = 1.0",
        "SET cpu_tuple_cost = 0.01",
        "SET cpu_index_tuple_cost = 0.005",
        "SET cpu_operator_cost = 0.0025",
        
        // Write-ahead logging
        "SET wal_buffers = '16MB'",
        "SET checkpoint_completion_target = 0.9",
        "SET checkpoint_timeout = '10min'",
        
        // Background writer
        "SET bgwriter_delay = '200ms'",
        "SET bgwriter_lru_maxpages = 100",
        "SET bgwriter_lru_multiplier = 2.0",
        
        // Auto-vacuum settings
        "SET autovacuum_vacuum_scale_factor = 0.1",
        "SET autovacuum_analyze_scale_factor = 0.05",
        "SET autovacuum_naptime = '1min'",
        
        // Connection and timeout settings
        "SET idle_in_transaction_session_timeout = '5min'",
        "SET statement_timeout = '30s'",
        "SET lock_timeout = '10s'"
      ];

      for (const optimization of optimizations) {
        try {
          await this.dbManager.query(optimization);
        } catch (error) {
          console.warn(`⚠️ Could not apply optimization: ${optimization}`, error);
        }
      }

      console.log('✅ Initial performance optimizations applied');
    } catch (error) {
      console.error('❌ Failed to apply initial optimizations:', error);
      throw error;
    }
  }

  /**
   * Analyze query performance
   */
  async analyzeQueryPerformance(limit = 20): Promise<QueryPerformance[]> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          queryid,
          LEFT(query, 200) as query,
          calls,
          ROUND(total_exec_time::numeric, 2) as total_time_ms,
          ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
          ROUND(max_exec_time::numeric, 2) as max_time_ms,
          ROUND(min_exec_time::numeric, 2) as min_time_ms,
          ROUND(stddev_exec_time::numeric, 2) as stddev_time_ms,
          rows,
          ROUND(100.0 * total_exec_time / sum(total_exec_time) OVER(), 2) as percent_of_total
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_%'
          AND query NOT LIKE '%information_schema%'
          AND calls > 1
        ORDER BY total_exec_time DESC
        LIMIT $1;
      `, [limit]);

      return result.rows.map(row => ({
        queryHash: row.queryid,
        query: row.query,
        calls: parseInt(row.calls),
        totalTimeMs: parseFloat(row.total_time_ms),
        avgTimeMs: parseFloat(row.avg_time_ms),
        maxTimeMs: parseFloat(row.max_time_ms),
        minTimeMs: parseFloat(row.min_time_ms),
        stdDevTimeMs: parseFloat(row.stddev_time_ms),
        rowsReturned: parseInt(row.rows),
        percentOfTotal: parseFloat(row.percent_of_total)
      }));

    } catch (error) {
      console.error('❌ Failed to analyze query performance:', error);
      throw error;
    }
  }

  /**
   * Analyze index usage
   */
  async analyzeIndexUsage(): Promise<IndexUsage[]> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
          pg_relation_size(indexrelid) as index_size_bytes,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          CASE 
            WHEN idx_tup_read = 0 THEN 0
            ELSE ROUND(100.0 * idx_tup_fetch / idx_tup_read, 2)
          END as efficiency
        FROM pg_stat_user_indexes
        ORDER BY pg_relation_size(indexrelid) DESC;
      `);

      return result.rows.map(row => {
        const scans = parseInt(row.idx_scan);
        const sizeBytes = parseInt(row.index_size_bytes);
        
        let usage: IndexUsage['usage'];
        if (scans === 0) usage = 'unused';
        else if (scans < 100) usage = 'low';
        else if (scans < 1000) usage = 'medium';
        else usage = 'high';

        return {
          schemaName: row.schemaname,
          tableName: row.tablename,
          indexName: row.indexname,
          indexSize: sizeBytes,
          indexScans: scans,
          tuplesRead: parseInt(row.idx_tup_read),
          tuplesReturned: parseInt(row.idx_tup_fetch),
          efficiency: parseFloat(row.efficiency),
          usage
        };
      });

    } catch (error) {
      console.error('❌ Failed to analyze index usage:', error);
      throw error;
    }
  }

  /**
   * Get table statistics
   */
  async getTableStatistics(): Promise<TableStats[]> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
          pg_relation_size(schemaname||'.'||tablename) as table_size_bytes,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
          pg_indexes_size(schemaname||'.'||tablename) as index_size_bytes,
          n_live_tup,
          n_dead_tup,
          n_tup_ins + n_tup_upd + n_tup_del as total_modifications,
          vacuum_count,
          autovacuum_count,
          analyze_count,
          autoanalyze_count,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `);

      return result.rows.map(row => ({
        schemaName: row.schemaname,
        tableName: row.tablename,
        tableSize: parseInt(row.table_size_bytes),
        indexSize: parseInt(row.index_size_bytes),
        totalSize: parseInt(row.total_size_bytes),
        liveRows: parseInt(row.n_live_tup),
        deadRows: parseInt(row.n_dead_tup),
        vacuumCount: parseInt(row.vacuum_count),
        autoVacuumCount: parseInt(row.autovacuum_count),
        analyzeCount: parseInt(row.analyze_count),
        autoAnalyzeCount: parseInt(row.autoanalyze_count),
        lastVacuum: row.last_vacuum ? new Date(row.last_vacuum) : undefined,
        lastAutoVacuum: row.last_autovacuum ? new Date(row.last_autovacuum) : undefined,
        lastAnalyze: row.last_analyze ? new Date(row.last_analyze) : undefined,
        lastAutoAnalyze: row.last_autoanalyze ? new Date(row.last_autoanalyze) : undefined
      }));

    } catch (error) {
      console.error('❌ Failed to get table statistics:', error);
      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  async getConnectionPoolStats(): Promise<ConnectionPoolStats> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections,
          current_setting('max_connections')::int as max_connections
        FROM pg_stat_activity;
      `);

      const row = result.rows[0];
      const total = parseInt(row.total_connections);
      const max = parseInt(row.max_connections);

      return {
        totalConnections: total,
        activeConnections: parseInt(row.active_connections),
        idleConnections: parseInt(row.idle_connections),
        waitingConnections: parseInt(row.waiting_connections),
        maxConnections: max,
        utilization: Math.round((total / max) * 100),
        avgWaitTime: 0, // Would need more complex query to calculate
        connectionErrors: 0 // Would need to track separately
      };

    } catch (error) {
      console.error('❌ Failed to get connection pool stats:', error);
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<PerformanceReport> {
    try {
      console.log('🔄 Generating performance report...');

      const [
        queryPerformance,
        indexUsage,
        tableStats,
        connectionStats
      ] = await Promise.all([
        this.analyzeQueryPerformance(10),
        this.analyzeIndexUsage(),
        this.getTableStatistics(),
        this.getConnectionPoolStats()
      ]);

      // Identify unused indexes
      const unusedIndexes = indexUsage.filter(idx => idx.usage === 'unused');
      
      // Identify inefficient indexes (low efficiency)
      const inefficientIndexes = indexUsage.filter(idx => 
        idx.efficiency < 50 && idx.indexScans > 0
      );

      // Generate maintenance recommendations
      const recommendations = this.generateMaintenanceRecommendations(
        tableStats,
        indexUsage,
        queryPerformance
      );

      // Generate recommended indexes based on slow queries
      const recommendedIndexes = this.generateIndexRecommendations(queryPerformance);

      // Calculate average query time
      const avgQueryTime = queryPerformance.length > 0 
        ? queryPerformance.reduce((sum, q) => sum + q.avgTimeMs, 0) / queryPerformance.length
        : 0;

      const report: PerformanceReport = {
        timestamp: new Date(),
        overview: {
          avgQueryTime,
          slowestQueries: queryPerformance.slice(0, 5),
          topTables: tableStats.slice(0, 10),
          connectionStats
        },
        indexAnalysis: {
          unusedIndexes,
          inefficientIndexes,
          recommendedIndexes
        },
        maintenanceRecommendations: recommendations,
        alerts: this.getActiveAlerts()
      };

      // Store in history
      this.performanceHistory.unshift(report);
      if (this.performanceHistory.length > 24) { // Keep last 24 reports
        this.performanceHistory = this.performanceHistory.slice(0, 24);
      }

      console.log('✅ Performance report generated');
      this.emit('performance_report', report);
      
      return report;

    } catch (error) {
      console.error('❌ Failed to generate performance report:', error);
      throw error;
    }
  }

  /**
   * Optimize slow queries by suggesting indexes
   */
  async optimizeSlowQueries(timeThreshold = 100): Promise<string[]> {
    try {
      const slowQueries = await this.dbManager.query(`
        SELECT 
          query,
          mean_exec_time,
          calls
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
          AND calls > 5
          AND query NOT LIKE '%pg_stat_%'
        ORDER BY mean_exec_time DESC
        LIMIT 10;
      `, [timeThreshold]);

      const recommendations: string[] = [];

      for (const query of slowQueries.rows) {
        // Simple heuristic-based index recommendations
        const suggestion = this.analyzeQueryForIndexing(query.query);
        if (suggestion) {
          recommendations.push(
            `Query averaging ${Math.round(query.mean_exec_time)}ms (${query.calls} calls): ${suggestion}`
          );
        }
      }

      return recommendations;

    } catch (error) {
      console.error('❌ Failed to optimize slow queries:', error);
      throw error;
    }
  }

  /**
   * Run maintenance operations
   */
  async runMaintenance(): Promise<{ vacuumed: string[]; analyzed: string[]; reindexed: string[] }> {
    try {
      console.log('🔄 Running database maintenance...');

      const results = {
        vacuumed: [] as string[],
        analyzed: [] as string[],
        reindexed: [] as string[]
      };

      // Get tables that need maintenance
      const tableStats = await this.getTableStatistics();
      
      for (const table of tableStats) {
        const tableName = `${table.schemaName}.${table.tableName}`;
        
        // Vacuum if dead tuple ratio > 10%
        const deadTupleRatio = table.liveRows > 0 
          ? (table.deadRows / (table.liveRows + table.deadRows)) * 100 
          : 0;
          
        if (deadTupleRatio > 10) {
          try {
            await this.dbManager.query(`VACUUM ANALYZE ${tableName}`);
            results.vacuumed.push(tableName);
            results.analyzed.push(tableName);
            console.log(`✅ Vacuumed and analyzed: ${tableName}`);
          } catch (error) {
            console.warn(`⚠️ Failed to vacuum ${tableName}:`, error);
          }
        }
        
        // Reindex if table is large and hasn't been maintained recently
        const daysSinceAnalyze = table.lastAnalyze 
          ? (Date.now() - table.lastAnalyze.getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
          
        if (table.totalSize > 100 * 1024 * 1024 && daysSinceAnalyze > 7) { // 100MB and 7 days
          try {
            await this.dbManager.query(`REINDEX TABLE ${tableName}`);
            results.reindexed.push(tableName);
            console.log(`✅ Reindexed: ${tableName}`);
          } catch (error) {
            console.warn(`⚠️ Failed to reindex ${tableName}:`, error);
          }
        }
      }

      console.log('✅ Database maintenance completed');
      this.emit('maintenance_complete', results);
      
      return results;

    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
      throw error;
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        const report = await this.generatePerformanceReport();
        this.checkPerformanceAlerts(report);
      } catch (error) {
        console.error('❌ Performance monitoring failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Start automatic tuning
   */
  private startAutoTuning(): void {
    // Run tuning every hour
    this.tuningInterval = setInterval(async () => {
      try {
        await this.runAutoTuning();
      } catch (error) {
        console.error('❌ Auto-tuning failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Run automatic tuning operations
   */
  private async runAutoTuning(): Promise<void> {
    console.log('🔄 Running automatic performance tuning...');

    try {
      // Check if maintenance is needed
      const tableStats = await this.getTableStatistics();
      const needsMaintenance = tableStats.some(table => {
        const deadTupleRatio = table.liveRows > 0 
          ? (table.deadRows / (table.liveRows + table.deadRows)) * 100 
          : 0;
        return deadTupleRatio > 20; // Higher threshold for auto-maintenance
      });

      if (needsMaintenance) {
        await this.runMaintenance();
      }

      // Check for unused indexes (but don't auto-drop them)
      const indexUsage = await this.analyzeIndexUsage();
      const unusedIndexes = indexUsage.filter(idx => idx.usage === 'unused');
      
      if (unusedIndexes.length > 0) {
        console.log(`⚠️ Found ${unusedIndexes.length} unused indexes that could be dropped`);
        this.addAlert({
          type: 'unused_index',
          severity: 'medium',
          message: `Found ${unusedIndexes.length} unused indexes consuming space`,
          metrics: { unusedIndexes: unusedIndexes.length },
          timestamp: new Date(),
          resolved: false
        });
      }

      console.log('✅ Automatic tuning completed');

    } catch (error) {
      console.error('❌ Automatic tuning failed:', error);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(report: PerformanceReport): void {
    // Check for slow queries
    const slowQueries = report.overview.slowestQueries.filter(q => q.avgTimeMs > 1000);
    if (slowQueries.length > 0) {
      this.addAlert({
        type: 'slow_query',
        severity: 'high',
        message: `${slowQueries.length} queries averaging over 1000ms`,
        metrics: { slowQueries: slowQueries.length, avgTime: report.overview.avgQueryTime },
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check connection utilization
    if (report.overview.connectionStats.utilization > 80) {
      this.addAlert({
        type: 'high_load',
        severity: 'high',
        message: `Connection utilization at ${report.overview.connectionStats.utilization}%`,
        metrics: report.overview.connectionStats,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check for large numbers of dead tuples
    const tablesNeedingVacuum = report.overview.topTables.filter(table => {
      const deadTupleRatio = table.liveRows > 0 
        ? (table.deadRows / (table.liveRows + table.deadRows)) * 100 
        : 0;
      return deadTupleRatio > 15;
    });

    if (tablesNeedingVacuum.length > 0) {
      this.addAlert({
        type: 'memory_pressure',
        severity: 'medium',
        message: `${tablesNeedingVacuum.length} tables need vacuum (>15% dead tuples)`,
        metrics: { tablesNeedingVacuum: tablesNeedingVacuum.length },
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > 100) { // Keep last 100 alerts
      this.alerts = this.alerts.slice(0, 100);
    }
    
    this.emit('performance_alert', alert);
  }

  /**
   * Get active alerts
   */
  private getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Generate maintenance recommendations
   */
  private generateMaintenanceRecommendations(
    tableStats: TableStats[],
    indexUsage: IndexUsage[],
    queryPerformance: QueryPerformance[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for tables needing vacuum
    const tablesNeedingVacuum = tableStats.filter(table => {
      const deadTupleRatio = table.liveRows > 0 
        ? (table.deadRows / (table.liveRows + table.deadRows)) * 100 
        : 0;
      return deadTupleRatio > 10;
    });

    if (tablesNeedingVacuum.length > 0) {
      recommendations.push(
        `Run VACUUM on ${tablesNeedingVacuum.length} tables with high dead tuple ratios`
      );
    }

    // Check for unused indexes
    const unusedIndexes = indexUsage.filter(idx => idx.usage === 'unused');
    if (unusedIndexes.length > 0) {
      recommendations.push(
        `Consider dropping ${unusedIndexes.length} unused indexes to save space`
      );
    }

    // Check for slow queries needing optimization
    const slowQueries = queryPerformance.filter(q => q.avgTimeMs > 500);
    if (slowQueries.length > 0) {
      recommendations.push(
        `Optimize ${slowQueries.length} queries averaging over 500ms execution time`
      );
    }

    // Check for missing statistics
    const staleStats = tableStats.filter(table => {
      const daysSinceAnalyze = table.lastAnalyze 
        ? (Date.now() - table.lastAnalyze.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      return daysSinceAnalyze > 7;
    });

    if (staleStats.length > 0) {
      recommendations.push(
        `Run ANALYZE on ${staleStats.length} tables with stale statistics`
      );
    }

    return recommendations;
  }

  /**
   * Generate index recommendations based on query patterns
   */
  private generateIndexRecommendations(queries: QueryPerformance[]): string[] {
    const recommendations: string[] = [];
    
    // This is a simplified heuristic - in production, you'd want more sophisticated analysis
    for (const query of queries.slice(0, 5)) { // Top 5 slowest queries
      if (query.avgTimeMs > 100) {
        const suggestion = this.analyzeQueryForIndexing(query.query);
        if (suggestion) {
          recommendations.push(suggestion);
        }
      }
    }

    return recommendations;
  }

  /**
   * Analyze query for potential indexing improvements
   */
  private analyzeQueryForIndexing(query: string): string | null {
    // Simple heuristic-based analysis
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('where') && lowerQuery.includes('order by')) {
      return "Consider composite index on WHERE and ORDER BY columns";
    } else if (lowerQuery.includes('where') && lowerQuery.includes('symbol')) {
      return "Consider index on symbol column used in WHERE clause";
    } else if (lowerQuery.includes('join') && lowerQuery.includes('on')) {
      return "Consider indexes on JOIN columns";
    } else if (lowerQuery.includes('group by')) {
      return "Consider index on GROUP BY columns";
    }
    
    return null;
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PerformanceReport[] {
    return [...this.performanceHistory];
  }

  /**
   * Shutdown performance tuner
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down performance tuner...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.tuningInterval) {
      clearInterval(this.tuningInterval);
    }
    
    console.log('✅ Performance tuner shutdown complete');
    this.emit('shutdown');
  }
}

// Export singleton instance
let tunerInstance: PerformanceTuner | null = null;

export const getPerformanceTuner = (databaseManager?: DatabaseManager): PerformanceTuner => {
  if (!tunerInstance) {
    tunerInstance = new PerformanceTuner(databaseManager);
  }
  return tunerInstance;
};

export default PerformanceTuner;