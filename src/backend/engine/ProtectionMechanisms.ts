/**
 * Protection Mechanisms - Task BE-020
 * 
 * Advanced protection system that provides additional layers of risk mitigation
 * beyond basic risk management. Includes drawdown protection, stop-loss enforcement,
 * cooldown management, and profit filtering to protect capital and optimize strategy performance.
 * 
 * Features:
 * - Drawdown protection with automatic trading suspension
 * - Stop-loss guard system with enforcement mechanisms
 * - Cooldown period management after losses or poor performance
 * - Low-profit pair filtering to avoid unfavorable market conditions
 * - Dynamic protection level adjustment based on market conditions
 * - Integration with risk controller and strategy engine
 */

import { EventEmitter } from 'events';
import type {
  StrategySignal,
  StrategyContext,
  Position,
  StrategyMetrics
} from '../strategies/types.js';
import type { RiskController, PortfolioRiskMetrics } from './RiskController.js';
import type { TradeRepository } from '../repositories/index.js';

/**
 * Protection Status
 */
export type ProtectionStatus = 'active' | 'suspended' | 'cooling_down' | 'filtered' | 'emergency';

/**
 * Protection Level
 */
export type ProtectionLevel = 'minimal' | 'standard' | 'aggressive' | 'maximum';

/**
 * Drawdown Protection Configuration
 */
export interface DrawdownProtectionConfig {
  enabled: boolean;
  maxDailyDrawdown: number;        // Max daily drawdown percentage before suspension
  maxWeeklyDrawdown: number;       // Max weekly drawdown percentage  
  maxMonthlyDrawdown: number;      // Max monthly drawdown percentage
  suspensionDuration: number;      // Duration of trading suspension (ms)
  partialSuspensionThreshold: number; // Threshold for partial position sizing reduction
  emergencyDrawdownLimit: number;  // Emergency stop threshold
  recoveryThreshold: number;       // Recovery threshold to resume trading
}

/**
 * Stop Loss Guard Configuration
 */
export interface StopLossGuardConfig {
  enabled: boolean;
  mandatoryStopLoss: boolean;      // Require stop loss on all positions
  maxRiskPerPosition: number;      // Maximum risk per position without stop loss
  trailingStopEnabled: boolean;    // Enable trailing stop loss
  trailingStopDistance: number;    // Trailing stop distance percentage
  stopLossBuffer: number;          // Buffer percentage for stop loss execution
  emergencyStopEnabled: boolean;   // Enable emergency stops on extreme moves
  slippageBuffer: number;          // Expected slippage buffer
}

/**
 * Cooldown Configuration
 */
export interface CooldownConfig {
  enabled: boolean;
  strategyCooldown: number;        // Cooldown duration per strategy (ms)
  symbolCooldown: number;          // Cooldown duration per symbol (ms)  
  globalCooldown: number;          // Global cooldown after major losses (ms)
  lossThreshold: number;           // Loss threshold to trigger cooldown
  consecutiveLossLimit: number;    // Consecutive losses before cooldown
  performanceBasedCooldown: boolean; // Dynamic cooldown based on performance
  maxCooldownDuration: number;     // Maximum cooldown duration (ms)
}

/**
 * Profit Filter Configuration
 */
export interface ProfitFilterConfig {
  enabled: boolean;
  minExpectedProfit: number;       // Minimum expected profit percentage
  profitProbabilityThreshold: number; // Minimum profit probability
  marketConditionFilter: boolean;   // Filter based on market conditions
  volatilityThreshold: number;     // Volatility threshold for filtering
  liquidityThreshold: number;      // Minimum liquidity requirement
  spreadThreshold: number;         // Maximum spread threshold
  timeOfDayFiltering: boolean;     // Filter based on trading session
  excludedTimeRanges: Array<{      // Time ranges to exclude
    start: string;                 // Start time (HH:MM)
    end: string;                   // End time (HH:MM)
    reason: string;                // Reason for exclusion
  }>;
}

/**
 * Protection Mechanism Configuration
 */
export interface ProtectionMechanismConfig {
  protectionLevel: ProtectionLevel;
  drawdownProtection: DrawdownProtectionConfig;
  stopLossGuard: StopLossGuardConfig;
  cooldown: CooldownConfig;
  profitFilter: ProfitFilterConfig;
  
