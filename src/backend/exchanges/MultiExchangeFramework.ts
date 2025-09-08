/**
 * Multi-Exchange Framework - Core Orchestrator
 * 
 * Central hub for managing multiple exchange connections, cross-exchange
 * arbitrage detection, unified portfolio management, and smart order routing.
 * Provides enterprise-grade multi-exchange trading capabilities with
 * comprehensive risk management and performance optimization.
 * 
 * Performance Targets:
 * - Cross-exchange latency < 200ms for arbitrage execution
 * - Support for 5+ exchanges simultaneously
 * - 99.9% connection reliability across all exchanges
 * - Memory usage < 500MB for multi-exchange operations
 */

import { EventEmitter } from 'events';
import type { BaseExchangeConnector } from './BaseExchangeConnector.js';
import type {
  ExchangeId,
  ExchangeConfig,
  ExchangeStatus,
  ExchangeHealth,
  ExchangeOrder,
  ExchangeBalance,
  UnifiedMarketData,
  UnifiedOrderBook,
  ArbitrageOpportunity,
  CrossExchangePortfolio,
  ExchangeEvent,
  ExchangePerformanceMetrics,
  OrderRoutingStrategy,
  ExchangeConnectionPool
} from './types.js';
import type { Order, OrderExecutionResult } from '../execution/OrderExecutor.js';

/**
 * Multi-Exchange Framework Configuration
 */
export interface MultiExchangeConfig {
  // Framework settings
  maxExchanges: number;
  maxConcurrentConnections: number;
  healthCheckInterval: number;
  
  // Arbitrage settings
  arbitrageEnabled: boolean;
  minArbitrageProfit: number;
  maxArbitragePositionSize: number;
  arbitrageTimeoutMs: number;
  
  // Portfolio settings
  portfolioSyncInterval: number;
  enableCrossExchangeRebalancing: boolean;
  rebalanceThreshold: number;
  
  // Risk management
  maxExposurePerExchange: number;
  maxTotalExposure: number;
  enableRiskChecks: boolean;
  
  // Performance
  enablePerformanceTracking: boolean;
  metricsRetentionHours: number;
  
  // Routing
  defaultRoutingStrategy: OrderRoutingStrategy;
  enableSmartRouting: boolean;
  
  // Operational
  emergencyShutdownEnabled: boolean;
  gracefulShutdownTimeoutMs: number;
}

/**
 * Exchange Registration
 */
interface ExchangeRegistration {
  connector: BaseExchangeConnector;
  config: ExchangeConfig;
  lastHealthCheck: Date;
  performanceMetrics: ExchangePerformanceMetrics;
  isActive: boolean;
  connectionCount: number;
}

/**
 * Multi-Exchange Framework Main Class
 */
export class MultiExchangeFramework extends EventEmitter {
  private config: MultiExchangeConfig;
  private exchanges: Map<ExchangeId, ExchangeRegistration> = new Map();
  private connectionPool: ExchangeConnectionPool;
  
  // Market data aggregation
  private marketDataCache: Map<string, Map<ExchangeId, UnifiedMarketData>> = new Map();
  private orderBookCache: Map<string, Map<ExchangeId, UnifiedOrderBook>> = new Map();
  
  // Portfolio management
  private portfolioCache: CrossExchangePortfolio | null = null;
  private balanceCache: Map<ExchangeId, ExchangeBalance[]> = new Map();
  private lastPortfolioUpdate: Date = new Date(0);
  
  // Arbitrage tracking
  private activeArbitrageOpportunities: Map<string, ArbitrageOpportunity> = new Map();
  private arbitrageHistory: ArbitrageOpportunity[] = [];
  
  // Performance tracking
  private frameworkMetrics = {
    totalExchanges: 0,
    activeExchanges: 0,
    totalTrades: 0,
    arbitrageTrades: 0,
    averageLatency: 0,
    uptime: 100,
    totalVolume: 0,
    totalProfit: 0,
    startTime: Date.now()
  };
  
