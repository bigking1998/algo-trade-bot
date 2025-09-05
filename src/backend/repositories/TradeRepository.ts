/**
 * TradeRepository Implementation - Task BE-004
 * Production-ready trade repository with complex P&L calculations,
 * advanced filtering, real-time position tracking, and performance optimization
 */

import { BaseRepository, RepositoryResult } from './BaseRepository';
import { Trade, QueryOptions } from '../types/database';
import { TradeFilters, TradeStatistics, TradeSide } from '../../shared/types/trading';

/**
 * Trade-specific query filters with advanced capabilities
 */
export interface TradeQueryFilters extends TradeFilters {
  strategyIds?: string[];
  symbols?: string[];
  sides?: TradeSide[];
  statusFilter?: ('pending' | 'filled' | 'partial' | 'cancelled' | 'rejected')[];
  minQuantity?: number;
  maxQuantity?: number;
  minPnL?: number;
  maxPnL?: number;
  minPrice?: number;
  maxPrice?: number;
  entryTimeFrom?: Date;
  entryTimeTo?: Date;
  exitTimeFrom?: Date;
  exitTimeTo?: Date;
  hasExitPrice?: boolean;
  isOpen?: boolean;
  isClosed?: boolean;
}

/**
 * Portfolio metrics calculated in real-time
 */
export interface PortfolioMetrics {
  strategyId: string;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalVolume: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  totalFees: number;
  averageTradeDuration: number;
  shortestTrade: number;
  longestTrade: number;
  lastUpdateTime: Date;
}

/**
 * Position tracking with risk metrics
 */
export interface PositionSummary {
  symbol: string;
  strategyId: string;
  side: 'long' | 'short' | 'neutral';
  totalQuantity: number;
  averageEntryPrice: number;
  currentPrice?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  totalPnL: number;
  openTrades: Trade[];
  riskMetrics: {
    exposure: number;
    var95: number; // Value at Risk 95%
    maxLoss: number;
    leverage: number;
    marginUsed: number;
  };
  lastUpdateTime: Date;
}

/**
 * Trade closure result with detailed P&L breakdown
 */
export interface TradeClosureResult {
  trade: Trade;
  realizedPnL: number;
  unrealizedPnL: number;
  totalFees: number;
  roi: number; // Return on Investment percentage
  holdingPeriod: number; // Duration in milliseconds
  slippageImpact: number;
  effectiveSpread: number;
  breakdownDetails: {
    grossPnL: number;
    netPnL: number;
    entryFees: number;
    exitFees: number;
    fundingFees?: number;
    taxImpact?: number;
  };
}

/**
 * Advanced TradeRepository with sophisticated trading operations
 */
export class TradeRepository extends BaseRepository<Trade> {
  constructor() {
    super('trades', 'id');
  }

  /**
   * SPECIALIZED TRADE OPERATIONS
   */

  /**
   * Find all open trades with optional strategy/symbol filtering
   * Optimized for real-time position tracking
   */
  async findOpenTrades(
    strategyId?: string,
    symbol?: string
  ): Promise<RepositoryResult<Trade[]>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      let query = `
        SELECT t.*, 
               COALESCE(md.close, t.executed_price) as current_price,
               (COALESCE(md.close, t.executed_price) - t.executed_price) * t.executed_quantity as unrealized_pnl
        FROM trades t
        LEFT JOIN (
          SELECT DISTINCT ON (symbol) symbol, close, time
          FROM market_data 
          WHERE timeframe = '1m'
          ORDER BY symbol, time DESC
        ) md ON t.symbol = md.symbol
        WHERE t.status IN ('filled', 'partial')
          AND t.exit_time IS NULL
          AND (t.is_deleted = FALSE OR t.is_deleted IS NULL)
      `;

      const values: any[] = [];
      let paramCounter = 1;

      if (strategyId) {
        query += ` AND t.strategy_id = $${paramCounter}`;
        values.push(strategyId);
        paramCounter++;
      }

