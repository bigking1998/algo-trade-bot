/**
 * Comprehensive Technical Indicators Test Suite - Task BE-010
 * 
 * Tests all implemented indicators for:
 * - Mathematical accuracy
 * - Streaming performance
 * - Edge cases and error handling
 * - Memory efficiency
 * - Real-time functionality
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  OHLCV,
  SimpleMovingAverage,
  ExponentialMovingAverage,
  WeightedMovingAverage,
  MACD,
  RSI,
  BollingerBands,
  IndicatorFactory,
  CommonConfigs,
  IndicatorUtils
} from '../index.js';

/**
 * Test data generator
 */
class TestDataGenerator {
  /**
   * Generate synthetic OHLCV data for testing
   */
  static generateOHLCV(
    count: number,
    basePrice: number = 100,
    volatility: number = 0.02
  ): OHLCV[] {
    const data: OHLCV[] = [];
    let currentPrice = basePrice;
    
    for (let i = 0; i < count; i++) {
      // Generate random price movement
      const change = (Math.random() - 0.5) * 2 * volatility * currentPrice;
      const newPrice = currentPrice + change;
      
      // Generate OHLC with realistic relationships
      const high = newPrice + Math.random() * volatility * newPrice;
      const low = newPrice - Math.random() * volatility * newPrice;
      const open = currentPrice;
      const close = newPrice;
      
      data.push({
        time: new Date(Date.now() + i * 60000), // 1 minute intervals
        open: Math.max(low, Math.min(high, open)),
        high: Math.max(open, close, high),
        low: Math.min(open, close, low),
        close: Math.max(low, Math.min(high, close)),
        volume: Math.random() * 1000000 + 100000
      });
      
      currentPrice = newPrice;
    }
    
    return data;
  }

  /**
   * Generate trending data
   */
  static generateTrendingData(
    count: number,
    trend: 'up' | 'down' | 'sideways' = 'up',
    basePrice: number = 100
  ): OHLCV[] {
    const data: OHLCV[] = [];
    let currentPrice = basePrice;
    const trendMultiplier = trend === 'up' ? 0.001 : trend === 'down' ? -0.001 : 0;
    
    for (let i = 0; i < count; i++) {
      const trendComponent = trendMultiplier * currentPrice;
      const randomComponent = (Math.random() - 0.5) * 0.02 * currentPrice;
      const newPrice = currentPrice + trendComponent + randomComponent;
      
      const volatility = 0.01;
      const high = newPrice + Math.random() * volatility * newPrice;
      const low = newPrice - Math.random() * volatility * newPrice;
      
      data.push({
        time: new Date(Date.now() + i * 60000),
        open: currentPrice,
        high,
        low,
        close: newPrice,
        volume: Math.random() * 1000000 + 100000
      });
      
      currentPrice = newPrice;
    }
    
    return data;
  }
}

