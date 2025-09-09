/**
 * TRIX (Triple Exponential Average) Indicator - Task BE-011
 * 
 * TRIX is a momentum oscillator that displays the percentage rate of change
 * of a triple exponentially smoothed moving average. It's designed to filter
 * out price noise and identify significant trends.
 * 
 * Formula:
 * 1. Calculate first EMA of closing prices
 * 2. Calculate second EMA of the first EMA
 * 3. Calculate third EMA of the second EMA
 * 4. TRIX = (Current triple EMA - Previous triple EMA) / Previous triple EMA * 10000
 * 
 * Signal Line: Often a simple moving average of TRIX values (default 9 periods)
 * 
 * Interpretation:
 * - TRIX > 0: Bullish momentum
 * - TRIX < 0: Bearish momentum
 * - TRIX crossovers with signal line generate buy/sell signals
 * - Divergences with price indicate potential reversals
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface TRIXConfig extends IndicatorConfig {
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Signal line period (default: 9) */
  signalPeriod?: number;
  /** Scale factor for TRIX value (default: 10000 for percentage) */
  scaleFactor?: number;
}

export interface TRIXResult {
  /** TRIX value (rate of change of triple EMA) */
  trix: number;
  /** Signal line (SMA of TRIX) */
  signal: number;
  /** TRIX histogram (TRIX - Signal) */
  histogram: number;
  /** Triple EMA value */
  tripleEMA: number;
}

/**
 * TRIX implementation with streaming optimization
 */
export class TRIX extends TechnicalIndicator<TRIXResult> {
  private readonly priceType: string;
  private readonly signalPeriod: number;
  private readonly scaleFactor: number;

  // Buffers for EMA calculations
  private priceBuffer: NumericCircularBuffer;
  private ema1Buffer: NumericCircularBuffer;
  private ema2Buffer: NumericCircularBuffer;
  private ema3Buffer: NumericCircularBuffer;
  private trixBuffer: NumericCircularBuffer;

  // EMA smoothing constants
  private readonly alpha: number; // 2 / (period + 1)

  // Running EMA values for streaming
  private ema1?: number;
  private ema2?: number;
  private ema3?: number;
  private previousEma3?: number;
  
  // Warmup tracking
  private ema1Warmed = false;
  private ema2Warmed = false;
  private ema3Warmed = false;

  constructor(config: TRIXConfig) {
    super('TRIX', config);
    
    this.priceType = config.priceType || 'close';
    this.signalPeriod = config.signalPeriod || 9;
    this.scaleFactor = config.scaleFactor || 10000;

    // Calculate EMA smoothing constant
    this.alpha = 2 / (config.period + 1);

    // Initialize buffers
    const bufferSize = Math.max(config.period * 3, 100);
    this.priceBuffer = new NumericCircularBuffer(bufferSize);
    this.ema1Buffer = new NumericCircularBuffer(bufferSize);
    this.ema2Buffer = new NumericCircularBuffer(bufferSize);
    this.ema3Buffer = new NumericCircularBuffer(bufferSize);
    this.trixBuffer = new NumericCircularBuffer(Math.max(this.signalPeriod, 20));
  }

  /**
   * Calculate TRIX values for given data
   */
  protected calculateValue(data: OHLCV[]): TRIXResult {
    if (data.length < this.config.period * 3) {
      return this.createNeutralResult();
    }

    const prices = this.extractPrices(data);
    return this.calculateTRIXFromPrices(prices);
  }

