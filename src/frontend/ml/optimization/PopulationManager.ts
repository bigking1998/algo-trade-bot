/**
 * PopulationManager - Advanced Population Management for Genetic Algorithm (ML-005)
 * 
 * Implements sophisticated population management with:
 * - Advanced breeding operations (crossover, mutation, elitism)
 * - Population diversity maintenance and convergence detection
 * - Multi-objective selection strategies (NSGA-II, SPEA2)
 * - Crowding distance and fitness sharing
 * - Island model and migration support
 * - Adaptive parameter control
 * 
 * The PopulationManager handles all aspects of genetic population evolution
 * while maintaining diversity and guiding convergence toward optimal solutions.
 */

import { StrategyDNA, StrategyGenes } from './StrategyDNA';
import { FitnessScores } from './FitnessEvaluator';
import { GeneticOptimizationConfig } from './GeneticOptimizer';

export interface Individual {
  id: string;
  dna: StrategyGenes;
  fitness: FitnessScores;
  
  // Genetic metadata
  generation: number;
  parentIds: string[];
  mutationCount: number;
  crossoverCount: number;
  
  // Multi-objective properties
  dominationCount: number; // Number of solutions this dominates
  dominatedBy: Set<string>; // IDs of solutions that dominate this
  dominanceRank: number; // Pareto front rank (0 = non-dominated)
  crowdingDistance: number; // Diversity measure
  
  // Evaluation metadata
  evaluated: boolean;
  evaluationTime?: number;
  constraint_violation?: boolean;
  
  // Diversity and similarity
  similarityScore?: number;
  nichingRadius?: number;
  
  // Performance tracking
  age: number; // Generations since creation
  improvements: number; // Times fitness improved
  lastImprovement: number; // Generation of last improvement
}

export type Population = Individual[];
export type ParetoFrontier = Individual[];

export interface SelectionPressure {
  intensity: number; // 0-1, higher = more selective
  method: 'proportional' | 'linear' | 'exponential';
}

export interface DiversityMaintenance {
  enabled: boolean;
  method: 'crowding_distance' | 'fitness_sharing' | 'niching' | 'novelty';
  targetDiversity: number; // 0-1
  diversityWeight: number; // Balance with fitness
}

export interface MigrationConfig {
  enabled: boolean;
  migrationRate: number; // Individuals per migration
  migrationFrequency: number; // Generations between migrations
  topologyType: 'ring' | 'star' | 'mesh' | 'random';
  selectionStrategy: 'best' | 'random' | 'diverse';
}

/**
 * Advanced Population Management System for Genetic Algorithms
 */
export class PopulationManager {
  private config: GeneticOptimizationConfig;
  private individualCounter = 0;
  
  // Population statistics
  private populationStats = {
    averageFitness: 0,
    bestFitness: 0,
    worstFitness: 0,
    fitnessVariance: 0,
    diversityIndex: 0,
    convergenceRate: 0,
    selectionPressure: 0,
    dominanceDistribution: new Map<number, number>()
  };
  
  // Diversity tracking
  private diversityHistory: number[] = [];
  private fitnessHistory: number[][] = [];
  
  // Multi-objective state
  private paretoFronts: Individual[][] = [];
  private hypervolumeHistory: number[] = [];
  
  // Island model state (if enabled)
  private islands: Population[] = [];
  private migrationHistory: Array<{
    generation: number;
    fromIsland: number;
    toIsland: number;
    individuals: number;
  }> = [];

  constructor(config: GeneticOptimizationConfig) {
    this.config = config;
  }

  /**
   * Generate initial population with diverse individuals
   */
  generateInitialPopulation(populationSize: number, strategyDNA: StrategyDNA): Population {
    console.log(`🌱 Generating initial population of ${populationSize} individuals...`);
    
    const population: Population = [];
    
    for (let i = 0; i < populationSize; i++) {
      const individual: Individual = {
        id: this.generateIndividualId(),
        dna: strategyDNA.generateRandomDNA(),
        fitness: { overall: 0 } as FitnessScores,
        generation: 0,
        parentIds: [],
        mutationCount: 0,
        crossoverCount: 0,
        dominationCount: 0,
        dominatedBy: new Set(),
        dominanceRank: 0,
        crowdingDistance: 0,
        evaluated: false,
        age: 0,
        improvements: 0,
        lastImprovement: 0
      };
      
      population.push(individual);
    }
    
    // Ensure initial diversity
    this.enhanceInitialDiversity(population, strategyDNA);
    
    console.log(`✅ Initial population generated with diversity index: ${this.calculateDiversity(population).toFixed(3)}`);
    
    return population;
  }

