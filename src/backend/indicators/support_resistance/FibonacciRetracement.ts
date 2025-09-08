/**
 * Fibonacci Retracement Indicator - Task BE-010
 * 
 * Calculates Fibonacci retracement levels based on a significant price swing.
 * Uses key Fibonacci ratios to identify potential support and resistance levels.
 * 
 * Standard Fibonacci levels: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%
 * Extension levels: 127.2%, 161.8%, 261.8%
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';

export interface FibonacciRetracementConfig extends IndicatorConfig {
  /** Method to detect swing highs/lows */
  swingDetectionMethod?: 'AUTO' | 'MANUAL';
  /** Number of periods to look back for swing detection */
  swingLookback?: number;
  /** Manual swing high (if using MANUAL method) */
  swingHigh?: number;
  /** Manual swing low (if using MANUAL method) */
  swingLow?: number;
  /** Include Fibonacci extension levels */
  includeExtensions?: boolean;
  /** Custom Fibonacci levels */
  customLevels?: number[];
}

export interface FibonacciLevel {
  /** Fibonacci ratio (e.g., 0.382 for 38.2%) */
  ratio: number;
  /** Price level */
  price: number;
  /** Level name */
  name: string;
  /** Level type */
  type: 'RETRACEMENT' | 'EXTENSION';
}

export interface FibonacciRetracementResult {
  /** Swing high price */
  swingHigh: number;
  /** Swing low price */
  swingLow: number;
  /** Price range */
  range: number;
  /** All Fibonacci levels */
  levels: FibonacciLevel[];
  /** Retracement levels only */
  retracements: FibonacciLevel[];
  /** Extension levels (if included) */
  extensions?: FibonacciLevel[];
  /** Current trend direction */
  trendDirection: 'UP' | 'DOWN';
  /** Whether swing points were automatically detected */
  autoDetected: boolean;
}

/**
 * Fibonacci Retracement implementation with automatic swing detection
 */
export class FibonacciRetracement extends TechnicalIndicator<FibonacciRetracementResult> {
  private readonly swingDetectionMethod: string;
  private readonly swingLookback: number;
  private readonly includeExtensions: boolean;
  private readonly customLevels: number[];
  
  private manualSwingHigh?: number;
  private manualSwingLow?: number;

  // Standard Fibonacci ratios
  private static readonly STANDARD_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  private static readonly STANDARD_EXTENSION_LEVELS = [1.272, 1.618, 2.618];

  constructor(config: FibonacciRetracementConfig) {
    super('FibonacciRetracement', { ...config, period: config.period || config.swingLookback || 20 });
    
    this.swingDetectionMethod = config.swingDetectionMethod || 'AUTO';
    this.swingLookback = config.swingLookback || 20;
    this.includeExtensions = config.includeExtensions || false;
    this.customLevels = config.customLevels || [];
    
    this.manualSwingHigh = config.swingHigh;
    this.manualSwingLow = config.swingLow;
  }

  /**
   * Calculate Fibonacci Retracement for given data
   */
  protected calculateValue(data: OHLCV[]): FibonacciRetracementResult {
    if (data.length < this.swingLookback) {
      return this.createEmptyResult();
    }

    let swingHigh: number;
    let swingLow: number;
    let autoDetected = false;

    if (this.swingDetectionMethod === 'MANUAL' && 
        this.manualSwingHigh !== undefined && 
        this.manualSwingLow !== undefined) {
      swingHigh = this.manualSwingHigh;
      swingLow = this.manualSwingLow;
    } else {
      // Auto-detect swing points
      const swingPoints = this.detectSwingPoints(data);
      swingHigh = swingPoints.high;
      swingLow = swingPoints.low;
      autoDetected = true;
    }

    return this.calculateFibonacciLevels(swingHigh, swingLow, autoDetected);
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): FibonacciRetracementResult {
    const dataBuffer = this.dataBuffer.getAll();
    
    if (dataBuffer.length < this.swingLookback) {
      return this.createEmptyResult();
    }

    let swingHigh: number;
    let swingLow: number;
    let autoDetected = false;

    if (this.swingDetectionMethod === 'MANUAL' && 
        this.manualSwingHigh !== undefined && 
        this.manualSwingLow !== undefined) {
      swingHigh = this.manualSwingHigh;
      swingLow = this.manualSwingLow;
    } else {
      // Auto-detect swing points from recent data
      const swingPoints = this.detectSwingPoints(dataBuffer);
      swingHigh = swingPoints.high;
      swingLow = swingPoints.low;
      autoDetected = true;
    }

    return this.calculateFibonacciLevels(swingHigh, swingLow, autoDetected);
  }

