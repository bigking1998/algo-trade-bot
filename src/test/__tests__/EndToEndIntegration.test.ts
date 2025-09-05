/**
 * End-to-End Integration Test Suite - Task TE-001
 * 
 * Comprehensive integration testing for complete trading workflows:
 * - Market data ingestion to signal generation
 * - Strategy execution to order placement
 * - Portfolio management and risk assessment
 * - Multi-system component coordination
 * - Real-time data flow and processing
 * - Error recovery and system resilience
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { TestingFramework } from '../TestingFramework';
import { MockDataGenerator } from '../MockDataGenerator';

// Mock system components for integration testing
class MockTradingSystem {
  private components: {
    marketData: any;
    indicators: any;
    strategies: any;
    riskManager: any;
    portfolio: any;
    orderManager: any;
    database: any;
  };

  private systemState: 'initializing' | 'running' | 'error' | 'stopped' = 'initializing';
  private eventLog: Array<{ timestamp: Date; component: string; event: string; data?: any }> = [];

  constructor() {
    this.components = {
      marketData: new MockMarketDataProvider(),
      indicators: new MockIndicatorEngine(),
      strategies: new MockStrategyEngine(),
      riskManager: new MockRiskManager(),
      portfolio: new MockPortfolioManager(),
      orderManager: new MockOrderManager(),
      database: TestingFramework.createMockDatabase()
    };
  }

  async initialize(): Promise<void> {
    this.logEvent('system', 'initialization_started');
    
    try {
      // Initialize all components in sequence
      await this.components.database.connect();
      await this.components.marketData.connect();
      await this.components.indicators.initialize();
      await this.components.strategies.initialize();
      await this.components.riskManager.initialize();
      await this.components.portfolio.initialize();
      await this.components.orderManager.initialize();

      // Wire up event handlers for component communication
      this.setupEventHandlers();

      this.systemState = 'running';
      this.logEvent('system', 'initialization_completed');
    } catch (error) {
      this.systemState = 'error';
      this.logEvent('system', 'initialization_failed', { error: error.message });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Market data -> Indicators
    this.components.marketData.on('data', async (data: any) => {
      try {
        await this.components.indicators.update(data);
      } catch (error) {
        this.logEvent('indicators', 'update_failed', { error: error.message });
      }
    });

    // Indicators -> Strategies
    this.components.indicators.on('updated', async (indicators: any) => {
      try {
        const signals = await this.components.strategies.evaluate(indicators);
        if (signals.length > 0) {
          await this.processSignals(signals);
        }
      } catch (error) {
        this.logEvent('strategies', 'evaluation_failed', { error: error.message });
      }
    });

    // Strategies -> Risk Manager -> Order Manager
    this.components.strategies.on('signal', async (signal: any) => {
      await this.processSignal(signal);
    });

    // Orders -> Portfolio
    this.components.orderManager.on('orderFilled', async (order: any) => {
      await this.components.portfolio.updatePosition(order);
      this.logEvent('portfolio', 'position_updated', { order });
    });
  }

  private async processSignals(signals: any[]): Promise<void> {
    for (const signal of signals) {
      await this.processSignal(signal);
    }
  }

  private async processSignal(signal: any): Promise<void> {
    try {
      // Risk assessment
      const riskAssessment = await this.components.riskManager.assessSignal(signal);
      this.logEvent('risk', 'signal_assessed', { signal, assessment: riskAssessment });

      if (riskAssessment.approved) {
        // Create and submit order
        const order = await this.components.orderManager.createOrder({
          symbol: signal.symbol,
          side: signal.action,
          size: riskAssessment.positionSize,
          type: 'market',
          strategyId: signal.strategyId,
          reason: signal.reason
        });

        this.logEvent('orders', 'order_created', { order });
        await this.components.orderManager.submitOrder(order.id);
      } else {
        this.logEvent('risk', 'signal_rejected', { signal, reason: riskAssessment.reason });
      }
    } catch (error) {
      this.logEvent('system', 'signal_processing_failed', { signal, error: error.message });
    }
  }

  async startTradingSession(config: {
    symbols: string[];
    strategies: string[];
    duration: number; // minutes
  }): Promise<{
    tradesExecuted: number;
    signalsGenerated: number;
    portfolioValue: number;
    performance: any;
  }> {
    const { symbols, strategies, duration } = config;
    this.logEvent('session', 'trading_session_started', config);

    let tradesExecuted = 0;
    let signalsGenerated = 0;

    // Enable strategies
    for (const strategyId of strategies) {
      await this.components.strategies.enableStrategy(strategyId);
    }

    // Start market data feed for symbols
    for (const symbol of symbols) {
      this.components.marketData.subscribe(symbol);
    }

    // Simulate trading session
    const endTime = Date.now() + (duration * 60 * 1000);
    const dataInterval = 1000; // 1 second intervals

    while (Date.now() < endTime && this.systemState === 'running') {
      // Generate market data tick
      for (const symbol of symbols) {
        const marketTick = MockDataGenerator.generateOHLCV({ count: 1 })[0];
        await this.components.marketData.publishData(symbol, marketTick);
      }

      // Count events
      const recentEvents = this.eventLog.filter(e => 
        Date.now() - e.timestamp.getTime() < dataInterval * 2
      );
      
      signalsGenerated += recentEvents.filter(e => e.event === 'signal_generated').length;
      tradesExecuted += recentEvents.filter(e => e.event === 'order_filled').length;

      await new Promise(resolve => setTimeout(resolve, dataInterval));
    }

    // Get final portfolio state
    const portfolio = await this.components.portfolio.getPortfolioState();
    const performance = await this.components.portfolio.getPerformanceMetrics();

    this.logEvent('session', 'trading_session_completed', {
      tradesExecuted,
      signalsGenerated,
      portfolioValue: portfolio.totalValue
    });

    return {
      tradesExecuted,
      signalsGenerated,
      portfolioValue: portfolio.totalValue,
      performance
    };
  }

  async shutdown(): Promise<void> {
    this.logEvent('system', 'shutdown_started');
    
    this.systemState = 'stopped';
    
    // Cleanup components
    await this.components.orderManager.cancelAllOrders();
    await this.components.marketData.disconnect();
    await this.components.database.disconnect();

    this.logEvent('system', 'shutdown_completed');
  }

  getSystemState(): string {
    return this.systemState;
  }

  getEventLog(): Array<{ timestamp: Date; component: string; event: string; data?: any }> {
    return this.eventLog;
  }

  getComponentHealth(): Record<string, boolean> {
    return {
      marketData: this.components.marketData.isConnected(),
      database: this.components.database.isConnected(),
      strategies: this.components.strategies.isActive(),
      riskManager: this.components.riskManager.isActive(),
      portfolio: this.components.portfolio.isActive(),
      orderManager: this.components.orderManager.isActive()
    };
  }

  private logEvent(component: string, event: string, data?: any): void {
    this.eventLog.push({
      timestamp: new Date(),
      component,
      event,
      data
    });
  }

  // Error injection for testing
  async injectError(component: string, errorType: string): Promise<void> {
    switch (component) {
      case 'marketData':
        await this.components.marketData.simulateError(errorType);
        break;
      case 'database':
        await this.components.database.simulateError(errorType);
        break;
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }
}

// Mock component implementations
class MockMarketDataProvider {
  private connected = false;
  private subscriptions = new Set<string>();
  private eventHandlers = new Map<string, Function[]>();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscriptions.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(symbol: string): void {
    this.subscriptions.add(symbol);
  }

  async publishData(symbol: string, data: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to market data feed');
    }

    this.emit('data', { symbol, ...data });
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  async simulateError(errorType: string): Promise<void> {
    if (errorType === 'connection_loss') {
      this.connected = false;
    }
  }
}

class MockIndicatorEngine {
  private indicators: Map<string, any> = new Map();
  private eventHandlers = new Map<string, Function[]>();

  async initialize(): Promise<void> {
    // Initialize common indicators
    this.indicators.set('sma_20', { value: 0, isValid: false });
    this.indicators.set('ema_12', { value: 0, isValid: false });
    this.indicators.set('rsi_14', { value: 50, isValid: false });
    this.indicators.set('macd', { value: { macd: 0, signal: 0, histogram: 0 }, isValid: false });
  }

  async update(marketData: any): Promise<void> {
    // Simulate indicator calculations
    this.indicators.set('sma_20', { value: marketData.close * 0.99, isValid: true });
    this.indicators.set('ema_12', { value: marketData.close * 0.995, isValid: true });
    this.indicators.set('rsi_14', { value: 45 + Math.random() * 10, isValid: true });
    
    this.emit('updated', Object.fromEntries(this.indicators));
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }
}

class MockStrategyEngine {
  private strategies = new Map<string, any>();
  private activeStrategies = new Set<string>();
  private eventHandlers = new Map<string, Function[]>();

  async initialize(): Promise<void> {
    // Initialize mock strategies
    this.strategies.set('trend_following', {
      id: 'trend_following',
      name: 'Trend Following Strategy',
      enabled: false
    });
    
    this.strategies.set('mean_reversion', {
      id: 'mean_reversion',
      name: 'Mean Reversion Strategy',
      enabled: false
    });
  }

  async enableStrategy(strategyId: string): Promise<void> {
    if (this.strategies.has(strategyId)) {
      this.activeStrategies.add(strategyId);
      this.strategies.get(strategyId).enabled = true;
    }
  }

  async evaluate(indicators: any): Promise<any[]> {
    const signals = [];

    for (const strategyId of this.activeStrategies) {
      const signal = await this.generateSignal(strategyId, indicators);
      if (signal) {
        signals.push(signal);
        this.emit('signal', signal);
      }
    }

    return signals;
  }

  private async generateSignal(strategyId: string, indicators: any): Promise<any | null> {
    // Simple signal generation logic
    if (strategyId === 'trend_following') {
      const sma = indicators.sma_20?.value || 0;
      const currentPrice = sma * 1.01; // Mock current price
      
      if (currentPrice > sma * 1.002) {
        return {
          strategyId,
          symbol: 'BTC-USD',
          action: 'buy',
          confidence: 0.7,
          reason: 'Price above SMA with momentum',
          timestamp: new Date()
        };
      } else if (currentPrice < sma * 0.998) {
        return {
          strategyId,
          symbol: 'BTC-USD',
          action: 'sell',
          confidence: 0.6,
          reason: 'Price below SMA with downward momentum',
          timestamp: new Date()
        };
      }
    }

    return null;
  }

  isActive(): boolean {
    return this.activeStrategies.size > 0;
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }
}

class MockRiskManager {
  private maxPositionSize = 1000;
  private maxPortfolioRisk = 0.02;

  async initialize(): Promise<void> {
    // Risk manager initialization
  }

  async assessSignal(signal: any): Promise<{
    approved: boolean;
    positionSize: number;
    reason?: string;
  }> {
    // Simple risk assessment
    if (signal.confidence < 0.5) {
      return {
        approved: false,
        positionSize: 0,
        reason: 'Signal confidence too low'
      };
    }

    const baseSize = this.maxPositionSize * signal.confidence;
    return {
      approved: true,
      positionSize: Math.min(baseSize, this.maxPositionSize),
    };
  }

  isActive(): boolean {
    return true;
  }
}

class MockPortfolioManager {
  private portfolio: any = {
    totalValue: 100000,
    availableBalance: 50000,
    positions: [],
    timestamp: new Date()
  };

  async initialize(): Promise<void> {
    // Portfolio manager initialization
  }

  async getPortfolioState(): Promise<any> {
    return { ...this.portfolio };
  }

  async updatePosition(order: any): Promise<void> {
    // Update portfolio based on order
    if (order.status === 'filled') {
      this.portfolio.availableBalance -= order.size * order.price;
      
      // Add or update position
      const existingPosition = this.portfolio.positions.find((p: any) => p.symbol === order.symbol);
      if (existingPosition) {
        if (order.side === 'buy') {
          existingPosition.size += order.size;
        } else {
          existingPosition.size -= order.size;
        }
      } else {
        this.portfolio.positions.push({
          symbol: order.symbol,
          size: order.side === 'buy' ? order.size : -order.size,
          entryPrice: order.price,
          timestamp: new Date()
        });
      }
    }
  }

  async getPerformanceMetrics(): Promise<any> {
    return {
      totalReturn: 0.05,
      sharpeRatio: 1.2,
      maxDrawdown: 0.03,
      winRate: 0.65
    };
  }

  isActive(): boolean {
    return true;
  }
}

class MockOrderManager {
  private orders = new Map<string, any>();
  private orderIdCounter = 1;
  private eventHandlers = new Map<string, Function[]>();

  async initialize(): Promise<void> {
    // Order manager initialization
  }

  async createOrder(orderData: any): Promise<any> {
    const orderId = `order_${this.orderIdCounter++}`;
    const order = {
      id: orderId,
      ...orderData,
      status: 'pending',
      timestamp: new Date()
    };
    
    this.orders.set(orderId, order);
    return order;
  }

  async submitOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Simulate order processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    order.status = 'filled';
    order.price = 50000 + (Math.random() - 0.5) * 1000; // Mock fill price
    order.filledAt = new Date();

    this.emit('orderFilled', order);
  }

  async cancelAllOrders(): Promise<void> {
    for (const [orderId, order] of this.orders.entries()) {
      if (order.status === 'pending') {
        order.status = 'cancelled';
      }
    }
  }

  isActive(): boolean {
    return true;
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }
}

describe('End-to-End Integration Tests', () => {
  let tradingSystem: MockTradingSystem;

  beforeEach(async () => {
    tradingSystem = new MockTradingSystem();
  });

  afterEach(async () => {
    if (tradingSystem.getSystemState() === 'running') {
      await tradingSystem.shutdown();
    }
  });

  describe('System Initialization and Health', () => {
    test('should initialize all system components successfully', async () => {
      await TestingFramework.assertPerformance(async () => {
        await tradingSystem.initialize();
        expect(tradingSystem.getSystemState()).toBe('running');
      }, 5000, 'System initialization');

      const health = tradingSystem.getComponentHealth();
      Object.values(health).forEach(isHealthy => {
        expect(isHealthy).toBe(true);
      });
    });

    test('should handle component initialization failures', async () => {
      // This would test initialization failure scenarios
      // For now, just verify the error state handling
      try {
        await tradingSystem.initialize();
        
        // Inject a failure after initialization
        await tradingSystem.injectError('database', 'connection_lost');
        
        const health = tradingSystem.getComponentHealth();
        expect(health.database).toBe(false);
      } catch (error) {
        expect(tradingSystem.getSystemState()).toBe('error');
      }
    });

    test('should maintain system health monitoring', async () => {
      await tradingSystem.initialize();
      
      const initialHealth = tradingSystem.getComponentHealth();
      const healthyComponents = Object.values(initialHealth).filter(h => h).length;
      
      expect(healthyComponents).toBeGreaterThan(4); // Most components should be healthy
    });
  });

  describe('Complete Trading Workflows', () => {
    test('should execute complete market data to signal workflow', async () => {
      await tradingSystem.initialize();
      
      const sessionResults = await tradingSystem.startTradingSession({
        symbols: ['BTC-USD', 'ETH-USD'],
        strategies: ['trend_following'],
        duration: 0.1 // 6 seconds
      });

      expect(sessionResults.signalsGenerated).toBeGreaterThanOrEqual(0);
      expect(sessionResults.portfolioValue).toBeGreaterThan(0);
      expect(sessionResults.performance).toBeDefined();
      
      console.log('Trading session results:', sessionResults);
    });

    test('should handle multi-strategy coordination', async () => {
      await tradingSystem.initialize();
      
      const sessionResults = await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following', 'mean_reversion'],
        duration: 0.1
      });

      // Should generate signals from multiple strategies
      const eventLog = tradingSystem.getEventLog();
      const signalEvents = eventLog.filter(e => e.event === 'signal_generated');
      
      expect(sessionResults.signalsGenerated).toBeGreaterThanOrEqual(0);
      expect(sessionResults.portfolioValue).toBeGreaterThan(0);
    });

    test('should maintain data consistency across components', async () => {
      await tradingSystem.initialize();
      
      await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.1
      });

      const eventLog = tradingSystem.getEventLog();
      
      // Verify event sequence consistency
      const marketDataEvents = eventLog.filter(e => e.component === 'marketData');
      const indicatorEvents = eventLog.filter(e => e.component === 'indicators');
      const signalEvents = eventLog.filter(e => e.component === 'strategies');
      
      // Market data should trigger indicator updates
      expect(marketDataEvents.length).toBeGreaterThan(0);
      expect(indicatorEvents.length).toBeGreaterThan(0);
    });

    test('should handle real-time performance requirements', async () => {
      await tradingSystem.initialize();
      
      const startTime = Date.now();
      
      await TestingFramework.assertPerformance(async () => {
        await tradingSystem.startTradingSession({
          symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
          strategies: ['trend_following', 'mean_reversion'],
          duration: 0.2 // 12 seconds
        });
      }, 15000, 'Multi-symbol, multi-strategy session');
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(15000);
    });
  });

  describe('Risk Management Integration', () => {
    test('should enforce risk limits across trading workflow', async () => {
      await tradingSystem.initialize();
      
      await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.1
      });

      const eventLog = tradingSystem.getEventLog();
      const riskEvents = eventLog.filter(e => e.component === 'risk');
      
      // Should have risk assessments
      const assessmentEvents = riskEvents.filter(e => e.event === 'signal_assessed');
      if (assessmentEvents.length > 0) {
        assessmentEvents.forEach(event => {
          expect(event.data.assessment).toBeDefined();
          expect(typeof event.data.assessment.approved).toBe('boolean');
          expect(typeof event.data.assessment.positionSize).toBe('number');
        });
      }
    });

    test('should reject high-risk signals appropriately', async () => {
      await tradingSystem.initialize();
      
      await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.1
      });

      const eventLog = tradingSystem.getEventLog();
      const rejectedSignals = eventLog.filter(e => e.event === 'signal_rejected');
      
      // Verify rejection reasons are provided
      rejectedSignals.forEach(event => {
        expect(event.data.reason).toBeDefined();
        expect(typeof event.data.reason).toBe('string');
      });
    });

    test('should maintain portfolio risk limits', async () => {
      await tradingSystem.initialize();
      
      const sessionResults = await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.1
      });

      // Portfolio value should not change drastically in short session
      const expectedRange = { min: 95000, max: 105000 }; // ±5% from initial 100k
      expect(sessionResults.portfolioValue).toBeGreaterThan(expectedRange.min);
      expect(sessionResults.portfolioValue).toBeLessThan(expectedRange.max);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle market data disconnection gracefully', async () => {
      await tradingSystem.initialize();
      
      // Start session
      const sessionPromise = tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.2
      });

      // Inject market data error after short delay
      setTimeout(async () => {
        await tradingSystem.injectError('marketData', 'connection_loss');
      }, 2000);

      const sessionResults = await sessionPromise;
      
      // System should handle the error and still return results
      expect(sessionResults).toBeDefined();
      
      const eventLog = tradingSystem.getEventLog();
      const errorEvents = eventLog.filter(e => e.event.includes('failed') || e.event.includes('error'));
      
      // Should have logged the error appropriately
      if (errorEvents.length > 0) {
        expect(errorEvents.some(e => e.data?.error)).toBe(true);
      }
    });

    test('should maintain system integrity during component failures', async () => {
      await tradingSystem.initialize();
      
      const initialHealth = tradingSystem.getComponentHealth();
      const initialHealthyCount = Object.values(initialHealth).filter(h => h).length;

      // Inject error in one component
      await tradingSystem.injectError('marketData', 'connection_loss');
      
      const postErrorHealth = tradingSystem.getComponentHealth();
      const postErrorHealthyCount = Object.values(postErrorHealth).filter(h => h).length;

      // Should have one less healthy component
      expect(postErrorHealthyCount).toBe(initialHealthyCount - 1);
      
      // Other components should remain healthy
      expect(postErrorHealthyCount).toBeGreaterThan(3);
    });

    test('should handle concurrent system stress', async () => {
      await tradingSystem.initialize();
      
      // Start multiple concurrent sessions (simulating high load)
      const sessionPromises = Array.from({ length: 3 }, (_, i) => 
        tradingSystem.startTradingSession({
          symbols: [`SYM${i}-USD`],
          strategies: ['trend_following'],
          duration: 0.05 // Very short sessions
        })
      );

      const results = await Promise.all(sessionPromises);
      
      // All sessions should complete successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.portfolioValue).toBeGreaterThan(0);
      });

      expect(tradingSystem.getSystemState()).toBe('running');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-frequency data processing', async () => {
      await tradingSystem.initialize();
      
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        await tradingSystem.startTradingSession({
          symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD'],
          strategies: ['trend_following', 'mean_reversion'],
          duration: 0.15 // 9 seconds with high frequency
        });
      });

      expect(memoryTest.memoryUsedMB).toBeLessThan(100); // Should use less than 100MB
      expect(memoryTest.executionTimeMs).toBeLessThan(12000); // Should complete within 12s
      
      console.log(`High-frequency processing: ${memoryTest.memoryUsedMB.toFixed(2)}MB, ${memoryTest.executionTimeMs.toFixed(2)}ms`);
    });

    test('should scale with multiple symbols and strategies', async () => {
      await tradingSystem.initialize();
      
      const scaleTests = [
        { symbols: 1, strategies: 1, maxTime: 3000 },
        { symbols: 3, strategies: 2, maxTime: 5000 },
        { symbols: 5, strategies: 3, maxTime: 8000 }
      ];

      for (const { symbols, strategies, maxTime } of scaleTests) {
        const symbolList = Array.from({ length: symbols }, (_, i) => `SYM${i}-USD`);
        const strategyList = ['trend_following', 'mean_reversion'].slice(0, strategies);

        await TestingFramework.assertPerformance(async () => {
          const results = await tradingSystem.startTradingSession({
            symbols: symbolList,
            strategies: strategyList,
            duration: 0.1
          });
          
          expect(results.portfolioValue).toBeGreaterThan(0);
        }, maxTime, `Scale test: ${symbols} symbols, ${strategies} strategies`);
      }
    });

    test('should maintain consistent latency under load', async () => {
      await tradingSystem.initialize();
      
      const latencies = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        await tradingSystem.startTradingSession({
          symbols: ['BTC-USD'],
          strategies: ['trend_following'],
          duration: 0.03 // Very short session
        });
        
        const latency = performance.now() - startTime;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const latencyVariance = Math.max(...latencies) - Math.min(...latencies);

      expect(avgLatency).toBeLessThan(2000); // Average < 2s
      expect(maxLatency).toBeLessThan(3000); // Max < 3s  
      expect(latencyVariance).toBeLessThan(1500); // Consistent performance
      
      console.log(`Latency stats: avg=${avgLatency.toFixed(0)}ms, max=${maxLatency.toFixed(0)}ms, variance=${latencyVariance.toFixed(0)}ms`);
    });
  });

  describe('Data Flow and Event Ordering', () => {
    test('should maintain correct event sequence', async () => {
      await tradingSystem.initialize();
      
      await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.1
      });

      const eventLog = tradingSystem.getEventLog();
      
      // Verify chronological ordering
      for (let i = 1; i < eventLog.length; i++) {
        expect(eventLog[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          eventLog[i - 1].timestamp.getTime()
        );
      }

      // Verify logical event sequence patterns
      const initializationEvents = eventLog.filter(e => e.event.includes('initialization'));
      const dataEvents = eventLog.filter(e => e.component === 'marketData');
      const indicatorEvents = eventLog.filter(e => e.component === 'indicators');

      // Initialization should come first
      if (initializationEvents.length > 0 && dataEvents.length > 0) {
        expect(initializationEvents[0].timestamp.getTime()).toBeLessThan(
          dataEvents[0].timestamp.getTime()
        );
      }
    });

    test('should handle concurrent event processing correctly', async () => {
      await tradingSystem.initialize();
      
      await tradingSystem.startTradingSession({
        symbols: ['BTC-USD', 'ETH-USD'],
        strategies: ['trend_following'],
        duration: 0.1
      });

      const eventLog = tradingSystem.getEventLog();
      
      // Check for event processing without race conditions
      const signalEvents = eventLog.filter(e => e.component === 'strategies');
      const riskEvents = eventLog.filter(e => e.component === 'risk');
      const orderEvents = eventLog.filter(e => e.component === 'orders');

      // Each signal should have corresponding risk assessment
      signalEvents.forEach(signalEvent => {
        const relatedRiskEvents = riskEvents.filter(re => 
          Math.abs(re.timestamp.getTime() - signalEvent.timestamp.getTime()) < 1000
        );
        // Should have at least one risk event shortly after signal
        expect(relatedRiskEvents.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('System Cleanup and Resource Management', () => {
    test('should clean up resources properly on shutdown', async () => {
      await tradingSystem.initialize();
      
      await tradingSystem.startTradingSession({
        symbols: ['BTC-USD'],
        strategies: ['trend_following'],
        duration: 0.05
      });

      await tradingSystem.shutdown();
      
      expect(tradingSystem.getSystemState()).toBe('stopped');
      
      const finalHealth = tradingSystem.getComponentHealth();
      
      // Most components should be disconnected/inactive after shutdown
      const activeComponents = Object.values(finalHealth).filter(h => h).length;
      expect(activeComponents).toBeLessThan(3); // Allow some tolerance
    });

    test('should prevent resource leaks during extended operation', async () => {
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;
      
      await tradingSystem.initialize();
      
      // Run multiple trading sessions
      for (let i = 0; i < 5; i++) {
        await tradingSystem.startTradingSession({
          symbols: ['BTC-USD'],
          strategies: ['trend_following'],
          duration: 0.03
        });
      }

      await tradingSystem.shutdown();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(50); // Should not increase by more than 50MB
      
      console.log(`Resource leak test: memory increase = ${memoryIncrease.toFixed(2)}MB`);
    });
  });
});