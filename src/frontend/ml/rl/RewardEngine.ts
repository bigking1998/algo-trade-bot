/**
 * RewardEngine - Advanced Reward Function Engineering for RL Trading
 * 
 * Provides sophisticated reward calculation for reinforcement learning agents
 * with risk-adjusted returns, drawdown penalties, and multi-objective optimization.
 */

import { Action, EnvironmentState, MarketCondition } from './TradingEnvironment';

export type RewardType = 'PROFIT_BASED' | 'SHARPE_BASED' | 'RISK_ADJUSTED' | 'MULTI_OBJECTIVE' | 'SPARSE' | 'DENSE';
export type RiskMeasure = 'DRAWDOWN' | 'VOLATILITY' | 'VAR' | 'CVAR' | 'SORTINO' | 'CALMAR';

export interface RewardConfig {
  type: RewardType;
  
  // Base reward parameters
  returnWeight: number; // Weight for raw returns
  riskWeight: number; // Weight for risk penalty
  transactionCostWeight: number; // Weight for transaction costs
  
  // Risk measures and penalties
  riskMeasures: RiskMeasure[];
  maxDrawdownThreshold: number;
  volatilityThreshold: number;
  varConfidenceLevel: number; // 0.95, 0.99
  
  // Multi-objective parameters
  objectives: string[]; // ['return', 'risk', 'sharpe', 'drawdown']
  objectiveWeights: number[];
  
  // Sparse reward settings
  profitThreshold: number; // Minimum profit for positive reward
  lossThreshold: number; // Maximum loss before penalty
  
  // Behavioral incentives
  holdingReward: number; // Reward for holding positions
  diversificationReward: number; // Reward for portfolio diversification
  consistencyReward: number; // Reward for consistent performance
  
  // Dynamic reward adjustment
  adaptiveWeighting: boolean;
  performanceWindow: number; // Window for adaptive adjustments
  
  // Market condition specific rewards
  conditionSpecificRewards: Map<MarketCondition, number>;
  
  // Advanced features
  curiosityReward: number; // Reward for exploration
  regimeChangeReward: number; // Reward for adapting to regime changes
  informationRatio: number; // Target information ratio
}

export interface RewardComponents {
  baseReward: number;
  riskPenalty: number;
  transactionCost: number;
  behavioralIncentive: number;
  conditionBonus: number;
  curiosityBonus: number;
  
  // Breakdown for analysis
  returnComponent: number;
  riskComponents: Record<RiskMeasure, number>;
  objectives: Record<string, number>;
  
  // Metadata
  totalReward: number;
  normalizedReward: number;
  explanation: string;
}

export interface PerformanceMetrics {
  returns: number[];
  equity: number[];
  drawdowns: number[];
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  valueAtRisk: number;
  conditionalVaR: number;
  informationRatio: number;
}

export class RewardEngine {
  private config: RewardConfig;
  private performanceHistory: PerformanceMetrics;
  private rewardHistory: RewardComponents[] = [];
  
  // Adaptive state
  private adaptiveWeights: Map<string, number> = new Map();
  private performanceWindow: number[] = [];
  private marketRegimeHistory: MarketCondition[] = [];
  
  // Risk calculation state
  private returnBuffer: number[] = [];
  private equityBuffer: number[] = [];
  private drawdownBuffer: number[] = [];
  
  // Curiosity and exploration
  private stateVisitCounts: Map<string, number> = new Map();
  private actionHistory: Action[] = [];

  constructor(config: RewardConfig) {
    this.config = config;
    this.performanceHistory = this.initializePerformanceMetrics();
    this.initializeAdaptiveWeights();
  }

