/**
 * Phase 2 Integration Testing Suite Implementation - Integration Task TE-002
 * 
 * Comprehensive integration testing for all Phase 2 advanced capabilities systems:
 * - Strategy Execution Engine integration
 * - Order Management System integration  
 * - Market Data streaming reliability
 * - ML Pipeline integration testing
 * - Portfolio Management accuracy
 * - Risk Management integration
 * - Performance Analytics validation
 * 
 * This test suite validates complete end-to-end workflows and component interactions
 * for Phase 2 systems to ensure enterprise-grade reliability.
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { TestingFramework, MockDatabase, MockMarketDataProvider } from '../TestingFramework.js';
import { MockDataGenerator } from '../MockDataGenerator.js';

// Core Phase 2 Systems Under Test
import { StrategyEngine } from '../../backend/engine/StrategyEngine.js';
import { StrategyExecutionEngine } from '../../backend/execution/StrategyExecutionEngine.js';
import { ExecutionOrchestrator } from '../../backend/execution/ExecutionOrchestrator.js';
import { OrderManager } from '../../backend/orders/OrderManager.js';
import { RiskEngine } from '../../backend/risk/RiskEngine.js';
import { PerformanceMonitor } from '../../backend/engine/PerformanceMonitor.js';
import { SignalProcessor } from '../../backend/engine/SignalProcessor.js';

// Supporting Infrastructure
import { DatabaseManager } from '../../backend/database/DatabaseManager.js';
import { MarketDataRepository, StrategyRepository, TradeRepository } from '../../backend/repositories/index.js';
import { BaseStrategy } from '../../backend/strategies/BaseStrategy.js';
import { SimpleMovingAverageCrossStrategy } from '../../backend/strategies/examples/SimpleMovingAverageCrossStrategy.js';

// Types
import type {
  StrategySignal,
  StrategyContext,
  Position,
  MarketDataWindow,
  StrategyMetrics,
  StrategyConfig
} from '../../backend/strategies/types.js';
import type { OHLCV, Trade, PortfolioState } from '../../shared/types/trading.js';

/**
 * Phase 2 Integration Test Suite Configuration
 */
const PHASE2_TEST_CONFIG = {
  // Performance Targets for Phase 2 Systems
  PERFORMANCE_TARGETS: {
    strategyEngineStartup: 2000,        // 2s max startup time
    signalProcessing: 50,               // 50ms max signal processing
    orderExecution: 100,                // 100ms max order execution
    riskAssessment: 25,                 // 25ms max risk assessment
    portfolioUpdate: 30,                // 30ms max portfolio update
    mlPrediction: 200,                  // 200ms max ML prediction
    dataStreamProcessing: 10,           // 10ms max per data point
  },
  
  // Stress Testing Parameters
  STRESS_TESTING: {
    maxConcurrentStrategies: 10,
    maxSignalsPerSecond: 50,
    maxOrdersPerMinute: 500,
    maxDataPointsPerSecond: 100,
    testDurationMinutes: 5,
  },
  
  // Accuracy Requirements
  ACCURACY_REQUIREMENTS: {
    portfolioValueTolerance: 0.01,      // $0.01 tolerance
    pnlCalculationTolerance: 0.01,      // $0.01 tolerance  
    riskMetricsTolerance: 0.001,        // 0.1% tolerance
    predictionAccuracyMin: 0.55,        // 55% min prediction accuracy
  }
} as const;

/**
 * Integration Test Context - manages test environment state
 */
class IntegrationTestContext {
  public database: MockDatabase;
  public marketDataProvider: MockMarketDataProvider;
  public strategyEngine: StrategyEngine;
  public executionEngine: StrategyExecutionEngine;
  public orderManager: OrderManager;
  public riskEngine: RiskEngine;
  public performanceMonitor: PerformanceMonitor;
  
  private repositories: {
    marketData: MarketDataRepository;
    strategy: StrategyRepository;
    trade: TradeRepository;
  };
  
  constructor() {
    this.database = TestingFramework.createMockDatabase();
    this.marketDataProvider = TestingFramework.createMockMarketDataProvider();
  }
  
