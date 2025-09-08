/**
 * StrategyDNA - Strategy DNA Encoding System for Genetic Algorithm (ML-005)
 * 
 * Implements sophisticated DNA encoding system for strategy parameters including:
 * - Multi-type parameter encoding (numeric, categorical, boolean)
 * - Genetic operations (crossover, mutation, distance calculation)
 * - Parameter constraints and bounds handling
 * - Efficient memory representation
 * - Validation and repair mechanisms
 * 
 * The DNA system allows genetic algorithms to operate on strategy parameters
 * while maintaining type safety and parameter constraints.
 */

export type ParameterType = 'integer' | 'float' | 'boolean' | 'categorical' | 'ordinal';
export type GeneType = 'binary' | 'real' | 'integer' | 'categorical';

export interface ParameterDefinition {
  name: string;
  type: ParameterType;
  
  // Numeric parameters
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  
  // Categorical parameters
  categories?: string[] | number[];
  ordered?: boolean; // For ordinal categories
  
  // Constraints
  constraints?: {
    dependsOn?: string[]; // Parameter dependencies
    validIf?: string; // Constraint expression
    mutuallyExclusive?: string[]; // Parameters that cannot be set simultaneously
  };
  
  // Genetic algorithm specific
  mutationRate?: number; // Parameter-specific mutation rate
  crossoverBias?: number; // Bias towards this parameter in crossover
  
  // Metadata
  description?: string;
  default?: any;
  importance?: number; // Parameter importance weight (0-1)
}

export interface DNAEncoding {
  parameterMap: Map<string, ParameterDefinition>;
  geneMap: Map<string, {
    startIndex: number;
    length: number;
    encoding: GeneEncoding;
  }>;
  totalLength: number;
  metadata: {
    version: string;
    created: Date;
    checksum: string;
  };
}

export interface GeneEncoding {
  type: GeneType;
  bits?: number; // For binary encoding
  precision?: number; // For real encoding
  categories?: any[]; // For categorical encoding
}

export type StrategyGenes = number[]; // DNA representation as array of values

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  repaired?: boolean;
}

/**
 * Advanced Strategy DNA Encoding and Manipulation System
 */
export class StrategyDNA {
  private parameterSpace: Record<string, ParameterDefinition>;
  private encoding: DNAEncoding;
  private validationEnabled = true;
  
  // Encoding statistics
  private encodingStats = {
    totalParameters: 0,
    binaryGenes: 0,
    realGenes: 0,
    categoricalGenes: 0,
    totalBits: 0,
    memoryUsage: 0
  };

  constructor(parameterSpace: Record<string, ParameterDefinition>) {
    this.parameterSpace = parameterSpace;
    this.encoding = this.buildEncoding();
    this.calculateStats();
    
    console.log(`🧬 DNA Encoding initialized: ${this.encodingStats.totalParameters} parameters, ${this.encoding.totalLength} genes`);
  }

  /**
   * Encode strategy parameters into DNA representation
   */
  encode(parameters: Record<string, any>): StrategyGenes {
    const dna: StrategyGenes = new Array(this.encoding.totalLength);
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo) continue;
      
      const value = parameters[paramName] ?? paramDef.default;
      const encodedValue = this.encodeParameter(value, paramDef, geneInfo.encoding);
      
