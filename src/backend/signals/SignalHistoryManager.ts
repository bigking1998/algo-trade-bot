/**
 * Signal History Manager - Task BE-014: Signal Generation System
 * 
 * Enterprise-grade signal history tracking system with:
 * - Persistent signal storage and retrieval
 * - Performance tracking and analytics
 * - History compression and archiving
 * - Advanced querying and filtering capabilities
 * - Signal lifecycle management
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type {
  SignalHistoryEntry,
  SignalProcessingStats,
  StrategySignal,
  StrategySignalType,
  StrategyContext
} from '../strategies/types.js';

/**
 * Signal History Configuration
 */
export interface SignalHistoryConfig {
  // Storage settings
  maxEntriesPerStrategy: number;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  
  // Compression settings
  enableCompression: boolean;
  compressionThreshold: number; // Number of entries before compression
  compressionRatio: number; // Target compression ratio
  
  // Performance settings
  batchSize: number;
  indexingEnabled: boolean;
  cacheSize: number;
  
  // Analytics settings
  enableAnalytics: boolean;
  analyticsInterval: number; // milliseconds
  performanceMetrics: boolean;
}

/**
 * Query options for signal history
 */
export interface SignalHistoryQuery {
  strategyId?: string;
  symbol?: string;
  type?: StrategySignalType;
  source?: 'technical' | 'fundamental' | 'ml' | 'hybrid';
  
  // Time range
  from?: Date;
  to?: Date;
  
  // Performance filters
  minConfidence?: number;
  maxConfidence?: number;
  outcomeFilter?: 'profit' | 'loss' | 'breakeven' | 'pending';
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'timestamp' | 'confidence' | 'pnl' | 'holdingPeriod';
  sortOrder?: 'asc' | 'desc';
  
  // Aggregation
  groupBy?: 'strategy' | 'symbol' | 'type' | 'hour' | 'day';
  includePerformanceMetrics?: boolean;
}

/**
 * Signal Performance Metrics
 */
export interface SignalPerformanceMetrics {
  strategyId: string;
  totalSignals: number;
  executedSignals: number;
  
  // Success metrics
  profitableSignals: number;
  winRate: number; // 0-1
  averageReturn: number; // percentage
  totalReturn: number;
  
  // Risk metrics
  maxDrawdown: number;
  averageRisk: number;
  riskAdjustedReturn: number;
  
  // Timing metrics
  averageHoldingPeriod: number; // milliseconds
  maxHoldingPeriod: number;
  minHoldingPeriod: number;
  
  // Confidence metrics
  averageConfidence: number;
  confidenceAccuracy: number; // How well confidence predicts success
  
  // By signal type
  byType: Record<StrategySignalType, {
    count: number;
    winRate: number;
    averageReturn: number;
  }>;
  
  // Time-based performance
  performanceOverTime: Array<{
    period: string;
    signals: number;
    winRate: number;
    totalReturn: number;
  }>;
  
  lastUpdated: Date;
}

/**
 * Signal History Index for fast queries
 */
interface SignalHistoryIndex {
  byStrategy: Map<string, string[]>; // strategyId -> signal IDs
  bySymbol: Map<string, string[]>; // symbol -> signal IDs
  byType: Map<StrategySignalType, string[]>; // type -> signal IDs
  byTimestamp: Array<{ timestamp: Date; id: string }>; // sorted by timestamp
  byConfidence: Array<{ confidence: number; id: string }>; // sorted by confidence
}

// =============================================================================
// SIGNAL HISTORY MANAGER IMPLEMENTATION
// =============================================================================

export class SignalHistoryManager extends EventEmitter {
  private readonly config: SignalHistoryConfig;
  
  // Storage
  private readonly signalHistory = new Map<string, SignalHistoryEntry>(); // id -> entry
  private readonly strategySignals = new Map<string, Set<string>>(); // strategyId -> signal IDs
  
  // Indexing
  private readonly index: SignalHistoryIndex;
  private indexNeedsUpdate = false;
  
  // Caching
  private readonly queryCache = new Map<string, {
    result: SignalHistoryEntry[];
    timestamp: Date;
    ttl: number;
  }>();
  
  // Performance tracking
  private readonly performanceMetrics = new Map<string, SignalPerformanceMetrics>();
  private lastAnalyticsUpdate = new Date();
  
