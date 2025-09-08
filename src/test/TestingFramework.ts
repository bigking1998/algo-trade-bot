/**
 * Comprehensive Testing Framework - Task TE-001
 * 
 * Core testing utilities for the algorithmic trading platform.
 * Provides mock data generation, testing utilities, and performance benchmarks.
 * 
 * Key Features:
 * - Mock data generation for all trading entities
 * - Performance benchmarking and assertions
 * - Mock service implementations
 * - Testing utilities for accuracy and validation
 */

import { OHLCV, PortfolioState, Trade, StrategyConfiguration, StrategyType } from '@/shared/types/trading';
import { DatabaseManager } from '@/backend/database/DatabaseManager';
import { TradeRepository } from '@/backend/repositories/TradeRepository';
import { StrategyRepository } from '@/backend/repositories/StrategyRepository';
import { MarketDataRepository } from '@/backend/repositories/MarketDataRepository';
import { BaseStrategy } from '@/backend/strategies/BaseStrategy';

/**
 * Core testing framework with utilities for comprehensive testing
 */
export class TestingFramework {
  /**
   * Performance benchmarks for different operations (in milliseconds)
   */
  static readonly PERFORMANCE_BENCHMARKS = {
    indicatorCalculation: 1,      // Indicator calculation should complete within 1ms
    strategyExecution: 50,        // Strategy execution should complete within 50ms
    databaseQuery: 100,           // Database queries should complete within 100ms
    featureComputation: 10,       // ML feature computation should complete within 10ms
    riskAssessment: 25,          // Risk assessment should complete within 25ms
    uiRender: 16,                // UI components should render within 16ms (60fps)
    apiRequest: 500,             // API requests should complete within 500ms
  } as const;

  /**
   * Accuracy standards for numerical calculations
   */
  static readonly ACCURACY_STANDARDS = {
    indicatorTolerance: 0.0001,   // 0.01% tolerance for indicator calculations
    pnlTolerance: 0.01,           // $0.01 tolerance for P&L calculations
    riskTolerance: 0.001,         // 0.1% tolerance for risk calculations
    featureTolerance: 0.001,      // 0.1% tolerance for ML feature calculations
    priceTolerance: 0.000001,     // 0.0001% tolerance for price calculations
  } as const;

  /**
   * Coverage requirements for different test types
   */
  static readonly COVERAGE_REQUIREMENTS = {
    lines: 85,
    functions: 90,
    branches: 80,
    statements: 85,
  } as const;

  /**
   * Assert that a value is within an acceptable tolerance range
   */
  static assertWithinRange(actual: number, expected: number, tolerance: number, message?: string): void {
    const diff = Math.abs(actual - expected);
    const percentDiff = expected !== 0 ? (diff / Math.abs(expected)) : diff;
    
    if (percentDiff > tolerance) {
      throw new Error(
        message || 
        `Expected ${actual} to be within ${tolerance * 100}% of ${expected}, but difference was ${(percentDiff * 100).toFixed(4)}%`
      );
    }
  }

