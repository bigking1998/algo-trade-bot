/**
 * Condition Evaluation Engine Types - Task BE-013
 * 
 * Comprehensive type definitions for the condition evaluation system that enables
 * sophisticated signal generation for trading strategies with support for:
 * - Logical operators with precedence handling
 * - Comparison operators with type validation  
 * - Mathematical operators with function support
 * - Cross-over detection algorithms
 * - Pattern recognition and time-based conditions
 */

import type { IndicatorResult } from '../indicators/base/types.js';

// =============================================================================
// CORE CONDITION TYPES
// =============================================================================

export type ConditionValue = number | string | boolean | null | undefined;
export type ConditionArray = ConditionValue[];

export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR', 
  NOT = 'NOT',
  XOR = 'XOR'
}

export enum ComparisonOperator {
  GREATER_THAN = 'GT',
  GREATER_THAN_EQUAL = 'GTE',
  LESS_THAN = 'LT',
  LESS_THAN_EQUAL = 'LTE',
  EQUAL = 'EQ',
  NOT_EQUAL = 'NEQ'
}

export enum MathematicalOperator {
  ADD = 'ADD',
  SUBTRACT = 'SUB',
  MULTIPLY = 'MUL',
  DIVIDE = 'DIV',
  MODULO = 'MOD',
  POWER = 'POW'
}

export enum CrossOverType {
  GOLDEN_CROSS = 'GOLDEN_CROSS',
  DEATH_CROSS = 'DEATH_CROSS',
  PRICE_ABOVE = 'PRICE_ABOVE',
  PRICE_BELOW = 'PRICE_BELOW',
  INDICATOR_CROSS_UP = 'INDICATOR_CROSS_UP',
  INDICATOR_CROSS_DOWN = 'INDICATOR_CROSS_DOWN',
  BREAKOUT_UP = 'BREAKOUT_UP',
  BREAKOUT_DOWN = 'BREAKOUT_DOWN'
}

export enum PatternType {
  HIGHER_HIGHS = 'HIGHER_HIGHS',
  LOWER_LOWS = 'LOWER_LOWS',
  DOUBLE_TOP = 'DOUBLE_TOP',
  DOUBLE_BOTTOM = 'DOUBLE_BOTTOM',
  HEAD_SHOULDERS = 'HEAD_SHOULDERS',
  INVERSE_HEAD_SHOULDERS = 'INVERSE_HEAD_SHOULDERS',
  ASCENDING_TRIANGLE = 'ASCENDING_TRIANGLE',
  DESCENDING_TRIANGLE = 'DESCENDING_TRIANGLE',
  SYMMETRICAL_TRIANGLE = 'SYMMETRICAL_TRIANGLE'
}

// =============================================================================
// CONDITION DEFINITION INTERFACES
// =============================================================================

export interface BaseCondition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  weight: number; // 0-1, for weighted conditions
  tags: string[];
  metadata: Record<string, any>;
  created: Date;
  updated: Date;
}

export interface LogicalCondition extends BaseCondition {
  type: 'logical';
  operator: LogicalOperator;
  conditions: ConditionExpression[];
  shortCircuit: boolean; // Enable short-circuit evaluation
}

export interface ComparisonCondition extends BaseCondition {
  type: 'comparison';
  operator: ComparisonOperator;
  left: ValueExpression;
  right: ValueExpression;
  tolerance?: number; // For floating point comparisons
}

export interface MathematicalCondition extends BaseCondition {
  type: 'mathematical';
  operator: MathematicalOperator;
  operands: ValueExpression[];
  resultVariable?: string; // Store result for later use
}

export interface CrossOverCondition extends BaseCondition {
  type: 'crossover';
  crossOverType: CrossOverType;
  source: ValueExpression; // Primary data source
  reference: ValueExpression; // Reference line/value
  lookbackPeriods: number; // How many periods to look back
  confirmationPeriods: number; // Periods required for confirmation
  minimumThreshold?: number; // Minimum crossover magnitude
}

