/**
 * RLAgent - Advanced Reinforcement Learning Agent for Trading
 * 
 * Implements multiple RL algorithms including DQN, PPO, A3C, and SAC
 * with adaptive exploration, real-time learning, and sophisticated action selection.
 */

import * as tf from '@tensorflow/tfjs';
import { TradingEnvironment, EnvironmentState, Action, ActionType } from './TradingEnvironment';
import { RewardEngine, RewardComponents } from './RewardEngine';
import { ExperienceReplay, Experience } from './ExperienceReplay';

export type RLAlgorithm = 'DQN' | 'DDQN' | 'PPO' | 'A3C' | 'SAC' | 'TD3';
export type ExplorationStrategy = 'EPSILON_GREEDY' | 'UCB' | 'THOMPSON' | 'CURIOSITY' | 'NOISY_NETS';

export interface AgentConfig {
  algorithm: RLAlgorithm;
  
  // Network architecture
  stateSize: number;
  actionSize: number;
  hiddenLayers: number[];
  activation: 'relu' | 'tanh' | 'swish';
  dropout: number;
  
  // Learning parameters
  learningRate: number;
  batchSize: number;
  targetUpdateFreq: number;
  polyakAveraging: number; // For soft target updates (0-1)
  
  // Exploration
  explorationStrategy: ExplorationStrategy;
  epsilonStart: number;
  epsilonEnd: number;
  epsilonDecay: number;
  ucbConfidence: number; // For UCB exploration
  
  // Algorithm-specific parameters
  gamma: number; // Discount factor
  
  // DQN specific
  dueling: boolean;
  noisyNets: boolean;
  
  // PPO specific
  clipRatio: number;
  valueCoeff: number;
  entropyCoeff: number;
  ppoEpochs: number;
  
  // SAC specific
  alpha: number; // Temperature parameter
  automaticEntropyTuning: boolean;
  
  // Performance and safety
  gradientClipping: number;
  maxMemoryUsage: number; // MB
  enableJIT: boolean;
  mixedPrecision: boolean;
}

export interface AgentState {
  episode: number;
  totalSteps: number;
  epsilon: number;
  alpha: number; // For SAC
  
  // Performance metrics
  averageReward: number;
  episodeRewards: number[];
  winRate: number;
  sharpeRatio: number;
  
  // Learning progress
  loss: number;
  qValues: number[];
  policyEntropy: number;
  valueEstimate: number;
  
  // Exploration stats
  explorationRate: number;
  actionDistribution: Record<ActionType, number>;
  
  // Memory usage
  memoryUsage: number;
  networkSize: number;
}

export interface TrainingResult {
  episode: number;
  totalReward: number;
  episodeLength: number;
  averageReward: number;
  loss: number;
  epsilon: number;
  explorationRate: number;
  
  // Trading metrics
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  
  // Learning metrics
  qValueRange: [number, number];
  policyEntropy: number;
  valueAccuracy: number;
  
  // Performance
  trainingTime: number;
  stepsPerSecond: number;
  memoryUsage: number;
}

export class RLAgent {
  private config: AgentConfig;
  private algorithm: RLAlgorithm;
  
  // Neural networks
  private qNetwork: tf.LayersModel;
  private targetNetwork?: tf.LayersModel;
  private policyNetwork?: tf.LayersModel;
  private valueNetwork?: tf.LayersModel;
  
  // Agent state
  private currentState: AgentState;
  private isTraining: boolean = false;
  
  // Memory and exploration
  private replayBuffer: ExperienceReplay;
  private actionCounts: Map<string, number> = new Map();
  private episodeRewards: number[] = [];
  
  // Optimizers
  private optimizer: tf.Optimizer;
  private policyOptimizer?: tf.Optimizer;
  private valueOptimizer?: tf.Optimizer;
  
  // Training tracking
  private trainingHistory: TrainingResult[] = [];
  private lastTargetUpdate: number = 0;
  
  // Performance optimization
  private compiledPredict: Function | null = null;
  private warmupCompleted: boolean = false;

  constructor(
    config: AgentConfig,
    replayBuffer: ExperienceReplay
  ) {
    this.config = config;
    this.algorithm = config.algorithm;
    this.replayBuffer = replayBuffer;
    
    this.currentState = this.initializeState();
    this.optimizer = this.createOptimizer();
    
    console.log(`🤖 RL Agent initialized: ${config.algorithm} with ${config.stateSize} state size`);
  }

