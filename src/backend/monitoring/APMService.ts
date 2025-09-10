/**
 * Application Performance Monitoring (APM) Service
 * Implements comprehensive monitoring for trading bot performance
 */

import { Request, Response } from 'express';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { performance } from 'perf_hooks';
import * as os from 'os';
import * as process from 'process';

export interface PerformanceMetrics {
  timestamp: number;
  component: string;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ErrorDetails {
  timestamp: number;
  component: string;
  error: Error;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  requestId?: string;
  stackTrace?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: {
    database: boolean;
    redis: boolean;
    exchange: boolean;
    websocket: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    loadAverage: number[];
  };
}

class APMService {
  private static instance: APMService;
  
  // Prometheus Metrics
  private httpRequests: Counter<string>;
  private httpDuration: Histogram<string>;
  private tradingOperations: Counter<string>;
  private tradingDuration: Histogram<string>;
  private errorCount: Counter<string>;
  private activeConnections: Gauge<string>;
  private memoryUsage: Gauge<string>;
  private cpuUsage: Gauge<string>;
  private databaseQueries: Counter<string>;
  private databaseDuration: Histogram<string>;
  private exchangeRequests: Counter<string>;
  private exchangeDuration: Histogram<string>;
  private strategyExecutions: Counter<string>;
  private orderLatency: Histogram<string>;
  private portfolioValue: Gauge<string>;
  private activePositions: Gauge<string>;
  private dailyPnL: Gauge<string>;
  
  // Performance Tracking
  private performanceBuffer: PerformanceMetrics[] = [];
  private errorBuffer: ErrorDetails[] = [];
  private healthStatus: HealthCheckResult['status'] = 'healthy';
  private startTime: number;
  private maxBufferSize = 1000;

  private constructor() {
    this.startTime = Date.now();
    this.initializeMetrics();
    this.startMetricsCollection();
    
    // Collect default Node.js metrics
    collectDefaultMetrics({ register });
  }

  public static getInstance(): APMService {
    if (!APMService.instance) {
      APMService.instance = new APMService();
    }
    return APMService.instance;
  }

  private initializeMetrics(): void {
    // HTTP Request Metrics
    this.httpRequests = new Counter({
      name: 'trading_bot_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_id'],
      registers: [register]
    });

    this.httpDuration = new Histogram({
      name: 'trading_bot_http_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register]
    });

    // Trading Operation Metrics
    this.tradingOperations = new Counter({
      name: 'trading_bot_operations_total',
      help: 'Total number of trading operations',
      labelNames: ['operation', 'strategy', 'symbol', 'result'],
      registers: [register]
    });

    this.tradingDuration = new Histogram({
      name: 'trading_bot_operation_duration_seconds',
      help: 'Trading operation duration in seconds',
      labelNames: ['operation', 'strategy', 'symbol'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register]
    });

    // Error Tracking
    this.errorCount = new Counter({
      name: 'trading_bot_errors_total',
      help: 'Total number of errors',
      labelNames: ['component', 'error_type', 'severity'],
      registers: [register]
    });

    // System Metrics
    this.activeConnections = new Gauge({
      name: 'trading_bot_active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [register]
    });

    this.memoryUsage = new Gauge({
      name: 'trading_bot_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [register]
    });

    this.cpuUsage = new Gauge({
      name: 'trading_bot_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [register]
    });

    // Database Metrics
    this.databaseQueries = new Counter({
      name: 'trading_bot_db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'result'],
      registers: [register]
    });

    this.databaseDuration = new Histogram({
      name: 'trading_bot_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register]
    });

    // Exchange API Metrics
    this.exchangeRequests = new Counter({
      name: 'trading_bot_exchange_requests_total',
      help: 'Total number of exchange API requests',
      labelNames: ['exchange', 'endpoint', 'result'],
      registers: [register]
    });

    this.exchangeDuration = new Histogram({
      name: 'trading_bot_exchange_duration_seconds',
      help: 'Exchange API request duration in seconds',
      labelNames: ['exchange', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register]
    });

    // Strategy Metrics
    this.strategyExecutions = new Counter({
      name: 'trading_bot_strategy_executions_total',
      help: 'Total number of strategy executions',
      labelNames: ['strategy_id', 'strategy_name', 'result'],
      registers: [register]
    });

    // Trading Performance Metrics
    this.orderLatency = new Histogram({
      name: 'trading_bot_order_latency_seconds',
      help: 'Order execution latency in seconds',
      labelNames: ['order_type', 'symbol'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register]
    });

    this.portfolioValue = new Gauge({
      name: 'trading_bot_portfolio_value',
      help: 'Current portfolio value',
      labelNames: ['currency'],
      registers: [register]
    });

    this.activePositions = new Gauge({
      name: 'trading_bot_active_positions',
      help: 'Number of active positions',
      labelNames: ['symbol'],
      registers: [register]
    });

