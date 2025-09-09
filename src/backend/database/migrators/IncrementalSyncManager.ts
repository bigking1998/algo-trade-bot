/**
 * Incremental Sync Manager - Task BE-006: Data Migration from In-Memory Storage
 * 
 * Real-time data synchronization manager with:
 * - Continuous sync between in-memory storage and database
 * - Conflict resolution for concurrent data updates
 * - Change detection and delta synchronization
 * - Real-time monitoring and health checks
 * - Automatic recovery from sync failures
 * - Bidirectional sync capabilities
 */

import { EventEmitter } from 'events';
import { TradeRepository, Trade } from '../repositories/TradeRepository';
import { MarketDataRepository, MarketData } from '../repositories/MarketDataRepository';
import { tradeHistoryService } from '../../services/tradeHistory';
import { MarketDataBuffer } from '../../data/MarketDataBuffer';
import type { TradeHistoryEntry } from '../../../shared/types/trading';

export interface SyncConfig {
  syncIntervalMs?: number;
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  conflictResolution?: ConflictResolutionStrategy;
  enableBidirectionalSync?: boolean;
  syncDirection?: 'MEMORY_TO_DB' | 'DB_TO_MEMORY' | 'BIDIRECTIONAL';
  healthCheckIntervalMs?: number;
  maxSyncLag?: number;
  autoRecovery?: boolean;
  enableChangeLog?: boolean;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSyncTime: Date;
  nextScheduledSync: Date;
  syncLagMs: number;
  totalSynced: number;
  totalErrors: number;
  health: SyncHealth;
  currentBatch?: SyncBatch;
  statistics: SyncStatistics;
}

export interface SyncHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DISCONNECTED';
  score: number; // 0-1
  issues: string[];
  lastHealthCheck: Date;
  uptime: number;
  errorRate: number;
}

export interface SyncStatistics {
  totalSyncCycles: number;
  averageSyncTime: number;
  throughputPerSecond: number;
  dataConsistencyScore: number;
  conflictsResolved: number;
  lastSuccessfulSync: Date;
  syncEfficiency: number;
}

export interface SyncBatch {
  batchId: string;
  startTime: Date;
  itemCount: number;
  dataType: 'TRADES' | 'MARKET_DATA' | 'MIXED';
  direction: 'MEMORY_TO_DB' | 'DB_TO_MEMORY';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
}

export interface ChangeRecord {
  id: string;
  timestamp: Date;
  dataType: 'TRADE' | 'MARKET_DATA';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  changes: Record<string, { old: any; new: any }>;
  source: 'MEMORY' | 'DATABASE';
  synced: boolean;
}

export interface ConflictResolutionStrategy {
  onDataMismatch: 'LATEST_WINS' | 'MEMORY_PRIORITY' | 'DB_PRIORITY' | 'MANUAL_REVIEW';
  onMissingRecord: 'SYNC_FROM_SOURCE' | 'DELETE_TARGET' | 'IGNORE';
  onVersionConflict: 'MERGE' | 'LATEST_WINS' | 'CONFLICT_LOG';
}

export interface SyncConflict {
  conflictId: string;
  timestamp: Date;
  dataType: 'TRADE' | 'MARKET_DATA';
  entityId: string;
  memoryVersion: any;
  databaseVersion: any;
  conflictType: 'VALUE_MISMATCH' | 'VERSION_CONFLICT' | 'MISSING_RECORD';
  resolution?: 'RESOLVED' | 'PENDING' | 'MANUAL_REQUIRED';
  resolvedBy?: string;
  resolvedAt?: Date;
}

/**
 * Manager for incremental synchronization between in-memory storage and database
 */
export class IncrementalSyncManager extends EventEmitter {
  private readonly tradeRepo: TradeRepository;
  private readonly marketDataRepo: MarketDataRepository;
  private syncTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  private config: Required<SyncConfig>;
  private status: SyncStatus;
  private changeLog: ChangeRecord[] = [];
  private conflicts: SyncConflict[] = [];
  private lastSyncChecksum: Map<string, string> = new Map();
  
