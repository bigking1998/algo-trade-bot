/**
 * Breakout Strategy Template - Task BE-015: Strategy Templates Implementation
 * 
 * Professional breakout trading strategy with:
 * - Support/resistance level detection using Pivot Points
 * - Price breakout confirmation with volume analysis
 * - Bollinger Band squeeze identification
 * - False breakout filtering mechanisms
 * - Dynamic stop loss placement based on volatility
 * - Multiple timeframe breakout validation
 * - Momentum confirmation for breakout strength
 * - Risk management with position sizing based on volatility
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
import { PivotPoints, PivotPointsResult } from '../../indicators/support_resistance/PivotPoints.js';
import { BollingerBands } from '../../indicators/volatility/BollingerBands.js';
import { ATR } from '../../indicators/volatility/ATR.js';
import { RSI } from '../../indicators/momentum/RSI.js';
import { SimpleMovingAverage } from '../../indicators/trend/SimpleMovingAverage.js';

/**
 * Breakout Strategy configuration interface
 */
export interface BreakoutConfig extends StrategyConfig {
  /** Pivot Points calculation method (default: 'STANDARD') */
  pivotMethod: 'STANDARD' | 'FIBONACCI' | 'WOODIE' | 'CAMARILLA' | 'DEMARK';
  /** Breakout confirmation distance as percentage of ATR (default: 0.5) */
  breakoutConfirmationDistance: number;
  /** Minimum volume multiple for breakout confirmation (default: 1.5) */
  minVolumeMultiple: number;
  /** Bollinger Band period (default: 20) */
  bollingerPeriod: number;
  /** Bollinger Band standard deviations (default: 2.0) */
  bollingerStdDev: number;
  /** Enable Bollinger Band squeeze detection */
  enableBollingerSqueeze: boolean;
  /** Squeeze threshold (band width percentage, default: 0.02) */
  squeezeThreshold: number;
  /** ATR period for volatility measurement (default: 14) */
  atrPeriod: number;
  /** ATR multiplier for stop loss (default: 2.5) */
  atrStopMultiplier: number;
  /** ATR multiplier for take profit (default: 4.0) */
  atrTargetMultiplier: number;
  /** RSI period for momentum confirmation (default: 14) */
  rsiPeriod: number;
  /** Enable RSI momentum confirmation */
  enableRsiMomentum: boolean;
  /** RSI neutral zone boundaries (default: [40, 60]) */
  rsiNeutralZone: [number, number];
  /** Enable false breakout filtering */
  enableFalseBreakoutFilter: boolean;
  /** False breakout lookback period in candles (default: 10) */
  falseBreakoutLookback: number;
  /** Minimum candles to hold after breakout (default: 3) */
  minHoldingCandles: number;
  /** Maximum candles to hold position (default: 50) */
  maxHoldingCandles: number;
  /** Minimum signal strength threshold (0-100) */
  minSignalStrength: number;
  /** Enable trend filter using SMA */
  enableTrendFilter: boolean;
  /** SMA period for trend confirmation (default: 50) */
  trendSmaPeriod: number;
}

/**
 * Breakout Strategy Implementation
 * 
 * This strategy identifies price breakouts from support/resistance levels
 * and generates trading signals when price breaks through key levels
 * with sufficient volume and momentum confirmation.
 */
export class BreakoutStrategy extends BaseStrategy {
  private pivotPoints!: PivotPoints;
  private bollingerBands!: BollingerBands;
  private atr!: ATR;
  private rsi!: RSI;
  private trendSma!: SimpleMovingAverage;
  
  // Strategy state tracking
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private breakoutHistory: Array<{
    level: number;
    type: 'SUPPORT' | 'RESISTANCE';
    timestamp: Date;
    success: boolean;
  }> = [];
  private currentCandleCount = 0;
  private positionEntryCandle?: number;
  private lastBreakoutCandle?: number;
  
