/**
 * Portfolio Snapshot Repository Implementation
 * Task BE-002: Base Repository Implementation - PortfolioSnapshotRepository
 * 
 * Production-ready repository for portfolio state tracking with real-time metrics,
 * risk analysis, and performance monitoring.
 */

import { BaseRepository, QueryOptions } from '../BaseRepository';

// Portfolio snapshot domain types based on database schema
export interface PortfolioSnapshot {
  time: Date;
  strategy_id: string;
  
  // Portfolio composition
  total_value: number;
  cash_balance: number;
  invested_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  
  // Position details
  positions: Record<string, any>;
  position_count: number;
  
  // Risk metrics
  total_exposure: number;
  leverage: number;
  var_1d?: number; // Value at Risk 1 day
  max_drawdown: number;
  
  // Performance metrics
  total_return: number;
  daily_return: number;
  sharpe_ratio?: number;
  volatility?: number;
  beta?: number;
  alpha?: number;
  
  // Market correlation
  market_correlation?: number;
  
  // Asset allocation
  asset_allocation: Record<string, any>;
  
  // Metadata
  snapshot_trigger: string;
  created_at: Date;
}

export interface PortfolioSnapshotCreateData {
  strategy_id: string;
  total_value: number;
  cash_balance?: number;
  invested_value?: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  positions?: Record<string, any>;
  position_count?: number;
  total_exposure?: number;
  leverage?: number;
  var_1d?: number;
  max_drawdown?: number;
  total_return?: number;
  daily_return?: number;
  sharpe_ratio?: number;
  volatility?: number;
  beta?: number;
  alpha?: number;
  market_correlation?: number;
  asset_allocation?: Record<string, any>;
  snapshot_trigger?: string;
}

export interface PortfolioMetrics {
  strategy_id: string;
  latest_snapshot: PortfolioSnapshot;
  value_change_24h: number;
  value_change_percentage_24h: number;
  pnl_change_24h: number;
  risk_level: 'low' | 'medium' | 'high';
  position_diversity_score: number;
  performance_vs_benchmark: number;
}

export interface PortfolioTimeSeriesData {
  timestamps: Date[];
  total_values: number[];
  pnl_values: number[];
  drawdown_values: number[];
  return_values: number[];
}

export interface PortfolioFilters {
  strategy_ids?: string[];
  time_from?: Date;
  time_to?: Date;
  min_value?: number;
  max_value?: number;
  snapshot_trigger?: string;
  has_positions?: boolean;
}

/**
 * Repository class for portfolio snapshot management and analysis
 */
export class PortfolioSnapshotRepository extends BaseRepository<PortfolioSnapshot> {
  constructor() {
    super({
      tableName: 'portfolio_snapshots',
      primaryKeyField: 'time',
      enableCaching: true,
      defaultCacheTTL: 60, // 1 minute for portfolio snapshots (real-time data)
    });
  }

  /**
   * Create a portfolio snapshot with validation
   */
  public async createSnapshot(data: PortfolioSnapshotCreateData): Promise<PortfolioSnapshot> {
    this.validateSnapshotData(data);

    const snapshotData = {
      ...data,
      time: new Date(),
      cash_balance: data.cash_balance ?? 0,
      invested_value: data.invested_value ?? 0,
      unrealized_pnl: data.unrealized_pnl ?? 0,
      realized_pnl: data.realized_pnl ?? 0,
      positions: data.positions ?? {},
      position_count: data.position_count ?? 0,
      total_exposure: data.total_exposure ?? 0,
      leverage: data.leverage ?? 1.0,
      max_drawdown: data.max_drawdown ?? 0,
      total_return: data.total_return ?? 0,
      daily_return: data.daily_return ?? 0,
      asset_allocation: data.asset_allocation ?? {},
      snapshot_trigger: data.snapshot_trigger ?? 'manual',
    };

    return await this.create(snapshotData);
  }

  /**
   * Get latest portfolio snapshot for a strategy
   */
  public async getLatestSnapshot(strategyId: string): Promise<PortfolioSnapshot | null> {
    const snapshots = await this.findBy(
      { strategy_id: strategyId },
      {
        orderBy: 'time',
        orderDirection: 'DESC',
        limit: 1,
        cache: {
          key: `portfolio:latest:${strategyId}`,
          ttl: 30, // 30 seconds cache for latest snapshot
        },
      }
    );

    return snapshots[0] || null;
  }

