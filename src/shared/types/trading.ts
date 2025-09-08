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

// Position Management Types (updated for BE-007 compatibility)
export interface Position {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number; // Alias for quantity
  quantity: number; // Legacy compatibility
  entryPrice: number;
  currentPrice: number;
  
  // P&L
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  totalPnL: number;
  pnlPercent: number;
  marketValue: number;
  
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  leverage?: number;
  margin?: number;
  liquidationPrice?: number;
  
  // Timing
  openedAt: Date; // Legacy compatibility
  entryTime: Date; // BE-007 standard
  lastUpdatedAt: Date;
  holdingPeriod: number; // milliseconds
  
  // Metadata
  metadata: Record<string, unknown>;
  status: 'open' | 'closing' | 'closed';
}

export interface PositionSummary {
  totalPositions: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  totalMarketValue: number;
  longPositions: number;
  shortPositions: number;
  largestPosition: string;
  riskExposure: number;
}

export interface OrderPlacementRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'STOP_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  strategyId?: string;
  positionId?: string;
}

export interface PositionSizeCalculation {
  symbol: string;
  riskAmount: number;
  riskPercent: number;
  entryPrice: number;
  stopLoss: number;
  recommendedQuantity: number;
  maxQuantity: number;
  positionValue: number;
  leverage: number;
  margin: number;
}

export interface RiskMetrics {
  portfolioHeat: number;
  maxRiskPerTrade: number;
  totalExposure: number;
  availableBalance: number;
  marginUtilization: number;
  riskRewardRatio: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

// Additional types needed by backend systems
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderSide = 'BUY' | 'SELL' | 'LONG' | 'SHORT';
export type OrderStatus = 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';

// OHLCV Data Structure
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
  timeframe?: Timeframe;
}

// Portfolio State
export interface PortfolioState {
  totalValue: number;
  availableBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
  orders: ActiveOrder[];
  lastUpdated: Date;
}

// Trade Data Structure  
export interface Trade {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  timestamp: Date;
  strategyId?: string;
  orderId?: string;
  fees?: number;
  commission?: number;
}

// Strategy Configuration
export interface StrategyConfiguration {
  id: string;
  name: string;
  type: StrategyType;
  parameters: Record<string, any>;
  riskConfig: RiskConfiguration;
  executionConfig: ExecutionConfiguration;
  monitoringConfig: MonitoringConfiguration;
}

export type StrategyType = 
  | 'MOMENTUM' 
  | 'MEAN_REVERSION' 
  | 'BREAKOUT' 
  | 'GRID_TRADING' 
  | 'DCA' 
  | 'ARBITRAGE'
  | 'CUSTOM';

// Risk Management Configuration
export interface RiskConfiguration {
  maxRiskPerTrade: number;
  maxPortfolioRisk: number;
  stopLossType: 'fixed' | 'trailing' | 'atr' | 'indicator';
  takeProfitType: 'fixed' | 'trailing' | 'indicator' | 'ratio';
  positionSizing: 'volatility' | 'fixed' | 'risk_parity';
}

// Execution Configuration
export interface ExecutionConfiguration {
  orderType: OrderType;
  slippage: number;
  timeout: number;
  retries: number;
}

// Monitoring Configuration
export interface MonitoringConfiguration {
  enableAlerts: boolean;
  alertChannels: string[];
  healthCheckInterval: number;
  performanceReviewInterval: number;
}

// Strategy Signal (updated for BE-007 compatibility)
export interface StrategySignal {
  id: string;
  strategyId: string;
  timestamp: Date;
  type: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  action: 'BUY' | 'SELL' | 'HOLD'; // Legacy compatibility field
  symbol: string;
  confidence: number; // 0-100 confidence score
  strength: number; // Signal strength 0-1
  
  // Position sizing recommendations
  quantity?: number;
  percentage?: number; // Percentage of portfolio to allocate
  
  // Price levels
  price: number; // Legacy field for compatibility
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Risk management
  maxRisk?: number; // Maximum risk percentage
  timeframe: Timeframe;
  
  // Signal context and reasoning
  reasoning?: string;
  indicators?: Record<string, number>; // Technical indicator values
  conditions?: string[]; // Conditions that triggered the signal
  
  // Metadata
  metadata?: Record<string, unknown>;
  source?: 'technical' | 'fundamental' | 'ml' | 'hybrid';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  
  // Expiry and validation
  expiresAt?: Date;
  isValid: boolean;
}

// Market Data Structure
export interface MarketData {
  symbol: string;
  price: number;
  timestamp: Date;
  volume?: number;
  high24h?: number;
  low24h?: number;
  change24h?: number;
  change24hPercent?: number;
}

// Strategy Configuration (simplified version)
export interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

// Backtesting Types
export interface BacktestResult {
  id: string;
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
  metrics: BacktestMetrics;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWinAmount: number;
  avgLossAmount: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  volatility: number;
  calmarRatio: number;
}