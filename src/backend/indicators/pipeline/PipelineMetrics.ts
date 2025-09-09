/**
 * Pipeline Metrics - Task BE-012
 * 
 * Comprehensive metrics collection and analysis system for the indicator pipeline
 * with performance tracking, alerting, and reporting capabilities.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// =============================================================================
// METRICS TYPES AND INTERFACES
// =============================================================================

export interface MetricsConfig {
  enabled: boolean;
  retentionPeriod: number; // seconds
  samplingRate: number; // 0-1, percentage of events to sample
  alertThresholds: AlertThresholds;
  enableReporting: boolean;
  reportingInterval: number; // seconds
}

export interface AlertThresholds {
  processingTime: number; // milliseconds
  errorRate: number; // 0-1, percentage
  memoryUsage: number; // bytes
  cacheHitRate: number; // 0-1, minimum acceptable rate
  queueLength: number; // maximum queue length
}

export interface MetricEvent {
  id: string;
  type: MetricEventType;
  timestamp: Date;
  duration?: number;
  success: boolean;
  metadata: Record<string, any>;
}

export type MetricEventType = 
  | 'batchProcessing'
  | 'streamingUpdate' 
  | 'cacheOperation'
  | 'indicatorCalculation'
  | 'dependencyResolution'
  | 'memoryOperation'
  | 'parallelProcessing';

export interface PerformanceSnapshot {
  timestamp: Date;
  
  // Processing metrics
  averageProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  throughput: number; // events per second
  
  // Success metrics
  successRate: number;
  errorRate: number;
  
  // Resource utilization
  memoryUtilization: number;
  cacheHitRate: number;
  workerUtilization: number;
  
  // Queue metrics
  averageQueueLength: number;
  maxQueueLength: number;
}

export interface DetailedMetrics {
  overview: PerformanceSnapshot;
  
  byEventType: Map<MetricEventType, {
    count: number;
    averageTime: number;
    successRate: number;
    throughput: number;
  }>;
  
  timeSeriesData: Array<{
    timestamp: Date;
    processingTime: number;
    memoryUsage: number;
    queueLength: number;
    throughput: number;
  }>;
  
  alerts: MetricAlert[];
  trends: MetricTrend[];
}

export interface MetricAlert {
  id: string;
  type: 'performance' | 'resource' | 'error' | 'trend';
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: Date;
}

export interface MetricTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  magnitude: number; // rate of change
  significance: 'low' | 'medium' | 'high';
  timeframe: string;
  confidence: number; // 0-1
}

export interface ReportData {
  period: {
    start: Date;
    end: Date;
    duration: number; // milliseconds
  };
  
  summary: {
    totalEvents: number;
    successRate: number;
    averageProcessingTime: number;
    peakThroughput: number;
    alertCount: number;
  };
  
  performance: PerformanceSnapshot;
  alerts: MetricAlert[];
  trends: MetricTrend[];
  recommendations: string[];
}

// =============================================================================
// PIPELINE METRICS IMPLEMENTATION
// =============================================================================

export class PipelineMetrics extends EventEmitter {
  private readonly config: MetricsConfig;
  private readonly events: MetricEvent[] = [];
  private readonly alerts: MetricAlert[] = [];
  private readonly timeSeriesData: Array<{
    timestamp: Date;
    processingTime: number;
    memoryUsage: number;
    queueLength: number;
    throughput: number;
  }> = [];
  
  // Running calculations
  private runningStats = {
    totalEvents: 0,
    successfulEvents: 0,
    totalProcessingTime: 0,
    lastThroughputCalculation: Date.now(),
    recentEvents: 0
  };
  
  private alertCounters = new Map<string, number>();
  private reportingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    
    if (this.config.enabled) {
      this.startBackgroundTasks();
    }
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - EVENT RECORDING
  // =============================================================================

  /**
   * Record batch processing metrics
   */
  recordBatchProcessing(data: {
    processingTime: number;
    indicatorCount: number;
    cacheHitRate: number;
    success: boolean;
    memoryUsed: number;
  }): void {
    if (!this.config.enabled || !this.shouldSample()) return;
    
    const event: MetricEvent = {
      id: this.generateEventId(),
      type: 'batchProcessing',
      timestamp: new Date(),
      duration: data.processingTime,
      success: data.success,
      metadata: {
        indicatorCount: data.indicatorCount,
        cacheHitRate: data.cacheHitRate,
        memoryUsed: data.memoryUsed,
        avgTimePerIndicator: data.processingTime / data.indicatorCount
      }
    };
    
    this.recordEvent(event);
  }

  /**
   * Record streaming update metrics
   */
  recordStreamingUpdate(data: {
    processingTime: number;
    indicatorCount: number;
    success: boolean;
  }): void {
    if (!this.config.enabled || !this.shouldSample()) return;
    
    const event: MetricEvent = {
      id: this.generateEventId(),
      type: 'streamingUpdate',
      timestamp: new Date(),
      duration: data.processingTime,
      success: data.success,
      metadata: {
        indicatorCount: data.indicatorCount,
        avgTimePerIndicator: data.processingTime / data.indicatorCount
      }
    };
    
    this.recordEvent(event);
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(data: {
    operation: 'hit' | 'miss' | 'store' | 'evict';
    processingTime: number;
    success: boolean;
    size?: number;
  }): void {
    if (!this.config.enabled || !this.shouldSample()) return;
    
    const event: MetricEvent = {
      id: this.generateEventId(),
      type: 'cacheOperation',
      timestamp: new Date(),
      duration: data.processingTime,
      success: data.success,
      metadata: {
        operation: data.operation,
        size: data.size
      }
    };
    
    this.recordEvent(event);
  }

  /**
   * Record custom metric event
   */
  recordEvent(event: MetricEvent): void {
    if (!this.config.enabled) return;
    
    // Add event to history
    this.events.push(event);
    
    // Update running statistics
    this.updateRunningStats(event);
    
    // Check for alerts
    this.checkAlerts(event);
    
    // Add to time series data
    this.addTimeSeriesData(event);
    
    // Limit event history size
    this.limitEventHistory();
    
    this.emit('eventRecorded', event);
  }

  // =============================================================================
  // PUBLIC API - METRICS RETRIEVAL
  // =============================================================================

  /**
   * Get current performance snapshot
   */
  getPerformanceSnapshot(): PerformanceSnapshot {
    const now = Date.now();
    const recentEvents = this.getRecentEvents(60000); // Last minute
    
    if (recentEvents.length === 0) {
      return this.getEmptySnapshot();
    }
    
    const processingTimes = recentEvents
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!);
    
    const successfulEvents = recentEvents.filter(e => e.success);
    const timeSpan = 60; // 60 seconds
    
    return {
      timestamp: new Date(),
      averageProcessingTime: this.calculateAverage(processingTimes),
      p95ProcessingTime: this.calculatePercentile(processingTimes, 95),
      p99ProcessingTime: this.calculatePercentile(processingTimes, 99),
      throughput: recentEvents.length / timeSpan,
      successRate: recentEvents.length > 0 ? successfulEvents.length / recentEvents.length : 1,
      errorRate: recentEvents.length > 0 ? 1 - (successfulEvents.length / recentEvents.length) : 0,
      memoryUtilization: this.getLatestMemoryUtilization(),
      cacheHitRate: this.calculateCacheHitRate(recentEvents),
      workerUtilization: this.getLatestWorkerUtilization(),
      averageQueueLength: this.getAverageQueueLength(),
      maxQueueLength: this.getMaxQueueLength()
    };
  }

  /**
   * Get detailed metrics report
   */
  getDetailedMetrics(): DetailedMetrics {
    const overview = this.getPerformanceSnapshot();
    const byEventType = this.getMetricsByEventType();
    const alerts = [...this.alerts]; // Copy active alerts
    const trends = this.calculateTrends();
    
    return {
      overview,
      byEventType,
      timeSeriesData: [...this.timeSeriesData],
      alerts,
      trends
    };
  }

  /**
   * Generate comprehensive report
   */
  generateReport(periodHours: number = 24): ReportData {
    const now = new Date();
    const start = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
    
    const periodEvents = this.events.filter(e => 
      e.timestamp >= start && e.timestamp <= now
    );
    
    const successfulEvents = periodEvents.filter(e => e.success);
    const processingTimes = periodEvents
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!);
    
    const periodAlerts = this.alerts.filter(a => 
      a.timestamp >= start && a.timestamp <= now
    );
    
    return {
      period: {
        start,
        end: now,
        duration: now.getTime() - start.getTime()
      },
      
      summary: {
        totalEvents: periodEvents.length,
        successRate: periodEvents.length > 0 ? successfulEvents.length / periodEvents.length : 1,
        averageProcessingTime: this.calculateAverage(processingTimes),
        peakThroughput: this.calculatePeakThroughput(periodEvents),
        alertCount: periodAlerts.length
      },
      
      performance: this.getPerformanceSnapshot(),
      alerts: periodAlerts,
      trends: this.calculateTrends(),
      recommendations: this.generateRecommendations()
    };
  }

  // =============================================================================
  // PUBLIC API - MANAGEMENT
  // =============================================================================

  /**
   * Clear specific alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = new Date();
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Clear all resolved alerts
   */
  clearResolvedAlerts(): number {
    const resolvedCount = this.alerts.filter(a => a.resolved).length;
    this.alerts.splice(0, this.alerts.length, ...this.alerts.filter(a => !a.resolved));
    return resolvedCount;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.events.length = 0;
    this.alerts.length = 0;
    this.timeSeriesData.length = 0;
    this.alertCounters.clear();
    this.runningStats = {
      totalEvents: 0,
      successfulEvents: 0,
      totalProcessingTime: 0,
      lastThroughputCalculation: Date.now(),
      recentEvents: 0
    };
    
    this.emit('metricsReset');
  }

  /**
   * Perform maintenance operations
   */
  performMaintenance(): void {
    const now = Date.now();
    const cutoffTime = now - (this.config.retentionPeriod * 1000);
    
    // Remove old events
    const initialEventCount = this.events.length;
    this.events.splice(0, this.events.length, 
      ...this.events.filter(e => e.timestamp.getTime() > cutoffTime)
    );
    
    // Remove old time series data
    const initialTimeSeriesCount = this.timeSeriesData.length;
    this.timeSeriesData.splice(0, this.timeSeriesData.length,
      ...this.timeSeriesData.filter(d => d.timestamp.getTime() > cutoffTime)
    );
    
    // Remove old resolved alerts
    const resolvedAlerts = this.alerts.filter(a => 
      a.resolved && a.resolved.getTime() < cutoffTime
    );
    resolvedAlerts.forEach(alert => {
      const index = this.alerts.indexOf(alert);
      if (index > -1) this.alerts.splice(index, 1);
    });
    
    const cleanedEvents = initialEventCount - this.events.length;
    const cleanedTimeSeries = initialTimeSeriesCount - this.timeSeriesData.length;
    const cleanedAlerts = resolvedAlerts.length;
    
    this.emit('maintenanceCompleted', {
      cleanedEvents,
      cleanedTimeSeries,
      cleanedAlerts
    });
  }

  /**
   * Shutdown metrics system
   */
  shutdown(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.emit('shutdown');
  }

  // =============================================================================
  // PRIVATE METHODS - EVENT PROCESSING
  // =============================================================================

  private updateRunningStats(event: MetricEvent): void {
    this.runningStats.totalEvents++;
    
    if (event.success) {
      this.runningStats.successfulEvents++;
    }
    
    if (event.duration !== undefined) {
      this.runningStats.totalProcessingTime += event.duration;
    }
    
    // Update recent events counter for throughput calculation
    const now = Date.now();
    if (now - this.runningStats.lastThroughputCalculation > 60000) { // Every minute
      this.runningStats.recentEvents = this.getRecentEvents(60000).length;
      this.runningStats.lastThroughputCalculation = now;
    }
  }

  private checkAlerts(event: MetricEvent): void {
    // Check processing time threshold
    if (event.duration && event.duration > this.config.alertThresholds.processingTime) {
      this.createAlert('performance', 'warning', 
        `Slow processing detected: ${event.duration.toFixed(1)}ms`,
        event.duration, this.config.alertThresholds.processingTime
      );
    }
    
    // Check error rate
    const recentEvents = this.getRecentEvents(300000); // Last 5 minutes
    if (recentEvents.length >= 10) { // Need enough samples
      const errorRate = 1 - (recentEvents.filter(e => e.success).length / recentEvents.length);
      if (errorRate > this.config.alertThresholds.errorRate) {
        this.createAlert('error', 'critical',
          `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
          errorRate, this.config.alertThresholds.errorRate
        );
      }
    }
  }

  private createAlert(
    type: MetricAlert['type'],
    level: MetricAlert['level'],
    message: string,
    value: number,
    threshold: number
  ): void {
    const alertKey = `${type}_${level}_${Math.floor(value)}`;
    
    // Avoid duplicate alerts
    const lastAlertTime = this.alertCounters.get(alertKey) || 0;
    if (Date.now() - lastAlertTime < 60000) { // 1 minute cooldown
      return;
    }
    
    const alert: MetricAlert = {
      id: this.generateAlertId(),
      type,
      level,
      message,
      value,
      threshold,
      timestamp: new Date()
    };
    
    this.alerts.push(alert);
    this.alertCounters.set(alertKey, Date.now());
    
    // Limit alert history
    if (this.alerts.length > 100) {
      this.alerts.splice(0, 10);
    }
    
    this.emit('alert', alert);
  }

  private addTimeSeriesData(event: MetricEvent): void {
    // Sample time series data at regular intervals
    const lastDataPoint = this.timeSeriesData[this.timeSeriesData.length - 1];
    const now = new Date();
    
    if (!lastDataPoint || now.getTime() - lastDataPoint.timestamp.getTime() > 60000) { // 1 minute intervals
      const recentEvents = this.getRecentEvents(60000);
      
      this.timeSeriesData.push({
        timestamp: now,
        processingTime: event.duration || 0,
        memoryUsage: this.getLatestMemoryUtilization(),
        queueLength: this.getLatestQueueLength(),
        throughput: recentEvents.length / 60 // per second
      });
      
      // Limit time series data
      if (this.timeSeriesData.length > 1440) { // 24 hours at 1-minute intervals
        this.timeSeriesData.splice(0, 100);
      }
    }
  }

  // =============================================================================
  // PRIVATE METHODS - CALCULATIONS
  // =============================================================================

  private getRecentEvents(timeWindowMs: number): MetricEvent[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.events.filter(e => e.timestamp.getTime() > cutoff);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateCacheHitRate(events: MetricEvent[]): number {
    const cacheEvents = events.filter(e => e.type === 'cacheOperation');
    if (cacheEvents.length === 0) return 0;
    
    const hits = cacheEvents.filter(e => e.metadata.operation === 'hit').length;
    return hits / cacheEvents.length;
  }

  private getMetricsByEventType(): Map<MetricEventType, {
    count: number;
    averageTime: number;
    successRate: number;
    throughput: number;
  }> {
    const result = new Map();
    const recentEvents = this.getRecentEvents(3600000); // Last hour
    
    const eventTypes: MetricEventType[] = [
      'batchProcessing', 'streamingUpdate', 'cacheOperation',
      'indicatorCalculation', 'dependencyResolution', 'memoryOperation', 'parallelProcessing'
    ];
    
    eventTypes.forEach(type => {
      const typeEvents = recentEvents.filter(e => e.type === type);
      
      if (typeEvents.length > 0) {
        const durations = typeEvents.filter(e => e.duration).map(e => e.duration!);
        const successfulEvents = typeEvents.filter(e => e.success);
        
        result.set(type, {
          count: typeEvents.length,
          averageTime: this.calculateAverage(durations),
          successRate: successfulEvents.length / typeEvents.length,
          throughput: typeEvents.length / 3600 // per second over last hour
        });
      }
    });
    
    return result;
  }

  private calculateTrends(): MetricTrend[] {
    const trends: MetricTrend[] = [];
    
    // Analyze processing time trend
    const processingTimeTrend = this.analyzeTrend(
      this.timeSeriesData.map(d => ({ timestamp: d.timestamp, value: d.processingTime })),
      'processingTime'
    );
    if (processingTimeTrend) trends.push(processingTimeTrend);
    
    // Analyze throughput trend
    const throughputTrend = this.analyzeTrend(
      this.timeSeriesData.map(d => ({ timestamp: d.timestamp, value: d.throughput })),
      'throughput'
    );
    if (throughputTrend) trends.push(throughputTrend);
    
    // Analyze memory usage trend
    const memoryTrend = this.analyzeTrend(
      this.timeSeriesData.map(d => ({ timestamp: d.timestamp, value: d.memoryUsage })),
      'memoryUsage'
    );
    if (memoryTrend) trends.push(memoryTrend);
    
    return trends;
  }

  private analyzeTrend(
    data: Array<{ timestamp: Date; value: number }>,
    metric: string
  ): MetricTrend | null {
    if (data.length < 10) return null;
    
    // Simple linear regression
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssRes = y.reduce((sum, val, i) => sum + Math.pow(val - (slope * i + intercept), 2), 0);
    const rSquared = 1 - (ssRes / ssTotal);
    
    const direction = slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable';
    const magnitude = Math.abs(slope);
    
    let significance: MetricTrend['significance'] = 'low';
    if (magnitude > 10 && rSquared > 0.7) significance = 'high';
    else if (magnitude > 5 && rSquared > 0.5) significance = 'medium';
    
    return {
      metric,
      direction,
      magnitude,
      significance,
      timeframe: `${Math.floor((data[data.length - 1].timestamp.getTime() - data[0].timestamp.getTime()) / 60000)}m`,
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }

  private calculatePeakThroughput(events: MetricEvent[]): number {
    // Calculate peak throughput in 1-minute windows
    if (events.length === 0) return 0;
    
    const windows = new Map<number, number>();
    events.forEach(event => {
      const windowStart = Math.floor(event.timestamp.getTime() / 60000) * 60000;
      windows.set(windowStart, (windows.get(windowStart) || 0) + 1);
    });
    
    return Math.max(...Array.from(windows.values())) / 60; // per second
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const snapshot = this.getPerformanceSnapshot();
    
    if (snapshot.errorRate > 0.05) {
      recommendations.push('High error rate detected. Review error logs and implement additional error handling.');
    }
    
    if (snapshot.averageProcessingTime > this.config.alertThresholds.processingTime) {
      recommendations.push('Processing time is above threshold. Consider optimizing indicator calculations or increasing concurrency.');
    }
    
    if (snapshot.cacheHitRate < this.config.alertThresholds.cacheHitRate) {
      recommendations.push('Cache hit rate is low. Review caching strategy and consider increasing cache size.');
    }
    
    if (snapshot.memoryUtilization > 0.8) {
      recommendations.push('High memory utilization detected. Consider implementing memory optimization or garbage collection tuning.');
    }
    
    if (snapshot.averageQueueLength > this.config.alertThresholds.queueLength) {
      recommendations.push('Queue length is consistently high. Consider scaling up processing capacity.');
    }
    
    return recommendations;
  }

  // =============================================================================
  // PRIVATE METHODS - UTILITIES
  // =============================================================================

  private shouldSample(): boolean {
    return Math.random() <= this.config.samplingRate;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private limitEventHistory(): void {
    if (this.events.length > 10000) {
      this.events.splice(0, 1000); // Remove oldest 1000 events
    }
  }

  private getEmptySnapshot(): PerformanceSnapshot {
    return {
      timestamp: new Date(),
      averageProcessingTime: 0,
      p95ProcessingTime: 0,
      p99ProcessingTime: 0,
      throughput: 0,
      successRate: 1,
      errorRate: 0,
      memoryUtilization: 0,
      cacheHitRate: 0,
      workerUtilization: 0,
      averageQueueLength: 0,
      maxQueueLength: 0
    };
  }

  // Placeholder methods for external data (would be injected in real implementation)
  private getLatestMemoryUtilization(): number {
    return 0; // Would be provided by MemoryManager
  }

  private getLatestWorkerUtilization(): number {
    return 0; // Would be provided by ParallelProcessingEngine
  }

  private getAverageQueueLength(): number {
    return 0; // Would be calculated from queue metrics
  }

  private getMaxQueueLength(): number {
    return 0; // Would be calculated from queue metrics
  }

  private getLatestQueueLength(): number {
    return 0; // Would be provided by pipeline
  }

  private startBackgroundTasks(): void {
    // Start reporting if enabled
    if (this.config.enableReporting) {
      this.reportingInterval = setInterval(() => {
        const report = this.generateReport(1); // Last hour
        this.emit('periodicReport', report);
      }, this.config.reportingInterval * 1000);
    }
    
    // Start cleanup task
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, 300000); // Every 5 minutes
  }

  private mergeConfig(config: Partial<MetricsConfig>): MetricsConfig {
    return {
      enabled: config.enabled ?? true,
      retentionPeriod: config.retentionPeriod ?? 86400, // 24 hours
      samplingRate: config.samplingRate ?? 1.0, // Sample all events
      alertThresholds: {
        processingTime: config.alertThresholds?.processingTime ?? 5000, // 5 seconds
        errorRate: config.alertThresholds?.errorRate ?? 0.05, // 5%
        memoryUsage: config.alertThresholds?.memoryUsage ?? 512 * 1024 * 1024, // 512MB
        cacheHitRate: config.alertThresholds?.cacheHitRate ?? 0.7, // 70%
        queueLength: config.alertThresholds?.queueLength ?? 100
      },
      enableReporting: config.enableReporting ?? true,
      reportingInterval: config.reportingInterval ?? 3600 // 1 hour
    };
  }
}

export default PipelineMetrics;