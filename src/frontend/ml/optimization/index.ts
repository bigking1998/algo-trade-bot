/**
 * ML Optimization Module - Advanced Strategy Optimization Implementation (ML-005)
 * 
 * Complete genetic algorithm strategy optimization system providing:
 * - Multi-objective optimization with Pareto frontier analysis
 * - Advanced genetic operators and population management
 * - Comprehensive fitness evaluation and analysis
 * - Integration with backtesting engine for realistic evaluation
 * - Real-time progress monitoring and visualization support
 * 
 * This module implements Task ML-005 requirements for genetic algorithm
 * optimization of trading strategy parameters with enterprise-grade features.
 */

// Core optimization components
export { 
  GeneticOptimizer,
  GeneticOptimizationConfig,
  OptimizationProgress,
  OptimizationResult,
  GENETIC_OPTIMIZER_CONFIGS
} from './GeneticOptimizer';

export {
  StrategyDNA,
  StrategyGenes,
  DNAEncoding,
  ParameterDefinition,
  ValidationResult,
  ParameterUtils
} from './StrategyDNA';

export {
  FitnessEvaluator,
  FitnessScores,
  OptimizationObjective,
  FitnessConstraint,
  FitnessConfig,
  TradingObjectives
} from './FitnessEvaluator';

export {
  PopulationManager,
  Individual,
  Population,
  ParetoFrontier
} from './PopulationManager';

export {
  OptimizationAnalyzer,
  OptimizationReport,
  ParetoFrontierAnalysis,
  ParameterSensitivityReport
} from './OptimizationAnalyzer';

// Utility functions and factory methods
import { GeneticOptimizer, GENETIC_OPTIMIZER_CONFIGS, GeneticOptimizationConfig } from './GeneticOptimizer';
import { StrategyDNA, ParameterUtils } from './StrategyDNA';
import { FitnessEvaluator, TradingObjectives } from './FitnessEvaluator';
import { BacktestEngine } from '../../../backend/backtesting/BacktestEngine';

/**
 * Factory function to create a complete genetic optimization system
 */
export function createGeneticOptimizer(
  backtestEngine: BacktestEngine,
  parameterSpace: Record<string, any>,
  config: Partial<GeneticOptimizationConfig> = {}
): GeneticOptimizer {
  
  // Default to thorough optimization if no config specified
  const defaultConfig = config.algorithm ? config : GENETIC_OPTIMIZER_CONFIGS.thoroughOptimization;
  
  // Merge with provided config
  const finalConfig: GeneticOptimizationConfig = {
    ...defaultConfig,
    ...config,
    // Ensure objectives are set
    objectives: config.objectives || [
      TradingObjectives.totalReturn,
      TradingObjectives.sharpeRatio,
      TradingObjectives.maxDrawdown
    ]
  };
  
  return new GeneticOptimizer(finalConfig, backtestEngine, parameterSpace);
}

/**
 * Create parameter space for common trading strategies
 */
export function createTradingParameterSpace(): Record<string, any> {
  return ParameterUtils.tradingParameters();
}

/**
 * Create fitness evaluator with trading-specific objectives
 */
export function createTradingFitnessEvaluator(backtestEngine: BacktestEngine): FitnessEvaluator {
  const objectives = [
    TradingObjectives.totalReturn,
    TradingObjectives.sharpeRatio,
    TradingObjectives.maxDrawdown,
    TradingObjectives.winRate
  ];
  
  return new FitnessEvaluator(objectives, backtestEngine);
}

/**
 * Quick optimization preset for fast testing
 */
export async function quickOptimize(
  backtestEngine: BacktestEngine,
  baseStrategy: any,
  parameterSpace?: Record<string, any>
): Promise<any> {
  
  const parameters = parameterSpace || createTradingParameterSpace();
  const optimizer = createGeneticOptimizer(backtestEngine, parameters, GENETIC_OPTIMIZER_CONFIGS.quickOptimization);
  
  // Default backtest configuration
  const backtestConfig = {
    id: `quick_opt_${Date.now()}`,
    name: 'Quick Optimization',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    endDate: new Date(),
    timeframe: '1h' as const,
    symbols: ['BTC-USD'],
    dataSource: 'dydx' as const,
    initialCapital: 100000,
    currency: 'USD',
    commission: 0.001,
    slippage: 0.0005,
    latency: 50,
    fillRatio: 0.95,
    maxPositionSize: 0.5,
    maxDrawdown: 0.3,
    strategyConfig: {},
    warmupPeriod: 100,
    enableReinvestment: true,
    compoundReturns: true,
    includeWeekends: false,
    created: new Date(),
    updated: new Date()
  };
  
  return await optimizer.optimize(baseStrategy, backtestConfig);
}

/**
 * Production optimization preset for comprehensive analysis
 */
