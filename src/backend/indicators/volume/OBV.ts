/**
 * On-Balance Volume (OBV) Indicator - Task BE-010
 * 
 * Calculates the On-Balance Volume which relates volume to price change.
 * OBV is a momentum indicator that uses volume flow to predict changes in price.
 * 
 * Formula: 
 * If Close > Previous Close: OBV = Previous OBV + Volume
 * If Close < Previous Close: OBV = Previous OBV - Volume
 * If Close = Previous Close: OBV = Previous OBV
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { mathUtils } from '../base/MathUtils.js';

export interface OBVConfig extends IndicatorConfig {
  /** Use relative OBV (percentage change) instead of absolute values */
  useRelative?: boolean;
  /** Smoothing period for OBV signal line */
  signalPeriod?: number;
}

/**
 * On-Balance Volume implementation with optional smoothing
 */
export class OBV extends TechnicalIndicator<number> {
  private readonly useRelative: boolean;
  private readonly signalPeriod?: number;

  private obvValue = 0;
  private previousClose?: number;
  private initialOBV?: number;

  constructor(config: OBVConfig) {
    super('OBV', { ...config, period: config.period || 1 }); // OBV doesn't require a period
    
    this.useRelative = config.useRelative || false;
    this.signalPeriod = config.signalPeriod;
  }

  /**
   * Calculate OBV for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length === 0) {
      return 0;
    }

    let obv = 0;
    
    // Calculate OBV for each candle
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      if (current.close > previous.close) {
        obv += current.volume || 0;
      } else if (current.close < previous.close) {
        obv -= current.volume || 0;
      }
      // If close equals previous close, OBV remains unchanged
    }

    return this.useRelative ? this.calculateRelativeOBV(obv) : obv;
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const dataBuffer = this.dataBuffer.getAll();
    
    if (dataBuffer.length < 2) {
      this.previousClose = newCandle.close;
      this.obvValue = 0;
      if (this.initialOBV === undefined) {
        this.initialOBV = 0;
      }
      return 0;
    }

    // Get previous candle
    const prevCandle = dataBuffer[dataBuffer.length - 2];
    const volume = newCandle.volume || 0;

    // Update OBV based on price direction
    if (newCandle.close > prevCandle.close) {
      this.obvValue += volume;
    } else if (newCandle.close < prevCandle.close) {
      this.obvValue -= volume;
    }
    // If prices are equal, OBV remains unchanged

    this.previousClose = newCandle.close;

    return this.useRelative ? this.calculateRelativeOBV(this.obvValue) : this.obvValue;
  }

  /**
   * Calculate relative OBV (as percentage of initial value)
   */
  private calculateRelativeOBV(obv: number): number {
    if (this.initialOBV === undefined || this.initialOBV === 0) {
      this.initialOBV = Math.abs(obv) || 1; // Avoid division by zero
      return 0;
    }
    return (obv / this.initialOBV) * 100;
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.obvValue = 0;
    this.previousClose = undefined;
    this.initialOBV = undefined;
  }

  /**
   * Validate OBV configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const obvConfig = config as OBVConfig;

    if (obvConfig.signalPeriod !== undefined && obvConfig.signalPeriod <= 0) {
      throw new Error('Signal period must be positive');
    }
  }

  /**
   * Get OBV metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    const trend = this.getInternalOBVTrend();
    
    return {
      ...super.getResultMetadata(value, data),
      useRelative: this.useRelative,
      signalPeriod: this.signalPeriod,
      trend,
      divergenceSignal: this.checkForDivergence(data),
      volumeStrength: this.getVolumeStrength()
    };
  }

  /**
   * Get OBV trend direction (internal)
   */
  private getInternalOBVTrend(periods: number = 3): 'RISING' | 'FALLING' | 'SIDEWAYS' {
    const results = this.getResults(periods);
    if (results.length < periods) return 'SIDEWAYS';

    const values = results.map(r => r.value as number);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = lastValue - firstValue;
    const threshold = Math.abs(firstValue) * 0.01; // 1% threshold

    if (change > threshold) return 'RISING';
    if (change < -threshold) return 'FALLING';
    return 'SIDEWAYS';
  }

