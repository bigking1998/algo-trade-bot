/**
 * BaseStrategy Abstract Class - Task BE-007: Base Strategy Interface Design
 * 
 * Abstract base class for all trading strategies providing:
 * - Lifecycle management (initialize, execute, cleanup)
 * - Signal generation framework
 * - Parameter validation and configuration
 * - Performance tracking and metrics collection
 * - Risk management integration
 * - Error handling and recovery
 */

import { EventEmitter } from 'events';
import type {
  StrategyConfig,
  StrategyContext,
  StrategySignal,
  StrategyMetrics,
  StrategyParameter,
  StrategyLifecycleEvent,
  Position,
  MarketDataWindow,
  RiskAssessment,
  StrategyHealthCheck,
  StrategyExecutionOptions
} from './types.js';
import {
  StrategyError,
  StrategyValidationError,
  StrategyExecutionError,
  StrategyTimeoutError
} from './types.js';
import type { PortfolioSnapshot } from '../types/database.js';

/**
 * Strategy execution state
 */
export type StrategyState = 'idle' | 'initializing' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';


/**
 * Abstract BaseStrategy class providing comprehensive strategy framework
 */
export abstract class BaseStrategy extends EventEmitter {
  protected readonly config: StrategyConfig;
  protected readonly strategyId: string;
  protected state: StrategyState = 'idle';
  protected metrics: StrategyMetrics;
  protected lastExecution?: Date;
  protected currentPositions: Map<string, Position> = new Map();
  protected executionCount = 0;
  protected startTime?: Date;
  
