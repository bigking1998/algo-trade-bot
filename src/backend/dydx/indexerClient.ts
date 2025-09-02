import { DydxCandle, DydxMarket, Timeframe } from '../../shared/types/trading';
import { normalizeIsoTime, tfToResolution } from '../util/timeframe';

const RAW_BASE = process.env.DYDX_INDEXER_URL || 'https://indexer.dydx.trade/v4';
const BASE_URL = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;

type AnyJson = any;

async function getJSON(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<AnyJson> {
  // Ensure: BASE_URL has trailing slash and path has no leading slash so `${BASE_URL}${path}` keeps /v4/.
  const safePath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(safePath, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'accept': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Indexer GET ${url.pathname} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMarket(symbol: string, raw: AnyJson): DydxMarket {
  // Try common fields used by dYdX v4 indexer
  const status = (raw?.status || raw?.marketStatus || 'ACTIVE') as 'ACTIVE' | 'PAUSED';
  const oraclePrice = toNumber(raw?.oraclePrice ?? raw?.indexPrice ?? raw?.price, 0);
  const priceStep = toNumber(raw?.tickSize ?? raw?.priceStep ?? raw?.priceIncrement ?? 0.5, 0.5);
  const sizeStep = toNumber(raw?.stepSize ?? raw?.sizeStep ?? raw?.quantityIncrement ?? 0.001, 0.001);
  const minOrderSize = toNumber(raw?.minOrderSize ?? raw?.minSize ?? 0.001, 0.001);

  return {
    symbol,
    status,
    oraclePrice,
    priceStep,
    sizeStep,
    minOrderSize,
  };
}

export async function getMarkets(symbols: string[] = ['BTC-USD', 'ETH-USD']): Promise<DydxMarket[]> {
  // Attempt 1: /perpetualMarkets (observed working on public indexer)
  try {
    const data = await getJSON('perpetualMarkets');
    // Response could be { markets: Record<symbol, market> } or { markets: Market[] }
    const marketsField = data?.markets ?? data;
    const out: DydxMarket[] = [];

    if (Array.isArray(marketsField)) {
      const bySymbol = new Map<string, AnyJson>();
      for (const m of marketsField) {
        const sym = m?.symbol ?? m?.market ?? m?.ticker ?? '';
        if (sym) bySymbol.set(sym, m);
      }
      for (const s of symbols) {
        const raw = bySymbol.get(s) ?? {};
        out.push(normalizeMarket(s, raw));
      }
      return out;
    }

    if (marketsField && typeof marketsField === 'object') {
      for (const s of symbols) {
        const raw = marketsField[s] ?? {};
        out.push(normalizeMarket(s, raw));
      }
      return out;
    }

    // Fallback to empty normalization
    return symbols.map((s) => normalizeMarket(s, {}));
  } catch {
    // Attempt 2: alternative path (some deployments expose /markets)
    try {
      const data = await getJSON('markets');
      const marketsField = data?.markets ?? data;
      const out: DydxMarket[] = [];
      if (Array.isArray(marketsField)) {
        const bySymbol = new Map<string, AnyJson>();
        for (const m of marketsField) {
          const sym = m?.symbol ?? m?.market ?? '';
          if (sym) bySymbol.set(sym, m);
        }
        for (const s of symbols) {
          const raw = bySymbol.get(s) ?? {};
          out.push(normalizeMarket(s, raw));
        }
        return out;
      }
      if (marketsField && typeof marketsField === 'object') {
        for (const s of symbols) {
          const raw = marketsField[s] ?? {};
          out.push(normalizeMarket(s, raw));
        }
        return out;
      }
      return symbols.map((s) => normalizeMarket(s, {}));
    } catch {
      // Final fallback
      return symbols.map((s) => normalizeMarket(s, {}));
    }
  }
}

export async function getCandles(
  symbol: string,
  tf: Timeframe,
  params?: { from?: string; to?: string }
): Promise<DydxCandle[]> {
  const resolution = tfToResolution(tf);
  const fromISO = normalizeIsoTime(params?.from);
  const toISO = normalizeIsoTime(params?.to);

  // Attempt 1: typical v4 candles endpoint
  try {
    const data = await getJSON('candles', {
      market: symbol,
      resolution,
      fromISO,
      toISO,
    });

    const list: AnyJson[] = data?.candles ?? data?.data ?? data ?? [];
    if (!Array.isArray(list)) return [];

    return list.map((c: AnyJson): DydxCandle => ({
      time: toNumber(c?.startedAt ?? c?.t ?? c?.time ?? Date.now()),
      open: toNumber(c?.open),
      high: toNumber(c?.high),
      low: toNumber(c?.low),
      close: toNumber(c?.close),
      volume: c?.volume !== undefined ? toNumber(c?.volume) : undefined,
      timeframe: tf,
      symbol,
    }));
  } catch (e) {
    // Attempt 2: alternative param names (from/to)
    try {
      const data = await getJSON('candles', {
        market: symbol,
        resolution,
        from: fromISO,
        to: toISO,
      });
      const list: AnyJson[] = data?.candles ?? data?.data ?? data ?? [];
      if (!Array.isArray(list)) return [];
      return list.map((c: AnyJson): DydxCandle => ({
        time: toNumber(c?.startedAt ?? c?.t ?? c?.time ?? Date.now()),
        open: toNumber(c?.open),
        high: toNumber(c?.high),
        low: toNumber(c?.low),
        close: toNumber(c?.close),
        volume: c?.volume !== undefined ? toNumber(c?.volume) : undefined,
        timeframe: tf,
        symbol,
      }));
    } catch {
      return [];
    }
  }
}

export async function getOraclePrices(): Promise<Record<string, number>> {
  // Some public indexer deployments don't expose /oracle; derive from markets.
  try {
    const mkts = await getMarkets(['BTC-USD', 'ETH-USD']);
    const out: Record<string, number> = {};
    for (const m of mkts) out[m.symbol] = m.oraclePrice;
    return out;
  } catch {
    // final fallback
  }

  // Fallback: empty object
  const mkts = await getMarkets(['BTC-USD', 'ETH-USD']);
  const out: Record<string, number> = {};
  for (const m of mkts) {
    out[m.symbol] = m.oraclePrice;
  }
  return out;
}
