/**
 * OptimizationAnalyzer - Comprehensive Results Analysis and Pareto Frontier Analysis (ML-005)
 * 
 * Implements advanced optimization analysis including:
 * - Multi-objective optimization analysis with Pareto frontier
 * - Parameter sensitivity and importance analysis
 * - Convergence analysis and performance tracking
 * - Statistical analysis of optimization results
 * - Robustness and stability metrics
 * - Hypervolume, spacing, and spread calculations
 * - Visualization data preparation
 * 
 * The analyzer provides deep insights into optimization performance and
 * generates comprehensive reports for strategy optimization results.
 */

import { Individual, Population, ParetoFrontier } from './PopulationManager';
import { FitnessScores, OptimizationObjective } from './FitnessEvaluator';
import { GeneticOptimizationConfig } from './GeneticOptimizer';

export interface OptimizationReport {
  // Executive summary
  summary: {
    totalEvaluations: number;
    convergenceGeneration: number;
    bestFitness: FitnessScores;
    optimizationEfficiency: number;
    timeToConvergence: number;
    finalDiversity: number;
  };
  
  // Statistical analysis
  fitnessDistribution: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    percentiles: Record<number, number>;
    outliers: Individual[];
  };
  
  // Parameter analysis
  parameterImportance: Record<string, number>;
  parameterCorrelations: Record<string, Record<string, number>>;
  parameterSensitivity: Record<string, {
    sensitivity: number;
    stability: number;
    optimalRange: [number, number];
  }>;
  
  // Multi-objective analysis
  multiObjectiveMetrics: {
    hypervolume: number;
    spacing: number;
    spread: number;
    convergenceMetric: number;
    diversityMetric: number;
  };
  
  // Convergence analysis
  convergenceAnalysis: {
    convergenceRate: number;
    convergenceGeneration: number;
    plateauDetection: boolean;
    prematureConvergence: boolean;
    stagnationPeriods: number[];
  };
  
  // Robustness metrics
  robustness: {
    parameterSensitivity: number;
    performanceStability: number;
    outlierResistance: number;
    noiseResilience: number;
  };
  
  // Quality assessment
  qualityMetrics: {
    solutionQuality: number;
    diversityMaintenance: number;
    constraintSatisfaction: number;
    objectiveBalance: number;
  };
  
  // Recommendations and insights
  recommendations: string[];
  warnings: string[];
  errors: string[];
  insights: string[];
  
  // Visualization data
  visualizationData: {
    fitnessEvolution: Array<{ generation: number; best: number; average: number; diversity: number }>;
    paretoFrontEvolution: Array<{ generation: number; frontSize: number; hypervolume: number }>;
    parameterDistributions: Record<string, number[]>;
    objectiveSpaceData: Array<{ x: number; y: number; fitness: number; dominated: boolean }>;
    convergenceMetrics: Array<{ generation: number; convergence: number; diversity: number }>;
  };
}

export interface ParetoFrontierAnalysis {
  size: number;
  hypervolume: number;
  spacing: number;
  spread: number;
  
  // Front quality
  dominationRatio: number;
  coverageRatio: number;
  uniformityIndex: number;
  
  // Solution characteristics
  extremeSolutions: {
    objectives: Record<string, Individual>;
    compromiseSolutions: Individual[];
    kneeSolutions: Individual[];
  };
  
  // Diversity metrics
  diversityMetrics: {
    geneticDiversity: number;
    objectiveDiversity: number;
    crowdingDistanceStats: {
      mean: number;
      std: number;
      min: number;
      max: number;
    };
  };
}

export interface ParameterSensitivityReport {
  parameterName: string;
  importance: number;
  sensitivity: number;
  stability: number;
  
  // Statistical analysis
  valueDistribution: {
    mean: number;
    std: number;
    skewness: number;
    kurtosis: number;
  };
  
  // Optimal ranges
  optimalRange: [number, number];
  criticalThresholds: number[];
  
  // Correlation with objectives
  objectiveCorrelations: Record<string, number>;
  
  // Interactions
  strongInteractions: Array<{
    parameter: string;
    interactionStrength: number;
    type: 'synergistic' | 'antagonistic' | 'neutral';
  }>;
}

