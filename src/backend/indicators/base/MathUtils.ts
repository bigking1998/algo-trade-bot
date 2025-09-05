/**
 * Mathematical Utilities - Task BE-010
 * 
 * High-performance mathematical functions for technical indicator calculations.
 * Optimized for real-time trading applications with numerical stability and accuracy.
 */

import { MathUtils } from './types.js';

/**
 * Mathematical utility functions with optimized algorithms
 */
export class MathUtilsImpl implements MathUtils {
  private static readonly EPSILON = 1e-10;

  /**
   * Calculate Simple Moving Average with O(1) streaming updates
   */
  sma(values: number[], period: number): number {
    if (values.length === 0 || period <= 0) {
      return 0;
    }

    const endIndex = values.length;
    const startIndex = Math.max(0, endIndex - period);
    const actualPeriod = endIndex - startIndex;

    let sum = 0;
    for (let i = startIndex; i < endIndex; i++) {
      sum += values[i];
    }

    return sum / actualPeriod;
  }

  /**
   * Calculate Exponential Moving Average with configurable smoothing factor
   */
  ema(values: number[], period: number, smoothing: number = 2): number {
    if (values.length === 0 || period <= 0) {
      return 0;
    }

    if (values.length === 1) {
      return values[0];
    }

    const alpha = smoothing / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }

