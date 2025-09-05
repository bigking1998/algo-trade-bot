/**
 * Technical Indicators Library - Task BE-010
 * 
 * Comprehensive technical indicators library for algorithmic trading
 * with streaming optimization and production-ready performance.
 */

// Base classes and types
export * from './base/types.js';
export * from './base/TechnicalIndicator.js';
export * from './base/CircularBuffer.js';
export * from './base/MathUtils.js';

// Trend indicators
export * from './trend/SimpleMovingAverage.js';
export * from './trend/ExponentialMovingAverage.js';
export * from './trend/WeightedMovingAverage.js';
export * from './trend/MACD.js';

// Momentum indicators
export * from './momentum/RSI.js';

// Volatility indicators
export * from './volatility/BollingerBands.js';

// Re-export commonly used indicators for convenience
import { SimpleMovingAverage } from './trend/SimpleMovingAverage.js';
import { ExponentialMovingAverage } from './trend/ExponentialMovingAverage.js';
import { WeightedMovingAverage } from './trend/WeightedMovingAverage.js';
import { MACD } from './trend/MACD.js';
import { RSI } from './momentum/RSI.js';
import { BollingerBands } from './volatility/BollingerBands.js';

/**
 * Available indicator classes
 */
export const Indicators = {
  // Trend indicators
  SMA: SimpleMovingAverage,
  EMA: ExponentialMovingAverage,
  WMA: WeightedMovingAverage,
  MACD: MACD,
  
  // Momentum indicators
  RSI: RSI,
  
  // Volatility indicators
  BB: BollingerBands,
  BollingerBands: BollingerBands
} as const;

/**
 * Indicator factory for dynamic creation
 */
export class IndicatorFactory {
  /**
   * Create indicator by name
   */
  static create(name: string, config: any): any {
    const upperName = name.toUpperCase();
    
    switch (upperName) {
      case 'SMA':
      case 'SIMPLEMOVINGAVERAGE':
        return new SimpleMovingAverage(config);
      
      case 'EMA':
      case 'EXPONENTIALMOVINGAVERAGE':
        return new ExponentialMovingAverage(config);
      
      case 'WMA':
      case 'WEIGHTEDMOVINGAVERAGE':
        return new WeightedMovingAverage(config);
      
      case 'MACD':
        return new MACD(config);
      
      case 'RSI':
        return new RSI(config);
      
      case 'BB':
      case 'BOLLINGERBANDS':
        return new BollingerBands(config);
      
      default:
        throw new Error(`Unknown indicator: ${name}`);
    }
  }

  /**
   * Get list of available indicators
   */
  static getAvailableIndicators(): string[] {
    return [
      'SMA', 'SimpleMovingAverage',
      'EMA', 'ExponentialMovingAverage', 
      'WMA', 'WeightedMovingAverage',
      'MACD',
      'RSI',
      'BB', 'BollingerBands'
    ];
  }

