// useMLPerformance.ts - React Query hooks for ML performance monitoring
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export interface ModelPerformance {
  modelId: string;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    winRate: number;
    avgReturn: number;
  };
  backtestPeriod: {
    start: string;
    end: string;
  };
  lastUpdated: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  type: string;
  architecture: string;
  inputShape: number[];
  outputShape: number[];
  accuracy: number;
  size: number;
  created: string;
  updated: string;
  tags: string[];
  trainingData: {
    samples: number;
    features: number | string;
    period: string;
  };
}

export interface TrainingStatus {
  jobId: string;
  status: 'training' | 'completed' | 'failed' | 'running';
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  currentLoss: number;
  validationLoss: number;
  eta: string;
  startTime: string;
  metrics: {
    trainAccuracy: number;
    valAccuracy: number;
    learningRate: number;
  };
}

export interface DataStatistics {
  totalRecords: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  symbols: string[];
  dataQuality: {
    completeness: number;
    missingValues: number;
    duplicates: number;
    outliers: number;
  };
  featureStatistics: {
    priceRange: { min: number; max: number; mean: number; std: number };
    volumeRange: { min: number; max: number; mean: number; std: number };
    volatilityMean: number;
    correlations: Record<string, number>;
  };
  lastUpdated: string;
}

export interface ABTestResult {
  testId: string;
  modelA: { id: string; performance: number };
  modelB: { id: string; performance: number };
  winner: string;
  confidence: number;
  testConfig: any;
  startDate: string;
  status: string;
}

/**
 * Hook to fetch ML model performance metrics
 */
export function useMLModelPerformance(
  modelId: string,
  options?: UseQueryOptions<ModelPerformance, Error>
) {
  return useQuery<ModelPerformance, Error>({
    queryKey: ['ml-performance', modelId],
    queryFn: async () => {
      const response = await fetch(`/api/ml/models/performance?modelId=${modelId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch performance for model ${modelId}`);
      }
      return response.json();
    },
    enabled: !!modelId,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60000, // Refresh every minute
    ...options,
  });
}

/**
 * Hook to fetch all available ML models
 */
export function useMLModelsInfo(
  options?: UseQueryOptions<{ models: ModelInfo[] }, Error>
) {
  return useQuery<{ models: ModelInfo[] }, Error>({
    queryKey: ['ml-models-info'],
    queryFn: async () => {
      const response = await fetch('/api/ml/models');
      if (!response.ok) {
        throw new Error('Failed to fetch ML models');
      }
      return response.json();
    },
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch specific ML model info
 */
export function useMLModelInfo(
  modelId: string,
  options?: UseQueryOptions<ModelInfo, Error>
) {
  return useQuery<ModelInfo, Error>({
    queryKey: ['ml-model-info', modelId],
    queryFn: async () => {
      const response = await fetch(`/api/ml/models?modelId=${modelId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch info for model ${modelId}`);
      }
      return response.json();
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch ML training status
 */
export function useMLTrainingStatus(
  jobId: string,
  options?: UseQueryOptions<TrainingStatus, Error>
) {
  return useQuery<TrainingStatus, Error>({
    queryKey: ['ml-training-status', jobId],
    queryFn: async () => {
      const response = await fetch(`/api/ml/training/status?jobId=${jobId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch training status for job ${jobId}`);
      }
      return response.json();
    },
    enabled: !!jobId,
    staleTime: 5000, // 5 seconds
    gcTime: 60000, // 1 minute
    refetchInterval: 10000, // Refresh every 10 seconds for live training updates
    ...options,
  });
}

/**
 * Hook to fetch ML data statistics
 */
export function useMLDataStatistics(
  symbol?: string,
  options?: UseQueryOptions<DataStatistics, Error>
) {
  return useQuery<DataStatistics, Error>({
    queryKey: ['ml-data-stats', symbol],
    queryFn: async () => {
      const url = symbol 
        ? `/api/ml/data/stats?symbol=${symbol}` 
        : '/api/ml/data/stats';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch ML data statistics');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    ...options,
  });
}

/**
 * Hook to compare multiple models' performance
 */
export function useMLModelsComparison(
  modelIds: string[],
  options?: UseQueryOptions<ModelPerformance[], Error>
) {
  return useQuery<ModelPerformance[], Error>({
    queryKey: ['ml-models-comparison', JSON.stringify(modelIds.sort())],
    queryFn: async () => {
      const performances = await Promise.all(
        modelIds.map(async (modelId) => {
          const response = await fetch(`/api/ml/models/performance?modelId=${modelId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch performance for model ${modelId}`);
          }
          return response.json();
        })
      );
      return performances;
    },
    enabled: modelIds.length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch ML system health status
 */
export function useMLSystemHealth(
  options?: UseQueryOptions<any, Error>
) {
  return useQuery({
    queryKey: ['ml-health'],
    queryFn: async () => {
      const response = await fetch('/api/ml/health');
      if (!response.ok) {
        throw new Error('Failed to fetch ML system health');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60000, // Check health every minute
    ...options,
  });
}

/**
 * Hook to fetch feature importance data (mock for now - will be real in ML-002)
 */
export function useFeatureImportance(
  modelId: string,
  options?: UseQueryOptions<{ features: Array<{name: string, importance: number}> }, Error>
) {
  return useQuery<{ features: Array<{name: string, importance: number}> }, Error>({
    queryKey: ['feature-importance', modelId],
    queryFn: async () => {
      // Mock feature importance data for now
      const mockFeatures = [
        { name: 'RSI_14', importance: 0.23 },
        { name: 'SMA_20', importance: 0.19 },
        { name: 'MACD_Signal', importance: 0.17 },
        { name: 'Volume_SMA', importance: 0.15 },
        { name: 'BB_Upper', importance: 0.12 },
        { name: 'EMA_12', importance: 0.08 },
        { name: 'Price_Change', importance: 0.06 }
      ];
      
      // Add some randomness to simulate real data
      const features = mockFeatures.map(f => ({
        ...f,
        importance: f.importance * (0.8 + Math.random() * 0.4)
      }));
      
      return { features };
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to get prediction confidence scores over time
 */
export function usePredictionConfidence(
  modelId: string,
  symbol: string,
  timeframe: string = '1h',
  limit: number = 100,
  options?: UseQueryOptions<Array<{timestamp: string, confidence: number, prediction: number}>, Error>
) {
  return useQuery<Array<{timestamp: string, confidence: number, prediction: number}>, Error>({
    queryKey: ['prediction-confidence', modelId, symbol, timeframe, limit],
    queryFn: async () => {
      // Mock confidence data for now
      const data = [];
      const now = Date.now();
      const interval = timeframe === '1m' ? 60000 : timeframe === '1h' ? 3600000 : 86400000;
      
      for (let i = limit; i > 0; i--) {
        const timestamp = new Date(now - i * interval).toISOString();
        data.push({
          timestamp,
          confidence: 0.6 + Math.random() * 0.35, // 60-95% confidence
          prediction: Math.random() > 0.5 ? 1 : 0 // Binary prediction
        });
      }
      
      return data;
    },
    enabled: !!modelId && !!symbol,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60000, // Refresh every minute
    ...options,
  });
}