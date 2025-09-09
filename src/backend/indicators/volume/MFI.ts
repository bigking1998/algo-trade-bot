/**
 * MFI (Money Flow Index) Indicator - Task BE-011
 * 
 * MFI is a volume-weighted RSI that incorporates both price and volume to 
 * identify overbought and oversold conditions. Often called the "volume RSI".
 * 
 * Formula:
 * 1. Calculate Typical Price = (High + Low + Close) / 3
 * 2. Calculate Raw Money Flow = Typical Price × Volume
 * 3. Identify positive/negative money flow based on price direction
 * 4. Calculate Money Flow Ratio = Positive Money Flow / Negative Money Flow
 * 5. MFI = 100 - (100 / (1 + Money Flow Ratio))
 * 
 * Interpretation:
 * - MFI > 80: Overbought condition
 * - MFI < 20: Oversold condition
 * - MFI 40-60: Neutral zone
 * - Divergences with price indicate potential reversals
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { NumericCircularBuffer } from '../base/CircularBuffer.js';
import { mathUtils } from '../base/MathUtils.js';

export interface MFIConfig extends IndicatorConfig {
  /** Overbought level (default: 80) */
  overboughtLevel?: number;
  /** Oversold level (default: 20) */
  oversoldLevel?: number;
  /** Use typical price (default: true) or close price */
  useTypicalPrice?: boolean;
}

/**
 * MFI implementation with streaming optimization
 */
export class MFI extends TechnicalIndicator<number> {
  private readonly overboughtLevel: number;
  private readonly oversoldLevel: number;
  private readonly useTypicalPrice: boolean;

  // Buffers for streaming calculations
  private typicalPriceBuffer: NumericCircularBuffer;
  private volumeBuffer: NumericCircularBuffer;
  private rawMoneyFlowBuffer: NumericCircularBuffer;
  private positiveMoneyFlowBuffer: NumericCircularBuffer;
  private negativeMoneyFlowBuffer: NumericCircularBuffer;

  // Previous values for comparison
  private previousTypicalPrice?: number;
  private isWarmedUp = false;

  constructor(config: MFIConfig) {
    super('MFI', config);
    
    this.overboughtLevel = config.overboughtLevel || 80;
    this.oversoldLevel = config.oversoldLevel || 20;
    this.useTypicalPrice = config.useTypicalPrice !== false; // Default true

    // Initialize buffers
    const bufferSize = config.period + 1;
    this.typicalPriceBuffer = new NumericCircularBuffer(bufferSize);
    this.volumeBuffer = new NumericCircularBuffer(bufferSize);
    this.rawMoneyFlowBuffer = new NumericCircularBuffer(bufferSize);
    this.positiveMoneyFlowBuffer = new NumericCircularBuffer(config.period);
    this.negativeMoneyFlowBuffer = new NumericCircularBuffer(config.period);
  }

