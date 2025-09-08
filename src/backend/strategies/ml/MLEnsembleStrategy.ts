/**
 * ML Ensemble Strategy - Task BE-026: ML Strategy Templates
 * 
 * Advanced ensemble strategy combining multiple ML models for:
 * - Multi-strategy signal aggregation and weighting
 * - Dynamic model selection based on market conditions
 * - Cross-validation and performance-based weighting
 * - Adaptive ensemble composition and rebalancing
 * - Meta-learning for optimal strategy combination
 */

import { BaseMLStrategy, MLStrategyConfig, MLPrediction } from './BaseMLStrategy.js';
import { MLTrendFollowingStrategy, MLTrendFollowingConfig } from './MLTrendFollowingStrategy.js';
import { MLMeanReversionStrategy, MLMeanReversionConfig } from './MLMeanReversionStrategy.js';
import { MLSentimentStrategy, MLSentimentConfig } from './MLSentimentStrategy.js';
import { StrategyContext, StrategySignal } from '../types.js';

/**
 * Individual strategy component within ensemble
 */
interface StrategyComponent {
  id: string;
  name: string;
  strategy: BaseMLStrategy;
  weight: number;
  performance: {
    accuracy: number;
    returnRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    avgConfidence: number;
    tradesCount: number;
    lastUpdated: Date;
  };
  marketConditions: {
    preferredVolatility: { min: number; max: number; };
    preferredTrend: 'TRENDING' | 'SIDEWAYS' | 'ALL';
    preferredRegime: string[];
  };
  isActive: boolean;
  lastSignal?: StrategySignal;
  lastPrediction?: MLPrediction;
}

/**
 * ML Ensemble Strategy configuration
 */
export interface MLEnsembleConfig extends MLStrategyConfig {
  ensemble: {
    // Strategy components
    strategies: {
      trendFollowing: { enabled: boolean; weight: number; config: Partial<MLTrendFollowingConfig>; };
      meanReversion: { enabled: boolean; weight: number; config: Partial<MLMeanReversionConfig>; };
      sentiment: { enabled: boolean; weight: number; config: Partial<MLSentimentConfig>; };
    };
    
    // Aggregation methods
    aggregationMethod: 'WEIGHTED_AVERAGE' | 'MAJORITY_VOTE' | 'CONFIDENCE_WEIGHTED' | 'ADAPTIVE' | 'META_LEARNING';
    minAgreement: number; // Minimum agreement between strategies (0-1)
    confidenceThreshold: number; // Minimum ensemble confidence
    
    // Dynamic weighting
    dynamicWeighting: boolean;
    performanceWindow: number; // Days to consider for performance weighting
    weightingMethod: 'PERFORMANCE' | 'SHARPE' | 'WIN_RATE' | 'COMBINED';
    rebalanceFrequency: number; // Hours between weight rebalancing
    
    // Market condition adaptation
    marketAdaptation: boolean;
    volatilityBuckets: number[]; // Volatility thresholds for bucketing
    trendStrengthThresholds: number[]; // Trend strength thresholds
    regimeAwareness: boolean;
    
    // Meta-learning
    metaLearning: {
      enabled: boolean;
      algorithm: 'NEURAL_NETWORK' | 'DECISION_TREE' | 'RANDOM_FOREST' | 'GRADIENT_BOOSTING';
      features: string[]; // Features for meta-learning model
      retrainFrequency: number; // Hours between retraining
    };
    
    // Risk management
    correlationLimit: number; // Maximum correlation between active strategies
    diversityRequirement: number; // Minimum diversity score
    failsafeMode: boolean; // Use single best strategy if ensemble fails
    
    // Performance monitoring
    monitoringWindow: number; // Hours for performance monitoring
    degradationThreshold: number; // Performance degradation threshold
    autoRebalance: boolean; // Automatic rebalancing based on performance
  };
}

/**
 * Ensemble decision and analysis
 */
interface EnsembleDecision {
  finalSignal: StrategySignal | null;
  confidence: number;
  agreement: number; // 0-1, how much strategies agree
  diversity: number; // 0-1, diversity of signals
  componentSignals: Array<{
    strategyId: string;
    signal: StrategySignal | null;
    weight: number;
    confidence: number;
    contribution: number;
  }>;
  marketCondition: {
    volatility: number;
    trendStrength: number;
    regime: string;
    suitability: Record<string, number>; // Suitability for each strategy
  };
  riskAssessment: {
    overallRisk: number;
    concentration: number;
    correlation: number;
    diversityRisk: number;
  };
  metadata: {
    aggregationMethod: string;
    activeStrategies: string[];
    weights: Record<string, number>;
    performanceMetrics: Record<string, any>;
  };
}

/**
 * ML Ensemble Strategy combining multiple ML strategies
 */
