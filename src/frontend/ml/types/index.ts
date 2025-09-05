// ML Types and Interfaces for TensorFlow.js Integration
import * as tf from '@tensorflow/tfjs';

// Backend Types
export type MLBackendType = 'webgl' | 'wasm' | 'cpu';

export interface BackendConfig {
  type: MLBackendType;
  priority: number;
  fallbackTo?: MLBackendType;
}

// Model Management Types
export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  inputShape: number[];
  outputShape: number[];
  modelUrl: string;
  weightsUrl: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  accuracy?: number;
  size?: number; // in bytes
}

export interface ModelCacheEntry {
  model: tf.LayersModel;
  metadata: ModelMetadata;
  loadedAt: number;
  lastUsed: number;
  warmupCompleted: boolean;
}

// Prediction Types
export interface PredictionInput {
  features: Float32Array | number[];
  symbol: string;
  timestamp: number;
  modelId: string;
}

export interface PredictionResult {
  prediction: number | number[];
  confidence: number;
  modelId: string;
  symbol: string;
  timestamp: number;
  processingTime: number; // in milliseconds
  features?: Float32Array;
  rawOutput?: tf.Tensor;
}

export interface BatchPredictionInput {
  batch: PredictionInput[];
  modelId: string;
}

export interface BatchPredictionResult {
  results: PredictionResult[];
  batchSize: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  failedPredictions: number;
}

// Feature Engineering Types
export interface FeatureConfig {
  name: string;
  type: 'price' | 'volume' | 'technical' | 'macro' | 'sentiment';
  lookbackPeriod: number;
  normalization?: 'minmax' | 'zscore' | 'none';
  required: boolean;
}

export interface FeatureVector {
  features: Float32Array;
  featureNames: string[];
  timestamp: number;
  symbol: string;
}

// Performance Monitoring Types
export interface PerformanceMetrics {
  modelId: string;
  loadTime: number;
  averageInferenceTime: number;
  memoryUsage: number;
  gpuMemoryUsage?: number;
  cacheHitRate: number;
  errorRate: number;
  totalPredictions: number;
  timestamp: number;
}

export interface ModelBenchmark {
  modelId: string;
  inputShape: number[];
  batchSizes: number[];
  results: {
    batchSize: number;
    averageTime: number;
    throughput: number; // predictions per second
    memoryPeak: number;
  }[];
  backend: MLBackendType;
  timestamp: number;
}

// Training and Validation Types
export interface TrainingData {
  features: tf.Tensor;
  labels: tf.Tensor;
  validationFeatures?: tf.Tensor;
  validationLabels?: tf.Tensor;
  metadata: {
    symbol: string;
    startDate: number;
    endDate: number;
    sampleCount: number;
    featureCount: number;
  };
}

export interface ModelTrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStopping: boolean;
  patience?: number;
  optimizer: 'adam' | 'sgd' | 'rmsprop';
  loss: 'meanSquaredError' | 'meanAbsoluteError' | 'binaryCrossentropy';
}

// Error Types
export interface MLError {
  code: string;
  message: string;
  modelId?: string;
  timestamp: number;
  context?: Record<string, any>;
}

export type MLErrorType = 
  | 'MODEL_LOAD_FAILED'
  | 'PREDICTION_FAILED'
  | 'BACKEND_INIT_FAILED'
  | 'MEMORY_ERROR'
  | 'TENSOR_SHAPE_ERROR'
  | 'CACHE_ERROR'
  | 'WARMUP_FAILED';

// Strategy Integration Types
export interface MLStrategy {
  id: string;
  name: string;
  modelIds: string[];
  config: {
    thresholds: {
      buySignal: number;
      sellSignal: number;
      confidence: number;
    };
    riskManagement: {
      maxPosition: number;
      stopLoss: number;
      takeProfit: number;
    };
    features: FeatureConfig[];
  };
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

// Real-time Processing Types
export interface StreamingPrediction {
  symbol: string;
  modelId: string;
  prediction: PredictionResult;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-1
  timestamp: number;
}

export interface PredictionStream {
  symbol: string;
  modelIds: string[];
  interval: number; // milliseconds
  isActive: boolean;
  lastUpdate: number;
}

// Model Registry Types
export interface ModelRegistryEntry {
  metadata: ModelMetadata;
  isLoaded: boolean;
  isActive: boolean;
  loadError?: string;
  performance?: PerformanceMetrics;
  lastHealthCheck: number;
}

export interface ModelHealthCheck {
  modelId: string;
  isHealthy: boolean;
  latency: number;
  memoryUsage: number;
  errorCount: number;
  lastError?: MLError;
  timestamp: number;
}

// Cache Configuration
export interface CacheConfig {
  maxSize: number; // maximum number of models
  maxMemory: number; // maximum memory usage in bytes
  ttl: number; // time to live in milliseconds
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

// Hook Configuration Types
export interface UsePredictionConfig {
  symbol: string;
  modelId: string;
  features?: FeatureVector;
  realTime?: boolean;
  interval?: number;
  enabled?: boolean;
}

export interface UseModelConfig {
  modelId: string;
  autoLoad?: boolean;
  warmUp?: boolean;
  fallbackBackend?: MLBackendType;
}

// Validation Types
export interface ModelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  inputShapeValid: boolean;
  outputShapeValid: boolean;
  weightsValid: boolean;
  metadataValid: boolean;
}