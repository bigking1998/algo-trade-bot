export type TickerSymbol = string;

export interface Position {
  id: string;
  symbol: TickerSymbol;
  qty: number;
  avgPrice: number;
  marketPrice: number;
  pnl: number;
  value: number;
}

export type TradeSide = "BUY" | "SELL";

export interface Trade {
  id: string;
  timestamp: string; // ISO string
  symbol: TickerSymbol;
  side: TradeSide;
  qty: number;
  price: number;
  strategyId?: string;
}

export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
  updatedAt: string; // ISO
}

export interface PortfolioKpis {
  balance: number;
  equity: number;
  pnl24h: number;
  winRate: number; // 0..1
}

export interface MarketTick {
  t: number; // epoch ms
  symbol: TickerSymbol;
  price: number;
  volume?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// dYdX v4 types (non-breaking extensions)
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export type DydxNetwork = 'mainnet' | 'testnet';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'market' | 'limit';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type OrderStatus = 'accepted' | 'rejected' | 'filled' | 'partially_filled' | 'canceled';

export interface DydxMarket {
  symbol: string;
  status: 'ACTIVE' | 'PAUSED';
  oraclePrice: number;
  priceStep: number;
  sizeStep: number;
  minOrderSize: number;
}

export interface DydxCandle {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timeframe: Timeframe;
  symbol: string;
}

export interface WalletInfo {
  address: string;
  network: DydxNetwork;
  balances: Record<string, number>;
  connected: boolean;
  provider: 'phantom' | 'keplr';
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  price?: number;
  tif?: TimeInForce;
  clientId?: string;
}

export interface OrderResponse {
  id: string;
  status: OrderStatus;
  reason?: string;
}

export interface BacktestRequest {
  symbol: 'BTC-USD' | 'ETH-USD';
  timeframe: Timeframe;
  from: string; // ISO
  to: string; // ISO
  strategyId: string;
  params: Record<string, number | string | boolean>;
}

export interface BacktestResult {
  trades: Trade[];
  metrics: { totalPnl: number; winRate: number; maxDrawdown: number; sharpe?: number };
}
