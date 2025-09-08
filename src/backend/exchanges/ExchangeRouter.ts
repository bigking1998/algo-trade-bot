/**
 * Exchange Router - Intelligent Order Routing System
 * 
 * Advanced order routing engine that optimally distributes orders across
 * multiple exchanges based on real-time conditions, liquidity, fees, and
 * execution quality. Features smart routing algorithms, liquidity aggregation,
 * and dynamic exchange selection.
 * 
 * Performance Targets:
 * - Routing decision latency < 10ms
 * - Best execution rate > 95%
 * - Cost savings through optimal routing > 5%
 * - Support for complex order types and strategies
 */

import { EventEmitter } from 'events';
import type { MultiExchangeFramework } from './MultiExchangeFramework.js';
import type { BaseExchangeConnector } from './BaseExchangeConnector.js';
import type {
  ExchangeId,
  UnifiedMarketData,
  UnifiedOrderBook,
  OrderRoutingStrategy,
  ExchangeHealth,
  ExchangeTradingFees
} from './types.js';
import type { Order, OrderExecutionResult } from '../execution/OrderExecutor.js';

/**
 * Routing Decision Context
 */
interface RoutingContext {
  order: Order;
  strategy: OrderRoutingStrategy;
  availableExchanges: ExchangeId[];
  marketData: Map<ExchangeId, UnifiedMarketData>;
  orderBooks: Map<ExchangeId, UnifiedOrderBook>;
  exchangeHealth: Map<ExchangeId, ExchangeHealth>;
  tradingFees: Map<ExchangeId, ExchangeTradingFees>;
  timestamp: Date;
}

/**
 * Exchange Scoring Metrics
 */
interface ExchangeScore {
  exchangeId: ExchangeId;
  totalScore: number;
  
  // Individual scores (0-100)
  priceScore: number;        // Price competitiveness
  liquidityScore: number;    // Available liquidity
  feeScore: number;         // Fee competitiveness
  reliabilityScore: number;  // Exchange health/reliability
  speedScore: number;       // Expected execution speed
  
  // Calculated metrics
  expectedPrice: number;
  availableLiquidity: number;
  estimatedFees: number;
  estimatedLatency: number;
  
  // Risk assessment
  riskScore: number;
  riskFactors: string[];
}

/**
 * Split Order Plan
 */
interface SplitOrderPlan {
  id: string;
  originalOrder: Order;
  
  splits: Array<{
    exchangeId: ExchangeId;
    order: Order;
    percentage: number;
    estimatedPrice: number;
    estimatedFees: number;
  }>;
  
  totalEstimatedCost: number;
  expectedImprovement: number; // vs best single exchange
  riskScore: number;
  
  createdAt: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * Execution Result
 */
interface RoutedExecutionResult {
  success: boolean;
  originalOrder: Order;
  strategy: OrderRoutingStrategy;
  
  // Execution details
  selectedExchange?: ExchangeId;
  splitPlan?: SplitOrderPlan;
  executionResults: Array<{
    exchangeId: ExchangeId;
    result: OrderExecutionResult;
  }>;
  
  // Performance metrics
  totalExecutionTime: number;
  routingDecisionTime: number;
  costSavings: number;        // vs worst alternative
  executionQuality: number;   // 0-1 score
  
  // Aggregated results
  totalExecutedQuantity: number;
  weightedAveragePrice: number;
  totalFees: number;
  
  error?: string;
  warnings: string[];
}

/**
 * Router Configuration
 */
export interface ExchangeRouterConfig {
  // Routing preferences
  defaultStrategy: OrderRoutingStrategy;
  enableSplitOrders: boolean;
  maxSplits: number;
  minSplitSize: number;
  
  // Performance thresholds
  maxRoutingLatency: number;
  maxExecutionLatency: number;
  minLiquidityThreshold: number;
  maxSlippageThreshold: number;
  
  // Quality targets
  minExecutionQuality: number;
  targetCostSavings: number;
  reliabilityWeight: number;    // 0-1, how much to weight reliability
  costWeight: number;           // 0-1, how much to weight cost
  
  // Risk management
  enableRiskAssessment: boolean;
  maxRiskScore: number;
  diversificationBonus: number; // Bonus for spreading across exchanges
  
  // Monitoring and optimization
  enablePerformanceTracking: boolean;
  adaptiveRouting: boolean;     // Learn from past performance
  routingCacheTime: number;     // Cache routing decisions
  
