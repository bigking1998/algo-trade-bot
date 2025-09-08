/**
 * Backtesting Engine Integration Test - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Comprehensive integration tests for the backtesting system including:
 * - End-to-end backtest execution
 * - Performance validation
 * - Risk analysis verification
 * - API endpoint testing
 * - Error handling and edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import BacktestEngine from '../BacktestEngine';
import { MockHistoricalDataProvider } from '../HistoricalDataProvider';
import { BacktestConfig } from '../types';
import { BaseStrategy } from '../../strategies/BaseStrategy';

// Mock strategy for testing
class MockStrategy extends BaseStrategy {
  private signalCounter = 0;

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async execute(context: any, options?: any): Promise<any> {
    // Generate alternating buy/sell signals for testing
    this.signalCounter++;
    
    if (this.signalCounter % 10 === 1) {
      return {
        signal: 'buy',
        strength: 0.8,
        confidence: 0.7,
        entryPrice: context.marketData.current.close,
        positionSize: 1000,
        metadata: { reason: 'test_signal' }
      };
    } else if (this.signalCounter % 20 === 11) {
      return {
        signal: 'sell',
        strength: 0.6,
        confidence: 0.8,
        entryPrice: context.marketData.current.close,
        positionSize: 1000,
        metadata: { reason: 'test_exit' }
      };
    }
    
    return null;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }

  async generateSignal(context: any): Promise<any> {
    return this.execute(context);
  }

  async validateSignal(signal: any, context: any): Promise<boolean> {
    return signal && (signal.signal === 'buy' || signal.signal === 'sell');
  }

  async calculatePositionSize(signal: any, context: any): Promise<number> {
    return signal.positionSize || 1000;
  }

  async shouldExitPosition(position: any, context: any): Promise<boolean> {
    return false;
  }
}

describe('BacktestEngine Integration Tests', () => {
  let backtestEngine: BacktestEngine;
  let mockDataProvider: MockHistoricalDataProvider;
  let mockStrategy: MockStrategy;
  
  const testConfig: BacktestConfig = {
    id: 'test_backtest_' + Date.now(),
    name: 'Test Backtest',
    description: 'Integration test backtest',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'), // 1 month test period
    timeframe: '1h',
    symbols: ['BTC-USD'],
    dataSource: 'historical',
    initialCapital: 10000,
    currency: 'USD',
    commission: 0.001,
    slippage: 0.001,
    latency: 100,
    fillRatio: 1.0,
    maxPositionSize: 20,
    maxDrawdown: 30,
    strategyConfig: {},
    riskFreeRate: 0.02,
    warmupPeriod: 10,
    enableReinvestment: false,
    compoundReturns: true,
    includeWeekends: true,
    created: new Date(),
    updated: new Date()
  };

  beforeEach(async () => {
    mockDataProvider = new MockHistoricalDataProvider();
    backtestEngine = new BacktestEngine(mockDataProvider, {
      logLevel: 'error', // Reduce noise in tests
      enableProgressReporting: false,
      continueOnError: true,
      maxErrors: 10
    });
    
    mockStrategy = new MockStrategy({
      id: 'mock_strategy',
      name: 'Mock Strategy',
      version: '1.0.0',
      type: 'technical',
      symbols: ['BTC-USD'],
      timeframes: ['1h'],
      maxConcurrentPositions: 3,
      parameters: {},
      riskProfile: {
        maxRiskPerTrade: 5,
        maxPortfolioRisk: 20,
        stopLossType: 'fixed' as const,
        takeProfitType: 'fixed' as const,
        positionSizing: 'fixed' as const
      },
      performance: {
        minWinRate: 0.5,
        maxDrawdown: 0.2,
        minSharpeRatio: 1.0,
        benchmarkSymbol: 'BTC-USD'
      },
      execution: {
        orderType: 'market' as const,
        slippage: 0.001,
        timeout: 30,
        retries: 3
      },
      monitoring: {
        enableAlerts: false,
        alertChannels: [],
        healthCheckInterval: 60,
        performanceReviewInterval: 3600
      }
    });
  });

  afterEach(async () => {
    if (backtestEngine) {
      try {
        await backtestEngine.cancelBacktest();
      } catch (error) {
        // Ignore cancellation errors
      }
    }
  });

  test('should complete basic backtest successfully', async () => {
    const results = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    expect(results).toBeDefined();
    expect(results.backtestId).toBe(testConfig.id);
    expect(results.initialValue).toBe(testConfig.initialCapital);
    expect(results.finalValue).toBeGreaterThan(0);
    expect(results.totalBars).toBeGreaterThan(0);
    
    // Verify basic performance metrics
    expect(results.totalReturnPercent).toBeDefined();
    expect(results.sharpeRatio).toBeDefined();
    expect(results.maxDrawdownPercent).toBeDefined();
    expect(results.totalTrades).toBeGreaterThanOrEqual(0);
    
    console.log('Backtest Results Summary:');
    console.log(`- Total Return: ${results.totalReturnPercent.toFixed(2)}%`);
    console.log(`- Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
    console.log(`- Max Drawdown: ${results.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`- Total Trades: ${results.totalTrades}`);
    console.log(`- Win Rate: ${results.winRate.toFixed(1)}%`);
  }, 30000); // 30 second timeout

  test('should handle backtest progress tracking', async () => {
    const progressUpdates: any[] = [];
    
    backtestEngine.on('progress_update', (progress) => {
      progressUpdates.push(progress);
    });
    
    const resultsPromise = backtestEngine.runBacktest(testConfig, mockStrategy);
    
    // Wait a bit for some progress updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const results = await resultsPromise;
    
    expect(progressUpdates.length).toBeGreaterThan(0);
    
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    expect(lastProgress.progressPercent).toBe(100);
    expect(lastProgress.status).toBe('completed');
    
    console.log(`Progress updates received: ${progressUpdates.length}`);
  }, 30000);

  test('should generate realistic performance metrics', async () => {
    const results = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    // Verify all required metrics are present
    expect(results.totalReturn).toBeDefined();
    expect(results.totalReturnPercent).toBeDefined();
    expect(results.annualizedReturn).toBeDefined();
    expect(results.volatility).toBeDefined();
    expect(results.sharpeRatio).toBeDefined();
    expect(results.sortinoRatio).toBeDefined();
    expect(results.calmarRatio).toBeDefined();
    expect(results.maxDrawdown).toBeDefined();
    expect(results.maxDrawdownPercent).toBeDefined();
    
    // Verify trade statistics
    expect(results.totalTrades).toBeDefined();
    expect(results.winningTrades).toBeDefined();
    expect(results.losingTrades).toBeDefined();
    expect(results.winRate).toBeGreaterThanOrEqual(0);
    expect(results.winRate).toBeLessThanOrEqual(100);
    
    // Verify equity curve
    expect(results.equityCurve).toBeDefined();
    expect(Array.isArray(results.equityCurve)).toBe(true);
    expect(results.equityCurve.length).toBeGreaterThan(0);
    
    // Verify each equity point has required fields
    for (const point of results.equityCurve.slice(0, 5)) { // Check first 5 points
      expect(point.timestamp).toBeDefined();
      expect(point.equity).toBeGreaterThan(0);
      expect(point.drawdown).toBeDefined();
    }
  }, 30000);

  test('should handle errors gracefully', async () => {
    // Create config with invalid date range
    const invalidConfig = {
      ...testConfig,
      startDate: new Date('2023-01-31'),
      endDate: new Date('2023-01-01') // End before start
    };
    
    await expect(backtestEngine.runBacktest(invalidConfig, mockStrategy))
      .rejects.toThrow();
  });

  test('should support backtest cancellation', async () => {
    const longTestConfig = {
      ...testConfig,
      endDate: new Date('2023-12-31') // Full year for longer test
    };
    
    const backtestPromise = backtestEngine.runBacktest(longTestConfig, mockStrategy);
    
    // Cancel after a short delay
    setTimeout(async () => {
      try {
        await backtestEngine.cancelBacktest();
      } catch (error) {
        console.log('Cancellation error (expected):', error);
      }
    }, 2000);
    
    await expect(backtestPromise).rejects.toThrow('cancelled');
  }, 15000);

  test('should validate risk metrics calculation', async () => {
    const results = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    // Verify risk metrics are within reasonable ranges
    expect(results.volatility).toBeGreaterThan(0);
    expect(results.volatility).toBeLessThan(200); // Less than 200% annualized
    
    expect(results.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
    expect(results.maxDrawdownPercent).toBeLessThan(100);
    
    expect(results.valueAtRisk95).toBeDefined();
    expect(results.conditionalValueAtRisk95).toBeDefined();
    expect(results.conditionalValueAtRisk95).toBeGreaterThanOrEqual(results.valueAtRisk95);
    
    // Verify Sharpe ratio is reasonable
    expect(results.sharpeRatio).toBeGreaterThan(-5);
    expect(results.sharpeRatio).toBeLessThan(5);
  }, 30000);

  test('should track portfolio composition accurately', async () => {
    const results = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    expect(results.portfolioSnapshots).toBeDefined();
    expect(Array.isArray(results.portfolioSnapshots)).toBe(true);
    expect(results.portfolioSnapshots.length).toBeGreaterThan(0);
    
    // Check portfolio snapshot structure
    const snapshot = results.portfolioSnapshots[0];
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.totalValue).toBeGreaterThan(0);
    expect(snapshot.cash).toBeDefined();
    expect(snapshot.positionsValue).toBeDefined();
    expect(snapshot.totalPnL).toBeDefined();
    expect(snapshot.positions).toBeDefined();
    expect(Array.isArray(snapshot.positions)).toBe(true);
  }, 30000);

  test('should calculate execution costs correctly', async () => {
    const results = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    expect(results.totalCommission).toBeGreaterThanOrEqual(0);
    expect(results.totalSlippage).toBeGreaterThanOrEqual(0);
    expect(results.averageSlippageBps).toBeGreaterThanOrEqual(0);
    expect(results.fillRate).toBeGreaterThan(0);
    expect(results.fillRate).toBeLessThanOrEqual(100);
    
    // Verify costs are reasonable relative to trading volume
    if (results.totalTrades > 0) {
      const avgCommissionPerTrade = results.totalCommission / results.totalTrades;
      expect(avgCommissionPerTrade).toBeLessThan(results.initialValue * 0.01); // Less than 1% per trade
    }
  }, 30000);

  test('should handle multi-symbol backtests', async () => {
    const multiSymbolConfig = {
      ...testConfig,
      symbols: ['BTC-USD', 'ETH-USD']
    };
    
    const results = await backtestEngine.runBacktest(multiSymbolConfig, mockStrategy);
    
    expect(results).toBeDefined();
    expect(results.performanceAttribution).toBeDefined();
    
    // Should have attribution for each symbol
    for (const symbol of multiSymbolConfig.symbols) {
      if (results.performanceAttribution[symbol]) {
        expect(results.performanceAttribution[symbol].totalReturn).toBeDefined();
        expect(results.performanceAttribution[symbol].trades).toBeGreaterThanOrEqual(0);
        expect(results.performanceAttribution[symbol].winRate).toBeGreaterThanOrEqual(0);
        expect(results.performanceAttribution[symbol].winRate).toBeLessThanOrEqual(100);
      }
    }
  }, 30000);

  test('should produce consistent results with same configuration', async () => {
    const results1 = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    // Reset strategy state
    mockStrategy = new MockStrategy(mockStrategy.getConfig());
    
    const results2 = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    // Results should be very similar (allowing for small variations due to randomness)
    expect(Math.abs(results1.totalReturnPercent - results2.totalReturnPercent)).toBeLessThan(5);
    expect(Math.abs(results1.totalTrades - results2.totalTrades)).toBeLessThan(10);
    expect(Math.abs(results1.winRate - results2.winRate)).toBeLessThan(10);
  }, 60000);

  test('should handle empty signal generation', async () => {
    // Create strategy that generates no signals
    class NoSignalStrategy extends MockStrategy {
      async execute(): Promise<any> {
        return null; // No signals
      }
    }
    
    const noSignalStrategy = new NoSignalStrategy(testConfig.strategyConfig);
    const results = await backtestEngine.runBacktest(testConfig, noSignalStrategy);
    
    expect(results.totalTrades).toBe(0);
    expect(results.winningTrades).toBe(0);
    expect(results.losingTrades).toBe(0);
    expect(results.finalValue).toBeCloseTo(results.initialValue, -1); // Should be close to initial value
  }, 30000);

  test('should validate performance benchmark', async () => {
    const results = await backtestEngine.runBacktest(testConfig, mockStrategy);
    
    // Basic performance validation
    expect(results.duration).toBeGreaterThan(0);
    expect(results.duration).toBeLessThan(60000); // Should complete within 1 minute
    
    // Processing speed validation
    const barsPerSecond = (results.totalBars / results.duration) * 1000;
    console.log(`Processing speed: ${barsPerSecond.toFixed(0)} bars/second`);
    
    // Should process at least 100 bars per second
    expect(barsPerSecond).toBeGreaterThan(100);
  }, 30000);
});

describe('BacktestEngine Error Handling', () => {
  let backtestEngine: BacktestEngine;
  let mockDataProvider: MockHistoricalDataProvider;
  
  beforeEach(() => {
    mockDataProvider = new MockHistoricalDataProvider();
    backtestEngine = new BacktestEngine(mockDataProvider);
  });

  test('should handle invalid configuration', async () => {
    const mockStrategy = new MockStrategy({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      type: 'technical',
      symbols: ['BTC-USD'],
      timeframes: ['1h'],
      maxConcurrentPositions: 3,
      parameters: {},
      riskProfile: { 
        maxRiskPerTrade: 5, 
        maxPortfolioRisk: 20,
        stopLossType: 'fixed' as const,
        takeProfitType: 'fixed' as const,
        positionSizing: 'fixed' as const
      },
      performance: {
        minWinRate: 0.5,
        maxDrawdown: 0.2,
        minSharpeRatio: 1.0,
        benchmarkSymbol: 'BTC-USD'
      },
      execution: { 
        orderType: 'market' as const,
        slippage: 0.001,
        timeout: 30,
        retries: 3
      },
      monitoring: { 
        enableAlerts: false,
        alertChannels: [],
        healthCheckInterval: 60,
        performanceReviewInterval: 3600
      }
    });

    const invalidConfigs = [
      // Missing required fields
      { ...testConfig, symbols: [] },
      { ...testConfig, initialCapital: -1000 },
      { ...testConfig, startDate: new Date('invalid') },
      // Invalid date ranges
      { 
        ...testConfig, 
        startDate: new Date('2023-12-31'), 
        endDate: new Date('2023-01-01') 
      }
    ];

    for (const config of invalidConfigs) {
      await expect(backtestEngine.runBacktest(config as any, mockStrategy))
        .rejects.toThrow();
    }
  });
});

const testConfig: BacktestConfig = {
  id: 'test_backtest',
  name: 'Test Backtest',
  description: 'Test backtest configuration',
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-01-31'),
  timeframe: '1h',
  symbols: ['BTC-USD'],
  dataSource: 'historical',
  initialCapital: 10000,
  currency: 'USD',
  commission: 0.001,
  slippage: 0.001,
  latency: 100,
  fillRatio: 1.0,
  maxPositionSize: 20,
  maxDrawdown: 30,
  strategyConfig: {},
  riskFreeRate: 0.02,
  warmupPeriod: 10,
  enableReinvestment: false,
  compoundReturns: true,
  includeWeekends: true,
  created: new Date(),
  updated: new Date()
};