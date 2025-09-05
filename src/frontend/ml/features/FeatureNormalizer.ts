/**
 * Feature Normalization and Scaling Utilities - Task ML-002
 * 
 * Comprehensive normalization methods for ML feature preprocessing
 * with streaming support and rolling window calculations.
 */

/**
 * Normalization statistics for tracking
 */
interface NormalizationStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
}

/**
 * Normalization options
 */
interface NormalizationOptions {
  method: 'minmax' | 'zscore' | 'robust';
  windowSize?: number;
  clipOutliers?: boolean;
  outlierThreshold?: number; // z-score threshold
  preserveZeros?: boolean;
}

/**
 * Streaming normalization state
 */
interface StreamingState {
  windowSize: number;
  values: number[];
  stats: NormalizationStats;
  lastUpdated: Date;
}

/**
 * Feature normalization and scaling for ML preprocessing
 */
export class FeatureNormalizer {
  private streamingStates: Map<string, StreamingState> = new Map();
  private readonly DEFAULT_WINDOW_SIZE = 100;
  private readonly OUTLIER_THRESHOLD = 3.0; // z-score

  /**
   * Normalize array of values using min-max scaling
   * Maps values to [0, 1] range
   */
  minMaxNormalize(
    values: number[], 
    min?: number, 
    max?: number,
    options: Partial<NormalizationOptions> = {}
  ): { normalized: number[]; stats: NormalizationStats } {
    if (values.length === 0) {
      return { 
        normalized: [], 
        stats: this.createEmptyStats() 
      };
    }

    const cleanValues = this.preprocessValues(values, options);
    const actualMin = min ?? Math.min(...cleanValues);
    const actualMax = max ?? Math.max(...cleanValues);
    const range = actualMax - actualMin;

    if (range === 0) {
      // All values are the same
      return {
        normalized: new Array(cleanValues.length).fill(0.5),
        stats: this.calculateStats(cleanValues)
      };
    }

    const normalized = cleanValues.map(value => (value - actualMin) / range);
    
    return {
      normalized,
      stats: this.calculateStats(cleanValues)
    };
  }

  /**
   * Normalize values using z-score (standardization)
   * Maps values to mean=0, std=1 distribution
   */
  zScoreNormalize(
    values: number[],
    mean?: number,
    std?: number,
    options: Partial<NormalizationOptions> = {}
  ): { normalized: number[]; stats: NormalizationStats } {
    if (values.length === 0) {
      return { 
        normalized: [], 
        stats: this.createEmptyStats() 
      };
    }

    const cleanValues = this.preprocessValues(values, options);
    const actualMean = mean ?? this.calculateMean(cleanValues);
    const actualStd = std ?? this.calculateStd(cleanValues, actualMean);

    if (actualStd === 0) {
      // All values are the same
      return {
        normalized: new Array(cleanValues.length).fill(0),
        stats: this.calculateStats(cleanValues)
      };
    }

    const normalized = cleanValues.map(value => (value - actualMean) / actualStd);
    
    return {
      normalized,
      stats: this.calculateStats(cleanValues)
    };
  }

  /**
   * Robust scaling using median and IQR
   * Less sensitive to outliers than z-score
   */
  robustScale(
    values: number[],
    median?: number,
    iqr?: number,
    options: Partial<NormalizationOptions> = {}
  ): { normalized: number[]; stats: NormalizationStats } {
    if (values.length === 0) {
      return { 
        normalized: [], 
        stats: this.createEmptyStats() 
      };
    }

    const cleanValues = this.preprocessValues(values, options);
    const sortedValues = [...cleanValues].sort((a, b) => a - b);
    
    const actualMedian = median ?? this.calculateMedian(sortedValues);
    const q1 = this.calculatePercentile(sortedValues, 25);
    const q3 = this.calculatePercentile(sortedValues, 75);
    const actualIQR = iqr ?? (q3 - q1);

    if (actualIQR === 0) {
      // All values are the same or within quartiles
      return {
        normalized: new Array(cleanValues.length).fill(0),
        stats: this.calculateStats(cleanValues)
      };
    }

    const normalized = cleanValues.map(value => (value - actualMedian) / actualIQR);
    
    return {
      normalized,
      stats: this.calculateStats(cleanValues)
    };
  }