  // Fallback behavior
  enableFallback: boolean;
  fallbackStrategy: 'best_available' | 'random' | 'round_robin';
  maxRetryAttempts: number;
}

/**
 * Main Exchange Router Class
 */
export class ExchangeRouter extends EventEmitter {
  private config: ExchangeRouterConfig;
  private framework: MultiExchangeFramework;
  
  // Routing cache
  private routingCache = new Map<string, ExchangeScore[]>();
  private marketDataCache = new Map<string, Map<ExchangeId, UnifiedMarketData>>();
  private lastCacheUpdate = new Map<string, Date>();
  
  // Performance tracking
  private routingHistory: RoutedExecutionResult[] = [];
  private exchangePerformance = new Map<ExchangeId, {
    executionCount: number;
    successRate: number;
    averageLatency: number;
    averageFees: number;
    qualityScore: number;
  }>();
  
  // Active executions
  private activeExecutions = new Map<string, SplitOrderPlan>();
  
  constructor(framework: MultiExchangeFramework, config: Partial<ExchangeRouterConfig> = {}) {
    super();
    
    this.framework = framework;
    this.config = this.mergeWithDefaults(config);
    
    this.setupEventHandlers();
  }
  
  /**
   * Route and execute an order using the specified strategy
   */
  async routeOrder(
    order: Order,
    strategy?: OrderRoutingStrategy
  ): Promise<RoutedExecutionResult> {
    const routingStartTime = performance.now();
    const routingStrategy = strategy || this.config.defaultStrategy;
    
    try {
      // Build routing context
      const context = await this.buildRoutingContext(order, routingStrategy);
      
      // Make routing decision
      const routingDecision = await this.makeRoutingDecision(context);
      const routingDecisionTime = performance.now() - routingStartTime;
      
      // Validate routing decision
      if (!this.validateRoutingDecision(routingDecision, context)) {
        throw new Error('Routing decision validation failed');
      }
      
      // Execute the routing plan
      const executionStartTime = performance.now();
      const result = await this.executeRoutingPlan(routingDecision, context);
      const totalExecutionTime = performance.now() - routingStartTime;
      
      // Build final result
      const routedResult: RoutedExecutionResult = {
        success: result.success,
        originalOrder: order,
        strategy: routingStrategy,
        ...result,
        totalExecutionTime,
        routingDecisionTime,
        costSavings: this.calculateCostSavings(context, result),
        executionQuality: this.calculateExecutionQuality(context, result)
      };
      
      // Update performance tracking
      this.updatePerformanceMetrics(routedResult);
      
      // Cache results for adaptive learning
      if (this.config.adaptiveRouting) {
        this.updateRoutingCache(context, routedResult);
      }
      
      this.emit('order_routed', {
        orderId: order.id,
        strategy: routingStrategy.type,
        result: routedResult,
        timestamp: new Date()
      });
      
      return routedResult;
      
    } catch (error) {
      const errorResult: RoutedExecutionResult = {
        success: false,
        originalOrder: order,
        strategy: routingStrategy,
        executionResults: [],
        totalExecutionTime: performance.now() - routingStartTime,
        routingDecisionTime: 0,
        costSavings: 0,
        executionQuality: 0,
        totalExecutedQuantity: 0,
        weightedAveragePrice: 0,
        totalFees: 0,
        error: error instanceof Error ? error.message : String(error),
        warnings: []
      };
      
      this.updatePerformanceMetrics(errorResult);
      
      this.emit('routing_error', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      
      throw error;
    }
  }
  
  /**
   * Get best exchange for a given order
   */
  async getBestExchange(
    order: Order,
    excludeExchanges: ExchangeId[] = []
  ): Promise<ExchangeScore | null> {
    try {
      const strategy: OrderRoutingStrategy = {
        ...this.config.defaultStrategy,
        type: 'best_price'
      };
      
      const context = await this.buildRoutingContext(order, strategy);
      const scores = await this.scoreExchanges(context);
      
      const availableScores = scores
        .filter(score => !excludeExchanges.includes(score.exchangeId))
        .filter(score => score.totalScore >= this.config.minExecutionQuality * 100);
      
      return availableScores.length > 0 ? availableScores[0] : null;
      
    } catch (error) {
      this.emit('best_exchange_error', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      return null;
    }
  }
  
  /**
   * Get routing recommendations for an order
   */
  async getRoutingRecommendations(order: Order): Promise<{
    singleExchange: ExchangeScore[];
    splitOrder?: SplitOrderPlan;
    recommendation: 'single' | 'split' | 'wait';
    reasoning: string[];
  }> {
    try {
      const strategy: OrderRoutingStrategy = {
        ...this.config.defaultStrategy,
        type: 'smart_routing'
      };
      
      const context = await this.buildRoutingContext(order, strategy);
      const scores = await this.scoreExchanges(context);
      
      let splitPlan: SplitOrderPlan | undefined;
      if (this.config.enableSplitOrders && order.quantity >= this.config.minSplitSize * 2) {
        splitPlan = await this.createSplitOrderPlan(context, scores);
      }
      
      // Determine recommendation
      const bestSingle = scores[0];
      const reasoning: string[] = [];
      
      let recommendation: 'single' | 'split' | 'wait' = 'single';
      
      if (!bestSingle || bestSingle.totalScore < this.config.minExecutionQuality * 100) {
        recommendation = 'wait';
        reasoning.push('Market conditions are not favorable');
      } else if (splitPlan && splitPlan.expectedImprovement > this.config.targetCostSavings) {
        recommendation = 'split';
        reasoning.push(`Split order would save ${splitPlan.expectedImprovement.toFixed(2)}%`);
      } else {
        recommendation = 'single';
        reasoning.push(`Best execution available on ${bestSingle.exchangeId}`);
      }
      
      // Add specific reasoning
      if (bestSingle) {
        if (bestSingle.priceScore >= 90) reasoning.push('Excellent price available');
        if (bestSingle.liquidityScore >= 90) reasoning.push('High liquidity available');
        if (bestSingle.feeScore >= 80) reasoning.push('Competitive fees');
        if (bestSingle.reliabilityScore >= 95) reasoning.push('High reliability exchange');
      }
      
      return {
        singleExchange: scores,
        splitOrder: splitPlan,
        recommendation,
        reasoning
      };
      
    } catch (error) {
      return {
        singleExchange: [],
        recommendation: 'wait',
        reasoning: ['Error analyzing routing options']
      };
    }
  }
  
  /**
   * Get router performance metrics
   */
  getPerformanceMetrics(): {
    totalOrders: number;
    successRate: number;
    averageRoutingTime: number;
    averageCostSavings: number;
    averageExecutionQuality: number;
    exchangePerformance: Map<ExchangeId, any>;
  } {
    const successfulOrders = this.routingHistory.filter(r => r.success);
    
    return {
      totalOrders: this.routingHistory.length,
      successRate: successfulOrders.length / this.routingHistory.length * 100,
      averageRoutingTime: this.routingHistory.reduce((sum, r) => sum + r.routingDecisionTime, 0) / this.routingHistory.length,
      averageCostSavings: successfulOrders.reduce((sum, r) => sum + r.costSavings, 0) / successfulOrders.length,
      averageExecutionQuality: successfulOrders.reduce((sum, r) => sum + r.executionQuality, 0) / successfulOrders.length,
      exchangePerformance: this.exchangePerformance
    };
  }
  
  // === PRIVATE METHODS ===
  
  private async buildRoutingContext(
    order: Order,
    strategy: OrderRoutingStrategy
  ): Promise<RoutingContext> {
    const availableExchanges = this.framework.getActiveExchanges();
    
    if (availableExchanges.length === 0) {
      throw new Error('No active exchanges available');
    }
    
    // Get market data
    const marketData = await this.getMarketDataWithCache(order.symbol);
    const orderBooks = await this.framework.getAggregatedOrderBook(order.symbol, 50);
    const exchangeHealth = new Map<ExchangeId, ExchangeHealth>();
    const tradingFees = new Map<ExchangeId, ExchangeTradingFees>();
    
    // Get exchange health and fees
    for (const exchangeId of availableExchanges) {
      try {
        const health = this.framework.getExchangeHealth(exchangeId)[0];
        if (health) {
          exchangeHealth.set(exchangeId, health);
        }
      } catch (error) {
        // Skip if health data unavailable
      }
    }
    
    return {
      order,
      strategy,
      availableExchanges,
      marketData,
      orderBooks,
      exchangeHealth,
      tradingFees,
      timestamp: new Date()
    };
  }
  
  private async makeRoutingDecision(context: RoutingContext): Promise<{
    type: 'single' | 'split';
    singleExchange?: ExchangeId;
    splitPlan?: SplitOrderPlan;
    success: boolean;
  }> {
    const scores = await this.scoreExchanges(context);
    
    if (scores.length === 0) {
      throw new Error('No suitable exchanges found');
    }
    
    // Check if split order would be beneficial
    if (this.config.enableSplitOrders && 
        context.order.quantity >= this.config.minSplitSize * 2 &&
        scores.length > 1) {
      
      const splitPlan = await this.createSplitOrderPlan(context, scores);
      
      if (splitPlan && splitPlan.expectedImprovement > this.config.targetCostSavings) {
        return {
          type: 'split',
          splitPlan,
          success: true
        };
      }
    }
    
    // Use single best exchange
    const bestExchange = scores[0];
    if (bestExchange.totalScore >= this.config.minExecutionQuality * 100) {
      return {
        type: 'single',
        singleExchange: bestExchange.exchangeId,
        success: true
      };
    }
    
    throw new Error('No exchange meets minimum quality requirements');
  }
  
  private async scoreExchanges(context: RoutingContext): Promise<ExchangeScore[]> {
    const scores: ExchangeScore[] = [];
    
    for (const exchangeId of context.availableExchanges) {
      try {
        const score = await this.scoreExchange(exchangeId, context);
        scores.push(score);
      } catch (error) {
        this.emit('exchange_scoring_error', {
          exchangeId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }
    
    // Sort by total score (descending)
    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }
  
  private async scoreExchange(exchangeId: ExchangeId, context: RoutingContext): Promise<ExchangeScore> {
    const marketData = context.marketData.get(exchangeId);
    const orderBook = context.orderBooks.get(exchangeId);
    const health = context.exchangeHealth.get(exchangeId);
    
    if (!marketData || !orderBook) {
      throw new Error(`Missing data for exchange ${exchangeId}`);
    }
    
    // Calculate individual scores
    const priceScore = this.calculatePriceScore(exchangeId, context.order, marketData, orderBook);
    const liquidityScore = this.calculateLiquidityScore(context.order, orderBook);
    const feeScore = await this.calculateFeeScore(exchangeId, context.order.symbol, context.order);
    const reliabilityScore = this.calculateReliabilityScore(exchangeId, health);
    const speedScore = this.calculateSpeedScore(exchangeId, health);
    
    // Calculate weighted total score
    const weights = {
      price: this.config.costWeight,
      liquidity: 0.25,
      fee: this.config.costWeight * 0.5,
      reliability: this.config.reliabilityWeight,
      speed: 0.15
    };
    
    const totalScore = (
      priceScore * weights.price +
      liquidityScore * weights.liquidity +
      feeScore * weights.fee +
      reliabilityScore * weights.reliability +
      speedScore * weights.speed
    ) / (weights.price + weights.liquidity + weights.fee + weights.reliability + weights.speed);
    
    // Calculate additional metrics
    const expectedPrice = context.order.side === 'buy' ? marketData.ask : marketData.bid;
    const availableLiquidity = context.order.side === 'buy' ? orderBook.askVolume : orderBook.bidVolume;
    const estimatedFees = await this.estimateFees(exchangeId, context.order);
    const estimatedLatency = health ? health.latency : 100;
    
    // Risk assessment
    const riskScore = this.calculateRiskScore(exchangeId, context, marketData, orderBook);
    const riskFactors = this.identifyRiskFactors(exchangeId, context, marketData, orderBook, health);
    
    return {
      exchangeId,
      totalScore,
      priceScore,
      liquidityScore,
      feeScore,
      reliabilityScore,
      speedScore,
      expectedPrice,
      availableLiquidity,
      estimatedFees,
      estimatedLatency,
      riskScore,
      riskFactors
    };
  }
  
  private calculatePriceScore(
    exchangeId: ExchangeId,
    order: Order,
    marketData: UnifiedMarketData,
    orderBook: UnifiedOrderBook
  ): number {
    const relevantPrice = order.side === 'buy' ? marketData.ask : marketData.bid;
    const midPrice = marketData.price;
    
    // Score based on how competitive the price is
    const priceDeviation = Math.abs((relevantPrice - midPrice) / midPrice);
    const score = Math.max(0, 100 - (priceDeviation * 10000)); // 100 basis points = 100% deviation
    
    return Math.min(100, Math.max(0, score));
  }
  
  private calculateLiquidityScore(order: Order, orderBook: UnifiedOrderBook): number {
    const requiredLiquidity = order.quantity;
    const availableLiquidity = order.side === 'buy' ? orderBook.askVolume : orderBook.bidVolume;
    
    if (availableLiquidity >= requiredLiquidity * 2) {
      return 100; // Excellent liquidity
    } else if (availableLiquidity >= requiredLiquidity) {
      return 80; // Good liquidity
    } else if (availableLiquidity >= requiredLiquidity * 0.5) {
      return 60; // Moderate liquidity
    } else {
      return 30; // Poor liquidity
    }
  }
  
  private async calculateFeeScore(exchangeId: ExchangeId, symbol: string, order: Order): Promise<number> {
    try {
      // This would get actual fees from the exchange
      // For now, use estimated fees based on exchange
      const estimatedFeeRate = this.getEstimatedFeeRate(exchangeId);
      const notionalValue = (order.price || 0) * order.quantity;
      const estimatedFees = notionalValue * estimatedFeeRate;
      
      // Score inversely related to fee rate (lower fees = higher score)
      const feeRatePercent = estimatedFeeRate * 100;
      return Math.max(0, 100 - (feeRatePercent * 200)); // 0.5% fee = 0 score
      
    } catch (error) {
      return 50; // Neutral score if fees can't be determined
    }
  }
  
  private calculateReliabilityScore(exchangeId: ExchangeId, health?: ExchangeHealth): number {
    if (!health) {
      return 70; // Default score if health unknown
    }
    
    let score = 50;
    
    // Uptime contribution
    score += (health.uptime - 90) * 2; // 95% uptime = +10 points
    
    // Latency contribution
    if (health.latency < 50) score += 20;
    else if (health.latency < 100) score += 10;
    else if (health.latency > 200) score -= 10;
    
    // Error rate contribution
    if (health.errorRate < 1) score += 15;
    else if (health.errorRate < 5) score += 5;
    else if (health.errorRate > 10) score -= 20;
    
    // Historical performance
    const exchangePerf = this.exchangePerformance.get(exchangeId);
    if (exchangePerf) {
      score += (exchangePerf.successRate - 90) * 0.5;
      score += exchangePerf.qualityScore * 0.2;
    }
    
    return Math.min(100, Math.max(0, score));
  }
  
  private calculateSpeedScore(exchangeId: ExchangeId, health?: ExchangeHealth): number {
    if (!health) {
      return 70; // Default score
    }
    
    // Score based on latency
    if (health.latency < 50) return 100;
    if (health.latency < 100) return 80;
    if (health.latency < 200) return 60;
    if (health.latency < 500) return 40;
    return 20;
  }
  
  private calculateRiskScore(
    exchangeId: ExchangeId,
    context: RoutingContext,
    marketData: UnifiedMarketData,
    orderBook: UnifiedOrderBook
  ): number {
    let score = 20; // Base risk score
    
    // Liquidity risk
    const requiredLiquidity = context.order.quantity;
    const availableLiquidity = context.order.side === 'buy' ? orderBook.askVolume : orderBook.bidVolume;
    if (availableLiquidity < requiredLiquidity * 1.5) score += 20;
    
    // Spread risk
    const spreadPercent = (orderBook.spread / marketData.price) * 100;
    if (spreadPercent > 0.1) score += 10;
    if (spreadPercent > 0.5) score += 20;
    
    // Health risk
    const health = context.exchangeHealth.get(exchangeId);
    if (health) {
      if (health.errorRate > 5) score += 15;
      if (health.uptime < 95) score += 10;
      if (health.latency > 200) score += 10;
    }
    
    return Math.min(100, score);
  }
  
  private identifyRiskFactors(
    exchangeId: ExchangeId,
    context: RoutingContext,
    marketData: UnifiedMarketData,
    orderBook: UnifiedOrderBook,
    health?: ExchangeHealth
  ): string[] {
    const factors: string[] = [];
    
    const requiredLiquidity = context.order.quantity;
    const availableLiquidity = context.order.side === 'buy' ? orderBook.askVolume : orderBook.bidVolume;
    
    if (availableLiquidity < requiredLiquidity * 1.2) {
      factors.push('insufficient_liquidity');
    }
    
    const spreadPercent = (orderBook.spread / marketData.price) * 100;
    if (spreadPercent > 0.2) {
      factors.push('wide_spread');
    }
    
    if (health) {
      if (health.errorRate > 5) factors.push('high_error_rate');
      if (health.uptime < 98) factors.push('reliability_concerns');
      if (health.latency > 150) factors.push('high_latency');
    }
    
    if (marketData.quality !== 'realtime') {
      factors.push('stale_data');
    }
    
    return factors;
  }
  
  private async createSplitOrderPlan(
    context: RoutingContext,
    scores: ExchangeScore[]
  ): Promise<SplitOrderPlan | null> {
    if (scores.length < 2) {
      return null;
    }
    
    const planId = `split_${context.order.id}_${Date.now()}`;
    const totalQuantity = context.order.quantity;
    
    // Simple split strategy: distribute based on liquidity and scores
    const eligibleExchanges = scores
      .filter(s => s.totalScore >= 70) // Minimum quality threshold
      .filter(s => s.availableLiquidity >= totalQuantity * 0.1) // Minimum 10% of order
      .slice(0, this.config.maxSplits);
    
    if (eligibleExchanges.length < 2) {
      return null;
    }
    
    // Calculate split percentages
    const splits = this.calculateOptimalSplits(eligibleExchanges, totalQuantity);
    
    const splitOrders = splits.map(split => ({
      exchangeId: split.exchangeId,
      order: {
        ...context.order,
        id: `${context.order.id}_${split.exchangeId}`,
        quantity: split.quantity
      },
      percentage: (split.quantity / totalQuantity) * 100,
      estimatedPrice: split.estimatedPrice,
      estimatedFees: split.estimatedFees
    }));
    
    const totalEstimatedCost = splitOrders.reduce((sum, split) => 
      sum + (split.estimatedPrice * split.order.quantity) + split.estimatedFees, 0
    );
    
    const bestSingleCost = (scores[0].expectedPrice * totalQuantity) + scores[0].estimatedFees;
    const expectedImprovement = ((bestSingleCost - totalEstimatedCost) / bestSingleCost) * 100;
    
    // Calculate combined risk score
    const weightedRiskScore = splitOrders.reduce((sum, split, index) => 
      sum + (scores[index].riskScore * split.percentage / 100), 0
    );
    
    const plan: SplitOrderPlan = {
      id: planId,
      originalOrder: context.order,
      splits: splitOrders,
      totalEstimatedCost,
      expectedImprovement,
      riskScore: weightedRiskScore,
      createdAt: new Date(),
      status: 'pending'
    };
    
    return plan;
  }
  
  private calculateOptimalSplits(exchanges: ExchangeScore[], totalQuantity: number): Array<{
    exchangeId: ExchangeId;
    quantity: number;
    estimatedPrice: number;
    estimatedFees: number;
  }> {
    // Simple strategy: weight by score and available liquidity
    const totalScore = exchanges.reduce((sum, ex) => sum + ex.totalScore, 0);
    
    return exchanges.map(exchange => {
      const weight = exchange.totalScore / totalScore;
      let quantity = totalQuantity * weight;
      
      // Ensure minimum split size
      quantity = Math.max(quantity, this.config.minSplitSize);
      
      // Ensure doesn't exceed available liquidity
      quantity = Math.min(quantity, exchange.availableLiquidity * 0.8);
      
      return {
        exchangeId: exchange.exchangeId,
        quantity,
        estimatedPrice: exchange.expectedPrice,
        estimatedFees: exchange.estimatedFees
      };
    });
  }
  
  private validateRoutingDecision(decision: any, context: RoutingContext): boolean {
    if (decision.type === 'single') {
      return decision.singleExchange && 
             context.availableExchanges.includes(decision.singleExchange);
    }
    
    if (decision.type === 'split') {
      return decision.splitPlan && 
             decision.splitPlan.splits.every(split => 
               context.availableExchanges.includes(split.exchangeId)
             );
    }
    
    return false;
  }
  
  private async executeRoutingPlan(decision: any, context: RoutingContext): Promise<{
    success: boolean;
    selectedExchange?: ExchangeId;
    splitPlan?: SplitOrderPlan;
    executionResults: Array<{
      exchangeId: ExchangeId;
      result: OrderExecutionResult;
    }>;
    totalExecutedQuantity: number;
    weightedAveragePrice: number;
    totalFees: number;
    warnings: string[];
  }> {
    if (decision.type === 'single') {
      return this.executeSingleOrder(decision.singleExchange!, context);
    } else {
      return this.executeSplitOrder(decision.splitPlan!, context);
    }
  }
  
  private async executeSingleOrder(exchangeId: ExchangeId, context: RoutingContext): Promise<any> {
    try {
      const result = await this.framework.executeOrder(context.order, {
        type: 'best_price',
        exchanges: [exchangeId],
        weights: { [exchangeId]: 1 },
        maxSlippage: context.strategy.maxSlippage,
        timeoutMs: context.strategy.timeoutMs,
        retryAttempts: context.strategy.retryAttempts,
        maxOrderSize: context.strategy.maxOrderSize,
        concentrationLimit: context.strategy.concentrationLimit,
        allowPartialFills: context.strategy.allowPartialFills
      });
      
      return {
        success: result.success,
        selectedExchange: exchangeId,
        executionResults: [{
          exchangeId,
          result
        }],
        totalExecutedQuantity: result.executedQuantity,
        weightedAveragePrice: result.executionPrice,
        totalFees: result.fees,
        warnings: []
      };
      
    } catch (error) {
      return {
        success: false,
        selectedExchange: exchangeId,
        executionResults: [],
        totalExecutedQuantity: 0,
        weightedAveragePrice: 0,
        totalFees: 0,
        warnings: [`Execution failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  private async executeSplitOrder(splitPlan: SplitOrderPlan, context: RoutingContext): Promise<any> {
    splitPlan.status = 'executing';
    this.activeExecutions.set(splitPlan.id, splitPlan);
    
    try {
      // Execute all splits in parallel
      const executionPromises = splitPlan.splits.map(async split => {
        try {
          const result = await this.framework.executeOrder(split.order, {
            type: 'best_price',
            exchanges: [split.exchangeId],
            weights: { [split.exchangeId]: 1 },
            maxSlippage: context.strategy.maxSlippage,
            timeoutMs: context.strategy.timeoutMs,
            retryAttempts: context.strategy.retryAttempts,
            maxOrderSize: split.order.quantity,
            concentrationLimit: 100,
            allowPartialFills: context.strategy.allowPartialFills
          });
          
          return {
            exchangeId: split.exchangeId,
            result
          };
        } catch (error) {
          return {
            exchangeId: split.exchangeId,
            result: {
              success: false,
              orderId: split.order.id,
              executionPrice: 0,
              executedQuantity: 0,
              remainingQuantity: split.order.quantity,
              fees: 0,
              timestamp: new Date(),
              error: error instanceof Error ? error.message : String(error)
            } as OrderExecutionResult
          };
        }
      });
      
      const executionResults = await Promise.all(executionPromises);
      
      // Calculate aggregated results
      const successfulExecutions = executionResults.filter(r => r.result.success);
      const totalExecutedQuantity = executionResults.reduce((sum, r) => sum + r.result.executedQuantity, 0);
      const totalValue = executionResults.reduce((sum, r) => sum + (r.result.executionPrice * r.result.executedQuantity), 0);
      const weightedAveragePrice = totalExecutedQuantity > 0 ? totalValue / totalExecutedQuantity : 0;
      const totalFees = executionResults.reduce((sum, r) => sum + r.result.fees, 0);
      
      const warnings: string[] = [];
      if (successfulExecutions.length < executionResults.length) {
        warnings.push(`${executionResults.length - successfulExecutions.length} split executions failed`);
      }
      
      splitPlan.status = successfulExecutions.length > 0 ? 'completed' : 'failed';
      
      return {
        success: successfulExecutions.length > 0,
        splitPlan,
        executionResults,
        totalExecutedQuantity,
        weightedAveragePrice,
        totalFees,
        warnings
      };
      
    } finally {
      this.activeExecutions.delete(splitPlan.id);
    }
  }
  
  private calculateCostSavings(context: RoutingContext, result: any): number {
    // Compare against worst available option
    // This is simplified - would compare against actual alternatives
    return 0;
  }
  
  private calculateExecutionQuality(context: RoutingContext, result: any): number {
    if (!result.success) return 0;
    
    let quality = 0.7; // Base quality
    
    // Execution completeness
    const fillRate = result.totalExecutedQuantity / context.order.quantity;
    quality += fillRate * 0.2;
    
    // Speed bonus
    if (result.totalExecutionTime < this.config.maxExecutionLatency * 0.5) {
      quality += 0.1;
    }
    
    return Math.min(1.0, quality);
  }
  
  private updatePerformanceMetrics(result: RoutedExecutionResult): void {
    this.routingHistory.push(result);
    
    // Keep history limited
    if (this.routingHistory.length > 1000) {
      this.routingHistory = this.routingHistory.slice(-500);
    }
    
    // Update exchange-specific performance
    for (const execution of result.executionResults) {
      if (!this.exchangePerformance.has(execution.exchangeId)) {
        this.exchangePerformance.set(execution.exchangeId, {
          executionCount: 0,
          successRate: 0,
          averageLatency: 0,
          averageFees: 0,
          qualityScore: 0
        });
      }
      
      const perf = this.exchangePerformance.get(execution.exchangeId)!;
      perf.executionCount++;
      
      // Update success rate
      const successCount = perf.successRate * (perf.executionCount - 1) + (execution.result.success ? 1 : 0);
      perf.successRate = successCount / perf.executionCount;
      
      // Update other metrics for successful executions
      if (execution.result.success) {
        perf.averageFees = (perf.averageFees + execution.result.fees) / 2;
        perf.qualityScore = (perf.qualityScore + result.executionQuality) / 2;
      }
    }
  }
  
  private updateRoutingCache(context: RoutingContext, result: RoutedExecutionResult): void {
    // Cache successful routing decisions for learning
    const cacheKey = `${context.order.symbol}_${context.order.side}_${context.strategy.type}`;
    
    // This would implement more sophisticated caching and learning
    // For now, just update the timestamp
    this.lastCacheUpdate.set(cacheKey, new Date());
  }
  
  private async getMarketDataWithCache(symbol: string): Promise<Map<ExchangeId, UnifiedMarketData>> {
    const cacheKey = symbol;
    const cached = this.marketDataCache.get(cacheKey);
    const lastUpdate = this.lastCacheUpdate.get(cacheKey);
    
    if (cached && lastUpdate && 
        (Date.now() - lastUpdate.getTime()) < this.config.routingCacheTime) {
      return cached;
    }
    
    const fresh = await this.framework.getAggregatedMarketData(symbol);
    this.marketDataCache.set(cacheKey, fresh);
    this.lastCacheUpdate.set(cacheKey, new Date());
    
    return fresh;
  }
  
  private async estimateFees(exchangeId: ExchangeId, order: Order): Promise<number> {
    const feeRate = this.getEstimatedFeeRate(exchangeId);
    const notionalValue = (order.price || 0) * order.quantity;
    return notionalValue * feeRate;
  }
  
  private getEstimatedFeeRate(exchangeId: ExchangeId): number {
    // Simplified fee rates - would use actual data
    const feeRates: Record<ExchangeId, number> = {
      'binance': 0.001,   // 0.1%
      'coinbase': 0.005,  // 0.5%
      'kraken': 0.0025,   // 0.25%
      'dydx': 0.001,      // 0.1%
      'ftx': 0.0007,      // 0.07%
      'okx': 0.001,       // 0.1%
      'bybit': 0.001      // 0.1%
    };
    
    return feeRates[exchangeId] || 0.002; // Default 0.2%
  }
  
  private setupEventHandlers(): void {
    // Set up event handlers for framework events
    this.framework.on('exchange_error', this.onExchangeError.bind(this));
    this.framework.on('exchange_status_changed', this.onExchangeStatusChanged.bind(this));
  }
  
  private onExchangeError(event: any): void {
    // Update exchange performance based on errors
    const perf = this.exchangePerformance.get(event.exchangeId);
    if (perf) {
      perf.successRate = Math.max(0, perf.successRate - 0.01); // Penalize for errors
    }
  }
  
  private onExchangeStatusChanged(event: any): void {
    // Clear cache when exchange status changes
    this.routingCache.clear();
    this.marketDataCache.clear();
  }
  
  private mergeWithDefaults(config: Partial<ExchangeRouterConfig>): ExchangeRouterConfig {
    return {
      defaultStrategy: {
        type: 'smart_routing',
        exchanges: [],
        weights: {},
        maxSlippage: 0.5,
        timeoutMs: 10000,
        retryAttempts: 2,
        maxOrderSize: 10000,
        concentrationLimit: 50,
        allowPartialFills: true
      },
      enableSplitOrders: true,
      maxSplits: 3,
      minSplitSize: 100,
      maxRoutingLatency: 50,
      maxExecutionLatency: 5000,
      minLiquidityThreshold: 1000,
      maxSlippageThreshold: 1.0,
      minExecutionQuality: 0.7,
      targetCostSavings: 0.1,
      reliabilityWeight: 0.3,
      costWeight: 0.4,
      enableRiskAssessment: true,
      maxRiskScore: 80,
      diversificationBonus: 0.05,
      enablePerformanceTracking: true,
      adaptiveRouting: true,
      routingCacheTime: 5000,
      enableFallback: true,
      fallbackStrategy: 'best_available',
      maxRetryAttempts: 3,
      ...config
    };
  }
}

export default ExchangeRouter;