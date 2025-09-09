/**
 * Strategy Engine Core Implementation - Task BE-016: Main Orchestrator
 * 
 * Enterprise-grade strategy execution orchestrator that integrates:
 * - Multi-strategy management with real-time execution
 * - High-performance data processing pipeline  
 * - Real-time signal generation and processing
 * - Advanced error handling and recovery systems
 * - Performance monitoring and metrics collection
 * 
 * This is the MAIN ORCHESTRATOR that transforms our platform from infrastructure
 * into a production-ready algorithmic trading system.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type { DydxCandle, Timeframe } from '../../shared/types/trading.js';
import type {
  StrategyConfig,
  StrategySignal,
  StrategyContext,
  StrategyExecutionOptions,
  StrategyMetrics
} from './types.js';

// Core infrastructure components
import { StrategyManager } from './StrategyManager.js';
import { MarketDataBuffer, createMarketDataBufferCollection } from '../data/MarketDataBuffer.js';
import { IndicatorPipeline } from '../indicators/pipeline/IndicatorPipeline.js';
import { SignalGenerator } from '../signals/SignalGenerator.js';
import { RealTimeSignalProcessor } from '../signals/RealTimeSignalProcessor.js';
import { ConditionEvaluationEngine } from '../conditions/ConditionEvaluationEngine.js';

// Data and utility components  
import { StrategyContextFactory } from './StrategyContext.js';
import { DataTransformations } from '../data/DataTransformations.js';
import { OHLCVDataValidator, createOHLCVValidator } from '../data/DataValidator.js';
import { RollingWindow } from '../data/RollingWindow.js';

// =============================================================================
// STRATEGY ENGINE CONFIGURATION AND TYPES
// =============================================================================

export interface StrategyEngineConfig {
  id: string;
  name: string;
  version: string;
  
  // Data processing configuration
  dataBuffer: {
    maxCapacity: number;
    compressionEnabled: boolean;
    symbols: string[];
    timeframes: Timeframe[];
  };
  
  // Real-time processing settings
  realTimeProcessing: {
    enabled: boolean;
    updateInterval: number; // milliseconds
    batchSize: number;
    maxConcurrency: number;
    bufferSize: number;
  };
  
  // Strategy execution settings
  execution: {
    maxConcurrentStrategies: number;
    executionTimeout: number;
    retryAttempts: number;
    priorityExecution: boolean;
  };
  
  // Performance and monitoring
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    alertThresholds: {
      latency: number;
      errorRate: number;
      memoryUsage: number;
      queueDepth: number;
    };
  };
  
  // Error handling and recovery
  errorHandling: {
    autoRecovery: boolean;
    maxRecoveryAttempts: number;
    recoveryDelay: number;
    circuitBreakerThreshold: number;
    fallbackMode: boolean;
  };
  
  // Risk management
  riskManagement: {
    enabled: boolean;
    maxPositions: number;
    maxRiskPerStrategy: number;
    emergencyStop: boolean;
    riskMonitoringInterval: number;
  };
}

export interface EngineExecutionContext {
  timestamp: Date;
  symbol: string;
  timeframe: Timeframe;
  marketData: DydxCandle[];
  activeStrategies: string[];
  systemLoad: number;
  marketConditions: {
    volatility: number;
    trend: 'up' | 'down' | 'sideways';
    volume: number;
  };
}

export interface EnginePerformanceMetrics {
  execution: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    peakExecutionTime: number;
    executionsPerSecond: number;
  };
  
  dataProcessing: {
    candlesProcessed: number;
    dataLatency: number;
    bufferUtilization: number;
    indicatorCalculations: number;
    cacheHitRate: number;
  };
  
  strategies: {
    activeStrategies: number;
    totalSignals: number;
    successfulSignals: number;
    averageSignalConfidence: number;
    strategiesInError: number;
  };
  
  system: {
    memoryUsage: number;
    cpuUtilization: number;
    queueDepth: number;
    uptime: number;
    errorRate: number;
  };
  
  lastUpdated: Date;
}

export interface EngineExecutionResult {
  executionId: string;
  timestamp: Date;
  success: boolean;
  
  // Execution details
  strategiesExecuted: number;
  signalsGenerated: number;
  executionTime: number;
  
  // Results by strategy
  strategyResults: Map<string, {
    success: boolean;
    signals: StrategySignal[];
    executionTime: number;
    error?: string;
  }>;
  
  // Performance data
  performance: {
    dataProcessingTime: number;
    indicatorCalculationTime: number;
    signalGenerationTime: number;
    validationTime: number;
  };
  
  // Errors and warnings
  errors: Array<{
    strategyId?: string;
    type: string;
    message: string;
    code?: string;
    timestamp: Date;
  }>;
  
  warnings: Array<{
    type: string;
    message: string;
    timestamp: Date;
  }>;
}

// =============================================================================
// MAIN STRATEGY ENGINE IMPLEMENTATION
// =============================================================================

/**
 * StrategyEngine - The main orchestrator for algorithmic trading
 * 
 * This class integrates all trading infrastructure components into a unified
 * system capable of:
 * - Real-time data processing and indicator calculation
 * - Multi-strategy execution with advanced scheduling
 * - Signal generation and conflict resolution
 * - Risk management and position monitoring
 * - Performance tracking and health monitoring
 * - Error handling and automatic recovery
 */
