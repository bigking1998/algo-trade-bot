/**
 * Database Health Check System for Algorithmic Trading Bot
 * Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
 * 
 * Provides comprehensive database health monitoring, connection validation,
 * and performance metrics for the trading platform.
 */

import { Pool } from 'pg';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: Record<string, unknown>;
  timestamp: Date;
  responseTime?: number;
}

export interface DatabaseHealthMetrics {
  connectionCount: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  totalConnections: number;
  databaseSize: string;
  lastHealthCheck: Date;
  uptime: string;
  version: string;
}

export class DatabaseHealthMonitor {
  private pool: Pool;
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthCheck: Date = new Date();
  private healthHistory: HealthCheckResult[] = [];
  private readonly maxHistorySize = 100;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Start periodic health check monitoring
   */
  public startMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check monitoring error:', error);
      }
    }, intervalMs);

    console.log(`Database health monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop health check monitoring
   */
  public stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    console.log('Database health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    this.lastHealthCheck = new Date();

    // Basic connectivity check
    results.push(await this.checkConnectivity());

    // Connection pool health
    results.push(await this.checkConnectionPool());

    // Database performance
    results.push(await this.checkDatabasePerformance());

    // Database functions
    results.push(await this.checkDatabaseFunctions());

    // Store results in history
    this.addToHistory(results);

    return results;
  }

  /**
   * Check basic database connectivity
   */
  private async checkConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();

      const responseTime = Date.now() - startTime;

      return {
        component: 'database_connectivity',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        details: {
          current_time: result.rows[0].current_time,
          version: result.rows[0].version,
          response_time_ms: responseTime,
        },
        timestamp: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        component: 'database_connectivity',
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          response_time_ms: Date.now() - startTime,
        },
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check connection pool health
   */
  private async checkConnectionPool(): Promise<HealthCheckResult> {
    try {
      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      };

      const utilizationPercent = ((poolStats.totalCount - poolStats.idleCount) / this.pool.options.max!) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (utilizationPercent > 90) {
        status = 'unhealthy';
      } else if (utilizationPercent > 75) {
        status = 'degraded';
      }

      return {
        component: 'connection_pool',
        status,
        details: {
          total_connections: poolStats.totalCount,
          idle_connections: poolStats.idleCount,
          waiting_connections: poolStats.waitingCount,
          utilization_percent: Math.round(utilizationPercent),
          max_connections: this.pool.options.max,
          min_connections: this.pool.options.min,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: 'connection_pool',
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check database performance metrics
   */
  private async checkDatabasePerformance(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const client = await this.pool.connect();

      // Get database size and activity stats
      const statsQuery = `
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          (SELECT count(*) FROM pg_stat_activity) as active_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as running_queries,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
      `;

      const result = await client.query(statsQuery);
      client.release();

      const responseTime = Date.now() - startTime;
      const stats = result.rows[0];

      return {
        component: 'database_performance',
        status: responseTime < 5000 ? 'healthy' : 'degraded',
        details: {
          database_size: stats.database_size,
          active_connections: parseInt(stats.active_connections),
          running_queries: parseInt(stats.running_queries),
          idle_connections: parseInt(stats.idle_connections),
          query_response_time_ms: responseTime,
        },
        timestamp: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        component: 'database_performance',
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          response_time_ms: Date.now() - startTime,
        },
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check custom database functions
   */
  private async checkDatabaseFunctions(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const client = await this.pool.connect();

      // Test the health check function created during initialization
      const result = await client.query('SELECT * FROM check_database_health()');
      client.release();

      const responseTime = Date.now() - startTime;
      const healthResults = result.rows;

      // Determine overall status from function results
      const hasUnhealthy = healthResults.some(row => row.status === 'unhealthy');
      const status = hasUnhealthy ? 'degraded' : 'healthy';

      return {
        component: 'database_functions',
        status,
        details: {
          function_results: healthResults,
          function_response_time_ms: responseTime,
          functions_available: healthResults.length,
        },
        timestamp: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        component: 'database_functions',
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          response_time_ms: Date.now() - startTime,
        },
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get comprehensive database metrics
   */
  public async getMetrics(): Promise<DatabaseHealthMetrics> {
    try {
      const client = await this.pool.connect();

      const metricsQuery = `
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          version() as version,
          NOW() - pg_postmaster_start_time() as uptime,
          (SELECT count(*) FROM pg_stat_activity) as total_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
      `;

      const result = await client.query(metricsQuery);
      client.release();

      const row = result.rows[0];

      return {
        connectionCount: this.pool.totalCount,
        activeConnections: parseInt(row.active_connections),
        idleConnections: parseInt(row.idle_connections),
        waitingConnections: this.pool.waitingCount,
        totalConnections: parseInt(row.total_connections),
        databaseSize: row.database_size,
        lastHealthCheck: this.lastHealthCheck,
        uptime: row.uptime,
        version: row.version,
      };
    } catch (error) {
      throw new Error(`Failed to get database metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get health check history
   */
  public getHealthHistory(): HealthCheckResult[] {
    return [...this.healthHistory];
  }

  /**
   * Get current overall health status
   */
  public getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this.healthHistory.length === 0) {
      return 'unhealthy';
    }

    const latestResults = this.healthHistory.slice(-4); // Last set of checks
    const hasUnhealthy = latestResults.some(result => result.status === 'unhealthy');
    const hasDegraded = latestResults.some(result => result.status === 'degraded');

    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  /**
   * Add results to health history
   */
  private addToHistory(results: HealthCheckResult[]): void {
    this.healthHistory.push(...results);

    // Limit history size
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Clear health history
   */
  public clearHistory(): void {
    this.healthHistory = [];
  }
}