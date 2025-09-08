/**
 * Strategy Execution Engine - Task BE-020 (Enhanced)
 * 
 * Real-time strategy execution orchestration system that bridges the gap between
 * strategy signal generation and actual trade execution. Provides multi-strategy
 * concurrent execution, resource management, and comprehensive performance tracking.
 * 
 * Features:
 * - Real-time execution orchestration with sub-50ms latency
 * - Multi-strategy concurrent execution (10+ strategies)
 * - Signal-to-trade conversion with intelligent order management
 * - Execution queuing with priority management
 * - Memory-efficient resource monitoring (< 500MB per strategy)
 * - Paper trading and live execution modes
 * - Comprehensive error handling and recovery mechanisms
 * - Integration with Strategy Engine, Risk Controller, and Protection Mechanisms
 */

import { EventEmitter } from 'events';
import type {
  StrategySignal,
  StrategyContext,
  Position,
  MarketDataWindow,
  StrategyMetrics
} from '../strategies/types.js';
import type { TradeDecision } from '../engine/StrategyEngine.js';
import { StrategyEngine } from '../engine/StrategyEngine.js';
import { RiskController } from '../engine/RiskController.js';
import { ProtectionMechanisms } from '../engine/ProtectionMechanisms.js';
import { ExecutionOrchestrator } from './ExecutionOrchestrator.js';
import { OrderExecutor } from './OrderExecutor.js';
import type { TradeRepository } from '../repositories/index.js';

/**
 * Execution Mode
 */
export type ExecutionMode = 'paper' | 'live' | 'simulation' | 'backtest';

/**
 * Execution Priority
 */
export type ExecutionPriority = 'urgent' | 'high' | 'normal' | 'low';

/**
 * Execution Status
 */
export type ExecutionStatus = 'idle' | 'processing' | 'executing' | 'paused' | 'stopped' | 'error';

/**
 * Execution Request
 */
export interface ExecutionRequest {
  id: string;
  tradeDecision: TradeDecision;
  priority: ExecutionPriority;
  mode: ExecutionMode;
  timestamp: Date;
  maxLatency: number;
  retryAttempts: number;
  metadata: {
    strategyId: string;
    executionEngine: string;
    requestedAt: Date;
  };
}

/**
 * Execution Result
 */
export interface ExecutionResult {
  requestId: string;
  success: boolean;
  executionTime: number;
  orderId?: string;
  fillPrice?: number;
  fillQuantity?: number;
  slippage?: number;
  fees?: number;
  error?: Error;
  retryCount: number;
  metadata: {
    latency: number;
    executionPath: string[];
    resourceUsage: {
      memory: number;
      cpu: number;
      networkCalls: number;
    };
  };
  timestamp: Date;
  completedAt: Date;
}

/**
 * Execution Queue Item
 */
interface ExecutionQueueItem {
  request: ExecutionRequest;
  priority: number;
  addedAt: Date;
  attempts: number;
  lastAttempt?: Date;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
}

/**
 * Execution Engine Configuration
 */
export interface ExecutionEngineConfig {
  // Performance targets
  maxLatency: number;              // Maximum execution latency (ms)
  maxConcurrentExecutions: number; // Maximum concurrent executions
  maxQueueSize: number;           // Maximum queue size
  
  // Resource limits
  maxMemoryUsage: number;         // Maximum memory usage (MB)
  maxStrategies: number;          // Maximum supported strategies
  
  // Execution settings
  defaultMode: ExecutionMode;     // Default execution mode
  retryAttempts: number;         // Default retry attempts
  retryDelay: number;            // Retry delay (ms)
  queueTimeout: number;          // Queue timeout (ms)
  
  // Monitoring
  metricsInterval: number;        // Metrics collection interval (ms)
  healthCheckInterval: number;    // Health check interval (ms)
  performanceWindow: number;      // Performance tracking window (ms)
  
  // Thresholds
  errorRateThreshold: number;     // Error rate threshold (%)
  latencyThreshold: number;       // Latency alert threshold (ms)
  memoryThreshold: number;        // Memory usage threshold (MB)
  
