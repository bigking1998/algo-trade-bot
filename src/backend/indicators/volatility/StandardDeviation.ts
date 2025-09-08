/**
 * Standard Deviation Indicator - Task BE-010
 * 
 * Calculates the standard deviation of closing prices over a specified period.
 * Measures the volatility and dispersion of price movements from the mean.
 * 
 * Formula: σ = √(Σ(x - μ)² / (n-1))
 * Where σ = standard deviation, x = price, μ = mean, n = number of observations
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface StandardDeviationConfig extends IndicatorConfig {
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Use sample standard deviation (n-1) instead of population (n) */
  useSampleStdDev?: boolean;
  /** Number of standard deviations for band calculations */
  stdDevMultiplier?: number;
}

/**
 * Standard Deviation implementation with configurable price types
 */
export class StandardDeviation extends TechnicalIndicator<number> {
  private readonly priceType: string;
  private readonly useSampleStdDev: boolean;
  private readonly stdDevMultiplier: number;

  private priceBuffer: NumericCircularBuffer;

  constructor(config: StandardDeviationConfig) {
    super('StandardDeviation', config);
    
    this.priceType = config.priceType || 'close';
    this.useSampleStdDev = config.useSampleStdDev !== false; // Default to sample std dev
    this.stdDevMultiplier = config.stdDevMultiplier || 1;

    this.priceBuffer = new NumericCircularBuffer(config.period * 2);
  }

  /**
   * Calculate Standard Deviation for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length < this.config.period) {
      return 0;
    }

    const prices = this.extractPrices(data.slice(-this.config.period));
    return this.calculateStandardDeviation(prices);
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const price = this.extractPrice(newCandle);
    this.priceBuffer.push(price);

    if (this.priceBuffer.size() < this.config.period) {
      // Not enough data yet
      const allPrices = this.priceBuffer.getAll();
      return this.calculateStandardDeviation(allPrices);
    }

    const recentPrices = this.priceBuffer.getWindow(this.config.period);
    return this.calculateStandardDeviation(recentPrices);
  }

  /**
   * Calculate standard deviation from price array
   */
  private calculateStandardDeviation(prices: number[]): number {
    if (prices.length < 2) {
      return 0;
    }

    const mean = mathUtils.sma(prices, prices.length);
    let sumSquaredDeviations = 0;

    for (const price of prices) {
      const deviation = price - mean;
      sumSquaredDeviations += deviation * deviation;
    }

    // Use sample standard deviation (n-1) or population (n)
    const denominator = this.useSampleStdDev ? prices.length - 1 : prices.length;
    const variance = sumSquaredDeviations / denominator;
    
    return Math.sqrt(variance);
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
  }

  /**
   * Validate Standard Deviation configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const stdDevConfig = config as StandardDeviationConfig;

    if (stdDevConfig.priceType && !this.isValidPriceType(stdDevConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${stdDevConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }

    if (stdDevConfig.stdDevMultiplier !== undefined && stdDevConfig.stdDevMultiplier <= 0) {
      throw new Error('Standard deviation multiplier must be positive');
    }
  }

  /**
   * Get Standard Deviation metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    const avgPrice = this.getAveragePrice();
    const relativeVolatility = avgPrice > 0 ? (value / avgPrice) * 100 : 0;

    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      useSampleStdDev: this.useSampleStdDev,
      stdDevMultiplier: this.stdDevMultiplier,
      relativeVolatility,
      volatilityLevel: this.getVolatilityLevel(relativeVolatility),
      mean: avgPrice
    };
  }

  /**
   * Get volatility level based on relative volatility
   */
  private getVolatilityLevel(relativeVolatility: number): string {
    if (relativeVolatility > 5) return 'VERY_HIGH';
    if (relativeVolatility > 3) return 'HIGH';
    if (relativeVolatility > 2) return 'MODERATE';
    if (relativeVolatility > 1) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Get current average price
   */
  private getAveragePrice(): number {
    if (this.priceBuffer.size() === 0) return 0;
    return this.priceBuffer.mean();
  }

  /**
   * Extract prices based on price type
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
   * Get standard deviation as percentage of mean price
   */
  getRelativeStandardDeviation(): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 0;

    const stdDev = latestResult.value as number;
    const mean = this.getAveragePrice();
    
    return mean > 0 ? (stdDev / mean) * 100 : 0;
  }

  /**
   * Calculate Coefficient of Variation (CV = σ/μ)
   */
  getCoefficientOfVariation(): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 0;

    const stdDev = latestResult.value as number;
    const mean = this.getAveragePrice();
    
