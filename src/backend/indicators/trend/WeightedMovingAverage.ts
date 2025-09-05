/**
 * Weighted Moving Average (WMA) Indicator - Task BE-010
 * 
 * Calculates a moving average that applies linearly increasing weights to more recent data.
 * Most recent price gets weight n, second most recent gets weight n-1, etc.
 * 
 * Formula: WMA = (P1×n + P2×(n-1) + ... + Pn×1) / (n + (n-1) + ... + 1)
 * Where P = Price, n = Period
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, IndicatorResult, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface WMAConfig extends IndicatorConfig {
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Custom weight distribution (if not provided, uses linear weights) */
  customWeights?: number[];
}

/**
 * Weighted Moving Average implementation with streaming optimization
 */
export class WeightedMovingAverage extends TechnicalIndicator<number> {
  private readonly priceType: string;
  private readonly weights: number[];
  private readonly weightSum: number;
  private priceBuffer: NumericCircularBuffer;
  private weightedSum = 0;

  constructor(config: WMAConfig) {
    super('WMA', config);
    this.priceType = config.priceType || 'close';
    
    // Initialize weights
    if (config.customWeights && config.customWeights.length === config.period) {
      this.weights = [...config.customWeights];
    } else {
      // Linear weights: n, n-1, n-2, ..., 1
      this.weights = [];
      for (let i = config.period; i > 0; i--) {
        this.weights.push(i);
      }
    }
    
    // Calculate weight sum for normalization
    this.weightSum = this.weights.reduce((sum, weight) => sum + weight, 0);
    
    this.priceBuffer = new NumericCircularBuffer(config.period);
  }

  /**
   * Calculate WMA value for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length === 0) {
      return 0;
    }

    const prices = this.extractPrices(data);
    return this.calculateWMAFromPrices(prices);
  }

  /**
   * Optimized streaming update using running weighted sum
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const newPrice = this.extractPrice(newCandle);
    
    // Update price buffer
    const wasFullBefore = this.priceBuffer.isFull();
    const oldestPrice = this.priceBuffer.peekNext();
    this.priceBuffer.push(newPrice);

    if (wasFullBefore && this.priceBuffer.size() === this.config.period) {
      // Full buffer - recalculate more efficiently
      const prices = this.priceBuffer.getAll();
      this.weightedSum = this.calculateWeightedSum(prices);
    } else {
      // Buffer filling up - recalculate from scratch
      const prices = this.priceBuffer.getAll();
      this.weightedSum = this.calculateWeightedSum(prices);
    }

    // Calculate WMA
    const currentWeightSum = this.calculateCurrentWeightSum();
    return currentWeightSum > 0 ? this.weightedSum / currentWeightSum : 0;
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
    this.weightedSum = 0;
  }

  /**
   * Validate WMA-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const wmaConfig = config as WMAConfig;
    
    if (wmaConfig.priceType && !this.isValidPriceType(wmaConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${wmaConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }

    if (wmaConfig.customWeights) {
      if (wmaConfig.customWeights.length !== config.period) {
        throw new Error(
          `Custom weights length (${wmaConfig.customWeights.length}) ` +
          `must match period (${config.period})`
        );
      }

      if (wmaConfig.customWeights.some(w => w < 0)) {
        throw new Error('All custom weights must be non-negative');
      }

      if (wmaConfig.customWeights.every(w => w === 0)) {
        throw new Error('At least one custom weight must be positive');
      }
    }
  }

  /**
   * Get WMA-specific metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      weights: this.weights,
      weightSum: this.weightSum,
      weightedSum: this.weightedSum,
      responsiveness: this.calculateResponsiveness()
    };
  }

  /**
   * Calculate WMA from array of prices
   */
  private calculateWMAFromPrices(prices: number[]): number {
    if (prices.length === 0) {
      return 0;
    }

    // Use most recent data up to period length
    const recentPrices = prices.slice(-Math.min(prices.length, this.config.period));
    const weightedSum = this.calculateWeightedSum(recentPrices);
    const currentWeightSum = this.calculateWeightSumForLength(recentPrices.length);
    
    return currentWeightSum > 0 ? weightedSum / currentWeightSum : 0;
  }

  /**
   * Calculate weighted sum for given prices
   */
  private calculateWeightedSum(prices: number[]): number {
    if (prices.length === 0) {
      return 0;
    }

    let sum = 0;
    const weightsToUse = this.weights.slice(-prices.length); // Use appropriate weights
    
    for (let i = 0; i < prices.length; i++) {
      sum += prices[i] * weightsToUse[i];
    }
    
    return sum;
  }

  /**
   * Calculate current weight sum based on buffer size
   */
  private calculateCurrentWeightSum(): number {
    return this.calculateWeightSumForLength(this.priceBuffer.size());
  }

