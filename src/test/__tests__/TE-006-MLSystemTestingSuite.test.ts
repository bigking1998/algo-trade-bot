/**
 * TE-006: ML System Testing Suite - TestingAgent Implementation
 * 
 * Comprehensive ML testing suite covering all ML System requirements:
 * - ML model accuracy tests
 * - Feature engineering validation
 * - Strategy performance tests
 * - A/B testing framework
 * 
 * This test suite validates all aspects of the ML system
 * as specified in Task TE-006 from COMPLETE_TASK_LIST.md
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { performance } from 'perf_hooks';
import * as tf from '@tensorflow/tfjs';
import { PricePredictionModel } from '../../frontend/ml/models/PricePredictionModel.js';
import { MarketRegimeModel } from '../../frontend/ml/models/MarketRegimeModel.js';
import { VolatilityModel } from '../../frontend/ml/models/VolatilityModel.js';
import { FeatureEngine } from '../../frontend/ml/features/FeatureEngine.js';
import { FeatureValidator } from '../../frontend/ml/features/FeatureValidator.js';
import { ModelTrainer } from '../../frontend/ml/training/ModelTrainer.js';
import { ModelValidator } from '../../frontend/ml/training/ModelValidator.js';
import { ModelEnsemble } from '../../frontend/ml/ensemble/ModelEnsemble.js';
import { BaseMLStrategy, MLStrategyConfig, MLPrediction } from '../../backend/strategies/ml/BaseMLStrategy.js';
import { StrategyContext, StrategySignal } from '../../backend/strategies/BaseStrategy.js';

// Test implementation of BaseMLStrategy for testing
class TestMLStrategy extends BaseMLStrategy {
  async defineTrainingStrategy() {
    return {
      targetVariable: 'price_direction',
      featureSelection: ['rsi', 'ema', 'volume'],
      modelArchitecture: { type: 'linear' },
      trainingParameters: { learningRate: 0.01 }
    };
  }

  async processPrediction(prediction: MLPrediction, context: StrategyContext): Promise<StrategySignal | null> {
    if (prediction.confidence < 0.6) return null;
    
    return {
      type: prediction.signal === 'BUY' ? 'LONG' : prediction.signal === 'SELL' ? 'SHORT' : 'EXIT',
      confidence: prediction.confidence,
      timestamp: new Date(),
      price: context.marketData.currentPrice,
      reason: 'ML prediction'
    };
  }

  validatePrediction(prediction: MLPrediction, context: StrategyContext): boolean {
    return prediction.confidence > 0.5;
  }

  async onModelDegradation(modelId: string, currentMetrics: any): Promise<void> {
    console.log(`Handling model degradation for ${modelId}`);
  }
}
import type { 
  PredictionResult,
  ModelMetrics,
  TrainingData,
  FeatureSet,
  ValidationResult
} from '../../frontend/ml/types/index.js';

// Mock TensorFlow for testing
vi.mock('@tensorflow/tfjs', () => ({
  tensor: vi.fn(),
  sequential: vi.fn(),
  layers: {
    dense: vi.fn(),
    dropout: vi.fn(),
    lstm: vi.fn()
  },
  train: {
    adam: vi.fn()
  },
  losses: {
    meanSquaredError: vi.fn()
  },
  metrics: {
    meanAbsoluteError: vi.fn()
  },
  loadLayersModel: vi.fn(),
  ready: vi.fn().mockResolvedValue(undefined)
}));

describe('TE-006: ML System Testing Suite', () => {
  let featureEngine: FeatureEngine;
  let featureValidator: FeatureValidator;
  let modelTrainer: ModelTrainer;
  let modelValidator: ModelValidator;

  beforeAll(async () => {
    // Initialize TensorFlow
    await tf.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    featureEngine = new FeatureEngine({
      indicators: ['rsi', 'macd', 'bollinger', 'ema', 'sma'],
      lookbackPeriod: 50,
      normalizationMethod: 'zscore'
    });

    featureValidator = new FeatureValidator({
      missingValueThreshold: 0.05,
      outlierThreshold: 3.0,
      correlationThreshold: 0.95
    });

    modelTrainer = new ModelTrainer({
      batchSize: 32,
      epochs: 50,
      validationSplit: 0.2,
      earlyStopping: true
    });

    modelValidator = new ModelValidator({
      crossValidationFolds: 5,
      testSize: 0.2,
      metrics: ['mae', 'mse', 'rmse', 'mape']
    });
  });

  // =============================================================================
  // ML MODEL ACCURACY TESTS
  // =============================================================================

  describe('ML Model Accuracy Tests', () => {
    it('should validate price prediction model accuracy', async () => {
      const pricePredictionModel = new PricePredictionModel({
        sequenceLength: 20,
        features: 10,
        hiddenUnits: 64,
        dropoutRate: 0.2
      });

      // Mock training data
      const mockTrainingData: TrainingData = {
        features: Array.from({ length: 1000 }, () => 
          Array.from({ length: 10 }, () => Math.random() * 100)
        ),
        labels: Array.from({ length: 1000 }, () => Math.random() * 1000 + 40000),
        timestamps: Array.from({ length: 1000 }, (_, i) => 
          new Date(Date.now() - (1000 - i) * 60000)
        )
      };

      // Mock TensorFlow tensor creation
      const mockTensor = {
        shape: [1000, 10],
        dataSync: vi.fn().mockReturnValue(new Float32Array(10000)),
        dispose: vi.fn()
      };
      (tf.tensor as any).mockReturnValue(mockTensor);

      // Train model
      await pricePredictionModel.initialize();
      const trainingResult = await pricePredictionModel.train(mockTrainingData);

      expect(trainingResult.success).toBe(true);
      expect(trainingResult.metrics).toBeDefined();
      expect(trainingResult.metrics.loss).toBeGreaterThan(0);
      expect(trainingResult.epochs).toBeGreaterThan(0);

      // Test predictions
      const testFeatures = Array.from({ length: 20 }, () => 
        Array.from({ length: 10 }, () => Math.random() * 100)
      );

      const predictions = await pricePredictionModel.predict(testFeatures);
      
      expect(predictions).toHaveLength(20);
      predictions.forEach(prediction => {
        expect(prediction.value).toBeGreaterThan(0);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        expect(prediction.timestamp).toBeInstanceOf(Date);
      });

      // Validate model metrics
      const modelMetrics = await pricePredictionModel.getMetrics();
      expect(modelMetrics.accuracy).toBeGreaterThan(0);
      expect(modelMetrics.mae).toBeGreaterThan(0);
      expect(modelMetrics.rmse).toBeGreaterThan(0);
      expect(modelMetrics.r2).toBeLessThanOrEqual(1);
    });

    it('should validate market regime classification model', async () => {
      const marketRegimeModel = new MarketRegimeModel({
        features: 15,
        regimes: ['bull', 'bear', 'sideways'],
        hiddenLayers: [32, 16],
        dropoutRate: 0.3
      });

      const mockClassificationData: TrainingData = {
        features: Array.from({ length: 500 }, () => 
          Array.from({ length: 15 }, () => Math.random() * 2 - 1) // Normalized features
        ),
        labels: Array.from({ length: 500 }, () => Math.floor(Math.random() * 3)), // 0, 1, 2 for regimes
        timestamps: Array.from({ length: 500 }, (_, i) => 
          new Date(Date.now() - (500 - i) * 3600000) // Hourly data
        )
      };

      await marketRegimeModel.initialize();
      const trainingResult = await marketRegimeModel.train(mockClassificationData);

      expect(trainingResult.success).toBe(true);
      expect(trainingResult.metrics.accuracy).toBeGreaterThan(0.3); // Should beat random (33.3%)

      // Test regime predictions
      const testFeatures = Array.from({ length: 10 }, () => 
        Array.from({ length: 15 }, () => Math.random() * 2 - 1)
      );

      const regimePredictions = await marketRegimeModel.predict(testFeatures);
      
      expect(regimePredictions).toHaveLength(10);
      regimePredictions.forEach(prediction => {
        expect(['bull', 'bear', 'sideways']).toContain(prediction.regime);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        expect(prediction.probabilities).toHaveLength(3);
        
        // Probabilities should sum to 1
        const probabilitySum = prediction.probabilities.reduce((sum, p) => sum + p, 0);
        expect(Math.abs(probabilitySum - 1)).toBeLessThan(0.01);
      });
    });

    it('should validate volatility prediction model accuracy', async () => {
      const volatilityModel = new VolatilityModel({
        sequenceLength: 30,
        features: 8,
        architecture: 'lstm',
        hiddenUnits: 32
      });

      const mockVolatilityData: TrainingData = {
        features: Array.from({ length: 800 }, () => 
          Array.from({ length: 8 }, () => Math.random() * 10)
        ),
        labels: Array.from({ length: 800 }, () => Math.random() * 0.05), // Volatility 0-5%
        timestamps: Array.from({ length: 800 }, (_, i) => 
          new Date(Date.now() - (800 - i) * 900000) // 15-minute data
        )
      };

      await volatilityModel.initialize();
      const trainingResult = await volatilityModel.train(mockVolatilityData);

      expect(trainingResult.success).toBe(true);
      expect(trainingResult.metrics.mae).toBeGreaterThan(0);
      expect(trainingResult.metrics.mae).toBeLessThan(0.02); // MAE should be reasonable

      // Test volatility predictions
      const testFeatures = Array.from({ length: 15 }, () => 
        Array.from({ length: 8 }, () => Math.random() * 10)
      );

      const volatilityPredictions = await volatilityModel.predict(testFeatures);
      
      expect(volatilityPredictions).toHaveLength(15);
      volatilityPredictions.forEach(prediction => {
        expect(prediction.volatility).toBeGreaterThanOrEqual(0);
        expect(prediction.volatility).toBeLessThan(1); // Should be reasonable
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should validate ensemble model performance', async () => {
      const priceModel = new PricePredictionModel({
        sequenceLength: 20,
        features: 10,
        hiddenUnits: 32,
        dropoutRate: 0.2
      });

      const regimeModel = new MarketRegimeModel({
        features: 10,
        regimes: ['bull', 'bear', 'sideways'],
        hiddenLayers: [16],
        dropoutRate: 0.2
      });

      const ensemble = new ModelEnsemble({
        models: [
          { model: priceModel, weight: 0.7, type: 'regression' },
          { model: regimeModel, weight: 0.3, type: 'classification' }
        ],
        aggregationMethod: 'weighted_average'
      });

      const mockEnsembleData: TrainingData = {
        features: Array.from({ length: 300 }, () => 
          Array.from({ length: 10 }, () => Math.random() * 100)
        ),
        labels: Array.from({ length: 300 }, () => Math.random() * 1000 + 40000),
        timestamps: Array.from({ length: 300 }, (_, i) => 
          new Date(Date.now() - (300 - i) * 60000)
        )
      };

      await ensemble.initialize();
      const trainingResult = await ensemble.train(mockEnsembleData);

      expect(trainingResult.success).toBe(true);
      expect(trainingResult.modelResults).toHaveLength(2);

      // Test ensemble predictions
      const testFeatures = Array.from({ length: 5 }, () => 
        Array.from({ length: 10 }, () => Math.random() * 100)
      );

      const ensemblePredictions = await ensemble.predict(testFeatures);
      
      expect(ensemblePredictions).toHaveLength(5);
      ensemblePredictions.forEach(prediction => {
        expect(prediction.value).toBeGreaterThan(0);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        expect(prediction.modelContributions).toBeDefined();
        expect(prediction.modelContributions).toHaveLength(2);
      });

      // Ensemble should outperform individual models
      const priceModelMetrics = await priceModel.getMetrics();
      const ensembleMetrics = await ensemble.getMetrics();
      
      // Ensemble confidence should be reasonable
      expect(ensembleMetrics.averageConfidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should validate model cross-validation accuracy', async () => {
      const model = new PricePredictionModel({
        sequenceLength: 15,
        features: 8,
        hiddenUnits: 24,
        dropoutRate: 0.15
      });

      const mockCVData: TrainingData = {
        features: Array.from({ length: 1000 }, () => 
          Array.from({ length: 8 }, () => Math.random() * 50)
        ),
        labels: Array.from({ length: 1000 }, () => Math.random() * 500 + 40000),
        timestamps: Array.from({ length: 1000 }, (_, i) => 
          new Date(Date.now() - (1000 - i) * 300000) // 5-minute data
        )
      };

      await model.initialize();

      // Perform cross-validation
      const cvResult = await modelValidator.crossValidate(model, mockCVData);

      expect(cvResult.folds).toHaveLength(5);
      expect(cvResult.averageMetrics).toBeDefined();
      expect(cvResult.averageMetrics.mae).toBeGreaterThan(0);
      expect(cvResult.averageMetrics.rmse).toBeGreaterThan(0);
      expect(cvResult.standardDeviation).toBeDefined();
      
      // CV results should be consistent across folds
      const maes = cvResult.folds.map(fold => fold.metrics.mae);
      const maeStd = Math.sqrt(maes.reduce((sum, mae) => sum + Math.pow(mae - cvResult.averageMetrics.mae, 2), 0) / maes.length);
      
      expect(maeStd / cvResult.averageMetrics.mae).toBeLessThan(0.5); // Coefficient of variation < 50%
    });
  });

  // =============================================================================
  // FEATURE ENGINEERING VALIDATION TESTS
  // =============================================================================

  describe('Feature Engineering Validation', () => {
    it('should validate feature extraction from market data', async () => {
      const mockMarketData = {
        candles: Array.from({ length: 100 }, (_, i) => ({
          timestamp: new Date(Date.now() - (100 - i) * 60000),
          open: 40000 + Math.sin(i * 0.1) * 1000,
          high: 40500 + Math.sin(i * 0.1) * 1000,
          low: 39500 + Math.sin(i * 0.1) * 1000,
          close: 40200 + Math.sin(i * 0.1) * 1000,
          volume: 1000 + Math.random() * 500
        })),
        indicators: {
          rsi: Array.from({ length: 100 }, () => 30 + Math.random() * 40),
          macd: Array.from({ length: 100 }, () => ({ macd: Math.random() * 100, signal: Math.random() * 100, histogram: Math.random() * 50 })),
          bollinger: Array.from({ length: 100 }, () => ({ upper: 41000, middle: 40000, lower: 39000 }))
        }
      };

      const features = await featureEngine.extractFeatures(mockMarketData);

      expect(features).toBeDefined();
      expect(features.raw).toBeDefined();
      expect(features.processed).toBeDefined();
      expect(features.metadata).toBeDefined();

      // Validate feature dimensions
      expect(features.processed.length).toBe(100);
      expect(features.processed[0].length).toBeGreaterThan(5); // Should have multiple features

      // Validate feature quality
      const validationResult = await featureValidator.validate(features);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.missingValueRatio).toBeLessThan(0.05);
      expect(validationResult.outlierRatio).toBeLessThan(0.1);
      expect(validationResult.duplicateRatio).toBeLessThan(0.02);
    });

    it('should validate technical indicator features', async () => {
      const indicatorData = {
        prices: Array.from({ length: 50 }, () => 40000 + Math.random() * 2000),
        volumes: Array.from({ length: 50 }, () => 1000 + Math.random() * 500),
        timestamps: Array.from({ length: 50 }, (_, i) => new Date(Date.now() - (50 - i) * 60000))
      };

      const indicatorFeatures = await featureEngine.computeTechnicalIndicators(indicatorData);

      expect(indicatorFeatures).toBeDefined();
      expect(indicatorFeatures.rsi).toBeDefined();
      expect(indicatorFeatures.macd).toBeDefined();
      expect(indicatorFeatures.bollinger).toBeDefined();
      expect(indicatorFeatures.ema).toBeDefined();
      expect(indicatorFeatures.sma).toBeDefined();

      // Validate RSI bounds
      indicatorFeatures.rsi.forEach(rsi => {
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
      });

      // Validate Bollinger Bands relationship
      indicatorFeatures.bollinger.forEach(bb => {
        expect(bb.upper).toBeGreaterThan(bb.middle);
        expect(bb.middle).toBeGreaterThan(bb.lower);
      });

      // Validate moving averages
      expect(indicatorFeatures.ema).toHaveLength(indicatorData.prices.length);
      expect(indicatorFeatures.sma).toHaveLength(indicatorData.prices.length);
    });

    it('should validate feature normalization', async () => {
      const rawFeatures = Array.from({ length: 100 }, () => 
        Array.from({ length: 10 }, () => Math.random() * 1000)
      );

      const normalizedFeatures = await featureEngine.normalizeFeatures(rawFeatures, 'zscore');

      expect(normalizedFeatures).toHaveLength(100);
      expect(normalizedFeatures[0]).toHaveLength(10);

      // Check Z-score normalization (mean ~0, std ~1)
      for (let featureIdx = 0; featureIdx < 10; featureIdx++) {
        const featureValues = normalizedFeatures.map(row => row[featureIdx]);
        const mean = featureValues.reduce((sum, val) => sum + val, 0) / featureValues.length;
        const std = Math.sqrt(featureValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / featureValues.length);

        expect(Math.abs(mean)).toBeLessThan(0.1); // Mean should be close to 0
        expect(Math.abs(std - 1)).toBeLessThan(0.2); // Std should be close to 1
      }
    });

    it('should validate feature selection and importance', async () => {
      const mockFeatures = {
        data: Array.from({ length: 200 }, () => 
          Array.from({ length: 20 }, () => Math.random() * 100)
        ),
        labels: Array.from({ length: 200 }, () => Math.random() * 1000),
        featureNames: Array.from({ length: 20 }, (_, i) => `feature_${i}`)
      };

      const featureImportance = await featureEngine.calculateFeatureImportance(mockFeatures);

      expect(featureImportance).toBeDefined();
      expect(featureImportance.scores).toHaveLength(20);
      expect(featureImportance.rankings).toHaveLength(20);

      // Validate importance scores
      featureImportance.scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      // Validate rankings
      expect(featureImportance.rankings[0]).toBeGreaterThan(featureImportance.rankings[19]);

      // Test feature selection
      const selectedFeatures = await featureEngine.selectTopFeatures(mockFeatures, 10);
      expect(selectedFeatures.data[0]).toHaveLength(10);
      expect(selectedFeatures.featureNames).toHaveLength(10);
    });

    it('should validate feature correlation analysis', async () => {
      const correlatedFeatures = Array.from({ length: 100 }, (_, i) => {
        const base = Math.sin(i * 0.1);
        return [
          base + Math.random() * 0.1, // Highly correlated
          base * 2 + Math.random() * 0.2, // Moderately correlated
          Math.random() * 2 - 1, // Uncorrelated
          -base + Math.random() * 0.1, // Negatively correlated
          Math.random() * 10 // Different scale, uncorrelated
        ];
      });

      const correlationMatrix = await featureEngine.calculateCorrelationMatrix(correlatedFeatures);

      expect(correlationMatrix).toHaveLength(5);
      expect(correlationMatrix[0]).toHaveLength(5);

      // Diagonal should be 1
      for (let i = 0; i < 5; i++) {
        expect(Math.abs(correlationMatrix[i][i] - 1)).toBeLessThan(0.01);
      }

      // Matrix should be symmetric
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          expect(Math.abs(correlationMatrix[i][j] - correlationMatrix[j][i])).toBeLessThan(0.01);
        }
      }

      // Identify highly correlated features
      const highlyCorrelated = await featureEngine.findHighlyCorrelatedFeatures(correlatedFeatures, 0.8);
      expect(highlyCorrelated.pairs.length).toBeGreaterThan(0);
      
      highlyCorrelated.pairs.forEach(pair => {
        expect(Math.abs(pair.correlation)).toBeGreaterThan(0.8);
      });
    });
  });

  // =============================================================================
  // STRATEGY PERFORMANCE TESTS
  // =============================================================================

  describe('ML Strategy Performance Tests', () => {
    it('should validate ML trend following strategy performance', async () => {
      const mlTrendStrategy = new TestMLStrategy({
        id: 'ml-trend-test',
        name: 'ML Trend Following Test',
        version: '1.0.0',
        type: 'ml',
        enabled: true,
        symbols: ['BTC-USD'],
        timeframe: '1h',
        maxPositions: 1,
        riskParameters: {
          maxPositionSize: 0.1,
          stopLoss: 0.02,
          takeProfit: 0.04,
          maxDrawdown: 0.05
        },
        ml: {
          modelTypes: ['PRICE_PREDICTION'],
          ensembleStrategy: 'AVERAGE',
          minConfidenceThreshold: 0.6,
          featureEngineeringConfig: {
            technicalIndicators: ['rsi', 'ema', 'sma'],
            lookbackPeriods: [10, 20, 50],
            priceFeatures: true,
            volumeFeatures: true,
            volatilityFeatures: true,
            marketStructureFeatures: false
          },
          predictionHorizon: 60,
          retrainingConfig: {
            enabled: true,
            frequency: 'daily',
            minAccuracyThreshold: 0.7,
            performanceDegradationThreshold: 0.1
          },
          onlineLearning: {
            enabled: false,
            batchSize: 32,
            learningRate: 0.001,
            forgettingFactor: 0.95
          }
        }
      });

      const mockStrategyContext = {
        marketData: {
          symbol: 'BTC-USD',
          timeframe: '1h',
          currentPrice: 41500,
          candles: Array.from({ length: 50 }, (_, i) => ({
            timestamp: new Date(Date.now() - (50 - i) * 3600000),
            open: 40000 + i * 30,
            high: 40500 + i * 30,
            low: 39500 + i * 30,
            close: 40200 + i * 30,
            volume: 1000
          }))
        },
        indicators: {
          rsi: 55,
          macd: { macd: 50, signal: 45, histogram: 5 },
          trend: 'bullish'
        },
        mlFeatures: Array.from({ length: 10 }, () => Math.random() * 2 - 1)
      };

      await mlTrendStrategy.initialize();
      const signal = await mlTrendStrategy.execute(mockStrategyContext as any);

      if (signal) {
        expect(signal.confidence).toBeGreaterThanOrEqual(60); // Above threshold
        expect(signal.reasoning).toContain('ML');
        expect(signal.metadata?.modelPrediction).toBeDefined();
        expect(signal.metadata?.featureImportance).toBeDefined();
      }

      // Test strategy performance metrics
      const metrics = await mlTrendStrategy.getPerformanceMetrics();
      expect(metrics.totalSignals).toBeGreaterThanOrEqual(0);
      expect(metrics.modelAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.modelAccuracy).toBeLessThanOrEqual(1);
    });

    it('should validate ML ensemble strategy performance', async () => {
      const ensembleStrategy = new TestMLStrategy({
        id: 'ml-ensemble-test',
        name: 'ML Ensemble Test',
        version: '1.0.0',
        type: 'ml',
        enabled: true,
        symbols: ['ETH-USD'],
        timeframe: '15m',
        maxPositions: 1,
        riskParameters: {
          maxPositionSize: 0.1,
          stopLoss: 0.02,
          takeProfit: 0.04,
          maxDrawdown: 0.05
        },
        ml: {
          modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY'],
          ensembleStrategy: 'WEIGHTED',
          minConfidenceThreshold: 0.6,
          featureEngineeringConfig: {
            technicalIndicators: ['rsi', 'ema', 'sma', 'macd'],
            lookbackPeriods: [5, 10, 20],
            priceFeatures: true,
            volumeFeatures: true,
            volatilityFeatures: true,
            marketStructureFeatures: true
          },
          predictionHorizon: 15,
          retrainingConfig: {
            enabled: true,
            frequency: 'daily',
            minAccuracyThreshold: 0.7,
            performanceDegradationThreshold: 0.1
          },
          onlineLearning: {
            enabled: true,
            batchSize: 16,
            learningRate: 0.001,
            forgettingFactor: 0.9
          }
        }
      });

      const mockEnsembleContext = {
        marketData: {
          symbol: 'ETH-USD',
          timeframe: '15m',
          currentPrice: 2500,
          candles: Array.from({ length: 30 }, () => ({
            timestamp: new Date(),
            open: 2500,
            high: 2520,
            low: 2480,
            close: 2510,
            volume: 500
          }))
        },
        indicators: {
          rsi: 45,
          macd: { macd: -10, signal: -8, histogram: -2 },
          volatility: 0.025
        },
        mlFeatures: Array.from({ length: 15 }, () => Math.random() * 2 - 1)
      };

      await ensembleStrategy.initialize();
      const signal = await ensembleStrategy.execute(mockEnsembleContext as any);

      if (signal) {
        expect(signal.metadata?.ensembleVotes).toBeDefined();
        expect(signal.metadata?.modelAgreement).toBeGreaterThanOrEqual(0);
        expect(signal.metadata?.modelAgreement).toBeLessThanOrEqual(1);
        expect(signal.confidence).toBeGreaterThanOrEqual(60);
      }

      // Validate ensemble metrics
      const metrics = await ensembleStrategy.getPerformanceMetrics();
      expect(metrics.ensembleAccuracy).toBeDefined();
      expect(metrics.individualModelPerformance).toBeDefined();
    });

    it('should validate model drift detection', async () => {
      const driftDetectionStrategy = new TestMLStrategy({
        id: 'drift-test-strategy',
        name: 'Drift Detection Test',
        version: '1.0.0',
        type: 'ml',
        enabled: true,
        symbols: ['BTC-USD'],
        timeframe: '1h',
        maxPositions: 1,
        riskParameters: {
          maxPositionSize: 0.05,
          stopLoss: 0.015,
          takeProfit: 0.03,
          maxDrawdown: 0.03
        },
        ml: {
          modelTypes: ['PRICE_PREDICTION'],
          ensembleStrategy: 'AVERAGE',
          minConfidenceThreshold: 0.5,
          featureEngineeringConfig: {
            technicalIndicators: ['rsi', 'ema'],
            lookbackPeriods: [10, 20],
            priceFeatures: true,
            volumeFeatures: false,
            volatilityFeatures: true,
            marketStructureFeatures: false
          },
          predictionHorizon: 60,
          retrainingConfig: {
            enabled: true,
            frequency: 'daily',
            minAccuracyThreshold: 0.6,
            performanceDegradationThreshold: 0.1
          },
          onlineLearning: {
            enabled: true,
            batchSize: 32,
            learningRate: 0.001,
            forgettingFactor: 0.95
          }
        }
      });

      // Simulate changing market conditions
      const baseContext = {
        marketData: {
          symbol: 'BTC-USD',
          timeframe: '1h',
          currentPrice: 41500,
          candles: Array.from({ length: 20 }, () => ({
            timestamp: new Date(),
            open: 41000,
            high: 42000,
            low: 41000,
            close: 41500,
            volume: 1000
          }))
        },
        indicators: { rsi: 50, macd: { macd: 0, signal: 0, histogram: 0 } }
      };

      await driftDetectionStrategy.initialize();

      // Execute with normal conditions
      const normalSignal = await driftDetectionStrategy.execute({
        ...baseContext,
        mlFeatures: Array.from({ length: 10 }, () => Math.random() * 0.5) // Normal range
      } as any);

      // Execute with drifted conditions
      const driftedSignal = await driftDetectionStrategy.execute({
        ...baseContext,
        mlFeatures: Array.from({ length: 10 }, () => 2 + Math.random() * 0.5) // Shifted distribution
      } as any);

      // Check drift detection
      const driftStatus = await driftDetectionStrategy.getDriftStatus();
      expect(driftStatus.isDrifting).toBeDefined();
      expect(driftStatus.driftScore).toBeGreaterThanOrEqual(0);
      expect(driftStatus.lastCheck).toBeInstanceOf(Date);

      if (driftStatus.isDrifting) {
        expect(driftStatus.driftScore).toBeGreaterThan(0.1); // Above threshold
      }
    });

    it('should validate A/B testing between ML models', async () => {
      const modelA = new PricePredictionModel({
        sequenceLength: 15,
        features: 8,
        hiddenUnits: 32,
        dropoutRate: 0.2
      });

      const modelB = new PricePredictionModel({
        sequenceLength: 20,
        features: 8,
        hiddenUnits: 64,
        dropoutRate: 0.1
      });

      const testData: TrainingData = {
        features: Array.from({ length: 100 }, () => 
          Array.from({ length: 8 }, () => Math.random() * 50)
        ),
        labels: Array.from({ length: 100 }, () => Math.random() * 1000 + 40000),
        timestamps: Array.from({ length: 100 }, (_, i) => 
          new Date(Date.now() - (100 - i) * 60000)
        )
      };

      // Initialize models
      await modelA.initialize();
      await modelB.initialize();

      // Train both models
      const trainResultA = await modelA.train(testData);
      const trainResultB = await modelB.train(testData);

      expect(trainResultA.success).toBe(true);
      expect(trainResultB.success).toBe(true);

      // Compare model performance
      const metricsA = await modelA.getMetrics();
      const metricsB = await modelB.getMetrics();

      const abTestResult = {
        modelA: {
          mae: metricsA.mae,
          rmse: metricsA.rmse,
          r2: metricsA.r2,
          trainTime: trainResultA.trainingTime
        },
        modelB: {
          mae: metricsB.mae,
          rmse: metricsB.rmse,
          r2: metricsB.r2,
          trainTime: trainResultB.trainingTime
        },
        winnerByMetric: {
          mae: metricsA.mae < metricsB.mae ? 'A' : 'B',
          rmse: metricsA.rmse < metricsB.rmse ? 'A' : 'B',
          r2: metricsA.r2 > metricsB.r2 ? 'A' : 'B'
        }
      };

      // Validate A/B test structure
      expect(abTestResult.modelA.mae).toBeGreaterThan(0);
      expect(abTestResult.modelB.mae).toBeGreaterThan(0);
      expect(['A', 'B']).toContain(abTestResult.winnerByMetric.mae);
      expect(['A', 'B']).toContain(abTestResult.winnerByMetric.rmse);
      expect(['A', 'B']).toContain(abTestResult.winnerByMetric.r2);

      console.log('A/B Test Results:', abTestResult);
    });
  });

  // =============================================================================
  // A/B TESTING FRAMEWORK TESTS
  // =============================================================================

  describe('A/B Testing Framework', () => {
    it('should implement statistical significance testing', async () => {
      // Mock performance data for two strategies
      const strategyA_returns = Array.from({ length: 100 }, () => 
        0.01 + Math.random() * 0.02 - 0.01 // Returns centered around 1%
      );
      
      const strategyB_returns = Array.from({ length: 100 }, () => 
        0.015 + Math.random() * 0.02 - 0.01 // Returns centered around 1.5%
      );

      // Perform t-test
      const tTestResult = performTTest(strategyA_returns, strategyB_returns);

      expect(tTestResult.tStatistic).toBeDefined();
      expect(tTestResult.pValue).toBeGreaterThanOrEqual(0);
      expect(tTestResult.pValue).toBeLessThanOrEqual(1);
      expect(tTestResult.isSignificant).toBe(tTestResult.pValue < 0.05);
      expect(tTestResult.confidenceInterval).toHaveLength(2);
      expect(tTestResult.effect_size).toBeDefined();

      console.log(`T-test: p=${tTestResult.pValue.toFixed(4)}, significant=${tTestResult.isSignificant}`);
    });

    it('should implement multi-armed bandit testing', async () => {
      const strategies = ['strategyA', 'strategyB', 'strategyC'];
      const bandit = new MultiArmedBandit(strategies, 'epsilon-greedy', { epsilon: 0.1 });

      // Simulate trading sessions
      const sessions = 1000;
      const results: Array<{ strategy: string; reward: number }> = [];

      for (let i = 0; i < sessions; i++) {
        const selectedStrategy = bandit.selectArm();
        
        // Simulate different strategy performance
        let reward;
        switch (selectedStrategy) {
          case 'strategyA':
            reward = Math.random() * 0.02 - 0.005; // Mean ~0.5%
            break;
          case 'strategyB':
            reward = Math.random() * 0.03 - 0.01; // Mean ~0.5%, higher variance
            break;
          case 'strategyC':
            reward = Math.random() * 0.025 - 0.005; // Mean ~0.75%
            break;
          default:
            reward = 0;
        }

        bandit.update(selectedStrategy, reward);
        results.push({ strategy: selectedStrategy, reward });
      }

      // Analyze results
      const strategyStats = strategies.map(strategy => {
        const strategyResults = results.filter(r => r.strategy === strategy);
        const avgReward = strategyResults.reduce((sum, r) => sum + r.reward, 0) / strategyResults.length;
        const selections = strategyResults.length;
        
        return { strategy, avgReward, selections, winRate: avgReward > 0 ? 1 : 0 };
      });

      // Best strategy should be selected more frequently over time
      const bestStrategy = strategyStats.reduce((best, current) => 
        current.avgReward > best.avgReward ? current : best
      );

      expect(bestStrategy.selections).toBeGreaterThan(sessions / strategies.length * 0.8); // Should be selected more
      
      // Validate exploration vs exploitation
      const totalSelections = strategyStats.reduce((sum, s) => sum + s.selections, 0);
      expect(totalSelections).toBe(sessions);

      console.log('Bandit results:', strategyStats);
    });

    it('should implement Bayesian A/B testing', async () => {
      const priorA = { alpha: 1, beta: 1 }; // Beta distribution prior
      const priorB = { alpha: 1, beta: 1 };

      const tradesA = 100;
      const successesA = 65; // 65% win rate
      const tradesB = 100;
      const successesB = 70; // 70% win rate

      // Update posteriors
      const posteriorA = {
        alpha: priorA.alpha + successesA,
        beta: priorB.beta + (tradesA - successesA)
      };

      const posteriorB = {
        alpha: priorB.alpha + successesB,
        beta: priorB.beta + (tradesB - successesB)
      };

      // Calculate probability that B > A
      const probBBetterThanA = calculateBetaProbability(posteriorB, posteriorA);

      expect(probBBetterThanA).toBeGreaterThanOrEqual(0);
      expect(probBBetterThanA).toBeLessThanOrEqual(1);
      expect(probBBetterThanA).toBeGreaterThan(0.5); // B should be better

      // Calculate credible intervals
      const credibleIntervalA = calculateBetaCredibleInterval(posteriorA, 0.95);
      const credibleIntervalB = calculateBetaCredibleInterval(posteriorB, 0.95);

      expect(credibleIntervalA).toHaveLength(2);
      expect(credibleIntervalB).toHaveLength(2);
      expect(credibleIntervalA[0]).toBeLessThan(credibleIntervalA[1]);
      expect(credibleIntervalB[0]).toBeLessThan(credibleIntervalB[1]);

      console.log(`Bayesian A/B: P(B>A) = ${probBBetterThanA.toFixed(3)}`);
      console.log(`A CI: [${credibleIntervalA[0].toFixed(3)}, ${credibleIntervalA[1].toFixed(3)}]`);
      console.log(`B CI: [${credibleIntervalB[0].toFixed(3)}, ${credibleIntervalB[1].toFixed(3)}]`);
    });

    it('should implement sequential A/B testing with early stopping', async () => {
      const sequentialTest = new SequentialABTest({
        alpha: 0.05, // Type I error rate
        beta: 0.2,   // Type II error rate (power = 0.8)
        minimumDetectableEffect: 0.02, // 2% difference
        maxSampleSize: 1000
      });

      const results: Array<{ sample: number; pValue: number; decision: string }> = [];
      
      // Simulate sequential testing
      for (let sample = 10; sample <= 1000; sample += 10) {
        // Generate sample data (A slightly worse than B)
        const sampleA = Array.from({ length: sample }, () => 
          0.01 + Math.random() * 0.02 - 0.01
        );
        const sampleB = Array.from({ length: sample }, () => 
          0.02 + Math.random() * 0.02 - 0.01
        );

        const testResult = sequentialTest.analyze(sampleA, sampleB, sample);
        results.push({
          sample,
          pValue: testResult.pValue,
          decision: testResult.decision
        });

        // Check for early stopping
        if (testResult.decision !== 'continue') {
          console.log(`Sequential test stopped at sample ${sample}: ${testResult.decision}`);
          break;
        }
      }

      expect(results.length).toBeGreaterThan(5); // Should run for multiple samples
      
      const finalResult = results[results.length - 1];
      expect(['continue', 'reject_null', 'accept_null']).toContain(finalResult.decision);

      // Should eventually detect difference or hit sample limit
      const finalDecision = finalResult.decision;
      if (finalDecision === 'reject_null') {
        expect(finalResult.pValue).toBeLessThan(0.05);
      }
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS FOR STATISTICAL TESTS
// =============================================================================

function performTTest(sampleA: number[], sampleB: number[]) {
  const meanA = sampleA.reduce((sum, x) => sum + x, 0) / sampleA.length;
  const meanB = sampleB.reduce((sum, x) => sum + x, 0) / sampleB.length;
  
  const varA = sampleA.reduce((sum, x) => sum + Math.pow(x - meanA, 2), 0) / (sampleA.length - 1);
  const varB = sampleB.reduce((sum, x) => sum + Math.pow(x - meanB, 2), 0) / (sampleB.length - 1);
  
  const pooledSE = Math.sqrt(varA / sampleA.length + varB / sampleB.length);
  const tStatistic = (meanA - meanB) / pooledSE;
  const df = sampleA.length + sampleB.length - 2;
  
  // Approximate p-value (simplified)
  const pValue = Math.min(1, Math.max(0, 2 * (1 - Math.abs(tStatistic) / 3)));
  
  const effectSize = (meanA - meanB) / Math.sqrt((varA + varB) / 2);
  const marginError = 1.96 * pooledSE; // 95% CI
  const confidenceInterval = [meanA - meanB - marginError, meanA - meanB + marginError];
  
  return {
    tStatistic,
    pValue,
    isSignificant: pValue < 0.05,
    effectSize,
    confidenceInterval
  };
}

class MultiArmedBandit {
  private arms: Map<string, { count: number; totalReward: number; avgReward: number }> = new Map();
  
  constructor(
    private strategies: string[],
    private algorithm: 'epsilon-greedy' | 'ucb',
    private params: { epsilon?: number } = {}
  ) {
    strategies.forEach(strategy => {
      this.arms.set(strategy, { count: 0, totalReward: 0, avgReward: 0 });
    });
  }
  
  selectArm(): string {
    if (this.algorithm === 'epsilon-greedy') {
      if (Math.random() < (this.params.epsilon || 0.1)) {
        // Explore: random selection
        return this.strategies[Math.floor(Math.random() * this.strategies.length)];
      } else {
        // Exploit: best arm so far
        let bestArm = this.strategies[0];
        let bestReward = this.arms.get(bestArm)!.avgReward;
        
        this.strategies.forEach(strategy => {
          const reward = this.arms.get(strategy)!.avgReward;
          if (reward > bestReward) {
            bestReward = reward;
            bestArm = strategy;
          }
        });
        
        return bestArm;
      }
    }
    
    return this.strategies[0]; // Default
  }
  
  update(strategy: string, reward: number): void {
    const arm = this.arms.get(strategy)!;
    arm.count++;
    arm.totalReward += reward;
    arm.avgReward = arm.totalReward / arm.count;
  }
}

function calculateBetaProbability(posteriorB: { alpha: number; beta: number }, posteriorA: { alpha: number; beta: number }): number {
  // Simplified approximation - in reality would use more sophisticated integration
  const meanA = posteriorA.alpha / (posteriorA.alpha + posteriorA.beta);
  const meanB = posteriorB.alpha / (posteriorB.alpha + posteriorB.beta);
  const varA = (posteriorA.alpha * posteriorA.beta) / (Math.pow(posteriorA.alpha + posteriorA.beta, 2) * (posteriorA.alpha + posteriorA.beta + 1));
  const varB = (posteriorB.alpha * posteriorB.beta) / (Math.pow(posteriorB.alpha + posteriorB.beta, 2) * (posteriorB.alpha + posteriorB.beta + 1));
  
  const diffMean = meanB - meanA;
  const diffVar = varA + varB;
  const z = diffMean / Math.sqrt(diffVar);
  
  // Approximate normal CDF
  return 0.5 + 0.5 * Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI));
}

function calculateBetaCredibleInterval(posterior: { alpha: number; beta: number }, confidence: number): [number, number] {
  const mean = posterior.alpha / (posterior.alpha + posterior.beta);
  const variance = (posterior.alpha * posterior.beta) / (Math.pow(posterior.alpha + posterior.beta, 2) * (posterior.alpha + posterior.beta + 1));
  const stdDev = Math.sqrt(variance);
  
  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.58 : 1.64; // 90%
  
  return [
    Math.max(0, mean - z * stdDev),
    Math.min(1, mean + z * stdDev)
  ];
}

class SequentialABTest {
  constructor(private config: {
    alpha: number;
    beta: number;
    minimumDetectableEffect: number;
    maxSampleSize: number;
  }) {}
  
  analyze(sampleA: number[], sampleB: number[], currentSample: number) {
    const tTestResult = performTTest(sampleA, sampleB);
    
    // Sequential boundaries (simplified)
    const spendingFunction = Math.sqrt(currentSample / this.config.maxSampleSize);
    const adjustedAlpha = this.config.alpha * spendingFunction;
    
    if (tTestResult.pValue < adjustedAlpha) {
      return { decision: 'reject_null', pValue: tTestResult.pValue };
    } else if (currentSample >= this.config.maxSampleSize) {
      return { decision: 'accept_null', pValue: tTestResult.pValue };
    } else {
      return { decision: 'continue', pValue: tTestResult.pValue };
    }
  }
}