  /**
   * Streaming normalization for real-time feature processing
   * Maintains rolling window statistics
   */
  streamingNormalize(
    featureName: string,
    newValue: number,
    options: NormalizationOptions = { method: 'zscore' }
  ): { normalized: number; confidence: number } {
    const windowSize = options.windowSize || this.DEFAULT_WINDOW_SIZE;
    
    if (!this.streamingStates.has(featureName)) {
      this.streamingStates.set(featureName, {
        windowSize,
        values: [],
        stats: this.createEmptyStats(),
        lastUpdated: new Date()
      });
    }

    const state = this.streamingStates.get(featureName)!;
    
    // Add new value to rolling window
    state.values.push(newValue);
    if (state.values.length > windowSize) {
      state.values.shift(); // Remove oldest value
    }

    // Update statistics
    state.stats = this.calculateStats(state.values);
    state.lastUpdated = new Date();

    // Normalize based on method
    let normalized: number;
    let confidence: number;

    switch (options.method) {
      case 'minmax':
        const minMaxResult = this.minMaxNormalize([newValue], state.stats.min, state.stats.max);
        normalized = minMaxResult.normalized[0];
        break;
        
      case 'robust':
        const robustResult = this.robustScale([newValue], state.stats.median, state.stats.iqr);
        normalized = robustResult.normalized[0];
        break;
        
      case 'zscore':
      default:
        const zScoreResult = this.zScoreNormalize([newValue], state.stats.mean, state.stats.std);
        normalized = zScoreResult.normalized[0];
        break;
    }

    // Calculate confidence based on window fullness and stability
    confidence = Math.min(state.values.length / windowSize, 1.0) * 
                 this.calculateStabilityScore(state.values);

    return { normalized, confidence };
  }

  /**
   * Batch normalization for multiple features with consistent scaling
   */
  batchNormalize(
    features: Record<string, number[]>,
    options: NormalizationOptions = { method: 'zscore' }
  ): { 
    normalized: Record<string, number[]>; 
    stats: Record<string, NormalizationStats>; 
    confidence: Record<string, number>;
  } {
    const normalized: Record<string, number[]> = {};
    const stats: Record<string, NormalizationStats> = {};
    const confidence: Record<string, number> = {};

    for (const [featureName, values] of Object.entries(features)) {
      let result;
      
      switch (options.method) {
        case 'minmax':
          result = this.minMaxNormalize(values, undefined, undefined, options);
          break;
          
        case 'robust':
          result = this.robustScale(values, undefined, undefined, options);
          break;
          
        case 'zscore':
        default:
          result = this.zScoreNormalize(values, undefined, undefined, options);
          break;
      }

      normalized[featureName] = result.normalized;
      stats[featureName] = result.stats;
      confidence[featureName] = this.calculateFeatureConfidence(values);
    }

    return { normalized, stats, confidence };
  }

  /**
   * Feature scaling with rolling window for time series
   */
  rollingWindowNormalize(
    values: number[],
    windowSize: number,
    method: 'minmax' | 'zscore' | 'robust' = 'zscore'
  ): number[] {
    if (values.length < windowSize) {
      // Not enough data for full window, use available data
      return this.normalizeMethod(values, method).normalized;
    }

    const normalized: number[] = [];

    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      const currentValue = values[i];
      
      let normalizedValue: number;
      
      switch (method) {
        case 'minmax':
          const minMaxResult = this.minMaxNormalize([currentValue], 
            Math.min(...window), Math.max(...window));
          normalizedValue = minMaxResult.normalized[0];
          break;
          
        case 'robust':
          const sortedWindow = [...window].sort((a, b) => a - b);
          const median = this.calculateMedian(sortedWindow);
          const q1 = this.calculatePercentile(sortedWindow, 25);
          const q3 = this.calculatePercentile(sortedWindow, 75);
          const iqr = q3 - q1;
          normalizedValue = iqr > 0 ? (currentValue - median) / iqr : 0;
          break;
          
        case 'zscore':
        default:
          const mean = this.calculateMean(window);
          const std = this.calculateStd(window, mean);
          normalizedValue = std > 0 ? (currentValue - mean) / std : 0;
          break;
      }
      
      normalized.push(normalizedValue);
    }

