/**
 * System Stress Testing Suite - Integration Task TE-002  
 * 
 * Comprehensive stress testing and load testing for the complete Phase 2 
 * algorithmic trading system. Tests system behavior under extreme conditions,
 * validates failover mechanisms, and ensures enterprise-grade reliability.
 * 
 * Stress Testing Areas:
 * - High-frequency data processing stress tests
 * - Concurrent strategy execution under load
 * - Memory pressure and garbage collection stress
 * - Order processing surge handling
 * - Network latency simulation and recovery
 * - Database connection pool exhaustion
 * - Error injection and system resilience
 * - Resource exhaustion scenarios
 * - Failover and disaster recovery
 * - System degradation under load
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { TestingFramework, MockDatabase } from '../TestingFramework.js';
import { MockDataGenerator } from '../MockDataGenerator.js';

// System Components for Stress Testing
import { StrategyEngine } from '../../backend/engine/StrategyEngine.js';
import { StrategyExecutionEngine } from '../../backend/execution/StrategyExecutionEngine.js';
import { OrderManager } from '../../backend/orders/OrderManager.js';
import { RiskEngine } from '../../backend/risk/RiskEngine.js';
import { PerformanceMonitor } from '../../backend/engine/PerformanceMonitor.js';
import { MarketDataBuffer } from '../../backend/data/MarketDataBuffer.js';
import { ProtectionMechanisms } from '../../backend/engine/ProtectionMechanisms.js';
import { EventManager } from '../../backend/engine/EventManager.js';

// Database and Repository Components
import { DatabaseManager } from '../../backend/database/DatabaseManager.js';
import { TradeRepository, StrategyRepository, MarketDataRepository } from '../../backend/repositories/index.js';

// Strategies for Stress Testing
import { SimpleMovingAverageCrossStrategy } from '../../backend/strategies/examples/SimpleMovingAverageCrossStrategy.js';

// Types
import type { OHLCV, StrategySignal, StrategyConfig, Trade, PortfolioState } from '../../shared/types/trading.js';

/**
 * Stress Test Configuration
 */
const STRESS_TEST_CONFIG = {
  // Stress Testing Limits
  LIMITS: {
    maxConcurrentStrategies: 50,        // Maximum concurrent strategies
    maxSignalRate: 1000,                // Maximum signals per second
    maxOrderRate: 5000,                 // Maximum orders per minute
    maxDataRate: 10000,                 // Maximum data points per second
    maxMemoryMB: 2000,                  // Maximum memory usage (2GB)
    maxDatabaseConnections: 100,        // Maximum DB connections
    maxErrorRate: 0.1,                  // Maximum 10% error rate
  },
  
  // Load Testing Parameters
  LOAD_TESTS: {
    shortBurstDuration: 30,             // 30 seconds short burst
    sustainedLoadDuration: 300,         // 5 minutes sustained load
    peakLoadDuration: 60,               // 1 minute peak load
    rampUpDuration: 30,                 // 30 seconds ramp up
    rampDownDuration: 30,               // 30 seconds ramp down
  },
  
  // Failure Injection
  FAILURE_SCENARIOS: {
    networkLatency: [10, 100, 1000, 5000], // Network latency scenarios (ms)
    errorRates: [0.01, 0.05, 0.1, 0.25],   // Error rate scenarios
    memoryPressure: [0.7, 0.8, 0.9, 0.95], // Memory pressure levels
    cpuPressure: [0.7, 0.8, 0.9, 0.95],    // CPU pressure levels
  },
  
  // Recovery Testing
  RECOVERY: {
    maxRecoveryTime: 10000,             // 10 seconds max recovery time
    maxDowntime: 5000,                  // 5 seconds max downtime
    backoffMultiplier: 2,               // Exponential backoff multiplier
    maxRetryAttempts: 5,                // Maximum retry attempts
  }
} as const;

/**
 * System Stress Test Orchestrator
 */
