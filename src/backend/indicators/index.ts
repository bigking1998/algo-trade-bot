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
export * from './trend/VWAP.js';
export * from './trend/ParabolicSAR.js';

// Momentum indicators
export * from './momentum/RSI.js';
export * from './momentum/Stochastic.js';
export * from './momentum/WilliamsR.js';
export * from './momentum/CCI.js';

// Volatility indicators
export * from './volatility/BollingerBands.js';
export * from './volatility/ATR.js';
export * from './volatility/StandardDeviation.js';

// Volume indicators
export * from './volume/OBV.js';
export * from './volume/AccumulationDistribution.js';

// Support/Resistance indicators
export * from './support_resistance/PivotPoints.js';
export * from './support_resistance/FibonacciRetracement.js';

// Re-export commonly used indicators for convenience
import { SimpleMovingAverage } from './trend/SimpleMovingAverage.js';
import { ExponentialMovingAverage } from './trend/ExponentialMovingAverage.js';
import { WeightedMovingAverage } from './trend/WeightedMovingAverage.js';
import { MACD } from './trend/MACD.js';
import { VWAP } from './trend/VWAP.js';
import { ParabolicSAR } from './trend/ParabolicSAR.js';
import { RSI } from './momentum/RSI.js';
import { Stochastic } from './momentum/Stochastic.js';
import { WilliamsR } from './momentum/WilliamsR.js';
import { CCI } from './momentum/CCI.js';
import { BollingerBands } from './volatility/BollingerBands.js';
import { ATR } from './volatility/ATR.js';
import { StandardDeviation } from './volatility/StandardDeviation.js';
import { OBV } from './volume/OBV.js';
import { AccumulationDistribution } from './volume/AccumulationDistribution.js';
import { PivotPoints } from './support_resistance/PivotPoints.js';
import { FibonacciRetracement } from './support_resistance/FibonacciRetracement.js';

/**
 * Available indicator classes
 */