  // Background processing
  private analyticsInterval?: NodeJS.Timeout;
  private compressionInterval?: NodeJS.Timeout;

  constructor(config: Partial<SignalHistoryConfig> = {}) {
    super();
    
    this.config = this.mergeDefaultConfig(config);
    this.index = {
      byStrategy: new Map(),
      bySymbol: new Map(),
      byType: new Map(),
      byTimestamp: [],
      byConfidence: []
    };
    
    this.startBackgroundProcessing();
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // CORE HISTORY MANAGEMENT
  // =============================================================================

  /**
   * Add signal to history
   */
  async addSignal(signal: StrategySignal, context: StrategyContext): Promise<string> {
    const entryId = `hist_${signal.id}_${Date.now()}`;
    
    const historyEntry: SignalHistoryEntry = {
      id: entryId,
      signal: { ...signal },
      generationContext: {
        strategyId: signal.strategyId,
        conditionsUsed: signal.conditions || [],
        marketConditions: context.marketConditions,
        indicators: signal.indicators || {}
      },
      lifecycle: {
        generated: new Date()
      },
      metadata: {
        addedAt: new Date(),
        version: '1.0'
      }
    };
    
    // Store entry
    this.signalHistory.set(entryId, historyEntry);
    
    // Update strategy mapping
    if (!this.strategySignals.has(signal.strategyId)) {
      this.strategySignals.set(signal.strategyId, new Set());
    }
    this.strategySignals.get(signal.strategyId)!.add(entryId);
    
    // Mark index for update
    this.indexNeedsUpdate = true;
    
    // Clean up if needed
    await this.cleanupOldEntries(signal.strategyId);
    
    this.emit('signalAdded', { entryId, signal, context });
    
    return entryId;
  }

  /**
   * Update signal lifecycle information
   */
  async updateSignalLifecycle(
    entryId: string,
    lifecycle: Partial<SignalHistoryEntry['lifecycle']>
  ): Promise<void> {
    const entry = this.signalHistory.get(entryId);
    if (!entry) {
      throw new Error(`Signal history entry not found: ${entryId}`);
    }
    
    Object.assign(entry.lifecycle, lifecycle);
    
    this.emit('signalLifecycleUpdated', { entryId, lifecycle });
  }

  /**
   * Update signal performance data
   */
  async updateSignalPerformance(
    entryId: string,
    performance: SignalHistoryEntry['performance']
  ): Promise<void> {
    const entry = this.signalHistory.get(entryId);
    if (!entry) {
      throw new Error(`Signal history entry not found: ${entryId}`);
    }
    
    entry.performance = { ...performance };
    
    // Trigger performance metrics recalculation
    this.invalidatePerformanceMetrics(entry.signal.strategyId);
    
    this.emit('signalPerformanceUpdated', { entryId, performance });
  }

  /**
   * Query signal history with advanced filtering
   */
  async queryHistory(query: SignalHistoryQuery): Promise<{
    entries: SignalHistoryEntry[];
    total: number;
    metrics?: SignalPerformanceMetrics;
  }> {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      return {
        entries: cached.result,
        total: cached.result.length,
        metrics: query.includePerformanceMetrics ? 
          await this.calculatePerformanceMetrics(cached.result, query.strategyId) : undefined
      };
    }
    
    // Update index if needed
    if (this.indexNeedsUpdate) {
      await this.updateIndex();
    }
    
    // Apply filters
    let filteredIds = this.applyFilters(query);
    
    // Apply sorting
    filteredIds = this.applySorting(filteredIds, query);
    
    // Apply pagination
    const total = filteredIds.length;
    const paginatedIds = this.applyPagination(filteredIds, query);
    
    // Get entries
    const entries = paginatedIds
      .map(id => this.signalHistory.get(id))
      .filter(entry => entry !== undefined) as SignalHistoryEntry[];
    
    // Cache result
    this.cacheQueryResult(cacheKey, entries);
    
    const queryTime = performance.now() - startTime;
    
    this.emit('historyQueried', {
      query,
      resultsCount: entries.length,
      totalCount: total,
      queryTime
    });
    
    return {
      entries,
      total,
      metrics: query.includePerformanceMetrics ? 
        await this.calculatePerformanceMetrics(entries, query.strategyId) : undefined
    };
  }

