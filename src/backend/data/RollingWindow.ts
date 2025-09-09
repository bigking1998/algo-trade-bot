/**
 * Rolling Window Utilities - Task BE-008: Strategy Data Structures
 * 
 * High-performance rolling window implementations for technical analysis
 * calculations. Optimized for real-time streaming data with efficient
 * window operations and mathematical functions.
 * 
 * Performance Targets:
 * - Window operations: O(1) for add/remove
 * - Calculation speed: >10,000 operations/second
 * - Memory efficiency: minimal allocation overhead
 */

import { NumericCircularBuffer } from '../indicators/base/CircularBuffer.js';

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export interface WindowStatistics {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  variance: number;
  standardDeviation: number;
}

export interface WindowConfiguration {
  size: number;
  precompute?: boolean; // Pre-compute statistics for performance
  trackExtremes?: boolean; // Track min/max for range calculations
  enableStatistics?: boolean; // Enable statistical calculations
}

export interface RollingWindowOperation<T, R> {
  (values: T[]): R;
}

// =============================================================================
// ROLLING WINDOW BASE CLASS
// =============================================================================

/**
 * Generic rolling window with efficient operations
 */
export abstract class RollingWindowBase<T> {
  protected buffer: T[];
  protected head = 0;
  protected count = 0;
  protected readonly maxSize: number;
  protected isFullOnce = false;

  constructor(size: number) {
    if (size <= 0) {
      throw new Error('Rolling window size must be positive');
    }
    this.maxSize = size;
    this.buffer = new Array(size);
  }

  /**
   * Add new value to the window
   */
  add(value: T): T | undefined {
    const evicted = this.isFullOnce ? this.buffer[this.head] : undefined;
    
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.maxSize;
    
    if (this.count < this.maxSize) {
      this.count++;
    } else {
      this.isFullOnce = true;
    }

    this.onValueAdded(value, evicted);
    return evicted;
  }

  /**
   * Get current values in chronological order
   */
  getValues(): T[] {
    if (this.count === 0) return [];
    
    const result: T[] = [];
    const start = this.isFullOnce ? this.head : 0;
    
    for (let i = 0; i < this.count; i++) {
      const index = (start + i) % this.maxSize;
      result.push(this.buffer[index]);
    }
    
    return result;
  }

  /**
   * Get latest value
   */
  latest(): T | undefined {
    if (this.count === 0) return undefined;
    const index = (this.head - 1 + this.maxSize) % this.maxSize;
    return this.buffer[index];
  }

  /**
   * Get oldest value
   */
  oldest(): T | undefined {
    if (this.count === 0) return undefined;
    const index = this.isFullOnce ? this.head : 0;
    return this.buffer[index];
  }

  /**
   * Check if window is full
   */
  isFull(): boolean {
    return this.count === this.maxSize;
  }

  /**
   * Get current window size
   */
  size(): number {
    return this.count;
  }

  /**
   * Get maximum window capacity
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Clear the window
   */
  clear(): void {
    this.buffer.fill(undefined as any);
    this.head = 0;
    this.count = 0;
    this.isFullOnce = false;
    this.onCleared();
  }

  /**
   * Check if window is empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  // Abstract methods for subclass customization
  protected abstract onValueAdded(newValue: T, evictedValue?: T): void;
  protected abstract onCleared(): void;
}

// =============================================================================
// NUMERIC ROLLING WINDOW WITH STATISTICS
// =============================================================================

/**
 * Optimized rolling window for numeric data with pre-computed statistics
 */
export class NumericRollingWindow extends RollingWindowBase<number> {
  private _sum = 0;
  private _min = Infinity;
  private _max = -Infinity;
  private _sumSquares = 0;
  private _sortedBuffer: number[] = []; // For median calculations
  private _dirty = false;

  private readonly enableStatistics: boolean;
  private readonly trackExtremes: boolean;
  private readonly precompute: boolean;

  constructor(size: number, config: Partial<WindowConfiguration> = {}) {
    super(size);
    this.enableStatistics = config.enableStatistics ?? true;
    this.trackExtremes = config.trackExtremes ?? true;
    this.precompute = config.precompute ?? true;
  }

