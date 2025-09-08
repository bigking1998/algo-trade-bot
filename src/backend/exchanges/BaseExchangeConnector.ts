/**
 * Base Exchange Connector - Multi-Exchange Framework
 * 
 * Abstract base class providing unified interface for all exchange connectors.
 * Implements common functionality including rate limiting, connection management,
 * error handling, and health monitoring.
 * 
 * Performance Targets:
 * - Connection latency < 100ms
 * - Order execution latency < 200ms
 * - 99.9% uptime reliability
 * - Memory usage < 50MB per connector
 */

import { EventEmitter } from 'events';
import type {
  ExchangeId,
  ExchangeConfig,
  ExchangeStatus,
  ExchangeHealth,
  ExchangeOrder,
  ExchangeBalance,
  ExchangeTradingFees,
  UnifiedMarketData,
  UnifiedOrderBook,
  ExchangeEvent,
  ExchangePerformanceMetrics
} from './types.js';
import type { Order, OrderExecutionResult } from '../execution/OrderExecutor.js';

/**
 * Rate Limiter Implementation
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private weights: Map<string, number> = new Map();
  
  constructor(
    private limit: number,
    private windowMs: number,
    private weightLimit?: number
  ) {}
  
  canMakeRequest(endpoint: string, weight: number = 1): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Clean old requests
    if (!this.requests.has(endpoint)) {
      this.requests.set(endpoint, []);
      this.weights.set(endpoint, 0);
    }
    
    const requests = this.requests.get(endpoint)!;
    const validRequests = requests.filter(time => time > windowStart);
    
    // Update valid requests
    this.requests.set(endpoint, validRequests);
    
    // Calculate current weight
    const currentWeight = this.weights.get(endpoint)!;
    const newWeight = currentWeight - (requests.length - validRequests.length) + weight;
    
    // Check limits
    if (validRequests.length >= this.limit) {
      return false;
    }
    
    if (this.weightLimit && newWeight > this.weightLimit) {
      return false;
    }
    
    return true;
  }
  
  recordRequest(endpoint: string, weight: number = 1): void {
    const now = Date.now();
    
    if (!this.requests.has(endpoint)) {
      this.requests.set(endpoint, []);
      this.weights.set(endpoint, 0);
    }
    
    this.requests.get(endpoint)!.push(now);
    this.weights.set(endpoint, this.weights.get(endpoint)! + weight);
  }
  
  getRemainingRequests(endpoint: string): number {
    const requests = this.requests.get(endpoint) || [];
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const validRequests = requests.filter(time => time > windowStart);
    
    return Math.max(0, this.limit - validRequests.length);
  }
  
  getResetTime(endpoint: string): Date {
    const requests = this.requests.get(endpoint) || [];
    if (requests.length === 0) {
      return new Date();
    }
    
    const oldestRequest = Math.min(...requests);
    return new Date(oldestRequest + this.windowMs);
  }
}

/**
 * Connection Health Monitor
 */
class HealthMonitor {
  private latencyMeasurements: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private lastSuccessfulRequest = new Date();
  private lastFailedRequest?: Date;
  
  recordRequest(latencyMs: number, success: boolean): void {
    this.requestCount++;
    
    if (success) {
      this.lastSuccessfulRequest = new Date();
      this.latencyMeasurements.push(latencyMs);
      
      // Keep only last 100 measurements
      if (this.latencyMeasurements.length > 100) {
        this.latencyMeasurements = this.latencyMeasurements.slice(-100);
      }
    } else {
      this.errorCount++;
      this.lastFailedRequest = new Date();
    }
  }
  
  getHealth(): Omit<ExchangeHealth, 'exchangeId' | 'timestamp'> {
    const avgLatency = this.latencyMeasurements.length > 0
      ? this.latencyMeasurements.reduce((a, b) => a + b) / this.latencyMeasurements.length
      : 0;
    
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    const successRate = 1 - errorRate;
    
    let status: ExchangeStatus = 'connected';
    if (errorRate > 0.5) {
      status = 'error';
    } else if (errorRate > 0.1) {
      status = 'degraded' as ExchangeStatus;
    }
    
    return {
      status,
      latency: avgLatency,
      uptime: successRate * 100,
      lastSuccessfulRequest: this.lastSuccessfulRequest,
      lastFailedRequest: this.lastFailedRequest,
      restApiStatus: errorRate < 0.1 ? 'online' : 'degraded',
      websocketStatus: 'online', // Would be tracked separately
      requestsPerMinute: this.requestCount,
      errorRate: errorRate * 100,
      successRate: successRate * 100,
      rateLimitUsage: {
        current: 0, // Would be provided by rate limiter
        limit: 100,
        resetTime: new Date(Date.now() + 60000)
      }
    };
  }
  
