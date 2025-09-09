/**
 * EMA Crossover Strategy Template - Task BE-015: Strategy Templates Implementation
 * 
 * Professional dual EMA crossover strategy with:
 * - Fast EMA (12 period) and Slow EMA (26 period) crossover signals
 * - Trend confirmation using longer EMA (50 period)
 * - Volume confirmation for signal validation
 * - Dynamic risk management with ATR-based stops
 * - Multiple timeframe analysis support
 * - Signal strength scoring and confidence calculation
 */

import { BaseStrategy } from '../BaseStrategy.js';
import type {
  StrategyConfig,
  StrategyContext,
  StrategySignal,
  Position,
  StrategySignalType
} from '../types.js';
import type { OHLCV } from '../../indicators/base/types.js';
import { ExponentialMovingAverage } from '../../indicators/trend/ExponentialMovingAverage.js';
import { ATR } from '../../indicators/volatility/ATR.js';

/**
 * EMA Crossover Strategy configuration interface
 */
export interface EMACrossoverConfig extends StrategyConfig {
  /** Fast EMA period (default: 12) */
  fastEmaPeriod: number;
  /** Slow EMA period (default: 26) */
  slowEmaPeriod: number;
  /** Trend EMA period for trend confirmation (default: 50) */
  trendEmaPeriod: number;
  /** Minimum volume multiple for signal confirmation (default: 1.5) */
  minVolumeMultiple: number;
  /** ATR period for dynamic stops (default: 14) */
  atrPeriod: number;
  /** ATR multiplier for stop loss (default: 2.0) */
  atrStopMultiplier: number;
  /** ATR multiplier for take profit (default: 3.0) */
  atrTargetMultiplier: number;
  /** Enable trend confirmation filter */
  enableTrendConfirmation: boolean;
  /** Enable volume confirmation filter */
  enableVolumeConfirmation: boolean;
  /** Minimum signal strength threshold (0-100) */
  minSignalStrength: number;
}

/**
 * EMA Crossover Strategy Implementation
 * 
 * This strategy generates BUY signals when the fast EMA crosses above the slow EMA
 * and SELL signals when the fast EMA crosses below the slow EMA.
 * Additional filters include trend confirmation and volume validation.
 */
export class EMACrossoverStrategy extends BaseStrategy {
  private fastEma!: ExponentialMovingAverage;
  private slowEma!: ExponentialMovingAverage;
  private trendEma!: ExponentialMovingAverage;
  private atr!: ATR;
  
  // Strategy state tracking
  private lastFastEma?: number;
  private lastSlowEma?: number;
  private lastCrossoverDirection: 'bullish' | 'bearish' | null = null;
  private volumeHistory: number[] = [];
  
  constructor(config: EMACrossoverConfig) {
    // Ensure required parameters are set with defaults
    const emaCrossoverConfig: EMACrossoverConfig = {
      fastEmaPeriod: 12,
      slowEmaPeriod: 26,
      trendEmaPeriod: 50,
      minVolumeMultiple: 1.5,
      atrPeriod: 14,
      atrStopMultiplier: 2.0,
      atrTargetMultiplier: 3.0,
      enableTrendConfirmation: true,
      enableVolumeConfirmation: true,
      minSignalStrength: 60,
      ...config
    };

    super(emaCrossoverConfig);
  }

  /**
   * Initialize strategy indicators and validation
   */
  async initialize(): Promise<void> {
    const config = this.config as EMACrossoverConfig;
    
    // Validate configuration
    this.validateConfiguration(config);
    
    // Initialize EMAs
    this.fastEma = new ExponentialMovingAverage({
      period: config.fastEmaPeriod,
      priceType: 'close'
    });
    
    this.slowEma = new ExponentialMovingAverage({
      period: config.slowEmaPeriod,
      priceType: 'close'
    });
    
    this.trendEma = new ExponentialMovingAverage({
      period: config.trendEmaPeriod,
      priceType: 'close'
    });
    
    // Initialize ATR for dynamic risk management
    this.atr = new ATR({
      period: config.atrPeriod
    });
    
    this.emit('initialized', {
      strategy: 'EMA Crossover',
      fastPeriod: config.fastEmaPeriod,
      slowPeriod: config.slowEmaPeriod,
      trendPeriod: config.trendEmaPeriod
    });
  }

