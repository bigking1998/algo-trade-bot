/**
 * ADX (Average Directional Index) Indicator - Task BE-011
 * 
 * ADX measures trend strength regardless of direction. It's derived from the 
 * Directional Movement System and includes:
 * - +DI (Positive Directional Indicator) - bullish trend strength
 * - -DI (Negative Directional Indicator) - bearish trend strength
 * - ADX - overall trend strength (0-100)
 * 
 * Formula:
 * 1. Calculate True Range (TR)
 * 2. Calculate Directional Movement (+DM, -DM)
 * 3. Smooth TR, +DM, -DM using Wilder's smoothing
 * 4. Calculate +DI = 100 * (+DM / TR), -DI = 100 * (-DM / TR)
 * 5. Calculate DX = 100 * |+DI - -DI| / (+DI + -DI)
 * 6. ADX = Smoothed average of DX
 * 
 * Interpretation:
 * - ADX < 25: Weak trend or sideways movement
 * - ADX 25-50: Strong trend
 * - ADX > 50: Very strong trend
 * - ADX > 75: Extremely strong trend
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface ADXConfig extends IndicatorConfig {
  /** Use Wilder's smoothing method (default: true) */
  wildersSmoothing?: boolean;
}

export interface ADXResult {
  /** ADX value (trend strength) */
  adx: number;
  /** Positive Directional Indicator */
  plusDI: number;
  /** Negative Directional Indicator */
  minusDI: number;
  /** Directional Index */
  dx: number;
}

/**
 * ADX implementation with streaming optimization using Wilder's smoothing
 */
export class ADX extends TechnicalIndicator<ADXResult> {
  private readonly useWildersSmoothing: boolean;

  // Buffers for streaming calculations
  private highBuffer: NumericCircularBuffer;
  private lowBuffer: NumericCircularBuffer;
  private closeBuffer: NumericCircularBuffer;
  
  // True Range and Directional Movement buffers
  private trBuffer: NumericCircularBuffer;
  private plusDMBuffer: NumericCircularBuffer;
  private minusDMBuffer: NumericCircularBuffer;
  private dxBuffer: NumericCircularBuffer;

  // Running smoothed values for streaming
  private smoothedTR?: number;
  private smoothedPlusDM?: number;
  private smoothedMinusDM?: number;
  private smoothedADX?: number;
  private isWarmedUp = false;
  private adxWarmedUp = false;

  constructor(config: ADXConfig) {
    super('ADX', config);
    
    this.useWildersSmoothing = config.wildersSmoothing !== false; // Default true

    // Initialize buffers - need extra space for calculations
    const bufferSize = config.period * 2 + 1;
    this.highBuffer = new NumericCircularBuffer(bufferSize);
    this.lowBuffer = new NumericCircularBuffer(bufferSize);
    this.closeBuffer = new NumericCircularBuffer(bufferSize);
    this.trBuffer = new NumericCircularBuffer(bufferSize);
    this.plusDMBuffer = new NumericCircularBuffer(bufferSize);
    this.minusDMBuffer = new NumericCircularBuffer(bufferSize);
    this.dxBuffer = new NumericCircularBuffer(config.period);
  }

  /**
   * Calculate ADX values for given data
   */
  protected calculateValue(data: OHLCV[]): ADXResult {
    if (data.length < this.config.period + 1) {
      return this.createNeutralResult();
    }

    const { highs, lows, closes } = this.getDataArrays(data);
    return this.calculateADXFromArrays(highs, lows, closes);
  }

