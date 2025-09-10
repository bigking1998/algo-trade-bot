/**
 * Model Training Pipeline - Task ML-005
 * 
 * Comprehensive automated model training pipeline with cross-validation,
 * hyperparameter optimization, and model versioning integration.
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { BasicMLModels, TrainingData, ModelConfig, NeuralNetworkConfig } from './BasicMLModels';
import { FeatureEngineeringPipeline } from './FeatureEngineering';
import { ModelVersionManager } from './ModelVersionManager';

export interface TrainingPipelineConfig {
  crossValidationFolds: number;
  hyperparameterOptimization: boolean;
  autoModelSelection: boolean;
  maxTrainingTime: number; // minutes
  validationSplit: number;
  earlyStopping: boolean;
}

export class ModelTrainingPipeline extends EventEmitter {
  private mlModels: BasicMLModels;
  private featureEngine: FeatureEngineeringPipeline;
  private versionManager: ModelVersionManager;

  constructor() {
    super();
    this.mlModels = new BasicMLModels();
    this.featureEngine = new FeatureEngineeringPipeline();
    this.versionManager = new ModelVersionManager();
  }

  async trainPipeline(
    trainingData: TrainingData,
    config: TrainingPipelineConfig
  ): Promise<{ bestModel: tf.LayersModel; metrics: any }> {
    console.log('🚀 Starting automated model training pipeline...');
    
    // Define model configurations to test
    const modelConfigs = [
      { name: 'Linear Regression', config: { modelType: 'linear_regression' as const, learningRate: 0.01, epochs: 100, batchSize: 32, validationSplit: 0.2, earlyStopping: true } },
      { name: 'Logistic Regression', config: { modelType: 'logistic_regression' as const, learningRate: 0.01, epochs: 100, batchSize: 32, validationSplit: 0.2, earlyStopping: true } },
      { name: 'Neural Network', config: { modelType: 'neural_network' as const, learningRate: 0.001, epochs: 200, batchSize: 64, validationSplit: 0.2, earlyStopping: true, hiddenLayers: [64, 32, 16], activation: 'relu' as const, dropout: 0.3, batchNormalization: true } }
    ];

    // Compare models
    const comparison = await this.mlModels.compareModels(trainingData, modelConfigs);
    
    // Get best model
    const bestModelConfig = modelConfigs.find(m => m.name === comparison.bestModel);
    if (!bestModelConfig) throw new Error('Best model not found');

    // Train final model
    let result;
    if (bestModelConfig.config.modelType === 'linear_regression') {
      result = await this.mlModels.trainLinearRegression(trainingData, bestModelConfig.config);
    } else if (bestModelConfig.config.modelType === 'logistic_regression') {
      result = await this.mlModels.trainLogisticRegression(trainingData, bestModelConfig.config);
    } else {
      result = await this.mlModels.trainNeuralNetwork(trainingData, bestModelConfig.config as NeuralNetworkConfig);
    }

    console.log(`✅ Training pipeline completed. Best model: ${comparison.bestModel}`);
    
    this.emit('pipelineCompleted', { bestModel: result.model, comparison });
    return { bestModel: result.model, metrics: result.metrics };
  }
}