  /**
   * Main strategy execution logic
   */
  async execute(context: StrategyContext): Promise<StrategySignal | null> {
    try {
      // Update indicators with latest market data
      await this.updateIndicators(context.marketData.candles);
      
      // Generate signal based on EMA crossover
      const signal = await this.generateSignal(context);
      
      // Validate and enhance signal if generated
      if (signal) {
        const isValid = await this.validateSignal(signal, context);
        if (!isValid) {
          return null;
        }
        
        // Calculate position size and set risk levels
        const positionSize = await this.calculatePositionSize(signal, context);
        signal.metadata = {
          ...signal.metadata,
          positionSize,
          fastEma: this.lastFastEma,
          slowEma: this.lastSlowEma,
          atrValue: this.atr.getLatestResult()?.value,
          volumeMultiple: this.calculateVolumeMultiple(context)
        };
      }
      
      return signal;
      
    } catch (error) {
      this.emit('error', new Error(
        `EMA Crossover execution failed: ${error instanceof Error ? error.message : String(error)}`
      ));
      return null;
    }
  }

  /**
   * Cleanup strategy resources
   */
  async cleanup(): Promise<void> {
    // Reset indicators
    this.fastEma.reset();
    this.slowEma.reset();
    this.trendEma.reset();
    this.atr.reset();
    
    // Clear state
    this.lastFastEma = undefined;
    this.lastSlowEma = undefined;
    this.lastCrossoverDirection = null;
    this.volumeHistory = [];
    
    this.emit('cleanup', { strategy: 'EMA Crossover' });
  }

  /**
   * Generate trading signal based on EMA crossover analysis
   */
  async generateSignal(context: StrategyContext): Promise<StrategySignal | null> {
    const config = this.config as EMACrossoverConfig;
    
    // Get latest indicator values
    const fastEmaResult = this.fastEma.getLatestResult();
    const slowEmaResult = this.slowEma.getLatestResult();
    const trendEmaResult = this.trendEma.getLatestResult();
    const atrResult = this.atr.getLatestResult();
    
    // Ensure all indicators are ready
    if (!fastEmaResult?.isValid || !slowEmaResult?.isValid || !atrResult?.isValid) {
      return null;
    }
    
    const fastEma = fastEmaResult.value as number;
    const slowEma = slowEmaResult.value as number;
    const trendEma = trendEmaResult?.value as number;
    const atrValue = atrResult.value as number;
    const currentPrice = context.marketData.currentPrice;
    
    // Detect crossover
    const crossoverSignal = this.detectCrossover(fastEma, slowEma);
    if (!crossoverSignal) {
      return null;
    }
    
    // Apply trend confirmation filter
    if (config.enableTrendConfirmation && trendEmaResult?.isValid) {
      if (!this.confirmTrend(crossoverSignal, currentPrice, trendEma)) {
        return null;
      }
    }
    
    // Apply volume confirmation filter
    if (config.enableVolumeConfirmation) {
      if (!this.confirmVolume(context)) {
        return null;
      }
    }
    
    // Calculate signal strength and confidence
    const signalStrength = this.calculateSignalStrength(
      fastEma, slowEma, currentPrice, trendEma, context
    );
    
    if (signalStrength < config.minSignalStrength) {
      return null;
    }
    
    // Create trading signal
    const signal: StrategySignal = {
      id: `ema_crossover_${this.strategyId}_${Date.now()}`,
      strategyId: this.strategyId,
      timestamp: new Date(),
      type: crossoverSignal,
      symbol: context.marketData.symbol,
      confidence: this.calculateConfidence(signalStrength, context),
      strength: signalStrength,
      timeframe: context.marketData.timeframe,
      
      // Price levels
      entryPrice: currentPrice,
      stopLoss: this.calculateStopLoss(crossoverSignal, currentPrice, atrValue),
      takeProfit: this.calculateTakeProfit(crossoverSignal, currentPrice, atrValue),
      
      // Risk management
      maxRisk: config.riskProfile.maxRiskPerTrade,
      
      // Signal details
      reasoning: this.generateReasoning(crossoverSignal, fastEma, slowEma, signalStrength),
      indicators: {
        fastEma,
        slowEma,
        trendEma,
        atr: atrValue,
        volume: context.marketData.volume24h
      },
      conditions: ['ema_crossover'],
      source: 'technical',
      priority: this.determinePriority(signalStrength),
      isValid: true,
      
      metadata: {
        crossoverType: crossoverSignal === 'BUY' ? 'golden_cross' : 'death_cross',
        signalStrength,
        trendConfirmed: config.enableTrendConfirmation ? 
          this.confirmTrend(crossoverSignal, currentPrice, trendEma) : true,
        volumeConfirmed: config.enableVolumeConfirmation ? 
          this.confirmVolume(context) : true
      }
    };
    
    return signal;
  }

