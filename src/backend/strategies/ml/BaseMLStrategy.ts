/**
 * Base ML Strategy Abstract Class - Task BE-026: ML Strategy Templates
 * 
 * Abstract base class for all machine learning-enhanced trading strategies providing:
 * - ML model integration and management
 * - Feature engineering and preprocessing
 * - Prediction confidence scoring
 * - Ensemble model support
 * - Online learning capabilities
 * - Performance monitoring for ML components
 */

import { BaseStrategy, StrategyConfig, StrategyContext, StrategySignal, StrategyMetrics } from '../BaseStrategy.js';
import { AutomatedTrainingPipeline, PipelineState } from '../../frontend/ml/training/AutomatedTrainingPipeline.js';
import { ModelManager } from '../../frontend/ml/inference/ModelManager.js';
import { featureEngine } from '../../frontend/ml/features/FeatureEngine.js';
import { FeatureVector } from '../../frontend/ml/features/types.js';
import { ModelEnsemble } from '../../frontend/ml/ensemble/ModelEnsemble.js';
import type { OHLCV, MarketDataWindow } from '../types.js';

/**
 * ML Strategy configuration extending base strategy config
 */
export interface MLStrategyConfig extends StrategyConfig {
  // ML-specific configuration
  ml: {
    modelTypes: Array<'PRICE_PREDICTION' | 'MARKET_REGIME' | 'VOLATILITY' | 'SENTIMENT'>;
    ensembleStrategy: 'AVERAGE' | 'WEIGHTED' | 'STACKING';
    minConfidenceThreshold: number;
    featureEngineeringConfig: {
      technicalIndicators: string[];
      lookbackPeriods: number[];
      priceFeatures: boolean;
      volumeFeatures: boolean;
      volatilityFeatures: boolean;
      marketStructureFeatures: boolean;
    };
    predictionHorizon: number; // minutes
    retrainingConfig: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
      minAccuracyThreshold: number;
      performanceDegradationThreshold: number;
    };
    onlineLearning: {
      enabled: boolean;
      batchSize: number;
      learningRate: number;
      forgettingFactor: number;
    };
  };
}

/**
 * ML Strategy metrics extending base metrics
 */
export interface MLStrategyMetrics extends StrategyMetrics {
  // ML-specific metrics
  modelAccuracy: number;
  modelPrecision: number;
  modelRecall: number;
  modelF1Score: number;
  averagePredictionConfidence: number;
  predictionLatency: number;
  featureCount: number;
  trainingTime: number;
  lastModelUpdate: Date;
  predictionAccuracyTrend: number[];
  confidenceCalibration: number;
  modelDrift: number;
  ensembleAgreement: number;
  featureImportance: Record<string, number>;
}

/**
 * ML prediction result
 */
export interface MLPrediction {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  probability: number;
  features: FeatureVector;
  modelPredictions: Record<string, {
    signal: string;
    confidence: number;
    weight: number;
  }>;
  explanation: {
    keyFactors: string[];
    riskFactors: string[];
    marketRegime: string;
    volatilityPrediction: number;
  };
}

/**
 * Abstract base class for ML-enhanced trading strategies
 */
export abstract class BaseMLStrategy extends BaseStrategy {
  protected mlConfig: MLStrategyConfig['ml'];
  protected trainingPipeline?: AutomatedTrainingPipeline;
  protected modelManager: ModelManager;
  protected modelEnsemble?: ModelEnsemble;
  protected mlMetrics: MLStrategyMetrics;
  
  // ML components
  protected activeModels: Map<string, string> = new Map();
  protected lastPredictions: MLPrediction[] = [];
  protected featureHistory: FeatureVector[] = [];
  protected predictionHistory: Array<{
    timestamp: Date;
    prediction: MLPrediction;
    actual?: number;
    correct?: boolean;
  }> = [];

  constructor(config: MLStrategyConfig) {
    super(config);
    this.mlConfig = config.ml;
    this.modelManager = new ModelManager();
    this.mlMetrics = this.initializeMLMetrics();
  }

