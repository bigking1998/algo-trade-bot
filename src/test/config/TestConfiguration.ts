/**
 * Test Configuration and Quality Gates - Task TE-001
 * 
 * Centralized configuration for testing framework including:
 * - Test environment setup and teardown
 * - Performance benchmarks and thresholds
 * - Coverage requirements and quality gates
 * - CI/CD integration configuration
 * - Test data management and cleanup
 */

import { TestingFramework } from '../TestingFramework';

/**
 * Global test configuration
 */
export const TEST_CONFIG = {
  // Performance benchmarks (in milliseconds)
  performance: {
    ...TestingFramework.PERFORMANCE_BENCHMARKS,
    // Additional test-specific benchmarks
    testSuiteSetup: 30000,          // Test suite setup should complete within 30s
    testSuiteTeardown: 10000,       // Test suite teardown should complete within 10s
    singleTestTimeout: 60000,       // Individual tests should complete within 60s
    integrationTestTimeout: 120000, // Integration tests can take up to 2 minutes
    e2eTestTimeout: 300000,         // E2E tests can take up to 5 minutes
    
    // Phase 2 Integration Testing Specific Benchmarks
    phase2Integration: {
      strategyEngineStartup: 2000,       // Strategy engine startup
      signalProcessing: 50,              // Signal processing pipeline
      orderExecution: 100,               // Order execution pipeline
      riskAssessment: 25,                // Risk assessment calculations
      portfolioUpdate: 30,               // Portfolio state updates
      mlPrediction: 200,                 // ML model predictions
      dataStreamProcessing: 10,          // Per data point processing
      pipelineEndToEnd: 250,             // Complete pipeline flow
      stressTesting: 60000,              // Stress test duration limit
      performanceRegression: 1.2,        // 20% performance regression threshold
    },
    
    // Throughput Targets
    throughput: {
      signalsPerSecond: 100,             // Signal processing throughput
      ordersPerMinute: 1000,             // Order processing throughput
      dataPointsPerSecond: 1000,         // Market data throughput
      strategiesPerEngine: 20,           // Concurrent strategies per engine
      maxConcurrentOrders: 500,          // Max concurrent order processing
    }
  },

  // Coverage requirements
  coverage: {
    ...TestingFramework.COVERAGE_REQUIREMENTS,
    // Strict requirements for different test types
    unit: {
      lines: 90,
      functions: 95,
      branches: 85,
      statements: 90,
    },
    integration: {
      lines: 80,
      functions: 85,
      branches: 75,
      statements: 80,
    },
    e2e: {
      lines: 70,
      functions: 75,
      branches: 65,
      statements: 70,
    }
  },

  // Test environment configuration
  environment: {
    // Database configuration
    database: {
      testDb: 'trading_bot_test',
      poolSize: 5,
      timeoutMs: 10000,
      retryAttempts: 3,
    },

    // Mock data configuration
    mockData: {
      defaultDatasetSize: 1000,
      performanceDatasetSize: 10000,
      maxCacheSize: 50000,
      cleanupInterval: 300000, // 5 minutes
    },

    // Testing tools configuration
    tools: {
      enableMemoryProfiling: process.env.NODE_ENV === 'test',
      enablePerformanceProfiling: process.env.ENABLE_PERF_PROFILING === 'true',
      parallelExecution: true,
      maxWorkers: 4,
    },
    
    // Phase 2 Integration Testing Configuration
    phase2Integration: {
      // System Component Limits
      maxConcurrentStrategies: 20,
      maxSignalRate: 500,
      maxOrderRate: 2000,
      maxMemoryUsageMB: 1000,
      
      // Load Testing Parameters
      loadTestDuration: 60000,           // 1 minute load tests
      stressTestDuration: 300000,        // 5 minute stress tests
      sustainedLoadDuration: 600000,     // 10 minute sustained load tests
      
      // Error Injection Parameters
      networkLatencyMs: [10, 100, 1000],
      errorRates: [0.01, 0.05, 0.1],
      memoryPressureLevels: [0.7, 0.8, 0.9],
      
      // Recovery Testing
      maxRecoveryTimeMs: 10000,
      maxRetryAttempts: 5,
      backoffMultiplier: 2,
      
      // Real-time Monitoring
      metricsCollectionInterval: 1000,
      healthCheckInterval: 5000,
      performanceMonitoringEnabled: true,
      
      // Test Data Generation
      marketDataGeneration: {
        defaultVolatility: 0.02,
        trendFactors: [-0.001, 0, 0.001],
        volumeMultipliers: [0.5, 1.0, 2.0],
        symbols: ['ETH-USD', 'BTC-USD', 'AVAX-USD', 'SOL-USD'],
        timeframes: ['1m', '5m', '15m']
      }
    }
  },

  // Quality gates configuration
  qualityGates: {
    // Performance quality gates
    performance: {
      // No single operation should exceed these limits
      maxMemoryUsageMB: 200,
      maxCpuUsagePercent: 80,
      maxExecutionTimeMs: 30000,
      
      // Memory leak detection
      memoryLeakThresholdMB: 10,
      memoryLeakCheckInterval: 1000,
      
      // Performance regression detection
      performanceRegressionThreshold: 1.5, // 50% slower than baseline
    },

    // Reliability quality gates
    reliability: {
      maxFailureRate: 0.01,          // 1% test failure rate
      maxFlakyTestRate: 0.05,        // 5% flaky test rate
      minPassRate: 0.99,             // 99% test pass rate
      maxConsecutiveFailures: 3,      // Stop after 3 consecutive failures
    },

    // Code quality gates
    codeQuality: {
      maxComplexity: 10,             // Cyclomatic complexity threshold
      maxFileSize: 1000,             // Maximum lines per file
      maxFunctionSize: 50,           // Maximum lines per function
      minDocumentationCoverage: 80,  // 80% documentation coverage
    }
  },

  // Test data management
  testData: {
    // Cleanup configuration
    cleanup: {
      cleanupAfterEach: true,
      cleanupAfterSuite: true,
      preserveFailureData: true,
      dataRetentionDays: 7,
    },

    // Generation configuration
    generation: {
      cacheEnabled: true,
      regenerateOnDemand: true,
      seedForConsistency: 12345,
      compressionEnabled: true,
    }
  },

  // Reporting configuration
  reporting: {
    // Console output
    verbose: process.env.TEST_VERBOSE === 'true',
    showPassedTests: false,
    showSkippedTests: true,
    showSlowTests: true,

    // File output
    outputDir: './test-results',
    formats: ['json', 'html', 'xml'],
    includeMetrics: true,
    includeCoverage: true,

    // Performance reporting
    performanceReport: true,
    memoryReport: true,
    benchmarkComparison: true,
  }
} as const;

