/**
 * Concurrency Testing Suite - Task TE-003
 * 
 * Comprehensive concurrent user simulation and stress testing for the trading platform.
 * Tests system behavior under high concurrent load with realistic trading patterns.
 * 
 * Features:
 * - Multi-user concurrent trading simulation
 * - Resource contention and deadlock detection
 * - Thread safety validation
 * - Connection pooling and rate limiting tests
 * - Distributed load testing capabilities
 * - Real-time performance monitoring under concurrent load
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { MockDataGenerator } from '../MockDataGenerator';
import { TestingFramework } from '../TestingFramework';

interface ConcurrentUser {
  id: string;
  actions: string[];
  responseTime: number[];
  errors: number;
  successfulActions: number;
  startTime: number;
  endTime: number;
}

interface ConcurrencyTestResult {
  userCount: number;
  duration: number;
  totalActions: number;
  successfulActions: number;
  totalErrors: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    connections: number;
  };
}

describe('Concurrency Testing Suite', () => {
  let performanceUtils: PerformanceTestUtils;

  beforeAll(() => {
    performanceUtils = new PerformanceTestUtils();
    performanceUtils.initialize();
  });

  afterEach(() => {
    performanceUtils.cleanup();
  });

  describe('Multi-User Trading Simulation', () => {
    test('Concurrent user scalability testing', async () => {
      const userCounts = [10, 25, 50, 100, 250, 500];
      const testDuration = 60000; // 1 minute per test
      const scalabilityResults: ConcurrencyTestResult[] = [];

      for (const userCount of userCounts) {
        console.log(`Testing concurrent scalability with ${userCount} users...`);

        const result = await performanceUtils.runConcurrentUserSimulation({
          userCount,
          duration: testDuration,
          userProfile: {
            actionsPerMinute: 60,
            actionDistribution: {
              viewDashboard: 0.3,
              placeOrder: 0.25,
              cancelOrder: 0.1,
              viewPortfolio: 0.2,
              runStrategy: 0.1,
              viewAnalytics: 0.05
            }
          }
        });

        scalabilityResults.push(result);

        console.log(`Concurrent Users (${userCount}) Results:
          Total Actions: ${result.totalActions.toLocaleString()}
          Successful Actions: ${result.successfulActions.toLocaleString()}
          Error Rate: ${result.errorRate.toFixed(2)}%
          Avg Response Time: ${result.averageResponseTime.toFixed(0)}ms
          P95 Response Time: ${result.p95ResponseTime.toFixed(0)}ms
          Throughput: ${result.throughput.toFixed(0)} actions/sec
          CPU Utilization: ${result.resourceUtilization.cpu.toFixed(1)}%
          Memory Usage: ${result.resourceUtilization.memory.toFixed(0)}MB
        `);

        // Performance requirements scale with user count
        const baseResponseTime = 100; // 100ms baseline
        const scalingFactor = Math.log10(userCount / 10 + 1); // Logarithmic scaling
        const maxAcceptableResponseTime = baseResponseTime * (1 + scalingFactor);

        expect(result.errorRate).toBeLessThan(1, `Error rate should be <1% for ${userCount} users`);
        expect(result.averageResponseTime).toBeLessThan(maxAcceptableResponseTime,
          `Average response time should be <${maxAcceptableResponseTime.toFixed(0)}ms for ${userCount} users`);
        expect(result.resourceUtilization.cpu).toBeLessThan(80,
          `CPU utilization should be <80% for ${userCount} users`);

        // Brief cooldown between tests
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Analyze scaling characteristics
      analyzeScalingCharacteristics(scalabilityResults);
    });

    test('High-frequency trading concurrent order processing', async () => {
      console.log('Testing HFT concurrent order processing...');
      
      const concurrentTraders = 50;
      const ordersPerTrader = 200;
      const testDuration = 30000; // 30 seconds
      
      const tradingResults = await performanceUtils.runConcurrentHFTSimulation({
        traderCount: concurrentTraders,
        ordersPerTrader,
        duration: testDuration,
        symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD'],
        orderTypes: ['market', 'limit', 'stopLoss', 'takeProfit'],
        latencyRequirement: 1 // 1ms max latency per order
      });

      console.log(`HFT Concurrent Processing Results:
        Concurrent Traders: ${concurrentTraders}
        Total Orders: ${tradingResults.totalOrders.toLocaleString()}
        Processed Orders: ${tradingResults.processedOrders.toLocaleString()}
        Rejected Orders: ${tradingResults.rejectedOrders.toLocaleString()}
        Order Processing Rate: ${tradingResults.orderProcessingRate.toFixed(0)} orders/sec
        Average Order Latency: ${tradingResults.averageOrderLatency.toFixed(3)}ms
        P95 Order Latency: ${tradingResults.p95OrderLatency.toFixed(3)}ms
        P99 Order Latency: ${tradingResults.p99OrderLatency.toFixed(3)}ms
        Success Rate: ${((tradingResults.processedOrders / tradingResults.totalOrders) * 100).toFixed(2)}%
      `);

      // HFT requirements are stringent
      expect(tradingResults.averageOrderLatency).toBeLessThan(1,
        'HFT average order latency must be <1ms');
      expect(tradingResults.p95OrderLatency).toBeLessThan(2,
        'HFT P95 order latency must be <2ms');
      expect(tradingResults.p99OrderLatency).toBeLessThan(5,
        'HFT P99 order latency must be <5ms');
      expect(tradingResults.orderProcessingRate).toBeGreaterThan(1000,
        'HFT system must process >1000 orders/sec');
      expect(tradingResults.processedOrders / tradingResults.totalOrders).toBeGreaterThan(0.99,
        'HFT success rate must be >99%');
    });

    test('Multi-strategy concurrent execution', async () => {
      console.log('Testing concurrent multi-strategy execution...');
      
      const strategies = [
        { name: 'EMA_Crossover', complexity: 'simple', users: 20 },
        { name: 'RSI_MeanReversion', complexity: 'medium', users: 15 },
        { name: 'MACD_Trend', complexity: 'medium', users: 15 },
        { name: 'ML_Enhanced', complexity: 'complex', users: 10 },
        { name: 'Arbitrage', complexity: 'complex', users: 5 }
      ];

      const strategyResults = await performanceUtils.runConcurrentStrategyExecution({
        strategies,
        duration: 120000, // 2 minutes
        marketConditions: 'volatile',
        dataFeedRate: 100 // ticks per second
      });

      for (const strategy of strategies) {
        const result = strategyResults[strategy.name];
        
        console.log(`${strategy.name} Strategy Results:
          Concurrent Users: ${strategy.users}
          Executions: ${result.executions.toLocaleString()}
          Successful Executions: ${result.successfulExecutions.toLocaleString()}
          Average Execution Time: ${result.averageExecutionTime.toFixed(2)}ms
          P95 Execution Time: ${result.p95ExecutionTime.toFixed(2)}ms
          Signals Generated: ${result.signalsGenerated.toLocaleString()}
          Orders Placed: ${result.ordersPlaced.toLocaleString()}
          Success Rate: ${((result.successfulExecutions / result.executions) * 100).toFixed(2)}%
        `);

        // Strategy execution requirements vary by complexity
        const complexityLimits = {
          simple: { avgTime: 10, p95Time: 25, successRate: 0.98 },
          medium: { avgTime: 30, p95Time: 75, successRate: 0.95 },
          complex: { avgTime: 100, p95Time: 250, successRate: 0.92 }
        };

        const limits = complexityLimits[strategy.complexity as keyof typeof complexityLimits];
        
        expect(result.averageExecutionTime).toBeLessThan(limits.avgTime,
          `${strategy.name} average execution time should be <${limits.avgTime}ms`);
        expect(result.p95ExecutionTime).toBeLessThan(limits.p95Time,
          `${strategy.name} P95 execution time should be <${limits.p95Time}ms`);
        expect(result.successfulExecutions / result.executions).toBeGreaterThan(limits.successRate,
          `${strategy.name} success rate should be >${(limits.successRate * 100).toFixed(0)}%`);
      }
    });
  });

  describe('Resource Contention Testing', () => {
    test('Database connection pool stress testing', async () => {
      console.log('Testing database connection pool under stress...');
      
      const connectionPoolSizes = [10, 25, 50, 100];
      const concurrentQueries = 200;
      
      for (const poolSize of connectionPoolSizes) {
        console.log(`Testing connection pool size: ${poolSize}`);
        
        const poolResult = await performanceUtils.testDatabaseConnectionPool({
          poolSize,
          concurrentQueries,
          queryTypes: [
            { type: 'select', weight: 0.6, avgTimeMs: 10 },
            { type: 'insert', weight: 0.25, avgTimeMs: 15 },
            { type: 'update', weight: 0.1, avgTimeMs: 20 },
            { type: 'complex_join', weight: 0.05, avgTimeMs: 50 }
          ],
          duration: 30000 // 30 seconds
        });

        console.log(`Connection Pool (Size: ${poolSize}) Results:
          Concurrent Queries: ${concurrentQueries}
          Completed Queries: ${poolResult.completedQueries.toLocaleString()}
          Failed Queries: ${poolResult.failedQueries}
          Average Wait Time: ${poolResult.averageWaitTime.toFixed(2)}ms
          Max Wait Time: ${poolResult.maxWaitTime.toFixed(2)}ms
          Pool Utilization: ${poolResult.poolUtilization.toFixed(1)}%
          Throughput: ${poolResult.throughput.toFixed(0)} queries/sec
        `);

        // Connection pool should handle the load efficiently
        expect(poolResult.failedQueries).toBe(0,
          `No queries should fail due to connection pool exhaustion (pool size: ${poolSize})`);
        expect(poolResult.averageWaitTime).toBeLessThan(100,
          `Average wait time should be <100ms (pool size: ${poolSize})`);
        expect(poolResult.poolUtilization).toBeLessThan(90,
          `Pool utilization should be <90% for efficient operation (pool size: ${poolSize})`);
      }
    });

    test('Memory allocation contention under concurrent load', async () => {
      console.log('Testing memory allocation contention...');
      
      const concurrentAllocators = 100;
      const allocationSize = 1024 * 1024; // 1MB per allocation
      const allocationsPerWorker = 100;
      
      const allocationResults = await performanceUtils.testMemoryAllocationContention({
        workerCount: concurrentAllocators,
        allocationSize,
        allocationsPerWorker,
        allocationPattern: 'random', // random, sequential, or burst
        holdTime: 100 // ms to hold allocation before freeing
      });

      console.log(`Memory Allocation Contention Results:
        Concurrent Allocators: ${concurrentAllocators}
        Total Allocations: ${(concurrentAllocators * allocationsPerWorker).toLocaleString()}
        Successful Allocations: ${allocationResults.successfulAllocations.toLocaleString()}
        Failed Allocations: ${allocationResults.failedAllocations}
        Average Allocation Time: ${allocationResults.averageAllocationTime.toFixed(3)}ms
        Max Allocation Time: ${allocationResults.maxAllocationTime.toFixed(3)}ms
        Memory Fragmentation: ${allocationResults.memoryFragmentation.toFixed(2)}%
        Peak Memory Usage: ${allocationResults.peakMemoryUsage.toFixed(0)}MB
      `);

      // Memory allocation should be efficient even under contention
      expect(allocationResults.failedAllocations).toBe(0,
        'No allocations should fail due to contention');
      expect(allocationResults.averageAllocationTime).toBeLessThan(10,
        'Average allocation time should be <10ms under contention');
      expect(allocationResults.memoryFragmentation).toBeLessThan(20,
        'Memory fragmentation should be <20% under concurrent allocation');
    });

    test('CPU-intensive task concurrent execution', async () => {
      console.log('Testing CPU-intensive concurrent task execution...');
      
      const cpuIntensiveTasks = [
        { name: 'technical_indicators', cpuIntensity: 'medium', concurrency: 50 },
        { name: 'ml_training', cpuIntensity: 'high', concurrency: 20 },
        { name: 'backtesting', cpuIntensity: 'high', concurrency: 25 },
        { name: 'risk_calculations', cpuIntensity: 'medium', concurrency: 30 }
      ];

      for (const task of cpuIntensiveTasks) {
        console.log(`Testing ${task.name} with ${task.concurrency} concurrent workers...`);
        
        const taskResult = await performanceUtils.runCPUIntensiveTask({
          taskType: task.name,
          workerCount: task.concurrency,
          duration: 30000, // 30 seconds
          workloadSize: task.cpuIntensity === 'high' ? 'large' : 'medium'
        });

        console.log(`${task.name} Concurrent Execution:
          Workers: ${task.concurrency}
          Tasks Completed: ${taskResult.tasksCompleted.toLocaleString()}
          Average Task Time: ${taskResult.averageTaskTime.toFixed(2)}ms
          P95 Task Time: ${taskResult.p95TaskTime.toFixed(2)}ms
          CPU Utilization: ${taskResult.cpuUtilization.toFixed(1)}%
          Tasks per Second: ${taskResult.throughput.toFixed(0)}
          Resource Efficiency: ${taskResult.resourceEfficiency.toFixed(2)}
        `);

        // CPU-intensive tasks should utilize resources efficiently
        const expectedCpuUtilization = task.cpuIntensity === 'high' ? 70 : 50;
        expect(taskResult.cpuUtilization).toBeGreaterThan(expectedCpuUtilization,
          `CPU utilization should be >${expectedCpuUtilization}% for ${task.name}`);
        expect(taskResult.resourceEfficiency).toBeGreaterThan(0.7,
          `Resource efficiency should be >70% for ${task.name}`);
      }
    });
  });

  describe('Thread Safety and Race Condition Testing', () => {
    test('Concurrent order book updates', async () => {
      console.log('Testing concurrent order book update thread safety...');
      
      const concurrentUpdaters = 20;
      const updatesPerWorker = 1000;
      const orderBookSymbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
      
      const orderBookResults = await performanceUtils.testOrderBookConcurrency({
        updaterCount: concurrentUpdaters,
        updatesPerWorker,
        symbols: orderBookSymbols,
        updateTypes: ['bid', 'ask', 'trade', 'clear'],
        conflictScenarios: true // Include intentional conflicts to test safety
      });

      for (const symbol of orderBookSymbols) {
        const result = orderBookResults[symbol];
        
        console.log(`Order Book (${symbol}) Thread Safety:
          Total Updates: ${result.totalUpdates.toLocaleString()}
          Successful Updates: ${result.successfulUpdates.toLocaleString()}
          Conflicted Updates: ${result.conflictedUpdates}
          Data Consistency Errors: ${result.dataConsistencyErrors}
          Average Update Time: ${result.averageUpdateTime.toFixed(3)}ms
          Final State Valid: ${result.finalStateValid ? 'YES' : 'NO'}
        `);

        // Thread safety requirements
        expect(result.dataConsistencyErrors).toBe(0,
          `No data consistency errors should occur for ${symbol} order book`);
        expect(result.finalStateValid).toBe(true,
          `Final order book state should be valid for ${symbol}`);
        expect(result.successfulUpdates + result.conflictedUpdates).toBe(result.totalUpdates,
          'All updates should be accounted for (successful or properly handled conflicts)');
      }
    });

    test('Concurrent portfolio balance updates', async () => {
      console.log('Testing concurrent portfolio balance update safety...');
      
      const concurrentTraders = 50;
      const transactionsPerTrader = 200;
      const initialBalance = 10000; // $10,000 per trader
      
      const balanceResults = await performanceUtils.testPortfolioConcurrency({
        traderCount: concurrentTraders,
        transactionsPerTrader,
        initialBalance,
        transactionTypes: [
          { type: 'buy', probability: 0.4, avgAmount: 500 },
          { type: 'sell', probability: 0.4, avgAmount: 500 },
          { type: 'deposit', probability: 0.1, avgAmount: 1000 },
          { type: 'withdrawal', probability: 0.1, avgAmount: 200 }
        ]
      });

      console.log(`Portfolio Balance Concurrency Results:
        Concurrent Traders: ${concurrentTraders}
        Total Transactions: ${balanceResults.totalTransactions.toLocaleString()}
        Successful Transactions: ${balanceResults.successfulTransactions.toLocaleString()}
        Failed Transactions: ${balanceResults.failedTransactions}
        Balance Consistency Errors: ${balanceResults.balanceConsistencyErrors}
        Total Expected Balance: $${balanceResults.totalExpectedBalance.toLocaleString()}
        Total Actual Balance: $${balanceResults.totalActualBalance.toLocaleString()}
        Balance Difference: $${Math.abs(balanceResults.totalExpectedBalance - balanceResults.totalActualBalance).toLocaleString()}
      `);

      // Portfolio balance updates must maintain consistency
      expect(balanceResults.balanceConsistencyErrors).toBe(0,
        'No balance consistency errors should occur');
      expect(Math.abs(balanceResults.totalExpectedBalance - balanceResults.totalActualBalance)).toBeLessThan(0.01,
        'Total balance should match expected within $0.01');
      expect(balanceResults.failedTransactions).toBe(0,
        'All valid transactions should succeed');
    });

    test('Concurrent strategy state management', async () => {
      console.log('Testing concurrent strategy state management...');
      
      const strategiesCount = 10;
      const concurrentActionsPerStrategy = 20;
      const actionsPerWorker = 100;
      
      const strategyStateResults = await performanceUtils.testStrategyStateConcurrency({
        strategiesCount,
        concurrentActionsPerStrategy,
        actionsPerWorker,
        stateActions: [
          'updateIndicators',
          'generateSignal',
          'managePositions',
          'calculateMetrics',
          'saveState'
        ]
      });

      console.log(`Strategy State Management Concurrency:
        Strategies: ${strategiesCount}
        Concurrent Actions per Strategy: ${concurrentActionsPerStrategy}
        Total State Actions: ${strategyStateResults.totalStateActions.toLocaleString()}
        Successful Actions: ${strategyStateResults.successfulActions.toLocaleString()}
        State Conflicts: ${strategyStateResults.stateConflicts}
        Data Race Conditions: ${strategyStateResults.dataRaceConditions}
        State Corruption Events: ${strategyStateResults.stateCorruptionEvents}
        Average Action Time: ${strategyStateResults.averageActionTime.toFixed(3)}ms
      `);

      // Strategy state management must be thread-safe
      expect(strategyStateResults.stateCorruptionEvents).toBe(0,
        'No state corruption should occur under concurrent access');
      expect(strategyStateResults.dataRaceConditions).toBe(0,
        'No data race conditions should be detected');
      expect(strategyStateResults.stateConflicts).toBeLessThan(strategyStateResults.totalStateActions * 0.05,
        'State conflicts should be <5% of total actions (handled gracefully)');
    });
  });

  describe('Network and Connection Stress Testing', () => {
    test('WebSocket connection scalability', async () => {
      console.log('Testing WebSocket connection scalability...');
      
      const connectionCounts = [100, 500, 1000, 2500];
      
      for (const connectionCount of connectionCounts) {
        console.log(`Testing ${connectionCount} concurrent WebSocket connections...`);
        
        const wsResults = await performanceUtils.testWebSocketScalability({
          connectionCount,
          messageRate: 10, // messages per second per connection
          duration: 60000, // 1 minute
          messageTypes: ['price_updates', 'order_updates', 'trade_executions'],
          connectionPattern: 'gradual' // gradual, burst, or steady
        });

        console.log(`WebSocket Scalability (${connectionCount} connections):
          Established Connections: ${wsResults.establishedConnections}
          Failed Connections: ${wsResults.failedConnections}
          Messages Sent: ${wsResults.messagesSent.toLocaleString()}
          Messages Received: ${wsResults.messagesReceived.toLocaleString()}
          Message Loss Rate: ${wsResults.messageLossRate.toFixed(3)}%
          Average Latency: ${wsResults.averageLatency.toFixed(2)}ms
          P95 Latency: ${wsResults.p95Latency.toFixed(2)}ms
          Connection Success Rate: ${((wsResults.establishedConnections / connectionCount) * 100).toFixed(2)}%
        `);

        // WebSocket performance requirements
        expect(wsResults.establishedConnections / connectionCount).toBeGreaterThan(0.95,
          `At least 95% of WebSocket connections should be established (${connectionCount} connections)`);
        expect(wsResults.messageLossRate).toBeLessThan(0.1,
          `Message loss rate should be <0.1% (${connectionCount} connections)`);
        expect(wsResults.averageLatency).toBeLessThan(100,
          `Average WebSocket latency should be <100ms (${connectionCount} connections)`);
      }
    });

    test('API rate limiting and throttling behavior', async () => {
      console.log('Testing API rate limiting under concurrent load...');
      
      const rateLimitConfigs = [
        { limit: 100, window: 60, users: 20 }, // 100 requests per minute, 20 users
        { limit: 1000, window: 60, users: 50 }, // 1000 requests per minute, 50 users
        { limit: 10000, window: 60, users: 100 } // 10000 requests per minute, 100 users
      ];

      for (const config of rateLimitConfigs) {
        console.log(`Testing rate limiting: ${config.limit}/min with ${config.users} users...`);
        
        const rateLimitResults = await performanceUtils.testAPIRateLimiting({
          rateLimit: config.limit,
          windowSeconds: config.window,
          concurrentUsers: config.users,
          testDuration: 120000, // 2 minutes
          burstTesting: true, // Test burst scenarios
          requestDistribution: 'realistic' // realistic, uniform, or bursty
        });

        console.log(`Rate Limiting (${config.limit}/min, ${config.users} users):
          Total Requests: ${rateLimitResults.totalRequests.toLocaleString()}
          Successful Requests: ${rateLimitResults.successfulRequests.toLocaleString()}
          Rate Limited Requests: ${rateLimitResults.rateLimitedRequests.toLocaleString()}
          Failed Requests: ${rateLimitResults.failedRequests}
          Average Response Time: ${rateLimitResults.averageResponseTime.toFixed(0)}ms
          Rate Limit Accuracy: ${rateLimitResults.rateLimitAccuracy.toFixed(2)}%
          Burst Handling: ${rateLimitResults.burstHandling ? 'PASS' : 'FAIL'}
        `);

        // Rate limiting should work accurately
        expect(rateLimitResults.rateLimitAccuracy).toBeGreaterThan(0.95,
          'Rate limiting should be >95% accurate');
        expect(rateLimitResults.failedRequests).toBe(0,
          'No requests should fail due to system errors (rate limiting is expected)');
        expect(rateLimitResults.burstHandling).toBe(true,
          'System should handle burst requests gracefully');
      }
    });
  });

  describe('Performance Degradation Analysis', () => {
    test('Performance degradation under sustained load', async () => {
      console.log('Analyzing performance degradation under sustained load...');
      
      const loadTestPhases = [
        { name: 'baseline', users: 10, duration: 300000 }, // 5 minutes baseline
        { name: 'ramp_up', users: 100, duration: 300000 }, // 5 minutes moderate load
        { name: 'peak_load', users: 500, duration: 600000 }, // 10 minutes peak load
        { name: 'extended_peak', users: 500, duration: 1800000 }, // 30 minutes extended
        { name: 'cooldown', users: 50, duration: 300000 } // 5 minutes cooldown
      ];

      const degradationResults: Array<{
        phase: string;
        averageResponseTime: number;
        throughput: number;
        errorRate: number;
        resourceUtilization: any;
      }> = [];

      for (const phase of loadTestPhases) {
        console.log(`Running ${phase.name} phase: ${phase.users} users for ${phase.duration / 1000}s...`);
        
        const phaseResult = await performanceUtils.runSustainedLoadTest({
          userCount: phase.users,
          duration: phase.duration,
          actionProfile: 'mixed', // Mixed trading actions
          monitoringInterval: 30000 // Monitor every 30 seconds
        });

        degradationResults.push({
          phase: phase.name,
          averageResponseTime: phaseResult.averageResponseTime,
          throughput: phaseResult.throughput,
          errorRate: phaseResult.errorRate,
          resourceUtilization: phaseResult.resourceUtilization
        });

        console.log(`${phase.name.toUpperCase()} Phase Results:
          Response Time: ${phaseResult.averageResponseTime.toFixed(0)}ms
          Throughput: ${phaseResult.throughput.toFixed(0)} actions/sec
          Error Rate: ${phaseResult.errorRate.toFixed(2)}%
          CPU Usage: ${phaseResult.resourceUtilization.cpu.toFixed(1)}%
          Memory Usage: ${phaseResult.resourceUtilization.memory.toFixed(0)}MB
        `);
      }

      // Analyze performance degradation patterns
      const baseline = degradationResults.find(r => r.phase === 'baseline')!;
      const peakLoad = degradationResults.find(r => r.phase === 'peak_load')!;
      const extendedPeak = degradationResults.find(r => r.phase === 'extended_peak')!;

      const responseTimeDegradation = (peakLoad.averageResponseTime / baseline.averageResponseTime);
      const extendedDegradation = (extendedPeak.averageResponseTime / peakLoad.averageResponseTime);
      const throughputDegradation = (baseline.throughput / peakLoad.throughput);

      console.log(`Performance Degradation Analysis:
        Response Time Degradation (Baseline → Peak): ${responseTimeDegradation.toFixed(2)}x
        Extended Load Degradation (Peak → Extended): ${extendedDegradation.toFixed(2)}x
        Throughput Degradation: ${throughputDegradation.toFixed(2)}x
        System Stability: ${extendedDegradation < 1.5 ? 'STABLE' : 'DEGRADING'}
      `);

      // Performance should degrade gracefully
      expect(responseTimeDegradation).toBeLessThan(5,
        'Response time should not degrade more than 5x under peak load');
      expect(extendedDegradation).toBeLessThan(1.5,
        'Performance should not degrade significantly during extended peak load');
      expect(throughputDegradation).toBeLessThan(2,
        'Throughput should not degrade more than 2x under peak load');
    });
  });
});

// Helper function to analyze scaling characteristics
function analyzeScalingCharacteristics(results: ConcurrencyTestResult[]): void {
  console.log('\nScaling Characteristics Analysis:');
  console.log('='.repeat(50));
  
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    
    const userScaling = curr.userCount / prev.userCount;
    const responseTimeScaling = curr.averageResponseTime / prev.averageResponseTime;
    const throughputScaling = curr.throughput / prev.throughput;
    const errorRateChange = curr.errorRate - prev.errorRate;
    
    console.log(`${prev.userCount} → ${curr.userCount} users:
      Response Time Scaling: ${responseTimeScaling.toFixed(2)}x
      Throughput Scaling: ${throughputScaling.toFixed(2)}x  
      Error Rate Change: ${errorRateChange.toFixed(2)}%
      Scaling Efficiency: ${((throughputScaling / userScaling) * 100).toFixed(1)}%
    `);
  }
  
  // Overall scaling assessment
  const firstResult = results[0];
  const lastResult = results[results.length - 1];
  
  const overallUserScaling = lastResult.userCount / firstResult.userCount;
  const overallThroughputScaling = lastResult.throughput / firstResult.throughput;
  const overallEfficiency = (overallThroughputScaling / overallUserScaling) * 100;
  
  console.log(`\nOverall Scaling Assessment:
    User Count Range: ${firstResult.userCount} → ${lastResult.userCount} (${overallUserScaling}x)
    Throughput Scaling: ${overallThroughputScaling.toFixed(2)}x
    Overall Scaling Efficiency: ${overallEfficiency.toFixed(1)}%
    Scaling Rating: ${overallEfficiency > 80 ? 'EXCELLENT' : overallEfficiency > 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT'}
  `);
}