/**
 * Average True Range (ATR) Indicator - Task BE-010
 * 
 * Calculates the average true range over a specified period to measure volatility.
 * True Range is the maximum of: (High - Low), |High - Previous Close|, |Low - Previous Close|
 * 
 * Formula: ATR = EMA/SMA of True Range values
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface ATRConfig extends IndicatorConfig {
  /** Use exponential smoothing instead of simple average */
  useEMA?: boolean;
  /** Smoothing factor for EMA (if useEMA is true) */
  smoothingFactor?: number;
}

/**
 * Average True Range implementation with configurable smoothing
 */
export class ATR extends TechnicalIndicator<number> {
  private readonly useEMA: boolean;
  private readonly smoothingFactor: number;

  private trueRangeBuffer: NumericCircularBuffer;
  private previousClose?: number;
  private atrValue = 0;

  constructor(config: ATRConfig) {
    super('ATR', config);
    
    this.useEMA = config.useEMA || false;
    this.smoothingFactor = config.smoothingFactor || (2 / (config.period + 1));

    this.trueRangeBuffer = new NumericCircularBuffer(config.period * 2);
  }

  /**
   * Calculate ATR for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length < 2) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    // Calculate True Range for each candle (starting from second candle)
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      const tr = mathUtils.trueRange(current.high, current.low, previous.close);
      trueRanges.push(tr);
    }

    if (trueRanges.length === 0) {
      return 0;
    }

    // Calculate ATR using appropriate averaging method
    if (this.useEMA) {
      return this.calculateEMABasedATR(trueRanges);
    } else {
      // Simple moving average of true ranges
      const recentTR = trueRanges.slice(-this.config.period);
      return mathUtils.sma(recentTR, recentTR.length);
    }
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const dataBuffer = this.dataBuffer.getAll();
    
    if (dataBuffer.length < 2) {
      this.previousClose = newCandle.close;
      return 0;
    }

    // Get the previous candle
    const prevCandle = dataBuffer[dataBuffer.length - 2];
    
    // Calculate True Range for the new candle
    const tr = mathUtils.trueRange(newCandle.high, newCandle.low, prevCandle.close);
    this.trueRangeBuffer.push(tr);

    // Update ATR value
    if (this.useEMA) {
      // Use EMA-based ATR calculation
      if (this.atrValue === 0) {
        // Initialize with simple average for first period
        const initialTRs = this.trueRangeBuffer.getAll();
        if (initialTRs.length >= this.config.period) {
          this.atrValue = mathUtils.sma(initialTRs.slice(-this.config.period), this.config.period);
        } else {
          this.atrValue = mathUtils.sma(initialTRs, initialTRs.length);
        }
      } else {
        // Update using EMA formula: ATR = ((ATR_prev * (n-1)) + TR) / n
        // Or: ATR = ATR_prev + α * (TR - ATR_prev) where α = 2/(n+1)
        this.atrValue = this.atrValue + this.smoothingFactor * (tr - this.atrValue);
      }
      return this.atrValue;
    } else {
      // Simple moving average
      if (this.trueRangeBuffer.size() >= this.config.period) {
        const recentTRs = this.trueRangeBuffer.getWindow(this.config.period);
        return mathUtils.sma(recentTRs, recentTRs.length);
      } else {
        const allTRs = this.trueRangeBuffer.getAll();
        return mathUtils.sma(allTRs, allTRs.length);
      }
    }
  }

  /**
   * Calculate EMA-based ATR for historical data
   */
  private calculateEMABasedATR(trueRanges: number[]): number {
    if (trueRanges.length === 0) return 0;
    if (trueRanges.length === 1) return trueRanges[0];

    // Initialize with first value or simple average of first few values
    let atr = trueRanges.length >= this.config.period ? 
      mathUtils.sma(trueRanges.slice(0, this.config.period), this.config.period) :
      mathUtils.sma(trueRanges, trueRanges.length);

    // Apply EMA formula to remaining values
    const startIndex = Math.max(this.config.period, 1);
    for (let i = startIndex; i < trueRanges.length; i++) {
      atr = atr + this.smoothingFactor * (trueRanges[i] - atr);
    }

    return atr;
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.trueRangeBuffer.clear();
    this.previousClose = undefined;
    this.atrValue = 0;
  }

