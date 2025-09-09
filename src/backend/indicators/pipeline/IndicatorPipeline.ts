/**
 * Indicator Pipeline System - Task BE-012
 * 
 * Comprehensive indicator pipeline system for batch processing, dependency resolution,
 * caching mechanisms, and lazy evaluation optimization. Provides enterprise-grade
 * performance and scalability for real-time trading operations.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type { OHLCV, IndicatorResult } from '../base/types.js';
import type { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { IndicatorDependencyResolver } from './IndicatorDependencyResolver.js';
import { CacheManager } from './CacheManager.js';
import { LazyEvaluationEngine } from './LazyEvaluationEngine.js';
import { IndicatorComposer } from './IndicatorComposer.js';
import { ParallelProcessingEngine } from './ParallelProcessingEngine.js';
import { MemoryManager } from './MemoryManager.js';
import { PipelineMetrics } from './PipelineMetrics.js';

// =============================================================================
// PIPELINE CONFIGURATION AND TYPES
// =============================================================================

export interface PipelineConfiguration {
  // Processing settings
  batchSize: number;
  maxConcurrency: number;
  enableParallelProcessing: boolean;
  enableLazyEvaluation: boolean;
  
  // Caching configuration
  caching: {
    enabled: boolean;
    maxCacheSize: number;
    ttlSeconds: number;
    compressionEnabled: boolean;
    persistToDisk: boolean;
  };
  
  // Memory management
  memory: {
    maxHeapUsage: number; // bytes
    gcThreshold: number; // percentage
    autoCleanup: boolean;
  };
  
  // Performance monitoring
  monitoring: {
    enabled: boolean;
    metricsRetention: number; // seconds
    performanceThresholds: {
      maxProcessingTime: number; // ms
      maxMemoryUsage: number; // bytes
    };
  };
  
  // Error handling
  errorHandling: {
    retryAttempts: number;
    timeoutMs: number;
    fallbackStrategy: 'skip' | 'approximate' | 'fail';
  };
}

export interface PipelineIndicatorSpec {
  id: string;
  name: string;
  instance: TechnicalIndicator;
  dependencies: string[];
  priority: number; // 0-100, higher = more important
  config: Record<string, any>;
  enabled: boolean;
  tags: string[];
}

export interface BatchProcessingRequest {
  requestId: string;
  data: OHLCV[];
  indicators: string[]; // indicator IDs to calculate
  options: {
    forceRecalculation?: boolean;
    useCache?: boolean;
    enableParallel?: boolean;
    maxConcurrency?: number;
    timeout?: number;
  };
}

export interface BatchProcessingResult {
  requestId: string;
  success: boolean;
  results: Map<string, IndicatorResult<any>>;
  errors: Map<string, Error>;
  metadata: {
    processingTime: number;
    indicatorsCalculated: number;
    cacheHits: number;
    cacheMisses: number;
    memoryUsed: number;
    parallelTasks: number;
  };
}

export interface StreamingUpdateRequest {
  candle: OHLCV;
  affectedIndicators?: string[];
  incremental: boolean;
}

export interface PipelineStatus {
  isRunning: boolean;
  activeRequests: number;
  totalIndicators: number;
  enabledIndicators: number;
  queuedRequests: number;
  cacheStatus: {
    size: number;
    hitRate: number;
    memoryUsage: number;
  };
  memoryUsage: {
    heap: number;
    external: number;
    arrayBuffers: number;
  };
  performance: {
    avgProcessingTime: number;
    successRate: number;
    throughput: number; // requests per second
  };
}

// =============================================================================
// MAIN INDICATOR PIPELINE CLASS
// =============================================================================

export class IndicatorPipeline extends EventEmitter {
  private readonly config: PipelineConfiguration;
  private readonly indicators: Map<string, PipelineIndicatorSpec> = new Map();
  private readonly dependencyResolver: IndicatorDependencyResolver;
  private readonly cacheManager: CacheManager;
  private readonly lazyEvaluationEngine: LazyEvaluationEngine;
  private readonly indicatorComposer: IndicatorComposer;
  private readonly parallelProcessingEngine: ParallelProcessingEngine;
  private readonly memoryManager: MemoryManager;
  private readonly metrics: PipelineMetrics;
  
  // Pipeline state
  private isRunning = false;
  private activeRequests = 0;
  private requestQueue: BatchProcessingRequest[] = [];
  private readonly requestResults: Map<string, BatchProcessingResult> = new Map();
  
  // Performance tracking
  private readonly performanceHistory: Array<{
    timestamp: number;
    processingTime: number;
    indicatorCount: number;
    cacheHitRate: number;
  }> = [];

  constructor(config: Partial<PipelineConfiguration> = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    
    // Initialize pipeline components
    this.dependencyResolver = new IndicatorDependencyResolver();
    this.cacheManager = new CacheManager(this.config.caching);
    this.lazyEvaluationEngine = new LazyEvaluationEngine(this.config);
    this.indicatorComposer = new IndicatorComposer();
    this.parallelProcessingEngine = new ParallelProcessingEngine({
      maxConcurrency: this.config.maxConcurrency,
      enabled: this.config.enableParallelProcessing
    });
    this.memoryManager = new MemoryManager(this.config.memory);
    this.metrics = new PipelineMetrics(this.config.monitoring);
    
    this.setupEventHandlers();
    this.startBackgroundProcessing();
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - INDICATOR MANAGEMENT
  // =============================================================================

  /**
   * Register indicator with the pipeline
   */
  async registerIndicator(spec: Omit<PipelineIndicatorSpec, 'id'>): Promise<string> {
    const id = this.generateIndicatorId(spec.name);
    
    const fullSpec: PipelineIndicatorSpec = {
      ...spec,
      id,
      enabled: spec.enabled ?? true
    };
    
    // Validate dependencies
    const validationResult = await this.dependencyResolver.validateDependencies(
      id, 
      spec.dependencies
    );
    
    if (!validationResult.isValid) {
      throw new Error(`Invalid dependencies for indicator ${id}: ${validationResult.errors.join(', ')}`);
    }
    
    this.indicators.set(id, fullSpec);
    this.dependencyResolver.addIndicator(id, spec.dependencies);
    
    // Initialize lazy evaluation for this indicator
    this.lazyEvaluationEngine.registerIndicator(id, spec.instance);
    
    this.emit('indicatorRegistered', { id, spec: fullSpec });
    
    return id;
  }

  /**
   * Unregister indicator from pipeline
   */
  async unregisterIndicator(id: string): Promise<boolean> {
    const spec = this.indicators.get(id);
    if (!spec) return false;
    
    // Check if other indicators depend on this one
    const dependents = this.dependencyResolver.getDependents(id);
    if (dependents.length > 0) {
      throw new Error(`Cannot remove indicator ${id}: other indicators depend on it: ${dependents.join(', ')}`);
    }
    
    this.indicators.delete(id);
    this.dependencyResolver.removeIndicator(id);
    this.lazyEvaluationEngine.unregisterIndicator(id);
    this.cacheManager.clearIndicatorCache(id);
    
    this.emit('indicatorUnregistered', { id, spec });
    
    return true;
  }

  /**
   * Enable/disable specific indicator
   */
  setIndicatorEnabled(id: string, enabled: boolean): boolean {
    const spec = this.indicators.get(id);
    if (!spec) return false;
    
    spec.enabled = enabled;
    this.emit('indicatorToggled', { id, enabled });
    
    return true;
  }

  /**
   * Update indicator configuration
   */
  async updateIndicatorConfig(id: string, config: Record<string, any>): Promise<boolean> {
    const spec = this.indicators.get(id);
    if (!spec) return false;
    
    spec.config = { ...spec.config, ...config };
    
    // Reconfigure the indicator instance
    try {
      await this.reconfigureIndicator(spec);
      this.cacheManager.clearIndicatorCache(id); // Clear cache due to config change
      
      this.emit('indicatorConfigUpdated', { id, config });
      return true;
    } catch (error) {
      this.emit('error', { type: 'configurationError', indicatorId: id, error });
      return false;
    }
  }

  // =============================================================================
  // PUBLIC API - BATCH PROCESSING
  // =============================================================================

  /**
   * Process batch of indicators for given data
   */
  async processBatch(request: BatchProcessingRequest): Promise<BatchProcessingResult> {
    const startTime = performance.now();
    this.activeRequests++;
    
    try {
      this.emit('batchStarted', { requestId: request.requestId });
      
      // Validate request
      this.validateBatchRequest(request);
      
      // Resolve indicator dependencies
      const indicatorIds = request.indicators;
      const executionOrder = this.dependencyResolver.resolveExecutionOrder(indicatorIds);
      
      // Prepare results containers
      const results = new Map<string, IndicatorResult<any>>();
      const errors = new Map<string, Error>();
      
      let cacheHits = 0;
      let cacheMisses = 0;
      let parallelTasks = 0;
      
      // Process indicators in dependency order
      for (const batch of this.groupForParallelExecution(executionOrder)) {
        if (this.config.enableParallelProcessing && batch.length > 1) {
          // Parallel processing
          const batchResults = await this.parallelProcessingEngine.processBatch(
            batch.map(id => ({
              id,
              spec: this.indicators.get(id)!,
              data: request.data,
              useCache: request.options.useCache ?? true
            }))
          );
          
          parallelTasks += batch.length;
          
          // Merge results
          batchResults.forEach((result, id) => {
            if (result.success) {
              results.set(id, result.value);
              if (result.fromCache) cacheHits++;
              else cacheMisses++;
            } else {
              errors.set(id, result.error);
            }
          });
          
        } else {
          // Sequential processing
          for (const id of batch) {
            try {
              const result = await this.processIndicator(id, request.data, request.options);
              results.set(id, result.value);
              
              if (result.fromCache) cacheHits++;
              else cacheMisses++;
              
            } catch (error) {
              errors.set(id, error instanceof Error ? error : new Error(String(error)));
            }
          }
        }
      }
      
      const processingTime = performance.now() - startTime;
      const memoryUsed = this.memoryManager.getCurrentUsage().heap;
      
      const batchResult: BatchProcessingResult = {
        requestId: request.requestId,
        success: errors.size === 0,
        results,
        errors,
        metadata: {
          processingTime,
          indicatorsCalculated: results.size,
          cacheHits,
          cacheMisses,
          memoryUsed,
          parallelTasks
        }
      };
      
      // Update metrics
      this.metrics.recordBatchProcessing({
        processingTime,
        indicatorCount: indicatorIds.length,
        cacheHitRate: cacheHits / Math.max(cacheHits + cacheMisses, 1),
        success: batchResult.success,
        memoryUsed
      });
      
      // Store result for potential retrieval
      this.requestResults.set(request.requestId, batchResult);
      
      this.emit('batchCompleted', { requestId: request.requestId, result: batchResult });
      
      return batchResult;
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      const batchResult: BatchProcessingResult = {
        requestId: request.requestId,
        success: false,
        results: new Map(),
        errors: new Map([['pipeline', error instanceof Error ? error : new Error(String(error))]]),
        metadata: {
          processingTime,
          indicatorsCalculated: 0,
          cacheHits: 0,
          cacheMisses: 0,
          memoryUsed: this.memoryManager.getCurrentUsage().heap,
          parallelTasks: 0
        }
      };
      
      this.emit('batchFailed', { requestId: request.requestId, error, result: batchResult });
      
      return batchResult;
      
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Process streaming update for affected indicators
   */
  async processStreamingUpdate(request: StreamingUpdateRequest): Promise<Map<string, IndicatorResult<any>>> {
    const startTime = performance.now();
    
    try {
      const affectedIndicators = request.affectedIndicators || 
        Array.from(this.indicators.keys()).filter(id => this.indicators.get(id)?.enabled);
      
      const results = new Map<string, IndicatorResult<any>>();
      
      if (request.incremental && this.config.enableLazyEvaluation) {
        // Use lazy evaluation for incremental updates
        const lazyResults = await this.lazyEvaluationEngine.processIncremental(
          request.candle,
          affectedIndicators
        );
        
        lazyResults.forEach((result, id) => {
          results.set(id, result);
        });
        
      } else {
        // Full recalculation
        for (const indicatorId of affectedIndicators) {
          try {
            const spec = this.indicators.get(indicatorId);
            if (!spec || !spec.enabled) continue;
            
            const result = spec.instance.update(request.candle);
            results.set(indicatorId, result);
            
            // Update cache
            if (this.config.caching.enabled) {
              await this.cacheManager.cacheResult(indicatorId, request.candle, result);
            }
            
          } catch (error) {
            this.emit('error', { 
              type: 'streamingUpdateError', 
              indicatorId, 
              error 
            });
          }
        }
      }
      
      const processingTime = performance.now() - startTime;
      
      this.metrics.recordStreamingUpdate({
        processingTime,
        indicatorCount: affectedIndicators.length,
        success: true
      });
      
      this.emit('streamingUpdateCompleted', { 
        candle: request.candle, 
        results,
        processingTime 
      });
      
      return results;
      
    } catch (error) {
      this.emit('error', { type: 'streamingUpdateError', error });
      throw error;
    }
  }

  // =============================================================================
  // PUBLIC API - INDICATOR COMPOSITION
  // =============================================================================

  /**
   * Create composite indicator from multiple indicators
   */
  async createCompositeIndicator(
    name: string,
    components: Array<{
      indicatorId: string;
      weight?: number;
      transform?: (value: any) => number;
    }>,
    combineFunction: (values: number[]) => number
  ): Promise<string> {
    return this.indicatorComposer.createComposite(
      name,
      components,
      combineFunction
    );
  }

  /**
   * Create indicator chain (output of one feeds into another)
   */
  async createIndicatorChain(
    name: string,
    chain: Array<{
      indicatorId: string;
      transform?: (input: any) => any;
    }>
  ): Promise<string> {
    return this.indicatorComposer.createChain(name, chain);
  }

  // =============================================================================
  // PUBLIC API - PIPELINE MANAGEMENT
  // =============================================================================

  /**
   * Start pipeline processing
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startBackgroundProcessing();
    
    this.emit('started');
  }

  /**
   * Stop pipeline processing
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Wait for active requests to complete
    while (this.activeRequests > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Cleanup components
    await Promise.all([
      this.cacheManager.flush(),
      this.parallelProcessingEngine.shutdown(),
      this.memoryManager.cleanup()
    ]);
    
    this.emit('stopped');
  }

  /**
   * Get current pipeline status
   */
  getStatus(): PipelineStatus {
    const cacheStatus = this.cacheManager.getStatus();
    const memoryUsage = this.memoryManager.getCurrentUsage();
    const performance = this.metrics.getPerformanceSnapshot();
    
    return {
      isRunning: this.isRunning,
      activeRequests: this.activeRequests,
      totalIndicators: this.indicators.size,
      enabledIndicators: Array.from(this.indicators.values()).filter(s => s.enabled).length,
      queuedRequests: this.requestQueue.length,
      cacheStatus: {
        size: cacheStatus.entryCount,
        hitRate: cacheStatus.hitRate,
        memoryUsage: cacheStatus.memoryUsage
      },
      memoryUsage: {
        heap: memoryUsage.heap,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      performance: {
        avgProcessingTime: performance.averageProcessingTime,
        successRate: performance.successRate,
        throughput: performance.throughput
      }
    };
  }

  /**
   * Get pipeline metrics
   */
  getMetrics() {
    return this.metrics.getDetailedMetrics();
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
    this.emit('cacheCleared');
  }

  /**
   * Force garbage collection if possible
   */
  forceGC(): boolean {
    return this.memoryManager.forceGarbageCollection();
  }

  /**
   * Get registered indicators
   */
  getRegisteredIndicators(): PipelineIndicatorSpec[] {
    return Array.from(this.indicators.values());
  }

  /**
   * Get indicator by ID
   */
  getIndicator(id: string): PipelineIndicatorSpec | undefined {
    return this.indicators.get(id);
  }

  // =============================================================================
  // PRIVATE METHODS - CORE PROCESSING
  // =============================================================================

  private async processIndicator(
    indicatorId: string,
    data: OHLCV[],
    options: BatchProcessingRequest['options']
  ): Promise<{ value: IndicatorResult<any>; fromCache: boolean }> {
    const spec = this.indicators.get(indicatorId);
    if (!spec) {
      throw new Error(`Indicator ${indicatorId} not found`);
    }
    
    if (!spec.enabled) {
      throw new Error(`Indicator ${indicatorId} is disabled`);
    }
    
    // Check cache first
    if (options.useCache && this.config.caching.enabled) {
      const cached = await this.cacheManager.getCachedResult(indicatorId, data);
      if (cached) {
        return { value: cached, fromCache: true };
      }
    }
    
    // Process with lazy evaluation if enabled
    if (this.config.enableLazyEvaluation) {
      const result = await this.lazyEvaluationEngine.calculateIndicator(indicatorId, data);
      
      // Cache result
      if (this.config.caching.enabled) {
        await this.cacheManager.cacheResult(indicatorId, data, result);
      }
      
      return { value: result, fromCache: false };
    }
    
    // Direct calculation
    const result = spec.instance.calculate(data);
    
    // Cache result
    if (this.config.caching.enabled) {
      await this.cacheManager.cacheResult(indicatorId, data, result);
    }
    
    return { value: result, fromCache: false };
  }

  private groupForParallelExecution(executionOrder: string[][]): string[][] {
    // Already grouped by dependency level
    return executionOrder;
  }

  private generateIndicatorId(name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${name}_${timestamp}_${random}`;
  }

  private mergeConfig(config: Partial<PipelineConfiguration>): PipelineConfiguration {
    return {
      batchSize: config.batchSize ?? 1000,
      maxConcurrency: config.maxConcurrency ?? 4,
      enableParallelProcessing: config.enableParallelProcessing ?? true,
      enableLazyEvaluation: config.enableLazyEvaluation ?? true,
      
      caching: {
        enabled: config.caching?.enabled ?? true,
        maxCacheSize: config.caching?.maxCacheSize ?? 100 * 1024 * 1024, // 100MB
        ttlSeconds: config.caching?.ttlSeconds ?? 3600, // 1 hour
        compressionEnabled: config.caching?.compressionEnabled ?? true,
        persistToDisk: config.caching?.persistToDisk ?? false
      },
      
      memory: {
        maxHeapUsage: config.memory?.maxHeapUsage ?? 512 * 1024 * 1024, // 512MB
        gcThreshold: config.memory?.gcThreshold ?? 80, // 80%
        autoCleanup: config.memory?.autoCleanup ?? true
      },
      
      monitoring: {
        enabled: config.monitoring?.enabled ?? true,
        metricsRetention: config.monitoring?.metricsRetention ?? 86400, // 24 hours
        performanceThresholds: {
          maxProcessingTime: config.monitoring?.performanceThresholds?.maxProcessingTime ?? 5000, // 5s
          maxMemoryUsage: config.monitoring?.performanceThresholds?.maxMemoryUsage ?? 256 * 1024 * 1024 // 256MB
        }
      },
      
      errorHandling: {
        retryAttempts: config.errorHandling?.retryAttempts ?? 3,
        timeoutMs: config.errorHandling?.timeoutMs ?? 10000, // 10s
        fallbackStrategy: config.errorHandling?.fallbackStrategy ?? 'skip'
      }
    };
  }

  private validateBatchRequest(request: BatchProcessingRequest): void {
    if (!request.requestId) {
      throw new Error('Request ID is required');
    }
    
    if (!Array.isArray(request.data) || request.data.length === 0) {
      throw new Error('Data array is required and must not be empty');
    }
    
    if (!Array.isArray(request.indicators) || request.indicators.length === 0) {
      throw new Error('Indicators array is required and must not be empty');
    }
    
    // Validate all requested indicators exist
    for (const indicatorId of request.indicators) {
      if (!this.indicators.has(indicatorId)) {
        throw new Error(`Indicator ${indicatorId} not found`);
      }
    }
  }

  private async reconfigureIndicator(spec: PipelineIndicatorSpec): Promise<void> {
    // Reset indicator with new config
    spec.instance.reset();
    
    // Apply new configuration if the indicator supports it
    if ('configure' in spec.instance && typeof spec.instance.configure === 'function') {
      (spec.instance as any).configure(spec.config);
    }
  }

  private setupEventHandlers(): void {
    // Memory management events
    this.memoryManager.on('memoryThresholdExceeded', () => {
      this.emit('memoryWarning', { usage: this.memoryManager.getCurrentUsage() });
    });
    
    // Cache management events
    this.cacheManager.on('cacheEviction', (data) => {
      this.emit('cacheEviction', data);
    });
    
    // Performance monitoring
    this.metrics.on('performanceAlert', (alert) => {
      this.emit('performanceAlert', alert);
    });
  }

  private startBackgroundProcessing(): void {
    // Start background cleanup and monitoring
    setInterval(() => {
      if (!this.isRunning) return;
      
      // Memory cleanup
      if (this.config.memory.autoCleanup) {
        this.memoryManager.performMaintenance();
      }
      
      // Cache maintenance
      if (this.config.caching.enabled) {
        this.cacheManager.performMaintenance();
      }
      
      // Metrics cleanup
      this.metrics.performMaintenance();
      
    }, 60000); // Every minute
  }
}

export default IndicatorPipeline;