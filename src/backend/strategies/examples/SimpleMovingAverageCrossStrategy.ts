/**
 * Simple Moving Average Cross Strategy - Example Implementation
 * 
 * Demonstrates the BaseStrategy framework with a classic technical analysis strategy.
 * Generates BUY signals when short MA crosses above long MA, and SELL signals when
 * short MA crosses below long MA.
 * 
 * This serves as both an example and a test of the BE-007 base strategy interface.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import type {
  StrategyConfig,
  StrategyContext,
  StrategySignal,
  StrategySignalType,
  StrategyParameter,
  Position,
  StrategyExecutionOptions,
  MarketDataWindow
} from '../types.js';
import type { DydxCandle } from '../../../shared/types/trading.js';

/**
 * Simple Moving Average Cross Strategy Configuration
 */
interface SMAConfig extends StrategyConfig {
  parameters: {
    shortPeriod: StrategyParameter;
    longPeriod: StrategyParameter;
    minVolume: StrategyParameter;
    confidenceThreshold: StrategyParameter;
    enableRiskManagement: StrategyParameter;
  };
}

/**
 * Strategy state to track crossover conditions
 */
interface SMAInternalState {
  lastShortMA?: number;
  lastLongMA?: number;
  lastCrossover?: 'golden' | 'death' | null;
  lastSignalTime?: Date;
}

export class SimpleMovingAverageCrossStrategy extends BaseStrategy {
  private internalState: SMAInternalState = {};
  private readonly shortPeriod: number;
  private readonly longPeriod: number;
  private readonly minVolume: number;
  private readonly confidenceThreshold: number;
  private readonly enableRiskManagement: boolean;

  constructor(config: SMAConfig) {
    super(config);
    
    // Extract strategy-specific parameters
    this.shortPeriod = Number(config.parameters.shortPeriod.value);
    this.longPeriod = Number(config.parameters.longPeriod.value);
    this.minVolume = Number(config.parameters.minVolume.value);
    this.confidenceThreshold = Number(config.parameters.confidenceThreshold.value);
    this.enableRiskManagement = Boolean(config.parameters.enableRiskManagement.value);

    // Validate parameters
    if (this.shortPeriod >= this.longPeriod) {
      throw new Error('Short period must be less than long period');
    }
  }

  /**
   * Initialize strategy resources
   */
  async initialize(): Promise<void> {
    this.internalState = {
      lastCrossover: null,
      lastSignalTime: undefined
    };

    // Log strategy initialization
    console.log(`[SimpleMovingAverageCrossStrategy] Initialized with parameters:`, {
      shortPeriod: this.shortPeriod,
      longPeriod: this.longPeriod,
      minVolume: this.minVolume,
      confidenceThreshold: this.confidenceThreshold,
      symbols: this.config.symbols,
      timeframes: this.config.timeframes
    });
  }

  /**
   * Main strategy execution
   */
  async execute(context: StrategyContext, options: StrategyExecutionOptions = {}): Promise<StrategySignal | null> {
    try {
      // Generate signal based on current market data
      const signal = await this.generateSignal(context);
      
      if (!signal) {
        return null;
      }

      // Validate signal before returning
      const isValid = await this.validateSignal(signal, context);
      if (!isValid) {
        return null;
      }

      // Check risk management if enabled
      if (this.enableRiskManagement) {
        const riskOk = await this.checkRiskManagement(signal, context);
        if (!riskOk) {
          console.log(`[SimpleMovingAverageCrossStrategy] Signal rejected by risk management`);
          return null;
        }
      }

      return signal;

    } catch (error) {
      console.error(`[SimpleMovingAverageCrossStrategy] Execution error:`, error);
      throw error;
    }
  }

