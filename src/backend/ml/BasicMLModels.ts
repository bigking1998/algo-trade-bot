/**
 * Basic ML Models Implementation - Task ML-003
 * 
 * Core machine learning models for trading prediction including linear regression,
 * logistic classification, and basic neural networks with comprehensive evaluation metrics.
 * 
 * Features:
 * - Linear regression for continuous price prediction
 * - Logistic regression for binary direction classification
 * - Basic neural networks for complex pattern learning
 * - Comprehensive evaluation metrics (accuracy, precision, recall, F1, AUC, etc.)
 * - Model comparison and selection utilities
 * - Cross-validation support
 * - Feature importance analysis
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { ComputedFeatures } from './FeatureEngineering';
import { getTensorFlowSetup } from './TensorFlowSetup';

export interface TrainingData {
  features: Float32Array[];
  labels: number[];
  metadata: {
    symbol: string;
    startDate: number;
    endDate: number;
    sampleCount: number;
    featureCount: number;
  };
}

export interface ModelConfig {
  modelType: 'linear_regression' | 'logistic_regression' | 'neural_network';
  learningRate: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
  earlyStopping: boolean;
  patience?: number;
  regularization?: {
    type: 'l1' | 'l2' | 'l1_l2';
    l1?: number;
    l2?: number;
  };
}

export interface NeuralNetworkConfig extends ModelConfig {
  hiddenLayers: number[];
  activation: 'relu' | 'tanh' | 'sigmoid';
  dropout: number;
  batchNormalization: boolean;
}

export interface TrainingResult {
  model: tf.LayersModel;
  history: tf.History;
  metrics: ModelMetrics;
  trainingTime: number;
  convergence: {
    converged: boolean;
    finalLoss: number;
    bestEpoch: number;
  };
}

export interface ModelMetrics {
  // Classification metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  confusionMatrix?: number[][];
  
  // Regression metrics
  mse?: number;
  rmse?: number;
  mae?: number;
  r2Score?: number;
  
  // Trading-specific metrics
  directionAccuracy?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  
  // Model validation
  crossValidationScore?: number;
  validationLoss?: number;
  trainingLoss?: number;
}

export interface PredictionResult {
  prediction: number | number[];
  confidence: number;
  probability?: number; // For classification
  explanation?: FeatureImportance[];
}

export interface FeatureImportance {
  featureName: string;
  importance: number;
  rank: number;
}

export interface ModelComparison {
  models: {
    name: string;
    metrics: ModelMetrics;
    config: ModelConfig;
  }[];
  bestModel: string;
  ranking: string[];
  comparisonMetrics: Record<string, number[]>;
}

/**
 * Basic ML Models for Trading Predictions
 */
export class BasicMLModels extends EventEmitter {
  private tensorflowSetup = getTensorFlowSetup();
  private trainedModels: Map<string, tf.LayersModel> = new Map();
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private featureImportance: Map<string, FeatureImportance[]> = new Map();

  constructor() {
    super();
    console.log('🤖 Basic ML Models initialized');
  }

  /**
   * Train a linear regression model
   */
  async trainLinearRegression(
    trainingData: TrainingData,
    config: Partial<ModelConfig> = {}
  ): Promise<TrainingResult> {
    console.log('📈 Training Linear Regression model...');
    
    const fullConfig: ModelConfig = {
      modelType: 'linear_regression',
      learningRate: 0.01,
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      earlyStopping: true,
      patience: 10,
      ...config
    };

    return await this.trainModel(trainingData, fullConfig, this.createLinearRegressionModel);
  }

  /**
   * Train a logistic regression model
   */
  async trainLogisticRegression(
    trainingData: TrainingData,
    config: Partial<ModelConfig> = {}
  ): Promise<TrainingResult> {
    console.log('📊 Training Logistic Regression model...');
    
    const fullConfig: ModelConfig = {
      modelType: 'logistic_regression',
      learningRate: 0.01,
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      earlyStopping: true,
      patience: 10,
      ...config
    };

    return await this.trainModel(trainingData, fullConfig, this.createLogisticRegressionModel);
  }

