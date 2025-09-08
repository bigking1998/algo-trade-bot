/**
 * RL System Integration Tests
 * 
 * Comprehensive tests to validate the reinforcement learning system
 * components work together correctly and meet performance targets.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  TradingEnvironment,
  RewardEngine,
  ExperienceReplay,
  RLAgent,
  MultiAgentSystem,
  RLTrainer,
  DEFAULT_ENVIRONMENT_CONFIGS,
  DEFAULT_REWARD_CONFIGS,
  DEFAULT_REPLAY_CONFIGS,
  DEFAULT_AGENT_CONFIGS,
  DEFAULT_MULTI_AGENT_CONFIGS,
  DEFAULT_TRAINING_CONFIGS,
  createTradingRLSystem,
  quickStartRLTrading
} from './index';

describe('RL System Integration Tests', () => {
  let cleanup: (() => void)[] = [];

  afterEach(() => {
    // Clean up all resources
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  describe('Core Components', () => {
    test('TradingEnvironment should initialize and run episodes', async () => {
      const environment = new TradingEnvironment(DEFAULT_ENVIRONMENT_CONFIGS.testing);
      cleanup.push(() => environment.dispose());

      await environment.initialize();
      
      const initialState = await environment.reset();
      expect(initialState).toBeDefined();
      expect(initialState.marketFeatures).toBeInstanceOf(Float32Array);
      expect(initialState.portfolioState).toBeInstanceOf(Float32Array);
      expect(initialState.cash).toBeGreaterThan(0);
      
      // Test a single step
      const action = {
        type: 'HOLD' as const,
        size: 0
      };
      
      const result = await environment.step(action);
      expect(result.state).toBeDefined();
      expect(typeof result.reward).toBe('number');
      expect(typeof result.done).toBe('boolean');
    });

    test('RewardEngine should calculate rewards correctly', () => {
      const rewardEngine = new RewardEngine(DEFAULT_REWARD_CONFIGS.balanced);
      
      const prevState = {
        marketFeatures: new Float32Array(50),
        portfolioState: new Float32Array(10),
        riskMetrics: new Float32Array(5),
        timeFeatures: new Float32Array(5),
        condition: 'SIDEWAYS' as const,
        volatility: 0.1,
        trendStrength: 0.05,
        positions: new Map(),
        cash: 10000,
        equity: 10000,
        drawdown: 0,
        timestamp: new Date(),
        stepCount: 0,
        episodeLength: 1000
      };

      const newState = {
        ...prevState,
        equity: 10100, // 1% gain
        stepCount: 1
      };

      const action = { type: 'BUY' as const, size: 0.1 };
      const executionResult = { success: true, commission: 1, slippage: 0.001 };

      const reward = rewardEngine.calculateReward(action, prevState, newState, executionResult);
      
      expect(reward).toBeDefined();
      expect(reward.totalReward).toBeTypeOf('number');
      expect(reward.baseReward).toBeGreaterThan(0); // Should be positive for profit
      expect(reward.explanation).toBeTypeOf('string');
    });

    test('ExperienceReplay should store and sample experiences', () => {
      const replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.standard);
      cleanup.push(() => replayBuffer.dispose());

      // Add some experiences
      for (let i = 0; i < 100; i++) {
        const experience = {
          state: {
            marketFeatures: new Float32Array(50),
            portfolioState: new Float32Array(10),
            riskMetrics: new Float32Array(5),
            timeFeatures: new Float32Array(5),
            condition: 'SIDEWAYS' as const,
            volatility: 0.1,
            trendStrength: 0,
            positions: new Map(),
            cash: 10000,
            equity: 10000,
            drawdown: 0,
            timestamp: new Date(),
            stepCount: i,
            episodeLength: 1000
          },
          action: { type: 'HOLD' as const, size: 0 },
          reward: Math.random() - 0.5,
          nextState: {
            marketFeatures: new Float32Array(50),
            portfolioState: new Float32Array(10),
            riskMetrics: new Float32Array(5),
            timeFeatures: new Float32Array(5),
            condition: 'SIDEWAYS' as const,
            volatility: 0.1,
            trendStrength: 0,
            positions: new Map(),
            cash: 10000,
            equity: 10000,
            drawdown: 0,
            timestamp: new Date(),
            stepCount: i + 1,
            episodeLength: 1000
          },
          done: false,
          timestamp: new Date(),
          episodeId: 'test_episode',
          stepInEpisode: i,
          priority: Math.random(),
          tdError: 0,
          stateSignature: `state_${i}`,
          actionFrequency: 0,
          novelty: 0,
          predictionError: 0
        };

        replayBuffer.add(experience);
      }

      expect(replayBuffer.size()).toBe(100);
      expect(replayBuffer.canSample()).toBe(true);

      const sample = replayBuffer.sample();
      expect(sample).toBeDefined();
      expect(sample!.experiences).toHaveLength(DEFAULT_REPLAY_CONFIGS.standard.batchSize);
      expect(sample!.weights).toBeInstanceOf(Float32Array);
    });

    test('RLAgent should initialize and select actions', async () => {
      const replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.fast);
      cleanup.push(() => replayBuffer.dispose());

      const agent = new RLAgent(DEFAULT_AGENT_CONFIGS.dqn, replayBuffer);
      cleanup.push(() => agent.dispose());

      await agent.initialize();

      const state = {
        marketFeatures: new Float32Array(100),
        portfolioState: new Float32Array(20),
        riskMetrics: new Float32Array(10),
        timeFeatures: new Float32Array(10),
        condition: 'SIDEWAYS' as const,
        volatility: 0.1,
        trendStrength: 0,
        positions: new Map(),
        cash: 10000,
        equity: 10000,
        drawdown: 0,
        timestamp: new Date(),
        stepCount: 0,
        episodeLength: 1000
      };

      const action = await agent.selectAction(state, true);
      expect(action).toBeDefined();
      expect(action.type).toMatch(/^(BUY|SELL|HOLD|CLOSE_LONG|CLOSE_SHORT)$/);
      expect(action.size).toBeGreaterThanOrEqual(0);

      const agentState = agent.getState();
      expect(agentState.episode).toBe(0);
      expect(agentState.epsilon).toBeGreaterThan(0);
    });
  });

  describe('System Integration', () => {
    test('Complete RL system should work end-to-end', async () => {
      const system = await createTradingRLSystem({
        algorithm: 'DQN',
        symbols: ['BTC-USD'],
        difficulty: 'easy'
      });

      cleanup.push(() => system.dispose());

      // Test basic functionality
      expect(system.environment).toBeDefined();
      expect(system.agent).toBeDefined();
      expect(system.trainer).toBeDefined();

      // Test evaluation
      const evaluation = await system.evaluate(5);
      expect(evaluation.averageReward).toBeTypeOf('number');
      expect(evaluation.winRate).toBeGreaterThanOrEqual(0);
      expect(evaluation.winRate).toBeLessThanOrEqual(1);
      expect(evaluation.episodes).toBe(5);
      expect(evaluation.rewards).toHaveLength(5);
    });

    test('Quick start system should initialize correctly', async () => {
      const system = await quickStartRLTrading(['BTC-USD']);
      cleanup.push(() => system.dispose());

      expect(system).toBeDefined();
      expect(system.environment).toBeDefined();
      expect(system.agent).toBeDefined();

      // Run a few steps to ensure everything works
      const evaluation = await system.evaluate(3);
      expect(evaluation).toBeDefined();
      expect(evaluation.episodes).toBe(3);
    });

    test('Multi-agent system should coordinate multiple agents', async () => {
      const multiAgentSystem = new MultiAgentSystem(DEFAULT_MULTI_AGENT_CONFIGS.cooperative);
      cleanup.push(() => multiAgentSystem.dispose());

      // Add two agents
      await multiAgentSystem.addAgent(
        'agent1',
        DEFAULT_AGENT_CONFIGS.dqn,
        DEFAULT_ENVIRONMENT_CONFIGS.testing,
        DEFAULT_REWARD_CONFIGS.balanced,
        ['BTC-USD'],
        'SPECIALIST'
      );

      await multiAgentSystem.addAgent(
        'agent2',
        DEFAULT_AGENT_CONFIGS.dqn,
        DEFAULT_ENVIRONMENT_CONFIGS.testing,
        DEFAULT_REWARD_CONFIGS.balanced,
        ['ETH-USD'],
        'SPECIALIST'
      );

      const metrics = multiAgentSystem.getSystemMetrics();
      expect(metrics.totalAgents).toBe(2);
      expect(metrics.activeAgents).toBe(2);

      // Test one coordination step
      const results = await multiAgentSystem.step();
      expect(results.size).toBe(2);
      expect(results.has('agent1')).toBe(true);
      expect(results.has('agent2')).toBe(true);
    });

    test('Training system should complete short training runs', async () => {
      const trainer = new RLTrainer({
        ...DEFAULT_TRAINING_CONFIGS.basic,
        totalEpisodes: 10, // Very short for testing
        evaluationFrequency: 5,
        checkpointFrequency: 10
      });

      cleanup.push(() => trainer.dispose());

      await trainer.initialize();

      const result = await trainer.train();
      
      expect(result.success).toBe(true);
      expect(result.trainingHistory).toBeDefined();
      expect(result.trainingHistory.length).toBeGreaterThan(0);
      expect(result.finalPerformance).toBeDefined();
      expect(result.bestPerformance).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    test('Environment should meet performance targets', async () => {
      const environment = new TradingEnvironment(DEFAULT_ENVIRONMENT_CONFIGS.testing);
      cleanup.push(() => environment.dispose());

      await environment.initialize();

      const startTime = performance.now();
      
      // Run 100 steps
      await environment.reset();
      for (let i = 0; i < 100; i++) {
        const action = { type: 'HOLD' as const, size: 0 };
        await environment.step(action);
      }
      
      const totalTime = performance.now() - startTime;
      const stepsPerSecond = 100 / (totalTime / 1000);
      
      // Should process at least 50 steps per second
      expect(stepsPerSecond).toBeGreaterThan(50);
    });

    test('Agent action selection should be fast', async () => {
      const replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.fast);
      cleanup.push(() => replayBuffer.dispose());

      const agent = new RLAgent(DEFAULT_AGENT_CONFIGS.dqn, replayBuffer);
      cleanup.push(() => agent.dispose());

      await agent.initialize();

      const state = {
        marketFeatures: new Float32Array(100),
        portfolioState: new Float32Array(20),
        riskMetrics: new Float32Array(10),
        timeFeatures: new Float32Array(10),
        condition: 'SIDEWAYS' as const,
        volatility: 0.1,
        trendStrength: 0,
        positions: new Map(),
        cash: 10000,
        equity: 10000,
        drawdown: 0,
        timestamp: new Date(),
        stepCount: 0,
        episodeLength: 1000
      };

      const startTime = performance.now();
      
      // Select 100 actions
      for (let i = 0; i < 100; i++) {
        await agent.selectAction(state, false);
      }
      
      const totalTime = performance.now() - startTime;
      const actionsPerSecond = 100 / (totalTime / 1000);
      
      // Should select at least 20 actions per second (target: 50ms per action)
      expect(actionsPerSecond).toBeGreaterThan(20);
    });

    test('Memory usage should be reasonable', async () => {
      const system = await createTradingRLSystem({
        algorithm: 'DQN',
        symbols: ['BTC-USD'],
        difficulty: 'easy'
      });

      cleanup.push(() => system.dispose());

      // Add some experiences to replay buffer
      for (let i = 0; i < 1000; i++) {
        const state = await system.environment.reset();
        const action = await system.agent.selectAction(state, true);
        await system.environment.step(action);
      }

      // Memory usage should be reasonable (this is a rough check)
      const agentState = system.agent.getState();
      expect(agentState.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB limit
    });
  });

  describe('Error Handling', () => {
    test('System should handle invalid configurations gracefully', async () => {
      // Test with invalid environment config
      expect(async () => {
        const environment = new TradingEnvironment({
          ...DEFAULT_ENVIRONMENT_CONFIGS.testing,
          initialCapital: -1000 // Invalid
        });
        await environment.initialize();
      }).rejects.toThrow();
    });

    test('Agent should handle invalid states gracefully', async () => {
      const replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.fast);
      cleanup.push(() => replayBuffer.dispose());

      const agent = new RLAgent(DEFAULT_AGENT_CONFIGS.dqn, replayBuffer);
      cleanup.push(() => agent.dispose());

      await agent.initialize();

      // Test with malformed state
      const invalidState = {
        marketFeatures: new Float32Array(50), // Wrong size
        portfolioState: new Float32Array(20),
        riskMetrics: new Float32Array(10),
        timeFeatures: new Float32Array(10),
        condition: 'SIDEWAYS' as const,
        volatility: 0.1,
        trendStrength: 0,
        positions: new Map(),
        cash: 10000,
        equity: 10000,
        drawdown: 0,
        timestamp: new Date(),
        stepCount: 0,
        episodeLength: 1000
      };

      // Should not throw, but handle gracefully
      const action = await agent.selectAction(invalidState, false);
      expect(action).toBeDefined();
    });
  });
});

describe('Performance Benchmarks', () => {
  test('System should meet convergence targets', async () => {
    // This is a longer-running test that validates the system can actually learn
    const trainer = new RLTrainer({
      ...DEFAULT_TRAINING_CONFIGS.basic,
      totalEpisodes: 100,
      evaluationFrequency: 20,
      targetPerformance: {
        averageReward: 0.1, // Lower target for testing
        winRate: 0.4,
        sharpeRatio: 0.5,
        maxDrawdown: 0.5
      }
    });

    await trainer.initialize();

    const result = await trainer.train();
    
    expect(result.success).toBe(true);
    
    // Check if there was some learning (improvement over time)
    const firstHalf = result.trainingHistory.slice(0, 50);
    const secondHalf = result.trainingHistory.slice(50);
    
    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.episodeReward, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.episodeReward, 0) / secondHalf.length;
    
    // There should be some improvement or at least no significant regression
    expect(secondHalfAvg).toBeGreaterThanOrEqual(firstHalfAvg - 0.1);
    
    trainer.dispose();
  }, 30000); // 30 second timeout for this test
});