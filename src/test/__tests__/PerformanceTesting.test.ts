/**
 * Comprehensive Performance Testing Suite - Task TE-003
 * 
 * Advanced performance testing for production-ready algorithmic trading platform.
 * Tests all Phase 4 systems with institutional-grade performance requirements.
 * 
 * Key Performance Areas:
 * - HFT Engine: Sub-1ms latency validation
 * - Multi-Exchange: Cross-exchange arbitrage performance
 * - ML Optimization: Genetic algorithm performance scaling
 * - Professional UI: 60fps rendering under load
 * - Order Management: 10,000+ orders per second capacity
 * - Market Data: Real-time processing of high-frequency feeds
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { MockDataGenerator } from '../MockDataGenerator';
import { TestingFramework } from '../TestingFramework';

describe('Performance Testing Suite - Phase 4 Validation', () => {
  let performanceUtils: PerformanceTestUtils;

  beforeAll(() => {
    performanceUtils = new PerformanceTestUtils();
    performanceUtils.initialize();
  });

  afterEach(() => {
    // Clean up after each test to prevent memory leaks
    performanceUtils.cleanup();
  });

  describe('HFT Engine Performance', () => {
    test('Sub-1ms latency validation for order processing', async () => {
      const orderCount = 10000;
      const latencies: number[] = [];
      
      // Generate realistic order data
      const orders = MockDataGenerator.generateOrders({
        count: orderCount,
        symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD']
      });

      for (const order of orders.slice(0, 1000)) { // Test with 1000 orders
        const latency = await performanceUtils.measureLatency(async () => {
          // Simulate HFT order processing
          return performanceUtils.simulateOrderProcessing(order);
        });
        
        latencies.push(latency);
      }

      const stats = performanceUtils.calculateLatencyStatistics(latencies);
      
      // HFT Requirements: Sub-1ms average, <5ms p99
      expect(stats.average).toBeLessThan(1, 'Average latency must be <1ms for HFT');
      expect(stats.p95).toBeLessThan(2, 'P95 latency must be <2ms for HFT');
      expect(stats.p99).toBeLessThan(5, 'P99 latency must be <5ms for HFT');
      expect(stats.max).toBeLessThan(10, 'Max latency must be <10ms for HFT');

      console.log(`HFT Latency Statistics:
        Average: ${stats.average.toFixed(3)}ms
        Median: ${stats.median.toFixed(3)}ms
        P95: ${stats.p95.toFixed(3)}ms
        P99: ${stats.p99.toFixed(3)}ms
        Max: ${stats.max.toFixed(3)}ms
        Min: ${stats.min.toFixed(3)}ms
        Standard Deviation: ${stats.stdDev.toFixed(3)}ms
      `);
    });

    test('Order throughput capacity validation (10,000+ orders/sec)', async () => {
      const targetThroughput = 10000; // orders per second
      const testDurationMs = 1000; // 1 second test
      
      const orders = MockDataGenerator.generateOrders({
        count: targetThroughput * 2, // Generate extra orders for buffer
        symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD']
      });

      let processedOrders = 0;
      const startTime = performance.now();
      
      const processingPromises = orders.map(order => 
        performanceUtils.simulateOrderProcessing(order)
          .then(() => processedOrders++)
          .catch(() => {}) // Ignore errors for throughput test
      );

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDurationMs));
      
      const elapsedTime = performance.now() - startTime;
      const actualThroughput = (processedOrders / elapsedTime) * 1000;

      expect(actualThroughput).toBeGreaterThan(targetThroughput, 
        `Order throughput must exceed ${targetThroughput} orders/sec`);

      console.log(`Order Throughput Performance:
        Processed Orders: ${processedOrders}
        Elapsed Time: ${elapsedTime.toFixed(2)}ms
        Throughput: ${actualThroughput.toFixed(0)} orders/sec
        Target: ${targetThroughput} orders/sec
      `);

      // Clean up remaining promises
      await Promise.allSettled(processingPromises);
    });

    test('Market data processing latency under high load', async () => {
      const feedRate = 1000; // ticks per second
      const testDuration = 5000; // 5 seconds
      const tickLatencies: number[] = [];

      const marketDataGenerator = performanceUtils.createHighFrequencyMarketDataGenerator({
        symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
        ticksPerSecond: feedRate,
        priceVolatility: 0.001
      });

      const processingPromises: Promise<void>[] = [];
      let processedTicks = 0;

      const startTime = performance.now();
      
      // Simulate high-frequency market data processing
      while (performance.now() - startTime < testDuration) {
        const tick = marketDataGenerator.generateTick();
        
        const promise = performanceUtils.measureLatency(async () => {
          return performanceUtils.processMarketDataTick(tick);
        }).then(latency => {
          tickLatencies.push(latency);
          processedTicks++;
        });

        processingPromises.push(promise);
        
        // Simulate tick rate
        await new Promise(resolve => setTimeout(resolve, 1000 / feedRate));
      }

      await Promise.allSettled(processingPromises);
      
      const stats = performanceUtils.calculateLatencyStatistics(tickLatencies);
      const actualFeedRate = (processedTicks / testDuration) * 1000;

      // Market data processing requirements
      expect(stats.average).toBeLessThan(0.5, 'Market data processing must be <0.5ms average');
      expect(stats.p99).toBeLessThan(2, 'Market data processing must be <2ms p99');
      expect(actualFeedRate).toBeGreaterThan(feedRate * 0.95, 'Must process >95% of market data ticks');

      console.log(`Market Data Processing Performance:
        Processed Ticks: ${processedTicks}
        Feed Rate: ${actualFeedRate.toFixed(0)} ticks/sec
        Average Latency: ${stats.average.toFixed(3)}ms
        P99 Latency: ${stats.p99.toFixed(3)}ms
      `);
    });
  });

  describe('Multi-Exchange Integration Performance', () => {
    test('Cross-exchange arbitrage detection speed', async () => {
      const exchanges = ['binance', 'coinbase', 'kraken', 'bybit', 'okx'];
      const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
      const detectionLatencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        // Generate price differences across exchanges
        const exchangePrices = performanceUtils.generateCrossExchangePrices({
          exchanges,
          symbols,
          arbitrageOpportunity: Math.random() > 0.7 // 30% chance of arbitrage
        });

        const latency = await performanceUtils.measureLatency(async () => {
          return performanceUtils.detectArbitrageOpportunities(exchangePrices);
        });

        detectionLatencies.push(latency);
      }

      const stats = performanceUtils.calculateLatencyStatistics(detectionLatencies);

      // Arbitrage detection must be extremely fast
      expect(stats.average).toBeLessThan(5, 'Arbitrage detection must average <5ms');
      expect(stats.p95).toBeLessThan(10, 'Arbitrage detection must be <10ms p95');

      console.log(`Arbitrage Detection Performance:
        Average: ${stats.average.toFixed(3)}ms
        P95: ${stats.p95.toFixed(3)}ms
        Max: ${stats.max.toFixed(3)}ms
      `);
    });

    test('Multi-exchange order routing performance', async () => {
      const routingLatencies: number[] = [];
      const orders = MockDataGenerator.generateOrders({
        count: 500,
        symbols: ['BTC-USD', 'ETH-USD']
      });

      for (const order of orders) {
        const latency = await performanceUtils.measureLatency(async () => {
          return performanceUtils.routeOrderToOptimalExchange(order);
        });

        routingLatencies.push(latency);
      }

      const stats = performanceUtils.calculateLatencyStatistics(routingLatencies);

      // Order routing performance requirements
      expect(stats.average).toBeLessThan(10, 'Order routing must average <10ms');
      expect(stats.p99).toBeLessThan(50, 'Order routing must be <50ms p99');

      console.log(`Order Routing Performance:
        Average: ${stats.average.toFixed(3)}ms
        P99: ${stats.p99.toFixed(3)}ms
      `);
    });

    test('Exchange failover and recovery performance', async () => {
      const failoverLatencies: number[] = [];
      const exchanges = ['primary', 'secondary', 'tertiary'];

      for (let i = 0; i < 20; i++) {
        const latency = await performanceUtils.measureLatency(async () => {
          // Simulate exchange failover scenario
          const primaryExchange = exchanges[0];
          const backupExchange = exchanges[1];
          
          return performanceUtils.simulateExchangeFailover({
            from: primaryExchange,
            to: backupExchange,
            activeOrders: Math.floor(Math.random() * 100)
          });
        });

        failoverLatencies.push(latency);
      }

      const stats = performanceUtils.calculateLatencyStatistics(failoverLatencies);

      // Failover must complete quickly to minimize trading disruption
      expect(stats.average).toBeLessThan(1000, 'Exchange failover must average <1000ms');
      expect(stats.max).toBeLessThan(5000, 'Exchange failover must complete within 5 seconds');

      console.log(`Exchange Failover Performance:
        Average: ${stats.average.toFixed(0)}ms
        Max: ${stats.max.toFixed(0)}ms
      `);
    });
  });

  describe('ML Optimization Performance', () => {
    test('Genetic algorithm parameter optimization scaling', async () => {
      const populationSizes = [50, 100, 200, 500];
      const generations = 20;
      
      for (const populationSize of populationSizes) {
        const optimizationTime = await performanceUtils.measureLatency(async () => {
          return performanceUtils.runGeneticOptimization({
            populationSize,
            generations,
            parameters: ['period', 'threshold', 'stopLoss', 'takeProfit'],
            evaluationFunction: 'sharpeRatio'
          });
        });

        // Ensure optimization scales reasonably with population size
        const timePerIndividual = optimizationTime / (populationSize * generations);
        expect(timePerIndividual).toBeLessThan(10, 
          `Genetic algorithm must process each individual in <10ms (Pop: ${populationSize})`);

        console.log(`Genetic Optimization (Pop: ${populationSize}):
          Total Time: ${optimizationTime.toFixed(0)}ms
          Time per Individual: ${timePerIndividual.toFixed(2)}ms
        `);
      }
    });

    test('ML feature computation performance at scale', async () => {
      const datasetSizes = [1000, 5000, 10000, 50000];
      const featureComputationTimes: number[] = [];

      for (const datasetSize of datasetSizes) {
        const dataset = MockDataGenerator.generateOHLCV({
          count: datasetSize,
          basePrice: 100,
          volatility: 0.02
        });

        const computationTime = await performanceUtils.measureLatency(async () => {
          return performanceUtils.computeMLFeatures({
            data: dataset,
            features: ['returns', 'volatility', 'momentum', 'meanReversion', 'volume'],
            lookbackWindows: [5, 10, 20, 50]
          });
        });

        featureComputationTimes.push(computationTime);

        // Feature computation should scale linearly
        const timePerDataPoint = computationTime / datasetSize;
        expect(timePerDataPoint).toBeLessThan(1, 
          `Feature computation must be <1ms per data point (Dataset: ${datasetSize})`);

        console.log(`ML Feature Computation (${datasetSize} points):
          Total Time: ${computationTime.toFixed(0)}ms
          Time per Point: ${timePerDataPoint.toFixed(3)}ms
        `);
      }

      // Verify scaling efficiency
      const scalingFactor = featureComputationTimes[3] / featureComputationTimes[0]; // 50k vs 1k
      const expectedScalingFactor = 50; // Linear scaling
      expect(scalingFactor).toBeLessThan(expectedScalingFactor * 2, 
        'Feature computation scaling must be near-linear');
    });

    test('Real-time prediction inference performance', async () => {
      const predictionLatencies: number[] = [];
      const batchSizes = [1, 10, 50, 100];

      for (const batchSize of batchSizes) {
        const features = MockDataGenerator.generateMLFeatures({
          count: batchSize,
          featureCount: 20
        });

        const inferenceTime = await performanceUtils.measureLatency(async () => {
          return performanceUtils.runMLInference({
            features,
            modelType: 'neuralNetwork',
            outputType: 'classification'
          });
        });

        predictionLatencies.push(inferenceTime);

        const timePerPrediction = inferenceTime / batchSize;
        
        // Real-time inference must be very fast
        expect(timePerPrediction).toBeLessThan(5, 
          `ML inference must be <5ms per prediction (Batch: ${batchSize})`);

        console.log(`ML Inference (Batch: ${batchSize}):
          Total Time: ${inferenceTime.toFixed(2)}ms
          Time per Prediction: ${timePerPrediction.toFixed(2)}ms
        `);
      }
    });
  });

  describe('Professional UI Performance', () => {
    test('60fps rendering under high data load', async () => {
      const frameRenderTimes: number[] = [];
      const targetFPS = 60;
      const maxFrameTime = 1000 / targetFPS; // 16.67ms per frame

      // Simulate high-frequency UI updates
      for (let frame = 0; frame < 300; frame++) { // 5 seconds at 60fps
        const renderTime = await performanceUtils.measureLatency(async () => {
          return performanceUtils.simulateUIFrameRender({
            activeCharts: 4,
            dataPoints: 1000,
            indicators: 8,
            realTimeUpdates: true,
            complexity: 'high'
          });
        });

        frameRenderTimes.push(renderTime);
      }

      const stats = performanceUtils.calculateLatencyStatistics(frameRenderTimes);
      const averageFPS = 1000 / stats.average;
      const framesOverBudget = frameRenderTimes.filter(time => time > maxFrameTime).length;
      const frameDropPercentage = (framesOverBudget / frameRenderTimes.length) * 100;

      // UI Performance Requirements
      expect(averageFPS).toBeGreaterThan(55, 'UI must maintain >55 average FPS');
      expect(frameDropPercentage).toBeLessThan(5, 'Frame drop percentage must be <5%');
      expect(stats.p95).toBeLessThan(maxFrameTime * 1.5, 'P95 frame time must be <25ms');

      console.log(`UI Rendering Performance:
        Average FPS: ${averageFPS.toFixed(1)}
        Frame Drop %: ${frameDropPercentage.toFixed(1)}%
        P95 Frame Time: ${stats.p95.toFixed(2)}ms
        Max Frame Time: ${stats.max.toFixed(2)}ms
      `);
    });

    test('Chart data processing and visualization performance', async () => {
      const dataSizes = [1000, 5000, 10000, 20000];
      const processingTimes: number[] = [];

      for (const dataSize of dataSizes) {
        const chartData = MockDataGenerator.generateOHLCV({
          count: dataSize,
          basePrice: 100,
          volatility: 0.02
        });

        const processingTime = await performanceUtils.measureLatency(async () => {
          return performanceUtils.processChartData({
            data: chartData,
            indicators: ['SMA20', 'EMA12', 'RSI14', 'MACD', 'BB'],
            overlays: ['volume', 'trades'],
            resolution: '1m'
          });
        });

        processingTimes.push(processingTime);

        // Chart processing should complete within reasonable time
        expect(processingTime).toBeLessThan(1000, 
          `Chart processing must complete within 1s (${dataSize} points)`);

        console.log(`Chart Processing (${dataSize} points): ${processingTime.toFixed(0)}ms`);
      }
    });

    test('Real-time data streaming and UI updates', async () => {
      const streamingLatencies: number[] = [];
      const updateFrequency = 10; // 10 updates per second
      const testDuration = 10000; // 10 seconds
      let updatesProcessed = 0;

      const startTime = performance.now();
      
      while (performance.now() - startTime < testDuration) {
        const updateLatency = await performanceUtils.measureLatency(async () => {
          const marketUpdate = MockDataGenerator.generateMarketUpdate();
          return performanceUtils.processRealtimeUIUpdate({
            update: marketUpdate,
            affectedComponents: ['price', 'volume', 'orderBook', 'trades'],
            subscribers: 50 // Simulate 50 active connections
          });
        });

        streamingLatencies.push(updateLatency);
        updatesProcessed++;
        
        await new Promise(resolve => setTimeout(resolve, 1000 / updateFrequency));
      }

      const stats = performanceUtils.calculateLatencyStatistics(streamingLatencies);
      const averageUpdateRate = (updatesProcessed / testDuration) * 1000;

      // Real-time update performance requirements
      expect(stats.average).toBeLessThan(50, 'Real-time updates must average <50ms');
      expect(stats.p99).toBeLessThan(200, 'Real-time updates must be <200ms p99');
      expect(averageUpdateRate).toBeGreaterThan(updateFrequency * 0.95, 
        'Must process >95% of real-time updates');

      console.log(`Real-time UI Updates Performance:
        Updates Processed: ${updatesProcessed}
        Update Rate: ${averageUpdateRate.toFixed(1)}/sec
        Average Latency: ${stats.average.toFixed(2)}ms
        P99 Latency: ${stats.p99.toFixed(2)}ms
      `);
    });
  });

  describe('System Integration Performance', () => {
    test('End-to-end trading pipeline performance', async () => {
      const pipelineLatencies: number[] = [];
      const tradingScenarios = MockDataGenerator.generateTradingScenarios({
        count: 100,
        complexity: 'high'
      });

      for (const scenario of tradingScenarios) {
        const pipelineLatency = await performanceUtils.measureLatency(async () => {
          // Simulate complete trading pipeline
          return performanceUtils.executeFullTradingPipeline({
            marketData: scenario.marketData,
            strategy: scenario.strategy,
            riskManagement: scenario.riskRules,
            orderExecution: scenario.executionSettings
          });
        });

        pipelineLatencies.push(pipelineLatency);
      }

      const stats = performanceUtils.calculateLatencyStatistics(pipelineLatencies);

      // End-to-end pipeline performance requirements
      expect(stats.average).toBeLessThan(100, 'Trading pipeline must average <100ms');
      expect(stats.p95).toBeLessThan(250, 'Trading pipeline must be <250ms p95');

      console.log(`Trading Pipeline Performance:
        Average: ${stats.average.toFixed(2)}ms
        P95: ${stats.p95.toFixed(2)}ms
        P99: ${stats.p99.toFixed(2)}ms
      `);
    });

    test('Concurrent user simulation and system stress', async () => {
      const concurrentUsers = [10, 25, 50, 100, 200];
      const systemStressResults: any[] = [];

      for (const userCount of concurrentUsers) {
        const stressTestResult = await performanceUtils.runConcurrentUserSimulation({
          userCount,
          duration: 30000, // 30 seconds
          actionsPerUser: [
            'viewDashboard',
            'executeStrategy',
            'placeOrders',
            'viewPortfolio',
            'analyzePerformance'
          ]
        });

        systemStressResults.push({
          userCount,
          ...stressTestResult
        });

        // System must remain responsive under concurrent load
        expect(stressTestResult.averageResponseTime).toBeLessThan(500,
          `System must respond within 500ms under ${userCount} concurrent users`);
        expect(stressTestResult.errorRate).toBeLessThan(1,
          `Error rate must be <1% under ${userCount} concurrent users`);

        console.log(`Concurrent Users (${userCount}):
          Avg Response: ${stressTestResult.averageResponseTime.toFixed(0)}ms
          Error Rate: ${stressTestResult.errorRate.toFixed(2)}%
          Throughput: ${stressTestResult.throughput.toFixed(0)} req/sec
        `);
      }

      // Verify system scales reasonably
      const lowLoadResponse = systemStressResults[0].averageResponseTime;
      const highLoadResponse = systemStressResults[systemStressResults.length - 1].averageResponseTime;
      const responseScalingFactor = highLoadResponse / lowLoadResponse;

      expect(responseScalingFactor).toBeLessThan(10,
        'Response time should not degrade more than 10x under maximum load');
    });
  });

  describe('Performance Regression Detection', () => {
    test('Automated performance baseline comparison', async () => {
      // Load historical performance baselines
      const baselines = await performanceUtils.loadPerformanceBaselines();
      const currentMetrics = await performanceUtils.collectCurrentPerformanceMetrics();

      const regressions = performanceUtils.detectPerformanceRegressions(baselines, currentMetrics);

      // Log any detected regressions
      if (regressions.length > 0) {
        console.warn('Performance Regressions Detected:');
        regressions.forEach(regression => {
          console.warn(`  ${regression.metric}: ${regression.degradation}% slower`);
        });
      }

      // Performance should not regress by more than 20% in any area
      const significantRegressions = regressions.filter(r => r.degradation > 20);
      expect(significantRegressions).toHaveLength(0,
        'No significant performance regressions should be present');

      // Update baselines with current metrics (for future comparisons)
      await performanceUtils.updatePerformanceBaselines(currentMetrics);
    });

    test('Memory leak detection and garbage collection analysis', async () => {
      const memoryMetrics = await performanceUtils.runMemoryLeakDetection({
        duration: 60000, // 1 minute
        iterations: 1000,
        operations: [
          'createStrategy',
          'processMarketData',
          'executeOrders',
          'calculateIndicators',
          'runBacktest'
        ]
      });

      // Memory usage should stabilize and not continuously grow
      expect(memoryMetrics.memoryGrowthRate).toBeLessThan(1, 
        'Memory growth rate must be <1MB/minute');
      expect(memoryMetrics.gcEfficiency).toBeGreaterThan(0.8,
        'Garbage collection efficiency must be >80%');

      console.log(`Memory Leak Analysis:
        Memory Growth Rate: ${memoryMetrics.memoryGrowthRate.toFixed(2)} MB/min
        GC Efficiency: ${(memoryMetrics.gcEfficiency * 100).toFixed(1)}%
        Peak Memory Usage: ${memoryMetrics.peakMemoryMB.toFixed(1)} MB
        Average Memory Usage: ${memoryMetrics.averageMemoryMB.toFixed(1)} MB
      `);
    });

    test('Performance bottleneck identification', async () => {
      const bottlenecks = await performanceUtils.identifyPerformanceBottlenecks({
        profilingDuration: 30000, // 30 seconds
        sampleRate: 100, // 100 Hz
        components: [
          'strategyEngine',
          'marketDataProcessor',
          'orderManager',
          'riskManager',
          'mlOptimizer',
          'databaseLayer'
        ]
      });

      // Report identified bottlenecks
      bottlenecks.forEach(bottleneck => {
        console.warn(`Performance Bottleneck Detected:
          Component: ${bottleneck.component}
          CPU Usage: ${bottleneck.cpuUsage.toFixed(1)}%
          Memory Usage: ${bottleneck.memoryUsage.toFixed(1)} MB
          Latency Impact: ${bottleneck.latencyImpact.toFixed(2)}ms
          Optimization Recommendation: ${bottleneck.recommendation}
        `);
      });

      // No component should consume excessive resources
      const criticalBottlenecks = bottlenecks.filter(b => 
        b.cpuUsage > 80 || b.memoryUsage > 1000 || b.latencyImpact > 100
      );
      
      expect(criticalBottlenecks).toHaveLength(0,
        'No critical performance bottlenecks should be present');
    });
  });
});