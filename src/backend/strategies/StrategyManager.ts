/**
 * Strategy Manager - Task BE-007: Base Strategy Interface Design
 * 
 * Centralized strategy management system providing lifecycle management,
 * execution coordination, and performance monitoring for all trading strategies.
 */

import { EventEmitter } from 'events';
import { BaseStrategy } from './BaseStrategy.js';
import { StrategyFactory } from './StrategyFactory.js';
import { StrategyContextFactory } from './StrategyContext.js';
import { StrategyRepository } from '../database/repositories/StrategyRepository.js';
import { PortfolioSnapshotRepository } from '../database/repositories/PortfolioSnapshotRepository.js';
import { TradeRepository } from '../database/repositories/TradeRepository.js';
import type {
  StrategyConfig,
  StrategySignal,
  StrategyLifecycleEvent,
  StrategyHealthCheck,
  StrategyMetrics,
  StrategyExecutionOptions
} from './types.js';
import type { DydxCandle, Timeframe } from '../../shared/types/trading.js';

/**
 * Strategy execution status
 */
export interface StrategyExecution {
  strategyId: string;
  executionId: string;
  timestamp: Date;
  symbol: string;
  timeframe: Timeframe;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  duration?: number;
  signal?: StrategySignal;
  error?: string;
}

/**
 * Strategy Manager configuration
 */
export interface StrategyManagerConfig {
  maxConcurrentExecutions: number;
  executionTimeout: number; // milliseconds
  healthCheckInterval: number; // seconds
  metricsUpdateInterval: number; // seconds
  enableAutoRecovery: boolean;
  maxRetryAttempts: number;
}

/**
 * Centralized Strategy Management System
 */
export class StrategyManager extends EventEmitter {
  private readonly activeStrategies = new Map<string, BaseStrategy>();
  private readonly executionHistory = new Map<string, StrategyExecution[]>();
  private readonly healthChecks = new Map<string, StrategyHealthCheck>();
  private readonly strategyFactory: StrategyFactory;
  private readonly strategyRepository: StrategyRepository;
  private readonly portfolioRepository: PortfolioSnapshotRepository;
  private readonly tradeRepository: TradeRepository;
  