class SystemStressTestOrchestrator {
  private components: {
    strategyEngine: StrategyEngine;
    executionEngine: StrategyExecutionEngine;
    orderManager: OrderManager;
    riskEngine: RiskEngine;
    performanceMonitor: PerformanceMonitor;
    marketDataBuffer: MarketDataBuffer;
    protectionMechanisms: ProtectionMechanisms;
    eventManager: EventManager;
    database: MockDatabase;
  };
  
  private metrics: {
    startTime: number;
    peakMemoryMB: number;
    peakCpuUsage: number;
    totalSignalsProcessed: number;
    totalOrdersCreated: number;
    totalErrorsEncountered: number;
    downtimeMs: number;
    recoveryEvents: number;
  };
  
  private isRunning = false;
  private abortController = new AbortController();
  
  constructor() {
    this.resetMetrics();
  }
  
  private resetMetrics(): void {
    this.metrics = {
      startTime: 0,
      peakMemoryMB: 0,
      peakCpuUsage: 0,
      totalSignalsProcessed: 0,
      totalOrdersCreated: 0,
      totalErrorsEncountered: 0,
      downtimeMs: 0,
      recoveryEvents: 0
    };
  }
  
  async initialize(): Promise<void> {
    this.components = {
      database: TestingFramework.createMockDatabase(),
      
      strategyEngine: new StrategyEngine({
        maxConcurrentStrategies: STRESS_TEST_CONFIG.LIMITS.maxConcurrentStrategies,
        maxSignalsPerSecond: STRESS_TEST_CONFIG.LIMITS.maxSignalRate,
        defaultExecutionTimeout: 10000,
        maxMemoryUsage: STRESS_TEST_CONFIG.LIMITS.maxMemoryMB,
        maxCpuUsage: 95,
        maxLatency: 1000,
        enableProfiling: true,
        enableHealthChecks: true,
        healthCheckInterval: 1000
      }),
      
      executionEngine: new StrategyExecutionEngine({
        mode: 'paper',
        maxConcurrentExecutions: 100,
        executionTimeout: 10000,
        orderTimeout: 5000,
        enableMetrics: true,
        memoryLimit: 1000,
        enableRecovery: true,
        recoveryAttempts: STRESS_TEST_CONFIG.RECOVERY.maxRetryAttempts
      }),
      
      orderManager: new OrderManager({
        maxPendingOrders: 50000,
        orderTimeout: 60000,
        enablePartialFills: true,
        enableSlippage: true,
        defaultSlippage: 0.001
      }),
      
      riskEngine: new RiskEngine({
        maxDrawdown: 0.30,
        maxPositionSize: 0.20,
        stopLossPercentage: 0.10,
        dailyLossLimit: 10000,
        enableRealTimeMonitoring: true,
        riskCheckInterval: 500,
        enableVaRCalculation: true
      }),
      
      performanceMonitor: new PerformanceMonitor({
        metricsInterval: 100,
        enableDetailedMetrics: true,
        retentionPeriod: 60 * 60 * 1000,
        alertThresholds: {
          memoryUsage: 0.9,
          cpuUsage: 0.9,
          latency: 500
        }
      }),
      
      marketDataBuffer: new MarketDataBuffer({
        maxSize: 500000,
        enableCompression: true,
        compressionRatio: 0.05
      }),
      
      protectionMechanisms: new ProtectionMechanisms({
        maxDrawdown: 0.30,
        stopLossPercentage: 0.10,
        dailyLossLimit: 10000,
        cooldownPeriod: 60000,
        enableLowProfitFilter: true
      }),
      
      eventManager: new EventManager({
        maxEventHistory: 100000,
        enableEventPersistence: true,
        batchSize: 1000,
        flushInterval: 5000
      })
    };
    
    // Initialize all components
    await this.components.database.connect();
    
    await Promise.all([
      this.components.strategyEngine.initialize(),
      this.components.executionEngine.initialize(),
      this.components.orderManager.initialize(),
      this.components.riskEngine.initialize(),
      this.components.performanceMonitor.start(),
      this.components.marketDataBuffer.initialize(),
      this.components.eventManager.initialize()
    ]);
    
    // Setup event monitoring
    this.setupEventMonitoring();
  }
  
  get testComponents() {
    return this.components;
  }
  