  /**
   * Calculate comprehensive reward for an action and resulting state
   */
  calculateReward(
    action: Action,
    prevState: EnvironmentState,
    newState: EnvironmentState,
    executionResult: any
  ): RewardComponents {
    // Update internal state
    this.updatePerformanceMetrics(prevState, newState);
    this.actionHistory.push(action);
    this.marketRegimeHistory.push(newState.condition);
    
    // Calculate reward components
    const baseReward = this.calculateBaseReward(prevState, newState);
    const riskPenalty = this.calculateRiskPenalty(newState);
    const transactionCost = this.calculateTransactionCostPenalty(action, executionResult);
    const behavioralIncentive = this.calculateBehavioralIncentives(action, prevState, newState);
    const conditionBonus = this.calculateConditionBonus(newState.condition, baseReward);
    const curiosityBonus = this.calculateCuriosityReward(prevState, action);
    
    // Multi-objective combination
    const objectives = this.calculateObjectiveComponents(prevState, newState);
    
    // Risk component breakdown
    const riskComponents = this.calculateRiskComponents(newState);
    
    // Combine components
    let totalReward = baseReward - riskPenalty - transactionCost + behavioralIncentive + conditionBonus + curiosityBonus;
    
    // Apply adaptive weighting
    if (this.config.adaptiveWeighting) {
      totalReward = this.applyAdaptiveWeighting(totalReward, baseReward, riskPenalty);
    }
    
    // Normalize reward
    const normalizedReward = this.normalizeReward(totalReward);
    
    // Create reward breakdown
    const rewardComponents: RewardComponents = {
      baseReward,
      riskPenalty,
      transactionCost,
      behavioralIncentive,
      conditionBonus,
      curiosityBonus,
      returnComponent: baseReward,
      riskComponents,
      objectives,
      totalReward,
      normalizedReward,
      explanation: this.generateRewardExplanation(baseReward, riskPenalty, transactionCost, behavioralIncentive)
    };
    
    // Store for analysis
    this.rewardHistory.push(rewardComponents);
    
    // Cleanup history if too long
    if (this.rewardHistory.length > 10000) {
      this.rewardHistory = this.rewardHistory.slice(-5000);
    }
    
    return rewardComponents;
  }

  /**
   * Calculate sparse reward (only at episode end or significant events)
   */
  calculateSparseReward(
    finalState: EnvironmentState,
    episodeMetrics: any
  ): number {
    if (this.config.type !== 'SPARSE') {
      return 0;
    }
    
    const totalReturn = episodeMetrics.totalReturn;
    
    // Large positive reward for profitable episodes
    if (totalReturn > this.config.profitThreshold) {
      return totalReturn * 100;
    }
    
    // Large negative reward for loss episodes
    if (totalReturn < this.config.lossThreshold) {
      return totalReturn * 200; // Higher penalty for losses
    }
    
    return 0;
  }

  /**
   * Calculate curiosity-driven exploration reward
   */
  calculateExplorationReward(state: EnvironmentState, action: Action): number {
    // Encourage exploration of less-visited state-action pairs
    const stateKey = this.encodeState(state);
    const actionKey = `${stateKey}-${action.type}-${Math.round(action.size * 10)}`;
    
    const visitCount = this.stateVisitCounts.get(actionKey) || 0;
    this.stateVisitCounts.set(actionKey, visitCount + 1);
    
    // Inverse relationship with visit count
    const explorationBonus = this.config.curiosityReward / Math.sqrt(visitCount + 1);
    
    return explorationBonus;
  }

  /**
   * Update reward function based on performance
   */
  updateRewardFunction(recentPerformance: PerformanceMetrics): void {
    if (!this.config.adaptiveWeighting) return;
    
    // Adjust weights based on recent performance
    const recentSharpe = recentPerformance.sharpeRatio;
    const recentDrawdown = recentPerformance.maxDrawdown;
    
    // If poor Sharpe ratio, increase risk weighting
    if (recentSharpe < 0.5) {
      this.adaptiveWeights.set('risk', Math.min(2.0, this.config.riskWeight * 1.2));
    }
    
    // If high drawdown, increase drawdown penalty
    if (recentDrawdown > 0.15) {
      this.adaptiveWeights.set('drawdown', Math.min(3.0, 
        (this.adaptiveWeights.get('drawdown') || 1.0) * 1.3));
    }
    
    // If low volatility, may increase return weighting
    if (recentPerformance.volatility < 0.1) {
      this.adaptiveWeights.set('return', Math.min(2.0, this.config.returnWeight * 1.1));
    }
  }

