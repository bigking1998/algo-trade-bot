/**
 * Commodity Channel Index (CCI) Indicator - Task BE-010
 * 
 * Calculates the CCI which measures the current price level relative to an average
 * price level over a given period. Used to identify cyclical turns in commodities,
 * currencies, and stocks.
 * 
 * Formula: CCI = (Typical Price - SMA of Typical Price) / (0.015 × Mean Deviation)
 * Where Typical Price = (High + Low + Close) / 3
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface CCIConfig extends IndicatorConfig {
  /** Constant multiplier (typically 0.015) */
  constant?: number;
  /** Overbought level (typically +100) */
  overboughtLevel?: number;
  /** Oversold level (typically -100) */
  oversoldLevel?: number;
  /** Extreme overbought level (typically +200) */
  extremeOverboughtLevel?: number;
  /** Extreme oversold level (typically -200) */
  extremeOversoldLevel?: number;
}

/**
 * Commodity Channel Index implementation
 */
export class CCI extends TechnicalIndicator<number> {
  private readonly constant: number;
  private readonly overboughtLevel: number;
  private readonly oversoldLevel: number;
  private readonly extremeOverboughtLevel: number;
  private readonly extremeOversoldLevel: number;

  private typicalPriceBuffer: NumericCircularBuffer;

  constructor(config: CCIConfig) {
    super('CCI', config);
    
    this.constant = config.constant || 0.015;
    this.overboughtLevel = config.overboughtLevel || 100;
    this.oversoldLevel = config.oversoldLevel || -100;
    this.extremeOverboughtLevel = config.extremeOverboughtLevel || 200;
    this.extremeOversoldLevel = config.extremeOversoldLevel || -200;

    this.typicalPriceBuffer = new NumericCircularBuffer(config.period * 2);
  }

  /**
   * Calculate CCI for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length < this.config.period) {
      return 0;
    }

    const recentData = data.slice(-this.config.period);
    const typicalPrices = recentData.map(candle => 
      mathUtils.typicalPrice(candle.high, candle.low, candle.close)
    );

    return this.calculateCCI(typicalPrices);
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const typicalPrice = mathUtils.typicalPrice(newCandle.high, newCandle.low, newCandle.close);
    this.typicalPriceBuffer.push(typicalPrice);

    if (this.typicalPriceBuffer.size() < this.config.period) {
      return 0;
    }

    const recentTypicalPrices = this.typicalPriceBuffer.getWindow(this.config.period);
    return this.calculateCCI(recentTypicalPrices);
  }

  /**
   * Calculate CCI from typical prices
   */
  private calculateCCI(typicalPrices: number[]): number {
    if (typicalPrices.length === 0) {
      return 0;
    }

    const currentTypicalPrice = typicalPrices[typicalPrices.length - 1];
    const smaTypicalPrice = mathUtils.sma(typicalPrices, typicalPrices.length);
    
    // Calculate mean deviation
    let sumAbsoluteDeviations = 0;
    for (const tp of typicalPrices) {
      sumAbsoluteDeviations += Math.abs(tp - smaTypicalPrice);
    }
    const meanDeviation = sumAbsoluteDeviations / typicalPrices.length;

    // Avoid division by zero
    if (meanDeviation === 0) {
      return 0;
    }

    // CCI formula
    return (currentTypicalPrice - smaTypicalPrice) / (this.constant * meanDeviation);
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.typicalPriceBuffer.clear();
  }

  /**
   * Validate CCI configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const cciConfig = config as CCIConfig;

    if (cciConfig.constant !== undefined && cciConfig.constant <= 0) {
      throw new Error('CCI constant must be positive');
    }

    if (cciConfig.overboughtLevel !== undefined && cciConfig.overboughtLevel <= 0) {
      throw new Error('Overbought level must be positive');
    }

    if (cciConfig.oversoldLevel !== undefined && cciConfig.oversoldLevel >= 0) {
      throw new Error('Oversold level must be negative');
    }

    if (cciConfig.extremeOverboughtLevel !== undefined && cciConfig.overboughtLevel !== undefined) {
      if (cciConfig.extremeOverboughtLevel <= cciConfig.overboughtLevel) {
        throw new Error('Extreme overbought level must be higher than overbought level');
      }
    }

    if (cciConfig.extremeOversoldLevel !== undefined && cciConfig.oversoldLevel !== undefined) {
      if (cciConfig.extremeOversoldLevel >= cciConfig.oversoldLevel) {
        throw new Error('Extreme oversold level must be lower than oversold level');
      }
    }
  }

  /**
   * Get CCI metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      constant: this.constant,
      overboughtLevel: this.overboughtLevel,
      oversoldLevel: this.oversoldLevel,
      extremeOverboughtLevel: this.extremeOverboughtLevel,
      extremeOversoldLevel: this.extremeOversoldLevel,
      signal: this.getSignalFromValue(value),
      zone: this.getZone(value)
    };
  }

  /**
   * Get signal from CCI value
   */
  private getSignalFromValue(value: number): string {
    if (value >= this.extremeOverboughtLevel) {
      return 'EXTREME_OVERBOUGHT';
    } else if (value >= this.overboughtLevel) {
      return 'OVERBOUGHT';
    } else if (value <= this.extremeOversoldLevel) {
      return 'EXTREME_OVERSOLD';
    } else if (value <= this.oversoldLevel) {
      return 'OVERSOLD';
    } else if (value > 0) {
      return 'BULLISH';
    } else if (value < 0) {
      return 'BEARISH';
    }
    return 'NEUTRAL';
  }

