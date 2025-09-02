import { useQuery } from "@tanstack/react-query";
import { useCandles } from "@/frontend/hooks/useDydxData";
import type { DydxCandle, Timeframe } from "@/shared/types/trading";

/**
 * Frontend-only chart candles hook.
 * - Tries backend /api/dydx/candles first via useCandles
 * - If empty or error, falls back to public OHLCV (Binance primary, OKX backup)
 * - Returns the same shape { data, isLoading, isError } expected by the chart
 *
 * IMPORTANT: This hook only affects the chart layer and does not modify other data sources.
 */

function mapSymbolToBinance(symbol: string): string {
  // BTC-USD -> BTCUSDT
  if (symbol.toUpperCase().endsWith("-USD")) {
    return symbol.toUpperCase().replace("-USD", "USDT").replace(/-/g, "");
  }
  // Fallback: strip hyphen
  return symbol.toUpperCase().replace(/-/g, "");
}

function mapSymbolToOkx(symbol: string): string {
  // BTC-USD -> BTC-USDT
  if (symbol.toUpperCase().endsWith("-USD")) {
    return symbol.toUpperCase().replace("-USD", "-USDT");
  }
  return symbol.toUpperCase();
}

function mapTfToBinance(tf: Timeframe): string {
  // Binance intervals: 1m,5m,15m,30m,1h,4h,1d
  return tf;
}

function mapTfToOkx(tf: Timeframe): string {
  // OKX intervals: 1m, 5m, 15m, 30m, 1H, 4H, 1D
  switch (tf) {
    case "1h":
      return "1H";
    case "4h":
      return "4H";
    case "1d":
      return "1D";
    default:
      return tf; // 1m,5m,15m,30m
  }
}

async function fetchBinanceKlines(symbol: string, tf: Timeframe, limit = 500): Promise<DydxCandle[]> {
  const bSymbol = mapSymbolToBinance(symbol);
  const interval = mapTfToBinance(tf);
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(bSymbol)}&interval=${encodeURIComponent(
    interval
  )}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const raw = (await res.json()) as any[];

  // Each item: [ openTime, open, high, low, close, volume, closeTime, ... ]
  return raw.map((k) => {
    const openTime = Number(k[0]); // ms
    return {
      time: openTime,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: k[5] !== undefined ? parseFloat(k[5]) : undefined,
      timeframe: tf,
      symbol,
    } as DydxCandle;
  });
}

async function fetchOkxCandles(symbol: string, tf: Timeframe, limit = 300): Promise<DydxCandle[]> {
  const oSymbol = mapSymbolToOkx(symbol);
  const bar = mapTfToOkx(tf);
  const url = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(oSymbol)}&bar=${encodeURIComponent(
    bar
  )}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OKX candles failed: ${res.status}`);
  const json = (await res.json()) as { data?: any[] };
  const raw = json?.data ?? [];

  // OKX: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
  return raw
    .slice()
    .reverse() // OKX returns newest first; reverse to oldest->newest
    .map((k) => {
      const ts = Number(k[0]); // ms
      return {
        time: ts,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: k[5] !== undefined ? parseFloat(k[5]) : undefined,
        timeframe: tf,
        symbol,
      } as DydxCandle;
    });
}

/**
 * Fallback fetcher: try Binance first, then OKX.
 */
async function fetchFallbackCandles(symbol: string, tf: Timeframe, limit = 500): Promise<DydxCandle[]> {
  try {
    const b = await fetchBinanceKlines(symbol, tf, limit);
    if (b.length) return b;
  } catch {
    // ignore and try OKX
  }
  try {
    const o = await fetchOkxCandles(symbol, tf, Math.min(limit, 300));
    if (o.length) return o;
  } catch {
    // ignore
  }
  return [];
}

export function useChartCandles(
  symbol: string,
  tf: Timeframe,
  range?: { from?: string; to?: string }
): { data: DydxCandle[] | undefined; isLoading: boolean; isError: boolean } {
  // Backend-first: use existing hook (keeps contract unchanged)
  const backend = useCandles(symbol, tf, range);

  // Trigger fallback only if backend is success with empty data OR backend errored
  const enableFallback =
    (backend.isSuccess && ((backend.data?.length ?? 0) === 0)) || backend.isError;

  const fallback = useQuery<DydxCandle[], Error>({
    queryKey: ["fallback", "candles", symbol, tf, range?.from, range?.to],
    enabled: enableFallback,
    staleTime: 15_000,
    gcTime: 60_000,
    queryFn: async () => {
      // Estimate limit by range if provided (rough heuristic), else default 500
      let limit = 500;
      if (range?.from && range?.to) {
        const from = new Date(range.from).getTime();
        const to = new Date(range.to).getTime();
        const spanMs = Math.max(0, to - from);
        const tfMs =
          tf === "1m"
            ? 60_000
            : tf === "5m"
            ? 5 * 60_000
            : tf === "15m"
            ? 15 * 60_000
            : tf === "30m"
            ? 30 * 60_000
            : tf === "1h"
            ? 60 * 60_000
            : tf === "4h"
            ? 4 * 60 * 60_000
            : 24 * 60 * 60_000; // 1d
        limit = Math.min(1000, Math.max(100, Math.ceil(spanMs / tfMs)));
      }
      return fetchFallbackCandles(symbol, tf, limit);
    },
  });

  const data =
    backend.data && backend.data.length ? backend.data : fallback.data;

  const isLoading =
    backend.isLoading ||
    (enableFallback && fallback.isLoading);

  const isError =
    (backend.isError && (!fallback.data || fallback.data.length === 0) && fallback.isError) ||
    false;

  return { data, isLoading, isError };
}
