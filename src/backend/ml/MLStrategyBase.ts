/**
 * ML Strategy Base Class - Task ML-004
 * 
 * Abstract base class for ML-enhanced trading strategies with integrated feature generation,
 * prediction pipeline, and confidence scoring system.
 * 
 * Features:
 * - Abstract base for ML trading strategies
 * - Feature generation integration
 * - Prediction pipeline with multiple models
 * - Confidence scoring and signal validation
 * - Real-time prediction capabilities
 * - Performance tracking and adaptation
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { FeatureEngineeringPipeline, ComputedFeatures } from './FeatureEngineering';
import { BasicMLModels, TrainingData, PredictionResult } from './BasicMLModels';
import { getTensorFlowSetup } from './TensorFlowSetup';
import { CandleData } from './FeatureEngineering';

export interface MLStrategyConfig {
  id: string;
  name: string;
  description: string;
  
  // Model configuration
  modelIds: string[];
  ensembleMethod: 'weighted_average' | 'voting' | 'stacking' | 'confidence_weighted';
  
  // Feature configuration
  featureConfig: {
    lookbackPeriod: number;
    includePrice: boolean;
    includeVolume: boolean;
    includeTechnical: boolean;
    includePriceAction: boolean;
    normalization: 'minmax' | 'zscore' | 'robust' | 'none';
  };
  
  // Signal thresholds
  thresholds: {
    buySignal: number;
    sellSignal: number;
    minConfidence: number;
    maxPositions: number;
  };
  
  // Risk management
  riskManagement: {
    stopLoss: number;
    takeProfit: number;
    maxDrawdown: number;
    positionSizing: 'fixed' | 'kelly' | 'volatility_adjusted';
  };
}

export interface MLSignal {
  timestamp: number;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number; // 0-1
  
  // Prediction details
  predictions: {
    modelId: string;
    prediction: number | number[];
    confidence: number;
    weight: number;
  }[];
  
  // Feature information
  features: ComputedFeatures;
  
  // Risk assessment
  riskScore: number;
  positionSize: number;
  
  // Model explanations
  explanations: Array<{
    modelId: string;
    topFeatures: Array<{
      name: string;
      importance: number;
      value: number;
    }>;
  }>;
}

export interface MLStrategyPerformance {
  totalSignals: number;
  correctSignals: number;
  accuracy: number;
  
  // Returns
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  
  // Model performance
  modelPerformance: Map<string, {
    accuracy: number;
    avgConfidence: number;
    signalCount: number;
    lastUsed: number;
  }>;
  
  // Feature importance
  featureImportance: Map<string, number>;
  
  // Time-based metrics
  performanceByPeriod: Array<{
    period: string;
    accuracy: number;
    return: number;
    signalCount: number;
  }>;
}

export interface RetrainingTrigger {
  type: 'performance_degradation' | 'time_based' | 'concept_drift' | 'manual';
  threshold: number;
  enabled: boolean;
}

/**
 * Abstract ML Strategy Base Class
 */
export abstract class MLStrategyBase extends EventEmitter {
  protected config: MLStrategyConfig;
  protected featureEngine: FeatureEngineeringPipeline;
  protected mlModels: BasicMLModels;
  protected tensorflowSetup = getTensorFlowSetup();
  
  // Strategy state
  protected models: Map<string, tf.LayersModel> = new Map();
  protected modelWeights: Map<string, number> = new Map();
  protected performance: MLStrategyPerformance;
  protected isActive = false;
  protected lastSignal: MLSignal | null = null;
  protected recentPerformance: number[] = [];
  
  // Retraining configuration
  protected retrainingTriggers: RetrainingTrigger[] = [
    { type: 'performance_degradation', threshold: 0.1, enabled: true },
    { type: 'time_based', threshold: 7 * 24 * 60 * 60 * 1000, enabled: true }, // 7 days
    { type: 'concept_drift', threshold: 0.15, enabled: true }
  ];
  
  protected lastRetraining = 0;

