import { BaseRepository } from './BaseRepository.js';
import { DatabaseManager } from '../database/DatabaseManager.js';
import type { Strategy } from '../types/database.js';

/**
 * Strategy Repository - Specialized repository for trading strategy management
 * 
 * Extends BaseRepository with strategy-specific operations including:
 * - Active strategy management and performance tracking
 * - Strategy configuration validation and versioning
 * - Performance metrics calculation and analytics
 * - Strategy lifecycle management (activate, pause, archive)
 */
export class StrategyRepository extends BaseRepository<Strategy> {
  protected tableName = 'strategies';
  protected primaryKey = 'id';

  constructor() {
    super();
  }

  /**
   * Find all active strategies
   * Active strategies are eligible for execution and monitoring
   */
  async findActiveStrategies(): Promise<Strategy[]> {
    const cacheKey = 'strategies:active';
    
    // Check cache first
    const cached = await this.getCached<Strategy[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE status = $1 AND is_deleted = FALSE
      ORDER BY created_at DESC
    `;

    const result = await this.executeQuery<Strategy>(query, ['active']);
    
    // Cache active strategies for 60 seconds
    await this.setCached(cacheKey, result, 60);
    
    return result;
  }

  /**
   * Find strategies by type with optional status filtering
   */
  async findByType(type: Strategy['type'], status?: Strategy['status']): Promise<Strategy[]> {
    const cacheKey = `strategies:type:${type}:${status || 'all'}`;
    
    const cached = await this.getCached<Strategy[]>(cacheKey);
    if (cached) {
      return cached;
    }

    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE type = $1 AND is_deleted = FALSE
    `;
    const params: any[] = [type];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.executeQuery<Strategy>(query, params);
    
    // Cache for 5 minutes
    await this.setCached(cacheKey, result, 300);
    
    return result;
  }

  /**
   * Update strategy performance metrics
   * Used by trading engine to update strategy statistics
   */
  async updatePerformanceMetrics(
    strategyId: string, 
    metrics: Partial<Strategy['performance_metrics']>
  ): Promise<Strategy> {
    await this.invalidateStrategyCache(strategyId);

    // Get current performance metrics
    const current = await this.findById(strategyId);
    if (!current) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Merge with existing metrics
    const updatedMetrics = {
      ...current.performance_metrics,
      ...metrics,
      last_updated: new Date().toISOString()
    };

    const query = `
      UPDATE ${this.tableName} 
      SET performance_metrics = $1, updated_at = NOW()
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING *
    `;

    const result = await this.executeQuery<Strategy>(
      query, 
      [JSON.stringify(updatedMetrics), strategyId]
    );

    if (result.length === 0) {
      throw new Error(`Failed to update performance metrics for strategy ${strategyId}`);
    }

    return result[0];
  }

  /**
   * Get comprehensive strategy performance analytics
   */
  async getStrategyPerformance(
    strategyId: string, 
    timeframe: '1d' | '7d' | '30d' | '90d' | 'all' = 'all'
  ): Promise<{
    strategy: Strategy;
    metrics: {
      totalTrades: number;
      winRate: number;
      totalReturn: number;
      sharpeRatio: number;
      maxDrawdown: number;
      profitFactor: number;
      avgHoldingPeriod: number;
      recentPerformance: Array<{
        date: string;
        pnl: number;
        trades: number;
      }>;
    };
  }> {
    const cacheKey = `strategy:performance:${strategyId}:${timeframe}`;
    
    const cached = await this.getCached<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get strategy details
    const strategy = await this.findById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Calculate date filter based on timeframe
    let dateFilter = '';
    if (timeframe !== 'all') {
      const intervals: Record<string, string> = {
        '1d': '1 day',
        '7d': '7 days',
        '30d': '30 days',
        '90d': '90 days'
      };
      dateFilter = `AND t.created_at >= NOW() - INTERVAL '${intervals[timeframe]}'`;
    }

    // Complex performance analytics query
    const performanceQuery = `
      WITH trade_stats AS (
        SELECT 
          COUNT(*) as total_trades,
          COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          STDDEV(pnl) as pnl_stddev,
          MAX(pnl) as max_win,
          MIN(pnl) as max_loss,
          AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))/3600) as avg_holding_hours
        FROM trades t
        WHERE t.strategy_id = $1 
          AND t.status = 'filled' 
          AND t.exit_time IS NOT NULL
          ${dateFilter}
      ),
      daily_performance AS (
        SELECT 
          DATE(t.exit_time) as trade_date,
          SUM(t.pnl) as daily_pnl,
          COUNT(*) as daily_trades
        FROM trades t
        WHERE t.strategy_id = $1 
          AND t.status = 'filled' 
          AND t.exit_time IS NOT NULL
          ${dateFilter}
        GROUP BY DATE(t.exit_time)
        ORDER BY trade_date DESC
        LIMIT 30
      ),
      drawdown_calc AS (
        SELECT 
          SUM(pnl) OVER (ORDER BY exit_time) as running_pnl,
          MAX(SUM(pnl) OVER (ORDER BY exit_time)) OVER (ORDER BY exit_time) as peak_pnl
        FROM trades t
        WHERE t.strategy_id = $1 
          AND t.status = 'filled' 
          AND t.exit_time IS NOT NULL
          ${dateFilter}
      )
      SELECT 
        ts.*,
        COALESCE(ts.winning_trades::float / NULLIF(ts.total_trades, 0), 0) as win_rate,
        CASE 
          WHEN ts.pnl_stddev > 0 THEN ts.avg_pnl / ts.pnl_stddev 
          ELSE 0 
        END as sharpe_ratio,
        CASE 
          WHEN ts.max_loss < 0 THEN ABS(ts.max_win / ts.max_loss)
          ELSE 0 
        END as profit_factor,
        (
          SELECT MIN(running_pnl - peak_pnl) 
          FROM drawdown_calc
        ) as max_drawdown,
        (
          SELECT json_agg(
            json_build_object(
              'date', trade_date,
              'pnl', daily_pnl,
              'trades', daily_trades
            ) ORDER BY trade_date DESC
          )
          FROM daily_performance
        ) as recent_performance
      FROM trade_stats ts;
    `;

    const performanceResult = await this.executeQuery<any>(performanceQuery, [strategyId]);
    const stats = performanceResult[0] || {};

    const result = {
      strategy,
      metrics: {
        totalTrades: parseInt(stats.total_trades) || 0,
        winRate: parseFloat(stats.win_rate) || 0,
        totalReturn: parseFloat(stats.total_pnl) || 0,
        sharpeRatio: parseFloat(stats.sharpe_ratio) || 0,
        maxDrawdown: parseFloat(stats.max_drawdown) || 0,
        profitFactor: parseFloat(stats.profit_factor) || 0,
        avgHoldingPeriod: parseFloat(stats.avg_holding_hours) || 0,
        recentPerformance: stats.recent_performance || []
      }
    };

    // Cache performance data for 2 minutes
    await this.setCached(cacheKey, result, 120);
    
    return result;
  }

  /**
   * Activate a strategy for live trading
   */
  async activateStrategy(strategyId: string): Promise<Strategy> {
    await this.validateStrategyConfiguration(strategyId);
    return this.updateStrategyStatus(strategyId, 'active');
  }

  /**
   * Pause a strategy (stops new trades, keeps existing positions)
   */
  async pauseStrategy(strategyId: string): Promise<Strategy> {
    return this.updateStrategyStatus(strategyId, 'paused');
  }

  /**
   * Archive a strategy (stops all activity)
   */
  async archiveStrategy(strategyId: string): Promise<Strategy> {
    return this.updateStrategyStatus(strategyId, 'archived');
  }

  /**
   * Update strategy status with validation
   */
  private async updateStrategyStatus(
    strategyId: string, 
    status: Strategy['status']
  ): Promise<Strategy> {
    await this.invalidateStrategyCache(strategyId);

    const query = `
      UPDATE ${this.tableName} 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING *
    `;

    const result = await this.executeQuery<Strategy>(query, [status, strategyId]);
    
    if (result.length === 0) {
      throw new Error(`Strategy ${strategyId} not found or cannot be updated`);
    }

    return result[0];
  }

  /**
   * Validate strategy configuration before activation
   */
  private async validateStrategyConfiguration(strategyId: string): Promise<void> {
    const strategy = await this.findById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Validate required parameters based on strategy type
    const requiredParams = this.getRequiredParameters(strategy.type);
    const missingParams = requiredParams.filter(
      param => !(param in strategy.parameters)
    );

    if (missingParams.length > 0) {
      throw new Error(
        `Strategy ${strategyId} missing required parameters: ${missingParams.join(', ')}`
      );
    }

    // Validate risk profile
    if (!strategy.risk_profile || Object.keys(strategy.risk_profile).length === 0) {
      throw new Error(`Strategy ${strategyId} must have risk profile configured`);
    }
  }

  /**
   * Get required parameters for strategy type
   */
  private getRequiredParameters(type: Strategy['type']): string[] {
    const parameterMap: Record<Strategy['type'], string[]> = {
      technical: ['timeframe', 'indicators'],
      fundamental: ['metrics', 'thresholds'],
      ml: ['model_url', 'features', 'confidence_threshold'],
      hybrid: ['technical_weight', 'fundamental_weight', 'ml_weight']
    };

    return parameterMap[type] || [];
  }

  /**
   * Get strategy rankings by performance
   */
  async getStrategyRankings(
    timeframe: '1d' | '7d' | '30d' | '90d' = '30d',
    limit: number = 10
  ): Promise<Array<{
    strategy: Strategy;
    rank: number;
    totalReturn: number;
    sharpeRatio: number;
    winRate: number;
  }>> {
    const cacheKey = `strategies:rankings:${timeframe}:${limit}`;
    
    const cached = await this.getCached<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Date filter for timeframe
    const intervals: Record<string, string> = {
      '1d': '1 day',
      '7d': '7 days', 
      '30d': '30 days',
      '90d': '90 days'
    };

    const query = `
      WITH strategy_performance AS (
        SELECT 
          s.id,
          s.name,
          s.type,
          s.status,
          s.parameters,
          s.risk_profile,
          s.created_at,
          COUNT(t.id) as total_trades,
          COUNT(t.id) FILTER (WHERE t.pnl > 0) as winning_trades,
          SUM(t.pnl) as total_return,
          AVG(t.pnl) as avg_return,
          STDDEV(t.pnl) as return_stddev
        FROM ${this.tableName} s
        LEFT JOIN trades t ON s.id = t.strategy_id 
          AND t.status = 'filled' 
          AND t.exit_time IS NOT NULL
          AND t.exit_time >= NOW() - INTERVAL '${intervals[timeframe]}'
        WHERE s.is_deleted = FALSE
        GROUP BY s.id, s.name, s.type, s.status, s.parameters, s.risk_profile, s.created_at
      ),
      ranked_strategies AS (
        SELECT 
          *,
          COALESCE(winning_trades::float / NULLIF(total_trades, 0), 0) as win_rate,
          CASE 
            WHEN return_stddev > 0 THEN avg_return / return_stddev 
            ELSE 0 
          END as sharpe_ratio,
          ROW_NUMBER() OVER (ORDER BY total_return DESC, sharpe_ratio DESC) as rank
        FROM strategy_performance
        WHERE total_trades > 0
      )
      SELECT * FROM ranked_strategies
      ORDER BY rank
      LIMIT $1;
    `;

    const results = await this.executeQuery<any>(query, [limit]);
    
    const rankings = results.map(row => ({
      strategy: {
        id: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
        parameters: row.parameters,
        risk_profile: row.risk_profile,
        performance_metrics: {},
        created_at: row.created_at,
        updated_at: row.created_at,
        created_by: null,
        version: 1,
        is_deleted: false,
        description: null
      } as Strategy,
      rank: parseInt(row.rank),
      totalReturn: parseFloat(row.total_return) || 0,
      sharpeRatio: parseFloat(row.sharpe_ratio) || 0,
      winRate: parseFloat(row.win_rate) || 0
    }));

    // Cache rankings for 5 minutes
    await this.setCached(cacheKey, rankings, 300);
    
    return rankings;
  }

  /**
   * Invalidate all caches related to a specific strategy
   */
  private async invalidateStrategyCache(strategyId: string): Promise<void> {
    const patterns = [
      'strategies:active',
      `strategies:type:*`,
      `strategy:performance:${strategyId}:*`,
      'strategies:rankings:*'
    ];

    for (const pattern of patterns) {
      await this.invalidateCachePattern(pattern);
    }
  }

  /**
   * Clone an existing strategy with new name
   */
  async cloneStrategy(
    sourceStrategyId: string, 
    newName: string,
    modifications?: Partial<Pick<Strategy, 'parameters' | 'risk_profile'>>
  ): Promise<Strategy> {
    const sourceStrategy = await this.findById(sourceStrategyId);
    if (!sourceStrategy) {
      throw new Error(`Source strategy ${sourceStrategyId} not found`);
    }

    const newStrategy: Partial<Strategy> = {
      name: newName,
      description: `Cloned from ${sourceStrategy.name}`,
      type: sourceStrategy.type,
      status: 'inactive',
      parameters: modifications?.parameters || sourceStrategy.parameters,
      risk_profile: modifications?.risk_profile || sourceStrategy.risk_profile,
      version: 1
    };

    return this.create(newStrategy);
  }
}