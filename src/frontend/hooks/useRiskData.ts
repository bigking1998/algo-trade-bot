import { useQuery, UseQueryOptions } from '@tanstack/react-query';

// Risk Metrics Types
interface RiskMetrics {
  var1d: number;
  var7d: number;
  maxDrawdown: number;
  currentDrawdown: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  timestamp: string;
}

interface DrawdownDataPoint {
  timestamp: string;
  drawdown: number;
  equity: number;
  peak: number;
}

interface VolatilityMetrics {
  current: number;
  daily: number;
  weekly: number;
  monthly: number;
  percentile: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface Position {
  symbol: string;
  strategy: string;
  exposure: number;
  unrealizedPnL: number;
  riskContribution: number;
  concentration: number;
  side: 'long' | 'short';
}

interface PositionExposureData {
  positions: Position[];
  totalExposure: number;
  netExposure: number;
  grossExposure: number;
  timestamp: string;
}

interface RiskAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'drawdown' | 'volatility' | 'exposure' | 'var' | 'correlation';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  threshold?: number;
  currentValue?: number;
  symbol?: string;
}

interface RiskAlertsData {
  alerts: RiskAlert[];
  activeCount: number;
  criticalCount: number;
  timestamp: string;
}

interface ExposureData {
  symbol: string;
  exposure: number;
  percentage: number;
  correlation: { [key: string]: number };
  sector?: string;
  strategy?: string;
}

interface ExposureMatrixData {
  exposures: ExposureData[];
  correlationMatrix: { [symbol: string]: { [otherSymbol: string]: number } };
  concentrationRisk: number;
  diversificationScore: number;
  timestamp: string;
}

// API Functions (these would connect to actual backend endpoints)
const fetchRiskMetrics = async (_portfolioId?: string): Promise<RiskMetrics> => {
  // Mock data for development - replace with actual API call
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
  
  return {
    var1d: 2500,
    var7d: 8200,
    maxDrawdown: 8.5,
    currentDrawdown: -2.1,
    volatility: 18.3,
    sharpeRatio: 1.42,
    sortinoRatio: 1.87,
    calmarRatio: 0.89,
    winRate: 0.67,
    avgWin: 125.50,
    avgLoss: -78.20,
    profitFactor: 2.1,
    timestamp: new Date().toISOString()
  };
};

const fetchDrawdownHistory = async (timeframe: string): Promise<DrawdownDataPoint[]> => {
  // Mock data generation
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
  const data: DrawdownDataPoint[] = [];
  
  let peak = 10000;
  let equity = 10000;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    // Simulate realistic market movements
    const dailyReturn = (Math.random() - 0.48) * 0.04; // Slightly positive bias
    equity *= (1 + dailyReturn);
    
    if (equity > peak) {
      peak = equity;
    }
    
    const drawdown = ((equity - peak) / peak) * 100;
    
    data.push({
      timestamp: date.toISOString(),
      drawdown,
      equity,
      peak
    });
  }
  
  return data;
};

const fetchVolatilityData = async (): Promise<VolatilityMetrics> => {
  await new Promise(resolve => setTimeout(resolve, 120));
  
  const current = 18 + Math.random() * 12; // 18-30% range
  
  return {
    current,
    daily: current * 0.15,
    weekly: current * 0.6,
    monthly: current,
    percentile: Math.floor(Math.random() * 100),
    trend: Math.random() > 0.5 ? 'increasing' : Math.random() > 0.5 ? 'decreasing' : 'stable'
  };
};

const fetchPositionExposure = async (strategyId?: string): Promise<PositionExposureData> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const positions: Position[] = [
    {
      symbol: 'BTC-USD',
      strategy: 'Mean Reversion',
      exposure: 25000,
      unrealizedPnL: 1250,
      riskContribution: 35,
      concentration: 40,
      side: 'long'
    },
    {
      symbol: 'ETH-USD',
      strategy: 'Trend Following', 
      exposure: -15000,
      unrealizedPnL: -780,
      riskContribution: 22,
      concentration: 25,
      side: 'short'
    },
    {
      symbol: 'SOL-USD',
      strategy: 'Scalping',
      exposure: 8000,
      unrealizedPnL: 340,
      riskContribution: 12,
      concentration: 15,
      side: 'long'
    }
  ];
  
  const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.exposure), 0);
  const netExposure = positions.reduce((sum, pos) => sum + pos.exposure, 0);
  
  return {
    positions: strategyId ? positions.filter(p => p.strategy === strategyId) : positions,
    totalExposure,
    netExposure,
    grossExposure: totalExposure,
    timestamp: new Date().toISOString()
  };
};

