/**
 * IndicatorDataFrame Integration Bridge - Task BE-010
 * 
 * Seamless integration between technical indicators and IndicatorDataFrame
 * for efficient strategy development and real-time data processing.
 */

import { IndicatorDataFrame, OHLCV } from '../strategies/DataStructures.js';
import { IndicatorFactory, IndicatorUtils, CommonConfigs } from './index.js';
import { OHLCV as IndicatorOHLCV, IndicatorResult } from './base/types.js';

/**
 * Configuration for indicator bridge
 */
export interface IndicatorBridgeConfig {
  /** Indicators to initialize with their configurations */
  indicators: Array<{
    name: string;
    alias: string;
    config: any;
  }>;
  
  /** Maximum buffer size for historical results */
  maxHistorySize?: number;
  
  /** Whether to auto-update indicators on new data */
  autoUpdate?: boolean;
  
  /** Performance monitoring enabled */
  monitorPerformance?: boolean;
}

/**
 * Bridge class connecting indicators with IndicatorDataFrame
 */
export class IndicatorDataFrameBridge {
  private indicators: Map<string, any> = new Map();
  private indicatorDataFrame: IndicatorDataFrame;
  private config: IndicatorBridgeConfig;
  private timestamps: number[] = [];
  private performanceMetrics: Map<string, any> = new Map();

  constructor(config: IndicatorBridgeConfig) {
    this.config = {
      maxHistorySize: 1000,
      autoUpdate: true,
      monitorPerformance: false,
      ...config
    };
    
    this.indicatorDataFrame = new IndicatorDataFrame();
    this.initializeIndicators();
  }

  /**
   * Initialize all configured indicators
   */
  private initializeIndicators(): void {
    for (const { name, alias, config } of this.config.indicators) {
      try {
        const indicator = IndicatorFactory.create(name, config);
        this.indicators.set(alias, indicator);
        console.log(`Initialized indicator: ${alias} (${name})`);
      } catch (error) {
        console.error(`Failed to initialize indicator ${alias} (${name}):`, error);
      }
    }
  }

  /**
   * Convert MarketDataFrame OHLCV to indicator OHLCV format
   */
  private convertOHLCV(candle: OHLCV): IndicatorOHLCV {
    return {
      time: typeof candle.timestamp === 'number' ? new Date(candle.timestamp) : candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    };
  }

  /**
   * Process single candle through all indicators
   */
  processCandle(candle: OHLCV): Record<string, number | null> {
    const indicatorCandle = this.convertOHLCV(candle);
    const timestamp = typeof candle.timestamp === 'number' ? candle.timestamp : candle.timestamp.getTime();
    const results: Record<string, number | null> = {};

    for (const [alias, indicator] of this.indicators) {
      try {
        const startTime = this.config.monitorPerformance ? Date.now() : 0;
        
        // Update indicator with new candle
        const result: IndicatorResult = indicator.update(indicatorCandle);
        
        if (this.config.monitorPerformance) {
          this.updatePerformanceMetrics(alias, Date.now() - startTime);
        }

        // Extract numeric value based on result type
        let value: number | null = null;
        if (result && result.isValid) {
          if (typeof result.value === 'number') {
            value = result.value;
          } else if (typeof result.value === 'object' && result.value !== null) {
            // Handle complex indicator results (e.g., MACD, Bollinger Bands)
            if ('macd' in result.value) {
              value = result.value.macd; // Use MACD line as primary value
            } else if ('middle' in result.value) {
              value = result.value.middle; // Use middle line for Bollinger Bands
            } else if (Array.isArray(result.value) && result.value.length > 0) {
              value = result.value[0]; // Use first value in array
            }
          }
        }

        results[alias] = value;
      } catch (error) {
        console.warn(`Error processing indicator ${alias}:`, error);
        results[alias] = null;
      }
    }

    // Update IndicatorDataFrame if auto-update is enabled
    if (this.config.autoUpdate) {
      this.timestamps.push(timestamp);
      
      // Maintain max history size
      if (this.config.maxHistorySize && this.timestamps.length > this.config.maxHistorySize) {
        this.timestamps.shift();
      }

      for (const [alias, value] of Object.entries(results)) {
        if (value !== null) {
          this.updateIndicatorInDataFrame(alias, value, timestamp);
        }
      }
    }

    return results;
  }

  /**
   * Process multiple candles through all indicators
   */
  processCandles(candles: OHLCV[]): Record<string, number[]> {
    const allResults: Record<string, number[]> = {};
    
    // Initialize result arrays
    for (const alias of this.indicators.keys()) {
      allResults[alias] = [];
    }

    // Process each candle
    for (const candle of candles) {
      const results = this.processCandle(candle);
      
      for (const [alias, value] of Object.entries(results)) {
        allResults[alias].push(value ?? NaN);
      }
    }

    return allResults;
  }

