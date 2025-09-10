/**
 * GeneticAlgorithm - Task BE-034: Genetic Algorithm Optimizer
 * 
 * Sophisticated genetic algorithm implementation including:
 * - Population-based optimization with diverse selection strategies
 * - Advanced crossover and mutation operators
 * - Multi-objective optimization with Pareto ranking
 * - Elitism and diversity preservation strategies
 * - Adaptive parameter control
 * - Constraint handling and penalty methods
 * - Convergence detection and premature convergence prevention
 */

import { EventEmitter } from 'events';

/**
 * Individual in the genetic algorithm population
 */
interface Individual {
  id: string;
  genes: number[];              // Parameter values
  fitness: number;              // Primary fitness value
  objectives: number[];         // Multi-objective values
  rank?: number;                // Pareto rank (for NSGA-II)
  crowdingDistance?: number;    // Crowding distance (for NSGA-II)
  age: number;                  // Age in generations
  constraintViolation: number;  // Constraint violation penalty
  dominationCount?: number;     // Number of individuals that dominate this one
  dominatedIndividuals?: Set<string>; // Individuals dominated by this one
}

/**
 * Parameter definition for genetic algorithm
 */
interface GAParameter {
  name: string;
  type: 'real' | 'integer' | 'binary' | 'categorical';
  min: number;
  max: number;
  precision?: number;           // For real parameters
  values?: any[];              // For categorical parameters
  mutationRate?: number;       // Parameter-specific mutation rate
}

/**
 * Multi-objective definition
 */
interface Objective {
  name: string;
  type: 'maximize' | 'minimize';
  weight: number;              // For weighted sum approach
  constraint?: {
    type: 'min' | 'max';
    value: number;
  };
}

/**
 * Selection strategy interface
 */
interface SelectionStrategy {
  name: string;
  select(population: Individual[], selectionPressure: number): Individual[];
}

/**
 * Crossover operator interface
 */
interface CrossoverOperator {
  name: string;
  crossover(parent1: Individual, parent2: Individual, parameters: GAParameter[]): Individual[];
}

/**
 * Mutation operator interface
 */
interface MutationOperator {
  name: string;
  mutate(individual: Individual, parameters: GAParameter[], mutationRate: number): Individual;
}

/**
 * Tournament selection strategy
 */
class TournamentSelection implements SelectionStrategy {
  name = 'Tournament Selection';
  private tournamentSize: number;

  constructor(tournamentSize: number = 3) {
    this.tournamentSize = tournamentSize;
  }

  select(population: Individual[], selectionPressure: number): Individual[] {
    const selected: Individual[] = [];
    const tournamentSize = Math.max(2, Math.floor(this.tournamentSize * selectionPressure));

    for (let i = 0; i < population.length; i++) {
      // Run tournament
      const tournament: Individual[] = [];
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }

      // Select best from tournament
      const winner = tournament.reduce((best, current) => {
        if (this.compareIndividuals(current, best) > 0) {
          return current;
        }
        return best;
      });

      selected.push(winner);
    }

    return selected;
  }

  private compareIndividuals(a: Individual, b: Individual): number {
    // First compare constraint violations
    if (a.constraintViolation !== b.constraintViolation) {
      return a.constraintViolation < b.constraintViolation ? 1 : -1;
    }

    // Then compare fitness
    return a.fitness - b.fitness;
  }
}

/**
 * Roulette wheel selection strategy
 */
class RouletteWheelSelection implements SelectionStrategy {
  name = 'Roulette Wheel Selection';

