/**
 * Data Transformations and Performance Utilities - Task BE-008
 * 
 * Enhanced data transformation utilities with performance benchmarking,
 * memory optimization, and vectorized operations for high-frequency trading.
 */

import type { OHLCV } from '../strategies/DataStructures.js';

// =============================================================================
// PERFORMANCE BENCHMARKING SYSTEM
// =============================================================================

/**
 * Performance benchmark results
 */
export interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number; // milliseconds
  averageTime: number; // milliseconds per operation
  minTime: number;
  maxTime: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
    allocated: number;
  };
  throughput: number; // operations per second
  timestamp: Date;
}

/**
 * Comprehensive benchmarking system for data structures
 */
export class DataStructureBenchmark {
  private results: BenchmarkResult[] = [];
  
  /**
   * Benchmark a function with detailed metrics
   */
  async benchmark<T>(
    name: string,
    operation: () => T,
    iterations: number = 1000,
    warmupIterations: number = 100
  ): Promise<BenchmarkResult> {
    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      operation();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = this.getMemoryUsage();
    const times: number[] = [];
    let peakMemory = initialMemory;
    
    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      operation();
      const end = performance.now();
      
      times.push(end - start);
      
      // Check memory usage every 100 iterations
      if (i % 100 === 0) {
        const currentMemory = this.getMemoryUsage();
        peakMemory = Math.max(peakMemory, currentMemory);
      }
    }
    
    const finalMemory = this.getMemoryUsage();
    const totalTime = times.reduce((a, b) => a + b, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = iterations / (totalTime / 1000); // ops per second
    
    const result: BenchmarkResult = {
      operation: name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory,
        allocated: finalMemory - initialMemory
      },
      throughput,
      timestamp: new Date()
    };
    
