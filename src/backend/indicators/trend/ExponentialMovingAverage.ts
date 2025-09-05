/**
 * Exponential Moving Average (EMA) Indicator - Task BE-010
 * 
 * Calculates a moving average that gives more weight to recent prices.
 * Reacts more quickly to recent price changes compared to SMA.
 * 
 * Formula: EMA = (Price × α) + (Previous EMA × (1 - α))
 * Where α = 2 / (Period + 1) is the smoothing factor
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, IndicatorResult, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface EMAConfig extends IndicatorConfig {
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Custom smoothing factor (overrides period-based calculation) */
  customSmoothing?: number;
  /** Whether to use Wilder's smoothing method */
  wildersSmoothing?: boolean;
}

/**
 * Exponential Moving Average implementation with streaming optimization
 */
export class ExponentialMovingAverage extends TechnicalIndicator<number> {
  private readonly priceType: string;
  private readonly alpha: number; // Smoothing factor
  private priceBuffer: NumericCircularBuffer;
  private currentEMA?: number;
  private isWarmedUp = false;

  constructor(config: EMAConfig) {
    super('EMA', config);
    this.priceType = config.priceType || 'close';
    
    // Calculate smoothing factor
    if (config.customSmoothing !== undefined) {
      this.alpha = config.customSmoothing;
    } else if (config.wildersSmoothing) {
      // Wilder's smoothing: α = 1/n
      this.alpha = 1 / config.period;
    } else {
      // Standard EMA: α = 2/(n+1)
      this.alpha = 2 / (config.period + 1);
    }

    this.priceBuffer = new NumericCircularBuffer(config.period * 2);
  }

  /**
   * Calculate EMA value for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length === 0) {
      return 0;
    }

    const prices = this.extractPrices(data);
    return this.calculateEMAFromPrices(prices);
  }

  /**
   * Optimized streaming update using previous EMA value
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const newPrice = this.extractPrice(newCandle);
    this.priceBuffer.push(newPrice);

    if (!this.isWarmedUp) {
      // Initialize EMA with SMA of available data
      const prices = this.priceBuffer.getAll();
      if (prices.length >= this.config.period) {
        this.currentEMA = mathUtils.sma(prices.slice(-this.config.period), this.config.period);
        this.isWarmedUp = true;
      } else {
        this.currentEMA = mathUtils.sma(prices, prices.length);
      }
    } else {
      // Update EMA using streaming formula
      this.currentEMA = this.alpha * newPrice + (1 - this.alpha) * (this.currentEMA || newPrice);
    }

    return this.currentEMA || 0;
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
    this.currentEMA = undefined;
    this.isWarmedUp = false;
  }

  /**
   * Validate EMA-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const emaConfig = config as EMAConfig;
    
    if (emaConfig.priceType && !this.isValidPriceType(emaConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${emaConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }

    if (emaConfig.customSmoothing !== undefined) {
      if (emaConfig.customSmoothing <= 0 || emaConfig.customSmoothing > 1) {
        throw new Error('Custom smoothing factor must be between 0 and 1');
      }
    }
  }

  /**
   * Get EMA-specific metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      alpha: this.alpha,
      isWarmedUp: this.isWarmedUp,
      responsiveness: this.calculateResponsiveness(data)
    };
  }

  /**
   * Calculate EMA from array of prices
   */
  private calculateEMAFromPrices(prices: number[]): number {
    if (prices.length === 0) {
      return 0;
    }

    if (prices.length === 1) {
      return prices[0];
    }

    // Initialize with first value or SMA of first few values
    let ema: number;
    let startIndex: number;

    if (prices.length >= this.config.period) {
      // Use SMA of first period as seed
      ema = mathUtils.sma(prices.slice(0, this.config.period), this.config.period);
      startIndex = this.config.period;
    } else {
      // Use first price as seed
      ema = prices[0];
      startIndex = 1;
    }

    // Calculate EMA for remaining prices
    for (let i = startIndex; i < prices.length; i++) {
      ema = this.alpha * prices[i] + (1 - this.alpha) * ema;
    }

    return ema;
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
   * Calculate responsiveness metric (how quickly EMA reacts to price changes)
   */
  private calculateResponsiveness(data: OHLCV[]): number {
    // Higher alpha = more responsive to recent changes
    return this.alpha;
  }

  /**
   * Get current EMA state
   */
  getCurrentEMA(): number | undefined {
    return this.currentEMA;
  }

  /**
   * Get smoothing factor (alpha)
   */
  getAlpha(): number {
    return this.alpha;
  }

  /**
   * Check if EMA is warmed up (has enough data for stable calculation)
   */
  isEMAWarmedUp(): boolean {
    return this.isWarmedUp;
  }

  /**
   * Calculate the effective lookback period of the EMA
   * (period where 95% of the weight is contained)
   */
  getEffectiveLookback(): number {
    // 95% of weight is contained in approximately 3/alpha periods
    return Math.ceil(3 / this.alpha);
  }

  /**
   * Calculate EMA convergence rate (how quickly it approaches true value)
   */
  getConvergenceRate(): number {
    // After n periods, EMA retains (1-α)^n of the initial bias
    // This returns the number of periods to reduce bias to 5%
    return Math.ceil(Math.log(0.05) / Math.log(1 - this.alpha));
  }

  /**
   * Calculate slope of the EMA (trend direction and strength)
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
   * Calculate EMA acceleration (rate of change of slope)
   */
  getAcceleration(lookbackPeriods: number = 3): number {
    const results = this.getResults(lookbackPeriods);
    if (results.length < 3) {
      return 0;
    }

    const values = results.map(r => r.value as number);
    const slopes = [];
    
    for (let i = 1; i < values.length; i++) {
      slopes.push(values[i] - values[i - 1]);
    }
    
    return slopes[slopes.length - 1] - slopes[slopes.length - 2];
  }

  /**
   * Check if EMA is in strong uptrend
   */
  isStrongUptrend(minSlope: number = 0.1, lookbackPeriods: number = 3): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) {
      return false;
    }

    // Check if all recent slopes are positive and above threshold
    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      const slope = current - previous;
      
      if (slope < minSlope) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if EMA is in strong downtrend
   */
  isStrongDowntrend(minSlope: number = -0.1, lookbackPeriods: number = 3): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) {
      return false;
    }

    // Check if all recent slopes are negative and below threshold
    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      const slope = current - previous;
      
      if (slope > minSlope) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate percentage distance from current price to EMA
   */
  getPercentageDistance(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult || !latestResult.isValid) {
      return 0;
    }

    const emaValue = latestResult.value as number;
    return emaValue !== 0 ? ((currentPrice - emaValue) / emaValue) * 100 : 0;
  }

  /**
   * Compare EMA with Simple Moving Average of same period
   */
  compareWithSMA(data: OHLCV[]): {
    ema: number;
    sma: number;
    difference: number;
    percentageDifference: number;
  } {
    const emaValue = this.calculateValue(data);
    const prices = this.extractPrices(data);
    const smaValue = mathUtils.sma(prices, this.config.period);
    
    const difference = emaValue - smaValue;
    const percentageDifference = smaValue !== 0 ? (difference / smaValue) * 100 : 0;

    return {
      ema: emaValue,
      sma: smaValue,
      difference,
      percentageDifference
    };
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `EMA(${this.config.period}, α=${this.alpha.toFixed(4)}, ${this.priceType}) ` +
           `[${this.getStatus()}] Value: ${this.getLatestResult()?.value || 'N/A'}`;
  }
}