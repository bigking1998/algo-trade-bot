// useMLPredictions.ts - React Query hooks for ML predictions and model management
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { modelManager } from '../ml/inference/ModelManager';
import { predictionEngine } from '../ml/inference/PredictionEngine';
import { modelRegistry } from '../ml/models/ModelRegistry';
import {
  ModelMetadata,
  ModelRegistryEntry,
  PredictionInput,
  PredictionResult,
  BatchPredictionInput,
  BatchPredictionResult,
  StreamingPrediction,
  ModelHealthCheck,
  ModelBenchmark,
  UsePredictionConfig,
  UseModelConfig
} from '../ml/types';

/**
 * Hook to load and manage a specific ML model
 */
export function useMLModel(
  modelId: string,
  config?: UseModelConfig,
  options?: UseQueryOptions<ModelMetadata, Error>
) {
  return useQuery<ModelMetadata, Error>({
    queryKey: ['ml-model', modelId],
    queryFn: async () => {
      // Try to get from registry first
      let metadata = modelRegistry.getModel(modelId);
      
      if (!metadata) {
        throw new Error(`Model ${modelId} not found in registry`);
      }

      // Auto-load if configured
      if (config?.autoLoad) {
        const entry = modelRegistry.getAllModels().find(e => e.metadata.id === modelId);
        if (entry && !entry.isLoaded) {
          await modelRegistry.loadModel(modelId);
          
          // Warm up if configured
          if (config?.warmUp) {
            await modelManager.warmModel(modelId, metadata.inputShape);
          }
        }
      }

      return metadata;
    },
    staleTime: Infinity, // Model metadata is long-lived
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to get all available models from registry
 */
export function useMLModels(
  options?: UseQueryOptions<ModelRegistryEntry[], Error>
) {
  return useQuery<ModelRegistryEntry[], Error>({
    queryKey: ['ml-models', 'registry'],
    queryFn: () => modelRegistry.getAllModels(),
    staleTime: 30000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60000, // Refresh every minute
    ...options,
  });
}

/**
 * Hook to get active models
 */
export function useActiveMLModels(
  options?: UseQueryOptions<ModelRegistryEntry[], Error>
) {
  return useQuery<ModelRegistryEntry[], Error>({
    queryKey: ['ml-models', 'active'],
    queryFn: () => modelRegistry.getActiveModels(),
    staleTime: 10000, // 10 seconds
    gcTime: 60000, // 1 minute
    refetchInterval: 15000, // Refresh every 15 seconds
    ...options,
  });
}

/**
 * Hook for real-time ML predictions with caching
 */
export function useMLPrediction(
  config: UsePredictionConfig,
  options?: UseQueryOptions<PredictionResult, Error>
) {
  const { symbol, modelId, features, realTime = false, interval = 5000, enabled = true } = config;
  
  return useQuery<PredictionResult, Error>({
    queryKey: ['ml-prediction', modelId, symbol, features ? JSON.stringify(Array.from(features.features)) : null],
    queryFn: async () => {
      if (!features) {
        throw new Error('Features are required for prediction');
      }

      const input: PredictionInput = {
        features: features.features,
        symbol,
        timestamp: features.timestamp || Date.now(),
        modelId
      };

      return predictionEngine.predict(input);
    },
    enabled: enabled && !!features && !!modelId && !!symbol,
    staleTime: realTime ? 1000 : 10000, // Fresh data for real-time
    gcTime: 30000,
    refetchInterval: realTime ? interval : false,
    refetchOnWindowFocus: realTime,
    retry: 2,
    ...options,
  });
}

/**
 * Hook for batch ML predictions
 */
export function useMLBatchPrediction(
  batchInput: BatchPredictionInput | null,
  options?: UseQueryOptions<BatchPredictionResult, Error>
) {
  return useQuery<BatchPredictionResult, Error>({
    queryKey: ['ml-batch-prediction', batchInput?.modelId, batchInput?.batch.length],
    queryFn: async () => {
      if (!batchInput) {
        throw new Error('Batch input is required');
      }
      return predictionEngine.batchPredict(batchInput);
    },
    enabled: !!batchInput && batchInput.batch.length > 0,
    staleTime: 5000,
    gcTime: 30000,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for streaming ML predictions
 */
export function useStreamingMLPrediction(
  symbol: string,
  modelId: string,
  enabled = true,
  interval = 3000,
  options?: UseQueryOptions<StreamingPrediction | null, Error>
) {
  return useQuery<StreamingPrediction | null, Error>({
    queryKey: ['ml-streaming-prediction', modelId, symbol],
    queryFn: async () => {
      // This would typically get the latest market data and make a prediction
      // For now, return null - will be implemented with feature engineering in ML-002
      console.log(`Streaming prediction requested for ${symbol} using model ${modelId}`);
      return null;
    },
    enabled: enabled && !!modelId && !!symbol,
    staleTime: 1000,
    gcTime: 10000,
    refetchInterval: interval,
    refetchOnWindowFocus: true,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for model health checks
 */
export function useMLModelHealth(
  modelId: string,
  enabled = true,
  options?: UseQueryOptions<ModelHealthCheck, Error>
) {
  return useQuery<ModelHealthCheck, Error>({
    queryKey: ['ml-model-health', modelId],
    queryFn: () => modelManager.healthCheck(modelId),
    enabled: enabled && !!modelId,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    refetchInterval: 60000, // Check health every minute
    retry: 2,
    ...options,
  });
}

/**
 * Hook for model performance benchmarks
 */
export function useMLModelBenchmark(
  modelId: string,
  batchSizes?: number[],
  enabled = false, // Default disabled as benchmarks are expensive
  options?: UseQueryOptions<ModelBenchmark, Error>
) {
  return useQuery<ModelBenchmark, Error>({
    queryKey: ['ml-model-benchmark', modelId, JSON.stringify(batchSizes)],
    queryFn: () => modelRegistry.benchmarkModel(modelId, batchSizes),
    enabled: enabled && !!modelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for ML system statistics
 */
export function useMLStatistics(
  options?: UseQueryOptions<any, Error>
) {
  return useQuery({
    queryKey: ['ml-statistics'],
    queryFn: () => ({
      registry: modelRegistry.getStatistics(),
      memory: modelManager.getMemoryInfo(),
      backend: modelManager.getBackendInfo()
    }),
    staleTime: 15000, // 15 seconds
    gcTime: 60000, // 1 minute
    refetchInterval: 30000, // Update every 30 seconds
    ...options,
  });
}

/**
 * Hook to search models by tags
 */
export function useMLModelSearch(
  tags: string[],
  options?: UseQueryOptions<ModelMetadata[], Error>
) {
  return useQuery<ModelMetadata[], Error>({
    queryKey: ['ml-model-search', JSON.stringify(tags.sort())],
    queryFn: () => modelRegistry.searchByTags(tags),
    enabled: tags.length > 0,
    staleTime: 60000, // 1 minute
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to get model recommendations
 */
export function useMLRecommendations(
  useCase: string,
  maxResults = 5,
  options?: UseQueryOptions<ModelMetadata[], Error>
) {
  return useQuery<ModelMetadata[], Error>({
    queryKey: ['ml-recommendations', useCase, maxResults],
    queryFn: () => modelRegistry.getRecommendations(useCase, maxResults),
    enabled: !!useCase,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    ...options,
  });
}

// Mutation hooks for model management

/**
 * Mutation to load a model
 */
export function useLoadMLModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (modelId: string) => {
      await modelRegistry.loadModel(modelId);
      return modelId;
    },
    onSuccess: (modelId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ml-models'] });
      queryClient.invalidateQueries({ queryKey: ['ml-model', modelId] });
      queryClient.invalidateQueries({ queryKey: ['ml-statistics'] });
    },
    onError: (error, modelId) => {
      console.error(`Failed to load model ${modelId}:`, error);
    }
  });
}

/**
 * Mutation to unload a model
 */
export function useUnloadMLModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (modelId: string) => {
      await modelRegistry.unloadModel(modelId);
      return modelId;
    },
    onSuccess: (modelId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ml-models'] });
      queryClient.invalidateQueries({ queryKey: ['ml-model', modelId] });
      queryClient.invalidateQueries({ queryKey: ['ml-statistics'] });
      
      // Remove prediction cache for this model
      queryClient.removeQueries({ queryKey: ['ml-prediction', modelId] });
      queryClient.removeQueries({ queryKey: ['ml-streaming-prediction', modelId] });
    },
    onError: (error, modelId) => {
      console.error(`Failed to unload model ${modelId}:`, error);
    }
  });
}

/**
 * Mutation to register a new model
 */
export function useRegisterMLModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (metadata: ModelMetadata) => {
      await modelRegistry.registerModel(metadata);
      return metadata;
    },
    onSuccess: (metadata) => {
      queryClient.invalidateQueries({ queryKey: ['ml-models'] });
      queryClient.invalidateQueries({ queryKey: ['ml-statistics'] });
      console.log(`✅ Model ${metadata.id} registered successfully`);
    },
    onError: (error, metadata) => {
      console.error(`Failed to register model ${metadata.id}:`, error);
    }
  });
}

/**
 * Mutation to warm up a model
 */
export function useWarmMLModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ modelId, inputShape }: { modelId: string; inputShape: number[] }) => {
      await modelManager.warmModel(modelId, inputShape);
      return modelId;
    },
    onSuccess: (modelId) => {
      queryClient.invalidateQueries({ queryKey: ['ml-model-health', modelId] });
      console.log(`🔥 Model ${modelId} warmed up successfully`);
    },
    onError: (error, variables) => {
      console.error(`Failed to warm model ${variables.modelId}:`, error);
    }
  });
}

/**
 * Custom hook for ML model lifecycle management
 */
export function useMLModelLifecycle(modelId: string) {
  const loadMutation = useLoadMLModel();
  const unloadMutation = useUnloadMLModel();
  const warmMutation = useWarmMLModel();
  const { data: model } = useMLModel(modelId);
  const { data: health } = useMLModelHealth(modelId, true);
  
  const load = () => loadMutation.mutate(modelId);
  const unload = () => unloadMutation.mutate(modelId);
  const warm = () => {
    if (model) {
      warmMutation.mutate({ modelId, inputShape: model.inputShape });
    }
  };
  
  return {
    model,
    health,
    load,
    unload,
    warm,
    isLoading: loadMutation.isPending || unloadMutation.isPending || warmMutation.isPending,
    error: loadMutation.error || unloadMutation.error || warmMutation.error
  };
}

/**
 * Hook for real-time prediction with automatic feature extraction
 */
export function useRealTimeMLPrediction(
  symbol: string,
  modelId: string,
  enabled = true
) {
  // This will be expanded in ML-002 with feature engineering integration
  const { data: candleData } = useQuery({
    queryKey: ['dydx', 'candles', symbol, '1m'],
    queryFn: async () => {
      // Fetch latest candle data for feature extraction
      const response = await fetch(`/api/dydx/candles?symbol=${symbol}&timeframe=1m`);
      if (!response.ok) throw new Error('Failed to fetch candle data');
      return response.json();
    },
    enabled,
    refetchInterval: 5000
  });

  // For now, return placeholder - will implement feature extraction in ML-002
  return useQuery<PredictionResult | null, Error>({
    queryKey: ['ml-realtime-prediction', modelId, symbol],
    queryFn: async () => {
      console.log(`Real-time prediction for ${symbol} with model ${modelId} - feature extraction not yet implemented`);
      return null;
    },
    enabled: enabled && !!candleData && !!modelId && !!symbol,
    staleTime: 1000,
    gcTime: 10000,
    refetchInterval: 5000
  });
}