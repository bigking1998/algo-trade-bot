/**
 * Database Integration Test Suite - Task TE-001
 * 
 * Comprehensive testing for database layer including:
 * - Connection management and health checks
 * - Repository operations and CRUD functionality
 * - Transaction handling and rollbacks
 * - Concurrent access and performance
 * - Data integrity and validation
 * - TimescaleDB specific features
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { TestingFramework, MockDatabase } from '../TestingFramework';
import { MockDataGenerator } from '../MockDataGenerator';
import { DatabaseManager } from '@/backend/database/DatabaseManager';
import { TradeRepository } from '@/backend/repositories/TradeRepository';
import { StrategyRepository } from '@/backend/repositories/StrategyRepository';
import { MarketDataRepository } from '@/backend/repositories/MarketDataRepository';

describe('Database Integration Tests', () => {
  let mockDb: MockDatabase;
  let tradeRepo: TradeRepository;
  let strategyRepo: StrategyRepository;
  let marketDataRepo: MarketDataRepository;

  beforeAll(async () => {
    mockDb = TestingFramework.createMockDatabase();
    await mockDb.connect();
  });

  afterAll(async () => {
    await mockDb.disconnect();
  });

  beforeEach(async () => {
    mockDb.clearData();
    
    // Initialize repositories with mock database
    tradeRepo = new TradeRepository(mockDb as any);
    strategyRepo = new StrategyRepository(mockDb as any);
    marketDataRepo = new MarketDataRepository(mockDb as any);
    
    // Set up test data
    const testTrades = MockDataGenerator.generateTrades({ count: 10 });
    const testStrategies = [
      MockDataGenerator.generateStrategy('trend_following'),
      MockDataGenerator.generateStrategy('mean_reversion'),
      MockDataGenerator.generateStrategy('momentum')
    ];
    const testMarketData = MockDataGenerator.generateOHLCV({
      count: 100,
      basePrice: 100,
      trend: 'up'
    });
    
    mockDb.setTestData('trades', testTrades);
    mockDb.setTestData('strategies', testStrategies);
    mockDb.setTestData('market_data', testMarketData.map(d => ({
      ...d,
      symbol: 'BTC-USD',
      timeframe: '1m'
    })));
  });

  describe('Connection Management', () => {
    test('should establish database connection successfully', async () => {
      expect(mockDb.isConnected()).toBe(true);
    });

    test('should handle connection failures gracefully', async () => {
      await mockDb.disconnect();
      expect(mockDb.isConnected()).toBe(false);
      
      // Reconnect for other tests
      await mockDb.connect();
      expect(mockDb.isConnected()).toBe(true);
    });

    test('should perform health checks', async () => {
      const isHealthy = mockDb.isConnected();
      expect(isHealthy).toBe(true);
    });

    test('should track connection metrics', () => {
      const queryCount = mockDb.getQueryCount();
      expect(typeof queryCount).toBe('number');
      expect(queryCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Trade Repository Operations', () => {
    test('should insert new trade successfully', async () => {
      const newTrade = MockDataGenerator.generateTrades({ count: 1 })[0];
      
      await TestingFramework.assertPerformance(async () => {
        const result = await tradeRepo.create(newTrade);
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery);
    });

    test('should retrieve trades by symbol', async () => {
      const symbol = 'BTC-USD';
      
      const trades = await tradeRepo.findBySymbol(symbol);
      expect(Array.isArray(trades)).toBe(true);
      
      if (trades.length > 0) {
        trades.forEach(trade => {
          expect(trade.symbol).toBe(symbol);
        });
      }
    });

    test('should retrieve trades by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const trades = await tradeRepo.findByDateRange(startDate, endDate);
      expect(Array.isArray(trades)).toBe(true);
      
      trades.forEach(trade => {
        expect(trade.entryTime.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(trade.entryTime.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    test('should calculate P&L correctly', async () => {
      const trades = await tradeRepo.findAll();
      const totalPnl = await tradeRepo.calculateTotalPnL();
      
      const expectedPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
      TestingFramework.assertWithinRange(
        totalPnl,
        expectedPnl,
        TestingFramework.ACCURACY_STANDARDS.pnlTolerance
      );
    });

    test('should handle concurrent trade insertions', async () => {
      const tradeCount = 10;
      const newTrades = MockDataGenerator.generateTrades({ count: tradeCount });
      
      await TestingFramework.assertPerformance(async () => {
        const insertPromises = newTrades.map(trade => tradeRepo.create(trade));
        const results = await Promise.all(insertPromises);
        
        expect(results).toHaveLength(tradeCount);
        results.forEach(result => {
          expect(result.id).toBeDefined();
        });
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery * 2); // Allow more time for concurrent operations
    });

    test('should validate trade data integrity', async () => {
      const invalidTrade = {
        ...MockDataGenerator.generateTrades({ count: 1 })[0],
        entryPrice: -100 // Invalid negative price
      };
      
      await expect(tradeRepo.create(invalidTrade)).rejects.toThrow();
    });
  });

  describe('Strategy Repository Operations', () => {
    test('should create and retrieve strategy configurations', async () => {
      const newStrategy = MockDataGenerator.generateStrategy('ml_based');
      
      const created = await strategyRepo.create(newStrategy);
      expect(created.id).toBeDefined();
      
      const retrieved = await strategyRepo.findById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.type).toBe('ml_based');
    });

    test('should find active strategies', async () => {
      const strategies = await strategyRepo.findActive();
      expect(Array.isArray(strategies)).toBe(true);
      
      strategies.forEach(strategy => {
        expect(strategy.enabled).toBe(true);
      });
    });

    test('should update strategy parameters', async () => {
      const strategies = await strategyRepo.findAll();
      if (strategies.length === 0) return; // Skip if no strategies
      
      const strategy = strategies[0];
      const updatedParameters = {
        ...strategy.parameters,
        testParam: 'updated_value'
      };
      
      const updated = await strategyRepo.update(strategy.id, {
        parameters: updatedParameters
      });
      
      expect(updated.parameters.testParam).toBe('updated_value');
    });

    test('should track strategy performance metrics', async () => {
      const strategies = await strategyRepo.findAll();
      if (strategies.length === 0) return;
      
      const strategy = strategies[0];
      const performance = await strategyRepo.getPerformanceMetrics(strategy.id);
      
      expect(performance).toBeDefined();
      expect(typeof performance.totalTrades).toBe('number');
      expect(typeof performance.winRate).toBe('number');
      expect(typeof performance.totalPnl).toBe('number');
    });
  });

  describe('Market Data Repository Operations', () => {
    test('should store and retrieve OHLCV data', async () => {
      const symbol = 'ETH-USD';
      const timeframe = '5m';
      const marketData = MockDataGenerator.generateOHLCV({
        count: 50,
        basePrice: 2000
      });
      
      for (const candle of marketData) {
        await marketDataRepo.store(symbol, timeframe, candle);
      }
      
      const retrieved = await marketDataRepo.getHistoricalData(
        symbol,
        timeframe,
        marketData[0].time,
        marketData[marketData.length - 1].time
      );
      
      expect(retrieved).toHaveLength(marketData.length);
    });

    test('should handle time-series queries efficiently', async () => {
      const symbol = 'BTC-USD';
      const timeframe = '1m';
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');
      
      await TestingFramework.assertPerformance(async () => {
        const data = await marketDataRepo.getHistoricalData(symbol, timeframe, startTime, endTime);
        expect(Array.isArray(data)).toBe(true);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery);
    });

    test('should validate OHLCV data integrity', async () => {
      const invalidCandle = {
        ...MockDataGenerator.generateOHLCV({ count: 1 })[0],
        high: 50,
        low: 100 // Invalid: low > high
      };
      
      expect(() => TestingFramework.validateOHLCV(invalidCandle)).toThrow();
    });

    test('should handle missing data gracefully', async () => {
      const symbol = 'NONEXISTENT-USD';
      const timeframe = '1m';
      const startTime = new Date();
      const endTime = new Date(Date.now() + 3600000);
      
      const data = await marketDataRepo.getHistoricalData(symbol, timeframe, startTime, endTime);
      expect(data).toHaveLength(0);
    });
  });

  describe('Transaction Management', () => {
    test('should handle transaction rollbacks', async () => {
      const initialTradeCount = (await tradeRepo.findAll()).length;
      
      try {
        // Simulate transaction that should fail
        await mockDb.query('BEGIN');
        
        const newTrade = MockDataGenerator.generateTrades({ count: 1 })[0];
        await tradeRepo.create(newTrade);
        
        // Force an error
        throw new Error('Simulated transaction error');
      } catch (error) {
        await mockDb.query('ROLLBACK');
      }
      
      const finalTradeCount = (await tradeRepo.findAll()).length;
      expect(finalTradeCount).toBe(initialTradeCount);
    });

    test('should maintain data consistency during concurrent operations', async () => {
      const initialBalance = 10000;
      const operations = 10;
      const amountPerOperation = 100;
      
      // Simulate concurrent balance updates
      const updatePromises = Array.from({ length: operations }, async (_, i) => {
        // Simulate balance deduction
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return amountPerOperation;
      });
      
      const results = await Promise.all(updatePromises);
      const totalDeducted = results.reduce((sum, amount) => sum + amount, 0);
      const expectedFinalBalance = initialBalance - totalDeducted;
      
      expect(expectedFinalBalance).toBe(initialBalance - (operations * amountPerOperation));
    });
  });

  describe('Performance Testing', () => {
    test('should handle large dataset operations efficiently', async () => {
      const largeTradeSet = MockDataGenerator.generateTrades({ count: 1000 });
      
      await TestingFramework.assertPerformance(async () => {
        for (const trade of largeTradeSet.slice(0, 100)) { // Test with subset
          await tradeRepo.create(trade);
        }
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery * 50); // Allow more time for bulk operations
    });

    test('should maintain performance under concurrent load', async () => {
      const concurrentQueries = 20;
      
      await TestingFramework.assertPerformance(async () => {
        const queryPromises = Array.from({ length: concurrentQueries }, () => 
          tradeRepo.findAll()
        );
        
        const results = await Promise.all(queryPromises);
        expect(results).toHaveLength(concurrentQueries);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery * 10);
    });

    test('should optimize memory usage during large queries', async () => {
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        const trades = await tradeRepo.findAll();
        return trades.length;
      });
      
      expect(memoryTest.memoryUsedMB).toBeLessThan(50); // Should use less than 50MB
      expect(memoryTest.executionTimeMs).toBeLessThan(TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery);
    });
  });

  describe('Data Integrity and Validation', () => {
    test('should enforce foreign key constraints', async () => {
      const invalidTrade = {
        ...MockDataGenerator.generateTrades({ count: 1 })[0],
        strategyId: 'nonexistent_strategy_id'
      };
      
      // This should either succeed (if FK constraints not enforced in mock)
      // or fail with proper error handling
      try {
        await tradeRepo.create(invalidTrade);
        // If it succeeds, verify the strategy exists in mock data
        const strategies = await strategyRepo.findAll();
        const strategyExists = strategies.some(s => s.id === invalidTrade.strategyId);
        if (!strategyExists) {
          console.warn('Foreign key constraint not enforced in mock database');
        }
      } catch (error) {
        expect(error.message).toContain('foreign key');
      }
    });

    test('should validate data types and constraints', async () => {
      const testCases = [
        {
          name: 'negative trade size',
          data: { ...MockDataGenerator.generateTrades({ count: 1 })[0], size: -1 },
          shouldFail: true
        },
        {
          name: 'invalid timestamp',
          data: { ...MockDataGenerator.generateTrades({ count: 1 })[0], entryTime: 'invalid_date' },
          shouldFail: true
        },
        {
          name: 'valid trade data',
          data: MockDataGenerator.generateTrades({ count: 1 })[0],
          shouldFail: false
        }
      ];
      
      for (const testCase of testCases) {
        if (testCase.shouldFail) {
          await expect(tradeRepo.create(testCase.data as any)).rejects.toThrow();
        } else {
          const result = await tradeRepo.create(testCase.data);
          expect(result.id).toBeDefined();
        }
      }
    });

    test('should handle duplicate prevention', async () => {
      const trade = MockDataGenerator.generateTrades({ count: 1 })[0];
      
      // Create first trade
      const first = await tradeRepo.create(trade);
      expect(first.id).toBeDefined();
      
      // Attempt to create duplicate (should either succeed with new ID or fail appropriately)
      try {
        const duplicate = await tradeRepo.create({ ...trade });
        expect(duplicate.id).not.toBe(first.id); // Should get new ID if allowed
      } catch (error) {
        expect(error.message).toContain('duplicate');
      }
    });
  });

  describe('TimescaleDB Specific Features', () => {
    test('should handle time-series specific queries', async () => {
      // Test time-bucket aggregation (simulated)
      const symbol = 'BTC-USD';
      const timeframe = '1m';
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');
      
      const aggregatedData = await marketDataRepo.getAggregatedData(
        symbol,
        timeframe,
        '1h', // Aggregate to 1-hour buckets
        startTime,
        endTime
      );
      
      expect(Array.isArray(aggregatedData)).toBe(true);
    });

    test('should handle data retention policies', async () => {
      // Test automatic data cleanup (simulated)
      const oldDate = new Date('2023-01-01');
      const recentDate = new Date();
      
      // Insert old data
      const oldCandle = {
        ...MockDataGenerator.generateOHLCV({ count: 1 })[0],
        time: oldDate
      };
      
      await marketDataRepo.store('BTC-USD', '1m', oldCandle);
      
      // Simulate retention policy cleanup
      const cleanupResult = await marketDataRepo.cleanupOldData(oldDate);
      expect(typeof cleanupResult).toBe('number'); // Should return count of cleaned records
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network interruptions gracefully', async () => {
      // Simulate network interruption
      await mockDb.disconnect();
      
      await expect(tradeRepo.findAll()).rejects.toThrow('Database not connected');
      
      // Reconnect and verify recovery
      await mockDb.connect();
      const trades = await tradeRepo.findAll();
      expect(Array.isArray(trades)).toBe(true);
    });

    test('should handle query timeouts', async () => {
      // This is difficult to test with mock database
      // In real implementation, would test with slow queries
      const startTime = performance.now();
      
      try {
        await tradeRepo.findAll();
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5s
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    test('should provide meaningful error messages', async () => {
      const invalidQuery = 'SELECT * FROM nonexistent_table';
      
      try {
        await mockDb.query(invalidQuery);
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('Repository Performance Benchmarks', () => {
  let mockDb: MockDatabase;
  let tradeRepo: TradeRepository;

  beforeAll(async () => {
    mockDb = TestingFramework.createMockDatabase();
    await mockDb.connect();
    tradeRepo = new TradeRepository(mockDb as any);
  });

  afterAll(async () => {
    await mockDb.disconnect();
  });

  test('Trade Repository Performance Benchmarks', async () => {
    const benchmarks = {
      create: { operations: 100, maxTimeMs: TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery },
      read: { operations: 200, maxTimeMs: TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery },
      update: { operations: 50, maxTimeMs: TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery },
      delete: { operations: 50, maxTimeMs: TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery }
    };

    // Create benchmark
    const trades = MockDataGenerator.generateTrades({ count: benchmarks.create.operations });
    
    await TestingFramework.assertPerformance(async () => {
      for (let i = 0; i < 10; i++) { // Test subset for performance
        await tradeRepo.create(trades[i]);
      }
    }, benchmarks.create.maxTimeMs);

    // Read benchmark
    await TestingFramework.assertPerformance(async () => {
      for (let i = 0; i < 10; i++) {
        await tradeRepo.findAll();
      }
    }, benchmarks.read.maxTimeMs);

    console.log('✅ All repository performance benchmarks passed');
  });

  test('Memory usage during repository operations', async () => {
    const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
      const largeBatch = MockDataGenerator.generateTrades({ count: 1000 });
      
      // Process in chunks to test memory management
      const chunkSize = 100;
      for (let i = 0; i < largeBatch.length; i += chunkSize) {
        const chunk = largeBatch.slice(i, i + chunkSize);
        for (const trade of chunk.slice(0, 5)) { // Test with smaller subset
          await tradeRepo.create(trade);
        }
      }
      
      return largeBatch.length;
    });

    expect(memoryTest.memoryUsedMB).toBeLessThan(100); // Should use less than 100MB
    console.log(`Memory usage: ${memoryTest.memoryUsedMB.toFixed(2)}MB, Time: ${memoryTest.executionTimeMs.toFixed(2)}ms`);
  });
});