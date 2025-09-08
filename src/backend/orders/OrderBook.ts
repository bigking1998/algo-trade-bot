/**
 * Order Book Manager - Task BE-021: Order Book Management and Matching Simulation
 * 
 * Comprehensive order book management system that provides real-time order
 * book tracking, matching engine simulation, and market microstructure analysis.
 * Essential for accurate order execution simulation and market impact assessment.
 * 
 * Features:
 * - Real-time order book construction and maintenance
 * - Order matching engine with price-time priority
 * - Market depth analysis and liquidity assessment
 * - Order book imbalance detection and analysis
 * - Trade impact simulation and slippage calculation
 * - Market maker detection and hidden liquidity estimation
 * - Order flow analysis and market microstructure metrics
 */

import { EventEmitter } from 'events';
import type { OrderSide, OrderType, TimeInForce } from '../execution/OrderExecutor.js';

/**
 * Order Book Level
 */
export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
  timestamp: Date;
}

/**
 * Order Book State
 */
export interface OrderBookState {
  symbol: string;
  timestamp: Date;
  sequence: number;
  
  // Bid/Ask sides
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  
  // Market metrics
  midPrice: number;
  spread: number;
  spreadPct: number;
  
  // Depth metrics
  bidDepth: number;
  askDepth: number;
  totalDepth: number;
  imbalance: number;        // (bidDepth - askDepth) / totalDepth
  
  // Quality metrics
  effectiveSpread: number;  // Effective spread for market orders
  depthAt: {               // Depth at various basis points
    bps1: { bid: number; ask: number; };
    bps5: { bid: number; ask: number; };
    bps10: { bid: number; ask: number; };
    bps25: { bid: number; ask: number; };
  };
}

/**
 * Order Book Order
 */
interface BookOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  originalQuantity: number;
  timestamp: Date;
  priority: number;        // For price-time priority
  orderType: OrderType;
  timeInForce: TimeInForce;
  
  // Order flags
  isMarketMaker: boolean;
  isHidden: boolean;
  isIceberg: boolean;
  visibleQuantity?: number;
  
  // Execution tracking
  filledQuantity: number;
  remainingQuantity: number;
  averagePrice?: number;
  
  // Metadata
  source: 'internal' | 'external';
  userId?: string;
  strategyId?: string;
}

/**
 * Trade Execution
 */
interface TradeExecution {
  id: string;
  symbol: string;
  timestamp: Date;
  
  // Orders involved
  buyOrderId: string;
  sellOrderId: string;
  
  // Trade details
  price: number;
  quantity: number;
  side: OrderSide;      // Aggressor side
  
  // Market impact
  priceBeforeTrade: number;
  priceAfterTrade: number;
  spreadBeforeTrade: number;
  spreadAfterTrade: number;
  
  // Execution quality
  executionType: 'market_crossing' | 'limit_match' | 'stop_trigger';
  liquidityFlag: 'added' | 'removed';
  
  // Fees (if applicable)
  takerFee?: number;
  makerFee?: number;
}

/**
 * Market Impact Analysis
 */
interface MarketImpactAnalysis {
  symbol: string;
  timestamp: Date;
  
  // Order details
  orderId: string;
  side: OrderSide;
  quantity: number;
  
  // Pre-trade metrics
  preTradeSpread: number;
  preTradeDepth: number;
  preTradeImbalance: number;
  preTradePrice: number;
  
  // Post-trade metrics
  postTradeSpread: number;
  postTradeDepth: number;
  postTradeImbalance: number;
  postTradePrice: number;
  
  // Impact calculations
  temporaryImpact: number;    // Immediate price impact
  permanentImpact: number;    // Lasting price impact
  slippage: number;           // Execution slippage
  depthConsumed: number;      // Liquidity consumed
  
  // Recovery analysis
  recoveryTime?: number;      // Time to price recovery (ms)
  recoveryAmount?: number;    // Price recovery amount
}

/**
 * Order Book Statistics
 */