  /**
   * Get reward statistics for analysis
   */
  getRewardStatistics(): {
    averageReward: number;
    rewardVolatility: number;
    rewardTrend: number;
    componentBreakdown: Record<string, number>;
    rewardDistribution: number[];
    explorationStats: any;
  } {
    if (this.rewardHistory.length === 0) {
      return {
        averageReward: 0,
        rewardVolatility: 0,
        rewardTrend: 0,
        componentBreakdown: {},
        rewardDistribution: [],
        explorationStats: {}
      };
    }
    
    const rewards = this.rewardHistory.map(r => r.totalReward);
    const averageReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
    
    // Calculate reward volatility
    const rewardVariance = rewards.reduce((sum, r) => sum + (r - averageReward) ** 2, 0) / rewards.length;
    const rewardVolatility = Math.sqrt(rewardVariance);
    
    // Calculate trend (slope of recent rewards)
    const recentRewards = rewards.slice(-100);
    const rewardTrend = this.calculateTrend(recentRewards);
    
    // Component breakdown
    const componentBreakdown: Record<string, number> = {};
    ['baseReward', 'riskPenalty', 'transactionCost', 'behavioralIncentive'].forEach(component => {
      componentBreakdown[component] = this.rewardHistory
        .reduce((sum, r) => sum + (r as any)[component], 0) / this.rewardHistory.length;
    });
    
    // Exploration stats
    const explorationStats = {
      uniqueStatesVisited: this.stateVisitCounts.size,
      averageVisitCount: Array.from(this.stateVisitCounts.values())
        .reduce((sum, count) => sum + count, 0) / this.stateVisitCounts.size || 0,
      maxVisitCount: Math.max(...Array.from(this.stateVisitCounts.values()), 0)
    };
    
    return {
      averageReward,
      rewardVolatility,
      rewardTrend,
      componentBreakdown,
      rewardDistribution: rewards,
      explorationStats
    };
  }

