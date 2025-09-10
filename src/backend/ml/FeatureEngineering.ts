/**
 * Feature Engineering Pipeline - Task ML-002
 * 
 * Automated feature generation from market data, technical indicators, and price action.
 * Provides a comprehensive pipeline for extracting features suitable for ML model training.
 * 
 * Features:
 * - Price and volume-based features
 * - Technical indicator-based features
 * - Price action patterns and momentum features
 * - Feature scaling and normalization
 * - Sliding window and lookback period management
 * - Feature importance analysis
 * - Real-time feature computation
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { FeatureVector, FeatureConfig } from '../../frontend/ml/types';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FeatureExtractionConfig {
  lookbackPeriod: number;
  includePrice: boolean;
  includeVolume: boolean;
  includeTechnical: boolean;
  includePriceAction: boolean;
  includeMacro: boolean;
  normalization: 'minmax' | 'zscore' | 'robust' | 'none';
  featureSelection: boolean;
  maxFeatures?: number;
}

export interface ComputedFeatures {
  features: Float32Array;
  featureNames: string[];
  metadata: {
    timestamp: number;
    symbol: string;
    lookbackPeriod: number;
    featureCount: number;
    normalizationType: string;
  };
}

export interface FeatureImportance {
  featureName: string;
  importance: number;
  rank: number;
  type: string;
  description: string;
}

export interface FeatureStatistics {
  mean: number;
  std: number;
  min: number;
  max: number;
  q25: number;
  q50: number;
  q75: number;
  skewness: number;
  kurtosis: number;
}

/**
 * Feature Engineering Pipeline for ML models
 */
export class FeatureEngineeringPipeline extends EventEmitter {
  private config: FeatureExtractionConfig;
  private featureStats: Map<string, FeatureStatistics> = new Map();
  private featureImportance: Map<string, number> = new Map();
  private scalingParams: Map<string, { min: number; max: number; mean: number; std: number }> = new Map();
  
  // Cache for computed indicators
  private indicatorCache: Map<string, Map<number, number>> = new Map();
  private processedSamples = 0;

  constructor(config: Partial<FeatureExtractionConfig> = {}) {
    super();
    
    this.config = {
      lookbackPeriod: 50,
      includePrice: true,
      includeVolume: true,
      includeTechnical: true,
      includePriceAction: true,
      includeMacro: false,
      normalization: 'zscore',
      featureSelection: false,
      maxFeatures: 100,
      ...config
    };
    
    console.log('🔧 Feature Engineering Pipeline initialized');
    console.log('⚙️  Configuration:', this.config);
  }

