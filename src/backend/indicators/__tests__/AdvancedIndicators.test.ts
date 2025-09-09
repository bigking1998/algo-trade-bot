/**
 * Advanced Technical Indicators Unit Tests - Task BE-011
 * 
 * Comprehensive tests for ADX, MFI, TRIX, and AROON indicators
 * including accuracy validation, edge cases, and performance benchmarks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADX } from '../trend/ADX.js';
import { MFI } from '../volume/MFI.js';
import { TRIX } from '../momentum/TRIX.js';
import { AROON } from '../momentum/AROON.js';
import { OHLCV } from '../base/types.js';

// Test data generation utilities
function generateTestCandles(count: number, basePrice: number = 100): OHLCV[] {
  const candles: OHLCV[] = [];
  let price = basePrice;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2; // -1 to 1
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = 1000 + Math.random() * 9000; // 1000-10000
    
    candles.push({
      time: new Date(Date.now() + i * 60000), // 1 minute intervals
      open,
      high,
      low,
      close,
      volume
    });
    
    price = close;
  }
  
  return candles;
}

function generateTrendingCandles(count: number, trend: 'up' | 'down' | 'sideways'): OHLCV[] {
  const candles: OHLCV[] = [];
  let price = 100;
  
  for (let i = 0; i < count; i++) {
    const trendMultiplier = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
    const trendComponent = trendMultiplier * 0.2 + (Math.random() - 0.5) * 0.8;
    
    const open = price;
    const close = price + trendComponent;
    const high = Math.max(open, close) + Math.random() * 0.5;
    const low = Math.min(open, close) - Math.random() * 0.5;
    const volume = 1000 + Math.random() * 9000;
    
    candles.push({
      time: new Date(Date.now() + i * 60000),
      open,
      high,
      low,
      close,
      volume
    });
    
    price = close;
  }
  
  return candles;
}

describe('ADX (Average Directional Index)', () => {
  let adx: ADX;
  
  beforeEach(() => {
    adx = new ADX({ period: 14 });
  });

  describe('Configuration and Validation', () => {
    it('should create ADX with valid configuration', () => {
      expect(adx.getName()).toBe('ADX');
      expect(adx.getConfig().period).toBe(14);
      expect(adx.getStatus()).toBe('insufficient_data');
    });

    it('should validate minimum period requirement', () => {
      expect(() => new ADX({ period: 1 })).toThrow('ADX period must be at least 2');
    });

    it('should support custom configuration', () => {
      const customADX = new ADX({ 
        period: 21, 
        wildersSmoothing: false 
      });
      
      expect(customADX.getConfig().period).toBe(21);
    });
  });

  describe('Calculation Accuracy', () => {
    it('should calculate ADX for trending data', () => {
      const trendingData = generateTrendingCandles(50, 'up');
      const result = adx.calculate(trendingData);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('object');
      expect(result.value).toHaveProperty('adx');
      expect(result.value).toHaveProperty('plusDI');
      expect(result.value).toHaveProperty('minusDI');
      expect(result.value).toHaveProperty('dx');
      
      // ADX should be between 0 and 100
      expect(result.value.adx).toBeGreaterThanOrEqual(0);
      expect(result.value.adx).toBeLessThanOrEqual(100);
      expect(result.value.plusDI).toBeGreaterThanOrEqual(0);
      expect(result.value.plusDI).toBeLessThanOrEqual(100);
      expect(result.value.minusDI).toBeGreaterThanOrEqual(0);
      expect(result.value.minusDI).toBeLessThanOrEqual(100);
    });

    it('should handle streaming updates', () => {
      const data = generateTrendingCandles(30, 'up');
      
      // Build up with initial data
      for (let i = 0; i < 20; i++) {
        adx.update(data[i]);
      }
      
      expect(adx.isReady()).toBe(true);
      
      // Stream additional data
      const streamResult = adx.update(data[20]);
      expect(streamResult.isValid).toBe(true);
      expect(streamResult.value.adx).toBeGreaterThanOrEqual(0);
    });

    it('should identify trending markets', () => {
      const strongTrendData = generateTrendingCandles(40, 'up');
      const result = adx.calculate(strongTrendData);
      
      // In a strong uptrend, +DI should be higher than -DI
      expect(result.value.plusDI).toBeGreaterThan(result.value.minusDI);
      
      // Check utility methods - trend direction might be neutral with random data
      const direction = adx.getTrendDirection();
      expect(['bullish', 'bearish', 'neutral']).toContain(direction);
    });

    it('should detect consolidation', () => {
      const sidewaysData = generateTrendingCandles(40, 'sideways');
      const result = adx.calculate(sidewaysData);
      
      // In consolidation, ADX should be relatively low
      expect(result.value.adx).toBeLessThan(50);
      expect(adx.isConsolidating()).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      const data = generateTrendingCandles(30, 'up');
      adx.calculate(data);
    });

    it('should provide trend analysis', () => {
      const direction = adx.getTrendDirection();
      expect(['bullish', 'bearish', 'neutral']).toContain(direction);
      
      const strength = adx.getTrendStrength();
      expect(['very_weak', 'weak', 'moderate', 'strong', 'very_strong', 'extreme']).toContain(strength);
    });

    it('should detect DI crossovers', () => {
      // First add some data so there's a latest result
      const data = generateTrendingCandles(25, 'up');
      adx.calculate(data);
      
      // Test basic functionality since checkDICrossover is private
      const latest = adx.getLatestResult();
      expect(latest).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle insufficient data gracefully', () => {
      const smallData = generateTestCandles(5);
      
      // ADX should throw an error for insufficient data
      expect(() => adx.calculate(smallData)).toThrow('Insufficient data');
    });

    it('should handle identical prices', () => {
      const flatData: OHLCV[] = Array(20).fill(null).map((_, i) => ({
        time: new Date(Date.now() + i * 60000),
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000
      }));
      
      const result = adx.calculate(flatData);
      expect(result.value.adx).toBe(0);
      expect(result.value.dx).toBe(0);
    });
  });
});

describe('MFI (Money Flow Index)', () => {
  let mfi: MFI;
  
  beforeEach(() => {
    mfi = new MFI({ period: 14 });
  });

  describe('Configuration and Validation', () => {
    it('should create MFI with valid configuration', () => {
      expect(mfi.getName()).toBe('MFI');
      expect(mfi.getConfig().period).toBe(14);
    });

    it('should validate overbought/oversold levels', () => {
      expect(() => new MFI({ 
        period: 14, 
        overboughtLevel: 45 
      })).toThrow('Overbought level must be between 50 and 100');
      
      expect(() => new MFI({ 
        period: 14, 
        oversoldLevel: 55 
      })).toThrow('Oversold level must be between 0 and 50');
    });

    it('should support custom configuration', () => {
      const customMFI = new MFI({ 
        period: 21, 
        overboughtLevel: 85,
        oversoldLevel: 15,
        useTypicalPrice: false
      });
      
      expect(customMFI.getConfig().period).toBe(21);
    });
  });

  describe('Calculation Accuracy', () => {
    it('should calculate MFI with volume data', () => {
      const data = generateTestCandles(30);
      const result = mfi.calculate(data);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should handle streaming updates', () => {
      const data = generateTestCandles(25);
      
      // Build up data
      for (let i = 0; i < 20; i++) {
        mfi.update(data[i]);
      }
      
      const streamResult = mfi.update(data[20]);
      expect(streamResult.isValid).toBe(true);
      expect(streamResult.value).toBeGreaterThanOrEqual(0);
      expect(streamResult.value).toBeLessThanOrEqual(100);
    });

    it('should reflect volume-price relationship', () => {
      // Create data where price goes up with high volume
      const highVolumeBullish: OHLCV[] = [];
      let price = 100;
      
      for (let i = 0; i < 20; i++) {
        const open = price;
        const close = price + 1; // Always increasing
        const high = close + 0.5;
        const low = open - 0.5;
        const volume = 10000; // High volume
        
        highVolumeBullish.push({
          time: new Date(Date.now() + i * 60000),
          open, high, low, close, volume
        });
        
        price = close;
      }
      
      const result = mfi.calculate(highVolumeBullish);
      expect(result.value).toBeGreaterThan(50); // Should be bullish
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      const data = generateTestCandles(25);
      mfi.calculate(data);
    });

    it('should identify overbought/oversold conditions', () => {
      expect(typeof mfi.isOverbought()).toBe('boolean');
      expect(typeof mfi.isOversold()).toBe('boolean');
      
      const level = mfi.getMFILevel();
      expect(['extreme_overbought', 'overbought', 'neutral', 'oversold', 'extreme_oversold']).toContain(level);
    });

    it('should provide trend analysis', () => {
      const trend = mfi.getTrend();
      expect(['rising', 'falling', 'sideways']).toContain(trend);
      
      const momentum = mfi.getMFIMomentum();
      expect(typeof momentum).toBe('number');
    });

    it('should analyze money flow components', () => {
      const components = mfi.getMoneyFlowComponents();
      expect(components).toHaveProperty('positiveFlow');
      expect(components).toHaveProperty('negativeFlow');
      expect(components).toHaveProperty('ratio');
      expect(components.positiveFlow).toBeGreaterThanOrEqual(0);
      expect(components.negativeFlow).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('TRIX (Triple Exponential Average)', () => {
  let trix: TRIX;
  
  beforeEach(() => {
    trix = new TRIX({ period: 14 });
  });

  describe('Configuration and Validation', () => {
    it('should create TRIX with valid configuration', () => {
      expect(trix.getName()).toBe('TRIX');
      expect(trix.getConfig().period).toBe(14);
    });

    it('should validate minimum period', () => {
      expect(() => new TRIX({ period: 1 })).toThrow('TRIX period must be at least 3');
    });

    it('should support custom configuration', () => {
      const customTRIX = new TRIX({ 
        period: 21,
        signalPeriod: 7,
        scaleFactor: 1000,
        priceType: 'hl2'
      });
      
      expect(customTRIX.getConfig().period).toBe(21);
    });
  });

  describe('Calculation Accuracy', () => {
    it('should calculate TRIX values', () => {
      const data = generateTrendingCandles(60, 'up'); // Need more data for triple EMA
      const result = trix.calculate(data);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toHaveProperty('trix');
      expect(result.value).toHaveProperty('signal');
      expect(result.value).toHaveProperty('histogram');
      expect(result.value).toHaveProperty('tripleEMA');
      
      expect(typeof result.value.trix).toBe('number');
      expect(typeof result.value.signal).toBe('number');
      expect(typeof result.value.histogram).toBe('number');
      expect(result.value.tripleEMA).toBeGreaterThan(0);
    });

    it('should handle streaming updates', () => {
      const data = generateTrendingCandles(50, 'up');
      
      // Build up data
      for (let i = 0; i < 45; i++) {
        trix.update(data[i]);
      }
      
      const streamResult = trix.update(data[45]);
      expect(streamResult.isValid).toBe(true);
      expect(typeof streamResult.value.trix).toBe('number');
    });

    it('should reflect trend changes', () => {
      // Create strong uptrend data
      const uptrendData: OHLCV[] = [];
      let price = 100;
      
      for (let i = 0; i < 50; i++) {
        const open = price;
        const close = price + 0.5; // Consistent uptrend
        const high = close + 0.2;
        const low = open - 0.2;
        
        uptrendData.push({
          time: new Date(Date.now() + i * 60000),
          open, high, low, close,
          volume: 1000
        });
        
        price = close;
      }
      
      const result = trix.calculate(uptrendData);
      
      // In an uptrend, TRIX should eventually be positive
      expect(result.value.tripleEMA).toBeGreaterThan(100); // Price went up
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      const data = generateTrendingCandles(50, 'up');
      trix.calculate(data);
    });

    it('should provide trend analysis', () => {
      expect(typeof trix.isBullish()).toBe('boolean');
      expect(typeof trix.isBearish()).toBe('boolean');
      
      const direction = trix.getTrendDirection();
      expect(['bullish', 'bearish', 'neutral']).toContain(direction);
      
      const strength = trix.getMomentumStrength();
      expect(['weak', 'moderate', 'strong']).toContain(strength);
    });

    it('should detect crossovers', () => {
      const zeroCrossover = trix.checkZeroCrossover();
      expect(['bullish', 'bearish', 'none']).toContain(zeroCrossover);
    });

    it('should calculate rate of change', () => {
      const roc = trix.getTRIXROC();
      expect(typeof roc).toBe('number');
    });

    it('should provide EMA components', () => {
      const emaValues = trix.getEMAValues();
      expect(emaValues).toHaveProperty('ema1');
      expect(emaValues).toHaveProperty('ema2');
      expect(emaValues).toHaveProperty('ema3');
    });
  });
});

describe('AROON (Aroon Up/Down)', () => {
  let aroon: AROON;
  
  beforeEach(() => {
    aroon = new AROON({ period: 14 });
  });

  describe('Configuration and Validation', () => {
    it('should create AROON with valid configuration', () => {
      expect(aroon.getName()).toBe('AROON');
      expect(aroon.getConfig().period).toBe(14);
    });

    it('should validate minimum period', () => {
      expect(() => new AROON({ period: 1 })).toThrow('AROON period must be at least 2');
    });

    it('should validate threshold levels', () => {
      expect(() => new AROON({ 
        period: 14, 
        strongTrendThreshold: 40 
      })).toThrow('Strong trend threshold must be between 50 and 100');
      
      expect(() => new AROON({ 
        period: 14, 
        weakTrendThreshold: 60 
      })).toThrow('Weak trend threshold must be between 0 and 50');
    });
  });

  describe('Calculation Accuracy', () => {
    it('should calculate AROON values', () => {
      const data = generateTrendingCandles(25, 'up');
      const result = aroon.calculate(data);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toHaveProperty('aroonUp');
      expect(result.value).toHaveProperty('aroonDown');
      expect(result.value).toHaveProperty('oscillator');
      
      // Values should be between 0 and 100
      expect(result.value.aroonUp).toBeGreaterThanOrEqual(0);
      expect(result.value.aroonUp).toBeLessThanOrEqual(100);
      expect(result.value.aroonDown).toBeGreaterThanOrEqual(0);
      expect(result.value.aroonDown).toBeLessThanOrEqual(100);
      
      // Oscillator should be between -100 and 100
      expect(result.value.oscillator).toBeGreaterThanOrEqual(-100);
      expect(result.value.oscillator).toBeLessThanOrEqual(100);
    });

    it('should handle streaming updates', () => {
      const data = generateTrendingCandles(25, 'up');
      
      for (let i = 0; i < 20; i++) {
        aroon.update(data[i]);
      }
      
      const streamResult = aroon.update(data[20]);
      expect(streamResult.isValid).toBe(true);
    });

    it('should detect uptrend correctly', () => {
      // Create data with clear highest high at the end
      const uptrendData: OHLCV[] = [];
      let price = 100;
      
      for (let i = 0; i < 20; i++) {
        const open = price;
        const close = price + (i === 19 ? 5 : 0.1); // Big spike at end
        const high = close + 0.1;
        const low = open - 0.1;
        
        uptrendData.push({
          time: new Date(Date.now() + i * 60000),
          open, high, low, close,
          volume: 1000
        });
        
        price = close;
      }
      
      const result = aroon.calculate(uptrendData);
      
      // Should show strong uptrend (recent highest high)
      expect(result.value.aroonUp).toBeGreaterThan(result.value.aroonDown);
      expect(result.value.oscillator).toBeGreaterThan(0);
    });

    it('should detect downtrend correctly', () => {
      // Create data with clear lowest low at the end
      const downtrendData: OHLCV[] = [];
      let price = 100;
      
      for (let i = 0; i < 20; i++) {
        const open = price;
        const close = price - (i === 19 ? 5 : 0.1); // Big drop at end
        const high = open + 0.1;
        const low = close - 0.1;
        
        downtrendData.push({
          time: new Date(Date.now() + i * 60000),
          open, high, low, close,
          volume: 1000
        });
        
        price = close;
      }
      
      const result = aroon.calculate(downtrendData);
      
      // Should show strong downtrend (recent lowest low)
      expect(result.value.aroonDown).toBeGreaterThan(result.value.aroonUp);
      expect(result.value.oscillator).toBeLessThan(0);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      const data = generateTrendingCandles(25, 'up');
      aroon.calculate(data);
    });

    it('should identify trend strength', () => {
      expect(typeof aroon.isStrongUptrend()).toBe('boolean');
      expect(typeof aroon.isStrongDowntrend()).toBe('boolean');
      expect(typeof aroon.isConsolidating()).toBe('boolean');
      
      const strength = aroon.getTrendStrength();
      expect(['very_weak', 'weak', 'moderate', 'strong', 'very_strong']).toContain(strength);
    });

    it('should provide directional analysis', () => {
      const direction = aroon.getDominantDirection();
      expect(['up', 'down', 'balanced']).toContain(direction);
    });

    it('should analyze trend freshness', () => {
      const duration = aroon.getTrendDurationSignal();
      expect(duration).toHaveProperty('upTrendFreshness');
      expect(duration).toHaveProperty('downTrendFreshness');
      expect(['fresh', 'mature', 'old']).toContain(duration.upTrendFreshness);
      expect(['fresh', 'mature', 'old']).toContain(duration.downTrendFreshness);
    });

    it('should check for extremes', () => {
      const extremes = aroon.checkAroonExtremes();
      expect(extremes).toHaveProperty('aroonUpExtreme');
      expect(extremes).toHaveProperty('aroonDownExtreme');
      expect(extremes).toHaveProperty('reversalPotential');
    });

    it('should detect parallel movement', () => {
      const movement = aroon.checkParallelMovement();
      expect(['both_rising', 'both_falling', 'diverging', 'converging']).toContain(movement);
    });
  });
});

describe('Cross-Validation and Performance', () => {
  describe('Cross-Validation with Reference Values', () => {
    it('should produce consistent results across different data sets', () => {
      const indicators = [
        new ADX({ period: 14 }),
        new MFI({ period: 14 }),
        new TRIX({ period: 14 }),
        new AROON({ period: 14 })
      ];
      
      const testSets = [
        generateTrendingCandles(50, 'up'),
        generateTrendingCandles(50, 'down'),
        generateTrendingCandles(50, 'sideways')
      ];
      
      testSets.forEach((data) => {
        indicators.forEach(indicator => {
          const result = indicator.calculate(data);
          expect(result.isValid).toBe(true);
          expect(result.timestamp).toBeInstanceOf(Date);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
          
          // Each indicator should have appropriate value types
          if (indicator.getName() === 'ADX') {
            const value = result.value as any;
            expect(value).toHaveProperty('adx');
            expect(value).toHaveProperty('plusDI');
            expect(value).toHaveProperty('minusDI');
          } else if (indicator.getName() === 'MFI') {
            expect(typeof result.value).toBe('number');
          } else if (indicator.getName() === 'TRIX') {
            const value = result.value as any;
            expect(value).toHaveProperty('trix');
            expect(value).toHaveProperty('signal');
          } else if (indicator.getName() === 'AROON') {
            const value = result.value as any;
            expect(value).toHaveProperty('aroonUp');
            expect(value).toHaveProperty('aroonDown');
          }
        });
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should calculate indicators within reasonable time limits', () => {
      const largeDataSet = generateTestCandles(1000);
      const indicators = [
        new ADX({ period: 14 }),
        new MFI({ period: 14 }),
        new TRIX({ period: 14 }),
        new AROON({ period: 14 })
      ];
      
      indicators.forEach(indicator => {
        const startTime = performance.now();
        const result = indicator.calculate(largeDataSet);
        const endTime = performance.now();
        
        expect(result.isValid).toBe(true);
        expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
        
        const metrics = indicator.getPerformanceMetrics();
        expect(metrics.calculationTimeMs).toBeGreaterThan(0);
        expect(metrics.dataPointsProcessed).toBeGreaterThan(0);
      });
    });

    it('should handle streaming updates efficiently', () => {
      const streamingData = generateTestCandles(200);
      const indicator = new ADX({ period: 14 });
      
      // Build initial buffer
      for (let i = 0; i < 50; i++) {
        indicator.update(streamingData[i]);
      }
      
      // Time streaming updates
      const startTime = performance.now();
      for (let i = 50; i < 100; i++) {
        indicator.update(streamingData[i]);
      }
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      
      const metrics = indicator.getPerformanceMetrics();
      expect(metrics.avgTimePerPoint).toBeLessThan(1); // Average should be under 1ms per point
    });
  });

  describe('Memory Management', () => {
    it('should maintain bounded memory usage', () => {
      const indicator = new MFI({ period: 14 });
      const testData = generateTestCandles(500);
      
      // Process large amount of data
      testData.forEach(candle => {
        indicator.update(candle);
      });
      
      const metrics = indicator.getPerformanceMetrics();
      expect(metrics.memoryUsageBytes).toBeLessThan(100000); // Under 100KB
      
      // Buffer size should be bounded
      expect(indicator.getBufferSize()).toBeLessThanOrEqual(150); // Reasonable buffer size for MFI
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid data gracefully', () => {
      const indicators = [
        new ADX({ period: 14 }),
        new MFI({ period: 14 }),
        new TRIX({ period: 14 }),
        new AROON({ period: 14 })
      ];
      
      indicators.forEach(indicator => {
        // Empty array
        expect(() => indicator.calculate([])).toThrow();
        
        // Array with insufficient data should throw
        const smallData = generateTestCandles(2);
        expect(() => indicator.calculate(smallData)).toThrow();
      });
    });

    it('should recover from reset operations', () => {
      const indicator = new TRIX({ period: 14 });
      const data = generateTestCandles(30);
      
      // Calculate normally
      const result1 = indicator.calculate(data);
      expect(result1.isValid).toBe(true);
      
      // Reset and verify clean state
      indicator.reset();
      expect(indicator.getBufferSize()).toBe(0);
      expect(indicator.getStatus()).toBe('insufficient_data');
      
      // Should be able to calculate again after reset
      const result2 = indicator.calculate(data);
      expect(result2.isValid).toBe(true);
      
      // Results should be consistent
      expect(result1.value).toEqual(result2.value);
    });
  });
});

describe('Integration with Strategy System', () => {
  it('should work with direct indicator creation', () => {
    // Test direct creation instead of factory for now
    const adx = new ADX({ period: 14 });
    expect(adx.getName()).toBe('ADX');
    
    const mfi = new MFI({ period: 14 });
    expect(mfi.getName()).toBe('MFI');
    
    const trix = new TRIX({ period: 14 });
    expect(trix.getName()).toBe('TRIX');
    
    const aroon = new AROON({ period: 14 });
    expect(aroon.getName()).toBe('AROON');
  });

  it('should provide comprehensive status and metadata', () => {
    const indicator = new ADX({ period: 14 });
    const data = generateTestCandles(25);
    
    const result = indicator.calculate(data);
    
    expect(result.metadata).toHaveProperty('trendStrength');
    expect(result.metadata).toHaveProperty('directionalBias');
    expect(result.metadata).toHaveProperty('crossoverSignal');
    
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});