  /**
   * Train a basic neural network model
   */
  async trainNeuralNetwork(
    trainingData: TrainingData,
    config: Partial<NeuralNetworkConfig> = {}
  ): Promise<TrainingResult> {
    console.log('🧠 Training Neural Network model...');
    
    const fullConfig: NeuralNetworkConfig = {
      modelType: 'neural_network',
      learningRate: 0.001,
      epochs: 200,
      batchSize: 64,
      validationSplit: 0.2,
      earlyStopping: true,
      patience: 20,
      hiddenLayers: [64, 32, 16],
      activation: 'relu',
      dropout: 0.3,
      batchNormalization: true,
      ...config
    };

    return await this.trainModel(
      trainingData, 
      fullConfig, 
      (inputShape: number[]) => this.createNeuralNetworkModel(inputShape, fullConfig)
    );
  }

  /**
   * Generic model training function
   */
  private async trainModel(
    trainingData: TrainingData,
    config: ModelConfig | NeuralNetworkConfig,
    modelFactory: (inputShape: number[]) => tf.LayersModel
  ): Promise<TrainingResult> {
    const startTime = Date.now();

    try {
      // Ensure TensorFlow is initialized
      await this.tensorflowSetup.initialize();

      // Prepare data
      const { xTrain, yTrain, inputShape } = this.prepareTrainingData(trainingData);
      
      console.log(`📊 Training data shape: ${xTrain.shape}, labels: ${yTrain.shape}`);
      console.log(`⚙️  Model config:`, config);

      // Create model
      const model = modelFactory(inputShape);
      
      // Compile model
      this.compileModel(model, config);

      // Setup callbacks
      const callbacks = this.createCallbacks(config);

      // Train model
      console.log('🚀 Starting training...');
      const history = await model.fit(xTrain, yTrain, {
        epochs: config.epochs,
        batchSize: config.batchSize,
        validationSplit: config.validationSplit,
        callbacks,
        verbose: 1
      });

      const trainingTime = Date.now() - startTime;

      // Evaluate model
      console.log('📊 Evaluating model...');
      const metrics = await this.evaluateModel(model, trainingData, config);

      // Calculate feature importance
      const featureImportance = await this.calculateFeatureImportance(
        model, 
        xTrain.arraySync() as number[][], 
        trainingData
      );

      // Store model and results
      const modelId = `${config.modelType}_${Date.now()}`;
      this.trainedModels.set(modelId, model);
      this.modelMetrics.set(modelId, metrics);
      this.featureImportance.set(modelId, featureImportance);

      // Analyze convergence
      const convergence = this.analyzeConvergence(history);

      const result: TrainingResult = {
        model,
        history,
        metrics,
        trainingTime,
        convergence
      };

      console.log(`✅ Model training completed in ${trainingTime}ms`);
      console.log('📈 Final metrics:', metrics);
      console.log('🎯 Convergence:', convergence);

      // Cleanup tensors
      xTrain.dispose();
      yTrain.dispose();

      this.emit('modelTrained', { modelId, result, config });
      return result;

    } catch (error) {
      console.error('❌ Model training failed:', error);
      this.emit('trainingError', { error, config });
      throw error;
    }
  }

  /**
   * Make predictions with a trained model
   */
  async predict(
    model: tf.LayersModel,
    features: Float32Array,
    featureNames: string[]
  ): Promise<PredictionResult> {
    try {
      // Prepare input tensor
      const inputTensor = tf.tensor2d([Array.from(features)]);
      
      // Make prediction
      const predictionTensor = model.predict(inputTensor) as tf.Tensor;
      const prediction = await predictionTensor.data();
      
      // Calculate confidence (simplified)
      const confidence = this.calculateConfidence(prediction, model);

      // Get feature importance explanation
      const explanation = await this.explainPrediction(model, features, featureNames);

      // Cleanup
      inputTensor.dispose();
      predictionTensor.dispose();

      const result: PredictionResult = {
        prediction: prediction.length === 1 ? prediction[0] : Array.from(prediction),
        confidence,
        explanation
      };

      // Add probability for classification models
      if (prediction.length === 1 && prediction[0] >= 0 && prediction[0] <= 1) {
        result.probability = prediction[0];
      }

      return result;

    } catch (error) {
      console.error('❌ Prediction failed:', error);
      throw error;
    }
  }

