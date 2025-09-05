/**
 * Feature Engineering React Query Hooks - Task ML-002
 * 
 * React Query hooks for feature computation, streaming updates,
 * validation, and feature-based ML predictions.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { 
  featureEngine,
  FeatureConfig, 
  FeatureVector, 
  FeatureUpdate,
  QualityReport,
  ImportanceScores,
  DEFAULT_FEATURE_CONFIG,
  FeatureUtils
} from '../ml/features';
import { DydxCandle } from '../../shared/types/trading';

/**
 * Feature computation configuration
 */
interface UseFeatureConfig {
  enabled?: boolean;
  realTime?: boolean;
  interval?: number;
  cacheTimeout?: number;
  enableValidation?: boolean;
  enableNormalization?: boolean;
}

/**
 * Default feature hook configuration
 */
const DEFAULT_USE_FEATURE_CONFIG: UseFeatureConfig = {
  enabled: true,
  realTime: false,
  interval: 5000,
  cacheTimeout: 60000,
  enableValidation: true,
  enableNormalization: true
};

/**
 * Hook to compute features from historical market data
 */
export function useHistoricalFeatures(
  symbol: string,
  timeframe: string,
  lookbackPeriods: number = 100,
  featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<FeatureVector, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, ...config };

  return useQuery<FeatureVector, Error>({
    queryKey: ['features', 'historical', symbol, timeframe, lookbackPeriods, JSON.stringify(featureConfig)],
    queryFn: async () => {
      // Fetch historical market data
      const response = await fetch(
        `/api/dydx/candles?symbol=${symbol}&timeframe=${timeframe}&limit=${lookbackPeriods}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch market data: ${response.statusText}`);
      }
      
      const candleData: DydxCandle[] = await response.json();
      
      if (!candleData || candleData.length === 0) {
        throw new Error('No market data available');
      }

      // Validate market data
      if (!FeatureUtils.validateMarketData(candleData)) {
        throw new Error('Invalid market data format');
      }

      // Convert to OHLCV format and compute features
      const ohlcvData = candleData.map(FeatureUtils.convertToOHLCV);
      
      return featureEngine.computeFeatures(ohlcvData, featureConfig);
    },
    enabled: finalConfig.enabled && !!symbol && !!timeframe,
    staleTime: finalConfig.cacheTimeout || 60000,
    gcTime: (finalConfig.cacheTimeout || 60000) * 2,
    refetchOnWindowFocus: false,
    retry: 2,
    ...options,
  });
}

/**
 * Hook for streaming feature computation with real-time updates
 */