  /**
   * Optimized streaming update using running smoothed values
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): ADXResult {
    // Add new data to buffers
    this.highBuffer.push(newCandle.high);
    this.lowBuffer.push(newCandle.low);
    this.closeBuffer.push(newCandle.close);

    // Need at least 2 candles to calculate TR and DM
    if (this.highBuffer.size() < 2) {
      return this.createNeutralResult();
    }

    // Calculate True Range and Directional Movement
    const tr = this.calculateTrueRange();
    const { plusDM, minusDM } = this.calculateDirectionalMovement();

    this.trBuffer.push(tr);
    this.plusDMBuffer.push(plusDM);
    this.minusDMBuffer.push(minusDM);

    // Initialize or update smoothed values
    if (!this.isWarmedUp) {
      if (this.trBuffer.size() >= this.config.period) {
        // Initialize with simple averages
        this.smoothedTR = this.trBuffer.mean();
        this.smoothedPlusDM = this.plusDMBuffer.mean();
        this.smoothedMinusDM = this.minusDMBuffer.mean();
        this.isWarmedUp = true;
      } else {
        // Not enough data yet
        return this.createNeutralResult();
      }
    } else {
      // Update using Wilder's smoothing
      if (this.useWildersSmoothing) {
        this.smoothedTR = this.wildersSmoothing(this.smoothedTR!, tr);
        this.smoothedPlusDM = this.wildersSmoothing(this.smoothedPlusDM!, plusDM);
        this.smoothedMinusDM = this.wildersSmoothing(this.smoothedMinusDM!, minusDM);
      } else {
        // Simple moving average
        this.smoothedTR = this.trBuffer.mean();
        this.smoothedPlusDM = this.plusDMBuffer.mean();
        this.smoothedMinusDM = this.minusDMBuffer.mean();
      }
    }

    // Calculate DI values
    const { plusDI, minusDI, dx } = this.calculateDIAndDX(
      this.smoothedTR!,
      this.smoothedPlusDM!,
      this.smoothedMinusDM!
    );

    this.dxBuffer.push(dx);

    // Calculate ADX
    let adx: number;
    if (!this.adxWarmedUp) {
      if (this.dxBuffer.size() >= this.config.period) {
        // Initialize ADX with simple average
        this.smoothedADX = this.dxBuffer.mean();
        this.adxWarmedUp = true;
        adx = this.smoothedADX;
      } else {
        // Not enough DX values yet
        adx = dx; // Use current DX as ADX approximation
      }
    } else {
      // Update ADX using smoothing
      if (this.useWildersSmoothing) {
        this.smoothedADX = this.wildersSmoothing(this.smoothedADX!, dx);
      } else {
        this.smoothedADX = this.dxBuffer.mean();
      }
      adx = this.smoothedADX;
    }

    return {
      adx: Math.max(0, Math.min(100, adx)),
      plusDI: Math.max(0, Math.min(100, plusDI)),
      minusDI: Math.max(0, Math.min(100, minusDI)),
      dx: Math.max(0, Math.min(100, dx))
    };
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.highBuffer.clear();
    this.lowBuffer.clear();
    this.closeBuffer.clear();
    this.trBuffer.clear();
    this.plusDMBuffer.clear();
    this.minusDMBuffer.clear();
    this.dxBuffer.clear();
    
    this.smoothedTR = undefined;
    this.smoothedPlusDM = undefined;
    this.smoothedMinusDM = undefined;
    this.smoothedADX = undefined;
    this.isWarmedUp = false;
    this.adxWarmedUp = false;
  }

  /**
   * Validate ADX-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    // ADX requires at least period 2, commonly 14
    if (config.period < 2) {
      throw new Error('ADX period must be at least 2');
    }
  }

  /**
   * Get ADX-specific metadata
   */
  protected getResultMetadata(value: ADXResult, data: OHLCV[]): Record<string, any> {
    const trendStrength = this.analyzeTrendStrength(value.adx);
    const directionalBias = this.analyzeDirectionalBias(value.plusDI, value.minusDI);
    
    return {
      ...super.getResultMetadata(value, data),
      useWildersSmoothing: this.useWildersSmoothing,
      trendStrength,
      directionalBias,
      isWarmedUp: this.isWarmedUp,
      adxWarmedUp: this.adxWarmedUp,
      crossoverSignal: this.checkDICrossover()
    };
  }

  /**
   * Calculate True Range for current candle
   */
  private calculateTrueRange(): number {
    if (this.highBuffer.size() < 2 || this.lowBuffer.size() < 2 || this.closeBuffer.size() < 2) {
      return 0;
    }

    const currentHigh = this.highBuffer.latest()!;
    const currentLow = this.lowBuffer.latest()!;
    const previousClose = this.closeBuffer.get(1)!; // Second to last

    const tr1 = currentHigh - currentLow;
    const tr2 = Math.abs(currentHigh - previousClose);
    const tr3 = Math.abs(currentLow - previousClose);

    return Math.max(tr1, tr2, tr3);
  }

  /**
   * Calculate Directional Movement for current candle
   */
  private calculateDirectionalMovement(): { plusDM: number; minusDM: number } {
    if (this.highBuffer.size() < 2 || this.lowBuffer.size() < 2) {
      return { plusDM: 0, minusDM: 0 };
    }

    const currentHigh = this.highBuffer.latest()!;
    const currentLow = this.lowBuffer.latest()!;
    const previousHigh = this.highBuffer.get(1)!; // Second to last
    const previousLow = this.lowBuffer.get(1)!; // Second to last

    const upMove = currentHigh - previousHigh;
    const downMove = previousLow - currentLow;

    let plusDM = 0;
    let minusDM = 0;

    if (upMove > downMove && upMove > 0) {
      plusDM = upMove;
    } else if (downMove > upMove && downMove > 0) {
      minusDM = downMove;
    }

    return { plusDM, minusDM };
  }

  /**
   * Apply Wilder's smoothing
   */
  private wildersSmoothing(previousValue: number, currentValue: number): number {
    return (previousValue * (this.config.period - 1) + currentValue) / this.config.period;
  }