const fetchRiskAlerts = async (): Promise<RiskAlertsData> => {
  await new Promise(resolve => setTimeout(resolve, 80));
  
  const alerts: RiskAlert[] = [
    {
      id: '1',
      type: 'critical',
      category: 'drawdown',
      title: 'Maximum Drawdown Exceeded',
      message: 'Portfolio drawdown has exceeded the 10% threshold',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      acknowledged: false,
      threshold: 10,
      currentValue: 12.5
    },
    {
      id: '2', 
      type: 'warning',
      category: 'volatility',
      title: 'High Volatility Alert',
      message: 'BTC-USD position showing increased volatility',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      acknowledged: false,
      threshold: 25,
      currentValue: 28.3,
      symbol: 'BTC-USD'
    }
  ];
  
  return {
    alerts,
    activeCount: alerts.filter(a => !a.acknowledged).length,
    criticalCount: alerts.filter(a => a.type === 'critical' && !a.acknowledged).length,
    timestamp: new Date().toISOString()
  };
};

const fetchExposureMatrix = async (): Promise<ExposureMatrixData> => {
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const exposures: ExposureData[] = [
    {
      symbol: 'BTC-USD',
      exposure: 25000,
      percentage: 40,
      correlation: { 'ETH-USD': 0.82, 'SOL-USD': 0.65, 'AVAX-USD': 0.58 },
      sector: 'Cryptocurrency',
      strategy: 'Trend Following'
    },
    {
      symbol: 'ETH-USD',
      exposure: -15000,
      percentage: 25,
      correlation: { 'BTC-USD': 0.82, 'SOL-USD': 0.73, 'AVAX-USD': 0.68 },
      sector: 'Cryptocurrency', 
      strategy: 'Mean Reversion'
    }
  ];
  
  const correlationMatrix = exposures.reduce((matrix, exp) => {
    matrix[exp.symbol] = {
      [exp.symbol]: 1,
      ...exp.correlation
    };
    return matrix;
  }, {} as { [symbol: string]: { [otherSymbol: string]: number } });
  
  return {
    exposures,
    correlationMatrix,
    concentrationRisk: 65,
    diversificationScore: 3.2,
    timestamp: new Date().toISOString()
  };
};

/**
 * Hook for fetching portfolio risk metrics
 */
export function useRiskMetrics(
  portfolioId?: string,
  options?: UseQueryOptions<RiskMetrics, Error>
) {
  return useQuery<RiskMetrics, Error>({
    queryKey: ['risk', 'metrics', portfolioId],
    queryFn: () => fetchRiskMetrics(portfolioId),
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 3000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Hook for fetching drawdown history data
 */
export function useDrawdownHistory(
  timeframe: string = '30d',
  options?: UseQueryOptions<DrawdownDataPoint[], Error>
) {
  return useQuery<DrawdownDataPoint[], Error>({
    queryKey: ['risk', 'drawdown', timeframe],
    queryFn: () => fetchDrawdownHistory(timeframe),
    refetchInterval: 10000, // Update every 10 seconds
    staleTime: 5000,
    gcTime: 300_000, // Keep longer since historical data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Hook for fetching volatility metrics
 */
export function useVolatilityData(
  options?: UseQueryOptions<VolatilityMetrics, Error>
) {
  return useQuery<VolatilityMetrics, Error>({
    queryKey: ['risk', 'volatility'],
    queryFn: fetchVolatilityData,
    refetchInterval: 3000, // Update every 3 seconds
    staleTime: 2000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Hook for fetching position exposure data
 */
export function usePositionExposure(
  strategyId?: string,
  options?: UseQueryOptions<PositionExposureData, Error>
) {
  return useQuery<PositionExposureData, Error>({
    queryKey: ['risk', 'positions', strategyId],
    queryFn: () => fetchPositionExposure(strategyId),
    refetchInterval: 2000, // Update every 2 seconds for real-time positions
    staleTime: 1000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Hook for fetching risk alerts
 */
export function useRiskAlerts(
  options?: UseQueryOptions<RiskAlertsData, Error>
) {
  return useQuery<RiskAlertsData, Error>({
    queryKey: ['risk', 'alerts'],
    queryFn: fetchRiskAlerts,
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 3000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Hook for fetching exposure matrix and correlation data
 */
export function useExposureMatrix(
  options?: UseQueryOptions<ExposureMatrixData, Error>
) {
  return useQuery<ExposureMatrixData, Error>({
    queryKey: ['risk', 'exposure-matrix'],
    queryFn: fetchExposureMatrix,
    refetchInterval: 15000, // Update every 15 seconds (correlations change slowly)
    staleTime: 10000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}