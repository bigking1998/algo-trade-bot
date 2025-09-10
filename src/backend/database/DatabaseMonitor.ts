/**
 * Task DB-006: Database Monitoring & Health System Implementation
 * 
 * This module implements comprehensive database monitoring and health checking including:
 * - Real-time database health monitoring and alerting
 * - Performance metrics collection and analysis
 * - Slow query detection and analysis
 * - Connection pool monitoring
 * - Disk space and resource usage monitoring
 * - Automated health reporting and alerting
 */

import { DatabaseManager } from './DatabaseManager';
import { TimescaleOptimizer } from './TimescaleOptimizer';
import { PerformanceTuner } from './PerformanceTuner';
import { EventEmitter } from 'events';

export interface DatabaseHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  timestamp: Date;
  uptime: number;
  components: {
    connection: HealthStatus;
    performance: HealthStatus;
    storage: HealthStatus;
    replication: HealthStatus;
    backup: HealthStatus;
    timescale: HealthStatus;
  };
  metrics: DatabaseMetrics;
  alerts: HealthAlert[];
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details?: any;
  lastChecked: Date;
}

export interface DatabaseMetrics {
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
    utilization: number;
  };
  performance: {
    avgQueryTime: number;
    queriesPerSecond: number;
    slowQueries: number;
    lockWaits: number;
    indexHitRatio: number;
    bufferHitRatio: number;
  };
  storage: {
    totalSize: number;
    availableSpace: number;
    utilization: number;
    walSize: number;
    tablespaceSizes: Array<{ name: string; size: number; usage: number }>;
  };
  timescale: {
    hypertables: number;
    chunks: number;
    compressedChunks: number;
    compressionRatio: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskIO: { reads: number; writes: number };
    networkIO: { sent: number; received: number };
  };
}

export interface HealthAlert {
  id: string;
  type: 'connection' | 'performance' | 'storage' | 'replication' | 'backup' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface MonitoringConfig {
  checkInterval: number; // milliseconds
  alertThresholds: {
    connectionUtilization: number; // percentage
    avgQueryTime: number; // milliseconds
    slowQueryThreshold: number; // milliseconds
    diskUsage: number; // percentage
    bufferHitRatio: number; // percentage
    indexHitRatio: number; // percentage
    walSize: number; // bytes
  };
  retentionPeriod: number; // days
  enableAlerts: boolean;
  webhookUrl?: string;
  emailNotifications?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig: any;
  };
}

export interface HealthReport {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown';
    uptime: number;
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
  };
  trends: {
    performanceTrend: 'improving' | 'stable' | 'degrading';
    storageTrend: 'stable' | 'growing' | 'shrinking';
    connectionTrend: 'stable' | 'increasing' | 'decreasing';
  };
  recommendations: string[];
  alerts: HealthAlert[];
}

export class DatabaseMonitor extends EventEmitter {
  private dbManager: DatabaseManager;
  private timescaleOptimizer?: TimescaleOptimizer;
  private performanceTuner?: PerformanceTuner;
  private config: MonitoringConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private metricsHistory: DatabaseMetrics[] = [];
  private alerts: HealthAlert[] = [];
  private isMonitoring = false;
  private startTime = new Date();

  constructor(config: MonitoringConfig, databaseManager?: DatabaseManager) {
    super();
    this.config = config;
    this.dbManager = databaseManager || DatabaseManager.getInstance();
  }