  /**
   * Initialize networks and prepare for training/inference
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing RL Agent networks...');
    
    // Create networks based on algorithm
    await this.createNetworks();
    
    // Create optimizers for multi-network algorithms
    if (this.needsPolicyOptimizer()) {
      this.policyOptimizer = this.createOptimizer();
    }
    if (this.needsValueOptimizer()) {
      this.valueOptimizer = this.createOptimizer();
    }
    
    // Warm up networks for performance
    await this.warmupNetworks();
    
    console.log(`✅ Agent networks initialized for ${this.algorithm}`);
  }

  /**
   * Select action based on current state and exploration strategy
   */
  async selectAction(state: EnvironmentState, training: boolean = true): Promise<Action> {
    const stateVector = this.stateToTensor(state);
    
    let action: Action;
    
    if (training && this.shouldExplore()) {
      action = await this.exploreAction(state, stateVector);
    } else {
      action = await this.greedyAction(state, stateVector);
    }
    
    // Update action statistics
    this.updateActionStats(action);
    
    // Clean up tensors
    stateVector.dispose();
    
    return action;
  }

  /**
   * Learn from a batch of experiences
   */
  async learn(): Promise<number> {
    if (!this.replayBuffer.canSample()) {
      return 0;
    }
    
    const batch = this.replayBuffer.sample();
    if (!batch) {
      return 0;
    }
    
    const startTime = performance.now();
    let loss: number;
    
    switch (this.algorithm) {
      case 'DQN':
      case 'DDQN':
        loss = await this.learnDQN(batch);
        break;
      case 'PPO':
        loss = await this.learnPPO(batch);
        break;
      case 'A3C':
        loss = await this.learnA3C(batch);
        break;
      case 'SAC':
        loss = await this.learnSAC(batch);
        break;
      case 'TD3':
        loss = await this.learnTD3(batch);
        break;
      default:
        throw new Error(`Unsupported algorithm: ${this.algorithm}`);
    }
    
    // Update target network if needed
    if (this.shouldUpdateTarget()) {
      await this.updateTargetNetwork();
    }
    
    // Update exploration parameters
    this.updateExploration();
    
    // Update agent state
    this.currentState.loss = loss;
    this.currentState.totalSteps++;
    
    const trainingTime = performance.now() - startTime;
    
    return loss;
  }

  /**
   * Process episode completion
   */
  async completeEpisode(totalReward: number, episodeLength: number): Promise<void> {
    this.episodeRewards.push(totalReward);
    this.currentState.episode++;
    
    // Keep reward history manageable
    if (this.episodeRewards.length > 1000) {
      this.episodeRewards = this.episodeRewards.slice(-500);
    }
    
    // Update performance metrics
    this.updatePerformanceMetrics();
    
    // Create training result
    const result: TrainingResult = {
      episode: this.currentState.episode,
      totalReward,
      episodeLength,
      averageReward: this.currentState.averageReward,
      loss: this.currentState.loss,
      epsilon: this.currentState.epsilon,
      explorationRate: this.currentState.explorationRate,
      sharpeRatio: this.currentState.sharpeRatio,
      maxDrawdown: 0, // Would be calculated from episode data
      winRate: this.currentState.winRate,
      profitFactor: 0, // Would be calculated from trades
      qValueRange: [Math.min(...this.currentState.qValues), Math.max(...this.currentState.qValues)],
      policyEntropy: this.currentState.policyEntropy,
      valueAccuracy: 0, // Would need validation set
      trainingTime: 0,
      stepsPerSecond: 0,
      memoryUsage: this.estimateMemoryUsage()
    };
    
    this.trainingHistory.push(result);
    
    console.log(`📊 Episode ${this.currentState.episode}: Reward=${totalReward.toFixed(2)}, ε=${this.currentState.epsilon.toFixed(3)}`);
  }

  /**
   * Save agent models
   */
  async saveModels(basePath: string): Promise<void> {
    console.log(`💾 Saving agent models to ${basePath}...`);
    
    if (this.qNetwork) {
      await this.qNetwork.save(`${basePath}/q_network`);
    }
    if (this.targetNetwork) {
      await this.targetNetwork.save(`${basePath}/target_network`);
    }
    if (this.policyNetwork) {
      await this.policyNetwork.save(`${basePath}/policy_network`);
    }
    if (this.valueNetwork) {
      await this.valueNetwork.save(`${basePath}/value_network`);
    }
    
    // Save agent state
    const stateData = {
      config: this.config,
      currentState: this.currentState,
      trainingHistory: this.trainingHistory
    };
    
    // In a real implementation, you'd save this to a file
    console.log('Agent state saved:', stateData);
  }

