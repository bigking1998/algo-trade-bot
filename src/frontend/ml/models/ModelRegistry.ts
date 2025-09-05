// ModelRegistry.ts - Model Versioning and Registry Management
import { modelManager } from '../inference/ModelManager';
import { predictionEngine } from '../inference/PredictionEngine';
import {
  ModelMetadata,
  ModelRegistryEntry,
  ModelHealthCheck,
  ModelBenchmark
} from '../types';

export class ModelRegistry {
  private static instance: ModelRegistry;
  private registry: Map<string, ModelRegistryEntry> = new Map();
  private modelVersions: Map<string, ModelMetadata[]> = new Map(); // modelName -> versions
  private activeModels: Set<string> = new Set();
  
  // Configuration
  private readonly config = {
    maxVersionsPerModel: 5,
    healthCheckInterval: 60000, // 1 minute
    benchmarkInterval: 300000, // 5 minutes
    autoLoadPopularModels: true,
    defaultModelTimeout: 30000 // 30 seconds
  };

  // Built-in model definitions
  private readonly builtInModels: ModelMetadata[] = [
    {
      id: 'price-prediction-lstm-v1',
      name: 'Price Prediction LSTM',
      version: '1.0.0',
      description: 'LSTM model for cryptocurrency price prediction',
      inputShape: [60, 5], // 60 timesteps, 5 features (OHLCV)
      outputShape: [1], // Single price prediction
      modelUrl: '/models/price-prediction-lstm-v1/model.json',
      weightsUrl: '/models/price-prediction-lstm-v1/',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['price', 'lstm', 'timeseries', 'crypto'],
      accuracy: 0.78,
      size: 2.5 * 1024 * 1024 // 2.5MB
    },
    {
      id: 'trend-classifier-cnn-v1',
      name: 'Trend Classification CNN',
      version: '1.0.0', 
      description: 'CNN model for trend classification (up/down/sideways)',
      inputShape: [32, 32, 3], // 32x32 candlestick pattern image
      outputShape: [3], // 3 classes: up, down, sideways
      modelUrl: '/models/trend-classifier-cnn-v1/model.json',
      weightsUrl: '/models/trend-classifier-cnn-v1/',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['trend', 'cnn', 'classification', 'pattern'],
      accuracy: 0.82,
      size: 5.2 * 1024 * 1024 // 5.2MB
    },
    {
      id: 'volatility-predictor-gru-v1',
      name: 'Volatility Prediction GRU',
      version: '1.0.0',
      description: 'GRU model for volatility prediction',
      inputShape: [30, 8], // 30 timesteps, 8 technical indicators
      outputShape: [1], // Single volatility prediction
      modelUrl: '/models/volatility-predictor-gru-v1/model.json',
      weightsUrl: '/models/volatility-predictor-gru-v1/',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['volatility', 'gru', 'risk', 'technical'],
      accuracy: 0.75,
      size: 1.8 * 1024 * 1024 // 1.8MB
    }
  ];

  // Health check scheduler
  private healthCheckTimer?: NodeJS.Timeout;
  private benchmarkTimer?: NodeJS.Timeout;

  private constructor() {
    this.initializeRegistry();
    this.startHealthChecks();
    this.startBenchmarks();
  }

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Initialize registry with built-in models
   */
  private async initializeRegistry(): Promise<void> {
    console.log('🚀 Initializing Model Registry...');
    
    for (const metadata of this.builtInModels) {
      await this.registerModel(metadata);
    }

    // Auto-load popular models if enabled
    if (this.config.autoLoadPopularModels) {
      await this.autoLoadPopularModels();
    }

    console.log(`✅ Model Registry initialized with ${this.registry.size} models`);
  }

