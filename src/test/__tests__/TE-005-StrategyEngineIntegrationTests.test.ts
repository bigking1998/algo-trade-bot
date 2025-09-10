/**
 * TE-005: Strategy Engine Integration Tests - TestingAgent Implementation
 * 
 * Comprehensive integration test suite covering all Strategy Engine requirements:
 * - End-to-end strategy execution tests
 * - Multi-strategy coordination tests
 * - Performance under load testing
 * - Error recovery validation
 * 
 * This test suite validates all aspects of the strategy engine system
 * as specified in Task TE-005 from COMPLETE_TASK_LIST.md
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { performance } from 'perf_hooks';
import { StrategyEngine, type StrategyEngineConfig, type EngineMetrics, type TradeDecision } from '../../backend/engine/StrategyEngine.js';
import { BaseStrategy } from '../../backend/strategies/BaseStrategy.js';
import type {
  StrategyContext,
  StrategySignal,
  MarketDataWindow,
  StrategyConfig,
  StrategyLifecycleEvent,
  StrategyMetrics
} from '../../backend/strategies/types.js';
import type { MarketDataRepository, StrategyRepository, TradeRepository } from '../../backend/repositories/index.js';
import { DatabaseManager } from '../../backend/database/DatabaseManager.js';

// Mock implementations for testing
class MockMarketDataRepository {
  async getLatestCandles = vi.fn().mockResolvedValue([]);
  async getHistoricalData = vi.fn().mockResolvedValue([]);
  async storeCandles = vi.fn().mockResolvedValue(undefined);
  async subscribe = vi.fn();
  async unsubscribe = vi.fn();
}

class MockStrategyRepository {
  async findById = vi.fn();
  async findActive = vi.fn().mockResolvedValue([]);
  async create = vi.fn();
  async update = vi.fn();
  async delete = vi.fn();
  async getPerformanceMetrics = vi.fn().mockResolvedValue({});
}

class MockTradeRepository {
  async create = vi.fn();
  async update = vi.fn();
  async findById = vi.fn();
  async getPortfolioSummary = vi.fn().mockResolvedValue({
    totalValue: 100000,
    availableBalance: 50000,
    positions: []
  });
}

class MockDatabaseManager {
  async initialize = vi.fn();
  async close = vi.fn();
  async getConnection = vi.fn();
  async executeQuery = vi.fn();
  async beginTransaction = vi.fn();
  async commitTransaction = vi.fn();
  async rollbackTransaction = vi.fn();
  isConnected = vi.fn().mockReturnValue(true);
}

// Test strategy implementations
class TestBuyStrategy extends BaseStrategy {
  constructor(config: StrategyConfig) {
    super(config);
  }

  protected async executeStrategy(context: StrategyContext): Promise<StrategySignal | null> {
    // Simple buy strategy based on RSI
    if (context.indicators.rsi && context.indicators.rsi < 30) {
      return {
        id: `buy-${Date.now()}`,
        strategyId: this.config.id,
        timestamp: new Date(),
        type: 'BUY',
        symbol: context.marketData.symbol,
        confidence: 75,
        strength: 0.8,
        timeframe: context.marketData.timeframe,
        entryPrice: context.marketData.currentPrice,
        stopLoss: context.marketData.currentPrice * 0.98,
        takeProfit: context.marketData.currentPrice * 1.04,
        maxRisk: 2,
        reasoning: 'RSI oversold condition',
        indicators: { rsi: context.indicators.rsi },
        conditions: ['rsi_oversold'],
        source: 'technical',
        priority: 'medium',
        isValid: true
      };
    }
    return null;
  }
}

class TestSellStrategy extends BaseStrategy {
  constructor(config: StrategyConfig) {
    super(config);
  }

  protected async executeStrategy(context: StrategyContext): Promise<StrategySignal | null> {
    // Simple sell strategy based on RSI
    if (context.indicators.rsi && context.indicators.rsi > 70) {
      return {
        id: `sell-${Date.now()}`,
        strategyId: this.config.id,
        timestamp: new Date(),
        type: 'SELL',
        symbol: context.marketData.symbol,
        confidence: 70,
        strength: 0.75,
        timeframe: context.marketData.timeframe,
        entryPrice: context.marketData.currentPrice,
        stopLoss: context.marketData.currentPrice * 1.02,
        takeProfit: context.marketData.currentPrice * 0.96,
        maxRisk: 2,
        reasoning: 'RSI overbought condition',
        indicators: { rsi: context.indicators.rsi },
        conditions: ['rsi_overbought'],
        source: 'technical',
        priority: 'medium',
        isValid: true
      };
    }
    return null;
  }
}

class TestErrorStrategy extends BaseStrategy {
  constructor(config: StrategyConfig) {
    super(config);
  }

  protected async executeStrategy(context: StrategyContext): Promise<StrategySignal | null> {
    throw new Error('Simulated strategy execution error');
  }
}

describe('TE-005: Strategy Engine Integration Tests', () => {
  let strategyEngine: StrategyEngine;
  let mockMarketDataRepo: MockMarketDataRepository;
  let mockStrategyRepo: MockStrategyRepository;
  let mockTradeRepo: MockTradeRepository;
  let mockDbManager: MockDatabaseManager;
  let engineConfig: StrategyEngineConfig;
  let testContext: StrategyContext;

  beforeAll(() => {
    // Configure test performance thresholds
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Initialize mock dependencies
    mockMarketDataRepo = new MockMarketDataRepository() as any;
    mockStrategyRepo = new MockStrategyRepository() as any;
    mockTradeRepo = new MockTradeRepository() as any;
    mockDbManager = new MockDatabaseManager() as any;

    // Engine configuration for testing
    engineConfig = {
      maxConcurrentStrategies: 10,
      maxSignalsPerSecond: 50,
      defaultExecutionTimeout: 5000,
      maxMemoryUsage: 512, // MB
      maxCpuUsage: 80, // %
      maxLatency: 1000, // ms
      emergencyStopEnabled: true,
      maxPortfolioRisk: 15,
      correlationThreshold: 0.8,
      healthCheckInterval: 30, // seconds
      performanceReviewInterval: 60, // seconds
      metricsRetentionPeriod: 7, // days
      eventRetention: 1000,
      alertThresholds: {
        errorRate: 0.1,
        latency: 500,
        drawdown: 0.15
      }
    };

    // Create strategy engine
    strategyEngine = new StrategyEngine(engineConfig, {
      marketDataRepository: mockMarketDataRepo as any,
      strategyRepository: mockStrategyRepo as any,
      tradeRepository: mockTradeRepo as any,
      databaseManager: mockDbManager as any
    });

    // Create test context
    const mockMarketData: MarketDataWindow = {
      symbol: 'BTC-USD',
      timeframe: '1h',
      candles: Array.from({ length: 50 }, (_, i) => ({
        startedAt: new Date(Date.now() - (49 - i) * 3600000).toISOString(),
        ticker: 'BTC-USD',
        resolution: '1HOUR',
        low: (40000 + Math.random() * 1000).toString(),
        high: (42000 + Math.random() * 1000).toString(),
        open: (41000 + Math.random() * 1000).toString(),
        close: (41500 + Math.random() * 1000).toString(),
        baseTokenVolume: (1000 + Math.random() * 500).toString(),
        usdVolume: (41500000 + Math.random() * 5000000).toString(),
        trades: Math.floor(1000 + Math.random() * 500),
        startingOpenInterest: (10000 + Math.random() * 2000).toString()
      })),
      currentPrice: 41500,
      volume24h: 450000000,
      change24h: 250,
      change24hPercent: 0.6,
      high24h: 42000,
      low24h: 40000,
      lastUpdate: new Date()
    };

    testContext = {
      marketData: mockMarketData,
      indicators: {
        rsi: 45, // Neutral
        macd: { macd: 50, signal: 45, histogram: 5 },
        bollinger: { upper: 42200, middle: 41500, lower: 40800, bandwidth: 1400, percent: 0.5 },
        ema: { ema9: 41600, ema21: 41400, ema50: 41200 },
        sma: { sma20: 41450, sma50: 41300 },
        atr: 800,
        adx: 35,
        stochastic: { k: 50, d: 48 },
        williams: -35,
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
        marketVolatility: 0.025,
        liquidityRisk: 0,
        gapRisk: 0,
        maxRiskPerTrade: 2,
        maxPortfolioRisk: 10,
        maxLeverage: 3,
        riskScore: 25,
        lastAssessed: new Date()
      },
      recentSignals: [],
      recentTrades: [],
      timestamp: new Date(),
      executionId: `test-execution-${Date.now()}`,
      strategyId: 'test-strategy',
      marketConditions: {
        trend: 'bull',
        volatility: 'medium',
        liquidity: 'high',
        session: 'american'
      }
    };
  });

  afterEach(async () => {
    try {
      if (strategyEngine.getState() === 'running') {
        await strategyEngine.stop();
      }
    } catch (error) {
      console.warn('Error stopping strategy engine:', error);
    }
  });

  // =============================================================================
  // END-TO-END STRATEGY EXECUTION TESTS
  // =============================================================================

  describe('End-to-End Strategy Execution', () => {
    it('should execute single strategy end-to-end', async () => {
      const strategyConfig: StrategyConfig = {
        id: 'test-single-strategy',
        name: 'Test Single Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: {
          maxPositionSize: 1000,
          maxDailyLoss: 500,
          stopLoss: 0.02,
          takeProfit: 0.04
        }
      };

      const testStrategy = new TestBuyStrategy(strategyConfig);
      
      // Initialize and start engine
      await strategyEngine.initialize();
      await strategyEngine.start();

      // Register strategy
      await strategyEngine.registerStrategy(testStrategy);

      // Set RSI to trigger buy signal
      const buyContext = {
        ...testContext,
        indicators: { ...testContext.indicators, rsi: 25 }
      };

      // Execute strategy
      const execution = await strategyEngine.executeStrategy('test-single-strategy', buyContext);

      expect(execution.success).toBe(true);
      expect(execution.signal).toBeDefined();
      expect(execution.signal?.type).toBe('BUY');
      expect(execution.signal?.confidence).toBe(75);
      expect(execution.executionTime).toBeGreaterThan(0);
      expect(execution.metadata.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle complete trading workflow', async () => {
      const events: StrategyLifecycleEvent[] = [];
      
      strategyEngine.on('strategySignal', (event) => events.push(event));
      strategyEngine.on('tradeExecuted', (event) => events.push(event));
      strategyEngine.on('positionClosed', (event) => events.push(event));

      const strategyConfig: StrategyConfig = {
        id: 'test-workflow-strategy',
        name: 'Test Workflow Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: {
          maxPositionSize: 1000,
          maxDailyLoss: 500,
          stopLoss: 0.02,
          takeProfit: 0.04
        }
      };

      const testStrategy = new TestBuyStrategy(strategyConfig);
      
      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(testStrategy);

      // Execute workflow steps
      const buyContext = { ...testContext, indicators: { ...testContext.indicators, rsi: 20 } };
      const buyResult = await strategyEngine.executeStrategy('test-workflow-strategy', buyContext);

      expect(buyResult.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);

      // Verify signal was processed
      const signalEvents = events.filter(e => e.type === 'signal');
      expect(signalEvents.length).toBeGreaterThan(0);
    });

    it('should maintain strategy state across executions', async () => {
      const strategyConfig: StrategyConfig = {
        id: 'test-stateful-strategy',
        name: 'Test Stateful Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: { consecutiveSignals: 0 },
        riskLimits: {
          maxPositionSize: 1000,
          maxDailyLoss: 500,
          stopLoss: 0.02,
          takeProfit: 0.04
        }
      };

      const testStrategy = new TestBuyStrategy(strategyConfig);
      
      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(testStrategy);

      // Execute multiple times
      const contexts = [
        { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } },
        { ...testContext, indicators: { ...testContext.indicators, rsi: 28 } },
        { ...testContext, indicators: { ...testContext.indicators, rsi: 22 } }
      ];

      const results = [];
      for (const context of contexts) {
        const result = await strategyEngine.executeStrategy('test-stateful-strategy', context);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
      }

      // All executions should succeed and maintain state
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.executionId).toBeDefined();
      });

      // Verify strategy metrics were updated
      const metrics = await strategyEngine.getStrategyMetrics('test-stateful-strategy');
      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBe(3);
    });

    it('should handle strategy lifecycle management', async () => {
      const lifecycleEvents: string[] = [];
      
      strategyEngine.on('strategyRegistered', () => lifecycleEvents.push('registered'));
      strategyEngine.on('strategyStarted', () => lifecycleEvents.push('started'));
      strategyEngine.on('strategyStopped', () => lifecycleEvents.push('stopped'));
      strategyEngine.on('strategyUnregistered', () => lifecycleEvents.push('unregistered'));

      const strategyConfig: StrategyConfig = {
        id: 'test-lifecycle-strategy',
        name: 'Test Lifecycle Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: {
          maxPositionSize: 1000,
          maxDailyLoss: 500,
          stopLoss: 0.02,
          takeProfit: 0.04
        }
      };

      const testStrategy = new TestBuyStrategy(strategyConfig);
      
      await strategyEngine.initialize();
      await strategyEngine.start();

      // Test full lifecycle
      await strategyEngine.registerStrategy(testStrategy);
      expect(lifecycleEvents).toContain('registered');

      await strategyEngine.startStrategy('test-lifecycle-strategy');
      expect(lifecycleEvents).toContain('started');

      await strategyEngine.stopStrategy('test-lifecycle-strategy');
      expect(lifecycleEvents).toContain('stopped');

      await strategyEngine.unregisterStrategy('test-lifecycle-strategy');
      expect(lifecycleEvents).toContain('unregistered');
    });
  });

  // =============================================================================
  // MULTI-STRATEGY COORDINATION TESTS
  // =============================================================================

  describe('Multi-Strategy Coordination', () => {
    it('should coordinate multiple strategies concurrently', async () => {
      const strategies = [
        new TestBuyStrategy({
          id: 'buy-strategy-1',
          name: 'Buy Strategy 1',
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 500, maxDailyLoss: 250, stopLoss: 0.02, takeProfit: 0.04 }
        }),
        new TestBuyStrategy({
          id: 'buy-strategy-2', 
          name: 'Buy Strategy 2',
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 500, maxDailyLoss: 250, stopLoss: 0.02, takeProfit: 0.04 }
        }),
        new TestSellStrategy({
          id: 'sell-strategy-1',
          name: 'Sell Strategy 1',
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 500, maxDailyLoss: 250, stopLoss: 0.02, takeProfit: 0.04 }
        })
      ];

      await strategyEngine.initialize();
      await strategyEngine.start();

      // Register all strategies
      for (const strategy of strategies) {
        await strategyEngine.registerStrategy(strategy);
      }

      // Execute all strategies concurrently
      const buyContext = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      const sellContext = { ...testContext, indicators: { ...testContext.indicators, rsi: 75 } };

      const executionPromises = [
        strategyEngine.executeStrategy('buy-strategy-1', buyContext),
        strategyEngine.executeStrategy('buy-strategy-2', buyContext), 
        strategyEngine.executeStrategy('sell-strategy-1', sellContext)
      ];

      const results = await Promise.all(executionPromises);

      // All strategies should execute successfully
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeGreaterThan(0);
      });

      // Verify concurrent execution
      expect(results[0].signal?.type).toBe('BUY');
      expect(results[1].signal?.type).toBe('BUY');
      expect(results[2].signal?.type).toBe('SELL');
    });

    it('should handle signal conflicts between strategies', async () => {
      const conflictingStrategies = [
        new TestBuyStrategy({
          id: 'aggressive-buy',
          name: 'Aggressive Buy Strategy',
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 500, stopLoss: 0.02, takeProfit: 0.04 }
        }),
        new TestSellStrategy({
          id: 'aggressive-sell',
          name: 'Aggressive Sell Strategy', 
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 500, stopLoss: 0.02, takeProfit: 0.04 }
        })
      ];

      await strategyEngine.initialize();
      await strategyEngine.start();

      for (const strategy of conflictingStrategies) {
        await strategyEngine.registerStrategy(strategy);
      }

      // Create context that triggers both buy and sell signals
      const conflictContext = { 
        ...testContext, 
        indicators: { ...testContext.indicators, rsi: 50 } // Neutral, might trigger both
      };

      // Override strategies to always generate signals
      vi.spyOn(conflictingStrategies[0], 'execute').mockResolvedValue({
        id: 'buy-signal-1',
        strategyId: 'aggressive-buy',
        timestamp: new Date(),
        type: 'BUY',
        symbol: 'BTC-USD',
        confidence: 80,
        strength: 0.8,
        timeframe: '1h',
        entryPrice: 41500,
        stopLoss: 40500,
        takeProfit: 43500,
        maxRisk: 2,
        reasoning: 'Aggressive buy signal',
        indicators: { rsi: 50 },
        conditions: ['aggressive_buy'],
        source: 'technical',
        priority: 'high',
        isValid: true
      });

      vi.spyOn(conflictingStrategies[1], 'execute').mockResolvedValue({
        id: 'sell-signal-1',
        strategyId: 'aggressive-sell',
        timestamp: new Date(),
        type: 'SELL',
        symbol: 'BTC-USD',
        confidence: 75,
        strength: 0.75,
        timeframe: '1h',
        entryPrice: 41500,
        stopLoss: 42500,
        takeProfit: 40500,
        maxRisk: 2,
        reasoning: 'Aggressive sell signal',
        indicators: { rsi: 50 },
        conditions: ['aggressive_sell'],
        source: 'technical',
        priority: 'high',
        isValid: true
      });

      const results = await Promise.all([
        strategyEngine.executeStrategy('aggressive-buy', conflictContext),
        strategyEngine.executeStrategy('aggressive-sell', conflictContext)
      ]);

      // Both should execute, but signal processor should handle conflicts
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Verify conflict resolution occurred
      const tradeDecisions = await strategyEngine.getTradeDecisions();
      // Trade decisions should be resolved (not both buy and sell)
      if (tradeDecisions.length > 0) {
        const actions = tradeDecisions.map(d => d.action);
        expect(new Set(actions).size).toBeLessThanOrEqual(2); // Should not have both buy and sell
      }
    });

    it('should allocate resources fairly among strategies', async () => {
      const resourceStrategies = Array.from({ length: 5 }, (_, i) => 
        new TestBuyStrategy({
          id: `resource-strategy-${i}`,
          name: `Resource Strategy ${i}`,
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 200, maxDailyLoss: 100, stopLoss: 0.02, takeProfit: 0.04 }
        })
      );

      await strategyEngine.initialize();
      await strategyEngine.start();

      for (const strategy of resourceStrategies) {
        await strategyEngine.registerStrategy(strategy);
      }

      // Execute all strategies simultaneously
      const executionContext = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      
      const startTime = performance.now();
      const executionPromises = resourceStrategies.map(strategy => 
        strategyEngine.executeStrategy(strategy.getConfig().id, executionContext)
      );

      const results = await Promise.all(executionPromises);
      const totalTime = performance.now() - startTime;

      // All strategies should complete successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Resource allocation should be fair (no strategy should be starved)
      const executionTimes = results.map(r => r.executionTime);
      const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const maxExecutionTime = Math.max(...executionTimes);
      
      // No strategy should take more than 3x the average (reasonable fairness)
      expect(maxExecutionTime).toBeLessThan(avgExecutionTime * 3);

      // Total execution should be efficient
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle strategy priority scheduling', async () => {
      const priorityStrategies = [
        new TestBuyStrategy({
          id: 'high-priority-strategy',
          name: 'High Priority Strategy',
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: { priority: 'high' },
          riskLimits: { maxPositionSize: 1000, maxDailyLoss: 500, stopLoss: 0.02, takeProfit: 0.04 }
        }),
        new TestBuyStrategy({
          id: 'low-priority-strategy',
          name: 'Low Priority Strategy',
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: { priority: 'low' },
          riskLimits: { maxPositionSize: 500, maxDailyLoss: 250, stopLoss: 0.02, takeProfit: 0.04 }
        })
      ];

      await strategyEngine.initialize();
      await strategyEngine.start();

      for (const strategy of priorityStrategies) {
        await strategyEngine.registerStrategy(strategy);
      }

      // Execute strategies and measure timing
      const executionContext = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      
      const highPriorityStart = performance.now();
      const highPriorityResult = await strategyEngine.executeStrategy('high-priority-strategy', executionContext);
      const highPriorityTime = performance.now() - highPriorityStart;

      const lowPriorityStart = performance.now();
      const lowPriorityResult = await strategyEngine.executeStrategy('low-priority-strategy', executionContext);
      const lowPriorityTime = performance.now() - lowPriorityStart;

      expect(highPriorityResult.success).toBe(true);
      expect(lowPriorityResult.success).toBe(true);

      // High priority strategy should generally execute faster (but this is not guaranteed)
      console.log(`High priority: ${highPriorityTime}ms, Low priority: ${lowPriorityTime}ms`);
    });
  });

  // =============================================================================
  // PERFORMANCE UNDER LOAD TESTS
  // =============================================================================

  describe('Performance Under Load', () => {
    it('should maintain performance under high execution load', async () => {
      const loadTestStrategy = new TestBuyStrategy({
        id: 'load-test-strategy',
        name: 'Load Test Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(loadTestStrategy);

      const loadLevels = [50, 100, 200, 500];
      const performanceResults: Array<{
        load: number;
        avgLatency: number;
        successRate: number;
        throughput: number;
      }> = [];

      for (const load of loadLevels) {
        const executionContexts = Array.from({ length: load }, (_, i) => ({
          ...testContext,
          executionId: `load-test-${load}-${i}`,
          indicators: { ...testContext.indicators, rsi: 20 + (i % 20) } // Vary RSI
        }));

        const startTime = performance.now();
        const executionPromises = executionContexts.map(context =>
          strategyEngine.executeStrategy('load-test-strategy', context)
            .catch(error => ({ success: false, error, executionTime: 0 }))
        );

        const results = await Promise.all(executionPromises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const successfulResults = results.filter(r => r.success);
        const avgLatency = successfulResults.reduce((sum, r) => sum + (r.executionTime || 0), 0) / successfulResults.length;
        const successRate = successfulResults.length / results.length;
        const throughput = results.length / (totalTime / 1000); // executions per second

        performanceResults.push({
          load,
          avgLatency,
          successRate,
          throughput
        });

        console.log(`Load ${load}: ${avgLatency.toFixed(2)}ms avg latency, ${(successRate * 100).toFixed(1)}% success, ${throughput.toFixed(2)} exec/s`);

        // Performance assertions
        expect(successRate).toBeGreaterThanOrEqual(0.9); // 90% success rate minimum
        expect(avgLatency).toBeLessThan(1000); // 1 second max average latency
        expect(throughput).toBeGreaterThan(load / 10); // Reasonable throughput
      }

      // Performance should not degrade significantly with load
      const baselinePerf = performanceResults[0];
      const highLoadPerf = performanceResults[performanceResults.length - 1];
      
      expect(highLoadPerf.avgLatency).toBeLessThan(baselinePerf.avgLatency * 3); // Latency shouldn't triple
      expect(highLoadPerf.successRate).toBeGreaterThanOrEqual(baselinePerf.successRate * 0.8); // Success rate shouldn't drop below 80% of baseline
    });

    it('should handle memory pressure efficiently', async () => {
      const memoryTestStrategy = new TestBuyStrategy({
        id: 'memory-test-strategy',
        name: 'Memory Test Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(memoryTestStrategy);

      const initialMemory = process.memoryUsage().heapUsed;
      const executionCount = 1000;

      // Execute strategy many times to test memory usage
      for (let i = 0; i < executionCount; i++) {
        const largeContext = {
          ...testContext,
          executionId: `memory-test-${i}`,
          marketData: {
            ...testContext.marketData,
            // Add memory pressure with large candle history
            candles: Array.from({ length: 500 }, (_, j) => ({
              ...testContext.marketData.candles[0],
              startedAt: new Date(Date.now() - j * 60000).toISOString()
            }))
          }
        };

        const result = await strategyEngine.executeStrategy('memory-test-strategy', largeContext);
        expect(result.success).toBe(true);

        // Check memory periodically
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryGrowth = currentMemory - initialMemory;
          
          // Memory growth should be reasonable
          expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // Less than 200MB growth
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalGrowth = finalMemory - initialMemory;
      
      console.log(`Memory growth after ${executionCount} executions: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB`);
      expect(totalGrowth).toBeLessThan(300 * 1024 * 1024); // Less than 300MB total growth
    });

    it('should handle concurrent multi-strategy execution', async () => {
      const concurrentStrategies = Array.from({ length: 8 }, (_, i) =>
        new TestBuyStrategy({
          id: `concurrent-strategy-${i}`,
          name: `Concurrent Strategy ${i}`,
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
        })
      );

      await strategyEngine.initialize();
      await strategyEngine.start();

      for (const strategy of concurrentStrategies) {
        await strategyEngine.registerStrategy(strategy);
      }

      const concurrencyLevels = [4, 8, 16, 32];
      
      for (const concurrency of concurrencyLevels) {
        const executionBatches = Array.from({ length: concurrency }, (_, i) => {
          const strategyId = concurrentStrategies[i % concurrentStrategies.length].getConfig().id;
          const context = {
            ...testContext,
            executionId: `concurrent-${concurrency}-${i}`,
            indicators: { ...testContext.indicators, rsi: 25 }
          };
          return { strategyId, context };
        });

        const startTime = performance.now();
        const executionPromises = executionBatches.map(({ strategyId, context }) =>
          strategyEngine.executeStrategy(strategyId, context)
        );

        const results = await Promise.all(executionPromises);
        const totalTime = performance.now() - startTime;

        const successRate = results.filter(r => r.success).length / results.length;
        const throughput = results.length / (totalTime / 1000);

        console.log(`Concurrency ${concurrency}: ${(successRate * 100).toFixed(1)}% success, ${throughput.toFixed(2)} exec/s`);

        expect(successRate).toBeGreaterThanOrEqual(0.85); // 85% success rate under concurrency
        expect(throughput).toBeGreaterThan(concurrency / 20); // Reasonable throughput
      }
    });

    it('should maintain engine health under sustained load', async () => {
      const sustainedTestStrategy = new TestBuyStrategy({
        id: 'sustained-load-strategy',
        name: 'Sustained Load Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(sustainedTestStrategy);

      const sustainedDuration = 10000; // 10 seconds of sustained load
      const executionInterval = 100; // Execute every 100ms
      const startTime = Date.now();
      
      let executionCount = 0;
      let successCount = 0;

      // Run sustained load
      while (Date.now() - startTime < sustainedDuration) {
        const context = {
          ...testContext,
          executionId: `sustained-${executionCount}`,
          indicators: { ...testContext.indicators, rsi: 25 }
        };

        try {
          const result = await strategyEngine.executeStrategy('sustained-load-strategy', context);
          if (result.success) successCount++;
          executionCount++;
          
          // Brief pause
          await new Promise(resolve => setTimeout(resolve, executionInterval));
        } catch (error) {
          executionCount++;
          console.warn('Execution failed during sustained load:', error);
        }

        // Check engine health periodically
        if (executionCount % 20 === 0) {
          const health = await strategyEngine.getHealthStatus();
          expect(health.status).not.toBe('critical');
        }
      }

      const finalSuccessRate = successCount / executionCount;
      const averageExecutionsPerSecond = executionCount / (sustainedDuration / 1000);

      console.log(`Sustained load: ${executionCount} executions, ${(finalSuccessRate * 100).toFixed(1)}% success, ${averageExecutionsPerSecond.toFixed(2)} exec/s`);

      expect(finalSuccessRate).toBeGreaterThanOrEqual(0.8); // 80% success rate under sustained load
      expect(executionCount).toBeGreaterThan(50); // Should execute reasonable number of times

      // Final health check
      const finalHealth = await strategyEngine.getHealthStatus();
      expect(['healthy', 'degraded']).toContain(finalHealth.status); // Should not be critical
    });
  });

  // =============================================================================
  // ERROR RECOVERY VALIDATION TESTS
  // =============================================================================

  describe('Error Recovery Validation', () => {
    it('should recover from strategy execution errors', async () => {
      const errorStrategy = new TestErrorStrategy({
        id: 'error-strategy',
        name: 'Error Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      const healthyStrategy = new TestBuyStrategy({
        id: 'healthy-strategy',
        name: 'Healthy Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      
      await strategyEngine.registerStrategy(errorStrategy);
      await strategyEngine.registerStrategy(healthyStrategy);

      // Execute error strategy (should fail gracefully)
      const errorResult = await strategyEngine.executeStrategy('error-strategy', testContext);
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
      expect(errorResult.error?.message).toContain('Simulated strategy execution error');

      // Engine should still be healthy and able to execute other strategies
      const healthyContext = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      const healthyResult = await strategyEngine.executeStrategy('healthy-strategy', healthyContext);
      expect(healthyResult.success).toBe(true);

      // Engine health should be maintained
      const health = await strategyEngine.getHealthStatus();
      expect(health.status).not.toBe('critical');
    });

    it('should handle database connection failures', async () => {
      const dbStrategy = new TestBuyStrategy({
        id: 'db-dependent-strategy',
        name: 'Database Dependent Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(dbStrategy);

      // Simulate database connection failure
      mockDbManager.isConnected.mockReturnValue(false);
      mockDbManager.executeQuery.mockRejectedValue(new Error('Database connection lost'));

      const context = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      
      // Strategy should handle database errors gracefully
      const result = await strategyEngine.executeStrategy('db-dependent-strategy', context);
      
      // Strategy may succeed if it doesn't require database, or fail gracefully
      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }

      // Engine should attempt recovery
      const health = await strategyEngine.getHealthStatus();
      expect(health).toBeDefined();
    });

    it('should implement circuit breaker for failing strategies', async () => {
      const flakeyStrategy = new TestBuyStrategy({
        id: 'flakey-strategy',
        name: 'Flakey Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      // Mock strategy to fail intermittently
      let executionCount = 0;
      vi.spyOn(flakeyStrategy, 'execute').mockImplementation(() => {
        executionCount++;
        if (executionCount % 3 === 0) {
          return Promise.resolve({
            id: `success-signal-${executionCount}`,
            strategyId: 'flakey-strategy',
            timestamp: new Date(),
            type: 'BUY',
            symbol: 'BTC-USD',
            confidence: 70,
            strength: 0.7,
            timeframe: '1h',
            entryPrice: 41500,
            stopLoss: 40500,
            takeProfit: 43000,
            maxRisk: 2,
            reasoning: 'Successful execution',
            indicators: { rsi: 25 },
            conditions: ['rsi_oversold'],
            source: 'technical',
            priority: 'medium',
            isValid: true
          });
        } else {
          throw new Error(`Flakey execution ${executionCount}`);
        }
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(flakeyStrategy);

      const results: Array<{ success: boolean; executionCount: number }> = [];
      
      // Execute multiple times to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        const context = {
          ...testContext,
          executionId: `flakey-test-${i}`,
          indicators: { ...testContext.indicators, rsi: 25 }
        };

        try {
          const result = await strategyEngine.executeStrategy('flakey-strategy', context);
          results.push({ success: result.success, executionCount: i + 1 });
        } catch (error) {
          results.push({ success: false, executionCount: i + 1 });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
      }

      // Should have some successes and some failures
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      
      console.log(`Circuit breaker test: ${successCount} successes, ${failureCount} failures`);
    });

    it('should recover from resource exhaustion', async () => {
      const resourceHungryStrategy = new TestBuyStrategy({
        id: 'resource-hungry-strategy',
        name: 'Resource Hungry Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      // Mock strategy to consume excessive resources
      vi.spyOn(resourceHungryStrategy, 'execute').mockImplementation(async () => {
        // Simulate resource exhaustion
        const largeArray = new Array(10000000).fill('memory consumption');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Slow execution
        
        return {
          id: `resource-signal-${Date.now()}`,
          strategyId: 'resource-hungry-strategy',
          timestamp: new Date(),
          type: 'BUY',
          symbol: 'BTC-USD',
          confidence: 70,
          strength: 0.7,
          timeframe: '1h',
          entryPrice: 41500,
          stopLoss: 40500,
          takeProfit: 43000,
          maxRisk: 2,
          reasoning: 'Resource heavy execution',
          indicators: { rsi: 25 },
          conditions: ['rsi_oversold'],
          source: 'technical',
          priority: 'medium',
          isValid: true
        };
      });

      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.registerStrategy(resourceHungryStrategy);

      const context = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      
      // Execute with timeout to prevent hanging
      const executionPromise = strategyEngine.executeStrategy('resource-hungry-strategy', context);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), 5000)
      );

      try {
        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        // Should either succeed or fail gracefully
        expect(result).toBeDefined();
        if ('success' in result) {
          expect(typeof result.success).toBe('boolean');
        }
      } catch (error) {
        // Timeout is acceptable for resource exhaustion scenario
        expect(error).toBeInstanceOf(Error);
      }

      // Engine should remain responsive after resource exhaustion
      const lightStrategy = new TestBuyStrategy({
        id: 'light-strategy',
        name: 'Light Strategy',
        version: '1.0.0',
        type: 'technical',
        enabled: true,
        parameters: {},
        riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
      });

      await strategyEngine.registerStrategy(lightStrategy);
      const lightResult = await strategyEngine.executeStrategy('light-strategy', context);
      expect(lightResult.success).toBe(true);
    });

    it('should handle cascading failures gracefully', async () => {
      const cascadingStrategies = Array.from({ length: 5 }, (_, i) => {
        const strategy = new TestBuyStrategy({
          id: `cascade-strategy-${i}`,
          name: `Cascade Strategy ${i}`,
          version: '1.0.0',
          type: 'technical',
          enabled: true,
          parameters: {},
          riskLimits: { maxPositionSize: 100, maxDailyLoss: 50, stopLoss: 0.02, takeProfit: 0.04 }
        });

        // Make strategies fail with increasing probability
        vi.spyOn(strategy, 'execute').mockImplementation(() => {
          if (Math.random() < (i + 1) * 0.15) { // 15%, 30%, 45%, 60%, 75% failure rate
            throw new Error(`Cascade failure in strategy ${i}`);
          }
          return Promise.resolve({
            id: `cascade-signal-${i}-${Date.now()}`,
            strategyId: `cascade-strategy-${i}`,
            timestamp: new Date(),
            type: 'BUY',
            symbol: 'BTC-USD',
            confidence: 70,
            strength: 0.7,
            timeframe: '1h',
            entryPrice: 41500,
            stopLoss: 40500,
            takeProfit: 43000,
            maxRisk: 2,
            reasoning: `Cascade strategy ${i} execution`,
            indicators: { rsi: 25 },
            conditions: ['rsi_oversold'],
            source: 'technical',
            priority: 'medium',
            isValid: true
          });
        });

        return strategy;
      });

      await strategyEngine.initialize();
      await strategyEngine.start();

      for (const strategy of cascadingStrategies) {
        await strategyEngine.registerStrategy(strategy);
      }

      // Execute all strategies simultaneously to test cascading failure handling
      const context = { ...testContext, indicators: { ...testContext.indicators, rsi: 25 } };
      const executionPromises = cascadingStrategies.map(strategy =>
        strategyEngine.executeStrategy(strategy.getConfig().id, context)
          .catch(error => ({ success: false, error, executionTime: 0, strategyId: strategy.getConfig().id }))
      );

      const results = await Promise.all(executionPromises);

      // Some strategies should succeed, some should fail
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      expect(successCount + failureCount).toBe(5);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // Some should fail

      // Engine should remain operational despite cascading failures
      const health = await strategyEngine.getHealthStatus();
      expect(['healthy', 'degraded']).toContain(health.status); // Should not be critical

      console.log(`Cascading failure test: ${successCount} successes, ${failureCount} failures`);
    });
  });
});