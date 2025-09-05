/**
 * Strategy Data Structures - Task BE-008
 * 
 * Comprehensive data structures and type definitions for algorithmic trading strategies.
 * Extends the base strategy framework with detailed data models, performance tracking,
 * and integration interfaces for the complete trading system.
 */

import type { Strategy } from '../types/database.js';
import type { IndicatorResult } from '../indicators/base/types.js';

// =============================================================================
// CORE STRATEGY DATA STRUCTURES
// =============================================================================

/**
 * Enhanced strategy configuration with detailed parameters
 */
export interface StrategyConfiguration extends Omit<Strategy, 'id' | 'created_at' | 'updated_at'> {
  // Execution settings
  execution: {
    enabled: boolean;
    maxPositions: number;
    maxPositionSize: number;
    maxDailyTrades: number;
    cooldownPeriod: number; // minutes between trades
    timeframe: Timeframe;
    symbols: string[];
    exchanges: string[];
  };

  // Risk management
  riskManagement: {
    maxDrawdown: number; // percentage
    maxRisk: number; // percentage of portfolio per trade
    positionSizing: PositionSizingMethod;
    stopLoss: StopLossConfig;
    takeProfit: TakeProfitConfig;
    trailingStop: TrailingStopConfig;
  };

  // Technical indicators configuration
  indicators: IndicatorConfiguration[];

  // Signal generation settings
  signals: SignalConfiguration;

  // Performance tracking
  performance: PerformanceConfiguration;

  // Notifications and alerts
  notifications: NotificationConfiguration;
}

/**
 * Strategy execution context with comprehensive market data
 */
export interface StrategyExecutionContext {
  // Basic market information
  symbol: string;
  exchange: string;
  timestamp: Date;
  currentPrice: number;

  // Market data window
  marketData: MarketDataWindow;

  // Technical indicators
  indicators: IndicatorValues;

  // Current portfolio state
  portfolio: PortfolioState;

  // Open positions for this strategy
  positions: Position[];

  // Recent trade history
  tradeHistory: TradeHistoryEntry[];

  // Risk metrics
  riskMetrics: RiskMetrics;

  // Market conditions
  marketConditions: MarketConditions;
}

/**
 * Market data window with multiple timeframes
 */
export interface MarketDataWindow {
  primary: OHLCV[]; // Main timeframe data
  secondary?: OHLCV[]; // Higher timeframe for trend context
  intraday?: OHLCV[]; // Lower timeframe for entry timing
  
  // Volume profile data
  volumeProfile?: VolumeProfileData;
  
  // Level 2 data (when available)
  orderBook?: OrderBookData;
  
  // Recent trades
  recentTrades?: RecentTrade[];
}

/**
 * Technical indicator values with metadata
 */
export interface IndicatorValues {
  [indicatorName: string]: {
    value: number | number[] | IndicatorResult;
    timestamp: Date;
    period: number;
    isReady: boolean;
    confidence?: number; // 0-1 confidence in indicator value
    metadata?: Record<string, any>;
  };
}

/**
 * Portfolio state snapshot
 */
export interface PortfolioState {
  totalValue: number;
  cashBalance: number;
  marginUsed: number;
  marginAvailable: number;
  buyingPower: number;
  
  // Risk metrics
  leverage: number;
  portfolioHeat: number; // percentage of portfolio at risk
  correlationRisk: number;
  
  // Performance metrics
  dailyPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  
  // Position summary
  longPositions: number;
  shortPositions: number;
  totalPositions: number;
}

// =============================================================================
// TRADING SIGNALS AND DECISIONS
// =============================================================================

/**
 * Enhanced strategy signal with detailed analysis
 */
export interface StrategySignal {
  // Basic signal information
  type: SignalType;
  strength: number; // 0-1 signal strength
  confidence: number; // 0-1 confidence level
  timestamp: Date;
  
  // Trade recommendation
  action: TradeAction;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  
  // Position sizing
  recommendedSize: number;
  maxSize: number;
  riskAmount: number;
  
  // Price levels
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Signal analysis
  analysis: SignalAnalysis;
  
  // Supporting data
  indicators: Record<string, number | number[]>;
  marketConditions: MarketConditionSummary;
  
  // Risk assessment
  riskAssessment: RiskAssessment;
  
  // Metadata
  strategyId: string;
  version: string;
  processingTime: number; // milliseconds
}

/**
 * Detailed signal analysis
 */
export interface SignalAnalysis {
  // Trend analysis
  trend: {
    direction: 'up' | 'down' | 'sideways';
    strength: number; // 0-1
    consistency: number; // 0-1
    timeframe: string;
  };
  
  // Momentum analysis
  momentum: {
    speed: number;
    acceleration: number;
    divergence?: 'bullish' | 'bearish' | null;
  };
  
  // Support/resistance levels
  levels: {
    support: number[];
    resistance: number[];
    pivot: number;
  };
  