export function useStreamingFeatures(
  symbol: string,
  timeframe: string = '1m',
  featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<FeatureUpdate, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, realTime: true, ...config };

  return useQuery<FeatureUpdate, Error>({
    queryKey: ['features', 'streaming', symbol, timeframe, JSON.stringify(featureConfig)],
    queryFn: async () => {
      // Fetch latest candle for streaming update
      const response = await fetch(
        `/api/dydx/candles?symbol=${symbol}&timeframe=${timeframe}&limit=1`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch latest candle: ${response.statusText}`);
      }
      
      const candleData: DydxCandle[] = await response.json();
      
      if (!candleData || candleData.length === 0) {
        throw new Error('No latest candle data available');
      }

      const latestCandle = FeatureUtils.convertToOHLCV(candleData[0]);
      
      return featureEngine.computeStreamingFeatures(symbol, latestCandle, featureConfig);
    },
    enabled: finalConfig.enabled && finalConfig.realTime && !!symbol,
    staleTime: 1000, // Very fresh for streaming
    gcTime: 10000,
    refetchInterval: finalConfig.interval,
    refetchOnWindowFocus: true,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for batch feature preparation for ML training
 */
export function useTrainingFeatures(
  symbol: string,
  timeframe: string,
  startDate?: Date,
  endDate?: Date,
  featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
  targetVariable?: number[],
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<any, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, ...config };

  return useQuery({
    queryKey: [
      'features', 
      'training', 
      symbol, 
      timeframe, 
      startDate?.getTime(), 
      endDate?.getTime(),
      JSON.stringify(featureConfig),
      targetVariable?.length
    ],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams({
        symbol,
        timeframe,
        limit: '1000' // Large dataset for training
      });

      if (startDate) {
        params.append('start', startDate.toISOString());
      }
      if (endDate) {
        params.append('end', endDate.toISOString());
      }

      // Fetch historical data
      const response = await fetch(`/api/dydx/candles?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch training data: ${response.statusText}`);
      }
      
      const candleData: DydxCandle[] = await response.json();
      
      if (!candleData || candleData.length < 100) {
        throw new Error('Insufficient data for training (minimum 100 samples required)');
      }

      const ohlcvData = candleData.map(FeatureUtils.convertToOHLCV);
      
      return featureEngine.prepareTrainingFeatures(ohlcvData, featureConfig, targetVariable);
    },
    enabled: finalConfig.enabled && !!symbol && !!timeframe,
    staleTime: 5 * 60 * 1000, // 5 minutes for training data
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for feature quality validation
 */
export function useFeatureValidation(
  features: FeatureVector | null,
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<QualityReport, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, ...config };

  return useQuery<QualityReport, Error>({
    queryKey: ['features', 'validation', features?.timestamp?.getTime(), features?.symbol],
    queryFn: async () => {
      if (!features) {
        throw new Error('No features provided for validation');
      }

      // Import validator dynamically to avoid circular dependencies
      const { FeatureValidator } = await import('../ml/features');
      const validator = new FeatureValidator();
      
      return validator.validateDataQuality(features);
    },
    enabled: finalConfig.enabled && finalConfig.enableValidation && !!features,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for feature importance analysis
 */
export function useFeatureImportance(
  features: FeatureVector[],
  targets: number[],
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<ImportanceScores, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, ...config };

  return useQuery<ImportanceScores, Error>({
    queryKey: [
      'features', 
      'importance', 
      features.length, 
      targets.length,
      features[0]?.symbol
    ],
    queryFn: async () => {
      if (!features || features.length === 0) {
        throw new Error('No features provided for importance analysis');
      }
      
      if (!targets || targets.length !== features.length) {
        throw new Error('Target variable length must match feature count');
      }

      const { FeatureValidator } = await import('../ml/features');
      const validator = new FeatureValidator();
      
      return validator.calculateFeatureImportance(features, targets);
    },
    enabled: finalConfig.enabled && features.length > 0 && targets.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for feature engine performance metrics
 */
export function useFeatureEngineMetrics(
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<any, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, interval: 15000, ...config };

  return useQuery({
    queryKey: ['features', 'engine', 'metrics'],
    queryFn: async () => {
      return {
        performance: featureEngine.getPerformanceMetrics(),
        status: featureEngine.getStatus()
      };
    },
    enabled: finalConfig.enabled,
    staleTime: 10000, // 10 seconds
    gcTime: 30000, // 30 seconds
    refetchInterval: finalConfig.interval,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for feature-enhanced ML predictions
 */
export function useFeatureBasedPrediction(
  symbol: string,
  modelId: string,
  timeframe: string = '1m',
  featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<any, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, realTime: true, ...config };

  // Get streaming features
  const { data: featureUpdate } = useStreamingFeatures(
    symbol, 
    timeframe, 
    featureConfig, 
    finalConfig
  );

  return useQuery({
    queryKey: ['features', 'ml-prediction', modelId, symbol, featureUpdate?.features?.timestamp?.getTime()],
    queryFn: async () => {
      if (!featureUpdate?.features) {
        throw new Error('Features not available for prediction');
      }

      // Import prediction engine
      const { predictionEngine } = await import('../ml/inference/PredictionEngine');
      
      // Convert features to ML input format
      const featureArray = FeatureUtils.extractFeatureArray(featureUpdate.features);
      
      const input = {
        features: new Float32Array(featureArray),
        symbol,
        timestamp: Date.now(),
        modelId
      };

      return predictionEngine.predict(input);
    },
    enabled: finalConfig.enabled && !!featureUpdate?.features && !!modelId && !!symbol,
    staleTime: 2000, // 2 seconds for real-time predictions
    gcTime: 10000,
    refetchInterval: finalConfig.realTime ? finalConfig.interval : false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for multi-timeframe feature analysis
 */
export function useMultiTimeframeFeatures(
  symbol: string,
  timeframes: string[] = ['1m', '5m', '15m', '1h'],
  featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<Record<string, FeatureVector>, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, ...config };

  return useQuery<Record<string, FeatureVector>, Error>({
    queryKey: ['features', 'multi-timeframe', symbol, JSON.stringify(timeframes), JSON.stringify(featureConfig)],
    queryFn: async () => {
      const results: Record<string, FeatureVector> = {};

      // Fetch features for each timeframe
      for (const timeframe of timeframes) {
        try {
          const response = await fetch(
            `/api/dydx/candles?symbol=${symbol}&timeframe=${timeframe}&limit=100`
          );
          
          if (response.ok) {
            const candleData: DydxCandle[] = await response.json();
            
            if (candleData && candleData.length > 0) {
              const ohlcvData = candleData.map(FeatureUtils.convertToOHLCV);
              results[timeframe] = await featureEngine.computeFeatures(ohlcvData, featureConfig);
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch features for ${timeframe}:`, error);
        }
      }

      return results;
    },
    enabled: finalConfig.enabled && !!symbol && timeframes.length > 0,
    staleTime: 60000, // 1 minute
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

