/**
 * Performance Monitor - Task BE-016
 * 
 * Real-time performance monitoring system for strategy execution,
 * system resources, and trading performance with comprehensive
 * analytics, alerting, and optimization recommendations.
 * 
 * Features:
 * - Real-time strategy performance tracking
 * - System resource monitoring (CPU, memory, latency)
 * - Trading performance analytics and reporting
 * - Automated alerting for performance degradation
 * - Performance optimization recommendations
 * - Historical performance analysis and benchmarking
 */

import { EventEmitter } from 'events';
import type { StrategyMetrics } from '../strategies/types.js';

/**
 * Performance Alert Levels
 */
export type AlertLevel = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * Performance Alert
 */
export interface PerformanceAlert {
  id: string;
  level: AlertLevel;
  category: 'strategy' | 'system' | 'trading' | 'risk';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  strategyId?: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * System Performance Metrics
 */
export interface SystemMetrics {
  // CPU metrics
  cpuUsage: number;           // Percentage
  cpuLoad: number[];          // Load averages [1m, 5m, 15m]
  
  // Memory metrics
  memoryUsage: {
    used: number;             // MB
    total: number;            // MB
    percentage: number;       // Percentage
    heap: {
      used: number;
      total: number;
      limit: number;
    };
  };
  
  // Latency metrics
  avgResponseTime: number;    // Milliseconds
  p95ResponseTime: number;    // Milliseconds
  p99ResponseTime: number;    // Milliseconds
  
  // Throughput metrics
  requestsPerSecond: number;
  signalsProcessedPerSecond: number;
  tradesExecutedPerSecond: number;
  
  // Error metrics
  errorRate: number;          // Percentage
  exceptionsPerMinute: number;
  
  // Network metrics
  networkLatency: number;     // Milliseconds
  networkThroughput: number;  // Bytes per second
  
  timestamp: Date;
}

/**
 * Trading Performance Metrics
 */
export interface TradingMetrics {
  // Portfolio metrics
  totalValue: number;
  dailyPnL: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  
  // Trading statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  
  // Risk metrics
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  volatility: number;
  
  // Execution metrics
  avgFillTime: number;        // Milliseconds
  slippageRate: number;       // Percentage
  executionSuccessRate: number; // Percentage
  
  // Time-based metrics
  performanceToday: number;   // Percentage
  performanceWeek: number;    // Percentage
  performanceMonth: number;   // Percentage
  
  timestamp: Date;
}

/**
 * Performance Benchmark
 */
export interface PerformanceBenchmark {
  name: string;
  category: 'strategy' | 'system' | 'trading';
  metric: string;
  value: number;
  target: number;
  tolerance: number;
  status: 'excellent' | 'good' | 'warning' | 'poor';
  trend: 'improving' | 'stable' | 'degrading';
  lastUpdated: Date;
}

/**
 * Performance Report
 */
export interface PerformanceReport {
  period: 'hour' | 'day' | 'week' | 'month';
  startTime: Date;
  endTime: Date;
  
  // Summary metrics
  summary: {
    totalReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    avgLatency: number;
    systemUptime: number;
  };
  
  // Detailed metrics by category
  strategyMetrics: Map<string, StrategyMetrics>;
  systemMetrics: SystemMetrics[];
  tradingMetrics: TradingMetrics[];
  
  // Alerts and issues
  alerts: PerformanceAlert[];
  issues: string[];
  recommendations: string[];
  
  // Benchmarks
  benchmarks: PerformanceBenchmark[];
  
  generatedAt: Date;
}

/**
 * Performance Monitor Configuration
 */
export interface PerformanceMonitorConfig {
  // Monitoring intervals
  metricsInterval: number;      // Milliseconds
  alertCheckInterval: number;   // Milliseconds
  reportInterval: number;       // Milliseconds
  
  // Data retention
  retentionPeriod: number;      // Milliseconds
  maxDataPoints: number;        // Per metric series
  
  // Alert thresholds
  alertThresholds: {
    // System thresholds
    cpuUsage: number;           // Percentage
    memoryUsage: number;        // Percentage
    avgLatency: number;         // Milliseconds
    errorRate: number;          // Percentage
    
    // Trading thresholds
    drawdown: number;           // Percentage
    dailyLoss: number;          // Percentage
    winRateDrop: number;        // Percentage
    
    // Strategy thresholds
    executionTime: number;      // Milliseconds
    signalQuality: number;      // 0-1 score
  };
  