    this.dailyPnL = new Gauge({
      name: 'trading_bot_daily_pnl',
      help: 'Daily profit and loss',
      labelNames: ['strategy'],
      registers: [register]
    });
  }

  private startMetricsCollection(): void {
    // Update system metrics every 10 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 10000);

    // Clean up old performance data every 5 minutes
    setInterval(() => {
      this.cleanupBuffers();
    }, 300000);
  }

  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);
    
    // Calculate CPU percentage (this is a simplified calculation)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length * 100;
    this.cpuUsage.set(cpuPercent);
  }

  private cleanupBuffers(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    this.performanceBuffer = this.performanceBuffer.filter(
      metric => metric.timestamp > cutoffTime
    );
    
    this.errorBuffer = this.errorBuffer.filter(
      error => error.timestamp > cutoffTime
    );
    
    // Limit buffer sizes
    if (this.performanceBuffer.length > this.maxBufferSize) {
      this.performanceBuffer = this.performanceBuffer.slice(-this.maxBufferSize);
    }
    
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer = this.errorBuffer.slice(-this.maxBufferSize);
    }
  }

  // ===========================================
  // PUBLIC API METHODS
  // ===========================================

  /**
   * Track HTTP request performance
   */
  public trackHttpRequest(req: Request, res: Response, startTime: number): void {
    const duration = (Date.now() - startTime) / 1000;
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    const userId = (req as any).user?.id || 'anonymous';

    this.httpRequests.inc({ method, route, status_code: statusCode, user_id: userId });
    this.httpDuration.observe({ method, route, status_code: statusCode }, duration);

    // Track performance in buffer
    this.performanceBuffer.push({
      timestamp: Date.now(),
      component: 'http',
      operation: `${method} ${route}`,
      duration: duration * 1000, // Convert to milliseconds
      success: statusCode.startsWith('2'),
      metadata: { statusCode, userId }
    });
  }

  /**
   * Track trading operation performance
   */
  public trackTradingOperation(
    operation: string,
    strategy: string,
    symbol: string,
    startTime: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const duration = (performance.now() - startTime) / 1000;
    const result = success ? 'success' : 'failure';

    this.tradingOperations.inc({ operation, strategy, symbol, result });
    this.tradingDuration.observe({ operation, strategy, symbol }, duration);

    this.performanceBuffer.push({
      timestamp: Date.now(),
      component: 'trading',
      operation: `${operation}:${strategy}:${symbol}`,
      duration: duration * 1000,
      success,
      metadata
    });
  }

  /**
   * Track database query performance
   */
  public trackDatabaseQuery(
    operation: string,
    table: string,
    startTime: number,
    success: boolean,
    error?: Error
  ): void {
    const duration = (performance.now() - startTime) / 1000;
    const result = success ? 'success' : 'failure';

    this.databaseQueries.inc({ operation, table, result });
    this.databaseDuration.observe({ operation, table }, duration);

    if (!success && error) {
      this.trackError('database', error, 'medium', { operation, table });
    }
  }

  /**
   * Track exchange API performance
   */
  public trackExchangeRequest(
    exchange: string,
    endpoint: string,
    startTime: number,
    success: boolean,
    error?: Error
  ): void {
    const duration = (performance.now() - startTime) / 1000;
    const result = success ? 'success' : 'failure';

    this.exchangeRequests.inc({ exchange, endpoint, result });
    this.exchangeDuration.observe({ exchange, endpoint }, duration);

    if (!success && error) {
      this.trackError('exchange', error, 'high', { exchange, endpoint });
    }
  }

  /**
   * Track strategy execution
   */
  public trackStrategyExecution(
    strategyId: string,
    strategyName: string,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const result = success ? 'success' : 'failure';
    this.strategyExecutions.inc({ strategy_id: strategyId, strategy_name: strategyName, result });
    
    if (!success) {
      this.trackError('strategy', new Error(`Strategy execution failed: ${strategyId}`), 'high', metadata);
    }
  }

  /**
   * Track order execution latency
   */
  public trackOrderLatency(
    orderType: string,
    symbol: string,
    latencyMs: number
  ): void {
    this.orderLatency.observe({ order_type: orderType, symbol }, latencyMs / 1000);
  }

  /**
   * Update portfolio metrics
   */
  public updatePortfolioMetrics(value: number, currency: string, activePositions: Record<string, number>): void {
    this.portfolioValue.set({ currency }, value);
    
    // Update active positions for each symbol
    Object.entries(activePositions).forEach(([symbol, count]) => {
      this.activePositions.set({ symbol }, count);
    });
  }

  /**
   * Update daily P&L
   */
  public updateDailyPnL(strategy: string, pnl: number): void {
    this.dailyPnL.set({ strategy }, pnl);
  }

  /**
   * Track errors with detailed context
   */
  public trackError(
    component: string,
    error: Error,
    severity: ErrorDetails['severity'] = 'medium',
    context?: Record<string, any>
  ): void {
    this.errorCount.inc({ component, error_type: error.name, severity });

    const errorDetail: ErrorDetails = {
      timestamp: Date.now(),
      component,
      error,
      context,
      severity,
      stackTrace: error.stack
    };

    this.errorBuffer.push(errorDetail);

    // Log critical errors immediately
    if (severity === 'critical') {
      console.error('[APM] Critical Error:', {
        component,
        message: error.message,
        context,
        stack: error.stack
      });
    }

    // Update health status based on error severity and frequency
    this.updateHealthStatus();
  }

  /**
   * Update active connections count
   */
  public updateActiveConnections(type: string, count: number): void {
    this.activeConnections.set({ type }, count);
  }

  /**
   * Get performance metrics for specific component
   */
  public getPerformanceMetrics(component?: string, hours = 1): PerformanceMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    let metrics = this.performanceBuffer.filter(m => m.timestamp > cutoffTime);
    
    if (component) {
      metrics = metrics.filter(m => m.component === component);
    }
    
    return metrics.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get error history
   */
  public getErrorHistory(component?: string, hours = 1): ErrorDetails[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    let errors = this.errorBuffer.filter(e => e.timestamp > cutoffTime);
    
    if (component) {
      errors = errors.filter(e => e.component === component);
    }
    
    return errors.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get comprehensive health check
   */
  public async getHealthCheck(): Promise<HealthCheckResult> {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();

    // TODO: Implement actual health checks for dependencies
    const checks = {
      database: true, // Implement actual DB health check
      redis: true,    // Implement actual Redis health check
      exchange: true, // Implement actual Exchange API health check
      websocket: true // Implement actual WebSocket health check
    };

    return {
      status: this.healthStatus,
      timestamp: Date.now(),
      checks,
      metrics: {
        uptime,
        memoryUsage,
        cpuUsage,
        loadAverage
      }
    };
  }

  /**
   * Get Prometheus metrics endpoint
   */
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Create performance summary report
   */
  public getPerformanceSummary(hours = 24): {
    httpRequests: { total: number; avgDuration: number; errorRate: number };
    tradingOperations: { total: number; avgDuration: number; successRate: number };
    errors: { total: number; bySeverity: Record<string, number>; byComponent: Record<string, number> };
    system: { uptime: number; memoryUsage: number; cpuUsage: number };
  } {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // HTTP Request metrics
    const httpMetrics = this.performanceBuffer.filter(
      m => m.component === 'http' && m.timestamp > cutoffTime
    );
    const httpTotal = httpMetrics.length;
    const httpAvgDuration = httpMetrics.reduce((sum, m) => sum + m.duration, 0) / httpTotal || 0;
    const httpErrorRate = httpMetrics.filter(m => !m.success).length / httpTotal || 0;

    // Trading operation metrics
    const tradingMetrics = this.performanceBuffer.filter(
      m => m.component === 'trading' && m.timestamp > cutoffTime
    );
    const tradingTotal = tradingMetrics.length;
    const tradingAvgDuration = tradingMetrics.reduce((sum, m) => sum + m.duration, 0) / tradingTotal || 0;
    const tradingSuccessRate = tradingMetrics.filter(m => m.success).length / tradingTotal || 0;

    // Error metrics
    const recentErrors = this.errorBuffer.filter(e => e.timestamp > cutoffTime);
    const errorTotal = recentErrors.length;
    const errorsBySeverity = recentErrors.reduce((acc, e) => {
      acc[e.severity] = (acc[e.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const errorsByComponent = recentErrors.reduce((acc, e) => {
      acc[e.component] = (acc[e.component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // System metrics
    const uptime = Date.now() - this.startTime;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const cpuUsage = process.cpuUsage().user / 1000000; // seconds

    return {
      httpRequests: {
        total: httpTotal,
        avgDuration: httpAvgDuration,
        errorRate: httpErrorRate
      },
      tradingOperations: {
        total: tradingTotal,
        avgDuration: tradingAvgDuration,
        successRate: tradingSuccessRate
      },
      errors: {
        total: errorTotal,
        bySeverity: errorsBySeverity,
        byComponent: errorsByComponent
      },
      system: {
        uptime,
        memoryUsage,
        cpuUsage
      }
    };
  }

  private updateHealthStatus(): void {
    const recentErrors = this.errorBuffer.filter(
      e => e.timestamp > Date.now() - (15 * 60 * 1000) // Last 15 minutes
    );
    
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical').length;
    const highErrors = recentErrors.filter(e => e.severity === 'high').length;
    const totalErrors = recentErrors.length;

    if (criticalErrors > 0) {
      this.healthStatus = 'unhealthy';
    } else if (highErrors > 5 || totalErrors > 20) {
      this.healthStatus = 'degraded';
    } else {
      this.healthStatus = 'healthy';
    }
  }
}

export default APMService;