  constructor(config: MLStrategyConfig) {
    super();
    this.config = config;
    
    // Initialize components
    this.featureEngine = new FeatureEngineeringPipeline({
      lookbackPeriod: config.featureConfig.lookbackPeriod,
      includePrice: config.featureConfig.includePrice,
      includeVolume: config.featureConfig.includeVolume,
      includeTechnical: config.featureConfig.includeTechnical,
      includePriceAction: config.featureConfig.includePriceAction,
      normalization: config.featureConfig.normalization
    });
    
    this.mlModels = new BasicMLModels();
    
    // Initialize performance tracking
    this.performance = {
      totalSignals: 0,
      correctSignals: 0,
      accuracy: 0,
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      modelPerformance: new Map(),
      featureImportance: new Map(),
      performanceByPeriod: []
    };
    
    // Initialize model weights equally
    config.modelIds.forEach(modelId => {
      this.modelWeights.set(modelId, 1 / config.modelIds.length);
    });
    
    console.log(`🤖 ML Strategy initialized: ${config.name}`);
    console.log(`📊 Models: ${config.modelIds.join(', ')}`);
    console.log(`🎯 Ensemble method: ${config.ensembleMethod}`);
  }

  /**
   * Initialize the strategy (load models, setup components)
   */
  async initialize(): Promise<void> {
    try {
      console.log(`🚀 Initializing ML Strategy: ${this.config.name}`);
      
      // Ensure TensorFlow is ready
      await this.tensorflowSetup.initialize();
      
      // Load models (abstract - implemented by concrete strategies)
      await this.loadModels();
      
      // Validate configuration
      this.validateConfiguration();
      
      this.isActive = true;
      console.log(`✅ ML Strategy ${this.config.name} initialized and active`);
      
      this.emit('initialized', { strategyId: this.config.id });
      
    } catch (error) {
      console.error(`❌ Failed to initialize ML Strategy ${this.config.name}:`, error);
      this.emit('initializationError', { strategyId: this.config.id, error });
      throw error;
    }
  }

  /**
   * Generate ML signal from market data
   */
  async generateSignal(
    candleData: CandleData[],
    symbol: string,
    currentTimestamp: number = Date.now()
  ): Promise<MLSignal> {
    if (!this.isActive) {
      throw new Error(`Strategy ${this.config.name} is not active`);
    }

    try {
      console.log(`🔮 Generating ML signal for ${symbol}`);
      
      // Extract features
      const features = await this.featureEngine.extractFeatures(
        candleData, 
        symbol, 
        currentTimestamp
      );
      
      // Get predictions from all models
      const predictions: MLSignal['predictions'] = [];
      
      for (const modelId of this.config.modelIds) {
        const model = this.models.get(modelId);
        if (!model) {
          console.warn(`⚠️  Model ${modelId} not loaded, skipping`);
          continue;
        }
        
        try {
          const prediction = await this.mlModels.predict(
            model,
            features.features,
            features.featureNames
          );
          
          predictions.push({
            modelId,
            prediction: prediction.prediction,
            confidence: prediction.confidence,
            weight: this.modelWeights.get(modelId) || 0
          });
          
        } catch (error) {
          console.error(`❌ Prediction failed for model ${modelId}:`, error);
        }
      }
      
      if (predictions.length === 0) {
        throw new Error('No valid predictions generated');
      }
      
      // Combine predictions using ensemble method
      const combinedPrediction = this.combinesPredictions(predictions);
      
      // Generate signal based on thresholds
      const signal = this.determineSignal(combinedPrediction);
      
      // Calculate risk score
      const riskScore = await this.calculateRiskScore(features, predictions, symbol);
      
      // Calculate position size
      const positionSize = this.calculatePositionSize(
        combinedPrediction.confidence,
        riskScore,
        candleData[candleData.length - 1]
      );
      
      // Generate explanations
      const explanations = this.generateExplanations(predictions, features);
      
      // Create ML signal
      const mlSignal: MLSignal = {
        timestamp: currentTimestamp,
        symbol,
        signal: signal.direction,
        confidence: combinedPrediction.confidence,
        strength: signal.strength,
        predictions,
        features,
        riskScore,
        positionSize,
        explanations
      };
      
      // Update performance tracking
      this.updatePerformanceTracking(mlSignal);
      
      // Check retraining triggers
      await this.checkRetrainingTriggers(mlSignal);
      
      this.lastSignal = mlSignal;
      
      console.log(`✅ ML Signal generated: ${signal.direction} (confidence: ${(combinedPrediction.confidence * 100).toFixed(1)}%)`);
      
      this.emit('signalGenerated', mlSignal);
      return mlSignal;
      
    } catch (error) {
      console.error(`❌ Signal generation failed for ${symbol}:`, error);
      this.emit('signalError', { symbol, error });
      throw error;
    }
  }

