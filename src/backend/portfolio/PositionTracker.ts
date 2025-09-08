/**
 * Position Tracker - Real-time Position Management
 * Part of Task BE-022: Position Manager Implementation
 * 
 * Manages individual positions with:
 * - Real-time position updates from order fills
 * - P&L calculation and tracking
 * - Position lifecycle management
 * - Integration with order execution system
 * 
 * Performance targets: < 10ms position updates, 100ms P&L calculation
 */

import { EventEmitter } from 'events';
import { Position } from '../../shared/types/trading.js';
import type { PortfolioManager, PortfolioState } from './PortfolioManager.js';

export interface PositionUpdate {
  symbol: string;
  previousQuantity: number;
  newQuantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  fees: number;
  timestamp: Date;
}

export interface OrderFill {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees: number;
  timestamp: Date;
  strategyId?: string;
}

export interface PositionTrackerConfig {
  enableRealTimeUpdates: boolean;
  priceUpdateIntervalMs: number;
  maxPositionsPerSymbol: number;
  enablePositionSizing: boolean;
  defaultLeverage: number;
}

/**
 * Position Tracker manages all trading positions
 */
export class PositionTracker extends EventEmitter {
  private portfolioManager: PortfolioManager;
  private config: PositionTrackerConfig;
  private positions: Map<string, Position> = new Map();
  private marketPrices: Map<string, number> = new Map();
  private priceUpdateTimer: NodeJS.Timer | null = null;
  
  // Performance tracking
  private metrics = {
    positionUpdates: 0,
    avgUpdateTime: 0,
    maxUpdateTime: 0,
    errorCount: 0,
    lastUpdate: new Date()
  };
  
  constructor(portfolioManager: PortfolioManager, config: Partial<PositionTrackerConfig> = {}) {
    super();
    
    this.portfolioManager = portfolioManager;
    this.config = {
      enableRealTimeUpdates: true,
      priceUpdateIntervalMs: 1000,
      maxPositionsPerSymbol: 10,
      enablePositionSizing: true,
      defaultLeverage: 1,
      ...config
    };
  }
  
  /**
   * Initialize position tracker
   */
  async initialize(): Promise<void> {
    console.log('Initializing Position Tracker...');
    
    // Load existing positions from portfolio state
    const state = this.portfolioManager.getState();
    this.positions = new Map(state.positions);
    
    // Start real-time price updates if enabled
    if (this.config.enableRealTimeUpdates) {
      this.startPriceUpdates();
    }
    
    console.log(`Position Tracker initialized with ${this.positions.size} positions`);
  }
  