  /**
   * Extract features from market data
   */
  async extractFeatures(
    candleData: CandleData[],
    symbol: string,
    currentTimestamp?: number
  ): Promise<ComputedFeatures> {
    try {
      if (candleData.length < this.config.lookbackPeriod) {
        throw new Error(`Insufficient data. Need at least ${this.config.lookbackPeriod} candles`);
      }

      const timestamp = currentTimestamp || candleData[candleData.length - 1].timestamp;
      
      console.log(`🔬 Extracting features for ${symbol} at ${new Date(timestamp).toISOString()}`);
      console.log(`📊 Data points: ${candleData.length}, Lookback: ${this.config.lookbackPeriod}`);

      // Extract different types of features
      const allFeatures: number[] = [];
      const allFeatureNames: string[] = [];

      // Price-based features
      if (this.config.includePrice) {
        const priceFeatures = this.extractPriceFeatures(candleData);
        allFeatures.push(...priceFeatures.values);
        allFeatureNames.push(...priceFeatures.names);
      }

      // Volume-based features
      if (this.config.includeVolume) {
        const volumeFeatures = this.extractVolumeFeatures(candleData);
        allFeatures.push(...volumeFeatures.values);
        allFeatureNames.push(...volumeFeatures.names);
      }

      // Technical indicator features
      if (this.config.includeTechnical) {
        const technicalFeatures = this.extractTechnicalFeatures(candleData);
        allFeatures.push(...technicalFeatures.values);
        allFeatureNames.push(...technicalFeatures.names);
      }

      // Price action pattern features
      if (this.config.includePriceAction) {
        const priceActionFeatures = this.extractPriceActionFeatures(candleData);
        allFeatures.push(...priceActionFeatures.values);
        allFeatureNames.push(...priceActionFeatures.names);
      }

      // Macro/sentiment features (if enabled)
      if (this.config.includeMacro) {
        const macroFeatures = this.extractMacroFeatures(candleData, symbol);
        allFeatures.push(...macroFeatures.values);
        allFeatureNames.push(...macroFeatures.names);
      }

      // Feature selection if enabled
      let selectedFeatures = allFeatures;
      let selectedNames = allFeatureNames;

      if (this.config.featureSelection && this.config.maxFeatures && allFeatures.length > this.config.maxFeatures) {
        const selection = this.selectTopFeatures(allFeatures, allFeatureNames, this.config.maxFeatures);
        selectedFeatures = selection.values;
        selectedNames = selection.names;
      }

      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(selectedFeatures, selectedNames);

      // Update statistics
      this.updateFeatureStatistics(normalizedFeatures, selectedNames);
      this.processedSamples++;

      const computedFeatures: ComputedFeatures = {
        features: normalizedFeatures,
        featureNames: selectedNames,
        metadata: {
          timestamp,
          symbol,
          lookbackPeriod: this.config.lookbackPeriod,
          featureCount: selectedNames.length,
          normalizationType: this.config.normalization
        }
      };

      console.log(`✅ Features extracted: ${selectedNames.length} features`);
      console.log(`📊 Feature types: Price(${this.config.includePrice}), Volume(${this.config.includeVolume}), Technical(${this.config.includeTechnical}), PriceAction(${this.config.includePriceAction})`);
      
      this.emit('featuresExtracted', computedFeatures);
      return computedFeatures;

    } catch (error) {
      console.error('❌ Feature extraction failed:', error);
      this.emit('error', { type: 'FEATURE_EXTRACTION_FAILED', error, symbol });
      throw error;
    }
  }

