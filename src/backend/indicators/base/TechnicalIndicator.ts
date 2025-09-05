/**
 * Base Technical Indicator Class - Task BE-010
 * 
 * Abstract base class for all technical indicators providing:
 * - Standardized calculation interface
 * - Streaming updates for real-time data
 * - Efficient memory management with circular buffers
 * - Performance monitoring and validation
 * - Error handling and recovery
 */

import {
  OHLCV,
  IndicatorResult,
  IndicatorConfig,
  ValidationRules,
  PerformanceMetrics,
  StreamingContext,
  IndicatorStatus,
  IndicatorError,
  InsufficientDataError,
  InvalidParameterError,
  CalculationError
} from './types.js';
import { CircularBufferImpl, NumericCircularBuffer } from './CircularBuffer.js';
import { mathUtils } from './MathUtils.js';

/**
 * Abstract base class for technical indicators
 */
export abstract class TechnicalIndicator<T = number | number[]> {
  protected readonly config: IndicatorConfig;
  protected readonly validationRules: ValidationRules;
  protected readonly indicatorName: string;
  
  // Circular buffers for efficient data management
  protected readonly dataBuffer: CircularBufferImpl<OHLCV>;
  protected readonly resultBuffer: CircularBufferImpl<IndicatorResult<T>>;
  
  // Performance tracking
  protected performanceMetrics: PerformanceMetrics;
  protected status: IndicatorStatus = IndicatorStatus.INSUFFICIENT_DATA;
  
  // Streaming state
  protected lastCalculation?: Date;
  protected isInitialized = false;
  protected calculationCount = 0;

  constructor(
    name: string,
    config: IndicatorConfig,
    validationRules?: Partial<ValidationRules>
  ) {
    this.indicatorName = name;
    this.config = this.validateConfig(config);
    this.validationRules = {
      minDataPoints: config.period,
      maxPeriod: 1000,
      validateOHLCV: true,
      ...validationRules
    };

    // Initialize circular buffers with appropriate sizes
    const bufferSize = Math.max(config.period * 2, 100);
    this.dataBuffer = new CircularBufferImpl<OHLCV>(bufferSize);
    this.resultBuffer = new CircularBufferImpl<IndicatorResult<T>>(bufferSize);

    // Initialize performance metrics
    this.performanceMetrics = {
      calculationTimeMs: 0,
      memoryUsageBytes: 0,
      dataPointsProcessed: 0,
      avgTimePerPoint: 0,
      cacheHitRate: 0
    };
  }

  /**
   * ABSTRACT METHODS - Must be implemented by concrete indicators
   */

  /**
   * Calculate indicator value for the given data
   * This is the core calculation method that must be implemented
   */
  protected abstract calculateValue(data: OHLCV[]): T;

  /**
   * Perform streaming update calculation
   * Default implementation recalculates from scratch, but can be optimized
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): T {
    // Default implementation - recalculate from current buffer
    const data = this.dataBuffer.getAll();
    return this.calculateValue(data);
  }

  /**
   * Validate indicator-specific parameters
   */
  protected abstract validateIndicatorConfig(config: IndicatorConfig): void;

  /**
   * Get indicator-specific metadata for the result
   */
  protected getResultMetadata(value: T, data: OHLCV[]): Record<string, any> {
    return {
      dataPoints: data.length,
      period: this.config.period
    };
  }

  /**
   * PUBLIC API METHODS
   */

  /**
   * Calculate indicator for historical data (batch mode)
   */
  calculate(data: OHLCV[]): IndicatorResult<T> {
    const startTime = performance.now();
    
    try {
      // Validate input data
      this.validateInputData(data);
      
      // Set status
      this.status = IndicatorStatus.CALCULATING;
      
      // Perform calculation
      const value = this.calculateValue(data);
      
      // Create result
      const result: IndicatorResult<T> = {
        value,
        timestamp: data[data.length - 1]?.time || new Date(),
        isValid: this.isResultValid(value),
        confidence: this.calculateConfidence(data),
        metadata: this.getResultMetadata(value, data)
      };

      // Update performance metrics
      this.updatePerformanceMetrics(startTime, data.length);
      this.status = IndicatorStatus.COMPLETED;

      return result;

    } catch (error) {
      this.status = IndicatorStatus.ERROR;
      throw this.wrapError(error);
    }
  }