  /**
   * Cross-validation for model evaluation
   */
  async crossValidate(
    trainingData: TrainingData,
    config: ModelConfig | NeuralNetworkConfig,
    folds: number = 5
  ): Promise<{
    meanScore: number;
    stdScore: number;
    scores: number[];
    models: tf.LayersModel[];
  }> {
    console.log(`🔄 Running ${folds}-fold cross-validation...`);

    const scores: number[] = [];
    const models: tf.LayersModel[] = [];
    const foldSize = Math.floor(trainingData.features.length / folds);

    for (let fold = 0; fold < folds; fold++) {
      console.log(`📁 Fold ${fold + 1}/${folds}`);

      // Split data
      const { trainData, valData } = this.createFoldSplit(trainingData, fold, folds, foldSize);

      try {
        // Train model on fold
        const modelFactory = this.getModelFactory(config);
        const result = await this.trainModel(trainData, config, modelFactory);
        
        // Evaluate on validation set
        const valMetrics = await this.evaluateModel(result.model, valData, config);
        const score = this.getMainMetric(valMetrics, config);
        
        scores.push(score);
        models.push(result.model);
        
        console.log(`📊 Fold ${fold + 1} score: ${score.toFixed(4)}`);

      } catch (error) {
        console.error(`❌ Fold ${fold + 1} failed:`, error);
        scores.push(0); // Use 0 for failed folds
      }
    }

    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length;
    const stdScore = Math.sqrt(variance);

    console.log(`✅ Cross-validation completed:`);
    console.log(`📊 Mean score: ${meanScore.toFixed(4)} ± ${stdScore.toFixed(4)}`);
    console.log(`📈 Scores: [${scores.map(s => s.toFixed(4)).join(', ')}]`);

    return { meanScore, stdScore, scores, models };
  }

  /**
   * Compare multiple models
   */
  async compareModels(
    trainingData: TrainingData,
    configs: Array<{ name: string; config: ModelConfig | NeuralNetworkConfig }>
  ): Promise<ModelComparison> {
    console.log(`🏆 Comparing ${configs.length} models...`);

    const results: ModelComparison['models'] = [];
    const comparisonMetrics: Record<string, number[]> = {};

    for (const { name, config } of configs) {
      try {
        console.log(`🔄 Training ${name}...`);
        
        const modelFactory = this.getModelFactory(config);
        const result = await this.trainModel(trainingData, config, modelFactory);
        
        results.push({
          name,
          metrics: result.metrics,
          config
        });

        // Collect metrics for comparison
        Object.entries(result.metrics).forEach(([metric, value]) => {
          if (typeof value === 'number') {
            if (!comparisonMetrics[metric]) comparisonMetrics[metric] = [];
            comparisonMetrics[metric].push(value);
          }
        });

      } catch (error) {
        console.error(`❌ Failed to train ${name}:`, error);
      }
    }

    // Rank models
    const ranking = this.rankModels(results);
    const bestModel = ranking[0];

    const comparison: ModelComparison = {
      models: results,
      bestModel,
      ranking,
      comparisonMetrics
    };

    console.log(`🏅 Model comparison completed. Best model: ${bestModel}`);
    console.log(`📊 Rankings: ${ranking.join(' > ')}`);

    return comparison;
  }

  /**
   * MODEL FACTORY METHODS
   */

