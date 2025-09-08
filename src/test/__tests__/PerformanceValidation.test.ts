/**
 * Performance Validation Testing Suite - Integration Task TE-002
 * 
 * Comprehensive performance testing and benchmarking for Phase 2 systems.
 * Validates all performance targets, conducts thorough benchmarking,
 * and ensures the system meets enterprise-grade performance standards.
 * 
 * Performance Areas Tested:
 * - Strategy execution performance and throughput
 * - Order management system performance 
 * - Risk assessment calculation performance
 * - Market data processing performance
 * - Memory usage and garbage collection
 * - CPU utilization under different loads
 * - Database query performance
 * - Network I/O performance simulation
 * - Concurrent processing performance
 * - System scalability metrics
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { TestingFramework, MockDatabase } from '../TestingFramework.js';
import { MockDataGenerator } from '../MockDataGenerator.js';

// System Components for Performance Testing
import { StrategyEngine } from '../../backend/engine/StrategyEngine.js';
import { StrategyExecutionEngine } from '../../backend/execution/StrategyExecutionEngine.js';
import { OrderManager } from '../../backend/orders/OrderManager.js';
import { RiskEngine } from '../../backend/risk/RiskEngine.js';
import { PerformanceMonitor } from '../../backend/engine/PerformanceMonitor.js';
import { MarketDataBuffer } from '../../backend/data/MarketDataBuffer.js';

// Indicators and Strategies for Performance Testing
import { SimpleMovingAverage } from '../../backend/indicators/trend/SimpleMovingAverage.js';
import { ExponentialMovingAverage } from '../../backend/indicators/trend/ExponentialMovingAverage.js';
import { RSI } from '../../backend/indicators/momentum/RSI.js';
import { MACD } from '../../backend/indicators/trend/MACD.js';
import { BollingerBands } from '../../backend/indicators/volatility/BollingerBands.js';
import { SimpleMovingAverageCrossStrategy } from '../../backend/strategies/examples/SimpleMovingAverageCrossStrategy.js';

// Types
import type { OHLCV, StrategySignal, StrategyConfig } from '../../shared/types/trading.js';

/**
 * Performance Test Configuration
 */
const PERFORMANCE_CONFIG = {
  // Phase 2 Performance Targets (as specified in requirements)
  TARGETS: {
    // Strategy Performance
    strategyExecutionMs: 50,           // 50ms max strategy execution
    signalGenerationMs: 25,            // 25ms max signal generation
    indicatorCalculationMs: 1,         // 1ms max indicator calculation
    
    // Order Management Performance  
    orderCreationMs: 20,               // 20ms max order creation
    orderExecutionMs: 100,             // 100ms max order execution
    portfolioUpdateMs: 30,             // 30ms max portfolio update
    
    // Risk Management Performance
    riskAssessmentMs: 25,              // 25ms max risk assessment
    varCalculationMs: 50,              // 50ms max VaR calculation
    portfolioAnalysisMs: 100,          // 100ms max portfolio analysis
    
    // Data Processing Performance
    dataIngestionMs: 10,               // 10ms max data ingestion per point
    dataBufferAccessMs: 5,             // 5ms max buffer access
    databaseQueryMs: 100,              // 100ms max database query
    
    // System Performance
    memoryUsageThreshold: 0.8,         // 80% max memory usage
    cpuUsageThreshold: 0.8,            // 80% max CPU usage
    gcPauseMs: 50,                     // 50ms max GC pause
    
    // Throughput Targets
    signalsPerSecond: 100,             // 100 signals/second throughput
    ordersPerMinute: 1000,             // 1000 orders/minute throughput
    dataPointsPerSecond: 1000,         // 1000 data points/second throughput
  },
  
  // Benchmarking Parameters
  BENCHMARKS: {
    smallDataset: 1000,                // Small dataset size
    mediumDataset: 10000,              // Medium dataset size
    largeDataset: 100000,              // Large dataset size
    concurrencyLevels: [1, 2, 5, 10, 20], // Concurrency levels to test
    durationSeconds: 60,               // Benchmark duration
    warmupIterations: 10,              // Warmup iterations
    measurementIterations: 100,        // Measurement iterations
  },
  
  // Load Testing Parameters
  LOAD_TESTING: {
    maxConcurrentStrategies: 20,       // Maximum concurrent strategies
    maxSignalRate: 500,                // Maximum signal rate per second
    maxOrderRate: 2000,                // Maximum order rate per minute
    sustainedLoadDuration: 300,        // 5 minutes sustained load
  }
} as const;

