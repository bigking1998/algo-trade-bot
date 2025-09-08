/**
 * MultiAgentSystem - Multi-Agent Portfolio Optimization System
 * 
 * Coordinates multiple RL agents for portfolio optimization across different assets,
 * implements cooperative and competitive learning, and manages agent communication.
 */

import { RLAgent, AgentConfig, TrainingResult } from './RLAgent';
import { TradingEnvironment, EnvironmentState, Action, MarketCondition } from './TradingEnvironment';
import { RewardEngine, RewardConfig } from './RewardEngine';
import { ExperienceReplay, DEFAULT_REPLAY_CONFIGS } from './ExperienceReplay';

export type CoordinationStrategy = 'INDEPENDENT' | 'COOPERATIVE' | 'COMPETITIVE' | 'HIERARCHICAL' | 'CONSENSUS';
export type AgentRole = 'SPECIALIST' | 'GENERALIST' | 'COORDINATOR' | 'EXPLORER' | 'EXPLOITER';
export type CommunicationProtocol = 'BROADCAST' | 'GOSSIP' | 'DIRECT' | 'HIERARCHICAL';

export interface MultiAgentConfig {
  // System architecture
  coordinationStrategy: CoordinationStrategy;
  communicationProtocol: CommunicationProtocol;
  maxAgents: number;
  
  // Agent specialization
  enableSpecialization: boolean;
  specializationThreshold: number; // Performance threshold for specialization
  
  // Portfolio optimization
  portfolioConstraints: {
    maxPositionPerAsset: number;
    maxTotalExposure: number;
    minDiversification: number;
    correlationLimit: number;
  };
  
  // Coordination parameters
  consensusThreshold: number; // For consensus-based decisions
  competitionWeight: number; // Balance between cooperation and competition
  informationSharing: {
    shareExperiences: boolean;
    shareRewards: boolean;
    shareModels: boolean;
    sharingFrequency: number; // Steps between sharing
  };
  
  // Learning coordination
  synchronousLearning: boolean;
  sharedReplayBuffer: boolean;
  crossAgentValidation: boolean;
  
  // Performance optimization
  parallelExecution: boolean;
  loadBalancing: boolean;
  adaptiveAllocation: boolean; // Adjust resources based on agent performance
}

export interface AgentSpecialization {
  symbol: string;
  marketConditions: MarketCondition[];
  timeframes: string[];
  strategies: string[];
  performanceHistory: number[];
  expertise: number; // 0-1 score
}

export interface PortfolioState {
  positions: Map<string, number>; // symbol -> position size
  weights: Map<string, number>; // symbol -> portfolio weight
  totalValue: number;
  cash: number;
  exposure: number;
  diversification: number;
  correlation: number[][];
  risk: {
    volatility: number;
    var95: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export interface AgentCommunication {
  senderId: string;
  recipientId: string | 'ALL';
  messageType: 'SIGNAL' | 'EXPERIENCE' | 'MODEL' | 'PERFORMANCE' | 'COORDINATION';
  payload: any;
  timestamp: Date;
  priority: number;
}

export interface SystemMetrics {
  totalAgents: number;
  activeAgents: number;
  averagePerformance: number;
  portfolioPerformance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    diversification: number;
  };
  
  // Coordination metrics
  coordinationEfficiency: number;
  consensusRate: number;
  communicationOverhead: number;
  
  // Resource utilization
  totalMemoryUsage: number;
  computationLoad: number;
  parallelizationEfficiency: number;
}

export class MultiAgentSystem {
  private config: MultiAgentConfig;
  private agents: Map<string, RLAgent> = new Map();
  private environments: Map<string, TradingEnvironment> = new Map();
  private rewardEngines: Map<string, RewardEngine> = new Map();
  private replayBuffers: Map<string, ExperienceReplay> = new Map();
  
  // Agent management
  private agentSpecializations: Map<string, AgentSpecialization> = new Map();
  private agentPerformance: Map<string, number[]> = new Map();
  private agentRoles: Map<string, AgentRole> = new Map();
  
  // Portfolio state
  private portfolioState: PortfolioState;
  private portfolioHistory: PortfolioState[] = [];
  
