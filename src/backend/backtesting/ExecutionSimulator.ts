/**
 * ExecutionSimulator - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Realistic order execution simulation for backtesting with:
 * - Slippage modeling based on market conditions
 * - Commission calculation with tiered structures
 * - Latency simulation for realistic execution timing
 * - Order fill probability based on market liquidity
 * - Market impact modeling for large orders
 * - Partial fills and order rejection scenarios
 * - Different execution models for various order types
 */

import { EventEmitter } from 'events';

/**
 * Order submission interface
 */
interface OrderSubmission {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
}

/**
 * Execution result
 */
interface ExecutionResult {
  orderId: string;
  filled: boolean;
  fillPrice?: number;
  fillQuantity?: number;
  commission: number;
  slippage: number;
  rejected?: boolean;
  rejectionReason?: string;
  partialFill?: boolean;
  remainingQuantity?: number;
  executionTime: number;
}

/**
 * Execution configuration
 */
interface ExecutionConfig {
  commission: number;           // Base commission rate
  slippage: number;            // Base slippage rate
  latency: number;             // Average execution latency (ms)
  fillRatio: number;           // Probability of order filling (0-1)
  
  // Advanced execution modeling
  enableMarketImpact: boolean;
  enablePartialFills: boolean;
  enableSlippageVariation: boolean;
  enableLatencyVariation: boolean;
  
  // Commission structure
  commissionStructure: 'flat' | 'tiered' | 'percentage';
  minimumCommission?: number;
  maximumCommission?: number;
  tieredRates?: Array<{
    threshold: number;        // Volume threshold
    rate: number;            // Commission rate above threshold
  }>;
  
  // Slippage modeling
  slippageModel: 'fixed' | 'linear' | 'sqrt' | 'logarithmic';
  volatilityAdjustment: boolean;
  liquidityAdjustment: boolean;
  
  // Market conditions
  marketConditions: {
    volatility: number;       // Market volatility factor
    liquidity: number;        // Market liquidity factor
    spread: number;           // Bid-ask spread factor
  };
}

/**
 * Market data for execution simulation
 */
interface MarketState {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  volatility?: number;
  timestamp: Date;
}

/**
 * Order execution simulator
 */
export class ExecutionSimulator extends EventEmitter {
  private config: ExecutionConfig;
  private initialized = false;
  
  // Market state tracking
  private marketState = new Map<string, MarketState>();
  private volatilityHistory = new Map<string, number[]>();
  private volumeHistory = new Map<string, number[]>();
  
  // Order tracking
  private pendingOrders = new Map<string, OrderSubmission>();
  private executionHistory: ExecutionResult[] = [];
  
  // Performance tracking
  private totalCommissions = 0;
  private totalSlippage = 0;
  private totalOrders = 0;
  private filledOrders = 0;
  private rejectedOrders = 0;

  constructor() {
    super();
  }

  /**
   * Initialize execution simulator
   */
  async initialize(config: Partial<ExecutionConfig>): Promise<void> {
    this.config = {
      commission: 0.001,
      slippage: 0.001,
      latency: 100,
      fillRatio: 1.0,
      enableMarketImpact: true,
      enablePartialFills: false,
      enableSlippageVariation: true,
      enableLatencyVariation: true,
      commissionStructure: 'percentage',
      minimumCommission: 1.0,
      maximumCommission: 1000.0,
      slippageModel: 'sqrt',
      volatilityAdjustment: true,
      liquidityAdjustment: true,
      marketConditions: {
        volatility: 1.0,
        liquidity: 1.0,
        spread: 1.0
      },
      ...config
    };
    
    // Clear state
    this.marketState.clear();
    this.volatilityHistory.clear();
    this.volumeHistory.clear();
    this.pendingOrders.clear();
    this.executionHistory = [];
    
    // Reset counters
    this.totalCommissions = 0;
    this.totalSlippage = 0;
    this.totalOrders = 0;
    this.filledOrders = 0;
    this.rejectedOrders = 0;
    
    this.initialized = true;
    this.emit('initialized', { config: this.config });
  }