  constructor(config: BreakoutConfig) {
    // Ensure required parameters are set with defaults
    const breakoutConfig: BreakoutConfig = {
      pivotMethod: 'STANDARD',
      breakoutConfirmationDistance: 0.5,
      minVolumeMultiple: 1.5,
      bollingerPeriod: 20,
      bollingerStdDev: 2.0,
      enableBollingerSqueeze: true,
      squeezeThreshold: 0.02,
      atrPeriod: 14,
      atrStopMultiplier: 2.5,
      atrTargetMultiplier: 4.0,
      rsiPeriod: 14,
      enableRsiMomentum: true,
      rsiNeutralZone: [40, 60],
      enableFalseBreakoutFilter: true,
      falseBreakoutLookback: 10,
      minHoldingCandles: 3,
      maxHoldingCandles: 50,
      minSignalStrength: 70,
      enableTrendFilter: true,
      trendSmaPeriod: 50,
      ...config
    };

    super(breakoutConfig);
  }

  /**
   * Initialize strategy indicators and validation
   */
  async initialize(): Promise<void> {
    const config = this.config as BreakoutConfig;
    
    // Validate configuration
    this.validateConfiguration(config);
    
    // Initialize Pivot Points
    this.pivotPoints = new PivotPoints({
      period: 1,
      method: config.pivotMethod,
      includeMidPoints: true
    });
    
    // Initialize Bollinger Bands
    this.bollingerBands = new BollingerBands({
      period: config.bollingerPeriod,
      standardDeviations: config.bollingerStdDev,
      priceType: 'close'
    });
    
    // Initialize ATR
    this.atr = new ATR({
      period: config.atrPeriod
    });
    
    // Initialize RSI if momentum confirmation is enabled
    if (config.enableRsiMomentum) {
      this.rsi = new RSI({
        period: config.rsiPeriod,
        priceType: 'close'
      });
    }
    
    // Initialize trend SMA if trend filter is enabled
    if (config.enableTrendFilter) {
      this.trendSma = new SimpleMovingAverage({
        period: config.trendSmaPeriod,
        priceType: 'close'
      });
    }
    
    this.emit('initialized', {
      strategy: 'Breakout',
      pivotMethod: config.pivotMethod,
      bollingerPeriod: config.bollingerPeriod,
      enableSqueeze: config.enableBollingerSqueeze
    });
  }

  /**
   * Main strategy execution logic
   */
  async execute(context: StrategyContext): Promise<StrategySignal | null> {
    try {
      // Increment candle counter
      this.currentCandleCount++;
      
      // Update indicators with latest market data
      await this.updateIndicators(context.marketData.candles);
      
      // Update strategy state history
      this.updateStateHistory(context);
      
      // Generate signal based on breakout analysis
      const signal = await this.generateSignal(context);
      
      // Validate and enhance signal if generated
      if (signal) {
        const isValid = await this.validateSignal(signal, context);
        if (!isValid) {
          return null;
        }
        
        // Calculate position size and set risk levels
        const positionSize = await this.calculatePositionSize(signal, context);
        const pivotResult = this.pivotPoints.getLatestResult();
        const bollingerResult = this.bollingerBands.getLatestResult();
        
        signal.metadata = {
          ...signal.metadata,
          positionSize,
          breakoutLevel: signal.metadata?.breakoutLevel,
          levelType: signal.metadata?.levelType,
          atrValue: this.atr.getLatestResult()?.value,
          bandWidth: this.calculateBandWidth(),
          isSqueeze: this.isBollingerSqueeze(),
          rsiValue: this.rsi?.getLatestResult()?.value,
          volumeMultiple: this.calculateVolumeMultiple(),
          candlesSinceLastBreakout: this.getCandlesSinceLastBreakout(),
          falseBreakoutRisk: this.assessFalseBreakoutRisk(signal.entryPrice!)
        };
        
        // Mark position entry and track breakout
        this.positionEntryCandle = this.currentCandleCount;
        this.lastBreakoutCandle = this.currentCandleCount;
        
        this.breakoutHistory.push({
          level: signal.metadata.breakoutLevel,
          type: signal.metadata.levelType,
          timestamp: new Date(),
          success: false // Will be updated later
        });
      }
      
      return signal;
      
    } catch (error) {
      this.emit('error', new Error(
        `Breakout strategy execution failed: ${error instanceof Error ? error.message : String(error)}`
      ));
      return null;
    }
  }

