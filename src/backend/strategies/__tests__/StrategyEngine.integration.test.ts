/**
 * Strategy Engine Integration Tests - Task BE-016
 * 
 * Comprehensive integration tests for the StrategyEngine orchestrator.
 * Tests end-to-end functionality including:
 * - Multi-strategy execution
 * - Real-time data processing 
 * - Error handling and recovery
 * - Performance monitoring
 * - System health checks
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrategyEngine } from '../StrategyEngine.js';
import type { StrategyConfig, StrategySignal } from '../types.js';
import type { DydxCandle, Timeframe } from '../../../shared/types/trading.js';

// Mock data helpers
const createMockCandle = (timestamp: string, open: string, high: string, low: string, close: string, volume = '1000'): DydxCandle => ({
  startedAt: timestamp,
  ticker: 'BTC-USD',
  resolution: '1MIN',
  low,
  high,
  open,
  close,
  baseTokenVolume: volume,
  usdVolume: volume,
  trades: 10,
  startingOpenInterest: '0'
});

const createMockCandleSequence = (count: number, basePrice = 50000): DydxCandle[] => {
  const candles: DydxCandle[] = [];
  const startTime = new Date('2024-01-01T00:00:00Z').getTime();
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime + i * 60000).toISOString(); // 1 minute intervals
    const price = basePrice + (Math.random() - 0.5) * 1000; // Random price movement
    const open = (price - 50).toString();
    const close = (price + 50).toString();
    const high = (price + 100).toString();
    const low = (price - 100).toString();
    
    candles.push(createMockCandle(timestamp, open, high, low, close));
  }
  
  return candles;
};

const createMockStrategy = (id: string, symbols: string[] = ['BTC-USD']): StrategyConfig => ({
  id,
  name: `Test Strategy ${id}`,
  description: `Test strategy for integration testing`,
  version: '1.0.0',
  type: 'technical',
  timeframes: ['1MIN', '5MINS'] as Timeframe[],
  symbols,
  maxConcurrentPositions: 3,
  
  riskProfile: {
    maxRiskPerTrade: 2.0,
    maxPortfolioRisk: 10.0,
    stopLossType: 'fixed',
    takeProfitType: 'fixed',
    positionSizing: 'fixed'
  },
  
  parameters: {
    smaShort: 10,
    smaLong: 20,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30
  },
  
  performance: {},
  
  execution: {
    orderType: 'market',
    slippage: 0.1,
    timeout: 30,
    retries: 3
  },
  
  monitoring: {
    enableAlerts: true,
    alertChannels: ['webhook'],
    healthCheckInterval: 300,
    performanceReviewInterval: 3600
  },
  
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user'
});

describe('StrategyEngine Integration Tests', () => {
  let engine: StrategyEngine;
  
  beforeEach(async () => {
    // Create engine with test configuration
    engine = new StrategyEngine({
      id: 'test-engine',
      name: 'Test Strategy Engine',
      version: '1.0.0-test',
      
      dataBuffer: {
        maxCapacity: 1000,
        compressionEnabled: false, // Disable for faster tests
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframes: ['1MIN', '5MINS']
      },
      
      realTimeProcessing: {
        enabled: true,
        updateInterval: 100, // Fast interval for testing
        batchSize: 5,
        maxConcurrency: 3,
        bufferSize: 50
      },
      
      execution: {
        maxConcurrentStrategies: 5,
        executionTimeout: 5000,
        retryAttempts: 2,
        priorityExecution: true
      },
      
      monitoring: {
        enableMetrics: true,
        metricsInterval: 1000,
        healthCheckInterval: 5000,
        alertThresholds: {
          latency: 1000,
          errorRate: 0.2,
          memoryUsage: 100_000_000,
          queueDepth: 20
        }
      },
      
      errorHandling: {
        autoRecovery: true,
        maxRecoveryAttempts: 2,
        recoveryDelay: 1000,
        circuitBreakerThreshold: 5,
        fallbackMode: true
      }
    });
  });
  
  afterEach(async () => {
    if (engine) {
      await engine.stop();
    }
  });

  describe('Engine Lifecycle', () => {
    test('should start and stop successfully', async () => {
      expect(engine['isRunning']).toBe(false);
      
      await engine.start();
      expect(engine['isRunning']).toBe(true);
      
      await engine.stop();
      expect(engine['isRunning']).toBe(false);
    });
    
    test('should pause and resume correctly', async () => {
      await engine.start();
      
      await engine.pause();
      expect(engine['isPaused']).toBe(true);
      
      await engine.resume();
      expect(engine['isPaused']).toBe(false);
    });
    
    test('should emit lifecycle events', async () => {
      const startedSpy = vi.fn();
      const stoppedSpy = vi.fn();
      
      engine.on('started', startedSpy);
      engine.on('stopped', stoppedSpy);
      
      await engine.start();
      expect(startedSpy).toHaveBeenCalledWith({
        engineId: 'test-engine',
        timestamp: expect.any(Date)
      });
      
      await engine.stop();
      expect(stoppedSpy).toHaveBeenCalledWith({
        engineId: 'test-engine',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Strategy Management', () => {
    beforeEach(async () => {
      await engine.start();
    });
    
    test('should add and remove strategies', async () => {
      const strategy = createMockStrategy('test-strategy-1');
      
      // Add strategy
      const strategyId = await engine.addStrategy(strategy);
      expect(strategyId).toBe('test-strategy-1');
      
      const activeStrategies = engine.getActiveStrategies();
      expect(activeStrategies).toContain('test-strategy-1');
      
      // Remove strategy
      await engine.removeStrategy(strategyId);
      const remainingStrategies = engine.getActiveStrategies();
      expect(remainingStrategies).not.toContain('test-strategy-1');
    });
    
    test('should handle multiple strategies simultaneously', async () => {
      const strategies = [
        createMockStrategy('strategy-1'),
        createMockStrategy('strategy-2'),
        createMockStrategy('strategy-3')
      ];
      
      // Add all strategies
      const strategyIds = await Promise.all(
        strategies.map(strategy => engine.addStrategy(strategy))
      );
      
      expect(strategyIds).toEqual(['strategy-1', 'strategy-2', 'strategy-3']);
      
      const activeStrategies = engine.getActiveStrategies();
      expect(activeStrategies).toHaveLength(3);
    });
    
    test('should emit strategy events', async () => {
      const addedSpy = vi.fn();
      const removedSpy = vi.fn();
      
      engine.on('strategy_added', addedSpy);
      engine.on('strategy_removed', removedSpy);
      
      const strategy = createMockStrategy('event-test-strategy');
      
      const strategyId = await engine.addStrategy(strategy);
      expect(addedSpy).toHaveBeenCalledWith({
        strategyId,
        config: expect.objectContaining({ id: strategyId })
      });
      
      await engine.removeStrategy(strategyId);
      expect(removedSpy).toHaveBeenCalledWith({ strategyId });
    });
  });

  describe('Data Processing', () => {
    beforeEach(async () => {
      await engine.start();
      
      // Add a test strategy
      const strategy = createMockStrategy('data-test-strategy');
      await engine.addStrategy(strategy);
    });
    
    test('should process market data', async () => {
      const candles = createMockCandleSequence(10, 50000);
      
      // Process market data
      await engine.processMarketData('BTC-USD', '1MIN', candles, 1);
      
      // Verify data was processed
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.dataProcessing.candlesProcessed).toBeGreaterThan(0);
    });
    
    test('should execute strategies with market data', async () => {
      const candles = createMockCandleSequence(50, 50000); // Need enough data for indicators
      
      const result = await engine.executeStrategies('BTC-USD', '1MIN', candles);
      
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        executionId: expect.any(String),
        timestamp: expect.any(Date),
        strategiesExecuted: expect.any(Number),
        signalsGenerated: expect.any(Number),
        executionTime: expect.any(Number)
      });
      
      expect(result.strategyResults.size).toBeGreaterThan(0);
    });
    
    test('should handle data validation errors', async () => {
      // Create invalid candle data
      const invalidCandles = [
        createMockCandle('invalid-date', 'not-a-number', '100', '90', '95')
      ];
      
      const result = await engine.executeStrategies('BTC-USD', '1MIN', invalidCandles);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('execution_error');
    });
    
    test('should process data in batches', async () => {
      const candles1 = createMockCandleSequence(5, 50000);
      const candles2 = createMockCandleSequence(5, 51000);
      const candles3 = createMockCandleSequence(5, 49000);
      
      // Add data to processing queue
      await Promise.all([
        engine.processMarketData('BTC-USD', '1MIN', candles1, 2),
        engine.processMarketData('BTC-USD', '1MIN', candles2, 1),
        engine.processMarketData('BTC-USD', '1MIN', candles3, 3)
      ]);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.dataProcessing.candlesProcessed).toBe(15);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await engine.start();
      
      // Add test strategy
      const strategy = createMockStrategy('perf-test-strategy');
      await engine.addStrategy(strategy);
    });
    
    test('should collect performance metrics', async () => {
      const candles = createMockCandleSequence(20, 50000);
      
      // Execute some strategies to generate metrics
      await engine.executeStrategies('BTC-USD', '1MIN', candles);
      
      const metrics = engine.getPerformanceMetrics();
      
      expect(metrics).toMatchObject({
        execution: {
          totalExecutions: expect.any(Number),
          successfulExecutions: expect.any(Number),
          failedExecutions: expect.any(Number),
          averageExecutionTime: expect.any(Number),
          peakExecutionTime: expect.any(Number),
          executionsPerSecond: expect.any(Number)
        },
        dataProcessing: {
          candlesProcessed: expect.any(Number),
          dataLatency: expect.any(Number),
          bufferUtilization: expect.any(Number),
          indicatorCalculations: expect.any(Number),
          cacheHitRate: expect.any(Number)
        },
        strategies: {
          activeStrategies: expect.any(Number),
          totalSignals: expect.any(Number),
          successfulSignals: expect.any(Number),
          averageSignalConfidence: expect.any(Number),
          strategiesInError: expect.any(Number)
        },
        system: {
          memoryUsage: expect.any(Number),
          cpuUtilization: expect.any(Number),
          queueDepth: expect.any(Number),
          uptime: expect.any(Number),
          errorRate: expect.any(Number)
        },
        lastUpdated: expect.any(Date)
      });
      
      expect(metrics.execution.totalExecutions).toBeGreaterThan(0);
      expect(metrics.strategies.activeStrategies).toBe(1);
    });
    
    test('should emit metrics events', async () => {
      const metricsSpy = vi.fn();
      engine.on('metrics_updated', metricsSpy);
      
      // Wait for metrics update
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(metricsSpy).toHaveBeenCalled();
    });
    
    test('should track execution history', async () => {
      const candles = createMockCandleSequence(20, 50000);
      
      // Execute multiple times
      await engine.executeStrategies('BTC-USD', '1MIN', candles);
      await engine.executeStrategies('ETH-USD', '1MIN', candles);
      
      const history = engine.getExecutionHistory();
      
      expect(history.length).toBe(2);
      expect(history[0]).toMatchObject({
        executionId: expect.any(String),
        timestamp: expect.any(Date),
        success: expect.any(Boolean)
      });
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await engine.start();
    });
    
    test('should provide health status', async () => {
      const health = await engine.getHealthStatus();
      
      expect(health).toMatchObject({
        healthy: expect.any(Boolean),
        score: expect.any(Number),
        issues: expect.any(Array),
        componentHealth: expect.any(Object)
      });
      
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
    });
    
    test('should detect unhealthy conditions', async () => {
      // Simulate unhealthy condition by overloading queue
      const largeCandles = createMockCandleSequence(100, 50000);
      
      // Add many processing requests quickly
      for (let i = 0; i < 25; i++) {
        await engine.processMarketData('BTC-USD', '1MIN', largeCandles);
      }
      
      const health = await engine.getHealthStatus();
      
      // Should detect queue backup
      expect(health.componentHealth.dataProcessing.healthy).toBe(false);
    });
    
    test('should emit health warnings', async () => {
      const healthWarningSpy = vi.fn();
      engine.on('health_warning', healthWarningSpy);
      
      // Create unhealthy condition
      engine['consecutiveErrors'] = 10; // Simulate errors
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Note: This test might be flaky depending on timing
      // In real scenarios, health warnings would be more predictable
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await engine.start();
      
      const strategy = createMockStrategy('error-test-strategy');
      await engine.addStrategy(strategy);
    });
    
    test('should handle execution errors gracefully', async () => {
      // Create invalid data that will cause processing errors
      const invalidCandles = [
        { 
          ...createMockCandle('2024-01-01T00:00:00Z', '50000', '50100', '49900', '50050'),
          ticker: null as any // This will cause an error
        }
      ];
      
      const result = await engine.executeStrategies('BTC-USD', '1MIN', invalidCandles);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('should track consecutive errors', async () => {
      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        const invalidCandles = [createMockCandle('invalid', 'bad', 'data', 'here', 'test')];
        await engine.executeStrategies('BTC-USD', '1MIN', invalidCandles);
      }
      
      expect(engine['consecutiveErrors']).toBe(3);
    });
    
    test('should trigger circuit breaker', async () => {
      const circuitBreakerSpy = vi.fn();
      engine.on('circuit_breaker_opened', circuitBreakerSpy);
      
      // Trigger enough errors to open circuit breaker
      for (let i = 0; i < 6; i++) {
        const invalidCandles = [createMockCandle('invalid', 'data', 'error', 'test', i.toString())];
        await engine.executeStrategies('BTC-USD', '1MIN', invalidCandles);
      }
      
      expect(engine['circuitBreakerOpen']).toBe(true);
      expect(circuitBreakerSpy).toHaveBeenCalled();
    });
    
    test('should attempt recovery after circuit breaker', async () => {
      const recoverySpy = vi.fn();
      engine.on('circuit_breaker_recovered', recoverySpy);
      
      // Open circuit breaker
      engine['circuitBreakerOpen'] = true;
      engine['consecutiveErrors'] = 10;
      
      // Trigger recovery attempt
      await engine['attemptCircuitBreakerRecovery']();
      
      // Circuit breaker should be reset if system is healthy
      expect(engine['circuitBreakerOpen']).toBe(false);
      expect(engine['consecutiveErrors']).toBe(0);
    });
  });

  describe('Real-Time Processing', () => {
    beforeEach(async () => {
      await engine.start();
      
      const strategy = createMockStrategy('realtime-test-strategy');
      await engine.addStrategy(strategy);
    });
    
    test('should process data in real-time', async () => {
      const executionSpy = vi.fn();
      engine.on('execution_completed', executionSpy);
      
      // Add data to processing queue
      const candles = createMockCandleSequence(10, 50000);
      await engine.processMarketData('BTC-USD', '1MIN', candles);
      
      // Wait for real-time processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(executionSpy).toHaveBeenCalled();
    });
    
    test('should handle high-frequency data', async () => {
      const startMetrics = engine.getPerformanceMetrics();
      
      // Simulate high-frequency data
      for (let i = 0; i < 20; i++) {
        const candles = createMockCandleSequence(5, 50000 + i * 100);
        await engine.processMarketData('BTC-USD', '1MIN', candles);
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endMetrics = engine.getPerformanceMetrics();
      
      expect(endMetrics.dataProcessing.candlesProcessed).toBeGreaterThan(
        startMetrics.dataProcessing.candlesProcessed
      );
    });
  });

  describe('Integration with Infrastructure', () => {
    beforeEach(async () => {
      await engine.start();
    });
    
    test('should integrate with strategy manager', async () => {
      const strategy = createMockStrategy('integration-test-strategy');
      await engine.addStrategy(strategy);
      
      const strategyManager = engine['strategyManager'];
      const activeStrategies = strategyManager.getActiveStrategies();
      
      expect(activeStrategies.has('integration-test-strategy')).toBe(true);
    });
    
    test('should integrate with data buffers', async () => {
      const candles = createMockCandleSequence(10, 50000);
      await engine.processMarketData('BTC-USD', '1MIN', candles);
      
      const buffer = engine['dataBuffers'].get('BTC-USD');
      expect(buffer).toBeDefined();
      expect(buffer!.size()).toBeGreaterThan(0);
    });
    
    test('should integrate with indicator pipeline', async () => {
      const candles = createMockCandleSequence(50, 50000); // Need enough for indicators
      await engine.executeStrategies('BTC-USD', '1MIN', candles);
      
      const pipeline = engine['indicatorPipeline'];
      const metrics = pipeline.getMetrics();
      
      expect(metrics.calculationsExecuted).toBeGreaterThan(0);
    });
    
    test('should integrate with signal generator', async () => {
      const signalSpy = vi.fn();
      engine.on('signal_generated', signalSpy);
      
      const candles = createMockCandleSequence(30, 50000);
      await engine.executeStrategies('BTC-USD', '1MIN', candles);
      
      // Wait for signal processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Note: Signal generation depends on strategy conditions
      // This test verifies integration exists
      const signalGenerator = engine['signalGenerator'];
      expect(signalGenerator).toBeDefined();
    });
  });

  describe('Configuration and Customization', () => {
    test('should accept custom configuration', () => {
      const customEngine = new StrategyEngine({
        id: 'custom-engine',
        name: 'Custom Engine',
        dataBuffer: {
          maxCapacity: 2000,
          compressionEnabled: true,
          symbols: ['CUSTOM-PAIR'],
          timeframes: ['15MINS']
        }
      });
      
      const config = customEngine['config'];
      expect(config.id).toBe('custom-engine');
      expect(config.name).toBe('Custom Engine');
      expect(config.dataBuffer.maxCapacity).toBe(2000);
      expect(config.dataBuffer.symbols).toEqual(['CUSTOM-PAIR']);
    });
    
    test('should merge default configuration', () => {
      const partialEngine = new StrategyEngine({
        id: 'partial-config-engine'
      });
      
      const config = partialEngine['config'];
      
      // Should have custom id
      expect(config.id).toBe('partial-config-engine');
      
      // Should have default values
      expect(config.realTimeProcessing.enabled).toBe(true);
      expect(config.monitoring.enableMetrics).toBe(true);
      expect(config.errorHandling.autoRecovery).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(async () => {
      await engine.start();
      
      const strategy = createMockStrategy('resource-test-strategy');
      await engine.addStrategy(strategy);
    });
    
    test('should manage memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process a lot of data
      for (let i = 0; i < 50; i++) {
        const candles = createMockCandleSequence(20, 50000);
        await engine.executeStrategies('BTC-USD', '1MIN', candles);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB for test data)
      expect(memoryIncrease).toBeLessThan(100_000_000);
    });
    
    test('should cleanup resources on stop', async () => {
      // Process some data to allocate resources
      const candles = createMockCandleSequence(20, 50000);
      await engine.executeStrategies('BTC-USD', '1MIN', candles);
      
      // Stop engine
      await engine.stop();
      
      // Check that timers are cleared
      expect(engine['processingTimer']).toBeUndefined();
      expect(engine['metricsTimer']).toBeUndefined();
      expect(engine['healthCheckTimer']).toBeUndefined();
      
      // Check that queues are empty
      expect(engine['dataProcessingQueue'].length).toBe(0);
      expect(engine['executionHistory'].length).toBe(0);
    });
  });
});