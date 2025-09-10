/**
 * Signal Generator Test Suite - Task BE-014
 * 
 * Comprehensive tests for the signal generation system including:
 * - Signal generation pipeline
 * - Confidence scoring
 * - Signal validation and enhancement
 * - Conflict resolution
 * - Performance metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalGenerator } from '../SignalGenerator.js';
import type {
  SignalGenerationRequest,
  SignalGenerationResult,
  SignalGenerationConfig
} from '../types.js';
import type {
  StrategyContext,
  StrategySignal,
  MarketDataWindow
} from '../../strategies/types.js';
import type {
  ConditionExpression,
  EvaluationContext
} from '../../conditions/types.js';

// Mock the condition engine
vi.mock('../../conditions/ConditionEvaluationEngine.js', () => ({
  ConditionEvaluationEngine: vi.fn().mockImplementation(() => ({
    evaluateBatch: vi.fn().mockResolvedValue({
      success: true,
      results: new Map([
        ['test-condition-1', {
          conditionId: 'test-condition-1',
          success: true,
          value: true,
          confidence: 0.85,
          executionTime: 45,
          details: {
            type: 'comparison',
            shortCircuited: false,
            fromCache: false,
            intermediate: []
          },
          context: {
            timestamp: Date.now(),
            symbol: 'BTC-USD',
            timeframe: '1h'
          }
        }]
      ]),
      errors: new Map(),
      metadata: {
        totalConditions: 1,
        successfulEvaluations: 1,
        failedEvaluations: 0,
        totalExecutionTime: 45,
        averageExecutionTime: 45,
        cacheHits: 0,
        shortCircuits: 0
      }
    })
  }))
}));

describe('SignalGenerator', () => {
  let signalGenerator: SignalGenerator;
  let mockRequest: SignalGenerationRequest;
  let mockContext: StrategyContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const config: Partial<SignalGenerationConfig> = {
      id: 'test-generator',
      validation: {
        minConfidence: 50,
        maxSignalsPerInterval: 10,
        duplicateDetection: true,
        conflictResolution: 'highest_confidence'
      },
      persistence: {
        enableHistory: false
      }
    };

    signalGenerator = new SignalGenerator(config);

    // Create mock market data
    const mockMarketData: MarketDataWindow = {
      symbol: 'BTC-USD',
      timeframe: '1h',
      candles: [
        {
          startedAt: '2024-01-01T00:00:00.000Z',
          ticker: 'BTC-USD',
          resolution: '1HOUR',
          low: '42000',
          high: '43000',
          open: '42500',
          close: '42800',
          baseTokenVolume: '1000',
          usdVolume: '42500000',
          trades: 1500,
          startingOpenInterest: '10000'
        }
      ],
      currentPrice: 42800,
      volume24h: 42500000,
      change24h: 300,
      change24hPercent: 0.7,
      high24h: 43000,
      low24h: 42000,
      lastUpdate: new Date()
    };

    // Create mock strategy context
    mockContext = {
      marketData: mockMarketData,
      indicators: {
        rsi: 65,
        macd: {
          macd: 120,
          signal: 100,
          histogram: 20
        },
        bollinger: {
          upper: 43200,
          middle: 42800,
          lower: 42400,
          bandwidth: 800,
          percent: 0.5
        },
        lastCalculated: new Date()
      },
      portfolio: {
        id: 'test-portfolio',
        totalValue: 100000,
        availableBalance: 50000,
        positions: [],
        lastUpdated: new Date()
      } as any,
      riskMetrics: {
        portfolioValue: 100000,
        availableCapital: 50000,
        usedMargin: 0,
        marginRatio: 0,
        totalPositions: 0,
        longPositions: 0,
        shortPositions: 0,
        largestPosition: 0,
        concentrationRisk: 0,
        strategyExposure: 0,
        correlationRisk: 0,
        drawdown: 0,
        maxDrawdown: 0,
        marketVolatility: 0.02,
        liquidityRisk: 0,
        gapRisk: 0,
        maxRiskPerTrade: 2,
        maxPortfolioRisk: 10,
        maxLeverage: 3,
        riskScore: 30,
        lastAssessed: new Date()
      },
      recentSignals: [],
      recentTrades: [],
      timestamp: new Date(),
      executionId: 'test-execution-1',
      strategyId: 'test-strategy',
      marketConditions: {
        trend: 'bull',
        volatility: 'medium',
        liquidity: 'high',
        session: 'american'
      }
    };

    // Create mock request
    mockRequest = {
      id: 'test-request-1',
      strategyId: 'test-strategy',
      context: mockContext,
      conditions: [
        {
          id: 'test-condition-1',
          type: 'comparison',
          operator: 'GREATER_THAN',
          left: {
            type: 'indicator',
            indicatorId: 'rsi',
            field: 'value',
            offset: 0
          },
          right: {
            type: 'literal',
            value: 60
          }
        } as any
      ],
      timestamp: new Date(),
      priority: 'medium'
    };
  });

  afterEach(async () => {
    await signalGenerator.stop();
  });

  describe('Signal Generation', () => {
    it('should generate signals successfully', async () => {
      const result = await signalGenerator.generateSignals(mockRequest);

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(mockRequest.id);
      expect(result.signals).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.conditionsEvaluated).toBe(1);
      expect(result.metadata.conditionsPassed).toBe(1);
    });

    it('should generate signal with correct properties', async () => {
      const result = await signalGenerator.generateSignals(mockRequest);
      const signal = result.signals[0];

      expect(signal).toMatchObject({
        strategyId: 'test-strategy',
        symbol: 'BTC-USD',
        timeframe: '1h',
        type: 'BUY',
        isValid: true
      });
      
      expect(signal.confidence).toBeGreaterThan(0);
      expect(signal.confidence).toBeLessThanOrEqual(100);
      expect(signal.strength).toBeGreaterThan(0);
      expect(signal.strength).toBeLessThanOrEqual(1);
      expect(signal.entryPrice).toBe(42800);
      expect(signal.conditions).toContain('test-condition-1');
    });

    it('should calculate confidence scores correctly', async () => {
      const result = await signalGenerator.generateSignals(mockRequest);
      const signal = result.signals[0];

      // Confidence should be calculated based on condition confidence and other factors
      expect(signal.confidence).toBeGreaterThan(50); // Above minimum threshold
      expect(signal.confidence).toBeLessThanOrEqual(100);
    });

    it('should handle multiple conditions', async () => {
      // Add second condition
      mockRequest.conditions.push({
        id: 'test-condition-2',
        type: 'comparison',
        operator: 'LESS_THAN',
        left: {
          type: 'indicator',
          indicatorId: 'rsi',
          field: 'value',
          offset: 0
        },
        right: {
          type: 'literal',
          value: 80
        }
      } as any);

      const result = await signalGenerator.generateSignals(mockRequest);

      expect(result.success).toBe(true);
      expect(result.metadata.conditionsEvaluated).toBe(2);
    });

    it('should set risk management levels', async () => {
      const result = await signalGenerator.generateSignals(mockRequest);
      const signal = result.signals[0];

      expect(signal.stopLoss).toBeDefined();
      expect(signal.takeProfit).toBeDefined();
      expect(signal.maxRisk).toBeDefined();
      expect(signal.stopLoss).toBeLessThan(signal.entryPrice!);
      expect(signal.takeProfit).toBeGreaterThan(signal.entryPrice!);
    });
  });

  describe('Signal Validation', () => {
    it('should reject signals below minimum confidence', async () => {
      // Create generator with high confidence threshold
      const restrictiveGenerator = new SignalGenerator({
        validation: {
          minConfidence: 95,
          maxSignalsPerInterval: 10,
          duplicateDetection: true,
          conflictResolution: 'highest_confidence'
        }
      });

      const result = await restrictiveGenerator.generateSignals(mockRequest);

      // Signal should be filtered out due to low confidence
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('validation');
      
      await restrictiveGenerator.stop();
    });

    it('should handle validation errors gracefully', async () => {
      // Create request without required fields
      const invalidRequest = {
        ...mockRequest,
        strategyId: '' // Invalid strategy ID
      };

      const result = await signalGenerator.generateSignals(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('validation');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve signal conflicts', async () => {
      // Mock condition engine to return conflicting signals
      const mockEngine = (signalGenerator as any).conditionEngine;
      mockEngine.evaluateBatch.mockResolvedValue({
        success: true,
        results: new Map([
          ['buy-condition', {
            conditionId: 'buy-condition',
            success: true,
            value: true,
            confidence: 0.8,
            executionTime: 45,
            details: { type: 'comparison', shortCircuited: false, fromCache: false, intermediate: [] },
            context: { timestamp: Date.now(), symbol: 'BTC-USD', timeframe: '1h' }
          }],
          ['sell-condition', {
            conditionId: 'sell-condition',
            success: true,
            value: true,
            confidence: 0.7,
            executionTime: 50,
            details: { type: 'comparison', shortCircuited: false, fromCache: false, intermediate: [] },
            context: { timestamp: Date.now(), symbol: 'BTC-USD', timeframe: '1h' }
          }]
        ]),
        errors: new Map(),
        metadata: {
          totalConditions: 2,
          successfulEvaluations: 2,
          failedEvaluations: 0,
          totalExecutionTime: 95,
          averageExecutionTime: 47.5,
          cacheHits: 0,
          shortCircuits: 0
        }
      });

      // Override signal generation to create conflicting signals
      const originalGenerateSignal = (signalGenerator as any).generateSignalFromCondition;
      (signalGenerator as any).generateSignalFromCondition = vi.fn()
        .mockResolvedValueOnce({
          id: 'buy-signal',
          type: 'BUY',
          confidence: 80,
          symbol: 'BTC-USD',
          timeframe: '1h',
          entryPrice: 42800
        })
        .mockResolvedValueOnce({
          id: 'sell-signal',
          type: 'SELL',
          confidence: 70,
          symbol: 'BTC-USD',
          timeframe: '1h',
          entryPrice: 42800
        });

      const conflictRequest = {
        ...mockRequest,
        conditions: [
          { id: 'buy-condition', type: 'comparison' } as any,
          { id: 'sell-condition', type: 'comparison' } as any
        ]
      };

      const result = await signalGenerator.generateSignals(conflictRequest);

      // Should resolve to one signal (highest confidence)
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe('BUY'); // Higher confidence
    });
  });

  describe('Performance Metrics', () => {
    it('should track processing performance', async () => {
      await signalGenerator.generateSignals(mockRequest);
      await signalGenerator.generateSignals(mockRequest);
      await signalGenerator.generateSignals(mockRequest);

      const snapshot = signalGenerator.getPerformanceSnapshot();

      expect(snapshot.totalConditions).toBeGreaterThan(0);
      expect(snapshot.performance.evaluationsPerSecond).toBeGreaterThanOrEqual(0);
      expect(snapshot.performance.averageLatency).toBeGreaterThan(0);
      expect(snapshot.performance.successRate).toBeGreaterThan(0);
    });

    it('should provide condition-specific metrics', async () => {
      await signalGenerator.generateSignals(mockRequest);

      const metrics = signalGenerator.getConditionMetrics('test-condition-1');

      expect(metrics).toBeDefined();
      expect(metrics!.totalExecutions).toBeGreaterThan(0);
      expect(metrics!.successfulExecutions).toBeGreaterThan(0);
      expect(metrics!.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing', () => {
    it('should handle batch signal generation', async () => {
      const requests = [
        { ...mockRequest, id: 'batch-1' },
        { ...mockRequest, id: 'batch-2' },
        { ...mockRequest, id: 'batch-3' }
      ];

      const results = await Promise.all(
        requests.map(req => signalGenerator.generateSignals(req))
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.requestId).toBe(`batch-${index + 1}`);
        expect(result.signals).toHaveLength(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle condition evaluation errors', async () => {
      // Mock condition engine to throw error
      const mockEngine = (signalGenerator as any).conditionEngine;
      mockEngine.evaluateBatch.mockRejectedValue(new Error('Condition evaluation failed'));

      const result = await signalGenerator.generateSignals(mockRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Condition evaluation failed');
    });

    it('should handle timeout scenarios', async () => {
      // Mock condition engine with slow response
      const mockEngine = (signalGenerator as any).conditionEngine;
      mockEngine.evaluateBatch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const timeoutRequest = {
        ...mockRequest,
        timeout: 100 // 100ms timeout
      };

      const result = await signalGenerator.generateSignals(timeoutRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('timeout');
    });

    it('should handle invalid strategy context', async () => {
      const invalidRequest = {
        ...mockRequest,
        context: {
          ...mockContext,
          marketData: null as any
        }
      };

      const result = await signalGenerator.generateSignals(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use provided configuration', async () => {
      const config = signalGenerator.getConfig();

      expect(config.id).toBe('test-generator');
      expect(config.validation.minConfidence).toBe(50);
      expect(config.validation.conflictResolution).toBe('highest_confidence');
    });

    it('should update configuration', async () => {
      const newConfig = {
        validation: {
          minConfidence: 75,
          maxSignalsPerInterval: 20,
          duplicateDetection: false,
          conflictResolution: 'latest' as const
        }
      };

      await signalGenerator.updateConfig(newConfig);

      const updatedConfig = signalGenerator.getConfig();
      expect(updatedConfig.validation.minConfidence).toBe(75);
      expect(updatedConfig.validation.maxSignalsPerInterval).toBe(20);
      expect(updatedConfig.validation.duplicateDetection).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', async () => {
      const health = await signalGenerator.getHealthStatus();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('score');
      expect(health).toHaveProperty('issues');
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.score).toBe('number');
      expect(Array.isArray(health.issues)).toBe(true);
    });

    it('should detect performance issues', async () => {
      // Simulate high load by making many concurrent requests
      const promises = Array.from({ length: 100 }, (_, i) => 
        signalGenerator.generateSignals({
          ...mockRequest,
          id: `load-test-${i}`
        })
      );

      await Promise.allSettled(promises);

      const health = await signalGenerator.getHealthStatus();
      
      // Health score might be affected by load
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Event Emission', () => {
    it('should emit signal generation events', async () => {
      const eventPromises = [
        new Promise(resolve => signalGenerator.once('requestStarted', resolve)),
        new Promise(resolve => signalGenerator.once('requestCompleted', resolve))
      ];

      const resultPromise = signalGenerator.generateSignals(mockRequest);

      const [startEvent, completedEvent] = await Promise.all([
        ...eventPromises,
        resultPromise
      ]);

      expect(startEvent).toBeDefined();
      expect(completedEvent).toBeDefined();
    });

    it('should emit error events on failure', async () => {
      // Mock condition engine to throw error
      const mockEngine = (signalGenerator as any).conditionEngine;
      mockEngine.evaluateBatch.mockRejectedValue(new Error('Test error'));

      const errorPromise = new Promise(resolve => 
        signalGenerator.once('requestFailed', resolve)
      );

      await signalGenerator.generateSignals(mockRequest);

      const errorEvent = await errorPromise;
      expect(errorEvent).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should manage memory usage efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many signals
      for (let i = 0; i < 100; i++) {
        await signalGenerator.generateSignals({
          ...mockRequest,
          id: `memory-test-${i}`
        });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should clear old metrics', async () => {
      // Generate some metrics
      for (let i = 0; i < 10; i++) {
        await signalGenerator.generateSignals({
          ...mockRequest,
          id: `metrics-test-${i}`
        });
      }

      const initialMetrics = Object.keys((signalGenerator as any).performanceMetrics);
      
      // Clear metrics
      signalGenerator.clearMetrics();
      
      const clearedSnapshot = signalGenerator.getPerformanceSnapshot();
      expect(clearedSnapshot.totalConditions).toBe(0);
    });
  });
});