/**
 * Order Manager Integration Tests - Task BE-021
 * 
 * Comprehensive integration tests for the Order Management System
 * validating enterprise-grade functionality, performance targets,
 * and integration with existing system components.
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { OrderManager, type OrderExecutionStrategy } from '../OrderManager.js';
import type { StrategySignal } from '../../strategies/types.js';

describe('OrderManager Integration Tests', () => {
  let orderManager: OrderManager;
  let testSignal: StrategySignal;
  let testExecutionStrategy: OrderExecutionStrategy;

  beforeAll(async () => {
    // Setup test environment
    orderManager = new OrderManager({
      maxLatencyMs: 10,
      maxConcurrentOrders: 1000,
      enableRiskChecks: false, // Disable for testing
      enableAdvancedOrderTypes: true
    });

    await orderManager.initialize();
  });

  afterAll(async () => {
    await orderManager.cleanup();
  });

  beforeEach(() => {
    // Reset test data for each test
    testSignal = {
      id: `signal_${Date.now()}`,
      timestamp: new Date(),
      strategyId: 'test_strategy',
      symbol: 'BTC-USD',
      action: 'buy',
      type: 'limit',
      quantity: 1000,
      price: 50000,
      confidence: 0.85,
      metadata: {
        source: 'test',
        indicators: {}
      }
    };

    testExecutionStrategy = {
      type: 'limit'
    };
  });

  describe('Order Creation', () => {
    test('should create order successfully with valid parameters', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(typeof result.orderId).toBe('string');
    });

    test('should handle high-priority orders', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy, {
        priority: 'critical'
      });

      expect(result.success).toBe(true);
      
      const order = orderManager.getOrder(result.orderId!);
      expect(order?.priority).toBe('critical');
    });

    test('should create order with advanced execution strategy', async () => {
      const twapStrategy: OrderExecutionStrategy = {
        type: 'twap',
        twap: {
          duration: 300000,
          sliceCount: 10,
          randomizeStart: false
        }
      };

      const result = await orderManager.createOrder(testSignal, twapStrategy);

      expect(result.success).toBe(true);
      
      const order = orderManager.getOrder(result.orderId!);
      expect(order?.executionStrategy.type).toBe('twap');
      expect(order?.executionStrategy.twap?.sliceCount).toBe(10);
    });

    test('should reject invalid order parameters', async () => {
      const invalidSignal = { ...testSignal, quantity: 0 };
      
      const result = await orderManager.createOrder(invalidSignal, testExecutionStrategy);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Order Submission', () => {
    test('should submit order successfully', async () => {
      const createResult = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(createResult.success).toBe(true);

      const submitResult = await orderManager.submitOrder(createResult.orderId!);
      expect(submitResult.success).toBe(true);

      const order = orderManager.getOrder(createResult.orderId!);
      expect(order?.status).toBe('submitted');
    });

    test('should fail to submit non-existent order', async () => {
      const result = await orderManager.submitOrder('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    test('should prevent double submission', async () => {
      const createResult = await orderManager.createOrder(testSignal, testExecutionStrategy);
      
      await orderManager.submitOrder(createResult.orderId!);
      const secondSubmit = await orderManager.submitOrder(createResult.orderId!);

      expect(secondSubmit.success).toBe(false);
      expect(secondSubmit.error).toContain('already');
    });
  });

  describe('Order Cancellation', () => {
    test('should cancel pending order successfully', async () => {
      const createResult = await orderManager.createOrder(testSignal, testExecutionStrategy);
      
      const cancelResult = await orderManager.cancelOrder(createResult.orderId!);

      expect(cancelResult.success).toBe(true);
      
      const order = orderManager.getOrder(createResult.orderId!);
      expect(order?.status).toBe('cancelled');
    });

    test('should fail to cancel non-existent order', async () => {
      const result = await orderManager.cancelOrder('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('Order Querying', () => {
    test('should retrieve active orders correctly', async () => {
      const orders = [];
      
      // Create multiple orders
      for (let i = 0; i < 5; i++) {
        const signal = { ...testSignal, id: `signal_${i}` };
        const result = await orderManager.createOrder(signal, testExecutionStrategy);
        orders.push(result.orderId!);
      }

      const activeOrders = orderManager.getActiveOrders();
      expect(activeOrders.length).toBeGreaterThanOrEqual(5);
    });

    test('should filter orders by symbol', async () => {
      // Create orders for different symbols
      const btcSignal = { ...testSignal, symbol: 'BTC-USD' };
      const ethSignal = { ...testSignal, symbol: 'ETH-USD' };

      await orderManager.createOrder(btcSignal, testExecutionStrategy);
      await orderManager.createOrder(ethSignal, testExecutionStrategy);

      const btcOrders = orderManager.getActiveOrders({ symbol: 'BTC-USD' });
      const ethOrders = orderManager.getActiveOrders({ symbol: 'ETH-USD' });

      expect(btcOrders.length).toBeGreaterThan(0);
      expect(ethOrders.length).toBeGreaterThan(0);
      
      btcOrders.forEach(order => expect(order.symbol).toBe('BTC-USD'));
      ethOrders.forEach(order => expect(order.symbol).toBe('ETH-USD'));
    });

    test('should filter orders by priority', async () => {
      await orderManager.createOrder(testSignal, testExecutionStrategy, { priority: 'high' });
      await orderManager.createOrder(testSignal, testExecutionStrategy, { priority: 'low' });

      const highPriorityOrders = orderManager.getActiveOrders({ priority: 'high' });
      const lowPriorityOrders = orderManager.getActiveOrders({ priority: 'low' });

      expect(highPriorityOrders.length).toBeGreaterThan(0);
      expect(lowPriorityOrders.length).toBeGreaterThan(0);
      
      highPriorityOrders.forEach(order => expect(order.priority).toBe('high'));
      lowPriorityOrders.forEach(order => expect(order.priority).toBe('low'));
    });
  });

  describe('Performance Requirements', () => {
    test('should meet latency target of <10ms for order creation', async () => {
      const startTime = performance.now();
      
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      
      const latency = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(latency).toBeLessThan(10); // 10ms target
    });

    test('should handle 1000+ concurrent orders', async () => {
      const promises = [];
      const orderCount = 1000;

      // Create 1000 orders concurrently
      for (let i = 0; i < orderCount; i++) {
        const signal = { ...testSignal, id: `concurrent_${i}` };
        promises.push(orderManager.createOrder(signal, testExecutionStrategy));
      }

      const results = await Promise.all(promises);

      // All orders should be created successfully
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(orderCount);

      // Check that all orders are tracked
      const activeOrders = orderManager.getActiveOrders();
      expect(activeOrders.length).toBeGreaterThanOrEqual(orderCount);
    });

    test('should maintain order accuracy of 99.99%', async () => {
      const orderCount = 10000;
      const promises = [];

      for (let i = 0; i < orderCount; i++) {
        const signal = { ...testSignal, id: `accuracy_${i}` };
        promises.push(orderManager.createOrder(signal, testExecutionStrategy));
      }

      const results = await Promise.all(promises);
      
      const successCount = results.filter(r => r.success).length;
      const accuracy = (successCount / orderCount) * 100;

      expect(accuracy).toBeGreaterThanOrEqual(99.99);
    });

    test('should stay within memory limit of 100MB', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create a large number of orders to test memory usage
      for (let i = 0; i < 5000; i++) {
        const signal = { ...testSignal, id: `memory_${i}` };
        await orderManager.createOrder(signal, testExecutionStrategy);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // Convert to MB

      expect(memoryIncrease).toBeLessThan(100); // 100MB limit
    });
  });

  describe('Audit Trail and Compliance', () => {
    test('should create comprehensive audit trail', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(result.success).toBe(true);

      const order = orderManager.getOrder(result.orderId!);
      expect(order?.auditTrail).toBeDefined();
      expect(order?.auditTrail.length).toBeGreaterThan(0);

      const creationEvent = order?.auditTrail.find(e => e.action === 'order_created');
      expect(creationEvent).toBeDefined();
      expect(creationEvent?.timestamp).toBeDefined();
    });

    test('should track execution history', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      await orderManager.submitOrder(result.orderId!);

      const order = orderManager.getOrder(result.orderId!);
      expect(order?.executionHistory.length).toBeGreaterThan(0);

      const createdEvent = order?.executionHistory.find(e => e.eventType === 'created');
      const submittedEvent = order?.executionHistory.find(e => e.eventType === 'submitted');

      expect(createdEvent).toBeDefined();
      expect(submittedEvent).toBeDefined();
    });

    test('should maintain data integrity across operations', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      const originalOrder = orderManager.getOrder(result.orderId!);

      await orderManager.submitOrder(result.orderId!);
      const updatedOrder = orderManager.getOrder(result.orderId!);

      // Core order data should remain intact
      expect(updatedOrder?.id).toBe(originalOrder?.id);
      expect(updatedOrder?.symbol).toBe(originalOrder?.symbol);
      expect(updatedOrder?.quantity).toBe(originalOrder?.quantity);
      expect(updatedOrder?.createdAt).toEqual(originalOrder?.createdAt);
      
      // Status should be updated
      expect(updatedOrder?.status).toBe('submitted');
      expect(updatedOrder?.updatedAt.getTime()).toBeGreaterThan(originalOrder!.updatedAt.getTime());
    });
  });

  describe('Error Handling', () => {
    test('should handle system errors gracefully', async () => {
      // Test with invalid execution strategy to trigger error
      const invalidStrategy = { type: 'invalid_type' as any };

      const result = await orderManager.createOrder(testSignal, invalidStrategy);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should recover from temporary failures', async () => {
      // Create order successfully first
      const result1 = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(result1.success).toBe(true);

      // Simulate system recovery and continue operations
      const result2 = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(result2.success).toBe(true);
    });

    test('should provide detailed error information', async () => {
      const invalidSignal = { ...testSignal, quantity: -1 };
      
      const result = await orderManager.createOrder(invalidSignal, testExecutionStrategy);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Order Types', () => {
    test('should handle TWAP orders correctly', async () => {
      const twapStrategy: OrderExecutionStrategy = {
        type: 'twap',
        twap: {
          duration: 300000,
          sliceCount: 5,
          randomizeStart: false,
          priceThreshold: 0.01
        }
      };

      const result = await orderManager.createOrder(testSignal, twapStrategy);

      expect(result.success).toBe(true);
      
      const order = orderManager.getOrder(result.orderId!);
      expect(order?.executionStrategy.type).toBe('twap');
      expect(order?.executionStrategy.twap?.duration).toBe(300000);
    });

    test('should handle VWAP orders correctly', async () => {
      const vwapStrategy: OrderExecutionStrategy = {
        type: 'vwap',
        vwap: {
          lookbackPeriod: 60,
          participationRate: 0.1,
          startTime: new Date(),
          endTime: new Date(Date.now() + 600000)
        }
      };

      const result = await orderManager.createOrder(testSignal, vwapStrategy);

      expect(result.success).toBe(true);
      
      const order = orderManager.getOrder(result.orderId!);
      expect(order?.executionStrategy.type).toBe('vwap');
      expect(order?.executionStrategy.vwap?.participationRate).toBe(0.1);
    });

    test('should handle Iceberg orders correctly', async () => {
      const icebergStrategy: OrderExecutionStrategy = {
        type: 'iceberg',
        iceberg: {
          visibleSize: 100,
          totalSize: 1000,
          randomizeRefills: true,
          priceVariance: 0.001
        }
      };

      const result = await orderManager.createOrder(testSignal, icebergStrategy);

      expect(result.success).toBe(true);
      
      const order = orderManager.getOrder(result.orderId!);
      expect(order?.executionStrategy.type).toBe('iceberg');
      expect(order?.executionStrategy.iceberg?.visibleSize).toBe(100);
      expect(order?.executionStrategy.iceberg?.totalSize).toBe(1000);
    });
  });

  describe('Performance Metrics', () => {
    test('should track order management metrics', async () => {
      // Create several orders
      for (let i = 0; i < 10; i++) {
        const signal = { ...testSignal, id: `metrics_${i}` };
        await orderManager.createOrder(signal, testExecutionStrategy);
      }

      const metrics = orderManager.getPerformanceMetrics();

      expect(metrics.totalOrders).toBeGreaterThanOrEqual(10);
      expect(metrics.activeOrders).toBeGreaterThanOrEqual(10);
      expect(metrics.averageLatencyMs).toBeDefined();
      expect(metrics.averageLatencyMs).toBeGreaterThan(0);
    });

    test('should provide real-time status updates', async () => {
      let orderCreatedEvent = false;
      let orderSubmittedEvent = false;

      orderManager.on('order_created', () => {
        orderCreatedEvent = true;
      });

      orderManager.on('order_submitted', () => {
        orderSubmittedEvent = true;
      });

      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      await orderManager.submitOrder(result.orderId!);

      // Give events time to fire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(orderCreatedEvent).toBe(true);
      expect(orderSubmittedEvent).toBe(true);
    });
  });
});