export class MLEnsembleStrategy extends BaseMLStrategy {
  private ensembleConfig: MLEnsembleConfig['ensemble'];
  private strategies: Map<string, StrategyComponent> = new Map();
  private decisionHistory: Array<{
    timestamp: Date;
    decision: EnsembleDecision;
    outcome?: 'WIN' | 'LOSS' | 'PENDING';
    actualReturn?: number;
  }> = [];
  
  private performanceTracker: {
    individual: Map<string, Array<{ timestamp: Date; return: number; confidence: number; }>>;
    ensemble: Array<{ timestamp: Date; return: number; confidence: number; agreement: number; }>;
  } = {
    individual: new Map(),
    ensemble: []
  };
  
  private metaLearningModel?: any; // Meta-learning model for strategy combination
  private lastRebalance: Date = new Date();
  private currentWeights: Map<string, number> = new Map();

  constructor(config: MLEnsembleConfig) {
    super({
      ...config,
      ml: {
        ...config.ml,
        modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY', 'SENTIMENT'],
        ensembleStrategy: 'STACKING', // Use stacking for meta-learning
        featureEngineeringConfig: {
          technicalIndicators: [
            // Comprehensive set for all strategies
            'sma_10', 'sma_20', 'sma_50', 'sma_200',
            'ema_12', 'ema_26', 'ema_50',
            'macd', 'macd_signal', 'macd_histogram',
            'rsi', 'stoch_k', 'stoch_d', 'williams_r',
            'bollinger_upper', 'bollinger_lower', 'bollinger_width',
            'atr', 'adx', 'cci', 'momentum', 'rate_of_change',
            'volume_sma_20', 'volume_oscillator',
            'fear_greed_index', 'funding_rate'
          ],
          lookbackPeriods: [5, 10, 20, 50, 100, 200],
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        }
      }
    });
    
    this.ensembleConfig = config.ensemble;
    this.initializeStrategies(config);
  }

  /**
   * Define training strategy for ensemble meta-learning
   */
  async defineTrainingStrategy(): Promise<{
    targetVariable: string;
    featureSelection: string[];
    modelArchitecture: any;
    trainingParameters: any;
  }> {
    return {
      targetVariable: 'ensemble_optimal_weights', // Learn optimal strategy weights
      featureSelection: [
        'market_volatility', 'trend_strength', 'market_regime',
        'strategy_confidences', 'strategy_agreements', 'performance_metrics',
        'correlation_matrix', 'diversity_scores', 'risk_metrics'
      ],
      modelArchitecture: {
        type: 'META_ENSEMBLE_LEARNER',
        architecture: this.ensembleConfig.metaLearning.algorithm,
        components: {
          'NEURAL_NETWORK': {
            layers: [
              { type: 'Dense', units: 64, activation: 'relu' },
              { type: 'Dropout', rate: 0.3 },
              { type: 'Dense', units: 32, activation: 'relu' },
              { type: 'Dense', units: 16, activation: 'relu' },
              { type: 'Dense', units: this.strategies.size, activation: 'softmax' } // Output weights
            ]
          },
          'RANDOM_FOREST': {
            nEstimators: 100,
            maxDepth: 10,
            minSamplesSplit: 5
          },
          'GRADIENT_BOOSTING': {
            nEstimators: 100,
            learningRate: 0.1,
            maxDepth: 6
          }
        },
        optimizer: 'adam',
        learningRate: 0.001
      },
      trainingParameters: {
        sequenceLength: 24, // 24 hours of ensemble decisions
        batchSize: 32,
        epochs: 150,
        validationSplit: 0.2,
        earlyStoppingPatience: 15,
        lossFunction: 'categorical_crossentropy',
        metrics: ['accuracy', 'mean_squared_error']
      }
    };
  }

  /**
   * Process ensemble prediction by combining multiple strategies
   */
  async processPrediction(prediction: MLPrediction, context: StrategyContext): Promise<StrategySignal | null> {
    // Get signals from all active strategies
    const componentSignals = await this.collectComponentSignals(context);
    
    // Analyze market conditions for strategy suitability
    const marketCondition = await this.analyzeMarketConditions(context, prediction);
    
    // Rebalance weights if needed
    if (this.shouldRebalanceWeights()) {
      await this.rebalanceWeights(marketCondition);
    }
    
    // Make ensemble decision
    const decision = await this.makeEnsembleDecision(
      componentSignals,
      marketCondition,
      prediction,
      context
    );
    
    // Store decision for learning
    this.storeDecision(decision);
    
    return decision.finalSignal;
  }

  /**
   * Validate ensemble prediction quality
   */
  validatePrediction(prediction: MLPrediction, context: StrategyContext): boolean {
    // Check base ML prediction
    if (prediction.confidence < 0.4) {
      return false;
    }
    
    // Ensure we have at least 2 active strategies
    const activeStrategies = Array.from(this.strategies.values()).filter(s => s.isActive);
    if (activeStrategies.length < 2) {
      return false;
    }
    
    // Check strategy health
    const unhealthyCount = activeStrategies.filter(s => 
      s.performance.accuracy < 0.4 || s.performance.winRate < 0.3
    ).length;
    
    if (unhealthyCount > activeStrategies.length / 2) {
      return false;
    }
    
    return true;
  }

