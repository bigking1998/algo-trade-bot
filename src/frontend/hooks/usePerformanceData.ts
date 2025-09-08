/**
 * Performance Data Hook - Custom React Query hook for fetching performance analytics
 * 
 * Provides comprehensive performance metrics including:
 * - Strategy performance comparison and ranking
 * - Portfolio analytics with risk-adjusted returns  
 * - Drawdown analysis and recovery tracking
 * - Trade analytics and execution quality metrics
 * - Real-time performance monitoring
 * - Historical performance reporting
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

// Import backend types for performance monitoring
export interface PerformanceMetrics {
  // Portfolio metrics
  totalValue: number;
  dailyPnL: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  
  // Performance ratios
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  
  // Risk metrics
  maxDrawdown: number;
  currentDrawdown: number;
  volatility: number;
  downvoluatility: number; // For Sortino calculation
  
  // Trading statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  
  // Execution metrics
  avgFillTime: number;
  slippageRate: number;
  executionSuccessRate: number;
  
  // Time-based performance
  performanceToday: number;
  performanceWeek: number;
  performanceMonth: number;
  performanceQuarter: number;
  performanceYear: number;
  performanceAll: number;
  
  timestamp: Date;
}

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  isActive: boolean;
  
  // Performance metrics specific to this strategy
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  
  // Trading stats
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  
  // Execution quality
  avgExecutionTime: number;
  signalAccuracy: number;
  successfulExecutions: number;
  
  // Time series data for charting
  equityCurve: Array<{
    timestamp: Date;
    value: number;
    drawdown: number;
  }>;
  
  // Performance by period
  monthlyReturns: Array<{
    month: string;
    return: number;
  }>;
  
  lastUpdated: Date;
}

export interface DrawdownMetrics {
  periods: Array<{
    start: Date;
    end: Date | null; // null if ongoing
    peak: number;
    trough: number;
    drawdown: number; // percentage
    duration: number; // days
    recovery: number | null; // days to recover, null if not recovered
  }>;
  
  // Current drawdown info
  currentDrawdown: {
    drawdown: number;
    duration: number;
    daysFromPeak: number;
    isRecovering: boolean;
  };
  
  // Historical stats
  maxDrawdown: number;
  avgDrawdown: number;
  avgDrawdownDuration: number;
  avgRecoveryTime: number;
  drawdownFrequency: number; // drawdowns per year
}

export interface PerformanceBenchmark {
  name: string;
  symbol: string;
  returns: Array<{
    date: Date;
    return: number;
  }>;
  correlation: number;
  beta: number;
  alpha: number;
  trackingError: number;
}

export interface PerformanceExportData {
  format: 'PDF' | 'CSV' | 'JSON';
  data: any;
  filename: string;
  generatedAt: Date;
}

// Hook configuration
interface UsePerformanceDataOptions {
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  strategyIds?: string[];
  includeInactive?: boolean;
  refreshInterval?: number;
  enableRealTime?: boolean;
}

// API endpoints for performance data
const PERFORMANCE_ENDPOINTS = {
  overview: '/api/performance/overview',
  strategies: '/api/performance/strategies',
  drawdown: '/api/performance/drawdown',
  benchmarks: '/api/performance/benchmarks',
  export: '/api/performance/export',
  alerts: '/api/performance/alerts',
  reports: '/api/performance/reports'
};

/**
 * Main performance data hook
 */