  /**
   * Automatically detect swing high and low points
   */
  private detectSwingPoints(data: OHLCV[]): { high: number; low: number } {
    if (data.length === 0) {
      return { high: 0, low: 0 };
    }

    // Use recent data for swing detection
    const lookbackData = data.slice(-this.swingLookback);
    
    // Find highest high and lowest low in the lookback period
    let swingHigh = lookbackData[0].high;
    let swingLow = lookbackData[0].low;

    for (const candle of lookbackData) {
      if (candle.high > swingHigh) {
        swingHigh = candle.high;
      }
      if (candle.low < swingLow) {
        swingLow = candle.low;
      }
    }

    // Try to find more significant swing points using pivot logic
    const pivotHigh = this.findPivotHigh(lookbackData);
    const pivotLow = this.findPivotLow(lookbackData);

    return {
      high: pivotHigh || swingHigh,
      low: pivotLow || swingLow
    };
  }

  /**
   * Find pivot high using simple pivot logic
   */
  private findPivotHigh(data: OHLCV[], leftBars: number = 5, rightBars: number = 5): number | null {
    if (data.length < leftBars + rightBars + 1) return null;

    let maxHigh = 0;
    let maxIndex = -1;

    // Look for the highest point that has lower highs on both sides
    for (let i = leftBars; i < data.length - rightBars; i++) {
      const currentHigh = data[i].high;
      let isPivot = true;

      // Check left side
      for (let j = i - leftBars; j < i; j++) {
        if (data[j].high >= currentHigh) {
          isPivot = false;
          break;
        }
      }

      // Check right side
      if (isPivot) {
        for (let j = i + 1; j <= i + rightBars; j++) {
          if (data[j].high >= currentHigh) {
            isPivot = false;
            break;
          }
        }
      }

      if (isPivot && currentHigh > maxHigh) {
        maxHigh = currentHigh;
        maxIndex = i;
      }
    }

    return maxIndex >= 0 ? maxHigh : null;
  }

  /**
   * Find pivot low using simple pivot logic
   */
  private findPivotLow(data: OHLCV[], leftBars: number = 5, rightBars: number = 5): number | null {
    if (data.length < leftBars + rightBars + 1) return null;

    let minLow = Infinity;
    let minIndex = -1;

    // Look for the lowest point that has higher lows on both sides
    for (let i = leftBars; i < data.length - rightBars; i++) {
      const currentLow = data[i].low;
      let isPivot = true;

      // Check left side
      for (let j = i - leftBars; j < i; j++) {
        if (data[j].low <= currentLow) {
          isPivot = false;
          break;
        }
      }

      // Check right side
      if (isPivot) {
        for (let j = i + 1; j <= i + rightBars; j++) {
          if (data[j].low <= currentLow) {
            isPivot = false;
            break;
          }
        }
      }

      if (isPivot && currentLow < minLow) {
        minLow = currentLow;
        minIndex = i;
      }
    }

    return minIndex >= 0 ? minLow : null;
  }

