/**
 * Feature Engine Core Implementation - Task ML-002
 * 
 * Central orchestrator for feature computation pipeline with real-time
 * streaming support, caching, and comprehensive feature generation.
 */

import { 
  OHLCV, 
  FeatureConfig, 
  FeatureVector, 
  FeatureContext, 
  FeatureUpdate, 
  FeatureMetadata,
  DEFAULT_FEATURE_CONFIG 
} from './types';
import { TechnicalIndicatorEngine, PriceActionEngine, VolumeAnalysisEngine, MarketRegimeEngine } from './engines';
import { FeatureNormalizer } from './FeatureNormalizer';
import { FeatureValidator } from './FeatureValidator';
import { DydxCandle } from '../../../shared/types/trading';

/**
 * Feature computation options
 */
interface FeatureEngineOptions {
  enableCaching?: boolean;
  cacheTimeout?: number; // milliseconds
  enableNormalization?: boolean;
  enableValidation?: boolean;
  performanceTracking?: boolean;
  maxConcurrentComputations?: number;
}

/**
 * Default feature engine options
 */
const DEFAULT_ENGINE_OPTIONS: FeatureEngineOptions = {
  enableCaching: true,
  cacheTimeout: 60000, // 1 minute
  enableNormalization: true,
  enableValidation: true,
  performanceTracking: true,
  maxConcurrentComputations: 5
};

/**
 * Feature computation cache entry
 */
interface CacheEntry {
  features: FeatureVector;
  timestamp: Date;
  hash: string;
}

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  totalComputations: number;
  averageLatency: number;
  cacheHitRate: number;
  errorRate: number;
  lastComputationTime: number;
}

/**
 * Core feature engineering and computation engine
 */
export class FeatureEngine {
  private technicalIndicatorEngine: TechnicalIndicatorEngine;
  private priceActionEngine: PriceActionEngine;
  private volumeAnalysisEngine: VolumeAnalysisEngine;
  private marketRegimeEngine: MarketRegimeEngine;
  private normalizer: FeatureNormalizer;
  private validator: FeatureValidator;
  
  private options: FeatureEngineOptions;
  private featureCache: Map<string, CacheEntry> = new Map();
  private contextCache: Map<string, FeatureContext> = new Map();
  private performanceMetrics: PerformanceMetrics;
  
  // Streaming state for real-time features
  private streamingState: Map<string, {
    lastFeatures: FeatureVector;
    windowData: OHLCV[];
    lastUpdate: Date;
  }> = new Map();

  constructor(options: Partial<FeatureEngineOptions> = {}) {
    this.options = { ...DEFAULT_ENGINE_OPTIONS, ...options };
    
    // Initialize feature calculators
    this.technicalIndicatorEngine = new TechnicalIndicatorEngine();
    this.priceActionEngine = new PriceActionEngine();
    this.volumeAnalysisEngine = new VolumeAnalysisEngine();
    this.marketRegimeEngine = new MarketRegimeEngine();
    this.normalizer = new FeatureNormalizer();
    this.validator = new FeatureValidator();
    
    // Initialize performance tracking
    this.performanceMetrics = {
      totalComputations: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      errorRate: 0,
      lastComputationTime: 0
    };
    
    // Clean cache periodically
    if (this.options.enableCaching) {
      setInterval(() => this.cleanCache(), 300000); // Clean every 5 minutes
    }
  }

