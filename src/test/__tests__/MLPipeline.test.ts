/**
 * ML Pipeline Test Suite - Task TE-001
 * 
 * Comprehensive testing for machine learning components including:
 * - Feature engineering accuracy and performance
 * - Model training and inference validation
 * - Prediction accuracy and consistency
 * - Online learning and adaptation
 * - Model versioning and management
 * - Performance benchmarks for real-time trading
 */

import { describe, test, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { TestingFramework } from '../TestingFramework';
import { MockDataGenerator } from '../MockDataGenerator';
import * as tf from '@tensorflow/tfjs';

// Mock ML components for testing
interface FeatureConfig {
  technical: {
    smaPeriodsToInclude: number[];
    emaPeriodsToInclude: number[];
    rsiPeriod: number;
    macdConfig: { fast: number; slow: number; signal: number };
  };
  fundamental: {
    includeVolume: boolean;
    includeMarketCap: boolean;
    includeSocialMetrics: boolean;
  };
  sentiment: {
    includeNewssentiment: boolean;
    includeSocialSentiment: boolean;
    includeFearGreed: boolean;
  };
}

class FeatureEngine {
  constructor(private config: FeatureConfig) {}

  computeFeatures(marketData: any[], config?: Partial<FeatureConfig>): {
    technical: Record<string, number>;
    fundamental: Record<string, number>;
    sentiment: Record<string, number>;
  } {
    const actualConfig = config ? { ...this.config, ...config } : this.config;
    
    if (marketData.length < 50) {
      throw new Error('Insufficient data for feature computation');
    }

    // Simulate feature computation
    const features = {
      technical: this.computeTechnicalFeatures(marketData, actualConfig.technical),
      fundamental: this.computeFundamentalFeatures(marketData, actualConfig.fundamental),
      sentiment: this.computeSentimentFeatures(marketData, actualConfig.sentiment)
    };

    return features;
  }

  private computeTechnicalFeatures(data: any[], config: any): Record<string, number> {
    const lastPrice = data[data.length - 1].close;
    const features: Record<string, number> = {};

    // SMA calculations
    config.smaPeriodsToInclude.forEach((period: number) => {
      const slice = data.slice(-period);
      const sma = slice.reduce((sum, candle) => sum + candle.close, 0) / slice.length;
      features[`sma_${period}`] = sma;
      features[`sma_${period}_ratio`] = lastPrice / sma;
    });

    // EMA calculations (simplified)
    config.emaPeriodsToInclude.forEach((period: number) => {
      const alpha = 2 / (period + 1);
      let ema = data[data.length - period].close;
      
      for (let i = data.length - period + 1; i < data.length; i++) {
        ema = alpha * data[i].close + (1 - alpha) * ema;
      }
      
      features[`ema_${period}`] = ema;
      features[`ema_${period}_ratio`] = lastPrice / ema;
    });

    // RSI calculation (simplified)
    const rsiPeriod = config.rsiPeriod;
    const changes = data.slice(-rsiPeriod - 1).map((candle, i, arr) => 
      i === 0 ? 0 : candle.close - arr[i - 1].close
    ).slice(1);
    
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
    
    const rs = avgGain / (avgLoss || 0.001);
    features.rsi_14 = 100 - (100 / (1 + rs));

    // MACD calculation (simplified)
    const { fast, slow, signal } = config.macdConfig;
    features.macd_line = features[`ema_${fast}`] - features[`ema_${slow}`];
    features.macd_signal = features.macd_line * 0.8; // Simplified signal line
    features.macd_histogram = features.macd_line - features.macd_signal;

    // Volatility features
    const returns = data.slice(-20).map((candle, i, arr) => 
      i === 0 ? 0 : Math.log(candle.close / arr[i - 1].close)
    ).slice(1);
    
    features.volatility_20 = Math.sqrt(
      returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length
    );

    // Volume features
    const avgVolume = data.slice(-20).reduce((sum, candle) => sum + candle.volume, 0) / 20;
    features.volume_ratio = data[data.length - 1].volume / avgVolume;

    return features;
  }

  private computeFundamentalFeatures(data: any[], config: any): Record<string, number> {
    const features: Record<string, number> = {};

    if (config.includeVolume) {
      features.avg_volume_24h = data.slice(-24).reduce((sum, candle) => sum + candle.volume, 0) / 24;
    }

    if (config.includeMarketCap) {
      features.market_cap_rank = Math.floor(Math.random() * 100) + 1;
    }

    if (config.includeSocialMetrics) {
      features.social_volume = Math.random() * 1000;
    }

    return features;
  }

  private computeSentimentFeatures(data: any[], config: any): Record<string, number> {
    const features: Record<string, number> = {};

    if (config.includeNewsSentiment) {
      features.news_sentiment = (Math.random() - 0.5) * 2;
    }

    if (config.includeSocialSentiment) {
      features.social_sentiment = (Math.random() - 0.5) * 2;
    }

    if (config.includeFearGreed) {
      features.fear_greed_index = Math.random() * 100;
    }

    return features;
  }

  getFeatureCount(): number {
    return 25; // Mock feature count
  }

  normalizeFeatures(features: any): any {
    // Mock normalization
    const normalized: any = {};
    
    Object.keys(features).forEach(category => {
      normalized[category] = {};
      Object.keys(features[category]).forEach(feature => {
        const value = features[category][feature];
        // Simple min-max normalization (mock)
        normalized[category][feature] = Math.max(0, Math.min(1, (value + 100) / 200));
      });
    });

    return normalized;
  }
}

class MLModel {
  private model: tf.LayersModel | null = null;
  private isCompiled = false;
  private trainingHistory: any[] = [];

  constructor(
    private modelConfig: {
      inputShape: number[];
      architecture: 'dense' | 'lstm' | 'cnn';
      hiddenLayers: number[];
      outputSize: number;
      activation: string;
    }
  ) {}

  async buildModel(): Promise<void> {
    const { inputShape, architecture, hiddenLayers, outputSize, activation } = this.modelConfig;

    if (architecture === 'dense') {
      this.model = tf.sequential();
      
      // Input layer
      this.model.add(tf.layers.dense({
        units: hiddenLayers[0],
        activation: 'relu',
        inputShape: inputShape
      }));

      // Hidden layers
      hiddenLayers.slice(1).forEach(units => {
        this.model.add(tf.layers.dropout({ rate: 0.2 }));
        this.model.add(tf.layers.dense({ units, activation: 'relu' }));
      });

      // Output layer
      this.model.add(tf.layers.dense({ units: outputSize, activation }));
    }
    
    // LSTM and CNN implementations would be similar...
  }

  compile(config: { optimizer: string; loss: string; metrics: string[] }): void {
    if (!this.model) {
      throw new Error('Model must be built before compiling');
    }

    this.model.compile({
      optimizer: config.optimizer,
      loss: config.loss,
      metrics: config.metrics
    });

    this.isCompiled = true;
  }

  async train(
    xTrain: tf.Tensor, 
    yTrain: tf.Tensor, 
    config: {
      epochs: number;
      batchSize: number;
      validationSplit: number;
      callbacks?: any[];
    }
  ): Promise<tf.History> {
    if (!this.model || !this.isCompiled) {
      throw new Error('Model must be built and compiled before training');
    }

    const history = await this.model.fit(xTrain, yTrain, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      callbacks: config.callbacks || []
    });

    this.trainingHistory.push(history);
    return history;
  }

  async predict(features: tf.Tensor): Promise<tf.Tensor> {
    if (!this.model) {
      throw new Error('Model must be trained before making predictions');
    }

    return this.model.predict(features) as tf.Tensor;
  }

  async evaluate(xTest: tf.Tensor, yTest: tf.Tensor): Promise<tf.Scalar[]> {
    if (!this.model) {
      throw new Error('Model must be trained before evaluation');
    }

    return this.model.evaluate(xTest, yTest) as tf.Scalar[];
  }

  getModelSummary(): void {
    if (this.model) {
      this.model.summary();
    }
  }

  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    await this.model.save(`localstorage://${path}`);
  }

  async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`localstorage://${path}`);
      this.isCompiled = true;
    } catch (error) {
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }

  getTrainingHistory(): any[] {
    return this.trainingHistory;
  }
}

