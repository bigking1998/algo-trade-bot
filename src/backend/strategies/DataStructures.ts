/**
 * Strategy Data Structures - Task BE-008
 * 
 * Comprehensive data structures and type definitions for algorithmic trading strategies.
 * Extends the base strategy framework with detailed data models, performance tracking,
 * and integration interfaces for the complete trading system.
 */

import type { Strategy } from '../types/database.js';
import type { IndicatorResult } from '../indicators/base/types.js';
import type { StrategySignal, StrategySignalType } from './types.js';

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
 * Enhanced strategy signal analysis for data frames
 * Extends the base StrategySignal from types.ts with additional analysis
 */
export interface StrategySignalAnalysis extends Omit<StrategySignal, 'indicators'> {
  // Signal analysis
  analysis: SignalAnalysis;
  
  // Supporting data (extended indicators that can include arrays)
  indicators: Record<string, number | number[]>;
  marketConditions: MarketConditionSummary;
  
  // Risk assessment
  riskAssessment: RiskAssessment;
  
  // Additional metadata
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

// =============================================================================
// DATA FRAME CLASSES - Task BE-007: Base Strategy Interface Design
// =============================================================================

/**
 * MarketDataFrame - Efficient data structure for market data manipulation
 * Provides pandas-like functionality for OHLCV data with performance optimization
 */
export class MarketDataFrame {
  private data: OHLCV[];
  private _indexMap: Map<number, number> = new Map();
  private _dirty = true;

  constructor(data: OHLCV[] = []) {
    this.data = [...data].sort((a, b) => 
      (typeof a.timestamp === 'number' ? a.timestamp : (a.timestamp as Date).getTime()) - 
      (typeof b.timestamp === 'number' ? b.timestamp : (b.timestamp as Date).getTime())
    );
    this._buildIndex();
  }

  /**
   * Build timestamp index for fast lookups
   */
  private _buildIndex(): void {
    if (!this._dirty) return;
    
    this._indexMap.clear();
    this.data.forEach((candle, index) => {
      const timestamp = typeof candle.timestamp === 'number' ? candle.timestamp : (candle.timestamp as Date).getTime();
      this._indexMap.set(timestamp, index);
    });
    this._dirty = false;
  }

  /**
   * Get number of data points
   */
  get length(): number {
    return this.data.length;
  }

  /**
   * Check if frame is empty
   */
  get isEmpty(): boolean {
    return this.data.length === 0;
  }

  /**
   * Get latest candle
   */
  get latest(): OHLCV | null {
    return this.data.length > 0 ? this.data[this.data.length - 1] : null;
  }

  /**
   * Get oldest candle
   */
  get oldest(): OHLCV | null {
    return this.data.length > 0 ? this.data[0] : null;
  }

  /**
   * Add new candle data
   */
  addCandle(candle: OHLCV): void {
    const timestamp = typeof candle.timestamp === 'number' ? candle.timestamp : (candle.timestamp as Date).getTime();
    
    // Check if this timestamp already exists
    if (this._indexMap.has(timestamp)) {
      const index = this._indexMap.get(timestamp)!;
      this.data[index] = candle; // Update existing candle
    } else {
      this.data.push(candle);
      this._dirty = true;
      
      // Keep data sorted
      if (this.data.length > 1) {
        const lastCandle = this.data[this.data.length - 2];
        const lastTimestamp: number = typeof lastCandle.timestamp === 'number' 
          ? lastCandle.timestamp 
          : (lastCandle.timestamp as Date).getTime();
        
        if (timestamp < lastTimestamp) {
          this.data.sort((a, b) => 
            (typeof a.timestamp === 'number' ? a.timestamp : (a.timestamp as Date).getTime()) - 
            (typeof b.timestamp === 'number' ? b.timestamp : (b.timestamp as Date).getTime())
          );
          this._dirty = true;
        }
      }
    }
  }

  /**
   * Get candle at specific index
   */
  getCandle(index: number): OHLCV | null {
    return index >= 0 && index < this.data.length ? this.data[index] : null;
  }