  /**
   * Reset reward engine state
   */
  reset(): void {
    this.rewardHistory = [];
    this.performanceWindow = [];
    this.returnBuffer = [];
    this.equityBuffer = [];
    this.drawdownBuffer = [];
    this.actionHistory = [];
    this.marketRegimeHistory = [];
    this.performanceHistory = this.initializePerformanceMetrics();
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private calculateBaseReward(prevState: EnvironmentState, newState: EnvironmentState): number {
    const returnRate = (newState.equity - prevState.equity) / prevState.equity;
    
    switch (this.config.type) {
      case 'PROFIT_BASED':
        return returnRate * this.config.returnWeight;
        
      case 'SHARPE_BASED':
        const sharpe = this.calculateInstantaneousSharpe(returnRate);
        return sharpe * this.config.returnWeight;
        
      case 'RISK_ADJUSTED':
        const riskAdjustedReturn = returnRate / Math.max(0.01, newState.volatility);
        return riskAdjustedReturn * this.config.returnWeight;
        
      case 'MULTI_OBJECTIVE':
        return this.calculateMultiObjectiveReward(prevState, newState);
        
      case 'DENSE':
        return returnRate * this.config.returnWeight * 100; // Scale up for dense feedback
        
      default:
        return returnRate * this.config.returnWeight;
    }
  }

  private calculateRiskPenalty(state: EnvironmentState): number {
    let totalPenalty = 0;
    
    for (const riskMeasure of this.config.riskMeasures) {
      switch (riskMeasure) {
        case 'DRAWDOWN':
          if (state.drawdown > this.config.maxDrawdownThreshold) {
            totalPenalty += (state.drawdown - this.config.maxDrawdownThreshold) * this.config.riskWeight;
          }
          break;
          
        case 'VOLATILITY':
          if (state.volatility > this.config.volatilityThreshold) {
            totalPenalty += (state.volatility - this.config.volatilityThreshold) * this.config.riskWeight;
          }
          break;
          
        case 'VAR':
          const var95 = this.calculateVaR(this.config.varConfidenceLevel);
          if (var95 > 0.05) { // 5% VaR threshold
            totalPenalty += var95 * this.config.riskWeight;
          }
          break;
          
        case 'CVAR':
          const cvar95 = this.calculateCVaR(this.config.varConfidenceLevel);
          if (cvar95 > 0.07) { // 7% CVaR threshold
            totalPenalty += cvar95 * this.config.riskWeight;
          }
          break;
      }
    }
    
    return totalPenalty;
  }

  private calculateTransactionCostPenalty(action: Action, executionResult: any): number {
    if (!executionResult.success) return 0;
    
    const commission = executionResult.commission || 0;
    const slippage = executionResult.slippage || 0;
    
    return (commission + slippage) * this.config.transactionCostWeight;
  }

  private calculateBehavioralIncentives(
    action: Action,
    prevState: EnvironmentState,
    newState: EnvironmentState
  ): number {
    let incentive = 0;
    
    // Holding reward for stable positions
    if (action.type === 'HOLD' && this.config.holdingReward > 0) {
      const stability = 1 - Math.abs(newState.equity - prevState.equity) / prevState.equity;
      incentive += stability * this.config.holdingReward;
    }
    
    // Diversification reward
    if (this.config.diversificationReward > 0) {
      const diversification = this.calculateDiversificationScore(newState);
      incentive += diversification * this.config.diversificationReward;
    }
    
    // Consistency reward
    if (this.config.consistencyReward > 0 && this.equityBuffer.length > 10) {
      const consistency = this.calculateConsistencyScore();
      incentive += consistency * this.config.consistencyReward;
    }
    
    return incentive;
  }

  private calculateConditionBonus(condition: MarketCondition, baseReward: number): number {
    const conditionMultiplier = this.config.conditionSpecificRewards.get(condition) || 1.0;
    return baseReward * (conditionMultiplier - 1.0);
  }

  private calculateCuriosityReward(state: EnvironmentState, action: Action): number {
    if (this.config.curiosityReward <= 0) return 0;
    
    return this.calculateExplorationReward(state, action);
  }

  private calculateObjectiveComponents(
    prevState: EnvironmentState,
    newState: EnvironmentState
  ): Record<string, number> {
    const objectives: Record<string, number> = {};
    
    if (this.config.objectives.includes('return')) {
      objectives.return = (newState.equity - prevState.equity) / prevState.equity;
    }
    
    if (this.config.objectives.includes('risk')) {
      objectives.risk = -newState.drawdown; // Negative because we want to minimize risk
    }
    
    if (this.config.objectives.includes('sharpe')) {
      objectives.sharpe = this.performanceHistory.sharpeRatio || 0;
    }
    
    if (this.config.objectives.includes('drawdown')) {
      objectives.drawdown = -newState.drawdown;
    }
    
    return objectives;
  }

  private calculateRiskComponents(state: EnvironmentState): Record<RiskMeasure, number> {
    const components: Record<RiskMeasure, number> = {} as Record<RiskMeasure, number>;
    
    for (const measure of this.config.riskMeasures) {
      switch (measure) {
        case 'DRAWDOWN':
          components[measure] = state.drawdown;
          break;
        case 'VOLATILITY':
          components[measure] = state.volatility;
          break;
        case 'VAR':
          components[measure] = this.calculateVaR(0.95);
          break;
        case 'CVAR':
          components[measure] = this.calculateCVaR(0.95);
          break;
        case 'SORTINO':
          components[measure] = this.calculateSortinoRatio();
          break;
        case 'CALMAR':
          components[measure] = this.calculateCalmarRatio();
          break;
      }
    }
    
    return components;
  }

  private calculateMultiObjectiveReward(prevState: EnvironmentState, newState: EnvironmentState): number {
    let totalReward = 0;
    
    for (let i = 0; i < this.config.objectives.length; i++) {
      const objective = this.config.objectives[i];
      const weight = this.config.objectiveWeights[i] || 1.0;
      
      let objectiveValue = 0;
      
      switch (objective) {
        case 'return':
          objectiveValue = (newState.equity - prevState.equity) / prevState.equity;
          break;
        case 'risk':
          objectiveValue = -newState.drawdown;
          break;
        case 'sharpe':
          objectiveValue = this.calculateInstantaneousSharpe(
            (newState.equity - prevState.equity) / prevState.equity
          );
          break;
      }
      
      totalReward += objectiveValue * weight;
    }
    
    return totalReward;
  }

  private calculateInstantaneousSharpe(returnRate: number): number {
    if (this.returnBuffer.length < 10) return 0;
    
    const recentReturns = this.returnBuffer.slice(-20);
    const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    const volatility = Math.sqrt(
      recentReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / recentReturns.length
    );
    
    return volatility > 0 ? avgReturn / volatility : 0;
  }

  private calculateVaR(confidenceLevel: number): number {
    if (this.returnBuffer.length < 20) return 0;
    
    const returns = [...this.returnBuffer].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * returns.length);
    
    return Math.abs(returns[index] || 0);
  }

