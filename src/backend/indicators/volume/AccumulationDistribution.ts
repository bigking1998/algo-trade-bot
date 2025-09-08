/**
 * Accumulation/Distribution Line (A/D Line) Indicator - Task BE-010
 * 
 * Calculates the Accumulation/Distribution Line which combines price and volume
 * to assess the cumulative flow of money into and out of a security.
 * 
 * Formula: A/D = Previous A/D + (((Close - Low) - (High - Close)) / (High - Low)) × Volume
 * The multiplier: ((Close - Low) - (High - Close)) / (High - Low) ranges from -1 to +1
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';
import { mathUtils } from '../base/MathUtils.js';

export interface AccumulationDistributionConfig extends IndicatorConfig {
  /** Use relative A/D line (percentage change) instead of absolute values */
  useRelative?: boolean;
  /** Smoothing period for A/D signal line */
  signalPeriod?: number;
}

/**
 * Accumulation/Distribution Line implementation
 */
export class AccumulationDistribution extends TechnicalIndicator<number> {
  private readonly useRelative: boolean;
  private readonly signalPeriod?: number;

  private adValue = 0;
  private initialAD?: number;

  constructor(config: AccumulationDistributionConfig) {
    super('A/D Line', { ...config, period: config.period || 1 }); // A/D doesn't require a period
    
    this.useRelative = config.useRelative || false;
    this.signalPeriod = config.signalPeriod;
  }

  /**
   * Calculate A/D Line for given data
   */
  protected calculateValue(data: OHLCV[]): number {
    if (data.length === 0) {
      return 0;
    }

    let ad = 0;
    
    // Calculate A/D Line for each candle
    for (const candle of data) {
      const multiplier = this.calculateMultiplier(candle);
      ad += multiplier * (candle.volume || 0);
    }

    return this.useRelative ? this.calculateRelativeAD(ad) : ad;
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): number {
    const multiplier = this.calculateMultiplier(newCandle);
    const volume = newCandle.volume || 0;
    
    // Update A/D Line
    this.adValue += multiplier * volume;

    if (this.initialAD === undefined) {
      this.initialAD = Math.abs(this.adValue) || 1;
    }

    return this.useRelative ? this.calculateRelativeAD(this.adValue) : this.adValue;
  }

  /**
   * Calculate the Close Location Value (CLV) multiplier
   */
  private calculateMultiplier(candle: OHLCV): number {
    const { high, low, close } = candle;
    const range = high - low;

    // Avoid division by zero
    if (range === 0) {
      return 0; // No price movement, neutral multiplier
    }

    // Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
    return ((close - low) - (high - close)) / range;
  }

  /**
   * Calculate relative A/D (as percentage of initial value)
   */
  private calculateRelativeAD(ad: number): number {
    if (this.initialAD === undefined || this.initialAD === 0) {
      return 0;
    }
    return (ad / this.initialAD) * 100;
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.adValue = 0;
    this.initialAD = undefined;
  }

  /**
   * Validate A/D Line configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const adConfig = config as AccumulationDistributionConfig;

    if (adConfig.signalPeriod !== undefined && adConfig.signalPeriod <= 0) {
      throw new Error('Signal period must be positive');
    }
  }

  /**
   * Get A/D Line metadata
   */
  protected getResultMetadata(value: number, data: OHLCV[]): Record<string, any> {
    const trend = this.getInternalADTrend();
    const strength = this.getAccumulationStrength();
    
    return {
      ...super.getResultMetadata(value, data),
      useRelative: this.useRelative,
      signalPeriod: this.signalPeriod,
      trend,
      strength,
      divergenceSignal: this.checkForDivergence(data),
      moneyFlowBias: this.getMoneyFlowBias()
    };
  }

  /**
   * Get A/D Line trend direction (internal)
   */
  private getInternalADTrend(periods: number = 3): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' {
    const results = this.getResults(periods);
    if (results.length < periods) return 'NEUTRAL';

    const values = results.map(r => r.value as number);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = lastValue - firstValue;
    const threshold = Math.abs(firstValue) * 0.01; // 1% threshold

