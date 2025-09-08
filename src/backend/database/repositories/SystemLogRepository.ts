/**
 * System Log Repository Implementation
 * Task BE-002: Base Repository Implementation - SystemLogRepository
 * 
 * Production-ready repository for comprehensive application logging with structured data,
 * log filtering, analytics, and monitoring capabilities.
 */

import { BaseRepository, QueryOptions, PaginationResult } from '../BaseRepository';

// System log domain types based on database schema
export interface SystemLog {
  time: Date;
  level: LogLevel;
  
  // Source identification
  service: string;
  component?: string;
  
  // Message details
  message: string;
  details: Record<string, any>;
  
  // Context
  strategy_id?: string;
  trade_id?: string;
  order_id?: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  
  // Performance metrics
  execution_time_ms?: number;
  memory_usage_mb?: number;
  
  // Error details (when applicable)
  error_code?: string;
  stack_trace?: string;
  
  // Metadata
  version?: string;
  environment: string;
  hostname?: string;
}

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface SystemLogCreateData {
  level: LogLevel;
  service?: string;
  component?: string;
  message: string;
  details?: Record<string, any>;
  strategy_id?: string;
  trade_id?: string;
  order_id?: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  execution_time_ms?: number;
  memory_usage_mb?: number;
  error_code?: string;
  stack_trace?: string;
  version?: string;
  environment?: string;
  hostname?: string;
}

export interface LogFilters {
  levels?: LogLevel[];
  services?: string[];
  components?: string[];
  strategy_ids?: string[];
  time_from?: Date;
  time_to?: Date;
  search_message?: string;
  has_errors?: boolean;
  error_codes?: string[];
  min_execution_time?: number;
  session_ids?: string[];
  request_ids?: string[];
}

export interface LogAnalytics {
  total_logs: number;
  log_counts_by_level: Record<LogLevel, number>;
  log_counts_by_service: Record<string, number>;
  error_rate: number;
  avg_execution_time: number;
  most_common_errors: Array<{
    error_code: string;
    count: number;
    latest_occurrence: Date;
  }>;
  performance_issues: Array<{
    component: string;
    avg_execution_time: number;
    slow_query_count: number;
  }>;
}

export interface LogTimeSeriesData {
  timestamps: Date[];
  log_counts: number[];
  error_counts: number[];
  warning_counts: number[];
}

/**
 * Repository class for system log management and analytics
 */
export class SystemLogRepository extends BaseRepository<SystemLog> {
  constructor() {
    super({
      tableName: 'system_logs',
      primaryKeyField: 'time',
      enableCaching: false, // Disable caching for logs to ensure real-time data
      defaultCacheTTL: 0,
    });
  }

  /**
   * Create a system log entry
   */
  public async createLog(data: SystemLogCreateData): Promise<SystemLog> {
    const logData = {
      ...data,
      time: new Date(),
      service: data.service ?? 'trading-bot',
      details: data.details ?? {},
      environment: data.environment ?? process.env.NODE_ENV ?? 'development',
      hostname: data.hostname ?? require('os').hostname(),
    };

    return await this.create(logData);
  }

  /**
   * Log debug message
   */
  public async debug(
    message: string,
    component?: string,
    details?: Record<string, any>,
    context?: Partial<SystemLogCreateData>
  ): Promise<SystemLog> {
    return await this.createLog({
      level: 'debug',
      message,
      component,
      details,
      ...context,
    });
  }

  /**
   * Log info message
   */
  public async info(
    message: string,
    component?: string,
    details?: Record<string, any>,
    context?: Partial<SystemLogCreateData>
  ): Promise<SystemLog> {
    return await this.createLog({
      level: 'info',
      message,
      component,
      details,
      ...context,
    });
  }

  /**
   * Log warning message
   */
  public async warning(
    message: string,
    component?: string,
    details?: Record<string, any>,
    context?: Partial<SystemLogCreateData>
  ): Promise<SystemLog> {
    return await this.createLog({
      level: 'warning',
      message,
      component,
      details,
      ...context,
    });
  }