  private calculateCVaR(confidenceLevel: number): number {
    if (this.returnBuffer.length < 20) return 0;
    
    const var95 = this.calculateVaR(confidenceLevel);
    const returns = this.returnBuffer.filter(r => r <= -var95);
    
    return returns.length > 0 
      ? Math.abs(returns.reduce((sum, r) => sum + r, 0) / returns.length)
      : var95;
  }

  private calculateSortinoRatio(): number {
    if (this.returnBuffer.length < 10) return 0;
    
    const returns = this.returnBuffer.slice(-30);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downside = returns.filter(r => r < 0);
    
    if (downside.length === 0) return avgReturn > 0 ? 10 : 0;
    
    const downsideDeviation = Math.sqrt(
      downside.reduce((sum, r) => sum + r * r, 0) / downside.length
    );
    
    return downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
  }

  private calculateCalmarRatio(): number {
    if (this.equityBuffer.length < 10) return 0;
    
    const recentEquity = this.equityBuffer.slice(-50);
    const totalReturn = (recentEquity[recentEquity.length - 1] - recentEquity[0]) / recentEquity[0];
    const maxDD = Math.max(...this.drawdownBuffer.slice(-50));
    
    return maxDD > 0 ? totalReturn / maxDD : 0;
  }

  private calculateDiversificationScore(state: EnvironmentState): number {
    const positions = Array.from(state.positions.values());
    if (positions.length <= 1) return 0;
    
    // Simple diversification measure based on position distribution
    const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos), 0);
    if (totalExposure === 0) return 0;
    
    const weights = positions.map(pos => Math.abs(pos) / totalExposure);
    const herfindahl = weights.reduce((sum, w) => sum + w * w, 0);
    
    return 1 - herfindahl; // Higher score for more diversified portfolios
  }

  private calculateConsistencyScore(): number {
    if (this.equityBuffer.length < 10) return 0;
    
    const recentEquity = this.equityBuffer.slice(-20);
    const returns = recentEquity.slice(1).map((equity, i) => 
      (equity - recentEquity[i]) / recentEquity[i]
    );
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const consistency = 1 - Math.sqrt(
      returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
    );
    
    return Math.max(0, consistency);
  }

  private applyAdaptiveWeighting(totalReward: number, baseReward: number, riskPenalty: number): number {
    const returnWeight = this.adaptiveWeights.get('return') || this.config.returnWeight;
    const riskWeight = this.adaptiveWeights.get('risk') || this.config.riskWeight;
    
    return baseReward * returnWeight - riskPenalty * riskWeight;
  }

  private normalizeReward(reward: number): number {
    // Simple tanh normalization to keep rewards in reasonable range
    return Math.tanh(reward);
  }

  private generateRewardExplanation(
    baseReward: number,
    riskPenalty: number,
    transactionCost: number,
    behavioralIncentive: number
  ): string {
    const components = [];
    
    if (Math.abs(baseReward) > 0.001) {
      components.push(`Base: ${baseReward.toFixed(4)}`);
    }
    if (Math.abs(riskPenalty) > 0.001) {
      components.push(`Risk: -${riskPenalty.toFixed(4)}`);
    }
    if (Math.abs(transactionCost) > 0.001) {
      components.push(`Cost: -${transactionCost.toFixed(4)}`);
    }
    if (Math.abs(behavioralIncentive) > 0.001) {
      components.push(`Behavior: +${behavioralIncentive.toFixed(4)}`);
    }
    
    return components.join(', ') || 'No significant components';
  }

  private updatePerformanceMetrics(prevState: EnvironmentState, newState: EnvironmentState): void {
    const returnRate = (newState.equity - prevState.equity) / prevState.equity;
    
    this.returnBuffer.push(returnRate);
    this.equityBuffer.push(newState.equity);
    this.drawdownBuffer.push(newState.drawdown);
    
    // Keep buffers manageable
    if (this.returnBuffer.length > 1000) {
      this.returnBuffer = this.returnBuffer.slice(-500);
      this.equityBuffer = this.equityBuffer.slice(-500);
      this.drawdownBuffer = this.drawdownBuffer.slice(-500);
    }
    
    // Update performance metrics
    this.performanceHistory.returns = [...this.returnBuffer];
    this.performanceHistory.equity = [...this.equityBuffer];
    this.performanceHistory.drawdowns = [...this.drawdownBuffer];
    this.performanceHistory.volatility = newState.volatility;
    this.performanceHistory.maxDrawdown = Math.max(...this.drawdownBuffer);
    this.performanceHistory.sharpeRatio = this.calculateInstantaneousSharpe(returnRate);
    this.performanceHistory.sortinoRatio = this.calculateSortinoRatio();
    this.performanceHistory.calmarRatio = this.calculateCalmarRatio();
  }

  private initializePerformanceMetrics(): PerformanceMetrics {
    return {
      returns: [],
      equity: [],
      drawdowns: [],
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      valueAtRisk: 0,
      conditionalVaR: 0,
      informationRatio: 0
    };
  }

  private initializeAdaptiveWeights(): void {
    this.adaptiveWeights.set('return', this.config.returnWeight);
    this.adaptiveWeights.set('risk', this.config.riskWeight);
    this.adaptiveWeights.set('cost', this.config.transactionCostWeight);
  }

  private encodeState(state: EnvironmentState): string {
    // Simple state encoding for exploration tracking
    const marketKey = Math.round(state.marketFeatures[0] * 10);
    const portfolioKey = Math.round(state.portfolioState[0] * 10);
    const riskKey = Math.round(state.riskMetrics[0] * 10);
    
    return `${marketKey}-${portfolioKey}-${riskKey}`;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }
}

