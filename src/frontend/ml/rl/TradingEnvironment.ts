/**
 * TradingEnvironment - Reinforcement Learning Trading Environment
 * 
 * Provides a realistic market simulation environment for RL agents to learn
 * optimal trading strategies. Supports multiple assets, realistic market
 * conditions, and comprehensive state representation.
 */

import * as tf from '@tensorflow/tfjs';
import { FeatureVector } from '../features/types';
import { featureEngine } from '../features/FeatureEngine';

export type MarketCondition = 'TRENDING_UP' | 'TRENDING_DOWN' | 'SIDEWAYS' | 'VOLATILE' | 'LOW_VOLUME' | 'HIGH_VOLUME';
export type ActionType = 'BUY' | 'SELL' | 'HOLD' | 'CLOSE_LONG' | 'CLOSE_SHORT';

export interface Action {
  type: ActionType;
  size: number; // Position size (0-1 as fraction of capital)
  symbol?: string; // For multi-asset environments
}

export interface EnvironmentState {
  // Market features
  marketFeatures: Float32Array; // Technical indicators, price patterns
  portfolioState: Float32Array; // Current positions, cash, equity
  riskMetrics: Float32Array; // Current risk exposure, drawdown
  timeFeatures: Float32Array; // Time-based features (day, hour, etc.)
  
  // Market condition context
  condition: MarketCondition;
  volatility: number;
  trendStrength: number;
  
  // Position information
  positions: Map<string, number>; // symbol -> position size
  cash: number;
  equity: number;
  drawdown: number;
  
  // Time information
  timestamp: Date;
  stepCount: number;
  episodeLength: number;
}

export interface EnvironmentConfig {
  // Data configuration
  symbols: string[];
  startDate: Date;
  endDate: Date;
  timeframe: string; // '1m', '5m', '1h', '1d'
  
  // Trading parameters
  initialCapital: number;
  commission: number; // Per-trade commission rate
  slippage: number; // Market impact and slippage
  borrowRate: number; // Cost of borrowing for short positions
  
  // Risk parameters
  maxPositionSize: number; // Maximum position size (0-1)
  maxLeverage: number;
  marginRequirement: number;
  
  // Environment settings
  actionSpace: ActionType[];
  stateVectorSize: number;
  maxEpisodeLength: number;
  
  // Market simulation
  enableSlippage: boolean;
  enableCommission: boolean;
  realisticFills: boolean;
  marketImpact: number;
  
  // Multi-environment support
  marketConditions: MarketCondition[];
  dynamicConditions: boolean; // Change conditions during episode
}

export interface EnvironmentMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
  volatility: number;
  
  // RL-specific metrics
  averageReward: number;
  cumulativeReward: number;
  explorationRate: number;
  actionDistribution: Record<ActionType, number>;
  
  // Risk metrics
  valueAtRisk: number;
  conditionalVaR: number;
  riskAdjustedReturn: number;
}

export class TradingEnvironment {
  private config: EnvironmentConfig;
  private historicalData: any[];
  private currentIndex: number = 0;
  private state: EnvironmentState;
  private episodeMetrics: EnvironmentMetrics;
  private episodeComplete: boolean = false;
  
  // Market simulation
  private priceBuffer: number[] = []; // Last N prices for trend calculation
  private volumeBuffer: number[] = [];
  private volatilityWindow: number[] = [];
  
  // Performance tracking
  private equityCurve: number[] = [];
  private drawdownHistory: number[] = [];
  private actionHistory: Action[] = [];
  private rewardHistory: number[] = [];
  
  // Multi-environment support
  private environments: Map<MarketCondition, any[]> = new Map();
  private currentCondition: MarketCondition;

  constructor(config: EnvironmentConfig) {
    this.config = config;
    this.currentCondition = config.marketConditions[0] || 'TRENDING_UP';
    this.state = this.initializeState();
    this.episodeMetrics = this.initializeMetrics();
  }