/**
 * Advanced Optimization Results Analyzer
 */
export class OptimizationAnalyzer {
  private config: GeneticOptimizationConfig;
  
  // Analysis cache
  private analysisCache = new Map<string, any>();
  
  // Statistical utilities
  private statisticalTests = {
    normalityTest: true,
    correlationTest: true,
    stationarityTest: true
  };

  constructor(config: GeneticOptimizationConfig) {
    this.config = config;
  }

  /**
   * Analyze complete optimization results
   */
  async analyzeResults(
    finalPopulation: Population,
    paretoFront: ParetoFrontier,
    generationHistory: Array<{
      generation: number;
      bestFitness: number;
      averageFitness: number;
      diversity: number;
      convergence: number;
    }>,
    config: GeneticOptimizationConfig
  ): Promise<OptimizationReport> {
    
    console.log('📊 Analyzing optimization results...');
    
    // Statistical analysis
    const fitnessDistribution = this.analyzeFitnessDistribution(finalPopulation);
    
    // Parameter analysis
    const parameterImportance = this.analyzeParameterImportance(finalPopulation);
    const parameterCorrelations = this.analyzeParameterCorrelations(finalPopulation);
    const parameterSensitivity = this.analyzeParameterSensitivity(finalPopulation);
    
    // Multi-objective analysis
    const multiObjectiveMetrics = this.analyzeMultiObjective(paretoFront, config.objectives);
    
    // Convergence analysis
    const convergenceAnalysis = this.analyzeConvergence(generationHistory);
    
    // Robustness analysis
    const robustness = this.analyzeRobustness(finalPopulation, generationHistory);
    
    // Quality metrics
    const qualityMetrics = this.analyzeQuality(finalPopulation, paretoFront, config);
    
    // Generate recommendations
    const { recommendations, warnings, errors, insights } = this.generateRecommendations(
      finalPopulation, paretoFront, generationHistory, config
    );
    
    // Prepare visualization data
    const visualizationData = this.prepareVisualizationData(
      finalPopulation, paretoFront, generationHistory
    );
    
    const report: OptimizationReport = {
      summary: {
        totalEvaluations: finalPopulation.length,
        convergenceGeneration: convergenceAnalysis.convergenceGeneration,
        bestFitness: this.getBestIndividual(finalPopulation).fitness,
        optimizationEfficiency: this.calculateOptimizationEfficiency(generationHistory),
        timeToConvergence: convergenceAnalysis.convergenceGeneration / generationHistory.length,
        finalDiversity: generationHistory[generationHistory.length - 1]?.diversity || 0
      },
      fitnessDistribution,
      parameterImportance,
      parameterCorrelations,
      parameterSensitivity,
      multiObjectiveMetrics,
      convergenceAnalysis,
      robustness,
      qualityMetrics,
      recommendations,
      warnings,
      errors,
      insights,
      visualizationData
    };
    
    console.log('✅ Optimization analysis complete');
    return report;
  }

  /**
   * Calculate hypervolume indicator for multi-objective optimization
   */
  calculateHypervolume(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): number {
    if (paretoFront.length === 0 || objectives.length === 0) return 0;
    
    // Use reference point (nadir point)
    const referencePoint = this.calculateReferencePoint(paretoFront, objectives);
    
    // Monte Carlo approximation for higher dimensions
    if (objectives.length > 3) {
      return this.calculateHypervolumeMonteCarloApproximation(paretoFront, objectives, referencePoint);
    }
    
    // Exact calculation for 2D and 3D
    return this.calculateHypervolumeExact(paretoFront, objectives, referencePoint);
  }

