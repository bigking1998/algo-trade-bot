/**
 * Streaming Module Integration - Task BE-018: Market Data Integration
 * 
 * Main integration file for the Market Data Streaming System
 * Provides unified API for initializing and managing the complete streaming infrastructure
 * 
 * System Components:
 * - MarketDataStreamer: High-frequency data ingestion
 * - StreamManager: Multi-stream coordination and routing
 * - DataNormalizer: Multi-source data standardization
 * - ConnectionManager: Resilient connection management
 */

import { EventEmitter } from 'events';
import { MarketDataStreamer, type StreamerConfig } from './MarketDataStreamer.js';
import { StreamManager, type StreamManagerConfig, type StreamSubscription } from './StreamManager.js';
import { DataNormalizer, type NormalizationConfig } from './DataNormalizer.js';
import { ConnectionManager, type ConnectionConfig, type PoolConfig } from './ConnectionManager.js';
import { MarketDataBuffer, type BufferConfig } from '../data/MarketDataBuffer.js';
import { MarketDataRepository } from '../repositories/MarketDataRepository.js';
import { StrategyEngine } from '../engine/StrategyEngine.js';
import type { MarketData } from '../types/database.js';

/**
 * Complete streaming system configuration
 */
export interface StreamingSystemConfig {
  // Core streaming configuration
  streamer: StreamerConfig;
  
  // Stream management
  streamManager: Omit<StreamManagerConfig, 'streamer'>;
  
  // Data normalization
  normalizer: NormalizationConfig;
  
  // Connection management
  connectionManager: {
    pool: PoolConfig;
    connections: ConnectionConfig[];
  };
  
  // Buffer configuration
  buffer: BufferConfig;
  
  // Integration settings
  integration: {
    enableStrategyEngineIntegration: boolean;
    enablePersistence: boolean;
    enableRealTimeValidation: boolean;
    performanceTargets: {
      maxLatencyMs: number;
      minThroughputPerSecond: number;
      maxMemoryUsageMB: number;
      minDataQualityScore: number;
    };
  };
}

/**
 * System performance metrics
 */
export interface SystemPerformanceMetrics {
  streaming: {
    totalThroughput: number;
    averageLatency: number;
    memoryUsageMB: number;
    activeStreams: number;
    dataQualityScore: number;
  };
  connections: {
    totalConnections: number;
    healthyConnections: number;
    averageHealthScore: number;
    circuitBreakersOpen: number;
  };
  normalization: {
    successRate: number;
    averageQualityScore: number;
    processingLatency: number;
  };
  buffer: {
    utilization: number;
    flushRate: number;
    dataLoss: number;
  };
  overall: {
    systemHealth: number;
    performanceScore: number;
    meetingTargets: boolean;
  };
}

/**
 * Main Streaming System class
 */
export class StreamingSystem extends EventEmitter {
  private config: StreamingSystemConfig;
  
  // Core components
  private connectionManager: ConnectionManager;
  private dataNormalizer: DataNormalizer;
  private marketDataBuffer: MarketDataBuffer;
  private marketDataStreamer: MarketDataStreamer;
  private streamManager: StreamManager;
  
  // External integrations
  private marketDataRepository: MarketDataRepository;
  private strategyEngine?: StrategyEngine;
  
  // System state
  private isStarted = false;
  private performanceMonitorTimer?: NodeJS.Timeout;
  
  constructor(
    config: StreamingSystemConfig,
    dependencies: {
      marketDataRepository: MarketDataRepository;
      strategyEngine?: StrategyEngine;
    }
  ) {
    super();
    
    this.config = this.validateConfig(config);
    this.marketDataRepository = dependencies.marketDataRepository;
    this.strategyEngine = dependencies.strategyEngine;
    
    // Initialize components
    this.initializeComponents();
    this.setupEventHandlers();
    
    console.log('[StreamingSystem] Initialized with performance targets:', 
      this.config.integration.performanceTargets);
  }

  /**
   * SYSTEM LIFECYCLE MANAGEMENT
   */

