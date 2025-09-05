/**
 * MACD (Moving Average Convergence Divergence) Indicator - Task BE-010
 * 
 * MACD is a trend-following momentum indicator that shows the relationship
 * between two moving averages of a security's price.
 * 
 * Components:
 * - MACD Line: 12-period EMA - 26-period EMA
 * - Signal Line: 9-period EMA of MACD Line
 * - Histogram: MACD Line - Signal Line
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, MACDResult, StreamingContext } from '../base/types.js';
import { ExponentialMovingAverage } from './ExponentialMovingAverage.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';

export interface MACDConfig extends IndicatorConfig {
  /** Fast EMA period (default: 12) */
  fastPeriod?: number;
  /** Slow EMA period (default: 26) */
  slowPeriod?: number;
  /** Signal EMA period (default: 9) */
  signalPeriod?: number;
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
}

/**
 * MACD implementation with streaming optimization
 */
export class MACD extends TechnicalIndicator<{ macd: number; signal: number; histogram: number; }> {
  private readonly fastPeriod: number;
  private readonly slowPeriod: number;
  private readonly signalPeriod: number;
  private readonly priceType: string;

  // EMA calculators for MACD components
  private fastEMA: ExponentialMovingAverage;
  private slowEMA: ExponentialMovingAverage;
  private signalEMA: ExponentialMovingAverage;

  // Buffers for streaming calculations
  private macdBuffer: NumericCircularBuffer;
  private isInitialized = false;

  constructor(config: MACDConfig) {
    const effectiveConfig = {
      period: config.slowPeriod || 26, // Use slow period as the main period
      ...config
    };
    
    super('MACD', effectiveConfig);
    
    this.fastPeriod = config.fastPeriod || 12;
    this.slowPeriod = config.slowPeriod || 26;
    this.signalPeriod = config.signalPeriod || 9;
    this.priceType = config.priceType || 'close';

    // Initialize EMA calculators
    this.fastEMA = new ExponentialMovingAverage({
      period: this.fastPeriod,
      priceType: this.priceType
    });

    this.slowEMA = new ExponentialMovingAverage({
      period: this.slowPeriod,
      priceType: this.priceType
    });

    this.signalEMA = new ExponentialMovingAverage({
      period: this.signalPeriod,
      priceType: 'close' // Signal line uses MACD values, not prices
    });

    // Buffer to store MACD line values for signal calculation
    this.macdBuffer = new NumericCircularBuffer(this.signalPeriod * 2);
  }

  /**
   * Calculate MACD values for given data
   */
  protected calculateValue(data: OHLCV[]): { macd: number; signal: number; histogram: number; } {
    if (data.length === 0) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    // Calculate fast and slow EMAs
    const fastEMAResult = this.fastEMA.calculate(data);
    const slowEMAResult = this.slowEMA.calculate(data);

    if (!fastEMAResult.isValid || !slowEMAResult.isValid) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    // Calculate MACD line
    const macdLine = (fastEMAResult.value as number) - (slowEMAResult.value as number);

    // Calculate signal line by building MACD history
    const macdHistory = this.buildMACDHistory(data);
    const signalValue = this.calculateSignalLine(macdHistory);

    // Calculate histogram
    const histogram = macdLine - signalValue;

    return {
      macd: macdLine,
      signal: signalValue,
      histogram
    };
  }

  /**
   * Optimized streaming update
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): { macd: number; signal: number; histogram: number; } {
    // Update fast and slow EMAs
    const fastResult = this.fastEMA.update(newCandle, context);
    const slowResult = this.slowEMA.update(newCandle, context);

    if (!fastResult.isValid || !slowResult.isValid) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    // Calculate MACD line
    const macdLine = (fastResult.value as number) - (slowResult.value as number);

    // Update MACD buffer for signal calculation
    this.macdBuffer.push(macdLine);

    // Calculate signal line using current MACD values
    let signalValue = 0;
    if (this.macdBuffer.size() >= this.signalPeriod) {
      // Create synthetic OHLCV data for signal EMA calculation
      const macdValues = this.macdBuffer.getAll();
      const syntheticCandles: OHLCV[] = macdValues.map((value, index) => ({
        time: new Date(Date.now() - (macdValues.length - index - 1) * 60000), // Mock timestamps
        open: value,
        high: value,
        low: value,
        close: value,
        volume: 1
      }));

      // Reset and recalculate signal EMA with MACD values
      this.signalEMA.reset();
      const signalResult = this.signalEMA.calculate(syntheticCandles);
      signalValue = signalResult.isValid ? signalResult.value as number : 0;
    }

    // Calculate histogram
    const histogram = macdLine - signalValue;

    return {
      macd: macdLine,
      signal: signalValue,
      histogram
    };
  }

  /**
   * Reset all components
   */
  reset(): void {
    super.reset();
    this.fastEMA.reset();
    this.slowEMA.reset();
    this.signalEMA.reset();
    this.macdBuffer.clear();
    this.isInitialized = false;
  }

