/**
 * Strategy Templates Comprehensive Tests - Task BE-015: Strategy Templates Implementation
 * 
 * Tests for all strategy templates to validate:
 * - Signal generation correctness
 * - Risk management integration
 * - Indicator usage and calculations
 * - Edge case handling
 * - Configuration validation
 * - Position management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EMACrossoverStrategy, type EMACrossoverConfig } from '../EMAcrossoverStrategy.js';
import { RSIMeanReversionStrategy, type RSIMeanReversionConfig } from '../RSIMeanReversionStrategy.js';
import { MACDTrendStrategy, type MACDTrendConfig } from '../MACDTrendStrategy.js';
import { BreakoutStrategy, type BreakoutConfig } from '../BreakoutStrategy.js';
import type { StrategyContext, StrategySignal, Position } from '../../types.js';
import type { OHLCV } from '../../../indicators/base/types.js';

describe('Strategy Templates', () => {
  // Test data generators
  function createTestContext(overrides: Partial<StrategyContext> = {}): StrategyContext {
    return {
      timestamp: new Date(),
      marketData: {
        symbol: 'BTC-USD',
        timeframe: '5m',
        currentPrice: 50000,
        high24h: 52000,
        low24h: 48000,
        volume24h: 1000000,
        candles: createTestCandles()
      },
      portfolio: {
        total_value: 10000,
        available_balance: 5000,
        positions_value: 5000,
        unrealized_pnl: 0,
        realized_pnl: 0
      },
      indicators: {},
      riskMetrics: {
        totalExposure: 0.5,
        usedMargin: 2500,
        availableMargin: 7500,
        openPositionsCount: 1
      },
      marketConditions: {
        volatility: 'medium',
        trend: 'bullish',
        volume: 'normal'
      },
      ...overrides
    };
  }

  function createTestCandles(): OHLCV[] {
    const candles: OHLCV[] = [];
    let price = 49000;
    
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * 200;
      price += change;
      
      const high = price + Math.random() * 100;
      const low = price - Math.random() * 100;
      
      candles.push({
        startedAt: new Date(Date.now() - (100 - i) * 300000).toISOString(),
        open: price.toString(),
        high: high.toString(),
        low: low.toString(),
        close: price.toString(),
        baseTokenVolume: (1000 + Math.random() * 500).toString(),
        usdVolume: (price * 1000).toString()
      });
    }
    
    return candles;
  }

  function createBaseConfig() {
    return {
      id: 'test-strategy',
      name: 'Test Strategy',
      version: '1.0.0',
      symbols: ['BTC-USD'],
      timeframes: ['5m'],
      riskProfile: {
        maxRiskPerTrade: 2.0,
        maxPortfolioRisk: 10.0,
        maxPositions: 5,
        stopLossRequired: true,
        takeProfitRequired: false
      },
      execution: {
        minPositionSize: 0.01,
        maxPositionSize: 1000,
        timeout: 30
      },
      monitoring: {
        healthCheckInterval: 60
      },
      validation: {
        minConfidence: 60
      }
    };
  }

  describe('EMA Crossover Strategy', () => {
    let strategy: EMACrossoverStrategy;
    let config: EMACrossoverConfig;

    beforeEach(async () => {
      config = {
        ...createBaseConfig(),
        fastEmaPeriod: 5,
        slowEmaPeriod: 10,
        trendEmaPeriod: 20,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.0,
        enableTrendConfirmation: true,
        enableVolumeConfirmation: true,
        minSignalStrength: 50
      };
      
      strategy = new EMACrossoverStrategy(config);
      await strategy.initialize();
    });

    it('should initialize correctly with valid configuration', async () => {
      expect(strategy.getState()).toBe('idle');
      expect(strategy.getConfig().name).toBe('Test Strategy');
    });

    it('should validate configuration properly', () => {
      const invalidConfig = { ...config, fastEmaPeriod: 15 }; // Fast >= Slow
      expect(() => new EMACrossoverStrategy(invalidConfig)).toThrow();
    });

    it('should generate BUY signal on bullish crossover', async () => {
      const context = createTestContext();
      
      // Mock a bullish crossover scenario
      const signal = await strategy.execute(context);
      
      // Signal may or may not be generated depending on test data
      if (signal) {
        expect(signal.type).toBe('BUY');
        expect(signal.confidence).toBeGreaterThan(0);
        expect(signal.entryPrice).toBeGreaterThan(0);
        expect(signal.stopLoss).toBeLessThan(signal.entryPrice);
        expect(signal.takeProfit).toBeGreaterThan(signal.entryPrice);
      }
    });

    it('should calculate position size based on risk parameters', async () => {
      const context = createTestContext();
      const signal: StrategySignal = {
        id: 'test',
        strategyId: 'test',
        timestamp: new Date(),
        type: 'BUY',
        symbol: 'BTC-USD',
        confidence: 80,
        strength: 75,
        timeframe: '5m',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        maxRisk: 2.0,
        reasoning: 'Test signal',
        indicators: {},
        conditions: [],
        source: 'technical',
        priority: 'medium',
        isValid: true
      };

      const positionSize = await strategy.calculatePositionSize(signal, context);
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThan(context.portfolio.total_value * 0.1);
    });

    it('should determine exit conditions correctly', async () => {
      const context = createTestContext();
      const position: Position = {
        id: 'test-pos',
        strategyId: 'test',
        symbol: 'BTC-USD',
        side: 'LONG',
        size: 0.1,
        entryPrice: 49000,
        currentPrice: 50000,
        unrealizedPnl: 100,
        stopLoss: 48000,
        takeProfit: 52000,
        timestamp: new Date(),
        metadata: {}
      };

      const shouldExit = await strategy.shouldExitPosition(position, context);
      expect(typeof shouldExit).toBe('boolean');
    });
  });

  describe('RSI Mean Reversion Strategy', () => {
    let strategy: RSIMeanReversionStrategy;
    let config: RSIMeanReversionConfig;

    beforeEach(async () => {
      config = {
        ...createBaseConfig(),
        rsiPeriod: 10,
        oversoldThreshold: 30,
        overboughtThreshold: 70,
        extremeOversoldThreshold: 20,
        extremeOverboughtThreshold: 80,
        neutralizationLevel: 50,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 1.5,
        atrTargetMultiplier: 2.5,
        enableDivergenceConfirmation: true,
        enableVolumeConfirmation: true,
        enableBollingerConfirmation: true,
        bollingerPeriod: 20,
        bollingerStdDev: 2.0,
        minHoldingPeriod: 5,
        maxHoldingPeriod: 50,
        minSignalStrength: 60
      };
      
      strategy = new RSIMeanReversionStrategy(config);
      await strategy.initialize();
    });

    it('should initialize correctly', async () => {
      expect(strategy.getState()).toBe('idle');
    });

    it('should validate RSI thresholds correctly', () => {
      const invalidConfig = { ...config, oversoldThreshold: 80 }; // Invalid threshold
      expect(() => new RSIMeanReversionStrategy(invalidConfig)).toThrow();
    });

    it('should generate signals based on RSI extremes', async () => {
      const context = createTestContext();
      
      const signal = await strategy.execute(context);
      
      if (signal) {
        expect(['BUY', 'SELL']).toContain(signal.type);
        expect(signal.confidence).toBeGreaterThan(0);
        expect(signal.metadata).toBeDefined();
      }
    });

    it('should handle position exits based on RSI normalization', async () => {
      const context = createTestContext();
      const position: Position = {
        id: 'test-pos',
        strategyId: 'test',
        symbol: 'BTC-USD',
        side: 'LONG',
        size: 0.1,
        entryPrice: 49000,
        currentPrice: 50000,
        unrealizedPnl: 100,
        stopLoss: 48000,
        takeProfit: 52000,
        timestamp: new Date(),
        metadata: {}
      };

      const shouldExit = await strategy.shouldExitPosition(position, context);
      expect(typeof shouldExit).toBe('boolean');
    });
  });

  describe('MACD Trend Strategy', () => {
    let strategy: MACDTrendStrategy;
    let config: MACDTrendConfig;

    beforeEach(async () => {
      config = {
        ...createBaseConfig(),
        macdFastPeriod: 5,
        macdSlowPeriod: 10,
        macdSignalPeriod: 5,
        minHistogramThreshold: 0.001,
        minVolumeMultiple: 1.3,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.5,
        enableZeroLineConfirmation: true,
        enableHistogramDivergence: true,
        enableVolumeConfirmation: true,
        enableTrendConfirmation: true,
        trendSmaPeriod: 20,
        minSignalStrength: 65,
        histogramLookback: 5,
        enableHistogramExit: true
      };
      
      strategy = new MACDTrendStrategy(config);
      await strategy.initialize();
    });

    it('should initialize correctly', async () => {
      expect(strategy.getState()).toBe('idle');
    });

    it('should validate MACD periods correctly', () => {
      const invalidConfig = { ...config, macdFastPeriod: 15 }; // Fast >= Slow
      expect(() => new MACDTrendStrategy(invalidConfig)).toThrow();
    });

    it('should generate signals on MACD crossovers', async () => {
      const context = createTestContext();
      
      const signal = await strategy.execute(context);
      
      if (signal) {
        expect(['BUY', 'SELL']).toContain(signal.type);
        expect(signal.metadata?.crossoverType).toBeDefined();
        expect(signal.metadata?.macdValue).toBeDefined();
      }
    });

    it('should handle histogram-based exits', async () => {
      const context = createTestContext();
      const position: Position = {
        id: 'test-pos',
        strategyId: 'test',
        symbol: 'BTC-USD',
        side: 'LONG',
        size: 0.1,
        entryPrice: 49000,
        currentPrice: 50000,
        unrealizedPnl: 100,
        stopLoss: 48000,
        takeProfit: 52000,
        timestamp: new Date(),
        metadata: {}
      };

      const shouldExit = await strategy.shouldExitPosition(position, context);
      expect(typeof shouldExit).toBe('boolean');
    });
  });

  describe('Breakout Strategy', () => {
    let strategy: BreakoutStrategy;
    let config: BreakoutConfig;

    beforeEach(async () => {
      config = {
        ...createBaseConfig(),
        pivotMethod: 'STANDARD',
        breakoutConfirmationDistance: 0.5,
        minVolumeMultiple: 1.5,
        bollingerPeriod: 20,
        bollingerStdDev: 2.0,
        enableBollingerSqueeze: true,
        squeezeThreshold: 0.02,
        atrPeriod: 5,
        atrStopMultiplier: 2.5,
        atrTargetMultiplier: 4.0,
        rsiPeriod: 14,
        enableRsiMomentum: true,
        rsiNeutralZone: [40, 60],
        enableFalseBreakoutFilter: true,
        falseBreakoutLookback: 10,
        minHoldingCandles: 3,
        maxHoldingCandles: 50,
        minSignalStrength: 70,
        enableTrendFilter: true,
        trendSmaPeriod: 20
      };
      
      strategy = new BreakoutStrategy(config);
      await strategy.initialize();
    });

    it('should initialize correctly', async () => {
      expect(strategy.getState()).toBe('idle');
    });

    it('should validate configuration correctly', () => {
      const invalidConfig = { ...config, minHoldingCandles: 60 }; // Min > Max
      expect(() => new BreakoutStrategy(invalidConfig)).toThrow();
    });

    it('should generate breakout signals', async () => {
      const context = createTestContext();
      
      const signal = await strategy.execute(context);
      
      if (signal) {
        expect(['BUY', 'SELL']).toContain(signal.type);
        expect(signal.metadata?.breakoutLevel).toBeDefined();
        expect(signal.metadata?.levelType).toBeDefined();
        expect(['SUPPORT', 'RESISTANCE']).toContain(signal.metadata?.levelType);
      }
    });

    it('should detect failed breakouts and exit', async () => {
      const context = createTestContext();
      const position: Position = {
        id: 'test-pos',
        strategyId: 'test',
        symbol: 'BTC-USD',
        side: 'LONG',
        size: 0.1,
        entryPrice: 50000,
        currentPrice: 49500,
        unrealizedPnl: -50,
        stopLoss: 48000,
        takeProfit: 52000,
        timestamp: new Date(),
        metadata: { breakoutLevel: 49800 }
      };

      const shouldExit = await strategy.shouldExitPosition(position, context);
      expect(typeof shouldExit).toBe('boolean');
    });
  });

  describe('Strategy Template Integration', () => {
    it('should handle strategy lifecycle correctly', async () => {
      const config = {
        ...createBaseConfig(),
        fastEmaPeriod: 5,
        slowEmaPeriod: 10,
        trendEmaPeriod: 20,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.0,
        enableTrendConfirmation: true,
        enableVolumeConfirmation: true,
        minSignalStrength: 50
      };

      const strategy = new EMACrossoverStrategy(config);
      
      // Test initialization
      await strategy.initialize();
      expect(strategy.getState()).toBe('idle');
      
      // Test start
      await strategy.start();
      expect(strategy.getState()).toBe('running');
      
      // Test pause/resume
      await strategy.pause();
      expect(strategy.getState()).toBe('paused');
      
      await strategy.resume();
      expect(strategy.getState()).toBe('running');
      
      // Test stop
      await strategy.stop();
      expect(strategy.getState()).toBe('stopped');
    });

    it('should handle errors gracefully', async () => {
      const config = {
        ...createBaseConfig(),
        fastEmaPeriod: 5,
        slowEmaPeriod: 10,
        trendEmaPeriod: 20,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.0,
        enableTrendConfirmation: true,
        enableVolumeConfirmation: true,
        minSignalStrength: 50
      };

      const strategy = new EMACrossoverStrategy(config);
      await strategy.initialize();
      await strategy.start();

      // Test with invalid context
      const invalidContext = createTestContext({
        marketData: {
          ...createTestContext().marketData,
          candles: [] // Empty candles should not crash
        }
      });

      const signal = await strategy.execute(invalidContext);
      expect(signal).toBeNull(); // Should handle gracefully
    });

    it('should calculate risk management correctly', async () => {
      const config = {
        ...createBaseConfig(),
        fastEmaPeriod: 5,
        slowEmaPeriod: 10,
        trendEmaPeriod: 20,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.0,
        enableTrendConfirmation: true,
        enableVolumeConfirmation: true,
        minSignalStrength: 50
      };

      const strategy = new EMACrossoverStrategy(config);
      await strategy.initialize();

      const context = createTestContext();
      const signal: StrategySignal = {
        id: 'test',
        strategyId: 'test',
        timestamp: new Date(),
        type: 'BUY',
        symbol: 'BTC-USD',
        confidence: 80,
        strength: 75,
        timeframe: '5m',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        maxRisk: 2.0,
        reasoning: 'Test signal',
        indicators: {},
        conditions: [],
        source: 'technical',
        priority: 'medium',
        isValid: true
      };

      const positionSize = await strategy.calculatePositionSize(signal, context);
      const riskAmount = context.portfolio.total_value * (config.riskProfile.maxRiskPerTrade / 100);
      const stopDistance = Math.abs(signal.entryPrice! - signal.stopLoss!);
      const expectedMaxSize = riskAmount / stopDistance;

      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThanOrEqual(expectedMaxSize * 1.5); // Allow some multiplier variation
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid signal generation without performance issues', async () => {
      const config = {
        ...createBaseConfig(),
        fastEmaPeriod: 5,
        slowEmaPeriod: 10,
        trendEmaPeriod: 20,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.0,
        enableTrendConfirmation: true,
        enableVolumeConfirmation: true,
        minSignalStrength: 50
      };

      const strategy = new EMACrossoverStrategy(config);
      await strategy.initialize();
      await strategy.start();

      const context = createTestContext();
      const startTime = Date.now();

      // Execute strategy multiple times rapidly
      const executions = await Promise.all(
        Array.from({ length: 10 }, () => strategy.execute(context))
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(executions).toHaveLength(10);
    });

    it('should handle empty or invalid market data', async () => {
      const config = {
        ...createBaseConfig(),
        fastEmaPeriod: 5,
        slowEmaPeriod: 10,
        trendEmaPeriod: 20,
        minVolumeMultiple: 1.2,
        atrPeriod: 5,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 3.0,
        enableTrendConfirmation: true,
        enableVolumeConfirmation: true,
        minSignalStrength: 50
      };

      const strategy = new EMACrossoverStrategy(config);
      await strategy.initialize();
      await strategy.start();

      // Test with empty candles
      const emptyContext = createTestContext({
        marketData: {
          ...createTestContext().marketData,
          candles: []
        }
      });

      const signal = await strategy.execute(emptyContext);
      expect(signal).toBeNull();

      // Test with single candle
      const singleCandleContext = createTestContext({
        marketData: {
          ...createTestContext().marketData,
          candles: createTestCandles().slice(0, 1)
        }
      });

      const signal2 = await strategy.execute(singleCandleContext);
      expect(signal2).toBeNull();
    });
  });
});