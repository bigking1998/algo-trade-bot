/**
 * Technical Indicator Engine Implementation - Task ML-002
 * 
 * Comprehensive technical indicator feature extraction for ML models
 * with efficient calculations and comprehensive indicator coverage.
 */

import { OHLCV, TechnicalFeatures } from './types';

/**
 * Technical indicator calculation options
 */
interface TechnicalOptions {
  sma_periods?: number[];
  ema_periods?: number[];
  rsi_period?: number;
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  bb_period?: number;
  bb_std?: number;
  atr_period?: number;
  adx_period?: number;
  stoch_k_period?: number;
  stoch_d_period?: number;
}

/**
 * Default technical indicator parameters
 */
const DEFAULT_TECHNICAL_OPTIONS: TechnicalOptions = {
  sma_periods: [5, 10, 20, 50],
  ema_periods: [12, 26],
  rsi_period: 14,
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  bb_period: 20,
  bb_std: 2,
  atr_period: 14,
  adx_period: 14,
  stoch_k_period: 14,
  stoch_d_period: 3
};

/**
 * Technical indicator feature extraction engine
 */
export class TechnicalIndicatorEngine {
  private options: TechnicalOptions;

  constructor(options: Partial<TechnicalOptions> = {}) {
    this.options = { ...DEFAULT_TECHNICAL_OPTIONS, ...options };
  }

  /**
   * Calculate all technical indicator features
   */
  calculateTechnicalFeatures(data: OHLCV[]): TechnicalFeatures {
    if (data.length === 0) {
      return this.createEmptyFeatures();
    }

    const features: TechnicalFeatures = {};

    // Trend indicators
    const trendFeatures = this.calculateTrendFeatures(data);
    Object.assign(features, trendFeatures);

    // Momentum indicators  
    const momentumFeatures = this.calculateMomentumFeatures(data);
    Object.assign(features, momentumFeatures);

    // Volatility indicators
    const volatilityFeatures = this.calculateVolatilityFeatures(data);
    Object.assign(features, volatilityFeatures);

    // Volume indicators
    const volumeFeatures = this.calculateVolumeFeatures(data);
    Object.assign(features, volumeFeatures);

    return features;
  }

  /**
   * Calculate trend-based features
   */
  calculateTrendFeatures(data: OHLCV[]): Partial<TechnicalFeatures> {
    const features: Partial<TechnicalFeatures> = {};
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    try {
      // Simple Moving Averages
      for (const period of this.options.sma_periods || []) {
        if (data.length >= period) {
          const sma = this.calculateSMA(closes, period);
          if (sma.length > 0) {
            features[`sma_${period}` as keyof TechnicalFeatures] = sma[sma.length - 1];
          }
        }
      }

      // Exponential Moving Averages
      for (const period of this.options.ema_periods || []) {
        if (data.length >= period) {
          const ema = this.calculateEMA(closes, period);
          if (ema.length > 0) {
            features[`ema_${period}` as keyof TechnicalFeatures] = ema[ema.length - 1];
          }
        }
      }

      // MACD
      if (data.length >= (this.options.macd_slow || 26)) {
        const macd = this.calculateMACD(
          closes,
          this.options.macd_fast || 12,
          this.options.macd_slow || 26,
          this.options.macd_signal || 9
        );
        if (macd.macd.length > 0) {
          features.macd = macd.macd[macd.macd.length - 1];
          features.macd_signal = macd.signal[macd.signal.length - 1];
          features.macd_histogram = macd.histogram[macd.histogram.length - 1];
        }
      }

      // ADX (Average Directional Index)
      if (data.length >= (this.options.adx_period || 14) * 2) {
        const adx = this.calculateADX(highs, lows, closes, this.options.adx_period || 14);
        if (adx.length > 0) {
          features.adx = adx[adx.length - 1];
        }
      }

      // Trend Strength (custom calculation)
      if (data.length >= 20) {
        features.trend_strength = this.calculateTrendStrength(closes);
      }

    } catch (error) {
      console.warn('[TechnicalIndicatorEngine] Error calculating trend features:', error);
    }

    return features;
  }