  private createLinearRegressionModel = (inputShape: number[]): tf.LayersModel => {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputShape[0]],
          units: 1,
          activation: 'linear',
          name: 'linear_output'
        })
      ]
    });

    console.log('📐 Linear Regression model created');
    return model;
  };

  private createLogisticRegressionModel = (inputShape: number[]): tf.LayersModel => {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputShape[0]],
          units: 1,
          activation: 'sigmoid',
          name: 'logistic_output'
        })
      ]
    });

    console.log('📊 Logistic Regression model created');
    return model;
  };

  private createNeuralNetworkModel = (inputShape: number[], config: NeuralNetworkConfig): tf.LayersModel => {
    const layers: tf.layers.Layer[] = [];

    // Input layer
    layers.push(tf.layers.dense({
      inputShape: [inputShape[0]],
      units: config.hiddenLayers[0],
      activation: config.activation,
      name: 'input_dense'
    }));

    if (config.batchNormalization) {
      layers.push(tf.layers.batchNormalization({ name: 'input_bn' }));
    }

    if (config.dropout > 0) {
      layers.push(tf.layers.dropout({ rate: config.dropout, name: 'input_dropout' }));
    }

    // Hidden layers
    for (let i = 1; i < config.hiddenLayers.length; i++) {
      layers.push(tf.layers.dense({
        units: config.hiddenLayers[i],
        activation: config.activation,
        name: `hidden_${i}`
      }));

      if (config.batchNormalization) {
        layers.push(tf.layers.batchNormalization({ name: `hidden_bn_${i}` }));
      }

      if (config.dropout > 0) {
        layers.push(tf.layers.dropout({ rate: config.dropout, name: `hidden_dropout_${i}` }));
      }
    }

    // Output layer
    const outputActivation = config.modelType === 'logistic_regression' ? 'sigmoid' : 'linear';
    layers.push(tf.layers.dense({
      units: 1,
      activation: outputActivation,
      name: 'output'
    }));

    const model = tf.sequential({ layers });

    console.log(`🧠 Neural Network model created with ${config.hiddenLayers.length} hidden layers`);
    console.log(`📊 Architecture: ${inputShape[0]} -> ${config.hiddenLayers.join(' -> ')} -> 1`);

    return model;
  };

  /**
   * TRAINING UTILITIES
   */

  private prepareTrainingData(trainingData: TrainingData): {
    xTrain: tf.Tensor2D;
    yTrain: tf.Tensor2D;
    inputShape: number[];
  } {
    // Convert features to 2D array
    const featuresArray = trainingData.features.map(f => Array.from(f));
    const labelsArray = trainingData.labels.map(l => [l]);

    // Create tensors
    const xTrain = tf.tensor2d(featuresArray);
    const yTrain = tf.tensor2d(labelsArray);
    
    const inputShape = [trainingData.features[0].length];

    console.log(`📋 Training data prepared: ${featuresArray.length} samples, ${inputShape[0]} features`);

    return { xTrain, yTrain, inputShape };
  }

  private compileModel(model: tf.LayersModel, config: ModelConfig): void {
    const optimizer = tf.train.adam(config.learningRate);
    
    let loss: string;
    let metrics: string[];

    if (config.modelType === 'logistic_regression') {
      loss = 'binaryCrossentropy';
      metrics = ['accuracy'];
    } else {
      loss = 'meanSquaredError';
      metrics = ['mse', 'mae'];
    }

    model.compile({
      optimizer,
      loss,
      metrics
    });

    console.log(`⚙️  Model compiled with loss: ${loss}, metrics: [${metrics.join(', ')}]`);
  }

  private createCallbacks(config: ModelConfig): tf.CustomCallback[] {
    const callbacks: tf.CustomCallback[] = [];

    // Early stopping
    if (config.earlyStopping) {
      callbacks.push(tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        patience: config.patience || 10,
        restoreBestWeights: true
      }));
    }

    // Reduce learning rate on plateau
    callbacks.push(tf.callbacks.reduceLROnPlateau({
      monitor: 'val_loss',
      factor: 0.5,
      patience: Math.floor((config.patience || 10) / 2),
      minLr: config.learningRate / 100
    }));

    return callbacks;
  }

  /**
   * MODEL EVALUATION
   */

  private async evaluateModel(
    model: tf.LayersModel,
    data: TrainingData,
    config: ModelConfig
  ): Promise<ModelMetrics> {
    const { xTrain, yTrain } = this.prepareTrainingData(data);
    
    try {
      // Get predictions
      const predictions = model.predict(xTrain) as tf.Tensor2D;
      const predArray = await predictions.data();
      const actualArray = await yTrain.data();

      // Calculate metrics based on model type
      let metrics: ModelMetrics;

      if (config.modelType === 'logistic_regression') {
        metrics = this.calculateClassificationMetrics(
          Array.from(predArray), 
          Array.from(actualArray)
        );
      } else {
        metrics = this.calculateRegressionMetrics(
          Array.from(predArray), 
          Array.from(actualArray)
        );
      }

      // Add trading-specific metrics
      const tradingMetrics = this.calculateTradingMetrics(
        Array.from(predArray), 
        Array.from(actualArray)
      );

      const finalMetrics = { ...metrics, ...tradingMetrics };

      // Cleanup
      predictions.dispose();
      xTrain.dispose();
      yTrain.dispose();

      return finalMetrics;

    } catch (error) {
      // Cleanup on error
      xTrain.dispose();
      yTrain.dispose();
      throw error;
    }
  }

  private calculateClassificationMetrics(predictions: number[], actual: number[]): ModelMetrics {
    const threshold = 0.5;
    const binaryPredictions = predictions.map(p => p >= threshold ? 1 : 0);
    const binaryActual = actual.map(a => a >= threshold ? 1 : 0);

    let tp = 0, fp = 0, tn = 0, fn = 0;

    for (let i = 0; i < binaryPredictions.length; i++) {
      if (binaryActual[i] === 1 && binaryPredictions[i] === 1) tp++;
      else if (binaryActual[i] === 0 && binaryPredictions[i] === 1) fp++;
      else if (binaryActual[i] === 0 && binaryPredictions[i] === 0) tn++;
      else if (binaryActual[i] === 1 && binaryPredictions[i] === 0) fn++;
    }

    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp > 0 ? tp / (tp + fp) : 0;
    const recall = tp > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Calculate AUC (simplified)
    const auc = this.calculateAUC(predictions, binaryActual);

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      auc,
      confusionMatrix: [[tn, fp], [fn, tp]]
    };
  }

  private calculateRegressionMetrics(predictions: number[], actual: number[]): ModelMetrics {
    const n = predictions.length;
    let sumSquaredError = 0;
    let sumAbsoluteError = 0;
    let sumActual = 0;
    let sumSquaredActual = 0;

    for (let i = 0; i < n; i++) {
      const error = predictions[i] - actual[i];
      sumSquaredError += error * error;
      sumAbsoluteError += Math.abs(error);
      sumActual += actual[i];
      sumSquaredActual += actual[i] * actual[i];
    }

    const mse = sumSquaredError / n;
    const rmse = Math.sqrt(mse);
    const mae = sumAbsoluteError / n;

    // Calculate R²
    const meanActual = sumActual / n;
    let totalSumSquares = 0;
    for (let i = 0; i < n; i++) {
      totalSumSquares += Math.pow(actual[i] - meanActual, 2);
    }
    const r2Score = totalSumSquares > 0 ? 1 - (sumSquaredError / totalSumSquares) : 0;

    return { mse, rmse, mae, r2Score };
  }

  private calculateTradingMetrics(predictions: number[], actual: number[]): Partial<ModelMetrics> {
    // Calculate direction accuracy
    let correctDirection = 0;
    const returns: number[] = [];
    
    for (let i = 1; i < predictions.length; i++) {
      const predDirection = predictions[i] > predictions[i-1] ? 1 : -1;
      const actualDirection = actual[i] > actual[i-1] ? 1 : -1;
      
      if (predDirection === actualDirection) {
        correctDirection++;
      }

      // Simulate trading returns
      const position = predDirection > 0 ? 1 : -1;
      const marketReturn = (actual[i] - actual[i-1]) / actual[i-1];
      returns.push(position * marketReturn);
    }

    const directionAccuracy = correctDirection / (predictions.length - 1);
    const winRate = returns.filter(r => r > 0).length / returns.length;

    // Calculate Sharpe ratio (simplified)
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStd = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    );
    const sharpeRatio = returnStd > 0 ? meanReturn / returnStd : 0;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const return_ of returns) {
      cumulative += return_;
      if (cumulative > peak) peak = cumulative;
      const drawdown = (peak - cumulative) / Math.max(peak, 1e-8);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      directionAccuracy,
      sharpeRatio,
      maxDrawdown,
      winRate
    };
  }

  private calculateAUC(predictions: number[], actual: number[]): number {
    // Simplified AUC calculation
    const combined = predictions.map((p, i) => ({ prediction: p, actual: actual[i] }));
    combined.sort((a, b) => b.prediction - a.prediction);

    let positives = actual.filter(a => a === 1).length;
    let negatives = actual.length - positives;

    if (positives === 0 || negatives === 0) return 0.5;

    let truePositives = 0;
    let falsePositives = 0;
    let auc = 0;
    let prevFPR = 0;

    for (const item of combined) {
      if (item.actual === 1) {
        truePositives++;
      } else {
        falsePositives++;
        const tpr = truePositives / positives;
        const fpr = falsePositives / negatives;
        auc += (fpr - prevFPR) * tpr;
        prevFPR = fpr;
      }
    }

    return auc;
  }

  /**
   * UTILITY METHODS
   */

  private analyzeConvergence(history: tf.History): {
    converged: boolean;
    finalLoss: number;
    bestEpoch: number;
  } {
    const losses = history.history.loss as number[];
    const valLosses = history.history.val_loss as number[];
    
    const finalLoss = losses[losses.length - 1];
    
    // Find best epoch (lowest validation loss)
    let bestEpoch = 0;
    let bestLoss = valLosses[0];
    
    for (let i = 1; i < valLosses.length; i++) {
      if (valLosses[i] < bestLoss) {
        bestLoss = valLosses[i];
        bestEpoch = i;
      }
    }

    // Check convergence (loss stable in last 10% of epochs)
    const stableWindow = Math.max(5, Math.floor(losses.length * 0.1));
    const recentLosses = losses.slice(-stableWindow);
    const lossVariance = recentLosses.reduce((sum, loss) => {
      return sum + Math.pow(loss - finalLoss, 2);
    }, 0) / stableWindow;

    const converged = lossVariance < finalLoss * 0.01; // 1% variance threshold

    return { converged, finalLoss, bestEpoch };
  }

  private calculateConfidence(prediction: Float32Array, model: tf.LayersModel): number {
    // Simplified confidence calculation
    if (prediction.length === 1) {
      const value = prediction[0];
      if (value >= 0 && value <= 1) {
        // For classification, confidence based on distance from 0.5
        return Math.abs(value - 0.5) * 2;
      } else {
        // For regression, confidence based on model complexity (simplified)
        const paramCount = model.countParams();
        return Math.min(1, 1 / Math.log(paramCount + 1));
      }
    }
    return 0.5; // Default confidence
  }

  private async explainPrediction(
    model: tf.LayersModel,
    features: Float32Array,
    featureNames: string[]
  ): Promise<FeatureImportance[]> {
    // Simplified feature importance (in reality would use more sophisticated methods)
    const weights = model.getWeights()[0]; // Get first layer weights
    if (!weights) return [];

    const weightData = await weights.data();
    const importance: FeatureImportance[] = [];

    for (let i = 0; i < Math.min(featureNames.length, weightData.length); i++) {
      importance.push({
        featureName: featureNames[i],
        importance: Math.abs(weightData[i]),
        rank: i + 1
      });
    }

    // Sort by importance
    importance.sort((a, b) => b.importance - a.importance);
    
    // Update ranks
    importance.forEach((item, index) => {
      item.rank = index + 1;
    });

    return importance.slice(0, 10); // Top 10 features
  }

  private async calculateFeatureImportance(
    model: tf.LayersModel,
    features: number[][],
    trainingData: TrainingData
  ): Promise<FeatureImportance[]> {
    // Permutation importance (simplified)
    const baseline = await this.getPredictionAccuracy(model, features, trainingData.labels);
    const importance: FeatureImportance[] = [];

    for (let featureIndex = 0; featureIndex < features[0].length; featureIndex++) {
      // Permute feature
      const permutedFeatures = features.map(row => [...row]);
      const originalValues = permutedFeatures.map(row => row[featureIndex]);
      const shuffled = [...originalValues].sort(() => Math.random() - 0.5);
      
      permutedFeatures.forEach((row, i) => {
        row[featureIndex] = shuffled[i];
      });

      // Calculate accuracy with permuted feature
      const permutedAccuracy = await this.getPredictionAccuracy(model, permutedFeatures, trainingData.labels);
      const importanceScore = baseline - permutedAccuracy;

      importance.push({
        featureName: `feature_${featureIndex}`,
        importance: Math.max(0, importanceScore),
        rank: featureIndex + 1
      });
    }

    // Sort and rank
    importance.sort((a, b) => b.importance - a.importance);
    importance.forEach((item, index) => {
      item.rank = index + 1;
    });

    return importance;
  }

  private async getPredictionAccuracy(
    model: tf.LayersModel,
    features: number[][],
    labels: number[]
  ): Promise<number> {
    const predictions = model.predict(tf.tensor2d(features)) as tf.Tensor2D;
    const predArray = await predictions.data();
    
    let correct = 0;
    for (let i = 0; i < labels.length; i++) {
      const pred = predArray[i] > 0.5 ? 1 : 0;
      const actual = labels[i] > 0.5 ? 1 : 0;
      if (pred === actual) correct++;
    }

    predictions.dispose();
    return correct / labels.length;
  }

  private getModelFactory(config: ModelConfig | NeuralNetworkConfig): (inputShape: number[]) => tf.LayersModel {
    switch (config.modelType) {
      case 'linear_regression':
        return this.createLinearRegressionModel;
      case 'logistic_regression':
        return this.createLogisticRegressionModel;
      case 'neural_network':
        return (inputShape) => this.createNeuralNetworkModel(inputShape, config as NeuralNetworkConfig);
      default:
        throw new Error(`Unknown model type: ${config.modelType}`);
    }
  }

  private createFoldSplit(
    data: TrainingData,
    fold: number,
    totalFolds: number,
    foldSize: number
  ): { trainData: TrainingData; valData: TrainingData } {
    const startIdx = fold * foldSize;
    const endIdx = Math.min(startIdx + foldSize, data.features.length);

    const valFeatures = data.features.slice(startIdx, endIdx);
    const valLabels = data.labels.slice(startIdx, endIdx);

    const trainFeatures = [
      ...data.features.slice(0, startIdx),
      ...data.features.slice(endIdx)
    ];
    const trainLabels = [
      ...data.labels.slice(0, startIdx),
      ...data.labels.slice(endIdx)
    ];

    const trainData: TrainingData = {
      features: trainFeatures,
      labels: trainLabels,
      metadata: {
        ...data.metadata,
        sampleCount: trainFeatures.length
      }
    };

    const valData: TrainingData = {
      features: valFeatures,
      labels: valLabels,
      metadata: {
        ...data.metadata,
        sampleCount: valFeatures.length
      }
    };

    return { trainData, valData };
  }

  private getMainMetric(metrics: ModelMetrics, config: ModelConfig): number {
    if (config.modelType === 'logistic_regression') {
      return metrics.f1Score || metrics.accuracy || 0;
    } else {
      return 1 - (metrics.rmse || 1); // Convert error to score
    }
  }

  private rankModels(models: ModelComparison['models']): string[] {
    return models
      .map(model => ({
        name: model.name,
        score: this.getMainMetric(model.metrics, model.config)
      }))
      .sort((a, b) => b.score - a.score)
      .map(model => model.name);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Dispose all trained models
    for (const model of this.trainedModels.values()) {
      model.dispose();
    }
    
    this.trainedModels.clear();
    this.modelMetrics.clear();
    this.featureImportance.clear();

    console.log('🧹 Basic ML Models disposed');
  }
}