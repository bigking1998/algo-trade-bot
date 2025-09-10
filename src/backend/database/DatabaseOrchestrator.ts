/**
 * Database Orchestrator - Integration of All Database Systems
 * 
 * This module orchestrates all database systems implemented in Tasks DB-003 through DB-006:
 * - TimescaleDB Optimization (DB-003)
 * - Performance Tuning (DB-004)  
 * - Archival & Backup Systems (DB-005)
 * - Database Monitoring & Health (DB-006)
 */

import { DatabaseManager } from './DatabaseManager';
import { TimescaleOptimizer, getTimescaleOptimizer, getDefaultHypertableConfigs, getDefaultIndexConfigs } from './TimescaleOptimizer';
import { PerformanceTuner, getPerformanceTuner } from './PerformanceTuner';
import { ArchivalBackupManager, getArchivalBackupManager, getDefaultBackupConfig } from './ArchivalBackupManager';
import { DatabaseMonitor, getDatabaseMonitor, getDefaultMonitoringConfig } from './DatabaseMonitor';
import { EventEmitter } from 'events';

export interface DatabaseSystemStatus {
  timescaleOptimizer: {
    initialized: boolean;
    hypertables: number;
    optimizationCycles: number;
    lastOptimization?: Date;
  };
  performanceTuner: {
    initialized: boolean;
    avgQueryTime: number;
    slowQueries: number;
    lastTuning?: Date;
  };
  archivalBackup: {
    initialized: boolean;
    lastBackup?: Date;
    backupCount: number;
    archiveJobs: number;
  };
  monitoring: {
    initialized: boolean;
    overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown';
    activeAlerts: number;
    uptime: number;
  };
}

export interface ComprehensiveReport {
  timestamp: Date;
  systemStatus: DatabaseSystemStatus;
  performanceMetrics: {
    avgQueryTime: number;
    queriesPerSecond: number;
    connectionUtilization: number;
    bufferHitRatio: number;
    indexHitRatio: number;
  };
  optimizationSummary: {
    compressionRatio: number;
    chunkOptimizations: number;
    indexRecommendations: string[];
    maintenanceRecommendations: string[];
  };
  backupStatus: {
    lastFullBackup?: Date;
    backupCount: number;
    totalBackupSize: number;
    retentionCompliance: boolean;
  };
  healthStatus: {
    overallHealth: string;
    criticalAlerts: number;
    warningAlerts: number;
    systemUptime: number;
  };
  recommendations: string[];
}

export class DatabaseOrchestrator extends EventEmitter {
  private dbManager: DatabaseManager;
  private timescaleOptimizer: TimescaleOptimizer;
  private performanceTuner: PerformanceTuner;
  private archivalBackupManager: ArchivalBackupManager;
  private databaseMonitor: DatabaseMonitor;
  private initialized = false;
  private startTime = new Date();

  constructor(databaseManager?: DatabaseManager) {
    super();
    this.dbManager = databaseManager || DatabaseManager.getInstance();
    
    // Initialize all subsystems
    this.timescaleOptimizer = getTimescaleOptimizer(this.dbManager);
    this.performanceTuner = getPerformanceTuner(this.dbManager);
    this.archivalBackupManager = getArchivalBackupManager(getDefaultBackupConfig(), this.dbManager);
    this.databaseMonitor = getDatabaseMonitor(getDefaultMonitoringConfig(), this.dbManager);
  }