  /**
   * Register a new model in the registry
   */
  public async registerModel(metadata: ModelMetadata): Promise<void> {
    try {
      // Validate metadata
      this.validateModelMetadata(metadata);

      // Create registry entry
      const entry: ModelRegistryEntry = {
        metadata,
        isLoaded: false,
        isActive: false,
        loadError: undefined,
        performance: undefined,
        lastHealthCheck: 0
      };

      // Store in registry
      this.registry.set(metadata.id, entry);

      // Track versions
      const modelName = metadata.name;
      if (!this.modelVersions.has(modelName)) {
        this.modelVersions.set(modelName, []);
      }
      
      const versions = this.modelVersions.get(modelName)!;
      versions.push(metadata);
      
      // Keep only max versions
      if (versions.length > this.config.maxVersionsPerModel) {
        const oldVersion = versions.shift();
        if (oldVersion) {
          await this.unregisterModel(oldVersion.id);
        }
      }

      console.log(`📝 Model ${metadata.id} registered successfully`);

    } catch (error) {
      console.error(`❌ Failed to register model ${metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a model from the registry
   */
  public async unregisterModel(modelId: string): Promise<void> {
    const entry = this.registry.get(modelId);
    if (!entry) {
      console.warn(`Model ${modelId} not found in registry`);
      return;
    }

    try {
      // Unload if loaded
      if (entry.isLoaded) {
        await modelManager.unloadModel(modelId);
      }

      // Remove from active models
      this.activeModels.delete(modelId);

      // Remove from registry
      this.registry.delete(modelId);

      // Remove from versions
      const versions = this.modelVersions.get(entry.metadata.name);
      if (versions) {
        const index = versions.findIndex(v => v.id === modelId);
        if (index >= 0) {
          versions.splice(index, 1);
        }
      }

      console.log(`🗑️ Model ${modelId} unregistered successfully`);

    } catch (error) {
      console.error(`❌ Failed to unregister model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Load a model and mark as active
   */
  public async loadModel(modelId: string): Promise<void> {
    const entry = this.registry.get(modelId);
    if (!entry) {
      throw new Error(`Model ${modelId} not found in registry`);
    }

    try {
      // Load model using ModelManager
      await modelManager.loadModel(entry.metadata);
      
      // Warm up the model
      await modelManager.warmModel(modelId, entry.metadata.inputShape);
      
      // Update registry entry
      entry.isLoaded = true;
      entry.isActive = true;
      entry.loadError = undefined;
      
      // Add to active models
      this.activeModels.add(modelId);
      
      console.log(`✅ Model ${modelId} loaded and activated`);

    } catch (error) {
      entry.loadError = error instanceof Error ? error.message : String(error);
      entry.isLoaded = false;
      entry.isActive = false;
      
      console.error(`❌ Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Unload a model
   */
  public async unloadModel(modelId: string): Promise<void> {
    const entry = this.registry.get(modelId);
    if (!entry) {
      console.warn(`Model ${modelId} not found in registry`);
      return;
    }

    try {
      await modelManager.unloadModel(modelId);
      
      entry.isLoaded = false;
      entry.isActive = false;
      this.activeModels.delete(modelId);
      
      console.log(`📤 Model ${modelId} unloaded`);

    } catch (error) {
      console.error(`❌ Failed to unload model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get model metadata by ID
   */
  public getModel(modelId: string): ModelMetadata | null {
    const entry = this.registry.get(modelId);
    return entry ? entry.metadata : null;
  }

  /**
   * Get all models in registry
   */
  public getAllModels(): ModelRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get models by name (all versions)
   */
  public getModelVersions(modelName: string): ModelMetadata[] {
    return this.modelVersions.get(modelName) || [];
  }

  /**
   * Get latest version of a model
   */
  public getLatestVersion(modelName: string): ModelMetadata | null {
    const versions = this.getModelVersions(modelName);
    if (versions.length === 0) return null;
    
    return versions.reduce((latest, current) => {
      return this.compareVersions(current.version, latest.version) > 0 ? current : latest;
    });
  }

  /**
   * Get active models
   */
  public getActiveModels(): ModelRegistryEntry[] {
    return Array.from(this.activeModels)
      .map(id => this.registry.get(id))
      .filter(entry => entry !== undefined) as ModelRegistryEntry[];
  }

  /**
   * Search models by tags
   */
  public searchByTags(tags: string[]): ModelMetadata[] {
    const results: ModelMetadata[] = [];
    
    for (const entry of this.registry.values()) {
      const hasAnyTag = tags.some(tag => 
        entry.metadata.tags.includes(tag.toLowerCase())
      );
      
      if (hasAnyTag) {
        results.push(entry.metadata);
      }
    }
    
    return results;
  }

  /**
   * Get model recommendations based on use case
   */
  public getRecommendations(useCase: string, maxResults = 5): ModelMetadata[] {
    const useCaseMap: Record<string, string[]> = {
      'price_prediction': ['price', 'lstm', 'timeseries'],
      'trend_analysis': ['trend', 'classification', 'pattern'],
      'risk_management': ['volatility', 'risk', 'technical'],
      'portfolio_optimization': ['portfolio', 'optimization', 'allocation']
    };
    
    const tags = useCaseMap[useCase] || [useCase];
    const candidates = this.searchByTags(tags);
    
    // Sort by accuracy and recency
    return candidates
      .sort((a, b) => {
        const accuracyDiff = (b.accuracy || 0) - (a.accuracy || 0);
        if (Math.abs(accuracyDiff) > 0.05) return accuracyDiff;
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, maxResults);
  }

  /**
   * Perform health check on all active models
   */
  public async performHealthChecks(): Promise<Map<string, ModelHealthCheck>> {
    const results = new Map<string, ModelHealthCheck>();
    
    for (const modelId of this.activeModels) {
      try {
        const healthCheck = await modelManager.healthCheck(modelId);
        results.set(modelId, healthCheck);
        
        // Update registry entry
        const entry = this.registry.get(modelId);
        if (entry) {
          entry.lastHealthCheck = Date.now();
          
          if (!healthCheck.isHealthy) {
            entry.isActive = false;
            this.activeModels.delete(modelId);
            console.warn(`⚠️ Model ${modelId} failed health check, marking as inactive`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Health check failed for model ${modelId}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Benchmark model performance
   */
  public async benchmarkModel(
    modelId: string, 
    batchSizes = [1, 4, 8, 16, 32]
  ): Promise<ModelBenchmark> {
    const entry = this.registry.get(modelId);
    if (!entry || !entry.isLoaded) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    const results: ModelBenchmark['results'] = [];
    
    for (const batchSize of batchSizes) {
      try {
        // Create dummy input batch
        const batch = Array(batchSize).fill(0).map(() => ({
          features: new Float32Array(entry.metadata.inputShape.reduce((a, b) => a * b, 1)),
          symbol: 'TEST',
          timestamp: Date.now(),
          modelId
        }));

        // Benchmark batch prediction
        const startTime = performance.now();
        const startMemory = modelManager.getMemoryInfo().numBytes;
        
        await predictionEngine.batchPredict({ batch, modelId });
        
        const endTime = performance.now();
        const endMemory = modelManager.getMemoryInfo().numBytes;
        
        const totalTime = endTime - startTime;
        const throughput = batchSize / (totalTime / 1000); // predictions per second
        const memoryPeak = endMemory - startMemory;
        
        results.push({
          batchSize,
          averageTime: totalTime / batchSize,
          throughput,
          memoryPeak
        });
        
      } catch (error) {
        console.error(`Benchmark failed for batch size ${batchSize}:`, error);
      }
    }

    return {
      modelId,
      inputShape: entry.metadata.inputShape,
      batchSizes,
      results,
      backend: modelManager.getBackendInfo().backend,
      timestamp: Date.now()
    };
  }

  /**
   * Get registry statistics
   */
  public getStatistics() {
    const totalModels = this.registry.size;
    const loadedModels = Array.from(this.registry.values()).filter(e => e.isLoaded).length;
    const activeModels = this.activeModels.size;
    const modelsByTag = new Map<string, number>();
    
    for (const entry of this.registry.values()) {
      for (const tag of entry.metadata.tags) {
        modelsByTag.set(tag, (modelsByTag.get(tag) || 0) + 1);
      }
    }
    
    return {
      totalModels,
      loadedModels,
      activeModels,
      modelsByTag: Object.fromEntries(modelsByTag),
      memoryUsage: modelManager.getMemoryInfo(),
      backend: modelManager.getBackendInfo()
    };
  }

  // Private helper methods

  private async autoLoadPopularModels(): Promise<void> {
    const popularModels = ['price-prediction-lstm-v1', 'trend-classifier-cnn-v1'];
    
    for (const modelId of popularModels) {
      try {
        await this.loadModel(modelId);
      } catch (error) {
        console.warn(`Failed to auto-load model ${modelId}:`, error);
      }
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('Health check cycle failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  private startBenchmarks(): void {
    this.benchmarkTimer = setInterval(async () => {
      try {
        for (const modelId of this.activeModels) {
          const benchmark = await this.benchmarkModel(modelId, [1, 8]);
          console.log(`📊 Benchmark for ${modelId}:`, benchmark.results);
        }
      } catch (error) {
        console.error('Benchmark cycle failed:', error);
      }
    }, this.config.benchmarkInterval);
  }

  private validateModelMetadata(metadata: ModelMetadata): void {
    if (!metadata.id || metadata.id.trim() === '') {
      throw new Error('Model ID is required');
    }
    
    if (!metadata.name || metadata.name.trim() === '') {
      throw new Error('Model name is required');
    }
    
    if (!metadata.version || metadata.version.trim() === '') {
      throw new Error('Model version is required');
    }
    
    if (!metadata.modelUrl || metadata.modelUrl.trim() === '') {
      throw new Error('Model URL is required');
    }
    
    if (!metadata.inputShape || metadata.inputShape.length === 0) {
      throw new Error('Input shape is required');
    }
    
    if (!metadata.outputShape || metadata.outputShape.length === 0) {
      throw new Error('Output shape is required');
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.benchmarkTimer) {
      clearInterval(this.benchmarkTimer);
    }
    
    console.log('🧹 Model Registry cleaned up');
  }
}

// Export singleton instance
export const modelRegistry = ModelRegistry.getInstance();