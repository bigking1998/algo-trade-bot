/**
 * Signal Processor - Task BE-016
 * 
 * Advanced signal processing system that handles real-time signal generation,
 * validation, conflict resolution, and aggregation from multiple strategies.
 * 
 * Features:
 * - Real-time signal processing with configurable windows
 * - Multi-strategy signal conflict resolution algorithms
 * - Signal quality scoring and validation
 * - Signal aggregation and prioritization
 * - Temporal signal alignment and synchronization
 * - Performance optimization for high-frequency processing
 */

import { EventEmitter } from 'events';
import type {
  StrategySignal,
  StrategySignalType,
  MarketDataWindow
} from '../strategies/types.js';

/**
 * Signal Conflict Types
 */
export type SignalConflictType = 
  | 'directional_conflict'    // BUY vs SELL
  | 'temporal_conflict'       // Overlapping timeframes
  | 'symbol_conflict'         // Same symbol, different directions
  | 'resource_conflict'       // Insufficient capital for all signals
  | 'risk_conflict';          // Violates risk management rules

/**
 * Signal Conflict Resolution Strategies
 */
export type ConflictResolutionStrategy =
  | 'priority_weighted'       // Use strategy priority and signal strength
  | 'confidence_based'        // Highest confidence wins
  | 'risk_adjusted'           // Best risk-adjusted return
  | 'consensus'               // Require majority agreement
  | 'first_wins'              // First signal takes precedence
  | 'average_weighted';       // Weighted average of signals

/**
 * Signal Quality Metrics
 */
export interface SignalQualityMetrics {
  confidence: number;         // Base confidence score
  strength: number;           // Signal strength
  timeliness: number;         // How fresh the signal is
  consistency: number;        // Consistency with recent signals
  riskScore: number;         // Risk assessment score
  marketAlignment: number;   // Alignment with market conditions
  strategicValue: number;    // Strategic importance
  overallQuality: number;    // Composite quality score
}

/**
 * Signal Conflict Information
 */
export interface SignalConflict {
  id: string;
  type: SignalConflictType;
  signals: StrategySignal[];
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution?: {
    strategy: ConflictResolutionStrategy;
    winner?: StrategySignal;
    reasoning: string;
    confidence: number;
  };
  timestamp: Date;
}

/**
 * Processed Signal Result
 */
export interface ProcessedSignal extends StrategySignal {
  qualityMetrics: SignalQualityMetrics;
  processing: {
    originalSignal: StrategySignal;
    processingTime: number;
    modifications: string[];
    conflicts?: SignalConflict[];
    aggregatedFrom?: string[]; // Strategy IDs if aggregated
  };
  ranking: number; // Relative ranking among processed signals
}

/**
 * Signal Processing Configuration
 */
export interface SignalProcessorConfig {
  // Processing windows
  aggregationWindow: number;      // Milliseconds to wait for signal aggregation
  maxSignalAge: number;          // Maximum age before signal expires
  processingBatchSize: number;   // Max signals to process in one batch
  
  // Conflict resolution
  conflictResolutionStrategy: ConflictResolutionStrategy;
  enableConflictLogging: boolean;
  conflictThreshold: number;     // Threshold for conflict detection
  
  // Quality scoring
  qualityWeights: {
    confidence: number;
    strength: number;
    timeliness: number;
    consistency: number;
    riskScore: number;
    marketAlignment: number;
    strategicValue: number;
  };
  
  // Performance optimization
  enableCaching: boolean;
  cacheSize: number;
  parallelProcessing: boolean;
  maxProcessingTime: number;     // Max processing time per signal batch
  
  // Filtering
  minQualityScore: number;       // Minimum quality score to pass
  maxSignalsPerSymbol: number;   // Max concurrent signals per symbol
  enableDeduplication: boolean;  // Remove duplicate signals
}

/**
 * Signal Aggregation Result
 */
export interface SignalAggregationResult {
  aggregatedSignal: ProcessedSignal;
  sourceSignals: StrategySignal[];
  aggregationMethod: 'weighted_average' | 'highest_confidence' | 'consensus' | 'risk_optimized';
  confidence: number;
  reasoning: string[];
}

