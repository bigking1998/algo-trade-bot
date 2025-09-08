/**
 * Strategy Repository Implementation for Algorithmic Trading Bot
 * Task BE-003: Strategy Repository
 * 
 * Production-ready specialized repository for trading strategies with:
 * - Specialized queries for strategy management
 * - Strategy performance tracking methods
 * - Active strategy management
 * - Configuration validation
 * 
 * Extends BaseRepository to provide strategy-specific database operations
 * with enhanced functionality for trading strategy lifecycle management.
 */

import { BaseRepository, QueryOptions, PaginationResult, BulkOperationResult, RepositoryError } from '../BaseRepository';
import { DatabaseManager, CacheOptions } from '../DatabaseManager';

// Strategy-specific interfaces extending base types
export interface StrategyRecord {
  id: string;
  name: string;
  description?: string;
  type: StrategyType;
  status: StrategyStatus;
  
  // Configuration
  config: Record<string, any>;
  parameters: Record<string, any>;
  
  // Trading settings
  symbols: string[];
  timeframes: string[];
  max_positions: number;
  max_risk_per_trade: number;
  max_portfolio_risk: number;
  
  // Performance tracking
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  total_fees: number;
  max_drawdown: number;
  sharpe_ratio?: number;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  version: number;
}

export type StrategyType = 
  | 'sma_crossover'
  | 'ema_crossover' 
  | 'rsi_mean_reversion'
  | 'macd_momentum'
  | 'bollinger_bands'
  | 'breakout'
  | 'arbitrage'
  | 'ml_based'
  | 'custom';

export type StrategyStatus = 'active' | 'paused' | 'stopped' | 'error';

export interface StrategyPerformanceMetrics {
  strategyId: string;
  strategyName: string;
  
  // Basic metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Financial metrics
  totalPnL: number;
  totalFees: number;
  netPnL: number;
  avgTradeReturn: number;
  avgWinAmount: number;
  avgLossAmount: number;
  profitFactor: number;
  
  // Risk metrics
  maxDrawdown: number;
  sharpeRatio?: number;
  volatility?: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  
  // Time-based metrics
  avgTradeDuration: number; // in milliseconds
  lastTradeAt?: Date;
  activeSince: Date;
  
  // Recent performance (last 24 hours)
  recentTrades: number;
  recentPnL: number;
  recentWinRate: number;
}

export interface StrategyConfiguration {
  // Validation rules for strategy parameters
  requiredParameters: string[];
  parameterTypes: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>;
  parameterRanges: Record<string, { min?: number; max?: number; values?: any[]; default?: any }>;
  
  // Risk limits
  maxRiskPerTrade: { min: number; max: number; default: number };
  maxPortfolioRisk: { min: number; max: number; default: number };
  maxPositions: { min: number; max: number; default: number };
  
  // Symbol and timeframe validation
  supportedSymbols?: string[];
  supportedTimeframes: string[];
  
  // Dependencies
  requiredIndicators?: string[];
}

export interface ActiveStrategyInfo {
  id: string;
  name: string;
  type: StrategyType;
  status: StrategyStatus;
  symbols: string[];
  activePositions: number;
  recentTrades24h: number;
  currentPnL: number;
  riskUtilization: number; // Percentage of max risk currently used
  lastSignalAt?: Date;
  healthScore: number; // 0-100, calculated health metric
}

export interface StrategyQueryOptions extends QueryOptions {
  includePerformance?: boolean;
  includeRecentTrades?: boolean;
  performancePeriod?: '1d' | '7d' | '30d' | 'all';
}

/**
 * Specialized repository for trading strategy management
 */
