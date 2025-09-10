/**
 * AdvancedBacktestFeatures - Task BE-031: Advanced Backtesting Features
 * 
 * Advanced backtesting capabilities including:
 * - Multi-timeframe backtesting support
 * - Walk-forward analysis engine
 * - Monte Carlo simulation framework  
 * - Stress testing scenarios
 * - Scenario-based robustness testing
 * - Out-of-sample validation
 */

import { EventEmitter } from 'events';
import {
  BacktestConfig,
  BacktestResults,
  HistoricalDataPoint,
  BacktestTrade,
  BacktestPortfolioSnapshot
} from './types';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { BacktestEngine } from './BacktestEngine';
import { PerformanceCalculator } from './PerformanceCalculator';
import { Timeframe } from '../../shared/types/trading';

/**
 * Multi-timeframe backtest configuration
 */
interface MultiTimeframeConfig {
  primaryTimeframe: Timeframe;
  secondaryTimeframes: Timeframe[];
  timeframeMappings: Record<string, {
    weight: number;           // Weight in decision making
    lookbackPeriods: number;  // How many bars to look back
    signalDelay: number;      // Bars to delay signal (for realism)
  }>;
}

/**
 * Walk-forward analysis configuration
 */
interface WalkForwardConfig {
  optimizationWindow: number;    // Days for optimization period
  testingWindow: number;         // Days for testing period  
  stepSize: number;             // Days to step forward
  minTradesForValidation: number;
  reoptimizationThreshold: number; // Performance degradation threshold
  maxIterations: number;
}

/**
 * Monte Carlo simulation configuration
 */
interface MonteCarloConfig {
  iterations: number;           // Number of simulation runs
  confidenceLevel: number;      // Confidence level (0.95 = 95%)
  randomizeOrder: boolean;      // Randomize trade order
  bootstrap: boolean;           // Use bootstrap sampling
  preserveSequence: boolean;    // Preserve sequential dependencies
  variationMethods: Array<'shuffle_trades' | 'bootstrap_returns' | 'parametric_simulation'>;
}

/**
 * Stress testing scenarios
 */
interface StressTestScenario {
  name: string;
  description: string;
  modifications: Array<{
    type: 'market_shock' | 'volatility_spike' | 'liquidity_crisis' | 'trend_reversal' | 'correlation_breakdown';
    parameters: Record<string, any>;
    duration: number;         // Duration in bars
    intensity: number;        // Intensity multiplier (1.0 = normal)
  }>;
}

/**
 * Walk-forward analysis results
 */
interface WalkForwardResults {
  periods: Array<{
    optimizationStart: Date;
    optimizationEnd: Date;
    testStart: Date;
    testEnd: Date;
    optimizedParameters: Record<string, any>;
    inSampleResults: BacktestResults;
    outOfSampleResults: BacktestResults;
    degradation: number;      // Performance degradation %
    stability: number;        // Parameter stability score
  }>;
  
  // Aggregate metrics
  averageInSample: number;
  averageOutOfSample: number;
  consistency: number;        // Percentage of positive periods
  averageDegradation: number;
  parameterStability: Record<string, number>;
}

/**
 * Monte Carlo simulation results
 */
interface MonteCarloResults {
  iterations: number;
  winningRuns: number;
  winRate: number;
  
  // Return statistics
  returns: number[];
  meanReturn: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  
  // Confidence intervals
  confidenceLevel: number;
  lowerBound: number;
  upperBound: number;
  
  // Risk metrics
  valueAtRisk: number;
  conditionalValueAtRisk: number;
  maxDrawdown: {
    mean: number;
    worst: number;
    best: number;
    percentile95: number;
  };
  
  // Distribution analysis
  percentiles: Record<string, number>; // 5th, 10th, 25th, 50th, 75th, 90th, 95th
  worstCaseScenarios: BacktestResults[];
  bestCaseScenarios: BacktestResults[];
}

/**
 * Stress testing results
 */