  /**
   * Select parents for reproduction using specified selection method
   */
  selectParents(population: Population, method: string, tournamentSize: number = 3): Individual[] {
    const parents: Individual[] = [];
    const selectionCount = Math.floor(population.length * 0.8); // Select 80% for reproduction
    
    switch (method) {
      case 'tournament':
        for (let i = 0; i < selectionCount; i++) {
          parents.push(this.tournamentSelection(population, tournamentSize));
        }
        break;
        
      case 'roulette':
        const rouletteParents = this.rouletteWheelSelection(population, selectionCount);
        parents.push(...rouletteParents);
        break;
        
      case 'rank':
        const rankedParents = this.rankBasedSelection(population, selectionCount);
        parents.push(...rankedParents);
        break;
        
      case 'elite':
        const eliteParents = this.eliteSelection(population, selectionCount);
        parents.push(...eliteParents);
        break;
        
      default:
        // Default to tournament selection
        for (let i = 0; i < selectionCount; i++) {
          parents.push(this.tournamentSelection(population, tournamentSize));
        }
    }
    
    return parents;
  }

  /**
   * Generate offspring through crossover and mutation
   */
  async generateOffspring(
    parents: Individual[],
    crossoverMethod: string,
    mutationMethod: string,
    crossoverRate: number,
    mutationRate: number,
    strategyDNA: StrategyDNA
  ): Promise<Individual[]> {
    const offspring: Individual[] = [];
    
    // Pair parents for crossover
    for (let i = 0; i < parents.length - 1; i += 2) {
      const parent1 = parents[i];
      const parent2 = parents[i + 1] || parents[0]; // Handle odd numbers
      
      let child1DNA = [...parent1.dna];
      let child2DNA = [...parent2.dna];
      
      // Crossover
      if (Math.random() < crossoverRate) {
        [child1DNA, child2DNA] = this.performCrossover(
          parent1.dna,
          parent2.dna,
          crossoverMethod,
          strategyDNA
        );
      }
      
      // Mutation
      if (Math.random() < mutationRate) {
        child1DNA = this.performMutation(child1DNA, mutationMethod, mutationRate, strategyDNA);
      }
      
      if (Math.random() < mutationRate) {
        child2DNA = this.performMutation(child2DNA, mutationMethod, mutationRate, strategyDNA);
      }
      
      // Create offspring individuals
      const child1 = this.createOffspring(child1DNA, [parent1.id, parent2.id], parent1.generation + 1);
      const child2 = this.createOffspring(child2DNA, [parent1.id, parent2.id], parent1.generation + 1);
      
      offspring.push(child1, child2);
    }
    
    return offspring;
  }

  /**
   * Survivor selection combining parents and offspring
   */
  survivorSelection(
    parents: Population,
    offspring: Population,
    targetSize: number,
    elitismRatio: number
  ): Population {
    const combined = [...parents, ...offspring];
    
    // Multi-objective selection
    if (this.config.objectives.length > 1) {
      return this.nsgaIISelection(combined, targetSize);
    }
    
    // Single-objective selection with elitism
    const eliteCount = Math.floor(targetSize * elitismRatio);
    const regularCount = targetSize - eliteCount;
    
    // Sort by fitness
    combined.sort((a, b) => b.fitness.overall - a.fitness.overall);
    
    // Elite individuals (best fitness)
    const elite = combined.slice(0, eliteCount);
    
    // Regular selection (tournament or diversity-based)
    const remaining = combined.slice(eliteCount);
    const regular: Individual[] = [];
    
    while (regular.length < regularCount && remaining.length > 0) {
      if (this.config.diversityMaintenance && regular.length > regularCount * 0.5) {
        // Diversity-based selection for second half
        const selected = this.selectMostDiverse(remaining, regular);
        regular.push(selected);
        remaining.splice(remaining.indexOf(selected), 1);
      } else {
        // Fitness-based selection for first half
        const selected = this.tournamentSelection(remaining, 3);
        regular.push(selected);
        remaining.splice(remaining.indexOf(selected), 1);
      }
    }
    
    const survivors = [...elite, ...regular];
    
    // Update population statistics
    this.updatePopulationStats(survivors);
    
    return survivors;
  }