  // Reporting
  enableReports: boolean;
  reportRecipients: string[];   // Email addresses
  reportFormats: string[];      // 'json', 'csv', 'html'
  
  // Performance optimization
  enableOptimization: boolean;
  optimizationInterval: number; // Milliseconds
  maxOptimizationActions: number;
}

/**
 * Time Series Data Point
 */
interface DataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Metric Series
 */
class MetricSeries {
  private data: DataPoint[] = [];
  private maxPoints: number;
  
  constructor(maxPoints: number = 1000) {
    this.maxPoints = maxPoints;
  }
  
  addPoint(value: number, metadata?: Record<string, any>): void {
    this.data.push({
      timestamp: new Date(),
      value,
      metadata
    });
    
    // Maintain size limit
    if (this.data.length > this.maxPoints) {
      this.data = this.data.slice(-this.maxPoints);
    }
  }
  
  getLatest(): DataPoint | null {
    return this.data.length > 0 ? this.data[this.data.length - 1] : null;
  }
  
  getAverage(periodMs?: number): number {
    const now = Date.now();
    const relevantData = periodMs ? 
      this.data.filter(d => now - d.timestamp.getTime() <= periodMs) : 
      this.data;
    
    if (relevantData.length === 0) return 0;
    
    return relevantData.reduce((sum, d) => sum + d.value, 0) / relevantData.length;
  }
  
  getTrend(periodMs: number = 300000): 'improving' | 'stable' | 'degrading' {
    const now = Date.now();
    const recentData = this.data.filter(d => now - d.timestamp.getTime() <= periodMs);
    
    if (recentData.length < 2) return 'stable';
    
    const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
    const secondHalf = recentData.slice(Math.floor(recentData.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;
    
    const changePct = (secondAvg - firstAvg) / firstAvg;
    
    if (Math.abs(changePct) < 0.05) return 'stable';
    return changePct > 0 ? 'improving' : 'degrading';
  }
  
  getData(periodMs?: number): DataPoint[] {
    if (!periodMs) return [...this.data];
    
    const cutoff = Date.now() - periodMs;
    return this.data.filter(d => d.timestamp.getTime() >= cutoff);
  }
}

/**
 * Performance Monitor Implementation
 */
export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  
  // Metric storage
  private strategyMetrics: Map<string, StrategyMetrics> = new Map();
  private systemMetricsSeries: Map<string, MetricSeries> = new Map();
  private tradingMetricsSeries: Map<string, MetricSeries> = new Map();
  
  // Alert management
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private alertHistory: PerformanceAlert[] = [];
  
  // Monitoring timers
  private metricsTimer?: NodeJS.Timeout;
  private alertTimer?: NodeJS.Timeout;
  private reportTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  // Performance data
  private systemStartTime: Date = new Date();
  private lastSystemMetrics?: SystemMetrics;
  private lastTradingMetrics?: TradingMetrics;
  
  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();
    
    this.config = {
      metricsInterval: 60000,      // 1 minute
      alertCheckInterval: 30000,   // 30 seconds
      reportInterval: 3600000,     // 1 hour
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxDataPoints: 10000,
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        avgLatency: 5000,
        errorRate: 5,
        drawdown: 10,
        dailyLoss: 5,
        winRateDrop: 20,
        executionTime: 10000,
        signalQuality: 0.5
      },
      enableReports: true,
      reportRecipients: [],
      reportFormats: ['json'],
      enableOptimization: true,
      optimizationInterval: 300000,
      maxOptimizationActions: 5,
      ...config
    };
    
    this.initializeMetricSeries();
  }

  /**
   * Initialize the performance monitor
   */
  async initialize(): Promise<void> {
    // Start monitoring timers
    this.startMetricsCollection();
    this.startAlertMonitoring();
    this.startReportGeneration();
    this.startCleanupTasks();
    
    this.emit('initialized');
  }

  /**
   * Update strategy metrics
   */
  updateStrategyMetrics(strategyId: string, metrics: StrategyMetrics): void {
    this.strategyMetrics.set(strategyId, metrics);
    
    // Add to time series
    this.addToSeries('strategy_execution_time', metrics.averageExecutionTime);
    this.addToSeries('strategy_success_rate', metrics.successfulExecutions / Math.max(metrics.executionCount, 1));
    this.addToSeries('strategy_signal_accuracy', metrics.signalAccuracy);
    this.addToSeries('strategy_win_rate', metrics.winRate);
    
    this.emit('strategy_metrics_updated', { strategyId, metrics });
  }

