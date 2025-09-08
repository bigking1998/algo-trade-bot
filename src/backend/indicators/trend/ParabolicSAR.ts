/**
 * Parabolic SAR (Stop and Reverse) Indicator - Task BE-010
 * 
 * Calculates the parabolic stop and reverse levels for trend following.
 * Provides dynamic support/resistance levels that follow the trend.
 * 
 * Formula: SAR = SAR_prev + AF × (EP - SAR_prev)
 * Where AF = Acceleration Factor, EP = Extreme Point
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, IndicatorResult, StreamingContext } from '../base/types.js';
import { mathUtils } from '../base/MathUtils.js';

export interface ParabolicSARConfig extends IndicatorConfig {
  /** Initial acceleration factor */
  accelerationFactor?: number;
  /** Maximum acceleration factor */
  maxAcceleration?: number;
  /** Acceleration increment */
  accelerationIncrement?: number;
}

export interface ParabolicSARResult {
  /** Current SAR value */
  sar: number;
  /** Current trend direction (1 = up, -1 = down) */
  trend: number;
  /** Current acceleration factor */
  af: number;
  /** Extreme point in current trend */
  ep: number;
  /** Whether a reversal occurred */
  reversal: boolean;
}

/**
 * Parabolic SAR implementation with trend tracking
 */
export class ParabolicSAR extends TechnicalIndicator<ParabolicSARResult> {
  private readonly initialAF: number;
  private readonly maxAF: number;
  private readonly afIncrement: number;

  // State variables
  private sar = 0;
  private trend = 1; // 1 = uptrend, -1 = downtrend
  private af: number;
  private ep = 0;
  private prevHigh = 0;
  private prevLow = 0;
  private isFirstCalculation = true;

  constructor(config: ParabolicSARConfig) {
    super('ParabolicSAR', { ...config, period: config.period || 2 });
    
    this.initialAF = config.accelerationFactor || 0.02;
    this.maxAF = config.maxAcceleration || 0.2;
    this.afIncrement = config.accelerationIncrement || 0.02;
    this.af = this.initialAF;
  }

  /**
   * Calculate Parabolic SAR for given data
   */
  protected calculateValue(data: OHLCV[]): ParabolicSARResult {
    if (data.length < 2) {
      return this.createResult(0, 1, this.initialAF, 0, false);
    }

    // Reset for batch calculation
    this.resetCalculationState();

    let currentSAR = 0;
    let currentTrend = 1;
    let currentAF = this.initialAF;
    let currentEP = 0;

    // Initialize with first two candles
    const firstCandle = data[0];
    const secondCandle = data[1];

    currentSAR = firstCandle.low;
    currentEP = secondCandle.high;
    currentTrend = secondCandle.close > firstCandle.close ? 1 : -1;

    // Calculate SAR for each subsequent candle
    for (let i = 2; i < data.length; i++) {
      const candle = data[i];
      const prevCandle = data[i - 1];

      const result = this.calculateSARStep(
        candle, prevCandle, currentSAR, currentTrend, currentAF, currentEP
      );

      currentSAR = result.sar;
      currentTrend = result.trend;
      currentAF = result.af;
      currentEP = result.ep;
    }

    return this.createResult(currentSAR, currentTrend, currentAF, currentEP, false);
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): ParabolicSARResult {
    if (this.isFirstCalculation) {
      this.initializeFirstCandle(newCandle);
      return this.createResult(this.sar, this.trend, this.af, this.ep, false);
    }

    const dataBuffer = this.dataBuffer.getAll();
    if (dataBuffer.length < 2) {
      return this.createResult(this.sar, this.trend, this.af, this.ep, false);
    }

    const prevCandle = dataBuffer[dataBuffer.length - 1];
    const result = this.calculateSARStep(newCandle, prevCandle, this.sar, this.trend, this.af, this.ep);

    // Update state
    this.sar = result.sar;
    this.trend = result.trend;
    this.af = result.af;
    this.ep = result.ep;

    return result;
  }

  /**
   * Calculate single SAR step
   */
  private calculateSARStep(
    currentCandle: OHLCV,
    prevCandle: OHLCV,
    prevSAR: number,
    prevTrend: number,
    prevAF: number,
    prevEP: number
  ): ParabolicSARResult {
    const { high, low } = currentCandle;
    let newSAR = prevSAR;
    let newTrend = prevTrend;
    let newAF = prevAF;
    let newEP = prevEP;
    let reversal = false;

    if (prevTrend === 1) {
      // Uptrend
      newSAR = prevSAR + prevAF * (prevEP - prevSAR);

      // Check for trend reversal
      if (low <= newSAR) {
        // Reversal to downtrend
        newTrend = -1;
        newSAR = prevEP; // SAR becomes the previous EP
        newEP = low;
        newAF = this.initialAF;
        reversal = true;
      } else {
        // Continue uptrend
        if (high > prevEP) {
          newEP = high;
          newAF = Math.min(prevAF + this.afIncrement, this.maxAF);
        }

        // Ensure SAR doesn't exceed previous two lows
        newSAR = Math.min(newSAR, Math.min(prevCandle.low, low));
      }
    } else {
      // Downtrend
      newSAR = prevSAR + prevAF * (prevEP - prevSAR);

      // Check for trend reversal
      if (high >= newSAR) {
        // Reversal to uptrend
        newTrend = 1;
        newSAR = prevEP; // SAR becomes the previous EP
        newEP = high;
        newAF = this.initialAF;
        reversal = true;
      } else {
        // Continue downtrend
        if (low < prevEP) {
          newEP = low;
          newAF = Math.min(prevAF + this.afIncrement, this.maxAF);
        }

        // Ensure SAR doesn't fall below previous two highs
        newSAR = Math.max(newSAR, Math.max(prevCandle.high, high));
      }
    }

    return this.createResult(newSAR, newTrend, newAF, newEP, reversal);
  }