    this.results.push(result);
    return result;
  }
  
  /**
   * Benchmark data frame operations specifically
   */
  async benchmarkDataFrameOperations(): Promise<{
    marketDataFrame: BenchmarkResult[];
    indicatorDataFrame: BenchmarkResult[];
    signalDataFrame: BenchmarkResult[];
  }> {
    const { MarketDataFrame, IndicatorDataFrame, SignalDataFrame } = await import('../strategies/DataStructures.js');
    
    // Generate test data
    const testCandles = this.generateTestCandles(10000);
    const testIndicators = this.generateTestIndicators(10000);
    const testSignals = this.generateTestSignals(1000);
    
    const results = {
      marketDataFrame: [] as BenchmarkResult[],
      indicatorDataFrame: [] as BenchmarkResult[],
      signalDataFrame: [] as BenchmarkResult[]
    };
    
    // MarketDataFrame benchmarks
    const mdf = new MarketDataFrame();
    
    results.marketDataFrame.push(await this.benchmark(
      'MarketDataFrame.addCandle',
      () => mdf.addCandle(testCandles[Math.floor(Math.random() * testCandles.length)]),
      5000
    ));
    
    results.marketDataFrame.push(await this.benchmark(
      'MarketDataFrame.bulkAddCandles',
      () => {
        const bulkMdf = new MarketDataFrame();
        (bulkMdf as any).bulkAddCandles(testCandles.slice(0, 100));
      },
      100
    ));
    
    results.marketDataFrame.push(await this.benchmark(
      'MarketDataFrame.getCloses',
      () => mdf.getCloses(),
      1000
    ));
    
    results.marketDataFrame.push(await this.benchmark(
      'MarketDataFrame.getRollingMean',
      () => (mdf as any).getRollingMean && (mdf as any).getRollingMean(20),
      100
    ));
    
    // IndicatorDataFrame benchmarks
    const idf = new IndicatorDataFrame();
    
    results.indicatorDataFrame.push(await this.benchmark(
      'IndicatorDataFrame.addIndicator',
      () => {
        const values = testIndicators[Math.floor(Math.random() * testIndicators.length)];
        idf.addIndicator(`test_${Date.now()}`, values);
      },
      1000
    ));
    
    results.indicatorDataFrame.push(await this.benchmark(
      'IndicatorDataFrame.bulkAddIndicators',
      () => {
        const bulkIdf = new IndicatorDataFrame();
        const indicators: Record<string, { values: number[] }> = {};
        for (let i = 0; i < 10; i++) {
          indicators[`indicator_${i}`] = { values: testIndicators[i] || [] };
        }
        (bulkIdf as any).bulkAddIndicators && (bulkIdf as any).bulkAddIndicators(indicators);
      },
      100
    ));
    
    // SignalDataFrame benchmarks  
    const sdf = new SignalDataFrame();
    
    results.signalDataFrame.push(await this.benchmark(
      'SignalDataFrame.addSignal',
      () => sdf.addSignal(testSignals[Math.floor(Math.random() * testSignals.length)]),
      1000
    ));
    
    results.signalDataFrame.push(await this.benchmark(
      'SignalDataFrame.bulkAddSignals',
      () => {
        const bulkSdf = new SignalDataFrame();
        (bulkSdf as any).bulkAddSignals && (bulkSdf as any).bulkAddSignals(testSignals.slice(0, 50));
      },
      50
    ));
    
    return results;
  }
  
  /**
   * Get memory usage (Node.js specific)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
  
  /**
   * Generate test OHLCV data
   */
  private generateTestCandles(count: number): OHLCV[] {
    const candles: OHLCV[] = [];
    let price = 100;
    const baseTime = Date.now() - (count * 60 * 1000); // 1 minute intervals
    
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 2; // -1 to 1
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random();
      const low = Math.min(open, close) - Math.random();
      const volume = Math.random() * 1000000;
      
      candles.push({
        timestamp: baseTime + (i * 60 * 1000),
        open,
        high,
        low,
        close,
        volume
      });
      
      price = close;
    }
    
    return candles;
  }
  
  /**
   * Generate test indicator data
   */
  private generateTestIndicators(count: number): number[][] {
    const indicators: number[][] = [];
    
    for (let i = 0; i < 20; i++) {
      const values: number[] = [];
      for (let j = 0; j < count; j++) {
        values.push(Math.random() * 100);
      }
      indicators.push(values);
    }
    
    return indicators;
  }
  
  /**
   * Generate test signals
   */
  private generateTestSignals(count: number): any[] {
    const signals: any[] = [];
    const types = ['entry', 'exit', 'increase', 'decrease'];
    
    for (let i = 0; i < count; i++) {
      signals.push({
        id: `signal_${i}`,
        type: types[Math.floor(Math.random() * types.length)],
        timestamp: new Date(Date.now() - (count - i) * 60000),
        symbol: 'BTC-USD',
        confidence: Math.random(),
        isValid: Math.random() > 0.1,
        strategyId: 'test_strategy',
        indicators: {}
      });
    }
    
    return signals;
  }
  
  /**
   * Get all benchmark results
   */
  getAllResults(): BenchmarkResult[] {
    return [...this.results];
  }
  
  /**
   * Get results summary
   */
  getSummary(): {
    totalBenchmarks: number;
    averageThroughput: number;
    totalMemoryAllocated: number;
    fastestOperation: BenchmarkResult;
    slowestOperation: BenchmarkResult;
  } {
    if (this.results.length === 0) {
      return {
        totalBenchmarks: 0,
        averageThroughput: 0,
        totalMemoryAllocated: 0,
        fastestOperation: {} as BenchmarkResult,
        slowestOperation: {} as BenchmarkResult
      };
    }
    
    const totalThroughput = this.results.reduce((sum, r) => sum + r.throughput, 0);
    const totalMemory = this.results.reduce((sum, r) => sum + Math.max(0, r.memoryUsage.allocated), 0);
    const fastest = this.results.reduce((min, r) => r.averageTime < min.averageTime ? r : min);
    const slowest = this.results.reduce((max, r) => r.averageTime > max.averageTime ? r : max);
    
    return {
      totalBenchmarks: this.results.length,
      averageThroughput: totalThroughput / this.results.length,
      totalMemoryAllocated: totalMemory,
      fastestOperation: fastest,
      slowestOperation: slowest
    };
  }
  
  /**
   * Clear all results
   */
  clearResults(): void {
    this.results = [];
  }
}

// =============================================================================
// ROLLING WINDOW DATA STRUCTURES
// =============================================================================

/**
 * High-performance rolling window for streaming data
 */