export function usePerformanceData(options: UsePerformanceDataOptions = {}) {
  const {
    timeframe = '1M',
    strategyIds = [],
    includeInactive = false,
    refreshInterval = 60000, // 1 minute
    enableRealTime = true
  } = options;

  const queryClient = useQueryClient();

  // Query key factory
  const createQueryKey = useCallback((endpoint: string, params: Record<string, any> = {}) => {
    return ['performance', endpoint, { timeframe, strategyIds, includeInactive, ...params }];
  }, [timeframe, strategyIds, includeInactive]);

  // Performance overview query
  const {
    data: performanceOverview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview
  } = useQuery({
    queryKey: createQueryKey('overview'),
    queryFn: async () => {
      const response = await fetch(`${PERFORMANCE_ENDPOINTS.overview}?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch performance overview');
      const data = await response.json();
      return data as PerformanceMetrics;
    },
    refetchInterval: enableRealTime ? refreshInterval : false,
    staleTime: 30000,
    cacheTime: 300000
  });

  // Strategy performance comparison
  const {
    data: strategyPerformance,
    isLoading: strategiesLoading,
    error: strategiesError,
    refetch: refetchStrategies
  } = useQuery({
    queryKey: createQueryKey('strategies', { strategyIds }),
    queryFn: async () => {
      const params = new URLSearchParams({
        timeframe,
        includeInactive: includeInactive.toString()
      });
      
      if (strategyIds.length > 0) {
        strategyIds.forEach(id => params.append('strategyId', id));
      }

      const response = await fetch(`${PERFORMANCE_ENDPOINTS.strategies}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch strategy performance');
      const data = await response.json();
      return data as StrategyPerformance[];
    },
    refetchInterval: enableRealTime ? refreshInterval : false,
    staleTime: 30000,
    cacheTime: 300000
  });

  // Drawdown analysis
  const {
    data: drawdownMetrics,
    isLoading: drawdownLoading,
    error: drawdownError,
    refetch: refetchDrawdown
  } = useQuery({
    queryKey: createQueryKey('drawdown'),
    queryFn: async () => {
      const response = await fetch(`${PERFORMANCE_ENDPOINTS.drawdown}?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch drawdown metrics');
      const data = await response.json();
      return data as DrawdownMetrics;
    },
    refetchInterval: enableRealTime ? refreshInterval : false,
    staleTime: 60000,
    cacheTime: 600000
  });

  // Benchmark comparison
  const {
    data: benchmarks,
    isLoading: benchmarksLoading,
    error: benchmarksError,
    refetch: refetchBenchmarks
  } = useQuery({
    queryKey: createQueryKey('benchmarks'),
    queryFn: async () => {
      const response = await fetch(`${PERFORMANCE_ENDPOINTS.benchmarks}?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch benchmark data');
      const data = await response.json();
      return data as PerformanceBenchmark[];
    },
    refetchInterval: false, // Benchmarks update less frequently
    staleTime: 300000,
    cacheTime: 3600000
  });

  // Performance alerts
  const {
    data: performanceAlerts,
    isLoading: alertsLoading,
    error: alertsError
  } = useQuery({
    queryKey: createQueryKey('alerts'),
    queryFn: async () => {
      const response = await fetch(`${PERFORMANCE_ENDPOINTS.alerts}`);
      if (!response.ok) throw new Error('Failed to fetch performance alerts');
      return await response.json();
    },
    refetchInterval: enableRealTime ? 30000 : false,
    staleTime: 15000
  });

  // Export functionality
  const exportPerformanceData = useCallback(async (
    format: 'PDF' | 'CSV' | 'JSON',
    dataType: 'overview' | 'strategies' | 'drawdown' | 'full' = 'full',
    customDateRange?: { start: Date; end: Date }
  ): Promise<PerformanceExportData> => {
    const params = new URLSearchParams({
      format,
      dataType,
      timeframe
    });

    if (customDateRange) {
      params.set('startDate', customDateRange.start.toISOString());
      params.set('endDate', customDateRange.end.toISOString());
    }

    const response = await fetch(`${PERFORMANCE_ENDPOINTS.export}?${params}`);
    if (!response.ok) throw new Error('Failed to export performance data');

    if (format === 'PDF') {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }

    return await response.json() as PerformanceExportData;
  }, [timeframe]);

  // Refresh all performance data
  const refreshAllData = useCallback(() => {
    refetchOverview();
    refetchStrategies();
    refetchDrawdown();
    refetchBenchmarks();
  }, [refetchOverview, refetchStrategies, refetchDrawdown, refetchBenchmarks]);

  // Computed metrics
  const computedMetrics = useMemo(() => {
    if (!performanceOverview || !strategyPerformance) return null;

    // Calculate portfolio-level metrics
    const totalStrategies = strategyPerformance.length;
    const activeStrategies = strategyPerformance.filter(s => s.isActive).length;
    const bestPerformingStrategy = strategyPerformance.reduce((best, current) => 
      current.totalReturn > best.totalReturn ? current : best, 
      strategyPerformance[0]
    );

    // Risk-adjusted metrics
    const portfolioSharpe = performanceOverview.sharpeRatio;
    const portfolioSortino = performanceOverview.sortinoRatio;
    
    // Strategy correlations (simplified)
    const avgStrategyCorrelation = strategyPerformance.length > 1 ? 
      strategyPerformance.reduce((sum, strategy) => sum + (strategy.sharpeRatio || 0), 0) / strategyPerformance.length :
      0;

    return {
      totalStrategies,
      activeStrategies,
      bestPerformingStrategy,
      portfolioSharpe,
      portfolioSortino,
      avgStrategyCorrelation,
      riskAdjustedScore: (portfolioSharpe * 0.6) + (portfolioSortino * 0.4)
    };
  }, [performanceOverview, strategyPerformance]);

  // Loading and error states
  const isLoading = overviewLoading || strategiesLoading || drawdownLoading || benchmarksLoading;
  const hasError = overviewError || strategiesError || drawdownError || benchmarksError;

  return {
    // Data
    performanceOverview,
    strategyPerformance: strategyPerformance || [],
    drawdownMetrics,
    benchmarks: benchmarks || [],
    performanceAlerts: performanceAlerts || [],
    computedMetrics,

    // Loading states
    isLoading,
    overviewLoading,
    strategiesLoading,
    drawdownLoading,
    benchmarksLoading,
    alertsLoading,

    // Error states
    hasError,
    overviewError,
    strategiesError,
    drawdownError,
    benchmarksError,
    alertsError,

    // Actions
    refreshAllData,
    refetchOverview,
    refetchStrategies,
    refetchDrawdown,
    refetchBenchmarks,
    exportPerformanceData,

    // Configuration
    timeframe,
    strategyIds,
    includeInactive,
    enableRealTime
  };
}

/**
 * Hook for performance alerts and notifications
 */
export function usePerformanceAlerts() {
  const { data: alerts, isLoading, error, refetch } = useQuery({
    queryKey: ['performance', 'alerts'],
    queryFn: async () => {
      const response = await fetch(PERFORMANCE_ENDPOINTS.alerts);
      if (!response.ok) throw new Error('Failed to fetch performance alerts');
      return await response.json();
    },
    refetchInterval: 30000,
    staleTime: 15000
  });

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    const response = await fetch(`${PERFORMANCE_ENDPOINTS.alerts}/${alertId}/acknowledge`, {
      method: 'POST'
    });
    if (response.ok) {
      refetch();
    }
    return response.ok;
  }, [refetch]);

  const dismissAlert = useCallback(async (alertId: string) => {
    const response = await fetch(`${PERFORMANCE_ENDPOINTS.alerts}/${alertId}/dismiss`, {
      method: 'POST'
    });
    if (response.ok) {
      refetch();
    }
    return response.ok;
  }, [refetch]);

  return {
    alerts: alerts || [],
    isLoading,
    error,
    acknowledgeAlert,
    dismissAlert,
    refetch
  };
}

/**
 * Hook for generating and managing performance reports
 */
export function usePerformanceReports() {
  const generateReport = useCallback(async (
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly',
    format: 'PDF' | 'CSV' | 'JSON' = 'PDF'
  ) => {
    const response = await fetch(`${PERFORMANCE_ENDPOINTS.reports}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period, format })
    });

    if (!response.ok) throw new Error('Failed to generate performance report');
    return await response.json();
  }, []);

  const { data: reportHistory, isLoading: reportsLoading } = useQuery({
    queryKey: ['performance', 'reports', 'history'],
    queryFn: async () => {
      const response = await fetch(`${PERFORMANCE_ENDPOINTS.reports}/history`);
      if (!response.ok) throw new Error('Failed to fetch report history');
      return await response.json();
    },
    staleTime: 300000
  });

  return {
    generateReport,
    reportHistory: reportHistory || [],
    reportsLoading
  };
}

export default usePerformanceData;