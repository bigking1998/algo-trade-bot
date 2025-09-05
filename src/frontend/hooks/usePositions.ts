import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Position, 
  PositionSummary,
  ActiveOrder,
  OrderPlacementRequest,
  TradeHistoryEntry,
  TradeFilters,
  PositionSizeCalculation,
  RiskMetrics 
} from '@/shared/types/trading';

// Mock data for development - will be replaced with real API calls
const mockPositions: Position[] = [
  {
    id: 'pos-1',
    symbol: 'BTC-USD',
    side: 'long',
    quantity: 0.5,
    entryPrice: 65000,
    currentPrice: 67500,
    unrealizedPnL: 1250,
    unrealizedPnLPercent: 3.85,
    marketValue: 33750,
    openedAt: new Date('2024-01-15T10:30:00Z'),
    lastUpdatedAt: new Date(),
    stopLoss: 62000,
    takeProfit: 70000,
    leverage: 2,
    margin: 16875,
  },
  {
    id: 'pos-2', 
    symbol: 'ETH-USD',
    side: 'short',
    quantity: 2.0,
    entryPrice: 3200,
    currentPrice: 3150,
    unrealizedPnL: 100,
    unrealizedPnLPercent: 1.56,
    marketValue: 6300,
    openedAt: new Date('2024-01-16T14:15:00Z'),
    lastUpdatedAt: new Date(),
    stopLoss: 3250,
    takeProfit: 3050,
    leverage: 1.5,
    margin: 4200,
  }
];

const mockActiveOrders: ActiveOrder[] = [
  {
    id: 'ord-1',
    symbol: 'BTC-USD',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 0.25,
    price: 66000,
    filledQuantity: 0,
    remainingQuantity: 0.25,
    status: 'PENDING',
    timeInForce: 'GTC',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'ord-2',
    symbol: 'ETH-USD', 
    side: 'SELL',
    type: 'STOP_LOSS',
    quantity: 1.0,
    price: 3100,
    stopPrice: 3100,
    filledQuantity: 0,
    remainingQuantity: 1.0,
    status: 'PENDING',
    timeInForce: 'GTC',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    reduceOnly: true,
  }
];

const mockTradeHistory: TradeHistoryEntry[] = [
  {
    id: 'trade-1',
    timestamp: '2024-01-14T09:30:00Z',
    symbol: 'BTC-USD',
    side: 'BUY',
    entryPrice: 64500,
    exitPrice: 65800,
    quantity: 0.3,
    pnl: 390,
    pnlPercent: 2.02,
    fees: 15.5,
    strategy: 'Momentum',
    duration: 14400000, // 4 hours
    status: 'CLOSED',
    exitTimestamp: '2024-01-14T13:30:00Z',
  },
  {
    id: 'trade-2',
    timestamp: '2024-01-13T16:45:00Z',
    symbol: 'ETH-USD',
    side: 'SELL',
    entryPrice: 3180,
    exitPrice: 3050,
    quantity: 1.5,
    pnl: 195,
    pnlPercent: 4.09,
    fees: 9.7,
    strategy: 'Mean Reversion',
    duration: 28800000, // 8 hours  
    status: 'CLOSED',
    exitTimestamp: '2024-01-14T00:45:00Z',
  }
];

/**
 * Hook to fetch active positions with real-time updates
 */
export const usePositions = (strategyId?: string) => {
  return useQuery({
    queryKey: ['positions', strategyId],
    queryFn: async (): Promise<Position[]> => {
      // TODO: Replace with real API call
      // return positionApi.getActivePositions(strategyId);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      return strategyId 
        ? mockPositions.filter(p => p.strategyId === strategyId)
        : mockPositions;
    },
    refetchInterval: 2000, // Update every 2 seconds
    staleTime: 1000,
    retry: 1,
  });
};

/**
 * Hook to fetch position summary metrics
 */