  /**
   * Update strategy performance based on actual results
   */
  async updatePerformance(
    signalId: string,
    actualOutcome: {
      actualPrice: number;
      actualDirection: 'BUY' | 'SELL' | 'HOLD';
      return: number;
      timestamp: number;
    }
  ): Promise<void> {
    try {
      if (!this.lastSignal) return;
      
      const signal = this.lastSignal;
      const wasCorrect = signal.signal === actualOutcome.actualDirection;
      
      // Update overall performance
      this.performance.totalSignals++;
      if (wasCorrect) {
        this.performance.correctSignals++;
      }
      this.performance.accuracy = this.performance.correctSignals / this.performance.totalSignals;
      
      // Update recent performance
      this.recentPerformance.push(wasCorrect ? 1 : 0);
      if (this.recentPerformance.length > 50) {
        this.recentPerformance.shift();
      }
      
      // Update model-specific performance
      for (const prediction of signal.predictions) {
        const modelPerf = this.performance.modelPerformance.get(prediction.modelId) || {
          accuracy: 0.5,
          avgConfidence: 0.5,
          signalCount: 0,
          lastUsed: Date.now()
        };
        
        modelPerf.signalCount++;
        modelPerf.accuracy = (modelPerf.accuracy * (modelPerf.signalCount - 1) + (wasCorrect ? 1 : 0)) / modelPerf.signalCount;
        modelPerf.avgConfidence = (modelPerf.avgConfidence * (modelPerf.signalCount - 1) + prediction.confidence) / modelPerf.signalCount;
        modelPerf.lastUsed = Date.now();
        
        this.performance.modelPerformance.set(prediction.modelId, modelPerf);
      }
      
      // Update adaptive weights based on performance
      await this.updateModelWeights(signal, wasCorrect);
      
      // Update trading metrics
      this.updateTradingMetrics(actualOutcome.return);
      
      console.log(`📊 Performance updated. Accuracy: ${(this.performance.accuracy * 100).toFixed(1)}%`);
      
      this.emit('performanceUpdated', { 
        signalId, 
        wasCorrect, 
        performance: this.performance 
      });
      
    } catch (error) {
      console.error(`❌ Performance update failed:`, error);
    }
  }

  /**
   * Abstract methods to be implemented by concrete strategies
   */
  protected abstract loadModels(): Promise<void>;
  protected abstract trainModels(trainingData: TrainingData[]): Promise<void>;
  protected abstract validateStrategy(candleData: CandleData[]): Promise<boolean>;

  /**
   * PREDICTION COMBINATION METHODS
   */

  protected combinesPredictions(predictions: MLSignal['predictions']): {
    prediction: number;
    confidence: number;
  } {
    if (predictions.length === 0) {
      return { prediction: 0, confidence: 0 };
    }

    switch (this.config.ensembleMethod) {
      case 'weighted_average':
        return this.weightedAveragePrediction(predictions);
      
      case 'voting':
        return this.votingPrediction(predictions);
      
      case 'confidence_weighted':
        return this.confidenceWeightedPrediction(predictions);
      
      case 'stacking':
        return this.stackingPrediction(predictions);
      
      default:
        return this.weightedAveragePrediction(predictions);
    }
  }

