// ML Module Index - TensorFlow.js Integration for Algorithmic Trading
// Export all ML components for easy access throughout the application

// Core ML Infrastructure
export { ModelManager, modelManager } from './inference/ModelManager';
export { PredictionEngine, predictionEngine } from './inference/PredictionEngine';
export { ModelRegistry, modelRegistry } from './models/ModelRegistry';

// ML Types and Interfaces
export * from './types';

// Prediction Models (ML-003) - Advanced prediction models
export { PricePredictionModel, DEFAULT_PRICE_PREDICTION_CONFIGS } from './models/PricePredictionModel';
export { MarketRegimeModel, DEFAULT_REGIME_CONFIG } from './models/MarketRegimeModel';
export { VolatilityModel, DEFAULT_VOLATILITY_CONFIG } from './models/VolatilityModel';

// Model Ensemble System
export { ModelEnsemble, DEFAULT_ENSEMBLE_CONFIGS } from './ensemble/ModelEnsemble';

// Model Training Framework
export { ModelTrainer, DEFAULT_TRAINING_CONFIGS } from './training/ModelTrainer';

// Feature Engineering (ML-002) - All feature types and components
export * from './features';

// React Query Hooks
export {
  useMLModel,
  useMLModels,
  useActiveMLModels,
  useMLPrediction,
  useMLBatchPrediction,
  useStreamingMLPrediction,
  useMLModelHealth,
  useMLModelBenchmark,
  useMLStatistics,
  useMLModelSearch,
  useMLRecommendations,
  useLoadMLModel,
  useUnloadMLModel,
  useRegisterMLModel,
  useWarmMLModel,
  useMLModelLifecycle,
  useRealTimeMLPrediction
} from '../hooks/useMLPredictions';

// Feature Engineering Hooks (ML-002)
export {
  useHistoricalFeatures,
  useStreamingFeatures,
  useTrainingFeatures,
  useFeatureValidation,
  useFeatureImportance,
  useFeatureEngineMetrics,
  useFeatureBasedPrediction,
  useMultiTimeframeFeatures,
  useCrossSymbolFeatures,
  useClearFeatureCache,
  useComputeFeatures,
  useFeatureAnalysis
} from '../hooks/useFeatures';

// ML Constants and Configuration
export const ML_CONFIG = {
  // Model Configuration
  DEFAULT_MODELS: [
    'price-prediction-lstm-v1',
    'trend-classifier-cnn-v1',
    'volatility-predictor-gru-v1'
  ],
  
  // Performance Thresholds
  PERFORMANCE_THRESHOLDS: {
    MAX_INFERENCE_TIME: 1000, // milliseconds
    MIN_ACCURACY: 0.7,
    MAX_MEMORY_USAGE: 500 * 1024 * 1024, // 500MB
    CACHE_TTL: 30 * 60 * 1000 // 30 minutes
  },
  
  // Backend Configuration
  BACKENDS: {
    PRIMARY: 'webgl',
    FALLBACK: ['wasm', 'cpu']
  },
  
  // Feature Engineering
  FEATURE_WINDOWS: {
    LSTM_LOOKBACK: 60,
    CNN_WINDOW: 32,
    TECHNICAL_INDICATORS: 20
  },
  
  // Real-time Processing
  STREAMING: {
    PREDICTION_INTERVAL: 5000, // 5 seconds
    BATCH_SIZE: 16,
    MAX_CONCURRENT_PREDICTIONS: 8
  }
} as const;