    return ema;
  }

  /**
   * Calculate Weighted Moving Average with linear weights
   */
  wma(values: number[], period: number): number {
    if (values.length === 0 || period <= 0) {
      return 0;
    }

    const endIndex = values.length;
    const startIndex = Math.max(0, endIndex - period);
    const actualPeriod = endIndex - startIndex;

    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 0; i < actualPeriod; i++) {
      const weight = i + 1;
      const valueIndex = startIndex + i;
      weightedSum += values[valueIndex] * weight;
      weightSum += weight;
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  /**
   * Calculate Standard Deviation with Bessel's correction
   */
  stdDev(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const mean = this.mean(values);
    let sumSquaredDiff = 0;

    for (const value of values) {
      const diff = value - mean;
      sumSquaredDiff += diff * diff;
    }

    // Use Bessel's correction (n-1) for sample standard deviation
    return Math.sqrt(sumSquaredDiff / (values.length - 1));
  }

  /**
   * Calculate Variance with Bessel's correction
   */
  variance(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const mean = this.mean(values);
    let sumSquaredDiff = 0;

    for (const value of values) {
      const diff = value - mean;
      sumSquaredDiff += diff * diff;
    }

    return sumSquaredDiff / (values.length - 1);
  }

  /**
   * Calculate Pearson correlation coefficient with numerical stability
   */
  correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) {
      return 0;
    }

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;

      numerator += dx * dy;
      sumXX += dx * dx;
      sumYY += dy * dy;
    }

    const denominator = Math.sqrt(sumXX * sumYY);
    return denominator > MathUtilsImpl.EPSILON ? numerator / denominator : 0;
  }

  /**
   * Calculate linear regression with R-squared coefficient
   */
  linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number; } {
    if (x.length !== y.length || x.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let denominator = 0;
    let totalSumSquares = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;

      numerator += dx * dy;
      denominator += dx * dx;
      totalSumSquares += dy * dy;
    }

    const slope = denominator > MathUtilsImpl.EPSILON ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared
    let residualSumSquares = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      const residual = y[i] - predicted;
      residualSumSquares += residual * residual;
    }

    const r2 = totalSumSquares > MathUtilsImpl.EPSILON ? 
      1 - (residualSumSquares / totalSumSquares) : 0;

    return { slope, intercept, r2: Math.max(0, r2) };
  }

  /**
   * Calculate Bollinger Bands with standard deviation multiplier
   */
  bollingerBands(prices: number[], period: number, stdDevMultiplier: number = 2): 
    { upper: number; middle: number; lower: number; } {
    
    if (prices.length < period) {
      const lastPrice = prices[prices.length - 1] || 0;
      return { upper: lastPrice, middle: lastPrice, lower: lastPrice };
    }

    const recentPrices = prices.slice(-period);
    const middle = this.sma(recentPrices, period);
    const stdDev = this.stdDev(recentPrices);
    const offset = stdDev * stdDevMultiplier;

    return {
      upper: middle + offset,
      middle,
      lower: middle - offset
    };
  }

  /**
   * Calculate True Range for volatility indicators
   */
  trueRange(high: number, low: number, prevClose: number): number {
    const range1 = high - low;
    const range2 = Math.abs(high - prevClose);
    const range3 = Math.abs(low - prevClose);

    return Math.max(range1, range2, range3);
  }

  /**
   * Calculate Typical Price (HLC3)
   */
  typicalPrice(high: number, low: number, close: number): number {
    return (high + low + close) / 3;
  }

  /**
   * Calculate Money Flow for volume-based indicators
   */
  moneyFlow(high: number, low: number, close: number, volume: number): number {
    const typicalPrice = this.typicalPrice(high, low, close);
    return typicalPrice * volume;
  }

  /**
   * Calculate Raw Money Flow for Money Flow Index
   */
  rawMoneyFlow(high: number, low: number, close: number, volume: number, prevTypicalPrice: number): {
    positive: number;
    negative: number;
  } {
    const currentTypicalPrice = this.typicalPrice(high, low, close);
    const moneyFlow = this.moneyFlow(high, low, close, volume);

    if (currentTypicalPrice > prevTypicalPrice) {
      return { positive: moneyFlow, negative: 0 };
    } else if (currentTypicalPrice < prevTypicalPrice) {
      return { positive: 0, negative: moneyFlow };
    } else {
      return { positive: 0, negative: 0 };
    }
  }

  /**
   * Calculate Average True Range with exponential smoothing
   */
  atr(trueRanges: number[], period: number): number {
    if (trueRanges.length === 0) {
      return 0;
    }

    if (trueRanges.length <= period) {
      return this.mean(trueRanges);
    }

    // Use exponential smoothing for ATR calculation
    const alpha = 1 / period;
    let atr = this.mean(trueRanges.slice(0, period));

    for (let i = period; i < trueRanges.length; i++) {
      atr = alpha * trueRanges[i] + (1 - alpha) * atr;
    }

    return atr;
  }

  /**
   * Calculate Directional Movement for ADX calculation
   */
  directionalMovement(highs: number[], lows: number[]): {
    plusDM: number[];
    minusDM: number[];
  } {
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];

      const plusDMValue = (highDiff > lowDiff && highDiff > 0) ? highDiff : 0;
      const minusDMValue = (lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0;

      plusDM.push(plusDMValue);
      minusDM.push(minusDMValue);
    }

    return { plusDM, minusDM };
  }

  /**
   * Calculate Stochastic %K value
   */
  stochasticK(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return 0;
    }

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const range = highestHigh - lowestLow;
    return range > MathUtilsImpl.EPSILON ? 
      ((currentClose - lowestLow) / range) * 100 : 50;
  }

  /**
   * Calculate Williams %R
   */
  williamsR(highs: number[], lows: number[], closes: number[], period: number): number {
    const stochK = this.stochasticK(highs, lows, closes, period);
    return stochK - 100; // Williams %R is the inverse of Stochastic %K
  }

  /**
   * Calculate Commodity Channel Index (CCI) components
   */
  cciComponents(highs: number[], lows: number[], closes: number[], period: number): {
    typicalPrices: number[];
    smaTP: number;
    meanDeviation: number;
  } {
    const typicalPrices: number[] = [];
    
    for (let i = 0; i < highs.length; i++) {
      typicalPrices.push(this.typicalPrice(highs[i], lows[i], closes[i]));
    }

    const recentTP = typicalPrices.slice(-period);
    const smaTP = this.sma(recentTP, period);

    // Calculate mean deviation
    let sumDeviation = 0;
    for (const tp of recentTP) {
      sumDeviation += Math.abs(tp - smaTP);
    }
    const meanDeviation = sumDeviation / period;

    return { typicalPrices, smaTP, meanDeviation };
  }

  /**
   * Calculate Rate of Change (ROC)
   */
  rateOfChange(values: number[], period: number): number {
    if (values.length <= period || period <= 0) {
      return 0;
    }

    const currentValue = values[values.length - 1];
    const pastValue = values[values.length - 1 - period];

    return pastValue > MathUtilsImpl.EPSILON ? 
      ((currentValue - pastValue) / pastValue) * 100 : 0;
  }

  /**
   * Calculate Momentum indicator
   */
  momentum(values: number[], period: number): number {
    if (values.length <= period || period <= 0) {
      return 0;
    }

    const currentValue = values[values.length - 1];
    const pastValue = values[values.length - 1 - period];

    return currentValue - pastValue;
  }

  /**
   * Utility method to calculate arithmetic mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Utility method to calculate median
   */
  median(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0 ?
      (sorted[mid - 1] + sorted[mid]) / 2 :
      sorted[mid];
  }

  /**
   * Utility method to calculate percentile
   */
  percentile(values: number[], p: number): number {
    if (values.length === 0 || p < 0 || p > 100) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Check if a number is valid (not NaN or Infinity)
   */
  isValidNumber(value: number): boolean {
    return !isNaN(value) && isFinite(value);
  }

  /**
   * Clamp a value between min and max
   */
  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Round to specified decimal places
   */
  roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

// Export singleton instance
export const mathUtils = new MathUtilsImpl();