  /**
   * Get slice of data
   */
  slice(start: number, end?: number): MarketDataFrame {
    const slicedData = this.data.slice(start, end);
    return new MarketDataFrame(slicedData);
  }

  /**
   * Get last n candles
   */
  tail(n: number): MarketDataFrame {
    const start = Math.max(0, this.data.length - n);
    return this.slice(start);
  }

  /**
   * Get first n candles
   */
  head(n: number): MarketDataFrame {
    return this.slice(0, n);
  }

  /**
   * Get closes as array
   */
  getCloses(): number[] {
    return this.data.map(candle => candle.close);
  }

  /**
   * Get opens as array
   */
  getOpens(): number[] {
    return this.data.map(candle => candle.open);
  }

  /**
   * Get highs as array
   */
  getHighs(): number[] {
    return this.data.map(candle => candle.high);
  }

  /**
   * Get lows as array
   */
  getLows(): number[] {
    return this.data.map(candle => candle.low);
  }

  /**
   * Get volumes as array
   */
  getVolumes(): number[] {
    return this.data.map(candle => candle.volume);
  }

  /**
   * Get timestamps as array
   */
  getTimestamps(): number[] {
    return this.data.map(candle => 
      typeof candle.timestamp === 'number' ? candle.timestamp : (candle.timestamp as Date).getTime()
    );
  }

  /**
   * Calculate typical price (HLC/3)
   */
  getTypicalPrices(): number[] {
    return this.data.map(candle => (candle.high + candle.low + candle.close) / 3);
  }

  /**
   * Calculate true range
   */
  getTrueRanges(): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 0; i < this.data.length; i++) {
      if (i === 0) {
        trueRanges.push(this.data[i].high - this.data[i].low);
      } else {
        const current = this.data[i];
        const previous = this.data[i - 1];
        const tr = Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        );
        trueRanges.push(tr);
      }
    }
    
    return trueRanges;
  }

  /**
   * Get all data as array
   */
  toArray(): OHLCV[] {
    return [...this.data];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data = [];
    this._indexMap.clear();
    this._dirty = false;
  }

  /**
   * Merge with another MarketDataFrame
   */
  merge(other: MarketDataFrame): MarketDataFrame {
    const combined = [...this.data, ...other.data];
    return new MarketDataFrame(combined);
  }
}

/**
 * IndicatorDataFrame - Efficient storage and manipulation of technical indicators
 * Provides vectorized operations and time-aligned indicator values
 */
export class IndicatorDataFrame {
  private indicators: Map<string, IndicatorSeries> = new Map();
  private timestamps: number[] = [];

  constructor() {}

  /**
   * Add indicator series
   */
  addIndicator(name: string, values: number[], timestamps?: number[]): void {
    if (timestamps && timestamps.length !== values.length) {
      throw new Error('Timestamps and values arrays must have same length');
    }

    const series: IndicatorSeries = {
      name,
      values: [...values],
      timestamps: timestamps ? [...timestamps] : [...this.timestamps],
      lastUpdated: new Date(),
      isReady: values.length > 0 && !values.some(v => isNaN(v))
    };

    this.indicators.set(name, series);
    
    // Update global timestamps if needed
    if (timestamps && timestamps.length > this.timestamps.length) {
      this.timestamps = [...timestamps];
    }
  }

  /**
   * Update indicator value at specific index
   */
  updateIndicator(name: string, index: number, value: number): void {
    const series = this.indicators.get(name);
    if (!series) {
      throw new Error(`Indicator ${name} not found`);
    }

    if (index >= 0 && index < series.values.length) {
      series.values[index] = value;
      series.lastUpdated = new Date();
      series.isReady = !series.values.some(v => isNaN(v));
    }
  }

  /**
   * Get indicator values
   */
  getIndicator(name: string): number[] | null {
    const series = this.indicators.get(name);
    return series ? [...series.values] : null;
  }

  /**
   * Get latest indicator value
   */
  getLatestValue(name: string): number | null {
    const series = this.indicators.get(name);
    if (!series || series.values.length === 0) return null;
    return series.values[series.values.length - 1];
  }