  // Timers and intervals
  private healthCheckTimer?: NodeJS.Timeout;
  private portfolioSyncTimer?: NodeJS.Timeout;
  private arbitrageTimer?: NodeJS.Timeout;
  
  constructor(config: Partial<MultiExchangeConfig> = {}) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.connectionPool = this.initializeConnectionPool();
    
    this.setupEventHandlers();
  }
  
  /**
   * Initialize the Multi-Exchange Framework
   */
  async initialize(): Promise<void> {
    try {
      this.emit('framework_initializing', {
        maxExchanges: this.config.maxExchanges,
        arbitrageEnabled: this.config.arbitrageEnabled,
        timestamp: new Date()
      });
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start portfolio synchronization
      this.startPortfolioSync();
      
      // Start arbitrage monitoring if enabled
      if (this.config.arbitrageEnabled) {
        this.startArbitrageMonitoring();
      }
      
      this.emit('framework_initialized', {
        totalExchanges: this.exchanges.size,
        activeFeatures: {
          arbitrage: this.config.arbitrageEnabled,
          smartRouting: this.config.enableSmartRouting,
          riskChecks: this.config.enableRiskChecks
        },
        timestamp: new Date()
      });
      
    } catch (error) {
      this.emit('framework_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * Register an exchange connector
   */
  async registerExchange(
    exchangeId: ExchangeId,
    connector: BaseExchangeConnector,
    config: ExchangeConfig
  ): Promise<void> {
    if (this.exchanges.size >= this.config.maxExchanges) {
      throw new Error(`Cannot register more than ${this.config.maxExchanges} exchanges`);
    }
    
    if (this.exchanges.has(exchangeId)) {
      throw new Error(`Exchange ${exchangeId} is already registered`);
    }
    
    try {
      // Initialize the connector
      await connector.initialize();
      
      // Create registration
      const registration: ExchangeRegistration = {
        connector,
        config,
        lastHealthCheck: new Date(),
        performanceMetrics: connector.getPerformanceMetrics(),
        isActive: true,
        connectionCount: 1
      };
      
      // Register event handlers
      this.setupExchangeEventHandlers(exchangeId, connector);
      
      // Store registration
      this.exchanges.set(exchangeId, registration);
      
      // Update connection pool
      this.updateConnectionPool();
      
      this.emit('exchange_registered', {
        exchangeId,
        capabilities: config.capabilities,
        priority: config.priority,
        timestamp: new Date()
      });
      
      // Update framework metrics
      this.frameworkMetrics.totalExchanges = this.exchanges.size;
      this.frameworkMetrics.activeExchanges = Array.from(this.exchanges.values())
        .filter(reg => reg.isActive).length;
      
    } catch (error) {
      this.emit('exchange_registration_failed', {
        exchangeId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * Unregister an exchange
   */
  async unregisterExchange(exchangeId: ExchangeId): Promise<void> {
    const registration = this.exchanges.get(exchangeId);
    if (!registration) {
      throw new Error(`Exchange ${exchangeId} is not registered`);
    }
    
    try {
      // Cleanup connector
      await registration.connector.cleanup();
      
      // Remove from registry
      this.exchanges.delete(exchangeId);
      
      // Update connection pool
      this.updateConnectionPool();
      
      // Clear cached data
      this.clearExchangeCache(exchangeId);
      
      this.emit('exchange_unregistered', {
        exchangeId,
        timestamp: new Date()
      });
      
      // Update framework metrics
      this.frameworkMetrics.totalExchanges = this.exchanges.size;
      this.frameworkMetrics.activeExchanges = Array.from(this.exchanges.values())
        .filter(reg => reg.isActive).length;
      
    } catch (error) {
      this.emit('exchange_unregistration_failed', {
        exchangeId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * Get all registered exchanges
   */
  getRegisteredExchanges(): ExchangeId[] {
    return Array.from(this.exchanges.keys());
  }
  
  /**
   * Get active exchanges
   */
  getActiveExchanges(): ExchangeId[] {
    return Array.from(this.exchanges.entries())
      .filter(([_, reg]) => reg.isActive && reg.connector.getStatus() === 'connected')
      .map(([id, _]) => id);
  }
  
  /**
   * Get exchange health status
   */
  getExchangeHealth(exchangeId?: ExchangeId): ExchangeHealth[] {
    if (exchangeId) {
      const registration = this.exchanges.get(exchangeId);
      return registration ? [registration.connector.getHealth()] : [];
    }
    
    return Array.from(this.exchanges.values())
      .map(reg => reg.connector.getHealth());
  }
  
  /**
   * Get aggregated market data across exchanges
   */
  async getAggregatedMarketData(symbol: string): Promise<Map<ExchangeId, UnifiedMarketData>> {
    const results = new Map<ExchangeId, UnifiedMarketData>();
    
    const promises = Array.from(this.exchanges.entries())
      .filter(([_, reg]) => reg.isActive && reg.connector.getStatus() === 'connected')
      .map(async ([exchangeId, reg]) => {
        try {
          const data = await reg.connector.getMarketData(symbol);
          results.set(exchangeId, data);
        } catch (error) {
          this.emit('market_data_error', {
            exchangeId,
            symbol,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
        }
      });
    
    await Promise.allSettled(promises);
    
    // Cache results
    this.marketDataCache.set(symbol, results);
    
    return results;
  }
  
  /**
   * Get aggregated order book across exchanges
   */
  async getAggregatedOrderBook(symbol: string, depth: number = 10): Promise<Map<ExchangeId, UnifiedOrderBook>> {
    const results = new Map<ExchangeId, UnifiedOrderBook>();
    
    const promises = Array.from(this.exchanges.entries())
      .filter(([_, reg]) => reg.isActive && reg.connector.getStatus() === 'connected')
      .map(async ([exchangeId, reg]) => {
        try {
          const orderBook = await reg.connector.getOrderBook(symbol, depth);
          results.set(exchangeId, orderBook);
        } catch (error) {
          this.emit('order_book_error', {
            exchangeId,
            symbol,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
        }
      });
    
    await Promise.allSettled(promises);
    
    // Cache results
    this.orderBookCache.set(symbol, results);
    
    return results;
  }
  
  /**
   * Execute order with smart routing
   */
  async executeOrder(
    order: Order,
    routingStrategy?: OrderRoutingStrategy
  ): Promise<OrderExecutionResult> {
    const strategy = routingStrategy || this.config.defaultRoutingStrategy;
    
    try {
      // Select best exchange based on strategy
      const targetExchange = await this.selectBestExchange(order, strategy);
      
      if (!targetExchange) {
        throw new Error('No suitable exchange found for order execution');
      }
      
      const registration = this.exchanges.get(targetExchange)!;
      
      // Execute order
      const startTime = performance.now();
      const result = await registration.connector.placeOrder(order);
      const executionTime = performance.now() - startTime;
      
      // Update metrics
      this.frameworkMetrics.totalTrades++;
      this.frameworkMetrics.averageLatency = 
        (this.frameworkMetrics.averageLatency + executionTime) / 2;
      
      this.emit('order_executed', {
        orderId: result.orderId,
        exchangeId: targetExchange,
        executionTime,
        result,
        timestamp: new Date()
      });
      
      return result;
      
    } catch (error) {
      this.emit('order_execution_failed', {
        order,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * Detect arbitrage opportunities
   */
  async detectArbitrageOpportunities(symbols: string[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const symbol of symbols) {
      try {
        const marketData = await this.getAggregatedMarketData(symbol);
        const symbolOpportunities = this.analyzeArbitrageOpportunities(symbol, marketData);
        opportunities.push(...symbolOpportunities);
      } catch (error) {
        this.emit('arbitrage_analysis_error', {
          symbol,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }
    
    // Update active opportunities
    this.updateActiveArbitrageOpportunities(opportunities);
    
    return opportunities.filter(opp => opp.spreadPercent >= this.config.minArbitrageProfit);
  }
  
  /**
   * Get cross-exchange portfolio
   */
  async getCrossExchangePortfolio(forceRefresh: boolean = false): Promise<CrossExchangePortfolio> {
    const now = new Date();
    const cacheAge = now.getTime() - this.lastPortfolioUpdate.getTime();
    
    if (!forceRefresh && this.portfolioCache && cacheAge < this.config.portfolioSyncInterval) {
      return this.portfolioCache;
    }
    
    try {
      // Get balances from all exchanges
      const exchangeBalances = new Map<ExchangeId, ExchangeBalance[]>();
      const promises = Array.from(this.exchanges.entries())
        .filter(([_, reg]) => reg.isActive)
        .map(async ([exchangeId, reg]) => {
          try {
            const balances = await reg.connector.getBalances();
            exchangeBalances.set(exchangeId, balances);
            this.balanceCache.set(exchangeId, balances);
          } catch (error) {
            this.emit('balance_fetch_error', {
              exchangeId,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date()
            });
          }
        });
      
      await Promise.allSettled(promises);
      
      // Calculate portfolio metrics
      const portfolio = this.calculatePortfolioMetrics(exchangeBalances);
      
      // Cache results
      this.portfolioCache = portfolio;
      this.lastPortfolioUpdate = now;
      
      this.emit('portfolio_updated', {
        totalValueUsd: portfolio.totalValueUsd,
        exchangeCount: exchangeBalances.size,
        timestamp: now
      });
      
      return portfolio;
      
    } catch (error) {
      this.emit('portfolio_calculation_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * Get framework performance metrics
   */
  getFrameworkMetrics(): typeof this.frameworkMetrics & {
    exchangeMetrics: Map<ExchangeId, ExchangePerformanceMetrics>;
    connectionPool: ExchangeConnectionPool;
  } {
    const exchangeMetrics = new Map<ExchangeId, ExchangePerformanceMetrics>();
    
    for (const [exchangeId, registration] of this.exchanges) {
      exchangeMetrics.set(exchangeId, registration.connector.getPerformanceMetrics());
    }
    
    return {
      ...this.frameworkMetrics,
      exchangeMetrics,
      connectionPool: this.connectionPool
    };
  }
  
  /**
   * Emergency shutdown
   */
  async emergencyShutdown(reason: string): Promise<void> {
    this.emit('emergency_shutdown_initiated', {
      reason,
      timestamp: new Date()
    });
    
    try {
      // Cancel all active orders
      const cancelPromises: Promise<void>[] = [];
      
      for (const [exchangeId, registration] of this.exchanges) {
        // Implementation would require getting active orders and cancelling them
        // This is a placeholder for the actual implementation
      }
      
      await Promise.allSettled(cancelPromises);
      
      // Shutdown all exchanges
      await this.cleanup();
      
      this.emit('emergency_shutdown_completed', {
        reason,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.emit('emergency_shutdown_error', {
        reason,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    try {
      // Clear timers
      if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
      if (this.portfolioSyncTimer) clearInterval(this.portfolioSyncTimer);
      if (this.arbitrageTimer) clearInterval(this.arbitrageTimer);
      
      // Shutdown all exchanges
      const cleanupPromises = Array.from(this.exchanges.values())
        .map(reg => reg.connector.cleanup());
      
      await Promise.allSettled(cleanupPromises);
      
      // Clear caches
      this.marketDataCache.clear();
      this.orderBookCache.clear();
      this.balanceCache.clear();
      this.activeArbitrageOpportunities.clear();
      this.exchanges.clear();
      
      this.emit('framework_shutdown', {
        timestamp: new Date()
      });
      
    } catch (error) {
      this.emit('cleanup_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }
  }
  
  // === PRIVATE METHODS ===
  
  private setupEventHandlers(): void {
    // Framework-level event handling
    this.on('exchange_registered', this.onExchangeRegistered.bind(this));
    this.on('exchange_unregistered', this.onExchangeUnregistered.bind(this));
  }
  
  private setupExchangeEventHandlers(exchangeId: ExchangeId, connector: BaseExchangeConnector): void {
    connector.on('status_changed', (event) => {
      this.emit('exchange_status_changed', { exchangeId, ...event });
      this.updateExchangeActivity(exchangeId);
    });
    
    connector.on('error', (event) => {
      this.emit('exchange_error', { exchangeId, ...event });
    });
    
    connector.on('order_executed', (event) => {
      this.emit('exchange_order_executed', { exchangeId, ...event });
    });
  }
  
  private updateExchangeActivity(exchangeId: ExchangeId): void {
    const registration = this.exchanges.get(exchangeId);
    if (registration) {
      registration.isActive = registration.connector.getStatus() === 'connected';
      this.frameworkMetrics.activeExchanges = Array.from(this.exchanges.values())
        .filter(reg => reg.isActive).length;
    }
  }
  
  private async selectBestExchange(
    order: Order,
    strategy: OrderRoutingStrategy
  ): Promise<ExchangeId | null> {
    const activeExchanges = this.getActiveExchanges();
    
    if (activeExchanges.length === 0) {
      return null;
    }
    
    switch (strategy.type) {
      case 'best_price':
        return this.selectBestPriceExchange(order, activeExchanges);
      case 'smart_routing':
        return this.selectSmartRoutingExchange(order, activeExchanges);
      default:
        // Use first available exchange
        return activeExchanges[0] || null;
    }
  }
  
  private async selectBestPriceExchange(
    order: Order,
    exchanges: ExchangeId[]
  ): Promise<ExchangeId | null> {
    // Implementation would compare prices across exchanges
    // For now, return first available
    return exchanges[0] || null;
  }
  
  private async selectSmartRoutingExchange(
    order: Order,
    exchanges: ExchangeId[]
  ): Promise<ExchangeId | null> {
    // Implementation would consider multiple factors:
    // - Price
    // - Liquidity
    // - Fees
    // - Latency
    // - Exchange health
    return exchanges[0] || null;
  }
  
  private analyzeArbitrageOpportunities(
    symbol: string,
    marketData: Map<ExchangeId, UnifiedMarketData>
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const exchanges = Array.from(marketData.entries());
    
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = i + 1; j < exchanges.length; j++) {
        const [buyExchange, buyData] = exchanges[i];
        const [sellExchange, sellData] = exchanges[j];
        
        // Check if arbitrage exists in both directions
        const opp1 = this.calculateArbitrageOpportunity(
          symbol, buyExchange, sellExchange, buyData, sellData
        );
        const opp2 = this.calculateArbitrageOpportunity(
          symbol, sellExchange, buyExchange, sellData, buyData
        );
        
        if (opp1) opportunities.push(opp1);
        if (opp2) opportunities.push(opp2);
      }
    }
    
    return opportunities.filter(opp => opp.spreadPercent > 0);
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
    
    if (spread <= 0) {
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
      spread,
      spreadPercent,
      maxVolume: Math.min(buyData.bidDepth, sellData.askDepth),
      estimatedProfit: spread * Math.min(buyData.bidDepth, sellData.askDepth),
      estimatedProfitPercent: spreadPercent,
      requiredCapital: buyPrice * Math.min(buyData.bidDepth, sellData.askDepth),
      minimumProfit: this.config.minArbitrageProfit,
      estimatedExecutionTime: 5000, // 5 seconds estimated
      riskScore: this.calculateRiskScore(buyData, sellData),
      liquidityRisk: buyData.bidDepth < 1000 ? 'high' : 'low',
      executionRisk: 'medium',
      quality: spreadPercent > 1 ? 'excellent' : 'good',
      confidence: Math.min(1, spreadPercent / 2),
      expiresAt: new Date(Date.now() + 30000) // 30 seconds
    };
    
    return opportunity;
  }
  
  private calculateRiskScore(
    buyData: UnifiedMarketData,
    sellData: UnifiedMarketData
  ): number {
    // Simple risk scoring based on liquidity and spread
    let score = 50; // Base score
    
    if (buyData.bidDepth < 1000) score += 20;
    if (sellData.askDepth < 1000) score += 20;
    if (buyData.spread > 0.01) score += 10;
    if (sellData.spread > 0.01) score += 10;
    
    return Math.min(100, score);
  }
  
  private updateActiveArbitrageOpportunities(opportunities: ArbitrageOpportunity[]): void {
    // Clear expired opportunities
    const now = new Date();
    for (const [id, opp] of this.activeArbitrageOpportunities) {
      if (opp.expiresAt < now) {
        this.activeArbitrageOpportunities.delete(id);
      }
    }
    
    // Add new opportunities
    for (const opp of opportunities) {
      this.activeArbitrageOpportunities.set(opp.id, opp);
    }
  }
  
  private calculatePortfolioMetrics(
    exchangeBalances: Map<ExchangeId, ExchangeBalance[]>
  ): CrossExchangePortfolio {
    const assetAllocation = new Map<string, {
      totalAmount: number;
      usdValue: number;
      exchanges: Map<ExchangeId, number>;
      allocation: number;
    }>();
    
    let totalValueUsd = 0;
    
    // Calculate asset allocation across exchanges
    for (const [exchangeId, balances] of exchangeBalances) {
      for (const balance of balances) {
        if (!assetAllocation.has(balance.asset)) {
          assetAllocation.set(balance.asset, {
            totalAmount: 0,
            usdValue: 0,
            exchanges: new Map(),
            allocation: 0
          });
        }
        
        const asset = assetAllocation.get(balance.asset)!;
        asset.totalAmount += balance.total;
        asset.usdValue += balance.usdValue || 0;
        asset.exchanges.set(exchangeId, balance.total);
        
        totalValueUsd += balance.usdValue || 0;
      }
    }
    
    // Calculate allocation percentages
    for (const asset of assetAllocation.values()) {
      asset.allocation = totalValueUsd > 0 ? (asset.usdValue / totalValueUsd) * 100 : 0;
    }
    
    return {
      timestamp: new Date(),
      totalValueUsd,
      exchangeBalances,
      assetAllocation,
      performance: {
        dailyPnL: 0, // Would be calculated from historical data
        dailyPnLPercent: 0,
        weeklyPnL: 0,
        monthlyPnL: 0,
        totalReturn: 0,
        maxDrawdown: 0
      },
      riskMetrics: {
        concentrationRisk: this.calculateConcentrationRisk(assetAllocation),
        exchangeRisk: this.calculateExchangeRisk(exchangeBalances),
        liquidityRisk: 0,
        overallRisk: 'medium'
      }
    };
  }
  
  private calculateConcentrationRisk(assetAllocation: Map<string, any>): number {
    // Calculate concentration risk based on asset allocation
    const allocations = Array.from(assetAllocation.values())
      .map(asset => asset.allocation);
    
    const maxAllocation = Math.max(...allocations);
    return Math.min(100, maxAllocation);
  }
  
  private calculateExchangeRisk(exchangeBalances: Map<ExchangeId, ExchangeBalance[]>): number {
    // Calculate risk based on exchange concentration
    const exchangeValues = Array.from(exchangeBalances.entries())
      .map(([_, balances]) => balances.reduce((sum, b) => sum + (b.usdValue || 0), 0));
    
    const totalValue = exchangeValues.reduce((a, b) => a + b, 0);
    const maxExchangeAllocation = totalValue > 0 
      ? Math.max(...exchangeValues) / totalValue * 100
      : 0;
    
    return Math.min(100, maxExchangeAllocation);
  }
  
  private clearExchangeCache(exchangeId: ExchangeId): void {
    // Clear market data cache
    for (const [symbol, exchangeData] of this.marketDataCache) {
      exchangeData.delete(exchangeId);
      if (exchangeData.size === 0) {
        this.marketDataCache.delete(symbol);
      }
    }
    
    // Clear order book cache
    for (const [symbol, exchangeData] of this.orderBookCache) {
      exchangeData.delete(exchangeId);
      if (exchangeData.size === 0) {
        this.orderBookCache.delete(symbol);
      }
    }
    
    // Clear balance cache
    this.balanceCache.delete(exchangeId);
  }
  
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const [exchangeId, registration] of this.exchanges) {
        try {
          const health = registration.connector.getHealth();
          registration.lastHealthCheck = new Date();
          
          this.emit('exchange_health_update', {
            exchangeId,
            health,
            timestamp: new Date()
          });
        } catch (error) {
          this.emit('health_check_error', {
            exchangeId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
        }
      }
    }, this.config.healthCheckInterval);
  }
  
  private startPortfolioSync(): void {
    this.portfolioSyncTimer = setInterval(async () => {
      try {
        await this.getCrossExchangePortfolio(true);
      } catch (error) {
        this.emit('portfolio_sync_error', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }, this.config.portfolioSyncInterval);
  }
  
  private startArbitrageMonitoring(): void {
    this.arbitrageTimer = setInterval(async () => {
      try {
        // Get list of symbols to monitor (would be configurable)
        const symbols = ['BTC-USD', 'ETH-USD']; // Example symbols
        const opportunities = await this.detectArbitrageOpportunities(symbols);
        
        if (opportunities.length > 0) {
          this.emit('arbitrage_opportunities_detected', {
            count: opportunities.length,
            opportunities: opportunities.slice(0, 5), // Top 5 opportunities
            timestamp: new Date()
          });
        }
      } catch (error) {
        this.emit('arbitrage_monitoring_error', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }, 5000); // Check every 5 seconds
  }
  
  private updateConnectionPool(): void {
    const connectionsByExchange = new Map<ExchangeId, {
      active: number;
      available: number;
      maxConnections: number;
    }>();
    
    let totalConnections = 0;
    let activeConnections = 0;
    
    for (const [exchangeId, registration] of this.exchanges) {
      const maxConn = registration.config.rateLimits.websocketConnections.maxConnections;
      const active = registration.isActive ? registration.connectionCount : 0;
      
      connectionsByExchange.set(exchangeId, {
        active,
        available: Math.max(0, maxConn - active),
        maxConnections: maxConn
      });
      
      totalConnections += maxConn;
      activeConnections += active;
    }
    
    this.connectionPool = {
      totalConnections,
      activeConnections,
      availableConnections: totalConnections - activeConnections,
      connectionsByExchange,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageWaitTime: 0,
      healthStatus: activeConnections / totalConnections > 0.8 ? 'healthy' : 'degraded',
      lastHealthCheck: new Date()
    };
  }
  
  private initializeConnectionPool(): ExchangeConnectionPool {
    return {
      totalConnections: 0,
      activeConnections: 0,
      availableConnections: 0,
      connectionsByExchange: new Map(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageWaitTime: 0,
      healthStatus: 'healthy',
      lastHealthCheck: new Date()
    };
  }
  
  private onExchangeRegistered(event: any): void {
    console.log(`[Framework] Exchange registered: ${event.exchangeId}`);
  }
  
  private onExchangeUnregistered(event: any): void {
    console.log(`[Framework] Exchange unregistered: ${event.exchangeId}`);
  }
  
  private mergeWithDefaults(config: Partial<MultiExchangeConfig>): MultiExchangeConfig {
    return {
      maxExchanges: 10,
      maxConcurrentConnections: 50,
      healthCheckInterval: 30000,
      arbitrageEnabled: true,
      minArbitrageProfit: 0.1,
      maxArbitragePositionSize: 10000,
      arbitrageTimeoutMs: 5000,
      portfolioSyncInterval: 60000,
      enableCrossExchangeRebalancing: false,
      rebalanceThreshold: 5,
      maxExposurePerExchange: 100000,
      maxTotalExposure: 500000,
      enableRiskChecks: true,
      enablePerformanceTracking: true,
      metricsRetentionHours: 24,
      defaultRoutingStrategy: {
        type: 'smart_routing',
        exchanges: [],
        weights: {},
        maxSlippage: 0.5,
        timeoutMs: 10000,
        retryAttempts: 3,
        maxOrderSize: 10000,
        concentrationLimit: 50,
        allowPartialFills: true
      },
      enableSmartRouting: true,
      emergencyShutdownEnabled: true,
      gracefulShutdownTimeoutMs: 30000,
      ...config
    };
  }
}

export default MultiExchangeFramework;