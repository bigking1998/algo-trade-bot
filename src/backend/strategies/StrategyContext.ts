/**
 * Strategy Context Provider - Task BE-007: Base Strategy Interface Design
 * 
 * Provides comprehensive context for strategy execution including market data,
 * portfolio state, risk metrics, and external factors.
 */

import type {
  StrategyContext,
  MarketDataWindow,
  IndicatorValues,
  RiskAssessment,
  StrategySignal
} from './types.js';
import type { PortfolioSnapshot, Trade } from '../types/database.js';
import type { DydxCandle, Timeframe } from '../../shared/types/trading.js';

/**
 * Strategy Context Factory for creating execution contexts
 */
export class StrategyContextFactory {
  /**
   * Create a complete strategy context for execution
   */
  public static async createContext(
    strategyId: string,
    symbol: string,
    timeframe: Timeframe,
    marketData: DydxCandle[],
    portfolio: PortfolioSnapshot,
    recentSignals: StrategySignal[] = [],
    recentTrades: Trade[] = []
  ): Promise<StrategyContext> {
    // Build market data window
    const marketDataWindow = await this.buildMarketDataWindow(
      symbol,
      timeframe,
      marketData
    );

    // Calculate technical indicators
    const indicators = await this.calculateIndicators(marketData);

    // Assess risk metrics
    const riskMetrics = await this.assessRiskMetrics(portfolio, marketData);

    // Determine market conditions
    const marketConditions = this.analyzeMarketConditions(marketData);

    // Generate execution ID
    const executionId = `${strategyId}_${symbol}_${Date.now()}`;

    return {
      // Core market data
      marketData: marketDataWindow,
      indicators,
      
      // Portfolio state
      portfolio,
      riskMetrics,
      
      // Historical context
      recentSignals,
      recentTrades,
      
      // Execution metadata
      timestamp: new Date(),
      executionId,
      strategyId,
      
      // Market conditions
      marketConditions,
      
      // External factors (would be populated by external services)
      fundamentals: {
        economicEvents: [],
        newsEvents: []
      }
    };
  }

  /**
   * Build comprehensive market data window
   */
  private static async buildMarketDataWindow(
    symbol: string,
    timeframe: Timeframe,
    candles: DydxCandle[]
  ): Promise<MarketDataWindow> {
    if (candles.length === 0) {
      throw new Error('No market data available');
    }

    const latestCandle = candles[candles.length - 1];
    const firstCandle = candles[0];
    
    // Calculate 24h metrics
    const candles24h = this.getCandles24h(candles, timeframe);
    const volume24h = candles24h.reduce((sum, c) => sum + c.volume, 0);
    const prices24h = candles24h.map(c => c.close);
    const high24h = Math.max(...prices24h);
    const low24h = Math.min(...prices24h);
    const change24h = latestCandle.close - (candles24h[0]?.close || latestCandle.close);
    const change24hPercent = candles24h[0] 
      ? ((change24h / candles24h[0].close) * 100)
      : 0;

    return {
      symbol,
      timeframe,
      candles,
      currentPrice: latestCandle.close,
      volume24h,
      change24h,
      change24hPercent,
      high24h,
      low24h,
      lastUpdate: new Date()
    };
  }

  /**
   * Calculate comprehensive technical indicators
   */
  private static async calculateIndicators(candles: DydxCandle[]): Promise<IndicatorValues> {
    if (candles.length === 0) {
      return { lastCalculated: new Date() };
    }

    const indicators: IndicatorValues = {
      lastCalculated: new Date()
    };

    // Moving averages
    indicators.sma = {};
    indicators.ema = {};
    const periods = [10, 20, 50, 100, 200];
    
    for (const period of periods) {
      if (candles.length >= period) {
        indicators.sma[period] = this.calculateSMA(candles, period);
        indicators.ema[period] = this.calculateEMA(candles, period);
      }
    }

    // RSI
    if (candles.length >= 14) {
      indicators.rsi = this.calculateRSI(candles, 14);
    }

    // MACD
    if (candles.length >= 26) {
      indicators.macd = this.calculateMACD(candles);
    }

    // Bollinger Bands
    if (candles.length >= 20) {
      indicators.bollinger = this.calculateBollingerBands(candles, 20, 2);
    }

    // ATR
    if (candles.length >= 14) {
      indicators.atr = this.calculateATR(candles, 14);
    }

    // Volume indicators
    if (candles.length >= 20) {
      indicators.volumeMA = this.calculateVolumeMA(candles, 20);
      indicators.vwap = this.calculateVWAP(candles);
    }

    return indicators;
  }

