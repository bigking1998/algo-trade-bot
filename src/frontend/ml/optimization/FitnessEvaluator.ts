/**
 * FitnessEvaluator - Multi-Objective Fitness Evaluation System (ML-005)
 * 
 * Implements comprehensive fitness evaluation for strategy optimization with:
 * - Multi-objective optimization support (returns, risk, drawdown, Sharpe ratio)
 * - Custom fitness functions with weight balancing
 * - Backtesting integration for realistic performance evaluation
 * - Risk-adjusted metrics and constraint handling
 * - Pareto optimality analysis
 * - Performance attribution and sensitivity analysis
 * 
 * The fitness evaluator transforms backtesting results into optimization scores
 * that guide the genetic algorithm toward better trading strategies.
 */

import { BacktestEngine } from '../../../backend/backtesting/BacktestEngine';
import { BacktestResults, BacktestConfig } from '../../../backend/backtesting/types';

export interface OptimizationObjective {
  name: string;
  type: 'maximize' | 'minimize';
  weight: number;
  description: string;
  
  // Objective function
  calculate: (results: BacktestResults) => number;
  
  // Normalization parameters
  expectedMin?: number;
  expectedMax?: number;
  
  // Constraint parameters
  minAcceptable?: number;
  maxAcceptable?: number;
  
  // Priority and importance
  priority: 'critical' | 'high' | 'medium' | 'low';
  importance: number; // 0-1 scale
}

export interface FitnessScores {
  overall: number; // Weighted combination of all objectives
  objectives: Array<{
    name: string;
    rawValue: number;
    normalizedScore: number;
    weight: number;
  }>;
  constraints: Array<{
    name: string;
    satisfied: boolean;
    violation: number;
    penalty: number;
  }>;
  
  // Additional metrics
  dominanceRank?: number; // For multi-objective optimization
  crowdingDistance?: number; // For diversity preservation
  robustnessScore?: number; // Parameter sensitivity measure
  
  // Performance attribution
  riskAdjustedReturn: number;
  volatilityNormalized: number;
  drawdownPenalty: number;
  
  // Constraint satisfaction
  constraintViolations: number;
  feasible: boolean;
}

export interface FitnessConstraint {
  name: string;
  type: 'hard' | 'soft';
  description: string;
  evaluate: (results: BacktestResults) => { satisfied: boolean; violation: number };
  penalty: number; // Penalty weight for constraint violations
}

export interface FitnessConfig {
  objectives: OptimizationObjective[];
  constraints: FitnessConstraint[];
  
  // Normalization settings
  useRankBasedScaling: boolean;
  adaptiveScaling: boolean;
  outlierHandling: 'clip' | 'winsorize' | 'reject';
  
  // Multi-objective settings
  aggregationMethod: 'weighted_sum' | 'weighted_product' | 'tchebycheff' | 'epsilon_constraint';
  paretoOptimization: boolean;
  diversityPreservation: boolean;
  
  // Risk management
  riskAversion: number; // 0 = risk neutral, 1 = very risk averse
  drawdownTolerance: number;
  volatilityPenalty: number;
  
  // Performance requirements
  minimumSharpeRatio: number;
  minimumWinRate: number;
  maximumDrawdown: number;
  
  // Robustness testing
  sensitivityAnalysis: boolean;
  parameterPerturbation: number;
  
  // Caching and performance
  enableResultCaching: boolean;
  cacheTimeout: number; // minutes
}

interface CachedResult {
  parameters: string; // JSON stringified parameters
  fitness: FitnessScores;
  timestamp: Date;
  backtestResults: BacktestResults;
}

/**
 * Advanced Multi-Objective Fitness Evaluation System
 */
export class FitnessEvaluator {
  private objectives: OptimizationObjective[];
  private constraints: FitnessConstraint[];
  private config: FitnessConfig;
  private backtestEngine: BacktestEngine;
  
