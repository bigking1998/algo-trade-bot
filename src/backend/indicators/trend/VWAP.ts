/**
 * Volume Weighted Average Price (VWAP) Indicator - Task BE-010
 * 
 * Calculates the volume-weighted average price over a specified period.
 * Provides more accurate average price by weighting prices by volume.
 * 
 * Formula: VWAP = Σ(Price × Volume) / Σ(Volume)
 * Where Price is typically (High + Low + Close) / 3
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer, CircularBufferImpl } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface VWAPConfig extends IndicatorConfig {
  /** Price type to use for VWAP calculation */
  priceType?: 'typical' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Whether to reset VWAP daily (for session-based VWAP) */
  sessionBased?: boolean;
}

/**
 * Volume Weighted Average Price with streaming optimization
 */
export class VWAP extends TechnicalIndicator<number> {
  private readonly priceType: string;
  private readonly sessionBased: boolean;
  
  private priceVolumeBuffer: NumericCircularBuffer;
  private volumeBuffer: NumericCircularBuffer;
  private cumulativePV = 0;
  private cumulativeVolume = 0;
  private sessionStartTime?: Date;

  constructor(config: VWAPConfig) {
    super('VWAP', config);
    this.priceType = config.priceType || 'typical';
    this.sessionBased = config.sessionBased || false;
    
    const bufferSize = this.sessionBased ? 1000 : config.period * 2;
    this.priceVolumeBuffer = new NumericCircularBuffer(bufferSize);
    this.volumeBuffer = new NumericCircularBuffer(bufferSize);
  }

  /**
   * Calculate VWAP value for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length === 0) {
      return 0;
    }

    let totalPV = 0;
    let totalVolume = 0;

    // Calculate cumulative price-volume for the period
    const startIndex = Math.max(0, data.length - this.config.period);
    
    for (let i = startIndex; i < data.length; i++) {
      const price = this.extractPrice(data[i]);
      const volume = data[i].volume || 0;
      const pv = price * volume;
      
      totalPV += pv;
      totalVolume += volume;
    }

    return totalVolume > 0 ? totalPV / totalVolume : 0;
  }

  /**
   * Optimized streaming update using cumulative values
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const price = this.extractPrice(newCandle);
    const volume = newCandle.volume || 0;
    const pv = price * volume;

    // Check for session reset
    if (this.sessionBased && this.shouldResetSession(newCandle.time)) {
      this.resetSession();
    }

    // Update buffers
    const wasFullBefore = this.priceVolumeBuffer.isFull();
    const oldestPV = this.priceVolumeBuffer.peekNext();
    const oldestVolume = this.volumeBuffer.peekNext();

    this.priceVolumeBuffer.push(pv);
    this.volumeBuffer.push(volume);

    // Update cumulative values efficiently
    if (wasFullBefore && oldestPV !== undefined && oldestVolume !== undefined) {
      // Replace oldest values with new values
      this.cumulativePV = this.cumulativePV - oldestPV + pv;
      this.cumulativeVolume = this.cumulativeVolume - oldestVolume + volume;
    } else {
      // Buffer not full yet, just add new values
      this.cumulativePV += pv;
      this.cumulativeVolume += volume;
    }

    // Calculate VWAP from cumulative values
    return this.cumulativeVolume > 0 ? this.cumulativePV / this.cumulativeVolume : 0;
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.priceVolumeBuffer.clear();
    this.volumeBuffer.clear();
    this.cumulativePV = 0;
    this.cumulativeVolume = 0;
    this.sessionStartTime = undefined;
  }

  /**
   * Validate VWAP-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const vwapConfig = config as VWAPConfig;
    
    if (vwapConfig.priceType && !this.isValidPriceType(vwapConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${vwapConfig.priceType}. ` +
        'Valid types: typical, close, hl2, hlc3, ohlc4'
      );
    }
  }

  /**
   * Get VWAP-specific metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      sessionBased: this.sessionBased,
      cumulativePV: this.cumulativePV,
      cumulativeVolume: this.cumulativeVolume,
      sessionStartTime: this.sessionStartTime?.toISOString()
    };
  }

  /**
   * Extract price based on price type
   */
  private extractPrice(candle: OHLCV): number {
    switch (this.priceType) {
      case 'typical':
        return mathUtils.typicalPrice(candle.high, candle.low, candle.close);
      case 'close':
        return candle.close;
      case 'hl2':
        return (candle.high + candle.low) / 2;
      case 'hlc3':
        return (candle.high + candle.low + candle.close) / 3;
      case 'ohlc4':
        return (candle.open + candle.high + candle.low + candle.close) / 4;
      default:
        return mathUtils.typicalPrice(candle.high, candle.low, candle.close);
    }
  }

  /**
   * Check if price type is valid
   */
  private isValidPriceType(priceType: string): boolean {
    return ['typical', 'close', 'hl2', 'hlc3', 'ohlc4'].includes(priceType);
  }

  /**
   * Check if session should be reset
   */
  private shouldResetSession(currentTime: Date): boolean {
    if (!this.sessionStartTime) {
      this.sessionStartTime = currentTime;
      return false;
    }

    // Reset if it's a new day (simple implementation)
    const currentDate = currentTime.toDateString();
    const sessionDate = this.sessionStartTime.toDateString();
    
    return currentDate !== sessionDate;
  }

  /**
   * Reset session state
   */
  private resetSession(): void {
    this.priceVolumeBuffer.clear();
    this.volumeBuffer.clear();
    this.cumulativePV = 0;
    this.cumulativeVolume = 0;
  }

  /**
   * Get VWAP deviation (distance from current price)
   */
  getDeviation(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult || !latestResult.isValid) {
      return 0;
    }

    const vwapValue = latestResult.value as number;
    return currentPrice - vwapValue;
  }

  /**
   * Get VWAP deviation as percentage
   */
  getPercentageDeviation(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult || !latestResult.isValid) {
      return 0;
    }

    const vwapValue = latestResult.value as number;
    return vwapValue !== 0 ? ((currentPrice - vwapValue) / vwapValue) * 100 : 0;
  }

  /**
   * Get current volume statistics
   */
  getVolumeStats(): {
    totalVolume: number;
    avgVolume: number;
    volumeCount: number;
  } {
    const volumes = this.volumeBuffer.getAll();
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    
    return {
      totalVolume,
      avgVolume: volumes.length > 0 ? totalVolume / volumes.length : 0,
      volumeCount: volumes.length
    };
  }

  /**
   * Check if price is above VWAP
   */
  isPriceAboveVWAP(price: number): boolean {
    const latestResult = this.getLatestResult();
    return latestResult && latestResult.isValid ? 
      price > (latestResult.value as number) : false;
  }

  /**
   * Check if price is below VWAP
   */
  isPriceBelowVWAP(price: number): boolean {
    const latestResult = this.getLatestResult();
    return latestResult && latestResult.isValid ? 
      price < (latestResult.value as number) : false;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const vwapValue = this.getLatestResult()?.value || 'N/A';
    return `VWAP(${this.config.period}, ${this.priceType}) [${this.getStatus()}] ` +
           `Value: ${vwapValue}, Volume: ${this.cumulativeVolume}`;
  }
}