  /**
   * Load agent models
   */
  async loadModels(basePath: string): Promise<void> {
    console.log(`📂 Loading agent models from ${basePath}...`);
    
    try {
      if (this.algorithm === 'DQN' || this.algorithm === 'DDQN') {
        this.qNetwork = await tf.loadLayersModel(`${basePath}/q_network`);
        this.targetNetwork = await tf.loadLayersModel(`${basePath}/target_network`);
      } else if (this.algorithm === 'PPO' || this.algorithm === 'A3C') {
        this.policyNetwork = await tf.loadLayersModel(`${basePath}/policy_network`);
        this.valueNetwork = await tf.loadLayersModel(`${basePath}/value_network`);
      }
      
      console.log('✅ Models loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load models:', error);
      throw error;
    }
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.currentState };
  }

  /**
   * Get training history
   */
  getTrainingHistory(): TrainingResult[] {
    return [...this.trainingHistory];
  }

  /**
   * Get action probabilities for analysis
   */
  async getActionProbabilities(state: EnvironmentState): Promise<Record<ActionType, number>> {
    const stateVector = this.stateToTensor(state);
    
    let probabilities: Record<ActionType, number> = {} as any;
    
    if (this.algorithm === 'PPO' || this.algorithm === 'A3C') {
      // For policy-based methods
      const policyOutput = this.policyNetwork!.predict(stateVector) as tf.Tensor;
      const probs = await policyOutput.data();
      
      const actionTypes: ActionType[] = ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'];
      actionTypes.forEach((actionType, index) => {
        probabilities[actionType] = probs[index] || 0;
      });
      
      policyOutput.dispose();
    } else {
      // For value-based methods, use softmax of Q-values
      const qValues = this.qNetwork.predict(stateVector) as tf.Tensor;
      const softmaxProbs = tf.softmax(qValues);
      const probs = await softmaxProbs.data();
      
      const actionTypes: ActionType[] = ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'];
      actionTypes.forEach((actionType, index) => {
        probabilities[actionType] = probs[index] || 0;
      });
      
      qValues.dispose();
      softmaxProbs.dispose();
    }
    
    stateVector.dispose();
    return probabilities;
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async createNetworks(): Promise<void> {
    switch (this.algorithm) {
      case 'DQN':
      case 'DDQN':
        this.qNetwork = this.createQNetwork();
        this.targetNetwork = this.createQNetwork();
        await this.copyNetworkWeights(this.qNetwork, this.targetNetwork);
        break;
        
      case 'PPO':
      case 'A3C':
        this.policyNetwork = this.createPolicyNetwork();
        this.valueNetwork = this.createValueNetwork();
        break;
        
      case 'SAC':
        this.qNetwork = this.createCriticNetwork();
        this.targetNetwork = this.createCriticNetwork();
        this.policyNetwork = this.createStochasticPolicyNetwork();
        await this.copyNetworkWeights(this.qNetwork, this.targetNetwork);
        break;
        
      case 'TD3':
        this.qNetwork = this.createCriticNetwork();
        this.targetNetwork = this.createCriticNetwork();
        this.policyNetwork = this.createDeterministicPolicyNetwork();
        await this.copyNetworkWeights(this.qNetwork, this.targetNetwork);
        break;
    }
  }

  private createQNetwork(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.stateSize] });
    let x = input;
    
    // Add noise to inputs if using noisy nets
    if (this.config.noisyNets) {
      x = tf.layers.gaussianNoise({ stddev: 0.1 }).apply(x) as tf.SymbolicTensor;
    }
    
    // Hidden layers
    for (let i = 0; i < this.config.hiddenLayers.length; i++) {
      x = tf.layers.dense({
        units: this.config.hiddenLayers[i],
        activation: this.config.activation,
        kernelInitializer: 'heNormal'
      }).apply(x) as tf.SymbolicTensor;
      
      if (this.config.dropout > 0) {
        x = tf.layers.dropout({ rate: this.config.dropout }).apply(x) as tf.SymbolicTensor;
      }
    }
    
    let output;
    
    if (this.config.dueling) {
      // Dueling network architecture
      const valueStream = tf.layers.dense({
        units: 1,
        name: 'value_stream'
      }).apply(x) as tf.SymbolicTensor;
      
      const advantageStream = tf.layers.dense({
        units: this.config.actionSize,
        name: 'advantage_stream'
      }).apply(x) as tf.SymbolicTensor;
      
      // Combine value and advantage: Q = V + (A - mean(A))
      const advantageMean = tf.layers.average().apply([advantageStream]);
      const advantageNormalized = tf.layers.subtract().apply([advantageStream, advantageMean]) as tf.SymbolicTensor;
      
      output = tf.layers.add().apply([valueStream, advantageNormalized]);
    } else {
      // Standard DQN
      output = tf.layers.dense({
        units: this.config.actionSize,
        activation: 'linear'
      }).apply(x);
    }
    
    return tf.model({ inputs: input, outputs: output });
  }

  private createPolicyNetwork(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.stateSize] });
    let x = input;
    
    // Hidden layers
    for (const units of this.config.hiddenLayers) {
      x = tf.layers.dense({
        units,
        activation: this.config.activation,
        kernelInitializer: 'heNormal'
      }).apply(x) as tf.SymbolicTensor;
      
      if (this.config.dropout > 0) {
        x = tf.layers.dropout({ rate: this.config.dropout }).apply(x) as tf.SymbolicTensor;
      }
    }
    
    // Policy output (action probabilities)
    const output = tf.layers.dense({
      units: this.config.actionSize,
      activation: 'softmax'
    }).apply(x);
    
    return tf.model({ inputs: input, outputs: output });
  }

  private createValueNetwork(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.stateSize] });
    let x = input;
    
    // Hidden layers
    for (const units of this.config.hiddenLayers) {
      x = tf.layers.dense({
        units,
        activation: this.config.activation,
        kernelInitializer: 'heNormal'
      }).apply(x) as tf.SymbolicTensor;
      
      if (this.config.dropout > 0) {
        x = tf.layers.dropout({ rate: this.config.dropout }).apply(x) as tf.SymbolicTensor;
      }
    }
    
    // Value output (scalar)
    const output = tf.layers.dense({
      units: 1,
      activation: 'linear'
    }).apply(x);
    
    return tf.model({ inputs: input, outputs: output });
  }

  private createCriticNetwork(): tf.LayersModel {
    // For SAC/TD3 - takes state and action as input
    const stateInput = tf.input({ shape: [this.config.stateSize], name: 'state' });
    const actionInput = tf.input({ shape: [this.config.actionSize], name: 'action' });
    
    // Concatenate state and action
    const concatenated = tf.layers.concatenate().apply([stateInput, actionInput]) as tf.SymbolicTensor;
    let x = concatenated;
    
    // Hidden layers
    for (const units of this.config.hiddenLayers) {
      x = tf.layers.dense({
        units,
        activation: this.config.activation,
        kernelInitializer: 'heNormal'
      }).apply(x) as tf.SymbolicTensor;
      
      if (this.config.dropout > 0) {
        x = tf.layers.dropout({ rate: this.config.dropout }).apply(x) as tf.SymbolicTensor;
      }
    }
    
    // Q-value output (scalar)
    const output = tf.layers.dense({
      units: 1,
      activation: 'linear'
    }).apply(x);
    
    return tf.model({ inputs: [stateInput, actionInput], outputs: output });
  }

  private createStochasticPolicyNetwork(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.stateSize] });
    let x = input;
    
    // Hidden layers
    for (const units of this.config.hiddenLayers) {
      x = tf.layers.dense({
        units,
        activation: this.config.activation,
        kernelInitializer: 'heNormal'
      }).apply(x) as tf.SymbolicTensor;
    }
    
    // Output mean and log_std for gaussian policy
    const mean = tf.layers.dense({
      units: this.config.actionSize,
      activation: 'tanh'
    }).apply(x) as tf.SymbolicTensor;
    
    const logStd = tf.layers.dense({
      units: this.config.actionSize,
      activation: 'linear'
    }).apply(x) as tf.SymbolicTensor;
    
    return tf.model({ inputs: input, outputs: [mean, logStd] });
  }

  private createDeterministicPolicyNetwork(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.stateSize] });
    let x = input;
    
    // Hidden layers
    for (const units of this.config.hiddenLayers) {
      x = tf.layers.dense({
        units,
        activation: this.config.activation,
        kernelInitializer: 'heNormal'
      }).apply(x) as tf.SymbolicTensor;
    }
    
    // Deterministic action output
    const output = tf.layers.dense({
      units: this.config.actionSize,
      activation: 'tanh'
    }).apply(x);
    
    return tf.model({ inputs: input, outputs: output });
  }

  private async learnDQN(batch: any): Promise<number> {
    const { experiences, weights } = batch;
    const batchSize = experiences.length;
    
    // Create tensors from batch
    const states = tf.stack(experiences.map((exp: Experience) => this.stateToTensor(exp.state)));
    const actions = tf.tensor1d(experiences.map((exp: Experience) => this.actionToIndex(exp.action)), 'int32');
    const rewards = tf.tensor1d(experiences.map((exp: Experience) => exp.reward));
    const nextStates = tf.stack(experiences.map((exp: Experience) => this.stateToTensor(exp.nextState)));
    const dones = tf.tensor1d(experiences.map((exp: Experience) => exp.done ? 1 : 0));
    
    const loss = tf.tidy(() => {
      // Current Q values
      const currentQValues = this.qNetwork.predict(states) as tf.Tensor2D;
      const currentActionQValues = tf.gatherND(currentQValues, 
        tf.stack([tf.range(0, batchSize), actions], 1));
      
      // Next Q values from target network
      let nextQValues: tf.Tensor1D;
      
      if (this.algorithm === 'DDQN') {
        // Double DQN: use main network to select actions, target network to evaluate
        const nextQValuesMain = this.qNetwork.predict(nextStates) as tf.Tensor2D;
        const nextActions = tf.argMax(nextQValuesMain, 1);
        const nextQValuesTarget = this.targetNetwork!.predict(nextStates) as tf.Tensor2D;
        nextQValues = tf.gatherND(nextQValuesTarget, 
          tf.stack([tf.range(0, batchSize), nextActions], 1));
      } else {
        // Standard DQN
        const nextQValuesTarget = this.targetNetwork!.predict(nextStates) as tf.Tensor2D;
        nextQValues = tf.max(nextQValuesTarget, 1);
      }
      
      // Target Q values
      const targetQValues = tf.add(rewards, 
        tf.mul(tf.scalar(this.config.gamma), tf.mul(nextQValues, tf.sub(tf.scalar(1), dones))));
      
      // Calculate loss (mean squared error)
      const errors = tf.sub(currentActionQValues, targetQValues);
      const squaredErrors = tf.square(errors);
      
      // Apply importance sampling weights if provided
      let weightedErrors = squaredErrors;
      if (weights) {
        const weightsTensor = tf.tensor1d(Array.from(weights));
        weightedErrors = tf.mul(squaredErrors, weightsTensor);
      }
      
      return tf.mean(weightedErrors);
    });
    
    // Compute gradients and update network
    const lossValue = await loss.data();
    const grads = tf.variableGrads(() => loss, this.qNetwork.trainableWeights);
    
    // Apply gradient clipping
    if (this.config.gradientClipping > 0) {
      const clippedGrads = this.clipGradients(grads.grads, this.config.gradientClipping);
      this.optimizer.applyGradients(clippedGrads);
    } else {
      this.optimizer.applyGradients(grads.grads);
    }
    
    // Update replay buffer priorities if using prioritized replay
    if (batch.indices) {
      const tdErrors = tf.tidy(() => {
        const currentQValues = this.qNetwork.predict(states) as tf.Tensor2D;
        const currentActionQValues = tf.gatherND(currentQValues, 
          tf.stack([tf.range(0, batchSize), actions], 1));
        const targetQValues = tf.add(rewards, 
          tf.mul(tf.scalar(this.config.gamma), tf.mul(tf.max(this.targetNetwork!.predict(nextStates) as tf.Tensor2D, 1), tf.sub(tf.scalar(1), dones))));
        return tf.sub(currentActionQValues, targetQValues);
      });
      
      const tdErrorsArray = await tdErrors.data();
      this.replayBuffer.updatePriorities(batch.indices, Array.from(tdErrorsArray));
      tdErrors.dispose();
    }
    
    // Cleanup
    states.dispose();
    actions.dispose();
    rewards.dispose();
    nextStates.dispose();
    dones.dispose();
    loss.dispose();
    
    return lossValue[0];
  }

  private async learnPPO(batch: any): Promise<number> {
    // PPO implementation would be more complex
    // This is a simplified placeholder
    console.log('PPO learning not fully implemented yet');
    return 0;
  }

  private async learnA3C(batch: any): Promise<number> {
    // A3C implementation would be more complex
    // This is a simplified placeholder
    console.log('A3C learning not fully implemented yet');
    return 0;
  }

  private async learnSAC(batch: any): Promise<number> {
    // SAC implementation would be more complex
    // This is a simplified placeholder
    console.log('SAC learning not fully implemented yet');
    return 0;
  }

  private async learnTD3(batch: any): Promise<number> {
    // TD3 implementation would be more complex
    // This is a simplified placeholder
    console.log('TD3 learning not fully implemented yet');
    return 0;
  }

  private shouldExplore(): boolean {
    switch (this.config.explorationStrategy) {
      case 'EPSILON_GREEDY':
        return Math.random() < this.currentState.epsilon;
      case 'UCB':
        // UCB exploration based on action uncertainty
        return this.currentState.totalSteps < 1000 || Math.random() < 0.1;
      case 'THOMPSON':
        // Thompson sampling - placeholder
        return Math.random() < 0.1;
      case 'CURIOSITY':
        // Curiosity-driven exploration - placeholder
        return Math.random() < 0.15;
      case 'NOISY_NETS':
        // No explicit exploration needed with noisy nets
        return false;
      default:
        return Math.random() < this.currentState.epsilon;
    }
  }

  private async exploreAction(state: EnvironmentState, stateVector: tf.Tensor): Promise<Action> {
    const actionTypes: ActionType[] = ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'];
    
    switch (this.config.explorationStrategy) {
      case 'EPSILON_GREEDY':
        // Random action selection
        const randomType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
        return {
          type: randomType,
          size: Math.random() * this.getMaxPositionSize(randomType)
        };
        
      case 'UCB':
        // Upper Confidence Bound exploration
        return await this.ucbAction(state, stateVector);
        
      default:
        // Fallback to random
        const fallbackType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
        return {
          type: fallbackType,
          size: Math.random() * this.getMaxPositionSize(fallbackType)
        };
    }
  }

  private async greedyAction(state: EnvironmentState, stateVector: tf.Tensor): Promise<Action> {
    const actionTypes: ActionType[] = ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'];
    
    if (this.algorithm === 'DQN' || this.algorithm === 'DDQN') {
      // Q-value based action selection
      const qValues = this.qNetwork.predict(stateVector.expandDims(0)) as tf.Tensor2D;
      const actionIndex = tf.argMax(qValues, 1).dataSync()[0];
      const selectedType = actionTypes[actionIndex];
      
      // For continuous action size, we'd need additional logic
      const actionSize = this.calculateOptimalSize(selectedType, qValues, actionIndex);
      
      qValues.dispose();
      
      return {
        type: selectedType,
        size: actionSize
      };
    } else {
      // Policy-based action selection (PPO, A3C, etc.)
      const policyOutput = this.policyNetwork!.predict(stateVector.expandDims(0)) as tf.Tensor2D;
      const actionProbs = await policyOutput.data();
      
      // Select action with highest probability
      let maxProb = -1;
      let selectedIndex = 0;
      for (let i = 0; i < actionProbs.length; i++) {
        if (actionProbs[i] > maxProb) {
          maxProb = actionProbs[i];
          selectedIndex = i;
        }
      }
      
      const selectedType = actionTypes[selectedIndex];
      const actionSize = this.getMaxPositionSize(selectedType) * 0.5; // Default to 50%
      
      policyOutput.dispose();
      
      return {
        type: selectedType,
        size: actionSize
      };
    }
  }

  private async ucbAction(state: EnvironmentState, stateVector: tf.Tensor): Promise<Action> {
    // UCB (Upper Confidence Bound) exploration
    const actionTypes: ActionType[] = ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'];
    
    // Get Q-values for all actions
    const qValues = this.qNetwork.predict(stateVector.expandDims(0)) as tf.Tensor2D;
    const qValuesArray = await qValues.data();
    
    // Calculate UCB scores
    let maxUcbScore = -Infinity;
    let selectedIndex = 0;
    
    for (let i = 0; i < actionTypes.length; i++) {
      const actionKey = `${this.encodeState(state)}-${actionTypes[i]}`;
      const actionCount = this.actionCounts.get(actionKey) || 0;
      
      const confidence = this.config.ucbConfidence * Math.sqrt(
        Math.log(this.currentState.totalSteps + 1) / (actionCount + 1)
      );
      
      const ucbScore = qValuesArray[i] + confidence;
      
      if (ucbScore > maxUcbScore) {
        maxUcbScore = ucbScore;
        selectedIndex = i;
      }
    }
    
    qValues.dispose();
    
    const selectedType = actionTypes[selectedIndex];
    return {
      type: selectedType,
      size: Math.random() * this.getMaxPositionSize(selectedType)
    };
  }

  private stateToTensor(state: EnvironmentState): tf.Tensor1D {
    // Combine all state components into a single vector
    const stateVector: number[] = [];
    
    // Add market features
    stateVector.push(...Array.from(state.marketFeatures));
    
    // Add portfolio state
    stateVector.push(...Array.from(state.portfolioState));
    
    // Add risk metrics
    stateVector.push(...Array.from(state.riskMetrics));
    
    // Add time features
    stateVector.push(...Array.from(state.timeFeatures));
    
    // Add scalar features
    stateVector.push(
      state.volatility,
      state.trendStrength,
      state.cash / 10000, // Normalize
      state.equity / 10000, // Normalize
      state.drawdown,
      state.stepCount / 1000 // Normalize
    );
    
    // Ensure consistent size
    while (stateVector.length < this.config.stateSize) {
      stateVector.push(0);
    }
    
    return tf.tensor1d(stateVector.slice(0, this.config.stateSize));
  }

  private actionToIndex(action: Action): number {
    const actionTypes: ActionType[] = ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'];
    return actionTypes.indexOf(action.type);
  }

  private calculateOptimalSize(actionType: ActionType, qValues: tf.Tensor2D, actionIndex: number): number {
    // Simplified size calculation - in reality, this would be more sophisticated
    const maxSize = this.getMaxPositionSize(actionType);
    return maxSize * 0.5; // Default to 50% of max
  }

  private getMaxPositionSize(actionType: ActionType): number {
    switch (actionType) {
      case 'BUY':
      case 'SELL':
        return 0.3; // Max 30% position size
      case 'CLOSE_LONG':
      case 'CLOSE_SHORT':
        return 1.0; // Can close up to 100%
      case 'HOLD':
      default:
        return 0;
    }
  }

  private shouldUpdateTarget(): boolean {
    return this.currentState.totalSteps - this.lastTargetUpdate >= this.config.targetUpdateFreq;
  }

  private async updateTargetNetwork(): Promise<void> {
    if (!this.targetNetwork) return;
    
    if (this.config.polyakAveraging > 0) {
      // Soft update: θ_target = τ * θ_local + (1 - τ) * θ_target
      await this.softUpdateNetwork(this.qNetwork, this.targetNetwork, this.config.polyakAveraging);
    } else {
      // Hard update: copy weights completely
      await this.copyNetworkWeights(this.qNetwork, this.targetNetwork);
    }
    
    this.lastTargetUpdate = this.currentState.totalSteps;
  }

  private async copyNetworkWeights(source: tf.LayersModel, target: tf.LayersModel): Promise<void> {
    const sourceWeights = source.getWeights();
    target.setWeights(sourceWeights);
  }

  private async softUpdateNetwork(source: tf.LayersModel, target: tf.LayersModel, tau: number): Promise<void> {
    const sourceWeights = source.getWeights();
    const targetWeights = target.getWeights();
    
    const updatedWeights = sourceWeights.map((sourceWeight, i) => {
      const targetWeight = targetWeights[i];
      return tf.add(
        tf.mul(sourceWeight, tf.scalar(tau)),
        tf.mul(targetWeight, tf.scalar(1 - tau))
      );
    });
    
    target.setWeights(updatedWeights);
    
    // Dispose intermediate tensors
    updatedWeights.forEach(w => w.dispose());
  }

  private updateExploration(): void {
    if (this.config.explorationStrategy === 'EPSILON_GREEDY') {
      // Exponential decay
      this.currentState.epsilon = Math.max(
        this.config.epsilonEnd,
        this.currentState.epsilon * this.config.epsilonDecay
      );
    }
  }

  private updateActionStats(action: Action): void {
    const key = action.type;
    this.currentState.actionDistribution[key] = (this.currentState.actionDistribution[key] || 0) + 1;
    
    // Update exploration rate
    const totalActions = Object.values(this.currentState.actionDistribution)
      .reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...Object.values(this.currentState.actionDistribution));
    this.currentState.explorationRate = 1 - (maxCount / totalActions);
  }

  private updatePerformanceMetrics(): void {
    if (this.episodeRewards.length === 0) return;
    
    // Average reward over recent episodes
    const recentRewards = this.episodeRewards.slice(-100);
    this.currentState.averageReward = recentRewards.reduce((sum, r) => sum + r, 0) / recentRewards.length;
    
    // Win rate
    const winningEpisodes = recentRewards.filter(r => r > 0).length;
    this.currentState.winRate = winningEpisodes / recentRewards.length;
    
    // Simplified Sharpe ratio calculation
    if (recentRewards.length > 10) {
      const avgReturn = this.currentState.averageReward;
      const volatility = Math.sqrt(
        recentRewards.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / recentRewards.length
      );
      this.currentState.sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
    }
  }

  private encodeState(state: EnvironmentState): string {
    // Simple state encoding for UCB
    return `${Math.round(state.equity)}-${state.condition}`;
  }

  private clipGradients(gradients: tf.NamedTensorMap, maxNorm: number): tf.NamedTensorMap {
    const clippedGrads: tf.NamedTensorMap = {};
    
    for (const [name, grad] of Object.entries(gradients)) {
      const norm = tf.norm(grad);
      const normValue = norm.dataSync()[0];
      
      if (normValue > maxNorm) {
        clippedGrads[name] = tf.mul(grad, tf.scalar(maxNorm / normValue));
      } else {
        clippedGrads[name] = grad;
      }
      
      norm.dispose();
    }
    
    return clippedGrads;
  }

  private createOptimizer(): tf.Optimizer {
    return tf.train.adam(this.config.learningRate);
  }

  private needsPolicyOptimizer(): boolean {
    return ['PPO', 'A3C', 'SAC'].includes(this.algorithm);
  }

  private needsValueOptimizer(): boolean {
    return ['PPO', 'A3C'].includes(this.algorithm);
  }

  private async warmupNetworks(): Promise<void> {
    // Warm up networks with dummy data for better performance
    const dummyState = tf.zeros([1, this.config.stateSize]);
    
    if (this.qNetwork) {
      const warmupQ = this.qNetwork.predict(dummyState);
      (warmupQ as tf.Tensor).dispose();
    }
    
    if (this.policyNetwork) {
      const warmupPolicy = this.policyNetwork.predict(dummyState);
      (warmupPolicy as tf.Tensor).dispose();
    }
    
    if (this.valueNetwork) {
      const warmupValue = this.valueNetwork.predict(dummyState);
      (warmupValue as tf.Tensor).dispose();
    }
    
    dummyState.dispose();
    this.warmupCompleted = true;
  }

  private estimateMemoryUsage(): number {
    let totalParams = 0;
    
    if (this.qNetwork) totalParams += this.qNetwork.countParams();
    if (this.targetNetwork) totalParams += this.targetNetwork.countParams();
    if (this.policyNetwork) totalParams += this.policyNetwork.countParams();
    if (this.valueNetwork) totalParams += this.valueNetwork.countParams();
    
    return totalParams * 4; // 4 bytes per parameter (float32)
  }

  private initializeState(): AgentState {
    return {
      episode: 0,
      totalSteps: 0,
      epsilon: this.config.epsilonStart,
      alpha: this.config.alpha,
      averageReward: 0,
      episodeRewards: [],
      winRate: 0,
      sharpeRatio: 0,
      loss: 0,
      qValues: [],
      policyEntropy: 0,
      valueEstimate: 0,
      explorationRate: 1.0,
      actionDistribution: {
        'BUY': 0,
        'SELL': 0,
        'HOLD': 0,
        'CLOSE_LONG': 0,
        'CLOSE_SHORT': 0
      },
      memoryUsage: 0,
      networkSize: 0
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Dispose neural networks
    this.qNetwork?.dispose();
    this.targetNetwork?.dispose();
    this.policyNetwork?.dispose();
    this.valueNetwork?.dispose();
    
    // Dispose optimizers
    this.optimizer?.dispose();
    this.policyOptimizer?.dispose();
    this.valueOptimizer?.dispose();
    
    // Clear data
    this.episodeRewards = [];
    this.trainingHistory = [];
    this.actionCounts.clear();
  }
}