  /**
   * Get indicator value at specific index
   */
  getValue(name: string, index: number): number | null {
    const series = this.indicators.get(name);
    if (!series || index < 0 || index >= series.values.length) return null;
    return series.values[index];
  }

  /**
   * Check if indicator is ready (has valid values)
   */
  isReady(name: string): boolean {
    const series = this.indicators.get(name);
    return series ? series.isReady : false;
  }

  /**
   * Get all indicator names
   */
  getIndicatorNames(): string[] {
    return Array.from(this.indicators.keys());
  }

  /**
   * Get indicator metadata
   */
  getIndicatorInfo(name: string): IndicatorSeries | null {
    const series = this.indicators.get(name);
    return series ? { ...series, values: [...series.values] } : null;
  }

  /**
   * Remove indicator
   */
  removeIndicator(name: string): boolean {
    return this.indicators.delete(name);
  }

  /**
   * Clear all indicators
   */
  clear(): void {
    this.indicators.clear();
    this.timestamps = [];
  }

  /**
   * Get number of data points
   */
  get length(): number {
    return this.timestamps.length;
  }

  /**
   * Get all indicators as object
   */
  toObject(): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    this.indicators.forEach((series, name) => {
      result[name] = [...series.values];
    });
    return result;
  }

  /**
   * Slice indicators by index range
   */
  slice(start: number, end?: number): IndicatorDataFrame {
    const sliced = new IndicatorDataFrame();
    const slicedTimestamps = this.timestamps.slice(start, end);
    
    this.indicators.forEach((series, name) => {
      const slicedValues = series.values.slice(start, end);
      sliced.addIndicator(name, slicedValues, slicedTimestamps);
    });
    
    return sliced;
  }
}

/**
 * SignalDataFrame - Manages trading signals with time alignment and filtering
 * Provides efficient storage and retrieval of strategy signals
 */
export class SignalDataFrame {
  private signals: StrategySignal[] = [];
  private _indexMap: Map<string, number> = new Map(); // signal id -> index
  private _timeIndex: Map<number, number[]> = new Map(); // timestamp -> signal indices

  constructor(signals: StrategySignal[] = []) {
    this.signals = [...signals].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this._buildIndexes();
  }

  /**
   * Build internal indexes for fast lookups
   */
  private _buildIndexes(): void {
    this._indexMap.clear();
    this._timeIndex.clear();

    this.signals.forEach((signal, index) => {
      this._indexMap.set(signal.id, index);
      
      const timestamp = signal.timestamp.getTime();
      if (!this._timeIndex.has(timestamp)) {
        this._timeIndex.set(timestamp, []);
      }
      this._timeIndex.get(timestamp)!.push(index);
    });
  }

  /**
   * Add new signal
   */
  addSignal(signal: StrategySignal): void {
    // Check if signal already exists
    if (this._indexMap.has(signal.id)) {
      const index = this._indexMap.get(signal.id)!;
      this.signals[index] = signal; // Update existing signal
    } else {
      this.signals.push(signal);
      
      // Maintain chronological order
      this.signals.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      this._buildIndexes();
    }
  }

  /**
   * Get signal by ID
   */
  getSignal(id: string): StrategySignal | null {
    const index = this._indexMap.get(id);
    return index !== undefined ? this.signals[index] : null;
  }

  /**
   * Get signals by time range
   */
  getSignalsInRange(startTime: Date, endTime: Date): StrategySignal[] {
    const startTimestamp = startTime.getTime();
    const endTimestamp = endTime.getTime();
    
    return this.signals.filter(signal => {
      const timestamp = signal.timestamp.getTime();
      return timestamp >= startTimestamp && timestamp <= endTimestamp;
    });
  }

  /**
   * Get latest signal
   */
  getLatestSignal(): StrategySignal | null {
    return this.signals.length > 0 ? this.signals[this.signals.length - 1] : null;
  }

