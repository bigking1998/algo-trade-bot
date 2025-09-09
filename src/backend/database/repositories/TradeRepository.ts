/**
 * Trade Repository Implementation
 * Task BE-002: Base Repository Implementation - TradeRepository
 * 
 * Production-ready repository for trade management with comprehensive P&L calculations,
 * performance analytics, and trading history tracking.
 */

import { BaseRepository, QueryOptions, PaginationResult } from '../BaseRepository';

// Trade domain types based on database schema
export interface Trade {
  id: string;
  time: Date;
  
  // Strategy reference
  strategy_id?: string;
  
  // Trade details
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  
  // Financial details
  value: number;
  fee: number;
  net_value: number;
  
  // P&L tracking
  entry_price?: number;
  exit_price?: number;
  pnl: number;
  pnl_percentage?: number;
  
  // Risk management
  stop_loss?: number;
  take_profit?: number;
  
  // Exchange integration
  exchange: string;
  exchange_trade_id?: string;
  exchange_order_id?: string;
  
  // Context and metadata
  market_conditions?: Record<string, any>;
  execution_latency_ms?: number;
  slippage?: number;
  created_at: Date;
}

export type TradeSide = 'buy' | 'sell';

export interface TradeCreateData {
  strategy_id?: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  fee?: number;
  entry_price?: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  exchange?: string;
  exchange_trade_id?: string;
  exchange_order_id?: string;
  market_conditions?: Record<string, any>;
  execution_latency_ms?: number;
  slippage?: number;
}

export interface TradeUpdateData {
  exit_price?: number;
  pnl?: number;
  pnl_percentage?: number;
  fee?: number;
  market_conditions?: Record<string, any>;
  execution_latency_ms?: number;
  slippage?: number;
}

export interface TradeAnalytics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  gross_profit: number;
  gross_loss: number;
  net_profit: number;
  total_fees: number;
  profit_factor: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  average_trade_duration?: number;
  total_volume: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  max_drawdown: number;
  volatility: number;
}

export interface TradeFilters {
  strategy_id?: string;
  symbol?: string;
  side?: TradeSide;
  min_pnl?: number;
  max_pnl?: number;
  min_value?: number;
  max_value?: number;
  date_from?: Date;
  date_to?: Date;
  exchange?: string;
  profit_only?: boolean;
  loss_only?: boolean;
  has_stop_loss?: boolean;
  has_take_profit?: boolean;
}

export interface PositionSummary {
  symbol: string;
  net_quantity: number;
  average_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_volume: number;
  trade_count: number;
  first_trade_time: Date;
  last_trade_time: Date;
}

export interface TradingSession {
  date: string;
  trades: Trade[];
  session_pnl: number;
  session_volume: number;
  session_fees: number;
  win_rate: number;
  best_trade: number;
  worst_trade: number;
}

export interface PerformanceMetrics {
  timeframe: string;
  total_return: number;
  total_return_percentage: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  var_95: number; // Value at Risk 95%
  cvar_95: number; // Conditional Value at Risk 95%
  skewness: number;
  kurtosis: number;
}

export interface AdvancedTradeAnalytics extends TradeAnalytics {
  kelly_criterion: number;
  expectancy: number;
  recovery_factor: number;
  ulcer_index: number;
  pain_index: number;
  sterling_ratio: number;
  burke_ratio: number;
  treynor_ratio: number;
  information_ratio: number;
  tracking_error: number;
}

export interface StrategyIntegration {
  strategyId: string;
  lastTradeTime?: Date;
  totalTrades: number;
  activeTrades: number;
  totalPnL: number;
  todayPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  riskScore: number;
  performanceRank: number;
  isActive: boolean;
}

export interface TradeReportConfig {
  strategyId?: string;
  symbols?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  includeDrawdown?: boolean;
  includeRatios?: boolean;
  includeBenchmark?: boolean;
  benchmarkSymbol?: string;
  groupBy?: 'day' | 'week' | 'month' | 'quarter';
  format?: 'summary' | 'detailed' | 'export';
}

export interface TradeReport {
  config: TradeReportConfig;
  generatedAt: Date;
  summary: TradeAnalytics;
  advanced?: AdvancedTradeAnalytics;
  periods: PeriodicPerformance[];
  topTrades: { winners: Trade[]; losers: Trade[] };
  riskAnalysis?: RiskAnalysis;
  recommendations?: string[];
  charts?: ChartData[];
}

export interface PeriodicPerformance {
  period: string;
  startDate: Date;
  endDate: Date;
  trades: number;
  pnl: number;
  winRate: number;
  avgTrade: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volume: number;
}

export interface RiskAnalysis {
  portfolioHeat: number;
  concentrationRisk: number;
  correlationMatrix: Record<string, Record<string, number>>;
  varDaily: number;
  varWeekly: number;
  stressTestResults: StressTestResult[];
  riskAdjustedReturns: number;
}

export interface StressTestResult {
  scenario: string;
  description: string;
  impact: number;
  probability: number;
  recommendedAction?: string;
}

export interface ChartData {
  type: 'equity_curve' | 'drawdown' | 'monthly_returns' | 'rolling_sharpe';
  title: string;
  data: Array<{ x: string | number; y: number }>;
  metadata?: Record<string, any>;
}

