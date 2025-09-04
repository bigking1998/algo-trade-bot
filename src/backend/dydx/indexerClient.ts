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



function mapSymbolToBinance(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('-USD')) return upper.replace('-USD', 'USDT').replace(/-/g, '');
  return upper.replace(/-/g, '');
}

function mapTfToBinance(tf: Timeframe): string {
  // Binance supports: 1m,5m,15m,30m,1h,4h,1d
  return tf;
}

async function fetchBinanceKlines(symbol: string, tf: Timeframe, limit = 500): Promise<DydxCandle[]> {
  const bSymbol = mapSymbolToBinance(symbol);
  const interval = mapTfToBinance(tf);
  const url = new URL('https://api.binance.com/api/v3/klines');
  url.searchParams.set('symbol', bSymbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Binance klines failed: ${res.status} ${text}`);
  }
  const raw = (await res.json()) as any[];

  // Each item: [ openTime, open, high, low, close, volume, closeTime, ... ]
  return raw.map((k: any): DydxCandle => {
    const openTime = Number(k[0]); // ms
    return {
      time: openTime,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: k[5] !== undefined ? parseFloat(k[5]) : 0,
      timeframe: tf,
      symbol,
    };
  });
}

function mapSymbolToOkx(symbol: string): string {
  // BTC-USD -> BTC-USDT preferred
  const upper = symbol.toUpperCase();
  if (upper.endsWith('-USD')) return upper.replace('-USD', '-USDT');
  return upper;
}

function mapTfToOkx(tf: Timeframe): string {
  // OKX: 1m, 5m, 15m, 30m, 1H, 4H, 1D
  switch (tf) {
    case '1h': return '1H';
    case '4h': return '4H';
    case '1d': return '1D';
    default: return tf;
  }
}

async function fetchOkxCandles(symbol: string, tf: Timeframe, limit = 500): Promise<DydxCandle[]> {
  const oSymbol = mapSymbolToOkx(symbol);
  const bar = mapTfToOkx(tf);
  const url = new URL('https://www.okx.com/api/v5/market/candles');
  url.searchParams.set('instId', oSymbol);
  url.searchParams.set('bar', bar);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OKX candles failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data?: any[] };
  const raw = json?.data ?? [];

  // OKX returns newest-first arrays: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
  return raw
    .slice()
    .reverse()
    .map((k: any): DydxCandle => ({
      time: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: k[5] !== undefined ? parseFloat(k[5]) : 0,
      timeframe: tf,
      symbol,
    }));
}

export async function getCandles(
  symbol: string,
  tf: Timeframe,
  params?: { from?: string; to?: string }
): Promise<DydxCandle[]> {
  const resolution = tfToResolution(tf);
  const fromISO = normalizeIsoTime(params?.from);
  const toISO = normalizeIsoTime(params?.to);

  let candles: DydxCandle[] = [];

  // Attempt 1: typical v4 candles endpoint
  try {
    const data = await getJSON('candles/perpetualMarket', {
      market: symbol,
      resolution,
      fromISO,
      toISO,
    });

    const list: AnyJson[] = data?.candles ?? data?.data ?? data ?? [];
    if (Array.isArray(list)) {
      candles = list.map((c: AnyJson): DydxCandle => ({
        time: toNumber(c?.startedAt ?? c?.t ?? c?.time ?? Date.now()),
        open: toNumber(c?.open),
        high: toNumber(c?.high),
        low: toNumber(c?.low),
        close: toNumber(c?.close),
        volume: c?.volume !== undefined ? toNumber(c?.volume) : 0,
        timeframe: tf,
        symbol,
      }));
    }
  } catch {
    // Attempt 2: alternative param names (from/to)
    try {
      const data = await getJSON('candles/perpetualMarket', {
        market: symbol,
        resolution,
        from: fromISO,
        to: toISO,
      });

      const list: AnyJson[] = data?.candles ?? data?.data ?? data ?? [];
      if (Array.isArray(list)) {
        candles = list.map((c: AnyJson): DydxCandle => ({
          time: toNumber(c?.startedAt ?? c?.t ?? c?.time ?? Date.now()),
          open: toNumber(c?.open),
          high: toNumber(c?.high),
          low: toNumber(c?.low),
          close: toNumber(c?.close),
          volume: c?.volume !== undefined ? toNumber(c?.volume) : 0,
          timeframe: tf,
          symbol,
        }));
      }
    } catch {
      // use empty
    }
  }

  if (candles.length === 0) {
    // Try OKX first (Binance may be region-blocked)
    try {
      const okx = await fetchOkxCandles(symbol, tf, 500);
      if (okx.length) return okx;
    } catch {}
    try {
      return await fetchBinanceKlines(symbol, tf, 500);
    } catch {
      return [];
    }
  }
  return candles;
}



export async function getOraclePrices(): Promise<Record<string, number>> {
  // Some public indexer deployments don't expose /oracle; derive from markets.
  try {
    const mkts = await getMarkets(['BTC-USD', 'ETH-USD']);
    const out: Record<string, number> = {};
    for (const m of mkts) out[m.symbol] = m.oraclePrice ?? 0;
    return out;
  } catch {
    // final fallback
  }

  // Fallback: empty object
  const mkts = await getMarkets(['BTC-USD', 'ETH-USD']);
  const out: Record<string, number> = {};
  for (const m of mkts) {
    out[m.symbol] = m.oraclePrice ?? 0;
  }
  return out;
}