  /**
   * Cleanup strategy resources
   */
  async cleanup(): Promise<void> {
    // Reset indicators
    this.pivotPoints.reset();
    this.bollingerBands.reset();
    this.atr.reset();
    
    if (this.rsi) {
      this.rsi.reset();
    }
    
    if (this.trendSma) {
      this.trendSma.reset();
    }
    
    // Clear state
    this.priceHistory = [];
    this.volumeHistory = [];
    this.breakoutHistory = [];
    this.currentCandleCount = 0;
    this.positionEntryCandle = undefined;
    this.lastBreakoutCandle = undefined;
    
    this.emit('cleanup', { strategy: 'Breakout' });
  }

  /**
   * Generate trading signal based on breakout analysis
   */
  async generateSignal(context: StrategyContext): Promise<StrategySignal | null> {
    const config = this.config as BreakoutConfig;
    
    // Get latest indicator values
    const pivotResult = this.pivotPoints.getLatestResult();
    const bollingerResult = this.bollingerBands.getLatestResult();
    const atrResult = this.atr.getLatestResult();
    const rsiResult = this.rsi?.getLatestResult();
    const trendSmaResult = this.trendSma?.getLatestResult();
    
    // Ensure required indicators are ready
    if (!pivotResult?.isValid || !bollingerResult?.isValid || !atrResult?.isValid) {
      return null;
    }
    
    const pivotData = pivotResult.value as PivotPointsResult;
    const currentPrice = context.marketData.currentPrice;
    const atrValue = atrResult.value as number;
    const rsiValue = rsiResult?.value as number;
    const trendSmaValue = trendSmaResult?.value as number;
    
    // Check for Bollinger Band squeeze if enabled
    if (config.enableBollingerSqueeze) {
      if (!this.isBollingerSqueeze()) {
        return null; // No squeeze, wait for consolidation
      }
    }
    
    // Detect breakout from support/resistance levels
    const breakoutDetection = this.detectBreakout(currentPrice, pivotData, atrValue);
    if (!breakoutDetection) {
      return null;
    }
    
    const { signalType, level, levelName, levelType } = breakoutDetection;
    
    // Apply trend filter if enabled
    if (config.enableTrendFilter && trendSmaValue) {
      if (!this.confirmTrendAlignment(signalType, currentPrice, trendSmaValue)) {
        return null;
      }
    }
    
    // Apply RSI momentum confirmation if enabled
    if (config.enableRsiMomentum && rsiValue !== undefined) {
      if (!this.confirmRsiMomentum(signalType, rsiValue)) {
        return null;
      }
    }
    
    // Apply volume confirmation
    if (!this.confirmBreakoutVolume()) {
      return null;
    }
    
    // Apply false breakout filter
    if (config.enableFalseBreakoutFilter) {
      if (this.hasRecentFalseBreakout(level, levelType)) {
        return null;
      }
    }
    
    // Calculate signal strength and confidence
    const signalStrength = this.calculateSignalStrength(
      currentPrice, level, levelType, atrValue, rsiValue, context
    );
    
    if (signalStrength < config.minSignalStrength) {
      return null;
    }
    
    // Create trading signal
    const signal: StrategySignal = {
      id: `breakout_${this.strategyId}_${Date.now()}`,
      strategyId: this.strategyId,
      timestamp: new Date(),
      type: signalType,
      symbol: context.marketData.symbol,
      confidence: this.calculateConfidence(signalStrength, levelType, context),
      strength: signalStrength,
      timeframe: context.marketData.timeframe,
      
      // Price levels
      entryPrice: currentPrice,
      stopLoss: this.calculateStopLoss(signalType, currentPrice, level, atrValue),
      takeProfit: this.calculateTakeProfit(signalType, currentPrice, atrValue),
      
      // Risk management
      maxRisk: config.riskProfile.maxRiskPerTrade,
      
      // Signal details
      reasoning: this.generateReasoning(signalType, levelName, level, currentPrice, signalStrength),
      indicators: {
        pivotPoint: pivotData.pivot,
        resistanceR1: pivotData.resistance.r1,
        supportS1: pivotData.support.s1,
        bollingerUpper: bollingerResult.metadata?.upperBand,
        bollingerLower: bollingerResult.metadata?.lowerBand,
        atr: atrValue,
        rsi: rsiValue,
        trendSma: trendSmaValue,
        volume: context.marketData.volume24h
      },
      conditions: ['breakout'],
      source: 'technical',
      priority: this.determinePriority(signalStrength, levelType),
      isValid: true,
      
      metadata: {
        breakoutType: signalType === 'BUY' ? 'resistance_breakout' : 'support_breakdown',
        breakoutLevel: level,
        levelName,
        levelType,
        signalStrength,
        isSqueeze: this.isBollingerSqueeze(),
        bandWidth: this.calculateBandWidth(),
        trendAligned: this.confirmTrendAlignment(signalType, currentPrice, trendSmaValue),
        momentumConfirmed: this.confirmRsiMomentum(signalType, rsiValue),
        volumeConfirmed: this.confirmBreakoutVolume(),
        falseBreakoutRisk: this.assessFalseBreakoutRisk(currentPrice)
      }
    };
    
    return signal;
  }

