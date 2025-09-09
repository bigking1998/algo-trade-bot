/**
 * AROON (Aroon Up/Down) Indicator - Task BE-011
 * 
 * AROON identifies trend changes and measures the strength of trends by 
 * calculating the time since the highest high and lowest low within a lookback period.
 * 
 * Formula:
 * - Aroon Up = ((period - periods since highest high) / period) * 100
 * - Aroon Down = ((period - periods since lowest low) / period) * 100
 * - Aroon Oscillator = Aroon Up - Aroon Down
 * 
 * Interpretation:
 * - Aroon Up > 70: Strong uptrend
 * - Aroon Down > 70: Strong downtrend
 * - Aroon Up/Down between 30-70: Weak trend or consolidation
 * - Aroon Up > Aroon Down: Bullish bias
 * - Aroon Down > Aroon Up: Bearish bias
 * - Oscillator > 0: Bullish, < 0: Bearish
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface AROONConfig extends IndicatorConfig {
  /** Strong trend threshold (default: 70) */
  strongTrendThreshold?: number;
  /** Weak trend threshold (default: 30) */
  weakTrendThreshold?: number;
}

export interface AROONResult {
  /** Aroon Up value (0-100) */
  aroonUp: number;
  /** Aroon Down value (0-100) */
  aroonDown: number;
  /** Aroon Oscillator (Up - Down) */
  oscillator: number;
}

/**
 * AROON implementation with streaming optimization
 */
export class AROON extends TechnicalIndicator<AROONResult> {
  private readonly strongTrendThreshold: number;
  private readonly weakTrendThreshold: number;

  // Buffers for streaming calculations
  private highBuffer: NumericCircularBuffer;
  private lowBuffer: NumericCircularBuffer;
  private timestampBuffer: NumericCircularBuffer; // For tracking periods

  constructor(config: AROONConfig) {
    super('AROON', config);
    
    this.strongTrendThreshold = config.strongTrendThreshold || 70;
    this.weakTrendThreshold = config.weakTrendThreshold || 30;

    // Initialize buffers
    const bufferSize = config.period + 1;
    this.highBuffer = new NumericCircularBuffer(bufferSize);
    this.lowBuffer = new NumericCircularBuffer(bufferSize);
    this.timestampBuffer = new NumericCircularBuffer(bufferSize);
  }

  /**
   * Calculate AROON values for given data
   */
  protected calculateValue(data: OHLCV[]): AROONResult {
    if (data.length < this.config.period + 1) {
      return this.createNeutralResult();
    }

    return this.calculateAROONFromData(data);
  }

  /**
   * Optimized streaming update
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): AROONResult {
    // Add new data to buffers
    this.highBuffer.push(newCandle.high);
    this.lowBuffer.push(newCandle.low);
    this.timestampBuffer.push(Date.now()); // Use timestamp for period tracking

    // Need at least period + 1 data points
    if (this.highBuffer.size() <= this.config.period) {
      return this.createNeutralResult();
    }

    // Find highest high and lowest low positions within the period
    const highs = this.highBuffer.getWindow(this.config.period + 1);
    const lows = this.lowBuffer.getWindow(this.config.period + 1);

    return this.calculateAROONFromArrays(highs, lows);
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.highBuffer.clear();
    this.lowBuffer.clear();
    this.timestampBuffer.clear();
  }

  /**
   * Validate AROON-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const aroonConfig = config as AROONConfig;
    
    if (aroonConfig.strongTrendThreshold !== undefined) {
      if (aroonConfig.strongTrendThreshold < 50 || aroonConfig.strongTrendThreshold > 100) {
        throw new Error('Strong trend threshold must be between 50 and 100');
      }
    }

    if (aroonConfig.weakTrendThreshold !== undefined) {
      if (aroonConfig.weakTrendThreshold < 0 || aroonConfig.weakTrendThreshold > 50) {
        throw new Error('Weak trend threshold must be between 0 and 50');
      }
    }

    if (aroonConfig.strongTrendThreshold !== undefined && aroonConfig.weakTrendThreshold !== undefined) {
      if (aroonConfig.weakTrendThreshold >= aroonConfig.strongTrendThreshold) {
        throw new Error('Weak trend threshold must be less than strong trend threshold');
      }
    }

    // AROON needs at least 2 periods for meaningful calculation
    if (config.period < 2) {
      throw new Error('AROON period must be at least 2');
    }
  }

  /**
   * Get AROON-specific metadata
   */
  protected getResultMetadata(value: AROONResult, data: OHLCV[]): Record<string, any> {
    const trendAnalysis = this.analyzeTrend(value);
    const strengthAnalysis = this.analyzeTrendStrength(value);
    
    return {
      ...super.getResultMetadata(value, data),
      strongTrendThreshold: this.strongTrendThreshold,
      weakTrendThreshold: this.weakTrendThreshold,
      trendDirection: trendAnalysis.direction,
      trendStrength: trendAnalysis.strength,
      isTrending: strengthAnalysis.isTrending,
      consolidation: strengthAnalysis.consolidation,
      crossoverSignal: this.checkCrossoverSignal()
    };
  }

