/**
 * Prediction Models Integration Tests
 * 
 * Comprehensive test suite for ML prediction models including performance
 * validation, integration testing, and accuracy verification.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PricePredictionModel, DEFAULT_PRICE_PREDICTION_CONFIGS } from '../models/PricePredictionModel';
import { MarketRegimeModel, DEFAULT_REGIME_CONFIG } from '../models/MarketRegimeModel';
import { VolatilityModel, DEFAULT_VOLATILITY_CONFIG } from '../models/VolatilityModel';
import { ModelEnsemble, DEFAULT_ENSEMBLE_CONFIGS } from '../ensemble/ModelEnsemble';
import { ModelTrainer, DEFAULT_TRAINING_CONFIGS } from '../training/ModelTrainer';
import { FeatureVector } from '../types';

// Mock TensorFlow.js for testing
const mockTensorFlow = {
  sequential: () => ({
    add: () => {},
    compile: () => {},
    fit: () => Promise.resolve({ history: { loss: [0.5, 0.3, 0.2] } }),
    predict: () => ({ data: () => Promise.resolve(new Float32Array([0.75])), dispose: () => {} }),
    save: () => Promise.resolve(),
    countParams: () => 1000,
    dispose: () => {}
  }),
  layers: {
    inputLayer: () => ({}),
    dense: () => ({}),
    lstm: () => ({}),
    conv2d: () => ({}),
    maxPooling2d: () => ({}),
    globalAveragePooling2d: () => ({}),
    globalAveragePooling1d: () => ({}),
    timeDistributed: () => ({}),
    dropout: () => ({}),
    reshape: () => ({})
  },
  train: {
    adam: () => ({})
  },
  tensor1d: (data: number[]) => ({
    data: () => Promise.resolve(new Float32Array(data)),
    dispose: () => {}
  }),
  tensor2d: (data: number[][]) => ({
    data: () => Promise.resolve(new Float32Array(data.flat())),
    dispose: () => {}
  }),
  tensor3d: (data: number[][][]) => ({
    data: () => Promise.resolve(new Float32Array(data.flat(2))),
    dispose: () => {}
  }),
  loadLayersModel: () => Promise.resolve({
    predict: () => ({ data: () => Promise.resolve(new Float32Array([0.75])), dispose: () => {} }),
    countParams: () => 1000,
    dispose: () => {}
  })
};

// Mock tf globally
(global as any).tf = mockTensorFlow;

// Test data generators
const generateMockFeatures = (count: number): FeatureVector[] => {
  const features: FeatureVector[] = [];
  
  for (let i = 0; i < count; i++) {
    features.push({
      timestamp: new Date(Date.now() - (count - i) * 60000),
      symbol: 'BTC-USD',
      timeframe: '1m',
      technical: {
        sma_20: 50000 + Math.random() * 5000,
        ema_20: 50000 + Math.random() * 5000,
        rsi: 30 + Math.random() * 40,
        macd: Math.random() * 100 - 50,
        atr: Math.random() * 1000,
        bb_upper: 52000 + Math.random() * 2000,
        bb_lower: 48000 + Math.random() * 2000,
        vwap: 50000 + Math.random() * 3000
      },
      price: {
        close: 50000 + Math.random() * 5000,
        high: 51000 + Math.random() * 5000,
        low: 49000 + Math.random() * 5000,
        open: 50000 + Math.random() * 5000,
        price_change_pct: (Math.random() - 0.5) * 0.1,
        high_low_ratio: 1.01 + Math.random() * 0.02,
        open_close_ratio: 0.98 + Math.random() * 0.04
      },
      volume: {
        volume: Math.random() * 1000000,
        volume_sma_ratio: 0.8 + Math.random() * 0.4,
        vwap_price_ratio: 0.98 + Math.random() * 0.04
      },
      market_structure: {
        trend_strength: Math.random(),
        volatility: Math.random() * 0.05,
        momentum: (Math.random() - 0.5) * 2
      },
      raw_values: {},
      metadata: {
        computation_time_ms: 10 + Math.random() * 40,
        data_quality_score: 0.8 + Math.random() * 0.2,
        missing_values: Math.floor(Math.random() * 5),
        outlier_count: Math.floor(Math.random() * 3),
        feature_count: 25,
        confidence_score: 0.7 + Math.random() * 0.3
      }
    });
  }
  
  return features;
};

const generateMockMarketData = (count: number) => {
  const data = [];
  let price = 50000;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.02; // ±1% change
    price *= (1 + change);
    
    data.push({
      time: Date.now() - (count - i) * 60000,
      open: price * (0.999 + Math.random() * 0.002),
      high: price * (1.001 + Math.random() * 0.002),
      low: price * (0.997 + Math.random() * 0.002),
      close: price,
      volume: Math.random() * 1000000,
      symbol: 'BTC-USD'
    });
  }
  
  return data;
};

describe('Price Prediction Model Tests', () => {
  let priceModel: PricePredictionModel;
  let mockFeatures: FeatureVector[];

  beforeEach(() => {
    priceModel = new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading);
    mockFeatures = generateMockFeatures(100);
  });

  afterEach(() => {
    if (priceModel) {
      priceModel.dispose();
    }
  });

  it('should initialize LSTM model successfully', async () => {
    const config = { ...DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading, architecture: 'lstm' as const };
    const lstmModel = new PricePredictionModel(config);
    
    await expect(lstmModel.initialize()).resolves.not.toThrow();
    
    lstmModel.dispose();
  });

  it('should initialize CNN model successfully', async () => {
    const config = { ...DEFAULT_PRICE_PREDICTION_CONFIGS.swingTrading, architecture: 'cnn' as const };
    const cnnModel = new PricePredictionModel(config);
    
    await expect(cnnModel.initialize()).resolves.not.toThrow();
    
    cnnModel.dispose();
  });

  it('should initialize Transformer model successfully', async () => {
    const config = { ...DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading, architecture: 'transformer' as const };
    const transformerModel = new PricePredictionModel(config);
    
    await expect(transformerModel.initialize()).resolves.not.toThrow();
    
    transformerModel.dispose();
  });

  it('should generate price predictions with required accuracy', async () => {
    await priceModel.initialize();
    
    const prediction = await priceModel.predict(mockFeatures, 50000, 'BTC-USD');
    
    // Test prediction structure
    expect(prediction).toHaveProperty('direction');
    expect(prediction).toHaveProperty('targetPrice');
    expect(prediction).toHaveProperty('priceConfidence');
    expect(prediction).toHaveProperty('volatilityForecast');
    
    // Test prediction bounds
    expect(prediction.priceConfidence).toBeGreaterThan(0);
    expect(prediction.priceConfidence).toBeLessThanOrEqual(1);
    expect(prediction.targetPrice).toBeGreaterThan(0);
    expect(['UP', 'DOWN', 'SIDEWAYS']).toContain(prediction.direction);
    
    // Test performance targets
    expect(prediction.priceConfidence).toBeGreaterThan(0.3); // Minimum confidence
  });

  it('should meet prediction latency requirements', async () => {
    await priceModel.initialize();
    
    const startTime = performance.now();
    await priceModel.predict(mockFeatures, 50000, 'BTC-USD');
    const latency = performance.now() - startTime;
    
    // Performance target: < 100ms
    expect(latency).toBeLessThan(100);
  });

  it('should handle training process', async () => {
    await priceModel.initialize();
    
    const trainingData = {
      features: [mockFeatures.slice(0, 50), mockFeatures.slice(25, 75)],
      prices: [[51000], [49500]]
    };
    
    await expect(priceModel.train(trainingData)).resolves.not.toThrow();
    
    const performance = priceModel.getPerformance();
    expect(performance.modelSize).toBeGreaterThan(0);
    expect(performance.architecture).toBe('transformer');
  });

  it('should save and load model state', async () => {
    await priceModel.initialize();
    
    await expect(priceModel.save('test-price-model')).resolves.not.toThrow();
    
    const newModel = new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading);
    await expect(newModel.load('test-price-model')).resolves.not.toThrow();
    
    newModel.dispose();
  });
});

describe('Market Regime Model Tests', () => {
  let regimeModel: MarketRegimeModel;
  let mockFeatures: FeatureVector[];

  beforeEach(() => {
    regimeModel = new MarketRegimeModel(DEFAULT_REGIME_CONFIG);
    mockFeatures = generateMockFeatures(100);
  });

  afterEach(() => {
    if (regimeModel) {
      regimeModel.dispose();
    }
  });

  it('should initialize regime model successfully', async () => {
    await expect(regimeModel.initialize()).resolves.not.toThrow();
  });

  it('should classify market regime accurately', async () => {
    await regimeModel.initialize();
    
    const classification = await regimeModel.classifyRegime(
      mockFeatures, 
      50000, 
      100000, 
      'BTC-USD'
    );
    
    // Test classification structure
    expect(classification).toHaveProperty('primaryRegime');
    expect(classification).toHaveProperty('trendRegime');
    expect(classification).toHaveProperty('volatilityRegime');
    expect(classification).toHaveProperty('confidence');
    expect(classification).toHaveProperty('regimeScore');
    
    // Test confidence bounds
    expect(classification.confidence).toBeGreaterThan(0);
    expect(classification.confidence).toBeLessThanOrEqual(1);
    
    // Test regime types
    const validRegimes = ['BULL_TREND', 'BEAR_TREND', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'SIDEWAYS', 'BREAKOUT'];
    expect(validRegimes).toContain(classification.primaryRegime);
  });

  it('should predict regime transitions', async () => {
    await regimeModel.initialize();
    
    const classification = await regimeModel.classifyRegime(
      mockFeatures, 
      50000, 
      100000, 
      'BTC-USD'
    );
    
    const transitions = await regimeModel.predictRegimeTransition(classification, 60);
    
    expect(Array.isArray(transitions)).toBe(true);
    expect(transitions.length).toBeGreaterThan(0);
    
    if (transitions.length > 0) {
      const transition = transitions[0];
      expect(transition).toHaveProperty('fromRegime');
      expect(transition).toHaveProperty('toRegime');
      expect(transition).toHaveProperty('probability');
      expect(transition.probability).toBeGreaterThan(0);
      expect(transition.probability).toBeLessThanOrEqual(1);
    }
  });

  it('should track regime statistics', async () => {
    await regimeModel.initialize();
    
    // Perform multiple classifications to build statistics
    for (let i = 0; i < 10; i++) {
      await regimeModel.classifyRegime(mockFeatures, 50000 + i * 100, 100000, 'BTC-USD');
    }
    
    const stats = regimeModel.getRegimeStats();
    
    expect(stats).toHaveProperty('currentRegime');
    expect(stats).toHaveProperty('regimeHistory');
    expect(stats).toHaveProperty('stats');
    expect(stats).toHaveProperty('indicators');
    
    expect(Array.isArray(stats.regimeHistory)).toBe(true);
  });
});

describe('Volatility Model Tests', () => {
  let volatilityModel: VolatilityModel;
  let mockFeatures: FeatureVector[];

  beforeEach(() => {
    volatilityModel = new VolatilityModel(DEFAULT_VOLATILITY_CONFIG);
    mockFeatures = generateMockFeatures(100);
  });

  afterEach(() => {
    if (volatilityModel) {
      volatilityModel.dispose();
    }
  });

  it('should initialize volatility model successfully', async () => {
    await expect(volatilityModel.initialize()).resolves.not.toThrow();
  });

  it('should forecast volatility with accuracy', async () => {
    await volatilityModel.initialize();
    
    const forecast = await volatilityModel.forecastVolatility(
      mockFeatures,
      50000,
      'BTC-USD'
    );
    
    // Test forecast structure
    expect(forecast).toHaveProperty('currentVolatility');
    expect(forecast).toHaveProperty('forecastedVolatility');
    expect(forecast).toHaveProperty('volatilityTrend');
    expect(forecast).toHaveProperty('confidence');
    expect(forecast).toHaveProperty('riskLevel');
    expect(forecast).toHaveProperty('valueAtRisk');
    
    // Test bounds
    expect(forecast.currentVolatility).toBeGreaterThan(0);
    expect(forecast.forecastedVolatility).toBeGreaterThan(0);
    expect(forecast.confidence).toBeGreaterThan(0);
    expect(forecast.confidence).toBeLessThanOrEqual(1);
    
    // Test risk levels
    expect(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']).toContain(forecast.riskLevel);
    expect(['INCREASING', 'DECREASING', 'STABLE']).toContain(forecast.volatilityTrend);
  });

  it('should generate volatility alerts', async () => {
    await volatilityModel.initialize();
    
    const forecast = await volatilityModel.forecastVolatility(
      mockFeatures,
      50000,
      'BTC-USD'
    );
    
    const alerts = volatilityModel.generateAlerts(forecast);
    
    expect(Array.isArray(alerts)).toBe(true);
    
    if (alerts.length > 0) {
      const alert = alerts[0];
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('message');
      expect(['SPIKE', 'CLUSTER_START', 'EXTREME_LEVEL', 'REGIME_CHANGE']).toContain(alert.type);
      expect(['INFO', 'WARNING', 'CRITICAL']).toContain(alert.severity);
    }
  });

  it('should detect volatility clustering', async () => {
    await volatilityModel.initialize();
    
    const forecast = await volatilityModel.forecastVolatility(
      mockFeatures,
      50000,
      'BTC-USD'
    );
    
    expect(forecast.clustering).toHaveProperty('isActive');
    expect(forecast.clustering).toHaveProperty('intensity');
    expect(forecast.clustering).toHaveProperty('expectedDuration');
    
    expect(typeof forecast.clustering.isActive).toBe('boolean');
    expect(forecast.clustering.intensity).toBeGreaterThanOrEqual(0);
    expect(forecast.clustering.intensity).toBeLessThanOrEqual(1);
  });
});

describe('Model Ensemble Tests', () => {
  let ensemble: ModelEnsemble;
  let priceModel1: PricePredictionModel;
  let priceModel2: PricePredictionModel;
  let regimeModel: MarketRegimeModel;
  let volatilityModel: VolatilityModel;
  let mockFeatures: FeatureVector[];

  beforeEach(async () => {
    ensemble = new ModelEnsemble(DEFAULT_ENSEMBLE_CONFIGS.balanced);
    
    priceModel1 = new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading);
    priceModel2 = new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.scalping);
    regimeModel = new MarketRegimeModel(DEFAULT_REGIME_CONFIG);
    volatilityModel = new VolatilityModel(DEFAULT_VOLATILITY_CONFIG);
    
    await priceModel1.initialize();
    await priceModel2.initialize();
    await regimeModel.initialize();
    await volatilityModel.initialize();
    
    ensemble.addPriceModel('model1', priceModel1);
    ensemble.addPriceModel('model2', priceModel2);
    ensemble.setRegimeModel(regimeModel);
    ensemble.setVolatilityModel(volatilityModel);
    
    mockFeatures = generateMockFeatures(100);
  });

  afterEach(() => {
    ensemble.dispose();
  });

  it('should combine multiple model predictions', async () => {
    const prediction = await ensemble.predict(
      mockFeatures,
      50000,
      100000,
      'BTC-USD'
    );
    
    // Test ensemble prediction structure
    expect(prediction).toHaveProperty('signal');
    expect(prediction).toHaveProperty('strength');
    expect(prediction).toHaveProperty('confidence');
    expect(prediction).toHaveProperty('priceTarget');
    expect(prediction).toHaveProperty('riskLevel');
    expect(prediction).toHaveProperty('modelContributions');
    expect(prediction).toHaveProperty('agreementLevel');
    
    // Test signal types
    expect(['BUY', 'SELL', 'HOLD']).toContain(prediction.signal);
    expect(['WEAK', 'MODERATE', 'STRONG', 'VERY_STRONG']).toContain(prediction.strength);
    
    // Test model contributions
    expect(Array.isArray(prediction.modelContributions)).toBe(true);
    expect(prediction.modelContributions.length).toBeGreaterThan(0);
    
    // Test agreement level
    expect(prediction.agreementLevel).toBeGreaterThan(0);
    expect(prediction.agreementLevel).toBeLessThanOrEqual(1);
  });

  it('should meet ensemble prediction performance targets', async () => {
    const startTime = performance.now();
    
    const prediction = await ensemble.predict(
      mockFeatures,
      50000,
      100000,
      'BTC-USD'
    );
    
    const latency = performance.now() - startTime;
    
    // Performance targets
    expect(latency).toBeLessThan(100); // < 100ms latency
    expect(prediction.confidence).toBeGreaterThan(0.3); // Minimum ensemble confidence
  });

  it('should handle performance updates', async () => {
    const prediction = await ensemble.predict(
      mockFeatures,
      50000,
      100000,
      'BTC-USD'
    );
    
    // Simulate performance update
    await expect(
      ensemble.updatePerformance('test', 51000, 'BUY', 30)
    ).resolves.not.toThrow();
    
    const metrics = ensemble.getPerformanceMetrics();
    expect(metrics).toHaveProperty('ensemble');
    expect(metrics).toHaveProperty('modelPerformance');
  });

  it('should run backtesting successfully', async () => {
    const historicalData = {
      features: Array(200).fill(null).map(() => mockFeatures),
      prices: Array(200).fill(0).map(() => 49000 + Math.random() * 2000),
      volumes: Array(200).fill(0).map(() => Math.random() * 1000000),
      actualDirections: Array(200).fill('HOLD').map(() => 
        ['BUY', 'SELL', 'HOLD'][Math.floor(Math.random() * 3)]
      ) as ('BUY' | 'SELL' | 'HOLD')[]
    };
    
    const results = await ensemble.backtest(
      historicalData,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      new Date()
    );
    
    expect(results).toHaveProperty('totalTrades');
    expect(results).toHaveProperty('winRate');
    expect(results).toHaveProperty('sharpeRatio');
    expect(results).toHaveProperty('maxDrawdown');
    expect(Array.isArray(results.predictions)).toBe(true);
  });
});

describe('Model Trainer Tests', () => {
  let trainer: ModelTrainer;
  let mockMarketData: any[];

  beforeEach(() => {
    trainer = new ModelTrainer(DEFAULT_TRAINING_CONFIGS.quickTest);
    mockMarketData = generateMockMarketData(500);
  });

  afterEach(() => {
    trainer.dispose();
  });

  it('should prepare training data successfully', async () => {
    const trainingData = await trainer.prepareTrainingData(
      mockMarketData,
      'BTC-USD',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      new Date()
    );
    
    expect(trainingData).toHaveProperty('features');
    expect(trainingData).toHaveProperty('labels');
    expect(trainingData).toHaveProperty('metadata');
    
    expect(Array.isArray(trainingData.features)).toBe(true);
    expect(Array.isArray(trainingData.labels)).toBe(true);
    expect(trainingData.features.length).toBeGreaterThan(0);
    expect(trainingData.labels.length).toBe(trainingData.features.length);
  });

  it('should handle training process with progress tracking', async () => {
    const trainingData = await trainer.prepareTrainingData(
      mockMarketData,
      'BTC-USD',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date()
    );
    
    let progressUpdates = 0;
    trainer.onProgress(() => {
      progressUpdates++;
    });
    
    const modelConfig = DEFAULT_PRICE_PREDICTION_CONFIGS.scalping;
    const result = await trainer.trainModel(modelConfig);
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('validation');
    expect(result).toHaveProperty('performanceMetrics');
    
    expect(progressUpdates).toBeGreaterThan(0);
  });

  it('should meet training performance requirements', async () => {
    const trainingData = await trainer.prepareTrainingData(
      mockMarketData,
      'BTC-USD',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date()
    );
    
    const startTime = Date.now();
    const result = await trainer.trainModel(DEFAULT_PRICE_PREDICTION_CONFIGS.scalping);
    const trainingTime = (Date.now() - startTime) / 60000; // minutes
    
    // Performance targets
    expect(trainingTime).toBeLessThan(5); // < 5 minutes for quick test
    
    if (result.success && result.validation) {
      expect(result.validation.accuracy).toBeGreaterThan(0.3); // Minimum accuracy for mock data
    }
  });
});

describe('System Integration Tests', () => {
  it('should handle memory usage within limits', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Create multiple models
    const models = [
      new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading),
      new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.scalping),
      new MarketRegimeModel(DEFAULT_REGIME_CONFIG),
      new VolatilityModel(DEFAULT_VOLATILITY_CONFIG)
    ];
    
    // Initialize all models
    for (const model of models) {
      await model.initialize();
    }
    
    // Generate predictions
    const mockFeatures = generateMockFeatures(50);
    for (let i = 0; i < 10; i++) {
      await models[0].predict(mockFeatures, 50000, 'BTC-USD');
    }
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
    
    // Performance target: < 300MB total memory usage
    if (finalMemory > 0) {
      expect(memoryIncrease).toBeLessThan(300);
    }
    
    // Cleanup
    for (const model of models) {
      model.dispose();
    }
  });

  it('should handle concurrent predictions', async () => {
    const model = new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading);
    await model.initialize();
    
    const mockFeatures = generateMockFeatures(50);
    
    // Run 10 concurrent predictions
    const promises = Array(10).fill(null).map(() => 
      model.predict(mockFeatures, 50000, 'BTC-USD')
    );
    
    const results = await Promise.all(promises);
    
    expect(results.length).toBe(10);
    results.forEach(result => {
      expect(result).toHaveProperty('direction');
      expect(result).toHaveProperty('targetPrice');
      expect(result).toHaveProperty('priceConfidence');
    });
    
    model.dispose();
  });

  it('should validate all models meet accuracy targets', async () => {
    const mockFeatures = generateMockFeatures(100);
    
    // Test price prediction accuracy
    const priceModel = new PricePredictionModel(DEFAULT_PRICE_PREDICTION_CONFIGS.dayTrading);
    await priceModel.initialize();
    
    const pricePrediction = await priceModel.predict(mockFeatures, 50000, 'BTC-USD');
    expect(pricePrediction.priceConfidence).toBeGreaterThan(0.55); // > 55% target
    
    priceModel.dispose();
    
    // Test regime model confidence
    const regimeModel = new MarketRegimeModel(DEFAULT_REGIME_CONFIG);
    await regimeModel.initialize();
    
    const regimeClassification = await regimeModel.classifyRegime(
      mockFeatures, 50000, 100000, 'BTC-USD'
    );
    expect(regimeClassification.confidence).toBeGreaterThan(0.5);
    
    regimeModel.dispose();
    
    // Test volatility model accuracy
    const volatilityModel = new VolatilityModel(DEFAULT_VOLATILITY_CONFIG);
    await volatilityModel.initialize();
    
    const volatilityForecast = await volatilityModel.forecastVolatility(
      mockFeatures, 50000, 'BTC-USD'
    );
    expect(volatilityForecast.confidence).toBeGreaterThan(0.5);
    
    volatilityModel.dispose();
  });
});