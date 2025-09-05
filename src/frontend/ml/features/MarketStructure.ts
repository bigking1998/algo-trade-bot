/**
 * Market Structure Features Implementation - Task ML-002
 * 
 * Market regime detection, trend classification, and volatility analysis
 * for ML-enhanced trading strategies with regime adaptation.
 */

import { OHLCV, MarketStructureFeatures, MarketRegime, TrendClassification, VolatilityRegime } from './types';

/**
 * Market structure analysis options
 */
interface MarketStructureOptions {
  trend_lookback?: number;
  volatility_period?: number;
  regime_confidence_threshold?: number;
  trend_strength_threshold?: number;
  volatility_threshold?: { low: number; high: number };
}

/**
 * Default market structure options
 */
const DEFAULT_STRUCTURE_OPTIONS: MarketStructureOptions = {
  trend_lookback: 20,
  volatility_period: 20,
  regime_confidence_threshold: 0.7,
  trend_strength_threshold: 0.6,
  volatility_threshold: { low: 0.3, high: 0.7 }
};

/**
 * Market structure and regime analysis engine
 */
export class MarketStructure {
  private options: MarketStructureOptions;

  constructor(options: Partial<MarketStructureOptions> = {}) {
    this.options = { ...DEFAULT_STRUCTURE_OPTIONS, ...options };
  }

  /**
   * Calculate all market structure features
   */
  calculateMarketStructureFeatures(data: OHLCV[]): MarketStructureFeatures {
    if (data.length === 0) {
      return this.createEmptyFeatures();
    }

    const features: MarketStructureFeatures = {};

    try {
      // Market regime detection
      const regime = this.detectMarketRegime(data);
      features.regime_trending = regime.type === 'trending' ? 1 : 0;
      features.regime_ranging = regime.type === 'ranging' ? 1 : 0;
      features.regime_volatile = regime.type === 'volatile' ? 1 : 0;
      features.regime_confidence = this.calculateRegimeConfidence(data, regime);

      // Trend classification
      const trendClass = this.classifyTrend(data);
      features.trend_direction = this.encodeTrendDirection(trendClass.direction);
      features.trend_strength = trendClass.strength;
      features.trend_duration = trendClass.duration;

      // Volatility regime
      const volRegime = this.analyzeVolatilityRegime(data);
      features.volatility_regime = this.encodeVolatilityRegime(volRegime.level);
      features.volatility_percentile = volRegime.percentile / 100;
      features.volatility_clustering = volRegime.clustering ? 1 : 0;

      // Microstructure features (placeholder - would require order book data)
      features.bid_ask_spread = 0; // Would be calculated from order book
      features.market_impact = 0;  // Would be calculated from trade data
      features.liquidity_score = 0.5; // Default neutral score

    } catch (error) {
      console.warn('[MarketStructure] Error calculating market structure features:', error);
    }

    return features;
  }

  /**
   * Detect current market regime
   */
  detectMarketRegime(data: OHLCV[]): MarketRegime {
    if (data.length < 20) {
      return { type: 'ranging', width: 0, center: 0 };
    }

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    // Calculate trend strength and volatility
    const trendStrength = this.calculateTrendStrength(closes);
    const volatility = this.calculateRecentVolatility(data);
    const rangeAnalysis = this.analyzeRange(highs, lows, closes);

    // Regime classification logic
    if (trendStrength > 0.7 && !rangeAnalysis.isRangebound) {
      const direction = closes[closes.length - 1] > closes[closes.length - 20] ? 'up' : 'down';
      return { type: 'trending', direction, strength: trendStrength };
    }

    if (volatility > 0.8) {
      return { type: 'volatile', intensity: volatility };
    }

    // Default to ranging regime
    return {
      type: 'ranging',
      width: rangeAnalysis.rangeWidth,
      center: rangeAnalysis.rangeCenter
    };
  }

  /**
   * Classify trend characteristics
   */
  classifyTrend(data: OHLCV[]): TrendClassification {
    const closes = data.map(d => d.close);
    const lookback = Math.min(this.options.trend_lookback || 20, data.length);
    
    if (lookback < 10) {
      return {
        direction: 'sideways',
        strength: 0,
        duration: 0,
        confidence: 0,
        turning_point_probability: 0.5
      };
    }

    const recentCloses = closes.slice(-lookback);
    
    // Calculate trend direction and strength
    const { direction, strength } = this.analyzeTrendDirection(recentCloses);
    const duration = this.calculateTrendDuration(closes);
    const confidence = this.calculateTrendConfidence(recentCloses, direction);
    const turningPointProb = this.calculateTurningPointProbability(data);

    return {
      direction,
      strength,
      duration,
      confidence,
      turning_point_probability: turningPointProb
    };
  }