  /**
   * Get portfolio snapshots for a time range
   */
  public async getSnapshotsInRange(
    strategyId: string,
    startTime: Date,
    endTime: Date,
    limit?: number
  ): Promise<PortfolioSnapshot[]> {
    const query = `
      SELECT * FROM portfolio_snapshots 
      WHERE strategy_id = $1 
        AND time >= $2 
        AND time <= $3 
      ORDER BY time ASC
      ${limit ? `LIMIT ${limit}` : ''}
    `;

    const result = await this.query<PortfolioSnapshot>(query, [strategyId, startTime, endTime]);
    return result.rows;
  }

  /**
   * Get portfolio time series data for charting
   */
  public async getTimeSeriesData(
    strategyId: string,
    startTime: Date,
    endTime: Date,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h'
  ): Promise<PortfolioTimeSeriesData> {
    const intervalMap = {
      '1m': '1 minute',
      '5m': '5 minutes',
      '15m': '15 minutes',
      '1h': '1 hour',
      '4h': '4 hours',
      '1d': '1 day',
    };

    const query = `
      WITH time_buckets AS (
        SELECT 
          time_bucket('${intervalMap[interval]}', time) as bucket_time,
          AVG(total_value) as avg_total_value,
          AVG(unrealized_pnl + realized_pnl) as avg_pnl,
          AVG(max_drawdown) as avg_drawdown,
          AVG(total_return) as avg_return
        FROM portfolio_snapshots
        WHERE strategy_id = $1 
          AND time >= $2 
          AND time <= $3
        GROUP BY bucket_time
        ORDER BY bucket_time
      )
      SELECT 
        array_agg(bucket_time ORDER BY bucket_time) as timestamps,
        array_agg(avg_total_value ORDER BY bucket_time) as total_values,
        array_agg(avg_pnl ORDER BY bucket_time) as pnl_values,
        array_agg(avg_drawdown ORDER BY bucket_time) as drawdown_values,
        array_agg(avg_return ORDER BY bucket_time) as return_values
      FROM time_buckets
    `;

    const result = await this.query<{
      timestamps: Date[];
      total_values: number[];
      pnl_values: number[];
      drawdown_values: number[];
      return_values: number[];
    }>(query, [strategyId, startTime, endTime]);

    const row = result.rows[0];
    return {
      timestamps: row?.timestamps || [],
      total_values: row?.total_values || [],
      pnl_values: row?.pnl_values || [],
      drawdown_values: row?.drawdown_values || [],
      return_values: row?.return_values || [],
    };
  }

  /**
   * Get portfolio metrics with risk analysis
   */
  public async getPortfolioMetrics(strategyId: string): Promise<PortfolioMetrics | null> {
    const latestSnapshot = await this.getLatestSnapshot(strategyId);
    if (!latestSnapshot) {
      return null;
    }

    // Get snapshot from 24 hours ago for comparison
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayAgoSnapshots = await this.findBy(
      { strategy_id: strategyId },
      {
        orderBy: 'time',
        orderDirection: 'DESC',
        limit: 1,
      }
    );

    const previousSnapshot = dayAgoSnapshots[0];
    const valueChange24h = previousSnapshot 
      ? latestSnapshot.total_value - previousSnapshot.total_value
      : 0;
    const valueChangePercentage24h = previousSnapshot && previousSnapshot.total_value > 0
      ? (valueChange24h / previousSnapshot.total_value) * 100
      : 0;
    const pnlChange24h = previousSnapshot
      ? (latestSnapshot.unrealized_pnl + latestSnapshot.realized_pnl) - 
        (previousSnapshot.unrealized_pnl + previousSnapshot.realized_pnl)
      : 0;

    // Calculate risk level based on leverage and exposure
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (latestSnapshot.leverage > 3 || latestSnapshot.max_drawdown > 0.15) {
      riskLevel = 'high';
    } else if (latestSnapshot.leverage > 1.5 || latestSnapshot.max_drawdown > 0.08) {
      riskLevel = 'medium';
    }

    // Calculate position diversity score (0-100)
    const positions = latestSnapshot.positions as Record<string, any>;
    const positionCount = Object.keys(positions).length;
    const positionDiversityScore = Math.min(100, positionCount * 20);

    return {
      strategy_id: strategyId,
      latest_snapshot: latestSnapshot,
      value_change_24h: valueChange24h,
      value_change_percentage_24h: valueChangePercentage24h,
      pnl_change_24h: pnlChange24h,
      risk_level: riskLevel,
      position_diversity_score: positionDiversityScore,
      performance_vs_benchmark: 0, // TODO: Implement benchmark comparison
    };
  }