  /**
   * Add new candle and update indicator (streaming mode)
   */
  update(candle: OHLCV, context?: StreamingContext): IndicatorResult<T> {
    const startTime = performance.now();
    
    try {
      // Validate single candle
      this.validateCandle(candle);
      
      // Add to buffer
      this.dataBuffer.push(candle);
      this.status = IndicatorStatus.CALCULATING;
      
      // Perform streaming calculation
      const value = context?.isIncremental 
        ? this.streamingUpdate(candle, context)
        : this.calculateValue(this.dataBuffer.getAll());
      
      // Create result
      const result: IndicatorResult<T> = {
        value,
        timestamp: candle.time,
        isValid: this.isReady() && this.isResultValid(value),
        confidence: this.calculateConfidence(this.dataBuffer.getAll()),
        metadata: {
          ...this.getResultMetadata(value, this.dataBuffer.getAll()),
          isStreaming: true,
          bufferSize: this.dataBuffer.size()
        }
      };

      // Cache result
      this.resultBuffer.push(result);
      
      // Update metrics and status
      this.updatePerformanceMetrics(startTime, 1);
      this.lastCalculation = new Date();
      this.calculationCount++;
      this.status = IndicatorStatus.COMPLETED;
      
      if (!this.isInitialized && this.isReady()) {
        this.isInitialized = true;
      }

      return result;

    } catch (error) {
      this.status = IndicatorStatus.ERROR;
      throw this.wrapError(error);
    }
  }

  /**
   * Check if indicator has enough data to produce valid results
   */
  isReady(): boolean {
    return this.dataBuffer.size() >= this.validationRules.minDataPoints;
  }

