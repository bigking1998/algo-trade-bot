import { useState, useEffect, useCallback } from 'react';
import type { AssetBalance, PortfolioSummary, PortfolioBalancesResponse } from '@/shared/types/trading';

const API_BASE = 'http://localhost:3001/api';

interface UsePortfolioResult {
  balances: AssetBalance[];
  summary: PortfolioSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePortfolio(walletAddress?: string | null): UsePortfolioResult {
  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolioData = useCallback(async () => {
    if (!walletAddress) {
      // No wallet connected - set empty state
      setBalances([]);
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`[usePortfolio] Fetching data for wallet: ${walletAddress}`);

      // Fetch balances and summary in parallel with wallet address
      const [balancesResponse, summaryResponse] = await Promise.all([
        fetch(`${API_BASE}/dydx/portfolio/balances?address=${encodeURIComponent(walletAddress)}`),
        fetch(`${API_BASE}/dydx/portfolio/summary?address=${encodeURIComponent(walletAddress)}`)
      ]);

      if (!balancesResponse.ok || !summaryResponse.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const balancesData: PortfolioBalancesResponse = await balancesResponse.json();
      const summaryData: PortfolioSummary = await summaryResponse.json();

      setBalances(balancesData.balances || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const refetch = useCallback(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  useEffect(() => {
    fetchPortfolioData();
    
    // Set up polling for real-time updates (every 15 seconds for more responsive updates)
    const interval = setInterval(fetchPortfolioData, 15000);
    
    // Also refresh when window gains focus (user returns to tab)
    const handleFocus = () => {
      if (!loading) {
        fetchPortfolioData();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPortfolioData, loading]);

  return {
    balances,
    summary,
    loading,
    error,
    refetch
  };
}