  /**
   * Extract batch features for training
   */
  async extractBatchFeatures(
    batchData: { candleData: CandleData[]; symbol: string; timestamp?: number }[]
  ): Promise<ComputedFeatures[]> {
    console.log(`🔄 Extracting batch features for ${batchData.length} samples`);

    const results: ComputedFeatures[] = [];
    const errors: any[] = [];

    for (let i = 0; i < batchData.length; i++) {
      const { candleData, symbol, timestamp } = batchData[i];
      
      try {
        const features = await this.extractFeatures(candleData, symbol, timestamp);
        results.push(features);

        if ((i + 1) % 100 === 0) {
          console.log(`📊 Processed ${i + 1}/${batchData.length} samples`);
        }

      } catch (error) {
        errors.push({ index: i, symbol, error });
        console.error(`❌ Failed to extract features for ${symbol} (index ${i}):`, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length}/${batchData.length} samples failed feature extraction`);
    }

    console.log(`✅ Batch feature extraction completed: ${results.length} successful`);
    this.emit('batchFeaturesExtracted', { results, errors });

    return results;
  }

  /**
   * PRICE-BASED FEATURES
   */
  private extractPriceFeatures(candleData: CandleData[]): { values: number[]; names: string[] } {
    const features: number[] = [];
    const names: string[] = [];
    const lookback = Math.min(this.config.lookbackPeriod, candleData.length - 1);

    // Recent price data
    const recent = candleData.slice(-lookback);
    const latest = candleData[candleData.length - 1];

    // Basic price features
    const closes = recent.map(c => c.close);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    const opens = recent.map(c => c.open);

    // Current price relationships
    features.push(
      latest.close / latest.open - 1,           // Current candle return
      (latest.high - latest.low) / latest.close, // Current candle range
      (latest.close - latest.low) / (latest.high - latest.low), // Close position in range
      latest.close / this.mean(closes.slice(-10)) - 1,          // Price vs 10-period average
      latest.close / this.mean(closes.slice(-20)) - 1           // Price vs 20-period average
    );

    names.push(
      'current_return', 'current_range_pct', 'close_position',
      'price_vs_ma10', 'price_vs_ma20'
    );

    // Price momentum features
    const returns = this.calculateReturns(closes);
    if (returns.length >= 5) {
      features.push(
        this.mean(returns.slice(-5)),        // 5-period average return
        this.mean(returns.slice(-10)),       // 10-period average return
        this.std(returns.slice(-10)),        // 10-period return volatility
        this.mean(returns.slice(-5)) / this.std(returns.slice(-10)), // Risk-adjusted momentum
      );

      names.push('avg_return_5', 'avg_return_10', 'return_volatility_10', 'risk_adj_momentum');
    }

    // High/Low features
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    
    features.push(
      (latest.close - minLow) / (maxHigh - minLow),  // Position in recent range
      (maxHigh - latest.close) / latest.close,       // Distance from recent high
      (latest.close - minLow) / latest.close         // Distance from recent low
    );

    names.push('range_position', 'distance_from_high', 'distance_from_low');

    return { values: features, names };
  }

  /**
   * VOLUME-BASED FEATURES
   */
  private extractVolumeFeatures(candleData: CandleData[]): { values: number[]; names: string[] } {
    const features: number[] = [];
    const names: string[] = [];
    const lookback = Math.min(this.config.lookbackPeriod, candleData.length - 1);

    const recent = candleData.slice(-lookback);
    const latest = candleData[candleData.length - 1];

    // Volume data
    const volumes = recent.map(c => c.volume);
    const avgVolume10 = this.mean(volumes.slice(-10));
    const avgVolume20 = this.mean(volumes.slice(-20));

    // Volume features
    features.push(
      latest.volume / avgVolume10 - 1,      // Volume vs 10-period average
      latest.volume / avgVolume20 - 1,      // Volume vs 20-period average
      this.std(volumes.slice(-10)) / this.mean(volumes.slice(-10)), // Volume volatility
      latest.volume                          // Raw volume (will be normalized)
    );

    names.push('volume_vs_avg10', 'volume_vs_avg20', 'volume_volatility', 'raw_volume');

    // Volume-price correlation
    const closes = recent.map(c => c.close);
    const returns = this.calculateReturns(closes);
    const volumeChanges = this.calculateReturns(volumes);
    
    if (returns.length > 10 && volumeChanges.length > 10) {
      const correlation = this.correlation(
        returns.slice(-10),
        volumeChanges.slice(-10)
      );
      
      features.push(correlation || 0);
      names.push('volume_price_correlation');
    }

    return { values: features, names };
  }

  /**
   * TECHNICAL INDICATOR FEATURES
   */
  private extractTechnicalFeatures(candleData: CandleData[]): { values: number[]; names: string[] } {
    const features: number[] = [];
    const names: string[] = [];
    const lookback = Math.min(this.config.lookbackPeriod, candleData.length - 1);

    const recent = candleData.slice(-lookback);
    const closes = recent.map(c => c.close);
    const latest = recent[recent.length - 1];

    // Moving averages
    const sma10 = this.sma(closes, 10);
    const sma20 = this.sma(closes, 20);
    const ema12 = this.ema(closes, 12);
    const ema26 = this.ema(closes, 26);

    if (sma10.length > 0 && sma20.length > 0) {
      features.push(
        latest.close / sma10[sma10.length - 1] - 1,    // Price vs SMA10
        latest.close / sma20[sma20.length - 1] - 1,    // Price vs SMA20
        sma10[sma10.length - 1] / sma20[sma20.length - 1] - 1  // SMA10 vs SMA20
      );
      names.push('price_vs_sma10', 'price_vs_sma20', 'sma10_vs_sma20');
    }

    // RSI
    const rsi = this.rsi(closes, 14);
    if (rsi.length > 0) {
      const currentRSI = rsi[rsi.length - 1];
      features.push(
        currentRSI / 100,              // RSI normalized
        currentRSI > 70 ? 1 : 0,       // Overbought
        currentRSI < 30 ? 1 : 0        // Oversold
      );
      names.push('rsi_normalized', 'rsi_overbought', 'rsi_oversold');
    }

    // MACD
    if (ema12.length > 0 && ema26.length > 0) {
      const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
      const macdSignal = this.ema([macdLine], 9)[0] || macdLine;
      const macdHistogram = macdLine - macdSignal;

      features.push(
        macdLine / latest.close,        // MACD line normalized
        macdHistogram / latest.close,   // MACD histogram normalized
        macdLine > macdSignal ? 1 : 0   // MACD bullish signal
      );
      names.push('macd_line_norm', 'macd_histogram_norm', 'macd_bullish');
    }

    // Bollinger Bands
    const bb = this.bollingerBands(closes, 20, 2);
    if (bb.length > 0) {
      const currentBB = bb[bb.length - 1];
      const bbPosition = (latest.close - currentBB.lower) / (currentBB.upper - currentBB.lower);
      
      features.push(
        bbPosition,                     // Position within Bollinger Bands
        (currentBB.upper - currentBB.lower) / currentBB.middle,  // BB width
        latest.close > currentBB.upper ? 1 : 0,  // Above upper band
        latest.close < currentBB.lower ? 1 : 0   // Below lower band
      );
      names.push('bb_position', 'bb_width', 'above_bb_upper', 'below_bb_lower');
    }

    // ATR (Average True Range)
    const atr = this.atr(recent, 14);
    if (atr.length > 0) {
      features.push(atr[atr.length - 1] / latest.close);
      names.push('atr_normalized');
    }

    return { values: features, names };
  }

  /**
   * PRICE ACTION PATTERN FEATURES
   */
  private extractPriceActionFeatures(candleData: CandleData[]): { values: number[]; names: string[] } {
    const features: number[] = [];
    const names: string[] = [];
    const lookback = Math.min(this.config.lookbackPeriod, candleData.length - 1);

    const recent = candleData.slice(-lookback);
    const latest = recent[recent.length - 1];

    // Candlestick patterns
    const bodySize = Math.abs(latest.close - latest.open) / (latest.high - latest.low);
    const upperShadow = (latest.high - Math.max(latest.open, latest.close)) / (latest.high - latest.low);
    const lowerShadow = (Math.min(latest.open, latest.close) - latest.low) / (latest.high - latest.low);

    features.push(
      bodySize,                         // Candle body size ratio
      upperShadow,                      // Upper shadow ratio
      lowerShadow,                      // Lower shadow ratio
      latest.close > latest.open ? 1 : 0,  // Bullish candle
      bodySize < 0.1 ? 1 : 0,          // Doji pattern
      bodySize > 0.8 ? 1 : 0           // Strong body
    );

    names.push('body_size', 'upper_shadow', 'lower_shadow', 'bullish_candle', 'doji_pattern', 'strong_body');

    // Multi-candle patterns
    if (recent.length >= 3) {
      const last3 = recent.slice(-3);
      
      // Three consecutive patterns
      const consecutiveBulls = last3.every(c => c.close > c.open) ? 1 : 0;
      const consecutiveBears = last3.every(c => c.close < c.open) ? 1 : 0;
      
      // Higher highs, higher lows
      const higherHighs = last3[2].high > last3[1].high && last3[1].high > last3[0].high ? 1 : 0;
      const lowerLows = last3[2].low < last3[1].low && last3[1].low < last3[0].low ? 1 : 0;

      features.push(consecutiveBulls, consecutiveBears, higherHighs, lowerLows);
      names.push('three_bulls', 'three_bears', 'higher_highs', 'lower_lows');
    }

    // Gap detection
    if (recent.length >= 2) {
      const prevCandle = recent[recent.length - 2];
      const gap = (latest.open - prevCandle.close) / prevCandle.close;
      const gapUp = gap > 0.002 ? 1 : 0;  // 0.2% gap
      const gapDown = gap < -0.002 ? 1 : 0;

      features.push(gap, gapUp, gapDown);
      names.push('gap_size', 'gap_up', 'gap_down');
    }

    return { values: features, names };
  }

  /**
   * MACRO/SENTIMENT FEATURES (placeholder for future implementation)
   */
  private extractMacroFeatures(candleData: CandleData[], symbol: string): { values: number[]; names: string[] } {
    const features: number[] = [];
    const names: string[] = [];

    // Placeholder for macro features
    // In a real implementation, this would include:
    // - Market sentiment indicators
    // - Economic calendar events
    // - News sentiment scores
    // - Cross-asset correlations
    // - Volatility indices (VIX)

    // For now, return empty arrays
    return { values: features, names };
  }

  /**
   * Feature selection using importance scores
   */
  private selectTopFeatures(
    features: number[],
    names: string[],
    maxFeatures: number
  ): { values: number[]; names: string[] } {
    
    // Create importance scores (this is simplified - in reality would use more sophisticated methods)
    const importanceScores = names.map((name, index) => ({
      name,
      value: features[index],
      importance: this.featureImportance.get(name) || Math.random(), // Random if no historical importance
      index
    }));

    // Sort by importance and select top features
    importanceScores.sort((a, b) => b.importance - a.importance);
    const selected = importanceScores.slice(0, maxFeatures);

    return {
      values: selected.map(s => s.value),
      names: selected.map(s => s.name)
    };
  }

  /**
   * Normalize features based on configuration
   */
  private normalizeFeatures(features: number[], names: string[]): Float32Array {
    const normalized = new Float32Array(features.length);

    for (let i = 0; i < features.length; i++) {
      const name = names[i];
      const value = features[i];

      // Skip normalization for NaN or infinite values
      if (!isFinite(value)) {
        normalized[i] = 0;
        continue;
      }

      let normalizedValue = value;

      switch (this.config.normalization) {
        case 'minmax': {
          const params = this.scalingParams.get(name) || { min: value, max: value, mean: value, std: 1 };
          normalizedValue = params.max > params.min ? (value - params.min) / (params.max - params.min) : 0;
          break;
        }
        
        case 'zscore': {
          const params = this.scalingParams.get(name) || { min: value, max: value, mean: value, std: 1 };
          normalizedValue = params.std > 0 ? (value - params.mean) / params.std : 0;
          break;
        }
        
        case 'robust': {
          // Robust scaling using median and IQR (simplified)
          const params = this.scalingParams.get(name) || { min: value, max: value, mean: value, std: 1 };
          const iqr = params.max - params.min; // Simplified IQR
          normalizedValue = iqr > 0 ? (value - params.mean) / iqr : 0;
          break;
        }
        
        default: // 'none'
          normalizedValue = value;
      }

      normalized[i] = normalizedValue;
    }

    return normalized;
  }

  /**
   * Update scaling parameters for normalization
   */
  private updateScalingParameters(values: number[], names: string[]): void {
    for (let i = 0; i < values.length; i++) {
      const name = names[i];
      const value = values[i];

      if (!isFinite(value)) continue;

      const existing = this.scalingParams.get(name);
      if (!existing) {
        this.scalingParams.set(name, {
          min: value,
          max: value,
          mean: value,
          std: 0
        });
      } else {
        // Update running statistics
        const alpha = 0.01; // Learning rate for online updates
        existing.min = Math.min(existing.min, value);
        existing.max = Math.max(existing.max, value);
        existing.mean = existing.mean * (1 - alpha) + value * alpha;
        
        // Update standard deviation (simplified)
        const variance = existing.std * existing.std;
        const newVariance = variance * (1 - alpha) + Math.pow(value - existing.mean, 2) * alpha;
        existing.std = Math.sqrt(newVariance);
      }
    }
  }

  /**
   * Update feature statistics
   */
  private updateFeatureStatistics(features: Float32Array, names: string[]): void {
    // Update scaling parameters
    this.updateScalingParameters(Array.from(features), names);

    // Calculate and store detailed statistics
    for (let i = 0; i < features.length; i++) {
      const name = names[i];
      const value = features[i];

      if (!isFinite(value)) continue;

      // This is a simplified statistics update
      // In a real implementation, you'd maintain more comprehensive statistics
      const existing = this.featureStats.get(name);
      if (!existing) {
        this.featureStats.set(name, {
          mean: value,
          std: 0,
          min: value,
          max: value,
          q25: value,
          q50: value,
          q75: value,
          skewness: 0,
          kurtosis: 0
        });
      }
    }
  }

  /**
   * TECHNICAL INDICATOR IMPLEMENTATIONS
   */

  private sma(values: number[], period: number): number[] {
    if (values.length < period) return [];
    
    const result: number[] = [];
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  private ema(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    
    const k = 2 / (period + 1);
    const result: number[] = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
      result.push(values[i] * k + result[i - 1] * (1 - k));
    }
    
    return result;
  }

  private rsi(values: number[], period: number): number[] {
    if (values.length < period + 1) return [];
    
    const changes = this.calculateReturns(values);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    
    let avgGain = this.mean(gains.slice(0, period));
    let avgLoss = this.mean(losses.slice(0, period));
    
    const result: number[] = [];
    
    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
    
    return result;
  }

  private bollingerBands(
    values: number[],
    period: number,
    stdDev: number
  ): { upper: number; middle: number; lower: number }[] {
    if (values.length < period) return [];
    
    const result: { upper: number; middle: number; lower: number }[] = [];
    
    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);
      const middle = this.mean(slice);
      const std = this.std(slice);
      
      result.push({
        middle,
        upper: middle + stdDev * std,
        lower: middle - stdDev * std
      });
    }
    
    return result;
  }

  private atr(candles: CandleData[], period: number): number[] {
    if (candles.length < period + 1) return [];
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
      
      trueRanges.push(tr);
    }
    
    return this.sma(trueRanges, period);
  }

  /**
   * UTILITY METHODS
   */

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(prices[i] / prices[i - 1] - 1);
    }
    return returns;
  }

  private mean(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private std(values: number[]): number {
    const avg = this.mean(values);
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squaredDiffs));
  }

  private correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    let numerator = 0;
    let sumSquareX = 0;
    let sumSquareY = 0;
    
    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      
      numerator += diffX * diffY;
      sumSquareX += diffX * diffX;
      sumSquareY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(sumSquareX * sumSquareY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Get feature importance scores
   */
  getFeatureImportance(): FeatureImportance[] {
    const importance: FeatureImportance[] = [];
    
    for (const [featureName, score] of this.featureImportance.entries()) {
      importance.push({
        featureName,
        importance: score,
        rank: 0, // Will be set after sorting
        type: this.getFeatureType(featureName),
        description: this.getFeatureDescription(featureName)
      });
    }
    
    // Sort and rank
    importance.sort((a, b) => b.importance - a.importance);
    importance.forEach((item, index) => {
      item.rank = index + 1;
    });
    
    return importance;
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    processedSamples: number;
    featureCount: number;
    scalingParameters: number;
    config: FeatureExtractionConfig;
  } {
    return {
      processedSamples: this.processedSamples,
      featureCount: this.featureStats.size,
      scalingParameters: this.scalingParams.size,
      config: this.config
    };
  }

  /**
   * Reset pipeline state
   */
  reset(): void {
    this.featureStats.clear();
    this.featureImportance.clear();
    this.scalingParams.clear();
    this.indicatorCache.clear();
    this.processedSamples = 0;
    
    console.log('🔄 Feature Engineering Pipeline reset');
  }

  private getFeatureType(featureName: string): string {
    if (featureName.includes('price') || featureName.includes('return') || featureName.includes('sma') || featureName.includes('ema')) {
      return 'price';
    } else if (featureName.includes('volume')) {
      return 'volume';
    } else if (featureName.includes('rsi') || featureName.includes('macd') || featureName.includes('bb') || featureName.includes('atr')) {
      return 'technical';
    } else if (featureName.includes('body') || featureName.includes('shadow') || featureName.includes('candle') || featureName.includes('gap')) {
      return 'price_action';
    } else {
      return 'other';
    }
  }

  private getFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'current_return': 'Current candle return (close/open - 1)',
      'current_range_pct': 'Current candle range as % of close',
      'close_position': 'Close position within current candle range',
      'price_vs_ma10': 'Current price vs 10-period moving average',
      'price_vs_ma20': 'Current price vs 20-period moving average',
      'volume_vs_avg10': 'Current volume vs 10-period average',
      'volume_vs_avg20': 'Current volume vs 20-period average',
      'rsi_normalized': 'RSI indicator normalized (0-1)',
      'macd_line_norm': 'MACD line normalized by price',
      'bb_position': 'Position within Bollinger Bands (0-1)',
      // Add more descriptions as needed
    };
    
    return descriptions[featureName] || 'Feature derived from market data';
  }
}