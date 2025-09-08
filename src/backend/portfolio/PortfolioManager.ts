/**
 * Portfolio Management Engine - Task BE-022: Position Manager Implementation
 * 
 * Core portfolio management system that provides:
 * - Real-time position tracking and updates
 * - Order execution integration
 * - Portfolio value calculation
 * - P&L tracking and analytics
 * - Risk integration and position management
 * 
 * Performance targets: < 20ms valuation latency, 1000+ positions support
 */

import { EventEmitter } from 'events';
import { Position, PortfolioSummary, RiskMetrics } from '../../shared/types/trading.js';
import { PositionTracker } from './PositionTracker.js';
import { ValuationEngine } from './ValuationEngine.js';
import { PortfolioOptimizer } from './PortfolioOptimizer.js';
import { PerformanceAnalyzer } from './PerformanceAnalyzer.js';
import { OrderManager } from '../orders/OrderManager.js';
import { RiskEngine } from '../risk/RiskEngine.js';
import { DatabaseManager } from '../database/DatabaseManager.js';

export interface PortfolioState {
  positions: Map<string, Position>;
  balances: Map<string, number>;
  totalValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  lastUpdated: Date;
  equityCurve: Array<{ timestamp: number; value: number; pnl: number }>;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  positions: Position[];
  balances: Record<string, number>;
  performance: {
    dailyPnL: number;
    dailyPnLPercent: number;
    totalPnL: number;
    totalPnLPercent: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  risk: {
    portfolioHeat: number;
    totalExposure: number;
    marginUtilization: number;
    var95: number;
    concentrationRisk: number;
  };
}

export interface PortfolioManagerConfig {
  // Performance settings
  valuationIntervalMs: number; // Default: 1000ms (1 second)
  snapshotIntervalMs: number; // Default: 60000ms (1 minute)
  maxPositions: number; // Default: 1000
  
  // Risk settings
  enableRiskMonitoring: boolean; // Default: true
  autoRebalancing: boolean; // Default: false
  rebalanceThreshold: number; // Default: 0.05 (5%)
  
  // Performance settings
  trackPerformance: boolean; // Default: true
  performanceWindowDays: number; // Default: 30
  
  // Storage settings
  persistState: boolean; // Default: true
  snapshotRetentionDays: number; // Default: 365
}

export interface PortfolioEvent {
  type: 'position_updated' | 'valuation_updated' | 'performance_updated' | 'risk_alert' | 'rebalance_required';
  timestamp: number;
  data: any;
}

/**
 * Core Portfolio Manager
 * Coordinates all portfolio management activities with sub-second performance
 */
export class PortfolioManager extends EventEmitter {
  private static instance: PortfolioManager | null = null;
  
  private config: PortfolioManagerConfig;
  private state: PortfolioState;
  private isRunning: boolean = false;
  private lastSnapshot: Date = new Date();
  
  // Core components
  private positionTracker: PositionTracker;
  private valuationEngine: ValuationEngine;
  private portfolioOptimizer: PortfolioOptimizer;
  private performanceAnalyzer: PerformanceAnalyzer;
  
  // External integrations
  private orderManager: OrderManager | null = null;
  private riskEngine: RiskEngine | null = null;
  private dbManager: DatabaseManager | null = null;
  
  // Timers
  private valuationTimer: NodeJS.Timer | null = null;
  private snapshotTimer: NodeJS.Timer | null = null;
  
  // Performance tracking
  private performanceMetrics = {
    valuationCount: 0,
    avgValuationTime: 0,
    maxValuationTime: 0,
    lastValuationTime: 0,
    errorCount: 0,
    lastError: null as Error | null
  };
  
  constructor(config: Partial<PortfolioManagerConfig> = {}) {
    super();
    
    this.config = {
      valuationIntervalMs: 1000,
      snapshotIntervalMs: 60000,
      maxPositions: 1000,
      enableRiskMonitoring: true,
      autoRebalancing: false,
      rebalanceThreshold: 0.05,
      trackPerformance: true,
      performanceWindowDays: 30,
      persistState: true,
      snapshotRetentionDays: 365,
      ...config
    };
    
    // Initialize state
    this.state = {
      positions: new Map(),
      balances: new Map(),
      totalValue: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      lastUpdated: new Date(),
      equityCurve: []
    };
    
    // Initialize components
    this.positionTracker = new PositionTracker(this);
    this.valuationEngine = new ValuationEngine(this);
    this.portfolioOptimizer = new PortfolioOptimizer(this);
    this.performanceAnalyzer = new PerformanceAnalyzer(this);
    
    // Set up component event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<PortfolioManagerConfig>): PortfolioManager {
    if (!this.instance) {
      this.instance = new PortfolioManager(config);
    }
    return this.instance;
  }
  