  /**
   * Calculate weight sum for specific length
   */
  private calculateWeightSumForLength(length: number): number {
    if (length === 0) {
      return 0;
    }
    
    const weightsToUse = this.weights.slice(-length);
    return weightsToUse.reduce((sum, weight) => sum + weight, 0);
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
   * Calculate responsiveness metric based on weight distribution
   */
  private calculateResponsiveness(): number {
    // Calculate center of mass of weights (closer to 1 = more responsive)
    let weightedPosition = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < this.weights.length; i++) {
      const position = (i + 1) / this.weights.length; // Position from 0 to 1
      weightedPosition += position * this.weights[this.weights.length - 1 - i];
      totalWeight += this.weights[this.weights.length - 1 - i];
    }
    
    return totalWeight > 0 ? weightedPosition / totalWeight : 0;
  }

  /**
   * Get current weights array
   */
  getWeights(): number[] {
    return [...this.weights];
  }

  /**
   * Get effective weight of most recent price
   */
  getRecentPriceWeight(): number {
    return this.weights[0]; // First weight is for most recent price
  }

  /**
   * Get weight distribution as percentages
   */
  getWeightPercentages(): number[] {
    return this.weights.map(weight => (weight / this.weightSum) * 100);
  }

  /**
   * Calculate slope of the WMA (trend direction and strength)
   */
  getSlope(lookbackPeriods: number = 2): number {
    const results = this.getResults(lookbackPeriods);
    if (results.length < 2) {
      return 0;
    }

    const latest = results[results.length - 1].value as number;
    const previous = results[results.length - 2].value as number;
    
    return latest - previous;
  }

  /**
   * Check if WMA is trending upward with strength
   */
  isTrendingUp(lookbackPeriods: number = 3, minSlope: number = 0): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) {
      return false;
    }

    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      const slope = current - previous;
      
      if (slope <= minSlope) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if WMA is trending downward with strength
   */
  isTrendingDown(lookbackPeriods: number = 3, minSlope: number = 0): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) {
      return false;
    }

    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      const slope = current - previous;
      
      if (slope >= minSlope) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate percentage distance from current price to WMA
   */
  getPercentageDistance(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult || !latestResult.isValid) {
      return 0;
    }

    const wmaValue = latestResult.value as number;
    return wmaValue !== 0 ? ((currentPrice - wmaValue) / wmaValue) * 100 : 0;
  }

  /**
   * Compare WMA with SMA and EMA of same period
   */
  compareWithOtherMA(data: OHLCV[]): {
    wma: number;
    sma: number;
    ema: number;
    wmaVsSma: number;
    wmaVsEma: number;
  } {
    const prices = this.extractPrices(data);
    const wmaValue = this.calculateWMAFromPrices(prices);
    const smaValue = mathUtils.sma(prices, this.config.period);
    const emaValue = mathUtils.ema(prices, this.config.period);
    
    return {
      wma: wmaValue,
      sma: smaValue,
      ema: emaValue,
      wmaVsSma: wmaValue - smaValue,
      wmaVsEma: wmaValue - emaValue
    };
  }

  /**
   * Calculate the lag compared to price (lower lag = more responsive)
   */
  calculateLag(data: OHLCV[], priceLookback: number = 5): number {
    if (data.length < priceLookback + this.config.period) {
      return 0;
    }

    const prices = this.extractPrices(data);
    const wmaValues = [];
    
    // Calculate WMA for multiple periods
    for (let i = this.config.period - 1; i < prices.length; i++) {
      const windowPrices = prices.slice(i - this.config.period + 1, i + 1);
      wmaValues.push(this.calculateWMAFromPrices([...prices.slice(0, i + 1)]));
    }

    if (wmaValues.length < priceLookback) {
      return 0;
    }

    // Compare WMA movement to price movement
    const priceChanges = [];
    const wmaChanges = [];
    const recentPrices = prices.slice(-priceLookback);
    const recentWMA = wmaValues.slice(-priceLookback);

    for (let i = 1; i < priceLookback; i++) {
      priceChanges.push(recentPrices[i] - recentPrices[i - 1]);
      wmaChanges.push(recentWMA[i] - recentWMA[i - 1]);
    }

    // Calculate correlation (higher correlation = lower lag)
    const correlation = mathUtils.correlation(priceChanges, wmaChanges);
    return 1 - Math.abs(correlation); // Convert to lag metric (0 = no lag, 1 = maximum lag)
  }

  /**
   * Get string representation
   */
  toString(): string {
    const weightStr = this.weights.length <= 5 ? 
      `[${this.weights.join(',')}]` : 
      `[${this.weights[0]},${this.weights[1]},...,${this.weights[this.weights.length-1]}]`;
    
    return `WMA(${this.config.period}, ${this.priceType}) ${weightStr} ` +
           `[${this.getStatus()}] Value: ${this.getLatestResult()?.value || 'N/A'}`;
  }
}