/**
 * Arbitrage Engine - Cross-Exchange Opportunity Detection and Execution
 * 
 * Advanced arbitrage detection and execution system featuring:
 * - Real-time cross-exchange price monitoring
 * - Sophisticated opportunity scoring and risk assessment
 * - Automated execution with optimal timing
 * - Risk management and position sizing
 * - Performance tracking and optimization
 * 
 * Performance Targets:
 * - Opportunity detection latency < 50ms
 * - Execution coordination < 200ms
 * - 95%+ profitable arbitrage execution rate
 * - Risk-adjusted returns > 15% annually
 */

import { EventEmitter } from 'events';
import type { MultiExchangeFramework } from './MultiExchangeFramework.js';
import type {
  ExchangeId,
  ArbitrageOpportunity,
  UnifiedMarketData,
  UnifiedOrderBook,
  ExchangeOrder
} from './types.js';
import type { Order, OrderExecutionResult } from '../execution/OrderExecutor.js';

/**
 * Arbitrage Engine Configuration
 */
export interface ArbitrageEngineConfig {
  // Detection settings
  minProfitThreshold: number;        // Minimum profit percentage (e.g., 0.1 for 0.1%)
  maxProfitThreshold: number;        // Maximum profit percentage (filter outliers)
  minVolumeThreshold: number;        // Minimum volume for opportunity
  maxLatencyMs: number;              // Maximum acceptable latency
  
  // Risk management
  maxPositionSize: number;           // Maximum position size per arbitrage
  maxConcurrentArbitrages: number;   // Maximum concurrent arbitrage positions
  maxDailyVolume: number;            // Maximum daily arbitrage volume
  riskBudgetPerTrade: number;        // Risk budget per trade (in USD)
  
  // Execution settings
  executionTimeoutMs: number;        // Timeout for arbitrage execution
  enableAutoExecution: boolean;      // Enable automatic execution
  preTradeValidation: boolean;       // Enable pre-trade validation
  postTradeAnalysis: boolean;        // Enable post-trade analysis
  
  // Performance optimization
  priceUpdateIntervalMs: number;     // Price update interval
  opportunityExpiryMs: number;       // Opportunity expiry time
  enablePredictiveAnalysis: boolean; // Enable ML-based prediction
  
  // Monitoring and alerts
  enableRealTimeAlerts: boolean;     // Enable real-time alerts
  alertThresholds: {
    profitAbove: number;             // Alert when profit above threshold
    volumeAbove: number;             // Alert when volume above threshold
    riskAbove: number;               // Alert when risk above threshold
  };
  
  // Historical tracking
  trackingEnabled: boolean;
  retentionDays: number;
  performanceReviewIntervalMs: number;
}

/**
 * Arbitrage Execution Plan
 */
interface ArbitrageExecutionPlan {
  id: string;
  opportunity: ArbitrageOpportunity;
  
  // Execution details
  buyOrder: {
    exchangeId: ExchangeId;
    order: Order;
    estimatedFees: number;
  };
  sellOrder: {
    exchangeId: ExchangeId;
    order: Order;
    estimatedFees: number;
  };
  
  // Risk assessment
  riskScore: number;
  riskFactors: string[];
  maxLoss: number;
  expectedProfit: number;
  
  // Timing
  createdAt: Date;
  expiresAt: Date;
  executionStartTime?: Date;
  executionEndTime?: Date;
  
  // Status
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'expired';
  result?: ArbitrageExecutionResult;
}

/**
 * Arbitrage Execution Result
 */
interface ArbitrageExecutionResult {
  success: boolean;
  totalExecutionTime: number;
  
  // Financial results
  realizedProfit: number;
  realizedProfitPercent: number;
  totalFees: number;
  slippage: number;
  
  // Order results
  buyResult?: OrderExecutionResult;
  sellResult?: OrderExecutionResult;
  
  // Performance metrics
  executionEfficiency: number;      // 0-1 score
  timingScore: number;             // 0-1 score
  riskAdjustedReturn: number;
  
  // Error information
  error?: string;
  warnings: string[];
}

/**
 * Market Data Cache Entry
 */
interface MarketDataCache {
  data: Map<ExchangeId, UnifiedMarketData>;
  lastUpdate: Date;
  isStale: boolean;
}

/**
 * Performance Analytics
 */
interface ArbitragePerformanceMetrics {
  // Execution metrics
  totalOpportunities: number;
  executedOpportunities: number;
  successfulExecutions: number;
  failedExecutions: number;
  executionRate: number;
  successRate: number;
  
