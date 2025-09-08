/**
 * PortfolioSimulator - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Realistic portfolio simulation for backtesting with:
 * - Position tracking and P&L calculation
 * - Cash management and margin requirements
 * - Realistic execution modeling
 * - Portfolio valuation and performance tracking
 * - Risk monitoring and exposure calculation
 * - Transaction cost modeling
 * - Multi-asset portfolio support
 */

import { EventEmitter } from 'events';
import {
  BacktestPortfolioSnapshot,
  BacktestPosition,
  BacktestTrade
} from './types';

/**
 * Portfolio configuration
 */
interface PortfolioConfig {
  initialCapital: number;
  currency: string;
  enableReinvestment: boolean;
  compoundReturns: boolean;
  marginRequirement?: number;    // Margin requirement as decimal (0.1 = 10%)
  maintenanceMargin?: number;    // Maintenance margin as decimal
  interestRate?: number;         // Interest rate for margin positions
}

/**
 * Market data update
 */
interface MarketDataUpdate {
  price: number;
  timestamp: Date;
  volume: number;
}

/**
 * Order fill information
 */
interface OrderFill {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  timestamp: Date;
}

/**
 * Portfolio simulator implementation
 */
export class PortfolioSimulator extends EventEmitter {
  private config: PortfolioConfig;
  private initialized = false;
  
  // Portfolio state
  private cash = 0;
  private reservedCash = 0;
  private positions = new Map<string, BacktestPosition>();
  private marketPrices = new Map<string, number>();
  private lastUpdateTime = new Date();
  
  // Performance tracking
  private initialCapital = 0;
  private peakValue = 0;
  private maxDrawdown = 0;
  private currentDrawdown = 0;
  private totalCommissions = 0;
  private totalSlippage = 0;
  
  // Trade tracking
  private completedTrades: BacktestTrade[] = [];
  private openTrades = new Map<string, Partial<BacktestTrade>>();
  private tradeIdCounter = 0;
  
  // Portfolio history
  private portfolioHistory: BacktestPortfolioSnapshot[] = [];
  private lastSnapshotTime = new Date();
  private snapshotFrequency = 24 * 60 * 60 * 1000; // Daily snapshots
  
  // P&L tracking
  private realizedPnL = 0;
  private dayStartValue = 0;
  private lastDayTimestamp = new Date();

  constructor() {
    super();
  }

  /**
   * Initialize portfolio simulator
   */
  async initialize(config: PortfolioConfig): Promise<void> {
    this.config = {
      marginRequirement: 0.1,
      maintenanceMargin: 0.05,
      interestRate: 0.03,
      ...config
    };
    
    this.cash = config.initialCapital;
    this.initialCapital = config.initialCapital;
    this.peakValue = config.initialCapital;
    this.dayStartValue = config.initialCapital;
    this.lastDayTimestamp = new Date();
    this.lastSnapshotTime = new Date();
    
    // Clear all state
    this.positions.clear();
    this.marketPrices.clear();
    this.completedTrades = [];
    this.openTrades.clear();
    this.portfolioHistory = [];
    
    // Create initial snapshot
    await this.createSnapshot();
    
    this.initialized = true;
    this.emit('initialized', { initialCapital: config.initialCapital });
  }

  /**
   * Update market data for a symbol
   */
  async updateMarketData(symbol: string, data: MarketDataUpdate): Promise<void> {
    if (!this.initialized) {
      throw new Error('PortfolioSimulator not initialized');
    }
    
    const oldPrice = this.marketPrices.get(symbol);
    this.marketPrices.set(symbol, data.price);
    this.lastUpdateTime = data.timestamp;
    
    // Update unrealized P&L for positions
    const position = this.positions.get(symbol);
    if (position) {
      this.updatePositionPnL(position, data.price);
    }
    
    // Check if we need to create a new snapshot
    if (this.shouldCreateSnapshot(data.timestamp)) {
      await this.createSnapshot(data.timestamp);
    }
    
    // Check for new day
    if (this.isNewDay(data.timestamp)) {
      await this.handleNewDay(data.timestamp);
    }
    
    // Emit price update event
    this.emit('price_updated', { 
      symbol, 
      oldPrice, 
      newPrice: data.price, 
      timestamp: data.timestamp 
    });
  }