  select(population: Individual[], selectionPressure: number): Individual[] {
    // Ensure all fitness values are positive
    const minFitness = Math.min(...population.map(ind => ind.fitness));
    const offset = minFitness < 0 ? Math.abs(minFitness) + 1 : 0;

    const adjustedFitness = population.map(ind => ind.fitness + offset);
    const totalFitness = adjustedFitness.reduce((sum, f) => sum + f, 0);

    if (totalFitness === 0) {
      // Fallback to random selection
      return population.sort(() => Math.random() - 0.5);
    }

    const selected: Individual[] = [];
    for (let i = 0; i < population.length; i++) {
      const randomValue = Math.random() * totalFitness;
      let currentSum = 0;

      for (let j = 0; j < population.length; j++) {
        currentSum += adjustedFitness[j];
        if (currentSum >= randomValue) {
          selected.push(population[j]);
          break;
        }
      }
    }

    return selected;
  }
}

/**
 * NSGA-II selection for multi-objective optimization
 */
class NSGAIISelection implements SelectionStrategy {
  name = 'NSGA-II Selection';

  select(population: Individual[], selectionPressure: number): Individual[] {
    // Perform non-dominated sorting
    const fronts = this.nonDominatedSort(population);
    
    // Calculate crowding distance for each front
    fronts.forEach(front => this.calculateCrowdingDistance(front));

    // Select individuals for next generation
    const selected: Individual[] = [];
    let frontIndex = 0;

    while (selected.length < population.length && frontIndex < fronts.length) {
      const currentFront = fronts[frontIndex];
      
      if (selected.length + currentFront.length <= population.length) {
        // Add entire front
        selected.push(...currentFront);
      } else {
        // Partially fill from this front using crowding distance
        const remaining = population.length - selected.length;
        currentFront.sort((a, b) => (b.crowdingDistance || 0) - (a.crowdingDistance || 0));
        selected.push(...currentFront.slice(0, remaining));
      }

      frontIndex++;
    }

    return selected;
  }

  private nonDominatedSort(population: Individual[]): Individual[][] {
    const fronts: Individual[][] = [];
    
    // Initialize domination counts
    population.forEach(individual => {
      individual.dominationCount = 0;
      individual.dominatedIndividuals = new Set();

      population.forEach(other => {
        if (this.dominates(individual, other)) {
          individual.dominatedIndividuals!.add(other.id);
        } else if (this.dominates(other, individual)) {
          individual.dominationCount!++;
        }
      });

      if (individual.dominationCount === 0) {
        individual.rank = 0;
        if (!fronts[0]) fronts[0] = [];
        fronts[0].push(individual);
      }
    });

    // Build subsequent fronts
    let frontIndex = 0;
    while (fronts[frontIndex] && fronts[frontIndex].length > 0) {
      const nextFront: Individual[] = [];

      fronts[frontIndex].forEach(individual => {
        individual.dominatedIndividuals!.forEach(dominatedId => {
          const dominated = population.find(ind => ind.id === dominatedId);
          if (dominated) {
            dominated.dominationCount!--;
            if (dominated.dominationCount === 0) {
              dominated.rank = frontIndex + 1;
              nextFront.push(dominated);
            }
          }
        });
      });

      if (nextFront.length > 0) {
        fronts[frontIndex + 1] = nextFront;
      }
      frontIndex++;
    }

    return fronts;
  }

  private dominates(a: Individual, b: Individual): boolean {
    // a dominates b if a is at least as good as b in all objectives
    // and strictly better in at least one objective
    let atLeastAsGood = true;
    let strictlyBetter = false;

    for (let i = 0; i < a.objectives.length; i++) {
      if (a.objectives[i] < b.objectives[i]) {
        atLeastAsGood = false;
        break;
      }
      if (a.objectives[i] > b.objectives[i]) {
        strictlyBetter = true;
      }
    }

    return atLeastAsGood && strictlyBetter;
  }

  private calculateCrowdingDistance(front: Individual[]): void {
    const numObjectives = front[0].objectives.length;
    
    // Initialize crowding distances
    front.forEach(individual => {
      individual.crowdingDistance = 0;
    });

    // Calculate crowding distance for each objective
    for (let obj = 0; obj < numObjectives; obj++) {
      // Sort by objective value
      front.sort((a, b) => a.objectives[obj] - b.objectives[obj]);

      // Set boundary points to infinite distance
      front[0].crowdingDistance = Infinity;
      front[front.length - 1].crowdingDistance = Infinity;

      const objRange = front[front.length - 1].objectives[obj] - front[0].objectives[obj];
      
      if (objRange > 0) {
        for (let i = 1; i < front.length - 1; i++) {
          const distance = (front[i + 1].objectives[obj] - front[i - 1].objectives[obj]) / objRange;
          front[i].crowdingDistance! += distance;
        }
      }
    }
  }
}

