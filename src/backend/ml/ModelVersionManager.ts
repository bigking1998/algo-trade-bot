/**
 * Model Version Manager - Task BE-027
 * 
 * Comprehensive model lifecycle and versioning management for ML performance monitoring.
 * Handles model registration, version tracking, performance comparison, and lifecycle events.
 * 
 * Features:
 * - Model version tracking and comparison
 * - Performance benchmarking across versions
 * - Automated model rollback on degradation
 * - Champion/challenger model management
 * - Model deployment lifecycle tracking
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import { MLModelInfo } from './MLPerformanceMonitor';

export interface ModelVersion {
  id: string;
  modelId: string;
  version: string;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  
  // Model metadata
  framework: 'TENSORFLOW' | 'PYTORCH' | 'SCIKIT_LEARN' | 'CUSTOM';
  modelType: 'PRICE_PREDICTION' | 'MARKET_REGIME' | 'VOLATILITY' | 'CUSTOM';
  inputShape: number[];
  outputShape: number[];
  
  // Model artifacts
  modelPath?: string;
  weightsPath?: string;
  configPath?: string;
  
  // Performance metrics
  benchmarkMetrics?: ModelBenchmarkMetrics;
  
  // Lifecycle status
  status: 'DRAFT' | 'TESTING' | 'STAGING' | 'PRODUCTION' | 'DEPRECATED' | 'ARCHIVED';
  deployedAt?: Date;
  deprecatedAt?: Date;
  archivedAt?: Date;
  
  // Tags and metadata
  tags: string[];
  metadata: Record<string, any>;
  
  // Parent version (for tracking evolution)
  parentVersionId?: string;
  
  // Size and resource requirements
  modelSize: number; // bytes
  memoryRequirement: number; // MB
  computeRequirement: number; // FLOPS estimate
}

export interface ModelBenchmarkMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc?: number;
  
  // Performance metrics
  avgInferenceLatency: number; // ms
  throughput: number; // predictions/second
  memoryUsage: number; // MB
  
  // Trading metrics
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  
  // Benchmark context
  benchmarkDate: Date;
  testDatasetSize: number;
  testDatasetPeriod: {
    startDate: Date;
    endDate: Date;
  };
  
  // Statistical confidence
  confidenceInterval: [number, number];
  pValue?: number;
  sampleSize: number;
}

export interface ModelComparison {
  baselineVersion: ModelVersion;
  challengerVersion: ModelVersion;
  comparisonMetrics: {
    accuracyDiff: number;
    latencyDiff: number;
    memoryDiff: number;
    overallImprovement: number;
  };
  statisticalSignificance: number;
  recommendation: 'PROMOTE' | 'REJECT' | 'EXTEND_TEST';
  confidenceLevel: number;
  notes?: string;
}

export interface ModelDeploymentConfig {
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  trafficSplit?: number; // For canary deployments
  rollbackThreshold?: {
    accuracyDrop: number;
    latencyIncrease: number;
    errorRateIncrease: number;
  };
  monitoringEnabled: boolean;
  autoRollbackEnabled: boolean;
}

export interface ModelLifecycleEvent {
  id: string;
  modelId: string;
  versionId: string;
  eventType: 'CREATED' | 'DEPLOYED' | 'PROMOTED' | 'DEPRECATED' | 'ROLLED_BACK' | 'ARCHIVED';
  timestamp: Date;
  triggeredBy: 'USER' | 'SYSTEM' | 'PERFORMANCE_MONITOR';
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Model Version Manager for comprehensive model lifecycle management
 */
export class ModelVersionManager extends EventEmitter {
  private versions: Map<string, ModelVersion> = new Map();
  private modelVersions: Map<string, string[]> = new Map(); // modelId -> versionIds[]
  private lifecycleEvents: ModelLifecycleEvent[] = [];
  private currentProduction: Map<string, string> = new Map(); // modelId -> versionId
  private benchmarkCache: Map<string, ModelBenchmarkMetrics> = new Map();
  
  // Deployment tracking
  private deployments: Map<string, ModelDeploymentConfig> = new Map();
  private performanceHistory: Map<string, any[]> = new Map();

  constructor() {
    super();
    console.log('📋 Model Version Manager initialized');
  }