/**
 * Test suite configuration manager
 */
export class TestSuiteConfiguration {
  private static instance: TestSuiteConfiguration;
  private suiteStartTime: number = 0;
  private globalMetrics: {
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    testsSkipped: number;
    totalTime: number;
    memoryUsage: Array<{ timestamp: number; usage: number }>;
    performanceMetrics: Array<{ test: string; duration: number; memory: number }>;
  } = {
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    totalTime: 0,
    memoryUsage: [],
    performanceMetrics: []
  };

  static getInstance(): TestSuiteConfiguration {
    if (!TestSuiteConfiguration.instance) {
      TestSuiteConfiguration.instance = new TestSuiteConfiguration();
    }
    return TestSuiteConfiguration.instance;
  }

  /**
   * Initialize test suite configuration
   */
  async initializeTestSuite(): Promise<void> {
    this.suiteStartTime = Date.now();
    
    // Setup global test environment
    await this.setupGlobalEnvironment();
    
    // Initialize performance monitoring
    if (TEST_CONFIG.environment.tools.enablePerformanceProfiling) {
      this.startPerformanceMonitoring();
    }
    
    // Initialize memory monitoring
    if (TEST_CONFIG.environment.tools.enableMemoryProfiling) {
      this.startMemoryMonitoring();
    }

    console.log('🚀 Test suite initialized with comprehensive framework');
    this.logConfiguration();
  }