  protected onValueAdded(newValue: number, evictedValue?: number): void {
    if (!this.enableStatistics) return;

    // Update sum
    this._sum += newValue;
    if (evictedValue !== undefined) {
      this._sum -= evictedValue;
    }

    // Update sum of squares for variance calculation
    this._sumSquares += newValue * newValue;
    if (evictedValue !== undefined) {
      this._sumSquares -= evictedValue * evictedValue;
    }

    // Update extremes if tracking enabled
    if (this.trackExtremes) {
      this.updateExtremes(newValue, evictedValue);
    }

    this._dirty = true;
  }

  protected onCleared(): void {
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
    this._sumSquares = 0;
    this._sortedBuffer = [];
    this._dirty = false;
  }

  private updateExtremes(newValue: number, evictedValue?: number): void {
    // Update max
    if (newValue > this._max) {
      this._max = newValue;
    }

    // Update min
    if (newValue < this._min) {
      this._min = newValue;
    }

    // If we evicted a value, check if we need to recalculate extremes
    if (evictedValue !== undefined) {
      if (evictedValue === this._max || evictedValue === this._min) {
        this.recalculateExtremes();
      }
    }
  }

  private recalculateExtremes(): void {
    if (this.count === 0) {
      this._min = Infinity;
      this._max = -Infinity;
      return;
    }

    const values = this.getValues();
    this._min = Math.min(...values);
    this._max = Math.max(...values);
  }

  // =============================================================================
  // STATISTICAL CALCULATIONS
  // =============================================================================

  /**
   * Get current sum (O(1))
   */
  sum(): number {
    return this._sum;
  }

  /**
   * Get arithmetic mean (O(1))
   */
  mean(): number {
    return this.count > 0 ? this._sum / this.count : 0;
  }

  /**
   * Get minimum value (O(1) if tracking enabled)
   */
  min(): number {
    if (!this.trackExtremes || this.count === 0) {
      const values = this.getValues();
      return values.length > 0 ? Math.min(...values) : NaN;
    }
    return this._min;
  }

  /**
   * Get maximum value (O(1) if tracking enabled)
   */
  max(): number {
    if (!this.trackExtremes || this.count === 0) {
      const values = this.getValues();
      return values.length > 0 ? Math.max(...values) : NaN;
    }
    return this._max;
  }

  /**
   * Get variance (O(1))
   */
  variance(): number {
    if (this.count < 2) return 0;
    
    const mean = this.mean();
    return (this._sumSquares - this.count * mean * mean) / (this.count - 1);
  }

  /**
   * Get standard deviation (O(1))
   */
  standardDeviation(): number {
    return Math.sqrt(this.variance());
  }

  /**
   * Get coefficient of variation
   */
  coefficientOfVariation(): number {
    const mean = this.mean();
    return mean !== 0 ? this.standardDeviation() / Math.abs(mean) : 0;
  }

  /**
   * Get range (max - min)
   */
  range(): number {
    return this.max() - this.min();
  }

  /**
   * Get median (O(n log n))
   */
  median(): number {
    const values = this.getValues().sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    
    if (values.length % 2 === 0) {
      return (values[mid - 1] + values[mid]) / 2;
    } else {
      return values[mid];
    }
  }

  /**
   * Get percentile (O(n log n))
   */
  percentile(p: number): number {
    if (p < 0 || p > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }

    const values = this.getValues().sort((a, b) => a - b);
    if (values.length === 0) return NaN;
    if (values.length === 1) return values[0];

    const index = (p / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return values[lower];
    }

    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  /**
   * Get all statistics in one call
   */
  getStatistics(): WindowStatistics {
    return {
      count: this.count,
      sum: this.sum(),
      mean: this.mean(),
      min: this.min(),
      max: this.max(),
      variance: this.variance(),
      standardDeviation: this.standardDeviation()
    };
  }

  // =============================================================================
  // TECHNICAL ANALYSIS FUNCTIONS
  // =============================================================================

  /**
   * Simple Moving Average (SMA)
   */
  sma(): number {
    return this.mean();
  }

  /**
   * Exponential Moving Average (EMA)
   */
  ema(alpha?: number): number {
    const values = this.getValues();
    if (values.length === 0) return NaN;
    if (values.length === 1) return values[0];

    const smoothing = alpha ?? (2 / (values.length + 1));
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = smoothing * values[i] + (1 - smoothing) * ema;
    }

    return ema;
  }