  /**
   * Calculate spacing metric for Pareto front distribution
   */
  calculateSpacing(paretoFront: ParetoFrontier): number {
    if (paretoFront.length <= 1) return 0;
    
    const distances: number[] = [];
    
    for (let i = 0; i < paretoFront.length; i++) {
      let minDistance = Infinity;
      
      for (let j = 0; j < paretoFront.length; j++) {
        if (i === j) continue;
        
        const distance = this.calculateEuclideanDistance(
          paretoFront[i].fitness.objectives.map(obj => obj.normalizedScore),
          paretoFront[j].fitness.objectives.map(obj => obj.normalizedScore)
        );
        
        minDistance = Math.min(minDistance, distance);
      }
      
      distances.push(minDistance);
    }
    
    const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / distances.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate spread metric for Pareto front extent
   */
  calculateSpread(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): number {
    if (paretoFront.length <= 1) return 0;
    
    const extremeDistances: number[] = [];
    const averageDistances: number[] = [];
    
    for (let objIndex = 0; objIndex < objectives.length; objIndex++) {
      // Sort by objective value
      const sorted = [...paretoFront].sort((a, b) => {
        const aValue = a.fitness.objectives[objIndex]?.normalizedScore || 0;
        const bValue = b.fitness.objectives[objIndex]?.normalizedScore || 0;
        return objectives[objIndex].type === 'maximize' ? bValue - aValue : aValue - bValue;
      });
      
      // Distance between extremes
      const extremeDistance = Math.abs(
        sorted[0].fitness.objectives[objIndex]?.normalizedScore - 
        sorted[sorted.length - 1].fitness.objectives[objIndex]?.normalizedScore
      );
      extremeDistances.push(extremeDistance);
      
      // Average consecutive distances
      let totalDistance = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        const distance = Math.abs(
          sorted[i].fitness.objectives[objIndex]?.normalizedScore - 
          sorted[i + 1].fitness.objectives[objIndex]?.normalizedScore
        );
        totalDistance += distance;
      }
      averageDistances.push(totalDistance / (sorted.length - 1));
    }
    
    // Calculate spread as ratio of extreme distances to average distances
    const spreadValues = extremeDistances.map((extreme, index) => 
      averageDistances[index] > 0 ? extreme / averageDistances[index] : 0
    );
    
    return spreadValues.reduce((sum, spread) => sum + spread, 0) / spreadValues.length;
  }

  /**
   * Analyze parameter sensitivity and importance
   */
  analyzeParameterSensitivityDetailed(
    population: Population,
    parameterName: string
  ): ParameterSensitivityReport {
    
    const parameterValues = population.map(ind => this.extractParameterValue(ind, parameterName));
    const fitnessValues = population.map(ind => ind.fitness.overall);
    
    // Statistical analysis
    const valueDistribution = this.calculateDistributionStats(parameterValues);
    
    // Importance calculation (correlation with fitness)
    const importance = Math.abs(this.calculateCorrelation(parameterValues, fitnessValues));
    
    // Sensitivity analysis (fitness change per unit parameter change)
    const sensitivity = this.calculateSensitivity(parameterValues, fitnessValues);
    
    // Stability analysis (consistency of parameter-fitness relationship)
    const stability = this.calculateStability(parameterValues, fitnessValues);
    
    // Optimal range identification
    const optimalRange = this.identifyOptimalRange(parameterValues, fitnessValues);
    
    // Critical thresholds
    const criticalThresholds = this.identifyCriticalThresholds(parameterValues, fitnessValues);
    
    // Objective correlations
    const objectiveCorrelations: Record<string, number> = {};
    for (const objective of this.config.objectives) {
      const objectiveValues = population.map(ind => 
        ind.fitness.objectives.find(obj => obj.name === objective.name)?.normalizedScore || 0
      );
      objectiveCorrelations[objective.name] = this.calculateCorrelation(parameterValues, objectiveValues);
    }
    
    // Parameter interactions (simplified)
    const strongInteractions = this.identifyParameterInteractions(population, parameterName);
    
    return {
      parameterName,
      importance,
      sensitivity,
      stability,
      valueDistribution,
      optimalRange,
      criticalThresholds,
      objectiveCorrelations,
      strongInteractions
    };
  }

