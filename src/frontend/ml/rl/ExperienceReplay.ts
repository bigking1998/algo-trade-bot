/**
 * ExperienceReplay - Advanced Experience Replay Buffer for RL Training
 * 
 * Implements prioritized experience replay with importance sampling,
 * diverse sampling strategies, and memory optimization for trading RL agents.
 */

import * as tf from '@tensorflow/tfjs';
import { EnvironmentState, Action } from './TradingEnvironment';

export type SamplingStrategy = 'UNIFORM' | 'PRIORITIZED' | 'TEMPORAL' | 'DIVERSITY' | 'CURIOSITY';

export interface Experience {
  state: EnvironmentState;
  action: Action;
  reward: number;
  nextState: EnvironmentState;
  done: boolean;
  
  // Additional metadata
  timestamp: Date;
  episodeId: string;
  stepInEpisode: number;
  
  // For prioritized replay
  priority: number;
  tdError: number;
  
  // For diversity sampling
  stateSignature: string;
  actionFrequency: number;
  
  // For curiosity-driven sampling
  novelty: number;
  predictionError: number;
}

export interface ReplayConfig {
  maxSize: number; // Maximum buffer size
  minSize: number; // Minimum size before sampling
  batchSize: number; // Batch size for training
  
  // Sampling strategy
  strategy: SamplingStrategy;
  
  // Prioritized replay parameters
  alpha: number; // Prioritization exponent (0 = uniform, 1 = fully prioritized)
  beta: number; // Importance sampling exponent (0 = no correction, 1 = full correction)
  betaSchedule: 'constant' | 'linear' | 'exponential';
  betaStart: number;
  betaEnd: number;
  priorityEpsilon: number; // Small constant to prevent zero priorities
  
  // Temporal sampling parameters
  recentWeight: number; // Weight for recent experiences
  temporalDecay: number; // Decay rate for temporal importance
  
  // Diversity parameters
  diversityWeight: number; // Weight for state diversity
  maxDuplicates: number; // Maximum duplicate states per batch
  
  // Memory management
  compressionEnabled: boolean;
  compressionThreshold: number; // Compress when buffer is this full (0-1)
  evictionStrategy: 'fifo' | 'lru' | 'priority_based';
  
  // Performance optimization
  enableParallelSampling: boolean;
  precomputeStates: boolean; // Pre-compute state tensors for speed
}

export interface SamplingResult {
  experiences: Experience[];
  indices: number[];
  weights: Float32Array; // Importance sampling weights
  metadata: {
    averagePriority: number;
    diversityScore: number;
    temporalSpread: number;
    samplingTime: number;
  };
}

export interface BufferStatistics {
  size: number;
  capacity: number;
  utilization: number;
  
  // Priority distribution
  averagePriority: number;
  priorityVariance: number;
  priorityRange: [number, number];
  
  // Temporal distribution
  oldestTimestamp: Date;
  newestTimestamp: Date;
  averageAge: number; // in steps
  
  // Diversity metrics
  uniqueStates: number;
  stateDistribution: Record<string, number>;
  actionDistribution: Record<string, number>;
  
  // Performance metrics
  samplingLatency: number;
  compressionRatio: number;
  memoryUsage: number; // in bytes
}

/**
 * Segment Tree for efficient priority sampling
 */
class SegmentTree {
  private tree: Float32Array;
  private capacity: number;
  private size: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.tree = new Float32Array(2 * capacity);
  }

  private propagate(index: number, change: number): void {
    const parent = Math.floor((index - 1) / 2);
    this.tree[parent] += change;
    if (parent !== 0) {
      this.propagate(parent, change);
    }
  }

  update(index: number, priority: number): void {
    const treeIndex = index + this.capacity - 1;
    const change = priority - this.tree[treeIndex];
    this.tree[treeIndex] = priority;
    this.propagate(treeIndex, change);
  }

  get(index: number): number {
    return this.tree[index + this.capacity - 1];
  }

  getSum(): number {
    return this.tree[0];
  }

  sample(value: number): number {
    return this.retrieve(0, value);
  }

  private retrieve(index: number, value: number): number {
    const left = 2 * index + 1;
    const right = left + 1;

    if (left >= this.tree.length) {
      return index - this.capacity + 1;
    }

    if (value <= this.tree[left]) {
      return this.retrieve(left, value);
    } else {
      return this.retrieve(right, value - this.tree[left]);
    }
  }

  add(priority: number): void {
    this.update(this.size, priority);
    this.size = Math.min(this.size + 1, this.capacity);
  }
}