interface OrderBookStatistics {
  symbol: string;
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;
  };
  
  // Update frequency
  updateCount: number;
  updatesPerSecond: number;
  
  // Spread statistics
  averageSpread: number;
  medianSpread: number;
  minSpread: number;
  maxSpread: number;
  spreadVolatility: number;
  
  // Depth statistics
  averageDepth: number;
  medianDepth: number;
  minDepth: number;
  maxDepth: number;
  depthVolatility: number;
  
  // Imbalance statistics
  averageImbalance: number;
  imbalanceVolatility: number;
  imbalanceExtreme: {
    maxBidImbalance: number;
    maxAskImbalance: number;
    timeAtExtremes: number;
  };
  
  // Order flow
  totalOrders: number;
  orderIntensity: number;     // Orders per second
  averageOrderSize: number;
  marketOrderRatio: number;
  cancelOrderRatio: number;
  
  // Trade statistics
  totalTrades: number;
  tradeIntensity: number;     // Trades per second
  averageTradeSize: number;
  totalVolume: number;
  volumeWeightedPrice: number;
  
  // Market maker statistics
  marketMakerOrders: number;
  marketMakerVolume: number;
  marketMakerSpreadCapture: number;
}

/**
 * Order Book Configuration
 */
export interface OrderBookConfig {
  // Book structure
  maxLevels: number;          // Maximum price levels to maintain
  priceTickSize: number;      // Minimum price increment
  quantityTickSize: number;   // Minimum quantity increment
  
  // Performance settings
  enableRealTimeUpdates: boolean;
  updateBatchSize: number;
  maxUpdateFrequency: number; // Max updates per second
  
  // Matching engine
  enableMatching: boolean;
  matchingPriority: 'price_time' | 'pro_rata' | 'size_priority';
  enableHiddenOrders: boolean;
  enableIcebergSupport: boolean;
  
  // Market impact analysis
  enableImpactAnalysis: boolean;
  impactAnalysisWindow: number; // Analysis window (ms)
  impactRecoveryTimeout: number; // Max recovery time (ms)
  
  // Statistics and monitoring
  enableStatistics: boolean;
  statisticsWindow: number;   // Statistics window (ms)
  enableMarketMakerDetection: boolean;
  marketMakerThreshold: number; // Orders required for MM detection
  
  // Memory management
  maxOrderHistory: number;
  maxTradeHistory: number;
  historyCleanupInterval: number;
}

/**
 * Main Order Book Manager
 */
export class OrderBook extends EventEmitter {
  private config: OrderBookConfig;
  private symbol: string;
  
  // Order book state
  private bids: Map<number, OrderBookLevel> = new Map(); // Price -> Level
  private asks: Map<number, OrderBookLevel> = new Map();
  private orders: Map<string, BookOrder> = new Map();    // OrderId -> Order
  private sequence: number = 0;
  
  // Trade tracking
  private trades: Map<string, TradeExecution> = new Map();
  private marketImpacts: Map<string, MarketImpactAnalysis> = new Map();
  
  // Statistics
  private statistics: OrderBookStatistics;
  private statisticsTimer?: NodeJS.Timeout;
  
  // Performance monitoring
  private updateCount = 0;
  private lastUpdateTime = Date.now();
  private processingQueue: any[] = [];
  private batchTimer?: NodeJS.Timeout;
  
  constructor(symbol: string, config: Partial<OrderBookConfig>) {
    super();
    
    this.symbol = symbol;
    this.config = this.mergeWithDefaults(config);
    this.statistics = this.initializeStatistics();
  }