/**
 * Repository class for trade management and P&L calculations
 */
export class TradeRepository extends BaseRepository<Trade> {
  constructor() {
    super({
      tableName: 'trades',
      primaryKeyField: 'id',
      enableCaching: true,
      defaultCacheTTL: 180, // 3 minutes for trade data
    });
  }

  /**
   * Create a new trade with automatic P&L calculation
   */
  public async createTrade(data: TradeCreateData): Promise<Trade> {
    // Calculate trade value and net value
    const value = data.quantity * data.price;
    const fee = data.fee || 0;
    const net_value = data.side === 'buy' ? value + fee : value - fee;
    
    // Calculate P&L if exit price is provided
    let pnl = 0;
    let pnl_percentage: number | undefined;
    
    if (data.entry_price && data.exit_price) {
      if (data.side === 'buy') {
        pnl = (data.exit_price - data.entry_price) * data.quantity - fee;
      } else {
        pnl = (data.entry_price - data.exit_price) * data.quantity - fee;
      }
      
      if (data.entry_price > 0) {
        pnl_percentage = (pnl / (data.entry_price * data.quantity)) * 100;
      }
    }

    const tradeData = {
      ...data,
      time: new Date(),
      value,
      fee,
      net_value,
      pnl,
      pnl_percentage,
      exchange: data.exchange || 'dydx_v4',
    };

    return await this.create(tradeData);
  }

  /**
   * Update trade with exit information and recalculate P&L
   */
  public async updateTradeExit(
    id: string,
    exitData: { exit_price: number; fee?: number }
  ): Promise<Trade | null> {
    const trade = await this.findById(id);
    if (!trade) {
      return null;
    }

    const additionalFee = exitData.fee || 0;
    const totalFee = trade.fee + additionalFee;
    
    let pnl = 0;
    let pnl_percentage: number | undefined;
    
    const entryPrice = trade.entry_price || trade.price;
    
    if (trade.side === 'buy') {
      pnl = (exitData.exit_price - entryPrice) * trade.quantity - totalFee;
    } else {
      pnl = (entryPrice - exitData.exit_price) * trade.quantity - totalFee;
    }
    
    if (entryPrice > 0) {
      pnl_percentage = (pnl / (entryPrice * trade.quantity)) * 100;
    }

    return await this.updateById(id, {
      exit_price: exitData.exit_price,
      fee: totalFee,
      pnl,
      pnl_percentage,
      net_value: trade.net_value - additionalFee,
    });
  }

  /**
   * Get trades for a specific strategy
   */
  public async getTradesByStrategy(
    strategyId: string,
    queryOptions?: QueryOptions
  ): Promise<Trade[]> {
    return await this.findBy(
      { strategy_id: strategyId },
      {
        orderBy: 'time',
        orderDirection: 'DESC',
        ...queryOptions,
      }
    );
  }

  /**
   * Get trades for a specific symbol
   */
  public async getTradesBySymbol(
    symbol: string,
    queryOptions?: QueryOptions
  ): Promise<Trade[]> {
    return await this.findBy(
      { symbol },
      {
        orderBy: 'time',
        orderDirection: 'DESC',
        ...queryOptions,
      }
    );
  }

  /**
   * Get recent trades with caching
   */
  public async getRecentTrades(limit = 50): Promise<Trade[]> {
    return await this.findAll({
      orderBy: 'time',
      orderDirection: 'DESC',
      limit,
      cache: {
        key: 'trades:recent',
        ttl: 60, // 1 minute cache
      },
    });
  }