export class ExperienceReplay {
  private config: ReplayConfig;
  private buffer: Experience[] = [];
  private currentIndex: number = 0;
  private totalExperiences: number = 0;
  
  // Priority sampling components
  private priorityTree: SegmentTree;
  private maxPriority: number = 1.0;
  
  // State encoding for diversity
  private stateEncoder: Map<string, number> = new Map();
  private stateSignatures: Set<string> = new Set();
  
  // Performance tracking
  private samplingTimes: number[] = [];
  private compressionStats = { originalSize: 0, compressedSize: 0 };
  
  // Pre-computed tensors for performance
  private precomputedStates: tf.Tensor[] = [];
  private precomputedActions: tf.Tensor[] = [];
  
  // Beta scheduling for importance sampling
  private currentBeta: number;
  private betaStep: number = 0;

  constructor(config: ReplayConfig) {
    this.config = config;
    this.priorityTree = new SegmentTree(config.maxSize);
    this.currentBeta = config.betaStart;
    
    this.buffer = new Array(config.maxSize);
    
    console.log(`🧠 Experience Replay buffer initialized: ${config.maxSize} capacity, ${config.strategy} sampling`);
  }

  /**
   * Add experience to the buffer
   */
  add(experience: Experience): void {
    // Calculate priority based on strategy
    const priority = this.calculatePriority(experience);
    experience.priority = priority;
    
    // Generate state signature for diversity
    experience.stateSignature = this.generateStateSignature(experience.state);
    
    // Calculate novelty for curiosity-driven sampling
    experience.novelty = this.calculateNovelty(experience);
    
    // Add to buffer using circular buffer
    const index = this.currentIndex % this.config.maxSize;
    
    // Remove old experience if buffer is full
    if (this.buffer[index]) {
      this.removeStateSignature(this.buffer[index].stateSignature);
    }
    
    this.buffer[index] = experience;
    this.stateSignatures.add(experience.stateSignature);
    
    // Update priority tree
    this.priorityTree.update(index, priority);
    this.maxPriority = Math.max(this.maxPriority, priority);
    
    // Update counters
    this.currentIndex++;
    this.totalExperiences++;
    
    // Precompute tensors if enabled
    if (this.config.precomputeStates) {
      this.precomputeTensors(index, experience);
    }
    
    // Check if compression is needed
    if (this.shouldCompress()) {
      this.compressBuffer();
    }
  }

  /**
   * Sample batch of experiences
   */
  sample(): SamplingResult | null {
    if (this.size() < this.config.minSize) {
      return null;
    }
    
    const startTime = performance.now();
    
    const result = this.performSampling();
    
    const samplingTime = performance.now() - startTime;
    this.samplingTimes.push(samplingTime);
    if (this.samplingTimes.length > 100) {
      this.samplingTimes = this.samplingTimes.slice(-50);
    }
    
    // Update beta for importance sampling
    this.updateBeta();
    
    return result;
  }