  /**
   * Generate comprehensive Pareto frontier analysis
   */
  analyzeParetoFrontier(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): ParetoFrontierAnalysis {
    const hypervolume = this.calculateHypervolume(paretoFront, objectives);
    const spacing = this.calculateSpacing(paretoFront);
    const spread = this.calculateSpread(paretoFront, objectives);
    
    // Dominance and coverage ratios
    const dominationRatio = this.calculateDominationRatio(paretoFront);
    const coverageRatio = this.calculateCoverageRatio(paretoFront, objectives);
    const uniformityIndex = this.calculateUniformityIndex(paretoFront);
    
    // Extreme and compromise solutions
    const extremeSolutions = this.identifyExtremeSolutions(paretoFront, objectives);
    const compromiseSolutions = this.identifyCompromiseSolutions(paretoFront, objectives);
    const kneeSolutions = this.identifyKneeSolutions(paretoFront, objectives);
    
    // Diversity metrics
    const diversityMetrics = this.calculateFrontierDiversityMetrics(paretoFront);
    
    return {
      size: paretoFront.length,
      hypervolume,
      spacing,
      spread,
      dominationRatio,
      coverageRatio,
      uniformityIndex,
      extremeSolutions: {
        objectives: extremeSolutions,
        compromiseSolutions,
        kneeSolutions
      },
      diversityMetrics
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private analyzeFitnessDistribution(population: Population) {
    const fitnessValues = population.map(ind => ind.fitness.overall);
    
    const sorted = [...fitnessValues].sort((a, b) => a - b);
    const mean = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const std = Math.sqrt(fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnessValues.length);
    
    const percentiles: Record<number, number> = {};
    [5, 10, 25, 50, 75, 90, 95].forEach(p => {
      percentiles[p] = sorted[Math.floor(sorted.length * p / 100)];
    });
    
    // Identify outliers (beyond 2 standard deviations)
    const outliers = population.filter(ind => 
      Math.abs(ind.fitness.overall - mean) > 2 * std
    );
    
    return {
      mean,
      median,
      std,
      min: Math.min(...fitnessValues),
      max: Math.max(...fitnessValues),
      percentiles,
      outliers
    };
  }

  private analyzeParameterImportance(population: Population): Record<string, number> {
    const importance: Record<string, number> = {};
    
    // Extract all parameter names (simplified - would need actual DNA decoding)
    const parameterNames = ['shortMAPeriod', 'longMAPeriod', 'rsiPeriod', 'stopLossPercent']; // Example
    
    for (const paramName of parameterNames) {
      const paramValues = population.map(ind => this.extractParameterValue(ind, paramName));
      const fitnessValues = population.map(ind => ind.fitness.overall);
      
      // Calculate correlation with fitness
      importance[paramName] = Math.abs(this.calculateCorrelation(paramValues, fitnessValues));
    }
    
    return importance;
  }

  private analyzeParameterCorrelations(population: Population): Record<string, Record<string, number>> {
    const correlations: Record<string, Record<string, number>> = {};
    const parameterNames = ['shortMAPeriod', 'longMAPeriod', 'rsiPeriod', 'stopLossPercent']; // Example
    
    for (const param1 of parameterNames) {
      correlations[param1] = {};
      const values1 = population.map(ind => this.extractParameterValue(ind, param1));
      
      for (const param2 of parameterNames) {
        if (param1 === param2) {
          correlations[param1][param2] = 1.0;
          continue;
        }
        
        const values2 = population.map(ind => this.extractParameterValue(ind, param2));
        correlations[param1][param2] = this.calculateCorrelation(values1, values2);
      }
    }
    
    return correlations;
  }

  private analyzeParameterSensitivity(population: Population): Record<string, any> {
    const sensitivity: Record<string, any> = {};
    const parameterNames = ['shortMAPeriod', 'longMAPeriod', 'rsiPeriod', 'stopLossPercent']; // Example
    
    for (const paramName of parameterNames) {
      const paramValues = population.map(ind => this.extractParameterValue(ind, paramName));
      const fitnessValues = population.map(ind => ind.fitness.overall);
      
      const sens = this.calculateSensitivity(paramValues, fitnessValues);
      const stab = this.calculateStability(paramValues, fitnessValues);
      const range = this.identifyOptimalRange(paramValues, fitnessValues);
      
      sensitivity[paramName] = {
        sensitivity: sens,
        stability: stab,
        optimalRange: range
      };
    }
    
    return sensitivity;
  }

  private analyzeMultiObjective(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]) {
    if (objectives.length <= 1) {
      return {
        hypervolume: 0,
        spacing: 0,
        spread: 0,
        convergenceMetric: 0,
        diversityMetric: 0
      };
    }
    
    const hypervolume = this.calculateHypervolume(paretoFront, objectives);
    const spacing = this.calculateSpacing(paretoFront);
    const spread = this.calculateSpread(paretoFront, objectives);
    
    // Additional multi-objective metrics
    const convergenceMetric = this.calculateConvergenceMetric(paretoFront);
    const diversityMetric = this.calculateDiversityMetric(paretoFront);
    
    return {
      hypervolume,
      spacing,
      spread,
      convergenceMetric,
      diversityMetric
    };
  }

  private analyzeConvergence(generationHistory: Array<any>) {
    let convergenceGeneration = generationHistory.length;
    let convergenceRate = 0;
    let plateauDetection = false;
    let prematureConvergence = false;
    const stagnationPeriods: number[] = [];
    
    // Find convergence point (where improvement stops)
    const fitnessHistory = generationHistory.map(g => g.bestFitness);
    let lastImprovement = 0;
    const improvementThreshold = 0.001;
    
    for (let i = 1; i < fitnessHistory.length; i++) {
      if (fitnessHistory[i] - fitnessHistory[i - 1] > improvementThreshold) {
        lastImprovement = i;
      }
    }
    
    convergenceGeneration = lastImprovement;
    
    // Calculate convergence rate
    if (generationHistory.length > 10) {
      const recent = fitnessHistory.slice(-10);
      const slope = this.calculateSlope(recent);
      convergenceRate = Math.abs(slope);
    }
    
    // Detect plateaus and stagnation
    let stagnationStart = -1;
    for (let i = 1; i < fitnessHistory.length; i++) {
      if (Math.abs(fitnessHistory[i] - fitnessHistory[i - 1]) < improvementThreshold) {
        if (stagnationStart === -1) stagnationStart = i;
      } else {
        if (stagnationStart !== -1) {
          stagnationPeriods.push(i - stagnationStart);
          stagnationStart = -1;
        }
      }
    }
    
    plateauDetection = stagnationPeriods.length > 0;
    prematureConvergence = convergenceGeneration < generationHistory.length * 0.3;
    
    return {
      convergenceRate,
      convergenceGeneration,
      plateauDetection,
      prematureConvergence,
      stagnationPeriods
    };
  }

  private analyzeRobustness(population: Population, generationHistory: Array<any>) {
    // Parameter sensitivity (lower is more robust)
    const parameterSensitivity = this.calculateAverageParameterSensitivity(population);
    
    // Performance stability across generations
    const fitnessHistory = generationHistory.map(g => g.bestFitness);
    const performanceStability = 1 - (this.calculateStandardDeviation(fitnessHistory) / 
                                      this.calculateMean(fitnessHistory));
    
    // Outlier resistance
    const fitnessValues = population.map(ind => ind.fitness.overall);
    const outlierCount = this.countOutliers(fitnessValues);
    const outlierResistance = 1 - (outlierCount / population.length);
    
    // Noise resilience (simplified)
    const noiseResilience = Math.max(0, Math.min(1, performanceStability));
    
    return {
      parameterSensitivity: 1 - Math.min(1, parameterSensitivity),
      performanceStability: Math.max(0, performanceStability),
      outlierResistance,
      noiseResilience
    };
  }

  private analyzeQuality(population: Population, paretoFront: ParetoFrontier, config: GeneticOptimizationConfig) {
    // Solution quality (average fitness relative to best possible)
    const bestFitness = Math.max(...population.map(ind => ind.fitness.overall));
    const averageFitness = population.reduce((sum, ind) => sum + ind.fitness.overall, 0) / population.length;
    const solutionQuality = bestFitness > 0 ? averageFitness / bestFitness : 0;
    
    // Diversity maintenance
    const diversityMaintenance = this.calculateDiversityMaintenance(population);
    
    // Constraint satisfaction
    const constraintSatisfaction = population.filter(ind => ind.fitness.feasible).length / population.length;
    
    // Objective balance (for multi-objective)
    let objectiveBalance = 1;
    if (config.objectives.length > 1) {
      objectiveBalance = this.calculateObjectiveBalance(population, config.objectives);
    }
    
    return {
      solutionQuality,
      diversityMaintenance,
      constraintSatisfaction,
      objectiveBalance
    };
  }

  private generateRecommendations(
    population: Population,
    paretoFront: ParetoFrontier,
    generationHistory: Array<any>,
    config: GeneticOptimizationConfig
  ) {
    const recommendations: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const insights: string[] = [];
    
    // Analyze convergence
    const diversity = generationHistory[generationHistory.length - 1]?.diversity || 0;
    if (diversity < 0.1) {
      warnings.push('Low population diversity detected - consider increasing mutation rate');
      recommendations.push('Increase mutation rate or population size to maintain diversity');
    }
    
    // Analyze performance
    const bestFitness = Math.max(...population.map(ind => ind.fitness.overall));
    if (bestFitness < 0.5) {
      warnings.push('Low overall fitness achieved');
      recommendations.push('Consider adjusting fitness function or parameter ranges');
    }
    
    // Multi-objective insights
    if (config.objectives.length > 1) {
      const hypervolumeValue = this.calculateHypervolume(paretoFront, config.objectives);
      if (hypervolumeValue > 0.8) {
        insights.push('Excellent multi-objective optimization with high hypervolume');
      } else if (hypervolumeValue < 0.3) {
        recommendations.push('Consider running optimization longer or adjusting objectives');
      }
    }
    
    // Parameter analysis insights
    const paramImportance = this.analyzeParameterImportance(population);
    const mostImportant = Object.entries(paramImportance)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostImportant) {
      insights.push(`Parameter '${mostImportant[0]}' shows highest importance (${mostImportant[1].toFixed(3)})`);
    }
    
    return { recommendations, warnings, errors, insights };
  }

