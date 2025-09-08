/**
 * Reinforcement Learning System - Main Export File
 * 
 * Comprehensive RL system for trading with multiple algorithms,
 * sophisticated reward engineering, and advanced training strategies.
 */

// Core RL components
export { 
  TradingEnvironment, 
  type EnvironmentState, 
  type Action, 
  type ActionType, 
  type MarketCondition,
  type EnvironmentConfig,
  DEFAULT_ENVIRONMENT_CONFIGS 
} from './TradingEnvironment';

export { 
  RewardEngine, 
  type RewardConfig, 
  type RewardComponents, 
  type RewardType,
  type RiskMeasure,
  DEFAULT_REWARD_CONFIGS 
} from './RewardEngine';

export { 
  ExperienceReplay, 
  type Experience, 
  type ReplayConfig,
  type SamplingStrategy,
  type SamplingResult,
  DEFAULT_REPLAY_CONFIGS 
} from './ExperienceReplay';

export { 
  RLAgent, 
  type AgentConfig, 
  type AgentState,
  type TrainingResult as AgentTrainingResult,
  type RLAlgorithm,
  type ExplorationStrategy,
  DEFAULT_AGENT_CONFIGS 
} from './RLAgent';

export { 
  MultiAgentSystem, 
  type MultiAgentConfig,
  type CoordinationStrategy,
  type AgentRole,
  type SystemMetrics,
  DEFAULT_MULTI_AGENT_CONFIGS 
} from './MultiAgentSystem';

export { 
  RLTrainer, 
  type TrainingConfig,
  type TrainingPhase,
  type TrainingMetrics,
  type TrainingResult,
  type TrainingStrategy,
  type CurriculumType,
  DEFAULT_TRAINING_CONFIGS 
} from './RLTrainer';

// Convenience factory functions
export const createTradingRLSystem = async (config?: {
  algorithm?: 'DQN' | 'PPO' | 'SAC';
  symbols?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  multiAgent?: boolean;
}) => {
  const {
    algorithm = 'DQN',
    symbols = ['BTC-USD'],
    difficulty = 'medium',
    multiAgent = false
  } = config || {};

  // Select configurations based on difficulty
  const difficultyConfigs = {
    easy: {
      environment: DEFAULT_ENVIRONMENT_CONFIGS.testing,
      reward: DEFAULT_REWARD_CONFIGS.conservative,
      training: DEFAULT_TRAINING_CONFIGS.basic
    },
    medium: {
      environment: DEFAULT_ENVIRONMENT_CONFIGS.training,
      reward: DEFAULT_REWARD_CONFIGS.balanced,
      training: DEFAULT_TRAINING_CONFIGS.curriculum
    },
    hard: {
      environment: DEFAULT_ENVIRONMENT_CONFIGS.training,
      reward: DEFAULT_REWARD_CONFIGS.aggressive,
      training: DEFAULT_TRAINING_CONFIGS.production
    }
  };

  const configs = difficultyConfigs[difficulty];

  // Create environment
  const environment = new TradingEnvironment({
    ...configs.environment,
    symbols
  });
  await environment.initialize();

  // Create reward engine
  const rewardEngine = new RewardEngine(configs.reward);

  // Create experience replay
  const replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.standard);

  // Create agent
  const agentConfig = algorithm === 'PPO' ? 
    DEFAULT_AGENT_CONFIGS.ppo : 
    DEFAULT_AGENT_CONFIGS.dqn;
    
  const agent = new RLAgent(agentConfig, replayBuffer);
  await agent.initialize();

  // Create trainer
  const trainer = new RLTrainer({
    ...configs.training,
    enableMultiAgent: multiAgent
  });
  await trainer.initialize();

  return {
    environment,
    rewardEngine,
    replayBuffer,
    agent,
    trainer,
    
    // Convenience methods
    train: async (episodes?: number) => {
      const trainingConfig = { ...configs.training };
      if (episodes) trainingConfig.totalEpisodes = episodes;
      
      const trainerWithConfig = new RLTrainer(trainingConfig);
      await trainerWithConfig.initialize();
      return await trainerWithConfig.train();
    },
    
    evaluate: async (episodes: number = 10) => {
      let totalReward = 0;
      const rewards: number[] = [];
      
      for (let i = 0; i < episodes; i++) {
        const state = await environment.reset();
        let episodeReward = 0;
        let done = false;
        let steps = 0;
        
        while (!done && steps < 1000) {
          const action = await agent.selectAction(state, false);
          const result = await environment.step(action);
          episodeReward += result.reward;
          done = result.done;
          steps++;
          
          if (!done) {
            Object.assign(state, result.state);
          }
        }
        
        rewards.push(episodeReward);
        totalReward += episodeReward;
      }
      
      const averageReward = totalReward / episodes;
      const winRate = rewards.filter(r => r > 0).length / episodes;
      const sharpeRatio = rewards.length > 1 ? 
        averageReward / Math.sqrt(rewards.reduce((sum, r) => sum + (r - averageReward) ** 2, 0) / rewards.length) : 0;
      
      return {
        averageReward,
        winRate,
        sharpeRatio,
        totalReward,
        episodes,
        rewards
      };
    },
    
    dispose: () => {
      environment.dispose();
      replayBuffer.dispose();
      agent.dispose();
      trainer.dispose();
    }
  };
};

