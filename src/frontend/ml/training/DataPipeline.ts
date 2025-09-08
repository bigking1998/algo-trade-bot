/**
 * Data Pipeline Implementation - Training Data Management and Preparation
 * 
 * Handles automated data ingestion, preprocessing, feature engineering,
 * and data quality management for ML training pipelines.
 */

import { featureEngine } from '../features/FeatureEngine';
import { FeatureVector, FeatureConfig, DEFAULT_FEATURE_CONFIG } from '../features/types';
import { OHLCV } from '../features/types';
import { DydxCandle } from '../../../shared/types/trading';

export interface DataPipelineConfig {
  batchSize: number;
  enableCaching: boolean;
  validationSplit: number;
  shuffleData: boolean;
  normalizeFeatures: boolean;
  
  // Quality control
  minDataQualityScore: number;
  maxMissingValueRatio: number;
  outlierDetection: boolean;
  
  // Feature engineering
  featureSelection: boolean;
  dimensionalityReduction: boolean;
  dataAugmentation: boolean;
  
  // Performance
  maxCacheSize: number; // MB
  parallelProcessing: boolean;
  chunkSize: number;
}

export interface ProcessedDataset {
  samples: ProcessedSample[];
  features: FeatureVector[];
  labels: number[][];
  metadata: DatasetMetadata;
  
  // Split datasets
  trainSet: ProcessedSample[];
  validationSet: ProcessedSample[];
  testSet?: ProcessedSample[];
  
  // Quality metrics
  qualityScore: number;
  featureCount: number;
  sampleCount: number;
}

export interface ProcessedSample {
  id: string;
  features: FeatureVector;
  labels: number[];
  timestamp: Date;
  symbol: string;
  metadata: {
    dataQuality: number;
    featureCompleteness: number;
    outlierScore: number;
  };
}

export interface DatasetMetadata {
  symbol: string;
  startDate: Date;
  endDate: Date;
  sampleCount: number;
  featureCount: number;
  qualityScore: number;
  
  // Data characteristics
  missingValueRatio: number;
  outlierRatio: number;
  duplicateRatio: number;
  
  // Feature statistics
  featureStats: Record<string, {
    mean: number;
    std: number;
    min: number;
    max: number;
    nullCount: number;
  }>;
  
  // Processing info
  processingTime: number;
  cacheHit: boolean;
  augmentationApplied: boolean;
}

export interface DataIngestionOptions {
  targetVariable?: string;
  featureConfig?: FeatureConfig;
  featureSelection?: boolean;
  dataAugmentation?: boolean;
  qualityFiltering?: boolean;
  customPreprocessors?: Array<(data: any[]) => any[]>;
}

/**
 * Comprehensive data pipeline for ML training preparation
 */
export class DataPipeline {
  private config: DataPipelineConfig;
  private cache: Map<string, ProcessedDataset> = new Map();
  private processingQueue: Map<string, Promise<ProcessedDataset>> = new Map();
  
  // Statistics tracking
  private stats = {
    totalProcessed: 0,
    cacheHits: 0,
    averageProcessingTime: 0,
    qualityScoreDistribution: new Array(10).fill(0)
  };

  constructor(config: DataPipelineConfig) {
    this.config = config;
    
    // Clean cache periodically
    if (config.enableCaching) {
      setInterval(() => this.cleanCache(), 300000); // 5 minutes
    }
  }

