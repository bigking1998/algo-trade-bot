/**
 * Stochastic Oscillator Indicator - Task BE-010
 * 
 * Calculates the stochastic oscillator comparing closing price to the high-low range.
 * Provides momentum signals with %K and %D lines.
 * 
 * Formula: %K = 100 × ((Close - LowestLow) / (HighestHigh - LowestLow))
 *         %D = SMA of %K over D periods
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StochasticResult, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface StochasticConfig extends IndicatorConfig {
  /** Period for %K calculation */
  kPeriod?: number;
  /** Period for %D (SMA of %K) */
  dPeriod?: number;
  /** Smoothing period for %K */
  smoothK?: number;
  /** Overbought level */
  overboughtLevel?: number;
  /** Oversold level */
  oversoldLevel?: number;
}

/**
 * Stochastic Oscillator with configurable smoothing
 */
export class Stochastic extends TechnicalIndicator<StochasticResult> {
  private readonly kPeriod: number;
  private readonly dPeriod: number;
  private readonly smoothK: number;
  private readonly overboughtLevel: number;
  private readonly oversoldLevel: number;

  private kBuffer: NumericCircularBuffer;
  private dBuffer: NumericCircularBuffer;

  constructor(config: StochasticConfig) {
    const kPeriod = config.kPeriod || config.period || 14;
    const dPeriod = config.dPeriod || 3;
    
    super('Stochastic', { ...config, period: Math.max(kPeriod, dPeriod) });
    
    this.kPeriod = kPeriod;
    this.dPeriod = dPeriod;
    this.smoothK = config.smoothK || 1;
    this.overboughtLevel = config.overboughtLevel || 80;
    this.oversoldLevel = config.oversoldLevel || 20;

    this.kBuffer = new NumericCircularBuffer(this.kPeriod * 2);
    this.dBuffer = new NumericCircularBuffer(this.dPeriod * 2);
  }

  /**
   * Calculate Stochastic values for given data
   */
  protected calculateValue(data: OHLCV[]): StochasticResult {
    if (data.length < this.kPeriod) {
      return { k: 50, d: 50 };
    }

    const highs = data.map(candle => candle.high);
    const lows = data.map(candle => candle.low);
    const closes = data.map(candle => candle.close);

    // Calculate %K values for the available data
    const kValues: number[] = [];
    
    for (let i = this.kPeriod - 1; i < data.length; i++) {
      const recentHighs = highs.slice(i - this.kPeriod + 1, i + 1);
      const recentLows = lows.slice(i - this.kPeriod + 1, i + 1);
      const currentClose = closes[i];

      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);
      
      const k = this.calculateK(currentClose, highestHigh, lowestLow);
      kValues.push(k);
    }

    // Apply smoothing to %K if required
    let smoothedK = kValues[kValues.length - 1];
    if (this.smoothK > 1 && kValues.length >= this.smoothK) {
      const recentK = kValues.slice(-this.smoothK);
      smoothedK = mathUtils.sma(recentK, this.smoothK);
    }

    // Calculate %D as SMA of %K
    let d = smoothedK;
    if (kValues.length >= this.dPeriod) {
      const recentK = this.smoothK > 1 && kValues.length >= this.smoothK ? 
        this.calculateSmoothedKValues(kValues, this.smoothK) : kValues;
      
      if (recentK.length >= this.dPeriod) {
        const dValues = recentK.slice(-this.dPeriod);
        d = mathUtils.sma(dValues, this.dPeriod);
      }
    }

