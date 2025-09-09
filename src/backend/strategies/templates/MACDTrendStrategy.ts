/**
 * MACD Trend Strategy Template - Task BE-015: Strategy Templates Implementation
 * 
 * Professional MACD-based trend following strategy with:
 * - MACD line and Signal line crossover signals
 * - Histogram divergence and momentum confirmation
 * - Zero-line crossover trend validation
 * - Volume confirmation for signal validation
 * - Divergence detection for enhanced signal quality
 * - Dynamic risk management with ATR-based stops
 * - Multiple MACD timeframe analysis support
 * - Exit signals based on histogram reversal
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
import { MACD } from '../../indicators/trend/MACD.js';
import { ATR } from '../../indicators/volatility/ATR.js';
import { SimpleMovingAverage } from '../../indicators/trend/SimpleMovingAverage.js';

/**
 * MACD Trend Strategy configuration interface
 */
export interface MACDTrendConfig extends StrategyConfig {
  /** Fast EMA period for MACD (default: 12) */
  macdFastPeriod: number;
  /** Slow EMA period for MACD (default: 26) */
  macdSlowPeriod: number;
  /** Signal line EMA period (default: 9) */
  macdSignalPeriod: number;
  /** Minimum histogram threshold for signal confirmation (default: 0.001) */
  minHistogramThreshold: number;
  /** Minimum volume multiple for signal confirmation (default: 1.3) */
  minVolumeMultiple: number;
  /** ATR period for dynamic stops (default: 14) */
  atrPeriod: number;
  /** ATR multiplier for stop loss (default: 2.0) */
  atrStopMultiplier: number;
  /** ATR multiplier for take profit (default: 3.5) */
  atrTargetMultiplier: number;
  /** Enable zero-line crossover confirmation */
  enableZeroLineConfirmation: boolean;
  /** Enable histogram divergence confirmation */
  enableHistogramDivergence: boolean;
  /** Enable volume confirmation filter */
  enableVolumeConfirmation: boolean;
  /** Enable trend confirmation using SMA */
  enableTrendConfirmation: boolean;
  /** SMA period for trend confirmation (default: 50) */
  trendSmaPeriod: number;
  /** Minimum signal strength threshold (0-100) */
  minSignalStrength: number;
  /** Histogram lookback period for trend analysis (default: 5) */
  histogramLookback: number;
  /** Enable early exit on histogram reversal */
  enableHistogramExit: boolean;
}

/**
 * MACD Trend Strategy Implementation
 * 
 * This strategy generates BUY signals when MACD line crosses above Signal line
 * and SELL signals when MACD line crosses below Signal line.
 * Additional confirmations include histogram analysis and zero-line crossovers.
 */
export class MACDTrendStrategy extends BaseStrategy {
  private macd!: MACD;
  private atr!: ATR;
  private trendSma!: SimpleMovingAverage;
  
  // Strategy state tracking
  private macdHistory: Array<{ macd: number; signal: number; histogram: number }> = [];
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private lastCrossoverType: 'bullish' | 'bearish' | null = null;
  private lastCrossoverCandle?: number;
  private currentCandleCount = 0;
  
  constructor(config: MACDTrendConfig) {
    // Ensure required parameters are set with defaults
    const macdTrendConfig: MACDTrendConfig = {
      macdFastPeriod: 12,
      macdSlowPeriod: 26,
      macdSignalPeriod: 9,
      minHistogramThreshold: 0.001,
      minVolumeMultiple: 1.3,
      atrPeriod: 14,
      atrStopMultiplier: 2.0,
      atrTargetMultiplier: 3.5,
      enableZeroLineConfirmation: true,
      enableHistogramDivergence: true,
      enableVolumeConfirmation: true,
      enableTrendConfirmation: true,
      trendSmaPeriod: 50,
      minSignalStrength: 65,
      histogramLookback: 5,
      enableHistogramExit: true,
      ...config
    };

    super(macdTrendConfig);
  }

