/**
 * Feature Engineering Module Exports - Task ML-002
 * 
 * Central export point for all feature engineering components
 * including engines, calculators, validators, and utilities.
 */

// Core engine and orchestrator
export { FeatureEngine, featureEngine } from './FeatureEngine';

// Feature calculation engines
export * from './engines';

// Utilities and validators
export { FeatureNormalizer } from './FeatureNormalizer';
export { FeatureValidator } from './FeatureValidator';

// Types and interfaces
export * from './types';

// Feature computation utilities
export const FeatureUtils = {
  /**
   * Convert DydxCandle to OHLCV format
   */
  convertToOHLCV: (candle: any) => ({
    time: typeof candle.time === 'number' ? new Date(candle.time) : candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    symbol: candle.symbol || 'UNKNOWN',
    timeframe: candle.timeframe || '1m'
  }),

  /**
   * Validate market data for feature computation
   */
  validateMarketData: (data: any[]): boolean => {
    if (!Array.isArray(data) || data.length === 0) return false;
    
    return data.every(candle => 
      candle && 
      typeof candle.open === 'number' &&
      typeof candle.high === 'number' &&
      typeof candle.low === 'number' &&
      typeof candle.close === 'number' &&
      typeof candle.volume === 'number' &&
      candle.high >= candle.low &&
      candle.high >= candle.open &&
      candle.high >= candle.close &&
      candle.low <= candle.open &&
      candle.low <= candle.close
    );
  },

  /**
   * Extract feature values as array for ML processing
   */
  extractFeatureArray: (features: any): number[] => {
    const values: number[] = [];
    
    const extractFromObject = (obj: any, prefix = '') => {
      if (!obj) return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'number' && isFinite(value)) {
          values.push(value);
        } else if (typeof value === 'object' && value !== null) {
          extractFromObject(value, `${prefix}${key}.`);
        }
      }
    };

    if (features.technical) extractFromObject(features.technical, 'technical.');
    if (features.price) extractFromObject(features.price, 'price.');
    if (features.volume) extractFromObject(features.volume, 'volume.');
    if (features.market_structure) extractFromObject(features.market_structure, 'market.');
    
    return values;
  },

  /**
   * Get feature names as array
   */
  getFeatureNames: (features: any): string[] => {
    const names: string[] = [];
    
    const extractNamesFromObject = (obj: any, prefix = '') => {
      if (!obj) return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'number') {
          names.push(`${prefix}${key}`);
        } else if (typeof value === 'object' && value !== null) {
          extractNamesFromObject(value, `${prefix}${key}.`);
        }
      }
    };

    if (features.technical) extractNamesFromObject(features.technical, 'technical.');
    if (features.price) extractNamesFromObject(features.price, 'price.');
    if (features.volume) extractNamesFromObject(features.volume, 'volume.');
    if (features.market_structure) extractNamesFromObject(features.market_structure, 'market.');
    
    return names;
  },

  /**
   * Merge multiple feature vectors (for ensemble models)
   */
  mergeFeatures: (...featureVectors: any[]): any => {
    const merged = {
      timestamp: new Date(),
      symbol: 'MERGED',
      timeframe: '1m',
      technical: {},
      price: {},
      volume: {},
      market_structure: {},
      raw_values: {},
      metadata: {
        computation_time_ms: 0,
        data_quality_score: 0,
        missing_values: 0,
        outlier_count: 0,
        feature_count: 0,
        confidence_score: 0
      }
    };

    for (const features of featureVectors) {
      if (!features) continue;

      // Use latest timestamp
      if (features.timestamp && features.timestamp > merged.timestamp) {
        merged.timestamp = features.timestamp;
        merged.symbol = features.symbol || merged.symbol;
        merged.timeframe = features.timeframe || merged.timeframe;
      }

      // Merge feature categories
      Object.assign(merged.technical, features.technical || {});
      Object.assign(merged.price, features.price || {});
      Object.assign(merged.volume, features.volume || {});
      Object.assign(merged.market_structure, features.market_structure || {});
      Object.assign(merged.raw_values, features.raw_values || {});

      // Aggregate metadata
      if (features.metadata) {
        merged.metadata.computation_time_ms += features.metadata.computation_time_ms || 0;
        merged.metadata.data_quality_score = Math.max(
          merged.metadata.data_quality_score, 
          features.metadata.data_quality_score || 0
        );
        merged.metadata.missing_values += features.metadata.missing_values || 0;
        merged.metadata.outlier_count += features.metadata.outlier_count || 0;
        merged.metadata.feature_count += features.metadata.feature_count || 0;
        merged.metadata.confidence_score = Math.min(
          merged.metadata.confidence_score || 1, 
          features.metadata.confidence_score || 0
        );
      }
    }

    return merged;
  },

  /**
   * Calculate feature statistics for analysis
   */
  calculateFeatureStats: (featureVectors: any[]): Record<string, {
    mean: number;
    std: number;
    min: number;
    max: number;
    count: number;
  }> => {
    if (featureVectors.length === 0) return {};

    const stats: Record<string, {
      values: number[];
      mean: number;
      std: number;
      min: number;
      max: number;
      count: number;
    }> = {};

    // Collect all feature values
    for (const features of featureVectors) {
      const names = FeatureUtils.getFeatureNames(features);
      const values = FeatureUtils.extractFeatureArray(features);

      for (let i = 0; i < names.length && i < values.length; i++) {
        const name = names[i];
        const value = values[i];

        if (!stats[name]) {
          stats[name] = { values: [], mean: 0, std: 0, min: Infinity, max: -Infinity, count: 0 };
        }

        stats[name].values.push(value);
        stats[name].min = Math.min(stats[name].min, value);
        stats[name].max = Math.max(stats[name].max, value);
        stats[name].count++;
      }
    }

    // Calculate statistics
    for (const name in stats) {
      const feature = stats[name];
      feature.mean = feature.values.reduce((sum, v) => sum + v, 0) / feature.count;
      feature.std = Math.sqrt(
        feature.values.reduce((sum, v) => sum + Math.pow(v - feature.mean, 2), 0) / feature.count
      );
      
      // Clean up temporary values array
      delete (feature as any).values;
    }

    return stats as any;
  }
};