// Default reward configurations
export const DEFAULT_REWARD_CONFIGS: Record<string, RewardConfig> = {
  balanced: {
    type: 'RISK_ADJUSTED',
    returnWeight: 1.0,
    riskWeight: 0.5,
    transactionCostWeight: 0.1,
    riskMeasures: ['DRAWDOWN', 'VOLATILITY'],
    maxDrawdownThreshold: 0.1,
    volatilityThreshold: 0.2,
    varConfidenceLevel: 0.95,
    objectives: ['return', 'risk'],
    objectiveWeights: [0.7, 0.3],
    profitThreshold: 0.05,
    lossThreshold: -0.1,
    holdingReward: 0.001,
    diversificationReward: 0.01,
    consistencyReward: 0.005,
    adaptiveWeighting: true,
    performanceWindow: 100,
    conditionSpecificRewards: new Map([
      ['TRENDING_UP', 1.2],
      ['TRENDING_DOWN', 1.1],
      ['SIDEWAYS', 0.9],
      ['VOLATILE', 0.8]
    ]),
    curiosityReward: 0.001,
    regimeChangeReward: 0.01,
    informationRatio: 1.0
  },
  
  conservative: {
    type: 'RISK_ADJUSTED',
    returnWeight: 0.7,
    riskWeight: 1.5,
    transactionCostWeight: 0.3,
    riskMeasures: ['DRAWDOWN', 'VOLATILITY', 'VAR'],
    maxDrawdownThreshold: 0.05,
    volatilityThreshold: 0.15,
    varConfidenceLevel: 0.99,
    objectives: ['return', 'risk', 'sharpe'],
    objectiveWeights: [0.4, 0.4, 0.2],
    profitThreshold: 0.03,
    lossThreshold: -0.05,
    holdingReward: 0.005,
    diversificationReward: 0.02,
    consistencyReward: 0.01,
    adaptiveWeighting: true,
    performanceWindow: 200,
    conditionSpecificRewards: new Map([
      ['VOLATILE', 0.5],
      ['SIDEWAYS', 1.3]
    ]),
    curiosityReward: 0.0005,
    regimeChangeReward: 0.005,
    informationRatio: 1.5
  },
  
  aggressive: {
    type: 'PROFIT_BASED',
    returnWeight: 2.0,
    riskWeight: 0.2,
    transactionCostWeight: 0.05,
    riskMeasures: ['DRAWDOWN'],
    maxDrawdownThreshold: 0.2,
    volatilityThreshold: 0.5,
    varConfidenceLevel: 0.9,
    objectives: ['return'],
    objectiveWeights: [1.0],
    profitThreshold: 0.1,
    lossThreshold: -0.2,
    holdingReward: 0,
    diversificationReward: 0,
    consistencyReward: 0,
    adaptiveWeighting: false,
    performanceWindow: 50,
    conditionSpecificRewards: new Map([
      ['TRENDING_UP', 1.5],
      ['TRENDING_DOWN', 1.3],
      ['VOLATILE', 1.4]
    ]),
    curiosityReward: 0.002,
    regimeChangeReward: 0.02,
    informationRatio: 0.5
  }
};