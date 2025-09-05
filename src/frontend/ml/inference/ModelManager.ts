// ModelManager.ts - TensorFlow.js Model Loading and Caching System
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-wasm';
import {
  ModelMetadata,
  ModelCacheEntry,
  CacheConfig,
  MLError,
  MLErrorType,
  BackendConfig,
  MLBackendType,
  ModelValidationResult,
  ModelHealthCheck
} from '../types';

export class ModelManager {
  private static instance: ModelManager;
  private modelCache: Map<string, ModelCacheEntry> = new Map();
  private isInitialized = false;
  private currentBackend: MLBackendType = 'webgl';
  
  // Configuration
  private readonly cacheConfig: CacheConfig = {
    maxSize: 10,
    maxMemory: 500 * 1024 * 1024, // 500MB
    ttl: 30 * 60 * 1000, // 30 minutes
    evictionPolicy: 'lru'
  };

  private readonly backendConfig: BackendConfig[] = [
    { type: 'webgl', priority: 1, fallbackTo: 'wasm' },
    { type: 'wasm', priority: 2, fallbackTo: 'cpu' },
    { type: 'cpu', priority: 3 }
  ];

  // Performance tracking
  private performanceMetrics = new Map<string, {
    loadTime: number;
    inferenceTime: number[];
    memoryUsage: number;
    errorCount: number;
  }>();

  private constructor() {
    this.initializeBackend();
  }

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * Initialize TensorFlow.js backend with fallback strategy
   */
  private async initializeBackend(): Promise<void> {
    if (this.isInitialized) return;

    // Sort backends by priority
    const backends = [...this.backendConfig].sort((a, b) => a.priority - b.priority);
    
    for (const backend of backends) {
      try {
        await tf.setBackend(backend.type);
        await tf.ready();
        
        this.currentBackend = backend.type;
        this.isInitialized = true;
        
        console.log(`✅ TensorFlow.js initialized with ${backend.type} backend`);
        
        // Log backend capabilities
        if (backend.type === 'webgl') {
          const gpuInfo = tf.env().getBool('WEBGL_RENDER_FLOAT32_CAPABLE');
          console.log(`WebGL Float32 support: ${gpuInfo}`);
        }
        
        break;
      } catch (error) {
        console.warn(`❌ Failed to initialize ${backend.type} backend:`, error);
        
        if (backend.fallbackTo) {
          console.log(`🔄 Falling back to ${backend.fallbackTo} backend`);
          continue;
        } else {
          throw new Error(`All TensorFlow.js backends failed to initialize`);
        }
      }
    }

    // Set memory management flags
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
  }

  /**
   * Load a model with comprehensive error handling and caching
   */
  public async loadModel(metadata: ModelMetadata): Promise<tf.LayersModel> {
    await this.initializeBackend();
    
    const startTime = performance.now();
    
    try {
      // Check cache first
      const cachedModel = this.getCachedModel(metadata.id);
      if (cachedModel) {
        this.updateModelUsage(metadata.id);
        return cachedModel;
      }

      // Validate model metadata
      const validationResult = this.validateModelMetadata(metadata);
      if (!validationResult.isValid) {
        throw this.createMLError('MODEL_LOAD_FAILED', 
          `Model validation failed: ${validationResult.errors.join(', ')}`, 
          metadata.id
        );
      }

      // Load model from URL
      console.log(`📥 Loading model ${metadata.id} from ${metadata.modelUrl}`);
      
      const model = await tf.loadLayersModel(metadata.modelUrl, {
        strict: false,
        weightPathPrefix: metadata.weightsUrl || undefined
      });

      // Validate loaded model structure
      const modelValidation = this.validateLoadedModel(model, metadata);
      if (!modelValidation.isValid) {
        model.dispose();
        throw this.createMLError('MODEL_LOAD_FAILED',
          `Loaded model validation failed: ${modelValidation.errors.join(', ')}`,
          metadata.id
        );
      }

      // Cache the model
      const cacheEntry: ModelCacheEntry = {
        model,
        metadata,
        loadedAt: Date.now(),
        lastUsed: Date.now(),
        warmupCompleted: false
      };

      this.addToCache(metadata.id, cacheEntry);
      
      const totalLoadTime = performance.now() - startTime;
      this.updatePerformanceMetrics(metadata.id, { loadTime: totalLoadTime });
      
      console.log(`✅ Model ${metadata.id} loaded successfully in ${totalLoadTime.toFixed(2)}ms`);
      
      return model;
      
    } catch (error) {
      // const loadTime = performance.now() - startTime;
      this.updatePerformanceMetrics(metadata.id, { errorCount: 1 });
      
      console.error(`❌ Failed to load model ${metadata.id}:`, error);
      
      if (error instanceof Error) {
        throw this.createMLError('MODEL_LOAD_FAILED', error.message, metadata.id);
      }
      throw error;
    }
  }

