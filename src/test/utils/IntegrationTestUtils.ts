/**
 * Phase 2 Integration Test Utilities - Integration Task TE-002
 * 
 * Specialized utilities and helpers for comprehensive Phase 2 integration testing.
 * Provides advanced testing patterns, mock implementations, and validation helpers
 * specifically designed for testing complex algorithmic trading system integrations.
 */

import { TestingFramework, MockDatabase } from '../TestingFramework.js';
import { MockDataGenerator } from '../MockDataGenerator.js';
import { TEST_CONFIG } from '../config/TestConfiguration.js';

import type { 
  OHLCV, 
  StrategySignal, 
  StrategyConfig, 
  Trade, 
  PortfolioState,
  MarketData 
} from '../../shared/types/trading.js';

/**
 * Integration Test Result Analyzer
 */
export class IntegrationTestAnalyzer {
  private testResults: Map<string, any[]> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private errorLog: Array<{ timestamp: number; component: string; error: string }> = [];
  
  recordResult(testName: string, result: any): void {
    if (!this.testResults.has(testName)) {
      this.testResults.set(testName, []);
    }
    this.testResults.get(testName)!.push({
      timestamp: Date.now(),
      result
    });
  }
  
  recordPerformanceMetric(operation: string, timeMs: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    this.performanceMetrics.get(operation)!.push(timeMs);
  }
  
  recordError(component: string, error: string): void {
    this.errorLog.push({
      timestamp: Date.now(),
      component,
      error
    });
  }
  
  getPerformanceStats(operation: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.performanceMetrics.get(operation) || [];
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...metrics].sort((a, b) => a - b);
    return {
      count: metrics.length,
      avg: metrics.reduce((sum, val) => sum + val, 0) / metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  generateAnalysisReport(): string {
    const report = [`
📊 Integration Test Analysis Report
=====================================

Performance Metrics:
`];
    
    for (const [operation, metrics] of this.performanceMetrics.entries()) {
      const stats = this.getPerformanceStats(operation);
      report.push(`
${operation}:
  Count: ${stats.count}
  Average: ${stats.avg.toFixed(2)}ms
  Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms
  P95/P99: ${stats.p95.toFixed(2)}ms / ${stats.p99.toFixed(2)}ms
`);
    }
    
    report.push(`
Error Summary:
  Total Errors: ${this.errorLog.length}
`);
    
    const errorsByComponent = new Map<string, number>();
    for (const error of this.errorLog) {
      errorsByComponent.set(error.component, (errorsByComponent.get(error.component) || 0) + 1);
    }
    
    for (const [component, count] of errorsByComponent.entries()) {
      report.push(`  ${component}: ${count} errors`);
    }
    
    return report.join('');
  }
  
  clear(): void {
    this.testResults.clear();
    this.performanceMetrics.clear();
    this.errorLog.length = 0;
  }
}

/**
 * Advanced Mock Market Data Provider with Integration Test Features
 */
export class IntegrationTestMarketDataProvider {
  private dataStreams = new Map<string, OHLCV[]>();
  private subscribers = new Map<string, Array<(data: OHLCV) => void>>();
  private latencyMs = 0;
  private errorRate = 0;
  private connected = false;
  
  constructor() {}
  
  async connect(): Promise<void> {
    await this.simulateNetworkLatency();
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  setNetworkLatency(latencyMs: number): void {
    this.latencyMs = latencyMs;
  }
  
  setErrorRate(rate: number): void {
    this.errorRate = Math.max(0, Math.min(1, rate));
  }
  
  loadHistoricalData(symbol: string, data: OHLCV[]): void {
    this.dataStreams.set(symbol, [...data]);
  }
  
  subscribe(symbol: string, callback: (data: OHLCV) => void): void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    this.subscribers.get(symbol)!.push(callback);
  }
  
  unsubscribe(symbol: string, callback?: (data: OHLCV) => void): void {
    if (callback) {
      const callbacks = this.subscribers.get(symbol) || [];
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.subscribers.delete(symbol);
    }
  }
  