// ML Utility Functions
export const MLUtils = {
  /**
   * Initialize ML system - call this early in app lifecycle
   */
  async initializeMLSystem(): Promise<void> {
    try {
      console.log('🚀 Initializing ML System...');
      
      // Initialize model manager (this will set up TensorFlow.js backend)
      const { modelManager } = await import('./inference/ModelManager');
      const backendInfo = modelManager.getBackendInfo();
      console.log(`📊 TensorFlow.js backend: ${backendInfo.backend} (${backendInfo.initialized ? 'ready' : 'initializing'})`);
      
      // Initialize model registry with built-in models
      const { modelRegistry } = await import('./models/ModelRegistry');
      const stats = modelRegistry.getStatistics();
      console.log(`📝 Model Registry: ${stats.totalModels} models registered`);
      
      // Load popular models if configured
      const popularModels = ['price-prediction-lstm-v1'];
      for (const modelId of popularModels) {
        try {
          await modelRegistry.loadModel(modelId);
          console.log(`✅ Loaded model: ${modelId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load model ${modelId}:`, error);
        }
      }
      
      console.log('✅ ML System initialized successfully');
      
    } catch (error) {
      console.error('❌ ML System initialization failed:', error);
      throw error;
    }
  },
  
  /**
   * Get system status and health
   */
  async getSystemStatus() {
    const { modelManager } = await import('./inference/ModelManager');
    const { modelRegistry } = await import('./models/ModelRegistry');
    const backendInfo = modelManager.getBackendInfo();
    const memoryInfo = modelManager.getMemoryInfo();
    const registryStats = modelRegistry.getStatistics();
    
    return {
      backend: backendInfo,
      memory: memoryInfo,
      registry: registryStats,
      isHealthy: backendInfo.initialized && memoryInfo.numTensors >= 0,
      timestamp: new Date().toISOString()
    };
  },
  
  /**
   * Cleanup ML resources - call during app shutdown
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up ML System...');
      
      // Cleanup model registry
      const { modelRegistry } = await import('./models/ModelRegistry');
      modelRegistry.cleanup();
      
      // Cleanup any remaining tensors
      const { modelManager } = await import('./inference/ModelManager');
      const memoryInfo = modelManager.getMemoryInfo();
      console.log(`📊 Final memory state: ${memoryInfo.numTensors} tensors, ${memoryInfo.numBytes} bytes`);
      
      console.log('✅ ML System cleaned up');
      
    } catch (error) {
      console.error('❌ ML cleanup error:', error);
    }
  },
  
  /**
   * Validate model readiness for production use
   */
  async validateModelReadiness(modelId: string): Promise<{
    isReady: boolean;
    checks: Record<string, boolean>;
    errors: string[];
  }> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    
    try {
      // Check if model is registered
      const { modelRegistry } = await import('./models/ModelRegistry');
      const model = modelRegistry.getModel(modelId);
      checks.registered = !!model;
      if (!model) {
        errors.push(`Model ${modelId} not found in registry`);
      }
      
      // Check if model is loaded
      const { modelManager } = await import('./inference/ModelManager');
      const cachedModel = modelManager.getCachedModel(modelId);
      checks.loaded = !!cachedModel;
      if (!cachedModel) {
        errors.push(`Model ${modelId} not loaded in cache`);
      }
      
      // Run health check
      const healthCheck = await modelManager.healthCheck(modelId);
      checks.healthy = healthCheck.isHealthy;
      if (!healthCheck.isHealthy) {
        errors.push(`Model ${modelId} failed health check`);
      }
      
      // Check performance metrics
      checks.performant = healthCheck.latency < ML_CONFIG.PERFORMANCE_THRESHOLDS.MAX_INFERENCE_TIME;
      if (healthCheck.latency >= ML_CONFIG.PERFORMANCE_THRESHOLDS.MAX_INFERENCE_TIME) {
        errors.push(`Model ${modelId} exceeds latency threshold`);
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }
    
    const isReady = Object.values(checks).every(check => check) && errors.length === 0;
    
    return { isReady, checks, errors };
  },
  
  /**
   * Format prediction result for display
   */
  formatPrediction(prediction: any): string {
    if (typeof prediction === 'number') {
      return prediction.toFixed(4);
    }
    
    if (Array.isArray(prediction)) {
      return prediction.map(p => p.toFixed(4)).join(', ');
    }
    
    return String(prediction);
  }
};

// Default export with commonly used components
export default {
  MLUtils,
  ML_CONFIG
};