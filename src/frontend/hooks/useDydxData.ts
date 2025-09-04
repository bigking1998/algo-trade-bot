import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { getMarkets, getCandles, getOraclePrices } from '@/frontend/lib/api/dydx';
import type { DydxCandle, DydxMarket, Timeframe } from '@/shared/types/trading';


/**
 * Markets query. Default symbols: BTC-USD, ETH-USD
 */
export function useMarkets(symbols?: string[], options?: UseQueryOptions<DydxMarket[], Error>) {
  const s = symbols && symbols.length ? symbols : ['BTC-USD', 'ETH-USD'];
  return useQuery<DydxMarket[], Error>({
    queryKey: ['dydx', 'markets', s.sort().join(',')],
    queryFn: () => getMarkets(s),
    refetchInterval: 30000, // Markets info changes slowly - 30 seconds
    staleTime: 15000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Candles query. Defaults to last 24h if range not provided.
 */
export function useCandles(
  symbol: string,
  tf: Timeframe,
  _range?: { from?: string; to?: string },
  options?: UseQueryOptions<DydxCandle[], Error>
) {
  // Smart polling based on timeframe - more frequent for shorter timeframes
  const refetchInterval = tf === '1m' ? 1000 : tf === '5m' ? 3000 : 5000;
  
  return useQuery<DydxCandle[], Error>({
    queryKey: ['dydx', 'candles', symbol, tf],
    queryFn: async () => {
      const data = await getCandles(symbol, tf);
      // eslint-disable-next-line no-console
      console.log('useCandles fetched', { symbol, tf, length: data.length, sample: data[0] });
      return data;
    },
    refetchInterval, // Dynamic polling based on timeframe
    staleTime: 1000, // Keep data fresh for live trading
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Oracle prices for symbols (map symbol -> price)
 */
export function useOracle(options?: UseQueryOptions<Record<string, number>, Error>) {
  return useQuery<Record<string, number>, Error>({
    queryKey: ['dydx', 'oracle'],
    queryFn: () => getOraclePrices(),
    refetchInterval: 2000, // Oracle prices update frequently - 2 seconds
    staleTime: 1000,
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    ...options,
  });
}

/**
 * Backend health check
 */
export function useApiHealth(options?: UseQueryOptions<{ status: string; time: string; version: string }, Error>) {
  return useQuery<{ status: string; time: string; version: string }, Error>({
    queryKey: ['api', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/health', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      const json = await res.json();
      return { status: json.status, time: json.time, version: json.version };
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
    gcTime: 60_000,
    ...options,
  });
}