    return normalized;
  }

  /**
   * Get normalization statistics for a streaming feature
   */
  getStreamingStats(featureName: string): NormalizationStats | null {
    const state = this.streamingStates.get(featureName);
    return state ? state.stats : null;
  }

  /**
   * Clear streaming state for a feature (useful for resets)
   */
  clearStreamingState(featureName: string): void {
    this.streamingStates.delete(featureName);
  }

  /**
   * Clear all streaming states
   */
  clearAllStates(): void {
    this.streamingStates.clear();
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private preprocessValues(values: number[], options: Partial<NormalizationOptions> = {}): number[] {
    let processedValues = [...values];

    // Handle NaN and infinite values
    processedValues = processedValues.filter(v => isFinite(v));

    if (options.clipOutliers) {
      const threshold = options.outlierThreshold || this.OUTLIER_THRESHOLD;
      const mean = this.calculateMean(processedValues);
      const std = this.calculateStd(processedValues, mean);
      
      processedValues = processedValues.filter(v => 
        Math.abs(v - mean) <= threshold * std
      );
    }

    return processedValues;
  }

  private normalizeMethod(values: number[], method: string) {
    switch (method) {
      case 'minmax':
        return this.minMaxNormalize(values);
      case 'robust':
        return this.robustScale(values);
      case 'zscore':
      default:
        return this.zScoreNormalize(values);
    }
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private calculateStd(values: number[], mean?: number): number {
    if (values.length <= 1) return 0;
    
    const actualMean = mean ?? this.calculateMean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - actualMean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] + (index - lower) * (sortedValues[upper] - sortedValues[lower]);
  }

  private calculateStats(values: number[]): NormalizationStats {
    if (values.length === 0) {
      return this.createEmptyStats();
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const mean = this.calculateMean(values);
    const std = this.calculateStd(values, mean);
    const median = this.calculateMedian(sortedValues);
    const q1 = this.calculatePercentile(sortedValues, 25);
    const q3 = this.calculatePercentile(sortedValues, 75);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      mean,
      std,
      median,
      q1,
      q3,
      iqr: q3 - q1
    };
  }

  private createEmptyStats(): NormalizationStats {
    return {
      min: 0,
      max: 0,
      mean: 0,
      std: 0,
      median: 0,
      q1: 0,
      q3: 0,
      iqr: 0
    };
  }

  private calculateStabilityScore(values: number[]): number {
    if (values.length < 10) return 0.5; // Low confidence with few values
    
    // Calculate coefficient of variation (CV = std/mean)
    const mean = this.calculateMean(values);
    const std = this.calculateStd(values, mean);
    
    if (mean === 0) return 0.5;
    
    const cv = Math.abs(std / mean);
    // Convert CV to stability score (lower CV = higher stability)
    return Math.max(0, Math.min(1, 1 - cv));
  }

  private calculateFeatureConfidence(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Factors for confidence calculation
    const sampleSizeFactor = Math.min(values.length / 100, 1); // Prefer more data
    const stabilityFactor = this.calculateStabilityScore(values);
    const completnessFactor = values.filter(v => isFinite(v)).length / values.length;
    
    return (sampleSizeFactor * 0.4 + stabilityFactor * 0.4 + completnessFactor * 0.2);
  }
}