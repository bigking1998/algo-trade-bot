/**
 * Backtesting Types and Interfaces - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Comprehensive type definitions for backtesting system including:
 * - Configuration interfaces for backtest setup
 * - Historical data structures for market simulation
 * - Portfolio simulation tracking
 * - Performance and risk metrics
 * - Event-driven architecture types
 */

import { Timeframe } from '../../shared/types/trading';
import { BaseStrategy } from '../strategies/BaseStrategy';

/**
 * Core backtesting configuration
 */
export interface BacktestConfig {
  id: string;
  name: string;
  description?: string;
  
  // Time period settings
  startDate: Date;
  endDate: Date;
  timeframe: Timeframe;
  
  // Market data settings
  symbols: string[];
  dataSource: 'dydx' | 'historical' | 'csv' | 'database';
  
  // Initial conditions
  initialCapital: number;
  currency: string;
  
  // Execution settings
  commission: number;          // Commission rate (e.g., 0.001 = 0.1%)
  slippage: number;           // Slippage rate (e.g., 0.001 = 0.1%)
  latency: number;            // Execution latency in milliseconds
  fillRatio: number;          // Order fill ratio (0-1, 1 = always fills)
  
  // Risk management
  maxPositionSize: number;    // Max position as % of portfolio
  maxDrawdown: number;        // Stop backtest if drawdown exceeds this %
  
  // Strategy settings
  strategyConfig: any;        // Strategy-specific configuration
  
  // Performance settings
  benchmark?: string;         // Benchmark symbol for comparison
  riskFreeRate?: number;      // Risk-free rate for Sharpe calculation
  
  // Validation settings
  warmupPeriod: number;       // Bars to warmup indicators before trading
  
  // Advanced features
  enableReinvestment: boolean;
  compoundReturns: boolean;
  includeWeekends: boolean;
  
  created: Date;
  updated: Date;
}

/**
 * Historical market data point
 */
export interface HistoricalDataPoint {
  timestamp: Date;
  symbol: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  
  // Additional market data
  trades?: number;            // Number of trades in period
  vwap?: number;             // Volume weighted average price
  
  // Technical indicators (computed)
  indicators?: Record<string, number>;
}

/**
 * Backtesting event types for event-driven simulation
 */
export type BacktestEventType = 
  | 'market_data'      // New market data bar
  | 'signal_generated' // Strategy generated signal
  | 'order_placed'     // Order placed by strategy
  | 'order_filled'     // Order execution completed
  | 'order_cancelled'  // Order cancelled
  | 'position_opened'  // New position opened
  | 'position_closed'  // Position closed
  | 'stop_loss_hit'    // Stop loss triggered
  | 'take_profit_hit'  // Take profit triggered
  | 'margin_call'      // Margin requirement violated
  | 'portfolio_update' // Portfolio value update
  | 'risk_breach'      // Risk limits breached
  | 'backtest_start'   // Backtest started
  | 'backtest_end'     // Backtest completed
  | 'error';           // Error occurred

/**
 * Base event interface
 */
export interface BacktestEvent {
  id: string;
  type: BacktestEventType;
  timestamp: Date;
  symbol?: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Specific event types
 */
export interface MarketDataEvent extends BacktestEvent {
  type: 'market_data';
  data: HistoricalDataPoint;
}

export interface SignalEvent extends BacktestEvent {
  type: 'signal_generated';
  data: {
    signal: 'buy' | 'sell' | 'hold';
    strength: number;        // Signal strength 0-1
    confidence: number;      // Signal confidence 0-1
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    positionSize?: number;
    metadata: Record<string, any>;
  };
}

export interface OrderEvent extends BacktestEvent {
  type: 'order_placed' | 'order_filled' | 'order_cancelled';
  data: {
    orderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
    timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
    fillPrice?: number;
    fillQuantity?: number;
    commission?: number;
    slippage?: number;
    reason?: string;         // For cancellations
  };
}

/**
 * Portfolio snapshot at a point in time
 */
export interface BacktestPortfolioSnapshot {
  timestamp: Date;
  
  // Cash positions
  cash: number;
  reservedCash: number;      // Cash reserved for pending orders
  availableCash: number;
  
  // Position values
  positionsValue: number;
  totalValue: number;        // Cash + positions
  