  // Global settings
  enabled: boolean;
  monitoringInterval: number;      // Protection monitoring interval (ms)
  alertEnabled: boolean;           // Enable protection alerts
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Protection Decision
 */
export interface ProtectionDecision {
  allowed: boolean;
  reasons: string[];
  adjustments: {
    positionSizeMultiplier?: number;
    requiredStopLoss?: number;
    maxHoldingPeriod?: number;
    additionalConditions?: string[];
  };
  protectionLevel: ProtectionLevel;
  timestamp: Date;
}

/**
 * Cooldown Entry
 */
interface CooldownEntry {
  id: string;
  type: 'strategy' | 'symbol' | 'global';
  target: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  triggerEvent: any;
}

/**
 * Drawdown Tracker
 */
class DrawdownTracker {
  private dailyDrawdowns: Map<string, number> = new Map();   // Date -> Drawdown
  private weeklyDrawdowns: Map<string, number> = new Map();  // Week -> Drawdown  
  private monthlyDrawdowns: Map<string, number> = new Map(); // Month -> Drawdown
  private peakValues: Map<string, number> = new Map();       // Period -> Peak Value
  
  updateDrawdown(portfolioValue: number, timestamp: Date): void {
    const dateKey = timestamp.toISOString().split('T')[0];
    const weekKey = this.getWeekKey(timestamp);
    const monthKey = this.getMonthKey(timestamp);
    
    // Update peak values
    this.updatePeak(dateKey, portfolioValue);
    this.updatePeak(weekKey, portfolioValue);  
    this.updatePeak(monthKey, portfolioValue);
    
    // Calculate drawdowns
    this.dailyDrawdowns.set(dateKey, this.calculateDrawdown(dateKey, portfolioValue));
    this.weeklyDrawdowns.set(weekKey, this.calculateDrawdown(weekKey, portfolioValue));
    this.monthlyDrawdowns.set(monthKey, this.calculateDrawdown(monthKey, portfolioValue));
  }
  
  getDailyDrawdown(date?: Date): number {
    const key = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return this.dailyDrawdowns.get(key) || 0;
  }
  
  getWeeklyDrawdown(date?: Date): number {
    const key = this.getWeekKey(date || new Date());
    return this.weeklyDrawdowns.get(key) || 0;
  }
  
  getMonthlyDrawdown(date?: Date): number {
    const key = this.getMonthKey(date || new Date());
    return this.monthlyDrawdowns.get(key) || 0;
  }
  
  private updatePeak(periodKey: string, value: number): void {
    const currentPeak = this.peakValues.get(periodKey) || 0;
    if (value > currentPeak) {
      this.peakValues.set(periodKey, value);
    }
  }
  
  private calculateDrawdown(periodKey: string, currentValue: number): number {
    const peak = this.peakValues.get(periodKey) || currentValue;
    if (peak <= 0) return 0;
    return Math.max(0, (peak - currentValue) / peak * 100);
  }
  
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }
  
  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  
  private getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  }
}

/**
 * Stop Loss Monitor
 */
class StopLossMonitor {
  private activeStops: Map<string, {
    positionId: string;
    stopPrice: number;
    trailingDistance?: number;
    isTrailing: boolean;
    highWaterMark?: number;
  }> = new Map();
  
  addStopLoss(positionId: string, stopPrice: number, isTrailing = false, trailingDistance?: number): void {
    this.activeStops.set(positionId, {
      positionId,
      stopPrice,
      trailingDistance,
      isTrailing,
      highWaterMark: undefined
    });
  }
  
  updateStopLoss(positionId: string, currentPrice: number, position: Position): void {
    const stop = this.activeStops.get(positionId);
    if (!stop || !stop.isTrailing) return;
    
    const isLong = position.size > 0;
    
    if (!stop.highWaterMark) {
      stop.highWaterMark = currentPrice;
    }
    
    // Update high water mark
    if ((isLong && currentPrice > stop.highWaterMark) || 
        (!isLong && currentPrice < stop.highWaterMark)) {
      stop.highWaterMark = currentPrice;
    }
    
    // Update trailing stop
    if (stop.trailingDistance) {
      const distance = stop.trailingDistance / 100;
      if (isLong) {
        const newStop = stop.highWaterMark * (1 - distance);
        if (newStop > stop.stopPrice) {
          stop.stopPrice = newStop;
        }
      } else {
        const newStop = stop.highWaterMark * (1 + distance);
        if (newStop < stop.stopPrice) {
          stop.stopPrice = newStop;
        }
      }
    }
  }
  