export const Indicators = {
  // Trend indicators
  SMA: SimpleMovingAverage,
  EMA: ExponentialMovingAverage,
  WMA: WeightedMovingAverage,
  MACD: MACD,
  VWAP: VWAP,
  ParabolicSAR: ParabolicSAR,
  PSAR: ParabolicSAR,
  
  // Momentum indicators
  RSI: RSI,
  Stochastic: Stochastic,
  STOCH: Stochastic,
  WilliamsR: WilliamsR,
  WILLR: WilliamsR,
  CCI: CCI,
  
  // Volatility indicators
  BB: BollingerBands,
  BollingerBands: BollingerBands,
  ATR: ATR,
  StandardDeviation: StandardDeviation,
  StdDev: StandardDeviation,
  
  // Volume indicators
  OBV: OBV,
  AccumulationDistribution: AccumulationDistribution,
  AD: AccumulationDistribution,
  
  // Support/Resistance indicators
  PivotPoints: PivotPoints,
  PP: PivotPoints,
  FibonacciRetracement: FibonacciRetracement,
  Fibonacci: FibonacciRetracement,
  FIB: FibonacciRetracement
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
      // Trend indicators
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
      
      case 'VWAP':
        return new VWAP(config);
      
      case 'PARABOLICSAR':
      case 'PSAR':
        return new ParabolicSAR(config);
      
      // Momentum indicators
      case 'RSI':
        return new RSI(config);
      
      case 'STOCHASTIC':
      case 'STOCH':
        return new Stochastic(config);
      
      case 'WILLIAMSR':
      case 'WILLR':
        return new WilliamsR(config);
      
      case 'CCI':
        return new CCI(config);
      
      // Volatility indicators
      case 'BB':
      case 'BOLLINGERBANDS':
        return new BollingerBands(config);
      
      case 'ATR':
        return new ATR(config);
      
      case 'STANDARDDEVIATION':
      case 'STDDEV':
        return new StandardDeviation(config);
      
      // Volume indicators
      case 'OBV':
        return new OBV(config);
      
      case 'ACCUMULATIONDISTRIBUTION':
      case 'AD':
        return new AccumulationDistribution(config);
      
      // Support/Resistance indicators
      case 'PIVOTPOINTS':
      case 'PP':
        return new PivotPoints(config);
      
      case 'FIBONACCIRETRACEMENT':
      case 'FIBONACCI':
      case 'FIB':
        return new FibonacciRetracement(config);
      
      default:
        throw new Error(`Unknown indicator: ${name}`);
    }
  }

  /**
   * Get list of available indicators
   */
  static getAvailableIndicators(): string[] {
    return [
      // Trend indicators
      'SMA', 'SimpleMovingAverage',
      'EMA', 'ExponentialMovingAverage', 
      'WMA', 'WeightedMovingAverage',
      'MACD',
      'VWAP',
      'ParabolicSAR', 'PSAR',
      
      // Momentum indicators
      'RSI',
      'Stochastic', 'STOCH',
      'WilliamsR', 'WILLR',
      'CCI',
      
      // Volatility indicators
      'BB', 'BollingerBands',
      'ATR',
      'StandardDeviation', 'StdDev',
      
      // Volume indicators
      'OBV',
      'AccumulationDistribution', 'AD',
      
      // Support/Resistance indicators
      'PivotPoints', 'PP',
      'FibonacciRetracement', 'Fibonacci', 'FIB'
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
  
  // VWAP variants
  VWAP_STANDARD: { period: 20, priceType: 'typical' },
  VWAP_SESSION: { period: 50, sessionBased: true },
  
  // Parabolic SAR variants
  PSAR_STANDARD: { accelerationFactor: 0.02, maxAcceleration: 0.2 },
  PSAR_FAST: { accelerationFactor: 0.03, maxAcceleration: 0.3 },
  
  // MACD variants
  MACD_STANDARD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  MACD_FAST: { fastPeriod: 8, slowPeriod: 17, signalPeriod: 6 },
  
  // RSI variants
  RSI_14: { period: 14 },
  RSI_21: { period: 21 },
  RSI_CONSERVATIVE: { period: 14, overboughtLevel: 75, oversoldLevel: 25 },
  RSI_AGGRESSIVE: { period: 14, overboughtLevel: 65, oversoldLevel: 35 },
  
  // Momentum indicators
  STOCH_14: { kPeriod: 14, dPeriod: 3 },
  STOCH_FAST: { kPeriod: 5, dPeriod: 3, smoothK: 1 },
  STOCH_SLOW: { kPeriod: 14, dPeriod: 3, smoothK: 3 },
  
  WILLR_14: { period: 14 },
  WILLR_FAST: { period: 7 },
  
  CCI_14: { period: 14 },
  CCI_20: { period: 20 },
  
  // Volatility indicators
  BB_STANDARD: { period: 20, stdDevMultiplier: 2.0 },
  BB_TIGHT: { period: 20, stdDevMultiplier: 1.5 },
  BB_WIDE: { period: 20, stdDevMultiplier: 2.5 },
  BB_FAST: { period: 10, stdDevMultiplier: 2.0 },
  
  ATR_14: { period: 14 },
  ATR_20: { period: 20, useEMA: true },
  
  STDDEV_20: { period: 20 },
  STDDEV_HIGH: { period: 20, priceType: 'high' },
  
  // Volume indicators
  OBV_STANDARD: { useRelative: false },
  OBV_SIGNAL: { signalPeriod: 10 },
  
  AD_STANDARD: { useRelative: false },
  AD_SIGNAL: { signalPeriod: 10 },
  
  // Support/Resistance indicators
  PP_STANDARD: { method: 'STANDARD' },
  PP_FIBONACCI: { method: 'FIBONACCI' },
  PP_CAMARILLA: { method: 'CAMARILLA' },
  
  FIB_AUTO: { swingDetectionMethod: 'AUTO', swingLookback: 20 },
  FIB_EXTENDED: { swingDetectionMethod: 'AUTO', includeExtensions: true }
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
      { name: 'RSI', config: CommonConfigs.RSI_14, alias: 'rsi' },
      { name: 'PSAR', config: CommonConfigs.PSAR_STANDARD, alias: 'psar' }
    ]);
  },

  /**
   * Create a mean reversion setup
   */
  createMeanReversion() {
    return IndicatorUtils.createMultiple([
      { name: 'BB', config: CommonConfigs.BB_STANDARD, alias: 'bb' },
      { name: 'RSI', config: CommonConfigs.RSI_AGGRESSIVE, alias: 'rsi' },
      { name: 'SMA', config: CommonConfigs.SMA_20, alias: 'sma_20' },
      { name: 'STOCH', config: CommonConfigs.STOCH_14, alias: 'stoch' },
      { name: 'WILLR', config: CommonConfigs.WILLR_14, alias: 'willr' }
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
      { name: 'RSI', config: { period: 7 }, alias: 'rsi_fast' },
      { name: 'STOCH', config: CommonConfigs.STOCH_FAST, alias: 'stoch_fast' }
    ]);
  },
  
  /**
   * Create a comprehensive analysis setup
   */
  createComprehensive() {
    return IndicatorUtils.createMultiple([
      // Trend
      { name: 'EMA', config: CommonConfigs.EMA_50, alias: 'ema_trend' },
      { name: 'VWAP', config: CommonConfigs.VWAP_STANDARD, alias: 'vwap' },
      { name: 'PSAR', config: CommonConfigs.PSAR_STANDARD, alias: 'psar' },
      
      // Momentum
      { name: 'RSI', config: CommonConfigs.RSI_14, alias: 'rsi' },
      { name: 'STOCH', config: CommonConfigs.STOCH_14, alias: 'stoch' },
      { name: 'CCI', config: CommonConfigs.CCI_20, alias: 'cci' },
      
      // Volatility
      { name: 'ATR', config: CommonConfigs.ATR_14, alias: 'atr' },
      { name: 'BB', config: CommonConfigs.BB_STANDARD, alias: 'bb' },
      
      // Volume
      { name: 'OBV', config: CommonConfigs.OBV_STANDARD, alias: 'obv' },
      
      // Support/Resistance
      { name: 'PP', config: CommonConfigs.PP_STANDARD, alias: 'pivots' }
    ]);
  },
  
  /**
   * Create a volume analysis setup
   */
  createVolumeAnalysis() {
    return IndicatorUtils.createMultiple([
      { name: 'OBV', config: CommonConfigs.OBV_SIGNAL, alias: 'obv' },
      { name: 'AD', config: CommonConfigs.AD_SIGNAL, alias: 'ad_line' },
      { name: 'VWAP', config: CommonConfigs.VWAP_SESSION, alias: 'vwap' }
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