/**
 * Simulated Binary Crossover (SBX)
 */
class SimulatedBinaryCrossover implements CrossoverOperator {
  name = 'Simulated Binary Crossover';
  private eta: number; // Distribution index

  constructor(eta: number = 20) {
    this.eta = eta;
  }

  crossover(parent1: Individual, parent2: Individual, parameters: GAParameter[]): Individual[] {
    const child1Genes: number[] = [];
    const child2Genes: number[] = [];

    for (let i = 0; i < parent1.genes.length; i++) {
      const param = parameters[i];
      
      if (param.type === 'real' || param.type === 'integer') {
        const [c1, c2] = this.crossoverReal(
          parent1.genes[i],
          parent2.genes[i],
          param.min,
          param.max
        );
        
        child1Genes.push(param.type === 'integer' ? Math.round(c1) : c1);
        child2Genes.push(param.type === 'integer' ? Math.round(c2) : c2);
      } else {
        // For binary/categorical, use uniform crossover
        if (Math.random() < 0.5) {
          child1Genes.push(parent1.genes[i]);
          child2Genes.push(parent2.genes[i]);
        } else {
          child1Genes.push(parent2.genes[i]);
          child2Genes.push(parent1.genes[i]);
        }
      }
    }

    return [
      {
        id: this.generateId(),
        genes: child1Genes,
        fitness: 0,
        objectives: [],
        age: 0,
        constraintViolation: 0
      },
      {
        id: this.generateId(),
        genes: child2Genes,
        fitness: 0,
        objectives: [],
        age: 0,
        constraintViolation: 0
      }
    ];
  }

  private crossoverReal(p1: number, p2: number, min: number, max: number): [number, number] {
    if (Math.random() > 0.5) {
      return [p1, p2]; // No crossover
    }

    const u = Math.random();
    let beta: number;

    if (u <= 0.5) {
      beta = Math.pow(2 * u, 1 / (this.eta + 1));
    } else {
      beta = Math.pow(1 / (2 * (1 - u)), 1 / (this.eta + 1));
    }

    const c1 = 0.5 * ((p1 + p2) - beta * Math.abs(p2 - p1));
    const c2 = 0.5 * ((p1 + p2) + beta * Math.abs(p2 - p1));

    // Ensure bounds
    return [
      Math.max(min, Math.min(max, c1)),
      Math.max(min, Math.min(max, c2))
    ];
  }

