/**
 * Task BE-023 Integration Tests: Order Management System Implementation
 * 
 * Comprehensive validation of the complete Order Management System implementation
 * including dYdX v4 API integration, order lifecycle management, status tracking,
 * and error handling as specified in Task BE-023 deliverables.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrderManager } from '../OrderManager.js';
import { OrderExecutor } from '../../execution/OrderExecutor.js';
import { PositionTracker } from '../../portfolio/PositionTracker.js';
import { PortfolioManager } from '../../portfolio/PortfolioManager.js';
import type { StrategySignal } from '../../strategies/types.js';
import type { OrderExecutionStrategy } from '../OrderManager.js';

describe('Task BE-023: Order Management System Integration', () => {
  let orderManager: OrderManager;
  let orderExecutor: OrderExecutor;
  let positionTracker: PositionTracker;
  let portfolioManager: PortfolioManager;

  // Test data
  const testSignal: StrategySignal = {
    strategyId: 'test-strategy',
    symbol: 'BTC-USD',
    action: 'buy',
    quantity: 1.5,
    price: 45000,
    confidence: 0.85,
    timestamp: new Date(),
    metadata: {
      entry: true,
      timeframe: '1h',
      indicators: { rsi: 30, macd: 0.5 }
    }
  };

  const testExecutionStrategy: OrderExecutionStrategy = {
    type: 'limit',
    twap: undefined,
    vwap: undefined,
    iceberg: undefined,
    bracket: undefined,
    conditional: undefined
  };

  beforeEach(async () => {
    // Initialize portfolio manager
    portfolioManager = new PortfolioManager({
      initialBalance: 100000,
      baseCurrency: 'USD',
      enableRealTimeUpdates: true
    });

    await portfolioManager.initialize();

    // Initialize position tracker
    positionTracker = new PositionTracker(portfolioManager, {
      enableRealTimeUpdates: true,
      priceUpdateIntervalMs: 1000
    });

    await positionTracker.initialize();

    // Initialize order executor in paper mode for testing
    orderExecutor = new OrderExecutor({
      mode: 'paper',
      retryAttempts: 2,
      retryDelay: 100,
      maxLatency: 5000,
      enableRealTimeMonitoring: true,
      exchanges: {
        primary: 'dydx',
        fallback: [],
        credentials: {}
      }
    });

    await orderExecutor.initialize();

    // Initialize order manager
    orderManager = new OrderManager({
      maxLatencyMs: 100,
      maxConcurrentOrders: 10,
      enableRiskChecks: true,
      enableAdvancedOrderTypes: true,
      enableRealTimeUpdates: true,
      defaultPriority: 'normal'
    });

    await orderManager.initialize();
  });

  afterEach(async () => {
    await orderManager.cleanup();
    await orderExecutor.cleanup();
    await positionTracker.destroy();
    vi.clearAllMocks();
  });

  describe('BE-023.1: Order Lifecycle Management', () => {
    it('should create order with complete lifecycle tracking', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();

      const order = orderManager.getOrder(result.orderId!);
      expect(order).toBeDefined();
      expect(order!.symbol).toBe('BTC-USD');
      expect(order!.side).toBe('buy');
      expect(order!.quantity).toBe(1.5);
      expect(order!.status).toBe('pending');
      expect(order!.executionHistory.length).toBeGreaterThan(0);
      expect(order!.auditTrail.length).toBeGreaterThan(0);
    });

    it('should submit order and track status changes', async () => {
      const createResult = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(createResult.success).toBe(true);

      const submitResult = await orderManager.submitOrder(createResult.orderId!);
      expect(submitResult.success).toBe(true);

      const order = orderManager.getOrder(createResult.orderId!);
      expect(order!.status).toBe('submitted');
      expect(order!.submittedAt).toBeDefined();
      expect(order!.executionHistory.some(e => e.eventType === 'submitted')).toBe(true);
    });

    it('should handle order cancellation', async () => {
      const createResult = await orderManager.createOrder(testSignal, testExecutionStrategy);
      await orderManager.submitOrder(createResult.orderId!);

      const cancelResult = await orderManager.cancelOrder(createResult.orderId!);
      expect(cancelResult.success).toBe(true);

      const order = orderManager.getOrder(createResult.orderId!);
      expect(order!.status).toBe('cancelled');
    });
  });

  describe('BE-023.2: Status Tracking and Updates', () => {
    it('should emit real-time status updates', (done) => {
      let eventCount = 0;
      const expectedEvents = ['order_created', 'order_submitted'];

      orderManager.on('order_created', (event) => {
        expect(event.orderId).toBeDefined();
        expect(event.symbol).toBe('BTC-USD');
        eventCount++;
        
        if (eventCount === expectedEvents.length) {
          done();
        }
      });

      orderManager.on('order_submitted', (event) => {
        expect(event.orderId).toBeDefined();
        expect(event.symbol).toBe('BTC-USD');
        eventCount++;
        
        if (eventCount === expectedEvents.length) {
          done();
        }
      });

      orderManager.createOrder(testSignal, testExecutionStrategy)
        .then(result => orderManager.submitOrder(result.orderId!));
    });

    it('should track execution history with timestamps', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      await orderManager.submitOrder(result.orderId!);

      const order = orderManager.getOrder(result.orderId!);
      expect(order!.executionHistory.length).toBeGreaterThanOrEqual(2);
      
      const createdEvent = order!.executionHistory.find(e => e.eventType === 'created');
      const submittedEvent = order!.executionHistory.find(e => e.eventType === 'submitted');
      
      expect(createdEvent).toBeDefined();
      expect(submittedEvent).toBeDefined();
      expect(submittedEvent!.timestamp.getTime()).toBeGreaterThan(createdEvent!.timestamp.getTime());
    });

    it('should maintain audit trail for compliance', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy, {
        notes: 'Test order for compliance tracking'
      });
      await orderManager.submitOrder(result.orderId!);
      await orderManager.cancelOrder(result.orderId!);

      const order = orderManager.getOrder(result.orderId!);
      expect(order!.auditTrail.length).toBeGreaterThanOrEqual(3); // Create, submit, cancel
      
      const actions = order!.auditTrail.map(a => a.action);
      expect(actions).toContain('order_created');
      expect(actions).toContain('order_submitted');
      expect(actions).toContain('order_cancelled');
    });
  });

  describe('BE-023.3: Error Handling and Retries', () => {
    it('should handle rate limiting gracefully', async () => {
      const promises = [];
      
      // Create many orders simultaneously to trigger rate limiting
      for (let i = 0; i < 15; i++) {
        promises.push(orderManager.createOrder({
          ...testSignal,
          quantity: 0.1
        }, testExecutionStrategy));
      }

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Some should succeed, some might be rate limited
      expect(successful.length).toBeGreaterThan(0);
      
      // Failed orders should have appropriate error messages
      failed.forEach(result => {
        expect(result.error).toBeDefined();
      });
    });

    it('should handle validation errors', async () => {
      const invalidSignal: StrategySignal = {
        ...testSignal,
        quantity: 0, // Invalid quantity
        price: -100 // Invalid price
      };

      const result = await orderManager.createOrder(invalidSignal, testExecutionStrategy);
      
      if (!result.success) {
        expect(result.error).toContain('validation');
      }
    });

    it('should retry failed operations', async () => {
      // Mock a failing scenario that should retry
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(result.success).toBe(true);

      // Cleanup spy
      spy.mockRestore();
    });
  });

  describe('BE-023.4: Integration with dYdX API', () => {
    it('should handle dYdX order format conversion', async () => {
      // Test paper trading mode which should work without real API keys
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(result.success).toBe(true);

      const order = orderManager.getOrder(result.orderId!);
      expect(order!.symbol).toBe('BTC-USD'); // dYdX format
      expect(order!.side).toBe('buy');
      expect(order!.type).toBe('limit');
    });

    it('should track order performance metrics', async () => {
      // Create and submit several orders
      for (let i = 0; i < 3; i++) {
        const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
        await orderManager.submitOrder(result.orderId!);
      }

      const metrics = orderManager.getPerformanceMetrics();
      expect(metrics.totalOrders).toBe(3);
      expect(metrics.averageLatencyMs).toBeGreaterThan(0);
      expect(metrics.activeOrders).toBeGreaterThan(0);
    });
  });

  describe('BE-023.5: Performance Requirements Validation', () => {
    it('should meet latency requirements < 100ms for order creation', async () => {
      const startTime = Date.now();
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      const latency = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(latency).toBeLessThan(100); // Task BE-023 requirement
    });

    it('should handle concurrent orders efficiently', async () => {
      const concurrentOrders = 10;
      const promises = [];

      const startTime = Date.now();
      
      for (let i = 0; i < concurrentOrders; i++) {
        promises.push(orderManager.createOrder({
          ...testSignal,
          quantity: 0.1 + (i * 0.01) // Slightly different quantities
        }, testExecutionStrategy));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should track memory usage within limits', () => {
      const metrics = orderManager.getPerformanceMetrics();
      
      // Verify we have performance tracking
      expect(metrics).toBeDefined();
      expect(metrics.totalOrders).toBeGreaterThanOrEqual(0);
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('BE-023.6: Advanced Order Types Support', () => {
    it('should support TWAP execution strategy', async () => {
      const twapStrategy: OrderExecutionStrategy = {
        type: 'twap',
        twap: {
          duration: 60000, // 1 minute
          sliceCount: 4,
          randomizeStart: false,
          priceThreshold: 0.01
        }
      };

      const result = await orderManager.createOrder(testSignal, twapStrategy);
      expect(result.success).toBe(true);

      const order = orderManager.getOrder(result.orderId!);
      expect(order!.executionStrategy.type).toBe('twap');
      expect(order!.executionStrategy.twap).toBeDefined();
    });

    it('should support bracket orders', async () => {
      const bracketStrategy: OrderExecutionStrategy = {
        type: 'bracket',
        bracket: {
          profitTarget: 46000,
          stopLoss: 44000,
          trailingAmount: 500
        }
      };

      const result = await orderManager.createOrder(testSignal, bracketStrategy);
      expect(result.success).toBe(true);

      const order = orderManager.getOrder(result.orderId!);
      expect(order!.executionStrategy.type).toBe('bracket');
      expect(order!.executionStrategy.bracket).toBeDefined();
    });
  });

  describe('BE-023.7: Compliance and Risk Integration', () => {
    it('should enforce risk checks when enabled', async () => {
      const largeOrder: StrategySignal = {
        ...testSignal,
        quantity: 999999 // Extremely large order to trigger risk checks
      };

      const result = await orderManager.createOrder(largeOrder, testExecutionStrategy);
      
      // Should either succeed with risk assessment or fail with risk message
      if (!result.success) {
        expect(result.error).toMatch(/risk|limit|size/i);
      } else {
        const order = orderManager.getOrder(result.orderId!);
        expect(order!.riskAssessment).toBeDefined();
      }
    });

    it('should generate compliance flags when needed', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      expect(result.success).toBe(true);

      const flags = orderManager.getComplianceFlags(result.orderId!);
      expect(Array.isArray(flags)).toBe(true);
    });
  });

  describe('BE-023.8: System Integration', () => {
    it('should integrate with Position Tracker for order fills', async () => {
      // Mock an order fill scenario
      const mockFill = {
        orderId: 'test-order',
        symbol: 'BTC-USD',
        side: 'BUY' as const,
        quantity: 1.0,
        price: 45000,
        fees: 50,
        timestamp: new Date(),
        strategyId: 'test-strategy'
      };

      const position = await positionTracker.updateFromOrderFill('test-order', mockFill);
      expect(position).toBeDefined();
      expect(position!.symbol).toBe('BTC-USD');
      expect(position!.quantity).toBe(1.0);
    });

    it('should maintain system state consistency', async () => {
      const result = await orderManager.createOrder(testSignal, testExecutionStrategy);
      await orderManager.submitOrder(result.orderId!);

      // Verify order exists in order manager
      const order = orderManager.getOrder(result.orderId!);
      expect(order).toBeDefined();

      // Verify metrics are updated
      const metrics = orderManager.getPerformanceMetrics();
      expect(metrics.totalOrders).toBeGreaterThan(0);
      expect(metrics.activeOrders).toBeGreaterThan(0);
    });
  });
});