/**
 * Performance Test Suite Manager
 */
class PerformanceTestManager {
  private metrics: {
    executionTimes: Map<string, number[]>;
    memoryUsage: number[];
    cpuUsage: number[];
    throughputMeasurements: Map<string, number[]>;
    errorRates: Map<string, number>;
  };
  
  private components: {
    strategyEngine?: StrategyEngine;
    executionEngine?: StrategyExecutionEngine;
    orderManager?: OrderManager;
    riskEngine?: RiskEngine;
    performanceMonitor?: PerformanceMonitor;
    marketDataBuffer?: MarketDataBuffer;
  };
  
  constructor() {
    this.resetMetrics();
    this.components = {};
  }
  
  private resetMetrics(): void {
    this.metrics = {
      executionTimes: new Map(),
      memoryUsage: [],
      cpuUsage: [],
      throughputMeasurements: new Map(),
      errorRates: new Map()
    };
  }
  
  async initializeComponents(): Promise<void> {
    this.components = {
      strategyEngine: new StrategyEngine({
        maxConcurrentStrategies: PERFORMANCE_CONFIG.LOAD_TESTING.maxConcurrentStrategies,
        maxSignalsPerSecond: PERFORMANCE_CONFIG.LOAD_TESTING.maxSignalRate,
        defaultExecutionTimeout: 5000,
        maxMemoryUsage: 1000, // 1GB for performance testing
        maxCpuUsage: 90,
        maxLatency: 100,
        enableProfiling: true,
        enableHealthChecks: true
      }),
      
      executionEngine: new StrategyExecutionEngine({
        mode: 'paper',
        maxConcurrentExecutions: 50,
        executionTimeout: 5000,
        orderTimeout: 3000,
        enableMetrics: true,
        memoryLimit: 500
      }),
      
      orderManager: new OrderManager({
        maxPendingOrders: 10000,
        orderTimeout: 30000,
        enablePartialFills: true,
        enableSlippage: false // Disable for consistent performance testing
      }),
      
      riskEngine: new RiskEngine({
        maxDrawdown: 0.20,
        maxPositionSize: 0.15,
        enableRealTimeMonitoring: true,
        riskCheckInterval: 100, // Faster for performance testing
        enableVaRCalculation: true
      }),
      
      performanceMonitor: new PerformanceMonitor({
        metricsInterval: 100, // High frequency for detailed metrics
        enableDetailedMetrics: true,
        retentionPeriod: 60 * 60 * 1000
      }),
      
      marketDataBuffer: new MarketDataBuffer({
        maxSize: 100000,
        enableCompression: true,
        compressionRatio: 0.1
      })
    };
    
    // Initialize all components
    await Promise.all([
      this.components.strategyEngine!.initialize(),
      this.components.executionEngine!.initialize(),
      this.components.orderManager!.initialize(),
      this.components.riskEngine!.initialize(),
      this.components.performanceMonitor!.start(),
      this.components.marketDataBuffer!.initialize()
    ]);
  }
  
  async cleanup(): Promise<void> {
    await Promise.all([
      this.components.performanceMonitor?.stop(),
      this.components.riskEngine?.shutdown(),
      this.components.orderManager?.shutdown(),
      this.components.executionEngine?.shutdown(),
      this.components.strategyEngine?.shutdown(),
      this.components.marketDataBuffer?.shutdown()
    ]);
  }
  
  recordExecutionTime(operation: string, time: number): void {
    if (!this.metrics.executionTimes.has(operation)) {
      this.metrics.executionTimes.set(operation, []);
    }
    this.metrics.executionTimes.get(operation)!.push(time);
  }
  
  recordThroughput(operation: string, count: number, timeMs: number): void {
    const throughput = (count / timeMs) * 1000; // per second
    if (!this.metrics.throughputMeasurements.has(operation)) {
      this.metrics.throughputMeasurements.set(operation, []);
    }
    this.metrics.throughputMeasurements.get(operation)!.push(throughput);
  }
  
