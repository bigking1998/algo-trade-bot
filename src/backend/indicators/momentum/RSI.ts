/**
 * RSI (Relative Strength Index) Indicator - Task BE-010
 * 
 * RSI is a momentum oscillator that measures the velocity and magnitude of price changes.
 * It oscillates between 0 and 100, typically using 14 periods.
 * 
 * Formula:
 * RS = Average Gain / Average Loss
 * RSI = 100 - (100 / (1 + RS))
 * 
 * Traditional levels:
 * - Overbought: 70+
 * - Oversold: 30-
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, IndicatorResult, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface RSIConfig extends IndicatorConfig {
  /** Price type to use for calculation */
  priceType?: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Overbought level (default: 70) */
  overboughtLevel?: number;
  /** Oversold level (default: 30) */
  oversoldLevel?: number;
  /** Use Wilder's smoothing method (default: true) */
  wildersSmoothing?: boolean;
}

/**
 * RSI implementation with streaming optimization using Wilder's smoothing
 */
export class RSI extends TechnicalIndicator<number> {
  private readonly priceType: string;
  private readonly overboughtLevel: number;
  private readonly oversoldLevel: number;
  private readonly useWildersSmoothing: boolean;

  // Buffers for streaming calculations
  private priceBuffer: NumericCircularBuffer;
  private gainBuffer: NumericCircularBuffer;
  private lossBuffer: NumericCircularBuffer;

  // Running averages for streaming updates
  private avgGain?: number;
  private avgLoss?: number;
  private previousPrice?: number;
  private isWarmedUp = false;

  constructor(config: RSIConfig) {
    super('RSI', config);
    
    this.priceType = config.priceType || 'close';
    this.overboughtLevel = config.overboughtLevel || 70;
    this.oversoldLevel = config.oversoldLevel || 30;
    this.useWildersSmoothing = config.wildersSmoothing !== false; // Default true

    // Initialize buffers
    this.priceBuffer = new NumericCircularBuffer(config.period + 1);
    this.gainBuffer = new NumericCircularBuffer(config.period);
    this.lossBuffer = new NumericCircularBuffer(config.period);
  }

