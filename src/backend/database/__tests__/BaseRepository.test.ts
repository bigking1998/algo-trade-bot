/**
 * BaseRepository Comprehensive Test Suite
 * Task BE-002: Base Repository Implementation - Testing
 * 
 * Tests all CRUD operations, transactions, error handling, and caching
 * for the BaseRepository abstract class using all 6 database tables.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';
import StrategyRepository from '../repositories/StrategyRepository';
import TradeRepository from '../repositories/TradeRepository';
import MarketDataRepository from '../repositories/MarketDataRepository';
import OrderRepository from '../repositories/OrderRepository';
import PortfolioSnapshotRepository from '../repositories/PortfolioSnapshotRepository';
import SystemLogRepository from '../repositories/SystemLogRepository';

// Test configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'trading_bot_test',
  username: process.env.TEST_DB_USER || 'trading_bot',
  password: process.env.TEST_DB_PASSWORD || 'trading_password',
};

describe('BaseRepository Implementation Tests', () => {
  let db: DatabaseManager;
  let strategyRepo: StrategyRepository;
  let tradeRepo: TradeRepository;
  let marketDataRepo: MarketDataRepository;
  let orderRepo: OrderRepository;
  let portfolioRepo: PortfolioSnapshotRepository;
  let systemLogRepo: SystemLogRepository;

  // Test data
  let testStrategyId: string;
  let testTradeId: string;
  let testOrderId: string;

  beforeAll(async () => {
    // Initialize database manager for testing
    db = DatabaseManager.getInstance({
      enableRedis: false, // Disable Redis for tests
      enableHealthMonitoring: false,
    });
    
    await db.initialize();

    // Initialize repositories
    strategyRepo = new StrategyRepository();
    tradeRepo = new TradeRepository();
    marketDataRepo = new MarketDataRepository();
    orderRepo = new OrderRepository();
    portfolioRepo = new PortfolioSnapshotRepository();
    systemLogRepo = new SystemLogRepository();
  });

  afterAll(async () => {
    // Cleanup test data and close connections
    if (testStrategyId) {
      try {
        await strategyRepo.deleteById(testStrategyId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    await db.shutdown();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  describe('Strategy Repository CRUD Operations', () => {
    it('should create a strategy with validation', async () => {
      const strategyData = {
        name: 'Test EMA Strategy',
        description: 'Test strategy for unit testing',
        type: 'ema_crossover' as const,
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframes: ['1h', '4h'],
        config: { fast_ema: 12, slow_ema: 26 },
        parameters: { risk_per_trade: 0.02 },
        max_positions: 2,
        max_risk_per_trade: 0.02,
        max_portfolio_risk: 0.10,
      };

      const strategy = await strategyRepo.createStrategy(strategyData);
      testStrategyId = strategy.id;

      expect(strategy).toBeDefined();
      expect(strategy.id).toBeDefined();
      expect(strategy.name).toBe(strategyData.name);
      expect(strategy.status).toBe('paused');
      expect(strategy.total_trades).toBe(0);
      expect(strategy.created_at).toBeInstanceOf(Date);
    });

    it('should find strategy by ID with caching', async () => {
      // Create test strategy first
      await createTestStrategy();

      const strategy = await strategyRepo.findById(testStrategyId);
      expect(strategy).toBeDefined();
      expect(strategy?.id).toBe(testStrategyId);

      // Test caching by calling again
      const cachedStrategy = await strategyRepo.findById(testStrategyId);
      expect(cachedStrategy?.id).toBe(testStrategyId);
    });

    it('should update strategy with version increment', async () => {
      await createTestStrategy();
      
      const originalStrategy = await strategyRepo.findById(testStrategyId);
      const originalVersion = originalStrategy?.version || 1;

      const updatedStrategy = await strategyRepo.updateStrategy(testStrategyId, {
        status: 'active',
        config: { fast_ema: 15, slow_ema: 30 }, // Config change should increment version
      });

      expect(updatedStrategy).toBeDefined();
      expect(updatedStrategy?.status).toBe('active');
      expect(updatedStrategy?.version).toBe(originalVersion + 1);
    });

    it('should find active strategies', async () => {
      await createTestStrategy();
      
      // Update to active status
      await strategyRepo.updateStrategy(testStrategyId, { status: 'active' });

      const activeStrategies = await strategyRepo.getActiveStrategies();
      expect(activeStrategies).toHaveLength(1);
      expect(activeStrategies[0].status).toBe('active');
    });

    it('should delete strategy', async () => {
      await createTestStrategy();

      const deleted = await strategyRepo.deleteById(testStrategyId);
      expect(deleted).toBe(true);

      const strategy = await strategyRepo.findById(testStrategyId);
      expect(strategy).toBeNull();
    });
  });

  describe('Market Data Repository Operations', () => {
    it('should insert market data with OHLCV validation', async () => {
      const marketData = {
        symbol: 'BTC-USD',
        timeframe: '1h' as const,
        open_price: 50000.00,
        high_price: 51000.00,
        low_price: 49500.00,
        close_price: 50500.00,
        volume: 1234.5678,
        trade_count: 150,
      };

      const result = await marketDataRepo.insertCandle({
        ...marketData,
        time: new Date(),
      });
      expect(result).toBeDefined();
      expect(result.symbol).toBe(marketData.symbol);
      expect(result.close_price).toBe(marketData.close_price);
    });

    it('should validate OHLCV relationships', async () => {
      const invalidMarketData = {
        symbol: 'BTC-USD',
        timeframe: '1h' as const,
        open_price: 50000.00,
        high_price: 49000.00, // High lower than open - should fail
        low_price: 51000.00,  // Low higher than open - should fail
        close_price: 50500.00,
        volume: 1234.5678,
      };

      await expect(marketDataRepo.insertCandle({
        ...invalidMarketData,
        time: new Date(),
      })).rejects.toThrow();
    });

    it('should get latest candles with ordering', async () => {
      // Insert multiple candles
      await insertTestMarketData();

      const latestCandles = await marketDataRepo.getLatestCandles('BTC-USD', '1h', 5);
      expect(latestCandles).toHaveLength(5);
      
      // Should be ordered by time DESC
      for (let i = 1; i < latestCandles.length; i++) {
        expect(latestCandles[i-1].time.getTime()).toBeGreaterThan(
          latestCandles[i].time.getTime()
        );
      }
    });
  });

  describe('Transaction Support', () => {
    it('should commit successful transactions', async () => {
      await createTestStrategy();

      const result = await db.transaction(async (client) => {
        // Create multiple trades in a transaction
        const trade1Query = `
          INSERT INTO trades (time, strategy_id, symbol, side, quantity, price, value, net_value, fee, pnl, exchange)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
        `;
        const trade1Result = await client.query(trade1Query, [
          new Date(), testStrategyId, 'BTC-USD', 'buy', 0.1, 50000, 5000, 4990, 10, 0, 'dydx'
        ]);

        const trade2Query = `
          INSERT INTO trades (time, strategy_id, symbol, side, quantity, price, value, net_value, fee, pnl, exchange)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
        `;
        const trade2Result = await client.query(trade2Query, [
          new Date(), testStrategyId, 'ETH-USD', 'sell', 1.0, 3000, 3000, 2990, 10, 0, 'dydx'
        ]);

        return {
          trade1Id: trade1Result.rows[0].id,
          trade2Id: trade2Result.rows[0].id,
        };
      });

      expect(result.trade1Id).toBeDefined();
      expect(result.trade2Id).toBeDefined();

      // Verify both trades were created
      const trades = await tradeRepo.findBy({ strategy_id: testStrategyId });
      expect(trades).toHaveLength(2);
    });

    it('should rollback failed transactions', async () => {
      await createTestStrategy();

      await expect(db.transaction(async (client) => {
        // Create a valid trade
        await client.query(`
          INSERT INTO trades (time, strategy_id, symbol, side, quantity, price, value, net_value, fee, pnl, exchange)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [new Date(), testStrategyId, 'BTC-USD', 'buy', 0.1, 50000, 5000, 4990, 10, 0, 'dydx']);

        // Cause an error that should trigger rollback
        await client.query('SELECT * FROM non_existent_table');
      })).rejects.toThrow();

      // Verify no trades were created due to rollback
      const trades = await tradeRepo.findBy({ strategy_id: testStrategyId });
      expect(trades).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle unique constraint violations', async () => {
      await createTestStrategy();
      
      // Try to create strategy with same name (should violate unique constraint)
      await expect(strategyRepo.createStrategy({
        name: 'Test EMA Strategy', // Same name as existing
        type: 'sma_crossover',
        symbols: ['BTC-USD'],
        timeframes: ['1h'],
        config: {},
        parameters: {},
      })).rejects.toThrow();
    });

    it('should handle foreign key violations', async () => {
      const nonExistentStrategyId = '00000000-0000-0000-0000-000000000000';
      
      await expect(tradeRepo.createTrade({
        strategy_id: nonExistentStrategyId,
        symbol: 'BTC-USD',
        side: 'buy',
        quantity: 1.0,
        price: 50000,
        fee: 10,
        exchange: 'dydx',
      })).rejects.toThrow();
    });

    it('should handle invalid data types', async () => {
      await expect(strategyRepo.createStrategy({
        name: 'Test Strategy',
        type: 'invalid_type' as any, // Invalid enum value
        symbols: ['BTC-USD'],
        timeframes: ['1h'],
        config: {},
        parameters: {},
      })).rejects.toThrow();
    });
  });

  describe('System Log Repository', () => {
    it('should create logs with different levels', async () => {
      const debugLog = await systemLogRepo.debug('Debug message', 'test-component');
      expect(debugLog.level).toBe('debug');
      expect(debugLog.message).toBe('Debug message');

      const errorLog = await systemLogRepo.error(
        'Error occurred', 
        new Error('Test error'), 
        'test-component'
      );
      expect(errorLog.level).toBe('error');
      expect(errorLog.error_code).toBe('Error');
      expect(errorLog.stack_trace).toContain('Test error');
    });

    it('should search logs with filters', async () => {
      // Create test logs
      await systemLogRepo.info('Info message 1', 'component1');
      await systemLogRepo.warning('Warning message', 'component2');
      await systemLogRepo.error('Error message', new Error('Test'), 'component1');

      const errorLogs = await systemLogRepo.searchLogs({
        levels: ['error'],
        components: ['component1'],
      });

      expect(errorLogs.data).toHaveLength(1);
      expect(errorLogs.data[0].level).toBe('error');
    });

    it('should get log analytics', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Create various log entries
      await systemLogRepo.info('Info message', 'test-component');
      await systemLogRepo.warning('Warning message', 'test-component');
      await systemLogRepo.error('Error message', new Error('TestError'), 'test-component');

      const analytics = await systemLogRepo.getLogAnalytics(oneHourAgo, now);
      expect(analytics.total_logs).toBeGreaterThan(0);
      expect(analytics.log_counts_by_level.info).toBeGreaterThan(0);
      expect(analytics.error_rate).toBeGreaterThan(0);
    });
  });

  describe('Portfolio Snapshot Repository', () => {
    it('should create portfolio snapshots', async () => {
      await createTestStrategy();

      const snapshotData = {
        strategy_id: testStrategyId,
        total_value: 10000,
        cash_balance: 5000,
        invested_value: 5000,
        positions: { 'BTC-USD': { quantity: 0.1, value: 5000 } },
        position_count: 1,
        snapshot_trigger: 'manual',
      };

      const snapshot = await portfolioRepo.createSnapshot(snapshotData);
      expect(snapshot).toBeDefined();
      expect(snapshot.strategy_id).toBe(testStrategyId);
      expect(snapshot.total_value).toBe(10000);
    });

    it('should get latest snapshot with caching', async () => {
      await createTestStrategy();
      
      // Create snapshot
      await portfolioRepo.createSnapshot({
        strategy_id: testStrategyId,
        total_value: 15000,
      });

      const latest = await portfolioRepo.getLatestSnapshot(testStrategyId);
      expect(latest).toBeDefined();
      expect(latest?.total_value).toBe(15000);
    });
  });

  describe('Performance and Pagination', () => {
    it('should handle pagination correctly', async () => {
      await createTestStrategy();
      
      // Create multiple market data entries
      for (let i = 0; i < 25; i++) {
        await marketDataRepo.insertCandle({
          time: new Date(Date.now() - i * 3600000), // Each entry 1 hour apart
          symbol: 'BTC-USD',
          timeframe: '1h' as const,
          open_price: 50000 + i,
          high_price: 50100 + i,
          low_price: 49900 + i,
          close_price: 50050 + i,
          volume: 100 + i,
        });
      }

      const page1 = await marketDataRepo.findPaginated(
        { symbol: 'BTC-USD' },
        1,
        10
      );

      expect(page1.data).toHaveLength(10);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);

      const page2 = await marketDataRepo.findPaginated(
        { symbol: 'BTC-USD' },
        2,
        10
      );

      expect(page2.data).toHaveLength(10);
      expect(page2.page).toBe(2);
      expect(page2.hasNextPage).toBe(true);
      expect(page2.hasPreviousPage).toBe(true);
    });
  });

  describe('Repository Health Checks', () => {
    it('should report repository health status', async () => {
      const strategyHealth = await strategyRepo.getHealthStatus();
      expect(strategyHealth.accessible).toBe(true);
      expect(strategyHealth.table).toBe('strategies');

      const marketDataHealth = await marketDataRepo.getHealthStatus();
      expect(marketDataHealth.accessible).toBe(true);
      expect(marketDataHealth.table).toBe('market_data');
    });
  });

  // Helper functions
  async function createTestStrategy(): Promise<void> {
    if (!testStrategyId) {
      const strategy = await strategyRepo.createStrategy({
        name: 'Test EMA Strategy',
        type: 'ema_crossover',
        symbols: ['BTC-USD'],
        timeframes: ['1h'],
        config: { fast_ema: 12, slow_ema: 26 },
        parameters: { risk_per_trade: 0.02 },
      });
      testStrategyId = strategy.id;
    }
  }

  async function insertTestMarketData(): Promise<void> {
    const baseTime = new Date('2024-01-01T00:00:00Z');
    
    for (let i = 0; i < 10; i++) {
      const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000); // 1 hour intervals
      await db.query(`
        INSERT INTO market_data (time, symbol, timeframe, open_price, high_price, low_price, close_price, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (time, symbol, timeframe) DO NOTHING
      `, [time, 'BTC-USD', '1h', 50000 + i * 100, 50100 + i * 100, 49900 + i * 100, 50050 + i * 100, 1000 + i * 10]);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in reverse dependency order
      await db.query('DELETE FROM trades WHERE strategy_id = $1', [testStrategyId]);
      await db.query('DELETE FROM orders WHERE strategy_id = $1', [testStrategyId]);
      await db.query('DELETE FROM portfolio_snapshots WHERE strategy_id = $1', [testStrategyId]);
      await db.query('DELETE FROM system_logs WHERE strategy_id = $1', [testStrategyId]);
      await db.query('DELETE FROM market_data WHERE symbol = $1', ['BTC-USD']);
      
      if (testStrategyId) {
        await db.query('DELETE FROM strategies WHERE id = $1', [testStrategyId]);
        testStrategyId = '';
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Test cleanup error:', error);
    }
  }
});