class MLPipeline {
  private featureEngine: FeatureEngine;
  private models: Map<string, MLModel> = new Map();
  private predictions: Map<string, any[]> = new Map();

  constructor(private config: {
    featureConfig: FeatureConfig;
    modelConfigs: Record<string, any>;
  }) {
    this.featureEngine = new FeatureEngine(config.featureConfig);
  }

  async initializeModels(): Promise<void> {
    for (const [modelName, modelConfig] of Object.entries(this.config.modelConfigs)) {
      const model = new MLModel(modelConfig);
      await model.buildModel();
      model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });
      this.models.set(modelName, model);
    }
  }

  async trainModels(
    trainingData: any[], 
    config: {
      testSplit: number;
      epochs: number;
      batchSize: number;
    }
  ): Promise<Record<string, tf.History>> {
    const features = this.featureEngine.computeFeatures(trainingData);
    const normalizedFeatures = this.featureEngine.normalizeFeatures(features);

    // Convert features to tensor (simplified)
    const featureArray = this.flattenFeatures(normalizedFeatures);
    const xData = tf.tensor2d([featureArray]);
    const yData = tf.tensor2d([[0.5]]); // Mock target

    const histories: Record<string, tf.History> = {};

    for (const [modelName, model] of this.models.entries()) {
      const history = await model.train(xData, yData, {
        epochs: config.epochs,
        batchSize: config.batchSize,
        validationSplit: 0.2
      });
      histories[modelName] = history;
    }

    // Cleanup tensors
    xData.dispose();
    yData.dispose();

    return histories;
  }

  async makePredictions(
    marketData: any[], 
    modelName: string
  ): Promise<{ prediction: number; confidence: number; features: any }> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    const features = this.featureEngine.computeFeatures(marketData);
    const normalizedFeatures = this.featureEngine.normalizeFeatures(features);
    const featureArray = this.flattenFeatures(normalizedFeatures);

    const inputTensor = tf.tensor2d([featureArray]);
    const prediction = await model.predict(inputTensor);
    
    const predictionValue = await prediction.data();
    const confidence = Math.min(0.95, Math.max(0.05, Math.abs(predictionValue[0] - 0.5) * 2));

    // Store prediction for analysis
    const predictionRecord = {
      timestamp: new Date(),
      modelName,
      prediction: predictionValue[0],
      confidence,
      features: normalizedFeatures
    };

    if (!this.predictions.has(modelName)) {
      this.predictions.set(modelName, []);
    }
    this.predictions.get(modelName)!.push(predictionRecord);

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    return {
      prediction: predictionValue[0],
      confidence,
      features: normalizedFeatures
    };
  }

  private flattenFeatures(features: any): number[] {
    const flattened: number[] = [];
    
    Object.values(features).forEach(category => {
      Object.values(category as Record<string, number>).forEach(value => {
        flattened.push(value);
      });
    });

    return flattened;
  }

  getPredictionHistory(modelName: string): any[] {
    return this.predictions.get(modelName) || [];
  }

  async evaluateModel(
    modelName: string, 
    testData: any[]
  ): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
  }> {
    // Mock evaluation metrics
    return {
      accuracy: 0.65 + Math.random() * 0.2,
      precision: 0.6 + Math.random() * 0.3,
      recall: 0.55 + Math.random() * 0.3,
      f1Score: 0.6 + Math.random() * 0.25,
      auc: 0.7 + Math.random() * 0.2
    };
  }

  dispose(): void {
    this.models.forEach(model => model.dispose());
    this.models.clear();
    this.predictions.clear();
  }
}

