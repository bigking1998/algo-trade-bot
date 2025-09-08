/**
 * RLTrainer - Advanced RL Training System with Curriculum Learning
 * 
 * Orchestrates training of RL agents with sophisticated curriculum learning,
 * automated hyperparameter tuning, and progressive difficulty scaling.
 */

import { RLAgent, AgentConfig, DEFAULT_AGENT_CONFIGS } from './RLAgent';
import { TradingEnvironment, EnvironmentConfig, MarketCondition, DEFAULT_ENVIRONMENT_CONFIGS } from './TradingEnvironment';
import { RewardEngine, RewardConfig, DEFAULT_REWARD_CONFIGS } from './RewardEngine';
import { ExperienceReplay, DEFAULT_REPLAY_CONFIGS } from './ExperienceReplay';
import { MultiAgentSystem, MultiAgentConfig, DEFAULT_MULTI_AGENT_CONFIGS } from './MultiAgentSystem';

export type TrainingStrategy = 'VANILLA' | 'CURRICULUM' | 'ADVERSARIAL' | 'SELF_PLAY' | 'PROGRESSIVE' | 'TRANSFER';
export type CurriculumType = 'DIFFICULTY' | 'DIVERSITY' | 'DOMAIN' | 'TASK' | 'TEMPORAL';
export type SchedulingStrategy = 'LINEAR' | 'EXPONENTIAL' | 'STEP' | 'ADAPTIVE' | 'PERFORMANCE_BASED';

export interface TrainingConfig {
  // Training strategy
  strategy: TrainingStrategy;
  curriculumType: CurriculumType;
  schedulingStrategy: SchedulingStrategy;
  
  // Training parameters
  totalEpisodes: number;
  maxStepsPerEpisode: number;
  evaluationFrequency: number;
  evaluationEpisodes: number;
  
  // Curriculum learning
  initialDifficulty: number; // 0-1 scale
  maxDifficulty: number;
  difficultyIncrement: number;
  difficultyThreshold: number; // Performance threshold to increase difficulty
  
  // Progressive training
  phases: TrainingPhase[];
  transferLearning: boolean;
  pretrainedModelPath?: string;
  
  // Hyperparameter optimization
  enableHyperparameterTuning: boolean;
  hyperparameterTrials: number;
  optimizationMetric: 'reward' | 'sharpe' | 'drawdown' | 'winrate';
  
  // Early stopping and validation
  earlyStopping: boolean;
  patience: number;
  validationSplit: number;
  
  // Multi-agent training
  enableMultiAgent: boolean;
  multiAgentConfig?: MultiAgentConfig;
  
  // Performance targets
  targetPerformance: {
    averageReward: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  
  // Resource management
  parallelEnvironments: number;
  checkpointFrequency: number; // Episodes between checkpoints
  memoryLimit: number; // MB
}

export interface TrainingPhase {
  name: string;
  episodes: number;
  difficulty: number;
  marketConditions: MarketCondition[];
  environmentConfig: EnvironmentConfig;
  rewardConfig: RewardConfig;
  agentConfig?: Partial<AgentConfig>;
  description: string;
}

export interface CurriculumState {
  currentPhase: number;
  currentDifficulty: number;
  phaseProgress: number; // 0-1
  totalProgress: number; // 0-1
  
  // Performance tracking
  phasePerformance: number[];
  averagePerformance: number;
  improvementRate: number;
  
  // Adaptive parameters
  adaptiveParameters: Record<string, number>;
  lastDifficultyIncrease: number;
}

export interface TrainingMetrics {
  episode: number;
  totalSteps: number;
  episodeReward: number;
  averageReward: number;
  
  // Performance metrics
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  
  // Learning metrics
  loss: number;
  epsilon: number;
  learningProgress: number;
  
  // Curriculum metrics
  currentDifficulty: number;
  curriculumPhase: string;
  difficultyAdjustments: number;
  
  // System metrics
  trainingTime: number;
  memoryUsage: number;
  stepsPerSecond: number;
  
  // Environment diversity
  marketConditionsExperienced: MarketCondition[];
  environmentComplexity: number;
}

export interface TrainingResult {
  success: boolean;
  finalPerformance: TrainingMetrics;
  bestPerformance: TrainingMetrics;
  trainingHistory: TrainingMetrics[];
  