  /**
   * Calculate DI and DX values
   */
  private calculateDIAndDX(smoothedTR: number, smoothedPlusDM: number, smoothedMinusDM: number): {
    plusDI: number;
    minusDI: number;
    dx: number;
  } {
    if (smoothedTR === 0) {
      return { plusDI: 0, minusDI: 0, dx: 0 };
    }

    const plusDI = 100 * (smoothedPlusDM / smoothedTR);
    const minusDI = 100 * (smoothedMinusDM / smoothedTR);

    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / diSum;

    return { plusDI, minusDI, dx };
  }

  /**
   * Calculate ADX from data arrays
   */
  private calculateADXFromArrays(highs: number[], lows: number[], closes: number[]): ADXResult {
    if (highs.length < this.config.period + 1) {
      return this.createNeutralResult();
    }

    const trs: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];

    // Calculate TR and DM for each period
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      const tr = Math.max(tr1, tr2, tr3);

      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      let plusDM = 0;
      let minusDM = 0;

      if (upMove > downMove && upMove > 0) {
        plusDM = upMove;
      } else if (downMove > upMove && downMove > 0) {
        minusDM = downMove;
      }

      trs.push(tr);
      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    // Calculate smoothed values
    const smoothedTRs: number[] = [];
    const smoothedPlusDMs: number[] = [];
    const smoothedMinusDMs: number[] = [];

    // Initialize first smoothed values
    const firstSmoothedTR = trs.slice(0, this.config.period).reduce((sum, tr) => sum + tr, 0) / this.config.period;
    const firstSmoothedPlusDM = plusDMs.slice(0, this.config.period).reduce((sum, dm) => sum + dm, 0) / this.config.period;
    const firstSmoothedMinusDM = minusDMs.slice(0, this.config.period).reduce((sum, dm) => sum + dm, 0) / this.config.period;

    smoothedTRs.push(firstSmoothedTR);
    smoothedPlusDMs.push(firstSmoothedPlusDM);
    smoothedMinusDMs.push(firstSmoothedMinusDM);

    // Calculate subsequent smoothed values
    for (let i = this.config.period; i < trs.length; i++) {
      const smoothedTR = this.useWildersSmoothing ?
        (smoothedTRs[smoothedTRs.length - 1] * (this.config.period - 1) + trs[i]) / this.config.period :
        trs.slice(i - this.config.period + 1, i + 1).reduce((sum, tr) => sum + tr, 0) / this.config.period;

      const smoothedPlusDM = this.useWildersSmoothing ?
        (smoothedPlusDMs[smoothedPlusDMs.length - 1] * (this.config.period - 1) + plusDMs[i]) / this.config.period :
        plusDMs.slice(i - this.config.period + 1, i + 1).reduce((sum, dm) => sum + dm, 0) / this.config.period;

      const smoothedMinusDM = this.useWildersSmoothing ?
        (smoothedMinusDMs[smoothedMinusDMs.length - 1] * (this.config.period - 1) + minusDMs[i]) / this.config.period :
        minusDMs.slice(i - this.config.period + 1, i + 1).reduce((sum, dm) => sum + dm, 0) / this.config.period;

      smoothedTRs.push(smoothedTR);
      smoothedPlusDMs.push(smoothedPlusDM);
      smoothedMinusDMs.push(smoothedMinusDM);
    }

    // Calculate DX values
    const dxValues: number[] = [];
    for (let i = 0; i < smoothedTRs.length; i++) {
      const { plusDI, minusDI, dx } = this.calculateDIAndDX(
        smoothedTRs[i],
        smoothedPlusDMs[i],
        smoothedMinusDMs[i]
      );
      dxValues.push(dx);
    }

    // Calculate final ADX
    let adx: number;
    if (dxValues.length >= this.config.period) {
      // Initialize ADX with average of first period DX values
      let adxValue = dxValues.slice(0, this.config.period).reduce((sum, dx) => sum + dx, 0) / this.config.period;

      // Apply smoothing to remaining DX values
      for (let i = this.config.period; i < dxValues.length; i++) {
        adxValue = this.useWildersSmoothing ?
          (adxValue * (this.config.period - 1) + dxValues[i]) / this.config.period :
          dxValues.slice(i - this.config.period + 1, i + 1).reduce((sum, dx) => sum + dx, 0) / this.config.period;
      }

      adx = adxValue;
    } else {
      adx = dxValues[dxValues.length - 1] || 0;
    }

    // Calculate final DI values
    const finalSmoothedTR = smoothedTRs[smoothedTRs.length - 1];
    const finalSmoothedPlusDM = smoothedPlusDMs[smoothedPlusDMs.length - 1];
    const finalSmoothedMinusDM = smoothedMinusDMs[smoothedMinusDMs.length - 1];
    const { plusDI, minusDI, dx } = this.calculateDIAndDX(
      finalSmoothedTR,
      finalSmoothedPlusDM,
      finalSmoothedMinusDM
    );