  /**
   * Log error message
   */
  public async error(
    message: string,
    error?: Error,
    component?: string,
    context?: Partial<SystemLogCreateData>
  ): Promise<SystemLog> {
    return await this.createLog({
      level: 'error',
      message,
      component,
      details: error ? {
        error_name: error.name,
        error_message: error.message,
        ...context?.details,
      } : context?.details,
      error_code: error?.name || context?.error_code,
      stack_trace: error?.stack || context?.stack_trace,
      ...context,
    });
  }

  /**
   * Log critical message
   */
  public async critical(
    message: string,
    error?: Error,
    component?: string,
    context?: Partial<SystemLogCreateData>
  ): Promise<SystemLog> {
    return await this.createLog({
      level: 'critical',
      message,
      component,
      details: error ? {
        error_name: error.name,
        error_message: error.message,
        ...context?.details,
      } : context?.details,
      error_code: error?.name || context?.error_code,
      stack_trace: error?.stack || context?.stack_trace,
      ...context,
    });
  }

  /**
   * Search logs with advanced filtering
   */
  public async searchLogs(
    filters: LogFilters,
    page: number = 1,
    pageSize: number = 100
  ): Promise<PaginationResult<SystemLog>> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.levels && filters.levels.length > 0) {
      whereConditions.push(`level = ANY($${paramIndex++})`);
      params.push(filters.levels);
    }

    if (filters.services && filters.services.length > 0) {
      whereConditions.push(`service = ANY($${paramIndex++})`);
      params.push(filters.services);
    }

    if (filters.components && filters.components.length > 0) {
      whereConditions.push(`component = ANY($${paramIndex++})`);
      params.push(filters.components);
    }

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

    if (filters.search_message) {
      whereConditions.push(`message ILIKE $${paramIndex++}`);
      params.push(`%${filters.search_message}%`);
    }

    if (filters.has_errors !== undefined) {
      if (filters.has_errors) {
        whereConditions.push(`level IN ('error', 'critical')`);
      } else {
        whereConditions.push(`level NOT IN ('error', 'critical')`);
      }
    }

    if (filters.error_codes && filters.error_codes.length > 0) {
      whereConditions.push(`error_code = ANY($${paramIndex++})`);
      params.push(filters.error_codes);
    }

    if (filters.min_execution_time !== undefined) {
      whereConditions.push(`execution_time_ms >= $${paramIndex++}`);
      params.push(filters.min_execution_time);
    }

    if (filters.session_ids && filters.session_ids.length > 0) {
      whereConditions.push(`session_id = ANY($${paramIndex++})`);
      params.push(filters.session_ids);
    }

    if (filters.request_ids && filters.request_ids.length > 0) {
      whereConditions.push(`request_id = ANY($${paramIndex++})`);
      params.push(filters.request_ids);
    }

    return await this.findPaginated(
      whereConditions.length > 0 ? { __where: whereConditions.join(' AND ') } as any : {},
      page,
      pageSize,
      {
        orderBy: 'time',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Get recent logs for a specific component
   */
  public async getRecentLogs(
    component: string,
    level?: LogLevel,
    limit: number = 50
  ): Promise<SystemLog[]> {
    const criteria: Partial<SystemLog> = { component };
    if (level) {
      criteria.level = level;
    }

    return await this.findBy(criteria, {
      orderBy: 'time',
      orderDirection: 'DESC',
      limit,
    });
  }

  /**
   * Get logs for a specific strategy
   */
  public async getStrategyLogs(
    strategyId: string,
    level?: LogLevel,
    limit: number = 100
  ): Promise<SystemLog[]> {
    const criteria: Partial<SystemLog> = { strategy_id: strategyId };
    if (level) {
      criteria.level = level;
    }

    return await this.findBy(criteria, {
      orderBy: 'time',
      orderDirection: 'DESC',
      limit,
    });
  }

  /**
   * Get error logs with stack traces
   */
  public async getErrorLogs(
    hours: number = 24,
    limit: number = 50
  ): Promise<SystemLog[]> {
    const timeFrom = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const query = `
      SELECT * FROM system_logs
      WHERE level IN ('error', 'critical')
        AND time >= $1
      ORDER BY time DESC
      LIMIT $2
    `;

    const result = await this.query<SystemLog>(query, [timeFrom, limit]);
    return result.rows;
  }

  /**
   * Get log analytics and statistics
   */
  public async getLogAnalytics(
    timeFrom: Date,
    timeTo?: Date
  ): Promise<LogAnalytics> {
    const endTime = timeTo || new Date();

    const analyticsQuery = `
      WITH log_stats AS (
        SELECT 
          COUNT(*) as total_logs,
          COUNT(*) FILTER (WHERE level = 'debug') as debug_count,
          COUNT(*) FILTER (WHERE level = 'info') as info_count,
          COUNT(*) FILTER (WHERE level = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE level = 'error') as error_count,
          COUNT(*) FILTER (WHERE level = 'critical') as critical_count,
          AVG(execution_time_ms) FILTER (WHERE execution_time_ms IS NOT NULL) as avg_execution_time
        FROM system_logs
        WHERE time >= $1 AND time <= $2
      ),
      service_stats AS (
        SELECT 
          service,
          COUNT(*) as log_count
        FROM system_logs
        WHERE time >= $1 AND time <= $2
        GROUP BY service
      ),
      error_stats AS (
        SELECT 
          error_code,
          COUNT(*) as error_count,
          MAX(time) as latest_occurrence
        FROM system_logs
        WHERE time >= $1 AND time <= $2 
          AND error_code IS NOT NULL
        GROUP BY error_code
        ORDER BY error_count DESC
        LIMIT 10
      ),
      performance_stats AS (
        SELECT 
          component,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(*) FILTER (WHERE execution_time_ms > 1000) as slow_query_count
        FROM system_logs
        WHERE time >= $1 AND time <= $2 
          AND execution_time_ms IS NOT NULL
          AND component IS NOT NULL
        GROUP BY component
        HAVING AVG(execution_time_ms) > 100
        ORDER BY avg_execution_time DESC
        LIMIT 10
      )
      SELECT 
        ls.total_logs,
        ls.debug_count,
        ls.info_count,
        ls.warning_count,
        ls.error_count,
        ls.critical_count,
        ls.avg_execution_time,
        CASE 
          WHEN ls.total_logs > 0 
          THEN (ls.error_count + ls.critical_count)::FLOAT / ls.total_logs * 100
          ELSE 0 
        END as error_rate,
        array_agg(DISTINCT jsonb_build_object('service', ss.service, 'count', ss.log_count)) as service_counts,
        array_agg(DISTINCT jsonb_build_object('error_code', es.error_code, 'count', es.error_count, 'latest_occurrence', es.latest_occurrence)) 
          FILTER (WHERE es.error_code IS NOT NULL) as common_errors,
        array_agg(DISTINCT jsonb_build_object('component', ps.component, 'avg_execution_time', ps.avg_execution_time, 'slow_query_count', ps.slow_query_count))
          FILTER (WHERE ps.component IS NOT NULL) as performance_issues
      FROM log_stats ls
      CROSS JOIN service_stats ss
      CROSS JOIN error_stats es
      CROSS JOIN performance_stats ps
      GROUP BY ls.total_logs, ls.debug_count, ls.info_count, ls.warning_count, 
               ls.error_count, ls.critical_count, ls.avg_execution_time
    `;

    const result = await this.query<{
      total_logs: number;
      debug_count: number;
      info_count: number;
      warning_count: number;
      error_count: number;
      critical_count: number;
      avg_execution_time: number;
      error_rate: number;
      service_counts: Array<{ service: string; count: number }>;
      common_errors: Array<{ error_code: string; count: number; latest_occurrence: Date }>;
      performance_issues: Array<{ component: string; avg_execution_time: number; slow_query_count: number }>;
    }>(analyticsQuery, [timeFrom, endTime]);

    const row = result.rows[0];
    if (!row) {
      return {
        total_logs: 0,
        log_counts_by_level: {
          debug: 0,
          info: 0,
          warning: 0,
          error: 0,
          critical: 0,
        },
        log_counts_by_service: {},
        error_rate: 0,
        avg_execution_time: 0,
        most_common_errors: [],
        performance_issues: [],
      };
    }

    const logCountsByService: Record<string, number> = {};
    (row.service_counts || []).forEach(item => {
      logCountsByService[item.service] = item.count;
    });

    return {
      total_logs: row.total_logs,
      log_counts_by_level: {
        debug: row.debug_count,
        info: row.info_count,
        warning: row.warning_count,
        error: row.error_count,
        critical: row.critical_count,
      },
      log_counts_by_service: logCountsByService,
      error_rate: row.error_rate,
      avg_execution_time: row.avg_execution_time || 0,
      most_common_errors: (row.common_errors || []).map(error => ({
        error_code: error.error_code,
        count: error.count,
        latest_occurrence: new Date(error.latest_occurrence),
      })),
      performance_issues: (row.performance_issues || []).map(perf => ({
        component: perf.component,
        avg_execution_time: perf.avg_execution_time,
        slow_query_count: perf.slow_query_count,
      })),
    };
  }

  /**
   * Get log time series data for charting
   */
  public async getTimeSeriesData(
    timeFrom: Date,
    timeTo: Date,
    interval: '1m' | '5m' | '15m' | '1h' | '1d' = '1h'
  ): Promise<LogTimeSeriesData> {
    const intervalMap = {
      '1m': '1 minute',
      '5m': '5 minutes',
      '15m': '15 minutes',
      '1h': '1 hour',
      '1d': '1 day',
    };

    const query = `
      WITH time_buckets AS (
        SELECT 
          time_bucket('${intervalMap[interval]}', time) as bucket_time,
          COUNT(*) as log_count,
          COUNT(*) FILTER (WHERE level IN ('error', 'critical')) as error_count,
          COUNT(*) FILTER (WHERE level = 'warning') as warning_count
        FROM system_logs
        WHERE time >= $1 AND time <= $2
        GROUP BY bucket_time
        ORDER BY bucket_time
      )
      SELECT 
        array_agg(bucket_time ORDER BY bucket_time) as timestamps,
        array_agg(log_count ORDER BY bucket_time) as log_counts,
        array_agg(error_count ORDER BY bucket_time) as error_counts,
        array_agg(warning_count ORDER BY bucket_time) as warning_counts
      FROM time_buckets
    `;

    const result = await this.query<{
      timestamps: Date[];
      log_counts: number[];
      error_counts: number[];
      warning_counts: number[];
    }>(query, [timeFrom, timeTo]);

    const row = result.rows[0];
    return {
      timestamps: row?.timestamps || [],
      log_counts: row?.log_counts || [],
      error_counts: row?.error_counts || [],
      warning_counts: row?.warning_counts || [],
    };
  }

  /**
   * Clean up old logs based on retention policy
   */
  public async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    // Keep critical and error logs for longer
    const query = `
      DELETE FROM system_logs 
      WHERE time < $1 
        AND level NOT IN ('error', 'critical')
    `;

    const result = await this.query(query, [cutoffDate]);
    return result.rowCount || 0;
  }

  /**
   * Get unique values for filter dropdowns
   */
  public async getFilterValues(): Promise<{
    services: string[];
    components: string[];
    error_codes: string[];
  }> {
    const query = `
      SELECT 
        array_agg(DISTINCT service ORDER BY service) FILTER (WHERE service IS NOT NULL) as services,
        array_agg(DISTINCT component ORDER BY component) FILTER (WHERE component IS NOT NULL) as components,
        array_agg(DISTINCT error_code ORDER BY error_code) FILTER (WHERE error_code IS NOT NULL) as error_codes
      FROM system_logs
      WHERE time >= NOW() - INTERVAL '7 days'
    `;

    const result = await this.query<{
      services: string[];
      components: string[];
      error_codes: string[];
    }>(query);

    const row = result.rows[0];
    return {
      services: row?.services || [],
      components: row?.components || [],
      error_codes: row?.error_codes || [],
    };
  }
}

export default SystemLogRepository;