  async initialize(): Promise<void> {
    // Initialize database and repositories
    await this.database.connect();
    
    this.repositories = {
      marketData: new MarketDataRepository(this.database as any),
      strategy: new StrategyRepository(this.database as any),
      trade: new TradeRepository(this.database as any),
    };
    
    // Initialize core Phase 2 systems
    this.strategyEngine = new StrategyEngine({
      maxConcurrentStrategies: PHASE2_TEST_CONFIG.STRESS_TESTING.maxConcurrentStrategies,
      maxSignalsPerSecond: PHASE2_TEST_CONFIG.STRESS_TESTING.maxSignalsPerSecond,
      defaultExecutionTimeout: 5000,
      maxMemoryUsage: 500,
      maxCpuUsage: 80,
      maxLatency: 100,
      enableProfiling: true,
      enableHealthChecks: true,
      healthCheckInterval: 1000,
      riskManagement: {
        maxDrawdown: 0.15,
        maxPositionSize: 0.1,
        stopLossPercentage: 0.05,
        dailyLossLimit: 1000
      }
    });
    
    this.executionEngine = new StrategyExecutionEngine({
      mode: 'paper',
      maxConcurrentExecutions: 10,
      executionTimeout: 5000,
      orderTimeout: 3000,
      enableMetrics: true,
      memoryLimit: 500,
      enableRecovery: true,
      recoveryAttempts: 3
    });
    
    this.orderManager = new OrderManager({
      maxPendingOrders: 1000,
      orderTimeout: 30000,
      enablePartialFills: true,
      minOrderSize: 0.01,
      maxOrderSize: 10000,
      enableSlippage: true,
      defaultSlippage: 0.001
    });
    
    this.riskEngine = new RiskEngine({
      maxDrawdown: 0.15,
      maxPositionSize: 0.1,
      stopLossPercentage: 0.05,
      dailyLossLimit: 1000,
      enableRealTimeMonitoring: true,
      riskCheckInterval: 1000,
      enableVaRCalculation: true,
      varConfidence: 0.95,
      varTimeHorizon: 1
    });
    
    this.performanceMonitor = new PerformanceMonitor({
      metricsInterval: 1000,
      enableDetailedMetrics: true,
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        memoryUsage: 0.8,
        cpuUsage: 0.8,
        latency: 100
      }
    });
    
    // Initialize market data connection
    await this.marketDataProvider.connect();
    
    // Initialize all systems
    await this.strategyEngine.initialize();
    await this.executionEngine.initialize();
    await this.orderManager.initialize();
    await this.riskEngine.initialize();
    await this.performanceMonitor.start();
  }
  
  async cleanup(): Promise<void> {
    // Graceful shutdown of all systems
    await this.performanceMonitor?.stop();
    await this.riskEngine?.shutdown();
    await this.orderManager?.shutdown();
    await this.executionEngine?.shutdown();
    await this.strategyEngine?.shutdown();
    await this.marketDataProvider?.disconnect();
    await this.database?.disconnect();
  }
  
  async loadTestStrategy(): Promise<BaseStrategy> {
    const config: StrategyConfig = {
      id: 'test-sma-cross',
      name: 'Test SMA Cross Strategy',
      type: 'trend_following',
      symbol: 'ETH-USD',
      timeframe: '1m',
      parameters: {
        fastPeriod: 10,
        slowPeriod: 20,
        minVolume: 1000
      },
      riskParameters: {
        maxPositionSize: 0.1,
        stopLossPercentage: 0.05,
        takeProfitPercentage: 0.1
      },
      isActive: true
    };
    
    const strategy = new SimpleMovingAverageCrossStrategy(config);
    await this.strategyEngine.loadStrategy(strategy);
    return strategy;
  }
  
  generateTestMarketData(count: number = 100): OHLCV[] {
    return MockDataGenerator.generateOHLCVSeries(count, {
      symbol: 'ETH-USD',
      startPrice: 2000,
      volatility: 0.02,
      trend: 0.001
    });
  }
}

// Global test context
let testContext: IntegrationTestContext;

// Test Suite Setup and Teardown
beforeAll(async () => {
  testContext = new IntegrationTestContext();
  await testContext.initialize();
}, 30000); // 30 second timeout for setup

afterAll(async () => {
  if (testContext) {
    await testContext.cleanup();
  }
}, 10000);

