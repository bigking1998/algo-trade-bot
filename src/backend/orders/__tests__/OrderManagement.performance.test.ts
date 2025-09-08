/**
 * Order Management Performance Benchmarks - Task BE-021
 * 
 * Comprehensive performance testing suite validating that the Order Management System
 * meets all specified performance targets including latency, throughput, and scalability.
 * 
 * Performance Targets:
 * - Order processing latency < 10ms
 * - Support for 1000+ concurrent orders
 * - 99.99% order accuracy and integrity
 * - Memory usage < 100MB for order management
 * - Real-time status updates with < 50ms delay
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { OrderManager } from '../OrderManager.js';
import { OrderRouter } from '../OrderRouter.js';
import { ExecutionEngine } from '../ExecutionEngine.js';
import { OrderManagementIntegration } from '../OrderManagementIntegration.js';
import type { StrategySignal } from '../../strategies/types.js';

describe('Order Management System Performance Benchmarks', () => {
  let orderManager: OrderManager;
  let integration: OrderManagementIntegration;

  beforeAll(async () => {
    orderManager = new OrderManager({
      maxLatencyMs: 10,
      maxConcurrentOrders: 2000,
      enableRiskChecks: false,
      enableAdvancedOrderTypes: true,
      enablePerformanceTracking: true
    });

    integration = new OrderManagementIntegration({
      enableAdvancedOrders: true,
      enableSmartRouting: true,
      maxOrderProcessingLatency: 10
    });

    await Promise.all([
      orderManager.initialize(),
      integration.initialize()
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      orderManager.cleanup(),
      integration.cleanup()
    ]);
  });

  describe('Latency Benchmarks', () => {
    test('Order creation latency should be < 10ms', async () => {
      const signal: StrategySignal = {
        id: 'perf_signal_1',
        timestamp: new Date(),
        strategyId: 'perf_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'performance_test', indicators: {} }
      };

      const measurements: number[] = [];
      const iterations = 1000;

      // Warm up
      for (let i = 0; i < 10; i++) {
        await orderManager.createOrder(signal, { type: 'limit' });
      }

      // Actual measurements
      for (let i = 0; i < iterations; i++) {
        const testSignal = { ...signal, id: `perf_${i}` };
        const startTime = performance.now();
        
        const result = await orderManager.createOrder(testSignal, { type: 'limit' });
        
        const latency = performance.now() - startTime;
        
        expect(result.success).toBe(true);
        measurements.push(latency);
      }

      const averageLatency = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
      const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];
      const p99Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.99)];
      const maxLatency = Math.max(...measurements);

      console.log(`Order Creation Latency Metrics:
        Average: ${averageLatency.toFixed(2)}ms
        P95: ${p95Latency.toFixed(2)}ms
        P99: ${p99Latency.toFixed(2)}ms
        Max: ${maxLatency.toFixed(2)}ms`);

      // Validate performance targets
      expect(averageLatency).toBeLessThan(10);
      expect(p95Latency).toBeLessThan(15);
      expect(p99Latency).toBeLessThan(25);
    });

    test('Order submission latency should be < 5ms', async () => {
      const signal: StrategySignal = {
        id: 'submission_perf',
        timestamp: new Date(),
        strategyId: 'perf_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'performance_test', indicators: {} }
      };

      const measurements: number[] = [];
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        const testSignal = { ...signal, id: `submission_${i}` };
        
        const createResult = await orderManager.createOrder(testSignal, { type: 'limit' });
        expect(createResult.success).toBe(true);

        const startTime = performance.now();
        const submitResult = await orderManager.submitOrder(createResult.orderId!);
        const latency = performance.now() - startTime;

        expect(submitResult.success).toBe(true);
        measurements.push(latency);
      }

      const averageLatency = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
      const maxLatency = Math.max(...measurements);

      console.log(`Order Submission Latency: Avg=${averageLatency.toFixed(2)}ms, Max=${maxLatency.toFixed(2)}ms`);

      expect(averageLatency).toBeLessThan(5);
      expect(maxLatency).toBeLessThan(15);
    });

    test('End-to-end workflow latency should be < 50ms', async () => {
      const signal: StrategySignal = {
        id: 'e2e_perf',
        timestamp: new Date(),
        strategyId: 'perf_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'performance_test', indicators: {} }
      };

      const tradeDecision = {
        shouldTrade: true,
        confidence: 0.9,
        signals: [signal],
        riskAssessment: {
          riskLevel: 'low' as const,
          maxPositionSize: 10000,
          stopLoss: 49000,
          takeProfit: 51000
        },
        timestamp: new Date()
      };

      const measurements: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const testSignal = { ...signal, id: `e2e_${i}` };
        const testDecision = { ...tradeDecision, signals: [testSignal] };

        const startTime = performance.now();
        
        const result = await integration.processTradeSignal(testSignal, testDecision);
        
        const latency = performance.now() - startTime;

        expect(result.success).toBe(true);
        measurements.push(latency);
      }

      const averageLatency = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
      const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

      console.log(`E2E Workflow Latency: Avg=${averageLatency.toFixed(2)}ms, P95=${p95Latency.toFixed(2)}ms`);

      expect(averageLatency).toBeLessThan(50);
      expect(p95Latency).toBeLessThan(100);
    });
  });

  describe('Throughput Benchmarks', () => {
    test('Should handle 1000+ concurrent orders', async () => {
      const concurrentOrders = 1200;
      const signal: StrategySignal = {
        id: 'concurrent_base',
        timestamp: new Date(),
        strategyId: 'throughput_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 100,
        price: 50000,
        confidence: 0.8,
        metadata: { source: 'throughput_test', indicators: {} }
      };

      const startTime = performance.now();
      const promises: Promise<any>[] = [];

      // Create concurrent orders
      for (let i = 0; i < concurrentOrders; i++) {
        const testSignal = { ...signal, id: `concurrent_${i}` };
        promises.push(orderManager.createOrder(testSignal, { type: 'limit' }));
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const successCount = results.filter(r => r.success).length;
      const successRate = (successCount / concurrentOrders) * 100;
      const totalTime = endTime - startTime;
      const ordersPerSecond = (successCount / totalTime) * 1000;

      console.log(`Concurrent Orders Test:
        Orders Created: ${successCount}/${concurrentOrders}
        Success Rate: ${successRate.toFixed(2)}%
        Total Time: ${totalTime.toFixed(2)}ms
        Orders/Second: ${ordersPerSecond.toFixed(2)}`);

      expect(successCount).toBeGreaterThanOrEqual(1000);
      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(ordersPerSecond).toBeGreaterThan(100);
    });

    test('Should maintain performance under sustained load', async () => {
      const batchSize = 100;
      const batches = 10;
      const signal: StrategySignal = {
        id: 'sustained_base',
        timestamp: new Date(),
        strategyId: 'sustained_strategy',
        symbol: 'ETH-USD',
        action: 'sell',
        type: 'market',
        quantity: 500,
        confidence: 0.7,
        metadata: { source: 'sustained_test', indicators: {} }
      };

      const batchMetrics: Array<{ time: number; successRate: number; }> = [];

      for (let batch = 0; batch < batches; batch++) {
        const promises: Promise<any>[] = [];
        const batchStartTime = performance.now();

        for (let i = 0; i < batchSize; i++) {
          const testSignal = { ...signal, id: `sustained_${batch}_${i}` };
          promises.push(orderManager.createOrder(testSignal, { type: 'market' }));
        }

        const results = await Promise.all(promises);
        const batchEndTime = performance.now();

        const successCount = results.filter(r => r.success).length;
        const successRate = (successCount / batchSize) * 100;
        const batchTime = batchEndTime - batchStartTime;

        batchMetrics.push({ time: batchTime, successRate });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const averageTime = batchMetrics.reduce((sum, m) => sum + m.time, 0) / batchMetrics.length;
      const averageSuccessRate = batchMetrics.reduce((sum, m) => sum + m.successRate, 0) / batchMetrics.length;
      const timeVariation = Math.max(...batchMetrics.map(m => m.time)) - Math.min(...batchMetrics.map(m => m.time));

      console.log(`Sustained Load Test:
        Average Batch Time: ${averageTime.toFixed(2)}ms
        Average Success Rate: ${averageSuccessRate.toFixed(2)}%
        Time Variation: ${timeVariation.toFixed(2)}ms`);

      expect(averageSuccessRate).toBeGreaterThan(98);
      expect(timeVariation).toBeLessThan(averageTime); // Variation should be less than average
    });
  });

  describe('Memory Performance', () => {
    test('Should stay within 100MB memory limit', async () => {
      const initialMemory = process.memoryUsage();
      const orderCount = 10000;
      
      const signal: StrategySignal = {
        id: 'memory_base',
        timestamp: new Date(),
        strategyId: 'memory_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'memory_test', indicators: {} }
      };

      // Create orders to test memory usage
      for (let i = 0; i < orderCount; i++) {
        const testSignal = { ...signal, id: `memory_${i}` };
        await orderManager.createOrder(testSignal, { type: 'limit' });

        // Periodic garbage collection hint
        if (i % 1000 === 0) {
          if (global.gc) global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        heapUsed: (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024),
        heapTotal: (finalMemory.heapTotal - initialMemory.heapTotal) / (1024 * 1024),
        rss: (finalMemory.rss - initialMemory.rss) / (1024 * 1024)
      };

      console.log(`Memory Usage for ${orderCount} orders:
        Heap Used Increase: ${memoryIncrease.heapUsed.toFixed(2)}MB
        Heap Total Increase: ${memoryIncrease.heapTotal.toFixed(2)}MB
        RSS Increase: ${memoryIncrease.rss.toFixed(2)}MB`);

      expect(memoryIncrease.heapUsed).toBeLessThan(100);
      expect(memoryIncrease.rss).toBeLessThan(200);
    });

    test('Should handle memory efficiently with cleanup', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create a new order manager for this test
      const testOrderManager = new OrderManager({
        maxLatencyMs: 10,
        maxConcurrentOrders: 1000
      });
      
      await testOrderManager.initialize();

      const signal: StrategySignal = {
        id: 'cleanup_base',
        timestamp: new Date(),
        strategyId: 'cleanup_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'cleanup_test', indicators: {} }
      };

      // Create orders
      const orderIds: string[] = [];
      for (let i = 0; i < 1000; i++) {
        const testSignal = { ...signal, id: `cleanup_${i}` };
        const result = await testOrderManager.createOrder(testSignal, { type: 'limit' });
        if (result.success) {
          orderIds.push(result.orderId!);
        }
      }

      const beforeCleanup = process.memoryUsage().heapUsed;

      // Cancel all orders (cleanup)
      for (const orderId of orderIds) {
        await testOrderManager.cancelOrder(orderId);
      }

      // Cleanup order manager
      await testOrderManager.cleanup();

      // Force garbage collection if available
      if (global.gc) global.gc();

      const afterCleanup = process.memoryUsage().heapUsed;
      const memoryFreed = (beforeCleanup - afterCleanup) / (1024 * 1024);

      console.log(`Memory Cleanup Test:
        Memory Freed: ${memoryFreed.toFixed(2)}MB
        Final vs Initial: ${((afterCleanup - initialMemory) / (1024 * 1024)).toFixed(2)}MB`);

      expect(memoryFreed).toBeGreaterThan(0); // Should free some memory
    });
  });

  describe('Accuracy Benchmarks', () => {
    test('Should maintain 99.99% order accuracy', async () => {
      const orderCount = 10000;
      const signal: StrategySignal = {
        id: 'accuracy_base',
        timestamp: new Date(),
        strategyId: 'accuracy_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'accuracy_test', indicators: {} }
      };

      let successCount = 0;
      let dataIntegrityIssues = 0;

      for (let i = 0; i < orderCount; i++) {
        const testSignal = { ...signal, id: `accuracy_${i}` };
        
        const result = await orderManager.createOrder(testSignal, { type: 'limit' });
        
        if (result.success) {
          successCount++;
          
          // Verify data integrity
          const order = orderManager.getOrder(result.orderId!);
          if (!order || 
              order.symbol !== testSignal.symbol ||
              order.quantity !== testSignal.quantity ||
              order.side !== testSignal.action ||
              !order.id ||
              !order.createdAt) {
            dataIntegrityIssues++;
          }
        }
      }

      const accuracy = (successCount / orderCount) * 100;
      const integrityRate = ((successCount - dataIntegrityIssues) / successCount) * 100;

      console.log(`Accuracy Test Results:
        Success Rate: ${accuracy.toFixed(4)}%
        Data Integrity Rate: ${integrityRate.toFixed(4)}%
        Successful Orders: ${successCount}/${orderCount}
        Integrity Issues: ${dataIntegrityIssues}`);

      expect(accuracy).toBeGreaterThanOrEqual(99.99);
      expect(integrityRate).toBeGreaterThanOrEqual(99.99);
      expect(dataIntegrityIssues).toBe(0);
    });
  });

  describe('Real-time Updates Performance', () => {
    test('Should deliver status updates within 50ms', async () => {
      const signal: StrategySignal = {
        id: 'realtime_test',
        timestamp: new Date(),
        strategyId: 'realtime_strategy',
        symbol: 'BTC-USD',
        action: 'buy',
        type: 'limit',
        quantity: 1000,
        price: 50000,
        confidence: 0.9,
        metadata: { source: 'realtime_test', indicators: {} }
      };

      const updateLatencies: number[] = [];
      let eventReceived = false;
      let eventTimestamp = 0;

      // Set up event listener
      const eventHandler = () => {
        eventReceived = true;
        eventTimestamp = performance.now();
      };

      orderManager.on('order_created', eventHandler);

      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        const testSignal = { ...signal, id: `realtime_${i}` };
        
        eventReceived = false;
        const startTime = performance.now();
        
        const result = await orderManager.createOrder(testSignal, { type: 'limit' });
        
        expect(result.success).toBe(true);
        
        // Wait for event (with timeout)
        let waitTime = 0;
        while (!eventReceived && waitTime < 200) {
          await new Promise(resolve => setTimeout(resolve, 1));
          waitTime++;
        }

        if (eventReceived) {
          const latency = eventTimestamp - startTime;
          updateLatencies.push(latency);
        }
      }

      orderManager.off('order_created', eventHandler);

      const averageLatency = updateLatencies.reduce((sum, val) => sum + val, 0) / updateLatencies.length;
      const p95Latency = updateLatencies.sort((a, b) => a - b)[Math.floor(updateLatencies.length * 0.95)];
      const maxLatency = Math.max(...updateLatencies);
      const eventDeliveryRate = (updateLatencies.length / iterations) * 100;

      console.log(`Real-time Update Performance:
        Event Delivery Rate: ${eventDeliveryRate.toFixed(2)}%
        Average Latency: ${averageLatency.toFixed(2)}ms
        P95 Latency: ${p95Latency.toFixed(2)}ms
        Max Latency: ${maxLatency.toFixed(2)}ms`);

      expect(eventDeliveryRate).toBeGreaterThan(95);
      expect(averageLatency).toBeLessThan(50);
      expect(p95Latency).toBeLessThan(100);
    });
  });
});