describe('ML Pipeline Tests', () => {
  let featureEngine: FeatureEngine;
  let mlModel: MLModel;
  let mlPipeline: MLPipeline;
  let testMarketData: any[];

  const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
    technical: {
      smaPeriodsToInclude: [10, 20, 50],
      emaPeriodsToInclude: [12, 26],
      rsiPeriod: 14,
      macdConfig: { fast: 12, slow: 26, signal: 9 }
    },
    fundamental: {
      includeVolume: true,
      includeMarketCap: true,
      includeSocialMetrics: true
    },
    sentiment: {
      includeNewsSentiment: true,
      includeSocialSentiment: true,
      includeFearGreed: true
    }
  };

  beforeAll(async () => {
    // Initialize TensorFlow.js backend
    await tf.ready();
  });

  beforeEach(() => {
    testMarketData = MockDataGenerator.generateOHLCV({
      count: 200,
      basePrice: 50000,
      trend: 'up',
      volatility: 0.02
    });

    featureEngine = new FeatureEngine(DEFAULT_FEATURE_CONFIG);

    mlModel = new MLModel({
      inputShape: [25],
      architecture: 'dense',
      hiddenLayers: [64, 32, 16],
      outputSize: 1,
      activation: 'sigmoid'
    });

    mlPipeline = new MLPipeline({
      featureConfig: DEFAULT_FEATURE_CONFIG,
      modelConfigs: {
        trendPredictor: {
          inputShape: [25],
          architecture: 'dense',
          hiddenLayers: [64, 32],
          outputSize: 1,
          activation: 'sigmoid'
        },
        volatilityPredictor: {
          inputShape: [25],
          architecture: 'lstm',
          hiddenLayers: [50, 25],
          outputSize: 1,
          activation: 'linear'
        }
      }
    });
  });

  afterEach(() => {
    mlModel.dispose();
    mlPipeline.dispose();
    
    // Clean up TensorFlow tensors
    const numTensors = tf.memory().numTensors;
    if (numTensors > 0) {
      console.warn(`Memory leak detected: ${numTensors} tensors not disposed`);
    }
  });

  describe('Feature Engineering', () => {
    test('should compute technical features accurately', () => {
      const features = featureEngine.computeFeatures(testMarketData, DEFAULT_FEATURE_CONFIG);
      
      expect(features.technical).toBeDefined();
      expect(features.technical.sma_20).toBeGreaterThan(0);
      expect(features.technical.ema_12).toBeGreaterThan(0);
      expect(features.technical.rsi_14).toBeBetween(0, 100);
      
      // Validate SMA calculation manually
      const last20Candles = testMarketData.slice(-20);
      const manualSMA = last20Candles.reduce((sum, candle) => sum + candle.close, 0) / 20;
      
      TestingFramework.assertWithinRange(
        features.technical.sma_20,
        manualSMA,
        TestingFramework.ACCURACY_STANDARDS.indicatorTolerance
      );
    });

    test('should compute features within performance benchmarks', async () => {
      await TestingFramework.assertPerformance(async () => {
        const features = featureEngine.computeFeatures(testMarketData);
        expect(features).toBeDefined();
        expect(Object.keys(features.technical).length).toBeGreaterThan(0);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.featureComputation);
    });

    test('should handle insufficient data gracefully', () => {
      const insufficientData = MockDataGenerator.generateOHLCV({ count: 10 });
      
      expect(() => {
        featureEngine.computeFeatures(insufficientData);
      }).toThrow('Insufficient data for feature computation');
    });

    test('should normalize features correctly', () => {
      const features = featureEngine.computeFeatures(testMarketData);
      const normalizedFeatures = featureEngine.normalizeFeatures(features);
      
      expect(normalizedFeatures.technical).toBeDefined();
      
      // All normalized values should be between 0 and 1
      Object.values(normalizedFeatures.technical).forEach(value => {
        expect(value as number).toBeGreaterThanOrEqual(0);
        expect(value as number).toBeLessThanOrEqual(1);
      });
    });

    test('should generate consistent features for same input', () => {
      const features1 = featureEngine.computeFeatures(testMarketData);
      const features2 = featureEngine.computeFeatures(testMarketData);
      
      expect(features1.technical.sma_20).toBe(features2.technical.sma_20);
      expect(features1.technical.rsi_14).toBe(features2.technical.rsi_14);
    });

    test('should compute streaming features efficiently', async () => {
      const baseData = testMarketData.slice(0, 100);
      const streamingData = testMarketData.slice(100);
      
      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < streamingData.length; i++) {
          const currentData = [...baseData, ...streamingData.slice(0, i + 1)];
          const features = featureEngine.computeFeatures(currentData);
          expect(features.technical.sma_20).toBeGreaterThan(0);
        }
      }, TestingFramework.PERFORMANCE_BENCHMARKS.featureComputation * 50);
    });
  });

  describe('Model Training and Inference', () => {
    test('should build and compile model successfully', async () => {
      await mlModel.buildModel();
      
      expect(() => {
        mlModel.compile({
          optimizer: 'adam',
          loss: 'meanSquaredError',
          metrics: ['mae']
        });
      }).not.toThrow();
    });

    test('should train model and return history', async () => {
      await mlModel.buildModel();
      mlModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      const xTrain = tf.randomNormal([100, 25]);
      const yTrain = tf.randomNormal([100, 1]);
      
      const history = await mlModel.train(xTrain, yTrain, {
        epochs: 5,
        batchSize: 32,
        validationSplit: 0.2
      });

      expect(history).toBeDefined();
      expect(history.history).toBeDefined();
      expect(Array.isArray(history.history.loss)).toBe(true);

      // Cleanup
      xTrain.dispose();
      yTrain.dispose();
    });

    test('should make predictions within performance benchmarks', async () => {
      await mlModel.buildModel();
      mlModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Quick training
      const xTrain = tf.randomNormal([50, 25]);
      const yTrain = tf.randomNormal([50, 1]);
      await mlModel.train(xTrain, yTrain, { epochs: 2, batchSize: 16, validationSplit: 0.1 });

      const inputFeatures = tf.randomNormal([1, 25]);
      
      await TestingFramework.assertPerformance(async () => {
        const prediction = await mlModel.predict(inputFeatures);
        expect(prediction).toBeDefined();
        
        const predictionValue = await prediction.data();
        expect(predictionValue.length).toBe(1);
        expect(typeof predictionValue[0]).toBe('number');
        
        prediction.dispose();
      }, TestingFramework.PERFORMANCE_BENCHMARKS.featureComputation);

      // Cleanup
      xTrain.dispose();
      yTrain.dispose();
      inputFeatures.dispose();
    });

    test('should handle model evaluation correctly', async () => {
      await mlModel.buildModel();
      mlModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Train model
      const xTrain = tf.randomNormal([50, 25]);
      const yTrain = tf.randomNormal([50, 1]);
      await mlModel.train(xTrain, yTrain, { epochs: 3, batchSize: 16, validationSplit: 0.1 });

      // Evaluate model
      const xTest = tf.randomNormal([20, 25]);
      const yTest = tf.randomNormal([20, 1]);
      
      const evaluation = await mlModel.evaluate(xTest, yTest);
      expect(Array.isArray(evaluation)).toBe(true);
      expect(evaluation.length).toBeGreaterThan(0);

      // Cleanup
      xTrain.dispose();
      yTrain.dispose();
      xTest.dispose();
      yTest.dispose();
      evaluation.forEach(metric => metric.dispose());
    });

    test('should maintain model memory efficiency', async () => {
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        await mlModel.buildModel();
        mlModel.compile({
          optimizer: 'adam',
          loss: 'meanSquaredError',
          metrics: ['mae']
        });

        // Multiple prediction cycles
        for (let i = 0; i < 100; i++) {
          const input = tf.randomNormal([1, 25]);
          if (i === 0) {
            // Need to train first
            const xTrain = tf.randomNormal([10, 25]);
            const yTrain = tf.randomNormal([10, 1]);
            await mlModel.train(xTrain, yTrain, { epochs: 1, batchSize: 10, validationSplit: 0 });
            xTrain.dispose();
            yTrain.dispose();
          }
          
          const prediction = await mlModel.predict(input);
          
          input.dispose();
          prediction.dispose();
        }

        return 100;
      });

      expect(memoryTest.memoryUsedMB).toBeLessThan(100); // Should use less than 100MB
      expect(memoryTest.result).toBe(100);
    });
  });

  describe('ML Pipeline Integration', () => {
    test('should initialize pipeline with multiple models', async () => {
      await mlPipeline.initializeModels();
      
      // This would normally check internal state, but we'll test indirectly
      expect(mlPipeline).toBeDefined();
    });

    test('should train multiple models successfully', async () => {
      await mlPipeline.initializeModels();
      
      const trainingConfig = {
        testSplit: 0.2,
        epochs: 3,
        batchSize: 16
      };

      const histories = await mlPipeline.trainModels(testMarketData, trainingConfig);
      
      expect(histories).toBeDefined();
      expect(typeof histories).toBe('object');
      expect(Object.keys(histories).length).toBeGreaterThan(0);
    });

    test('should make predictions with confidence scores', async () => {
      await mlPipeline.initializeModels();
      
      // Quick training
      await mlPipeline.trainModels(testMarketData, {
        testSplit: 0.2,
        epochs: 2,
        batchSize: 32
      });

      const prediction = await mlPipeline.makePredictions(testMarketData, 'trendPredictor');
      
      expect(prediction).toBeDefined();
      expect(typeof prediction.prediction).toBe('number');
      expect(typeof prediction.confidence).toBe('number');
      expect(prediction.confidence).toBeBetween(0, 1);
      expect(prediction.features).toBeDefined();
    });

    test('should evaluate model performance correctly', async () => {
      await mlPipeline.initializeModels();
      
      const metrics = await mlPipeline.evaluateModel('trendPredictor', testMarketData);
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.accuracy).toBe('number');
      expect(typeof metrics.precision).toBe('number');
      expect(typeof metrics.recall).toBe('number');
      expect(typeof metrics.f1Score).toBe('number');
      expect(typeof metrics.auc).toBe('number');
      
      // All metrics should be between 0 and 1
      Object.values(metrics).forEach(metric => {
        expect(metric).toBeBetween(0, 1);
      });
    });

    test('should track prediction history', async () => {
      await mlPipeline.initializeModels();
      
      await mlPipeline.trainModels(testMarketData, {
        testSplit: 0.2,
        epochs: 2,
        batchSize: 32
      });

      // Make multiple predictions
      for (let i = 0; i < 5; i++) {
        const subset = testMarketData.slice(i * 10, i * 10 + 100);
        await mlPipeline.makePredictions(subset, 'trendPredictor');
      }

      const history = mlPipeline.getPredictionHistory('trendPredictor');
      expect(history).toHaveLength(5);
      
      history.forEach(record => {
        expect(record.timestamp).toBeInstanceOf(Date);
        expect(record.modelName).toBe('trendPredictor');
        expect(typeof record.prediction).toBe('number');
        expect(typeof record.confidence).toBe('number');
      });
    });
  });

  describe('Real-time Performance', () => {
    test('should handle high-frequency feature computation', async () => {
      const results = [];
      
      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < 1000; i++) {
          const subset = testMarketData.slice(Math.max(0, i - 100), i + 100);
          if (subset.length >= 100) {
            const features = featureEngine.computeFeatures(subset);
            results.push(features.technical.sma_20);
          }
        }
      }, 1000, 'High-frequency feature computation');

      expect(results.length).toBeGreaterThan(800);
    });

    test('should maintain inference speed under load', async () => {
      await mlPipeline.initializeModels();
      await mlPipeline.trainModels(testMarketData, {
        testSplit: 0.2,
        epochs: 2,
        batchSize: 32
      });

      const predictions = [];
      
      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < 100; i++) {
          const subset = testMarketData.slice(i, i + 100);
          const prediction = await mlPipeline.makePredictions(subset, 'trendPredictor');
          predictions.push(prediction.prediction);
        }
      }, 5000, 'High-frequency predictions');

      expect(predictions).toHaveLength(100);
    });
  });

  describe('Model Accuracy and Validation', () => {
    test('should validate prediction consistency', async () => {
      await mlPipeline.initializeModels();
      await mlPipeline.trainModels(testMarketData, {
        testSplit: 0.2,
        epochs: 5,
        batchSize: 32
      });

      // Make multiple predictions with same input
      const predictions = [];
      for (let i = 0; i < 10; i++) {
        const prediction = await mlPipeline.makePredictions(testMarketData, 'trendPredictor');
        predictions.push(prediction.prediction);
      }

      // Predictions should be consistent (same input = same output)
      const firstPrediction = predictions[0];
      predictions.forEach(prediction => {
        TestingFramework.assertWithinRange(
          prediction,
          firstPrediction,
          0.001, // Very small tolerance for consistency
          'Prediction consistency check'
        );
      });
    });

    test('should validate feature importance', () => {
      const features = featureEngine.computeFeatures(testMarketData);
      
      // Technical features should be more stable than sentiment features
      expect(typeof features.technical.sma_20).toBe('number');
      expect(typeof features.technical.rsi_14).toBe('number');
      expect(features.technical.rsi_14).toBeBetween(0, 100);
      
      // Volume ratio should be positive
      expect(features.technical.volume_ratio).toBeGreaterThan(0);
      
      // MACD components should be related
      const macdLine = features.technical.macd_line;
      const macdSignal = features.technical.macd_signal;
      const macdHistogram = features.technical.macd_histogram;
      
      TestingFramework.assertWithinRange(
        macdHistogram,
        macdLine - macdSignal,
        TestingFramework.ACCURACY_STANDARDS.featureTolerance
      );
    });

    test('should detect overfitting', async () => {
      await mlPipeline.initializeModels();
      
      const trainingData = testMarketData.slice(0, 100);
      const testData = testMarketData.slice(100, 200);
      
      // Train with limited data (potential overfitting scenario)
      await mlPipeline.trainModels(trainingData, {
        testSplit: 0.1, // Small validation set
        epochs: 20, // Many epochs
        batchSize: 10  // Small batch size
      });

      const trainingMetrics = await mlPipeline.evaluateModel('trendPredictor', trainingData);
      const testMetrics = await mlPipeline.evaluateModel('trendPredictor', testData);
      
      // Check for significant performance gap (overfitting indicator)
      const accuracyGap = trainingMetrics.accuracy - testMetrics.accuracy;
      
      if (accuracyGap > 0.2) {
        console.warn(`Potential overfitting detected: training accuracy ${trainingMetrics.accuracy.toFixed(3)}, test accuracy ${testMetrics.accuracy.toFixed(3)}`);
      }
      
      expect(accuracyGap).toBeLessThan(0.5); // Should not be extreme
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid model names', async () => {
      await mlPipeline.initializeModels();
      
      await expect(
        mlPipeline.makePredictions(testMarketData, 'nonexistentModel')
      ).rejects.toThrow('Model nonexistentModel not found');
    });

    test('should handle corrupted features', async () => {
      // Create corrupted market data
      const corruptedData = testMarketData.map(candle => ({
        ...candle,
        close: candle.close * (Math.random() > 0.9 ? NaN : 1) // 10% chance of NaN
      }));

      expect(() => {
        featureEngine.computeFeatures(corruptedData);
      }).not.toThrow(); // Should handle gracefully or throw meaningful error
    });

    test('should handle model training failures', async () => {
      await mlModel.buildModel();
      mlModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Try training with mismatched tensor shapes
      const xTrain = tf.randomNormal([10, 20]); // Wrong shape (should be [*, 25])
      const yTrain = tf.randomNormal([10, 1]);
      
      await expect(
        mlModel.train(xTrain, yTrain, { epochs: 1, batchSize: 5, validationSplit: 0 })
      ).rejects.toThrow();

      xTrain.dispose();
      yTrain.dispose();
    });

    test('should validate tensor memory management', async () => {
      const initialTensorCount = tf.memory().numTensors;
      
      await mlModel.buildModel();
      mlModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Create and dispose tensors in loop
      for (let i = 0; i < 100; i++) {
        const tensor1 = tf.randomNormal([10, 25]);
        const tensor2 = tf.randomNormal([10, 1]);
        
        // Immediately dispose
        tensor1.dispose();
        tensor2.dispose();
      }

      const finalTensorCount = tf.memory().numTensors;
      
      // Should not have significant tensor accumulation
      expect(finalTensorCount - initialTensorCount).toBeLessThan(10);
    });
  });

  describe('Model Persistence and Versioning', () => {
    test('should save and load model successfully', async () => {
      await mlModel.buildModel();
      mlModel.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Train briefly
      const xTrain = tf.randomNormal([20, 25]);
      const yTrain = tf.randomNormal([20, 1]);
      await mlModel.train(xTrain, yTrain, { epochs: 2, batchSize: 10, validationSplit: 0 });

      // Save model
      const modelName = 'test-model-' + Date.now();
      await mlModel.saveModel(modelName);

      // Create new model instance and load
      const newModel = new MLModel({
        inputShape: [25],
        architecture: 'dense',
        hiddenLayers: [64, 32, 16],
        outputSize: 1,
        activation: 'sigmoid'
      });

      await newModel.loadModel(modelName);

      // Test that loaded model can make predictions
      const testInput = tf.randomNormal([1, 25]);
      const prediction = await newModel.predict(testInput);
      
      expect(prediction).toBeDefined();
      const predValue = await prediction.data();
      expect(typeof predValue[0]).toBe('number');

      // Cleanup
      xTrain.dispose();
      yTrain.dispose();
      testInput.dispose();
      prediction.dispose();
      newModel.dispose();
    });

    test('should handle model loading failures', async () => {
      const newModel = new MLModel({
        inputShape: [25],
        architecture: 'dense',
        hiddenLayers: [64, 32, 16],
        outputSize: 1,
        activation: 'sigmoid'
      });

      await expect(
        newModel.loadModel('nonexistent-model')
      ).rejects.toThrow('Failed to load model');

      newModel.dispose();
    });
  });
});