  /**
   * Calculate RSI value for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length < 2) {
      return 50; // Neutral RSI when insufficient data
    }

    const prices = this.extractPrices(data);
    return this.calculateRSIFromPrices(prices);
  }

  /**
   * Optimized streaming update using running averages
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const newPrice = this.extractPrice(newCandle);
    this.priceBuffer.push(newPrice);

    // Need at least 2 prices to calculate gain/loss
    if (this.priceBuffer.size() < 2) {
      this.previousPrice = newPrice;
      return 50; // Neutral RSI
    }

    // Calculate price change
    const previousPrice = this.previousPrice || this.priceBuffer.get(1) || newPrice;
    const priceChange = newPrice - previousPrice;

    // Separate gains and losses
    const gain = priceChange > 0 ? priceChange : 0;
    const loss = priceChange < 0 ? Math.abs(priceChange) : 0;

    this.gainBuffer.push(gain);
    this.lossBuffer.push(loss);

    // Update running averages
    if (!this.isWarmedUp) {
      if (this.gainBuffer.size() >= this.config.period) {
        // Initialize with simple averages
        this.avgGain = this.gainBuffer.mean();
        this.avgLoss = this.lossBuffer.mean();
        this.isWarmedUp = true;
      } else {
        // Not enough data yet
        this.previousPrice = newPrice;
        return 50;
      }
    } else {
      // Update using Wilder's smoothing or simple moving average
      if (this.useWildersSmoothing) {
        // Wilder's smoothing: (previous average * (period - 1) + current value) / period
        this.avgGain = ((this.avgGain || 0) * (this.config.period - 1) + gain) / this.config.period;
        this.avgLoss = ((this.avgLoss || 0) * (this.config.period - 1) + loss) / this.config.period;
      } else {
        // Simple moving average
        this.avgGain = this.gainBuffer.mean();
        this.avgLoss = this.lossBuffer.mean();
      }
    }

    this.previousPrice = newPrice;

    // Calculate RSI
    return this.calculateRSIFromAverages(this.avgGain || 0, this.avgLoss || 0);
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.priceBuffer.clear();
    this.gainBuffer.clear();
    this.lossBuffer.clear();
    this.avgGain = undefined;
    this.avgLoss = undefined;
    this.previousPrice = undefined;
    this.isWarmedUp = false;
  }

  /**
   * Validate RSI-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const rsiConfig = config as RSIConfig;
    
    if (rsiConfig.priceType && !this.isValidPriceType(rsiConfig.priceType)) {
      throw new Error(
        `Invalid price type: ${rsiConfig.priceType}. ` +
        'Valid types: open, high, low, close, hl2, hlc3, ohlc4'
      );
    }

    if (rsiConfig.overboughtLevel !== undefined) {
      if (rsiConfig.overboughtLevel < 50 || rsiConfig.overboughtLevel > 100) {
        throw new Error('Overbought level must be between 50 and 100');
      }
    }

    if (rsiConfig.oversoldLevel !== undefined) {
      if (rsiConfig.oversoldLevel < 0 || rsiConfig.oversoldLevel > 50) {
        throw new Error('Oversold level must be between 0 and 50');
      }
    }

    if (rsiConfig.overboughtLevel !== undefined && rsiConfig.oversoldLevel !== undefined) {
      if (rsiConfig.oversoldLevel >= rsiConfig.overboughtLevel) {
        throw new Error('Oversold level must be less than overbought level');
      }
    }
  }

  /**
   * Get RSI-specific metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      priceType: this.priceType,
      overboughtLevel: this.overboughtLevel,
      oversoldLevel: this.oversoldLevel,
      useWildersSmoothing: this.useWildersSmoothing,
      avgGain: this.avgGain,
      avgLoss: this.avgLoss,
      isOverbought: value >= this.overboughtLevel,
      isOversold: value <= this.oversoldLevel,
      momentum: this.analyzeMomentum(value),
      divergenceSignal: this.checkForDivergenceSetup(data)
    };
  }

  /**
   * Calculate RSI from price array
   */
  private calculateRSIFromPrices(prices: number[]): number {
    if (prices.length < this.config.period + 1) {
      return 50;
    }

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate gains and losses
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Use the most recent period for calculation
    const recentGains = gains.slice(-this.config.period);
    const recentLosses = losses.slice(-this.config.period);

    // Calculate average gain and loss
    let avgGain: number;
    let avgLoss: number;

    if (this.useWildersSmoothing && gains.length >= this.config.period) {
      // Use Wilder's smoothing for the entire series
      avgGain = recentGains[0];
      avgLoss = recentLosses[0];

      for (let i = 1; i < recentGains.length; i++) {
        avgGain = (avgGain * (this.config.period - 1) + recentGains[i]) / this.config.period;
        avgLoss = (avgLoss * (this.config.period - 1) + recentLosses[i]) / this.config.period;
      }
    } else {
      // Simple moving average
      avgGain = recentGains.reduce((sum, gain) => sum + gain, 0) / recentGains.length;
      avgLoss = recentLosses.reduce((sum, loss) => sum + loss, 0) / recentLosses.length;
    }

    return this.calculateRSIFromAverages(avgGain, avgLoss);
  }