  /**
   * ABSTRACT METHODS - Must be implemented by concrete ML strategies
   */

  /**
   * Define model training strategy
   */
  abstract defineTrainingStrategy(): Promise<{
    targetVariable: string;
    featureSelection: string[];
    modelArchitecture: any;
    trainingParameters: any;
  }>;

  /**
   * Process model prediction into trading signal
   */
  abstract processPrediction(prediction: MLPrediction, context: StrategyContext): Promise<StrategySignal | null>;

  /**
   * Validate prediction quality and confidence
   */
  abstract validatePrediction(prediction: MLPrediction, context: StrategyContext): boolean;

  /**
   * Handle model performance degradation
   */
  abstract onModelDegradation(modelId: string, currentMetrics: any): Promise<void>;

  /**
   * IMPLEMENTATION METHODS
   */

  /**
   * Initialize ML strategy with model setup and training
   */
  async initialize(): Promise<void> {
    console.log(`🤖 Initializing ML Strategy: ${this.config.name}`);

    try {
      // Initialize training pipeline
      await this.initializeTrainingPipeline();

      // Load or train models
      await this.initializeModels();

      // Setup ensemble if configured
      if (this.mlConfig.modelTypes.length > 1) {
        await this.initializeEnsemble();
      }

      // Setup performance monitoring
      await this.setupMLMonitoring();

      console.log(`✅ ML Strategy initialized with ${this.activeModels.size} models`);

    } catch (error) {
      console.error('❌ Failed to initialize ML Strategy:', error);
      throw error;
    }
  }

  /**
   * Main ML strategy execution
   */
  async execute(context: StrategyContext): Promise<StrategySignal | null> {
    const startTime = Date.now();

    try {
      // Generate features from market data
      const features = await this.generateFeatures(context);
      this.featureHistory.push(features);
      
      // Keep feature history bounded
      if (this.featureHistory.length > 1000) {
        this.featureHistory.shift();
      }

      // Make prediction using ensemble or single model
      const prediction = await this.makePrediction(features, context);
      
      // Validate prediction
      if (!this.validatePrediction(prediction, context)) {
        console.log(`⚠️ Prediction validation failed for ${context.marketData.symbol}`);
        return null;
      }

      // Store prediction for validation
      this.storePrediction(prediction);

      // Process prediction into trading signal
      const signal = await this.processPrediction(prediction, context);

      // Update metrics
      this.updateMLMetrics(Date.now() - startTime, prediction, signal);

      return signal;

    } catch (error) {
      console.error('ML Strategy execution failed:', error);
      return null;
    }
  }

  /**
   * Generate ML signal based on prediction
   */
  async generateSignal(context: StrategyContext): Promise<StrategySignal | null> {
    return await this.execute(context);
  }

  /**
   * Enhanced signal validation with ML confidence
   */
  async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    // Base validation
    const baseValid = await super.validateSignal?.(signal, context) ?? true;
    if (!baseValid) return false;

    // ML-specific validation
    const prediction = this.getLastPrediction();
    if (!prediction) return false;

    // Check confidence threshold
    if (prediction.confidence < this.mlConfig.minConfidenceThreshold) {
      return false;
    }

    // Check ensemble agreement if applicable
    if (this.modelEnsemble) {
      const agreement = this.calculateEnsembleAgreement(prediction);
      if (agreement < 0.6) { // 60% agreement threshold
        return false;
      }
    }

    // Check for conflicting signals
    if (this.hasConflictingSignals(prediction, signal)) {
      return false;
    }