  /**
   * Optimized streaming update using running EMAs
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): TRIXResult {
    const newPrice = this.extractPrice(newCandle);
    this.priceBuffer.push(newPrice);

    // Calculate first EMA
    if (!this.ema1Warmed) {
      if (this.priceBuffer.size() >= this.config.period) {
        // Initialize with SMA
        this.ema1 = this.priceBuffer.mean();
        this.ema1Warmed = true;
      } else {
        return this.createNeutralResult();
      }
    } else {
      // Update EMA1 using exponential smoothing
      this.ema1 = this.alpha * newPrice + (1 - this.alpha) * (this.ema1 || newPrice);
    }

    this.ema1Buffer.push(this.ema1!);

    // Calculate second EMA
    if (!this.ema2Warmed) {
      if (this.ema1Buffer.size() >= this.config.period) {
        // Initialize with SMA of EMA1
        this.ema2 = this.ema1Buffer.mean();
        this.ema2Warmed = true;
      } else {
        return this.createNeutralResult();
      }
    } else {
      // Update EMA2
      this.ema2 = this.alpha * this.ema1! + (1 - this.alpha) * (this.ema2 || this.ema1!);
    }

    this.ema2Buffer.push(this.ema2!);

    // Calculate third EMA
    if (!this.ema3Warmed) {
      if (this.ema2Buffer.size() >= this.config.period) {
        // Initialize with SMA of EMA2
        this.ema3 = this.ema2Buffer.mean();
        this.ema3Warmed = true;
      } else {
        return this.createNeutralResult();
      }
    } else {
      // Update EMA3
      this.ema3 = this.alpha * this.ema2! + (1 - this.alpha) * (this.ema3 || this.ema2!);
    }

    this.ema3Buffer.push(this.ema3!);

    // Calculate TRIX (rate of change of triple EMA)
    let trix = 0;
    if (this.previousEma3 !== undefined && this.previousEma3 !== 0) {
      trix = ((this.ema3! - this.previousEma3) / this.previousEma3) * this.scaleFactor;
    }

    this.trixBuffer.push(trix);
    this.previousEma3 = this.ema3;

    // Calculate signal line
    const signal = this.trixBuffer.size() >= this.signalPeriod ?
      this.trixBuffer.getWindow(this.signalPeriod).reduce((sum, val) => sum + val, 0) / this.signalPeriod :
      trix;

    // Calculate histogram
    const histogram = trix - signal;

    return {
      trix,
      signal,
      histogram,
      tripleEMA: this.ema3!
    };
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
    this.ema1Buffer.clear();
    this.ema2Buffer.clear();
    this.ema3Buffer.clear();
    this.trixBuffer.clear();
    
    this.ema1 = undefined;
    this.ema2 = undefined;
    this.ema3 = undefined;
    this.previousEma3 = undefined;
    
    this.ema1Warmed = false;
    this.ema2Warmed = false;
    this.ema3Warmed = false;
  }

  /**
   * Validate TRIX-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const trixConfig = config as TRIXConfig;
    
    if (trixConfig.priceType && !this.isValidPriceType(trixConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${trixConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }

    if (trixConfig.signalPeriod !== undefined) {
      if (!Number.isInteger(trixConfig.signalPeriod) || trixConfig.signalPeriod < 1) {
        throw new Error('Signal period must be a positive integer');
      }
    }

    if (trixConfig.scaleFactor !== undefined) {
      if (trixConfig.scaleFactor <= 0) {
        throw new Error('Scale factor must be positive');
      }
    }

    // TRIX needs sufficient periods for triple smoothing
    if (config.period < 3) {
      throw new Error('TRIX period must be at least 3 for meaningful results');
    }
  }

  /**
   * Get TRIX-specific metadata
   */
  protected getResultMetadata(value: TRIXResult, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      signalPeriod: this.signalPeriod,
      scaleFactor: this.scaleFactor,
      ema1Warmed: this.ema1Warmed,
      ema2Warmed: this.ema2Warmed,
      ema3Warmed: this.ema3Warmed,
      momentum: this.analyzeMomentum(value),
      crossoverSignal: this.checkCrossoverSignal(),
      trendStrength: this.analyzeTrendStrength(value)
    };
  }

  /**
   * Calculate TRIX from price array
   */
  private calculateTRIXFromPrices(prices: number[]): TRIXResult {
    if (prices.length < this.config.period * 3) {
      return this.createNeutralResult();
    }

    // Calculate triple EMA
    const { ema1Values, ema2Values, ema3Values } = this.calculateTripleEMA(prices);

    if (ema3Values.length < 2) {
      return this.createNeutralResult();
    }

    // Calculate TRIX values
    const trixValues: number[] = [];
    for (let i = 1; i < ema3Values.length; i++) {
      const currentEMA3 = ema3Values[i];
      const previousEMA3 = ema3Values[i - 1];
      
      const trix = previousEMA3 !== 0 ? 
        ((currentEMA3 - previousEMA3) / previousEMA3) * this.scaleFactor : 0;
      trixValues.push(trix);
    }

    if (trixValues.length === 0) {
      return this.createNeutralResult();
    }

    // Get current TRIX
    const currentTrix = trixValues[trixValues.length - 1];

    // Calculate signal line
    const signal = trixValues.length >= this.signalPeriod ?
      trixValues.slice(-this.signalPeriod).reduce((sum, val) => sum + val, 0) / this.signalPeriod :
      currentTrix;

    // Calculate histogram
    const histogram = currentTrix - signal;

    return {
      trix: currentTrix,
      signal,
      histogram,
      tripleEMA: ema3Values[ema3Values.length - 1]
    };
  }

  /**
   * Calculate triple EMA from prices
   */
  private calculateTripleEMA(prices: number[]): {
    ema1Values: number[];
    ema2Values: number[];
    ema3Values: number[];
  } {
    // First EMA
    const ema1Values = this.calculateEMA(prices);
    
    // Second EMA (EMA of first EMA)
    const ema2Values = this.calculateEMA(ema1Values);
    
    // Third EMA (EMA of second EMA)
    const ema3Values = this.calculateEMA(ema2Values);

    return { ema1Values, ema2Values, ema3Values };
  }

  /**
   * Calculate EMA for given values
   */
  private calculateEMA(values: number[]): number[] {
    if (values.length === 0) {
      return [];
    }

    const emaValues: number[] = [];
    let ema = values[0]; // Initialize with first value

    for (let i = 0; i < values.length; i++) {
      if (i === 0) {
        ema = values[i];
      } else {
        ema = this.alpha * values[i] + (1 - this.alpha) * ema;
      }
      emaValues.push(ema);
    }

    return emaValues;
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
   * Create neutral result when insufficient data
   */
  private createNeutralResult(): TRIXResult {
    return {
      trix: 0,
      signal: 0,
      histogram: 0,
      tripleEMA: 0
    };
  }

  /**
   * Analyze momentum based on TRIX values
   */
  private analyzeMomentum(value: TRIXResult): {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    acceleration: 'increasing' | 'decreasing' | 'stable';
  } {
    const { trix, histogram } = value;

    // Determine direction
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (trix > 0) {
      direction = 'bullish';
    } else if (trix < 0) {
      direction = 'bearish';
    }

    // Determine strength based on absolute TRIX value
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    const absTrix = Math.abs(trix);
    if (absTrix > 50) { // Adjust thresholds based on scale factor
      strength = 'strong';
    } else if (absTrix > 20) {
      strength = 'moderate';
    }

    // Determine acceleration based on histogram
    let acceleration: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(histogram) > 5) { // Small threshold for noise filtering
      if (histogram > 0) {
        acceleration = 'increasing';
      } else {
        acceleration = 'decreasing';
      }
    }

    return { direction, strength, acceleration };
  }

  /**
   * Check for crossover signals
   */
  private checkCrossoverSignal(): 'bullish' | 'bearish' | 'none' {
    const results = this.getResults(2);
    if (results.length < 2) {
      return 'none';
    }

    const current = results[1].value as TRIXResult;
    const previous = results[0].value as TRIXResult;

    // TRIX crossing above signal line
    if (previous.trix <= previous.signal && current.trix > current.signal) {
      return 'bullish';
    }

    // TRIX crossing below signal line
    if (previous.trix >= previous.signal && current.trix < current.signal) {
      return 'bearish';
    }

    return 'none';
  }

  /**
   * Analyze trend strength
   */
  private analyzeTrendStrength(value: TRIXResult): {
    overall: 'weak' | 'moderate' | 'strong';
    consistency: number; // 0-1 scale
  } {
    const results = this.getResults(5);
    if (results.length < 3) {
      return { overall: 'weak', consistency: 0 };
    }

    const trixValues = results.map(r => (r.value as TRIXResult).trix);
    
    // Calculate average absolute TRIX
    const avgAbsTrix = trixValues.reduce((sum, val) => sum + Math.abs(val), 0) / trixValues.length;
    
    let overall: 'weak' | 'moderate' | 'strong' = 'weak';
    if (avgAbsTrix > 50) {
      overall = 'strong';
    } else if (avgAbsTrix > 20) {
      overall = 'moderate';
    }

    // Calculate consistency (how often TRIX maintains same direction)
    let sameDirectionCount = 0;
    const currentDirection = value.trix > 0 ? 1 : (value.trix < 0 ? -1 : 0);
    
    for (const trixVal of trixValues) {
      const direction = trixVal > 0 ? 1 : (trixVal < 0 ? -1 : 0);
      if (direction === currentDirection) {
        sameDirectionCount++;
      }
    }
    
    const consistency = sameDirectionCount / trixValues.length;

    return { overall, consistency };
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  /**
   * Check if TRIX indicates bullish momentum
   */
  isBullish(): boolean {
    const latest = this.getLatestResult();
    if (!latest) {
      return false;
    }

    const { trix, signal } = latest.value as TRIXResult;
    return trix > 0 && trix > signal;
  }

  /**
   * Check if TRIX indicates bearish momentum
   */
  isBearish(): boolean {
    const latest = this.getLatestResult();
    if (!latest) {
      return false;
    }

    const { trix, signal } = latest.value as TRIXResult;
    return trix < 0 && trix < signal;
  }

  /**
   * Get TRIX trend direction
   */
  getTrendDirection(): 'bullish' | 'bearish' | 'neutral' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'neutral';
    }

    const trix = (latest.value as TRIXResult).trix;
    if (trix > 0) {
      return 'bullish';
    } else if (trix < 0) {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }

  /**
   * Get TRIX momentum strength
   */
  getMomentumStrength(): 'weak' | 'moderate' | 'strong' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'weak';
    }

    const absTrix = Math.abs((latest.value as TRIXResult).trix);
    if (absTrix > 50) {
      return 'strong';
    } else if (absTrix > 20) {
      return 'moderate';
    } else {
      return 'weak';
    }
  }

  /**
   * Check for zero line crossover
   */
  checkZeroCrossover(): 'bullish' | 'bearish' | 'none' {
    const results = this.getResults(2);
    if (results.length < 2) {
      return 'none';
    }

    const current = (results[1].value as TRIXResult).trix;
    const previous = (results[0].value as TRIXResult).trix;

    if (previous <= 0 && current > 0) {
      return 'bullish';
    } else if (previous >= 0 && current < 0) {
      return 'bearish';
    }

    return 'none';
  }

  /**
   * Get TRIX rate of change (momentum of momentum)
   */
  getTRIXROC(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length <= periods) {
      return 0;
    }

    const current = (results[results.length - 1].value as TRIXResult).trix;
    const previous = (results[results.length - 1 - periods].value as TRIXResult).trix;
    
    return current - previous;
  }

  /**
   * Check if TRIX is warmed up for reliable signals
   */
  isTRIXWarmedUp(): boolean {
    return this.ema1Warmed && this.ema2Warmed && this.ema3Warmed && 
           this.trixBuffer.size() >= this.signalPeriod;
  }

  /**
   * Get EMA values for analysis
   */
  getEMAValues(): { ema1?: number; ema2?: number; ema3?: number } {
    return {
      ema1: this.ema1,
      ema2: this.ema2,
      ema3: this.ema3
    };
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latest = this.getLatestResult();
    if (!latest) {
      return `TRIX(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const { trix, signal, histogram } = latest.value as TRIXResult;
    const direction = this.getTrendDirection();
    const strength = this.getMomentumStrength();

    return `TRIX(${this.config.period}) [${this.getStatus()}] ` +
           `TRIX: ${trix.toFixed(2)}, Signal: ${signal.toFixed(2)}, ` +
           `Histogram: ${histogram.toFixed(2)} (${direction} ${strength})`;
  }
}