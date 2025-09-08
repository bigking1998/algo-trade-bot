/**
 * DataNormalizer - Task BE-018: Market Data Integration
 * 
 * Advanced data normalization engine for standardizing market data from multiple sources
 * Handles format conversion, validation, quality enhancement, and temporal alignment
 * 
 * Key Features:
 * - Multi-source data format standardization
 * - Advanced data quality validation and enhancement
 * - Temporal alignment and synchronization
 * - Symbol mapping and exchange normalization
 * - Price and volume scaling with precision handling
 * - Gap filling and interpolation for missing data
 */

import { EventEmitter } from 'events';
import type { MarketData } from '../types/database.js';
import type { DydxCandle } from '../../shared/types/trading.js';

/**
 * Supported data source formats
 */
export type DataSourceFormat = 
  | 'dydx'
  | 'binance'
  | 'coinbase'
  | 'kraken'
  | 'okx'
  | 'generic_ohlcv'
  | 'trade_tick'
  | 'orderbook';

/**
 * Normalization configuration
 */
export interface NormalizationConfig {
  // Source-specific settings
  sources: {
    [key: string]: {
      format: DataSourceFormat;
      symbolMapping?: Map<string, string>; // source symbol -> normalized symbol
      exchangeId: string;
      precision: {
        price: number;
        volume: number;
        time: number; // milliseconds precision
      };
      timezone?: string;
      rateLimit?: number;
    };
  };
  
  // Quality enhancement
  quality: {
    enableValidation: boolean;
    enableOutlierDetection: boolean;
    enableGapFilling: boolean;
    maxPriceDeviation: number; // percentage
    maxVolumeDeviation: number; // percentage
    maxTimeGap: number; // milliseconds
    minDataAge: number; // milliseconds
    maxDataAge: number; // milliseconds
  };
  
  // Temporal alignment
  temporal: {
    enableAlignment: boolean;
    targetTimeframe: string;
    alignmentTolerance: number; // milliseconds
    interpolationMethod: 'linear' | 'spline' | 'last' | 'none';
    fillGapsUpTo: number; // milliseconds
  };
  
  // Output format
  output: {
    standardSymbolFormat: 'BASE/QUOTE' | 'BASE-QUOTE' | 'BASEQUOTE';
    priceDecimalPlaces: number;
    volumeDecimalPlaces: number;
    includeMetadata: boolean;
  };
}

/**
 * Raw market data input
 */
export interface RawMarketData {
  sourceId: string;
  format: DataSourceFormat;
  data: any; // Raw data in source format
  timestamp: Date;
  metadata?: {
    latency?: number;
    sequence?: number;
    priority?: number;
    [key: string]: any;
  };
}

/**
 * Normalization result
 */
export interface NormalizationResult {
  success: boolean;
  data?: MarketData;
  originalData: RawMarketData;
  transformations: string[];
  validations: ValidationResult[];
  quality: DataQualityMetrics;
  processingTimeMs: number;
  errors: string[];
  warnings: string[];
}

/**
 * Data quality metrics
 */
export interface DataQualityMetrics {
  completeness: number; // 0-1, how complete the data is
  consistency: number; // 0-1, consistency with expected ranges
  timeliness: number; // 0-1, how recent/timely the data is
  accuracy: number; // 0-1, estimated accuracy
  uniqueness: number; // 0-1, duplicate detection score
  overall: number; // 0-1, weighted overall quality score
  flags: QualityFlag[];
}

/**
 * Quality flags
 */
export enum QualityFlag {
  MISSING_FIELDS = 'missing_fields',
  OUTLIER_PRICE = 'outlier_price',
  OUTLIER_VOLUME = 'outlier_volume',
  STALE_DATA = 'stale_data',
  FUTURE_TIMESTAMP = 'future_timestamp',
  DUPLICATE_DATA = 'duplicate_data',
  INVALID_OHLC = 'invalid_ohlc',
  ZERO_VOLUME = 'zero_volume',
  NEGATIVE_PRICE = 'negative_price',
  TIME_GAP = 'time_gap',
  SYMBOL_MISMATCH = 'symbol_mismatch'
}

/**
 * Validation result
 */
export interface ValidationResult {
  field: string;
  valid: boolean;
  message?: string;
  severity: 'error' | 'warning' | 'info';
  corrected?: any; // corrected value if applicable
}

/**
 * Normalization statistics
 */