  /**
   * Initialize first candle state
   */
  private initializeFirstCandle(candle: OHLCV): void {
    this.sar = candle.low;
    this.ep = candle.high;
    this.trend = 1;
    this.af = this.initialAF;
    this.prevHigh = candle.high;
    this.prevLow = candle.low;
    this.isFirstCalculation = false;
  }

  /**
   * Reset calculation state for batch processing
   */
  private resetCalculationState(): void {
    this.sar = 0;
    this.trend = 1;
    this.af = this.initialAF;
    this.ep = 0;
    this.prevHigh = 0;
    this.prevLow = 0;
    this.isFirstCalculation = true;
  }

  /**
   * Create result object
   */
  private createResult(
    sar: number,
    trend: number,
    af: number,
    ep: number,
    reversal: boolean
  ): ParabolicSARResult {
    return { sar, trend, af, ep, reversal };
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.resetCalculationState();
  }

  /**
   * Validate Parabolic SAR configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const sarConfig = config as ParabolicSARConfig;

    if (sarConfig.accelerationFactor !== undefined) {
      if (sarConfig.accelerationFactor <= 0 || sarConfig.accelerationFactor > 1) {
        throw new Error('Acceleration factor must be between 0 and 1');
      }
    }

    if (sarConfig.maxAcceleration !== undefined) {
      if (sarConfig.maxAcceleration <= 0 || sarConfig.maxAcceleration > 1) {
        throw new Error('Max acceleration must be between 0 and 1');
      }
    }

    if (sarConfig.accelerationIncrement !== undefined) {
      if (sarConfig.accelerationIncrement <= 0) {
        throw new Error('Acceleration increment must be positive');
      }
    }

    if (sarConfig.accelerationFactor && sarConfig.maxAcceleration) {
      if (sarConfig.accelerationFactor > sarConfig.maxAcceleration) {
        throw new Error('Initial acceleration factor cannot exceed maximum acceleration');
      }
    }
  }

  /**
   * Get Parabolic SAR metadata
   */
  protected getResultMetadata(value: ParabolicSARResult, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      initialAF: this.initialAF,
      maxAF: this.maxAF,
      afIncrement: this.afIncrement,
      currentTrend: value.trend > 0 ? 'UP' : 'DOWN'
    };
  }

  /**
   * Check if currently in uptrend
   */
  isUptrend(): boolean {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid && (latestResult.value as ParabolicSARResult).trend > 0;
  }

  /**
   * Check if currently in downtrend
   */
  isDowntrend(): boolean {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid && (latestResult.value as ParabolicSARResult).trend < 0;
  }

  /**
   * Get current SAR value
   */
  getCurrentSAR(): number | undefined {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as ParabolicSARResult).sar : undefined;
  }

  /**
   * Get current trend direction
   */
  getCurrentTrend(): number | undefined {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as ParabolicSARResult).trend : undefined;
  }

  /**
   * Check if a reversal signal occurred
   */
  hasReversalSignal(): boolean {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as ParabolicSARResult).reversal : false;
  }

  /**
   * Get stop loss level based on current SAR
   */
  getStopLoss(): number | undefined {
    return this.getCurrentSAR();
  }

  /**
   * Check if price should trigger a stop
   */
  shouldStop(currentPrice: number): boolean {
    const sar = this.getCurrentSAR();
    const trend = this.getCurrentTrend();
    
    if (sar === undefined || trend === undefined) {
      return false;
    }

    return trend > 0 ? currentPrice <= sar : currentPrice >= sar;
  }

  /**
   * Get distance from current price to SAR
   */
  getDistanceToSAR(currentPrice: number): number {
    const sar = this.getCurrentSAR();
    return sar !== undefined ? Math.abs(currentPrice - sar) : 0;
  }

  /**
   * Get percentage distance from current price to SAR
   */
  getPercentageDistanceToSAR(currentPrice: number): number {
    const sar = this.getCurrentSAR();
    if (sar === undefined || sar === 0) {
      return 0;
    }
    return ((currentPrice - sar) / sar) * 100;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `ParabolicSAR(${this.initialAF}-${this.maxAF}) [${this.getStatus()}] Value: N/A`;
    }

    const result = latestResult.value as ParabolicSARResult;
    const trendStr = result.trend > 0 ? 'UP' : 'DOWN';
    return `ParabolicSAR(${this.initialAF}-${this.maxAF}) [${this.getStatus()}] ` +
           `SAR: ${result.sar.toFixed(4)}, Trend: ${trendStr}, AF: ${result.af.toFixed(3)}`;
  }
}