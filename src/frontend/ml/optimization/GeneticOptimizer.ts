/**
 * GeneticOptimizer - Advanced Strategy Optimization Implementation (ML-005)
 * 
 * Implements sophisticated genetic algorithm for strategy parameter optimization with:
 * - Multi-objective optimization (returns, risk, drawdown, Sharpe ratio)
 * - Population-based strategy evolution with mutation and crossover
 * - Advanced fitness functions with custom optimization goals
 * - Parallel processing for population evaluation
 * - Strategy DNA encoding and breeding mechanisms
 * - Pareto frontier analysis for multi-objective problems
 * 
 * Performance Targets:
 * - Optimize 100+ strategy combinations per hour
 * - Support populations of 50+ strategies per generation
 * - Memory usage < 1GB during optimization runs
 * - Real-time fitness tracking and convergence monitoring
 */

import { EventEmitter } from 'events';
import { StrategyDNA, StrategyGenes, DNAEncoding } from './StrategyDNA';
import { FitnessEvaluator, FitnessScores, OptimizationObjective } from './FitnessEvaluator';
import { PopulationManager, Individual, Population } from './PopulationManager';
import { OptimizationAnalyzer, OptimizationReport, ParetoFrontier } from './OptimizationAnalyzer';
import { BacktestEngine } from '../../../backend/backtesting/BacktestEngine';
import { BacktestConfig, BacktestResults } from '../../../backend/backtesting/types';

export type OptimizationAlgorithm = 'genetic' | 'genetic_nsga2' | 'particle_swarm' | 'differential_evolution';
export type SelectionMethod = 'tournament' | 'roulette' | 'rank' | 'elite';
export type CrossoverMethod = 'uniform' | 'single_point' | 'two_point' | 'arithmetic' | 'blx_alpha';
export type MutationMethod = 'gaussian' | 'polynomial' | 'uniform' | 'boundary' | 'non_uniform';

export interface GeneticOptimizationConfig {
  // Algorithm settings
  algorithm: OptimizationAlgorithm;
  populationSize: number;
  maxGenerations: number;
  
  // Genetic operators
  selectionMethod: SelectionMethod;
  crossoverMethod: CrossoverMethod;
  mutationMethod: MutationMethod;
  
  // Genetic parameters
  crossoverRate: number;
  mutationRate: number;
  elitismRatio: number;
  tournamentSize: number;
  
  // Multi-objective settings
  objectives: OptimizationObjective[];
  paretoFrontSize: number;
  diversityMaintenance: boolean;
  crowdingDistance: boolean;
  
  // Performance settings
  parallelEvaluation: boolean;
  maxConcurrentEvaluations: number;
  evaluationTimeout: number; // minutes
  
  // Convergence criteria
  convergenceThreshold: number;
  convergenceGenerations: number;
  minimumImprovement: number;
  
  // Resource management
  memoryLimit: number; // MB
  maxExecutionTime: number; // minutes
  checkpointInterval: number; // generations
  
  // Advanced features
  adaptiveParameters: boolean;
  niching: boolean;
  islandModel: boolean;
  migrationRate: number;
  
  // Constraints
  constraintHandling: 'penalty' | 'repair' | 'reject';
  penaltyWeight: number;
}

export interface OptimizationProgress {
  generation: number;
  totalGenerations: number;
  populationSize: number;
  
  // Current best
  bestFitness: FitnessScores;
  bestIndividual: Individual;
  averageFitness: number;
  
  // Population statistics
  fitnessVariance: number;
  diversityIndex: number;
  convergenceRate: number;
  
  // Performance metrics
  evaluationsCompleted: number;
  totalEvaluations: number;
  evaluationsPerSecond: number;
  
  // Time tracking
  elapsedTime: number; // minutes
  estimatedTimeRemaining: number; // minutes
  lastUpdateTime: Date;
  
  // Resource usage
  memoryUsage: number; // MB
  cpuUsage: number; // %
  