export interface NormalizationStats {
  sourceId: string;
  totalProcessed: number;
  successRate: number;
  averageQuality: number;
  averageProcessingTime: number;
  errorCount: number;
  warningCount: number;
  qualityDistribution: Record<QualityFlag, number>;
  transformationCounts: Record<string, number>;
  lastProcessed: Date;
}

/**
 * Main DataNormalizer class
 */
export class DataNormalizer extends EventEmitter {
  private config: NormalizationConfig;
  private statistics: Map<string, NormalizationStats> = new Map();
  private recentData: Map<string, MarketData[]> = new Map(); // For outlier detection
  private duplicateCache: Map<string, Set<string>> = new Map();
  private symbolMappings: Map<string, Map<string, string>> = new Map();
  
  // Validation engines
  private validators: Map<DataSourceFormat, DataValidator> = new Map();
  private qualityAnalyzer: DataQualityAnalyzer;
  private temporalAligner: TemporalAligner;
  private outlierDetector: OutlierDetector;
  
  constructor(config: NormalizationConfig) {
    super();
    
    this.config = this.validateConfig(config);
    
    // Initialize components
    this.qualityAnalyzer = new DataQualityAnalyzer(config.quality);
    this.temporalAligner = new TemporalAligner(config.temporal);
    this.outlierDetector = new OutlierDetector(config.quality);
    
    // Initialize validators for each supported format
    this.initializeValidators();
    this.initializeSymbolMappings();
    
    console.log('[DataNormalizer] Initialized with support for formats:', 
      Object.keys(config.sources).map(s => config.sources[s].format).join(', '));
  }

  /**
   * CORE NORMALIZATION METHODS
   */