  /**
   * Update priorities based on TD errors
   */
  updatePriorities(indices: number[], tdErrors: number[]): void {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const tdError = Math.abs(tdErrors[i]);
      
      const priority = Math.pow(tdError + this.config.priorityEpsilon, this.config.alpha);
      
      if (this.buffer[index]) {
        this.buffer[index].priority = priority;
        this.buffer[index].tdError = tdError;
      }
      
      this.priorityTree.update(index, priority);
      this.maxPriority = Math.max(this.maxPriority, priority);
    }
  }

  /**
   * Get buffer statistics
   */
  getStatistics(): BufferStatistics {
    const currentSize = this.size();
    const experiences = this.buffer.slice(0, currentSize).filter(exp => exp);
    
    // Priority statistics
    const priorities = experiences.map(exp => exp.priority);
    const averagePriority = priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
    const priorityVariance = priorities.reduce((sum, p) => sum + (p - averagePriority) ** 2, 0) / priorities.length;
    
    // Temporal statistics
    const timestamps = experiences.map(exp => exp.timestamp.getTime());
    const oldestTimestamp = new Date(Math.min(...timestamps));
    const newestTimestamp = new Date(Math.max(...timestamps));
    const averageAge = (Date.now() - timestamps.reduce((sum, t) => sum + t, 0) / timestamps.length) / 1000;
    
    // Diversity statistics
    const stateDistribution: Record<string, number> = {};
    const actionDistribution: Record<string, number> = {};
    
    experiences.forEach(exp => {
      stateDistribution[exp.stateSignature] = (stateDistribution[exp.stateSignature] || 0) + 1;
      actionDistribution[exp.action.type] = (actionDistribution[exp.action.type] || 0) + 1;
    });
    
    return {
      size: currentSize,
      capacity: this.config.maxSize,
      utilization: currentSize / this.config.maxSize,
      averagePriority,
      priorityVariance,
      priorityRange: [Math.min(...priorities), Math.max(...priorities)],
      oldestTimestamp,
      newestTimestamp,
      averageAge,
      uniqueStates: this.stateSignatures.size,
      stateDistribution,
      actionDistribution,
      samplingLatency: this.samplingTimes.reduce((sum, t) => sum + t, 0) / this.samplingTimes.length,
      compressionRatio: this.compressionStats.originalSize > 0 ? 
        this.compressionStats.compressedSize / this.compressionStats.originalSize : 1.0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer.fill(undefined as any);
    this.currentIndex = 0;
    this.totalExperiences = 0;
    this.stateSignatures.clear();
    this.stateEncoder.clear();
    this.maxPriority = 1.0;
    this.priorityTree = new SegmentTree(this.config.maxSize);
    
    // Dispose precomputed tensors
    this.precomputedStates.forEach(tensor => tensor.dispose());
    this.precomputedActions.forEach(tensor => tensor.dispose());
    this.precomputedStates = [];
    this.precomputedActions = [];
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return Math.min(this.currentIndex, this.config.maxSize);
  }

  /**
   * Check if buffer has enough experiences for sampling
   */
  canSample(): boolean {
    return this.size() >= this.config.minSize;
  }

  /**
   * Get specific experience by index
   */
  get(index: number): Experience | null {
    if (index < 0 || index >= this.size()) {
      return null;
    }
    return this.buffer[index] || null;
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private performSampling(): SamplingResult {
    switch (this.config.strategy) {
      case 'UNIFORM':
        return this.uniformSampling();
      case 'PRIORITIZED':
        return this.prioritizedSampling();
      case 'TEMPORAL':
        return this.temporalSampling();
      case 'DIVERSITY':
        return this.diversitySampling();
      case 'CURIOSITY':
        return this.curiositySampling();
      default:
        return this.uniformSampling();
    }
  }

  private uniformSampling(): SamplingResult {
    const indices: number[] = [];
    const experiences: Experience[] = [];
    const weights = new Float32Array(this.config.batchSize).fill(1.0);
    
    const currentSize = this.size();
    
    for (let i = 0; i < this.config.batchSize; i++) {
      let index;
      do {
        index = Math.floor(Math.random() * currentSize);
      } while (indices.includes(index));
      
      indices.push(index);
      experiences.push(this.buffer[index]);
    }
    
    return {
      experiences,
      indices,
      weights,
      metadata: {
        averagePriority: 0,
        diversityScore: this.calculateDiversityScore(experiences),
        temporalSpread: this.calculateTemporalSpread(experiences),
        samplingTime: 0
      }
    };
  }

  private prioritizedSampling(): SamplingResult {
    const indices: number[] = [];
    const experiences: Experience[] = [];
    const weights: number[] = [];
    
    const totalSum = this.priorityTree.getSum();
    const segmentSize = totalSum / this.config.batchSize;
    
    for (let i = 0; i < this.config.batchSize; i++) {
      const value = Math.random() * segmentSize + i * segmentSize;
      const index = this.priorityTree.sample(value);
      
      if (index < this.size() && this.buffer[index]) {
        indices.push(index);
        experiences.push(this.buffer[index]);
        
        // Calculate importance sampling weight
        const priority = this.priorityTree.get(index);
        const samplingProb = priority / totalSum;
        const weight = Math.pow(1 / (this.size() * samplingProb), this.currentBeta);
        weights.push(weight);
      }
    }
    
    // Normalize weights
    const maxWeight = Math.max(...weights);
    const normalizedWeights = new Float32Array(weights.map(w => w / maxWeight));
    
    return {
      experiences,
      indices,
      weights: normalizedWeights,
      metadata: {
        averagePriority: experiences.reduce((sum, exp) => sum + exp.priority, 0) / experiences.length,
        diversityScore: this.calculateDiversityScore(experiences),
        temporalSpread: this.calculateTemporalSpread(experiences),
        samplingTime: 0
      }
    };
  }

  private temporalSampling(): SamplingResult {
    const currentSize = this.size();
    const experiences = this.buffer.slice(0, currentSize).filter(exp => exp);
    
    // Calculate temporal weights
    const now = Date.now();
    const temporalWeights = experiences.map(exp => {
      const age = (now - exp.timestamp.getTime()) / (1000 * 60 * 60); // Hours
      return Math.exp(-age * this.config.temporalDecay) * this.config.recentWeight;
    });
    
    // Weighted sampling
    const totalWeight = temporalWeights.reduce((sum, w) => sum + w, 0);
    const indices: number[] = [];
    const sampledExperiences: Experience[] = [];
    
    for (let i = 0; i < this.config.batchSize; i++) {
      let randomValue = Math.random() * totalWeight;
      let selectedIndex = 0;
      
      for (let j = 0; j < temporalWeights.length; j++) {
        randomValue -= temporalWeights[j];
        if (randomValue <= 0) {
          selectedIndex = j;
          break;
        }
      }
      
      if (!indices.includes(selectedIndex)) {
        indices.push(selectedIndex);
        sampledExperiences.push(experiences[selectedIndex]);
      }
    }
    
    const weights = new Float32Array(this.config.batchSize).fill(1.0);
    
    return {
      experiences: sampledExperiences,
      indices,
      weights,
      metadata: {
        averagePriority: 0,
        diversityScore: this.calculateDiversityScore(sampledExperiences),
        temporalSpread: this.calculateTemporalSpread(sampledExperiences),
        samplingTime: 0
      }
    };
  }

  private diversitySampling(): SamplingResult {
    const currentSize = this.size();
    const experiences = this.buffer.slice(0, currentSize).filter(exp => exp);
    
    const indices: number[] = [];
    const sampledExperiences: Experience[] = [];
    const seenSignatures = new Set<string>();
    
    // First, sample diverse states
    const shuffled = [...Array(experiences.length).keys()].sort(() => Math.random() - 0.5);
    
    for (const index of shuffled) {
      const exp = experiences[index];
      if (sampledExperiences.length >= this.config.batchSize) break;
      
      const duplicateCount = Array.from(seenSignatures).filter(sig => sig === exp.stateSignature).length;
      if (duplicateCount < this.config.maxDuplicates) {
        indices.push(index);
        sampledExperiences.push(exp);
        seenSignatures.add(exp.stateSignature);
      }
    }
    
    // Fill remaining slots with random sampling if needed
    while (sampledExperiences.length < this.config.batchSize) {
      const randomIndex = Math.floor(Math.random() * experiences.length);
      if (!indices.includes(randomIndex)) {
        indices.push(randomIndex);
        sampledExperiences.push(experiences[randomIndex]);
      }
    }
    
    const weights = new Float32Array(this.config.batchSize).fill(1.0);
    
    return {
      experiences: sampledExperiences,
      indices,
      weights,
      metadata: {
        averagePriority: 0,
        diversityScore: this.calculateDiversityScore(sampledExperiences),
        temporalSpread: this.calculateTemporalSpread(sampledExperiences),
        samplingTime: 0
      }
    };
  }

  private curiositySampling(): SamplingResult {
    const currentSize = this.size();
    const experiences = this.buffer.slice(0, currentSize).filter(exp => exp);
    
    // Sample based on novelty/curiosity scores
    const noveltyWeights = experiences.map(exp => exp.novelty || 0);
    const totalWeight = noveltyWeights.reduce((sum, w) => sum + w, 0);
    
    if (totalWeight === 0) {
      return this.uniformSampling(); // Fallback to uniform if no novelty scores
    }
    
    const indices: number[] = [];
    const sampledExperiences: Experience[] = [];
    
    for (let i = 0; i < this.config.batchSize; i++) {
      let randomValue = Math.random() * totalWeight;
      let selectedIndex = 0;
      
      for (let j = 0; j < noveltyWeights.length; j++) {
        randomValue -= noveltyWeights[j];
        if (randomValue <= 0) {
          selectedIndex = j;
          break;
        }
      }
      
      if (!indices.includes(selectedIndex)) {
        indices.push(selectedIndex);
        sampledExperiences.push(experiences[selectedIndex]);
      }
    }
    
    const weights = new Float32Array(this.config.batchSize).fill(1.0);
    
    return {
      experiences: sampledExperiences,
      indices,
      weights,
      metadata: {
        averagePriority: 0,
        diversityScore: this.calculateDiversityScore(sampledExperiences),
        temporalSpread: this.calculateTemporalSpread(sampledExperiences),
        samplingTime: 0
      }
    };
  }

  private calculatePriority(experience: Experience): number {
    // Base priority on TD error if available, otherwise use reward magnitude
    if (experience.tdError !== undefined) {
      return Math.pow(Math.abs(experience.tdError) + this.config.priorityEpsilon, this.config.alpha);
    }
    
    // Use reward magnitude as initial priority
    return Math.pow(Math.abs(experience.reward) + this.config.priorityEpsilon, this.config.alpha);
  }

  private generateStateSignature(state: EnvironmentState): string {
    // Create a simplified signature of the state for diversity sampling
    const marketSig = Math.round(state.marketFeatures[0] * 100);
    const portfolioSig = Math.round(state.portfolioState[0] * 100);
    const riskSig = Math.round(state.riskMetrics[0] * 100);
    const conditionSig = state.condition;
    
    return `${marketSig}-${portfolioSig}-${riskSig}-${conditionSig}`;
  }

  private calculateNovelty(experience: Experience): number {
    // Simple novelty calculation based on state visitation frequency
    const signature = experience.stateSignature;
    const visitCount = this.stateEncoder.get(signature) || 0;
    this.stateEncoder.set(signature, visitCount + 1);
    
    return 1.0 / Math.sqrt(visitCount + 1);
  }

  private calculateDiversityScore(experiences: Experience[]): number {
    const signatures = experiences.map(exp => exp.stateSignature);
    const uniqueSignatures = new Set(signatures);
    
    return uniqueSignatures.size / experiences.length;
  }

  private calculateTemporalSpread(experiences: Experience[]): number {
    if (experiences.length < 2) return 0;
    
    const timestamps = experiences.map(exp => exp.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    return (maxTime - minTime) / (1000 * 60 * 60); // Hours
  }

  private updateBeta(): void {
    switch (this.config.betaSchedule) {
      case 'linear':
        this.currentBeta = Math.min(this.config.betaEnd, 
          this.config.betaStart + (this.config.betaEnd - this.config.betaStart) * this.betaStep / 1000000);
        break;
      case 'exponential':
        this.currentBeta = Math.min(this.config.betaEnd,
          this.config.betaStart * Math.pow(this.config.betaEnd / this.config.betaStart, this.betaStep / 1000000));
        break;
      case 'constant':
      default:
        this.currentBeta = this.config.beta;
        break;
    }
    this.betaStep++;
  }

  private shouldCompress(): boolean {
    if (!this.config.compressionEnabled) return false;
    
    const utilization = this.size() / this.config.maxSize;
    return utilization > this.config.compressionThreshold;
  }

  private compressBuffer(): void {
    // Simple compression: remove old, low-priority experiences
    const currentSize = this.size();
    const experiences = this.buffer.slice(0, currentSize).filter(exp => exp);
    
    // Sort by priority (descending) and age (recent first)
    experiences.sort((a, b) => {
      const priorityDiff = b.priority - a.priority;
      if (Math.abs(priorityDiff) > 0.01) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    // Keep top experiences
    const keepCount = Math.floor(currentSize * 0.8);
    const keptExperiences = experiences.slice(0, keepCount);
    
    // Rebuild buffer
    this.buffer.fill(undefined as any);
    this.currentIndex = 0;
    this.stateSignatures.clear();
    this.priorityTree = new SegmentTree(this.config.maxSize);
    
    keptExperiences.forEach(exp => this.add(exp));
    
    console.log(`🗜️ Buffer compressed: ${currentSize} -> ${keepCount} experiences`);
  }

  private removeStateSignature(signature: string): void {
    this.stateSignatures.delete(signature);
    const count = this.stateEncoder.get(signature) || 0;
    if (count > 1) {
      this.stateEncoder.set(signature, count - 1);
    } else {
      this.stateEncoder.delete(signature);
    }
  }

  private precomputeTensors(index: number, experience: Experience): void {
    // This would precompute state tensors for faster sampling
    // Implementation depends on specific state representation
    // For now, we'll skip this to avoid complexity
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage in bytes
    const experienceSize = 1000; // Rough estimate per experience
    return this.size() * experienceSize;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clear();
    this.samplingTimes = [];
  }
}

// Default replay configurations
export const DEFAULT_REPLAY_CONFIGS: Record<string, ReplayConfig> = {
  standard: {
    maxSize: 100000,
    minSize: 1000,
    batchSize: 32,
    strategy: 'PRIORITIZED',
    alpha: 0.6,
    beta: 0.4,
    betaSchedule: 'linear',
    betaStart: 0.4,
    betaEnd: 1.0,
    priorityEpsilon: 0.001,
    recentWeight: 1.2,
    temporalDecay: 0.1,
    diversityWeight: 0.5,
    maxDuplicates: 3,
    compressionEnabled: true,
    compressionThreshold: 0.9,
    evictionStrategy: 'priority_based',
    enableParallelSampling: false,
    precomputeStates: false
  },
  
  fast: {
    maxSize: 50000,
    minSize: 500,
    batchSize: 64,
    strategy: 'UNIFORM',
    alpha: 0,
    beta: 0,
    betaSchedule: 'constant',
    betaStart: 0,
    betaEnd: 0,
    priorityEpsilon: 0,
    recentWeight: 1.0,
    temporalDecay: 0,
    diversityWeight: 0,
    maxDuplicates: 10,
    compressionEnabled: false,
    compressionThreshold: 1.0,
    evictionStrategy: 'fifo',
    enableParallelSampling: true,
    precomputeStates: true
  },
  
  research: {
    maxSize: 500000,
    minSize: 5000,
    batchSize: 16,
    strategy: 'DIVERSITY',
    alpha: 0.7,
    beta: 0.5,
    betaSchedule: 'exponential',
    betaStart: 0.4,
    betaEnd: 1.0,
    priorityEpsilon: 0.0001,
    recentWeight: 1.5,
    temporalDecay: 0.05,
    diversityWeight: 0.8,
    maxDuplicates: 1,
    compressionEnabled: true,
    compressionThreshold: 0.95,
    evictionStrategy: 'priority_based',
    enableParallelSampling: false,
    precomputeStates: false
  }
};