  // Multi-objective specific
  paretoFrontSize: number;
  hypervolume?: number; // Multi-objective quality metric
  
  // Convergence tracking
  generationsSinceImprovement: number;
  isConverged: boolean;
}

export interface OptimizationResult {
  // Metadata
  optimizationId: string;
  algorithm: OptimizationAlgorithm;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  
  // Configuration
  config: GeneticOptimizationConfig;
  parameterSpace: Record<string, any>;
  
  // Results
  bestIndividual: Individual;
  bestParameters: Record<string, any>;
  bestFitness: FitnessScores;
  
  // Multi-objective results
  paretoFront: ParetoFrontier;
  paretoOptimalSolutions: Individual[];
  
  // Population evolution
  finalPopulation: Population;
  generationHistory: Array<{
    generation: number;
    bestFitness: number;
    averageFitness: number;
    diversity: number;
    convergence: number;
  }>;
  
  // Performance analysis
  convergenceGeneration: number;
  totalEvaluations: number;
  evaluationTime: number;
  successRate: number;
  
  // Statistical analysis
  fitnessDistribution: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    percentiles: Record<number, number>;
  };
  
  // Parameter sensitivity
  parameterImportance: Record<string, number>;
  parameterCorrelations: Record<string, Record<string, number>>;
  
  // Robustness metrics
  robustness: {
    parameterSensitivity: number;
    performanceStability: number;
    outlierResistance: number;
  };
  
  // Recommendations
  recommendations: string[];
  warnings: string[];
  errors: string[];
  
  // Additional metrics
  hypervolume?: number;
  spacing?: number;
  spread?: number;
}

/**
 * Advanced Genetic Algorithm Optimizer for Strategy Parameters
 */
export class GeneticOptimizer extends EventEmitter {
  private config: GeneticOptimizationConfig;
  private strategyDNA: StrategyDNA;
  private fitnessEvaluator: FitnessEvaluator;
  private populationManager: PopulationManager;
  private optimizationAnalyzer: OptimizationAnalyzer;
  private backtestEngine: BacktestEngine;
  
  // Optimization state
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private currentGeneration = 0;
  private currentPopulation: Population = [];
  
  // Progress tracking
  private progress: OptimizationProgress;
  private startTime: Date;
  private evaluationCount = 0;
  private lastCheckpoint = 0;
  
  // Performance tracking
  private generationHistory: Array<{
    generation: number;
    bestFitness: number;
    averageFitness: number;
    diversity: number;
    convergence: number;
  }> = [];
  
  // Convergence tracking
  private bestFitnessHistory: number[] = [];
  private generationsSinceImprovement = 0;
  private convergenceThresholdMet = false;
  
  // Multi-objective state
  private paretoFront: ParetoFrontier = [];
  private hypervolumeHistory: number[] = [];
  
  // Parallel processing
  private activeEvaluations = new Map<string, Promise<FitnessScores>>();
  private evaluationQueue: Individual[] = [];
  
  // Checkpointing
  private checkpointData?: {
    generation: number;
    population: Population;
    paretoFront: ParetoFrontier;
    history: any[];
  };

  constructor(
    config: GeneticOptimizationConfig,
    backtestEngine: BacktestEngine,
    parameterSpace: Record<string, any>
  ) {
    super();
    
    this.config = config;
    this.backtestEngine = backtestEngine;
    
    // Initialize components
    this.strategyDNA = new StrategyDNA(parameterSpace);
    this.fitnessEvaluator = new FitnessEvaluator(config.objectives, backtestEngine);
    this.populationManager = new PopulationManager(config);
    this.optimizationAnalyzer = new OptimizationAnalyzer(config);
    
    this.progress = this.initializeProgress();
  }

