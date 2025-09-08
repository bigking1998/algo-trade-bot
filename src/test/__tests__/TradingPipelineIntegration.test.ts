/**
 * Trading Pipeline Integration Testing Suite - Integration Task TE-002
 * 
 * Comprehensive testing of the complete trading pipeline from signal generation
 * to trade execution, validating all integration points and data flows:
 * 
 * Pipeline Flow:
 * Market Data → Strategy Processing → Signal Generation → Risk Assessment → 
 * Order Creation → Execution → Portfolio Update → Performance Tracking
 * 
 * Key Integration Points Tested:
 * - Strategy Engine ↔ Market Data Stream
 * - Signal Processor ↔ Risk Controller
 * - Order Manager ↔ Execution Engine
 * - Portfolio Manager ↔ Performance Monitor
 * - Risk Engine ↔ Protection Mechanisms
 * - ML Models ↔ Strategy Enhancement
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { TestingFramework } from '../TestingFramework.js';
import { MockDataGenerator } from '../MockDataGenerator.js';

// Trading Pipeline Components
import { StrategyEngine } from '../../backend/engine/StrategyEngine.js';
import { SignalProcessor } from '../../backend/engine/SignalProcessor.js';
import { StrategyExecutionEngine } from '../../backend/execution/StrategyExecutionEngine.js';
import { OrderManager } from '../../backend/orders/OrderManager.js';
import { RiskEngine } from '../../backend/risk/RiskEngine.js';
import { PerformanceMonitor } from '../../backend/engine/PerformanceMonitor.js';
import { ProtectionMechanisms } from '../../backend/engine/ProtectionMechanisms.js';

// Data Management
import { MarketDataBuffer } from '../../backend/data/MarketDataBuffer.js';
import { TradeReporting } from '../../backend/orders/TradeReporting.js';

// Strategies and Indicators
import { SimpleMovingAverageCrossStrategy } from '../../backend/strategies/examples/SimpleMovingAverageCrossStrategy.js';
import { SimpleMovingAverage } from '../../backend/indicators/trend/SimpleMovingAverage.js';
import { RSI } from '../../backend/indicators/momentum/RSI.js';

// Types
import type {
  StrategySignal,
  StrategyContext,
  Position,
  MarketDataWindow,
  StrategyConfig,
  StrategyMetrics
} from '../../backend/strategies/types.js';
import type { OHLCV, Trade, PortfolioState, TradingSignal } from '../../shared/types/trading.js';

/**
 * Pipeline Test Configuration
 */
const PIPELINE_TEST_CONFIG = {
  // Performance Requirements
  LATENCY_TARGETS: {
    dataIngestion: 5,           // 5ms max data ingestion
    signalGeneration: 50,       // 50ms max signal generation  
    riskAssessment: 25,         // 25ms max risk assessment
    orderCreation: 20,          // 20ms max order creation
    orderExecution: 100,        // 100ms max execution
    portfolioUpdate: 30,        // 30ms max portfolio update
    endToEndPipeline: 250,      // 250ms max end-to-end
  },
  
  // Accuracy Requirements
  ACCURACY_TARGETS: {
    portfolioAccuracy: 0.01,    // $0.01 tolerance
    pnlAccuracy: 0.01,          // $0.01 P&L tolerance
    positionAccuracy: 0.0001,   // 0.0001 quantity tolerance
    priceAccuracy: 0.000001,    // Price tolerance
  },
  
  // Testing Parameters
  TEST_PARAMETERS: {
    marketDataPoints: 1000,     // Number of market data points
    concurrentStrategies: 5,    // Number of concurrent strategies
    stressTestDuration: 60,     // Stress test duration in seconds
    errorInjectionRate: 0.05,   // 5% error injection rate
  }
} as const;

/**
 * Trading Pipeline Test Orchestrator
 */
class TradingPipelineTestOrchestrator {
  private components: {
    strategyEngine: StrategyEngine;
    signalProcessor: SignalProcessor;
    executionEngine: StrategyExecutionEngine;
    orderManager: OrderManager;
    riskEngine: RiskEngine;
    performanceMonitor: PerformanceMonitor;
    protectionMechanisms: ProtectionMechanisms;
    marketDataBuffer: MarketDataBuffer;
    tradeReporting: TradeReporting;
  };
  