  /**
   * Process historical market data for training
   */
  async processHistoricalData(
    rawData: (OHLCV | DydxCandle)[],
    symbol: string,
    options: DataIngestionOptions = {}
  ): Promise<ProcessedDataset> {
    const startTime = performance.now();
    console.log(`📊 Processing historical data for ${symbol}: ${rawData.length} raw samples`);
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(rawData, symbol, options);
      
      // Check cache
      if (this.config.enableCaching && this.cache.has(cacheKey)) {
        console.log('📋 Using cached processed dataset');
        this.stats.cacheHits++;
        return this.cache.get(cacheKey)!;
      }
      
      // Check if already processing
      if (this.processingQueue.has(cacheKey)) {
        console.log('⏳ Dataset already processing, waiting...');
        return await this.processingQueue.get(cacheKey)!;
      }
      
      // Start processing
      const processingPromise = this.processDataInternal(rawData, symbol, options, startTime);
      this.processingQueue.set(cacheKey, processingPromise);
      
      const result = await processingPromise;
      
      // Cache result
      if (this.config.enableCaching) {
        this.cacheDataset(cacheKey, result);
      }
      
      this.processingQueue.delete(cacheKey);
      this.updateStats(result, startTime);
      
      console.log(`✅ Data processing completed: ${result.sampleCount} samples, quality: ${result.qualityScore.toFixed(3)}`);
      return result;
      
    } catch (error) {
      console.error('❌ Data processing failed:', error);
      throw error;
    }
  }

  /**
   * Process incremental data updates
   */
  async processIncrementalData(
    newData: (OHLCV | DydxCandle)[],
    symbol: string,
    existingDatasetId?: string
  ): Promise<ProcessedDataset> {
    console.log(`📈 Processing incremental data for ${symbol}: ${newData.length} new samples`);
    
    try {
      // If we have an existing dataset, try to append efficiently
      if (existingDatasetId && this.cache.has(existingDatasetId)) {
        return await this.appendToExistingDataset(existingDatasetId, newData, symbol);
      }
      
      // Otherwise, process as new dataset
      return await this.processHistoricalData(newData, symbol);
      
    } catch (error) {
      console.error('❌ Incremental processing failed:', error);
      throw error;
    }
  }

  /**
   * Get processed data by ID or symbol
   */
  async getProcessedData(
    identifier: string
  ): Promise<{
    rawData: any[];
    symbol: string;
    startDate: Date;
    endDate: Date;
  }> {
    // This is a simplified implementation
    // In practice, this would retrieve data from cache or storage
    throw new Error('Method not implemented - would retrieve stored processed data');
  }

  /**
   * Get latest data for a symbol
   */
  async getLatestData(symbol: string, count: number): Promise<any[]> {
    // This would interface with the market data system
    // For now, return empty array as placeholder
    console.log(`📊 Retrieving latest ${count} data points for ${symbol}`);
    return [];
  }

  /**
   * Validate data quality
   */
  validateDataQuality(dataset: ProcessedDataset): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check overall quality score
    if (dataset.qualityScore < this.config.minDataQualityScore) {
      issues.push(`Low data quality score: ${dataset.qualityScore.toFixed(3)}`);
      recommendations.push('Consider data cleaning or additional preprocessing');
    }
    
    // Check missing value ratio
    if (dataset.metadata.missingValueRatio > this.config.maxMissingValueRatio) {
      issues.push(`High missing value ratio: ${(dataset.metadata.missingValueRatio * 100).toFixed(1)}%`);
      recommendations.push('Apply imputation or filter out incomplete samples');
    }
    
    // Check sample count
    if (dataset.sampleCount < 500) {
      issues.push(`Insufficient samples: ${dataset.sampleCount}`);
      recommendations.push('Collect more historical data or use data augmentation');
    }
    
    // Check feature count
    if (dataset.featureCount < 10) {
      issues.push(`Few features available: ${dataset.featureCount}`);
      recommendations.push('Enable additional feature engineering');
    }
    
    // Check duplicate ratio
    if (dataset.metadata.duplicateRatio > 0.05) {
      issues.push(`High duplicate ratio: ${(dataset.metadata.duplicateRatio * 100).toFixed(1)}%`);
      recommendations.push('Remove duplicate samples');
    }
    
    const isValid = issues.length === 0;
    
    console.log(`🔍 Data quality validation: ${isValid ? 'PASSED' : 'FAILED'} (${issues.length} issues)`);
    
    return { isValid, issues, recommendations };
  }

  /**
   * Get data pipeline statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.cacheHits / Math.max(1, this.stats.totalProcessed),
      averageQualityScore: this.calculateAverageQualityScore()
    };
  }

  /**
   * Clear cache and reset statistics
   */
  clearCache(): void {
    this.cache.clear();
    this.processingQueue.clear();
    console.log('🗑️ Data pipeline cache cleared');
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  private async processDataInternal(
    rawData: (OHLCV | DydxCandle)[],
    symbol: string,
    options: DataIngestionOptions,
    startTime: number
  ): Promise<ProcessedDataset> {
    
    // Step 1: Data validation and cleaning
    const cleanedData = await this.cleanRawData(rawData);
    console.log(`🧹 Data cleaned: ${rawData.length} → ${cleanedData.length} samples`);
    
    // Step 2: Feature engineering
    const featureConfig = options.featureConfig || DEFAULT_FEATURE_CONFIG;
    const features = await this.generateFeatures(cleanedData, featureConfig);
    console.log(`🔧 Features generated: ${features.length} feature vectors`);
    
    // Step 3: Label preparation
    const labels = this.generateLabels(cleanedData, features, options.targetVariable);
    console.log(`🏷️ Labels prepared: ${labels.length} label vectors`);
    
    // Step 4: Data quality assessment
    const qualityMetrics = this.assessDataQuality(features, labels);
    console.log(`📊 Quality assessment: ${qualityMetrics.overallScore.toFixed(3)} score`);
    
    // Step 5: Feature selection (if enabled)
    let processedFeatures = features;
    if (options.featureSelection) {
      processedFeatures = await this.performFeatureSelection(features, labels);
      console.log(`🎯 Feature selection: ${features.length} → ${processedFeatures.length} features`);
    }
    
    // Step 6: Create processed samples
    const samples = this.createProcessedSamples(
      processedFeatures,
      labels,
      symbol,
      qualityMetrics.sampleQuality
    );
    
    // Step 7: Data augmentation (if enabled)
    let augmentedSamples = samples;
    if (options.dataAugmentation) {
      augmentedSamples = await this.performDataAugmentation(samples);
      console.log(`📈 Data augmentation: ${samples.length} → ${augmentedSamples.length} samples`);
    }
    
    // Step 8: Dataset splitting
    const { trainSet, validationSet, testSet } = this.splitDataset(augmentedSamples);
    
    // Step 9: Create final dataset
    const processingTime = performance.now() - startTime;
    const metadata = this.createDatasetMetadata(
      augmentedSamples,
      symbol,
      qualityMetrics,
      processingTime,
      options.dataAugmentation || false
    );
    
    const dataset: ProcessedDataset = {
      samples: augmentedSamples,
      features: processedFeatures,
      labels,
      metadata,
      trainSet,
      validationSet,
      testSet,
      qualityScore: qualityMetrics.overallScore,
      featureCount: processedFeatures[0] ? this.countFeatures(processedFeatures[0]) : 0,
      sampleCount: augmentedSamples.length
    };
    
    return dataset;
  }

  private async cleanRawData(rawData: (OHLCV | DydxCandle)[]): Promise<OHLCV[]> {
    const cleaned: OHLCV[] = [];
    
    for (const candle of rawData) {
      // Convert to standard format
      const standardCandle: OHLCV = {
        time: typeof candle.time === 'number' ? new Date(candle.time) : candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        symbol: candle.symbol || 'UNKNOWN',
        timeframe: candle.timeframe || '1m'
      };
      
      // Basic validation
      if (this.isValidCandle(standardCandle)) {
        cleaned.push(standardCandle);
      }
    }
    
    // Sort by timestamp
    cleaned.sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : a.time.getTime();
      const timeB = typeof b.time === 'number' ? b.time : b.time.getTime();
      return timeA - timeB;
    });
    
    // Remove duplicates
    const deduplicated = this.removeDuplicates(cleaned);
    
    return deduplicated;
  }

  private isValidCandle(candle: OHLCV): boolean {
    return candle.open > 0 &&
           candle.high > 0 &&
           candle.low > 0 &&
           candle.close > 0 &&
           candle.volume >= 0 &&
           candle.high >= Math.max(candle.open, candle.close) &&
           candle.low <= Math.min(candle.open, candle.close);
  }

  private removeDuplicates(candles: OHLCV[]): OHLCV[] {
    const seen = new Set<string>();
    const unique: OHLCV[] = [];
    
    for (const candle of candles) {
      const key = `${typeof candle.time === 'number' ? candle.time : candle.time.getTime()}_${candle.symbol}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(candle);
      }
    }
    
    return unique;
  }

  private async generateFeatures(
    cleanedData: OHLCV[],
    featureConfig: FeatureConfig
  ): Promise<FeatureVector[]> {
    const features: FeatureVector[] = [];
    const windowSize = 60; // Use 60-candle windows
    
    // Process in chunks for better performance
    const chunkSize = this.config.chunkSize || 1000;
    
    for (let i = windowSize; i < cleanedData.length; i += chunkSize) {
      const endIdx = Math.min(i + chunkSize, cleanedData.length);
      const chunkPromises: Promise<FeatureVector>[] = [];
      
      for (let j = i; j < endIdx; j++) {
        if (j >= windowSize) {
          const window = cleanedData.slice(j - windowSize, j);
          const promise = featureEngine.computeFeatures(window, featureConfig);
          chunkPromises.push(promise);
        }
      }
      
      const chunkFeatures = await Promise.all(chunkPromises);
      features.push(...chunkFeatures);
    }
    
    return features;
  }

  private generateLabels(
    cleanedData: OHLCV[],
    features: FeatureVector[],
    targetVariable?: string
  ): number[][] {
    const labels: number[][] = [];
    const windowSize = 60;
    
    // Default: next period return
    if (!targetVariable || targetVariable === 'returns') {
      for (let i = 0; i < features.length; i++) {
        const currentIdx = i + windowSize;
        const nextIdx = currentIdx + 1;
        
        if (nextIdx < cleanedData.length) {
          const currentPrice = cleanedData[currentIdx].close;
          const nextPrice = cleanedData[nextIdx].close;
          const return_ = (nextPrice - currentPrice) / currentPrice;
          labels.push([return_]);
        } else {
          labels.push([0]); // Default for last sample
        }
      }
    }
    // Classification: up/down/sideways
    else if (targetVariable === 'direction') {
      for (let i = 0; i < features.length; i++) {
        const currentIdx = i + windowSize;
        const nextIdx = currentIdx + 1;
        
        if (nextIdx < cleanedData.length) {
          const currentPrice = cleanedData[currentIdx].close;
          const nextPrice = cleanedData[nextIdx].close;
          const change = (nextPrice - currentPrice) / currentPrice;
          
          // Classify: 0=down, 1=sideways, 2=up
          let direction = 1; // sideways
          if (change > 0.001) direction = 2; // up
          else if (change < -0.001) direction = 0; // down
          
          labels.push([direction]);
        } else {
          labels.push([1]); // Default sideways
        }
      }
    }
    else {
      // Custom target variable handling would go here
      throw new Error(`Unsupported target variable: ${targetVariable}`);
    }
    
    return labels;
  }

  private assessDataQuality(
    features: FeatureVector[],
    labels: number[][]
  ): {
    overallScore: number;
    sampleQuality: number[];
    featureCompleteness: number[];
    outlierScores: number[];
  } {
    const sampleQuality: number[] = [];
    const featureCompleteness: number[] = [];
    const outlierScores: number[] = [];
    
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      
      // Calculate feature completeness (non-NaN ratio)
      const allValues = this.extractAllFeatureValues(feature);
      const finiteValues = allValues.filter(v => isFinite(v));
      const completeness = finiteValues.length / Math.max(1, allValues.length);
      featureCompleteness.push(completeness);
      
      // Calculate outlier score (simplified Z-score based)
      const mean = finiteValues.reduce((sum, v) => sum + v, 0) / finiteValues.length;
      const std = Math.sqrt(
        finiteValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / finiteValues.length
      );
      const maxZScore = Math.max(...finiteValues.map(v => Math.abs((v - mean) / std)));
      const outlierScore = Math.min(1, maxZScore / 3); // Normalize to 0-1
      outlierScores.push(outlierScore);
      
      // Overall sample quality
      const quality = completeness * (1 - outlierScore * 0.5) * feature.metadata.confidence_score;
      sampleQuality.push(quality);
    }
    
    const overallScore = sampleQuality.reduce((sum, q) => sum + q, 0) / sampleQuality.length;
    
    return {
      overallScore,
      sampleQuality,
      featureCompleteness,
      outlierScores
    };
  }

  private async performFeatureSelection(
    features: FeatureVector[],
    labels: number[][]
  ): Promise<FeatureVector[]> {
    // Simplified feature selection based on variance and correlation
    console.log('🎯 Performing feature selection...');
    
    // For now, return features as-is
    // Real implementation would use statistical methods
    return features;
  }

  private async performDataAugmentation(
    samples: ProcessedSample[]
  ): Promise<ProcessedSample[]> {
    console.log('📈 Performing data augmentation...');
    
    const augmented = [...samples];
    
    // Simple augmentation: add noise to features (5% of original data)
    const augmentCount = Math.floor(samples.length * 0.05);
    
    for (let i = 0; i < augmentCount; i++) {
      const originalSample = samples[Math.floor(Math.random() * samples.length)];
      const augmentedSample = this.addNoiseToSample(originalSample, i);
      augmented.push(augmentedSample);
    }
    
    return augmented;
  }

  private addNoiseToSample(sample: ProcessedSample, index: number): ProcessedSample {
    // Create a copy with slight noise added to numerical features
    const noisyFeatures = JSON.parse(JSON.stringify(sample.features));
    
    // Add small random noise (1% of value) to numerical features
    const noiseLevel = 0.01;
    
    Object.keys(noisyFeatures.technical).forEach(key => {
      const value = noisyFeatures.technical[key];
      if (typeof value === 'number' && isFinite(value)) {
        noisyFeatures.technical[key] = value * (1 + (Math.random() - 0.5) * noiseLevel);
      }
    });
    
    Object.keys(noisyFeatures.price).forEach(key => {
      const value = noisyFeatures.price[key];
      if (typeof value === 'number' && isFinite(value)) {
        noisyFeatures.price[key] = value * (1 + (Math.random() - 0.5) * noiseLevel);
      }
    });
    
    return {
      ...sample,
      id: `${sample.id}_aug_${index}`,
      features: noisyFeatures,
      metadata: {
        ...sample.metadata,
        dataQuality: sample.metadata.dataQuality * 0.95 // Slightly lower quality for augmented
      }
    };
  }

  private createProcessedSamples(
    features: FeatureVector[],
    labels: number[][],
    symbol: string,
    qualityScores: number[]
  ): ProcessedSample[] {
    const samples: ProcessedSample[] = [];
    
    for (let i = 0; i < Math.min(features.length, labels.length); i++) {
      const sample: ProcessedSample = {
        id: `${symbol}_${i}_${Date.now()}`,
        features: features[i],
        labels: labels[i],
        timestamp: features[i].timestamp,
        symbol,
        metadata: {
          dataQuality: qualityScores[i] || 0.5,
          featureCompleteness: this.calculateFeatureCompleteness(features[i]),
          outlierScore: this.calculateOutlierScore(features[i])
        }
      };
      
      samples.push(sample);
    }
    
    return samples;
  }

  private splitDataset(samples: ProcessedSample[]): {
    trainSet: ProcessedSample[];
    validationSet: ProcessedSample[];
    testSet?: ProcessedSample[];
  } {
    const shuffled = this.config.shuffleData ? this.shuffleArray([...samples]) : [...samples];
    
    const validationSize = Math.floor(shuffled.length * this.config.validationSplit);
    const trainSize = shuffled.length - validationSize;
    
    return {
      trainSet: shuffled.slice(0, trainSize),
      validationSet: shuffled.slice(trainSize),
      testSet: undefined // Could add test split if needed
    };
  }

  private createDatasetMetadata(
    samples: ProcessedSample[],
    symbol: string,
    qualityMetrics: any,
    processingTime: number,
    augmentationApplied: boolean
  ): DatasetMetadata {
    const timestamps = samples.map(s => s.timestamp);
    const startDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const endDate = new Date(Math.max(...timestamps.map(t => t.getTime())));
    
    // Calculate feature statistics
    const featureStats: Record<string, any> = {};
    if (samples.length > 0) {
      const firstSample = samples[0];
      const allFeatureNames = this.extractAllFeatureNames(firstSample.features);
      
      for (const featureName of allFeatureNames) {
        const values = samples.map(s => this.getFeatureValue(s.features, featureName))
          .filter(v => isFinite(v));
        
        if (values.length > 0) {
          const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
          
          featureStats[featureName] = {
            mean,
            std: Math.sqrt(variance),
            min: Math.min(...values),
            max: Math.max(...values),
            nullCount: samples.length - values.length
          };
        }
      }
    }
    
    return {
      symbol,
      startDate,
      endDate,
      sampleCount: samples.length,
      featureCount: samples[0] ? this.countFeatures(samples[0].features) : 0,
      qualityScore: qualityMetrics.overallScore,
      missingValueRatio: qualityMetrics.featureCompleteness
        .reduce((sum: number, c: number) => sum + (1 - c), 0) / qualityMetrics.featureCompleteness.length,
      outlierRatio: qualityMetrics.outlierScores
        .filter((s: number) => s > 0.5).length / qualityMetrics.outlierScores.length,
      duplicateRatio: 0, // Would be calculated in real implementation
      featureStats,
      processingTime,
      cacheHit: false,
      augmentationApplied
    };
  }

  private async appendToExistingDataset(
    existingDatasetId: string,
    newData: (OHLCV | DydxCandle)[],
    symbol: string
  ): Promise<ProcessedDataset> {
    // Simplified implementation - would merge with existing dataset efficiently
    console.log(`📊 Appending ${newData.length} samples to existing dataset ${existingDatasetId}`);
    
    // For now, process as new dataset
    return await this.processHistoricalData(newData, symbol);
  }

  private extractAllFeatureValues(feature: FeatureVector): number[] {
    const values: number[] = [];
    
    Object.values(feature.technical).forEach(v => typeof v === 'number' && values.push(v));
    Object.values(feature.price).forEach(v => typeof v === 'number' && values.push(v));
    Object.values(feature.volume).forEach(v => typeof v === 'number' && values.push(v));
    Object.values(feature.market_structure).forEach(v => typeof v === 'number' && values.push(v));
    
    return values;
  }

  private extractAllFeatureNames(feature: FeatureVector): string[] {
    const names: string[] = [];
    
    Object.keys(feature.technical).forEach(k => names.push(`technical.${k}`));
    Object.keys(feature.price).forEach(k => names.push(`price.${k}`));
    Object.keys(feature.volume).forEach(k => names.push(`volume.${k}`));
    Object.keys(feature.market_structure).forEach(k => names.push(`market_structure.${k}`));
    
    return names;
  }

  private getFeatureValue(feature: FeatureVector, featureName: string): number {
    const [category, field] = featureName.split('.');
    
    switch (category) {
      case 'technical':
        return (feature.technical as any)[field] || 0;
      case 'price':
        return (feature.price as any)[field] || 0;
      case 'volume':
        return (feature.volume as any)[field] || 0;
      case 'market_structure':
        return (feature.market_structure as any)[field] || 0;
      default:
        return 0;
    }
  }

  private countFeatures(feature: FeatureVector): number {
    return Object.keys(feature.technical).length +
           Object.keys(feature.price).length +
           Object.keys(feature.volume).length +
           Object.keys(feature.market_structure).length;
  }

  private calculateFeatureCompleteness(feature: FeatureVector): number {
    const allValues = this.extractAllFeatureValues(feature);
    const finiteValues = allValues.filter(v => isFinite(v));
    return finiteValues.length / Math.max(1, allValues.length);
  }

  private calculateOutlierScore(feature: FeatureVector): number {
    // Simplified outlier detection
    const values = this.extractAllFeatureValues(feature).filter(v => isFinite(v));
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    
    const maxZScore = Math.max(...values.map(v => Math.abs((v - mean) / std)));
    return Math.min(1, maxZScore / 3); // Normalize to 0-1
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateCacheKey(
    rawData: (OHLCV | DydxCandle)[],
    symbol: string,
    options: DataIngestionOptions
  ): string {
    const dataHash = this.hashData(rawData.slice(-10)); // Last 10 samples
    const optionsHash = JSON.stringify(options);
    return `${symbol}_${dataHash}_${optionsHash}`.slice(0, 64);
  }

  private hashData(data: (OHLCV | DydxCandle)[]): string {
    return data.map(d => `${d.time}_${d.close}_${d.volume}`).join('|').slice(0, 32);
  }

  private cacheDataset(key: string, dataset: ProcessedDataset): void {
    // Check cache size limit
    if (this.cache.size >= 100) { // Max 100 cached datasets
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, dataset);
  }

  private cleanCache(): void {
    // Remove old entries (this is a simplified version)
    if (this.cache.size > 50) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 10);
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  private updateStats(result: ProcessedDataset, startTime: number): void {
    this.stats.totalProcessed++;
    
    const processingTime = performance.now() - startTime;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime) / 
      this.stats.totalProcessed;
    
    // Update quality score distribution
    const qualityBin = Math.floor(result.qualityScore * 10);
    if (qualityBin >= 0 && qualityBin < this.stats.qualityScoreDistribution.length) {
      this.stats.qualityScoreDistribution[qualityBin]++;
    }
  }

  private calculateAverageQualityScore(): number {
    const distribution = this.stats.qualityScoreDistribution;
    const totalSamples = distribution.reduce((sum, count) => sum + count, 0);
    if (totalSamples === 0) return 0;
    
    let weightedSum = 0;
    for (let i = 0; i < distribution.length; i++) {
      weightedSum += (i / 10 + 0.05) * distribution[i]; // Center of bin
    }
    
    return weightedSum / totalSamples;
  }
}