  checkStopLoss(positionId: string, currentPrice: number, position: Position): boolean {
    const stop = this.activeStops.get(positionId);
    if (!stop) return false;
    
    const isLong = position.size > 0;
    return isLong ? currentPrice <= stop.stopPrice : currentPrice >= stop.stopPrice;
  }
  
  removeStopLoss(positionId: string): void {
    this.activeStops.delete(positionId);
  }
  
  getAllStops(): Array<{ positionId: string; stopPrice: number; }> {
    return Array.from(this.activeStops.values())
      .map(stop => ({ positionId: stop.positionId, stopPrice: stop.stopPrice }));
  }
}

/**
 * Main Protection Mechanisms Class
 */
export class ProtectionMechanisms extends EventEmitter {
  private config: ProtectionMechanismConfig;
  private riskController: RiskController;
  private tradeRepository: TradeRepository;
  
  // Protection components  
  private drawdownTracker: DrawdownTracker;
  private stopLossMonitor: StopLossMonitor;
  
  // State tracking
  private protectionStatus: ProtectionStatus = 'active';
  private activeCooldowns: Map<string, CooldownEntry> = new Map();
  private suspendedStrategies: Set<string> = new Set();
  private filteredSymbols: Set<string> = new Set();
  
  // Performance tracking
  private recentTrades: Array<{ timestamp: Date; pnl: number; strategyId: string; symbol: string; }> = [];
  private strategyPerformance: Map<string, { consecutiveLosses: number; lastLossTime?: Date; }> = new Map();
  
  // Monitoring
  private monitoringTimer?: NodeJS.Timeout;
  private lastPortfolioValue?: number;
  
  constructor(
    config: Partial<ProtectionMechanismConfig>,
    riskController: RiskController,
    tradeRepository: TradeRepository
  ) {
    super();
    
    this.riskController = riskController;
    this.tradeRepository = tradeRepository;
    this.drawdownTracker = new DrawdownTracker();
    this.stopLossMonitor = new StopLossMonitor();
    
    this.config = this.mergeWithDefaults(config);
  }
  
  /**
   * Initialize protection mechanisms
   */
  async initialize(): Promise<void> {
    // Start monitoring
    this.startProtectionMonitoring();
    
    // Load recent trade history for performance tracking
    await this.loadRecentTradeHistory();
    
    // Setup risk controller event handlers
    this.setupRiskControllerHandlers();
    
    this.emit('initialized', { protectionLevel: this.config.protectionLevel });
  }
  