  /**
   * Reset environment for new episode
   */
  async reset(condition?: MarketCondition): Promise<EnvironmentState> {
    console.log(`🔄 Resetting trading environment (condition: ${condition || this.currentCondition})`);
    
    // Set market condition
    if (condition) {
      this.currentCondition = condition;
    } else if (this.config.dynamicConditions) {
      this.currentCondition = this.selectRandomCondition();
    }
    
    // Reset environment state
    this.currentIndex = this.getRandomStartIndex();
    this.episodeComplete = false;
    
    // Reset portfolio
    this.state = this.initializeState();
    this.state.condition = this.currentCondition;
    
    // Reset tracking
    this.equityCurve = [this.config.initialCapital];
    this.drawdownHistory = [0];
    this.actionHistory = [];
    this.rewardHistory = [];
    this.episodeMetrics = this.initializeMetrics();
    
    // Load appropriate data for current condition
    await this.loadEnvironmentData();
    
    // Generate initial state features
    await this.updateStateFeatures();
    
    console.log(`✅ Environment reset complete. Starting at index ${this.currentIndex}`);
    return { ...this.state };
  }

  /**
   * Execute action and advance environment
   */
  async step(action: Action): Promise<{
    state: EnvironmentState;
    reward: number;
    done: boolean;
    info: any;
  }> {
    if (this.episodeComplete) {
      throw new Error('Episode is complete. Call reset() to start new episode.');
    }
    
    // Execute action
    const executionResult = await this.executeAction(action);
    
    // Advance time
    this.currentIndex++;
    this.state.stepCount++;
    
    // Update state
    await this.updateStateFeatures();
    
    // Calculate reward
    const reward = this.calculateReward(action, executionResult);
    this.rewardHistory.push(reward);
    
    // Check if episode is done
    const done = this.checkEpisodeComplete();
    this.episodeComplete = done;
    
    // Update metrics
    this.updateEpisodeMetrics(action, reward);
    
    // Additional info for debugging/analysis
    const info = {
      execution: executionResult,
      portfolioValue: this.state.equity,
      currentPrice: this.getCurrentPrice(),
      drawdown: this.state.drawdown,
      condition: this.state.condition,
      step: this.state.stepCount
    };
    
    return {
      state: { ...this.state },
      reward,
      done,
      info
    };
  }

  /**
   * Get current environment state
   */
  getState(): EnvironmentState {
    return { ...this.state };
  }

  /**
   * Get environment metrics
   */
  getMetrics(): EnvironmentMetrics {
    return { ...this.episodeMetrics };
  }

  /**
   * Check if environment supports action
   */
  isValidAction(action: Action): boolean {
    // Check if action type is supported
    if (!this.config.actionSpace.includes(action.type)) {
      return false;
    }
    
    // Check position size constraints
    if (action.size < 0 || action.size > this.config.maxPositionSize) {
      return false;
    }
    
    // Check if sufficient capital
    const cost = this.calculateActionCost(action);
    if (cost > this.state.cash && action.type === 'BUY') {
      return false;
    }
    
    return true;
  }

  /**
   * Get action space information
   */
  getActionSpace(): {
    types: ActionType[];
    continuous: boolean;
    sizeRange: [number, number];
    dimensions: number;
  } {
    return {
      types: this.config.actionSpace,
      continuous: true,
      sizeRange: [0, this.config.maxPositionSize],
      dimensions: this.config.actionSpace.length + 1 // action type + size
    };
  }

  /**
   * Get observation space information
   */
  getObservationSpace(): {
    shape: number[];
    low: number[];
    high: number[];
  } {
    const stateSize = this.config.stateVectorSize;
    return {
      shape: [stateSize],
      low: new Array(stateSize).fill(-10),
      high: new Array(stateSize).fill(10)
    };
  }

  /**
   * Generate multiple parallel environments
   */
  async createParallelEnvironments(count: number): Promise<TradingEnvironment[]> {
    const environments: TradingEnvironment[] = [];
    
    for (let i = 0; i < count; i++) {
      const config = { ...this.config };
      
      // Vary parameters for diversity
      if (this.config.dynamicConditions) {
        config.marketConditions = [this.selectRandomCondition()];
      }
      
      const env = new TradingEnvironment(config);
      await env.initialize();
      environments.push(env);
    }
    
    return environments;
  }