  /**
   * Assert that a function completes within a specified time limit
   */
  static async assertPerformance(
    fn: () => Promise<any> | any,
    maxTimeMs: number,
    description?: string
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      await fn();
    } finally {
      const endTime = performance.now();
      const actualTime = endTime - startTime;
      
      if (actualTime > maxTimeMs) {
        throw new Error(
          `Performance test failed: ${description || 'Operation'} took ${actualTime.toFixed(2)}ms, expected max ${maxTimeMs}ms`
        );
      }
    }
  }

  /**
   * Assert that two arrays are approximately equal within tolerance
   */
  static assertArraysEqual(
    actual: number[], 
    expected: number[], 
    tolerance: number = TestingFramework.ACCURACY_STANDARDS.indicatorTolerance,
    message?: string
  ): void {
    if (actual.length !== expected.length) {
      throw new Error(`Array lengths differ: actual ${actual.length}, expected ${expected.length}`);
    }

    for (let i = 0; i < actual.length; i++) {
      TestingFramework.assertWithinRange(
        actual[i], 
        expected[i], 
        tolerance, 
        message || `Array element ${i} differs`
      );
    }
  }

  /**
   * Assert that a number is between two values (inclusive)
   */
  static assertBetween(actual: number, min: number, max: number, message?: string): void {
    if (actual < min || actual > max) {
      throw new Error(
        message || `Expected ${actual} to be between ${min} and ${max}`
      );
    }
  }

  /**
   * Assert that an object has required properties
   */
  static assertHasProperties(obj: any, properties: string[], message?: string): void {
    for (const prop of properties) {
      if (!(prop in obj)) {
        throw new Error(
          message || `Object is missing required property: ${prop}`
        );
      }
    }
  }

  /**
   * Generate a unique test identifier
   */
  static generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a test timeout promise
   */
  static createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Wait for a condition to be true
   */
  static async waitForCondition(
    condition: () => boolean,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (!condition()) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Condition not met within ${timeoutMs}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Measure memory usage of a function
   */
  static async measureMemoryUsage<T>(fn: () => Promise<T> | T): Promise<{
    result: T;
    memoryUsedMB: number;
    executionTimeMs: number;
  }> {
    // Force garbage collection if available (Node.js)
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage?.()?.heapUsed || 0;
    const startTime = performance.now();
    
    const result = await fn();
    
    const endTime = performance.now();
    const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
    
    return {
      result,
      memoryUsedMB: (finalMemory - initialMemory) / 1024 / 1024,
      executionTimeMs: endTime - startTime,
    };
  }

  /**
   * Create a mock database for testing
   */
  static createMockDatabase(): MockDatabase {
    return new MockDatabase();
  }

  /**
   * Create mock market data provider
   */
  static createMockMarketDataProvider(): MockMarketDataProvider {
    return new MockMarketDataProvider();
  }

  /**
   * Create mock indicator provider
   */
  static createMockIndicatorProvider(): MockIndicatorProvider {
    return new MockIndicatorProvider();
  }

  /**
   * Validate trading signal structure
   */
  static validateSignal(signal: any): void {
    TestingFramework.assertHasProperties(signal, ['action', 'confidence', 'timestamp', 'symbol']);
    TestingFramework.assertBetween(signal.confidence, 0, 1, 'Signal confidence must be between 0 and 1');
    
    if (!['buy', 'sell', 'hold'].includes(signal.action)) {
      throw new Error(`Invalid signal action: ${signal.action}`);
    }
  }

  /**
   * Validate OHLCV data structure
   */
  static validateOHLCV(ohlcv: OHLCV): void {
    TestingFramework.assertHasProperties(ohlcv, ['time', 'open', 'high', 'low', 'close', 'volume']);
    
    if (ohlcv.high < ohlcv.low) {
      throw new Error(`High (${ohlcv.high}) cannot be less than low (${ohlcv.low})`);
    }
    
    if (ohlcv.high < Math.max(ohlcv.open, ohlcv.close)) {
      throw new Error(`High (${ohlcv.high}) must be >= max(open, close)`);
    }
    
    if (ohlcv.low > Math.min(ohlcv.open, ohlcv.close)) {
      throw new Error(`Low (${ohlcv.low}) must be <= min(open, close)`);
    }
    
    if (ohlcv.volume < 0) {
      throw new Error(`Volume cannot be negative: ${ohlcv.volume}`);
    }
  }

  /**
   * Validate portfolio state structure
   */
  static validatePortfolioState(portfolio: PortfolioState): void {
    TestingFramework.assertHasProperties(portfolio, [
      'totalValue', 'availableBalance', 'positions', 'timestamp'
    ]);
    
    if (portfolio.totalValue < 0) {
      throw new Error('Portfolio total value cannot be negative');
    }
    
    if (portfolio.availableBalance < 0) {
      throw new Error('Available balance cannot be negative');
    }
  }

  /**
   * Create a test suite summary
   */
  static createTestSummary(results: {
    passed: number;
    failed: number;
    skipped: number;
    totalTime: number;
    coverage?: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  }): string {
    const { passed, failed, skipped, totalTime, coverage } = results;
    const total = passed + failed + skipped;
    
    let summary = `
Test Suite Summary
==================
Total Tests: ${total}
Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)
Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)
Skipped: ${skipped} (${((skipped / total) * 100).toFixed(1)}%)
Total Time: ${totalTime.toFixed(2)}ms
`;

    if (coverage) {
      summary += `
Coverage Report
===============
Lines: ${coverage.lines.toFixed(1)}% (Required: ${TestingFramework.COVERAGE_REQUIREMENTS.lines}%)
Functions: ${coverage.functions.toFixed(1)}% (Required: ${TestingFramework.COVERAGE_REQUIREMENTS.functions}%)
Branches: ${coverage.branches.toFixed(1)}% (Required: ${TestingFramework.COVERAGE_REQUIREMENTS.branches}%)
Statements: ${coverage.statements.toFixed(1)}% (Required: ${TestingFramework.COVERAGE_REQUIREMENTS.statements}%)
`;
    }

    return summary;
  }
}