  // Volume analysis
  volume: {
    relative: number; // compared to average
    trend: 'increasing' | 'decreasing' | 'stable';
    confirmation: boolean;
  };
  
  // Pattern recognition
  patterns: {
    candlestick?: string[];
    chart?: string[];
    volume?: string[];
  };
  
  // Market structure
  structure: {
    phase: MarketPhase;
    volatility: VolatilityLevel;
    liquidity: LiquidityLevel;
  };
}

// =============================================================================
// PERFORMANCE TRACKING AND METRICS
// =============================================================================

/**
 * Comprehensive strategy performance metrics
 */
export interface StrategyPerformanceMetrics {
  // Basic performance
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Financial metrics
  totalReturn: number;
  totalReturnPercent: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  
  // Risk-adjusted metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  
  // Trade statistics
  averageHoldingPeriod: number; // hours
  averageTradesPerDay: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  
  // Timing metrics
  avgTimeToProfitability: number; // hours
  avgTimeToStopLoss: number; // hours
  
  // Market correlation
  correlation: {
    spy: number; // S&P 500 correlation
    btc: number; // Bitcoin correlation
    dxy: number; // US Dollar Index correlation
  };
  
  // Recent performance (last 30 days)
  recentPerformance: {
    returns: number[];
    dates: string[];
    rollingMetrics: RollingMetrics;
  };
  
  // Performance by time period
  monthlyReturns: MonthlyReturn[];
  
  // Trade distribution
  tradeDistribution: {
    bySize: Record<string, number>;
    byDuration: Record<string, number>;
    byTimeOfDay: Record<string, number>;
    byDayOfWeek: Record<string, number>;
  };
}

/**
 * Rolling performance metrics
 */
export interface RollingMetrics {
  period: number; // days
  returns: number[];
  volatility: number[];
  sharpe: number[];
  maxDrawdown: number[];
  winRate: number[];
}

/**
 * Monthly return data
 */
export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  returnPercent: number;
  trades: number;
  winRate: number;
}

// =============================================================================
// RISK MANAGEMENT DATA STRUCTURES
// =============================================================================

/**
 * Comprehensive risk assessment
 */
export interface RiskAssessment {
  // Overall risk score (0-100)
  riskScore: number;
  riskLevel: RiskLevel;
  
  // Position risk
  positionRisk: {
    size: number; // position size in base currency
    percentage: number; // percentage of portfolio
    leverage: number;
    marginRequirement: number;
  };
  
  // Price risk
  priceRisk: {
    volatility: number; // historical volatility
    var95: number; // Value at Risk 95%
    var99: number; // Value at Risk 99%
    expectedShortfall: number;
  };
  
  // Liquidity risk
  liquidityRisk: {
    bidAskSpread: number;
    marketDepth: number;
    averageDailyVolume: number;
    liquidityScore: number; // 0-1
  };
  
  // Correlation risk
  correlationRisk: {
    portfolioCorrelation: number;
    sectorConcentration: number;
    maxCorrelatedPosition: number;
  };
  
  // Time risk
  timeRisk: {
    holdingPeriodRisk: number;
    timeDecay?: number; // for options
    rolloverRisk?: number;
  };
  
  // Counterparty risk
  counterpartyRisk: {
    exchangeRisk: number;
    creditRisk: number;
    operationalRisk: number;
  };
}

/**
 * Risk management configuration
 */
export interface RiskConfiguration {
  // Position sizing
  maxPositionSize: number; // percentage of portfolio
  maxSingleTradeRisk: number; // percentage of portfolio
  maxDailyRisk: number; // percentage of portfolio
  
  // Drawdown limits
  maxDrawdown: number; // percentage
  dailyDrawdownLimit: number; // percentage
  
  // Leverage limits
  maxLeverage: number;
  marginCallLevel: number; // percentage
  
  // Correlation limits
  maxCorrelation: number; // between positions
  maxSectorExposure: number; // percentage per sector
  
  // Timing restrictions
  tradingHours: {
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
  
  // Stop-loss configuration
  stopLoss: {
    type: 'fixed' | 'trailing' | 'atr';
    value: number;
    maxLoss: number; // maximum loss per trade
  };
}

// =============================================================================
// MARKET CONDITIONS AND CONTEXT
// =============================================================================

/**
 * Market conditions analysis
 */
export interface MarketConditions {
  // Market phase classification
  phase: MarketPhase;
  phaseConfidence: number;
  
  // Volatility analysis
  volatility: {
    level: VolatilityLevel;
    percentile: number; // historical percentile
    regime: VolatilityRegime;
  };
  
  // Trend analysis
  trend: {
    direction: TrendDirection;
    strength: number; // 0-1
    duration: number; // days
    reliability: number; // 0-1
  };
  
  // Liquidity conditions
  liquidity: {
    level: LiquidityLevel;
    bidAskSpread: number;
    marketDepth: number;
    impact: number; // price impact per unit
  };
  
