/**
 * Memory Profiling and Optimization Validation - Task TE-003
 * 
 * Comprehensive memory usage analysis and optimization validation for the trading platform.
 * Detects memory leaks, analyzes allocation patterns, and validates garbage collection efficiency.
 * 
 * Features:
 * - Memory leak detection and prevention
 * - Garbage collection analysis and optimization
 * - Memory allocation profiling under various loads
 * - Buffer overflow and underflow detection
 * - Memory fragmentation analysis
 * - Real-time memory monitoring during trading operations
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { MockDataGenerator } from '../MockDataGenerator';
import { TestingFramework } from '../TestingFramework';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

interface MemoryLeakTest {
  operation: string;
  iterations: number;
  initialMemory: MemorySnapshot;
  finalMemory: MemorySnapshot;
  peakMemory: MemorySnapshot;
  memoryGrowth: number;
  leakRate: number; // MB per 1000 iterations
  gcEfficiency: number;
}

describe('Memory Profiling and Optimization Validation', () => {
  let performanceUtils: PerformanceTestUtils;
  let memorySnapshots: MemorySnapshot[] = [];
  let gcStats: any[] = [];

  beforeAll(() => {
    performanceUtils = new PerformanceTestUtils();
    performanceUtils.initialize();
    
    // Enable GC monitoring if available
    if (global.gc) {
      console.log('Garbage collection monitoring enabled');
    } else {
      console.warn('Garbage collection monitoring not available (run with --expose-gc for full analysis)');
    }
  });

  beforeEach(() => {
    memorySnapshots = [];
    gcStats = [];
    
    // Force initial garbage collection
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    performanceUtils.cleanup();
    
    // Clean up after each test
    if (global.gc) {
      global.gc();
    }
  });

  function captureMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss
    };
  }

  function calculateMemoryGrowth(initial: MemorySnapshot, final: MemorySnapshot): number {
    return ((final.heapUsed - initial.heapUsed) / 1024 / 1024); // MB
  }

  describe('Memory Leak Detection', () => {
    test('Strategy execution memory leak analysis', async () => {
      console.log('Analyzing strategy execution for memory leaks...');
      
      const iterations = 10000;
      const gcInterval = 1000; // Force GC every 1000 iterations
      const snapshots: MemorySnapshot[] = [];
      
      // Initial memory state
      if (global.gc) global.gc();
      const initialMemory = captureMemorySnapshot();
      snapshots.push(initialMemory);

      // Execute strategy multiple times to detect leaks
      for (let i = 0; i < iterations; i++) {
        const context = MockDataGenerator.generateStrategyContext({
          complexity: 'medium',
          indicatorCount: 5,
          dataPoints: 100
        });

        // Execute strategy
        await performanceUtils.executeStrategy(context);

        // Capture memory snapshots periodically
        if (i % 100 === 0) {
          snapshots.push(captureMemorySnapshot());
        }

        // Force GC periodically to distinguish leaks from normal allocation
        if (i % gcInterval === 0 && global.gc) {
          global.gc();
        }
      }

      // Final memory state
      if (global.gc) global.gc();
      const finalMemory = captureMemorySnapshot();
      snapshots.push(finalMemory);

      const memoryGrowth = calculateMemoryGrowth(initialMemory, finalMemory);
      const leakRate = (memoryGrowth / iterations) * 1000; // MB per 1000 iterations

      console.log(`Strategy Execution Memory Analysis:
        Iterations: ${iterations.toLocaleString()}
        Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Memory Growth: ${memoryGrowth.toFixed(2)} MB
        Leak Rate: ${leakRate.toFixed(4)} MB per 1000 iterations
      `);

      // Memory growth should be minimal after GC
      expect(memoryGrowth).toBeLessThan(10, 'Memory growth after strategy execution should be <10MB');
      expect(leakRate).toBeLessThan(1, 'Memory leak rate should be <1MB per 1000 iterations');

      // Analyze growth trend
      const growthTrend = analyzeMemoryTrend(snapshots);
      expect(growthTrend.isLinearGrowth).toBe(false, 'Memory should not show linear growth (indicates leak)');
      
      const leakTest: MemoryLeakTest = {
        operation: 'strategy_execution',
        iterations,
        initialMemory,
        finalMemory,
        peakMemory: snapshots.reduce((peak, current) => 
          current.heapUsed > peak.heapUsed ? current : peak),
        memoryGrowth,
        leakRate,
        gcEfficiency: calculateGCEfficiency(snapshots)
      };

      console.log(`Memory Leak Analysis Results:
        Leak Detected: ${leakRate > 0.5 ? 'YES' : 'NO'}
        GC Efficiency: ${(leakTest.gcEfficiency * 100).toFixed(1)}%
        Peak Memory: ${(leakTest.peakMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
      `);
    });

    test('Market data processing memory efficiency', async () => {
      console.log('Testing market data processing memory efficiency...');
      
      const testDuration = 60000; // 1 minute
      const dataRate = 1000; // ticks per second
      const snapshots: MemorySnapshot[] = [];
      
      if (global.gc) global.gc();
      const initialMemory = captureMemorySnapshot();
      
      const startTime = Date.now();
      let ticksProcessed = 0;
      
      while (Date.now() - startTime < testDuration) {
        // Generate and process market data
        const marketTicks = MockDataGenerator.generateMarketTicks({
          count: 100,
          symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD']
        });

        for (const tick of marketTicks) {
          await performanceUtils.processMarketDataTick(tick);
          ticksProcessed++;
        }

        // Capture memory snapshot every 5 seconds
        if (ticksProcessed % (dataRate * 5) === 0) {
          snapshots.push(captureMemorySnapshot());
        }

        // Brief pause to simulate realistic timing
        await new Promise(resolve => setTimeout(resolve, 1000 / dataRate));
      }

      if (global.gc) global.gc();
      const finalMemory = captureMemorySnapshot();
      
      const memoryGrowth = calculateMemoryGrowth(initialMemory, finalMemory);
      const memoryPerTick = (memoryGrowth / ticksProcessed) * 1024 * 1024; // bytes per tick

      console.log(`Market Data Processing Memory Analysis:
        Duration: ${testDuration / 1000}s
        Ticks Processed: ${ticksProcessed.toLocaleString()}
        Processing Rate: ${(ticksProcessed / (testDuration / 1000)).toFixed(0)} ticks/sec
        Memory Growth: ${memoryGrowth.toFixed(2)} MB
        Memory per Tick: ${memoryPerTick.toFixed(2)} bytes
      `);

      // Market data processing should be memory efficient
      expect(memoryGrowth).toBeLessThan(50, 'Market data processing memory growth should be <50MB');
      expect(memoryPerTick).toBeLessThan(1024, 'Memory per tick should be <1KB');

      // Memory usage should stabilize (not continuously grow)
      const trend = analyzeMemoryTrend(snapshots);
      expect(trend.stabilityScore).toBeGreaterThan(0.8, 'Memory usage should be stable during data processing');
    });

    test('Order management system memory validation', async () => {
      console.log('Validating order management system memory usage...');
      
      const orderCounts = [1000, 5000, 10000, 25000];
      const memoryUsageByOrderCount: Array<{count: number, memory: number}> = [];
      
      for (const orderCount of orderCounts) {
        if (global.gc) global.gc();
        const beforeMemory = captureMemorySnapshot();
        
        // Create and manage orders
        const orders = MockDataGenerator.generateOrders({
          count: orderCount,
          symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD']
        });

        // Simulate order lifecycle
        const orderStatuses: any[] = [];
        for (const order of orders) {
          const status = await performanceUtils.processOrderLifecycle(order);
          orderStatuses.push(status);
        }

        const afterMemory = captureMemorySnapshot();
        const memoryUsed = calculateMemoryGrowth(beforeMemory, afterMemory);
        
        memoryUsageByOrderCount.push({
          count: orderCount,
          memory: memoryUsed
        });

        const memoryPerOrder = (memoryUsed / orderCount) * 1024 * 1024; // bytes per order

        console.log(`Order Management (${orderCount.toLocaleString()} orders):
          Memory Used: ${memoryUsed.toFixed(2)} MB
          Memory per Order: ${memoryPerOrder.toFixed(0)} bytes
        `);

        // Memory usage should scale reasonably with order count
        expect(memoryPerOrder).toBeLessThan(2048, `Memory per order should be <2KB (${orderCount} orders)`);
        
        // Clean up orders
        orderStatuses.length = 0;
        if (global.gc) global.gc();
      }

      // Analyze scaling efficiency
      const scalingEfficiency = analyzeMemoryScaling(memoryUsageByOrderCount);
      expect(scalingEfficiency.linearityScore).toBeGreaterThan(0.9, 
        'Order memory usage should scale linearly');
      
      console.log(`Order Management Memory Scaling:
        Linearity Score: ${scalingEfficiency.linearityScore.toFixed(3)}
        Base Overhead: ${scalingEfficiency.baseOverheadMB.toFixed(2)} MB
        Per-Order Cost: ${scalingEfficiency.perItemCostBytes.toFixed(0)} bytes
      `);
    });
  });

  describe('Garbage Collection Analysis', () => {
    test('GC performance under high-frequency trading load', async () => {
      console.log('Analyzing garbage collection performance under HFT load...');
      
      if (!global.gc) {
        console.warn('Skipping GC analysis - requires --expose-gc flag');
        return;
      }

      const testDuration = 30000; // 30 seconds
      const operationRate = 5000; // operations per second
      const gcSnapshots: Array<{timestamp: number, beforeGC: MemorySnapshot, afterGC: MemorySnapshot, gcTime: number}> = [];
      
      const startTime = Date.now();
      let operations = 0;
      
      while (Date.now() - startTime < testDuration) {
        // Perform high-frequency operations
        for (let i = 0; i < 100; i++) {
          const order = MockDataGenerator.generateOrders({ count: 1 })[0];
          await performanceUtils.simulateOrderProcessing(order);
          operations++;
        }

        // Trigger GC and measure performance
        if (operations % 1000 === 0) {
          const beforeGC = captureMemorySnapshot();
          const gcStartTime = performance.now();
          
          global.gc();
          
          const gcEndTime = performance.now();
          const afterGC = captureMemorySnapshot();
          
          gcSnapshots.push({
            timestamp: Date.now(),
            beforeGC,
            afterGC,
            gcTime: gcEndTime - gcStartTime
          });
        }

        // Maintain operation rate
        await new Promise(resolve => setTimeout(resolve, 100000 / operationRate));
      }

      // Analyze GC performance
      const avgGCTime = gcSnapshots.reduce((sum, s) => sum + s.gcTime, 0) / gcSnapshots.length;
      const maxGCTime = Math.max(...gcSnapshots.map(s => s.gcTime));
      const avgMemoryReclaimed = gcSnapshots.reduce((sum, s) => 
        sum + calculateMemoryGrowth(s.afterGC, s.beforeGC), 0) / gcSnapshots.length;

      console.log(`Garbage Collection Analysis:
        Test Duration: ${testDuration / 1000}s
        Operations: ${operations.toLocaleString()}
        GC Cycles: ${gcSnapshots.length}
        Average GC Time: ${avgGCTime.toFixed(2)}ms
        Max GC Time: ${maxGCTime.toFixed(2)}ms
        Avg Memory Reclaimed: ${Math.abs(avgMemoryReclaimed).toFixed(2)} MB
      `);

      // GC should be efficient and not cause long pauses
      expect(avgGCTime).toBeLessThan(10, 'Average GC time should be <10ms');
      expect(maxGCTime).toBeLessThan(50, 'Maximum GC time should be <50ms');
      expect(Math.abs(avgMemoryReclaimed)).toBeGreaterThan(1, 'GC should reclaim meaningful memory');

      // Check for GC frequency (shouldn't be too frequent)
      const gcFrequency = gcSnapshots.length / (testDuration / 1000);
      expect(gcFrequency).toBeLessThan(10, 'GC frequency should be <10 cycles/second');
    });

    test('Memory pressure handling and recovery', async () => {
      console.log('Testing system behavior under memory pressure...');
      
      const memoryPressureTests = [
        { name: 'Large dataset processing', sizeMB: 100 },
        { name: 'Multiple concurrent strategies', sizeMB: 200 },
        { name: 'Historical data analysis', sizeMB: 500 }
      ];

      for (const test of memoryPressureTests) {
        console.log(`Testing: ${test.name} (${test.sizeMB}MB target)`);
        
        if (global.gc) global.gc();
        const initialMemory = captureMemorySnapshot();
        
        // Create memory pressure
        const largeDatasets: any[] = [];
        let currentMemoryMB = 0;
        
        while (currentMemoryMB < test.sizeMB) {
          const dataset = MockDataGenerator.generateOHLCV({
            count: 10000,
            basePrice: 100,
            volatility: 0.02
          });
          
          largeDatasets.push(dataset);
          
          const currentMemory = captureMemorySnapshot();
          currentMemoryMB = calculateMemoryGrowth(initialMemory, currentMemory);
        }

        const peakMemory = captureMemorySnapshot();
        
        // Process data under memory pressure
        const processingTime = await performanceUtils.measureLatency(async () => {
          for (const dataset of largeDatasets.slice(0, 5)) { // Process subset to avoid timeout
            const result = await performanceUtils.processLargeDataset(dataset);
            expect(result).toBeDefined();
          }
        });

        // Release memory and measure recovery
        largeDatasets.length = 0;
        
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Allow GC to complete
        
        const recoveredMemory = captureMemorySnapshot();
        const memoryRecovered = calculateMemoryGrowth(recoveredMemory, peakMemory);

        console.log(`${test.name} Results:
          Peak Memory: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
          Processing Time: ${processingTime.toFixed(0)}ms
          Memory Recovered: ${Math.abs(memoryRecovered).toFixed(2)} MB
          Recovery Rate: ${((Math.abs(memoryRecovered) / test.sizeMB) * 100).toFixed(1)}%
        `);

        // System should handle memory pressure gracefully
        expect(processingTime).toBeLessThan(30000, 'Processing under memory pressure should complete within 30s');
        expect(Math.abs(memoryRecovered)).toBeGreaterThan(test.sizeMB * 0.8, 
          'Should recover at least 80% of allocated memory');
      }
    });
  });

  describe('Memory Allocation Profiling', () => {
    test('Buffer management and reuse efficiency', async () => {
      console.log('Analyzing buffer management and reuse patterns...');
      
      const bufferSizes = [1024, 4096, 16384, 65536]; // 1KB to 64KB buffers
      const bufferUsageStats: Map<number, {allocated: number, reused: number, freed: number}> = new Map();

      for (const bufferSize of bufferSizes) {
        const stats = { allocated: 0, reused: 0, freed: 0 };
        bufferUsageStats.set(bufferSize, stats);
        
        if (global.gc) global.gc();
        const beforeMemory = captureMemorySnapshot();
        
        // Simulate buffer-intensive operations
        const buffers: Buffer[] = [];
        
        for (let i = 0; i < 1000; i++) {
          // Allocate buffer
          const buffer = Buffer.allocUnsafe(bufferSize);
          buffers.push(buffer);
          stats.allocated++;
          
          // Simulate buffer usage
          await performanceUtils.processBufferData(buffer);
          
          // Periodically free old buffers
          if (buffers.length > 100) {
            const oldBuffer = buffers.shift();
            if (oldBuffer) {
              stats.freed++;
            }
          }
        }

        // Clean up remaining buffers
        buffers.length = 0;
        
        if (global.gc) global.gc();
        const afterMemory = captureMemorySnapshot();
        
        const memoryUsed = calculateMemoryGrowth(beforeMemory, afterMemory);
        const expectedMemory = (bufferSize * stats.allocated) / 1024 / 1024;
        const efficiency = Math.max(0, 1 - (memoryUsed / expectedMemory));

        console.log(`Buffer Management (${bufferSize} bytes):
          Allocated: ${stats.allocated}
          Freed: ${stats.freed}
          Memory Used: ${memoryUsed.toFixed(2)} MB
          Expected Memory: ${expectedMemory.toFixed(2)} MB
          Efficiency: ${(efficiency * 100).toFixed(1)}%
        `);

        // Buffer management should be efficient
        expect(efficiency).toBeGreaterThan(0.7, `Buffer efficiency should be >70% for ${bufferSize}B buffers`);
      }
    });

    test('String and object allocation optimization', async () => {
      console.log('Profiling string and object allocation patterns...');
      
      const testCases = [
        { name: 'Price formatting', operation: 'formatPrice', iterations: 10000 },
        { name: 'JSON serialization', operation: 'jsonSerialization', iterations: 5000 },
        { name: 'Order object creation', operation: 'createOrder', iterations: 20000 },
        { name: 'Market data parsing', operation: 'parseMarketData', iterations: 15000 }
      ];

      for (const testCase of testCases) {
        if (global.gc) global.gc();
        const beforeMemory = captureMemorySnapshot();
        
        const allocatedObjects: any[] = [];
        
        for (let i = 0; i < testCase.iterations; i++) {
          let obj;
          
          switch (testCase.operation) {
            case 'formatPrice':
              obj = performanceUtils.formatPrice(Math.random() * 100000);
              break;
            case 'jsonSerialization':
              const data = MockDataGenerator.generateTrade();
              obj = JSON.stringify(data);
              break;
            case 'createOrder':
              obj = MockDataGenerator.generateOrders({ count: 1 })[0];
              break;
            case 'parseMarketData':
              const rawData = '{"symbol":"BTC-USD","price":50000.25,"volume":1.5,"timestamp":1640995200000}';
              obj = JSON.parse(rawData);
              break;
          }
          
          if (i % 100 === 0) {
            allocatedObjects.push(obj); // Keep some objects to prevent immediate GC
          }
        }

        const afterMemory = captureMemorySnapshot();
        const memoryUsed = calculateMemoryGrowth(beforeMemory, afterMemory);
        const memoryPerOperation = (memoryUsed / testCase.iterations) * 1024 * 1024; // bytes

        console.log(`${testCase.name} Allocation Analysis:
          Operations: ${testCase.iterations.toLocaleString()}
          Memory Used: ${memoryUsed.toFixed(2)} MB
          Memory per Operation: ${memoryPerOperation.toFixed(0)} bytes
        `);

        // Object allocation should be reasonable
        expect(memoryPerOperation).toBeLessThan(1024, 
          `${testCase.name} should use <1KB per operation`);

        // Clean up
        allocatedObjects.length = 0;
      }
    });
  });

  describe('Memory Monitoring and Alerts', () => {
    test('Real-time memory monitoring during trading simulation', async () => {
      console.log('Running real-time memory monitoring during trading simulation...');
      
      const monitoringDuration = 60000; // 1 minute
      const samplingInterval = 1000; // 1 second
      const memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
      
      const memoryTimeline: Array<{timestamp: number, memory: MemorySnapshot, alerts: string[]}> = [];
      let alertCount = 0;
      
      const startTime = Date.now();
      
      // Start trading simulation
      const tradingSimulation = performanceUtils.startTradingSimulation({
        strategies: ['emaStrategy', 'rsiStrategy', 'macdStrategy'],
        symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
        orderRate: 10 // orders per second
      });

      // Memory monitoring loop
      while (Date.now() - startTime < monitoringDuration) {
        const memory = captureMemorySnapshot();
        const alerts: string[] = [];
        
        // Check memory thresholds
        if (memory.heapUsed > memoryThreshold) {
          alerts.push('HIGH_MEMORY_USAGE');
          alertCount++;
        }
        
        if (memory.heapUsed > memory.heapTotal * 0.9) {
          alerts.push('HEAP_NEAR_LIMIT');
          alertCount++;
        }
        
        // Check for rapid memory growth
        if (memoryTimeline.length > 0) {
          const previousEntry = memoryTimeline[memoryTimeline.length - 1];
          const growthRate = (memory.heapUsed - previousEntry.memory.heapUsed) / samplingInterval; // bytes per ms
          
          if (growthRate > 100000) { // >100KB/ms growth
            alerts.push('RAPID_MEMORY_GROWTH');
            alertCount++;
          }
        }

        memoryTimeline.push({
          timestamp: Date.now(),
          memory,
          alerts
        });

        if (alerts.length > 0) {
          console.warn(`Memory Alert at ${new Date().toISOString()}: ${alerts.join(', ')}`);
        }

        await new Promise(resolve => setTimeout(resolve, samplingInterval));
      }

      // Stop trading simulation
      await performanceUtils.stopTradingSimulation(tradingSimulation);
      
      // Analyze memory behavior
      const initialMemory = memoryTimeline[0].memory.heapUsed;
      const finalMemory = memoryTimeline[memoryTimeline.length - 1].memory.heapUsed;
      const peakMemory = Math.max(...memoryTimeline.map(entry => entry.memory.heapUsed));
      const totalGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Memory Monitoring Results:
        Duration: ${monitoringDuration / 1000}s
        Samples: ${memoryTimeline.length}
        Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB
        Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB
        Peak Memory: ${(peakMemory / 1024 / 1024).toFixed(2)} MB
        Total Growth: ${totalGrowth.toFixed(2)} MB
        Alerts Triggered: ${alertCount}
      `);

      // Memory behavior should be stable during trading
      expect(totalGrowth).toBeLessThan(100, 'Memory growth during trading should be <100MB');
      expect(alertCount).toBeLessThan(10, 'Memory alerts should be minimal during normal trading');
      expect(peakMemory).toBeLessThan(memoryThreshold * 2, 'Peak memory should not exceed 2x threshold');
    });

    test('Memory optimization recommendations generation', async () => {
      console.log('Generating memory optimization recommendations...');
      
      // Collect comprehensive memory analysis data
      const analysisResults = {
        memoryLeakTests: [
          { operation: 'strategy_execution', leakRate: 0.1, gcEfficiency: 0.95 },
          { operation: 'market_data_processing', leakRate: 0.05, gcEfficiency: 0.98 },
          { operation: 'order_management', leakRate: 0.2, gcEfficiency: 0.92 }
        ],
        allocationPatterns: [
          { operation: 'buffer_management', efficiency: 0.85, wastePercentage: 15 },
          { operation: 'string_operations', efficiency: 0.78, wastePercentage: 22 },
          { operation: 'object_creation', efficiency: 0.82, wastePercentage: 18 }
        ],
        gcPerformance: {
          averageTime: 5.2,
          maxTime: 18.5,
          frequency: 3.2
        }
      };

      const recommendations = performanceUtils.generateMemoryOptimizationRecommendations(analysisResults);
      
      console.log('Memory Optimization Recommendations:');
      recommendations.forEach((recommendation, index) => {
        console.log(`${index + 1}. ${recommendation.category}: ${recommendation.description}`);
        console.log(`   Priority: ${recommendation.priority}`);
        console.log(`   Expected Impact: ${recommendation.expectedImpact}`);
        console.log('');
      });

      // Should provide actionable recommendations
      expect(recommendations.length).toBeGreaterThan(0, 'Should generate optimization recommendations');
      
      const highPriorityRecommendations = recommendations.filter(r => r.priority === 'HIGH');
      const mediumPriorityRecommendations = recommendations.filter(r => r.priority === 'MEDIUM');
      
      console.log(`Recommendation Summary:
        Total Recommendations: ${recommendations.length}
        High Priority: ${highPriorityRecommendations.length}
        Medium Priority: ${mediumPriorityRecommendations.length}
        Low Priority: ${recommendations.length - highPriorityRecommendations.length - mediumPriorityRecommendations.length}
      `);

      // Save recommendations for implementation
      await performanceUtils.saveOptimizationRecommendations(recommendations);
    });
  });
});

// Helper functions for memory analysis
function analyzeMemoryTrend(snapshots: MemorySnapshot[]): {
  isLinearGrowth: boolean;
  stabilityScore: number;
  growthRate: number;
} {
  if (snapshots.length < 3) {
    return { isLinearGrowth: false, stabilityScore: 1, growthRate: 0 };
  }

  const memoryValues = snapshots.map(s => s.heapUsed);
  const times = snapshots.map(s => s.timestamp);
  
  // Calculate correlation coefficient for linear growth detection
  const correlation = calculateCorrelation(times, memoryValues);
  const isLinearGrowth = Math.abs(correlation) > 0.8;
  
  // Calculate stability score (lower variance = higher stability)
  const mean = memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;
  const variance = memoryValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / memoryValues.length;
  const stabilityScore = Math.max(0, 1 - (variance / Math.pow(mean, 2)));
  
  // Calculate growth rate (bytes per millisecond)
  const growthRate = (memoryValues[memoryValues.length - 1] - memoryValues[0]) / (times[times.length - 1] - times[0]);
  
  return { isLinearGrowth, stabilityScore, growthRate };
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  const sumYY = y.reduce((sum, val) => sum + val * val, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateGCEfficiency(snapshots: MemorySnapshot[]): number {
  if (snapshots.length < 2) return 1;
  
  let totalReclaimed = 0;
  let totalAllocated = 0;
  
  for (let i = 1; i < snapshots.length; i++) {
    const growth = snapshots[i].heapUsed - snapshots[i - 1].heapUsed;
    if (growth > 0) {
      totalAllocated += growth;
    } else {
      totalReclaimed += Math.abs(growth);
    }
  }
  
  return totalAllocated === 0 ? 1 : Math.min(1, totalReclaimed / totalAllocated);
}

function analyzeMemoryScaling(dataPoints: Array<{count: number, memory: number}>): {
  linearityScore: number;
  baseOverheadMB: number;
  perItemCostBytes: number;
} {
  if (dataPoints.length < 2) {
    return { linearityScore: 0, baseOverheadMB: 0, perItemCostBytes: 0 };
  }

  const counts = dataPoints.map(p => p.count);
  const memories = dataPoints.map(p => p.memory);
  
  // Linear regression to find base overhead and per-item cost
  const n = dataPoints.length;
  const sumX = counts.reduce((sum, val) => sum + val, 0);
  const sumY = memories.reduce((sum, val) => sum + val, 0);
  const sumXY = counts.reduce((sum, val, i) => sum + val * memories[i], 0);
  const sumXX = counts.reduce((sum, val) => sum + val * val, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared for linearity score
  const meanY = sumY / n;
  const totalSumSquares = memories.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
  const residualSumSquares = memories.reduce((sum, val, i) => {
    const predicted = slope * counts[i] + intercept;
    return sum + Math.pow(val - predicted, 2);
  }, 0);
  
  const rSquared = 1 - (residualSumSquares / totalSumSquares);
  
  return {
    linearityScore: Math.max(0, rSquared),
    baseOverheadMB: Math.max(0, intercept),
    perItemCostBytes: slope * 1024 * 1024 // Convert MB to bytes
  };
}