  /**
   * Calculate MFI value for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length < this.config.period + 1) {
      return 50; // Neutral MFI when insufficient data
    }

    return this.calculateMFIFromData(data);
  }

  /**
   * Optimized streaming update
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const typicalPrice = this.useTypicalPrice ? 
      this.calculateTypicalPrice(newCandle) : 
      newCandle.close;
    
    const volume = newCandle.volume || 0;
    const rawMoneyFlow = typicalPrice * volume;

    // Add to buffers
    this.typicalPriceBuffer.push(typicalPrice);
    this.volumeBuffer.push(volume);
    this.rawMoneyFlowBuffer.push(rawMoneyFlow);

    // Need at least 2 data points to determine flow direction
    if (this.typicalPriceBuffer.size() < 2) {
      this.previousTypicalPrice = typicalPrice;
      return 50; // Neutral MFI
    }

    // Determine if money flow is positive or negative
    const previousPrice = this.previousTypicalPrice || 0;
    let positiveFlow = 0;
    let negativeFlow = 0;

    if (typicalPrice > previousPrice) {
      positiveFlow = rawMoneyFlow;
    } else if (typicalPrice < previousPrice) {
      negativeFlow = rawMoneyFlow;
    }
    // If prices are equal, no flow is recorded

    this.positiveMoneyFlowBuffer.push(positiveFlow);
    this.negativeMoneyFlowBuffer.push(negativeFlow);

    // Need enough data for calculation
    if (this.positiveMoneyFlowBuffer.size() < this.config.period) {
      this.previousTypicalPrice = typicalPrice;
      return 50;
    }

    // Calculate MFI
    const totalPositiveFlow = this.positiveMoneyFlowBuffer.sum();
    const totalNegativeFlow = this.negativeMoneyFlowBuffer.sum();

    this.previousTypicalPrice = typicalPrice;
    this.isWarmedUp = true;

    return this.calculateMFIFromFlows(totalPositiveFlow, totalNegativeFlow);
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    super.reset();
    this.typicalPriceBuffer.clear();
    this.volumeBuffer.clear();
    this.rawMoneyFlowBuffer.clear();
    this.positiveMoneyFlowBuffer.clear();
    this.negativeMoneyFlowBuffer.clear();
    this.previousTypicalPrice = undefined;
    this.isWarmedUp = false;
  }

  /**
   * Validate MFI-specific configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const mfiConfig = config as MFIConfig;
    
    if (mfiConfig.overboughtLevel !== undefined) {
      if (mfiConfig.overboughtLevel < 50 || mfiConfig.overboughtLevel > 100) {
        throw new Error('Overbought level must be between 50 and 100');
      }
    }

    if (mfiConfig.oversoldLevel !== undefined) {
      if (mfiConfig.oversoldLevel < 0 || mfiConfig.oversoldLevel > 50) {
        throw new Error('Oversold level must be between 0 and 50');
      }
    }

    if (mfiConfig.overboughtLevel !== undefined && mfiConfig.oversoldLevel !== undefined) {
      if (mfiConfig.oversoldLevel >= mfiConfig.overboughtLevel) {
        throw new Error('Oversold level must be less than overbought level');
      }
    }
  }

  /**
   * Get MFI-specific metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      overboughtLevel: this.overboughtLevel,
      oversoldLevel: this.oversoldLevel,
      useTypicalPrice: this.useTypicalPrice,
      isOverbought: value >= this.overboughtLevel,
      isOversold: value <= this.oversoldLevel,
      isWarmedUp: this.isWarmedUp,
      volumeStrength: this.analyzeVolumeStrength(),
      moneyFlowPressure: this.analyzeMoneyFlowPressure(value),
      divergenceSignal: this.checkForDivergenceSetup(data)
    };
  }

  /**
   * Calculate MFI from historical data
   */
  private calculateMFIFromData(data: OHLCV[]): number {
    if (data.length < this.config.period + 1) {
      return 50;
    }

    const typicalPrices = data.map(candle => 
      this.useTypicalPrice ? this.calculateTypicalPrice(candle) : candle.close
    );
    const volumes = data.map(candle => candle.volume || 0);

    let totalPositiveFlow = 0;
    let totalNegativeFlow = 0;

    // Calculate money flows for the most recent period
    const startIndex = data.length - this.config.period - 1;
    for (let i = startIndex + 1; i < data.length; i++) {
      const currentPrice = typicalPrices[i];
      const previousPrice = typicalPrices[i - 1];
      const volume = volumes[i];
      const rawMoneyFlow = currentPrice * volume;

      if (currentPrice > previousPrice) {
        totalPositiveFlow += rawMoneyFlow;
      } else if (currentPrice < previousPrice) {
        totalNegativeFlow += rawMoneyFlow;
      }
    }

    return this.calculateMFIFromFlows(totalPositiveFlow, totalNegativeFlow);
  }

  /**
   * Calculate MFI from money flows
   */
  private calculateMFIFromFlows(positiveFlow: number, negativeFlow: number): number {
    if (negativeFlow === 0) {
      return positiveFlow > 0 ? 100 : 50;
    }

    if (positiveFlow === 0) {
      return 0;
    }

    const moneyFlowRatio = positiveFlow / negativeFlow;
    const mfi = 100 - (100 / (1 + moneyFlowRatio));

    // Ensure MFI is within bounds
    return Math.max(0, Math.min(100, mfi));
  }

  /**
   * Calculate typical price
   */
  private calculateTypicalPrice(candle: OHLCV): number {
    return (candle.high + candle.low + candle.close) / 3;
  }

  /**
   * Analyze volume strength based on recent patterns
   */
  private analyzeVolumeStrength(): {
    level: 'low' | 'moderate' | 'high' | 'very_high';
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (!this.isWarmedUp || this.volumeBuffer.size() < 3) {
      return { level: 'low', trend: 'stable' };
    }

    const recentVolumes = this.volumeBuffer.getWindow(3);
    const avgVolume = this.volumeBuffer.mean();
    const currentVolume = this.volumeBuffer.latest() || 0;

    // Determine level
    let level: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;
    
    if (volumeRatio >= 2.0) {
      level = 'very_high';
    } else if (volumeRatio >= 1.5) {
      level = 'high';
    } else if (volumeRatio >= 0.8) {
      level = 'moderate';
    }

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentVolumes.length >= 3) {
      const first = recentVolumes[0];
      const last = recentVolumes[recentVolumes.length - 1];
      const change = (last - first) / (first + 0.0001); // Avoid division by zero
      
      if (change > 0.2) {
        trend = 'increasing';
      } else if (change < -0.2) {
        trend = 'decreasing';
      }
    }