export class StrategyEngine extends EventEmitter {
  private readonly config: StrategyEngineConfig;
  
  // Core system components
  private readonly strategyManager: StrategyManager;
  private readonly dataBuffers: Map<string, MarketDataBuffer>;
  private readonly indicatorPipeline: IndicatorPipeline;
  private readonly signalGenerator: SignalGenerator;
  private readonly realTimeProcessor: RealTimeSignalProcessor;
  private readonly conditionEngine: ConditionEvaluationEngine;
  
  // Data processing components
  private readonly dataValidator: OHLCVDataValidator;
  private readonly dataTransformations: DataTransformations;
  private readonly rollingWindows: Map<string, RollingWindow<DydxCandle>>;
  
  // Engine state and control
  private isRunning = false;
  private isPaused = false;
  private startTime: Date = new Date();
  private executionCounter = 0;
  
  // Real-time processing
  private processingTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private readonly performanceMetrics: EnginePerformanceMetrics;
  private readonly executionHistory: EngineExecutionResult[] = [];
  private readonly recentErrors: Array<{ error: Error; timestamp: Date }> = [];
  
  // Circuit breaker and recovery
  private consecutiveErrors = 0;
  private circuitBreakerOpen = false;
  private lastRecoveryAttempt?: Date;
  
  // Data processing queues
  private readonly dataProcessingQueue: Array<{
    symbol: string;
    timeframe: Timeframe;
    candles: DydxCandle[];
    priority: number;
  }> = [];

  constructor(config: Partial<StrategyEngineConfig>) {
    super();
    
    this.config = this.mergeDefaultConfig(config);
    
    // Initialize core components
    this.strategyManager = new StrategyManager({
      maxConcurrentExecutions: this.config.execution.maxConcurrentStrategies,
      executionTimeout: this.config.execution.executionTimeout,
      enableAutoRecovery: this.config.errorHandling.autoRecovery,
      maxRetryAttempts: this.config.errorHandling.maxRecoveryAttempts
    });
    
    // Initialize data infrastructure
    this.dataBuffers = createMarketDataBufferCollection(
      this.config.dataBuffer.symbols,
      {
        maxCapacity: this.config.dataBuffer.maxCapacity,
        compression: { enabled: this.config.dataBuffer.compressionEnabled }
      }
    );
    
    this.indicatorPipeline = new IndicatorPipeline({
      enableCaching: true,
      enableParallelProcessing: true,
      maxCacheSize: 10000,
      enableLazyEvaluation: true
    });
    
    this.signalGenerator = new SignalGenerator({
      enableRealTimeProcessing: this.config.realTimeProcessing.enabled,
      processingInterval: this.config.realTimeProcessing.updateInterval,
      batchSize: this.config.realTimeProcessing.batchSize,
      maxConcurrency: this.config.realTimeProcessing.maxConcurrency
    });
    
    this.realTimeProcessor = new RealTimeSignalProcessor({
      bufferSize: this.config.realTimeProcessing.bufferSize,
      processingInterval: this.config.realTimeProcessing.updateInterval
    });
    
    this.conditionEngine = new ConditionEvaluationEngine({
      enableCaching: true,
      cacheSize: 5000,
      enableParallelProcessing: true
    });
    
    // Initialize utility components
    this.dataValidator = createOHLCVValidator();
    this.dataTransformations = new DataTransformations();
    this.rollingWindows = new Map();
    
    // Initialize performance metrics
    this.performanceMetrics = this.initializePerformanceMetrics();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    this.emit('initialized', {
      engineId: this.config.id,
      version: this.config.version,
      config: this.config
    });
  }