export async function productionOptimize(
  backtestEngine: BacktestEngine,
  baseStrategy: any,
  parameterSpace?: Record<string, any>,
  options: {
    timeframe?: string;
    symbols?: string[];
    duration?: number; // days
    objectives?: any[];
  } = {}
): Promise<any> {
  
  const parameters = parameterSpace || createTradingParameterSpace();
  
  // Create custom config with provided objectives
  const config = {
    ...GENETIC_OPTIMIZER_CONFIGS.thoroughOptimization,
    objectives: options.objectives || [
      TradingObjectives.totalReturn,
      TradingObjectives.sharpeRatio,
      TradingObjectives.maxDrawdown,
      TradingObjectives.calmarRatio
    ]
  };
  
  const optimizer = createGeneticOptimizer(backtestEngine, parameters, config);
  
  // Enhanced backtest configuration
  const duration = options.duration || 365; // Default 1 year
  const backtestConfig = {
    id: `prod_opt_${Date.now()}`,
    name: 'Production Optimization',
    startDate: new Date(Date.now() - duration * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    timeframe: (options.timeframe || '1h') as any,
    symbols: options.symbols || ['BTC-USD', 'ETH-USD'],
    dataSource: 'dydx' as const,
    initialCapital: 100000,
    currency: 'USD',
    commission: 0.001,
    slippage: 0.0005,
    latency: 50,
    fillRatio: 0.95,
    maxPositionSize: 0.3,
    maxDrawdown: 0.2,
    strategyConfig: {},
    warmupPeriod: 200,
    enableReinvestment: true,
    compoundReturns: true,
    includeWeekends: false,
    created: new Date(),
    updated: new Date()
  };
  
  return await optimizer.optimize(baseStrategy, backtestConfig, {
    progressCallback: (progress) => {
      console.log(`🧬 Generation ${progress.generation}/${progress.totalGenerations}: ` +
                  `Best fitness: ${progress.bestFitness.overall.toFixed(4)}, ` +
                  `Diversity: ${progress.diversityIndex.toFixed(3)}`);
    }
  });
}

/**
 * Multi-objective optimization with Pareto frontier analysis
 */
export async function multiObjectiveOptimize(
  backtestEngine: BacktestEngine,
  baseStrategy: any,
  objectives: any[],
  parameterSpace?: Record<string, any>
): Promise<any> {
  
  const parameters = parameterSpace || createTradingParameterSpace();
  
  const config: GeneticOptimizationConfig = {
    ...GENETIC_OPTIMIZER_CONFIGS.thoroughOptimization,
    algorithm: 'genetic_nsga2', // Use NSGA-II for multi-objective
    objectives,
    paretoOptimization: true,
    diversityMaintenance: true,
    crowdingDistance: true
  };
  
  const optimizer = createGeneticOptimizer(backtestEngine, parameters, config);
  
  const backtestConfig = {
    id: `multi_obj_opt_${Date.now()}`,
    name: 'Multi-Objective Optimization',
    startDate: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000), // 2 years
    endDate: new Date(),
    timeframe: '1h' as const,
    symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
    dataSource: 'dydx' as const,
    initialCapital: 100000,
    currency: 'USD',
    commission: 0.001,
    slippage: 0.0005,
    latency: 50,
    fillRatio: 0.95,
    maxPositionSize: 0.25,
    maxDrawdown: 0.15,
    strategyConfig: {},
    warmupPeriod: 300,
    enableReinvestment: true,
    compoundReturns: true,
    includeWeekends: false,
    created: new Date(),
    updated: new Date()
  };
  
  return await optimizer.optimize(baseStrategy, backtestConfig, {
    progressCallback: (progress) => {
      console.log(`🎯 Multi-objective optimization - Generation ${progress.generation}: ` +
                  `Pareto front size: ${progress.paretoFrontSize}, ` +
                  `Hypervolume: ${progress.hypervolume?.toFixed(4) || 'N/A'}`);
    }
  });
}

/**
 * Validate optimization system with test parameters
 */
export async function validateOptimizationSystem(backtestEngine: BacktestEngine): Promise<boolean> {
  try {
    console.log('🔧 Validating genetic optimization system...');
    
    // Create test parameter space
    const testParameters = {
      testParam1: ParameterUtils.floatParam(0.1, 1.0, { name: 'testParam1' }),
      testParam2: ParameterUtils.integerParam(10, 100, { name: 'testParam2' }),
      testParam3: ParameterUtils.booleanParam({ name: 'testParam3' })
    };
    
    // Create test strategy
    const testStrategy = {
      name: 'TestStrategy',
      parameters: {
        testParam1: 0.5,
        testParam2: 50,
        testParam3: true
      }
    };
    
    // Run quick optimization
    const result = await quickOptimize(backtestEngine, testStrategy, testParameters);
    
    // Validate results
    const validationChecks = [
      result.success === true || result.bestFitness !== undefined,
      result.totalEvaluations > 0,
      result.bestParameters !== undefined,
      result.convergenceGeneration >= 0
    ];
    
    const isValid = validationChecks.every(check => check);
    
    if (isValid) {
      console.log('✅ Genetic optimization system validation successful');
      console.log(`🎯 Best fitness achieved: ${result.bestFitness?.overall?.toFixed(4) || 'N/A'}`);
      console.log(`⏱️  Converged in ${result.convergenceGeneration} generations`);
    } else {
      console.error('❌ Genetic optimization system validation failed');
      console.error('Failed validation checks:', validationChecks);
    }
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Optimization system validation error:', error);
    return false;
  }
}