  // Strategy dependencies (injected)
  protected riskManager?: RiskManager;
  protected indicatorCalculator?: TechnicalIndicatorCalculator;
  protected portfolioManager?: PortfolioManager;
  protected orderManager?: OrderManager;

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
    this.strategyId = config.id;
    this.metrics = this.initializeMetrics();
  }

  /**
   * ABSTRACT METHODS - Must be implemented by concrete strategies
   */

  /**
   * Initialize strategy-specific resources and dependencies
   */
  abstract initialize(): Promise<void>;

  /**
   * Main strategy execution logic
   * @param context Current market and portfolio context
   * @returns Generated trading signal or null
   */
  abstract execute(context: StrategyContext, options?: StrategyExecutionOptions): Promise<StrategySignal | null>;

  /**
   * Cleanup strategy resources
   */
  abstract cleanup(): Promise<void>;

  /**
   * Generate trading signal based on current context
   * @param context Strategy execution context
   * @returns Trading signal with confidence and metadata
   */
  abstract generateSignal(context: StrategyContext): Promise<StrategySignal | null>;

  /**
   * Validate generated signal before execution
   * @param signal Generated trading signal
   * @param context Current strategy context
   * @returns true if signal is valid for execution
   */
  abstract validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean>;

  /**
   * Calculate position size for a given signal
   * @param signal Trading signal
   * @param context Strategy context with risk metrics
   * @returns Position size in base currency or percentage
   */
  abstract calculatePositionSize(signal: StrategySignal, context: StrategyContext): Promise<number>;

  /**
   * Determine if existing position should be exited
   * @param position Current position
   * @param context Current market context
   * @returns true if position should be closed
   */
  abstract shouldExitPosition(position: Position, context: StrategyContext): Promise<boolean>;

  /**
   * LIFECYCLE MANAGEMENT
   */

  /**
   * Start the strategy with full lifecycle management
   */
  async start(): Promise<void> {
    try {
      this.setState('initializing');
      this.emitLifecycleEvent('initialized');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Initialize strategy
      this.startTime = new Date();
      await this.initialize();
      
      this.setState('running');
      this.emitLifecycleEvent('started');
      
    } catch (error) {
      this.setState('error');
      this.emitLifecycleEvent('error', { error: this.formatError(error) });
      throw new StrategyExecutionError(
        `Failed to start strategy: ${error instanceof Error ? error.message : String(error)}`,
        this.strategyId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Pause the strategy (stops new signals but keeps monitoring)
   */
  async pause(): Promise<void> {
    if (this.state !== 'running') {
      throw new StrategyError('Cannot pause strategy - not in running state', this.strategyId);
    }

    this.setState('paused');
    this.emitLifecycleEvent('paused');
  }

  /**
   * Resume paused strategy
   */
  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      throw new StrategyError('Cannot resume strategy - not in paused state', this.strategyId);
    }

    this.setState('running');
    this.emitLifecycleEvent('started');
  }

  /**
   * Stop the strategy and cleanup resources
   */
  async stop(): Promise<void> {
    try {
      this.setState('stopping');
      
      // Close any open positions if configured to do so
      if (this.config.execution.timeout > 0) {
        await this.closeAllPositions();
      }
      
      await this.cleanup();
      
      this.setState('stopped');
      this.emitLifecycleEvent('stopped');
      
    } catch (error) {
      this.setState('error');
      throw new StrategyExecutionError(
        `Failed to stop strategy: ${error instanceof Error ? error.message : String(error)}`,
        this.strategyId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute strategy with comprehensive error handling and metrics
   */
  async executeStrategy(context: StrategyContext, options: StrategyExecutionOptions = {}): Promise<StrategySignal | null> {
    const startTime = Date.now();
    const executionId = `${this.strategyId}_${Date.now()}`;
    
    try {
      // Check if strategy can execute
      if (this.state !== 'running') {
        return null;
      }

      // Set timeout if specified
      const timeout = options.timeout || this.config.execution.timeout * 1000;
      const timeoutPromise = timeout > 0 
        ? new Promise<never>((_, reject) => 
            setTimeout(() => reject(new StrategyTimeoutError(
              `Strategy execution timed out after ${timeout}ms`,
              this.strategyId,
              timeout
            )), timeout)
          )
        : null;

      // Execute with timeout protection
      const executePromise = this.execute(context, options);
      const signal = timeoutPromise 
        ? await Promise.race([executePromise, timeoutPromise])
        : await executePromise;

      // Update metrics
      this.updateExecutionMetrics(Date.now() - startTime, true);
      this.lastExecution = new Date();

      if (signal) {
        this.emitLifecycleEvent('signal_generated', { signal, executionId });
        this.metrics.signalsGenerated++;
      }

      return signal;

    } catch (error) {
      this.updateExecutionMetrics(Date.now() - startTime, false);
      this.emitLifecycleEvent('error', { 
        error: this.formatError(error),
        executionId,
        context: {
          symbol: context.marketData.symbol,
          timestamp: context.timestamp
        }
      });

      // Re-throw strategy errors, wrap others
      if (error instanceof StrategyError) {
        throw error;
      }

      throw new StrategyExecutionError(
        `Strategy execution failed: ${error instanceof Error ? error.message : String(error)}`,
        this.strategyId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * CONFIGURATION AND VALIDATION
   */

  /**
   * Validate strategy configuration
   */
  protected async validateConfiguration(): Promise<void> {
    const errors: string[] = [];

    // Validate basic configuration
    if (!this.config.name || this.config.name.trim().length === 0) {
      errors.push('Strategy name is required');
    }

    if (!this.config.symbols || this.config.symbols.length === 0) {
      errors.push('At least one symbol must be specified');
    }

    if (!this.config.timeframes || this.config.timeframes.length === 0) {
      errors.push('At least one timeframe must be specified');
    }

    // Validate risk profile
    if (this.config.riskProfile.maxRiskPerTrade <= 0 || this.config.riskProfile.maxRiskPerTrade > 100) {
      errors.push('Maximum risk per trade must be between 0 and 100 percent');
    }

    if (this.config.riskProfile.maxPortfolioRisk <= 0 || this.config.riskProfile.maxPortfolioRisk > 100) {
      errors.push('Maximum portfolio risk must be between 0 and 100 percent');
    }

    // Validate parameters
    for (const [key, param] of Object.entries(this.config.parameters)) {
      const paramErrors = this.validateParameter(key, param);
      errors.push(...paramErrors);
    }

    if (errors.length > 0) {
      throw new StrategyValidationError(
        `Configuration validation failed: ${errors.join(', ')}`,
        this.strategyId
      );
    }
  }

  /**
   * Validate individual parameter
   */
  protected validateParameter(key: string, param: StrategyParameter): string[] {
    const errors: string[] = [];

    // Check required parameters
    if (param.required && (param.value === undefined || param.value === null)) {
      errors.push(`Parameter '${key}' is required`);
      return errors;
    }

    // Type validation
    const actualType = typeof param.value;
    if (param.value !== undefined && actualType !== param.type && param.type !== 'array' && param.type !== 'object') {
      errors.push(`Parameter '${key}' expected type '${param.type}' but got '${actualType}'`);
    }

    // Range validation for numbers
    if (param.type === 'number' && typeof param.value === 'number') {
      if (param.min !== undefined && param.value < param.min) {
        errors.push(`Parameter '${key}' value ${param.value} is below minimum ${param.min}`);
      }
      if (param.max !== undefined && param.value > param.max) {
        errors.push(`Parameter '${key}' value ${param.value} exceeds maximum ${param.max}`);
      }
    }

    // Options validation
    if (param.options && param.options.length > 0) {
      if (!param.options.includes(param.value)) {
        errors.push(`Parameter '${key}' value '${param.value}' is not in allowed options: ${param.options.join(', ')}`);
      }
    }

    // Pattern validation for strings
    if (param.type === 'string' && param.pattern && typeof param.value === 'string') {
      const regex = new RegExp(param.pattern);
      if (!regex.test(param.value)) {
        errors.push(`Parameter '${key}' value '${param.value}' does not match required pattern`);
      }
    }

    return errors;
  }

  /**
   * RISK MANAGEMENT INTEGRATION
   */

  /**
   * Check if trade meets risk management criteria
   */
  protected async checkRiskManagement(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    if (!this.riskManager) {
      return true; // No risk manager configured
    }

    try {
      // Check portfolio-level risk
      const portfolioRisk = this.calculatePortfolioRisk(context);
      if (portfolioRisk > this.config.riskProfile.maxPortfolioRisk) {
        return false;
      }

      // Check position-level risk
      const positionSize = await this.calculatePositionSize(signal, context);
      const positionRisk = this.calculatePositionRisk(signal, positionSize, context);
      if (positionRisk > this.config.riskProfile.maxRiskPerTrade) {
        return false;
      }

      // Check correlation risk
      const correlationRisk = this.calculateCorrelationRisk(signal.symbol, context);
      if (correlationRisk > 0.8) { // Configurable threshold
        return false;
      }

      return true;

    } catch (error) {
      // Log error but don't fail the trade
      this.emit('warning', new StrategyError(
        `Risk management check failed: ${error instanceof Error ? error.message : String(error)}`,
        this.strategyId
      ));
      return true; // Default to allowing trade if risk check fails
    }
  }

  /**
   * Calculate portfolio-level risk exposure
   */
  protected calculatePortfolioRisk(context: StrategyContext): number {
    const totalValue = context.portfolio.total_value;
    const positionsValue = context.portfolio.positions_value;
    const usedMargin = context.riskMetrics.usedMargin;

    return ((positionsValue + usedMargin) / totalValue) * 100;
  }

  /**
   * Calculate position-level risk
   */
  protected calculatePositionRisk(signal: StrategySignal, positionSize: number, context: StrategyContext): number {
    if (!signal.stopLoss || !signal.entryPrice) {
      return this.config.riskProfile.maxRiskPerTrade; // Conservative default
    }

    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const positionValue = positionSize * signal.entryPrice;
    const potentialLoss = positionSize * stopDistance;

    return (potentialLoss / context.portfolio.total_value) * 100;
  }

  /**
   * Calculate correlation risk with existing positions
   */
  protected calculateCorrelationRisk(symbol: string, context: StrategyContext): number {
    // Simplified correlation calculation
    // In production, this would use historical correlation matrices
    const existingSymbols = Array.from(this.currentPositions.keys());
    
    if (existingSymbols.length === 0) {
      return 0;
    }

    // Count same-sector or highly correlated positions
    let correlatedPositions = 0;
    for (const existingSymbol of existingSymbols) {
      if (this.areSymbolsCorrelated(symbol, existingSymbol)) {
        correlatedPositions++;
      }
    }

    return correlatedPositions / (existingSymbols.length + 1);
  }

  /**
   * Check if two symbols are correlated (simplified)
   */
  protected areSymbolsCorrelated(symbol1: string, symbol2: string): boolean {
    // Simplified correlation check - in production this would use real correlation data
    const crypto = ['BTC', 'ETH', 'ADA', 'DOT', 'SOL'];
    const forex = ['EUR', 'GBP', 'JPY', 'CHF', 'CAD'];
    
    const isCrypto1 = crypto.some(c => symbol1.includes(c));
    const isCrypto2 = crypto.some(c => symbol2.includes(c));
    const isForex1 = forex.some(f => symbol1.includes(f));
    const isForex2 = forex.some(f => symbol2.includes(f));

    return (isCrypto1 && isCrypto2) || (isForex1 && isForex2);
  }

  /**
   * POSITION MANAGEMENT
   */

  /**
   * Update position tracking
   */
  protected updatePosition(position: Position): void {
    this.currentPositions.set(position.symbol, position);
    this.emit('position_updated', position);
  }

  /**
   * Remove position from tracking
   */
  protected removePosition(symbol: string): void {
    this.currentPositions.delete(symbol);
    this.emit('position_closed', symbol);
  }

  /**
   * Close all open positions
   */
  protected async closeAllPositions(): Promise<void> {
    const closePromises = Array.from(this.currentPositions.values()).map(position =>
      this.closePosition(position)
    );

    await Promise.allSettled(closePromises);
  }

  /**
   * Close specific position
   */
  protected async closePosition(position: Position): Promise<void> {
    // Implementation would depend on order management system
    // This is a placeholder for the interface
    this.removePosition(position.symbol);
  }

  /**
   * METRICS AND PERFORMANCE TRACKING
   */

  /**
   * Initialize strategy metrics
   */
  protected initializeMetrics(): StrategyMetrics {
    return {
      executionCount: 0,
      averageExecutionTime: 0,
      lastExecutionTime: new Date(),
      successfulExecutions: 0,
      failedExecutions: 0,
      signalsGenerated: 0,
      signalsExecuted: 0,
      signalAccuracy: 0,
      averageConfidence: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      totalPnL: 0,
      averageReturn: 0,
      bestTrade: 0,
      worstTrade: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      volatility: 0,
      averageHoldingPeriod: 0,
      maxHoldingPeriod: 0,
      minHoldingPeriod: 0,
      tradingFrequency: 0,
      capitalEfficiency: 0,
      riskAdjustedReturn: 0,
      recentMetrics: {
        period: '30d',
        trades: 0,
        winRate: 0,
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Update execution metrics
   */
  protected updateExecutionMetrics(executionTime: number, success: boolean): void {
    this.executionCount++;
    this.metrics.executionCount++;

    // Update execution time metrics
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.executionCount - 1) + executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.executionCount;
    this.metrics.lastExecutionTime = new Date();

    // Update success/failure counts
    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }
  }

  /**
   * Get current strategy metrics
   */
  public getMetrics(): StrategyMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset strategy metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * HEALTH MONITORING
   */

  /**
   * Perform strategy health check
   */
  public async performHealthCheck(): Promise<StrategyHealthCheck> {
    const checks = [];
    let score = 100;

    // Check execution rate
    const avgExecutionTime = this.metrics.averageExecutionTime;
    if (avgExecutionTime > 10000) { // 10 seconds
      checks.push({
        name: 'execution_time',
        status: 'warn' as const,
        message: 'Average execution time is high',
        value: avgExecutionTime,
        threshold: 10000
      });
      score -= 10;
    } else {
      checks.push({
        name: 'execution_time',
        status: 'pass' as const,
        value: avgExecutionTime,
        threshold: 10000
      });
    }

    // Check error rate
    const errorRate = this.metrics.failedExecutions / Math.max(this.metrics.executionCount, 1);
    if (errorRate > 0.1) { // 10% error rate
      checks.push({
        name: 'error_rate',
        status: 'fail' as const,
        message: 'High error rate detected',
        value: errorRate * 100,
        threshold: 10
      });
      score -= 30;
    } else if (errorRate > 0.05) { // 5% error rate
      checks.push({
        name: 'error_rate',
        status: 'warn' as const,
        message: 'Elevated error rate',
        value: errorRate * 100,
        threshold: 5
      });
      score -= 15;
    } else {
      checks.push({
        name: 'error_rate',
        status: 'pass' as const,
        value: errorRate * 100,
        threshold: 5
      });
    }

    // Check performance metrics
    if (this.metrics.totalTrades > 0) {
      if (this.metrics.winRate < 0.3) { // Below 30% win rate
        checks.push({
          name: 'win_rate',
          status: 'warn' as const,
          message: 'Low win rate',
          value: this.metrics.winRate * 100,
          threshold: 30
        });
        score -= 20;
      } else {
        checks.push({
          name: 'win_rate',
          status: 'pass' as const,
          value: this.metrics.winRate * 100,
          threshold: 30
        });
      }

      if (this.metrics.currentDrawdown > 0.2) { // Above 20% drawdown
        checks.push({
          name: 'drawdown',
          status: 'fail' as const,
          message: 'High drawdown level',
          value: this.metrics.currentDrawdown * 100,
          threshold: 20
        });
        score -= 25;
      } else {
        checks.push({
          name: 'drawdown',
          status: 'pass' as const,
          value: this.metrics.currentDrawdown * 100,
          threshold: 20
        });
      }
    }

    const recommendations = [];
    if (score < 70) {
      recommendations.push('Consider reviewing strategy parameters');
      recommendations.push('Analyze recent performance metrics');
      recommendations.push('Check for market condition changes');
    }

    return {
      strategyId: this.strategyId,
      isHealthy: score >= 70,
      score,
      checks,
      recommendations,
      lastCheck: new Date(),
      nextCheck: new Date(Date.now() + this.config.monitoring.healthCheckInterval * 1000)
    };
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Get current strategy state
   */
  public getState(): StrategyState {
    return this.state;
  }

  /**
   * Get strategy configuration
   */
  public getConfig(): StrategyConfig {
    return { ...this.config };
  }

  /**
   * Get current positions
   */
  public getPositions(): Position[] {
    return Array.from(this.currentPositions.values());
  }

  /**
   * Check if strategy can execute
   */
  public canExecute(): boolean {
    return this.state === 'running';
  }

  /**
   * Set strategy state with event emission
   */
  protected setState(newState: StrategyState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('state_changed', { from: oldState, to: newState });
  }

  /**
   * Emit lifecycle event
   */
  protected emitLifecycleEvent(event: StrategyLifecycleEvent['event'], data?: Record<string, unknown>): void {
    const lifecycleEvent: StrategyLifecycleEvent = {
      strategyId: this.strategyId,
      event,
      timestamp: new Date(),
      data
    };

    this.emit('lifecycle_event', lifecycleEvent);
  }

  /**
   * Format error for logging and events
   */
  protected formatError(error: unknown): { message: string; stack?: string; code?: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return {
      message: String(error)
    };
  }
}

/**
 * Placeholder interfaces for dependency injection
 * These would be implemented in their respective modules
 */
export interface RiskManager {
  assessRisk(context: StrategyContext): Promise<RiskAssessment>;
  validateTrade(signal: StrategySignal, context: StrategyContext): Promise<boolean>;
}

export interface TechnicalIndicatorCalculator {
  calculate(marketData: MarketDataWindow, indicators: string[]): Promise<Record<string, number>>;
}

export interface PortfolioManager {
  getSnapshot(): Promise<PortfolioSnapshot>;
  updatePosition(position: Position): Promise<void>;
}

export interface OrderManager {
  placeOrder(signal: StrategySignal, size: number): Promise<string>;
  closePosition(positionId: string): Promise<void>;
}

export default BaseStrategy;