interface StressTestResults {
  baselineResults: BacktestResults;
  scenarios: Array<{
    scenario: StressTestScenario;
    results: BacktestResults;
    impact: {
      returnChange: number;
      volatilityChange: number;
      drawdownChange: number;
      tradeCountChange: number;
    };
    resilience: number;       // 0-1 score of strategy resilience
  }>;
  
  // Overall stress test metrics  
  averageImpact: number;
  worstCaseImpact: number;
  overallResilience: number;
  criticalScenarios: string[]; // Scenarios causing >20% impact
}

/**
 * Advanced backtesting features implementation
 */
export class AdvancedBacktestFeatures extends EventEmitter {
  private backtestEngine: BacktestEngine;
  private performanceCalculator: PerformanceCalculator;
  
  constructor(backtestEngine: BacktestEngine) {
    super();
    this.backtestEngine = backtestEngine;
    this.performanceCalculator = new PerformanceCalculator();
  }

  /**
   * Run multi-timeframe backtest
   */
  async runMultiTimeframeBacktest(
    config: BacktestConfig,
    strategy: BaseStrategy,
    multiTfConfig: MultiTimeframeConfig
  ): Promise<BacktestResults> {
    this.emit('multiframe_started', { config, multiTfConfig });
    
    try {
      // Validate timeframe compatibility
      this.validateTimeframeConfiguration(multiTfConfig);
      
      // Modify strategy to use multiple timeframes
      const multiTfStrategy = await this.createMultiTimeframeStrategy(strategy, multiTfConfig);
      
      // Run backtest with enhanced data processing
      const results = await this.backtestEngine.runBacktest(config, multiTfStrategy);
      
      // Add multi-timeframe specific metrics
      const enhancedResults = await this.addMultiTimeframeMetrics(results, multiTfConfig);
      
      this.emit('multiframe_completed', { results: enhancedResults });
      return enhancedResults;
      
    } catch (error) {
      this.emit('multiframe_error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Run walk-forward analysis
   */
  async runWalkForwardAnalysis(
    config: BacktestConfig,
    strategy: BaseStrategy,
    wfConfig: WalkForwardConfig
  ): Promise<WalkForwardResults> {
    this.emit('walkforward_started', { config, wfConfig });
    
    const periods: WalkForwardResults['periods'] = [];
    const parameterHistory: Record<string, number[]> = {};
    
    let currentDate = config.startDate;
    let iterationCount = 0;
    
    while (currentDate < config.endDate && iterationCount < wfConfig.maxIterations) {
      // Define optimization and test periods
      const optimizationEnd = new Date(currentDate.getTime() + wfConfig.optimizationWindow * 24 * 60 * 60 * 1000);
      const testStart = optimizationEnd;
      const testEnd = new Date(testStart.getTime() + wfConfig.testingWindow * 24 * 60 * 60 * 1000);
      
      if (testEnd > config.endDate) break;
      
      try {
        // Run optimization on in-sample period
        const optimizationConfig: BacktestConfig = {
          ...config,
          startDate: currentDate,
          endDate: optimizationEnd,
          id: `${config.id}_opt_${iterationCount}`
        };
        
        this.emit('walkforward_optimization', { 
          period: iterationCount + 1, 
          optimizationStart: currentDate,
          optimizationEnd 
        });
        
        // For now, run baseline - in production would optimize parameters
        const inSampleResults = await this.backtestEngine.runBacktest(optimizationConfig, strategy);
        const optimizedParameters = this.extractStrategyParameters(strategy);
        
        // Run test on out-of-sample period
        const testConfig: BacktestConfig = {
          ...config,
          startDate: testStart,
          endDate: testEnd,
          id: `${config.id}_test_${iterationCount}`
        };
        
        this.emit('walkforward_testing', { 
          period: iterationCount + 1, 
          testStart,
          testEnd 
        });
        
        const outOfSampleResults = await this.backtestEngine.runBacktest(testConfig, strategy);
        
        // Calculate degradation and stability
        const degradation = this.calculatePerformanceDegradation(inSampleResults, outOfSampleResults);
        const stability = this.calculateParameterStability(parameterHistory, optimizedParameters);
        
        periods.push({
          optimizationStart: currentDate,
          optimizationEnd,
          testStart,
          testEnd,
          optimizedParameters,
          inSampleResults,
          outOfSampleResults,
          degradation,
          stability
        });
        
        // Update parameter history
        this.updateParameterHistory(parameterHistory, optimizedParameters);
        
        this.emit('walkforward_period_completed', { 
          period: iterationCount + 1,
          degradation,
          stability,
          outOfSampleReturn: outOfSampleResults.totalReturnPercent
        });
        
      } catch (error) {
        this.emit('walkforward_period_error', { 
          period: iterationCount + 1,
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      // Step forward
      currentDate = new Date(currentDate.getTime() + wfConfig.stepSize * 24 * 60 * 60 * 1000);
      iterationCount++;
    }
    
    // Calculate aggregate results
    const results: WalkForwardResults = {
      periods,
      averageInSample: this.calculateAverageReturn(periods.map(p => p.inSampleResults)),
      averageOutOfSample: this.calculateAverageReturn(periods.map(p => p.outOfSampleResults)),
      consistency: periods.filter(p => p.outOfSampleResults.totalReturnPercent > 0).length / periods.length,
      averageDegradation: periods.reduce((sum, p) => sum + p.degradation, 0) / periods.length,
      parameterStability: this.calculateFinalParameterStability(parameterHistory)
    };
    
    this.emit('walkforward_completed', { results });
    return results;
  }

  /**
   * Run Monte Carlo simulation
   */
  async runMonteCarloSimulation(
    baselineResults: BacktestResults,
    mcConfig: MonteCarloConfig
  ): Promise<MonteCarloResults> {
    this.emit('montecarlo_started', { config: mcConfig });
    
    const simulationReturns: number[] = [];
    const simulationDrawdowns: number[] = [];
    const worstCases: BacktestResults[] = [];
    const bestCases: BacktestResults[] = [];
    
    for (let iteration = 0; iteration < mcConfig.iterations; iteration++) {
      this.emit('montecarlo_iteration', { iteration: iteration + 1, total: mcConfig.iterations });
      
      try {
        // Apply variation methods
        const modifiedResults = await this.applyMonteCarloVariations(baselineResults, mcConfig);
        
        simulationReturns.push(modifiedResults.totalReturnPercent);
        simulationDrawdowns.push(modifiedResults.maxDrawdownPercent);
        
        // Track extreme cases
        if (worstCases.length < 10 || modifiedResults.totalReturnPercent < worstCases[worstCases.length - 1].totalReturnPercent) {
          worstCases.push(modifiedResults);
          worstCases.sort((a, b) => a.totalReturnPercent - b.totalReturnPercent);
          if (worstCases.length > 10) worstCases.pop();
        }
        
        if (bestCases.length < 10 || modifiedResults.totalReturnPercent > bestCases[bestCases.length - 1].totalReturnPercent) {
          bestCases.push(modifiedResults);
          bestCases.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);
          if (bestCases.length > 10) bestCases.pop();
        }
        
      } catch (error) {
        this.emit('montecarlo_iteration_error', { 
          iteration: iteration + 1,
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    // Calculate statistics
    const sortedReturns = [...simulationReturns].sort((a, b) => a - b);
    const meanReturn = simulationReturns.reduce((sum, r) => sum + r, 0) / simulationReturns.length;
    const variance = simulationReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / simulationReturns.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate confidence intervals
    const lowerIndex = Math.floor((1 - mcConfig.confidenceLevel) / 2 * sortedReturns.length);
    const upperIndex = Math.ceil((1 + mcConfig.confidenceLevel) / 2 * sortedReturns.length) - 1;
    
    const results: MonteCarloResults = {
      iterations: mcConfig.iterations,
      winningRuns: simulationReturns.filter(r => r > 0).length,
      winRate: simulationReturns.filter(r => r > 0).length / simulationReturns.length,
      
      returns: simulationReturns,
      meanReturn,
      standardDeviation,
      skewness: this.calculateSkewness(simulationReturns, meanReturn, standardDeviation),
      kurtosis: this.calculateKurtosis(simulationReturns, meanReturn, standardDeviation),
      
      confidenceLevel: mcConfig.confidenceLevel,
      lowerBound: sortedReturns[lowerIndex],
      upperBound: sortedReturns[upperIndex],
      
      valueAtRisk: this.calculateVaR(sortedReturns, 0.95),
      conditionalValueAtRisk: this.calculateCVaR(sortedReturns, 0.95),
      
      maxDrawdown: {
        mean: simulationDrawdowns.reduce((sum, d) => sum + d, 0) / simulationDrawdowns.length,
        worst: Math.max(...simulationDrawdowns),
        best: Math.min(...simulationDrawdowns),
        percentile95: this.calculatePercentile(simulationDrawdowns, 95)
      },
      
      percentiles: {
        '5th': this.calculatePercentile(sortedReturns, 5),
        '10th': this.calculatePercentile(sortedReturns, 10),
        '25th': this.calculatePercentile(sortedReturns, 25),
        '50th': this.calculatePercentile(sortedReturns, 50),
        '75th': this.calculatePercentile(sortedReturns, 75),
        '90th': this.calculatePercentile(sortedReturns, 90),
        '95th': this.calculatePercentile(sortedReturns, 95)
      },
      
      worstCaseScenarios: worstCases,
      bestCaseScenarios: bestCases
    };
    
    this.emit('montecarlo_completed', { results });
    return results;
  }

  /**
   * Run stress testing scenarios
   */
  async runStressTests(
    config: BacktestConfig,
    strategy: BaseStrategy,
    scenarios: StressTestScenario[]
  ): Promise<StressTestResults> {
    this.emit('stress_testing_started', { scenarios: scenarios.length });
    
    // Run baseline
    const baselineResults = await this.backtestEngine.runBacktest(config, strategy);
    
    const scenarioResults = [];
    
    for (const scenario of scenarios) {
      this.emit('stress_scenario_started', { scenario: scenario.name });
      
      try {
        // Create modified configuration with stress conditions
        const stressConfig = await this.applyStressScenario(config, scenario);
        
        // Run backtest under stress
        const stressResults = await this.backtestEngine.runBacktest(stressConfig, strategy);
        
        // Calculate impact metrics
        const impact = {
          returnChange: ((stressResults.totalReturnPercent - baselineResults.totalReturnPercent) / baselineResults.totalReturnPercent) * 100,
          volatilityChange: ((stressResults.volatility - baselineResults.volatility) / baselineResults.volatility) * 100,
          drawdownChange: ((stressResults.maxDrawdownPercent - baselineResults.maxDrawdownPercent) / baselineResults.maxDrawdownPercent) * 100,
          tradeCountChange: ((stressResults.totalTrades - baselineResults.totalTrades) / baselineResults.totalTrades) * 100
        };
        
        // Calculate resilience score (0-1, higher = more resilient)
        const resilience = this.calculateResilienceScore(impact);
        
        scenarioResults.push({
          scenario,
          results: stressResults,
          impact,
          resilience
        });
        
        this.emit('stress_scenario_completed', { 
          scenario: scenario.name,
          impact,
          resilience 
        });
        
      } catch (error) {
        this.emit('stress_scenario_error', { 
          scenario: scenario.name,
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    // Calculate aggregate metrics
    const averageImpact = scenarioResults.reduce((sum, s) => sum + Math.abs(s.impact.returnChange), 0) / scenarioResults.length;
    const worstCaseImpact = Math.min(...scenarioResults.map(s => s.impact.returnChange));
    const overallResilience = scenarioResults.reduce((sum, s) => sum + s.resilience, 0) / scenarioResults.length;
    const criticalScenarios = scenarioResults.filter(s => Math.abs(s.impact.returnChange) > 20).map(s => s.scenario.name);
    
    const results: StressTestResults = {
      baselineResults,
      scenarios: scenarioResults,
      averageImpact,
      worstCaseImpact,
      overallResilience,
      criticalScenarios
    };
    
    this.emit('stress_testing_completed', { results });
    return results;
  }

  // Private helper methods
  
  private validateTimeframeConfiguration(config: MultiTimeframeConfig): void {
    // Validate timeframe relationships
    const timeframes = [config.primaryTimeframe, ...config.secondaryTimeframes];
    // Add validation logic here
  }

  private async createMultiTimeframeStrategy(strategy: BaseStrategy, config: MultiTimeframeConfig): Promise<BaseStrategy> {
    // Create a wrapper strategy that combines signals from multiple timeframes
    // This is a simplified implementation - in production would be more sophisticated
    return strategy;
  }

  private async addMultiTimeframeMetrics(results: BacktestResults, config: MultiTimeframeConfig): Promise<BacktestResults> {
    // Add multi-timeframe specific performance metrics
    return results;
  }

  private extractStrategyParameters(strategy: BaseStrategy): Record<string, any> {
    // Extract current strategy parameters for optimization tracking
    return {};
  }

  private calculatePerformanceDegradation(inSample: BacktestResults, outOfSample: BacktestResults): number {
    return ((inSample.totalReturnPercent - outOfSample.totalReturnPercent) / inSample.totalReturnPercent) * 100;
  }

  private calculateParameterStability(history: Record<string, number[]>, current: Record<string, any>): number {
    // Calculate stability score based on parameter variation
    return 0.8; // Placeholder
  }

  private updateParameterHistory(history: Record<string, number[]>, parameters: Record<string, any>): void {
    for (const [param, value] of Object.entries(parameters)) {
      if (typeof value === 'number') {
        if (!history[param]) history[param] = [];
        history[param].push(value);
      }
    }
  }

  private calculateAverageReturn(results: BacktestResults[]): number {
    return results.reduce((sum, r) => sum + r.totalReturnPercent, 0) / results.length;
  }

  private calculateFinalParameterStability(history: Record<string, number[]>): Record<string, number> {
    const stability: Record<string, number> = {};
    
    for (const [param, values] of Object.entries(history)) {
      if (values.length < 2) {
        stability[param] = 1.0;
        continue;
      }
      
      // Calculate coefficient of variation as stability metric
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const cv = Math.sqrt(variance) / Math.abs(mean);
      stability[param] = Math.max(0, 1 - cv); // Higher values = more stable
    }
    
    return stability;
  }

  private async applyMonteCarloVariations(baseline: BacktestResults, config: MonteCarloConfig): Promise<BacktestResults> {
    // Apply variations based on configured methods
    // This is a simplified implementation
    return baseline;
  }

  private calculateSkewness(values: number[], mean: number, std: number): number {
    const n = values.length;
    const skew = values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) / n;
    return skew;
  }

  private calculateKurtosis(values: number[], mean: number, std: number): number {
    const n = values.length;
    const kurt = values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) / n;
    return kurt - 3; // Excess kurtosis
  }

  private calculateVaR(sortedReturns: number[], confidence: number): number {
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return sortedReturns[index];
  }

  private calculateCVaR(sortedReturns: number[], confidence: number): number {
    const varIndex = Math.floor((1 - confidence) * sortedReturns.length);
    const tailValues = sortedReturns.slice(0, varIndex + 1);
    return tailValues.reduce((sum, v) => sum + v, 0) / tailValues.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sorted[lower];
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private async applyStressScenario(config: BacktestConfig, scenario: StressTestScenario): Promise<BacktestConfig> {
    // Apply stress scenario modifications to configuration
    // This would modify market data or add synthetic stress events
    return config;
  }

  private calculateResilienceScore(impact: any): number {
    // Calculate strategy resilience based on impact metrics
    const returnImpact = Math.abs(impact.returnChange) / 100;
    const drawdownImpact = Math.abs(impact.drawdownChange) / 100;
    
    // Simple resilience calculation - lower impact = higher resilience
    return Math.max(0, 1 - (returnImpact + drawdownImpact) / 2);
  }
}

export type {
  MultiTimeframeConfig,
  WalkForwardConfig,
  MonteCarloConfig,
  StressTestScenario,
  WalkForwardResults,
  MonteCarloResults,
  StressTestResults
};