  private weightedAveragePrediction(predictions: MLSignal['predictions']): {
    prediction: number;
    confidence: number;
  } {
    let weightedSum = 0;
    let confidenceSum = 0;
    let totalWeight = 0;

    for (const pred of predictions) {
      const prediction = Array.isArray(pred.prediction) ? pred.prediction[0] : pred.prediction;
      weightedSum += prediction * pred.weight;
      confidenceSum += pred.confidence * pred.weight;
      totalWeight += pred.weight;
    }

    return {
      prediction: totalWeight > 0 ? weightedSum / totalWeight : 0,
      confidence: totalWeight > 0 ? confidenceSum / totalWeight : 0
    };
  }

  private votingPrediction(predictions: MLSignal['predictions']): {
    prediction: number;
    confidence: number;
  } {
    const votes = { positive: 0, negative: 0, neutral: 0 };
    let avgConfidence = 0;

    for (const pred of predictions) {
      const prediction = Array.isArray(pred.prediction) ? pred.prediction[0] : pred.prediction;
      
      if (prediction > 0.1) votes.positive++;
      else if (prediction < -0.1) votes.negative++;
      else votes.neutral++;
      
      avgConfidence += pred.confidence;
    }

    avgConfidence /= predictions.length;
    
    const maxVotes = Math.max(votes.positive, votes.negative, votes.neutral);
    let finalPrediction = 0;
    
    if (maxVotes === votes.positive) finalPrediction = 1;
    else if (maxVotes === votes.negative) finalPrediction = -1;
    
    // Confidence based on consensus
    const consensus = maxVotes / predictions.length;
    const confidence = avgConfidence * consensus;

    return { prediction: finalPrediction, confidence };
  }

  private confidenceWeightedPrediction(predictions: MLSignal['predictions']): {
    prediction: number;
    confidence: number;
  } {
    let weightedSum = 0;
    let totalConfidence = 0;

    for (const pred of predictions) {
      const prediction = Array.isArray(pred.prediction) ? pred.prediction[0] : pred.prediction;
      weightedSum += prediction * pred.confidence;
      totalConfidence += pred.confidence;
    }

    return {
      prediction: totalConfidence > 0 ? weightedSum / totalConfidence : 0,
      confidence: totalConfidence / predictions.length
    };
  }

  private stackingPrediction(predictions: MLSignal['predictions']): {
    prediction: number;
    confidence: number;
  } {
    // Simplified stacking - in reality would use a trained meta-learner
    const features = predictions.map(p => ({
      prediction: Array.isArray(p.prediction) ? p.prediction[0] : p.prediction,
      confidence: p.confidence,
      weight: p.weight
    }));

    // Simple linear combination with learned coefficients (simplified)
    let finalPrediction = 0;
    let totalWeight = 0;
    let avgConfidence = 0;

    for (const feature of features) {
      const coefficient = feature.confidence * feature.weight;
      finalPrediction += feature.prediction * coefficient;
      totalWeight += coefficient;
      avgConfidence += feature.confidence;
    }

    return {
      prediction: totalWeight > 0 ? finalPrediction / totalWeight : 0,
      confidence: avgConfidence / features.length
    };
  }

  /**
   * SIGNAL GENERATION
   */

  protected determineSignal(combinedPrediction: { prediction: number; confidence: number }): {
    direction: 'BUY' | 'SELL' | 'HOLD';
    strength: number;
  } {
    const { prediction, confidence } = combinedPrediction;
    
    // Check minimum confidence threshold
    if (confidence < this.config.thresholds.minConfidence) {
      return { direction: 'HOLD', strength: 0 };
    }

    // Determine direction based on prediction and thresholds
    if (prediction >= this.config.thresholds.buySignal) {
      const strength = Math.min(1, prediction * confidence);
      return { direction: 'BUY', strength };
    } else if (prediction <= this.config.thresholds.sellSignal) {
      const strength = Math.min(1, Math.abs(prediction) * confidence);
      return { direction: 'SELL', strength };
    }

    return { direction: 'HOLD', strength: 0 };
  }

  /**
   * RISK AND POSITION MANAGEMENT
   */

