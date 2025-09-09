/**
 * Core Technical Indicators Tests - Task BE-010
 * 
 * Comprehensive tests for the core technical indicators library
 * including accuracy validation, performance benchmarks, and integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SimpleMovingAverage,
  ExponentialMovingAverage,
  RSI,
  MACD,
  BollingerBands,
  ATR,
  IndicatorFactory,
  IndicatorUtils,
  CommonConfigs
} from '../index.js';
import { IndicatorDataFrameBridge, IndicatorBridgePresets } from '../IndicatorDataFrameBridge.js';
import { MarketDataFrame, IndicatorDataFrame } from '../../strategies/DataStructures.js';
import type { OHLCV } from '../base/types.js';

// Test data - realistic market data for validation
const generateTestData = (length: number = 50): OHLCV[] => {
  const data: OHLCV[] = [];
  let currentPrice = 100;
  let currentTime = new Date('2024-01-01T00:00:00Z');

  for (let i = 0; i < length; i++) {
    const volatility = 0.02; // 2% daily volatility
    const change = (Math.random() - 0.5) * volatility;
    currentPrice = currentPrice * (1 + change);

    const open = currentPrice;
    const high = open * (1 + Math.random() * 0.02);
    const low = open * (1 - Math.random() * 0.02);
    const close = low + Math.random() * (high - low);
    const volume = 1000 + Math.random() * 5000;

    data.push({
      time: new Date(currentTime),
      open,
      high,
      low,
      close,
      volume
    });

    currentTime = new Date(currentTime.getTime() + 60000); // 1 minute intervals
  }

  return data;
};

// Known test values for validation
const knownTestCase = (): OHLCV[] => [
  { time: new Date('2024-01-01'), open: 100, high: 105, low: 95, close: 102, volume: 1000 },
  { time: new Date('2024-01-02'), open: 102, high: 108, low: 100, close: 105, volume: 1200 },
  { time: new Date('2024-01-03'), open: 105, high: 110, low: 103, close: 107, volume: 1100 },
  { time: new Date('2024-01-04'), open: 107, high: 112, low: 105, close: 110, volume: 1300 },
  { time: new Date('2024-01-05'), open: 110, high: 115, low: 108, close: 112, volume: 1400 },
  { time: new Date('2024-01-06'), open: 112, high: 117, low: 110, close: 115, volume: 1500 },
  { time: new Date('2024-01-07'), open: 115, high: 118, low: 112, close: 114, volume: 1200 },
  { time: new Date('2024-01-08'), open: 114, high: 116, low: 111, close: 113, volume: 1000 },
  { time: new Date('2024-01-09'), open: 113, high: 115, low: 110, close: 112, volume: 900 },
  { time: new Date('2024-01-10'), open: 112, high: 114, low: 109, close: 111, volume: 1100 }
];

describe('Core Technical Indicators - Task BE-010', () => {
  let testData: OHLCV[];
  let knownData: OHLCV[];

  beforeEach(() => {
    testData = generateTestData(100);
    knownData = knownTestCase();
  });

  describe('Simple Moving Average (SMA)', () => {
    it('should calculate SMA correctly with known values', () => {
      const sma = new SimpleMovingAverage({ period: 5 });
      
      // Process known data
      knownData.forEach(candle => sma.update(candle));
      
      const result = sma.getLatestResult();
      expect(result).toBeTruthy();
      expect(result!.isValid).toBe(true);
      
      // Expected SMA for last 5 closes: (112, 115, 114, 113, 112, 111) / 5 = 112.2
      const expectedSMA = (115 + 114 + 113 + 112 + 111) / 5; // = 113
      expect(Math.abs((result!.value as number) - expectedSMA)).toBeLessThan(0.01);
    });

    it('should handle streaming updates efficiently', () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      const startTime = performance.now();
      
      testData.forEach(candle => sma.update(candle));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(100); // Should complete within 100ms
      expect(sma.getLatestResult()?.isValid).toBe(true);
    });

    it('should validate parameters correctly', () => {
      expect(() => new SimpleMovingAverage({ period: 0 })).toThrow();
      expect(() => new SimpleMovingAverage({ period: -1 })).toThrow();
      expect(() => new SimpleMovingAverage({ period: 1 })).not.toThrow();
    });

    it('should support different price types', () => {
      const smaClose = new SimpleMovingAverage({ period: 5, priceType: 'close' });
      const smaHigh = new SimpleMovingAverage({ period: 5, priceType: 'high' });
      
      knownData.forEach(candle => {
        smaClose.update(candle);
        smaHigh.update(candle);
      });
      
      const closeResult = smaClose.getLatestResult()?.value as number;
      const highResult = smaHigh.getLatestResult()?.value as number;
      
      expect(highResult).toBeGreaterThan(closeResult);
    });
  });

  describe('Exponential Moving Average (EMA)', () => {
    it('should calculate EMA correctly', () => {
      const ema = new ExponentialMovingAverage({ period: 12 });
      
      knownData.forEach(candle => ema.update(candle));
      
      const result = ema.getLatestResult();
      expect(result).toBeTruthy();
      expect(result!.isValid).toBe(true);
      expect(typeof result!.value).toBe('number');
    });

    it('should respond more quickly to price changes than SMA', () => {
      const ema = new ExponentialMovingAverage({ period: 10 });
      const sma = new SimpleMovingAverage({ period: 10 });
      
      // Add base data
      testData.slice(0, 20).forEach(candle => {
        ema.update(candle);
        sma.update(candle);
      });
      
      // Add a significant price spike
      const spike = {
        ...testData[20],
        close: testData[20].close * 1.2 // 20% spike
      };
      
      ema.update(spike);
      sma.update(spike);
      
      const emaValue = ema.getLatestResult()?.value as number;
      const smaValue = sma.getLatestResult()?.value as number;
      
      // EMA should react more strongly to the spike
      expect(Math.abs(emaValue - spike.close)).toBeLessThan(Math.abs(smaValue - spike.close));
    });

    it('should support custom smoothing factors', () => {
      const emaStandard = new ExponentialMovingAverage({ period: 12 });
      const emaCustom = new ExponentialMovingAverage({ period: 12, customSmoothing: 0.5 });
      
      knownData.forEach(candle => {
        emaStandard.update(candle);
        emaCustom.update(candle);
      });
      
      const standardValue = emaStandard.getLatestResult()?.value as number;
      const customValue = emaCustom.getLatestResult()?.value as number;
      
      expect(standardValue).not.toBe(customValue);
    });
  });

  describe('RSI (Relative Strength Index)', () => {
    it('should calculate RSI within valid range (0-100)', () => {
      const rsi = new RSI({ period: 14 });
      
      testData.forEach(candle => rsi.update(candle));
      
      const result = rsi.getLatestResult();
      expect(result).toBeTruthy();
      expect(result!.isValid).toBe(true);
      
      const rsiValue = result!.value as number;
      expect(rsiValue).toBeGreaterThanOrEqual(0);
      expect(rsiValue).toBeLessThanOrEqual(100);
    });

    it('should identify overbought and oversold conditions', () => {
      const rsi = new RSI({ period: 14, overboughtLevel: 70, oversoldLevel: 30 });
      
      // Create strongly trending data
      const trendingData: OHLCV[] = [];
      let price = 100;
      
      for (let i = 0; i < 30; i++) {
        price *= 1.02; // Consistent 2% gains
        trendingData.push({
          time: new Date(Date.now() + i * 60000),
          open: price * 0.99,
          high: price * 1.01,
          low: price * 0.98,
          close: price,
          volume: 1000
        });
      }
      
      trendingData.forEach(candle => rsi.update(candle));
      
      const result = rsi.getLatestResult()?.value as number;
      expect(result).toBeGreaterThan(70); // Should be overbought
    });

    it('should handle insufficient data gracefully', () => {
      const rsi = new RSI({ period: 14 });
      
      // Only provide 5 candles when 14 are needed
      knownData.slice(0, 5).forEach(candle => rsi.update(candle));
      
      const result = rsi.getLatestResult();
      // Should either be null or have isValid = false
      expect(!result || !result.isValid).toBe(true);
    });
  });

  describe('MACD (Moving Average Convergence Divergence)', () => {
    it('should calculate MACD components correctly', () => {
      const macd = new MACD({ 
        fastPeriod: 12, 
        slowPeriod: 26, 
        signalPeriod: 9 
      });
      
      testData.forEach(candle => macd.update(candle));
      
      const result = macd.getLatestResult();
      expect(result).toBeTruthy();
      expect(result!.isValid).toBe(true);
      
      const value = result!.value as { macd: number; signal: number; histogram: number; };
      expect(typeof value.macd).toBe('number');
      expect(typeof value.signal).toBe('number');
      expect(typeof value.histogram).toBe('number');
      
      // Histogram should be MACD - Signal
      expect(Math.abs(value.histogram - (value.macd - value.signal))).toBeLessThan(0.0001);
    });

    it('should generate buy/sell signals at crossovers', () => {
      const macd = new MACD({ 
        fastPeriod: 5, 
        slowPeriod: 10, 
        signalPeriod: 3 
      });
      
      const results: any[] = [];
      testData.forEach(candle => {
        macd.update(candle);
        const result = macd.getLatestResult();
        if (result?.isValid) {
          results.push(result.value);
        }
      });
      
      // Check for crossovers (changes in histogram sign)
      let crossovers = 0;
      for (let i = 1; i < results.length; i++) {
        const prevHist = results[i - 1].histogram;
        const currHist = results[i].histogram;
        if ((prevHist < 0 && currHist > 0) || (prevHist > 0 && currHist < 0)) {
          crossovers++;
        }
      }
      
      expect(crossovers).toBeGreaterThan(0); // Should have some crossovers with varying data
    });
  });

  describe('Bollinger Bands', () => {
    it('should calculate upper, middle, and lower bands correctly', () => {
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2.0 });
      
      testData.forEach(candle => bb.update(candle));
      
      const result = bb.getLatestResult();
      expect(result).toBeTruthy();
      expect(result!.isValid).toBe(true);
      
      const bands = result!.value as { upper: number; middle: number; lower: number; };
      expect(bands.upper).toBeGreaterThan(bands.middle);
      expect(bands.middle).toBeGreaterThan(bands.lower);
      expect(bands.upper - bands.middle).toBeCloseTo(bands.middle - bands.lower, 2);
    });

    it('should expand during high volatility', () => {
      const bb = new BollingerBands({ period: 10, stdDevMultiplier: 2.0 });
      
      // Low volatility data
      const stableData = knownData.slice(0, 10);
      stableData.forEach(candle => bb.update(candle));
      const stableBands = bb.getLatestResult()?.value as any;
      const stableWidth = stableBands.upper - stableBands.lower;
      
      bb.reset();
      
      // High volatility data
      const volatileData: OHLCV[] = [];
      let price = 100;
      for (let i = 0; i < 10; i++) {
        const change = (Math.random() - 0.5) * 0.1; // 10% volatility
        price *= (1 + change);
        volatileData.push({
          time: new Date(Date.now() + i * 60000),
          open: price,
          high: price * 1.05,
          low: price * 0.95,
          close: price,
          volume: 1000
        });
      }
      
      volatileData.forEach(candle => bb.update(candle));
      const volatileBands = bb.getLatestResult()?.value as any;
      const volatileWidth = volatileBands.upper - volatileBands.lower;
      
      expect(volatileWidth).toBeGreaterThan(stableWidth * 1.5);
    });
  });

  describe('ATR (Average True Range)', () => {
    it('should calculate ATR correctly', () => {
      const atr = new ATR({ period: 14 });
      
      testData.forEach(candle => atr.update(candle));
      
      const result = atr.getLatestResult();
      expect(result).toBeTruthy();
      expect(result!.isValid).toBe(true);
      expect(result!.value as number).toBeGreaterThan(0);
    });

    it('should increase with higher volatility', () => {
      const atr = new ATR({ period: 5 });
      
      // Low volatility
      const stableData = knownData.map((candle, i) => ({
        ...candle,
        high: candle.close * 1.001,
        low: candle.close * 0.999
      }));
      
      stableData.forEach(candle => atr.update(candle));
      const stableATR = atr.getLatestResult()?.value as number;
      
      atr.reset();
      
      // High volatility
      const volatileData = knownData.map(candle => ({
        ...candle,
        high: candle.close * 1.05,
        low: candle.close * 0.95
      }));
      
      volatileData.forEach(candle => atr.update(candle));
      const volatileATR = atr.getLatestResult()?.value as number;
      
      expect(volatileATR).toBeGreaterThan(stableATR * 10);
    });

    it('should support EMA smoothing', () => {
      const atrSMA = new ATR({ period: 14, useEMA: false });
      const atrEMA = new ATR({ period: 14, useEMA: true });
      
      testData.forEach(candle => {
        atrSMA.update(candle);
        atrEMA.update(candle);
      });
      
      const smaValue = atrSMA.getLatestResult()?.value as number;
      const emaValue = atrEMA.getLatestResult()?.value as number;
      
      expect(smaValue).toBeGreaterThan(0);
      expect(emaValue).toBeGreaterThan(0);
      // Values should be different due to different smoothing methods
    });
  });

  describe('Indicator Factory and Utils', () => {
    it('should create indicators dynamically', () => {
      const sma = IndicatorFactory.create('SMA', { period: 20 });
      const ema = IndicatorFactory.create('EMA', { period: 12 });
      const rsi = IndicatorFactory.create('RSI', { period: 14 });
      
      expect(sma).toBeInstanceOf(SimpleMovingAverage);
      expect(ema).toBeInstanceOf(ExponentialMovingAverage);
      expect(rsi).toBeInstanceOf(RSI);
    });

    it('should handle invalid indicator names', () => {
      expect(() => IndicatorFactory.create('INVALID', {})).toThrow();
    });

    it('should create multiple indicators', () => {
      const configs = [
        { name: 'SMA', config: { period: 20 }, alias: 'sma20' },
        { name: 'EMA', config: { period: 12 }, alias: 'ema12' },
        { name: 'RSI', config: { period: 14 }, alias: 'rsi14' }
      ];
      
      const indicators = IndicatorUtils.createMultiple(configs);
      
      expect(Object.keys(indicators)).toHaveLength(3);
      expect(indicators.sma20).toBeInstanceOf(SimpleMovingAverage);
      expect(indicators.ema12).toBeInstanceOf(ExponentialMovingAverage);
      expect(indicators.rsi14).toBeInstanceOf(RSI);
    });
  });

  describe('IndicatorDataFrame Integration', () => {
    it('should integrate with IndicatorDataFrame via bridge', () => {
      const bridge = new IndicatorDataFrameBridge({
        indicators: [
          { name: 'SMA', alias: 'sma_20', config: { period: 20 } },
          { name: 'EMA', alias: 'ema_12', config: { period: 12 } },
          { name: 'RSI', alias: 'rsi_14', config: { period: 14 } }
        ],
        autoUpdate: true
      });
      
      // Convert test data to MarketDataFrame format
      const marketData = testData.map(candle => ({
        timestamp: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
      
      // Process data through bridge
      marketData.forEach(candle => bridge.processCandle(candle));
      
      // Verify indicators are updated
      expect(bridge.getIndicatorValue('sma_20')).toBeTruthy();
      expect(bridge.getIndicatorValue('ema_12')).toBeTruthy();
      expect(bridge.getIndicatorValue('rsi_14')).toBeTruthy();
      
      // Verify IndicatorDataFrame integration
      const dataFrame = bridge.getIndicatorDataFrame();
      expect(dataFrame.getIndicatorNames()).toContain('sma_20');
      expect(dataFrame.getIndicatorNames()).toContain('ema_12');
      expect(dataFrame.getIndicatorNames()).toContain('rsi_14');
    });

    it('should use preset configurations', () => {
      const trendFollowingBridge = IndicatorBridgePresets.createTrendFollowing();
      const meanReversionBridge = IndicatorBridgePresets.createMeanReversion();
      
      expect(trendFollowingBridge.getIndicatorAliases()).toContain('ema_fast');
      expect(trendFollowingBridge.getIndicatorAliases()).toContain('ema_slow');
      expect(trendFollowingBridge.getIndicatorAliases()).toContain('macd');
      
      expect(meanReversionBridge.getIndicatorAliases()).toContain('bollinger');
      expect(meanReversionBridge.getIndicatorAliases()).toContain('rsi');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process large datasets efficiently', () => {
      const largeDataset = generateTestData(10000);
      const sma = new SimpleMovingAverage({ period: 50 });
      
      const startTime = performance.now();
      largeDataset.forEach(candle => sma.update(candle));
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const timePerCandle = totalTime / largeDataset.length;
      
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(timePerCandle).toBeLessThan(0.1); // Less than 0.1ms per candle
    });

    it('should handle streaming updates efficiently', () => {
      const bridge = IndicatorBridgePresets.createComprehensive();
      const dataset = generateTestData(1000);
      
      const startTime = performance.now();
      dataset.forEach(candle => {
        bridge.processCandle({
          timestamp: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        });
      });
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds for comprehensive setup
    });
  });

  describe('Memory Management', () => {
    it('should manage memory efficiently with circular buffers', () => {
      const bridge = new IndicatorDataFrameBridge({
        indicators: [
          { name: 'SMA', alias: 'sma', config: { period: 20 } }
        ],
        maxHistorySize: 100,
        autoUpdate: true
      });
      
      // Process more data than max history size
      const largeDataset = generateTestData(500);
      largeDataset.forEach(candle => {
        bridge.processCandle({
          timestamp: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        });
      });
      
      // Verify memory limit is respected
      const values = bridge.getIndicatorValues('sma');
      expect(values).toBeTruthy();
      expect(values!.length).toBeLessThanOrEqual(100);
    });
  });
});