    return mean > 0 ? stdDev / mean : 0;
  }

  /**
   * Get Bollinger Band-style upper and lower bands
   */
  getBands(currentPrice?: number): { upper: number; middle: number; lower: number } {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      const price = currentPrice || 0;
      return { upper: price, middle: price, lower: price };
    }

    const stdDev = latestResult.value as number;
    const mean = this.getAveragePrice();
    const offset = stdDev * this.stdDevMultiplier;

    return {
      upper: mean + offset,
      middle: mean,
      lower: mean - offset
    };
  }

  /**
   * Check if current price is outside standard deviation bands
   */
  isPriceOutsideBands(currentPrice: number, stdDevMultiple: number = 2): {
    isOutside: boolean;
    direction: 'ABOVE' | 'BELOW' | 'WITHIN';
  } {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return { isOutside: false, direction: 'WITHIN' };
    }

    const stdDev = latestResult.value as number;
    const mean = this.getAveragePrice();
    const upperBand = mean + (stdDev * stdDevMultiple);
    const lowerBand = mean - (stdDev * stdDevMultiple);

    if (currentPrice > upperBand) {
      return { isOutside: true, direction: 'ABOVE' };
    } else if (currentPrice < lowerBand) {
      return { isOutside: true, direction: 'BELOW' };
    } else {
      return { isOutside: false, direction: 'WITHIN' };
    }
  }

  /**
   * Get Z-score for current price (how many standard deviations from mean)
   */
  getZScore(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 0;

    const stdDev = latestResult.value as number;
    const mean = this.getAveragePrice();
    
    return stdDev > 0 ? (currentPrice - mean) / stdDev : 0;
  }

  /**
   * Check if volatility is increasing
   */
  isVolatilityIncreasing(lookbackPeriods: number = 5): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) return false;

    const values = results.map(r => r.value as number);
    const recentAvg = mathUtils.sma(values.slice(-Math.ceil(lookbackPeriods / 2)), Math.ceil(lookbackPeriods / 2));
    const olderAvg = mathUtils.sma(values.slice(0, Math.floor(lookbackPeriods / 2)), Math.floor(lookbackPeriods / 2));
    
    return recentAvg > olderAvg;
  }

  /**
   * Check if volatility is decreasing
   */
  isVolatilityDecreasing(lookbackPeriods: number = 5): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) return false;

    const values = results.map(r => r.value as number);
    const recentAvg = mathUtils.sma(values.slice(-Math.ceil(lookbackPeriods / 2)), Math.ceil(lookbackPeriods / 2));
    const olderAvg = mathUtils.sma(values.slice(0, Math.floor(lookbackPeriods / 2)), Math.floor(lookbackPeriods / 2));
    
    return recentAvg < olderAvg;
  }

  /**
   * Get volatility trend
   */
  getVolatilityTrend(periods: number = 3): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (this.isVolatilityIncreasing(periods)) return 'INCREASING';
    if (this.isVolatilityDecreasing(periods)) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Get volatility percentile rank over lookback period
   */
  getVolatilityPercentileRank(lookbackPeriods: number = 50): number {
    const results = this.getResults(lookbackPeriods);
    if (results.length < 2) return 50; // Default to median

    const values = results.map(r => r.value as number);
    const currentValue = values[values.length - 1];
    
    // Count values less than current
    const valuesBelow = values.filter(v => v < currentValue).length;
    
    return (valuesBelow / values.length) * 100;
  }

  /**
   * Check if in low volatility environment (below historical average)
   */
  isLowVolatilityEnvironment(lookbackPeriods: number = 50): boolean {
    const percentile = this.getVolatilityPercentileRank(lookbackPeriods);
    return percentile < 25; // Bottom quartile
  }

  /**
   * Check if in high volatility environment (above historical average)
   */
  isHighVolatilityEnvironment(lookbackPeriods: number = 50): boolean {
    const percentile = this.getVolatilityPercentileRank(lookbackPeriods);
    return percentile > 75; // Top quartile
  }

  /**
   * Get current price buffer for analysis
   */
  getPriceBuffer(): number[] {
    return this.priceBuffer.getAll();
  }

  /**
   * Calculate rolling correlation with another price series
   */
  getCorrelationWith(otherPrices: number[]): number {
    const currentPrices = this.priceBuffer.getAll();
    const minLength = Math.min(currentPrices.length, otherPrices.length);
    
    if (minLength < 2) return 0;
    
    const prices1 = currentPrices.slice(-minLength);
    const prices2 = otherPrices.slice(-minLength);
    
    return mathUtils.correlation(prices1, prices2);
  }

  /**
   * Get mean reversion signal based on standard deviation
   */
  getMeanReversionSignal(currentPrice: number, threshold: number = 2): 'BUY' | 'SELL' | 'NEUTRAL' {
    const zScore = this.getZScore(currentPrice);
    
    if (zScore > threshold) return 'SELL'; // Price too high relative to mean
    if (zScore < -threshold) return 'BUY'; // Price too low relative to mean
    return 'NEUTRAL';
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `StandardDeviation(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const value = latestResult.value as number;
    const relativeVol = this.getRelativeStandardDeviation();
    const trend = this.getVolatilityTrend();
    const volatilityLevel = latestResult.metadata?.volatilityLevel;
    
    return `StandardDeviation(${this.config.period}, ${this.priceType}) [${this.getStatus()}] ` +
           `Value: ${value.toFixed(4)}, Relative: ${relativeVol.toFixed(2)}%, ` +
           `Level: ${volatilityLevel}, Trend: ${trend}`;
  }
}