  /**
   * Reset indicator state and clear buffers
   */
  reset(): void {
    this.dataBuffer.clear();
    this.resultBuffer.clear();
    this.status = IndicatorStatus.INSUFFICIENT_DATA;
    this.isInitialized = false;
    this.calculationCount = 0;
    this.lastCalculation = undefined;
    
    // Reset performance metrics
    this.performanceMetrics = {
      calculationTimeMs: 0,
      memoryUsageBytes: 0,
      dataPointsProcessed: 0,
      avgTimePerPoint: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Get current indicator status
   */
  getStatus(): IndicatorStatus {
    if (this.status === IndicatorStatus.INSUFFICIENT_DATA && this.isReady()) {
      this.status = IndicatorStatus.READY;
    }
    return this.status;
  }

  /**
   * Get latest calculated result
   */
  getLatestResult(): IndicatorResult<T> | undefined {
    return this.resultBuffer.latest();
  }

  /**
   * Get historical results
   */
  getResults(count?: number): IndicatorResult<T>[] {
    const allResults = this.resultBuffer.getAll();
    return count ? allResults.slice(-count) : allResults;
  }

  /**
   * Get indicator configuration
   */
  getConfig(): IndicatorConfig {
    return { ...this.config };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current data buffer size
   */
  getBufferSize(): number {
    return this.dataBuffer.size();
  }

  /**
   * Get indicator name
   */
  getName(): string {
    return this.indicatorName;
  }

  /**
   * VALIDATION AND ERROR HANDLING
   */

  /**
   * Validate indicator configuration
   */
  private validateConfig(config: IndicatorConfig): IndicatorConfig {
    if (!config) {
      throw new InvalidParameterError(this.indicatorName, 'config', config, 'Configuration is required');
    }

    if (!Number.isInteger(config.period) || config.period <= 0) {
      throw new InvalidParameterError(
        this.indicatorName, 
        'period', 
        config.period, 
        'Period must be a positive integer'
      );
    }

    if (config.period2 !== undefined && (!Number.isInteger(config.period2) || config.period2 <= 0)) {
      throw new InvalidParameterError(
        this.indicatorName, 
        'period2', 
        config.period2, 
        'Period2 must be a positive integer'
      );
    }

    if (config.smoothing !== undefined && (config.smoothing <= 0 || config.smoothing > 1)) {
      throw new InvalidParameterError(
        this.indicatorName, 
        'smoothing', 
        config.smoothing, 
        'Smoothing must be between 0 and 1'
      );
    }

    if (config.stdDevMultiplier !== undefined && config.stdDevMultiplier <= 0) {
      throw new InvalidParameterError(
        this.indicatorName, 
        'stdDevMultiplier', 
        config.stdDevMultiplier, 
        'Standard deviation multiplier must be positive'
      );
    }

    // Call indicator-specific validation
    this.validateIndicatorConfig(config);

    return config;
  }

  /**
   * Validate input data array
   */
  protected validateInputData(data: OHLCV[]): void {
    if (!Array.isArray(data)) {
      throw new InvalidParameterError(this.indicatorName, 'data', data, 'Data must be an array');
    }

    if (data.length === 0) {
      throw new InsufficientDataError(this.indicatorName, 1, 0);
    }

    if (data.length < this.validationRules.minDataPoints) {
      throw new InsufficientDataError(
        this.indicatorName, 
        this.validationRules.minDataPoints, 
        data.length
      );
    }

    if (this.validationRules.validateOHLCV) {
      this.validateOHLCVData(data);
    }

    // Custom validation if provided
    if (this.validationRules.customValidator) {
      const error = this.validationRules.customValidator(data);
      if (error) {
        throw new InvalidParameterError(this.indicatorName, 'data', data, error);
      }
    }
  }

  /**
   * Validate single OHLCV candle
   */
  protected validateCandle(candle: OHLCV): void {
    if (!candle) {
      throw new InvalidParameterError(this.indicatorName, 'candle', candle, 'Candle is required');
    }

    if (!(candle.time instanceof Date)) {
      throw new InvalidParameterError(
        this.indicatorName, 
        'candle.time', 
        candle.time, 
        'Time must be a Date object'
      );
    }

    if (this.validationRules.validateOHLCV) {
      this.validateOHLCVCandle(candle);
    }
  }

  /**
   * Validate OHLCV data integrity
   */
  private validateOHLCVData(data: OHLCV[]): void {
    for (let i = 0; i < data.length; i++) {
      try {
        this.validateOHLCVCandle(data[i]);
      } catch (error) {
        throw new InvalidParameterError(
          this.indicatorName, 
          `data[${i}]`, 
          data[i], 
          `Invalid candle at index ${i}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Validate individual OHLCV candle
   */
  private validateOHLCVCandle(candle: OHLCV): void {
    const { open, high, low, close, volume } = candle;

    // Check for valid numbers
    if (!mathUtils.isValidNumber(open) || !mathUtils.isValidNumber(high) || 
        !mathUtils.isValidNumber(low) || !mathUtils.isValidNumber(close)) {
      throw new Error('OHLC values must be valid numbers');
    }

    if (volume !== undefined && (!mathUtils.isValidNumber(volume) || volume < 0)) {
      throw new Error('Volume must be a non-negative number');
    }

    // Check OHLC relationships
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      throw new Error('Invalid OHLC relationship: high/low do not contain open/close');
    }

    if (high < low) {
      throw new Error('High price cannot be less than low price');
    }

    // Check for reasonable price values
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      throw new Error('OHLC prices must be positive');
    }
  }

  /**
   * Check if result value is valid
   */
  protected isResultValid(value: T): boolean {
    if (typeof value === 'number') {
      return mathUtils.isValidNumber(value);
    }
    
    if (Array.isArray(value)) {
      return value.every(v => mathUtils.isValidNumber(v));
    }
    
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).every(v => 
        typeof v === 'number' ? mathUtils.isValidNumber(v) : true
      );
    }
    
    return value !== null && value !== undefined;
  }

  /**
   * Calculate confidence level based on data quality
   */
  protected calculateConfidence(data: OHLCV[]): number {
    if (data.length < this.validationRules.minDataPoints) {
      return 0;
    }

    // Base confidence on data sufficiency
    const dataRatio = data.length / (this.config.period * 2);
    let confidence = Math.min(dataRatio, 1);

    // Adjust for data quality factors
    if (data.length >= this.config.period * 3) {
      confidence *= 1.1; // Bonus for extra data
    }

    // Check for data consistency (no huge gaps in time)
    if (data.length > 1) {
      const timeGaps = [];
      for (let i = 1; i < data.length; i++) {
        const gap = data[i].time.getTime() - data[i - 1].time.getTime();
        timeGaps.push(gap);
      }
      
      const avgGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;
      const maxGap = Math.max(...timeGaps);
      
      if (maxGap > avgGap * 3) {
        confidence *= 0.9; // Penalty for inconsistent timing
      }
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(startTime: number, dataPointsProcessed: number): void {
    const calculationTime = performance.now() - startTime;
    const totalTime = this.performanceMetrics.calculationTimeMs + calculationTime;
    const totalPoints = this.performanceMetrics.dataPointsProcessed + dataPointsProcessed;

    this.performanceMetrics = {
      calculationTimeMs: totalTime,
      memoryUsageBytes: this.estimateMemoryUsage(),
      dataPointsProcessed: totalPoints,
      avgTimePerPoint: totalPoints > 0 ? totalTime / totalPoints : 0,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Estimate memory usage of the indicator
   */
  private estimateMemoryUsage(): number {
    // Rough estimation based on buffer sizes and typical object overhead
    const dataBufferSize = this.dataBuffer.size() * 200; // ~200 bytes per OHLCV
    const resultBufferSize = this.resultBuffer.size() * 100; // ~100 bytes per result
    const overhead = 1000; // Base object overhead
    
    return dataBufferSize + resultBufferSize + overhead;
  }

  /**
   * Calculate cache hit rate (placeholder - can be enhanced with actual caching)
   */
  private calculateCacheHitRate(): number {
    // For now, return a simple metric based on streaming vs batch calculations
    return this.calculationCount > 0 ? 
      Math.min(this.dataBuffer.size() / this.calculationCount, 1) : 0;
  }

  /**
   * Wrap errors with indicator context
   */
  private wrapError(error: unknown): IndicatorError {
    if (error instanceof IndicatorError) {
      return error;
    }

    if (error instanceof Error) {
      return new CalculationError(this.indicatorName, error.message, error);
    }

    return new CalculationError(this.indicatorName, String(error));
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Get data from buffer as numeric arrays for calculations
   */
  protected getDataArrays(data?: OHLCV[]): {
    opens: number[];
    highs: number[];
    lows: number[];
    closes: number[];
    volumes: number[];
    times: Date[];
  } {
    const sourceData = data || this.dataBuffer.getAll();
    
    return {
      opens: sourceData.map(d => d.open),
      highs: sourceData.map(d => d.high),
      lows: sourceData.map(d => d.low),
      closes: sourceData.map(d => d.close),
      volumes: sourceData.map(d => d.volume || 0),
      times: sourceData.map(d => d.time)
    };
  }

  /**
   * Create a numeric buffer for specific price type
   */
  protected createPriceBuffer(priceType: 'open' | 'high' | 'low' | 'close' | 'volume' = 'close'): NumericCircularBuffer {
    const buffer = new NumericCircularBuffer(this.config.period * 2);
    
    // Populate with existing data
    this.dataBuffer.forEach((candle) => {
      buffer.push(candle[priceType] || 0);
    });
    
    return buffer;
  }

  /**
   * Get string representation of the indicator
   */
  toString(): string {
    return `${this.indicatorName}(${this.config.period}) [${this.status}] ` +
           `Buffer: ${this.dataBuffer.size()}/${this.dataBuffer.capacity()} ` +
           `Calculations: ${this.calculationCount}`;
  }
}