  private setupEventMonitoring(): void {
    // Monitor system events for stress test metrics
    this.components.strategyEngine.on('signal', () => {
      this.metrics.totalSignalsProcessed++;
    });
    
    this.components.orderManager.on('orderCreated', () => {
      this.metrics.totalOrdersCreated++;
    });
    
    this.components.eventManager.on('error', () => {
      this.metrics.totalErrorsEncountered++;
    });
    
    this.components.eventManager.on('recovery', () => {
      this.metrics.recoveryEvents++;
    });
  }
  
  async loadStressTestStrategies(count: number): Promise<void> {
    const strategies = [];
    const symbols = ['ETH-USD', 'BTC-USD', 'AVAX-USD', 'SOL-USD', 'ADA-USD'];
    const timeframes = ['1m', '5m', '15m'];
    
    for (let i = 0; i < count; i++) {
      const config: StrategyConfig = {
        id: `stress-test-strategy-${i}`,
        name: `Stress Test Strategy ${i}`,
        type: 'trend_following',
        symbol: symbols[i % symbols.length],
        timeframe: timeframes[i % timeframes.length],
        parameters: {
          fastPeriod: 5 + (i % 15),
          slowPeriod: 20 + (i % 30),
          minVolume: 100 + (i * 10)
        },
        riskParameters: {
          maxPositionSize: 0.01 + (i * 0.001),
          stopLossPercentage: 0.03 + (i * 0.0005)
        },
        isActive: true
      };
      
      const strategy = new SimpleMovingAverageCrossStrategy(config);
      await this.components.strategyEngine.loadStrategy(strategy);
      strategies.push(strategy);
    }
  }
  