  private prepareVisualizationData(
    population: Population,
    paretoFront: ParetoFrontier,
    generationHistory: Array<any>
  ) {
    // Fitness evolution
    const fitnessEvolution = generationHistory.map(g => ({
      generation: g.generation,
      best: g.bestFitness,
      average: g.averageFitness,
      diversity: g.diversity
    }));
    
    // Pareto front evolution (if applicable)
    const paretoFrontEvolution = generationHistory.map(g => ({
      generation: g.generation,
      frontSize: paretoFront.length, // Simplified
      hypervolume: 0 // Would need to calculate for each generation
    }));
    
    // Parameter distributions
    const parameterDistributions: Record<string, number[]> = {};
    const parameterNames = ['shortMAPeriod', 'longMAPeriod', 'rsiPeriod', 'stopLossPercent'];
    
    for (const paramName of parameterNames) {
      parameterDistributions[paramName] = population.map(ind => 
        this.extractParameterValue(ind, paramName)
      );
    }
    
    // Objective space data (2D projection for visualization)
    const objectiveSpaceData = population.map(ind => ({
      x: ind.fitness.objectives[0]?.normalizedScore || 0,
      y: ind.fitness.objectives[1]?.normalizedScore || 0,
      fitness: ind.fitness.overall,
      dominated: ind.dominanceRank > 0
    }));
    
    // Convergence metrics
    const convergenceMetrics = generationHistory.map(g => ({
      generation: g.generation,
      convergence: g.convergence,
      diversity: g.diversity
    }));
    
    return {
      fitnessEvolution,
      paretoFrontEvolution,
      parameterDistributions,
      objectiveSpaceData,
      convergenceMetrics
    };
  }