/**
 * Signal Processing Statistics
 */
export interface ProcessingStatistics {
  // Processing metrics
  totalProcessed: number;
  averageProcessingTime: number;
  successRate: number;
  errorCount: number;
  
  // Signal metrics
  signalsReceived: number;
  signalsPassed: number;
  signalsFiltered: number;
  signalsAggregated: number;
  
  // Conflict metrics
  conflictsDetected: number;
  conflictsResolved: number;
  conflictResolutionRate: number;
  
  // Quality metrics
  averageQualityScore: number;
  highQualitySignals: number;  // Above threshold
  lowQualitySignals: number;   // Below threshold
  
  lastUpdated: Date;
}

/**
 * Signal Cache Entry
 */
interface SignalCacheEntry {
  signal: ProcessedSignal;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
}

/**
 * Signal Processing Pipeline Stage
 */
abstract class ProcessingStage {
  abstract process(signals: StrategySignal[]): Promise<StrategySignal[]>;
  abstract getName(): string;
}

/**
 * Signal Validation Stage
 */
class ValidationStage extends ProcessingStage {
  async process(signals: StrategySignal[]): Promise<StrategySignal[]> {
    const validSignals: StrategySignal[] = [];
    
    for (const signal of signals) {
      if (await this.validateSignal(signal)) {
        validSignals.push(signal);
      }
    }
    
    return validSignals;
  }
  
  getName(): string {
    return 'validation';
  }
  
  private async validateSignal(signal: StrategySignal): Promise<boolean> {
    // Basic validation checks
    if (!signal.id || !signal.strategyId || !signal.symbol || !signal.type) {
      return false;
    }
    
    // Confidence range check
    if (signal.confidence < 0 || signal.confidence > 100) {
      return false;
    }
    
    // Temporal validity check
    const age = Date.now() - signal.timestamp.getTime();
    if (signal.expiresAt && signal.expiresAt.getTime() < Date.now()) {
      return false;
    }
    
    // Price validation
    if (signal.entryPrice && signal.entryPrice <= 0) {
      return false;
    }
    
    return signal.isValid;
  }
}

/**
 * Signal Deduplication Stage
 */
class DeduplicationStage extends ProcessingStage {
  async process(signals: StrategySignal[]): Promise<StrategySignal[]> {
    const deduped = new Map<string, StrategySignal>();
    
    for (const signal of signals) {
      const key = this.getSignalKey(signal);
      const existing = deduped.get(key);
      
      if (!existing || signal.confidence > existing.confidence) {
        deduped.set(key, signal);
      }
    }
    
    return Array.from(deduped.values());
  }
  
  getName(): string {
    return 'deduplication';
  }
  
  private getSignalKey(signal: StrategySignal): string {
    return `${signal.symbol}_${signal.type}_${signal.timeframe}`;
  }
}

/**
 * Signal Quality Scoring Stage
 */
class QualityScoringStage extends ProcessingStage {
  private config: SignalProcessorConfig;
  
  constructor(config: SignalProcessorConfig) {
    super();
    this.config = config;
  }
  
  async process(signals: StrategySignal[]): Promise<StrategySignal[]> {
    const scoredSignals: StrategySignal[] = [];
    
    for (const signal of signals) {
      const qualityScore = await this.calculateQualityScore(signal);
      
      if (qualityScore >= this.config.minQualityScore) {
        (signal as any).qualityScore = qualityScore;
        scoredSignals.push(signal);
      }
    }
    
    return scoredSignals;
  }
  
  getName(): string {
    return 'quality_scoring';
  }
  