  /**
   * Validate generated signal against strategy rules
   */
  async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    const config = this.config as EMACrossoverConfig;
    
    // Check minimum confidence
    if (signal.confidence < config.validation?.minConfidence || 60) {
      return false;
    }
    
    // Check if we're not already in a position in the same direction
    const existingPosition = this.currentPositions.get(signal.symbol);
    if (existingPosition) {
      if (
        (signal.type === 'BUY' && existingPosition.side === 'LONG') ||
        (signal.type === 'SELL' && existingPosition.side === 'SHORT')
      ) {
        return false; // Already in position
      }
    }
    
    // Risk management validation
    if (!await this.checkRiskManagement(signal, context)) {
      return false;
    }
    
    // Check for recent opposite signals (whipsaw protection)
    if (this.hasRecentOppositeSignal(signal)) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate optimal position size based on risk parameters
   */
  async calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number> {
    const config = this.config as EMACrossoverConfig;
    const riskPerTrade = config.riskProfile.maxRiskPerTrade / 100;
    const accountBalance = context.portfolio.total_value;
    
    // Calculate position size based on stop loss distance
    const stopDistance = Math.abs(signal.entryPrice! - signal.stopLoss!);
    const riskAmount = accountBalance * riskPerTrade;
    
    // Position size = Risk Amount / Risk per Unit
    const positionSize = riskAmount / stopDistance;
    
    // Apply position size limits
    const minSize = config.execution.minPositionSize || 0.01;
    const maxSize = Math.min(
      accountBalance * 0.1, // Max 10% of account per trade
      config.execution.maxPositionSize || accountBalance * 0.05
    );
    
    return Math.max(minSize, Math.min(maxSize, positionSize));
  }

  /**
   * Determine if existing position should be exited
   */
  async shouldExitPosition(position: Position, context: StrategyContext): Promise<boolean> {
    // Update indicators with latest data
    await this.updateIndicators(context.marketData.candles);
    
    const fastEmaResult = this.fastEma.getLatestResult();
    const slowEmaResult = this.slowEma.getLatestResult();
    
    if (!fastEmaResult?.isValid || !slowEmaResult?.isValid) {
      return false;
    }
    
    const fastEma = fastEmaResult.value as number;
    const slowEma = slowEmaResult.value as number;
    
    // Exit if EMAs cross in opposite direction
    const crossoverSignal = this.detectCrossover(fastEma, slowEma);
    
    if (crossoverSignal) {
      if (
        (position.side === 'LONG' && crossoverSignal === 'SELL') ||
        (position.side === 'SHORT' && crossoverSignal === 'BUY')
      ) {
        return true;
      }
    }
    
    // Exit if stop loss or take profit is hit
    const currentPrice = context.marketData.currentPrice;
    
    if (position.side === 'LONG') {
      if (currentPrice <= (position.stopLoss || 0) || currentPrice >= (position.takeProfit || Infinity)) {
        return true;
      }
    } else {
      if (currentPrice >= (position.stopLoss || Infinity) || currentPrice <= (position.takeProfit || 0)) {
        return true;
      }
    }
    
    return false;
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Validate strategy configuration
   */
  private validateConfiguration(config: EMACrossoverConfig): void {
    if (config.fastEmaPeriod >= config.slowEmaPeriod) {
      throw new Error('Fast EMA period must be less than slow EMA period');
    }
    
    if (config.slowEmaPeriod >= config.trendEmaPeriod) {
      throw new Error('Slow EMA period must be less than trend EMA period');
    }
    
    if (config.minVolumeMultiple < 1) {
      throw new Error('Minimum volume multiple must be >= 1');
    }
    
    if (config.atrStopMultiplier <= 0 || config.atrTargetMultiplier <= 0) {
      throw new Error('ATR multipliers must be positive');
    }
  }

  /**
   * Update all indicators with latest market data
   */
  private async updateIndicators(candles: OHLCV[]): Promise<void> {
    if (candles.length === 0) return;
    
    // Convert candle format if needed
    const ohlcvData: OHLCV[] = candles.map(candle => ({
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.baseTokenVolume),
      timestamp: new Date(candle.startedAt).getTime()
    }));
    
    // Update EMAs
    this.fastEma.update(ohlcvData);
    this.slowEma.update(ohlcvData);
    this.trendEma.update(ohlcvData);
    
    // Update ATR
    this.atr.update(ohlcvData);
    
    // Store latest EMA values for crossover detection
    const fastResult = this.fastEma.getLatestResult();
    const slowResult = this.slowEma.getLatestResult();
    
    if (fastResult?.isValid && slowResult?.isValid) {
      this.lastFastEma = fastResult.value as number;
      this.lastSlowEma = slowResult.value as number;
    }
    
    // Update volume history
    if (ohlcvData.length > 0) {
      this.volumeHistory.push(ohlcvData[ohlcvData.length - 1].volume);
      if (this.volumeHistory.length > 20) {
        this.volumeHistory.shift();
      }
    }
  }