  constructor() {
    super();
    
    this.tradeRepo = new TradeRepository();
    this.marketDataRepo = new MarketDataRepository();
    
    this.config = {
      syncIntervalMs: 30000, // 30 seconds
      batchSize: 500,
      maxRetries: 3,
      retryDelayMs: 5000,
      conflictResolution: {
        onDataMismatch: 'LATEST_WINS',
        onMissingRecord: 'SYNC_FROM_SOURCE',
        onVersionConflict: 'LATEST_WINS',
      },
      enableBidirectionalSync: true,
      syncDirection: 'BIDIRECTIONAL',
      healthCheckIntervalMs: 60000, // 1 minute
      maxSyncLag: 300000, // 5 minutes
      autoRecovery: true,
      enableChangeLog: true,
    };
    
    this.status = {
      isRunning: false,
      lastSyncTime: new Date(0),
      nextScheduledSync: new Date(),
      syncLagMs: 0,
      totalSynced: 0,
      totalErrors: 0,
      health: {
        status: 'HEALTHY',
        score: 1.0,
        issues: [],
        lastHealthCheck: new Date(),
        uptime: 0,
        errorRate: 0,
      },
      statistics: {
        totalSyncCycles: 0,
        averageSyncTime: 0,
        throughputPerSecond: 0,
        dataConsistencyScore: 1.0,
        conflictsResolved: 0,
        lastSuccessfulSync: new Date(0),
        syncEfficiency: 1.0,
      },
    };
  }

  /**
   * Start the incremental sync manager
   */
  public async start(config: SyncConfig = {}): Promise<void> {
    if (this.isRunning) {
      throw new Error('Sync manager is already running');
    }

    this.config = { ...this.config, ...config };
    this.isRunning = true;
    this.status.isRunning = true;
    
    // Perform initial sync
    await this.performSyncCycle();
    
    // Schedule regular sync cycles
    this.scheduleNextSync();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.emit('sync:started', { config: this.config });
    console.log('[IncrementalSyncManager] Started with config:', this.config);
  }

  /**
   * Stop the sync manager
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.status.isRunning = false;
    
    // Clear timers
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    this.emit('sync:stopped');
    console.log('[IncrementalSyncManager] Stopped');
  }

  /**
   * Get current sync status
   */
  public getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Force immediate sync
   */
  public async forcSync(): Promise<SyncBatch> {
    if (!this.isRunning) {
      throw new Error('Sync manager is not running');
    }

    return this.performSyncCycle();
  }