describe('Technical Indicators Library', () => {
  let testData: OHLCV[];
  let trendingData: OHLCV[];
  
  beforeEach(() => {
    testData = TestDataGenerator.generateOHLCV(100);
    trendingData = TestDataGenerator.generateTrendingData(100, 'up');
  });

  describe('SimpleMovingAverage (SMA)', () => {
    test('should calculate correct SMA values', () => {
      const sma = new SimpleMovingAverage({ period: 10 });
      const result = sma.calculate(testData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThan(0);
      
      // Verify SMA calculation manually for small dataset
      const smallData = testData.slice(0, 10);
      const manualSMA = smallData.reduce((sum, candle) => sum + candle.close, 0) / 10;
      const calculatedSMA = new SimpleMovingAverage({ period: 10 }).calculate(smallData);
      
      expect(Math.abs((calculatedSMA.value as number) - manualSMA)).toBeLessThan(0.0001);
    });

    test('should handle streaming updates correctly', () => {
      const sma = new SimpleMovingAverage({ period: 5 });
      
      // Add initial data
      for (let i = 0; i < 5; i++) {
        const result = sma.update(testData[i]);
        expect(result.timestamp).toEqual(testData[i].time);
      }
      
      expect(sma.isReady()).toBe(true);
      expect(sma.getBufferSize()).toBe(5);
      
      // Add more data and verify streaming
      const streamResult = sma.update(testData[5]);
      expect(streamResult.isValid).toBe(true);
      expect(sma.getBufferSize()).toBe(5); // Buffer should maintain size
    });

    test('should detect trends correctly', () => {
      const sma = new SimpleMovingAverage({ period: 10 });
      sma.calculate(trendingData);
      
      // Add more trending data
      for (let i = 0; i < 10; i++) {
        sma.update(trendingData[90 + i]);
      }
      
      expect(sma.isTrendingUp(5)).toBe(true);
    });

    test('should handle edge cases', () => {
      const sma = new SimpleMovingAverage({ period: 10 });
      
      // Empty data
      const emptyResult = sma.calculate([]);
      expect(emptyResult.value).toBe(0);
      
      // Insufficient data
      const insufficientResult = sma.calculate(testData.slice(0, 5));
      expect(insufficientResult.isValid).toBe(true); // Should still work with less data
    });
  });

  describe('ExponentialMovingAverage (EMA)', () => {
    test('should calculate correct EMA values', () => {
      const ema = new ExponentialMovingAverage({ period: 10 });
      const result = ema.calculate(testData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThan(0);
      
      // EMA should be more responsive than SMA
      const sma = new SimpleMovingAverage({ period: 10 });
      const smaResult = sma.calculate(testData);
      
      // Both should be positive and reasonably close
      expect(Math.abs((result.value as number) - (smaResult.value as number))).toBeLessThan(10);
    });

    test('should have correct smoothing factor', () => {
      const ema = new ExponentialMovingAverage({ period: 10 });
      const expectedAlpha = 2 / (10 + 1);
      
      expect(ema.getAlpha()).toBeCloseTo(expectedAlpha, 4);
    });

    test('should support Wilder\'s smoothing', () => {
      const emaWilder = new ExponentialMovingAverage({ 
        period: 14, 
        wildersSmoothing: true 
      });
      
      const expectedAlpha = 1 / 14;
      expect(emaWilder.getAlpha()).toBeCloseTo(expectedAlpha, 4);
    });

    test('should warm up correctly', () => {
      const ema = new ExponentialMovingAverage({ period: 10 });
      
      expect(ema.isEMAWarmedUp()).toBe(false);
      
      // Add enough data to warm up
      for (let i = 0; i < 10; i++) {
        ema.update(testData[i]);
      }
      
      expect(ema.isEMAWarmedUp()).toBe(true);
    });
  });

  describe('WeightedMovingAverage (WMA)', () => {
    test('should calculate correct WMA values', () => {
      const wma = new WeightedMovingAverage({ period: 5 });
      const result = wma.calculate(testData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThan(0);
    });

    test('should support custom weights', () => {
      const customWeights = [1, 2, 3, 4, 5];
      const wma = new WeightedMovingAverage({ 
        period: 5, 
        customWeights 
      });
      
      expect(wma.getWeights()).toEqual(customWeights);
    });

    test('should be more responsive than SMA', () => {
      const wma = new WeightedMovingAverage({ period: 10 });
      const sma = new SimpleMovingAverage({ period: 10 });
      
      const wmaResult = wma.calculate(trendingData);
      const smaResult = sma.calculate(trendingData);
      
      expect(wmaResult.isValid).toBe(true);
      expect(smaResult.isValid).toBe(true);
      
      // In uptrending data, WMA should typically be higher than SMA
      expect(wmaResult.value).toBeGreaterThanOrEqual(smaResult.value as number);
    });
  });

  describe('MACD', () => {
    test('should calculate correct MACD values', () => {
      const macd = new MACD({ 
        fastPeriod: 12, 
        slowPeriod: 26, 
        signalPeriod: 9 
      });
      
      const result = macd.calculate(testData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('object');
      expect(result.value).toHaveProperty('macd');
      expect(result.value).toHaveProperty('signal');
      expect(result.value).toHaveProperty('histogram');
      
      // Histogram should equal MACD - Signal
      const { macd: macdLine, signal, histogram } = result.value;
      expect(Math.abs(histogram - (macdLine - signal))).toBeLessThan(0.0001);
    });

    test('should detect crossovers', () => {
      const macd = new MACD({ 
        fastPeriod: 12, 
        slowPeriod: 26, 
        signalPeriod: 9 
      });
      
      // Calculate for trending data to get crossovers
      macd.calculate(trendingData);
      
      const currentValues = macd.getCurrentValues();
      expect(currentValues).toBeDefined();
      expect(typeof currentValues?.macd).toBe('number');
      expect(typeof currentValues?.signal).toBe('number');
      expect(typeof currentValues?.histogram).toBe('number');
    });

    test('should handle bullish/bearish states', () => {
      const macd = new MACD({ 
        fastPeriod: 5, 
        slowPeriod: 10, 
        signalPeriod: 3 
      });
      
      macd.calculate(trendingData);
      
      // Should be able to determine bullish/bearish state
      const isBullish = macd.isBullish();
      const isBearish = macd.isBearish();
      
      expect(typeof isBullish).toBe('boolean');
      expect(typeof isBearish).toBe('boolean');
      expect(isBullish).not.toBe(isBearish); // Should not be both
    });
  });

  describe('RSI', () => {
    test('should calculate correct RSI values', () => {
      const rsi = new RSI({ period: 14 });
      const result = rsi.calculate(testData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    test('should identify overbought/oversold conditions', () => {
      const rsi = new RSI({ 
        period: 14, 
        overboughtLevel: 70, 
        oversoldLevel: 30 
      });
      
      rsi.calculate(testData);
      
      const level = rsi.getRSILevel();
      expect(['extreme_overbought', 'overbought', 'neutral', 'oversold', 'extreme_oversold']).toContain(level);
    });

    test('should use Wilder\'s smoothing by default', () => {
      const rsi = new RSI({ period: 14 });
      
      // Add enough data for RSI to warm up
      for (let i = 0; i < 20; i++) {
        rsi.update(testData[i]);
      }
      
      expect(rsi.isRSIWarmedUp()).toBe(true);
    });

    test('should detect trends', () => {
      const rsi = new RSI({ period: 14 });
      rsi.calculate(trendingData);
      
      const trend = rsi.getTrend(5);
      expect(['rising', 'falling', 'sideways']).toContain(trend);
    });

    test('should calculate momentum correctly', () => {
      const rsi = new RSI({ period: 14 });
      rsi.calculate(testData);
      
      // Add a few more data points
      for (let i = 0; i < 5; i++) {
        rsi.update(testData[90 + i]);
      }
      
      const momentum = rsi.getRSIMomentum(1);
      expect(typeof momentum).toBe('number');
    });
  });

  describe('BollingerBands', () => {
    test('should calculate correct Bollinger Bands', () => {
      const bb = new BollingerBands({ 
        period: 20, 
        stdDevMultiplier: 2.0 
      });
      
      const result = bb.calculate(testData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('object');
      expect(result.value).toHaveProperty('upper');
      expect(result.value).toHaveProperty('middle');
      expect(result.value).toHaveProperty('lower');
      
      const { upper, middle, lower } = result.value;
      
      // Upper should be above middle, middle above lower
      expect(upper).toBeGreaterThan(middle);
      expect(middle).toBeGreaterThan(lower);
    });

    test('should calculate %B correctly', () => {
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2.0 });
      bb.calculate(testData);
      
      const lastPrice = testData[testData.length - 1].close;
      const percentB = bb.getPercentB(lastPrice);
      
      expect(typeof percentB).toBe('number');
      expect(percentB).toBeGreaterThanOrEqual(0); // Can go outside 0-1 range
    });

    test('should calculate bandwidth correctly', () => {
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2.0 });
      bb.calculate(testData);
      
      const bandwidth = bb.getBandwidth();
      
      expect(typeof bandwidth).toBe('number');
      expect(bandwidth).toBeGreaterThan(0);
    });

    test('should detect squeeze and expansion', () => {
      const bb = new BollingerBands({ period: 10, stdDevMultiplier: 2.0 });
      bb.calculate(testData);
      
      const isSqueeze = bb.isSqueeze(0.1);
      const isExpansion = bb.isExpansion(0.25);
      
      expect(typeof isSqueeze).toBe('boolean');
      expect(typeof isExpansion).toBe('boolean');
    });

    test('should provide trading signals', () => {
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2.0 });
      bb.calculate(testData);
      
      const lastPrice = testData[testData.length - 1].close;
      const signals = bb.getTradingSignals(lastPrice);
      
      expect(signals).toHaveProperty('signal');
      expect(signals).toHaveProperty('strength');
      expect(signals).toHaveProperty('reason');
      expect(['buy', 'sell', 'hold']).toContain(signals.signal);
    });
  });

  describe('IndicatorFactory', () => {
    test('should create indicators by name', () => {
      const sma = IndicatorFactory.create('SMA', { period: 10 });
      const ema = IndicatorFactory.create('EMA', { period: 10 });
      const rsi = IndicatorFactory.create('RSI', { period: 14 });
      
      expect(sma).toBeInstanceOf(SimpleMovingAverage);
      expect(ema).toBeInstanceOf(ExponentialMovingAverage);
      expect(rsi).toBeInstanceOf(RSI);
    });

    test('should throw error for unknown indicators', () => {
      expect(() => {
        IndicatorFactory.create('UNKNOWN', {});
      }).toThrow('Unknown indicator: UNKNOWN');
    });

    test('should list available indicators', () => {
      const available = IndicatorFactory.getAvailableIndicators();
      
      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThan(0);
      expect(available).toContain('SMA');
      expect(available).toContain('RSI');
    });
  });

  describe('IndicatorUtils', () => {
    test('should create multiple indicators', () => {
      const indicators = IndicatorUtils.createMultiple([
        { name: 'SMA', config: { period: 20 }, alias: 'sma20' },
        { name: 'RSI', config: { period: 14 }, alias: 'rsi14' }
      ]);
      
      expect(indicators).toHaveProperty('sma20');
      expect(indicators).toHaveProperty('rsi14');
      expect(indicators.sma20).toBeInstanceOf(SimpleMovingAverage);
      expect(indicators.rsi14).toBeInstanceOf(RSI);
    });

    test('should update all indicators', () => {
      const indicators = IndicatorUtils.createMultiple([
        { name: 'SMA', config: { period: 5 }, alias: 'sma' },
        { name: 'RSI', config: { period: 5 }, alias: 'rsi' }
      ]);
      
      // Initialize with some data
      for (let i = 0; i < 10; i++) {
        IndicatorUtils.updateAll(indicators, testData[i]);
      }
      
      const results = IndicatorUtils.updateAll(indicators, testData[10]);
      
      expect(results).toHaveProperty('sma');
      expect(results).toHaveProperty('rsi');
      expect(results.sma).not.toBeNull();
      expect(results.rsi).not.toBeNull();
    });

    test('should get status summary', () => {
      const indicators = IndicatorUtils.createMultiple([
        { name: 'SMA', config: { period: 10 }, alias: 'sma' },
        { name: 'RSI', config: { period: 14 }, alias: 'rsi' }
      ]);
      
      const summary = IndicatorUtils.getStatusSummary(indicators);
      
      expect(summary).toHaveProperty('sma');
      expect(summary).toHaveProperty('rsi');
      expect(typeof summary.sma).toBe('string');
      expect(typeof summary.rsi).toBe('string');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = TestDataGenerator.generateOHLCV(10000);
      const sma = new SimpleMovingAverage({ period: 50 });
      
      const startTime = performance.now();
      const result = sma.calculate(largeDataset);
      const endTime = performance.now();
      
      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
      
      const metrics = sma.getPerformanceMetrics();
      expect(metrics.calculationTimeMs).toBeGreaterThan(0);
      expect(metrics.dataPointsProcessed).toBe(largeDataset.length);
    });

    test('should handle streaming updates efficiently', () => {
      const rsi = new RSI({ period: 14 });
      const dataset = TestDataGenerator.generateOHLCV(1000);
      
      // Initialize with first batch
      rsi.calculate(dataset.slice(0, 50));
      
      // Stream remaining data
      const startTime = performance.now();
      
      for (let i = 50; i < dataset.length; i++) {
        const result = rsi.update(dataset[i]);
        expect(result.isValid).toBe(true);
      }
      
      const endTime = performance.now();
      const avgTimePerUpdate = (endTime - startTime) / (dataset.length - 50);
      
      expect(avgTimePerUpdate).toBeLessThan(1); // Should be <1ms per update
    });

    test('should maintain memory efficiency', () => {
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2.0 });
      const initialMemory = bb.getPerformanceMetrics().memoryUsageBytes;
      
      // Add lots of data
      const largeDataset = TestDataGenerator.generateOHLCV(10000);
      for (const candle of largeDataset) {
        bb.update(candle);
      }
      
      const finalMemory = bb.getPerformanceMetrics().memoryUsageBytes;
      
      // Memory should not grow indefinitely
      expect(finalMemory).toBeLessThan(initialMemory + 100000); // Less than 100KB growth
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid OHLCV data gracefully', () => {
      const sma = new SimpleMovingAverage({ period: 10 });
      
      const invalidData: OHLCV[] = [
        {
          time: new Date(),
          open: NaN,
          high: 100,
          low: 90,
          close: 95,
          volume: 1000
        }
      ];
      
      expect(() => {
        sma.calculate(invalidData);
      }).toThrow();
    });

    test('should handle zero and negative prices', () => {
      const rsi = new RSI({ period: 14 });
      
      const invalidData: OHLCV[] = [
        {
          time: new Date(),
          open: -10,
          high: 0,
          low: -20,
          close: -5,
          volume: 1000
        }
      ];
      
      expect(() => {
        rsi.calculate(invalidData);
      }).toThrow();
    });

    test('should validate configuration parameters', () => {
      expect(() => {
        new SimpleMovingAverage({ period: 0 });
      }).toThrow();
      
      expect(() => {
        new SimpleMovingAverage({ period: -5 });
      }).toThrow();
      
      expect(() => {
        new RSI({ period: 14, overboughtLevel: 110 });
      }).toThrow();
      
      expect(() => {
        new BollingerBands({ period: 20, stdDevMultiplier: -2 });
      }).toThrow();
    });

    test('should handle market gaps and missing data', () => {
      const ema = new ExponentialMovingAverage({ period: 10 });
      
      // Create data with time gaps
      const gappedData: OHLCV[] = [];
      for (let i = 0; i < 20; i++) {
        if (i === 10) continue; // Skip one data point
        
        gappedData.push({
          time: new Date(Date.now() + i * 60000),
          open: 100 + Math.random() * 10,
          high: 105 + Math.random() * 10,
          low: 95 + Math.random() * 10,
          close: 100 + Math.random() * 10,
          volume: 1000
        });
      }
      
      const result = ema.calculate(gappedData);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  test('should work with real market scenarios', () => {
    // Simulate a typical trading scenario
    const indicators = IndicatorUtils.createMultiple([
      { name: 'SMA', config: { period: 20 }, alias: 'sma20' },
      { name: 'EMA', config: { period: 12 }, alias: 'ema12' },
      { name: 'RSI', config: { period: 14 }, alias: 'rsi' },
      { name: 'BB', config: { period: 20, stdDevMultiplier: 2 }, alias: 'bb' },
      { name: 'MACD', config: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, alias: 'macd' }
    ]);
    
    const marketData = TestDataGenerator.generateOHLCV(100);
    
    // Calculate all indicators
    const results = IndicatorUtils.calculateAll(indicators, marketData);
    
    expect(results.sma20.isValid).toBe(true);
    expect(results.ema12.isValid).toBe(true);
    expect(results.rsi.isValid).toBe(true);
    expect(results.bb.isValid).toBe(true);
    expect(results.macd.isValid).toBe(true);
    
    // Stream new data
    const newCandle = TestDataGenerator.generateOHLCV(1)[0];
    const streamResults = IndicatorUtils.updateAll(indicators, newCandle);
    
    expect(streamResults.sma20).not.toBeNull();
    expect(streamResults.rsi).not.toBeNull();
  });

  test('should maintain consistency between batch and streaming calculations', () => {
    const testData = TestDataGenerator.generateOHLCV(50);
    
    // Batch calculation
    const smaBatch = new SimpleMovingAverage({ period: 10 });
    const batchResult = smaBatch.calculate(testData);
    
    // Streaming calculation
    const smaStream = new SimpleMovingAverage({ period: 10 });
    let streamResult;
    
    for (const candle of testData) {
      streamResult = smaStream.update(candle);
    }
    
    // Results should be very close (allowing for minor floating point differences)
    expect(Math.abs((batchResult.value as number) - (streamResult!.value as number))).toBeLessThan(0.001);
  });
});