import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { getMarkets, getCandles, getOraclePrices } from '@/frontend/lib/api/dydx';
import type { DydxCandle, DydxMarket, Timeframe } from '@/shared/types/trading';

/**
 * Returns ISO strings for a time window ending now.
 */
function getDefaultRange(hoursBack = 24) {
  const to = new Date();
  const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Markets query. Default symbols: BTC-USD, ETH-USD
 */
export function useMarkets(symbols?: string[], options?: UseQueryOptions<DydxMarket[], Error>) {
  const s = symbols && symbols.length ? symbols : ['BTC-USD', 'ETH-USD'];
  return useQuery<DydxMarket[], Error>({
    queryKey: ['dydx', 'markets', s.sort().join(',')],
    queryFn: () => getMarkets(s),
    staleTime: 15_000,
    gcTime: 60_000,
    ...options,
  });
}

/**
 * Candles query. Defaults to last 24h if range not provided.
 */
export function useCandles(
  symbol: string,
  tf: Timeframe,
  range?: { from?: string; to?: string },
  options?: UseQueryOptions<DydxCandle[], Error>
) {
  const r = range?.from || range?.to ? range : getDefaultRange(24);
  return useQuery<DydxCandle[], Error>({
    queryKey: ['dydx', 'candles', symbol, tf, r.from, r.to],
    queryFn: () => getCandles(symbol, tf, r),
    staleTime: 15_000,
    gcTime: 60_000,
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
    staleTime: 15_000,
    gcTime: 60_000,
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