export interface PatternCondition extends BaseCondition {
  type: 'pattern';
  patternType: PatternType;
  source: ValueExpression;
  lookbackPeriods: number;
  confidence: number; // 0-1, minimum confidence required
  parameters: Record<string, any>; // Pattern-specific parameters
}

export interface TimeBasedCondition extends BaseCondition {
  type: 'time';
  timeframe: string; // '1m', '5m', '1h', etc.
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  timezone: string;
  condition: ConditionExpression; // Nested condition to evaluate
}

export interface CustomCondition extends BaseCondition {
  type: 'custom';
  functionCode: string; // JavaScript function code
  parameters: Record<string, any>;
  sandbox: boolean; // Run in sandboxed environment
  timeout: number; // Execution timeout in ms
}

export type ConditionExpression = 
  | LogicalCondition
  | ComparisonCondition  
  | MathematicalCondition
  | CrossOverCondition
  | PatternCondition
  | TimeBasedCondition
  | CustomCondition;

// =============================================================================
// VALUE EXPRESSION INTERFACES
// =============================================================================

export interface LiteralValue {
  type: 'literal';
  value: ConditionValue;
  dataType: 'number' | 'string' | 'boolean';
}

export interface IndicatorValue {
  type: 'indicator';
  indicatorId: string;
  field: string; // e.g., 'value', 'signal', 'upper', 'lower'
  offset: number; // Lookback offset, 0 = current, 1 = previous, etc.
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'first' | 'last';
  aggregationPeriods?: number;
}

export interface MarketDataValue {
  type: 'market';
  field: 'open' | 'high' | 'low' | 'close' | 'volume';
  offset: number; // Lookback offset
  symbol?: string; // If different from current symbol
  timeframe?: string; // If different from current timeframe
}

export interface CalculatedValue {
  type: 'calculated';
  expression: MathematicalCondition;
  cache: boolean; // Cache calculated result
  cacheKey?: string;
}

export interface VariableValue {
  type: 'variable';
  name: string;
  scope: 'session' | 'strategy' | 'global';
  defaultValue?: ConditionValue;
}

export interface FunctionValue {
  type: 'function';
  name: string; // Built-in function name
  parameters: ValueExpression[];
  returnType: 'number' | 'string' | 'boolean' | 'array';
}

export type ValueExpression = 
  | LiteralValue
  | IndicatorValue
  | MarketDataValue  
  | CalculatedValue
  | VariableValue
  | FunctionValue;

// =============================================================================
// EVALUATION CONTEXT AND RESULTS
// =============================================================================

export interface EvaluationContext {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  
  // Market data window
  marketData: {
    current: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };
    history: Array<{
      timestamp: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    windowSize: number; // Number of historical periods available
  };
  
  // Indicator results
  indicators: Map<string, IndicatorResult<any>>;
  
  // Variables and state
  variables: Map<string, ConditionValue>;
  sessionData: Map<string, any>;
  strategyData: Map<string, any>;
  
  // Execution metadata
  executionId: string;
  strategyId: string;
  
  // Performance tracking
  startTime: number;
  maxExecutionTime: number; // ms
}

export interface ConditionEvaluationResult {
  conditionId: string;
  success: boolean;
  value: ConditionValue;
  confidence: number; // 0-1
  executionTime: number; // ms
  error?: ConditionEvaluationError;
  
  // Detailed evaluation info
  details: {
    type: string;
    operator?: string;
    operands?: ConditionValue[];
    intermediate: ConditionValue[];
    shortCircuited: boolean;
    fromCache: boolean;
  };
  
  // Context for debugging
  context: {
    timestamp: Date;
    symbol: string;
    timeframe: string;
  };
}

export interface BatchEvaluationResult {
  requestId: string;
  success: boolean;
  results: Map<string, ConditionEvaluationResult>;
  errors: Map<string, ConditionEvaluationError>;
  