    if (change > threshold) return 'ACCUMULATION';
    if (change < -threshold) return 'DISTRIBUTION';
    return 'NEUTRAL';
  }

  /**
   * Get A/D Line trend
   */
  getADTrend(periods: number = 3): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' {
    return this.getInternalADTrend(periods);
  }

  /**
   * Get accumulation/distribution strength
   */
  private getAccumulationStrength(): 'STRONG' | 'MODERATE' | 'WEAK' {
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
   * Get money flow bias (accumulation vs distribution tendency)
   */
  private getMoneyFlowBias(periods: number = 10): 'ACCUMULATION' | 'DISTRIBUTION' | 'BALANCED' {
    const results = this.getResults(periods);
    if (results.length < 2) return 'BALANCED';

    const values = results.map(r => r.value as number);
    let accumulationPeriods = 0;
    let distributionPeriods = 0;

    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      if (change > 0) accumulationPeriods++;
      else if (change < 0) distributionPeriods++;
    }

    const ratio = accumulationPeriods / (accumulationPeriods + distributionPeriods);
    
    if (ratio > 0.6) return 'ACCUMULATION';
    if (ratio < 0.4) return 'DISTRIBUTION';
    return 'BALANCED';
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
    const recentAD = results.slice(-5).map(r => r.value as number);
    const pastAD = results.slice(-10, -5).map(r => r.value as number);

    const recentPriceHigh = Math.max(...recentData.map(c => c.high));
    const pastPriceHigh = Math.max(...pastData.map(c => c.high));
    const recentADMax = Math.max(...recentAD);
    const pastADMax = Math.max(...pastAD);

    const recentPriceLow = Math.min(...recentData.map(c => c.low));
    const pastPriceLow = Math.min(...pastData.map(c => c.low));
    const recentADMin = Math.min(...recentAD);
    const pastADMin = Math.min(...pastAD);

    // Bearish divergence: Price makes higher high, A/D makes lower high
    if (recentPriceHigh > pastPriceHigh && recentADMax < pastADMax) {
      return 'BEARISH';
    }

    // Bullish divergence: Price makes lower low, A/D makes higher low
    if (recentPriceLow < pastPriceLow && recentADMin > pastADMin) {
      return 'BULLISH';
    }

    return 'NONE';
  }

  /**
   * Check if A/D Line is confirming price trend
   */
  isConfirmingTrend(priceDirection: 'UP' | 'DOWN'): boolean {
    const adTrend = this.getADTrend();
    
    if (priceDirection === 'UP') {
      return adTrend === 'ACCUMULATION';
    } else {
      return adTrend === 'DISTRIBUTION';
    }
  }

  /**
   * Get A/D Line divergence with price
   */
  getDivergence(priceHigh: number, priceLow: number, currentHigh: number, currentLow: number): 'BULLISH' | 'BEARISH' | 'NONE' {
    const results = this.getResults(this.config.period);
    if (results.length < this.config.period) return 'NONE';

    const adValues = results.map(r => r.value as number);
    const recentAD = adValues.slice(-Math.floor(this.config.period / 2));
    const pastAD = adValues.slice(-this.config.period, -Math.floor(this.config.period / 2));

    const recentADHigh = Math.max(...recentAD);
    const pastADHigh = Math.max(...pastAD);
    const recentADLow = Math.min(...recentAD);
    const pastADLow = Math.min(...pastAD);

    // Bearish divergence: Price higher high, A/D lower high
    if (currentHigh > priceHigh && recentADHigh < pastADHigh) {
      return 'BEARISH';
    }

    // Bullish divergence: Price lower low, A/D higher low
    if (currentLow < priceLow && recentADLow > pastADLow) {
      return 'BULLISH';
    }

    return 'NONE';
  }

  /**
   * Get A/D signal line (smoothed A/D)
   */
  getSignalLine(): number | undefined {
    if (!this.signalPeriod) return undefined;

    const results = this.getResults(this.signalPeriod);
    if (results.length < this.signalPeriod) return undefined;

    const values = results.map(r => r.value as number);
    return mathUtils.sma(values, this.signalPeriod);
  }

  /**
   * Check for A/D signal line crossover
   */
  hasSignalCrossover(): 'BULLISH' | 'BEARISH' | 'NONE' {
    if (!this.signalPeriod) return 'NONE';

    const results = this.getResults(2);
    if (results.length < 2) return 'NONE';

    const currentAD = results[1].value as number;
    const previousAD = results[0].value as number;
    
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

    // Bullish crossover: A/D crosses above signal line
    if (currentAD > currentSignal && previousAD <= previousSignal) {
      return 'BULLISH';
    }

    // Bearish crossover: A/D crosses below signal line
    if (currentAD < currentSignal && previousAD >= previousSignal) {
      return 'BEARISH';
    }

    return 'NONE';
  }

  /**
   * Get A/D momentum (rate of change)
   */
  getMomentum(periods: number = 1): number {
    const results = this.getResults(periods + 1);
    if (results.length < periods + 1) return 0;

    const current = results[results.length - 1].value as number;
    const past = results[results.length - 1 - periods].value as number;

    return current - past;
  }

  /**
   * Get volume-weighted money flow
   */
  getVolumeWeightedMoneyFlow(lookbackPeriods: number = 5): number {
    const dataBuffer = this.dataBuffer.getAll();
    if (dataBuffer.length < lookbackPeriods) return 0;

    const recentData = dataBuffer.slice(-lookbackPeriods);
    let totalVolumeWeightedMF = 0;
    let totalVolume = 0;

    for (const candle of recentData) {
      const multiplier = this.calculateMultiplier(candle);
      const volume = candle.volume || 0;
      const moneyFlow = multiplier * volume;
      
      totalVolumeWeightedMF += moneyFlow;
      totalVolume += volume;
    }

    return totalVolume > 0 ? totalVolumeWeightedMF / totalVolume : 0;
  }

  /**
   * Get buying/selling pressure ratio
   */
  getPressureRatio(lookbackPeriods: number = 10): {
    buyingPressure: number;
    sellingPressure: number;
    ratio: number;
  } {
    const dataBuffer = this.dataBuffer.getAll();
    if (dataBuffer.length < lookbackPeriods) {
      return { buyingPressure: 0, sellingPressure: 0, ratio: 0 };
    }

    const recentData = dataBuffer.slice(-lookbackPeriods);
    let buyingPressure = 0;
    let sellingPressure = 0;

    for (const candle of recentData) {
      const multiplier = this.calculateMultiplier(candle);
      const volume = candle.volume || 0;
      const moneyFlow = multiplier * volume;
      
      if (moneyFlow > 0) {
        buyingPressure += moneyFlow;
      } else if (moneyFlow < 0) {
        sellingPressure += Math.abs(moneyFlow);
      }
    }

    const total = buyingPressure + sellingPressure;
    const ratio = total > 0 ? (buyingPressure - sellingPressure) / total : 0;

    return { buyingPressure, sellingPressure, ratio };
  }

  /**
   * Check if money flow is supporting price movement
   */
  isMoneyFlowSupportingPrice(priceChange: number): boolean {
    const adChange = this.getMomentum(1);
    
    // Money flow should move in same direction as price for confirmation
    if (priceChange > 0 && adChange > 0) return true;
    if (priceChange < 0 && adChange < 0) return true;
    
    return false;
  }

  /**
   * Get current A/D value
   */
  getCurrentAD(): number {
    return this.adValue;
  }

  /**
   * Get volume flow strength
   */
  getVolumeFlowStrength(): 'STRONG_ACCUMULATION' | 'ACCUMULATION' | 'NEUTRAL' | 'DISTRIBUTION' | 'STRONG_DISTRIBUTION' {
    const vwmf = this.getVolumeWeightedMoneyFlow();
    
    if (vwmf > 0.5) return 'STRONG_ACCUMULATION';
    if (vwmf > 0.1) return 'ACCUMULATION';
    if (vwmf > -0.1) return 'NEUTRAL';
    if (vwmf > -0.5) return 'DISTRIBUTION';
    return 'STRONG_DISTRIBUTION';
  }

  /**
   * Get trading signal based on A/D Line
   */
  getSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
    const crossover = this.hasSignalCrossover();
    if (crossover === 'BULLISH') return 'BUY';
    if (crossover === 'BEARISH') return 'SELL';

    const trend = this.getInternalADTrend();
    const strength = this.getAccumulationStrength();
    
    if (trend === 'ACCUMULATION' && strength === 'STRONG') return 'BUY';
    if (trend === 'DISTRIBUTION' && strength === 'STRONG') return 'SELL';

    return 'NEUTRAL';
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `A/D Line [${this.getStatus()}] Value: N/A`;
    }

    const value = latestResult.value as number;
    const trend = this.getInternalADTrend();
    const strength = this.getAccumulationStrength();
    const signal = this.getSignal();
    const units = this.useRelative ? '%' : '';
    
    return `A/D Line [${this.getStatus()}] ` +
           `Value: ${value.toFixed(2)}${units}, Trend: ${trend}, ` +
           `Strength: ${strength}, Signal: ${signal}`;
  }
}