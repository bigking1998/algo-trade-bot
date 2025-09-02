import * as http from 'http';
import { URL } from 'url';
import { getMarkets, getCandles, getOraclePrices } from '../dydx/indexerClient';
import type { Timeframe } from '../../shared/types/trading';

function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJSON(res: http.ServerResponse, statusCode: number, body: unknown) {
  setCors(res);
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function methodNotAllowed(res: http.ServerResponse) {
  sendJSON(res, 405, { error: 'Method Not Allowed' });
}

function badRequest(res: http.ServerResponse, message: string) {
  sendJSON(res, 400, { error: 'Bad Request', message });
}

const ALLOWED_TF: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

function isTimeframe(val?: string | null): val is Timeframe {
  return !!val && (ALLOWED_TF as string[]).includes(val);
}

export async function handleDydxRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  const { pathname, searchParams } = url;

  if (!pathname.startsWith('/api/dydx')) {
    return false;
  }

  try {
    // GET /api/dydx/markets?symbols=BTC-USD,ETH-USD
    if (pathname === '/api/dydx/markets') {
      if (req.method !== 'GET') return methodNotAllowed(res), true;

      const symbolsParam = searchParams.get('symbols');
      const symbols = symbolsParam
        ? symbolsParam.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const data = await getMarkets(symbols as string[] | undefined);
      sendJSON(res, 200, data);
      return true;
    }

    // GET /api/dydx/candles?symbol=BTC-USD&tf=1m&from=...&to=...
    if (pathname === '/api/dydx/candles') {
      if (req.method !== 'GET') return methodNotAllowed(res), true;

      const symbol = searchParams.get('symbol') || undefined;
      const tf = searchParams.get('tf');

      if (!symbol) {
        badRequest(res, 'Missing required query param: symbol');
        return true;
      }
      if (!isTimeframe(tf)) {
        badRequest(res, `Invalid timeframe. Allowed: ${ALLOWED_TF.join(', ')}`);
        return true;
      }

      const from = searchParams.get('from') || undefined;
      const to = searchParams.get('to') || undefined;

      const data = await getCandles(symbol, tf, { from, to });
      sendJSON(res, 200, data);
      return true;
    }

    // GET /api/dydx/oracle
    if (pathname === '/api/dydx/oracle') {
      if (req.method !== 'GET') return methodNotAllowed(res), true;

      const data = await getOraclePrices();
      sendJSON(res, 200, data);
      return true;
    }

    // DEBUG: raw indexer markets passthrough to verify upstream shape
    // GET /api/dydx/marketsRaw
    if (pathname === '/api/dydx/marketsRaw') {
      if (req.method !== 'GET') return methodNotAllowed(res), true;

      const base = process.env.DYDX_INDEXER_URL || 'https://indexer.dydx.trade/v4';
      const urlStr = (base.endsWith('/') ? base : `${base}/`) + 'perpetualMarkets';
      try {
        const upstream = await fetch(urlStr, { headers: { accept: 'application/json' } });
        const json = await upstream.json().catch(() => ({}));
        sendJSON(res, upstream.status, json);
      } catch (e: any) {
        sendJSON(res, 502, { error: 'Upstream fetch failed', message: e?.message || String(e) });
      }
      return true;
    }

    // If path starts with /api/dydx but no match, 404 in caller
    return false;
  } catch (err: any) {
    const message = err?.message || 'Internal Error';
    sendJSON(res, 500, { error: 'Internal Server Error', message });
    return true;
  }
}