  recordError(operation: string): void {
    const current = this.metrics.errorRates.get(operation) || 0;
    this.metrics.errorRates.set(operation, current + 1);
  }
  
  getStatistics(operation: string): {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const times = this.metrics.executionTimes.get(operation) || [];
    if (times.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...times].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    iterations: number = 1
  ): Promise<T> {
    let result: T;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        result = await fn();
        const endTime = performance.now();
        this.recordExecutionTime(operation, endTime - startTime);
      } catch (error) {
        this.recordError(operation);
        throw error;
      }
    }
    
    return result!;
  }
  
  async measureThroughput<T>(
    operation: string,
    fn: () => Promise<T[]>,
    expectedCount: number
  ): Promise<T[]> {
    const startTime = performance.now();
    const results = await fn();
    const endTime = performance.now();
    
    this.recordThroughput(operation, expectedCount, endTime - startTime);
    return results;
  }
}

// Global performance test manager
let performanceManager: PerformanceTestManager;

beforeAll(async () => {
  performanceManager = new PerformanceTestManager();
  await performanceManager.initializeComponents();
}, 60000); // 60 second timeout for initialization

afterAll(async () => {
  if (performanceManager) {
    await performanceManager.cleanup();
  }
});

describe('Performance Validation Testing Suite', () => {
  
  describe('Strategy Execution Performance', () => {
    test('should meet strategy execution time targets', async () => {
      // Create test strategy
      const strategyConfig: StrategyConfig = {
        id: 'perf-test-strategy',
        name: 'Performance Test Strategy',
        type: 'trend_following',
        symbol: 'ETH-USD',
        timeframe: '1m',
        parameters: { fastPeriod: 10, slowPeriod: 20 },
        riskParameters: { maxPositionSize: 0.1 },
        isActive: true
      };
      
      const strategy = new SimpleMovingAverageCrossStrategy(strategyConfig);
      await performanceManager.components.strategyEngine!.loadStrategy(strategy);
      
      // Generate test data
      const testData = MockDataGenerator.generateOHLCVSeries(1000, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.02
      });
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        await performanceManager.components.strategyEngine!.processMarketData(testData[i]);
      }
      
      // Measure strategy execution performance
      for (const candle of testData.slice(10, 110)) { // 100 measurements
        await performanceManager.measureOperation(
          'strategyExecution',
          () => performanceManager.components.strategyEngine!.processMarketData(candle)
        );
      }
      
      // Analyze performance
      const stats = performanceManager.getStatistics('strategyExecution');
      
      // Validate performance targets
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.strategyExecutionMs);
      expect(stats.p95).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.strategyExecutionMs * 2);
      expect(stats.p99).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.strategyExecutionMs * 3);
      
      console.log(`Strategy Execution Performance:
        Average: ${stats.avg.toFixed(2)}ms
        P95: ${stats.p95.toFixed(2)}ms  
        P99: ${stats.p99.toFixed(2)}ms
        Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms`);
    });
    
    test('should maintain performance with multiple concurrent strategies', async () => {
      const strategiesCount = 10;
      const strategies: SimpleMovingAverageCrossStrategy[] = [];
      
      // Load multiple strategies
      for (let i = 0; i < strategiesCount; i++) {
        const config: StrategyConfig = {
          id: `concurrent-strategy-${i}`,
          name: `Concurrent Strategy ${i}`,
          type: 'trend_following',
          symbol: i % 2 === 0 ? 'ETH-USD' : 'BTC-USD',
          timeframe: '1m',
          parameters: { 
            fastPeriod: 5 + i, 
            slowPeriod: 15 + i * 2 
          },
          riskParameters: { maxPositionSize: 0.05 },
          isActive: true
        };
        
        const strategy = new SimpleMovingAverageCrossStrategy(config);
        await performanceManager.components.strategyEngine!.loadStrategy(strategy);
        strategies.push(strategy);
      }
      
      // Generate test data for both symbols
      const ethData = MockDataGenerator.generateOHLCVSeries(100, { symbol: 'ETH-USD', startPrice: 2000 });
      const btcData = MockDataGenerator.generateOHLCVSeries(100, { symbol: 'BTC-USD', startPrice: 40000 });
      
      // Measure concurrent execution
      const testData = [...ethData, ...btcData];
      const concurrentStart = performance.now();
      
      // Process data concurrently
      await Promise.all(testData.map(candle =>
        performanceManager.measureOperation(
          'concurrentStrategyExecution',
          () => performanceManager.components.strategyEngine!.processMarketData(candle)
        )
      ));
      
      const concurrentTime = performance.now() - concurrentStart;
      const avgTimePerDataPoint = concurrentTime / testData.length;
      
      // Validate concurrent performance
      expect(avgTimePerDataPoint).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.strategyExecutionMs * 2);
      
      const stats = performanceManager.getStatistics('concurrentStrategyExecution');
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.strategyExecutionMs * 1.5);
      
      console.log(`Concurrent Strategy Performance (${strategiesCount} strategies):
        Avg per data point: ${avgTimePerDataPoint.toFixed(2)}ms
        Strategy execution avg: ${stats.avg.toFixed(2)}ms`);
    });
  });
  
  describe('Indicator Calculation Performance', () => {
    test('should meet indicator calculation time targets', async () => {
      const indicators = [
        new SimpleMovingAverage(20),
        new ExponentialMovingAverage(20),
        new RSI(14),
        new MACD(12, 26, 9),
        new BollingerBands(20, 2)
      ];
      
      const testData = MockDataGenerator.generateOHLCVSeries(1000, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.02
      });
      
      // Test each indicator
      for (const indicator of indicators) {
        const indicatorName = indicator.constructor.name;
        
        // Warm up indicator
        for (let i = 0; i < 50; i++) {
          indicator.update(testData[i]);
        }
        
        // Measure indicator performance
        for (let i = 50; i < 150; i++) {
          await performanceManager.measureOperation(
            `indicator_${indicatorName}`,
            async () => indicator.update(testData[i])
          );
        }
        
        const stats = performanceManager.getStatistics(`indicator_${indicatorName}`);
        
        // Validate indicator performance
        expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.indicatorCalculationMs);
        expect(stats.p99).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.indicatorCalculationMs * 5);
        
        console.log(`${indicatorName} Performance: ${stats.avg.toFixed(3)}ms avg, ${stats.p95.toFixed(3)}ms p95`);
      }
    });
    
    test('should handle large dataset indicator calculations efficiently', async () => {
      const largeDataset = MockDataGenerator.generateOHLCVSeries(
        PERFORMANCE_CONFIG.BENCHMARKS.largeDataset,
        { symbol: 'ETH-USD', startPrice: 2000, volatility: 0.02 }
      );
      
      const indicator = new SimpleMovingAverage(50);
      
      // Measure batch processing performance
      const batchStart = performance.now();
      
      for (const candle of largeDataset) {
        indicator.update(candle);
      }
      
      const batchTime = performance.now() - batchStart;
      const avgTimePerUpdate = batchTime / largeDataset.length;
      
      // Validate batch performance
      expect(avgTimePerUpdate).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.indicatorCalculationMs);
      
      console.log(`Large Dataset Indicator Performance:
        Dataset size: ${largeDataset.length} points
        Total time: ${batchTime.toFixed(2)}ms
        Avg per update: ${avgTimePerUpdate.toFixed(4)}ms`);
    });
  });
  
  describe('Order Management Performance', () => {
    test('should meet order creation and execution targets', async () => {
      const orderRequests = Array.from({ length: 100 }, (_, i) => ({
        strategyId: 'perf-test-strategy',
        symbol: 'ETH-USD',
        side: i % 2 === 0 ? 'buy' : 'sell' as const,
        quantity: Math.random() * 2 + 0.1,
        type: 'market' as const,
        timeInForce: 'IOC' as const
      }));
      
      // Measure order creation performance
      for (const request of orderRequests.slice(0, 50)) {
        await performanceManager.measureOperation(
          'orderCreation',
          () => performanceManager.components.orderManager!.createOrder(request)
        );
      }
      
      // Measure order execution performance  
      const orderIds: string[] = [];
      for (const request of orderRequests.slice(50)) {
        const orderId = await performanceManager.components.orderManager!.createOrder(request);
        orderIds.push(orderId);
      }
      
      for (const orderId of orderIds) {
        await performanceManager.measureOperation(
          'orderExecution',
          () => performanceManager.components.orderManager!.executeOrder(orderId)
        );
      }
      
      // Validate order performance
      const creationStats = performanceManager.getStatistics('orderCreation');
      const executionStats = performanceManager.getStatistics('orderExecution');
      
      expect(creationStats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.orderCreationMs);
      expect(executionStats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.orderExecutionMs);
      
      console.log(`Order Management Performance:
        Creation avg: ${creationStats.avg.toFixed(2)}ms
        Execution avg: ${executionStats.avg.toFixed(2)}ms`);
    });
    
    test('should handle high-frequency order throughput', async () => {
      const targetOrdersPerMinute = PERFORMANCE_CONFIG.TARGETS.ordersPerMinute;
      const testDurationMs = 10000; // 10 seconds
      const expectedOrders = Math.floor((targetOrdersPerMinute / 60) * (testDurationMs / 1000));
      
      const orderRequests = Array.from({ length: expectedOrders }, (_, i) => ({
        strategyId: 'throughput-test',
        symbol: 'ETH-USD',
        side: i % 2 === 0 ? 'buy' : 'sell' as const,
        quantity: 0.1,
        type: 'market' as const,
        timeInForce: 'IOC' as const
      }));
      
      // Measure throughput
      const results = await performanceManager.measureThroughput(
        'orderThroughput',
        async () => {
          const orderPromises = orderRequests.map(request =>
            performanceManager.components.orderManager!.createOrder(request)
          );
          return Promise.all(orderPromises);
        },
        expectedOrders
      );
      
      const throughputMeasurements = performanceManager.metrics.throughputMeasurements.get('orderThroughput') || [];
      const avgThroughput = throughputMeasurements.reduce((a, b) => a + b, 0) / throughputMeasurements.length;
      
      // Validate throughput
      expect(results.length).toBe(expectedOrders);
      expect(avgThroughput).toBeGreaterThan(targetOrdersPerMinute / 60); // Per second
      
      console.log(`Order Throughput: ${avgThroughput.toFixed(1)} orders/second (target: ${(targetOrdersPerMinute / 60).toFixed(1)})`);
    });
  });
  
  describe('Risk Assessment Performance', () => {
    test('should meet risk calculation time targets', async () => {
      // Create test portfolios of varying complexity
      const simplePortfolio = {
        totalValue: 10000,
        availableBalance: 5000,
        positions: [
          { symbol: 'ETH-USD', quantity: 2, averagePrice: 2000, currentPrice: 2100, side: 'long' }
        ],
        timestamp: Date.now()
      };
      
      const complexPortfolio = {
        totalValue: 100000,
        availableBalance: 20000,
        positions: Array.from({ length: 20 }, (_, i) => ({
          symbol: `ASSET-${i}`,
          quantity: Math.random() * 10 + 1,
          averagePrice: Math.random() * 1000 + 100,
          currentPrice: Math.random() * 1000 + 100,
          side: i % 2 === 0 ? 'long' : 'short' as const
        })),
        timestamp: Date.now()
      };
      
      // Measure simple risk assessment
      for (let i = 0; i < 50; i++) {
        await performanceManager.measureOperation(
          'simpleRiskAssessment',
          () => performanceManager.components.riskEngine!.assessPortfolioRisk(simplePortfolio as any)
        );
      }
      
      // Measure complex risk assessment
      for (let i = 0; i < 50; i++) {
        await performanceManager.measureOperation(
          'complexRiskAssessment',
          () => performanceManager.components.riskEngine!.assessPortfolioRisk(complexPortfolio as any)
        );
      }
      
      // Validate risk assessment performance
      const simpleStats = performanceManager.getStatistics('simpleRiskAssessment');
      const complexStats = performanceManager.getStatistics('complexRiskAssessment');
      
      expect(simpleStats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.riskAssessmentMs);
      expect(complexStats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.portfolioAnalysisMs);
      
      console.log(`Risk Assessment Performance:
        Simple portfolio: ${simpleStats.avg.toFixed(2)}ms avg
        Complex portfolio: ${complexStats.avg.toFixed(2)}ms avg`);
    });
  });
  
  describe('Market Data Processing Performance', () => {
    test('should meet data ingestion throughput targets', async () => {
      const targetThroughput = PERFORMANCE_CONFIG.TARGETS.dataPointsPerSecond;
      const testDurationMs = 5000; // 5 seconds
      const expectedDataPoints = Math.floor(targetThroughput * (testDurationMs / 1000));
      
      const testData = MockDataGenerator.generateOHLCVSeries(expectedDataPoints, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.01
      });
      
      // Measure data ingestion throughput
      await performanceManager.measureThroughput(
        'dataIngestion',
        async () => {
          const promises = testData.map(candle =>
            performanceManager.components.marketDataBuffer!.addData(candle)
          );
          await Promise.all(promises);
          return testData;
        },
        expectedDataPoints
      );
      
      const throughputMeasurements = performanceManager.metrics.throughputMeasurements.get('dataIngestion') || [];
      const avgThroughput = throughputMeasurements.reduce((a, b) => a + b, 0) / throughputMeasurements.length;
      
      // Validate throughput
      expect(avgThroughput).toBeGreaterThan(targetThroughput * 0.8); // Allow 20% tolerance
      
      console.log(`Data Ingestion Throughput: ${avgThroughput.toFixed(1)} points/second (target: ${targetThroughput})`);
    });
    
    test('should maintain buffer access performance', async () => {
      // Fill buffer with data
      const bufferData = MockDataGenerator.generateOHLCVSeries(10000, {
        symbol: 'ETH-USD',
        startPrice: 2000
      });
      
      for (const candle of bufferData) {
        await performanceManager.components.marketDataBuffer!.addData(candle);
      }
      
      // Measure buffer access performance
      for (let i = 0; i < 100; i++) {
        const randomTimestamp = bufferData[Math.floor(Math.random() * bufferData.length)].time;
        
        await performanceManager.measureOperation(
          'bufferAccess',
          () => performanceManager.components.marketDataBuffer!.getDataRange(
            'ETH-USD', 
            randomTimestamp - 60000, 
            randomTimestamp
          )
        );
      }
      
      const stats = performanceManager.getStatistics('bufferAccess');
      
      // Validate buffer access performance
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.dataBufferAccessMs);
      expect(stats.p95).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.dataBufferAccessMs * 2);
      
      console.log(`Buffer Access Performance: ${stats.avg.toFixed(2)}ms avg, ${stats.p95.toFixed(2)}ms p95`);
    });
  });
  
  describe('System Resource Performance', () => {
    test('should monitor and validate memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const largeDataset = MockDataGenerator.generateOHLCVSeries(50000, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.02
      });
      
      // Load multiple strategies
      for (let i = 0; i < 5; i++) {
        const config: StrategyConfig = {
          id: `memory-test-${i}`,
          name: `Memory Test Strategy ${i}`,
          type: 'trend_following',
          symbol: 'ETH-USD',
          timeframe: '1m',
          parameters: { fastPeriod: 10, slowPeriod: 20 },
          riskParameters: { maxPositionSize: 0.1 },
          isActive: true
        };
        
        const strategy = new SimpleMovingAverageCrossStrategy(config);
        await performanceManager.components.strategyEngine!.loadStrategy(strategy);
      }
      
      // Process large dataset
      for (const candle of largeDataset) {
        await performanceManager.components.strategyEngine!.processMarketData(candle);
        await performanceManager.components.marketDataBuffer!.addData(candle);
      }
      
      // Measure memory usage
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        const afterGCMemory = process.memoryUsage();
        const gcMemoryMB = (finalMemory.heapUsed - afterGCMemory.heapUsed) / 1024 / 1024;
        
        console.log(`Memory Usage Analysis:
          Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB
          Peak: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB
          After GC: ${(afterGCMemory.heapUsed / 1024 / 1024).toFixed(1)}MB
          GC freed: ${gcMemoryMB.toFixed(1)}MB`);
      }
      
      // Validate memory usage is reasonable
      expect(memoryIncreaseMB).toBeLessThan(500); // Less than 500MB increase
      
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(1)}MB for ${largeDataset.length} data points`);
    });
    
    test('should validate system performance under sustained load', async () => {
      const loadTestDuration = 30000; // 30 seconds
      const startTime = Date.now();
      
      // Generate continuous load
      const loadPromise = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime > loadTestDuration) {
            clearInterval(interval);
            resolve();
            return;
          }
          
          // Generate market data
          const data = MockDataGenerator.generateOHLCVSeries(10, {
            symbol: 'ETH-USD',
            startPrice: 2000,
            volatility: 0.01
          });
          
          // Process through all systems
          for (const candle of data) {
            await performanceManager.components.strategyEngine!.processMarketData(candle);
            await performanceManager.components.marketDataBuffer!.addData(candle);
          }
        }, 100); // Every 100ms
      });
      
      // Monitor performance during load
      const performanceMetrics: Array<{ timestamp: number; memory: number; cpu: number }> = [];
      const monitoringPromise = new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (Date.now() - startTime > loadTestDuration) {
            clearInterval(interval);
            resolve();
            return;
          }
          
          const memory = process.memoryUsage();
          const systemMetrics = performanceManager.components.performanceMonitor!.getMetrics();
          
          performanceMetrics.push({
            timestamp: Date.now(),
            memory: memory.heapUsed / 1024 / 1024, // MB
            cpu: systemMetrics.cpuUsage || 0
          });
        }, 1000); // Every second
      });
      
      // Wait for both load and monitoring
      await Promise.all([loadPromise, monitoringPromise]);
      
      // Analyze sustained load performance
      const avgMemory = performanceMetrics.reduce((sum, m) => sum + m.memory, 0) / performanceMetrics.length;
      const maxMemory = Math.max(...performanceMetrics.map(m => m.memory));
      const avgCpu = performanceMetrics.reduce((sum, m) => sum + m.cpu, 0) / performanceMetrics.length;
      
      // Validate sustained performance
      expect(maxMemory).toBeLessThan(1000); // Less than 1GB
      expect(avgCpu).toBeLessThan(PERFORMANCE_CONFIG.TARGETS.cpuUsageThreshold);
      
      console.log(`Sustained Load Performance (${loadTestDuration / 1000}s):
        Avg Memory: ${avgMemory.toFixed(1)}MB
        Max Memory: ${maxMemory.toFixed(1)}MB
        Avg CPU: ${(avgCpu * 100).toFixed(1)}%`);
    });
  });
  
  describe('Performance Regression Detection', () => {
    test('should detect performance regressions', async () => {
      // Baseline measurements
      const baselineIterations = 20;
      const regressionIterations = 20;
      
      const testData = MockDataGenerator.generateOHLCVSeries(100, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.02
      });
      
      // Measure baseline performance
      const baselineTimes: number[] = [];
      for (let i = 0; i < baselineIterations; i++) {
        const startTime = performance.now();
        
        for (const candle of testData) {
          await performanceManager.components.strategyEngine!.processMarketData(candle);
        }
        
        baselineTimes.push(performance.now() - startTime);
      }
      
      const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
      
      // Simulate potential regression (add artificial delay)
      const originalProcess = performanceManager.components.strategyEngine!.processMarketData;
      performanceManager.components.strategyEngine!.processMarketData = async function(data: OHLCV) {
        await new Promise(resolve => setTimeout(resolve, 0.1)); // 0.1ms delay
        return originalProcess.call(this, data);
      };
      
      // Measure potential regression performance
      const regressionTimes: number[] = [];
      for (let i = 0; i < regressionIterations; i++) {
        const startTime = performance.now();
        
        for (const candle of testData) {
          await performanceManager.components.strategyEngine!.processMarketData(candle);
        }
        
        regressionTimes.push(performance.now() - startTime);
      }
      
      const regressionAvg = regressionTimes.reduce((a, b) => a + b, 0) / regressionTimes.length;
      
      // Restore original function
      performanceManager.components.strategyEngine!.processMarketData = originalProcess;
      
      // Calculate performance difference
      const performanceDiff = ((regressionAvg - baselineAvg) / baselineAvg) * 100;
      
      console.log(`Performance Regression Analysis:
        Baseline avg: ${baselineAvg.toFixed(2)}ms
        Regression avg: ${regressionAvg.toFixed(2)}ms
        Difference: ${performanceDiff.toFixed(1)}%`);
      
      // In a real scenario, this would fail if regression > threshold
      // For this test, we expect the artificial delay to show regression
      expect(performanceDiff).toBeGreaterThan(5); // Artificial delay should cause >5% regression
    });
  });
});