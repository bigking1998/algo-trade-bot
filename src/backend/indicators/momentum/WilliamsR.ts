/**
 * Williams %R Indicator - Task BE-010
 * 
 * Calculates Williams %R momentum oscillator, which is similar to Stochastic
 * but is scaled from 0 to -100 (inverted scale).
 * 
 * Formula: %R = -100 × ((HighestHigh - Close) / (HighestHigh - LowestLow))
 * Range: 0 to -100 (overbought near 0, oversold near -100)
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { mathUtils } from '../base/MathUtils.js';

export interface WilliamsRConfig extends IndicatorConfig {
  /** Overbought level (typically -20) */
  overboughtLevel?: number;
  /** Oversold level (typically -80) */
  oversoldLevel?: number;
}

/**
 * Williams %R momentum oscillator
 */
export class WilliamsR extends TechnicalIndicator<number> {
  private readonly overboughtLevel: number;
  private readonly oversoldLevel: number;

  constructor(config: WilliamsRConfig) {
    super('Williams%R', config);
    
    // Williams %R uses inverted scale: 0 to -100
    this.overboughtLevel = config.overboughtLevel || -20;
    this.oversoldLevel = config.oversoldLevel || -80;
  }

  /**
   * Calculate Williams %R for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length < this.config.period) {
      return -50; // Neutral value
    }

    const recentData = data.slice(-this.config.period);
    const highs = recentData.map(candle => candle.high);
    const lows = recentData.map(candle => candle.low);
    const currentClose = data[data.length - 1].close;

    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);

    return this.calculateWilliamsR(currentClose, highestHigh, lowestLow);
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const dataBuffer = this.dataBuffer.getAll();
    
    if (dataBuffer.length < this.config.period) {
      return -50;
    }

    const recentData = dataBuffer.slice(-this.config.period);
    const highs = recentData.map(candle => candle.high);
    const lows = recentData.map(candle => candle.low);
    const currentClose = dataBuffer[dataBuffer.length - 1].close;

    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);

    return this.calculateWilliamsR(currentClose, highestHigh, lowestLow);
  }

  /**
   * Calculate Williams %R value
   */
  private calculateWilliamsR(close: number, highestHigh: number, lowestLow: number): number {
    const range = highestHigh - lowestLow;
    
    if (range === 0) {
      return -50; // Neutral when no range
    }

    // Williams %R formula: -100 * ((HH - C) / (HH - LL))
    return -100 * ((highestHigh - close) / range);
  }

  /**
   * Validate Williams %R configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const williamsConfig = config as WilliamsRConfig;

    if (williamsConfig.overboughtLevel !== undefined) {
      if (williamsConfig.overboughtLevel > 0 || williamsConfig.overboughtLevel < -50) {
        throw new Error('Overbought level must be between -50 and 0');
      }
    }

    if (williamsConfig.oversoldLevel !== undefined) {
      if (williamsConfig.oversoldLevel > -50 || williamsConfig.oversoldLevel < -100) {
        throw new Error('Oversold level must be between -100 and -50');
      }
    }

    if (williamsConfig.overboughtLevel && williamsConfig.oversoldLevel) {
      if (williamsConfig.overboughtLevel <= williamsConfig.oversoldLevel) {
        throw new Error('Overbought level must be higher than oversold level');
      }
    }
  }

  /**
   * Get Williams %R metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      overboughtLevel: this.overboughtLevel,
      oversoldLevel: this.oversoldLevel,
      signal: this.getSignalFromValue(value),
      scaledValue: this.convertToPositiveScale(value) // 0-100 scale for easier interpretation
    };
  }

  /**
   * Get signal from Williams %R value
   */
  private getSignalFromValue(value: number): string {
    if (value >= this.overboughtLevel) {
      return 'OVERBOUGHT';
    } else if (value <= this.oversoldLevel) {
      return 'OVERSOLD';
    } else if (value > -50) {
      return 'BULLISH';
    } else if (value < -50) {
      return 'BEARISH';
    }
    return 'NEUTRAL';
  }

  /**
   * Convert Williams %R to positive scale (0-100) for easier interpretation
   */
  private convertToPositiveScale(value: number): number {
    return value + 100; // -100 to 0 becomes 0 to 100
  }