  /**
   * Initialize strategy indicators and validation
   */
  async initialize(): Promise<void> {
    const config = this.config as MACDTrendConfig;
    
    // Validate configuration
    this.validateConfiguration(config);
    
    // Initialize MACD
    this.macd = new MACD({
      fastPeriod: config.macdFastPeriod,
      slowPeriod: config.macdSlowPeriod,
      signalPeriod: config.macdSignalPeriod,
      priceType: 'close'
    });
    
    // Initialize ATR for dynamic risk management
    this.atr = new ATR({
      period: config.atrPeriod
    });
    
    // Initialize trend SMA if enabled
    if (config.enableTrendConfirmation) {
      this.trendSma = new SimpleMovingAverage({
        period: config.trendSmaPeriod,
        priceType: 'close'
      });
    }
    
    this.emit('initialized', {
      strategy: 'MACD Trend',
      fastPeriod: config.macdFastPeriod,
      slowPeriod: config.macdSlowPeriod,
      signalPeriod: config.macdSignalPeriod
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
      
      // Generate signal based on MACD trend analysis
      const signal = await this.generateSignal(context);
      
      // Validate and enhance signal if generated
      if (signal) {
        const isValid = await this.validateSignal(signal, context);
        if (!isValid) {
          return null;
        }
        
        // Calculate position size and set risk levels
        const positionSize = await this.calculatePositionSize(signal, context);
        const macdValues = this.macd.getCurrentValues();
        
        signal.metadata = {
          ...signal.metadata,
          positionSize,
          macdValue: macdValues?.macd,
          signalValue: macdValues?.signal,
          histogramValue: macdValues?.histogram,
          atrValue: this.atr.getLatestResult()?.value,
          histogramTrend: this.macd.getHistogramTrend(this.config.histogramLookback),
          oscillatorStrength: this.macd.getOscillatorStrength(),
          volumeMultiple: this.calculateVolumeMultiple(),
          candlesSinceLastCrossover: this.getCandlesSinceLastCrossover()
        };
        
        // Track crossover
        this.lastCrossoverType = signal.type === 'BUY' ? 'bullish' : 'bearish';
        this.lastCrossoverCandle = this.currentCandleCount;
      }
      
      return signal;
      
    } catch (error) {
      this.emit('error', new Error(
        `MACD Trend execution failed: ${error instanceof Error ? error.message : String(error)}`
      ));
      return null;
    }
  }

  /**
   * Cleanup strategy resources
   */
  async cleanup(): Promise<void> {
    // Reset indicators
    this.macd.reset();
    this.atr.reset();
    if (this.trendSma) {
      this.trendSma.reset();
    }
    
    // Clear state
    this.macdHistory = [];
    this.priceHistory = [];
    this.volumeHistory = [];
    this.lastCrossoverType = null;
    this.lastCrossoverCandle = undefined;
    this.currentCandleCount = 0;
    
    this.emit('cleanup', { strategy: 'MACD Trend' });
  }

  /**
   * Generate trading signal based on MACD trend analysis
   */
  async generateSignal(context: StrategyContext): Promise<StrategySignal | null> {
    const config = this.config as MACDTrendConfig;
    
    // Get latest indicator values
    const macdValues = this.macd.getCurrentValues();
    const atrResult = this.atr.getLatestResult();
    const trendSmaResult = this.trendSma?.getLatestResult();
    
    // Ensure MACD and ATR are ready
    if (!macdValues || !atrResult?.isValid) {
      return null;
    }
    
    const { macd: macdLine, signal: signalLine, histogram } = macdValues;
    const atrValue = atrResult.value as number;
    const currentPrice = context.marketData.currentPrice;
    const trendSmaValue = trendSmaResult?.value as number;
    
    // Detect MACD crossover signals
    const crossoverSignal = this.detectMACDCrossover();
    if (!crossoverSignal) {
      return null;
    }
    
    // Apply histogram threshold filter
    if (Math.abs(histogram) < config.minHistogramThreshold) {
      return null;
    }
    
    // Apply zero-line confirmation filter
    if (config.enableZeroLineConfirmation) {
      if (!this.confirmZeroLineBias(crossoverSignal, macdLine)) {
        return null;
      }
    }
    
    // Apply trend confirmation filter
    if (config.enableTrendConfirmation && trendSmaValue) {
      if (!this.confirmTrendAlignment(crossoverSignal, currentPrice, trendSmaValue)) {
        return null;
      }
    }
    
    // Apply histogram divergence confirmation
    if (config.enableHistogramDivergence) {
      if (!this.confirmHistogramDivergence(crossoverSignal)) {
        return null;
      }
    }
    
    // Apply volume confirmation filter
    if (config.enableVolumeConfirmation) {
      if (!this.confirmVolume()) {
        return null;
      }
    }
    
    // Check for recent crossovers (avoid whipsaws)
    if (this.hasRecentCrossover()) {
      return null;
    }
    
    // Calculate signal strength and confidence
    const signalStrength = this.calculateSignalStrength(
      macdLine, signalLine, histogram, currentPrice, trendSmaValue, context
    );
    
    if (signalStrength < config.minSignalStrength) {
      return null;
    }
    
    // Create trading signal
    const signal: StrategySignal = {
      id: `macd_trend_${this.strategyId}_${Date.now()}`,
      strategyId: this.strategyId,
      timestamp: new Date(),
      type: crossoverSignal,
      symbol: context.marketData.symbol,
      confidence: this.calculateConfidence(signalStrength, macdLine, context),
      strength: signalStrength,
      timeframe: context.marketData.timeframe,
      
      // Price levels
      entryPrice: currentPrice,
      stopLoss: this.calculateStopLoss(crossoverSignal, currentPrice, atrValue),
      takeProfit: this.calculateTakeProfit(crossoverSignal, currentPrice, atrValue),
      
      // Risk management
      maxRisk: config.riskProfile.maxRiskPerTrade,
      
      // Signal details
      reasoning: this.generateReasoning(crossoverSignal, macdLine, signalLine, histogram, signalStrength),
      indicators: {
        macd: macdLine,
        signal: signalLine,
        histogram,
        atr: atrValue,
        trendSma: trendSmaValue,
        volume: context.marketData.volume24h
      },
      conditions: ['macd_crossover'],
      source: 'technical',
      priority: this.determinePriority(signalStrength, histogram),
      isValid: true,
      
      metadata: {
        crossoverType: crossoverSignal === 'BUY' ? 'bullish_crossover' : 'bearish_crossover',
        macdPosition: macdLine > 0 ? 'above_zero' : 'below_zero',
        histogramTrend: this.macd.getHistogramTrend(config.histogramLookback),
        oscillatorStrength: this.macd.getOscillatorStrength(),
        signalStrength,
        zeroLineConfirmed: this.confirmZeroLineBias(crossoverSignal, macdLine),
        trendConfirmed: config.enableTrendConfirmation ? 
          this.confirmTrendAlignment(crossoverSignal, currentPrice, trendSmaValue) : true,
        volumeConfirmed: this.confirmVolume(),
        histogramDivergenceConfirmed: this.confirmHistogramDivergence(crossoverSignal)
      }
    };
    
    return signal;
  }

  /**
   * Validate generated signal against strategy rules
   */
  async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    const config = this.config as MACDTrendConfig;
    
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
    
    return true;
  }