  /**
   * Get OBV trend direction
   */
  getOBVTrend(periods: number = 3): 'RISING' | 'FALLING' | 'SIDEWAYS' {
    return this.getInternalOBVTrend(periods);
  }

  /**
   * Check for basic divergence with price
   */
  private checkForDivergence(data: OHLCV[]): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (data.length < 10) return 'NONE';
    
    const results = this.getResults(10);
    if (results.length < 10) return 'NONE';

    const recentData = data.slice(-5);
    const pastData = data.slice(-10, -5);
    const recentOBV = results.slice(-5).map(r => r.value as number);
    const pastOBV = results.slice(-10, -5).map(r => r.value as number);

    const recentPriceHigh = Math.max(...recentData.map(c => c.high));
    const pastPriceHigh = Math.max(...pastData.map(c => c.high));
    const recentOBVMax = Math.max(...recentOBV);
    const pastOBVMax = Math.max(...pastOBV);

    const recentPriceLow = Math.min(...recentData.map(c => c.low));
    const pastPriceLow = Math.min(...pastData.map(c => c.low));
    const recentOBVMin = Math.min(...recentOBV);
    const pastOBVMin = Math.min(...pastOBV);

    // Bearish divergence: Price makes higher high, OBV makes lower high
    if (recentPriceHigh > pastPriceHigh && recentOBVMax < pastOBVMax) {
      return 'BEARISH';
    }

    // Bullish divergence: Price makes lower low, OBV makes higher low
    if (recentPriceLow < pastPriceLow && recentOBVMin > pastOBVMin) {
      return 'BULLISH';
    }