  /**
   * Initialize environment with data
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing trading environment...');
    
    // Load historical data
    await this.loadHistoricalData();
    
    // Prepare environment-specific data
    await this.prepareEnvironmentData();
    
    // Initialize state
    this.state = this.initializeState();
    await this.updateStateFeatures();
    
    console.log(`✅ Environment initialized with ${this.historicalData.length} data points`);
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async loadHistoricalData(): Promise<void> {
    // This would typically load from backend API
    // For now, simulate market data
    this.historicalData = this.generateSimulatedData();
  }

  private async loadEnvironmentData(): Promise<void> {
    // Load data specific to current market condition
    const conditionData = this.environments.get(this.currentCondition);
    if (!conditionData) {
      this.environments.set(this.currentCondition, this.filterDataByCondition(this.currentCondition));
    }
  }

  private async prepareEnvironmentData(): Promise<void> {
    // Prepare data for each market condition
    for (const condition of this.config.marketConditions) {
      const conditionData = this.filterDataByCondition(condition);
      this.environments.set(condition, conditionData);
    }
  }

  private filterDataByCondition(condition: MarketCondition): any[] {
    // Filter historical data based on market condition
    const filtered: any[] = [];
    
    for (let i = 50; i < this.historicalData.length; i++) { // Need lookback for indicators
      const window = this.historicalData.slice(i - 50, i);
      const conditionMatch = this.classifyMarketCondition(window);
      
      if (conditionMatch === condition) {
        filtered.push(...window);
      }
    }
    
    return filtered.length > 1000 ? filtered : this.historicalData; // Fallback to all data
  }

  private classifyMarketCondition(window: any[]): MarketCondition {
    if (window.length < 20) return 'SIDEWAYS';
    
    const prices = window.map(d => d.close);
    const volumes = window.map(d => d.volume || 1000);
    
    // Calculate trend
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const trend = (lastPrice - firstPrice) / firstPrice;
    
    // Calculate volatility
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    
    // Calculate average volume
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((sum, v) => sum + v, 0) / 5;
    
    // Classify condition
    if (volatility > 0.05) return 'VOLATILE';
    if (recentVolume > avgVolume * 1.5) return 'HIGH_VOLUME';
    if (recentVolume < avgVolume * 0.5) return 'LOW_VOLUME';
    if (trend > 0.02) return 'TRENDING_UP';
    if (trend < -0.02) return 'TRENDING_DOWN';
    
    return 'SIDEWAYS';
  }

  private generateSimulatedData(): any[] {
    const data: any[] = [];
    let price = 50000; // Starting price
    const startTime = this.config.startDate.getTime();
    const endTime = this.config.endDate.getTime();
    const interval = this.getTimeframeMilliseconds();
    
    for (let time = startTime; time <= endTime; time += interval) {
      // Random walk with trend and volatility
      const trend = (Math.random() - 0.5) * 0.001;
      const volatility = Math.random() * 0.02;
      const change = trend + (Math.random() - 0.5) * volatility;
      
      price = Math.max(price * (1 + change), 100); // Minimum price floor
      
      const volume = 1000 + Math.random() * 5000;
      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);
      
      data.push({
        time: new Date(time),
        open: price,
        high: Math.max(price, high),
        low: Math.min(price, low),
        close: price,
        volume
      });
    }
    
    return data;
  }

  private getTimeframeMilliseconds(): number {
    const timeframeMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return timeframeMap[this.config.timeframe] || timeframeMap['1h'];
  }

  private initializeState(): EnvironmentState {
    const stateSize = this.config.stateVectorSize;
    
    return {
      marketFeatures: new Float32Array(stateSize * 0.6), // 60% for market features
      portfolioState: new Float32Array(stateSize * 0.2), // 20% for portfolio
      riskMetrics: new Float32Array(stateSize * 0.1), // 10% for risk
      timeFeatures: new Float32Array(stateSize * 0.1), // 10% for time
      condition: 'SIDEWAYS',
      volatility: 0,
      trendStrength: 0,
      positions: new Map(),
      cash: this.config.initialCapital,
      equity: this.config.initialCapital,
      drawdown: 0,
      timestamp: new Date(),
      stepCount: 0,
      episodeLength: this.config.maxEpisodeLength
    };
  }

  private initializeMetrics(): EnvironmentMetrics {
    return {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      calmarRatio: 0,
      volatility: 0,
      averageReward: 0,
      cumulativeReward: 0,
      explorationRate: 0,
      actionDistribution: {
        'BUY': 0,
        'SELL': 0,
        'HOLD': 0,
        'CLOSE_LONG': 0,
        'CLOSE_SHORT': 0
      },
      valueAtRisk: 0,
      conditionalVaR: 0,
      riskAdjustedReturn: 0
    };
  }

  private async updateStateFeatures(): Promise<void> {
    if (this.currentIndex >= this.historicalData.length) {
      return;
    }
    
    // Get current and historical data window
    const lookbackPeriod = 60;
    const startIndex = Math.max(0, this.currentIndex - lookbackPeriod);
    const window = this.historicalData.slice(startIndex, this.currentIndex + 1);
    
    if (window.length < 10) return;
    
    // Generate market features using feature engine
    const features = await featureEngine.computeFeatures(window);
    
    // Update market features
    this.updateMarketFeatures(features);
    
    // Update portfolio state
    this.updatePortfolioState();
    
    // Update risk metrics
    this.updateRiskMetrics();
    
    // Update time features
    this.updateTimeFeatures();
    
    // Update market condition metrics
    this.updateConditionMetrics(window);
  }

  private updateMarketFeatures(features: FeatureVector): void {
    let featureIndex = 0;
    
    // Technical indicators
    if (features.technical) {
      Object.values(features.technical).forEach(value => {
        if (featureIndex < this.state.marketFeatures.length * 0.8) {
          this.state.marketFeatures[featureIndex++] = this.normalizeFeature(value);
        }
      });
    }
    
    // Price features
    if (features.price) {
      Object.values(features.price).forEach(value => {
        if (featureIndex < this.state.marketFeatures.length) {
          this.state.marketFeatures[featureIndex++] = this.normalizeFeature(value);
        }
      });
    }
  }

  private updatePortfolioState(): void {
    const equity = this.calculateEquity();
    const totalPositionSize = Array.from(this.state.positions.values())
      .reduce((sum, pos) => sum + Math.abs(pos), 0);
    
    this.state.portfolioState[0] = this.state.cash / this.config.initialCapital; // Cash ratio
    this.state.portfolioState[1] = totalPositionSize; // Total position exposure
    this.state.portfolioState[2] = equity / this.config.initialCapital; // Equity ratio
    this.state.portfolioState[3] = this.state.drawdown; // Current drawdown
  }

  private updateRiskMetrics(): void {
    const equity = this.calculateEquity();
    const peak = Math.max(...this.equityCurve);
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    
    this.state.riskMetrics[0] = drawdown; // Current drawdown
    this.state.riskMetrics[1] = this.calculateVolatility(); // Portfolio volatility
    this.state.drawdown = drawdown;
    this.state.equity = equity;
  }

  private updateTimeFeatures(): void {
    const current = this.getCurrentCandle();
    if (!current) return;
    
    const timestamp = new Date(current.time);
    this.state.timestamp = timestamp;
    
    this.state.timeFeatures[0] = timestamp.getHours() / 24; // Hour of day
    this.state.timeFeatures[1] = timestamp.getDay() / 7; // Day of week
    this.state.timeFeatures[2] = timestamp.getMonth() / 12; // Month of year
    this.state.timeFeatures[3] = this.state.stepCount / this.config.maxEpisodeLength; // Episode progress
  }

  private updateConditionMetrics(window: any[]): void {
    if (window.length < 20) return;
    
    const prices = window.map(d => d.close);
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    
    // Calculate volatility
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    this.state.volatility = volatility;
    
    // Calculate trend strength
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const trend = (lastPrice - firstPrice) / firstPrice;
    this.state.trendStrength = Math.abs(trend);
  }

  private async executeAction(action: Action): Promise<any> {
    if (!this.isValidAction(action)) {
      return { success: false, reason: 'Invalid action' };
    }
    
    const currentPrice = this.getCurrentPrice();
    let executedPrice = currentPrice;
    let executedSize = action.size;
    
    // Apply slippage and market impact
    if (this.config.enableSlippage) {
      const slippage = this.calculateSlippage(action);
      executedPrice = action.type === 'BUY' ? 
        currentPrice * (1 + slippage) : 
        currentPrice * (1 - slippage);
    }
    
    // Calculate costs
    const notionalValue = executedPrice * executedSize * this.config.initialCapital;
    const commission = this.config.enableCommission ? notionalValue * this.config.commission : 0;
    
    // Execute position change
    const symbol = action.symbol || this.config.symbols[0];
    const currentPosition = this.state.positions.get(symbol) || 0;
    
    let newPosition = currentPosition;
    let cashChange = -commission;
    
    switch (action.type) {
      case 'BUY':
        if (this.state.cash >= notionalValue + commission) {
          newPosition += executedSize;
          cashChange -= notionalValue;
        } else {
          return { success: false, reason: 'Insufficient cash' };
        }
        break;
        
      case 'SELL':
        newPosition -= executedSize;
        cashChange += notionalValue;
        break;
        
      case 'CLOSE_LONG':
        if (currentPosition > 0) {
          const closeSize = Math.min(executedSize, currentPosition);
          newPosition = currentPosition - closeSize;
          cashChange += executedPrice * closeSize * this.config.initialCapital;
        }
        break;
        
      case 'CLOSE_SHORT':
        if (currentPosition < 0) {
          const closeSize = Math.min(executedSize, Math.abs(currentPosition));
          newPosition = currentPosition + closeSize;
          cashChange -= executedPrice * closeSize * this.config.initialCapital;
        }
        break;
        
      case 'HOLD':
        // No position change
        break;
    }
    
    // Update state
    this.state.positions.set(symbol, newPosition);
    this.state.cash += cashChange;
    this.actionHistory.push(action);
    
    return {
      success: true,
      executedPrice,
      executedSize,
      commission,
      slippage: Math.abs(executedPrice - currentPrice) / currentPrice,
      newPosition,
      cashChange
    };
  }

  private calculateReward(action: Action, executionResult: any): number {
    // This is a simplified reward calculation
    // The RewardEngine will provide more sophisticated reward computation
    
    if (!executionResult.success) {
      return -0.1; // Penalty for invalid actions
    }
    
    const currentEquity = this.calculateEquity();
    const previousEquity = this.equityCurve[this.equityCurve.length - 1];
    const returnRate = (currentEquity - previousEquity) / previousEquity;
    
    // Basic reward based on return
    let reward = returnRate * 100; // Scale up
    
    // Risk adjustment
    const drawdown = this.state.drawdown;
    if (drawdown > 0.05) { // Penalize drawdown > 5%
      reward -= drawdown * 10;
    }
    
    // Action-specific rewards/penalties
    if (action.type === 'HOLD' && Math.abs(returnRate) < 0.001) {
      reward += 0.01; // Small reward for holding in stable conditions
    }
    
    return reward;
  }

  private checkEpisodeComplete(): boolean {
    // Episode complete conditions
    if (this.state.stepCount >= this.config.maxEpisodeLength) {
      return true;
    }
    
    if (this.currentIndex >= this.historicalData.length - 1) {
      return true;
    }
    
    // Risk-based termination
    if (this.state.drawdown > 0.5) { // 50% drawdown
      return true;
    }
    
    if (this.state.cash < 0 && this.calculateEquity() <= 0) {
      return true; // Bankruptcy
    }
    
    return false;
  }

  private updateEpisodeMetrics(action: Action, reward: number): void {
    // Update action distribution
    this.episodeMetrics.actionDistribution[action.type]++;
    
    // Update reward metrics
    this.episodeMetrics.cumulativeReward += reward;
    this.episodeMetrics.averageReward = this.episodeMetrics.cumulativeReward / (this.state.stepCount || 1);
    
    // Update portfolio metrics
    const equity = this.calculateEquity();
    this.equityCurve.push(equity);
    
    this.episodeMetrics.totalReturn = (equity - this.config.initialCapital) / this.config.initialCapital;
    this.episodeMetrics.maxDrawdown = Math.max(this.episodeMetrics.maxDrawdown, this.state.drawdown);
    
    // Calculate Sharpe ratio (simplified)
    if (this.equityCurve.length > 10) {
      const returns = this.equityCurve.slice(1).map((equity, i) => 
        (equity - this.equityCurve[i]) / this.equityCurve[i]
      );
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const volatility = Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length);
      this.episodeMetrics.sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
    }
  }

  private calculateEquity(): number {
    const currentPrice = this.getCurrentPrice();
    let equity = this.state.cash;
    
    // Add position values
    for (const [symbol, position] of this.state.positions) {
      equity += position * currentPrice * this.config.initialCapital;
    }
    
    return Math.max(0, equity);
  }

  private calculateVolatility(): number {
    if (this.equityCurve.length < 10) return 0;
    
    const returns = this.equityCurve.slice(-20).slice(1).map((equity, i) => {
      const prevEquity = this.equityCurve[this.equityCurve.length - 20 + i];
      return prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0;
    });
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateActionCost(action: Action): number {
    const currentPrice = this.getCurrentPrice();
    const notionalValue = action.size * currentPrice * this.config.initialCapital;
    const commission = this.config.enableCommission ? notionalValue * this.config.commission : 0;
    
    return notionalValue + commission;
  }

  private calculateSlippage(action: Action): number {
    // Simplified slippage calculation
    let baseSlippage = this.config.slippage;
    
    // Increase slippage for larger positions
    if (action.size > 0.1) {
      baseSlippage *= (1 + action.size);
    }
    
    // Add market impact
    if (this.config.realisticFills) {
      baseSlippage += this.config.marketImpact * action.size;
    }
    
    return baseSlippage;
  }

  private getCurrentPrice(): number {
    const currentCandle = this.getCurrentCandle();
    return currentCandle ? currentCandle.close : 50000; // Fallback price
  }

  private getCurrentCandle(): any {
    if (this.currentIndex >= 0 && this.currentIndex < this.historicalData.length) {
      return this.historicalData[this.currentIndex];
    }
    return null;
  }

  private getRandomStartIndex(): number {
    const minIndex = 100; // Need some history
    const maxIndex = this.historicalData.length - this.config.maxEpisodeLength - 100;
    return Math.floor(Math.random() * (maxIndex - minIndex)) + minIndex;
  }

  private selectRandomCondition(): MarketCondition {
    const conditions = this.config.marketConditions;
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  private normalizeFeature(value: number): number {
    // Simple tanh normalization
    return Math.tanh(value);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.historicalData = [];
    this.environments.clear();
    this.equityCurve = [];
    this.actionHistory = [];
    this.rewardHistory = [];
  }
}

// Default environment configurations
export const DEFAULT_ENVIRONMENT_CONFIGS = {
  training: {
    symbols: ['BTC-USD', 'ETH-USD'],
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-01-01'),
    timeframe: '1h',
    initialCapital: 10000,
    commission: 0.001,
    slippage: 0.001,
    borrowRate: 0.05,
    maxPositionSize: 0.3,
    maxLeverage: 3,
    marginRequirement: 0.1,
    actionSpace: ['BUY', 'SELL', 'HOLD', 'CLOSE_LONG', 'CLOSE_SHORT'] as ActionType[],
    stateVectorSize: 100,
    maxEpisodeLength: 1000,
    enableSlippage: true,
    enableCommission: true,
    realisticFills: true,
    marketImpact: 0.0005,
    marketConditions: ['TRENDING_UP', 'TRENDING_DOWN', 'SIDEWAYS', 'VOLATILE'] as MarketCondition[],
    dynamicConditions: true
  },
  
  testing: {
    symbols: ['BTC-USD'],
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-06-01'),
    timeframe: '15m',
    initialCapital: 5000,
    commission: 0.0005,
    slippage: 0.0005,
    borrowRate: 0.03,
    maxPositionSize: 0.5,
    maxLeverage: 2,
    marginRequirement: 0.2,
    actionSpace: ['BUY', 'SELL', 'HOLD'] as ActionType[],
    stateVectorSize: 50,
    maxEpisodeLength: 500,
    enableSlippage: false,
    enableCommission: false,
    realisticFills: false,
    marketImpact: 0,
    marketConditions: ['SIDEWAYS'] as MarketCondition[],
    dynamicConditions: false
  }
};