/**
 * Bollinger Bands Indicator - Task BE-010
 * 
 * Bollinger Bands consist of a middle line (Simple Moving Average) and two outer lines
 * that are standard deviations away from the middle line. They adapt to volatility
 * and provide dynamic support and resistance levels.
 * 
 * Components:
 * - Middle Line: Simple Moving Average (typically 20 periods)
 * - Upper Band: Middle Line + (Standard Deviation × Multiplier)
 * - Lower Band: Middle Line - (Standard Deviation × Multiplier)
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, BollingerBandsResult, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface BollingerBandsConfig extends IndicatorConfig {
  /** Standard deviation multiplier (default: 2.0) */
  stdDevMultiplier?: number;
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
}

/**
 * Bollinger Bands implementation with streaming optimization
 */
export class BollingerBands extends TechnicalIndicator<{ upper: number; middle: number; lower: number; }> {
  private readonly stdDevMultiplier: number;
  private readonly priceType: string;

  // Buffers for streaming calculations
  private priceBuffer: NumericCircularBuffer;
  private runningSum = 0;
  private runningSumSquares = 0;

  constructor(config: BollingerBandsConfig) {
    super('BB', { ...config, stdDevMultiplier: config.stdDevMultiplier || 2.0 });
    
    this.stdDevMultiplier = config.stdDevMultiplier || 2.0;
    this.priceType = config.priceType || 'close';

    // Initialize buffer
    this.priceBuffer = new NumericCircularBuffer(config.period);
  }

  /**
   * Calculate Bollinger Bands for given data
   */
  protected calculateValue(data: OHLCV[]): { upper: number; middle: number; lower: number; } {
    if (data.length === 0) {
      return { upper: 0, middle: 0, lower: 0 };
    }

    const prices = this.extractPrices(data);
    return this.calculateBollingerBands(prices);
  }

  /**
   * Optimized streaming update using running statistics
   */
  protected streamingUpdate(
    newCandle: OHLCV, 
    context?: StreamingContext
  ): { upper: number; middle: number; lower: number; } {
    const newPrice = this.extractPrice(newCandle);
    
    // Update price buffer and running sums
    const wasFullBefore = this.priceBuffer.isFull();
    const oldestPrice = this.priceBuffer.peekNext();
    
    this.priceBuffer.push(newPrice);

    if (wasFullBefore && oldestPrice !== undefined) {
      // Update running sums efficiently for full buffer
      this.runningSum = this.runningSum - oldestPrice + newPrice;
      this.runningSumSquares = this.runningSumSquares - (oldestPrice * oldestPrice) + (newPrice * newPrice);
    } else {
      // Buffer not full yet, add new values
      this.runningSum += newPrice;
      this.runningSumSquares += newPrice * newPrice;
    }

    // Calculate Bollinger Bands from running statistics
    const count = this.priceBuffer.size();
    if (count === 0) {
      return { upper: 0, middle: 0, lower: 0 };
    }

    const middle = this.runningSum / count;
    
    // Calculate standard deviation using running sums
    let stdDev = 0;
    if (count > 1) {
      const variance = (this.runningSumSquares - (this.runningSum * this.runningSum) / count) / (count - 1);
      stdDev = Math.sqrt(Math.max(0, variance)); // Ensure non-negative for numerical stability
    }

    const offset = stdDev * this.stdDevMultiplier;
    
    return {
      upper: middle + offset,
      middle,
      lower: middle - offset
    };
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
    this.runningSum = 0;
    this.runningSumSquares = 0;
  }

