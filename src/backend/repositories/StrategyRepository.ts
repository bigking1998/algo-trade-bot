/**
 * StrategyRepository - Task BE-003: Strategy Repository Implementation
 * 
 * Specialized repository for trading strategy management extending BaseRepository.
 * Implements strategy performance tracking, active strategy management,
 * configuration validation, and comprehensive analytics.
 */

import { BaseRepository, RepositoryResult } from './BaseRepository';
import { Strategy, CacheConfig, ValidationError } from '../types/database';

export interface StrategyPerformanceMetrics {
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
}

export interface StrategyWithPerformance {
  strategy: Strategy;
  metrics: StrategyPerformanceMetrics;
}

export interface StrategyRanking {
  strategy: Strategy;
  rank: number;
  totalReturn: number;
  sharpeRatio: number;
  winRate: number;
}

export class StrategyRepository extends BaseRepository<Strategy> {
  constructor() {
    super('strategies', 'id');
  }

  /**
   * SPECIALIZED QUERY METHODS
   */

  /**
   * Find all active strategies
   */
  async findActiveStrategies(cacheConfig?: CacheConfig): Promise<RepositoryResult<Strategy[]>> {
    const startTime = Date.now();
    
    try {
      const cacheOptions: CacheConfig = cacheConfig || {
        key: 'strategies:active',
        ttl: 60 // Cache for 60 seconds
      };

      const result = await this.findMany(
        { status: 'active' } as Partial<Strategy>,
        { orderBy: 'created_at', orderDirection: 'DESC' },
        cacheOptions
      );

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'findActiveStrategies', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Find strategies by type with optional status filtering
   */
  async findByType(
    type: Strategy['type'], 
    status?: Strategy['status'],
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<Strategy[]>> {
    const startTime = Date.now();
    
    try {
      const criteria: Partial<Strategy> = { type };
      if (status) {
        criteria.status = status;
      }

      const cacheOptions: CacheConfig = cacheConfig || {
        key: `strategies:type:${type}:${status || 'all'}`,
        ttl: 300 // Cache for 5 minutes
      };

      const result = await this.findMany(
        criteria,
        { orderBy: 'created_at', orderDirection: 'DESC' },
        cacheOptions
      );

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'findByType', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * PERFORMANCE TRACKING METHODS
   */

  /**
   * Update strategy performance metrics
   */
  async updatePerformanceMetrics(
    strategyId: string, 
    metrics: Partial<Strategy['performance_metrics']>
  ): Promise<RepositoryResult<Strategy>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      // Get current strategy
      const currentResult = await this.findById(strategyId);
      if (!currentResult.success || !currentResult.data) {
        throw new ValidationError(`Strategy ${strategyId} not found`);
      }

      const current = currentResult.data;

      // Merge with existing metrics
      const updatedMetrics = {
        ...current.performance_metrics,
        ...metrics,
        last_updated: new Date().toISOString()
      };

      // Update the strategy
      const result = await this.update(strategyId, {
        performance_metrics: updatedMetrics
      } as Partial<Strategy>);

      // Invalidate performance caches
      await this.invalidateStrategyCache(strategyId);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'updatePerformanceMetrics', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Get comprehensive strategy performance analytics
   */
  async getStrategyPerformance(
    strategyId: string, 
    timeframe: '1d' | '7d' | '30d' | '90d' | 'all' = 'all',
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<StrategyWithPerformance>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const cacheOptions: CacheConfig = cacheConfig || {
        key: `strategy:performance:${strategyId}:${timeframe}`,
        ttl: 120 // Cache for 2 minutes
      };

      // Get strategy details
      const strategyResult = await this.findById(strategyId);
      if (!strategyResult.success || !strategyResult.data) {
        throw new ValidationError(`Strategy ${strategyId} not found`);
      }

      const strategy = strategyResult.data;

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

      // Performance analytics query using BaseRepository's query method
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

      const performanceResult = await this.query<any>(performanceQuery, [strategyId], cacheOptions);
      const stats = performanceResult.rows && performanceResult.rows.length > 0 ? performanceResult.rows[0] : {};

      const result: StrategyWithPerformance = {
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

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          fromCache: false, // Will be set by DatabaseManager if from cache
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'getStrategyPerformance', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * ACTIVE STRATEGY MANAGEMENT
   */

  /**
   * Activate a strategy for live trading
   */
  async activateStrategy(strategyId: string): Promise<RepositoryResult<Strategy>> {
    const startTime = Date.now();
    
    try {
      // Validate strategy configuration before activation
      const validationResult = await this.validateStrategyConfiguration(strategyId);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error,
          metadata: validationResult.metadata,
        };
      }

      const result = await this.updateStrategyStatus(strategyId, 'active');
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'activateStrategy', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Pause a strategy (stops new trades, keeps existing positions)
   */
  async pauseStrategy(strategyId: string): Promise<RepositoryResult<Strategy>> {
    return this.updateStrategyStatus(strategyId, 'paused');
  }

  /**
   * Archive a strategy (stops all activity)
   */
  async archiveStrategy(strategyId: string): Promise<RepositoryResult<Strategy>> {
    return this.updateStrategyStatus(strategyId, 'archived');
  }

  /**
   * Update strategy status with validation
   */
  private async updateStrategyStatus(
    strategyId: string, 
    status: Strategy['status']
  ): Promise<RepositoryResult<Strategy>> {
    const startTime = Date.now();
    
    try {
      const result = await this.update(strategyId, { status } as Partial<Strategy>);
      
      if (result.success) {
        // Invalidate strategy caches
        await this.invalidateStrategyCache(strategyId);
      }

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'updateStrategyStatus', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * CONFIGURATION VALIDATION
   */

  /**
   * Validate strategy configuration before activation
   */
  async validateStrategyConfiguration(strategyId: string): Promise<RepositoryResult<boolean>> {
    const startTime = Date.now();
    
    try {
      const strategyResult = await this.findById(strategyId);
      if (!strategyResult.success || !strategyResult.data) {
        return {
          success: false,
          error: new ValidationError(`Strategy ${strategyId} not found`),
          metadata: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      const strategy = strategyResult.data;

      // Validate required parameters based on strategy type
      const requiredParams = this.getRequiredParameters(strategy.type);
      const missingParams = requiredParams.filter(
        param => !(param in strategy.parameters)
      );

      if (missingParams.length > 0) {
        return {
          success: false,
          error: new ValidationError(
            `Strategy ${strategyId} missing required parameters: ${missingParams.join(', ')}`
          ),
          metadata: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      // Validate risk profile
      if (!strategy.risk_profile || Object.keys(strategy.risk_profile).length === 0) {
        return {
          success: false,
          error: new ValidationError(`Strategy ${strategyId} must have risk profile configured`),
          metadata: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      // Validate parameter values
      const paramValidation = await this.validateParameterValues(strategy);
      if (!paramValidation.success) {
        return paramValidation;
      }

      return {
        success: true,
        data: true,
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'validateStrategyConfiguration', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Validate parameter values based on strategy type
   */
  private async validateParameterValues(strategy: Strategy): Promise<RepositoryResult<boolean>> {
    const startTime = Date.now();
    
    try {
      const params = strategy.parameters;
      const errors: string[] = [];

      // Common validations for all strategy types
      if (params.timeframe && !['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].includes(params.timeframe as string)) {
        errors.push('Invalid timeframe');
      }

      // Type-specific validations
      switch (strategy.type) {
        case 'technical':
          if (params.indicators && !Array.isArray(params.indicators)) {
            errors.push('Indicators must be an array');
          }
          break;

        case 'fundamental':
          if (params.metrics && typeof params.metrics !== 'object') {
            errors.push('Metrics must be an object');
          }
          break;

        case 'ml':
          if (!params.model_url || typeof params.model_url !== 'string') {
            errors.push('ML model URL is required');
          }
          if (!params.confidence_threshold || typeof params.confidence_threshold !== 'number') {
            errors.push('Confidence threshold must be a number');
          }
          break;

        case 'hybrid':
          const weights = [params.technical_weight, params.fundamental_weight, params.ml_weight];
          if (weights.some(w => typeof w !== 'number' || (w as number) < 0 || (w as number) > 1)) {
            errors.push('All weights must be numbers between 0 and 1');
          }
          const totalWeight = weights.reduce((sum, w) => (sum as number) + ((w as number) || 0), 0) as number;
          if (Math.abs(totalWeight - 1) > 0.01) {
            errors.push('Weights must sum to 1');
          }
          break;
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: new ValidationError(`Parameter validation failed: ${errors.join(', ')}`),
          metadata: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      return {
        success: true,
        data: true,
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'validateParameterValues', { executionTimeMs: Date.now() - startTime });
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
   * SPECIALIZED ANALYTICS
   */

  /**
   * Get strategy rankings by performance
   */
  async getStrategyRankings(
    timeframe: '1d' | '7d' | '30d' | '90d' = '30d',
    limit: number = 10,
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<StrategyRanking[]>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const cacheOptions: CacheConfig = cacheConfig || {
        key: `strategies:rankings:${timeframe}:${limit}`,
        ttl: 300 // Cache for 5 minutes
      };

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
            s.description,
            s.type,
            s.status,
            s.parameters,
            s.risk_profile,
            s.performance_metrics,
            s.created_at,
            s.updated_at,
            s.created_by,
            s.version,
            s.is_deleted,
            COUNT(t.id) as total_trades,
            COUNT(t.id) FILTER (WHERE t.pnl > 0) as winning_trades,
            SUM(t.pnl) as total_return,
            AVG(t.pnl) as avg_return,
            STDDEV(t.pnl) as return_stddev
          FROM strategies s
          LEFT JOIN trades t ON s.id = t.strategy_id 
            AND t.status = 'filled' 
            AND t.exit_time IS NOT NULL
            AND t.exit_time >= NOW() - INTERVAL '${intervals[timeframe]}'
          WHERE s.is_deleted = FALSE
          GROUP BY s.id, s.name, s.description, s.type, s.status, s.parameters, s.risk_profile, s.performance_metrics, s.created_at, s.updated_at, s.created_by, s.version, s.is_deleted
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

      const result = await this.query<any>(query, [limit], cacheOptions);
      
      const rankings: StrategyRanking[] = (result.rows || []).map((row: any) => ({
        strategy: {
          id: row.id,
          name: row.name,
          description: row.description,
          type: row.type,
          status: row.status,
          parameters: row.parameters,
          risk_profile: row.risk_profile,
          performance_metrics: row.performance_metrics,
          created_at: row.created_at,
          updated_at: row.updated_at,
          created_by: row.created_by,
          version: row.version,
          is_deleted: row.is_deleted
        } as Strategy,
        rank: parseInt(row.rank),
        totalReturn: parseFloat(row.total_return) || 0,
        sharpeRatio: parseFloat(row.sharpe_ratio) || 0,
        winRate: parseFloat(row.win_rate) || 0
      }));

      return {
        success: true,
        data: rankings,
        metadata: {
          rowCount: rankings.length,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'getStrategyRankings', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Clone an existing strategy with new name
   */
  async cloneStrategy(
    sourceStrategyId: string, 
    newName: string,
    modifications?: Partial<Pick<Strategy, 'parameters' | 'risk_profile'>>
  ): Promise<RepositoryResult<Strategy>> {
    const startTime = Date.now();
    
    try {
      const sourceResult = await this.findById(sourceStrategyId);
      if (!sourceResult.success || !sourceResult.data) {
        return {
          success: false,
          error: new ValidationError(`Source strategy ${sourceStrategyId} not found`),
          metadata: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      const sourceStrategy = sourceResult.data;

      const newStrategy: Partial<Strategy> = {
        name: newName,
        description: `Cloned from ${sourceStrategy.name}`,
        type: sourceStrategy.type,
        status: 'inactive',
        parameters: modifications?.parameters || sourceStrategy.parameters,
        risk_profile: modifications?.risk_profile || sourceStrategy.risk_profile,
        version: 1
      };

      const result = await this.create(newStrategy);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'cloneStrategy', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * CACHING AND UTILITY METHODS
   */

  /**
   * Invalidate all caches related to a specific strategy
   */
  private async invalidateStrategyCache(strategyId: string): Promise<void> {
    const patterns = [
      'strategies:active',
      'strategies:type:*',
      `strategy:performance:${strategyId}:*`,
      'strategies:rankings:*'
    ];

    await this.invalidateCache(patterns);
  }

  /**
   * Override entity validation with strategy-specific logic
   */
  protected async validateEntity(entity: Partial<Strategy>, operation: 'create' | 'update'): Promise<void> {
    // Call parent validation first
    await super.validateEntity(entity, operation);

    // Strategy-specific validations
    if (operation === 'create') {
      if (!entity.name || entity.name.trim().length === 0) {
        throw new ValidationError('Strategy name is required');
      }

      if (!entity.type) {
        throw new ValidationError('Strategy type is required');
      }

      if (!entity.parameters || typeof entity.parameters !== 'object') {
        throw new ValidationError('Strategy parameters are required');
      }
    }

    if (entity.status && !['active', 'inactive', 'paused', 'archived'].includes(entity.status)) {
      throw new ValidationError('Invalid strategy status');
    }

    if (entity.type && !['technical', 'fundamental', 'ml', 'hybrid'].includes(entity.type)) {
      throw new ValidationError('Invalid strategy type');
    }

    // Validate parameters structure
    if (entity.parameters && typeof entity.parameters === 'object') {
      const params = entity.parameters as Record<string, unknown>;
      
      // Basic parameter validations
      if (params.timeframe && typeof params.timeframe !== 'string') {
        throw new ValidationError('Timeframe must be a string');
      }
    }

    // Validate risk profile structure
    if (entity.risk_profile && typeof entity.risk_profile !== 'object') {
      throw new ValidationError('Risk profile must be an object');
    }
  }
}