/**
 * Hook for feature comparison across multiple symbols
 */
export function useCrossSymbolFeatures(
  symbols: string[],
  timeframe: string = '1m',
  featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
  config: UseFeatureConfig = {},
  options?: UseQueryOptions<Record<string, FeatureVector>, Error>
) {
  const finalConfig = { ...DEFAULT_USE_FEATURE_CONFIG, ...config };

  return useQuery<Record<string, FeatureVector>, Error>({
    queryKey: ['features', 'cross-symbol', JSON.stringify(symbols), timeframe, JSON.stringify(featureConfig)],
    queryFn: async () => {
      const results: Record<string, FeatureVector> = {};

      // Process symbols in parallel for better performance
      const promises = symbols.map(async (symbol) => {
        try {
          const response = await fetch(
            `/api/dydx/candles?symbol=${symbol}&timeframe=${timeframe}&limit=100`
          );
          
          if (response.ok) {
            const candleData: DydxCandle[] = await response.json();
            
            if (candleData && candleData.length > 0) {
              const ohlcvData = candleData.map(FeatureUtils.convertToOHLCV);
              const features = await featureEngine.computeFeatures(ohlcvData, featureConfig);
              return { symbol, features };
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch features for ${symbol}:`, error);
        }
        return null;
      });

      const settled = await Promise.allSettled(promises);
      
      settled.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          results[result.value.symbol] = result.value.features;
        }
      });

      return results;
    },
    enabled: finalConfig.enabled && symbols.length > 0 && !!timeframe,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

// Mutation hooks for feature management

/**
 * Mutation to clear feature engine cache
 */
export function useClearFeatureCache() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      featureEngine.clearCache();
      return true;
    },
    onSuccess: () => {
      // Invalidate all feature queries
      queryClient.invalidateQueries({ queryKey: ['features'] });
      console.log('✅ Feature cache cleared');
    },
    onError: (error) => {
      console.error('Failed to clear feature cache:', error);
    }
  });
}

/**
 * Mutation to compute features on demand
 */
export function useComputeFeatures() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      marketData, 
      featureConfig = DEFAULT_FEATURE_CONFIG 
    }: { 
      marketData: DydxCandle[]; 
      featureConfig?: FeatureConfig 
    }) => {
      if (!FeatureUtils.validateMarketData(marketData)) {
        throw new Error('Invalid market data provided');
      }
      
      const ohlcvData = marketData.map(FeatureUtils.convertToOHLCV);
      return featureEngine.computeFeatures(ohlcvData, featureConfig);
    },
    onSuccess: (features) => {
      // Cache the computed features
      queryClient.setQueryData(
        ['features', 'computed', features.symbol, features.timeframe, Date.now()],
        features
      );
      console.log(`✅ Features computed for ${features.symbol}`);
    },
    onError: (error) => {
      console.error('Failed to compute features:', error);
    }
  });
}

/**
 * Custom hook for comprehensive feature analysis
 */
export function useFeatureAnalysis(
  symbol: string,
  timeframe: string = '1m',
  config: UseFeatureConfig = {}
) {
  const features = useHistoricalFeatures(symbol, timeframe, 100, DEFAULT_FEATURE_CONFIG, config);
  const validation = useFeatureValidation(features.data || null, config);
  const metrics = useFeatureEngineMetrics(config);
  const streaming = useStreamingFeatures(symbol, timeframe, DEFAULT_FEATURE_CONFIG, { 
    ...config, 
    realTime: true 
  });

  return {
    // Data
    features: features.data,
    streamingUpdate: streaming.data,
    validation: validation.data,
    metrics: metrics.data,
    
    // Loading states
    isLoading: features.isLoading,
    isStreamingLoading: streaming.isLoading,
    isValidationLoading: validation.isLoading,
    
    // Error states
    error: features.error || streaming.error || validation.error,
    
    // Refetch functions
    refetch: features.refetch,
    refetchStreaming: streaming.refetch,
    refetchValidation: validation.refetch,
    
    // Status
    isHealthy: metrics.data?.status?.isHealthy ?? false,
    confidence: streaming.data?.confidence ?? 0
  };
}