  /**
   * Relative Strength Index (RSI) calculation helper
   */
  rsiComponents(): { avgGain: number; avgLoss: number } {
    const values = this.getValues();
    if (values.length < 2) return { avgGain: 0, avgLoss: 0 };

    let gains = 0;
    let losses = 0;
    let gainCount = 0;
    let lossCount = 0;

    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      if (change > 0) {
        gains += change;
        gainCount++;
      } else if (change < 0) {
        losses += Math.abs(change);
        lossCount++;
      }
    }

    return {
      avgGain: gainCount > 0 ? gains / gainCount : 0,
      avgLoss: lossCount > 0 ? losses / lossCount : 0
    };
  }

  /**
   * True Range calculation (requires high, low, previous close)
   */
  trueRange(high: number, low: number, previousClose?: number): number {
    if (previousClose === undefined) {
      return high - low;
    }

    return Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose)
    );
  }

  /**
   * Linear regression slope
   */
  linearRegressionSlope(): number {
    const values = this.getValues();
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ..., n-1
    const sumY = this.sum();
    const sumXY = values.reduce((acc, val, idx) => acc + idx * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Bollinger Bands components
   */
  bollingerBands(multiplier: number = 2): { middle: number; upper: number; lower: number } {
    const middle = this.mean();
    const std = this.standardDeviation();

    return {
      middle,
      upper: middle + multiplier * std,
      lower: middle - multiplier * std
    };
  }
}

// =============================================================================
// SPECIALIZED ROLLING WINDOWS
// =============================================================================

/**
 * Rolling window optimized for OHLCV data
 */
export class OHLCVRollingWindow extends RollingWindowBase<{
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  private highWindow: NumericRollingWindow;
  private lowWindow: NumericRollingWindow;
  private closeWindow: NumericRollingWindow;
  private volumeWindow: NumericRollingWindow;

  constructor(size: number) {
    super(size);
    this.highWindow = new NumericRollingWindow(size);
    this.lowWindow = new NumericRollingWindow(size);
    this.closeWindow = new NumericRollingWindow(size);
    this.volumeWindow = new NumericRollingWindow(size);
  }

  protected onValueAdded(
    newValue: { open: number; high: number; low: number; close: number; volume: number },
    evictedValue?: { open: number; high: number; low: number; close: number; volume: number }
  ): void {
    this.highWindow.add(newValue.high);
    this.lowWindow.add(newValue.low);
    this.closeWindow.add(newValue.close);
    this.volumeWindow.add(newValue.volume);
  }

  protected onCleared(): void {
    this.highWindow.clear();
    this.lowWindow.clear();
    this.closeWindow.clear();
    this.volumeWindow.clear();
  }

  /**
   * Get typical price window (HLC/3)
   */
  getTypicalPrices(): number[] {
    return this.getValues().map(candle => 
      (candle.high + candle.low + candle.close) / 3
    );
  }

  /**
   * Get closes as array
   */
  getCloses(): number[] {
    return this.getValues().map(candle => candle.close);
  }

  /**
   * Get highs as array
   */
  getHighs(): number[] {
    return this.getValues().map(candle => candle.high);
  }

  /**
   * Get lows as array
   */
  getLows(): number[] {
    return this.getValues().map(candle => candle.low);
  }

  /**
   * Get volumes as array
   */
  getVolumes(): number[] {
    return this.getValues().map(candle => candle.volume);
  }

  /**
   * Get highest high in window
   */
  highestHigh(): number {
    return this.highWindow.max();
  }

  /**
   * Get lowest low in window
   */
  lowestLow(): number {
    return this.lowWindow.max();
  }

  /**
   * Get average volume
   */
  averageVolume(): number {
    return this.volumeWindow.mean();
  }

  /**
   * Get true range values
   */
  getTrueRanges(): number[] {
    const values = this.getValues();
    const trueRanges: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (i === 0) {
        trueRanges.push(values[i].high - values[i].low);
      } else {
        const current = values[i];
        const previous = values[i - 1];
        const tr = Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        );
        trueRanges.push(tr);
      }
    }

    return trueRanges;
  }
}

/**
 * Multi-timeframe rolling window for different data frequencies
 */
export class MultiTimeframeRollingWindow {
  private windows: Map<string, NumericRollingWindow> = new Map();
  private timeframes: string[];

  constructor(timeframes: Array<{ name: string; size: number }>) {
    this.timeframes = timeframes.map(tf => tf.name);
    
    for (const tf of timeframes) {
      this.windows.set(tf.name, new NumericRollingWindow(tf.size));
    }
  }