  async simulateRealTimeData(symbol: string, rate: number, duration: number): Promise<void> {
    const interval = 1000 / rate; // milliseconds between data points
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime && this.connected) {
      await this.simulateNetworkLatency();
      
      if (this.shouldInjectError()) {
        throw new Error(`Simulated network error for ${symbol}`);
      }
      
      const syntheticData = this.generateSyntheticDataPoint(symbol);
      this.broadcastToSubscribers(symbol, syntheticData);
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  private async simulateNetworkLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }
  }
  
  private shouldInjectError(): boolean {
    return Math.random() < this.errorRate;
  }
  
  private generateSyntheticDataPoint(symbol: string): OHLCV {
    const basePrice = symbol === 'ETH-USD' ? 2000 : 40000;
    const variation = (Math.random() - 0.5) * basePrice * 0.01; // 1% variation
    const price = basePrice + variation;
    
    return {
      symbol,
      timestamp: Date.now(),
      open: price,
      high: price * (1 + Math.random() * 0.005),
      low: price * (1 - Math.random() * 0.005),
      close: price + (Math.random() - 0.5) * price * 0.002,
      volume: Math.random() * 1000 + 100
    };
  }
  
  private broadcastToSubscribers(symbol: string, data: OHLCV): void {
    const subscribers = this.subscribers.get(symbol) || [];
    for (const callback of subscribers) {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Error in market data subscriber for ${symbol}:`, error);
      }
    }
  }
  
  getStreamMetrics(): { [symbol: string]: { subscriberCount: number; dataPointsGenerated: number } } {
    const metrics: { [symbol: string]: { subscriberCount: number; dataPointsGenerated: number } } = {};
    
    for (const [symbol, subscribers] of this.subscribers.entries()) {
      metrics[symbol] = {
        subscriberCount: subscribers.length,
        dataPointsGenerated: this.dataStreams.get(symbol)?.length || 0
      };
    }
    
    return metrics;
  }
}

/**
 * Integration Test System Monitor
 */
export class IntegrationTestSystemMonitor {
  private metrics: Array<{
    timestamp: number;
    memoryMB: number;
    cpuPercent: number;
    activeConnections: number;
    errorCount: number;
  }> = [];
  
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }
  
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }
  
  private collectMetrics(): void {
    const memoryUsage = process.memoryUsage?.() || { heapUsed: 0 };
    
    this.metrics.push({
      timestamp: Date.now(),
      memoryMB: memoryUsage.heapUsed / 1024 / 1024,
      cpuPercent: 0, // Would need a library like pidusage in real implementation
      activeConnections: 0, // Would track actual connections
      errorCount: 0 // Would track from error handlers
    });
    
    // Keep only last 1000 metrics to prevent memory growth
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }
  
  getMetricsSummary(): {
    avgMemoryMB: number;
    peakMemoryMB: number;
    memoryGrowthMB: number;
    avgCpuPercent: number;
    dataPoints: number;
  } {
    if (this.metrics.length === 0) {
      return { avgMemoryMB: 0, peakMemoryMB: 0, memoryGrowthMB: 0, avgCpuPercent: 0, dataPoints: 0 };
    }
    
    const memoryValues = this.metrics.map(m => m.memoryMB);
    const cpuValues = this.metrics.map(m => m.cpuPercent);
    
    return {
      avgMemoryMB: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
      peakMemoryMB: Math.max(...memoryValues),
      memoryGrowthMB: memoryValues[memoryValues.length - 1] - memoryValues[0],
      avgCpuPercent: cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length,
      dataPoints: this.metrics.length
    };
  }
  
  exportMetrics(): Array<typeof this.metrics[0]> {
    return [...this.metrics];
  }
  
  detectAnomalies(): Array<{ type: string; timestamp: number; description: string }> {
    const anomalies: Array<{ type: string; timestamp: number; description: string }> = [];
    
    // Memory leak detection
    if (this.metrics.length >= 10) {
      const recentMetrics = this.metrics.slice(-10);
      const memoryTrend = recentMetrics[recentMetrics.length - 1].memoryMB - recentMetrics[0].memoryMB;
      
      if (memoryTrend > TEST_CONFIG.qualityGates.performance.memoryLeakThresholdMB) {
        anomalies.push({
          type: 'memory_leak',
          timestamp: Date.now(),
          description: `Potential memory leak detected: ${memoryTrend.toFixed(2)}MB growth over recent samples`
        });
      }
    }
    
    // High memory usage detection
    const peakMemory = this.getMetricsSummary().peakMemoryMB;
    if (peakMemory > TEST_CONFIG.qualityGates.performance.maxMemoryUsageMB) {
      anomalies.push({
        type: 'high_memory',
        timestamp: Date.now(),
        description: `High memory usage detected: ${peakMemory.toFixed(2)}MB exceeds threshold of ${TEST_CONFIG.qualityGates.performance.maxMemoryUsageMB}MB`
      });
    }
    
    return anomalies;
  }
  
  clear(): void {
    this.metrics.length = 0;
  }
}

/**
 * Integration Test Scenario Builder
 */
export class IntegrationTestScenarioBuilder {
  private scenarios: Map<string, {
    description: string;
    setup: () => Promise<void>;
    execute: () => Promise<any>;
    validate: (result: any) => Promise<boolean>;
    cleanup: () => Promise<void>;
  }> = new Map();
  
  addScenario(
    name: string, 
    scenario: {
      description: string;
      setup: () => Promise<void>;
      execute: () => Promise<any>;
      validate: (result: any) => Promise<boolean>;
      cleanup: () => Promise<void>;
    }
  ): void {
    this.scenarios.set(name, scenario);
  }
  
  async executeScenario(name: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
  }> {
    const scenario = this.scenarios.get(name);
    if (!scenario) {
      throw new Error(`Scenario '${name}' not found`);
    }
    
    const startTime = performance.now();
    
    try {
      await scenario.setup();
      const result = await scenario.execute();
      const isValid = await scenario.validate(result);
      await scenario.cleanup();
      
      return {
        success: isValid,
        result,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }
  
  async executeAllScenarios(): Promise<Map<string, {
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
  }>> {
    const results = new Map();
    
    for (const [name, _scenario] of this.scenarios.entries()) {
      const result = await this.executeScenario(name);
      results.set(name, result);
    }
    
    return results;
  }
  
  listScenarios(): Array<{ name: string; description: string }> {
    return Array.from(this.scenarios.entries()).map(([name, scenario]) => ({
      name,
      description: scenario.description
    }));
  }
  
  clear(): void {
    this.scenarios.clear();
  }
}

/**
 * Integration Test Data Validator
 */
export class IntegrationTestDataValidator {
  
  static validateTradingPipeline(events: Array<{ 
    timestamp: number; 
    component: string; 
    event: string; 
    data?: any 
  }>): {
    isValid: boolean;
    violations: string[];
    statistics: {
      totalEvents: number;
      componentCoverage: number;
      averageLatency: number;
    };
  } {
    const violations: string[] = [];
    const componentEvents = new Set(events.map(e => e.component));
    
    // Required components for complete trading pipeline
    const requiredComponents = [
      'StrategyEngine',
      'SignalProcessor', 
      'RiskEngine',
      'ExecutionEngine',
      'OrderManager'
    ];
    
    // Check component coverage
    for (const required of requiredComponents) {
      if (!componentEvents.has(required)) {
        violations.push(`Missing events from required component: ${required}`);
      }
    }
    
    // Check event sequence integrity
    const signalEvents = events.filter(e => e.event === 'signal_generated');
    const executionEvents = events.filter(e => e.event === 'order_created');
    
    if (signalEvents.length > 0 && executionEvents.length === 0) {
      violations.push('Signals generated but no orders created - pipeline broken');
    }
    
    // Calculate latency between related events
    let totalLatency = 0;
    let latencyMeasurements = 0;
    
    for (const signal of signalEvents) {
      const relatedExecution = executionEvents.find(e => 
        e.timestamp > signal.timestamp && 
        e.timestamp < signal.timestamp + 10000 // Within 10 seconds
      );
      
      if (relatedExecution) {
        totalLatency += relatedExecution.timestamp - signal.timestamp;
        latencyMeasurements++;
      }
    }
    
    const averageLatency = latencyMeasurements > 0 ? totalLatency / latencyMeasurements : 0;
    
    // Validate average latency
    if (averageLatency > TEST_CONFIG.performance.phase2Integration.pipelineEndToEnd) {
      violations.push(`Pipeline latency too high: ${averageLatency.toFixed(2)}ms > ${TEST_CONFIG.performance.phase2Integration.pipelineEndToEnd}ms`);
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      statistics: {
        totalEvents: events.length,
        componentCoverage: componentEvents.size / requiredComponents.length,
        averageLatency
      }
    };
  }
  
  static validatePerformanceMetrics(metrics: {
    operation: string;
    measurements: number[];
  }[]): {
    isValid: boolean;
    violations: string[];
    summary: { [operation: string]: { avg: number; p95: number; p99: number } };
  } {
    const violations: string[] = [];
    const summary: { [operation: string]: { avg: number; p95: number; p99: number } } = {};
    
    for (const metric of metrics) {
      const sorted = [...metric.measurements].sort((a, b) => a - b);
      const avg = metric.measurements.reduce((sum, val) => sum + val, 0) / metric.measurements.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      summary[metric.operation] = { avg, p95, p99 };
      
      // Check against performance targets
      const targets = TEST_CONFIG.performance.phase2Integration;
      const target = targets[metric.operation as keyof typeof targets];
      
      if (typeof target === 'number' && avg > target) {
        violations.push(`${metric.operation} average (${avg.toFixed(2)}ms) exceeds target (${target}ms)`);
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      summary
    };
  }
  
  static validateSystemResilience(testResults: {
    scenarioName: string;
    errorRate: number;
    recoveryTime: number;
    successRate: number;
  }[]): {
    isValid: boolean;
    violations: string[];
    overallResilience: number;
  } {
    const violations: string[] = [];
    let totalResilience = 0;
    
    for (const result of testResults) {
      // Check recovery time
      if (result.recoveryTime > TEST_CONFIG.environment.phase2Integration.maxRecoveryTimeMs) {
        violations.push(`${result.scenarioName}: Recovery time ${result.recoveryTime}ms exceeds limit ${TEST_CONFIG.environment.phase2Integration.maxRecoveryTimeMs}ms`);
      }
      
      // Check success rate under error conditions
      const expectedSuccessRate = 1 - result.errorRate;
      if (result.successRate < expectedSuccessRate * 0.8) { // Allow 20% tolerance
        violations.push(`${result.scenarioName}: Success rate ${(result.successRate * 100).toFixed(1)}% too low for error rate ${(result.errorRate * 100).toFixed(1)}%`);
      }
      
      // Calculate resilience score (0-1)
      const resilienceScore = Math.min(1, result.successRate / expectedSuccessRate);
      totalResilience += resilienceScore;
    }
    
    const overallResilience = testResults.length > 0 ? totalResilience / testResults.length : 0;
    
    return {
      isValid: violations.length === 0 && overallResilience > 0.8,
      violations,
      overallResilience
    };
  }
}

/**
 * Integration Test Suite Utilities
 */
export class IntegrationTestUtils {
  
  static async waitForSystemStabilization(
    healthChecker: () => Promise<boolean>,
    maxWaitMs: number = 10000,
    checkIntervalMs: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await healthChecker()) {
        // Wait a bit more to ensure stability
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs * 2));
        if (await healthChecker()) {
          return true;
        }
      }
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    
    return false;
  }
  
  static async measureOperationPerformance<T>(
    operation: () => Promise<T>,
    iterations: number = 1
  ): Promise<{
    result: T;
    avgTime: number;
    minTime: number;
    maxTime: number;
    measurements: number[];
  }> {
    const measurements: number[] = [];
    let result: T;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      result = await operation();
      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    return {
      result: result!,
      avgTime: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      minTime: Math.min(...measurements),
      maxTime: Math.max(...measurements),
      measurements
    };
  }
  
  static generateLoadTestData(
    symbols: string[],
    dataPointsPerSymbol: number,
    options?: {
      volatility?: number;
      trend?: number;
      startTime?: number;
      intervalMs?: number;
    }
  ): OHLCV[] {
    const { volatility = 0.02, trend = 0, startTime = Date.now(), intervalMs = 1000 } = options || {};
    const data: OHLCV[] = [];
    
    for (const symbol of symbols) {
      const basePrices: { [key: string]: number } = {
        'ETH-USD': 2000,
        'BTC-USD': 40000,
        'AVAX-USD': 30,
        'SOL-USD': 100
      };
      
      const basePrice = basePrices[symbol] || 1000;
      
      const symbolData = MockDataGenerator.generateOHLCV(dataPointsPerSymbol, {
        symbol,
        startPrice: basePrice,
        volatility,
        trend,
        startTime,
        intervalMs
      });
      
      data.push(...symbolData);
    }
    
    // Sort by timestamp to simulate realistic data flow
    return data.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  static createPerformanceBenchmark(
    name: string,
    target: number,
    tolerance: number = 0.1
  ) {
    return {
      name,
      target,
      tolerance,
      validate: (actual: number) => {
        const withinTolerance = actual <= target * (1 + tolerance);
        return {
          passed: withinTolerance,
          actual,
          target,
          tolerance,
          message: withinTolerance 
            ? `✅ ${name}: ${actual.toFixed(2)}ms (target: ${target}ms)`
            : `❌ ${name}: ${actual.toFixed(2)}ms exceeds target ${target}ms by ${((actual - target) / target * 100).toFixed(1)}%`
        };
      }
    };
  }
  
  static async injectChaosIntoSystem(
    chaosConfig: {
      networkLatency?: number;
      errorRate?: number;
      memoryPressure?: number;
      cpuThrottling?: number;
    },
    durationMs: number
  ): Promise<() => void> {
    const cleanupFunctions: Array<() => void> = [];
    
    // Simulate network latency
    if (chaosConfig.networkLatency) {
      // In a real implementation, this would intercept network calls
      // For testing, we can inject delays into mock functions
    }
    
    // Simulate error injection
    if (chaosConfig.errorRate) {
      // In a real implementation, this would randomly fail operations
    }
    
    // Simulate memory pressure
    if (chaosConfig.memoryPressure) {
      const memoryBlocks: any[] = [];
      const blockSize = 1024 * 1024; // 1MB
      const blocksNeeded = Math.floor(chaosConfig.memoryPressure * 100);
      
      for (let i = 0; i < blocksNeeded; i++) {
        memoryBlocks.push(new Array(blockSize / 8).fill(i));
      }
      
      cleanupFunctions.push(() => {
        memoryBlocks.length = 0;
        if (global.gc) global.gc();
      });
    }
    
    // Return cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }
}

// Export singleton instances for common use
export const integrationTestAnalyzer = new IntegrationTestAnalyzer();
export const integrationTestMonitor = new IntegrationTestSystemMonitor();
export const integrationTestScenarioBuilder = new IntegrationTestScenarioBuilder();

export default {
  IntegrationTestAnalyzer,
  IntegrationTestMarketDataProvider,
  IntegrationTestSystemMonitor,
  IntegrationTestScenarioBuilder,
  IntegrationTestDataValidator,
  IntegrationTestUtils,
  integrationTestAnalyzer,
  integrationTestMonitor,
  integrationTestScenarioBuilder
};