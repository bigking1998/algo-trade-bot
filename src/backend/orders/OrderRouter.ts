/**
 * Order Router - Task BE-021: Advanced Order Routing System
 * 
 * Intelligent order routing engine that optimizes execution by selecting
 * the best venue and execution strategy based on market conditions,
 * liquidity analysis, and cost minimization algorithms.
 * 
 * Features:
 * - Smart venue selection based on liquidity and fees
 * - Dynamic routing rules with machine learning optimization
 * - Multi-venue execution with failover support
 * - Cost analysis and execution quality optimization
 * - Real-time market condition monitoring
 * - Regulatory compliance routing (best execution)
 */

import { EventEmitter } from 'events';
import type { ManagedOrder, AdvancedOrderType, OrderPriority, RoutingRule } from './OrderManager.js';

/**
 * Venue Information
 */
export interface TradingVenue {
  id: string;
  name: string;
  type: 'exchange' | 'dark_pool' | 'ecn' | 'market_maker';
  status: 'active' | 'inactive' | 'degraded';
  
  // Liquidity metrics
  averageSpread: number;           // Average bid-ask spread
  averageSize: number;             // Average order book depth
  volumeShare: number;             // Market share percentage
  
  // Performance metrics
  fillRate: number;                // Historical fill rate %
  averageLatency: number;          // Average execution latency (ms)
  rejectionRate: number;          // Order rejection rate %
  partialFillRate: number;        // Partial fill rate %
  
  // Cost structure
  takerFee: number;               // Taker fee rate
  makerFee: number;               // Maker fee rate
  fixedFee: number;               // Fixed fee per order
  minOrderSize: number;           // Minimum order size
  maxOrderSize: number;           // Maximum order size
  
  // Supported features
  supportedOrderTypes: AdvancedOrderType[];
  supportsPostOnly: boolean;
  supportsIcebergOrders: boolean;
  supportsStopOrders: boolean;
  
  // Connectivity
  apiEndpoint: string;
  websocketEndpoint?: string;
  connectivityScore: number;      // Connection quality (0-100)
  
  // Regulatory
  regulatoryTier: 'tier1' | 'tier2' | 'tier3';
  jurisdictions: string[];
}

/**
 * Market Condition Assessment
 */
export interface MarketCondition {
  symbol: string;
  timestamp: Date;
  
  // Volatility metrics
  volatility: number;              // Current volatility measure
  volatilityTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Liquidity metrics
  totalVolume: number;             // 24h volume
  averageSpread: number;           // Current average spread
  orderBookDepth: number;          // Total depth at best 5 levels
  
  // Price action
  priceDirection: 'up' | 'down' | 'sideways';
  momentum: number;                // Price momentum indicator
  
  // Market structure
  marketHours: boolean;            // During regular market hours
  sessionType: 'pre_market' | 'regular' | 'post_market' | 'overnight';
  
  // Sentiment indicators
  buyPressure: number;             // Buying pressure (0-100)
  sellPressure: number;            // Selling pressure (0-100)
  
  // Risk factors
  newsImpact: 'low' | 'medium' | 'high';
  economicEvents: string[];
  technicalLevels: {
    support: number[];
    resistance: number[];
  };
}

/**
 * Routing Decision
 */
export interface RoutingDecision {
  orderId: string;
  primaryVenue: TradingVenue;
  fallbackVenues: TradingVenue[];
  
  // Execution strategy
  executionStrategy: {
    type: 'aggressive' | 'passive' | 'balanced' | 'stealth';
    sliceCount?: number;
    timeHorizon?: number;           // Execution time horizon (ms)
    priceImprovement?: boolean;     // Seek price improvement
    hiddenLiquidity?: boolean;      // Access hidden liquidity
  };
  
  // Cost analysis
  estimatedCost: {
    fees: number;                   // Estimated fees
    spread: number;                 // Expected spread cost
    impact: number;                 // Market impact cost
    total: number;                  // Total estimated cost
  };
  
  // Quality metrics
  expectedFillRate: number;        // Expected fill probability
  estimatedLatency: number;        // Expected execution latency
  confidenceScore: number;         // Routing confidence (0-100)
  
