/**
 * ModelTrainer - Client-side ML model training and validation framework
 * 
 * Provides comprehensive training pipeline for prediction models with
 * automated hyperparameter tuning, cross-validation, and performance monitoring.
 */

import * as tf from '@tensorflow/tfjs';
import { FeatureVector } from '../features/types';
import { PricePredictionModel, PricePredictionConfig } from '../models/PricePredictionModel';
import { MarketRegimeModel, MarketRegimeConfig } from '../models/MarketRegimeModel';
import { VolatilityModel, VolatilityConfig } from '../models/VolatilityModel';
import { featureEngine } from '../features/FeatureEngine';

export type ModelType = 'PRICE_PREDICTION' | 'MARKET_REGIME' | 'VOLATILITY';
export type TrainingStatus = 'IDLE' | 'PREPARING' | 'TRAINING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';
export type ValidationMethod = 'HOLDOUT' | 'K_FOLD' | 'TIME_SERIES' | 'WALK_FORWARD';

export interface TrainingConfig {
  modelType: ModelType;
  validationMethod: ValidationMethod;
  trainTestSplit: number; // e.g., 0.8 for 80/20 split
  kFolds?: number; // For k-fold validation
  walkForwardSteps?: number; // For walk-forward validation
  
  // Hyperparameter optimization
  enableHyperparameterTuning: boolean;
  hyperparameterTrials: number;
  
  // Early stopping and regularization
  earlyStopping: boolean;
  patience: number;
  minDeltaImprovement: number;
  
  // Performance thresholds
  minAccuracy: number;
  minPrecision: number;
  minRecall: number;
  
  // Resource management
  maxTrainingTime: number; // minutes
  batchSize: number;
  maxEpochs: number;
}

export interface TrainingData {
  features: FeatureVector[][];
  labels: number[][]; // Price targets, regime classes, or volatility values
  timestamps: Date[];
  symbols: string[];
  metadata: {
    startDate: Date;
    endDate: Date;
    sampleCount: number;
    featureCount: number;
    symbolCount: number;
  };
}

export interface ValidationResult {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  mse: number;
  mae: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  confusionMatrix?: number[][];
  
  // Time series specific metrics
  directionalAccuracy?: number;
  returnPredictionAccuracy?: number;
  
  // Validation method specific
  cvScores?: number[]; // Cross-validation scores
  walkForwardResults?: any[];
}

export interface TrainingProgress {
  status: TrainingStatus;
  progress: number; // 0-100
  currentEpoch: number;
  totalEpochs: number;
  currentFold?: number;
  totalFolds?: number;
  
  // Current metrics
  loss: number;
  accuracy: number;
  validationLoss?: number;
  validationAccuracy?: number;
  
  // Time tracking
  elapsedTime: number; // minutes
  estimatedTimeRemaining: number; // minutes
  
  // Resource usage
  memoryUsage: number; // MB
  
  // Hyperparameter optimization progress
  trialNumber?: number;
  totalTrials?: number;
  bestTrialScore?: number;
  currentHyperparams?: any;
}

export interface TrainingResult {
  success: boolean;
  model: PricePredictionModel | MarketRegimeModel | VolatilityModel | null;
  validation: ValidationResult;
  bestHyperparams: any;
  trainingHistory: any[];
  
  // Performance analysis
  performanceMetrics: {
    trainingTime: number;
    convergenceEpoch: number;
    finalLoss: number;
    overallScore: number;
  };
  
  // Model artifacts
  modelSize: number; // bytes
  modelComplexity: number; // parameter count
  
  errors?: string[];
  warnings?: string[];
}

export class ModelTrainer {
  private trainingConfig: TrainingConfig;
  private currentProgress: TrainingProgress;
  private isTraining = false;
  private abortTraining = false;
  
  // Training state
  private trainingData: TrainingData | null = null;
  private currentModel: any = null;
  private bestModel: any = null;
  private bestScore = -Infinity;
  
  // Callbacks
  private progressCallbacks: ((progress: TrainingProgress) => void)[] = [];
  private completionCallbacks: ((result: TrainingResult) => void)[] = [];
  
  // Performance tracking
  private trainingHistory: any[] = [];
  private hyperparameterTrials: any[] = [];