  // Recovery settings
  enableCircuitBreaker: boolean;  // Enable circuit breaker
  circuitBreakerThreshold: number; // Circuit breaker error threshold
  recoveryTime: number;          // Recovery time after circuit break (ms)
}

/**
 * Execution Engine Metrics
 */
export interface ExecutionEngineMetrics {
  // Execution statistics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageLatency: number;
  executionsPerSecond: number;
  
  // Queue statistics
  queueSize: number;
  averageQueueTime: number;
  maxQueueTime: number;
  queuedRequests: number;
  
  // Resource utilization
  memoryUsage: number;
  cpuUsage: number;
  activeExecutions: number;
  
  // Performance metrics
  errorRate: number;
  p99Latency: number;
  p95Latency: number;
  p50Latency: number;
  throughput: number;
  
  // Strategy metrics
  activeStrategies: number;
  strategiesExecuting: number;
  totalSignalsProcessed: number;
  
  lastUpdated: Date;
}

/**
 * Circuit Breaker State
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  
  constructor(
    private threshold: number,
    private recoveryTime: number
  ) {}
  
  canExecute(): boolean {
    if (this.state === 'closed') return true;
    
    if (this.state === 'open' && this.nextRetryTime && new Date() >= this.nextRetryTime) {
      this.state = 'half-open';
      return true;
    }
    
    return this.state === 'half-open';
  }
  
  onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
    }
  }
  
  onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      this.nextRetryTime = new Date(Date.now() + this.recoveryTime);
    }
  }
  
  getState(): { state: string; failures: number; nextRetryTime?: Date; } {
    return {
      state: this.state,
      failures: this.failures,
      nextRetryTime: this.nextRetryTime
    };
  }
}

/**
 * Performance Tracker
 */
class PerformanceTracker {
  private latencies: number[] = [];
  private executionTimes: number[] = [];
  private errorCounts: number[] = [];
  private windowSize = 1000;
  
  recordExecution(latency: number, executionTime: number, success: boolean): void {
    this.latencies.push(latency);
    this.executionTimes.push(executionTime);
    this.errorCounts.push(success ? 0 : 1);
    
    // Keep only recent measurements
    if (this.latencies.length > this.windowSize) {
      this.latencies = this.latencies.slice(-this.windowSize);
      this.executionTimes = this.executionTimes.slice(-this.windowSize);
      this.errorCounts = this.errorCounts.slice(-this.windowSize);
    }
  }
  
  getMetrics() {
    if (this.latencies.length === 0) {
      return { avgLatency: 0, p99: 0, p95: 0, p50: 0, errorRate: 0 };
    }
    
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const errorRate = this.errorCounts.reduce((sum, err) => sum + err, 0) / this.errorCounts.length;
    
    return {
      avgLatency: this.latencies.reduce((sum, val) => sum + val, 0) / this.latencies.length,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      errorRate: errorRate * 100
    };
  }
}

/**
 * Main Strategy Execution Engine
 */
export class StrategyExecutionEngine extends EventEmitter {
  private config: ExecutionEngineConfig;
  private status: ExecutionStatus = 'idle';
  
  // Core components
  private strategyEngine: StrategyEngine;
  private riskController: RiskController;
  private protectionMechanisms: ProtectionMechanisms;
  private executionOrchestrator: ExecutionOrchestrator;
  private orderExecutor: OrderExecutor;
  
  // Repositories
  private tradeRepository: TradeRepository;
  
  // Execution management
  private executionQueue: ExecutionQueueItem[] = [];
  private activeExecutions: Map<string, Promise<ExecutionResult>> = new Map();
  private executionResults: Map<string, ExecutionResult> = new Map();
  
  // Performance monitoring
  private performanceTracker: PerformanceTracker;
  private circuitBreaker: CircuitBreaker;
  private metrics: ExecutionEngineMetrics;
  
  // Timers
  private metricsTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private queueProcessor?: NodeJS.Timeout;
  
  // State tracking
  private startTime: Date;
  private isProcessingQueue = false;
  private resourceMonitor: {
    memoryUsage: number;
    cpuUsage: number;
    lastCheck: Date;
  };