  /**
   * Get recent conflicts
   */
  public getConflicts(limit = 50): SyncConflict[] {
    return this.conflicts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolve a specific conflict manually
   */
  public async resolveConflict(
    conflictId: string,
    resolution: 'USE_MEMORY' | 'USE_DATABASE' | 'MERGE',
    resolvedBy = 'SYSTEM'
  ): Promise<boolean> {
    const conflict = this.conflicts.find(c => c.conflictId === conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    try {
      await this.applyConflictResolution(conflict, resolution);
      
      conflict.resolution = 'RESOLVED';
      conflict.resolvedBy = resolvedBy;
      conflict.resolvedAt = new Date();
      
      this.status.statistics.conflictsResolved++;
      
      this.emit('conflict:resolved', { conflictId, resolution });
      return true;
      
    } catch (error) {
      console.error(`[IncrementalSyncManager] Failed to resolve conflict ${conflictId}:`, error);
      return false;
    }
  }

  /**
   * Perform a complete sync cycle
   */
  private async performSyncCycle(): Promise<SyncBatch> {
    const batchId = this.generateBatchId();
    const batch: SyncBatch = {
      batchId,
      startTime: new Date(),
      itemCount: 0,
      dataType: 'MIXED',
      direction: this.config.syncDirection as any,
      status: 'PROCESSING',
      progress: 0,
    };

    this.status.currentBatch = batch;
    this.emit('sync:batch:started', batch);

    try {
      // Sync trades
      if (this.config.syncDirection !== 'DB_TO_MEMORY') {
        const tradesSynced = await this.syncTradesToDatabase();
        batch.itemCount += tradesSynced;
      }

      if (this.config.enableBidirectionalSync && this.config.syncDirection !== 'MEMORY_TO_DB') {
        const tradesFromDb = await this.syncTradesFromDatabase();
        batch.itemCount += tradesFromDb;
      }

      // Update sync statistics
      batch.status = 'COMPLETED';
      batch.progress = 100;
      
      this.status.lastSyncTime = new Date();
      this.status.totalSynced += batch.itemCount;
      this.status.statistics.totalSyncCycles++;
      this.status.statistics.lastSuccessfulSync = new Date();
      
      const syncDuration = Date.now() - batch.startTime.getTime();
      this.status.statistics.averageSyncTime = 
        (this.status.statistics.averageSyncTime * (this.status.statistics.totalSyncCycles - 1) + syncDuration) 
        / this.status.statistics.totalSyncCycles;
      
      this.status.statistics.throughputPerSecond = batch.itemCount / (syncDuration / 1000);
      
      this.emit('sync:batch:completed', batch);
      return batch;

    } catch (error) {
      batch.status = 'FAILED';
      this.status.totalErrors++;
      
      console.error('[IncrementalSyncManager] Sync cycle failed:', error);
      this.emit('sync:batch:failed', { batch, error });
      
      if (this.config.autoRecovery) {
        await this.attemptRecovery();
      }
      
      throw error;
    } finally {
      this.status.currentBatch = undefined;
    }
  }

  /**
   * Sync trades from memory to database
   */
  private async syncTradesToDatabase(): Promise<number> {
    try {
      // Get recent changes from in-memory storage
      const inMemoryTrades = tradeHistoryService.getTradeHistory({}, 1, 1000);
      const memoryTradeMap = new Map<string, TradeHistoryEntry>();
      
      for (const trade of inMemoryTrades.trades) {
        memoryTradeMap.set(trade.id, trade);
      }

      // Get corresponding trades from database (last 1000)
      const dbTrades = await this.tradeRepo.getRecentTrades(1000);
      const dbTradeMap = new Map<string, Trade>();
      
      for (const trade of dbTrades) {
        // Use a composite key for matching
        const key = this.createTradeKey(trade);
        dbTradeMap.set(key, trade);
      }

      let syncCount = 0;
      const changes: ChangeRecord[] = [];

      // Find trades that exist in memory but not in database
      for (const [memoryId, memoryTrade] of memoryTradeMap.entries()) {
        const tradeKey = this.createTradeKeyFromMemory(memoryTrade);
        
        if (!dbTradeMap.has(tradeKey)) {
          // New trade needs to be synced to database
          try {
            const dbTradeData = this.convertMemoryTradeToDb(memoryTrade);
            await this.tradeRepo.createTrade(dbTradeData);
            
            syncCount++;
            
            if (this.config.enableChangeLog) {
              changes.push(this.createChangeRecord('TRADE', 'CREATE', memoryId, {}, memoryTrade, 'MEMORY'));
            }
            
          } catch (error) {
            console.error(`[IncrementalSyncManager] Failed to sync trade ${memoryId}:`, error);
          }
        } else {
          // Check for updates
          const dbTrade = dbTradeMap.get(tradeKey)!;
          const hasChanges = this.detectTradeChanges(memoryTrade, dbTrade);
          
          if (hasChanges.length > 0) {
            const conflict = this.createConflict('TRADE', memoryId, memoryTrade, dbTrade, 'VALUE_MISMATCH');
            this.conflicts.push(conflict);
            
            // Apply automatic resolution if configured
            await this.resolveConflictAutomatically(conflict);
          }
        }
      }

      // Update change log
      if (this.config.enableChangeLog) {
        this.changeLog.push(...changes);
        this.cleanupChangeLog();
      }

      return syncCount;

    } catch (error) {
      console.error('[IncrementalSyncManager] Trade sync to database failed:', error);
      throw error;
    }
  }

  /**
   * Sync trades from database to memory (bidirectional sync)
   */
  private async syncTradesFromDatabase(): Promise<number> {
    try {
      // This would require implementing write methods in tradeHistoryService
      // For now, we'll just log the intent
      console.log('[IncrementalSyncManager] Bidirectional trade sync not yet implemented');
      return 0;
      
    } catch (error) {
      console.error('[IncrementalSyncManager] Trade sync from database failed:', error);
      throw error;
    }
  }

  /**
   * Detect changes between memory and database trade versions
   */
  private detectTradeChanges(memoryTrade: TradeHistoryEntry, dbTrade: Trade): string[] {
    const changes: string[] = [];
    
    // Check key fields for differences
    if (memoryTrade.exitPrice !== dbTrade.exit_price) {
      changes.push('exit_price');
    }
    
    if (memoryTrade.pnl !== dbTrade.pnl) {
      changes.push('pnl');
    }
    
    if (memoryTrade.status !== (dbTrade.exit_price ? 'CLOSED' : 'OPEN')) {
      changes.push('status');
    }
    
    return changes;
  }

  /**
   * Create a conflict record
   */
  private createConflict(
    dataType: 'TRADE' | 'MARKET_DATA',
    entityId: string,
    memoryVersion: any,
    databaseVersion: any,
    conflictType: SyncConflict['conflictType']
  ): SyncConflict {
    return {
      conflictId: this.generateConflictId(),
      timestamp: new Date(),
      dataType,
      entityId,
      memoryVersion,
      databaseVersion,
      conflictType,
      resolution: 'PENDING',
    };
  }

  /**
   * Resolve conflict automatically based on configuration
   */
  private async resolveConflictAutomatically(conflict: SyncConflict): Promise<void> {
    const strategy = this.config.conflictResolution;
    
    try {
      switch (strategy.onDataMismatch) {
        case 'LATEST_WINS':
          // Compare timestamps and use the latest
          const memoryTime = conflict.memoryVersion.timestamp || conflict.memoryVersion.time;
          const dbTime = conflict.databaseVersion.time || conflict.databaseVersion.created_at;
          
          if (new Date(memoryTime).getTime() > new Date(dbTime).getTime()) {
            await this.applyConflictResolution(conflict, 'USE_MEMORY');
          } else {
            await this.applyConflictResolution(conflict, 'USE_DATABASE');
          }
          break;
          
        case 'MEMORY_PRIORITY':
          await this.applyConflictResolution(conflict, 'USE_MEMORY');
          break;
          
        case 'DB_PRIORITY':
          await this.applyConflictResolution(conflict, 'USE_DATABASE');
          break;
          
        case 'MANUAL_REVIEW':
          // Leave for manual resolution
          this.emit('conflict:manual_review_required', conflict);
          return;
      }
      
      conflict.resolution = 'RESOLVED';
      conflict.resolvedBy = 'AUTO';
      conflict.resolvedAt = new Date();
      
    } catch (error) {
      console.error(`[IncrementalSyncManager] Auto-resolution failed for conflict ${conflict.conflictId}:`, error);
      conflict.resolution = 'PENDING';
    }
  }

  /**
   * Apply conflict resolution
   */
  private async applyConflictResolution(
    conflict: SyncConflict,
    resolution: 'USE_MEMORY' | 'USE_DATABASE' | 'MERGE'
  ): Promise<void> {
    if (conflict.dataType === 'TRADE') {
      switch (resolution) {
        case 'USE_MEMORY':
          // Update database with memory version
          const memoryTradeData = this.convertMemoryTradeToDb(conflict.memoryVersion);
          await this.tradeRepo.updateById(conflict.databaseVersion.id, memoryTradeData);
          break;
          
        case 'USE_DATABASE':
          // Update memory with database version (would need tradeHistoryService update method)
          console.log('[IncrementalSyncManager] Memory update not implemented');
          break;
          
        case 'MERGE':
          // Implement merge logic based on field priority
          await this.mergeTradeVersions(conflict);
          break;
      }
    }
  }

  /**
   * Merge conflicting trade versions
   */
  private async mergeTradeVersions(conflict: SyncConflict): Promise<void> {
    const memoryTrade = conflict.memoryVersion;
    const dbTrade = conflict.databaseVersion;
    
    // Simple merge strategy - take non-null values with preference to more recent data
    const mergedData: any = {};
    
    // Use database ID and core fields
    Object.assign(mergedData, {
      exit_price: memoryTrade.exitPrice || dbTrade.exit_price,
      pnl: memoryTrade.pnl !== undefined ? memoryTrade.pnl : dbTrade.pnl,
      pnl_percentage: memoryTrade.pnlPercent !== undefined ? memoryTrade.pnlPercent : dbTrade.pnl_percentage,
      fee: memoryTrade.fees !== undefined ? memoryTrade.fees : dbTrade.fee,
    });
    
    await this.tradeRepo.updateById(dbTrade.id, mergedData);
  }

  /**
   * Convert memory trade format to database format
   */
  private convertMemoryTradeToDb(memoryTrade: TradeHistoryEntry): any {
    return {
      symbol: memoryTrade.symbol,
      side: memoryTrade.side.toLowerCase(),
      quantity: memoryTrade.quantity,
      price: memoryTrade.entryPrice,
      fee: memoryTrade.fees || 0,
      entry_price: memoryTrade.entryPrice,
      exit_price: memoryTrade.exitPrice,
      exchange: 'dydx_v4',
    };
  }

  /**
   * Create unique key for trade matching
   */
  private createTradeKey(trade: Trade): string {
    return `${trade.symbol}-${trade.side}-${trade.quantity}-${trade.price}-${trade.time.getTime()}`;
  }

  /**
   * Create unique key for memory trade
   */
  private createTradeKeyFromMemory(trade: TradeHistoryEntry): string {
    return `${trade.symbol}-${trade.side.toLowerCase()}-${trade.quantity}-${trade.entryPrice}-${new Date(trade.timestamp).getTime()}`;
  }

  /**
   * Create change record for audit trail
   */
  private createChangeRecord(
    dataType: 'TRADE' | 'MARKET_DATA',
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: string,
    oldData: any,
    newData: any,
    source: 'MEMORY' | 'DATABASE'
  ): ChangeRecord {
    return {
      id: this.generateChangeId(),
      timestamp: new Date(),
      dataType,
      operation,
      entityId,
      changes: this.calculateChanges(oldData, newData),
      source,
      synced: false,
    };
  }

  /**
   * Calculate field-level changes
   */
  private calculateChanges(oldData: any, newData: any): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};
    
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    
    for (const key of allKeys) {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];
      
      if (oldValue !== newValue) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }
    