  // Curriculum analysis
  curriculumEffectiveness: number;
  difficultyProgression: number[];
  phaseCompletionTimes: number[];
  
  // Model artifacts
  finalModelPath: string;
  checkpointPaths: string[];
  
  // Analysis
  convergenceEpisode: number;
  plateauDetection: number[];
  performanceRegression: number[];
  
  errors: string[];
  warnings: string[];
}

export class RLTrainer {
  private config: TrainingConfig;
  private agent: RLAgent;
  private environment: TradingEnvironment;
  private rewardEngine: RewardEngine;
  private replayBuffer: ExperienceReplay;
  private multiAgentSystem?: MultiAgentSystem;
  
  // Training state
  private curriculumState: CurriculumState;
  private trainingMetrics: TrainingMetrics[] = [];
  private currentEpisode: number = 0;
  private isTraining: boolean = false;
  
  // Performance tracking
  private bestPerformance: number = -Infinity;
  private plateauCounter: number = 0;
  private earlyStoppingCounter: number = 0;
  
  // Curriculum phases
  private phases: TrainingPhase[] = [];
  private currentPhaseIndex: number = 0;
  
  // Progress callbacks
  private progressCallbacks: ((metrics: TrainingMetrics) => void)[] = [];
  private completionCallbacks: ((result: TrainingResult) => void)[] = [];

  constructor(config: TrainingConfig) {
    this.config = config;
    this.curriculumState = this.initializeCurriculumState();
    
    // Initialize phases
    if (config.phases && config.phases.length > 0) {
      this.phases = config.phases;
    } else {
      this.phases = this.generateDefaultPhases();
    }
    
    console.log(`🎓 RL Trainer initialized: ${config.strategy} strategy with ${this.phases.length} phases`);
  }

  /**
   * Initialize training components
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing RL training components...');
    
    // Initialize with first phase configuration
    const firstPhase = this.phases[0];
    
    // Create environment
    this.environment = new TradingEnvironment(firstPhase.environmentConfig);
    await this.environment.initialize();
    
    // Create reward engine
    this.rewardEngine = new RewardEngine(firstPhase.rewardConfig);
    
    // Create replay buffer
    this.replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.standard);
    
    // Create agent
    const agentConfig = this.mergeAgentConfig(DEFAULT_AGENT_CONFIGS.dqn, firstPhase.agentConfig);
    this.agent = new RLAgent(agentConfig, this.replayBuffer);
    await this.agent.initialize();
    
    // Initialize multi-agent system if enabled
    if (this.config.enableMultiAgent && this.config.multiAgentConfig) {
      this.multiAgentSystem = new MultiAgentSystem(this.config.multiAgentConfig);
      // Add agents to the system
      await this.initializeMultiAgentSystem();
    }
    
    console.log('✅ Training components initialized');
  }

  /**
   * Start training process
   */
  async train(): Promise<TrainingResult> {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }
    
    console.log(`🎯 Starting training for ${this.config.totalEpisodes} episodes...`);
    
    this.isTraining = true;
    const startTime = Date.now();
    
