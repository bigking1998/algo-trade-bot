/**
 * ML Strategy Templates - Task BE-026: ML Strategy Templates
 * 
 * Exports all ML-enhanced trading strategies implementing comprehensive
 * machine learning integration for algorithmic trading:
 * 
 * - BaseMLStrategy: Abstract base class for all ML strategies
 * - MLTrendFollowingStrategy: ML-enhanced trend following
 * - MLMeanReversionStrategy: ML-powered mean reversion
 * - MLSentimentStrategy: Sentiment-based trading with ML
 * - MLEnsembleStrategy: Multi-model ensemble strategy
 */

// Base ML Strategy
export { BaseMLStrategy } from './BaseMLStrategy.js';
export type { MLStrategyConfig, MLStrategyMetrics, MLPrediction } from './BaseMLStrategy.js';

// ML Trend Following Strategy
export { MLTrendFollowingStrategy } from './MLTrendFollowingStrategy.js';
export type { MLTrendFollowingConfig } from './MLTrendFollowingStrategy.js';

// ML Mean Reversion Strategy
export { MLMeanReversionStrategy } from './MLMeanReversionStrategy.js';
export type { MLMeanReversionConfig } from './MLMeanReversionStrategy.js';

// ML Sentiment Strategy
export { MLSentimentStrategy } from './MLSentimentStrategy.js';
export type { MLSentimentConfig } from './MLSentimentStrategy.js';

// ML Ensemble Strategy
export { MLEnsembleStrategy } from './MLEnsembleStrategy.js';
export type { MLEnsembleConfig } from './MLEnsembleStrategy.js';

/**
 * ML Strategy Factory for creating instances of ML strategies
 */
export class MLStrategyFactory {
  /**
   * Create a trend following strategy with ML enhancement
   */
  static createTrendFollowingStrategy(config: Partial<any> = {}): any {
    const defaultConfig = {
      id: `ml_trend_${Date.now()}`,
      name: 'ML Trend Following Strategy',
      description: 'Machine learning enhanced trend following strategy',
      symbols: ['BTC-USD'],
      timeframes: ['5m', '15m', '1h'],
      version: '1.0.0',
      riskProfile: {
        maxRiskPerTrade: 2.0,
        maxPortfolioRisk: 10.0,
        maxDrawdown: 15.0,
        riskRewardRatio: 2.0
      },
      execution: {
        timeout: 30,
        retryAttempts: 3,
        slippageTolerance: 0.1
      },
      monitoring: {
        enabled: true,
        logLevel: 'INFO',
        alertThresholds: {
          drawdown: 10.0,
          winRate: 40.0
        },
        healthCheckInterval: 300
      },
      parameters: {},
      ml: {
        modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY'],
        ensembleStrategy: 'WEIGHTED',
        minConfidenceThreshold: 0.7,
        featureEngineeringConfig: {
          technicalIndicators: ['sma_20', 'sma_50', 'ema_12', 'ema_26', 'macd', 'rsi', 'adx'],
          lookbackPeriods: [5, 10, 20, 50],
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        },
        predictionHorizon: 60,
        retrainingConfig: {
          enabled: true,
          frequency: 'weekly',
          minAccuracyThreshold: 0.6,
          performanceDegradationThreshold: 0.1
        },
        onlineLearning: {
          enabled: false,
          batchSize: 50,
          learningRate: 0.001,
          forgettingFactor: 0.99
        }
      },
      trendFollowing: {
        trendStrengthThreshold: 0.6,
        trendConfidenceThreshold: 0.7,
        minTrendDuration: 10,
        timeframes: ['5m', '15m', '1h'],
        timeframeWeights: [0.3, 0.4, 0.3],
        volumeConfirmation: true,
        momentumConfirmation: true,
        volatilityFilter: true,
        adaptiveStops: true,
        dynamicTakeProfit: true,
        trendStrengthScaling: true,
        maxTrendAge: 240,
        antiTrendThreshold: 0.8,
        correlationFilter: true
      },
      ...config
    };

    return new MLTrendFollowingStrategy(defaultConfig);
  }