  /**
   * Validate generated signal against strategy rules
   */
  async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    const config = this.config as BreakoutConfig;
    
    // Check minimum confidence
    if (signal.confidence < (config.validation?.minConfidence || 65)) {
      return false;
    }
    
    // Check if we're not already in a position in the same direction
    const existingPosition = this.currentPositions.get(signal.symbol);
    if (existingPosition) {
      if (
        (signal.type === 'BUY' && existingPosition.side === 'LONG') ||
        (signal.type === 'SELL' && existingPosition.side === 'SHORT')
      ) {
        return false;
      }
    }
    
    // Risk management validation
    if (!await this.checkRiskManagement(signal, context)) {
      return false;
    }
    
    // Check minimum time since last breakout
    if (this.lastBreakoutCandle && 
        (this.currentCandleCount - this.lastBreakoutCandle) < 3) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate optimal position size based on risk parameters
   */
  async calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number> {
    const config = this.config as BreakoutConfig;
    const riskPerTrade = config.riskProfile.maxRiskPerTrade / 100;
    const accountBalance = context.portfolio.total_value;
    
    // Calculate position size based on stop loss distance
    const stopDistance = Math.abs(signal.entryPrice! - signal.stopLoss!);
    const riskAmount = accountBalance * riskPerTrade;
    
    // Adjust position size based on breakout strength and volatility
    const atrValue = this.atr.getLatestResult()?.value as number || 1;
    const signalStrength = signal.strength / 100;
    const volatilityAdjustment = Math.max(0.5, Math.min(1.5, atrValue / (signal.entryPrice! * 0.02)));
    const sizeMultiplier = signalStrength * (1 / volatilityAdjustment);
    
    // Position size = Risk Amount / Risk per Unit * Multiplier
    const basePositionSize = (riskAmount / stopDistance) * sizeMultiplier;
    
    // Apply position size limits
    const minSize = config.execution.minPositionSize || 0.01;
    const maxSize = Math.min(
      accountBalance * 0.15, // Max 15% of account per breakout trade
      config.execution.maxPositionSize || accountBalance * 0.08
    );
    
    return Math.max(minSize, Math.min(maxSize, basePositionSize));
  }