  // Caching system
  private cache = new Map<string, CachedResult>();
  private evaluationHistory: Array<{
    parameters: Record<string, any>;
    fitness: FitnessScores;
    timestamp: Date;
  }> = [];
  
  // Statistical tracking
  private fitnessStats = {
    evaluationCount: 0,
    cacheHits: 0,
    averageEvaluationTime: 0,
    objectiveRanges: new Map<string, { min: number; max: number; mean: number; std: number }>()
  };
  
  // Custom fitness function
  private customFitnessFunction?: (results: BacktestResults) => FitnessScores;
  
  // Performance tracking
  private evaluationTimes: number[] = [];

  constructor(objectives: OptimizationObjective[], backtestEngine: BacktestEngine, config?: Partial<FitnessConfig>) {
    this.objectives = objectives;
    this.backtestEngine = backtestEngine;
    this.config = {
      objectives,
      constraints: [],
      useRankBasedScaling: false,
      adaptiveScaling: true,
      outlierHandling: 'clip',
      aggregationMethod: 'weighted_sum',
      paretoOptimization: objectives.length > 1,
      diversityPreservation: true,
      riskAversion: 0.3,
      drawdownTolerance: 0.2,
      volatilityPenalty: 0.5,
      minimumSharpeRatio: 0.5,
      minimumWinRate: 0.45,
      maximumDrawdown: 0.3,
      sensitivityAnalysis: false,
      parameterPerturbation: 0.05,
      enableResultCaching: true,
      cacheTimeout: 60,
      ...config
    };
    
    // Initialize default constraints
    this.constraints = this.config.constraints.length > 0 ? this.config.constraints : this.createDefaultConstraints();
    
    console.log(`💯 Fitness Evaluator initialized with ${this.objectives.length} objectives and ${this.constraints.length} constraints`);
  }

  /**
   * Evaluate strategy parameters and return comprehensive fitness scores
   */
  async evaluate(
    parameters: Record<string, any>,
    baseStrategy?: any,
    backtestConfig?: BacktestConfig
  ): Promise<FitnessScores> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(parameters);
      if (this.config.enableResultCaching && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (this.isCacheValid(cached)) {
          this.fitnessStats.cacheHits++;
          return cached.fitness;
        } else {
          this.cache.delete(cacheKey);
        }
      }
      
      // Run backtest with parameters
      const backtestResults = await this.runBacktest(parameters, baseStrategy, backtestConfig);
      
      // Calculate fitness scores
      const fitness = await this.calculateFitness(backtestResults, parameters);
      
      // Cache results
      if (this.config.enableResultCaching) {
        this.cache.set(cacheKey, {
          parameters: JSON.stringify(parameters),
          fitness,
          timestamp: new Date(),
          backtestResults
        });
      }
      
      // Update statistics
      this.updateStatistics(fitness, Date.now() - startTime);
      
      // Store in history
      this.evaluationHistory.push({
        parameters: { ...parameters },
        fitness,
        timestamp: new Date()
      });
      