  /**
   * Update indicator value in IndicatorDataFrame
   */
  private updateIndicatorInDataFrame(alias: string, value: number, timestamp: number): void {
    try {
      const existingValues = this.indicatorDataFrame.getIndicator(alias) || [];
      const existingTimestamps = this.timestamps.slice(0, existingValues.length);
      
      existingValues.push(value);
      existingTimestamps.push(timestamp);
      
      // Maintain max history size
      if (this.config.maxHistorySize && existingValues.length > this.config.maxHistorySize) {
        existingValues.shift();
        existingTimestamps.shift();
      }

      this.indicatorDataFrame.addIndicator(alias, existingValues, existingTimestamps);
    } catch (error) {
      console.warn(`Failed to update IndicatorDataFrame for ${alias}:`, error);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(alias: string, calculationTime: number): void {
    const existing = this.performanceMetrics.get(alias) || {
      totalTime: 0,
      count: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity
    };

    existing.totalTime += calculationTime;
    existing.count += 1;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, calculationTime);
    existing.minTime = Math.min(existing.minTime, calculationTime);

    this.performanceMetrics.set(alias, existing);
  }

  /**
   * Get indicator value from IndicatorDataFrame
   */
  getIndicatorValue(alias: string, index?: number): number | null {
    if (index !== undefined) {
      return this.indicatorDataFrame.getValue(alias, index);
    }
    return this.indicatorDataFrame.getLatestValue(alias);
  }

  /**
   * Get all values for an indicator
   */
  getIndicatorValues(alias: string): number[] | null {
    return this.indicatorDataFrame.getIndicator(alias);
  }

  /**
   * Check if indicator is ready
   */
  isIndicatorReady(alias: string): boolean {
    const indicator = this.indicators.get(alias);
    if (!indicator) return false;
    
    try {
      return indicator.getStatus() === 'READY' || indicator.getStatus() === 'COMPLETED';
    } catch {
      return this.indicatorDataFrame.isReady(alias);
    }
  }

  /**
   * Get the underlying IndicatorDataFrame
   */
  getIndicatorDataFrame(): IndicatorDataFrame {
    return this.indicatorDataFrame;
  }

  /**
   * Get raw indicator instance
   */
  getIndicator(alias: string): any {
    return this.indicators.get(alias);
  }

  /**
   * Get all indicator aliases
   */
  getIndicatorAliases(): string[] {
    return Array.from(this.indicators.keys());
  }

  /**
   * Get performance metrics for all indicators
   */
  getPerformanceMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    for (const [alias, data] of this.performanceMetrics) {
      metrics[alias] = { ...data };
    }
    return metrics;
  }

  /**
   * Reset all indicators and clear data
   */
  reset(): void {
    for (const indicator of this.indicators.values()) {
      try {
        indicator.reset();
      } catch (error) {
        console.warn('Failed to reset indicator:', error);
      }
    }
    
    this.indicatorDataFrame.clear();
    this.timestamps = [];
    this.performanceMetrics.clear();
  }

  /**
   * Add new indicator dynamically
   */
  addIndicator(name: string, alias: string, config: any): boolean {
    try {
      const indicator = IndicatorFactory.create(name, config);
      this.indicators.set(alias, indicator);
      return true;
    } catch (error) {
      console.error(`Failed to add indicator ${alias} (${name}):`, error);
      return false;
    }
  }

  /**
   * Remove indicator
   */
  removeIndicator(alias: string): boolean {
    const removed = this.indicators.delete(alias);
    if (removed) {
      this.indicatorDataFrame.removeIndicator(alias);
      this.performanceMetrics.delete(alias);
    }
    return removed;
  }

  /**
   * Get indicator status summary
   */
  getStatusSummary(): Record<string, string> {
    const summary: Record<string, string> = {};
    
    for (const [alias, indicator] of this.indicators) {
      try {
        summary[alias] = indicator.getStatus();
      } catch {
        summary[alias] = this.indicatorDataFrame.isReady(alias) ? 'READY' : 'NOT_READY';
      }
    }
    
    return summary;
  }

  /**
   * Export configuration
   */
  exportConfig(): IndicatorBridgeConfig {
    return { ...this.config };
  }
}

/**
 * Pre-configured bridge setups for common strategies
 */
export class IndicatorBridgePresets {
  /**
   * Create bridge for trend following strategy
   */
  static createTrendFollowing(): IndicatorDataFrameBridge {
    return new IndicatorDataFrameBridge({
      indicators: [
        { name: 'EMA', alias: 'ema_fast', config: CommonConfigs.EMA_12 },
        { name: 'EMA', alias: 'ema_slow', config: CommonConfigs.EMA_26 },
        { name: 'MACD', alias: 'macd', config: CommonConfigs.MACD_STANDARD },
        { name: 'RSI', alias: 'rsi', config: CommonConfigs.RSI_14 },
        { name: 'ATR', alias: 'atr', config: CommonConfigs.ATR_14 }
      ],
      maxHistorySize: 500,
      autoUpdate: true,
      monitorPerformance: true
    });
  }