  /**
   * Get portfolio snapshots with advanced filtering
   */
  public async searchSnapshots(
    filters: PortfolioFilters,
    queryOptions?: QueryOptions
  ): Promise<PortfolioSnapshot[]> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.strategy_ids && filters.strategy_ids.length > 0) {
      whereConditions.push(`strategy_id = ANY($${paramIndex++})`);
      params.push(filters.strategy_ids);
    }

    if (filters.time_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.time_from);
    }

    if (filters.time_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.time_to);
    }

    if (filters.min_value !== undefined) {
      whereConditions.push(`total_value >= $${paramIndex++}`);
      params.push(filters.min_value);
    }

    if (filters.max_value !== undefined) {
      whereConditions.push(`total_value <= $${paramIndex++}`);
      params.push(filters.max_value);
    }

    if (filters.snapshot_trigger) {
      whereConditions.push(`snapshot_trigger = $${paramIndex++}`);
      params.push(filters.snapshot_trigger);
    }

    if (filters.has_positions !== undefined) {
      if (filters.has_positions) {
        whereConditions.push(`position_count > 0`);
      } else {
        whereConditions.push(`position_count = 0`);
      }
    }

    let query = 'SELECT * FROM portfolio_snapshots';
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add ordering
    const orderBy = queryOptions?.orderBy || 'time';
    const orderDirection = queryOptions?.orderDirection || 'DESC';
    query += ` ORDER BY ${orderBy} ${orderDirection}`;

    // Add limit and offset
    if (queryOptions?.limit) {
      query += ` LIMIT ${queryOptions.limit}`;
      if (queryOptions.offset) {
        query += ` OFFSET ${queryOptions.offset}`;
      }
    }

    const result = await this.query<PortfolioSnapshot>(query, params);
    return result.rows;
  }

  /**
   * Get portfolio summary statistics
   */
  public async getPortfolioSummary(strategyId: string, days: number = 30): Promise<{
    total_snapshots: number;
    avg_daily_return: number;
    max_value: number;
    min_value: number;
    current_value: number;
    volatility: number;
    max_drawdown: number;
    total_return_period: number;
  }> {
    const query = `
      WITH snapshot_stats AS (
        SELECT 
          COUNT(*) as total_snapshots,
          MAX(total_value) as max_value,
          MIN(total_value) as min_value,
          AVG(daily_return) as avg_daily_return,
          STDDEV(daily_return) as volatility,
          MAX(max_drawdown) as max_drawdown,
          FIRST_VALUE(total_value) OVER (ORDER BY time ASC) as first_value,
          FIRST_VALUE(total_value) OVER (ORDER BY time DESC) as current_value
        FROM portfolio_snapshots
        WHERE strategy_id = $1 
          AND time >= NOW() - INTERVAL '${days} days'
      )
      SELECT 
        *,
        CASE 
          WHEN first_value > 0 
          THEN ((current_value - first_value) / first_value * 100)
          ELSE 0 
        END as total_return_period
      FROM snapshot_stats
    `;

    const result = await this.query<{
      total_snapshots: number;
      avg_daily_return: number;
      max_value: number;
      min_value: number;
      current_value: number;
      volatility: number;
      max_drawdown: number;
      total_return_period: number;
    }>(query, [strategyId]);

    return result.rows[0] || {
      total_snapshots: 0,
      avg_daily_return: 0,
      max_value: 0,
      min_value: 0,
      current_value: 0,
      volatility: 0,
      max_drawdown: 0,
      total_return_period: 0,
    };
  }

  /**
   * Clean up old snapshots based on retention policy
   */
  public async cleanupOldSnapshots(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const query = `
      DELETE FROM portfolio_snapshots 
      WHERE time < $1 
        AND snapshot_trigger NOT IN ('trade', 'risk_event')
    `;

    const result = await this.query(query, [cutoffDate]);
    return result.rowCount || 0;
  }

  /**
   * Validate snapshot data before creation
   */
  private validateSnapshotData(data: PortfolioSnapshotCreateData): void {
    if (!data.strategy_id) {
      throw new Error('Strategy ID is required for portfolio snapshot');
    }

    if (data.total_value < 0) {
      throw new Error('Total portfolio value cannot be negative');
    }

    if (data.leverage && data.leverage < 0) {
      throw new Error('Leverage cannot be negative');
    }

    if (data.position_count && data.position_count < 0) {
      throw new Error('Position count cannot be negative');
    }

    if (data.market_correlation && (data.market_correlation < -1 || data.market_correlation > 1)) {
      throw new Error('Market correlation must be between -1 and 1');
    }
  }
}

export default PortfolioSnapshotRepository;