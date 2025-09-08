/**
 * MarketRegimeModel - Market regime detection and classification
 * 
 * Implements multiple approaches for identifying market regimes including
 * trend-based, volatility-based, and composite regime classification.
 */

import * as tf from '@tensorflow/tfjs';
import { FeatureVector } from '../features/types';

export type MarketRegime = 'BULL_TREND' | 'BEAR_TREND' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'SIDEWAYS' | 'BREAKOUT';
export type TrendRegime = 'STRONG_UPTREND' | 'WEAK_UPTREND' | 'SIDEWAYS' | 'WEAK_DOWNTREND' | 'STRONG_DOWNTREND';
export type VolatilityRegime = 'HIGH_VOL' | 'NORMAL_VOL' | 'LOW_VOL';

export interface MarketRegimeConfig {
  lookbackPeriod: number;
  volatilityWindow: number;
  trendThreshold: number;
  volatilityThreshold: number;
  confidenceThreshold: number;
  updateFrequency: number; // minutes
}

export interface RegimeClassification {
  primaryRegime: MarketRegime;
  trendRegime: TrendRegime;
  volatilityRegime: VolatilityRegime;
  confidence: number;
  strength: number; // 0-1 indicating regime strength
  timeInRegime: number; // minutes since regime started
  regimeScore: Record<MarketRegime, number>;
  indicators: {
    trendStrength: number;
    volatilityLevel: number;
    momentum: number;
    support: number;
    resistance: number;
  };
  nextRegimeProb: Record<MarketRegime, number>;
}

export interface RegimeTransition {
  fromRegime: MarketRegime;
  toRegime: MarketRegime;
  probability: number;
  timeHorizon: number; // minutes
  triggerLevel: number;
  confidence: number;
}

export class MarketRegimeModel {
  private config: MarketRegimeConfig;
  private currentRegime: MarketRegime = 'SIDEWAYS';
  private regimeHistory: { regime: MarketRegime; timestamp: Date; confidence: number }[] = [];
  private regimeStartTime: Date = new Date();
  private model: tf.LayersModel | null = null;
  private isInitialized = false;
  
  // Regime statistics
  private regimeStats = {
    transitions: new Map<string, number>(),
    averageDuration: new Map<MarketRegime, number>(),
    successRate: new Map<MarketRegime, number>(),
    volatilityByRegime: new Map<MarketRegime, number>()
  };

  // Technical indicators for regime detection
  private indicators = {
    ema20: 0,
    ema50: 0,
    ema200: 0,
    atr: 0,
    rsi: 0,
    macd: 0,
    bb_upper: 0,
    bb_lower: 0,
    vwap: 0
  };

  constructor(config: MarketRegimeConfig) {
    this.config = config;
    this.initializeRegimeStats();
  }

  /**
   * Initialize the regime detection model
   */
  async initialize(): Promise<void> {
    try {
      console.log('🏛️ Initializing Market Regime Model...');
      
      // Build neural network for regime classification
      this.model = this.buildRegimeClassifier();
      
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'sparseCategoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.isInitialized = true;
      console.log('✅ Market Regime Model initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Market Regime Model:', error);
      throw error;
    }
  }

  /**
   * Classify current market regime from features
   */
  async classifyRegime(
    features: FeatureVector[],
    currentPrice: number,
    volume: number,
    symbol: string
  ): Promise<RegimeClassification> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Update technical indicators
      this.updateIndicators(features, currentPrice, volume);
      
      // Calculate regime probabilities
      const regimeScores = this.calculateRegimeScores(features);
      
      // Determine primary regime
      const primaryRegime = this.selectPrimaryRegime(regimeScores);
      const confidence = regimeScores[primaryRegime];
      
      // Calculate trend and volatility regimes
      const trendRegime = this.classifyTrend(features);
      const volatilityRegime = this.classifyVolatility(features);
      
      // Update regime tracking
      this.updateRegimeTracking(primaryRegime, confidence);
      
      // Calculate regime strength
      const strength = this.calculateRegimeStrength(primaryRegime, features);
      
      // Calculate time in current regime
      const timeInRegime = Math.floor((Date.now() - this.regimeStartTime.getTime()) / 60000);
      
      // Calculate regime transition probabilities
      const nextRegimeProb = this.calculateTransitionProbabilities(primaryRegime);