  reset(): void {
    this.latencyMeasurements = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastSuccessfulRequest = new Date();
    this.lastFailedRequest = undefined;
  }
}

/**
 * Abstract Base Exchange Connector
 */
export abstract class BaseExchangeConnector extends EventEmitter {
  protected config: ExchangeConfig;
  protected status: ExchangeStatus = 'disconnected';
  protected rateLimiter: RateLimiter;
  protected healthMonitor: HealthMonitor = new HealthMonitor();
  
  // Connection management
  protected connected = false;
  protected connecting = false;
  protected reconnectAttempts = 0;
  protected healthCheckInterval?: NodeJS.Timeout;
  
  // Performance tracking
  protected performanceMetrics: Partial<ExchangePerformanceMetrics> = {};
  protected startTime = Date.now();
  
  constructor(config: ExchangeConfig) {
    super();
    this.config = config;
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      config.rateLimits.restRequests.limit,
      config.rateLimits.restRequests.windowMs,
      config.rateLimits.restRequests.weight
    );
    
    this.setupEventHandlers();
  }
  
  /**
   * Initialize the exchange connector
   */
  async initialize(): Promise<void> {
    try {
      this.status = 'connecting';
      this.connecting = true;
      
      this.emit('status_changed', {
        exchangeId: this.config.exchangeId,
        status: this.status,
        timestamp: new Date()
      });
      
      // Initialize connection
      await this.connect();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Test connection
      await this.testConnection();
      
      this.status = 'connected';
      this.connected = true;
      this.connecting = false;
      
      this.emit('initialized', {
        exchangeId: this.config.exchangeId,
        capabilities: this.config.capabilities,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.status = 'error';
      this.connecting = false;
      this.handleError('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Get exchange identifier
   */
  getExchangeId(): ExchangeId {
    return this.config.exchangeId;
  }
  
  /**
   * Get current status
   */
  getStatus(): ExchangeStatus {
    return this.status;
  }
  
  /**
   * Get health metrics
   */
  getHealth(): ExchangeHealth {
    return {
      exchangeId: this.config.exchangeId,
      timestamp: new Date(),
      ...this.healthMonitor.getHealth()
    };
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): ExchangePerformanceMetrics {
    return {
      exchangeId: this.config.exchangeId,
      timestamp: new Date(),
      period: 'hour',
      totalTrades: 0,
      totalVolume: 0,
      averageTradeSize: 0,
      successfulTrades: 0,
      failedTrades: 0,
      averageSlippage: 0,
      averageExecutionTime: 0,
      fillRate: 0,
      averageLatency: this.healthMonitor.getHealth().latency,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: this.healthMonitor.getHealth().errorRate,
      uptime: this.healthMonitor.getHealth().uptime,
      totalFees: 0,
      profitLoss: 0,
      return: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      var95: 0,
      beta: 1,
      ...this.performanceMetrics
    };
  }
  
  /**
   * Check if exchange supports a feature
   */
  supportsFeature(feature: keyof ExchangeConfig['capabilities']): boolean {
    return this.config.capabilities[feature] === true;
  }
  
  /**
   * Execute with rate limiting and error handling
   */
  protected async executeRequest<T>(
    endpoint: string,
    requestFn: () => Promise<T>,
    weight: number = 1
  ): Promise<T> {
    // Check rate limits
    if (!this.rateLimiter.canMakeRequest(endpoint, weight)) {
      const resetTime = this.rateLimiter.getResetTime(endpoint);
      const waitTime = resetTime.getTime() - Date.now();
      
      this.emit('rate_limit_hit', {
        exchangeId: this.config.exchangeId,
        endpoint,
        waitTime,
        resetTime
      });
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    const startTime = performance.now();
    
    try {
      const result = await requestFn();
      const latency = performance.now() - startTime;
      
      // Record successful request
      this.rateLimiter.recordRequest(endpoint, weight);
      this.healthMonitor.recordRequest(latency, true);
      
      return result;
      
    } catch (error) {
      const latency = performance.now() - startTime;
      this.healthMonitor.recordRequest(latency, false);
      
      this.handleError(`Request failed for ${endpoint}`, error);
      throw error;
    }
  }
  
  /**
   * Handle errors with proper logging and status updates
   */
  protected handleError(message: string, error: any): void {
    const errorDetails = {
      exchangeId: this.config.exchangeId,
      message,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date()
    };
    
    this.emit('error', errorDetails);
    
    // Update status if needed
    if (this.status === 'connected' && this.isConnectionError(error)) {
      this.status = 'error';
      this.connected = false;
      
      this.emit('status_changed', {
        exchangeId: this.config.exchangeId,
        status: this.status,
        timestamp: new Date()
      });
      
      // Attempt reconnection
      this.attemptReconnection();
    }
  }
  
  /**
   * Attempt to reconnect
   */
  protected async attemptReconnection(): Promise<void> {
    if (this.connecting || this.reconnectAttempts >= this.config.reconnectAttempts) {
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    
    this.emit('reconnecting', {
      exchangeId: this.config.exchangeId,
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.reconnectAttempts,
      delayMs: delay
    });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.initialize();
      this.reconnectAttempts = 0;
    } catch (error) {
      this.handleError('Reconnection failed', error);
    }
  }
  
  /**
   * Start health monitoring
   */
  protected startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.handleError('Health check failed', error);
      }
    }, this.config.healthCheckInterval);
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // Disconnect
      await this.disconnect();
      
      // Reset state
      this.connected = false;
      this.connecting = false;
      this.status = 'disconnected';
      
      this.emit('cleanup_completed', {
        exchangeId: this.config.exchangeId,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.handleError('Cleanup failed', error);
    }
  }
  
  // === ABSTRACT METHODS (Must be implemented by subclasses) ===
  
  /**
   * Establish connection to the exchange
   */
  protected abstract connect(): Promise<void>;
  
  /**
   * Disconnect from the exchange
   */
  protected abstract disconnect(): Promise<void>;
  
  /**
   * Test connection health
   */
  protected abstract testConnection(): Promise<void>;
  
  /**
   * Perform health check
   */
  protected abstract performHealthCheck(): Promise<void>;
  
  /**
   * Place an order on the exchange
   */
  abstract placeOrder(order: Order): Promise<OrderExecutionResult>;
  
  /**
   * Cancel an order
   */
  abstract cancelOrder(orderId: string): Promise<boolean>;
  
  /**
   * Get order status
   */
  abstract getOrder(orderId: string): Promise<ExchangeOrder | null>;
  
  /**
   * Get account balances
   */
  abstract getBalances(): Promise<ExchangeBalance[]>;
  
  /**
   * Get trading fees
   */
  abstract getTradingFees(symbol: string): Promise<ExchangeTradingFees>;
  
  /**
   * Get market data
   */
  abstract getMarketData(symbol: string): Promise<UnifiedMarketData>;
  
  /**
   * Get order book
   */
  abstract getOrderBook(symbol: string, depth?: number): Promise<UnifiedOrderBook>;
  
  /**
   * Subscribe to real-time market data
   */
  abstract subscribeToMarketData(symbols: string[]): Promise<void>;
  
  /**
   * Unsubscribe from real-time market data
   */
  abstract unsubscribeFromMarketData(symbols: string[]): Promise<void>;
  
  // === PRIVATE METHODS ===
  
  private setupEventHandlers(): void {
    this.on('error', this.onError.bind(this));
    this.on('status_changed', this.onStatusChanged.bind(this));
  }
  
  private onError(error: ExchangeEvent): void {
    // Log error details for monitoring
    console.error(`[${this.config.exchangeId}] Error:`, error);
  }
  
  private onStatusChanged(event: ExchangeEvent): void {
    console.log(`[${this.config.exchangeId}] Status changed:`, event.data);
  }
  
  private isConnectionError(error: any): boolean {
    // Check if error indicates connection issues
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('connection') ||
             message.includes('network') ||
             message.includes('timeout') ||
             message.includes('socket');
    }
    return false;
  }
}

export default BaseExchangeConnector;