  /**
   * Create bridge for mean reversion strategy
   */
  static createMeanReversion(): IndicatorDataFrameBridge {
    return new IndicatorDataFrameBridge({
      indicators: [
        { name: 'BB', alias: 'bollinger', config: CommonConfigs.BB_STANDARD },
        { name: 'RSI', alias: 'rsi', config: CommonConfigs.RSI_AGGRESSIVE },
        { name: 'SMA', alias: 'sma_20', config: CommonConfigs.SMA_20 },
        { name: 'STOCH', alias: 'stochastic', config: CommonConfigs.STOCH_14 }
      ],
      maxHistorySize: 300,
      autoUpdate: true,
      monitorPerformance: true
    });
  }

  /**
   * Create bridge for scalping strategy
   */
  static createScalping(): IndicatorDataFrameBridge {
    return new IndicatorDataFrameBridge({
      indicators: [
        { name: 'EMA', alias: 'ema_5', config: { period: 5 } },
        { name: 'EMA', alias: 'ema_13', config: { period: 13 } },
        { name: 'RSI', alias: 'rsi_fast', config: { period: 7 } },
        { name: 'BB', alias: 'bb_fast', config: { period: 10, stdDevMultiplier: 2.0 } }
      ],
      maxHistorySize: 200,
      autoUpdate: true,
      monitorPerformance: true
    });
  }

  /**
   * Create comprehensive analysis bridge
   */
  static createComprehensive(): IndicatorDataFrameBridge {
    return new IndicatorDataFrameBridge({
      indicators: [
        // Trend indicators
        { name: 'SMA', alias: 'sma_20', config: CommonConfigs.SMA_20 },
        { name: 'SMA', alias: 'sma_50', config: CommonConfigs.SMA_50 },
        { name: 'EMA', alias: 'ema_12', config: CommonConfigs.EMA_12 },
        { name: 'EMA', alias: 'ema_26', config: CommonConfigs.EMA_26 },
        { name: 'MACD', alias: 'macd', config: CommonConfigs.MACD_STANDARD },
        
        // Momentum indicators
        { name: 'RSI', alias: 'rsi', config: CommonConfigs.RSI_14 },
        { name: 'STOCH', alias: 'stochastic', config: CommonConfigs.STOCH_14 },
        
        // Volatility indicators
        { name: 'BB', alias: 'bollinger', config: CommonConfigs.BB_STANDARD },
        { name: 'ATR', alias: 'atr', config: CommonConfigs.ATR_14 }
      ],
      maxHistorySize: 1000,
      autoUpdate: true,
      monitorPerformance: true
    });
  }
}

/**
 * Utility functions for indicator bridge management
 */
export class IndicatorBridgeUtils {
  /**
   * Create bridge from strategy configuration
   */
  static fromStrategyConfig(strategyConfig: any): IndicatorDataFrameBridge {
    const indicators = strategyConfig.indicators?.map((config: any) => ({
      name: config.type,
      alias: config.name || config.type.toLowerCase(),
      config: config.parameters || {}
    })) || [];

    return new IndicatorDataFrameBridge({
      indicators,
      maxHistorySize: strategyConfig.maxHistorySize || 500,
      autoUpdate: strategyConfig.autoUpdate !== false,
      monitorPerformance: strategyConfig.monitorPerformance || false
    });
  }

  /**
   * Validate bridge configuration
   */
  static validateConfig(config: IndicatorBridgeConfig): string[] {
    const errors: string[] = [];

    if (!config.indicators || config.indicators.length === 0) {
      errors.push('At least one indicator must be configured');
    }

    for (const indicator of config.indicators || []) {
      if (!indicator.name) {
        errors.push('Indicator name is required');
      }
      if (!indicator.alias) {
        errors.push('Indicator alias is required');
      }
      if (!IndicatorFactory.validateConfig(indicator.name, indicator.config)) {
        errors.push(`Invalid configuration for indicator ${indicator.name}`);
      }
    }

    return errors;
  }

  /**
   * Compare bridge performance
   */
  static comparePerformance(bridge1: IndicatorDataFrameBridge, bridge2: IndicatorDataFrameBridge): any {
    const metrics1 = bridge1.getPerformanceMetrics();
    const metrics2 = bridge2.getPerformanceMetrics();

    const comparison: any = {
      bridge1: { totalIndicators: Object.keys(metrics1).length },
      bridge2: { totalIndicators: Object.keys(metrics2).length },
      commonIndicators: []
    };

    // Compare common indicators
    for (const alias in metrics1) {
      if (metrics2[alias]) {
        comparison.commonIndicators.push({
          alias,
          bridge1AvgTime: metrics1[alias].avgTime,
          bridge2AvgTime: metrics2[alias].avgTime,
          performanceDiff: metrics2[alias].avgTime - metrics1[alias].avgTime
        });
      }
    }

    return comparison;
  }
}