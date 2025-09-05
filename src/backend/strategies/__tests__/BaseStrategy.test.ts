/**
 * BaseStrategy Tests - BE-007 Validation
 * 
 * Tests for the base strategy interface and example implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleMovingAverageCrossStrategy } from '../examples/SimpleMovingAverageCrossStrategy.js';
import { StrategyFactory } from '../StrategyFactory.js';
import type { StrategyConfig, StrategyContext, MarketDataWindow } from '../types.js';
import type { DydxCandle } from '../../../shared/types/trading.js';

describe('BaseStrategy Framework', () => {
  let strategy: SimpleMovingAverageCrossStrategy;
  let config: StrategyConfig;
  let context: StrategyContext;

  beforeEach(() => {
    // Create default strategy configuration
    config = SimpleMovingAverageCrossStrategy.createDefaultConfig({
      id: 'test-sma-001',
      name: 'Test SMA Strategy',
      symbols: ['BTC-USD'],
      timeframes: ['1h']
    });

    strategy = new SimpleMovingAverageCrossStrategy(config);

    // Create mock market data
    const mockCandles: DydxCandle[] = [];
    for (let i = 0; i < 100; i++) {
      mockCandles.push({
        time: Date.now() - (100 - i) * 3600000, // 1 hour intervals
        open: 50000 + Math.random() * 1000,
        high: 51000 + Math.random() * 1000,
        low: 49000 + Math.random() * 1000,
        close: 50000 + Math.random() * 1000,
        volume: 1000 + Math.random() * 500,
        timeframe: '1h',
        symbol: 'BTC-USD'
      });
    }

    const marketData: MarketDataWindow = {
      symbol: 'BTC-USD',
      timeframe: '1h',
      candles: mockCandles,
      currentPrice: 50500,
      volume24h: 50000,
      change24h: 500,
      change24hPercent: 1.0,
      high24h: 51500,
      low24h: 49500,
      lastUpdate: new Date()
    };

    context = {
      marketData,
      indicators: {
        sma: { 20: 50000, 50: 49800 },
        lastCalculated: new Date()
      },
      portfolio: {
        time: new Date(),
        total_value: 100000,
        cash_balance: 50000,
        positions_value: 50000,
        unrealized_pnl: 0,
        realized_pnl: 0,
        positions: {},
        metrics: {},
        created_at: new Date()
      },
      riskMetrics: {
        portfolioValue: 100000,
        availableCapital: 50000,
        usedMargin: 0,
        marginRatio: 0,
        totalPositions: 0,
        longPositions: 0,
        shortPositions: 0,
        largestPosition: 0,
        concentrationRisk: 0,
        strategyExposure: 0,
        correlationRisk: 0,
        drawdown: 0,
        maxDrawdown: 0,
        marketVolatility: 0.02,
        liquidityRisk: 0.1,
        gapRisk: 0.05,
        maxRiskPerTrade: 2,
        maxPortfolioRisk: 10,
        maxLeverage: 3,
        riskScore: 30,
        lastAssessed: new Date()
      },
      recentSignals: [],
      recentTrades: [],
      timestamp: new Date(),
      executionId: 'test-exec-001',
      strategyId: 'test-sma-001',
      marketConditions: {
        trend: 'bull',
        volatility: 'medium',
        liquidity: 'high',
        session: 'american'
      }
    };
  });

  describe('Strategy Configuration', () => {
    it('should create default configuration', () => {
      const defaultConfig = SimpleMovingAverageCrossStrategy.createDefaultConfig();
      
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.name).toBe('Simple Moving Average Cross');
      expect(defaultConfig.type).toBe('technical');
      expect(defaultConfig.parameters.shortPeriod.value).toBe(20);
      expect(defaultConfig.parameters.longPeriod.value).toBe(50);
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        const invalidConfig = SimpleMovingAverageCrossStrategy.createDefaultConfig();
        invalidConfig.parameters.shortPeriod.value = 50;
        invalidConfig.parameters.longPeriod.value = 20; // Invalid: short >= long
        new SimpleMovingAverageCrossStrategy(invalidConfig);
      }).toThrow('Short period must be less than long period');
    });
  });

  describe('Strategy Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(strategy.initialize()).resolves.not.toThrow();
      expect(strategy.getState()).toBe('idle');
    });

    it('should start and stop correctly', async () => {
      await strategy.start();
      expect(strategy.getState()).toBe('running');

      await strategy.stop();
      expect(strategy.getState()).toBe('stopped');
    });

    it('should handle pause and resume', async () => {
      await strategy.start();
      expect(strategy.getState()).toBe('running');

      await strategy.pause();
      expect(strategy.getState()).toBe('paused');

      await strategy.resume();
      expect(strategy.getState()).toBe('running');
    });
  });

  describe('Signal Generation', () => {
    beforeEach(async () => {
      await strategy.initialize();
    });

    it('should return null when insufficient data', async () => {
      const insufficientContext = {
        ...context,
        marketData: {
          ...context.marketData,
          candles: context.marketData.candles.slice(0, 10) // Only 10 candles
        }
      };

      const signal = await strategy.generateSignal(insufficientContext);
      expect(signal).toBeNull();
    });

    it('should generate signal on valid crossover', async () => {
      // First execution to establish baseline
      await strategy.generateSignal(context);

      // Create context with clear golden cross
      const goldenCrossContext = {
        ...context,
        marketData: {
          ...context.marketData,
          candles: [
            ...context.marketData.candles.slice(0, -1),
            {
              ...context.marketData.candles[context.marketData.candles.length - 1],
              close: 52000 // Price above both MAs to trigger golden cross
            }
          ]
        }
      };

      const signal = await strategy.generateSignal(goldenCrossContext);
      
      if (signal) {
        expect(signal.type).toBe('BUY');
        expect(signal.symbol).toBe('BTC-USD');
        expect(signal.confidence).toBeGreaterThan(0);
        expect(signal.entryPrice).toBeDefined();
        expect(signal.stopLoss).toBeDefined();
        expect(signal.takeProfit).toBeDefined();
      }
    });

    it('should validate signals correctly', async () => {
      const mockSignal = {
        id: 'test-signal-001',
        strategyId: 'test-sma-001',
        timestamp: new Date(),
        type: 'BUY' as const,
        symbol: 'BTC-USD',
        confidence: 75,
        strength: 0.8,
        entryPrice: 50500,
        stopLoss: 49500,
        takeProfit: 52500,
        timeframe: '1h' as const,
        reasoning: 'Golden cross detected',
        isValid: true
      };

      const isValid = await strategy.validateSignal(mockSignal, context);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signals', async () => {
      const invalidSignal = {
        id: 'test-signal-002',
        strategyId: 'test-sma-001',
        timestamp: new Date(),
        type: 'BUY' as const,
        symbol: 'BTC-USD',
        confidence: 75,
        strength: 0.8,
        entryPrice: 50500,
        stopLoss: 40000, // Stop loss too far (>10% of price)
        timeframe: '1h' as const,
        reasoning: 'Invalid stop loss',
        isValid: true
      };

      const isValid = await strategy.validateSignal(invalidSignal, context);
      expect(isValid).toBe(false);
    });
  });

  describe('Position Management', () => {
    beforeEach(async () => {
      await strategy.initialize();
    });

    it('should calculate position size correctly', async () => {
      const mockSignal = {
        id: 'test-signal-003',
        strategyId: 'test-sma-001',
        timestamp: new Date(),
        type: 'BUY' as const,
        symbol: 'BTC-USD',
        confidence: 75,
        strength: 0.8,
        entryPrice: 50500,
        stopLoss: 49500,
        takeProfit: 52500,
        timeframe: '1h' as const,
        reasoning: 'Position sizing test',
        isValid: true
      };

      const positionSize = await strategy.calculatePositionSize(mockSignal, context);
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThan(context.portfolio.total_value);
    });

    it('should determine position exit correctly', async () => {
      const mockPosition = {
        id: 'pos-001',
        strategyId: 'test-sma-001',
        symbol: 'BTC-USD',
        side: 'long' as const,
        size: 0.5,
        entryPrice: 50000,
        currentPrice: 49000,
        unrealizedPnL: -500,
        realizedPnL: 0,
        totalPnL: -500,
        pnlPercent: -1,
        stopLoss: 49500,
        entryTime: new Date(),
        holdingPeriod: 3600000,
        metadata: {},
        status: 'open' as const
      };

      const shouldExit = await strategy.shouldExitPosition(mockPosition, context);
      expect(typeof shouldExit).toBe('boolean');
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await strategy.initialize();
    });

    it('should track execution metrics', async () => {
      const initialMetrics = strategy.getMetrics();
      expect(initialMetrics.executionCount).toBe(0);

      await strategy.executeStrategy(context);

      const updatedMetrics = strategy.getMetrics();
      expect(updatedMetrics.executionCount).toBe(1);
      expect(updatedMetrics.lastExecutionTime).toBeDefined();
    });

    it('should perform health check', async () => {
      const healthCheck = await strategy.performHealthCheck();
      
      expect(healthCheck).toBeDefined();
      expect(healthCheck.strategyId).toBe('test-sma-001');
      expect(healthCheck.isHealthy).toBe(true);
      expect(healthCheck.score).toBeGreaterThanOrEqual(0);
      expect(healthCheck.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(healthCheck.checks)).toBe(true);
    });

    it('should reset metrics', () => {
      const strategy2 = new SimpleMovingAverageCrossStrategy(config);
      strategy2.resetMetrics();
      
      const metrics = strategy2.getMetrics();
      expect(metrics.executionCount).toBe(0);
      expect(metrics.signalsGenerated).toBe(0);
      expect(metrics.totalTrades).toBe(0);
    });
  });

  describe('Strategy Factory', () => {
    it('should create strategy instances', () => {
      const factory = StrategyFactory.getInstance();
      const availableTypes = factory.getAvailableStrategyTypes();
      
      expect(availableTypes).toContain('sma_cross');
    });

    it('should create strategy by type', () => {
      const factory = StrategyFactory.getInstance();
      const strategy = factory.createStrategyByType('sma_cross');
      
      expect(strategy).toBeInstanceOf(SimpleMovingAverageCrossStrategy);
      expect(strategy.getConfig().name).toBe('Simple Moving Average Cross');
    });

    it('should validate strategy support', () => {
      const factory = StrategyFactory.getInstance();
      const validation = factory.validateStrategySupport(
        'sma_cross', 
        ['1h', '4h'], 
        ['BTC-USD', 'ETH-USD']
      );
      
      expect(validation.isSupported).toBe(true);
      expect(validation.unsupportedTimeframes).toHaveLength(0);
      expect(validation.unsupportedAssets).toHaveLength(0);
    });
  });
});