  /**
   * Determine if existing position should be exited
   */
  async shouldExitPosition(position: Position, context: StrategyContext): Promise<boolean> {
    const config = this.config as BreakoutConfig;
    
    // Update indicators with latest data
    await this.updateIndicators(context.marketData.candles);
    
    const currentPrice = context.marketData.currentPrice;
    
    // Exit if maximum holding period reached
    if (this.positionEntryCandle && 
        (this.currentCandleCount - this.positionEntryCandle) >= config.maxHoldingCandles) {
      return true;
    }
    
    // Exit if price returns to breakout level (failed breakout)
    const breakoutLevel = position.metadata?.breakoutLevel as number;
    if (breakoutLevel) {
      const atrValue = this.atr.getLatestResult()?.value as number || 0;
      const tolerance = atrValue * 0.5;
      
      if (position.side === 'LONG' && currentPrice <= (breakoutLevel + tolerance)) {
        return true; // Price fell back below resistance
      }
      
      if (position.side === 'SHORT' && currentPrice >= (breakoutLevel - tolerance)) {
        return true; // Price rose back above support
      }
    }
    
    // Exit if stop loss or take profit is hit
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
  private validateConfiguration(config: BreakoutConfig): void {
    if (config.breakoutConfirmationDistance <= 0) {
      throw new Error('Breakout confirmation distance must be positive');
    }
    
    if (config.minVolumeMultiple < 1) {
      throw new Error('Minimum volume multiple must be >= 1');
    }
    
    if (config.squeezeThreshold <= 0) {
      throw new Error('Squeeze threshold must be positive');
    }
    
    if (config.rsiNeutralZone[0] >= config.rsiNeutralZone[1]) {
      throw new Error('Invalid RSI neutral zone boundaries');
    }
    
    if (config.minHoldingCandles >= config.maxHoldingCandles) {
      throw new Error('Minimum holding candles must be less than maximum');
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
    
    // Update all indicators
    this.pivotPoints.update(ohlcvData);
    this.bollingerBands.update(ohlcvData);
    this.atr.update(ohlcvData);
    
    if (this.rsi) {
      this.rsi.update(ohlcvData);
    }
    
    if (this.trendSma) {
      this.trendSma.update(ohlcvData);
    }
  }

  /**
   * Update strategy state history for analysis
   */
  private updateStateHistory(context: StrategyContext): void {
    const currentPrice = context.marketData.currentPrice;
    const currentVolume = context.marketData.volume24h;
    
    this.priceHistory.push(currentPrice);
    this.volumeHistory.push(currentVolume);
    
    // Keep history manageable (last 50 periods)
    if (this.priceHistory.length > 50) {
      this.priceHistory.shift();
    }
    if (this.volumeHistory.length > 50) {
      this.volumeHistory.shift();
    }
  }

  /**
   * Detect breakout from pivot support/resistance levels
   */
  private detectBreakout(
    currentPrice: number,
    pivotData: PivotPointsResult,
    atrValue: number
  ): { signalType: StrategySignalType; level: number; levelName: string; levelType: 'SUPPORT' | 'RESISTANCE' } | null {
    const config = this.config as BreakoutConfig;
    const confirmationDistance = atrValue * config.breakoutConfirmationDistance;
    
    // Check resistance breakouts (BUY signals)
    const resistanceLevels = [
      { level: pivotData.resistance.r1, name: 'R1' },
      { level: pivotData.resistance.r2, name: 'R2' },
      { level: pivotData.resistance.r3, name: 'R3' },
      ...(pivotData.resistance.r4 ? [{ level: pivotData.resistance.r4, name: 'R4' }] : [])
    ];
    
    for (const resistance of resistanceLevels) {
      if (currentPrice > resistance.level + confirmationDistance) {
        return {
          signalType: 'BUY',
          level: resistance.level,
          levelName: resistance.name,
          levelType: 'RESISTANCE'
        };
      }
    }
    
    // Check support breakdowns (SELL signals)
    const supportLevels = [
      { level: pivotData.support.s1, name: 'S1' },
      { level: pivotData.support.s2, name: 'S2' },
      { level: pivotData.support.s3, name: 'S3' },
      ...(pivotData.support.s4 ? [{ level: pivotData.support.s4, name: 'S4' }] : [])
    ];
    
    for (const support of supportLevels) {
      if (currentPrice < support.level - confirmationDistance) {
        return {
          signalType: 'SELL',
          level: support.level,
          levelName: support.name,
          levelType: 'SUPPORT'
        };
      }
    }
    
    return null;
  }

  /**
   * Check if Bollinger Bands are in squeeze condition
   */
  private isBollingerSqueeze(): boolean {
    const config = this.config as BreakoutConfig;
    const bandWidth = this.calculateBandWidth();
    return bandWidth < config.squeezeThreshold;
  }

  /**
   * Calculate Bollinger Band width as percentage of middle band
   */
  private calculateBandWidth(): number {
    const result = this.bollingerBands.getLatestResult();
    if (!result?.isValid) return 0;
    
    const upperBand = result.metadata?.upperBand as number;
    const lowerBand = result.metadata?.lowerBand as number;
    const middleBand = result.value as number;
    
    if (middleBand === 0) return 0;
    
    return (upperBand - lowerBand) / middleBand;
  }

  /**
   * Confirm trend alignment
   */
  private confirmTrendAlignment(signalType: StrategySignalType, currentPrice: number, trendSma: number): boolean {
    if (!trendSma) return true;
    
    if (signalType === 'BUY') {
      return currentPrice > trendSma * 0.98; // Allow 2% tolerance below SMA
    } else {
      return currentPrice < trendSma * 1.02; // Allow 2% tolerance above SMA
    }
  }

  /**
   * Confirm RSI momentum
   */
  private confirmRsiMomentum(signalType: StrategySignalType, rsiValue: number): boolean {
    if (rsiValue === undefined) return true;
    
    const config = this.config as BreakoutConfig;
    const [rsiLower, rsiUpper] = config.rsiNeutralZone;
    
    if (signalType === 'BUY') {
      return rsiValue > rsiLower; // RSI should be above lower bound for bullish breakout
    } else {
      return rsiValue < rsiUpper; // RSI should be below upper bound for bearish breakdown
    }
  }

  /**
   * Confirm breakout with volume analysis
   */
  private confirmBreakoutVolume(): boolean {
    const config = this.config as BreakoutConfig;
    
    if (this.volumeHistory.length < 10) {
      return true; // Assume valid if not enough data
    }
    
    const currentVolume = this.volumeHistory[this.volumeHistory.length - 1];
    const averageVolume = this.volumeHistory.slice(0, -1).reduce((sum, vol) => sum + vol, 0) / 
                         (this.volumeHistory.length - 1);
    
    const volumeMultiple = currentVolume / averageVolume;
    return volumeMultiple >= config.minVolumeMultiple;
  }

  /**
   * Check for recent false breakouts at similar levels
   */
  private hasRecentFalseBreakout(level: number, levelType: 'SUPPORT' | 'RESISTANCE'): boolean {
    const config = this.config as BreakoutConfig;
    const cutoffTime = new Date();
    cutoffTime.setTime(cutoffTime.getTime() - (config.falseBreakoutLookback * 60 * 1000)); // Assume 1-min candles
    
    return this.breakoutHistory.some(breakout => 
      breakout.timestamp > cutoffTime &&
      breakout.type === levelType &&
      Math.abs(breakout.level - level) / level < 0.01 && // Within 1% of level
      !breakout.success
    );
  }

  /**
   * Calculate signal strength based on multiple factors
   */
  private calculateSignalStrength(
    currentPrice: number,
    level: number,
    levelType: 'SUPPORT' | 'RESISTANCE',
    atrValue: number,
    rsiValue: number | undefined,
    context: StrategyContext
  ): number {
    let strength = 60; // Base strength for breakouts
    
    // Distance from breakout level (further = stronger)
    const distanceFromLevel = Math.abs(currentPrice - level) / level;
    strength += Math.min(10, distanceFromLevel * 1000); // Up to 10 points
    
    // Volume confirmation strength
    if (this.confirmBreakoutVolume()) {
      strength += 10;
    }
    
    // Bollinger Squeeze bonus
    if (this.isBollingerSqueeze()) {
      strength += 10; // Squeeze indicates potential strong move
    }
    
    // RSI momentum confirmation
    if (rsiValue !== undefined) {
      const config = this.config as BreakoutConfig;
      const [rsiLower, rsiUpper] = config.rsiNeutralZone;
      
      if (levelType === 'RESISTANCE' && rsiValue > rsiLower + 10) {
        strength += 5; // RSI supports bullish breakout
      } else if (levelType === 'SUPPORT' && rsiValue < rsiUpper - 10) {
        strength += 5; // RSI supports bearish breakdown
      }
    }
    
    // Volatility consideration (higher volatility = higher potential)
    const volatilityScore = Math.min(5, (atrValue / currentPrice) * 1000);
    strength += volatilityScore;
    
    // Level importance (R1/S1 more important than R3/S3)
    const levelImportance = this.getLevelImportance(level);
    strength += levelImportance * 3; // Up to 9 points
    
    return Math.min(100, Math.max(0, strength));
  }

  /**
   * Get importance score for breakout level (0-3)
   */
  private getLevelImportance(level: number): number {
    const pivotResult = this.pivotPoints.getLatestResult();
    if (!pivotResult?.isValid) return 1;
    
    const pivotData = pivotResult.value as PivotPointsResult;
    
    // Check which level this is
    if (level === pivotData.resistance.r1 || level === pivotData.support.s1) return 3;
    if (level === pivotData.resistance.r2 || level === pivotData.support.s2) return 2;
    if (level === pivotData.resistance.r3 || level === pivotData.support.s3) return 1;
    
    return 0;
  }

  /**
   * Calculate confidence score for signal
   */
  private calculateConfidence(
    signalStrength: number,
    levelType: 'SUPPORT' | 'RESISTANCE',
    context: StrategyContext
  ): number {
    let confidence = signalStrength;
    
    // Boost confidence for high-importance levels
    const levelImportance = this.getLevelImportance(
      context.marketData.currentPrice // Simplified for this calculation
    );
    confidence *= (1 + levelImportance * 0.05);
    
    // Adjust based on market conditions
    if (context.marketConditions) {
      switch (context.marketConditions.volatility) {
        case 'low':
          confidence *= 0.9; // Less confident in low volatility breakouts
          break;
        case 'high':
          confidence *= 1.1; // More confident in high volatility breakouts
          break;
      }
      
      switch (context.marketConditions.trend) {
        case 'strong_bullish':
          confidence *= levelType === 'RESISTANCE' ? 1.1 : 0.9;
          break;
        case 'strong_bearish':
          confidence *= levelType === 'SUPPORT' ? 1.1 : 0.9;
          break;
      }
    }
    
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Calculate stop loss level
   */
  private calculateStopLoss(
    signalType: StrategySignalType,
    entryPrice: number,
    breakoutLevel: number,
    atrValue: number
  ): number {
    const config = this.config as BreakoutConfig;
    
    // Use the breakout level as initial stop, then add ATR buffer
    const atrBuffer = atrValue * config.atrStopMultiplier;
    
    if (signalType === 'BUY') {
      // For resistance breakout, stop below the resistance level
      return Math.min(breakoutLevel - atrBuffer, entryPrice - atrBuffer);
    } else {
      // For support breakdown, stop above the support level
      return Math.max(breakoutLevel + atrBuffer, entryPrice + atrBuffer);
    }
  }

  /**
   * Calculate take profit level using ATR
   */
  private calculateTakeProfit(signalType: StrategySignalType, entryPrice: number, atrValue: number): number {
    const config = this.config as BreakoutConfig;
    const targetDistance = atrValue * config.atrTargetMultiplier;
    
    if (signalType === 'BUY') {
      return entryPrice + targetDistance;
    } else {
      return entryPrice - targetDistance;
    }
  }

  /**
   * Calculate current volume multiple
   */
  private calculateVolumeMultiple(): number {
    if (this.volumeHistory.length < 2) {
      return 1;
    }
    
    const currentVolume = this.volumeHistory[this.volumeHistory.length - 1];
    const averageVolume = this.volumeHistory.slice(0, -1).reduce((sum, vol) => sum + vol, 0) / 
                         (this.volumeHistory.length - 1);
    
    return averageVolume > 0 ? currentVolume / averageVolume : 1;
  }

  /**
   * Get candles since last breakout
   */
  private getCandlesSinceLastBreakout(): number {
    return this.lastBreakoutCandle ? 
           this.currentCandleCount - this.lastBreakoutCandle : 999;
  }

  /**
   * Assess false breakout risk
   */
  private assessFalseBreakoutRisk(currentPrice: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const recentFailures = this.breakoutHistory.filter(breakout => 
      Date.now() - breakout.timestamp.getTime() < 3600000 && // Last hour
      Math.abs(breakout.level - currentPrice) / currentPrice < 0.05 && // Within 5%
      !breakout.success
    ).length;
    
    if (recentFailures >= 2) return 'HIGH';
    if (recentFailures === 1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate reasoning text for signal
   */
  private generateReasoning(
    signalType: StrategySignalType,
    levelName: string,
    level: number,
    currentPrice: number,
    strength: number
  ): string {
    const action = signalType === 'BUY' ? 'breakout above' : 'breakdown below';
    const levelType = signalType === 'BUY' ? 'resistance' : 'support';
    const distance = ((Math.abs(currentPrice - level) / level) * 100).toFixed(2);
    
    return `Price ${action} ${levelType} level ${levelName} at ${level.toFixed(4)}. ` +
           `Current price ${currentPrice.toFixed(4)} is ${distance}% beyond level. ` +
           `Signal strength: ${strength.toFixed(1)}%.`;
  }

  /**
   * Determine signal priority based on strength and level importance
   */
  private determinePriority(strength: number, levelType: 'SUPPORT' | 'RESISTANCE'): 'low' | 'medium' | 'high' {
    if (strength >= 85 && this.isBollingerSqueeze()) return 'high';
    if (strength >= 75) return 'medium';
    return 'low';
  }
}

export default BreakoutStrategy;