  /**
   * Initialize portfolio manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Portfolio Manager...');
      
      // Initialize database connection
      if (this.config.persistState) {
        this.dbManager = DatabaseManager.getInstance();
        await this.loadPersistedState();
      }
      
      // Initialize external components
      this.orderManager = OrderManager.getInstance();
      this.riskEngine = RiskEngine.getInstance();
      
      // Initialize sub-components
      await this.positionTracker.initialize();
      await this.valuationEngine.initialize();
      await this.portfolioOptimizer.initialize();
      await this.performanceAnalyzer.initialize();
      
      console.log('Portfolio Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Portfolio Manager:', error);
      throw error;
    }
  }
  
  /**
   * Start portfolio monitoring and management
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Portfolio Manager is already running');
      return;
    }
    
    console.log('Starting Portfolio Manager...');
    this.isRunning = true;
    
    // Start real-time valuation updates
    this.startValuationUpdates();
    
    // Start periodic snapshots
    this.startSnapshotCapture();
    
    // Start performance tracking
    if (this.config.trackPerformance) {
      await this.performanceAnalyzer.startTracking();
    }
    
    // Start risk monitoring
    if (this.config.enableRiskMonitoring) {
      await this.startRiskMonitoring();
    }
    
    this.emit('started');
    console.log('Portfolio Manager started successfully');
  }
  
  /**
   * Stop portfolio management
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    console.log('Stopping Portfolio Manager...');
    this.isRunning = false;
    
    // Stop timers
    if (this.valuationTimer) {
      clearInterval(this.valuationTimer);
      this.valuationTimer = null;
    }
    
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    
    // Stop sub-components
    await this.performanceAnalyzer.stopTracking();
    
    // Save final state
    if (this.config.persistState && this.dbManager) {
      await this.saveState();
    }
    
    this.emit('stopped');
    console.log('Portfolio Manager stopped successfully');
  }
  
  /**
   * Get current portfolio state
   */
  getState(): Readonly<PortfolioState> {
    return { ...this.state };
  }
  
  /**
   * Get current portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const performance = await this.performanceAnalyzer.getPerformanceMetrics();
    
    const positions = Array.from(this.state.positions.values());
    const totalValue = this.state.totalValue;
    const change24h = performance.dailyPnL || 0;
    const change24hPercent = totalValue > 0 ? (change24h / totalValue) * 100 : 0;
    
    // Calculate allocation
    const allocation = positions.map(position => ({
      asset: position.symbol,
      percentage: totalValue > 0 ? (position.marketValue / totalValue) * 100 : 0,
      value: position.marketValue,
      color: this.generateColor(position.symbol)
    }));
    
    return {
      totalValue,
      totalAssets: positions.length,
      change24h,
      change24hPercent,
      assetCount: positions.length,
      largestHolding: this.getLargestHolding(),
      allocation
    };
  }
  
  /**
   * Get current portfolio snapshot
   */
  async getSnapshot(): Promise<PortfolioSnapshot> {
    const performance = await this.performanceAnalyzer.getPerformanceMetrics();
    const riskMetrics = this.config.enableRiskMonitoring && this.riskEngine 
      ? await this.calculateRiskMetrics() 
      : this.getDefaultRiskMetrics();
    
    return {
      timestamp: Date.now(),
      totalValue: this.state.totalValue,
      positions: Array.from(this.state.positions.values()),
      balances: Object.fromEntries(this.state.balances),
      performance: {
        dailyPnL: performance.dailyPnL || 0,
        dailyPnLPercent: performance.dailyPnLPercent || 0,
        totalPnL: this.state.realizedPnL + this.state.unrealizedPnL,
        totalPnLPercent: performance.totalReturnPercent || 0,
        winRate: performance.winRate || 0,
        profitFactor: performance.profitFactor || 0,
        maxDrawdown: performance.maxDrawdown || 0,
        sharpeRatio: performance.sharpeRatio || 0
      },
      risk: {
        portfolioHeat: riskMetrics.portfolioHeat,
        totalExposure: riskMetrics.totalExposure,
        marginUtilization: riskMetrics.marginUtilization,
        var95: 0, // Will be calculated by risk engine
        concentrationRisk: this.calculateConcentrationRisk()
      }
    };
  }
  
  /**
   * Update position from order execution
   */
  async updatePositionFromOrder(orderId: string, fill: any): Promise<void> {
    try {
      const startTime = Date.now();
      
      await this.positionTracker.updateFromOrderFill(orderId, fill);
      await this.updateValuation();
      
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(executionTime);
      
      this.emit('position_updated', { orderId, fill, executionTime });
      
    } catch (error) {
      this.performanceMetrics.errorCount++;
      this.performanceMetrics.lastError = error as Error;
      console.error('Failed to update position from order:', error);
      throw error;
    }
  }
  