    return true;
  }

  /**
   * ML-aware position sizing
   */
  async calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number> {
    const basePosSize = await super.calculatePositionSize(signal, context);
    const prediction = this.getLastPrediction();
    
    if (!prediction) return basePosSize;

    // Scale position size based on prediction confidence
    const confidenceMultiplier = Math.min(prediction.confidence / this.mlConfig.minConfidenceThreshold, 2.0);
    
    // Consider ensemble agreement
    let ensembleMultiplier = 1.0;
    if (this.modelEnsemble) {
      const agreement = this.calculateEnsembleAgreement(prediction);
      ensembleMultiplier = Math.max(agreement, 0.5); // At least 50% scaling
    }

    return basePosSize * confidenceMultiplier * ensembleMultiplier;
  }

  /**
   * Enhanced exit logic with ML predictions
   */
  async shouldExitPosition(position: any, context: StrategyContext): Promise<boolean> {
    const baseExit = await super.shouldExitPosition(position, context);
    if (baseExit) return true;

    const prediction = this.getLastPrediction();
    if (!prediction) return false;

    // Exit if prediction contradicts current position
    if (position.side === 'long' && prediction.signal === 'SELL' && prediction.confidence > 0.8) {
      return true;
    }
    
    if (position.side === 'short' && prediction.signal === 'BUY' && prediction.confidence > 0.8) {
      return true;
    }

    // Exit if market regime changed significantly
    const currentRegime = prediction.explanation.marketRegime;
    if (this.hasRegimeChange(currentRegime, position)) {
      return true;
    }

    return false;
  }

  /**
   * Cleanup ML resources
   */
  async cleanup(): Promise<void> {
    if (this.trainingPipeline) {
      this.trainingPipeline.dispose();
    }
    
    await this.modelManager.dispose();
    
    if (this.modelEnsemble) {
      await this.modelEnsemble.dispose();
    }
    
    console.log('🧹 ML Strategy resources cleaned up');
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  /**
   * Initialize training pipeline
   */
  private async initializeTrainingPipeline(): Promise<void> {
    const pipelineConfig = {
      mode: 'FULL_OPTIMIZATION' as const,
      enableContinuousLearning: this.mlConfig.retrainingConfig.enabled,
      retrainingTriggers: {
        performanceDegradation: true,
        dataThreshold: 500,
        timeThreshold: this.mlConfig.retrainingConfig.frequency === 'daily' ? 24 : 
                       this.mlConfig.retrainingConfig.frequency === 'weekly' ? 168 : 720
      },
      maxConcurrentJobs: 2,
      useWebWorkers: true,
      memoryLimit: 1000,
      timeLimit: 120,
      modelTypes: this.mlConfig.modelTypes,
      ensembleModels: this.mlConfig.modelTypes.length > 1,
      autoModelSelection: true,
      hyperparameterOptimization: {
        algorithm: 'bayesian' as const,
        maxTrials: 25,
        timeLimit: 60,
        targetMetric: 'f1Score' as const
      },
      validationStrategy: 'walk_forward' as const,
      earlyStoppingEnabled: true,
      minAccuracy: this.mlConfig.retrainingConfig.minAccuracyThreshold,
      minPrecision: 0.6,
      minRecall: 0.6,
      maxTrainingTime: 120,
      autoDeployment: true,
      deploymentConfig: {
        environment: 'production' as const,
        scalingPolicy: 'auto' as const,
        monitoringEnabled: true,
        rollbackEnabled: true
      },
      enablePerformanceMonitoring: true,
      alertThresholds: {
        accuracyDrop: this.mlConfig.retrainingConfig.performanceDegradationThreshold,
        latencyIncrease: 100,
        memoryUsage: 800
      }
    };

    this.trainingPipeline = new AutomatedTrainingPipeline(pipelineConfig);
  }

  /**
   * Initialize or load pre-trained models
   */
  private async initializeModels(): Promise<void> {
    for (const modelType of this.mlConfig.modelTypes) {
      try {
        // Try to load existing model
        const modelId = await this.modelManager.loadModel(`${modelType}_${this.config.id}`);
        
        if (modelId) {
          this.activeModels.set(modelType, modelId);
          console.log(`✅ Loaded existing ${modelType} model: ${modelId}`);
        } else {
          // Train new model if none exists
          await this.trainNewModel(modelType);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize ${modelType} model:`, error);
        // Continue with other models
      }
    }

    if (this.activeModels.size === 0) {
      throw new Error('No ML models could be initialized');
    }
  }

  /**
   * Train a new model for the specified type
   */
  private async trainNewModel(modelType: string): Promise<void> {
    if (!this.trainingPipeline) {
      throw new Error('Training pipeline not initialized');
    }

    console.log(`🎯 Training new ${modelType} model...`);

    // Define training strategy
    const strategy = await this.defineTrainingStrategy();

    // Get historical data (would need to be implemented)
    // const historicalData = await this.getHistoricalTrainingData();

    // For now, use mock data - in production this would be real historical data
    const historicalData: any[] = [];

    try {
      // Start training pipeline
      await this.trainingPipeline.startPipeline(
        historicalData,
        this.config.symbols[0],
        {
          targetVariable: strategy.targetVariable,
          customModels: [strategy.modelArchitecture]
        }
      );

      // Get trained model
      const pipelineState = this.trainingPipeline.getStatus();
      const completedJobs = pipelineState.completedJobs.filter(job => 
        job.status === 'COMPLETED' && job.modelType === modelType
      );

      if (completedJobs.length > 0) {
        const modelId = completedJobs[0].result?.model as string;
        this.activeModels.set(modelType, modelId);
        console.log(`✅ Successfully trained ${modelType} model: ${modelId}`);
      }

    } catch (error) {
      console.error(`❌ Failed to train ${modelType} model:`, error);
      throw error;
    }
  }

  /**
   * Initialize model ensemble
   */
  private async initializeEnsemble(): Promise<void> {
    const modelIds = Array.from(this.activeModels.values());
    
    if (modelIds.length < 2) {
      console.log('⚠️ Not enough models for ensemble, using single model');
      return;
    }

    this.modelEnsemble = new ModelEnsemble({
      models: modelIds.map(id => ({ id, weight: 1.0 })), // Equal weights initially
      aggregationMethod: this.mlConfig.ensembleStrategy.toLowerCase() as any,
      weightingStrategy: 'performance',
      enableDynamicWeights: true,
      performanceWindow: 100,
      minModelAgreement: 0.6
    });

    await this.modelEnsemble.initialize();
    console.log(`🎯 Initialized ensemble with ${modelIds.length} models`);
  }

  /**
   * Setup ML-specific monitoring
   */
  private async setupMLMonitoring(): Promise<void> {
    // Setup periodic model performance evaluation
    setInterval(async () => {
      await this.evaluateModelPerformance();
    }, 300000); // Every 5 minutes

    // Setup retraining triggers
    if (this.mlConfig.retrainingConfig.enabled) {
      setInterval(async () => {
        await this.checkRetrainingTriggers();
      }, 3600000); // Every hour
    }
  }

  /**
   * Generate features from market data
   */
  private async generateFeatures(context: StrategyContext): Promise<FeatureVector> {
    const marketData = context.marketData;
    const config = this.mlConfig.featureEngineeringConfig;

    // Generate features using the feature engine
    const features = await featureEngine.generateFeatures(
      marketData as any,
      {
        technicalIndicators: config.technicalIndicators,
        lookbackPeriods: config.lookbackPeriods,
        includePriceFeatures: config.priceFeatures,
        includeVolumeFeatures: config.volumeFeatures,
        includeVolatilityFeatures: config.volatilityFeatures,
        includeMarketStructure: config.marketStructureFeatures
      }
    );

    return features;
  }

  /**
   * Make prediction using active models
   */
  private async makePrediction(features: FeatureVector, context: StrategyContext): Promise<MLPrediction> {
    if (this.modelEnsemble && this.activeModels.size > 1) {
      // Use ensemble prediction
      return await this.makeEnsemblePrediction(features, context);
    } else {
      // Use single model prediction
      return await this.makeSingleModelPrediction(features, context);
    }
  }

  /**
   * Make ensemble prediction
   */
  private async makeEnsemblePrediction(features: FeatureVector, context: StrategyContext): Promise<MLPrediction> {
    if (!this.modelEnsemble) {
      throw new Error('Ensemble not initialized');
    }

    const ensembleResult = await this.modelEnsemble.predict(features);
    
    return {
      signal: ensembleResult.prediction > 0.5 ? 'BUY' : ensembleResult.prediction < -0.5 ? 'SELL' : 'HOLD',
      confidence: ensembleResult.confidence,
      probability: Math.abs(ensembleResult.prediction),
      features,
      modelPredictions: ensembleResult.modelPredictions,
      explanation: {
        keyFactors: ensembleResult.featureImportance?.slice(0, 5).map(f => f.feature) || [],
        riskFactors: this.identifyRiskFactors(features, context),
        marketRegime: this.determineMarketRegime(features),
        volatilityPrediction: ensembleResult.volatilityPrediction || 0.02
      }
    };
  }

  /**
   * Make single model prediction
   */
  private async makeSingleModelPrediction(features: FeatureVector, context: StrategyContext): Promise<MLPrediction> {
    const modelType = this.mlConfig.modelTypes[0];
    const modelId = this.activeModels.get(modelType);
    
    if (!modelId) {
      throw new Error(`No active model found for type: ${modelType}`);
    }

    const prediction = await this.modelManager.predict(modelId, features);
    
    return {
      signal: prediction.value > 0.5 ? 'BUY' : prediction.value < -0.5 ? 'SELL' : 'HOLD',
      confidence: prediction.confidence,
      probability: Math.abs(prediction.value),
      features,
      modelPredictions: {
        [modelType]: {
          signal: prediction.value > 0.5 ? 'BUY' : prediction.value < -0.5 ? 'SELL' : 'HOLD',
          confidence: prediction.confidence,
          weight: 1.0
        }
      },
      explanation: {
        keyFactors: prediction.featureImportance?.slice(0, 5) || [],
        riskFactors: this.identifyRiskFactors(features, context),
        marketRegime: this.determineMarketRegime(features),
        volatilityPrediction: prediction.volatility || 0.02
      }
    };
  }

  /**
   * Store prediction for later validation
   */
  private storePrediction(prediction: MLPrediction): void {
    this.lastPredictions.push(prediction);
    
    // Keep only last 10 predictions
    if (this.lastPredictions.length > 10) {
      this.lastPredictions.shift();
    }

    // Store for historical validation
    this.predictionHistory.push({
      timestamp: new Date(),
      prediction
    });

    // Keep history bounded
    if (this.predictionHistory.length > 1000) {
      this.predictionHistory.shift();
    }
  }

  /**
   * Get last prediction
   */
  private getLastPrediction(): MLPrediction | null {
    return this.lastPredictions[this.lastPredictions.length - 1] || null;
  }

  /**
   * Calculate ensemble agreement
   */
  private calculateEnsembleAgreement(prediction: MLPrediction): number {
    const predictions = Object.values(prediction.modelPredictions);
    if (predictions.length < 2) return 1.0;

    const buyCount = predictions.filter(p => p.signal === 'BUY').length;
    const sellCount = predictions.filter(p => p.signal === 'SELL').length;
    const holdCount = predictions.filter(p => p.signal === 'HOLD').length;

    const maxCount = Math.max(buyCount, sellCount, holdCount);
    return maxCount / predictions.length;
  }

  /**
   * Check for conflicting signals
   */
  private hasConflictingSignals(prediction: MLPrediction, signal: StrategySignal): boolean {
    // This would implement logic to check if the ML prediction conflicts with
    // other signal sources or technical indicators
    return false; // Simplified for now
  }

  /**
   * Check for market regime changes
   */
  private hasRegimeChange(currentRegime: string, position: any): boolean {
    // This would implement regime change detection logic
    return false; // Simplified for now
  }

  /**
   * Identify risk factors from features
   */
  private identifyRiskFactors(features: FeatureVector, context: StrategyContext): string[] {
    const riskFactors: string[] = [];
    
    // Check for high volatility
    if (features.volatility && features.volatility > 0.05) {
      riskFactors.push('High volatility detected');
    }

    // Check for low liquidity
    if (features.volume && features.volume < features.volumeAverage * 0.5) {
      riskFactors.push('Low liquidity conditions');
    }

    // Check for unusual market conditions
    if (features.rsi && (features.rsi > 80 || features.rsi < 20)) {
      riskFactors.push('Extreme RSI levels');
    }

    return riskFactors;
  }

  /**
   * Determine current market regime
   */
  private determineMarketRegime(features: FeatureVector): string {
    // Simplified market regime detection
    if (features.volatility && features.volatility > 0.04) {
      return 'HIGH_VOLATILITY';
    } else if (features.trend && Math.abs(features.trend) > 0.02) {
      return features.trend > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
    } else {
      return 'SIDEWAYS';
    }
  }

  /**
   * Evaluate model performance
   */
  private async evaluateModelPerformance(): Promise<void> {
    for (const [modelType, modelId] of this.activeModels.entries()) {
      try {
        const metrics = await this.modelManager.getModelMetrics(modelId);
        
        // Check for performance degradation
        if (metrics.accuracy < this.mlConfig.retrainingConfig.minAccuracyThreshold) {
          console.log(`⚠️ Performance degradation detected for ${modelType} model`);
          await this.onModelDegradation(modelId, metrics);
        }
        
        // Update ML metrics
        this.mlMetrics.modelAccuracy = metrics.accuracy;
        this.mlMetrics.modelPrecision = metrics.precision;
        this.mlMetrics.modelRecall = metrics.recall;
        this.mlMetrics.modelF1Score = metrics.f1Score;
        
      } catch (error) {
        console.error(`Failed to evaluate performance for model ${modelId}:`, error);
      }
    }
  }

  /**
   * Check retraining triggers
   */
  private async checkRetrainingTriggers(): Promise<void> {
    // Implementation would check various conditions for triggering retraining
    // This is a simplified version
  }

  /**
   * Update ML-specific metrics
   */
  private updateMLMetrics(executionTime: number, prediction: MLPrediction, signal: StrategySignal | null): void {
    this.mlMetrics.predictionLatency = executionTime;
    this.mlMetrics.averagePredictionConfidence = 
      (this.mlMetrics.averagePredictionConfidence * this.mlMetrics.executionCount + prediction.confidence) / 
      (this.mlMetrics.executionCount + 1);
    
    this.mlMetrics.featureCount = Object.keys(prediction.features).length;
    this.mlMetrics.lastModelUpdate = new Date();
    
    // Update feature importance
    if (prediction.explanation.keyFactors) {
      prediction.explanation.keyFactors.forEach(factor => {
        this.mlMetrics.featureImportance[factor] = 
          (this.mlMetrics.featureImportance[factor] || 0) + 1;
      });
    }
    
    // Update ensemble agreement
    if (this.modelEnsemble) {
      this.mlMetrics.ensembleAgreement = this.calculateEnsembleAgreement(prediction);
    }
  }

  /**
   * Initialize ML-specific metrics
   */
  private initializeMLMetrics(): MLStrategyMetrics {
    return {
      ...this.initializeMetrics(),
      modelAccuracy: 0,
      modelPrecision: 0,
      modelRecall: 0,
      modelF1Score: 0,
      averagePredictionConfidence: 0,
      predictionLatency: 0,
      featureCount: 0,
      trainingTime: 0,
      lastModelUpdate: new Date(),
      predictionAccuracyTrend: [],
      confidenceCalibration: 0,
      modelDrift: 0,
      ensembleAgreement: 0,
      featureImportance: {}
    };
  }

  /**
   * Get ML-specific metrics
   */
  public getMLMetrics(): MLStrategyMetrics {
    return { ...this.mlMetrics };
  }

  /**
   * Get prediction history
   */
  public getPredictionHistory(): Array<{ timestamp: Date; prediction: MLPrediction; actual?: number; correct?: boolean; }> {
    return [...this.predictionHistory];
  }

  /**
   * Get active models
   */
  public getActiveModels(): Map<string, string> {
    return new Map(this.activeModels);
  }
}

export default BaseMLStrategy;