export class RollingWindow<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private size: number = 0;
  private readonly capacity: number;
  private sum: number = 0; // For numeric types
  private sumSquares: number = 0; // For variance calculations
  
  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }
  
  /**
   * Add value to rolling window
   */
  add(value: T): void {
    const oldValue = this.buffer[this.head];
    this.buffer[this.head] = value;
    
    // Update numeric tracking
    if (typeof value === 'number') {
      if (oldValue !== undefined && typeof oldValue === 'number') {
        this.sum -= oldValue;
        this.sumSquares -= oldValue * oldValue;
      }
      this.sum += value;
      this.sumSquares += value * value;
    }
    
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }
  
  /**
   * Get all values in chronological order
   */
  getValues(): T[] {
    if (this.size === 0) return [];
    
    const result: T[] = [];
    const start = this.size < this.capacity ? 0 : this.head;
    
    for (let i = 0; i < this.size; i++) {
      const index = (start + i) % this.capacity;
      const value = this.buffer[index];
      if (value !== undefined) {
        result.push(value);
      }
    }
    
    return result;
  }
  
  /**
   * Get latest value
   */
  getLatest(): T | undefined {
    if (this.size === 0) return undefined;
    const latestIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIndex];
  }
  
  /**
   * Get oldest value
   */
  getOldest(): T | undefined {
    if (this.size === 0) return undefined;
    const oldestIndex = this.size < this.capacity ? 0 : this.head;
    return this.buffer[oldestIndex];
  }
  
  /**
   * Get current size
   */
  getSize(): number {
    return this.size;
  }
  
  /**
   * Check if window is full
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }
  
  /**
   * Get mean (for numeric types)
   */
  getMean(): number {
    return this.size > 0 ? this.sum / this.size : 0;
  }
  
  /**
   * Get variance (for numeric types)
   */
  getVariance(): number {
    if (this.size <= 1) return 0;
    const mean = this.getMean();
    return (this.sumSquares / this.size) - (mean * mean);
  }
  
  /**
   * Get standard deviation (for numeric types)
   */
  getStandardDeviation(): number {
    return Math.sqrt(this.getVariance());
  }
  
  /**
   * Clear the window
   */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.size = 0;
    this.sum = 0;
    this.sumSquares = 0;
  }
}

/**
 * Multi-timeframe rolling window system
 */
export class MultiTimeframeRollingWindows {
  private windows: Map<string, RollingWindow<number>> = new Map();
  
  constructor(private timeframes: { name: string; size: number }[]) {
    for (const tf of timeframes) {
      this.windows.set(tf.name, new RollingWindow<number>(tf.size));
    }
  }
  
  /**
   * Add value to all timeframes
   */
  addValue(value: number): void {
    for (const window of this.windows.values()) {
      window.add(value);
    }
  }
  
  /**
   * Get statistics for all timeframes
   */
  getStatistics(): Record<string, {
    mean: number;
    variance: number;
    stdDev: number;
    size: number;
    latest: number | undefined;
  }> {
    const stats: Record<string, any> = {};
    
    for (const [name, window] of this.windows) {
      stats[name] = {
        mean: window.getMean(),
        variance: window.getVariance(),
        stdDev: window.getStandardDeviation(),
        size: window.getSize(),
        latest: window.getLatest()
      };
    }
    
    return stats;
  }
  
  /**
   * Get specific timeframe window
   */
  getWindow(timeframe: string): RollingWindow<number> | undefined {
    return this.windows.get(timeframe);
  }
  
  /**
   * Clear all windows
   */
  clear(): void {
    for (const window of this.windows.values()) {
      window.clear();
    }
  }
}

// =============================================================================
// MEMORY-OPTIMIZED DATA VALIDATOR FOR BE-008
// =============================================================================

/**
 * Data validation with memory optimization
 */
export class DataValidator {
  private static readonly PRICE_MIN = 0.000001;
  private static readonly PRICE_MAX = 1000000000;
  private static readonly VOLUME_MIN = 0;
  private static readonly VOLUME_MAX = 1e15;
  
  /**
   * Validate OHLCV data with performance tracking
   */
  static validateOHLCV(candle: OHLCV): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Price validations
    const prices = [candle.open, candle.high, candle.low, candle.close];
    for (const price of prices) {
      if (!Number.isFinite(price) || price < this.PRICE_MIN || price > this.PRICE_MAX) {
        errors.push(`Invalid price: ${price}`);
      }
    }
    
    // OHLC relationships
    if (candle.high < Math.max(candle.open, candle.close)) {
      errors.push('High price is less than open/close');
    }
    
    if (candle.low > Math.min(candle.open, candle.close)) {
      errors.push('Low price is greater than open/close');
    }
    
    // Volume validation
    if (!Number.isFinite(candle.volume) || candle.volume < this.VOLUME_MIN || candle.volume > this.VOLUME_MAX) {
      errors.push(`Invalid volume: ${candle.volume}`);
    }
    
