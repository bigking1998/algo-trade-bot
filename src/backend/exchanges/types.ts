/**
 * Multi-Exchange Framework Types
 * 
 * Comprehensive type definitions for the multi-exchange trading system
 * supporting cross-exchange arbitrage, unified order management, and
 * real-time market data aggregation across multiple trading venues.
 */

import type { Order, OrderStatus, OrderType, OrderSide, TimeInForce } from '../execution/OrderExecutor.js';
import type { MarketDataPoint } from '../streaming/types.js';

/**
 * Supported Exchange Identifiers
 */
export type ExchangeId = 'dydx' | 'binance' | 'coinbase' | 'kraken' | 'ftx' | 'okx' | 'bybit';

/**
 * Exchange Connection Status
 */
export type ExchangeStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'rate_limited' | 'maintenance';

/**
 * Exchange Capabilities
 */
export interface ExchangeCapabilities {
  // Trading features
  spotTrading: boolean;
  marginTrading: boolean;
  futuresTrading: boolean;
  optionsTrading: boolean;
  
  // Order types
  marketOrders: boolean;
  limitOrders: boolean;
  stopOrders: boolean;
  stopLimitOrders: boolean;
  icebergOrders: boolean;
  postOnlyOrders: boolean;
  
  // Advanced features
  websocketStreams: boolean;
  restAPI: boolean;
  sandboxMode: boolean;
  testnetSupport: boolean;
  
  // Data feeds
  realtimeOrderBook: boolean;
  realtimeTrades: boolean;
  realtimeCandles: boolean;
  realtimeTickers: boolean;
  
  // Limitations
  maxOrderSize: number;
  minOrderSize: number;
  maxOrdersPerSecond: number;
  maxConcurrentOrders: number;
}

/**
 * Exchange Rate Limits
 */
export interface ExchangeRateLimits {
  // API endpoints
  restRequests: {
    limit: number;
    windowMs: number;
    weight?: number;
  };
  
  // WebSocket connections
  websocketConnections: {
    maxConnections: number;
    maxSubscriptions: number;
    reconnectDelayMs: number;
  };
  
  // Order placement
  orderPlacement: {
    limit: number;
    windowMs: number;
  };
  
  // Market data
  marketData: {
    limit: number;
    windowMs: number;
  };
}

/**
 * Exchange Configuration
 */
export interface ExchangeConfig {
  exchangeId: ExchangeId;
  name: string;
  enabled: boolean;
  
  // Connection settings
  apiUrl: string;
  websocketUrl: string;
  sandboxApiUrl?: string;
  sandboxWebsocketUrl?: string;
  
  // Authentication
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  subAccountId?: string;
  
  // Features
  capabilities: ExchangeCapabilities;
  rateLimits: ExchangeRateLimits;
  
  // Operational settings
  priority: number;          // Higher number = higher priority for routing
  healthCheckInterval: number;
  reconnectAttempts: number;
  reconnectDelayMs: number;
  
  // Trading settings
  defaultTradingPair: string;
  supportedAssets: string[];
  minimumBalance: Record<string, number>;
  
  // Risk management
  maxPositionSize: Record<string, number>;
  maxDailyVolume: Record<string, number>;
  enableRiskChecks: boolean;
}

/**
 * Unified Market Data
 */
export interface UnifiedMarketData {
  exchangeId: ExchangeId;
  symbol: string;
  timestamp: Date;
  
  // Price data
  price: number;
  bid: number;
  ask: number;
  spread: number;
  
  // Volume data
  volume24h: number;
  volumeQuote: number;
  
  // Additional metrics
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent24h: number;
  
  // Order book depth
  bidDepth: number;
  askDepth: number;
  
  // Metadata
  lastUpdate: Date;
  quality: 'realtime' | 'delayed' | 'cached';
}

/**
 * Unified Order Book Entry
 */
export interface OrderBookEntry {
  price: number;
  quantity: number;
  orders?: number;
}

/**
 * Unified Order Book
 */
export interface UnifiedOrderBook {
  exchangeId: ExchangeId;
  symbol: string;
  timestamp: Date;
  
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  
  // Aggregated metrics
  bidVolume: number;
  askVolume: number;
  spread: number;
  midPrice: number;
  
  // Quality metrics
  depth: number;
  quality: 'full' | 'partial' | 'stale';
  lastUpdate: Date;
}

/**
 * Exchange Order Interface
 */
export interface ExchangeOrder extends Order {
  exchangeId: ExchangeId;
  exchangeOrderId: string;
  originalClientOrderId?: string;
  
  // Exchange-specific fields
  exchangeSymbol: string;
  exchangeTimestamp?: Date;
  exchangeFees?: {
    amount: number;
    currency: string;
    rate: number;
  };
  
  // Execution details
  averagePrice?: number;
  commission?: number;
  commissionAsset?: string;
  
  // Additional metadata
  selfTradePreventionMode?: string;
  timeInForceOriginal?: TimeInForce;
}

/**
 * Exchange Balance
 */
export interface ExchangeBalance {
  exchangeId: ExchangeId;
  asset: string;
  free: number;          // Available balance
  locked: number;        // Balance in orders
  total: number;         // Total balance
  
  // USD equivalent (if available)
  usdValue?: number;
  
  // Additional metadata
  timestamp: Date;
  accountType: 'spot' | 'margin' | 'futures' | 'options';
}

/**
 * Exchange Trading Fees
 */
export interface ExchangeTradingFees {
  exchangeId: ExchangeId;
  symbol: string;
  
  // Maker/Taker fees
  makerFee: number;      // As decimal (0.001 = 0.1%)
  takerFee: number;      // As decimal (0.001 = 0.1%)
  
