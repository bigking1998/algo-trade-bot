// PredictionEngine.ts - Real-time ML Inference Engine
import * as tf from '@tensorflow/tfjs';
import { modelManager } from './ModelManager';
import {
  PredictionInput,
  PredictionResult,
  BatchPredictionInput,
  BatchPredictionResult,
  MLErrorType,
  StreamingPrediction
} from '../types';

export class PredictionEngine {
  private static instance: PredictionEngine;
  
  // Performance optimization settings
  private readonly batchConfig = {
    maxBatchSize: 32,
    batchTimeout: 100, // milliseconds
    enableAutoBatching: true
  };
  
  // Pending predictions for batching
  private pendingPredictions: Map<string, {
    inputs: PredictionInput[];
    resolvers: Array<(result: PredictionResult) => void>;
    rejectors: Array<(error: Error) => void>;
    timestamp: number;
  }> = new Map();
  
  // Streaming predictions cache
  private streamingCache: Map<string, {
    result: PredictionResult;
    timestamp: number;
    ttl: number;
  }> = new Map();

  private constructor() {
    // Set up periodic batch processing
    if (this.batchConfig.enableAutoBatching) {
      setInterval(() => this.processPendingBatches(), this.batchConfig.batchTimeout);
    }
    
    // Set up cache cleanup
    setInterval(() => this.cleanupStreamingCache(), 5000);
  }

  public static getInstance(): PredictionEngine {
    if (!PredictionEngine.instance) {
      PredictionEngine.instance = new PredictionEngine();
    }
    return PredictionEngine.instance;
  }