  /**
   * Calculate RSI from average gain and loss
   */
  private calculateRSIFromAverages(avgGain: number, avgLoss: number): number {
    if (avgLoss === 0) {
      return avgGain > 0 ? 100 : 50;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Ensure RSI is within bounds
    return Math.max(0, Math.min(100, rsi));
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
   * Analyze momentum based on RSI value and trend
   */
  private analyzeMomentum(rsiValue: number): {
    strength: 'weak' | 'moderate' | 'strong';
    direction: 'bullish' | 'bearish' | 'neutral';
  } {
    // Determine strength based on distance from midline (50)
    const distanceFromMidline = Math.abs(rsiValue - 50);
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    
    if (distanceFromMidline > 30) {
      strength = 'strong';
    } else if (distanceFromMidline > 15) {
      strength = 'moderate';
    }

    // Determine direction
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (rsiValue > 55) {
      direction = 'bullish';
    } else if (rsiValue < 45) {
      direction = 'bearish';
    }

    return { strength, direction };
  }

  /**
   * Check for potential divergence setup
   */
  private checkForDivergenceSetup(data: OHLCV[]): string {
    const results = this.getResults(5);
    if (results.length < 5) {
      return 'insufficient_data';
    }

    const rsiValues = results.map(r => r.value as number);
    const prices = this.extractPrices(data.slice(-5));

    // Simple divergence check
    const rsiTrend = rsiValues[rsiValues.length - 1] - rsiValues[0];
    const priceTrend = prices[prices.length - 1] - prices[0];

    if (rsiTrend > 0 && priceTrend < 0) {
      return 'bullish_divergence_setup';
    } else if (rsiTrend < 0 && priceTrend > 0) {
      return 'bearish_divergence_setup';
    }

    return 'no_divergence';
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  /**
   * Check if RSI is in overbought territory
   */
  isOverbought(): boolean {
    const latest = this.getLatestResult();
    return latest ? (latest.value as number) >= this.overboughtLevel : false;
  }

  /**
   * Check if RSI is in oversold territory
   */
  isOversold(): boolean {
    const latest = this.getLatestResult();
    return latest ? (latest.value as number) <= this.oversoldLevel : false;
  }

  /**
   * Get current RSI level classification
   */
  getRSILevel(): 'extreme_overbought' | 'overbought' | 'neutral' | 'oversold' | 'extreme_oversold' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'neutral';
    }

    const rsi = latest.value as number;
    
    if (rsi >= 80) {
      return 'extreme_overbought';
    } else if (rsi >= this.overboughtLevel) {
      return 'overbought';
    } else if (rsi <= 20) {
      return 'extreme_oversold';
    } else if (rsi <= this.oversoldLevel) {
      return 'oversold';
    } else {
      return 'neutral';
    }
  }

  /**
   * Get RSI trend direction
   */
  getTrend(lookback: number = 3): 'rising' | 'falling' | 'sideways' {
    const results = this.getResults(lookback);
    if (results.length < 2) {
      return 'sideways';
    }

    let risingCount = 0;
    let fallingCount = 0;

    for (let i = 1; i < results.length; i++) {
      const current = results[i].value as number;
      const previous = results[i - 1].value as number;
      
      if (current > previous) {
        risingCount++;
      } else if (current < previous) {
        fallingCount++;
      }
    }

    if (risingCount > fallingCount) {
      return 'rising';
    } else if (fallingCount > risingCount) {
      return 'falling';
    } else {
      return 'sideways';
    }
  }

  /**
   * Calculate RSI momentum (rate of change)
   */
  getRSIMomentum(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length <= periods) {
      return 0;
    }

    const current = results[results.length - 1].value as number;
    const previous = results[results.length - 1 - periods].value as number;
    
    return current - previous;
  }

  /**
   * Check for RSI bullish/bearish crossovers of midline (50)
   */
  checkMidlineCrossover(): 'bullish' | 'bearish' | 'none' {
    const results = this.getResults(2);
    if (results.length < 2) {
      return 'none';
    }

    const current = results[1].value as number;
    const previous = results[0].value as number;

    if (previous <= 50 && current > 50) {
      return 'bullish';
    } else if (previous >= 50 && current < 50) {
      return 'bearish';
    }

    return 'none';
  }

  /**
   * Check for RSI level crossovers (overbought/oversold)
   */
  checkLevelCrossover(): {
    overboughtEntry: boolean;
    overboughtExit: boolean;
    oversoldEntry: boolean;
    oversoldExit: boolean;
  } {
    const results = this.getResults(2);
    if (results.length < 2) {
      return {
        overboughtEntry: false,
        overboughtExit: false,
        oversoldEntry: false,
        oversoldExit: false
      };
    }

    const current = results[1].value as number;
    const previous = results[0].value as number;

    return {
      overboughtEntry: previous < this.overboughtLevel && current >= this.overboughtLevel,
      overboughtExit: previous >= this.overboughtLevel && current < this.overboughtLevel,
      oversoldEntry: previous > this.oversoldLevel && current <= this.oversoldLevel,
      oversoldExit: previous <= this.oversoldLevel && current > this.oversoldLevel
    };
  }

  /**
   * Calculate RSI normalization (distance from extremes)
   */
  getNormalizedRSI(): number {
    const latest = this.getLatestResult();
    if (!latest) {
      return 0;
    }

    const rsi = latest.value as number;
    
    // Normalize to -1 (oversold) to +1 (overbought)
    return (rsi - 50) / 50;
  }

  /**
   * Get average gain and loss for debugging
   */
  getAverages(): { avgGain?: number; avgLoss?: number; } {
    return {
      avgGain: this.avgGain,
      avgLoss: this.avgLoss
    };
  }

  /**
   * Check if RSI is warmed up (has enough data for stable calculation)
   */
  isRSIWarmedUp(): boolean {
    return this.isWarmedUp;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latest = this.getLatestResult();
    const rsi = latest ? (latest.value as number).toFixed(2) : 'N/A';
    const level = latest ? this.getRSILevel() : 'unknown';
    
    return `RSI(${this.config.period}) [${this.getStatus()}] ` +
           `Value: ${rsi} (${level})`;
  }
}