  // Performance metrics
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  totalReturn: number;       // Total return %
  dayReturn: number;         // Daily return %
  
  // Risk metrics
  exposure: number;          // Total exposure as % of portfolio
  leverage: number;          // Current leverage ratio
  usedMargin: number;
  availableMargin: number;
  
  // Position details
  positions: BacktestPosition[];
  
  // Drawdown tracking
  peakValue: number;
  drawdown: number;          // Current drawdown %
  maxDrawdown: number;       // Maximum drawdown %
  
  // Performance attribution
  dayPnL: Record<string, number>;  // P&L by symbol for the day
}

/**
 * Position tracking in backtest
 */
export interface BacktestPosition {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  entryTime: Date;
  
  // P&L tracking
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  costBasis: number;
  marketValue: number;
  
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  
  // Metadata
  strategyId: string;
  signalId: string;
  metadata?: Record<string, any>;
}

/**
 * Trade record for completed trades
 */
export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  
  // Entry details
  entryTime: Date;
  entryPrice: number;
  entryQuantity: number;
  entryCommission: number;
  entrySlippage: number;
  
  // Exit details
  exitTime: Date;
  exitPrice: number;
  exitQuantity: number;
  exitCommission: number;
  exitSlippage: number;
  
  // Performance
  grossPnL: number;
  netPnL: number;           // After commissions and slippage
  returnPercent: number;
  holdingPeriod: number;    // In milliseconds
  
  // Risk metrics
  maxUnrealizedGain: number;
  maxUnrealizedLoss: number;
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
  
  // Exit reason
  exitReason: 'signal' | 'stop_loss' | 'take_profit' | 'manual' | 'end_of_backtest';
  
  // Metadata
  strategyId: string;
  signalId: string;
  metadata?: Record<string, any>;
}

/**
 * Comprehensive backtest results
 */
export interface BacktestResults {
  // Backtest metadata
  backtestId: string;
  config: BacktestConfig;
  strategy: string;
  startTime: Date;
  endTime: Date;
  duration: number;         // Execution time in milliseconds
  
  // Summary statistics
  totalBars: number;
  tradingDays: number;
  
  // Portfolio performance
  initialValue: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  compoundAnnualGrowthRate: number;
  
  // Risk metrics
  volatility: number;           // Annualized volatility
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number;  // In days
  calmarRatio: number;
  
  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  informationRatio: number;
  treynorRatio: number;
  
  // Distribution metrics
  skewness: number;
  kurtosis: number;
  valueAtRisk95: number;       // 95% VaR
  conditionalValueAtRisk95: number; // 95% CVaR
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;            // % of winning trades
  profitFactor: number;       // Gross profit / gross loss
  
  // Trade performance
  averageWin: number;
  averageLoss: number;
  averageTrade: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingPeriod: number; // In hours
  
  // Advanced trade metrics
  expectancy: number;         // Expected value per trade
  systemQualityNumber: number; // SQN
  recoveryFactor: number;     // Net profit / max drawdown
  payoffRatio: number;        // Average win / average loss
  
  // Consistency metrics
  winningMonths: number;
  losingMonths: number;
  bestMonth: number;
  worstMonth: number;
  winningWeeks: number;
  losingWeeks: number;
  
  // Execution quality
  totalCommission: number;
  totalSlippage: number;
  averageSlippageBps: number;
  fillRate: number;           // % of orders filled
  
  // Benchmark comparison (if benchmark provided)
  benchmarkReturn?: number;
  benchmarkVolatility?: number;
  beta?: number;
  alpha?: number;
  trackingError?: number;
  
  // Detailed data
  equityCurve: Array<{
    timestamp: Date;
    equity: number;
    drawdown: number;
    dailyReturn: number;
  }>;
  
  trades: BacktestTrade[];
  portfolioSnapshots: BacktestPortfolioSnapshot[];
  
  // Performance by period
  monthlyReturns: Array<{
    period: string;
    return: number;
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
  }>;
  
  // Performance attribution
  performanceAttribution: Record<string, {
    totalReturn: number;
    trades: number;
    winRate: number;
    avgTrade: number;
  }>;
  