  /**
   * Record system performance metrics
   */
  recordSystemMetrics(metrics: SystemMetrics): void {
    this.lastSystemMetrics = metrics;
    
    // Add to time series
    this.addToSeries('cpu_usage', metrics.cpuUsage);
    this.addToSeries('memory_usage', metrics.memoryUsage.percentage);
    this.addToSeries('avg_response_time', metrics.avgResponseTime);
    this.addToSeries('requests_per_second', metrics.requestsPerSecond);
    this.addToSeries('error_rate', metrics.errorRate);
    
    this.emit('system_metrics_recorded', metrics);
  }

  /**
   * Record trading performance metrics
   */
  recordTradingMetrics(metrics: TradingMetrics): void {
    this.lastTradingMetrics = metrics;
    
    // Add to time series
    this.addToSeries('total_pnl', metrics.totalPnL);
    this.addToSeries('daily_pnl', metrics.dailyPnL);
    this.addToSeries('win_rate', metrics.winRate);
    this.addToSeries('sharpe_ratio', metrics.sharpeRatio);
    this.addToSeries('max_drawdown', metrics.maxDrawdown);
    this.addToSeries('execution_success_rate', metrics.executionSuccessRate);
    
    this.emit('trading_metrics_recorded', metrics);
  }

  /**
   * Get current performance summary
   */
  getCurrentPerformance(): {
    system: SystemMetrics | undefined;
    trading: TradingMetrics | undefined;
    strategies: Map<string, StrategyMetrics>;
    alerts: PerformanceAlert[];
    uptime: number;
  } {
    const uptime = Date.now() - this.systemStartTime.getTime();
    
    return {
      system: this.lastSystemMetrics,
      trading: this.lastTradingMetrics,
      strategies: new Map(this.strategyMetrics),
      alerts: Array.from(this.activeAlerts.values()),
      uptime
    };
  }

  /**
   * Generate performance report
   */
  generateReport(period: 'hour' | 'day' | 'week' | 'month'): PerformanceReport {
    const now = new Date();
    const periodMs = this.getPeriodMs(period);
    const startTime = new Date(now.getTime() - periodMs);
    
    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(periodMs);
    
    // Get historical data
    const systemMetrics = this.getSystemMetricsHistory(periodMs);
    const tradingMetrics = this.getTradingMetricsHistory(periodMs);
    
    // Get alerts for period
    const periodAlerts = this.alertHistory.filter(alert => 
      alert.timestamp >= startTime && alert.timestamp <= now
    );
    
    // Generate benchmarks
    const benchmarks = this.generateBenchmarks();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    
    const report: PerformanceReport = {
      period,
      startTime,
      endTime: now,
      summary,
      strategyMetrics: new Map(this.strategyMetrics),
      systemMetrics,
      tradingMetrics,
      alerts: periodAlerts,
      issues: this.identifyIssues(),
      recommendations,
      benchmarks,
      generatedAt: new Date()
    };
    
    this.emit('report_generated', { period, report });
    return report;
  }