  /**
   * Calculate AROON from historical data
   */
  private calculateAROONFromData(data: OHLCV[]): AROONResult {
    if (data.length <= this.config.period) {
      return this.createNeutralResult();
    }

    // Get the most recent period + 1 data points
    const recentData = data.slice(-this.config.period - 1);
    const highs = recentData.map(candle => candle.high);
    const lows = recentData.map(candle => candle.low);

    return this.calculateAROONFromArrays(highs, lows);
  }

  /**
   * Calculate AROON from high and low arrays
   */
  private calculateAROONFromArrays(highs: number[], lows: number[]): AROONResult {
    if (highs.length <= this.config.period || lows.length <= this.config.period) {
      return this.createNeutralResult();
    }

    // Find periods since highest high and lowest low
    const periodsSinceHighestHigh = this.findPeriodsSinceExtreme(highs, 'high');
    const periodsSinceLowestLow = this.findPeriodsSinceExtreme(lows, 'low');

    // Calculate Aroon Up and Down
    const aroonUp = ((this.config.period - periodsSinceHighestHigh) / this.config.period) * 100;
    const aroonDown = ((this.config.period - periodsSinceLowestLow) / this.config.period) * 100;

    // Calculate Aroon Oscillator
    const oscillator = aroonUp - aroonDown;

    return {
      aroonUp: Math.max(0, Math.min(100, aroonUp)),
      aroonDown: Math.max(0, Math.min(100, aroonDown)),
      oscillator: Math.max(-100, Math.min(100, oscillator))
    };
  }

  /**
   * Find periods since highest high or lowest low
   */
  private findPeriodsSinceExtreme(values: number[], type: 'high' | 'low'): number {
    if (values.length === 0) {
      return this.config.period;
    }

    // Look at the last 'period' values (excluding the current one for position counting)
    const lookbackValues = values.slice(-this.config.period - 1, -1);
    
    if (lookbackValues.length === 0) {
      return this.config.period;
    }

    let extremeIndex = 0;
    let extremeValue = lookbackValues[0];

    // Find the index of the extreme value
    for (let i = 1; i < lookbackValues.length; i++) {
      if (type === 'high') {
        if (lookbackValues[i] > extremeValue) {
          extremeValue = lookbackValues[i];
          extremeIndex = i;
        }
      } else {
        if (lookbackValues[i] < extremeValue) {
          extremeValue = lookbackValues[i];
          extremeIndex = i;
        }
      }
    }

    // Calculate periods since the extreme (0 = current period, 1 = one period ago, etc.)
    return lookbackValues.length - 1 - extremeIndex;
  }

  /**
   * Create neutral result when insufficient data
   */
  private createNeutralResult(): AROONResult {
    return {
      aroonUp: 50,
      aroonDown: 50,
      oscillator: 0
    };
  }

  /**
   * Analyze trend based on AROON values
   */
  private analyzeTrend(value: AROONResult): {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
  } {
    const { aroonUp, aroonDown, oscillator } = value;

    // Determine direction based on oscillator and individual values
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (oscillator > 0 && aroonUp > aroonDown) {
      direction = 'bullish';
    } else if (oscillator < 0 && aroonDown > aroonUp) {
      direction = 'bearish';
    }

    // Determine strength based on the higher of the two values
    const higherAroon = Math.max(aroonUp, aroonDown);
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    
    if (higherAroon >= this.strongTrendThreshold) {
      strength = 'strong';
    } else if (higherAroon > this.weakTrendThreshold) {
      strength = 'moderate';
    }

    return { direction, strength };
  }