  /**
   * Calculate all Fibonacci levels
   */
  private calculateFibonacciLevels(
    swingHigh: number, 
    swingLow: number, 
    autoDetected: boolean
  ): FibonacciRetracementResult {
    const range = Math.abs(swingHigh - swingLow);
    const trendDirection = swingHigh > swingLow ? 'UP' : 'DOWN';

    // Determine base levels to use
    let fibLevels = [...FibonacciRetracement.STANDARD_RETRACEMENT_LEVELS];
    
    if (this.customLevels.length > 0) {
      fibLevels = [...this.customLevels];
    }

    // Calculate retracement levels
    const retracements: FibonacciLevel[] = fibLevels.map(ratio => {
      const price = trendDirection === 'UP' ? 
        swingHigh - (range * ratio) : 
        swingLow + (range * ratio);
      
      return {
        ratio,
        price,
        name: this.getFibLevelName(ratio),
        type: 'RETRACEMENT'
      };
    });

    let extensions: FibonacciLevel[] = [];
    if (this.includeExtensions) {
      extensions = FibonacciRetracement.STANDARD_EXTENSION_LEVELS.map(ratio => {
        const price = trendDirection === 'UP' ? 
          swingHigh + (range * (ratio - 1)) : 
          swingLow - (range * (ratio - 1));
        
        return {
          ratio,
          price,
          name: this.getFibLevelName(ratio),
          type: 'EXTENSION'
        };
      });
    }

    const allLevels = [...retracements, ...extensions];

    return {
      swingHigh,
      swingLow,
      range,
      levels: allLevels,
      retracements,
      extensions: this.includeExtensions ? extensions : undefined,
      trendDirection,
      autoDetected
    };
  }

  /**
   * Get Fibonacci level name
   */
  private getFibLevelName(ratio: number): string {
    const percentage = Math.round(ratio * 1000) / 10;
    
    switch (ratio) {
      case 0: return '0%';
      case 0.236: return '23.6%';
      case 0.382: return '38.2%';
      case 0.5: return '50%';
      case 0.618: return '61.8%';
      case 0.786: return '78.6%';
      case 1: return '100%';
      case 1.272: return '127.2%';
      case 1.618: return '161.8%';
      case 2.618: return '261.8%';
      default: return `${percentage}%`;
    }
  }

  /**
   * Create empty result when insufficient data
   */
  private createEmptyResult(): FibonacciRetracementResult {
    return {
      swingHigh: 0,
      swingLow: 0,
      range: 0,
      levels: [],
      retracements: [],
      extensions: this.includeExtensions ? [] : undefined,
      trendDirection: 'UP',
      autoDetected: false
    };
  }

  /**
   * Update manual swing points
   */
  setSwingPoints(high: number, low: number): void {
    this.manualSwingHigh = high;
    this.manualSwingLow = low;
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    // Keep manual swing points if set
  }