  /**
   * Handle ensemble model degradation
   */
  async onModelDegradation(modelId: string, currentMetrics: any): Promise<void> {
    console.log(`🔄 Handling ensemble model degradation for ${modelId}`);
    
    // Identify which component strategy is degrading
    for (const [strategyId, component] of this.strategies.entries()) {
      if (component.performance.accuracy < 0.4) {
        console.log(`⚠️ Strategy ${strategyId} performance degraded`);
        
        // Reduce weight of degrading strategy
        component.weight *= 0.7;
        this.currentWeights.set(strategyId, component.weight);
        
        // If performance is very poor, deactivate temporarily
        if (component.performance.accuracy < 0.3) {
          component.isActive = false;
          console.log(`🛑 Temporarily deactivating strategy ${strategyId}`);
        }
      }
    }
    
    // Normalize weights
    this.normalizeWeights();
    
    // Increase ensemble confidence threshold temporarily
    this.ensembleConfig.confidenceThreshold = Math.min(
      this.ensembleConfig.confidenceThreshold * 1.2,
      0.9
    );
    
    // Trigger meta-learning model retraining if enabled
    if (this.ensembleConfig.metaLearning.enabled && this.metaLearningModel) {
      console.log('🎯 Triggering meta-learning model retraining');
      await this.retrainMetaLearningModel();
    }
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  /**
   * Initialize component strategies
   */
  private initializeStrategies(config: MLEnsembleConfig): void {
    const strategiesConfig = config.ensemble.strategies;
    
    // Initialize trend following strategy
    if (strategiesConfig.trendFollowing.enabled) {
      const trendConfig: MLTrendFollowingConfig = {
        ...config,
        ...strategiesConfig.trendFollowing.config,
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
          maxTrendAge: 240, // 4 hours
          antiTrendThreshold: 0.8,
          correlationFilter: true,
          ...strategiesConfig.trendFollowing.config.trendFollowing
        }
      } as MLTrendFollowingConfig;
      
      const trendStrategy = new MLTrendFollowingStrategy(trendConfig);
      
      this.strategies.set('trendFollowing', {
        id: 'trendFollowing',
        name: 'ML Trend Following',
        strategy: trendStrategy,
        weight: strategiesConfig.trendFollowing.weight,
        performance: this.initializePerformanceMetrics(),
        marketConditions: {
          preferredVolatility: { min: 0.02, max: 0.08 },
          preferredTrend: 'TRENDING',
          preferredRegime: ['TRENDING_UP', 'TRENDING_DOWN']
        },
        isActive: true
      });
    }
    
    // Initialize mean reversion strategy
    if (strategiesConfig.meanReversion.enabled) {
      const meanRevConfig: MLMeanReversionConfig = {
        ...config,
        ...strategiesConfig.meanReversion.config,
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
          performanceMemory: 50,
          ...strategiesConfig.meanReversion.config.meanReversion
        }
      } as MLMeanReversionConfig;
      
      const meanRevStrategy = new MLMeanReversionStrategy(meanRevConfig);
      
      this.strategies.set('meanReversion', {
        id: 'meanReversion',
        name: 'ML Mean Reversion',
        strategy: meanRevStrategy,
        weight: strategiesConfig.meanReversion.weight,
        performance: this.initializePerformanceMetrics(),
        marketConditions: {
          preferredVolatility: { min: 0.01, max: 0.05 },
          preferredTrend: 'SIDEWAYS',
          preferredRegime: ['SIDEWAYS', 'HIGH_VOLATILITY']
        },
        isActive: true
      });
    }
    
    // Initialize sentiment strategy
    if (strategiesConfig.sentiment.enabled) {
      const sentimentConfig: MLSentimentConfig = {
        ...config,
        ...strategiesConfig.sentiment.config,
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
          recalibrationFreq: 6,
          ...strategiesConfig.sentiment.config.sentiment
        }
      } as MLSentimentConfig;
      
      const sentimentStrategy = new MLSentimentStrategy(sentimentConfig);
      