  /**
   * Generate trading signal based on moving average crossover
   */
  async generateSignal(context: StrategyContext): Promise<StrategySignal | null> {
    const { marketData } = context;
    
    // Ensure we have enough data for the long moving average
    if (marketData.candles.length < this.longPeriod) {
      return null;
    }

    // Calculate moving averages
    const shortMA = this.calculateSimpleMA(marketData.candles, this.shortPeriod);
    const longMA = this.calculateSimpleMA(marketData.candles, this.longPeriod);

    if (shortMA === null || longMA === null) {
      return null;
    }

    // Determine crossover condition
    const currentCrossover = this.detectCrossover(shortMA, longMA);
    
    // Only generate signal if there's a new crossover
    if (currentCrossover === this.internalState.lastCrossover || currentCrossover === null) {
      // Update state for next iteration
      this.internalState.lastShortMA = shortMA;
      this.internalState.lastLongMA = longMA;
      return null;
    }

    // Check volume condition
    const currentVolume = marketData.candles[marketData.candles.length - 1].volume;
    if (currentVolume < this.minVolume) {
      return null;
    }

    // Prevent signals too close together (minimum 1 hour)
    if (this.internalState.lastSignalTime) {
      const timeSinceLastSignal = Date.now() - this.internalState.lastSignalTime.getTime();
      if (timeSinceLastSignal < 3600000) { // 1 hour in milliseconds
        return null;
      }
    }

    // Determine signal type
    const signalType: StrategySignalType = currentCrossover === 'golden' ? 'BUY' : 'SELL';
    
    // Calculate confidence based on various factors
    const confidence = this.calculateConfidence(marketData, shortMA, longMA, currentVolume);
    
    // Only generate signal if confidence meets threshold
    if (confidence < this.confidenceThreshold) {
      return null;
    }

    // Calculate price levels
    const currentPrice = marketData.currentPrice;
    const atr = this.calculateATR(marketData.candles, 14); // 14-period ATR
    const stopLoss = signalType === 'BUY' 
      ? currentPrice - (atr * 2) 
      : currentPrice + (atr * 2);
    const takeProfit = signalType === 'BUY'
      ? currentPrice + (atr * 3)
      : currentPrice - (atr * 3);

    // Update state
    this.internalState.lastShortMA = shortMA;
    this.internalState.lastLongMA = longMA;
    this.internalState.lastCrossover = currentCrossover;
    this.internalState.lastSignalTime = new Date();

    // Create signal
    const signal: StrategySignal = {
      id: `${this.strategyId}_${Date.now()}`,
      strategyId: this.strategyId,
      timestamp: new Date(),
      type: signalType,
      symbol: marketData.symbol,
      confidence,
      strength: this.calculateSignalStrength(shortMA, longMA, confidence),
      
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      maxRisk: this.config.riskProfile.maxRiskPerTrade,
      timeframe: marketData.timeframe,
      
      reasoning: `${currentCrossover === 'golden' ? 'Golden' : 'Death'} cross detected: ` +
                `Short MA (${this.shortPeriod}) = ${shortMA.toFixed(4)}, ` +
                `Long MA (${this.longPeriod}) = ${longMA.toFixed(4)}`,
      
      indicators: {
        shortMA,
        longMA,
        atr,
        volume: currentVolume,
        volumeRatio: currentVolume / (marketData.volume24h / 24)
      },
      
      conditions: [
        `${currentCrossover} crossover`,
        `Volume above ${this.minVolume}`,
        `Confidence above ${this.confidenceThreshold}%`
      ],
      
      source: 'technical',
      priority: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
      isValid: true
    };

    console.log(`[SimpleMovingAverageCrossStrategy] Generated ${signalType} signal with ${confidence.toFixed(1)}% confidence`);
    
    return signal;
  }

  /**
   * Validate signal before execution
   */
  async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    // Basic validation
    if (!signal || !signal.isValid) {
      return false;
    }

    // Check if we have the required price levels
    if (!signal.entryPrice || !signal.stopLoss) {
      return false;
    }

    // Validate stop loss distance (must be reasonable)
    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const priceRange = signal.entryPrice * 0.1; // 10% of price
    if (stopDistance > priceRange) {
      console.warn(`[SimpleMovingAverageCrossStrategy] Stop loss too far: ${stopDistance} > ${priceRange}`);
      return false;
    }

    // Check market conditions
    if (context.marketConditions.volatility === 'extreme') {
      console.log(`[SimpleMovingAverageCrossStrategy] Skipping signal due to extreme volatility`);
      return false;
    }