  /**
   * Initialize database monitoring system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing database monitoring system...');

      await this.dbManager.initialize();

      // Initialize related systems
      this.timescaleOptimizer = new TimescaleOptimizer(this.dbManager);
      this.performanceTuner = new PerformanceTuner(this.dbManager);

      // Create monitoring tables
      await this.createMonitoringTables();

      // Start monitoring
      this.startMonitoring();

      // Setup alert handlers
      this.setupAlertHandlers();

      console.log('✅ Database monitoring system initialized successfully');
      this.emit('initialized');

    } catch (error) {
      console.error('❌ Database monitoring initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get current database health status
   */
  async getCurrentHealth(): Promise<DatabaseHealth> {
    try {
      const [
        connectionStatus,
        performanceStatus,
        storageStatus,
        replicationStatus,
        backupStatus,
        timescaleStatus
      ] = await Promise.all([
        this.checkConnectionHealth(),
        this.checkPerformanceHealth(),
        this.checkStorageHealth(),
        this.checkReplicationHealth(),
        this.checkBackupHealth(),
        this.checkTimescaleHealth()
      ]);

      const metrics = await this.collectMetrics();
      const uptime = Date.now() - this.startTime.getTime();

      // Determine overall health
      const statuses = [
        connectionStatus,
        performanceStatus,
        storageStatus,
        replicationStatus,
        backupStatus,
        timescaleStatus
      ];

      let overall: DatabaseHealth['overall'] = 'healthy';
      if (statuses.some(s => s.status === 'critical')) {
        overall = 'critical';
      } else if (statuses.some(s => s.status === 'warning')) {
        overall = 'warning';
      } else if (statuses.some(s => s.status === 'unknown')) {
        overall = 'unknown';
      }

      return {
        overall,
        timestamp: new Date(),
        uptime,
        components: {
          connection: connectionStatus,
          performance: performanceStatus,
          storage: storageStatus,
          replication: replicationStatus,
          backup: backupStatus,
          timescale: timescaleStatus
        },
        metrics,
        alerts: this.getActiveAlerts()
      };

    } catch (error) {
      console.error('❌ Failed to get current health:', error);
      throw error;
    }
  }