  /**
   * Get performance metrics for strategy
   */
  async getPerformanceMetrics(strategyId: string): Promise<SignalPerformanceMetrics> {
    // Check if we have cached metrics
    const cached = this.performanceMetrics.get(strategyId);
    if (cached && Date.now() - cached.lastUpdated.getTime() < this.config.analyticsInterval) {
      return cached;
    }
    
    // Get all signals for strategy
    const signalIds = this.strategySignals.get(strategyId);
    if (!signalIds) {
      return this.createEmptyMetrics(strategyId);
    }
    
    const entries = Array.from(signalIds)
      .map(id => this.signalHistory.get(id))
      .filter(entry => entry !== undefined) as SignalHistoryEntry[];
    
    const metrics = await this.calculatePerformanceMetrics(entries, strategyId);
    
    // Cache metrics
    this.performanceMetrics.set(strategyId, metrics);
    
    return metrics;
  }

  // =============================================================================
  // ADVANCED FILTERING AND INDEXING
  // =============================================================================

  /**
   * Apply query filters using indexes
   */
  private applyFilters(query: SignalHistoryQuery): string[] {
    let candidateIds: Set<string> | undefined;
    
    // Strategy filter (most selective usually)
    if (query.strategyId) {
      const strategyIds = this.strategySignals.get(query.strategyId);
      candidateIds = strategyIds ? new Set(strategyIds) : new Set();
    }
    
    // Symbol filter
    if (query.symbol) {
      const symbolIds = this.index.bySymbol.get(query.symbol);
      if (symbolIds) {
        const symbolSet = new Set(symbolIds);
        candidateIds = candidateIds ? 
          new Set([...candidateIds].filter(id => symbolSet.has(id))) :
          symbolSet;
      } else {
        return []; // No signals for this symbol
      }
    }
    
    // Type filter
    if (query.type) {
      const typeIds = this.index.byType.get(query.type);
      if (typeIds) {
        const typeSet = new Set(typeIds);
        candidateIds = candidateIds ?
          new Set([...candidateIds].filter(id => typeSet.has(id))) :
          typeSet;
      } else {
        return []; // No signals of this type
      }
    }
    
    // If no specific filters, start with all signals
    if (!candidateIds) {
      candidateIds = new Set(this.signalHistory.keys());
    }
    
    // Apply additional filters that require full entry examination
    const filteredIds: string[] = [];
    
    for (const id of candidateIds) {
      const entry = this.signalHistory.get(id);
      if (!entry) continue;
      
      // Time range filter
      if (query.from && entry.signal.timestamp < query.from) continue;
      if (query.to && entry.signal.timestamp > query.to) continue;
      
      // Confidence filter
      if (query.minConfidence !== undefined && entry.signal.confidence < query.minConfidence) continue;
      if (query.maxConfidence !== undefined && entry.signal.confidence > query.maxConfidence) continue;
      
      // Source filter
      if (query.source && entry.signal.source !== query.source) continue;
      
      // Outcome filter
      if (query.outcomeFilter && entry.performance) {
        if (query.outcomeFilter !== entry.performance.outcome) continue;
      } else if (query.outcomeFilter && query.outcomeFilter !== 'pending') {
        continue; // No performance data but filtering for specific outcome
      }
      
      filteredIds.push(id);
    }
    
    return filteredIds;
  }

  /**
   * Apply sorting to filtered results
   */
  private applySorting(ids: string[], query: SignalHistoryQuery): string[] {
    if (!query.sortBy) {
      return ids;
    }
    
    const sortOrder = query.sortOrder || 'desc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    
    return ids.sort((aId, bId) => {
      const aEntry = this.signalHistory.get(aId);
      const bEntry = this.signalHistory.get(bId);
      
      if (!aEntry || !bEntry) return 0;
      
      let aValue: number, bValue: number;
      
      switch (query.sortBy) {
        case 'timestamp':
          aValue = aEntry.signal.timestamp.getTime();
          bValue = bEntry.signal.timestamp.getTime();
          break;
          
        case 'confidence':
          aValue = aEntry.signal.confidence;
          bValue = bEntry.signal.confidence;
          break;
          
        case 'pnl':
          aValue = aEntry.performance?.pnlPercent || 0;
          bValue = bEntry.performance?.pnlPercent || 0;
          break;
          
        case 'holdingPeriod':
          aValue = aEntry.performance?.holdingPeriod || 0;
          bValue = bEntry.performance?.holdingPeriod || 0;
          break;
          
        default:
          return 0;
      }
      
      return (aValue - bValue) * multiplier;
    });
  }