  /**
   * Calculate momentum-based features
   */
  calculateMomentumFeatures(data: OHLCV[]): Partial<TechnicalFeatures> {
    const features: Partial<TechnicalFeatures> = {};
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    try {
      // RSI (Relative Strength Index)
      if (data.length >= (this.options.rsi_period || 14)) {
        const rsi = this.calculateRSI(closes, this.options.rsi_period || 14);
        if (rsi.length > 0) {
          features.rsi_14 = rsi[rsi.length - 1];
        }
      }

      // Stochastic Oscillator
      if (data.length >= (this.options.stoch_k_period || 14)) {
        const stoch = this.calculateStochastic(
          highs, lows, closes,
          this.options.stoch_k_period || 14,
          this.options.stoch_d_period || 3
        );
        if (stoch.k.length > 0) {
          features.stoch_k = stoch.k[stoch.k.length - 1];
          features.stoch_d = stoch.d[stoch.d.length - 1];
        }
      }

      // Williams %R
      if (data.length >= 14) {
        const williamsR = this.calculateWilliamsR(highs, lows, closes, 14);
        if (williamsR.length > 0) {
          features.williams_r = williamsR[williamsR.length - 1];
        }
      }

      // CCI (Commodity Channel Index)
      if (data.length >= 20) {
        const cci = this.calculateCCI(highs, lows, closes, 20);
        if (cci.length > 0) {
          features.cci = cci[cci.length - 1];
        }
      }

      // Momentum (Rate of Change)
      if (data.length >= 10) {
        const momentum = this.calculateMomentum(closes, 10);
        if (momentum.length > 0) {
          features.momentum = momentum[momentum.length - 1];
        }
      }

      // ROC (Rate of Change)
      if (data.length >= 12) {
        const roc = this.calculateROC(closes, 12);
        if (roc.length > 0) {
          features.roc = roc[roc.length - 1];
        }
      }

    } catch (error) {
      console.warn('[TechnicalIndicatorEngine] Error calculating momentum features:', error);
    }

    return features;
  }

  /**
   * Calculate volatility-based features
   */
  calculateVolatilityFeatures(data: OHLCV[]): Partial<TechnicalFeatures> {
    const features: Partial<TechnicalFeatures> = {};
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    try {
      // Bollinger Bands
      if (data.length >= (this.options.bb_period || 20)) {
        const bb = this.calculateBollingerBands(
          closes,
          this.options.bb_period || 20,
          this.options.bb_std || 2
        );
        if (bb.upper.length > 0) {
          features.bb_upper = bb.upper[bb.upper.length - 1];
          features.bb_middle = bb.middle[bb.middle.length - 1];
          features.bb_lower = bb.lower[bb.lower.length - 1];
          features.bb_width = features.bb_upper - features.bb_lower;
          
          const currentClose = closes[closes.length - 1];
          features.bb_position = (currentClose - features.bb_lower) / features.bb_width;
          features.bollinger_position = features.bb_position; // Alias
        }
      }

      // ATR (Average True Range)
      if (data.length >= (this.options.atr_period || 14)) {
        const atr = this.calculateATR(highs, lows, closes, this.options.atr_period || 14);
        if (atr.length > 0) {
          features.atr_14 = atr[atr.length - 1];
        }
      }

    } catch (error) {
      console.warn('[TechnicalIndicatorEngine] Error calculating volatility features:', error);
    }

    return features;
  }

  /**
   * Calculate volume-based features
   */
  calculateVolumeFeatures(data: OHLCV[]): Partial<TechnicalFeatures> {
    const features: Partial<TechnicalFeatures> = {};
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    try {
      // OBV (On-Balance Volume)
      if (data.length >= 2) {
        const obv = this.calculateOBV(closes, volumes);
        if (obv.length > 0) {
          features.obv = obv[obv.length - 1];
        }
      }

      // A/D Line (Accumulation/Distribution Line)
      if (data.length >= 1) {
        const adLine = this.calculateADLine(highs, lows, closes, volumes);
        if (adLine.length > 0) {
          features.ad_line = adLine[adLine.length - 1];
        }
      }

      // VWAP (Volume Weighted Average Price)
      if (data.length >= 1) {
        const vwap = this.calculateVWAP(data);
        if (vwap.length > 0) {
          features.vwap = vwap[vwap.length - 1];
        }
      }

      // MFI (Money Flow Index)
      if (data.length >= 14) {
        const mfi = this.calculateMFI(highs, lows, closes, volumes, 14);
        if (mfi.length > 0) {
          features.mfi = mfi[mfi.length - 1];
        }
      }

      // Volume Ratio
      if (data.length >= 20) {
        const volumeSMA = this.calculateSMA(volumes, 20);
        if (volumeSMA.length > 0) {
          const currentVolume = volumes[volumes.length - 1];
          features.volume_ratio = currentVolume / volumeSMA[volumeSMA.length - 1];
        }
      }

    } catch (error) {
      console.warn('[TechnicalIndicatorEngine] Error calculating volume features:', error);
    }

    return features;
  }

  /**
   * PRIVATE CALCULATION METHODS
   */