  /**
   * Get current CCI zone
   */
  private getZone(value: number): string {
    if (value >= this.extremeOverboughtLevel) return 'EXTREME_HIGH';
    if (value >= this.overboughtLevel) return 'HIGH';
    if (value > 0) return 'POSITIVE';
    if (value > this.oversoldLevel) return 'NEGATIVE';
    if (value > this.extremeOversoldLevel) return 'LOW';
    return 'EXTREME_LOW';
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
   * Check if in extreme overbought condition
   */
  isExtremeOverbought(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value >= this.extremeOverboughtLevel;
  }

  /**
   * Check if in extreme oversold condition
   */
  isExtremeOversold(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value <= this.extremeOversoldLevel;
  }

  /**
   * Check if CCI is bullish (above zero)
   */
  isBullish(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value > 0;
  }

  /**
   * Check if CCI is bearish (below zero)
   */
  isBearish(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return false;
    
    const value = latestResult.value as number;
    return value < 0;
  }

  /**
   * Check for zero line crossover (bullish signal)
   */
  hasBullishCrossover(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return current > 0 && previous <= 0;
  }

  /**
   * Check for zero line crossover (bearish signal)
   */
  hasBearishCrossover(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return current < 0 && previous >= 0;
  }

  /**
   * Check for oversold recovery (crossing above oversold level)
   */
  hasOversoldRecovery(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return current > this.oversoldLevel && previous <= this.oversoldLevel;
  }

  /**
   * Check for overbought correction (crossing below overbought level)
   */
  hasOverboughtCorrection(): boolean {
    const results = this.getResults(2);
    if (results.length < 2) return false;

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return current < this.overboughtLevel && previous >= this.overboughtLevel;
  }

  /**
   * Get momentum strength (0-1 scale)
   */
  getMomentumStrength(): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 0;
    
    const value = Math.abs(latestResult.value as number);
    
    // Normalize to 0-1 scale (200 is considered max strength)
    return Math.min(value / 200, 1);
  }

  /**
   * Get CCI velocity (rate of change)
   */
  getVelocity(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length < periods + 1) return 0;

    const current = results[results.length - 1].value as number;
    const previous = results[results.length - 1 - periods].value as number;

    return current - previous;
  }

  /**
   * Detect divergence with price
   */
  hasDivergence(priceHigh: number, priceLow: number, currentHigh: number, currentLow: number): 'BULLISH' | 'BEARISH' | 'NONE' {
    const results = this.getResults(this.config.period);
    if (results.length < this.config.period) return 'NONE';

    const cciValues = results.map(r => r.value as number);
    const recentCCI = cciValues.slice(-Math.floor(this.config.period / 2));
    const pastCCI = cciValues.slice(-this.config.period, -Math.floor(this.config.period / 2));

    const recentCCILow = Math.min(...recentCCI);
    const pastCCILow = Math.min(...pastCCI);
    const recentCCIHigh = Math.max(...recentCCI);
    const pastCCIHigh = Math.max(...pastCCI);

    // Bullish divergence: Price makes lower low, CCI makes higher low
    if (currentLow < priceLow && recentCCILow > pastCCILow && pastCCILow < this.oversoldLevel) {
      return 'BULLISH';
    }

    // Bearish divergence: Price makes higher high, CCI makes lower high
    if (currentHigh > priceHigh && recentCCIHigh < pastCCIHigh && pastCCIHigh > this.overboughtLevel) {
      return 'BEARISH';
    }

    return 'NONE';
  }

  /**
   * Get trading signal
   */
  getSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (this.hasOversoldRecovery() || this.hasBullishCrossover()) return 'BUY';
    if (this.hasOverboughtCorrection() || this.hasBearishCrossover()) return 'SELL';
    return 'NEUTRAL';
  }

  /**
   * Check if in normal trading range
   */
  isInNormalRange(): boolean {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return true;
    
    const value = latestResult.value as number;
    return value > this.oversoldLevel && value < this.overboughtLevel;
  }

  /**
   * Get current zone description
   */
  getCurrentZone(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 'UNKNOWN';
    
    const value = latestResult.value as number;
    return this.getZone(value);
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `CCI(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const value = latestResult.value as number;
    const signal = this.getSignal();
    const zone = this.getCurrentZone();
    
    return `CCI(${this.config.period}) [${this.getStatus()}] ` +
           `Value: ${value.toFixed(2)}, Zone: ${zone}, Signal: ${signal}`;
  }
}