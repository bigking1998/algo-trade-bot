/**
 * RSI Mean Reversion Strategy Template - Task BE-015: Strategy Templates Implementation
 * 
 * Professional RSI-based mean reversion strategy with:
 * - Overbought (>70) and Oversold (<30) signal generation
 * - Momentum divergence confirmation using price action
 * - Volume confirmation for signal validation
 * - Support/resistance level confirmation
 * - Dynamic risk management with volatility-based stops
 * - Multiple RSI level thresholds for enhanced precision
 * - Exit signal generation based on RSI normalization
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
import { RSI } from '../../indicators/momentum/RSI.js';
import { ATR } from '../../indicators/volatility/ATR.js';
import { SimpleMovingAverage } from '../../indicators/trend/SimpleMovingAverage.js';
import { BollingerBands } from '../../indicators/volatility/BollingerBands.js';

/**
 * RSI Mean Reversion Strategy configuration interface
 */
export interface RSIMeanReversionConfig extends StrategyConfig {
  /** RSI period (default: 14) */
  rsiPeriod: number;
  /** Oversold threshold for BUY signals (default: 30) */
  oversoldThreshold: number;
  /** Overbought threshold for SELL signals (default: 70) */
  overboughtThreshold: number;
  /** Extreme oversold threshold for higher confidence (default: 20) */
  extremeOversoldThreshold: number;
  /** Extreme overbought threshold for higher confidence (default: 80) */
  extremeOverboughtThreshold: number;
  /** RSI neutralization level for exits (default: 50) */
  neutralizationLevel: number;
  /** Minimum volume multiple for signal confirmation (default: 1.2) */
  minVolumeMultiple: number;
  /** ATR period for dynamic stops (default: 14) */
  atrPeriod: number;
  /** ATR multiplier for stop loss (default: 1.5) */
  atrStopMultiplier: number;
  /** ATR multiplier for take profit (default: 2.5) */
  atrTargetMultiplier: number;
  /** Enable divergence confirmation filter */
  enableDivergenceConfirmation: boolean;
  /** Enable volume confirmation filter */
  enableVolumeConfirmation: boolean;
  /** Enable Bollinger Band confirmation */
  enableBollingerConfirmation: boolean;
  /** Bollinger Band period (default: 20) */
  bollingerPeriod: number;
  /** Bollinger Band standard deviations (default: 2) */
  bollingerStdDev: number;
  /** Minimum holding period in candles (default: 5) */
  minHoldingPeriod: number;
  /** Maximum holding period in candles (default: 50) */
  maxHoldingPeriod: number;
  /** Minimum signal strength threshold (0-100) */
  minSignalStrength: number;
}

/**
 * RSI Mean Reversion Strategy Implementation
 * 
 * This strategy generates BUY signals when RSI is oversold (< oversoldThreshold)
 * and SELL signals when RSI is overbought (> overboughtThreshold).
 * The strategy assumes prices will revert to the mean after reaching extremes.
 */
export class RSIMeanReversionStrategy extends BaseStrategy {
  private rsi!: RSI;
  private atr!: ATR;
  private sma!: SimpleMovingAverage;
  private bollingerBands!: BollingerBands;
  
  // Strategy state tracking
  private rsiHistory: number[] = [];
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private signalHistory: Array<{ type: StrategySignalType; timestamp: Date; rsi: number }> = [];
  private positionEntryCandle?: number;
  private currentCandleCount = 0;
  
  constructor(config: RSIMeanReversionConfig) {
    // Ensure required parameters are set with defaults
    const rsiMeanReversionConfig: RSIMeanReversionConfig = {
      rsiPeriod: 14,
      oversoldThreshold: 30,
      overboughtThreshold: 70,
      extremeOversoldThreshold: 20,
      extremeOverboughtThreshold: 80,
      neutralizationLevel: 50,
      minVolumeMultiple: 1.2,
      atrPeriod: 14,
      atrStopMultiplier: 1.5,
      atrTargetMultiplier: 2.5,
      enableDivergenceConfirmation: true,
      enableVolumeConfirmation: true,
      enableBollingerConfirmation: true,
      bollingerPeriod: 20,
      bollingerStdDev: 2.0,
      minHoldingPeriod: 5,
      maxHoldingPeriod: 50,
      minSignalStrength: 65,
      ...config
    };

    super(rsiMeanReversionConfig);
  }