  private calculateSMA(values: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  private calculateEMA(values: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA
    if (values.length >= period) {
      const firstSMA = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      ema.push(firstSMA);
      
      // Calculate EMA
      for (let i = period; i < values.length; i++) {
        const currentEMA = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
        ema.push(currentEMA);
      }
    }
    
    return ema;
  }

  private calculateMACD(values: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) {
    const fastEMA = this.calculateEMA(values, fastPeriod);
    const slowEMA = this.calculateEMA(values, slowPeriod);
    
    const macdLine: number[] = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = 0; i < minLength; i++) {
      macdLine.push(fastEMA[i + fastEMA.length - minLength] - slowEMA[i + slowEMA.length - minLength]);
    }
    
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram: number[] = [];
    
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + macdLine.length - signalLine.length] - signalLine[i]);
    }
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  private calculateRSI(values: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    // Calculate RSI
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    
    return rsi;
  }

  private calculateBollingerBands(values: number[], period: number, stdDev: number) {
    const sma = this.calculateSMA(values, period);
    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < sma.length; i++) {
      const dataSlice = values.slice(i, i + period);
      const mean = sma[i];
      const variance = dataSlice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      middle.push(mean);
      upper.push(mean + (standardDeviation * stdDev));
      lower.push(mean - (standardDeviation * stdDev));
    }
    
    return { upper, middle, lower };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  private calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number, dPeriod: number) {
    const k: number[] = [];
    
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
      const currentClose = closes[i];
      
      if (highestHigh === lowestLow) {
        k.push(50); // Avoid division by zero
      } else {
        k.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100);
      }
    }
    
    const d = this.calculateSMA(k, dPeriod);
    
    return { k, d };
  }

  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const williamsR: number[] = [];
    
    for (let i = period - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1));
      const currentClose = closes[i];
      
      if (highestHigh === lowestLow) {
        williamsR.push(-50); // Avoid division by zero
      } else {
        williamsR.push(((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100);
      }
    }
    
    return williamsR;
  }

  private calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const cci: number[] = [];
    
    for (let i = period - 1; i < closes.length; i++) {
      const typicalPrices = [];
      for (let j = i - period + 1; j <= i; j++) {
        typicalPrices.push((highs[j] + lows[j] + closes[j]) / 3);
      }
      
      const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
      const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
      
      if (meanDeviation === 0) {
        cci.push(0);
      } else {
        cci.push((typicalPrices[typicalPrices.length - 1] - smaTP) / (0.015 * meanDeviation));
      }
    }
    
    return cci;
  }

  private calculateMomentum(values: number[], period: number): number[] {
    const momentum: number[] = [];
    for (let i = period; i < values.length; i++) {
      momentum.push(values[i] - values[i - period]);
    }
    return momentum;
  }

  private calculateROC(values: number[], period: number): number[] {
    const roc: number[] = [];
    for (let i = period; i < values.length; i++) {
      const currentValue = values[i];
      const pastValue = values[i - period];
      if (pastValue !== 0) {
        roc.push(((currentValue - pastValue) / pastValue) * 100);
      } else {
        roc.push(0);
      }
    }
    return roc;
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const adx: number[] = [];
    // Simplified ADX calculation - in production, would use full implementation
    const atr = this.calculateATR(highs, lows, closes, period);
    
    for (let i = 0; i < atr.length; i++) {
      // Placeholder calculation - real ADX is more complex
      adx.push(Math.min(100, Math.max(0, atr[i] * 10)));
    }
    
    return adx;
  }

  private calculateTrendStrength(closes: number[]): number {
    if (closes.length < 20) return 0.5;
    
    const recent = closes.slice(-20);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const change = (newest - oldest) / oldest;
    
    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, 0.5 + change * 5));
  }

  private calculateOBV(closes: number[], volumes: number[]): number[] {
    const obv: number[] = [volumes[0]];
    
    for (let i = 1; i < closes.length; i++) {
      let obvValue = obv[obv.length - 1];
      
      if (closes[i] > closes[i - 1]) {
        obvValue += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obvValue -= volumes[i];
      }
      
      obv.push(obvValue);
    }
    
    return obv;
  }

  private calculateADLine(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
    const adLine: number[] = [];
    let cumulative = 0;
    
    for (let i = 0; i < closes.length; i++) {
      const clv = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / (highs[i] - lows[i]);
      cumulative += clv * volumes[i];
      adLine.push(cumulative);
    }
    
    return adLine;
  }

  private calculateVWAP(data: OHLCV[]): number[] {
    const vwap: number[] = [];
    let cumulativeVolume = 0;
    let cumulativePriceVolume = 0;
    
    for (const candle of data) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativePriceVolume += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      
      if (cumulativeVolume > 0) {
        vwap.push(cumulativePriceVolume / cumulativeVolume);
      } else {
        vwap.push(typicalPrice);
      }
    }
    
    return vwap;
  }

  private calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number): number[] {
    const mfi: number[] = [];
    
    for (let i = period; i < closes.length; i++) {
      let positiveFlow = 0;
      let negativeFlow = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        const typicalPrice = (highs[j] + lows[j] + closes[j]) / 3;
        const prevTypicalPrice = j > 0 ? (highs[j - 1] + lows[j - 1] + closes[j - 1]) / 3 : typicalPrice;
        const rawMoneyFlow = typicalPrice * volumes[j];
        
        if (typicalPrice > prevTypicalPrice) {
          positiveFlow += rawMoneyFlow;
        } else if (typicalPrice < prevTypicalPrice) {
          negativeFlow += rawMoneyFlow;
        }
      }
      
      if (negativeFlow === 0) {
        mfi.push(100);
      } else {
        const moneyFlowRatio = positiveFlow / negativeFlow;
        mfi.push(100 - (100 / (1 + moneyFlowRatio)));
      }
    }
    
    return mfi;
  }

  private createEmptyFeatures(): TechnicalFeatures {
    return {};
  }
}