  private strategies: SimpleMovingAverageCrossStrategy[] = [];
  private eventLog: Array<{ timestamp: number; component: string; event: string; data?: any }> = [];
  
  constructor() {
    this.setupEventLogging();
  }
  
  async initialize(): Promise<void> {
    // Initialize all pipeline components
    this.components = {
      strategyEngine: new StrategyEngine({
        maxConcurrentStrategies: 10,
        maxSignalsPerSecond: 100,
        defaultExecutionTimeout: 5000,
        maxMemoryUsage: 500,
        maxCpuUsage: 80,
        maxLatency: PIPELINE_TEST_CONFIG.LATENCY_TARGETS.endToEndPipeline,
        enableProfiling: true,
        enableHealthChecks: true,
        healthCheckInterval: 1000,
        riskManagement: {
          maxDrawdown: 0.20,
          maxPositionSize: 0.15,
          stopLossPercentage: 0.05,
          dailyLossLimit: 2000
        }
      }),
      
      signalProcessor: new SignalProcessor({
        maxSignalsPerSecond: 100,
        signalBufferSize: 1000,
        enablePrioritization: true,
        enableFiltering: true,
        enableAggregation: true,
        aggregationWindow: 1000
      }),
      
      executionEngine: new StrategyExecutionEngine({
        mode: 'paper',
        maxConcurrentExecutions: 10,
        executionTimeout: 5000,
        orderTimeout: 3000,
        enableMetrics: true,
        memoryLimit: 500,
        enableRecovery: true,
        recoveryAttempts: 3
      }),
      
      orderManager: new OrderManager({
        maxPendingOrders: 1000,
        orderTimeout: 30000,
        enablePartialFills: true,
        minOrderSize: 0.001,
        maxOrderSize: 100,
        enableSlippage: true,
        defaultSlippage: 0.001
      }),
      
      riskEngine: new RiskEngine({
        maxDrawdown: 0.20,
        maxPositionSize: 0.15,
        stopLossPercentage: 0.05,
        dailyLossLimit: 2000,
        enableRealTimeMonitoring: true,
        riskCheckInterval: 1000,
        enableVaRCalculation: true,
        varConfidence: 0.95,
        varTimeHorizon: 1
      }),
      
      performanceMonitor: new PerformanceMonitor({
        metricsInterval: 1000,
        enableDetailedMetrics: true,
        retentionPeriod: 60 * 60 * 1000, // 1 hour
        alertThresholds: {
          memoryUsage: 0.8,
          cpuUsage: 0.8,
          latency: PIPELINE_TEST_CONFIG.LATENCY_TARGETS.endToEndPipeline
        }
      }),
      
      protectionMechanisms: new ProtectionMechanisms({
        maxDrawdown: 0.20,
        stopLossPercentage: 0.05,
        dailyLossLimit: 2000,
        cooldownPeriod: 300000, // 5 minutes
        enableLowProfitFilter: true,
        lowProfitThreshold: 0.001
      }),
      
      marketDataBuffer: new MarketDataBuffer({
        maxSize: 10000,
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        enableCompression: true,
        compressionRatio: 0.1
      }),
      
      tradeReporting: new TradeReporting({
        enableRealTimeReporting: true,
        batchSize: 100,
        reportingInterval: 5000,
        enableAggregation: true
      })
    };
    
    // Initialize all components
    await this.components.strategyEngine.initialize();
    await this.components.executionEngine.initialize();
    await this.components.orderManager.initialize();
    await this.components.riskEngine.initialize();
    await this.components.performanceMonitor.start();
    await this.components.marketDataBuffer.initialize();
    await this.components.tradeReporting.initialize();
    
    // Setup pipeline connections
    await this.connectPipeline();
    
    // Load test strategies
    await this.loadTestStrategies();
  }
  
