import type {
  DydxCandle,
  DydxMarket,
  OrderRequest,
  OrderResponse,
  Timeframe,
  WalletInfo,
} from '@/shared/types/trading';

async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`GET ${path} failed: ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`POST ${path} failed: ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Markets
 * GET /api/dydx/markets?symbols=BTC-USD,ETH-USD
 */
export async function getMarkets(symbols?: string[]): Promise<DydxMarket[]> {
  const params = symbols && symbols.length ? { symbols: symbols.join(',') } : undefined;
  return apiGet<DydxMarket[]>('/dydx/markets', params);
}

/**
 * Candles
 * GET /api/dydx/candles?symbol=BTC-USD&tf=1m&from=...&to=...
 */
export async function getCandles(
  symbol: string,
  tf: Timeframe,
  range?: { from?: string; to?: string }
): Promise<DydxCandle[]> {
  return apiGet<DydxCandle[]>('/dydx/candles', {
    symbol,
    tf,
    from: range?.from,
    to: range?.to,
  });
}

/**
 * Oracle Prices
 * GET /api/dydx/oracle
 */
export async function getOraclePrices(): Promise<Record<string, number>> {
  return apiGet<Record<string, number>>('/dydx/oracle');
}

/**
 * Submit Order (server route to be implemented)
 * POST /api/orders
 */
export async function submitOrder(order: OrderRequest, signed?: unknown): Promise<OrderResponse> {
  return apiPost<OrderResponse>('/orders', { order, signed });
}

/**
 * Get real trading positions for connected wallet
 * GET /api/positions?address=...
 */
export async function getPositions(walletAddress: string): Promise<any[]> {
  return apiGet<any[]>('/positions', { address: walletAddress });
}

/**
 * Get real trading performance/P&L data
 * GET /api/trading/performance?address=...
 */
export async function getTradingPerformance(walletAddress: string): Promise<{
  dailyPnl: number;
  winRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
}> {
  return apiGet('/trading/performance', { address: walletAddress });
}

/**
 * Run backtest for a strategy
 * POST /api/backtest
 */
export async function runBacktest(backtestRequest: {
  symbol: string;
  timeframe: string;
  fromDate: string;
  toDate: string;
  strategy: string;
  parameters: Record<string, any>;
}): Promise<{
  trades: any[];
  metrics: {
    totalPnl: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    maxDrawdown: number;
    sharpeRatio?: number;
  };
}> {
  return apiPost('/backtest', backtestRequest);
}

/**
 * Wallet lookup (server route to be implemented)
 * GET /api/wallet/:address
 */
export async function getWallet(address: string): Promise<WalletInfo> {
  return apiGet<WalletInfo>(`/wallet/${encodeURIComponent(address)}`);
}

/**
 * Get active orders
 * GET /api/dydx/orders/active
 */
export async function getActiveOrders(): Promise<any> {
  return apiGet('/dydx/orders/active');
}

/**
 * Create a new order
 * POST /api/dydx/orders/create
 */
export async function createOrder(order: OrderRequest): Promise<OrderResponse> {
  return apiPost<OrderResponse>('/dydx/orders/create', { order });
}

/**
 * Cancel an order
 * DELETE /api/dydx/orders/:orderId
 */
export async function cancelOrder(orderId: string): Promise<any> {
  const res = await fetch(`/api/dydx/orders/${orderId}`, {
    method: 'DELETE',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`DELETE /api/dydx/orders/${orderId} failed: ${res.status} ${msg}`);
  }
  return res.json();
}
