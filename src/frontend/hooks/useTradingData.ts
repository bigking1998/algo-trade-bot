import { useQuery } from '@tanstack/react-query';
import { getPositions, getTradingPerformance } from '@/frontend/lib/api/dydx';

/**
 * Hook to fetch real trading positions for a connected wallet
 * Returns empty array if no wallet connected or no positions exist
 */
export function usePositions(walletAddress: string | null) {
  return useQuery({
    queryKey: ['positions', walletAddress],
    queryFn: () => walletAddress ? getPositions(walletAddress) : Promise.resolve([]),
    enabled: !!walletAddress,
    refetchInterval: 2000, // Update every 2 seconds for live positions
    staleTime: 1000,
    retry: false, // Don't retry if API not implemented yet
  });
}

/**
 * Hook to fetch real trading performance/P&L data
 * Returns null data if no wallet connected or no trading history
 */
export function useTradingPerformance(walletAddress: string | null) {
  return useQuery({
    queryKey: ['trading-performance', walletAddress],
    queryFn: () => walletAddress ? getTradingPerformance(walletAddress) : Promise.resolve(null),
    enabled: !!walletAddress,
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 3000,
    retry: false, // Don't retry if API not implemented yet
  });
}