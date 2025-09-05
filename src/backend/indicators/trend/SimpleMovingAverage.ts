/**
 * Simple Moving Average (SMA) Indicator - Task BE-010
 * 
 * Calculates the arithmetic mean of closing prices over a specified period.
 * Provides equal weighting to all data points in the period.
 * 
 * Formula: SMA = (P1 + P2 + ... + Pn) / n
 * Where P = Price, n = Period
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, IndicatorResult, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface SMAConfig extends IndicatorConfig {
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
}

/**
 * Simple Moving Average implementation with streaming optimization
 */
export class SimpleMovingAverage extends TechnicalIndicator<number> {
  private readonly priceType: string;
  private priceBuffer: NumericCircularBuffer;
  private runningSum = 0;

  constructor(config: SMAConfig) {
    super('SMA', config);
    this.priceType = config.priceType || 'close';
    this.priceBuffer = new NumericCircularBuffer(config.period * 2);
  }

  /**
   * Calculate SMA value for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length === 0) {
      return 0;
    }

    // Extract prices based on price type
    const prices = this.extractPrices(data);
    
    // Calculate SMA for the most recent period
    return mathUtils.sma(prices, this.config.period);
  }

  /**
   * Optimized streaming update using running sum
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const newPrice = this.extractPrice(newCandle);
    
    // Update price buffer
    const wasFullBefore = this.priceBuffer.isFull();
    const oldestPrice = this.priceBuffer.peekNext();
    this.priceBuffer.push(newPrice);

    // Update running sum efficiently
    if (wasFullBefore && oldestPrice !== undefined) {
      // Replace oldest price with new price
      this.runningSum = this.runningSum - oldestPrice + newPrice;
    } else {
      // Buffer not full yet, just add new price
      this.runningSum += newPrice;
    }

    // Calculate SMA from running sum
    const count = Math.min(this.priceBuffer.size(), this.config.period);
    return count > 0 ? this.runningSum / count : 0;
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
    this.runningSum = 0;
  }

  /**
   * Validate SMA-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const smaConfig = config as SMAConfig;
    
    if (smaConfig.priceType && !this.isValidPriceType(smaConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${smaConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }
  }

  /**
   * Get SMA-specific metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      runningSum: this.runningSum,
      smoothness: this.calculateSmoothness(data)
    };
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
   * Calculate smoothness metric (lower values indicate more stable trend)
   */
  private calculateSmoothness(data: OHLCV[]): number {
    if (data.length < this.config.period + 1) {
      return 0;
    }

    const prices = this.extractPrices(data);
    const smaValues: number[] = [];
    
    // Calculate SMA values for smoothness analysis
    for (let i = this.config.period - 1; i < prices.length; i++) {
      const windowPrices = prices.slice(i - this.config.period + 1, i + 1);
      smaValues.push(mathUtils.sma(windowPrices, this.config.period));
    }

    // Calculate standard deviation of SMA changes
    if (smaValues.length < 2) {
      return 0;
    }

    const changes = [];
    for (let i = 1; i < smaValues.length; i++) {
      changes.push(Math.abs(smaValues[i] - smaValues[i - 1]));
    }

    return mathUtils.stdDev(changes);
  }

  /**
   * Get current price buffer state for debugging
   */
  getPriceBuffer(): number[] {
    return this.priceBuffer.getAll();
  }

  /**
   * Get current running sum
   */
  getRunningSum(): number {
    return this.runningSum;
  }

  /**
   * Calculate slope of the SMA (trend direction)
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
   * Check if SMA is trending upward
   */
  isTrendingUp(lookbackPeriods: number = 3): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) {
      return false;
    }

    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      if (current <= previous) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if SMA is trending downward
   */
  isTrendingDown(lookbackPeriods: number = 3): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) {
      return false;
    }

    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      if (current >= previous) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate percentage distance from current price to SMA
   */
  getPercentageDistance(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult || !latestResult.isValid) {
      return 0;
    }

    const smaValue = latestResult.value as number;
    return smaValue !== 0 ? ((currentPrice - smaValue) / smaValue) * 100 : 0;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `SMA(${this.config.period}, ${this.priceType}) [${this.getStatus()}] ` +
           `Value: ${this.getLatestResult()?.value || 'N/A'}`;
  }
}