  /**
   * Assess comprehensive risk metrics
   */
  private static async assessRiskMetrics(
    portfolio: PortfolioSnapshot,
    marketData: DydxCandle[]
  ): Promise<RiskAssessment> {
    // Calculate market volatility (30-day ATR as proxy)
    const atr30 = marketData.length >= 30 
      ? this.calculateATR(marketData.slice(-30), 30)
      : this.calculateATR(marketData, Math.min(14, marketData.length));
    
    const currentPrice = marketData[marketData.length - 1]?.close || 0;
    const marketVolatility = currentPrice > 0 ? atr30 / currentPrice : 0;

    // Extract positions data
    const positions = portfolio.positions as any;
    const totalPositions = Object.keys(positions || {}).length;
    
    return {
      // Portfolio risk metrics
      portfolioValue: portfolio.total_value,
      availableCapital: portfolio.cash_balance,
      usedMargin: Math.max(0, portfolio.total_value - portfolio.cash_balance - portfolio.positions_value),
      marginRatio: portfolio.total_value > 0 
        ? (portfolio.total_value - portfolio.cash_balance) / portfolio.total_value 
        : 0,
      
      // Position risk
      totalPositions,
      longPositions: 0, // Would need position analysis
      shortPositions: 0, // Would need position analysis
      largestPosition: portfolio.positions_value,
      concentrationRisk: totalPositions > 0 ? 1 / totalPositions : 0,
      
      // Strategy-specific risk
      strategyExposure: portfolio.positions_value / portfolio.total_value,
      correlationRisk: 0.5, // Simplified - would need correlation matrix
      drawdown: portfolio.drawdown || 0,
      maxDrawdown: portfolio.drawdown || 0,
      
      // Market risk
      marketVolatility,
      liquidityRisk: 0.1, // Simplified
      gapRisk: marketVolatility * 2, // Simplified as 2x volatility
      
      // Risk limits (defaults - would be configurable)
      maxRiskPerTrade: 2.0, // 2% max risk per trade
      maxPortfolioRisk: 20.0, // 20% max portfolio risk
      maxLeverage: 3.0, // 3x max leverage
      
      riskScore: Math.min(100, marketVolatility * 100 + (portfolio.drawdown || 0) * 50),
      lastAssessed: new Date()
    };
  }

  /**
   * Analyze current market conditions
   */
  private static analyzeMarketConditions(candles: DydxCandle[]) {
    if (candles.length < 20) {
      return {
        trend: 'sideways' as const,
        volatility: 'medium' as const,
        liquidity: 'medium' as const,
        session: this.getCurrentTradingSession()
      };
    }

    // Determine trend using 20-period SMA
    const sma20 = this.calculateSMA(candles, 20);
    const currentPrice = candles[candles.length - 1].close;
    const sma50 = candles.length >= 50 ? this.calculateSMA(candles, 50) : sma20;
    
    let trend: 'bull' | 'bear' | 'sideways' = 'sideways';
    if (currentPrice > sma20 && sma20 > sma50) {
      trend = 'bull';
    } else if (currentPrice < sma20 && sma20 < sma50) {
      trend = 'bear';
    }

    // Determine volatility using ATR
    const atr = this.calculateATR(candles, 14);
    const avgPrice = candles.slice(-14).reduce((sum, c) => sum + c.close, 0) / 14;
    const volatilityRatio = atr / avgPrice;
    
    let volatility: 'low' | 'medium' | 'high' | 'extreme' = 'medium';
    if (volatilityRatio < 0.01) {
      volatility = 'low';
    } else if (volatilityRatio < 0.03) {
      volatility = 'medium';
    } else if (volatilityRatio < 0.06) {
      volatility = 'high';
    } else {
      volatility = 'extreme';
    }

    // Determine liquidity using volume
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const currentVolume = candles[candles.length - 1].volume;
    const volumeRatio = currentVolume / avgVolume;
    
    let liquidity: 'low' | 'medium' | 'high' = 'medium';
    if (volumeRatio < 0.5) {
      liquidity = 'low';
    } else if (volumeRatio > 1.5) {
      liquidity = 'high';
    }

    return {
      trend,
      volatility,
      liquidity,
      session: this.getCurrentTradingSession()
    };
  }