  private readonly config: StrategyManagerConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: Partial<StrategyManagerConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentExecutions: 10,
      executionTimeout: 30000, // 30 seconds
      healthCheckInterval: 300, // 5 minutes
      metricsUpdateInterval: 60, // 1 minute
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      ...config
    };

    this.strategyFactory = StrategyFactory.getInstance();
    this.strategyRepository = new StrategyRepository();
    this.portfolioRepository = new PortfolioSnapshotRepository();
    this.tradeRepository = new TradeRepository();

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize the strategy manager
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[StrategyManager] Initializing...');
      
      // Load active strategies from database
      await this.loadActiveStrategies();
      
      // Start periodic tasks
      this.startPeriodicTasks();
      
      console.log(`[StrategyManager] Initialized with ${this.activeStrategies.size} active strategies`);
      this.emit('initialized', { activeStrategies: this.activeStrategies.size });
      
    } catch (error) {
      console.error('[StrategyManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start a strategy by configuration
   */
  public async startStrategy(config: StrategyConfig): Promise<string> {
    try {
      console.log(`[StrategyManager] Starting strategy: ${config.name}`);
      
      // Create strategy instance
      const strategy = this.strategyFactory.createStrategy(config);
      
      // Set up strategy event handlers
      this.setupStrategyEventHandlers(strategy);
      
      // Initialize and start strategy
      await strategy.start();
      
      // Add to active strategies
      this.activeStrategies.set(config.id, strategy);
      this.executionHistory.set(config.id, []);
      
      // Update database status
      await this.strategyRepository.updateStrategy(config.id, { status: 'active' });
      
      console.log(`[StrategyManager] Strategy started successfully: ${config.name}`);
      this.emit('strategy_started', { strategyId: config.id, name: config.name });
      
      return config.id;
      
    } catch (error) {
      console.error(`[StrategyManager] Failed to start strategy ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Stop a strategy by ID
   */
  public async stopStrategy(strategyId: string): Promise<void> {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} is not active`);
      }

      console.log(`[StrategyManager] Stopping strategy: ${strategyId}`);
      
      // Stop strategy
      await strategy.stop();
      
      // Remove from active strategies
      this.activeStrategies.delete(strategyId);
      
      // Update database status
      await this.strategyRepository.updateStrategy(strategyId, { status: 'paused' });
      
      console.log(`[StrategyManager] Strategy stopped: ${strategyId}`);
      this.emit('strategy_stopped', { strategyId });
      
    } catch (error) {
      console.error(`[StrategyManager] Failed to stop strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Pause a strategy
   */
  public async pauseStrategy(strategyId: string): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} is not active`);
    }

    await strategy.pause();
    await this.strategyRepository.updateStrategy(strategyId, { status: 'paused' });
    this.emit('strategy_paused', { strategyId });
  }

  /**
   * Resume a paused strategy
   */
  public async resumeStrategy(strategyId: string): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} is not active`);
    }

    await strategy.resume();
    await this.strategyRepository.updateStrategy(strategyId, { status: 'active' });
    this.emit('strategy_resumed', { strategyId });
  }

  /**
   * Execute strategy for given market data
   */
  public async executeStrategy(
    strategyId: string,
    symbol: string,
    timeframe: Timeframe,
    marketData: DydxCandle[],
    options: StrategyExecutionOptions = {}
  ): Promise<StrategySignal | null> {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} is not active`);
    }

    if (!strategy.canExecute()) {
      return null;
    }

    const executionId = `${strategyId}_${symbol}_${Date.now()}`;
    const startTime = Date.now();

    // Create execution record
    const execution: StrategyExecution = {
      strategyId,
      executionId,
      timestamp: new Date(),
      symbol,
      timeframe,
      status: 'running'
    };

    try {
      // Get portfolio snapshot
      const portfolio = await this.portfolioRepository.getLatest(strategyId);
      if (!portfolio) {
        throw new Error(`No portfolio data available for strategy ${strategyId}`);
      }

      // Get recent signals and trades
      const recentSignals = await this.getRecentSignals(strategyId, 10);
      const recentTrades = await this.tradeRepository.getRecentTrades(strategyId, 20);

      // Create strategy context
      const context = await StrategyContextFactory.createContext(
        strategyId,
        symbol,
        timeframe,
        marketData,
        portfolio,
        recentSignals,
        recentTrades
      );

      // Execute strategy with timeout
      const signal = await this.executeWithTimeout(
        strategy,
        context,
        options.timeout || this.config.executionTimeout
      );

      // Update execution record
      execution.status = 'completed';
      execution.duration = Date.now() - startTime;
      execution.signal = signal || undefined;

      // Store execution history
      this.addExecutionHistory(strategyId, execution);

      this.emit('strategy_executed', { 
        strategyId, 
        executionId, 
        signal: signal || null,
        duration: execution.duration 
      });

      return signal;

    } catch (error) {
      execution.status = 'failed';
      execution.duration = Date.now() - startTime;
      execution.error = error instanceof Error ? error.message : String(error);

      this.addExecutionHistory(strategyId, execution);

      this.emit('strategy_execution_failed', { 
        strategyId, 
        executionId, 
        error: execution.error,
        duration: execution.duration 
      });

      throw error;
    }
  }

  /**
   * Execute all active strategies for given market data
   */
  public async executeAllStrategies(
    symbol: string,
    timeframe: Timeframe,
    marketData: DydxCandle[]
  ): Promise<Map<string, StrategySignal | null>> {
    const results = new Map<string, StrategySignal | null>();
    const executions: Promise<void>[] = [];

    for (const [strategyId, strategy] of this.activeStrategies) {
      // Check if strategy supports this symbol and timeframe
      const config = strategy.getConfig();
      if (!config.symbols.includes(symbol) || !config.timeframes.includes(timeframe)) {
        continue;
      }

      executions.push(
        (async () => {
          try {
            const signal = await this.executeStrategy(strategyId, symbol, timeframe, marketData);
            results.set(strategyId, signal);
          } catch (error) {
            console.error(`[StrategyManager] Execution failed for ${strategyId}:`, error);
            results.set(strategyId, null);
          }
        })()
      );

      // Limit concurrent executions
      if (executions.length >= this.config.maxConcurrentExecutions) {
        await Promise.allSettled(executions.splice(0, this.config.maxConcurrentExecutions));
      }
    }

    // Wait for remaining executions
    if (executions.length > 0) {
      await Promise.allSettled(executions);
    }

    return results;
  }

  /**
   * Get strategy performance metrics
   */
  public async getStrategyMetrics(strategyId: string): Promise<StrategyMetrics | null> {
    const strategy = this.activeStrategies.get(strategyId);
    return strategy ? strategy.getMetrics() : null;
  }

  /**
   * Get strategy health check
   */
  public async getStrategyHealth(strategyId: string): Promise<StrategyHealthCheck | null> {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) {
      return null;
    }

    // Get cached health check or perform new one
    const cached = this.healthChecks.get(strategyId);
    const cacheAge = cached ? Date.now() - cached.lastCheck.getTime() : Infinity;
    
    if (cacheAge < 60000) { // Cache for 1 minute
      return cached;
    }

    const health = await strategy.performHealthCheck();
    this.healthChecks.set(strategyId, health);
    
    return health;
  }

  /**
   * Get all active strategies
   */
  public getActiveStrategies(): Map<string, BaseStrategy> {
    return new Map(this.activeStrategies);
  }

  /**
   * Get strategy execution history
   */
  public getExecutionHistory(strategyId: string, limit = 50): StrategyExecution[] {
    const history = this.executionHistory.get(strategyId) || [];
    return history.slice(-limit);
  }

  /**
   * Shutdown the strategy manager
   */
  public async shutdown(): Promise<void> {
    console.log('[StrategyManager] Shutting down...');
    this.isShuttingDown = true;

    // Clear timers
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);

    // Stop all strategies
    const shutdownPromises = Array.from(this.activeStrategies.keys()).map(strategyId =>
      this.stopStrategy(strategyId).catch(error =>
        console.error(`[StrategyManager] Error stopping strategy ${strategyId}:`, error)
      )
    );

    await Promise.allSettled(shutdownPromises);
    console.log('[StrategyManager] Shutdown completed');
  }

  /**
   * PRIVATE METHODS
   */

  private async loadActiveStrategies(): Promise<void> {
    const activeStrategies = await this.strategyRepository.getActiveStrategies();
    
    for (const strategyData of activeStrategies) {
      try {
        // Convert database strategy to StrategyConfig
        const config: StrategyConfig = {
          id: strategyData.id,
          name: strategyData.name,
          description: strategyData.description,
          version: strategyData.version.toString(),
          type: strategyData.type,
          timeframes: strategyData.timeframes as Timeframe[],
          symbols: strategyData.symbols,
          maxConcurrentPositions: strategyData.max_positions,
          riskProfile: {
            maxRiskPerTrade: strategyData.max_risk_per_trade * 100,
            maxPortfolioRisk: strategyData.max_portfolio_risk * 100,
            stopLossType: 'fixed',
            takeProfitType: 'fixed',
            positionSizing: 'fixed'
          },
          parameters: strategyData.parameters as Record<string, any>,
          performance: {},
          execution: {
            orderType: 'market',
            slippage: 0.1,
            timeout: 30,
            retries: 3
          },
          monitoring: {
            enableAlerts: true,
            alertChannels: ['webhook'],
            healthCheckInterval: 300,
            performanceReviewInterval: 3600
          },
          isActive: true,
          createdAt: strategyData.created_at,
          updatedAt: strategyData.updated_at,
          createdBy: strategyData.created_by
        };

        // Create and start strategy
        const strategy = this.strategyFactory.createStrategy(config);
        this.setupStrategyEventHandlers(strategy);
        await strategy.start();
        
        this.activeStrategies.set(strategyData.id, strategy);
        this.executionHistory.set(strategyData.id, []);
        
      } catch (error) {
        console.error(`[StrategyManager] Failed to load strategy ${strategyData.name}:`, error);
        // Update database to mark strategy as error
        await this.strategyRepository.updateStrategy(strategyData.id, { status: 'error' });
      }
    }
  }

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      console.error('[StrategyManager] Error:', error);
    });
  }

  private setupStrategyEventHandlers(strategy: BaseStrategy): void {
    const strategyId = strategy.getConfig().id;

    strategy.on('lifecycle_event', (event: StrategyLifecycleEvent) => {
      this.emit('strategy_lifecycle', event);
    });

    strategy.on('state_changed', (stateChange: { from: string; to: string }) => {
      this.emit('strategy_state_changed', { strategyId, ...stateChange });
    });

    strategy.on('error', (error: Error) => {
      this.emit('strategy_error', { strategyId, error });
      
      if (this.config.enableAutoRecovery) {
        this.handleStrategyError(strategyId, error);
      }
    });
  }

  private async handleStrategyError(strategyId: string, error: Error): Promise<void> {
    // Implement auto-recovery logic
    console.log(`[StrategyManager] Attempting auto-recovery for strategy ${strategyId}`);
    
    // Could implement strategies like:
    // - Restart the strategy
    // - Reduce position sizes
    // - Pause for a period
    // - Notify administrators
  }

  private startPeriodicTasks(): void {
    // Health checks
    this.healthCheckTimer = setInterval(
      () => this.performAllHealthChecks(),
      this.config.healthCheckInterval * 1000
    );

    // Metrics updates
    this.metricsTimer = setInterval(
      () => this.updateAllMetrics(),
      this.config.metricsUpdateInterval * 1000
    );
  }

  private async performAllHealthChecks(): Promise<void> {
    if (this.isShuttingDown) return;

    for (const strategyId of this.activeStrategies.keys()) {
      try {
        await this.getStrategyHealth(strategyId);
      } catch (error) {
        console.error(`[StrategyManager] Health check failed for ${strategyId}:`, error);
      }
    }
  }

  private async updateAllMetrics(): Promise<void> {
    if (this.isShuttingDown) return;

    for (const strategyId of this.activeStrategies.keys()) {
      try {
        await this.strategyRepository.updatePerformanceMetrics(strategyId);
      } catch (error) {
        console.error(`[StrategyManager] Metrics update failed for ${strategyId}:`, error);
      }
    }
  }

  private async executeWithTimeout<T>(
    strategy: BaseStrategy,
    context: any,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Strategy execution timeout after ${timeout}ms`));
      }, timeout);

      strategy.executeStrategy(context)
        .then((result: T) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private addExecutionHistory(strategyId: string, execution: StrategyExecution): void {
    const history = this.executionHistory.get(strategyId) || [];
    history.push(execution);
    
    // Keep only last 1000 executions
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.executionHistory.set(strategyId, history);
  }

  private async getRecentSignals(strategyId: string, limit: number): Promise<StrategySignal[]> {
    // This would typically query a signals table
    // For now, return empty array
    return [];
  }
}

export default StrategyManager;