  /**
   * Warm up a model by running a dummy prediction
   */
  public async warmModel(modelId: string, inputShape: number[]): Promise<void> {
    const cacheEntry = this.modelCache.get(modelId);
    if (!cacheEntry) {
      throw this.createMLError('CACHE_ERROR', `Model ${modelId} not found in cache`);
    }

    if (cacheEntry.warmupCompleted) {
      return;
    }

    try {
      const dummyInput = tf.randomNormal(inputShape);
      const startTime = performance.now();
      
      const prediction = cacheEntry.model.predict(dummyInput) as tf.Tensor;
      await prediction.data(); // Force execution
      
      const warmupTime = performance.now() - startTime;
      
      // Clean up
      dummyInput.dispose();
      prediction.dispose();
      
      cacheEntry.warmupCompleted = true;
      
      console.log(`🔥 Model ${modelId} warmed up in ${warmupTime.toFixed(2)}ms`);
      
    } catch (error) {
      throw this.createMLError('WARMUP_FAILED', 
        `Model warmup failed: ${error}`, 
        modelId
      );
    }
  }

  /**
   * Get a cached model if available
   */
  public getCachedModel(modelId: string): tf.LayersModel | null {
    const cacheEntry = this.modelCache.get(modelId);
    
    if (!cacheEntry) {
      return null;
    }
    
    // Check TTL
    const age = Date.now() - cacheEntry.loadedAt;
    if (age > this.cacheConfig.ttl) {
      this.removeFromCache(modelId);
      return null;
    }
    
    return cacheEntry.model;
  }

  /**
   * Remove a model from cache and dispose of tensors
   */
  public async unloadModel(modelId: string): Promise<void> {
    const cacheEntry = this.modelCache.get(modelId);
    if (cacheEntry) {
      cacheEntry.model.dispose();
      this.modelCache.delete(modelId);
      console.log(`🗑️ Model ${modelId} unloaded and disposed`);
    }
  }

  /**
   * Get current backend information
   */
  public getBackendInfo(): { backend: MLBackendType; initialized: boolean } {
    return {
      backend: this.currentBackend,
      initialized: this.isInitialized
    };
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryInfo(): { 
    numTensors: number; 
    numBytes: number; 
    cachedModels: number;
    cacheMemoryEstimate: number;
  } {
    const memInfo = tf.memory();
    const cacheMemory = Array.from(this.modelCache.values())
      .reduce((total, entry) => total + (entry.metadata.size || 0), 0);
    
    return {
      numTensors: memInfo.numTensors,
      numBytes: memInfo.numBytes,
      cachedModels: this.modelCache.size,
      cacheMemoryEstimate: cacheMemory
    };
  }

  /**
   * Perform health check on a model
   */
  public async healthCheck(modelId: string): Promise<ModelHealthCheck> {
    const cacheEntry = this.modelCache.get(modelId);
    
    if (!cacheEntry) {
      return {
        modelId,
        isHealthy: false,
        latency: -1,
        memoryUsage: 0,
        errorCount: this.performanceMetrics.get(modelId)?.errorCount || 0,
        lastError: this.createMLError('CACHE_ERROR', `Model ${modelId} not found in cache`),
        timestamp: Date.now()
      };
    }

    try {
      const inputShape = cacheEntry.metadata.inputShape;
      const dummyInput = tf.randomNormal([1, ...inputShape]);
      
      const startTime = performance.now();
      const prediction = cacheEntry.model.predict(dummyInput) as tf.Tensor;
      await prediction.data();
      const latency = performance.now() - startTime;
      
      dummyInput.dispose();
      prediction.dispose();
      
      return {
        modelId,
        isHealthy: true,
        latency,
        memoryUsage: tf.memory().numBytes,
        errorCount: this.performanceMetrics.get(modelId)?.errorCount || 0,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        modelId,
        isHealthy: false,
        latency: -1,
        memoryUsage: tf.memory().numBytes,
        errorCount: (this.performanceMetrics.get(modelId)?.errorCount || 0) + 1,
        lastError: this.createMLError('PREDICTION_FAILED', `Health check failed: ${error}`, modelId),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Clean up expired models and manage cache size
   */
  public cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.modelCache.entries());
    
    // Remove expired entries
    for (const [modelId, entry] of entries) {
      if (now - entry.loadedAt > this.cacheConfig.ttl) {
        this.removeFromCache(modelId);
      }
    }
    
    // Enforce cache size limits
    if (this.modelCache.size > this.cacheConfig.maxSize) {
      this.evictModels();
    }
  }

  /**
   * Get performance metrics for a model
   */
  public getModelPerformance(modelId: string) {
    return this.performanceMetrics.get(modelId);
  }

  /**
   * Get all cached models info
   */
  public getCachedModelsInfo() {
    return Array.from(this.modelCache.entries()).map(([id, entry]) => ({
      id,
      name: entry.metadata.name,
      version: entry.metadata.version,
      loadedAt: entry.loadedAt,
      lastUsed: entry.lastUsed,
      warmupCompleted: entry.warmupCompleted,
      size: entry.metadata.size
    }));
  }

  // Private helper methods
  private addToCache(modelId: string, entry: ModelCacheEntry): void {
    this.modelCache.set(modelId, entry);
    this.cleanupCache();
  }

  private removeFromCache(modelId: string): void {
    const entry = this.modelCache.get(modelId);
    if (entry) {
      entry.model.dispose();
      this.modelCache.delete(modelId);
    }
  }

  private updateModelUsage(modelId: string): void {
    const entry = this.modelCache.get(modelId);
    if (entry) {
      entry.lastUsed = Date.now();
    }
  }

  private evictModels(): void {
    const entries = Array.from(this.modelCache.entries());
    
    switch (this.cacheConfig.evictionPolicy) {
      case 'lru':
        entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        break;
      case 'lfu':
        // For simplicity, using lastUsed as proxy for frequency
        entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        break;
      case 'fifo':
        entries.sort((a, b) => a[1].loadedAt - b[1].loadedAt);
        break;
    }
    
    const excessCount = this.modelCache.size - this.cacheConfig.maxSize;
    for (let i = 0; i < excessCount; i++) {
      const [modelId] = entries[i];
      this.removeFromCache(modelId);
    }
  }

  private validateModelMetadata(metadata: ModelMetadata): ModelValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!metadata.id || metadata.id.trim() === '') {
      errors.push('Model ID is required');
    }
    
    if (!metadata.modelUrl || !this.isValidUrl(metadata.modelUrl)) {
      errors.push('Valid model URL is required');
    }
    
    if (!metadata.inputShape || metadata.inputShape.length === 0) {
      errors.push('Input shape is required');
    }
    
    if (!metadata.outputShape || metadata.outputShape.length === 0) {
      errors.push('Output shape is required');
    }
    
    if (!metadata.version) {
      warnings.push('Model version not specified');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      inputShapeValid: metadata.inputShape?.length > 0,
      outputShapeValid: metadata.outputShape?.length > 0,
      weightsValid: !metadata.weightsUrl || this.isValidUrl(metadata.weightsUrl),
      metadataValid: !!metadata.id && !!metadata.name
    };
  }