      return fitness;
      
    } catch (error) {
      console.error('Fitness evaluation failed:', error);
      
      // Return penalty fitness for failed evaluations
      return this.getPenaltyFitness();
    }
  }

  /**
   * Set custom fitness function
   */
  setCustomFitnessFunction(customFn: (results: BacktestResults) => FitnessScores): void {
    this.customFitnessFunction = customFn;
  }

  /**
   * Get penalty fitness for constraint violations or failed evaluations
   */
  getPenaltyFitness(): FitnessScores {
    const objectives = this.objectives.map(obj => ({
      name: obj.name,
      rawValue: obj.type === 'maximize' ? -Infinity : Infinity,
      normalizedScore: 0,
      weight: obj.weight
    }));
    
    const constraints = this.constraints.map(constraint => ({
      name: constraint.name,
      satisfied: false,
      violation: 1,
      penalty: constraint.penalty
    }));
    
    return {
      overall: -1000, // Large penalty
      objectives,
      constraints,
      riskAdjustedReturn: -1,
      volatilityNormalized: 0,
      drawdownPenalty: 1000,
      constraintViolations: constraints.length,
      feasible: false
    };
  }

  /**
   * Normalize scores using adaptive scaling
   */
  normalizeScores(rawScores: number[], objectiveName: string): number[] {
    const stats = this.fitnessStats.objectiveRanges.get(objectiveName);
    if (!stats || rawScores.length === 0) {
      return rawScores.map(() => 0.5); // Default middle value
    }
    
    if (this.config.useRankBasedScaling) {
      return this.rankBasedNormalization(rawScores);
    } else {
      return this.minMaxNormalization(rawScores, stats.min, stats.max);
    }
  }

  /**
   * Calculate Pareto dominance between two fitness scores
   */
  dominates(fitness1: FitnessScores, fitness2: FitnessScores): boolean {
    let betterInAtLeastOne = false;
    
    for (let i = 0; i < fitness1.objectives.length; i++) {
      const obj1 = fitness1.objectives[i];
      const obj2 = fitness2.objectives[i];
      const objective = this.objectives.find(o => o.name === obj1.name);
      
      if (!objective) continue;
      
      if (objective.type === 'maximize') {
        if (obj1.normalizedScore < obj2.normalizedScore) return false;
        if (obj1.normalizedScore > obj2.normalizedScore) betterInAtLeastOne = true;
      } else {
        if (obj1.normalizedScore > obj2.normalizedScore) return false;
        if (obj1.normalizedScore < obj2.normalizedScore) betterInAtLeastOne = true;
      }
    }
    
    return betterInAtLeastOne;
  }

  /**
   * Get evaluation statistics
   */
  getStats() {
    return {
      ...this.fitnessStats,
      cacheSize: this.cache.size,
      historySize: this.evaluationHistory.length,
      averageEvaluationTime: this.evaluationTimes.length > 0 ? 
        this.evaluationTimes.reduce((sum, time) => sum + time, 0) / this.evaluationTimes.length : 0
    };
  }

  /**
   * Clear cache and reset statistics
   */
  reset(): void {
    this.cache.clear();
    this.evaluationHistory = [];
    this.evaluationTimes = [];
    this.fitnessStats = {
      evaluationCount: 0,
      cacheHits: 0,
      averageEvaluationTime: 0,
      objectiveRanges: new Map()
    };
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  private async runBacktest(
    parameters: Record<string, any>,
    baseStrategy?: any,
    backtestConfig?: BacktestConfig
  ): Promise<BacktestResults> {
    // Integrate parameters into strategy configuration
    const strategyConfig = {
      ...baseStrategy,
      parameters: {
        ...baseStrategy?.parameters,
        ...parameters
      }
    };
    
    // Use provided config or create default
    const config = backtestConfig || this.createDefaultBacktestConfig();
    config.strategyConfig = strategyConfig;
    
    // Run backtest
    const results = await this.backtestEngine.runBacktest(config);
    return results;
  }

  private async calculateFitness(results: BacktestResults, parameters: Record<string, any>): Promise<FitnessScores> {
    // Use custom fitness function if provided
    if (this.customFitnessFunction) {
      return this.customFitnessFunction(results);
    }
    
    // Calculate objective scores
    const objectiveScores = this.objectives.map(objective => {
      const rawValue = objective.calculate(results);
      const normalizedScore = this.normalizeObjectiveValue(rawValue, objective);
      
      return {
        name: objective.name,
        rawValue,
        normalizedScore,
        weight: objective.weight
      };
    });
    
    // Evaluate constraints
    const constraintResults = this.constraints.map(constraint => {
      const evaluation = constraint.evaluate(results);
      return {
        name: constraint.name,
        satisfied: evaluation.satisfied,
        violation: evaluation.violation,
        penalty: evaluation.satisfied ? 0 : constraint.penalty * evaluation.violation
      };
    });
    
    // Calculate overall fitness
    const overall = this.calculateOverallFitness(objectiveScores, constraintResults);
    
    // Additional metrics
    const riskAdjustedReturn = this.calculateRiskAdjustedReturn(results);
    const volatilityNormalized = this.normalizeVolatility(results.volatility);
    const drawdownPenalty = this.calculateDrawdownPenalty(results.maxDrawdown);
    
    const fitness: FitnessScores = {
      overall,
      objectives: objectiveScores,
      constraints: constraintResults,
      riskAdjustedReturn,
      volatilityNormalized,
      drawdownPenalty,
      constraintViolations: constraintResults.filter(c => !c.satisfied).length,
      feasible: constraintResults.every(c => c.satisfied)
    };
    
    // Sensitivity analysis if enabled
    if (this.config.sensitivityAnalysis) {
      fitness.robustnessScore = await this.calculateRobustness(parameters, results);
    }
    
    return fitness;
  }

  private calculateOverallFitness(
    objectives: Array<{ name: string; rawValue: number; normalizedScore: number; weight: number }>,
    constraints: Array<{ name: string; satisfied: boolean; violation: number; penalty: number }>
  ): number {
    let fitness = 0;
    
    // Calculate objective contribution
    switch (this.config.aggregationMethod) {
      case 'weighted_sum':
        fitness = objectives.reduce((sum, obj) => sum + obj.normalizedScore * obj.weight, 0);
        break;
        
      case 'weighted_product':
        fitness = objectives.reduce((product, obj) => product * Math.pow(obj.normalizedScore, obj.weight), 1);
        break;
        
      case 'tchebycheff':
        fitness = Math.max(...objectives.map(obj => obj.weight * (1 - obj.normalizedScore)));
        fitness = 1 - fitness; // Convert to maximization
        break;
        
      default:
        fitness = objectives.reduce((sum, obj) => sum + obj.normalizedScore * obj.weight, 0);
    }
    
    // Apply constraint penalties
    const totalPenalty = constraints.reduce((sum, c) => sum + c.penalty, 0);
    fitness = fitness - totalPenalty;
    
    // Apply risk adjustment
    fitness = fitness * (1 - this.config.riskAversion * 0.1); // Small risk penalty
    
    return fitness;
  }

  private normalizeObjectiveValue(rawValue: number, objective: OptimizationObjective): number {
    const stats = this.fitnessStats.objectiveRanges.get(objective.name);
    
    // Use expected range if provided, otherwise use observed range
    const min = objective.expectedMin ?? stats?.min ?? 0;
    const max = objective.expectedMax ?? stats?.max ?? 1;
    
    if (max === min) return 0.5;
    
    let normalized = (rawValue - min) / (max - min);
    
    // Handle outliers
    if (this.config.outlierHandling === 'clip') {
      normalized = Math.max(0, Math.min(1, normalized));
    } else if (this.config.outlierHandling === 'winsorize') {
      if (normalized < 0.05) normalized = 0.05;
      if (normalized > 0.95) normalized = 0.95;
    }
    
    // Invert for minimization objectives
    if (objective.type === 'minimize') {
      normalized = 1 - normalized;
    }
    
    return normalized;
  }

  private calculateRiskAdjustedReturn(results: BacktestResults): number {
    const excessReturn = results.annualizedReturn - (results.config.riskFreeRate || 0.02);
    const adjustedVolatility = Math.max(results.volatility, 0.01); // Avoid division by zero
    return excessReturn / adjustedVolatility;
  }

  private normalizeVolatility(volatility: number): number {
    // Normalize volatility to 0-1 scale (assuming max volatility of 100%)
    return Math.max(0, Math.min(1, volatility));
  }

  private calculateDrawdownPenalty(maxDrawdown: number): number {
    if (maxDrawdown <= this.config.drawdownTolerance) return 0;
    
    const excessDrawdown = maxDrawdown - this.config.drawdownTolerance;
    return excessDrawdown * 10; // Heavy penalty for excessive drawdown
  }

  private async calculateRobustness(parameters: Record<string, any>, baseResults: BacktestResults): Promise<number> {
    // Test parameter sensitivity by perturbing parameters
    const perturbations = 5;
    const perturbationResults: number[] = [];
    
    for (let i = 0; i < perturbations; i++) {
      const perturbedParams = this.perturbParameters(parameters, this.config.parameterPerturbation);
      
      try {
        const results = await this.runBacktest(perturbedParams);
        const returnDiff = Math.abs(results.annualizedReturn - baseResults.annualizedReturn);
        perturbationResults.push(returnDiff);
      } catch (error) {
        perturbationResults.push(1); // Large difference for failed backtests
      }
    }
    
    // Calculate robustness as inverse of average sensitivity
    const averageSensitivity = perturbationResults.reduce((sum, diff) => sum + diff, 0) / perturbations;
    return 1 / (1 + averageSensitivity * 10); // Scale to 0-1
  }

  private perturbParameters(parameters: Record<string, any>, perturbationRate: number): Record<string, any> {
    const perturbed = { ...parameters };
    
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'number') {
        const noise = (Math.random() - 0.5) * 2 * perturbationRate * value;
        perturbed[key] = value + noise;
      }
    }
    
    return perturbed;
  }

  private createDefaultConstraints(): FitnessConstraint[] {
    return [
      {
        name: 'minimum_trades',
        type: 'hard',
        description: 'Minimum number of trades required',
        evaluate: (results) => ({
          satisfied: results.totalTrades >= 10,
          violation: Math.max(0, 10 - results.totalTrades) / 10
        }),
        penalty: 100
      },
      
      {
        name: 'maximum_drawdown',
        type: 'hard',
        description: 'Maximum allowable drawdown',
        evaluate: (results) => ({
          satisfied: results.maxDrawdown <= this.config.maximumDrawdown,
          violation: Math.max(0, results.maxDrawdown - this.config.maximumDrawdown)
        }),
        penalty: 500
      },
      
      {
        name: 'minimum_sharpe',
        type: 'soft',
        description: 'Minimum Sharpe ratio',
        evaluate: (results) => ({
          satisfied: results.sharpeRatio >= this.config.minimumSharpeRatio,
          violation: Math.max(0, this.config.minimumSharpeRatio - results.sharpeRatio) / this.config.minimumSharpeRatio
        }),
        penalty: 50
      },
      
      {
        name: 'minimum_win_rate',
        type: 'soft',
        description: 'Minimum win rate',
        evaluate: (results) => ({
          satisfied: results.winRate >= this.config.minimumWinRate,
          violation: Math.max(0, this.config.minimumWinRate - results.winRate) / this.config.minimumWinRate
        }),
        penalty: 30
      }
    ];
  }

  private createDefaultBacktestConfig(): BacktestConfig {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    return {
      id: `fitness_eval_${Date.now()}`,
      name: 'Fitness Evaluation Backtest',
      startDate: oneYearAgo,
      endDate: now,
      timeframe: '1h',
      symbols: ['BTC-USD'],
      dataSource: 'dydx',
      initialCapital: 100000,
      currency: 'USD',
      commission: 0.001,
      slippage: 0.0005,
      latency: 50,
      fillRatio: 0.95,
      maxPositionSize: 0.5,
      maxDrawdown: 0.5,
      strategyConfig: {},
      riskFreeRate: 0.02,
      warmupPeriod: 100,
      enableReinvestment: true,
      compoundReturns: true,
      includeWeekends: false,
      created: new Date(),
      updated: new Date()
    };
  }

  private rankBasedNormalization(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    
    const normalized = new Array(values.length);
    indexed.forEach((item, rank) => {
      normalized[item.index] = rank / (values.length - 1);
    });
    
    return normalized;
  }

  private minMaxNormalization(values: number[], min: number, max: number): number[] {
    if (max === min) return values.map(() => 0.5);
    
    return values.map(value => (value - min) / (max - min));
  }

  private generateCacheKey(parameters: Record<string, any>): string {
    return JSON.stringify(parameters);
  }

  private isCacheValid(cached: CachedResult): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return age < this.config.cacheTimeout * 60 * 1000; // Convert minutes to milliseconds
  }

  private updateStatistics(fitness: FitnessScores, evaluationTime: number): void {
    this.fitnessStats.evaluationCount++;
    this.evaluationTimes.push(evaluationTime);
    
    // Update objective ranges
    fitness.objectives.forEach(obj => {
      const current = this.fitnessStats.objectiveRanges.get(obj.name);
      if (!current) {
        this.fitnessStats.objectiveRanges.set(obj.name, {
          min: obj.rawValue,
          max: obj.rawValue,
          mean: obj.rawValue,
          std: 0
        });
      } else {
        current.min = Math.min(current.min, obj.rawValue);
        current.max = Math.max(current.max, obj.rawValue);
        
        // Update running mean (simplified)
        current.mean = (current.mean * (this.fitnessStats.evaluationCount - 1) + obj.rawValue) / this.fitnessStats.evaluationCount;
      }
    });
  }
}