  // Tier-based fees
  volumeTier?: string;
  feeDiscount?: number;
  
  // Fee currency
  feeCurrency: string;
  
  // Additional costs
  withdrawalFee?: number;
  depositFee?: number;
  
  timestamp: Date;
}

/**
 * Exchange Health Status
 */
export interface ExchangeHealth {
  exchangeId: ExchangeId;
  status: ExchangeStatus;
  timestamp: Date;
  
  // Connection metrics
  latency: number;       // Average latency in ms
  uptime: number;        // Uptime percentage
  lastSuccessfulRequest: Date;
  lastFailedRequest?: Date;
  
  // API status
  restApiStatus: 'online' | 'offline' | 'degraded';
  websocketStatus: 'online' | 'offline' | 'degraded';
  
  // Error information
  lastError?: {
    message: string;
    code?: string;
    timestamp: Date;
  };
  
  // Rate limit status
  rateLimitUsage: {
    current: number;
    limit: number;
    resetTime: Date;
  };
  
  // Performance metrics
  requestsPerMinute: number;
  errorRate: number;
  successRate: number;
}

/**
 * Arbitrage Opportunity
 */
export interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  timestamp: Date;
  
  // Exchange details
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  
  // Price information
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  
  // Volume information
  maxVolume: number;     // Maximum profitable volume
  estimatedProfit: number;
  estimatedProfitPercent: number;
  
  // Execution requirements
  requiredCapital: number;
  minimumProfit: number;
  estimatedExecutionTime: number;
  
  // Risk factors
  riskScore: number;     // 0-100
  liquidityRisk: 'low' | 'medium' | 'high';
  executionRisk: 'low' | 'medium' | 'high';
  
  // Metadata
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  confidence: number;    // 0-1
  expiresAt: Date;
}

/**
 * Cross-Exchange Portfolio
 */
export interface CrossExchangePortfolio {
  timestamp: Date;
  totalValueUsd: number;
  
  // Exchange breakdown
  exchangeBalances: Map<ExchangeId, ExchangeBalance[]>;
  
  // Asset allocation
  assetAllocation: Map<string, {
    totalAmount: number;
    usdValue: number;
    exchanges: Map<ExchangeId, number>;
    allocation: number; // Percentage of total portfolio
  }>;
  
  // Performance metrics
  performance: {
    dailyPnL: number;
    dailyPnLPercent: number;
    weeklyPnL: number;
    monthlyPnL: number;
    totalReturn: number;
    maxDrawdown: number;
  };
  
  // Risk metrics
  riskMetrics: {
    concentrationRisk: number;
    exchangeRisk: number;
    liquidityRisk: number;
    overallRisk: 'low' | 'medium' | 'high';
  };
}

/**
 * Exchange Events
 */
export interface ExchangeEvent {
  id: string;
  exchangeId: ExchangeId;
  type: 'order_update' | 'balance_update' | 'connection_status' | 'rate_limit' | 'error' | 'maintenance';
  timestamp: Date;
  data: any;
  
  // Priority and routing
  priority: 'low' | 'normal' | 'high' | 'critical';
  requiresAction: boolean;
  
  // Correlation
  correlationId?: string;
  parentEventId?: string;
}

/**
 * Exchange Performance Metrics
 */
export interface ExchangePerformanceMetrics {
  exchangeId: ExchangeId;
  timestamp: Date;
  period: 'minute' | 'hour' | 'day' | 'week' | 'month';
  
  // Trading metrics
  totalTrades: number;
  totalVolume: number;
  averageTradeSize: number;
  successfulTrades: number;
  failedTrades: number;
  
  // Execution quality
  averageSlippage: number;
  averageExecutionTime: number;
  fillRate: number;
  
  // API performance
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  uptime: number;
  
  // Financial metrics
  totalFees: number;
  profitLoss: number;
  return: number;
  sharpeRatio: number;
  
  // Risk metrics
  maxDrawdown: number;
  var95: number;
  beta: number;
}

/**
 * Multi-Exchange Order Routing
 */
export interface OrderRoutingStrategy {
  type: 'best_price' | 'split_order' | 'iceberg' | 'smart_routing' | 'arbitrage';
  
  // Routing parameters
  exchanges: ExchangeId[];
  weights: Record<ExchangeId, number>;
  
  // Execution parameters
  maxSlippage: number;
  timeoutMs: number;
  retryAttempts: number;
  
  // Risk controls
  maxOrderSize: number;
  concentrationLimit: number;
  
  // Advanced options
  allowPartialFills: boolean;
  hiddenOrderSize?: number;
  timeWeightedExecution?: {
    duration: number;
    slices: number;
  };
}

/**
 * Exchange Connection Pool
 */
export interface ExchangeConnectionPool {
  totalConnections: number;
  activeConnections: number;
  availableConnections: number;
  
  connectionsByExchange: Map<ExchangeId, {
    active: number;
    available: number;
    maxConnections: number;
  }>;
  
  // Pool statistics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  
  // Health status
  healthStatus: 'healthy' | 'degraded' | 'critical';
  lastHealthCheck: Date;
}

export default {
  ExchangeId,
  ExchangeStatus,
  ExchangeCapabilities,
  ExchangeRateLimits,
  ExchangeConfig,
  UnifiedMarketData,
  UnifiedOrderBook,
  ExchangeOrder,
  ExchangeBalance,
  ExchangeTradingFees,
  ExchangeHealth,
  ArbitrageOpportunity,
  CrossExchangePortfolio,
  ExchangeEvent,
  ExchangePerformanceMetrics,
  OrderRoutingStrategy,
  ExchangeConnectionPool
};