      return {
        primaryRegime,
        trendRegime,
        volatilityRegime,
        confidence,
        strength,
        timeInRegime,
        regimeScore: regimeScores,
        indicators: {
          trendStrength: this.calculateTrendStrength(),
          volatilityLevel: this.calculateVolatilityLevel(features),
          momentum: this.calculateMomentum(features),
          support: this.findSupportLevel(features),
          resistance: this.findResistanceLevel(features)
        },
        nextRegimeProb
      };

    } catch (error) {
      console.error('❌ Regime classification failed:', error);
      throw error;
    }
  }

  /**
   * Predict regime transitions
   */
  async predictRegimeTransition(
    currentClassification: RegimeClassification,
    timeHorizon: number = 60 // minutes
  ): Promise<RegimeTransition[]> {
    const transitions: RegimeTransition[] = [];
    const currentRegime = currentClassification.primaryRegime;

    // Get historical transition patterns
    const historicalTransitions = this.getHistoricalTransitions(currentRegime);
    
    for (const [targetRegime, probability] of Object.entries(historicalTransitions)) {
      if (targetRegime !== currentRegime && probability > 0.1) {
        
        const transition: RegimeTransition = {
          fromRegime: currentRegime,
          toRegime: targetRegime as MarketRegime,
          probability: probability * this.adjustProbabilityForCurrentConditions(
            currentClassification,
            targetRegime as MarketRegime
          ),
          timeHorizon,
          triggerLevel: this.calculateTriggerLevel(currentRegime, targetRegime as MarketRegime),
          confidence: Math.min(0.95, probability * currentClassification.confidence)
        };

        transitions.push(transition);
      }
    }

    return transitions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get regime statistics and performance
   */
  getRegimeStats() {
    return {
      currentRegime: this.currentRegime,
      regimeHistory: this.regimeHistory.slice(-50), // Last 50 regime changes
      stats: {
        transitions: Object.fromEntries(this.regimeStats.transitions),
        averageDuration: Object.fromEntries(this.regimeStats.averageDuration),
        successRate: Object.fromEntries(this.regimeStats.successRate),
        volatilityByRegime: Object.fromEntries(this.regimeStats.volatilityByRegime)
      },
      indicators: this.indicators
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private buildRegimeClassifier(): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer - technical indicators and market features
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [15] // 15 key features
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.1 }));

    // Output layer - 6 regime classes
    model.add(tf.layers.dense({
      units: 6, // Number of MarketRegime types
      activation: 'softmax'
    }));

    return model;
  }

  private updateIndicators(features: FeatureVector[], currentPrice: number, volume: number): void {
    if (features.length === 0) return;

    const latest = features[features.length - 1];
    
    // Update EMAs (simplified)
    this.indicators.ema20 = latest.technical.ema_20 || currentPrice;
    this.indicators.ema50 = latest.technical.ema_50 || currentPrice;
    this.indicators.ema200 = latest.technical.ema_200 || currentPrice;
    
    // Update other indicators
    this.indicators.atr = latest.technical.atr || 0.01;
    this.indicators.rsi = latest.technical.rsi || 50;
    this.indicators.macd = latest.technical.macd || 0;
    this.indicators.bb_upper = latest.technical.bb_upper || currentPrice * 1.02;
    this.indicators.bb_lower = latest.technical.bb_lower || currentPrice * 0.98;
    this.indicators.vwap = latest.technical.vwap || currentPrice;
  }

  private calculateRegimeScores(features: FeatureVector[]): Record<MarketRegime, number> {
    const scores: Record<MarketRegime, number> = {
      BULL_TREND: 0,
      BEAR_TREND: 0,
      HIGH_VOLATILITY: 0,
      LOW_VOLATILITY: 0,
      SIDEWAYS: 0,
      BREAKOUT: 0
    };

    // Trend analysis
    const trendScore = this.calculateTrendStrength();
    if (trendScore > 0.6) {
      scores.BULL_TREND = trendScore;
    } else if (trendScore < -0.6) {
      scores.BEAR_TREND = Math.abs(trendScore);
    } else {
      scores.SIDEWAYS = 1 - Math.abs(trendScore);
    }

    // Volatility analysis
    const volLevel = this.calculateVolatilityLevel(features);
    if (volLevel > 0.7) {
      scores.HIGH_VOLATILITY = volLevel;
    } else if (volLevel < 0.3) {
      scores.LOW_VOLATILITY = 1 - volLevel;
    }

    // Breakout detection
    const breakoutScore = this.detectBreakout(features);
    scores.BREAKOUT = breakoutScore;

    // Normalize scores
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (total > 0) {
      Object.keys(scores).forEach(key => {
        scores[key as MarketRegime] /= total;
      });
    }

    return scores;
  }

  private selectPrimaryRegime(regimeScores: Record<MarketRegime, number>): MarketRegime {
    let maxScore = 0;
    let primaryRegime: MarketRegime = 'SIDEWAYS';

    for (const [regime, score] of Object.entries(regimeScores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryRegime = regime as MarketRegime;
      }
    }

    return primaryRegime;
  }

  private classifyTrend(features: FeatureVector[]): TrendRegime {
    const trendStrength = this.calculateTrendStrength();
    
    if (trendStrength > 0.8) return 'STRONG_UPTREND';
    if (trendStrength > 0.3) return 'WEAK_UPTREND';
    if (trendStrength < -0.8) return 'STRONG_DOWNTREND';
    if (trendStrength < -0.3) return 'WEAK_DOWNTREND';
    
    return 'SIDEWAYS';
  }

  private classifyVolatility(features: FeatureVector[]): VolatilityRegime {
    const volLevel = this.calculateVolatilityLevel(features);
    
    if (volLevel > 0.7) return 'HIGH_VOL';
    if (volLevel < 0.3) return 'LOW_VOL';
    
    return 'NORMAL_VOL';
  }

  private calculateTrendStrength(): number {
    const { ema20, ema50, ema200 } = this.indicators;
    
    // Simple trend strength calculation
    let strength = 0;
    
    if (ema20 > ema50) strength += 0.3;
    if (ema50 > ema200) strength += 0.3;
    if (ema20 > ema200) strength += 0.4;
    
    if (ema20 < ema50) strength -= 0.3;
    if (ema50 < ema200) strength -= 0.3;
    if (ema20 < ema200) strength -= 0.4;
    
    return Math.max(-1, Math.min(1, strength));
  }

  private calculateVolatilityLevel(features: FeatureVector[]): number {
    if (features.length < 20) return 0.5;
    
    // Calculate rolling volatility
    const recent = features.slice(-20);
    const prices = recent.map(f => f.price.close || 0).filter(p => p > 0);
    
    if (prices.length < 2) return 0.5;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const variance = returns.reduce((sum, r) => {
      const mean = returns.reduce((s, ret) => s + ret, 0) / returns.length;
      return sum + Math.pow(r - mean, 2);
    }, 0) / returns.length;
    
    const volatility = Math.sqrt(variance * 252); // Annualized
    
    // Normalize to 0-1 scale (assuming max vol of 100%)
    return Math.min(1, volatility);
  }

  private calculateMomentum(features: FeatureVector[]): number {
    if (features.length < 10) return 0;
    
    const recent = features.slice(-10);
    const rsiSum = recent.reduce((sum, f) => sum + (f.technical.rsi || 50), 0);
    const avgRsi = rsiSum / recent.length;
    
    // Normalize RSI to momentum scale (-1 to 1)
    return (avgRsi - 50) / 50;
  }

  private detectBreakout(features: FeatureVector[]): number {
    if (features.length < 20) return 0;
    
    const latest = features[features.length - 1];
    const price = latest.price.close || 0;
    
    // Simple breakout detection using Bollinger Bands
    const { bb_upper, bb_lower } = this.indicators;
    
    if (price > bb_upper) {
      return Math.min(1, (price - bb_upper) / bb_upper);
    } else if (price < bb_lower) {
      return Math.min(1, (bb_lower - price) / bb_lower);
    }
    
    return 0;
  }

  private findSupportLevel(features: FeatureVector[]): number {
    if (features.length < 50) return 0;
    
    const recent = features.slice(-50);
    const lows = recent.map(f => f.price.low || 0).filter(l => l > 0);
    
    return Math.min(...lows);
  }

  private findResistanceLevel(features: FeatureVector[]): number {
    if (features.length < 50) return 0;
    
    const recent = features.slice(-50);
    const highs = recent.map(f => f.price.high || 0).filter(h => h > 0);
    
    return Math.max(...highs);
  }

  private updateRegimeTracking(regime: MarketRegime, confidence: number): void {
    if (this.currentRegime !== regime) {
      // Regime changed
      const transition = `${this.currentRegime}->${regime}`;
      const current = this.regimeStats.transitions.get(transition) || 0;
      this.regimeStats.transitions.set(transition, current + 1);
      
      // Update regime history
      this.regimeHistory.push({
        regime: this.currentRegime,
        timestamp: new Date(),
        confidence
      });
      
      // Update current regime
      this.currentRegime = regime;
      this.regimeStartTime = new Date();
      
      // Keep history manageable
      if (this.regimeHistory.length > 100) {
        this.regimeHistory = this.regimeHistory.slice(-50);
      }
    }
  }

  private calculateRegimeStrength(regime: MarketRegime, features: FeatureVector[]): number {
    switch (regime) {
      case 'BULL_TREND':
      case 'BEAR_TREND':
        return Math.abs(this.calculateTrendStrength());
      
      case 'HIGH_VOLATILITY':
      case 'LOW_VOLATILITY':
        const volLevel = this.calculateVolatilityLevel(features);
        return regime === 'HIGH_VOLATILITY' ? volLevel : (1 - volLevel);
      
      case 'SIDEWAYS':
        return 1 - Math.abs(this.calculateTrendStrength());
      
      case 'BREAKOUT':
        return this.detectBreakout(features);
      
      default:
        return 0.5;
    }
  }

  private calculateTransitionProbabilities(currentRegime: MarketRegime): Record<MarketRegime, number> {
    const probs: Record<MarketRegime, number> = {
      BULL_TREND: 0,
      BEAR_TREND: 0,
      HIGH_VOLATILITY: 0,
      LOW_VOLATILITY: 0,
      SIDEWAYS: 0,
      BREAKOUT: 0
    };

    // Base transition probabilities (simplified)
    const transitionMatrix: Record<MarketRegime, Record<MarketRegime, number>> = {
      BULL_TREND: { SIDEWAYS: 0.4, HIGH_VOLATILITY: 0.2, BREAKOUT: 0.2, BEAR_TREND: 0.1, LOW_VOLATILITY: 0.1, BULL_TREND: 0 },
      BEAR_TREND: { SIDEWAYS: 0.4, HIGH_VOLATILITY: 0.2, BREAKOUT: 0.1, BULL_TREND: 0.1, LOW_VOLATILITY: 0.2, BEAR_TREND: 0 },
      SIDEWAYS: { BULL_TREND: 0.3, BEAR_TREND: 0.3, BREAKOUT: 0.2, HIGH_VOLATILITY: 0.1, LOW_VOLATILITY: 0.1, SIDEWAYS: 0 },
      HIGH_VOLATILITY: { SIDEWAYS: 0.4, BREAKOUT: 0.3, BULL_TREND: 0.15, BEAR_TREND: 0.15, LOW_VOLATILITY: 0, HIGH_VOLATILITY: 0 },
      LOW_VOLATILITY: { SIDEWAYS: 0.5, HIGH_VOLATILITY: 0.3, BULL_TREND: 0.1, BEAR_TREND: 0.1, BREAKOUT: 0, LOW_VOLATILITY: 0 },
      BREAKOUT: { BULL_TREND: 0.4, BEAR_TREND: 0.3, HIGH_VOLATILITY: 0.2, SIDEWAYS: 0.1, LOW_VOLATILITY: 0, BREAKOUT: 0 }
    };

    return transitionMatrix[currentRegime] || probs;
  }

  private getHistoricalTransitions(fromRegime: MarketRegime): Record<string, number> {
    const transitions: Record<string, number> = {};
    let totalFromRegime = 0;

    // Count transitions from current regime
    for (const [transition, count] of this.regimeStats.transitions.entries()) {
      if (transition.startsWith(fromRegime)) {
        const toRegime = transition.split('->')[1];
        transitions[toRegime] = count;
        totalFromRegime += count;
      }
    }

    // Convert to probabilities
    if (totalFromRegime > 0) {
      Object.keys(transitions).forEach(regime => {
        transitions[regime] /= totalFromRegime;
      });
    }

    return transitions;
  }

  private adjustProbabilityForCurrentConditions(
    classification: RegimeClassification,
    targetRegime: MarketRegime
  ): number {
    // Adjust based on current regime strength and indicators
    let adjustment = 1.0;
    
    // Strong regimes are less likely to transition
    if (classification.strength > 0.8) {
      adjustment *= 0.5;
    }
    
    // High confidence regimes are more stable
    if (classification.confidence > 0.8) {
      adjustment *= 0.7;
    }
    
    // Recent regime changes reduce transition probability
    if (classification.timeInRegime < 30) { // Less than 30 minutes
      adjustment *= 0.6;
    }

    return adjustment;
  }

  private calculateTriggerLevel(fromRegime: MarketRegime, toRegime: MarketRegime): number {
    // Simplified trigger level calculation
    const basePrice = this.indicators.ema20;
    const atr = this.indicators.atr;
    
    switch (toRegime) {
      case 'BULL_TREND':
        return basePrice + (atr * 2);
      case 'BEAR_TREND':
        return basePrice - (atr * 2);
      case 'BREAKOUT':
        return Math.max(this.indicators.bb_upper, this.indicators.bb_lower);
      default:
        return basePrice;
    }
  }

  private initializeRegimeStats(): void {
    const regimes: MarketRegime[] = ['BULL_TREND', 'BEAR_TREND', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'SIDEWAYS', 'BREAKOUT'];
    
    regimes.forEach(regime => {
      this.regimeStats.averageDuration.set(regime, 0);
      this.regimeStats.successRate.set(regime, 0);
      this.regimeStats.volatilityByRegime.set(regime, 0);
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
}

// Default configuration
export const DEFAULT_REGIME_CONFIG: MarketRegimeConfig = {
  lookbackPeriod: 100,
  volatilityWindow: 20,
  trendThreshold: 0.6,
  volatilityThreshold: 0.7,
  confidenceThreshold: 0.7,
  updateFrequency: 5
};