  /**
   * Check if in overbought condition
   */
  isOverbought(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value >= this.overboughtLevel;
  }

  /**
   * Check if in oversold condition
   */
  isOversold(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value <= this.oversoldLevel;
  }

  /**
   * Check if Williams %R is bullish (above -50)
   */
  isBullish(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value > -50;
  }

  /**
   * Check if Williams %R is bearish (below -50)
   */
  isBearish(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value < -50;
  }

  /**
   * Check for bullish reversal (crossing above oversold level)
   */
  hasBullishReversal(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return current > this.oversoldLevel && previous <= this.oversoldLevel;
  }

  /**
   * Check for bearish reversal (crossing below overbought level)
   */
  hasBearishReversal(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return current < this.overboughtLevel && previous >= this.overboughtLevel;
  }

  /**
   * Get momentum strength (0-1, where 1 is strongest momentum)
   */
  getMomentumStrength(): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 0;
    
    const value = latestResult.value as number;
    
    // Calculate strength based on distance from neutral (-50)
    const distanceFromNeutral = Math.abs(value + 50);
    return Math.min(distanceFromNeutral / 50, 1); // Normalize to 0-1
  }

  /**
   * Get current Williams %R on positive scale (0-100)
   */
  getPositiveScale(): number | undefined {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? this.convertToPositiveScale(latestResult.value as number) : undefined;
  }

  /**
   * Get trading signal
   */
  getSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (this.hasBullishReversal()) return 'BUY';
    if (this.hasBearishReversal()) return 'SELL';
    return 'NEUTRAL';
  }

  /**
   * Calculate swing failure (failure swing pattern)
   * Bullish: Second bottom above first bottom while price makes lower low
   * Bearish: Second top below first top while price makes higher high
   */
  hasSwingFailure(priceData: number[]): 'BULLISH' | 'BEARISH' | 'NONE' {
    const results = this.getResults(10);
    if (results.length < 10 || priceData.length < 10) return 'NONE';

    const williamsValues = results.map(r => r.value as number);
    
    // Simple swing failure detection (can be enhanced)
    const recentWilliams = williamsValues.slice(-5);
    const recentPrices = priceData.slice(-5);
    
    const williamsLow1 = Math.min(...recentWilliams.slice(0, 2));
    const williamsLow2 = Math.min(...recentWilliams.slice(3, 5));
    const priceLow1 = Math.min(...recentPrices.slice(0, 2));
    const priceLow2 = Math.min(...recentPrices.slice(3, 5));

    // Bullish failure swing: Williams makes higher low, price makes lower low
    if (williamsLow2 > williamsLow1 && priceLow2 < priceLow1 && williamsLow1 <= this.oversoldLevel) {
      return 'BULLISH';
    }

    const williamsHigh1 = Math.max(...recentWilliams.slice(0, 2));
    const williamsHigh2 = Math.max(...recentWilliams.slice(3, 5));
    const priceHigh1 = Math.max(...recentPrices.slice(0, 2));
    const priceHigh2 = Math.max(...recentPrices.slice(3, 5));

    // Bearish failure swing: Williams makes lower high, price makes higher high
    if (williamsHigh2 < williamsHigh1 && priceHigh2 > priceHigh1 && williamsHigh1 >= this.overboughtLevel) {
      return 'BEARISH';
    }

    return 'NONE';
  }

  /**
   * Get velocity (rate of change)
   */
  getVelocity(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length < periods + 1) return 0;

    const current = results[results.length - 1].value as number;
    const previous = results[results.length - 1 - periods].value as number;

    return current - previous;
  }

  /**
   * Check if Williams %R is in extreme zone (very overbought or oversold)
   */
  isInExtremeZone(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value >= -10 || value <= -90; // Extreme zones
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `Williams%R(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const value = latestResult.value as number;
    const signal = this.getSignal();
    const positiveScale = this.convertToPositiveScale(value);
    
    return `Williams%R(${this.config.period}) [${this.getStatus()}] ` +
           `Value: ${value.toFixed(2)}, Scale: ${positiveScale.toFixed(2)}, Signal: ${signal}`;
  }
}