      this.strategies.set('sentiment', {
        id: 'sentiment',
        name: 'ML Sentiment',
        strategy: sentimentStrategy,
        weight: strategiesConfig.sentiment.weight,
        performance: this.initializePerformanceMetrics(),
        marketConditions: {
          preferredVolatility: { min: 0.015, max: 0.06 },
          preferredTrend: 'ALL',
          preferredRegime: ['SIDEWAYS', 'TRENDING_UP', 'TRENDING_DOWN']
        },
        isActive: true
      });
    }
    
    // Initialize weights
    this.normalizeWeights();
    
    console.log(`🎯 Initialized ensemble with ${this.strategies.size} strategies`);
  }

  /**
   * Initialize performance metrics for a strategy
   */
  private initializePerformanceMetrics() {
    return {
      accuracy: 0.5,
      returnRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0.5,
      avgConfidence: 0.5,
      tradesCount: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Collect signals from all active component strategies
   */
  private async collectComponentSignals(context: StrategyContext): Promise<Array<{
    strategyId: string;
    signal: StrategySignal | null;
    confidence: number;
    weight: number;
  }>> {
    
    const signals = [];
    
    for (const [strategyId, component] of this.strategies.entries()) {
      if (!component.isActive) continue;
      
      try {
        // Execute strategy
        const signal = await component.strategy.executeStrategy(context);
        const confidence = signal?.confidence || 0;
        
        signals.push({
          strategyId,
          signal,
          confidence,
          weight: this.currentWeights.get(strategyId) || component.weight
        });
        
        // Store signal for tracking
        component.lastSignal = signal || undefined;
        
      } catch (error) {
        console.error(`❌ Error executing strategy ${strategyId}:`, error);
        signals.push({
          strategyId,
          signal: null,
          confidence: 0,
          weight: this.currentWeights.get(strategyId) || component.weight
        });
      }
    }
    
    return signals;
  }

  /**
   * Analyze market conditions for strategy suitability
   */
  private async analyzeMarketConditions(
    context: StrategyContext, 
    prediction: MLPrediction
  ): Promise<{
    volatility: number;
    trendStrength: number;
    regime: string;
    suitability: Record<string, number>;
  }> {
    
    const volatility = prediction.explanation.volatilityPrediction;
    const regime = prediction.explanation.marketRegime;
    
    // Calculate trend strength
    const features = prediction.features;
    const trendStrength = this.calculateTrendStrength(features);
    
    // Calculate suitability for each strategy
    const suitability: Record<string, number> = {};
    
    for (const [strategyId, component] of this.strategies.entries()) {
      const conditions = component.marketConditions;
      let score = 0.5; // Base score
      
      // Volatility suitability
      const volMin = conditions.preferredVolatility.min;
      const volMax = conditions.preferredVolatility.max;
      if (volatility >= volMin && volatility <= volMax) {
        score += 0.3;
      } else {
        const distance = Math.min(
          Math.abs(volatility - volMin),
          Math.abs(volatility - volMax)
        );
        score -= distance * 5; // Penalty for distance from preferred range
      }
      
      // Trend suitability
      if (conditions.preferredTrend === 'ALL' ||
          (conditions.preferredTrend === 'TRENDING' && trendStrength > 0.5) ||
          (conditions.preferredTrend === 'SIDEWAYS' && trendStrength < 0.3)) {
        score += 0.2;
      } else {
        score -= 0.2;
      }
      
      // Regime suitability
      if (conditions.preferredRegime.includes(regime)) {
        score += 0.2;
      } else {
        score -= 0.1;
      }
      
      suitability[strategyId] = Math.max(0, Math.min(1, score));
    }
    
    return {
      volatility,
      trendStrength,
      regime,
      suitability
    };
  }

  /**
   * Calculate trend strength from features
   */
  private calculateTrendStrength(features: any): number {
    const sma20 = features.sma_20 || 0;
    const sma50 = features.sma_50 || 0;
    const price = features.close || 0;
    const adx = features.adx || 0;
    
    let strength = 0;
    
    // Price vs moving averages
    if (sma20 > 0 && sma50 > 0) {
      const shortTrend = Math.abs(price - sma20) / price;
      const longTrend = Math.abs(sma20 - sma50) / sma50;
      strength += (shortTrend + longTrend) / 2;
    }
    
    // ADX strength
    if (adx > 0) {
      strength = (strength + Math.min(adx / 50, 1)) / 2;
    }
    
    return Math.max(0, Math.min(1, strength));
  }

  /**
   * Check if weights should be rebalanced
   */
  private shouldRebalanceWeights(): boolean {
    if (!this.ensembleConfig.dynamicWeighting || !this.ensembleConfig.autoRebalance) {
      return false;
    }
    
    const hoursElapsed = (Date.now() - this.lastRebalance.getTime()) / (1000 * 60 * 60);
    return hoursElapsed >= this.ensembleConfig.rebalanceFrequency;
  }

  /**
   * Rebalance strategy weights based on performance and market conditions
   */
  private async rebalanceWeights(marketCondition: any): Promise<void> {
    console.log('⚖️ Rebalancing ensemble strategy weights...');
    
    const newWeights = new Map<string, number>();
    
    for (const [strategyId, component] of this.strategies.entries()) {
      let weight = component.weight; // Base weight
      
      // Adjust for performance
      if (this.ensembleConfig.weightingMethod === 'PERFORMANCE' || 
          this.ensembleConfig.weightingMethod === 'COMBINED') {
        const performanceMultiplier = Math.max(0.1, component.performance.accuracy * 2);
        weight *= performanceMultiplier;
      }
      
      // Adjust for Sharpe ratio
      if (this.ensembleConfig.weightingMethod === 'SHARPE' ||
          this.ensembleConfig.weightingMethod === 'COMBINED') {
        const sharpeMultiplier = Math.max(0.1, 1 + component.performance.sharpeRatio);
        weight *= sharpeMultiplier;
      }
      
      // Adjust for win rate
      if (this.ensembleConfig.weightingMethod === 'WIN_RATE' ||
          this.ensembleConfig.weightingMethod === 'COMBINED') {
        const winRateMultiplier = Math.max(0.1, component.performance.winRate * 2);
        weight *= winRateMultiplier;
      }
      
      // Adjust for market suitability
      if (this.ensembleConfig.marketAdaptation) {
        const suitabilityScore = marketCondition.suitability[strategyId] || 0.5;
        weight *= (0.5 + suitabilityScore); // 0.5x to 1.5x multiplier
      }
      
      newWeights.set(strategyId, weight);
    }
    
    // Normalize weights
    const totalWeight = Array.from(newWeights.values()).reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      for (const [strategyId, weight] of newWeights.entries()) {
        this.currentWeights.set(strategyId, weight / totalWeight);
      }
    }
    
    this.lastRebalance = new Date();
    console.log('✅ Weights rebalanced:', Object.fromEntries(this.currentWeights));
  }

  /**
   * Make ensemble decision combining all signals
   */
  private async makeEnsembleDecision(
    componentSignals: Array<{
      strategyId: string;
      signal: StrategySignal | null;
      confidence: number;
      weight: number;
    }>,
    marketCondition: any,
    prediction: MLPrediction,
    context: StrategyContext
  ): Promise<EnsembleDecision> {
    
    // Filter out null signals
    const validSignals = componentSignals.filter(cs => cs.signal !== null);
    
    if (validSignals.length === 0) {
      return this.createEmptyDecision(componentSignals, marketCondition);
    }
    
    // Calculate agreement
    const agreement = this.calculateAgreement(validSignals);
    
    // Check minimum agreement requirement
    if (agreement < this.ensembleConfig.minAgreement) {
      return this.createEmptyDecision(componentSignals, marketCondition);
    }
    
    // Aggregate signals based on method
    const finalSignal = await this.aggregateSignals(
      validSignals,
      marketCondition,
      context
    );
    
    // Calculate ensemble confidence
    const confidence = this.calculateEnsembleConfidence(validSignals, agreement);
    
    // Check confidence threshold
    if (!finalSignal || confidence < this.ensembleConfig.confidenceThreshold) {
      return this.createEmptyDecision(componentSignals, marketCondition);
    }
    
    // Calculate diversity
    const diversity = this.calculateDiversity(validSignals);
    
    // Calculate risk assessment
    const riskAssessment = this.calculateRiskAssessment(validSignals, diversity);
    
    // Create decision
    return {
      finalSignal,
      confidence,
      agreement,
      diversity,
      componentSignals: componentSignals.map(cs => ({
        strategyId: cs.strategyId,
        signal: cs.signal,
        weight: cs.weight,
        confidence: cs.confidence,
        contribution: cs.signal ? cs.weight * cs.confidence : 0
      })),
      marketCondition,
      riskAssessment,
      metadata: {
        aggregationMethod: this.ensembleConfig.aggregationMethod,
        activeStrategies: validSignals.map(vs => vs.strategyId),
        weights: Object.fromEntries(this.currentWeights),
        performanceMetrics: this.getPerformanceSnapshot()
      }
    };
  }

  /**
   * Calculate agreement between strategies
   */
  private calculateAgreement(signals: Array<{ signal: StrategySignal | null; weight: number; }>): number {
    if (signals.length < 2) return 1.0;
    
    const buySignals = signals.filter(s => s.signal?.action === 'BUY');
    const sellSignals = signals.filter(s => s.signal?.action === 'SELL');
    
    const buyWeight = buySignals.reduce((sum, s) => sum + s.weight, 0);
    const sellWeight = sellSignals.reduce((sum, s) => sum + s.weight, 0);
    const totalWeight = buyWeight + sellWeight;
    
    if (totalWeight === 0) return 0;
    
    // Agreement is the proportion of the dominant direction
    return Math.max(buyWeight, sellWeight) / totalWeight;
  }

  /**
   * Aggregate signals using configured method
   */
  private async aggregateSignals(
    validSignals: Array<{
      strategyId: string;
      signal: StrategySignal | null;
      confidence: number;
      weight: number;
    }>,
    marketCondition: any,
    context: StrategyContext
  ): Promise<StrategySignal | null> {
    
    switch (this.ensembleConfig.aggregationMethod) {
      case 'WEIGHTED_AVERAGE':
        return this.aggregateWeightedAverage(validSignals, context);
        
      case 'MAJORITY_VOTE':
        return this.aggregateMajorityVote(validSignals, context);
        
      case 'CONFIDENCE_WEIGHTED':
        return this.aggregateConfidenceWeighted(validSignals, context);
        
      case 'META_LEARNING':
        return this.aggregateMetaLearning(validSignals, marketCondition, context);
        
      case 'ADAPTIVE':
      default:
        return this.aggregateAdaptive(validSignals, marketCondition, context);
    }
  }

  /**
   * Aggregate using weighted average
   */
  private aggregateWeightedAverage(
    signals: Array<{ strategyId: string; signal: StrategySignal | null; weight: number; }>,
    context: StrategyContext
  ): StrategySignal | null {
    
    let buyWeight = 0, sellWeight = 0;
    let avgPrice = 0, avgConfidence = 0, totalWeight = 0;
    const reasons: string[] = [];
    
    for (const { signal, weight } of signals) {
      if (!signal) continue;
      
      if (signal.action === 'BUY') buyWeight += weight;
      else sellWeight += weight;
      
      avgPrice += signal.entryPrice * weight;
      avgConfidence += signal.confidence * weight;
      totalWeight += weight;
      reasons.push(signal.reason);
    }
    
    if (totalWeight === 0) return null;
    
    const action = buyWeight > sellWeight ? 'BUY' : 'SELL';
    const dominantWeight = Math.max(buyWeight, sellWeight);
    const confidence = (avgConfidence / totalWeight) * (dominantWeight / totalWeight);
    
    return {
      symbol: context.marketData.symbol,
      action,
      entryPrice: avgPrice / totalWeight,
      confidence,
      timestamp: new Date(),
      reason: `Ensemble ${action}: ${reasons.join(' + ')}`,
      stopLoss: this.calculateEnsembleStopLoss(signals, action, context.marketData.close),
      takeProfit: this.calculateEnsembleTakeProfit(signals, action, context.marketData.close),
      metadata: {
        strategy: 'ML_ENSEMBLE',
        aggregationMethod: 'WEIGHTED_AVERAGE',
        componentSignals: signals.length,
        agreement: dominantWeight / totalWeight
      }
    };
  }

  /**
   * Aggregate using majority vote
   */
  private aggregateMajorityVote(
    signals: Array<{ strategyId: string; signal: StrategySignal | null; }>,
    context: StrategyContext
  ): StrategySignal | null {
    
    const votes = { BUY: 0, SELL: 0 };
    const signalsByAction = { BUY: [], SELL: [] } as any;
    
    for (const { signal } of signals) {
      if (!signal) continue;
      
      votes[signal.action]++;
      signalsByAction[signal.action].push(signal);
    }
    
    const winningAction = votes.BUY > votes.SELL ? 'BUY' : 
                         votes.SELL > votes.BUY ? 'SELL' : null;
    
    if (!winningAction) return null;
    
    const winningSignals = signalsByAction[winningAction];
    const avgConfidence = winningSignals.reduce((sum: number, s: any) => sum + s.confidence, 0) / winningSignals.length;
    const avgPrice = winningSignals.reduce((sum: number, s: any) => sum + s.entryPrice, 0) / winningSignals.length;
    
    return {
      symbol: context.marketData.symbol,
      action: winningAction,
      entryPrice: avgPrice,
      confidence: avgConfidence,
      timestamp: new Date(),
      reason: `Ensemble Majority: ${winningAction} (${votes[winningAction]}/${signals.length} votes)`,
      stopLoss: this.calculateEnsembleStopLoss(winningSignals, winningAction, context.marketData.close),
      takeProfit: this.calculateEnsembleTakeProfit(winningSignals, winningAction, context.marketData.close),
      metadata: {
        strategy: 'ML_ENSEMBLE',
        aggregationMethod: 'MAJORITY_VOTE',
        votes
      }
    };
  }

  /**
   * Aggregate using confidence weighting
   */
  private aggregateConfidenceWeighted(
    signals: Array<{ signal: StrategySignal | null; confidence: number; }>,
    context: StrategyContext
  ): StrategySignal | null {
    
    let buyConfidence = 0, sellConfidence = 0;
    let avgPrice = 0, totalConfidence = 0;
    
    for (const { signal, confidence } of signals) {
      if (!signal) continue;
      
      if (signal.action === 'BUY') buyConfidence += confidence;
      else sellConfidence += confidence;
      
      avgPrice += signal.entryPrice * confidence;
      totalConfidence += confidence;
    }
    
    if (totalConfidence === 0) return null;
    
    const action = buyConfidence > sellConfidence ? 'BUY' : 'SELL';
    const dominantConfidence = Math.max(buyConfidence, sellConfidence);
    
    return {
      symbol: context.marketData.symbol,
      action,
      entryPrice: avgPrice / totalConfidence,
      confidence: dominantConfidence / totalConfidence,
      timestamp: new Date(),
      reason: `Ensemble Confidence: ${action} (${dominantConfidence.toFixed(2)} vs ${(totalConfidence - dominantConfidence).toFixed(2)})`,
      stopLoss: this.calculateEnsembleStopLoss(signals, action, context.marketData.close),
      takeProfit: this.calculateEnsembleTakeProfit(signals, action, context.marketData.close),
      metadata: {
        strategy: 'ML_ENSEMBLE',
        aggregationMethod: 'CONFIDENCE_WEIGHTED',
        buyConfidence,
        sellConfidence
      }
    };
  }

  /**
   * Aggregate using meta-learning model
   */
  private async aggregateMetaLearning(
    signals: Array<any>,
    marketCondition: any,
    context: StrategyContext
  ): Promise<StrategySignal | null> {
    
    if (!this.metaLearningModel) {
      // Fall back to weighted average if no meta-learning model
      return this.aggregateWeightedAverage(signals, context);
    }
    
    // Prepare features for meta-learning
    const features = this.prepareMetaLearningFeatures(signals, marketCondition, context);
    
    try {
      // Get optimal weights from meta-learning model
      const optimalWeights = await this.metaLearningModel.predict(features);
      
      // Apply weights to signals
      let buyWeight = 0, sellWeight = 0;
      let avgPrice = 0, avgConfidence = 0, totalWeight = 0;
      
      for (let i = 0; i < signals.length; i++) {
        const { signal } = signals[i];
        const weight = optimalWeights[i] || 0;
        
        if (!signal || weight <= 0) continue;
        
        if (signal.action === 'BUY') buyWeight += weight;
        else sellWeight += weight;
        
        avgPrice += signal.entryPrice * weight;
        avgConfidence += signal.confidence * weight;
        totalWeight += weight;
      }
      
      if (totalWeight === 0) return null;
      
      const action = buyWeight > sellWeight ? 'BUY' : 'SELL';
      
      return {
        symbol: context.marketData.symbol,
        action,
        entryPrice: avgPrice / totalWeight,
        confidence: (avgConfidence / totalWeight) * (Math.max(buyWeight, sellWeight) / totalWeight),
        timestamp: new Date(),
        reason: `Ensemble Meta-Learning: ${action}`,
        stopLoss: this.calculateEnsembleStopLoss(signals, action, context.marketData.close),
        takeProfit: this.calculateEnsembleTakeProfit(signals, action, context.marketData.close),
        metadata: {
          strategy: 'ML_ENSEMBLE',
          aggregationMethod: 'META_LEARNING',
          optimalWeights: optimalWeights.slice(0, signals.length)
        }
      };
      
    } catch (error) {
      console.error('Meta-learning aggregation failed:', error);
      return this.aggregateWeightedAverage(signals, context);
    }
  }

  /**
   * Aggregate using adaptive method
   */
  private aggregateAdaptive(
    signals: Array<any>,
    marketCondition: any,
    context: StrategyContext
  ): StrategySignal | null {
    
    // Choose aggregation method based on market conditions and recent performance
    const recentPerformance = this.analyzeRecentPerformance();
    
    // Use meta-learning in complex market conditions
    if (marketCondition.volatility > 0.04 && this.metaLearningModel) {
      return this.aggregateMetaLearning(signals, marketCondition, context);
    }
    
    // Use confidence weighting when strategies have varying confidence
    const confidenceVariance = this.calculateConfidenceVariance(signals);
    if (confidenceVariance > 0.1) {
      return this.aggregateConfidenceWeighted(signals, context);
    }
    
    // Default to weighted average
    return this.aggregateWeightedAverage(signals, context);
  }

  /**
   * Calculate ensemble confidence
   */
  private calculateEnsembleConfidence(
    signals: Array<{ confidence: number; weight: number; }>,
    agreement: number
  ): number {
    
    const weightedConfidence = signals.reduce((sum, s) => sum + s.confidence * s.weight, 0) / 
                              signals.reduce((sum, s) => sum + s.weight, 0);
    
    // Boost confidence with agreement and diversity
    const agreementBonus = agreement * 0.2;
    const diversityPenalty = signals.length < 2 ? 0.1 : 0; // Penalize low diversity
    
    return Math.max(0, Math.min(1, weightedConfidence + agreementBonus - diversityPenalty));
  }

  /**
   * Calculate signal diversity
   */
  private calculateDiversity(signals: Array<{ signal: StrategySignal | null; }>): number {
    if (signals.length < 2) return 0;
    
    const actions = signals.map(s => s.signal?.action).filter(Boolean);
    const uniqueActions = new Set(actions);
    
    return uniqueActions.size / Math.max(actions.length, 1);
  }

  /**
   * Calculate risk assessment
   */
  private calculateRiskAssessment(signals: Array<any>, diversity: number): {
    overallRisk: number;
    concentration: number;
    correlation: number;
    diversityRisk: number;
  } {
    
    const overallRisk = signals.reduce((sum, s) => {
      if (!s.signal) return sum;
      const positionRisk = Math.abs(s.signal.entryPrice - (s.signal.stopLoss || s.signal.entryPrice)) / s.signal.entryPrice;
      return sum + positionRisk * s.weight;
    }, 0);
    
    const concentration = 1 - diversity; // High concentration = low diversity
    const correlation = this.calculateStrategyCorrelation();
    const diversityRisk = 1 - diversity;
    
    return {
      overallRisk,
      concentration,
      correlation,
      diversityRisk
    };
  }

  /**
   * Helper methods for ensemble calculations
   */
  private calculateEnsembleStopLoss(signals: Array<any>, action: 'BUY' | 'SELL', currentPrice: number): number {
    const validStops = signals
      .map((s: any) => s.signal?.stopLoss || s.stopLoss)
      .filter((stop: any) => stop && stop > 0);
    
    if (validStops.length === 0) {
      return action === 'BUY' ? currentPrice * 0.98 : currentPrice * 1.02;
    }
    
    return validStops.reduce((sum: number, stop: number) => sum + stop, 0) / validStops.length;
  }

  private calculateEnsembleTakeProfit(signals: Array<any>, action: 'BUY' | 'SELL', currentPrice: number): number {
    const validTargets = signals
      .map((s: any) => s.signal?.takeProfit || s.takeProfit)
      .filter((target: any) => target && target > 0);
    
    if (validTargets.length === 0) {
      return action === 'BUY' ? currentPrice * 1.04 : currentPrice * 0.96;
    }
    
    return validTargets.reduce((sum: number, target: number) => sum + target, 0) / validTargets.length;
  }

  private calculateConfidenceVariance(signals: Array<{ confidence: number; }>): number {
    const confidences = signals.map(s => s.confidence);
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
    return Math.sqrt(variance);
  }

  private calculateStrategyCorrelation(): number {
    // Simplified correlation calculation between strategies
    // In production, would calculate actual correlation of returns
    return 0.3; // Assume moderate correlation
  }

  private prepareMetaLearningFeatures(signals: Array<any>, marketCondition: any, context: StrategyContext): any[] {
    // Prepare features for meta-learning model
    return [
      marketCondition.volatility,
      marketCondition.trendStrength,
      signals.length,
      signals.filter(s => s.signal?.action === 'BUY').length,
      signals.filter(s => s.signal?.action === 'SELL').length,
      signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
      this.calculateConfidenceVariance(signals)
    ];
  }

  private createEmptyDecision(componentSignals: Array<any>, marketCondition: any): EnsembleDecision {
    return {
      finalSignal: null,
      confidence: 0,
      agreement: 0,
      diversity: 0,
      componentSignals: componentSignals.map(cs => ({
        strategyId: cs.strategyId,
        signal: cs.signal,
        weight: cs.weight,
        confidence: cs.confidence,
        contribution: 0
      })),
      marketCondition,
      riskAssessment: {
        overallRisk: 0,
        concentration: 0,
        correlation: 0,
        diversityRisk: 1
      },
      metadata: {
        aggregationMethod: this.ensembleConfig.aggregationMethod,
        activeStrategies: [],
        weights: Object.fromEntries(this.currentWeights),
        performanceMetrics: {}
      }
    };
  }

  private normalizeWeights(): void {
    let totalWeight = 0;
    for (const [strategyId, component] of this.strategies.entries()) {
      if (component.isActive) {
        totalWeight += component.weight;
      }
    }
    
    if (totalWeight > 0) {
      for (const [strategyId, component] of this.strategies.entries()) {
        if (component.isActive) {
          this.currentWeights.set(strategyId, component.weight / totalWeight);
        } else {
          this.currentWeights.set(strategyId, 0);
        }
      }
    }
  }

  private storeDecision(decision: EnsembleDecision): void {
    this.decisionHistory.push({
      timestamp: new Date(),
      decision
    });
    
    // Keep history bounded
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory.shift();
    }
  }

  private analyzeRecentPerformance(): any {
    // Analyze recent ensemble performance
    return {
      winRate: 0.6,
      avgReturn: 0.02,
      sharpeRatio: 1.2
    };
  }

  private getPerformanceSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [strategyId, component] of this.strategies.entries()) {
      snapshot[strategyId] = component.performance;
    }
    return snapshot;
  }

  private async retrainMetaLearningModel(): Promise<void> {
    // Retrain meta-learning model with recent decisions and outcomes
    console.log('🎯 Retraining meta-learning model...');
    // Implementation would retrain the model
  }

  /**
   * PUBLIC INTERFACE METHODS
   */

  public getDecisionHistory(): Array<{
    timestamp: Date;
    decision: EnsembleDecision;
    outcome?: 'WIN' | 'LOSS' | 'PENDING';
    actualReturn?: number;
  }> {
    return [...this.decisionHistory];
  }

  public getStrategyPerformance(): Map<string, any> {
    const performance = new Map();
    for (const [strategyId, component] of this.strategies.entries()) {
      performance.set(strategyId, {
        ...component.performance,
        weight: this.currentWeights.get(strategyId),
        isActive: component.isActive
      });
    }
    return performance;
  }

  public getCurrentWeights(): Map<string, number> {
    return new Map(this.currentWeights);
  }

  public getEnsembleConfig(): MLEnsembleConfig['ensemble'] {
    return this.ensembleConfig;
  }
}

export default MLEnsembleStrategy;