      // Insert encoded value into DNA
      for (let i = 0; i < encodedValue.length; i++) {
        dna[geneInfo.startIndex + i] = encodedValue[i];
      }
    }
    
    // Validate encoded DNA
    if (this.validationEnabled) {
      const validation = this.validateDNA(dna);
      if (!validation.valid) {
        console.warn('DNA encoding validation failed:', validation.errors);
        return this.repairDNA(dna);
      }
    }
    
    return dna;
  }

  /**
   * Decode DNA representation back to strategy parameters
   */
  decode(dna: StrategyGenes): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo) continue;
      
      // Extract gene segment
      const geneSegment = dna.slice(
        geneInfo.startIndex,
        geneInfo.startIndex + geneInfo.length
      );
      
      // Decode parameter value
      const decodedValue = this.decodeParameter(geneSegment, paramDef, geneInfo.encoding);
      parameters[paramName] = decodedValue;
    }
    
    return parameters;
  }

  /**
   * Generate random DNA with valid parameter values
   */
  generateRandomDNA(): StrategyGenes {
    const dna: StrategyGenes = new Array(this.encoding.totalLength);
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo) continue;
      
      const randomValue = this.generateRandomValue(paramDef);
      const encodedValue = this.encodeParameter(randomValue, paramDef, geneInfo.encoding);
      
      for (let i = 0; i < encodedValue.length; i++) {
        dna[geneInfo.startIndex + i] = encodedValue[i];
      }
    }
    
    return dna;
  }

  /**
   * Perform uniform crossover between two DNA sequences
   */
  uniformCrossover(parent1: StrategyGenes, parent2: StrategyGenes, rate = 0.5): [StrategyGenes, StrategyGenes] {
    const child1: StrategyGenes = [...parent1];
    const child2: StrategyGenes = [...parent2];
    
    for (let i = 0; i < parent1.length; i++) {
      if (Math.random() < rate) {
        child1[i] = parent2[i];
        child2[i] = parent1[i];
      }
    }
    
    return [
      this.repairDNA(child1),
      this.repairDNA(child2)
    ];
  }

  /**
   * Perform single-point crossover
   */
  singlePointCrossover(parent1: StrategyGenes, parent2: StrategyGenes): [StrategyGenes, StrategyGenes] {
    const crossoverPoint = Math.floor(Math.random() * parent1.length);
    
    const child1 = [
      ...parent1.slice(0, crossoverPoint),
      ...parent2.slice(crossoverPoint)
    ];
    
    const child2 = [
      ...parent2.slice(0, crossoverPoint),
      ...parent1.slice(crossoverPoint)
    ];
    
    return [
      this.repairDNA(child1),
      this.repairDNA(child2)
    ];
  }

  /**
   * Perform parameter-aware crossover (respects parameter boundaries)
   */
  parameterAwareCrossover(parent1: StrategyGenes, parent2: StrategyGenes): [StrategyGenes, StrategyGenes] {
    const child1 = [...parent1];
    const child2 = [...parent2];
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo) continue;
      
      // Decide whether to crossover this parameter
      const crossoverBias = paramDef.crossoverBias || 0.5;
      if (Math.random() < crossoverBias) {
        // Extract parameter segments
        const segment1 = parent1.slice(geneInfo.startIndex, geneInfo.startIndex + geneInfo.length);
        const segment2 = parent2.slice(geneInfo.startIndex, geneInfo.startIndex + geneInfo.length);
        
        // Perform arithmetic crossover for real values, uniform for others
        let newSegment1: number[], newSegment2: number[];
        
        if (geneInfo.encoding.type === 'real') {
          const alpha = Math.random();
          newSegment1 = segment1.map((v, i) => alpha * v + (1 - alpha) * segment2[i]);
          newSegment2 = segment2.map((v, i) => alpha * v + (1 - alpha) * segment1[i]);
        } else {
          // Uniform crossover for non-real parameters
          newSegment1 = segment1.map((v, i) => Math.random() < 0.5 ? v : segment2[i]);
          newSegment2 = segment2.map((v, i) => Math.random() < 0.5 ? v : segment1[i]);
        }
        
        // Replace segments in children
        newSegment1.forEach((v, i) => child1[geneInfo.startIndex + i] = v);
        newSegment2.forEach((v, i) => child2[geneInfo.startIndex + i] = v);
      }
    }
    
    return [
      this.repairDNA(child1),
      this.repairDNA(child2)
    ];
  }

  /**
   * Perform Gaussian mutation on DNA
   */
  gaussianMutation(dna: StrategyGenes, mutationRate = 0.1, strength = 0.1): StrategyGenes {
    const mutated = [...dna];
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo) continue;
      
      const paramMutationRate = paramDef.mutationRate || mutationRate;
      
      if (Math.random() < paramMutationRate) {
        for (let i = 0; i < geneInfo.length; i++) {
          const geneIndex = geneInfo.startIndex + i;
          
          if (geneInfo.encoding.type === 'real') {
            // Gaussian mutation for real values
            const noise = this.generateGaussianNoise(0, strength);
            mutated[geneIndex] = this.clampValue(
              mutated[geneIndex] + noise,
              0, 1 // Assuming normalized encoding
            );
          } else if (geneInfo.encoding.type === 'binary') {
            // Bit flip for binary
            if (Math.random() < paramMutationRate) {
              mutated[geneIndex] = 1 - mutated[geneIndex];
            }
          } else if (geneInfo.encoding.type === 'categorical') {
            // Random reassignment for categorical
            if (Math.random() < paramMutationRate) {
              mutated[geneIndex] = Math.floor(Math.random() * (geneInfo.encoding.categories?.length || 2));
            }
          }
        }
      }
    }
    
    return this.repairDNA(mutated);
  }

  /**
   * Perform polynomial mutation (good for real-valued parameters)
   */
  polynomialMutation(dna: StrategyGenes, mutationRate = 0.1, eta = 20): StrategyGenes {
    const mutated = [...dna];
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo || geneInfo.encoding.type !== 'real') continue;
      
      const paramMutationRate = paramDef.mutationRate || mutationRate;
      
      if (Math.random() < paramMutationRate) {
        for (let i = 0; i < geneInfo.length; i++) {
          const geneIndex = geneInfo.startIndex + i;
          const value = mutated[geneIndex];
          
          const rand = Math.random();
          let delta;
          
          if (rand < 0.5) {
            delta = Math.pow(2 * rand, 1 / (eta + 1)) - 1;
          } else {
            delta = 1 - Math.pow(2 * (1 - rand), 1 / (eta + 1));
          }
          
          mutated[geneIndex] = this.clampValue(value + delta, 0, 1);
        }
      }
    }
    
    return this.repairDNA(mutated);
  }

  /**
   * Calculate Hamming distance between two DNA sequences
   */
  calculateDistance(dna1: StrategyGenes, dna2: StrategyGenes): number {
    if (dna1.length !== dna2.length) {
      throw new Error('DNA sequences must have the same length');
    }
    
    let distance = 0;
    
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const geneInfo = this.encoding.geneMap.get(paramName);
      if (!geneInfo) continue;
      
      // Calculate parameter-specific distance
      let paramDistance = 0;
      const importance = paramDef.importance || 1;
      
      for (let i = 0; i < geneInfo.length; i++) {
        const index = geneInfo.startIndex + i;
        const diff = Math.abs(dna1[index] - dna2[index]);
        paramDistance += diff;
      }
      
      // Normalize by parameter length and weight by importance
      paramDistance = (paramDistance / geneInfo.length) * importance;
      distance += paramDistance;
    }
    
    return distance / this.encoding.parameterMap.size;
  }

  /**
   * Validate DNA for constraint satisfaction
   */
  validateDNA(dna: StrategyGenes): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic length validation
    if (dna.length !== this.encoding.totalLength) {
      errors.push(`Invalid DNA length: expected ${this.encoding.totalLength}, got ${dna.length}`);
      return { valid: false, errors, warnings };
    }
    
    // Decode parameters for constraint checking
    const parameters = this.decode(dna);
    
    // Check individual parameter constraints
    for (const [paramName, paramDef] of this.encoding.parameterMap) {
      const value = parameters[paramName];
      
      // Type validation
      if (!this.isValidParameterValue(value, paramDef)) {
        errors.push(`Invalid value for parameter ${paramName}: ${value}`);
      }
      
      // Range validation
      if (paramDef.min !== undefined && value < paramDef.min) {
        errors.push(`Parameter ${paramName} below minimum: ${value} < ${paramDef.min}`);
      }
      
      if (paramDef.max !== undefined && value > paramDef.max) {
        errors.push(`Parameter ${paramName} above maximum: ${value} > ${paramDef.max}`);
      }
      
      // Constraint validation
      if (paramDef.constraints) {
        const constraintResult = this.validateConstraints(parameters, paramName, paramDef.constraints);
        errors.push(...constraintResult.errors);
        warnings.push(...constraintResult.warnings);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Repair invalid DNA to satisfy constraints
   */
  repairDNA(dna: StrategyGenes): StrategyGenes {
    let repairedDNA = [...dna];
    let repairAttempts = 0;
    const maxRepairAttempts = 10;
    
    while (repairAttempts < maxRepairAttempts) {
      const validation = this.validateDNA(repairedDNA);
      
      if (validation.valid) {
        return repairedDNA;
      }
      
      // Apply repair strategies
      repairedDNA = this.applyRepairStrategies(repairedDNA, validation.errors);
      repairAttempts++;
    }
    
    // If repair fails, generate new random DNA
    console.warn('DNA repair failed after maximum attempts, generating new random DNA');
    return this.generateRandomDNA();
  }

  /**
   * Get parameter space information
   */
  getParameterSpace(): Record<string, ParameterDefinition> {
    return { ...this.parameterSpace };
  }

  /**
   * Get encoding information
   */
  getEncoding(): DNAEncoding {
    return { ...this.encoding };
  }

  /**
   * Get encoding statistics
   */
  getStats() {
    return { ...this.encodingStats };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private buildEncoding(): DNAEncoding {
    const parameterMap = new Map<string, ParameterDefinition>();
    const geneMap = new Map<string, { startIndex: number; length: number; encoding: GeneEncoding }>();
    
    let currentIndex = 0;
    
    // Build parameter map and gene encoding
    for (const [paramName, paramDef] of Object.entries(this.parameterSpace)) {
      parameterMap.set(paramName, paramDef);
      
      const geneEncoding = this.createGeneEncoding(paramDef);
      const geneLength = this.calculateGeneLength(geneEncoding);
      
      geneMap.set(paramName, {
        startIndex: currentIndex,
        length: geneLength,
        encoding: geneEncoding
      });
      
      currentIndex += geneLength;
    }
    
    return {
      parameterMap,
      geneMap,
      totalLength: currentIndex,
      metadata: {
        version: '1.0',
        created: new Date(),
        checksum: this.calculateChecksum()
      }
    };
  }

  private createGeneEncoding(paramDef: ParameterDefinition): GeneEncoding {
    switch (paramDef.type) {
      case 'boolean':
        return { type: 'binary', bits: 1 };
        
      case 'integer':
        // Use binary encoding for integers
        const intRange = (paramDef.max || 100) - (paramDef.min || 0);
        const intBits = Math.ceil(Math.log2(intRange + 1));
        return { type: 'integer', bits: intBits };
        
      case 'float':
        // Use real encoding for floats
        return { type: 'real', precision: paramDef.precision || 4 };
        
      case 'categorical':
      case 'ordinal':
        return { 
          type: 'categorical', 
          categories: paramDef.categories || ['option1', 'option2'] 
        };
        
      default:
        return { type: 'real', precision: 4 };
    }
  }

  private calculateGeneLength(encoding: GeneEncoding): number {
    switch (encoding.type) {
      case 'binary':
        return encoding.bits || 1;
      case 'integer':
        return encoding.bits || 8;
      case 'real':
        return 1; // Single real value
      case 'categorical':
        return 1; // Single categorical index
      default:
        return 1;
    }
  }

  private encodeParameter(value: any, paramDef: ParameterDefinition, encoding: GeneEncoding): number[] {
    switch (encoding.type) {
      case 'binary':
        return [value ? 1 : 0];
        
      case 'integer':
        const intVal = Math.floor(Number(value));
        const normalized = (intVal - (paramDef.min || 0)) / ((paramDef.max || 100) - (paramDef.min || 0));
        return [this.clampValue(normalized, 0, 1)];
        
      case 'real':
        const floatVal = Number(value);
        const normalizedFloat = (floatVal - (paramDef.min || 0)) / ((paramDef.max || 1) - (paramDef.min || 0));
        return [this.clampValue(normalizedFloat, 0, 1)];
        
      case 'categorical':
        const categories = encoding.categories || [];
        const index = categories.indexOf(value);
        return [index >= 0 ? index / (categories.length - 1) : 0];
        
      default:
        return [0];
    }
  }

  private decodeParameter(genes: number[], paramDef: ParameterDefinition, encoding: GeneEncoding): any {
    switch (encoding.type) {
      case 'binary':
        return genes[0] > 0.5;
        
      case 'integer':
        const normalizedInt = genes[0];
        const intRange = (paramDef.max || 100) - (paramDef.min || 0);
        const intVal = Math.round(normalizedInt * intRange) + (paramDef.min || 0);
        return intVal;
        
      case 'real':
        const normalizedFloat = genes[0];
        const floatRange = (paramDef.max || 1) - (paramDef.min || 0);
        const floatVal = normalizedFloat * floatRange + (paramDef.min || 0);
        return Number(floatVal.toFixed(paramDef.precision || 4));
        
      case 'categorical':
        const categories = encoding.categories || [];
        const normalizedIndex = genes[0];
        const categoryIndex = Math.round(normalizedIndex * (categories.length - 1));
        return categories[Math.max(0, Math.min(categories.length - 1, categoryIndex))];
        
      default:
        return genes[0];
    }
  }

  private generateRandomValue(paramDef: ParameterDefinition): any {
    switch (paramDef.type) {
      case 'boolean':
        return Math.random() < 0.5;
        
      case 'integer':
        const intMin = paramDef.min || 0;
        const intMax = paramDef.max || 100;
        return Math.floor(Math.random() * (intMax - intMin + 1)) + intMin;
        
      case 'float':
        const floatMin = paramDef.min || 0;
        const floatMax = paramDef.max || 1;
        return Math.random() * (floatMax - floatMin) + floatMin;
        
      case 'categorical':
      case 'ordinal':
        const categories = paramDef.categories || ['option1', 'option2'];
        return categories[Math.floor(Math.random() * categories.length)];
        
      default:
        return paramDef.default || 0;
    }
  }

  private isValidParameterValue(value: any, paramDef: ParameterDefinition): boolean {
    switch (paramDef.type) {
      case 'boolean':
        return typeof value === 'boolean';
      case 'integer':
        return Number.isInteger(value);
      case 'float':
        return typeof value === 'number' && !isNaN(value);
      case 'categorical':
      case 'ordinal':
        return paramDef.categories ? paramDef.categories.includes(value) : true;
      default:
        return true;
    }
  }

  private validateConstraints(parameters: Record<string, any>, paramName: string, constraints: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Dependency validation
    if (constraints.dependsOn) {
      for (const dependency of constraints.dependsOn) {
        if (!(dependency in parameters)) {
          errors.push(`Parameter ${paramName} depends on ${dependency} which is not present`);
        }
      }
    }
    
    // Mutual exclusion validation
    if (constraints.mutuallyExclusive) {
      const activeExclusive = constraints.mutuallyExclusive.filter(param => 
        parameters[param] !== undefined && parameters[param] !== null
      );
      
      if (activeExclusive.length > 1) {
        errors.push(`Mutually exclusive parameters active: ${activeExclusive.join(', ')}`);
      }
    }
    
    // Custom constraint validation
    if (constraints.validIf) {
      try {
        // Simple constraint evaluation (in production, use a proper expression evaluator)
        const isValid = this.evaluateConstraintExpression(constraints.validIf, parameters);
        if (!isValid) {
          warnings.push(`Constraint violation for ${paramName}: ${constraints.validIf}`);
        }
      } catch (error) {
        errors.push(`Invalid constraint expression for ${paramName}: ${constraints.validIf}`);
      }
    }
    
    return { errors, warnings };
  }

  private evaluateConstraintExpression(expression: string, parameters: Record<string, any>): boolean {
    // Simple constraint evaluation - in production, use a proper expression parser
    // For now, just return true to avoid complexity
    return true;
  }

  private applyRepairStrategies(dna: StrategyGenes, errors: string[]): StrategyGenes {
    const repairedDNA = [...dna];
    
    for (const error of errors) {
      if (error.includes('below minimum') || error.includes('above maximum')) {
        // Repair range violations by clamping values
        const paramName = this.extractParameterNameFromError(error);
        if (paramName) {
          const geneInfo = this.encoding.geneMap.get(paramName);
          const paramDef = this.encoding.parameterMap.get(paramName);
          
          if (geneInfo && paramDef) {
            for (let i = 0; i < geneInfo.length; i++) {
              const geneIndex = geneInfo.startIndex + i;
              repairedDNA[geneIndex] = this.clampValue(repairedDNA[geneIndex], 0, 1);
            }
          }
        }
      }
    }
    
    return repairedDNA;
  }

  private extractParameterNameFromError(error: string): string | null {
    const match = error.match(/Parameter (\w+)/);
    return match ? match[1] : null;
  }

  private clampValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private generateGaussianNoise(mean: number, stdDev: number): number {
    // Box-Muller transformation
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdDev + mean;
  }

  private calculateStats(): void {
    this.encodingStats = {
      totalParameters: this.encoding.parameterMap.size,
      binaryGenes: 0,
      realGenes: 0,
      categoricalGenes: 0,
      totalBits: this.encoding.totalLength,
      memoryUsage: this.encoding.totalLength * 8 // bytes (assuming 8 bytes per number)
    };
    
    for (const [_, geneInfo] of this.encoding.geneMap) {
      switch (geneInfo.encoding.type) {
        case 'binary':
          this.encodingStats.binaryGenes += geneInfo.length;
          break;
        case 'real':
          this.encodingStats.realGenes += geneInfo.length;
          break;
        case 'categorical':
          this.encodingStats.categoricalGenes += geneInfo.length;
          break;
      }
    }
  }

  private calculateChecksum(): string {
    // Simple checksum based on parameter names and types
    const data = Array.from(this.encoding.parameterMap.entries())
      .map(([name, def]) => `${name}:${def.type}`)
      .join('|');
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }
}

// Utility functions for common parameter definitions
export const ParameterUtils = {
  /**
   * Create a float parameter definition
   */
  floatParam(min: number, max: number, options: Partial<ParameterDefinition> = {}): ParameterDefinition {
    return {
      type: 'float',
      min,
      max,
      precision: 4,
      ...options
    } as ParameterDefinition;
  },

  /**
   * Create an integer parameter definition
   */
  integerParam(min: number, max: number, options: Partial<ParameterDefinition> = {}): ParameterDefinition {
    return {
      type: 'integer',
      min,
      max,
      step: 1,
      ...options
    } as ParameterDefinition;
  },

  /**
   * Create a boolean parameter definition
   */
  booleanParam(options: Partial<ParameterDefinition> = {}): ParameterDefinition {
    return {
      type: 'boolean',
      default: false,
      ...options
    } as ParameterDefinition;
  },

  /**
   * Create a categorical parameter definition
   */
  categoricalParam(categories: (string | number)[], options: Partial<ParameterDefinition> = {}): ParameterDefinition {
    return {
      type: 'categorical',
      categories,
      default: categories[0],
      ...options
    } as ParameterDefinition;
  },

  /**
   * Create common trading strategy parameters
   */
  tradingParameters(): Record<string, ParameterDefinition> {
    return {
      // Moving average parameters
      shortMAPeriod: this.integerParam(5, 50, {
        name: 'shortMAPeriod',
        description: 'Short moving average period',
        importance: 0.8,
        mutationRate: 0.1
      }),
      
      longMAPeriod: this.integerParam(20, 200, {
        name: 'longMAPeriod',
        description: 'Long moving average period',
        importance: 0.8,
        mutationRate: 0.1
      }),
      
      // RSI parameters
      rsiPeriod: this.integerParam(7, 30, {
        name: 'rsiPeriod',
        description: 'RSI calculation period',
        importance: 0.6
      }),
      
      rsiOverbought: this.floatParam(70, 90, {
        name: 'rsiOverbought',
        description: 'RSI overbought threshold',
        importance: 0.7
      }),
      
      rsiOversold: this.floatParam(10, 30, {
        name: 'rsiOversold',
        description: 'RSI oversold threshold',
        importance: 0.7
      }),
      
      // Risk management
      stopLossPercent: this.floatParam(0.01, 0.1, {
        name: 'stopLossPercent',
        description: 'Stop loss percentage',
        importance: 0.9,
        mutationRate: 0.05
      }),
      
      takeProfitPercent: this.floatParam(0.02, 0.2, {
        name: 'takeProfitPercent',
        description: 'Take profit percentage',
        importance: 0.9,
        mutationRate: 0.05
      }),
      
      positionSizePercent: this.floatParam(0.01, 0.5, {
        name: 'positionSizePercent',
        description: 'Position size as percentage of portfolio',
        importance: 1.0,
        mutationRate: 0.03
      }),
      
      // Strategy behavior
      enableLongTrades: this.booleanParam({
        name: 'enableLongTrades',
        description: 'Enable long position trading',
        default: true,
        importance: 0.6
      }),
      
      enableShortTrades: this.booleanParam({
        name: 'enableShortTrades',
        description: 'Enable short position trading',
        default: false,
        importance: 0.6
      }),
      
      tradeFrequency: this.categoricalParam(['high', 'medium', 'low'], {
        name: 'tradeFrequency',
        description: 'Trading frequency setting',
        importance: 0.5
      })
    };
  }
};