  /**
   * Start the complete streaming system
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('StreamingSystem is already started');
    }

    try {
      console.log('[StreamingSystem] Starting market data streaming system...');
      
      // Start components in dependency order
      await this.connectionManager.start();
      await this.marketDataBuffer.start();
      await this.marketDataStreamer.start();
      await this.streamManager.start();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      this.isStarted = true;
      this.emit('system-started');
      
      console.log('[StreamingSystem] Market data streaming system started successfully');
      
    } catch (error) {
      console.error('[StreamingSystem] Failed to start:', error);
      await this.stop(); // Cleanup on failure
      throw error;
    }
  }

  /**
   * Stop the streaming system
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;
    
    console.log('[StreamingSystem] Stopping market data streaming system...');
    
    this.isStarted = false;
    
    // Stop performance monitoring
    this.stopPerformanceMonitoring();
    
    // Stop components in reverse order
    await this.streamManager.stop();
    await this.marketDataStreamer.stop();
    await this.marketDataBuffer.stop();
    await this.connectionManager.stop();
    
    this.emit('system-stopped');
    console.log('[StreamingSystem] Market data streaming system stopped');
  }

  /**
   * STREAMING OPERATIONS
   */

  /**
   * Create a new stream subscription
   */
  async createSubscription(subscription: StreamSubscription): Promise<void> {
    if (!this.isStarted) {
      throw new Error('StreamingSystem must be started before creating subscriptions');
    }
    
    await this.streamManager.createSubscription(subscription);
    
    this.emit('subscription-created', {
      subscriptionId: subscription.id,
      symbols: subscription.symbols,
      timeframes: subscription.timeframes
    });
  }

  /**
   * Remove a stream subscription
   */
  async removeSubscription(subscriptionId: string): Promise<void> {
    await this.streamManager.removeSubscription(subscriptionId);
    
    this.emit('subscription-removed', subscriptionId);
  }

  /**
   * Add a new data source connection
   */
  async addDataSource(connectionConfig: ConnectionConfig): Promise<void> {
    await this.connectionManager.addConnection(connectionConfig);
    
    // Update streamer configuration to include new source
    // This would require updating the streamer's data sources
    
    this.emit('data-source-added', connectionConfig.id);
  }

  /**
   * Remove a data source connection
   */
  async removeDataSource(connectionId: string): Promise<void> {
    await this.connectionManager.removeConnection(connectionId);
    
    this.emit('data-source-removed', connectionId);
  }

  /**
   * PERFORMANCE MONITORING AND HEALTH CHECKS
   */

  /**
   * Get comprehensive system performance metrics
   */
  getPerformanceMetrics(): SystemPerformanceMetrics {
    const streamerMetrics = this.marketDataStreamer.getMetrics();
    const connectionMetrics = this.connectionManager.getConnectionMetrics() as Map<string, any>;
    const bufferStats = this.marketDataBuffer.getStats();
    const normalizerStats = this.dataNormalizer.getStatistics() as Map<string, any>;
    
    // Calculate aggregated metrics
    const totalConnections = connectionMetrics.size;
    const healthyConnections = Array.from(connectionMetrics.values())
      .filter(m => m.healthScore > 0.7).length;
    const averageHealthScore = Array.from(connectionMetrics.values())
      .reduce((sum, m) => sum + m.healthScore, 0) / Math.max(totalConnections, 1);
    
    const circuitBreakers = this.connectionManager.getCircuitBreakerStates();
    const circuitBreakersOpen = Array.from(circuitBreakers.values())
      .filter(cb => cb.state === 'open').length;
    
    const normalizationSuccess = Array.from(normalizerStats.values())
      .reduce((sum, s) => sum + s.successRate, 0) / Math.max(normalizerStats.size, 1);
    const normalizationQuality = Array.from(normalizerStats.values())
      .reduce((sum, s) => sum + s.averageQuality, 0) / Math.max(normalizerStats.size, 1);
    const normalizationLatency = Array.from(normalizerStats.values())
      .reduce((sum, s) => sum + s.averageProcessingTime, 0) / Math.max(normalizerStats.size, 1);
    
    // System health calculation
    const systemHealth = this.calculateSystemHealth({
      streamingHealth: Math.min(streamerMetrics.dataQualityScore, 1),
      connectionHealth: averageHealthScore,
      normalizationHealth: normalizationSuccess,
      bufferHealth: Math.max(0, 1 - bufferStats.bufferUtilization)
    });
    
    const performanceScore = this.calculatePerformanceScore(streamerMetrics, bufferStats);
    const meetingTargets = this.arePerformanceTargetsMet(streamerMetrics, bufferStats);
    
    return {
      streaming: {
        totalThroughput: streamerMetrics.totalThroughput,
        averageLatency: streamerMetrics.averageLatency,
        memoryUsageMB: streamerMetrics.memoryUsageMB,
        activeStreams: streamerMetrics.activeStreams,
        dataQualityScore: streamerMetrics.dataQualityScore
      },
      connections: {
        totalConnections,
        healthyConnections,
        averageHealthScore,
        circuitBreakersOpen
      },
      normalization: {
        successRate: normalizationSuccess,
        averageQualityScore: normalizationQuality,
        processingLatency: normalizationLatency
      },
      buffer: {
        utilization: bufferStats.bufferUtilization,
        flushRate: bufferStats.totalFlushed / Math.max(bufferStats.totalReceived, 1),
        dataLoss: bufferStats.totalDropped / Math.max(bufferStats.totalReceived, 1)
      },
      overall: {
        systemHealth,
        performanceScore,
        meetingTargets
      }
    };
  }