  /**
   * Detect EMA crossover signals
   */
  private detectCrossover(currentFast: number, currentSlow: number): StrategySignalType | null {
    if (!this.lastFastEma || !this.lastSlowEma) {
      // Store current values for next iteration
      this.lastFastEma = currentFast;
      this.lastSlowEma = currentSlow;
      return null;
    }
    
    const previousFastAboveSlow = this.lastFastEma > this.lastSlowEma;
    const currentFastAboveSlow = currentFast > currentSlow;
    
    let crossoverSignal: StrategySignalType | null = null;
    
    // Bullish crossover: Fast EMA crosses above Slow EMA
    if (!previousFastAboveSlow && currentFastAboveSlow) {
      crossoverSignal = 'BUY';
      this.lastCrossoverDirection = 'bullish';
    }
    // Bearish crossover: Fast EMA crosses below Slow EMA
    else if (previousFastAboveSlow && !currentFastAboveSlow) {
      crossoverSignal = 'SELL';
      this.lastCrossoverDirection = 'bearish';
    }
    
    // Update stored values
    this.lastFastEma = currentFast;
    this.lastSlowEma = currentSlow;
    
    return crossoverSignal;
  }

  /**
   * Confirm trend direction using longer-term EMA
   */
  private confirmTrend(signal: StrategySignalType, currentPrice: number, trendEma: number): boolean {
    if (signal === 'BUY') {
      return currentPrice > trendEma; // Price above trend EMA for bullish signal
    } else {
      return currentPrice < trendEma; // Price below trend EMA for bearish signal
    }
  }

  /**
   * Confirm signal with volume analysis
   */
  private confirmVolume(context: StrategyContext): boolean {
    const config = this.config as EMACrossoverConfig;
    const currentVolume = context.marketData.volume24h;
    
    if (this.volumeHistory.length < 10) {
      return true; // Not enough data, assume valid
    }
    
    const averageVolume = this.volumeHistory.reduce((sum, vol) => sum + vol, 0) / this.volumeHistory.length;
    const volumeMultiple = currentVolume / averageVolume;
    
    return volumeMultiple >= config.minVolumeMultiple;
  }