  /**
   * Get database metrics
   */
  async getMetrics(): Promise<DatabaseMetrics> {
    return this.collectMetrics();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours = 24): DatabaseMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => 
      'timestamp' in m && (m as any).timestamp >= cutoffTime
    );
  }

  /**
   * Generate health report
   */
  async generateHealthReport(periodHours = 24): Promise<HealthReport> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (periodHours * 60 * 60 * 1000));
      
      const reportId = this.generateReportId();
      
      // Get metrics for the period
      const periodMetrics = this.getMetricsHistory(periodHours);
      
      // Calculate summary statistics
      const totalQueries = periodMetrics.reduce((sum, m) => 
        sum + (m.performance.queriesPerSecond * 3600), 0); // Approximate
      const avgResponseTime = periodMetrics.length > 0 
        ? periodMetrics.reduce((sum, m) => sum + m.performance.avgQueryTime, 0) / periodMetrics.length
        : 0;

      // Analyze trends
      const trends = this.analyzeTrends(periodMetrics);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(periodMetrics);
      
      // Get alerts for the period
      const periodAlerts = this.alerts.filter(a => 
        a.timestamp >= startTime && a.timestamp <= endTime
      );

      const currentHealth = await this.getCurrentHealth();

      return {
        id: reportId,
        timestamp: new Date(),
        period: { start: startTime, end: endTime },
        summary: {
          overallHealth: currentHealth.overall,
          uptime: currentHealth.uptime,
          totalQueries: Math.round(totalQueries),
          avgResponseTime: Math.round(avgResponseTime),
          errorRate: 0 // Would need to track errors separately
        },
        trends,
        recommendations,
        alerts: periodAlerts
      };

    } catch (error) {
      console.error('❌ Failed to generate health report:', error);
      throw error;
    }
  }

  /**
   * Add custom alert
   */
  addAlert(alert: Omit<HealthAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const fullAlert: HealthAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.unshift(fullAlert);
    
    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(0, 1000);
    }

    this.emit('alert', fullAlert);
    this.handleAlert(fullAlert);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert_resolved', alert);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runMonitoringCycle();
      } catch (error) {
        console.error('❌ Monitoring cycle failed:', error);
        this.emit('monitoring_error', error);
      }
    }, this.config.checkInterval);

    console.log(`✅ Database monitoring started (interval: ${this.config.checkInterval}ms)`);
  }

  /**
   * Run a complete monitoring cycle
   */
  private async runMonitoringCycle(): Promise<void> {
    const health = await this.getCurrentHealth();
    const metrics = health.metrics;
    
    // Store metrics in history
    (metrics as any).timestamp = Date.now();
    this.metricsHistory.unshift(metrics);
    
    // Keep only recent history
    const retentionMs = this.config.retentionPeriod * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;
    this.metricsHistory = this.metricsHistory.filter(m => 
      (m as any).timestamp >= cutoffTime
    );

    // Check thresholds and generate alerts
    await this.checkThresholds(metrics);

    // Emit health status
    this.emit('health_check', health);

    // Store metrics in database
    await this.storeMetrics(metrics);
  }

  /**
   * Check connection health
   */
  private async checkConnectionHealth(): Promise<HealthStatus> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          current_setting('max_connections')::int as max_connections
        FROM pg_stat_activity;
      `);

      const row = result.rows[0] as any;
      const utilization = (row.total_connections / row.max_connections) * 100;

      let status: HealthStatus['status'] = 'healthy';
      let message = `${row.active_connections} active connections (${utilization.toFixed(1)}% utilization)`;

      if (utilization > 90) {
        status = 'critical';
        message = `High connection utilization: ${utilization.toFixed(1)}%`;
      } else if (utilization > 80) {
        status = 'warning';
        message = `Moderate connection utilization: ${utilization.toFixed(1)}%`;
      }

      return {
        status,
        message,
        details: row,
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Connection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check performance health
   */
  private async checkPerformanceHealth(): Promise<HealthStatus> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          COALESCE(ROUND(AVG(mean_exec_time)::numeric, 2), 0) as avg_query_time,
          COUNT(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries,
          COALESCE(
            ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 2),
            0
          ) as buffer_hit_ratio
        FROM pg_stat_statements
        LEFT JOIN pg_statio_user_tables ON true
        WHERE query NOT LIKE '%pg_stat_%';
      `);

      const row = result.rows[0] as any;
      const avgQueryTime = parseFloat(row.avg_query_time);
      const slowQueries = parseInt(row.slow_queries);
      const bufferHitRatio = parseFloat(row.buffer_hit_ratio);

      let status: HealthStatus['status'] = 'healthy';
      let message = `Avg query time: ${avgQueryTime}ms, Buffer hit ratio: ${bufferHitRatio}%`;

      if (avgQueryTime > 1000 || bufferHitRatio < 90 || slowQueries > 10) {
        status = 'critical';
        message = `Performance issues detected: ${avgQueryTime}ms avg, ${slowQueries} slow queries`;
      } else if (avgQueryTime > 500 || bufferHitRatio < 95 || slowQueries > 5) {
        status = 'warning';
        message = `Performance degraded: ${avgQueryTime}ms avg, ${slowQueries} slow queries`;
      }

      return {
        status,
        message,
        details: row,
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<HealthStatus> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_database_size(current_database()) as db_size_bytes,
          pg_size_pretty(sum(pg_stat_file('pg_wal/' || name, true))) as wal_size
        FROM pg_ls_waldir()
        WHERE name ~ '^[0-9A-F]{24}$';
      `);

      const row = result.rows[0] as any;
      const dbSizeBytes = parseInt(row.db_size_bytes);
      const walSizeBytes = parseInt(row.wal_size) || 0;

      // Simple heuristic for available space (would need system-specific implementation)
      const estimatedAvailable = 10 * 1024 * 1024 * 1024; // 10GB placeholder
      const utilization = (dbSizeBytes / (dbSizeBytes + estimatedAvailable)) * 100;

      let status: HealthStatus['status'] = 'healthy';
      let message = `Database size: ${row.db_size}, WAL size: ${row.wal_size}`;

      if (utilization > 90) {
        status = 'critical';
        message = `Low disk space: ${utilization.toFixed(1)}% used`;
      } else if (utilization > 80) {
        status = 'warning';
        message = `Disk space warning: ${utilization.toFixed(1)}% used`;
      }

      return {
        status,
        message,
        details: { ...row, utilization },
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check replication health
   */
  private async checkReplicationHealth(): Promise<HealthStatus> {
    try {
      // Check if this is a primary server
      const result = await this.dbManager.query('SELECT pg_is_in_recovery()');
      const isReplica = (result.rows[0] as any).pg_is_in_recovery;

      if (!isReplica) {
        // Check replication status for primary
        const replResult = await this.dbManager.query(`
          SELECT 
            client_addr,
            state,
            sync_state,
            pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as lag_bytes
          FROM pg_stat_replication;
        `);

        if (replResult.rows.length === 0) {
          return {
            status: 'warning',
            message: 'No replication configured',
            lastChecked: new Date()
          };
        }

        const replicas = replResult.rows;
        const maxLag = Math.max(...replicas.map(r => parseInt(r.lag_bytes) || 0));

        let status: HealthStatus['status'] = 'healthy';
        let message = `${replicas.length} replicas, max lag: ${maxLag} bytes`;

        if (maxLag > 1024 * 1024 * 100) { // 100MB
          status = 'critical';
          message = `High replication lag: ${Math.round(maxLag / (1024 * 1024))}MB`;
        } else if (maxLag > 1024 * 1024 * 10) { // 10MB
          status = 'warning';
          message = `Moderate replication lag: ${Math.round(maxLag / (1024 * 1024))}MB`;
        }

        return {
          status,
          message,
          details: replicas,
          lastChecked: new Date()
        };
      } else {
        // Check replica lag
        const lagResult = await this.dbManager.query(`
          SELECT 
            CASE 
              WHEN pg_is_in_recovery() THEN
                pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn())
              ELSE 0
            END as replay_lag_bytes;
        `);

        const lagBytes = parseInt((lagResult.rows[0] as any).replay_lag_bytes) || 0;

        let status: HealthStatus['status'] = 'healthy';
        let message = `Replica lag: ${lagBytes} bytes`;

        if (lagBytes > 1024 * 1024 * 100) { // 100MB
          status = 'critical';
          message = `High replica lag: ${Math.round(lagBytes / (1024 * 1024))}MB`;
        } else if (lagBytes > 1024 * 1024 * 10) { // 10MB
          status = 'warning';
          message = `Moderate replica lag: ${Math.round(lagBytes / (1024 * 1024))}MB`;
        }

        return {
          status,
          message,
          details: { lagBytes },
          lastChecked: new Date()
        };
      }

    } catch (error) {
      return {
        status: 'unknown',
        message: `Replication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check backup health
   */
  private async checkBackupHealth(): Promise<HealthStatus> {
    try {
      // Check if backup metadata table exists
      const backupResult = await this.dbManager.query(`
        SELECT 
          COUNT(*) as total_backups,
          COUNT(*) FILTER (WHERE status = 'completed') as successful_backups,
          MAX(start_time) as last_backup_time
        FROM backup_metadata
        WHERE start_time > NOW() - INTERVAL '7 days';
      `);

      const row = backupResult.rows[0] as any;
      const totalBackups = parseInt(row.total_backups);
      const successfulBackups = parseInt(row.successful_backups);
      const lastBackupTime = row.last_backup_time ? new Date(row.last_backup_time) : null;

      let status: HealthStatus['status'] = 'healthy';
      let message = `${successfulBackups}/${totalBackups} backups successful`;

      if (!lastBackupTime) {
        status = 'critical';
        message = 'No recent backups found';
      } else {
        const daysSinceBackup = (Date.now() - lastBackupTime.getTime()) / (24 * 60 * 60 * 1000);
        
        if (daysSinceBackup > 2) {
          status = 'critical';
          message = `Last backup ${Math.round(daysSinceBackup)} days ago`;
        } else if (daysSinceBackup > 1) {
          status = 'warning';
          message = `Last backup ${Math.round(daysSinceBackup)} day(s) ago`;
        } else if (successfulBackups < totalBackups) {
          status = 'warning';
          message = `Some backup failures: ${successfulBackups}/${totalBackups}`;
        }
      }

      return {
        status,
        message,
        details: row,
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        status: 'unknown',
        message: 'Backup status unknown (backup system may not be configured)',
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check TimescaleDB health
   */
  private async checkTimescaleHealth(): Promise<HealthStatus> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          COUNT(*) as hypertables,
          SUM(
            (SELECT COUNT(*) FROM timescaledb_information.chunks c 
             WHERE c.hypertable_schema = h.hypertable_schema 
             AND c.hypertable_name = h.hypertable_name)
          ) as total_chunks,
          SUM(
            (SELECT COUNT(*) FROM timescaledb_information.chunks c 
             WHERE c.hypertable_schema = h.hypertable_schema 
             AND c.hypertable_name = h.hypertable_name
             AND c.compressed_heap_size > 0)
          ) as compressed_chunks
        FROM timescaledb_information.hypertables h;
      `);

      const row = result.rows[0] as any;
      const hypertables = parseInt(row.hypertables);
      const totalChunks = parseInt(row.total_chunks);
      const compressedChunks = parseInt(row.compressed_chunks);
      
      const compressionRatio = totalChunks > 0 ? (compressedChunks / totalChunks) * 100 : 0;

      return {
        status: 'healthy',
        message: `${hypertables} hypertables, ${totalChunks} chunks (${compressionRatio.toFixed(1)}% compressed)`,
        details: { hypertables, totalChunks, compressedChunks, compressionRatio },
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        status: 'unknown',
        message: 'TimescaleDB status unknown (extension may not be installed)',
        lastChecked: new Date()
      };
    }
  }

  /**
   * Collect comprehensive database metrics
   */
  private async collectMetrics(): Promise<DatabaseMetrics> {
    const [
      connectionMetrics,
      performanceMetrics,
      storageMetrics,
      timescaleMetrics,
      systemMetrics
    ] = await Promise.all([
      this.getConnectionMetrics(),
      this.getPerformanceMetrics(),
      this.getStorageMetrics(),
      this.getTimescaleMetrics(),
      this.getSystemMetrics()
    ]);

    return {
      connections: connectionMetrics,
      performance: performanceMetrics,
      storage: storageMetrics,
      timescale: timescaleMetrics,
      system: systemMetrics
    };
  }

  /**
   * Get connection metrics
   */
  private async getConnectionMetrics(): Promise<DatabaseMetrics['connections']> {
    const result = await this.dbManager.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting,
        current_setting('max_connections')::int as max_connections
      FROM pg_stat_activity;
    `);

    const row = result.rows[0] as any;
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      idle: parseInt(row.idle),
      waiting: parseInt(row.waiting),
      maxConnections: parseInt(row.max_connections),
      utilization: (parseInt(row.total) / parseInt(row.max_connections)) * 100
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<DatabaseMetrics['performance']> {
    const result = await this.dbManager.query(`
      SELECT 
        COALESCE(ROUND(AVG(mean_exec_time)::numeric, 2), 0) as avg_query_time,
        COALESCE(SUM(calls), 0) as total_calls,
        COUNT(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries,
        COALESCE(
          ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 2),
          0
        ) as buffer_hit_ratio,
        COALESCE(
          ROUND(100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0), 2),
          0
        ) as index_hit_ratio
      FROM pg_stat_statements
      LEFT JOIN pg_statio_user_tables ON true
      LEFT JOIN pg_statio_user_indexes ON true
      WHERE query NOT LIKE '%pg_stat_%';
    `);

    const row = result.rows[0];
    const intervalSeconds = this.config.checkInterval / 1000;
    
    return {
      avgQueryTime: parseFloat(row.avg_query_time),
      queriesPerSecond: Math.round(parseInt(row.total_calls) / intervalSeconds),
      slowQueries: parseInt(row.slow_queries),
      lockWaits: 0, // Would need additional query
      indexHitRatio: parseFloat(row.index_hit_ratio),
      bufferHitRatio: parseFloat(row.buffer_hit_ratio)
    };
  }

  /**
   * Get storage metrics
   */
  private async getStorageMetrics(): Promise<DatabaseMetrics['storage']> {
    const result = await this.dbManager.query(`
      SELECT 
        pg_database_size(current_database()) as total_size,
        0 as available_space, -- Would need system-specific implementation
        COALESCE(sum(pg_stat_file('pg_wal/' || name, true)), 0) as wal_size
      FROM pg_ls_waldir()
      WHERE name ~ '^[0-9A-F]{24}$';
    `);

    const row = result.rows[0];
    const totalSize = parseInt(row.total_size);
    const availableSpace = parseInt(row.available_space) || (10 * 1024 * 1024 * 1024); // 10GB placeholder
    
    return {
      totalSize,
      availableSpace,
      utilization: (totalSize / (totalSize + availableSpace)) * 100,
      walSize: parseInt(row.wal_size),
      tablespaceSizes: [] // Would need additional implementation
    };
  }

  /**
   * Get TimescaleDB metrics
   */
  private async getTimescaleMetrics(): Promise<DatabaseMetrics['timescale']> {
    try {
      const result = await this.dbManager.query(`
        SELECT 
          (SELECT COUNT(*) FROM timescaledb_information.hypertables) as hypertables,
          (SELECT COUNT(*) FROM timescaledb_information.chunks) as chunks,
          (SELECT COUNT(*) FROM timescaledb_information.chunks WHERE compressed_heap_size > 0) as compressed_chunks,
          COALESCE(
            (SELECT AVG(
              CASE WHEN uncompressed_heap_size > 0 
              THEN (1.0 - compressed_heap_size::float / uncompressed_heap_size) * 100 
              ELSE 0 END
            ) FROM timescaledb_information.chunks WHERE compressed_heap_size > 0), 0
          ) as compression_ratio;
      `);

      const row = result.rows[0];
      return {
        hypertables: parseInt(row.hypertables),
        chunks: parseInt(row.chunks),
        compressedChunks: parseInt(row.compressed_chunks),
        compressionRatio: parseFloat(row.compression_ratio)
      };
    } catch (error) {
      return {
        hypertables: 0,
        chunks: 0,
        compressedChunks: 0,
        compressionRatio: 0
      };
    }
  }

  /**
   * Get system metrics (placeholder - would need system-specific implementation)
   */
  private async getSystemMetrics(): Promise<DatabaseMetrics['system']> {
    return {
      cpuUsage: 0, // Would need system monitoring
      memoryUsage: 0, // Would need system monitoring
      diskIO: { reads: 0, writes: 0 }, // Would need system monitoring
      networkIO: { sent: 0, received: 0 } // Would need system monitoring
    };
  }

  /**
   * Check metric thresholds and generate alerts
   */
  private async checkThresholds(metrics: DatabaseMetrics): Promise<void> {
    const { alertThresholds } = this.config;

    // Connection utilization alert
    if (metrics.connections.utilization > alertThresholds.connectionUtilization) {
      this.addAlert({
        type: 'connection',
        severity: 'warning',
        title: 'High Connection Utilization',
        message: `Connection utilization at ${metrics.connections.utilization.toFixed(1)}%`,
        metadata: { utilization: metrics.connections.utilization }
      });
    }

    // Query performance alerts
    if (metrics.performance.avgQueryTime > alertThresholds.avgQueryTime) {
      this.addAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Average Query Time',
        message: `Average query time: ${metrics.performance.avgQueryTime}ms`,
        metadata: { avgQueryTime: metrics.performance.avgQueryTime }
      });
    }

    // Buffer hit ratio alert
    if (metrics.performance.bufferHitRatio < alertThresholds.bufferHitRatio) {
      this.addAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Low Buffer Hit Ratio',
        message: `Buffer hit ratio: ${metrics.performance.bufferHitRatio}%`,
        metadata: { bufferHitRatio: metrics.performance.bufferHitRatio }
      });
    }

    // Storage alerts
    if (metrics.storage.utilization > alertThresholds.diskUsage) {
      this.addAlert({
        type: 'storage',
        severity: 'critical',
        title: 'High Disk Usage',
        message: `Disk usage: ${metrics.storage.utilization.toFixed(1)}%`,
        metadata: { diskUsage: metrics.storage.utilization }
      });
    }

    // WAL size alert
    if (metrics.storage.walSize > alertThresholds.walSize) {
      this.addAlert({
        type: 'storage',
        severity: 'warning',
        title: 'Large WAL Size',
        message: `WAL size: ${this.formatFileSize(metrics.storage.walSize)}`,
        metadata: { walSize: metrics.storage.walSize }
      });
    }
  }

  /**
   * Helper methods
   */
  private createMonitoringTables(): Promise<void> {
    return this.dbManager.query(`
      CREATE TABLE IF NOT EXISTS monitoring_metrics (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metrics JSONB NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp 
      ON monitoring_metrics (timestamp DESC);
    `);
  }

  private async storeMetrics(metrics: DatabaseMetrics): Promise<void> {
    await this.dbManager.query(
      'INSERT INTO monitoring_metrics (metrics) VALUES ($1)',
      [JSON.stringify(metrics)]
    );
  }

  private setupAlertHandlers(): void {
    this.on('alert', (alert: HealthAlert) => {
      if (this.config.enableAlerts) {
        console.log(`🚨 Alert: [${alert.severity.toUpperCase()}] ${alert.title} - ${alert.message}`);
      }
    });
  }

  private handleAlert(alert: HealthAlert): void {
    // Webhook notifications
    if (this.config.webhookUrl) {
      this.sendWebhookAlert(alert);
    }

    // Email notifications
    if (this.config.emailNotifications?.enabled) {
      this.sendEmailAlert(alert);
    }
  }

  private async sendWebhookAlert(alert: HealthAlert): Promise<void> {
    // Placeholder for webhook implementation
    console.log(`Sending webhook alert to ${this.config.webhookUrl}`, alert);
  }

  private async sendEmailAlert(alert: HealthAlert): Promise<void> {
    // Placeholder for email implementation
    console.log(`Sending email alert to ${this.config.emailNotifications?.recipients}`, alert);
  }

  private analyzeTrends(metrics: DatabaseMetrics[]): HealthReport['trends'] {
    // Simple trend analysis - could be enhanced
    if (metrics.length < 2) {
      return {
        performanceTrend: 'stable',
        storageTrend: 'stable',
        connectionTrend: 'stable'
      };
    }

    const recent = metrics.slice(0, metrics.length / 2);
    const older = metrics.slice(metrics.length / 2);

    const recentAvgQueryTime = recent.reduce((sum, m) => sum + m.performance.avgQueryTime, 0) / recent.length;
    const olderAvgQueryTime = older.reduce((sum, m) => sum + m.performance.avgQueryTime, 0) / older.length;

    const recentStorageUsage = recent.reduce((sum, m) => sum + m.storage.utilization, 0) / recent.length;
    const olderStorageUsage = older.reduce((sum, m) => sum + m.storage.utilization, 0) / older.length;

    const recentConnections = recent.reduce((sum, m) => sum + m.connections.utilization, 0) / recent.length;
    const olderConnections = older.reduce((sum, m) => sum + m.connections.utilization, 0) / older.length;

    return {
      performanceTrend: recentAvgQueryTime > olderAvgQueryTime * 1.1 ? 'degrading' :
                       recentAvgQueryTime < olderAvgQueryTime * 0.9 ? 'improving' : 'stable',
      storageTrend: recentStorageUsage > olderStorageUsage * 1.05 ? 'growing' :
                   recentStorageUsage < olderStorageUsage * 0.95 ? 'shrinking' : 'stable',
      connectionTrend: recentConnections > olderConnections * 1.05 ? 'increasing' :
                      recentConnections < olderConnections * 0.95 ? 'decreasing' : 'stable'
    };
  }

  private async generateRecommendations(metrics: DatabaseMetrics[]): Promise<string[]> {
    const recommendations: string[] = [];

    if (metrics.length === 0) return recommendations;

    const latest = metrics[0];

    // Performance recommendations
    if (latest.performance.avgQueryTime > 100) {
      recommendations.push('Consider optimizing slow queries or adding indexes');
    }

    if (latest.performance.bufferHitRatio < 95) {
      recommendations.push('Consider increasing shared_buffers to improve buffer hit ratio');
    }

    // Connection recommendations
    if (latest.connections.utilization > 80) {
      recommendations.push('Consider implementing connection pooling or increasing max_connections');
    }

    // Storage recommendations
    if (latest.storage.utilization > 85) {
      recommendations.push('Consider archiving old data or adding storage capacity');
    }

    return recommendations;
  }

  private generateReportId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `health_report_${timestamp}_${random}`;
  }

  private generateAlertId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `alert_${timestamp}_${random}`;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Shutdown monitoring system
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down database monitoring system...');

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log('✅ Database monitoring system shutdown complete');
    this.emit('shutdown');
  }
}

