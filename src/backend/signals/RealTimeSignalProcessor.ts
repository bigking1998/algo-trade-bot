/**
 * Real-Time Signal Processor - Task BE-014: Signal Generation System
 * 
 * High-performance real-time signal processing engine with:
 * - Market data stream integration
 * - Continuous condition monitoring
 * - Real-time signal generation and dispatch
 * - Performance optimization for low-latency processing
 * - Advanced throttling and backpressure management
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type {
  SignalGenerationRequest,
  SignalGenerationResult,
  SignalProcessingEvent
} from './types.js';
import type {
  StrategyContext,
  StrategySignal,
  MarketDataWindow
} from '../strategies/types.js';
import type {
  ConditionExpression
} from '../conditions/types.js';
import { SignalGenerator } from './SignalGenerator.js';
import { SignalHistoryManager } from './SignalHistoryManager.js';

/**
 * Real-time processing configuration
 */
export interface RealTimeProcessingConfig {
  // Processing intervals
  marketDataInterval: number; // milliseconds
  signalGenerationInterval: number; // milliseconds
  conditionEvaluationInterval: number; // milliseconds
  
  // Throttling and backpressure
  maxRequestsPerSecond: number;
  maxConcurrentRequests: number;
  backpressureThreshold: number;
  
  // Performance optimization
  enableBatching: boolean;
  batchSize: number;
  priorityQueues: boolean;
  
  // Market data integration
  marketDataBufferSize: number;
  enableMarketDataFiltering: boolean;
  significantPriceChangeThreshold: number; // percentage
  
  // Strategy management
  enabledStrategies: Set<string>;
  strategyUpdateInterval: number;
  
  // Health monitoring
  healthCheckInterval: number;
  performanceMetricsInterval: number;
  maxMemoryUsage: number; // bytes
}

/**
 * Processing queue item
 */
interface QueuedRequest {
  id: string;
  request: SignalGenerationRequest;
  priority: number;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

/**
 * Market data stream event
 */
interface MarketDataStreamEvent {
  symbol: string;
  data: MarketDataWindow;
  timestamp: Date;
  significant: boolean; // Whether this update is significant enough to trigger processing
}

/**
 * Performance metrics
 */
interface RealTimePerformanceMetrics {
  // Processing metrics
  requestsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  
  // Queue metrics
  queueSize: number;
  averageQueueTime: number;
  droppedRequests: number;
  
  // Resource metrics
  memoryUsage: number;
  cpuUsage: number;
  
  // Market data metrics
  marketDataUpdatesPerSecond: number;
  significantUpdatesPerSecond: number;
  
  // Error metrics
  errorRate: number;
  timeoutRate: number;
  
  lastUpdated: Date;
}

// =============================================================================
// REAL-TIME SIGNAL PROCESSOR IMPLEMENTATION
// =============================================================================

export class RealTimeSignalProcessor extends EventEmitter {
  private readonly config: RealTimeProcessingConfig;
  private readonly signalGenerator: SignalGenerator;
  private readonly historyManager: SignalHistoryManager;
  
  // Processing state
  private isProcessing = false;
  private readonly requestQueue: QueuedRequest[] = [];
  private readonly highPriorityQueue: QueuedRequest[] = [];
  private activeBatchCount = 0;
  
  // Market data integration
  private readonly marketDataBuffer = new Map<string, MarketDataWindow>();
  private readonly strategyContexts = new Map<string, StrategyContext>();
  
  // Strategy monitoring
  private readonly activeStrategies = new Map<string, {
    conditions: ConditionExpression[];
    lastUpdate: Date;
    lastSignal: Date;
    enabled: boolean;
  }>();
  
  // Performance tracking
  private readonly performanceMetrics: RealTimePerformanceMetrics;
  private readonly latencyMeasurements: number[] = [];
  private readonly requestTimestamps: Date[] = [];
  
  // Background intervals
  private processingInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private strategyUpdateInterval?: NodeJS.Timeout;
  
  private requestCounter = 0;