  private generateId(): string {
    return `ind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Polynomial Mutation
 */
class PolynomialMutation implements MutationOperator {
  name = 'Polynomial Mutation';
  private eta: number; // Distribution index

  constructor(eta: number = 20) {
    this.eta = eta;
  }

  mutate(individual: Individual, parameters: GAParameter[], mutationRate: number): Individual {
    const mutatedGenes = [...individual.genes];

    for (let i = 0; i < mutatedGenes.length; i++) {
      const param = parameters[i];
      const specificRate = param.mutationRate || mutationRate;

      if (Math.random() < specificRate) {
        if (param.type === 'real' || param.type === 'integer') {
          mutatedGenes[i] = this.mutateReal(
            mutatedGenes[i],
            param.min,
            param.max
          );
          
          if (param.type === 'integer') {
            mutatedGenes[i] = Math.round(mutatedGenes[i]);
          }
        } else if (param.type === 'binary') {
          mutatedGenes[i] = mutatedGenes[i] === 0 ? 1 : 0;
        } else if (param.type === 'categorical' && param.values) {
          mutatedGenes[i] = param.values[Math.floor(Math.random() * param.values.length)];
        }
      }
    }

    return {
      id: this.generateId(),
      genes: mutatedGenes,
      fitness: 0,
      objectives: [],
      age: 0,
      constraintViolation: 0
    };
  }

  private mutateReal(value: number, min: number, max: number): number {
    const delta1 = (value - min) / (max - min);
    const delta2 = (max - value) / (max - min);

    const u = Math.random();
    let deltaQ: number;

    if (u < 0.5) {
      const val = 2 * u + (1 - 2 * u) * Math.pow(1 - delta1, this.eta + 1);
      deltaQ = Math.pow(val, 1 / (this.eta + 1)) - 1;
    } else {
      const val = 2 * (1 - u) + 2 * (u - 0.5) * Math.pow(1 - delta2, this.eta + 1);
      deltaQ = 1 - Math.pow(val, 1 / (this.eta + 1));
    }

    const mutatedValue = value + deltaQ * (max - min);
    return Math.max(min, Math.min(max, mutatedValue));
  }

  private generateId(): string {
    return `mut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Genetic Algorithm configuration
 */
interface GAConfiguration {
  populationSize: number;
  maxGenerations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismRate: number;
  
  // Selection and operators
  selectionStrategy: SelectionStrategy;
  crossoverOperator: CrossoverOperator;
  mutationOperator: MutationOperator;
  
  // Multi-objective settings
  isMultiObjective: boolean;
  objectives: Objective[];
  
  // Convergence and diversity
  convergenceThreshold: number;
  diversityWeight: number;
  maxStagnation: number;      // Generations without improvement
  
  // Adaptive parameters
  adaptiveMutation: boolean;
  adaptiveCrossover: boolean;
  
  // Constraint handling
  penaltyWeight: number;
  constraintTolerance: number;
}

/**
 * Main Genetic Algorithm class
 */
export class GeneticAlgorithm extends EventEmitter {
  private config: GAConfiguration;
  private parameters: GAParameter[];
  private population: Individual[] = [];
  private generation = 0;
  private bestIndividual: Individual | null = null;
  private stagnationCount = 0;
  private diversityHistory: number[] = [];
  private convergenceHistory: number[] = [];

  constructor(parameters: GAParameter[], config: Partial<GAConfiguration> = {}) {
    super();
    
    this.parameters = parameters;
    this.config = {
      populationSize: 100,
      maxGenerations: 200,
      crossoverRate: 0.8,
      mutationRate: 0.1,
      elitismRate: 0.1,
      
      selectionStrategy: new TournamentSelection(3),
      crossoverOperator: new SimulatedBinaryCrossover(20),
      mutationOperator: new PolynomialMutation(20),
      
      isMultiObjective: false,
      objectives: [],
      
      convergenceThreshold: 1e-6,
      diversityWeight: 0.1,
      maxStagnation: 20,
      
      adaptiveMutation: true,
      adaptiveCrossover: false,
      
      penaltyWeight: 1.0,
      constraintTolerance: 1e-6,
      
      ...config
    };
  }

  /**
   * Run the genetic algorithm
   */
  async optimize(
    evaluationFunction: (genes: number[]) => Promise<{ fitness: number; objectives?: number[]; constraints?: number[] }>
  ): Promise<{
    bestIndividual: Individual;
    population: Individual[];
    convergenceHistory: number[];
    diversityHistory: number[];
    generation: number;
  }> {
    this.emit('optimization_started', { config: this.config });
    
    // Initialize population
    this.initializePopulation();
    
    // Evaluate initial population
    await this.evaluatePopulation(evaluationFunction);
    
    this.generation = 0;
    this.stagnationCount = 0;
    
    while (this.generation < this.config.maxGenerations) {
      this.emit('generation_started', { generation: this.generation });
      
      // Track convergence and diversity
      const convergence = this.calculateConvergence();
      const diversity = this.calculateDiversity();
      
      this.convergenceHistory.push(convergence);
      this.diversityHistory.push(diversity);
      
      this.emit('generation_stats', {
        generation: this.generation,
        convergence,
        diversity,
        bestFitness: this.bestIndividual?.fitness,
        averageFitness: this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length
      });
      
      // Check for convergence
      if (convergence < this.config.convergenceThreshold || this.stagnationCount >= this.config.maxStagnation) {
        this.emit('converged', { 
          generation: this.generation,
          reason: convergence < this.config.convergenceThreshold ? 'threshold' : 'stagnation'
        });
        break;
      }
      
      // Evolve population
      await this.evolveGeneration(evaluationFunction);
      
      // Adaptive parameter control
      this.adaptParameters();
      
      this.generation++;
    }
    
    this.emit('optimization_completed', {
      bestIndividual: this.bestIndividual,
      finalGeneration: this.generation,
      convergenceHistory: this.convergenceHistory,
      diversityHistory: this.diversityHistory
    });
    
    return {
      bestIndividual: this.bestIndividual!,
      population: this.population,
      convergenceHistory: this.convergenceHistory,
      diversityHistory: this.diversityHistory,
      generation: this.generation
    };
  }

  /**
   * Get Pareto front for multi-objective optimization
   */
  getParetoFront(): Individual[] {
    if (!this.config.isMultiObjective) {
      return this.bestIndividual ? [this.bestIndividual] : [];
    }
    
    const selection = new NSGAIISelection();
    const fronts = selection['nonDominatedSort'](this.population);
    return fronts[0] || [];
  }

  private initializePopulation(): void {
    this.population = [];
    
    for (let i = 0; i < this.config.populationSize; i++) {
      const genes = this.parameters.map(param => {
        switch (param.type) {
          case 'real':
            return Math.random() * (param.max - param.min) + param.min;
          case 'integer':
            return Math.floor(Math.random() * (param.max - param.min + 1)) + param.min;
          case 'binary':
            return Math.random() < 0.5 ? 0 : 1;
          case 'categorical':
            return param.values ? param.values[Math.floor(Math.random() * param.values.length)] : 0;
          default:
            return 0;
        }
      });
      
      this.population.push({
        id: this.generateId(),
        genes,
        fitness: 0,
        objectives: [],
        age: 0,
        constraintViolation: 0
      });
    }
    
    this.emit('population_initialized', { size: this.population.length });
  }

  private async evaluatePopulation(evaluationFunction: (genes: number[]) => Promise<any>): Promise<void> {
    const evaluationPromises = this.population.map(async (individual, index) => {
      if (individual.fitness !== 0) return; // Already evaluated
      
      try {
        const result = await evaluationFunction(individual.genes);
        
        individual.fitness = result.fitness;
        individual.objectives = result.objectives || [result.fitness];
        
        // Handle constraints
        if (result.constraints) {
          individual.constraintViolation = result.constraints
            .map(c => Math.max(0, c))
            .reduce((sum, v) => sum + v, 0);
          
          // Apply penalty to fitness
          individual.fitness -= this.config.penaltyWeight * individual.constraintViolation;
        }
        
        // Update best individual
        if (!this.bestIndividual || individual.fitness > this.bestIndividual.fitness) {
          this.bestIndividual = { ...individual };
          this.stagnationCount = 0;
        }
        
        this.emit('individual_evaluated', {
          index,
          fitness: individual.fitness,
          objectives: individual.objectives,
          constraintViolation: individual.constraintViolation
        });
        
      } catch (error) {
        individual.fitness = -Infinity;
        individual.constraintViolation = Infinity;
        
        this.emit('evaluation_error', {
          index,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    await Promise.all(evaluationPromises);
  }

  private async evolveGeneration(evaluationFunction: (genes: number[]) => Promise<any>): Promise<void> {
    // Selection
    const parents = this.config.selectionStrategy.select(this.population, 1.0);
    
    // Create offspring
    const offspring: Individual[] = [];
    
    for (let i = 0; i < parents.length; i += 2) {
      const parent1 = parents[i];
      const parent2 = parents[i + 1] || parents[0];
      
      if (Math.random() < this.config.crossoverRate) {
        const children = this.config.crossoverOperator.crossover(parent1, parent2, this.parameters);
        offspring.push(...children);
      } else {
        offspring.push({ ...parent1, id: this.generateId() }, { ...parent2, id: this.generateId() });
      }
    }
    
    // Mutation
    for (let i = 0; i < offspring.length; i++) {
      if (Math.random() < this.config.mutationRate) {
        offspring[i] = this.config.mutationOperator.mutate(offspring[i], this.parameters, this.config.mutationRate);
      }
    }
    
    // Age population
    this.population.forEach(ind => ind.age++);
    offspring.forEach(ind => ind.age = 0);
    
    // Evaluate offspring
    await this.evaluatePopulation(evaluationFunction);
    
    // Replacement
    const combined = [...this.population, ...offspring];
    
    if (this.config.isMultiObjective) {
      // Multi-objective selection
      this.population = this.config.selectionStrategy.select(combined, 1.0).slice(0, this.config.populationSize);
    } else {
      // Single-objective selection with elitism
      combined.sort((a, b) => b.fitness - a.fitness);
      
      const eliteCount = Math.floor(this.config.elitismRate * this.config.populationSize);
      const elite = combined.slice(0, eliteCount);
      const rest = this.config.selectionStrategy.select(
        combined.slice(eliteCount),
        1.0
      ).slice(0, this.config.populationSize - eliteCount);
      
      this.population = [...elite, ...rest];
    }
  }

  private calculateConvergence(): number {
    if (this.population.length === 0) return 1.0;
    
    const fitnessValues = this.population.map(ind => ind.fitness);
    const mean = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const variance = fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnessValues.length;
    
    return Math.sqrt(variance);
  }

  private calculateDiversity(): number {
    if (this.population.length === 0) return 1.0;
    
    let totalDistance = 0;
    let pairCount = 0;
    
    for (let i = 0; i < this.population.length; i++) {
      for (let j = i + 1; j < this.population.length; j++) {
        const distance = this.calculateEuclideanDistance(
          this.population[i].genes,
          this.population[j].genes
        );
        totalDistance += distance;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalDistance / pairCount : 0;
  }

  private calculateEuclideanDistance(genes1: number[], genes2: number[]): number {
    return Math.sqrt(
      genes1.reduce((sum, gene, i) => {
        return sum + Math.pow(gene - genes2[i], 2);
      }, 0)
    );
  }

  private adaptParameters(): void {
    if (this.config.adaptiveMutation) {
      // Increase mutation rate if diversity is low
      const currentDiversity = this.diversityHistory[this.diversityHistory.length - 1] || 1;
      const averageDiversity = this.diversityHistory.length > 10 ?
        this.diversityHistory.slice(-10).reduce((sum, d) => sum + d, 0) / 10 : currentDiversity;
      
      if (currentDiversity < averageDiversity * 0.5) {
        this.config.mutationRate = Math.min(0.3, this.config.mutationRate * 1.1);
      } else {
        this.config.mutationRate = Math.max(0.01, this.config.mutationRate * 0.95);
      }
    }
    
    // Track stagnation
    if (this.convergenceHistory.length > 5) {
      const recentImprovement = this.convergenceHistory.slice(-5).some((conv, i, arr) => 
        i > 0 && conv < arr[i - 1] - this.config.convergenceThreshold
      );
      
      if (!recentImprovement) {
        this.stagnationCount++;
      } else {
        this.stagnationCount = 0;
      }
    }
  }

  private generateId(): string {
    return `ga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export type {
  Individual,
  GAParameter,
  Objective,
  SelectionStrategy,
  CrossoverOperator,
  MutationOperator,
  GAConfiguration
};

export {
  TournamentSelection,
  RouletteWheelSelection,
  NSGAIISelection,
  SimulatedBinaryCrossover,
  PolynomialMutation
};