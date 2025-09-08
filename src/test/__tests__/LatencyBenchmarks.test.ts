/**
 * Latency Benchmarking Suite - Task TE-003
 * 
 * Comprehensive latency analysis and benchmarking for high-frequency trading.
 * Provides statistical analysis of latency distributions across all system components.
 * 
 * Features:
 * - Sub-millisecond precision timing
 * - Statistical distribution analysis (percentiles, histograms)
 * - Latency profiling under various load conditions
 * - Comparative benchmarking against industry standards
 * - Automated latency regression detection
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { MockDataGenerator } from '../MockDataGenerator';
import { TestingFramework } from '../TestingFramework';

interface LatencyBenchmark {
  operation: string;
  samples: number[];
  statistics: LatencyStatistics;
  requirements: {
    averageMs: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
  };
}

interface LatencyStatistics {
  average: number;
  median: number;
  p95: number;
  p99: number;
  p999: number;
  min: number;
  max: number;
  stdDev: number;
  histogram: Map<number, number>;
}

describe('Latency Benchmarking Suite', () => {
  let performanceUtils: PerformanceTestUtils;
  let benchmarks: Map<string, LatencyBenchmark> = new Map();

  beforeAll(() => {
    performanceUtils = new PerformanceTestUtils();
    performanceUtils.initialize();
  });

  afterEach(() => {
    performanceUtils.cleanup();
  });

  describe('Core System Latency Benchmarks', () => {
    test('Order processing latency distribution analysis', async () => {
      const sampleCount = 10000;
      const latencies: number[] = [];
      
      console.log('Collecting order processing latency samples...');

      for (let i = 0; i < sampleCount; i++) {
        const order = MockDataGenerator.generateOrders({ count: 1 })[0];
        
        const latency = await performanceUtils.measureMicrosecondLatency(async () => {
          return performanceUtils.simulateOrderProcessing(order);
        });
        
        latencies.push(latency);

        // Log progress every 1000 samples
        if ((i + 1) % 1000 === 0) {
          console.log(`  Processed ${i + 1}/${sampleCount} samples`);
        }
      }

      const stats = performanceUtils.calculateLatencyStatistics(latencies);
      const benchmark: LatencyBenchmark = {
        operation: 'order_processing',
        samples: latencies,
        statistics: stats,
        requirements: {
          averageMs: 0.5,  // Sub-millisecond average
          p95Ms: 1.0,      // 95% under 1ms
          p99Ms: 2.0,      // 99% under 2ms  
          maxMs: 10.0      // Maximum 10ms
        }
      };

      benchmarks.set('order_processing', benchmark);

      // Validate against HFT requirements
      expect(stats.average).toBeLessThan(benchmark.requirements.averageMs,
        `Order processing average latency: ${stats.average.toFixed(3)}ms (requirement: <${benchmark.requirements.averageMs}ms)`);
      expect(stats.p95).toBeLessThan(benchmark.requirements.p95Ms,
        `Order processing P95 latency: ${stats.p95.toFixed(3)}ms (requirement: <${benchmark.requirements.p95Ms}ms)`);
      expect(stats.p99).toBeLessThan(benchmark.requirements.p99Ms,
        `Order processing P99 latency: ${stats.p99.toFixed(3)}ms (requirement: <${benchmark.requirements.p99Ms}ms)`);

      console.log(`Order Processing Latency Analysis:
        Samples: ${sampleCount.toLocaleString()}
        Average: ${stats.average.toFixed(3)}ms (±${stats.stdDev.toFixed(3)}ms)
        Median: ${stats.median.toFixed(3)}ms
        P95: ${stats.p95.toFixed(3)}ms
        P99: ${stats.p99.toFixed(3)}ms  
        P99.9: ${stats.p999.toFixed(3)}ms
        Min: ${stats.min.toFixed(3)}ms
        Max: ${stats.max.toFixed(3)}ms
        
        Latency Distribution:
${generateLatencyHistogramString(stats.histogram)}
      `);
    });

    test('Market data processing latency under varying loads', async () => {
      const loadLevels = [100, 500, 1000, 2000, 5000]; // ticks per second
      const testDurationMs = 5000; // 5 second test per load level

      for (const ticksPerSecond of loadLevels) {
        console.log(`Testing market data processing at ${ticksPerSecond} ticks/sec...`);
        
        const latencies: number[] = [];
        const startTime = performance.now();
        let processedTicks = 0;

        while (performance.now() - startTime < testDurationMs) {
          const tick = MockDataGenerator.generateMarketTick();
          
          const latency = await performanceUtils.measureMicrosecondLatency(async () => {
            return performanceUtils.processMarketDataTick(tick);
          });
          
          latencies.push(latency);
          processedTicks++;
          
          // Maintain tick rate
          const expectedInterval = 1000 / ticksPerSecond;
          await new Promise(resolve => setTimeout(resolve, expectedInterval));
        }

        const stats = performanceUtils.calculateLatencyStatistics(latencies);
        const actualTickRate = (processedTicks / testDurationMs) * 1000;

        console.log(`Market Data Processing (${ticksPerSecond} ticks/sec):
          Actual Rate: ${actualTickRate.toFixed(0)} ticks/sec
          Processed: ${processedTicks.toLocaleString()} ticks
          Average Latency: ${stats.average.toFixed(3)}ms
          P95 Latency: ${stats.p95.toFixed(3)}ms
          P99 Latency: ${stats.p99.toFixed(3)}ms
          Max Latency: ${stats.max.toFixed(3)}ms
        `);

        // Market data processing requirements scale with load
        const baseRequirement = 0.2; // 0.2ms base requirement
        const loadFactor = Math.log10(ticksPerSecond / 100); // Logarithmic scaling
        const scaledRequirement = baseRequirement * (1 + loadFactor * 0.5);

        expect(stats.average).toBeLessThan(scaledRequirement,
          `Market data processing average latency at ${ticksPerSecond} ticks/sec: ${stats.average.toFixed(3)}ms (requirement: <${scaledRequirement.toFixed(3)}ms)`);
        expect(actualTickRate).toBeGreaterThan(ticksPerSecond * 0.95,
          `Must process at least 95% of expected tick rate`);
      }
    });

    test('Strategy execution latency profiling', async () => {
      const strategyComplexities = ['simple', 'medium', 'complex', 'ml_enhanced'];
      const sampleSize = 1000;

      for (const complexity of strategyComplexities) {
        console.log(`Profiling ${complexity} strategy execution latency...`);
        
        const latencies: number[] = [];

        for (let i = 0; i < sampleSize; i++) {
          const context = MockDataGenerator.generateStrategyContext({
            complexity,
            indicatorCount: complexity === 'simple' ? 2 : complexity === 'medium' ? 5 : 8,
            dataPoints: 100
          });

          const latency = await performanceUtils.measureMicrosecondLatency(async () => {
            return performanceUtils.executeStrategy(context);
          });

          latencies.push(latency);
        }

        const stats = performanceUtils.calculateLatencyStatistics(latencies);
        
        // Strategy execution requirements vary by complexity
        const requirements = {
          simple: { avg: 5, p95: 10, p99: 20 },
          medium: { avg: 15, p95: 30, p99: 50 },
          complex: { avg: 30, p95: 60, p99: 100 },
          ml_enhanced: { avg: 50, p95: 100, p99: 200 }
        }[complexity] || { avg: 50, p95: 100, p99: 200 };

        expect(stats.average).toBeLessThan(requirements.avg,
          `${complexity} strategy execution average: ${stats.average.toFixed(2)}ms (requirement: <${requirements.avg}ms)`);
        expect(stats.p95).toBeLessThan(requirements.p95,
          `${complexity} strategy execution P95: ${stats.p95.toFixed(2)}ms (requirement: <${requirements.p95}ms)`);
        expect(stats.p99).toBeLessThan(requirements.p99,
          `${complexity} strategy execution P99: ${stats.p99.toFixed(2)}ms (requirement: <${requirements.p99}ms)`);

        console.log(`${complexity.toUpperCase()} Strategy Execution Latency:
          Average: ${stats.average.toFixed(2)}ms
          Median: ${stats.median.toFixed(2)}ms
          P95: ${stats.p95.toFixed(2)}ms
          P99: ${stats.p99.toFixed(2)}ms
          Max: ${stats.max.toFixed(2)}ms
        `);

        benchmarks.set(`strategy_${complexity}`, {
          operation: `strategy_execution_${complexity}`,
          samples: latencies,
          statistics: stats,
          requirements: {
            averageMs: requirements.avg,
            p95Ms: requirements.p95,
            p99Ms: requirements.p99,
            maxMs: requirements.p99 * 2
          }
        });
      }
    });

    test('Database query latency across operation types', async () => {
      const queryTypes = [
        { name: 'simple_select', complexity: 'low', expectedMs: 1 },
        { name: 'join_query', complexity: 'medium', expectedMs: 5 },
        { name: 'aggregation', complexity: 'high', expectedMs: 10 },
        { name: 'time_series', complexity: 'medium', expectedMs: 3 },
        { name: 'insert_batch', complexity: 'low', expectedMs: 2 }
      ];

      for (const queryType of queryTypes) {
        console.log(`Benchmarking ${queryType.name} database operations...`);
        
        const latencies: number[] = [];
        const sampleSize = 500;

        for (let i = 0; i < sampleSize; i++) {
          const query = MockDataGenerator.generateDatabaseQuery(queryType.name);
          
          const latency = await performanceUtils.measureMicrosecondLatency(async () => {
            return performanceUtils.executeDatabaseQuery(query);
          });

          latencies.push(latency);
        }

        const stats = performanceUtils.calculateLatencyStatistics(latencies);

        expect(stats.average).toBeLessThan(queryType.expectedMs,
          `${queryType.name} average latency: ${stats.average.toFixed(2)}ms (requirement: <${queryType.expectedMs}ms)`);

        console.log(`${queryType.name.toUpperCase()} Query Latency:
          Average: ${stats.average.toFixed(2)}ms
          P95: ${stats.p95.toFixed(2)}ms
          P99: ${stats.p99.toFixed(2)}ms
        `);
      }
    });
  });

  describe('Network and API Latency Benchmarks', () => {
    test('Exchange API response time analysis', async () => {
      const exchanges = ['binance', 'coinbase', 'kraken', 'bybit'];
      const apiEndpoints = ['ticker', 'orderbook', 'trades', 'account'];

      for (const exchange of exchanges) {
        for (const endpoint of apiEndpoints) {
          console.log(`Benchmarking ${exchange} ${endpoint} API latency...`);
          
          const latencies: number[] = [];
          const sampleSize = 100;

          for (let i = 0; i < sampleSize; i++) {
            const latency = await performanceUtils.measureMicrosecondLatency(async () => {
              return performanceUtils.simulateExchangeAPICall(exchange, endpoint);
            });

            latencies.push(latency);
            
            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const stats = performanceUtils.calculateLatencyStatistics(latencies);
          
          // API requirements vary by endpoint criticality
          const criticalEndpoints = ['ticker', 'orderbook'];
          const requirement = criticalEndpoints.includes(endpoint) ? 100 : 200;

          expect(stats.average).toBeLessThan(requirement,
            `${exchange} ${endpoint} API average latency: ${stats.average.toFixed(0)}ms (requirement: <${requirement}ms)`);

          console.log(`${exchange.toUpperCase()} ${endpoint} API:
            Average: ${stats.average.toFixed(0)}ms
            P95: ${stats.p95.toFixed(0)}ms
            Min: ${stats.min.toFixed(0)}ms
            Max: ${stats.max.toFixed(0)}ms
          `);
        }
      }
    });

    test('WebSocket message processing latency', async () => {
      const messageTypes = ['price_update', 'order_update', 'trade_execution', 'account_change'];
      const messageRates = [10, 50, 100, 500]; // messages per second

      for (const messageType of messageTypes) {
        for (const messageRate of messageRates) {
          console.log(`Testing ${messageType} WebSocket processing at ${messageRate} msgs/sec...`);
          
          const latencies: number[] = [];
          const testDuration = 5000; // 5 seconds
          const startTime = performance.now();
          let messagesProcessed = 0;

          while (performance.now() - startTime < testDuration) {
            const message = MockDataGenerator.generateWebSocketMessage(messageType);
            
            const latency = await performanceUtils.measureMicrosecondLatency(async () => {
              return performanceUtils.processWebSocketMessage(message);
            });

            latencies.push(latency);
            messagesProcessed++;
            
            await new Promise(resolve => setTimeout(resolve, 1000 / messageRate));
          }

          const stats = performanceUtils.calculateLatencyStatistics(latencies);
          const actualRate = (messagesProcessed / testDuration) * 1000;

          // WebSocket processing must be very fast
          expect(stats.average).toBeLessThan(5,
            `${messageType} WebSocket processing average: ${stats.average.toFixed(2)}ms (requirement: <5ms)`);
          expect(actualRate).toBeGreaterThan(messageRate * 0.9,
            `Must process at least 90% of WebSocket messages`);

          console.log(`${messageType} @ ${messageRate}/sec:
            Processed: ${messagesProcessed} msgs (${actualRate.toFixed(0)}/sec)
            Avg Latency: ${stats.average.toFixed(2)}ms
            P95 Latency: ${stats.p95.toFixed(2)}ms
          `);
        }
      }
    });
  });

  describe('Comparative Benchmarking', () => {
    test('Industry standard latency comparison', async () => {
      // Industry benchmarks for HFT systems (in milliseconds)
      const industryStandards = {
        order_processing: { average: 0.1, p95: 0.5, p99: 1.0 },
        market_data: { average: 0.05, p95: 0.2, p99: 0.5 },
        strategy_execution: { average: 1.0, p95: 5.0, p99: 10.0 },
        risk_check: { average: 0.2, p95: 1.0, p99: 2.0 }
      };

      console.log('Comparing system performance against industry standards...');

      for (const [operation, standards] of Object.entries(industryStandards)) {
        const benchmark = benchmarks.get(operation);
        
        if (benchmark) {
          const stats = benchmark.statistics;
          
          const averageRatio = stats.average / standards.average;
          const p95Ratio = stats.p95 / standards.p95;
          const p99Ratio = stats.p99 / standards.p99;

          console.log(`${operation.toUpperCase()} vs Industry Standards:
            Average: ${stats.average.toFixed(3)}ms vs ${standards.average}ms (${averageRatio.toFixed(1)}x)
            P95: ${stats.p95.toFixed(3)}ms vs ${standards.p95}ms (${p95Ratio.toFixed(1)}x)
            P99: ${stats.p99.toFixed(3)}ms vs ${standards.p99}ms (${p99Ratio.toFixed(1)}x)
            Rating: ${getRatingFromRatio(Math.max(averageRatio, p95Ratio, p99Ratio))}
          `);

          // We should be competitive with industry standards (within 2x)
          expect(averageRatio).toBeLessThan(2,
            `${operation} average latency should be within 2x of industry standard`);
          expect(p95Ratio).toBeLessThan(3,
            `${operation} P95 latency should be within 3x of industry standard`);
        }
      }
    });

    test('Latency regression detection over time', async () => {
      console.log('Running latency regression detection...');

      // Load historical benchmarks (simulation)
      const historicalBenchmarks = await performanceUtils.loadHistoricalLatencyBenchmarks();
      
      // Compare current benchmarks with historical data
      const regressions: Array<{
        operation: string;
        currentMs: number;
        historicalMs: number;
        regressionPercent: number;
      }> = [];

      for (const [operation, currentBenchmark] of benchmarks.entries()) {
        const historical = historicalBenchmarks.get(operation);
        
        if (historical) {
          const currentAvg = currentBenchmark.statistics.average;
          const historicalAvg = historical.average;
          const regressionPercent = ((currentAvg - historicalAvg) / historicalAvg) * 100;

          if (regressionPercent > 10) { // More than 10% regression
            regressions.push({
              operation,
              currentMs: currentAvg,
              historicalMs: historicalAvg,
              regressionPercent
            });
          }

          console.log(`${operation} Regression Analysis:
            Current: ${currentAvg.toFixed(3)}ms
            Historical: ${historicalAvg.toFixed(3)}ms
            Change: ${regressionPercent > 0 ? '+' : ''}${regressionPercent.toFixed(1)}%
          `);
        }
      }

      if (regressions.length > 0) {
        console.warn('Performance Regressions Detected:');
        regressions.forEach(r => {
          console.warn(`  ${r.operation}: ${r.regressionPercent.toFixed(1)}% slower`);
        });
      }

      // No significant regressions should be present
      expect(regressions.length).toBe(0,
        'No latency regressions > 10% should be detected');

      // Update historical benchmarks for future comparisons
      await performanceUtils.saveLatencyBenchmarks(benchmarks);
    });
  });

  describe('Latency Distribution Analysis', () => {
    test('Identify latency outliers and patterns', async () => {
      console.log('Analyzing latency distributions for patterns and outliers...');

      for (const [operation, benchmark] of benchmarks.entries()) {
        const samples = benchmark.samples;
        const stats = benchmark.statistics;
        
        // Identify outliers (values > P99.9)
        const outliers = samples.filter(sample => sample > stats.p999);
        const outlierRate = (outliers.length / samples.length) * 100;

        // Calculate coefficient of variation (consistency measure)
        const coefficientOfVariation = stats.stdDev / stats.average;

        // Analyze distribution shape
        const skewness = calculateSkewness(samples);
        const kurtosis = calculateKurtosis(samples);

        console.log(`${operation.toUpperCase()} Distribution Analysis:
          Sample Size: ${samples.length.toLocaleString()}
          Outliers (>P99.9): ${outliers.length} (${outlierRate.toFixed(2)}%)
          Coefficient of Variation: ${coefficientOfVariation.toFixed(3)}
          Skewness: ${skewness.toFixed(3)} (${skewness > 0 ? 'right-tailed' : 'left-tailed'})
          Kurtosis: ${kurtosis.toFixed(3)} (${kurtosis > 3 ? 'heavy-tailed' : 'light-tailed'})
          Distribution Type: ${classifyDistribution(skewness, kurtosis)}
        `);

        // Performance characteristics should be consistent
        expect(outlierRate).toBeLessThan(0.1,
          `Outlier rate for ${operation} should be <0.1%`);
        expect(coefficientOfVariation).toBeLessThan(1,
          `Latency should be consistent for ${operation} (CV < 1)`);
      }
    });

    test('Generate comprehensive latency report', async () => {
      console.log('Generating comprehensive latency benchmark report...');

      const report = {
        timestamp: new Date().toISOString(),
        testConfiguration: {
          sampleSizes: 'Variable (100-10,000 per operation)',
          testDuration: '30+ minutes total',
          loadLevels: 'Low to High (100-5,000 ops/sec)',
          precision: 'Microsecond-level timing'
        },
        summary: {
          totalOperationsTested: benchmarks.size,
          totalSamples: Array.from(benchmarks.values())
            .reduce((sum, b) => sum + b.samples.length, 0),
          overallRating: 'PASS', // This would be calculated based on results
        },
        benchmarks: Array.from(benchmarks.entries()).map(([operation, benchmark]) => ({
          operation,
          requirements: benchmark.requirements,
          results: benchmark.statistics,
          status: validateBenchmark(benchmark) ? 'PASS' : 'FAIL'
        })),
        recommendations: generateOptimizationRecommendations(benchmarks)
      };

      // Save report for documentation and trend analysis
      await performanceUtils.saveLatencyReport(report);

      console.log(`Latency Benchmark Report Generated:
        Operations Tested: ${report.summary.totalOperationsTested}
        Total Samples: ${report.summary.totalSamples.toLocaleString()}
        Overall Status: ${report.summary.overallRating}
        
        Performance Summary:
${report.benchmarks.map(b => 
  `          ${b.operation}: ${b.status} (avg: ${b.results.average.toFixed(2)}ms)`
).join('\n')}
      `);

      // All critical benchmarks must pass
      const failedBenchmarks = report.benchmarks.filter(b => b.status === 'FAIL');
      expect(failedBenchmarks).toHaveLength(0,
        'All latency benchmarks must meet requirements');
    });
  });
});

// Helper functions
function generateLatencyHistogramString(histogram: Map<number, number>): string {
  const sortedBins = Array.from(histogram.entries()).sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(...sortedBins.map(([, count]) => count));
  
  return sortedBins.slice(0, 10).map(([binStart, count]) => {
    const percentage = (count / maxCount) * 100;
    const barLength = Math.round(percentage / 5);
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    return `        ${binStart.toFixed(1)}ms: ${bar} ${count}`;
  }).join('\n');
}

function getRatingFromRatio(ratio: number): string {
  if (ratio <= 1) return 'EXCELLENT';
  if (ratio <= 1.5) return 'GOOD';
  if (ratio <= 2) return 'ACCEPTABLE';
  if (ratio <= 3) return 'POOR';
  return 'UNACCEPTABLE';
}

function calculateSkewness(data: number[]): number {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  const skewness = data.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / data.length;
  return skewness;
}

function calculateKurtosis(data: number[]): number {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  const kurtosis = data.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / data.length;
  return kurtosis;
}

function classifyDistribution(skewness: number, kurtosis: number): string {
  if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis - 3) < 0.5) {
    return 'Normal';
  } else if (skewness > 1) {
    return 'Right-skewed (Long tail of slow responses)';
  } else if (skewness < -1) {
    return 'Left-skewed (Consistently fast)';
  } else if (kurtosis > 4) {
    return 'Heavy-tailed (Many outliers)';
  } else {
    return 'Non-normal';
  }
}

function validateBenchmark(benchmark: LatencyBenchmark): boolean {
  const stats = benchmark.statistics;
  const req = benchmark.requirements;
  
  return stats.average < req.averageMs &&
         stats.p95 < req.p95Ms &&
         stats.p99 < req.p99Ms &&
         stats.max < req.maxMs;
}

function generateOptimizationRecommendations(benchmarks: Map<string, LatencyBenchmark>): string[] {
  const recommendations: string[] = [];
  
  for (const [operation, benchmark] of benchmarks.entries()) {
    const stats = benchmark.statistics;
    const req = benchmark.requirements;
    
    if (stats.average > req.averageMs * 0.8) {
      recommendations.push(`Optimize ${operation} - approaching latency limit`);
    }
    
    if (stats.stdDev > stats.average * 0.5) {
      recommendations.push(`Improve ${operation} consistency - high variance detected`);
    }
    
    if (stats.max > req.maxMs * 2) {
      recommendations.push(`Investigate ${operation} outliers - extreme latency spikes detected`);
    }
  }
  
  return recommendations;
}