export class StrategyRepository extends BaseRepository<StrategyRecord> {
  // Strategy configuration templates for validation
  private static readonly STRATEGY_CONFIGURATIONS: Record<StrategyType, StrategyConfiguration> = {
    sma_crossover: {
      requiredParameters: ['fast_period', 'slow_period'],
      parameterTypes: { fast_period: 'number', slow_period: 'number' },
      parameterRanges: { 
        fast_period: { min: 5, max: 50, default: 20 },
        slow_period: { min: 10, max: 200, default: 50 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.1, default: 0.02 },
      maxPortfolioRisk: { min: 0.05, max: 0.5, default: 0.1 },
      maxPositions: { min: 1, max: 10, default: 3 },
      supportedTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d'],
      requiredIndicators: ['sma']
    },
    ema_crossover: {
      requiredParameters: ['fast_ema', 'slow_ema'],
      parameterTypes: { fast_ema: 'number', slow_ema: 'number' },
      parameterRanges: {
        fast_ema: { min: 5, max: 50, default: 12 },
        slow_ema: { min: 10, max: 200, default: 26 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.1, default: 0.02 },
      maxPortfolioRisk: { min: 0.05, max: 0.5, default: 0.1 },
      maxPositions: { min: 1, max: 10, default: 3 },
      supportedTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d'],
      requiredIndicators: ['ema']
    },
    rsi_mean_reversion: {
      requiredParameters: ['rsi_period', 'oversold_threshold', 'overbought_threshold'],
      parameterTypes: { 
        rsi_period: 'number', 
        oversold_threshold: 'number', 
        overbought_threshold: 'number' 
      },
      parameterRanges: {
        rsi_period: { min: 5, max: 30, default: 14 },
        oversold_threshold: { min: 20, max: 40, default: 30 },
        overbought_threshold: { min: 60, max: 80, default: 70 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.05, default: 0.015 },
      maxPortfolioRisk: { min: 0.05, max: 0.3, default: 0.08 },
      maxPositions: { min: 1, max: 8, default: 2 },
      supportedTimeframes: ['15m', '30m', '1h', '4h', '1d'],
      requiredIndicators: ['rsi']
    },
    macd_momentum: {
      requiredParameters: ['fast_ema', 'slow_ema', 'signal_ema'],
      parameterTypes: { 
        fast_ema: 'number', 
        slow_ema: 'number', 
        signal_ema: 'number' 
      },
      parameterRanges: {
        fast_ema: { min: 8, max: 20, default: 12 },
        slow_ema: { min: 20, max: 35, default: 26 },
        signal_ema: { min: 5, max: 15, default: 9 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.08, default: 0.025 },
      maxPortfolioRisk: { min: 0.05, max: 0.4, default: 0.12 },
      maxPositions: { min: 1, max: 8, default: 3 },
      supportedTimeframes: ['30m', '1h', '4h', '1d'],
      requiredIndicators: ['macd']
    },
    bollinger_bands: {
      requiredParameters: ['period', 'std_dev'],
      parameterTypes: { period: 'number', std_dev: 'number' },
      parameterRanges: {
        period: { min: 10, max: 50, default: 20 },
        std_dev: { min: 1.5, max: 3, default: 2 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.06, default: 0.02 },
      maxPortfolioRisk: { min: 0.05, max: 0.3, default: 0.1 },
      maxPositions: { min: 1, max: 6, default: 2 },
      supportedTimeframes: ['15m', '30m', '1h', '4h', '1d'],
      requiredIndicators: ['bollinger_bands']
    },
    breakout: {
      requiredParameters: ['lookback_period', 'volume_threshold'],
      parameterTypes: { lookback_period: 'number', volume_threshold: 'number' },
      parameterRanges: {
        lookback_period: { min: 10, max: 100, default: 20 },
        volume_threshold: { min: 1.2, max: 3, default: 1.5 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.1, default: 0.03 },
      maxPortfolioRisk: { min: 0.05, max: 0.5, default: 0.15 },
      maxPositions: { min: 1, max: 8, default: 3 },
      supportedTimeframes: ['5m', '15m', '30m', '1h', '4h'],
      requiredIndicators: ['volume', 'price_range']
    },
    arbitrage: {
      requiredParameters: ['min_spread', 'max_latency'],
      parameterTypes: { min_spread: 'number', max_latency: 'number' },
      parameterRanges: {
        min_spread: { min: 0.001, max: 0.02, default: 0.005 },
        max_latency: { min: 50, max: 1000, default: 200 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.05, default: 0.01 },
      maxPortfolioRisk: { min: 0.02, max: 0.2, default: 0.05 },
      maxPositions: { min: 1, max: 20, default: 10 },
      supportedTimeframes: ['1m', '5m'],
      requiredIndicators: ['price_spread']
    },
    ml_based: {
      requiredParameters: ['model_type', 'prediction_horizon'],
      parameterTypes: { model_type: 'string', prediction_horizon: 'number' },
      parameterRanges: {
        model_type: { values: ['lstm', 'transformer', 'xgboost', 'ensemble'] },
        prediction_horizon: { min: 1, max: 100, default: 5 }
      },
      maxRiskPerTrade: { min: 0.001, max: 0.08, default: 0.02 },
      maxPortfolioRisk: { min: 0.05, max: 0.4, default: 0.1 },
      maxPositions: { min: 1, max: 10, default: 3 },
      supportedTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d'],
      requiredIndicators: ['ml_features']
    },
    custom: {
      requiredParameters: [],
      parameterTypes: {},
      parameterRanges: {},
      maxRiskPerTrade: { min: 0.001, max: 0.2, default: 0.02 },
      maxPortfolioRisk: { min: 0.05, max: 0.8, default: 0.1 },
      maxPositions: { min: 1, max: 50, default: 5 },
      supportedTimeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
    }
  };

  constructor() {
    super({
      tableName: 'strategies',
      primaryKeyField: 'id',
      enableCaching: true,
      defaultCacheTTL: 300 // 5 minutes cache for strategies
    });
  }

  /**
   * Create a new strategy with validation
   */
  public async createStrategy(
    data: Omit<StrategyRecord, 'id' | 'created_at' | 'updated_at' | 'total_trades' | 'winning_trades' | 'total_pnl' | 'total_fees' | 'max_drawdown' | 'version' | 'status'> & { status?: StrategyStatus }
  ): Promise<StrategyRecord> {
    try {
      // Validate strategy configuration
      await this.validateStrategyConfig(data.type, data.parameters, data.config);

      // Validate risk parameters
      this.validateRiskParameters(data.type, {
        max_risk_per_trade: data.max_risk_per_trade,
        max_portfolio_risk: data.max_portfolio_risk,
        max_positions: data.max_positions
      });

      // Validate symbols and timeframes
      this.validateSymbolsAndTimeframes(data.type, data.symbols, data.timeframes);

      const strategyData = {
        ...data,
        // Set default status if not provided
        status: data.status || 'paused',
        // Ensure arrays are properly formatted for PostgreSQL
        symbols: Array.isArray(data.symbols) ? data.symbols : [data.symbols],
        timeframes: Array.isArray(data.timeframes) ? data.timeframes : [data.timeframes],
        // Initialize performance counters
        total_trades: 0,
        winning_trades: 0,
        total_pnl: 0,
        total_fees: 0,
        max_drawdown: 0,
        version: 1
      };

      const result = await this.create(strategyData);

      // Log strategy creation
      await this.logStrategyEvent(result.id, 'strategy_created', {
        type: result.type,
        symbols: result.symbols,
        parameters: result.parameters
      });

      return result;
    } catch (error) {
      throw this.handleError(error, 'createStrategy', { data });
    }
  }

  /**
   * Get comprehensive strategy performance metrics
   */
  public async getStrategyPerformance(
    strategyId: string, 
    period: '1d' | '7d' | '30d' | 'all' = '30d'
  ): Promise<StrategyPerformanceMetrics> {
    try {
      const cacheKey = this.buildCacheKey('performance', { strategyId, period });
      const cacheOptions: CacheOptions = {
        key: cacheKey,
        ttl: 60 // 1 minute cache for performance data
      };

      // Get strategy basic info
      const strategy = await this.findById(strategyId);
      if (!strategy) {
        throw new RepositoryError('Strategy not found', 'STRATEGY_NOT_FOUND', 404);
      }

      // Calculate time filter
      let timeFilter = '';
      if (period !== 'all') {
        const intervals = { '1d': '1 day', '7d': '7 days', '30d': '30 days' };
        timeFilter = `AND t.time >= NOW() - INTERVAL '${intervals[period]}'`;
      }

      // Complex performance query
      const query = `
        WITH trade_metrics AS (
          SELECT 
            COUNT(*) as total_trades,
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COALESCE(SUM(fee), 0) as total_fees,
            COALESCE(AVG(pnl), 0) as avg_trade_return,
            COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) as avg_win_amount,
            COALESCE(ABS(AVG(pnl) FILTER (WHERE pnl < 0)), 0) as avg_loss_amount,
            COALESCE(MAX(time), strategy.created_at) as last_trade_at,
            COALESCE(AVG(EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time)))), 0) * 1000 as avg_trade_duration
          FROM trades t
          WHERE t.strategy_id = $1 ${timeFilter}
        ),
        consecutive_stats AS (
          SELECT 
            MAX(win_streak) as max_consecutive_wins,
            MAX(loss_streak) as max_consecutive_losses
          FROM (
            SELECT 
              SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) OVER (
                PARTITION BY grp ORDER BY time
              ) as win_streak,
              SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) OVER (
                PARTITION BY grp ORDER BY time  
              ) as loss_streak
            FROM (
              SELECT 
                pnl, 
                time,
                SUM(CASE WHEN (pnl > 0) != (LAG(pnl, 1, 0) OVER (ORDER BY time) > 0) THEN 1 ELSE 0 END) OVER (ORDER BY time) as grp
              FROM trades 
              WHERE strategy_id = $1 ${timeFilter}
            ) grouped_trades
          ) streaks
        ),
        recent_performance AS (
          SELECT 
            COUNT(*) as recent_trades,
            COALESCE(SUM(pnl), 0) as recent_pnl,
            CASE 
              WHEN COUNT(*) > 0 
              THEN COUNT(*) FILTER (WHERE pnl > 0)::decimal / COUNT(*)::decimal 
              ELSE 0 
            END as recent_win_rate
          FROM trades t
          WHERE t.strategy_id = $1 AND t.time >= NOW() - INTERVAL '24 hours'
        )
        SELECT 
          s.id as strategy_id,
          s.name as strategy_name,
          s.created_at as active_since,
          tm.*,
          cs.max_consecutive_wins,
          cs.max_consecutive_losses,
          rp.recent_trades,
          rp.recent_pnl,
          rp.recent_win_rate
        FROM strategies s
        CROSS JOIN trade_metrics tm
        CROSS JOIN consecutive_stats cs  
        CROSS JOIN recent_performance rp
        WHERE s.id = $1
      `;

      const result = await this.db.query<any>(query, [strategyId], cacheOptions);
      
      if (result.rows.length === 0) {
        throw new RepositoryError('Strategy performance data not found', 'PERFORMANCE_NOT_FOUND', 404);
      }

      const row = result.rows[0];

      // Calculate derived metrics
      const winRate = row.total_trades > 0 ? (row.winning_trades / row.total_trades) : 0;
      const profitFactor = row.avg_loss_amount > 0 ? (row.avg_win_amount / row.avg_loss_amount) : 0;
      const netPnL = row.total_pnl - row.total_fees;

      return {
        strategyId: row.strategy_id,
        strategyName: row.strategy_name,
        totalTrades: row.total_trades || 0,
        winningTrades: row.winning_trades || 0,
        losingTrades: row.losing_trades || 0,
        winRate: Number((winRate * 100).toFixed(2)),
        totalPnL: Number(row.total_pnl || 0),
        totalFees: Number(row.total_fees || 0),
        netPnL: Number(netPnL),
        avgTradeReturn: Number(row.avg_trade_return || 0),
        avgWinAmount: Number(row.avg_win_amount || 0),
        avgLossAmount: Number(row.avg_loss_amount || 0),
        profitFactor: Number(profitFactor.toFixed(2)),
        maxDrawdown: Number(strategy.max_drawdown || 0),
        sharpeRatio: strategy.sharpe_ratio ? Number(strategy.sharpe_ratio) : undefined,
        maxConsecutiveWins: row.max_consecutive_wins || 0,
        maxConsecutiveLosses: row.max_consecutive_losses || 0,
        avgTradeDuration: row.avg_trade_duration || 0,
        lastTradeAt: row.last_trade_at ? new Date(row.last_trade_at) : undefined,
        activeSince: new Date(row.active_since),
        recentTrades: row.recent_trades || 0,
        recentPnL: Number(row.recent_pnl || 0),
        recentWinRate: Number((row.recent_win_rate * 100).toFixed(2))
      };
    } catch (error) {
      throw this.handleError(error, 'getStrategyPerformance', { strategyId, period });
    }
  }

  /**
   * Get all active strategies with current status information
   */
  public async getActiveStrategies(): Promise<ActiveStrategyInfo[]> {
    try {
      const cacheKey = this.buildCacheKey('activeStrategies');
      const cacheOptions: CacheOptions = {
        key: cacheKey,
        ttl: 30 // 30 seconds cache for active strategies
      };

      const query = `
        WITH strategy_stats AS (
          SELECT 
            s.id,
            s.name,
            s.type,
            s.status,
            s.symbols,
            s.max_portfolio_risk,
            COUNT(DISTINCT ps.id) as active_positions,
            COUNT(t.id) FILTER (WHERE t.time >= NOW() - INTERVAL '24 hours') as recent_trades_24h,
            COALESCE(SUM(t.pnl) FILTER (WHERE t.time >= NOW() - INTERVAL '24 hours'), 0) as current_pnl,
            MAX(t.time) as last_signal_at
          FROM strategies s
          LEFT JOIN trades t ON s.id = t.strategy_id
          LEFT JOIN (
            SELECT DISTINCT strategy_id as id 
            FROM portfolio_snapshots 
            WHERE time >= NOW() - INTERVAL '1 hour' 
            AND position_count > 0
          ) ps ON s.id = ps.id
          WHERE s.status = 'active'
          GROUP BY s.id, s.name, s.type, s.status, s.symbols, s.max_portfolio_risk
        )
        SELECT 
          *,
          -- Calculate risk utilization (simplified)
          CASE 
            WHEN max_portfolio_risk > 0 
            THEN LEAST(100, (ABS(current_pnl) / (max_portfolio_risk * 10000)) * 100)
            ELSE 0
          END as risk_utilization,
          -- Calculate health score (simplified algorithm)
          CASE
            WHEN recent_trades_24h > 0 AND current_pnl >= 0 THEN 90 + LEAST(10, recent_trades_24h)
            WHEN recent_trades_24h > 0 AND current_pnl < 0 THEN GREATEST(20, 70 - ABS(current_pnl / 100))
            WHEN last_signal_at IS NOT NULL AND last_signal_at > NOW() - INTERVAL '1 hour' THEN 80
            WHEN last_signal_at IS NOT NULL AND last_signal_at > NOW() - INTERVAL '24 hours' THEN 60
            ELSE 40
          END as health_score
        FROM strategy_stats
        ORDER BY health_score DESC, current_pnl DESC
      `;

      const result = await this.db.query<any>(query, [], cacheOptions);

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type as StrategyType,
        status: row.status as StrategyStatus,
        symbols: Array.isArray(row.symbols) ? row.symbols : [],
        activePositions: row.active_positions || 0,
        recentTrades24h: row.recent_trades_24h || 0,
        currentPnL: Number(row.current_pnl || 0),
        riskUtilization: Number(row.risk_utilization || 0),
        lastSignalAt: row.last_signal_at ? new Date(row.last_signal_at) : undefined,
        healthScore: Math.min(100, Math.max(0, row.health_score || 0))
      }));
    } catch (error) {
      throw this.handleError(error, 'getActiveStrategies');
    }
  }

  /**
   * Update a strategy with validation
   */
  public async updateStrategy(
    strategyId: string,
    data: Partial<Omit<StrategyRecord, 'id' | 'created_at' | 'total_trades' | 'winning_trades' | 'total_pnl' | 'total_fees' | 'max_drawdown'>>
  ): Promise<StrategyRecord | null> {
    try {
      // Get current strategy for validation
      const currentStrategy = await this.findById(strategyId);
      if (!currentStrategy) {
        throw new RepositoryError('Strategy not found', 'STRATEGY_NOT_FOUND', 404);
      }

      // If updating configuration, validate it
      if (data.type || data.parameters || data.config) {
        const type = data.type || currentStrategy.type;
        const parameters = { ...currentStrategy.parameters, ...data.parameters };
        const config = { ...currentStrategy.config, ...data.config };
        
        await this.validateStrategyConfig(type, parameters, config);
      }

      // If updating risk parameters, validate them
      if (data.max_risk_per_trade || data.max_portfolio_risk || data.max_positions) {
        const type = data.type || currentStrategy.type;
        const riskParams = {
          max_risk_per_trade: data.max_risk_per_trade ?? currentStrategy.max_risk_per_trade,
          max_portfolio_risk: data.max_portfolio_risk ?? currentStrategy.max_portfolio_risk,
          max_positions: data.max_positions ?? currentStrategy.max_positions
        };
        
        this.validateRiskParameters(type, riskParams);
      }

      // If updating symbols or timeframes, validate them
      if (data.symbols || data.timeframes) {
        const type = data.type || currentStrategy.type;
        const symbols = data.symbols || currentStrategy.symbols;
        const timeframes = data.timeframes || currentStrategy.timeframes;
        
        this.validateSymbolsAndTimeframes(type, symbols, timeframes);
      }

      // If status is being changed, validate transition
      if (data.status) {
        this.validateStatusTransition(currentStrategy.status, data.status);
      }

      const updateData = {
        ...data,
        // Increment version on updates
        version: currentStrategy.version + 1,
        // Ensure arrays are properly formatted
        ...(data.symbols && { symbols: Array.isArray(data.symbols) ? data.symbols : [data.symbols] }),
        ...(data.timeframes && { timeframes: Array.isArray(data.timeframes) ? data.timeframes : [data.timeframes] })
      };

      const result = await this.updateById(strategyId, updateData);

      if (result) {
        // Log strategy update
        await this.logStrategyEvent(strategyId, 'strategy_updated', {
          changes: Object.keys(data),
          version: result.version
        });

        // Clear related cache entries
        if (data.status) {
          await this.db.clearCache(`${this.options.tableName}:activeStrategies*`);
        }
      }

      return result;
    } catch (error) {
      throw this.handleError(error, 'updateStrategy', { strategyId, data });
    }
  }

  /**
   * Update strategy status with validation
   */
  public async updateStrategyStatus(
    strategyId: string, 
    status: StrategyStatus,
    reason?: string
  ): Promise<StrategyRecord | null> {
    try {
      // Validate status transition
      const currentStrategy = await this.findById(strategyId);
      if (!currentStrategy) {
        throw new RepositoryError('Strategy not found', 'STRATEGY_NOT_FOUND', 404);
      }

      this.validateStatusTransition(currentStrategy.status, status);

      const result = await this.updateById(strategyId, { status });

      if (result) {
        // Log status change
        await this.logStrategyEvent(strategyId, 'status_changed', {
          from: currentStrategy.status,
          to: status,
          reason: reason || 'Manual update'
        });

        // Clear cache for active strategies
        await this.db.clearCache(`${this.options.tableName}:activeStrategies*`);
      }

      return result;
    } catch (error) {
      throw this.handleError(error, 'updateStrategyStatus', { strategyId, status, reason });
    }
  }

  /**
   * Find strategies by performance criteria
   */
  public async findByPerformance(criteria: {
    minWinRate?: number;
    minProfitFactor?: number;
    minTrades?: number;
    maxDrawdown?: number;
    minSharpeRatio?: number;
    period?: '1d' | '7d' | '30d' | 'all';
  }): Promise<StrategyPerformanceMetrics[]> {
    try {
      const { minWinRate, minProfitFactor, minTrades, maxDrawdown, minSharpeRatio, period = '30d' } = criteria;
      
      let timeFilter = '';
      if (period !== 'all') {
        const intervals = { '1d': '1 day', '7d': '7 days', '30d': '30 days' };
        timeFilter = `AND t.time >= NOW() - INTERVAL '${intervals[period]}'`;
      }

      let havingConditions: string[] = [];
      if (minWinRate !== undefined) {
        havingConditions.push(`(COUNT(*) FILTER (WHERE t.pnl > 0)::decimal / NULLIF(COUNT(*), 0)) >= ${minWinRate / 100}`);
      }
      if (minTrades !== undefined) {
        havingConditions.push(`COUNT(*) >= ${minTrades}`);
      }
      if (minProfitFactor !== undefined) {
        havingConditions.push(`(AVG(t.pnl) FILTER (WHERE t.pnl > 0) / NULLIF(ABS(AVG(t.pnl) FILTER (WHERE t.pnl < 0)), 0)) >= ${minProfitFactor}`);
      }
      if (maxDrawdown !== undefined) {
        havingConditions.push(`COALESCE(s.max_drawdown, 0) <= ${maxDrawdown}`);
      }
      if (minSharpeRatio !== undefined) {
        havingConditions.push(`COALESCE(s.sharpe_ratio, 0) >= ${minSharpeRatio}`);
      }

      const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          s.id,
          s.name,
          COUNT(*) as total_trades,
          COUNT(*) FILTER (WHERE t.pnl > 0) as winning_trades,
          SUM(t.pnl) as total_pnl,
          SUM(t.fee) as total_fees
        FROM strategies s
        INNER JOIN trades t ON s.id = t.strategy_id
        WHERE 1=1 ${timeFilter}
        GROUP BY s.id, s.name, s.max_drawdown, s.sharpe_ratio
        ${havingClause}
        ORDER BY total_pnl DESC
      `;

      const result = await this.db.query<any>(query);

      // Get full performance metrics for matching strategies
      const performancePromises = result.rows.map((row: any) => 
        this.getStrategyPerformance(row.id, period)
      );

      return await Promise.all(performancePromises);
    } catch (error) {
      throw this.handleError(error, 'findByPerformance', { criteria });
    }
  }

  /**
   * Get strategies by type with optional filtering
   */
  public async findByType(
    type: StrategyType, 
    options: StrategyQueryOptions = {}
  ): Promise<StrategyRecord[]> {
    try {
      const strategies = await this.findBy({ type }, options);

      if (options.includePerformance) {
        // This would normally be handled by joins, but for now we'll note the requirement
        // In a production system, you might want to include performance data in the main query
      }

      return strategies;
    } catch (error) {
      throw this.handleError(error, 'findByType', { type, options });
    }
  }

  /**
   * Validate strategy configuration parameters
   */
  private async validateStrategyConfig(
    type: StrategyType,
    parameters: Record<string, any>,
    config: Record<string, any>
  ): Promise<void> {
    const strategyConfig = StrategyRepository.STRATEGY_CONFIGURATIONS[type];
    
    if (!strategyConfig) {
      throw new RepositoryError(`Unsupported strategy type: ${type}`, 'INVALID_STRATEGY_TYPE', 400);
    }

    // Check required parameters
    for (const required of strategyConfig.requiredParameters) {
      if (!(required in parameters) && !(required in config)) {
        throw new RepositoryError(
          `Missing required parameter: ${required}`, 
          'MISSING_PARAMETER', 
          400,
          { parameter: required, type }
        );
      }
    }

    // Validate parameter types and ranges
    const allParams = { ...config, ...parameters };
    for (const [key, value] of Object.entries(allParams)) {
      const expectedType = strategyConfig.parameterTypes[key];
      if (expectedType) {
        if (!this.validateParameterType(value, expectedType)) {
          throw new RepositoryError(
            `Invalid type for parameter ${key}. Expected ${expectedType}`, 
            'INVALID_PARAMETER_TYPE', 
            400,
            { parameter: key, expectedType, actualValue: value }
          );
        }
      }

      const range = strategyConfig.parameterRanges[key];
      if (range) {
        if (!this.validateParameterRange(value, range)) {
          throw new RepositoryError(
            `Parameter ${key} is out of valid range`, 
            'PARAMETER_OUT_OF_RANGE', 
            400,
            { parameter: key, value, range }
          );
        }
      }
    }
  }

  /**
   * Validate risk parameters
   */
  private validateRiskParameters(
    type: StrategyType,
    params: {
      max_risk_per_trade: number;
      max_portfolio_risk: number;
      max_positions: number;
    }
  ): void {
    const strategyConfig = StrategyRepository.STRATEGY_CONFIGURATIONS[type];

    if (params.max_risk_per_trade < strategyConfig.maxRiskPerTrade.min ||
        params.max_risk_per_trade > strategyConfig.maxRiskPerTrade.max) {
      throw new RepositoryError(
        `max_risk_per_trade must be between ${strategyConfig.maxRiskPerTrade.min} and ${strategyConfig.maxRiskPerTrade.max}`,
        'INVALID_RISK_PARAMETER',
        400
      );
    }

    if (params.max_portfolio_risk < strategyConfig.maxPortfolioRisk.min ||
        params.max_portfolio_risk > strategyConfig.maxPortfolioRisk.max) {
      throw new RepositoryError(
        `max_portfolio_risk must be between ${strategyConfig.maxPortfolioRisk.min} and ${strategyConfig.maxPortfolioRisk.max}`,
        'INVALID_RISK_PARAMETER',
        400
      );
    }

    if (params.max_positions < strategyConfig.maxPositions.min ||
        params.max_positions > strategyConfig.maxPositions.max) {
      throw new RepositoryError(
        `max_positions must be between ${strategyConfig.maxPositions.min} and ${strategyConfig.maxPositions.max}`,
        'INVALID_RISK_PARAMETER',
        400
      );
    }

    if (params.max_risk_per_trade * params.max_positions > params.max_portfolio_risk) {
      throw new RepositoryError(
        'Risk parameters are inconsistent: max_risk_per_trade * max_positions cannot exceed max_portfolio_risk',
        'INCONSISTENT_RISK_PARAMETERS',
        400
      );
    }
  }

  /**
   * Validate symbols and timeframes
   */
  private validateSymbolsAndTimeframes(
    type: StrategyType,
    symbols: string[],
    timeframes: string[]
  ): void {
    const strategyConfig = StrategyRepository.STRATEGY_CONFIGURATIONS[type];

    if (symbols.length === 0) {
      throw new RepositoryError('At least one symbol is required', 'MISSING_SYMBOLS', 400);
    }

    if (timeframes.length === 0) {
      throw new RepositoryError('At least one timeframe is required', 'MISSING_TIMEFRAMES', 400);
    }

    // Validate supported timeframes
    for (const timeframe of timeframes) {
      if (!strategyConfig.supportedTimeframes.includes(timeframe)) {
        throw new RepositoryError(
          `Timeframe ${timeframe} is not supported for ${type} strategy`,
          'UNSUPPORTED_TIMEFRAME',
          400,
          { timeframe, supportedTimeframes: strategyConfig.supportedTimeframes }
        );
      }
    }

    // Additional symbol validation could be added here
    // (e.g., checking against supported symbols list)
  }

  /**
   * Validate status transitions
   */
  private validateStatusTransition(currentStatus: StrategyStatus, newStatus: StrategyStatus): void {
    const validTransitions: Record<StrategyStatus, StrategyStatus[]> = {
      'paused': ['active', 'stopped'],
      'active': ['paused', 'stopped', 'error'],
      'stopped': ['paused'],
      'error': ['paused', 'stopped']
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new RepositoryError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        'INVALID_STATUS_TRANSITION',
        400,
        { currentStatus, newStatus, validTransitions: validTransitions[currentStatus] }
      );
    }
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(
    value: any, 
    expectedType: 'string' | 'number' | 'boolean' | 'array' | 'object'
  ): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Validate parameter range
   */
  private validateParameterRange(
    value: any, 
    range: { min?: number; max?: number; values?: any[] }
  ): boolean {
    if (range.values) {
      return range.values.includes(value);
    }

    if (typeof value === 'number') {
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
    }

    return true;
  }

  /**
   * Log strategy events for audit trail
   */
  private async logStrategyEvent(
    strategyId: string,
    event: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO system_logs (level, service, component, message, details, strategy_id) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'info',
          'trading-bot',
          'strategy_repository',
          event,
          JSON.stringify(details),
          strategyId
        ]
      );
    } catch (error) {
      // Log errors shouldn't break the main operation
      console.warn('Failed to log strategy event:', error);
    }
  }

  /**
   * Get strategy health check information
   */
  public async getHealthStatus(): Promise<{
    table: string;
    accessible: boolean;
    recordCount?: number;
    activeStrategies?: number;
    lastError?: string;
  }> {
    try {
      const baseHealth = await super.getHealthStatus();
      
      if (baseHealth.accessible) {
        // Get active strategies count
        const activeResult = await this.db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM ${this.options.tableName} WHERE status = 'active'`
        );
        
        return {
          ...baseHealth,
          activeStrategies: Number(activeResult.rows[0]?.count || 0)
        };
      }

      return baseHealth;
    } catch (error) {
      return {
        table: this.options.tableName,
        accessible: false,
        lastError: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export default StrategyRepository;