    return { k: smoothedK, d };
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): StochasticResult {
    const dataBuffer = this.dataBuffer.getAll();
    
    if (dataBuffer.length < this.kPeriod) {
      return { k: 50, d: 50 };
    }

    const highs = dataBuffer.map(candle => candle.high);
    const lows = dataBuffer.map(candle => candle.low);
    const closes = dataBuffer.map(candle => candle.close);

    const highestHigh = Math.max(...highs.slice(-this.kPeriod));
    const lowestLow = Math.min(...lows.slice(-this.kPeriod));
    const currentClose = closes[closes.length - 1];

    // Calculate new %K
    const k = this.calculateK(currentClose, highestHigh, lowestLow);
    this.kBuffer.push(k);

    // Apply smoothing if required
    let smoothedK = k;
    if (this.smoothK > 1 && this.kBuffer.size() >= this.smoothK) {
      const recentK = this.kBuffer.getWindow(this.smoothK);
      smoothedK = mathUtils.sma(recentK, this.smoothK);
    }

    // Calculate %D
    let d = smoothedK;
    if (this.smoothK > 1) {
      // Need to maintain smoothed %K values for %D calculation
      if (this.kBuffer.size() >= this.smoothK) {
        const smoothedKValues: number[] = [];
        const allK = this.kBuffer.getAll();
        
        for (let i = this.smoothK - 1; i < allK.length; i++) {
          const window = allK.slice(i - this.smoothK + 1, i + 1);
          smoothedKValues.push(mathUtils.sma(window, this.smoothK));
        }
        
        if (smoothedKValues.length >= this.dPeriod) {
          const recentSmoothedK = smoothedKValues.slice(-this.dPeriod);
          d = mathUtils.sma(recentSmoothedK, this.dPeriod);
        }
      }
    } else {
      // No smoothing, %D is SMA of raw %K values
      if (this.kBuffer.size() >= this.dPeriod) {
        const recentK = this.kBuffer.getWindow(this.dPeriod);
        d = mathUtils.sma(recentK, this.dPeriod);
      }
    }

    return { k: smoothedK, d };
  }

  /**
   * Calculate individual %K value
   */
  private calculateK(close: number, highestHigh: number, lowestLow: number): number {
    const range = highestHigh - lowestLow;
    if (range === 0) {
      return 50; // Neutral when no range
    }
    return ((close - lowestLow) / range) * 100;
  }

  /**
   * Calculate smoothed %K values from raw %K array
   */
  private calculateSmoothedKValues(kValues: number[], smoothPeriod: number): number[] {
    if (kValues.length < smoothPeriod) {
      return kValues;
    }

    const smoothedValues: number[] = [];
    for (let i = smoothPeriod - 1; i < kValues.length; i++) {
      const window = kValues.slice(i - smoothPeriod + 1, i + 1);
      smoothedValues.push(mathUtils.sma(window, smoothPeriod));
    }
    
    return smoothedValues;
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.kBuffer.clear();
    this.dBuffer.clear();
  }

  /**
   * Validate Stochastic configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const stochConfig = config as StochasticConfig;

    if (stochConfig.kPeriod !== undefined && stochConfig.kPeriod <= 0) {
      throw new Error('K period must be positive');
    }

    if (stochConfig.dPeriod !== undefined && stochConfig.dPeriod <= 0) {
      throw new Error('D period must be positive');
    }

    if (stochConfig.smoothK !== undefined && stochConfig.smoothK <= 0) {
      throw new Error('Smooth K period must be positive');
    }

    if (stochConfig.overboughtLevel !== undefined) {
      if (stochConfig.overboughtLevel <= 50 || stochConfig.overboughtLevel > 100) {
        throw new Error('Overbought level must be between 50 and 100');
      }
    }

    if (stochConfig.oversoldLevel !== undefined) {
      if (stochConfig.oversoldLevel < 0 || stochConfig.oversoldLevel >= 50) {
        throw new Error('Oversold level must be between 0 and 50');
      }
    }
  }

  /**
   * Get Stochastic metadata
   */
  protected getResultMetadata(value: StochasticResult, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      kPeriod: this.kPeriod,
      dPeriod: this.dPeriod,
      smoothK: this.smoothK,
      overboughtLevel: this.overboughtLevel,
      oversoldLevel: this.oversoldLevel,
      signal: this.getInternalSignal(value.k, value.d)
    };
  }

  /**
   * Get current signal based on Stochastic values
   */
  private getInternalSignal(k: number, d: number): string {
    if (k > this.overboughtLevel && d > this.overboughtLevel) {
      return k < d ? 'SELL' : 'OVERBOUGHT';
    } else if (k < this.oversoldLevel && d < this.oversoldLevel) {
      return k > d ? 'BUY' : 'OVERSOLD';
    } else if (k > d && k < this.overboughtLevel && k > this.oversoldLevel) {
      return 'BULLISH_CROSS';
    } else if (k < d && k > this.oversoldLevel && k < this.overboughtLevel) {
      return 'BEARISH_CROSS';
    }
    return 'NEUTRAL';
  }

  /**
   * Check if in overbought condition
   */
  isOverbought(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const { k, d } = latestResult.value as StochasticResult;
    return k > this.overboughtLevel && d > this.overboughtLevel;
  }

  /**
   * Check if in oversold condition
   */
  isOversold(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const { k, d } = latestResult.value as StochasticResult;
    return k < this.oversoldLevel && d < this.oversoldLevel;
  }

  /**
   * Check for bullish crossover (%K crosses above %D)
   */
  hasBullishCrossover(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as StochasticResult;
    const previous = results[0].value as StochasticResult;

    return current.k > current.d && previous.k <= previous.d;
  }

  /**
   * Check for bearish crossover (%K crosses below %D)
   */
  hasBearishCrossover(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as StochasticResult;
    const previous = results[0].value as StochasticResult;

    return current.k < current.d && previous.k >= previous.d;
  }

  /**
   * Get current %K value
   */
  getCurrentK(): number | undefined {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as StochasticResult).k : undefined;
  }

  /**
   * Get current %D value
   */
  getCurrentD(): number | undefined {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as StochasticResult).d : undefined;
  }

  /**
   * Get trading signal based on current conditions
   */
  getSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 'NEUTRAL';

    const { k, d } = latestResult.value as StochasticResult;
    const signal = this.getInternalSignal(k, d);

    if (signal === 'BUY' || signal === 'BULLISH_CROSS') return 'BUY';
    if (signal === 'SELL' || signal === 'BEARISH_CROSS') return 'SELL';
    return 'NEUTRAL';
  }

  /**
   * Check if %K is diverging from price (basic divergence detection)
   */
  isDiverging(priceHigh: number, priceLow: number): 'BULLISH' | 'BEARISH' | 'NONE' {
    const results = this.getResults(this.kPeriod);
    if (results.length < this.kPeriod) return 'NONE';

    const firstK = (results[0].value as StochasticResult).k;
    const lastK = (results[results.length - 1].value as StochasticResult).k;

    // Simple divergence check
    if (priceLow < priceLow && lastK > firstK) return 'BULLISH'; // Price makes lower low, Stoch higher low
    if (priceHigh > priceHigh && lastK < firstK) return 'BEARISH'; // Price makes higher high, Stoch lower high
    
    return 'NONE';
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `Stochastic(${this.kPeriod},${this.dPeriod}) [${this.getStatus()}] Value: N/A`;
    }

    const { k, d } = latestResult.value as StochasticResult;
    const signal = this.getSignal();
    return `Stochastic(${this.kPeriod},${this.dPeriod}) [${this.getStatus()}] ` +
           `%K: ${k.toFixed(2)}, %D: ${d.toFixed(2)}, Signal: ${signal}`;
  }
}