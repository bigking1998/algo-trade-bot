/**
 * ML Performance Monitor - Task BE-027
 * 
 * Comprehensive ML model performance monitoring system with real-time metrics collection,
 * drift detection, performance degradation alerts, and automated retraining triggers.
 * 
 * Features:
 * - Real-time model performance tracking with <10ms latency
 * - Support for 10+ concurrent models monitoring
 * - Feature drift detection with statistical analysis
 * - Automated performance regression detection
 * - Integration with Prometheus metrics for monitoring
 * - A/B testing framework for model comparison
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { ModelVersionManager } from './ModelVersionManager';
import { DriftDetector } from './DriftDetector';
import { PerformanceAnalyzer } from './PerformanceAnalyzer';
import { MLMetricsCollector } from './MLMetricsCollector';
import MetricsManager from '../monitoring/MetricsManager';

export interface MLModelInfo {
  id: string;
  name: string;
  version: string;
  type: 'PRICE_PREDICTION' | 'MARKET_REGIME' | 'VOLATILITY' | 'CUSTOM';
  createdAt: Date;
  lastUpdated: Date;
  isActive: boolean;
  inputShape: number[];
  outputShape: number[];
  metadata?: Record<string, any>;
}

export interface PredictionResult {
  modelId: string;
  timestamp: Date;
  inputFeatures: number[][];
  prediction: number[];
  confidence: number;
  actualValue?: number[];
  latency: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  timestamp: Date;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  mse: number;
  mae: number;
  rmse: number;
  
  // Trading specific metrics
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  returnPredictionAccuracy?: number;
  directionalAccuracy?: number;
  
  // Operational metrics
  avgInferenceLatency: number;
  throughput: number; // predictions per second
  memoryUsage: number;
  errorRate: number;
  
  // Statistical metrics
  varianceExplained: number;
  correlationWithActual: number;
  calibrationScore: number;
  
  // Drift metrics
  featureDriftScore: number;
  labelDriftScore: number;
  conceptDriftScore: number;
  
  // Temporal metrics
  performanceTrend: number; // -1 to 1, negative means degrading
  stabilityScore: number; // 0 to 1, higher is more stable
}

export interface PerformanceAlert {
  id: string;
  modelId: string;
  type: 'ACCURACY_DROP' | 'DRIFT_DETECTED' | 'LATENCY_SPIKE' | 'ERROR_RATE_HIGH' | 'MEMORY_USAGE_HIGH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  message: string;
  threshold: number;
  currentValue: number;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface RetrainingTrigger {
  modelId: string;
  triggerType: 'PERFORMANCE_DEGRADATION' | 'DRIFT_DETECTION' | 'TIME_BASED' | 'DATA_VOLUME';
  timestamp: Date;
  reason: string;
  metrics: Record<string, number>;
  priority: number; // 1-10, 10 is highest priority
}

export interface MLPerformanceConfig {
  // Performance thresholds
  minAccuracy: number;
  minPrecision: number;
  minRecall: number;
  maxLatency: number; // milliseconds
  maxMemoryUsage: number; // MB
  maxErrorRate: number; // 0-1
  
  // Drift detection
  driftDetectionEnabled: boolean;
  driftThreshold: number;
  driftWindowSize: number;
  
  // Alert configuration
  alertThresholds: {
    accuracyDrop: number;
    latencySpike: number;
    errorRateIncrease: number;
    memoryUsageIncrease: number;
  };
  
  // Retraining triggers
  retrainingConfig: {
    performanceDegradationThreshold: number;
    driftThreshold: number;
    timeBasedIntervalHours: number;
    dataVolumeThreshold: number;
  };
  
  // Monitoring intervals
  metricsCollectionIntervalMs: number;
  performanceAnalysisIntervalMs: number;
  driftDetectionIntervalMs: number;
  
  // A/B testing
  abTestingEnabled: boolean;
  championChallengerRatio: number; // 0-1, portion of traffic for challenger
}

export interface ABTestConfig {
  id: string;
  name: string;
  championModelId: string;
  challengerModelId: string;
  trafficSplit: number; // 0-1, portion for challenger
  startDate: Date;
  endDate?: Date;
  successMetrics: string[];
  significanceLevel: number;
  minSampleSize: number;
  status: 'ACTIVE' | 'COMPLETED' | 'STOPPED';
}

export interface ABTestResult {
  testId: string;
  championMetrics: ModelPerformanceMetrics;
  challengerMetrics: ModelPerformanceMetrics;
  statisticalSignificance: number;
  winnerModelId: string;
  confidenceInterval: [number, number];
  pValue: number;
  effect_size: number;
  recommendation: 'KEEP_CHAMPION' | 'PROMOTE_CHALLENGER' | 'EXTEND_TEST';
}

/**
 * Comprehensive ML Performance Monitoring System
 */