  /**
   * Validate Bollinger Bands-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const bbConfig = config as BollingerBandsConfig;
    
    if (bbConfig.stdDevMultiplier !== undefined && bbConfig.stdDevMultiplier <= 0) {
      throw new Error('Standard deviation multiplier must be positive');
    }

    if (bbConfig.priceType && !this.isValidPriceType(bbConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${bbConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }
  }

  /**
   * Get Bollinger Bands-specific metadata
   */
  protected getResultMetadata(
    value: { upper: number; middle: number; lower: number; }, 
    data: OHLCV[]
  ): Record<string, any> {
    const bandwidth = this.calculateBandwidth(value);
    const percentB = this.calculatePercentB(value, data);
    
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      stdDevMultiplier: this.stdDevMultiplier,
      bandwidth,
      percentB,
      squeeze: bandwidth < 0.1, // Bollinger Band Squeeze indicator
      expansion: bandwidth > 0.25, // Band expansion
      position: this.analyzePricePosition(value, data)
    };
  }

  /**
   * Calculate Bollinger Bands from price array
   */
  private calculateBollingerBands(prices: number[]): { upper: number; middle: number; lower: number; } {
    if (prices.length < this.config.period) {
      const lastPrice = prices[prices.length - 1] || 0;
      return { upper: lastPrice, middle: lastPrice, lower: lastPrice };
    }

    // Use most recent data
    const recentPrices = prices.slice(-this.config.period);
    
    // Calculate middle line (SMA)
    const middle = mathUtils.sma(recentPrices, this.config.period);
    
    // Calculate standard deviation
    const stdDev = mathUtils.stdDev(recentPrices);
    
    // Calculate bands
    const offset = stdDev * this.stdDevMultiplier;
    
    return {
      upper: middle + offset,
      middle,
      lower: middle - offset
    };
  }

  /**
   * Calculate bandwidth (measure of volatility)
   */
  private calculateBandwidth(bands: { upper: number; middle: number; lower: number; }): number {
    if (bands.middle === 0) {
      return 0;
    }
    
    return (bands.upper - bands.lower) / bands.middle;
  }

  /**
   * Calculate %B (price position within bands)
   */
  private calculatePercentB(
    bands: { upper: number; middle: number; lower: number; }, 
    data: OHLCV[]
  ): number {
    if (data.length === 0) {
      return 0.5;
    }

    const currentPrice = this.extractPrice(data[data.length - 1]);
    const bandWidth = bands.upper - bands.lower;
    
    if (bandWidth === 0) {
      return 0.5; // Neutral position if bands have collapsed
    }
    
    return (currentPrice - bands.lower) / bandWidth;
  }

  /**
   * Analyze price position relative to bands
   */
  private analyzePricePosition(
    bands: { upper: number; middle: number; lower: number; }, 
    data: OHLCV[]
  ): string {
    if (data.length === 0) {
      return 'unknown';
    }

    const currentPrice = this.extractPrice(data[data.length - 1]);
    const percentB = this.calculatePercentB(bands, data);

    if (currentPrice > bands.upper) {
      return 'above_upper';
    } else if (currentPrice < bands.lower) {
      return 'below_lower';
    } else if (percentB > 0.8) {
      return 'near_upper';
    } else if (percentB < 0.2) {
      return 'near_lower';
    } else if (percentB > 0.6) {
      return 'upper_half';
    } else if (percentB < 0.4) {
      return 'lower_half';
    } else {
      return 'middle';
    }
  }

  /**
   * Extract prices based on configured price type
   */
  private extractPrices(data: OHLCV[]): number[] {
    return data.map(candle => this.extractPrice(candle));
  }

  /**
   * Extract single price based on price type
   */
  private extractPrice(candle: OHLCV): number {
    switch (this.priceType) {
      case 'open':
        return candle.open;
      case 'high':
        return candle.high;
      case 'low':
        return candle.low;
      case 'close':
        return candle.close;
      case 'hl2':
        return (candle.high + candle.low) / 2;
      case 'hlc3':
        return (candle.high + candle.low + candle.close) / 3;
      case 'ohlc4':
        return (candle.open + candle.high + candle.low + candle.close) / 4;
      default:
        return candle.close;
    }
  }

  /**
   * Check if price type is valid
   */
  private isValidPriceType(priceType: string): boolean {
    return ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4'].includes(priceType);
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  /**
   * Get current band values
   */
  getCurrentBands(): { upper: number; middle: number; lower: number; } | undefined {
    const latest = this.getLatestResult();
    return latest?.value;
  }

  /**
   * Calculate current %B for a given price
   */
  getPercentB(price: number): number {
    const bands = this.getCurrentBands();
    if (!bands) {
      return 0.5;
    }

    const bandWidth = bands.upper - bands.lower;
    return bandWidth === 0 ? 0.5 : (price - bands.lower) / bandWidth;
  }

  /**
   * Calculate current bandwidth
   */
  getBandwidth(): number {
    const bands = this.getCurrentBands();
    if (!bands) {
      return 0;
    }

    return this.calculateBandwidth(bands);
  }

  /**
   * Check if bands are in squeeze (low volatility)
   */
  isSqueeze(threshold: number = 0.1): boolean {
    return this.getBandwidth() < threshold;
  }

  /**
   * Check if bands are expanding (high volatility)
   */
  isExpansion(threshold: number = 0.25): boolean {
    return this.getBandwidth() > threshold;
  }

  /**
   * Check if price is outside bands (potential reversal signal)
   */
  isPriceOutsideBands(price: number): 'above' | 'below' | 'inside' {
    const bands = this.getCurrentBands();
    if (!bands) {
      return 'inside';
    }

    if (price > bands.upper) {
      return 'above';
    } else if (price < bands.lower) {
      return 'below';
    } else {
      return 'inside';
    }
  }

  /**
   * Detect band walking (price consistently near one band)
   */
  detectBandWalking(lookback: number = 5, threshold: number = 0.1): 'upper' | 'lower' | 'none' {
    const results = this.getResults(lookback);
    if (results.length < lookback) {
      return 'none';
    }

    let upperWalkCount = 0;
    let lowerWalkCount = 0;

    for (const result of results) {
      const percentB = result.metadata?.percentB as number;
      if (percentB !== undefined) {
        if (percentB > (1 - threshold)) {
          upperWalkCount++;
        } else if (percentB < threshold) {
          lowerWalkCount++;
        }
      }
    }

    const walkThreshold = Math.ceil(lookback * 0.7); // 70% of periods

    if (upperWalkCount >= walkThreshold) {
      return 'upper';
    } else if (lowerWalkCount >= walkThreshold) {
      return 'lower';
    } else {
      return 'none';
    }
  }

  /**
   * Calculate band squeeze duration
   */
  getSqueezeDuration(threshold: number = 0.1): number {
    const results = this.getResults();
    let duration = 0;

    for (let i = results.length - 1; i >= 0; i--) {
      const bandwidth = results[i].metadata?.bandwidth as number;
      if (bandwidth !== undefined && bandwidth < threshold) {
        duration++;
      } else {
        break;
      }
    }

    return duration;
  }

  /**
   * Get band direction (expanding or contracting)
   */
  getBandDirection(lookback: number = 3): 'expanding' | 'contracting' | 'stable' {
    const results = this.getResults(lookback);
    if (results.length < 2) {
      return 'stable';
    }

    const bandwidths = results.map(r => r.metadata?.bandwidth as number).filter(bw => bw !== undefined);
    if (bandwidths.length < 2) {
      return 'stable';
    }

    let expandingCount = 0;
    let contractingCount = 0;

    for (let i = 1; i < bandwidths.length; i++) {
      if (bandwidths[i] > bandwidths[i - 1]) {
        expandingCount++;
      } else if (bandwidths[i] < bandwidths[i - 1]) {
        contractingCount++;
      }
    }

    if (expandingCount > contractingCount) {
      return 'expanding';
    } else if (contractingCount > expandingCount) {
      return 'contracting';
    } else {
      return 'stable';
    }
  }

  /**
   * Detect potential reversal signals
   */
  getReversalSignals(price: number, lookback: number = 3): {
    oversoldBounce: boolean;
    overboughtRejection: boolean;
    middleLineTest: boolean;
  } {
    const bands = this.getCurrentBands();
    if (!bands) {
      return { oversoldBounce: false, overboughtRejection: false, middleLineTest: false };
    }

    const results = this.getResults(lookback);
    const percentB = this.getPercentB(price);

    // Check for oversold bounce (price below lower band, now moving up)
    let oversoldBounce = false;
    if (results.length >= 2) {
      const prevPercentB = results[results.length - 2].metadata?.percentB as number;
      oversoldBounce = prevPercentB < 0 && percentB > 0.1;
    }

    // Check for overbought rejection (price above upper band, now moving down)
    let overboughtRejection = false;
    if (results.length >= 2) {
      const prevPercentB = results[results.length - 2].metadata?.percentB as number;
      overboughtRejection = prevPercentB > 1 && percentB < 0.9;
    }

    // Check for middle line test
    const middleLineTest = Math.abs(price - bands.middle) / bands.middle < 0.01;

    return { oversoldBounce, overboughtRejection, middleLineTest };
  }

  /**
   * Calculate volatility breakout potential
   */
  getBreakoutPotential(): number {
    const bandwidth = this.getBandwidth();
    const squeezeDuration = this.getSqueezeDuration();
    
    // Higher potential when bands are squeezed for longer periods
    let potential = 0;
    
    if (bandwidth < 0.05) {
      potential += 0.5; // Very tight bands
    } else if (bandwidth < 0.1) {
      potential += 0.3; // Moderately tight bands
    }
    
    // Add bonus for squeeze duration
    potential += Math.min(squeezeDuration * 0.1, 0.5);
    
    return Math.min(potential, 1); // Cap at 1.0
  }

  /**
   * Get Bollinger Band trading signals
   */
  getTradingSignals(price: number): {
    signal: 'buy' | 'sell' | 'hold';
    strength: number;
    reason: string;
  } {
    const bands = this.getCurrentBands();
    if (!bands) {
      return { signal: 'hold', strength: 0, reason: 'insufficient_data' };
    }

    const percentB = this.getPercentB(price);
    const bandwidth = this.getBandwidth();
    const reversal = this.getReversalSignals(price);
    
    // Oversold bounce signal
    if (reversal.oversoldBounce && bandwidth > 0.1) {
      return { signal: 'buy', strength: 0.7, reason: 'oversold_bounce' };
    }
    
    // Overbought rejection signal
    if (reversal.overboughtRejection && bandwidth > 0.1) {
      return { signal: 'sell', strength: 0.7, reason: 'overbought_rejection' };
    }
    
    // Squeeze breakout signals
    if (this.isSqueeze() && this.getBandDirection() === 'expanding') {
      if (percentB > 0.6) {
        return { signal: 'buy', strength: 0.6, reason: 'squeeze_breakout_up' };
      } else if (percentB < 0.4) {
        return { signal: 'sell', strength: 0.6, reason: 'squeeze_breakout_down' };
      }
    }
    
    return { signal: 'hold', strength: 0, reason: 'no_signal' };
  }

  /**
   * Get string representation
   */
  toString(): string {
    const bands = this.getCurrentBands();
    const bandwidth = this.getBandwidth();
    
    let valueStr = 'N/A';
    if (bands) {
      valueStr = `U:${bands.upper.toFixed(4)} M:${bands.middle.toFixed(4)} L:${bands.lower.toFixed(4)}`;
    }
    
    return `BB(${this.config.period}, ${this.stdDevMultiplier}) ` +
           `[${this.getStatus()}] ${valueStr} BW:${bandwidth.toFixed(4)}`;
  }
}