  /**
   * Create performance alert
   */
  createAlert(
    level: AlertLevel,
    category: 'strategy' | 'system' | 'trading' | 'risk',
    title: string,
    message: string,
    metric: string,
    value: number,
    threshold: number,
    strategyId?: string
  ): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      category,
      title,
      message,
      metric,
      value,
      threshold,
      strategyId,
      timestamp: new Date(),
      acknowledged: false
    };
    
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    
    // Keep alert history manageable
    if (this.alertHistory.length > 10000) {
      this.alertHistory = this.alertHistory.slice(-5000);
    }
    
    this.emit('alert_created', alert);
    return alert;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert_acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get performance benchmarks
   */
  getBenchmarks(): PerformanceBenchmark[] {
    return this.generateBenchmarks();
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    // Clear all timers
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.alertTimer) clearInterval(this.alertTimer);
    if (this.reportTimer) clearInterval(this.reportTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    this.emit('cleanup_completed');
  }

  // === PRIVATE METHODS ===

  private initializeMetricSeries(): void {
    const seriesNames = [
      // System metrics
      'cpu_usage', 'memory_usage', 'avg_response_time', 'requests_per_second', 'error_rate',
      
      // Trading metrics
      'total_pnl', 'daily_pnl', 'win_rate', 'sharpe_ratio', 'max_drawdown', 'execution_success_rate',
      
      // Strategy metrics
      'strategy_execution_time', 'strategy_success_rate', 'strategy_signal_accuracy', 'strategy_win_rate'
    ];
    
    for (const name of seriesNames) {
      this.systemMetricsSeries.set(name, new MetricSeries(this.config.maxDataPoints));
      this.tradingMetricsSeries.set(name, new MetricSeries(this.config.maxDataPoints));
    }
  }

  private addToSeries(seriesName: string, value: number, metadata?: Record<string, any>): void {
    const series = this.systemMetricsSeries.get(seriesName) || this.tradingMetricsSeries.get(seriesName);
    if (series) {
      series.addPoint(value, metadata);
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metricsInterval);
  }

  private startAlertMonitoring(): void {
    this.alertTimer = setInterval(() => {
      this.checkAlertThresholds();
    }, this.config.alertCheckInterval);
  }

  private startReportGeneration(): void {
    if (this.config.enableReports) {
      this.reportTimer = setInterval(() => {
        const report = this.generateReport('hour');
        this.emit('scheduled_report', report);
      }, this.config.reportInterval);
    }
  }

  private startCleanupTasks(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics: SystemMetrics = {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to milliseconds
      cpuLoad: [0, 0, 0], // Would get actual load averages
      memoryUsage: {
        used: memUsage.heapUsed / 1024 / 1024,
        total: memUsage.heapTotal / 1024 / 1024,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        heap: {
          used: memUsage.heapUsed / 1024 / 1024,
          total: memUsage.heapTotal / 1024 / 1024,
          limit: memUsage.heapUsed / 1024 / 1024 // Simplified
        }
      },
      avgResponseTime: this.systemMetricsSeries.get('avg_response_time')?.getAverage(60000) || 0,
      p95ResponseTime: 0, // Would calculate from actual data
      p99ResponseTime: 0, // Would calculate from actual data
      requestsPerSecond: this.systemMetricsSeries.get('requests_per_second')?.getAverage(60000) || 0,
      signalsProcessedPerSecond: 0, // Would be tracked
      tradesExecutedPerSecond: 0,   // Would be tracked
      errorRate: this.systemMetricsSeries.get('error_rate')?.getAverage(60000) || 0,
      exceptionsPerMinute: 0, // Would be tracked
      networkLatency: 0,      // Would be measured
      networkThroughput: 0,   // Would be measured
      timestamp: new Date()
    };
    
    this.recordSystemMetrics(metrics);
  }

  private checkAlertThresholds(): void {
    const thresholds = this.config.alertThresholds;
    
    // Check system thresholds
    if (this.lastSystemMetrics) {
      const sm = this.lastSystemMetrics;
      
      if (sm.cpuUsage > thresholds.cpuUsage) {
        this.createAlert('warning', 'system', 'High CPU Usage', 
          `CPU usage is ${sm.cpuUsage.toFixed(1)}%`, 'cpu_usage', sm.cpuUsage, thresholds.cpuUsage);
      }
      
      if (sm.memoryUsage.percentage > thresholds.memoryUsage) {
        this.createAlert('warning', 'system', 'High Memory Usage', 
          `Memory usage is ${sm.memoryUsage.percentage.toFixed(1)}%`, 'memory_usage', sm.memoryUsage.percentage, thresholds.memoryUsage);
      }
      
      if (sm.errorRate > thresholds.errorRate) {
        this.createAlert('critical', 'system', 'High Error Rate', 
          `Error rate is ${sm.errorRate.toFixed(1)}%`, 'error_rate', sm.errorRate, thresholds.errorRate);
      }
    }
    
    // Check trading thresholds
    if (this.lastTradingMetrics) {
      const tm = this.lastTradingMetrics;
      
      if (tm.currentDrawdown > thresholds.drawdown) {
        this.createAlert('critical', 'trading', 'High Drawdown', 
          `Current drawdown is ${tm.currentDrawdown.toFixed(1)}%`, 'drawdown', tm.currentDrawdown, thresholds.drawdown);
      }
    }
    
    // Check strategy thresholds
    for (const [strategyId, metrics] of this.strategyMetrics.entries()) {
      if (metrics.averageExecutionTime > thresholds.executionTime) {
        this.createAlert('warning', 'strategy', 'Slow Strategy Execution', 
          `Strategy ${strategyId} execution time is ${metrics.averageExecutionTime.toFixed(0)}ms`, 
          'execution_time', metrics.averageExecutionTime, thresholds.executionTime, strategyId);
      }
    }
  }

  private calculateSummaryMetrics(periodMs: number): any {
    const tradingSeries = this.tradingMetricsSeries.get('total_pnl');
    const winRateSeries = this.tradingMetricsSeries.get('win_rate');
    const sharpeSeries = this.tradingMetricsSeries.get('sharpe_ratio');
    const drawdownSeries = this.tradingMetricsSeries.get('max_drawdown');
    const latencySeries = this.systemMetricsSeries.get('avg_response_time');
    
    const uptime = Date.now() - this.systemStartTime.getTime();
    
    return {
      totalReturn: tradingSeries?.getAverage(periodMs) || 0,
      volatility: 0, // Would calculate from return series
      sharpeRatio: sharpeSeries?.getAverage(periodMs) || 0,
      maxDrawdown: drawdownSeries?.getAverage(periodMs) || 0,
      winRate: winRateSeries?.getAverage(periodMs) || 0,
      avgLatency: latencySeries?.getAverage(periodMs) || 0,
      systemUptime: (uptime / 1000) / 3600 // Hours
    };
  }

  private getSystemMetricsHistory(periodMs: number): SystemMetrics[] {
    // Would return actual historical system metrics
    return [];
  }

  private getTradingMetricsHistory(periodMs: number): TradingMetrics[] {
    // Would return actual historical trading metrics
    return [];
  }

  private generateBenchmarks(): PerformanceBenchmark[] {
    const benchmarks: PerformanceBenchmark[] = [];
    
    // System benchmarks
    if (this.lastSystemMetrics) {
      benchmarks.push({
        name: 'CPU Usage',
        category: 'system',
        metric: 'cpu_usage',
        value: this.lastSystemMetrics.cpuUsage,
        target: 50,
        tolerance: 20,
        status: this.getBenchmarkStatus(this.lastSystemMetrics.cpuUsage, 50, 20),
        trend: this.systemMetricsSeries.get('cpu_usage')?.getTrend() || 'stable',
        lastUpdated: new Date()
      });
    }
    
    // Trading benchmarks
    if (this.lastTradingMetrics) {
      benchmarks.push({
        name: 'Sharpe Ratio',
        category: 'trading',
        metric: 'sharpe_ratio',
        value: this.lastTradingMetrics.sharpeRatio,
        target: 1.5,
        tolerance: 0.5,
        status: this.getBenchmarkStatus(this.lastTradingMetrics.sharpeRatio, 1.5, 0.5),
        trend: this.tradingMetricsSeries.get('sharpe_ratio')?.getTrend() || 'stable',
        lastUpdated: new Date()
      });
    }
    
    return benchmarks;
  }

  private getBenchmarkStatus(value: number, target: number, tolerance: number): 'excellent' | 'good' | 'warning' | 'poor' {
    const diff = Math.abs(value - target);
    const pctDiff = diff / target;
    
    if (pctDiff <= tolerance * 0.5) return 'excellent';
    if (pctDiff <= tolerance) return 'good';
    if (pctDiff <= tolerance * 1.5) return 'warning';
    return 'poor';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // System recommendations
    if (this.lastSystemMetrics) {
      if (this.lastSystemMetrics.cpuUsage > 70) {
        recommendations.push('Consider optimizing CPU-intensive operations or scaling resources');
      }
      
      if (this.lastSystemMetrics.memoryUsage.percentage > 80) {
        recommendations.push('Monitor memory usage and consider garbage collection optimization');
      }
    }
    
    // Trading recommendations
    if (this.lastTradingMetrics) {
      if (this.lastTradingMetrics.winRate < 0.4) {
        recommendations.push('Review strategy parameters to improve win rate');
      }
      
      if (this.lastTradingMetrics.sharpeRatio < 1.0) {
        recommendations.push('Focus on risk-adjusted returns and volatility management');
      }
    }
    
    return recommendations;
  }

  private identifyIssues(): string[] {
    const issues: string[] = [];
    
    // Check for critical alerts
    const criticalAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.level === 'critical' || alert.level === 'emergency');
    
    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts require attention`);
    }
    
    // Check for performance degradation
    const cpuTrend = this.systemMetricsSeries.get('cpu_usage')?.getTrend();
    if (cpuTrend === 'degrading') {
      issues.push('CPU usage trending upward');
    }
    
    return issues;
  }

  private getPeriodMs(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 3600000;
      case 'day': return 86400000;
      case 'week': return 604800000;
      case 'month': return 2592000000;
      default: return 3600000;
    }
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    
    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.timestamp.getTime() >= cutoff
    );
    
    this.emit('data_cleaned', { cutoff: new Date(cutoff) });
  }
}

export default PerformanceMonitor;