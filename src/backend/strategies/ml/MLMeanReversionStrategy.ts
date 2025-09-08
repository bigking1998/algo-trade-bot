/**
 * ML-Powered Mean Reversion Strategy - Task BE-026: ML Strategy Templates
 * 
 * Advanced mean reversion strategy enhanced with machine learning for:
 * - Statistical arbitrage detection and validation
 * - Dynamic mean calculation and adaptation  
 * - Optimal reversal point prediction
 * - Multi-asset mean reversion opportunities
 * - Adaptive parameter optimization based on market regime
 */

import { BaseMLStrategy, MLStrategyConfig, MLPrediction } from './BaseMLStrategy.js';
import { StrategyContext, StrategySignal } from '../types.js';

/**
 * ML Mean Reversion Strategy configuration
 */
export interface MLMeanReversionConfig extends MLStrategyConfig {
  meanReversion: {
    // Statistical parameters
    lookbackPeriod: number; // Period for mean calculation
    deviationThreshold: number; // Standard deviations for entry signal
    reversionConfidence: number; // ML confidence for reversion signals
    
    // Mean calculation methods
    meanMethod: 'SMA' | 'EMA' | 'ADAPTIVE' | 'ML_PREDICTED';
    adaptivePeriod: boolean; // Adapt lookback period based on volatility
    volatilityAdjusted: boolean; // Adjust thresholds based on volatility
    
    // Multi-timeframe analysis
    timeframes: string[]; // e.g., ['5m', '15m', '1h']
    timeframeScoring: boolean; // Use multiple timeframes for scoring
    
    // Statistical validation
    stationarityTest: boolean; // Test for mean reversion properties
    halfLifeAnalysis: boolean; // Calculate mean reversion half-life
    zScoreThreshold: number; // Z-score threshold for extreme values
    
    // Market regime awareness
    regimeFiltering: boolean; // Filter trades by market regime
    volatilityRegimeAware: boolean; // Adjust strategy for volatility regime
    trendRegimeFilter: boolean; // Avoid reversion in strong trends
    
    // Risk management
    maxHoldingPeriod: number; // Maximum holding period in minutes
    stopLossMultiplier: number; // Stop loss as multiple of entry deviation
    takeProfitRatio: number; // Take profit as ratio of expected reversion
    correlationBasedSizing: boolean; // Size based on correlation with other assets
    
    // Performance optimization
    dynamicThresholds: boolean; // Dynamically adjust thresholds
    learningDecay: number; // Decay factor for adaptive learning
    performanceMemory: number; // Number of trades to remember for adaptation
  };
}

/**
 * Mean reversion analysis result
 */
interface MeanReversionAnalysis {
  currentPrice: number;
  meanPrice: number;
  deviation: number;
  standardDeviation: number;
  zScore: number;
  reversionProbability: number;
  halfLife: number; // Expected time to revert (minutes)
  stationarity: {
    isStationary: boolean;
    pValue: number;
    testStatistic: number;
  };
  marketRegime: {
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    trend: 'STRONG_UP' | 'WEAK_UP' | 'SIDEWAYS' | 'WEAK_DOWN' | 'STRONG_DOWN';
    suitability: number; // 0-1, how suitable for mean reversion
  };
  supportResistance: {
    nearestSupport: number;
    nearestResistance: number;
    supportStrength: number;
    resistanceStrength: number;
  };
  correlations: Record<string, number>; // Correlations with other assets
  expectedReversion: {
    targetPrice: number;
    confidence: number;
    timeHorizon: number; // Expected time to target
  };
}

/**
 * ML-Powered Mean Reversion Strategy
 */
export class MLMeanReversionStrategy extends BaseMLStrategy {
  private meanRevConfig: MLMeanReversionConfig['meanReversion'];
  private analysisHistory: Array<{
    timestamp: Date;
    analysis: MeanReversionAnalysis;
  }> = [];
  
  private adaptiveThresholds = {
    deviation: 2.0,
    confidence: 0.7,
    zScore: 2.0
  };
  
  private recentTrades: Array<{
    timestamp: Date;
    signal: StrategySignal;
    outcome?: 'WIN' | 'LOSS';
    actualReversion?: number;
    timeToReversion?: number;
  }> = [];