  /**
   * Add value to all timeframes
   */
  addToAll(value: number): void {
    for (const window of Array.from(this.windows.values())) {
      window.add(value);
    }
  }

  /**
   * Add value to specific timeframe
   */
  addToTimeframe(timeframe: string, value: number): void {
    const window = this.windows.get(timeframe);
    if (!window) {
      throw new Error(`Unknown timeframe: ${timeframe}`);
    }
    window.add(value);
  }

  /**
   * Get window for specific timeframe
   */
  getWindow(timeframe: string): NumericRollingWindow | undefined {
    return this.windows.get(timeframe);
  }

  /**
   * Get all timeframe statistics
   */
  getAllStatistics(): Map<string, WindowStatistics> {
    const stats = new Map<string, WindowStatistics>();
    
    for (const [timeframe, window] of Array.from(this.windows.entries())) {
      stats.set(timeframe, window.getStatistics());
    }
    
    return stats;
  }

  /**
   * Clear all windows
   */
  clear(): void {
    for (const window of Array.from(this.windows.values())) {
      window.clear();
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a numeric rolling window with default configuration
 */
export function createNumericRollingWindow(
  size: number,
  config?: Partial<WindowConfiguration>
): NumericRollingWindow {
  return new NumericRollingWindow(size, config);
}

/**
 * Create an OHLCV rolling window
 */
export function createOHLCVRollingWindow(size: number): OHLCVRollingWindow {
  return new OHLCVRollingWindow(size);
}

/**
 * Create multi-timeframe rolling window
 */
export function createMultiTimeframeWindow(
  timeframes: Array<{ name: string; size: number }>
): MultiTimeframeRollingWindow {
  return new MultiTimeframeRollingWindow(timeframes);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Apply rolling operation to array of values
 */
export function applyRollingOperation<T, R>(
  values: T[],
  windowSize: number,
  operation: RollingWindowOperation<T, R>
): R[] {
  if (windowSize <= 0 || windowSize > values.length) {
    return [];
  }

  const results: R[] = [];
  
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    results.push(operation(window));
  }
  
  return results;
}

/**
 * Calculate rolling correlation between two series
 */
export function rollingCorrelation(
  seriesA: number[],
  seriesB: number[],
  windowSize: number
): number[] {
  if (seriesA.length !== seriesB.length) {
    throw new Error('Series must have equal length');
  }

  return applyRollingOperation(
    seriesA.map((val, idx) => ({ a: val, b: seriesB[idx] })),
    windowSize,
    (window) => {
      const n = window.length;
      const meanA = window.reduce((sum, pair) => sum + pair.a, 0) / n;
      const meanB = window.reduce((sum, pair) => sum + pair.b, 0) / n;
      
      let numerator = 0;
      let sumSquareA = 0;
      let sumSquareB = 0;
      
      for (const pair of window) {
        const devA = pair.a - meanA;
        const devB = pair.b - meanB;
        numerator += devA * devB;
        sumSquareA += devA * devA;
        sumSquareB += devB * devB;
      }
      
      const denominator = Math.sqrt(sumSquareA * sumSquareB);
      return denominator === 0 ? 0 : numerator / denominator;
    }
  );
}

/**
 * Calculate rolling beta (systematic risk) between asset and market
 */
export function rollingBeta(
  assetReturns: number[],
  marketReturns: number[],
  windowSize: number
): number[] {
  if (assetReturns.length !== marketReturns.length) {
    throw new Error('Return series must have equal length');
  }

  return applyRollingOperation(
    assetReturns.map((val, idx) => ({ asset: val, market: marketReturns[idx] })),
    windowSize,
    (window) => {
      const marketWindow = new NumericRollingWindow(windowSize);
      const assetWindow = new NumericRollingWindow(windowSize);
      
      for (const returns of window) {
        marketWindow.add(returns.market);
        assetWindow.add(returns.asset);
      }
      
      const marketVar = marketWindow.variance();
      if (marketVar === 0) return 0;
      
      // Calculate covariance
      const marketMean = marketWindow.mean();
      const assetMean = assetWindow.mean();
      
      let covariance = 0;
      for (const returns of window) {
        covariance += (returns.asset - assetMean) * (returns.market - marketMean);
      }
      covariance /= (window.length - 1);
      
      return covariance / marketVar;
    }
  );
}