  async generateHighFrequencyData(
    ratePerSecond: number, 
    durationMs: number,
    symbols: string[] = ['ETH-USD', 'BTC-USD']
  ): Promise<void> {
    const intervalMs = 1000 / ratePerSecond;
    const totalPoints = Math.floor(durationMs / intervalMs);
    const pointsPerSymbol = Math.floor(totalPoints / symbols.length);
    
    for (const symbol of symbols) {
      const data = MockDataGenerator.generateOHLCVSeries(pointsPerSymbol, {
        symbol,
        startPrice: symbol === 'ETH-USD' ? 2000 : 40000,
        volatility: 0.02,
        trend: 0.0005
      });
      
      // Stream data at specified rate
      for (let i = 0; i < data.length && !this.abortController.signal.aborted; i++) {
        const startTime = performance.now();
        
        await Promise.all([
          this.components.marketDataBuffer.addData(data[i]),
          this.components.strategyEngine.processMarketData(data[i])
        ]);
        
        // Maintain timing
        const elapsed = performance.now() - startTime;
        const delay = Math.max(0, intervalMs - elapsed);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }
  
  async injectNetworkLatency(latencyMs: number): Promise<void> {
    // Inject artificial network latency into database operations
    const originalQuery = this.components.database.query;
    this.components.database.query = async function<T>(...args: any[]): Promise<T[]> {
      await new Promise(resolve => setTimeout(resolve, latencyMs));
      return originalQuery.apply(this, args);
    };
  }
  
  async injectRandomErrors(errorRate: number): Promise<void> {
    // Inject random errors into order processing
    const originalCreateOrder = this.components.orderManager.createOrder;
    this.components.orderManager.createOrder = async function(request: any): Promise<string> {
      if (Math.random() < errorRate) {
        throw new Error('Injected random error for stress testing');
      }
      return originalCreateOrder.call(this, request);
    };
  }
  
  async simulateMemoryPressure(targetUsageRatio: number): Promise<() => void> {
    const currentMemory = process.memoryUsage();
    const targetMemory = currentMemory.heapTotal * targetUsageRatio;
    const additionalMemory = Math.max(0, targetMemory - currentMemory.heapUsed);
    
    // Allocate memory to simulate pressure
    const memoryBlocks: any[] = [];
    const blockSize = 1024 * 1024; // 1MB blocks
    const blocksNeeded = Math.floor(additionalMemory / blockSize);
    
    for (let i = 0; i < blocksNeeded; i++) {
      memoryBlocks.push(new Array(blockSize / 8).fill(i)); // 8 bytes per number
    }
    
    // Return cleanup function
    return () => {
      memoryBlocks.length = 0;
      if (global.gc) {
        global.gc();
      }
    };
  }
  
  async monitorSystemHealth(): Promise<{
    memoryUsageMB: number;
    cpuUsage: number;
    isHealthy: boolean;
    errors: string[];
  }> {
    const memory = process.memoryUsage();
    const systemMetrics = this.components.performanceMonitor.getMetrics();
    
    const memoryUsageMB = memory.heapUsed / 1024 / 1024;
    this.metrics.peakMemoryMB = Math.max(this.metrics.peakMemoryMB, memoryUsageMB);
    this.metrics.peakCpuUsage = Math.max(this.metrics.peakCpuUsage, systemMetrics.cpuUsage || 0);
    
    const errors: string[] = [];
    let isHealthy = true;
    
    // Check memory threshold
    if (memoryUsageMB > STRESS_TEST_CONFIG.LIMITS.maxMemoryMB) {
      errors.push(`Memory usage exceeded limit: ${memoryUsageMB}MB > ${STRESS_TEST_CONFIG.LIMITS.maxMemoryMB}MB`);
      isHealthy = false;
    }
    
    // Check CPU threshold
    if (systemMetrics.cpuUsage && systemMetrics.cpuUsage > 0.95) {
      errors.push(`CPU usage exceeded limit: ${(systemMetrics.cpuUsage * 100).toFixed(1)}%`);
      isHealthy = false;
    }
    
    // Check component health
    const engineState = this.components.strategyEngine.getState();
    if (engineState === 'error') {
      errors.push('Strategy engine in error state');
      isHealthy = false;
    }
    
    return {
      memoryUsageMB,
      cpuUsage: systemMetrics.cpuUsage || 0,
      isHealthy,
      errors
    };
  }
  
  async cleanup(): Promise<void> {
    this.abortController.abort();
    
    await Promise.all([
      this.components.performanceMonitor?.stop(),
      this.components.riskEngine?.shutdown(),
      this.components.orderManager?.shutdown(),
      this.components.executionEngine?.shutdown(),
      this.components.strategyEngine?.shutdown(),
      this.components.marketDataBuffer?.shutdown(),
      this.components.eventManager?.shutdown(),
      this.components.database?.disconnect()
    ]);
  }
  
  getStressTestResults(): typeof this.metrics {
    return { ...this.metrics };
  }
}

// Global stress test orchestrator
let stressOrchestrator: SystemStressTestOrchestrator;

beforeAll(async () => {
  stressOrchestrator = new SystemStressTestOrchestrator();
  await stressOrchestrator.initialize();
}, 60000); // 60 second timeout

afterAll(async () => {
  if (stressOrchestrator) {
    await stressOrchestrator.cleanup();
  }
});

describe('System Stress Testing Suite', () => {
  
  describe('High-Frequency Data Processing Stress', () => {
    test('should handle extreme data ingestion rates', async () => {
      const targetRate = 5000; // 5000 data points per second
      const testDuration = 10000; // 10 seconds
      
      await stressOrchestrator.loadStressTestStrategies(5);
      
      const startTime = performance.now();
      
      // Generate high-frequency data stream
      await stressOrchestrator.generateHighFrequencyData(
        targetRate,
        testDuration,
        ['ETH-USD', 'BTC-USD', 'AVAX-USD']
      );
      
      const endTime = performance.now();
      const actualDuration = endTime - startTime;
      
      // Verify system handled the load
      const health = await stressOrchestrator.monitorSystemHealth();
      const results = stressOrchestrator.getStressTestResults();
      
      // System should remain operational
      expect(health.isHealthy).toBe(true);
      expect(results.totalSignalsProcessed).toBeGreaterThan(0);
      
      // Performance should be reasonable
      expect(actualDuration).toBeLessThan(testDuration * 2); // Allow 2x tolerance
      
      console.log(`High-Frequency Stress Test Results:
        Target rate: ${targetRate} points/sec
        Duration: ${actualDuration.toFixed(0)}ms
        Signals processed: ${results.totalSignalsProcessed}
        Peak memory: ${health.memoryUsageMB.toFixed(1)}MB
        Peak CPU: ${(health.cpuUsage * 100).toFixed(1)}%`);
    });
    
    test('should handle concurrent strategy processing under load', async () => {
      const strategiesCount = 20;
      const dataRate = 100; // Per second per strategy
      const testDuration = 30000; // 30 seconds
      
      // Load many concurrent strategies
      await stressOrchestrator.loadStressTestStrategies(strategiesCount);
      
      const symbols = Array.from({ length: strategiesCount }, (_, i) => `STRESS-${i}`);
      
      // Generate concurrent data streams
      const concurrentStreams = symbols.map(symbol => 
        stressOrchestrator.generateHighFrequencyData(dataRate, testDuration, [symbol])
      );
      
      const startTime = performance.now();
      await Promise.all(concurrentStreams);
      const endTime = performance.now();
      
      // Verify concurrent processing
      const health = await stressOrchestrator.monitorSystemHealth();
      const results = stressOrchestrator.getStressTestResults();
      
      expect(health.isHealthy).toBe(true);
      expect(results.totalSignalsProcessed).toBeGreaterThan(strategiesCount * 10);
      
      console.log(`Concurrent Processing Stress Test:
        Strategies: ${strategiesCount}
        Duration: ${(endTime - startTime).toFixed(0)}ms
        Total signals: ${results.totalSignalsProcessed}
        Peak memory: ${health.memoryUsageMB.toFixed(1)}MB`);
    });
  });
  
  describe('Memory Pressure and Garbage Collection Stress', () => {
    test('should handle high memory pressure gracefully', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate high memory pressure (80% of heap)
      const cleanup = await stressOrchestrator.simulateMemoryPressure(0.8);
      
      try {
        // Continue normal operations under memory pressure
        await stressOrchestrator.loadStressTestStrategies(10);
        
        // Generate some load
        await stressOrchestrator.generateHighFrequencyData(100, 10000, ['ETH-USD']);
        
        // Monitor system behavior
        const health = await stressOrchestrator.monitorSystemHealth();
        
        // System should still be operational
        expect(health.isHealthy).toBe(true);
        expect(health.memoryUsageMB).toBeLessThan(STRESS_TEST_CONFIG.LIMITS.maxMemoryMB);
        
        console.log(`Memory Pressure Test:
          Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB
          Peak memory: ${health.memoryUsageMB.toFixed(1)}MB
          System healthy: ${health.isHealthy}`);
          
      } finally {
        cleanup();
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      console.log(`Memory after cleanup: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    });
    
    test('should handle garbage collection pauses without system degradation', async () => {
      // Generate large amounts of temporary objects
      const gcStressTest = async () => {
        for (let i = 0; i < 1000; i++) {
          // Create temporary data structures that will trigger GC
          const largeArray = new Array(10000).fill(0).map((_, idx) => ({
            id: idx,
            data: new Array(100).fill(Math.random()),
            timestamp: Date.now()
          }));
          
          // Process some data
          await stressOrchestrator.generateHighFrequencyData(50, 100, ['ETH-USD']);
          
          // Clear large array to trigger GC
          largeArray.length = 0;
          
          if (i % 100 === 0 && global.gc) {
            global.gc(); // Force GC periodically
          }
        }
      };
      
      const startTime = performance.now();
      await gcStressTest();
      const endTime = performance.now();
      
      const health = await stressOrchestrator.monitorSystemHealth();
      
      // Verify system remained stable during GC stress
      expect(health.isHealthy).toBe(true);
      expect(endTime - startTime).toBeLessThan(60000); // Should complete within 60 seconds
      
      console.log(`GC Stress Test completed in ${(endTime - startTime).toFixed(0)}ms`);
    });
  });
  
  describe('Order Processing Surge Handling', () => {
    test('should handle order processing surges without degradation', async () => {
      const ordersPerBatch = 1000;
      const batchCount = 10;
      const totalOrders = ordersPerBatch * batchCount;
      
      // Generate order surge
      const orderBatches = Array.from({ length: batchCount }, (_, batchIdx) =>
        Array.from({ length: ordersPerBatch }, (_, orderIdx) => ({
          strategyId: `stress-strategy-${orderIdx % 10}`,
          symbol: 'ETH-USD',
          side: orderIdx % 2 === 0 ? 'buy' : 'sell' as const,
          quantity: Math.random() * 2 + 0.1,
          type: 'market' as const,
          timeInForce: 'IOC' as const
        }))
      );
      
      // Process order batches concurrently
      const startTime = performance.now();
      
      const batchPromises = orderBatches.map(async (batch, batchIdx) => {
        // Stagger batch starts to simulate realistic surge
        await new Promise(resolve => setTimeout(resolve, batchIdx * 100));
        
        const batchResults = await Promise.allSettled(
          batch.map(order => 
            stressOrchestrator.testComponents.orderManager.createOrder(order)
          )
        );
        
        return batchResults.filter(r => r.status === 'fulfilled').length;
      });
      
      const batchResults = await Promise.all(batchPromises);
      const endTime = performance.now();
      
      const totalSuccessful = batchResults.reduce((sum, count) => sum + count, 0);
      const successRate = totalSuccessful / totalOrders;
      const avgOrdersPerSecond = totalSuccessful / ((endTime - startTime) / 1000);
      
      // Validate surge handling
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate minimum
      expect(avgOrdersPerSecond).toBeGreaterThan(100); // At least 100 orders/sec
      
      const health = await stressOrchestrator.monitorSystemHealth();
      expect(health.isHealthy).toBe(true);
      
      console.log(`Order Surge Test Results:
        Total orders: ${totalOrders}
        Successful: ${totalSuccessful} (${(successRate * 100).toFixed(1)}%)
        Throughput: ${avgOrdersPerSecond.toFixed(1)} orders/sec
        Duration: ${(endTime - startTime).toFixed(0)}ms`);
    });
  });
  
  describe('Network Latency and Recovery Testing', () => {
    test('should handle increasing network latency gracefully', async () => {
      const latencyLevels = STRESS_TEST_CONFIG.FAILURE_SCENARIOS.networkLatency;
      
      for (const latency of latencyLevels) {
        console.log(`Testing with ${latency}ms network latency...`);
        
        // Inject network latency
        await stressOrchestrator.injectNetworkLatency(latency);
        
        // Perform operations under latency
        const operationStart = performance.now();
        
        await stressOrchestrator.generateHighFrequencyData(50, 5000, ['ETH-USD']);
        
        const operationEnd = performance.now();
        const operationTime = operationEnd - operationStart;
        
        // Verify system adapts to latency
        const health = await stressOrchestrator.monitorSystemHealth();
        expect(health.isHealthy).toBe(true);
        
        // Performance should degrade gracefully with latency
        console.log(`  Latency ${latency}ms: Operation time ${operationTime.toFixed(0)}ms`);
      }
    });
    
    test('should recover from network failures', async () => {
      // Simulate network failures by injecting high error rates
      const errorRates = [0.1, 0.25, 0.5]; // 10%, 25%, 50% error rates
      
      for (const errorRate of errorRates) {
        console.log(`Testing with ${(errorRate * 100).toFixed(0)}% error rate...`);
        
        // Inject errors
        await stressOrchestrator.injectRandomErrors(errorRate);
        
        // Attempt operations with error injection
        const orders = Array.from({ length: 100 }, (_, i) => ({
          strategyId: 'recovery-test',
          symbol: 'ETH-USD',
          side: i % 2 === 0 ? 'buy' : 'sell' as const,
          quantity: 0.1,
          type: 'market' as const,
          timeInForce: 'IOC' as const
        }));
        
        const results = await Promise.allSettled(
          orders.map(order => 
            stressOrchestrator.testComponents.orderManager.createOrder(order)
          )
        );
        
        const successfulOrders = results.filter(r => r.status === 'fulfilled').length;
        const actualSuccessRate = successfulOrders / orders.length;
        const expectedSuccessRate = 1 - errorRate;
        
        // Allow some tolerance for recovery mechanisms
        expect(actualSuccessRate).toBeGreaterThan(expectedSuccessRate * 0.8);
        
        console.log(`  Error rate ${(errorRate * 100).toFixed(0)}%: Success rate ${(actualSuccessRate * 100).toFixed(1)}%`);
      }
    });
  });
  
  describe('System Resilience and Failover', () => {
    test('should maintain operation during component failures', async () => {
      // Simulate strategy engine failure
      const originalProcessData = stressOrchestrator.testComponents.strategyEngine.processMarketData;
      let failureInjected = false;
      
      // Inject intermittent failures
      stressOrchestrator.testComponents.strategyEngine.processMarketData = async function(data: OHLCV) {
        if (!failureInjected && Math.random() < 0.3) {
          failureInjected = true;
          throw new Error('Simulated strategy engine failure');
        }
        return originalProcessData.call(this, data);
      };
      
      // Continue operations with failures
      const resilenceStart = performance.now();
      
      try {
        await stressOrchestrator.generateHighFrequencyData(100, 10000, ['ETH-USD']);
        
        // System should continue operating
        const health = await stressOrchestrator.monitorSystemHealth();
        const results = stressOrchestrator.getStressTestResults();
        
        // Some operations should succeed despite failures
        expect(results.totalSignalsProcessed).toBeGreaterThan(0);
        expect(results.recoveryEvents).toBeGreaterThan(0);
        
        console.log(`Resilience Test Results:
          Recovery events: ${results.recoveryEvents}
          Total errors: ${results.totalErrorsEncountered}
          Signals processed: ${results.totalSignalsProcessed}`);
          
      } finally {
        // Restore original function
        stressOrchestrator.testComponents.strategyEngine.processMarketData = originalProcessData;
      }
    });
    
    test('should handle cascading failures with graceful degradation', async () => {
      // Inject failures in multiple components
      const originalFunctions: any = {};
      
      // Inject order manager failures
      originalFunctions.createOrder = stressOrchestrator.testComponents.orderManager.createOrder;
      stressOrchestrator.testComponents.orderManager.createOrder = async function(request: any) {
        if (Math.random() < 0.2) {
          throw new Error('Order manager failure');
        }
        return originalFunctions.createOrder.call(this, request);
      };
      
      // Inject risk engine failures  
      originalFunctions.assessRisk = stressOrchestrator.testComponents.riskEngine.assessPortfolioRisk;
      stressOrchestrator.testComponents.riskEngine.assessPortfolioRisk = async function(portfolio: any) {
        if (Math.random() < 0.15) {
          throw new Error('Risk engine failure');
        }
        return originalFunctions.assessRisk.call(this, portfolio);
      };
      
      try {
        // Load strategies and generate activity
        await stressOrchestrator.loadStressTestStrategies(5);
        await stressOrchestrator.generateHighFrequencyData(200, 15000, ['ETH-USD', 'BTC-USD']);
        
        // Monitor system behavior under cascading failures
        const health = await stressOrchestrator.monitorSystemHealth();
        const results = stressOrchestrator.getStressTestResults();
        
        // System should demonstrate graceful degradation
        expect(results.totalErrorsEncountered).toBeGreaterThan(0);
        expect(results.recoveryEvents).toBeGreaterThan(0);
        expect(health.isHealthy).toBe(true); // Overall system should remain healthy
        
        console.log(`Cascading Failure Test:
          Total errors: ${results.totalErrorsEncountered}
          Recovery events: ${results.recoveryEvents}
          System health: ${health.isHealthy ? 'Healthy' : 'Unhealthy'}`);
          
      } finally {
        // Restore original functions
        stressOrchestrator.testComponents.orderManager.createOrder = originalFunctions.createOrder;
        stressOrchestrator.testComponents.riskEngine.assessPortfolioRisk = originalFunctions.assessRisk;
      }
    });
  });
  
  describe('Sustained Load Testing', () => {
    test('should handle sustained high load over extended periods', async () => {
      const testDuration = STRESS_TEST_CONFIG.LOAD_TESTS.sustainedLoadDuration * 1000; // Convert to ms
      const strategiesCount = 15;
      const dataRate = 200; // Data points per second
      
      await stressOrchestrator.loadStressTestStrategies(strategiesCount);
      
      const startTime = performance.now();
      const endTime = startTime + testDuration;
      
      // Monitor system health during sustained load
      const healthMetrics: Array<{
        timestamp: number;
        memoryMB: number;
        cpuUsage: number;
        isHealthy: boolean;
      }> = [];
      
      const monitoringPromise = (async () => {
        while (performance.now() < endTime) {
          const health = await stressOrchestrator.monitorSystemHealth();
          healthMetrics.push({
            timestamp: performance.now() - startTime,
            memoryMB: health.memoryUsageMB,
            cpuUsage: health.cpuUsage,
            isHealthy: health.isHealthy
          });
          
          await new Promise(resolve => setTimeout(resolve, 5000)); // Monitor every 5 seconds
        }
      })();
      
      // Generate sustained load
      const loadPromise = (async () => {
        while (performance.now() < endTime) {
          await stressOrchestrator.generateHighFrequencyData(dataRate, 5000, ['ETH-USD', 'BTC-USD']);
        }
      })();
      
      // Wait for both monitoring and load generation
      await Promise.all([monitoringPromise, loadPromise]);
      
      const actualDuration = performance.now() - startTime;
      const results = stressOrchestrator.getStressTestResults();
      
      // Analyze sustained load results
      const avgMemory = healthMetrics.reduce((sum, m) => sum + m.memoryMB, 0) / healthMetrics.length;
      const maxMemory = Math.max(...healthMetrics.map(m => m.memoryMB));
      const healthyPercentage = healthMetrics.filter(m => m.isHealthy).length / healthMetrics.length;
      
      // Validate sustained load performance
      expect(healthyPercentage).toBeGreaterThan(0.95); // 95% uptime
      expect(maxMemory).toBeLessThan(STRESS_TEST_CONFIG.LIMITS.maxMemoryMB);
      expect(results.totalSignalsProcessed).toBeGreaterThan(1000); // Should process significant signals
      
      console.log(`Sustained Load Test Results (${(actualDuration / 1000).toFixed(0)}s):
        Strategies: ${strategiesCount}
        Avg Memory: ${avgMemory.toFixed(1)}MB
        Max Memory: ${maxMemory.toFixed(1)}MB  
        Uptime: ${(healthyPercentage * 100).toFixed(1)}%
        Total Signals: ${results.totalSignalsProcessed}
        Total Orders: ${results.totalOrdersCreated}
        Total Errors: ${results.totalErrorsEncountered}`);
    }, testDuration + 30000); // Add 30s buffer to test timeout
  });
});

/**
 * System Recovery and Disaster Recovery Testing
 */
describe('System Recovery and Disaster Recovery Testing', () => {
  test('should recover from complete system restart', async () => {
    // Simulate system state before shutdown
    await stressOrchestrator.loadStressTestStrategies(5);
    await stressOrchestrator.generateHighFrequencyData(100, 5000, ['ETH-USD']);
    
    const preShutdownResults = stressOrchestrator.getStressTestResults();
    
    // Simulate system shutdown and restart
    await stressOrchestrator.cleanup();
    
    // Reinitialize system
    stressOrchestrator = new SystemStressTestOrchestrator();
    await stressOrchestrator.initialize();
    
    // Verify system recovery
    const health = await stressOrchestrator.monitorSystemHealth();
    expect(health.isHealthy).toBe(true);
    
    // System should be able to resume operations
    await stressOrchestrator.loadStressTestStrategies(5);
    await stressOrchestrator.generateHighFrequencyData(50, 2000, ['ETH-USD']);
    
    const postRecoveryResults = stressOrchestrator.getStressTestResults();
    expect(postRecoveryResults.totalSignalsProcessed).toBeGreaterThan(0);
    
    console.log(`System Recovery Test:
      Pre-shutdown signals: ${preShutdownResults.totalSignalsProcessed}
      Post-recovery signals: ${postRecoveryResults.totalSignalsProcessed}
      Recovery successful: ${health.isHealthy}`);
  });
});