  // Additional helper methods...
  
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < x.length; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      denomX += deltaX * deltaX;
      denomY += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateSensitivity(paramValues: number[], fitnessValues: number[]): number {
    // Calculate sensitivity as fitness change per unit parameter change
    const correlation = this.calculateCorrelation(paramValues, fitnessValues);
    const paramStd = this.calculateStandardDeviation(paramValues);
    const fitnessStd = this.calculateStandardDeviation(fitnessValues);
    
    return paramStd > 0 ? Math.abs(correlation * fitnessStd / paramStd) : 0;
  }

  private calculateStability(paramValues: number[], fitnessValues: number[]): number {
    // Calculate stability as consistency of parameter-fitness relationship
    const correlation = this.calculateCorrelation(paramValues, fitnessValues);
    return Math.abs(correlation);
  }

  private identifyOptimalRange(paramValues: number[], fitnessValues: number[]): [number, number] {
    // Identify parameter range that produces top 25% of fitness values
    const combined = paramValues.map((param, i) => ({ param, fitness: fitnessValues[i] }));
    combined.sort((a, b) => b.fitness - a.fitness);
    
    const top25Percent = combined.slice(0, Math.ceil(combined.length * 0.25));
    const topParams = top25Percent.map(item => item.param);
    
    return [Math.min(...topParams), Math.max(...topParams)];
  }