  /**
   * Analyze volatility regime
   */
  analyzeVolatilityRegime(data: OHLCV[]): VolatilityRegime {
    const period = this.options.volatility_period || 20;
    
    if (data.length < period) {
      return {
        level: 'medium',
        percentile: 50,
        clustering: false,
        mean_reversion_speed: 0.5,
        persistence: 0.5
      };
    }

    const closes = data.map(d => d.close);
    const returns = this.calculateReturns(closes);
    const volatility = this.calculateRollingVolatility(returns, period);
    
    // Analyze volatility characteristics
    const currentVol = volatility[volatility.length - 1];
    const percentile = this.calculatePercentile(volatility, currentVol);
    const clustering = this.detectVolatilityClustering(volatility);
    const meanReversionSpeed = this.calculateMeanReversionSpeed(volatility);
    const persistence = this.calculateVolatilityPersistence(volatility);

    // Classify volatility level
    const threshold = this.options.volatility_threshold!;
    let level: 'low' | 'medium' | 'high';
    
    if (percentile < threshold.low) {
      level = 'low';
    } else if (percentile > threshold.high) {
      level = 'high';
    } else {
      level = 'medium';
    }

    return {
      level,
      percentile,
      clustering,
      mean_reversion_speed: meanReversionSpeed,
      persistence
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private calculateTrendStrength(closes: number[]): number {
    if (closes.length < 10) return 0;

    const lookback = Math.min(20, closes.length);
    const recentCloses = closes.slice(-lookback);
    
    // Calculate linear regression slope
    const n = recentCloses.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = recentCloses;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgPrice = sumY / n;
    
    // Normalize slope to 0-1 scale
    const normalizedSlope = Math.abs(slope) / avgPrice;
    return Math.min(1, normalizedSlope * 100);
  }

  private calculateRecentVolatility(data: OHLCV[]): number {
    if (data.length < 10) return 0;

    const closes = data.slice(-20).map(d => d.close);
    const returns = this.calculateReturns(closes);
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Normalize to 0-1 scale (multiply by 100 for percentage, then scale)
    return Math.min(1, volatility * 100);
  }

  private analyzeRange(highs: number[], lows: number[], closes: number[]): {
    isRangebound: boolean;
    rangeWidth: number;
    rangeCenter: number;
  } {
    const lookback = Math.min(50, highs.length);
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    const recentCloses = closes.slice(-lookback);
    
    const maxHigh = Math.max(...recentHighs);
    const minLow = Math.min(...recentLows);
    const rangeWidth = (maxHigh - minLow) / minLow; // Percentage range
    const rangeCenter = (maxHigh + minLow) / 2;
    
    // Check if price is staying within range
    const breakthroughs = recentCloses.filter(close => 
      close > maxHigh * 0.98 || close < minLow * 1.02
    ).length;
    
    const isRangebound = rangeWidth < 0.1 && breakthroughs < lookback * 0.1; // Less than 10% breakthroughs
    
    return { isRangebound, rangeWidth, rangeCenter };
  }

  private analyzeTrendDirection(closes: number[]): { 
    direction: 'up' | 'down' | 'sideways'; 
    strength: number; 
  } {
    const n = closes.length;
    const firstThird = closes.slice(0, Math.floor(n / 3));
    const lastThird = closes.slice(Math.floor(2 * n / 3));
    
    const firstAvg = firstThird.reduce((sum, c) => sum + c, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((sum, c) => sum + c, 0) / lastThird.length;
    
    const change = (lastAvg - firstAvg) / firstAvg;
    const strength = Math.min(1, Math.abs(change) * 10); // Scale to 0-1
    
    if (Math.abs(change) < 0.02) { // Less than 2% change
      return { direction: 'sideways', strength: 0 };
    }
    
    return {
      direction: change > 0 ? 'up' : 'down',
      strength
    };
  }

  private calculateTrendDuration(closes: number[]): number {
    // Simplified trend duration calculation
    // In practice, would track trend changes over time
    if (closes.length < 20) return 0;
    
    const recent = closes.slice(-20);
    const older = closes.slice(-40, -20);
    
    if (older.length === 0) return 0;
    
    const recentTrend = recent[recent.length - 1] > recent[0];
    const olderTrend = older[older.length - 1] > older[0];
    
    return recentTrend === olderTrend ? 2 : 1; // Simplified: 1 or 2 periods
  }

  private calculateTrendConfidence(closes: number[], direction: 'up' | 'down' | 'sideways'): number {
    if (direction === 'sideways') return 0.5;
    
    // Count how many periods support the trend
    let supportingPeriods = 0;
    for (let i = 1; i < closes.length; i++) {
      const localTrend = closes[i] > closes[i - 1];
      const supportsDirection = (direction === 'up' && localTrend) || (direction === 'down' && !localTrend);
      if (supportsDirection) supportingPeriods++;
    }
    
    return supportingPeriods / (closes.length - 1);
  }

  private calculateTurningPointProbability(data: OHLCV[]): number {
    // Simplified turning point analysis
    if (data.length < 20) return 0.5;
    
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    // Check for reversal signals
    let reversalSignals = 0;
    
    // Volume divergence
    const recentVolume = volumes.slice(-5).reduce((sum, v) => sum + v, 0) / 5;
    const olderVolume = volumes.slice(-10, -5).reduce((sum, v) => sum + v, 0) / 5;
    if (recentVolume > olderVolume * 1.5) reversalSignals++;
    
    // Price momentum divergence
    const recentMomentum = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];
    const olderMomentum = (closes[closes.length - 5] - closes[closes.length - 10]) / closes[closes.length - 10];
    if (Math.sign(recentMomentum) !== Math.sign(olderMomentum)) reversalSignals++;
    
    return Math.min(1, reversalSignals / 4); // Maximum 4 signals
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] !== 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    return returns;
  }

  private calculateRollingVolatility(returns: number[], window: number): number[] {
    const volatility: number[] = [];
    
    for (let i = window - 1; i < returns.length; i++) {
      const windowReturns = returns.slice(i - window + 1, i + 1);
      const mean = windowReturns.reduce((sum, r) => sum + r, 0) / windowReturns.length;
      const variance = windowReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / windowReturns.length;
      volatility.push(Math.sqrt(variance));
    }
    
    return volatility;
  }

  private calculatePercentile(values: number[], target: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= target);
    
    if (index === -1) return 100; // Target is higher than all values
    
    return (index / sorted.length) * 100;
  }