  /**
   * Perform system health check
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const metrics = this.getPerformanceMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check performance targets
    const targets = this.config.integration.performanceTargets;
    
    if (metrics.streaming.averageLatency > targets.maxLatencyMs) {
      issues.push(`High latency: ${metrics.streaming.averageLatency}ms > ${targets.maxLatencyMs}ms`);
      recommendations.push('Consider optimizing data processing or adding connection pooling');
    }
    
    if (metrics.streaming.totalThroughput < targets.minThroughputPerSecond) {
      issues.push(`Low throughput: ${metrics.streaming.totalThroughput} < ${targets.minThroughputPerSecond}`);
      recommendations.push('Check data source connections and network performance');
    }
    
    if (metrics.streaming.memoryUsageMB > targets.maxMemoryUsageMB) {
      issues.push(`High memory usage: ${metrics.streaming.memoryUsageMB}MB > ${targets.maxMemoryUsageMB}MB`);
      recommendations.push('Consider reducing buffer sizes or implementing data compression');
    }
    
    if (metrics.streaming.dataQualityScore < targets.minDataQualityScore) {
      issues.push(`Low data quality: ${metrics.streaming.dataQualityScore} < ${targets.minDataQualityScore}`);
      recommendations.push('Review data validation rules and source reliability');
    }
    
    // Check system components
    if (metrics.connections.healthyConnections / Math.max(metrics.connections.totalConnections, 1) < 0.8) {
      issues.push('Less than 80% of connections are healthy');
      recommendations.push('Check network connectivity and connection configurations');
    }
    
    if (metrics.buffer.utilization > 0.9) {
      issues.push('Buffer utilization is very high (>90%)');
      recommendations.push('Consider increasing flush frequency or buffer size');
    }
    
    const healthy = issues.length === 0 && metrics.overall.systemHealth > 0.8;
    
    return {
      healthy,
      issues,
      recommendations
    };
  }

  /**
   * STRATEGY ENGINE INTEGRATION
   */

  /**
   * Integrate with strategy engine for real-time data processing
   */
  private setupStrategyEngineIntegration(): void {
    if (!this.config.integration.enableStrategyEngineIntegration || !this.strategyEngine) {
      return;
    }
    
    // Subscribe to buffer flush events to feed data to strategy engine
    this.marketDataBuffer.on('data-flushed', async (event) => {
      if (event.dataPoints > 0 && this.strategyEngine) {
        try {
          // Convert flushed data to strategy engine format
          const marketDataWindow = this.convertToMarketDataWindow(event);
          
          // Execute strategies with new data
          await this.strategyEngine.executeStrategies(marketDataWindow);
          
        } catch (error) {
          console.error('[StreamingSystem] Error in strategy engine integration:', error);
          this.emit('integration-error', { component: 'strategy-engine', error });
        }
      }
    });
    
    console.log('[StreamingSystem] Strategy engine integration enabled');
  }

  /**
   * PRIVATE METHODS
   */

  private initializeComponents(): void {
    // Initialize connection manager
    this.connectionManager = new ConnectionManager(this.config.connectionManager.pool);
    
    // Initialize data normalizer
    this.dataNormalizer = new DataNormalizer(this.config.normalizer);
    
    // Initialize market data buffer
    this.marketDataBuffer = new MarketDataBuffer(this.config.buffer);
    
    // Initialize market data streamer
    this.marketDataStreamer = new MarketDataStreamer(
      this.config.streamer,
      this.marketDataBuffer,
      this.marketDataRepository
    );
    
    // Initialize stream manager
    const streamManagerConfig: StreamManagerConfig = {
      ...this.config.streamManager,
      streamer: this.config.streamer
    };
    this.streamManager = new StreamManager(
      streamManagerConfig,
      this.marketDataBuffer,
      this.marketDataRepository
    );
    
    // Add configured connections
    for (const connectionConfig of this.config.connectionManager.connections) {
      this.connectionManager.addConnection(connectionConfig).catch(error => {
        console.error(`[StreamingSystem] Failed to add connection ${connectionConfig.id}:`, error);
      });
    }
  }