  protected async calculateRiskScore(
    features: ComputedFeatures,
    predictions: MLSignal['predictions'],
    symbol: string
  ): Promise<number> {
    // Base risk from prediction disagreement
    const predictionValues = predictions.map(p => 
      Array.isArray(p.prediction) ? p.prediction[0] : p.prediction
    );
    
    const mean = predictionValues.reduce((a, b) => a + b, 0) / predictionValues.length;
    const variance = predictionValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictionValues.length;
    const disagreementRisk = Math.sqrt(variance);

    // Volatility-based risk (from features)
    const volatilityFeatures = features.featureNames
      .map((name, i) => ({ name, value: features.features[i] }))
      .filter(f => f.name.includes('volatility') || f.name.includes('atr'));
    
    const avgVolatility = volatilityFeatures.length > 0 
      ? volatilityFeatures.reduce((sum, f) => sum + Math.abs(f.value), 0) / volatilityFeatures.length
      : 0.02; // Default volatility

    // Confidence-based risk
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    const confidenceRisk = 1 - avgConfidence;

    // Combine risk factors
    const totalRisk = (disagreementRisk * 0.4 + avgVolatility * 0.4 + confidenceRisk * 0.2);
    
    return Math.min(1, Math.max(0, totalRisk));
  }

  protected calculatePositionSize(confidence: number, riskScore: number, currentCandle: CandleData): number {
    const baseSize = 0.1; // 10% base position
    
    switch (this.config.riskManagement.positionSizing) {
      case 'fixed':
        return baseSize;
      
      case 'kelly':
        // Simplified Kelly criterion
        const winRate = this.performance.winRate || 0.5;
        const avgReturn = this.performance.totalReturn / Math.max(this.performance.totalSignals, 1);
        const kelly = (winRate * avgReturn - (1 - winRate)) / avgReturn;
        return Math.max(0, Math.min(baseSize * 3, kelly * confidence));
      
      case 'volatility_adjusted':
        const volatilityAdjustment = 1 / (1 + riskScore);
        return baseSize * confidence * volatilityAdjustment;
      
      default:
        return baseSize * confidence;
    }
  }

  /**
   * EXPLANATION AND INTERPRETABILITY
   */

  protected generateExplanations(
    predictions: MLSignal['predictions'],
    features: ComputedFeatures
  ): MLSignal['explanations'] {
    const explanations: MLSignal['explanations'] = [];

    for (const prediction of predictions) {
      const explanation = prediction as any; // Access explanation from prediction
      if (explanation && Array.isArray(explanation.explanation)) {
        explanations.push({
          modelId: prediction.modelId,
          topFeatures: explanation.explanation.slice(0, 5).map((feat: any) => ({
            name: feat.featureName,
            importance: feat.importance,
            value: features.features[features.featureNames.indexOf(feat.featureName)] || 0
          }))
        });
      }
    }

    return explanations;
  }

  /**
   * PERFORMANCE AND ADAPTATION
   */

  protected updatePerformanceTracking(signal: MLSignal): void {
    // Update feature importance based on signal strength
    for (let i = 0; i < signal.features.featureNames.length; i++) {
      const featureName = signal.features.featureNames[i];
      const currentImportance = this.performance.featureImportance.get(featureName) || 0;
      const newImportance = currentImportance * 0.99 + signal.confidence * 0.01;
      this.performance.featureImportance.set(featureName, newImportance);
    }
  }

  protected async updateModelWeights(signal: MLSignal, wasCorrect: boolean): Promise<void> {
    const learningRate = 0.01;
    const feedback = wasCorrect ? 1 : 0;

    for (const prediction of signal.predictions) {
      const currentWeight = this.modelWeights.get(prediction.modelId) || 0.5;
      const performance = feedback * prediction.confidence;
      const newWeight = currentWeight + learningRate * (performance - 0.5);
      
      this.modelWeights.set(prediction.modelId, Math.max(0.1, Math.min(1.0, newWeight)));
    }

    // Normalize weights
    const totalWeight = Array.from(this.modelWeights.values()).reduce((a, b) => a + b, 0);
    if (totalWeight > 0) {
      for (const [modelId, weight] of this.modelWeights.entries()) {
        this.modelWeights.set(modelId, weight / totalWeight);
      }
    }
  }