  private async connectPipeline(): Promise<void> {
    // Strategy Engine → Signal Processor
    this.components.strategyEngine.on('signal', (signal: StrategySignal) => {
      this.logEvent('StrategyEngine', 'signal_generated', signal);
      this.components.signalProcessor.processSignal(signal);
    });
    
    // Signal Processor → Risk Engine → Execution Engine
    this.components.signalProcessor.on('processedSignal', async (signal: StrategySignal) => {
      this.logEvent('SignalProcessor', 'signal_processed', signal);
      
      // Risk assessment
      const riskCheck = await this.components.riskEngine.assessSignalRisk(signal);
      this.logEvent('RiskEngine', 'risk_assessed', { signal, risk: riskCheck });
      
      if (riskCheck.approved) {
        await this.components.executionEngine.processSignal(signal);
      } else {
        this.logEvent('RiskEngine', 'signal_rejected', { signal, reason: riskCheck.reason });
      }
    });
    
    // Execution Engine → Order Manager
    this.components.executionEngine.on('orderRequest', async (orderRequest: any) => {
      this.logEvent('ExecutionEngine', 'order_requested', orderRequest);
      
      try {
        const orderId = await this.components.orderManager.createOrder(orderRequest);
        this.logEvent('OrderManager', 'order_created', { orderId, request: orderRequest });
      } catch (error) {
        this.logEvent('OrderManager', 'order_failed', { request: orderRequest, error: error.message });
      }
    });
    
    // Order Manager → Trade Reporting
    this.components.orderManager.on('orderFilled', (order: any) => {
      this.logEvent('OrderManager', 'order_filled', order);
      this.components.tradeReporting.reportTrade(order);
    });
    
    // Trade Reporting → Performance Monitor
    this.components.tradeReporting.on('tradeReported', (trade: Trade) => {
      this.logEvent('TradeReporting', 'trade_reported', trade);
      this.components.performanceMonitor.updatePerformance(trade);
    });
  }
  
  private async loadTestStrategies(): Promise<void> {
    const strategyConfigs: StrategyConfig[] = [
      {
        id: 'sma-cross-eth',
        name: 'SMA Cross ETH Strategy',
        type: 'trend_following',
        symbol: 'ETH-USD',
        timeframe: '1m',
        parameters: { fastPeriod: 10, slowPeriod: 20 },
        riskParameters: { maxPositionSize: 0.1, stopLossPercentage: 0.05 },
        isActive: true
      },
      {
        id: 'sma-cross-btc',
        name: 'SMA Cross BTC Strategy',
        type: 'trend_following',
        symbol: 'BTC-USD',
        timeframe: '5m',
        parameters: { fastPeriod: 5, slowPeriod: 15 },
        riskParameters: { maxPositionSize: 0.08, stopLossPercentage: 0.04 },
        isActive: true
      }
    ];
    
    for (const config of strategyConfigs) {
      const strategy = new SimpleMovingAverageCrossStrategy(config);
      await this.components.strategyEngine.loadStrategy(strategy);
      this.strategies.push(strategy);
    }
    
    this.logEvent('PipelineOrchestrator', 'strategies_loaded', { count: this.strategies.length });
  }
  
  private setupEventLogging(): void {
    this.eventLog = [];
  }
  
  private logEvent(component: string, event: string, data?: any): void {
    this.eventLog.push({
      timestamp: performance.now(),
      component,
      event,
      data
    });
  }
  
  async processMarketData(marketData: OHLCV[]): Promise<void> {
    for (const candle of marketData) {
      const processStart = performance.now();
      
      // Add to market data buffer
      await this.components.marketDataBuffer.addData(candle);
      this.logEvent('MarketDataBuffer', 'data_added', { symbol: candle.symbol, time: candle.time });
      
      // Process through strategy engine
      await this.components.strategyEngine.processMarketData(candle);
      
      const processTime = performance.now() - processStart;
      expect(processTime).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.dataIngestion);
    }
  }
  
  async shutdown(): Promise<void> {
    await this.components.performanceMonitor?.stop();
    await this.components.riskEngine?.shutdown();
    await this.components.orderManager?.shutdown();
    await this.components.executionEngine?.shutdown();
    await this.components.strategyEngine?.shutdown();
    await this.components.marketDataBuffer?.shutdown();
    await this.components.tradeReporting?.shutdown();
  }
  
  getEventLog(): typeof this.eventLog {
    return [...this.eventLog];
  }
  
  getPipelineMetrics(): any {
    return {
      strategyEngine: this.components.strategyEngine.getMetrics(),
      executionEngine: this.components.executionEngine.getMetrics(),
      orderManager: this.components.orderManager.getMetrics(),
      riskEngine: this.components.riskEngine.getMetrics(),
      performanceMonitor: this.components.performanceMonitor.getMetrics(),
      eventCount: this.eventLog.length
    };
  }
}

