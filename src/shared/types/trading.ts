export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export interface DydxCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe?: Timeframe;
  symbol?: string;
}

export interface DydxMarket {
  symbol: string;
  price?: number; // Make optional since backend uses oraclePrice
  oraclePrice?: number; // Add backend field
  status?: string; // Add backend field
  priceStep?: number; // Add backend field
  sizeStep?: number; // Add backend field
  minOrderSize?: number; // Add backend field
  change24h?: number; // Make optional
  change24hPercent?: number; // Make optional
  volume24h?: number; // Make optional
  high24h?: number; // Make optional
  low24h?: number; // Make optional
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'STOP_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
}

export interface OrderResponse {
  orderId: string;
  status: string;
  executedQuantity: number;
  executedPrice: number;
}

export interface WalletInfo {
  address: string;
  balance: number;
  totalValue: number;
}

// Portfolio Management Types
export interface AssetBalance {
  asset: string;
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  usdValue: number;
  change24h: number;
  change24hPercent: number;
}

export interface AllocationItem {
  asset: string;
  percentage: number;
  value: number;
  color: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalAssets: number;
  change24h: number;
  change24hPercent: number;
  assetCount: number;
  largestHolding: string;
  allocation: AllocationItem[];
}

export interface PortfolioBalancesResponse {
  balances: AssetBalance[];
}

// Trading History Types
export interface TradeHistoryItem {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  strategy?: string;
  status: 'OPEN' | 'CLOSED' | 'PARTIALLY_FILLED';
  duration?: number; // in milliseconds
}

export interface TradeStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalVolume: number;
  avgTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  maxDrawdown: number;
}

export type TradeSide = 'BUY' | 'SELL';

export interface TradeFilters {
  dateFrom?: string;
  dateTo?: string;
  symbol?: string;
  strategy?: string;
  side?: TradeSide;
  profitLoss?: 'profit' | 'loss' | 'all';
  status?: 'open' | 'closed' | 'all';
}

// Active Orders Types
export interface ActiveOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'STOP_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: 'PENDING' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED';
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  createdAt: number;
  updatedAt: number;
  reduceOnly?: boolean;
}

export interface ActiveOrdersResponse {
  orders: ActiveOrder[];
  total: number;
}

// Trade History Entry for backend service
export interface TradeHistoryEntry {
  id: string;
  timestamp: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  fees: number;
  strategy?: string;
  duration?: number; // in milliseconds
  status: 'OPEN' | 'CLOSED';
  exitTimestamp?: string;
  notes?: string;
}

export interface TradeHistoryResponse {
  trades: TradeHistoryEntry[];
  statistics: TradeStatistics;
  total: number;
  page: number;
  pageSize: number;
}