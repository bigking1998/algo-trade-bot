/**
 * Backtesting Module Index - Advanced Backtesting Engine Suite
 * 
 * Central export point for all backtesting components including:
 * - Core backtesting engine and simulation components
 * - Advanced backtesting features (multi-timeframe, Monte Carlo, walk-forward)
 * - Optimization engines (Genetic Algorithm, Bayesian Optimization)
 * - Cross-validation framework and statistical testing
 * - Advanced risk metrics and performance analysis
 */

// Core backtesting engine
export { BacktestEngine } from './BacktestEngine';

// Portfolio simulation
export { default as PortfolioSimulator } from './PortfolioSimulator';

// Execution simulation
export { default as ExecutionSimulator } from './ExecutionSimulator';

// Performance calculation
export { PerformanceCalculator } from './PerformanceCalculator';

// Risk analysis
export { default as RiskAnalyzer } from './RiskAnalyzer';

// Historical data providers
export {
  DydxHistoricalDataProvider
} from './HistoricalDataProvider';

// Advanced backtesting features (Task BE-031)
export { AdvancedBacktestFeatures } from './AdvancedBacktestFeatures';
export type {
  MultiTimeframeConfig,
  WalkForwardConfig,
  MonteCarloConfig,
  StressTestScenario,
  WalkForwardResults,
  MonteCarloResults,
  StressTestResults
} from './AdvancedBacktestFeatures';

// Optimization engine (Task BE-032)
export { OptimizationEngine } from './OptimizationEngine';
export type {
  OptimizationParameter,
  OptimizationObjective,
  ParameterCombination,
  OptimizationResults,
  GeneticAlgorithmConfig,
  BayesianOptimizationConfig
} from './OptimizationEngine';

// Bayesian optimization (Task BE-033)
export {
  BayesianOptimization,
  RBFKernel,
  MaternKernel,
  ExpectedImprovement,
  ProbabilityOfImprovement,
  UpperConfidenceBound,
  GaussianProcess
} from './BayesianOptimization';
export type { Kernel, AcquisitionFunction } from './BayesianOptimization';

// Genetic algorithm (Task BE-034)
export {
  GeneticAlgorithm,
  TournamentSelection,
  RouletteWheelSelection,
  NSGAIISelection,
  SimulatedBinaryCrossover,
  PolynomialMutation
} from './GeneticAlgorithm';
export type {
  Individual,
  GAParameter,
  Objective,
  SelectionStrategy,
  CrossoverOperator,
  MutationOperator,
  GAConfiguration
} from './GeneticAlgorithm';

// Optimization analysis (Task BE-035)
export { OptimizationAnalyzer } from './OptimizationAnalyzer';
export type {
  SensitivityAnalysis,
  StabilityMetrics,
  RobustnessTestConfig,
  RobustnessTestResults,
  PerformanceSurface
} from './OptimizationAnalyzer';

// Cross-validation framework (Task BE-037)
export { CrossValidationFramework } from './CrossValidationFramework';
export type {
  CVFold,
  CrossValidationConfig,
  CVFoldResult,
  CrossValidationResults
} from './CrossValidationFramework';

// Advanced risk metrics (Task BE-038)
export { AdvancedRiskMetrics } from './AdvancedRiskMetrics';
export type {
  RiskMetricsConfig,
  VaRResults,
  AdvancedRiskMetricsResults,
  RegimeAnalysisResults
} from './AdvancedRiskMetrics';

// Types and interfaces
export * from './types';

// API routes
export { handleBacktestingRoute } from '../routes/backtesting';