  /**
   * Force immediate portfolio valuation
   */
  async updateValuation(): Promise<number> {
    const startTime = Date.now();
    
    try {
      const newValue = await this.valuationEngine.calculatePortfolioValue();
      
      if (newValue !== this.state.totalValue) {
        const previousValue = this.state.totalValue;
        this.state.totalValue = newValue;
        this.state.lastUpdated = new Date();
        
        // Update equity curve
        this.updateEquityCurve(newValue);
        
        // Calculate unrealized P&L
        await this.updateUnrealizedPnL();
        
        const executionTime = Date.now() - startTime;
        this.updatePerformanceMetrics(executionTime);
        
        this.emit('valuation_updated', { 
          previousValue, 
          newValue, 
          change: newValue - previousValue,
          executionTime 
        });
      }
      
      return newValue;
      
    } catch (error) {
      this.performanceMetrics.errorCount++;
      this.performanceMetrics.lastError = error as Error;
      console.error('Portfolio valuation failed:', error);
      throw error;
    }
  }
  
  /**
   * Get portfolio performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
  
  /**
   * Get positions
   */
  getPositions(): Position[] {
    return Array.from(this.state.positions.values());
  }
  
  /**
   * Get position by symbol
   */
  getPosition(symbol: string): Position | undefined {
    return this.state.positions.get(symbol);
  }
  
  /**
   * Get balance for asset
   */
  getBalance(asset: string): number {
    return this.state.balances.get(asset) || 0;
  }
  
  /**
   * Set balance for asset
   */
  setBalance(asset: string, amount: number): void {
    this.state.balances.set(asset, amount);
  }
  
  // Private methods
  
  private setupEventHandlers(): void {
    // Position tracker events
    this.positionTracker.on('position_opened', (position) => {
      this.emit('position_opened', position);
    });
    
    this.positionTracker.on('position_updated', (position) => {
      this.emit('position_updated', position);
    });
    
    this.positionTracker.on('position_closed', (position) => {
      this.emit('position_closed', position);
    });
    
    // Performance analyzer events
    this.performanceAnalyzer.on('performance_updated', (metrics) => {
      this.emit('performance_updated', metrics);
    });
    
    // Risk monitoring events
    if (this.config.enableRiskMonitoring) {
      this.on('risk_alert', (alert) => {
        console.warn('Risk Alert:', alert);
      });
    }
  }
  