  /**
   * Validate ATR configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const atrConfig = config as ATRConfig;

    if (atrConfig.smoothingFactor !== undefined) {
      if (atrConfig.smoothingFactor <= 0 || atrConfig.smoothingFactor > 1) {
        throw new Error('Smoothing factor must be between 0 and 1');
      }
    }
  }

  /**
   * Get ATR metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      useEMA: this.useEMA,
      smoothingFactor: this.smoothingFactor,
      volatilityLevel: this.getVolatilityLevel(value, data),
      averagePrice: this.getAveragePrice(data)
    };
  }

  /**
   * Get volatility level description
   */
  private getVolatilityLevel(atrValue: number, data: OHLCV[]): string {
    if (data.length === 0) return 'UNKNOWN';
    
    const avgPrice = this.getAveragePrice(data);
    const atrPercent = avgPrice > 0 ? (atrValue / avgPrice) * 100 : 0;

    if (atrPercent > 3) return 'VERY_HIGH';
    if (atrPercent > 2) return 'HIGH';
    if (atrPercent > 1) return 'MODERATE';
    if (atrPercent > 0.5) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Get average price from recent data
   */
  private getAveragePrice(data: OHLCV[]): number {
    if (data.length === 0) return 0;
    
    const recentData = data.slice(-this.config.period);
    const closes = recentData.map(candle => candle.close);
    return mathUtils.sma(closes, closes.length);
  }

  /**
   * Get ATR as percentage of current price
   */
  getATRPercent(currentPrice: number): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid || currentPrice <= 0) return 0;
    
    const atrValue = latestResult.value as number;
    return (atrValue / currentPrice) * 100;
  }

  /**
   * Get volatility-based position sizing suggestion
   */
  getPositionSizeMultiplier(): number {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return 1;
    
    const metadata = latestResult.metadata;
    const volatilityLevel = metadata?.volatilityLevel as string;

    switch (volatilityLevel) {
      case 'VERY_HIGH': return 0.5;
      case 'HIGH': return 0.7;
      case 'MODERATE': return 1.0;
      case 'LOW': return 1.3;
      case 'VERY_LOW': return 1.5;
      default: return 1.0;
    }
  }

  /**
   * Calculate stop loss distance based on ATR multiple
   */
  getStopLossDistance(atrMultiple: number = 2): number {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as number) * atrMultiple : 0;
  }

  /**
   * Get profit target distance based on ATR multiple
   */
  getProfitTargetDistance(atrMultiple: number = 3): number {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as number) * atrMultiple : 0;
  }

  /**
   * Check if volatility is increasing
   */
  isVolatilityIncreasing(lookbackPeriods: number = 5): boolean {
    const results = this.getResults(lookbackPeriods);
    if (results.length < lookbackPeriods) return false;

    const values = results.map(r => r.value as number);
    
    // Check if recent values are generally higher than older values
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
   * Get ATR-based support and resistance levels
   */
  getSupportResistanceLevels(currentPrice: number, atrMultiple: number = 1): {
    support: number;
    resistance: number;
  } {
    const atr = this.getLatestResult()?.value as number || 0;
    const distance = atr * atrMultiple;
    
    return {
      support: currentPrice - distance,
      resistance: currentPrice + distance
    };
  }

  /**
   * Get current True Range buffer for analysis
   */
  getTrueRangeBuffer(): number[] {
    return this.trueRangeBuffer.getAll();
  }

  /**
   * Get ATR trend (increasing/decreasing volatility)
   */
  getATRTrend(periods: number = 3): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (this.isVolatilityIncreasing(periods)) return 'INCREASING';
    if (this.isVolatilityDecreasing(periods)) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Compare current ATR to historical average
   */
  getVolatilityRatio(lookbackPeriods: number = 20): number {
    const results = this.getResults(lookbackPeriods);
    if (results.length < 2) return 1;

    const currentATR = results[results.length - 1].value as number;
    const historicalATRs = results.slice(0, -1).map(r => r.value as number);
    const avgHistoricalATR = mathUtils.sma(historicalATRs, historicalATRs.length);

    return avgHistoricalATR > 0 ? currentATR / avgHistoricalATR : 1;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `ATR(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const value = latestResult.value as number;
    const method = this.useEMA ? 'EMA' : 'SMA';
    const trend = this.getATRTrend();
    const volatilityLevel = latestResult.metadata?.volatilityLevel;
    
    return `ATR(${this.config.period}, ${method}) [${this.getStatus()}] ` +
           `Value: ${value.toFixed(4)}, Level: ${volatilityLevel}, Trend: ${trend}`;
  }
}