  // Sentiment indicators
  sentiment: {
    score: number; // -1 to 1
    fear: number; // 0-100
    greed: number; // 0-100
    uncertainty: number; // 0-100
  };
  
  // Economic indicators
  economic: {
    interestRates: number;
    inflation: number;
    gdpGrowth: number;
    unemploymentRate: number;
  };
}

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Technical indicator configuration
 */
export interface IndicatorConfiguration {
  name: string;
  type: IndicatorType;
  parameters: Record<string, number | string | boolean>;
  timeframe?: Timeframe;
  enabled: boolean;
  weight?: number; // for signal aggregation
}

/**
 * Signal generation configuration
 */
export interface SignalConfiguration {
  // Signal aggregation
  aggregation: {
    method: 'weighted' | 'majority' | 'unanimous';
    threshold: number; // minimum signal strength
    conflictResolution: 'strongest' | 'newest' | 'weighted';
  };
  
  // Signal filtering
  filters: {
    minimumConfidence: number;
    marketConditions: string[]; // allowed market conditions
    timeOfDay?: { start: string; end: string };
    volumeThreshold?: number;
  };
  
  // Signal validation
  validation: {
    confirmationCandles: number;
    maxAge: number; // seconds
    requireVolumeConfirmation: boolean;
  };
}

/**
 * Performance tracking configuration
 */
export interface PerformanceConfiguration {
  // Metrics to track
  metrics: string[];
  
  // Benchmarks
  benchmarks: string[]; // symbols to compare against
  
  // Reporting frequency
  reportingFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
  
  // Performance attribution
  attribution: {
    byStrategy: boolean;
    bySymbol: boolean;
    byTimeframe: boolean;
    byMarketCondition: boolean;
  };
}

/**
 * Notification configuration
 */
export interface NotificationConfiguration {
  // Channels
  channels: {
    email?: string;
    sms?: string;
    webhook?: string;
    discord?: string;
  };
  
  // Triggers
  triggers: {
    largeProfit: number; // percentage
    largeLoss: number; // percentage
    drawdownLimit: number; // percentage
    systemErrors: boolean;
    dailyReports: boolean;
  };
  
  // Frequency limits
  maxNotificationsPerHour: number;
  quietHours?: { start: string; end: string };
}

// =============================================================================
// SUPPORTING TYPE DEFINITIONS
// =============================================================================

export type SignalType = 'entry' | 'exit' | 'increase' | 'decrease' | 'hold' | 'emergency_exit';
export type TradeAction = 'buy' | 'sell' | 'hold' | 'close' | 'reduce' | 'increase';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '1w';

export type PositionSizingMethod = 'fixed' | 'percent_balance' | 'percent_volatility' | 'kelly' | 'optimal_f';

export type RiskLevel = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';
export type MarketPhase = 'accumulation' | 'markup' | 'distribution' | 'markdown' | 'consolidation';
export type VolatilityLevel = 'very_low' | 'low' | 'normal' | 'high' | 'very_high' | 'extreme';
export type VolatilityRegime = 'low_vol' | 'normal_vol' | 'high_vol' | 'crisis_vol';
export type LiquidityLevel = 'very_low' | 'low' | 'normal' | 'high' | 'very_high';
export type TrendDirection = 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down';

export type IndicatorType = 'trend' | 'momentum' | 'volatility' | 'volume' | 'support_resistance' | 'pattern';

// =============================================================================
// SUPPORTING INTERFACES
// =============================================================================

export interface OHLCV {
  timestamp: Date | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  marketValue: number;
  openedAt: Date;
  strategyId: string;
}

export interface TradeHistoryEntry {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  fees: number;
  openedAt: Date;
  closedAt?: Date;
  strategyId: string;
  signalId: string;
}

export interface RiskMetrics {
  portfolioValue: number;
  dailyVar95: number;
  maxDrawdown: number;
  sharpeRatio: number;
  beta: number;
  alpha: number;
  correlation: Record<string, number>;
}

export interface MarketConditionSummary {
  phase: MarketPhase;
  volatility: VolatilityLevel;
  trend: TrendDirection;
  sentiment: number;
}

export interface VolumeProfileData {
  levels: Array<{
    price: number;
    volume: number;
    percentage: number;
  }>;
  valueAreaHigh: number;
  valueAreaLow: number;
  pointOfControl: number;
}

export interface OrderBookData {
  bids: Array<[number, number]>; // [price, size]
  asks: Array<[number, number]>; // [price, size]
  timestamp: Date;
}

export interface RecentTrade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: Date;
}

export interface StopLossConfig {
  enabled: boolean;
  type: 'fixed' | 'trailing' | 'atr';
  value: number;
  maxLoss?: number;
}

export interface TakeProfitConfig {
  enabled: boolean;
  type: 'fixed' | 'trailing' | 'risk_reward';
  value: number;
  partialExit?: boolean;
}

export interface TrailingStopConfig {
  enabled: boolean;
  type: 'percent' | 'atr' | 'fixed';
  value: number;
  activation?: number;
}