  /**
   * Make a single prediction with automatic batching
   */
  public async predict(input: PredictionInput): Promise<PredictionResult> {
    try {
      // Check streaming cache first
      const cacheKey = `${input.modelId}-${input.symbol}`;
      const cached = this.streamingCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return { ...cached.result, timestamp: Date.now() };
      }

      // Validate input
      this.validatePredictionInput(input);

      // Get model from cache
      const model = modelManager.getCachedModel(input.modelId);
      if (!model) {
        throw this.createMLError('PREDICTION_FAILED', 
          `Model ${input.modelId} not loaded`, 
          input.modelId
        );
      }

      // Auto-batching enabled - queue for batch processing
      if (this.batchConfig.enableAutoBatching) {
        return this.addToBatch(input);
      }

      // Direct prediction
      return this.executeSinglePrediction(model, input);

    } catch (error) {
      console.error('Prediction failed:', error);
      throw error;
    }
  }

  /**
   * Make batch predictions optimized for throughput
   */
  public async batchPredict(batchInput: BatchPredictionInput): Promise<BatchPredictionResult> {
    const startTime = performance.now();
    const results: PredictionResult[] = [];
    let failedPredictions = 0;

    try {
      // Validate batch input
      if (!batchInput.batch || batchInput.batch.length === 0) {
        throw new Error('Batch input cannot be empty');
      }

      if (batchInput.batch.length > this.batchConfig.maxBatchSize) {
        throw new Error(`Batch size ${batchInput.batch.length} exceeds maximum ${this.batchConfig.maxBatchSize}`);
      }

      // Get model
      const model = modelManager.getCachedModel(batchInput.modelId);
      if (!model) {
        throw this.createMLError('PREDICTION_FAILED', 
          `Model ${batchInput.modelId} not loaded`, 
          batchInput.modelId
        );
      }

      // Prepare batch tensor
      const batchFeatures = this.prepareBatchTensor(batchInput.batch);
      const batchStartTime = performance.now();

      // Execute batch prediction
      const batchPrediction = model.predict(batchFeatures) as tf.Tensor;
      const batchResults = await batchPrediction.data();
      const batchProcessingTime = performance.now() - batchStartTime;

      // Process individual results
      for (let i = 0; i < batchInput.batch.length; i++) {
        try {
          const input = batchInput.batch[i];
          const predictionValue = Array.from(batchResults).slice(
            i * this.getOutputSize(model),
            (i + 1) * this.getOutputSize(model)
          );

          const confidence = this.calculateConfidence(predictionValue);
          
          results.push({
            prediction: predictionValue.length === 1 ? predictionValue[0] : predictionValue,
            confidence,
            modelId: input.modelId,
            symbol: input.symbol,
            timestamp: input.timestamp,
            processingTime: batchProcessingTime / batchInput.batch.length,
            features: input.features instanceof Float32Array ? input.features : new Float32Array(Array.from(input.features))
          });

        } catch (error) {
          failedPredictions++;
          console.error(`Failed to process batch item ${i}:`, error);
        }
      }

      // Cleanup tensors
      batchFeatures.dispose();
      batchPrediction.dispose();

      const totalProcessingTime = performance.now() - startTime;

      return {
        results,
        batchSize: batchInput.batch.length,
        totalProcessingTime,
        averageProcessingTime: totalProcessingTime / batchInput.batch.length,
        failedPredictions
      };

    } catch (error) {
      console.error('Batch prediction failed:', error);
      throw error;
    }
  }

  /**
   * Get confidence score from prediction tensor
   */
  public getConfidenceScore(prediction: tf.Tensor): number {
    try {
      // For classification models, use softmax confidence
      const softmax = tf.softmax(prediction);
      const maxProb = tf.max(softmax);
      return maxProb.dataSync()[0];
    } catch (error) {
      console.warn('Failed to calculate confidence score:', error);
      return 0.5; // Default confidence
    }
  }

  /**
   * Create streaming prediction for real-time updates
   */
  public async createStreamingPrediction(
    input: PredictionInput,
    signal: 'BUY' | 'SELL' | 'HOLD',
    strength: number,
    cacheTtl = 5000
  ): Promise<StreamingPrediction> {
    const prediction = await this.predict(input);
    
    const streamingPrediction: StreamingPrediction = {
      symbol: input.symbol,
      modelId: input.modelId,
      prediction,
      signal,
      strength: Math.max(0, Math.min(1, strength)),
      timestamp: Date.now()
    };

    // Cache for streaming performance
    const cacheKey = `${input.modelId}-${input.symbol}`;
    this.streamingCache.set(cacheKey, {
      result: prediction,
      timestamp: Date.now(),
      ttl: cacheTtl
    });

    return streamingPrediction;
  }

  /**
   * Preprocess features for prediction
   */
  public preprocessFeatures(features: number[], featureConfig?: any): Float32Array {
    try {
      // Basic normalization and validation
      if (!features || features.length === 0) {
        throw new Error('Features cannot be empty');
      }

      // Convert to Float32Array with proper type handling
      const featuresArray = Array.from(features);
      let processedFeatures: Float32Array = new Float32Array(featuresArray.length);
      for (let i = 0; i < featuresArray.length; i++) {
        processedFeatures[i] = featuresArray[i];
      }

      // Apply normalization if configured
      if (featureConfig?.normalization) {
        switch (featureConfig.normalization) {
          case 'minmax':
            processedFeatures = this.minMaxNormalize(processedFeatures);
            break;
          case 'zscore':
            processedFeatures = this.zScoreNormalize(processedFeatures);
            break;
          case 'none':
          default:
            // No normalization
            break;
        }
      }

      return processedFeatures;

    } catch (error) {
      throw this.createMLError('TENSOR_SHAPE_ERROR', 
        `Feature preprocessing failed: ${error}`
      );
    }
  }

  /**
   * Validate model health and performance
   */
  public async validatePredictionHealth(modelId: string): Promise<{
    isHealthy: boolean;
    latency: number;
    memoryUsage: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let latency = -1;
    let memoryUsage = 0;

    try {
      const healthCheck = await modelManager.healthCheck(modelId);
      latency = healthCheck.latency;
      memoryUsage = healthCheck.memoryUsage;
      
      if (!healthCheck.isHealthy) {
        errors.push('Model health check failed');
      }

      if (latency > 1000) {
        errors.push('High prediction latency detected');
      }

      const memInfo = modelManager.getMemoryInfo();
      if (memInfo.numBytes > 1024 * 1024 * 1024) { // 1GB
        errors.push('High memory usage detected');
      }

      return {
        isHealthy: errors.length === 0,
        latency,
        memoryUsage,
        errors
      };

    } catch (error) {
      errors.push(`Health validation failed: ${error}`);
      return {
        isHealthy: false,
        latency,
        memoryUsage,
        errors
      };
    }
  }

  // Private helper methods

  private async executeSinglePrediction(
    model: tf.LayersModel,
    input: PredictionInput
  ): Promise<PredictionResult> {
    const startTime = performance.now();

    try {
      // Prepare input tensor
      const features = input.features instanceof Float32Array ? 
        input.features : new Float32Array(input.features);
      
      const inputTensor = tf.tensor2d([Array.from(features)]);
      
      // Make prediction
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();
      
      // Calculate confidence
      const confidence = this.calculateConfidence(Array.from(predictionData));
      
      const processingTime = performance.now() - startTime;
      
      // Cleanup
      inputTensor.dispose();
      prediction.dispose();
      
      return {
        prediction: predictionData.length === 1 ? predictionData[0] : Array.from(predictionData),
        confidence,
        modelId: input.modelId,
        symbol: input.symbol,
        timestamp: input.timestamp,
        processingTime,
        features
      };

    } catch (error) {
      throw this.createMLError('PREDICTION_FAILED', 
        `Single prediction execution failed: ${error}`, 
        input.modelId
      );
    }
  }

  private addToBatch(input: PredictionInput): Promise<PredictionResult> {
    return new Promise((resolve, reject) => {
      const pending = this.pendingPredictions.get(input.modelId) || {
        inputs: [],
        resolvers: [],
        rejectors: [],
        timestamp: Date.now()
      };

      pending.inputs.push(input);
      pending.resolvers.push(resolve);
      pending.rejectors.push(reject);

      this.pendingPredictions.set(input.modelId, pending);

      // Process immediately if batch is full
      if (pending.inputs.length >= this.batchConfig.maxBatchSize) {
        this.processBatch(input.modelId);
      }
    });
  }

  private async processPendingBatches(): Promise<void> {
    Array.from(this.pendingPredictions.entries()).forEach(async ([modelId, batch]) => {
      if (Date.now() - batch.timestamp > this.batchConfig.batchTimeout) {
        await this.processBatch(modelId);
      }
    });
  }

  private async processBatch(modelId: string): Promise<void> {
    const batch = this.pendingPredictions.get(modelId);
    if (!batch || batch.inputs.length === 0) return;

    this.pendingPredictions.delete(modelId);

    try {
      const batchResult = await this.batchPredict({
        batch: batch.inputs,
        modelId
      });

      // Resolve individual promises
      batchResult.results.forEach((result, index) => {
        if (index < batch.resolvers.length) {
          batch.resolvers[index](result);
        }
      });

      // Handle any failed predictions
      if (batchResult.failedPredictions > 0) {
        const failedCount = batchResult.failedPredictions;
        const startIndex = batchResult.results.length;
        
        for (let i = startIndex; i < startIndex + failedCount && i < batch.rejectors.length; i++) {
          batch.rejectors[i](new Error('Batch prediction failed'));
        }
      }

    } catch (error) {
      // Reject all pending promises
      batch.rejectors.forEach(reject => reject(new Error(String(error))));
    }
  }

  private prepareBatchTensor(inputs: PredictionInput[]): tf.Tensor {
    try {
      const batchData: number[][] = [];
      
      for (const input of inputs) {
        const features = input.features instanceof Float32Array ? 
          Array.from(input.features) : input.features;
        batchData.push(features);
      }
      
      return tf.tensor2d(batchData);
      
    } catch (error) {
      throw this.createMLError('TENSOR_SHAPE_ERROR', 
        `Failed to prepare batch tensor: ${error}`
      );
    }
  }

  private getOutputSize(model: tf.LayersModel): number {
    const outputShape = model.outputShape;
    if (Array.isArray(outputShape) && outputShape.length > 1) {
      return outputShape[outputShape.length - 1] as number;
    }
    return 1;
  }

  private calculateConfidence(prediction: number[]): number {
    if (prediction.length === 1) {
      // Regression - use absolute value as proxy for confidence
      return Math.min(1, Math.abs(prediction[0]));
    }
    
    // Classification - use max probability
    const maxProb = Math.max(...prediction);
    const sumProbs = prediction.reduce((sum, p) => sum + Math.abs(p), 0);
    
    return sumProbs > 0 ? maxProb / sumProbs : 0.5;
  }

  private validatePredictionInput(input: PredictionInput): void {
    if (!input.modelId || input.modelId.trim() === '') {
      throw new Error('Model ID is required');
    }
    
    if (!input.symbol || input.symbol.trim() === '') {
      throw new Error('Symbol is required');
    }
    
    if (!input.features || input.features.length === 0) {
      throw new Error('Features are required');
    }
    
    if (input.timestamp <= 0) {
      throw new Error('Valid timestamp is required');
    }
  }

  private minMaxNormalize(features: Float32Array): Float32Array {
    const featuresArray = Array.from(features);
    const min = Math.min(...featuresArray);
    const max = Math.max(...featuresArray);
    const range = max - min;
    
    if (range === 0) return features;
    
    return new Float32Array(featuresArray.map(f => (f - min) / range));
  }

  private zScoreNormalize(features: Float32Array): Float32Array {
    const featuresArray = Array.from(features);
    const mean = featuresArray.reduce((sum, f) => sum + f, 0) / featuresArray.length;
    const variance = featuresArray.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / featuresArray.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return features;
    
    return new Float32Array(featuresArray.map(f => (f - mean) / std));
  }

  private cleanupStreamingCache(): void {
    const now = Date.now();
    Array.from(this.streamingCache.entries()).forEach(([key, cached]) => {
      if (now - cached.timestamp > cached.ttl) {
        this.streamingCache.delete(key);
      }
    });
  }

  private createMLError(type: MLErrorType, message: string, modelId?: string) {
    return {
      code: type,
      message,
      modelId,
      timestamp: Date.now(),
      context: {
        backend: modelManager.getBackendInfo().backend,
        memoryInfo: modelManager.getMemoryInfo()
      }
    };
  }
}

// Export singleton instance
export const predictionEngine = PredictionEngine.getInstance();