  metadata: {
    totalConditions: number;
    successfulEvaluations: number;
    failedEvaluations: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    cacheHits: number;
    shortCircuits: number;
  };
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class ConditionEvaluationError extends Error {
  constructor(
    message: string,
    public readonly conditionId: string,
    public readonly code: string,
    public readonly context: Partial<EvaluationContext>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConditionEvaluationError';
  }
}

export class ConditionValidationError extends Error {
  constructor(
    message: string,
    public readonly conditionId: string,
    public readonly validationErrors: string[]
  ) {
    super(message);
    this.name = 'ConditionValidationError';
  }
}

export class ConditionTimeoutError extends Error {
  constructor(
    message: string,
    public readonly conditionId: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'ConditionTimeoutError';
  }
}

// =============================================================================
// CONFIGURATION AND TEMPLATES
// =============================================================================

export interface ConditionEngineConfig {
  // Execution settings
  execution: {
    defaultTimeout: number; // ms
    maxConcurrency: number;
    enableShortCircuit: boolean;
    enableCaching: boolean;
  };
  
  // Validation settings
  validation: {
    strictTypeChecking: boolean;
    allowedFunctions: string[];
    maxNestingDepth: number;
    maxComplexity: number;
  };
  
  // Performance settings
  performance: {
    enableProfiling: boolean;
    slowExecutionThreshold: number; // ms
    maxMemoryUsage: number; // bytes
  };
  
  // Cross-over detection
  crossover: {
    defaultLookbackPeriods: number;
    defaultConfirmationPeriods: number;
    minimumDataPoints: number;
    tolerancePercent: number;
  };
  
  // Pattern recognition
  patterns: {
    enableAdvancedPatterns: boolean;
    defaultConfidence: number;
    maxPatternLength: number;
  };
  
  // Caching
  cache: {
    enabled: boolean;
    maxSize: number; // number of entries
    ttlSeconds: number;
    compressionEnabled: boolean;
  };
}

export interface ConditionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  
  // Template definition
  template: ConditionExpression;
  parameters: Array<{
    name: string;
    type: 'number' | 'string' | 'boolean' | 'array';
    description: string;
    required: boolean;
    defaultValue?: any;
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
      options?: any[];
    };
  }>;
  
  // Metadata
  author: string;
  created: Date;
  updated: Date;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  
  // Usage examples
  examples: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
    expectedResult: boolean;
    marketCondition: string;
  }>;
}

// =============================================================================
// BUILT-IN FUNCTIONS
// =============================================================================

export interface BuiltInFunction {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: 'number' | 'string' | 'boolean' | 'array';
    required: boolean;
    description: string;
  }>;
  returnType: 'number' | 'string' | 'boolean' | 'array';
  category: 'math' | 'statistical' | 'logical' | 'string' | 'array' | 'time' | 'technical';
  implementation: (...args: any[]) => any;
  examples: Array<{
    input: any[];
    output: any;
    description: string;
  }>;
}

export type BuiltInFunctions = Map<string, BuiltInFunction>;

// =============================================================================
// PERFORMANCE AND MONITORING
// =============================================================================

export interface ConditionPerformanceMetrics {
  conditionId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  cacheHitRate: number;
  shortCircuitRate: number;
  lastExecuted: Date;
  memoryUsage: number; // bytes
}

export interface EnginePerformanceSnapshot {
  timestamp: Date;
  totalConditions: number;
  activeEvaluations: number;
  queuedEvaluations: number;
  
  performance: {
    evaluationsPerSecond: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    successRate: number;
  };
  
  resource: {
    memoryUsage: number;
    cpuUsage: number;
    cacheSize: number;
    cacheHitRate: number;
  };
  
  errors: {
    totalErrors: number;
    errorRate: number;
    commonErrors: Array<{
      code: string;
      count: number;
      percentage: number;
    }>;
  };
}

export default {
  LogicalOperator,
  ComparisonOperator,
  MathematicalOperator,
  CrossOverType,
  PatternType,
  ConditionEvaluationError,
  ConditionValidationError,
  ConditionTimeoutError
};