  constructor(config: MLMeanReversionConfig) {
    super({
      ...config,
      ml: {
        ...config.ml,
        modelTypes: ['PRICE_PREDICTION', 'VOLATILITY', 'MARKET_REGIME'],
        featureEngineeringConfig: {
          technicalIndicators: [
            'sma_20', 'sma_50', 'ema_20', 'ema_50',
            'bollinger_upper', 'bollinger_lower', 'bollinger_width',
            'rsi', 'stoch_k', 'stoch_d', 'williams_r',
            'atr', 'volatility', 'variance',
            'mean_reversion_oscilator', 'z_score',
            'correlation_btc', 'correlation_eth'
          ],
          lookbackPeriods: [10, 20, 50, 100, 200],
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        },
        predictionHorizon: 30, // 30 minutes for mean reversion
        ensembleStrategy: 'STACKING' // Stacking works well for regression
      }
    });
    
    this.meanRevConfig = config.meanReversion;
  }

  /**
   * Define training strategy for mean reversion prediction models
   */
  async defineTrainingStrategy(): Promise<{
    targetVariable: string;
    featureSelection: string[];
    modelArchitecture: any;
    trainingParameters: any;
  }> {
    return {
      targetVariable: 'mean_reversion_target', // Predict mean reversion target price
      featureSelection: [
        'price_deviations', 'statistical_measures', 'volatility_indicators',
        'oscillator_readings', 'support_resistance_levels', 'volume_patterns',
        'correlation_features', 'regime_indicators', 'seasonality_features'
      ],
      modelArchitecture: {
        type: 'ENSEMBLE_REGRESSOR',
        models: [
          {
            type: 'LSTM',
            layers: [
              { type: 'LSTM', units: 64, returnSequences: true, dropout: 0.2 },
              { type: 'LSTM', units: 32, dropout: 0.2 },
              { type: 'Dense', units: 16, activation: 'relu' },
              { type: 'Dense', units: 1, activation: 'linear' }
            ]
          },
          {
            type: 'GRU',
            layers: [
              { type: 'GRU', units: 48, returnSequences: true, dropout: 0.25 },
              { type: 'GRU', units: 24, dropout: 0.25 },
              { type: 'Dense', units: 12, activation: 'relu' },
              { type: 'Dense', units: 1, activation: 'linear' }
            ]
          },
          {
            type: 'CNN_LSTM',
            layers: [
              { type: 'Conv1D', filters: 32, kernelSize: 3, activation: 'relu' },
              { type: 'LSTM', units: 32, dropout: 0.2 },
              { type: 'Dense', units: 8, activation: 'relu' },
              { type: 'Dense', units: 1, activation: 'linear' }
            ]
          }
        ],
        ensembleMethod: 'stacking',
        metaLearner: { type: 'Ridge', alpha: 0.1 }
      },
      trainingParameters: {
        sequenceLength: 30,
        batchSize: 64,
        epochs: 150,
        validationSplit: 0.25,
        earlyStoppingPatience: 15,
        lossFunction: 'mean_squared_error',
        metrics: ['mse', 'mae', 'mape']
      }
    };
  }

  /**
   * Process ML prediction into mean reversion signal
   */
  async processPrediction(prediction: MLPrediction, context: StrategyContext): Promise<StrategySignal | null> {
    // Perform comprehensive mean reversion analysis
    const analysis = await this.analyzeMeanReversion(context, prediction);
    
    // Store analysis for historical tracking
    this.storeAnalysis(analysis);
    
    // Validate mean reversion opportunity
    if (!this.validateReversionSignal(analysis, prediction, context)) {
      return null;
    }
    
    // Generate mean reversion signal
    return await this.generateReversionSignal(analysis, prediction, context);
  }

  /**
   * Validate ML prediction quality for mean reversion
   */
  validatePrediction(prediction: MLPrediction, context: StrategyContext): boolean {
    // Check confidence threshold
    if (prediction.confidence < this.meanRevConfig.reversionConfidence) {
      return false;
    }
    
    // Mean reversion works best with HOLD or weak directional signals
    // Strong directional signals suggest trending, not mean reversion
    if (prediction.signal !== 'HOLD' && prediction.confidence > 0.9) {
      return false;
    }
    
    // Check volatility - mean reversion needs reasonable volatility
    const volatility = prediction.explanation.volatilityPrediction;
    if (volatility < 0.005 || volatility > 0.08) {
      return false; // Too low or too high volatility
    }
    
    return true;
  }