    return { level, trend };
  }

  /**
   * Analyze money flow pressure
   */
  private analyzeMoneyFlowPressure(mfiValue: number): {
    type: 'buying' | 'selling' | 'neutral';
    intensity: 'weak' | 'moderate' | 'strong';
  } {
    let type: 'buying' | 'selling' | 'neutral' = 'neutral';
    let intensity: 'weak' | 'moderate' | 'strong' = 'weak';

    if (mfiValue >= 60) {
      type = 'buying';
      intensity = mfiValue >= 80 ? 'strong' : 'moderate';
    } else if (mfiValue <= 40) {
      type = 'selling';
      intensity = mfiValue <= 20 ? 'strong' : 'moderate';
    } else {
      type = 'neutral';
      intensity = 'weak';
    }

    return { type, intensity };
  }

  /**
   * Check for potential divergence setup
   */
  private checkForDivergenceSetup(data: OHLCV[]): string {
    const results = this.getResults(5);
    if (results.length < 5 || data.length < 5) {
      return 'insufficient_data';
    }

    const mfiValues = results.map(r => r.value as number);
    const prices = data.slice(-5).map(candle => candle.close);

    // Simple divergence check
    const mfiTrend = mfiValues[mfiValues.length - 1] - mfiValues[0];
    const priceTrend = prices[prices.length - 1] - prices[0];

    if (mfiTrend > 0 && priceTrend < 0) {
      return 'bullish_divergence_setup';
    } else if (mfiTrend < 0 && priceTrend > 0) {
      return 'bearish_divergence_setup';
    }

    return 'no_divergence';
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  /**
   * Check if MFI is in overbought territory
   */
  isOverbought(): boolean {
    const latest = this.getLatestResult();
    return latest ? (latest.value as number) >= this.overboughtLevel : false;
  }

  /**
   * Check if MFI is in oversold territory
   */
  isOversold(): boolean {
    const latest = this.getLatestResult();
    return latest ? (latest.value as number) <= this.oversoldLevel : false;
  }

  /**
   * Get current MFI level classification
   */
  getMFILevel(): 'extreme_overbought' | 'overbought' | 'neutral' | 'oversold' | 'extreme_oversold' {
    const latest = this.getLatestResult();
    if (!latest) {
      return 'neutral';
    }

    const mfi = latest.value as number;
    
    if (mfi >= 90) {
      return 'extreme_overbought';
    } else if (mfi >= this.overboughtLevel) {
      return 'overbought';
    } else if (mfi <= 10) {
      return 'extreme_oversold';
    } else if (mfi <= this.oversoldLevel) {
      return 'oversold';
    } else {
      return 'neutral';
    }
  }

  /**
   * Get MFI trend direction
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
   * Calculate MFI momentum (rate of change)
   */
  getMFIMomentum(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length <= periods) {
      return 0;
    }

    const current = results[results.length - 1].value as number;
    const previous = results[results.length - 1 - periods].value as number;
    
    return current - previous;
  }

  /**
   * Check for MFI level crossovers
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
   * Get current money flow components for analysis
   */
  getMoneyFlowComponents(): {
    positiveFlow: number;
    negativeFlow: number;
    ratio: number;
  } {
    if (!this.isWarmedUp) {
      return { positiveFlow: 0, negativeFlow: 0, ratio: 0 };
    }

    const positiveFlow = this.positiveMoneyFlowBuffer.sum();
    const negativeFlow = this.negativeMoneyFlowBuffer.sum();
    const ratio = negativeFlow > 0 ? positiveFlow / negativeFlow : 0;

    return { positiveFlow, negativeFlow, ratio };
  }

  /**
   * Compare MFI with volume-adjusted price
   */
  getVolumeAdjustedAnalysis(): {
    volumeWeightedPrice: number;
    priceVolumeCorrelation: 'positive' | 'negative' | 'neutral';
  } {
    if (!this.isWarmedUp || this.typicalPriceBuffer.size() < 3) {
      return {
        volumeWeightedPrice: 0,
        priceVolumeCorrelation: 'neutral'
      };
    }

    const prices = this.typicalPriceBuffer.getAll();
    const volumes = this.volumeBuffer.getAll();
    
    // Calculate volume-weighted average price
    let totalVolumeValue = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < prices.length; i++) {
      totalVolumeValue += prices[i] * volumes[i];
      totalVolume += volumes[i];
    }
    
    const volumeWeightedPrice = totalVolume > 0 ? totalVolumeValue / totalVolume : 0;

    // Simple correlation analysis
    let priceVolumeCorrelation: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (prices.length >= 3) {
      const priceChange = prices[prices.length - 1] - prices[0];
      const volumeChange = volumes[volumes.length - 1] - volumes[0];
      
      if (priceChange > 0 && volumeChange > 0) {
        priceVolumeCorrelation = 'positive';
      } else if (priceChange < 0 && volumeChange > 0) {
        priceVolumeCorrelation = 'negative';
      }
    }

    return { volumeWeightedPrice, priceVolumeCorrelation };
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latest = this.getLatestResult();
    const mfi = latest ? (latest.value as number).toFixed(2) : 'N/A';
    const level = latest ? this.getMFILevel() : 'unknown';
    
    return `MFI(${this.config.period}) [${this.getStatus()}] ` +
           `Value: ${mfi} (${level})`;
  }
}