  // Financial metrics
  totalProfit: number;
  totalVolume: number;
  averageProfit: number;
  averageProfitPercent: number;
  totalFees: number;
  netProfit: number;
  roi: number;
  
  // Risk metrics
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  
  // Timing metrics
  averageDetectionTime: number;
  averageExecutionTime: number;
  fastestExecution: number;
  slowestExecution: number;
  
  // Exchange metrics
  exchangePairPerformance: Map<string, {
    count: number;
    profit: number;
    successRate: number;
  }>;
  
  // Period metrics
  dailyMetrics: Map<string, {
    opportunities: number;
    profit: number;
    volume: number;
  }>;
}

/**
 * Main Arbitrage Engine Class
 */
export class ArbitrageEngine extends EventEmitter {
  private config: ArbitrageEngineConfig;
  private framework: MultiExchangeFramework;
  
  // State management
  private isRunning = false;
  private activeOpportunities = new Map<string, ArbitrageOpportunity>();
  private executionPlans = new Map<string, ArbitrageExecutionPlan>();
  private marketDataCache = new Map<string, MarketDataCache>();
  
  // Performance tracking
  private performanceMetrics: ArbitragePerformanceMetrics;
  private executionHistory: ArbitrageExecutionResult[] = [];
  
  // Monitoring
  private monitoringTimer?: NodeJS.Timeout;
  private performanceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  // Risk management
  private currentExposure = 0;
  private dailyVolume = 0;
  private concurrentArbitrages = 0;
  private lastResetTime = new Date();
  
  constructor(framework: MultiExchangeFramework, config: Partial<ArbitrageEngineConfig> = {}) {
    super();
    
    this.framework = framework;
    this.config = this.mergeWithDefaults(config);
    this.performanceMetrics = this.initializeMetrics();
    
    this.setupEventHandlers();
  }
  
