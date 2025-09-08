/**
 * Strategy Engine Core Implementation - Task BE-016
 * 
 * Main orchestration engine for coordinating multiple trading strategies
 * with real-time signal processing, performance monitoring, and risk control.
 * 
 * Features:
 * - Multi-strategy coordination and resource allocation
 * - Real-time signal processing and conflict resolution
 * - Performance monitoring and health checks
 * - Risk management integration
 * - Event-driven architecture with comprehensive error handling
 */

import { EventEmitter } from 'events';
import type {
  StrategyConfig,
  StrategyContext,
  StrategySignal,
  StrategyMetrics,
  MarketDataWindow,
  StrategyLifecycleEvent
} from '../strategies/types.js';
import { BaseStrategy } from '../strategies/BaseStrategy.js';
import { StrategyExecutor } from './StrategyExecutor.js';
import { SignalProcessor } from './SignalProcessor.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { RiskController } from './RiskController.js';
import { EventManager } from './EventManager.js';
import type { MarketDataRepository, StrategyRepository, TradeRepository } from '../repositories/index.js';
import { DatabaseManager } from '../database/DatabaseManager.js';

/**
 * Strategy Engine State
 */
export type StrategyEngineState = 'idle' | 'initializing' | 'running' | 'pausing' | 'paused' | 'stopping' | 'stopped' | 'error';

/**
 * Engine Configuration
 */
export interface StrategyEngineConfig {
  // Engine limits
  maxConcurrentStrategies: number;
  maxSignalsPerSecond: number;
  defaultExecutionTimeout: number;
  
  // Performance thresholds
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // Percentage
  maxLatency: number; // Milliseconds
  
  // Risk controls
  emergencyStopEnabled: boolean;
  maxPortfolioRisk: number;
  correlationThreshold: number;
  
  // Monitoring
  healthCheckInterval: number; // Seconds
  performanceReviewInterval: number; // Seconds
  metricsRetentionPeriod: number; // Days
  
  // Event handling
  eventRetention: number; // Number of events to keep in memory
  alertThresholds: {
    errorRate: number;
    latency: number;
    drawdown: number;
  };
}

/**
 * Trade Decision from signal aggregation
 */
export interface TradeDecision {
  id: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold' | 'close';
  quantity: number;
  confidence: number;
  priority: number;
  signals: StrategySignal[];
  reasoning: string[];
  riskAssessment: {
    score: number;
    factors: string[];
    approved: boolean;
  };
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Strategy Execution Result
 */
export interface StrategyResult {
  strategyId: string;
  executionId: string;
  signal: StrategySignal | null;
  executionTime: number;
  success: boolean;
  error?: Error;
  metadata: {
    memoryUsage: number;
    cpuTime: number;
    indicatorCalculations: number;
  };
  timestamp: Date;
}

/**
 * Engine Performance Metrics
 */
export interface EngineMetrics {
  // Execution metrics
  totalExecutions: number;
  averageExecutionTime: number;
  executionsPerSecond: number;
  successRate: number;
  
  // Resource utilization
  memoryUsage: number;
  cpuUsage: number;
  activeStrategies: number;
  queuedSignals: number;
  
  // Performance statistics
  signalsProcessed: number;
  tradesExecuted: number;
  averageLatency: number;
  errorCount: number;
  
  // Portfolio metrics
  totalPortfolioValue: number;
  activePositions: number;
  dailyPnL: number;
  totalReturn: number;
  
  lastUpdated: Date;
}

/**
 * Main Strategy Engine Class
 */
export class StrategyEngine extends EventEmitter {
  private config: StrategyEngineConfig;
  private state: StrategyEngineState = 'idle';
  private strategies: Map<string, StrategyExecutor> = new Map();
  private signalProcessor: SignalProcessor;
  private performanceMonitor: PerformanceMonitor;
  private riskController: RiskController;
  private eventManager: EventManager;
  
  // Dependencies
  private marketDataRepository: MarketDataRepository;
  private strategyRepository: StrategyRepository;
  private tradeRepository: TradeRepository;
  private databaseManager: DatabaseManager;
  
  // Internal state
  private executionQueue: Array<{ strategyId: string; context: StrategyContext; }> = [];
  private activeExecutions: Map<string, Promise<StrategyResult>> = new Map();
  private engineMetrics: EngineMetrics;
  private healthCheckTimer?: NodeJS.Timeout;
  private performanceTimer?: NodeJS.Timeout;
  private lastHealthCheck?: Date;
  