// Predefined objective functions for common trading metrics
export const TradingObjectives = {
  totalReturn: {
    name: 'total_return',
    type: 'maximize' as const,
    weight: 1.0,
    description: 'Total portfolio return',
    calculate: (results: BacktestResults) => results.totalReturnPercent,
    expectedMin: -0.5,
    expectedMax: 2.0,
    priority: 'critical' as const,
    importance: 1.0
  } as OptimizationObjective,

  sharpeRatio: {
    name: 'sharpe_ratio',
    type: 'maximize' as const,
    weight: 0.8,
    description: 'Risk-adjusted return (Sharpe ratio)',
    calculate: (results: BacktestResults) => results.sharpeRatio,
    expectedMin: -2,
    expectedMax: 4,
    priority: 'high' as const,
    importance: 0.9
  } as OptimizationObjective,

  maxDrawdown: {
    name: 'max_drawdown',
    type: 'minimize' as const,
    weight: 0.6,
    description: 'Maximum portfolio drawdown',
    calculate: (results: BacktestResults) => results.maxDrawdown,
    expectedMin: 0,
    expectedMax: 0.5,
    priority: 'high' as const,
    importance: 0.8
  } as OptimizationObjective,

  volatility: {
    name: 'volatility',
    type: 'minimize' as const,
    weight: 0.4,
    description: 'Portfolio volatility',
    calculate: (results: BacktestResults) => results.volatility,
    expectedMin: 0,
    expectedMax: 1.0,
    priority: 'medium' as const,
    importance: 0.6
  } as OptimizationObjective,

  winRate: {
    name: 'win_rate',
    type: 'maximize' as const,
    weight: 0.3,
    description: 'Percentage of profitable trades',
    calculate: (results: BacktestResults) => results.winRate,
    expectedMin: 0,
    expectedMax: 1,
    priority: 'medium' as const,
    importance: 0.5
  } as OptimizationObjective,

  profitFactor: {
    name: 'profit_factor',
    type: 'maximize' as const,
    weight: 0.5,
    description: 'Ratio of gross profit to gross loss',
    calculate: (results: BacktestResults) => results.profitFactor,
    expectedMin: 0,
    expectedMax: 10,
    priority: 'medium' as const,
    importance: 0.7
  } as OptimizationObjective,

  calmarRatio: {
    name: 'calmar_ratio',
    type: 'maximize' as const,
    weight: 0.7,
    description: 'Annual return divided by maximum drawdown',
    calculate: (results: BacktestResults) => results.calmarRatio,
    expectedMin: -1,
    expectedMax: 5,
    priority: 'high' as const,
    importance: 0.8
  } as OptimizationObjective
};