  /**
   * Start genetic optimization process
   */
  async optimize(
    baseStrategy: any,
    backtestConfig: BacktestConfig,
    options: {
      resumeFromCheckpoint?: boolean;
      customFitnessFn?: (results: BacktestResults) => FitnessScores;
      progressCallback?: (progress: OptimizationProgress) => void;
    } = {}
  ): Promise<OptimizationResult> {
    
    if (this.isRunning) {
      throw new Error('Optimization is already running');
    }
    
    console.log(`🧬 Starting Genetic Algorithm Optimization`);
    console.log(`📊 Population: ${this.config.populationSize}, Generations: ${this.config.maxGenerations}`);
    console.log(`🎯 Objectives: ${this.config.objectives.map(o => o.name).join(', ')}`);
    
    this.isRunning = true;
    this.shouldStop = false;
    this.startTime = new Date();
    this.currentGeneration = 0;
    this.evaluationCount = 0;
    this.generationsSinceImprovement = 0;
    
    try {
      // Setup fitness evaluator
      if (options.customFitnessFn) {
        this.fitnessEvaluator.setCustomFitnessFunction(options.customFitnessFn);
      }
      
      // Progress callback
      if (options.progressCallback) {
        this.on('progress', options.progressCallback);
      }
      
      // Resume from checkpoint or initialize new population
      if (options.resumeFromCheckpoint && this.checkpointData) {
        await this.resumeFromCheckpoint();
      } else {
        await this.initializePopulation(baseStrategy, backtestConfig);
      }
      
      // Main evolution loop
      while (!this.shouldTerminate()) {
        await this.evolveGeneration();
        
        // Update progress and emit events
        this.updateProgress();
        this.emit('progress', this.progress);
        this.emit('generation-complete', {
          generation: this.currentGeneration,
          bestFitness: this.getBestIndividual().fitness,
          population: [...this.currentPopulation]
        });
        
        // Checkpoint if needed
        if (this.currentGeneration % this.config.checkpointInterval === 0) {
          this.saveCheckpoint();
        }
        
        // Pause support
        while (this.isPaused && !this.shouldStop) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.currentGeneration++;
      }
      
      // Generate final results
      const result = await this.generateOptimizationResult();
      
      console.log(`✅ Genetic optimization completed after ${this.currentGeneration} generations`);
      console.log(`🏆 Best fitness: ${this.getBestIndividual().fitness.overall.toFixed(4)}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Genetic optimization failed:', error);
      this.emit('error', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.cleanup();
    }
  }

  /**
   * Pause optimization (can be resumed)
   */
  pause(): void {
    if (this.isRunning) {
      this.isPaused = true;
      console.log('⏸️ Genetic optimization paused');
      this.emit('paused');
    }
  }

  /**
   * Resume paused optimization
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      console.log('▶️ Genetic optimization resumed');
      this.emit('resumed');
    }
  }

  /**
   * Stop optimization gracefully
   */
  stop(): void {
    this.shouldStop = true;
    console.log('🛑 Stopping genetic optimization...');
    this.emit('stopping');
  }

  /**
   * Get current optimization progress
   */
  getProgress(): OptimizationProgress {
    return { ...this.progress };
  }

  /**
   * Get current best solution
   */
  getBestSolution(): { parameters: Record<string, any>; fitness: FitnessScores } {
    const best = this.getBestIndividual();
    return {
      parameters: this.strategyDNA.decode(best.dna),
      fitness: best.fitness
    };
  }

  /**
   * Get current Pareto front (for multi-objective optimization)
   */
  getParetoFront(): Array<{ parameters: Record<string, any>; fitness: FitnessScores }> {
    return this.paretoFront.map(individual => ({
      parameters: this.strategyDNA.decode(individual.dna),
      fitness: individual.fitness
    }));
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  private async initializePopulation(baseStrategy: any, backtestConfig: BacktestConfig): Promise<void> {
    console.log(`🌱 Initializing population of ${this.config.populationSize} individuals...`);
    
    this.currentPopulation = this.populationManager.generateInitialPopulation(
      this.config.populationSize,
      this.strategyDNA
    );
    
    // Evaluate initial population
    await this.evaluatePopulation(this.currentPopulation, baseStrategy, backtestConfig);
    
    // Initialize Pareto front
    if (this.config.objectives.length > 1) {
      this.paretoFront = this.populationManager.extractParetoFront(this.currentPopulation);
    }
    
    console.log(`✅ Initial population evaluated. Best fitness: ${this.getBestIndividual().fitness.overall.toFixed(4)}`);
  }

  private async evolveGeneration(): Promise<void> {
    console.log(`🧬 Evolving generation ${this.currentGeneration + 1}/${this.config.maxGenerations}...`);
    
    // Selection
    const selectedParents = this.populationManager.selectParents(
      this.currentPopulation,
      this.config.selectionMethod,
      this.config.tournamentSize
    );
    
    // Crossover and Mutation
    const offspring = await this.populationManager.generateOffspring(
      selectedParents,
      this.config.crossoverMethod,
      this.config.mutationMethod,
      this.config.crossoverRate,
      this.config.mutationRate,
      this.strategyDNA
    );
    
    // Evaluate offspring
    await this.evaluatePopulation(offspring, null, null); // Use cached backtest config
    
    // Survival selection
    this.currentPopulation = this.populationManager.survivorSelection(
      this.currentPopulation,
      offspring,
      this.config.populationSize,
      this.config.elitismRatio
    );
    
    // Update Pareto front for multi-objective optimization
    if (this.config.objectives.length > 1) {
      this.updateParetoFront();
    }
    
    // Track convergence
    this.trackConvergence();
    
    // Record generation statistics
    this.recordGenerationStatistics();
    
    // Adaptive parameter adjustment
    if (this.config.adaptiveParameters) {
      this.adjustParameters();
    }
  }

  private async evaluatePopulation(
    population: Population,
    baseStrategy?: any,
    backtestConfig?: BacktestConfig
  ): Promise<void> {
    const batchSize = this.config.maxConcurrentEvaluations;
    
    for (let i = 0; i < population.length; i += batchSize) {
      const batch = population.slice(i, i + batchSize);
      const evaluationPromises = batch.map(individual => 
        this.evaluateIndividual(individual, baseStrategy, backtestConfig)
      );
      
      await Promise.allSettled(evaluationPromises);
      
      // Update progress
      this.evaluationCount += batch.length;
      this.updateProgress();
    }
  }

  private async evaluateIndividual(
    individual: Individual,
    baseStrategy?: any,
    backtestConfig?: BacktestConfig
  ): Promise<void> {
    try {
      // Skip evaluation if already evaluated
      if (individual.fitness && individual.fitness.overall > 0) {
        return;
      }
      
      const parameters = this.strategyDNA.decode(individual.dna);
      const fitness = await this.fitnessEvaluator.evaluate(
        parameters,
        baseStrategy,
        backtestConfig
      );
      
      individual.fitness = fitness;
      individual.evaluated = true;
      individual.evaluationTime = Date.now();
      
    } catch (error) {
      console.error(`Failed to evaluate individual ${individual.id}:`, error);
      
      // Assign penalty fitness
      individual.fitness = this.fitnessEvaluator.getPenaltyFitness();
      individual.evaluated = true;
      individual.constraint_violation = true;
    }
  }

  private updateParetoFront(): void {
    // Combine current population with existing Pareto front
    const combined = [...this.currentPopulation, ...this.paretoFront];
    
    // Extract new Pareto front
    this.paretoFront = this.populationManager.extractParetoFront(combined);
    
    // Limit Pareto front size
    if (this.paretoFront.length > this.config.paretoFrontSize) {
      this.paretoFront = this.populationManager.selectBestFromParetoFront(
        this.paretoFront,
        this.config.paretoFrontSize
      );
    }
    
    // Calculate hypervolume for progress tracking
    if (this.config.objectives.length > 1) {
      const hypervolume = this.optimizationAnalyzer.calculateHypervolume(
        this.paretoFront,
        this.config.objectives
      );
      this.hypervolumeHistory.push(hypervolume);
    }
  }

  private trackConvergence(): void {
    const currentBest = this.getBestIndividual();
    const currentBestFitness = currentBest.fitness.overall;
    
    this.bestFitnessHistory.push(currentBestFitness);
    
    // Check for improvement
    const previousBest = this.bestFitnessHistory.length > 1 ? 
      Math.max(...this.bestFitnessHistory.slice(0, -1)) : -Infinity;
    
    if (currentBestFitness > previousBest + this.config.minimumImprovement) {
      this.generationsSinceImprovement = 0;
    } else {
      this.generationsSinceImprovement++;
    }
    
    // Check convergence criteria
    if (this.generationsSinceImprovement >= this.config.convergenceGenerations) {
      this.convergenceThresholdMet = true;
    }
  }

  private recordGenerationStatistics(): void {
    const fitnessValues = this.currentPopulation.map(ind => ind.fitness.overall);
    const bestFitness = Math.max(...fitnessValues);
    const averageFitness = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const diversity = this.calculatePopulationDiversity();
    const convergence = this.calculateConvergenceRate();
    
    this.generationHistory.push({
      generation: this.currentGeneration,
      bestFitness,
      averageFitness,
      diversity,
      convergence
    });
  }

  private calculatePopulationDiversity(): number {
    // Calculate genetic diversity based on DNA differences
    let totalDistance = 0;
    let comparisons = 0;
    
    for (let i = 0; i < this.currentPopulation.length; i++) {
      for (let j = i + 1; j < this.currentPopulation.length; j++) {
        totalDistance += this.strategyDNA.calculateDistance(
          this.currentPopulation[i].dna,
          this.currentPopulation[j].dna
        );
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private calculateConvergenceRate(): number {
    if (this.bestFitnessHistory.length < 10) return 0;
    
    const recent = this.bestFitnessHistory.slice(-10);
    const slope = this.calculateSlope(recent);
    
    return Math.abs(slope); // Rate of change in fitness
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
    const x2Sum = values.reduce((sum, _, i) => sum + i * i, 0);
    
    return (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  }

  private adjustParameters(): void {
    // Adaptive parameter adjustment based on population diversity and convergence
    const diversity = this.calculatePopulationDiversity();
    const convergenceRate = this.calculateConvergenceRate();
    
    // Increase mutation rate if diversity is low
    if (diversity < 0.1) {
      this.config.mutationRate = Math.min(0.5, this.config.mutationRate * 1.2);
    } else if (diversity > 0.8) {
      this.config.mutationRate = Math.max(0.01, this.config.mutationRate * 0.8);
    }
    
    // Adjust selection pressure based on convergence
    if (convergenceRate < 0.001) {
      this.config.tournamentSize = Math.min(10, this.config.tournamentSize + 1);
    }
  }

  private shouldTerminate(): boolean {
    if (this.shouldStop) return true;
    if (this.currentGeneration >= this.config.maxGenerations) return true;
    if (this.convergenceThresholdMet) return true;
    
    // Time limit check
    const elapsedMinutes = (Date.now() - this.startTime.getTime()) / 60000;
    if (elapsedMinutes >= this.config.maxExecutionTime) return true;
    
    // Memory limit check
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage >= this.config.memoryLimit) return true;
    
    return false;
  }

  private getBestIndividual(): Individual {
    return this.currentPopulation.reduce((best, current) => 
      current.fitness.overall > best.fitness.overall ? current : best
    );
  }

  private updateProgress(): void {
    const best = this.getBestIndividual();
    const fitnessValues = this.currentPopulation.map(ind => ind.fitness.overall);
    const averageFitness = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const variance = fitnessValues.reduce((sum, f) => sum + Math.pow(f - averageFitness, 2), 0) / fitnessValues.length;
    
    const elapsedTime = (Date.now() - this.startTime.getTime()) / 60000;
    const totalEvaluations = this.config.maxGenerations * this.config.populationSize;
    const progress = this.evaluationCount / totalEvaluations;
    const estimatedTotal = elapsedTime / progress;
    
    this.progress = {
      generation: this.currentGeneration,
      totalGenerations: this.config.maxGenerations,
      populationSize: this.config.populationSize,
      bestFitness: best.fitness,
      bestIndividual: best,
      averageFitness,
      fitnessVariance: variance,
      diversityIndex: this.calculatePopulationDiversity(),
      convergenceRate: this.calculateConvergenceRate(),
      evaluationsCompleted: this.evaluationCount,
      totalEvaluations,
      evaluationsPerSecond: this.evaluationCount / (elapsedTime * 60),
      elapsedTime,
      estimatedTimeRemaining: estimatedTotal - elapsedTime,
      lastUpdateTime: new Date(),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: 0, // Would need system monitoring
      paretoFrontSize: this.paretoFront.length,
      hypervolume: this.hypervolumeHistory[this.hypervolumeHistory.length - 1],
      generationsSinceImprovement: this.generationsSinceImprovement,
      isConverged: this.convergenceThresholdMet
    };
  }

  private getMemoryUsage(): number {
    // Estimate memory usage based on population size and data structures
    const individualSize = 1000; // Rough estimate in bytes
    const populationMemory = this.currentPopulation.length * individualSize;
    const historyMemory = this.generationHistory.length * 100;
    const paretoMemory = this.paretoFront.length * individualSize;
    
    return (populationMemory + historyMemory + paretoMemory) / (1024 * 1024); // Convert to MB
  }

  private saveCheckpoint(): void {
    this.checkpointData = {
      generation: this.currentGeneration,
      population: [...this.currentPopulation],
      paretoFront: [...this.paretoFront],
      history: [...this.generationHistory]
    };
    
    console.log(`💾 Checkpoint saved at generation ${this.currentGeneration}`);
  }

  private async resumeFromCheckpoint(): Promise<void> {
    if (!this.checkpointData) {
      throw new Error('No checkpoint data available');
    }
    
    this.currentGeneration = this.checkpointData.generation;
    this.currentPopulation = this.checkpointData.population;
    this.paretoFront = this.checkpointData.paretoFront;
    this.generationHistory = this.checkpointData.history;
    
    console.log(`🔄 Resumed from checkpoint at generation ${this.currentGeneration}`);
  }

  private async generateOptimizationResult(): Promise<OptimizationResult> {
    const best = this.getBestIndividual();
    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 60000;
    
    // Generate comprehensive analysis
    const analysis = await this.optimizationAnalyzer.analyzeResults(
      this.currentPopulation,
      this.paretoFront,
      this.generationHistory,
      this.config
    );
    
    const result: OptimizationResult = {
      optimizationId: `genetic_opt_${Date.now()}`,
      algorithm: this.config.algorithm,
      startTime: this.startTime,
      endTime,
      duration,
      config: this.config,
      parameterSpace: this.strategyDNA.getParameterSpace(),
      bestIndividual: best,
      bestParameters: this.strategyDNA.decode(best.dna),
      bestFitness: best.fitness,
      paretoFront: this.paretoFront,
      paretoOptimalSolutions: this.paretoFront,
      finalPopulation: this.currentPopulation,
      generationHistory: this.generationHistory,
      convergenceGeneration: this.currentGeneration - this.generationsSinceImprovement,
      totalEvaluations: this.evaluationCount,
      evaluationTime: duration,
      successRate: this.currentPopulation.filter(ind => ind.evaluated).length / this.currentPopulation.length,
      fitnessDistribution: analysis.fitnessDistribution,
      parameterImportance: analysis.parameterImportance,
      parameterCorrelations: analysis.parameterCorrelations,
      robustness: analysis.robustness,
      recommendations: analysis.recommendations,
      warnings: analysis.warnings,
      errors: analysis.errors,
      hypervolume: this.hypervolumeHistory[this.hypervolumeHistory.length - 1],
      spacing: analysis.spacing,
      spread: analysis.spread
    };
    
    return result;
  }

  private initializeProgress(): OptimizationProgress {
    return {
      generation: 0,
      totalGenerations: this.config.maxGenerations,
      populationSize: this.config.populationSize,
      bestFitness: { overall: 0, objectives: [], constraints: [] },
      bestIndividual: {} as Individual,
      averageFitness: 0,
      fitnessVariance: 0,
      diversityIndex: 0,
      convergenceRate: 0,
      evaluationsCompleted: 0,
      totalEvaluations: this.config.maxGenerations * this.config.populationSize,
      evaluationsPerSecond: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      lastUpdateTime: new Date(),
      memoryUsage: 0,
      cpuUsage: 0,
      paretoFrontSize: 0,
      generationsSinceImprovement: 0,
      isConverged: false
    };
  }

  private cleanup(): void {
    // Cancel any pending evaluations
    this.activeEvaluations.clear();
    this.evaluationQueue = [];
    
    // Clear event listeners
    this.removeAllListeners();
    
    console.log('🧹 Genetic optimizer cleaned up');
  }
}

// Default configuration presets
export const GENETIC_OPTIMIZER_CONFIGS = {
  quickOptimization: {
    algorithm: 'genetic' as OptimizationAlgorithm,
    populationSize: 20,
    maxGenerations: 50,
    selectionMethod: 'tournament' as SelectionMethod,
    crossoverMethod: 'uniform' as CrossoverMethod,
    mutationMethod: 'gaussian' as MutationMethod,
    crossoverRate: 0.8,
    mutationRate: 0.1,
    elitismRatio: 0.1,
    tournamentSize: 3,
    objectives: [],
    paretoFrontSize: 10,
    diversityMaintenance: true,
    crowdingDistance: true,
    parallelEvaluation: true,
    maxConcurrentEvaluations: 5,
    evaluationTimeout: 30,
    convergenceThreshold: 0.001,
    convergenceGenerations: 10,
    minimumImprovement: 0.001,
    memoryLimit: 512,
    maxExecutionTime: 120,
    checkpointInterval: 10,
    adaptiveParameters: false,
    niching: false,
    islandModel: false,
    migrationRate: 0.1,
    constraintHandling: 'penalty' as const,
    penaltyWeight: 1000
  } as GeneticOptimizationConfig,
  
  thoroughOptimization: {
    algorithm: 'genetic_nsga2' as OptimizationAlgorithm,
    populationSize: 100,
    maxGenerations: 200,
    selectionMethod: 'tournament' as SelectionMethod,
    crossoverMethod: 'blx_alpha' as CrossoverMethod,
    mutationMethod: 'polynomial' as MutationMethod,
    crossoverRate: 0.9,
    mutationRate: 0.05,
    elitismRatio: 0.2,
    tournamentSize: 5,
    objectives: [],
    paretoFrontSize: 50,
    diversityMaintenance: true,
    crowdingDistance: true,
    parallelEvaluation: true,
    maxConcurrentEvaluations: 10,
    evaluationTimeout: 60,
    convergenceThreshold: 0.0001,
    convergenceGenerations: 25,
    minimumImprovement: 0.0005,
    memoryLimit: 1024,
    maxExecutionTime: 480,
    checkpointInterval: 20,
    adaptiveParameters: true,
    niching: true,
    islandModel: false,
    migrationRate: 0.05,
    constraintHandling: 'repair' as const,
    penaltyWeight: 10000
  } as GeneticOptimizationConfig
};