  // Communication system
  private messageQueue: AgentCommunication[] = [];
  private communicationHistory: AgentCommunication[] = [];
  
  // Coordination state
  private coordinatorAgent?: string;
  private currentConsensus?: any;
  private systemMetrics: SystemMetrics;
  
  // Shared resources
  private sharedReplayBuffer?: ExperienceReplay;
  private globalKnowledge: Map<string, any> = new Map();
  
  constructor(config: MultiAgentConfig) {
    this.config = config;
    this.portfolioState = this.initializePortfolioState();
    this.systemMetrics = this.initializeSystemMetrics();
    
    // Initialize shared replay buffer if configured
    if (config.sharedReplayBuffer) {
      this.sharedReplayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.standard);
    }
    
    console.log(`🤖 Multi-Agent System initialized: ${config.coordinationStrategy} coordination`);
  }

  /**
   * Add agent to the system
   */
  async addAgent(
    agentId: string,
    agentConfig: AgentConfig,
    environmentConfig: any,
    rewardConfig: RewardConfig,
    symbols: string[] = [],
    role: AgentRole = 'GENERALIST'
  ): Promise<void> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Maximum number of agents (${this.config.maxAgents}) reached`);
    }
    
    console.log(`➕ Adding agent ${agentId} with role ${role} for symbols: ${symbols.join(', ')}`);
    
    // Create environment for this agent
    const environment = new TradingEnvironment({
      ...environmentConfig,
      symbols: symbols.length > 0 ? symbols : environmentConfig.symbols
    });
    await environment.initialize();
    this.environments.set(agentId, environment);
    
    // Create reward engine
    const rewardEngine = new RewardEngine(rewardConfig);
    this.rewardEngines.set(agentId, rewardEngine);
    
    // Create replay buffer (or use shared one)
    let replayBuffer: ExperienceReplay;
    if (this.config.sharedReplayBuffer && this.sharedReplayBuffer) {
      replayBuffer = this.sharedReplayBuffer;
    } else {
      replayBuffer = new ExperienceReplay(DEFAULT_REPLAY_CONFIGS.standard);
    }
    this.replayBuffers.set(agentId, replayBuffer);
    
    // Create agent
    const agent = new RLAgent(agentConfig, replayBuffer);
    await agent.initialize();
    this.agents.set(agentId, agent);
    
    // Set agent role and specialization
    this.agentRoles.set(agentId, role);
    if (symbols.length > 0 && this.config.enableSpecialization) {
      this.agentSpecializations.set(agentId, {
        symbol: symbols[0], // Primary symbol
        marketConditions: ['TRENDING_UP', 'TRENDING_DOWN', 'SIDEWAYS'],
        timeframes: [environmentConfig.timeframe],
        strategies: [agentConfig.algorithm],
        performanceHistory: [],
        expertise: 0
      });
    }
    
    // Initialize performance tracking
    this.agentPerformance.set(agentId, []);
    
    // Update coordinator if using hierarchical coordination
    if (this.config.coordinationStrategy === 'HIERARCHICAL' && !this.coordinatorAgent) {
      this.coordinatorAgent = agentId;
      console.log(`👑 Agent ${agentId} assigned as coordinator`);
    }
    
    this.systemMetrics.totalAgents++;
    this.systemMetrics.activeAgents++;
  }

  /**
   * Remove agent from the system
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    console.log(`➖ Removing agent ${agentId}`);
    
    // Cleanup resources
    agent.dispose();
    this.agents.delete(agentId);
    
    const environment = this.environments.get(agentId);
    if (environment) {
      environment.dispose();
      this.environments.delete(agentId);
    }
    
    if (!this.config.sharedReplayBuffer) {
      const replayBuffer = this.replayBuffers.get(agentId);
      if (replayBuffer) {
        replayBuffer.dispose();
        this.replayBuffers.delete(agentId);
      }
    }
    
    // Cleanup tracking data
    this.rewardEngines.delete(agentId);
    this.agentSpecializations.delete(agentId);
    this.agentPerformance.delete(agentId);
    this.agentRoles.delete(agentId);
    
    // Reassign coordinator if needed
    if (this.coordinatorAgent === agentId) {
      this.selectNewCoordinator();
    }
    
    this.systemMetrics.totalAgents--;
    this.systemMetrics.activeAgents--;
  }

  /**
   * Execute one step for all agents
   */
  async step(): Promise<Map<string, TrainingResult>> {
    const results = new Map<string, TrainingResult>();
    
    // Get current market states for each agent
    const agentStates = new Map<string, EnvironmentState>();
    for (const [agentId, environment] of this.environments) {
      agentStates.set(agentId, environment.getState());
    }
    
    // Process communication messages
    await this.processCommunication();
    
    // Generate actions for each agent
    const agentActions = await this.generateActions(agentStates);
    
    // Coordinate actions if needed
    const coordinatedActions = await this.coordinateActions(agentActions, agentStates);
    
    // Execute actions and learn
    if (this.config.parallelExecution) {
      const promises = Array.from(coordinatedActions.entries()).map(([agentId, action]) =>
        this.executeAgentStep(agentId, action)
      );
      const stepResults = await Promise.all(promises);
      
      stepResults.forEach((result, index) => {
        const agentId = Array.from(coordinatedActions.keys())[index];
        if (result) results.set(agentId, result);
      });
    } else {
      for (const [agentId, action] of coordinatedActions) {
        const result = await this.executeAgentStep(agentId, action);
        if (result) results.set(agentId, result);
      }
    }
    
    // Update portfolio state
    this.updatePortfolioState();
    
    // Update system metrics
    this.updateSystemMetrics(results);
    
    // Share information if configured
    if (this.config.informationSharing.shareExperiences) {
      await this.shareInformation();
    }
    
    return results;
  }

  /**
   * Train all agents
   */
  async train(episodes: number): Promise<void> {
    console.log(`🎯 Starting multi-agent training for ${episodes} episodes...`);
    
    for (let episode = 0; episode < episodes; episode++) {
      console.log(`📈 Episode ${episode + 1}/${episodes}`);
      
      // Reset environments
      await this.resetEnvironments();
      
      let episodeComplete = false;
      const episodeResults: TrainingResult[] = [];
      
      while (!episodeComplete) {
        const stepResults = await this.step();
        
        // Check if any environment is done
        episodeComplete = await this.checkEpisodeComplete();
        
        // Train agents
        if (this.config.synchronousLearning) {
          await this.synchronizedLearning();
        } else {
          await this.asynchronousLearning();
        }
      }
      
      // Complete episode for all agents
      await this.completeEpisode(episode);
      
      // Adapt system if needed
      if (this.config.adaptiveAllocation) {
        await this.adaptSystem();
      }
      
      // Log progress
      if ((episode + 1) % 10 === 0) {
        console.log(`📊 Episode ${episode + 1}: Portfolio Performance = ${this.systemMetrics.portfolioPerformance.totalReturn.toFixed(4)}`);
      }
    }
    
    console.log('✅ Multi-agent training completed');
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get portfolio state
   */
  getPortfolioState(): PortfolioState {
    return { ...this.portfolioState };
  }

  /**
   * Get agent performance comparison
   */
  getAgentComparison(): Record<string, any> {
    const comparison: Record<string, any> = {};
    
    for (const [agentId, agent] of this.agents) {
      const state = agent.getState();
      const performance = this.agentPerformance.get(agentId) || [];
      const specialization = this.agentSpecializations.get(agentId);
      const role = this.agentRoles.get(agentId);
      
      comparison[agentId] = {
        role,
        performance: {
          averageReward: state.averageReward,
          winRate: state.winRate,
          sharpeRatio: state.sharpeRatio,
          totalEpisodes: state.episode
        },
        specialization,
        recentPerformance: performance.slice(-10),
        currentState: {
          epsilon: state.epsilon,
          explorationRate: state.explorationRate,
          memoryUsage: state.memoryUsage
        }
      };
    }
    
    return comparison;
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async generateActions(agentStates: Map<string, EnvironmentState>): Promise<Map<string, Action>> {
    const actions = new Map<string, Action>();
    
    for (const [agentId, state] of agentStates) {
      const agent = this.agents.get(agentId);
      if (agent) {
        const action = await agent.selectAction(state, true);
        actions.set(agentId, action);
      }
    }
    
    return actions;
  }

  private async coordinateActions(
    agentActions: Map<string, Action>,
    agentStates: Map<string, EnvironmentState>
  ): Promise<Map<string, Action>> {
    switch (this.config.coordinationStrategy) {
      case 'INDEPENDENT':
        return agentActions;
        
      case 'COOPERATIVE':
        return await this.cooperativeCoordination(agentActions, agentStates);
        
      case 'COMPETITIVE':
        return await this.competitiveCoordination(agentActions, agentStates);
        
      case 'HIERARCHICAL':
        return await this.hierarchicalCoordination(agentActions, agentStates);
        
      case 'CONSENSUS':
        return await this.consensusCoordination(agentActions, agentStates);
        
      default:
        return agentActions;
    }
  }

  private async cooperativeCoordination(
    agentActions: Map<string, Action>,
    agentStates: Map<string, EnvironmentState>
  ): Promise<Map<string, Action>> {
    // Implement cooperative coordination logic
    // For now, return original actions
    return agentActions;
  }

  private async competitiveCoordination(
    agentActions: Map<string, Action>,
    agentStates: Map<string, EnvironmentState>
  ): Promise<Map<string, Action>> {
    // Implement competitive coordination logic
    // For now, return original actions
    return agentActions;
  }

  private async hierarchicalCoordination(
    agentActions: Map<string, Action>,
    agentStates: Map<string, EnvironmentState>
  ): Promise<Map<string, Action>> {
    // Coordinator agent makes final decisions
    if (!this.coordinatorAgent) {
      return agentActions;
    }
    
    const coordinatedActions = new Map<string, Action>();
    
    // Coordinator reviews and potentially overrides actions
    for (const [agentId, action] of agentActions) {
      // Simplified coordination logic
      const portfolioExposure = this.calculateExposure(action);
      
      if (portfolioExposure > this.config.portfolioConstraints.maxTotalExposure) {
        // Reduce action size
        const adjustedAction: Action = {
          ...action,
          size: action.size * 0.5
        };
        coordinatedActions.set(agentId, adjustedAction);
      } else {
        coordinatedActions.set(agentId, action);
      }
    }
    
    return coordinatedActions;
  }

  private async consensusCoordination(
    agentActions: Map<string, Action>,
    agentStates: Map<string, EnvironmentState>
  ): Promise<Map<string, Action>> {
    // Implement consensus-based coordination
    // For now, return original actions
    return agentActions;
  }

  private async executeAgentStep(agentId: string, action: Action): Promise<TrainingResult | null> {
    const environment = this.environments.get(agentId);
    const agent = this.agents.get(agentId);
    const rewardEngine = this.rewardEngines.get(agentId);
    
    if (!environment || !agent || !rewardEngine) {
      return null;
    }
    
    try {
      const prevState = environment.getState();
      const stepResult = await environment.step(action);
      const { state: newState, reward: envReward, done, info } = stepResult;
      
      // Calculate enhanced reward
      const rewardComponents = rewardEngine.calculateReward(action, prevState, newState, info.execution);
      const totalReward = rewardComponents.totalReward;
      
      // Add experience to replay buffer
      const replayBuffer = this.replayBuffers.get(agentId);
      if (replayBuffer) {
        replayBuffer.add({
          state: prevState,
          action,
          reward: totalReward,
          nextState: newState,
          done,
          timestamp: new Date(),
          episodeId: `${agentId}-${agent.getState().episode}`,
          stepInEpisode: newState.stepCount,
          priority: Math.abs(totalReward),
          tdError: 0,
          stateSignature: '',
          actionFrequency: 0,
          novelty: 0,
          predictionError: 0
        });
      }
      
      // Learn from experience
      const loss = await agent.learn();
      
      // Update agent performance
      const performance = this.agentPerformance.get(agentId) || [];
      performance.push(totalReward);
      if (performance.length > 1000) {
        performance.splice(0, 500); // Keep recent 1000 rewards
      }
      this.agentPerformance.set(agentId, performance);
      
      // Update specialization if enabled
      if (this.config.enableSpecialization) {
        this.updateAgentSpecialization(agentId, totalReward);
      }
      
      return {
        episode: agent.getState().episode,
        totalReward,
        episodeLength: newState.stepCount,
        averageReward: agent.getState().averageReward,
        loss,
        epsilon: agent.getState().epsilon,
        explorationRate: agent.getState().explorationRate,
        sharpeRatio: agent.getState().sharpeRatio,
        maxDrawdown: 0,
        winRate: agent.getState().winRate,
        profitFactor: 0,
        qValueRange: [0, 0],
        policyEntropy: 0,
        valueAccuracy: 0,
        trainingTime: 0,
        stepsPerSecond: 0,
        memoryUsage: agent.getState().memoryUsage
      };
      
    } catch (error) {
      console.error(`Error in agent ${agentId} step:`, error);
      return null;
    }
  }

  private async processCommunication(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      switch (message.messageType) {
        case 'SIGNAL':
          await this.processSignalMessage(message);
          break;
        case 'EXPERIENCE':
          await this.processExperienceMessage(message);
          break;
        case 'MODEL':
          await this.processModelMessage(message);
          break;
        case 'PERFORMANCE':
          await this.processPerformanceMessage(message);
          break;
        case 'COORDINATION':
          await this.processCoordinationMessage(message);
          break;
      }
      
      this.communicationHistory.push(message);
    }
  }

  private async processSignalMessage(message: AgentCommunication): Promise<void> {
    // Process trading signals from other agents
    console.log(`📡 Processing signal from ${message.senderId}`);
  }

  private async processExperienceMessage(message: AgentCommunication): Promise<void> {
    // Share experiences between agents
    if (this.config.informationSharing.shareExperiences && this.sharedReplayBuffer) {
      const experience = message.payload;
      this.sharedReplayBuffer.add(experience);
    }
  }

  private async processModelMessage(message: AgentCommunication): Promise<void> {
    // Share model updates
    console.log(`🧠 Processing model update from ${message.senderId}`);
  }

  private async processPerformanceMessage(message: AgentCommunication): Promise<void> {
    // Share performance metrics
    const performance = message.payload;
    this.globalKnowledge.set(`${message.senderId}_performance`, performance);
  }

  private async processCoordinationMessage(message: AgentCommunication): Promise<void> {
    // Process coordination messages
    console.log(`🤝 Processing coordination message from ${message.senderId}`);
  }

  private updatePortfolioState(): void {
    // Calculate portfolio metrics from all agents
    const totalPositions = new Map<string, number>();
    let totalValue = 0;
    let totalCash = 0;
    
    for (const [agentId, environment] of this.environments) {
      const state = environment.getState();
      totalValue += state.equity;
      totalCash += state.cash;
      
      for (const [symbol, position] of state.positions) {
        const currentPos = totalPositions.get(symbol) || 0;
        totalPositions.set(symbol, currentPos + position);
      }
    }
    
    // Calculate portfolio weights
    const weights = new Map<string, number>();
    const totalExposure = Array.from(totalPositions.values())
      .reduce((sum, pos) => sum + Math.abs(pos), 0);
    
    for (const [symbol, position] of totalPositions) {
      weights.set(symbol, totalExposure > 0 ? Math.abs(position) / totalExposure : 0);
    }
    
    // Calculate diversification (simplified)
    const diversification = weights.size > 1 ? 
      1 - Math.max(...Array.from(weights.values())) : 0;
    
    this.portfolioState = {
      positions: totalPositions,
      weights,
      totalValue,
      cash: totalCash,
      exposure: totalExposure,
      diversification,
      correlation: [], // Would need price correlation calculation
      risk: {
        volatility: 0, // Would need historical portfolio returns
        var95: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      }
    };
    
    this.portfolioHistory.push({ ...this.portfolioState });
    if (this.portfolioHistory.length > 1000) {
      this.portfolioHistory = this.portfolioHistory.slice(-500);
    }
  }

  private updateSystemMetrics(stepResults: Map<string, TrainingResult>): void {
    // Update system-wide performance metrics
    const totalRewards = Array.from(stepResults.values()).map(r => r.totalReward);
    const averageReward = totalRewards.reduce((sum, r) => sum + r, 0) / totalRewards.length;
    
    this.systemMetrics.averagePerformance = averageReward;
    this.systemMetrics.activeAgents = this.agents.size;
    
    // Update portfolio performance
    if (this.portfolioHistory.length > 1) {
      const current = this.portfolioHistory[this.portfolioHistory.length - 1];
      const previous = this.portfolioHistory[0];
      const totalReturn = (current.totalValue - previous.totalValue) / previous.totalValue;
      
      this.systemMetrics.portfolioPerformance.totalReturn = totalReturn;
      this.systemMetrics.portfolioPerformance.diversification = current.diversification;
    }
  }

  private async resetEnvironments(): Promise<void> {
    for (const [agentId, environment] of this.environments) {
      await environment.reset();
    }
  }

  private async checkEpisodeComplete(): Promise<boolean> {
    // Check if any environment indicates episode completion
    for (const [agentId, environment] of this.environments) {
      const metrics = environment.getMetrics();
      if (metrics.cumulativeReward !== 0) { // Simple check - would be more sophisticated
        return true;
      }
    }
    return false;
  }

  private async synchronizedLearning(): Promise<void> {
    // All agents learn together
    const learningPromises: Promise<number>[] = [];
    
    for (const agent of this.agents.values()) {
      learningPromises.push(agent.learn());
    }
    
    await Promise.all(learningPromises);
  }

  private async asynchronousLearning(): Promise<void> {
    // Agents learn independently
    for (const agent of this.agents.values()) {
      agent.learn(); // Don't await - let them learn asynchronously
    }
  }

  private async completeEpisode(episode: number): Promise<void> {
    for (const [agentId, agent] of this.agents) {
      const performance = this.agentPerformance.get(agentId) || [];
      const episodeReward = performance.slice(-100).reduce((sum, r) => sum + r, 0);
      await agent.completeEpisode(episodeReward, 100); // Simplified
    }
  }

  private async adaptSystem(): Promise<void> {
    // Adapt system based on agent performance
    const performances = new Map<string, number>();
    
    for (const [agentId, agent] of this.agents) {
      performances.set(agentId, agent.getState().averageReward);
    }
    
    // Remove underperforming agents if needed
    const sortedPerformances = Array.from(performances.entries())
      .sort(([,a], [,b]) => b - a);
    
    // Could implement more sophisticated adaptation logic here
  }

  private async shareInformation(): Promise<void> {
    if (!this.config.informationSharing.shareExperiences) return;
    
    // Share information between agents
    for (const [senderId, agent] of this.agents) {
      const performance = agent.getState();
      
      const message: AgentCommunication = {
        senderId,
        recipientId: 'ALL',
        messageType: 'PERFORMANCE',
        payload: {
          averageReward: performance.averageReward,
          winRate: performance.winRate,
          sharpeRatio: performance.sharpeRatio
        },
        timestamp: new Date(),
        priority: 1
      };
      
      this.messageQueue.push(message);
    }
  }

  private calculateExposure(action: Action): number {
    // Calculate portfolio exposure for coordination
    let totalExposure = this.portfolioState.exposure;
    
    if (action.type === 'BUY' || action.type === 'SELL') {
      totalExposure += action.size;
    }
    
    return totalExposure;
  }

  private updateAgentSpecialization(agentId: string, reward: number): void {
    const specialization = this.agentSpecializations.get(agentId);
    if (!specialization) return;
    
    specialization.performanceHistory.push(reward);
    if (specialization.performanceHistory.length > 100) {
      specialization.performanceHistory = specialization.performanceHistory.slice(-50);
    }
    
    // Calculate expertise based on performance
    const avgPerformance = specialization.performanceHistory
      .reduce((sum, p) => sum + p, 0) / specialization.performanceHistory.length;
    
    specialization.expertise = Math.max(0, Math.min(1, avgPerformance + 0.5)); // Normalize to 0-1
  }

  private selectNewCoordinator(): void {
    if (this.config.coordinationStrategy !== 'HIERARCHICAL') return;
    
    // Select best performing agent as new coordinator
    let bestAgent = '';
    let bestPerformance = -Infinity;
    
    for (const [agentId, agent] of this.agents) {
      const performance = agent.getState().averageReward;
      if (performance > bestPerformance) {
        bestPerformance = performance;
        bestAgent = agentId;
      }
    }
    
    if (bestAgent) {
      this.coordinatorAgent = bestAgent;
      console.log(`👑 New coordinator selected: ${bestAgent}`);
    }
  }

  private initializePortfolioState(): PortfolioState {
    return {
      positions: new Map(),
      weights: new Map(),
      totalValue: 0,
      cash: 0,
      exposure: 0,
      diversification: 0,
      correlation: [],
      risk: {
        volatility: 0,
        var95: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      }
    };
  }

  private initializeSystemMetrics(): SystemMetrics {
    return {
      totalAgents: 0,
      activeAgents: 0,
      averagePerformance: 0,
      portfolioPerformance: {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        diversification: 0
      },
      coordinationEfficiency: 0,
      consensusRate: 0,
      communicationOverhead: 0,
      totalMemoryUsage: 0,
      computationLoad: 0,
      parallelizationEfficiency: 0
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Dispose all agents
    for (const agent of this.agents.values()) {
      agent.dispose();
    }
    
    // Dispose all environments
    for (const environment of this.environments.values()) {
      environment.dispose();
    }
    
    // Dispose replay buffers
    for (const buffer of this.replayBuffers.values()) {
      buffer.dispose();
    }
    
    // Dispose shared replay buffer
    if (this.sharedReplayBuffer) {
      this.sharedReplayBuffer.dispose();
    }
    
    // Clear all maps
    this.agents.clear();
    this.environments.clear();
    this.rewardEngines.clear();
    this.replayBuffers.clear();
    this.agentSpecializations.clear();
    this.agentPerformance.clear();
    this.agentRoles.clear();
    this.globalKnowledge.clear();
    this.messageQueue = [];
    this.communicationHistory = [];
    this.portfolioHistory = [];
  }
}

// Default multi-agent configurations
export const DEFAULT_MULTI_AGENT_CONFIGS: Record<string, MultiAgentConfig> = {
  cooperative: {
    coordinationStrategy: 'COOPERATIVE',
    communicationProtocol: 'BROADCAST',
    maxAgents: 5,
    enableSpecialization: true,
    specializationThreshold: 0.6,
    portfolioConstraints: {
      maxPositionPerAsset: 0.3,
      maxTotalExposure: 0.8,
      minDiversification: 0.3,
      correlationLimit: 0.7
    },
    consensusThreshold: 0.6,
    competitionWeight: 0.2,
    informationSharing: {
      shareExperiences: true,
      shareRewards: true,
      shareModels: false,
      sharingFrequency: 10
    },
    synchronousLearning: true,
    sharedReplayBuffer: true,
    crossAgentValidation: true,
    parallelExecution: true,
    loadBalancing: true,
    adaptiveAllocation: true
  },
  
  competitive: {
    coordinationStrategy: 'COMPETITIVE',
    communicationProtocol: 'DIRECT',
    maxAgents: 8,
    enableSpecialization: true,
    specializationThreshold: 0.7,
    portfolioConstraints: {
      maxPositionPerAsset: 0.4,
      maxTotalExposure: 1.0,
      minDiversification: 0.2,
      correlationLimit: 0.8
    },
    consensusThreshold: 0.5,
    competitionWeight: 0.8,
    informationSharing: {
      shareExperiences: false,
      shareRewards: false,
      shareModels: false,
      sharingFrequency: 50
    },
    synchronousLearning: false,
    sharedReplayBuffer: false,
    crossAgentValidation: false,
    parallelExecution: true,
    loadBalancing: false,
    adaptiveAllocation: true
  },
  
  hierarchical: {
    coordinationStrategy: 'HIERARCHICAL',
    communicationProtocol: 'HIERARCHICAL',
    maxAgents: 6,
    enableSpecialization: true,
    specializationThreshold: 0.5,
    portfolioConstraints: {
      maxPositionPerAsset: 0.25,
      maxTotalExposure: 0.7,
      minDiversification: 0.4,
      correlationLimit: 0.6
    },
    consensusThreshold: 0.7,
    competitionWeight: 0.1,
    informationSharing: {
      shareExperiences: true,
      shareRewards: true,
      shareModels: true,
      sharingFrequency: 5
    },
    synchronousLearning: true,
    sharedReplayBuffer: true,
    crossAgentValidation: true,
    parallelExecution: false,
    loadBalancing: true,
    adaptiveAllocation: true
  }
};