  private async calculateQualityScore(signal: StrategySignal): Promise<number> {
    const weights = this.config.qualityWeights;
    
    // Calculate individual quality components
    const timeliness = this.calculateTimeliness(signal);
    const strength = signal.strength || 0.5;
    const confidence = signal.confidence / 100;
    const consistency = await this.calculateConsistency(signal);
    const riskScore = await this.calculateRiskScore(signal);
    const marketAlignment = await this.calculateMarketAlignment(signal);
    const strategicValue = await this.calculateStrategicValue(signal);
    
    // Weighted composite score
    const qualityScore = (
      confidence * weights.confidence +
      strength * weights.strength +
      timeliness * weights.timeliness +
      consistency * weights.consistency +
      riskScore * weights.riskScore +
      marketAlignment * weights.marketAlignment +
      strategicValue * weights.strategicValue
    ) / Object.values(weights).reduce((a, b) => a + b, 0);
    
    return Math.max(0, Math.min(1, qualityScore));
  }
  
  private calculateTimeliness(signal: StrategySignal): number {
    const age = Date.now() - signal.timestamp.getTime();
    const maxAge = this.config.maxSignalAge;
    return Math.max(0, 1 - (age / maxAge));
  }
  
  private async calculateConsistency(signal: StrategySignal): Promise<number> {
    // Simplified consistency calculation
    // In production, would compare with recent signals from same strategy
    return 0.7;
  }
  
  private async calculateRiskScore(signal: StrategySignal): Promise<number> {
    // Simplified risk score calculation
    // In production, would integrate with risk management system
    if (!signal.stopLoss || !signal.entryPrice) {
      return 0.5; // Medium risk for signals without stop loss
    }
    
    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss) / signal.entryPrice;
    return Math.max(0, 1 - stopDistance * 10); // Lower risk = higher score
  }
  
  private async calculateMarketAlignment(signal: StrategySignal): Promise<number> {
    // Simplified market alignment calculation
    // In production, would analyze current market conditions
    return 0.6;
  }
  
  private async calculateStrategicValue(signal: StrategySignal): Promise<number> {
    // Simplified strategic value calculation
    // In production, would consider portfolio balance, sector allocation, etc.
    const priorityValue = signal.priority === 'critical' ? 1.0 :
                         signal.priority === 'high' ? 0.8 :
                         signal.priority === 'medium' ? 0.6 : 0.4;
    
    return priorityValue;
  }
}

/**
 * Main Signal Processor Class
 */
export class SignalProcessor extends EventEmitter {
  private config: SignalProcessorConfig;
  private processingPipeline: ProcessingStage[];
  private signalCache: Map<string, SignalCacheEntry> = new Map();
  private statistics: ProcessingStatistics;
  private pendingSignals: Map<string, StrategySignal[]> = new Map(); // By symbol
  private processingTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(config: Partial<SignalProcessorConfig> = {}) {
    super();
    
    this.config = {
      aggregationWindow: 5000,           // 5 seconds
      maxSignalAge: 300000,             // 5 minutes
      processingBatchSize: 100,
      conflictResolutionStrategy: 'priority_weighted',
      enableConflictLogging: true,
      conflictThreshold: 0.3,
      qualityWeights: {
        confidence: 0.25,
        strength: 0.20,
        timeliness: 0.15,
        consistency: 0.15,
        riskScore: 0.10,
        marketAlignment: 0.10,
        strategicValue: 0.05
      },
      enableCaching: true,
      cacheSize: 1000,
      parallelProcessing: true,
      maxProcessingTime: 10000,         // 10 seconds
      minQualityScore: 0.5,
      maxSignalsPerSymbol: 5,
      enableDeduplication: true,
      ...config
    };
    
    this.initializeProcessingPipeline();
    this.initializeStatistics();
  }

  /**
   * Initialize the signal processor
   */
  async initialize(): Promise<void> {
    // Setup cleanup timers
    setInterval(() => this.cleanupExpiredSignals(), 60000); // Every minute
    setInterval(() => this.updateStatistics(), 30000);      // Every 30 seconds
    
    this.emit('initialized');
  }