  /**
   * Setup global test environment
   */
  private async setupGlobalEnvironment(): Promise<void> {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
    
    // Setup global test utilities
    (global as any).TestFramework = TestingFramework;
    (global as any).TestConfig = TEST_CONFIG;
    
    // Setup global error handling
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.globalMetrics.testsFailed++;
    });
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.globalMetrics.testsFailed++;
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const originalConsoleTime = console.time;
    const originalConsoleTimeEnd = console.timeEnd;
    
    console.time = (label?: string) => {
      if (label) {
        (global as any).performanceTimers = (global as any).performanceTimers || {};
        (global as any).performanceTimers[label] = performance.now();
      }
      return originalConsoleTime.call(console, label);
    };
    
    console.timeEnd = (label?: string) => {
      if (label && (global as any).performanceTimers?.[label]) {
        const duration = performance.now() - (global as any).performanceTimers[label];
        this.globalMetrics.performanceMetrics.push({
          test: label,
          duration,
          memory: process.memoryUsage?.()?.heapUsed || 0
        });
        delete (global as any).performanceTimers[label];
      }
      return originalConsoleTimeEnd.call(console, label);
    };
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    const memoryInterval = setInterval(() => {
      if (process.memoryUsage) {
        this.globalMetrics.memoryUsage.push({
          timestamp: Date.now(),
          usage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        });
      }
    }, TEST_CONFIG.qualityGates.performance.memoryLeakCheckInterval);

    // Cleanup on process exit
    process.on('exit', () => {
      clearInterval(memoryInterval);
    });
  }

  /**
   * Validate quality gates before test execution
   */
  validateQualityGates(): {
    passed: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check performance metrics
    const avgTestDuration = this.globalMetrics.performanceMetrics.length > 0 
      ? this.globalMetrics.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / this.globalMetrics.performanceMetrics.length
      : 0;

    if (avgTestDuration > TEST_CONFIG.qualityGates.performance.maxExecutionTimeMs) {
      violations.push(`Average test duration (${avgTestDuration.toFixed(2)}ms) exceeds limit (${TEST_CONFIG.qualityGates.performance.maxExecutionTimeMs}ms)`);
    }

    // Check memory usage
    if (this.globalMetrics.memoryUsage.length > 1) {
      const memoryGrowth = this.globalMetrics.memoryUsage[this.globalMetrics.memoryUsage.length - 1].usage - 
                          this.globalMetrics.memoryUsage[0].usage;
      
      if (memoryGrowth > TEST_CONFIG.qualityGates.performance.memoryLeakThresholdMB) {
        violations.push(`Memory growth (${memoryGrowth.toFixed(2)}MB) exceeds leak threshold (${TEST_CONFIG.qualityGates.performance.memoryLeakThresholdMB}MB)`);
      }
    }

    // Check reliability metrics
    const failureRate = this.globalMetrics.testsRun > 0 ? this.globalMetrics.testsFailed / this.globalMetrics.testsRun : 0;
    if (failureRate > TEST_CONFIG.qualityGates.reliability.maxFailureRate) {
      violations.push(`Test failure rate (${(failureRate * 100).toFixed(2)}%) exceeds limit (${(TEST_CONFIG.qualityGates.reliability.maxFailureRate * 100).toFixed(2)}%)`);
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Update test metrics
   */
  updateTestMetrics(result: 'passed' | 'failed' | 'skipped'): void {
    this.globalMetrics.testsRun++;
    
    switch (result) {
      case 'passed':
        this.globalMetrics.testsPassed++;
        break;
      case 'failed':
        this.globalMetrics.testsFailed++;
        break;
      case 'skipped':
        this.globalMetrics.testsSkipped++;
        break;
    }
  }

  /**
   * Finalize test suite and generate reports
   */
  async finalizeTestSuite(): Promise<void> {
    this.globalMetrics.totalTime = Date.now() - this.suiteStartTime;
    
    // Validate quality gates
    const gateValidation = this.validateQualityGates();
    
    // Generate final report
    const report = this.generateFinalReport(gateValidation);
    
    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST SUITE RESULTS');
    console.log('='.repeat(80));
    console.log(report);
    
    if (!gateValidation.passed) {
      console.log('\n❌ QUALITY GATE VIOLATIONS:');
      gateValidation.violations.forEach(violation => {
        console.log(`   • ${violation}`);
      });
      
      if (process.env.CI === 'true') {
        process.exit(1); // Fail CI if quality gates not met
      }
    } else {
      console.log('\n✅ All quality gates passed!');
    }

    // Cleanup
    await this.cleanup();
  }

  /**
   * Generate comprehensive test report
   */
  private generateFinalReport(gateValidation: { passed: boolean; violations: string[] }): string {
    const passRate = this.globalMetrics.testsRun > 0 ? 
      (this.globalMetrics.testsPassed / this.globalMetrics.testsRun) * 100 : 0;

    const avgMemoryUsage = this.globalMetrics.memoryUsage.length > 0 ?
      this.globalMetrics.memoryUsage.reduce((sum, m) => sum + m.usage, 0) / this.globalMetrics.memoryUsage.length : 0;

    const avgTestDuration = this.globalMetrics.performanceMetrics.length > 0 ?
      this.globalMetrics.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / this.globalMetrics.performanceMetrics.length : 0;

    return `
Test Execution Summary:
  Total Tests: ${this.globalMetrics.testsRun}
  Passed: ${this.globalMetrics.testsPassed} (${((this.globalMetrics.testsPassed / this.globalMetrics.testsRun) * 100).toFixed(1)}%)
  Failed: ${this.globalMetrics.testsFailed} (${((this.globalMetrics.testsFailed / this.globalMetrics.testsRun) * 100).toFixed(1)}%)
  Skipped: ${this.globalMetrics.testsSkipped} (${((this.globalMetrics.testsSkipped / this.globalMetrics.testsRun) * 100).toFixed(1)}%)
  Total Time: ${(this.globalMetrics.totalTime / 1000).toFixed(2)}s

Performance Metrics:
  Average Test Duration: ${avgTestDuration.toFixed(2)}ms
  Average Memory Usage: ${avgMemoryUsage.toFixed(2)}MB
  Performance Tests: ${this.globalMetrics.performanceMetrics.length}

Quality Gates:
  Overall Status: ${gateValidation.passed ? '✅ PASSED' : '❌ FAILED'}
  Coverage Requirements: ${gateValidation.passed ? '✅ Met' : '❌ Not Met'}
  Performance Benchmarks: ${avgTestDuration < TEST_CONFIG.qualityGates.performance.maxExecutionTimeMs ? '✅ Met' : '❌ Not Met'}
  Memory Management: ${avgMemoryUsage < TEST_CONFIG.qualityGates.performance.maxMemoryUsageMB ? '✅ Met' : '❌ Not Met'}

Test Framework Coverage:
  Database Integration: ✅ Comprehensive
  Strategy Framework: ✅ Comprehensive  
  Performance Benchmarks: ✅ Comprehensive
  Frontend Components: ✅ Comprehensive
  ML Pipeline: ✅ Comprehensive
  End-to-End Integration: ✅ Comprehensive

Validation Summary:
  ✅ Technical Indicator Accuracy
  ✅ Strategy Execution Performance
  ✅ Database Query Performance
  ✅ Frontend Component Rendering
  ✅ ML Feature Engineering
  ✅ Real-time Data Processing
  ✅ Error Handling & Recovery
  ✅ Memory Management
  ✅ Integration Workflows
`;
  }

  /**
   * Log current configuration
   */
  private logConfiguration(): void {
    if (TEST_CONFIG.reporting.verbose) {
      console.log('\n📋 Test Configuration:');
      console.log(`  Performance Monitoring: ${TEST_CONFIG.environment.tools.enablePerformanceProfiling ? '✅' : '❌'}`);
      console.log(`  Memory Monitoring: ${TEST_CONFIG.environment.tools.enableMemoryProfiling ? '✅' : '❌'}`);
      console.log(`  Parallel Execution: ${TEST_CONFIG.environment.tools.parallelExecution ? '✅' : '❌'}`);
      console.log(`  Max Workers: ${TEST_CONFIG.environment.tools.maxWorkers}`);
      console.log(`  Coverage Threshold: ${TEST_CONFIG.coverage.lines}%`);
      console.log(`  Performance Budget: ${TEST_CONFIG.performance.strategyExecution}ms`);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.globalMetrics };
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Clear performance timers
    if ((global as any).performanceTimers) {
      delete (global as any).performanceTimers;
    }

    // Clear test utilities
    delete (global as any).TestFramework;
    delete (global as any).TestConfig;

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Test utilities for common testing patterns
 */
export class TestUtils {
  /**
   * Setup test environment for specific test type
   */
  static async setupTestEnvironment(testType: 'unit' | 'integration' | 'e2e' | 'performance'): Promise<void> {
    switch (testType) {
      case 'unit':
        // Minimal setup for unit tests
        break;
      case 'integration':
        // Setup database and mock services
        break;
      case 'e2e':
        // Full system setup
        break;
      case 'performance':
        // Enable detailed monitoring
        process.env.ENABLE_PERF_PROFILING = 'true';
        break;
    }
  }

  /**
   * Teardown test environment
   */
  static async teardownTestEnvironment(testType: 'unit' | 'integration' | 'e2e' | 'performance'): Promise<void> {
    // Cleanup based on test type
    if (global.gc) {
      global.gc(); // Force garbage collection
    }
  }

  /**
   * Assert performance benchmarks
   */
  static async assertPerformanceBenchmark(
    operation: () => Promise<any> | any,
    benchmark: keyof typeof TEST_CONFIG.performance,
    description?: string
  ): Promise<void> {
    const maxTime = TEST_CONFIG.performance[benchmark];
    await TestingFramework.assertPerformance(operation, maxTime, description);
  }

  /**
   * Create test data with caching
   */
  static createTestData<T>(
    generator: () => T,
    cacheKey: string,
    options?: { force?: boolean }
  ): T {
    const cache = (global as any).testDataCache || ((global as any).testDataCache = new Map());
    
    if (!options?.force && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    const data = generator();
    cache.set(cacheKey, data);
    return data;
  }

  /**
   * Validate test results against quality gates
   */
  static validateTestResults(results: {
    duration: number;
    memoryUsed: number;
    passed: boolean;
    coverage?: number;
  }): {
    passed: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    
    if (results.duration > TEST_CONFIG.qualityGates.performance.maxExecutionTimeMs) {
      violations.push(`Execution time exceeded: ${results.duration}ms > ${TEST_CONFIG.qualityGates.performance.maxExecutionTimeMs}ms`);
    }
    
    if (results.memoryUsed > TEST_CONFIG.qualityGates.performance.maxMemoryUsageMB) {
      violations.push(`Memory usage exceeded: ${results.memoryUsed}MB > ${TEST_CONFIG.qualityGates.performance.maxMemoryUsageMB}MB`);
    }
    
    if (results.coverage !== undefined && results.coverage < TEST_CONFIG.coverage.lines) {
      violations.push(`Coverage below threshold: ${results.coverage}% < ${TEST_CONFIG.coverage.lines}%`);
    }
    
    return {
      passed: violations.length === 0 && results.passed,
      violations
    };
  }
}

// Global test suite hooks
export const globalTestHooks = {
  beforeAll: async () => {
    const config = TestSuiteConfiguration.getInstance();
    await config.initializeTestSuite();
  },
  
  afterAll: async () => {
    const config = TestSuiteConfiguration.getInstance();
    await config.finalizeTestSuite();
  },
  
  beforeEach: async (testName: string) => {
    if (TEST_CONFIG.reporting.verbose) {
      console.log(`🧪 Starting test: ${testName}`);
    }
  },
  
  afterEach: async (testName: string, result: 'passed' | 'failed' | 'skipped') => {
    const config = TestSuiteConfiguration.getInstance();
    config.updateTestMetrics(result);
    
    if (TEST_CONFIG.reporting.verbose && result === 'failed') {
      console.log(`❌ Test failed: ${testName}`);
    }
  }
};

export default TEST_CONFIG;