  constructor(
    config: Partial<RealTimeProcessingConfig> = {},
    signalGenerator?: SignalGenerator,
    historyManager?: SignalHistoryManager
  ) {
    super();
    
    this.config = this.mergeDefaultConfig(config);
    this.signalGenerator = signalGenerator || new SignalGenerator();
    this.historyManager = historyManager || new SignalHistoryManager();
    
    this.performanceMetrics = this.initializeMetrics();
    
    this.setupEventHandlers();
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // CORE REAL-TIME PROCESSING
  // =============================================================================

  /**
   * Start real-time processing
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    // Start processing intervals
    this.processingInterval = setInterval(
      () => this.processRequestQueue(),
      this.config.signalGenerationInterval
    );
    
    this.metricsInterval = setInterval(
      () => this.updatePerformanceMetrics(),
      this.config.performanceMetricsInterval
    );
    
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    );
    
    this.strategyUpdateInterval = setInterval(
      () => this.updateStrategyContexts(),
      this.config.strategyUpdateInterval
    );
    
    this.emit('processingStarted', { timestamp: new Date() });
  }

  /**
   * Stop real-time processing
   */
  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    
    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    if (this.strategyUpdateInterval) {
      clearInterval(this.strategyUpdateInterval);
      this.strategyUpdateInterval = undefined;
    }
    
    // Process remaining requests
    await this.drainRequestQueue();
    
    this.emit('processingStopped', { timestamp: new Date() });
  }

  /**
   * Process market data update
   */
  async processMarketDataUpdate(
    symbol: string,
    marketData: MarketDataWindow
  ): Promise<void> {
    const previousData = this.marketDataBuffer.get(symbol);
    
    // Check if this is a significant update
    const isSignificant = this.isSignificantMarketUpdate(previousData, marketData);
    
    // Update buffer
    this.marketDataBuffer.set(symbol, marketData);
    
    // Create market data event
    const event: MarketDataStreamEvent = {
      symbol,
      data: marketData,
      timestamp: new Date(),
      significant: isSignificant
    };
    
    this.emit('marketDataReceived', event);
    
    // If significant, trigger signal generation for relevant strategies
    if (isSignificant || !previousData) {
      await this.triggerSignalGeneration(symbol, marketData);
    }
  }

  /**
   * Queue signal generation request
   */
  async queueSignalGeneration(
    request: SignalGenerationRequest,
    priority: number = 5
  ): Promise<string> {
    // Check backpressure
    if (this.isBackpressureActive()) {
      this.handleBackpressure(request);
      throw new Error('System under high load - request rejected');
    }
    
    // Create queued request
    const queuedRequest: QueuedRequest = {
      id: request.id || `rtreq_${++this.requestCounter}_${Date.now()}`,
      request,
      priority,
      timestamp: new Date(),
      retries: 0,
      maxRetries: 3
    };
    
    // Add to appropriate queue
    if (this.config.priorityQueues && priority >= 8) {
      this.highPriorityQueue.push(queuedRequest);
      // Sort by priority (highest first)
      this.highPriorityQueue.sort((a, b) => b.priority - a.priority);
    } else {
      this.requestQueue.push(queuedRequest);
    }
    
    this.emit('requestQueued', { 
      requestId: queuedRequest.id,
      priority,
      queueSize: this.getTotalQueueSize()
    });
    
    return queuedRequest.id;
  }

