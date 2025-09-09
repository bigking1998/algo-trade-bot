/**
 * Strategy Engine Demonstration - Task BE-016 Validation
 * 
 * Demonstrates the StrategyEngine core functionality working with
 * all integrated components. This serves as validation for the major
 * milestone completion.
 */

import { StrategyEngine } from './StrategyEngine.js';
import type { StrategyConfig } from './types.js';
import type { DydxCandle } from '../../shared/types/trading.js';

// Create a demo strategy configuration
const createDemoStrategy = (): StrategyConfig => ({
  id: 'demo-strategy-001',
  name: 'Demo Moving Average Strategy',
  description: 'Demonstration strategy for StrategyEngine validation',
  version: '1.0.0',
  type: 'technical',
  timeframes: ['1MIN'],
  symbols: ['BTC-USD'],
  maxConcurrentPositions: 2,
  
  riskProfile: {
    maxRiskPerTrade: 2.0,
    maxPortfolioRisk: 10.0,
    stopLossType: 'fixed',
    takeProfitType: 'fixed',
    positionSizing: 'fixed'
  },
  
  parameters: {
    sma_short: 10,
    sma_long: 20,
    rsi_period: 14
  },
  
  performance: {},
  
  execution: {
    orderType: 'market',
    slippage: 0.1,
    timeout: 30,
    retries: 3
  },
  
  monitoring: {
    enableAlerts: true,
    alertChannels: ['console'],
    healthCheckInterval: 300,
    performanceReviewInterval: 3600
  },
  
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'demo-user'
});

// Create demo market data
const createDemoMarketData = (count = 50): DydxCandle[] => {
  const candles: DydxCandle[] = [];
  const startTime = Date.now() - (count * 60000); // count minutes ago
  let price = 50000; // Starting BTC price
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime + (i * 60000)).toISOString();
    
    // Simple random walk
    const change = (Math.random() - 0.5) * 500;
    price += change;
    
    const open = price.toString();
    const close = (price + change * 0.5).toString();
    const high = Math.max(price, price + change * 0.5, price + Math.abs(change) * 0.3).toString();
    const low = Math.min(price, price + change * 0.5, price - Math.abs(change) * 0.3).toString();
    const volume = (1000 + Math.random() * 500).toString();
    
    candles.push({
      startedAt: timestamp,
      ticker: 'BTC-USD',
      resolution: '1MIN',
      low,
      high,
      open,
      close,
      baseTokenVolume: volume,
      usdVolume: (parseFloat(volume) * price).toString(),
      trades: Math.floor(10 + Math.random() * 20),
      startingOpenInterest: '0'
    });
  }
  
  return candles;
};

/**
 * Main demonstration function
 */
async function demonstrateStrategyEngine(): Promise<void> {
  console.log('🚀 Starting StrategyEngine Demonstration');
  console.log('=====================================');
  
  // Create and configure the strategy engine
  const engine = new StrategyEngine({
    id: 'demo-engine',
    name: 'Demo Strategy Engine',
    version: '1.0.0-demo',
    
    dataBuffer: {
      maxCapacity: 1000,
      compressionEnabled: false,
      symbols: ['BTC-USD'],
      timeframes: ['1MIN']
    },
    
    realTimeProcessing: {
      enabled: true,
      updateInterval: 1000,
      batchSize: 10,
      maxConcurrency: 3,
      bufferSize: 100
    },
    
    execution: {
      maxConcurrentStrategies: 5,
      executionTimeout: 10000,
      retryAttempts: 2,
      priorityExecution: true
    },
    
    monitoring: {
      enableMetrics: true,
      metricsInterval: 5000,
      healthCheckInterval: 10000,
      alertThresholds: {
        latency: 2000,
        errorRate: 0.1,
        memoryUsage: 200_000_000,
        queueDepth: 50
      }
    },
    
    errorHandling: {
      autoRecovery: true,
      maxRecoveryAttempts: 3,
      recoveryDelay: 2000,
      circuitBreakerThreshold: 5,
      fallbackMode: true
    }
  });

  try {
    // Start the engine
    console.log('📡 Starting StrategyEngine...');
    await engine.start();
    console.log('✅ StrategyEngine started successfully');
    
    // Add a demo strategy
    console.log('📈 Adding demo strategy...');
    const strategy = createDemoStrategy();
    const strategyId = await engine.addStrategy(strategy);
    console.log(`✅ Strategy added with ID: ${strategyId}`);
    
    // Generate and process demo market data
    console.log('📊 Processing demo market data...');
    const marketData = createDemoMarketData(30);
    
    const result = await engine.executeStrategies('BTC-USD', '1MIN', marketData);
    
    console.log('📋 Execution Results:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Strategies Executed: ${result.strategiesExecuted}`);
    console.log(`  - Signals Generated: ${result.signalsGenerated}`);
    console.log(`  - Execution Time: ${result.executionTime.toFixed(2)}ms`);
    console.log(`  - Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
      });
    }
    
    // Show performance metrics
    console.log('📊 Performance Metrics:');
    const metrics = engine.getPerformanceMetrics();
    console.log(`  - Total Executions: ${metrics.execution.totalExecutions}`);
    console.log(`  - Average Execution Time: ${metrics.execution.averageExecutionTime.toFixed(2)}ms`);
    console.log(`  - Active Strategies: ${metrics.strategies.activeStrategies}`);
    console.log(`  - Memory Usage: ${(metrics.system.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  - Queue Depth: ${metrics.system.queueDepth}`);
    
    // Show health status
    console.log('🏥 Health Status:');
    const health = await engine.getHealthStatus();
    console.log(`  - Overall Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`  - Health Score: ${health.score}/100`);
    if (health.issues.length > 0) {
      console.log('  - Issues:');
      health.issues.forEach((issue, index) => {
        console.log(`    ${index + 1}. ${issue}`);
      });
    }
    
    // Show active strategies
    const activeStrategies = engine.getActiveStrategies();
    console.log('📈 Active Strategies:');
    activeStrategies.forEach((strategyId, index) => {
      console.log(`  ${index + 1}. ${strategyId}`);
    });
    
    // Process additional real-time data
    console.log('⚡ Processing real-time data updates...');
    await engine.processMarketData('BTC-USD', '1MIN', createDemoMarketData(5));
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updatedMetrics = engine.getPerformanceMetrics();
    console.log('📊 Updated Metrics:');
    console.log(`  - Candles Processed: ${updatedMetrics.dataProcessing.candlesProcessed}`);
    console.log(`  - Buffer Utilization: ${updatedMetrics.dataProcessing.bufferUtilization.toFixed(2)}%`);
    
    console.log('✅ StrategyEngine demonstration completed successfully!');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    try {
      await engine.stop();
      console.log('✅ StrategyEngine stopped successfully');
    } catch (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError);
    }
  }
  
  console.log('=====================================');
  console.log('🎯 StrategyEngine Demonstration Complete');
}

// Export for external use
export { demonstrateStrategyEngine, createDemoStrategy, createDemoMarketData };

// Run demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateStrategyEngine()
    .then(() => {
      console.log('Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}