  /**
   * Search trades with advanced filters
   */
  public async searchTrades(
    filters: TradeFilters,
    page = 1,
    pageSize = 50
  ): Promise<PaginationResult<Trade>> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }

    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }

    if (filters.side) {
      whereConditions.push(`side = $${paramIndex++}`);
      params.push(filters.side);
    }

    if (filters.min_pnl !== undefined) {
      whereConditions.push(`pnl >= $${paramIndex++}`);
      params.push(filters.min_pnl);
    }

    if (filters.max_pnl !== undefined) {
      whereConditions.push(`pnl <= $${paramIndex++}`);
      params.push(filters.max_pnl);
    }

    if (filters.min_value !== undefined) {
      whereConditions.push(`value >= $${paramIndex++}`);
      params.push(filters.min_value);
    }

    if (filters.max_value !== undefined) {
      whereConditions.push(`value <= $${paramIndex++}`);
      params.push(filters.max_value);
    }

    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    if (filters.exchange) {
      whereConditions.push(`exchange = $${paramIndex++}`);
      params.push(filters.exchange);
    }

    if (filters.profit_only) {
      whereConditions.push('pnl > 0');
    }

    if (filters.loss_only) {
      whereConditions.push('pnl < 0');
    }

    if (filters.has_stop_loss !== undefined) {
      whereConditions.push(filters.has_stop_loss ? 'stop_loss IS NOT NULL' : 'stop_loss IS NULL');
    }

    if (filters.has_take_profit !== undefined) {
      whereConditions.push(filters.has_take_profit ? 'take_profit IS NOT NULL' : 'take_profit IS NULL');
    }

    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM trades';
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    query += ' ORDER BY time DESC';

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const [countResult, dataResult] = await Promise.all([
      this.query<{ count: number }>(countQuery, params),
      this.query<Trade>(query + ` LIMIT ${pageSize} OFFSET ${offset}`, params),
    ]);

    const total = Number(countResult.rows[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dataResult.rows,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Find strategy by name (for migration use)
   */
  public async findStrategyByName(strategyName: string): Promise<{id: string; name: string} | null> {
    try {
      const result = await this.query<{id: string; name: string}>(
        'SELECT id, name FROM strategies WHERE name = $1 LIMIT 1',
        [strategyName]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.warn(`[TradeRepository] Failed to find strategy by name: ${strategyName}`, error);
      return null;
    }
  }

  /**
   * Get symbol statistics for analytics
   */
  public async getSymbolStats(): Promise<Array<{symbol: string; count: number}>> {
    try {
      const result = await this.query<{symbol: string; count: number}>(
        'SELECT symbol, COUNT(*) as count FROM trades GROUP BY symbol ORDER BY count DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('[TradeRepository] Failed to get symbol stats:', error);
      return [];
    }
  }

  /**
   * Get strategy statistics for analytics
   */
  public async getStrategyStats(): Promise<Array<{strategy: string; count: number}>> {
    try {
      const result = await this.query<{strategy: string; count: number}>(
        `SELECT s.name as strategy, COUNT(*) as count 
         FROM trades t 
         LEFT JOIN strategies s ON t.strategy_id = s.id 
         GROUP BY s.name 
         ORDER BY count DESC`
      );
      return result.rows;
    } catch (error) {
      console.error('[TradeRepository] Failed to get strategy stats:', error);
      return [];
    }
  }


  /**
   * Get comprehensive trade analytics
   */
  public async getTradeAnalytics(
    filters: TradeFilters = {}
  ): Promise<TradeAnalytics> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Build where clause from filters
    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }

    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }

    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      WITH trade_stats AS (
        SELECT 
          COUNT(*) as total_trades,
          COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
          COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
          COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) as gross_profit,
          COALESCE(SUM(pnl) FILTER (WHERE pnl < 0), 0) as gross_loss,
          COALESCE(SUM(pnl), 0) as net_profit,
          COALESCE(SUM(fee), 0) as total_fees,
          COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) as average_win,
          COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0) as average_loss,
          COALESCE(MAX(pnl), 0) as largest_win,
          COALESCE(MIN(pnl), 0) as largest_loss,
          COALESCE(SUM(value), 0) as total_volume,
          COALESCE(STDDEV(pnl), 0) as volatility
        FROM trades 
        ${whereClause}
      ),
      consecutive_calc AS (
        SELECT 
          MAX(consecutive_wins) as max_consecutive_wins,
          MAX(consecutive_losses) as max_consecutive_losses
        FROM (
          SELECT 
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) OVER (
              PARTITION BY grp_wins ORDER BY time ROWS UNBOUNDED PRECEDING
            ) as consecutive_wins,
            SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) OVER (
              PARTITION BY grp_losses ORDER BY time ROWS UNBOUNDED PRECEDING  
            ) as consecutive_losses
          FROM (
            SELECT 
              pnl, 
              time,
              SUM(CASE WHEN LAG(pnl > 0, 1) OVER (ORDER BY time) != (pnl > 0) THEN 1 ELSE 0 END) 
                OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) as grp_wins,
              SUM(CASE WHEN LAG(pnl < 0, 1) OVER (ORDER BY time) != (pnl < 0) THEN 1 ELSE 0 END) 
                OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) as grp_losses
            FROM trades 
            ${whereClause}
            ORDER BY time
          ) grouped
        ) streaks
      ),
      drawdown_calc AS (
        SELECT COALESCE(MAX(running_drawdown), 0) as max_drawdown
        FROM (
          SELECT 
            (running_peak - running_pnl) / NULLIF(running_peak, 0) * 100 as running_drawdown
          FROM (
            SELECT 
              SUM(pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) as running_pnl,
              MAX(SUM(pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING)) 
                OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) as running_peak
            FROM trades 
            ${whereClause}
            ORDER BY time
          ) dd
        ) drawdowns
      )
      SELECT 
        ts.total_trades::INTEGER,
        ts.winning_trades::INTEGER,
        ts.losing_trades::INTEGER,
        CASE 
          WHEN ts.total_trades > 0 
          THEN (ts.winning_trades::FLOAT / ts.total_trades * 100)
          ELSE 0 
        END as win_rate,
        ts.gross_profit,
        ABS(ts.gross_loss) as gross_loss,
        ts.net_profit,
        ts.total_fees,
        CASE 
          WHEN ts.gross_loss < 0 
          THEN (ts.gross_profit / ABS(ts.gross_loss))
          ELSE 0 
        END as profit_factor,
        ts.average_win,
        ABS(ts.average_loss) as average_loss,
        ts.largest_win,
        ABS(ts.largest_loss) as largest_loss,
        COALESCE(cc.max_consecutive_wins, 0)::INTEGER as max_consecutive_wins,
        COALESCE(cc.max_consecutive_losses, 0)::INTEGER as max_consecutive_losses,
        NULL::FLOAT as average_trade_duration, -- TODO: Calculate from order timestamps
        ts.total_volume,
        NULL::FLOAT as sharpe_ratio, -- TODO: Calculate with risk-free rate
        NULL::FLOAT as sortino_ratio, -- TODO: Calculate downside deviation
        NULL::FLOAT as calmar_ratio, -- TODO: Calculate annual return / max drawdown
        COALESCE(dd.max_drawdown, 0) as max_drawdown,
        ts.volatility
      FROM trade_stats ts
      CROSS JOIN consecutive_calc cc
      CROSS JOIN drawdown_calc dd
    `;

    const result = await this.query<TradeAnalytics>(query, params);
    return result.rows[0] || {
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      win_rate: 0,
      gross_profit: 0,
      gross_loss: 0,
      net_profit: 0,
      total_fees: 0,
      profit_factor: 0,
      average_win: 0,
      average_loss: 0,
      largest_win: 0,
      largest_loss: 0,
      max_consecutive_wins: 0,
      max_consecutive_losses: 0,
      average_trade_duration: undefined,
      total_volume: 0,
      sharpe_ratio: undefined,
      sortino_ratio: undefined,
      calmar_ratio: undefined,
      max_drawdown: 0,
      volatility: 0,
    };
  }

  /**
   * Get position summary for each symbol
   */
  public async getPositionSummary(strategyId?: string): Promise<PositionSummary[]> {
    let whereClause = '';
    let params: any[] = [];

    if (strategyId) {
      whereClause = 'WHERE strategy_id = $1';
      params = [strategyId];
    }

    const query = `
      SELECT 
        symbol,
        SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END) as net_quantity,
        AVG(price) as average_price,
        0 as unrealized_pnl, -- TODO: Calculate with current market prices
        SUM(pnl) as realized_pnl,
        SUM(value) as total_volume,
        COUNT(*) as trade_count,
        MIN(time) as first_trade_time,
        MAX(time) as last_trade_time
      FROM trades 
      ${whereClause}
      GROUP BY symbol
      HAVING COUNT(*) > 0
      ORDER BY total_volume DESC
    `;

    const result = await this.query<PositionSummary>(query, params);
    return result.rows;
  }

  /**
   * Get trading sessions grouped by date
   */
  public async getTradingSessions(
    filters: TradeFilters = {},
    limit = 30
  ): Promise<TradingSession[]> {
    let whereConditions: string[] = ['1=1'];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }

    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }

    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const query = `
      WITH daily_sessions AS (
        SELECT 
          DATE(time) as date,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'time', time,
              'symbol', symbol,
              'side', side,
              'quantity', quantity,
              'price', price,
              'pnl', pnl,
              'fee', fee
            ) ORDER BY time
          ) as trades,
          SUM(pnl) as session_pnl,
          SUM(value) as session_volume,
          SUM(fee) as session_fees,
          COUNT(*) FILTER (WHERE pnl > 0)::FLOAT / COUNT(*) * 100 as win_rate,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade
        FROM trades 
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY DATE(time)
        ORDER BY DATE(time) DESC
        LIMIT $${paramIndex}
      )
      SELECT 
        date::TEXT,
        trades,
        session_pnl,
        session_volume,
        session_fees,
        COALESCE(win_rate, 0) as win_rate,
        COALESCE(best_trade, 0) as best_trade,
        COALESCE(worst_trade, 0) as worst_trade
      FROM daily_sessions
    `;

    const result = await this.query<{
      date: string;
      trades: any;
      session_pnl: number;
      session_volume: number;
      session_fees: number;
      win_rate: number;
      best_trade: number;
      worst_trade: number;
    }>(query, [...params, limit]);

    return result.rows.map(row => ({
      date: row.date,
      trades: Array.isArray(row.trades) ? row.trades : [],
      session_pnl: row.session_pnl,
      session_volume: row.session_volume,
      session_fees: row.session_fees,
      win_rate: row.win_rate,
      best_trade: row.best_trade,
      worst_trade: row.worst_trade,
    }));
  }

  /**
   * Get performance metrics over different timeframes
   */
  public async getPerformanceMetrics(
    strategyId?: string
  ): Promise<PerformanceMetrics[]> {
    const timeframes = [
      { name: '24h', interval: '1 day' },
      { name: '7d', interval: '7 days' },
      { name: '30d', interval: '30 days' },
      { name: '90d', interval: '90 days' },
      { name: '1y', interval: '1 year' },
    ];

    const results: PerformanceMetrics[] = [];

    for (const timeframe of timeframes) {
      let whereClause = `WHERE time >= NOW() - INTERVAL '${timeframe.interval}'`;
      let params: any[] = [];

      if (strategyId) {
        whereClause += ' AND strategy_id = $1';
        params = [strategyId];
      }

      const query = `
        WITH pnl_series AS (
          SELECT 
            time,
            SUM(pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) as cumulative_pnl,
            pnl as period_pnl
          FROM trades 
          ${whereClause}
          ORDER BY time
        ),
        metrics AS (
          SELECT 
            COALESCE(MAX(cumulative_pnl) - MIN(cumulative_pnl), 0) as total_return,
            COALESCE(STDDEV(period_pnl), 0) as volatility,
            COUNT(*) as trade_count,
            COALESCE(
              PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY period_pnl), 0
            ) as var_95,
            COALESCE(
              AVG(period_pnl) FILTER (WHERE period_pnl <= PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY period_pnl)), 0
            ) as cvar_95
          FROM pnl_series
        )
        SELECT 
          trade_count,
          total_return,
          volatility,
          CASE 
            WHEN volatility > 0 
            THEN (total_return / trade_count) / volatility * SQRT(252) -- Annualized Sharpe (assuming daily trades)
            ELSE 0 
          END as sharpe_ratio,
          0 as max_drawdown, -- TODO: Calculate proper drawdown
          ABS(var_95) as var_95,
          ABS(cvar_95) as cvar_95,
          0 as skewness, -- TODO: Calculate skewness
          0 as kurtosis  -- TODO: Calculate kurtosis
        FROM metrics
      `;

      try {
        const result = await this.query<{
          trade_count: number;
          total_return: number;
          volatility: number;
          sharpe_ratio: number;
          max_drawdown: number;
          var_95: number;
          cvar_95: number;
          skewness: number;
          kurtosis: number;
        }>(query, params);

        const row = result.rows[0];
        if (row && row.trade_count > 0) {
          const totalReturnPercentage = row.total_return > 0 ? 
            (row.total_return / (row.total_return - row.total_return)) * 100 : 0;

          results.push({
            timeframe: timeframe.name,
            total_return: row.total_return,
            total_return_percentage: totalReturnPercentage,
            volatility: row.volatility,
            sharpe_ratio: row.sharpe_ratio,
            max_drawdown: row.max_drawdown,
            var_95: row.var_95,
            cvar_95: row.cvar_95,
            skewness: row.skewness,
            kurtosis: row.kurtosis,
          });
        }
      } catch (error) {
        console.warn(`Failed to calculate metrics for ${timeframe.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Get top performing trades
   */
  public async getTopTrades(
    type: 'winners' | 'losers' = 'winners',
    limit = 10,
    strategyId?: string
  ): Promise<Trade[]> {
    let whereClause = '';
    let params: any[] = [];

    if (strategyId) {
      whereClause = 'WHERE strategy_id = $1';
      params = [strategyId];
    }

    const orderDirection = type === 'winners' ? 'DESC' : 'ASC';
    const query = `
      SELECT * FROM trades 
      ${whereClause}
      ORDER BY pnl ${orderDirection}
      LIMIT ${limit}
    `;

    const result = await this.query<Trade>(query, params);
    return result.rows;
  }

  /**
   * Delete old trades beyond retention period
   */
  public async cleanupOldTrades(retentionDays = 2555): Promise<number> { // ~7 years default
    const query = `
      DELETE FROM trades 
      WHERE time < NOW() - INTERVAL '${retentionDays} days'
    `;

    const result = await this.query(query);
    return result.rowCount || 0;
  }

  // ============================================================================
  // ENHANCED ANALYTICS AND REPORTING METHODS (Task BE-004 Requirements)
  // ============================================================================

  /**
   * Get advanced trade analytics with additional risk metrics
   */
  public async getAdvancedTradeAnalytics(
    filters: TradeFilters = {}
  ): Promise<AdvancedTradeAnalytics> {
    const basicAnalytics = await this.getTradeAnalytics(filters);
    
    // Build additional advanced metrics
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Apply same filters as basic analytics
    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }
    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }
    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const advancedQuery = `
      WITH trade_metrics AS (
        SELECT 
          pnl,
          ABS(pnl) as abs_pnl,
          CASE WHEN pnl > 0 THEN pnl ELSE 0 END as wins,
          CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END as losses,
          value,
          time,
          SUM(pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) as running_pnl
        FROM trades ${whereClause}
        ORDER BY time
      ),
      advanced_metrics AS (
        SELECT 
          -- Kelly Criterion: (Win Rate * Avg Win - Loss Rate * Avg Loss) / Avg Win
          CASE 
            WHEN AVG(wins) > 0 AND COUNT(*) > 0
            THEN ((COUNT(*) FILTER (WHERE wins > 0)::FLOAT / COUNT(*)) * AVG(wins) - 
                  (COUNT(*) FILTER (WHERE losses > 0)::FLOAT / COUNT(*)) * AVG(losses)) / AVG(wins)
            ELSE 0
          END as kelly_criterion,
          
          -- Expectancy: (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
          CASE 
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE wins > 0)::FLOAT / COUNT(*) * COALESCE(AVG(wins), 0)) - 
                 (COUNT(*) FILTER (WHERE losses > 0)::FLOAT / COUNT(*) * COALESCE(AVG(losses), 0))
            ELSE 0
          END as expectancy,
          
          -- Ulcer Index: RMS of drawdown percentages
          SQRT(AVG(
            POWER(
              CASE 
                WHEN MAX(running_pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) > 0
                THEN (MAX(running_pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) - running_pnl) / 
                     MAX(running_pnl) OVER (ORDER BY time ROWS UNBOUNDED PRECEDING) * 100
                ELSE 0
              END, 2
            )
          )) as ulcer_index,
          
          -- Recovery Factor: Net Profit / Max Drawdown
          CASE 
            WHEN MAX(running_pnl) - MIN(running_pnl) > 0
            THEN SUM(pnl) / (MAX(running_pnl) - MIN(running_pnl))
            ELSE 0
          END as recovery_factor
        FROM trade_metrics
      )
      SELECT 
        kelly_criterion,
        expectancy,
        recovery_factor,
        ulcer_index,
        0 as pain_index,    -- TODO: Implement pain index calculation
        0 as sterling_ratio, -- TODO: Implement sterling ratio
        0 as burke_ratio,    -- TODO: Implement burke ratio  
        0 as treynor_ratio,  -- TODO: Implement treynor ratio (needs beta)
        0 as information_ratio, -- TODO: Implement information ratio (needs benchmark)
        0 as tracking_error     -- TODO: Implement tracking error (needs benchmark)
      FROM advanced_metrics
    `;

    try {
      const result = await this.query<{
        kelly_criterion: number;
        expectancy: number;
        recovery_factor: number;
        ulcer_index: number;
        pain_index: number;
        sterling_ratio: number;
        burke_ratio: number;
        treynor_ratio: number;
        information_ratio: number;
        tracking_error: number;
      }>(advancedQuery, params);

      const advanced = result.rows[0] || {
        kelly_criterion: 0,
        expectancy: 0,
        recovery_factor: 0,
        ulcer_index: 0,
        pain_index: 0,
        sterling_ratio: 0,
        burke_ratio: 0,
        treynor_ratio: 0,
        information_ratio: 0,
        tracking_error: 0,
      };

      return {
        ...basicAnalytics,
        ...advanced,
      };
    } catch (error) {
      console.warn('Failed to calculate advanced analytics, returning basic analytics:', error);
      return {
        ...basicAnalytics,
        kelly_criterion: 0,
        expectancy: 0,
        recovery_factor: 0,
        ulcer_index: 0,
        pain_index: 0,
        sterling_ratio: 0,
        burke_ratio: 0,
        treynor_ratio: 0,
        information_ratio: 0,
        tracking_error: 0,
      };
    }
  }

  /**
   * Generate comprehensive trade report
   */
  public async generateTradeReport(config: TradeReportConfig = {}): Promise<TradeReport> {
    const filters: TradeFilters = {
      strategy_id: config.strategyId,
      date_from: config.dateFrom,
      date_to: config.dateTo,
    };

    // Get basic analytics
    const summary = await this.getTradeAnalytics(filters);
    let advanced: AdvancedTradeAnalytics | undefined;
    
    if (config.format === 'detailed') {
      advanced = await this.getAdvancedTradeAnalytics(filters);
    }

    // Get periodic performance
    const periods = await this.getPeriodicPerformance(filters, config.groupBy || 'month');
    
    // Get top trades
    const [winners, losers] = await Promise.all([
      this.getTopTrades('winners', 10, config.strategyId),
      this.getTopTrades('losers', 10, config.strategyId),
    ]);

    // Generate recommendations based on analytics
    const recommendations = this.generateRecommendations(advanced || summary);

    return {
      config,
      generatedAt: new Date(),
      summary,
      advanced,
      periods,
      topTrades: { winners, losers },
      recommendations,
      // TODO: Add risk analysis and charts based on config
    };
  }

  /**
   * Get periodic performance breakdown
   */
  public async getPeriodicPerformance(
    filters: TradeFilters = {},
    groupBy: 'day' | 'week' | 'month' | 'quarter' = 'month'
  ): Promise<PeriodicPerformance[]> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }
    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }
    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    let dateGroup: string;
    switch (groupBy) {
      case 'day':
        dateGroup = "DATE_TRUNC('day', time)";
        break;
      case 'week':
        dateGroup = "DATE_TRUNC('week', time)";
        break;
      case 'quarter':
        dateGroup = "DATE_TRUNC('quarter', time)";
        break;
      default:
        dateGroup = "DATE_TRUNC('month', time)";
    }

    const query = `
      WITH period_data AS (
        SELECT 
          ${dateGroup} as period_start,
          ${dateGroup} + INTERVAL '1 ${groupBy}' - INTERVAL '1 day' as period_end,
          COUNT(*) as trades,
          SUM(pnl) as pnl,
          COUNT(*) FILTER (WHERE pnl > 0)::FLOAT / COUNT(*) * 100 as win_rate,
          AVG(pnl) as avg_trade,
          SUM(value) as volume,
          STDDEV(pnl) as volatility
        FROM trades ${whereClause}
        GROUP BY ${dateGroup}
        ORDER BY ${dateGroup} DESC
      ),
      running_totals AS (
        SELECT 
          *,
          SUM(pnl) OVER (ORDER BY period_start ROWS UNBOUNDED PRECEDING) as running_total,
          MAX(SUM(pnl) OVER (ORDER BY period_start ROWS UNBOUNDED PRECEDING)) 
            OVER (ORDER BY period_start ROWS UNBOUNDED PRECEDING) as running_peak
        FROM period_data
      )
      SELECT 
        TO_CHAR(period_start, 'YYYY-MM-DD') as period,
        period_start,
        period_end,
        trades::INTEGER,
        pnl,
        COALESCE(win_rate, 0) as win_rate,
        COALESCE(avg_trade, 0) as avg_trade,
        COALESCE((running_peak - running_total) / NULLIF(running_peak, 0) * 100, 0) as max_drawdown,
        CASE 
          WHEN volatility > 0 AND trades > 1
          THEN (avg_trade / volatility) * SQRT(30) -- Monthly Sharpe approximation
          ELSE 0
        END as sharpe_ratio,
        volume
      FROM running_totals
      LIMIT 24  -- Limit to 24 periods
    `;

    const result = await this.query<{
      period: string;
      period_start: Date;
      period_end: Date;
      trades: number;
      pnl: number;
      win_rate: number;
      avg_trade: number;
      max_drawdown: number;
      sharpe_ratio: number;
      volume: number;
    }>(query, params);

    return result.rows.map(row => ({
      period: row.period,
      startDate: row.period_start,
      endDate: row.period_end,
      trades: row.trades,
      pnl: row.pnl,
      winRate: row.win_rate,
      avgTrade: row.avg_trade,
      maxDrawdown: row.max_drawdown,
      sharpeRatio: row.sharpe_ratio,
      volume: row.volume,
    }));
  }

  // ============================================================================
  // STRATEGY EXECUTION INTEGRATION (Task BE-004 Requirements)
  // ============================================================================

  /**
   * Get strategy integration summary for strategy execution engine
   */
  public async getStrategyIntegrationSummary(strategyId?: string): Promise<StrategyIntegration[]> {
    let whereClause = '';
    let params: any[] = [];

    if (strategyId) {
      whereClause = 'WHERE strategy_id = $1';
      params = [strategyId];
    }

    const query = `
      WITH strategy_stats AS (
        SELECT 
          strategy_id,
          MAX(time) as last_trade_time,
          COUNT(*) as total_trades,
          COUNT(*) FILTER (WHERE exit_price IS NULL) as active_trades,
          SUM(pnl) as total_pnl,
          SUM(pnl) FILTER (WHERE DATE(time) = CURRENT_DATE) as today_pnl,
          SUM(pnl) FILTER (WHERE time >= DATE_TRUNC('week', CURRENT_DATE)) as weekly_pnl,
          SUM(pnl) FILTER (WHERE time >= DATE_TRUNC('month', CURRENT_DATE)) as monthly_pnl,
          -- Risk score based on recent volatility and drawdown
          CASE 
            WHEN STDDEV(pnl) FILTER (WHERE time >= CURRENT_DATE - INTERVAL '7 days') > 0
            THEN LEAST(STDDEV(pnl) FILTER (WHERE time >= CURRENT_DATE - INTERVAL '7 days') / 
                      NULLIF(AVG(ABS(pnl)) FILTER (WHERE time >= CURRENT_DATE - INTERVAL '7 days'), 0) * 100, 100)
            ELSE 0
          END as risk_score,
          -- Check if strategy has traded in last 24 hours
          MAX(time) > CURRENT_TIMESTAMP - INTERVAL '1 day' as is_active
        FROM trades
        ${whereClause}
        GROUP BY strategy_id
      ),
      performance_ranking AS (
        SELECT 
          strategy_id,
          RANK() OVER (ORDER BY monthly_pnl DESC) as performance_rank
        FROM strategy_stats
      )
      SELECT 
        s.strategy_id,
        s.last_trade_time,
        s.total_trades::INTEGER,
        s.active_trades::INTEGER,
        s.total_pnl,
        COALESCE(s.today_pnl, 0) as today_pnl,
        COALESCE(s.weekly_pnl, 0) as weekly_pnl,
        COALESCE(s.monthly_pnl, 0) as monthly_pnl,
        COALESCE(s.risk_score, 0) as risk_score,
        r.performance_rank::INTEGER,
        s.is_active
      FROM strategy_stats s
      JOIN performance_ranking r ON s.strategy_id = r.strategy_id
      ORDER BY s.monthly_pnl DESC
    `;

    const result = await this.query<{
      strategy_id: string;
      last_trade_time: Date;
      total_trades: number;
      active_trades: number;
      total_pnl: number;
      today_pnl: number;
      weekly_pnl: number;
      monthly_pnl: number;
      risk_score: number;
      performance_rank: number;
      is_active: boolean;
    }>(query, params);

    return result.rows.map(row => ({
      strategyId: row.strategy_id,
      lastTradeTime: row.last_trade_time,
      totalTrades: row.total_trades,
      activeTrades: row.active_trades,
      totalPnL: row.total_pnl,
      todayPnL: row.today_pnl,
      weeklyPnL: row.weekly_pnl,
      monthlyPnL: row.monthly_pnl,
      riskScore: row.risk_score,
      performanceRank: row.performance_rank,
      isActive: row.is_active,
    }));
  }

  /**
   * Record a strategy execution event for integration tracking
   */
  public async recordStrategyExecution(
    strategyId: string,
    executionData: {
      signal?: 'BUY' | 'SELL' | 'HOLD';
      action?: 'ENTRY' | 'EXIT' | 'POSITION_UPDATE';
      symbolsAnalyzed?: string[];
      executionTime?: number; // milliseconds
      errorCount?: number;
      successCount?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    // This would typically log to a separate strategy_executions table
    // For now, we'll add it as metadata to trades or log it
    console.log(`[TradeRepository] Strategy ${strategyId} execution:`, executionData);
    
    // TODO: Implement proper strategy execution logging table
    // This would be used by the strategy engine to track performance
  }

  /**
   * Get real-time trading metrics for strategy monitoring
   */
  public async getRealtimeTradingMetrics(strategyId?: string): Promise<{
    totalPositions: number;
    totalPnL: number;
    todayTrades: number;
    activeStrategies: number;
    riskExposure: number;
    topSymbols: Array<{ symbol: string; pnl: number; trades: number }>;
  }> {
    let whereClause = strategyId ? 'WHERE strategy_id = $1' : '';
    let params = strategyId ? [strategyId] : [];

    const query = `
      WITH trading_metrics AS (
        SELECT 
          COUNT(*) FILTER (WHERE exit_price IS NULL) as total_positions,
          SUM(pnl) as total_pnl,
          COUNT(*) FILTER (WHERE DATE(time) = CURRENT_DATE) as today_trades,
          COUNT(DISTINCT strategy_id) as active_strategies,
          SUM(ABS(value)) FILTER (WHERE exit_price IS NULL) as risk_exposure
        FROM trades
        ${whereClause}
      ),
      top_symbols AS (
        SELECT 
          symbol,
          SUM(pnl) as pnl,
          COUNT(*) as trades
        FROM trades
        ${whereClause}
        GROUP BY symbol
        ORDER BY SUM(pnl) DESC
        LIMIT 5
      )
      SELECT 
        tm.total_positions::INTEGER,
        tm.total_pnl,
        tm.today_trades::INTEGER,
        tm.active_strategies::INTEGER,
        tm.risk_exposure,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'symbol', ts.symbol,
              'pnl', ts.pnl,
              'trades', ts.trades
            )
          ), '[]'::json
        ) as top_symbols
      FROM trading_metrics tm
      CROSS JOIN top_symbols ts
      GROUP BY tm.total_positions, tm.total_pnl, tm.today_trades, tm.active_strategies, tm.risk_exposure
    `;

    const result = await this.query<{
      total_positions: number;
      total_pnl: number;
      today_trades: number;
      active_strategies: number;
      risk_exposure: number;
      top_symbols: any;
    }>(query, params);

    const row = result.rows[0] || {
      total_positions: 0,
      total_pnl: 0,
      today_trades: 0,
      active_strategies: 0,
      risk_exposure: 0,
      top_symbols: [],
    };

    return {
      totalPositions: row.total_positions,
      totalPnL: row.total_pnl,
      todayTrades: row.today_trades,
      activeStrategies: row.active_strategies,
      riskExposure: row.risk_exposure,
      topSymbols: Array.isArray(row.top_symbols) ? row.top_symbols : [],
    };
  }

  /**
   * Generate recommendations based on trading analytics
   */
  private generateRecommendations(analytics: TradeAnalytics | AdvancedTradeAnalytics): string[] {
    const recommendations: string[] = [];

    // Win rate analysis
    if (analytics.win_rate < 40) {
      recommendations.push('Consider improving entry criteria - win rate is below 40%');
    } else if (analytics.win_rate > 70) {
      recommendations.push('Excellent win rate - consider increasing position sizes carefully');
    }

    // Profit factor analysis
    if (analytics.profit_factor < 1.2) {
      recommendations.push('Profit factor is low - review risk/reward ratios and exit strategies');
    } else if (analytics.profit_factor > 2.0) {
      recommendations.push('Strong profit factor - strategy performing well');
    }

    // Drawdown analysis
    if (analytics.max_drawdown > 20) {
      recommendations.push('High maximum drawdown detected - consider implementing stricter risk management');
    }

    // Trade frequency analysis
    if (analytics.total_trades < 10) {
      recommendations.push('Low trade count - results may not be statistically significant');
    }

    // Advanced analytics recommendations (if available)
    if ('kelly_criterion' in analytics) {
      const advanced = analytics as AdvancedTradeAnalytics;
      
      if (advanced.kelly_criterion > 0.25) {
        recommendations.push('Kelly Criterion suggests high position sizing - be cautious of overleverage');
      } else if (advanced.kelly_criterion < 0) {
        recommendations.push('Negative Kelly Criterion - strategy may not be profitable long-term');
      }

      if (advanced.expectancy > 0) {
        recommendations.push(`Positive expectancy of ${advanced.expectancy.toFixed(2)} per trade`);
      } else {
        recommendations.push('Negative expectancy - strategy loses money on average');
      }
    }

    return recommendations.length > 0 ? recommendations : ['No specific recommendations at this time'];
  }
}

export default TradeRepository;