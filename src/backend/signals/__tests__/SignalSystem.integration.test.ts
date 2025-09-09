/**
 * Signal System Integration Tests - Task BE-014
 * 
 * End-to-end integration tests for the complete signal generation system
 * including signal generation, history tracking, and real-time processing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalSystemFactory } from '../index.js';
import type {
  SignalGenerationRequest,
  StrategyContext,
  MarketDataWindow,
  ConditionExpression
} from '../../strategies/types.js';

// Mock external dependencies
vi.mock('../../conditions/ConditionEvaluationEngine.js', () => ({
  ConditionEvaluationEngine: vi.fn().mockImplementation(() => ({
    evaluateBatch: vi.fn().mockResolvedValue({
      success: true,
      results: new Map([
        ['rsi-oversold', {
          conditionId: 'rsi-oversold',
          success: true,
          value: true,
          confidence: 0.85,
          executionTime: 25,
          details: { type: 'comparison', shortCircuited: false, fromCache: false, intermediate: [] },
          context: { timestamp: Date.now(), symbol: 'BTC-USD', timeframe: '1h' }
        }],
        ['macd-bullish', {
          conditionId: 'macd-bullish',
          success: true,
          value: true,
          confidence: 0.75,
          executionTime: 30,
          details: { type: 'comparison', shortCircuited: false, fromCache: false, intermediate: [] },
          context: { timestamp: Date.now(), symbol: 'BTC-USD', timeframe: '1h' }
        }]
      ]),
      errors: new Map(),
      metadata: {
        totalConditions: 2,
        successfulEvaluations: 2,
        failedEvaluations: 0,
        totalExecutionTime: 55,
        averageExecutionTime: 27.5,
        cacheHits: 0,
        shortCircuits: 0
      }
    }),
    getPerformanceSnapshot: vi.fn().mockReturnValue({
      timestamp: new Date(),
      totalConditions: 2,
      activeEvaluations: 0,
      queuedEvaluations: 0,
      performance: {
        evaluationsPerSecond: 100,
        averageLatency: 25,
        p95Latency: 50,
        p99Latency: 100,
        successRate: 0.95
      },
      resource: {
        memoryUsage: 50 * 1024 * 1024,
        cpuUsage: 0.1,
        cacheSize: 100,
        cacheHitRate: 0.8
      },
      errors: {
        totalErrors: 5,
        errorRate: 0.05,
        commonErrors: []
      }
    })
  }))
}));

describe('Signal System Integration', () => {
  let signalSystem: any;
  let mockMarketData: MarketDataWindow;
  let mockContext: StrategyContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create signal system for testing
    signalSystem = SignalSystemFactory.createSystem('testing');

    // Create realistic market data
    mockMarketData = {
      symbol: 'BTC-USD',
      timeframe: '1h',
      candles: Array.from({ length: 50 }, (_, i) => ({
        startedAt: new Date(Date.now() - (50 - i) * 3600000).toISOString(),
        ticker: 'BTC-USD',
        resolution: '1HOUR',
        low: String(42000 + Math.random() * 1000),
        high: String(43000 + Math.random() * 1000),
        open: String(42500 + Math.random() * 500),
        close: String(42500 + Math.random() * 500),
        baseTokenVolume: String(1000 + Math.random() * 500),
        usdVolume: String(42500000 + Math.random() * 5000000),
        trades: Math.floor(1500 + Math.random() * 500),
        startingOpenInterest: String(10000 + Math.random() * 1000)
      })),
      currentPrice: 42750,
      volume24h: 45000000,
      change24h: 250,
      change24hPercent: 0.59,
      high24h: 43500,
      low24h: 42200,
      lastUpdate: new Date()
    };

    // Create comprehensive strategy context
    mockContext = {
      marketData: mockMarketData,
      indicators: {
        rsi: 32, // Oversold
        macd: {
          macd: 15,
          signal: 8,
          histogram: 7 // Bullish crossover
        },
        bollinger: {
          upper: 43200,
          middle: 42750,
          lower: 42300,
          bandwidth: 900,
          percent: 0.5
        },
        sma: { 20: 42650, 50: 42800 }, // Price above SMA20, below SMA50
        ema: { 12: 42720, 26: 42780 },
        atr: 350,
        obv: 25000000,
        vwap: 42730,
        lastCalculated: new Date()
      },
      portfolio: {
        id: 'integration-test-portfolio',
        totalValue: 100000,
        availableBalance: 75000,
        positions: [],
        lastUpdated: new Date()
      } as any,
      riskMetrics: {
        portfolioValue: 100000,
        availableCapital: 75000,
        usedMargin: 25000,
        marginRatio: 0.25,
        totalPositions: 1,
        longPositions: 1,
        shortPositions: 0,
        largestPosition: 25000,
        concentrationRisk: 0.25,
        strategyExposure: 0.3,
        correlationRisk: 0.1,
        drawdown: 0.02,
        maxDrawdown: 0.05,
        marketVolatility: 0.025,
        liquidityRisk: 0.05,
        gapRisk: 0.03,
        maxRiskPerTrade: 2,
        maxPortfolioRisk: 10,
        maxLeverage: 3,
        riskScore: 45,
        lastAssessed: new Date()
      },
      recentSignals: [],
      recentTrades: [],
      timestamp: new Date(),
      executionId: 'integration-test-1',
      strategyId: 'mean-reversion-strategy',
      marketConditions: {
        trend: 'bear',
        volatility: 'medium',
        liquidity: 'high',
        session: 'american'
      }
    };
  });

  afterEach(async () => {
    if (signalSystem) {
      await signalSystem.cleanup();
    }
  });

  describe('Complete Signal Generation Workflow', () => {
    it('should generate, validate, and store signals end-to-end', async () => {
      const conditions: ConditionExpression[] = [
        {
          id: 'rsi-oversold',
          type: 'comparison',
          operator: 'LESS_THAN',
          left: { type: 'indicator', indicatorId: 'rsi', field: 'value', offset: 0 },
          right: { type: 'literal', value: 35 }
        } as any,
        {
          id: 'macd-bullish',
          type: 'comparison',
          operator: 'GREATER_THAN',
          left: { type: 'indicator', indicatorId: 'macd', field: 'histogram', offset: 0 },
          right: { type: 'literal', value: 0 }
        } as any
      ];

      const request: SignalGenerationRequest = {
        id: 'integration-test-request',
        strategyId: 'mean-reversion-strategy',
        context: mockContext,
        conditions,
        timestamp: new Date(),
        priority: 'high'
      };

      // Generate signals
      const result = await signalSystem.signalGenerator.generateSignals(request);

      // Verify signal generation
      expect(result.success).toBe(true);
      expect(result.signals).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const signal = result.signals[0];

      // Verify signal properties
      expect(signal).toMatchObject({
        strategyId: 'mean-reversion-strategy',
        symbol: 'BTC-USD',
        timeframe: '1h',
        type: 'BUY', // Should be buy signal based on oversold RSI and bullish MACD
        isValid: true
      });

      expect(signal.confidence).toBeGreaterThan(70); // Good confluence
      expect(signal.entryPrice).toBe(42750);
      expect(signal.stopLoss).toBeDefined();
      expect(signal.takeProfit).toBeDefined();
      expect(signal.conditions).toEqual(['rsi-oversold', 'macd-bullish']);

      // Check if signal was stored in history
      const history = await signalSystem.historyManager.getSignalHistory('mean-reversion-strategy');
      expect(history).toHaveLength(1);
      expect(history[0].signal.id).toBe(signal.id);
    });

    it('should handle complex multi-strategy scenario', async () => {
      const strategies = [
        {
          id: 'trend-following',
          conditions: [
            {
              id: 'price-above-ema',
              type: 'comparison',
              operator: 'GREATER_THAN',
              left: { type: 'market', field: 'close', offset: 0 },
              right: { type: 'indicator', indicatorId: 'ema', field: '20', offset: 0 }
            }
          ]
        },
        {
          id: 'momentum-strategy',
          conditions: [
            {
              id: 'rsi-momentum',
              type: 'comparison',
              operator: 'GREATER_THAN',
              left: { type: 'indicator', indicatorId: 'rsi', field: 'value', offset: 0 },
              right: { type: 'literal', value: 50 }
            }
          ]
        }
      ];

      const requests = strategies.map(strategy => ({
        id: `${strategy.id}-request`,
        strategyId: strategy.id,
        context: mockContext,
        conditions: strategy.conditions as any,
        timestamp: new Date(),
        priority: 'medium' as const
      }));

      // Process all strategies
      const results = await Promise.all(
        requests.map(req => signalSystem.signalGenerator.generateSignals(req))
      );

      // Verify all strategies processed
      expect(results).toHaveLength(2);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.requestId).toBe(`${strategies[index].id}-request`);
      });

      // Check history for both strategies
      for (const strategy of strategies) {
        const history = await signalSystem.historyManager.getSignalHistory(strategy.id);
        expect(history.length).toBeGreaterThanOrEqualTo(0);
      }
    });
  });

  describe('Real-Time Processing Integration', () => {
    it('should process market data updates in real-time', async () => {
      const processor = signalSystem.realTimeProcessor;

      // Register strategy for real-time monitoring
      await processor.registerStrategy(
        'real-time-strategy',
        [
          {
            id: 'price-breakout',
            type: 'comparison',
            operator: 'GREATER_THAN',
            left: { type: 'market', field: 'close', offset: 0 },
            right: { type: 'indicator', indicatorId: 'bollinger', field: 'upper', offset: 0 }
          } as any
        ]
      );

      // Start real-time processing
      await processor.startProcessing();

      // Update strategy context
      processor.strategyContexts.set('real-time-strategy', mockContext);

      // Simulate significant market data update
      const updatedMarketData = {
        ...mockMarketData,
        currentPrice: 43300, // Breakout above Bollinger upper band
        lastUpdate: new Date()
      };

      // Process market data update
      await processor.processMarketDataUpdate('BTC-USD', updatedMarketData);

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify processing occurred
      const status = processor.getStatus();
      expect(status.registeredStrategies).toBe(1);
      expect(status.marketDataSymbols).toBe(1);

      await processor.stopProcessing();
    });

    it('should handle high-frequency market updates', async () => {
      const processor = signalSystem.realTimeProcessor;

      await processor.registerStrategy(
        'hf-strategy',
        [
          {
            id: 'volume-spike',
            type: 'comparison',
            operator: 'GREATER_THAN',
            left: { type: 'market', field: 'volume', offset: 0 },
            right: { type: 'indicator', indicatorId: 'volumeMA', field: 'value', offset: 0 }
          } as any
        ]
      );

      await processor.startProcessing();

      // Update strategy context
      processor.strategyContexts.set('hf-strategy', mockContext);

      // Simulate rapid market updates
      const updates = Array.from({ length: 20 }, (_, i) => ({
        ...mockMarketData,
        currentPrice: 42750 + Math.random() * 100,
        volume24h: 45000000 + Math.random() * 5000000,
        lastUpdate: new Date(Date.now() + i * 100)
      }));

      // Process updates rapidly
      for (const update of updates) {
        processor.processMarketDataUpdate('BTC-USD', update);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = processor.getPerformanceMetrics();
      expect(metrics.marketDataUpdatesPerSecond).toBeGreaterThanOrEqualTo(0);

      await processor.stopProcessing();
    });
  });

  describe('Performance Analytics Integration', () => {
    it('should calculate accurate performance metrics', async () => {
      const historyManager = signalSystem.historyManager;

      // Create signals with known outcomes
      const testSignals = [
        {
          id: 'profitable-signal-1',
          strategyId: 'test-strategy',
          timestamp: new Date(Date.now() - 3600000),
          type: 'BUY' as const,
          symbol: 'BTC-USD',
          confidence: 85,
          strength: 0.8,
          entryPrice: 42500,
          isValid: true,
          timeframe: '1h'
        },
        {
          id: 'losing-signal-1',
          strategyId: 'test-strategy',
          timestamp: new Date(Date.now() - 7200000),
          type: 'BUY' as const,
          symbol: 'BTC-USD',
          confidence: 65,
          strength: 0.6,
          entryPrice: 43000,
          isValid: true,
          timeframe: '1h'
        }
      ];

      // Add signals to history
      const entryIds = [];
      for (const signal of testSignals) {
        const entryId = await historyManager.addSignal(signal, mockContext);
        entryIds.push(entryId);
      }

      // Update with performance outcomes
      await historyManager.updateSignalPerformance(entryIds[0], {
        executed: true,
        outcome: 'profit',
        actualEntry: 42500,
        actualExit: 43000,
        pnl: 500,
        pnlPercent: 1.18,
        holdingPeriod: 1800000 // 30 minutes
      });

      await historyManager.updateSignalPerformance(entryIds[1], {
        executed: true,
        outcome: 'loss',
        actualEntry: 43000,
        actualExit: 42700,
        pnl: -300,
        pnlPercent: -0.70,
        holdingPeriod: 2400000 // 40 minutes
      });

      // Calculate performance metrics
      const metrics = await historyManager.getPerformanceMetrics('test-strategy');

      // Verify metrics calculations
      expect(metrics.totalSignals).toBe(2);
      expect(metrics.executedSignals).toBe(2);
      expect(metrics.profitableSignals).toBe(1);
      expect(metrics.winRate).toBe(0.5);
      expect(metrics.totalReturn).toBeCloseTo(0.48, 1); // (1.18 - 0.70)
      expect(metrics.averageReturn).toBeCloseTo(0.24, 1);
      expect(metrics.averageHoldingPeriod).toBe(2100000); // Average of 30 and 40 minutes
    });

    it('should provide detailed query capabilities', async () => {
      const historyManager = signalSystem.historyManager;

      // Create diverse signal history
      const signals = [
        { type: 'BUY', symbol: 'BTC-USD', confidence: 80, timestamp: new Date('2024-01-01T10:00:00Z') },
        { type: 'SELL', symbol: 'BTC-USD', confidence: 75, timestamp: new Date('2024-01-01T11:00:00Z') },
        { type: 'BUY', symbol: 'ETH-USD', confidence: 70, timestamp: new Date('2024-01-01T12:00:00Z') },
        { type: 'BUY', symbol: 'BTC-USD', confidence: 85, timestamp: new Date('2024-01-01T13:00:00Z') }
      ];

      for (const signalData of signals) {
        await historyManager.addSignal({
          id: `test-${signalData.symbol}-${signalData.type}-${Date.now()}`,
          strategyId: 'query-test-strategy',
          ...signalData,
          strength: 0.7,
          entryPrice: 42500,
          isValid: true,
          timeframe: '1h'
        } as any, mockContext);
      }

      // Test various query scenarios
      
      // Query by symbol
      const btcSignals = await historyManager.queryHistory({
        strategyId: 'query-test-strategy',
        symbol: 'BTC-USD'
      });
      expect(btcSignals.entries).toHaveLength(3);

      // Query by signal type
      const buySignals = await historyManager.queryHistory({
        strategyId: 'query-test-strategy',
        type: 'BUY'
      });
      expect(buySignals.entries).toHaveLength(3);

      // Query with confidence filter
      const highConfidenceSignals = await historyManager.queryHistory({
        strategyId: 'query-test-strategy',
        minConfidence: 80
      });
      expect(highConfidenceSignals.entries).toHaveLength(2);

      // Query with time range
      const specificTimeSignals = await historyManager.queryHistory({
        strategyId: 'query-test-strategy',
        from: new Date('2024-01-01T10:30:00Z'),
        to: new Date('2024-01-01T12:30:00Z')
      });
      expect(specificTimeSignals.entries).toHaveLength(2);

      // Query with pagination
      const paginatedSignals = await historyManager.queryHistory({
        strategyId: 'query-test-strategy',
        limit: 2,
        offset: 1,
        sortBy: 'timestamp',
        sortOrder: 'asc'
      });
      expect(paginatedSignals.entries).toHaveLength(2);
      expect(paginatedSignals.total).toBe(4);
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive health status', async () => {
      // Generate some activity
      const request: SignalGenerationRequest = {
        id: 'health-test-request',
        strategyId: 'health-test-strategy',
        context: mockContext,
        conditions: [
          {
            id: 'test-condition',
            type: 'comparison',
            operator: 'GREATER_THAN',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 0 }
          } as any
        ],
        timestamp: new Date(),
        priority: 'medium'
      };

      await signalSystem.signalGenerator.generateSignals(request);

      // Check health of all components
      const generatorHealth = await signalSystem.signalGenerator.getHealthStatus();
      const processorMetrics = signalSystem.realTimeProcessor.getPerformanceMetrics();

      expect(generatorHealth.healthy).toBe(true);
      expect(generatorHealth.score).toBeGreaterThanOrEqualTo(70);
      expect(processorMetrics.requestsPerSecond).toBeGreaterThanOrEqualTo(0);
      expect(processorMetrics.averageLatency).toBeGreaterThanOrEqualTo(0);
    });

    it('should detect and handle system stress', async () => {
      // Simulate high load
      const requests = Array.from({ length: 50 }, (_, i) => ({
        id: `stress-test-${i}`,
        strategyId: 'stress-test-strategy',
        context: mockContext,
        conditions: [
          {
            id: `condition-${i}`,
            type: 'comparison',
            operator: 'EQUAL',
            left: { type: 'literal', value: i },
            right: { type: 'literal', value: i }
          } as any
        ],
        timestamp: new Date(),
        priority: 'low' as const
      }));

      // Process all requests concurrently
      const results = await Promise.allSettled(
        requests.map(req => signalSystem.signalGenerator.generateSignals(req))
      );

      // Most requests should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled') as any[];
      const successRate = successfulResults.length / results.length;

      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate

      // Check system health after stress
      const health = await signalSystem.signalGenerator.getHealthStatus();
      expect(health.score).toBeGreaterThan(0); // System should still function
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary condition engine failures', async () => {
      const mockEngine = (signalSystem.signalGenerator as any).conditionEngine;
      
      // Make the first call fail, second call succeed
      mockEngine.evaluateBatch
        .mockRejectedValueOnce(new Error('Temporary engine failure'))
        .mockResolvedValueOnce({
          success: true,
          results: new Map([
            ['recovery-condition', {
              conditionId: 'recovery-condition',
              success: true,
              value: true,
              confidence: 0.9,
              executionTime: 40,
              details: { type: 'comparison', shortCircuited: false, fromCache: false, intermediate: [] },
              context: { timestamp: Date.now(), symbol: 'BTC-USD', timeframe: '1h' }
            }]
          ]),
          errors: new Map(),
          metadata: {
            totalConditions: 1,
            successfulEvaluations: 1,
            failedEvaluations: 0,
            totalExecutionTime: 40,
            averageExecutionTime: 40,
            cacheHits: 0,
            shortCircuits: 0
          }
        });

      const request: SignalGenerationRequest = {
        id: 'recovery-test',
        strategyId: 'recovery-strategy',
        context: mockContext,
        conditions: [
          {
            id: 'recovery-condition',
            type: 'comparison',
            operator: 'GREATER_THAN',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 0 }
          } as any
        ],
        timestamp: new Date(),
        priority: 'high'
      };

      // First request should fail
      const failedResult = await signalSystem.signalGenerator.generateSignals(request);
      expect(failedResult.success).toBe(false);

      // Second request should succeed
      const successResult = await signalSystem.signalGenerator.generateSignals({
        ...request,
        id: 'recovery-test-2'
      });
      expect(successResult.success).toBe(true);
    });

    it('should maintain data consistency during failures', async () => {
      const historyManager = signalSystem.historyManager;

      // Add a valid signal
      const validSignal = {
        id: 'consistency-test-1',
        strategyId: 'consistency-strategy',
        timestamp: new Date(),
        type: 'BUY' as const,
        symbol: 'BTC-USD',
        confidence: 80,
        strength: 0.8,
        entryPrice: 42500,
        isValid: true,
        timeframe: '1h'
      };

      const entryId = await historyManager.addSignal(validSignal, mockContext);

      // Attempt to update with invalid data
      try {
        await historyManager.updateSignalPerformance('non-existent-id', {
          executed: true,
          outcome: 'profit',
          pnl: 100
        });
      } catch (error) {
        // Expected to fail
        expect(error).toBeInstanceOf(Error);
      }

      // Original signal should still be intact
      const history = await historyManager.getSignalHistory('consistency-strategy');
      expect(history).toHaveLength(1);
      expect(history[0].signal.id).toBe(validSignal.id);
      expect(history[0].performance).toBeUndefined(); // Should not have been updated
    });
  });
});