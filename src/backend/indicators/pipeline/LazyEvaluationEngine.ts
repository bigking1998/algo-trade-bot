/**
 * Lazy Evaluation Engine - Task BE-012
 * 
 * Advanced lazy evaluation system for technical indicators with memoization,
 * incremental updates, and smart invalidation. Optimizes performance by
 * calculating indicators only when needed and caching intermediate results.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type { OHLCV, IndicatorResult } from '../base/types.js';
import type { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import type { PipelineConfiguration } from './IndicatorPipeline.js';

// =============================================================================
// LAZY EVALUATION TYPES AND INTERFACES
// =============================================================================

export interface LazyEvaluationConfig {
  enableMemoization: boolean;
  enableIncremental: boolean;
  maxMemoizedResults: number;
  invalidationStrategy: 'time' | 'data' | 'dependency' | 'hybrid';
  
  // Incremental update settings
  incremental: {
    batchSize: number;
    maxLookback: number; // How far back to recalculate on invalidation
    smartInvalidation: boolean;
  };
  
  // Performance optimization
  optimization: {
    predictiveLoading: boolean;
    adaptiveThresholds: boolean;
    memoryBudget: number; // bytes
  };
}

export interface LazyIndicatorNode {
  id: string;
  indicator: TechnicalIndicator;
  dependencies: Set<string>;
  dependents: Set<string>;
  
  // Lazy evaluation state
  isEvaluated: boolean;
  isDirty: boolean;
  lastEvaluation?: Date;
  evaluationCount: number;
  
  // Memoization
  memoizedResults: Map<string, MemoizedResult>;
  
  // Incremental state
  incrementalState?: IncrementalState;
  
  // Performance metrics
  metrics: {
    totalEvaluationTime: number;
    averageEvaluationTime: number;
    cacheHitRate: number;
    incrementalUpdateCount: number;
  };
}

export interface MemoizedResult<T = any> {
  key: string;
  result: IndicatorResult<T>;
  timestamp: Date;
  dependencies: string[]; // Hash of input dependencies
  accessCount: number;
  lastAccessed: Date;
  size: number; // estimated memory size
}

export interface IncrementalState {
  lastProcessedIndex: number;
  partialResults: any[];
  windowBuffer: OHLCV[];
  accumulatedChanges: Set<number>; // indices that changed
  isIncrementalValid: boolean;
}

export interface EvaluationPlan {
  indicatorId: string;
  executionMode: 'full' | 'incremental' | 'cached';
  dependencies: Array<{
    indicatorId: string;
    mode: 'full' | 'incremental' | 'cached';
  }>;
  estimatedTime: number;
  estimatedMemory: number;
  cacheKeys: string[];
}

export interface EvaluationResult<T = any> {
  indicatorId: string;
  result: IndicatorResult<T>;
  executionMode: 'full' | 'incremental' | 'cached';
  fromCache: boolean;
  evaluationTime: number;
  dependencies: string[];
  metadata: {
    cacheHit: boolean;
    incrementalUpdate: boolean;
    memoryUsed: number;
    invalidationReason?: string;
  };
}

// =============================================================================
// LAZY EVALUATION ENGINE IMPLEMENTATION
// =============================================================================

export class LazyEvaluationEngine extends EventEmitter {
  private readonly config: LazyEvaluationConfig;
  private readonly indicators: Map<string, LazyIndicatorNode> = new Map();
  private readonly evaluationQueue: Array<{ indicatorId: string; priority: number }> = [];
  
  // Global memoization cache
  private readonly globalMemoCache: Map<string, MemoizedResult> = new Map();
  
  // Dependency tracking
  private readonly dependencyGraph: Map<string, Set<string>> = new Map();
  private readonly reverseDependencyGraph: Map<string, Set<string>> = new Map();
  
  // Incremental processing state
  private readonly incrementalBuffers: Map<string, OHLCV[]> = new Map();
  private lastGlobalUpdate?: Date;
  
  // Performance tracking
  private readonly evaluationHistory: Array<{
    timestamp: Date;
    indicatorId: string;
    mode: string;
    duration: number;
    success: boolean;
  }> = [];
  
  // Smart invalidation
  private readonly invalidationReasons: Map<string, string> = new Map();

  constructor(pipelineConfig: PipelineConfiguration) {
    super();
    
    this.config = this.createLazyConfig(pipelineConfig);
    this.startBackgroundTasks();
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - INDICATOR REGISTRATION
  // =============================================================================

  /**
   * Register indicator for lazy evaluation
   */
  registerIndicator(id: string, indicator: TechnicalIndicator, dependencies: string[] = []): void {
    if (this.indicators.has(id)) {
      throw new Error(`Indicator ${id} is already registered`);
    }
    
    const node: LazyIndicatorNode = {
      id,
      indicator,
      dependencies: new Set(dependencies),
      dependents: new Set(),
      isEvaluated: false,
      isDirty: true,
      evaluationCount: 0,
      memoizedResults: new Map(),
      metrics: {
        totalEvaluationTime: 0,
        averageEvaluationTime: 0,
        cacheHitRate: 0,
        incrementalUpdateCount: 0
      }
    };
    
    this.indicators.set(id, node);
    
    // Update dependency graphs
    this.dependencyGraph.set(id, new Set(dependencies));
    dependencies.forEach(depId => {
      if (!this.reverseDependencyGraph.has(depId)) {
        this.reverseDependencyGraph.set(depId, new Set());
      }
      this.reverseDependencyGraph.get(depId)!.add(id);
    });
    
    // Update dependent nodes
    dependencies.forEach(depId => {
      const depNode = this.indicators.get(depId);
      if (depNode) {
        depNode.dependents.add(id);
      }
    });
    
    // Initialize incremental state if enabled
    if (this.config.enableIncremental) {
      node.incrementalState = {
        lastProcessedIndex: -1,
        partialResults: [],
        windowBuffer: [],
        accumulatedChanges: new Set(),
        isIncrementalValid: false
      };
    }
    
    this.emit('indicatorRegistered', { id, dependencies });
  }

  /**
   * Unregister indicator
   */
  unregisterIndicator(id: string): boolean {
    const node = this.indicators.get(id);
    if (!node) return false;
    
    // Check for dependents
    if (node.dependents.size > 0) {
      const dependents = Array.from(node.dependents);
      throw new Error(`Cannot unregister indicator ${id}: has dependents ${dependents.join(', ')}`);
    }
    
    // Remove from dependency graphs
    this.dependencyGraph.delete(id);
    this.reverseDependencyGraph.delete(id);
    
    // Update dependencies
    node.dependencies.forEach(depId => {
      const depNode = this.indicators.get(depId);
      if (depNode) {
        depNode.dependents.delete(id);
      }
      
      const revDeps = this.reverseDependencyGraph.get(depId);
      if (revDeps) {
        revDeps.delete(id);
      }
    });
    
    // Clean up memoization
    this.cleanupMemoization(id);
    
    this.indicators.delete(id);
    this.emit('indicatorUnregistered', { id });
    
    return true;
  }

  // =============================================================================
  // PUBLIC API - LAZY EVALUATION
  // =============================================================================

  /**
   * Calculate indicator with lazy evaluation
   */
  async calculateIndicator(indicatorId: string, data: OHLCV[]): Promise<IndicatorResult<any>> {
    const startTime = performance.now();
    
    try {
      const node = this.indicators.get(indicatorId);
      if (!node) {
        throw new Error(`Indicator ${indicatorId} not registered`);
      }
      
      // Create evaluation plan
      const plan = await this.createEvaluationPlan(indicatorId, data);
      
      // Execute evaluation
      const result = await this.executeEvaluationPlan(plan, data);
      
      // Update metrics
      const duration = performance.now() - startTime;
      this.updateNodeMetrics(node, duration, result.fromCache);
      this.recordEvaluation(indicatorId, result.executionMode, duration, true);
      
      this.emit('indicatorCalculated', { indicatorId, result, plan });
      
      return result.result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordEvaluation(indicatorId, 'error', duration, false);
      
      this.emit('evaluationError', { indicatorId, error, duration });
      throw error;
    }
  }

  /**
   * Process incremental update for multiple indicators
   */
  async processIncremental(
    newCandle: OHLCV, 
    indicatorIds: string[]
  ): Promise<Map<string, IndicatorResult<any>>> {
    const startTime = performance.now();
    const results = new Map<string, IndicatorResult<any>>();
    
    try {
      // Update global incremental buffers
      indicatorIds.forEach(id => {
        const buffer = this.incrementalBuffers.get(id) || [];
        buffer.push(newCandle);
        
        // Maintain buffer size
        if (buffer.length > this.config.incremental.maxLookback) {
          buffer.shift();
        }
        
        this.incrementalBuffers.set(id, buffer);
      });
      
      // Process indicators in dependency order
      const orderedIds = this.resolveDependencyOrder(indicatorIds);
      
      for (const indicatorId of orderedIds) {
        try {
          const result = await this.processIncrementalIndicator(indicatorId, newCandle);
          results.set(indicatorId, result);
        } catch (error) {
          this.emit('incrementalError', { indicatorId, error });
          // Continue with other indicators
        }
      }
      
      this.lastGlobalUpdate = new Date();
      
      const duration = performance.now() - startTime;
      this.emit('incrementalProcessed', { 
        indicatorIds, 
        results: results.size, 
        duration 
      });
      
      return results;
      
    } catch (error) {
      this.emit('incrementalError', { error });
      throw error;
    }
  }

  /**
   * Invalidate specific indicator (force recalculation)
   */
  invalidateIndicator(indicatorId: string, reason: string = 'manual'): void {
    const node = this.indicators.get(indicatorId);
    if (!node) return;
    
    // Mark as dirty
    node.isDirty = true;
    node.isEvaluated = false;
    
    // Clear memoization
    node.memoizedResults.clear();
    
    // Reset incremental state
    if (node.incrementalState) {
      node.incrementalState.isIncrementalValid = false;
      node.incrementalState.accumulatedChanges.clear();
    }
    
    // Propagate invalidation to dependents
    if (this.config.invalidationStrategy === 'dependency' || 
        this.config.invalidationStrategy === 'hybrid') {
      this.propagateInvalidation(indicatorId, reason);
    }
    
    this.invalidationReasons.set(indicatorId, reason);
    this.emit('indicatorInvalidated', { indicatorId, reason });
  }

  /**
   * Invalidate all indicators
   */
  invalidateAll(reason: string = 'global'): void {
    this.indicators.forEach((_, id) => {
      this.invalidateIndicator(id, reason);
    });
    
    this.globalMemoCache.clear();
    this.incrementalBuffers.clear();
  }

  // =============================================================================
  // PUBLIC API - CACHE AND STATE MANAGEMENT
  // =============================================================================

  /**
   * Clear memoization cache for specific indicator
   */
  clearMemoization(indicatorId?: string): void {
    if (indicatorId) {
      this.cleanupMemoization(indicatorId);
    } else {
      this.globalMemoCache.clear();
      this.indicators.forEach(node => {
        node.memoizedResults.clear();
      });
    }
    
    this.emit('memoizationCleared', { indicatorId });
  }

  /**
   * Get evaluation metrics
   */
  getMetrics(): {
    indicators: Map<string, LazyIndicatorNode['metrics']>;
    global: {
      totalEvaluations: number;
      cacheHitRate: number;
      averageEvaluationTime: number;
      memoizationSize: number;
      incrementalUpdates: number;
    };
  } {
    const indicatorMetrics = new Map<string, LazyIndicatorNode['metrics']>();
    
    this.indicators.forEach((node, id) => {
      indicatorMetrics.set(id, { ...node.metrics });
    });
    
    const totalEvaluations = this.evaluationHistory.length;
    const successfulEvaluations = this.evaluationHistory.filter(e => e.success);
    const cacheHits = Array.from(this.indicators.values()).reduce(
      (sum, node) => sum + node.memoizedResults.size, 0
    );
    
    return {
      indicators: indicatorMetrics,
      global: {
        totalEvaluations,
        cacheHitRate: totalEvaluations > 0 ? cacheHits / totalEvaluations : 0,
        averageEvaluationTime: successfulEvaluations.length > 0 ? 
          successfulEvaluations.reduce((sum, e) => sum + e.duration, 0) / successfulEvaluations.length : 0,
        memoizationSize: this.globalMemoCache.size + cacheHits,
        incrementalUpdates: Array.from(this.indicators.values()).reduce(
          (sum, node) => sum + node.metrics.incrementalUpdateCount, 0
        )
      }
    };
  }

  /**
   * Get current evaluation status
   */
  getStatus(): {
    registeredIndicators: number;
    evaluatedIndicators: number;
    dirtyIndicators: number;
    memoizedResults: number;
    queuedEvaluations: number;
  } {
    let evaluated = 0;
    let dirty = 0;
    let memoized = 0;
    
    this.indicators.forEach(node => {
      if (node.isEvaluated) evaluated++;
      if (node.isDirty) dirty++;
      memoized += node.memoizedResults.size;
    });
    
    return {
      registeredIndicators: this.indicators.size,
      evaluatedIndicators: evaluated,
      dirtyIndicators: dirty,
      memoizedResults: memoized + this.globalMemoCache.size,
      queuedEvaluations: this.evaluationQueue.length
    };
  }

  // =============================================================================
  // PRIVATE METHODS - EVALUATION PLANNING
  // =============================================================================

  private async createEvaluationPlan(
    indicatorId: string, 
    data: OHLCV[]
  ): Promise<EvaluationPlan> {
    const node = this.indicators.get(indicatorId);
    if (!node) {
      throw new Error(`Indicator ${indicatorId} not found`);
    }
    
    // Determine execution mode
    let executionMode: 'full' | 'incremental' | 'cached' = 'full';
    
    // Check for cached result
    const cacheKey = this.generateCacheKey(indicatorId, data);
    if (this.config.enableMemoization && this.hasMemoizedResult(indicatorId, cacheKey)) {
      executionMode = 'cached';
    } else if (this.config.enableIncremental && this.canUseIncremental(node, data)) {
      executionMode = 'incremental';
    }
    
    // Plan dependencies
    const dependencyPlans: EvaluationPlan['dependencies'] = [];
    for (const depId of node.dependencies) {
      const depNode = this.indicators.get(depId);
      if (depNode) {
        const depPlan = await this.createEvaluationPlan(depId, data);
        dependencyPlans.push({
          indicatorId: depId,
          mode: depPlan.executionMode
        });
      }
    }
    
    return {
      indicatorId,
      executionMode,
      dependencies: dependencyPlans,
      estimatedTime: this.estimateExecutionTime(node, executionMode),
      estimatedMemory: this.estimateMemoryUsage(node, executionMode, data.length),
      cacheKeys: [cacheKey]
    };
  }

  private async executeEvaluationPlan(
    plan: EvaluationPlan, 
    data: OHLCV[]
  ): Promise<EvaluationResult> {
    const startTime = performance.now();
    const node = this.indicators.get(plan.indicatorId)!;
    
    // Execute dependencies first
    const dependencyResults = new Map<string, IndicatorResult<any>>();
    for (const dep of plan.dependencies) {
      if (dep.mode !== 'cached') {
        const depPlan = await this.createEvaluationPlan(dep.indicatorId, data);
        const depResult = await this.executeEvaluationPlan(depPlan, data);
        dependencyResults.set(dep.indicatorId, depResult.result);
      }
    }
    
    let result: IndicatorResult<any>;
    let fromCache = false;
    let metadata: EvaluationResult['metadata'];
    
    switch (plan.executionMode) {
      case 'cached':
        result = await this.getCachedResult(plan.indicatorId, data);
        fromCache = true;
        metadata = {
          cacheHit: true,
          incrementalUpdate: false,
          memoryUsed: 0
        };
        break;
        
      case 'incremental':
        result = await this.executeIncremental(node, data);
        metadata = {
          cacheHit: false,
          incrementalUpdate: true,
          memoryUsed: this.estimateMemoryUsage(node, 'incremental', data.length)
        };
        break;
        
      case 'full':
      default:
        result = await this.executeFull(node, data);
        metadata = {
          cacheHit: false,
          incrementalUpdate: false,
          memoryUsed: this.estimateMemoryUsage(node, 'full', data.length)
        };
        break;
    }
    
    // Update node state
    node.isEvaluated = true;
    node.isDirty = false;
    node.lastEvaluation = new Date();
    node.evaluationCount++;
    
    // Memoize result if enabled
    if (this.config.enableMemoization && !fromCache) {
      await this.memoizeResult(plan.indicatorId, data, result);
    }
    
    const evaluationTime = performance.now() - startTime;
    
    return {
      indicatorId: plan.indicatorId,
      result,
      executionMode: plan.executionMode,
      fromCache,
      evaluationTime,
      dependencies: Array.from(node.dependencies),
      metadata: {
        ...metadata,
        invalidationReason: this.invalidationReasons.get(plan.indicatorId)
      }
    };
  }

  // =============================================================================
  // PRIVATE METHODS - EXECUTION MODES
  // =============================================================================

  private async executeFull(node: LazyIndicatorNode, data: OHLCV[]): Promise<IndicatorResult<any>> {
    // Full recalculation
    return node.indicator.calculate(data);
  }

  private async executeIncremental(
    node: LazyIndicatorNode, 
    data: OHLCV[]
  ): Promise<IndicatorResult<any>> {
    const incrementalState = node.incrementalState!;
    
    // Determine what needs to be recalculated
    const newDataStart = incrementalState.lastProcessedIndex + 1;
    const newData = data.slice(newDataStart);
    
    if (newData.length === 0) {
      // No new data, return last result if available
      const memoizedResults = Array.from(node.memoizedResults.values());
      if (memoizedResults.length > 0) {
        const latest = memoizedResults[memoizedResults.length - 1];
        return latest.result;
      }
    }
    
    // Process new data incrementally
    let result: IndicatorResult<any>;
    
    if (newData.length === 1 && incrementalState.isIncrementalValid) {
      // Single candle update - use streaming update
      result = node.indicator.update(newData[0]);
      node.metrics.incrementalUpdateCount++;
    } else {
      // Multiple candles or invalid incremental state - use batch calculation
      const requiredData = this.getRequiredDataForIncremental(node, data, newDataStart);
      result = node.indicator.calculate(requiredData);
    }
    
    // Update incremental state
    incrementalState.lastProcessedIndex = data.length - 1;
    incrementalState.isIncrementalValid = true;
    
    return result;
  }

  private async getCachedResult(indicatorId: string, data: OHLCV[]): Promise<IndicatorResult<any>> {
    const cacheKey = this.generateCacheKey(indicatorId, data);
    
    // Check node-specific cache first
    const node = this.indicators.get(indicatorId)!;
    const nodeResult = node.memoizedResults.get(cacheKey);
    if (nodeResult) {
      nodeResult.accessCount++;
      nodeResult.lastAccessed = new Date();
      return nodeResult.result;
    }
    
    // Check global cache
    const globalResult = this.globalMemoCache.get(cacheKey);
    if (globalResult) {
      globalResult.accessCount++;
      globalResult.lastAccessed = new Date();
      return globalResult.result;
    }
    
    throw new Error(`No cached result found for ${indicatorId}`);
  }

  // =============================================================================
  // PRIVATE METHODS - INCREMENTAL PROCESSING
  // =============================================================================

  private async processIncrementalIndicator(
    indicatorId: string, 
    newCandle: OHLCV
  ): Promise<IndicatorResult<any>> {
    const node = this.indicators.get(indicatorId);
    if (!node || !node.incrementalState) {
      throw new Error(`Indicator ${indicatorId} not configured for incremental processing`);
    }
    
    const startTime = performance.now();
    
    try {
      // Check if incremental state is valid
      if (!node.incrementalState.isIncrementalValid) {
        // Need to rebuild incremental state
        const buffer = this.incrementalBuffers.get(indicatorId) || [];
        const result = node.indicator.calculate(buffer);
        
        node.incrementalState.isIncrementalValid = true;
        node.incrementalState.lastProcessedIndex = buffer.length - 1;
        
        return result;
      }
      
      // Perform incremental update
      const result = node.indicator.update(newCandle);
      
      // Update state
      node.incrementalState.lastProcessedIndex++;
      node.metrics.incrementalUpdateCount++;
      
      // Memoize result
      if (this.config.enableMemoization) {
        const buffer = this.incrementalBuffers.get(indicatorId) || [];
        await this.memoizeResult(indicatorId, buffer, result);
      }
      
      const duration = performance.now() - startTime;
      this.updateNodeMetrics(node, duration, false);
      
      return result;
      
    } catch (error) {
      // Incremental update failed, invalidate and retry
      node.incrementalState.isIncrementalValid = false;
      throw error;
    }
  }

  private canUseIncremental(node: LazyIndicatorNode, data: OHLCV[]): boolean {
    if (!this.config.enableIncremental || !node.incrementalState) {
      return false;
    }
    
    // Check if we have enough data for incremental processing
    const buffer = this.incrementalBuffers.get(node.id) || [];
    const newDataCount = data.length - node.incrementalState.lastProcessedIndex - 1;
    
    return (
      node.incrementalState.isIncrementalValid &&
      newDataCount > 0 &&
      newDataCount <= this.config.incremental.batchSize &&
      buffer.length >= node.indicator.getConfig().period
    );
  }

  private getRequiredDataForIncremental(
    node: LazyIndicatorNode, 
    data: OHLCV[], 
    startIndex: number
  ): OHLCV[] {
    const period = node.indicator.getConfig().period;
    const requiredStart = Math.max(0, startIndex - period);
    return data.slice(requiredStart);
  }

  // =============================================================================
  // PRIVATE METHODS - MEMOIZATION
  // =============================================================================

  private async memoizeResult(
    indicatorId: string, 
    data: OHLCV[], 
    result: IndicatorResult<any>
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(indicatorId, data);
    const now = new Date();
    
    const memoizedResult: MemoizedResult = {
      key: cacheKey,
      result,
      timestamp: now,
      dependencies: [this.hashData(data)],
      accessCount: 0,
      lastAccessed: now,
      size: this.estimateResultSize(result)
    };
    
    // Store in node-specific cache
    const node = this.indicators.get(indicatorId);
    if (node) {
      node.memoizedResults.set(cacheKey, memoizedResult);
      this.enforceNodeMemoizationLimits(node);
    }
    
    // Store in global cache if there's space
    if (this.globalMemoCache.size < this.config.maxMemoizedResults) {
      this.globalMemoCache.set(cacheKey, { ...memoizedResult });
    }
    
    this.emit('resultMemoized', { indicatorId, cacheKey });
  }

  private hasMemoizedResult(indicatorId: string, cacheKey: string): boolean {
    const node = this.indicators.get(indicatorId);
    return (node && node.memoizedResults.has(cacheKey)) || 
           this.globalMemoCache.has(cacheKey);
  }

  private enforceNodeMemoizationLimits(node: LazyIndicatorNode): void {
    // Remove oldest entries if exceeding limits
    const maxSize = Math.floor(this.config.maxMemoizedResults / this.indicators.size);
    
    if (node.memoizedResults.size > maxSize) {
      // Sort by last accessed time and remove oldest
      const entries = Array.from(node.memoizedResults.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
      
      const toRemove = entries.slice(0, entries.length - maxSize);
      toRemove.forEach(([key]) => {
        node.memoizedResults.delete(key);
      });
    }
  }

  private cleanupMemoization(indicatorId: string): void {
    const node = this.indicators.get(indicatorId);
    if (node) {
      node.memoizedResults.clear();
    }
    
    // Remove from global cache
    for (const [key, result] of this.globalMemoCache.entries()) {
      if (key.startsWith(indicatorId + ':')) {
        this.globalMemoCache.delete(key);
      }
    }
  }

  // =============================================================================
  // PRIVATE METHODS - INVALIDATION
  // =============================================================================

  private propagateInvalidation(indicatorId: string, reason: string): void {
    const dependents = this.reverseDependencyGraph.get(indicatorId) || new Set();
    
    for (const dependentId of dependents) {
      this.invalidateIndicator(dependentId, `dependency: ${reason}`);
    }
  }

  // =============================================================================
  // PRIVATE METHODS - UTILITIES
  // =============================================================================

  private generateCacheKey(indicatorId: string, data: OHLCV[]): string {
    const dataHash = this.hashData(data);
    return `${indicatorId}:${dataHash}`;
  }

  private hashData(data: OHLCV[]): string {
    // Simple hash based on first, middle, and last elements
    if (data.length === 0) return 'empty';
    
    const first = data[0];
    const middle = data[Math.floor(data.length / 2)];
    const last = data[data.length - 1];
    
    return `${first.timestamp}-${middle.timestamp}-${last.timestamp}-${data.length}`;
  }

  private resolveDependencyOrder(indicatorIds: string[]): string[] {
    // Topological sort for dependency order
    const visited = new Set<string>();
    const result: string[] = [];
    
    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const node = this.indicators.get(id);
      if (node) {
        node.dependencies.forEach(depId => {
          if (indicatorIds.includes(depId)) {
            visit(depId);
          }
        });
      }
      
      result.push(id);
    };
    
    indicatorIds.forEach(id => visit(id));
    return result;
  }

  private estimateExecutionTime(node: LazyIndicatorNode, mode: string): number {
    const baseTime = node.metrics.averageEvaluationTime || 10;
    
    switch (mode) {
      case 'cached': return 1; // Very fast
      case 'incremental': return baseTime * 0.1; // 10% of full calculation
      case 'full': return baseTime;
      default: return baseTime;
    }
  }

  private estimateMemoryUsage(node: LazyIndicatorNode, mode: string, dataLength: number): number {
    const baseMemory = dataLength * 64; // Rough estimate: 64 bytes per candle
    
    switch (mode) {
      case 'cached': return 0;
      case 'incremental': return baseMemory * 0.1;
      case 'full': return baseMemory;
      default: return baseMemory;
    }
  }

  private estimateResultSize(result: IndicatorResult<any>): number {
    // Rough estimation of result size in bytes
    const jsonString = JSON.stringify(result);
    return Buffer.byteLength(jsonString, 'utf8');
  }

  private updateNodeMetrics(node: LazyIndicatorNode, duration: number, fromCache: boolean): void {
    if (!fromCache) {
      node.metrics.totalEvaluationTime += duration;
      const totalNonCachedEvaluations = node.evaluationCount - 
        Array.from(node.memoizedResults.values()).reduce((sum, r) => sum + r.accessCount, 0);
      
      if (totalNonCachedEvaluations > 0) {
        node.metrics.averageEvaluationTime = node.metrics.totalEvaluationTime / totalNonCachedEvaluations;
      }
    }
    
    // Update cache hit rate
    const totalAccesses = node.evaluationCount;
    const cacheHits = Array.from(node.memoizedResults.values())
      .reduce((sum, r) => sum + r.accessCount, 0);
    
    node.metrics.cacheHitRate = totalAccesses > 0 ? cacheHits / totalAccesses : 0;
  }

  private recordEvaluation(
    indicatorId: string, 
    mode: string, 
    duration: number, 
    success: boolean
  ): void {
    this.evaluationHistory.push({
      timestamp: new Date(),
      indicatorId,
      mode,
      duration,
      success
    });
    
    // Limit history size
    if (this.evaluationHistory.length > 1000) {
      this.evaluationHistory.splice(0, 100);
    }
  }

  private createLazyConfig(pipelineConfig: PipelineConfiguration): LazyEvaluationConfig {
    return {
      enableMemoization: true,
      enableIncremental: pipelineConfig.enableLazyEvaluation,
      maxMemoizedResults: 1000,
      invalidationStrategy: 'hybrid',
      
      incremental: {
        batchSize: pipelineConfig.batchSize,
        maxLookback: 200,
        smartInvalidation: true
      },
      
      optimization: {
        predictiveLoading: false,
        adaptiveThresholds: true,
        memoryBudget: pipelineConfig.memory.maxHeapUsage * 0.3 // 30% of total memory budget
      }
    };
  }

  private startBackgroundTasks(): void {
    // Periodic cleanup of old memoized results
    setInterval(() => {
      this.cleanupOldMemoizedResults();
    }, 300000); // Every 5 minutes
    
    // Periodic validation of incremental states
    setInterval(() => {
      this.validateIncrementalStates();
    }, 600000); // Every 10 minutes
  }

  private cleanupOldMemoizedResults(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Cleanup global cache
    for (const [key, result] of this.globalMemoCache.entries()) {
      if (result.timestamp.getTime() < cutoffTime && result.accessCount === 0) {
        this.globalMemoCache.delete(key);
      }
    }
    
    // Cleanup node caches
    this.indicators.forEach(node => {
      for (const [key, result] of node.memoizedResults.entries()) {
        if (result.timestamp.getTime() < cutoffTime && result.accessCount === 0) {
          node.memoizedResults.delete(key);
        }
      }
    });
  }

  private validateIncrementalStates(): void {
    this.indicators.forEach((node, id) => {
      if (node.incrementalState && node.incrementalState.isIncrementalValid) {
        // Check if incremental state is still reasonable
        const buffer = this.incrementalBuffers.get(id);
        if (!buffer || buffer.length === 0) {
          node.incrementalState.isIncrementalValid = false;
          this.emit('incrementalStateInvalidated', { indicatorId: id, reason: 'empty buffer' });
        }
      }
    });
  }
}

export default LazyEvaluationEngine;