  /**
   * Handle model performance degradation
   */
  async onModelDegradation(modelId: string, currentMetrics: any): Promise<void> {
    console.log(`🔄 Handling model degradation for mean reversion model ${modelId}`);
    
    // Increase thresholds to be more conservative
    this.adaptiveThresholds.deviation = Math.min(this.adaptiveThresholds.deviation * 1.3, 3.5);
    this.adaptiveThresholds.confidence = Math.min(this.adaptiveThresholds.confidence * 1.2, 0.9);
    this.adaptiveThresholds.zScore = Math.min(this.adaptiveThresholds.zScore * 1.2, 3.0);
    
    // Reduce position sizing temporarily
    // This would be implemented in the position sizing logic
    
    // Analyze recent performance to adjust parameters
    const recentPerformance = this.analyzeRecentPerformance();
    if (recentPerformance.winRate < 0.4) {
      // Significantly increase thresholds if performing poorly
      this.adaptiveThresholds.deviation *= 1.5;
      this.adaptiveThresholds.zScore *= 1.4;
    }
    
    console.log(`📊 Adjusted adaptive thresholds:`, this.adaptiveThresholds);
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  /**
   * Perform comprehensive mean reversion analysis
   */
  private async analyzeMeanReversion(
    context: StrategyContext, 
    prediction: MLPrediction
  ): Promise<MeanReversionAnalysis> {
    
    const currentPrice = context.marketData.close;
    const features = prediction.features;
    
    // Calculate mean price using specified method
    const meanPrice = this.calculateMeanPrice(context, features);
    
    // Calculate deviation metrics
    const deviation = currentPrice - meanPrice;
    const standardDeviation = this.calculateStandardDeviation(context, features);
    const zScore = deviation / standardDeviation;
    
    // Calculate reversion probability using ML prediction
    const reversionProbability = this.calculateReversionProbability(prediction, zScore);
    
    // Estimate half-life of mean reversion
    const halfLife = this.estimateHalfLife(features, context);
    
    // Perform stationarity test
    const stationarity = await this.testStationarity(context);
    
    // Analyze market regime
    const marketRegime = this.analyzeMarketRegime(features, prediction);
    
    // Identify support/resistance levels
    const supportResistance = this.analyzeSupportResistance(context, currentPrice);
    
    // Calculate correlations with other assets
    const correlations = this.calculateCorrelations(features);
    
    // Calculate expected reversion
    const expectedReversion = this.calculateExpectedReversion(
      meanPrice, currentPrice, reversionProbability, halfLife
    );
    
    return {
      currentPrice,
      meanPrice,
      deviation,
      standardDeviation,
      zScore,
      reversionProbability,
      halfLife,
      stationarity,
      marketRegime,
      supportResistance,
      correlations,
      expectedReversion
    };
  }

  /**
   * Calculate mean price using configured method
   */
  private calculateMeanPrice(context: StrategyContext, features: any): number {
    const currentPrice = context.marketData.close;
    
    switch (this.meanRevConfig.meanMethod) {
      case 'SMA':
        return features[`sma_${this.meanRevConfig.lookbackPeriod}`] || currentPrice;
        
      case 'EMA':
        return features[`ema_${this.meanRevConfig.lookbackPeriod}`] || currentPrice;
        
      case 'ADAPTIVE':
        // Adaptive period based on volatility
        const volatility = features.volatility || 0.02;
        const adaptedPeriod = Math.round(this.meanRevConfig.lookbackPeriod * (1 + volatility * 10));
        return features[`sma_${Math.min(adaptedPeriod, 200)}`] || currentPrice;
        
      case 'ML_PREDICTED':
        // Use ML model to predict the "true" mean
        return this.predictMeanPrice(features, currentPrice);
        
      default:
        return features.sma_20 || currentPrice;
    }
  }

  /**
   * Use ML to predict the equilibrium mean price
   */
  private predictMeanPrice(features: any, currentPrice: number): number {
    // Simplified ML-based mean prediction
    // In production, this would use a dedicated model
    const sma20 = features.sma_20 || currentPrice;
    const sma50 = features.sma_50 || currentPrice;
    const ema20 = features.ema_20 || currentPrice;
    
    // Weighted combination based on recent performance
    const weights = {
      sma20: 0.4,
      sma50: 0.3,
      ema20: 0.3
    };
    
    return (sma20 * weights.sma20) + (sma50 * weights.sma50) + (ema20 * weights.ema20);
  }

  /**
   * Calculate standard deviation for the lookback period
   */
  private calculateStandardDeviation(context: StrategyContext, features: any): number {
    // Use ATR as proxy for standard deviation, or calculated value if available
    const atr = features.atr || 0;
    const volatility = features.volatility || 0.02;
    
    // Combine ATR and volatility for robust measure
    return Math.max(atr, context.marketData.close * volatility);
  }

  /**
   * Calculate reversion probability combining ML and statistical signals
   */
  private calculateReversionProbability(prediction: MLPrediction, zScore: number): number {
    // Base probability from statistical z-score
    const zScoreProb = Math.min(Math.abs(zScore) / 3, 1); // Normalize to 0-1
    
    // ML prediction confidence (higher confidence in HOLD suggests mean reversion)
    const mlProb = prediction.signal === 'HOLD' ? 
      prediction.confidence : 
      1 - prediction.confidence;
    
    // Combine probabilities
    return (zScoreProb + mlProb) / 2;
  }

  /**
   * Estimate half-life of mean reversion
   */
  private estimateHalfLife(features: any, context: StrategyContext): number {
    // Simplified half-life estimation
    const volatility = features.volatility || 0.02;
    const atr = features.atr || context.marketData.close * 0.01;
    
    // Higher volatility typically means faster reversion
    // Base estimate: 30 minutes, adjusted by volatility
    return Math.max(15, 30 / (volatility * 100));
  }

  /**
   * Test for stationarity (simplified)
   */
  private async testStationarity(context: StrategyContext): Promise<{
    isStationary: boolean;
    pValue: number;
    testStatistic: number;
  }> {
    // Simplified stationarity test
    // In production, this would implement Augmented Dickey-Fuller test
    return {
      isStationary: true, // Assume stationary for now
      pValue: 0.01,
      testStatistic: -3.5
    };
  }

  /**
   * Analyze market regime for mean reversion suitability
   */
  private analyzeMarketRegime(features: any, prediction: MLPrediction): {
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    trend: 'STRONG_UP' | 'WEAK_UP' | 'SIDEWAYS' | 'WEAK_DOWN' | 'STRONG_DOWN';
    suitability: number;
  } {
    const volatility = prediction.explanation.volatilityPrediction;
    const marketRegime = prediction.explanation.marketRegime;
    
    let volRegime: 'LOW' | 'MEDIUM' | 'HIGH';
    if (volatility < 0.02) volRegime = 'LOW';
    else if (volatility < 0.05) volRegime = 'MEDIUM';
    else volRegime = 'HIGH';
    
    // Map ML market regime to trend classification
    let trendRegime: 'STRONG_UP' | 'WEAK_UP' | 'SIDEWAYS' | 'WEAK_DOWN' | 'STRONG_DOWN';
    switch (marketRegime) {
      case 'TRENDING_UP': trendRegime = 'STRONG_UP'; break;
      case 'TRENDING_DOWN': trendRegime = 'STRONG_DOWN'; break;
      case 'SIDEWAYS': trendRegime = 'SIDEWAYS'; break;
      default: trendRegime = 'SIDEWAYS';
    }
    
    // Calculate suitability for mean reversion (higher is better)
    let suitability = 0.5;
    
    // Sideways markets are best for mean reversion
    if (trendRegime === 'SIDEWAYS') suitability += 0.3;
    else if (trendRegime.includes('WEAK')) suitability += 0.1;
    else suitability -= 0.2; // Strong trends are bad for mean reversion
    
    // Medium volatility is best
    if (volRegime === 'MEDIUM') suitability += 0.2;
    else if (volRegime === 'HIGH') suitability -= 0.1;
    else suitability -= 0.1; // Low volatility means less reversion opportunity
    
    return {
      volatility: volRegime,
      trend: trendRegime,
      suitability: Math.max(0, Math.min(1, suitability))
    };
  }

  /**
   * Analyze support and resistance levels for mean reversion targets
   */
  private analyzeSupportResistance(context: StrategyContext, currentPrice: number): {
    nearestSupport: number;
    nearestResistance: number;
    supportStrength: number;
    resistanceStrength: number;
  } {
    // Simplified support/resistance calculation
    const high = context.marketData.high;
    const low = context.marketData.low;
    
    const nearestSupport = low * 1.005; // Slight buffer above low
    const nearestResistance = high * 0.995; // Slight buffer below high
    
    // Strength based on how close we are to the levels
    const supportStrength = Math.max(0, 1 - Math.abs(currentPrice - nearestSupport) / currentPrice);
    const resistanceStrength = Math.max(0, 1 - Math.abs(currentPrice - nearestResistance) / currentPrice);
    
    return {
      nearestSupport,
      nearestResistance,
      supportStrength,
      resistanceStrength
    };
  }

  /**
   * Calculate correlations with other assets
   */
  private calculateCorrelations(features: any): Record<string, number> {
    // Extract correlation features if available
    return {
      'BTC': features.correlation_btc || 0,
      'ETH': features.correlation_eth || 0
    };
  }

  /**
   * Calculate expected reversion target and confidence
   */
  private calculateExpectedReversion(
    meanPrice: number,
    currentPrice: number, 
    reversionProbability: number,
    halfLife: number
  ): {
    targetPrice: number;
    confidence: number;
    timeHorizon: number;
  } {
    // Target is the mean, but adjust for partial reversion
    const reversionRatio = 0.618; // Often prices revert to ~61.8% of the way back
    const targetPrice = currentPrice + (meanPrice - currentPrice) * reversionRatio;
    
    return {
      targetPrice,
      confidence: reversionProbability,
      timeHorizon: halfLife * 2 // Expect reversion within 2 half-lives
    };
  }

  /**
   * Validate mean reversion signal
   */
  private validateReversionSignal(
    analysis: MeanReversionAnalysis,
    prediction: MLPrediction,
    context: StrategyContext
  ): boolean {
    
    // Check if deviation is sufficient
    if (Math.abs(analysis.zScore) < this.adaptiveThresholds.zScore) {
      return false;
    }
    
    // Check reversion probability
    if (analysis.reversionProbability < this.adaptiveThresholds.confidence) {
      return false;
    }
    
    // Check market regime suitability
    if (this.meanRevConfig.regimeFiltering && 
        analysis.marketRegime.suitability < 0.3) {
      return false;
    }
    
    // Check for strong trend (bad for mean reversion)
    if (this.meanRevConfig.trendRegimeFilter &&
        (analysis.marketRegime.trend === 'STRONG_UP' || 
         analysis.marketRegime.trend === 'STRONG_DOWN')) {
      return false;
    }
    
    // Check stationarity if required
    if (this.meanRevConfig.stationarityTest && !analysis.stationarity.isStationary) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate mean reversion signal
   */
  private async generateReversionSignal(
    analysis: MeanReversionAnalysis,
    prediction: MLPrediction,
    context: StrategyContext
  ): Promise<StrategySignal> {
    
    const currentPrice = analysis.currentPrice;
    const deviation = analysis.deviation;
    
    // Determine action based on deviation direction
    const action = deviation > 0 ? 'SELL' : 'BUY'; // Price above mean = sell, below mean = buy
    
    // Calculate stop loss
    const stopLoss = this.calculateReversionStopLoss(analysis, action);
    
    // Calculate take profit (target the expected reversion)
    const takeProfit = analysis.expectedReversion.targetPrice;
    
    const signal: StrategySignal = {
      symbol: context.marketData.symbol,
      action,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      confidence: analysis.reversionProbability,
      timestamp: new Date(),
      reason: `ML Mean Reversion: ${Math.abs(analysis.zScore).toFixed(2)} σ deviation from mean`,
      metadata: {
        strategy: 'ML_MEAN_REVERSION',
        meanPrice: analysis.meanPrice,
        deviation: analysis.deviation,
        zScore: analysis.zScore,
        standardDeviation: analysis.standardDeviation,
        reversionProbability: analysis.reversionProbability,
        halfLife: analysis.halfLife,
        expectedTimeHorizon: analysis.expectedReversion.timeHorizon,
        marketRegime: analysis.marketRegime,
        supportResistance: analysis.supportResistance,
        stationarity: analysis.stationarity,
        mlPrediction: {
          signal: prediction.signal,
          confidence: prediction.confidence,
          keyFactors: prediction.explanation.keyFactors
        }
      }
    };
    
    // Store trade for performance tracking
    this.recentTrades.push({
      timestamp: new Date(),
      signal
    });
    
    // Keep trades history bounded
    if (this.recentTrades.length > this.meanRevConfig.performanceMemory) {
      this.recentTrades.shift();
    }
    
    return signal;
  }

  /**
   * Calculate stop loss for mean reversion strategy
   */
  private calculateReversionStopLoss(analysis: MeanReversionAnalysis, action: 'BUY' | 'SELL'): number {
    const currentPrice = analysis.currentPrice;
    const standardDev = analysis.standardDeviation;
    const stopMultiplier = this.meanRevConfig.stopLossMultiplier;
    
    // Stop loss is placed at multiple of standard deviations beyond entry
    const stopDistance = standardDev * stopMultiplier;
    
    if (action === 'BUY') {
      // For long positions, stop below entry
      return currentPrice - stopDistance;
    } else {
      // For short positions, stop above entry  
      return currentPrice + stopDistance;
    }
  }

  /**
   * Store analysis for historical tracking
   */
  private storeAnalysis(analysis: MeanReversionAnalysis): void {
    this.analysisHistory.push({
      timestamp: new Date(),
      analysis
    });
    
    // Keep history bounded
    if (this.analysisHistory.length > 1000) {
      this.analysisHistory.shift();
    }
  }

  /**
   * Analyze recent performance for adaptive adjustment
   */
  private analyzeRecentPerformance(): { winRate: number; avgReversion: number; avgTimeToReversion: number } {
    const recentTrades = this.recentTrades.slice(-20); // Last 20 trades
    
    if (recentTrades.length === 0) {
      return { winRate: 0.5, avgReversion: 0, avgTimeToReversion: 30 };
    }
    
    const completedTrades = recentTrades.filter(trade => trade.outcome);
    const wins = completedTrades.filter(trade => trade.outcome === 'WIN').length;
    const winRate = wins / Math.max(completedTrades.length, 1);
    
    const reversions = completedTrades
      .filter(trade => trade.actualReversion !== undefined)
      .map(trade => trade.actualReversion!);
    
    const avgReversion = reversions.length > 0 ? 
      reversions.reduce((sum, rev) => sum + rev, 0) / reversions.length : 0;
    
    const timesToReversion = completedTrades
      .filter(trade => trade.timeToReversion !== undefined)
      .map(trade => trade.timeToReversion!);
    
    const avgTimeToReversion = timesToReversion.length > 0 ?
      timesToReversion.reduce((sum, time) => sum + time, 0) / timesToReversion.length : 30;
    
    return { winRate, avgReversion, avgTimeToReversion };
  }

  /**
   * Get analysis history for backtesting and optimization
   */
  public getAnalysisHistory(): Array<{ timestamp: Date; analysis: MeanReversionAnalysis; }> {
    return [...this.analysisHistory];
  }

  /**
   * Get recent trades for performance analysis
   */
  public getRecentTrades(): Array<{
    timestamp: Date;
    signal: StrategySignal;
    outcome?: 'WIN' | 'LOSS';
    actualReversion?: number;
    timeToReversion?: number;
  }> {
    return [...this.recentTrades];
  }

  /**
   * Get current adaptive thresholds
   */
  public getAdaptiveThresholds(): { deviation: number; confidence: number; zScore: number } {
    return { ...this.adaptiveThresholds };
  }
}

export default MLMeanReversionStrategy;