  /**
   * Submit order for execution
   */
  async submitOrder(order: OrderSubmission, timestamp: Date): Promise<ExecutionResult> {
    if (!this.initialized) {
      throw new Error('ExecutionSimulator not initialized');
    }
    
    this.totalOrders++;
    
    try {
      // Validate order
      this.validateOrder(order);
      
      // Check if order should be rejected
      if (Math.random() > this.config.fillRatio) {
        this.rejectedOrders++;
        const result: ExecutionResult = {
          orderId: order.id,
          filled: false,
          commission: 0,
          slippage: 0,
          rejected: true,
          rejectionReason: 'Insufficient liquidity',
          executionTime: 0
        };
        
        this.executionHistory.push(result);
        this.emit('order_rejected', result);
        return result;
      }
      
      // Simulate execution latency
      const executionLatency = this.calculateExecutionLatency();
      
      // Get market state
      const market = this.getOrCreateMarketState(order.symbol, timestamp);
      
      // Calculate execution price and slippage
      const executionPrice = this.calculateExecutionPrice(order, market);
      const slippage = this.calculateSlippage(order, market, executionPrice);
      
      // Calculate commission
      const commission = this.calculateCommission(order, executionPrice);
      
      // Determine fill quantity (for partial fills)
      const fillQuantity = this.calculateFillQuantity(order, market);
      
      // Create execution result
      const result: ExecutionResult = {
        orderId: order.id,
        filled: fillQuantity > 0,
        fillPrice: executionPrice,
        fillQuantity,
        commission,
        slippage,
        partialFill: fillQuantity < order.quantity,
        remainingQuantity: order.quantity - fillQuantity,
        executionTime: executionLatency
      };
      
      // Update tracking
      if (result.filled) {
        this.filledOrders++;
        this.totalCommissions += commission;
        this.totalSlippage += slippage * fillQuantity * executionPrice;
      }
      
      this.executionHistory.push(result);
      
      // Emit events
      if (result.filled) {
        this.emit('order_filled', result);
      }
      
      this.emit('order_processed', result);
      
      return result;
      
    } catch (error) {
      this.rejectedOrders++;
      const errorResult: ExecutionResult = {
        orderId: order.id,
        filled: false,
        commission: 0,
        slippage: 0,
        rejected: true,
        rejectionReason: error instanceof Error ? error.message : String(error),
        executionTime: 0
      };
      
      this.executionHistory.push(errorResult);
      this.emit('order_error', errorResult);
      return errorResult;
    }
  }

  /**
   * Update market state
   */
  updateMarketState(symbol: string, state: Partial<MarketState>): void {
    const current = this.marketState.get(symbol);
    const updated: MarketState = {
      symbol,
      bid: current?.bid || 0,
      ask: current?.ask || 0,
      last: current?.last || 0,
      volume: current?.volume || 0,
      timestamp: new Date(),
      ...current,
      ...state
    };
    
    this.marketState.set(symbol, updated);
    
    // Update historical data for volatility calculation
    if (updated.last > 0) {
      this.updateVolatilityHistory(symbol, updated.last);
    }
    
    if (updated.volume > 0) {
      this.updateVolumeHistory(symbol, updated.volume);
    }
    
    this.emit('market_updated', { symbol, state: updated });
  }

  /**
   * Validate order parameters
   */
  private validateOrder(order: OrderSubmission): void {
    if (order.quantity <= 0) {
      throw new Error('Order quantity must be positive');
    }
    
    if (order.price <= 0 && order.orderType !== 'market') {
      throw new Error('Order price must be positive for non-market orders');
    }
    
    if (!['buy', 'sell'].includes(order.side)) {
      throw new Error('Invalid order side');
    }
    
    if (!['market', 'limit', 'stop', 'stop_limit'].includes(order.orderType)) {
      throw new Error('Invalid order type');
    }
  }

  /**
   * Get or create market state for symbol
   */
  private getOrCreateMarketState(symbol: string, timestamp: Date): MarketState {
    let market = this.marketState.get(symbol);
    
    if (!market) {
      // Create default market state
      market = {
        symbol,
        bid: 100,      // Default bid
        ask: 100.1,    // Default ask with 0.1% spread
        last: 100,     // Default last price
        volume: 1000,  // Default volume
        volatility: 0.02, // Default 2% volatility
        timestamp
      };
      
      this.marketState.set(symbol, market);
    }
    
    return market;
  }

  /**
   * Calculate execution price based on order type and market conditions
   */
  private calculateExecutionPrice(order: OrderSubmission, market: MarketState): number {
    let basePrice: number;
    
    switch (order.orderType) {
      case 'market':
        // Market orders execute at the opposite side of the book
        basePrice = order.side === 'buy' ? market.ask : market.bid;
        break;
        
      case 'limit':
        // Limit orders execute at the limit price or better
        if (order.side === 'buy') {
          basePrice = Math.min(order.price, market.ask);
        } else {
          basePrice = Math.max(order.price, market.bid);
        }
        break;
        
      case 'stop':
      case 'stop_limit':
        // For simulation, treat as market orders when triggered
        basePrice = order.side === 'buy' ? market.ask : market.bid;
        break;
        
      default:
        basePrice = market.last;
    }
    
    return basePrice;
  }