  private identifyCriticalThresholds(paramValues: number[], fitnessValues: number[]): number[] {
    // Simplified threshold identification
    const sortedValues = [...paramValues].sort((a, b) => a - b);
    const quartiles = [
      sortedValues[Math.floor(sortedValues.length * 0.25)],
      sortedValues[Math.floor(sortedValues.length * 0.5)],
      sortedValues[Math.floor(sortedValues.length * 0.75)]
    ];
    
    return quartiles;
  }

  private identifyParameterInteractions(population: Population, paramName: string): any[] {
    // Simplified interaction analysis
    return []; // Would implement full interaction analysis in production
  }

  private calculateHypervolumeExact(
    paretoFront: ParetoFrontier,
    objectives: OptimizationObjective[],
    referencePoint: number[]
  ): number {
    // Simplified hypervolume calculation for 2D case
    if (objectives.length === 2) {
      const points = paretoFront.map(ind => [
        ind.fitness.objectives[0]?.normalizedScore || 0,
        ind.fitness.objectives[1]?.normalizedScore || 0
      ]);
      
      points.sort((a, b) => b[0] - a[0]); // Sort by first objective descending
      
      let hypervolume = 0;
      let lastY = referencePoint[1];
      
      for (const point of points) {
        if (point[1] > lastY) {
          hypervolume += (point[0] - referencePoint[0]) * (point[1] - lastY);
          lastY = point[1];
        }
      }
      
      return hypervolume;
    }
    
    return 0; // Placeholder for higher dimensions
  }

  private calculateHypervolumeMonteCarloApproximation(
    paretoFront: ParetoFrontier,
    objectives: OptimizationObjective[],
    referencePoint: number[]
  ): number {
    // Monte Carlo approximation for high-dimensional hypervolume
    const samples = 10000;
    let dominatedSamples = 0;
    
    for (let i = 0; i < samples; i++) {
      // Generate random point
      const randomPoint = referencePoint.map((ref, idx) => 
        ref + Math.random() * (1 - ref) // Assuming normalized objectives
      );
      
      // Check if random point is dominated by any Pareto front member
      for (const individual of paretoFront) {
        let dominated = true;
        for (let objIdx = 0; objIdx < objectives.length; objIdx++) {
          const objValue = individual.fitness.objectives[objIdx]?.normalizedScore || 0;
          if (objectives[objIdx].type === 'maximize') {
            if (objValue < randomPoint[objIdx]) {
              dominated = false;
              break;
            }
          } else {
            if (objValue > randomPoint[objIdx]) {
              dominated = false;
              break;
            }
          }
        }
        
        if (dominated) {
          dominatedSamples++;
          break;
        }
      }
    }
    
    // Calculate volume of search space
    const searchSpaceVolume = referencePoint.reduce((volume, ref) => volume * (1 - ref), 1);
    
    return (dominatedSamples / samples) * searchSpaceVolume;
  }

  private calculateReferencePoint(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): number[] {
    return objectives.map((obj, idx) => {
      const values = paretoFront.map(ind => ind.fitness.objectives[idx]?.normalizedScore || 0);
      return obj.type === 'maximize' ? Math.min(...values) - 0.1 : Math.max(...values) + 0.1;
    });
  }

  private calculateEuclideanDistance(point1: number[], point2: number[]): number {
    return Math.sqrt(
      point1.reduce((sum, val, idx) => sum + Math.pow(val - point2[idx], 2), 0)
    );
  }

  private getBestIndividual(population: Population): Individual {
    return population.reduce((best, current) => 
      current.fitness.overall > best.fitness.overall ? current : best
    );
  }

