/**
 * Technical Indicators Core Types - Task BE-010
 * 
 * Core type definitions for the technical indicators library,
 * including OHLCV data structures, indicator results, and configuration options.
 */

/**
 * OHLCV candlestick data structure
 */
export interface OHLCV {
  /** Timestamp of the candle */
  time: Date;
  /** Opening price */
  open: number;
  /** Highest price during the period */
  high: number;
  /** Lowest price during the period */
  low: number;
  /** Closing price */
  close: number;
  /** Trading volume */
  volume: number;
  /** Symbol/trading pair */
  symbol?: string;
  /** Timeframe of the candle */
  timeframe?: string;
  /** Number of trades in the period */
  trades?: number;
  /** Quote volume (volume * price) */
  quoteVolume?: number;
}

/**
 * Indicator calculation result
 */
export interface IndicatorResult<T = number | number[]> {
  /** The calculated value(s) */
  value: T;
  /** Timestamp of the calculation */
  timestamp: Date;
  /** Whether the indicator has enough data to be considered valid */
  isValid: boolean;
  /** Confidence level of the calculation (0-1) */
  confidence?: number;
  /** Additional metadata specific to the indicator */
  metadata?: Record<string, any>;
}

/**
 * Multi-value indicator result for indicators that return multiple values
 */
export interface MultiValueResult extends IndicatorResult<number[]> {
  /** Labels for each value in the array */
  labels: string[];
}

/**
 * Bollinger Bands specific result
 */
export interface BollingerBandsResult extends IndicatorResult<{
  upper: number;
  middle: number;
  lower: number;
}> {}

/**
 * MACD specific result
 */
export interface MACDResult extends IndicatorResult<{
  macd: number;
  signal: number;
  histogram: number;
}> {}

/**
 * Stochastic specific result
 */
export interface StochasticResult extends IndicatorResult<{
  k: number;
  d: number;
}> {}

/**
 * Indicator configuration options
 */
export interface IndicatorConfig {
  /** Primary period for the indicator */
  period: number;
  /** Secondary period (if applicable) */
  period2?: number;
  /** Smoothing parameter */
  smoothing?: number;
  /** Standard deviation multiplier */
  stdDevMultiplier?: number;
  /** Whether to use exponential smoothing */
  exponential?: boolean;
  /** Custom parameters specific to the indicator */
  params?: Record<string, number>;
}

/**
 * Indicator validation rules
 */
export interface ValidationRules {
  /** Minimum number of data points required */
  minDataPoints: number;
  /** Maximum period allowed */
  maxPeriod?: number;
  /** Whether to validate OHLCV integrity */
  validateOHLCV: boolean;
  /** Custom validation function */
  customValidator?: (data: OHLCV[]) => string | null;
}

/**
 * Performance metrics for indicator calculations
 */
export interface PerformanceMetrics {
  /** Calculation time in milliseconds */
  calculationTimeMs: number;
  /** Memory usage in bytes */
  memoryUsageBytes: number;
  /** Number of data points processed */
  dataPointsProcessed: number;
  /** Average time per data point */
  avgTimePerPoint: number;
  /** Cache hit rate (0-1) */
  cacheHitRate?: number;
}

/**
 * Circular buffer for efficient memory management
 */
export interface CircularBuffer<T> {
  /** Add new value to buffer */
  push(value: T): void;
  /** Get value at specific index (0 = most recent) */
  get(index: number): T | undefined;
  /** Get all values in chronological order */
  getAll(): T[];
  /** Get buffer size */
  size(): number;
  /** Get maximum capacity */
  capacity(): number;
  /** Clear all values */
  clear(): void;
  /** Check if buffer is full */
  isFull(): boolean;
  /** Get the most recent value */
  latest(): T | undefined;
  /** Get the oldest value */
  oldest(): T | undefined;
}

/**
 * Streaming calculation context
 */
export interface StreamingContext {
  /** Whether this is an incremental update */
  isIncremental: boolean;
  /** Previous calculation result for optimization */
  previousResult?: IndicatorResult;
  /** Streaming buffer state */
  bufferState?: Record<string, any>;
  /** Performance tracking */
  performanceMetrics?: PerformanceMetrics;
}

/**
 * Indicator error types
 */
export class IndicatorError extends Error {
  constructor(
    message: string,
    public readonly indicatorName: string,
    public readonly code: string = 'INDICATOR_ERROR'
  ) {
    super(message);
    this.name = 'IndicatorError';
  }
}

export class InsufficientDataError extends IndicatorError {
  constructor(indicatorName: string, required: number, actual: number) {
    super(
      `Insufficient data for ${indicatorName}: required ${required}, got ${actual}`,
      indicatorName,
      'INSUFFICIENT_DATA'
    );
    this.name = 'InsufficientDataError';
  }
}

export class InvalidParameterError extends IndicatorError {
  constructor(indicatorName: string, parameterName: string, value: any, reason: string) {
    super(
      `Invalid parameter '${parameterName}' for ${indicatorName}: ${reason} (got: ${value})`,
      indicatorName,
      'INVALID_PARAMETER'
    );
    this.name = 'InvalidParameterError';
  }
}

export class CalculationError extends IndicatorError {
  constructor(indicatorName: string, reason: string, originalError?: Error) {
    super(
      `Calculation failed for ${indicatorName}: ${reason}`,
      indicatorName,
      'CALCULATION_ERROR'
    );
    this.name = 'CalculationError';
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Indicator status enumeration
 */
export enum IndicatorStatus {
  /** Not enough data to calculate */
  INSUFFICIENT_DATA = 'insufficient_data',
  /** Ready to calculate */
  READY = 'ready',
  /** Calculation in progress */
  CALCULATING = 'calculating',
  /** Calculation completed successfully */
  COMPLETED = 'completed',
  /** Error occurred during calculation */
  ERROR = 'error'
}

/**
 * Mathematical utilities interface
 */
export interface MathUtils {
  /** Calculate simple moving average */
  sma(values: number[], period: number): number;
  /** Calculate exponential moving average */
  ema(values: number[], period: number, smoothing?: number): number;
  /** Calculate standard deviation */
  stdDev(values: number[]): number;
  /** Calculate variance */
  variance(values: number[]): number;
  /** Calculate correlation coefficient */
  correlation(x: number[], y: number[]): number;
  /** Calculate linear regression */
  linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number; };
  /** Calculate Bollinger Bands */
  bollingerBands(prices: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number; };
  /** Calculate True Range */
  trueRange(high: number, low: number, prevClose: number): number;
  /** Calculate Typical Price */
  typicalPrice(high: number, low: number, close: number): number;
  /** Calculate Money Flow */
  moneyFlow(high: number, low: number, close: number, volume: number): number;
}