  protected updateTradingMetrics(returnValue: number): void {
    this.performance.totalReturn += returnValue;
    
    // Update win rate
    const recentReturns = this.recentPerformance.slice(-20);
    this.performance.winRate = recentReturns.filter(r => r > 0).length / recentReturns.length;
    
    // Simple Sharpe ratio calculation
    if (this.recentPerformance.length > 10) {
      const avgReturn = this.recentPerformance.reduce((a, b) => a + b, 0) / this.recentPerformance.length;
      const variance = this.recentPerformance.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / this.recentPerformance.length;
      this.performance.sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;
    }
  }

  /**
   * RETRAINING SYSTEM
   */

  protected async checkRetrainingTriggers(signal: MLSignal): Promise<void> {
    for (const trigger of this.retrainingTriggers) {
      if (!trigger.enabled) continue;

      let shouldRetrain = false;

      switch (trigger.type) {
        case 'performance_degradation':
          const recentAccuracy = this.recentPerformance.length > 10 
            ? this.recentPerformance.slice(-10).reduce((a, b) => a + b, 0) / 10
            : 0.5;
          
          shouldRetrain = (this.performance.accuracy - recentAccuracy) > trigger.threshold;
          break;

        case 'time_based':
          shouldRetrain = (Date.now() - this.lastRetraining) > trigger.threshold;
          break;

        case 'concept_drift':
          // Simplified concept drift detection
          const oldPerformance = this.recentPerformance.slice(0, Math.floor(this.recentPerformance.length / 2));
          const newPerformance = this.recentPerformance.slice(Math.floor(this.recentPerformance.length / 2));
          
          if (oldPerformance.length > 5 && newPerformance.length > 5) {
            const oldAvg = oldPerformance.reduce((a, b) => a + b, 0) / oldPerformance.length;
            const newAvg = newPerformance.reduce((a, b) => a + b, 0) / newPerformance.length;
            shouldRetrain = Math.abs(oldAvg - newAvg) > trigger.threshold;
          }
          break;
      }

      if (shouldRetrain) {
        console.log(`🔄 Retraining triggered by: ${trigger.type}`);
        this.emit('retrainingTriggered', { 
          trigger: trigger.type, 
          strategyId: this.config.id 
        });
        
        // Note: Actual retraining implementation would be in concrete strategy classes
        this.lastRetraining = Date.now();
        break;
      }
    }
  }

  /**
   * CONFIGURATION AND VALIDATION
   */

  protected validateConfiguration(): void {
    if (this.config.modelIds.length === 0) {
      throw new Error('At least one model ID must be specified');
    }

    if (this.config.thresholds.buySignal <= this.config.thresholds.sellSignal) {
      throw new Error('Buy signal threshold must be greater than sell signal threshold');
    }

    if (this.config.thresholds.minConfidence < 0 || this.config.thresholds.minConfidence > 1) {
      throw new Error('Minimum confidence must be between 0 and 1');
    }

    console.log('✅ Configuration validated');
  }

  /**
   * Public getters
   */
  getPerformance(): MLStrategyPerformance {
    return { ...this.performance };
  }

  getConfig(): MLStrategyConfig {
    return { ...this.config };
  }

  isStrategyActive(): boolean {
    return this.isActive;
  }

  getLastSignal(): MLSignal | null {
    return this.lastSignal;
  }

  /**
   * Cleanup and disposal
   */
  async dispose(): Promise<void> {
    this.isActive = false;
    
    // Dispose models
    for (const model of this.models.values()) {
      model.dispose();
    }
    
    this.models.clear();
    this.modelWeights.clear();
    
    // Dispose ML components
    this.mlModels.dispose();
    
    console.log(`🧹 ML Strategy ${this.config.name} disposed`);
  }
}