  // Robustness testing results
  monteCarloResults?: {
    runs: number;
    winningRuns: number;
    averageReturn: number;
    standardDeviation: number;
    confidenceInterval95: [number, number];
    worstCase: number;
    bestCase: number;
  };
  
  // Walk-forward analysis (if performed)
  walkForwardResults?: {
    periods: number;
    averageReturn: number;
    consistency: number;
    degradation: number;
  };
  
  // Error and warnings
  errors: Array<{
    timestamp: Date;
    level: 'error' | 'warning' | 'info';
    message: string;
    context?: any;
  }>;
}

/**
 * Backtest execution progress tracking
 */
export interface BacktestProgress {
  backtestId: string;
  status: 'queued' | 'initializing' | 'running' | 'completed' | 'error' | 'cancelled';
  
  // Progress tracking
  currentBar: number;
  totalBars: number;
  progressPercent: number;
  
  // Time estimates
  startTime: Date;
  estimatedCompletion?: Date;
  processingSpeed: number;    // Bars per second
  
  // Current state
  currentDate: Date;
  currentSymbol: string;
  currentValue: number;
  currentDrawdown: number;
  
  // Intermediate results
  tradesCompleted: number;
  signalsGenerated: number;
  ordersPlaced: number;
  ordersFilled: number;
  
  // Performance preview
  currentReturn: number;
  currentSharpe: number;
  winRate: number;
  
  // Resource usage
  memoryUsage: number;        // MB
  cpuUsage: number;          // %
  
  lastUpdate: Date;
}

/**
 * Configuration for backtesting optimization
 */
export interface BacktestOptimizationConfig {
  backtestConfig: Omit<BacktestConfig, 'strategyConfig'>;
  
  // Parameters to optimize
  parameters: Array<{
    name: string;
    type: 'number' | 'boolean' | 'string';
    min?: number;
    max?: number;
    step?: number;
    values?: any[];          // For discrete values
  }>;
  
  // Optimization settings
  objective: 'return' | 'sharpe' | 'sortino' | 'calmar' | 'profit_factor' | 'custom';
  customObjective?: string;   // JavaScript expression for custom objective
  
  // Constraints
  constraints: Array<{
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
  }>;
  
  // Optimization algorithm
  algorithm: 'grid' | 'random' | 'genetic' | 'bayesian';
  maxIterations: number;
  
  // Validation
  walkForwardPeriods?: number;
  outOfSamplePercent?: number;
  
  // Resource limits
  maxParallelRuns: number;
  timeoutMinutes: number;
}

/**
 * Backtesting engine configuration
 */
export interface BacktestEngineConfig {
  // Data management
  dataBufferSize: number;     // Number of bars to keep in memory
  preloadData: boolean;       // Load all data upfront vs streaming
  
  // Performance settings
  enableParallelProcessing: boolean;
  maxWorkerThreads: number;
  chunkSize: number;          // Bars to process in each chunk
  
  // Memory management
  enableGarbageCollection: boolean;
  gcThreshold: number;        // MB threshold for GC
  
  // Validation
  enableValidation: boolean;
  strictMode: boolean;        // Strict validation of data and orders
  
  // Logging and monitoring
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableProgressReporting: boolean;
  progressReportInterval: number; // Seconds
  
  // Error handling
  continueOnError: boolean;
  maxErrors: number;
  
  // Output settings
  saveIntermediateResults: boolean;
  compressionLevel: number;   // 0-9 for result compression
}

/**
 * Historical data provider interface
 */
export interface HistoricalDataProvider {
  /**
   * Get historical data for backtesting
   */
  getHistoricalData(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe,
    options?: {
      includeWeekends?: boolean;
      adjustForSplits?: boolean;
      adjustForDividends?: boolean;
    }
  ): Promise<HistoricalDataPoint[]>;

  /**
   * Get data range information
   */
  getDataRange(symbol: string, timeframe: Timeframe): Promise<{
    earliest: Date;
    latest: Date;
    totalBars: number;
    gaps: Array<{ start: Date; end: Date }>;
  }>;

  /**
   * Validate data availability
   */
  validateDataAvailability(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe
  ): Promise<{
    available: boolean;
    missingSymbols: string[];
    missingPeriods: Array<{ start: Date; end: Date }>;
    warnings: string[];
  }>;
}