  private detectVolatilityClustering(volatility: number[]): boolean {
    if (volatility.length < 10) return false;
    
    // Simple clustering detection: check if high volatility periods cluster together
    let clusters = 0;
    let inCluster = false;
    // Check if current volatility is above 70th percentile 
    const _highVolThreshold = this.calculatePercentile(volatility, volatility[volatility.length - 1]) > 70;
    
    for (const vol of volatility.slice(-20)) {
      const isHighVol = vol > volatility.reduce((sum, v) => sum + v, 0) / volatility.length;
      
      if (isHighVol && !inCluster) {
        clusters++;
        inCluster = true;
      } else if (!isHighVol) {
        inCluster = false;
      }
    }
    
    return clusters > 2; // More than 2 clusters indicates clustering
  }

  private calculateMeanReversionSpeed(volatility: number[]): number {
    if (volatility.length < 10) return 0.5;
    
    // Simplified mean reversion calculation
    const mean = volatility.reduce((sum, v) => sum + v, 0) / volatility.length;
    let reversionEvents = 0;
    
    for (let i = 1; i < volatility.length; i++) {
      const current = volatility[i];
      const previous = volatility[i - 1];
      
      // Check if moving toward mean
      if ((previous > mean && current < previous) || (previous < mean && current > previous)) {
        reversionEvents++;
      }
    }
    
    return reversionEvents / (volatility.length - 1);
  }

  private calculateVolatilityPersistence(volatility: number[]): number {
    if (volatility.length < 5) return 0.5;
    
    // Calculate autocorrelation at lag 1
    const n = volatility.length;
    const mean = volatility.reduce((sum, v) => sum + v, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 1; i < n; i++) {
      numerator += (volatility[i - 1] - mean) * (volatility[i] - mean);
    }
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(volatility[i] - mean, 2);
    }
    
    return denominator > 0 ? Math.abs(numerator / denominator) : 0;
  }

  private calculateRegimeConfidence(data: OHLCV[], regime: MarketRegime): number {
    // Simplified confidence calculation based on regime characteristics
    const lookback = Math.min(20, data.length);
    if (lookback < 10) return 0.5;
    
    const closes = data.slice(-lookback).map(d => d.close);
    const volatility = this.calculateRecentVolatility(data.slice(-lookback));
    const trendStrength = this.calculateTrendStrength(closes);
    
    switch (regime.type) {
      case 'trending':
        return trendStrength > 0.6 ? 0.8 : 0.5;
      case 'volatile':
        return volatility > 0.7 ? 0.8 : 0.5;
      case 'ranging':
        return (trendStrength < 0.3 && volatility < 0.5) ? 0.8 : 0.5;
      default:
        return 0.5;
    }
  }

  private encodeTrendDirection(direction: 'up' | 'down' | 'sideways'): number {
    switch (direction) {
      case 'up': return 1;
      case 'down': return -1;
      case 'sideways': return 0;
    }
  }

  private encodeVolatilityRegime(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low': return 0;
      case 'medium': return 0.5;
      case 'high': return 1;
    }
  }

  private createEmptyFeatures(): MarketStructureFeatures {
    return {
      regime_trending: 0,
      regime_ranging: 0,
      regime_volatile: 0,
      regime_confidence: 0.5,
      trend_direction: 0,
      trend_strength: 0,
      trend_duration: 0,
      volatility_regime: 0.5,
      volatility_percentile: 0.5,
      volatility_clustering: 0
    };
  }
}