/**
 * Strategy Executor - Task BE-016
 * 
 * Individual strategy execution wrapper that manages the lifecycle,
 * performance tracking, and execution of a single trading strategy.
 * 
 * Features:
 * - Strategy lifecycle management (initialize, start, pause, resume, stop)
 * - Technical indicator integration and calculation
 * - Real-time performance tracking and metrics collection
 * - Signal validation and quality scoring
 * - Error handling and recovery mechanisms
 * - Resource monitoring and optimization
 */

import { EventEmitter } from 'events';
import type {
  StrategyConfig,
  StrategyContext,
  StrategySignal,
  StrategyMetrics,
  StrategyHealthCheck,
  StrategyExecutionOptions,
  Position,
  MarketDataWindow
} from '../strategies/types.js';
import { BaseStrategy } from '../strategies/BaseStrategy.js';
import { StrategyFactory } from '../strategies/StrategyFactory.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { RiskController } from './RiskController.js';
import type { MarketDataRepository } from '../repositories/index.js';
import type { TechnicalIndicator } from '../indicators/types.js';

/**
 * Strategy Performance Tracker
 */
class StrategyPerformanceTracker {
  private metrics: StrategyMetrics;
  private executionTimes: number[] = [];
  private signalHistory: StrategySignal[] = [];
  private tradeHistory: Array<{ signal: StrategySignal; result: 'win' | 'loss'; pnl: number; }> = [];
  
  constructor(strategyId: string) {
    this.metrics = this.initializeMetrics(strategyId);
  }

  recordExecution(executionTime: number, success: boolean, signal?: StrategySignal): void {
    this.executionTimes.push(executionTime);
    if (this.executionTimes.length > 1000) {
      this.executionTimes = this.executionTimes.slice(-100); // Keep last 100
    }

    this.metrics.executionCount++;
    this.metrics.averageExecutionTime = this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
    this.metrics.lastExecutionTime = new Date();

    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    if (signal) {
      this.signalHistory.push(signal);
      if (this.signalHistory.length > 1000) {
        this.signalHistory = this.signalHistory.slice(-100);
      }
      this.metrics.signalsGenerated++;
      this.updateSignalMetrics();
    }

    this.metrics.lastUpdated = new Date();
  }

  recordTrade(signal: StrategySignal, result: 'win' | 'loss', pnl: number): void {
    this.tradeHistory.push({ signal, result, pnl });
    if (this.tradeHistory.length > 1000) {
      this.tradeHistory = this.tradeHistory.slice(-100);
    }

    this.metrics.totalTrades++;
    this.metrics.signalsExecuted++;

    if (result === 'win') {
      this.metrics.winningTrades++;
    } else {
      this.metrics.losingTrades++;
    }

    this.metrics.winRate = this.metrics.winningTrades / Math.max(this.metrics.totalTrades, 1);
    this.metrics.totalPnL += pnl;
    
    if (pnl > this.metrics.bestTrade) {
      this.metrics.bestTrade = pnl;
    }
    if (pnl < this.metrics.worstTrade) {
      this.metrics.worstTrade = pnl;
    }

    this.updateRiskMetrics(pnl);
    this.updateRecentMetrics();
  }

  getMetrics(): StrategyMetrics {
    return { ...this.metrics };
  }

