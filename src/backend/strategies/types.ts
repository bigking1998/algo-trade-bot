/**
 * Strategy Framework Types - Task BE-007: Base Strategy Interface Design
 * 
 * Comprehensive type definitions for the strategy execution framework,
 * including strategy configuration, context, signals, and performance metrics.
 */

import type { DydxCandle, Timeframe } from '../../shared/types/trading.js';
import type { Strategy, Trade, PortfolioSnapshot } from '../types/database.js';

/**
 * Strategy Signal Types
 */
export type StrategySignalType = 'BUY' | 'SELL' | 'HOLD' | 'CLOSE_LONG' | 'CLOSE_SHORT';

export interface StrategySignal {
  id: string;
  strategyId: string;
  timestamp: Date;
  type: StrategySignalType;
  symbol: string;
  confidence: number; // 0-100 confidence score
  strength: number; // Signal strength 0-1
  
  // Position sizing recommendations
  quantity?: number;
  percentage?: number; // Percentage of portfolio to allocate
  
  // Price levels
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

/**
 * Market Data Window for Strategy Context
 */
export interface MarketDataWindow {
  symbol: string;
  timeframe: Timeframe;
  candles: DydxCandle[];
  currentPrice: number;
  volume24h: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  
  // Extended market data
  orderBook?: {
    bids: Array<{ price: number; quantity: number; }>;
    asks: Array<{ price: number; quantity: number; }>;
    spread: number;
    depth: number;
  };
  
  // Market sentiment indicators
  sentiment?: {
    score: number; // -1 to 1 (bearish to bullish)
    volume: number;
    news?: string[];
    social?: Record<string, number>;
  };
  
  lastUpdate: Date;
}

/**
 * Technical Indicators Values
 */
export interface IndicatorValues {
  // Trend indicators
  sma?: Record<number, number>; // SMA by period (e.g., {20: 145.50, 50: 143.20})
  ema?: Record<number, number>; // EMA by period
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  
  // Momentum indicators
  rsi?: number; // 0-100
  stoch?: {
    k: number;
    d: number;
  };
  cci?: number; // Commodity Channel Index
  williams?: number; // Williams %R
  
  // Volatility indicators
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percent: number;
  };
  atr?: number; // Average True Range
  
  // Volume indicators
  obv?: number; // On Balance Volume
  volumeMA?: number;
  vwap?: number; // Volume Weighted Average Price
  
  // Support/Resistance
  pivotPoints?: {
    pivot: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
  };
  
  // Custom indicators
  custom?: Record<string, number>;
  
  lastCalculated: Date;
}

/**
 * Risk Assessment Context
 */
export interface RiskAssessment {
  // Portfolio risk metrics
  portfolioValue: number;
  availableCapital: number;
  usedMargin: number;
  marginRatio: number;
  
  // Position risk
  totalPositions: number;
  longPositions: number;
  shortPositions: number;
  largestPosition: number;
  concentrationRisk: number; // 0-1 scale
  
  // Strategy-specific risk
  strategyExposure: number;
  correlationRisk: number;
  drawdown: number;
  maxDrawdown: number;
  
  // Market risk
  marketVolatility: number;
  liquidityRisk: number;
  gapRisk: number;
  
  // Risk limits
  maxRiskPerTrade: number;
  maxPortfolioRisk: number;
  maxLeverage: number;
  
  riskScore: number; // Overall risk score 0-100
  lastAssessed: Date;
}

/**
 * Strategy Execution Context
 */
export interface StrategyContext {
  // Core market data
  marketData: MarketDataWindow;
  indicators: IndicatorValues;
  
  // Portfolio state
  portfolio: PortfolioSnapshot;
  riskMetrics: RiskAssessment;
  
  // Historical context
  recentSignals: StrategySignal[];
  recentTrades: Trade[];
  
  // Execution metadata
  timestamp: Date;
  executionId: string;
  strategyId: string;
  
  // Market conditions
  marketConditions: {
    trend: 'bull' | 'bear' | 'sideways';
    volatility: 'low' | 'medium' | 'high' | 'extreme';
    liquidity: 'low' | 'medium' | 'high';
    session: 'asian' | 'european' | 'american' | 'overlap';
  };
  
  // External factors
  fundamentals?: {
    economicEvents: Array<{
      event: string;
      impact: 'low' | 'medium' | 'high';
      forecast?: number;
      actual?: number;
      time: Date;
    }>;
    newsEvents: Array<{
      headline: string;
      sentiment: number; // -1 to 1
      relevance: number; // 0-1
      source: string;
      time: Date;
    }>;
  };
  
  // ML context (for ML-enhanced strategies)
  mlContext?: {
    modelPredictions: Record<string, number>;
    featureValues: Record<string, number>;
    confidence: number;
    modelVersion: string;
  };
}

/**
 * Strategy Configuration System
 */
export interface StrategyConfig {
  // Basic configuration
  id: string;
  name: string;
  description?: string;
  version: string;
  type: Strategy['type'];
  
  // Execution parameters
  timeframes: Timeframe[];
  symbols: string[];
  maxConcurrentPositions: number;
  
