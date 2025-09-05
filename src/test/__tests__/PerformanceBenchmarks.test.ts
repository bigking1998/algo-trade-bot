/**
 * Performance Benchmarking Suite - Task TE-001
 * 
 * Comprehensive performance testing for all system components:
 * - Technical indicator calculation speed
 * - Strategy execution latency
 * - Database query performance
 * - ML feature computation speed
 * - Memory usage optimization
 * - Concurrent operation handling
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { TestingFramework } from '../TestingFramework';
import { MockDataGenerator } from '../MockDataGenerator';
import { 
  SimpleMovingAverage, 
  ExponentialMovingAverage, 
  RSI, 
  MACD, 
  BollingerBands 
} from '@/backend/indicators';

describe('Performance Benchmarks', () => {
  const LARGE_DATASET_SIZE = 10000;
  const MEDIUM_DATASET_SIZE = 1000;
  const SMALL_DATASET_SIZE = 100;

  let largeDataset: any[];
  let mediumDataset: any[];
  let smallDataset: any[];

  beforeAll(() => {
    // Pre-generate datasets for consistent testing
    largeDataset = MockDataGenerator.generateOHLCV({
      count: LARGE_DATASET_SIZE,
      basePrice: 100,
      volatility: 0.02
    });

    mediumDataset = MockDataGenerator.generateOHLCV({
      count: MEDIUM_DATASET_SIZE,
      basePrice: 100,
      volatility: 0.02
    });

    smallDataset = MockDataGenerator.generateOHLCV({
      count: SMALL_DATASET_SIZE,
      basePrice: 100,
      volatility: 0.02
    });
  });

  describe('Technical Indicator Performance', () => {
    test('Simple Moving Average calculation speed', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      // Test with different dataset sizes
      const benchmarks = [
        { size: 'small', data: smallDataset, maxTime: 1 },
        { size: 'medium', data: mediumDataset, maxTime: 5 },
        { size: 'large', data: largeDataset, maxTime: 50 }
      ];

      for (const benchmark of benchmarks) {
        await TestingFramework.assertPerformance(async () => {
          const result = sma.calculate(benchmark.data);
          expect(result.isValid).toBe(true);
        }, benchmark.maxTime, `SMA calculation for ${benchmark.size} dataset`);
      }

      const metrics = sma.getPerformanceMetrics();
      expect(metrics.calculationTimeMs).toBeLessThan(50);
      expect(metrics.dataPointsProcessed).toBe(largeDataset.length);
    });

    test('Exponential Moving Average calculation speed', async () => {
      const ema = new ExponentialMovingAverage({ period: 20 });
      
      await TestingFramework.assertPerformance(async () => {
        const result = ema.calculate(largeDataset);
        expect(result.isValid).toBe(true);
        expect(typeof result.value).toBe('number');
      }, TestingFramework.PERFORMANCE_BENCHMARKS.indicatorCalculation * 10);
      
      // Test streaming performance
      const streamingResults = [];
      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < 1000; i++) {
          const result = ema.update(mediumDataset[i % mediumDataset.length]);
          streamingResults.push(result);
        }
      }, 50, 'EMA streaming updates');
      
      expect(streamingResults).toHaveLength(1000);
    });

    test('RSI calculation performance', async () => {
      const rsi = new RSI({ period: 14 });
      
      await TestingFramework.assertPerformance(async () => {
        const result = rsi.calculate(largeDataset);
        expect(result.isValid).toBe(true);
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThanOrEqual(100);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.indicatorCalculation * 20);
      
      // Test RSI warmup performance
      const rsiWarmup = new RSI({ period: 14 });
      let warmupTime = 0;
      
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        rsiWarmup.update(largeDataset[i]);
        warmupTime += performance.now() - startTime;
        
        if (rsiWarmup.isRSIWarmedUp()) {
          break;
        }
      }
      
      expect(warmupTime).toBeLessThan(10); // Should warm up within 10ms
    });

    test('MACD calculation performance', async () => {
      const macd = new MACD({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
      
      await TestingFramework.assertPerformance(async () => {
        const result = macd.calculate(largeDataset);
        expect(result.isValid).toBe(true);
        expect(result.value).toHaveProperty('macd');
        expect(result.value).toHaveProperty('signal');
        expect(result.value).toHaveProperty('histogram');
      }, TestingFramework.PERFORMANCE_BENCHMARKS.indicatorCalculation * 30);
      
      // Test MACD crossover detection performance
      await TestingFramework.assertPerformance(async () => {
        const crossovers = [];
        for (let i = 1; i < mediumDataset.length; i++) {
          macd.update(mediumDataset[i]);
          if (macd.detectCrossover()) {
            crossovers.push(i);
          }
        }
      }, 20, 'MACD crossover detection');
    });

    test('Bollinger Bands calculation performance', async () => {
      const bb = new BollingerBands({ period: 20, stdDevMultiplier: 2.0 });
      
      await TestingFramework.assertPerformance(async () => {
        const result = bb.calculate(largeDataset);
        expect(result.isValid).toBe(true);
        expect(result.value).toHaveProperty('upper');
        expect(result.value).toHaveProperty('middle');
        expect(result.value).toHaveProperty('lower');
      }, TestingFramework.PERFORMANCE_BENCHMARKS.indicatorCalculation * 25);
      
      // Test BB squeeze detection performance
      await TestingFramework.assertPerformance(async () => {
        const squeezes = [];
        const expansions = [];
        
        for (let i = 0; i < mediumDataset.length; i++) {
          bb.update(mediumDataset[i]);
          if (bb.isSqueeze(0.1)) squeezes.push(i);
          if (bb.isExpansion(0.25)) expansions.push(i);
        }
      }, 15, 'BB squeeze/expansion detection');
    });

    test('Multiple indicators concurrent calculation', async () => {
      const indicators = {
        sma20: new SimpleMovingAverage({ period: 20 }),
        ema12: new ExponentialMovingAverage({ period: 12 }),
        rsi14: new RSI({ period: 14 }),
        macd: new MACD({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
        bb: new BollingerBands({ period: 20, stdDevMultiplier: 2.0 })
      };
      
      await TestingFramework.assertPerformance(async () => {
        const results = await Promise.all([
          indicators.sma20.calculate(mediumDataset),
          indicators.ema12.calculate(mediumDataset),
          indicators.rsi14.calculate(mediumDataset),
          indicators.macd.calculate(mediumDataset),
          indicators.bb.calculate(mediumDataset)
        ]);
        
        results.forEach(result => {
          expect(result.isValid).toBe(true);
        });
      }, 100, 'Concurrent indicator calculation');
    });
  });

  describe('Strategy Execution Performance', () => {
    test('Strategy execution latency', async () => {
      // Mock strategy implementation for testing
      class BenchmarkStrategy {
        async execute(context: any): Promise<any> {
          // Simulate realistic strategy logic
          const { marketData, indicators } = context;
          
          if (!marketData || marketData.length < 10) return null;
          
          // Simple trend analysis
          const recent = marketData.slice(-10);
          const priceChange = (recent[9].close - recent[0].close) / recent[0].close;
          
          // RSI analysis
          const rsi = indicators.rsi?.value || 50;
          
          // Decision making
          if (priceChange > 0.001 && rsi < 70) {
            return { action: 'buy', confidence: 0.8 };
          } else if (priceChange < -0.001 && rsi > 30) {
            return { action: 'sell', confidence: 0.8 };
          }
          
          return { action: 'hold', confidence: 0.5 };
        }
      }
      
      const strategy = new BenchmarkStrategy();
      const context = {
        marketData: mediumDataset,
        indicators: {
          rsi: { value: 65, isValid: true },
          sma: { value: 100.5, isValid: true }
        },
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 })
      };
      
      await TestingFramework.assertPerformance(async () => {
        const signal = await strategy.execute(context);
        expect(signal).toBeDefined();
      }, TestingFramework.PERFORMANCE_BENCHMARKS.strategyExecution);
      
      // Test multiple executions
      await TestingFramework.assertPerformance(async () => {
        const promises = Array.from({ length: 100 }, () => strategy.execute(context));
        const results = await Promise.all(promises);
        expect(results).toHaveLength(100);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.strategyExecution * 20);
    });

    test('Multi-strategy execution performance', async () => {
      const strategies = Array.from({ length: 10 }, (_, i) => ({
        id: `strategy_${i}`,
        execute: async (context: any) => {
          // Simulate different strategy complexities
          const complexity = (i % 3) + 1;
          await new Promise(resolve => setTimeout(resolve, complexity)); // Simulate processing time
          
          return {
            action: ['buy', 'sell', 'hold'][i % 3],
            confidence: 0.5 + (i % 5) * 0.1
          };
        }
      }));
      
      const context = {
        marketData: smallDataset,
        indicators: { rsi: { value: 50, isValid: true } },
        portfolio: MockDataGenerator.generatePortfolio({ totalValue: 10000 })
      };
      
      await TestingFramework.assertPerformance(async () => {
        const promises = strategies.map(s => s.execute(context));
        const results = await Promise.all(promises);
        expect(results).toHaveLength(10);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.strategyExecution * 2);
    });
  });

  describe('Database Performance', () => {
    test('Database query performance', async () => {
      const mockDb = TestingFramework.createMockDatabase();
      await mockDb.connect();
      
      // Insert test data
      const trades = MockDataGenerator.generateTrades({ count: 1000 });
      
      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < 100; i++) { // Test with subset
          await mockDb.insert('trades', trades[i]);
        }
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery * 10);
      
      // Query performance
      await TestingFramework.assertPerformance(async () => {
        const results = await mockDb.query('SELECT * FROM trades WHERE symbol = ?', ['BTC-USD']);
        expect(Array.isArray(results)).toBe(true);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery);
      
      await mockDb.disconnect();
    });

    test('Concurrent database operations', async () => {
      const mockDb = TestingFramework.createMockDatabase();
      await mockDb.connect();
      
      const concurrentOperations = Array.from({ length: 50 }, (_, i) => async () => {
        const trade = MockDataGenerator.generateTrades({ count: 1 })[0];
        await mockDb.insert('trades', { ...trade, id: i });
        return await mockDb.query('SELECT * FROM trades WHERE id = ?', [i]);
      });
      
      await TestingFramework.assertPerformance(async () => {
        const promises = concurrentOperations.map(op => op());
        const results = await Promise.all(promises);
        expect(results).toHaveLength(50);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.databaseQuery * 20);
      
      await mockDb.disconnect();
    });
  });

  describe('Memory Usage Optimization', () => {
    test('Indicator memory efficiency', async () => {
      const indicators = [
        new SimpleMovingAverage({ period: 50 }),
        new ExponentialMovingAverage({ period: 50 }),
        new RSI({ period: 14 }),
        new MACD({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
        new BollingerBands({ period: 20, stdDevMultiplier: 2.0 })
      ];
      
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        // Process large dataset through all indicators
        for (const candle of largeDataset) {
          indicators.forEach(indicator => indicator.update(candle));
        }
        
        return indicators.length;
      });
      
      expect(memoryTest.memoryUsedMB).toBeLessThan(50); // Should use less than 50MB
      expect(memoryTest.executionTimeMs).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify indicators maintain fixed buffer sizes
      indicators.forEach((indicator, index) => {
        const bufferSize = indicator.getBufferSize();
        expect(bufferSize).toBeLessThanOrEqual(100); // Reasonable buffer limit
      });
    });

    test('Strategy memory efficiency', async () => {
      class MemoryEfficientStrategy {
        private buffer: any[] = [];
        private readonly maxBufferSize = 100;
        
        async execute(context: any): Promise<any> {
          // Maintain limited buffer size
          this.buffer.push(context);
          if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
          }
          
          // Process data
          const recentData = this.buffer.slice(-20);
          return { action: 'hold', confidence: 0.5, bufferSize: this.buffer.length };
        }
        
        getBufferSize(): number {
          return this.buffer.length;
        }
      }
      
      const strategy = new MemoryEfficientStrategy();
      
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        for (let i = 0; i < 10000; i++) {
          const context = {
            marketData: smallDataset,
            indicators: { rsi: { value: 50, isValid: true } },
            timestamp: new Date()
          };
          
          await strategy.execute(context);
        }
        
        return strategy.getBufferSize();
      });
      
      expect(memoryTest.result).toBeLessThanOrEqual(100); // Buffer size should be limited
      expect(memoryTest.memoryUsedMB).toBeLessThan(10); // Should use less than 10MB
    });

    test('Large dataset processing memory efficiency', async () => {
      // Test processing very large datasets without memory leaks
      const veryLargeDataset = MockDataGenerator.generateOHLCV({
        count: 50000,
        basePrice: 100
      });
      
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        const sma = new SimpleMovingAverage({ period: 20 });
        
        // Process in chunks to test memory management
        const chunkSize = 1000;
        let processedCount = 0;
        
        for (let i = 0; i < veryLargeDataset.length; i += chunkSize) {
          const chunk = veryLargeDataset.slice(i, i + chunkSize);
          
          for (const candle of chunk) {
            sma.update(candle);
            processedCount++;
          }
          
          // Force garbage collection if available
          if (global.gc && i % (chunkSize * 5) === 0) {
            global.gc();
          }
        }
        
        return processedCount;
      });
      
      expect(memoryTest.result).toBe(veryLargeDataset.length);
      expect(memoryTest.memoryUsedMB).toBeLessThan(100); // Should not exceed 100MB
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('Concurrent indicator calculations', async () => {
      const datasets = Array.from({ length: 20 }, () => 
        MockDataGenerator.generateOHLCV({ count: 500 })
      );
      
      await TestingFramework.assertPerformance(async () => {
        const promises = datasets.map(dataset => {
          const sma = new SimpleMovingAverage({ period: 20 });
          return sma.calculate(dataset);
        });
        
        const results = await Promise.all(promises);
        results.forEach(result => {
          expect(result.isValid).toBe(true);
        });
      }, 200, 'Concurrent indicator calculations');
    });

    test('Concurrent strategy executions', async () => {
      const strategies = Array.from({ length: 50 }, (_, i) => ({
        id: `strategy_${i}`,
        execute: async () => {
          // Simulate varying computation times
          const computeTime = Math.random() * 10;
          await new Promise(resolve => setTimeout(resolve, computeTime));
          return { action: 'hold', confidence: 0.5, computeTime };
        }
      }));
      
      await TestingFramework.assertPerformance(async () => {
        const promises = strategies.map(s => s.execute());
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(50);
        results.forEach(result => {
          expect(result.action).toBeDefined();
          expect(result.confidence).toBeGreaterThan(0);
        });
      }, 100, 'Concurrent strategy executions');
    });

    test('Mixed concurrent operations', async () => {
      // Simulate real-world scenario with mixed operations
      const operations = [
        // Database operations
        ...Array.from({ length: 10 }, () => async () => {
          const mockDb = TestingFramework.createMockDatabase();
          await mockDb.connect();
          const trade = MockDataGenerator.generateTrades({ count: 1 })[0];
          await mockDb.insert('trades', trade);
          await mockDb.disconnect();
        }),
        
        // Indicator calculations
        ...Array.from({ length: 15 }, () => async () => {
          const sma = new SimpleMovingAverage({ period: 20 });
          return sma.calculate(smallDataset);
        }),
        
        // Strategy executions
        ...Array.from({ length: 25 }, () => async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
          return { action: 'hold', confidence: 0.5 };
        })
      ];
      
      await TestingFramework.assertPerformance(async () => {
        const promises = operations.map(op => op());
        const results = await Promise.all(promises);
        expect(results).toHaveLength(50);
      }, 500, 'Mixed concurrent operations');
    });
  });

  describe('Real-time Performance', () => {
    test('Real-time data processing latency', async () => {
      const indicator = new SimpleMovingAverage({ period: 20 });
      const latencies: number[] = [];
      
      // Simulate real-time data feed
      for (let i = 0; i < 1000; i++) {
        const candle = MockDataGenerator.generateOHLCV({ count: 1 })[0];
        
        const startTime = performance.now();
        const result = indicator.update(candle);
        const endTime = performance.now();
        
        const latency = endTime - startTime;
        latencies.push(latency);
        
        expect(result.timestamp).toBeInstanceOf(Date);
      }
      
      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort()[Math.floor(latencies.length * 0.95)];
      
      expect(avgLatency).toBeLessThan(1); // Average should be < 1ms
      expect(maxLatency).toBeLessThan(10); // Max should be < 10ms
      expect(p95Latency).toBeLessThan(2); // 95th percentile should be < 2ms
      
      console.log(`Real-time processing stats:
        Average latency: ${avgLatency.toFixed(3)}ms
        Max latency: ${maxLatency.toFixed(3)}ms
        95th percentile: ${p95Latency.toFixed(3)}ms
      `);
    });

    test('Streaming performance under load', async () => {
      const indicators = {
        sma: new SimpleMovingAverage({ period: 20 }),
        ema: new ExponentialMovingAverage({ period: 12 }),
        rsi: new RSI({ period: 14 })
      };
      
      const totalUpdates = 10000;
      const startTime = performance.now();
      
      for (let i = 0; i < totalUpdates; i++) {
        const candle = MockDataGenerator.generateOHLCV({ count: 1 })[0];
        
        // Update all indicators
        Object.values(indicators).forEach(indicator => {
          indicator.update(candle);
        });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const updatesPerSecond = (totalUpdates / totalTime) * 1000;
      
      expect(updatesPerSecond).toBeGreaterThan(1000); // Should handle > 1000 updates/sec
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`Streaming performance: ${updatesPerSecond.toFixed(0)} updates/second`);
    });
  });

  describe('Performance Regression Detection', () => {
    test('Performance baseline comparison', async () => {
      // This would typically compare against stored baseline metrics
      const baselineMetrics = {
        smaCalculation: 1,
        strategyExecution: 50,
        databaseQuery: 100
      };
      
      // Test SMA performance
      const sma = new SimpleMovingAverage({ period: 20 });
      const smaStartTime = performance.now();
      sma.calculate(mediumDataset);
      const smaTime = performance.now() - smaStartTime;
      
      // Allow 50% performance degradation threshold
      const regressionThreshold = 1.5;
      expect(smaTime).toBeLessThan(baselineMetrics.smaCalculation * regressionThreshold);
      
      console.log(`Performance comparison:
        SMA calculation: ${smaTime.toFixed(2)}ms (baseline: ${baselineMetrics.smaCalculation}ms)
        Regression factor: ${(smaTime / baselineMetrics.smaCalculation).toFixed(2)}x
      `);
    });

    test('Memory leak detection', async () => {
      const indicator = new SimpleMovingAverage({ period: 20 });
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;
      
      // Process data multiple times to detect leaks
      for (let iteration = 0; iteration < 100; iteration++) {
        const dataset = MockDataGenerator.generateOHLCV({ count: 100 });
        
        for (const candle of dataset) {
          indicator.update(candle);
        }
        
        // Force garbage collection periodically
        if (global.gc && iteration % 10 === 0) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(5); // Should not increase by more than 5MB
      
      console.log(`Memory leak test:
        Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Increase: ${memoryIncrease.toFixed(2)}MB
      `);
    });
  });
});