/**
 * Strategy Framework Test Suite - Task TE-001
 * 
 * Comprehensive testing for strategy execution framework including:
 * - Strategy lifecycle management
 * - Signal generation and validation
 * - Strategy execution performance
 * - Multi-strategy coordination
 * - Error handling and recovery
 * - Configuration validation
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { TestingFramework } from '../TestingFramework';
import { MockDataGenerator } from '../MockDataGenerator';
import { BaseStrategy } from '@/backend/strategies/BaseStrategy';
import { StrategyEngine } from '@/backend/strategies/StrategyEngine';
import { StrategyConfiguration, ExecutionContext, Signal, StrategyState } from '@/shared/types/trading';

// Mock strategy implementations for testing
class TestTrendFollowingStrategy extends BaseStrategy {
  constructor(config: StrategyConfiguration) {
    super(config);
  }

  async execute(context: ExecutionContext): Promise<Signal | null> {
    const { marketData, indicators, portfolio } = context;
    
    if (!marketData || marketData.length < 2) {
      return null;
    }

    const currentPrice = marketData[marketData.length - 1].close;
    const previousPrice = marketData[marketData.length - 2].close;
    const priceChange = (currentPrice - previousPrice) / previousPrice;
    
    // Simple trend following logic
    if (priceChange > 0.001) { // 0.1% threshold
      return this.createSignal('buy', 0.7, 'Upward trend detected');
    } else if (priceChange < -0.001) {
      return this.createSignal('sell', 0.7, 'Downward trend detected');
    }
    
    return this.createSignal('hold', 0.5, 'No clear trend');
  }

  protected validateConfiguration(): void {
    if (!this.config.parameters.trendThreshold) {
      throw new Error('Missing required parameter: trendThreshold');
    }
  }
}

class TestMeanReversionStrategy extends BaseStrategy {
  constructor(config: StrategyConfiguration) {
    super(config);
  }

  async execute(context: ExecutionContext): Promise<Signal | null> {
    const { indicators } = context;
    
    if (!indicators || !indicators.rsi) {
      return null;
    }

    const rsi = indicators.rsi.value as number;
    
    // Mean reversion logic
    if (rsi > 70) {
      return this.createSignal('sell', 0.8, 'Overbought condition');
    } else if (rsi < 30) {
      return this.createSignal('buy', 0.8, 'Oversold condition');
    }
    
    return this.createSignal('hold', 0.3, 'Neutral RSI');
  }

  protected validateConfiguration(): void {
    const { overboughtLevel, oversoldLevel } = this.config.parameters;
    if (!overboughtLevel || !oversoldLevel) {
      throw new Error('Missing required RSI levels');
    }
  }
}

describe('Strategy Framework Tests', () => {
  let trendStrategy: TestTrendFollowingStrategy;
  let meanReversionStrategy: TestMeanReversionStrategy;
  let strategyEngine: StrategyEngine;
  let mockMarketData: any[];
  let mockIndicators: any;

  beforeAll(() => {
    // Initialize test data
    mockMarketData = MockDataGenerator.generateOHLCV({
      count: 100,
      basePrice: 100,
      trend: 'up',
      volatility: 0.02
    });

    mockIndicators = {
      sma20: { value: 102.5, isValid: true, timestamp: new Date() },
      ema12: { value: 103.2, isValid: true, timestamp: new Date() },
      rsi: { value: 65, isValid: true, timestamp: new Date() },
      macd: { 
        value: { macd: 0.5, signal: 0.3, histogram: 0.2 }, 
        isValid: true, 
        timestamp: new Date() 
      }
    };
  });

  beforeEach(() => {
    // Create fresh strategy instances for each test
    const trendConfig = MockDataGenerator.generateStrategy('trend_following');
    trendConfig.parameters = { trendThreshold: 0.001 };
    trendStrategy = new TestTrendFollowingStrategy(trendConfig);

    const meanReversionConfig = MockDataGenerator.generateStrategy('mean_reversion');
    meanReversionConfig.parameters = { overboughtLevel: 70, oversoldLevel: 30 };
    meanReversionStrategy = new TestMeanReversionStrategy(meanReversionConfig);

    strategyEngine = new StrategyEngine();
  });

  describe('Strategy Lifecycle Management', () => {
    test('should initialize strategy correctly', () => {
      expect(trendStrategy.getId()).toBeDefined();
      expect(trendStrategy.getName()).toBe('trend_following_strategy');
      expect(trendStrategy.getType()).toBe('trend_following');
      expect(trendStrategy.isEnabled()).toBe(true);
      expect(trendStrategy.getState()).toBe('initialized');
    });

    test('should validate configuration on initialization', () => {
      const invalidConfig = MockDataGenerator.generateStrategy('trend_following');
      delete invalidConfig.parameters.trendThreshold;

      expect(() => {
        new TestTrendFollowingStrategy(invalidConfig);
      }).toThrow('Missing required parameter: trendThreshold');
    });

    test('should start and stop strategy', async () => {
      expect(trendStrategy.getState()).toBe('initialized');
      
      await trendStrategy.start();
      expect(trendStrategy.getState()).toBe('running');
      
      await trendStrategy.stop();
      expect(trendStrategy.getState()).toBe('stopped');
    });

    test('should handle strategy pause and resume', async () => {
      await trendStrategy.start();
      expect(trendStrategy.getState()).toBe('running');
      
      await trendStrategy.pause();
      expect(trendStrategy.getState()).toBe('paused');
      
      await trendStrategy.resume();
      expect(trendStrategy.getState()).toBe('running');
    });

    test('should track strategy performance metrics', async () => {
      await trendStrategy.start();
      
      // Execute strategy multiple times to generate metrics
      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      for (let i = 0; i < 5; i++) {
        await trendStrategy.execute(context);
      }

      const metrics = trendStrategy.getPerformanceMetrics();
      expect(metrics.totalExecutions).toBe(5);
      expect(metrics.avgExecutionTime).toBeGreaterThan(0);
      expect(typeof metrics.successRate).toBe('number');
    });
  });

  describe('Signal Generation', () => {
    test('should generate valid buy signal', async () => {
      // Create upward trending data
      const trendingData = MockDataGenerator.generateOHLCV({
        count: 10,
        basePrice: 100,
        trend: 'up'
      });

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: trendingData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      await trendStrategy.start();
      const signal = await trendStrategy.execute(context);
      
      expect(signal).toBeDefined();
      expect(signal!.action).toBe('buy');
      expect(signal!.confidence).toBeGreaterThan(0);
      expect(signal!.confidence).toBeLessThanOrEqual(1);
      expect(signal!.symbol).toBe('BTC-USD');
      expect(signal!.timestamp).toBeInstanceOf(Date);
      
      TestingFramework.validateSignal(signal!);
    });

    test('should generate valid sell signal', async () => {
      // Create downward trending data
      const trendingData = MockDataGenerator.generateOHLCV({
        count: 10,
        basePrice: 100,
        trend: 'down'
      });

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: trendingData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      await trendStrategy.start();
      const signal = await trendStrategy.execute(context);
      
      expect(signal).toBeDefined();
      expect(signal!.action).toBe('sell');
      TestingFramework.validateSignal(signal!);
    });

    test('should generate hold signal for sideways movement', async () => {
      const sidewaysData = MockDataGenerator.generateOHLCV({
        count: 10,
        basePrice: 100,
        trend: 'sideways',
        volatility: 0.005 // Low volatility
      });

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: sidewaysData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      await trendStrategy.start();
      const signal = await trendStrategy.execute(context);
      
      expect(signal).toBeDefined();
      expect(signal!.action).toBe('hold');
      TestingFramework.validateSignal(signal!);
    });

    test('should handle RSI-based signals', async () => {
      await meanReversionStrategy.start();

      // Test overbought condition
      const overboughtContext: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: { ...mockIndicators, rsi: { value: 75, isValid: true, timestamp: new Date() } },
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const sellSignal = await meanReversionStrategy.execute(overboughtContext);
      expect(sellSignal!.action).toBe('sell');
      expect(sellSignal!.reason).toContain('Overbought');

      // Test oversold condition
      const oversoldContext: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: { ...mockIndicators, rsi: { value: 25, isValid: true, timestamp: new Date() } },
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const buySignal = await meanReversionStrategy.execute(oversoldContext);
      expect(buySignal!.action).toBe('buy');
      expect(buySignal!.reason).toContain('Oversold');
    });
  });

  describe('Strategy Execution Performance', () => {
    test('should execute within performance benchmarks', async () => {
      await trendStrategy.start();

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      await TestingFramework.assertPerformance(async () => {
        await trendStrategy.execute(context);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.strategyExecution);
    });

    test('should handle multiple concurrent executions', async () => {
      await trendStrategy.start();

      const contexts = Array.from({ length: 10 }, (_, i) => ({
        symbol: `BTC-USD-${i}`,
        marketData: mockMarketData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      }));

      await TestingFramework.assertPerformance(async () => {
        const promises = contexts.map(context => trendStrategy.execute(context));
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(10);
        results.forEach(signal => {
          if (signal) {
            TestingFramework.validateSignal(signal);
          }
        });
      }, TestingFramework.PERFORMANCE_BENCHMARKS.strategyExecution * 5);
    });

    test('should maintain memory efficiency during execution', async () => {
      await trendStrategy.start();

      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        const context: ExecutionContext = {
          symbol: 'BTC-USD',
          marketData: mockMarketData,
          indicators: mockIndicators,
          portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
          timestamp: new Date()
        };

        for (let i = 0; i < 100; i++) {
          await trendStrategy.execute(context);
        }
        
        return 100;
      });

      expect(memoryTest.memoryUsedMB).toBeLessThan(10); // Should use less than 10MB
    });
  });

  describe('Multi-Strategy Coordination', () => {
    test('should register and manage multiple strategies', async () => {
      await strategyEngine.registerStrategy(trendStrategy);
      await strategyEngine.registerStrategy(meanReversionStrategy);

      const registeredStrategies = strategyEngine.getRegisteredStrategies();
      expect(registeredStrategies).toHaveLength(2);
      expect(registeredStrategies.map(s => s.getId())).toContain(trendStrategy.getId());
      expect(registeredStrategies.map(s => s.getId())).toContain(meanReversionStrategy.getId());
    });

    test('should execute all strategies and aggregate signals', async () => {
      await strategyEngine.registerStrategy(trendStrategy);
      await strategyEngine.registerStrategy(meanReversionStrategy);
      await strategyEngine.startAll();

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const signals = await strategyEngine.executeAll(context);
      expect(signals).toHaveLength(2);
      
      signals.forEach(signal => {
        if (signal.signal) {
          TestingFramework.validateSignal(signal.signal);
        }
      });
    });

    test('should handle strategy conflicts and resolution', async () => {
      // Create opposing strategies
      const bullishStrategy = new TestTrendFollowingStrategy(
        MockDataGenerator.generateStrategy('trend_following')
      );
      const bearishStrategy = new TestMeanReversionStrategy(
        MockDataGenerator.generateStrategy('mean_reversion')
      );

      await strategyEngine.registerStrategy(bullishStrategy);
      await strategyEngine.registerStrategy(bearishStrategy);
      await strategyEngine.startAll();

      // Create context that might generate conflicting signals
      const conflictContext: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: MockDataGenerator.generateOHLCV({ count: 10, trend: 'up' }),
        indicators: { ...mockIndicators, rsi: { value: 75, isValid: true, timestamp: new Date() } },
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const signals = await strategyEngine.executeAll(conflictContext);
      const resolvedSignal = strategyEngine.resolveSignalConflicts(signals);

      expect(resolvedSignal).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(resolvedSignal.action);
    });

    test('should prioritize strategies by performance', async () => {
      // Mock performance data
      trendStrategy.updatePerformanceMetrics({
        totalReturns: 0.15, // 15% returns
        winRate: 0.8,
        sharpeRatio: 1.5
      });

      meanReversionStrategy.updatePerformanceMetrics({
        totalReturns: 0.05, // 5% returns
        winRate: 0.6,
        sharpeRatio: 0.8
      });

      await strategyEngine.registerStrategy(trendStrategy);
      await strategyEngine.registerStrategy(meanReversionStrategy);

      const prioritizedStrategies = strategyEngine.getStrategiesByPerformance();
      expect(prioritizedStrategies[0].getId()).toBe(trendStrategy.getId());
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle strategy execution errors gracefully', async () => {
      // Create strategy that throws error
      class ErrorStrategy extends BaseStrategy {
        async execute(context: ExecutionContext): Promise<Signal | null> {
          throw new Error('Strategy execution failed');
        }
        
        protected validateConfiguration(): void {}
      }

      const errorStrategy = new ErrorStrategy(MockDataGenerator.generateStrategy('trend_following'));
      await strategyEngine.registerStrategy(errorStrategy);
      await strategyEngine.startAll();

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const signals = await strategyEngine.executeAll(context);
      expect(signals).toHaveLength(1);
      expect(signals[0].error).toBeDefined();
      expect(signals[0].signal).toBeNull();
    });

    test('should recover from invalid market data', async () => {
      await trendStrategy.start();

      const invalidContext: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: [], // Empty market data
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const signal = await trendStrategy.execute(invalidContext);
      expect(signal).toBeNull(); // Should handle gracefully
    });

    test('should handle missing indicators', async () => {
      await meanReversionStrategy.start();

      const missingIndicatorsContext: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: {}, // Missing indicators
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      const signal = await meanReversionStrategy.execute(missingIndicatorsContext);
      expect(signal).toBeNull(); // Should handle gracefully
    });

    test('should implement circuit breaker for failing strategies', async () => {
      // Mock strategy with high failure rate
      let executionCount = 0;
      class FailingStrategy extends BaseStrategy {
        async execute(context: ExecutionContext): Promise<Signal | null> {
          executionCount++;
          if (executionCount <= 5) {
            throw new Error('Strategy failure');
          }
          return this.createSignal('hold', 0.5, 'Recovery attempt');
        }
        
        protected validateConfiguration(): void {}
      }

      const failingStrategy = new FailingStrategy(MockDataGenerator.generateStrategy('trend_following'));
      await strategyEngine.registerStrategy(failingStrategy);
      
      // Configure circuit breaker
      strategyEngine.setCircuitBreakerThreshold(3); // Trip after 3 failures
      await strategyEngine.startAll();

      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData: mockMarketData,
        indicators: mockIndicators,
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
        timestamp: new Date()
      };

      // Execute multiple times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await strategyEngine.executeAll(context);
      }

      expect(failingStrategy.getState()).toBe('circuit_breaker');
    });
  });

  describe('Configuration Management', () => {
    test('should validate strategy parameters', () => {
      const validConfig = MockDataGenerator.generateStrategy('trend_following');
      validConfig.parameters = { trendThreshold: 0.001 };
      
      expect(() => new TestTrendFollowingStrategy(validConfig)).not.toThrow();

      const invalidConfig = MockDataGenerator.generateStrategy('trend_following');
      delete invalidConfig.parameters.trendThreshold;
      
      expect(() => new TestTrendFollowingStrategy(invalidConfig)).toThrow();
    });

    test('should support dynamic parameter updates', async () => {
      await trendStrategy.start();
      
      const newParameters = { trendThreshold: 0.002 };
      await trendStrategy.updateParameters(newParameters);
      
      const updatedConfig = trendStrategy.getConfiguration();
      expect(updatedConfig.parameters.trendThreshold).toBe(0.002);
    });

    test('should validate parameter ranges', () => {
      const config = MockDataGenerator.generateStrategy('mean_reversion');
      
      // Test invalid RSI levels
      config.parameters = { overboughtLevel: 110, oversoldLevel: 30 }; // Invalid: > 100
      expect(() => new TestMeanReversionStrategy(config)).toThrow();

      config.parameters = { overboughtLevel: 70, oversoldLevel: -10 }; // Invalid: < 0
      expect(() => new TestMeanReversionStrategy(config)).toThrow();

      config.parameters = { overboughtLevel: 50, oversoldLevel: 70 }; // Invalid: oversold > overbought
      expect(() => new TestMeanReversionStrategy(config)).toThrow();
    });

    test('should handle configuration serialization', () => {
      const config = trendStrategy.getConfiguration();
      const serialized = JSON.stringify(config);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized.id).toBe(config.id);
      expect(deserialized.type).toBe(config.type);
      expect(deserialized.parameters).toEqual(config.parameters);
    });
  });

  describe('Integration Tests', () => {
    test('should integrate with mock market data feed', async () => {
      const marketDataProvider = TestingFramework.createMockMarketDataProvider();
      await marketDataProvider.connect();

      let signalReceived = false;
      marketDataProvider.subscribe('BTC-USD', async (data) => {
        const context: ExecutionContext = {
          symbol: 'BTC-USD',
          marketData: [data],
          indicators: mockIndicators,
          portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 }),
          timestamp: new Date()
        };

        await trendStrategy.start();
        const signal = await trendStrategy.execute(context);
        if (signal) {
          signalReceived = true;
        }
      });

      // Simulate market data
      const testCandle = MockDataGenerator.generateOHLCV({ count: 1 })[0];
      marketDataProvider.simulateDataFeed('BTC-USD', testCandle);

      await TestingFramework.waitForCondition(() => signalReceived, 1000);
      expect(signalReceived).toBe(true);
    });

    test('should work with complete trading workflow', async () => {
      // Register strategies
      await strategyEngine.registerStrategy(trendStrategy);
      await strategyEngine.registerStrategy(meanReversionStrategy);
      await strategyEngine.startAll();

      // Create realistic trading scenario
      const portfolio = MockDataGenerator.generatePortfolio({ totalValue: 100000, positionCount: 3 });
      const marketData = MockDataGenerator.generateOHLCV({ count: 20, trend: 'up' });
      
      const context: ExecutionContext = {
        symbol: 'BTC-USD',
        marketData,
        indicators: mockIndicators,
        portfolio,
        timestamp: new Date()
      };

      // Execute trading workflow
      const signals = await strategyEngine.executeAll(context);
      const resolvedSignal = strategyEngine.resolveSignalConflicts(signals);

      expect(resolvedSignal).toBeDefined();
      TestingFramework.validateSignal(resolvedSignal);

      // Validate portfolio state
      TestingFramework.validatePortfolioState(portfolio);

      // Check strategy performance
      const strategies = strategyEngine.getRegisteredStrategies();
      strategies.forEach(strategy => {
        const metrics = strategy.getPerformanceMetrics();
        expect(metrics.totalExecutions).toBeGreaterThan(0);
      });
    });
  });
});