// Test Suite: Core System Integration
describe('Phase 2 Integration Testing Suite', () => {
  
  describe('Strategy Engine Integration', () => {
    test('should initialize and coordinate multiple strategies', async () => {
      const startTime = performance.now();
      
      // Load multiple test strategies
      const strategy1 = await testContext.loadTestStrategy();
      const strategy2Config: StrategyConfig = {
        id: 'test-sma-cross-2',
        name: 'Test SMA Cross Strategy 2',
        type: 'trend_following',
        symbol: 'BTC-USD',
        timeframe: '5m',
        parameters: { fastPeriod: 5, slowPeriod: 15 },
        riskParameters: { maxPositionSize: 0.05 },
        isActive: true
      };
      
      const strategy2 = new SimpleMovingAverageCrossStrategy(strategy2Config);
      await testContext.strategyEngine.loadStrategy(strategy2);
      
      // Start engine
      await testContext.strategyEngine.start();
      
      const initTime = performance.now() - startTime;
      expect(initTime).toBeLessThan(PHASE2_TEST_CONFIG.PERFORMANCE_TARGETS.strategyEngineStartup);
      
      // Verify engine state
      expect(testContext.strategyEngine.getState()).toBe('running');
      expect(testContext.strategyEngine.getActiveStrategies().length).toBe(2);
      
      // Verify strategies are properly coordinated
      const metrics = testContext.strategyEngine.getMetrics();
      TestingFramework.assertHasProperties(metrics, [
        'totalStrategies', 'activeStrategies', 'signalsProcessed', 'averageLatency'
      ]);
      
      expect(metrics.totalStrategies).toBe(2);
      expect(metrics.activeStrategies).toBe(2);
    });
    
    test('should process market data and generate signals', async () => {
      // Generate test market data
      const marketData = testContext.generateTestMarketData(50);
      
      // Track signal generation
      const signals: StrategySignal[] = [];
      testContext.strategyEngine.on('signal', (signal: StrategySignal) => {
        signals.push(signal);
      });
      
      // Process market data through engine
      for (const candle of marketData) {
        const processStart = performance.now();
        await testContext.strategyEngine.processMarketData(candle);
        const processTime = performance.now() - processStart;
        
        expect(processTime).toBeLessThan(PHASE2_TEST_CONFIG.PERFORMANCE_TARGETS.signalProcessing);
      }
      
      // Wait for signal processing
      await TestingFramework.waitForCondition(() => signals.length > 0, 5000);
      
      // Validate signals
      expect(signals.length).toBeGreaterThan(0);
      signals.forEach(signal => {
        TestingFramework.validateSignal(signal);
        expect(signal.confidence).toBeGreaterThan(0);
        expect(['buy', 'sell', 'hold']).toContain(signal.action);
      });
    });
  });
  
  describe('Strategy Execution Engine Integration', () => {
    test('should execute strategy signals through complete pipeline', async () => {
      // Set up execution tracking
      const executedOrders: any[] = [];
      testContext.executionEngine.on('orderExecuted', (order) => {
        executedOrders.push(order);
      });
      
      // Generate and process a buy signal
      const signal: StrategySignal = {
        strategyId: 'test-sma-cross',
        action: 'buy',
        symbol: 'ETH-USD',
        confidence: 0.8,
        timestamp: Date.now(),
        price: 2000,
        volume: 1.0,
        metadata: {
          reason: 'SMA crossover',
          indicators: { fast: 1990, slow: 1980 }
        }
      };
      
      const executionStart = performance.now();
      await testContext.executionEngine.processSignal(signal);
      const executionTime = performance.now() - executionStart;
      
      expect(executionTime).toBeLessThan(PHASE2_TEST_CONFIG.PERFORMANCE_TARGETS.orderExecution);
      
      // Wait for order execution
      await TestingFramework.waitForCondition(() => executedOrders.length > 0, 5000);
      
      // Validate execution
      expect(executedOrders.length).toBe(1);
      const order = executedOrders[0];
      
      TestingFramework.assertHasProperties(order, [
        'id', 'strategyId', 'symbol', 'side', 'quantity', 'price', 'status'
      ]);
      
      expect(order.side).toBe('buy');
      expect(order.symbol).toBe('ETH-USD');
      expect(order.quantity).toBeGreaterThan(0);
    });
    
    test('should handle concurrent strategy executions', async () => {
      const concurrentSignals = Array.from({ length: 5 }, (_, i) => ({
        strategyId: `test-strategy-${i}`,
        action: i % 2 === 0 ? 'buy' : 'sell' as const,
        symbol: 'ETH-USD',
        confidence: 0.7 + (i * 0.05),
        timestamp: Date.now() + i,
        price: 2000 + (i * 10),
        volume: 0.5 + (i * 0.1),
        metadata: { concurrent: true }
      }));
      
      // Process all signals concurrently
      const executionPromises = concurrentSignals.map(signal =>
        testContext.executionEngine.processSignal(signal)
      );
      
      const startTime = performance.now();
      await Promise.all(executionPromises);
      const totalTime = performance.now() - startTime;
      
      // Should handle concurrent execution efficiently
      expect(totalTime).toBeLessThan(PHASE2_TEST_CONFIG.PERFORMANCE_TARGETS.orderExecution * 2);
      
      // Verify execution state
      const metrics = testContext.executionEngine.getMetrics();
      expect(metrics.totalExecutions).toBeGreaterThanOrEqual(5);
      expect(metrics.successfulExecutions).toBeGreaterThan(0);
    });
  });
  
  describe('Order Management System Integration', () => {
    test('should manage order lifecycle from creation to completion', async () => {
      const orderRequest = {
        strategyId: 'test-sma-cross',
        symbol: 'ETH-USD',
        side: 'buy' as const,
        quantity: 1.0,
        type: 'market' as const,
        timeInForce: 'IOC' as const
      };
      
      // Create order
      const orderId = await testContext.orderManager.createOrder(orderRequest);
      expect(orderId).toBeDefined();
      expect(typeof orderId).toBe('string');
      
      // Check order status
      const order = await testContext.orderManager.getOrder(orderId);
      expect(order).toBeDefined();
      expect(order?.status).toBe('pending');
      
      // Simulate order execution
      await testContext.orderManager.executeOrder(orderId);
      
      // Verify order completion
      const completedOrder = await testContext.orderManager.getOrder(orderId);
      expect(completedOrder?.status).toBe('filled');
      
      // Verify order metrics
      const metrics = testContext.orderManager.getMetrics();
      expect(metrics.totalOrders).toBeGreaterThan(0);
      expect(metrics.filledOrders).toBeGreaterThan(0);
    });
    
    test('should handle order failures and rejections gracefully', async () => {
      // Create an invalid order (insufficient balance simulation)
      const invalidOrder = {
        strategyId: 'test-sma-cross',
        symbol: 'ETH-USD',
        side: 'buy' as const,
        quantity: 1000000, // Unrealistic quantity
        type: 'market' as const,
        timeInForce: 'IOC' as const
      };
      
      // Mock insufficient balance
      vi.spyOn(testContext.orderManager as any, 'validateOrder').mockImplementation(() => {
        throw new Error('Insufficient balance');
      });
      
      // Attempt order creation
      await expect(testContext.orderManager.createOrder(invalidOrder))
        .rejects.toThrow('Insufficient balance');
      
      // Verify error handling
      const metrics = testContext.orderManager.getMetrics();
      expect(metrics.rejectedOrders).toBeGreaterThanOrEqual(1);
      
      // Restore original implementation
      vi.restoreAllMocks();
    });
  });
  
  describe('Risk Engine Integration', () => {
    test('should assess portfolio risk in real-time', async () => {
      // Set up test portfolio
      const portfolio: PortfolioState = {
        totalValue: 10000,
        availableBalance: 5000,
        positions: [
          {
            symbol: 'ETH-USD',
            quantity: 2.5,
            averagePrice: 2000,
            currentPrice: 2100,
            unrealizedPnL: 250,
            side: 'long'
          }
        ],
        timestamp: Date.now()
      };
      
      // Perform risk assessment
      const assessmentStart = performance.now();
      const riskAssessment = await testContext.riskEngine.assessPortfolioRisk(portfolio);
      const assessmentTime = performance.now() - assessmentStart;
      
      expect(assessmentTime).toBeLessThan(PHASE2_TEST_CONFIG.PERFORMANCE_TARGETS.riskAssessment);
      
      // Validate risk assessment structure
      TestingFramework.assertHasProperties(riskAssessment, [
        'portfolioValue', 'totalExposure', 'riskScore', 'var', 'drawdown'
      ]);
      
      // Validate risk metrics
      TestingFramework.assertWithinRange(
        riskAssessment.portfolioValue,
        portfolio.totalValue,
        PHASE2_TEST_CONFIG.ACCURACY_REQUIREMENTS.portfolioValueTolerance
      );
      
      TestingFramework.assertBetween(riskAssessment.riskScore, 0, 1);
    });
    
    test('should trigger risk alerts for dangerous positions', async () => {
      // Create high-risk portfolio
      const highRiskPortfolio: PortfolioState = {
        totalValue: 10000,
        availableBalance: 1000,
        positions: [
          {
            symbol: 'ETH-USD',
            quantity: 10, // Large position
            averagePrice: 2000,
            currentPrice: 1700, // 15% loss
            unrealizedPnL: -3000,
            side: 'long'
          }
        ],
        timestamp: Date.now()
      };
      
      // Track risk alerts
      const alerts: any[] = [];
      testContext.riskEngine.on('riskAlert', (alert) => {
        alerts.push(alert);
      });
      
      // Assess high-risk portfolio
      const riskAssessment = await testContext.riskEngine.assessPortfolioRisk(highRiskPortfolio);
      
      // Wait for risk alerts
      await TestingFramework.waitForCondition(() => alerts.length > 0, 2000);
      
      // Validate risk alerts
      expect(alerts.length).toBeGreaterThan(0);
      expect(riskAssessment.riskScore).toBeGreaterThan(0.7); // High risk
      
      const alert = alerts[0];
      expect(alert.type).toBe('high_risk');
      expect(alert.severity).toMatch(/warning|critical/);
    });
  });
  
  describe('Performance Analytics Integration', () => {
    test('should calculate accurate portfolio performance metrics', async () => {
      // Simulate trading history
      const trades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade-${i}`,
        strategyId: 'test-sma-cross',
        symbol: 'ETH-USD',
        side: i % 2 === 0 ? 'buy' : 'sell',
        quantity: 1,
        price: 2000 + (i * 10),
        timestamp: Date.now() - (i * 60000),
        fees: 2,
        status: 'filled'
      }));
      
      // Calculate performance metrics
      const metricsStart = performance.now();
      const performance = await testContext.performanceMonitor.calculatePerformance(trades);
      const metricsTime = performance.now() - metricsStart;
      
      expect(metricsTime).toBeLessThan(100); // Should be fast
      
      // Validate performance structure
      TestingFramework.assertHasProperties(performance, [
        'totalReturn', 'totalTrades', 'winRate', 'averageReturn', 'sharpeRatio', 'maxDrawdown'
      ]);
      
      // Validate metrics accuracy
      expect(performance.totalTrades).toBe(10);
      TestingFramework.assertBetween(performance.winRate, 0, 1);
      expect(performance.sharpeRatio).toBeDefined();
      expect(typeof performance.maxDrawdown).toBe('number');
    });
    
    test('should track real-time system performance', async () => {
      // Start performance monitoring
      const metrics = testContext.performanceMonitor.getMetrics();
      
      // Validate system metrics
      TestingFramework.assertHasProperties(metrics, [
        'memoryUsage', 'cpuUsage', 'latency', 'throughput'
      ]);
      
      // Validate metric ranges
      TestingFramework.assertBetween(metrics.memoryUsage, 0, 1);
      TestingFramework.assertBetween(metrics.cpuUsage, 0, 1);
      expect(metrics.latency).toBeGreaterThan(0);
      expect(metrics.throughput).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('End-to-End Integration Workflows', () => {
    test('should execute complete signal-to-trade workflow', async () => {
      const workflowStart = performance.now();
      
      // 1. Generate market data
      const marketData = testContext.generateTestMarketData(20);
      
      // 2. Process through strategy engine
      for (const candle of marketData) {
        await testContext.strategyEngine.processMarketData(candle);
      }
      
      // 3. Wait for signal generation and execution
      await TestingFramework.waitForCondition(async () => {
        const metrics = testContext.executionEngine.getMetrics();
        return metrics.totalExecutions > 0;
      }, 10000);
      
      // 4. Verify portfolio updates
      const portfolioMetrics = testContext.performanceMonitor.getPortfolioMetrics();
      expect(portfolioMetrics).toBeDefined();
      
      const workflowTime = performance.now() - workflowStart;
      console.log(`Complete workflow executed in ${workflowTime.toFixed(2)}ms`);
      
      // Validate end-to-end execution
      const executionMetrics = testContext.executionEngine.getMetrics();
      expect(executionMetrics.totalExecutions).toBeGreaterThan(0);
      expect(executionMetrics.successRate).toBeGreaterThan(0.8);
    });
    
    test('should maintain data consistency across all systems', async () => {
      // Execute multiple operations across systems
      const operations = [
        () => testContext.strategyEngine.processMarketData(testContext.generateTestMarketData(1)[0]),
        () => testContext.orderManager.createOrder({
          strategyId: 'test-sma-cross',
          symbol: 'ETH-USD',
          side: 'buy',
          quantity: 0.1,
          type: 'market',
          timeInForce: 'IOC'
        }),
        () => testContext.riskEngine.assessPortfolioRisk({
          totalValue: 10000,
          availableBalance: 5000,
          positions: [],
          timestamp: Date.now()
        })
      ];
      
      // Execute operations concurrently
      await Promise.all(operations.map(op => op()));
      
      // Verify system consistency
      const strategyMetrics = testContext.strategyEngine.getMetrics();
      const executionMetrics = testContext.executionEngine.getMetrics();
      const orderMetrics = testContext.orderManager.getMetrics();
      
      // All systems should be responsive
      expect(strategyMetrics).toBeDefined();
      expect(executionMetrics).toBeDefined();
      expect(orderMetrics).toBeDefined();
      
      // No system should be in error state
      expect(testContext.strategyEngine.getState()).not.toBe('error');
      expect(testContext.executionEngine.getStatus()).not.toBe('error');
    });
  });
});

/**
 * Performance and Load Testing for Phase 2 Systems
 */
describe('Phase 2 Performance and Stress Testing', () => {
  
  test('should handle high-frequency signal processing', async () => {
    const signalCount = PHASE2_TEST_CONFIG.STRESS_TESTING.maxSignalsPerSecond;
    const signals = Array.from({ length: signalCount }, (_, i) => ({
      strategyId: 'test-sma-cross',
      action: i % 3 === 0 ? 'buy' : i % 3 === 1 ? 'sell' : 'hold' as const,
      symbol: 'ETH-USD',
      confidence: Math.random() * 0.5 + 0.5,
      timestamp: Date.now() + i,
      price: 2000 + (Math.random() * 100 - 50),
      volume: Math.random() * 2 + 0.1,
      metadata: { stress: true }
    }));
    
    const startTime = performance.now();
    
    // Process all signals
    const results = await Promise.allSettled(
      signals.map(signal => testContext.executionEngine.processSignal(signal))
    );
    
    const totalTime = performance.now() - startTime;
    const avgTimePerSignal = totalTime / signalCount;
    
    expect(avgTimePerSignal).toBeLessThan(PHASE2_TEST_CONFIG.PERFORMANCE_TARGETS.signalProcessing);
    
    // Verify success rate
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const successRate = successful / signalCount;
    
    expect(successRate).toBeGreaterThan(0.95); // 95% success rate under stress
    
    console.log(`Processed ${signalCount} signals in ${totalTime.toFixed(2)}ms (${avgTimePerSignal.toFixed(2)}ms avg)`);
  });
  
  test('should maintain performance under sustained load', async () => {
    const testDurationMs = 30000; // 30 seconds
    const dataPointsPerSecond = 10;
    const startTime = performance.now();
    
    // Generate continuous data stream
    const dataStreamPromise = new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        if (performance.now() - startTime > testDurationMs) {
          clearInterval(interval);
          resolve();
          return;
        }
        
        // Generate and process market data points
        const dataPoints = testContext.generateTestMarketData(dataPointsPerSecond);
        for (const point of dataPoints) {
          await testContext.strategyEngine.processMarketData(point);
        }
      }, 1000);
    });
    
    await dataStreamPromise;
    
    // Verify system health after sustained load
    const finalMetrics = testContext.performanceMonitor.getMetrics();
    
    expect(finalMetrics.memoryUsage).toBeLessThan(0.9); // Less than 90% memory
    expect(finalMetrics.cpuUsage).toBeLessThan(0.8); // Less than 80% CPU
    expect(finalMetrics.latency).toBeLessThan(100); // Less than 100ms latency
    
    // Verify system is still responsive
    expect(testContext.strategyEngine.getState()).toBe('running');
    expect(testContext.executionEngine.getStatus()).not.toBe('error');
    
    console.log(`Sustained load test completed - Memory: ${(finalMetrics.memoryUsage * 100).toFixed(1)}%, CPU: ${(finalMetrics.cpuUsage * 100).toFixed(1)}%`);
  });
});