    return 'NONE';
  }

  /**
   * Get volume strength indicator
   */
  private getVolumeStrength(): 'STRONG' | 'MODERATE' | 'WEAK' {
    const results = this.getResults(5);
    if (results.length < 5) return 'MODERATE';

    const values = results.map(r => r.value as number);
    const changes = [];
    
    for (let i = 1; i < values.length; i++) {
      changes.push(Math.abs(values[i] - values[i - 1]));
    }

    const avgChange = mathUtils.sma(changes, changes.length);
    const recentChange = changes[changes.length - 1];

    if (recentChange > avgChange * 2) return 'STRONG';
    if (recentChange > avgChange * 0.5) return 'MODERATE';
    return 'WEAK';
  }

  /**
   * Check if OBV is confirming price trend
   */
  isConfirmingTrend(priceDirection: 'UP' | 'DOWN'): boolean {
    const obvTrend = this.getOBVTrend();
    
    if (priceDirection === 'UP') {
      return obvTrend === 'RISING';
    } else {
      return obvTrend === 'FALLING';
    }
  }

  /**
   * Get OBV divergence with price
   */
  getDivergence(priceHigh: number, priceLow: number, currentHigh: number, currentLow: number): 'BULLISH' | 'BEARISH' | 'NONE' {
    const results = this.getResults(this.config.period);
    if (results.length < this.config.period) return 'NONE';

    const obvValues = results.map(r => r.value as number);
    const recentOBV = obvValues.slice(-Math.floor(this.config.period / 2));
    const pastOBV = obvValues.slice(-this.config.period, -Math.floor(this.config.period / 2));

    const recentOBVHigh = Math.max(...recentOBV);
    const pastOBVHigh = Math.max(...pastOBV);
    const recentOBVLow = Math.min(...recentOBV);
    const pastOBVLow = Math.min(...pastOBV);

    // Bearish divergence: Price higher high, OBV lower high
    if (currentHigh > priceHigh && recentOBVHigh < pastOBVHigh) {
      return 'BEARISH';
    }

    // Bullish divergence: Price lower low, OBV higher low
    if (currentLow < priceLow && recentOBVLow > pastOBVLow) {
      return 'BULLISH';
    }

    return 'NONE';
  }

  /**
   * Get OBV signal line (smoothed OBV)
   */
  getSignalLine(): number | undefined {
    if (!this.signalPeriod) return undefined;

    const results = this.getResults(this.signalPeriod);
    if (results.length < this.signalPeriod) return undefined;

    const values = results.map(r => r.value as number);
    return mathUtils.sma(values, this.signalPeriod);
  }

  /**
   * Check for OBV signal line crossover
   */
  hasSignalCrossover(): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (!this.signalPeriod) return 'NONE';

    const results = this.getResults(2);
    if (results.length < 2) return 'NONE';

    const currentOBV = results[1].value as number;
    const previousOBV = results[0].value as number;
    
    const allResults = this.getResults(this.signalPeriod + 1);
    if (allResults.length < this.signalPeriod + 1) return 'NONE';

    const currentSignal = mathUtils.sma(
      allResults.slice(-this.signalPeriod).map(r => r.value as number),
      this.signalPeriod
    );
    const previousSignal = mathUtils.sma(
      allResults.slice(-this.signalPeriod - 1, -1).map(r => r.value as number),
      this.signalPeriod
    );

    // Bullish crossover: OBV crosses above signal line
    if (currentOBV > currentSignal && previousOBV <= previousSignal) {
      return 'BULLISH';
    }

    // Bearish crossover: OBV crosses below signal line
    if (currentOBV < currentSignal && previousOBV >= previousSignal) {
      return 'BEARISH';
    }

    return 'NONE';
  }

  /**
   * Get OBV momentum (rate of change)
   */
  getMomentum(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length < periods + 1) return 0;

    const current = results[results.length - 1].value as number;
    const past = results[results.length - 1 - periods].value as number;

    return current - past;
  }

  /**
   * Get volume accumulation/distribution ratio
   */
  getAccumulationDistributionRatio(lookbackPeriods: number = 10): number {
    const results = this.getResults(lookbackPeriods);
    if (results.length < 2) return 0;

    const values = results.map(r => r.value as number);
    let accumulation = 0;
    let distribution = 0;

    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      if (change > 0) {
        accumulation += change;
      } else if (change < 0) {
        distribution += Math.abs(change);
      }
    }

    const total = accumulation + distribution;
    return total > 0 ? (accumulation - distribution) / total : 0;
  }

  /**
   * Check if volume is supporting price movement
   */
  isVolumeSupportingPrice(priceChange: number): boolean {
    const obvChange = this.getMomentum(1);
    
    // Volume should move in same direction as price for confirmation
    if (priceChange > 0 && obvChange > 0) return true;
    if (priceChange < 0 && obvChange < 0) return true;
    
    return false;
  }

  /**
   * Get current OBV value
   */
  getCurrentOBV(): number {
    return this.obvValue;
  }

  /**
   * Get trading signal based on OBV
   */
  getSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
    const crossover = this.hasSignalCrossover();
    if (crossover === 'BULLISH') return 'BUY';
    if (crossover === 'BEARISH') return 'SELL';

    const trend = this.getInternalOBVTrend();
    if (trend === 'RISING' && this.getVolumeStrength() === 'STRONG') return 'BUY';
    if (trend === 'FALLING' && this.getVolumeStrength() === 'STRONG') return 'SELL';

    return 'NEUTRAL';
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `OBV [${this.getStatus()}] Value: N/A`;
    }

    const value = latestResult.value as number;
    const trend = this.getInternalOBVTrend();
    const strength = this.getVolumeStrength();
    const signal = this.getSignal();
    const units = this.useRelative ? '%' : '';
    
    return `OBV [${this.getStatus()}] ` +
           `Value: ${value.toFixed(2)}${units}, Trend: ${trend}, ` +
           `Strength: ${strength}, Signal: ${signal}`;
  }
}