  /**
   * Process request queue
   */
  private async processRequestQueue(): Promise<void> {
    if (!this.isProcessing || this.activeBatchCount >= this.config.maxConcurrentRequests) {
      return;
    }
    
    // Determine batch size
    const availableSlots = this.config.maxConcurrentRequests - this.activeBatchCount;
    const batchSize = this.config.enableBatching ? 
      Math.min(this.config.batchSize, availableSlots) : 
      Math.min(1, availableSlots);
    
    if (batchSize <= 0) {
      return;
    }
    
    // Get requests from queues
    const batch: QueuedRequest[] = [];
    
    // First, process high-priority requests
    while (batch.length < batchSize && this.highPriorityQueue.length > 0) {
      batch.push(this.highPriorityQueue.shift()!);
    }
    
    // Then, process regular requests
    while (batch.length < batchSize && this.requestQueue.length > 0) {
      batch.push(this.requestQueue.shift()!);
    }
    
    if (batch.length === 0) {
      return;
    }
    
    this.activeBatchCount++;
    
    // Process batch
    this.processBatch(batch).finally(() => {
      this.activeBatchCount--;
    });
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(batch: QueuedRequest[]): Promise<void> {
    const batchStartTime = performance.now();
    
    this.emit('batchStarted', { 
      batchSize: batch.length,
      timestamp: new Date()
    });
    
    // Process requests concurrently
    const promises = batch.map(async (queuedRequest) => {
      const startTime = performance.now();
      
      try {
        // Generate signals
        const result = await this.signalGenerator.generateSignals(queuedRequest.request);
        
        // Track performance
        const latency = performance.now() - startTime;
        this.trackLatency(latency);
        
        // Store successful signals in history
        if (result.success && result.signals.length > 0) {
          for (const signal of result.signals) {
            try {
              await this.historyManager.addSignal(signal, queuedRequest.request.context);
            } catch (error) {
              this.emit('historyError', { signal, error });
            }
          }
        }
        
        this.emit('requestProcessed', {
          requestId: queuedRequest.id,
          result,
          latency,
          queueTime: startTime - queuedRequest.timestamp.getTime()
        });
        
        return { request: queuedRequest, result, error: null };
        
      } catch (error) {
        const latency = performance.now() - startTime;
        
        // Handle retries
        if (queuedRequest.retries < queuedRequest.maxRetries) {
          queuedRequest.retries++;
          
          // Re-queue with lower priority
          const retryRequest = { 
            ...queuedRequest, 
            priority: Math.max(1, queuedRequest.priority - 1)
          };
          
          this.requestQueue.push(retryRequest);
          
          this.emit('requestRetry', {
            requestId: queuedRequest.id,
            retry: queuedRequest.retries,
            error
          });
        } else {
          this.emit('requestFailed', {
            requestId: queuedRequest.id,
            error,
            finalAttempt: true
          });
        }
        
        return { request: queuedRequest, result: null, error };
      }
    });
    
    await Promise.allSettled(promises);
    
    const batchTime = performance.now() - batchStartTime;
    
    this.emit('batchCompleted', {
      batchSize: batch.length,
      processingTime: batchTime,
      timestamp: new Date()
    });
  }

  // =============================================================================
  // STRATEGY AND MARKET DATA MANAGEMENT
  // =============================================================================

  /**
   * Register strategy for real-time monitoring
   */
  async registerStrategy(
    strategyId: string,
    conditions: ConditionExpression[],
    enabled: boolean = true
  ): Promise<void> {
    this.activeStrategies.set(strategyId, {
      conditions: [...conditions],
      lastUpdate: new Date(),
      lastSignal: new Date(0),
      enabled
    });
    
    this.config.enabledStrategies.add(strategyId);
    
    this.emit('strategyRegistered', { 
      strategyId,
      conditionCount: conditions.length,
      enabled
    });
  }

  /**
   * Update strategy conditions
   */
  async updateStrategy(
    strategyId: string,
    conditions: ConditionExpression[],
    enabled?: boolean
  ): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }
    
    strategy.conditions = [...conditions];
    strategy.lastUpdate = new Date();
    
    if (enabled !== undefined) {
      strategy.enabled = enabled;
      
      if (enabled) {
        this.config.enabledStrategies.add(strategyId);
      } else {
        this.config.enabledStrategies.delete(strategyId);
      }
    }
    
    this.emit('strategyUpdated', { 
      strategyId,
      conditionCount: conditions.length,
      enabled: strategy.enabled
    });
  }