  /**
   * Start the arbitrage engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Arbitrage engine is already running');
    }
    
    try {
      this.isRunning = true;
      
      // Reset daily metrics if needed
      this.checkDailyReset();
      
      // Start monitoring
      this.startPriceMonitoring();
      this.startPerformanceTracking();
      this.startCleanupTimer();
      
      this.emit('engine_started', {
        config: this.config,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.isRunning = false;
      this.emit('engine_start_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * Stop the arbitrage engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    try {
      this.isRunning = false;
      
      // Stop monitoring
      if (this.monitoringTimer) clearInterval(this.monitoringTimer);
      if (this.performanceTimer) clearInterval(this.performanceTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      
      // Wait for active executions to complete or timeout
      await this.waitForActiveExecutions();
      
      // Clear state
      this.activeOpportunities.clear();
      this.executionPlans.clear();
      
      this.emit('engine_stopped', {
        performanceMetrics: this.performanceMetrics,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.emit('engine_stop_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Detect arbitrage opportunities for given symbols
   */
  async detectOpportunities(symbols: string[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const symbol of symbols) {
      try {
        const marketData = await this.getMarketData(symbol);
        const symbolOpportunities = this.analyzeArbitrageOpportunities(symbol, marketData);
        opportunities.push(...symbolOpportunities);
      } catch (error) {
        this.emit('detection_error', {
          symbol,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }
    
    // Filter and rank opportunities
    const filteredOpportunities = opportunities
      .filter(opp => this.validateOpportunity(opp))
      .sort((a, b) => b.spreadPercent - a.spreadPercent);
    
    // Update active opportunities
    this.updateActiveOpportunities(filteredOpportunities);
    
    return filteredOpportunities;
  }
  
  /**
   * Execute an arbitrage opportunity
   */
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ArbitrageExecutionResult> {
    if (!this.config.enableAutoExecution) {
      throw new Error('Auto execution is disabled');
    }
    
    if (this.concurrentArbitrages >= this.config.maxConcurrentArbitrages) {
      throw new Error('Maximum concurrent arbitrages reached');
    }
    
    try {
      // Create execution plan
      const plan = await this.createExecutionPlan(opportunity);
      
      // Validate execution plan
      if (this.config.preTradeValidation && !this.validateExecutionPlan(plan)) {
        throw new Error('Execution plan validation failed');
      }
      
      // Execute the arbitrage
      this.concurrentArbitrages++;
      const result = await this.executeArbitragePlan(plan);
      
      // Post-trade analysis
      if (this.config.postTradeAnalysis) {
        await this.performPostTradeAnalysis(plan, result);
      }
      
      // Update metrics
      this.updatePerformanceMetrics(result);
      
      return result;
      
    } catch (error) {
      const errorResult: ArbitrageExecutionResult = {
        success: false,
        totalExecutionTime: 0,
        realizedProfit: 0,
        realizedProfitPercent: 0,
        totalFees: 0,
        slippage: 0,
        executionEfficiency: 0,
        timingScore: 0,
        riskAdjustedReturn: 0,
        error: error instanceof Error ? error.message : String(error),
        warnings: []
      };
      
      this.updatePerformanceMetrics(errorResult);
      
      throw error;
    } finally {
      this.concurrentArbitrages--;
    }
  }
  
  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): ArbitragePerformanceMetrics {
    return { ...this.performanceMetrics };
  }
  
  /**
   * Get active opportunities
   */
  getActiveOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.activeOpportunities.values())
      .filter(opp => opp.expiresAt > new Date())
      .sort((a, b) => b.spreadPercent - a.spreadPercent);
  }
  
  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): ArbitrageExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }
  
  // === PRIVATE METHODS ===
  
  private async getMarketData(symbol: string): Promise<Map<ExchangeId, UnifiedMarketData>> {
    // Check cache first
    const cached = this.marketDataCache.get(symbol);
    const now = new Date();
    
    if (cached && !cached.isStale && 
        (now.getTime() - cached.lastUpdate.getTime()) < this.config.priceUpdateIntervalMs) {
      return cached.data;
    }
    
    // Fetch fresh data
    const data = await this.framework.getAggregatedMarketData(symbol);
    
    // Update cache
    this.marketDataCache.set(symbol, {
      data,
      lastUpdate: now,
      isStale: false
    });
    
    return data;
  }
  
  private analyzeArbitrageOpportunities(
    symbol: string,
    marketData: Map<ExchangeId, UnifiedMarketData>
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const exchanges = Array.from(marketData.entries());
    
    // Compare all exchange pairs
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = i + 1; j < exchanges.length; j++) {
        const [exchange1, data1] = exchanges[i];
        const [exchange2, data2] = exchanges[j];
        
        // Check arbitrage in both directions
        const opp1 = this.calculateArbitrageOpportunity(symbol, exchange1, exchange2, data1, data2);
        const opp2 = this.calculateArbitrageOpportunity(symbol, exchange2, exchange1, data2, data1);
        
        if (opp1) opportunities.push(opp1);
        if (opp2) opportunities.push(opp2);
      }
    }
    
    return opportunities;
  }
  
  private calculateArbitrageOpportunity(
    symbol: string,
    buyExchange: ExchangeId,
    sellExchange: ExchangeId,
    buyData: UnifiedMarketData,
    sellData: UnifiedMarketData
  ): ArbitrageOpportunity | null {
    const buyPrice = buyData.ask;
    const sellPrice = sellData.bid;
    const spread = sellPrice - buyPrice;
    const spreadPercent = (spread / buyPrice) * 100;
    
    if (spread <= 0 || spreadPercent < this.config.minProfitThreshold) {
      return null;
    }
    
    // Calculate opportunity metrics
    const maxVolume = Math.min(buyData.askDepth, sellData.bidDepth);
    const estimatedFees = this.estimateTransactionFees(buyPrice, sellPrice, maxVolume);
    const netSpread = spread - estimatedFees;
    const netSpreadPercent = (netSpread / buyPrice) * 100;
    
    if (netSpreadPercent < this.config.minProfitThreshold) {
      return null;
    }
    
    const opportunity: ArbitrageOpportunity = {
      id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      timestamp: new Date(),
      buyExchange,
      sellExchange,
      buyPrice,
      sellPrice,
      spread: netSpread,
      spreadPercent: netSpreadPercent,
      maxVolume,
      estimatedProfit: netSpread * maxVolume,
      estimatedProfitPercent: netSpreadPercent,
      requiredCapital: buyPrice * maxVolume,
      minimumProfit: this.config.minProfitThreshold,
      estimatedExecutionTime: this.estimateExecutionTime(buyExchange, sellExchange),
      riskScore: this.calculateRiskScore(buyData, sellData, maxVolume),
      liquidityRisk: this.assessLiquidityRisk(maxVolume),
      executionRisk: this.assessExecutionRisk(buyExchange, sellExchange),
      quality: this.assessOpportunityQuality(netSpreadPercent, maxVolume),
      confidence: this.calculateConfidence(buyData, sellData),
      expiresAt: new Date(Date.now() + this.config.opportunityExpiryMs)
    };
    
    return opportunity;
  }
  
  private validateOpportunity(opportunity: ArbitrageOpportunity): boolean {
    // Basic validation
    if (opportunity.spreadPercent < this.config.minProfitThreshold) {
      return false;
    }
    
    if (opportunity.spreadPercent > this.config.maxProfitThreshold) {
      return false; // Likely stale data or error
    }
    
    if (opportunity.maxVolume < this.config.minVolumeThreshold) {
      return false;
    }
    
    if (opportunity.estimatedExecutionTime > this.config.maxLatencyMs) {
      return false;
    }
    
    // Risk validation
    if (opportunity.riskScore > 80) { // High risk
      return false;
    }
    
    // Position size validation
    if (opportunity.requiredCapital > this.config.maxPositionSize) {
      return false;
    }
    
    // Daily volume validation
    if (this.dailyVolume + opportunity.maxVolume > this.config.maxDailyVolume) {
      return false;
    }
    
    return true;
  }
  
  private async createExecutionPlan(opportunity: ArbitrageOpportunity): Promise<ArbitrageExecutionPlan> {
    const planId = `plan_${opportunity.id}`;
    
    // Calculate optimal position size
    const positionSize = this.calculateOptimalPositionSize(opportunity);
    
    // Create buy order
    const buyOrder: Order = {
      id: `${planId}_buy`,
      symbol: opportunity.symbol,
      side: 'buy',
      type: 'market',
      quantity: positionSize,
      timeInForce: 'IOC',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      filledQuantity: 0,
      executionPlanId: planId,
      metadata: {
        strategy: 'arbitrage',
        mode: 'live',
        childOrderIds: [],
        retryCount: 0,
        executionPath: ['arbitrage_engine']
      }
    };
    
    // Create sell order
    const sellOrder: Order = {
      id: `${planId}_sell`,
      symbol: opportunity.symbol,
      side: 'sell',
      type: 'market',
      quantity: positionSize,
      timeInForce: 'IOC',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      filledQuantity: 0,
      executionPlanId: planId,
      metadata: {
        strategy: 'arbitrage',
        mode: 'live',
        childOrderIds: [],
        retryCount: 0,
        executionPath: ['arbitrage_engine']
      }
    };
    
    // Calculate fees and risks
    const buyFees = this.estimateTradingFees(opportunity.buyExchange, opportunity.symbol, positionSize * opportunity.buyPrice);
    const sellFees = this.estimateTradingFees(opportunity.sellExchange, opportunity.symbol, positionSize * opportunity.sellPrice);
    const totalFees = buyFees + sellFees;
    
    const plan: ArbitrageExecutionPlan = {
      id: planId,
      opportunity,
      buyOrder: {
        exchangeId: opportunity.buyExchange,
        order: buyOrder,
        estimatedFees: buyFees
      },
      sellOrder: {
        exchangeId: opportunity.sellExchange,
        order: sellOrder,
        estimatedFees: sellFees
      },
      riskScore: opportunity.riskScore,
      riskFactors: this.identifyRiskFactors(opportunity),
      maxLoss: this.calculateMaxLoss(opportunity, positionSize),
      expectedProfit: (opportunity.spread * positionSize) - totalFees,
      createdAt: new Date(),
      expiresAt: opportunity.expiresAt,
      status: 'pending'
    };
    
    this.executionPlans.set(planId, plan);
    
    return plan;
  }
  
  private validateExecutionPlan(plan: ArbitrageExecutionPlan): boolean {
    // Check if opportunity is still valid
    if (plan.expiresAt < new Date()) {
      return false;
    }
    
    // Check risk limits
    if (plan.maxLoss > this.config.riskBudgetPerTrade) {
      return false;
    }
    
    // Check position size limits
    const totalValue = plan.buyOrder.order.quantity * plan.opportunity.buyPrice;
    if (totalValue > this.config.maxPositionSize) {
      return false;
    }
    
    // Check expected profitability
    if (plan.expectedProfit <= 0) {
      return false;
    }
    
    return true;
  }
  
  private async executeArbitragePlan(plan: ArbitrageExecutionPlan): Promise<ArbitrageExecutionResult> {
    const startTime = performance.now();
    plan.status = 'executing';
    plan.executionStartTime = new Date();
    
    try {
      // Execute orders simultaneously for best timing
      const [buyResult, sellResult] = await Promise.allSettled([
        this.framework.executeOrder(plan.buyOrder.order, {
          type: 'best_price',
          exchanges: [plan.buyOrder.exchangeId],
          weights: { [plan.buyOrder.exchangeId]: 1 },
          maxSlippage: 0.5,
          timeoutMs: this.config.executionTimeoutMs,
          retryAttempts: 1,
          maxOrderSize: plan.buyOrder.order.quantity,
          concentrationLimit: 100,
          allowPartialFills: false
        }),
        this.framework.executeOrder(plan.sellOrder.order, {
          type: 'best_price',
          exchanges: [plan.sellOrder.exchangeId],
          weights: { [plan.sellOrder.exchangeId]: 1 },
          maxSlippage: 0.5,
          timeoutMs: this.config.executionTimeoutMs,
          retryAttempts: 1,
          maxOrderSize: plan.sellOrder.order.quantity,
          concentrationLimit: 100,
          allowPartialFills: false
        })
      ]);
      
      const executionTime = performance.now() - startTime;
      plan.executionEndTime = new Date();
      
      // Check results
      const buySuccess = buyResult.status === 'fulfilled' && buyResult.value.success;
      const sellSuccess = sellResult.status === 'fulfilled' && sellResult.value.success;
      
      if (!buySuccess || !sellSuccess) {
        plan.status = 'failed';
        
        return {
          success: false,
          totalExecutionTime: executionTime,
          realizedProfit: 0,
          realizedProfitPercent: 0,
          totalFees: 0,
          slippage: 0,
          executionEfficiency: 0,
          timingScore: 0,
          riskAdjustedReturn: 0,
          buyResult: buySuccess ? buyResult.value : undefined,
          sellResult: sellSuccess ? sellResult.value : undefined,
          error: 'One or both orders failed to execute',
          warnings: []
        };
      }
      
      // Calculate actual results
      const buyOrderResult = buyResult.value;
      const sellOrderResult = sellResult.value;
      
      const actualBuyPrice = buyOrderResult.executionPrice;
      const actualSellPrice = sellOrderResult.executionPrice;
      const executedQuantity = Math.min(buyOrderResult.executedQuantity, sellOrderResult.executedQuantity);
      
      const actualSpread = actualSellPrice - actualBuyPrice;
      const realizedProfit = actualSpread * executedQuantity - (buyOrderResult.fees + sellOrderResult.fees);
      const realizedProfitPercent = (realizedProfit / (actualBuyPrice * executedQuantity)) * 100;
      
      const slippage = this.calculateSlippage(
        plan.opportunity.buyPrice,
        plan.opportunity.sellPrice,
        actualBuyPrice,
        actualSellPrice
      );
      
      plan.status = 'completed';
      
      const result: ArbitrageExecutionResult = {
        success: true,
        totalExecutionTime: executionTime,
        realizedProfit,
        realizedProfitPercent,
        totalFees: buyOrderResult.fees + sellOrderResult.fees,
        slippage,
        executionEfficiency: this.calculateExecutionEfficiency(plan, executionTime),
        timingScore: this.calculateTimingScore(executionTime),
        riskAdjustedReturn: realizedProfitPercent / (plan.riskScore / 100),
        buyResult: buyOrderResult,
        sellResult: sellOrderResult,
        warnings: []
      };
      
      plan.result = result;
      
      return result;
      
    } catch (error) {
      plan.status = 'failed';
      plan.executionEndTime = new Date();
      
      return {
        success: false,
        totalExecutionTime: performance.now() - startTime,
        realizedProfit: 0,
        realizedProfitPercent: 0,
        totalFees: 0,
        slippage: 0,
        executionEfficiency: 0,
        timingScore: 0,
        riskAdjustedReturn: 0,
        error: error instanceof Error ? error.message : String(error),
        warnings: []
      };
    }
  }
  
  private updateActiveOpportunities(opportunities: ArbitrageOpportunity[]): void {
    // Clear expired opportunities
    const now = new Date();
    for (const [id, opp] of this.activeOpportunities) {
      if (opp.expiresAt < now) {
        this.activeOpportunities.delete(id);
      }
    }
    
    // Add new opportunities
    for (const opp of opportunities) {
      this.activeOpportunities.set(opp.id, opp);
    }
    
    // Update metrics
    this.performanceMetrics.totalOpportunities = this.activeOpportunities.size;
  }
  
  private updatePerformanceMetrics(result: ArbitrageExecutionResult): void {
    this.executionHistory.push(result);
    
    // Keep history limited
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }
    
    // Update counters
    this.performanceMetrics.executedOpportunities++;
    
    if (result.success) {
      this.performanceMetrics.successfulExecutions++;
      this.performanceMetrics.totalProfit += result.realizedProfit;
      this.performanceMetrics.totalVolume += result.buyResult?.executedQuantity || 0;
    } else {
      this.performanceMetrics.failedExecutions++;
    }
    
    this.performanceMetrics.totalFees += result.totalFees;
    
    // Calculate derived metrics
    this.performanceMetrics.executionRate = 
      (this.performanceMetrics.executedOpportunities / this.performanceMetrics.totalOpportunities) * 100;
    
    this.performanceMetrics.successRate = 
      (this.performanceMetrics.successfulExecutions / this.performanceMetrics.executedOpportunities) * 100;
    
    this.performanceMetrics.averageProfit = 
      this.performanceMetrics.totalProfit / this.performanceMetrics.successfulExecutions;
    
    this.performanceMetrics.netProfit = 
      this.performanceMetrics.totalProfit - this.performanceMetrics.totalFees;
    
    this.performanceMetrics.roi = 
      (this.performanceMetrics.netProfit / this.currentExposure) * 100;
  }
  
  private startPriceMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        // Monitor configured symbols (would be configurable)
        const symbols = ['BTC-USD', 'ETH-USD']; // Example symbols
        const opportunities = await this.detectOpportunities(symbols);
        
        // Execute high-quality opportunities automatically
        if (this.config.enableAutoExecution) {
          const executionPromises = opportunities
            .filter(opp => opp.quality === 'excellent' && opp.confidence > 0.8)
            .slice(0, 3) // Limit concurrent executions
            .map(opp => this.executeArbitrage(opp).catch(error => {
              this.emit('auto_execution_error', { opportunity: opp, error });
            }));
          
          await Promise.allSettled(executionPromises);
        }
        
        // Emit opportunities for manual review
        if (opportunities.length > 0) {
          this.emit('opportunities_detected', {
            count: opportunities.length,
            topOpportunities: opportunities.slice(0, 5),
            timestamp: new Date()
          });
        }
        
      } catch (error) {
        this.emit('monitoring_error', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }, this.config.priceUpdateIntervalMs);
  }
  
  private startPerformanceTracking(): void {
    this.performanceTimer = setInterval(() => {
      this.emit('performance_update', {
        metrics: this.performanceMetrics,
        timestamp: new Date()
      });
    }, this.config.performanceReviewIntervalMs);
  }
  
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, 60000); // Run every minute
  }
  
  private cleanupExpiredData(): void {
    const now = new Date();
    
    // Clean expired opportunities
    for (const [id, opp] of this.activeOpportunities) {
      if (opp.expiresAt < now) {
        this.activeOpportunities.delete(id);
      }
    }
    
    // Clean expired execution plans
    for (const [id, plan] of this.executionPlans) {
      if (plan.expiresAt < now && plan.status !== 'executing') {
        this.executionPlans.delete(id);
      }
    }
    
    // Clean stale market data cache
    for (const [symbol, cache] of this.marketDataCache) {
      if ((now.getTime() - cache.lastUpdate.getTime()) > (this.config.priceUpdateIntervalMs * 3)) {
        cache.isStale = true;
      }
    }
  }
  
  private checkDailyReset(): void {
    const now = new Date();
    const lastReset = this.lastResetTime;
    
    if (now.getDate() !== lastReset.getDate()) {
      this.dailyVolume = 0;
      this.lastResetTime = now;
    }
  }
  
  private async waitForActiveExecutions(): Promise<void> {
    const activeExecutions = Array.from(this.executionPlans.values())
      .filter(plan => plan.status === 'executing');
    
    if (activeExecutions.length === 0) {
      return;
    }
    
    // Wait for active executions or timeout
    const timeout = setTimeout(() => {
      // Force cleanup if needed
    }, this.config.executionTimeoutMs);
    
    await new Promise<void>(resolve => {
      const checkInterval = setInterval(() => {
        const stillActive = Array.from(this.executionPlans.values())
          .filter(plan => plan.status === 'executing');
        
        if (stillActive.length === 0) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }
  
  // === HELPER METHODS ===
  
  private estimateTransactionFees(buyPrice: number, sellPrice: number, volume: number): number {
    // Simplified fee calculation - would use actual exchange fee data
    const averagePrice = (buyPrice + sellPrice) / 2;
    const tradingVolume = averagePrice * volume;
    return tradingVolume * 0.002; // 0.2% total fees estimate
  }
  
  private estimateTradingFees(exchangeId: ExchangeId, symbol: string, notionalValue: number): number {
    // Simplified calculation - would query actual fee schedules
    const feeRates: Record<ExchangeId, number> = {
      'binance': 0.001,  // 0.1%
      'coinbase': 0.005, // 0.5%
      'kraken': 0.0025,  // 0.25%
      'dydx': 0.001,     // 0.1%
      'ftx': 0.0007,     // 0.07%
      'okx': 0.001,      // 0.1%
      'bybit': 0.001     // 0.1%
    };
    
    return notionalValue * (feeRates[exchangeId] || 0.001);
  }
  
  private calculateOptimalPositionSize(opportunity: ArbitrageOpportunity): number {
    // Use Kelly Criterion or similar position sizing
    const maxSize = Math.min(
      opportunity.maxVolume,
      this.config.maxPositionSize / opportunity.buyPrice,
      (this.config.maxDailyVolume - this.dailyVolume) / opportunity.buyPrice
    );
    
    // Risk-adjusted sizing
    const riskAdjustedSize = maxSize * (1 - (opportunity.riskScore / 100) * 0.5);
    
    return Math.max(0, riskAdjustedSize);
  }
  
  private estimateExecutionTime(exchange1: ExchangeId, exchange2: ExchangeId): number {
    // Estimate based on exchange latencies - would use historical data
    const exchangeLatencies: Record<ExchangeId, number> = {
      'binance': 50,
      'coinbase': 100,
      'kraken': 150,
      'dydx': 30,
      'ftx': 75,
      'okx': 80,
      'bybit': 60
    };
    
    const maxLatency = Math.max(
      exchangeLatencies[exchange1] || 100,
      exchangeLatencies[exchange2] || 100
    );
    
    return maxLatency + 50; // Add coordination overhead
  }
  
  private calculateRiskScore(buyData: UnifiedMarketData, sellData: UnifiedMarketData, volume: number): number {
    let score = 20; // Base score
    
    // Liquidity risk
    if (buyData.bidDepth < volume * 2) score += 15;
    if (sellData.askDepth < volume * 2) score += 15;
    
    // Spread risk
    if (buyData.spread > buyData.price * 0.001) score += 10;
    if (sellData.spread > sellData.price * 0.001) score += 10;
    
    // Data quality risk
    if (buyData.quality !== 'realtime') score += 10;
    if (sellData.quality !== 'realtime') score += 10;
    
    // Volume risk
    if (volume > Math.min(buyData.bidDepth, sellData.askDepth) * 0.8) score += 10;
    
    return Math.min(100, score);
  }
  
  private assessLiquidityRisk(volume: number): 'low' | 'medium' | 'high' {
    if (volume > 10000) return 'high';
    if (volume > 1000) return 'medium';
    return 'low';
  }
  
  private assessExecutionRisk(exchange1: ExchangeId, exchange2: ExchangeId): 'low' | 'medium' | 'high' {
    // Simplified risk assessment based on exchange reliability
    const exchangeRisk: Record<ExchangeId, number> = {
      'binance': 1,
      'coinbase': 2,
      'kraken': 3,
      'dydx': 1,
      'ftx': 4, // Higher risk due to past issues
      'okx': 2,
      'bybit': 2
    };
    
    const avgRisk = (exchangeRisk[exchange1] + exchangeRisk[exchange2]) / 2;
    
    if (avgRisk >= 3) return 'high';
    if (avgRisk >= 2) return 'medium';
    return 'low';
  }
  
  private assessOpportunityQuality(spreadPercent: number, volume: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (spreadPercent >= 1.0 && volume >= 1000) return 'excellent';
    if (spreadPercent >= 0.5 && volume >= 500) return 'good';
    if (spreadPercent >= 0.2 && volume >= 100) return 'fair';
    return 'poor';
  }
  
  private calculateConfidence(buyData: UnifiedMarketData, sellData: UnifiedMarketData): number {
    let confidence = 0.5; // Base confidence
    
    // Data quality
    if (buyData.quality === 'realtime') confidence += 0.2;
    if (sellData.quality === 'realtime') confidence += 0.2;
    
    // Data recency
    const now = Date.now();
    const buyAge = now - buyData.lastUpdate.getTime();
    const sellAge = now - sellData.lastUpdate.getTime();
    
    if (buyAge < 1000) confidence += 0.05; // < 1 second
    if (sellAge < 1000) confidence += 0.05;
    
    return Math.min(1.0, confidence);
  }
  
  private identifyRiskFactors(opportunity: ArbitrageOpportunity): string[] {
    const factors: string[] = [];
    
    if (opportunity.liquidityRisk === 'high') factors.push('high_liquidity_risk');
    if (opportunity.executionRisk === 'high') factors.push('high_execution_risk');
    if (opportunity.riskScore > 70) factors.push('high_overall_risk');
    if (opportunity.estimatedExecutionTime > this.config.maxLatencyMs * 0.8) factors.push('high_latency_risk');
    if (opportunity.spreadPercent > 2.0) factors.push('unusual_spread');
    
    return factors;
  }
  
  private calculateMaxLoss(opportunity: ArbitrageOpportunity, positionSize: number): number {
    // Maximum potential loss including fees and slippage
    const notionalValue = opportunity.buyPrice * positionSize;
    const fees = this.estimateTransactionFees(opportunity.buyPrice, opportunity.sellPrice, positionSize);
    const maxSlippage = notionalValue * 0.01; // 1% maximum slippage
    
    return fees + maxSlippage;
  }
  
  private calculateSlippage(
    expectedBuyPrice: number,
    expectedSellPrice: number,
    actualBuyPrice: number,
    actualSellPrice: number
  ): number {
    const buySlippage = (actualBuyPrice - expectedBuyPrice) / expectedBuyPrice;
    const sellSlippage = (expectedSellPrice - actualSellPrice) / expectedSellPrice;
    
    return (buySlippage + sellSlippage) * 100; // Return as percentage
  }
  
  private calculateExecutionEfficiency(plan: ArbitrageExecutionPlan, executionTime: number): number {
    const timeScore = Math.max(0, 1 - (executionTime / this.config.maxLatencyMs));
    const profitScore = plan.expectedProfit > 0 ? 1 : 0;
    
    return (timeScore + profitScore) / 2;
  }
  
  private calculateTimingScore(executionTime: number): number {
    return Math.max(0, 1 - (executionTime / this.config.maxLatencyMs));
  }
  
  private async performPostTradeAnalysis(
    plan: ArbitrageExecutionPlan,
    result: ArbitrageExecutionResult
  ): Promise<void> {
    // Analyze execution performance for future optimization
    const analysis = {
      planId: plan.id,
      expectedProfit: plan.expectedProfit,
      actualProfit: result.realizedProfit,
      executionTime: result.totalExecutionTime,
      slippage: result.slippage,
      efficiency: result.executionEfficiency,
      timestamp: new Date()
    };
    
    this.emit('post_trade_analysis', analysis);
  }
  
  private setupEventHandlers(): void {
    // Set up internal event handlers
    this.on('opportunities_detected', this.onOpportunitiesDetected.bind(this));
    this.on('auto_execution_error', this.onAutoExecutionError.bind(this));
  }
  
  private onOpportunitiesDetected(event: any): void {
    if (this.config.enableRealTimeAlerts) {
      const highValueOpportunities = event.topOpportunities
        .filter((opp: ArbitrageOpportunity) => 
          opp.spreadPercent >= this.config.alertThresholds.profitAbove ||
          opp.maxVolume >= this.config.alertThresholds.volumeAbove
        );
      
      if (highValueOpportunities.length > 0) {
        this.emit('high_value_opportunity_alert', {
          opportunities: highValueOpportunities,
          timestamp: event.timestamp
        });
      }
    }
  }
  
  private onAutoExecutionError(event: any): void {
    console.error('[ArbitrageEngine] Auto execution error:', event.error);
  }
  
  private initializeMetrics(): ArbitragePerformanceMetrics {
    return {
      totalOpportunities: 0,
      executedOpportunities: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      executionRate: 0,
      successRate: 0,
      totalProfit: 0,
      totalVolume: 0,
      averageProfit: 0,
      averageProfitPercent: 0,
      totalFees: 0,
      netProfit: 0,
      roi: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      averageDetectionTime: 0,
      averageExecutionTime: 0,
      fastestExecution: Infinity,
      slowestExecution: 0,
      exchangePairPerformance: new Map(),
      dailyMetrics: new Map()
    };
  }
  
  private mergeWithDefaults(config: Partial<ArbitrageEngineConfig>): ArbitrageEngineConfig {
    return {
      minProfitThreshold: 0.1,
      maxProfitThreshold: 5.0,
      minVolumeThreshold: 100,
      maxLatencyMs: 200,
      maxPositionSize: 10000,
      maxConcurrentArbitrages: 5,
      maxDailyVolume: 100000,
      riskBudgetPerTrade: 100,
      executionTimeoutMs: 10000,
      enableAutoExecution: false,
      preTradeValidation: true,
      postTradeAnalysis: true,
      priceUpdateIntervalMs: 1000,
      opportunityExpiryMs: 30000,
      enablePredictiveAnalysis: false,
      enableRealTimeAlerts: true,
      alertThresholds: {
        profitAbove: 0.5,
        volumeAbove: 1000,
        riskAbove: 80
      },
      trackingEnabled: true,
      retentionDays: 30,
      performanceReviewIntervalMs: 60000,
      ...config
    };
  }
}

export default ArbitrageEngine;