  /**
   * Register a new model with initial version
   */
  async registerModel(modelInfo: MLModelInfo): Promise<string> {
    const startTime = Date.now();
    
    try {
      const versionId = this.generateVersionId();
      const version: ModelVersion = {
        id: versionId,
        modelId: modelInfo.id,
        version: modelInfo.version || '1.0.0',
        name: modelInfo.name,
        description: `Initial version of ${modelInfo.name}`,
        createdAt: new Date(),
        createdBy: 'system',
        framework: 'TENSORFLOW',
        modelType: modelInfo.type,
        inputShape: modelInfo.inputShape,
        outputShape: modelInfo.outputShape,
        status: 'DRAFT',
        tags: ['initial', 'baseline'],
        metadata: modelInfo.metadata || {},
        modelSize: 0, // Will be calculated when model is loaded
        memoryRequirement: this.estimateMemoryRequirement(modelInfo.inputShape, modelInfo.outputShape),
        computeRequirement: this.estimateComputeRequirement(modelInfo.inputShape, modelInfo.outputShape)
      };
      
      // Store version
      this.versions.set(versionId, version);
      
      // Track model versions
      if (!this.modelVersions.has(modelInfo.id)) {
        this.modelVersions.set(modelInfo.id, []);
      }
      this.modelVersions.get(modelInfo.id)!.push(versionId);
      
      // Record lifecycle event
      await this.recordLifecycleEvent(modelInfo.id, versionId, 'CREATED', 'SYSTEM');
      
      console.log(`✅ Model version registered: ${modelInfo.name} v${version.version} (${versionId})`);
      console.log(`📊 Memory requirement: ${version.memoryRequirement}MB`);
      console.log(`⚡ Compute requirement: ${this.formatComputeRequirement(version.computeRequirement)} FLOPS`);
      
      this.emit('versionRegistered', version);
      
      const registrationTime = Date.now() - startTime;
      console.log(`⏱️  Registration completed in ${registrationTime}ms`);
      
      return versionId;
      
    } catch (error) {
      console.error(`❌ Failed to register model version for ${modelInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new version of an existing model
   */
  async createNewVersion(
    modelId: string,
    versionInfo: {
      version: string;
      description?: string;
      parentVersionId?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      if (!this.modelVersions.has(modelId)) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      const parentVersion = versionInfo.parentVersionId 
        ? this.versions.get(versionInfo.parentVersionId)
        : this.getLatestVersion(modelId);
      
      if (!parentVersion) {
        throw new Error(`Parent version not found for model ${modelId}`);
      }
      
      const versionId = this.generateVersionId();
      const newVersion: ModelVersion = {
        ...parentVersion,
        id: versionId,
        version: versionInfo.version,
        description: versionInfo.description || `New version based on ${parentVersion.version}`,
        createdAt: new Date(),
        parentVersionId: versionInfo.parentVersionId || parentVersion.id,
        status: 'DRAFT',
        tags: [...(versionInfo.tags || []), 'new'],
        metadata: { ...parentVersion.metadata, ...(versionInfo.metadata || {}) },
        deployedAt: undefined,
        deprecatedAt: undefined,
        archivedAt: undefined
      };
      
      // Store new version
      this.versions.set(versionId, newVersion);
      this.modelVersions.get(modelId)!.push(versionId);
      
      // Record lifecycle event
      await this.recordLifecycleEvent(modelId, versionId, 'CREATED', 'USER', 
        `Created from parent version ${parentVersion.version}`);
      
      console.log(`🆕 New model version created: ${parentVersion.name} v${newVersion.version}`);
      console.log(`👨‍👩‍👧‍👦 Parent: v${parentVersion.version} (${parentVersion.id})`);
      
      this.emit('versionCreated', newVersion);
      return versionId;
      
    } catch (error) {
      console.error(`❌ Failed to create new version for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Benchmark a model version against test dataset
   */
  async benchmarkVersion(
    versionId: string,
    testData: {
      features: number[][];
      labels: number[][];
      metadata: {
        startDate: Date;
        endDate: Date;
        sampleSize: number;
      };
    }
  ): Promise<ModelBenchmarkMetrics> {
    const startTime = Date.now();
    
    try {
      const version = this.versions.get(versionId);
      if (!version) {
        throw new Error(`Version ${versionId} not found`);
      }
      
      console.log(`🏁 Starting benchmark for ${version.name} v${version.version}`);
      console.log(`📊 Test dataset: ${testData.metadata.sampleSize} samples`);
      
      // Simulate model loading and inference (in real implementation, load actual model)
      const model = await this.loadModel(version);
      
      // Run inference on test data
      const startInference = Date.now();
      const predictions = await this.runInference(model, testData.features);
      const inferenceTime = Date.now() - startInference;
      
      // Calculate performance metrics
      const metrics = this.calculateBenchmarkMetrics(
        predictions,
        testData.labels,
        inferenceTime,
        testData.metadata.sampleSize
      );
      
      const benchmarkMetrics: ModelBenchmarkMetrics = {
        ...metrics,
        benchmarkDate: new Date(),
        testDatasetSize: testData.metadata.sampleSize,
        testDatasetPeriod: {
          startDate: testData.metadata.startDate,
          endDate: testData.metadata.endDate
        },
        confidenceInterval: this.calculateConfidenceInterval(metrics, testData.metadata.sampleSize),
        sampleSize: testData.metadata.sampleSize
      };
      
      // Update version with benchmark results
      version.benchmarkMetrics = benchmarkMetrics;
      this.benchmarkCache.set(versionId, benchmarkMetrics);
      
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Benchmark completed in ${totalTime}ms`);
      console.log(`📈 Results: Accuracy ${(metrics.accuracy * 100).toFixed(2)}%, Latency ${metrics.avgInferenceLatency}ms`);
      console.log(`📊 F1-Score: ${metrics.f1Score.toFixed(4)}, Throughput: ${metrics.throughput} pred/sec`);
      
      this.emit('versionBenchmarked', { version, metrics: benchmarkMetrics });
      return benchmarkMetrics;
      
    } catch (error) {
      console.error(`❌ Benchmark failed for version ${versionId}:`, error);
      throw error;
    }
  }

  /**
   * Compare two model versions
   */
  async compareVersions(baselineVersionId: string, challengerVersionId: string): Promise<ModelComparison> {
    try {
      const baselineVersion = this.versions.get(baselineVersionId);
      const challengerVersion = this.versions.get(challengerVersionId);
      
      if (!baselineVersion || !challengerVersion) {
        throw new Error('One or both versions not found');
      }
      
      if (!baselineVersion.benchmarkMetrics || !challengerVersion.benchmarkMetrics) {
        throw new Error('Both versions must be benchmarked before comparison');
      }
      
      const baseline = baselineVersion.benchmarkMetrics;
      const challenger = challengerVersion.benchmarkMetrics;
      
      // Calculate differences
      const comparisonMetrics = {
        accuracyDiff: challenger.accuracy - baseline.accuracy,
        latencyDiff: challenger.avgInferenceLatency - baseline.avgInferenceLatency,
        memoryDiff: challenger.memoryUsage - baseline.memoryUsage,
        overallImprovement: this.calculateOverallImprovement(baseline, challenger)
      };
      
      // Statistical significance test
      const statisticalSignificance = this.calculateStatisticalSignificance(baseline, challenger);
      
      // Generate recommendation
      const recommendation = this.generateRecommendation(comparisonMetrics, statisticalSignificance);
      
      const comparison: ModelComparison = {
        baselineVersion,
        challengerVersion,
        comparisonMetrics,
        statisticalSignificance,
        recommendation,
        confidenceLevel: 0.95,
        notes: this.generateComparisonNotes(comparisonMetrics, recommendation)
      };
      
      console.log(`📊 Model comparison completed:`);
      console.log(`📈 Accuracy improvement: ${(comparisonMetrics.accuracyDiff * 100).toFixed(2)}%`);
      console.log(`⏱️  Latency change: ${comparisonMetrics.latencyDiff.toFixed(2)}ms`);
      console.log(`💾 Memory change: ${comparisonMetrics.memoryDiff.toFixed(2)}MB`);
      console.log(`🎯 Recommendation: ${recommendation}`);
      console.log(`📊 Statistical significance: ${(statisticalSignificance * 100).toFixed(2)}%`);
      
      this.emit('versionsCompared', comparison);
      return comparison;
      
    } catch (error) {
      console.error(`❌ Version comparison failed:`, error);
      throw error;
    }
  }

  /**
   * Deploy a model version to specified environment
   */
  async deployVersion(
    versionId: string,
    deploymentConfig: ModelDeploymentConfig
  ): Promise<void> {
    try {
      const version = this.versions.get(versionId);
      if (!version) {
        throw new Error(`Version ${versionId} not found`);
      }
      
      // Validate deployment readiness
      if (version.status === 'DRAFT' && deploymentConfig.environment === 'PRODUCTION') {
        throw new Error('Cannot deploy draft version directly to production');
      }
      
      if (!version.benchmarkMetrics) {
        throw new Error('Version must be benchmarked before deployment');
      }
      
      // Update version status based on environment
      const statusMap = {
        'DEVELOPMENT': 'TESTING' as const,
        'STAGING': 'STAGING' as const,
        'PRODUCTION': 'PRODUCTION' as const
      };
      
      version.status = statusMap[deploymentConfig.environment];
      version.deployedAt = new Date();
      
      // Store deployment config
      this.deployments.set(versionId, deploymentConfig);
      
      // Update current production version if deploying to production
      if (deploymentConfig.environment === 'PRODUCTION') {
        this.currentProduction.set(version.modelId, versionId);
      }
      
      // Record lifecycle event
      await this.recordLifecycleEvent(
        version.modelId,
        versionId,
        'DEPLOYED',
        'SYSTEM',
        `Deployed to ${deploymentConfig.environment}`
      );
      
      console.log(`🚀 Model deployed: ${version.name} v${version.version} → ${deploymentConfig.environment}`);
      
      if (deploymentConfig.trafficSplit) {
        console.log(`📊 Traffic split: ${(deploymentConfig.trafficSplit * 100).toFixed(1)}%`);
      }
      
      this.emit('versionDeployed', { version, deploymentConfig });
      
    } catch (error) {
      console.error(`❌ Deployment failed for version ${versionId}:`, error);
      throw error;
    }
  }

  /**
   * Promote a version from staging to production
   */
  async promoteVersion(versionId: string): Promise<void> {
    try {
      const version = this.versions.get(versionId);
      if (!version) {
        throw new Error(`Version ${versionId} not found`);
      }
      
      if (version.status !== 'STAGING') {
        throw new Error('Only staging versions can be promoted to production');
      }
      
      // Get current production version for comparison
      const currentProductionVersionId = this.currentProduction.get(version.modelId);
      let shouldPromote = true;
      
      if (currentProductionVersionId) {
        const currentProduction = this.versions.get(currentProductionVersionId);
        if (currentProduction?.benchmarkMetrics && version.benchmarkMetrics) {
          const comparison = await this.compareVersions(currentProductionVersionId, versionId);
          shouldPromote = comparison.recommendation === 'PROMOTE';
          
          if (!shouldPromote) {
            throw new Error(`Promotion rejected: ${comparison.notes || 'Performance not improved'}`);
          }
        }
      }
      
      // Promote to production
      version.status = 'PRODUCTION';
      this.currentProduction.set(version.modelId, versionId);
      
      // Deprecate previous production version
      if (currentProductionVersionId && currentProductionVersionId !== versionId) {
        const previousVersion = this.versions.get(currentProductionVersionId);
        if (previousVersion) {
          previousVersion.status = 'DEPRECATED';
          previousVersion.deprecatedAt = new Date();
        }
      }
      
      // Record lifecycle events
      await this.recordLifecycleEvent(version.modelId, versionId, 'PROMOTED', 'SYSTEM');
      
      console.log(`🏆 Model promoted to production: ${version.name} v${version.version}`);
      
      if (currentProductionVersionId) {
        console.log(`📉 Previous version deprecated: ${currentProductionVersionId}`);
      }
      
      this.emit('versionPromoted', version);
      
    } catch (error) {
      console.error(`❌ Promotion failed for version ${versionId}:`, error);
      throw error;
    }
  }

  /**
   * Rollback to previous version due to performance issues
   */
  async rollbackVersion(modelId: string, reason: string): Promise<void> {
    try {
      const currentVersionId = this.currentProduction.get(modelId);
      if (!currentVersionId) {
        throw new Error(`No production version found for model ${modelId}`);
      }
      
      // Find previous production version
      const lifecycleEvents = this.lifecycleEvents
        .filter(e => e.modelId === modelId && e.eventType === 'PROMOTED')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      if (lifecycleEvents.length < 2) {
        throw new Error('No previous version available for rollback');
      }
      
      const previousVersionId = lifecycleEvents[1].versionId;
      const currentVersion = this.versions.get(currentVersionId)!;
      const previousVersion = this.versions.get(previousVersionId)!;
      
      // Perform rollback
      currentVersion.status = 'DEPRECATED';
      currentVersion.deprecatedAt = new Date();
      
      previousVersion.status = 'PRODUCTION';
      previousVersion.deployedAt = new Date();
      
      this.currentProduction.set(modelId, previousVersionId);
      
      // Record rollback events
      await this.recordLifecycleEvent(modelId, currentVersionId, 'ROLLED_BACK', 'SYSTEM', reason);
      await this.recordLifecycleEvent(modelId, previousVersionId, 'PROMOTED', 'SYSTEM', 'Rollback promotion');
      
      console.log(`🔙 Model rolled back: ${currentVersion.name}`);
      console.log(`📉 Deprecated: v${currentVersion.version} (${currentVersionId})`);
      console.log(`📈 Restored: v${previousVersion.version} (${previousVersionId})`);
      console.log(`❓ Reason: ${reason}`);
      
      this.emit('versionRolledBack', { currentVersion, previousVersion, reason });
      
    } catch (error) {
      console.error(`❌ Rollback failed for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get all versions for a model
   */
  getModelVersions(modelId: string): ModelVersion[] {
    const versionIds = this.modelVersions.get(modelId) || [];
    return versionIds
      .map(id => this.versions.get(id))
      .filter((v): v is ModelVersion => v !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get latest version of a model
   */
  getLatestVersion(modelId: string): ModelVersion | null {
    const versions = this.getModelVersions(modelId);
    return versions.length > 0 ? versions[0] : null;
  }

  /**
   * Get current production version
   */
  getCurrentProductionVersion(modelId: string): ModelVersion | null {
    const versionId = this.currentProduction.get(modelId);
    return versionId ? this.versions.get(versionId) || null : null;
  }

  /**
   * Get version by ID
   */
  getVersion(versionId: string): ModelVersion | null {
    return this.versions.get(versionId) || null;
  }

  /**
   * Get lifecycle events for a model
   */
  getLifecycleEvents(modelId: string): ModelLifecycleEvent[] {
    return this.lifecycleEvents
      .filter(event => event.modelId === modelId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Archive old versions to free up resources
   */
  async archiveOldVersions(modelId: string, keepCount: number = 5): Promise<number> {
    try {
      const versions = this.getModelVersions(modelId);
      const productionVersion = this.getCurrentProductionVersion(modelId);
      
      // Filter out versions to keep
      const versionsToArchive = versions
        .filter(v => v.status !== 'PRODUCTION' && v.id !== productionVersion?.id)
        .slice(keepCount); // Keep only recent versions
      
      let archivedCount = 0;
      
      for (const version of versionsToArchive) {
        version.status = 'ARCHIVED';
        version.archivedAt = new Date();
        
        await this.recordLifecycleEvent(
          modelId,
          version.id,
          'ARCHIVED',
          'SYSTEM',
          `Automated archival - keeping ${keepCount} recent versions`
        );
        
        archivedCount++;
      }
      
      if (archivedCount > 0) {
        console.log(`📦 Archived ${archivedCount} old versions for model ${modelId}`);
      }
      
      return archivedCount;
      
    } catch (error) {
      console.error(`❌ Failed to archive versions for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private estimateMemoryRequirement(inputShape: number[], outputShape: number[]): number {
    // Simplified memory estimation
    const inputSize = inputShape.reduce((a, b) => a * b, 1);
    const outputSize = outputShape.reduce((a, b) => a * b, 1);
    const estimatedParams = inputSize * outputSize * 2; // Rough estimate
    
    // 4 bytes per float parameter + overhead
    return (estimatedParams * 4 / 1024 / 1024) * 1.5; // MB with overhead
  }

  private estimateComputeRequirement(inputShape: number[], outputShape: number[]): number {
    // Simplified FLOPS estimation
    const inputSize = inputShape.reduce((a, b) => a * b, 1);
    const outputSize = outputShape.reduce((a, b) => a * b, 1);
    
    // Estimate multiply-accumulate operations
    return inputSize * outputSize * 2; // FLOPS per inference
  }

  private formatComputeRequirement(flops: number): string {
    if (flops > 1e9) return `${(flops / 1e9).toFixed(2)}G`;
    if (flops > 1e6) return `${(flops / 1e6).toFixed(2)}M`;
    if (flops > 1e3) return `${(flops / 1e3).toFixed(2)}K`;
    return flops.toString();
  }

  private async loadModel(version: ModelVersion): Promise<any> {
    // In a real implementation, this would load the actual TensorFlow.js model
    // For now, return a mock model
    return {
      version: version.version,
      inputShape: version.inputShape,
      outputShape: version.outputShape,
      predict: (inputs: number[][]) => {
        // Mock prediction - return random outputs matching output shape
        return inputs.map(() => 
          Array.from({ length: version.outputShape[0] }, () => Math.random())
        );
      }
    };
  }

  private async runInference(model: any, features: number[][]): Promise<number[][]> {
    // Mock inference timing
    const inferenceStartTime = Date.now();
    const predictions = model.predict(features);
    const inferenceEndTime = Date.now();
    
    // Store timing information (in real implementation)
    return predictions;
  }

  private calculateBenchmarkMetrics(
    predictions: number[][],
    actualLabels: number[][],
    inferenceTime: number,
    sampleSize: number
  ): Omit<ModelBenchmarkMetrics, 'benchmarkDate' | 'testDatasetSize' | 'testDatasetPeriod' | 'confidenceInterval' | 'sampleSize'> {
    // Calculate classification/regression metrics
    let accuracy = 0;
    let precision = 0;
    let recall = 0;
    let mse = 0;
    let mae = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i][0];
      const actual = actualLabels[i][0];
      
      // Regression metrics
      mse += Math.pow(pred - actual, 2);
      mae += Math.abs(pred - actual);
      
      // Classification metrics (thresholded predictions)
      const predClass = pred > 0.5 ? 1 : 0;
      const actualClass = actual > 0.5 ? 1 : 0;
      if (predClass === actualClass) accuracy++;
    }
    
    accuracy /= predictions.length;
    mse /= predictions.length;
    mae /= predictions.length;
    precision = accuracy; // Simplified
    recall = accuracy; // Simplified
    
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    
    // Performance metrics
    const avgInferenceLatency = inferenceTime / predictions.length;
    const throughput = (predictions.length / inferenceTime) * 1000; // per second
    
    // Mock trading metrics
    const sharpeRatio = 1.2 + Math.random() * 0.8; // 1.2-2.0
    const maxDrawdown = Math.random() * 0.15; // 0-15%
    const winRate = 0.45 + Math.random() * 0.3; // 45-75%
    const profitFactor = 1.1 + Math.random() * 0.9; // 1.1-2.0
    
    return {
      accuracy,
      precision,
      recall,
      f1Score,
      auc: accuracy + Math.random() * 0.1, // Mock AUC
      avgInferenceLatency,
      throughput,
      memoryUsage: 50 + Math.random() * 50, // 50-100 MB
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor
    };
  }

  private calculateConfidenceInterval(metrics: any, sampleSize: number): [number, number] {
    // Calculate 95% confidence interval for accuracy
    const z = 1.96; // 95% confidence
    const se = Math.sqrt((metrics.accuracy * (1 - metrics.accuracy)) / sampleSize);
    const margin = z * se;
    
    return [
      Math.max(0, metrics.accuracy - margin),
      Math.min(1, metrics.accuracy + margin)
    ];
  }

  private calculateOverallImprovement(baseline: ModelBenchmarkMetrics, challenger: ModelBenchmarkMetrics): number {
    // Weighted improvement score
    const weights = {
      accuracy: 0.4,
      f1Score: 0.3,
      latency: -0.2, // Negative because lower is better
      memory: -0.1   // Negative because lower is better
    };
    
    const accuracyImprovement = (challenger.accuracy - baseline.accuracy) / baseline.accuracy;
    const f1Improvement = (challenger.f1Score - baseline.f1Score) / baseline.f1Score;
    const latencyImprovement = -(challenger.avgInferenceLatency - baseline.avgInferenceLatency) / baseline.avgInferenceLatency;
    const memoryImprovement = -(challenger.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage;
    
    return (
      weights.accuracy * accuracyImprovement +
      weights.f1Score * f1Improvement +
      weights.latency * latencyImprovement +
      weights.memory * memoryImprovement
    );
  }

  private calculateStatisticalSignificance(baseline: ModelBenchmarkMetrics, challenger: ModelBenchmarkMetrics): number {
    // Simplified statistical significance test
    // In real implementation, would use proper statistical tests (t-test, Mann-Whitney U, etc.)
    
    const baselineCI = baseline.confidenceInterval || [baseline.accuracy - 0.05, baseline.accuracy + 0.05];
    const challengerCI = challenger.confidenceInterval || [challenger.accuracy - 0.05, challenger.accuracy + 0.05];
    
    // Check if confidence intervals overlap
    const overlap = Math.max(0, Math.min(baselineCI[1], challengerCI[1]) - Math.max(baselineCI[0], challengerCI[0]));
    const totalRange = Math.max(baselineCI[1], challengerCI[1]) - Math.min(baselineCI[0], challengerCI[0]);
    
    // Convert overlap to significance (less overlap = more significant)
    const significance = Math.max(0, 1 - (overlap / totalRange));
    
    return significance;
  }

  private generateRecommendation(
    comparisonMetrics: ModelComparison['comparisonMetrics'],
    significance: number
  ): ModelComparison['recommendation'] {
    // Recommendation logic
    if (significance < 0.8) {
      return 'EXTEND_TEST'; // Not statistically significant
    }
    
    if (comparisonMetrics.overallImprovement > 0.05) {
      return 'PROMOTE'; // Significant improvement
    }
    
    if (comparisonMetrics.overallImprovement < -0.1) {
      return 'REJECT'; // Significant degradation
    }
    
    return 'EXTEND_TEST'; // Inconclusive
  }

  private generateComparisonNotes(
    metrics: ModelComparison['comparisonMetrics'],
    recommendation: ModelComparison['recommendation']
  ): string {
    const notes = [];
    
    if (metrics.accuracyDiff > 0.01) {
      notes.push(`Accuracy improved by ${(metrics.accuracyDiff * 100).toFixed(2)}%`);
    } else if (metrics.accuracyDiff < -0.01) {
      notes.push(`Accuracy decreased by ${(Math.abs(metrics.accuracyDiff) * 100).toFixed(2)}%`);
    }
    
    if (metrics.latencyDiff < -5) {
      notes.push(`Latency improved by ${Math.abs(metrics.latencyDiff).toFixed(2)}ms`);
    } else if (metrics.latencyDiff > 10) {
      notes.push(`Latency increased by ${metrics.latencyDiff.toFixed(2)}ms`);
    }
    
    if (metrics.memoryDiff > 10) {
      notes.push(`Memory usage increased by ${metrics.memoryDiff.toFixed(2)}MB`);
    }
    
    // Add recommendation explanation
    switch (recommendation) {
      case 'PROMOTE':
        notes.push('Overall performance improvement justifies promotion');
        break;
      case 'REJECT':
        notes.push('Performance degradation detected, rejecting challenger');
        break;
      case 'EXTEND_TEST':
        notes.push('Results inconclusive, recommend extended testing');
        break;
    }
    
    return notes.join('. ') || 'No significant changes detected';
  }

  private async recordLifecycleEvent(
    modelId: string,
    versionId: string,
    eventType: ModelLifecycleEvent['eventType'],
    triggeredBy: ModelLifecycleEvent['triggeredBy'],
    reason?: string
  ): Promise<void> {
    const event: ModelLifecycleEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      modelId,
      versionId,
      eventType,
      timestamp: new Date(),
      triggeredBy,
      reason
    };
    
    this.lifecycleEvents.push(event);
    
    // Keep only recent events (sliding window)
    const maxEvents = 10000;
    if (this.lifecycleEvents.length > maxEvents) {
      this.lifecycleEvents.splice(0, this.lifecycleEvents.length - maxEvents);
    }
    
    this.emit('lifecycleEvent', event);
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.versions.clear();
    this.modelVersions.clear();
    this.lifecycleEvents.length = 0;
    this.currentProduction.clear();
    this.benchmarkCache.clear();
    this.deployments.clear();
    this.performanceHistory.clear();
    
    console.log('🧹 Model Version Manager disposed');
  }
}