export class MLPerformanceMonitor extends EventEmitter {
  private config: MLPerformanceConfig;
  private versionManager: ModelVersionManager;
  private driftDetector: DriftDetector;
  private performanceAnalyzer: PerformanceAnalyzer;
  private metricsCollector: MLMetricsCollector;
  private metricsManager: MetricsManager;
  
  // Model tracking
  private models: Map<string, MLModelInfo> = new Map();
  private predictions: Map<string, PredictionResult[]> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics[]> = new Map();
  
  // Alert and trigger management
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private retrainingQueue: RetrainingTrigger[] = [];
  
  // A/B testing
  private abTests: Map<string, ABTestConfig> = new Map();
  private abTestResults: Map<string, ABTestResult> = new Map();
  
  // Monitoring intervals
  private monitoringIntervals: NodeJS.Timeout[] = [];
  
  // Performance cache for fast access
  private performanceCache: Map<string, ModelPerformanceMetrics> = new Map();
  private lastUpdated: Map<string, Date> = new Map();

  constructor(config: MLPerformanceConfig) {
    super();
    this.config = config;
    
    // Initialize components
    this.versionManager = new ModelVersionManager();
    this.driftDetector = new DriftDetector({
      windowSize: config.driftWindowSize,
      threshold: config.driftThreshold
    });
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.metricsCollector = new MLMetricsCollector({
      collectionIntervalMs: config.metricsCollectionIntervalMs
    });
    this.metricsManager = MetricsManager.getInstance();
    
    // Start monitoring processes
    this.startMonitoring();
    
    console.log('🔍 ML Performance Monitor initialized');
    console.log(`📊 Monitoring configuration: ${JSON.stringify({
      models: 'unlimited',
      latency: `<${config.maxLatency}ms`,
      accuracy: `>${config.minAccuracy}`,
      drift: config.driftDetectionEnabled ? 'enabled' : 'disabled'
    }, null, 2)}`);
  }