  constructor(
    config: StrategyEngineConfig,
    dependencies: {
      marketDataRepository: MarketDataRepository;
      strategyRepository: StrategyRepository;
      tradeRepository: TradeRepository;
      databaseManager: DatabaseManager;
    }
  ) {
    super();
    this.config = config;
    this.marketDataRepository = dependencies.marketDataRepository;
    this.strategyRepository = dependencies.strategyRepository;
    this.tradeRepository = dependencies.tradeRepository;
    this.databaseManager = dependencies.databaseManager;
    
    // Initialize components
    this.signalProcessor = new SignalProcessor({
      conflictResolutionStrategy: 'priority_weighted',
      maxSignalAge: 300000, // 5 minutes
      aggregationWindow: 5000 // 5 seconds
    });
    
    this.performanceMonitor = new PerformanceMonitor({
      metricsInterval: 60000, // 1 minute
      retentionPeriod: config.metricsRetentionPeriod * 24 * 60 * 60 * 1000,
      alertThresholds: config.alertThresholds
    });
    
    this.riskController = new RiskController({
      maxPortfolioRisk: config.maxPortfolioRisk,
      correlationThreshold: config.correlationThreshold,
      emergencyStopEnabled: config.emergencyStopEnabled
    });
    
    this.eventManager = new EventManager({
      maxEvents: config.eventRetention,
      enablePersistence: true
    });
    
    this.engineMetrics = this.initializeMetrics();
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize the strategy engine
   */
  async initialize(): Promise<void> {
    try {
      this.setState('initializing');
      
      // Initialize components
      await this.signalProcessor.initialize();
      await this.performanceMonitor.initialize();
      await this.riskController.initialize();
      await this.eventManager.initialize();
      
      // Load existing strategies from database
      await this.loadStrategies();
      
      // Start monitoring timers
      this.startHealthChecks();
      this.startPerformanceMonitoring();
      
      this.setState('idle');
      this.emitEvent('engine_initialized', { strategiesLoaded: this.strategies.size });
      
    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to initialize strategy engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start the strategy engine
   */
  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start engine from state: ${this.state}`);
    }

    try {
      this.setState('running');
      
      // Start all registered strategies
      const startPromises = Array.from(this.strategies.values()).map(executor => 
        executor.start().catch(error => {
          this.emitEvent('strategy_start_failed', { 
            strategyId: executor.getStrategyId(),
            error: error.message 
          });
          return null;
        })
      );
      
      const results = await Promise.allSettled(startPromises);
      const failedCount = results.filter(r => r.status === 'rejected').length;
      
      if (failedCount > 0) {
        this.emitEvent('engine_start_warnings', { 
          total: this.strategies.size,
          failed: failedCount 
        });
      }

      this.emitEvent('engine_started', { 
        activeStrategies: this.strategies.size - failedCount 
      });

    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to start strategy engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pause all strategies
   */
  async pauseAll(): Promise<void> {
    if (this.state !== 'running') {
      throw new Error(`Cannot pause engine from state: ${this.state}`);
    }

    try {
      this.setState('pausing');
      
      const pausePromises = Array.from(this.strategies.values()).map(executor =>
        executor.pause()
      );
      
      await Promise.allSettled(pausePromises);
      this.setState('paused');
      this.emitEvent('engine_paused', { strategiesPaused: this.strategies.size });

    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to pause engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resume all strategies
   */
  async resumeAll(): Promise<void> {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume engine from state: ${this.state}`);
    }

    try {
      const resumePromises = Array.from(this.strategies.values()).map(executor =>
        executor.resume()
      );
      
      await Promise.allSettled(resumePromises);
      this.setState('running');
      this.emitEvent('engine_resumed', { strategiesResumed: this.strategies.size });

    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to resume engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop the strategy engine
   */
  async stop(): Promise<void> {
    try {
      this.setState('stopping');
      
      // Stop health checks and monitoring
      this.stopHealthChecks();
      this.stopPerformanceMonitoring();
      
      // Stop all strategies
      const stopPromises = Array.from(this.strategies.values()).map(executor =>
        executor.stop()
      );
      
      await Promise.allSettled(stopPromises);
      
      // Wait for active executions to complete
      await this.waitForActiveExecutions();
      
      // Cleanup components
      await this.signalProcessor.cleanup();
      await this.performanceMonitor.cleanup();
      await this.riskController.cleanup();
      await this.eventManager.cleanup();
      
      this.setState('stopped');
      this.emitEvent('engine_stopped', { strategiesStopped: this.strategies.size });

    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to stop engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Register a new strategy
   */
  async registerStrategy(config: StrategyConfig): Promise<string> {
    try {
      // Validate strategy configuration
      await this.validateStrategyConfig(config);
      
      // Check capacity limits
      if (this.strategies.size >= this.config.maxConcurrentStrategies) {
        throw new Error('Maximum concurrent strategies limit reached');
      }
      
      // Save strategy configuration to database
      const savedStrategy = await this.strategyRepository.create({
        id: config.id,
        name: config.name,
        type: config.type,
        config: config as any,
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // Create strategy executor
      const executor = new StrategyExecutor(config, {
        marketDataRepository: this.marketDataRepository,
        performanceMonitor: this.performanceMonitor,
        riskController: this.riskController
      });
      
      this.strategies.set(config.id, executor);
      
      // Setup strategy event handlers
      this.setupStrategyEventHandlers(executor);
      
      this.emitEvent('strategy_registered', { 
        strategyId: config.id, 
        name: config.name 
      });
      
      return config.id;

    } catch (error) {
      throw new Error(`Failed to register strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Unregister a strategy
   */
  async unregisterStrategy(strategyId: string): Promise<void> {
    const executor = this.strategies.get(strategyId);
    if (!executor) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    try {
      // Stop strategy if running
      if (executor.isCurrentlyRunning()) {
        await executor.stop();
      }
      
      // Remove from active strategies
      this.strategies.delete(strategyId);
      
      // Update database
      await this.strategyRepository.update(strategyId, { 
        is_active: false,
        updated_at: new Date()
      });
      
      this.emitEvent('strategy_unregistered', { strategyId });

    } catch (error) {
      throw new Error(`Failed to unregister strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update strategy configuration
   */
  async updateStrategy(strategyId: string, config: Partial<StrategyConfig>): Promise<void> {
    const executor = this.strategies.get(strategyId);
    if (!executor) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    try {
      // Validate partial configuration
      if (config.riskProfile || config.parameters) {
        await this.validateStrategyConfig(config as StrategyConfig);
      }
      
      // Update executor configuration
      await executor.updateConfig(config);
      
      // Update database
      await this.strategyRepository.update(strategyId, {
        config: config as any,
        updated_at: new Date()
      });
      
      this.emitEvent('strategy_updated', { strategyId, changes: Object.keys(config) });

    } catch (error) {
      throw new Error(`Failed to update strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute all strategies with market data
   */
  async executeStrategies(marketData: MarketDataWindow): Promise<StrategyResult[]> {
    if (this.state !== 'running') {
      return [];
    }

    const executionId = `execution_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // Check resource constraints
      await this.checkResourceConstraints();
      
      // Build execution context
      const context = await this.buildExecutionContext(marketData, executionId);
      
      // Execute strategies in parallel with resource management
      const executionPromises = Array.from(this.strategies.values())
        .filter(executor => executor.canExecute(marketData.symbol, marketData.timeframe))
        .map(executor => this.executeStrategyWithMonitoring(executor, context));
      
      const results = await Promise.allSettled(executionPromises);
      const strategyResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      ).filter(Boolean) as StrategyResult[];
      
      // Process signals from all strategies
      const signals = strategyResults
        .map(result => result.signal)
        .filter(Boolean) as StrategySignal[];
      
      if (signals.length > 0) {
        const tradeDecisions = await this.processSignals(signals);
        this.emitEvent('trade_decisions_generated', { 
          count: tradeDecisions.length,
          executionId 
        });
      }
      
      // Update engine metrics
      this.updateEngineMetrics(strategyResults, Date.now() - startTime);
      
      return strategyResults;

    } catch (error) {
      this.emitEvent('execution_error', { 
        error: error instanceof Error ? error.message : String(error),
        executionId 
      });
      throw error;
    }
  }

  /**
   * Process signals and generate trade decisions
   */
  async processSignals(signals: StrategySignal[]): Promise<TradeDecision[]> {
    try {
      // Process signals through signal processor
      const processedSignals = await this.signalProcessor.processSignals(signals);
      
      // Apply risk validation
      const validatedSignals = await this.riskController.validateSignals(processedSignals);
      
      // Generate trade decisions
      const tradeDecisions: TradeDecision[] = [];
      
      for (const signal of validatedSignals) {
        const riskAssessment = await this.riskController.assessSignalRisk(signal);
        
        if (riskAssessment.approved) {
          const decision: TradeDecision = {
            id: `decision_${Date.now()}_${signal.id}`,
            symbol: signal.symbol,
            action: this.mapSignalTypeToAction(signal.type),
            quantity: signal.quantity || 0,
            confidence: signal.confidence,
            priority: this.calculatePriority(signal),
            signals: [signal],
            reasoning: signal.conditions || [],
            riskAssessment,
            timestamp: new Date(),
            expiresAt: signal.expiresAt || new Date(Date.now() + 300000) // 5 minutes default
          };
          
          tradeDecisions.push(decision);
        }
      }
      
      return tradeDecisions;

    } catch (error) {
      throw new Error(`Failed to process signals: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get engine status and metrics
   */
  getStatus(): {
    state: StrategyEngineState;
    metrics: EngineMetrics;
    strategies: Array<{
      id: string;
      name: string;
      state: string;
      performance: StrategyMetrics;
    }>;
    lastHealthCheck?: Date;
  } {
    const strategies = Array.from(this.strategies.values()).map(executor => ({
      id: executor.getStrategyId(),
      name: executor.getStrategyName(),
      state: executor.getState(),
      performance: executor.getMetrics()
    }));

    return {
      state: this.state,
      metrics: this.engineMetrics,
      strategies,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Perform emergency stop
   */
  async emergencyStop(reason: string): Promise<void> {
    try {
      this.emitEvent('emergency_stop_triggered', { reason });
      
      // Immediately stop all strategy executions
      const stopPromises = Array.from(this.strategies.values()).map(executor =>
        executor.emergencyStop().catch(error => {
          console.error(`Emergency stop failed for strategy ${executor.getStrategyId()}:`, error);
        })
      );
      
      await Promise.allSettled(stopPromises);
      
      // Close all open positions through risk controller
      await this.riskController.emergencyCloseAll();
      
      this.setState('stopped');
      this.emitEvent('emergency_stop_completed', { reason });

    } catch (error) {
      this.emitEvent('emergency_stop_failed', { 
        reason, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  // === PRIVATE METHODS ===

  private async loadStrategies(): Promise<void> {
    const activeStrategies = await this.strategyRepository.findBy({ is_active: true });
    
    for (const strategyData of activeStrategies) {
      try {
        const executor = new StrategyExecutor(strategyData.config as StrategyConfig, {
          marketDataRepository: this.marketDataRepository,
          performanceMonitor: this.performanceMonitor,
          riskController: this.riskController
        });
        
        this.strategies.set(strategyData.id, executor);
        this.setupStrategyEventHandlers(executor);
        
      } catch (error) {
        console.error(`Failed to load strategy ${strategyData.id}:`, error);
      }
    }
  }

  private setupEventHandlers(): void {
    // Handle performance monitor events
    this.performanceMonitor.on('alert', (alert) => {
      this.emitEvent('performance_alert', alert);
    });

    // Handle risk controller events
    this.riskController.on('risk_threshold_exceeded', (event) => {
      this.emitEvent('risk_alert', event);
    });

    // Handle signal processor events
    this.signalProcessor.on('signal_conflict', (conflict) => {
      this.emitEvent('signal_conflict', conflict);
    });
  }

  private setupStrategyEventHandlers(executor: StrategyExecutor): void {
    executor.on('signal_generated', (event) => {
      this.emitEvent('strategy_signal', event);
    });

    executor.on('error', (error) => {
      this.emitEvent('strategy_error', error);
    });

    executor.on('performance_update', (metrics) => {
      this.performanceMonitor.updateStrategyMetrics(executor.getStrategyId(), metrics);
    });
  }

  private async executeStrategyWithMonitoring(
    executor: StrategyExecutor,
    context: StrategyContext
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const executionId = `${executor.getStrategyId()}_${startTime}`;
    
    try {
      const signal = await executor.execute(context);
      const executionTime = Date.now() - startTime;
      
      return {
        strategyId: executor.getStrategyId(),
        executionId,
        signal,
        executionTime,
        success: true,
        metadata: {
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuTime: process.cpuUsage().user / 1000,
          indicatorCalculations: context.indicators ? Object.keys(context.indicators).length : 0
        },
        timestamp: new Date()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        strategyId: executor.getStrategyId(),
        executionId,
        signal: null,
        executionTime,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuTime: process.cpuUsage().user / 1000,
          indicatorCalculations: 0
        },
        timestamp: new Date()
      };
    }
  }

  private async buildExecutionContext(
    marketData: MarketDataWindow,
    executionId: string
  ): Promise<StrategyContext> {
    // This would be implemented to gather all necessary context
    // For now, returning a basic structure
    return {
      marketData,
      indicators: {},
      portfolio: await this.getPortfolioSnapshot(),
      riskMetrics: await this.riskController.getCurrentRiskMetrics(),
      recentSignals: [],
      recentTrades: [],
      timestamp: new Date(),
      executionId,
      strategyId: '', // Will be set per strategy
      marketConditions: {
        trend: 'sideways',
        volatility: 'medium',
        liquidity: 'high',
        session: 'american'
      }
    } as StrategyContext;
  }

  private async getPortfolioSnapshot(): Promise<any> {
    // Placeholder - would integrate with portfolio management
    return {
      total_value: 100000,
      positions_value: 50000,
      cash_value: 50000,
      created_at: new Date(),
      id: 'portfolio_1'
    };
  }

  private async checkResourceConstraints(): Promise<void> {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    
    if (memoryUsage > this.config.maxMemoryUsage) {
      throw new Error(`Memory usage ${memoryUsage}MB exceeds limit ${this.config.maxMemoryUsage}MB`);
    }
  }

  private async validateStrategyConfig(config: Partial<StrategyConfig>): Promise<void> {
    // Basic validation - would be more comprehensive in production
    if (config.riskProfile && config.riskProfile.maxRiskPerTrade > 100) {
      throw new Error('Maximum risk per trade cannot exceed 100%');
    }
  }

  private mapSignalTypeToAction(signalType: string): 'buy' | 'sell' | 'hold' | 'close' {
    switch (signalType) {
      case 'BUY': return 'buy';
      case 'SELL': return 'sell';
      case 'CLOSE_LONG':
      case 'CLOSE_SHORT': return 'close';
      default: return 'hold';
    }
  }

  private calculatePriority(signal: StrategySignal): number {
    const priorityMap = { low: 1, medium: 2, high: 3, critical: 4 };
    return priorityMap[signal.priority || 'medium'];
  }

  private updateEngineMetrics(results: StrategyResult[], totalTime: number): void {
    const successCount = results.filter(r => r.success).length;
    
    this.engineMetrics.totalExecutions += results.length;
    this.engineMetrics.successRate = successCount / Math.max(results.length, 1);
    this.engineMetrics.averageExecutionTime = totalTime / Math.max(results.length, 1);
    this.engineMetrics.executionsPerSecond = results.length / (totalTime / 1000);
    this.engineMetrics.lastUpdated = new Date();
  }

  private initializeMetrics(): EngineMetrics {
    return {
      totalExecutions: 0,
      averageExecutionTime: 0,
      executionsPerSecond: 0,
      successRate: 1.0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeStrategies: 0,
      queuedSignals: 0,
      signalsProcessed: 0,
      tradesExecuted: 0,
      averageLatency: 0,
      errorCount: 0,
      totalPortfolioValue: 0,
      activePositions: 0,
      dailyPnL: 0,
      totalReturn: 0,
      lastUpdated: new Date()
    };
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('Health check failed:', error);
      });
    }, this.config.healthCheckInterval * 1000);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private startPerformanceMonitoring(): void {
    this.performanceTimer = setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.performanceReviewInterval * 1000);
  }

  private stopPerformanceMonitoring(): void {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = undefined;
    }
  }

  private async performHealthCheck(): Promise<void> {
    this.lastHealthCheck = new Date();
    
    // Update resource usage
    const memUsage = process.memoryUsage();
    this.engineMetrics.memoryUsage = memUsage.heapUsed / 1024 / 1024;
    
    // Check strategy health
    let unhealthyStrategies = 0;
    for (const executor of this.strategies.values()) {
      const health = await executor.performHealthCheck();
      if (!health.isHealthy) {
        unhealthyStrategies++;
      }
    }
    
    if (unhealthyStrategies > this.strategies.size * 0.5) {
      this.emitEvent('health_alert', {
        level: 'warning',
        message: `${unhealthyStrategies} of ${this.strategies.size} strategies are unhealthy`
      });
    }
  }

  private updatePerformanceMetrics(): void {
    this.engineMetrics.activeStrategies = this.strategies.size;
    this.engineMetrics.queuedSignals = this.executionQueue.length;
    
    // Update CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.engineMetrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to milliseconds
  }

  private async waitForActiveExecutions(): Promise<void> {
    const activePromises = Array.from(this.activeExecutions.values());
    if (activePromises.length > 0) {
      await Promise.allSettled(activePromises);
    }
  }

  private setState(newState: StrategyEngineState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('state_changed', { from: oldState, to: newState });
  }

  private emitEvent(event: string, data?: any): void {
    this.emit(event, data);
    this.eventManager.recordEvent(event, data);
  }
}

export default StrategyEngine;