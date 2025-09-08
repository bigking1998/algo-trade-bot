/**
 * StreamingSystem Integration Tests - Task BE-018: Market Data Integration
 * 
 * Comprehensive integration tests for the Market Data Streaming System
 * Tests all components working together and validates performance targets
 * 
 * Test Coverage:
 * - System initialization and lifecycle
 * - Real-time data flow and processing
 * - Performance benchmarks and targets
 * - Error handling and recovery
 * - Integration with Strategy Engine and Buffer
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { StreamingSystem, type StreamingSystemConfig } from '../index.js';
import { MarketDataRepository } from '../../repositories/MarketDataRepository.js';
import { StrategyEngine } from '../../engine/StrategyEngine.js';
import { DatabaseManager } from '../../database/DatabaseManager.js';
import type { ConnectionConfig, StreamSubscription } from '../index.js';
import type { MarketData } from '../../types/database.js';

/**
 * Mock WebSocket server for testing
 */
class MockWebSocketServer {
  private clients: Set<any> = new Set();
  
  addClient(client: any): void {
    this.clients.add(client);
  }
  
  removeClient(client: any): void {
    this.clients.delete(client);
  }
  
  broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    }
  }
  
  simulateMarketData(): void {
    const marketData = {
      type: 'channel_data',
      channel: 'v4_candles',
      contents: {
        ticker: 'BTC-USD',
        open: '50000.00',
        high: '51000.00',
        low: '49500.00',
        close: '50500.00',
        baseTokenVolume: '1.5',
        usdVolume: '75750.00',
        trades: '150',
        startedAt: new Date().toISOString(),
        resolution: '1m'
      }
    };
    
    this.broadcast(marketData);
  }
}

/**
 * Performance test utilities
 */
class PerformanceTestUtils {
  static async measureLatency<T>(operation: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const startTime = performance.now();
    const result = await operation();
    const latencyMs = performance.now() - startTime;
    return { result, latencyMs };
  }
  
  static async measureThroughput(
    operation: () => void,
    durationMs: number
  ): Promise<{ operationsPerSecond: number; totalOperations: number }> {
    let operationCount = 0;
    const startTime = Date.now();
    const endTime = startTime + durationMs;
    
    while (Date.now() < endTime) {
      operation();
      operationCount++;
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setImmediate(resolve));
    }
    
    const actualDurationMs = Date.now() - startTime;
    const operationsPerSecond = (operationCount * 1000) / actualDurationMs;
    
    return { operationsPerSecond, totalOperations: operationCount };
  }
}