  /**
   * Apply pagination
   */
  private applyPagination(ids: string[], query: SignalHistoryQuery): string[] {
    const offset = query.offset || 0;
    const limit = query.limit || ids.length;
    
    return ids.slice(offset, offset + limit);
  }

  /**
   * Update search indexes
   */
  private async updateIndex(): Promise<void> {
    const startTime = performance.now();
    
    // Clear existing indexes
    this.index.byStrategy.clear();
    this.index.bySymbol.clear();
    this.index.byType.clear();
    this.index.byTimestamp = [];
    this.index.byConfidence = [];
    
    // Rebuild indexes
    for (const [id, entry] of this.signalHistory) {
      const { signal } = entry;
      
      // Strategy index
      if (!this.index.byStrategy.has(signal.strategyId)) {
        this.index.byStrategy.set(signal.strategyId, []);
      }
      this.index.byStrategy.get(signal.strategyId)!.push(id);
      
      // Symbol index
      if (!this.index.bySymbol.has(signal.symbol)) {
        this.index.bySymbol.set(signal.symbol, []);
      }
      this.index.bySymbol.get(signal.symbol)!.push(id);
      
      // Type index
      if (!this.index.byType.has(signal.type)) {
        this.index.byType.set(signal.type, []);
      }
      this.index.byType.get(signal.type)!.push(id);
      
      // Timestamp index
      this.index.byTimestamp.push({
        timestamp: signal.timestamp,
        id
      });
      
      // Confidence index
      this.index.byConfidence.push({
        confidence: signal.confidence,
        id
      });
    }
    
    // Sort time-based indexes
    this.index.byTimestamp.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    this.index.byConfidence.sort((a, b) => b.confidence - a.confidence);
    
    this.indexNeedsUpdate = false;
    
    const indexTime = performance.now() - startTime;
    this.emit('indexUpdated', { indexTime, entryCount: this.signalHistory.size });
  }

  // =============================================================================
  // PERFORMANCE ANALYTICS
  // =============================================================================