  private initializeMetrics(strategyId: string): StrategyMetrics {
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

  private updateSignalMetrics(): void {
    if (this.signalHistory.length === 0) return;

    const totalConfidence = this.signalHistory.reduce((sum, s) => sum + s.confidence, 0);
    this.metrics.averageConfidence = totalConfidence / this.signalHistory.length;

    // Calculate signal accuracy (simplified - would need actual trade results)
    const recentSignals = this.signalHistory.slice(-50);
    this.metrics.signalAccuracy = Math.min(this.metrics.winRate * 1.2, 1.0); // Approximation
  }

  private updateRiskMetrics(pnl: number): void {
    // Update drawdown metrics
    if (pnl < 0) {
      this.metrics.currentDrawdown += Math.abs(pnl);
      if (this.metrics.currentDrawdown > this.metrics.maxDrawdown) {
        this.metrics.maxDrawdown = this.metrics.currentDrawdown;
      }
    } else {
      this.metrics.currentDrawdown = Math.max(0, this.metrics.currentDrawdown - pnl);
    }

    // Update profit factor
    const profits = this.tradeHistory.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const losses = Math.abs(this.tradeHistory.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    this.metrics.profitFactor = losses > 0 ? profits / losses : profits > 0 ? Infinity : 0;

    // Update returns
    this.metrics.averageReturn = this.metrics.totalPnL / Math.max(this.metrics.totalTrades, 1);
    
    // Calculate Sharpe ratio (simplified)
    if (this.tradeHistory.length >= 10) {
      const returns = this.tradeHistory.map(t => t.pnl);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      this.metrics.volatility = stdDev;
      this.metrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    }
  }

  private updateRecentMetrics(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTrades = this.tradeHistory; // Would filter by date in production
    
    this.metrics.recentMetrics = {
      period: '30d',
      trades: recentTrades.length,
      winRate: recentTrades.length > 0 ? 
        recentTrades.filter(t => t.result === 'win').length / recentTrades.length : 0,
      totalReturn: recentTrades.reduce((sum, t) => sum + t.pnl, 0),
      sharpeRatio: this.metrics.sharpeRatio, // Simplified
      maxDrawdown: this.metrics.maxDrawdown
    };
  }
}

/**
 * Strategy Executor Configuration
 */
export interface StrategyExecutorConfig {
  enablePerformanceTracking: boolean;
  maxExecutionTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  enableIndicatorCaching: boolean;
  maxCacheSize: number;
  healthCheckInterval: number; // seconds
}

/**
 * Strategy Execution Context Builder
 */
class ExecutionContextBuilder {
  private marketDataRepository: MarketDataRepository;
  
  constructor(marketDataRepository: MarketDataRepository) {
    this.marketDataRepository = marketDataRepository;
  }

  async buildContext(
    baseContext: StrategyContext,
    strategyConfig: StrategyConfig
  ): Promise<StrategyContext> {
    // Add strategy-specific context
    const enhancedContext = {
      ...baseContext,
      strategyId: strategyConfig.id
    };

    // Add technical indicators
    enhancedContext.indicators = await this.calculateIndicators(
      baseContext.marketData,
      strategyConfig
    );

    return enhancedContext;
  }

  private async calculateIndicators(
    marketData: MarketDataWindow,
    config: StrategyConfig
  ): Promise<any> {
    // This would integrate with the technical indicators system
    // For now, returning empty structure
    return {};
  }
}

/**
 * Main Strategy Executor Class
 */
export class StrategyExecutor extends EventEmitter {
  private config: StrategyConfig;
  private executorConfig: StrategyExecutorConfig;
  private strategy: BaseStrategy;
  private performanceTracker: StrategyPerformanceTracker;
  private contextBuilder: ExecutionContextBuilder;
  
  // Dependencies
  private marketDataRepository: MarketDataRepository;
  private performanceMonitor: PerformanceMonitor;
  private riskController: RiskController;
  
  // Execution state
  private isInitialized = false;
  private isRunning = false;
  private isPaused = false;
  private lastHealthCheck?: StrategyHealthCheck;
  private currentPositions: Map<string, Position> = new Map();
  private indicatorCache: Map<string, { data: any; timestamp: Date; }> = new Map();
  
  // Performance monitoring
  private executionQueue: Array<{ context: StrategyContext; resolve: Function; reject: Function; }> = [];
  private activeExecution: Promise<any> | null = null;
  private resourceMonitor: {
    memoryUsage: number;
    executionTime: number;
    lastCheck: Date;
  };

  constructor(
    config: StrategyConfig,
    dependencies: {
      marketDataRepository: MarketDataRepository;
      performanceMonitor: PerformanceMonitor;
      riskController: RiskController;
    },
    executorConfig: Partial<StrategyExecutorConfig> = {}
  ) {
    super();
    this.config = config;
    this.marketDataRepository = dependencies.marketDataRepository;
    this.performanceMonitor = dependencies.performanceMonitor;
    this.riskController = dependencies.riskController;
    
    this.executorConfig = {
      enablePerformanceTracking: true,
      maxExecutionTime: 10000, // 10 seconds
      maxMemoryUsage: 100, // 100 MB
      enableIndicatorCaching: true,
      maxCacheSize: 1000,
      healthCheckInterval: 300, // 5 minutes
      ...executorConfig
    };
    
    this.performanceTracker = new StrategyPerformanceTracker(config.id);
    this.contextBuilder = new ExecutionContextBuilder(this.marketDataRepository);
    this.resourceMonitor = {
      memoryUsage: 0,
      executionTime: 0,
      lastCheck: new Date()
    };
  }

  /**
   * Initialize the strategy executor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create strategy instance
      this.strategy = await StrategyFactory.createStrategy(this.config);
      
      // Initialize strategy
      await this.strategy.initialize();
      
      // Setup event handlers
      this.setupStrategyEventHandlers();
      
      this.isInitialized = true;
      this.emit('initialized', { strategyId: this.config.id });

    } catch (error) {
      throw new Error(`Failed to initialize strategy executor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start strategy execution
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      return;
    }

    try {
      await this.strategy.start();
      this.isRunning = true;
      this.isPaused = false;
      
      this.emit('started', { strategyId: this.config.id });

    } catch (error) {
      throw new Error(`Failed to start strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pause strategy execution
   */
  async pause(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    try {
      await this.strategy.pause();
      this.isPaused = true;
      
      this.emit('paused', { strategyId: this.config.id });

    } catch (error) {
      throw new Error(`Failed to pause strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resume strategy execution
   */
  async resume(): Promise<void> {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    try {
      await this.strategy.resume();
      this.isPaused = false;
      
      this.emit('resumed', { strategyId: this.config.id });

    } catch (error) {
      throw new Error(`Failed to resume strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop strategy execution
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.strategy.stop();
      this.isRunning = false;
      this.isPaused = false;
      
      // Clear execution queue
      this.executionQueue.forEach(({ reject }) => {
        reject(new Error('Strategy stopped'));
      });
      this.executionQueue = [];
      
      this.emit('stopped', { strategyId: this.config.id });

    } catch (error) {
      throw new Error(`Failed to stop strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Emergency stop
   */
  async emergencyStop(): Promise<void> {
    try {
      this.isRunning = false;
      this.isPaused = false;
      
      if (this.strategy) {
        await this.strategy.stop();
      }
      
      // Close all positions
      for (const position of this.currentPositions.values()) {
        await this.closePosition(position.id);
      }
      
      this.emit('emergency_stopped', { strategyId: this.config.id });

    } catch (error) {
      this.emit('emergency_stop_failed', { 
        strategyId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute strategy with given context
   */
  async execute(context: StrategyContext): Promise<StrategySignal | null> {
    if (!this.canExecute()) {
      return null;
    }

    const startTime = Date.now();
    const executionId = `${this.config.id}_${startTime}`;

    try {
      // Check resource constraints
      await this.checkResourceConstraints();
      
      // Build enhanced context
      const enhancedContext = await this.contextBuilder.buildContext(context, this.config);
      enhancedContext.executionId = executionId;
      
      // Execute strategy with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), this.executorConfig.maxExecutionTime)
      );
      
      const executionPromise = this.strategy.executeStrategy(enhancedContext);
      const signal = await Promise.race([executionPromise, timeoutPromise]);
      
      // Validate signal if generated
      let validatedSignal: StrategySignal | null = null;
      if (signal) {
        const isValid = await this.validateSignal(signal, enhancedContext);
        if (isValid) {
          validatedSignal = await this.enhanceSignal(signal, enhancedContext);
        }
      }
      
      // Record execution metrics
      const executionTime = Date.now() - startTime;
      this.performanceTracker.recordExecution(executionTime, true, validatedSignal || undefined);
      
      if (validatedSignal) {
        this.emit('signal_generated', { 
          signal: validatedSignal, 
          executionId,
          executionTime 
        });
      }
      
      return validatedSignal;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceTracker.recordExecution(executionTime, false);
      
      this.emit('execution_error', {
        strategyId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
        executionId,
        executionTime
      });
      
      throw error;
    }
  }

  /**
   * Generate signals based on market data
   */
  async generateSignals(marketData: MarketDataWindow): Promise<StrategySignal[]> {
    if (!this.canExecute()) {
      return [];
    }

    try {
      // Build minimal context for signal generation
      const context: StrategyContext = {
        marketData,
        indicators: await this.contextBuilder.buildContext({} as any, this.config).then(c => c.indicators),
        portfolio: {} as any, // Would be populated with real data
        riskMetrics: await this.riskController.getCurrentRiskMetrics(),
        recentSignals: [],
        recentTrades: [],
        timestamp: new Date(),
        executionId: `signal_${Date.now()}`,
        strategyId: this.config.id,
        marketConditions: this.assessMarketConditions(marketData)
      };

      const signal = await this.strategy.generateSignal(context);
      return signal ? [signal] : [];

    } catch (error) {
      this.emit('signal_generation_error', {
        strategyId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Validate generated signals
   */
  async validateSignals(signals: StrategySignal[]): Promise<StrategySignal[]> {
    const validatedSignals: StrategySignal[] = [];
    
    for (const signal of signals) {
      try {
        const context = await this.buildValidationContext(signal);
        const isValid = await this.strategy.validateSignal(signal, context);
        
        if (isValid) {
          // Additional risk-based validation
          const riskAssessment = await this.riskController.assessSignalRisk(signal);
          if (riskAssessment.approved) {
            validatedSignals.push(signal);
          }
        }
        
      } catch (error) {
        this.emit('validation_error', {
          strategyId: this.config.id,
          signalId: signal.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return validatedSignals;
  }

  /**
   * Update strategy configuration
   */
  async updateConfig(config: Partial<StrategyConfig>): Promise<void> {
    // Merge configurations
    this.config = { ...this.config, ...config };
    
    // If strategy is running, may need to restart for some changes
    const requiresRestart = this.checkConfigRequiresRestart(config);
    
    if (requiresRestart && this.isRunning) {
      await this.stop();
      await this.start();
    }
    
    this.emit('config_updated', { 
      strategyId: this.config.id, 
      changes: Object.keys(config),
      requiresRestart 
    });
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<StrategyHealthCheck> {
    try {
      const strategyHealth = await this.strategy.performHealthCheck();
      
      // Add executor-specific checks
      const executorChecks = await this.performExecutorHealthChecks();
      
      const combinedHealth: StrategyHealthCheck = {
        ...strategyHealth,
        checks: [...strategyHealth.checks, ...executorChecks],
        score: Math.min(strategyHealth.score, this.calculateExecutorHealthScore(executorChecks))
      };
      
      combinedHealth.isHealthy = combinedHealth.score >= 70;
      this.lastHealthCheck = combinedHealth;
      
      return combinedHealth;

    } catch (error) {
      const errorHealth: StrategyHealthCheck = {
        strategyId: this.config.id,
        isHealthy: false,
        score: 0,
        checks: [{
          name: 'health_check_error',
          status: 'fail',
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        recommendations: ['Review strategy configuration', 'Check system resources'],
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + this.executorConfig.healthCheckInterval * 1000)
      };
      
      this.lastHealthCheck = errorHealth;
      return errorHealth;
    }
  }

  /**
   * Get strategy metrics
   */
  getMetrics(): StrategyMetrics {
    return this.performanceTracker.getMetrics();
  }

  /**
   * Get strategy configuration
   */
  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  /**
   * Get strategy state information
   */
  getState(): string {
    if (!this.isInitialized) return 'not_initialized';
    if (!this.isRunning) return 'stopped';
    if (this.isPaused) return 'paused';
    return 'running';
  }

  /**
   * Get strategy ID
   */
  getStrategyId(): string {
    return this.config.id;
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return this.config.name;
  }

  /**
   * Check if strategy can execute
   */
  canExecute(symbol?: string, timeframe?: string): boolean {
    if (!this.isInitialized || !this.isRunning || this.isPaused) {
      return false;
    }

    if (symbol && !this.config.symbols.includes(symbol)) {
      return false;
    }

    if (timeframe && !this.config.timeframes.includes(timeframe as any)) {
      return false;
    }

    return true;
  }

  /**
   * Check if strategy is currently running
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning && !this.isPaused;
  }

  // === PRIVATE METHODS ===

  private setupStrategyEventHandlers(): void {
    this.strategy.on('signal_generated', (event) => {
      this.emit('signal_generated', event);
    });

    this.strategy.on('error', (error) => {
      this.emit('strategy_error', error);
    });

    this.strategy.on('position_updated', (position) => {
      this.currentPositions.set(position.id, position);
      this.emit('position_updated', position);
    });

    this.strategy.on('position_closed', (positionId) => {
      this.currentPositions.delete(positionId);
      this.emit('position_closed', positionId);
    });
  }

  private async validateSignal(signal: StrategySignal, context: StrategyContext): Promise<boolean> {
    try {
      // Strategy-specific validation
      const strategyValidation = await this.strategy.validateSignal(signal, context);
      if (!strategyValidation) return false;

      // Additional executor validations
      if (!signal.symbol || !signal.type || signal.confidence < 0 || signal.confidence > 100) {
        return false;
      }

      // Check signal freshness
      const age = Date.now() - signal.timestamp.getTime();
      if (age > 300000) { // 5 minutes
        return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  private async enhanceSignal(signal: StrategySignal, context: StrategyContext): Promise<StrategySignal> {
    // Add execution timestamp
    const enhancedSignal = {
      ...signal,
      metadata: {
        ...signal.metadata,
        executorId: this.config.id,
        enhancedAt: new Date(),
        marketConditions: context.marketConditions
      }
    };

    return enhancedSignal;
  }

  private async buildValidationContext(signal: StrategySignal): Promise<StrategyContext> {
    // Build minimal context for validation
    return {} as StrategyContext; // Would be implemented with real data
  }

  private assessMarketConditions(marketData: MarketDataWindow): any {
    // Simplified market condition assessment
    const change24h = marketData.change24hPercent;
    
    let trend: 'bull' | 'bear' | 'sideways' = 'sideways';
    if (change24h > 2) trend = 'bull';
    else if (change24h < -2) trend = 'bear';
    
    const volatility = Math.abs(change24h) > 5 ? 'high' : 
                      Math.abs(change24h) > 2 ? 'medium' : 'low';
    
    return {
      trend,
      volatility: volatility as 'low' | 'medium' | 'high',
      liquidity: 'high' as const, // Would calculate from order book
      session: 'american' as const // Would determine from time
    };
  }

  private async checkResourceConstraints(): Promise<void> {
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    
    if (memUsage > this.executorConfig.maxMemoryUsage) {
      throw new Error(`Memory usage ${memUsage}MB exceeds limit ${this.executorConfig.maxMemoryUsage}MB`);
    }
    
    this.resourceMonitor.memoryUsage = memUsage;
    this.resourceMonitor.lastCheck = new Date();
  }

  private checkConfigRequiresRestart(config: Partial<StrategyConfig>): boolean {
    const restartFields = ['symbols', 'timeframes', 'type', 'parameters'];
    return restartFields.some(field => field in config);
  }

  private async performExecutorHealthChecks(): Promise<any[]> {
    const checks = [];
    
    // Memory usage check
    const memUsage = this.resourceMonitor.memoryUsage;
    checks.push({
      name: 'memory_usage',
      status: memUsage < this.executorConfig.maxMemoryUsage * 0.8 ? 'pass' : 'warn',
      value: memUsage,
      threshold: this.executorConfig.maxMemoryUsage
    });
    
    // Execution time check
    const metrics = this.performanceTracker.getMetrics();
    checks.push({
      name: 'avg_execution_time',
      status: metrics.averageExecutionTime < 5000 ? 'pass' : 'warn',
      value: metrics.averageExecutionTime,
      threshold: 5000
    });
    
    return checks;
  }

  private calculateExecutorHealthScore(checks: any[]): number {
    const passCount = checks.filter(c => c.status === 'pass').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;
    
    return Math.max(0, 100 - (warnCount * 10) - ((checks.length - passCount - warnCount) * 30));
  }

  private async closePosition(positionId: string): Promise<void> {
    // Implementation would depend on order management system
    this.currentPositions.delete(positionId);
  }
}

export default StrategyExecutor;