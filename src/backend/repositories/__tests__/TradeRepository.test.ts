/**
 * TradeRepository Unit Tests - Task BE-004
 * Comprehensive test suite for TradeRepository with P&L calculations,
 * portfolio metrics, position tracking, and advanced filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { TradeRepository, TradeQueryFilters } from '../TradeRepository';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Trade } from '../../types/database';

// Mock DatabaseManager
vi.mock('../../database/DatabaseManager');

describe('TradeRepository', () => {
  let tradeRepository: TradeRepository;
  let mockDbManager: any;
  let mockQuery: MockedFunction<any>;
  let mockTransaction: MockedFunction<any>;

  const mockTrade: Trade = {
    id: 'trade-001',
    time: new Date('2024-01-15T10:00:00Z'),
    strategy_id: 'strategy-001',
    symbol: 'BTC-USD',
    side: 'buy',
    type: 'market',
    status: 'filled',
    quantity: 1.0,
    price: 50000,
    executed_price: 50100,
    executed_quantity: 1.0,
    remaining_quantity: 0,
    fees: 50.1,
    pnl: 0,
    entry_time: new Date('2024-01-15T10:00:00Z'),
    exit_time: undefined,
    stop_loss: 48000,
    take_profit: 55000,
    order_id: 'order-001',
    exchange_order_id: 'exchange-001',
    metadata: {},
    created_at: new Date('2024-01-15T10:00:00Z'),
    updated_at: new Date('2024-01-15T10:00:00Z'),
  };

  const mockClosedTrade: Trade = {
    ...mockTrade,
    id: 'trade-002',
    exit_time: new Date('2024-01-15T11:00:00Z'),
    pnl: 1000,
    status: 'filled',
    metadata: {
      exit_price: 51100,
      exit_quantity: 1.0,
      roi_percent: 2.0,
      holding_period_ms: 3600000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockQuery = vi.fn();
    mockTransaction = vi.fn();
    
    mockDbManager = {
      getInstance: vi.fn(() => mockDbManager),
      initialize: vi.fn(),
      query: mockQuery,
      transaction: mockTransaction,
      isInitialized: true,
    };

    (DatabaseManager.getInstance as any) = vi.fn(() => mockDbManager);
    
    tradeRepository = new TradeRepository();
    
    // Mock the protected methods access
    (tradeRepository as any).db = mockDbManager;
    (tradeRepository as any).redis = null;
    (tradeRepository as any).pool = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findOpenTrades', () => {
    it('should return open trades for all strategies', async () => {
      const mockOpenTrades = [mockTrade, { ...mockTrade, id: 'trade-003' }];
      
      mockQuery.mockResolvedValueOnce({
        rows: mockOpenTrades,
        rowCount: 2,
      });

      const result = await tradeRepository.findOpenTrades();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.metadata?.rowCount).toBe(2);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN'),
        [],
        expect.objectContaining({ key: 'open_trades:all:all' })
      );
    });

    it('should filter open trades by strategy ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockTrade],
        rowCount: 1,
      });

      const result = await tradeRepository.findOpenTrades('strategy-001');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('t.strategy_id = $1'),
        ['strategy-001'],
        expect.objectContaining({ key: 'open_trades:strategy-001:all' })
      );
    });

    it('should filter open trades by symbol', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockTrade],
        rowCount: 1,
      });

      const result = await tradeRepository.findOpenTrades(undefined, 'BTC-USD');

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('t.symbol = $1'),
        ['BTC-USD'],
        expect.objectContaining({ key: 'open_trades:all:BTC-USD' })
      );
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValueOnce(dbError);

      const result = await tradeRepository.findOpenTrades();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('closeTrade', () => {
    it('should close a trade with correct P&L calculation', async () => {
      const exitPrice = 51000;
      const expectedPnL = (exitPrice - mockTrade.executed_price!) * mockTrade.executed_quantity - 50; // minus exit fees
      
      // Mock transaction callback
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockContext = {
          client: {
            query: vi.fn()
              .mockResolvedValueOnce({ rows: [mockTrade] }) // First query: get trade
              .mockResolvedValueOnce({ rows: [{ ...mockTrade, pnl: expectedPnL, exit_time: new Date() }] }), // Second query: update trade
          },
        };
        
        return await callback(mockContext);
      });

      // Mock cache invalidation
      (tradeRepository as any).invalidateCache = vi.fn();

      const result = await tradeRepository.closeTrade('trade-001', exitPrice);

      expect(result.success).toBe(true);
      expect(result.data?.realizedPnL).toBeCloseTo(expectedPnL, 2);
      expect(result.data?.trade.exit_time).toBeDefined();
      expect(result.data?.breakdownDetails.grossPnL).toBeCloseTo(900, 2); // (51000 - 50100) * 1.0
    });

    it('should handle partial trade closure', async () => {
      const exitPrice = 51000;
      const exitQuantity = 0.5;
      const expectedPnL = (exitPrice - mockTrade.executed_price!) * exitQuantity - 25; // proportional fees
      
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockContext = {
          client: {
            query: vi.fn()
              .mockResolvedValueOnce({ rows: [mockTrade] })
              .mockResolvedValueOnce({ 
                rows: [{ 
                  ...mockTrade, 
                  pnl: expectedPnL, 
                  executed_quantity: exitQuantity,
                  remaining_quantity: 0.5,
                  status: 'partial'
                }] 
              }),
          },
        };
        
        return await callback(mockContext);
      });

      (tradeRepository as any).invalidateCache = vi.fn();

      const result = await tradeRepository.closeTrade('trade-001', exitPrice, exitQuantity);

      expect(result.success).toBe(true);
      expect(result.data?.realizedPnL).toBeCloseTo(expectedPnL, 2);
      expect(result.data?.trade.status).toBe('partial');
      expect(result.data?.trade.remaining_quantity).toBe(0.5);
    });

    it('should reject closing already closed trades', async () => {
      const closedTrade = { ...mockTrade, exit_time: new Date() };
      
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockContext = {
          client: {
            query: vi.fn().mockResolvedValueOnce({ rows: [closedTrade] }),
          },
        };
        
        return await callback(mockContext);
      });

      const result = await tradeRepository.closeTrade('trade-001', 51000);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already closed');
    });

    it('should calculate different P&L for short trades', async () => {
      const shortTrade = { ...mockTrade, side: 'short' as const, executed_price: 50000 };
      const exitPrice = 49000;
      const expectedPnL = (shortTrade.executed_price - exitPrice) * shortTrade.executed_quantity - 50; // Short P&L calculation
      
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockContext = {
          client: {
            query: vi.fn()
              .mockResolvedValueOnce({ rows: [shortTrade] })
              .mockResolvedValueOnce({ rows: [{ ...shortTrade, pnl: expectedPnL }] }),
          },
        };
        
        return await callback(mockContext);
      });

      (tradeRepository as any).invalidateCache = vi.fn();

      const result = await tradeRepository.closeTrade('trade-001', exitPrice);

      expect(result.success).toBe(true);
      expect(result.data?.breakdownDetails.grossPnL).toBe(1000); // (50000 - 49000) * 1.0
    });
  });

  describe('getTradeHistory', () => {
    it('should return paginated trade history with statistics', async () => {
      const mockTrades = [mockTrade, mockClosedTrade];
      
      // Mock count query
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 2 }] }) // Count query
        .mockResolvedValueOnce({ rows: mockTrades }); // Data query

      const filters: TradeQueryFilters = {
        strategyIds: ['strategy-001'],
      };

      const result = await tradeRepository.getTradeHistory(filters, { limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data?.trades).toHaveLength(2);
      expect(result.data?.total).toBe(2);
      expect(result.data?.statistics).toBeDefined();
      expect(result.data?.statistics.totalTrades).toBe(2);
    });

    it('should apply multiple filters correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [mockTrade] });

      const filters: TradeQueryFilters = {
        symbols: ['BTC-USD', 'ETH-USD'],
        sides: ['BUY'],
        minPnL: 0,
        maxPnL: 1000,
        dateFrom: '2024-01-15',
        dateTo: '2024-01-16',
      };

      const result = await tradeRepository.getTradeHistory(filters);

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('t.symbol = ANY($1)'),
        expect.arrayContaining([['BTC-USD', 'ETH-USD']]),
      );
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await tradeRepository.getTradeHistory();

      expect(result.success).toBe(true);
      expect(result.data?.trades).toHaveLength(0);
      expect(result.data?.total).toBe(0);
      expect(result.data?.statistics.totalTrades).toBe(0);
    });

    it('should order results by creation date by default', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [mockTrade] });

      await tradeRepository.getTradeHistory({}, { limit: 10 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY t.created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('calculatePortfolioMetrics', () => {
    it('should calculate comprehensive portfolio metrics', async () => {
      const mockStats = {
        total_trades: '5',
        open_trades: '2',
        closed_trades: '3',
        total_volume: '250000',
        realized_pnl: '1500',
        unrealized_pnl: '500',
        total_pnl: '2000',
        winning_trades: '3',
        losing_trades: '1',
        average_win: '600',
        average_loss: '-300',
        largest_win: '1000',
        largest_loss: '-300',
        total_fees: '150',
        avg_trade_duration: '3600000',
        shortest_trade: '1800000',
        longest_trade: '7200000',
        max_drawdown: '500',
        current_drawdown: '100',
        profit_factor: '2.0',
        win_rate: '0.75',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });
      
      // Mock helper method calls
      (tradeRepository as any).calculateConsecutiveWins = vi.fn().mockResolvedValue(3);
      (tradeRepository as any).calculateConsecutiveLosses = vi.fn().mockResolvedValue(1);
      (tradeRepository as any).calculateSharpeRatio = vi.fn().mockResolvedValue(1.5);
      (tradeRepository as any).calculateSortinoRatio = vi.fn().mockResolvedValue(2.0);

      const result = await tradeRepository.calculatePortfolioMetrics('strategy-001');

      expect(result.success).toBe(true);
      expect(result.data?.strategyId).toBe('strategy-001');
      expect(result.data?.totalTrades).toBe(5);
      expect(result.data?.winRate).toBe(0.75);
      expect(result.data?.totalPnL).toBe(2000);
      expect(result.data?.maxConsecutiveWins).toBe(3);
      expect(result.data?.sharpeRatio).toBe(1.5);
      expect(result.data?.sortinoRatio).toBe(2.0);
    });

    it('should return empty metrics for strategy with no trades', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await tradeRepository.calculatePortfolioMetrics('empty-strategy');

      expect(result.success).toBe(true);
      expect(result.data?.totalTrades).toBe(0);
      expect(result.data?.totalPnL).toBe(0);
      expect(result.data?.winRate).toBe(0);
    });

    it('should use caching for portfolio metrics', async () => {
      const mockStats = { total_trades: '0' };
      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });
      
      (tradeRepository as any).calculateConsecutiveWins = vi.fn().mockResolvedValue(0);
      (tradeRepository as any).calculateConsecutiveLosses = vi.fn().mockResolvedValue(0);
      (tradeRepository as any).calculateSharpeRatio = vi.fn().mockResolvedValue(0);
      (tradeRepository as any).calculateSortinoRatio = vi.fn().mockResolvedValue(0);

      await tradeRepository.calculatePortfolioMetrics('strategy-001');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['strategy-001'],
        expect.objectContaining({
          key: 'portfolio_metrics:strategy-001',
          ttl: 60,
        })
      );
    });
  });

  describe('findTradesByDateRange', () => {
    it('should find trades within date range', async () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-16');
      
      mockQuery.mockResolvedValueOnce({ rows: [mockTrade], rowCount: 1 });

      const result = await tradeRepository.findTradesByDateRange(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('t.time >= $1 AND t.time <= $2'),
        [startDate, endDate],
        expect.objectContaining({ ttl: 300 })
      );
    });

    it('should filter by strategy and symbol', async () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-16');
      
      mockQuery.mockResolvedValueOnce({ rows: [mockTrade] });

      const result = await tradeRepository.findTradesByDateRange(
        startDate, 
        endDate, 
        { strategyId: 'strategy-001', symbol: 'BTC-USD' }
      );

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('t.strategy_id = $3'),
        [startDate, endDate, 'strategy-001', 'BTC-USD'],
        expect.any(Object)
      );
    });

    it('should optimize queries for non-metadata requests', async () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-16');
      
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await tradeRepository.findTradesByDateRange(
        startDate, 
        endDate, 
        { includeMetadata: false }
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('t.id, t.time, t.symbol'),
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('getPositionSummary', () => {
    it('should calculate position summary for open trades', async () => {
      const openTrades = [
        { ...mockTrade, executed_quantity: 1.0, executed_price: 50000 },
        { ...mockTrade, id: 'trade-002', executed_quantity: 0.5, executed_price: 50200 },
      ];

      // Mock findOpenTrades call
      (tradeRepository as any).findOpenTrades = vi.fn().mockResolvedValue({
        success: true,
        data: openTrades,
      });

      const result = await tradeRepository.getPositionSummary('BTC-USD', 'strategy-001', 51000);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTC-USD');
      expect(result.data?.side).toBe('long');
      expect(result.data?.totalQuantity).toBe(1.5);
      expect(result.data?.currentPrice).toBe(51000);
      expect(result.data?.openTrades).toHaveLength(2);
      expect(result.data?.riskMetrics).toBeDefined();
    });

    it('should return null for symbols with no open positions', async () => {
      (tradeRepository as any).findOpenTrades = vi.fn().mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await tradeRepository.getPositionSummary('ETH-USD');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should calculate short position correctly', async () => {
      const shortTrade = { ...mockTrade, side: 'short' as const, executed_quantity: 1.0 };
      
      (tradeRepository as any).findOpenTrades = vi.fn().mockResolvedValue({
        success: true,
        data: [shortTrade],
      });

      const result = await tradeRepository.getPositionSummary('BTC-USD', undefined, 49000);

      expect(result.success).toBe(true);
      expect(result.data?.side).toBe('short');
      expect(result.data?.totalQuantity).toBe(1.0);
      expect(result.data?.unrealizedPnL).toBeGreaterThan(0); // Profit on short position when price drops
    });

    it('should calculate risk metrics correctly', async () => {
      const openTrade = { ...mockTrade, executed_quantity: 2.0, executed_price: 50000 };
      
      (tradeRepository as any).findOpenTrades = vi.fn().mockResolvedValue({
        success: true,
        data: [openTrade],
      });

      const currentPrice = 51000;
      const result = await tradeRepository.getPositionSummary('BTC-USD', undefined, currentPrice);

      expect(result.success).toBe(true);
      expect(result.data?.riskMetrics.exposure).toBe(2.0 * currentPrice);
      expect(result.data?.riskMetrics.var95).toBe((2.0 * currentPrice) * 0.05);
      expect(result.data?.riskMetrics.maxLoss).toBe(2.0 * currentPrice);
    });
  });

  describe('entity validation', () => {
    it('should validate required fields for creation', async () => {
      const invalidTrade = { symbol: 'BTC-USD' }; // Missing strategy_id
      
      await expect(
        (tradeRepository as any).validateEntity(invalidTrade, 'create')
      ).rejects.toThrow('Strategy ID is required');
    });

    it('should validate trade quantities', async () => {
      const invalidTrade = { strategy_id: 'test', symbol: 'BTC-USD', quantity: -1 };
      
      await expect(
        (tradeRepository as any).validateEntity(invalidTrade, 'create')
      ).rejects.toThrow('Quantity must be positive');
    });

    it('should validate trade sides', async () => {
      const invalidTrade = { strategy_id: 'test', symbol: 'BTC-USD', side: 'invalid' };
      
      await expect(
        (tradeRepository as any).validateEntity(invalidTrade, 'create')
      ).rejects.toThrow('Invalid trade side');
    });

    it('should validate executed quantity vs order quantity', async () => {
      const invalidUpdate = { quantity: 1.0, executed_quantity: 2.0 };
      
      await expect(
        (tradeRepository as any).validateEntity(invalidUpdate, 'update')
      ).rejects.toThrow('Executed quantity cannot exceed order quantity');
    });

    it('should allow valid trade data', async () => {
      const validTrade = {
        strategy_id: 'strategy-001',
        symbol: 'BTC-USD',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        price: 50000,
      };
      
      await expect(
        (tradeRepository as any).validateEntity(validTrade, 'create')
      ).resolves.not.toThrow();
    });
  });

  describe('helper methods', () => {
    describe('calculateTradeStatistics', () => {
      it('should calculate statistics for empty trade list', async () => {
        const stats = await (tradeRepository as any).calculateTradeStatistics([]);
        
        expect(stats.totalTrades).toBe(0);
        expect(stats.winningTrades).toBe(0);
        expect(stats.totalPnl).toBe(0);
        expect(stats.winRate).toBe(0);
      });

      it('should calculate statistics for mixed trades', async () => {
        const trades = [
          { ...mockTrade, pnl: 1000, exit_time: new Date(), entry_time: new Date(Date.now() - 3600000) },
          { ...mockTrade, pnl: -500, exit_time: new Date(), entry_time: new Date(Date.now() - 1800000) },
          { ...mockTrade, pnl: 750, exit_time: new Date(), entry_time: new Date(Date.now() - 7200000) },
        ];

        const stats = await (tradeRepository as any).calculateTradeStatistics(trades);
        
        expect(stats.totalTrades).toBe(3);
        expect(stats.winningTrades).toBe(2);
        expect(stats.losingTrades).toBe(1);
        expect(stats.totalPnl).toBe(1250);
        expect(stats.winRate).toBeCloseTo(2/3, 2);
        expect(stats.bestTrade).toBe(1000);
        expect(stats.worstTrade).toBe(-500);
      });
    });
  });

  describe('caching behavior', () => {
    it('should cache open trades results', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockTrade], rowCount: 1 });

      await tradeRepository.findOpenTrades('strategy-001', 'BTC-USD');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          key: 'open_trades:strategy-001:BTC-USD',
          ttl: 30,
        })
      );
    });

    it('should invalidate caches after trade closure', async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockContext = {
          client: {
            query: vi.fn()
              .mockResolvedValueOnce({ rows: [mockTrade] })
              .mockResolvedValueOnce({ rows: [{ ...mockTrade, exit_time: new Date() }] }),
          },
        };
        
        return await callback(mockContext);
      });

      const mockInvalidateCache = vi.fn();
      (tradeRepository as any).invalidateCache = mockInvalidateCache;

      await tradeRepository.closeTrade('trade-001', 51000);

      expect(mockInvalidateCache).toHaveBeenCalledWith([
        'trades:strategy-001:*',
        'portfolio:strategy-001:*',
        'positions:BTC-USD:*',
        'trades:open:*',
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await tradeRepository.findOpenTrades();

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Connection timeout');
      expect(result.metadata?.executionTimeMs).toBeDefined();
    });

    it('should handle transaction rollbacks', async () => {
      mockTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      const result = await tradeRepository.closeTrade('trade-001', 51000);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Transaction failed');
    });

    it('should validate trade existence before closure', async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockContext = {
          client: {
            query: vi.fn().mockResolvedValueOnce({ rows: [] }), // No trade found
          },
        };
        
        return await callback(mockContext);
      });

      const result = await tradeRepository.closeTrade('non-existent', 51000);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });
});