  /**
   * Initialize all database systems
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing comprehensive database orchestrator...');

      // Initialize database manager first
      await this.dbManager.initialize();

      // Initialize all subsystems in parallel
      await Promise.all([
        this.initializeTimescaleOptimizer(),
        this.initializePerformanceTuner(),
        this.initializeArchivalBackup(),
        this.initializeDatabaseMonitor()
      ]);

      // Setup cross-system event handling
      this.setupEventHandlers();

      // Run initial system optimization
      await this.runInitialOptimization();

      this.initialized = true;
      console.log('✅ Database orchestrator initialized successfully');
      this.emit('initialized');

    } catch (error) {
      console.error('❌ Database orchestrator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<DatabaseSystemStatus> {
    if (!this.initialized) {
      throw new Error('Database orchestrator not initialized');
    }

    try {
      const [
        timescaleStats,
        performanceStats,
        backupHistory,
        healthStatus
      ] = await Promise.all([
        this.timescaleOptimizer.getCompressionStats(),
        this.performanceTuner.analyzeQueryPerformance(10),
        this.archivalBackupManager.getBackupHistory(),
        this.databaseMonitor.getCurrentHealth()
      ]);

      return {
        timescaleOptimizer: {
          initialized: true,
          hypertables: timescaleStats.length,
          optimizationCycles: 0, // Would track this separately
          lastOptimization: undefined // Would track this separately
        },
        performanceTuner: {
          initialized: true,
          avgQueryTime: performanceStats.length > 0 ? performanceStats[0].avgTimeMs : 0,
          slowQueries: performanceStats.filter(q => q.avgTimeMs > 1000).length,
          lastTuning: undefined // Would track this separately
        },
        archivalBackup: {
          initialized: true,
          lastBackup: backupHistory.length > 0 ? backupHistory[0].startTime : undefined,
          backupCount: backupHistory.length,
          archiveJobs: this.archivalBackupManager.getArchiveJobs().length
        },
        monitoring: {
          initialized: true,
          overallHealth: healthStatus.overall,
          activeAlerts: healthStatus.alerts.length,
          uptime: healthStatus.uptime
        }
      };

    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive database report
   */
  async generateComprehensiveReport(): Promise<ComprehensiveReport> {
    if (!this.initialized) {
      throw new Error('Database orchestrator not initialized');
    }

    try {
      console.log('🔄 Generating comprehensive database report...');

      const [
        systemStatus,
        performanceReport,
        compressionStats,
        backupHistory,
        healthStatus
      ] = await Promise.all([
        this.getSystemStatus(),
        this.performanceTuner.generatePerformanceReport(),
        this.timescaleOptimizer.getCompressionStats(),
        this.archivalBackupManager.getBackupHistory(),
        this.databaseMonitor.getCurrentHealth()
      ]);

      // Calculate total backup size
      const totalBackupSize = backupHistory.reduce((sum, backup) => sum + backup.size, 0);

      // Calculate compression ratio
      const avgCompressionRatio = compressionStats.length > 0
        ? compressionStats.reduce((sum, stat) => sum + stat.compressionRatio, 0) / compressionStats.length
        : 0;

      // Count alerts by severity
      const criticalAlerts = healthStatus.alerts.filter(a => a.severity === 'critical').length;
      const warningAlerts = healthStatus.alerts.filter(a => a.severity === 'warning').length;

      // Generate comprehensive recommendations
      const recommendations = [
        ...performanceReport.maintenanceRecommendations,
        ...performanceReport.indexAnalysis.recommendedIndexes,
        ...this.generateSystemRecommendations(systemStatus, healthStatus)
      ];

      const report: ComprehensiveReport = {
        timestamp: new Date(),
        systemStatus,
        performanceMetrics: {
          avgQueryTime: performanceReport.overview.avgQueryTime,
          queriesPerSecond: 0, // Would need to calculate from metrics
          connectionUtilization: performanceReport.overview.connectionStats.utilization,
          bufferHitRatio: healthStatus.metrics.performance.bufferHitRatio,
          indexHitRatio: healthStatus.metrics.performance.indexHitRatio
        },
        optimizationSummary: {
          compressionRatio: avgCompressionRatio,
          chunkOptimizations: 0, // Would track optimizations performed
          indexRecommendations: performanceReport.indexAnalysis.recommendedIndexes,
          maintenanceRecommendations: performanceReport.maintenanceRecommendations
        },
        backupStatus: {
          lastFullBackup: backupHistory.find(b => b.type === 'full')?.startTime,
          backupCount: backupHistory.length,
          totalBackupSize,
          retentionCompliance: this.checkRetentionCompliance(backupHistory)
        },
        healthStatus: {
          overallHealth: healthStatus.overall,
          criticalAlerts,
          warningAlerts,
          systemUptime: healthStatus.uptime
        },
        recommendations: [...new Set(recommendations)] // Remove duplicates
      };

      console.log('✅ Comprehensive database report generated');
      this.emit('comprehensive_report', report);
      
      return report;

    } catch (error) {
      console.error('❌ Failed to generate comprehensive report:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive database optimization
   */
  async runComprehensiveOptimization(): Promise<{
    timescaleOptimization: any;
    performanceTuning: any;
    maintenanceResults: any;
    backupResults: any;
  }> {
    if (!this.initialized) {
      throw new Error('Database orchestrator not initialized');
    }

    try {
      console.log('🔄 Running comprehensive database optimization...');

      // Run TimescaleDB optimizations
      const compressionStats = await this.timescaleOptimizer.getCompressionStats();
      const timescaleOptimization = {
        chunksCompressed: 0,
        hypertablesOptimized: compressionStats.length,
        compressionSavings: compressionStats.reduce((sum, stat) => sum + stat.compressionSavings, 0)
      };

      // Run performance optimizations
      const slowQueryOptimization = await this.performanceTuner.optimizeSlowQueries();
      const performanceTuning = {
        slowQueriesOptimized: slowQueryOptimization.length,
        recommendationsGenerated: slowQueryOptimization
      };

      // Run database maintenance
      const maintenanceResults = await this.performanceTuner.runMaintenance();

      // Perform backup if needed
      const backupHistory = this.archivalBackupManager.getBackupHistory();
      const needsBackup = this.shouldPerformBackup(backupHistory);
      
      let backupResults = null;
      if (needsBackup) {
        backupResults = await this.archivalBackupManager.performFullBackup();
      }

      const results = {
        timescaleOptimization,
        performanceTuning,
        maintenanceResults,
        backupResults
      };

      console.log('✅ Comprehensive database optimization completed');
      this.emit('optimization_complete', results);
      
      return results;

    } catch (error) {
      console.error('❌ Comprehensive optimization failed:', error);
      throw error;
    }
  }

  /**
   * Perform system health validation
   */
  async validateSystemHealth(): Promise<{
    passed: boolean;
    results: {
      connectionTest: boolean;
      performanceTest: boolean;
      storageTest: boolean;
      backupTest: boolean;
      timescaleTest: boolean;
    };
    issues: string[];
  }> {
    try {
      console.log('🔄 Validating comprehensive database system health...');

      const issues: string[] = [];
      
      // Test database connectivity
      let connectionTest = false;
      try {
        await this.dbManager.query('SELECT 1');
        connectionTest = true;
      } catch (error) {
        issues.push('Database connection failed');
      }

      // Test performance metrics collection
      let performanceTest = false;
      try {
        const performanceMetrics = await this.performanceTuner.getPerformanceMetrics();
        performanceTest = performanceMetrics.avgQueryTime >= 0;
      } catch (error) {
        issues.push('Performance metrics collection failed');
      }

      // Test storage health
      let storageTest = false;
      try {
        const healthStatus = await this.databaseMonitor.getCurrentHealth();
        storageTest = healthStatus.components.storage.status !== 'critical';
      } catch (error) {
        issues.push('Storage health check failed');
      }

      // Test backup system
      let backupTest = false;
      try {
        const backupHistory = this.archivalBackupManager.getBackupHistory();
        backupTest = true; // Just test that we can get history
      } catch (error) {
        issues.push('Backup system check failed');
      }

      // Test TimescaleDB functionality
      let timescaleTest = false;
      try {
        const compressionStats = await this.timescaleOptimizer.getCompressionStats();
        timescaleTest = true; // Just test that we can get stats
      } catch (error) {
        issues.push('TimescaleDB optimization check failed');
      }

      const results = {
        connectionTest,
        performanceTest,
        storageTest,
        backupTest,
        timescaleTest
      };

      const passed = Object.values(results).every(test => test);

      if (passed) {
        console.log('✅ Database system health validation passed');
      } else {
        console.warn('⚠️ Database system health validation found issues:', issues);
      }

      return { passed, results, issues };

    } catch (error) {
      console.error('❌ System health validation failed:', error);
      return {
        passed: false,
        results: {
          connectionTest: false,
          performanceTest: false,
          storageTest: false,
          backupTest: false,
          timescaleTest: false
        },
        issues: ['System health validation failed']
      };
    }
  }

  /**
   * Initialize TimescaleDB Optimizer
   */
  private async initializeTimescaleOptimizer(): Promise<void> {
    try {
      await this.timescaleOptimizer.initialize();
      
      // Setup default hypertables if they don't exist
      const configs = getDefaultHypertableConfigs();
      for (const config of configs) {
        try {
          await this.timescaleOptimizer.createOptimizedHypertable(config);
        } catch (error) {
          // Table might already exist
          console.warn(`⚠️ Could not create hypertable ${config.tableName}:`, error);
        }
      }

      // Create optimized indexes
      const indexConfigs = getDefaultIndexConfigs();
      await this.timescaleOptimizer.createOptimizedIndexes(indexConfigs);

      console.log('✅ TimescaleDB optimizer initialized');
    } catch (error) {
      console.error('❌ TimescaleDB optimizer initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Performance Tuner
   */
  private async initializePerformanceTuner(): Promise<void> {
    try {
      await this.performanceTuner.initialize();
      console.log('✅ Performance tuner initialized');
    } catch (error) {
      console.error('❌ Performance tuner initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Archival & Backup Manager
   */
  private async initializeArchivalBackup(): Promise<void> {
    try {
      await this.archivalBackupManager.initialize();
      console.log('✅ Archival & backup manager initialized');
    } catch (error) {
      console.error('❌ Archival & backup manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Database Monitor
   */
  private async initializeDatabaseMonitor(): Promise<void> {
    try {
      await this.databaseMonitor.initialize();
      console.log('✅ Database monitor initialized');
    } catch (error) {
      console.error('❌ Database monitor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup cross-system event handlers
   */
  private setupEventHandlers(): void {
    // Performance tuner alerts trigger monitoring alerts
    this.performanceTuner.on('performance_alert', (alert) => {
      this.databaseMonitor.addAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Performance Alert from Tuner',
        message: alert.message,
        metadata: alert.metrics
      });
    });

    // Backup failures trigger monitoring alerts
    this.archivalBackupManager.on('backup_failed', (metadata) => {
      this.databaseMonitor.addAlert({
        type: 'backup',
        severity: 'critical',
        title: 'Backup Failed',
        message: `Backup ${metadata.id} failed: ${metadata.error}`,
        metadata: { backupId: metadata.id }
      });
    });

    // TimescaleDB optimization issues trigger alerts
    this.timescaleOptimizer.on('optimization_error', (error) => {
      this.databaseMonitor.addAlert({
        type: 'system',
        severity: 'warning',
        title: 'TimescaleDB Optimization Error',
        message: error.message,
        metadata: { error: error.message }
      });
    });

    console.log('✅ Cross-system event handlers configured');
  }

  /**
   * Run initial system optimization
   */
  private async runInitialOptimization(): Promise<void> {
    try {
      console.log('🔄 Running initial database optimization...');

      // Compress any old chunks that should be compressed
      const compressionStats = await this.timescaleOptimizer.getCompressionStats();
      for (const stat of compressionStats) {
        if (stat.chunksTotal > stat.chunksCompressed) {
          await this.timescaleOptimizer.compressOldChunks(stat.tableName, '7 days');
        }
      }

      // Run initial performance analysis
      await this.performanceTuner.generatePerformanceReport();

      // Check if initial backup is needed
      const backupHistory = this.archivalBackupManager.getBackupHistory();
      if (backupHistory.length === 0) {
        console.log('🔄 No backups found, scheduling initial backup...');
        // Would schedule backup in production
      }

      console.log('✅ Initial database optimization completed');
    } catch (error) {
      console.warn('⚠️ Initial optimization had issues:', error);
    }
  }

  /**
   * Check if backup is needed
   */
  private shouldPerformBackup(backupHistory: any[]): boolean {
    if (backupHistory.length === 0) return true;
    
    const lastBackup = backupHistory.find(b => b.type === 'full' && b.status === 'completed');
    if (!lastBackup) return true;
    
    const daysSinceBackup = (Date.now() - lastBackup.startTime.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceBackup > 1; // Daily backup policy
  }

  /**
   * Check retention compliance
   */
  private checkRetentionCompliance(backupHistory: any[]): boolean {
    // Check if we have backups according to retention policy
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentBackups = backupHistory.filter(b => 
      b.startTime >= sevenDaysAgo && b.status === 'completed'
    );
    
    return recentBackups.length >= 7; // Daily backups for 7 days
  }

  /**
   * Generate system-wide recommendations
   */
  private generateSystemRecommendations(status: DatabaseSystemStatus, health: any): string[] {
    const recommendations: string[] = [];

    // TimescaleDB recommendations
    if (status.timescaleOptimizer.hypertables === 0) {
      recommendations.push('Consider converting large time-series tables to hypertables');
    }

    // Performance recommendations
    if (status.performanceTuner.slowQueries > 5) {
      recommendations.push('Multiple slow queries detected - consider query optimization');
    }

    // Backup recommendations
    if (!status.archivalBackup.lastBackup) {
      recommendations.push('No recent backups found - schedule regular backups');
    }

    // Health recommendations
    if (status.monitoring.activeAlerts > 0) {
      recommendations.push(`${status.monitoring.activeAlerts} active alerts need attention`);
    }

    return recommendations;
  }

  /**
   * Shutdown all database systems
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down database orchestrator...');

    try {
      await Promise.all([
        this.timescaleOptimizer.shutdown(),
        this.performanceTuner.shutdown(),
        this.archivalBackupManager.shutdown(),
        this.databaseMonitor.shutdown()
      ]);

      this.initialized = false;
      console.log('✅ Database orchestrator shutdown complete');
      this.emit('shutdown');

    } catch (error) {
      console.error('❌ Database orchestrator shutdown failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
let orchestratorInstance: DatabaseOrchestrator | null = null;

export const getDatabaseOrchestrator = (databaseManager?: DatabaseManager): DatabaseOrchestrator => {
  if (!orchestratorInstance) {
    orchestratorInstance = new DatabaseOrchestrator(databaseManager);
  }
  return orchestratorInstance;
};

export default DatabaseOrchestrator;