  /**
   * Evaluate signal against all protection mechanisms
   */
  async evaluateSignal(signal: StrategySignal, context: StrategyContext): Promise<ProtectionDecision> {
    const decision: ProtectionDecision = {
      allowed: true,
      reasons: [],
      adjustments: {},
      protectionLevel: this.config.protectionLevel,
      timestamp: new Date()
    };
    
    try {
      // Check drawdown protection
      if (!await this.checkDrawdownProtection(signal, decision)) {
        decision.allowed = false;
      }
      
      // Check cooldown periods
      if (!await this.checkCooldownStatus(signal, decision)) {
        decision.allowed = false;
      }
      
      // Apply profit filtering
      if (!await this.checkProfitFilter(signal, context, decision)) {
        decision.allowed = false;
      }
      
      // Apply stop loss requirements
      await this.applyStopLossGuard(signal, decision);
      
      // Log protection decision
      this.logProtectionDecision(signal, decision);
      
      return decision;
      
    } catch (error) {
      this.emit('protection_error', {
        signal,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Default to rejection on error
      return {
        allowed: false,
        reasons: ['Protection mechanism error'],
        adjustments: {},
        protectionLevel: this.config.protectionLevel,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Update position tracking for stop loss monitoring
   */
  updatePosition(position: Position, currentPrice: number): void {
    // Update stop loss monitoring
    this.stopLossMonitor.updateStopLoss(position.id, currentPrice, position);
    
    // Check for stop loss trigger
    if (this.stopLossMonitor.checkStopLoss(position.id, currentPrice, position)) {
      this.emit('stop_loss_triggered', {
        positionId: position.id,
        currentPrice,
        stopPrice: this.stopLossMonitor.getAllStops()
          .find(s => s.positionId === position.id)?.stopPrice
      });
    }
  }
  
  /**
   * Record trade completion for performance tracking
   */
  recordTradeCompletion(trade: {
    strategyId: string;
    symbol: string;
    pnl: number;
    timestamp: Date;
  }): void {
    // Add to recent trades
    this.recentTrades.push(trade);
    
    // Keep only recent trades (last 1000)
    if (this.recentTrades.length > 1000) {
      this.recentTrades = this.recentTrades.slice(-500);
    }
    
    // Update strategy performance tracking
    this.updateStrategyPerformance(trade);
    
    // Check for cooldown triggers
    this.checkCooldownTriggers(trade);
  }
  
  /**
   * Add position stop loss
   */
  addPositionStopLoss(positionId: string, stopPrice: number, isTrailing = false, trailingDistance?: number): void {
    this.stopLossMonitor.addStopLoss(positionId, stopPrice, isTrailing, trailingDistance);
    
    this.emit('stop_loss_added', {
      positionId,
      stopPrice,
      isTrailing,
      trailingDistance
    });
  }
  
  /**
   * Remove position stop loss
   */
  removePositionStopLoss(positionId: string): void {
    this.stopLossMonitor.removeStopLoss(positionId);
    this.emit('stop_loss_removed', { positionId });
  }
  
  /**
   * Get protection status
   */
  getProtectionStatus(): {
    status: ProtectionStatus;
    drawdowns: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    activeCooldowns: Array<{
      id: string;
      type: string;
      target: string;
      remainingTime: number;
      reason: string;
    }>;
    suspendedStrategies: string[];
    filteredSymbols: string[];
    activeStopLosses: number;
  } {
    return {
      status: this.protectionStatus,
      drawdowns: {
        daily: this.drawdownTracker.getDailyDrawdown(),
        weekly: this.drawdownTracker.getWeeklyDrawdown(),
        monthly: this.drawdownTracker.getMonthlyDrawdown()
      },
      activeCooldowns: Array.from(this.activeCooldowns.values()).map(cooldown => ({
        id: cooldown.id,
        type: cooldown.type,
        target: cooldown.target,
        remainingTime: Math.max(0, cooldown.endTime.getTime() - Date.now()),
        reason: cooldown.reason
      })),
      suspendedStrategies: Array.from(this.suspendedStrategies),
      filteredSymbols: Array.from(this.filteredSymbols),
      activeStopLosses: this.stopLossMonitor.getAllStops().length
    };
  }
  
  /**
   * Update protection configuration
   */
  updateConfig(newConfig: Partial<ProtectionMechanismConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring with new configuration
    this.stopProtectionMonitoring();
    this.startProtectionMonitoring();
    
    this.emit('config_updated', { newConfig });
  }
  
  /**
   * Force remove cooldown
   */
  removeCooldown(cooldownId: string): boolean {
    const removed = this.activeCooldowns.delete(cooldownId);
    if (removed) {
      this.emit('cooldown_removed', { cooldownId });
    }
    return removed;
  }
  
  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.stopProtectionMonitoring();
    this.emit('cleanup_completed');
  }
  
  // === PRIVATE METHODS ===
  
  private async checkDrawdownProtection(signal: StrategySignal, decision: ProtectionDecision): Promise<boolean> {
    if (!this.config.drawdownProtection.enabled) return true;
    
    const config = this.config.drawdownProtection;
    const daily = this.drawdownTracker.getDailyDrawdown();
    const weekly = this.drawdownTracker.getWeeklyDrawdown();  
    const monthly = this.drawdownTracker.getMonthlyDrawdown();
    
    // Check emergency drawdown limit
    if (daily >= config.emergencyDrawdownLimit) {
      this.protectionStatus = 'emergency';
      decision.reasons.push(`Emergency drawdown limit reached: ${daily.toFixed(2)}%`);
      return false;
    }
    
    // Check suspension thresholds
    if (daily >= config.maxDailyDrawdown) {
      decision.reasons.push(`Daily drawdown limit exceeded: ${daily.toFixed(2)}%`);
      this.suspendTrading('daily_drawdown', config.suspensionDuration);
      return false;
    }
    
    if (weekly >= config.maxWeeklyDrawdown) {
      decision.reasons.push(`Weekly drawdown limit exceeded: ${weekly.toFixed(2)}%`);
      this.suspendTrading('weekly_drawdown', config.suspensionDuration);
      return false;
    }
    
    if (monthly >= config.maxMonthlyDrawdown) {
      decision.reasons.push(`Monthly drawdown limit exceeded: ${monthly.toFixed(2)}%`);
      this.suspendTrading('monthly_drawdown', config.suspensionDuration);
      return false;
    }
    
    // Check partial suspension threshold
    if (daily >= config.partialSuspensionThreshold) {
      const reductionFactor = 1 - (daily - config.partialSuspensionThreshold) / 
                             (config.maxDailyDrawdown - config.partialSuspensionThreshold);
      decision.adjustments.positionSizeMultiplier = Math.max(0.1, reductionFactor);
      decision.reasons.push(`Position size reduced due to drawdown: ${daily.toFixed(2)}%`);
    }
    
    return true;
  }
  
  private async checkCooldownStatus(signal: StrategySignal, decision: ProtectionDecision): Promise<boolean> {
    if (!this.config.cooldown.enabled) return true;
    
    const now = new Date();
    
    // Check global cooldown
    const globalCooldown = this.activeCooldowns.get('global');
    if (globalCooldown && now < globalCooldown.endTime) {
      decision.reasons.push(`Global cooldown active until ${globalCooldown.endTime.toISOString()}`);
      return false;
    }
    
    // Check strategy cooldown
    const strategyCooldown = this.activeCooldowns.get(`strategy_${signal.strategyId}`);
    if (strategyCooldown && now < strategyCooldown.endTime) {
      decision.reasons.push(`Strategy cooldown active until ${strategyCooldown.endTime.toISOString()}`);
      return false;
    }
    
    // Check symbol cooldown
    const symbolCooldown = this.activeCooldowns.get(`symbol_${signal.symbol}`);
    if (symbolCooldown && now < symbolCooldown.endTime) {
      decision.reasons.push(`Symbol cooldown active until ${symbolCooldown.endTime.toISOString()}`);
      return false;
    }
    
    return true;
  }
  
  private async checkProfitFilter(signal: StrategySignal, context: StrategyContext, decision: ProtectionDecision): Promise<boolean> {
    if (!this.config.profitFilter.enabled) return true;
    
    const config = this.config.profitFilter;
    
    // Check minimum expected profit
    if (signal.expectedProfit && signal.expectedProfit < config.minExpectedProfit) {
      decision.reasons.push(`Expected profit too low: ${signal.expectedProfit}% < ${config.minExpectedProfit}%`);
      return false;
    }
    
    // Check profit probability
    if (signal.confidence < config.profitProbabilityThreshold) {
      decision.reasons.push(`Signal confidence too low: ${signal.confidence}% < ${config.profitProbabilityThreshold}%`);
      return false;
    }
    
    // Check market conditions
    if (config.marketConditionFilter && context.marketConditions) {
      const conditions = context.marketConditions;
      
      // Volatility check
      if (conditions.volatility === 'high' && config.volatilityThreshold > 0) {
        decision.reasons.push('High volatility market conditions filtered');
        return false;
      }
      
      // Liquidity check
      if (conditions.liquidity === 'low' && config.liquidityThreshold > 0) {
        decision.reasons.push('Low liquidity market conditions filtered');
        return false;
      }
    }
    
    // Check time of day filtering
    if (config.timeOfDayFiltering && this.isInExcludedTimeRange(new Date(), config.excludedTimeRanges)) {
      decision.reasons.push('Signal filtered due to excluded time range');
      return false;
    }
    
    return true;
  }
  
  private async applyStopLossGuard(signal: StrategySignal, decision: ProtectionDecision): Promise<void> {
    if (!this.config.stopLossGuard.enabled) return;
    
    const config = this.config.stopLossGuard;
    
    // Check for mandatory stop loss
    if (config.mandatoryStopLoss && !signal.stopLoss) {
      if (signal.entryPrice) {
        // Calculate required stop loss
        const riskPercent = config.maxRiskPerPosition / 100;
        const direction = signal.type === 'BUY' ? -1 : 1;
        const stopLoss = signal.entryPrice * (1 + direction * riskPercent);
        
        decision.adjustments.requiredStopLoss = stopLoss;
        decision.reasons.push(`Added mandatory stop loss at ${stopLoss.toFixed(6)}`);
      }
    }
    
    // Apply stop loss buffer
    if (signal.stopLoss && config.stopLossBuffer > 0) {
      const bufferPercent = config.stopLossBuffer / 100;
      const direction = signal.type === 'BUY' ? -1 : 1;
      const adjustedStopLoss = signal.stopLoss * (1 + direction * bufferPercent);
      
      decision.adjustments.requiredStopLoss = adjustedStopLoss;
      decision.reasons.push(`Applied stop loss buffer: ${config.stopLossBuffer}%`);
    }
  }
  
  private suspendTrading(reason: string, duration: number): void {
    this.protectionStatus = 'suspended';
    
    const cooldown: CooldownEntry = {
      id: `suspension_${Date.now()}`,
      type: 'global',
      target: 'all',
      startTime: new Date(),
      endTime: new Date(Date.now() + duration),
      reason,
      triggerEvent: { type: 'drawdown_suspension' }
    };
    
    this.activeCooldowns.set('global', cooldown);
    
    this.emit('trading_suspended', {
      reason,
      duration,
      until: cooldown.endTime
    });
  }
  
  private updateStrategyPerformance(trade: { strategyId: string; pnl: number; timestamp: Date; }): void {
    const performance = this.strategyPerformance.get(trade.strategyId) || {
      consecutiveLosses: 0
    };
    
    if (trade.pnl < 0) {
      performance.consecutiveLosses++;
      performance.lastLossTime = trade.timestamp;
    } else {
      performance.consecutiveLosses = 0;
    }
    
    this.strategyPerformance.set(trade.strategyId, performance);
  }
  
  private checkCooldownTriggers(trade: { strategyId: string; symbol: string; pnl: number; timestamp: Date; }): void {
    if (!this.config.cooldown.enabled) return;
    
    const config = this.config.cooldown;
    const performance = this.strategyPerformance.get(trade.strategyId);
    
    // Check for consecutive loss cooldown
    if (performance && performance.consecutiveLosses >= config.consecutiveLossLimit) {
      this.addCooldown(
        `strategy_${trade.strategyId}`,
        'strategy',
        trade.strategyId,
        config.strategyCooldown,
        `${performance.consecutiveLosses} consecutive losses`
      );
    }
    
    // Check for loss threshold cooldown
    if (trade.pnl < -Math.abs(config.lossThreshold)) {
      this.addCooldown(
        `symbol_${trade.symbol}`,
        'symbol',
        trade.symbol,
        config.symbolCooldown,
        `Large loss: ${trade.pnl.toFixed(2)}`
      );
    }
  }
  
  private addCooldown(id: string, type: 'strategy' | 'symbol' | 'global', target: string, duration: number, reason: string): void {
    const cooldown: CooldownEntry = {
      id,
      type,
      target,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration),
      reason,
      triggerEvent: { type: 'cooldown_trigger' }
    };
    
    this.activeCooldowns.set(id, cooldown);
    
    this.emit('cooldown_added', {
      id,
      type,
      target,
      duration,
      reason
    });
  }
  
  private isInExcludedTimeRange(timestamp: Date, excludedRanges: Array<{ start: string; end: string; reason: string; }>): boolean {
    const timeString = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
    
    return excludedRanges.some(range => {
      return timeString >= range.start && timeString <= range.end;
    });
  }
  
  private startProtectionMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.performProtectionMonitoring().catch(error => {
        this.emit('monitoring_error', error);
      });
    }, this.config.monitoringInterval);
  }
  
