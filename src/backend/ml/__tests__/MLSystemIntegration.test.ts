/**
 * ML System Integration Tests
 * 
 * Comprehensive tests for all ML components working together
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MLSystemFactory } from '../index';
import type { CandleData } from '../FeatureEngineering';

// Mock candle data for testing
const mockCandleData: CandleData[] = Array.from({ length: 100 }, (_, i) => ({
  timestamp: Date.now() - (100 - i) * 60000, // 1 minute intervals
  open: 100 + Math.random() * 10,
  high: 105 + Math.random() * 10,
  low: 95 + Math.random() * 10,
  close: 100 + Math.random() * 10,
  volume: 1000 + Math.random() * 500
}));

describe('ML System Integration', () => {
  let mlSystem: any;

  beforeAll(async () => {
    // Create complete ML pipeline
    mlSystem = await MLSystemFactory.createCompletePipeline({
      featureConfig: {
        lookbackPeriod: 20,
        includePrice: true,
        includeVolume: true,
        includeTechnical: true,
        normalization: 'zscore'
      },
      onlineLearningConfig: {
        learningRate: 0.001,
        adaptiveLearningRate: true,
        driftDetectionWindow: 50,
        driftThreshold: 0.1,
        updateFrequency: 5
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    if (mlSystem?.tfSetup) {
      await mlSystem.tfSetup.cleanup();
    }
    if (mlSystem?.mlModels) {
      mlSystem.mlModels.dispose();
    }
    if (mlSystem?.predictiveAnalytics) {
      mlSystem.predictiveAnalytics.dispose();
    }
  });

  it('should initialize all ML components', () => {
    expect(mlSystem.tfSetup).toBeDefined();
    expect(mlSystem.featureEngine).toBeDefined();
    expect(mlSystem.mlModels).toBeDefined();
    expect(mlSystem.trainingPipeline).toBeDefined();
    expect(mlSystem.advancedModels).toBeDefined();
    expect(mlSystem.onlineLearning).toBeDefined();
    expect(mlSystem.predictiveAnalytics).toBeDefined();
  });

  it('should extract features from market data', async () => {
    const features = await mlSystem.featureEngine.extractFeatures(
      mockCandleData,
      'BTC-USD'
    );

    expect(features).toBeDefined();
    expect(features.features).toBeInstanceOf(Float32Array);
    expect(features.featureNames).toBeInstanceOf(Array);
    expect(features.metadata).toBeDefined();
    expect(features.metadata.featureCount).toBeGreaterThan(0);
  });

  it('should perform predictive analytics', async () => {
    const trendAnalysis = mlSystem.predictiveAnalytics.analyzeTrendStrength(mockCandleData);
    
    expect(trendAnalysis).toBeDefined();
    expect(trendAnalysis.strength).toBeGreaterThanOrEqual(0);
    expect(trendAnalysis.strength).toBeLessThanOrEqual(1);
    expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(trendAnalysis.direction);
    expect(trendAnalysis.confidence).toBeGreaterThanOrEqual(0);
    expect(trendAnalysis.confidence).toBeLessThanOrEqual(1);
  });

  it('should create advanced model architectures', () => {
    const lstmModel = mlSystem.advancedModels.createLSTMModel(
      [50, 10], // sequence length, features
      {
        sequenceLength: 50,
        lstmUnits: [64, 32],
        dropout: 0.2,
        recurrentDropout: 0.2,
        returnSequences: true
      }
    );

    expect(lstmModel).toBeDefined();
    expect(lstmModel.layers.length).toBeGreaterThan(0);

    // Cleanup
    lstmModel.dispose();
  });

  it('should detect concept drift', () => {
    const driftMetrics = mlSystem.onlineLearning.detectConceptDrift(0.6, 0.8);
    
    expect(driftMetrics).toBeDefined();
    expect(typeof driftMetrics.detected).toBe('boolean');
    expect(driftMetrics.severity).toBeGreaterThanOrEqual(0);
    expect(driftMetrics.severity).toBeLessThanOrEqual(1);
    expect(driftMetrics.confidence).toBeGreaterThanOrEqual(0);
    expect(driftMetrics.confidence).toBeLessThanOrEqual(1);
  });

  it('should handle batch feature extraction', async () => {
    const batchData = Array.from({ length: 5 }, (_, i) => ({
      candleData: mockCandleData.slice(i * 10, (i + 1) * 10 + 50), // Ensure enough data
      symbol: `TEST-${i}`,
      timestamp: Date.now() + i * 60000
    }));

    const batchFeatures = await mlSystem.featureEngine.extractBatchFeatures(batchData);
    
    expect(batchFeatures).toBeInstanceOf(Array);
    expect(batchFeatures.length).toBeGreaterThan(0);
    expect(batchFeatures[0].features).toBeInstanceOf(Float32Array);
  });

  it('should provide system health metrics', () => {
    const healthStatus = mlSystem.tfSetup.getHealthStatus();
    
    expect(healthStatus).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.status);
    expect(healthStatus.checks).toBeDefined();
    expect(healthStatus.metrics).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    // Test with insufficient data
    const insufficientData = mockCandleData.slice(0, 5);
    
    await expect(
      mlSystem.featureEngine.extractFeatures(insufficientData, 'TEST')
    ).rejects.toThrow();
  });
});

describe('ML Performance Tests', () => {
  it('should process features efficiently', async () => {
    const mlSystem = await MLSystemFactory.createCompletePipeline();
    
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await mlSystem.featureEngine.extractFeatures(mockCandleData, `TEST-${i}`);
    }
    
    const endTime = Date.now();
    const avgTimePerExtraction = (endTime - startTime) / 10;
    
    // Should process features in reasonable time (< 100ms per extraction)
    expect(avgTimePerExtraction).toBeLessThan(100);
    
    // Cleanup
    await mlSystem.tfSetup.cleanup();
    mlSystem.mlModels.dispose();
  });
});