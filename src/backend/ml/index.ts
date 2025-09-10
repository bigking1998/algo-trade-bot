/**
 * ML Module Index - Comprehensive Machine Learning System
 * 
 * This module provides a complete ML pipeline for algorithmic trading including:
 * - TensorFlow.js integration and setup
 * - Feature engineering and data preprocessing
 * - Basic and advanced ML models
 * - Model training and optimization pipelines
 * - Online learning and concept drift detection
 * - Predictive analytics for trading decisions
 * - ML-enhanced trading strategies
 * - Model versioning and performance monitoring
 */

// Core ML Infrastructure
export { TensorFlowSetup, getTensorFlowSetup, cleanupTensorFlow, DEFAULT_TENSORFLOW_CONFIG } from './TensorFlowSetup';
export type { TensorFlowConfig, ModelLoadOptions, ModelSaveOptions, TensorFlowMetrics } from './TensorFlowSetup';

// Feature Engineering
export { FeatureEngineeringPipeline } from './FeatureEngineering';
export type { 
  CandleData, 
  FeatureExtractionConfig, 
  ComputedFeatures, 
  FeatureImportance, 
  FeatureStatistics 
} from './FeatureEngineering';

// Basic ML Models
export { BasicMLModels } from './BasicMLModels';
export type { 
  TrainingData, 
  ModelConfig, 
  NeuralNetworkConfig, 
  TrainingResult, 
  ModelMetrics, 
  PredictionResult, 
  ModelComparison 
} from './BasicMLModels';

// ML Strategy Base
export { MLStrategyBase } from './MLStrategyBase';
export type { 
  MLStrategyConfig, 
  MLSignal, 
  MLStrategyPerformance, 
  RetrainingTrigger 
} from './MLStrategyBase';

// Training Pipeline
export { ModelTrainingPipeline } from './ModelTrainingPipeline';
export type { TrainingPipelineConfig } from './ModelTrainingPipeline';

// Advanced Architectures
export { AdvancedModelArchitectures } from './AdvancedModelArchitectures';
export type { LSTMConfig, CNNConfig } from './AdvancedModelArchitectures';

// Online Learning
export { OnlineLearningSystem } from './OnlineLearningSystem';
export type { OnlineLearningConfig, ConceptDriftMetrics } from './OnlineLearningSystem';

// Predictive Analytics
export { PredictiveAnalyticsEngine } from './PredictiveAnalytics';
export type { 
  PricePrediction, 
  VolatilityForecast, 
  TrendStrengthAnalysis, 
  MarketTimingSignal 
} from './PredictiveAnalytics';

// Model Management (existing)
export { ModelVersionManager } from './ModelVersionManager';
export { MLPerformanceMonitor } from './MLPerformanceMonitor';
export { DriftDetector } from './DriftDetector';

// Re-export types from frontend ML types
export type { 
  ModelMetadata, 
  ModelCacheEntry, 
  PerformanceMetrics, 
  MLStrategy 
} from '../../frontend/ml/types';

/**
 * ML System Factory for creating complete ML pipeline
 */
export class MLSystemFactory {
  static async createCompletePipeline(config: {
    tensorflowConfig?: Partial<TensorFlowConfig>;
    featureConfig?: Partial<FeatureExtractionConfig>;
    onlineLearningConfig?: OnlineLearningConfig;
  } = {}) {
    // Initialize TensorFlow
    const tfSetup = getTensorFlowSetup(config.tensorflowConfig);
    await tfSetup.initialize();
    
    // Create components
    const featureEngine = new FeatureEngineeringPipeline(config.featureConfig);
    const mlModels = new BasicMLModels();
    const trainingPipeline = new ModelTrainingPipeline();
    const advancedModels = new AdvancedModelArchitectures();
    const onlineLearning = config.onlineLearningConfig 
      ? new OnlineLearningSystem(config.onlineLearningConfig)
      : null;
    const predictiveAnalytics = new PredictiveAnalyticsEngine();
    
    return {
      tfSetup,
      featureEngine,
      mlModels,
      trainingPipeline,
      advancedModels,
      onlineLearning,
      predictiveAnalytics
    };
  }
}

export default MLSystemFactory;