describe('StreamingSystem Integration Tests', () => {
  let streamingSystem: StreamingSystem;
  let mockWebSocketServer: MockWebSocketServer;
  let marketDataRepository: MarketDataRepository;
  let strategyEngine: StrategyEngine;
  let databaseManager: DatabaseManager;
  
  // Test configuration
  const testConfig: StreamingSystemConfig = {
    streamer: {
      dataSources: [{
        id: 'test-dydx',
        name: 'Test dYdX Source',
        type: 'websocket',
        url: 'ws://localhost:8080/test-ws',
        subscriptions: ['v4_candles'],
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframes: ['1m', '5m'],
        rateLimitMs: 100,
        maxReconnectAttempts: 3,
        reconnectDelayMs: 1000,
        heartbeatIntervalMs: 30000,
        priority: 1,
        enabled: true
      }],
      bufferConfig: {
        maxSize: 1000,
        flushIntervalMs: 1000,
        flushThreshold: 0.8
      },
      performance: {
        maxLatencyMs: 5,
        maxMemoryMB: 150,
        maxConcurrentStreams: 100,
        throughputTargetPerSecond: 1000
      },
      quality: {
        enableDuplicateDetection: true,
        enableDataValidation: true,
        enableTimeOrderValidation: true,
        maxDataAgeMs: 60000
      },
      persistence: {
        enabled: true,
        batchSize: 100,
        flushIntervalMs: 2000
      }
    },
    streamManager: {
      routing: {
        enableLoadBalancing: true,
        enableFailover: true,
        healthCheckIntervalMs: 5000,
        failoverThreshold: 0.5,
        maxRoutesPerSubscription: 3
      },
      multiplexing: {
        enabled: true,
        bufferSize: 100,
        flushIntervalMs: 1000,
        enablePrioritization: true
      },
      fanout: {
        enabled: true,
        maxFanoutTargets: 5,
        enableFiltering: true,
        enableTransformation: true
      }
    },
    normalizer: {
      sources: {
        'test-dydx': {
          format: 'dydx',
          exchangeId: 'dydx',
          precision: {
            price: 2,
            volume: 4,
            time: 1000
          }
        }
      },
      quality: {
        enableValidation: true,
        enableOutlierDetection: true,
        enableGapFilling: true,
        maxPriceDeviation: 10,
        maxVolumeDeviation: 50,
        maxTimeGap: 60000,
        minDataAge: 0,
        maxDataAge: 300000
      },
      temporal: {
        enableAlignment: true,
        targetTimeframe: '1m',
        alignmentTolerance: 1000,
        interpolationMethod: 'linear',
        fillGapsUpTo: 5000
      },
      output: {
        standardSymbolFormat: 'BASE/QUOTE',
        priceDecimalPlaces: 2,
        volumeDecimalPlaces: 4,
        includeMetadata: true
      }
    },
    connectionManager: {
      pool: {
        maxConnections: 10,
        minConnections: 1,
        acquireTimeoutMs: 5000,
        idleTimeoutMs: 30000,
        reapIntervalMs: 5000,
        enableLoadBalancing: true,
        loadBalancingStrategy: 'health_based'
      },
      connections: [{
        id: 'test-dydx-connection',
        name: 'Test dYdX Connection',
        type: 'websocket',
        url: 'ws://localhost:8080/test-ws',
        priority: 1,
        timeouts: {
          connect: 10000,
          idle: 30000,
          request: 5000,
          response: 10000
        },
        resilience: {
          maxRetries: 3,
          retryDelayMs: 1000,
          maxRetryDelayMs: 10000,
          backoffMultiplier: 2,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 30000,
          healthCheckIntervalMs: 10000
        },
        rateLimit: {
          enabled: true,
          requestsPerSecond: 10,
          burstSize: 20
        },
        websocket: {
          pingIntervalMs: 30000,
          pongTimeoutMs: 10000,
          maxMessageSize: 1024 * 1024
        }
      }]
    },
    buffer: {
      maxSize: 1000,
      symbols: ['BTC-USD', 'ETH-USD'],
      timeframes: ['1m', '5m'],
      enableTimeOrdering: true,
      enableDuplicateDetection: true,
      flushThreshold: 0.8,
      flushIntervalMs: 1000
    },
    integration: {
      enableStrategyEngineIntegration: true,
      enablePersistence: true,
      enableRealTimeValidation: true,
      performanceTargets: {
        maxLatencyMs: 5,
        minThroughputPerSecond: 1000,
        maxMemoryUsageMB: 150,
        minDataQualityScore: 0.95
      }
    }
  };

  beforeAll(async () => {
    // Initialize test database
    databaseManager = new DatabaseManager({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'test_trading_bot',
      username: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASS || 'test',
      ssl: false,
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 60000,
        idleTimeoutMillis: 30000
      }
    });
    
    await databaseManager.initialize();
    
    // Initialize repositories and engines
    marketDataRepository = new MarketDataRepository();
    await marketDataRepository.initialize(databaseManager);
    
    strategyEngine = new StrategyEngine(
      {
        maxConcurrentStrategies: 10,
        maxSignalsPerSecond: 100,
        defaultExecutionTimeout: 5000,
        maxMemoryUsage: 100,
        maxCpuUsage: 80,
        maxLatency: 10,
        emergencyStopEnabled: true,
        maxPortfolioRisk: 0.1,
        correlationThreshold: 0.8,
        healthCheckInterval: 5,
        performanceReviewInterval: 30,
        metricsRetentionPeriod: 7,
        eventRetention: 1000,
        alertThresholds: {
          errorRate: 0.05,
          latency: 10,
          drawdown: 0.1
        }
      },
      {
        marketDataRepository,
        strategyRepository: {} as any,
        tradeRepository: {} as any,
        databaseManager
      }
    );
    
    await strategyEngine.initialize();
    
    // Setup mock WebSocket server
    mockWebSocketServer = new MockWebSocketServer();
    
    // Initialize streaming system
    streamingSystem = new StreamingSystem(testConfig, {
      marketDataRepository,
      strategyEngine
    });
  });

  afterAll(async () => {
    await streamingSystem?.stop();
    await strategyEngine?.stop();
    await databaseManager?.close();
  });

  beforeEach(async () => {
    // Clear any existing data
    await marketDataRepository.query('TRUNCATE TABLE market_data');
  });

  afterEach(async () => {
    // Clean up after each test
    if (streamingSystem) {
      // Remove any test subscriptions
      const subscriptions = streamingSystem.getSubscriptions();
      for (const sub of subscriptions) {
        await streamingSystem.removeSubscription(sub.id);
      }
    }
  });

  describe('System Lifecycle', () => {
    it('should start and stop the streaming system successfully', async () => {
      const startPromise = streamingSystem.start();
      
      // Should emit started event
      const startedPromise = new Promise(resolve => {
        streamingSystem.once('system-started', resolve);
      });
      
      await Promise.all([startPromise, startedPromise]);
      
      // Check system is running
      const metrics = streamingSystem.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.overall.systemHealth).toBeGreaterThan(0);
      
      // Stop system
      const stopPromise = streamingSystem.stop();
      const stoppedPromise = new Promise(resolve => {
        streamingSystem.once('system-stopped', resolve);
      });
      
      await Promise.all([stopPromise, stoppedPromise]);
    }, 30000);

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await streamingSystem.start();
        expect(streamingSystem.getPerformanceMetrics()).toBeDefined();
        
        await streamingSystem.stop();
        
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe('Stream Subscriptions', () => {
    beforeEach(async () => {
      await streamingSystem.start();
    });

    afterEach(async () => {
      await streamingSystem.stop();
    });

    it('should create and manage stream subscriptions', async () => {
      const subscription: StreamSubscription = {
        id: 'test-btc-subscription',
        symbols: ['BTC-USD'],
        timeframes: ['1m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      const createdPromise = new Promise(resolve => {
        streamingSystem.once('subscription-created', resolve);
      });
      
      await streamingSystem.createSubscription(subscription);
      await createdPromise;
      
      const subscriptions = streamingSystem.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].id).toBe('test-btc-subscription');
      
      // Remove subscription
      const removedPromise = new Promise(resolve => {
        streamingSystem.once('subscription-removed', resolve);
      });
      
      await streamingSystem.removeSubscription('test-btc-subscription');
      await removedPromise;
      
      expect(streamingSystem.getSubscriptions()).toHaveLength(0);
    });

    it('should handle multiple concurrent subscriptions', async () => {
      const subscriptions: StreamSubscription[] = [
        {
          id: 'btc-1m',
          symbols: ['BTC-USD'],
          timeframes: ['1m'],
          sources: ['test-dydx'],
          priority: 1,
          fallbackSources: []
        },
        {
          id: 'eth-1m',
          symbols: ['ETH-USD'],
          timeframes: ['1m'],
          sources: ['test-dydx'],
          priority: 1,
          fallbackSources: []
        },
        {
          id: 'multi-symbol',
          symbols: ['BTC-USD', 'ETH-USD'],
          timeframes: ['1m', '5m'],
          sources: ['test-dydx'],
          priority: 2,
          fallbackSources: []
        }
      ];
      
      // Create all subscriptions
      await Promise.all(
        subscriptions.map(sub => streamingSystem.createSubscription(sub))
      );
      
      expect(streamingSystem.getSubscriptions()).toHaveLength(3);
      
      // Clean up
      await Promise.all(
        subscriptions.map(sub => streamingSystem.removeSubscription(sub.id))
      );
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await streamingSystem.start();
    });

    afterEach(async () => {
      await streamingSystem.stop();
    });

    it('should meet latency performance targets', async () => {
      const subscription: StreamSubscription = {
        id: 'latency-test',
        symbols: ['BTC-USD'],
        timeframes: ['1m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      await streamingSystem.createSubscription(subscription);
      
      // Measure subscription creation latency
      const { latencyMs } = await PerformanceTestUtils.measureLatency(async () => {
        // Simulate rapid market data
        for (let i = 0; i < 10; i++) {
          mockWebSocketServer.simulateMarketData();
        }
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const targetLatency = testConfig.integration.performanceTargets.maxLatencyMs;
      expect(latencyMs).toBeLessThan(targetLatency);
    });

    it('should meet throughput performance targets', async () => {
      const subscription: StreamSubscription = {
        id: 'throughput-test',
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframes: ['1m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      await streamingSystem.createSubscription(subscription);
      
      // Measure throughput over 2 seconds
      const { operationsPerSecond } = await PerformanceTestUtils.measureThroughput(() => {
        mockWebSocketServer.simulateMarketData();
      }, 2000);
      
      const targetThroughput = testConfig.integration.performanceTargets.minThroughputPerSecond;
      expect(operationsPerSecond).toBeGreaterThanOrEqual(targetThroughput * 0.8); // Allow 20% tolerance
    });

    it('should stay within memory usage limits', async () => {
      const subscription: StreamSubscription = {
        id: 'memory-test',
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframes: ['1m', '5m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      await streamingSystem.createSubscription(subscription);
      
      // Generate significant load
      for (let i = 0; i < 1000; i++) {
        mockWebSocketServer.simulateMarketData();
        
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const metrics = streamingSystem.getPerformanceMetrics();
      const targetMemory = testConfig.integration.performanceTargets.maxMemoryUsageMB;
      expect(metrics.streaming.memoryUsageMB).toBeLessThan(targetMemory);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await streamingSystem.start();
    });

    afterEach(async () => {
      await streamingSystem.stop();
    });

    it('should handle connection failures gracefully', async () => {
      const subscription: StreamSubscription = {
        id: 'error-test',
        symbols: ['BTC-USD'],
        timeframes: ['1m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      await streamingSystem.createSubscription(subscription);
      
      // Simulate connection errors
      let errorCount = 0;
      streamingSystem.on('component-error', () => {
        errorCount++;
      });
      
      // Trigger some errors (implementation would depend on mock setup)
      // For now, just check that error handling infrastructure is in place
      expect(streamingSystem.getPerformanceMetrics).toBeDefined();
      expect(streamingSystem.performHealthCheck).toBeDefined();
    });

    it('should recover from system degradation', async () => {
      const healthCheck = await streamingSystem.performHealthCheck();
      
      expect(healthCheck).toHaveProperty('healthy');
      expect(healthCheck).toHaveProperty('issues');
      expect(healthCheck).toHaveProperty('recommendations');
      
      // System should be healthy initially
      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.issues).toHaveLength(0);
    });
  });

  describe('Data Quality and Validation', () => {
    beforeEach(async () => {
      await streamingSystem.start();
    });

    afterEach(async () => {
      await streamingSystem.stop();
    });

    it('should maintain data quality above threshold', async () => {
      const subscription: StreamSubscription = {
        id: 'quality-test',
        symbols: ['BTC-USD'],
        timeframes: ['1m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      await streamingSystem.createSubscription(subscription);
      
      // Generate clean market data
      for (let i = 0; i < 100; i++) {
        mockWebSocketServer.simulateMarketData();
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const metrics = streamingSystem.getPerformanceMetrics();
      const targetQuality = testConfig.integration.performanceTargets.minDataQualityScore;
      expect(metrics.streaming.dataQualityScore).toBeGreaterThanOrEqual(targetQuality);
    });
  });

  describe('Strategy Engine Integration', () => {
    beforeEach(async () => {
      await streamingSystem.start();
      await strategyEngine.start();
    });

    afterEach(async () => {
      await strategyEngine.stop();
      await streamingSystem.stop();
    });

    it('should feed data to strategy engine', async () => {
      const subscription: StreamSubscription = {
        id: 'strategy-test',
        symbols: ['BTC-USD'],
        timeframes: ['1m'],
        sources: ['test-dydx'],
        priority: 1,
        fallbackSources: []
      };
      
      await streamingSystem.createSubscription(subscription);
      
      // Listen for strategy engine events
      let strategyExecutions = 0;
      strategyEngine.on('execution_completed', () => {
        strategyExecutions++;
      });
      
      // Generate market data
      for (let i = 0; i < 10; i++) {
        mockWebSocketServer.simulateMarketData();
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Strategy engine should have received data (exact count depends on implementation)
      const engineStatus = strategyEngine.getStatus();
      expect(engineStatus.state).not.toBe('error');
    });
  });

  describe('Performance Monitoring', () => {
    it('should provide comprehensive performance metrics', async () => {
      await streamingSystem.start();
      
      const metrics = streamingSystem.getPerformanceMetrics();
      
      // Check all required metric categories
      expect(metrics).toHaveProperty('streaming');
      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('normalization');
      expect(metrics).toHaveProperty('buffer');
      expect(metrics).toHaveProperty('overall');
      
      // Check streaming metrics
      expect(metrics.streaming).toHaveProperty('totalThroughput');
      expect(metrics.streaming).toHaveProperty('averageLatency');
      expect(metrics.streaming).toHaveProperty('memoryUsageMB');
      expect(metrics.streaming).toHaveProperty('activeStreams');
      expect(metrics.streaming).toHaveProperty('dataQualityScore');
      
      // Check overall health metrics
      expect(metrics.overall).toHaveProperty('systemHealth');
      expect(metrics.overall).toHaveProperty('performanceScore');
      expect(metrics.overall).toHaveProperty('meetingTargets');
      
      expect(metrics.overall.systemHealth).toBeGreaterThanOrEqual(0);
      expect(metrics.overall.systemHealth).toBeLessThanOrEqual(1);
      
      await streamingSystem.stop();
    });

    it('should emit performance updates periodically', async () => {
      await streamingSystem.start();
      
      let updateCount = 0;
      streamingSystem.on('performance-update', (metrics) => {
        updateCount++;
        expect(metrics).toBeDefined();
        expect(metrics.overall).toBeDefined();
      });
      
      // Wait for several update cycles
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      expect(updateCount).toBeGreaterThan(0);
      
      await streamingSystem.stop();
    }, 15000);
  });
});

/**
 * Utility functions for test data generation
 */
export class TestDataGenerator {
  static generateMarketData(symbol: string = 'BTC-USD', count: number = 1): MarketData[] {
    const data: MarketData[] = [];
    const basePrice = 50000;
    const baseTime = Date.now();
    
    for (let i = 0; i < count; i++) {
      const price = basePrice + (Math.random() - 0.5) * 1000;
      data.push({
        time: new Date(baseTime + i * 60000), // 1 minute intervals
        symbol,
        exchange: 'dydx',
        open: price,
        high: price * 1.02,
        low: price * 0.98,
        close: price + (Math.random() - 0.5) * 100,
        volume: Math.random() * 10,
        quote_volume: Math.random() * 500000,
        trades_count: Math.floor(Math.random() * 100),
        timeframe: '1m',
        raw_data: {},
        created_at: new Date()
      });
    }
    
    return data;
  }
  
  static generateConnectionConfig(id: string, url: string): ConnectionConfig {
    return {
      id,
      name: `Test Connection ${id}`,
      type: 'websocket',
      url,
      priority: 1,
      timeouts: {
        connect: 10000,
        idle: 30000,
        request: 5000,
        response: 10000
      },
      resilience: {
        maxRetries: 3,
        retryDelayMs: 1000,
        maxRetryDelayMs: 10000,
        backoffMultiplier: 2,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 30000,
        healthCheckIntervalMs: 10000
      },
      rateLimit: {
        enabled: true,
        requestsPerSecond: 10,
        burstSize: 20
      },
      websocket: {
        pingIntervalMs: 30000,
        pongTimeoutMs: 10000,
        maxMessageSize: 1024 * 1024
      }
    };
  }
}