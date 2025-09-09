/**
 * Signal Generation System Types - Task BE-014
 * 
 * Comprehensive type definitions for the signal generation framework,
 * including signal processing, confidence scoring, and history tracking.
 */

import type { EventEmitter } from 'events';
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

/**
 * Signal Generation Pipeline Configuration
 */
export interface SignalGenerationConfig {
  // Core settings
  id: string;
  name: string;
  description?: string;
  version: string;
  
  // Processing settings
  enableRealTimeProcessing: boolean;
  processingInterval: number; // milliseconds
  batchSize: number;
  maxConcurrency: number;
  
  // Signal validation
  validation: {
    minConfidence: number; // 0-100
    maxSignalsPerInterval: number;
    duplicateDetection: boolean;
    conflictResolution: 'latest' | 'highest_confidence' | 'merge' | 'reject';
  };
  
  // History and persistence
  persistence: {
    enableHistory: boolean;
    maxHistorySize: number;
    retentionPeriodDays: number;
    compressionEnabled: boolean;
  };
  
  // Performance monitoring
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    alertThresholds: {
      lowConfidenceRate: number;
      highLatency: number;
      errorRate: number;
    };
  };
  
  // Risk controls
  riskControls: {
    maxRiskPerSignal: number; // percentage
    positionSizeLimits: {
      min: number;
      max: number;
    };
    cooldownPeriods: {
      sameSymbol: number; // seconds
      oppositeSignal: number; // seconds
    };
  };
}

/**
 * Signal Generation Request
 */
export interface SignalGenerationRequest {
  id: string;
  strategyId: string;
  context: StrategyContext;
  conditions: ConditionExpression[];
  
  // Request metadata
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  
  // Processing options
  options?: {
    forceGeneration?: boolean;
    skipValidation?: boolean;
    dryRun?: boolean;
  };
}

/**
 * Signal Generation Result
 */
export interface SignalGenerationResult {
  requestId: string;
  success: boolean;
  
  // Generated signals
  signals: StrategySignal[];
  
  // Processing metadata
  metadata: {
    processingTime: number; // milliseconds
    conditionsEvaluated: number;
    conditionsPassed: number;
    confidenceScores: number[];
    averageConfidence: number;
  };
  
  // Errors and warnings
  errors: Array<{
    type: 'validation' | 'processing' | 'timeout' | 'risk';
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  }>;
  
  warnings: Array<{
    type: 'confidence' | 'conflict' | 'risk' | 'performance';
    message: string;
    signal?: StrategySignal;
  }>;
  
  timestamp: Date;
}

/**
 * Signal Confidence Scoring Configuration
 */
export interface ConfidenceScoringConfig {
  // Scoring method
  method: 'weighted' | 'consensus' | 'ml_based' | 'custom';
  
  // Weight factors
  weights: {
    conditionConfidence: number; // Base confidence from conditions
    indicatorAlignment: number; // Multiple indicators agreeing
    marketConditions: number; // Favorable market environment
    historicalAccuracy: number; // Past signal performance
    timeframe: number; // Signal timeframe importance
    volume: number; // Volume confirmation
    volatility: number; // Volatility considerations
  };
  
  // Scoring adjustments
  adjustments: {
    penalizeConflicts: boolean; // Reduce score for conflicting signals
    rewardConsensus: boolean; // Boost score when multiple conditions agree
    timeDecay: boolean; // Reduce score for older data
    marketRegimeAdjustment: boolean; // Adjust for market conditions
  };
  
  // Normalization
  normalization: {
    method: 'linear' | 'sigmoid' | 'percentile';
    range: [number, number]; // Target range for final scores
  };
}

/**
 * Signal History Entry
 */
export interface SignalHistoryEntry {
  id: string;
  signal: StrategySignal;
  
  // Generation context
  generationContext: {
    strategyId: string;
    conditionsUsed: string[];
    marketConditions: Record<string, unknown>;
    indicators: Record<string, number>;
  };
  
  // Lifecycle tracking
  lifecycle: {
    generated: Date;
    executed?: Date;
    expired?: Date;
    cancelled?: Date;
  };
  
  // Performance tracking
  performance?: {
    executed: boolean;
    outcome: 'profit' | 'loss' | 'breakeven' | 'pending';
    actualEntry?: number;
    actualExit?: number;
    pnl?: number;
    pnlPercent?: number;
    holdingPeriod?: number;
  };
  