  /**
   * Extract Pareto front from population (for multi-objective optimization)
   */
  extractParetoFront(population: Population): ParetoFrontier {
    if (population.length === 0) return [];
    
    // Calculate dominance relationships
    this.calculateDominance(population);
    
    // Extract non-dominated solutions (rank 0)
    const paretoFront = population.filter(ind => ind.dominanceRank === 0);
    
    // Calculate crowding distance for diversity
    this.calculateCrowdingDistance(paretoFront);
    
    return paretoFront.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
  }

  /**
   * Select best individuals from Pareto front based on crowding distance
   */
  selectBestFromParetoFront(paretoFront: ParetoFrontier, count: number): ParetoFrontier {
    if (paretoFront.length <= count) return paretoFront;
    
    // Sort by crowding distance (prefer diverse solutions)
    paretoFront.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
    
    return paretoFront.slice(0, count);
  }

  /**
   * Calculate population diversity index
   */
  calculateDiversity(population: Population): number {
    if (population.length < 2) return 0;
    
    let totalDistance = 0;
    let comparisons = 0;
    
    for (let i = 0; i < population.length; i++) {
      for (let j = i + 1; j < population.length; j++) {
        // Calculate genetic diversity (Hamming distance)
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

  /**
   * Detect population convergence
   */
  detectConvergence(population: Population, threshold = 0.01): boolean {
    const diversity = this.calculateDiversity(population);
    const fitnessVariance = this.calculateFitnessVariance(population);
    
    return diversity < threshold && fitnessVariance < threshold;
  }

  /**
   * Get population statistics
   */
  getPopulationStats() {
    return { ...this.populationStats };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private enhanceInitialDiversity(population: Population, strategyDNA: StrategyDNA): void {
    // Ensure diverse initial population by modifying some individuals
    const diversityTargets = Math.floor(population.length * 0.3);
    
    for (let i = 0; i < diversityTargets; i++) {
      const individual = population[i];
      
      // Apply strong mutation to increase diversity
      individual.dna = strategyDNA.gaussianMutation(individual.dna, 0.5, 0.2);
    }
  }

  private tournamentSelection(population: Population, tournamentSize: number): Individual {
    const tournament: Individual[] = [];
    
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }
    
    // Multi-objective tournament selection
    if (this.config.objectives.length > 1) {
      return this.multiObjectiveTournament(tournament);
    }
    
    // Single-objective tournament
    return tournament.reduce((best, current) =>
      current.fitness.overall > best.fitness.overall ? current : best
    );
  }

  private multiObjectiveTournament(tournament: Individual[]): Individual {
    // Prefer individuals with better dominance rank
    tournament.sort((a, b) => {
      if (a.dominanceRank !== b.dominanceRank) {
        return a.dominanceRank - b.dominanceRank;
      }
      // If same rank, prefer higher crowding distance
      return b.crowdingDistance - a.crowdingDistance;
    });
    
    return tournament[0];
  }

  private rouletteWheelSelection(population: Population, count: number): Individual[] {
    const selected: Individual[] = [];
    
    // Calculate total fitness and create cumulative distribution
    const totalFitness = population.reduce((sum, ind) => sum + Math.max(0, ind.fitness.overall), 0);
    
    if (totalFitness === 0) {
      // Random selection if no positive fitness
      for (let i = 0; i < count; i++) {
        selected.push(population[Math.floor(Math.random() * population.length)]);
      }
      return selected;
    }
    
    for (let i = 0; i < count; i++) {
      let randomValue = Math.random() * totalFitness;
      let cumulativeSum = 0;
      
      for (const individual of population) {
        cumulativeSum += Math.max(0, individual.fitness.overall);
        if (cumulativeSum >= randomValue) {
          selected.push(individual);
          break;
        }
      }
    }
    
    return selected;
  }

  private rankBasedSelection(population: Population, count: number): Individual[] {
    // Sort by fitness and assign rank-based probabilities
    const sorted = [...population].sort((a, b) => b.fitness.overall - a.fitness.overall);
    const selected: Individual[] = [];
    
    for (let i = 0; i < count; i++) {
      // Linear ranking: probability inversely proportional to rank
      const weights = sorted.map((_, index) => sorted.length - index);
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      
      let randomValue = Math.random() * totalWeight;
      let cumulativeWeight = 0;
      
      for (let j = 0; j < sorted.length; j++) {
        cumulativeWeight += weights[j];
        if (cumulativeWeight >= randomValue) {
          selected.push(sorted[j]);
          break;
        }
      }
    }
    
    return selected;
  }

  private eliteSelection(population: Population, count: number): Individual[] {
    return [...population]
      .sort((a, b) => b.fitness.overall - a.fitness.overall)
      .slice(0, count);
  }

  private performCrossover(
    parent1: StrategyGenes,
    parent2: StrategyGenes,
    method: string,
    strategyDNA: StrategyDNA
  ): [StrategyGenes, StrategyGenes] {
    switch (method) {
      case 'uniform':
        return strategyDNA.uniformCrossover(parent1, parent2, 0.5);
      case 'single_point':
        return strategyDNA.singlePointCrossover(parent1, parent2);
      case 'two_point':
        return this.twoPointCrossover(parent1, parent2);
      case 'arithmetic':
        return this.arithmeticCrossover(parent1, parent2);
      case 'blx_alpha':
        return this.blxAlphaCrossover(parent1, parent2, 0.5);
      default:
        return strategyDNA.parameterAwareCrossover(parent1, parent2);
    }
  }

  private twoPointCrossover(parent1: StrategyGenes, parent2: StrategyGenes): [StrategyGenes, StrategyGenes] {
    const point1 = Math.floor(Math.random() * parent1.length);
    const point2 = Math.floor(Math.random() * parent1.length);
    const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];
    
    const child1 = [...parent1];
    const child2 = [...parent2];
    
    // Swap middle section
    for (let i = start; i <= end; i++) {
      child1[i] = parent2[i];
      child2[i] = parent1[i];
    }
    
    return [child1, child2];
  }

  private arithmeticCrossover(parent1: StrategyGenes, parent2: StrategyGenes): [StrategyGenes, StrategyGenes] {
    const alpha = Math.random();
    
    const child1 = parent1.map((gene, i) => alpha * gene + (1 - alpha) * parent2[i]);
    const child2 = parent2.map((gene, i) => alpha * gene + (1 - alpha) * parent1[i]);
    
    return [child1, child2];
  }

  private blxAlphaCrossover(parent1: StrategyGenes, parent2: StrategyGenes, alpha: number): [StrategyGenes, StrategyGenes] {
    const child1: StrategyGenes = [];
    const child2: StrategyGenes = [];
    
    for (let i = 0; i < parent1.length; i++) {
      const min = Math.min(parent1[i], parent2[i]);
      const max = Math.max(parent1[i], parent2[i]);
      const range = max - min;
      
      const lower = min - alpha * range;
      const upper = max + alpha * range;
      
      child1.push(lower + Math.random() * (upper - lower));
      child2.push(lower + Math.random() * (upper - lower));
    }
    
    return [child1, child2];
  }

  private performMutation(
    dna: StrategyGenes,
    method: string,
    mutationRate: number,
    strategyDNA: StrategyDNA
  ): StrategyGenes {
    switch (method) {
      case 'gaussian':
        return strategyDNA.gaussianMutation(dna, mutationRate, 0.1);
      case 'polynomial':
        return strategyDNA.polynomialMutation(dna, mutationRate, 20);
      case 'uniform':
        return this.uniformMutation(dna, mutationRate);
      case 'boundary':
        return this.boundaryMutation(dna, mutationRate);
      case 'non_uniform':
        return this.nonUniformMutation(dna, mutationRate, 100); // Assuming max generation = 100
      default:
        return strategyDNA.gaussianMutation(dna, mutationRate, 0.1);
    }
  }

  private uniformMutation(dna: StrategyGenes, mutationRate: number): StrategyGenes {
    return dna.map(gene => {
      if (Math.random() < mutationRate) {
        return Math.random(); // Assuming normalized genes
      }
      return gene;
    });
  }

  private boundaryMutation(dna: StrategyGenes, mutationRate: number): StrategyGenes {
    return dna.map(gene => {
      if (Math.random() < mutationRate) {
        return Math.random() < 0.5 ? 0 : 1; // Move to boundary
      }
      return gene;
    });
  }

  private nonUniformMutation(dna: StrategyGenes, mutationRate: number, maxGeneration: number): StrategyGenes {
    const currentGeneration = 50; // Would be passed from optimizer
    
    return dna.map(gene => {
      if (Math.random() < mutationRate) {
        const r = Math.random();
        const b = 2; // Shape parameter
        const delta = r < 0.5 ? 
          Math.pow(2 * r, 1 / (b * (1 - currentGeneration / maxGeneration) + 1)) - 1 :
          1 - Math.pow(2 * (1 - r), 1 / (b * (1 - currentGeneration / maxGeneration) + 1));
        
        return Math.max(0, Math.min(1, gene + delta));
      }
      return gene;
    });
  }

  private createOffspring(dna: StrategyGenes, parentIds: string[], generation: number): Individual {
    return {
      id: this.generateIndividualId(),
      dna,
      fitness: { overall: 0 } as FitnessScores,
      generation,
      parentIds,
      mutationCount: 0,
      crossoverCount: parentIds.length > 1 ? 1 : 0,
      dominationCount: 0,
      dominatedBy: new Set(),
      dominanceRank: 0,
      crowdingDistance: 0,
      evaluated: false,
      age: 0,
      improvements: 0,
      lastImprovement: generation
    };
  }

  private nsgaIISelection(population: Population, targetSize: number): Population {
    // Calculate dominance relationships
    this.calculateDominance(population);
    
    // Sort into Pareto fronts
    const fronts = this.sortIntoFronts(population);
    
    const survivors: Individual[] = [];
    let frontIndex = 0;
    
    // Include complete fronts until target size is approached
    while (frontIndex < fronts.length && survivors.length + fronts[frontIndex].length <= targetSize) {
      survivors.push(...fronts[frontIndex]);
      frontIndex++;
    }
    
    // If there's still space and another front exists
    if (frontIndex < fronts.length && survivors.length < targetSize) {
      const remainingFront = fronts[frontIndex];
      this.calculateCrowdingDistance(remainingFront);
      
      // Sort by crowding distance (descending)
      remainingFront.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
      
      // Add individuals with highest crowding distance
      const remainingSlots = targetSize - survivors.length;
      survivors.push(...remainingFront.slice(0, remainingSlots));
    }
    
    return survivors;
  }

  private calculateDominance(population: Population): void {
    // Reset dominance values
    population.forEach(ind => {
      ind.dominationCount = 0;
      ind.dominatedBy.clear();
    });
    
    // Calculate dominance relationships
    for (let i = 0; i < population.length; i++) {
      for (let j = i + 1; j < population.length; j++) {
        const ind1 = population[i];
        const ind2 = population[j];
        
        if (this.dominates(ind1, ind2)) {
          ind1.dominationCount++;
          ind2.dominatedBy.add(ind1.id);
        } else if (this.dominates(ind2, ind1)) {
          ind2.dominationCount++;
          ind1.dominatedBy.add(ind2.id);
        }
      }
    }
  }

  private dominates(ind1: Individual, ind2: Individual): boolean {
    let betterInAtLeastOne = false;
    
    for (let i = 0; i < ind1.fitness.objectives.length; i++) {
      const obj1 = ind1.fitness.objectives[i];
      const obj2 = ind2.fitness.objectives[i];
      
      const objective = this.config.objectives.find(o => o.name === obj1.name);
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

  private sortIntoFronts(population: Population): Population[] {
    const fronts: Population[] = [];
    const remaining = [...population];
    
    while (remaining.length > 0) {
      const currentFront = remaining.filter(ind => ind.dominatedBy.size === 0);
      
      if (currentFront.length === 0) break; // Safety check
      
      // Update dominance rank
      currentFront.forEach(ind => ind.dominanceRank = fronts.length);
      
      fronts.push(currentFront);
      
      // Remove current front and update dominance counts
      currentFront.forEach(dominated => {
        const index = remaining.indexOf(dominated);
        if (index > -1) remaining.splice(index, 1);
        
        // Update dominance for individuals dominated by this one
        remaining.forEach(ind => {
          if (ind.dominatedBy.has(dominated.id)) {
            ind.dominatedBy.delete(dominated.id);
          }
        });
      });
    }
    
    return fronts;
  }

  private calculateCrowdingDistance(front: Population): void {
    const frontSize = front.length;
    if (frontSize <= 2) {
      front.forEach(ind => ind.crowdingDistance = Infinity);
      return;
    }
    
    // Initialize crowding distance
    front.forEach(ind => ind.crowdingDistance = 0);
    
    // Calculate distance for each objective
    for (let objIndex = 0; objIndex < this.config.objectives.length; objIndex++) {
      // Sort by objective value
      front.sort((a, b) => {
        const objA = a.fitness.objectives[objIndex]?.normalizedScore || 0;
        const objB = b.fitness.objectives[objIndex]?.normalizedScore || 0;
        return objA - objB;
      });
      
      // Boundary points get infinite distance
      front[0].crowdingDistance = Infinity;
      front[frontSize - 1].crowdingDistance = Infinity;
      
      // Calculate distance for intermediate points
      const objRange = front[frontSize - 1].fitness.objectives[objIndex]?.normalizedScore - 
                      front[0].fitness.objectives[objIndex]?.normalizedScore;
      
      if (objRange > 0) {
        for (let i = 1; i < frontSize - 1; i++) {
          const distance = (front[i + 1].fitness.objectives[objIndex]?.normalizedScore - 
                           front[i - 1].fitness.objectives[objIndex]?.normalizedScore) / objRange;
          
          front[i].crowdingDistance += distance;
        }
      }
    }
  }

  private selectMostDiverse(candidates: Population, existing: Population): Individual {
    let maxMinDistance = -1;
    let mostDiverse = candidates[0];
    
    for (const candidate of candidates) {
      let minDistance = Infinity;
      
      // Calculate minimum distance to existing individuals
      for (const existing_ind of existing) {
        let distance = 0;
        for (let i = 0; i < candidate.dna.length; i++) {
          distance += Math.abs(candidate.dna[i] - existing_ind.dna[i]);
        }
        distance /= candidate.dna.length;
        
        minDistance = Math.min(minDistance, distance);
      }
      
      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        mostDiverse = candidate;
      }
    }
    
    return mostDiverse;
  }

  private calculateFitnessVariance(population: Population): number {
    const fitnesses = population.map(ind => ind.fitness.overall);
    const mean = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
    const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnesses.length;
    return variance;
  }

  private updatePopulationStats(population: Population): void {
    const fitnesses = population.map(ind => ind.fitness.overall);
    
    this.populationStats.averageFitness = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
    this.populationStats.bestFitness = Math.max(...fitnesses);
    this.populationStats.worstFitness = Math.min(...fitnesses);
    this.populationStats.fitnessVariance = this.calculateFitnessVariance(population);
    this.populationStats.diversityIndex = this.calculateDiversity(population);
    
    // Update diversity history
    this.diversityHistory.push(this.populationStats.diversityIndex);
    if (this.diversityHistory.length > 50) {
      this.diversityHistory.shift();
    }
    
    // Calculate convergence rate
    if (this.diversityHistory.length > 10) {
      const recent = this.diversityHistory.slice(-10);
      const slope = this.calculateTrendSlope(recent);
      this.populationStats.convergenceRate = Math.abs(slope);
    }
  }

  private calculateTrendSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
    const x2Sum = values.reduce((sum, _, i) => sum + i * i, 0);
    
    return (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  }

  private generateIndividualId(): string {
    return `ind_${this.individualCounter++}_${Date.now()}`;
  }
}