/**
 * Default monitoring configuration
 */
export const getDefaultMonitoringConfig = (): MonitoringConfig => ({
  checkInterval: 60000, // 1 minute
  alertThresholds: {
    connectionUtilization: 80, // percentage
    avgQueryTime: 500, // milliseconds
    slowQueryThreshold: 1000, // milliseconds
    diskUsage: 85, // percentage
    bufferHitRatio: 95, // percentage
    indexHitRatio: 95, // percentage
    walSize: 1024 * 1024 * 1024 // 1GB
  },
  retentionPeriod: 30, // days
  enableAlerts: true,
  webhookUrl: process.env.MONITORING_WEBHOOK_URL,
  emailNotifications: process.env.SMTP_HOST ? {
    enabled: true,
    recipients: process.env.ALERT_RECIPIENTS?.split(',') || [],
    smtpConfig: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  } : undefined
});

// Export singleton instance
let monitorInstance: DatabaseMonitor | null = null;

export const getDatabaseMonitor = (
  config?: MonitoringConfig,
  databaseManager?: DatabaseManager
): DatabaseMonitor => {
  if (!monitorInstance) {
    monitorInstance = new DatabaseMonitor(
      config || getDefaultMonitoringConfig(),
      databaseManager
    );
  }
  return monitorInstance;
};

export default DatabaseMonitor;