  // Metadata
  metadata: Record<string, unknown>;
}

/**
 * Signal Processing Statistics
 */
export interface SignalProcessingStats {
  // Volume metrics
  totalSignals: number;
  signalsProcessed: number;
  signalsExecuted: number;
  signalsExpired: number;
  signalsCancelled: number;
  
  // Performance metrics
  averageProcessingTime: number;
  averageConfidence: number;
  successRate: number;
  
  // By signal type
  byType: Record<StrategySignalType, {
    count: number;
    averageConfidence: number;
    successRate: number;
  }>;
  
  // By time period
  hourly: Array<{
    hour: number;
    count: number;
    averageConfidence: number;
  }>;
  
  daily: Array<{
    date: string;
    count: number;
    successRate: number;
  }>;
  
  // Error statistics
  errors: {
    total: number;
    byType: Record<string, number>;
    recent: Array<{
      timestamp: Date;
      type: string;
      message: string;
    }>;
  };
  
  lastUpdated: Date;
}

/**
 * Real-Time Signal Processing Event
 */
export interface SignalProcessingEvent {
  type: 'signal_generated' | 'signal_validated' | 'signal_executed' | 'signal_expired' | 'error' | 'warning';
  timestamp: Date;
  
  // Event data
  signal?: StrategySignal;
  request?: SignalGenerationRequest;
  result?: SignalGenerationResult;
  error?: Error;
  
  // Context
  strategyId: string;
  symbol?: string;
  
  metadata: Record<string, unknown>;
}

/**
 * Signal Validation Rules
 */
export interface SignalValidationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Rule type
  type: 'confidence' | 'risk' | 'timing' | 'market' | 'position' | 'custom';
  
  // Rule parameters
  parameters: Record<string, unknown>;
  
  // Execution
  validate: (signal: StrategySignal, context: StrategyContext) => Promise<{
    valid: boolean;
    score: number; // 0-100
    message?: string;
    adjustments?: Partial<StrategySignal>;
  }>;
}

/**
 * Signal Conflict Resolution Strategy
 */
export interface SignalConflictResolver {
  name: string;
  description: string;
  
  resolve: (
    conflicts: StrategySignal[],
    context: StrategyContext
  ) => Promise<{
    resolved: StrategySignal[];
    rejected: Array<{
      signal: StrategySignal;
      reason: string;
    }>;
  }>;
}

/**
 * Signal Enhancement Plugin
 */
export interface SignalEnhancementPlugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  
  // Plugin lifecycle
  initialize?: (config: Record<string, unknown>) => Promise<void>;
  enhance: (
    signal: StrategySignal,
    context: StrategyContext
  ) => Promise<Partial<StrategySignal>>;
  cleanup?: () => Promise<void>;
}

/**
 * Signal Generator Interface
 */
export interface ISignalGenerator extends EventEmitter {
  // Core methods
  generateSignals(request: SignalGenerationRequest): Promise<SignalGenerationResult>;
  
  // Configuration
  getConfig(): SignalGenerationConfig;
  updateConfig(config: Partial<SignalGenerationConfig>): Promise<void>;
  
  // History management
  getSignalHistory(strategyId: string, options?: {
    from?: Date;
    to?: Date;
    limit?: number;
    type?: StrategySignalType;
  }): Promise<SignalHistoryEntry[]>;
  
  // Statistics
  getProcessingStats(period?: 'hour' | 'day' | 'week' | 'month'): Promise<SignalProcessingStats>;
  
  // Real-time processing
  startRealTimeProcessing(): Promise<void>;
  stopRealTimeProcessing(): Promise<void>;
  
  // Health and monitoring
  getHealthStatus(): Promise<{
    healthy: boolean;
    score: number;
    issues: string[];
  }>;
}

/**
 * Signal Generation Errors
 */
export class SignalGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public strategyId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SignalGenerationError';
  }
}

export class SignalValidationError extends SignalGenerationError {
  constructor(
    message: string,
    public signal: StrategySignal,
    public rule?: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'SignalValidationError';
  }
}

export class SignalConflictError extends SignalGenerationError {
  constructor(
    message: string,
    public conflictingSignals: StrategySignal[]
  ) {
    super(message, 'CONFLICT_ERROR');
    this.name = 'SignalConflictError';
  }
}

export class SignalTimeoutError extends SignalGenerationError {
  constructor(
    message: string,
    public requestId: string,
    public timeoutMs: number
  ) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'SignalTimeoutError';
  }
}