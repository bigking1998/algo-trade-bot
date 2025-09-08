/**
 * Strategy Execution Engine Integration Tests
 * 
 * Comprehensive integration tests for the strategy execution engine,
 * including performance benchmarks and system validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrategyExecutionEngine } from '../StrategyExecutionEngine.js';
import { ExecutionOrchestrator } from '../ExecutionOrchestrator.js';
import { OrderExecutor } from '../OrderExecutor.js';
import type { TradeDecision } from '../../engine/StrategyEngine.js';
import type { StrategySignal } from '../../strategies/types.js';

// Mock dependencies
const mockStrategyEngine = {
  on: vi.fn(),
  emit: vi.fn(),
  getStatus: vi.fn().mockReturnValue({ state: 'running', metrics: {}, strategies: [] })
};

const mockRiskController = {
  on: vi.fn(),
  emit: vi.fn(),
  getCurrentRiskMetrics: vi.fn().mockResolvedValue({
    totalValue: 100000,
    dailyPnL: 0,
    maxDrawdown: 0,
    positionsCount: 0
  }),
  validateSignals: vi.fn().mockResolvedValue([]),
  assessSignalRisk: vi.fn().mockResolvedValue({ approved: true, score: 50 }),
  calculatePositionRisk: vi.fn().mockResolvedValue({ riskScore: 30 })
};

const mockProtectionMechanisms = {
  on: vi.fn(),
  emit: vi.fn(),
  evaluateSignal: vi.fn().mockResolvedValue({
    allowed: true,
    reasons: [],
    adjustments: {},
    protectionLevel: 'standard',
    timestamp: new Date()
  })
};

const mockTradeRepository = {
  create: vi.fn(),
  findBy: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

const mockPositionRepository = {
  create: vi.fn(),
  findBy: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

describe('StrategyExecutionEngine Integration Tests', () => {
  let executionEngine: StrategyExecutionEngine;
  
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create execution engine
    executionEngine = new StrategyExecutionEngine(
      {
        maxLatency: 50,
        maxConcurrentExecutions: 10,
        maxQueueSize: 1000,
        defaultMode: 'paper',
        enableCircuitBreaker: true
      },
      {
        strategyEngine: mockStrategyEngine as any,
        riskController: mockRiskController as any,
        protectionMechanisms: mockProtectionMechanisms as any,
        tradeRepository: mockTradeRepository as any,
        positionRepository: mockPositionRepository as any
      }
    );
    
    await executionEngine.initialize();
  });
  
  afterEach(async () => {
    await executionEngine.stop();
  });

  describe('System Integration', () => {
    it('should initialize all components successfully', async () => {
      const status = executionEngine.getStatus();
      
      expect(status.status).toBe('idle');
      expect(status.metrics).toBeDefined();
      expect(status.queueSize).toBe(0);
      expect(status.activeExecutions).toBe(0);
      expect(status.circuitBreakerState).toBeDefined();
    });

    it('should start and stop execution engine', async () => {
      await executionEngine.start();
      expect(executionEngine.getStatus().status).toBe('executing');
      
      await executionEngine.pause();
      expect(executionEngine.getStatus().status).toBe('paused');
      
      await executionEngine.resume();
      expect(executionEngine.getStatus().status).toBe('executing');
      
      await executionEngine.stop();
      expect(executionEngine.getStatus().status).toBe('stopped');
    });
  });

  describe('Trade Decision Execution', () => {
    const mockTradeDecision: TradeDecision = {
      id: 'test_decision_1',
      symbol: 'BTC-USD',
      action: 'buy',
      quantity: 1.0,
      confidence: 85,
      priority: 2,
      signals: [{
        id: 'signal_1',
        strategyId: 'test_strategy',
        symbol: 'BTC-USD',
        type: 'BUY',
        confidence: 85,
        timestamp: new Date(),
        quantity: 1.0,
        entryPrice: 50000,
        conditions: ['RSI oversold', 'Moving average crossover'],
        metadata: {}
      }],
      reasoning: ['Technical indicators align for bullish move'],
      riskAssessment: {
        score: 30,
        factors: ['Low volatility', 'Good liquidity'],
        approved: true
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 300000) // 5 minutes
    };

    it('should execute trade decision successfully in paper mode', async () => {
      await executionEngine.start();
      
      const result = await executionEngine.executeTradeDecision(mockTradeDecision, {
        mode: 'paper',
        priority: 'normal'
      });
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.fillPrice).toBeGreaterThan(0);
      expect(result.fillQuantity).toBe(mockTradeDecision.quantity);
      expect(result.executionTime).toBeLessThan(1000); // Should be fast in paper mode
      expect(result.metadata.mode).toBe('paper');
    });

    it('should handle trade decision rejection due to protection mechanisms', async () => {
      // Mock protection mechanism to reject
      mockProtectionMechanisms.evaluateSignal.mockResolvedValueOnce({
        allowed: false,
        reasons: ['Daily drawdown limit exceeded'],
        adjustments: {},
        protectionLevel: 'aggressive',
        timestamp: new Date()
      });
      
      await executionEngine.start();
      
      const result = await executionEngine.executeTradeDecision(mockTradeDecision);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Protection mechanisms blocked execution');
    });

    it('should handle trade decision rejection due to risk limits', async () => {
      // Mock risk controller to reject
      mockRiskController.calculatePositionRisk.mockResolvedValueOnce({
        riskScore: 95 // High risk
      });
      
      await executionEngine.start();
      
      const result = await executionEngine.executeTradeDecision(mockTradeDecision);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Risk validation failed');
    });

    it('should handle queue capacity limits', async () => {
      // Create engine with small queue
      const smallQueueEngine = new StrategyExecutionEngine(
        { maxQueueSize: 1 },
        {
          strategyEngine: mockStrategyEngine as any,
          riskController: mockRiskController as any,
          protectionMechanisms: mockProtectionMechanisms as any,
          tradeRepository: mockTradeRepository as any,
          positionRepository: mockPositionRepository as any
        }
      );
      
      await smallQueueEngine.initialize();
      await smallQueueEngine.start();
      
      try {
        // Fill the queue
        const promise1 = smallQueueEngine.executeTradeDecision(mockTradeDecision);
        const promise2 = smallQueueEngine.executeTradeDecision(mockTradeDecision);
        
        const results = await Promise.all([promise1, promise2]);
        
        // One should succeed, one should fail due to capacity
        const failures = results.filter(r => !r.success);
        expect(failures.length).toBeGreaterThan(0);
        expect(failures[0].error?.message).toContain('queue full');
        
      } finally {
        await smallQueueEngine.stop();
      }
    });
  });

  describe('Batch Execution', () => {
    it('should execute multiple trade decisions in batch', async () => {
      const tradeDecisions: TradeDecision[] = Array.from({ length: 5 }, (_, i) => ({
        id: `test_decision_${i + 1}`,
        symbol: `SYMBOL-${i + 1}`,
        action: 'buy' as const,
        quantity: 1.0,
        confidence: 80,
        priority: 2,
        signals: [{
          id: `signal_${i + 1}`,
          strategyId: 'test_strategy',
          symbol: `SYMBOL-${i + 1}`,
          type: 'BUY',
          confidence: 80,
          timestamp: new Date(),
          quantity: 1.0,
          entryPrice: 100,
          conditions: [],
          metadata: {}
        }],
        reasoning: ['Test batch execution'],
        riskAssessment: {
          score: 30,
          factors: [],
          approved: true
        },
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 300000)
      }));
      
      await executionEngine.start();
      
      const results = await executionEngine.executeBatch(tradeDecisions, {
        mode: 'paper',
        maxConcurrency: 3
      });
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.executionTime < 2000)).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet latency requirements (<50ms)', async () => {
      await executionEngine.start();
      
      const startTime = Date.now();
      const result = await executionEngine.executeTradeDecision(mockTradeDecision, {
        mode: 'paper'
      });
      const latency = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(latency).toBeLessThan(50); // Should be under 50ms
      expect(result.metadata.latency).toBeLessThan(50);
    });

    it('should handle concurrent executions efficiently', async () => {
      await executionEngine.start();
      
      const concurrentExecutions = Array.from({ length: 10 }, (_, i) =>
        executionEngine.executeTradeDecision({
          ...mockTradeDecision,
          id: `concurrent_${i}`,
          symbol: `SYMBOL-${i}`
        }, { mode: 'paper' })
      );
      
      const startTime = Date.now();
      const results = await Promise.all(concurrentExecutions);
      const totalTime = Date.now() - startTime;
      
      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(500); // Should handle 10 concurrent executions quickly
      
      const status = executionEngine.getStatus();
      expect(status.metrics.executionsPerSecond).toBeGreaterThan(10);
    });

    it('should maintain performance under load', async () => {
      await executionEngine.start();
      
      const loadTest = async (batchSize: number) => {
        const decisions = Array.from({ length: batchSize }, (_, i) => ({
          ...mockTradeDecision,
          id: `load_test_${i}`,
          symbol: `LOAD-${i}`
        }));
        
        const startTime = Date.now();
        const results = await executionEngine.executeBatch(decisions, {
          mode: 'paper',
          maxConcurrency: 5
        });
        const duration = Date.now() - startTime;
        
        return {
          batchSize,
          duration,
          successRate: results.filter(r => r.success).length / results.length,
          averageLatency: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
        };
      };
      
      const results = await Promise.all([
        loadTest(10),
        loadTest(25),
        loadTest(50)
      ]);
      
      results.forEach(result => {
        expect(result.successRate).toBeGreaterThan(0.95); // >95% success rate
        expect(result.averageLatency).toBeLessThan(100); // <100ms average latency
      });
    });
  });

  describe('Memory Management', () => {
    it('should maintain memory usage within limits', async () => {
      await executionEngine.start();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Execute many operations to test memory management
      for (let i = 0; i < 100; i++) {
        await executionEngine.executeTradeDecision({
          ...mockTradeDecision,
          id: `memory_test_${i}`,
          symbol: `MEM-${i}`
        }, { mode: 'paper' });
      }
      
      // Clean up results older than 1 minute
      const clearedCount = executionEngine.clearResults(new Date(Date.now() - 60000));
      expect(clearedCount).toBeGreaterThan(0);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50);
      
      const status = executionEngine.getStatus();
      expect(status.metrics.memoryUsage).toBeLessThan(500); // Under 500MB limit
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle orchestration failures gracefully', async () => {
      // Mock orchestrator to throw error
      const errorMessage = 'Test orchestration error';
      mockRiskController.getCurrentRiskMetrics.mockRejectedValueOnce(new Error(errorMessage));
      
      await executionEngine.start();
      
      const result = await executionEngine.executeTradeDecision(mockTradeDecision);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should implement circuit breaker pattern', async () => {
      // Create engine with low circuit breaker threshold
      const circuitBreakerEngine = new StrategyExecutionEngine(
        { 
          circuitBreakerThreshold: 2,
          recoveryTime: 1000 // 1 second
        },
        {
          strategyEngine: mockStrategyEngine as any,
          riskController: mockRiskController as any,
          protectionMechanisms: mockProtectionMechanisms as any,
          tradeRepository: mockTradeRepository as any,
          positionRepository: mockPositionRepository as any
        }
      );
      
      await circuitBreakerEngine.initialize();
      await circuitBreakerEngine.start();
      
      try {
        // Cause failures to trigger circuit breaker
        mockProtectionMechanisms.evaluateSignal.mockRejectedValue(new Error('Test error'));
        
        // First two executions should fail and open the circuit
        await circuitBreakerEngine.executeTradeDecision(mockTradeDecision);
        await circuitBreakerEngine.executeTradeDecision(mockTradeDecision);
        
        // Third execution should be rejected due to open circuit
        const result = await circuitBreakerEngine.executeTradeDecision(mockTradeDecision);
        
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Circuit breaker open');
        
        const status = circuitBreakerEngine.getStatus();
        expect(status.circuitBreakerState.state).toBe('open');
        
      } finally {
        await circuitBreakerEngine.stop();
      }
    });

    it('should recover from circuit breaker after timeout', async () => {
      const circuitBreakerEngine = new StrategyExecutionEngine(
        { 
          circuitBreakerThreshold: 1,
          recoveryTime: 100 // 100ms for fast test
        },
        {
          strategyEngine: mockStrategyEngine as any,
          riskController: mockRiskController as any,
          protectionMechanisms: mockProtectionMechanisms as any,
          tradeRepository: mockTradeRepository as any,
          positionRepository: mockPositionRepository as any
        }
      );
      
      await circuitBreakerEngine.initialize();
      await circuitBreakerEngine.start();
      
      try {
        // Cause failure to open circuit
        mockProtectionMechanisms.evaluateSignal.mockRejectedValueOnce(new Error('Test error'));
        await circuitBreakerEngine.executeTradeDecision(mockTradeDecision);
        
        // Verify circuit is open
        let status = circuitBreakerEngine.getStatus();
        expect(status.circuitBreakerState.state).toBe('open');
        
        // Wait for recovery time
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Fix the mock to allow success
        mockProtectionMechanisms.evaluateSignal.mockResolvedValue({
          allowed: true,
          reasons: [],
          adjustments: {},
          protectionLevel: 'standard',
          timestamp: new Date()
        });
        
        // Should succeed and close circuit
        const result = await circuitBreakerEngine.executeTradeDecision(mockTradeDecision, {
          mode: 'paper'
        });
        
        expect(result.success).toBe(true);
        
        status = circuitBreakerEngine.getStatus();
        expect(status.circuitBreakerState.state).toBe('closed');
        
      } finally {
        await circuitBreakerEngine.stop();
      }
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track execution metrics accurately', async () => {
      await executionEngine.start();
      
      // Execute successful operations
      for (let i = 0; i < 5; i++) {
        await executionEngine.executeTradeDecision({
          ...mockTradeDecision,
          id: `metrics_success_${i}`
        }, { mode: 'paper' });
      }
      
      // Execute failed operations
      mockProtectionMechanisms.evaluateSignal.mockResolvedValue({
        allowed: false,
        reasons: ['Test rejection'],
        adjustments: {},
        protectionLevel: 'standard',
        timestamp: new Date()
      });
      
      for (let i = 0; i < 2; i++) {
        await executionEngine.executeTradeDecision({
          ...mockTradeDecision,
          id: `metrics_failure_${i}`
        });
      }
      
      const status = executionEngine.getStatus();
      const metrics = status.metrics;
      
      expect(metrics.totalExecutions).toBe(7);
      expect(metrics.successfulExecutions).toBe(5);
      expect(metrics.failedExecutions).toBe(2);
      expect(metrics.successRate).toBeCloseTo(5/7, 2);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.executionsPerSecond).toBeGreaterThan(0);
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should meet all performance targets', async () => {
    const performanceConfig = {
      maxLatency: 50,              // 50ms target
      maxConcurrentExecutions: 10, // 10 concurrent
      maxMemoryUsage: 500,        // 500MB limit
      maxQueueSize: 1000          // 1000 queue size
    };
    
    const engine = new StrategyExecutionEngine(performanceConfig, {
      strategyEngine: mockStrategyEngine as any,
      riskController: mockRiskController as any,
      protectionMechanisms: mockProtectionMechanisms as any,
      tradeRepository: mockTradeRepository as any,
      positionRepository: mockPositionRepository as any
    });
    
    await engine.initialize();
    await engine.start();
    
    try {
      // Benchmark results
      const benchmarks = {
        latency: 0,
        throughput: 0,
        memoryUsage: 0,
        errorRate: 0,
        concurrency: 0
      };
      
      // Latency benchmark
      const latencyStart = Date.now();
      const latencyResult = await engine.executeTradeDecision(mockTradeDecision, { mode: 'paper' });
      benchmarks.latency = Date.now() - latencyStart;
      
      // Throughput benchmark
      const throughputStart = Date.now();
      const throughputPromises = Array.from({ length: 100 }, (_, i) =>
        engine.executeTradeDecision({
          ...mockTradeDecision,
          id: `throughput_${i}`
        }, { mode: 'paper' })
      );
      const throughputResults = await Promise.all(throughputPromises);
      const throughputTime = (Date.now() - throughputStart) / 1000; // seconds
      benchmarks.throughput = throughputResults.length / throughputTime;
      
      // Memory usage benchmark
      benchmarks.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      
      // Error rate benchmark
      const failedResults = throughputResults.filter(r => !r.success);
      benchmarks.errorRate = (failedResults.length / throughputResults.length) * 100;
      
      // Concurrency benchmark
      const concurrencyStart = Date.now();
      const concurrentPromises = Array.from({ length: 20 }, (_, i) =>
        engine.executeTradeDecision({
          ...mockTradeDecision,
          id: `concurrent_${i}`
        }, { mode: 'paper' })
      );
      await Promise.all(concurrentPromises);
      benchmarks.concurrency = Date.now() - concurrencyStart;
      
      // Performance assertions
      expect(benchmarks.latency).toBeLessThan(performanceConfig.maxLatency);
      expect(benchmarks.throughput).toBeGreaterThan(50); // >50 executions/second
      expect(benchmarks.memoryUsage).toBeLessThan(performanceConfig.maxMemoryUsage);
      expect(benchmarks.errorRate).toBeLessThan(1); // <1% error rate
      expect(benchmarks.concurrency).toBeLessThan(1000); // <1 second for 20 concurrent
      
      console.log('Performance Benchmark Results:', {
        latency: `${benchmarks.latency}ms (target: <${performanceConfig.maxLatency}ms)`,
        throughput: `${benchmarks.throughput.toFixed(1)} ops/sec`,
        memoryUsage: `${benchmarks.memoryUsage.toFixed(1)}MB (limit: ${performanceConfig.maxMemoryUsage}MB)`,
        errorRate: `${benchmarks.errorRate.toFixed(2)}%`,
        concurrency: `${benchmarks.concurrency}ms for 20 operations`
      });
      
    } finally {
      await engine.stop();
    }
  });
});