/**
 * Mock database implementation for testing
 */
export class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private queryCount = 0;
  private connected = true;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    this.queryCount++;
    
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Simulate query delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    
    // Simple mock implementation - return empty array or test data
    const tableName = this.extractTableName(sql);
    return this.data.get(tableName) || [];
  }

  async insert<T>(table: string, data: T): Promise<T> {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    
    const records = this.data.get(table)!;
    const record = { ...data, id: records.length + 1 };
    records.push(record);
    
    return record;
  }

  async update<T>(table: string, id: number, data: Partial<T>): Promise<T | null> {
    const records = this.data.get(table) || [];
    const index = records.findIndex(r => r.id === id);
    
    if (index === -1) {
      return null;
    }
    
    records[index] = { ...records[index], ...data };
    return records[index];
  }

  async delete(table: string, id: number): Promise<boolean> {
    const records = this.data.get(table) || [];
    const index = records.findIndex(r => r.id === id);
    
    if (index === -1) {
      return false;
    }
    
    records.splice(index, 1);
    return true;
  }

  getQueryCount(): number {
    return this.queryCount;
  }

  clearData(): void {
    this.data.clear();
    this.queryCount = 0;
  }

  setTestData(table: string, data: any[]): void {
    this.data.set(table, [...data]);
  }

  private extractTableName(sql: string): string {
    const match = sql.match(/FROM\s+(\w+)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }
}

/**
 * Mock market data provider for testing
 */
export class MockMarketDataProvider {
  private subscriptions = new Map<string, any>();
  private isConnected = false;

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.subscriptions.clear();
  }

  isMarketDataConnected(): boolean {
    return this.isConnected;
  }

  subscribe(symbol: string, callback: (data: OHLCV) => void): void {
    if (!this.isConnected) {
      throw new Error('Not connected to market data feed');
    }

    this.subscriptions.set(symbol, callback);
  }

  unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);
  }

  simulateDataFeed(symbol: string, data: OHLCV): void {
    const callback = this.subscriptions.get(symbol);
    if (callback) {
      callback(data);
    }
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

/**
 * Mock indicator provider for testing
 */
export class MockIndicatorProvider {
  private indicators = new Map<string, any>();
  
  registerIndicator(name: string, calculator: any): void {
    this.indicators.set(name, calculator);
  }

  calculate(name: string, data: OHLCV[]): any {
    const indicator = this.indicators.get(name);
    if (!indicator) {
      throw new Error(`Unknown indicator: ${name}`);
    }

    // Simulate calculation delay
    const startTime = performance.now();
    const result = indicator.calculate(data);
    const endTime = performance.now();

    return {
      ...result,
      calculationTimeMs: endTime - startTime,
    };
  }

  getAvailableIndicators(): string[] {
    return Array.from(this.indicators.keys());
  }

  clearIndicators(): void {
    this.indicators.clear();
  }
}

export default TestingFramework;