  /**
   * Compute comprehensive features from market data
   */
  async computeFeatures(
    marketData: OHLCV[],
    featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG
  ): Promise<FeatureVector> {
    const startTime = performance.now();
    
    try {
      // Validate input data
      if (!marketData || marketData.length === 0) {
        throw new Error('Empty market data provided');
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(marketData, featureConfig);
      
      // Check cache if enabled
      if (this.options.enableCaching) {
        const cached = this.getCachedFeatures(cacheKey);
        if (cached) {
          this.updatePerformanceMetrics(startTime, true, false);
          return cached;
        }
      }

      // Compute features
      const features = await this.computeFeaturesInternal(marketData, featureConfig);
      
      // Cache results
      if (this.options.enableCaching) {
        this.cacheFeatures(cacheKey, features);
      }

      this.updatePerformanceMetrics(startTime, false, false);
      return features;

    } catch (error) {
      this.updatePerformanceMetrics(startTime, false, true);
      console.error('[FeatureEngine] Error computing features:', error);
      throw error;
    }
  }

  /**
   * Compute streaming features for real-time updates
   */
  async computeStreamingFeatures(
    symbol: string,
    latestCandle: OHLCV,
    featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG
  ): Promise<FeatureUpdate> {
    const startTime = performance.now();
    
    try {
      // Get or create streaming state
      let state = this.streamingState.get(symbol);
      if (!state) {
        state = {
          lastFeatures: this.createEmptyFeatureVector(symbol, latestCandle.timeframe || '1m'),
          windowData: [],
          lastUpdate: new Date()
        };
        this.streamingState.set(symbol, state);
      }

      // Update window data
      state.windowData.push(latestCandle);
      
      // Maintain window size (keep last 200 candles for comprehensive analysis)
      const maxWindowSize = 200;
      if (state.windowData.length > maxWindowSize) {
        state.windowData = state.windowData.slice(-maxWindowSize);
      }

      // Compute new features
      const newFeatures = await this.computeFeaturesInternal(state.windowData, featureConfig);
      
      // Identify changed features
      const changedFeatures = this.identifyChangedFeatures(state.lastFeatures, newFeatures);
      
      // Calculate confidence based on data availability
      const confidence = Math.min(1.0, state.windowData.length / 50); // Confidence builds up to 50 candles
      
      // Update state
      state.lastFeatures = newFeatures;
      state.lastUpdate = new Date();

      const processingLatency = performance.now() - startTime;

      return {
        features: newFeatures,
        changed_features: changedFeatures,
        update_type: state.windowData.length < 50 ? 'full' : 'incremental',
        confidence,
        processing_latency_ms: processingLatency
      };

    } catch (error) {
      console.error('[FeatureEngine] Error in streaming features:', error);
      throw error;
    }
  }

  /**
   * Prepare features for ML training with historical data
   */
  async prepareTrainingFeatures(
    historicalData: OHLCV[],
    featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
    targetVariable?: number[]
  ): Promise<{
    features: FeatureVector[];
    normalized_features: Record<string, number[]>;
    quality_report: any;
    feature_importance?: any;
  }> {
    if (historicalData.length < 100) {
      throw new Error('Insufficient historical data for training preparation');
    }

    const features: FeatureVector[] = [];
    const windowSize = 50; // Rolling window for feature computation
    
    try {
      // Compute features for each time window
      for (let i = windowSize; i < historicalData.length; i++) {
        const window = historicalData.slice(i - windowSize, i);
        const featureVector = await this.computeFeaturesInternal(window, featureConfig);
        features.push(featureVector);
      }

      // Normalize features if enabled
      let normalizedFeatures: Record<string, number[]> = {};
      if (this.options.enableNormalization && features.length > 0) {
        normalizedFeatures = this.batchNormalizeFeatures(features);
      }

      // Generate quality report
      let qualityReport = null;
      if (this.options.enableValidation && features.length > 0) {
        qualityReport = this.validator.validateDataQuality(features[features.length - 1]);
      }

      // Calculate feature importance if target provided
      let featureImportance = null;
      if (targetVariable && targetVariable.length === features.length) {
        featureImportance = this.validator.calculateFeatureImportance(features, targetVariable);
      }

      return {
        features,
        normalized_features: normalizedFeatures,
        quality_report: qualityReport,
        feature_importance: featureImportance
      };

    } catch (error) {
      console.error('[FeatureEngine] Error preparing training features:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Clear all caches and reset streaming state
   */
  clearCache(): void {
    this.featureCache.clear();
    this.contextCache.clear();
    this.streamingState.clear();
    this.normalizer.clearAllStates();
  }

  /**
   * Get feature computation status
   */
  getStatus(): {
    isHealthy: boolean;
    cacheSize: number;
    activeStreams: number;
    metrics: PerformanceMetrics;
  } {
    return {
      isHealthy: this.performanceMetrics.errorRate < 0.1,
      cacheSize: this.featureCache.size,
      activeStreams: this.streamingState.size,
      metrics: this.getPerformanceMetrics()
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async computeFeaturesInternal(
    marketData: OHLCV[],
    featureConfig: FeatureConfig
  ): Promise<FeatureVector> {
    const startTime = Date.now();
    
    // Convert DydxCandle format if needed
    const ohlcvData = this.normalizeMarketData(marketData);
    
    // Initialize feature vector
    const features: FeatureVector = {
      timestamp: new Date(),
      symbol: ohlcvData[0]?.symbol || 'UNKNOWN',
      timeframe: ohlcvData[0]?.timeframe || '1m',
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

    // Compute different feature categories in parallel for performance
    const computationPromises: Promise<void>[] = [];

    // Technical indicators
    if (this.shouldComputeFeatureCategory('technical', featureConfig)) {
      computationPromises.push(
        Promise.resolve().then(() => {
          features.technical = this.technicalIndicatorEngine.calculateTechnicalFeatures(ohlcvData);
        })
      );
    }

    // Price action features
    if (this.shouldComputeFeatureCategory('price', featureConfig)) {
      computationPromises.push(
        Promise.resolve().then(() => {
          features.price = this.priceActionEngine.calculatePriceFeatures(ohlcvData);
        })
      );
    }

    // Volume features
    if (this.shouldComputeFeatureCategory('volume', featureConfig)) {
      computationPromises.push(
        Promise.resolve().then(() => {
          features.volume = this.volumeAnalysisEngine.calculateVolumeFeatures(ohlcvData);
        })
      );
    }

    // Market structure features
    if (this.shouldComputeFeatureCategory('market_structure', featureConfig)) {
      computationPromises.push(
        Promise.resolve().then(() => {
          features.market_structure = this.marketRegimeEngine.calculateMarketStructureFeatures(ohlcvData);
        })
      );
    }

    // Wait for all computations to complete
    await Promise.all(computationPromises);

    // Compute metadata
    features.metadata = this.computeFeatureMetadata(features, startTime);

    // Normalize features if enabled
    if (this.options.enableNormalization) {
      this.applyNormalization(features, featureConfig);
    }

    return features;
  }

  private normalizeMarketData(marketData: (OHLCV | DydxCandle)[]): OHLCV[] {
    return marketData.map(candle => {
      // Handle both timestamp formats
      const time = typeof candle.time === 'number' ? new Date(candle.time) : candle.time;
      
      return {
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        symbol: candle.symbol || 'UNKNOWN',
        timeframe: candle.timeframe || '1m'
      };
    });
  }

  private shouldComputeFeatureCategory(category: string, config: FeatureConfig): boolean {
    switch (category) {
      case 'technical':
        return config.technical_indicators && 
               (config.technical_indicators.trend.length > 0 ||
                config.technical_indicators.momentum.length > 0 ||
                config.technical_indicators.volatility.length > 0 ||
                config.technical_indicators.volume.length > 0);
      case 'price':
        return config.price_features && 
               (config.price_features.returns.length > 0 ||
                config.price_features.patterns ||
                config.price_features.support_resistance);
      case 'volume':
        return config.technical_indicators && config.technical_indicators.volume.length > 0;
      case 'market_structure':
        return config.market_structure && 
               (config.market_structure.regime_detection ||
                config.market_structure.trend_classification ||
                config.market_structure.volatility_regime);
      default:
        return true;
    }
  }

  private computeFeatureMetadata(features: FeatureVector, startTime: number): FeatureMetadata {
    const endTime = Date.now();
    const allFeatures = this.extractAllFeatureValues(features);
    const finiteFeatures = allFeatures.filter(v => isFinite(v));
    const missingValues = allFeatures.length - finiteFeatures.length;
    
    // Simple outlier detection (values beyond 3 standard deviations)
    const mean = finiteFeatures.reduce((sum, v) => sum + v, 0) / finiteFeatures.length;
    const std = Math.sqrt(finiteFeatures.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / finiteFeatures.length);
    const outliers = finiteFeatures.filter(v => Math.abs(v - mean) > 3 * std).length;
    
    // Data quality score based on completeness and outlier ratio
    const completeness = finiteFeatures.length / Math.max(1, allFeatures.length);
    const outlierRatio = outliers / Math.max(1, finiteFeatures.length);
    const qualityScore = completeness * (1 - Math.min(0.5, outlierRatio));
    
    return {
      computation_time_ms: endTime - startTime,
      data_quality_score: qualityScore,
      missing_values: missingValues,
      outlier_count: outliers,
      feature_count: allFeatures.length,
      confidence_score: Math.min(1, finiteFeatures.length / 50) // Build confidence with more features
    };
  }

  private applyNormalization(features: FeatureVector, config: FeatureConfig): void {
    const allFeatures = this.extractAllFeatureValues(features);
    const featureNames = this.extractAllFeatureNames(features);
    
    for (let i = 0; i < featureNames.length; i++) {
      const featureName = featureNames[i];
      const value = allFeatures[i];
      
      if (isFinite(value)) {
        const normalized = this.normalizer.streamingNormalize(
          featureName, 
          value, 
          config.normalization
        );
        
        // Update the feature value in the vector
        this.updateFeatureValue(features, featureName, normalized.normalized);
      }
    }
  }

  private extractAllFeatureValues(features: FeatureVector): number[] {
    const values: number[] = [];
    
    Object.values(features.technical).forEach(v => typeof v === 'number' && values.push(v));
    Object.values(features.price).forEach(v => typeof v === 'number' && values.push(v));
    Object.values(features.volume).forEach(v => typeof v === 'number' && values.push(v));
    Object.values(features.market_structure).forEach(v => typeof v === 'number' && values.push(v));
    
    return values;
  }

  private extractAllFeatureNames(features: FeatureVector): string[] {
    const names: string[] = [];
    
    Object.keys(features.technical).forEach(k => names.push(`technical.${k}`));
    Object.keys(features.price).forEach(k => names.push(`price.${k}`));
    Object.keys(features.volume).forEach(k => names.push(`volume.${k}`));
    Object.keys(features.market_structure).forEach(k => names.push(`market_structure.${k}`));
    
    return names;
  }

  private updateFeatureValue(features: FeatureVector, featureName: string, value: number): void {
    const [category, field] = featureName.split('.');
    
    switch (category) {
      case 'technical':
        (features.technical as any)[field] = value;
        break;
      case 'price':
        (features.price as any)[field] = value;
        break;
      case 'volume':
        (features.volume as any)[field] = value;
        break;
      case 'market_structure':
        (features.market_structure as any)[field] = value;
        break;
    }
  }

  private batchNormalizeFeatures(features: FeatureVector[]): Record<string, number[]> {
    if (features.length === 0) return {};
    
    const featureMatrix: Record<string, number[]> = {};
    const featureNames = this.extractAllFeatureNames(features[0]);
    
    // Build feature matrix
    for (const name of featureNames) {
      featureMatrix[name] = [];
      for (const featureVector of features) {
        const value = this.getFeatureValue(featureVector, name);
        featureMatrix[name].push(isFinite(value) ? value : 0);
      }
    }
    
    // Normalize each feature column
    const normalized = this.normalizer.batchNormalize(featureMatrix, { method: 'zscore' });
    
    return normalized.normalized;
  }

  private getFeatureValue(features: FeatureVector, featureName: string): number {
    const [category, field] = featureName.split('.');
    
    switch (category) {
      case 'technical':
        return (features.technical as any)[field] || 0;
      case 'price':
        return (features.price as any)[field] || 0;
      case 'volume':
        return (features.volume as any)[field] || 0;
      case 'market_structure':
        return (features.market_structure as any)[field] || 0;
      default:
        return 0;
    }
  }

  private identifyChangedFeatures(oldFeatures: FeatureVector, newFeatures: FeatureVector): string[] {
    const changed: string[] = [];
    const threshold = 1e-6; // Minimum change threshold
    
    const checkCategory = (category: string, oldValues: any, newValues: any) => {
      for (const key in newValues) {
        if (typeof newValues[key] === 'number') {
          const oldValue = oldValues[key] || 0;
          const newValue = newValues[key];
          
          if (Math.abs(newValue - oldValue) > threshold) {
            changed.push(`${category}.${key}`);
          }
        }
      }
    };
    
    checkCategory('technical', oldFeatures.technical, newFeatures.technical);
    checkCategory('price', oldFeatures.price, newFeatures.price);
    checkCategory('volume', oldFeatures.volume, newFeatures.volume);
    checkCategory('market_structure', oldFeatures.market_structure, newFeatures.market_structure);
    
    return changed;
  }

  private generateCacheKey(marketData: OHLCV[], config: FeatureConfig): string {
    // Simple hash based on data characteristics and config
    const dataHash = this.hashMarketData(marketData.slice(-10)); // Last 10 candles
    const configHash = this.hashConfig(config);
    return `${dataHash}_${configHash}`;
  }

  private hashMarketData(data: OHLCV[]): string {
    return data.map(d => `${d.time}_${d.close}_${d.volume}`).join('|').slice(0, 32);
  }

  private hashConfig(config: FeatureConfig): string {
    return JSON.stringify(config).slice(0, 32);
  }

  private getCachedFeatures(key: string): FeatureVector | null {
    const entry = this.featureCache.get(key);
    
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp.getTime();
    if (age > (this.options.cacheTimeout || 60000)) {
      this.featureCache.delete(key);
      return null;
    }
    
    return entry.features;
  }

  private cacheFeatures(key: string, features: FeatureVector): void {
    this.featureCache.set(key, {
      features,
      timestamp: new Date(),
      hash: key
    });
    
    // Limit cache size
    if (this.featureCache.size > 1000) {
      const oldest = Array.from(this.featureCache.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())[0];
      this.featureCache.delete(oldest[0]);
    }
  }

  private cleanCache(): void {
    const now = Date.now();
    const timeout = this.options.cacheTimeout || 60000;
    
    Array.from(this.featureCache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp.getTime() > timeout) {
        this.featureCache.delete(key);
      }
    });
  }

  private updatePerformanceMetrics(startTime: number, cacheHit: boolean, error: boolean): void {
    const latency = performance.now() - startTime;
    
    this.performanceMetrics.totalComputations++;
    this.performanceMetrics.lastComputationTime = latency;
    
    // Update average latency (exponential moving average)
    const alpha = 0.1;
    this.performanceMetrics.averageLatency = 
      this.performanceMetrics.averageLatency * (1 - alpha) + latency * alpha;
    
    // Update cache hit rate
    const totalRequests = this.performanceMetrics.totalComputations;
    const cacheHits = Math.round(this.performanceMetrics.cacheHitRate * totalRequests);
    this.performanceMetrics.cacheHitRate = (cacheHits + (cacheHit ? 1 : 0)) / totalRequests;
    
    // Update error rate
    const errors = Math.round(this.performanceMetrics.errorRate * totalRequests);
    this.performanceMetrics.errorRate = (errors + (error ? 1 : 0)) / totalRequests;
  }

  private createEmptyFeatureVector(symbol: string, timeframe: string): FeatureVector {
    return {
      timestamp: new Date(),
      symbol,
      timeframe,
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
  }
}

// Export singleton instance
export const featureEngine = new FeatureEngine();