  private validateLoadedModel(model: tf.LayersModel, metadata: ModelMetadata): ModelValidationResult {
    const errors: string[] = [];
    
    // Check input shape compatibility - TF.js model structure validation
    try {
      const inputs = model.inputs;
      if (inputs && inputs.length > 1) {
        errors.push('Multiple input models not currently supported');
      } else if (inputs && inputs.length > 0) {
        const inputShape = inputs[0].shape;
        const expectedShape = [null, ...metadata.inputShape];
        
        if (inputShape && expectedShape.length !== inputShape.length) {
          errors.push(`Input shape mismatch: expected ${expectedShape}, got ${inputShape}`);
        }
      }
    } catch (shapeError) {
      // If we can't validate shape, just warn but don't fail
      console.warn('Could not validate model input shape:', shapeError);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      inputShapeValid: true, // More detailed validation can be added
      outputShapeValid: true,
      weightsValid: true,
      metadataValid: true
    };
  }

  private updatePerformanceMetrics(modelId: string, metrics: Partial<{
    loadTime: number;
    inferenceTime: number;
    errorCount: number;
  }>): void {
    const existing = this.performanceMetrics.get(modelId) || {
      loadTime: 0,
      inferenceTime: [],
      memoryUsage: 0,
      errorCount: 0
    };
    
    if (metrics.loadTime !== undefined) {
      existing.loadTime = metrics.loadTime;
    }
    
    if (metrics.inferenceTime !== undefined) {
      existing.inferenceTime.push(metrics.inferenceTime);
      if (existing.inferenceTime.length > 100) {
        existing.inferenceTime = existing.inferenceTime.slice(-100);
      }
    }
    
    if (metrics.errorCount !== undefined) {
      existing.errorCount += metrics.errorCount;
    }
    
    existing.memoryUsage = tf.memory().numBytes;
    
    this.performanceMetrics.set(modelId, existing);
  }

  private createMLError(type: MLErrorType, message: string, modelId?: string): MLError {
    return {
      code: type,
      message,
      modelId,
      timestamp: Date.now(),
      context: {
        backend: this.currentBackend,
        memoryInfo: tf.memory()
      }
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const modelManager = ModelManager.getInstance();