    return {
      adx: Math.max(0, Math.min(100, adx)),
      plusDI: Math.max(0, Math.min(100, plusDI)),
      minusDI: Math.max(0, Math.min(100, minusDI)),
      dx: Math.max(0, Math.min(100, dx))
    };
  }

  /**
   * Create neutral result when insufficient data
   */
  private createNeutralResult(): ADXResult {
    return {
      adx: 0,
      plusDI: 0,
      minusDI: 0,
      dx: 0
    };
  }

  /**
   * Analyze trend strength based on ADX value
   */
  private analyzeTrendStrength(adxValue: number): {
    level: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong' | 'extreme';
    trending: boolean;
  } {
    let level: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong' | 'extreme' = 'very_weak';
    let trending = false;

    if (adxValue >= 75) {
      level = 'extreme';
      trending = true;
    } else if (adxValue >= 50) {
      level = 'very_strong';
      trending = true;
    } else if (adxValue >= 25) {
      level = 'strong';
      trending = true;
    } else if (adxValue >= 15) {
      level = 'moderate';
      trending = false;
    } else if (adxValue >= 10) {
      level = 'weak';
      trending = false;
    } else {
      level = 'very_weak';
      trending = false;
    }

    return { level, trending };
  }

  /**
   * Analyze directional bias based on DI values
   */
  private analyzeDirectionalBias(plusDI: number, minusDI: number): {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 0-1 scale
  } {
    const diSum = plusDI + minusDI;
    const diDiff = Math.abs(plusDI - minusDI);
    const strength = diSum > 0 ? diDiff / diSum : 0;

    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (plusDI > minusDI && diDiff > 5) {
      direction = 'bullish';
    } else if (minusDI > plusDI && diDiff > 5) {
      direction = 'bearish';
    }

    return { direction, strength };
  }

  /**
   * Check for DI crossovers
   */
  private checkDICrossover(): 'bullish' | 'bearish' | 'none' {
    const results = this.getResults(2);
    if (results.length < 2) {
      return 'none';
    }

    const current = results[1].value as ADXResult;
    const previous = results[0].value as ADXResult;

    // Bullish crossover: +DI crosses above -DI
    if (previous.plusDI <= previous.minusDI && current.plusDI > current.minusDI) {
      return 'bullish';
    }

    // Bearish crossover: -DI crosses above +DI
    if (previous.minusDI <= previous.plusDI && current.minusDI > current.plusDI) {
      return 'bearish';
    }

    return 'none';
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  /**
   * Check if ADX indicates a trending market
   */
  isTrending(): boolean {
    const latest = this.getLatestResult();
    return latest ? (latest.value as ADXResult).adx >= 25 : false;
  }

  /**
   * Check if market is in consolidation
   */
  isConsolidating(): boolean {
    const latest = this.getLatestResult();
    return latest ? (latest.value as ADXResult).adx < 25 : true;
  }

  /**
   * Get trend direction based on DI values
   */
  getTrendDirection(): 'bullish' | 'bearish' | 'neutral' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'neutral';
    }

    const { plusDI, minusDI } = latest.value as ADXResult;
    if (plusDI > minusDI) {
      return 'bullish';
    } else if (minusDI > plusDI) {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }

  /**
   * Get ADX trend strength level
   */
  getTrendStrength(): 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong' | 'extreme' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'very_weak';
    }

    const adxValue = (latest.value as ADXResult).adx;
    return this.analyzeTrendStrength(adxValue).level;
  }

  /**
   * Check if both DI lines are rising (strengthening trend)
   */
  isDIStrengthening(): boolean {
    const results = this.getResults(3);
    if (results.length < 3) {
      return false;
    }

    const values = results.map(r => r.value as ADXResult);
    const plusDITrend = values[2].plusDI > values[1].plusDI && values[1].plusDI > values[0].plusDI;
    const minusDITrend = values[2].minusDI > values[1].minusDI && values[1].minusDI > values[0].minusDI;

    return plusDITrend || minusDITrend;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latest = this.getLatestResult();
    if (!latest) {
      return `ADX(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const { adx, plusDI, minusDI } = latest.value as ADXResult;
    const strength = this.getTrendStrength();
    const direction = this.getTrendDirection();

    return `ADX(${this.config.period}) [${this.getStatus()}] ` +
           `ADX: ${adx.toFixed(2)} (+DI: ${plusDI.toFixed(2)}, -DI: ${minusDI.toFixed(2)}) ` +
           `Strength: ${strength}, Direction: ${direction}`;
  }
}