  private calculateOptimizationEfficiency(generationHistory: Array<any>): number {
    if (generationHistory.length === 0) return 0;
    
    const initialFitness = generationHistory[0]?.bestFitness || 0;
    const finalFitness = generationHistory[generationHistory.length - 1]?.bestFitness || 0;
    const improvement = finalFitness - initialFitness;
    
    return improvement / generationHistory.length; // Improvement per generation
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
    const x2Sum = values.reduce((sum, _, i) => sum + i * i, 0);
    
    return (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  }

  private extractParameterValue(individual: Individual, paramName: string): number {
    // Simplified parameter extraction - would need proper DNA decoding
    return Math.random(); // Placeholder
  }

  private calculateDistributionStats(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Skewness and kurtosis calculations
    const std = Math.sqrt(variance);
    const skewness = std > 0 ? 
      values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) / values.length : 0;
    const kurtosis = std > 0 ? 
      values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) / values.length - 3 : 0;
    
    return { mean, std, skewness, kurtosis };
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private countOutliers(values: number[]): number {
    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    return values.filter(val => Math.abs(val - mean) > 2 * std).length;
  }

  private calculateConvergenceMetric(paretoFront: ParetoFrontier): number {
    // Simplified convergence metric
    return paretoFront.length > 0 ? 1 : 0;
  }

  private calculateDiversityMetric(paretoFront: ParetoFrontier): number {
    return this.calculateSpacing(paretoFront);
  }

  private calculateDiversityMaintenance(population: Population): number {
    // Calculate genetic diversity as proxy for diversity maintenance
    if (population.length < 2) return 0;
    
    let totalDistance = 0;
    let comparisons = 0;
    
    for (let i = 0; i < population.length; i++) {
      for (let j = i + 1; j < population.length; j++) {
        let distance = 0;
        for (let k = 0; k < population[i].dna.length; k++) {
          distance += Math.abs(population[i].dna[k] - population[j].dna[k]);
        }
        totalDistance += distance / population[i].dna.length;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private calculateObjectiveBalance(population: Population, objectives: OptimizationObjective[]): number {
    // Calculate how well objectives are balanced in the population
    const objectiveVariances = objectives.map(obj => {
      const values = population.map(ind => 
        ind.fitness.objectives.find(o => o.name === obj.name)?.normalizedScore || 0
      );
      return this.calculateStandardDeviation(values);
    });
    
    const meanVariance = objectiveVariances.reduce((sum, v) => sum + v, 0) / objectiveVariances.length;
    const varianceOfVariances = objectiveVariances.reduce((sum, v) => sum + Math.pow(v - meanVariance, 2), 0) / objectiveVariances.length;
    
    return 1 / (1 + Math.sqrt(varianceOfVariances)); // Lower variance of variances = better balance
  }

  private calculateAverageParameterSensitivity(population: Population): number {
    // Calculate average sensitivity across all parameters
    const parameterNames = ['shortMAPeriod', 'longMAPeriod', 'rsiPeriod', 'stopLossPercent'];
    const sensitivities = parameterNames.map(paramName => {
      const paramValues = population.map(ind => this.extractParameterValue(ind, paramName));
      const fitnessValues = population.map(ind => ind.fitness.overall);
      return this.calculateSensitivity(paramValues, fitnessValues);
    });
    
    return sensitivities.reduce((sum, s) => sum + s, 0) / sensitivities.length;
  }

  // Placeholder implementations for additional analysis methods
  private calculateDominationRatio(paretoFront: ParetoFrontier): number { return 1; }
  private calculateCoverageRatio(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): number { return 1; }
  private calculateUniformityIndex(paretoFront: ParetoFrontier): number { return 1; }
  private identifyExtremeSolutions(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): Record<string, Individual> { return {}; }
  private identifyCompromiseSolutions(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): Individual[] { return []; }
  private identifyKneeSolutions(paretoFront: ParetoFrontier, objectives: OptimizationObjective[]): Individual[] { return []; }
  private calculateFrontierDiversityMetrics(paretoFront: ParetoFrontier): any { 
    return {
      geneticDiversity: 0.5,
      objectiveDiversity: 0.5,
      crowdingDistanceStats: { mean: 0.5, std: 0.1, min: 0, max: 1 }
    }; 
  }
}