  /**
   * Update position from order fill
   */
  async updateFromOrderFill(orderId: string, fill: OrderFill): Promise<Position | null> {
    const startTime = Date.now();
    
    try {
      const position = await this.processOrderFill(fill);
      
      if (position) {
        // Update portfolio manager state
        const state = this.portfolioManager.getState();
        state.positions.set(position.symbol, position);
        
        // Emit position update event
        this.emit('position_updated', {
          symbol: position.symbol,
          previousQuantity: this.positions.get(position.symbol)?.quantity || 0,
          newQuantity: position.quantity,
          averageEntryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          unrealizedPnL: position.unrealizedPnL,
          realizedPnL: 0, // Calculate separately
          fees: 0, // Sum from fills
          timestamp: new Date()
        });
        
        // Update local tracking
        this.positions.set(position.symbol, position);
      }
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime);
      
      return position;
      
    } catch (error) {
      this.metrics.errorCount++;
      console.error('Failed to update position from order fill:', error);
      throw error;
    }
  }
  
  /**
   * Get position by symbol
   */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }
  
  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }
  
  /**
   * Get positions by side (long/short)
   */
  getPositionsBySide(side: 'long' | 'short'): Position[] {
    return Array.from(this.positions.values()).filter(pos => pos.side === side);
  }
  
  /**
   * Get open positions
   */
  getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter(pos => pos.quantity !== 0);
  }
  
  /**
   * Update market price for symbol
   */
  updateMarketPrice(symbol: string, price: number): void {
    const previousPrice = this.marketPrices.get(symbol) || price;
    this.marketPrices.set(symbol, price);
    
    // Update position if it exists
    const position = this.positions.get(symbol);
    if (position && position.quantity !== 0) {
      this.updatePositionPrice(position, price);
      
      // Emit price update event
      this.emit('price_updated', {
        symbol,
        previousPrice,
        newPrice: price,
        change: price - previousPrice,
        changePercent: previousPrice > 0 ? ((price - previousPrice) / previousPrice) * 100 : 0
      });
    }
  }
  
  /**
   * Close position completely
   */
  async closePosition(symbol: string, currentPrice: number): Promise<number> {
    const position = this.positions.get(symbol);
    if (!position || position.quantity === 0) {
      return 0;
    }
    
    // Calculate realized P&L
    const realizedPnL = this.calculateRealizedPnL(position, position.quantity, currentPrice);
    
    // Update position
    position.quantity = 0;
    position.marketValue = 0;
    position.unrealizedPnL = 0;
    position.lastUpdatedAt = new Date();
    
    // Remove from positions map
    this.positions.delete(symbol);
    
    // Update portfolio state
    const state = this.portfolioManager.getState();
    state.positions.delete(symbol);
    state.realizedPnL += realizedPnL;
    
    this.emit('position_closed', { position, realizedPnL });
    
    return realizedPnL;
  }
  
  /**
   * Calculate total unrealized P&L
   */
  calculateTotalUnrealizedPnL(): number {
    let totalPnL = 0;
    for (const position of this.positions.values()) {
      if (position.quantity !== 0) {
        totalPnL += position.unrealizedPnL;
      }
    }
    return totalPnL;
  }
  
  /**
   * Get position metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activePositions: this.getOpenPositions().length,
      totalPositions: this.positions.size,
      longPositions: this.getPositionsBySide('long').length,
      shortPositions: this.getPositionsBySide('short').length,
      totalUnrealizedPnL: this.calculateTotalUnrealizedPnL()
    };
  }
  
  // Private methods
  
  private async processOrderFill(fill: OrderFill): Promise<Position | null> {
    let position = this.positions.get(fill.symbol);
    
    if (!position) {
      // Create new position
      position = this.createNewPosition(fill);
    } else {
      // Update existing position
      position = await this.updateExistingPosition(position, fill);
    }
    
    return position;
  }
  
  private createNewPosition(fill: OrderFill): Position {
    const side = fill.side === 'BUY' ? 'long' : 'short';
    const quantity = fill.side === 'BUY' ? fill.quantity : -fill.quantity;
    const currentPrice = this.marketPrices.get(fill.symbol) || fill.price;
    
    const position: Position = {
      id: `${fill.symbol}_${Date.now()}`,
      symbol: fill.symbol,
      side,
      quantity: Math.abs(quantity),
      entryPrice: fill.price,
      currentPrice,
      unrealizedPnL: this.calculateUnrealizedPnL(quantity, fill.price, currentPrice),
      unrealizedPnLPercent: 0,
      marketValue: Math.abs(quantity) * currentPrice,
      strategyId: fill.strategyId,
      openedAt: fill.timestamp,
      lastUpdatedAt: fill.timestamp,
      leverage: this.config.defaultLeverage
    };
    
    // Calculate unrealized P&L percentage
    position.unrealizedPnLPercent = position.entryPrice > 0 ? 
      (position.unrealizedPnL / (position.entryPrice * Math.abs(quantity))) * 100 : 0;
    
    this.emit('position_opened', position);
    
    return position;
  }
  
  private async updateExistingPosition(position: Position, fill: OrderFill): Promise<Position> {
    const fillQuantity = fill.side === 'BUY' ? fill.quantity : -fill.quantity;
    const positionQuantity = position.side === 'long' ? position.quantity : -position.quantity;
    const newQuantity = positionQuantity + fillQuantity;
    
    if (Math.abs(newQuantity) < 0.000001) {
      // Position closed
      const realizedPnL = this.calculateRealizedPnL(position, -positionQuantity, fill.price);
      
      position.quantity = 0;
      position.marketValue = 0;
      position.unrealizedPnL = 0;
      position.unrealizedPnLPercent = 0;
      position.lastUpdatedAt = fill.timestamp;
      
      // Update portfolio realized P&L
      const state = this.portfolioManager.getState();
      state.realizedPnL += realizedPnL;
      
      this.emit('position_closed', { position, realizedPnL });
      
    } else if (Math.sign(newQuantity) === Math.sign(positionQuantity)) {
      // Adding to position (same direction)
      const totalValue = (Math.abs(positionQuantity) * position.entryPrice) + (Math.abs(fillQuantity) * fill.price);
      const totalQuantity = Math.abs(positionQuantity) + Math.abs(fillQuantity);
      
      position.entryPrice = totalValue / totalQuantity; // New average entry price
      position.quantity = totalQuantity;
      position.side = newQuantity > 0 ? 'long' : 'short';
      
    } else {
      // Reducing position or reversing
      const reducedQuantity = Math.min(Math.abs(positionQuantity), Math.abs(fillQuantity));
      const realizedPnL = this.calculateRealizedPnL(position, 
        positionQuantity > 0 ? -reducedQuantity : reducedQuantity, fill.price);
      
      // Update portfolio realized P&L
      const state = this.portfolioManager.getState();
      state.realizedPnL += realizedPnL;
      
      if (Math.abs(fillQuantity) > Math.abs(positionQuantity)) {
        // Position reversal
        const remainingQuantity = Math.abs(fillQuantity) - Math.abs(positionQuantity);
        position.entryPrice = fill.price;
        position.quantity = remainingQuantity;
        position.side = newQuantity > 0 ? 'long' : 'short';
      } else {
        // Partial close
        position.quantity = Math.abs(newQuantity);
        position.side = newQuantity > 0 ? 'long' : 'short';
      }
    }
    
    // Update market value and unrealized P&L
    const currentPrice = this.marketPrices.get(position.symbol) || fill.price;
    this.updatePositionPrice(position, currentPrice);
    position.lastUpdatedAt = fill.timestamp;
    
    return position;
  }
  
  private updatePositionPrice(position: Position, currentPrice: number): void {
    if (position.quantity === 0) return;
    
    position.currentPrice = currentPrice;
    position.marketValue = position.quantity * currentPrice;
    
    const positionQuantity = position.side === 'long' ? position.quantity : -position.quantity;
    position.unrealizedPnL = this.calculateUnrealizedPnL(positionQuantity, position.entryPrice, currentPrice);
    position.unrealizedPnLPercent = position.entryPrice > 0 ? 
      ((currentPrice - position.entryPrice) / position.entryPrice) * 100 * (position.side === 'long' ? 1 : -1) : 0;
  }
  
  private calculateUnrealizedPnL(quantity: number, entryPrice: number, currentPrice: number): number {
    return quantity * (currentPrice - entryPrice);
  }
  
  private calculateRealizedPnL(position: Position, quantityClosed: number, exitPrice: number): number {
    const entryValue = Math.abs(quantityClosed) * position.entryPrice;
    const exitValue = Math.abs(quantityClosed) * exitPrice;
    
    if (position.side === 'long') {
      return exitValue - entryValue;
    } else {
      return entryValue - exitValue;
    }
  }
  
  private startPriceUpdates(): void {
    this.priceUpdateTimer = setInterval(() => {
      // In a real implementation, this would fetch current market prices
      // For now, we'll update positions with existing prices
      for (const [symbol, position] of this.positions) {
        if (position.quantity !== 0) {
          const currentPrice = this.marketPrices.get(symbol);
          if (currentPrice && currentPrice !== position.currentPrice) {
            this.updatePositionPrice(position, currentPrice);
            
            // Update portfolio state
            const state = this.portfolioManager.getState();
            state.positions.set(symbol, position);
          }
        }
      }
    }, this.config.priceUpdateIntervalMs);
  }
  
  private updateMetrics(executionTime: number): void {
    this.metrics.positionUpdates++;
    this.metrics.lastUpdate = new Date();
    this.metrics.maxUpdateTime = Math.max(this.metrics.maxUpdateTime, executionTime);
    
    // Calculate rolling average
    const count = this.metrics.positionUpdates;
    this.metrics.avgUpdateTime = (this.metrics.avgUpdateTime * (count - 1) + executionTime) / count;
  }
  
  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.priceUpdateTimer) {
      clearInterval(this.priceUpdateTimer);
      this.priceUpdateTimer = null;
    }
    
    this.positions.clear();
    this.marketPrices.clear();
    this.removeAllListeners();
  }
}

export default PositionTracker;