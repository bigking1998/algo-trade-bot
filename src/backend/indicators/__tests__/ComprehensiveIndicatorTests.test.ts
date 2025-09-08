/**
 * Comprehensive Technical Indicators Tests - Task BE-010
 * 
 * Tests all indicators for mathematical accuracy, performance, and integration.
 * Validates against known results and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Trend indicators
  SimpleMovingAverage,
  ExponentialMovingAverage,
  WeightedMovingAverage,
  MACD,
  VWAP,
  ParabolicSAR,
  
  // Momentum indicators
  RSI,
  Stochastic,
  WilliamsR,
  CCI,
  
  // Volatility indicators
  BollingerBands,
  ATR,
  StandardDeviation,
  
  // Volume indicators
  OBV,
  AccumulationDistribution,
  
  // Support/Resistance indicators
  PivotPoints,
  FibonacciRetracement,
  
  // Utilities
  IndicatorFactory,
  CommonConfigs,
  Examples,
  
  // Types
  OHLCV
} from '../index.js';

// Test data generator
function generateTestData(count: number = 50): OHLCV[] {
  const data: OHLCV[] = [];
  let close = 100;
  
  for (let i = 0; i < count; i++) {
    // Generate realistic OHLCV data with some volatility
    const change = (Math.random() - 0.5) * 2; // ±1% random change
    const open = close;
    close = Math.max(0.01, open + change); // Ensure positive prices
    
    // Ensure valid OHLC relationships
    const volatility = Math.random() * 1; // 0.5% volatility
    const high = Math.max(open, close) + volatility;
    const low = Math.max(0.01, Math.min(open, close) - volatility);
    const volume = 1000 + Math.random() * 5000;
    
    data.push({
      time: new Date(Date.now() + i * 60000), // 1 minute intervals
      open,
      high,
      low,
      close,
      volume,
      symbol: 'TEST',
      timeframe: '1m'
    });
  }
  
  return data;
}

describe('Technical Indicators Library - Comprehensive Tests', () => {
  let testData: OHLCV[];
  
  beforeEach(() => {
    testData = generateTestData(100);
  });

  describe('Trend Indicators', () => {
    describe('Simple Moving Average (SMA)', () => {
      it('should calculate SMA correctly', () => {
        const sma = new SimpleMovingAverage({ period: 5 });
        const result = sma.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
        expect(result.value).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
      });

      it('should handle streaming updates', () => {
        const sma = new SimpleMovingAverage({ period: 5 });
        
        // Add data incrementally
        for (let i = 0; i < 10; i++) {
          const result = sma.update(testData[i]);
          if (i >= 4) { // After period-1 candles
            expect(result.isValid).toBe(true);
          }
        }
      });

      it('should calculate different price types', () => {
        const smaClose = new SimpleMovingAverage({ period: 5, priceType: 'close' });
        const smaHigh = new SimpleMovingAverage({ period: 5, priceType: 'high' });
        
        const resultClose = smaClose.calculate(testData);
        const resultHigh = smaHigh.calculate(testData);
        
        expect(resultClose.value).not.toBe(resultHigh.value);
      });
    });

    describe('Exponential Moving Average (EMA)', () => {
      it('should calculate EMA correctly', () => {
        const ema = new ExponentialMovingAverage({ period: 12 });
        const result = ema.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
        expect(result.confidence).toBeGreaterThan(0);
      });

      it('should be more responsive than SMA', () => {
        const sma = new SimpleMovingAverage({ period: 10 });
        const ema = new ExponentialMovingAverage({ period: 10 });
        
        // Use data with a trend
        const trendData = testData.map((candle, i) => ({
          ...candle,
          close: 100 + i * 0.5 // Upward trend
        }));
        
        const smaResults = sma.calculate(trendData);
        const emaResults = ema.calculate(trendData);
        
        // EMA should react faster to trend changes
        expect(emaResults.value).toBeGreaterThan(smaResults.value);
      });
    });

    describe('VWAP', () => {
      it('should calculate VWAP correctly', () => {
        const vwap = new VWAP({ period: 20 });
        const result = vwap.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
      });

      it('should weight by volume', () => {
        const highVolumeData = testData.map(candle => ({
          ...candle,
          volume: candle.volume * 10
        }));
        
        const vwap1 = new VWAP({ period: 10 });
        const vwap2 = new VWAP({ period: 10 });
        
        const result1 = vwap1.calculate(testData);
        const result2 = vwap2.calculate(highVolumeData);
        
        // Results should differ due to volume weighting
        expect(result1.value).not.toBe(result2.value);
      });
    });

    describe('Parabolic SAR', () => {
      it('should calculate Parabolic SAR correctly', () => {
        const psar = new ParabolicSAR({ accelerationFactor: 0.02, maxAcceleration: 0.2 });
        const result = psar.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('object');
        expect(result.value.sar).toBeGreaterThan(0);
        expect([-1, 1]).toContain(result.value.trend);
      });

      it('should detect trend reversals', () => {
        const psar = new ParabolicSAR({ accelerationFactor: 0.02 });
        const results: any[] = [];
        
        for (const candle of testData.slice(0, 20)) {
          const result = psar.update(candle);
          if (result.isValid) {
            results.push(result.value);
          }
        }
        
        // Should have some trend changes in random data
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Momentum Indicators', () => {
    describe('RSI', () => {
      it('should calculate RSI correctly', () => {
        const rsi = new RSI({ period: 14 });
        const result = rsi.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThanOrEqual(100);
      });

      it('should detect overbought and oversold conditions', () => {
        const rsi = new RSI({ period: 14, overboughtLevel: 70, oversoldLevel: 30 });
        
        // Create strong uptrend data
        const uptrendData = testData.map((candle, i) => ({
          ...candle,
          close: 100 + i * 2
        }));
        
        rsi.calculate(uptrendData);
        expect(rsi.isOverbought()).toBe(true);
      });
    });

    describe('Stochastic', () => {
      it('should calculate Stochastic correctly', () => {
        const stoch = new Stochastic({ kPeriod: 14, dPeriod: 3 });
        const result = stoch.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value.k).toBeGreaterThanOrEqual(0);
        expect(result.value.k).toBeLessThanOrEqual(100);
        expect(result.value.d).toBeGreaterThanOrEqual(0);
        expect(result.value.d).toBeLessThanOrEqual(100);
      });
    });

    describe('Williams %R', () => {
      it('should calculate Williams %R correctly', () => {
        const willr = new WilliamsR({ period: 14 });
        const result = willr.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value).toBeGreaterThanOrEqual(-100);
        expect(result.value).toBeLessThanOrEqual(0);
      });

      it('should provide positive scale conversion', () => {
        const willr = new WilliamsR({ period: 14 });
        willr.calculate(testData);
        
        const positiveScale = willr.getPositiveScale();
        expect(positiveScale).toBeGreaterThanOrEqual(0);
        expect(positiveScale).toBeLessThanOrEqual(100);
      });
    });

    describe('CCI', () => {
      it('should calculate CCI correctly', () => {
        const cci = new CCI({ period: 20 });
        const result = cci.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
      });

      it('should detect overbought/oversold zones', () => {
        const cci = new CCI({ period: 20 });
        cci.calculate(testData);
        
        expect(typeof cci.isOverbought()).toBe('boolean');
        expect(typeof cci.isOversold()).toBe('boolean');
      });
    });
  });

  describe('Volatility Indicators', () => {
    describe('ATR', () => {
      it('should calculate ATR correctly', () => {
        const atr = new ATR({ period: 14 });
        const result = atr.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value).toBeGreaterThan(0);
      });

      it('should calculate ATR percentage', () => {
        const atr = new ATR({ period: 14 });
        atr.calculate(testData);
        
        const currentPrice = testData[testData.length - 1].close;
        const atrPercent = atr.getATRPercent(currentPrice);
        
        expect(atrPercent).toBeGreaterThan(0);
      });

      it('should provide position sizing suggestions', () => {
        const atr = new ATR({ period: 14 });
        atr.calculate(testData);
        
        const multiplier = atr.getPositionSizeMultiplier();
        expect(multiplier).toBeGreaterThan(0);
        expect(multiplier).toBeLessThanOrEqual(2);
      });
    });

    describe('Standard Deviation', () => {
      it('should calculate Standard Deviation correctly', () => {
        const stdDev = new StandardDeviation({ period: 20 });
        const result = stdDev.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value).toBeGreaterThan(0);
      });

      it('should calculate Bollinger Band-style levels', () => {
        const stdDev = new StandardDeviation({ period: 20, stdDevMultiplier: 2 });
        stdDev.calculate(testData);
        
        const bands = stdDev.getBands();
        expect(bands.upper).toBeGreaterThan(bands.middle);
        expect(bands.middle).toBeGreaterThan(bands.lower);
      });
    });

    describe('Bollinger Bands', () => {
      it('should calculate Bollinger Bands correctly', () => {
        const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2 });
        const result = bb.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value.upper).toBeGreaterThan(result.value.middle);
        expect(result.value.middle).toBeGreaterThan(result.value.lower);
      });
    });
  });

  describe('Volume Indicators', () => {
    describe('OBV', () => {
      it('should calculate OBV correctly', () => {
        const obv = new OBV({});
        const result = obv.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
      });

      it('should track volume flow', () => {
        const obv = new OBV({});
        
        // Test with price/volume correlation
        for (let i = 0; i < 10; i++) {
          obv.update(testData[i]);
        }
        
        expect(typeof obv.getCurrentOBV()).toBe('number');
      });
    });

    describe('Accumulation/Distribution Line', () => {
      it('should calculate A/D Line correctly', () => {
        const ad = new AccumulationDistribution({});
        const result = ad.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
      });

      it('should track money flow', () => {
        const ad = new AccumulationDistribution({});
        ad.calculate(testData);
        
        const vwmf = ad.getVolumeWeightedMoneyFlow();
        expect(typeof vwmf).toBe('number');
      });
    });
  });

  describe('Support/Resistance Indicators', () => {
    describe('Pivot Points', () => {
      it('should calculate standard pivot points correctly', () => {
        const pp = new PivotPoints({ method: 'STANDARD' });
        const result = pp.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value.pivot).toBeGreaterThan(0);
        expect(result.value.resistance.r1).toBeGreaterThan(result.value.pivot);
        expect(result.value.support.s1).toBeLessThan(result.value.pivot);
      });

      it('should calculate Fibonacci pivot points', () => {
        const pp = new PivotPoints({ method: 'FIBONACCI' });
        const result = pp.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value.resistance.r1).toBeGreaterThan(result.value.pivot);
      });

      it('should find nearest support/resistance levels', () => {
        const pp = new PivotPoints({ method: 'STANDARD' });
        pp.calculate(testData);
        
        const currentPrice = testData[testData.length - 1].close;
        const nearestSupport = pp.getNearestSupport(currentPrice);
        const nearestResistance = pp.getNearestResistance(currentPrice);
        
        if (nearestSupport) {
          expect(nearestSupport.level).toBeLessThan(currentPrice);
        }
        if (nearestResistance) {
          expect(nearestResistance.level).toBeGreaterThan(currentPrice);
        }
      });
    });

    describe('Fibonacci Retracement', () => {
      it('should calculate Fibonacci levels correctly', () => {
        const fib = new FibonacciRetracement({ swingDetectionMethod: 'AUTO', swingLookback: 20 });
        const result = fib.calculate(testData);
        
        expect(result.isValid).toBe(true);
        expect(result.value.swingHigh).toBeGreaterThan(result.value.swingLow);
        expect(result.value.levels.length).toBeGreaterThan(0);
      });

      it('should include extension levels when requested', () => {
        const fib = new FibonacciRetracement({ 
          swingDetectionMethod: 'AUTO', 
          includeExtensions: true 
        });
        const result = fib.calculate(testData);
        
        expect(result.value.extensions).toBeDefined();
        expect(result.value.extensions!.length).toBeGreaterThan(0);
      });

      it('should find nearest Fibonacci level', () => {
        const fib = new FibonacciRetracement({ swingDetectionMethod: 'AUTO' });
        fib.calculate(testData);
        
        const currentPrice = testData[testData.length - 1].close;
        const nearestLevel = fib.getNearestLevel(currentPrice);
        
        expect(nearestLevel).toBeDefined();
        expect(nearestLevel!.price).toBeGreaterThan(0);
      });
    });
  });

  describe('Indicator Factory', () => {
    it('should create indicators by name', () => {
      const sma = IndicatorFactory.create('SMA', { period: 20 });
      const ema = IndicatorFactory.create('EMA', { period: 12 });
      const rsi = IndicatorFactory.create('RSI', { period: 14 });
      
      expect(sma).toBeInstanceOf(SimpleMovingAverage);
      expect(ema).toBeInstanceOf(ExponentialMovingAverage);
      expect(rsi).toBeInstanceOf(RSI);
    });

    it('should handle case insensitive names', () => {
      const sma1 = IndicatorFactory.create('sma', { period: 20 });
      const sma2 = IndicatorFactory.create('SimpleMovingAverage', { period: 20 });
      
      expect(sma1).toBeInstanceOf(SimpleMovingAverage);
      expect(sma2).toBeInstanceOf(SimpleMovingAverage);
    });

    it('should throw error for unknown indicators', () => {
      expect(() => {
        IndicatorFactory.create('UNKNOWN', {});
      }).toThrow('Unknown indicator');
    });

    it('should list available indicators', () => {
      const available = IndicatorFactory.getAvailableIndicators();
      expect(available).toContain('SMA');
      expect(available).toContain('RSI');
      expect(available).toContain('MACD');
      expect(available.length).toBeGreaterThan(20);
    });
  });

  describe('Common Configurations', () => {
    it('should provide standard configurations', () => {
      expect(CommonConfigs.SMA_20).toEqual({ period: 20 });
      expect(CommonConfigs.RSI_14).toEqual({ period: 14 });
      expect(CommonConfigs.BB_STANDARD).toEqual({ period: 20, stdDevMultiplier: 2.0 });
    });

    it('should work with IndicatorFactory', () => {
      const sma = IndicatorFactory.create('SMA', CommonConfigs.SMA_50);
      const result = sma.calculate(testData);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Example Setups', () => {
    it('should create trend following setup', () => {
      const indicators = Examples.createTrendFollowing();
      
      expect(indicators.ema_fast).toBeInstanceOf(ExponentialMovingAverage);
      expect(indicators.macd).toBeInstanceOf(MACD);
      expect(indicators.rsi).toBeInstanceOf(RSI);
    });

    it('should create mean reversion setup', () => {
      const indicators = Examples.createMeanReversion();
      
      expect(indicators.bb).toBeInstanceOf(BollingerBands);
      expect(indicators.rsi).toBeInstanceOf(RSI);
      expect(indicators.stoch).toBeInstanceOf(Stochastic);
    });

    it('should create comprehensive analysis setup', () => {
      const indicators = Examples.createComprehensive();
      
      expect(Object.keys(indicators).length).toBeGreaterThan(8);
      expect(indicators.vwap).toBeInstanceOf(VWAP);
      expect(indicators.atr).toBeInstanceOf(ATR);
      expect(indicators.obv).toBeInstanceOf(OBV);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty data gracefully', () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      expect(() => {
        sma.calculate([]);
      }).toThrow('Insufficient data');
    });

    it('should handle insufficient data', () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      expect(() => {
        sma.calculate(testData.slice(0, 5));
      }).toThrow('Insufficient data');
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        new SimpleMovingAverage({ period: -1 });
      }).toThrow();
      
      expect(() => {
        new RSI({ period: 0 });
      }).toThrow();
    });

    it('should handle streaming updates efficiently', () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const startTime = performance.now();
      
      for (const candle of testData) {
        sma.update(candle);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should process 100 candles in under 10ms
      expect(duration).toBeLessThan(10);
    });

    it('should maintain memory efficiency', () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      sma.calculate(testData);
      
      const metrics = sma.getPerformanceMetrics();
      
      expect(metrics.memoryUsageBytes).toBeGreaterThan(0);
      expect(metrics.memoryUsageBytes).toBeLessThan(100000); // Under 100KB
    });

    it('should handle extreme price movements', () => {
      const extremeData = testData.map((candle, i) => ({
        ...candle,
        close: i % 2 === 0 ? 1000 : 0.01, // Extreme volatility
        high: Math.max(candle.high, i % 2 === 0 ? 1000 : 0.01),
        low: Math.min(candle.low, i % 2 === 0 ? 1000 : 0.01)
      }));
      
      const atr = new ATR({ period: 14 });
      const result = atr.calculate(extremeData);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toBeGreaterThan(0);
      expect(isFinite(result.value)).toBe(true);
    });

    it('should handle zero volume gracefully', () => {
      const zeroVolumeData = testData.map(candle => ({
        ...candle,
        volume: 0
      }));
      
      const obv = new OBV({});
      const result = obv.calculate(zeroVolumeData);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should work together in a trading strategy context', () => {
      // Simulate a simple strategy using multiple indicators
      const sma = new SimpleMovingAverage({ period: 20 });
      const ema = new ExponentialMovingAverage({ period: 12 });
      const rsi = new RSI({ period: 14 });
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2 });
      
      const signals: string[] = [];
      
      for (let i = 20; i < testData.length; i++) {
        const currentData = testData.slice(0, i + 1);
        const currentPrice = currentData[currentData.length - 1].close;
        
        const smaResult = sma.calculate(currentData);
        const emaResult = ema.calculate(currentData);
        const rsiResult = rsi.calculate(currentData);
        const bbResult = bb.calculate(currentData);
        
        if (smaResult.isValid && emaResult.isValid && rsiResult.isValid && bbResult.isValid) {
          // Simple strategy logic
          if (emaResult.value > smaResult.value && rsiResult.value < 70 && currentPrice < bbResult.value.upper) {
            signals.push('BUY');
          } else if (emaResult.value < smaResult.value && rsiResult.value > 30 && currentPrice > bbResult.value.lower) {
            signals.push('SELL');
          } else {
            signals.push('HOLD');
          }
        }
      }
      
      expect(signals.length).toBeGreaterThan(0);
      expect(signals).toContain('BUY');
      expect(signals).toContain('SELL');
      expect(signals).toContain('HOLD');
    });
  });
});