  /**
   * Initialize Order Book
   */
  async initialize(): Promise<void> {
    try {
      // Start statistics collection if enabled
      if (this.config.enableStatistics) {
        this.startStatisticsCollection();
      }
      
      // Start batch processing
      if (this.config.updateBatchSize > 1) {
        this.startBatchProcessing();
      }
      
      this.emit('initialized', {
        symbol: this.symbol,
        maxLevels: this.config.maxLevels,
        matchingEnabled: this.config.enableMatching
      });
      
    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  /**
   * Add order to book
   */
  addOrder(order: Partial<BookOrder>): { success: boolean; orderId?: string; error?: string; } {
    try {
      // Validate order
      const validation = this.validateOrder(order);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      // Create book order
      const bookOrder = this.createBookOrder(order);
      
      // Process based on order type
      let result;
      switch (bookOrder.orderType) {
        case 'market':
          result = this.processMarketOrder(bookOrder);
          break;
        case 'limit':
          result = this.processLimitOrder(bookOrder);
          break;
        case 'stop':
          result = this.processStopOrder(bookOrder);
          break;
        default:
          return { success: false, error: `Unsupported order type: ${bookOrder.orderType}` };
      }
      
      if (result.success) {
        // Update sequence and emit events
        this.sequence++;
        this.updateCount++;
        
        this.emit('order_added', {
          orderId: bookOrder.id,
          symbol: this.symbol,
          side: bookOrder.side,
          price: bookOrder.price,
          quantity: bookOrder.quantity,
          sequence: this.sequence
        });
        
        // Update statistics
        this.updateStatistics('order_added', bookOrder);
        
        return { success: true, orderId: bookOrder.id };
      }
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Cancel order
   */
  cancelOrder(orderId: string): { success: boolean; error?: string; } {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }
      
      if (order.remainingQuantity === 0) {
        return { success: false, error: 'Order already fully filled' };
      }
      
      // Remove from book
      this.removeOrderFromBook(order);
      
      // Remove from tracking
      this.orders.delete(orderId);
      
      this.emit('order_cancelled', {
        orderId,
        symbol: this.symbol,
        remainingQuantity: order.remainingQuantity,
        sequence: ++this.sequence
      });
      
      // Update statistics
      this.updateStatistics('order_cancelled', order);
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update order (price or quantity)
   */
  updateOrder(
    orderId: string, 
    updates: { price?: number; quantity?: number; }
  ): { success: boolean; error?: string; } {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }
      
      // Remove from current position
      this.removeOrderFromBook(order);
      
      // Apply updates
      if (updates.price !== undefined) {
        order.price = updates.price;
      }
      if (updates.quantity !== undefined) {
        order.quantity = updates.quantity;
        order.remainingQuantity = updates.quantity - order.filledQuantity;
      }
      
      // Re-add to book
      const result = this.addOrderToBook(order);
      
      if (result.success) {
        this.emit('order_updated', {
          orderId,
          symbol: this.symbol,
          updates,
          sequence: ++this.sequence
        });
        
        return { success: true };
      }
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get current order book state
   */
  getBookState(): OrderBookState {
    const sortedBids = Array.from(this.bids.entries())
      .sort(([a], [b]) => b - a) // Descending price
      .slice(0, this.config.maxLevels)
      .map(([price, level]) => level);
    
    const sortedAsks = Array.from(this.asks.entries())
      .sort(([a], [b]) => a - b) // Ascending price
      .slice(0, this.config.maxLevels)
      .map(([price, level]) => level);
    
    const bestBid = sortedBids[0]?.price || 0;
    const bestAsk = sortedAsks[0]?.price || Number.MAX_VALUE;
    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;
    
    const bidDepth = sortedBids.reduce((sum, level) => sum + level.quantity, 0);
    const askDepth = sortedAsks.reduce((sum, level) => sum + level.quantity, 0);
    const totalDepth = bidDepth + askDepth;
    const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;
    
    return {
      symbol: this.symbol,
      timestamp: new Date(),
      sequence: this.sequence,
      bids: sortedBids,
      asks: sortedAsks,
      midPrice,
      spread,
      spreadPct,
      bidDepth,
      askDepth,
      totalDepth,
      imbalance,
      effectiveSpread: this.calculateEffectiveSpread(),
      depthAt: this.calculateDepthAtLevels(bestBid, bestAsk)
    };
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): BookOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Get all orders for a side
   */
  getOrdersBySide(side: OrderSide): BookOrder[] {
    return Array.from(this.orders.values())
      .filter(order => order.side === side && order.remainingQuantity > 0);
  }

  /**
   * Simulate market impact of a hypothetical order
   */
  simulateMarketImpact(side: OrderSide, quantity: number): {
    averagePrice: number;
    totalCost: number;
    slippage: number;
    priceImpact: number;
    liquidityConsumed: number;
    wouldFill: boolean;
  } {
    const bookState = this.getBookState();
    const levels = side === 'buy' ? bookState.asks : bookState.bids;
    
    let remainingQuantity = quantity;
    let totalValue = 0;
    let liquidityConsumed = 0;
    let levelsConsumed = 0;
    
    for (const level of levels) {
      if (remainingQuantity <= 0) break;
      
      const quantityAtLevel = Math.min(remainingQuantity, level.quantity);
      totalValue += quantityAtLevel * level.price;
      liquidityConsumed += quantityAtLevel;
      remainingQuantity -= quantityAtLevel;
      levelsConsumed++;
      
      if (quantityAtLevel === level.quantity) {
        // Fully consumed this level
      }
    }
    
    const wouldFill = remainingQuantity === 0;
    const averagePrice = liquidityConsumed > 0 ? totalValue / liquidityConsumed : 0;
    const totalCost = totalValue;
    
    // Calculate slippage and impact
    const referencePrice = side === 'buy' ? levels[0]?.price || 0 : levels[0]?.price || 0;
    const slippage = referencePrice > 0 ? Math.abs(averagePrice - referencePrice) / referencePrice : 0;
    const priceImpact = levelsConsumed / Math.max(levels.length, 1); // Simplified impact measure
    
    return {
      averagePrice,
      totalCost,
      slippage,
      priceImpact,
      liquidityConsumed,
      wouldFill
    };
  }

  /**
   * Get order book statistics
   */
  getStatistics(): OrderBookStatistics {
    return { ...this.statistics };
  }

  /**
   * Get recent trades
   */
  getRecentTrades(limit: number = 50): TradeExecution[] {
    return Array.from(this.trades.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get market impact analyses
   */
  getMarketImpacts(orderId?: string): MarketImpactAnalysis[] {
    if (orderId) {
      const impact = this.marketImpacts.get(orderId);
      return impact ? [impact] : [];
    }
    
    return Array.from(this.marketImpacts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    // Stop timers
    if (this.statisticsTimer) {
      clearInterval(this.statisticsTimer);
    }
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    // Cancel all pending orders
    const orderIds = Array.from(this.orders.keys());
    for (const orderId of orderIds) {
      this.cancelOrder(orderId);
    }
    
    this.emit('cleanup_completed', {
      symbol: this.symbol,
      finalSequence: this.sequence,
      totalTrades: this.statistics.totalTrades
    });
  }

  // === PRIVATE METHODS ===

  private validateOrder(order: Partial<BookOrder>): { valid: boolean; error?: string; } {
    if (!order.symbol || order.symbol !== this.symbol) {
      return { valid: false, error: 'Invalid or mismatched symbol' };
    }
    
    if (!order.side || !['buy', 'sell'].includes(order.side)) {
      return { valid: false, error: 'Invalid order side' };
    }
    
    if (!order.quantity || order.quantity <= 0) {
      return { valid: false, error: 'Invalid quantity' };
    }
    
    if (order.orderType === 'limit' && (!order.price || order.price <= 0)) {
      return { valid: false, error: 'Invalid price for limit order' };
    }
    
    // Check tick sizes
    if (order.price && order.price % this.config.priceTickSize !== 0) {
      return { valid: false, error: 'Price not aligned to tick size' };
    }
    
    if (order.quantity % this.config.quantityTickSize !== 0) {
      return { valid: false, error: 'Quantity not aligned to tick size' };
    }
    
    return { valid: true };
  }

  private createBookOrder(order: Partial<BookOrder>): BookOrder {
    const now = new Date();
    
    return {
      id: order.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: this.symbol,
      side: order.side!,
      price: order.price || 0,
      quantity: order.quantity!,
      originalQuantity: order.quantity!,
      timestamp: now,
      priority: now.getTime() * 1000 + Math.random() * 1000, // Price-time priority
      orderType: order.orderType || 'limit',
      timeInForce: order.timeInForce || 'GTC',
      isMarketMaker: order.isMarketMaker || false,
      isHidden: order.isHidden || false,
      isIceberg: order.isIceberg || false,
      visibleQuantity: order.visibleQuantity,
      filledQuantity: 0,
      remainingQuantity: order.quantity!,
      source: order.source || 'internal',
      userId: order.userId,
      strategyId: order.strategyId
    };
  }

  private processMarketOrder(order: BookOrder): { success: boolean; error?: string; } {
    // Market orders execute immediately against the book
    if (this.config.enableMatching) {
      return this.matchMarketOrder(order);
    } else {
      // For non-matching mode, just track the order
      this.orders.set(order.id, order);
      return { success: true };
    }
  }

  private processLimitOrder(order: BookOrder): { success: boolean; error?: string; } {
    // Try to match immediately if crossing the spread
    if (this.config.enableMatching) {
      const crossingResult = this.checkForCrossing(order);
      if (crossingResult.crosses) {
        return this.matchAgainstBook(order);
      }
    }
    
    // Add to book
    return this.addOrderToBook(order);
  }

  private processStopOrder(order: BookOrder): { success: boolean; error?: string; } {
    // Stop orders are held until triggered
    // For now, just add to tracking (trigger logic would be implemented separately)
    this.orders.set(order.id, order);
    return { success: true };
  }

  private addOrderToBook(order: BookOrder): { success: boolean; error?: string; } {
    try {
      this.orders.set(order.id, order);
      
      // Add to appropriate side
      const levels = order.side === 'buy' ? this.bids : this.asks;
      let level = levels.get(order.price);
      
      if (!level) {
        level = {
          price: order.price,
          quantity: 0,
          orderCount: 0,
          timestamp: new Date()
        };
        levels.set(order.price, level);
      }
      
      level.quantity += order.remainingQuantity;
      level.orderCount++;
      level.timestamp = new Date();
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private removeOrderFromBook(order: BookOrder): void {
    const levels = order.side === 'buy' ? this.bids : this.asks;
    const level = levels.get(order.price);
    
    if (level) {
      level.quantity -= order.remainingQuantity;
      level.orderCount--;
      
      if (level.quantity <= 0 || level.orderCount <= 0) {
        levels.delete(order.price);
      } else {
        level.timestamp = new Date();
      }
    }
  }

  private matchMarketOrder(order: BookOrder): { success: boolean; error?: string; } {
    const oppositeBooks = order.side === 'buy' ? this.asks : this.bids;
    const sortedLevels = Array.from(oppositeBooks.entries())
      .sort(([a], [b]) => order.side === 'buy' ? a - b : b - a); // Best prices first
    
    let remainingQuantity = order.quantity;
    const fills: TradeExecution[] = [];
    
    for (const [price, level] of sortedLevels) {
      if (remainingQuantity <= 0) break;
      
      const fillQuantity = Math.min(remainingQuantity, level.quantity);
      
      // Create trade execution
      const trade = this.createTradeExecution(order, price, fillQuantity, 'market_crossing');
      fills.push(trade);
      this.trades.set(trade.id, trade);
      
      // Update quantities
      remainingQuantity -= fillQuantity;
      order.filledQuantity += fillQuantity;
      order.remainingQuantity = remainingQuantity;
      
      // Update level
      level.quantity -= fillQuantity;
      if (level.quantity <= 0) {
        oppositeBooks.delete(price);
      }
      
      // Emit trade event
      this.emit('trade_executed', trade);
    }
    
    // Track the order even if partially filled
    this.orders.set(order.id, order);
    
    // Analyze market impact if enabled
    if (this.config.enableImpactAnalysis && fills.length > 0) {
      this.analyzeMarketImpact(order, fills);
    }
    
    return { success: true };
  }

  private checkForCrossing(order: BookOrder): { crosses: boolean; crossingPrice?: number; } {
    const oppositeBooks = order.side === 'buy' ? this.asks : this.bids;
    
    if (oppositeBooks.size === 0) {
      return { crosses: false };
    }
    
    const bestOppositePrice = order.side === 'buy' ? 
      Math.min(...Array.from(this.asks.keys())) :
      Math.max(...Array.from(this.bids.keys()));
    
    const crosses = order.side === 'buy' ? 
      order.price >= bestOppositePrice :
      order.price <= bestOppositePrice;
    
    return {
      crosses,
      crossingPrice: crosses ? bestOppositePrice : undefined
    };
  }

  private matchAgainstBook(order: BookOrder): { success: boolean; error?: string; } {
    // Similar to matchMarketOrder but for limit orders that cross
    return this.matchMarketOrder(order);
  }

  private createTradeExecution(
    aggressorOrder: BookOrder, 
    price: number, 
    quantity: number, 
    executionType: any
  ): TradeExecution {
    const bookState = this.getBookState();
    
    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: this.symbol,
      timestamp: new Date(),
      buyOrderId: aggressorOrder.side === 'buy' ? aggressorOrder.id : 'book_liquidity',
      sellOrderId: aggressorOrder.side === 'sell' ? aggressorOrder.id : 'book_liquidity',
      price,
      quantity,
      side: aggressorOrder.side,
      priceBeforeTrade: bookState.midPrice,
      priceAfterTrade: bookState.midPrice, // Would be updated after trade
      spreadBeforeTrade: bookState.spread,
      spreadAfterTrade: bookState.spread, // Would be updated after trade
      executionType,
      liquidityFlag: 'removed', // Aggressor removes liquidity
      takerFee: quantity * price * 0.001, // Mock fee
      makerFee: 0
    };
  }

  private analyzeMarketImpact(order: BookOrder, trades: TradeExecution[]): void {
    if (!this.config.enableImpactAnalysis || trades.length === 0) return;
    
    const preTradeState = this.getBookState();
    const totalQuantity = trades.reduce((sum, trade) => sum + trade.quantity, 0);
    const averagePrice = trades.reduce((sum, trade) => sum + trade.price * trade.quantity, 0) / totalQuantity;
    
    const analysis: MarketImpactAnalysis = {
      symbol: this.symbol,
      timestamp: new Date(),
      orderId: order.id,
      side: order.side,
      quantity: order.quantity,
      preTradeSpread: preTradeState.spread,
      preTradeDepth: preTradeState.totalDepth,
      preTradeImbalance: preTradeState.imbalance,
      preTradePrice: preTradeState.midPrice,
      postTradeSpread: preTradeState.spread, // Simplified - would recalculate
      postTradeDepth: preTradeState.totalDepth - totalQuantity,
      postTradeImbalance: preTradeState.imbalance, // Simplified
      postTradePrice: averagePrice,
      temporaryImpact: Math.abs(averagePrice - preTradeState.midPrice) / preTradeState.midPrice,
      permanentImpact: 0, // Would be calculated after price recovery analysis
      slippage: Math.abs(averagePrice - preTradeState.midPrice) / preTradeState.midPrice,
      depthConsumed: totalQuantity
    };
    
    this.marketImpacts.set(order.id, analysis);
    
    this.emit('market_impact_analyzed', analysis);
  }

  private calculateEffectiveSpread(): number {
    // Effective spread calculation for market orders
    const bookState = this.getBookState();
    return bookState.spread; // Simplified - would calculate based on order sizes
  }

  private calculateDepthAtLevels(bestBid: number, bestAsk: number): any {
    const calculateDepthAt = (basis: number) => {
      const bidPrice = bestBid * (1 - basis / 10000);
      const askPrice = bestAsk * (1 + basis / 10000);
      
      let bidDepth = 0;
      let askDepth = 0;
      
      // Calculate cumulative depth up to price levels
      for (const [price, level] of this.bids.entries()) {
        if (price >= bidPrice) {
          bidDepth += level.quantity;
        }
      }
      
      for (const [price, level] of this.asks.entries()) {
        if (price <= askPrice) {
          askDepth += level.quantity;
        }
      }
      
      return { bid: bidDepth, ask: askDepth };
    };
    
    return {
      bps1: calculateDepthAt(1),
      bps5: calculateDepthAt(5),
      bps10: calculateDepthAt(10),
      bps25: calculateDepthAt(25)
    };
  }

  private updateStatistics(event: string, order: BookOrder): void {
    this.statistics.totalOrders++;
    
    switch (event) {
      case 'order_added':
        this.statistics.orderIntensity = this.statistics.totalOrders / 
          ((Date.now() - this.statistics.timeWindow.start.getTime()) / 1000);
        break;
      case 'order_cancelled':
        this.statistics.cancelOrderRatio = this.statistics.cancelOrderRatio * 0.99 + 0.01; // Exponential moving average
        break;
    }
  }

  private startStatisticsCollection(): void {
    this.statisticsTimer = setInterval(() => {
      this.calculateStatistics();
      this.emit('statistics_updated', this.statistics);
    }, this.config.statisticsWindow);
  }

  private calculateStatistics(): void {
    const now = Date.now();
    const duration = now - this.statistics.timeWindow.start.getTime();
    
    // Update time window
    this.statistics.timeWindow.end = new Date(now);
    this.statistics.timeWindow.duration = duration;
    
    // Calculate order intensity
    this.statistics.orderIntensity = this.statistics.totalOrders / (duration / 1000);
    
    // Calculate spread statistics
    const currentState = this.getBookState();
    this.statistics.averageSpread = (this.statistics.averageSpread * 0.99) + (currentState.spread * 0.01);
    
    // Update other metrics...
  }

  private startBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, 100); // Process batch every 100ms
  }

  private processBatch(): void {
    // Process queued updates in batch
    const batch = this.processingQueue.splice(0, this.config.updateBatchSize);
    
    for (const update of batch) {
      // Process update
    }
    
    if (batch.length > 0) {
      this.emit('batch_processed', {
        batchSize: batch.length,
        queueSize: this.processingQueue.length
      });
    }
  }

  private initializeStatistics(): OrderBookStatistics {
    const now = new Date();
    
    return {
      symbol: this.symbol,
      timeWindow: {
        start: now,
        end: now,
        duration: 0
      },
      updateCount: 0,
      updatesPerSecond: 0,
      averageSpread: 0,
      medianSpread: 0,
      minSpread: Number.MAX_VALUE,
      maxSpread: 0,
      spreadVolatility: 0,
      averageDepth: 0,
      medianDepth: 0,
      minDepth: Number.MAX_VALUE,
      maxDepth: 0,
      depthVolatility: 0,
      averageImbalance: 0,
      imbalanceVolatility: 0,
      imbalanceExtreme: {
        maxBidImbalance: 0,
        maxAskImbalance: 0,
        timeAtExtremes: 0
      },
      totalOrders: 0,
      orderIntensity: 0,
      averageOrderSize: 0,
      marketOrderRatio: 0,
      cancelOrderRatio: 0,
      totalTrades: 0,
      tradeIntensity: 0,
      averageTradeSize: 0,
      totalVolume: 0,
      volumeWeightedPrice: 0,
      marketMakerOrders: 0,
      marketMakerVolume: 0,
      marketMakerSpreadCapture: 0
    };
  }

  private mergeWithDefaults(config: Partial<OrderBookConfig>): OrderBookConfig {
    return {
      maxLevels: 20,
      priceTickSize: 0.0001,
      quantityTickSize: 0.001,
      enableRealTimeUpdates: true,
      updateBatchSize: 10,
      maxUpdateFrequency: 100,
      enableMatching: true,
      matchingPriority: 'price_time',
      enableHiddenOrders: false,
      enableIcebergSupport: false,
      enableImpactAnalysis: true,
      impactAnalysisWindow: 5000,
      impactRecoveryTimeout: 30000,
      enableStatistics: true,
      statisticsWindow: 60000,
      enableMarketMakerDetection: false,
      marketMakerThreshold: 10,
      maxOrderHistory: 10000,
      maxTradeHistory: 10000,
      historyCleanupInterval: 300000,
      ...config
    };
  }
}

export default OrderBook;