  /**
   * Validate indicator configuration
   */
  static validateConfig(name: string, config: any): boolean {
    try {
      const indicator = this.create(name, config);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Common indicator configurations for quick setup
 */
export const CommonConfigs = {
  // Moving Averages
  SMA_20: { period: 20 },
  SMA_50: { period: 50 },
  SMA_200: { period: 200 },
  
  EMA_12: { period: 12 },
  EMA_26: { period: 26 },
  EMA_50: { period: 50 },
  
  WMA_14: { period: 14 },
  WMA_21: { period: 21 },
  
  // MACD variants
  MACD_STANDARD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  MACD_FAST: { fastPeriod: 8, slowPeriod: 17, signalPeriod: 6 },
  
  // RSI variants
  RSI_14: { period: 14 },
  RSI_21: { period: 21 },
  RSI_CONSERVATIVE: { period: 14, overboughtLevel: 75, oversoldLevel: 25 },
  RSI_AGGRESSIVE: { period: 14, overboughtLevel: 65, oversoldLevel: 35 },
  
  // Bollinger Bands variants
  BB_STANDARD: { period: 20, stdDevMultiplier: 2.0 },
  BB_TIGHT: { period: 20, stdDevMultiplier: 1.5 },
  BB_WIDE: { period: 20, stdDevMultiplier: 2.5 },
  BB_FAST: { period: 10, stdDevMultiplier: 2.0 }
} as const;

/**
 * Utility functions for indicator management
 */
export class IndicatorUtils {
  /**
   * Create multiple indicators from configuration
   */
  static createMultiple(configs: Array<{ name: string; config: any; alias?: string }>): Record<string, any> {
    const indicators: Record<string, any> = {};
    
    for (const { name, config, alias } of configs) {
      const key = alias || name.toLowerCase();
      indicators[key] = IndicatorFactory.create(name, config);
    }
    
    return indicators;
  }

  /**
   * Update multiple indicators with new data
   */
  static updateAll(indicators: Record<string, any>, candle: any): Record<string, any> {
    const results: Record<string, any> = {};
    
    for (const [key, indicator] of Object.entries(indicators)) {
      try {
        results[key] = indicator.update(candle);
      } catch (error) {
        console.warn(`Failed to update indicator ${key}:`, error);
        results[key] = null;
      }
    }
    
    return results;
  }

  /**
   * Calculate all indicators for historical data
   */
  static calculateAll(indicators: Record<string, any>, data: any[]): Record<string, any> {
    const results: Record<string, any> = {};
    
    for (const [key, indicator] of Object.entries(indicators)) {
      try {
        results[key] = indicator.calculate(data);
      } catch (error) {
        console.warn(`Failed to calculate indicator ${key}:`, error);
        results[key] = null;
      }
    }
    
    return results;
  }

  /**
   * Reset all indicators
   */
  static resetAll(indicators: Record<string, any>): void {
    for (const indicator of Object.values(indicators)) {
      try {
        indicator.reset();
      } catch (error) {
        console.warn('Failed to reset indicator:', error);
      }
    }
  }

  /**
   * Get status summary of all indicators
   */
  static getStatusSummary(indicators: Record<string, any>): Record<string, string> {
    const summary: Record<string, string> = {};
    
    for (const [key, indicator] of Object.entries(indicators)) {
      try {
        summary[key] = indicator.getStatus();
      } catch (error) {
        summary[key] = 'error';
      }
    }
    
    return summary;
  }

  /**
   * Get performance metrics for all indicators
   */
  static getPerformanceMetrics(indicators: Record<string, any>): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [key, indicator] of Object.entries(indicators)) {
      try {
        metrics[key] = indicator.getPerformanceMetrics();
      } catch (error) {
        metrics[key] = null;
      }
    }
    
    return metrics;
  }
}

/**
 * Example usage and common patterns
 */
export const Examples = {
  /**
   * Create a basic trend following setup
   */
  createTrendFollowing() {
    return IndicatorUtils.createMultiple([
      { name: 'EMA', config: CommonConfigs.EMA_12, alias: 'ema_fast' },
      { name: 'EMA', config: CommonConfigs.EMA_26, alias: 'ema_slow' },
      { name: 'MACD', config: CommonConfigs.MACD_STANDARD, alias: 'macd' },
      { name: 'RSI', config: CommonConfigs.RSI_14, alias: 'rsi' }
    ]);
  },

  /**
   * Create a mean reversion setup
   */
  createMeanReversion() {
    return IndicatorUtils.createMultiple([
      { name: 'BB', config: CommonConfigs.BB_STANDARD, alias: 'bb' },
      { name: 'RSI', config: CommonConfigs.RSI_AGGRESSIVE, alias: 'rsi' },
      { name: 'SMA', config: CommonConfigs.SMA_20, alias: 'sma_20' }
    ]);
  },

  /**
   * Create a scalping setup
   */
  createScalping() {
    return IndicatorUtils.createMultiple([
      { name: 'EMA', config: { period: 5 }, alias: 'ema_fast' },
      { name: 'EMA', config: { period: 13 }, alias: 'ema_slow' },
      { name: 'BB', config: CommonConfigs.BB_FAST, alias: 'bb' },
      { name: 'RSI', config: { period: 7 }, alias: 'rsi_fast' }
    ]);
  }
};

/**
 * Default export with commonly used indicators
 */
export default {
  Indicators,
  IndicatorFactory,
  CommonConfigs,
  IndicatorUtils,
  Examples
};