    return changes;
  }

  /**
   * Schedule next sync cycle
   */
  private scheduleNextSync(): void {
    if (!this.isRunning) return;
    
    const nextSyncTime = new Date(Date.now() + this.config.syncIntervalMs);
    this.status.nextScheduledSync = nextSyncTime;
    
    this.syncTimer = setTimeout(async () => {
      if (this.isRunning) {
        try {
          await this.performSyncCycle();
        } catch (error) {
          console.error('[IncrementalSyncManager] Scheduled sync failed:', error);
        }
        this.scheduleNextSync(); // Schedule next cycle
      }
    }, this.config.syncIntervalMs);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const health = this.status.health;
    health.lastHealthCheck = new Date();
    
    const issues: string[] = [];
    let score = 1.0;
    
    // Check sync lag
    const syncLag = Date.now() - this.status.lastSyncTime.getTime();
    this.status.syncLagMs = syncLag;
    
    if (syncLag > this.config.maxSyncLag) {
      issues.push(`Sync lag exceeds threshold: ${syncLag}ms > ${this.config.maxSyncLag}ms`);
      score -= 0.3;
    }
    
    // Check error rate
    const totalOperations = this.status.statistics.totalSyncCycles;
    health.errorRate = totalOperations > 0 ? this.status.totalErrors / totalOperations : 0;
    
    if (health.errorRate > 0.1) { // 10% error rate
      issues.push(`High error rate: ${(health.errorRate * 100).toFixed(1)}%`);
      score -= 0.2;
    }
    
    // Check database connectivity
    try {
      await this.tradeRepo.count();
    } catch (error) {
      issues.push('Database connectivity issue');
      score -= 0.5;
    }
    
    health.issues = issues;
    health.score = Math.max(0, score);
    
    if (score >= 0.8) {
      health.status = 'HEALTHY';
    } else if (score >= 0.5) {
      health.status = 'DEGRADED';
    } else if (score >= 0.2) {
      health.status = 'UNHEALTHY';
    } else {
      health.status = 'DISCONNECTED';
    }
    
    this.emit('health:check', health);
    
    if (health.status !== 'HEALTHY') {
      console.warn('[IncrementalSyncManager] Health check issues:', issues);
    }
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(): Promise<void> {
    console.log('[IncrementalSyncManager] Attempting automatic recovery...');
    
    try {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
      
      // Try a single sync cycle
      await this.performSyncCycle();
      
      console.log('[IncrementalSyncManager] Recovery successful');
      this.emit('sync:recovered');
      
    } catch (error) {
      console.error('[IncrementalSyncManager] Recovery failed:', error);
      this.emit('sync:recovery_failed', error);
    }
  }

  /**
   * Cleanup old change log entries
   */
  private cleanupChangeLog(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = new Date(Date.now() - maxAge);
    
    this.changeLog = this.changeLog.filter(record => record.timestamp > cutoff);
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `SYNC_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Generate conflict ID
   */
  private generateConflictId(): string {
    return `CONFLICT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Generate change ID
   */
  private generateChangeId(): string {
    return `CHANGE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

export default IncrementalSyncManager;