  /**
   * Calculate comprehensive performance metrics
   */
  private async calculatePerformanceMetrics(
    entries: SignalHistoryEntry[],
    strategyId?: string
  ): Promise<SignalPerformanceMetrics> {
    if (entries.length === 0) {
      return this.createEmptyMetrics(strategyId || 'unknown');
    }
    
    // Filter entries with performance data
    const executedEntries = entries.filter(entry => entry.performance?.executed);
    const profitableEntries = executedEntries.filter(entry => 
      entry.performance?.outcome === 'profit'
    );
    
    // Calculate basic metrics
    const totalSignals = entries.length;
    const executedSignals = executedEntries.length;
    const profitableSignals = profitableEntries.length;
    const winRate = executedSignals > 0 ? profitableSignals / executedSignals : 0;
    
    // Calculate returns
    const returns = executedEntries.map(entry => entry.performance?.pnlPercent || 0);
    const totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
    const averageReturn = returns.length > 0 ? totalReturn / returns.length : 0;
    
    // Calculate risk metrics
    const maxDrawdown = this.calculateMaxDrawdown(returns);
    const averageRisk = entries.reduce((sum, entry) => sum + (entry.signal.maxRisk || 0), 0) / totalSignals;
    const riskAdjustedReturn = averageRisk > 0 ? averageReturn / averageRisk : 0;
    
    // Calculate timing metrics
    const holdingPeriods = executedEntries
      .map(entry => entry.performance?.holdingPeriod || 0)
      .filter(period => period > 0);
    
    const averageHoldingPeriod = holdingPeriods.length > 0 ?
      holdingPeriods.reduce((sum, period) => sum + period, 0) / holdingPeriods.length : 0;
    
    // Calculate confidence metrics
    const confidences = entries.map(entry => entry.signal.confidence);
    const averageConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    // Calculate confidence accuracy (how well confidence predicts success)
    const confidenceAccuracy = this.calculateConfidenceAccuracy(executedEntries);
    
    // Group by signal type
    const byType: Record<StrategySignalType, any> = {} as any;
    const typeGroups = this.groupEntriesByType(executedEntries);
    
    for (const [type, typeEntries] of typeGroups) {
      const typeProfitable = typeEntries.filter(entry => 
        entry.performance?.outcome === 'profit'
      ).length;
      
      const typeReturns = typeEntries.map(entry => entry.performance?.pnlPercent || 0);
      const typeAverageReturn = typeReturns.length > 0 ?
        typeReturns.reduce((sum, ret) => sum + ret, 0) / typeReturns.length : 0;
      
      byType[type] = {
        count: typeEntries.length,
        winRate: typeEntries.length > 0 ? typeProfitable / typeEntries.length : 0,
        averageReturn: typeAverageReturn
      };
    }
    
    // Performance over time (simplified - daily aggregation)
    const performanceOverTime = this.calculatePerformanceOverTime(executedEntries);
    
    return {
      strategyId: strategyId || 'unknown',
      totalSignals,
      executedSignals,
      profitableSignals,
      winRate,
      averageReturn,
      totalReturn,
      maxDrawdown,
      averageRisk,
      riskAdjustedReturn,
      averageHoldingPeriod,
      maxHoldingPeriod: Math.max(...holdingPeriods, 0),
      minHoldingPeriod: holdingPeriods.length > 0 ? Math.min(...holdingPeriods) : 0,
      averageConfidence,
      confidenceAccuracy,
      byType,
      performanceOverTime,
      lastUpdated: new Date()
    };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private mergeDefaultConfig(config: Partial<SignalHistoryConfig>): SignalHistoryConfig {
    return {
      maxEntriesPerStrategy: config.maxEntriesPerStrategy || 10000,
      retentionPeriodDays: config.retentionPeriodDays || 365,
      archiveAfterDays: config.archiveAfterDays || 90,
      enableCompression: config.enableCompression ?? true,
      compressionThreshold: config.compressionThreshold || 1000,
      compressionRatio: config.compressionRatio || 0.8,
      batchSize: config.batchSize || 100,
      indexingEnabled: config.indexingEnabled ?? true,
      cacheSize: config.cacheSize || 1000,
      enableAnalytics: config.enableAnalytics ?? true,
      analyticsInterval: config.analyticsInterval || 300000, // 5 minutes
      performanceMetrics: config.performanceMetrics ?? true
    };
  }

  private async cleanupOldEntries(strategyId: string): Promise<void> {
    const strategyEntryIds = this.strategySignals.get(strategyId);
    if (!strategyEntryIds) return;
    
    // Check if we exceed max entries
    if (strategyEntryIds.size <= this.config.maxEntriesPerStrategy) return;
    
    // Get all entries for this strategy
    const entries = Array.from(strategyEntryIds)
      .map(id => ({ id, entry: this.signalHistory.get(id) }))
      .filter(item => item.entry !== undefined)
      .sort((a, b) => a.entry!.signal.timestamp.getTime() - b.entry!.signal.timestamp.getTime());
    
    // Remove oldest entries
    const toRemove = entries.slice(0, entries.length - this.config.maxEntriesPerStrategy);
    
    for (const { id } of toRemove) {
      this.signalHistory.delete(id);
      strategyEntryIds.delete(id);
    }
    
    this.indexNeedsUpdate = true;
    
    if (toRemove.length > 0) {
      this.emit('entriesCleanedUp', { 
        strategyId, 
        removedCount: toRemove.length,
        remainingCount: strategyEntryIds.size
      });
    }
  }

  private generateCacheKey(query: SignalHistoryQuery): string {
    return JSON.stringify(query);
  }

  private cacheQueryResult(key: string, result: SignalHistoryEntry[]): void {
    // Simple TTL cache
    this.queryCache.set(key, {
      result: [...result],
      timestamp: new Date(),
      ttl: 60000 // 1 minute
    });
    
    // Clean cache if too large
    if (this.queryCache.size > this.config.cacheSize) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  private invalidatePerformanceMetrics(strategyId: string): void {
    this.performanceMetrics.delete(strategyId);
  }

  private createEmptyMetrics(strategyId: string): SignalPerformanceMetrics {
    return {
      strategyId,
      totalSignals: 0,
      executedSignals: 0,
      profitableSignals: 0,
      winRate: 0,
      averageReturn: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      averageRisk: 0,
      riskAdjustedReturn: 0,
      averageHoldingPeriod: 0,
      maxHoldingPeriod: 0,
      minHoldingPeriod: 0,
      averageConfidence: 0,
      confidenceAccuracy: 0,
      byType: {} as any,
      performanceOverTime: [],
      lastUpdated: new Date()
    };
  }

  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    
    for (const ret of returns) {
      cumulative += ret;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / Math.max(peak, 0.01);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateConfidenceAccuracy(entries: SignalHistoryEntry[]): number {
    if (entries.length === 0) return 0;
    
    let accuracySum = 0;
    let validEntries = 0;
    
    for (const entry of entries) {
      if (!entry.performance) continue;
      
      const confidence = entry.signal.confidence / 100; // Convert to 0-1
      const wasSuccessful = entry.performance.outcome === 'profit' ? 1 : 0;
      
      // Calculate accuracy as inverse of absolute difference
      const accuracy = 1 - Math.abs(confidence - wasSuccessful);
      accuracySum += accuracy;
      validEntries++;
    }
    
    return validEntries > 0 ? accuracySum / validEntries : 0;
  }

  private groupEntriesByType(entries: SignalHistoryEntry[]): Map<StrategySignalType, SignalHistoryEntry[]> {
    const groups = new Map<StrategySignalType, SignalHistoryEntry[]>();
    
    for (const entry of entries) {
      if (!groups.has(entry.signal.type)) {
        groups.set(entry.signal.type, []);
      }
      groups.get(entry.signal.type)!.push(entry);
    }
    
    return groups;
  }

  private calculatePerformanceOverTime(entries: SignalHistoryEntry[]): Array<{
    period: string;
    signals: number;
    winRate: number;
    totalReturn: number;
  }> {
    // Group by day for simplicity
    const dailyGroups = new Map<string, SignalHistoryEntry[]>();
    
    for (const entry of entries) {
      const day = entry.signal.timestamp.toISOString().split('T')[0];
      if (!dailyGroups.has(day)) {
        dailyGroups.set(day, []);
      }
      dailyGroups.get(day)!.push(entry);
    }
    
    const performanceOverTime: Array<{
      period: string;
      signals: number;
      winRate: number;
      totalReturn: number;
    }> = [];
    
    for (const [day, dayEntries] of dailyGroups) {
      const profitable = dayEntries.filter(entry => 
        entry.performance?.outcome === 'profit'
      ).length;
      
      const totalReturn = dayEntries.reduce((sum, entry) => 
        sum + (entry.performance?.pnlPercent || 0), 0
      );
      
      performanceOverTime.push({
        period: day,
        signals: dayEntries.length,
        winRate: dayEntries.length > 0 ? profitable / dayEntries.length : 0,
        totalReturn
      });
    }
    
    return performanceOverTime.sort((a, b) => a.period.localeCompare(b.period));
  }

  private startBackgroundProcessing(): void {
    if (this.config.enableAnalytics) {
      this.analyticsInterval = setInterval(async () => {
        // Update performance metrics for all strategies
        for (const strategyId of this.strategySignals.keys()) {
          try {
            await this.getPerformanceMetrics(strategyId);
          } catch (error) {
            this.emit('analyticsError', { strategyId, error });
          }
        }
        
        this.lastAnalyticsUpdate = new Date();
        this.emit('analyticsUpdated', { timestamp: this.lastAnalyticsUpdate });
      }, this.config.analyticsInterval);
    }
    
    if (this.config.enableCompression) {
      this.compressionInterval = setInterval(async () => {
        // Compression logic would be implemented here
        // For now, just emit event
        this.emit('compressionRun', { timestamp: new Date() });
      }, this.config.analyticsInterval * 2);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    
    if (this.compressionInterval) {
      clearInterval(this.compressionInterval);
    }
    
    this.queryCache.clear();
    this.performanceMetrics.clear();
    
    this.emit('cleanup');
  }
}

export default SignalHistoryManager;