  /**
   * Calculate signal strength based on multiple factors
   */
  private calculateSignalStrength(
    fastEma: number,
    slowEma: number,
    currentPrice: number,
    trendEma: number,
    context: StrategyContext
  ): number {
    let strength = 50; // Base strength
    
    // EMA separation strength (wider separation = stronger signal)
    const emaSeparation = Math.abs(fastEma - slowEma) / slowEma;
    strength += Math.min(20, emaSeparation * 1000); // Up to 20 points
    
    // Trend confirmation strength
    if (trendEma) {
      const trendAlignment = Math.abs(currentPrice - trendEma) / trendEma;
      strength += Math.min(15, trendAlignment * 500); // Up to 15 points
    }
    
    // Volume confirmation strength
    const volumeMultiple = this.calculateVolumeMultiple(context);
    if (volumeMultiple > 1) {
      strength += Math.min(10, (volumeMultiple - 1) * 20); // Up to 10 points
    }
    
    // Price momentum strength
    const candles = context.marketData.candles;
    if (candles.length >= 2) {
      const priceChange = (currentPrice - parseFloat(candles[candles.length - 2].close)) / currentPrice;
      strength += Math.min(5, Math.abs(priceChange) * 1000); // Up to 5 points
    }
    
    return Math.min(100, Math.max(0, strength));
  }

  /**
   * Calculate confidence score for signal
   */
  private calculateConfidence(signalStrength: number, context: StrategyContext): number {
    let confidence = signalStrength;
    
    // Adjust based on market conditions
    if (context.marketConditions) {
      switch (context.marketConditions.volatility) {
        case 'low':
          confidence *= 1.1; // More confident in low volatility
          break;
        case 'high':
          confidence *= 0.9; // Less confident in high volatility
          break;
      }
      
      switch (context.marketConditions.trend) {
        case 'strong_bullish':
        case 'strong_bearish':
          confidence *= 1.05; // More confident in strong trends
          break;
        case 'ranging':
          confidence *= 0.95; // Less confident in ranging market
          break;
      }
    }
    
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Calculate stop loss level using ATR
   */
  private calculateStopLoss(signal: StrategySignalType, entryPrice: number, atrValue: number): number {
    const config = this.config as EMACrossoverConfig;
    const stopDistance = atrValue * config.atrStopMultiplier;
    
    if (signal === 'BUY') {
      return entryPrice - stopDistance;
    } else {
      return entryPrice + stopDistance;
    }
  }

  /**
   * Calculate take profit level using ATR
   */
  private calculateTakeProfit(signal: StrategySignalType, entryPrice: number, atrValue: number): number {
    const config = this.config as EMACrossoverConfig;
    const targetDistance = atrValue * config.atrTargetMultiplier;
    
    if (signal === 'BUY') {
      return entryPrice + targetDistance;
    } else {
      return entryPrice - targetDistance;
    }
  }

  /**
   * Calculate current volume multiple
   */
  private calculateVolumeMultiple(context: StrategyContext): number {
    const currentVolume = context.marketData.volume24h;
    
    if (this.volumeHistory.length === 0) {
      return 1;
    }
    
    const averageVolume = this.volumeHistory.reduce((sum, vol) => sum + vol, 0) / this.volumeHistory.length;
    return averageVolume > 0 ? currentVolume / averageVolume : 1;
  }

  /**
   * Generate reasoning text for signal
   */
  private generateReasoning(
    signal: StrategySignalType,
    fastEma: number,
    slowEma: number,
    strength: number
  ): string {
    const direction = signal === 'BUY' ? 'bullish' : 'bearish';
    const crossType = signal === 'BUY' ? 'golden cross' : 'death cross';
    
    return `${direction.charAt(0).toUpperCase() + direction.slice(1)} EMA crossover detected (${crossType}). ` +
           `Fast EMA (${fastEma.toFixed(4)}) crossed ${signal === 'BUY' ? 'above' : 'below'} ` +
           `Slow EMA (${slowEma.toFixed(4)}). Signal strength: ${strength.toFixed(1)}%.`;
  }

  /**
   * Determine signal priority based on strength
   */
  private determinePriority(strength: number): 'low' | 'medium' | 'high' {
    if (strength >= 80) return 'high';
    if (strength >= 65) return 'medium';
    return 'low';
  }

  /**
   * Check for recent opposite signals to prevent whipsaws
   */
  private hasRecentOppositeSignal(signal: StrategySignal): boolean {
    // This would check signal history for recent opposite signals
    // For now, return false (no whipsaw protection)
    return false;
  }
}

export default EMACrossoverStrategy;