  /**
   * Process order fill
   */
  async processOrderFill(fill: OrderFill): Promise<void> {
    if (!this.initialized) {
      throw new Error('PortfolioSimulator not initialized');
    }
    
    try {
      const { symbol, side, quantity, price, commission, timestamp } = fill;
      
      // Update cash position
      const totalCost = quantity * price + commission;
      
      if (side === 'buy') {
        this.cash -= totalCost;
        this.totalCommissions += commission;
        await this.openOrIncreasePosition(symbol, quantity, price, timestamp);
      } else {
        this.cash += (quantity * price) - commission;
        this.totalCommissions += commission;
        await this.reduceOrClosePosition(symbol, quantity, price, timestamp);
      }
      
      // Update portfolio metrics
      await this.updatePortfolioMetrics();
      
      this.emit('order_filled', {
        symbol,
        side,
        quantity,
        price,
        commission,
        timestamp,
        cashBalance: this.cash
      });
      
    } catch (error) {
      this.emit('error', new Error(`Failed to process order fill: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  }

  /**
   * Open or increase position
   */
  private async openOrIncreasePosition(
    symbol: string,
    quantity: number,
    price: number,
    timestamp: Date
  ): Promise<void> {
    const existingPosition = this.positions.get(symbol);
    
    if (existingPosition) {
      // Increase existing position
      const totalQuantity = existingPosition.quantity + quantity;
      const totalCost = (existingPosition.entryPrice * existingPosition.quantity) + (price * quantity);
      const averagePrice = totalCost / totalQuantity;
      
      existingPosition.quantity = totalQuantity;
      existingPosition.entryPrice = averagePrice;
      existingPosition.costBasis = totalQuantity * averagePrice;
      
      this.updatePositionPnL(existingPosition, this.marketPrices.get(symbol) || price);
      
    } else {
      // Open new position
      const newPosition: BacktestPosition = {
        symbol,
        side: 'long',
        quantity,
        entryPrice: price,
        currentPrice: price,
        entryTime: timestamp,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        costBasis: quantity * price,
        marketValue: quantity * price,
        strategyId: 'default',
        signalId: this.generateSignalId()
      };
      
      this.positions.set(symbol, newPosition);
      
      // Start tracking trade
      const tradeId = this.generateTradeId();
      this.openTrades.set(tradeId, {
        id: tradeId,
        symbol,
        side: 'long',
        entryTime: timestamp,
        entryPrice: price,
        entryQuantity: quantity,
        entryCommission: 0, // Commission handled separately
        strategyId: 'default',
        signalId: newPosition.signalId
      });
      
      this.emit('position_opened', newPosition);
    }
  }

  /**
   * Reduce or close position
   */
  private async reduceOrClosePosition(
    symbol: string,
    quantity: number,
    price: number,
    timestamp: Date
  ): Promise<void> {
    const position = this.positions.get(symbol);
    if (!position) {
      // Short position (not implemented in this version)
      throw new Error(`No position found to reduce for symbol: ${symbol}`);
    }
    
    if (quantity >= position.quantity) {
      // Close entire position
      await this.closePosition(symbol, price, timestamp);
    } else {
      // Partially reduce position
      const soldValue = quantity * price;
      const soldCostBasis = (quantity / position.quantity) * position.costBasis;
      const partialPnL = soldValue - soldCostBasis;
      
      // Update position
      position.quantity -= quantity;
      position.costBasis -= soldCostBasis;
      position.marketValue = position.quantity * price;
      
      this.updatePositionPnL(position, price);
      
      // Record partial trade (create completed trade for sold portion)
      await this.recordPartialTrade(position, quantity, price, timestamp, partialPnL);
      
      this.realizedPnL += partialPnL;
    }
  }

  /**
   * Close position completely
   */
  private async closePosition(symbol: string, exitPrice: number, timestamp: Date): Promise<void> {
    const position = this.positions.get(symbol);
    if (!position) {
      throw new Error(`No position found to close for symbol: ${symbol}`);
    }
    
    // Calculate final P&L
    const exitValue = position.quantity * exitPrice;
    const totalPnL = exitValue - position.costBasis;
    
    // Find matching open trade
    const openTradeEntry = Array.from(this.openTrades.entries()).find(
      ([_, trade]) => trade.symbol === symbol
    );
    
    if (openTradeEntry) {
      const [tradeId, openTrade] = openTradeEntry;
      
      // Complete the trade record
      const completedTrade: BacktestTrade = {
        id: tradeId,
        symbol,
        side: 'long',
        entryTime: openTrade.entryTime!,
        entryPrice: openTrade.entryPrice!,
        entryQuantity: openTrade.entryQuantity!,
        entryCommission: openTrade.entryCommission || 0,
        entrySlippage: openTrade.entrySlippage || 0,
        exitTime: timestamp,
        exitPrice,
        exitQuantity: position.quantity,
        exitCommission: 0, // Handled separately
        exitSlippage: 0,
        grossPnL: totalPnL,
        netPnL: totalPnL, // Net of commissions calculated elsewhere
        returnPercent: (totalPnL / position.costBasis) * 100,
        holdingPeriod: timestamp.getTime() - position.entryTime.getTime(),
        maxUnrealizedGain: 0, // Would need to track this during position lifetime
        maxUnrealizedLoss: 0,
        maxAdverseExcursion: 0,
        maxFavorableExcursion: 0,
        exitReason: 'signal',
        strategyId: position.strategyId,
        signalId: position.signalId
      };
      
      this.completedTrades.push(completedTrade);
      this.openTrades.delete(tradeId);
      
      this.emit('trade_completed', completedTrade);
    }
    
    // Update realized P&L
    this.realizedPnL += totalPnL;
    
    // Remove position
    this.positions.delete(symbol);
    
    this.emit('position_closed', {
      symbol,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl: totalPnL,
      holdingPeriod: timestamp.getTime() - position.entryTime.getTime()
    });
  }

  /**
   * Record partial trade for position reduction
   */
  private async recordPartialTrade(
    position: BacktestPosition,
    soldQuantity: number,
    exitPrice: number,
    timestamp: Date,
    pnl: number
  ): Promise<void> {
    const partialTrade: BacktestTrade = {
      id: this.generateTradeId(),
      symbol: position.symbol,
      side: position.side,
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      entryQuantity: soldQuantity,
      entryCommission: 0,
      entrySlippage: 0,
      exitTime: timestamp,
      exitPrice,
      exitQuantity: soldQuantity,
      exitCommission: 0,
      exitSlippage: 0,
      grossPnL: pnl,
      netPnL: pnl,
      returnPercent: (pnl / (soldQuantity * position.entryPrice)) * 100,
      holdingPeriod: timestamp.getTime() - position.entryTime.getTime(),
      maxUnrealizedGain: 0,
      maxUnrealizedLoss: 0,
      maxAdverseExcursion: 0,
      maxFavorableExcursion: 0,
      exitReason: 'signal',
      strategyId: position.strategyId,
      signalId: position.signalId
    };
    
    this.completedTrades.push(partialTrade);
    this.emit('trade_completed', partialTrade);
  }

  /**
   * Update position P&L
   */
  private updatePositionPnL(position: BacktestPosition, currentPrice: number): void {
    position.currentPrice = currentPrice;
    position.marketValue = position.quantity * currentPrice;
    position.unrealizedPnL = position.marketValue - position.costBasis;
    position.unrealizedPnLPercent = (position.unrealizedPnL / position.costBasis) * 100;
  }

  /**
   * Update portfolio metrics
   */
  private async updatePortfolioMetrics(): Promise<void> {
    const totalValue = this.calculateTotalValue();
    
    // Update peak value and drawdown
    if (totalValue > this.peakValue) {
      this.peakValue = totalValue;
      this.currentDrawdown = 0;
    } else {
      this.currentDrawdown = ((this.peakValue - totalValue) / this.peakValue) * 100;
      this.maxDrawdown = Math.max(this.maxDrawdown, this.currentDrawdown);
    }
  }

  /**
   * Calculate total portfolio value
   */
  private calculateTotalValue(): number {
    let positionsValue = 0;
    
    for (const position of this.positions.values()) {
      positionsValue += position.marketValue;
    }
    
    return this.cash + positionsValue;
  }

  /**
   * Get current portfolio snapshot
   */
  async getSnapshot(timestamp?: Date): Promise<BacktestPortfolioSnapshot> {
    const currentTime = timestamp || this.lastUpdateTime;
    const totalValue = this.calculateTotalValue();
    const positionsValue = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.marketValue, 0);
    const unrealizedPnL = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    // Calculate day return
    const dayReturn = this.dayStartValue > 0 
      ? ((totalValue - this.dayStartValue) / this.dayStartValue) * 100
      : 0;
    
    return {
      timestamp: currentTime,
      cash: this.cash,
      reservedCash: this.reservedCash,
      availableCash: this.cash - this.reservedCash,
      positionsValue,
      totalValue,
      unrealizedPnL,
      realizedPnL: this.realizedPnL,
      totalPnL: this.realizedPnL + unrealizedPnL,
      totalReturn: ((totalValue / this.initialCapital) - 1) * 100,
      dayReturn,
      exposure: positionsValue > 0 ? (positionsValue / totalValue) * 100 : 0,
      leverage: 1, // Simplified - not using margin in this implementation
      usedMargin: 0,
      availableMargin: totalValue,
      positions: Array.from(this.positions.values()),
      peakValue: this.peakValue,
      drawdown: this.currentDrawdown,
      maxDrawdown: this.maxDrawdown,
      dayPnL: {} // Would need to implement symbol-level tracking
    };
  }

  /**
   * Update timestamp (called by backtest engine)
   */
  async updateTimestamp(timestamp: Date): Promise<void> {
    this.lastUpdateTime = timestamp;
    
    if (this.shouldCreateSnapshot(timestamp)) {
      await this.createSnapshot(timestamp);
    }
    
    if (this.isNewDay(timestamp)) {
      await this.handleNewDay(timestamp);
    }
  }

  /**
   * Check if we should create a snapshot
   */
  private shouldCreateSnapshot(timestamp: Date): boolean {
    return timestamp.getTime() - this.lastSnapshotTime.getTime() >= this.snapshotFrequency;
  }

  /**
   * Check if it's a new day
   */
  private isNewDay(timestamp: Date): boolean {
    return timestamp.toDateString() !== this.lastDayTimestamp.toDateString();
  }

  /**
   * Handle new day
   */
  private async handleNewDay(timestamp: Date): Promise<void> {
    this.dayStartValue = this.calculateTotalValue();
    this.lastDayTimestamp = timestamp;
    
    this.emit('new_day', {
      date: timestamp,
      startValue: this.dayStartValue
    });
  }

  /**
   * Create portfolio snapshot
   */
  private async createSnapshot(timestamp?: Date): Promise<void> {
    const snapshot = await this.getSnapshot(timestamp);
    this.portfolioHistory.push(snapshot);
    this.lastSnapshotTime = timestamp || this.lastUpdateTime;
    
    this.emit('snapshot_created', snapshot);
  }

  /**
   * Get all completed trades
   */
  async getAllTrades(): Promise<BacktestTrade[]> {
    return [...this.completedTrades];
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<BacktestPosition[]> {
    return Array.from(this.positions.values());
  }

  /**
   * Get portfolio history
   */
  async getPortfolioHistory(): Promise<BacktestPortfolioSnapshot[]> {
    return [...this.portfolioHistory];
  }

  /**
   * Get position for symbol
   */
  getPosition(symbol: string): BacktestPosition | undefined {
    return this.positions.get(symbol);
  }

  /**
   * Check if position exists
   */
  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  /**
   * Get available cash
   */
  getAvailableCash(): number {
    return this.cash - this.reservedCash;
  }

  /**
   * Reserve cash for pending orders
   */
  reserveCash(amount: number): void {
    if (amount > this.getAvailableCash()) {
      throw new Error('Insufficient cash to reserve');
    }
    this.reservedCash += amount;
  }

  /**
   * Release reserved cash
   */
  releaseCash(amount: number): void {
    this.reservedCash = Math.max(0, this.reservedCash - amount);
  }

  /**
   * Get total portfolio value
   */
  getTotalValue(): number {
    return this.calculateTotalValue();
  }

  /**
   * Get unrealized P&L
   */
  getUnrealizedPnL(): number {
    return Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  }

  /**
   * Get realized P&L
   */
  getRealizedPnL(): number {
    return this.realizedPnL;
  }

  /**
   * Get total P&L
   */
  getTotalPnL(): number {
    return this.realizedPnL + this.getUnrealizedPnL();
  }

  /**
   * Get current drawdown
   */
  getCurrentDrawdown(): number {
    return this.currentDrawdown;
  }

  /**
   * Get maximum drawdown
   */
  getMaxDrawdown(): number {
    return this.maxDrawdown;
  }

  /**
   * Get total commissions paid
   */
  getTotalCommissions(): number {
    return this.totalCommissions;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalReturn: number;
    totalReturnPercent: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
  } {
    const totalValue = this.calculateTotalValue();
    const totalReturn = totalValue - this.initialCapital;
    const totalReturnPercent = ((totalValue / this.initialCapital) - 1) * 100;
    
    const winningTrades = this.completedTrades.filter(t => t.netPnL > 0);
    const losingTrades = this.completedTrades.filter(t => t.netPnL < 0);
    const winRate = this.completedTrades.length > 0 ? 
      (winningTrades.length / this.completedTrades.length) * 100 : 0;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Simplified Sharpe ratio calculation
    const returns = this.portfolioHistory.map(s => s.dayReturn).filter(r => !isNaN(r));
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const returnStdDev = returns.length > 1 ? this.calculateStandardDeviation(returns) : 0;
    const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
    
    return {
      totalReturn,
      totalReturnPercent,
      winRate,
      profitFactor,
      sharpeRatio,
      maxDrawdown: this.maxDrawdown
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (values.length - 1);
    
    return Math.sqrt(variance);
  }

  /**
   * Generate unique trade ID
   */
  private generateTradeId(): string {
    return `trade_${++this.tradeIdCounter}_${Date.now()}`;
  }

  /**
   * Generate unique signal ID
   */
  private generateSignalId(): string {
    return `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset simulator state
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.cash = 0;
    this.reservedCash = 0;
    this.positions.clear();
    this.marketPrices.clear();
    this.completedTrades = [];
    this.openTrades.clear();
    this.portfolioHistory = [];
    this.realizedPnL = 0;
    this.peakValue = 0;
    this.maxDrawdown = 0;
    this.currentDrawdown = 0;
    this.totalCommissions = 0;
    this.tradeIdCounter = 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): PortfolioConfig {
    return { ...this.config };
  }

  /**
   * Check if simulator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export default PortfolioSimulator;