  /**
   * Get latest signal by type
   */
  getLatestSignalByType(type: StrategySignalType): StrategySignal | null {
    for (let i = this.signals.length - 1; i >= 0; i--) {
      if (this.signals[i].type === type) {
        return this.signals[i];
      }
    }
    return null;
  }

  /**
   * Get signals by symbol
   */
  getSignalsBySymbol(symbol: string): StrategySignal[] {
    return this.signals.filter(signal => signal.symbol === symbol);
  }

  /**
   * Get signals by strategy ID
   */
  getSignalsByStrategy(strategyId: string): StrategySignal[] {
    return this.signals.filter(signal => signal.strategyId === strategyId);
  }

  /**
   * Filter signals by conditions
   */
  filter(predicate: (signal: StrategySignal) => boolean): SignalDataFrame {
    const filtered = this.signals.filter(predicate);
    return new SignalDataFrame(filtered);
  }

  /**
   * Get signals with minimum confidence
   */
  getSignalsWithConfidence(minConfidence: number): StrategySignal[] {
    return this.signals.filter(signal => signal.confidence >= minConfidence);
  }

  /**
   * Get valid signals (not expired)
   */
  getValidSignals(currentTime: Date = new Date()): StrategySignal[] {
    return this.signals.filter(signal => {
      if (!signal.isValid) return false;
      if (signal.expiresAt && signal.expiresAt < currentTime) return false;
      return true;
    });
  }

  /**
   * Get last n signals
   */
  tail(n: number): SignalDataFrame {
    const start = Math.max(0, this.signals.length - n);
    const tailSignals = this.signals.slice(start);
    return new SignalDataFrame(tailSignals);
  }

  /**
   * Get first n signals
   */
  head(n: number): SignalDataFrame {
    const headSignals = this.signals.slice(0, n);
    return new SignalDataFrame(headSignals);
  }

  /**
   * Remove signal by ID
   */
  removeSignal(id: string): boolean {
    const index = this._indexMap.get(id);
    if (index === undefined) return false;

    this.signals.splice(index, 1);
    this._buildIndexes();
    return true;
  }

  /**
   * Clear all signals
   */
  clear(): void {
    this.signals = [];
    this._indexMap.clear();
    this._timeIndex.clear();
  }

  /**
   * Get number of signals
   */
  get length(): number {
    return this.signals.length;
  }

  /**
   * Check if frame is empty
   */
  get isEmpty(): boolean {
    return this.signals.length === 0;
  }

  /**
   * Get all signals as array
   */
  toArray(): StrategySignal[] {
    return [...this.signals];
  }

  /**
   * Get signal statistics
   */
  getStatistics(): SignalStatistics {
    const byType = new Map<StrategySignalType, number>();
    let totalConfidence = 0;
    let validSignals = 0;

    this.signals.forEach(signal => {
      byType.set(signal.type, (byType.get(signal.type) || 0) + 1);
      totalConfidence += signal.confidence;
      if (signal.isValid) validSignals++;
    });

    return {
      total: this.signals.length,
      validSignals,
      invalidSignals: this.signals.length - validSignals,
      averageConfidence: this.signals.length > 0 ? totalConfidence / this.signals.length : 0,
      byType: Object.fromEntries(byType),
      timeRange: this.signals.length > 0 ? {
        start: this.signals[0].timestamp,
        end: this.signals[this.signals.length - 1].timestamp
      } : null
    };
  }

  /**
   * Merge with another SignalDataFrame
   */
  merge(other: SignalDataFrame): SignalDataFrame {
    const combined = [...this.signals, ...other.signals];
    return new SignalDataFrame(combined);
  }
}

// =============================================================================
// SUPPORTING INTERFACES FOR DATA FRAMES
// =============================================================================

interface IndicatorSeries {
  name: string;
  values: number[];
  timestamps: number[];
  lastUpdated: Date;
  isReady: boolean;
}

interface SignalStatistics {
  total: number;
  validSignals: number;
  invalidSignals: number;
  averageConfidence: number;
  byType: Record<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  } | null;
}