  /**
   * Create a mean reversion strategy with ML enhancement
   */
  static createMeanReversionStrategy(config: Partial<any> = {}): any {
    const defaultConfig = {
      id: `ml_meanrev_${Date.now()}`,
      name: 'ML Mean Reversion Strategy',
      description: 'Machine learning powered mean reversion strategy',
      symbols: ['BTC-USD'],
      timeframes: ['5m', '15m', '1h'],
      version: '1.0.0',
      riskProfile: {
        maxRiskPerTrade: 1.5,
        maxPortfolioRisk: 8.0,
        maxDrawdown: 12.0,
        riskRewardRatio: 1.5
      },
      execution: {
        timeout: 30,
        retryAttempts: 3,
        slippageTolerance: 0.1
      },
      monitoring: {
        enabled: true,
        logLevel: 'INFO',
        alertThresholds: {
          drawdown: 8.0,
          winRate: 45.0
        },
        healthCheckInterval: 300
      },
      parameters: {},
      ml: {
        modelTypes: ['PRICE_PREDICTION', 'VOLATILITY', 'MARKET_REGIME'],
        ensembleStrategy: 'STACKING',
        minConfidenceThreshold: 0.6,
        featureEngineeringConfig: {
          technicalIndicators: [
            'sma_20', 'ema_20', 'bollinger_upper', 'bollinger_lower',
            'rsi', 'stoch_k', 'williams_r', 'atr', 'z_score'
          ],
          lookbackPeriods: [10, 20, 50, 100],
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        },
        predictionHorizon: 30
      },
      meanReversion: {
        lookbackPeriod: 20,
        deviationThreshold: 2.0,
        reversionConfidence: 0.6,
        meanMethod: 'ADAPTIVE',
        adaptivePeriod: true,
        volatilityAdjusted: true,
        timeframes: ['5m', '15m', '1h'],
        timeframeScoring: true,
        stationarityTest: true,
        halfLifeAnalysis: true,
        zScoreThreshold: 2.0,
        regimeFiltering: true,
        volatilityRegimeAware: true,
        trendRegimeFilter: true,
        maxHoldingPeriod: 120,
        stopLossMultiplier: 1.5,
        takeProfitRatio: 0.618,
        correlationBasedSizing: true,
        dynamicThresholds: true,
        learningDecay: 0.95,
        performanceMemory: 50
      },
      ...config
    };

    return new MLMeanReversionStrategy(defaultConfig);
  }

  /**
   * Create a sentiment-based strategy with ML enhancement
   */
  static createSentimentStrategy(config: Partial<any> = {}): any {
    const defaultConfig = {
      id: `ml_sentiment_${Date.now()}`,
      name: 'ML Sentiment Strategy',
      description: 'Machine learning powered sentiment-based trading strategy',
      symbols: ['BTC-USD'],
      timeframes: ['5m', '15m', '1h'],
      version: '1.0.0',
      riskProfile: {
        maxRiskPerTrade: 2.5,
        maxPortfolioRisk: 12.0,
        maxDrawdown: 18.0,
        riskRewardRatio: 2.5
      },
      execution: {
        timeout: 30,
        retryAttempts: 3,
        slippageTolerance: 0.1
      },
      monitoring: {
        enabled: true,
        logLevel: 'INFO',
        alertThresholds: {
          drawdown: 15.0,
          winRate: 40.0
        },
        healthCheckInterval: 300
      },
      parameters: {},
      ml: {
        modelTypes: ['SENTIMENT', 'MARKET_REGIME', 'VOLATILITY'],
        ensembleStrategy: 'WEIGHTED',
        minConfidenceThreshold: 0.6,
        featureEngineeringConfig: {
          technicalIndicators: [
            'rsi', 'macd', 'momentum', 'fear_greed_index',
            'funding_rate', 'volume_oscillator'
          ],
          lookbackPeriods: [6, 12, 24, 48],
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        },
        predictionHorizon: 120
      },
      sentiment: {
        sources: {
          twitter: { enabled: true, weight: 0.3 },
          reddit: { enabled: true, weight: 0.2 },
          news: { enabled: true, weight: 0.3 },
          fearGreed: { enabled: true, weight: 0.15 },
          fundingRates: { enabled: true, weight: 0.05 },
          optionsFlow: { enabled: false, weight: 0 }
        },
        sentimentThreshold: 0.3,
        confidenceThreshold: 0.6,
        volumeWeighting: true,
        timeDecay: 12,
        strategyType: 'ADAPTIVE',
        momentumThreshold: 0.1,
        adaptiveLearn: true,
        sentimentLookback: 6,
        volatilityFilter: true,
        volumeFilter: true,
        crossAssetSentiment: true,
        correlationThreshold: 0.6,
        marketSentimentWeight: 0.3,
        sentimentReversal: true,
        maxSentimentAge: 2,
        sentimentVolatility: true,
        learningRate: 0.01,
        memoryPeriod: 7,
        recalibrationFreq: 6
      },
      ...config
    };

    return new MLSentimentStrategy(defaultConfig);
  }