// Quick start function for basic RL trading
export const quickStartRLTrading = async (symbols: string[] = ['BTC-USD']) => {
  console.log('🚀 Quick starting RL trading system...');
  
  const system = await createTradingRLSystem({
    algorithm: 'DQN',
    symbols,
    difficulty: 'medium',
    multiAgent: false
  });
  
  console.log('✅ RL trading system ready!');
  return system;
};

// Advanced multi-agent setup
export const createMultiAgentTradingSystem = async (
  symbols: string[] = ['BTC-USD', 'ETH-USD', 'SOL-USD']
) => {
  console.log('🤖 Creating multi-agent trading system...');
  
  const system = new MultiAgentSystem(DEFAULT_MULTI_AGENT_CONFIGS.cooperative);
  
  // Add specialized agents for each symbol
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    await system.addAgent(
      `${symbol}_agent`,
      DEFAULT_AGENT_CONFIGS.dqn,
      { ...DEFAULT_ENVIRONMENT_CONFIGS.training, symbols: [symbol] },
      DEFAULT_REWARD_CONFIGS.balanced,
      [symbol],
      'SPECIALIST'
    );
  }
  
  // Add a coordinator agent
  await system.addAgent(
    'coordinator',
    DEFAULT_AGENT_CONFIGS.ppo,
    { ...DEFAULT_ENVIRONMENT_CONFIGS.training, symbols },
    DEFAULT_REWARD_CONFIGS.balanced,
    symbols,
    'COORDINATOR'
  );
  
  console.log(`✅ Multi-agent system ready with ${symbols.length + 1} agents!`);
  
  return {
    system,
    train: async (episodes: number = 1000) => {
      console.log(`🎯 Training multi-agent system for ${episodes} episodes...`);
      await system.train(episodes);
      console.log('✅ Multi-agent training completed!');
    },
    getPerformance: () => system.getSystemMetrics(),
    getAgentComparison: () => system.getAgentComparison(),
    dispose: () => system.dispose()
  };
};

// Performance benchmarking utility
export const benchmarkRLAlgorithms = async (
  algorithms: ('DQN' | 'PPO' | 'SAC')[] = ['DQN', 'PPO'],
  symbols: string[] = ['BTC-USD'],
  episodes: number = 100
) => {
  console.log(`📊 Benchmarking RL algorithms: ${algorithms.join(', ')}`);
  
  const results: Record<string, any> = {};
  
  for (const algorithm of algorithms) {
    console.log(`🧪 Testing ${algorithm}...`);
    
    const system = await createTradingRLSystem({
      algorithm,
      symbols,
      difficulty: 'medium'
    });
    
    // Quick training
    const trainingResult = await system.train(episodes);
    
    // Evaluation
    const evaluation = await system.evaluate(20);
    
    results[algorithm] = {
      training: trainingResult,
      evaluation,
      performance: {
        convergenceEpisode: trainingResult.convergenceEpisode,
        finalReward: trainingResult.finalPerformance.episodeReward,
        bestReward: trainingResult.bestPerformance.episodeReward,
        sharpeRatio: evaluation.sharpeRatio,
        winRate: evaluation.winRate
      }
    };
    
    system.dispose();
  }
  
  console.log('✅ Benchmarking completed!');
  
  // Find best performing algorithm
  const bestAlgorithm = Object.entries(results)
    .sort(([,a], [,b]) => b.evaluation.sharpeRatio - a.evaluation.sharpeRatio)[0][0];
  
  console.log(`🏆 Best performing algorithm: ${bestAlgorithm}`);
  
  return {
    results,
    bestAlgorithm,
    summary: Object.entries(results).map(([algo, data]) => ({
      algorithm: algo,
      sharpeRatio: data.evaluation.sharpeRatio,
      winRate: data.evaluation.winRate,
      finalReward: data.performance.finalReward
    }))
  };
};

// Export default factory function
export default createTradingRLSystem;

/**
 * Usage Examples:
 * 
 * // Quick start
 * const system = await quickStartRLTrading(['BTC-USD', 'ETH-USD']);
 * const trainingResult = await system.train(1000);
 * const evaluation = await system.evaluate(50);
 * 
 * // Custom system
 * const customSystem = await createTradingRLSystem({
 *   algorithm: 'PPO',
 *   symbols: ['BTC-USD'],
 *   difficulty: 'hard',
 *   multiAgent: false
 * });
 * 
 * // Multi-agent system
 * const multiAgent = await createMultiAgentTradingSystem(['BTC-USD', 'ETH-USD', 'SOL-USD']);
 * await multiAgent.train(2000);
 * const performance = multiAgent.getPerformance();
 * 
 * // Algorithm comparison
 * const benchmark = await benchmarkRLAlgorithms(['DQN', 'PPO'], ['BTC-USD'], 500);
 * console.log(benchmark.summary);
 */