  /**
   * Analyze trend strength and consolidation
   */
  private analyzeTrendStrength(value: AROONResult): {
    isTrending: boolean;
    consolidation: boolean;
    trendType: 'uptrend' | 'downtrend' | 'sideways';
  } {
    const { aroonUp, aroonDown } = value;

    // Strong trend indicators
    const strongUptrend = aroonUp >= this.strongTrendThreshold && aroonDown <= this.weakTrendThreshold;
    const strongDowntrend = aroonDown >= this.strongTrendThreshold && aroonUp <= this.weakTrendThreshold;
    const isTrending = strongUptrend || strongDowntrend;

    // Consolidation when both are low or both are high
    const bothLow = aroonUp <= this.weakTrendThreshold && aroonDown <= this.weakTrendThreshold;
    const bothHigh = aroonUp >= this.strongTrendThreshold && aroonDown >= this.strongTrendThreshold;
    const consolidation = bothLow || bothHigh;

    // Trend type
    let trendType: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    if (strongUptrend) {
      trendType = 'uptrend';
    } else if (strongDowntrend) {
      trendType = 'downtrend';
    }

    return { isTrending, consolidation, trendType };
  }

  /**
   * Check for crossover signals
   */
  private checkCrossoverSignal(): 'bullish' | 'bearish' | 'none' {
    const results = this.getResults(2);
    if (results.length < 2) {
      return 'none';
    }

    const current = results[1].value as AROONResult;
    const previous = results[0].value as AROONResult;

    // Bullish crossover: Aroon Up crosses above Aroon Down
    if (previous.aroonUp <= previous.aroonDown && current.aroonUp > current.aroonDown) {
      return 'bullish';
    }

    // Bearish crossover: Aroon Down crosses above Aroon Up
    if (previous.aroonDown <= previous.aroonUp && current.aroonDown > current.aroonUp) {
      return 'bearish';
    }

    return 'none';
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  /**
   * Check if AROON indicates strong uptrend
   */
  isStrongUptrend(): boolean {
    const latest = this.getLatestResult();
    if (!latest) {
      return false;
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;
    return aroonUp >= this.strongTrendThreshold && aroonDown <= this.weakTrendThreshold;
  }

  /**
   * Check if AROON indicates strong downtrend
   */
  isStrongDowntrend(): boolean {
    const latest = this.getLatestResult();
    if (!latest) {
      return false;
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;
    return aroonDown >= this.strongTrendThreshold && aroonUp <= this.weakTrendThreshold;
  }

  /**
   * Check if market is in consolidation
   */
  isConsolidating(): boolean {
    const latest = this.getLatestResult();
    if (!latest) {
      return true;
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;
    
    // Both low (no clear trend) or both high (recent highs and lows)
    const bothLow = aroonUp <= this.weakTrendThreshold && aroonDown <= this.weakTrendThreshold;
    const bothHigh = aroonUp >= this.strongTrendThreshold && aroonDown >= this.strongTrendThreshold;
    
    return bothLow || bothHigh;
  }

  /**
   * Get dominant AROON direction
   */
  getDominantDirection(): 'up' | 'down' | 'balanced' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'balanced';
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;
    const difference = Math.abs(aroonUp - aroonDown);
    
    if (difference < 10) { // Small threshold for balanced condition
      return 'balanced';
    }
    
    return aroonUp > aroonDown ? 'up' : 'down';
  }

  /**
   * Get trend strength level
   */
  getTrendStrength(): 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'very_weak';
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;
    const maxAroon = Math.max(aroonUp, aroonDown);
    const minAroon = Math.min(aroonUp, aroonDown);
    const spread = maxAroon - minAroon;

    if (maxAroon >= 90 && spread >= 50) {
      return 'very_strong';
    } else if (maxAroon >= this.strongTrendThreshold && spread >= 30) {
      return 'strong';
    } else if (maxAroon >= 50 && spread >= 15) {
      return 'moderate';
    } else if (maxAroon >= this.weakTrendThreshold) {
      return 'weak';
    } else {
      return 'very_weak';
    }
  }

  /**
   * Check for AROON extremes (potential reversal zones)
   */
  checkAroonExtremes(): {
    aroonUpExtreme: 'high' | 'low' | 'normal';
    aroonDownExtreme: 'high' | 'low' | 'normal';
    reversalPotential: 'high' | 'moderate' | 'low';
  } {
    const latest = this.getLatestResult();
    if (!latest) {
      return {
        aroonUpExtreme: 'normal',
        aroonDownExtreme: 'normal',
        reversalPotential: 'low'
      };
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;

    // Check for extreme values
    let aroonUpExtreme: 'high' | 'low' | 'normal' = 'normal';
    if (aroonUp >= 90) {
      aroonUpExtreme = 'high';
    } else if (aroonUp <= 10) {
      aroonUpExtreme = 'low';
    }

    let aroonDownExtreme: 'high' | 'low' | 'normal' = 'normal';
    if (aroonDown >= 90) {
      aroonDownExtreme = 'high';
    } else if (aroonDown <= 10) {
      aroonDownExtreme = 'low';
    }

    // Assess reversal potential
    let reversalPotential: 'high' | 'moderate' | 'low' = 'low';
    
    // High reversal potential when one is extremely high and other is low
    if ((aroonUpExtreme === 'high' && aroonDown <= 20) || 
        (aroonDownExtreme === 'high' && aroonUp <= 20)) {
      reversalPotential = 'high';
    } else if ((aroonUp >= 80 && aroonDown <= 30) || 
               (aroonDown >= 80 && aroonUp <= 30)) {
      reversalPotential = 'moderate';
    }

    return { aroonUpExtreme, aroonDownExtreme, reversalPotential };
  }

  /**
   * Get AROON trend duration estimate
   */
  getTrendDurationSignal(): {
    upTrendFreshness: 'fresh' | 'mature' | 'old';
    downTrendFreshness: 'fresh' | 'mature' | 'old';
  } {
    const latest = this.getLatestResult();
    if (!latest) {
      return { upTrendFreshness: 'old', downTrendFreshness: 'old' };
    }

    const { aroonUp, aroonDown } = latest.value as AROONResult;

    // Fresh trend: High AROON value (recent extreme)
    // Mature trend: Moderate AROON value
    // Old trend: Low AROON value (extreme was long ago)

    let upTrendFreshness: 'fresh' | 'mature' | 'old' = 'old';
    if (aroonUp >= 80) {
      upTrendFreshness = 'fresh';
    } else if (aroonUp >= 50) {
      upTrendFreshness = 'mature';
    }

    let downTrendFreshness: 'fresh' | 'mature' | 'old' = 'old';
    if (aroonDown >= 80) {
      downTrendFreshness = 'fresh';
    } else if (aroonDown >= 50) {
      downTrendFreshness = 'mature';
    }

    return { upTrendFreshness, downTrendFreshness };
  }

  /**
   * Get AROON oscillator momentum
   */
  getOscillatorMomentum(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length <= periods) {
      return 0;
    }

    const current = (results[results.length - 1].value as AROONResult).oscillator;
    const previous = (results[results.length - 1 - periods].value as AROONResult).oscillator;
    
    return current - previous;
  }

  /**
   * Check for parallel movement (both AROON lines moving in same direction)
   */
  checkParallelMovement(): 'both_rising' | 'both_falling' | 'diverging' | 'converging' {
    const results = this.getResults(2);
    if (results.length < 2) {
      return 'diverging';
    }

    const current = results[1].value as AROONResult;
    const previous = results[0].value as AROONResult;

    const upChange = current.aroonUp - previous.aroonUp;
    const downChange = current.aroonDown - previous.aroonDown;

    if (upChange > 0 && downChange > 0) {
      return 'both_rising';
    } else if (upChange < 0 && downChange < 0) {
      return 'both_falling';
    } else if ((upChange > 0 && downChange < 0) || (upChange < 0 && downChange > 0)) {
      // Lines moving in opposite directions
      const currentSpread = Math.abs(current.aroonUp - current.aroonDown);
      const previousSpread = Math.abs(previous.aroonUp - previous.aroonDown);
      
      return currentSpread > previousSpread ? 'diverging' : 'converging';
    }

    return 'converging';
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latest = this.getLatestResult();
    if (!latest) {
      return `AROON(${this.config.period}) [${this.getStatus()}] Value: N/A`;
    }

    const { aroonUp, aroonDown, oscillator } = latest.value as AROONResult;
    const direction = this.getDominantDirection();
    const strength = this.getTrendStrength();

    return `AROON(${this.config.period}) [${this.getStatus()}] ` +
           `Up: ${aroonUp.toFixed(1)}, Down: ${aroonDown.toFixed(1)}, ` +
           `Oscillator: ${oscillator.toFixed(1)} (${direction} ${strength})`;
  }
}