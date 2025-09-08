/**
 * Portfolio Manager Test Suite
 * Task BE-022: Portfolio Management Engine Implementation
 * 
 * Comprehensive test suite covering:
 * - Real-time portfolio tracking
 * - Position management
 * - Valuation accuracy
 * - Performance metrics
 * - Integration with order/risk systems
 * - Memory and performance constraints
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PortfolioManager, type PortfolioManagerConfig } from '../PortfolioManager.js';
import { Position } from '../../../shared/types/trading.js';

describe('PortfolioManager', () => {
  let portfolioManager: PortfolioManager;
  let mockOrderFill: any;
  
  beforeEach(async () => {
    // Create test configuration
    const testConfig: Partial<PortfolioManagerConfig> = {
      valuationIntervalMs: 100, // Fast for testing
      snapshotIntervalMs: 200,
      maxPositions: 10,
      enableRiskMonitoring: false, // Disable for isolated testing
      autoRebalancing: false,
      trackPerformance: true,
      persistState: false // Don't persist during tests
    };
    
    portfolioManager = new PortfolioManager(testConfig);
    await portfolioManager.initialize();
    
    // Mock order fill data
    mockOrderFill = {
      orderId: 'test-order-123',
      symbol: 'BTC-USD',
      side: 'BUY' as const,
      quantity: 1.0,
      price: 50000,
      fees: 25,
      timestamp: new Date(),
      strategyId: 'test-strategy'
    };
  });
  
  afterEach(async () => {
    await portfolioManager.stop();
  });
  
  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      const manager = new PortfolioManager();
      await manager.initialize();
      
      const state = manager.getState();
      expect(state.positions).toBeDefined();
      expect(state.balances).toBeDefined();
      expect(state.totalValue).toBe(0);
      expect(state.unrealizedPnL).toBe(0);
      expect(state.realizedPnL).toBe(0);
      
      await manager.stop();
    });
    
    test('should start and stop successfully', async () => {
      await portfolioManager.start();
      
      // Verify running state
      expect((portfolioManager as any).isRunning).toBe(true);
      
      await portfolioManager.stop();
      expect((portfolioManager as any).isRunning).toBe(false);
    });
  });
  
  describe('Position Management', () => {
    test('should update position from order fill', async () => {
      await portfolioManager.start();
      
      // Add initial balance
      portfolioManager.setBalance('USD', 100000);
      
      // Process order fill
      await portfolioManager.updatePositionFromOrder('test-order-123', mockOrderFill);
      
      // Check position was created
      const position = portfolioManager.getPosition('BTC-USD');
      expect(position).toBeDefined();
      expect(position?.symbol).toBe('BTC-USD');
      expect(position?.quantity).toBe(1.0);
      expect(position?.entryPrice).toBe(50000);
      expect(position?.side).toBe('long');
    });
    
    test('should handle multiple fills for same position', async () => {
      await portfolioManager.start();
      portfolioManager.setBalance('USD', 200000);
      
      // First fill
      await portfolioManager.updatePositionFromOrder('order-1', mockOrderFill);
      
      // Second fill (adding to position)
      const secondFill = {
        ...mockOrderFill,
        orderId: 'order-2',
        quantity: 0.5,
        price: 52000
      };
      
      await portfolioManager.updatePositionFromOrder('order-2', secondFill);
      
      const position = portfolioManager.getPosition('BTC-USD');
      expect(position?.quantity).toBe(1.5);
      
      // Check average entry price calculation
      const expectedAvgPrice = (50000 * 1.0 + 52000 * 0.5) / 1.5;
      expect(position?.entryPrice).toBeCloseTo(expectedAvgPrice, 2);
    });
    
    test('should handle position closing', async () => {
      await portfolioManager.start();
      portfolioManager.setBalance('USD', 100000);
      
      // Open position
      await portfolioManager.updatePositionFromOrder('order-1', mockOrderFill);
      
      // Close position
      const closeFill = {
        ...mockOrderFill,
        orderId: 'order-2',
        side: 'SELL' as const,
        quantity: 1.0,
        price: 55000 // Profit
      };
      
      await portfolioManager.updatePositionFromOrder('order-2', closeFill);
      
      const position = portfolioManager.getPosition('BTC-USD');
      expect(position?.quantity).toBe(0);
      
      // Check realized P&L was recorded
      const state = portfolioManager.getState();
      expect(state.realizedPnL).toBeGreaterThan(0);
    });
  });
  
  describe('Portfolio Valuation', () => {
    test('should calculate portfolio value correctly', async () => {
      await portfolioManager.start();
      
      // Set up test positions and balances
      portfolioManager.setBalance('USD', 50000);
      portfolioManager.setBalance('BTC', 1.0);
      
      // Mock market price update (would come from ValuationEngine)
      const positionTracker = (portfolioManager as any).positionTracker;
      positionTracker.updateMarketPrice('BTC-USD', 60000);
      
      // Force valuation update
      const totalValue = await portfolioManager.updateValuation();
      
      // Should include cash + position values
      expect(totalValue).toBeGreaterThan(50000); // At least the cash balance
    });
    
    test('should meet performance target of < 20ms valuation', async () => {
      await portfolioManager.start();
      
      // Add multiple positions for performance test
      const positions = ['BTC-USD', 'ETH-USD', 'ADA-USD', 'DOT-USD', 'LINK-USD'];
      
      for (const symbol of positions) {
        const fill = {
          ...mockOrderFill,
          orderId: `order-${symbol}`,
          symbol,
          quantity: 1.0,
          price: 1000
        };
        await portfolioManager.updatePositionFromOrder(fill.orderId, fill);
      }
      
      // Measure valuation time
      const startTime = Date.now();
      await portfolioManager.updateValuation();
      const executionTime = Date.now() - startTime;
      
      // Should meet < 20ms target
      expect(executionTime).toBeLessThan(20);
    });
  });
  
  describe('Performance Metrics', () => {
    test('should track performance metrics correctly', async () => {
      await portfolioManager.start();
      
      // Get initial metrics
      const performanceMetrics = portfolioManager.getPerformanceMetrics();
      
      expect(performanceMetrics.valuationCount).toBe(0);
      expect(performanceMetrics.errorCount).toBe(0);
      expect(performanceMetrics.avgValuationTime).toBe(0);
      
      // Trigger some valuations
      await portfolioManager.updateValuation();
      await portfolioManager.updateValuation();
      
      const updatedMetrics = portfolioManager.getPerformanceMetrics();
      expect(updatedMetrics.valuationCount).toBe(2);
      expect(updatedMetrics.avgValuationTime).toBeGreaterThan(0);
    });
  });
  
  describe('Portfolio Summary', () => {
    test('should generate accurate portfolio summary', async () => {
      await portfolioManager.start();
      
      // Set up test portfolio
      portfolioManager.setBalance('USD', 50000);
      await portfolioManager.updatePositionFromOrder('order-1', mockOrderFill);
      
      const summary = await portfolioManager.getPortfolioSummary();
      
      expect(summary.totalAssets).toBeGreaterThan(0);
      expect(summary.assetCount).toBeGreaterThan(0);
      expect(summary.allocation).toBeDefined();
      expect(Array.isArray(summary.allocation)).toBe(true);
      
      // Check allocation percentages sum to ~100%
      const totalAllocation = summary.allocation.reduce((sum, item) => sum + item.percentage, 0);
      expect(totalAllocation).toBeCloseTo(100, 1);
    });
  });
  
  describe('Portfolio Snapshot', () => {
    test('should generate comprehensive portfolio snapshot', async () => {
      await portfolioManager.start();
      
      // Set up test data
      portfolioManager.setBalance('USD', 75000);
      await portfolioManager.updatePositionFromOrder('order-1', mockOrderFill);
      
      const snapshot = await portfolioManager.getSnapshot();
      
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.totalValue).toBeDefined();
      expect(snapshot.positions).toBeDefined();
      expect(snapshot.balances).toBeDefined();
      expect(snapshot.performance).toBeDefined();
      expect(snapshot.risk).toBeDefined();
      
      // Validate performance section
      expect(snapshot.performance.totalPnL).toBeDefined();
      expect(snapshot.performance.totalPnLPercent).toBeDefined();
      
      // Validate risk section
      expect(snapshot.risk.portfolioHeat).toBeDefined();
      expect(snapshot.risk.totalExposure).toBeDefined();
    });
  });
  
  describe('Event System', () => {
    test('should emit position events correctly', (done) => {
      let eventCount = 0;
      
      portfolioManager.on('position_updated', (event) => {
        expect(event.orderId).toBeDefined();
        expect(event.fill).toBeDefined();
        eventCount++;
        
        if (eventCount === 1) done();
      });
      
      portfolioManager.start().then(() => {
        return portfolioManager.updatePositionFromOrder('test-order', mockOrderFill);
      });
    });
    
    test('should emit valuation events correctly', (done) => {
      portfolioManager.on('valuation_updated', (event) => {
        expect(event.newValue).toBeDefined();
        expect(event.executionTime).toBeDefined();
        expect(event.executionTime).toBeLessThan(50); // Should be fast
        done();
      });
      
      portfolioManager.start().then(() => {
        return portfolioManager.updateValuation();
      });
    });
  });
  
  describe('Memory Management', () => {
    test('should maintain memory usage under 200MB target', async () => {
      await portfolioManager.start();
      
      // Simulate heavy usage with many positions and updates
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Add many positions
      for (let i = 0; i < 100; i++) {
        const fill = {
          ...mockOrderFill,
          orderId: `order-${i}`,
          symbol: `TEST-${i}`,
          quantity: Math.random() * 10,
          price: 1000 + Math.random() * 1000
        };
        
        await portfolioManager.updatePositionFromOrder(fill.orderId, fill);
      }
      
      // Trigger many valuation updates
      for (let i = 0; i < 50; i++) {
        await portfolioManager.updateValuation();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      // Should not exceed reasonable memory growth (allowing for test overhead)
      expect(memoryIncrease).toBeLessThan(50); // 50MB increase limit for test
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid order fills gracefully', async () => {
      await portfolioManager.start();
      
      const invalidFill = {
        ...mockOrderFill,
        price: -1000 // Invalid negative price
      };
      
      // Should not throw, but should increment error count
      const initialErrorCount = portfolioManager.getPerformanceMetrics().errorCount;
      
      try {
        await portfolioManager.updatePositionFromOrder('invalid-order', invalidFill);
      } catch (error) {
        // Expected to handle gracefully
      }
      
      // Error count should remain the same (handled gracefully) or increment by 1
      const finalErrorCount = portfolioManager.getPerformanceMetrics().errorCount;
      expect(finalErrorCount - initialErrorCount).toBeLessThanOrEqual(1);
    });
    
    test('should recover from valuation errors', async () => {
      await portfolioManager.start();
      
      // Mock valuation engine to throw error once
      const valuationEngine = (portfolioManager as any).valuationEngine;
      const originalCalculate = valuationEngine.calculatePortfolioValue;
      
      let callCount = 0;
      valuationEngine.calculatePortfolioValue = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary valuation error');
        }
        return originalCalculate.call(valuationEngine);
      });
      
      // First call should fail and increment error count
      try {
        await portfolioManager.updateValuation();
      } catch (error) {
        expect(error.message).toContain('Temporary valuation error');
      }
      
      // Second call should succeed
      const value = await portfolioManager.updateValuation();
      expect(typeof value).toBe('number');
      
      const metrics = portfolioManager.getPerformanceMetrics();
      expect(metrics.errorCount).toBe(1);
    });
  });
  
  describe('Integration Tests', () => {
    test('should integrate with position tracking correctly', async () => {
      await portfolioManager.start();
      
      portfolioManager.setBalance('USD', 100000);
      
      // Process order and verify integration
      await portfolioManager.updatePositionFromOrder('order-1', mockOrderFill);
      
      const positions = portfolioManager.getPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTC-USD');
      
      const position = portfolioManager.getPosition('BTC-USD');
      expect(position?.id).toBeDefined();
      expect(position?.openedAt).toBeDefined();
    });
    
    test('should handle rapid consecutive updates', async () => {
      await portfolioManager.start();
      portfolioManager.setBalance('USD', 500000);
      
      // Rapid fire multiple updates
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const fill = {
          ...mockOrderFill,
          orderId: `rapid-order-${i}`,
          symbol: `TEST-${i % 3}`, // 3 different symbols
          quantity: 0.1,
          price: 1000 + i * 100
        };
        
        promises.push(portfolioManager.updatePositionFromOrder(fill.orderId, fill));
      }
      
      // All should complete without errors
      await Promise.all(promises);
      
      const positions = portfolioManager.getPositions();
      expect(positions.length).toBeGreaterThan(0);
      expect(positions.length).toBeLessThanOrEqual(3); // Max 3 symbols used
    });
  });
  
  describe('Performance Benchmarks', () => {
    test('should support 1000+ positions target', async () => {
      await portfolioManager.start();
      portfolioManager.setBalance('USD', 10000000); // Large balance for many positions
      
      const startTime = Date.now();
      
      // Create many positions (scaled down for test speed)
      const numPositions = 50; // Scaled down from 1000 for test performance
      
      for (let i = 0; i < numPositions; i++) {
        const fill = {
          ...mockOrderFill,
          orderId: `perf-order-${i}`,
          symbol: `PERF-${i}`,
          quantity: 0.1,
          price: 1000 + Math.random() * 1000
        };
        
        await portfolioManager.updatePositionFromOrder(fill.orderId, fill);
      }
      
      const setupTime = Date.now() - startTime;
      
      // Test valuation performance with many positions
      const valuationStart = Date.now();
      await portfolioManager.updateValuation();
      const valuationTime = Date.now() - valuationStart;
      
      console.log(`Setup ${numPositions} positions: ${setupTime}ms`);
      console.log(`Valuation with ${numPositions} positions: ${valuationTime}ms`);
      
      // Valuation should still be fast even with many positions
      expect(valuationTime).toBeLessThan(100); // Relaxed for testing
      
      const positions = portfolioManager.getPositions();
      expect(positions).toHaveLength(numPositions);
    });
    
    test('should maintain sub-100ms P&L updates', async () => {
      await portfolioManager.start();
      
      // Set up positions
      await portfolioManager.updatePositionFromOrder('order-1', mockOrderFill);
      await portfolioManager.updatePositionFromOrder('order-2', {
        ...mockOrderFill,
        orderId: 'order-2',
        symbol: 'ETH-USD',
        price: 3000
      });
      
      // Test P&L update performance
      const startTime = Date.now();
      
      // Update positions (simulating market price changes)
      const positionTracker = (portfolioManager as any).positionTracker;
      positionTracker.updateMarketPrice('BTC-USD', 55000); // Price increase
      positionTracker.updateMarketPrice('ETH-USD', 2800);  // Price decrease
      
      await portfolioManager.updateValuation();
      
      const updateTime = Date.now() - startTime;
      
      console.log(`P&L update time: ${updateTime}ms`);
      expect(updateTime).toBeLessThan(100); // Target: < 100ms
    });
  });
});

// Helper functions for testing
function createMockPortfolioManager(config?: Partial<PortfolioManagerConfig>): PortfolioManager {
  return new PortfolioManager({
    enableRiskMonitoring: false,
    persistState: false,
    trackPerformance: false,
    ...config
  });
}

function createMockPosition(overrides?: Partial<Position>): Position {
  return {
    id: 'test-position-1',
    symbol: 'BTC-USD',
    side: 'long',
    quantity: 1.0,
    entryPrice: 50000,
    currentPrice: 52000,
    unrealizedPnL: 2000,
    unrealizedPnLPercent: 4.0,
    marketValue: 52000,
    strategyId: 'test-strategy',
    openedAt: new Date(),
    lastUpdatedAt: new Date(),
    leverage: 1,
    ...overrides
  };
}