  // Risk assessment
  riskFactors: string[];
  maxSlippage: number;            // Maximum acceptable slippage
  
  // Routing reasons
  reasons: string[];              // Why this routing was chosen
  alternativeAnalysis: {          // Analysis of other options
    venue: string;
    score: number;
    reasons: string[];
  }[];
}

/**
 * Routing Performance Metrics
 */
interface RoutingMetrics {
  totalRoutingDecisions: number;
  averageDecisionTime: number;
  
  // Venue performance
  venuePerformance: Map<string, {
    ordersRouted: number;
    fillRate: number;
    averageSlippage: number;
    averageLatency: number;
    costEfficiency: number;
  }>;
  
  // Strategy performance
  strategyPerformance: Map<string, {
    ordersExecuted: number;
    successRate: number;
    averageCost: number;
    priceImprovement: number;
  }>;
  
  // Market condition adaptation
  conditionAdaptation: {
    highVolatility: number;
    lowLiquidity: number;
    wideSpreads: number;
    newsEvents: number;
  };
}

/**
 * Routing Configuration
 */
export interface OrderRouterConfig {
  // Venue management
  venues: TradingVenue[];
  defaultVenue: string;
  venueHealthCheckInterval: number;
  
  // Routing optimization
  enableSmartRouting: boolean;
  enableCostOptimization: boolean;
  enableLatencyOptimization: boolean;
  enableLiquidityOptimization: boolean;
  
  // Decision factors weights
  weights: {
    cost: number;                   // Cost optimization weight
    speed: number;                  // Latency optimization weight
    fillProbability: number;        // Fill rate weight
    priceImprovement: number;       // Price improvement weight
    liquidity: number;              // Liquidity access weight
  };
  
  // Risk controls
  maxSlippageTolerance: number;
  maxLatencyTolerance: number;
  venueConcentrationLimit: number;  // Max % of orders to single venue
  
  // Market condition thresholds
  highVolatilityThreshold: number;
  lowLiquidityThreshold: number;
  wideSpreadThreshold: number;
  
  // Machine learning
  enableMLOptimization: boolean;
  modelUpdateInterval: number;
  trainingDataRetention: number;
  
  // Regulatory
  bestExecutionRequired: boolean;
  auditTrailEnabled: boolean;
  reportingEnabled: boolean;
}

/**
 * Main Order Router Class
 */
export class OrderRouter extends EventEmitter {
  private config: OrderRouterConfig;
  private venues: Map<string, TradingVenue> = new Map();
  private routingRules: Map<string, RoutingRule> = new Map();
  private marketConditions: Map<string, MarketCondition> = new Map();
  private metrics: RoutingMetrics;
  
  // Optimization engines
  private mlOptimizer?: any;        // ML-based routing optimizer
  private costAnalyzer: CostAnalyzer;
  private liquidityAnalyzer: LiquidityAnalyzer;
  private latencyPredictor: LatencyPredictor;
  
  // Monitoring
  private venueMonitorTimer?: NodeJS.Timeout;
  private performanceReviewTimer?: NodeJS.Timeout;
  
  constructor(config: Partial<OrderRouterConfig>) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.metrics = this.initializeMetrics();
    