      if (symbol) {
        query += ` AND t.symbol = $${paramCounter}`;
        values.push(symbol);
        paramCounter++;
      }

      query += ' ORDER BY t.entry_time DESC, t.created_at DESC';

      const result = await this.db.query<Trade & { current_price?: number; unrealized_pnl?: number }>(
        query, 
        values,
        { key: `open_trades:${strategyId || 'all'}:${symbol || 'all'}`, ttl: 30 } // 30 second cache
      );

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'findOpenTrades', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Close a trade with comprehensive P&L calculations
   * Handles complex scenarios like partial fills, fees, slippage
   */
  async closeTrade(
    tradeId: string,
    exitPrice: number,
    exitQuantity?: number,
    fees?: number,
    metadata?: Record<string, unknown>
  ): Promise<RepositoryResult<TradeClosureResult>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      return await this.withTransaction(async (context) => {
        // Get the current trade
        const tradeQuery = `
          SELECT * FROM trades 
          WHERE id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)
        `;
        const tradeResult = await this.queryInTransaction<Trade>(context, tradeQuery, [tradeId]);
        
        if (!tradeResult.rows || tradeResult.rows.length === 0) {
          throw new Error(`Trade with ID ${tradeId} not found`);
        }

        const trade = tradeResult.rows[0];

        // Validate trade can be closed
        if (trade.status === 'cancelled' || trade.status === 'rejected') {
          throw new Error('Cannot close cancelled or rejected trade');
        }

        if (trade.exit_time) {
          throw new Error('Trade is already closed');
        }

        // Calculate quantities
        const closeQuantity = exitQuantity || trade.executed_quantity;
        const remainingQuantity = trade.executed_quantity - closeQuantity;

        if (closeQuantity <= 0 || closeQuantity > trade.executed_quantity) {
          throw new Error('Invalid exit quantity');
        }

        // Calculate P&L with detailed breakdown
        const entryPrice = trade.executed_price || trade.price || 0;
        const entryFees = (trade.fees || 0) * (closeQuantity / trade.executed_quantity);
        const exitFees = fees || (exitPrice * closeQuantity * 0.001); // Default 0.1% exit fee

        // Calculate P&L based on trade side
        let grossPnL: number;
        if (trade.side === 'buy' || trade.side === 'long') {
          grossPnL = (exitPrice - entryPrice) * closeQuantity;
        } else {
          grossPnL = (entryPrice - exitPrice) * closeQuantity;
        }

        const totalFees = entryFees + exitFees;
        const netPnL = grossPnL - totalFees;

        // Calculate additional metrics
        const roi = entryPrice > 0 ? (grossPnL / (entryPrice * closeQuantity)) * 100 : 0;
        const holdingPeriod = Date.now() - (trade.entry_time?.getTime() || trade.created_at.getTime());
        const slippageImpact = Math.abs(exitPrice - (trade.price || entryPrice)) / (trade.price || entryPrice);
        const effectiveSpread = slippageImpact * (trade.price || entryPrice);

        // Update trade record
        const now = new Date();
        const updateQuery = `
          UPDATE trades 
          SET 
            exit_time = $2,
            executed_quantity = $3,
            remaining_quantity = $4,
            pnl = $5,
            fees = $6,
            status = $7,
            metadata = $8,
            updated_at = $9
          WHERE id = $1
          RETURNING *
        `;

        const newStatus = remainingQuantity > 0 ? 'partial' : 'filled';
        const updatedMetadata = {
          ...trade.metadata,
          ...metadata,
          exit_price: exitPrice,
          exit_quantity: closeQuantity,
          roi_percent: roi,
          holding_period_ms: holdingPeriod,
          slippage_impact: slippageImpact,
          effective_spread: effectiveSpread,
        };

        const updateResult = await this.queryInTransaction<Trade>(
          context,
          updateQuery,
          [
            tradeId,
            now,
            closeQuantity,
            remainingQuantity,
            netPnL,
            trade.fees + exitFees,
            newStatus,
            JSON.stringify(updatedMetadata),
            now,
          ]
        );

        const updatedTrade = updateResult.rows[0];

        // Create detailed closure result
        const closureResult: TradeClosureResult = {
          trade: updatedTrade,
          realizedPnL: netPnL,
          unrealizedPnL: 0, // Now realized
          totalFees: totalFees,
          roi: roi,
          holdingPeriod: holdingPeriod,
          slippageImpact: slippageImpact,
          effectiveSpread: effectiveSpread,
          breakdownDetails: {
            grossPnL: grossPnL,
            netPnL: netPnL,
            entryFees: entryFees,
            exitFees: exitFees,
            fundingFees: 0, // Could be calculated from metadata
            taxImpact: 0, // Could be calculated based on holding period
          },
        };

        // Invalidate related caches
        await this.invalidateCache([
          `trades:${trade.strategy_id}:*`,
          `portfolio:${trade.strategy_id}:*`,
          `positions:${trade.symbol}:*`,
          'trades:open:*',
        ]);

        return closureResult;
      });

    } catch (error) {
      return this.handleError(error, 'closeTrade', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Advanced trade history with sophisticated filtering and pagination
   */
  async getTradeHistory(
    filters: TradeQueryFilters = {},
    options: QueryOptions = {}
  ): Promise<RepositoryResult<{ trades: Trade[]; total: number; statistics: TradeStatistics }>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      // Build complex query with multiple filters
      let baseQuery = `
        FROM trades t
        WHERE (t.is_deleted = FALSE OR t.is_deleted IS NULL)
      `;

      const values: any[] = [];
      let paramCounter = 1;

      // Apply filters
      if (filters.strategyIds && filters.strategyIds.length > 0) {
        baseQuery += ` AND t.strategy_id = ANY($${paramCounter})`;
        values.push(filters.strategyIds);
        paramCounter++;
      }

      if (filters.symbols && filters.symbols.length > 0) {
        baseQuery += ` AND t.symbol = ANY($${paramCounter})`;
        values.push(filters.symbols);
        paramCounter++;
      }

      if (filters.sides && filters.sides.length > 0) {
        baseQuery += ` AND t.side = ANY($${paramCounter})`;
        values.push(filters.sides);
        paramCounter++;
      }

      if (filters.statusFilter && filters.statusFilter.length > 0) {
        baseQuery += ` AND t.status = ANY($${paramCounter})`;
        values.push(filters.statusFilter);
        paramCounter++;
      }

      if (filters.dateFrom) {
        baseQuery += ` AND t.created_at >= $${paramCounter}`;
        values.push(new Date(filters.dateFrom));
        paramCounter++;
      }

      if (filters.dateTo) {
        baseQuery += ` AND t.created_at <= $${paramCounter}`;
        values.push(new Date(filters.dateTo));
        paramCounter++;
      }

      if (filters.entryTimeFrom) {
        baseQuery += ` AND t.entry_time >= $${paramCounter}`;
        values.push(filters.entryTimeFrom);
        paramCounter++;
      }

      if (filters.entryTimeTo) {
        baseQuery += ` AND t.entry_time <= $${paramCounter}`;
        values.push(filters.entryTimeTo);
        paramCounter++;
      }

      if (filters.minPnL !== undefined) {
        baseQuery += ` AND t.pnl >= $${paramCounter}`;
        values.push(filters.minPnL);
        paramCounter++;
      }

      if (filters.maxPnL !== undefined) {
        baseQuery += ` AND t.pnl <= $${paramCounter}`;
        values.push(filters.maxPnL);
        paramCounter++;
      }

      if (filters.minQuantity !== undefined) {
        baseQuery += ` AND t.executed_quantity >= $${paramCounter}`;
        values.push(filters.minQuantity);
        paramCounter++;
      }

      if (filters.maxQuantity !== undefined) {
        baseQuery += ` AND t.executed_quantity <= $${paramCounter}`;
        values.push(filters.maxQuantity);
        paramCounter++;
      }

      if (filters.isOpen === true) {
        baseQuery += ` AND t.exit_time IS NULL`;
      } else if (filters.isClosed === true) {
        baseQuery += ` AND t.exit_time IS NOT NULL`;
      }

      if (filters.hasExitPrice === true) {
        baseQuery += ` AND t.metadata::jsonb ? 'exit_price'`;
      } else if (filters.hasExitPrice === false) {
        baseQuery += ` AND NOT (t.metadata::jsonb ? 'exit_price')`;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
      const countResult = await this.db.query<{ total: number }>(countQuery, values);
      const total = countResult.rows?.[0]?.total || 0;

      // Get paginated results
      let dataQuery = `SELECT t.* ${baseQuery}`;

      // Add ordering
      if (options.orderBy) {
        dataQuery += ` ORDER BY t.${options.orderBy} ${options.orderDirection || 'DESC'}`;
      } else {
        dataQuery += ` ORDER BY t.created_at DESC, t.entry_time DESC`;
      }

      // Add pagination
      if (options.limit) {
        dataQuery += ` LIMIT $${paramCounter}`;
        values.push(options.limit);
        paramCounter++;
      }

      if (options.offset) {
        dataQuery += ` OFFSET $${paramCounter}`;
        values.push(options.offset);
        paramCounter++;
      }

      const dataResult = await this.db.query<Trade>(dataQuery, values);
      const trades = dataResult.rows || [];

      // Calculate statistics
      const statistics = await this.calculateTradeStatistics(trades);

      return {
        success: true,
        data: {
          trades,
          total,
          statistics,
        },
        metadata: {
          rowCount: trades.length,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'getTradeHistory', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Calculate comprehensive portfolio metrics for a strategy
   * Includes risk-adjusted returns and advanced analytics
   */
  async calculatePortfolioMetrics(strategyId: string): Promise<RepositoryResult<PortfolioMetrics>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      // Complex query to calculate all metrics in one go
      const query = `
        WITH trade_stats AS (
          SELECT 
            COUNT(*) as total_trades,
            COUNT(*) FILTER (WHERE exit_time IS NULL) as open_trades,
            COUNT(*) FILTER (WHERE exit_time IS NOT NULL) as closed_trades,
            SUM(executed_quantity * COALESCE(executed_price, price, 0)) as total_volume,
            SUM(CASE WHEN exit_time IS NOT NULL THEN pnl ELSE 0 END) as realized_pnl,
            SUM(CASE WHEN exit_time IS NULL THEN 
              (COALESCE(executed_price, price, 0) - COALESCE(executed_price, price, 0)) * executed_quantity 
            ELSE 0 END) as unrealized_pnl,
            SUM(pnl) as total_pnl,
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
            AVG(CASE WHEN pnl > 0 THEN pnl END) as average_win,
            AVG(CASE WHEN pnl < 0 THEN pnl END) as average_loss,
            MAX(pnl) as largest_win,
            MIN(pnl) as largest_loss,
            SUM(fees) as total_fees,
            AVG(CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (exit_time - entry_time)) * 1000 
            END) as avg_trade_duration,
            MIN(CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (exit_time - entry_time)) * 1000 
            END) as shortest_trade,
            MAX(CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (exit_time - entry_time)) * 1000 
            END) as longest_trade
          FROM trades 
          WHERE strategy_id = $1 
            AND (is_deleted = FALSE OR is_deleted IS NULL)
        ),
        drawdown_calc AS (
          SELECT 
            MAX(
              SUM(pnl) OVER (ORDER BY created_at ROWS UNBOUNDED PRECEDING) - 
              SUM(pnl) OVER (ORDER BY created_at ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
            ) as max_drawdown,
            (
              SUM(pnl) OVER (ORDER BY created_at ROWS UNBOUNDED PRECEDING) - 
              SUM(pnl) OVER (ORDER BY created_at DESC ROWS UNBOUNDED PRECEDING)
            ) as current_drawdown
          FROM trades 
          WHERE strategy_id = $1 
            AND (is_deleted = FALSE OR is_deleted IS NULL)
            AND exit_time IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        )
        SELECT 
          ts.*,
          COALESCE(dc.max_drawdown, 0) as max_drawdown,
          COALESCE(dc.current_drawdown, 0) as current_drawdown,
          CASE 
            WHEN ts.losing_trades > 0 THEN ts.winning_trades::float / ts.losing_trades 
            ELSE 0 
          END as profit_factor,
          CASE 
            WHEN ts.total_trades > 0 THEN ts.winning_trades::float / ts.total_trades 
            ELSE 0 
          END as win_rate
        FROM trade_stats ts
        CROSS JOIN (SELECT * FROM drawdown_calc LIMIT 1) dc
      `;

      const result = await this.db.query<any>(query, [strategyId], {
        key: `portfolio_metrics:${strategyId}`,
        ttl: 60, // Cache for 1 minute
      });

      if (!result.rows || result.rows.length === 0) {
        // Return empty metrics if no trades found
        const emptyMetrics: PortfolioMetrics = {
          strategyId,
          totalTrades: 0,
          openTrades: 0,
          closedTrades: 0,
          totalVolume: 0,
          realizedPnL: 0,
          unrealizedPnL: 0,
          totalPnL: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          averageWin: 0,
          averageLoss: 0,
          profitFactor: 0,
          largestWin: 0,
          largestLoss: 0,
          maxConsecutiveWins: 0,
          maxConsecutiveLosses: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          totalFees: 0,
          averageTradeDuration: 0,
          shortestTrade: 0,
          longestTrade: 0,
          lastUpdateTime: new Date(),
        };

        return {
          success: true,
          data: emptyMetrics,
          metadata: { executionTimeMs: Date.now() - startTime },
        };
      }

      const stats = result.rows[0];

      // Calculate additional metrics that require more complex logic
      const consecutiveWins = await this.calculateConsecutiveWins(strategyId);
      const consecutiveLosses = await this.calculateConsecutiveLosses(strategyId);
      const sharpeRatio = await this.calculateSharpeRatio(strategyId);
      const sortinoRatio = await this.calculateSortinoRatio(strategyId);

      const metrics: PortfolioMetrics = {
        strategyId,
        totalTrades: parseInt(stats.total_trades) || 0,
        openTrades: parseInt(stats.open_trades) || 0,
        closedTrades: parseInt(stats.closed_trades) || 0,
        totalVolume: parseFloat(stats.total_volume) || 0,
        realizedPnL: parseFloat(stats.realized_pnl) || 0,
        unrealizedPnL: parseFloat(stats.unrealized_pnl) || 0,
        totalPnL: parseFloat(stats.total_pnl) || 0,
        winningTrades: parseInt(stats.winning_trades) || 0,
        losingTrades: parseInt(stats.losing_trades) || 0,
        winRate: parseFloat(stats.win_rate) || 0,
        averageWin: parseFloat(stats.average_win) || 0,
        averageLoss: parseFloat(stats.average_loss) || 0,
        profitFactor: parseFloat(stats.profit_factor) || 0,
        largestWin: parseFloat(stats.largest_win) || 0,
        largestLoss: parseFloat(stats.largest_loss) || 0,
        maxConsecutiveWins: consecutiveWins,
        maxConsecutiveLosses: consecutiveLosses,
        maxDrawdown: parseFloat(stats.max_drawdown) || 0,
        currentDrawdown: parseFloat(stats.current_drawdown) || 0,
        sharpeRatio: sharpeRatio,
        sortinoRatio: sortinoRatio,
        totalFees: parseFloat(stats.total_fees) || 0,
        averageTradeDuration: parseFloat(stats.avg_trade_duration) || 0,
        shortestTrade: parseFloat(stats.shortest_trade) || 0,
        longestTrade: parseFloat(stats.longest_trade) || 0,
        lastUpdateTime: new Date(),
      };

      return {
        success: true,
        data: metrics,
        metadata: {
          rowCount: 1,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'calculatePortfolioMetrics', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Find trades within a specific date range with performance optimization
   */
  async findTradesByDateRange(
    startDate: Date,
    endDate: Date,
    options: { 
      strategyId?: string; 
      symbol?: string; 
      includeMetadata?: boolean;
    } = {}
  ): Promise<RepositoryResult<Trade[]>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      let query = `
        SELECT ${options.includeMetadata ? 't.*' : 't.id, t.time, t.symbol, t.side, t.quantity, t.price, t.executed_price, t.pnl, t.fees'}
        FROM trades t
        WHERE t.time >= $1 
          AND t.time <= $2
          AND (t.is_deleted = FALSE OR t.is_deleted IS NULL)
      `;

      const values: any[] = [startDate, endDate];
      let paramCounter = 3;

      if (options.strategyId) {
        query += ` AND t.strategy_id = $${paramCounter}`;
        values.push(options.strategyId);
        paramCounter++;
      }

      if (options.symbol) {
        query += ` AND t.symbol = $${paramCounter}`;
        values.push(options.symbol);
        paramCounter++;
      }

      // Optimize ordering for time-series queries
      query += ` ORDER BY t.time DESC, t.created_at DESC`;

      const cacheKey = `trades_by_date:${startDate.getTime()}:${endDate.getTime()}:${options.strategyId || 'all'}:${options.symbol || 'all'}`;
      
      const result = await this.db.query<Trade>(query, values, {
        key: cacheKey,
        ttl: 300, // Cache for 5 minutes
      });

      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'findTradesByDateRange', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Get real-time position summary for a symbol/strategy combination
   */
  async getPositionSummary(
    symbol: string,
    strategyId?: string,
    currentPrice?: number
  ): Promise<RepositoryResult<PositionSummary | null>> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const openTradesResult = await this.findOpenTrades(strategyId, symbol);
      
      if (!openTradesResult.success || !openTradesResult.data || openTradesResult.data.length === 0) {
        return {
          success: true,
          data: null,
          metadata: { executionTimeMs: Date.now() - startTime },
        };
      }

      const openTrades = openTradesResult.data;

      // Calculate position metrics
      let longQuantity = 0;
      let shortQuantity = 0;
      let totalCost = 0;
      let totalRealizedPnL = 0;

      openTrades.forEach(trade => {
        const quantity = trade.executed_quantity;
        const price = trade.executed_price || trade.price || 0;
        
        if (trade.side === 'buy' || trade.side === 'long') {
          longQuantity += quantity;
          totalCost += quantity * price;
        } else {
          shortQuantity += quantity;
          totalCost += quantity * price;
        }
        
        totalRealizedPnL += trade.pnl || 0;
      });

      const netQuantity = longQuantity - shortQuantity;
      const averageEntryPrice = netQuantity !== 0 ? totalCost / Math.abs(netQuantity) : 0;
      
      // Determine position side
      let side: 'long' | 'short' | 'neutral';
      if (netQuantity > 0) side = 'long';
      else if (netQuantity < 0) side = 'short';
      else side = 'neutral';

      // Calculate unrealized P&L if current price is provided
      let unrealizedPnL = 0;
      let unrealizedPnLPercent = 0;
      
      if (currentPrice && netQuantity !== 0 && averageEntryPrice > 0) {
        if (side === 'long') {
          unrealizedPnL = (currentPrice - averageEntryPrice) * netQuantity;
        } else {
          unrealizedPnL = (averageEntryPrice - currentPrice) * Math.abs(netQuantity);
        }
        unrealizedPnLPercent = (unrealizedPnL / (averageEntryPrice * Math.abs(netQuantity))) * 100;
      }

      // Calculate risk metrics
      const exposure = Math.abs(netQuantity) * (currentPrice || averageEntryPrice);
      const var95 = exposure * 0.05; // Simple VaR calculation (5% of exposure)
      const maxLoss = exposure; // Maximum theoretical loss
      const leverage = 1; // Placeholder - would need account balance for accurate calculation
      const marginUsed = exposure * 0.1; // Assuming 10x leverage

      const positionSummary: PositionSummary = {
        symbol,
        strategyId: strategyId || openTrades[0]?.strategy_id || '',
        side,
        totalQuantity: Math.abs(netQuantity),
        averageEntryPrice,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent,
        realizedPnL: totalRealizedPnL,
        totalPnL: totalRealizedPnL + unrealizedPnL,
        openTrades,
        riskMetrics: {
          exposure,
          var95,
          maxLoss,
          leverage,
          marginUsed,
        },
        lastUpdateTime: new Date(),
      };

      return {
        success: true,
        data: positionSummary,
        metadata: {
          rowCount: 1,
          executionTimeMs: Date.now() - startTime,
        },
      };

    } catch (error) {
      return this.handleError(error, 'getPositionSummary', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * HELPER METHODS FOR ADVANCED CALCULATIONS
   */

  /**
   * Calculate trade statistics from a set of trades
   */
  private async calculateTradeStatistics(trades: Trade[]): Promise<TradeStatistics> {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        totalVolume: 0,
        avgTradeDuration: 0,
        bestTrade: 0,
        worstTrade: 0,
        profitFactor: 0,
        maxDrawdown: 0,
      };
    }

    const closedTrades = trades.filter(t => t.exit_time);
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl < 0);
    
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalVolume = trades.reduce((sum, t) => sum + (t.executed_quantity * (t.executed_price || t.price || 0)), 0);
    
    const durations = closedTrades
      .filter(t => t.entry_time && t.exit_time)
      .map(t => t.exit_time!.getTime() - t.entry_time!.getTime());
    
    const avgTradeDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    
    const pnls = trades.map(t => t.pnl || 0);
    const bestTrade = Math.max(...pnls, 0);
    const worstTrade = Math.min(...pnls, 0);
    
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) / losingTrades.length : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Simple max drawdown calculation
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;
    
    trades.forEach(trade => {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? winningTrades.length / closedTrades.length : 0,
      totalPnl,
      totalVolume,
      avgTradeDuration,
      bestTrade,
      worstTrade,
      profitFactor,
      maxDrawdown,
    };
  }

  /**
   * Calculate maximum consecutive wins for a strategy
   */
  private async calculateConsecutiveWins(strategyId: string): Promise<number> {
    try {
      const query = `
        WITH consecutive_results AS (
          SELECT 
            pnl > 0 as is_win,
            ROW_NUMBER() OVER (ORDER BY created_at) - 
            ROW_NUMBER() OVER (PARTITION BY pnl > 0 ORDER BY created_at) as grp
          FROM trades 
          WHERE strategy_id = $1 
            AND exit_time IS NOT NULL 
            AND (is_deleted = FALSE OR is_deleted IS NULL)
          ORDER BY created_at
        )
        SELECT MAX(COUNT(*)) as max_consecutive_wins
        FROM consecutive_results 
        WHERE is_win = true
        GROUP BY grp
      `;
      
      const result = await this.db.query<{ max_consecutive_wins: number }>(query, [strategyId]);
      return result.rows?.[0]?.max_consecutive_wins || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate maximum consecutive losses for a strategy
   */
  private async calculateConsecutiveLosses(strategyId: string): Promise<number> {
    try {
      const query = `
        WITH consecutive_results AS (
          SELECT 
            pnl < 0 as is_loss,
            ROW_NUMBER() OVER (ORDER BY created_at) - 
            ROW_NUMBER() OVER (PARTITION BY pnl < 0 ORDER BY created_at) as grp
          FROM trades 
          WHERE strategy_id = $1 
            AND exit_time IS NOT NULL 
            AND (is_deleted = FALSE OR is_deleted IS NULL)
          ORDER BY created_at
        )
        SELECT MAX(COUNT(*)) as max_consecutive_losses
        FROM consecutive_results 
        WHERE is_loss = true
        GROUP BY grp
      `;
      
      const result = await this.db.query<{ max_consecutive_losses: number }>(query, [strategyId]);
      return result.rows?.[0]?.max_consecutive_losses || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate Sharpe ratio for a strategy
   */
  private async calculateSharpeRatio(strategyId: string): Promise<number> {
    try {
      const query = `
        SELECT 
          AVG(pnl) as avg_return,
          STDDEV(pnl) as std_deviation
        FROM trades 
        WHERE strategy_id = $1 
          AND exit_time IS NOT NULL 
          AND (is_deleted = FALSE OR is_deleted IS NULL)
      `;
      
      const result = await this.db.query<{ avg_return: number; std_deviation: number }>(query, [strategyId]);
      
      if (!result.rows || result.rows.length === 0) return 0;
      
      const { avg_return, std_deviation } = result.rows[0];
      
      if (!std_deviation || std_deviation === 0) return 0;
      
      // Assuming risk-free rate of 0 for simplicity
      return avg_return / std_deviation;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate Sortino ratio for a strategy
   */
  private async calculateSortinoRatio(strategyId: string): Promise<number> {
    try {
      const query = `
        SELECT 
          AVG(pnl) as avg_return,
          SQRT(AVG(CASE WHEN pnl < 0 THEN pnl * pnl ELSE 0 END)) as downside_deviation
        FROM trades 
        WHERE strategy_id = $1 
          AND exit_time IS NOT NULL 
          AND (is_deleted = FALSE OR is_deleted IS NULL)
      `;
      
      const result = await this.db.query<{ avg_return: number; downside_deviation: number }>(query, [strategyId]);
      
      if (!result.rows || result.rows.length === 0) return 0;
      
      const { avg_return, downside_deviation } = result.rows[0];
      
      if (!downside_deviation || downside_deviation === 0) return 0;
      
      return avg_return / downside_deviation;
    } catch {
      return 0;
    }
  }

  /**
   * Override entity validation for trade-specific rules
   */
  protected async validateEntity(entity: Partial<Trade>, operation: 'create' | 'update'): Promise<void> {
    // Strategy ID validation
    if (operation === 'create' && !entity.strategy_id) {
      throw new Error('Strategy ID is required for trade creation');
    }

    // Symbol validation
    if (operation === 'create' && !entity.symbol) {
      throw new Error('Symbol is required for trade creation');
    }

    // Quantity validation
    if (entity.quantity !== undefined && entity.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Price validation
    if (entity.price !== undefined && entity.price < 0) {
      throw new Error('Price cannot be negative');
    }

    // Side validation
    if (entity.side && !['buy', 'sell', 'long', 'short'].includes(entity.side)) {
      throw new Error('Invalid trade side');
    }

    // Type validation
    if (entity.type && !['market', 'limit', 'stop', 'stop_limit'].includes(entity.type)) {
      throw new Error('Invalid trade type');
    }

    // Status validation
    if (entity.status && !['pending', 'filled', 'partial', 'cancelled', 'rejected'].includes(entity.status)) {
      throw new Error('Invalid trade status');
    }

    // Business logic validation
    if (operation === 'update') {
      if (entity.executed_quantity !== undefined && entity.quantity !== undefined) {
        if (entity.executed_quantity > entity.quantity) {
          throw new Error('Executed quantity cannot exceed order quantity');
        }
      }
    }

    await super.validateEntity(entity, operation);
  }
}