export const usePositionSummary = () => {
  return useQuery({
    queryKey: ['position-summary'],
    queryFn: async (): Promise<PositionSummary> => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        totalPositions: mockPositions.length,
        totalUnrealizedPnL: mockPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
        totalUnrealizedPnLPercent: 2.89,
        totalMarketValue: mockPositions.reduce((sum, p) => sum + p.marketValue, 0),
        longPositions: mockPositions.filter(p => p.side === 'long').length,
        shortPositions: mockPositions.filter(p => p.side === 'short').length,
        largestPosition: 'BTC-USD',
        riskExposure: 65.5,
      };
    },
    refetchInterval: 3000,
    staleTime: 2000,
  });
};

/**
 * Hook to fetch active orders with real-time updates  
 */
export const useActiveOrders = (strategyId?: string) => {
  return useQuery({
    queryKey: ['orders', 'active', strategyId],
    queryFn: async (): Promise<ActiveOrder[]> => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 400));
      return mockActiveOrders;
    },
    refetchInterval: 1000, // Update every second
    staleTime: 500,
    retry: 1,
  });
};

/**
 * Hook to fetch trade history with filtering
 */
export const useTradeHistory = (filters: TradeFilters) => {
  return useQuery({
    queryKey: ['trades', 'history', filters],
    queryFn: async (): Promise<TradeHistoryEntry[]> => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 600));
      return mockTradeHistory.filter(trade => {
        if (filters.symbol && trade.symbol !== filters.symbol) return false;
        if (filters.strategy && trade.strategy !== filters.strategy) return false;
        if (filters.side && trade.side !== filters.side) return false;
        if (filters.status && trade.status.toLowerCase() !== filters.status) return false;
        return true;
      });
    },
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 3000,
  });
};

/**
 * Hook to calculate position size based on risk parameters
 */
export const usePositionSizeCalculator = () => {
  return useMutation({
    mutationFn: async (params: {
      symbol: string;
      riskPercent: number;
      entryPrice: number;
      stopLoss: number;
      accountBalance: number;
    }): Promise<PositionSizeCalculation> => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { riskPercent, entryPrice, stopLoss, accountBalance } = params;
      const riskAmount = (accountBalance * riskPercent) / 100;
      const priceRisk = Math.abs(entryPrice - stopLoss);
      const recommendedQuantity = riskAmount / priceRisk;
      const positionValue = recommendedQuantity * entryPrice;
      const leverage = 1; // Default leverage
      const margin = positionValue / leverage;
      
      return {
        symbol: params.symbol,
        riskAmount,
        riskPercent,
        entryPrice,
        stopLoss,
        recommendedQuantity,
        maxQuantity: recommendedQuantity * 1.5,
        positionValue,
        leverage,
        margin,
      };
    },
  });
};

/**
 * Hook to place new orders
 */
export const usePlaceOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderRequest: OrderPlacementRequest) => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Placing order:', orderRequest);
      return { success: true, orderId: `order-${Date.now()}` };
    },
    onSuccess: () => {
      // Invalidate relevant queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};

/**
 * Hook to modify existing orders
 */
export const useModifyOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { orderId: string; price?: number; quantity?: number }) => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log('Modifying order:', params);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

/**
 * Hook to cancel orders
 */
export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderId: string) => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 600));
      console.log('Cancelling order:', orderId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

/**
 * Hook to close positions
 */
export const useClosePosition = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (positionId: string) => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Closing position:', positionId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

/**
 * Hook to get real-time risk metrics
 */
export const useRiskMetrics = () => {
  return useQuery({
    queryKey: ['risk-metrics'],
    queryFn: async (): Promise<RiskMetrics> => {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 400));
      return {
        portfolioHeat: 68.5,
        maxRiskPerTrade: 2.0,
        totalExposure: 42500,
        availableBalance: 15000,
        marginUtilization: 74.2,
        riskRewardRatio: 2.3,
        maxDrawdown: 8.5,
        sharpeRatio: 1.8,
      };
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });
};