    this.costAnalyzer = new CostAnalyzer();
    this.liquidityAnalyzer = new LiquidityAnalyzer();
    this.latencyPredictor = new LatencyPredictor();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the Order Router
   */
  async initialize(): Promise<void> {
    try {
      // Load and validate venues
      await this.loadVenues();
      
      // Initialize optimization engines
      if (this.config.enableMLOptimization) {
        await this.initializeMLOptimizer();
      }
      
      // Start venue monitoring
      this.startVenueMonitoring();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      this.emit('initialized', {
        venueCount: this.venues.size,
        routingRulesCount: this.routingRules.size,
        mlOptimizationEnabled: this.config.enableMLOptimization
      });
      
    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  /**
   * Route an order to the optimal venue
   */
  async routeOrder(order: ManagedOrder): Promise<RoutingDecision> {
    const startTime = performance.now();
    
    try {
      // Get current market conditions
      const marketCondition = await this.getMarketCondition(order.symbol);
      
      // Analyze available venues
      const viableVenues = this.getViableVenues(order, marketCondition);
      
      if (viableVenues.length === 0) {
        throw new Error(`No viable venues available for ${order.symbol}`);
      }
      
      // Score venues based on multiple factors
      const venueScores = await this.scoreVenues(order, marketCondition, viableVenues);
      
      // Select primary and fallback venues
      const rankedVenues = venueScores.sort((a, b) => b.score - a.score);
      const primaryVenue = rankedVenues[0].venue;
      const fallbackVenues = rankedVenues.slice(1, 3).map(v => v.venue);
      
      // Determine execution strategy
      const executionStrategy = this.determineExecutionStrategy(order, marketCondition, primaryVenue);
      
      // Calculate cost estimates
      const estimatedCost = await this.estimateExecutionCost(order, primaryVenue, executionStrategy);
      
      // Assess execution quality
      const qualityMetrics = this.assessExecutionQuality(order, primaryVenue, marketCondition);
      
      // Create routing decision
      const routingDecision: RoutingDecision = {
        orderId: order.id,
        primaryVenue,
        fallbackVenues,
        executionStrategy,
        estimatedCost,
        expectedFillRate: qualityMetrics.fillRate,
        estimatedLatency: qualityMetrics.latency,
        confidenceScore: rankedVenues[0].score,
        riskFactors: this.identifyRiskFactors(order, marketCondition),
        maxSlippage: this.calculateMaxSlippage(order, marketCondition),
        reasons: rankedVenues[0].reasons,
        alternativeAnalysis: rankedVenues.slice(1, 4).map(v => ({
          venue: v.venue.name,
          score: v.score,
          reasons: v.reasons
        }))
      };
      
      // Record metrics
      const decisionTime = performance.now() - startTime;
      this.updateRoutingMetrics(routingDecision, decisionTime);
      
      // Emit routing decision event
      this.emit('order_routed', {
        orderId: order.id,
        symbol: order.symbol,
        primaryVenue: primaryVenue.name,
        strategy: executionStrategy.type,
        estimatedCost: estimatedCost.total,
        decisionTime
      });
      
      return routingDecision;
      
    } catch (error) {
      const decisionTime = performance.now() - startTime;
      
      this.emit('routing_error', {
        orderId: order.id,
        symbol: order.symbol,
        error: error instanceof Error ? error.message : String(error),
        decisionTime
      });
      
      throw error;
    }
  }

  /**
   * Update venue status and metrics
   */
  async updateVenueStatus(venueId: string, updates: Partial<TradingVenue>): Promise<void> {
    const venue = this.venues.get(venueId);
    if (!venue) {
      throw new Error(`Venue ${venueId} not found`);
    }
    
    // Update venue properties
    Object.assign(venue, updates);
    
    // Emit venue update event
    this.emit('venue_updated', {
      venueId,
      status: venue.status,
      changes: Object.keys(updates)
    });
  }

  /**
   * Add or update routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.set(rule.id, rule);
    
    this.emit('routing_rule_added', {
      ruleId: rule.id,
      name: rule.name,
      venue: rule.venue
    });
  }

  /**
   * Remove routing rule
   */
  removeRoutingRule(ruleId: string): boolean {
    const removed = this.routingRules.delete(ruleId);
    
    if (removed) {
      this.emit('routing_rule_removed', { ruleId });
    }
    
    return removed;
  }

  /**
   * Get routing performance metrics
   */
  getRoutingMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get venue information
   */
  getVenue(venueId: string): TradingVenue | undefined {
    return this.venues.get(venueId);
  }

  /**
   * Get all venues
   */
  getAllVenues(): TradingVenue[] {
    return Array.from(this.venues.values());
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    // Stop monitoring timers
    if (this.venueMonitorTimer) {
      clearInterval(this.venueMonitorTimer);
    }
    if (this.performanceReviewTimer) {
      clearInterval(this.performanceReviewTimer);
    }
    
    // Cleanup ML optimizer
    if (this.mlOptimizer) {
      await this.mlOptimizer.cleanup();
    }
    
    this.emit('cleanup_completed');
  }

  // === PRIVATE METHODS ===

  private async loadVenues(): Promise<void> {
    // Load venues from configuration
    for (const venue of this.config.venues) {
      this.venues.set(venue.id, venue);
    }
    
    // Perform initial health checks
    await this.performVenueHealthChecks();
  }

  private getViableVenues(order: ManagedOrder, marketCondition: MarketCondition): TradingVenue[] {
    return Array.from(this.venues.values()).filter(venue => {
      // Check venue status
      if (venue.status !== 'active') return false;
      
      // Check order type support
      if (!venue.supportedOrderTypes.includes(order.executionStrategy.type)) return false;
      
      // Check order size limits
      if (order.quantity < venue.minOrderSize || order.quantity > venue.maxOrderSize) return false;
      
      // Check regulatory compliance
      if (this.config.bestExecutionRequired && venue.regulatoryTier === 'tier3') return false;
      
      // Check connectivity
      if (venue.connectivityScore < 80) return false;
      
      return true;
    });
  }

  private async scoreVenues(
    order: ManagedOrder,
    marketCondition: MarketCondition,
    venues: TradingVenue[]
  ): Promise<Array<{ venue: TradingVenue; score: number; reasons: string[]; }>> {
    const results = [];
    
    for (const venue of venues) {
      let score = 50; // Base score
      const reasons: string[] = [];
      
      // Cost factor
      const costScore = this.calculateCostScore(order, venue);
      score += costScore * this.config.weights.cost;
      reasons.push(`Cost efficiency: ${costScore.toFixed(1)}`);
      
      // Speed factor
      const speedScore = this.calculateSpeedScore(venue, marketCondition);
      score += speedScore * this.config.weights.speed;
      reasons.push(`Execution speed: ${speedScore.toFixed(1)}`);
      
      // Fill probability factor
      const fillScore = this.calculateFillScore(order, venue, marketCondition);
      score += fillScore * this.config.weights.fillProbability;
      reasons.push(`Fill probability: ${fillScore.toFixed(1)}`);
      
      // Liquidity factor
      const liquidityScore = this.calculateLiquidityScore(venue, marketCondition);
      score += liquidityScore * this.config.weights.liquidity;
      reasons.push(`Liquidity access: ${liquidityScore.toFixed(1)}`);
      
      // Price improvement factor
      const improvementScore = this.calculatePriceImprovementScore(venue, marketCondition);
      score += improvementScore * this.config.weights.priceImprovement;
      reasons.push(`Price improvement: ${improvementScore.toFixed(1)}`);
      
      // Apply routing rules
      const ruleAdjustment = this.applyRoutingRules(order, venue);
      score += ruleAdjustment.adjustment;
      if (ruleAdjustment.reason) reasons.push(ruleAdjustment.reason);
      
      // Apply ML optimization if enabled
      if (this.mlOptimizer) {
        const mlScore = await this.mlOptimizer.predictVenueScore(order, venue, marketCondition);
        score = (score * 0.7) + (mlScore * 0.3); // Blend traditional and ML scores
        reasons.push(`ML optimization applied`);
      }
      
      results.push({
        venue,
        score: Math.max(0, Math.min(100, score)), // Clamp to 0-100
        reasons
      });
    }
    
    return results;
  }

  private calculateCostScore(order: ManagedOrder, venue: TradingVenue): number {
    const estimatedFee = order.quantity * (order.price || 100) * 
      (order.type === 'market' ? venue.takerFee : venue.makerFee);
    
    const spreadCost = order.quantity * venue.averageSpread;
    const totalCost = estimatedFee + spreadCost + venue.fixedFee;
    
    // Lower cost = higher score
    const baseCost = order.quantity * (order.price || 100) * 0.001; // 0.1% baseline
    return Math.max(0, 50 - ((totalCost - baseCost) / baseCost) * 50);
  }

  private calculateSpeedScore(venue: TradingVenue, marketCondition: MarketCondition): number {
    let score = 50;
    
    // Lower latency = higher score
    const latencyScore = Math.max(0, 50 - (venue.averageLatency / 100) * 25);
    score += latencyScore;
    
    // Connectivity quality
    score += (venue.connectivityScore - 50) * 0.5;
    
    // Market hours adjustment
    if (marketCondition.marketHours) {
      score += 10; // Bonus during market hours
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateFillScore(order: ManagedOrder, venue: TradingVenue, marketCondition: MarketCondition): number {
    let score = venue.fillRate; // Base fill rate
    
    // Adjust for order size vs venue capacity
    const sizeRatio = order.quantity / venue.averageSize;
    if (sizeRatio > 1) {
      score *= (1 - Math.min(0.5, (sizeRatio - 1) * 0.2)); // Penalty for large orders
    }
    
    // Adjust for market conditions
    if (marketCondition.volatility > this.config.highVolatilityThreshold) {
      score *= 0.9; // Reduced fill probability in high volatility
    }
    
    return Math.max(0, score);
  }

  private calculateLiquidityScore(venue: TradingVenue, marketCondition: MarketCondition): number {
    let score = venue.volumeShare; // Base on market share
    
    // Adjust for current market depth
    if (marketCondition.orderBookDepth > this.config.lowLiquidityThreshold) {
      score += 20;
    }
    
    // Venue-specific depth
    score += Math.min(30, venue.averageSize / 1000);
    
    return Math.max(0, Math.min(100, score));
  }

  private calculatePriceImprovementScore(venue: TradingVenue, marketCondition: MarketCondition): number {
    let score = 40; // Base score
    
    // Better spreads = higher improvement potential
    if (venue.averageSpread < marketCondition.averageSpread * 0.8) {
      score += 30;
    }
    
    // Dark pools and ECNs typically offer better improvement
    if (venue.type === 'dark_pool' || venue.type === 'ecn') {
      score += 20;
    }
    
    return score;
  }

  private applyRoutingRules(order: ManagedOrder, venue: TradingVenue): { adjustment: number; reason?: string; } {
    let adjustment = 0;
    let reason: string | undefined;
    
    for (const rule of this.routingRules.values()) {
      if (!rule.enabled) continue;
      
      // Check if rule applies to this order
      if (rule.conditions.symbol && rule.conditions.symbol !== order.symbol) continue;
      if (rule.conditions.orderType && rule.conditions.orderType !== order.executionStrategy.type) continue;
      if (rule.conditions.minQuantity && order.quantity < rule.conditions.minQuantity) continue;
      if (rule.conditions.maxQuantity && order.quantity > rule.conditions.maxQuantity) continue;
      
      // Apply rule if venue matches
      if (rule.venue === venue.id) {
        adjustment += rule.priority * 5; // Convert priority to score adjustment
        reason = `Routing rule applied: ${rule.name}`;
        break;
      }
    }
    
    return { adjustment, reason };
  }

  private determineExecutionStrategy(
    order: ManagedOrder,
    marketCondition: MarketCondition,
    venue: TradingVenue
  ): any {
    let strategy = 'balanced'; // Default
    
    // High volatility or wide spreads - use passive strategy
    if (marketCondition.volatility > this.config.highVolatilityThreshold ||
        marketCondition.averageSpread > this.config.wideSpreadThreshold) {
      strategy = 'passive';
    }
    
    // Large orders - use stealth strategy
    if (order.quantity > venue.averageSize * 2) {
      strategy = 'stealth';
    }
    
    // High priority orders - use aggressive strategy
    if (order.priority === 'urgent' || order.priority === 'critical') {
      strategy = 'aggressive';
    }
    
    return {
      type: strategy,
      sliceCount: strategy === 'stealth' ? Math.min(10, Math.floor(order.quantity / venue.averageSize)) : 1,
      timeHorizon: this.calculateTimeHorizon(strategy, order.quantity),
      priceImprovement: strategy !== 'aggressive',
      hiddenLiquidity: venue.type === 'dark_pool' || strategy === 'stealth'
    };
  }

  private calculateTimeHorizon(strategy: string, quantity: number): number {
    const baseTime = 30000; // 30 seconds
    
    switch (strategy) {
      case 'aggressive':
        return baseTime * 0.5;
      case 'passive':
        return baseTime * 2;
      case 'stealth':
        return baseTime * Math.min(5, quantity / 1000);
      default:
        return baseTime;
    }
  }

  private async estimateExecutionCost(order: ManagedOrder, venue: TradingVenue, strategy: any): Promise<any> {
    return this.costAnalyzer.estimate(order, venue, strategy);
  }

  private assessExecutionQuality(order: ManagedOrder, venue: TradingVenue, marketCondition: MarketCondition): any {
    return {
      fillRate: this.calculateFillScore(order, venue, marketCondition),
      latency: this.latencyPredictor.predict(venue, order)
    };
  }

  private identifyRiskFactors(order: ManagedOrder, marketCondition: MarketCondition): string[] {
    const factors: string[] = [];
    
    if (marketCondition.volatility > this.config.highVolatilityThreshold) {
      factors.push('High market volatility');
    }
    
    if (marketCondition.orderBookDepth < this.config.lowLiquidityThreshold) {
      factors.push('Low market liquidity');
    }
    
    if (marketCondition.newsImpact === 'high') {
      factors.push('High news impact expected');
    }
    
    if (!marketCondition.marketHours) {
      factors.push('Outside regular market hours');
    }
    
    return factors;
  }

  private calculateMaxSlippage(order: ManagedOrder, marketCondition: MarketCondition): number {
    let maxSlippage = this.config.maxSlippageTolerance;
    
    // Adjust for market conditions
    if (marketCondition.volatility > this.config.highVolatilityThreshold) {
      maxSlippage *= 1.5;
    }
    
    // Adjust for order priority
    if (order.priority === 'critical') {
      maxSlippage *= 2; // Allow more slippage for critical orders
    }
    
    return Math.min(maxSlippage, 0.05); // Cap at 5%
  }

  private async getMarketCondition(symbol: string): Promise<MarketCondition> {
    // Check cache first
    let condition = this.marketConditions.get(symbol);
    
    if (!condition || Date.now() - condition.timestamp.getTime() > 60000) { // 1 minute cache
      // Fetch fresh market condition
      condition = await this.fetchMarketCondition(symbol);
      this.marketConditions.set(symbol, condition);
    }
    
    return condition;
  }

  private async fetchMarketCondition(symbol: string): Promise<MarketCondition> {
    // Mock implementation - would integrate with market data feeds
    return {
      symbol,
      timestamp: new Date(),
      volatility: Math.random() * 0.1, // 0-10% volatility
      volatilityTrend: 'stable',
      totalVolume: 1000000 + Math.random() * 9000000,
      averageSpread: 0.001 + Math.random() * 0.004,
      orderBookDepth: 50000 + Math.random() * 450000,
      priceDirection: 'sideways',
      momentum: Math.random() - 0.5,
      marketHours: true,
      sessionType: 'regular',
      buyPressure: 40 + Math.random() * 20,
      sellPressure: 40 + Math.random() * 20,
      newsImpact: 'low',
      economicEvents: [],
      technicalLevels: {
        support: [],
        resistance: []
      }
    };
  }

  private updateRoutingMetrics(decision: RoutingDecision, decisionTime: number): void {
    this.metrics.totalRoutingDecisions++;
    
    // Update average decision time
    this.metrics.averageDecisionTime = 
      (this.metrics.averageDecisionTime * (this.metrics.totalRoutingDecisions - 1) + decisionTime) /
      this.metrics.totalRoutingDecisions;
    
    // Update venue performance tracking
    const venueId = decision.primaryVenue.id;
    let venuePerf = this.metrics.venuePerformance.get(venueId);
    if (!venuePerf) {
      venuePerf = {
        ordersRouted: 0,
        fillRate: 0,
        averageSlippage: 0,
        averageLatency: 0,
        costEfficiency: 0
      };
      this.metrics.venuePerformance.set(venueId, venuePerf);
    }
    venuePerf.ordersRouted++;
  }

  private async performVenueHealthChecks(): Promise<void> {
    for (const venue of this.venues.values()) {
      try {
        // Perform connectivity and latency checks
        const healthCheck = await this.checkVenueHealth(venue);
        venue.connectivityScore = healthCheck.connectivityScore;
        venue.averageLatency = healthCheck.latency;
        
        if (healthCheck.status !== venue.status) {
          venue.status = healthCheck.status;
          this.emit('venue_status_changed', {
            venueId: venue.id,
            newStatus: venue.status,
            connectivityScore: venue.connectivityScore
          });
        }
      } catch (error) {
        venue.status = 'inactive';
        this.emit('venue_health_check_failed', {
          venueId: venue.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async checkVenueHealth(venue: TradingVenue): Promise<{
    status: TradingVenue['status'];
    connectivityScore: number;
    latency: number;
  }> {
    // Mock health check - would implement actual connectivity tests
    const latency = 50 + Math.random() * 100;
    const connectivityScore = Math.max(0, 100 - latency);
    
    return {
      status: connectivityScore > 70 ? 'active' : 'degraded',
      connectivityScore,
      latency
    };
  }

  private startVenueMonitoring(): void {
    this.venueMonitorTimer = setInterval(async () => {
      await this.performVenueHealthChecks();
    }, this.config.venueHealthCheckInterval);
  }

  private startPerformanceMonitoring(): void {
    this.performanceReviewTimer = setInterval(() => {
      this.emit('routing_metrics_update', this.getRoutingMetrics());
    }, 60000); // Every minute
  }

  private async initializeMLOptimizer(): Promise<void> {
    // Initialize ML-based routing optimizer
    // This would load trained models for venue selection optimization
  }

  private setupEventHandlers(): void {
    // Internal event handling setup
  }

  private initializeMetrics(): RoutingMetrics {
    return {
      totalRoutingDecisions: 0,
      averageDecisionTime: 0,
      venuePerformance: new Map(),
      strategyPerformance: new Map(),
      conditionAdaptation: {
        highVolatility: 0,
        lowLiquidity: 0,
        wideSpreads: 0,
        newsEvents: 0
      }
    };
  }

  private mergeWithDefaults(config: Partial<OrderRouterConfig>): OrderRouterConfig {
    return {
      venues: [],
      defaultVenue: 'dydx',
      venueHealthCheckInterval: 30000,
      enableSmartRouting: true,
      enableCostOptimization: true,
      enableLatencyOptimization: true,
      enableLiquidityOptimization: true,
      weights: {
        cost: 0.3,
        speed: 0.2,
        fillProbability: 0.25,
        priceImprovement: 0.15,
        liquidity: 0.1
      },
      maxSlippageTolerance: 0.01,
      maxLatencyTolerance: 5000,
      venueConcentrationLimit: 0.6,
      highVolatilityThreshold: 0.05,
      lowLiquidityThreshold: 100000,
      wideSpreadThreshold: 0.005,
      enableMLOptimization: false,
      modelUpdateInterval: 86400000,
      trainingDataRetention: 30,
      bestExecutionRequired: true,
      auditTrailEnabled: true,
      reportingEnabled: true,
      ...config
    };
  }
}

// === HELPER CLASSES ===

class CostAnalyzer {
  estimate(order: ManagedOrder, venue: TradingVenue, strategy: any) {
    const basePrice = order.price || 100;
    const fees = order.quantity * basePrice * (order.type === 'market' ? venue.takerFee : venue.makerFee);
    const spread = order.quantity * venue.averageSpread * (strategy.type === 'aggressive' ? 1 : 0.5);
    const impact = this.calculateMarketImpact(order, venue);
    
    return {
      fees,
      spread,
      impact,
      total: fees + spread + impact
    };
  }
  
  private calculateMarketImpact(order: ManagedOrder, venue: TradingVenue): number {
    const sizeRatio = order.quantity / venue.averageSize;
    return Math.pow(sizeRatio, 1.5) * (order.price || 100) * 0.001;
  }
}

class LiquidityAnalyzer {
  // Implementation for liquidity analysis
}

class LatencyPredictor {
  predict(venue: TradingVenue, order: ManagedOrder): number {
    let latency = venue.averageLatency;
    
    // Adjust for order complexity
    if (order.executionStrategy.type === 'iceberg' || order.executionStrategy.type === 'twap') {
      latency *= 1.5;
    }
    
    return latency;
  }
}

export default OrderRouter;