  /**
   * Calculate slippage based on order and market conditions
   */
  private calculateSlippage(order: OrderSubmission, market: MarketState, executionPrice: number): number {
    let slippage = this.config.slippage;
    
    if (!this.config.enableSlippageVariation) {
      return slippage;
    }
    
    // Base slippage model
    switch (this.config.slippageModel) {
      case 'fixed':
        // No change to base slippage
        break;
        
      case 'linear':
        // Linear increase with order size
        const marketValue = order.quantity * executionPrice;
        const avgVolume = this.getAverageVolume(market.symbol);
        const sizeImpact = marketValue / (avgVolume * executionPrice) * 0.01;
        slippage += sizeImpact;
        break;
        
      case 'sqrt':
        // Square root model (common for market impact)
        const volumeRatio = order.quantity / market.volume;
        slippage += Math.sqrt(volumeRatio) * 0.001;
        break;
        
      case 'logarithmic':
        // Logarithmic model
        const logImpact = Math.log(1 + order.quantity / market.volume);
        slippage += logImpact * 0.0005;
        break;
    }
    
    // Volatility adjustment
    if (this.config.volatilityAdjustment) {
      const volatility = this.getVolatility(market.symbol);
      slippage *= (1 + volatility * this.config.marketConditions.volatility);
    }
    
    // Liquidity adjustment
    if (this.config.liquidityAdjustment) {
      const liquidityFactor = 1 / this.config.marketConditions.liquidity;
      slippage *= liquidityFactor;
    }
    
    // Market conditions adjustment
    const spread = (market.ask - market.bid) / market.last;
    slippage += spread * this.config.marketConditions.spread * 0.5;
    
    // Random variation (±20%)
    if (this.config.enableSlippageVariation) {
      const variation = (Math.random() - 0.5) * 0.4;
      slippage *= (1 + variation);
    }
    
    return Math.max(0, slippage);
  }

  /**
   * Calculate commission based on order and configuration
   */
  private calculateCommission(order: OrderSubmission, executionPrice: number): number {
    const notionalValue = order.quantity * executionPrice;
    let commission = 0;
    
    switch (this.config.commissionStructure) {
      case 'flat':
        commission = this.config.commission;
        break;
        
      case 'percentage':
        commission = notionalValue * this.config.commission;
        break;
        
      case 'tiered':
        if (this.config.tieredRates) {
          let rate = this.config.commission; // Base rate
          
          for (const tier of this.config.tieredRates) {
            if (notionalValue >= tier.threshold) {
              rate = tier.rate;
            } else {
              break;
            }
          }
          
          commission = notionalValue * rate;
        } else {
          commission = notionalValue * this.config.commission;
        }
        break;
    }
    
    // Apply min/max limits
    if (this.config.minimumCommission) {
      commission = Math.max(commission, this.config.minimumCommission);
    }
    
    if (this.config.maximumCommission) {
      commission = Math.min(commission, this.config.maximumCommission);
    }
    
    return commission;
  }

  /**
   * Calculate fill quantity (for partial fills)
   */
  private calculateFillQuantity(order: OrderSubmission, market: MarketState): number {
    if (!this.config.enablePartialFills) {
      return order.quantity; // Full fill
    }
    
    // Simple partial fill model based on order size vs available liquidity
    const availableLiquidity = market.volume * 0.1; // Assume 10% of volume is available
    const maxFillQuantity = Math.min(order.quantity, availableLiquidity);
    
    // Randomly determine partial fill (80% chance of full fill if liquidity allows)
    if (Math.random() < 0.8 || maxFillQuantity >= order.quantity) {
      return order.quantity;
    }
    
    // Partial fill between 50% and 100% of requested quantity
    const minFill = Math.max(1, Math.floor(order.quantity * 0.5));
    const fillQuantity = minFill + Math.random() * (maxFillQuantity - minFill);
    
    return Math.floor(fillQuantity);
  }

  /**
   * Calculate execution latency
   */
  private calculateExecutionLatency(): number {
    let latency = this.config.latency;
    
    if (this.config.enableLatencyVariation) {
      // Add random variation (±50%)
      const variation = (Math.random() - 0.5);
      latency += latency * variation * 0.5;
    }
    
    return Math.max(0, latency);
  }

  /**
   * Update volatility history for symbol
   */
  private updateVolatilityHistory(symbol: string, price: number): void {
    let history = this.volatilityHistory.get(symbol) || [];
    history.push(price);
    
    // Keep only last 100 prices
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    this.volatilityHistory.set(symbol, history);
  }