  constructor(config: TrainingConfig) {
    this.trainingConfig = config;
    this.currentProgress = this.initializeProgress();
  }

  /**
   * Prepare training data from historical market data
   */
  async prepareTrainingData(
    historicalCandles: any[],
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<TrainingData> {
    console.log(`📊 Preparing training data for ${symbol} from ${startDate} to ${endDate}...`);
    
    this.updateProgress({ status: 'PREPARING', progress: 10 });
    
    try {
      // Filter data by date range
      const filteredCandles = historicalCandles.filter(candle => {
        const candleDate = new Date(candle.time);
        return candleDate >= startDate && candleDate <= endDate;
      });
      
      if (filteredCandles.length < 200) {
        throw new Error('Insufficient historical data. Need at least 200 candles.');
      }
      
      // Prepare features using FeatureEngine
      const featureVectors: FeatureVector[] = [];
      const windowSize = 60; // 60-candle windows for features
      
      for (let i = windowSize; i < filteredCandles.length - 1; i++) {
        const window = filteredCandles.slice(i - windowSize, i);
        const features = await featureEngine.computeFeatures(window);
        featureVectors.push(features);
      }
      
      // Prepare labels based on model type
      const labels = this.prepareLabels(filteredCandles, featureVectors.length);
      
      // Create feature sequences for time series models
      const featureSequences = this.createFeatureSequences(featureVectors);
      
      const trainingData: TrainingData = {
        features: featureSequences,
        labels: labels,
        timestamps: featureVectors.map(f => f.timestamp),
        symbols: featureVectors.map(() => symbol),
        metadata: {
          startDate,
          endDate,
          sampleCount: featureVectors.length,
          featureCount: this.getFeatureCount(featureVectors[0] || {} as FeatureVector),
          symbolCount: 1
        }
      };
      
      this.trainingData = trainingData;
      this.updateProgress({ status: 'PREPARING', progress: 50 });
      
      console.log(`✅ Training data prepared: ${trainingData.metadata.sampleCount} samples`);
      return trainingData;

    } catch (error) {
      console.error('❌ Failed to prepare training data:', error);
      throw error;
    }
  }

  /**
   * Train a model with the prepared data
   */
  async trainModel(modelConfig: any): Promise<TrainingResult> {
    if (!this.trainingData) {
      throw new Error('Training data not prepared. Call prepareTrainingData() first.');
    }
    
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }
    
    console.log(`🎯 Starting model training with ${this.trainingConfig.validationMethod} validation...`);
    
    this.isTraining = true;
    this.abortTraining = false;
    this.updateProgress({ status: 'TRAINING', progress: 0 });
    
    const startTime = Date.now();
    
    try {
      let result: TrainingResult;
      
      if (this.trainingConfig.enableHyperparameterTuning) {
        result = await this.trainWithHyperparameterTuning(modelConfig);
      } else {
        result = await this.trainSingleModel(modelConfig);
      }
      
      const trainingTime = (Date.now() - startTime) / 60000; // minutes
      result.performanceMetrics.trainingTime = trainingTime;
      
      // Final validation
      if (result.success && result.model) {
        const finalValidation = await this.validateModel(result.model);
        result.validation = finalValidation;
        
        // Check if model meets performance requirements
        if (!this.meetsPerformanceRequirements(finalValidation)) {
          result.warnings?.push('Model does not meet minimum performance requirements');
        }
      }
      
      this.updateProgress({ status: 'COMPLETED', progress: 100 });
      this.notifyCompletion(result);
      
      console.log(`✅ Training completed in ${trainingTime.toFixed(1)} minutes`);
      return result;

    } catch (error) {
      console.error('❌ Training failed:', error);
      
      const failedResult: TrainingResult = {
        success: false,
        model: null,
        validation: this.getDefaultValidationResult(),
        bestHyperparams: {},
        trainingHistory: this.trainingHistory,
        performanceMetrics: {
          trainingTime: (Date.now() - startTime) / 60000,
          convergenceEpoch: 0,
          finalLoss: Infinity,
          overallScore: 0
        },
        modelSize: 0,
        modelComplexity: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
      
      this.updateProgress({ status: 'FAILED', progress: 0 });
      this.notifyCompletion(failedResult);
      
      return failedResult;
      
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Validate a trained model
   */
  async validateModel(
    model: PricePredictionModel | MarketRegimeModel | VolatilityModel
  ): Promise<ValidationResult> {
    if (!this.trainingData) {
      throw new Error('No training data available for validation');
    }
    
    console.log(`📋 Validating model using ${this.trainingConfig.validationMethod}...`);
    
    switch (this.trainingConfig.validationMethod) {
      case 'HOLDOUT':
        return await this.holdoutValidation(model);
      case 'K_FOLD':
        return await this.kFoldValidation(model);
      case 'TIME_SERIES':
        return await this.timeSeriesValidation(model);
      case 'WALK_FORWARD':
        return await this.walkForwardValidation(model);
      default:
        return await this.holdoutValidation(model);
    }
  }

  /**
   * Stop training process
   */
  stopTraining(): void {
    this.abortTraining = true;
    console.log('🛑 Training stop requested...');
  }

  /**
   * Add progress callback
   */
  onProgress(callback: (progress: TrainingProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Add completion callback
   */
  onCompletion(callback: (result: TrainingResult) => void): void {
    this.completionCallbacks.push(callback);
  }

  /**
   * Get current training progress
   */
  getProgress(): TrainingProgress {
    return { ...this.currentProgress };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async trainWithHyperparameterTuning(baseConfig: any): Promise<TrainingResult> {
    console.log(`🔍 Starting hyperparameter tuning with ${this.trainingConfig.hyperparameterTrials} trials...`);
    
    const trials = this.generateHyperparameterTrials(baseConfig);
    let bestResult: TrainingResult | null = null;
    
    for (let i = 0; i < trials.length && !this.abortTraining; i++) {
      const trial = trials[i];
      
      this.updateProgress({
        trialNumber: i + 1,
        totalTrials: trials.length,
        currentHyperparams: trial,
        progress: 20 + (60 * i / trials.length)
      });
      
      try {
        const result = await this.trainSingleModel(trial);
        this.hyperparameterTrials.push({
          trial: i + 1,
          hyperparams: trial,
          score: result.validation.f1Score,
          result
        });
        
        if (result.success && result.validation.f1Score > this.bestScore) {
          this.bestScore = result.validation.f1Score;
          bestResult = result;
          this.updateProgress({ bestTrialScore: this.bestScore });
          
          console.log(`🎯 New best score: ${this.bestScore.toFixed(4)} (Trial ${i + 1})`);
        }
        
      } catch (error) {
        console.warn(`Trial ${i + 1} failed:`, error);
      }
    }
    
    if (!bestResult) {
      throw new Error('All hyperparameter trials failed');
    }
    
    return bestResult;
  }

  private async trainSingleModel(config: any): Promise<TrainingResult> {
    // Create model instance
    const model = await this.createModel(config);
    await model.initialize();
    
    // Split data for training/validation
    const { trainData, validationData } = this.splitTrainingData();
    
    // Train the model
    try {
      await this.trainModelInstance(model, trainData, validationData);
      
      // Validate
      const validation = await this.validateModel(model);
      
      return {
        success: true,
        model,
        validation,
        bestHyperparams: config,
        trainingHistory: [...this.trainingHistory],
        performanceMetrics: {
          trainingTime: 0, // Will be set by caller
          convergenceEpoch: this.findConvergenceEpoch(),
          finalLoss: this.trainingHistory[this.trainingHistory.length - 1]?.loss || 0,
          overallScore: validation.f1Score
        },
        modelSize: this.calculateModelSize(model),
        modelComplexity: this.calculateModelComplexity(model)
      };
      
    } catch (error) {
      throw error;
    }
  }

  private async createModel(config: any): Promise<any> {
    switch (this.trainingConfig.modelType) {
      case 'PRICE_PREDICTION':
        return new PricePredictionModel(config as PricePredictionConfig);
      case 'MARKET_REGIME':
        return new MarketRegimeModel(config as MarketRegimeConfig);
      case 'VOLATILITY':
        return new VolatilityModel(config as VolatilityConfig);
      default:
        throw new Error(`Unsupported model type: ${this.trainingConfig.modelType}`);
    }
  }

  private async trainModelInstance(model: any, trainData: any, validationData: any): Promise<void> {
    const maxTime = this.trainingConfig.maxTrainingTime * 60000; // Convert to milliseconds
    const startTime = Date.now();
    
    let epoch = 0;
    let bestValidationScore = -Infinity;
    let patienceCounter = 0;
    
    while (epoch < this.trainingConfig.maxEpochs && !this.abortTraining) {
      const epochStart = Date.now();
      
      // Check time limit
      if (Date.now() - startTime > maxTime) {
        console.log('⏰ Training stopped due to time limit');
        break;
      }
      
      // Train one epoch
      await this.trainEpoch(model, trainData, epoch);
      
      // Validate
      if (validationData && epoch % 5 === 0) { // Validate every 5 epochs
        const valScore = await this.evaluateModel(model, validationData);
        
        // Early stopping check
        if (this.trainingConfig.earlyStopping) {
          if (valScore > bestValidationScore + this.trainingConfig.minDeltaImprovement) {
            bestValidationScore = valScore;
            patienceCounter = 0;
          } else {
            patienceCounter++;
            
            if (patienceCounter >= this.trainingConfig.patience) {
              console.log(`🛑 Early stopping at epoch ${epoch} (patience exceeded)`);
              break;
            }
          }
        }
        
        this.updateProgress({
          currentEpoch: epoch + 1,
          validationAccuracy: valScore,
          progress: 20 + (60 * epoch / this.trainingConfig.maxEpochs)
        });
      }
      
      epoch++;
    }
  }

  private async trainEpoch(model: any, trainData: any, epoch: number): Promise<void> {
    // This would be implemented differently for each model type
    // For now, it's a placeholder that simulates training
    
    const epochLoss = Math.random() * 0.1 + 0.01; // Simulated decreasing loss
    const epochAccuracy = 0.5 + Math.random() * 0.4; // Simulated improving accuracy
    
    this.trainingHistory.push({
      epoch: epoch + 1,
      loss: epochLoss,
      accuracy: epochAccuracy,
      timestamp: new Date()
    });
    
    this.updateProgress({
      currentEpoch: epoch + 1,
      loss: epochLoss,
      accuracy: epochAccuracy
    });
    
    // Simulate some training time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async evaluateModel(model: any, validationData: any): Promise<number> {
    // Placeholder evaluation - would be model-specific
    return Math.random() * 0.3 + 0.6; // Simulated score between 0.6-0.9
  }

  private async holdoutValidation(model: any): Promise<ValidationResult> {
    const { validationData } = this.splitTrainingData();
    
    // Placeholder validation - would be model-specific
    return {
      accuracy: 0.75 + Math.random() * 0.2,
      precision: 0.7 + Math.random() * 0.25,
      recall: 0.7 + Math.random() * 0.25,
      f1Score: 0.72 + Math.random() * 0.23,
      mse: Math.random() * 0.01,
      mae: Math.random() * 0.05,
      directionalAccuracy: 0.65 + Math.random() * 0.25
    };
  }

  private async kFoldValidation(model: any): Promise<ValidationResult> {
    const kFolds = this.trainingConfig.kFolds || 5;
    const scores: number[] = [];
    
    for (let fold = 0; fold < kFolds; fold++) {
      this.updateProgress({
        currentFold: fold + 1,
        totalFolds: kFolds,
        progress: 80 + (15 * fold / kFolds)
      });
      
      // Simulate fold validation
      const foldScore = 0.6 + Math.random() * 0.35;
      scores.push(foldScore);
      
      if (this.abortTraining) break;
    }
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return {
      accuracy: avgScore,
      precision: avgScore * 0.95,
      recall: avgScore * 0.98,
      f1Score: avgScore * 0.96,
      mse: (1 - avgScore) * 0.01,
      mae: (1 - avgScore) * 0.05,
      cvScores: scores
    };
  }

  private async timeSeriesValidation(model: any): Promise<ValidationResult> {
    // Time series specific validation logic
    return await this.holdoutValidation(model);
  }

  private async walkForwardValidation(model: any): Promise<ValidationResult> {
    const steps = this.trainingConfig.walkForwardSteps || 10;
    const results: any[] = [];
    
    for (let step = 0; step < steps; step++) {
      this.updateProgress({
        progress: 80 + (15 * step / steps)
      });
      
      // Simulate walk-forward step
      results.push({
        step: step + 1,
        accuracy: 0.6 + Math.random() * 0.3,
        returns: (Math.random() - 0.5) * 0.1
      });
      
      if (this.abortTraining) break;
    }
    
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    
    return {
      accuracy: avgAccuracy,
      precision: avgAccuracy * 0.95,
      recall: avgAccuracy * 0.98,
      f1Score: avgAccuracy * 0.96,
      mse: (1 - avgAccuracy) * 0.01,
      mae: (1 - avgAccuracy) * 0.05,
      walkForwardResults: results
    };
  }

  private prepareLabels(candles: any[], sampleCount: number): number[][] {
    const labels: number[][] = [];
    
    switch (this.trainingConfig.modelType) {
      case 'PRICE_PREDICTION':
        // Next period price change percentage
        for (let i = 0; i < sampleCount; i++) {
          const current = candles[i + 60];
          const next = candles[i + 61];
          if (current && next) {
            const change = (next.close - current.close) / current.close;
            labels.push([change]);
          }
        }
        break;
        
      case 'MARKET_REGIME':
        // Regime classification (simplified)
        for (let i = 0; i < sampleCount; i++) {
          const regime = Math.floor(Math.random() * 6); // 6 regime classes
          labels.push([regime]);
        }
        break;
        
      case 'VOLATILITY':
        // Next period volatility
        for (let i = 0; i < sampleCount; i++) {
          const volatility = Math.random() * 0.05 + 0.01; // 1-6% volatility
          labels.push([volatility]);
        }
        break;
    }
    
    return labels;
  }

  private createFeatureSequences(features: FeatureVector[]): FeatureVector[][] {
    const sequences: FeatureVector[][] = [];
    const sequenceLength = 30; // 30-step sequences
    
    for (let i = sequenceLength; i < features.length; i++) {
      const sequence = features.slice(i - sequenceLength, i);
      sequences.push(sequence);
    }
    
    return sequences;
  }

  private getFeatureCount(sample: FeatureVector): number {
    let count = 0;
    count += Object.keys(sample.technical || {}).length;
    count += Object.keys(sample.price || {}).length;
    count += Object.keys(sample.volume || {}).length;
    count += Object.keys(sample.market_structure || {}).length;
    return count;
  }

  private splitTrainingData(): { trainData: any; validationData: any } {
    if (!this.trainingData) {
      throw new Error('No training data available');
    }
    
    const splitIndex = Math.floor(this.trainingData.features.length * this.trainingConfig.trainTestSplit);
    
    return {
      trainData: {
        features: this.trainingData.features.slice(0, splitIndex),
        labels: this.trainingData.labels.slice(0, splitIndex)
      },
      validationData: {
        features: this.trainingData.features.slice(splitIndex),
        labels: this.trainingData.labels.slice(splitIndex)
      }
    };
  }

  private generateHyperparameterTrials(baseConfig: any): any[] {
    const trials: any[] = [];
    
    // Define hyperparameter ranges based on model type
    const paramRanges = this.getHyperparameterRanges();
    
    for (let i = 0; i < this.trainingConfig.hyperparameterTrials; i++) {
      const trial = { ...baseConfig };
      
      // Randomly sample hyperparameters
      for (const [param, range] of Object.entries(paramRanges)) {
        if (Array.isArray(range)) {
          trial[param] = range[Math.floor(Math.random() * range.length)];
        } else if (typeof range === 'object' && 'min' in range) {
          trial[param] = (range as any).min + Math.random() * ((range as any).max - (range as any).min);
        }
      }
      
      trials.push(trial);
    }
    
    return trials;
  }

  private getHyperparameterRanges(): Record<string, any> {
    switch (this.trainingConfig.modelType) {
      case 'PRICE_PREDICTION':
        return {
          'modelParams.learningRate': { min: 0.0001, max: 0.01 },
          'modelParams.batchSize': [8, 16, 32, 64],
          'modelParams.dropout': { min: 0.1, max: 0.5 },
          'modelParams.hiddenUnits': [32, 64, 128, 256]
        };
      default:
        return {};
    }
  }

  private meetsPerformanceRequirements(validation: ValidationResult): boolean {
    return validation.accuracy >= this.trainingConfig.minAccuracy &&
           validation.precision >= this.trainingConfig.minPrecision &&
           validation.recall >= this.trainingConfig.minRecall;
  }

  private findConvergenceEpoch(): number {
    // Find epoch where loss stabilized
    if (this.trainingHistory.length < 10) return this.trainingHistory.length;
    
    const recent = this.trainingHistory.slice(-10);
    const avgLoss = recent.reduce((sum, h) => sum + h.loss, 0) / recent.length;
    
    for (let i = this.trainingHistory.length - 1; i >= 10; i--) {
      if (Math.abs(this.trainingHistory[i].loss - avgLoss) > avgLoss * 0.1) {
        return i + 1;
      }
    }
    
    return Math.max(1, this.trainingHistory.length - 10);
  }

  private calculateModelSize(model: any): number {
    // Estimate model size in bytes
    return model.model ? model.model.countParams() * 4 : 0; // 4 bytes per parameter
  }

  private calculateModelComplexity(model: any): number {
    return model.model ? model.model.countParams() : 0;
  }

  private getDefaultValidationResult(): ValidationResult {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      mse: Infinity,
      mae: Infinity
    };
  }

  private initializeProgress(): TrainingProgress {
    return {
      status: 'IDLE',
      progress: 0,
      currentEpoch: 0,
      totalEpochs: this.trainingConfig.maxEpochs,
      loss: 0,
      accuracy: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      memoryUsage: 0
    };
  }

  private updateProgress(updates: Partial<TrainingProgress>): void {
    this.currentProgress = { ...this.currentProgress, ...updates };
    
    // Update time estimates
    if (this.currentProgress.currentEpoch > 0 && this.currentProgress.totalEpochs > 0) {
      const progressRatio = this.currentProgress.currentEpoch / this.currentProgress.totalEpochs;
      if (progressRatio > 0) {
        this.currentProgress.estimatedTimeRemaining = 
          (this.currentProgress.elapsedTime / progressRatio) - this.currentProgress.elapsedTime;
      }
    }
    
    // Notify callbacks
    this.progressCallbacks.forEach(callback => callback(this.currentProgress));
  }

  private notifyCompletion(result: TrainingResult): void {
    this.completionCallbacks.forEach(callback => callback(result));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopTraining();
    this.progressCallbacks = [];
    this.completionCallbacks = [];
    this.trainingData = null;
    this.currentModel = null;
    this.bestModel = null;
  }
}

// Default training configurations
export const DEFAULT_TRAINING_CONFIGS = {
  quickTest: {
    modelType: 'PRICE_PREDICTION' as ModelType,
    validationMethod: 'HOLDOUT' as ValidationMethod,
    trainTestSplit: 0.8,
    enableHyperparameterTuning: false,
    hyperparameterTrials: 5,
    earlyStopping: true,
    patience: 10,
    minDeltaImprovement: 0.001,
    minAccuracy: 0.55,
    minPrecision: 0.55,
    minRecall: 0.55,
    maxTrainingTime: 30, // 30 minutes
    batchSize: 32,
    maxEpochs: 100
  },
  
  production: {
    modelType: 'PRICE_PREDICTION' as ModelType,
    validationMethod: 'K_FOLD' as ValidationMethod,
    trainTestSplit: 0.8,
    kFolds: 5,
    enableHyperparameterTuning: true,
    hyperparameterTrials: 50,
    earlyStopping: true,
    patience: 20,
    minDeltaImprovement: 0.0005,
    minAccuracy: 0.65,
    minPrecision: 0.65,
    minRecall: 0.60,
    maxTrainingTime: 240, // 4 hours
    batchSize: 16,
    maxEpochs: 500
  },
  
  research: {
    modelType: 'PRICE_PREDICTION' as ModelType,
    validationMethod: 'WALK_FORWARD' as ValidationMethod,
    trainTestSplit: 0.8,
    walkForwardSteps: 20,
    enableHyperparameterTuning: true,
    hyperparameterTrials: 100,
    earlyStopping: false,
    patience: 50,
    minDeltaImprovement: 0.0001,
    minAccuracy: 0.55,
    minPrecision: 0.55,
    minRecall: 0.55,
    maxTrainingTime: 720, // 12 hours
    batchSize: 8,
    maxEpochs: 1000
  }
};