  /**
   * Register a new ML model for monitoring
   */
  async registerModel(modelInfo: Omit<MLModelInfo, 'createdAt' | 'lastUpdated'>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const model: MLModelInfo = {
        ...modelInfo,
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      
      this.models.set(model.id, model);
      this.predictions.set(model.id, []);
      this.performanceMetrics.set(model.id, []);
      
      // Register with version manager
      await this.versionManager.registerModel(model);
      
      // Initialize performance cache
      const initialMetrics = this.createInitialMetrics(model.id);
      this.performanceCache.set(model.id, initialMetrics);
      this.lastUpdated.set(model.id, new Date());
      
      // Update Prometheus metrics
      this.metricsManager.tradingBotMlModelVersion.set(
        { model: model.name },
        parseInt(model.version.replace(/\D/g, '')) || 1
      );
      
      console.log(`✅ Model registered: ${model.name} (${model.id})`);
      console.log(`📈 Type: ${model.type}, Version: ${model.version}`);
      
      this.emit('modelRegistered', model);
      
      // Record latency
      const latency = Date.now() - startTime;
      console.log(`⏱️  Registration latency: ${latency}ms`);
      
    } catch (error) {
      console.error(`❌ Failed to register model ${modelInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Record a prediction and its performance metrics
   * Target: <10ms latency per prediction
   */
  async recordPrediction(result: PredictionResult): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!this.models.has(result.modelId)) {
        throw new Error(`Model ${result.modelId} not registered`);
      }
      
      // Store prediction with size limit
      const predictions = this.predictions.get(result.modelId)!;
      predictions.push(result);
      
      // Keep only recent predictions (sliding window)
      const maxPredictions = 10000;
      if (predictions.length > maxPredictions) {
        predictions.splice(0, predictions.length - maxPredictions);
      }
      
      // Update real-time metrics if actual value provided
      if (result.actualValue) {
        await this.updatePerformanceMetrics(result.modelId, result);
      }
      
      // Record Prometheus metrics
      this.metricsManager.updateMlModelMetrics(result.modelId, {
        inferenceDuration: result.latency / 1000,
        confidence: result.confidence,
        predictedValue: result.prediction[0]
      });
      
      if (result.actualValue) {
        this.metricsManager.updateMlModelMetrics(result.modelId, {
          actualValue: result.actualValue[0]
        });
      }
      
      // Check for immediate alerts
      this.checkPredictionAlerts(result);
      
      // Emit event for real-time updates
      this.emit('predictionRecorded', result);
      
      // Verify latency target
      const latency = Date.now() - startTime;
      if (latency > this.config.maxLatency) {
        console.warn(`⚠️  Prediction recording exceeded latency target: ${latency}ms > ${this.config.maxLatency}ms`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to record prediction for model ${result.modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get current performance metrics for a model
   */
  getModelPerformance(modelId: string): ModelPerformanceMetrics | null {
    return this.performanceCache.get(modelId) || null;
  }

  /**
   * Get performance metrics for all models
   */
  getAllModelPerformance(): Map<string, ModelPerformanceMetrics> {
    return new Map(this.performanceCache);
  }

  /**
   * Get historical performance metrics
   */
  getHistoricalPerformance(modelId: string, startDate?: Date, endDate?: Date): ModelPerformanceMetrics[] {
    const metrics = this.performanceMetrics.get(modelId) || [];
    
    if (!startDate && !endDate) {
      return [...metrics];
    }
    
    return metrics.filter(metric => {
      if (startDate && metric.timestamp < startDate) return false;
      if (endDate && metric.timestamp > endDate) return false;
      return true;
    });
  }

  /**
   * Analyze feature drift for a model
   */
  async analyzeFeatureDrift(modelId: string, recentFeatures: number[][]): Promise<{
    overallDriftScore: number;
    featureDriftScores: number[];
    driftDetected: boolean;
    significantFeatures: number[];
  }> {
    const startTime = Date.now();
    
    try {
      // Get historical features for comparison
      const predictions = this.predictions.get(modelId) || [];
      const historicalFeatures = predictions
        .slice(-this.config.driftWindowSize)
        .map(p => p.inputFeatures[0]);
      
      if (historicalFeatures.length < 10) {
        return {
          overallDriftScore: 0,
          featureDriftScores: [],
          driftDetected: false,
          significantFeatures: []
        };
      }
      
      // Analyze drift using statistical tests
      const driftAnalysis = await this.driftDetector.detectFeatureDrift(
        historicalFeatures,
        recentFeatures
      );
      
      // Update performance cache
      const currentMetrics = this.performanceCache.get(modelId);
      if (currentMetrics) {
        currentMetrics.featureDriftScore = driftAnalysis.overallDriftScore;
        currentMetrics.timestamp = new Date();
        this.performanceCache.set(modelId, currentMetrics);
      }
      
      // Update Prometheus metrics
      this.metricsManager.tradingBotMlDataDriftScore.set(
        { feature: 'overall' },
        driftAnalysis.overallDriftScore
      );
      
      // Check drift alerts
      if (driftAnalysis.driftDetected) {
        await this.triggerDriftAlert(modelId, driftAnalysis);
      }
      
      const analysisTime = Date.now() - startTime;
      console.log(`📊 Drift analysis completed in ${analysisTime}ms for model ${modelId}`);
      console.log(`🎯 Overall drift score: ${driftAnalysis.overallDriftScore.toFixed(4)}`);
      
      return driftAnalysis;
      
    } catch (error) {
      console.error(`❌ Drift analysis failed for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Start A/B test between two models
   */
  async startABTest(config: Omit<ABTestConfig, 'status'>): Promise<string> {
    try {
      const testConfig: ABTestConfig = {
        ...config,
        status: 'ACTIVE'
      };
      
      this.abTests.set(config.id, testConfig);
      
      console.log(`🧪 A/B test started: ${config.name}`);
      console.log(`👑 Champion: ${config.championModelId}`);
      console.log(`🥊 Challenger: ${config.challengerModelId}`);
      console.log(`📊 Traffic split: ${(config.trafficSplit * 100).toFixed(1)}% to challenger`);
      
      this.emit('abTestStarted', testConfig);
      return config.id;
      
    } catch (error) {
      console.error(`❌ Failed to start A/B test:`, error);
      throw error;
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<ABTestResult | null> {
    const testConfig = this.abTests.get(testId);
    if (!testConfig || testConfig.status !== 'ACTIVE') {
      return this.abTestResults.get(testId) || null;
    }
    
    try {
      // Collect performance metrics for both models
      const championMetrics = this.performanceCache.get(testConfig.championModelId);
      const challengerMetrics = this.performanceCache.get(testConfig.challengerModelId);
      
      if (!championMetrics || !challengerMetrics) {
        throw new Error('Insufficient data for A/B test analysis');
      }
      
      // Perform statistical analysis
      const result = await this.performanceAnalyzer.compareModels(
        championMetrics,
        challengerMetrics,
        {
          significanceLevel: testConfig.significanceLevel,
          metrics: testConfig.successMetrics
        }
      );
      
      const abResult: ABTestResult = {
        testId,
        championMetrics,
        challengerMetrics,
        statisticalSignificance: result.significance,
        winnerModelId: result.winnerModelId,
        confidenceInterval: result.confidenceInterval,
        pValue: result.pValue,
        effect_size: result.effectSize,
        recommendation: result.recommendation
      };
      
      this.abTestResults.set(testId, abResult);
      
      console.log(`📊 A/B test results for ${testConfig.name}:`);
      console.log(`🏆 Winner: ${result.winnerModelId}`);
      console.log(`📈 Statistical significance: ${(result.significance * 100).toFixed(2)}%`);
      console.log(`💡 Recommendation: ${result.recommendation}`);
      
      return abResult;
      
    } catch (error) {
      console.error(`❌ Failed to analyze A/B test ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get retraining triggers in queue
   */
  getRetrainingQueue(): RetrainingTrigger[] {
    return [...this.retrainingQueue].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`✅ Alert resolved: ${alert.message}`);
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Get system status and health metrics
   */
  getSystemStatus(): {
    totalModels: number;
    activeModels: number;
    activeAlerts: number;
    retrainingQueue: number;
    avgLatency: number;
    systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  } {
    const totalModels = this.models.size;
    const activeModels = Array.from(this.models.values()).filter(m => m.isActive).length;
    const activeAlerts = this.getActiveAlerts().length;
    const retrainingQueue = this.retrainingQueue.length;
    
    // Calculate average latency across all models
    const allPredictions = Array.from(this.predictions.values()).flat();
    const recentPredictions = allPredictions.slice(-1000);
    const avgLatency = recentPredictions.length > 0 
      ? recentPredictions.reduce((sum, p) => sum + p.latency, 0) / recentPredictions.length
      : 0;
    
    // Determine system health
    let systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (activeAlerts > 0) systemHealth = 'WARNING';
    if (activeAlerts >= 5 || retrainingQueue >= 3) systemHealth = 'CRITICAL';
    
    return {
      totalModels,
      activeModels,
      activeAlerts,
      retrainingQueue,
      avgLatency,
      systemHealth
    };
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  private createInitialMetrics(modelId: string): ModelPerformanceMetrics {
    return {
      modelId,
      timestamp: new Date(),
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      mse: 0,
      mae: 0,
      rmse: 0,
      avgInferenceLatency: 0,
      throughput: 0,
      memoryUsage: 0,
      errorRate: 0,
      varianceExplained: 0,
      correlationWithActual: 0,
      calibrationScore: 0,
      featureDriftScore: 0,
      labelDriftScore: 0,
      conceptDriftScore: 0,
      performanceTrend: 0,
      stabilityScore: 1
    };
  }

  private async updatePerformanceMetrics(modelId: string, prediction: PredictionResult): Promise<void> {
    try {
      const predictions = this.predictions.get(modelId)!;
      const recentPredictions = predictions.slice(-100).filter(p => p.actualValue);
      
      if (recentPredictions.length < 10) {
        return; // Need minimum samples for meaningful metrics
      }
      
      // Calculate performance metrics
      const metrics = await this.performanceAnalyzer.calculateMetrics(
        recentPredictions.map(p => p.prediction),
        recentPredictions.map(p => p.actualValue!),
        {
          includeTradeMetrics: true,
          includeStatistical: true
        }
      );
      
      const performanceMetrics: ModelPerformanceMetrics = {
        modelId,
        timestamp: new Date(),
        ...metrics,
        avgInferenceLatency: recentPredictions.reduce((sum, p) => sum + p.latency, 0) / recentPredictions.length,
        throughput: this.calculateThroughput(modelId),
        memoryUsage: this.estimateMemoryUsage(modelId),
        errorRate: this.calculateErrorRate(modelId),
        featureDriftScore: this.performanceCache.get(modelId)?.featureDriftScore || 0,
        labelDriftScore: 0, // Will be calculated by drift detector
        conceptDriftScore: 0, // Will be calculated by drift detector
        performanceTrend: this.calculatePerformanceTrend(modelId, metrics.accuracy),
        stabilityScore: this.calculateStabilityScore(modelId)
      };
      
      // Update caches
      this.performanceCache.set(modelId, performanceMetrics);
      this.lastUpdated.set(modelId, new Date());
      
      // Store historical metrics
      const historicalMetrics = this.performanceMetrics.get(modelId)!;
      historicalMetrics.push(performanceMetrics);
      
      // Keep only recent metrics (sliding window)
      const maxHistorical = 1000;
      if (historicalMetrics.length > maxHistorical) {
        historicalMetrics.splice(0, historicalMetrics.length - maxHistorical);
      }
      
      // Update Prometheus metrics
      this.metricsManager.updateMlModelMetrics(modelId, {
        accuracy: performanceMetrics.accuracy,
        trainingLoss: performanceMetrics.mse
      });
      
      // Check for performance alerts
      await this.checkPerformanceAlerts(modelId, performanceMetrics);
      
      // Emit update event
      this.emit('metricsUpdated', { modelId, metrics: performanceMetrics });
      
    } catch (error) {
      console.error(`❌ Failed to update performance metrics for model ${modelId}:`, error);
    }
  }

  private calculateThroughput(modelId: string): number {
    const predictions = this.predictions.get(modelId) || [];
    const recentPredictions = predictions.filter(
      p => Date.now() - p.timestamp.getTime() < 60000 // Last minute
    );
    return recentPredictions.length; // Predictions per minute
  }

  private estimateMemoryUsage(modelId: string): number {
    // Simplified memory estimation based on model complexity
    const model = this.models.get(modelId);
    if (!model) return 0;
    
    const inputSize = model.inputShape.reduce((a, b) => a * b, 1);
    const outputSize = model.outputShape.reduce((a, b) => a * b, 1);
    
    // Rough estimation: 4 bytes per float * parameters
    return (inputSize + outputSize) * 4 / 1024 / 1024; // MB
  }

  private calculateErrorRate(modelId: string): number {
    const predictions = this.predictions.get(modelId) || [];
    const recentPredictions = predictions.slice(-100);
    
    if (recentPredictions.length === 0) return 0;
    
    // Count predictions with very low confidence as potential errors
    const lowConfidencePredictions = recentPredictions.filter(p => p.confidence < 0.5);
    return lowConfidencePredictions.length / recentPredictions.length;
  }

  private calculatePerformanceTrend(modelId: string, currentAccuracy: number): number {
    const historicalMetrics = this.performanceMetrics.get(modelId) || [];
    if (historicalMetrics.length < 10) return 0;
    
    // Calculate trend over last 10 measurements
    const recent = historicalMetrics.slice(-10);
    const accuracies = recent.map(m => m.accuracy);
    
    // Simple linear regression slope
    const n = accuracies.length;
    const sumX = n * (n - 1) / 2; // Sum of indices
    const sumY = accuracies.reduce((a, b) => a + b, 0);
    const sumXY = accuracies.reduce((sum, acc, i) => sum + acc * i, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6; // Sum of squares
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, slope * 10));
  }

  private calculateStabilityScore(modelId: string): number {
    const historicalMetrics = this.performanceMetrics.get(modelId) || [];
    if (historicalMetrics.length < 5) return 1;
    
    // Calculate coefficient of variation for accuracy
    const accuracies = historicalMetrics.slice(-20).map(m => m.accuracy);
    const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Convert to stability score (lower CV = higher stability)
    return Math.max(0, Math.min(1, 1 - cv));
  }

  private async checkPredictionAlerts(prediction: PredictionResult): Promise<void> {
    // Check latency alert
    if (prediction.latency > this.config.alertThresholds.latencySpike) {
      await this.triggerAlert({
        modelId: prediction.modelId,
        type: 'LATENCY_SPIKE',
        severity: 'MEDIUM',
        message: `Prediction latency spike: ${prediction.latency}ms`,
        threshold: this.config.alertThresholds.latencySpike,
        currentValue: prediction.latency
      });
    }
  }

  private async checkPerformanceAlerts(modelId: string, metrics: ModelPerformanceMetrics): Promise<void> {
    // Check accuracy drop
    if (metrics.accuracy < this.config.minAccuracy - this.config.alertThresholds.accuracyDrop) {
      await this.triggerAlert({
        modelId,
        type: 'ACCURACY_DROP',
        severity: 'HIGH',
        message: `Model accuracy dropped below threshold: ${(metrics.accuracy * 100).toFixed(2)}%`,
        threshold: this.config.minAccuracy,
        currentValue: metrics.accuracy
      });
      
      // Trigger retraining
      await this.triggerRetraining(modelId, 'PERFORMANCE_DEGRADATION', {
        accuracy: metrics.accuracy,
        threshold: this.config.minAccuracy
      });
    }
    
    // Check error rate
    if (metrics.errorRate > this.config.alertThresholds.errorRateIncrease) {
      await this.triggerAlert({
        modelId,
        type: 'ERROR_RATE_HIGH',
        severity: 'HIGH',
        message: `High error rate detected: ${(metrics.errorRate * 100).toFixed(2)}%`,
        threshold: this.config.maxErrorRate,
        currentValue: metrics.errorRate
      });
    }
    
    // Check memory usage
    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsageIncrease) {
      await this.triggerAlert({
        modelId,
        type: 'MEMORY_USAGE_HIGH',
        severity: 'MEDIUM',
        message: `High memory usage: ${metrics.memoryUsage.toFixed(2)}MB`,
        threshold: this.config.maxMemoryUsage,
        currentValue: metrics.memoryUsage
      });
    }
  }

  private async triggerAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };
    
    this.activeAlerts.set(alert.id, alert);
    
    console.log(`🚨 Alert triggered: ${alert.message}`);
    console.log(`📊 Model: ${alertData.modelId}, Severity: ${alert.severity}`);
    
    this.emit('alertTriggered', alert);
  }

  private async triggerDriftAlert(modelId: string, driftAnalysis: any): Promise<void> {
    await this.triggerAlert({
      modelId,
      type: 'DRIFT_DETECTED',
      severity: 'HIGH',
      message: `Feature drift detected: score ${driftAnalysis.overallDriftScore.toFixed(4)}`,
      threshold: this.config.driftThreshold,
      currentValue: driftAnalysis.overallDriftScore,
      metadata: { significantFeatures: driftAnalysis.significantFeatures }
    });
    
    // Trigger retraining for drift
    await this.triggerRetraining(modelId, 'DRIFT_DETECTION', {
      driftScore: driftAnalysis.overallDriftScore,
      threshold: this.config.driftThreshold
    });
  }

  private async triggerRetraining(
    modelId: string, 
    triggerType: RetrainingTrigger['triggerType'],
    metrics: Record<string, number>
  ): Promise<void> {
    const trigger: RetrainingTrigger = {
      modelId,
      triggerType,
      timestamp: new Date(),
      reason: this.generateRetrainingReason(triggerType, metrics),
      metrics,
      priority: this.calculateRetrainingPriority(triggerType, metrics)
    };
    
    this.retrainingQueue.push(trigger);
    
    console.log(`🔄 Retraining triggered: ${trigger.reason}`);
    console.log(`📊 Priority: ${trigger.priority}/10, Queue size: ${this.retrainingQueue.length}`);
    
    this.emit('retrainingTriggered', trigger);
  }

  private generateRetrainingReason(triggerType: RetrainingTrigger['triggerType'], metrics: Record<string, number>): string {
    switch (triggerType) {
      case 'PERFORMANCE_DEGRADATION':
        return `Performance degraded: accuracy ${(metrics.accuracy * 100).toFixed(2)}% below threshold ${(metrics.threshold * 100).toFixed(2)}%`;
      case 'DRIFT_DETECTION':
        return `Feature drift detected: score ${metrics.driftScore.toFixed(4)} above threshold ${metrics.threshold.toFixed(4)}`;
      case 'TIME_BASED':
        return `Scheduled retraining based on time interval`;
      case 'DATA_VOLUME':
        return `New data volume threshold reached: ${metrics.newSamples} samples`;
      default:
        return 'Manual retraining trigger';
    }
  }

  private calculateRetrainingPriority(triggerType: RetrainingTrigger['triggerType'], metrics: Record<string, number>): number {
    const basePriorities = {
      'PERFORMANCE_DEGRADATION': 8,
      'DRIFT_DETECTION': 7,
      'TIME_BASED': 3,
      'DATA_VOLUME': 5
    };
    
    let priority = basePriorities[triggerType] || 5;
    
    // Adjust based on severity
    if (triggerType === 'PERFORMANCE_DEGRADATION' && metrics.accuracy < 0.5) {
      priority = 10; // Critical
    }
    if (triggerType === 'DRIFT_DETECTION' && metrics.driftScore > 0.8) {
      priority = 9; // Very high
    }
    
    return Math.min(10, Math.max(1, priority));
  }

  private startMonitoring(): void {
    // Performance analysis interval
    const performanceInterval = setInterval(async () => {
      try {
        await this.runPerformanceAnalysis();
      } catch (error) {
        console.error('❌ Performance analysis failed:', error);
      }
    }, this.config.performanceAnalysisIntervalMs);
    
    // Drift detection interval
    const driftInterval = setInterval(async () => {
      if (this.config.driftDetectionEnabled) {
        try {
          await this.runDriftAnalysis();
        } catch (error) {
          console.error('❌ Drift analysis failed:', error);
        }
      }
    }, this.config.driftDetectionIntervalMs);
    
    this.monitoringIntervals.push(performanceInterval, driftInterval);
  }

  private async runPerformanceAnalysis(): Promise<void> {
    for (const [modelId, model] of this.models.entries()) {
      if (!model.isActive) continue;
      
      try {
        // Analyze recent performance
        const recentPredictions = (this.predictions.get(modelId) || [])
          .slice(-100)
          .filter(p => p.actualValue);
        
        if (recentPredictions.length >= 10) {
          // Update performance metrics will trigger alerts if needed
          const latestPrediction = recentPredictions[recentPredictions.length - 1];
          await this.updatePerformanceMetrics(modelId, latestPrediction);
        }
      } catch (error) {
        console.error(`❌ Performance analysis failed for model ${modelId}:`, error);
      }
    }
  }

  private async runDriftAnalysis(): Promise<void> {
    for (const [modelId, model] of this.models.entries()) {
      if (!model.isActive) continue;
      
      try {
        const predictions = this.predictions.get(modelId) || [];
        const recentFeatures = predictions
          .slice(-this.config.driftWindowSize)
          .map(p => p.inputFeatures[0]);
        
        if (recentFeatures.length >= this.config.driftWindowSize / 2) {
          await this.analyzeFeatureDrift(modelId, recentFeatures);
        }
      } catch (error) {
        console.error(`❌ Drift analysis failed for model ${modelId}:`, error);
      }
    }
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    // Clear monitoring intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];
    
    // Dispose components
    this.driftDetector.dispose();
    this.performanceAnalyzer.dispose();
    this.metricsCollector.dispose();
    
    // Clear caches
    this.models.clear();
    this.predictions.clear();
    this.performanceMetrics.clear();
    this.performanceCache.clear();
    this.activeAlerts.clear();
    this.abTests.clear();
    this.abTestResults.clear();
    this.retrainingQueue.length = 0;
    
    console.log('🧹 ML Performance Monitor disposed');
  }
}

// Default configuration
export const DEFAULT_ML_PERFORMANCE_CONFIG: MLPerformanceConfig = {
  // Performance thresholds
  minAccuracy: 0.65,
  minPrecision: 0.65,
  minRecall: 0.65,
  maxLatency: 10, // milliseconds - meets requirement
  maxMemoryUsage: 100, // MB
  maxErrorRate: 0.05,
  
  // Drift detection
  driftDetectionEnabled: true,
  driftThreshold: 0.1,
  driftWindowSize: 1000,
  
  // Alert configuration
  alertThresholds: {
    accuracyDrop: 0.05,
    latencySpike: 50, // ms
    errorRateIncrease: 0.1,
    memoryUsageIncrease: 50 // MB
  },
  
  // Retraining triggers
  retrainingConfig: {
    performanceDegradationThreshold: 0.05,
    driftThreshold: 0.1,
    timeBasedIntervalHours: 24,
    dataVolumeThreshold: 1000
  },
  
  // Monitoring intervals
  metricsCollectionIntervalMs: 5000, // 5 seconds
  performanceAnalysisIntervalMs: 30000, // 30 seconds
  driftDetectionIntervalMs: 60000, // 1 minute
  
  // A/B testing
  abTestingEnabled: true,
  championChallengerRatio: 0.2
};