  /**
   * Calculate optimal position size based on risk parameters
   */
  async calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number> {
    const config = this.config as MACDTrendConfig;
    const riskPerTrade = config.riskProfile.maxRiskPerTrade / 100;
    const accountBalance = context.portfolio.total_value;
    
    // Calculate position size based on stop loss distance
    const stopDistance = Math.abs(signal.entryPrice! - signal.stopLoss!);
    const riskAmount = accountBalance * riskPerTrade;
    
    // Adjust position size based on MACD strength
    const oscillatorStrength = this.macd.getOscillatorStrength();
    const sizeMultiplier = 0.8 + (oscillatorStrength * 0.4); // 0.8x to 1.2x multiplier
    
    // Position size = Risk Amount / Risk per Unit * Multiplier
    const basePositionSize = (riskAmount / stopDistance) * sizeMultiplier;
    
    // Apply position size limits
    const minSize = config.execution.minPositionSize || 0.01;
    const maxSize = Math.min(
      accountBalance * 0.1, // Max 10% of account per trade
      config.execution.maxPositionSize || accountBalance * 0.05
    );
    
    return Math.max(minSize, Math.min(maxSize, basePositionSize));
  }

  /**
   * Determine if existing position should be exited
   */
  async shouldExitPosition(position: Position, context: StrategyContext): Promise<boolean> {
    const config = this.config as MACDTrendConfig;
    
    // Update indicators with latest data
    await this.updateIndicators(context.marketData.candles);
    
    const macdValues = this.macd.getCurrentValues();
    if (!macdValues) {
      return false;
    }
    
    const { macd: macdLine, signal: signalLine, histogram } = macdValues;
    const currentPrice = context.marketData.currentPrice;
    
    // Exit on opposite MACD crossover
    const crossoverSignal = this.detectMACDCrossover();
    if (crossoverSignal) {
      if (
        (position.side === 'LONG' && crossoverSignal === 'SELL') ||
        (position.side === 'SHORT' && crossoverSignal === 'BUY')
      ) {
        return true;
      }
    }
    
    // Exit on histogram reversal if enabled
    if (config.enableHistogramExit) {
      const histogramTrend = this.macd.getHistogramTrend(config.histogramLookback);
      
      if (position.side === 'LONG' && histogramTrend === 'decreasing' && histogram < 0) {
        return true;
      }
      
      if (position.side === 'SHORT' && histogramTrend === 'increasing' && histogram > 0) {
        return true;
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
  private validateConfiguration(config: MACDTrendConfig): void {
    if (config.macdFastPeriod >= config.macdSlowPeriod) {
      throw new Error('MACD fast period must be less than slow period');
    }
    
    if (config.macdSignalPeriod <= 0) {
      throw new Error('MACD signal period must be positive');
    }
    
    if (config.minHistogramThreshold < 0) {
      throw new Error('Minimum histogram threshold must be non-negative');
    }
    
    if (config.minVolumeMultiple < 1) {
      throw new Error('Minimum volume multiple must be >= 1');
    }
    
    if (config.histogramLookback <= 0) {
      throw new Error('Histogram lookback period must be positive');
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
    this.macd.update(ohlcvData);
    this.atr.update(ohlcvData);
    
    if (this.trendSma) {
      this.trendSma.update(ohlcvData);
    }
  }

  /**
   * Update strategy state history for analysis
   */
  private updateStateHistory(context: StrategyContext): void {
    const macdValues = this.macd.getCurrentValues();
    const currentPrice = context.marketData.currentPrice;
    const currentVolume = context.marketData.volume24h;
    
    if (macdValues) {
      this.macdHistory.push(macdValues);
    }
    
    this.priceHistory.push(currentPrice);
    this.volumeHistory.push(currentVolume);
    
    // Keep history manageable (last 50 periods)
    if (this.macdHistory.length > 50) {
      this.macdHistory.shift();
    }
    if (this.priceHistory.length > 50) {
      this.priceHistory.shift();
    }
    if (this.volumeHistory.length > 50) {
      this.volumeHistory.shift();
    }
  }

  /**
   * Detect MACD line and signal line crossovers
   */
  private detectMACDCrossover(): StrategySignalType | null {
    if (this.macdHistory.length < 2) {
      return null;
    }
    
    const current = this.macdHistory[this.macdHistory.length - 1];
    const previous = this.macdHistory[this.macdHistory.length - 2];
    
    // Bullish crossover: MACD crosses above Signal
    if (previous.macd <= previous.signal && current.macd > current.signal) {
      return 'BUY';
    }
    
    // Bearish crossover: MACD crosses below Signal
    if (previous.macd >= previous.signal && current.macd < current.signal) {
      return 'SELL';
    }
    
    return null;
  }

  /**
   * Confirm zero-line bias for trend alignment
   */
  private confirmZeroLineBias(signalType: StrategySignalType, macdLine: number): boolean {
    if (signalType === 'BUY') {
      // For bullish signals, prefer MACD above zero line (or close to it)
      return macdLine >= -Math.abs(macdLine) * 0.2; // Allow slight negative for early entries
    } else {
      // For bearish signals, prefer MACD below zero line (or close to it)
      return macdLine <= Math.abs(macdLine) * 0.2; // Allow slight positive for early entries
    }
  }

  /**
   * Confirm trend alignment using SMA
   */
  private confirmTrendAlignment(signalType: StrategySignalType, currentPrice: number, trendSma: number): boolean {
    if (!trendSma) {
      return true;
    }
    
    if (signalType === 'BUY') {
      return currentPrice > trendSma * 0.995; // Allow small tolerance below SMA
    } else {
      return currentPrice < trendSma * 1.005; // Allow small tolerance above SMA
    }
  }

  /**
   * Confirm histogram divergence supporting the signal
   */
  private confirmHistogramDivergence(signalType: StrategySignalType): boolean {
    const config = this.config as MACDTrendConfig;
    
    if (this.macdHistory.length < config.histogramLookback || this.priceHistory.length < config.histogramLookback) {
      return true; // Assume valid if not enough data
    }
    
    const recentMacd = this.macdHistory.slice(-config.histogramLookback);
    const recentPrices = this.priceHistory.slice(-config.histogramLookback);
    
    // Calculate trends
    const histogramTrend = this.calculateTrend(recentMacd.map(m => m.histogram));
    const priceTrend = this.calculateTrend(recentPrices);
    
    // For BUY signals, look for bullish divergence or alignment
    if (signalType === 'BUY') {
      return histogramTrend >= 0 || (priceTrend < 0 && histogramTrend > 0); // Bullish divergence
    }
    
    // For SELL signals, look for bearish divergence or alignment
    if (signalType === 'SELL') {
      return histogramTrend <= 0 || (priceTrend > 0 && histogramTrend < 0); // Bearish divergence
    }
    
    return true;
  }

  /**
   * Confirm signal with volume analysis
   */
  private confirmVolume(): boolean {
    const config = this.config as MACDTrendConfig;
    
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
   * Check for recent crossovers to avoid whipsaws
   */
  private hasRecentCrossover(): boolean {
    return this.lastCrossoverCandle && 
           (this.currentCandleCount - this.lastCrossoverCandle) < 3;
  }

  /**
   * Calculate signal strength based on multiple factors
   */
  private calculateSignalStrength(
    macdLine: number,
    signalLine: number,
    histogram: number,
    currentPrice: number,
    trendSma: number,
    context: StrategyContext
  ): number {
    let strength = 50; // Base strength
    
    // MACD-Signal separation strength
    const separation = Math.abs(macdLine - signalLine);
    const macdMagnitude = Math.max(Math.abs(macdLine), Math.abs(signalLine), 0.001);
    const separationRatio = separation / macdMagnitude;
    strength += Math.min(15, separationRatio * 300); // Up to 15 points
    
    // Histogram strength
    const histogramStrength = Math.abs(histogram) / (Math.abs(macdLine) + 0.001);
    strength += Math.min(10, histogramStrength * 100); // Up to 10 points
    
    // Zero-line alignment
    if ((macdLine > 0 && histogram > 0) || (macdLine < 0 && histogram < 0)) {
      strength += 5; // Trend alignment bonus
    }
    
    // Oscillator strength
    const oscillatorStrength = this.macd.getOscillatorStrength();
    strength += oscillatorStrength * 10; // Up to 10 points
    
    // Trend confirmation
    if (trendSma && trendSma > 0) {
      const trendAlignment = Math.abs(currentPrice - trendSma) / trendSma;
      strength += Math.min(5, trendAlignment * 100); // Up to 5 points
    }
    
    // Volume confirmation
    if (this.confirmVolume()) {
      strength += 5;
    }
    
    // Histogram trend confirmation
    const histogramTrend = this.macd.getHistogramTrend(this.config.histogramLookback);
    if (
      (histogram > 0 && histogramTrend === 'increasing') ||
      (histogram < 0 && histogramTrend === 'decreasing')
    ) {
      strength += 5;
    }
    
    return Math.min(100, Math.max(0, strength));
  }

  /**
   * Calculate confidence score for signal
   */
  private calculateConfidence(signalStrength: number, macdLine: number, context: StrategyContext): number {
    let confidence = signalStrength;
    
    // Boost confidence for strong MACD values
    const macdStrength = Math.abs(macdLine);
    if (macdStrength > 0.01) {
      confidence *= 1.05;
    }
    
    // Adjust based on market conditions
    if (context.marketConditions) {
      switch (context.marketConditions.volatility) {
        case 'low':
          confidence *= 1.05; // More confident in trending markets with low volatility
          break;
        case 'high':
          confidence *= 0.95; // Less confident in high volatility
          break;
      }
      
      switch (context.marketConditions.trend) {
        case 'strong_bullish':
        case 'strong_bearish':
          confidence *= 1.1; // More confident with strong trends
          break;
        case 'ranging':
          confidence *= 0.9; // Less confident in ranging market
          break;
      }
    }
    
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Calculate stop loss level using ATR
   */
  private calculateStopLoss(signalType: StrategySignalType, entryPrice: number, atrValue: number): number {
    const config = this.config as MACDTrendConfig;
    const stopDistance = atrValue * config.atrStopMultiplier;
    
    if (signalType === 'BUY') {
      return entryPrice - stopDistance;
    } else {
      return entryPrice + stopDistance;
    }
  }

  /**
   * Calculate take profit level using ATR
   */
  private calculateTakeProfit(signalType: StrategySignalType, entryPrice: number, atrValue: number): number {
    const config = this.config as MACDTrendConfig;
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
   * Get candles since last crossover
   */
  private getCandlesSinceLastCrossover(): number {
    return this.lastCrossoverCandle ? 
           this.currentCandleCount - this.lastCrossoverCandle : 999;
  }

  /**
   * Calculate trend of an array of values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }
    
    const first = values[0];
    const last = values[values.length - 1];
    return last - first;
  }

  /**
   * Generate reasoning text for signal
   */
  private generateReasoning(
    signalType: StrategySignalType,
    macdLine: number,
    signalLine: number,
    histogram: number,
    strength: number
  ): string {
    const direction = signalType === 'BUY' ? 'bullish' : 'bearish';
    const crossType = signalType === 'BUY' ? 'above' : 'below';
    const position = macdLine > 0 ? 'above zero line' : 'below zero line';
    
    return `${direction.charAt(0).toUpperCase() + direction.slice(1)} MACD crossover detected. ` +
           `MACD line (${macdLine.toFixed(4)}) crossed ${crossType} signal line (${signalLine.toFixed(4)}) ` +
           `with histogram at ${histogram.toFixed(4)}. MACD is ${position}. Signal strength: ${strength.toFixed(1)}%.`;
  }

  /**
   * Determine signal priority based on strength and position
   */
  private determinePriority(strength: number, histogram: number): 'low' | 'medium' | 'high' {
    const histogramStrength = Math.abs(histogram);
    
    if (strength >= 80 && histogramStrength > 0.01) return 'high';
    if (strength >= 70) return 'medium';
    return 'low';
  }
}

export default MACDTrendStrategy;