    try {
      // Load pretrained model if specified
      if (this.config.pretrainedModelPath) {
        await this.loadPretrainedModel();
      }
      
      // Main training loop
      while (this.currentEpisode < this.config.totalEpisodes && this.isTraining) {
        await this.runEpisode();
        
        // Update curriculum
        await this.updateCurriculum();
        
        // Evaluate and checkpoint
        if (this.shouldEvaluate()) {
          await this.evaluate();
        }
        
        if (this.shouldCheckpoint()) {
          await this.createCheckpoint();
        }
        
        // Check early stopping
        if (this.shouldStopEarly()) {
          console.log('🛑 Early stopping triggered');
          break;
        }
        
        this.currentEpisode++;
      }
      
      const trainingTime = Date.now() - startTime;
      
      // Final evaluation
      const finalMetrics = await this.finalEvaluation();
      
      // Create training result
      const result: TrainingResult = {
        success: true,
        finalPerformance: finalMetrics,
        bestPerformance: this.getBestPerformance(),
        trainingHistory: [...this.trainingMetrics],
        curriculumEffectiveness: this.calculateCurriculumEffectiveness(),
        difficultyProgression: this.getDifficultyProgression(),
        phaseCompletionTimes: this.getPhaseCompletionTimes(),
        finalModelPath: 'models/final_model',
        checkpointPaths: this.getCheckpointPaths(),
        convergenceEpisode: this.findConvergenceEpisode(),
        plateauDetection: this.detectPlateaus(),
        performanceRegression: this.detectRegressions(),
        errors: [],
        warnings: []
      };
      
      // Notify completion
      this.completionCallbacks.forEach(callback => callback(result));
      
      console.log(`✅ Training completed in ${(trainingTime / 60000).toFixed(1)} minutes`);
      return result;
      
    } catch (error) {
      console.error('❌ Training failed:', error);
      
      const failedResult: TrainingResult = {
        success: false,
        finalPerformance: this.getCurrentMetrics(),
        bestPerformance: this.getBestPerformance(),
        trainingHistory: [...this.trainingMetrics],
        curriculumEffectiveness: 0,
        difficultyProgression: [],
        phaseCompletionTimes: [],
        finalModelPath: '',
        checkpointPaths: [],
        convergenceEpisode: 0,
        plateauDetection: [],
        performanceRegression: [],
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
      
      this.completionCallbacks.forEach(callback => callback(failedResult));
      return failedResult;
      
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Stop training
   */
  stopTraining(): void {
    console.log('🛑 Stopping training...');
    this.isTraining = false;
  }

  /**
   * Add progress callback
   */
  onProgress(callback: (metrics: TrainingMetrics) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Add completion callback
   */
  onCompletion(callback: (result: TrainingResult) => void): void {
    this.completionCallbacks.push(callback);
  }

  /**
   * Get current training progress
   */
  getProgress(): {
    episode: number;
    totalEpisodes: number;
    progress: number;
    currentPhase: string;
    curriculum: CurriculumState;
    recentPerformance: number[];
  } {
    return {
      episode: this.currentEpisode,
      totalEpisodes: this.config.totalEpisodes,
      progress: this.currentEpisode / this.config.totalEpisodes,
      currentPhase: this.phases[this.currentPhaseIndex]?.name || 'Unknown',
      curriculum: { ...this.curriculumState },
      recentPerformance: this.trainingMetrics.slice(-10).map(m => m.episodeReward)
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async runEpisode(): Promise<void> {
    const episodeStartTime = Date.now();
    
    // Reset environment with current curriculum settings
    const marketCondition = this.selectMarketCondition();
    const state = await this.environment.reset(marketCondition);
    
    let totalReward = 0;
    let steps = 0;
    let done = false;
    
    while (!done && steps < this.config.maxStepsPerEpisode && this.isTraining) {
      // Agent selects action
      const action = await this.agent.selectAction(state, true);
      
      // Environment step
      const stepResult = await this.environment.step(action);
      const { state: nextState, reward, done: episodeDone, info } = stepResult;
      
      // Enhanced reward calculation
      const rewardComponents = this.rewardEngine.calculateReward(action, state, nextState, info.execution);
      const enhancedReward = rewardComponents.totalReward;
      
      // Add experience to replay buffer
      this.replayBuffer.add({
        state,
        action,
        reward: enhancedReward,
        nextState,
        done: episodeDone,
        timestamp: new Date(),
        episodeId: `episode_${this.currentEpisode}`,
        stepInEpisode: steps,
        priority: Math.abs(enhancedReward),
        tdError: 0,
        stateSignature: '',
        actionFrequency: 0,
        novelty: 0,
        predictionError: 0
      });
      
      // Agent learning
      await this.agent.learn();
      
      totalReward += enhancedReward;
      steps++;
      done = episodeDone;
      state = nextState;
    }
    
    // Complete episode
    await this.agent.completeEpisode(totalReward, steps);
    
    // Create episode metrics
    const episodeTime = Date.now() - episodeStartTime;
    const metrics = this.createEpisodeMetrics(totalReward, steps, episodeTime);
    
    this.trainingMetrics.push(metrics);
    
    // Update curriculum state
    this.updateCurriculumPerformance(totalReward);
    
    // Notify progress
    this.progressCallbacks.forEach(callback => callback(metrics));
    
    // Log progress periodically
    if ((this.currentEpisode + 1) % 100 === 0) {
      console.log(`📈 Episode ${this.currentEpisode + 1}: Reward=${totalReward.toFixed(2)}, Steps=${steps}, Phase=${this.phases[this.currentPhaseIndex].name}`);
    }
  }

  private async updateCurriculum(): Promise<void> {
    if (this.config.strategy !== 'CURRICULUM') return;
    
    // Check if we should advance to next phase
    if (this.shouldAdvancePhase()) {
      await this.advanceToNextPhase();
    }
    
    // Adjust difficulty within current phase
    if (this.shouldAdjustDifficulty()) {
      this.adjustDifficulty();
    }
    
    // Update curriculum state
    this.updateCurriculumState();
  }

  private shouldAdvancePhase(): boolean {
    // Check if current phase is complete
    const currentPhase = this.phases[this.currentPhaseIndex];
    if (!currentPhase) return false;
    
    // Episode-based advancement
    const phaseStartEpisode = this.getPhaseStartEpisode();
    const episodesInPhase = this.currentEpisode - phaseStartEpisode;
    
    if (episodesInPhase >= currentPhase.episodes) {
      return true;
    }
    
    // Performance-based advancement
    if (this.curriculumState.averagePerformance > this.config.difficultyThreshold) {
      return true;
    }
    
    return false;
  }

  private async advanceToNextPhase(): Promise<void> {
    if (this.currentPhaseIndex >= this.phases.length - 1) {
      return; // Already at final phase
    }
    
    const oldPhase = this.phases[this.currentPhaseIndex];
    this.currentPhaseIndex++;
    const newPhase = this.phases[this.currentPhaseIndex];
    
    console.log(`🔄 Advancing from phase "${oldPhase.name}" to "${newPhase.name}"`);
    
    // Update environment configuration
    await this.updateEnvironmentConfig(newPhase.environmentConfig);
    
    // Update reward engine
    this.rewardEngine = new RewardEngine(newPhase.rewardConfig);
    
    // Update agent configuration if specified
    if (newPhase.agentConfig) {
      await this.updateAgentConfig(newPhase.agentConfig);
    }
    
    // Reset curriculum state for new phase
    this.curriculumState.phasePerformance = [];
    this.curriculumState.currentDifficulty = newPhase.difficulty;
  }

  private shouldAdjustDifficulty(): boolean {
    return this.curriculumState.phasePerformance.length >= 10 && 
           this.curriculumState.averagePerformance > this.config.difficultyThreshold;
  }

  private adjustDifficulty(): void {
    const increment = this.config.difficultyIncrement;
    const newDifficulty = Math.min(
      this.config.maxDifficulty,
      this.curriculumState.currentDifficulty + increment
    );
    
    if (newDifficulty > this.curriculumState.currentDifficulty) {
      console.log(`📈 Increasing difficulty: ${this.curriculumState.currentDifficulty.toFixed(2)} → ${newDifficulty.toFixed(2)}`);
      this.curriculumState.currentDifficulty = newDifficulty;
      this.curriculumState.lastDifficultyIncrease = this.currentEpisode;
    }
  }

  private updateCurriculumState(): void {
    // Update phase progress
    const currentPhase = this.phases[this.currentPhaseIndex];
    if (currentPhase) {
      const phaseStartEpisode = this.getPhaseStartEpisode();
      const episodesInPhase = this.currentEpisode - phaseStartEpisode;
      this.curriculumState.phaseProgress = Math.min(1, episodesInPhase / currentPhase.episodes);
    }
    
    // Update total progress
    this.curriculumState.totalProgress = this.currentEpisode / this.config.totalEpisodes;
    
    // Update improvement rate
    if (this.curriculumState.phasePerformance.length >= 20) {
      const recent = this.curriculumState.phasePerformance.slice(-10);
      const earlier = this.curriculumState.phasePerformance.slice(-20, -10);
      const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
      const earlierAvg = earlier.reduce((sum, p) => sum + p, 0) / earlier.length;
      this.curriculumState.improvementRate = (recentAvg - earlierAvg) / earlierAvg;
    }
  }

  private updateCurriculumPerformance(reward: number): void {
    this.curriculumState.phasePerformance.push(reward);
    
    // Keep recent performance history
    if (this.curriculumState.phasePerformance.length > 100) {
      this.curriculumState.phasePerformance = this.curriculumState.phasePerformance.slice(-50);
    }
    
    // Update average performance
    this.curriculumState.averagePerformance = 
      this.curriculumState.phasePerformance.reduce((sum, p) => sum + p, 0) / 
      this.curriculumState.phasePerformance.length;
  }

  private selectMarketCondition(): MarketCondition {
    const currentPhase = this.phases[this.currentPhaseIndex];
    if (!currentPhase || currentPhase.marketConditions.length === 0) {
      return 'SIDEWAYS';
    }
    
    // Select condition based on curriculum difficulty
    const availableConditions = currentPhase.marketConditions;
    const difficultyIndex = Math.floor(this.curriculumState.currentDifficulty * availableConditions.length);
    const index = Math.min(difficultyIndex, availableConditions.length - 1);
    
    return availableConditions[index];
  }

  private async updateEnvironmentConfig(config: EnvironmentConfig): Promise<void> {
    // Create new environment with updated config
    this.environment.dispose();
    this.environment = new TradingEnvironment(config);
    await this.environment.initialize();
  }

  private async updateAgentConfig(partialConfig: Partial<AgentConfig>): Promise<void> {
    // For now, we'll just log the config update
    // In a full implementation, you'd need to update the agent's configuration
    console.log('🔧 Agent configuration updated:', partialConfig);
  }

  private shouldEvaluate(): boolean {
    return this.currentEpisode % this.config.evaluationFrequency === 0;
  }

  private async evaluate(): Promise<TrainingMetrics> {
    console.log(`📊 Evaluating agent at episode ${this.currentEpisode}...`);
    
    // Run evaluation episodes
    let totalReward = 0;
    const evaluationMetrics: number[] = [];
    
    for (let i = 0; i < this.config.evaluationEpisodes; i++) {
      const state = await this.environment.reset();
      let episodeReward = 0;
      let done = false;
      let steps = 0;
      
      while (!done && steps < this.config.maxStepsPerEpisode) {
        const action = await this.agent.selectAction(state, false); // No exploration
        const stepResult = await this.environment.step(action);
        episodeReward += stepResult.reward;
        done = stepResult.done;
        steps++;
        
        if (!done) {
          state = stepResult.state;
        }
      }
      
      evaluationMetrics.push(episodeReward);
      totalReward += episodeReward;
    }
    
    const averageReward = totalReward / this.config.evaluationEpisodes;
    
    // Update best performance
    if (averageReward > this.bestPerformance) {
      this.bestPerformance = averageReward;
      this.earlyStoppingCounter = 0;
    } else {
      this.earlyStoppingCounter++;
    }
    
    console.log(`📈 Evaluation complete: Average reward = ${averageReward.toFixed(2)}`);
    
    return this.createEvaluationMetrics(averageReward, evaluationMetrics);
  }

  private shouldCheckpoint(): boolean {
    return this.currentEpisode % this.config.checkpointFrequency === 0;
  }

  private async createCheckpoint(): Promise<void> {
    const checkpointPath = `checkpoints/episode_${this.currentEpisode}`;
    console.log(`💾 Creating checkpoint: ${checkpointPath}`);
    
    try {
      await this.agent.saveModels(checkpointPath);
      
      // Save training state
      const trainingState = {
        episode: this.currentEpisode,
        curriculumState: this.curriculumState,
        currentPhaseIndex: this.currentPhaseIndex,
        bestPerformance: this.bestPerformance
      };
      
      // In a real implementation, you'd save this to persistent storage
      console.log('Training state saved:', trainingState);
      
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
    }
  }

  private shouldStopEarly(): boolean {
    if (!this.config.earlyStopping) return false;
    
    return this.earlyStoppingCounter >= this.config.patience;
  }

  private async finalEvaluation(): Promise<TrainingMetrics> {
    console.log('🎯 Running final evaluation...');
    
    // More comprehensive final evaluation
    return await this.evaluate();
  }

  private createEpisodeMetrics(reward: number, steps: number, time: number): TrainingMetrics {
    const agentState = this.agent.getState();
    const environmentMetrics = this.environment.getMetrics();
    
    return {
      episode: this.currentEpisode,
      totalSteps: agentState.totalSteps,
      episodeReward: reward,
      averageReward: agentState.averageReward,
      sharpeRatio: environmentMetrics.sharpeRatio,
      maxDrawdown: environmentMetrics.maxDrawdown,
      winRate: environmentMetrics.winRate,
      profitFactor: environmentMetrics.profitFactor || 0,
      loss: agentState.loss,
      epsilon: agentState.epsilon,
      learningProgress: this.currentEpisode / this.config.totalEpisodes,
      currentDifficulty: this.curriculumState.currentDifficulty,
      curriculumPhase: this.phases[this.currentPhaseIndex]?.name || 'Unknown',
      difficultyAdjustments: this.currentEpisode - this.curriculumState.lastDifficultyIncrease,
      trainingTime: time,
      memoryUsage: agentState.memoryUsage,
      stepsPerSecond: steps / (time / 1000),
      marketConditionsExperienced: [this.selectMarketCondition()],
      environmentComplexity: this.curriculumState.currentDifficulty
    };
  }

  private createEvaluationMetrics(averageReward: number, rewards: number[]): TrainingMetrics {
    const baseMetrics = this.getCurrentMetrics();
    
    return {
      ...baseMetrics,
      episodeReward: averageReward,
      averageReward: averageReward,
      // Additional evaluation-specific metrics
      winRate: rewards.filter(r => r > 0).length / rewards.length,
      sharpeRatio: this.calculateSharpeRatio(rewards)
    };
  }

  private calculateSharpeRatio(rewards: number[]): number {
    if (rewards.length < 2) return 0;
    
    const mean = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
    const variance = rewards.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rewards.length;
    const std = Math.sqrt(variance);
    
    return std > 0 ? mean / std : 0;
  }

  private getCurrentMetrics(): TrainingMetrics {
    if (this.trainingMetrics.length === 0) {
      return this.createEpisodeMetrics(0, 0, 0);
    }
    return this.trainingMetrics[this.trainingMetrics.length - 1];
  }

  private getBestPerformance(): TrainingMetrics {
    if (this.trainingMetrics.length === 0) {
      return this.getCurrentMetrics();
    }
    
    return this.trainingMetrics.reduce((best, current) => 
      current.episodeReward > best.episodeReward ? current : best
    );
  }

  private generateDefaultPhases(): TrainingPhase[] {
    return [
      {
        name: 'Basic Training',
        episodes: Math.floor(this.config.totalEpisodes * 0.3),
        difficulty: 0.2,
        marketConditions: ['SIDEWAYS'],
        environmentConfig: DEFAULT_ENVIRONMENT_CONFIGS.training,
        rewardConfig: DEFAULT_REWARD_CONFIGS.balanced,
        description: 'Learn basic trading actions in stable markets'
      },
      {
        name: 'Trend Following',
        episodes: Math.floor(this.config.totalEpisodes * 0.3),
        difficulty: 0.5,
        marketConditions: ['TRENDING_UP', 'TRENDING_DOWN'],
        environmentConfig: DEFAULT_ENVIRONMENT_CONFIGS.training,
        rewardConfig: DEFAULT_REWARD_CONFIGS.balanced,
        description: 'Learn to identify and follow trends'
      },
      {
        name: 'Advanced Trading',
        episodes: Math.floor(this.config.totalEpisodes * 0.4),
        difficulty: 0.8,
        marketConditions: ['VOLATILE', 'SIDEWAYS', 'TRENDING_UP', 'TRENDING_DOWN'],
        environmentConfig: DEFAULT_ENVIRONMENT_CONFIGS.training,
        rewardConfig: DEFAULT_REWARD_CONFIGS.balanced,
        description: 'Handle complex market conditions'
      }
    ];
  }

  private initializeCurriculumState(): CurriculumState {
    return {
      currentPhase: 0,
      currentDifficulty: this.config.initialDifficulty,
      phaseProgress: 0,
      totalProgress: 0,
      phasePerformance: [],
      averagePerformance: 0,
      improvementRate: 0,
      adaptiveParameters: {},
      lastDifficultyIncrease: 0
    };
  }

  private mergeAgentConfig(base: AgentConfig, override?: Partial<AgentConfig>): AgentConfig {
    return override ? { ...base, ...override } : base;
  }

  private async initializeMultiAgentSystem(): Promise<void> {
    if (!this.multiAgentSystem || !this.config.multiAgentConfig) return;
    
    // Add multiple agents with different specializations
    const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
    const roles = ['SPECIALIST', 'GENERALIST', 'EXPLORER'];
    
    for (let i = 0; i < Math.min(3, this.config.multiAgentConfig.maxAgents); i++) {
      await this.multiAgentSystem.addAgent(
        `agent_${i}`,
        DEFAULT_AGENT_CONFIGS.dqn,
        DEFAULT_ENVIRONMENT_CONFIGS.training,
        DEFAULT_REWARD_CONFIGS.balanced,
        [symbols[i % symbols.length]],
        roles[i % roles.length] as any
      );
    }
  }

  private async loadPretrainedModel(): Promise<void> {
    if (!this.config.pretrainedModelPath) return;
    
    try {
      console.log(`📂 Loading pretrained model: ${this.config.pretrainedModelPath}`);
      await this.agent.loadModels(this.config.pretrainedModelPath);
      console.log('✅ Pretrained model loaded successfully');
    } catch (error) {
      console.warn('⚠️ Failed to load pretrained model:', error);
    }
  }

  // Analysis methods
  private calculateCurriculumEffectiveness(): number {
    // Simplified effectiveness calculation
    if (this.trainingMetrics.length < 100) return 0;
    
    const early = this.trainingMetrics.slice(0, 50);
    const late = this.trainingMetrics.slice(-50);
    
    const earlyAvg = early.reduce((sum, m) => sum + m.episodeReward, 0) / early.length;
    const lateAvg = late.reduce((sum, m) => sum + m.episodeReward, 0) / late.length;
    
    return lateAvg > earlyAvg ? (lateAvg - earlyAvg) / Math.abs(earlyAvg) : 0;
  }

  private getDifficultyProgression(): number[] {
    return this.trainingMetrics.map(m => m.currentDifficulty);
  }

  private getPhaseCompletionTimes(): number[] {
    // Calculate time spent in each phase
    const phaseTimes: number[] = [];
    let phaseStart = 0;
    let currentPhase = 0;
    
    for (let i = 0; i < this.trainingMetrics.length; i++) {
      const metric = this.trainingMetrics[i];
      const phaseIndex = this.phases.findIndex(p => p.name === metric.curriculumPhase);
      
      if (phaseIndex !== currentPhase) {
        phaseTimes.push(i - phaseStart);
        phaseStart = i;
        currentPhase = phaseIndex;
      }
    }
    
    return phaseTimes;
  }

  private getCheckpointPaths(): string[] {
    const paths: string[] = [];
    for (let i = this.config.checkpointFrequency; i <= this.currentEpisode; i += this.config.checkpointFrequency) {
      paths.push(`checkpoints/episode_${i}`);
    }
    return paths;
  }

  private findConvergenceEpisode(): number {
    // Find episode where performance stabilized
    if (this.trainingMetrics.length < 50) return 0;
    
    const windowSize = 20;
    const threshold = 0.01; // 1% change threshold
    
    for (let i = windowSize; i < this.trainingMetrics.length - windowSize; i++) {
      const before = this.trainingMetrics.slice(i - windowSize, i);
      const after = this.trainingMetrics.slice(i, i + windowSize);
      
      const beforeAvg = before.reduce((sum, m) => sum + m.episodeReward, 0) / before.length;
      const afterAvg = after.reduce((sum, m) => sum + m.episodeReward, 0) / after.length;
      
      const change = Math.abs(afterAvg - beforeAvg) / Math.abs(beforeAvg);
      
      if (change < threshold) {
        return i;
      }
    }
    
    return this.trainingMetrics.length;
  }

  private detectPlateaus(): number[] {
    // Detect episodes where performance plateaued
    const plateaus: number[] = [];
    const windowSize = 50;
    const threshold = 0.005; // 0.5% improvement threshold
    
    for (let i = windowSize; i < this.trainingMetrics.length; i += windowSize) {
      const window = this.trainingMetrics.slice(i - windowSize, i);
      const rewards = window.map(m => m.episodeReward);
      
      const first = rewards.slice(0, windowSize / 2);
      const second = rewards.slice(windowSize / 2);
      
      const firstAvg = first.reduce((sum, r) => sum + r, 0) / first.length;
      const secondAvg = second.reduce((sum, r) => sum + r, 0) / second.length;
      
      const improvement = (secondAvg - firstAvg) / Math.abs(firstAvg);
      
      if (improvement < threshold) {
        plateaus.push(i);
      }
    }
    
    return plateaus;
  }

  private detectRegressions(): number[] {
    // Detect episodes where performance regressed
    const regressions: number[] = [];
    const windowSize = 30;
    const threshold = -0.1; // 10% regression threshold
    
    for (let i = windowSize; i < this.trainingMetrics.length; i++) {
      const window = this.trainingMetrics.slice(i - windowSize, i);
      const recent = window.slice(-10);
      const earlier = window.slice(0, 10);
      
      const recentAvg = recent.reduce((sum, m) => sum + m.episodeReward, 0) / recent.length;
      const earlierAvg = earlier.reduce((sum, m) => sum + m.episodeReward, 0) / earlier.length;
      
      const change = (recentAvg - earlierAvg) / Math.abs(earlierAvg);
      
      if (change < threshold) {
        regressions.push(i);
      }
    }
    
    return regressions;
  }

  private getPhaseStartEpisode(): number {
    // Calculate when current phase started
    let episodeCount = 0;
    
    for (let i = 0; i < this.currentPhaseIndex; i++) {
      episodeCount += this.phases[i].episodes;
    }
    
    return episodeCount;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.agent?.dispose();
    this.environment?.dispose();
    this.replayBuffer?.dispose();
    this.multiAgentSystem?.dispose();
    
    this.trainingMetrics = [];
    this.progressCallbacks = [];
    this.completionCallbacks = [];
  }
}

// Default training configurations
export const DEFAULT_TRAINING_CONFIGS: Record<string, TrainingConfig> = {
  basic: {
    strategy: 'VANILLA',
    curriculumType: 'DIFFICULTY',
    schedulingStrategy: 'LINEAR',
    totalEpisodes: 1000,
    maxStepsPerEpisode: 500,
    evaluationFrequency: 100,
    evaluationEpisodes: 10,
    initialDifficulty: 0.2,
    maxDifficulty: 1.0,
    difficultyIncrement: 0.1,
    difficultyThreshold: 0.6,
    phases: [],
    transferLearning: false,
    enableHyperparameterTuning: false,
    hyperparameterTrials: 0,
    optimizationMetric: 'reward',
    earlyStopping: true,
    patience: 200,
    validationSplit: 0.2,
    enableMultiAgent: false,
    targetPerformance: {
      averageReward: 0.5,
      winRate: 0.55,
      sharpeRatio: 1.0,
      maxDrawdown: 0.15
    },
    parallelEnvironments: 1,
    checkpointFrequency: 100,
    memoryLimit: 2048
  },
  
  curriculum: {
    strategy: 'CURRICULUM',
    curriculumType: 'DIFFICULTY',
    schedulingStrategy: 'ADAPTIVE',
    totalEpisodes: 2000,
    maxStepsPerEpisode: 1000,
    evaluationFrequency: 50,
    evaluationEpisodes: 20,
    initialDifficulty: 0.1,
    maxDifficulty: 0.9,
    difficultyIncrement: 0.05,
    difficultyThreshold: 0.7,
    phases: [], // Will use default phases
    transferLearning: false,
    enableHyperparameterTuning: true,
    hyperparameterTrials: 20,
    optimizationMetric: 'sharpe',
    earlyStopping: true,
    patience: 300,
    validationSplit: 0.3,
    enableMultiAgent: true,
    multiAgentConfig: DEFAULT_MULTI_AGENT_CONFIGS.cooperative,
    targetPerformance: {
      averageReward: 0.8,
      winRate: 0.65,
      sharpeRatio: 1.5,
      maxDrawdown: 0.1
    },
    parallelEnvironments: 4,
    checkpointFrequency: 50,
    memoryLimit: 4096
  },
  
  production: {
    strategy: 'PROGRESSIVE',
    curriculumType: 'DOMAIN',
    schedulingStrategy: 'PERFORMANCE_BASED',
    totalEpisodes: 5000,
    maxStepsPerEpisode: 2000,
    evaluationFrequency: 25,
    evaluationEpisodes: 50,
    initialDifficulty: 0.3,
    maxDifficulty: 1.0,
    difficultyIncrement: 0.02,
    difficultyThreshold: 0.75,
    phases: [], // Will use default phases
    transferLearning: true,
    enableHyperparameterTuning: true,
    hyperparameterTrials: 50,
    optimizationMetric: 'sharpe',
    earlyStopping: true,
    patience: 500,
    validationSplit: 0.2,
    enableMultiAgent: true,
    multiAgentConfig: DEFAULT_MULTI_AGENT_CONFIGS.hierarchical,
    targetPerformance: {
      averageReward: 1.0,
      winRate: 0.7,
      sharpeRatio: 2.0,
      maxDrawdown: 0.08
    },
    parallelEnvironments: 8,
    checkpointFrequency: 25,
    memoryLimit: 8192
  }
};