  private setupEventHandlers(): void {
    // Handle component errors
    this.marketDataStreamer.on('error', (error) => {
      this.emit('component-error', { component: 'streamer', error });
    });
    
    this.streamManager.on('error', (error) => {
      this.emit('component-error', { component: 'stream-manager', error });
    });
    
    this.connectionManager.on('error', (error) => {
      this.emit('component-error', { component: 'connection-manager', error });
    });
    
    // Handle performance warnings
    this.marketDataStreamer.on('performance-warning', (warning) => {
      this.emit('performance-warning', warning);
    });
    
    // Setup strategy engine integration
    this.setupStrategyEngineIntegration();
  }

  private validateConfig(config: StreamingSystemConfig): StreamingSystemConfig {
    // Add configuration validation and defaults
    return {
      ...config,
      integration: {
        enableStrategyEngineIntegration: true,
        enablePersistence: true,
        enableRealTimeValidation: true,
        performanceTargets: {
          maxLatencyMs: 5,
          minThroughputPerSecond: 1000,
          maxMemoryUsageMB: 150,
          minDataQualityScore: 0.95,
        },
        ...config.integration
      }
    };
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitorTimer = setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      this.emit('performance-update', metrics);
      
      // Check if we're meeting performance targets
      if (!metrics.overall.meetingTargets) {
        this.emit('performance-degradation', metrics);
      }
      
    }, 5000); // Every 5 seconds
  }

  private stopPerformanceMonitoring(): void {
    if (this.performanceMonitorTimer) {
      clearInterval(this.performanceMonitorTimer);
      this.performanceMonitorTimer = undefined;
    }
  }

  private calculateSystemHealth(components: {
    streamingHealth: number;
    connectionHealth: number;
    normalizationHealth: number;
    bufferHealth: number;
  }): number {
    // Weighted health calculation
    return (
      components.streamingHealth * 0.3 +
      components.connectionHealth * 0.3 +
      components.normalizationHealth * 0.2 +
      components.bufferHealth * 0.2
    );
  }

  private calculatePerformanceScore(streamerMetrics: any, bufferStats: any): number {
    const targets = this.config.integration.performanceTargets;
    
    let score = 1.0;
    
    // Latency score
    if (streamerMetrics.averageLatency > targets.maxLatencyMs) {
      score -= 0.2;
    }
    
    // Throughput score
    if (streamerMetrics.totalThroughput < targets.minThroughputPerSecond) {
      score -= 0.3;
    }
    
    // Memory score
    if (streamerMetrics.memoryUsageMB > targets.maxMemoryUsageMB) {
      score -= 0.2;
    }
    
    // Quality score
    if (streamerMetrics.dataQualityScore < targets.minDataQualityScore) {
      score -= 0.3;
    }
    
    return Math.max(0, score);
  }

  private arePerformanceTargetsMet(streamerMetrics: any, bufferStats: any): boolean {
    const targets = this.config.integration.performanceTargets;
    
    return (
      streamerMetrics.averageLatency <= targets.maxLatencyMs &&
      streamerMetrics.totalThroughput >= targets.minThroughputPerSecond &&
      streamerMetrics.memoryUsageMB <= targets.maxMemoryUsageMB &&
      streamerMetrics.dataQualityScore >= targets.minDataQualityScore
    );
  }

  private convertToMarketDataWindow(event: any): any {
    // Convert buffer flush event to strategy engine format
    return {
      symbol: 'MULTI', // Multiple symbols
      timeframe: '1m',
      data: [], // Would contain the actual market data
      timestamp: new Date(),
      source: 'streaming-system'
    };
  }

  /**
   * PUBLIC API FOR EXTERNAL ACCESS
   */

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): StreamSubscription[] {
    return this.streamManager.getSubscriptions();
  }

  /**
   * Get system configuration
   */
  getConfiguration(): StreamingSystemConfig {
    return { ...this.config };
  }

  /**
   * Update system configuration (requires restart for some changes)
   */
  updateConfiguration(updates: Partial<StreamingSystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configuration-updated', updates);
  }

  /**
   * Get component instances for advanced usage
   */
  getComponents() {
    return {
      connectionManager: this.connectionManager,
      dataNormalizer: this.dataNormalizer,
      marketDataBuffer: this.marketDataBuffer,
      marketDataStreamer: this.marketDataStreamer,
      streamManager: this.streamManager
    };
  }
}

// Re-export all types and classes
export * from './MarketDataStreamer.js';
export * from './StreamManager.js';
export * from './DataNormalizer.js';
export * from './ConnectionManager.js';

export default StreamingSystem;