  private startValuationUpdates(): void {
    this.valuationTimer = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.updateValuation();
        } catch (error) {
          console.error('Valuation update failed:', error);
        }
      }
    }, this.config.valuationIntervalMs);
  }
  
  private startSnapshotCapture(): void {
    this.snapshotTimer = setInterval(async () => {
      if (this.isRunning) {
        try {
          const snapshot = await this.getSnapshot();
          
          if (this.config.persistState && this.dbManager) {
            await this.saveSnapshot(snapshot);
          }
          
          this.lastSnapshot = new Date();
          this.emit('snapshot_captured', snapshot);
          
        } catch (error) {
          console.error('Snapshot capture failed:', error);
        }
      }
    }, this.config.snapshotIntervalMs);
  }
  
  private async startRiskMonitoring(): Promise<void> {
    if (!this.riskEngine) return;
    
    // Monitor risk every 5 seconds
    setInterval(async () => {
      if (this.isRunning) {
        try {
          const riskMetrics = await this.calculateRiskMetrics();
          
          // Check for risk alerts
          if (riskMetrics.portfolioHeat > 80) {
            this.emit('risk_alert', {
              type: 'high_portfolio_heat',
              level: 'warning',
              value: riskMetrics.portfolioHeat,
              threshold: 80
            });
          }
          
          if (riskMetrics.totalExposure > riskMetrics.availableBalance * 0.9) {
            this.emit('risk_alert', {
              type: 'high_exposure',
              level: 'critical',
              value: riskMetrics.totalExposure,
              threshold: riskMetrics.availableBalance * 0.9
            });
          }
          
        } catch (error) {
          console.error('Risk monitoring failed:', error);
        }
      }
    }, 5000);
  }
  
  private updatePerformanceMetrics(executionTime: number): void {
    this.performanceMetrics.valuationCount++;
    this.performanceMetrics.lastValuationTime = executionTime;
    this.performanceMetrics.maxValuationTime = Math.max(
      this.performanceMetrics.maxValuationTime, 
      executionTime
    );
    
    // Update rolling average
    const count = this.performanceMetrics.valuationCount;
    this.performanceMetrics.avgValuationTime = 
      (this.performanceMetrics.avgValuationTime * (count - 1) + executionTime) / count;
  }
  
  private updateEquityCurve(newValue: number): void {
    const timestamp = Date.now();
    const pnl = newValue - (this.state.equityCurve[this.state.equityCurve.length - 1]?.value || newValue);
    
    this.state.equityCurve.push({ timestamp, value: newValue, pnl });
    
    // Keep only last 10000 points for memory efficiency
    if (this.state.equityCurve.length > 10000) {
      this.state.equityCurve = this.state.equityCurve.slice(-5000);
    }
  }
  
  private async updateUnrealizedPnL(): Promise<void> {
    let totalUnrealizedPnL = 0;
    
    for (const position of this.state.positions.values()) {
      totalUnrealizedPnL += position.unrealizedPnL;
    }
    
    this.state.unrealizedPnL = totalUnrealizedPnL;
  }
  
  private async calculateRiskMetrics(): Promise<RiskMetrics> {
    if (!this.riskEngine) {
      return this.getDefaultRiskMetrics();
    }
    
    // This would integrate with the risk engine to calculate comprehensive risk metrics
    // For now, return basic calculations
    const totalBalance = Array.from(this.state.balances.values()).reduce((sum, balance) => sum + balance, 0);
    const totalExposure = Array.from(this.state.positions.values()).reduce((sum, pos) => sum + Math.abs(pos.marketValue), 0);
    
    return {
      portfolioHeat: this.calculatePortfolioHeat(),
      maxRiskPerTrade: 0.02, // 2% default
      totalExposure,
      availableBalance: totalBalance,
      marginUtilization: totalExposure / Math.max(totalBalance, 1),
      riskRewardRatio: 1.5, // Default
      maxDrawdown: await this.calculateMaxDrawdown(),
      sharpeRatio: await this.calculateSharpeRatio()
    };
  }
  
  private getDefaultRiskMetrics(): RiskMetrics {
    return {
      portfolioHeat: 0,
      maxRiskPerTrade: 0.02,
      totalExposure: 0,
      availableBalance: 0,
      marginUtilization: 0,
      riskRewardRatio: 1.5,
      maxDrawdown: 0,
      sharpeRatio: 0
    };
  }
  
  private calculatePortfolioHeat(): number {
    const positions = Array.from(this.state.positions.values());
    if (positions.length === 0) return 0;
    
    const losingPositions = positions.filter(p => p.unrealizedPnL < 0);
    return (losingPositions.length / positions.length) * 100;
  }
  
  private calculateConcentrationRisk(): number {
    if (this.state.totalValue === 0) return 0;
    
    const positions = Array.from(this.state.positions.values());
    const maxConcentration = positions.reduce((max, position) => {
      const concentration = Math.abs(position.marketValue) / this.state.totalValue;
      return Math.max(max, concentration);
    }, 0);
    
    return maxConcentration;
  }
  
  private async calculateMaxDrawdown(): Promise<number> {
    if (this.state.equityCurve.length < 2) return 0;
    
    let peak = this.state.equityCurve[0].value;
    let maxDrawdown = 0;
    
    for (const point of this.state.equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      } else {
        const drawdown = (peak - point.value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return maxDrawdown;
  }
  
  private async calculateSharpeRatio(): Promise<number> {
    if (this.state.equityCurve.length < 30) return 0; // Need at least 30 data points
    
    const returns = this.state.equityCurve.slice(1).map((point, i) => {
      const prevValue = this.state.equityCurve[i].value;
      return prevValue > 0 ? (point.value - prevValue) / prevValue : 0;
    });
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }
  
  private getLargestHolding(): string {
    let largestValue = 0;
    let largestSymbol = '';
    
    for (const position of this.state.positions.values()) {
      if (Math.abs(position.marketValue) > largestValue) {
        largestValue = Math.abs(position.marketValue);
        largestSymbol = position.symbol;
      }
    }
    
    return largestSymbol;
  }
  
  private generateColor(symbol: string): string {
    // Generate consistent color based on symbol
    const hash = symbol.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  private async loadPersistedState(): Promise<void> {
    // Implementation would load state from database
    console.log('Loading persisted portfolio state...');
  }
  
  private async saveState(): Promise<void> {
    // Implementation would save state to database
    console.log('Saving portfolio state...');
  }
  
  private async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    // Implementation would save snapshot to database
    console.log('Saving portfolio snapshot...');
  }
}

/**
 * Portfolio Manager Factory
 */
export class PortfolioManagerFactory {
  /**
   * Create a new portfolio manager instance
   */
  static create(config?: Partial<PortfolioManagerConfig>): PortfolioManager {
    return new PortfolioManager(config);
  }
  
  /**
   * Get the singleton portfolio manager instance
   */
  static getInstance(config?: Partial<PortfolioManagerConfig>): PortfolioManager {
    return PortfolioManager.getInstance(config);
  }
}

// Export default instance
export const portfolioManager = PortfolioManager.getInstance();