  /**
   * Validate Fibonacci Retracement configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const fibConfig = config as FibonacciRetracementConfig;

    const validMethods = ['AUTO', 'MANUAL'];
    if (fibConfig.swingDetectionMethod && !validMethods.includes(fibConfig.swingDetectionMethod)) {
      throw new Error(`Invalid swing detection method: ${fibConfig.swingDetectionMethod}. Valid methods: ${validMethods.join(', ')}`);
    }

    if (fibConfig.swingLookback !== undefined && fibConfig.swingLookback <= 0) {
      throw new Error('Swing lookback period must be positive');
    }

    if (fibConfig.swingDetectionMethod === 'MANUAL') {
      if (fibConfig.swingHigh === undefined || fibConfig.swingLow === undefined) {
        throw new Error('Manual swing high and low must be provided when using MANUAL method');
      }
      if (fibConfig.swingHigh <= fibConfig.swingLow) {
        throw new Error('Swing high must be greater than swing low');
      }
    }

    if (fibConfig.customLevels) {
      for (const level of fibConfig.customLevels) {
        if (level < 0) {
          throw new Error('Custom Fibonacci levels must be non-negative');
        }
      }
    }
  }

  /**
   * Get Fibonacci Retracement metadata
   */
  protected getResultMetadata(value: FibonacciRetracementResult, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      swingDetectionMethod: this.swingDetectionMethod,
      swingLookback: this.swingLookback,
      includeExtensions: this.includeExtensions,
      levelsCount: value.levels.length,
      rangePercent: this.calculateRangePercent(value)
    };
  }

  /**
   * Calculate range as percentage of price
   */
  private calculateRangePercent(result: FibonacciRetracementResult): number {
    if (result.swingHigh === 0) return 0;
    return (result.range / result.swingHigh) * 100;
  }

  /**
   * Get nearest Fibonacci level for given price
   */
  getNearestLevel(price: number): FibonacciLevel | null {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return null;

    const result = latestResult.value as FibonacciRetracementResult;
    if (result.levels.length === 0) return null;

    let nearestLevel = result.levels[0];
    let minDistance = Math.abs(price - nearestLevel.price);

    for (const level of result.levels) {
      const distance = Math.abs(price - level.price);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLevel = level;
      }
    }

    return nearestLevel;
  }

  /**
   * Get Fibonacci level above given price
   */
  getLevelAbove(price: number): FibonacciLevel | null {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return null;

    const result = latestResult.value as FibonacciRetracementResult;
    const levelsAbove = result.levels
      .filter(level => level.price > price)
      .sort((a, b) => a.price - b.price);

    return levelsAbove.length > 0 ? levelsAbove[0] : null;
  }

  /**
   * Get Fibonacci level below given price
   */
  getLevelBelow(price: number): FibonacciLevel | null {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return null;

    const result = latestResult.value as FibonacciRetracementResult;
    const levelsBelow = result.levels
      .filter(level => level.price < price)
      .sort((a, b) => b.price - a.price);

    return levelsBelow.length > 0 ? levelsBelow[0] : null;
  }

  /**
   * Check if price is near a Fibonacci level
   */
  isPriceNearLevel(price: number, threshold: number = 0.005): {
    isNear: boolean;
    level?: FibonacciLevel;
    distance?: number;
    distancePercent?: number;
  } {
    const nearestLevel = this.getNearestLevel(price);
    if (!nearestLevel) return { isNear: false };

    const distance = Math.abs(price - nearestLevel.price);
    const distancePercent = price > 0 ? (distance / price) * 100 : 0;
    const isNear = (distance / price) <= threshold;

    return {
      isNear,
      level: nearestLevel,
      distance,
      distancePercent
    };
  }

  /**
   * Get retracement percentage for current price
   */
  getRetracementPercent(price: number): number | null {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return null;

    const result = latestResult.value as FibonacciRetracementResult;
    if (result.range === 0) return null;

    const retracement = result.trendDirection === 'UP' ?
      (result.swingHigh - price) / result.range :
      (price - result.swingLow) / result.range;

    return Math.max(0, Math.min(1, retracement));
  }

  /**
   * Get all levels sorted by price
   */
  getLevelsSorted(): FibonacciLevel[] {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return [];

    const result = latestResult.value as FibonacciRetracementResult;
    return [...result.levels].sort((a, b) => a.price - b.price);
  }

  /**
   * Get key retracement levels (23.6%, 38.2%, 50%, 61.8%)
   */
  getKeyLevels(): FibonacciLevel[] {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return [];

    const result = latestResult.value as FibonacciRetracementResult;
    const keyRatios = [0.236, 0.382, 0.5, 0.618];
    
    return result.levels.filter(level => keyRatios.includes(level.ratio));
  }

  /**
   * Check if current price suggests a bounce from Fibonacci level
   */
  hasBounceSignal(currentPrice: number, previousPrice: number): 'BULLISH' | 'BEARISH' | 'NONE' {
    const nearLevel = this.isPriceNearLevel(currentPrice, 0.01);
    if (!nearLevel.isNear || !nearLevel.level) return 'NONE';

    const level = nearLevel.level;
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 'NONE';

    const result = latestResult.value as FibonacciRetracementResult;

    // Check for bounce based on trend direction
    if (result.trendDirection === 'UP') {
      // In uptrend, look for bullish bounce from support levels
      if (previousPrice < level.price && currentPrice > level.price) {
        return 'BULLISH';
      }
    } else {
      // In downtrend, look for bearish rejection from resistance levels
      if (previousPrice > level.price && currentPrice < level.price) {
        return 'BEARISH';
      }
    }

    return 'NONE';
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `FibonacciRetracement(${this.swingDetectionMethod}) [${this.getStatus()}] Value: N/A`;
    }

    const result = latestResult.value as FibonacciRetracementResult;
    const rangePercent = this.calculateRangePercent(result);
    
    return `FibonacciRetracement(${this.swingDetectionMethod}) [${this.getStatus()}] ` +
           `Range: ${result.range.toFixed(4)} (${rangePercent.toFixed(2)}%), ` +
           `Levels: ${result.levels.length}, Trend: ${result.trendDirection}`;
  }
}