  /**
   * Process incoming signals
   */
  async processSignals(signals: StrategySignal[]): Promise<ProcessedSignal[]> {
    const startTime = Date.now();
    
    try {
      this.statistics.signalsReceived += signals.length;
      
      // Group signals by symbol for efficient processing
      const signalsBySymbol = this.groupSignalsBySymbol(signals);
      const allProcessedSignals: ProcessedSignal[] = [];
      
      // Process each symbol group
      for (const [symbol, symbolSignals] of signalsBySymbol.entries()) {
        const processedSignals = await this.processSymbolSignals(symbol, symbolSignals);
        allProcessedSignals.push(...processedSignals);
      }
      
      // Apply global signal limits and ranking
      const rankedSignals = this.rankAndLimitSignals(allProcessedSignals);
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(signals.length, rankedSignals.length, processingTime);
      
      this.emit('signals_processed', {
        input: signals.length,
        output: rankedSignals.length,
        processingTime
      });
      
      return rankedSignals;

    } catch (error) {
      this.statistics.errorCount++;
      this.emit('processing_error', {
        error: error instanceof Error ? error.message : String(error),
        signalCount: signals.length
      });
      throw error;
    }
  }

  /**
   * Add signals to processing queue with aggregation window
   */
  async queueSignalsForProcessing(signals: StrategySignal[]): Promise<void> {
    for (const signal of signals) {
      const symbol = signal.symbol;
      
      // Add to pending signals
      if (!this.pendingSignals.has(symbol)) {
        this.pendingSignals.set(symbol, []);
      }
      this.pendingSignals.get(symbol)!.push(signal);
      
      // Reset or create timer for aggregation window
      if (this.processingTimers.has(symbol)) {
        clearTimeout(this.processingTimers.get(symbol));
      }
      
      const timer = setTimeout(async () => {
        const pendingForSymbol = this.pendingSignals.get(symbol) || [];
        this.pendingSignals.delete(symbol);
        this.processingTimers.delete(symbol);
        
        if (pendingForSymbol.length > 0) {
          const processed = await this.processSignals(pendingForSymbol);
          this.emit('aggregated_signals_processed', {
            symbol,
            count: processed.length
          });
        }
      }, this.config.aggregationWindow);
      
      this.processingTimers.set(symbol, timer);
    }
  }

  /**
   * Get processing statistics
   */
  getStatistics(): ProcessingStatistics {
    return { ...this.statistics };
  }

  /**
   * Clear processing cache
   */
  clearCache(): void {
    this.signalCache.clear();
    this.emit('cache_cleared');
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.processingTimers.values()) {
      clearTimeout(timer);
    }
    this.processingTimers.clear();
    
    // Clear pending signals
    this.pendingSignals.clear();
    
    // Clear cache
    this.clearCache();
    