  private stopProtectionMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }
  
  private async performProtectionMonitoring(): Promise<void> {
    // Update drawdown tracking
    const riskMetrics = await this.riskController.getCurrentRiskMetrics();
    this.drawdownTracker.updateDrawdown(riskMetrics.totalValue, new Date());
    
    // Clean up expired cooldowns
    this.cleanupExpiredCooldowns();
    
    // Check for recovery conditions
    this.checkRecoveryConditions();
  }
  
  private cleanupExpiredCooldowns(): void {
    const now = new Date();
    const expiredCooldowns = [];
    
    for (const [id, cooldown] of this.activeCooldowns) {
      if (now >= cooldown.endTime) {
        expiredCooldowns.push(id);
      }
    }
    
    for (const id of expiredCooldowns) {
      this.activeCooldowns.delete(id);
      this.emit('cooldown_expired', { id });
    }
  }
  
  private checkRecoveryConditions(): void {
    if (this.protectionStatus === 'suspended') {
      const config = this.config.drawdownProtection;
      const currentDrawdown = this.drawdownTracker.getDailyDrawdown();
      
      if (currentDrawdown <= config.recoveryThreshold && !this.activeCooldowns.has('global')) {
        this.protectionStatus = 'active';
        this.emit('trading_resumed', {
          reason: 'Drawdown recovery',
          currentDrawdown
        });
      }
    }
  }
  
  private async loadRecentTradeHistory(): Promise<void> {
    try {
      // Load recent trades from repository (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // This would be implemented with actual repository call
      // For now, initialize with empty array
      this.recentTrades = [];
      
    } catch (error) {
      this.emit('trade_history_load_error', error);
    }
  }
  
  private setupRiskControllerHandlers(): void {
    this.riskController.on('emergency_stop_activated', () => {
      this.protectionStatus = 'emergency';
      this.emit('emergency_protection_activated');
    });
    
    this.riskController.on('risk_threshold_exceeded', (event: any) => {
      if (event.category === 'portfolio' && event.severity === 'critical') {
        this.suspendTrading('Portfolio risk threshold exceeded', this.config.cooldown.globalCooldown);
      }
    });
  }
  
  private logProtectionDecision(signal: StrategySignal, decision: ProtectionDecision): void {
    if (this.config.logLevel === 'debug' || (!decision.allowed && this.config.logLevel !== 'error')) {
      this.emit('protection_decision', {
        signalId: signal.id,
        strategyId: signal.strategyId,
        symbol: signal.symbol,
        decision
      });
    }
  }
  
  private mergeWithDefaults(config: Partial<ProtectionMechanismConfig>): ProtectionMechanismConfig {
    return {
      protectionLevel: 'standard',
      enabled: true,
      monitoringInterval: 60000, // 1 minute
      alertEnabled: true,
      logLevel: 'info',
      drawdownProtection: {
        enabled: true,
        maxDailyDrawdown: 5.0,      // 5% max daily drawdown
        maxWeeklyDrawdown: 10.0,    // 10% max weekly drawdown
        maxMonthlyDrawdown: 20.0,   // 20% max monthly drawdown
        suspensionDuration: 3600000, // 1 hour suspension
        partialSuspensionThreshold: 3.0, // 3% partial suspension
        emergencyDrawdownLimit: 15.0, // 15% emergency limit
        recoveryThreshold: 2.0,     // 2% recovery threshold
        ...config.drawdownProtection
      },
      stopLossGuard: {
        enabled: true,
        mandatoryStopLoss: true,
        maxRiskPerPosition: 2.0,    // 2% max risk without stop loss
        trailingStopEnabled: true,
        trailingStopDistance: 1.5,  // 1.5% trailing distance
        stopLossBuffer: 0.1,        // 0.1% buffer
        emergencyStopEnabled: true,
        slippageBuffer: 0.05,       // 0.05% slippage buffer
        ...config.stopLossGuard
      },
      cooldown: {
        enabled: true,
        strategyCooldown: 1800000,  // 30 minute strategy cooldown
        symbolCooldown: 3600000,    // 1 hour symbol cooldown
        globalCooldown: 7200000,    // 2 hour global cooldown
        lossThreshold: 1000,        // $1000 loss threshold
        consecutiveLossLimit: 3,    // 3 consecutive losses
        performanceBasedCooldown: true,
        maxCooldownDuration: 86400000, // 24 hour max cooldown
        ...config.cooldown
      },
      profitFilter: {
        enabled: true,
        minExpectedProfit: 0.5,     // 0.5% minimum expected profit
        profitProbabilityThreshold: 60, // 60% minimum confidence
        marketConditionFilter: true,
        volatilityThreshold: 50,    // 50% volatility threshold
        liquidityThreshold: 0.7,    // 70% liquidity requirement
        spreadThreshold: 0.1,       // 0.1% spread threshold
        timeOfDayFiltering: false,
        excludedTimeRanges: [],
        ...config.profitFilter
      },
      ...config
    } as ProtectionMechanismConfig;
  }
}

export default ProtectionMechanisms;