  /**
   * Validate MACD-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const macdConfig = config as MACDConfig;
    
    const fastPeriod = macdConfig.fastPeriod || 12;
    const slowPeriod = macdConfig.slowPeriod || 26;
    const signalPeriod = macdConfig.signalPeriod || 9;

    if (fastPeriod >= slowPeriod) {
      throw new Error('Fast period must be less than slow period');
    }

    if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
      throw new Error('All periods must be positive');
    }

    if (signalPeriod > slowPeriod) {
      throw new Error('Signal period should typically be less than slow period');
    }

    if (macdConfig.priceType && !this.isValidPriceType(macdConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${macdConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }
  }

  /**
   * Get MACD-specific metadata
   */
  protected getResultMetadata(
    value: { macd: number; signal: number; histogram: number; }, 
    data: OHLCV[]
  ): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      priceType: this.priceType,
      convergenceDivergence: this.analyzeConvergenceDivergence(value),
      momentum: this.analyzeMomentum(value),
      crossoverSignal: this.detectCrossovers()
    };
  }

  /**
   * Build MACD history for signal line calculation
   */
  private buildMACDHistory(data: OHLCV[]): number[] {
    const macdHistory: number[] = [];
    
    // We need at least slow period to start calculating MACD
    if (data.length < this.slowPeriod) {
      return macdHistory;
    }

    // Calculate MACD for each point where we have enough data
    for (let i = this.slowPeriod - 1; i < data.length; i++) {
      const windowData = data.slice(0, i + 1);
      
      const fastResult = this.fastEMA.calculate(windowData);
      const slowResult = this.slowEMA.calculate(windowData);

      if (fastResult.isValid && slowResult.isValid) {
        const macdValue = (fastResult.value as number) - (slowResult.value as number);
        macdHistory.push(macdValue);
      }
    }

    return macdHistory;
  }

  /**
   * Calculate signal line from MACD history
   */
  private calculateSignalLine(macdHistory: number[]): number {
    if (macdHistory.length < this.signalPeriod) {
      return 0;
    }

    // Use EMA formula for signal line
    const recentMACDValues = macdHistory.slice(-this.signalPeriod);
    return this.calculateEMAFromValues(recentMACDValues, this.signalPeriod);
  }

  /**
   * Calculate EMA from array of values
   */
  private calculateEMAFromValues(values: number[], period: number): number {
    if (values.length === 0) {
      return 0;
    }

    if (values.length === 1) {
      return values[0];
    }

    const alpha = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }

    return ema;
  }

  /**
   * Analyze convergence/divergence patterns
   */
  private analyzeConvergenceDivergence(current: { macd: number; signal: number; histogram: number; }): string {
    if (Math.abs(current.histogram) < 0.001) {
      return 'neutral';
    }

    // Analyze trend based on histogram
    if (current.histogram > 0) {
      return current.macd > current.signal ? 'bullish_convergence' : 'bearish_divergence';
    } else {
      return current.macd < current.signal ? 'bearish_convergence' : 'bullish_divergence';
    }
  }

  /**
   * Analyze momentum based on MACD components
   */
  private analyzeMomentum(current: { macd: number; signal: number; histogram: number; }): {
    strength: 'weak' | 'moderate' | 'strong';
    direction: 'bullish' | 'bearish' | 'neutral';
  } {
    const absHistogram = Math.abs(current.histogram);
    const absMACD = Math.abs(current.macd);

    // Determine strength
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    if (absHistogram > absMACD * 0.5) {
      strength = 'strong';
    } else if (absHistogram > absMACD * 0.2) {
      strength = 'moderate';
    }

    // Determine direction
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (current.macd > current.signal && current.histogram > 0) {
      direction = 'bullish';
    } else if (current.macd < current.signal && current.histogram < 0) {
      direction = 'bearish';
    }

    return { strength, direction };
  }

  /**
   * Detect MACD line and signal line crossovers
   */
  private detectCrossovers(): {
    bullishCrossover: boolean;
    bearishCrossover: boolean;
  } {
    const results = this.getResults(2);
    if (results.length < 2) {
      return { bullishCrossover: false, bearishCrossover: false };
    }

    const current = results[1].value;
    const previous = results[0].value;

    const bullishCrossover = previous.macd <= previous.signal && current.macd > current.signal;
    const bearishCrossover = previous.macd >= previous.signal && current.macd < current.signal;

    return { bullishCrossover, bearishCrossover };
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
   * Get current MACD component values
   */
  getCurrentValues(): { macd: number; signal: number; histogram: number; } | undefined {
    const latest = this.getLatestResult();
    return latest?.value;
  }

  /**
   * Check if MACD is above zero line (bullish territory)
   */
  isAboveZero(): boolean {
    const current = this.getCurrentValues();
    return current ? current.macd > 0 : false;
  }

  /**
   * Check if MACD is below zero line (bearish territory)
   */
  isBelowZero(): boolean {
    const current = this.getCurrentValues();
    return current ? current.macd < 0 : false;
  }

  /**
   * Check if MACD line is above signal line
   */
  isBullish(): boolean {
    const current = this.getCurrentValues();
    return current ? current.macd > current.signal : false;
  }

  /**
   * Check if MACD line is below signal line
   */
  isBearish(): boolean {
    const current = this.getCurrentValues();
    return current ? current.macd < current.signal : false;
  }

  /**
   * Get histogram trend (increasing/decreasing)
   */
  getHistogramTrend(lookback: number = 3): 'increasing' | 'decreasing' | 'neutral' {
    const results = this.getResults(lookback);
    if (results.length < 2) {
      return 'neutral';
    }

    let increasingCount = 0;
    let decreasingCount = 0;

    for (let i = 1; i < results.length; i++) {
      const current = results[i].value.histogram;
      const previous = results[i - 1].value.histogram;

      if (current > previous) {
        increasingCount++;
      } else if (current < previous) {
        decreasingCount++;
      }
    }

    if (increasingCount > decreasingCount) {
      return 'increasing';
    } else if (decreasingCount > increasingCount) {
      return 'decreasing';
    } else {
      return 'neutral';
    }
  }

  /**
   * Calculate MACD oscillator strength (0-1)
   */
  getOscillatorStrength(): number {
    const results = this.getResults(20);
    if (results.length < 10) {
      return 0;
    }

    const histograms = results.map(r => Math.abs(r.value.histogram));
    const maxHistogram = Math.max(...histograms);
    const avgHistogram = histograms.reduce((sum, h) => sum + h, 0) / histograms.length;

    const current = this.getCurrentValues();
    if (!current) {
      return 0;
    }

    const currentHistogram = Math.abs(current.histogram);
    
    // Normalize strength based on recent history
    if (maxHistogram === 0) {
      return 0;
    }

    return Math.min(currentHistogram / maxHistogram, 1);
  }

  /**
   * Get divergence signals with price
   */
  checkDivergence(prices: number[], lookback: number = 10): {
    bullishDivergence: boolean;
    bearishDivergence: boolean;
  } {
    const results = this.getResults(lookback);
    if (results.length < lookback || prices.length < lookback) {
      return { bullishDivergence: false, bearishDivergence: false };
    }

    const recentPrices = prices.slice(-lookback);
    const recentMACDs = results.slice(-lookback).map(r => r.value.macd);

    // Check for divergence patterns
    const priceSlope = this.calculateSlope(recentPrices);
    const macdSlope = this.calculateSlope(recentMACDs);

    const bullishDivergence = priceSlope < -0.01 && macdSlope > 0.01; // Price down, MACD up
    const bearishDivergence = priceSlope > 0.01 && macdSlope < -0.01; // Price up, MACD down

    return { bullishDivergence, bearishDivergence };
  }

  /**
   * Calculate slope of an array
   */
  private calculateSlope(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const denominator = n * sumXX - sumX * sumX;
    return denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const current = this.getCurrentValues();
    const valueStr = current ? 
      `MACD: ${current.macd.toFixed(4)}, Signal: ${current.signal.toFixed(4)}, Hist: ${current.histogram.toFixed(4)}` : 
      'N/A';
    
    return `MACD(${this.fastPeriod},${this.slowPeriod},${this.signalPeriod}) ` +
           `[${this.getStatus()}] ${valueStr}`;
  }
}