  constructor(
    config: Partial<ExecutionEngineConfig>,
    dependencies: {
      strategyEngine: StrategyEngine;
      riskController: RiskController;
      protectionMechanisms: ProtectionMechanisms;
      tradeRepository: TradeRepository;
    }
  ) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.strategyEngine = dependencies.strategyEngine;
    this.riskController = dependencies.riskController;
    this.protectionMechanisms = dependencies.protectionMechanisms;
    this.tradeRepository = dependencies.tradeRepository;
    
    // Initialize components
    this.executionOrchestrator = new ExecutionOrchestrator(this.config, {
      riskController: this.riskController,
      protectionMechanisms: this.protectionMechanisms
    });
    
    this.orderExecutor = new OrderExecutor({
      mode: this.config.defaultMode,
      retryAttempts: this.config.retryAttempts,
      retryDelay: this.config.retryDelay
    });
    
    this.performanceTracker = new PerformanceTracker();
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.recoveryTime
    );
    
    this.startTime = new Date();
    this.metrics = this.initializeMetrics();
    this.resourceMonitor = {
      memoryUsage: 0,
      cpuUsage: 0,
      lastCheck: new Date()
    };
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the execution engine
   */
  async initialize(): Promise<void> {
    try {
      this.status = 'processing';
      
      // Initialize components
      await this.executionOrchestrator.initialize();
      await this.orderExecutor.initialize();
      
      // Start monitoring
      this.startMetricsCollection();
      this.startHealthChecks();
      this.startQueueProcessor();
      
      this.status = 'idle';
      this.emit('initialized', { 
        maxLatency: this.config.maxLatency,
        maxConcurrentExecutions: this.config.maxConcurrentExecutions,
        defaultMode: this.config.defaultMode
      });
      
    } catch (error) {
      this.status = 'error';
      throw new Error(`Failed to initialize execution engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute trade decision
   */
  async executeTradeDecision(
    tradeDecision: TradeDecision,
    options: {
      priority?: ExecutionPriority;
      mode?: ExecutionMode;
      maxLatency?: number;
    } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      const result = this.createErrorResult(
        `circuit_breaker_${Date.now()}`,
        new Error('Circuit breaker open'),
        startTime
      );
      this.emit('execution_rejected', { reason: 'circuit_breaker', tradeDecision });
      return result;
    }
    
    // Check capacity
    if (this.executionQueue.length >= this.config.maxQueueSize) {
      const result = this.createErrorResult(
        `capacity_${Date.now()}`,
        new Error('Execution queue full'),
        startTime
      );
      this.emit('execution_rejected', { reason: 'queue_full', tradeDecision });
      return result;
    }
    
    // Create execution request
    const request: ExecutionRequest = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tradeDecision,
      priority: options.priority || 'normal',
      mode: options.mode || this.config.defaultMode,
      timestamp: new Date(),
      maxLatency: options.maxLatency || this.config.maxLatency,
      retryAttempts: this.config.retryAttempts,
      metadata: {
        strategyId: tradeDecision.signals[0]?.strategyId || 'unknown',
        executionEngine: 'StrategyExecutionEngine',
        requestedAt: new Date()
      }
    };
    
    return new Promise<ExecutionResult>((resolve, reject) => {
      const queueItem: ExecutionQueueItem = {
        request,
        priority: this.mapPriorityToNumber(request.priority),
        addedAt: new Date(),
        attempts: 0,
        resolve,
        reject
      };
      
      // Add to queue with priority ordering
      this.addToQueue(queueItem);
      
      this.emit('execution_queued', {
        requestId: request.id,
        priority: request.priority,
        queueSize: this.executionQueue.length
      });
    });
  }

  /**
   * Execute multiple trade decisions in batch
   */
  async executeBatch(
    tradeDecisions: TradeDecision[],
    options: {
      priority?: ExecutionPriority;
      mode?: ExecutionMode;
      maxConcurrency?: number;
    } = {}
  ): Promise<ExecutionResult[]> {
    const maxConcurrency = Math.min(
      options.maxConcurrency || this.config.maxConcurrentExecutions,
      this.config.maxConcurrentExecutions
    );
    
    const results: ExecutionResult[] = [];
    const batches: TradeDecision[][] = [];
    
    // Split into batches
    for (let i = 0; i < tradeDecisions.length; i += maxConcurrency) {
      batches.push(tradeDecisions.slice(i, i + maxConcurrency));
    }
    
    // Execute batches sequentially
    for (const batch of batches) {
      const batchPromises = batch.map(decision =>
        this.executeTradeDecision(decision, options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : 
        this.createErrorResult(
          `batch_error_${Date.now()}`,
          result.status === 'rejected' ? result.reason : new Error('Unknown batch error'),
          Date.now()
        )
      ));
    }
    
    return results;
  }

  /**
   * Start execution engine
   */
  async start(): Promise<void> {
    if (this.status === 'executing') return;
    
    this.status = 'executing';
    
    // Ensure queue processor is running
    if (!this.queueProcessor) {
      this.startQueueProcessor();
    }
    
    this.emit('started', { timestamp: new Date() });
  }

  /**
   * Pause execution engine
   */
  async pause(): Promise<void> {
    this.status = 'paused';
    this.emit('paused', { timestamp: new Date() });
  }

  /**
   * Resume execution engine
   */
  async resume(): Promise<void> {
    if (this.status === 'paused') {
      this.status = 'executing';
      this.emit('resumed', { timestamp: new Date() });
    }
  }

  /**
   * Stop execution engine
   */
  async stop(): Promise<void> {
    this.status = 'stopped';
    
    // Stop timers
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.queueProcessor) clearInterval(this.queueProcessor);
    
    // Wait for active executions to complete
    await Promise.allSettled(Array.from(this.activeExecutions.values()));
    
    // Clear queue
    this.executionQueue.forEach(item => {
      item.reject(new Error('Execution engine stopped'));
    });
    this.executionQueue = [];
    
    this.emit('stopped', { timestamp: new Date() });
  }

  /**
   * Get execution engine status
   */
  getStatus(): {
    status: ExecutionStatus;
    metrics: ExecutionEngineMetrics;
    queueSize: number;
    activeExecutions: number;
    circuitBreakerState: any;
    uptime: number;
  } {
    return {
      status: this.status,
      metrics: this.metrics,
      queueSize: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Get execution result by ID
   */
  getExecutionResult(requestId: string): ExecutionResult | null {
    return this.executionResults.get(requestId) || null;
  }

  /**
   * Clear execution results
   */
  clearResults(olderThan?: Date): number {
    let clearedCount = 0;
    const threshold = olderThan || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [id, result] of Array.from(this.executionResults.entries())) {
      if (result.timestamp < threshold) {
        this.executionResults.delete(id);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  // === PRIVATE METHODS ===

  private setupEventHandlers(): void {
    // Strategy Engine events
    this.strategyEngine.on('trade_decisions_generated', async (event) => {
      if (event.count > 0) {
        this.emit('signals_received', { count: event.count });
      }
    });

    // Orchestrator events
    this.executionOrchestrator.on('execution_prepared', (event) => {
      this.emit('execution_prepared', event);
    });

    this.executionOrchestrator.on('execution_rejected', (event) => {
      this.emit('execution_rejected', event);
    });

    // Order Executor events
    this.orderExecutor.on('order_placed', (event) => {
      this.emit('order_placed', event);
    });

    this.orderExecutor.on('order_filled', (event) => {
      this.emit('order_filled', event);
    });

    this.orderExecutor.on('order_failed', (event) => {
      this.emit('order_failed', event);
    });
  }

  private addToQueue(item: ExecutionQueueItem): void {
    // Insert with priority ordering (higher priority number = higher priority)
    let insertIndex = 0;
    while (insertIndex < this.executionQueue.length && 
           this.executionQueue[insertIndex].priority >= item.priority) {
      insertIndex++;
    }
    
    this.executionQueue.splice(insertIndex, 0, item);
  }

  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      this.processQueue().catch(error => {
        this.emit('queue_processing_error', error);
      });
    }, 10); // Process every 10ms for low latency
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.status !== 'executing' || this.executionQueue.length === 0) {
      return;
    }

    // Check if we can accept more executions
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const item = this.executionQueue.shift();
      if (!item) return;

      // Check timeout
      const queueTime = Date.now() - item.addedAt.getTime();
      if (queueTime > this.config.queueTimeout) {
        item.reject(new Error(`Queue timeout: ${queueTime}ms`));
        return;
      }

      // Execute the request
      const executionPromise = this.executeRequest(item.request);
      this.activeExecutions.set(item.request.id, executionPromise);

      executionPromise
        .then(result => {
          item.resolve(result);
          this.activeExecutions.delete(item.request.id);
          this.executionResults.set(item.request.id, result);
          
          // Update circuit breaker
          if (result.success) {
            this.circuitBreaker.onSuccess();
          } else {
            this.circuitBreaker.onFailure();
          }
          
          // Update performance tracking
          this.performanceTracker.recordExecution(
            result.metadata.latency,
            result.executionTime,
            result.success
          );
        })
        .catch(error => {
          item.reject(error);
          this.activeExecutions.delete(item.request.id);
          this.circuitBreaker.onFailure();
        });

    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async executeRequest(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Orchestrate the execution
      const orchestrationResult = await this.executionOrchestrator.orchestrateExecution(
        request.tradeDecision,
        {
          mode: request.mode,
          maxLatency: request.maxLatency,
          priority: request.priority
        }
      );

      if (!orchestrationResult.approved) {
        return {
          requestId: request.id,
          success: false,
          executionTime: Date.now() - startTime,
          error: new Error(`Execution not approved: ${orchestrationResult.reasons.join(', ')}`),
          retryCount: 0,
          metadata: {
            latency: Date.now() - startTime,
            executionPath: ['orchestrator_rejection'],
            resourceUsage: this.getCurrentResourceUsage()
          },
          timestamp: request.timestamp,
          completedAt: new Date()
        };
      }

      // Execute the order
      const orderResult = await this.orderExecutor.executeOrder(
        orchestrationResult.executionPlan,
        { mode: request.mode }
      );

      return {
        requestId: request.id,
        success: orderResult.success,
        executionTime: Date.now() - startTime,
        orderId: orderResult.orderId,
        fillPrice: orderResult.fillPrice,
        fillQuantity: orderResult.fillQuantity,
        slippage: orderResult.slippage,
        fees: orderResult.fees,
        error: orderResult.error,
        retryCount: orderResult.retryCount || 0,
        metadata: {
          latency: Date.now() - startTime,
          executionPath: ['orchestrator', 'order_executor'],
          resourceUsage: this.getCurrentResourceUsage()
        },
        timestamp: request.timestamp,
        completedAt: new Date()
      };

    } catch (error) {
      return this.createErrorResult(request.id, error as Error, startTime);
    }
  }

  private createErrorResult(requestId: string, error: Error, startTime: number): ExecutionResult {
    return {
      requestId,
      success: false,
      executionTime: Date.now() - startTime,
      error,
      retryCount: 0,
      metadata: {
        latency: Date.now() - startTime,
        executionPath: ['error'],
        resourceUsage: this.getCurrentResourceUsage()
      },
      timestamp: new Date(),
      completedAt: new Date()
    };
  }

  private getCurrentResourceUsage() {
    const memUsage = process.memoryUsage();
    return {
      memory: memUsage.heapUsed / 1024 / 1024, // MB
      cpu: process.cpuUsage().user / 1000, // ms
      networkCalls: 0 // Would track actual network calls
    };
  }

  private mapPriorityToNumber(priority: ExecutionPriority): number {
    const map = { urgent: 4, high: 3, normal: 2, low: 1 };
    return map[priority] || 2;
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.metricsInterval);
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.emit('health_check_error', error);
      });
    }, this.config.healthCheckInterval);
  }

  private updateMetrics(): void {
    const performanceMetrics = this.performanceTracker.getMetrics();
    const memUsage = process.memoryUsage();
    
    this.metrics = {
      totalExecutions: this.metrics.totalExecutions,
      successfulExecutions: this.metrics.successfulExecutions,
      failedExecutions: this.metrics.failedExecutions,
      averageLatency: performanceMetrics.avgLatency,
      executionsPerSecond: this.calculateExecutionsPerSecond(),
      
      queueSize: this.executionQueue.length,
      averageQueueTime: this.calculateAverageQueueTime(),
      maxQueueTime: this.calculateMaxQueueTime(),
      queuedRequests: this.executionQueue.length,
      
      memoryUsage: memUsage.heapUsed / 1024 / 1024,
      cpuUsage: 0, // Would calculate actual CPU usage
      activeExecutions: this.activeExecutions.size,
      
      errorRate: performanceMetrics.errorRate,
      p99Latency: performanceMetrics.p99,
      p95Latency: performanceMetrics.p95,
      p50Latency: performanceMetrics.p50,
      throughput: this.calculateThroughput(),
      
      activeStrategies: 0, // Would track from strategy engine
      strategiesExecuting: 0, // Would track active strategy executions
      totalSignalsProcessed: this.metrics.totalSignalsProcessed,
      
      lastUpdated: new Date()
    };
  }

  private async performHealthCheck(): Promise<void> {
    // Check memory usage
    if (this.metrics.memoryUsage > this.config.memoryThreshold) {
      this.emit('health_warning', {
        type: 'memory',
        current: this.metrics.memoryUsage,
        threshold: this.config.memoryThreshold
      });
    }

    // Check latency
    if (this.metrics.averageLatency > this.config.latencyThreshold) {
      this.emit('health_warning', {
        type: 'latency',
        current: this.metrics.averageLatency,
        threshold: this.config.latencyThreshold
      });
    }

    // Check error rate
    if (this.metrics.errorRate > this.config.errorRateThreshold) {
      this.emit('health_warning', {
        type: 'error_rate',
        current: this.metrics.errorRate,
        threshold: this.config.errorRateThreshold
      });
    }
  }

  private calculateExecutionsPerSecond(): number {
    // Simplified calculation
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    return uptime > 0 ? this.metrics.totalExecutions / uptime : 0;
  }

  private calculateAverageQueueTime(): number {
    if (this.executionQueue.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = this.executionQueue.reduce((sum, item) => 
      sum + (now - item.addedAt.getTime()), 0);
    
    return totalWaitTime / this.executionQueue.length;
  }

  private calculateMaxQueueTime(): number {
    if (this.executionQueue.length === 0) return 0;
    
    const now = Date.now();
    return Math.max(...this.executionQueue.map(item => now - item.addedAt.getTime()));
  }

  private calculateThroughput(): number {
    // Requests processed per second (simplified)
    return this.calculateExecutionsPerSecond();
  }

  private initializeMetrics(): ExecutionEngineMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageLatency: 0,
      executionsPerSecond: 0,
      queueSize: 0,
      averageQueueTime: 0,
      maxQueueTime: 0,
      queuedRequests: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeExecutions: 0,
      errorRate: 0,
      p99Latency: 0,
      p95Latency: 0,
      p50Latency: 0,
      throughput: 0,
      activeStrategies: 0,
      strategiesExecuting: 0,
      totalSignalsProcessed: 0,
      lastUpdated: new Date()
    };
  }

  private mergeWithDefaults(config: Partial<ExecutionEngineConfig>): ExecutionEngineConfig {
    return {
      maxLatency: 50,                    // 50ms target
      maxConcurrentExecutions: 10,       // 10 concurrent executions
      maxQueueSize: 1000,               // 1000 queued requests
      maxMemoryUsage: 500,              // 500MB memory limit
      maxStrategies: 20,                // 20 strategies max
      defaultMode: 'paper',             // Paper trading default
      retryAttempts: 3,                 // 3 retry attempts
      retryDelay: 1000,                 // 1 second retry delay
      queueTimeout: 30000,              // 30 second queue timeout
      metricsInterval: 1000,            // 1 second metrics update
      healthCheckInterval: 5000,        // 5 second health checks
      performanceWindow: 60000,         // 1 minute performance window
      errorRateThreshold: 5,            // 5% error rate threshold
      latencyThreshold: 100,            // 100ms latency threshold
      memoryThreshold: 400,             // 400MB memory threshold
      enableCircuitBreaker: true,       // Enable circuit breaker
      circuitBreakerThreshold: 10,      // 10 failures to open circuit
      recoveryTime: 60000,              // 1 minute recovery time
      ...config
    };
  }
}

export default StrategyExecutionEngine;