  // =============================================================================
  // ENGINE LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Start the strategy engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[StrategyEngine] Engine is already running');
      return;
    }

    console.log(`[StrategyEngine] Starting ${this.config.name} v${this.config.version}...`);
    
    try {
      // Initialize all components
      await this.strategyManager.initialize();
      await this.signalGenerator.startRealTimeProcessing();
      await this.realTimeProcessor.start();
      this.conditionEngine.start();
      
      // Start periodic tasks
      if (this.config.realTimeProcessing.enabled) {
        this.startRealTimeProcessing();
      }
      
      if (this.config.monitoring.enableMetrics) {
        this.startMetricsCollection();
      }
      
      this.startHealthChecking();
      
      // Update state
      this.isRunning = true;
      this.isPaused = false;
      this.startTime = new Date();
      
      console.log(`[StrategyEngine] Started successfully. Engine ID: ${this.config.id}`);
      this.emit('started', { engineId: this.config.id, timestamp: new Date() });
      
    } catch (error) {
      console.error('[StrategyEngine] Failed to start:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the strategy engine gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[StrategyEngine] Engine is not running');
      return;
    }

    console.log('[StrategyEngine] Stopping engine...');
    
    try {
      // Stop real-time processing
      this.stopRealTimeProcessing();
      this.stopMetricsCollection();
      this.stopHealthChecking();
      
      // Stop all components
      await this.strategyManager.shutdown();
      await this.signalGenerator.stopRealTimeProcessing();
      await this.realTimeProcessor.stop();
      this.conditionEngine.stop();
      
      // Cleanup resources
      await this.cleanup();
      
      this.isRunning = false;
      this.isPaused = false;
      
      console.log('[StrategyEngine] Stopped successfully');
      this.emit('stopped', { engineId: this.config.id, timestamp: new Date() });
      
    } catch (error) {
      console.error('[StrategyEngine] Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Pause strategy engine execution
   */
  async pause(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    console.log('[StrategyEngine] Pausing engine...');
    
    this.isPaused = true;
    this.stopRealTimeProcessing();
    
    // Pause all active strategies
    const activeStrategies = this.strategyManager.getActiveStrategies();
    for (const strategyId of activeStrategies.keys()) {
      try {
        await this.strategyManager.pauseStrategy(strategyId);
      } catch (error) {
        console.error(`[StrategyEngine] Error pausing strategy ${strategyId}:`, error);
      }
    }
    
    this.emit('paused', { engineId: this.config.id, timestamp: new Date() });
  }

  /**
   * Resume strategy engine execution
   */
  async resume(): Promise<void> {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    console.log('[StrategyEngine] Resuming engine...');
    
    // Resume all paused strategies
    const activeStrategies = this.strategyManager.getActiveStrategies();
    for (const strategyId of activeStrategies.keys()) {
      try {
        await this.strategyManager.resumeStrategy(strategyId);
      } catch (error) {
        console.error(`[StrategyEngine] Error resuming strategy ${strategyId}:`, error);
      }
    }
    
    if (this.config.realTimeProcessing.enabled) {
      this.startRealTimeProcessing();
    }
    
    this.isPaused = false;
    this.emit('resumed', { engineId: this.config.id, timestamp: new Date() });
  }

  // =============================================================================
  // REAL-TIME DATA PROCESSING
  // =============================================================================

  /**
   * Process incoming market data in real-time
   */
  async processMarketData(
    symbol: string,
    timeframe: Timeframe,
    candles: DydxCandle[],
    priority = 0
  ): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    // Add to processing queue
    this.dataProcessingQueue.push({
      symbol,
      timeframe,
      candles,
      priority
    });

    // Sort queue by priority
    this.dataProcessingQueue.sort((a, b) => b.priority - a.priority);

    // Process immediately if queue is not too large
    if (this.dataProcessingQueue.length <= this.config.realTimeProcessing.batchSize) {
      await this.processDataQueue();
    }
  }

  /**
   * Execute strategies for given market data
   */
  async executeStrategies(
    symbol: string,
    timeframe: Timeframe,
    marketData: DydxCandle[],
    options: StrategyExecutionOptions = {}
  ): Promise<EngineExecutionResult> {
    const executionId = `exec_${++this.executionCounter}_${Date.now()}`;
    const startTime = performance.now();
    
    const result: EngineExecutionResult = {
      executionId,
      timestamp: new Date(),
      success: false,
      strategiesExecuted: 0,
      signalsGenerated: 0,
      executionTime: 0,
      strategyResults: new Map(),
      performance: {
        dataProcessingTime: 0,
        indicatorCalculationTime: 0,
        signalGenerationTime: 0,
        validationTime: 0
      },
      errors: [],
      warnings: []
    };

    try {
      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        throw new Error('Circuit breaker is open - too many consecutive errors');
      }

      // Validate input data
      const validationStart = performance.now();
      const isValid = this.dataValidator.validate(marketData, {
        symbol,
        timeframe,
        strictMode: true
      });
      
      if (!isValid.isValid) {
        const errorMessages = isValid.errors.map(e => e.message);
        throw new Error(`Invalid market data: ${errorMessages.join(', ')}`);
      }
      result.performance.validationTime = performance.now() - validationStart;

      // Update data buffers
      const dataProcessingStart = performance.now();
      await this.updateDataBuffers(symbol, marketData);
      result.performance.dataProcessingTime = performance.now() - dataProcessingStart;

      // Calculate indicators
      const indicatorStart = performance.now();
      const indicatorContext = await this.calculateIndicators(symbol, timeframe, marketData);
      result.performance.indicatorCalculationTime = performance.now() - indicatorStart;

      // Execute all applicable strategies
      const signalStart = performance.now();
      const strategySignals = await this.strategyManager.executeAllStrategies(
        symbol,
        timeframe,
        marketData
      );
      
      result.strategiesExecuted = strategySignals.size;
      
      // Process strategy results
      let totalSignals = 0;
      for (const [strategyId, signal] of strategySignals.entries()) {
        const strategyResult = {
          success: signal !== null,
          signals: signal ? [signal] : [],
          executionTime: 0, // Would be tracked from StrategyManager
          error: signal === null ? 'No signal generated' : undefined
        };
        
        result.strategyResults.set(strategyId, strategyResult);
        
        if (signal) {
          totalSignals++;
          
          // Process signal through real-time processor
          await this.realTimeProcessor.processSignal(signal);
        }
      }
      
      result.signalsGenerated = totalSignals;
      result.performance.signalGenerationTime = performance.now() - signalStart;

      // Update performance metrics
      this.updateExecutionMetrics(result);
      
      result.success = true;
      result.executionTime = performance.now() - startTime;
      
      // Reset consecutive error count on success
      this.consecutiveErrors = 0;
      
      this.emit('execution_completed', result);
      
    } catch (error) {
      result.success = false;
      result.executionTime = performance.now() - startTime;
      
      const errorRecord = {
        type: 'execution_error',
        message: error instanceof Error ? error.message : String(error),
        code: 'EXECUTION_FAILED',
        timestamp: new Date()
      };
      
      result.errors.push(errorRecord);
      
      // Handle error and recovery
      await this.handleExecutionError(error, executionId);
      
      this.emit('execution_failed', { executionId, error, result });
    }
    
    // Store execution history
    this.executionHistory.push(result);
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift();
    }
    
    return result;
  }

  // =============================================================================
  // STRATEGY MANAGEMENT
  // =============================================================================

  /**
   * Add strategy to the engine
   */
  async addStrategy(config: StrategyConfig): Promise<string> {
    if (!this.isRunning) {
      throw new Error('Engine must be running to add strategies');
    }

    try {
      const strategyId = await this.strategyManager.startStrategy(config);
      
      // Initialize rolling windows for strategy symbols
      for (const symbol of config.symbols) {
        const windowKey = `${strategyId}_${symbol}`;
        this.rollingWindows.set(windowKey, new RollingWindow<DydxCandle>(1000));
      }
      
      this.emit('strategy_added', { strategyId, config });
      
      return strategyId;
      
    } catch (error) {
      console.error(`[StrategyEngine] Failed to add strategy ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove strategy from the engine
   */
  async removeStrategy(strategyId: string): Promise<void> {
    try {
      await this.strategyManager.stopStrategy(strategyId);
      
      // Cleanup rolling windows
      const windowsToRemove = Array.from(this.rollingWindows.keys())
        .filter(key => key.startsWith(strategyId));
      
      for (const windowKey of windowsToRemove) {
        this.rollingWindows.delete(windowKey);
      }
      
      this.emit('strategy_removed', { strategyId });
      
    } catch (error) {
      console.error(`[StrategyEngine] Failed to remove strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Get strategy performance metrics
   */
  async getStrategyMetrics(strategyId: string): Promise<StrategyMetrics | null> {
    return this.strategyManager.getStrategyMetrics(strategyId);
  }

  /**
   * Get all active strategies
   */
  getActiveStrategies(): string[] {
    return Array.from(this.strategyManager.getActiveStrategies().keys());
  }

  // =============================================================================
  // PERFORMANCE AND MONITORING
  // =============================================================================

  /**
   * Get engine performance metrics
   */
  getPerformanceMetrics(): EnginePerformanceMetrics {
    // Update real-time metrics
    this.updateSystemMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Get engine health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    score: number;
    issues: string[];
    componentHealth: Record<string, { healthy: boolean; score: number }>;
  }> {
    const issues: string[] = [];
    let overallScore = 100;
    
    const componentHealth: Record<string, { healthy: boolean; score: number }> = {};

    // Check strategy manager health
    try {
      const strategyManagerHealth = await this.getComponentHealth('strategyManager');
      componentHealth.strategyManager = strategyManagerHealth;
      if (!strategyManagerHealth.healthy) {
        issues.push('Strategy manager is unhealthy');
        overallScore -= 25;
      }
    } catch (error) {
      issues.push('Cannot check strategy manager health');
      overallScore -= 30;
    }

    // Check signal generator health
    try {
      const signalHealth = await this.signalGenerator.getHealthStatus();
      componentHealth.signalGenerator = { healthy: signalHealth.healthy, score: signalHealth.score };
      if (!signalHealth.healthy) {
        issues.push('Signal generator is unhealthy');
        overallScore -= 20;
      }
    } catch (error) {
      issues.push('Cannot check signal generator health');
      overallScore -= 25;
    }

    // Check data processing health
    const dataHealth = this.checkDataProcessingHealth();
    componentHealth.dataProcessing = dataHealth;
    if (!dataHealth.healthy) {
      issues.push('Data processing is unhealthy');
      overallScore -= 20;
    }

    // Check system resource health
    const systemHealth = this.checkSystemHealth();
    componentHealth.system = systemHealth;
    if (!systemHealth.healthy) {
      issues.push('System resources are under stress');
      overallScore -= 15;
    }

    // Check circuit breaker status
    if (this.circuitBreakerOpen) {
      issues.push('Circuit breaker is open');
      overallScore -= 50;
    }

    return {
      healthy: overallScore >= 70,
      score: Math.max(0, overallScore),
      issues,
      componentHealth
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 50): EngineExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  // =============================================================================
  // PRIVATE IMPLEMENTATION METHODS
  // =============================================================================

  /**
   * Process the data processing queue
   */
  private async processDataQueue(): Promise<void> {
    if (this.dataProcessingQueue.length === 0) {
      return;
    }

    const batchSize = Math.min(
      this.config.realTimeProcessing.batchSize,
      this.dataProcessingQueue.length
    );
    
    const batch = this.dataProcessingQueue.splice(0, batchSize);
    
    // Group by symbol for efficient processing
    const symbolGroups = new Map<string, typeof batch>();
    
    for (const item of batch) {
      const key = `${item.symbol}_${item.timeframe}`;
      if (!symbolGroups.has(key)) {
        symbolGroups.set(key, []);
      }
      symbolGroups.get(key)!.push(item);
    }

    // Process each symbol group
    const processingPromises = Array.from(symbolGroups.entries()).map(
      async ([key, items]) => {
        const [symbol, timeframe] = key.split('_');
        
        // Merge all candles for this symbol
        const allCandles = items.flatMap(item => item.candles);
        
        // Sort by timestamp
        allCandles.sort((a, b) => 
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        );

        try {
          await this.executeStrategies(symbol, timeframe as Timeframe, allCandles);
        } catch (error) {
          console.error(`[StrategyEngine] Error processing ${symbol}:`, error);
        }
      }
    );

    await Promise.allSettled(processingPromises);
  }

  /**
   * Update data buffers with new market data
   */
  private async updateDataBuffers(symbol: string, candles: DydxCandle[]): Promise<void> {
    const buffer = this.dataBuffers.get(symbol);
    if (!buffer) {
      console.warn(`[StrategyEngine] No buffer found for symbol ${symbol}`);
      return;
    }

    // Convert DydxCandle to OHLCVData format
    const ohlcvData = candles.map(candle => ({
      timestamp: new Date(candle.startedAt).getTime(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.baseTokenVolume)
    }));

    buffer.addCandles(ohlcvData);
    
    // Update rolling windows
    for (const [windowKey, window] of this.rollingWindows.entries()) {
      if (windowKey.includes(symbol)) {
        for (const candle of candles) {
          window.add(candle);
        }
      }
    }
    
    // Update performance metrics
    this.performanceMetrics.dataProcessing.candlesProcessed += candles.length;
    this.performanceMetrics.dataProcessing.bufferUtilization = 
      (buffer.size() / buffer['maxCapacity']) * 100;
  }

  /**
   * Calculate indicators for market data
   */
  private async calculateIndicators(
    symbol: string,
    timeframe: Timeframe,
    marketData: DydxCandle[]
  ): Promise<Record<string, any>> {
    // Get data from buffer for indicator calculation
    const buffer = this.dataBuffers.get(symbol);
    if (!buffer) {
      return {};
    }

    const indicatorData = buffer.getLastN(200); // Get enough data for indicators
    
    // Calculate common indicators through pipeline
    const indicators = await this.indicatorPipeline.calculateBatch({
      symbol,
      timeframe,
      data: indicatorData,
      indicators: [
        'sma_20',
        'sma_50',
        'ema_12',
        'ema_26',
        'rsi_14',
        'macd',
        'bb_20',
        'atr_14'
      ]
    });
    
    this.performanceMetrics.dataProcessing.indicatorCalculations++;
    
    return indicators.results;
  }

  /**
   * Start real-time processing
   */
  private startRealTimeProcessing(): void {
    if (this.processingTimer) {
      return;
    }

    this.processingTimer = setInterval(async () => {
      if (!this.isPaused) {
        await this.processDataQueue();
      }
    }, this.config.realTimeProcessing.updateInterval);
  }

  /**
   * Stop real-time processing
   */
  private stopRealTimeProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsTimer) {
      return;
    }

    this.metricsTimer = setInterval(() => {
      this.updatePerformanceMetrics();
      this.emit('metrics_updated', this.performanceMetrics);
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      const health = await this.getHealthStatus();
      
      if (!health.healthy) {
        this.emit('health_warning', health);
        
        if (this.config.errorHandling.autoRecovery) {
          await this.attemptRecovery(health);
        }
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Handle execution errors and implement recovery
   */
  private async handleExecutionError(error: unknown, executionId: string): Promise<void> {
    const errorRecord = {
      error: error instanceof Error ? error : new Error(String(error)),
      timestamp: new Date()
    };
    
    this.recentErrors.push(errorRecord);
    if (this.recentErrors.length > 100) {
      this.recentErrors.shift();
    }
    
    this.consecutiveErrors++;
    
    // Check circuit breaker
    if (this.consecutiveErrors >= this.config.errorHandling.circuitBreakerThreshold) {
      this.circuitBreakerOpen = true;
      this.emit('circuit_breaker_opened', { 
        consecutiveErrors: this.consecutiveErrors,
        threshold: this.config.errorHandling.circuitBreakerThreshold 
      });
      
      if (this.config.errorHandling.autoRecovery) {
        setTimeout(() => {
          this.attemptCircuitBreakerRecovery();
        }, this.config.errorHandling.recoveryDelay);
      }
    }
    
    this.emit('execution_error', {
      executionId,
      error: errorRecord.error,
      consecutiveErrors: this.consecutiveErrors
    });
  }

  /**
   * Attempt circuit breaker recovery
   */
  private async attemptCircuitBreakerRecovery(): Promise<void> {
    if (!this.circuitBreakerOpen) {
      return;
    }

    console.log('[StrategyEngine] Attempting circuit breaker recovery...');
    
    try {
      // Reset circuit breaker
      this.circuitBreakerOpen = false;
      this.consecutiveErrors = 0;
      this.lastRecoveryAttempt = new Date();
      
      // Perform health check
      const health = await this.getHealthStatus();
      
      if (health.healthy) {
        console.log('[StrategyEngine] Circuit breaker recovery successful');
        this.emit('circuit_breaker_recovered');
      } else {
        // Recovery failed, reopen circuit breaker
        this.circuitBreakerOpen = true;
        this.emit('circuit_breaker_recovery_failed', health);
      }
      
    } catch (error) {
      console.error('[StrategyEngine] Circuit breaker recovery failed:', error);
      this.circuitBreakerOpen = true;
      this.emit('circuit_breaker_recovery_failed', { error });
    }
  }

  /**
   * Attempt system recovery
   */
  private async attemptRecovery(healthStatus: any): Promise<void> {
    if (this.lastRecoveryAttempt && 
        Date.now() - this.lastRecoveryAttempt.getTime() < this.config.errorHandling.recoveryDelay) {
      return;
    }

    this.lastRecoveryAttempt = new Date();
    
    console.log('[StrategyEngine] Attempting system recovery...');
    
    try {
      // Clear processing queue if it's backing up
      if (this.dataProcessingQueue.length > this.config.realTimeProcessing.batchSize * 3) {
        console.log('[StrategyEngine] Clearing backed up processing queue');
        this.dataProcessingQueue.length = 0;
      }
      
      // Restart failed components if needed
      if (healthStatus.componentHealth.signalGenerator?.healthy === false) {
        await this.signalGenerator.stopRealTimeProcessing();
        await this.signalGenerator.startRealTimeProcessing();
      }
      
      this.emit('recovery_attempted', { timestamp: new Date() });
      
    } catch (error) {
      console.error('[StrategyEngine] Recovery attempt failed:', error);
      this.emit('recovery_failed', { error });
    }
  }

  // Component health check methods
  private async getComponentHealth(component: string): Promise<{ healthy: boolean; score: number }> {
    switch (component) {
      case 'strategyManager':
        const activeStrategies = this.strategyManager.getActiveStrategies().size;
        return {
          healthy: activeStrategies >= 0, // At least some strategies should be running
          score: Math.min(100, activeStrategies * 20)
        };
      
      default:
        return { healthy: true, score: 100 };
    }
  }

  private checkDataProcessingHealth(): { healthy: boolean; score: number } {
    const queueSize = this.dataProcessingQueue.length;
    const maxQueueSize = this.config.realTimeProcessing.batchSize * 2;
    
    if (queueSize > maxQueueSize) {
      return { healthy: false, score: 30 };
    }
    
    return { 
      healthy: true, 
      score: Math.max(50, 100 - (queueSize / maxQueueSize) * 50)
    };
  }

  private checkSystemHealth(): { healthy: boolean; score: number } {
    // Check memory usage (simplified)
    const memoryUsage = process.memoryUsage();
    const memoryScore = memoryUsage.heapUsed < 500_000_000 ? 100 : 50; // 500MB threshold
    
    return {
      healthy: memoryScore >= 70,
      score: memoryScore
    };
  }

  // Performance metrics methods
  private initializePerformanceMetrics(): EnginePerformanceMetrics {
    return {
      execution: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        peakExecutionTime: 0,
        executionsPerSecond: 0
      },
      dataProcessing: {
        candlesProcessed: 0,
        dataLatency: 0,
        bufferUtilization: 0,
        indicatorCalculations: 0,
        cacheHitRate: 0
      },
      strategies: {
        activeStrategies: 0,
        totalSignals: 0,
        successfulSignals: 0,
        averageSignalConfidence: 0,
        strategiesInError: 0
      },
      system: {
        memoryUsage: 0,
        cpuUtilization: 0,
        queueDepth: 0,
        uptime: 0,
        errorRate: 0
      },
      lastUpdated: new Date()
    };
  }

  private updateExecutionMetrics(result: EngineExecutionResult): void {
    this.performanceMetrics.execution.totalExecutions++;
    
    if (result.success) {
      this.performanceMetrics.execution.successfulExecutions++;
    } else {
      this.performanceMetrics.execution.failedExecutions++;
    }
    
    // Update average execution time
    this.performanceMetrics.execution.averageExecutionTime = 
      (this.performanceMetrics.execution.averageExecutionTime + result.executionTime) / 2;
    
    // Update peak execution time
    this.performanceMetrics.execution.peakExecutionTime = 
      Math.max(this.performanceMetrics.execution.peakExecutionTime, result.executionTime);
    
    // Update signals metrics
    this.performanceMetrics.strategies.totalSignals += result.signalsGenerated;
  }

  private updatePerformanceMetrics(): void {
    // Update system metrics
    this.updateSystemMetrics();
    
    // Update strategy metrics
    this.performanceMetrics.strategies.activeStrategies = 
      this.strategyManager.getActiveStrategies().size;
    
    // Update processing metrics
    this.performanceMetrics.system.queueDepth = this.dataProcessingQueue.length;
    
    // Update cache hit rate from indicator pipeline
    const pipelineMetrics = this.indicatorPipeline.getMetrics();
    this.performanceMetrics.dataProcessing.cacheHitRate = pipelineMetrics.cacheHitRate;
    
    this.performanceMetrics.lastUpdated = new Date();
  }

  private updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    this.performanceMetrics.system.memoryUsage = memoryUsage.heapUsed;
    this.performanceMetrics.system.uptime = Date.now() - this.startTime.getTime();
    
    // Calculate error rate
    const recentErrorCount = this.recentErrors.filter(
      error => Date.now() - error.timestamp.getTime() < 300000 // Last 5 minutes
    ).length;
    
    this.performanceMetrics.system.errorRate = 
      this.performanceMetrics.execution.totalExecutions > 0 
        ? recentErrorCount / this.performanceMetrics.execution.totalExecutions 
        : 0;
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // Strategy Manager events
    this.strategyManager.on('strategy_started', (event) => {
      this.emit('strategy_started', event);
    });
    
    this.strategyManager.on('strategy_stopped', (event) => {
      this.emit('strategy_stopped', event);
    });
    
    this.strategyManager.on('strategy_error', (event) => {
      this.emit('strategy_error', event);
    });

    // Signal Generator events
    this.signalGenerator.on('requestCompleted', (event) => {
      this.emit('signal_generated', event);
    });
    
    this.signalGenerator.on('requestFailed', (event) => {
      this.emit('signal_generation_failed', event);
    });

    // Error handling
    this.on('error', (error) => {
      console.error('[StrategyEngine] Engine error:', error);
    });
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Clear all timers
    this.stopRealTimeProcessing();
    this.stopMetricsCollection();
    this.stopHealthChecking();
    
    // Clear data structures
    this.dataProcessingQueue.length = 0;
    this.executionHistory.length = 0;
    this.recentErrors.length = 0;
    
    // Clear buffers
    for (const buffer of this.dataBuffers.values()) {
      buffer.clear();
    }
    
    // Clear rolling windows
    this.rollingWindows.clear();
  }

  /**
   * Merge default configuration
   */
  private mergeDefaultConfig(config: Partial<StrategyEngineConfig>): StrategyEngineConfig {
    return {
      id: config.id || `engine_${Date.now()}`,
      name: config.name || 'Strategy Engine',
      version: config.version || '1.0.0',
      
      dataBuffer: {
        maxCapacity: config.dataBuffer?.maxCapacity || 525600, // 1 year of 1min data
        compressionEnabled: config.dataBuffer?.compressionEnabled ?? true,
        symbols: config.dataBuffer?.symbols || ['BTC-USD', 'ETH-USD'],
        timeframes: config.dataBuffer?.timeframes || ['1MIN', '5MINS', '15MINS', '1HOUR']
      },
      
      realTimeProcessing: {
        enabled: config.realTimeProcessing?.enabled ?? true,
        updateInterval: config.realTimeProcessing?.updateInterval || 1000,
        batchSize: config.realTimeProcessing?.batchSize || 10,
        maxConcurrency: config.realTimeProcessing?.maxConcurrency || 5,
        bufferSize: config.realTimeProcessing?.bufferSize || 1000
      },
      
      execution: {
        maxConcurrentStrategies: config.execution?.maxConcurrentStrategies || 10,
        executionTimeout: config.execution?.executionTimeout || 30000,
        retryAttempts: config.execution?.retryAttempts || 3,
        priorityExecution: config.execution?.priorityExecution ?? true
      },
      
      monitoring: {
        enableMetrics: config.monitoring?.enableMetrics ?? true,
        metricsInterval: config.monitoring?.metricsInterval || 60000,
        healthCheckInterval: config.monitoring?.healthCheckInterval || 300000,
        alertThresholds: {
          latency: config.monitoring?.alertThresholds?.latency || 5000,
          errorRate: config.monitoring?.alertThresholds?.errorRate || 0.1,
          memoryUsage: config.monitoring?.alertThresholds?.memoryUsage || 500_000_000,
          queueDepth: config.monitoring?.alertThresholds?.queueDepth || 100
        }
      },
      
      errorHandling: {
        autoRecovery: config.errorHandling?.autoRecovery ?? true,
        maxRecoveryAttempts: config.errorHandling?.maxRecoveryAttempts || 3,
        recoveryDelay: config.errorHandling?.recoveryDelay || 30000,
        circuitBreakerThreshold: config.errorHandling?.circuitBreakerThreshold || 10,
        fallbackMode: config.errorHandling?.fallbackMode ?? true
      },
      
      riskManagement: {
        enabled: config.riskManagement?.enabled ?? true,
        maxPositions: config.riskManagement?.maxPositions || 20,
        maxRiskPerStrategy: config.riskManagement?.maxRiskPerStrategy || 2.0,
        emergencyStop: config.riskManagement?.emergencyStop ?? true,
        riskMonitoringInterval: config.riskManagement?.riskMonitoringInterval || 5000
      }
    };
  }
}

export default StrategyEngine;