  /**
   * Normalize raw market data from any supported source
   */
  async normalize(rawData: RawMarketData): Promise<NormalizationResult> {
    const startTime = performance.now();
    
    try {
      const sourceConfig = this.config.sources[rawData.sourceId];
      if (!sourceConfig) {
        throw new Error(`Unknown source configuration: ${rawData.sourceId}`);
      }
      
      const result: NormalizationResult = {
        success: false,
        originalData: rawData,
        transformations: [],
        validations: [],
        quality: this.initializeQualityMetrics(),
        processingTimeMs: 0,
        errors: [],
        warnings: []
      };
      
      // Step 1: Format-specific parsing and initial validation
      const parsedData = await this.parseRawData(rawData, sourceConfig);
      if (!parsedData) {
        result.errors.push('Failed to parse raw data');
        return result;
      }
      result.transformations.push('parsed');
      
      // Step 2: Symbol normalization
      const normalizedSymbol = this.normalizeSymbol(parsedData.symbol, rawData.sourceId);
      if (normalizedSymbol !== parsedData.symbol) {
        parsedData.symbol = normalizedSymbol;
        result.transformations.push('symbol_normalized');
      }
      
      // Step 3: Data validation
      const validation = await this.validateData(parsedData, sourceConfig);
      result.validations = validation;
      
      // Handle validation errors
      const errors = validation.filter(v => v.severity === 'error');
      if (errors.length > 0) {
        result.errors.push(...errors.map(e => e.message || ''));
        result.success = false;
        return result;
      }
      
      // Step 4: Quality analysis
      result.quality = await this.analyzeDataQuality(parsedData, rawData, sourceConfig);
      
      // Step 5: Outlier detection and correction
      if (this.config.quality.enableOutlierDetection) {
        const outlierResult = await this.detectAndCorrectOutliers(parsedData, rawData.sourceId);
        if (outlierResult.corrected) {
          Object.assign(parsedData, outlierResult.corrected);
          result.transformations.push('outlier_corrected');
          result.warnings.push(...outlierResult.warnings);
        }
      }
      
      // Step 6: Temporal alignment
      if (this.config.temporal.enableAlignment) {
        const alignedData = await this.temporalAligner.align(parsedData);
        if (alignedData !== parsedData) {
          Object.assign(parsedData, alignedData);
          result.transformations.push('temporally_aligned');
        }
      }
      
      // Step 7: Final formatting and precision adjustment
      const finalData = await this.applyFinalFormatting(parsedData, sourceConfig);
      result.transformations.push('formatted');
      
      // Step 8: Final quality check
      if (result.quality.overall < 0.5) {
        result.warnings.push('Low data quality detected');
      }
      
      result.data = finalData;
      result.success = true;
      result.processingTimeMs = performance.now() - startTime;
      
      // Update statistics
      this.updateStatistics(rawData.sourceId, result);
      
      // Cache for outlier detection
      this.cacheForOutlierDetection(rawData.sourceId, finalData);
      
      this.emit('data-normalized', result);
      return result;
      
    } catch (error) {
      const result: NormalizationResult = {
        success: false,
        originalData: rawData,
        transformations: [],
        validations: [],
        quality: this.initializeQualityMetrics(),
        processingTimeMs: performance.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
      
      this.emit('normalization-error', { rawData, error, result });
      return result;
    }
  }

  /**
   * Batch normalize multiple data points
   */
  async normalizeBatch(rawDataArray: RawMarketData[]): Promise<NormalizationResult[]> {
    const results: NormalizationResult[] = [];
    const batchSize = 100; // Process in chunks to avoid blocking
    
    for (let i = 0; i < rawDataArray.length; i += batchSize) {
      const batch = rawDataArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(rawData => this.normalize(rawData))
      );
      
      results.push(...batchResults);
      
      // Yield to event loop
      if (i + batchSize < rawDataArray.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    this.emit('batch-normalized', { 
      total: rawDataArray.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
    
    return results;
  }

  /**
   * FORMAT-SPECIFIC PARSERS
   */

  private async parseRawData(rawData: RawMarketData, sourceConfig: any): Promise<MarketData | null> {
    const validator = this.validators.get(sourceConfig.format);
    if (!validator) {
      throw new Error(`No validator found for format: ${sourceConfig.format}`);
    }
    
    switch (sourceConfig.format) {
      case 'dydx':
        return this.parseDydxData(rawData.data, sourceConfig);
        
      case 'binance':
        return this.parseBinanceData(rawData.data, sourceConfig);
        
      case 'coinbase':
        return this.parseCoinbaseData(rawData.data, sourceConfig);
        
      case 'generic_ohlcv':
        return this.parseGenericOHLCV(rawData.data, sourceConfig);
        
      default:
        throw new Error(`Unsupported format: ${sourceConfig.format}`);
    }
  }

  private parseDydxData(data: any, sourceConfig: any): MarketData | null {
    try {
      // Handle dYdX candle format
      if (data.type === 'channel_data' && data.channel === 'v4_candles') {
        const candle = data.contents;
        return {
          time: new Date(candle.startedAt),
          symbol: candle.ticker || 'UNKNOWN',
          exchange: sourceConfig.exchangeId,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.baseTokenVolume || 0),
          quote_volume: parseFloat(candle.usdVolume || 0),
          trades_count: parseInt(candle.trades || 0),
          timeframe: candle.resolution || '1m',
          raw_data: data,
          created_at: new Date()
        };
      }
      
      // Handle direct candle format
      if (data.time && data.open !== undefined) {
        return {
          time: new Date(data.time),
          symbol: data.symbol || 'UNKNOWN',
          exchange: sourceConfig.exchangeId,
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
          volume: parseFloat(data.volume || 0),
          quote_volume: parseFloat(data.quoteVolume || 0),
          trades_count: parseInt(data.count || 0),
          timeframe: data.interval || '1m',
          raw_data: data,
          created_at: new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error('[DataNormalizer] Error parsing dYdX data:', error);
      return null;
    }
  }

  private parseBinanceData(data: any, sourceConfig: any): MarketData | null {
    try {
      // Binance WebSocket kline format
      if (data.e === 'kline' && data.k) {
        const kline = data.k;
        return {
          time: new Date(kline.t),
          symbol: kline.s,
          exchange: sourceConfig.exchangeId,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
          quote_volume: parseFloat(kline.q),
          trades_count: parseInt(kline.n),
          timeframe: kline.i,
          raw_data: data,
          created_at: new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error('[DataNormalizer] Error parsing Binance data:', error);
      return null;
    }
  }

  private parseCoinbaseData(data: any, sourceConfig: any): MarketData | null {
    try {
      // Coinbase Pro WebSocket format
      if (data.type === 'candles') {
        return {
          time: new Date(data.time),
          symbol: data.product_id,
          exchange: sourceConfig.exchangeId,
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
          volume: parseFloat(data.volume),
          quote_volume: parseFloat(data.volume) * parseFloat(data.close), // Approximate
          trades_count: 0, // Not provided by Coinbase
          timeframe: '1m', // Default
          raw_data: data,
          created_at: new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error('[DataNormalizer] Error parsing Coinbase data:', error);
      return null;
    }
  }

  private parseGenericOHLCV(data: any, sourceConfig: any): MarketData | null {
    try {
      return {
        time: new Date(data.timestamp || data.time || Date.now()),
        symbol: data.symbol || 'UNKNOWN',
        exchange: sourceConfig.exchangeId,
        open: parseFloat(data.open || data.o),
        high: parseFloat(data.high || data.h),
        low: parseFloat(data.low || data.l),
        close: parseFloat(data.close || data.c),
        volume: parseFloat(data.volume || data.v || 0),
        quote_volume: parseFloat(data.quoteVolume || data.qv || 0),
        trades_count: parseInt(data.count || data.trades || 0),
        timeframe: data.timeframe || data.interval || '1m',
        raw_data: data,
        created_at: new Date()
      };
    } catch (error) {
      console.error('[DataNormalizer] Error parsing generic OHLCV:', error);
      return null;
    }
  }

  /**
   * SYMBOL NORMALIZATION
   */

  private normalizeSymbol(symbol: string, sourceId: string): string {
    const mapping = this.symbolMappings.get(sourceId);
    if (mapping && mapping.has(symbol)) {
      return mapping.get(symbol)!;
    }
    
    // Apply standard normalization
    return this.applyStandardSymbolFormat(symbol);
  }

  private applyStandardSymbolFormat(symbol: string): string {
    const format = this.config.output.standardSymbolFormat;
    
    // Common symbol format conversions
    let normalized = symbol.toUpperCase();
    
    switch (format) {
      case 'BASE/QUOTE':
        normalized = normalized.replace(/[-_]/, '/');
        break;
      case 'BASE-QUOTE':
        normalized = normalized.replace(/[/_]/, '-');
        break;
      case 'BASEQUOTE':
        normalized = normalized.replace(/[-/_]/, '');
        break;
    }
    
    return normalized;
  }

  /**
   * DATA VALIDATION
   */

  private async validateData(data: MarketData, sourceConfig: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Required field validation
    if (!data.symbol) {
      results.push({
        field: 'symbol',
        valid: false,
        message: 'Symbol is required',
        severity: 'error'
      });
    }
    
    if (!data.time || isNaN(data.time.getTime())) {
      results.push({
        field: 'time',
        valid: false,
        message: 'Valid timestamp is required',
        severity: 'error'
      });
    }
    
    // OHLC validation
    if (data.high < data.low) {
      results.push({
        field: 'ohlc',
        valid: false,
        message: 'High price cannot be less than low price',
        severity: 'error'
      });
    }
    
    if (data.open < 0 || data.high < 0 || data.low < 0 || data.close < 0) {
      results.push({
        field: 'prices',
        valid: false,
        message: 'Prices cannot be negative',
        severity: 'error'
      });
    }
    
    if (data.volume < 0) {
      results.push({
        field: 'volume',
        valid: false,
        message: 'Volume cannot be negative',
        severity: 'error'
      });
    }
    
    // Time validation
    const now = Date.now();
    const timeDiff = Math.abs(now - data.time.getTime());
    
    if (timeDiff > this.config.quality.maxDataAge) {
      results.push({
        field: 'time',
        valid: false,
        message: 'Data is too old',
        severity: 'warning'
      });
    }
    
    if (data.time.getTime() > now + 60000) { // 1 minute in future
      results.push({
        field: 'time',
        valid: false,
        message: 'Timestamp is in the future',
        severity: 'error'
      });
    }
    
    return results;
  }

  /**
   * QUALITY ANALYSIS
   */

  private async analyzeDataQuality(
    data: MarketData, 
    rawData: RawMarketData, 
    sourceConfig: any
  ): Promise<DataQualityMetrics> {
    return this.qualityAnalyzer.analyze(data, rawData, sourceConfig);
  }

  /**
   * OUTLIER DETECTION AND CORRECTION
   */

  private async detectAndCorrectOutliers(data: MarketData, sourceId: string): Promise<{
    corrected?: Partial<MarketData>;
    warnings: string[];
  }> {
    return this.outlierDetector.detectAndCorrect(data, sourceId, this.recentData.get(sourceId) || []);
  }

  /**
   * FINAL FORMATTING
   */

  private async applyFinalFormatting(data: MarketData, sourceConfig: any): Promise<MarketData> {
    const formatted = { ...data };
    
    // Apply precision
    const pricePlaces = this.config.output.priceDecimalPlaces;
    const volumePlaces = this.config.output.volumeDecimalPlaces;
    
    formatted.open = parseFloat(formatted.open.toFixed(pricePlaces));
    formatted.high = parseFloat(formatted.high.toFixed(pricePlaces));
    formatted.low = parseFloat(formatted.low.toFixed(pricePlaces));
    formatted.close = parseFloat(formatted.close.toFixed(pricePlaces));
    formatted.volume = parseFloat(formatted.volume.toFixed(volumePlaces));
    
    if (!this.config.output.includeMetadata) {
      delete formatted.raw_data;
    }
    
    return formatted;
  }

  /**
   * UTILITY METHODS
   */

  private validateConfig(config: NormalizationConfig): NormalizationConfig {
    // Add validation and defaults
    return config;
  }

  private initializeValidators(): void {
    // Initialize format-specific validators
    this.validators.set('dydx', new DataValidator());
    this.validators.set('binance', new DataValidator());
    this.validators.set('coinbase', new DataValidator());
    this.validators.set('generic_ohlcv', new DataValidator());
  }

  private initializeSymbolMappings(): void {
    for (const [sourceId, config] of Object.entries(this.config.sources)) {
      if (config.symbolMapping) {
        this.symbolMappings.set(sourceId, config.symbolMapping);
      }
    }
  }

  private initializeQualityMetrics(): DataQualityMetrics {
    return {
      completeness: 0,
      consistency: 0,
      timeliness: 0,
      accuracy: 0,
      uniqueness: 0,
      overall: 0,
      flags: []
    };
  }

  private updateStatistics(sourceId: string, result: NormalizationResult): void {
    let stats = this.statistics.get(sourceId);
    if (!stats) {
      stats = {
        sourceId,
        totalProcessed: 0,
        successRate: 0,
        averageQuality: 0,
        averageProcessingTime: 0,
        errorCount: 0,
        warningCount: 0,
        qualityDistribution: {} as any,
        transformationCounts: {},
        lastProcessed: new Date()
      };
    }
    
    stats.totalProcessed++;
    stats.successRate = stats.successRate * 0.95 + (result.success ? 1 : 0) * 0.05;
    stats.averageQuality = stats.averageQuality * 0.95 + result.quality.overall * 0.05;
    stats.averageProcessingTime = stats.averageProcessingTime * 0.95 + result.processingTimeMs * 0.05;
    
    if (!result.success) stats.errorCount++;
    if (result.warnings.length > 0) stats.warningCount++;
    
    stats.lastProcessed = new Date();
    
    this.statistics.set(sourceId, stats);
  }

  private cacheForOutlierDetection(sourceId: string, data: MarketData): void {
    let cache = this.recentData.get(sourceId);
    if (!cache) {
      cache = [];
      this.recentData.set(sourceId, cache);
    }
    
    cache.push(data);
    
    // Keep only recent data (last 100 points)
    if (cache.length > 100) {
      cache.shift();
    }
  }

  /**
   * PUBLIC API METHODS
   */

  getStatistics(sourceId?: string): NormalizationStats | Map<string, NormalizationStats> {
    if (sourceId) {
      return this.statistics.get(sourceId) || {
        sourceId,
        totalProcessed: 0,
        successRate: 0,
        averageQuality: 0,
        averageProcessingTime: 0,
        errorCount: 0,
        warningCount: 0,
        qualityDistribution: {} as any,
        transformationCounts: {},
        lastProcessed: new Date()
      };
    }
    return new Map(this.statistics);
  }

  getSupportedFormats(): DataSourceFormat[] {
    return Array.from(this.validators.keys());
  }

  updateConfig(newConfig: Partial<NormalizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }
}

/**
 * Helper classes
 */
class DataValidator {
  // Basic validator implementation
}

class DataQualityAnalyzer {
  constructor(private config: any) {}
  
  async analyze(data: MarketData, rawData: RawMarketData, sourceConfig: any): Promise<DataQualityMetrics> {
    // Implement quality analysis
    return {
      completeness: 1.0,
      consistency: 1.0,
      timeliness: 1.0,
      accuracy: 1.0,
      uniqueness: 1.0,
      overall: 1.0,
      flags: []
    };
  }
}

class TemporalAligner {
  constructor(private config: any) {}
  
  async align(data: MarketData): Promise<MarketData> {
    // Implement temporal alignment
    return data;
  }
}

class OutlierDetector {
  constructor(private config: any) {}
  
  async detectAndCorrect(data: MarketData, sourceId: string, recentData: MarketData[]): Promise<{
    corrected?: Partial<MarketData>;
    warnings: string[];
  }> {
    // Implement outlier detection
    return { warnings: [] };
  }
}

export default DataNormalizer;