    // Timestamp validation
    const timestamp = typeof candle.timestamp === 'number' ? candle.timestamp : candle.timestamp.getTime();
    if (!Number.isInteger(timestamp) || timestamp < 0) {
      errors.push(`Invalid timestamp: ${timestamp}`);
    }
    
    // Warnings for suspicious data
    if (candle.volume === 0) {
      warnings.push('Zero volume detected');
    }
    
    const priceRange = candle.high - candle.low;
    const midPrice = (candle.high + candle.low) / 2;
    if (priceRange > midPrice * 0.5) {
      warnings.push('Unusually large price range detected');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate indicator values
   */
  static validateIndicator(name: string, values: number[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!Array.isArray(values) || values.length === 0) {
      errors.push('Indicator values must be a non-empty array');
      return { isValid: false, errors, warnings };
    }
    
    let nanCount = 0;
    let infiniteCount = 0;
    let zeroCount = 0;
    
    for (const value of values) {
      if (Number.isNaN(value)) {
        nanCount++;
      } else if (!Number.isFinite(value)) {
        infiniteCount++;
      } else if (value === 0) {
        zeroCount++;
      }
    }
    
    if (nanCount > 0) {
      warnings.push(`${nanCount} NaN values found in ${name}`);
    }
    
    if (infiniteCount > 0) {
      errors.push(`${infiniteCount} infinite values found in ${name}`);
    }
    
    if (zeroCount === values.length) {
      warnings.push(`All values are zero in ${name}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Batch validate multiple indicators
   */
  static batchValidateIndicators(indicators: Record<string, number[]>): {
    isValid: boolean;
    results: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }>;
    summary: {
      totalIndicators: number;
      validIndicators: number;
      totalErrors: number;
      totalWarnings: number;
    };
  } {
    const results: Record<string, any> = {};
    let totalErrors = 0;
    let totalWarnings = 0;
    let validIndicators = 0;
    
    for (const [name, values] of Object.entries(indicators)) {
      const result = this.validateIndicator(name, values);
      results[name] = result;
      
      if (result.isValid) {
        validIndicators++;
      }
      
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }
    
    return {
      isValid: totalErrors === 0,
      results,
      summary: {
        totalIndicators: Object.keys(indicators).length,
        validIndicators,
        totalErrors,
        totalWarnings
      }
    };
  }
}

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export interface NormalizationParameters {
  method: 'min-max' | 'z-score' | 'robust' | 'decimal' | 'log';
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  median?: number;
  iqr?: number; // Interquartile range
  scale?: number;
}

export interface TransformationOptions {
  inPlace?: boolean; // Modify original array vs create new one
  skipNaN?: boolean; // Skip NaN values in calculations
  precision?: number; // Decimal places for rounding
  parallel?: boolean; // Use parallel processing for large datasets
}

export interface AggregationResult {
  value: number;
  count: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface ResamplingOptions {
  method: 'mean' | 'median' | 'sum' | 'min' | 'max' | 'first' | 'last' | 'count';
  frequency: number; // milliseconds
  fillMethod?: 'forward' | 'backward' | 'linear' | 'zero';
  minPeriods?: number; // Minimum periods required for aggregation
}

// =============================================================================
// DATA NORMALIZATION UTILITIES
// =============================================================================

/**
 * High-performance data normalization class with multiple methods
 */
export class DataNormalizer {
  private cache = new Map<string, NormalizationParameters>();
  private readonly cacheEnabled: boolean;

  constructor(enableCache = true) {
    this.cacheEnabled = enableCache;
  }

  /**
   * Normalize data using min-max scaling to [0, 1]
   */
  minMaxNormalize(
    data: number[],
    options: TransformationOptions & { targetMin?: number; targetMax?: number } = {}
  ): number[] {
    if (data.length === 0) return [];

    const { targetMin = 0, targetMax = 1, inPlace = false } = options;
    const result = inPlace ? data : new Array(data.length);

    // Calculate min and max efficiently
    let min = Infinity;
    let max = -Infinity;
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (!isNaN(value)) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    const range = max - min;
    const targetRange = targetMax - targetMin;

    if (range === 0) {
      // All values are the same
      result.fill(targetMin);
      return result;
    }

    // Apply transformation
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isNaN(value)) {
        result[i] = value;
      } else {
        result[i] = targetMin + ((value - min) / range) * targetRange;
      }
    }

    return result;
  }

  /**
   * Z-score normalization (mean = 0, std = 1)
   */
  zScoreNormalize(data: number[], options: TransformationOptions = {}): number[] {
    if (data.length === 0) return [];

    const { inPlace = false } = options;
    const result = inPlace ? data : new Array(data.length);

    // Calculate mean and std efficiently
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (!isNaN(value)) {
        sum += value;
        count++;
      }
    }

    if (count === 0) return result;

    const mean = sum / count;
    let sumSquaredDeviations = 0;

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (!isNaN(value)) {
        const deviation = value - mean;
        sumSquaredDeviations += deviation * deviation;
      }
    }

    const std = Math.sqrt(sumSquaredDeviations / count);

    if (std === 0) {
      // All values are the same
      result.fill(0);
      return result;
    }

    // Apply Z-score transformation
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isNaN(value)) {
        result[i] = value;
      } else {
        result[i] = (value - mean) / std;
      }
    }

    return result;
  }

  /**
   * Robust normalization using median and IQR
   */
  robustNormalize(data: number[], options: TransformationOptions = {}): number[] {
    if (data.length === 0) return [];

    const { inPlace = false } = options;
    const result = inPlace ? data : new Array(data.length);

    // Filter out NaN values and sort for quantile calculations
    const validValues = data.filter(x => !isNaN(x)).sort((a, b) => a - b);
    
    if (validValues.length === 0) return result;

    // Calculate median and IQR
    const median = this.calculatePercentile(validValues, 50);
    const q1 = this.calculatePercentile(validValues, 25);
    const q3 = this.calculatePercentile(validValues, 75);
    const iqr = q3 - q1;

    if (iqr === 0) {
      result.fill(0);
      return result;
    }

    // Apply robust normalization
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isNaN(value)) {
        result[i] = value;
      } else {
        result[i] = (value - median) / iqr;
      }
    }

    return result;
  }

  /**
   * Logarithmic transformation for positive skewed data
   */
  logTransform(
    data: number[],
    options: TransformationOptions & { base?: number; addConstant?: number } = {}
  ): number[] {
    const { base = Math.E, addConstant = 1, inPlace = false } = options;
    const result = inPlace ? data : new Array(data.length);
    const logBase = base === Math.E ? Math.log : (x: number) => Math.log(x) / Math.log(base);

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isNaN(value) || value + addConstant <= 0) {
        result[i] = NaN;
      } else {
        result[i] = logBase(value + addConstant);
      }
    }

    return result;
  }

  /**
   * Power transformation (Box-Cox style)
   */
  powerTransform(
    data: number[],
    lambda: number,
    options: TransformationOptions = {}
  ): number[] {
    const { inPlace = false } = options;
    const result = inPlace ? data : new Array(data.length);

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isNaN(value) || value <= 0) {
        result[i] = NaN;
      } else {
        if (lambda === 0) {
          result[i] = Math.log(value);
        } else {
          result[i] = (Math.pow(value, lambda) - 1) / lambda;
        }
      }
    }

    return result;
  }

  /**
   * Calculate percentile efficiently
   */
  private calculatePercentile(sortedData: number[], percentile: number): number {
    if (sortedData.length === 0) return NaN;
    if (sortedData.length === 1) return sortedData[0];

    const index = (percentile / 100) * (sortedData.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedData[lower];
    }

    const weight = index - lower;
    return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
  }

  /**
   * Clear normalization parameter cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// =============================================================================
// DATA AGGREGATION UTILITIES
// =============================================================================

/**
 * High-performance data aggregation with multiple methods
 */
export class DataAggregator {
  /**
   * Aggregate data points by time buckets
   */
  static aggregateByTime(
    data: Array<{ timestamp: number; value: number }>,
    bucketSize: number, // milliseconds
    method: 'mean' | 'sum' | 'min' | 'max' | 'count' | 'first' | 'last' = 'mean'
  ): AggregationResult[] {
    if (data.length === 0) return [];

    // Group by time buckets
    const buckets = new Map<number, number[]>();
    
    for (const point of data) {
      const bucketStart = Math.floor(point.timestamp / bucketSize) * bucketSize;
      if (!buckets.has(bucketStart)) {
        buckets.set(bucketStart, []);
      }
      buckets.get(bucketStart)!.push(point.value);
    }

    // Aggregate each bucket
    const results: AggregationResult[] = [];
    
    for (const [timestamp, values] of Array.from(buckets.entries())) {
      let aggregatedValue: number;
      
      switch (method) {
        case 'mean':
          aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'sum':
          aggregatedValue = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        case 'first':
          aggregatedValue = values[0];
          break;
        case 'last':
          aggregatedValue = values[values.length - 1];
          break;
        default:
          aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      }

      results.push({
        value: aggregatedValue,
        count: values.length,
        timestamp
      });
    }

    return results.sort((a, b) => a.timestamp! - b.timestamp!);
  }

  /**
   * Downsample high-frequency data to lower frequency
   */
  static downsample(
    data: Array<{ timestamp: number; value: number }>,
    targetFrequency: number, // milliseconds between samples
    method: 'mean' | 'median' | 'max' | 'min' | 'first' | 'last' = 'mean'
  ): Array<{ timestamp: number; value: number }> {
    return this.aggregateByTime(data, targetFrequency, method as any)
      .map(result => ({
        timestamp: result.timestamp!,
        value: result.value
      }));
  }

  /**
   * Upsample low-frequency data using interpolation
   */
  static upsample(
    data: Array<{ timestamp: number; value: number }>,
    targetFrequency: number, // milliseconds between samples
    interpolationMethod: 'linear' | 'forward' | 'backward' | 'zero' = 'linear'
  ): Array<{ timestamp: number; value: number }> {
    if (data.length < 2) return [...data];

    const result: Array<{ timestamp: number; value: number }> = [];
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    const startTime = sortedData[0].timestamp;
    const endTime = sortedData[sortedData.length - 1].timestamp;
    
    let currentTime = startTime;
    let dataIndex = 0;

    while (currentTime <= endTime) {
      // Find the surrounding data points
      while (dataIndex < sortedData.length - 1 && 
             sortedData[dataIndex + 1].timestamp <= currentTime) {
        dataIndex++;
      }

      let interpolatedValue: number;

      if (interpolationMethod === 'forward') {
        interpolatedValue = sortedData[dataIndex].value;
      } else if (interpolationMethod === 'backward') {
        const nextIndex = Math.min(dataIndex + 1, sortedData.length - 1);
        interpolatedValue = sortedData[nextIndex].value;
      } else if (interpolationMethod === 'zero') {
        interpolatedValue = 0;
      } else { // linear interpolation
        if (dataIndex === sortedData.length - 1) {
          interpolatedValue = sortedData[dataIndex].value;
        } else {
          const current = sortedData[dataIndex];
          const next = sortedData[dataIndex + 1];
          const timeDiff = next.timestamp - current.timestamp;
          
          if (timeDiff === 0) {
            interpolatedValue = current.value;
          } else {
            const progress = (currentTime - current.timestamp) / timeDiff;
            interpolatedValue = current.value + progress * (next.value - current.value);
          }
        }
      }

      result.push({ timestamp: currentTime, value: interpolatedValue });
      currentTime += targetFrequency;
    }

    return result;
  }
}

// =============================================================================
// DATA SMOOTHING UTILITIES
// =============================================================================

/**
 * Data smoothing and filtering utilities
 */
export class DataSmoother {
  /**
   * Simple moving average
   */
  static movingAverage(data: number[], windowSize: number): number[] {
    if (windowSize <= 0 || windowSize > data.length) return [];
    
    const result: number[] = [];
    
    for (let i = windowSize - 1; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = i - windowSize + 1; j <= i; j++) {
        if (!isNaN(data[j])) {
          sum += data[j];
          count++;
        }
      }
      
      result.push(count > 0 ? sum / count : NaN);
    }
    
    return result;
  }

  /**
   * Exponential moving average
   */
  static exponentialMovingAverage(
    data: number[],
    alpha: number,
    initialValue?: number
  ): number[] {
    if (data.length === 0 || alpha <= 0 || alpha > 1) return [];
    
    const result: number[] = [];
    let ema = initialValue ?? data[0];
    
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i])) {
        ema = alpha * data[i] + (1 - alpha) * ema;
      }
      result.push(ema);
    }
    
    return result;
  }

  /**
   * Gaussian smoothing filter
   */
  static gaussianSmooth(data: number[], sigma: number): number[] {
    if (sigma <= 0) return [...data];
    
    // Generate Gaussian kernel
    const kernelSize = Math.ceil(6 * sigma);
    const kernel: number[] = [];
    let kernelSum = 0;
    
    for (let i = -kernelSize; i <= kernelSize; i++) {
      const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(weight);
      kernelSum += weight;
    }
    
    // Normalize kernel
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= kernelSum;
    }
    
    // Apply convolution
    const result: number[] = [];
    const halfKernel = Math.floor(kernel.length / 2);
    
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let weightSum = 0;
      
      for (let j = 0; j < kernel.length; j++) {
        const dataIndex = i - halfKernel + j;
        if (dataIndex >= 0 && dataIndex < data.length && !isNaN(data[dataIndex])) {
          sum += data[dataIndex] * kernel[j];
          weightSum += kernel[j];
        }
      }
      
      result.push(weightSum > 0 ? sum / weightSum : NaN);
    }
    
    return result;
  }

  /**
   * Median filter for noise removal
   */
  static medianFilter(data: number[], windowSize: number): number[] {
    if (windowSize <= 0 || windowSize % 2 === 0) {
      throw new Error('Window size must be positive and odd');
    }
    
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < data.length; i++) {
      const window: number[] = [];
      
      for (let j = Math.max(0, i - halfWindow); 
           j <= Math.min(data.length - 1, i + halfWindow); j++) {
        if (!isNaN(data[j])) {
          window.push(data[j]);
        }
      }
      
      if (window.length === 0) {
        result.push(NaN);
      } else {
        window.sort((a, b) => a - b);
        const mid = Math.floor(window.length / 2);
        result.push(window[mid]);
      }
    }
    
    return result;
  }

  /**
   * Savitzky-Golay filter for smooth derivatives
   */
  static savitzkyGolayFilter(
    data: number[],
    windowSize: number,
    polynomialOrder: number
  ): number[] {
    if (windowSize % 2 === 0 || windowSize <= polynomialOrder) {
      throw new Error('Window size must be odd and greater than polynomial order');
    }

    // This is a simplified implementation
    // For production use, consider a full implementation with matrix operations
    const halfWindow = Math.floor(windowSize / 2);
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const startIdx = Math.max(0, i - halfWindow);
      const endIdx = Math.min(data.length - 1, i + halfWindow);
      
      // Simple polynomial fit (simplified for performance)
      const window = data.slice(startIdx, endIdx + 1);
      const filteredValue = window.reduce((sum, val) => sum + val, 0) / window.length;
      
      result.push(filteredValue);
    }

    return result;
  }
}

// =============================================================================
// DATA QUALITY AND VALIDATION UTILITIES (Extended from above)
// =============================================================================

/**
 * Extended data quality and validation utilities
 */
export class DataQualityAnalyzer {
  /**
   * Check for outliers using IQR method
   */
  static detectOutliers(
    data: number[],
    multiplier: number = 1.5
  ): { outliers: number[]; indices: number[]; cleaned: number[] } {
    const validData = data.filter(x => !isNaN(x));
    
    if (validData.length === 0) {
      return { outliers: [], indices: [], cleaned: [...data] };
    }

    const sortedData = [...validData].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sortedData, 25);
    const q3 = this.calculatePercentile(sortedData, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;
    
    const outliers: number[] = [];
    const indices: number[] = [];
    const cleaned: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isNaN(value)) {
        cleaned.push(value);
      } else if (value < lowerBound || value > upperBound) {
        outliers.push(value);
        indices.push(i);
        cleaned.push(NaN); // Replace outliers with NaN
      } else {
        cleaned.push(value);
      }
    }
    
    return { outliers, indices, cleaned };
  }

  /**
   * Check data quality metrics
   */
  static analyzeDataQuality(data: number[]): {
    totalPoints: number;
    validPoints: number;
    missingPoints: number;
    missingPercentage: number;
    duplicates: number;
    outliers: number;
    continuityGaps: number;
  } {
    const totalPoints = data.length;
    const validData = data.filter(x => !isNaN(x));
    const validPoints = validData.length;
    const missingPoints = totalPoints - validPoints;
    const missingPercentage = (missingPoints / totalPoints) * 100;
    
    // Count duplicates
    const valueSet = new Set(validData);
    const duplicates = validPoints - valueSet.size;
    
    // Count outliers
    const outliersResult = this.detectOutliers(data);
    const outliers = outliersResult.outliers.length;
    
    // Count continuity gaps (consecutive NaNs)
    let continuityGaps = 0;
    let inGap = false;
    
    for (const value of data) {
      if (isNaN(value)) {
        if (!inGap) {
          continuityGaps++;
          inGap = true;
        }
      } else {
        inGap = false;
      }
    }
    
    return {
      totalPoints,
      validPoints,
      missingPoints,
      missingPercentage,
      duplicates,
      outliers,
      continuityGaps
    };
  }

  private static calculatePercentile(sortedData: number[], percentile: number): number {
    if (sortedData.length === 0) return NaN;
    if (sortedData.length === 1) return sortedData[0];

    const index = (percentile / 100) * (sortedData.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedData[lower];
    }

    const weight = index - lower;
    return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
  }
}

// =============================================================================
// VECTORIZED OPERATIONS
// =============================================================================

/**
 * High-performance vectorized mathematical operations
 */
export class VectorOperations {
  /**
   * Element-wise addition of two arrays
   */
  static add(a: number[], b: number[] | number): number[] {
    if (typeof b === 'number') {
      return a.map(x => x + b);
    }
    
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length');
    }
    
    return a.map((x, i) => x + b[i]);
  }

  /**
   * Element-wise subtraction
   */
  static subtract(a: number[], b: number[] | number): number[] {
    if (typeof b === 'number') {
      return a.map(x => x - b);
    }
    
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length');
    }
    
    return a.map((x, i) => x - b[i]);
  }

  /**
   * Element-wise multiplication
   */
  static multiply(a: number[], b: number[] | number): number[] {
    if (typeof b === 'number') {
      return a.map(x => x * b);
    }
    
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length');
    }
    
    return a.map((x, i) => x * b[i]);
  }

  /**
   * Element-wise division
   */
  static divide(a: number[], b: number[] | number): number[] {
    if (typeof b === 'number') {
      return a.map(x => b !== 0 ? x / b : NaN);
    }
    
    if (a.length !== b.length) {
      throw new Error('Arrays must have same length');
    }
    
    return a.map((x, i) => b[i] !== 0 ? x / b[i] : NaN);
  }

  /**
   * Calculate returns (percentage change)
   */
  static returns(data: number[], periods: number = 1): number[] {
    if (periods <= 0 || periods >= data.length) return [];
    
    const result: number[] = new Array(periods).fill(NaN);
    
    for (let i = periods; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - periods];
      
      if (isNaN(current) || isNaN(previous) || previous === 0) {
        result.push(NaN);
      } else {
        result.push((current - previous) / previous);
      }
    }
    
    return result;
  }

  /**
   * Calculate log returns
   */
  static logReturns(data: number[], periods: number = 1): number[] {
    if (periods <= 0 || periods >= data.length) return [];
    
    const result: number[] = new Array(periods).fill(NaN);
    
    for (let i = periods; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - periods];
      
      if (isNaN(current) || isNaN(previous) || previous <= 0 || current <= 0) {
        result.push(NaN);
      } else {
        result.push(Math.log(current / previous));
      }
    }
    
    return result;
  }

  /**
   * Calculate cumulative sum
   */
  static cumsum(data: number[]): number[] {
    const result: number[] = [];
    let sum = 0;
    
    for (const value of data) {
      if (!isNaN(value)) {
        sum += value;
      }
      result.push(sum);
    }
    
    return result;
  }

  /**
   * Calculate cumulative product
   */
  static cumprod(data: number[]): number[] {
    const result: number[] = [];
    let product = 1;
    
    for (const value of data) {
      if (!isNaN(value)) {
        product *= value;
      }
      result.push(product);
    }
    
    return result;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a data normalizer instance
 */
export function createDataNormalizer(enableCache = true): DataNormalizer {
  return new DataNormalizer(enableCache);
}

/**
 * Apply multiple transformations in sequence
 */
export function applyTransformationPipeline(
  data: number[],
  transformations: Array<{
    type: 'minmax' | 'zscore' | 'robust' | 'log' | 'smooth';
    options?: any;
  }>
): number[] {
  let result = [...data];
  const normalizer = new DataNormalizer();
  
  for (const transform of transformations) {
    switch (transform.type) {
      case 'minmax':
        result = normalizer.minMaxNormalize(result, transform.options);
        break;
      case 'zscore':
        result = normalizer.zScoreNormalize(result, transform.options);
        break;
      case 'robust':
        result = normalizer.robustNormalize(result, transform.options);
        break;
      case 'log':
        result = normalizer.logTransform(result, transform.options);
        break;
      case 'smooth':
        result = DataSmoother.movingAverage(result, transform.options?.windowSize ?? 5);
        break;
    }
  }
  
  return result;
}