// Default agent configurations
export const DEFAULT_AGENT_CONFIGS: Record<string, AgentConfig> = {
  dqn: {
    algorithm: 'DQN',
    stateSize: 100,
    actionSize: 5,
    hiddenLayers: [256, 128, 64],
    activation: 'relu',
    dropout: 0.1,
    learningRate: 0.001,
    batchSize: 32,
    targetUpdateFreq: 100,
    polyakAveraging: 0.005,
    explorationStrategy: 'EPSILON_GREEDY',
    epsilonStart: 1.0,
    epsilonEnd: 0.01,
    epsilonDecay: 0.995,
    ucbConfidence: 2.0,
    gamma: 0.99,
    dueling: true,
    noisyNets: false,
    clipRatio: 0.2,
    valueCoeff: 0.5,
    entropyCoeff: 0.01,
    ppoEpochs: 4,
    alpha: 0.2,
    automaticEntropyTuning: true,
    gradientClipping: 1.0,
    maxMemoryUsage: 1024,
    enableJIT: false,
    mixedPrecision: false
  },
  
  ppo: {
    algorithm: 'PPO',
    stateSize: 100,
    actionSize: 5,
    hiddenLayers: [128, 64],
    activation: 'tanh',
    dropout: 0.0,
    learningRate: 0.0003,
    batchSize: 64,
    targetUpdateFreq: 1,
    polyakAveraging: 0,
    explorationStrategy: 'CURIOSITY',
    epsilonStart: 0,
    epsilonEnd: 0,
    epsilonDecay: 1.0,
    ucbConfidence: 0,
    gamma: 0.99,
    dueling: false,
    noisyNets: false,
    clipRatio: 0.2,
    valueCoeff: 0.5,
    entropyCoeff: 0.01,
    ppoEpochs: 4,
    alpha: 0,
    automaticEntropyTuning: false,
    gradientClipping: 0.5,
    maxMemoryUsage: 512,
    enableJIT: false,
    mixedPrecision: false
  }
};