  /**
   * Get current trading session based on UTC time
   */
  private static getCurrentTradingSession(): 'asian' | 'european' | 'american' | 'overlap' {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    // Trading session times (UTC)
    // Asian: 00:00 - 09:00 UTC
    // European: 07:00 - 16:00 UTC  
    // American: 13:00 - 22:00 UTC
    
    if (utcHour >= 7 && utcHour < 9) {
      return 'overlap'; // Asian-European overlap
    } else if (utcHour >= 13 && utcHour < 16) {
      return 'overlap'; // European-American overlap
    } else if (utcHour >= 0 && utcHour < 7) {
      return 'asian';
    } else if (utcHour >= 9 && utcHour < 13) {
      return 'european';
    } else {
      return 'american';
    }
  }

  /**
   * Get candles from last 24 hours based on timeframe
   */
  private static getCandles24h(candles: DydxCandle[], timeframe: Timeframe): DydxCandle[] {
    const timeframeMinutes = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    }[timeframe];
    
    const candlesIn24h = Math.ceil(1440 / timeframeMinutes); // 1440 minutes in a day
    return candles.slice(-candlesIn24h);
  }

  /**
   * Technical Indicator Calculations
   */
  
  private static calculateSMA(candles: DydxCandle[], period: number): number {
    const prices = candles.slice(-period).map(c => c.close);
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  private static calculateEMA(candles: DydxCandle[], period: number): number {
    const prices = candles.map(c => c.close);
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private static calculateRSI(candles: DydxCandle[], period = 14): number {
    const prices = candles.map(c => c.close);
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const difference = prices[i] - prices[i - 1];
      gains.push(difference > 0 ? difference : 0);
      losses.push(difference < 0 ? Math.abs(difference) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private static calculateMACD(candles: DydxCandle[]) {
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macd = ema12 - ema26;
    
    // For signal line, we'd need to calculate EMA of MACD values over time
    // Simplified here to use a 9-period approximation
    const signal = macd * 0.9; // Simplified
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  private static calculateBollingerBands(candles: DydxCandle[], period: number, stdDev: number) {
    const prices = candles.slice(-period).map(c => c.close);
    const sma = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    
    const upper = sma + (standardDeviation * stdDev);
    const lower = sma - (standardDeviation * stdDev);
    const bandwidth = ((upper - lower) / sma) * 100;
    const currentPrice = candles[candles.length - 1].close;
    const percent = ((currentPrice - lower) / (upper - lower)) * 100;
    
    return {
      upper,
      middle: sma,
      lower,
      bandwidth,
      percent
    };
  }

  private static calculateATR(candles: DydxCandle[], period: number): number {
    if (candles.length < 2) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const relevantTRs = trueRanges.slice(-period);
    return relevantTRs.reduce((sum, tr) => sum + tr, 0) / relevantTRs.length;
  }

  private static calculateVolumeMA(candles: DydxCandle[], period: number): number {
    const volumes = candles.slice(-period).map(c => c.volume);
    return volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
  }

  private static calculateVWAP(candles: DydxCandle[]): number {
    let totalVolumePrice = 0;
    let totalVolume = 0;
    
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      totalVolumePrice += typicalPrice * candle.volume;
      totalVolume += candle.volume;
    }
    
    return totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
  }
}

export default StrategyContextFactory;