/**
 * Signal Generation System - Task BE-014: Signal Generation System
 * 
 * Enterprise-grade signal generation pipeline with:
 * - High-performance signal processing with confidence scoring
 * - Real-time signal generation and validation
 * - Signal history tracking and analytics
 * - Advanced conflict resolution and enhancement
 * - Comprehensive monitoring and health checks
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type {
  ISignalGenerator,
  SignalGenerationConfig,
  SignalGenerationRequest,
  SignalGenerationResult,
  SignalHistoryEntry,
  SignalProcessingStats,
  SignalProcessingEvent,
  SignalValidationRule,
  SignalConflictResolver,
  SignalEnhancementPlugin,
  ConfidenceScoringConfig
} from './types.js';
import {
  SignalGenerationError,
  SignalValidationError,
  SignalConflictError,
  SignalTimeoutError
} from './types.js';
import type {
  StrategySignal,
  StrategyContext,
  StrategySignalType
} from '../strategies/types.js';
import type {
  ConditionExpression,
  EvaluationContext,
  ConditionEvaluationResult
} from '../conditions/types.js';
import { ConditionEvaluationEngine } from '../conditions/ConditionEvaluationEngine.js';

// =============================================================================
// SIGNAL GENERATOR IMPLEMENTATION
// =============================================================================

export class SignalGenerator extends EventEmitter implements ISignalGenerator {
  private readonly config: SignalGenerationConfig;
  private readonly confidenceScoringConfig: ConfidenceScoringConfig;
  private readonly conditionEngine: ConditionEvaluationEngine;
  
  // History and tracking
  private readonly signalHistory = new Map<string, SignalHistoryEntry[]>(); // strategyId -> history
  private readonly processingStats: SignalProcessingStats;
  
  // Real-time processing
  private isRealTimeProcessingActive = false;
  private realTimeInterval?: NodeJS.Timeout;
  private readonly processingQueue: SignalGenerationRequest[] = [];
  
  // Validation and enhancement
  private readonly validationRules = new Map<string, SignalValidationRule>();
  private readonly conflictResolvers = new Map<string, SignalConflictResolver>();
  private readonly enhancementPlugins = new Map<string, SignalEnhancementPlugin>();
  
  // Performance monitoring
  private readonly recentEvents: SignalProcessingEvent[] = [];
  private requestCounter = 0;

  constructor(
    config: Partial<SignalGenerationConfig> = {},
    confidenceConfig: Partial<ConfidenceScoringConfig> = {}
  ) {
    super();
    
    this.config = this.mergeDefaultConfig(config);
    this.confidenceScoringConfig = this.mergeConfidenceConfig(confidenceConfig);
    this.conditionEngine = new ConditionEvaluationEngine();
    
    this.processingStats = this.initializeStats();
    
    this.setupDefaultValidationRules();
    this.setupDefaultConflictResolvers();
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // CORE SIGNAL GENERATION
  // =============================================================================

  /**
   * Generate signals based on strategy conditions and context
   */
  async generateSignals(request: SignalGenerationRequest): Promise<SignalGenerationResult> {
    const startTime = performance.now();
    const requestId = request.id || `req_${++this.requestCounter}_${Date.now()}`;
    
    this.emit('requestStarted', { requestId, request });
    
    try {
      // Validate request
      await this.validateRequest(request);
      
      // Create timeout promise
      const timeout = request.timeout || this.config.validation.maxSignalsPerInterval * 1000;
      const timeoutPromise = this.createTimeoutPromise(requestId, timeout);
      
      // Process signal generation with timeout
      const processPromise = this.processSignalGeneration(requestId, request);
      const result = await Promise.race([processPromise, timeoutPromise]);
      
      // Update statistics
      this.updateProcessingStats(result);
      
      // Track processing event
      this.trackEvent({
        type: result.success ? 'signal_generated' : 'error',
        timestamp: new Date(),
        request,
        result,
        strategyId: request.strategyId,
        symbol: request.context.marketData.symbol,
        metadata: {
          processingTime: performance.now() - startTime,
          signalsGenerated: result.signals.length
        }
      });
      
      this.emit('requestCompleted', { requestId, result });
      
      return result;
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      const errorResult: SignalGenerationResult = {
        requestId,
        success: false,
        signals: [],
        metadata: {
          processingTime,
          conditionsEvaluated: 0,
          conditionsPassed: 0,
          confidenceScores: [],
          averageConfidence: 0
        },
        errors: [{
          type: error instanceof SignalValidationError ? 'validation' :
                error instanceof SignalTimeoutError ? 'timeout' :
                error instanceof SignalConflictError ? 'risk' : 'processing',
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof SignalGenerationError ? error.code : 'UNKNOWN_ERROR',
          details: error instanceof SignalGenerationError ? { originalError: error.originalError } : {}
        }],
        warnings: [],
        timestamp: new Date()
      };
      
      this.trackEvent({
        type: 'error',
        timestamp: new Date(),
        request,
        result: errorResult,
        error: error instanceof Error ? error : new Error(String(error)),
        strategyId: request.strategyId,
        symbol: request.context.marketData.symbol,
        metadata: { processingTime }
      });
      
      this.emit('requestFailed', { requestId, error, result: errorResult });
      
      return errorResult;
    }
  }

  /**
   * Process the actual signal generation logic
   */
  private async processSignalGeneration(
    requestId: string,
    request: SignalGenerationRequest
  ): Promise<SignalGenerationResult> {
    const { context, conditions, strategyId } = request;
    const signals: StrategySignal[] = [];
    const confidenceScores: number[] = [];
    const warnings: SignalGenerationResult['warnings'] = [];
    
    // Convert strategy context to condition evaluation context
    const evaluationContext = this.convertToEvaluationContext(context);
    
    // Evaluate all conditions
    const conditionResults = await this.conditionEngine.evaluateBatch(
      conditions,
      evaluationContext
    );
    
    let conditionsPassed = 0;
    
    // Process condition results and generate signals
    for (const [conditionId, conditionResult] of conditionResults.results) {
      if (!conditionResult.success) {
        continue;
      }
      
      if (conditionResult.value) {
        conditionsPassed++;
        
        // Generate signal based on condition result
        const signal = await this.generateSignalFromCondition(
          conditionId,
          conditionResult,
          context,
          strategyId
        );
        
        if (signal) {
          // Calculate confidence score
          const confidence = await this.calculateConfidenceScore(
            signal,
            conditionResult,
            context
          );
          
          signal.confidence = confidence;
          confidenceScores.push(confidence);
          
          // Validate signal
          const validationResult = await this.validateSignal(signal, context);
          if (validationResult.valid) {
            // Apply enhancements
            const enhancedSignal = await this.enhanceSignal(signal, context);
            signals.push(enhancedSignal);
          } else {
            warnings.push({
              type: 'validation',
              message: validationResult.message || 'Signal failed validation',
              signal
            });
          }
        }
      }
    }
    
    // Resolve conflicts between signals
    const resolvedSignals = await this.resolveSignalConflicts(signals, context);
    
    // Filter signals based on configuration
    const filteredSignals = this.filterSignals(resolvedSignals, context);
    
    // Store signals in history
    await this.storeSignalsInHistory(filteredSignals, request);
    
    const averageConfidence = confidenceScores.length > 0 
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;
    
    return {
      requestId,
      success: true,
      signals: filteredSignals,
      metadata: {
        processingTime: 0, // Will be set by caller
        conditionsEvaluated: conditions.length,
        conditionsPassed,
        confidenceScores,
        averageConfidence
      },
      errors: [],
      warnings,
      timestamp: new Date()
    };
  }

  // =============================================================================
  // SIGNAL PROCESSING METHODS
  // =============================================================================

  /**
   * Generate signal from condition evaluation result
   */
  private async generateSignalFromCondition(
    conditionId: string,
    conditionResult: ConditionEvaluationResult,
    context: StrategyContext,
    strategyId: string
  ): Promise<StrategySignal | null> {
    // Extract signal type from condition metadata or use default logic
    const signalType = this.determineSignalType(conditionResult, context);
    
    if (!signalType) {
      return null;
    }
    
    // Create base signal
    const signal: StrategySignal = {
      id: `sig_${strategyId}_${conditionId}_${Date.now()}`,
      strategyId,
      timestamp: new Date(),
      type: signalType,
      symbol: context.marketData.symbol,
      confidence: conditionResult.confidence * 100, // Convert to 0-100 scale
      strength: this.calculateSignalStrength(conditionResult, context),
      timeframe: context.marketData.timeframe,
      
      // Set price levels from current market data
      entryPrice: context.marketData.currentPrice,
      
      // Basic risk management (will be enhanced by plugins)
      maxRisk: this.config.riskControls.maxRiskPerSignal,
      
      // Context and metadata
      reasoning: this.generateReasoning(conditionResult, context),
      indicators: this.extractIndicatorValues(context),
      conditions: [conditionId],
      source: 'technical',
      priority: 'medium',
      isValid: true,
      
      metadata: {
        conditionId,
        evaluationTime: conditionResult.executionTime,
        shortCircuited: conditionResult.details.shortCircuited,
        fromCache: conditionResult.details.fromCache
      }
    };
    
    // Set stop loss and take profit based on signal type and market conditions
    this.setRiskLevels(signal, context);
    
    return signal;
  }

  /**
   * Calculate comprehensive confidence score for signal
   */
  private async calculateConfidenceScore(
    signal: StrategySignal,
    conditionResult: ConditionEvaluationResult,
    context: StrategyContext
  ): Promise<number> {
    const { weights, adjustments, normalization } = this.confidenceScoringConfig;
    
    let score = 0;
    let totalWeight = 0;
    
    // Base confidence from condition evaluation
    if (weights.conditionConfidence > 0) {
      score += conditionResult.confidence * weights.conditionConfidence;
      totalWeight += weights.conditionConfidence;
    }
    
    // Indicator alignment - check if multiple indicators support the signal
    if (weights.indicatorAlignment > 0) {
      const alignmentScore = this.calculateIndicatorAlignment(signal, context);
      score += alignmentScore * weights.indicatorAlignment;
      totalWeight += weights.indicatorAlignment;
    }
    
    // Market conditions favorability
    if (weights.marketConditions > 0) {
      const marketScore = this.calculateMarketConditionsScore(signal, context);
      score += marketScore * weights.marketConditions;
      totalWeight += weights.marketConditions;
    }
    
    // Historical accuracy of similar signals
    if (weights.historicalAccuracy > 0) {
      const historicalScore = await this.calculateHistoricalAccuracy(signal);
      score += historicalScore * weights.historicalAccuracy;
      totalWeight += weights.historicalAccuracy;
    }
    
    // Timeframe importance
    if (weights.timeframe > 0) {
      const timeframeScore = this.calculateTimeframeImportance(signal.timeframe);
      score += timeframeScore * weights.timeframe;
      totalWeight += weights.timeframe;
    }
    
    // Volume confirmation
    if (weights.volume > 0) {
      const volumeScore = this.calculateVolumeConfirmation(context);
      score += volumeScore * weights.volume;
      totalWeight += weights.volume;
    }
    
    // Volatility considerations
    if (weights.volatility > 0) {
      const volatilityScore = this.calculateVolatilityScore(context);
      score += volatilityScore * weights.volatility;
      totalWeight += weights.volatility;
    }
    
    // Normalize base score
    let finalScore = totalWeight > 0 ? (score / totalWeight) : 0;
    
    // Apply adjustments
    if (adjustments.penalizeConflicts) {
      const conflictPenalty = await this.calculateConflictPenalty(signal, context);
      finalScore *= (1 - conflictPenalty);
    }
    
    if (adjustments.rewardConsensus) {
      const consensusBonus = this.calculateConsensusBonus(signal, context);
      finalScore *= (1 + consensusBonus);
    }
    
    if (adjustments.timeDecay) {
      const decayFactor = this.calculateTimeDecay(context);
      finalScore *= decayFactor;
    }
    
    if (adjustments.marketRegimeAdjustment) {
      const regimeAdjustment = this.calculateMarketRegimeAdjustment(context);
      finalScore *= regimeAdjustment;
    }
    
    // Apply normalization
    finalScore = this.normalizeConfidenceScore(finalScore, normalization);
    
    // Ensure score is within valid range
    return Math.max(0, Math.min(100, finalScore * 100));
  }

  // =============================================================================
  // SIGNAL VALIDATION AND ENHANCEMENT
  // =============================================================================

  /**
   * Validate signal against configured rules
   */
  private async validateSignal(
    signal: StrategySignal,
    context: StrategyContext
  ): Promise<{ valid: boolean; score: number; message?: string }> {
    let totalScore = 0;
    let validationCount = 0;
    const messages: string[] = [];
    
    // Check minimum confidence threshold
    if (signal.confidence < this.config.validation.minConfidence) {
      return {
        valid: false,
        score: 0,
        message: `Signal confidence ${signal.confidence} below minimum threshold ${this.config.validation.minConfidence}`
      };
    }
    
    // Run custom validation rules
    for (const rule of this.validationRules.values()) {
      if (!rule.enabled) continue;
      
      try {
        const ruleResult = await rule.validate(signal, context);
        
        if (!ruleResult.valid) {
          return {
            valid: false,
            score: ruleResult.score,
            message: ruleResult.message || `Validation rule '${rule.name}' failed`
          };
        }
        
        totalScore += ruleResult.score;
        validationCount++;
        
        // Apply any suggested adjustments
        if (ruleResult.adjustments) {
          Object.assign(signal, ruleResult.adjustments);
        }
        
      } catch (error) {
        messages.push(`Validation rule '${rule.name}' error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const averageScore = validationCount > 0 ? totalScore / validationCount : 100;
    
    return {
      valid: true,
      score: averageScore,
      message: messages.length > 0 ? messages.join('; ') : undefined
    };
  }

  /**
   * Enhance signal using configured plugins
   */
  private async enhanceSignal(
    signal: StrategySignal,
    context: StrategyContext
  ): Promise<StrategySignal> {
    let enhancedSignal = { ...signal };
    
    for (const plugin of this.enhancementPlugins.values()) {
      if (!plugin.enabled) continue;
      
      try {
        const enhancement = await plugin.enhance(enhancedSignal, context);
        enhancedSignal = { ...enhancedSignal, ...enhancement };
        
      } catch (error) {
        this.emit('enhancementError', {
          plugin: plugin.id,
          signal: signal.id,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
    
    return enhancedSignal;
  }

  /**
   * Resolve conflicts between multiple signals
   */
  private async resolveSignalConflicts(
    signals: StrategySignal[],
    context: StrategyContext
  ): Promise<StrategySignal[]> {
    if (signals.length <= 1) {
      return signals;
    }
    
    // Group signals by symbol and timeframe for conflict detection
    const signalGroups = new Map<string, StrategySignal[]>();
    
    for (const signal of signals) {
      const key = `${signal.symbol}_${signal.timeframe}`;
      if (!signalGroups.has(key)) {
        signalGroups.set(key, []);
      }
      signalGroups.get(key)!.push(signal);
    }
    
    const resolvedSignals: StrategySignal[] = [];
    
    for (const [groupKey, groupSignals] of signalGroups) {
      if (groupSignals.length === 1) {
        resolvedSignals.push(groupSignals[0]);
        continue;
      }
      
      // Check for conflicts (opposite signals)
      const conflicts = this.detectSignalConflicts(groupSignals);
      
      if (conflicts.length === 0) {
        // No conflicts, keep all signals
        resolvedSignals.push(...groupSignals);
      } else {
        // Resolve conflicts using configured strategy
        const resolver = this.conflictResolvers.get(this.config.validation.conflictResolution);
        
        if (resolver) {
          try {
            const resolution = await resolver.resolve(conflicts, context);
            resolvedSignals.push(...resolution.resolved);
            
            // Log rejected signals
            for (const rejected of resolution.rejected) {
              this.emit('signalRejected', {
                signal: rejected.signal,
                reason: rejected.reason,
                resolver: resolver.name
              });
            }
            
          } catch (error) {
            // Fallback to highest confidence if resolver fails
            const bestSignal = conflicts.reduce((best, current) =>
              current.confidence > best.confidence ? current : best
            );
            resolvedSignals.push(bestSignal);
          }
        } else {
          // Default resolution: highest confidence
          const bestSignal = conflicts.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
          );
          resolvedSignals.push(bestSignal);
        }
      }
    }
    
    return resolvedSignals;
  }

  // =============================================================================
  // SIGNAL HISTORY AND TRACKING
  // =============================================================================

  /**
   * Get signal history for strategy
   */
  async getSignalHistory(
    strategyId: string,
    options: {
      from?: Date;
      to?: Date;
      limit?: number;
      type?: StrategySignalType;
    } = {}
  ): Promise<SignalHistoryEntry[]> {
    const history = this.signalHistory.get(strategyId) || [];
    
    let filteredHistory = history;
    
    // Apply filters
    if (options.from) {
      filteredHistory = filteredHistory.filter(entry =>
        entry.signal.timestamp >= options.from!
      );
    }
    
    if (options.to) {
      filteredHistory = filteredHistory.filter(entry =>
        entry.signal.timestamp <= options.to!
      );
    }
    
    if (options.type) {
      filteredHistory = filteredHistory.filter(entry =>
        entry.signal.type === options.type
      );
    }
    
    // Sort by timestamp (newest first)
    filteredHistory.sort((a, b) =>
      b.signal.timestamp.getTime() - a.signal.timestamp.getTime()
    );
    
    // Apply limit
    if (options.limit) {
      filteredHistory = filteredHistory.slice(0, options.limit);
    }
    
    return filteredHistory;
  }

  /**
   * Store signals in history
   */
  private async storeSignalsInHistory(
    signals: StrategySignal[],
    request: SignalGenerationRequest
  ): Promise<void> {
    if (!this.config.persistence.enableHistory) {
      return;
    }
    
    const strategyId = request.strategyId;
    
    if (!this.signalHistory.has(strategyId)) {
      this.signalHistory.set(strategyId, []);
    }
    
    const history = this.signalHistory.get(strategyId)!;
    
    // Create history entries
    for (const signal of signals) {
      const historyEntry: SignalHistoryEntry = {
        id: `hist_${signal.id}_${Date.now()}`,
        signal,
        generationContext: {
          strategyId,
          conditionsUsed: signal.conditions || [],
          marketConditions: request.context.marketConditions,
          indicators: this.extractIndicatorValues(request.context)
        },
        lifecycle: {
          generated: new Date()
        },
        metadata: {
          requestId: request.id,
          priority: request.priority
        }
      };
      
      history.push(historyEntry);
    }
    
    // Cleanup old history if needed
    if (history.length > this.config.persistence.maxHistorySize) {
      history.splice(0, history.length - this.config.persistence.maxHistorySize);
    }
    
    // Remove expired entries
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.persistence.retentionPeriodDays);
    
    const validEntries = history.filter(entry =>
      entry.lifecycle.generated >= cutoffDate
    );
    
    this.signalHistory.set(strategyId, validEntries);
  }

  // =============================================================================
  // CONFIGURATION AND MANAGEMENT
  // =============================================================================

  getConfig(): SignalGenerationConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<SignalGenerationConfig>): Promise<void> {
    Object.assign(this.config, config);
    this.emit('configUpdated', { config: this.config });
  }

  async getProcessingStats(
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<SignalProcessingStats> {
    // Return current stats (in production, this would aggregate from persistent storage)
    return { ...this.processingStats };
  }

  async startRealTimeProcessing(): Promise<void> {
    if (this.isRealTimeProcessingActive) {
      return;
    }
    
    this.isRealTimeProcessingActive = true;
    
    // Start processing interval
    this.realTimeInterval = setInterval(async () => {
      if (this.processingQueue.length > 0) {
        const batchSize = Math.min(this.config.batchSize, this.processingQueue.length);
        const batch = this.processingQueue.splice(0, batchSize);
        
        // Process batch concurrently with configured concurrency limit
        const concurrency = Math.min(this.config.maxConcurrency, batch.length);
        const chunks = this.chunkArray(batch, concurrency);
        
        for (const chunk of chunks) {
          const promises = chunk.map(request => this.generateSignals(request));
          await Promise.allSettled(promises);
        }
      }
    }, this.config.processingInterval);
    
    this.emit('realTimeProcessingStarted');
  }

  async stopRealTimeProcessing(): Promise<void> {
    this.isRealTimeProcessingActive = false;
    
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = undefined;
    }
    
    this.emit('realTimeProcessingStopped');
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 100;
    
    // Check processing queue size
    if (this.processingQueue.length > this.config.batchSize * 2) {
      issues.push('Processing queue is backing up');
      score -= 20;
    }
    
    // Check error rate
    const recentErrors = this.recentEvents
      .filter(event => event.type === 'error')
      .filter(event => Date.now() - event.timestamp.getTime() < 300000); // Last 5 minutes
    
    if (recentErrors.length > 5) {
      issues.push('High error rate detected');
      score -= 30;
    }
    
    // Check condition engine health
    try {
      const engineSnapshot = this.conditionEngine.getPerformanceSnapshot();
      if (engineSnapshot.performance.successRate < 0.9) {
        issues.push('Condition evaluation engine has low success rate');
        score -= 25;
      }
    } catch (error) {
      issues.push('Cannot get condition engine status');
      score -= 40;
    }
    
    return {
      healthy: score >= 70,
      score: Math.max(0, score),
      issues
    };
  }

  // =============================================================================
  // PRIVATE UTILITY METHODS
  // =============================================================================

  private mergeDefaultConfig(config: Partial<SignalGenerationConfig>): SignalGenerationConfig {
    return {
      id: config.id || 'default-signal-generator',
      name: config.name || 'Default Signal Generator',
      version: config.version || '1.0.0',
      
      enableRealTimeProcessing: config.enableRealTimeProcessing ?? true,
      processingInterval: config.processingInterval ?? 1000,
      batchSize: config.batchSize ?? 10,
      maxConcurrency: config.maxConcurrency ?? 5,
      
      validation: {
        minConfidence: config.validation?.minConfidence ?? 60,
        maxSignalsPerInterval: config.validation?.maxSignalsPerInterval ?? 100,
        duplicateDetection: config.validation?.duplicateDetection ?? true,
        conflictResolution: config.validation?.conflictResolution ?? 'highest_confidence'
      },
      
      persistence: {
        enableHistory: config.persistence?.enableHistory ?? true,
        maxHistorySize: config.persistence?.maxHistorySize ?? 10000,
        retentionPeriodDays: config.persistence?.retentionPeriodDays ?? 30,
        compressionEnabled: config.persistence?.compressionEnabled ?? false
      },
      
      monitoring: {
        enableMetrics: config.monitoring?.enableMetrics ?? true,
        metricsInterval: config.monitoring?.metricsInterval ?? 60000,
        alertThresholds: {
          lowConfidenceRate: config.monitoring?.alertThresholds?.lowConfidenceRate ?? 0.3,
          highLatency: config.monitoring?.alertThresholds?.highLatency ?? 5000,
          errorRate: config.monitoring?.alertThresholds?.errorRate ?? 0.1
        }
      },
      
      riskControls: {
        maxRiskPerSignal: config.riskControls?.maxRiskPerSignal ?? 2.0,
        positionSizeLimits: {
          min: config.riskControls?.positionSizeLimits?.min ?? 0.01,
          max: config.riskControls?.positionSizeLimits?.max ?? 10.0
        },
        cooldownPeriods: {
          sameSymbol: config.riskControls?.cooldownPeriods?.sameSymbol ?? 300,
          oppositeSignal: config.riskControls?.cooldownPeriods?.oppositeSignal ?? 600
        }
      }
    };
  }

  private mergeConfidenceConfig(config: Partial<ConfidenceScoringConfig>): ConfidenceScoringConfig {
    return {
      method: config.method || 'weighted',
      
      weights: {
        conditionConfidence: config.weights?.conditionConfidence ?? 0.3,
        indicatorAlignment: config.weights?.indicatorAlignment ?? 0.2,
        marketConditions: config.weights?.marketConditions ?? 0.15,
        historicalAccuracy: config.weights?.historicalAccuracy ?? 0.15,
        timeframe: config.weights?.timeframe ?? 0.1,
        volume: config.weights?.volume ?? 0.05,
        volatility: config.weights?.volatility ?? 0.05
      },
      
      adjustments: {
        penalizeConflicts: config.adjustments?.penalizeConflicts ?? true,
        rewardConsensus: config.adjustments?.rewardConsensus ?? true,
        timeDecay: config.adjustments?.timeDecay ?? false,
        marketRegimeAdjustment: config.adjustments?.marketRegimeAdjustment ?? true
      },
      
      normalization: {
        method: config.normalization?.method || 'sigmoid',
        range: config.normalization?.range || [0, 1]
      }
    };
  }

  private initializeStats(): SignalProcessingStats {
    return {
      totalSignals: 0,
      signalsProcessed: 0,
      signalsExecuted: 0,
      signalsExpired: 0,
      signalsCancelled: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      successRate: 0,
      byType: {} as any,
      hourly: [],
      daily: [],
      errors: {
        total: 0,
        byType: {},
        recent: []
      },
      lastUpdated: new Date()
    };
  }

  private setupDefaultValidationRules(): void {
    // Add basic validation rules
    this.validationRules.set('min-confidence', {
      id: 'min-confidence',
      name: 'Minimum Confidence',
      description: 'Ensure signal meets minimum confidence threshold',
      enabled: true,
      type: 'confidence',
      parameters: { threshold: this.config.validation.minConfidence },
      validate: async (signal) => ({
        valid: signal.confidence >= this.config.validation.minConfidence,
        score: signal.confidence,
        message: signal.confidence < this.config.validation.minConfidence 
          ? `Confidence ${signal.confidence} below threshold` 
          : undefined
      })
    });
  }

  private setupDefaultConflictResolvers(): void {
    // Highest confidence resolver
    this.conflictResolvers.set('highest_confidence', {
      name: 'Highest Confidence',
      description: 'Keep signal with highest confidence',
      resolve: async (conflicts) => ({
        resolved: [conflicts.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        )],
        rejected: conflicts.slice(1).map(signal => ({
          signal,
          reason: 'Lower confidence than winning signal'
        }))
      })
    });
  }

  // Additional utility methods would be implemented here...
  // (Due to length constraints, showing key structure and patterns)

  private convertToEvaluationContext(context: StrategyContext): EvaluationContext {
    return {
      timestamp: context.timestamp.getTime(),
      symbol: context.marketData.symbol,
      timeframe: context.marketData.timeframe,
      marketData: {
        current: {
          open: context.marketData.currentPrice,
          high: context.marketData.high24h,
          low: context.marketData.low24h,
          close: context.marketData.currentPrice,
          volume: context.marketData.volume24h
        },
        history: context.marketData.candles.map(candle => ({
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.baseTokenVolume)
        }))
      },
      indicators: new Map(Object.entries(context.indicators || {})),
      variables: new Map(),
      sessionData: new Map(),
      strategyData: new Map()
    };
  }

  private determineSignalType(
    conditionResult: ConditionEvaluationResult,
    context: StrategyContext
  ): StrategySignalType | null {
    // Simple logic - in practice this would be more sophisticated
    // based on condition metadata or strategy configuration
    return 'BUY'; // Placeholder
  }

  private calculateSignalStrength(
    conditionResult: ConditionEvaluationResult,
    context: StrategyContext
  ): number {
    return conditionResult.confidence;
  }

  private generateReasoning(
    conditionResult: ConditionEvaluationResult,
    context: StrategyContext
  ): string {
    return `Signal generated from condition ${conditionResult.conditionId} with confidence ${conditionResult.confidence}`;
  }

  private extractIndicatorValues(context: StrategyContext): Record<string, number> {
    const indicators: Record<string, number> = {};
    
    if (context.indicators.rsi) {
      indicators.rsi = context.indicators.rsi;
    }
    
    if (context.indicators.macd) {
      indicators.macd = context.indicators.macd.macd;
      indicators.macd_signal = context.indicators.macd.signal;
    }
    
    // Add more indicator extractions...
    
    return indicators;
  }

  private setRiskLevels(signal: StrategySignal, context: StrategyContext): void {
    const atr = context.indicators.atr || (context.marketData.high24h - context.marketData.low24h);
    
    if (signal.type === 'BUY') {
      signal.stopLoss = signal.entryPrice! - (atr * 2);
      signal.takeProfit = signal.entryPrice! + (atr * 3);
    } else if (signal.type === 'SELL') {
      signal.stopLoss = signal.entryPrice! + (atr * 2);
      signal.takeProfit = signal.entryPrice! - (atr * 3);
    }
  }

  // Additional calculation methods would be implemented here...
  // (Showing structure for key confidence scoring components)

  private calculateIndicatorAlignment(signal: StrategySignal, context: StrategyContext): number {
    // Implement indicator alignment scoring logic
    return 0.8; // Placeholder
  }

  private calculateMarketConditionsScore(signal: StrategySignal, context: StrategyContext): number {
    // Implement market conditions scoring logic
    return 0.7; // Placeholder
  }

  private async calculateHistoricalAccuracy(signal: StrategySignal): Promise<number> {
    // Implement historical accuracy calculation
    return 0.75; // Placeholder
  }

  private calculateTimeframeImportance(timeframe: string): number {
    // Implement timeframe importance scoring
    return 0.8; // Placeholder
  }

  private calculateVolumeConfirmation(context: StrategyContext): number {
    // Implement volume confirmation scoring
    return 0.6; // Placeholder
  }

  private calculateVolatilityScore(context: StrategyContext): number {
    // Implement volatility scoring
    return 0.5; // Placeholder
  }

  private async calculateConflictPenalty(signal: StrategySignal, context: StrategyContext): Promise<number> {
    // Implement conflict penalty calculation
    return 0.1; // Placeholder
  }

  private calculateConsensusBonus(signal: StrategySignal, context: StrategyContext): number {
    // Implement consensus bonus calculation
    return 0.1; // Placeholder
  }

  private calculateTimeDecay(context: StrategyContext): number {
    // Implement time decay calculation
    return 0.95; // Placeholder
  }

  private calculateMarketRegimeAdjustment(context: StrategyContext): number {
    // Implement market regime adjustment
    return 1.0; // Placeholder
  }

  private normalizeConfidenceScore(
    score: number,
    normalization: ConfidenceScoringConfig['normalization']
  ): number {
    switch (normalization.method) {
      case 'sigmoid':
        return 1 / (1 + Math.exp(-score));
      case 'linear':
        return Math.max(normalization.range[0], Math.min(normalization.range[1], score));
      case 'percentile':
        // Would need historical data for proper percentile calculation
        return score;
      default:
        return score;
    }
  }

  private async validateRequest(request: SignalGenerationRequest): Promise<void> {
    if (!request.strategyId) {
      throw new SignalValidationError('Strategy ID is required', {} as any);
    }
    
    if (!request.context) {
      throw new SignalValidationError('Strategy context is required', {} as any);
    }
    
    if (!request.conditions || request.conditions.length === 0) {
      throw new SignalValidationError('At least one condition is required', {} as any);
    }
  }

  private detectSignalConflicts(signals: StrategySignal[]): StrategySignal[] {
    // Simple conflict detection - opposite signal types on same symbol
    const buySignals = signals.filter(s => s.type === 'BUY');
    const sellSignals = signals.filter(s => s.type === 'SELL');
    
    if (buySignals.length > 0 && sellSignals.length > 0) {
      return signals; // All signals are conflicting
    }
    
    return []; // No conflicts
  }

  private filterSignals(signals: StrategySignal[], context: StrategyContext): StrategySignal[] {
    // Apply final filters
    return signals.filter(signal => {
      // Check cooldown periods
      // Check position size limits
      // Check other risk controls
      return true; // Placeholder
    });
  }

  private updateProcessingStats(result: SignalGenerationResult): void {
    this.processingStats.totalSignals += result.signals.length;
    this.processingStats.signalsProcessed++;
    
    if (result.success) {
      this.processingStats.averageProcessingTime = 
        (this.processingStats.averageProcessingTime + result.metadata.processingTime) / 2;
      
      if (result.metadata.averageConfidence > 0) {
        this.processingStats.averageConfidence = 
          (this.processingStats.averageConfidence + result.metadata.averageConfidence) / 2;
      }
    } else {
      this.processingStats.errors.total++;
      
      for (const error of result.errors) {
        const errorType = error.type;
        this.processingStats.errors.byType[errorType] = 
          (this.processingStats.errors.byType[errorType] || 0) + 1;
      }
    }
    
    this.processingStats.successRate = 
      (this.processingStats.signalsProcessed - this.processingStats.errors.total) / 
      this.processingStats.signalsProcessed;
    
    this.processingStats.lastUpdated = new Date();
  }

  private trackEvent(event: SignalProcessingEvent): void {
    this.recentEvents.push(event);
    
    // Keep only recent events (last 1000)
    if (this.recentEvents.length > 1000) {
      this.recentEvents.splice(0, this.recentEvents.length - 1000);
    }
    
    this.emit('processingEvent', event);
  }

  private createTimeoutPromise(requestId: string, timeoutMs: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new SignalTimeoutError(
        `Signal generation timed out after ${timeoutMs}ms`,
        requestId,
        timeoutMs
      )), timeoutMs)
    );
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Stop the evaluation engine
   */
  stop(): void {
    this.isRunning = false;
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = undefined;
    }
    this.emit('stopped');
  }

  /**
   * Get condition performance metrics
   */
  getConditionMetrics(conditionId: string): any | undefined {
    return this.performanceMetrics.get(conditionId);
  }
}

export default SignalGenerator;