  /**
   * Create an ensemble strategy combining multiple ML strategies
   */
  static createEnsembleStrategy(config: Partial<any> = {}): any {
    const defaultConfig = {
      id: `ml_ensemble_${Date.now()}`,
      name: 'ML Ensemble Strategy',
      description: 'Multi-model ensemble strategy combining ML approaches',
      symbols: ['BTC-USD'],
      timeframes: ['5m', '15m', '1h'],
      version: '1.0.0',
      riskProfile: {
        maxRiskPerTrade: 2.0,
        maxPortfolioRisk: 10.0,
        maxDrawdown: 15.0,
        riskRewardRatio: 2.0
      },
      execution: {
        timeout: 45,
        retryAttempts: 3,
        slippageTolerance: 0.1
      },
      monitoring: {
        enabled: true,
        logLevel: 'INFO',
        alertThresholds: {
          drawdown: 12.0,
          winRate: 45.0
        },
        healthCheckInterval: 300
      },
      parameters: {},
      ml: {
        modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY', 'SENTIMENT'],
        ensembleStrategy: 'STACKING',
        minConfidenceThreshold: 0.6
      },
      ensemble: {
        strategies: {
          trendFollowing: { enabled: true, weight: 0.4, config: {} },
          meanReversion: { enabled: true, weight: 0.3, config: {} },
          sentiment: { enabled: true, weight: 0.3, config: {} }
        },
        aggregationMethod: 'ADAPTIVE',
        minAgreement: 0.6,
        confidenceThreshold: 0.7,
        dynamicWeighting: true,
        performanceWindow: 7,
        weightingMethod: 'COMBINED',
        rebalanceFrequency: 6,
        marketAdaptation: true,
        volatilityBuckets: [0.02, 0.04, 0.06],
        trendStrengthThresholds: [0.3, 0.6],
        regimeAwareness: true,
        metaLearning: {
          enabled: true,
          algorithm: 'NEURAL_NETWORK',
          features: ['volatility', 'trend_strength', 'regime', 'confidence'],
          retrainFrequency: 24
        },
        correlationLimit: 0.8,
        diversityRequirement: 0.3,
        failsafeMode: true,
        monitoringWindow: 24,
        degradationThreshold: 0.1,
        autoRebalance: true
      },
      ...config
    };

    return new MLEnsembleStrategy(defaultConfig);
  }

  /**
   * Create a strategy by type
   */
  static createStrategy(type: string, config: Partial<any> = {}): any {
    switch (type.toLowerCase()) {
      case 'ml_trend_following':
      case 'trend_following':
        return this.createTrendFollowingStrategy(config);
      
      case 'ml_mean_reversion':
      case 'mean_reversion':
        return this.createMeanReversionStrategy(config);
      
      case 'ml_sentiment':
      case 'sentiment':
        return this.createSentimentStrategy(config);
      
      case 'ml_ensemble':
      case 'ensemble':
        return this.createEnsembleStrategy(config);
      
      default:
        throw new Error(`Unknown ML strategy type: ${type}`);
    }
  }

  /**
   * Get available ML strategy types
   */
  static getAvailableTypes(): string[] {
    return [
      'ml_trend_following',
      'ml_mean_reversion', 
      'ml_sentiment',
      'ml_ensemble'
    ];
  }

  /**
   * Get default configuration for a strategy type
   */
  static getDefaultConfig(type: string): Partial<any> {
    switch (type.toLowerCase()) {
      case 'ml_trend_following':
        return {
          ml: { modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY'] },
          trendFollowing: { trendStrengthThreshold: 0.6 }
        };
      
      case 'ml_mean_reversion':
        return {
          ml: { modelTypes: ['PRICE_PREDICTION', 'VOLATILITY'] },
          meanReversion: { deviationThreshold: 2.0 }
        };
      
      case 'ml_sentiment':
        return {
          ml: { modelTypes: ['SENTIMENT', 'MARKET_REGIME'] },
          sentiment: { strategyType: 'ADAPTIVE' }
        };
      
      case 'ml_ensemble':
        return {
          ml: { modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY', 'SENTIMENT'] },
          ensemble: { aggregationMethod: 'ADAPTIVE' }
        };
      
      default:
        return {};
    }
  }
}

export default {
  BaseMLStrategy,
  MLTrendFollowingStrategy,
  MLMeanReversionStrategy,
  MLSentimentStrategy,
  MLEnsembleStrategy,
  MLStrategyFactory
};