    this.emit('cleanup_completed');
  }

  // === PRIVATE METHODS ===

  private initializeProcessingPipeline(): void {
    this.processingPipeline = [
      new ValidationStage(),
      new QualityScoringStage(this.config)
    ];
    
    if (this.config.enableDeduplication) {
      this.processingPipeline.splice(1, 0, new DeduplicationStage());
    }
  }

  private initializeStatistics(): void {
    this.statistics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      successRate: 1.0,
      errorCount: 0,
      signalsReceived: 0,
      signalsPassed: 0,
      signalsFiltered: 0,
      signalsAggregated: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      conflictResolutionRate: 0,
      averageQualityScore: 0,
      highQualitySignals: 0,
      lowQualitySignals: 0,
      lastUpdated: new Date()
    };
  }

  private groupSignalsBySymbol(signals: StrategySignal[]): Map<string, StrategySignal[]> {
    const grouped = new Map<string, StrategySignal[]>();
    
    for (const signal of signals) {
      if (!grouped.has(signal.symbol)) {
        grouped.set(signal.symbol, []);
      }
      grouped.get(signal.symbol)!.push(signal);
    }
    
    return grouped;
  }

  private async processSymbolSignals(symbol: string, signals: StrategySignal[]): Promise<ProcessedSignal[]> {
    // Detect conflicts
    const conflicts = this.detectConflicts(signals);
    
    // Resolve conflicts
    const resolvedSignals = conflicts.length > 0 ? 
      await this.resolveConflicts(signals, conflicts) : signals;
    
    // Apply processing pipeline
    let processedSignals = resolvedSignals;
    for (const stage of this.processingPipeline) {
      processedSignals = await stage.process(processedSignals);
    }
    
    // Convert to ProcessedSignal format
    const finalProcessedSignals: ProcessedSignal[] = processedSignals.map((signal, index) => ({
      ...signal,
      qualityMetrics: this.extractQualityMetrics(signal),
      processing: {
        originalSignal: signals.find(s => s.id === signal.id) || signal,
        processingTime: 0, // Would be tracked per signal
        modifications: [],
        conflicts: conflicts.filter(c => c.signals.some(s => s.id === signal.id))
      },
      ranking: index + 1
    }));
    
    // Apply symbol-specific limits
    const limitedSignals = this.applySymbolLimits(symbol, finalProcessedSignals);
    
    return limitedSignals;
  }

  private detectConflicts(signals: StrategySignal[]): SignalConflict[] {
    const conflicts: SignalConflict[] = [];
    
    // Check for directional conflicts
    const buySignals = signals.filter(s => s.type === 'BUY');
    const sellSignals = signals.filter(s => s.type === 'SELL');
    
    if (buySignals.length > 0 && sellSignals.length > 0) {
      conflicts.push({
        id: `conflict_${Date.now()}`,
        type: 'directional_conflict',
        signals: [...buySignals, ...sellSignals],
        description: `Conflicting buy and sell signals for ${signals[0]?.symbol}`,
        severity: 'high',
        timestamp: new Date()
      });
    }
    
    // Check for resource conflicts (simplified)
    if (signals.length > this.config.maxSignalsPerSymbol) {
      conflicts.push({
        id: `resource_conflict_${Date.now()}`,
        type: 'resource_conflict',
        signals: signals,
        description: `Too many signals for ${signals[0]?.symbol}`,
        severity: 'medium',
        timestamp: new Date()
      });
    }
    
    this.statistics.conflictsDetected += conflicts.length;
    
    if (conflicts.length > 0) {
      this.emit('conflicts_detected', { conflicts, symbol: signals[0]?.symbol });
    }
    
    return conflicts;
  }

  private async resolveConflicts(signals: StrategySignal[], conflicts: SignalConflict[]): Promise<StrategySignal[]> {
    let resolvedSignals = [...signals];
    
    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      if (resolution) {
        conflict.resolution = resolution;
        
        // Apply resolution
        if (resolution.winner) {
          resolvedSignals = resolvedSignals.filter(s => 
            !conflict.signals.includes(s) || s.id === resolution.winner!.id
          );
        }
        
        this.statistics.conflictsResolved++;
      }
    }
    
    this.statistics.conflictResolutionRate = 
      this.statistics.conflictsDetected > 0 ? 
        this.statistics.conflictsResolved / this.statistics.conflictsDetected : 1.0;
    
    return resolvedSignals;
  }

  private async resolveConflict(conflict: SignalConflict): Promise<any> {
    const strategy = this.config.conflictResolutionStrategy;
    
    switch (strategy) {
      case 'confidence_based':
        return this.resolveByConfidence(conflict);
      
      case 'priority_weighted':
        return this.resolveByPriorityWeight(conflict);
      
      case 'first_wins':
        return this.resolveFirstWins(conflict);
      
      case 'risk_adjusted':
        return this.resolveByRiskAdjustment(conflict);
      
      default:
        return this.resolveByConfidence(conflict);
    }
  }

  private resolveByConfidence(conflict: SignalConflict): any {
    const winner = conflict.signals.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      strategy: 'confidence_based' as ConflictResolutionStrategy,
      winner,
      reasoning: `Selected signal with highest confidence: ${winner.confidence}%`,
      confidence: winner.confidence / 100
    };
  }

  private resolveByPriorityWeight(conflict: SignalConflict): any {
    // Calculate weighted score based on priority and confidence
    const scores = conflict.signals.map(signal => {
      const priorityWeight = signal.priority === 'critical' ? 4 :
                            signal.priority === 'high' ? 3 :
                            signal.priority === 'medium' ? 2 : 1;
      
      return {
        signal,
        score: (signal.confidence / 100) * priorityWeight * (signal.strength || 0.5)
      };
    });
    
    const winner = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return {
      strategy: 'priority_weighted' as ConflictResolutionStrategy,
      winner: winner.signal,
      reasoning: `Selected signal with highest weighted score: ${winner.score.toFixed(2)}`,
      confidence: winner.score / 4 // Normalize to 0-1
    };
  }

  private resolveFirstWins(conflict: SignalConflict): any {
    const winner = conflict.signals.reduce((earliest, current) => 
      current.timestamp < earliest.timestamp ? current : earliest
    );
    
    return {
      strategy: 'first_wins' as ConflictResolutionStrategy,
      winner,
      reasoning: 'Selected earliest signal',
      confidence: winner.confidence / 100
    };
  }

  private resolveByRiskAdjustment(conflict: SignalConflict): any {
    // Calculate risk-adjusted score
    const scores = conflict.signals.map(signal => {
      const confidence = signal.confidence / 100;
      const riskScore = signal.maxRisk ? (100 - signal.maxRisk) / 100 : 0.5;
      
      return {
        signal,
        score: confidence * riskScore
      };
    });
    
    const winner = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return {
      strategy: 'risk_adjusted' as ConflictResolutionStrategy,
      winner: winner.signal,
      reasoning: `Selected signal with best risk-adjusted score: ${winner.score.toFixed(2)}`,
      confidence: winner.score
    };
  }

  private extractQualityMetrics(signal: any): SignalQualityMetrics {
    // Extract quality metrics from processed signal
    const qualityScore = signal.qualityScore || 0.5;
    
    return {
      confidence: signal.confidence / 100,
      strength: signal.strength || 0.5,
      timeliness: this.calculateTimeliness(signal),
      consistency: 0.7, // Would be calculated from history
      riskScore: 0.6,   // Would be calculated from risk assessment
      marketAlignment: 0.6, // Would be calculated from market conditions
      strategicValue: 0.5,   // Would be calculated from strategy importance
      overallQuality: qualityScore
    };
  }

  private calculateTimeliness(signal: StrategySignal): number {
    const age = Date.now() - signal.timestamp.getTime();
    return Math.max(0, 1 - (age / this.config.maxSignalAge));
  }

  private applySymbolLimits(symbol: string, signals: ProcessedSignal[]): ProcessedSignal[] {
    // Sort by quality and ranking
    const sorted = signals.sort((a, b) => 
      b.qualityMetrics.overallQuality - a.qualityMetrics.overallQuality
    );
    
    return sorted.slice(0, this.config.maxSignalsPerSymbol);
  }

  private rankAndLimitSignals(signals: ProcessedSignal[]): ProcessedSignal[] {
    // Global ranking based on quality
    const ranked = signals.sort((a, b) => 
      b.qualityMetrics.overallQuality - a.qualityMetrics.overallQuality
    );
    
    // Update rankings
    ranked.forEach((signal, index) => {
      signal.ranking = index + 1;
    });
    
    return ranked;
  }

  private cleanupExpiredSignals(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.signalCache.entries()) {
      const age = now - entry.timestamp.getTime();
      if (age > this.config.maxSignalAge) {
        this.signalCache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.emit('expired_signals_cleaned', { count: removedCount });
    }
  }

  private updateProcessingMetrics(inputCount: number, outputCount: number, processingTime: number): void {
    this.statistics.totalProcessed += inputCount;
    this.statistics.signalsPassed += outputCount;
    this.statistics.signalsFiltered += (inputCount - outputCount);
    
    // Update average processing time
    const totalTime = this.statistics.averageProcessingTime * (this.statistics.totalProcessed - inputCount) + processingTime;
    this.statistics.averageProcessingTime = totalTime / this.statistics.totalProcessed;
    
    // Update success rate
    this.statistics.successRate = (this.statistics.totalProcessed - this.statistics.errorCount) / 
                                 Math.max(this.statistics.totalProcessed, 1);
  }

  private updateStatistics(): void {
    this.statistics.lastUpdated = new Date();
  }
}

export default SignalProcessor;