  /**
   * Trigger signal generation for symbol
   */
  private async triggerSignalGeneration(
    symbol: string,
    marketData: MarketDataWindow
  ): Promise<void> {
    // Find strategies that trade this symbol
    for (const [strategyId, strategy] of this.activeStrategies) {
      if (!strategy.enabled || !this.config.enabledStrategies.has(strategyId)) {
        continue;
      }
      
      // Check if strategy context exists and is updated
      const context = this.strategyContexts.get(strategyId);
      if (!context || context.marketData.symbol !== symbol) {
        continue;
      }
      
      // Update market data in context
      const updatedContext: StrategyContext = {
        ...context,
        marketData,
        timestamp: new Date()
      };
      
      // Create signal generation request
      const request: SignalGenerationRequest = {
        id: `rt_${strategyId}_${symbol}_${Date.now()}`,
        strategyId,
        context: updatedContext,
        conditions: strategy.conditions,
        timestamp: new Date(),
        priority: 'medium'
      };
      
      // Queue request with appropriate priority
      const priority = this.calculateRequestPriority(symbol, marketData, strategy);
      
      try {
        await this.queueSignalGeneration(request, priority);
      } catch (error) {
        this.emit('queueError', { 
          strategyId,
          symbol,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
  }

  /**
   * Update strategy contexts with latest data
   */
  private async updateStrategyContexts(): Promise<void> {
    // This would typically integrate with the broader strategy management system
    // For now, we maintain basic context updates based on market data
    
    for (const [symbol, marketData] of this.marketDataBuffer) {
      // Update contexts for strategies trading this symbol
      for (const strategyId of this.config.enabledStrategies) {
        const existingContext = this.strategyContexts.get(strategyId);
        
        if (existingContext && existingContext.marketData.symbol === symbol) {
          // Update with latest market data
          this.strategyContexts.set(strategyId, {
            ...existingContext,
            marketData,
            timestamp: new Date()
          });
        }
      }
    }
  }

  // =============================================================================
  // PERFORMANCE AND HEALTH MONITORING
  // =============================================================================

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const now = new Date();
    const windowMs = this.config.performanceMetricsInterval * 5; // 5 intervals
    
    // Filter recent requests
    const recentTimestamps = this.requestTimestamps.filter(
      timestamp => now.getTime() - timestamp.getTime() < windowMs
    );
    
    // Filter recent latencies
    const recentLatencies = this.latencyMeasurements.slice(-100); // Last 100 measurements
    
    // Calculate metrics
    this.performanceMetrics.requestsPerSecond = 
      (recentTimestamps.length / windowMs) * 1000;
    
    if (recentLatencies.length > 0) {
      recentLatencies.sort((a, b) => a - b);
      this.performanceMetrics.averageLatency = 
        recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length;
      this.performanceMetrics.p95Latency = 
        recentLatencies[Math.floor(recentLatencies.length * 0.95)];
      this.performanceMetrics.p99Latency = 
        recentLatencies[Math.floor(recentLatencies.length * 0.99)];
    }
    
    // Queue metrics
    this.performanceMetrics.queueSize = this.getTotalQueueSize();
    
    // Memory usage
    const memUsage = process.memoryUsage();
    this.performanceMetrics.memoryUsage = memUsage.heapUsed;
    
    this.performanceMetrics.lastUpdated = now;
    
    this.emit('metricsUpdated', { metrics: this.performanceMetrics });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const issues: string[] = [];
    let healthScore = 100;
    
    // Check queue size
    const queueSize = this.getTotalQueueSize();
    if (queueSize > this.config.backpressureThreshold) {
      issues.push(`Queue size too large: ${queueSize}`);
      healthScore -= 25;
    }
    
    // Check memory usage
    if (this.performanceMetrics.memoryUsage > this.config.maxMemoryUsage) {
      issues.push('Memory usage too high');
      healthScore -= 30;
    }
    
    // Check error rate
    if (this.performanceMetrics.errorRate > 0.1) {
      issues.push('High error rate detected');
      healthScore -= 25;
    }
    
    // Check latency
    if (this.performanceMetrics.p95Latency > 5000) {
      issues.push('High latency detected');
      healthScore -= 20;
    }
    
    const healthStatus = {
      healthy: healthScore >= 70,
      score: Math.max(0, healthScore),
      issues,
      timestamp: new Date()
    };
    
    this.emit('healthCheck', healthStatus);
    
    // Take corrective actions if needed
    if (!healthStatus.healthy) {
      await this.handleUnhealthyState(healthStatus);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private mergeDefaultConfig(config: Partial<RealTimeProcessingConfig>): RealTimeProcessingConfig {
    return {
      marketDataInterval: config.marketDataInterval || 100,
      signalGenerationInterval: config.signalGenerationInterval || 500,
      conditionEvaluationInterval: config.conditionEvaluationInterval || 200,
      maxRequestsPerSecond: config.maxRequestsPerSecond || 100,
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      backpressureThreshold: config.backpressureThreshold || 1000,
      enableBatching: config.enableBatching ?? true,
      batchSize: config.batchSize || 5,
      priorityQueues: config.priorityQueues ?? true,
      marketDataBufferSize: config.marketDataBufferSize || 1000,
      enableMarketDataFiltering: config.enableMarketDataFiltering ?? true,
      significantPriceChangeThreshold: config.significantPriceChangeThreshold || 0.01,
      enabledStrategies: config.enabledStrategies || new Set(),
      strategyUpdateInterval: config.strategyUpdateInterval || 30000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      performanceMetricsInterval: config.performanceMetricsInterval || 10000,
      maxMemoryUsage: config.maxMemoryUsage || 512 * 1024 * 1024
    };
  }

  private initializeMetrics(): RealTimePerformanceMetrics {
    return {
      requestsPerSecond: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      queueSize: 0,
      averageQueueTime: 0,
      droppedRequests: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      marketDataUpdatesPerSecond: 0,
      significantUpdatesPerSecond: 0,
      errorRate: 0,
      timeoutRate: 0,
      lastUpdated: new Date()
    };
  }

  private setupEventHandlers(): void {
    // Handle signal generator events
    this.signalGenerator.on('requestCompleted', (event) => {
      this.emit('signalGenerated', event);
    });
    
    this.signalGenerator.on('requestFailed', (event) => {
      this.emit('signalGenerationFailed', event);
    });
  }

  private isSignificantMarketUpdate(
    previous: MarketDataWindow | undefined,
    current: MarketDataWindow
  ): boolean {
    if (!previous || !this.config.enableMarketDataFiltering) {
      return true;
    }
    
    const priceChange = Math.abs(current.currentPrice - previous.currentPrice);
    const priceChangePercent = priceChange / previous.currentPrice;
    
    return priceChangePercent >= this.config.significantPriceChangeThreshold;
  }

  private calculateRequestPriority(
    symbol: string,
    marketData: MarketDataWindow,
    strategy: { lastSignal: Date }
  ): number {
    let priority = 5; // Base priority
    
    // Increase priority based on price volatility
    if (marketData.change24hPercent && Math.abs(marketData.change24hPercent) > 5) {
      priority += 2;
    }
    
    // Increase priority if strategy hasn't generated signals recently
    const timeSinceLastSignal = Date.now() - strategy.lastSignal.getTime();
    if (timeSinceLastSignal > 3600000) { // 1 hour
      priority += 1;
    }
    
    return Math.min(10, priority);
  }

  private isBackpressureActive(): boolean {
    return this.getTotalQueueSize() > this.config.backpressureThreshold;
  }

  private handleBackpressure(request: SignalGenerationRequest): void {
    this.performanceMetrics.droppedRequests++;
    
    this.emit('requestDropped', {
      requestId: request.id,
      reason: 'backpressure',
      queueSize: this.getTotalQueueSize()
    });
  }

  private getTotalQueueSize(): number {
    return this.requestQueue.length + this.highPriorityQueue.length;
  }

  private trackLatency(latency: number): void {
    this.latencyMeasurements.push(latency);
    
    // Keep only recent measurements
    if (this.latencyMeasurements.length > 1000) {
      this.latencyMeasurements.splice(0, this.latencyMeasurements.length - 1000);
    }
    
    this.requestTimestamps.push(new Date());
    
    // Keep only recent timestamps
    if (this.requestTimestamps.length > 1000) {
      this.requestTimestamps.splice(0, this.requestTimestamps.length - 1000);
    }
  }

  private async drainRequestQueue(): Promise<void> {
    const allRequests = [...this.highPriorityQueue, ...this.requestQueue];
    this.highPriorityQueue.length = 0;
    this.requestQueue.length = 0;
    
    if (allRequests.length > 0) {
      this.emit('queueDrained', { 
        requestCount: allRequests.length,
        timestamp: new Date()
      });
      
      // Process remaining requests with final batch
      await this.processBatch(allRequests);
    }
  }

  private async handleUnhealthyState(healthStatus: any): Promise<void> {
    // Implement corrective actions
    if (healthStatus.score < 50) {
      // Temporarily reduce processing load
      this.config.maxConcurrentRequests = Math.max(1, this.config.maxConcurrentRequests / 2);
      this.config.batchSize = Math.max(1, this.config.batchSize / 2);
      
      this.emit('emergencyModeActivated', {
        reason: 'Low health score',
        adjustments: {
          maxConcurrentRequests: this.config.maxConcurrentRequests,
          batchSize: this.config.batchSize
        }
      });
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): RealTimePerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get processing status
   */
  getStatus(): {
    isProcessing: boolean;
    queueSize: number;
    activeBatches: number;
    registeredStrategies: number;
    marketDataSymbols: number;
  } {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.getTotalQueueSize(),
      activeBatches: this.activeBatchCount,
      registeredStrategies: this.activeStrategies.size,
      marketDataSymbols: this.marketDataBuffer.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopProcessing();
    
    this.requestQueue.length = 0;
    this.highPriorityQueue.length = 0;
    this.marketDataBuffer.clear();
    this.strategyContexts.clear();
    this.activeStrategies.clear();
    
    this.emit('cleanup');
  }
}

export default RealTimeSignalProcessor;