    return true;
  }

  /**
   * Calculate position size based on risk management
   */
  async calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number> {
    if (!signal.entryPrice || !signal.stopLoss) {
      return 0;
    }

    const portfolioValue = context.portfolio.total_value;
    const riskAmount = portfolioValue * (this.config.riskProfile.maxRiskPerTrade / 100);
    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    
    // Position size based on fixed risk amount
    const positionSize = riskAmount / stopDistance;
    
    // Apply maximum position size limits
    const maxPosition = portfolioValue * 0.2; // Maximum 20% of portfolio in single position
    const maxPositionSize = maxPosition / signal.entryPrice;
    
    return Math.min(positionSize, maxPositionSize);
  }

  /**
   * Determine if position should be exited
   */
  async shouldExitPosition(position: Position, context: StrategyContext): Promise<boolean> {
    const { marketData } = context;
    
    // Calculate current moving averages
    if (marketData.candles.length < this.longPeriod) {
      return false;
    }

    const shortMA = this.calculateSimpleMA(marketData.candles, this.shortPeriod);
    const longMA = this.calculateSimpleMA(marketData.candles, this.longPeriod);

    if (shortMA === null || longMA === null) {
      return false;
    }

    // Exit long position if short MA crosses below long MA
    if (position.side === 'long' && shortMA < longMA && this.internalState.lastShortMA && this.internalState.lastShortMA >= (this.internalState.lastLongMA || 0)) {
      return true;
    }

    // Exit short position if short MA crosses above long MA
    if (position.side === 'short' && shortMA > longMA && this.internalState.lastShortMA && this.internalState.lastShortMA <= (this.internalState.lastLongMA || 0)) {
      return true;
    }

    // Stop loss exit (handled by risk manager typically, but we can check here too)
    if (position.stopLoss) {
      const currentPrice = marketData.currentPrice;
      if (position.side === 'long' && currentPrice <= position.stopLoss) {
        return true;
      }
      if (position.side === 'short' && currentPrice >= position.stopLoss) {
        return true;
      }
    }

    return false;
  }

  /**
   * Cleanup strategy resources
   */
  async cleanup(): Promise<void> {
    this.internalState = {};
    console.log(`[SimpleMovingAverageCrossStrategy] Cleaned up strategy resources`);
  }

  /**
   * HELPER METHODS
   */

  /**
   * Calculate Simple Moving Average
   */
  private calculateSimpleMA(candles: DydxCandle[], period: number): number | null {
    if (candles.length < period) {
      return null;
    }

    const relevantCandles = candles.slice(-period);
    const sum = relevantCandles.reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
  }

  /**
   * Detect moving average crossover
   */
  private detectCrossover(shortMA: number, longMA: number): 'golden' | 'death' | null {
    if (!this.internalState.lastShortMA || !this.internalState.lastLongMA) {
      return null;
    }

    const wasShortAbove = this.internalState.lastShortMA > this.internalState.lastLongMA;
    const isShortAbove = shortMA > longMA;

    if (!wasShortAbove && isShortAbove) {
      return 'golden'; // Golden cross - bullish
    }

    if (wasShortAbove && !isShortAbove) {
      return 'death'; // Death cross - bearish
    }

    return null;
  }

  /**
   * Calculate signal confidence based on multiple factors
   */
  private calculateConfidence(marketData: MarketDataWindow, shortMA: number, longMA: number, volume: number): number {
    let confidence = 50; // Base confidence

    // Moving average spread factor (larger spread = higher confidence)
    const spread = Math.abs(shortMA - longMA) / longMA;
    confidence += Math.min(spread * 1000, 25); // Up to 25 points

    // Volume factor
    const avgVolume = marketData.volume24h / 24;
    const volumeRatio = volume / avgVolume;
    if (volumeRatio > 1.5) {
      confidence += 15; // High volume increases confidence
    } else if (volumeRatio < 0.5) {
      confidence -= 10; // Low volume decreases confidence
    }

    // Trend strength factor (based on recent price action)
    if (marketData.candles.length >= 5) {
      const recentCandles = marketData.candles.slice(-5);
      const trendScore = this.calculateTrendStrength(recentCandles);
      confidence += trendScore * 10; // Up to +/-20 points
    }

    // Market volatility factor
    const atr = this.calculateATR(marketData.candles, 14);
    const priceVolatility = atr / marketData.currentPrice;
    if (priceVolatility > 0.05) {
      confidence -= 10; // High volatility reduces confidence
    }

    // Cap confidence between 0 and 100
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Calculate signal strength (0-1 scale)
   */
  private calculateSignalStrength(shortMA: number, longMA: number, confidence: number): number {
    const spread = Math.abs(shortMA - longMA) / longMA;
    const spreadScore = Math.min(spread * 100, 1); // Normalize to 0-1
    const confidenceScore = confidence / 100;
    
    return (spreadScore + confidenceScore) / 2;
  }

  /**
   * Calculate trend strength (-2 to +2 scale)
   */
  private calculateTrendStrength(candles: DydxCandle[]): number {
    if (candles.length < 3) {
      return 0;
    }

    let upMoves = 0;
    let downMoves = 0;

    for (let i = 1; i < candles.length; i++) {
      if (candles[i].close > candles[i - 1].close) {
        upMoves++;
      } else if (candles[i].close < candles[i - 1].close) {
        downMoves++;
      }
    }

    const totalMoves = upMoves + downMoves;
    if (totalMoves === 0) return 0;

    const trendRatio = (upMoves - downMoves) / totalMoves;
    return trendRatio * 2; // Scale to -2 to +2
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private calculateATR(candles: DydxCandle[], period: number): number {
    if (candles.length < period + 1) {
      return 0;
    }

    const trueRanges = [];
    for (let i = 1; i < candles.length && trueRanges.length < period; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const highLow = current.high - current.low;
      const highClose = Math.abs(current.high - previous.close);
      const lowClose = Math.abs(current.low - previous.close);
      
      const trueRange = Math.max(highLow, highClose, lowClose);
      trueRanges.push(trueRange);
    }

    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }

  /**
   * Create default configuration for this strategy
   */
  public static createDefaultConfig(overrides: Partial<SMAConfig> = {}): SMAConfig {
    return {
      id: `sma_cross_${Date.now()}`,
      name: 'Simple Moving Average Cross',
      description: 'Generates signals based on short and long moving average crossovers',
      version: '1.0.0',
      type: 'technical',
      
      timeframes: ['1h', '4h'],
      symbols: ['BTC-USD'],
      maxConcurrentPositions: 1,
      
      riskProfile: {
        maxRiskPerTrade: 2, // 2% risk per trade
        maxPortfolioRisk: 10, // 10% total portfolio risk
        stopLossType: 'fixed',
        takeProfitType: 'fixed',
        positionSizing: 'fixed'
      },
      
      parameters: {
        shortPeriod: {
          name: 'Short MA Period',
          type: 'number',
          value: 20,
          defaultValue: 20,
          required: true,
          min: 5,
          max: 50,
          description: 'Period for short moving average',
          category: 'Technical'
        },
        longPeriod: {
          name: 'Long MA Period',
          type: 'number',
          value: 50,
          defaultValue: 50,
          required: true,
          min: 20,
          max: 200,
          description: 'Period for long moving average',
          category: 'Technical'
        },
        minVolume: {
          name: 'Minimum Volume',
          type: 'number',
          value: 1000,
          defaultValue: 1000,
          required: true,
          min: 0,
          description: 'Minimum volume required for signal generation',
          category: 'Filters'
        },
        confidenceThreshold: {
          name: 'Confidence Threshold',
          type: 'number',
          value: 60,
          defaultValue: 60,
          required: true,
          min: 0,
          max: 100,
          description: 'Minimum confidence level for signal execution (%)',
          category: 'Filters'
        },
        enableRiskManagement: {
          name: 'Enable Risk Management',
          type: 'boolean',
          value: true,
          defaultValue: true,
          required: false,
          description: 'Enable additional risk management checks',
          category: 'Risk'
        }
      },
      
      performance: {
        minWinRate: 40,
        maxDrawdown: 15,
        minSharpeRatio: 0.5
      },
      
      execution: {
        orderType: 'market',
        slippage: 0.1,
        timeout: 30,
        retries: 3
      },
      
      monitoring: {
        enableAlerts: true,
        alertChannels: ['webhook'],
        healthCheckInterval: 300, // 5 minutes
        performanceReviewInterval: 3600 // 1 hour
      },
      
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      
      ...overrides
    };
  }
}

export default SimpleMovingAverageCrossStrategy;