/**
 * Performance benchmarking utility
 */
export async function benchmarkOptimizationPerformance(
  backtestEngine: BacktestEngine,
  testCases: Array<{
    populationSize: number;
    generations: number;
    parameterCount: number;
  }> = [
    { populationSize: 20, generations: 10, parameterCount: 5 },
    { populationSize: 50, generations: 20, parameterCount: 10 },
    { populationSize: 100, generations: 50, parameterCount: 15 }
  ]
): Promise<Array<{ testCase: any; duration: number; evaluationsPerSecond: number }>> {
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`📊 Benchmarking: ${testCase.populationSize} pop, ${testCase.generations} gen, ${testCase.parameterCount} params`);
    
    // Generate parameter space
    const parameterSpace: Record<string, any> = {};
    for (let i = 0; i < testCase.parameterCount; i++) {
      parameterSpace[`param_${i}`] = ParameterUtils.floatParam(0, 1, { name: `param_${i}` });
    }
    
    const config = {
      ...GENETIC_OPTIMIZER_CONFIGS.quickOptimization,
      populationSize: testCase.populationSize,
      maxGenerations: testCase.generations
    };
    
    const optimizer = createGeneticOptimizer(backtestEngine, parameterSpace, config);
    
    const testStrategy = { name: 'BenchmarkStrategy', parameters: {} };
    const startTime = Date.now();
    
    try {
      const result = await optimizer.optimize(testStrategy, {
        id: `benchmark_${Date.now()}`,
        name: 'Benchmark Test',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
        endDate: new Date(),
        timeframe: '4h' as const,
        symbols: ['BTC-USD'],
        dataSource: 'dydx' as const,
        initialCapital: 100000,
        currency: 'USD',
        commission: 0.001,
        slippage: 0.0005,
        latency: 50,
        fillRatio: 0.95,
        maxPositionSize: 0.5,
        maxDrawdown: 0.5,
        strategyConfig: {},
        warmupPeriod: 50,
        enableReinvestment: true,
        compoundReturns: true,
        includeWeekends: false,
        created: new Date(),
        updated: new Date()
      });
      
      const duration = Date.now() - startTime;
      const totalEvaluations = testCase.populationSize * testCase.generations;
      const evaluationsPerSecond = (totalEvaluations / duration) * 1000;
      
      results.push({
        testCase,
        duration,
        evaluationsPerSecond
      });
      
      console.log(`✅ Benchmark completed: ${duration}ms, ${evaluationsPerSecond.toFixed(2)} eval/sec`);
      
    } catch (error) {
      console.error(`❌ Benchmark failed for test case:`, testCase, error);
      results.push({
        testCase,
        duration: -1,
        evaluationsPerSecond: 0
      });
    }
  }
  
  // Summary
  console.log('\n📈 Benchmark Summary:');
  results.forEach((result, index) => {
    if (result.duration > 0) {
      console.log(`Test ${index + 1}: ${result.evaluationsPerSecond.toFixed(2)} evaluations/second`);
    } else {
      console.log(`Test ${index + 1}: FAILED`);
    }
  });
  
  return results;
}

// Export commonly used constants
export const DEFAULT_TRADING_OBJECTIVES = [
  TradingObjectives.totalReturn,
  TradingObjectives.sharpeRatio,
  TradingObjectives.maxDrawdown
];

export const MULTI_OBJECTIVE_SET = [
  TradingObjectives.totalReturn,
  TradingObjectives.sharpeRatio,
  TradingObjectives.maxDrawdown,
  TradingObjectives.winRate,
  TradingObjectives.calmarRatio
];

export const RISK_FOCUSED_OBJECTIVES = [
  TradingObjectives.sharpeRatio,
  TradingObjectives.maxDrawdown,
  TradingObjectives.volatility,
  TradingObjectives.calmarRatio
];

/**
 * Export version information
 */
export const ML_OPTIMIZATION_VERSION = {
  version: '1.0.0',
  build: Date.now(),
  features: [
    'Genetic Algorithm Optimization',
    'Multi-Objective Optimization (NSGA-II)',
    'Parameter DNA Encoding',
    'Advanced Fitness Evaluation',
    'Population Management',
    'Pareto Frontier Analysis',
    'Real-time Progress Monitoring',
    'Backtesting Integration',
    'Performance Benchmarking'
  ],
  performance: {
    maxPopulationSize: 500,
    maxGenerations: 1000,
    maxParameters: 50,
    targetEvaluationRate: 100, // evaluations per hour
    memoryEfficiency: '<1GB for 100 population'
  }
};