  /**
   * Update volume history for symbol
   */
  private updateVolumeHistory(symbol: string, volume: number): void {
    let history = this.volumeHistory.get(symbol) || [];
    history.push(volume);
    
    // Keep only last 100 volumes
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    this.volumeHistory.set(symbol, history);
  }

  /**
   * Get volatility for symbol
   */
  private getVolatility(symbol: string): number {
    const history = this.volatilityHistory.get(symbol);
    if (!history || history.length < 2) {
      return 0.02; // Default 2% volatility
    }
    
    // Calculate simple volatility as standard deviation of returns
    const returns = [];
    for (let i = 1; i < history.length; i++) {
      const return_ = (history[i] - history[i-1]) / history[i-1];
      returns.push(return_);
    }
    
    if (returns.length === 0) {
      return 0.02;
    }
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Get average volume for symbol
   */
  private getAverageVolume(symbol: string): number {
    const history = this.volumeHistory.get(symbol);
    if (!history || history.length === 0) {
      return 1000000; // Default volume
    }
    
    return history.reduce((sum, vol) => sum + vol, 0) / history.length;
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalOrders: number;
    filledOrders: number;
    rejectedOrders: number;
    fillRate: number;
    totalCommissions: number;
    totalSlippage: number;
    averageCommission: number;
    averageSlippage: number;
    averageExecutionTime: number;
  } {
    const fillRate = this.totalOrders > 0 ? this.filledOrders / this.totalOrders : 0;
    const averageCommission = this.filledOrders > 0 ? this.totalCommissions / this.filledOrders : 0;
    const averageSlippageValue = this.filledOrders > 0 ? this.totalSlippage / this.filledOrders : 0;
    
    const executionTimes = this.executionHistory
      .filter(result => result.filled)
      .map(result => result.executionTime);
    const averageExecutionTime = executionTimes.length > 0 ? 
      executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length : 0;
    
    return {
      totalOrders: this.totalOrders,
      filledOrders: this.filledOrders,
      rejectedOrders: this.rejectedOrders,
      fillRate,
      totalCommissions: this.totalCommissions,
      totalSlippage: this.totalSlippage,
      averageCommission,
      averageSlippage: averageSlippageValue,
      averageExecutionTime
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * Get current market state
   */
  getMarketState(symbol: string): MarketState | undefined {
    return this.marketState.get(symbol);
  }

  /**
   * Get all market states
   */
  getAllMarketStates(): Map<string, MarketState> {
    return new Map(this.marketState);
  }

  /**
   * Reset simulator state
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.marketState.clear();
    this.volatilityHistory.clear();
    this.volumeHistory.clear();
    this.pendingOrders.clear();
    this.executionHistory = [];
    this.totalCommissions = 0;
    this.totalSlippage = 0;
    this.totalOrders = 0;
    this.filledOrders = 0;
    this.rejectedOrders = 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  /**
   * Check if simulator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Simulate market conditions change
   */
  updateMarketConditions(conditions: Partial<ExecutionConfig['marketConditions']>): void {
    this.config.marketConditions = {
      ...this.config.marketConditions,
      ...conditions
    };
    
    this.emit('market_conditions_changed', this.config.marketConditions);
  }

  /**
   * Get slippage analysis for a symbol
   */
  getSlippageAnalysis(symbol: string): {
    averageSlippage: number;
    maxSlippage: number;
    minSlippage: number;
    slippageVolatility: number;
    sampleCount: number;
  } {
    const symbolExecutions = this.executionHistory.filter(
      result => result.filled && result.orderId.includes(symbol)
    );
    
    if (symbolExecutions.length === 0) {
      return {
        averageSlippage: 0,
        maxSlippage: 0,
        minSlippage: 0,
        slippageVolatility: 0,
        sampleCount: 0
      };
    }
    
    const slippages = symbolExecutions.map(result => result.slippage);
    const averageSlippage = slippages.reduce((sum, s) => sum + s, 0) / slippages.length;
    const maxSlippage = Math.max(...slippages);
    const minSlippage = Math.min(...slippages);
    
    // Calculate slippage volatility
    const variance = slippages.reduce((sum, s) => sum + Math.pow(s - averageSlippage, 2), 0) / slippages.length;
    const slippageVolatility = Math.sqrt(variance);
    
    return {
      averageSlippage,
      maxSlippage,
      minSlippage,
      slippageVolatility,
      sampleCount: slippages.length
    };
  }
}

export default ExecutionSimulator;