  // Risk management
  riskProfile: {
    maxRiskPerTrade: number; // Percentage
    maxPortfolioRisk: number; // Percentage
    stopLossType: 'fixed' | 'trailing' | 'atr' | 'indicator';
    takeProfitType: 'fixed' | 'trailing' | 'ratio' | 'indicator';
    positionSizing: 'fixed' | 'kelly' | 'volatility' | 'risk_parity';
  };
  
  // Strategy-specific parameters
  parameters: Record<string, StrategyParameter>;
  
  // Performance requirements
  performance: {
    minWinRate?: number; // Minimum acceptable win rate
    maxDrawdown?: number; // Maximum acceptable drawdown
    minSharpeRatio?: number; // Minimum Sharpe ratio
    benchmarkSymbol?: string; // Symbol to benchmark against
  };
  
  // Execution settings
  execution: {
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
    slippage: number; // Maximum acceptable slippage
    timeout: number; // Order timeout in seconds
    retries: number; // Number of retry attempts
  };
  
  // Monitoring and alerts
  monitoring: {
    enableAlerts: boolean;
    alertChannels: string[]; // ['email', 'webhook', 'sms']
    healthCheckInterval: number; // Seconds
    performanceReviewInterval: number; // Seconds
  };
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Strategy Parameter Definition
 */
export interface StrategyParameter {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'array' | 'object';
  value: unknown;
  defaultValue: unknown;
  
  // Validation
  required: boolean;
  min?: number;
  max?: number;
  options?: unknown[];
  pattern?: string; // Regex for string validation
  
  // Documentation
  description: string;
  tooltip?: string;
  category?: string; // For UI grouping
  
  // Constraints
  dependencies?: string[]; // Other parameters this depends on
  conditions?: Array<{
    parameter: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
    value: unknown;
  }>;
}

/**
 * Strategy Performance Metrics
 */
export interface StrategyMetrics {
  // Execution metrics
  executionCount: number;
  averageExecutionTime: number; // milliseconds
  lastExecutionTime: Date;
  successfulExecutions: number;
  failedExecutions: number;
  
  // Signal metrics
  signalsGenerated: number;
  signalsExecuted: number;
  signalAccuracy: number; // 0-1
  averageConfidence: number;
  
  // Trading metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 0-1
  
  // Financial metrics
  totalReturn: number;
  totalPnL: number;
  averageReturn: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  
  // Risk metrics
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number;
  
  // Time-based metrics
  averageHoldingPeriod: number; // hours
  maxHoldingPeriod: number;
  minHoldingPeriod: number;
  
  // Efficiency metrics
  tradingFrequency: number; // trades per day
  capitalEfficiency: number; // return per unit of capital used
  riskAdjustedReturn: number;
  
  // Recent performance (last 30 days)
  recentMetrics: {
    period: string;
    trades: number;
    winRate: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  
  // Benchmark comparison
  benchmark?: {
    symbol: string;
    correlation: number;
    alpha: number; // Excess return vs benchmark
    beta: number; // Sensitivity to benchmark
    trackingError: number;
  };
  
  lastUpdated: Date;
}

/**
 * Strategy Lifecycle Events
 */
export interface StrategyLifecycleEvent {
  strategyId: string;
  event: 'initialized' | 'started' | 'paused' | 'stopped' | 'error' | 'signal_generated' | 'trade_executed';
  timestamp: Date;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Strategy Error Types
 */
export class StrategyError extends Error {
  constructor(
    message: string,
    public strategyId: string,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StrategyError';
  }
}

export class StrategyValidationError extends StrategyError {
  constructor(
    message: string,
    strategyId: string,
    public parameter?: string
  ) {
    super(message, strategyId, 'VALIDATION_ERROR');
    this.name = 'StrategyValidationError';
  }
}

export class StrategyExecutionError extends StrategyError {
  constructor(
    message: string,
    strategyId: string,
    public originalError?: Error
  ) {
    super(message, strategyId, 'EXECUTION_ERROR');
    this.name = 'StrategyExecutionError';
  }
}

export class StrategyTimeoutError extends StrategyError {
  constructor(
    message: string,
    strategyId: string,
    public timeoutMs: number
  ) {
    super(message, strategyId, 'TIMEOUT_ERROR');
    this.name = 'StrategyTimeoutError';
  }
}

/**
 * Position Management Types
 */
export interface Position {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  
  // P&L
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  pnlPercent: number;
  
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  
  // Timing
  entryTime: Date;
  holdingPeriod: number; // milliseconds
  
  // Metadata
  metadata: Record<string, unknown>;
  status: 'open' | 'closing' | 'closed';
}

/**
 * Strategy Health Check Result
 */
export interface StrategyHealthCheck {
  strategyId: string;
  isHealthy: boolean;
  score: number; // 0-100 health score
  
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    value?: number;
    threshold?: number;
  }>;
  
  recommendations: string[];
  lastCheck: Date;
  nextCheck: Date;
}

/**
 * Strategy execution options
 */
export interface StrategyExecutionOptions {
  timeout?: number; // Execution timeout in milliseconds
  dryRun?: boolean; // Execute without placing actual trades
  validateOnly?: boolean; // Only validate signals without execution
  maxRetries?: number; // Maximum retry attempts on failure
}