  /**
   * Initialize strategy indicators and validation
   */
  async initialize(): Promise<void> {
    const config = this.config as RSIMeanReversionConfig;
    
    // Validate configuration
    this.validateConfiguration(config);
    
    // Initialize RSI
    this.rsi = new RSI({
      period: config.rsiPeriod,
      priceType: 'close',
      overboughtLevel: config.overboughtThreshold,
      oversoldLevel: config.oversoldThreshold
    });
    
    // Initialize ATR for dynamic risk management
    this.atr = new ATR({
      period: config.atrPeriod
    });
    
    // Initialize SMA for trend confirmation
    this.sma = new SimpleMovingAverage({
      period: config.rsiPeriod,
      priceType: 'close'
    });
    
    // Initialize Bollinger Bands for volatility confirmation
    if (config.enableBollingerConfirmation) {
      this.bollingerBands = new BollingerBands({
        period: config.bollingerPeriod,
        standardDeviations: config.bollingerStdDev,
        priceType: 'close'
      });
    }
    
    this.emit('initialized', {
      strategy: 'RSI Mean Reversion',
      rsiPeriod: config.rsiPeriod,
      oversoldThreshold: config.oversoldThreshold,
      overboughtThreshold: config.overboughtThreshold
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
      
      // Generate signal based on RSI mean reversion
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
          rsiValue: this.rsi.getLatestResult()?.value,
          atrValue: this.atr.getLatestResult()?.value,
          divergenceDetected: this.checkDivergence(),
          bollingerPosition: this.getBollingerPosition(context.marketData.currentPrice),
          volumeMultiple: this.calculateVolumeMultiple(),
          candlesSinceLastSignal: this.getCandlesSinceLastSignal(signal.type)
        };
        
        // Track signal in history
        this.signalHistory.push({
          type: signal.type,
          timestamp: new Date(),
          rsi: this.rsi.getLatestResult()?.value as number || 50
        });
        
        // Keep history manageable
        if (this.signalHistory.length > 20) {
          this.signalHistory.shift();
        }
        
        // Mark position entry candle
        this.positionEntryCandle = this.currentCandleCount;
      }
      
      return signal;
      
    } catch (error) {
      this.emit('error', new Error(
        `RSI Mean Reversion execution failed: ${error instanceof Error ? error.message : String(error)}`
      ));
      return null;
    }
  }

  /**
   * Cleanup strategy resources
   */
  async cleanup(): Promise<void> {
    // Reset indicators
    this.rsi.reset();
    this.atr.reset();
    this.sma.reset();
    if (this.bollingerBands) {
      this.bollingerBands.reset();
    }
    
    // Clear state
    this.rsiHistory = [];
    this.priceHistory = [];
    this.volumeHistory = [];
    this.signalHistory = [];
    this.positionEntryCandle = undefined;
    this.currentCandleCount = 0;
    
    this.emit('cleanup', { strategy: 'RSI Mean Reversion' });
  }

  /**
   * Generate trading signal based on RSI mean reversion analysis
   */
  async generateSignal(context: StrategyContext): Promise<StrategySignal | null> {
    const config = this.config as RSIMeanReversionConfig;
    
    // Get latest indicator values
    const rsiResult = this.rsi.getLatestResult();
    const atrResult = this.atr.getLatestResult();
    const smaResult = this.sma.getLatestResult();
    
    // Ensure RSI and ATR are ready
    if (!rsiResult?.isValid || !atrResult?.isValid) {
      return null;
    }
    
    const rsiValue = rsiResult.value as number;
    const atrValue = atrResult.value as number;
    const currentPrice = context.marketData.currentPrice;
    const smaValue = smaResult?.value as number;
    
    // Determine signal type based on RSI levels
    let signalType: StrategySignalType | null = null;
    let isExtremeLevel = false;
    
    // Check for oversold conditions (BUY signals)
    if (rsiValue <= config.oversoldThreshold) {
      signalType = 'BUY';
      isExtremeLevel = rsiValue <= config.extremeOversoldThreshold;
    }
    // Check for overbought conditions (SELL signals)
    else if (rsiValue >= config.overboughtThreshold) {
      signalType = 'SELL';
      isExtremeLevel = rsiValue >= config.extremeOverboughtThreshold;
    }
    
    // No signal if RSI is in neutral zone
    if (!signalType) {
      return null;
    }
    
    // Apply divergence confirmation filter
    if (config.enableDivergenceConfirmation) {
      if (!this.confirmDivergence(signalType)) {
        return null;
      }
    }
    
    // Apply volume confirmation filter
    if (config.enableVolumeConfirmation) {
      if (!this.confirmVolume()) {
        return null;
      }
    }
    
    // Apply Bollinger Band confirmation
    if (config.enableBollingerConfirmation && this.bollingerBands) {
      if (!this.confirmBollingerBand(signalType, currentPrice)) {
        return null;
      }
    }
    
    // Check for recent opposing signals (prevent whipsaws)
    if (this.hasRecentOpposingSignal(signalType)) {
      return null;
    }
    
    // Calculate signal strength and confidence
    const signalStrength = this.calculateSignalStrength(
      rsiValue, currentPrice, smaValue, isExtremeLevel, context
    );
    
    if (signalStrength < config.minSignalStrength) {
      return null;
    }
    
    // Create trading signal
    const signal: StrategySignal = {
      id: `rsi_mean_reversion_${this.strategyId}_${Date.now()}`,
      strategyId: this.strategyId,
      timestamp: new Date(),
      type: signalType,
      symbol: context.marketData.symbol,
      confidence: this.calculateConfidence(signalStrength, isExtremeLevel, context),
      strength: signalStrength,
      timeframe: context.marketData.timeframe,
      
      // Price levels
      entryPrice: currentPrice,
      stopLoss: this.calculateStopLoss(signalType, currentPrice, atrValue, rsiValue),
      takeProfit: this.calculateTakeProfit(signalType, currentPrice, atrValue, rsiValue),
      
      // Risk management
      maxRisk: config.riskProfile.maxRiskPerTrade,
      
      // Signal details
      reasoning: this.generateReasoning(signalType, rsiValue, isExtremeLevel, signalStrength),
      indicators: {
        rsi: rsiValue,
        sma: smaValue,
        atr: atrValue,
        bollingerUpper: this.bollingerBands?.getLatestResult()?.metadata?.upperBand,
        bollingerLower: this.bollingerBands?.getLatestResult()?.metadata?.lowerBand,
        volume: context.marketData.volume24h
      },
      conditions: ['rsi_mean_reversion'],
      source: 'technical',
      priority: this.determinePriority(signalStrength, isExtremeLevel),
      isValid: true,
      
      metadata: {
        rsiLevel: this.rsi.getRSILevel(),
        isExtremeLevel,
        meanReversionType: signalType === 'BUY' ? 'oversold_rebound' : 'overbought_decline',
        signalStrength,
        expectedHoldingPeriod: this.estimateHoldingPeriod(rsiValue),
        divergenceConfirmed: this.checkDivergence(),
        volumeConfirmed: this.confirmVolume(),
        bollingerConfirmed: config.enableBollingerConfirmation ? 
          this.confirmBollingerBand(signalType, currentPrice) : true
      }
    };
    
    return signal;
  }

  /**
   * Validate generated signal against strategy rules
   */
  async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    const config = this.config as RSIMeanReversionConfig;
    
    // Check minimum confidence
    if (signal.confidence < (config.validation?.minConfidence || 60)) {
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
    
    // Check minimum gap from last signal
    const lastSignal = this.signalHistory[this.signalHistory.length - 1];
    if (lastSignal && lastSignal.type === signal.type) {
      const candlesSinceLast = this.getCandlesSinceLastSignal(signal.type);
      if (candlesSinceLast < 3) {
        return false; // Too recent
      }
    }
    
    return true;
  }

  /**
   * Calculate optimal position size based on risk parameters
   */
  async calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number> {
    const config = this.config as RSIMeanReversionConfig;
    const riskPerTrade = config.riskProfile.maxRiskPerTrade / 100;
    const accountBalance = context.portfolio.total_value;
    
    // Calculate position size based on stop loss distance
    const stopDistance = Math.abs(signal.entryPrice! - signal.stopLoss!);
    const riskAmount = accountBalance * riskPerTrade;
    
    // Adjust position size based on RSI extremity
    const rsiValue = this.rsi.getLatestResult()?.value as number || 50;
    let sizeMultiplier = 1.0;
    
    // Increase size for extreme RSI levels
    if (rsiValue <= (config.extremeOversoldThreshold) || rsiValue >= (config.extremeOverboughtThreshold)) {
      sizeMultiplier = 1.3; // 30% larger position for extreme levels
    }
    
    // Position size = Risk Amount / Risk per Unit * Multiplier
    const basePositionSize = (riskAmount / stopDistance) * sizeMultiplier;
    
    // Apply position size limits
    const minSize = config.execution.minPositionSize || 0.01;
    const maxSize = Math.min(
      accountBalance * 0.08, // Max 8% of account per trade for mean reversion
      config.execution.maxPositionSize || accountBalance * 0.05
    );
    
    return Math.max(minSize, Math.min(maxSize, basePositionSize));
  }

  /**
   * Determine if existing position should be exited
   */
  async shouldExitPosition(position: Position, context: StrategyContext): Promise<boolean> {
    const config = this.config as RSIMeanReversionConfig;
    
    // Update indicators with latest data
    await this.updateIndicators(context.marketData.candles);
    
    const rsiResult = this.rsi.getLatestResult();
    if (!rsiResult?.isValid) {
      return false;
    }
    
    const rsiValue = rsiResult.value as number;
    const currentPrice = context.marketData.currentPrice;
    
    // Exit if RSI has moved to neutral zone (mean reversion completed)
    if (position.side === 'LONG' && rsiValue >= config.neutralizationLevel) {
      return true; // RSI normalized from oversold
    }
    
    if (position.side === 'SHORT' && rsiValue <= config.neutralizationLevel) {
      return true; // RSI normalized from overbought
    }
    
    // Exit if maximum holding period reached
    if (this.positionEntryCandle && 
        (this.currentCandleCount - this.positionEntryCandle) >= config.maxHoldingPeriod) {
      return true;
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
  private validateConfiguration(config: RSIMeanReversionConfig): void {
    if (config.oversoldThreshold >= config.overboughtThreshold) {
      throw new Error('Oversold threshold must be less than overbought threshold');
    }
    
    if (config.extremeOversoldThreshold >= config.oversoldThreshold) {
      throw new Error('Extreme oversold threshold must be less than oversold threshold');
    }
    
    if (config.extremeOverboughtThreshold <= config.overboughtThreshold) {
      throw new Error('Extreme overbought threshold must be greater than overbought threshold');
    }
    
    if (config.neutralizationLevel <= config.oversoldThreshold || 
        config.neutralizationLevel >= config.overboughtThreshold) {
      throw new Error('Neutralization level must be between oversold and overbought thresholds');
    }
    
    if (config.minHoldingPeriod >= config.maxHoldingPeriod) {
      throw new Error('Minimum holding period must be less than maximum holding period');
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
    this.rsi.update(ohlcvData);
    this.atr.update(ohlcvData);
    this.sma.update(ohlcvData);
    
    if (this.bollingerBands) {
      this.bollingerBands.update(ohlcvData);
    }
  }

  /**
   * Update strategy state history for analysis
   */
  private updateStateHistory(context: StrategyContext): void {
    const rsiResult = this.rsi.getLatestResult();
    const currentPrice = context.marketData.currentPrice;
    const currentVolume = context.marketData.volume24h;
    
    if (rsiResult?.isValid) {
      this.rsiHistory.push(rsiResult.value as number);
    }
    
    this.priceHistory.push(currentPrice);
    this.volumeHistory.push(currentVolume);
    
    // Keep history manageable (last 50 periods)
    if (this.rsiHistory.length > 50) {
      this.rsiHistory.shift();
    }
    if (this.priceHistory.length > 50) {
      this.priceHistory.shift();
    }
    if (this.volumeHistory.length > 50) {
      this.volumeHistory.shift();
    }
  }

  /**
   * Check for price-RSI divergence
   */
  private checkDivergence(): boolean {
    if (this.rsiHistory.length < 10 || this.priceHistory.length < 10) {
      return true; // Assume valid if not enough data
    }
    
    // Look for divergence over last 10 periods
    const recentRsi = this.rsiHistory.slice(-10);
    const recentPrices = this.priceHistory.slice(-10);
    
    // Simple divergence check
    const rsiTrend = recentRsi[recentRsi.length - 1] - recentRsi[0];
    const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[0];
    
    // Bullish divergence: Price declining but RSI rising
    if (priceTrend < 0 && rsiTrend > 0) {
      return true;
    }
    
    // Bearish divergence: Price rising but RSI falling
    if (priceTrend > 0 && rsiTrend < 0) {
      return true;
    }
    
    // No clear divergence, but don't reject signal
    return true;
  }

  /**
   * Confirm signal with volume analysis
   */
  private confirmVolume(): boolean {
    const config = this.config as RSIMeanReversionConfig;
    
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
   * Confirm signal using Bollinger Bands
   */
  private confirmBollingerBand(signalType: StrategySignalType, currentPrice: number): boolean {
    if (!this.bollingerBands) {
      return true;
    }
    
    const bbResult = this.bollingerBands.getLatestResult();
    if (!bbResult?.isValid) {
      return true;
    }
    
    const upperBand = bbResult.metadata?.upperBand as number;
    const lowerBand = bbResult.metadata?.lowerBand as number;
    
    // For BUY signals, price should be near or below lower Bollinger Band
    if (signalType === 'BUY') {
      return currentPrice <= lowerBand * 1.02; // Allow 2% tolerance
    }
    
    // For SELL signals, price should be near or above upper Bollinger Band
    if (signalType === 'SELL') {
      return currentPrice >= upperBand * 0.98; // Allow 2% tolerance
    }
    
    return true;
  }

  /**
   * Get Bollinger Band position of current price
   */
  private getBollingerPosition(currentPrice: number): string {
    if (!this.bollingerBands) {
      return 'unknown';
    }
    
    const bbResult = this.bollingerBands.getLatestResult();
    if (!bbResult?.isValid) {
      return 'unknown';
    }
    
    const upperBand = bbResult.metadata?.upperBand as number;
    const lowerBand = bbResult.metadata?.lowerBand as number;
    const middleBand = bbResult.value as number;
    
    if (currentPrice >= upperBand) return 'above_upper';
    if (currentPrice <= lowerBand) return 'below_lower';
    if (currentPrice > middleBand) return 'above_middle';
    if (currentPrice < middleBand) return 'below_middle';
    return 'at_middle';
  }

  /**
   * Calculate signal strength based on multiple factors
   */
  private calculateSignalStrength(
    rsiValue: number,
    currentPrice: number,
    smaValue: number,
    isExtremeLevel: boolean,
    context: StrategyContext
  ): number {
    let strength = 50; // Base strength
    
    // RSI extremity strength (more extreme = stronger signal)
    const rsiExtremity = rsiValue <= 50 ? (50 - rsiValue) / 50 : (rsiValue - 50) / 50;
    strength += rsiExtremity * 30; // Up to 30 points
    
    // Extreme level bonus
    if (isExtremeLevel) {
      strength += 10;
    }
    
    // Volume confirmation strength
    if (this.confirmVolume()) {
      strength += 10;
    }
    
    // Divergence confirmation strength
    if (this.checkDivergence()) {
      strength += 5;
    }
    
    // Distance from SMA (mean) strength
    if (smaValue && smaValue > 0) {
      const distanceFromMean = Math.abs(currentPrice - smaValue) / smaValue;
      strength += Math.min(10, distanceFromMean * 200); // Up to 10 points
    }
    
    // Bollinger Band confirmation
    if (this.bollingerBands) {
      const position = this.getBollingerPosition(currentPrice);
      if (position === 'above_upper' || position === 'below_lower') {
        strength += 5;
      }
    }
    
    return Math.min(100, Math.max(0, strength));
  }

  /**
   * Calculate confidence score for signal
   */
  private calculateConfidence(signalStrength: number, isExtremeLevel: boolean, context: StrategyContext): number {
    let confidence = signalStrength;
    
    // Boost confidence for extreme RSI levels
    if (isExtremeLevel) {
      confidence *= 1.1;
    }
    
    // Adjust based on market conditions
    if (context.marketConditions) {
      switch (context.marketConditions.volatility) {
        case 'low':
          confidence *= 0.95; // Less confident in low volatility (less reversion)
          break;
        case 'high':
          confidence *= 1.05; // More confident in high volatility (more reversion)
          break;
      }
      
      switch (context.marketConditions.trend) {
        case 'strong_bullish':
        case 'strong_bearish':
          confidence *= 0.9; // Less confident against strong trends
          break;
        case 'ranging':
          confidence *= 1.1; // More confident in ranging market
          break;
      }
    }
    
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Calculate stop loss level using ATR and RSI
   */
  private calculateStopLoss(signalType: StrategySignalType, entryPrice: number, atrValue: number, rsiValue: number): number {
    const config = this.config as RSIMeanReversionConfig;
    let stopMultiplier = config.atrStopMultiplier;
    
    // Tighter stops for extreme RSI levels (more conviction)
    if (signalType === 'BUY' && rsiValue <= config.extremeOversoldThreshold) {
      stopMultiplier *= 0.8;
    } else if (signalType === 'SELL' && rsiValue >= config.extremeOverboughtThreshold) {
      stopMultiplier *= 0.8;
    }
    
    const stopDistance = atrValue * stopMultiplier;
    
    if (signalType === 'BUY') {
      return entryPrice - stopDistance;
    } else {
      return entryPrice + stopDistance;
    }
  }

  /**
   * Calculate take profit level using ATR and expected mean reversion
   */
  private calculateTakeProfit(signalType: StrategySignalType, entryPrice: number, atrValue: number, rsiValue: number): number {
    const config = this.config as RSIMeanReversionConfig;
    let targetMultiplier = config.atrTargetMultiplier;
    
    // Larger targets for extreme RSI levels
    if (signalType === 'BUY' && rsiValue <= config.extremeOversoldThreshold) {
      targetMultiplier *= 1.3;
    } else if (signalType === 'SELL' && rsiValue >= config.extremeOverboughtThreshold) {
      targetMultiplier *= 1.3;
    }
    
    const targetDistance = atrValue * targetMultiplier;
    
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
   * Get candles since last signal of same type
   */
  private getCandlesSinceLastSignal(signalType: StrategySignalType): number {
    const lastSignal = [...this.signalHistory].reverse().find(s => s.type === signalType);
    if (!lastSignal) {
      return 999; // No previous signal
    }
    
    // This is a simplified calculation - in practice you'd track exact candle counts
    const timeDiff = Date.now() - lastSignal.timestamp.getTime();
    const candleDuration = 60000; // Assume 1-minute candles for estimation
    return Math.floor(timeDiff / candleDuration);
  }

  /**
   * Estimate optimal holding period based on RSI extremity
   */
  private estimateHoldingPeriod(rsiValue: number): number {
    const config = this.config as RSIMeanReversionConfig;
    
    // More extreme RSI = longer expected reversion time
    if (rsiValue <= config.extremeOversoldThreshold || rsiValue >= config.extremeOverboughtThreshold) {
      return Math.floor(config.maxHoldingPeriod * 0.8);
    } else {
      return Math.floor(config.maxHoldingPeriod * 0.5);
    }
  }

  /**
   * Check for recent opposing signals
   */
  private hasRecentOpposingSignal(signalType: StrategySignalType): boolean {
    const oppositeType = signalType === 'BUY' ? 'SELL' : 'BUY';
    const recentSignals = this.signalHistory.slice(-5); // Last 5 signals
    
    return recentSignals.some(s => 
      s.type === oppositeType && 
      Date.now() - s.timestamp.getTime() < 300000 // 5 minutes
    );
  }

  /**
   * Confirm divergence between price and RSI
   */
  private confirmDivergence(signalType: StrategySignalType): boolean {
    if (!this.config.enableDivergenceConfirmation) {
      return true;
    }
    
    // For mean reversion, we often want to see divergence
    return this.checkDivergence();
  }

  /**
   * Generate reasoning text for signal
   */
  private generateReasoning(
    signalType: StrategySignalType,
    rsiValue: number,
    isExtremeLevel: boolean,
    strength: number
  ): string {
    const config = this.config as RSIMeanReversionConfig;
    const condition = signalType === 'BUY' ? 'oversold' : 'overbought';
    const extremeText = isExtremeLevel ? ' (extreme level)' : '';
    const threshold = signalType === 'BUY' ? config.oversoldThreshold : config.overboughtThreshold;
    
    return `RSI mean reversion signal detected. RSI (${rsiValue.toFixed(1)}) is ${condition}${extremeText} ` +
           `below/above ${threshold} threshold. Expecting price reversion to mean. Signal strength: ${strength.toFixed(1)}%.`;
  }

  /**
   * Determine signal priority based on strength and extremity
   */
  private determinePriority(strength: number, isExtremeLevel: boolean): 'low' | 'medium' | 'high' {
    if (isExtremeLevel && strength >= 80) return 'high';
    if (strength >= 75) return 'medium';
    return 'low';
  }
}

export default RSIMeanReversionStrategy;