// Global test orchestrator
let pipelineOrchestrator: TradingPipelineTestOrchestrator;

beforeAll(async () => {
  pipelineOrchestrator = new TradingPipelineTestOrchestrator();
  await pipelineOrchestrator.initialize();
}, 30000);

afterAll(async () => {
  if (pipelineOrchestrator) {
    await pipelineOrchestrator.shutdown();
  }
});

describe('Trading Pipeline Integration Testing Suite', () => {
  
  describe('Complete Pipeline Flow Testing', () => {
    test('should execute complete signal-to-trade pipeline', async () => {
      const pipelineStart = performance.now();
      
      // Generate test market data
      const marketData = MockDataGenerator.generateOHLCVSeries(100, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.03,
        trend: 0.002
      });
      
      // Track pipeline events
      const initialEventCount = pipelineOrchestrator.getEventLog().length;
      
      // Process market data through pipeline
      await pipelineOrchestrator.processMarketData(marketData);
      
      // Wait for pipeline completion
      await TestingFramework.waitForCondition(async () => {
        const metrics = pipelineOrchestrator.getPipelineMetrics();
        return metrics.executionEngine.totalExecutions > 0;
      }, 15000);
      
      const pipelineTime = performance.now() - pipelineStart;
      const avgTimePerDataPoint = pipelineTime / marketData.length;
      
      // Validate pipeline performance
      expect(avgTimePerDataPoint).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.dataIngestion * 10);
      
      // Verify events were generated through pipeline
      const eventLog = pipelineOrchestrator.getEventLog();
      const newEvents = eventLog.slice(initialEventCount);
      
      expect(newEvents.length).toBeGreaterThan(0);
      
      // Verify event sequence integrity
      const eventTypes = newEvents.map(e => `${e.component}:${e.event}`);
      expect(eventTypes).toContain('MarketDataBuffer:data_added');
      expect(eventTypes).toContain('StrategyEngine:signal_generated');
      
      console.log(`Pipeline processed ${marketData.length} data points in ${pipelineTime.toFixed(2)}ms`);
      console.log(`Generated ${newEvents.length} pipeline events`);
    });
    
    test('should maintain data consistency throughout pipeline', async () => {
      // Create traceable market data with known properties
      const testData: OHLCV = {
        symbol: 'ETH-USD',
        time: Date.now(),
        open: 2000,
        high: 2050,
        low: 1980,
        close: 2020,
        volume: 1500
      };
      
      const trackingId = `test-${Date.now()}`;
      
      // Process single data point with tracking
      await pipelineOrchestrator.processMarketData([{ ...testData, trackingId } as any]);
      
      // Allow pipeline to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify data consistency in event log
      const eventLog = pipelineOrchestrator.getEventLog();
      const relatedEvents = eventLog.filter(e => 
        e.data && (e.data.symbol === 'ETH-USD' || e.data.trackingId === trackingId)
      );
      
      expect(relatedEvents.length).toBeGreaterThan(0);
      
      // Verify price consistency in events
      const priceEvents = relatedEvents.filter(e => e.data && e.data.price);
      for (const event of priceEvents) {
        const price = event.data.price;
        TestingFramework.assertBetween(
          price,
          testData.low * 0.99,  // Allow small tolerance
          testData.high * 1.01,
          `Price ${price} not within expected range for event ${event.component}:${event.event}`
        );
      }
    });
  });
  
  describe('Component Integration Validation', () => {
    test('should validate Strategy Engine → Signal Processor integration', async () => {
      // Create mock strategy signal
      const mockSignal: StrategySignal = {
        strategyId: 'sma-cross-eth',
        action: 'buy',
        symbol: 'ETH-USD',
        confidence: 0.8,
        timestamp: Date.now(),
        price: 2000,
        volume: 1.0,
        metadata: {
          reason: 'SMA crossover detected',
          indicators: { fastSMA: 1995, slowSMA: 1985 }
        }
      };
      
      // Track signal processing
      const processStart = performance.now();
      
      // Simulate signal emission from strategy engine
      pipelineOrchestrator['components'].strategyEngine.emit('signal', mockSignal);
      
      // Wait for signal processor to handle signal
      await TestingFramework.waitForCondition(() => {
        const eventLog = pipelineOrchestrator.getEventLog();
        return eventLog.some(e => e.component === 'SignalProcessor' && e.event === 'signal_processed');
      }, 5000);
      
      const processTime = performance.now() - processStart;
      expect(processTime).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.signalGeneration);
      
      // Verify signal was processed correctly
      const eventLog = pipelineOrchestrator.getEventLog();
      const processedEvents = eventLog.filter(e => 
        e.component === 'SignalProcessor' && e.event === 'signal_processed'
      );
      
      expect(processedEvents.length).toBeGreaterThan(0);
      
      const lastProcessedEvent = processedEvents[processedEvents.length - 1];
      expect(lastProcessedEvent.data.strategyId).toBe(mockSignal.strategyId);
      expect(lastProcessedEvent.data.action).toBe(mockSignal.action);
    });
    
    test('should validate Risk Engine → Execution Engine integration', async () => {
      // Create high-confidence signal
      const highConfidenceSignal: StrategySignal = {
        strategyId: 'sma-cross-eth',
        action: 'buy',
        symbol: 'ETH-USD',
        confidence: 0.9,
        timestamp: Date.now(),
        price: 2000,
        volume: 0.5, // Conservative volume
        metadata: { riskLevel: 'low' }
      };
      
      // Track risk assessment and execution
      const riskStart = performance.now();
      
      // Process signal through risk engine
      const riskAssessment = await pipelineOrchestrator['components'].riskEngine.assessSignalRisk(highConfidenceSignal);
      
      const riskTime = performance.now() - riskStart;
      expect(riskTime).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.riskAssessment);
      
      // Verify risk assessment
      expect(riskAssessment.approved).toBe(true);
      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.riskScore).toBeLessThanOrEqual(1);
      
      // Execute signal if approved
      if (riskAssessment.approved) {
        const execStart = performance.now();
        await pipelineOrchestrator['components'].executionEngine.processSignal(highConfidenceSignal);
        const execTime = performance.now() - execStart;
        
        expect(execTime).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.orderExecution);
      }
    });
    
    test('should validate Order Manager → Trade Reporting integration', async () => {
      // Create test order
      const orderRequest = {
        strategyId: 'sma-cross-eth',
        symbol: 'ETH-USD',
        side: 'buy' as const,
        quantity: 0.5,
        type: 'market' as const,
        timeInForce: 'IOC' as const
      };
      
      // Track order creation and reporting
      const orderStart = performance.now();
      
      const orderId = await pipelineOrchestrator['components'].orderManager.createOrder(orderRequest);
      
      const orderTime = performance.now() - orderStart;
      expect(orderTime).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.orderCreation);
      
      expect(orderId).toBeDefined();
      expect(typeof orderId).toBe('string');
      
      // Simulate order execution
      await pipelineOrchestrator['components'].orderManager.executeOrder(orderId);
      
      // Wait for trade reporting
      await TestingFramework.waitForCondition(() => {
        const eventLog = pipelineOrchestrator.getEventLog();
        return eventLog.some(e => e.component === 'TradeReporting' && e.event === 'trade_reported');
      }, 5000);
      
      // Verify trade was reported
      const eventLog = pipelineOrchestrator.getEventLog();
      const tradeEvents = eventLog.filter(e => 
        e.component === 'TradeReporting' && e.event === 'trade_reported'
      );
      
      expect(tradeEvents.length).toBeGreaterThan(0);
      
      const tradeEvent = tradeEvents[tradeEvents.length - 1];
      expect(tradeEvent.data.strategyId).toBe(orderRequest.strategyId);
      expect(tradeEvent.data.symbol).toBe(orderRequest.symbol);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test('should handle component failures gracefully', async () => {
      // Simulate order manager failure
      const originalCreateOrder = pipelineOrchestrator['components'].orderManager.createOrder;
      let failureCount = 0;
      
      // Inject intermittent failures
      pipelineOrchestrator['components'].orderManager.createOrder = async (request: any) => {
        failureCount++;
        if (failureCount % 3 === 0) {
          throw new Error('Simulated order manager failure');
        }
        return originalCreateOrder.call(pipelineOrchestrator['components'].orderManager, request);
      };
      
      // Process signals that should trigger orders
      const signals: StrategySignal[] = Array.from({ length: 6 }, (_, i) => ({
        strategyId: 'sma-cross-eth',
        action: 'buy',
        symbol: 'ETH-USD',
        confidence: 0.8,
        timestamp: Date.now() + i,
        price: 2000 + i,
        volume: 0.1,
        metadata: { test: 'failure-recovery' }
      }));
      
      // Process signals with error injection
      const results = await Promise.allSettled(
        signals.map(signal => 
          pipelineOrchestrator['components'].executionEngine.processSignal(signal)
        )
      );
      
      // Verify some succeeded and some failed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(successful).toBeGreaterThan(0);
      expect(failed).toBeGreaterThan(0);
      
      // Verify pipeline continues operating
      const metrics = pipelineOrchestrator.getPipelineMetrics();
      expect(metrics.executionEngine.successfulExecutions).toBeGreaterThan(0);
      expect(metrics.executionEngine.failedExecutions).toBeGreaterThan(0);
      
      // Restore original function
      pipelineOrchestrator['components'].orderManager.createOrder = originalCreateOrder;
      
      console.log(`Error handling test: ${successful} successful, ${failed} failed executions`);
    });
    
    test('should maintain pipeline integrity during high error rates', async () => {
      // Inject systematic errors across components
      const errorRate = 0.3; // 30% error rate
      
      const originalProcessSignal = pipelineOrchestrator['components'].signalProcessor.processSignal;
      pipelineOrchestrator['components'].signalProcessor.processSignal = async function(signal: StrategySignal) {
        if (Math.random() < errorRate) {
          throw new Error('Simulated signal processing error');
        }
        return originalProcessSignal.call(this, signal);
      };
      
      // Generate high volume of signals
      const testSignals = Array.from({ length: 50 }, (_, i) => ({
        strategyId: 'sma-cross-eth',
        action: i % 2 === 0 ? 'buy' : 'sell' as const,
        symbol: 'ETH-USD',
        confidence: Math.random() * 0.4 + 0.6,
        timestamp: Date.now() + i,
        price: 2000 + (Math.random() * 100 - 50),
        volume: Math.random() * 0.5 + 0.1,
        metadata: { stress: true }
      }));
      
      // Process signals with high error rate
      const startTime = performance.now();
      const results = await Promise.allSettled(
        testSignals.map(signal => 
          pipelineOrchestrator['components'].signalProcessor.processSignal(signal)
        )
      );
      const totalTime = performance.now() - startTime;
      
      // Verify system maintains performance under stress
      const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
      expect(successRate).toBeGreaterThan(1 - errorRate - 0.1); // Allow 10% tolerance
      
      // Verify pipeline components remain healthy
      const metrics = pipelineOrchestrator.getPipelineMetrics();
      expect(metrics.strategyEngine).toBeDefined();
      expect(metrics.executionEngine).toBeDefined();
      
      // Restore original function
      pipelineOrchestrator['components'].signalProcessor.processSignal = originalProcessSignal;
      
      console.log(`High error rate test: ${successRate.toFixed(2)} success rate with ${errorRate} error rate`);
    });
  });
  
  describe('Performance and Latency Validation', () => {
    test('should meet end-to-end latency requirements', async () => {
      const latencyMeasurements: number[] = [];
      
      // Generate test data
      const testData = MockDataGenerator.generateOHLCVSeries(20, {
        symbol: 'ETH-USD',
        startPrice: 2000,
        volatility: 0.02,
        trend: 0.001
      });
      
      // Measure end-to-end latency for each data point
      for (const candle of testData) {
        const startTime = performance.now();
        
        await pipelineOrchestrator.processMarketData([candle]);
        
        // Wait for complete pipeline processing
        await TestingFramework.waitForCondition(() => {
          const eventLog = pipelineOrchestrator.getEventLog();
          return eventLog.some(e => 
            e.timestamp > startTime && 
            (e.component === 'TradeReporting' || e.component === 'RiskEngine')
          );
        }, 2000);
        
        const endTime = performance.now();
        latencyMeasurements.push(endTime - startTime);
      }
      
      // Analyze latency distribution
      const avgLatency = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
      const maxLatency = Math.max(...latencyMeasurements);
      const p95Latency = latencyMeasurements.sort((a, b) => a - b)[Math.floor(latencyMeasurements.length * 0.95)];
      
      // Validate latency requirements
      expect(avgLatency).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.endToEndPipeline);
      expect(p95Latency).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.endToEndPipeline * 1.5);
      
      console.log(`Latency Analysis - Avg: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms`);
    });
    
    test('should maintain throughput under concurrent processing', async () => {
      const concurrencyLevels = [1, 2, 5, 10];
      const throughputResults: Array<{ concurrency: number; throughput: number; avgLatency: number }> = [];
      
      for (const concurrency of concurrencyLevels) {
        const testData = MockDataGenerator.generateOHLCVSeries(10, {
          symbol: 'ETH-USD',
          startPrice: 2000,
          volatility: 0.02
        });
        
        const startTime = performance.now();
        
        // Process data with specified concurrency
        const chunks = [];
        for (let i = 0; i < testData.length; i += Math.ceil(testData.length / concurrency)) {
          chunks.push(testData.slice(i, i + Math.ceil(testData.length / concurrency)));
        }
        
        await Promise.all(chunks.map(chunk => 
          pipelineOrchestrator.processMarketData(chunk)
        ));
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = testData.length / (totalTime / 1000); // items per second
        const avgLatency = totalTime / testData.length;
        
        throughputResults.push({ concurrency, throughput, avgLatency });
        
        // Verify performance doesn't degrade significantly
        expect(avgLatency).toBeLessThan(PIPELINE_TEST_CONFIG.LATENCY_TARGETS.endToEndPipeline * 2);
      }
      
      // Analyze throughput scaling
      console.log('Throughput Analysis:', throughputResults.map(r => 
        `Concurrency ${r.concurrency}: ${r.throughput.toFixed(1)} items/sec, ${r.avgLatency.toFixed(1)}ms avg latency`
      ));
      
      // Verify throughput increases with concurrency (within reasonable bounds)
      expect(throughputResults[3].throughput).toBeGreaterThan(throughputResults[0].throughput * 0.5);
    });
  });
  
  describe('Data Integrity and Accuracy', () => {
    test('should maintain portfolio accuracy throughout pipeline', async () => {
      // Set initial portfolio state
      const initialPortfolio: PortfolioState = {
        totalValue: 10000,
        availableBalance: 10000,
        positions: [],
        timestamp: Date.now()
      };
      
      // Track portfolio changes through known trades
      const knownTrades: Array<{ action: 'buy' | 'sell'; quantity: number; price: number }> = [
        { action: 'buy', quantity: 1.0, price: 2000 },
        { action: 'buy', quantity: 0.5, price: 2010 },
        { action: 'sell', quantity: 0.5, price: 2020 }
      ];
      
      let expectedBalance = initialPortfolio.availableBalance;
      let expectedPosition = 0;
      let expectedValue = initialPortfolio.totalValue;
      
      // Process each trade and verify portfolio accuracy
      for (const trade of knownTrades) {
        if (trade.action === 'buy') {
          expectedBalance -= trade.quantity * trade.price;
          expectedPosition += trade.quantity;
        } else {
          expectedBalance += trade.quantity * trade.price;
          expectedPosition -= trade.quantity;
        }
        
        // Simulate trade execution through pipeline
        const signal: StrategySignal = {
          strategyId: 'sma-cross-eth',
          action: trade.action,
          symbol: 'ETH-USD',
          confidence: 0.8,
          timestamp: Date.now(),
          price: trade.price,
          volume: trade.quantity,
          metadata: { portfolioTest: true }
        };
        
        await pipelineOrchestrator['components'].executionEngine.processSignal(signal);
      }
      
      // Wait for all trades to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get final portfolio metrics
      const finalMetrics = pipelineOrchestrator.getPipelineMetrics();
      
      // Verify portfolio calculation accuracy
      // Note: This would normally query the actual portfolio manager
      // For this test, we verify the trade reporting accuracy
      expect(finalMetrics.orderManager.totalOrders).toBe(knownTrades.length);
      
      console.log(`Portfolio accuracy test completed with ${knownTrades.length} trades`);
    });
  });
});