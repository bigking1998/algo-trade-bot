/**
 * RiskAnalyzer - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Comprehensive risk analysis for backtesting with:
 * - Real-time risk monitoring and alerts
 * - Drawdown analysis and early warning systems
 * - Value at Risk (VaR) and Conditional VaR calculations
 * - Position sizing and concentration risk analysis
 * - Correlation and portfolio risk assessment
 * - Risk-adjusted performance metrics
 * - Stress testing and scenario analysis
 */

import { EventEmitter } from 'events';
import {
  BacktestPortfolioSnapshot,
  BacktestPosition,
  BacktestTrade,
  HistoricalDataPoint
} from './types';

/**
 * Risk configuration
 */
interface RiskConfig {
  maxDrawdown: number;           // Maximum allowed drawdown percentage
  maxPositionSize: number;       // Maximum position size as % of portfolio
  maxCorrelation: number;        // Maximum allowed correlation between positions
  varConfidenceLevel: number;    // VaR confidence level (e.g., 0.95 for 95% VaR)
  lookbackDays: number;          // Days to look back for risk calculations
  
  // Risk limits
  maxPortfolioLeverage: number;
  maxSectorConcentration: number;
  maxSingleAssetWeight: number;
  
  // Volatility settings
  volatilityWindow: number;      // Rolling window for volatility calculation
  volatilityThreshold: number;   // Volatility threshold for alerts
  
  // Stress testing
  enableStressTesting: boolean;
  stressTestScenarios: StressScenario[];
}

/**
 * Stress test scenario
 */
interface StressScenario {
  name: string;
  description: string;
  shocks: Array<{
    asset: string;
    priceChange: number;        // Percentage change
  }>;
}

/**
 * Risk assessment result
 */
interface RiskAssessment {
  timestamp: Date;
  
  // Portfolio risk metrics
  totalRisk: number;             // Overall risk score (0-100)
  volatility: number;            // Portfolio volatility
  var95: number;                 // 95% Value at Risk
  cvar95: number;                // 95% Conditional VaR
  expectedShortfall: number;     // Expected shortfall
  
  // Concentration risk
  concentrationRisk: number;     // Concentration risk score
  maxPositionWeight: number;     // Largest position weight
  sectorConcentration: Record<string, number>;
  
  // Correlation risk
  averageCorrelation: number;    // Average correlation between positions
  maxCorrelation: number;        // Maximum pairwise correlation
  correlationMatrix: number[][]; // Correlation matrix
  
  // Drawdown metrics
  currentDrawdown: number;       // Current drawdown percentage
  maxDrawdown: number;           // Maximum historical drawdown
  drawdownDuration: number;      // Current drawdown duration (days)
  timeToRecovery: number;        // Estimated recovery time (days)
  
  // Position-specific risks
  positionRisks: Array<{
    symbol: string;
    risk: number;               // Position risk score
    var: number;                // Position VaR
    leverage: number;           // Position leverage
    correlation: number;        // Correlation with portfolio
  }>;
  
  // Risk warnings
  warnings: RiskWarning[];
  
  // Stress test results
  stressTestResults?: Array<{
    scenario: string;
    portfolioLoss: number;      // Potential portfolio loss
    worstPosition: string;      // Position with largest loss
    worstPositionLoss: number;  // Largest position loss
  }>;
}

/**
 * Risk warning
 */
interface RiskWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  recommendation?: string;
}

/**
 * Trade risk check
 */
interface TradeRiskCheck {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
}

/**
 * Trade risk result
 */
interface TradeRiskResult {
  approved: boolean;
  reason?: string;
  riskScore: number;
  impactOnPortfolio: {
    newConcentration: number;
    newVaR: number;
    newDrawdown: number;
    newCorrelation: number;
  };
  recommendations?: string[];
}

/**
 * Risk analyzer implementation
 */
export class RiskAnalyzer extends EventEmitter {
  private config: RiskConfig;
  private initialized = false;
  
  // Historical data for risk calculations
  private portfolioHistory: BacktestPortfolioSnapshot[] = [];
  private marketHistory = new Map<string, HistoricalDataPoint[]>();
  private returnHistory: number[] = [];
  private drawdownHistory: Array<{ timestamp: Date; drawdown: number; duration: number }> = [];
  
  // Current state
  private currentRisk: RiskAssessment | null = null;
  private lastRiskUpdate = new Date();
  private riskAlerts: RiskWarning[] = [];
  
  // Statistical calculations
  private correlationMatrix = new Map<string, Map<string, number>>();
  private volatilities = new Map<string, number>();

  constructor() {
    super();
  }

  /**
   * Initialize risk analyzer
   */
  async initialize(config: Partial<RiskConfig>): Promise<void> {
    this.config = {
      maxDrawdown: 20,              // 20% max drawdown
      maxPositionSize: 10,          // 10% max position size
      maxCorrelation: 0.7,          // 70% max correlation
      varConfidenceLevel: 0.95,     // 95% VaR
      lookbackDays: 252,            // 1 year lookback
      maxPortfolioLeverage: 2.0,    // 2x max leverage
      maxSectorConcentration: 30,   // 30% max sector concentration
      maxSingleAssetWeight: 15,     // 15% max single asset
      volatilityWindow: 30,         // 30-day volatility window
      volatilityThreshold: 25,      // 25% volatility threshold
      enableStressTesting: true,
      stressTestScenarios: [
        {
          name: 'Market Crash',
          description: '2008-style market crash scenario',
          shocks: [
            { asset: 'BTC-USD', priceChange: -50 },
            { asset: 'ETH-USD', priceChange: -60 },
            { asset: 'SOL-USD', priceChange: -70 }
          ]
        },
        {
          name: 'Flash Crash',
          description: 'Sudden 20% market drop',
          shocks: [
            { asset: 'BTC-USD', priceChange: -20 },
            { asset: 'ETH-USD', priceChange: -25 },
            { asset: 'SOL-USD', priceChange: -30 }
          ]
        }
      ],
      ...config
    };
    
    // Clear historical data
    this.portfolioHistory = [];
    this.marketHistory.clear();
    this.returnHistory = [];
    this.drawdownHistory = [];
    this.correlationMatrix.clear();
    this.volatilities.clear();
    this.riskAlerts = [];
    
    this.initialized = true;
    this.emit('initialized', { config: this.config });
  }

  /**
   * Update risk metrics with new portfolio data
   */
  async updateRisk(
    portfolioSnapshot: BacktestPortfolioSnapshot,
    marketData: Map<string, HistoricalDataPoint>
  ): Promise<RiskAssessment> {
    if (!this.initialized) {
      throw new Error('RiskAnalyzer not initialized');
    }
    
    // Add to history
    this.portfolioHistory.push(portfolioSnapshot);
    
    // Update market data
    for (const [symbol, data] of marketData) {
      if (!this.marketHistory.has(symbol)) {
        this.marketHistory.set(symbol, []);
      }
      this.marketHistory.get(symbol)!.push(data);
    }
    
    // Calculate returns
    if (this.portfolioHistory.length > 1) {
      const prevValue = this.portfolioHistory[this.portfolioHistory.length - 2].totalValue;
      const currentValue = portfolioSnapshot.totalValue;
      const portfolioReturn = (currentValue - prevValue) / prevValue;
      this.returnHistory.push(portfolioReturn);
    }
    
    // Keep history within lookback window
    this.trimHistory();
    
    // Calculate comprehensive risk assessment
    const riskAssessment = await this.calculateRiskAssessment(portfolioSnapshot);
    
    // Check for risk breaches
    await this.checkRiskBreaches(riskAssessment);
    
    this.currentRisk = riskAssessment;
    this.lastRiskUpdate = new Date();
    
    this.emit('risk_updated', riskAssessment);
    return riskAssessment;
  }

  /**
   * Calculate comprehensive risk assessment
   */
  private async calculateRiskAssessment(
    portfolioSnapshot: BacktestPortfolioSnapshot
  ): Promise<RiskAssessment> {
    const timestamp = portfolioSnapshot.timestamp;
    
    // Calculate portfolio volatility
    const volatility = this.calculatePortfolioVolatility();
    
    // Calculate VaR and CVaR
    const { var95, cvar95, expectedShortfall } = this.calculateVaR();
    
    // Calculate concentration risk
    const concentrationMetrics = this.calculateConcentrationRisk(portfolioSnapshot);
    
    // Calculate correlation metrics
    const correlationMetrics = this.calculateCorrelationRisk(portfolioSnapshot);
    
    // Calculate drawdown metrics
    const drawdownMetrics = this.calculateDrawdownMetrics(portfolioSnapshot);
    
    // Calculate position-specific risks
    const positionRisks = this.calculatePositionRisks(portfolioSnapshot);
    
    // Calculate total risk score
    const totalRisk = this.calculateTotalRiskScore({
      volatility,
      var95,
      concentrationRisk: concentrationMetrics.concentrationRisk,
      correlationRisk: correlationMetrics.averageCorrelation,
      drawdownRisk: drawdownMetrics.currentDrawdown
    });
    
    // Generate warnings
    const warnings = this.generateRiskWarnings({
      volatility,
      var95,
      concentrationRisk: concentrationMetrics.concentrationRisk,
      currentDrawdown: drawdownMetrics.currentDrawdown,
      maxPositionWeight: concentrationMetrics.maxPositionWeight,
      maxCorrelation: correlationMetrics.maxCorrelation
    });
    
    // Run stress tests if enabled
    let stressTestResults;
    if (this.config.enableStressTesting) {
      stressTestResults = this.runStressTests(portfolioSnapshot);
    }
    
    return {
      timestamp,
      totalRisk,
      volatility,
      var95,
      cvar95,
      expectedShortfall,
      ...concentrationMetrics,
      ...correlationMetrics,
      ...drawdownMetrics,
      positionRisks,
      warnings,
      stressTestResults
    };
  }

  /**
   * Calculate portfolio volatility
   */
  private calculatePortfolioVolatility(): number {
    if (this.returnHistory.length < this.config.volatilityWindow) {
      return 0;
    }
    
    const recentReturns = this.returnHistory.slice(-this.config.volatilityWindow);
    const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
    
    // Annualize volatility
    return Math.sqrt(variance * 252) * 100; // 252 trading days per year
  }

  /**
   * Calculate Value at Risk and Conditional VaR
   */
  private calculateVaR(): {
    var95: number;
    cvar95: number;
    expectedShortfall: number;
  } {
    if (this.returnHistory.length < 30) {
      return { var95: 0, cvar95: 0, expectedShortfall: 0 };
    }
    
    const sortedReturns = this.returnHistory.slice().sort((a, b) => a - b);
    const confidenceLevel = this.config.varConfidenceLevel;
    
    // Calculate VaR (Value at Risk)
    const varIndex = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    const var95 = Math.abs(sortedReturns[varIndex] || 0) * 100;
    
    // Calculate CVaR (Conditional VaR / Expected Shortfall)
    const tailReturns = sortedReturns.slice(0, varIndex + 1);
    const cvar95 = tailReturns.length > 0 ? 
      Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length) * 100 : 0;
    
    // Expected shortfall (same as CVaR in this implementation)
    const expectedShortfall = cvar95;
    
    return { var95, cvar95, expectedShortfall };
  }

  /**
   * Calculate concentration risk metrics
   */
  private calculateConcentrationRisk(portfolioSnapshot: BacktestPortfolioSnapshot): {
    concentrationRisk: number;
    maxPositionWeight: number;
    sectorConcentration: Record<string, number>;
  } {
    const totalValue = portfolioSnapshot.totalValue;
    const positions = portfolioSnapshot.positions;
    
    if (totalValue === 0 || positions.length === 0) {
      return {
        concentrationRisk: 0,
        maxPositionWeight: 0,
        sectorConcentration: {}
      };
    }
    
    // Calculate position weights
    const positionWeights = positions.map(pos => ({
      symbol: pos.symbol,
      weight: (pos.marketValue / totalValue) * 100,
      sector: this.getAssetSector(pos.symbol)
    }));
    
    // Find maximum position weight
    const maxPositionWeight = Math.max(...positionWeights.map(p => p.weight));
    
    // Calculate sector concentration
    const sectorConcentration: Record<string, number> = {};
    for (const pos of positionWeights) {
      if (!sectorConcentration[pos.sector]) {
        sectorConcentration[pos.sector] = 0;
      }
      sectorConcentration[pos.sector] += pos.weight;
    }
    
    // Calculate concentration risk score
    let concentrationRisk = 0;
    
    // Penalize large position sizes
    concentrationRisk += Math.max(0, (maxPositionWeight - this.config.maxSingleAssetWeight) * 2);
    
    // Penalize sector concentration
    for (const sectorWeight of Object.values(sectorConcentration)) {
      concentrationRisk += Math.max(0, (sectorWeight - this.config.maxSectorConcentration) * 1.5);
    }
    
    // Apply Herfindahl-Hirschman Index
    const hhi = positionWeights.reduce((sum, pos) => sum + Math.pow(pos.weight / 100, 2), 0);
    concentrationRisk += hhi * 50; // Scale HHI to risk score
    
    return {
      concentrationRisk: Math.min(100, concentrationRisk), // Cap at 100
      maxPositionWeight,
      sectorConcentration
    };
  }

  /**
   * Calculate correlation risk metrics
   */
  private calculateCorrelationRisk(portfolioSnapshot: BacktestPortfolioSnapshot): {
    averageCorrelation: number;
    maxCorrelation: number;
    correlationMatrix: number[][];
  } {
    const positions = portfolioSnapshot.positions;
    const symbols = positions.map(p => p.symbol);
    
    if (symbols.length < 2) {
      return {
        averageCorrelation: 0,
        maxCorrelation: 0,
        correlationMatrix: []
      };
    }
    
    // Calculate correlation matrix
    const correlationMatrix: number[][] = [];
    const correlations: number[] = [];
    
    for (let i = 0; i < symbols.length; i++) {
      correlationMatrix[i] = [];
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          correlationMatrix[i][j] = 1.0;
        } else {
          const correlation = this.calculatePairwiseCorrelation(symbols[i], symbols[j]);
          correlationMatrix[i][j] = correlation;
          
          if (i < j) { // Avoid double counting
            correlations.push(Math.abs(correlation));
          }
        }
      }
    }
    
    const averageCorrelation = correlations.length > 0 ? 
      correlations.reduce((sum, c) => sum + c, 0) / correlations.length : 0;
    
    const maxCorrelation = correlations.length > 0 ? Math.max(...correlations) : 0;
    
    return {
      averageCorrelation,
      maxCorrelation,
      correlationMatrix
    };
  }

  /**
   * Calculate pairwise correlation between two assets
   */
  private calculatePairwiseCorrelation(symbol1: string, symbol2: string): number {
    const data1 = this.marketHistory.get(symbol1) || [];
    const data2 = this.marketHistory.get(symbol2) || [];
    
    if (data1.length < 30 || data2.length < 30) {
      return 0; // Insufficient data
    }
    
    // Align data by timestamp and calculate returns
    const returns1: number[] = [];
    const returns2: number[] = [];
    
    const minLength = Math.min(data1.length, data2.length, this.config.lookbackDays);
    
    for (let i = 1; i < minLength; i++) {
      const ret1 = (data1[i].close - data1[i-1].close) / data1[i-1].close;
      const ret2 = (data2[i].close - data2[i-1].close) / data2[i-1].close;
      
      returns1.push(ret1);
      returns2.push(ret2);
    }
    
    return this.calculateCorrelation(returns1, returns2);
  }

  /**
   * Calculate correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      denominatorX += deltaX * deltaX;
      denominatorY += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(denominatorX * denominatorY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate drawdown metrics
   */
  private calculateDrawdownMetrics(portfolioSnapshot: BacktestPortfolioSnapshot): {
    currentDrawdown: number;
    maxDrawdown: number;
    drawdownDuration: number;
    timeToRecovery: number;
  } {
    // Use values from portfolio snapshot if available
    const currentDrawdown = portfolioSnapshot.drawdown;
    const maxDrawdown = portfolioSnapshot.maxDrawdown;
    
    // Calculate drawdown duration
    let drawdownDuration = 0;
    let timeToRecovery = 0;
    
    if (this.portfolioHistory.length > 1) {
      // Find start of current drawdown
      for (let i = this.portfolioHistory.length - 1; i >= 0; i--) {
        if (this.portfolioHistory[i].drawdown === 0) {
          drawdownDuration = this.portfolioHistory.length - 1 - i;
          break;
        }
      }
      
      // Estimate time to recovery based on historical patterns
      if (currentDrawdown > 0) {
        timeToRecovery = this.estimateRecoveryTime(currentDrawdown);
      }
    }
    
    return {
      currentDrawdown,
      maxDrawdown,
      drawdownDuration,
      timeToRecovery
    };
  }

  /**
   * Estimate time to recovery from drawdown
   */
  private estimateRecoveryTime(currentDrawdown: number): number {
    // Simple estimation based on historical recovery patterns
    // In practice, this would use more sophisticated modeling
    
    if (currentDrawdown < 5) return 5;   // 5 days for small drawdowns
    if (currentDrawdown < 10) return 15; // 15 days for medium drawdowns
    if (currentDrawdown < 20) return 45; // 45 days for large drawdowns
    return 90; // 90 days for severe drawdowns
  }

  /**
   * Calculate position-specific risks
   */
  private calculatePositionRisks(portfolioSnapshot: BacktestPortfolioSnapshot): Array<{
    symbol: string;
    risk: number;
    var: number;
    leverage: number;
    correlation: number;
  }> {
    const totalValue = portfolioSnapshot.totalValue;
    const positionRisks = [];
    
    for (const position of portfolioSnapshot.positions) {
      const weight = totalValue > 0 ? (position.marketValue / totalValue) * 100 : 0;
      const volatility = this.getAssetVolatility(position.symbol);
      const correlation = this.calculatePortfolioCorrelation(position.symbol, portfolioSnapshot);
      
      // Calculate position VaR
      const positionVar = weight * volatility * 2.33; // 99% VaR approximation
      
      // Calculate position risk score
      let riskScore = 0;
      riskScore += Math.min(weight, 20); // Weight contribution (max 20)
      riskScore += Math.min(volatility, 30); // Volatility contribution (max 30)
      riskScore += Math.min(correlation * 20, 10); // Correlation contribution (max 10)
      
      positionRisks.push({
        symbol: position.symbol,
        risk: riskScore,
        var: positionVar,
        leverage: 1, // Simplified - not using leverage in current implementation
        correlation
      });
    }
    
    return positionRisks;
  }

  /**
   * Calculate correlation of an asset with the portfolio
   */
  private calculatePortfolioCorrelation(symbol: string, portfolioSnapshot: BacktestPortfolioSnapshot): number {
    // Simplified calculation - average correlation with other positions
    const otherSymbols = portfolioSnapshot.positions
      .filter(p => p.symbol !== symbol)
      .map(p => p.symbol);
    
    if (otherSymbols.length === 0) return 0;
    
    const correlations = otherSymbols.map(otherSymbol => 
      Math.abs(this.calculatePairwiseCorrelation(symbol, otherSymbol))
    );
    
    return correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
  }

  /**
   * Calculate total risk score
   */
  private calculateTotalRiskScore(factors: {
    volatility: number;
    var95: number;
    concentrationRisk: number;
    correlationRisk: number;
    drawdownRisk: number;
  }): number {
    const weights = {
      volatility: 0.25,
      var95: 0.25,
      concentration: 0.20,
      correlation: 0.15,
      drawdown: 0.15
    };
    
    // Normalize factors to 0-100 scale
    const normalizedVolatility = Math.min(factors.volatility / this.config.volatilityThreshold * 100, 100);
    const normalizedVar = Math.min(factors.var95 * 10, 100); // Scale VaR
    const normalizedConcentration = factors.concentrationRisk;
    const normalizedCorrelation = factors.correlationRisk * 100;
    const normalizedDrawdown = Math.min(factors.drawdownRisk / this.config.maxDrawdown * 100, 100);
    
    return Math.min(100, 
      normalizedVolatility * weights.volatility +
      normalizedVar * weights.var95 +
      normalizedConcentration * weights.concentration +
      normalizedCorrelation * weights.correlation +
      normalizedDrawdown * weights.drawdown
    );
  }

  /**
   * Generate risk warnings
   */
  private generateRiskWarnings(metrics: {
    volatility: number;
    var95: number;
    concentrationRisk: number;
    currentDrawdown: number;
    maxPositionWeight: number;
    maxCorrelation: number;
  }): RiskWarning[] {
    const warnings: RiskWarning[] = [];
    
    // Volatility warnings
    if (metrics.volatility > this.config.volatilityThreshold) {
      warnings.push({
        level: 'warning',
        message: `Portfolio volatility is elevated at ${metrics.volatility.toFixed(1)}%`,
        metric: 'volatility',
        currentValue: metrics.volatility,
        threshold: this.config.volatilityThreshold,
        recommendation: 'Consider reducing position sizes or adding defensive assets'
      });
    }
    
    // Drawdown warnings
    if (metrics.currentDrawdown > this.config.maxDrawdown * 0.7) {
      const level = metrics.currentDrawdown > this.config.maxDrawdown ? 'critical' : 'warning';
      warnings.push({
        level,
        message: `Current drawdown of ${metrics.currentDrawdown.toFixed(1)}% is approaching limit`,
        metric: 'drawdown',
        currentValue: metrics.currentDrawdown,
        threshold: this.config.maxDrawdown,
        recommendation: 'Consider reducing exposure or implementing stop-loss measures'
      });
    }
    
    // Concentration warnings
    if (metrics.maxPositionWeight > this.config.maxSingleAssetWeight) {
      warnings.push({
        level: 'warning',
        message: `Single position represents ${metrics.maxPositionWeight.toFixed(1)}% of portfolio`,
        metric: 'concentration',
        currentValue: metrics.maxPositionWeight,
        threshold: this.config.maxSingleAssetWeight,
        recommendation: 'Consider diversifying portfolio by reducing largest positions'
      });
    }
    
    // Correlation warnings
    if (metrics.maxCorrelation > this.config.maxCorrelation) {
      warnings.push({
        level: 'info',
        message: `High correlation detected between positions (${(metrics.maxCorrelation * 100).toFixed(1)}%)`,
        metric: 'correlation',
        currentValue: metrics.maxCorrelation * 100,
        threshold: this.config.maxCorrelation * 100,
        recommendation: 'Consider adding uncorrelated assets to improve diversification'
      });
    }
    
    return warnings;
  }

  /**
   * Run stress tests
   */
  private runStressTests(portfolioSnapshot: BacktestPortfolioSnapshot): Array<{
    scenario: string;
    portfolioLoss: number;
    worstPosition: string;
    worstPositionLoss: number;
  }> {
    const results = [];
    
    for (const scenario of this.config.stressTestScenarios) {
      let totalLoss = 0;
      let worstPosition = '';
      let worstPositionLoss = 0;
      
      for (const position of portfolioSnapshot.positions) {
        const shock = scenario.shocks.find(s => s.asset === position.symbol);
        if (shock) {
          const positionLoss = position.marketValue * (shock.priceChange / 100);
          totalLoss += positionLoss;
          
          if (Math.abs(positionLoss) > Math.abs(worstPositionLoss)) {
            worstPosition = position.symbol;
            worstPositionLoss = positionLoss;
          }
        }
      }
      
      results.push({
        scenario: scenario.name,
        portfolioLoss: totalLoss,
        worstPosition,
        worstPositionLoss
      });
    }
    
    return results;
  }

  /**
   * Check trade risk before execution
   */
  async checkTradeRisk(trade: TradeRiskCheck): Promise<TradeRiskResult> {
    if (!this.initialized || !this.currentRisk) {
      return {
        approved: true,
        riskScore: 0,
        impactOnPortfolio: {
          newConcentration: 0,
          newVaR: 0,
          newDrawdown: 0,
          newCorrelation: 0
        }
      };
    }
    
    const tradeValue = trade.quantity * trade.price;
    const lastPortfolio = this.portfolioHistory[this.portfolioHistory.length - 1];
    const currentPortfolioValue = lastPortfolio.totalValue;
    
    // Calculate trade impact
    const positionWeight = (tradeValue / currentPortfolioValue) * 100;
    
    // Check position size limit
    if (positionWeight > this.config.maxPositionSize) {
      return {
        approved: false,
        reason: `Position size ${positionWeight.toFixed(1)}% exceeds limit of ${this.config.maxPositionSize}%`,
        riskScore: 100,
        impactOnPortfolio: {
          newConcentration: positionWeight,
          newVaR: this.currentRisk.var95,
          newDrawdown: this.currentRisk.currentDrawdown,
          newCorrelation: this.currentRisk.averageCorrelation
        }
      };
    }
    
    // Check correlation with existing positions
    const avgCorrelation = this.calculatePortfolioCorrelation(trade.symbol, lastPortfolio);
    if (avgCorrelation > this.config.maxCorrelation) {
      return {
        approved: false,
        reason: `High correlation with existing positions (${(avgCorrelation * 100).toFixed(1)}%)`,
        riskScore: 80,
        impactOnPortfolio: {
          newConcentration: positionWeight,
          newVaR: this.currentRisk.var95,
          newDrawdown: this.currentRisk.currentDrawdown,
          newCorrelation: avgCorrelation
        }
      };
    }
    
    // Calculate risk score
    const riskScore = Math.min(100, 
      positionWeight * 2 + 
      avgCorrelation * 50 + 
      (this.getAssetVolatility(trade.symbol) / this.config.volatilityThreshold) * 30
    );
    
    const recommendations = [];
    if (positionWeight > this.config.maxPositionSize * 0.8) {
      recommendations.push('Consider reducing position size');
    }
    if (avgCorrelation > this.config.maxCorrelation * 0.8) {
      recommendations.push('Monitor correlation with existing positions');
    }
    
    return {
      approved: true,
      riskScore,
      impactOnPortfolio: {
        newConcentration: positionWeight,
        newVaR: this.currentRisk.var95,
        newDrawdown: this.currentRisk.currentDrawdown,
        newCorrelation: avgCorrelation
      },
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  /**
   * Check for risk breaches and emit alerts
   */
  private async checkRiskBreaches(riskAssessment: RiskAssessment): Promise<void> {
    const criticalWarnings = riskAssessment.warnings.filter(w => w.level === 'critical');
    const warningAlerts = riskAssessment.warnings.filter(w => w.level === 'warning');
    
    if (criticalWarnings.length > 0) {
      this.emit('risk_breach', {
        level: 'critical',
        warnings: criticalWarnings,
        assessment: riskAssessment
      });
    }
    
    if (warningAlerts.length > 0) {
      this.emit('risk_warning', {
        level: 'warning',
        warnings: warningAlerts,
        assessment: riskAssessment
      });
    }
    
    // Check for margin call conditions
    if (riskAssessment.currentDrawdown > this.config.maxDrawdown) {
      this.emit('margin_call', {
        drawdown: riskAssessment.currentDrawdown,
        limit: this.config.maxDrawdown,
        portfolioValue: this.portfolioHistory[this.portfolioHistory.length - 1]?.totalValue || 0
      });
    }
  }

  /**
   * Calculate final risk metrics for completed backtest
   */
  async calculateFinalRisk(input: {
    portfolioHistory: BacktestPortfolioSnapshot[];
    trades: BacktestTrade[];
  }): Promise<{
    volatility: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    maxDrawdownDuration: number;
    skewness: number;
    kurtosis: number;
    var95: number;
    cvar95: number;
  }> {
    const { portfolioHistory } = input;
    
    if (portfolioHistory.length === 0) {
      return {
        volatility: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        maxDrawdownDuration: 0,
        skewness: 0,
        kurtosis: 0,
        var95: 0,
        cvar95: 0
      };
    }
    
    // Calculate returns
    const returns = [];
    for (let i = 1; i < portfolioHistory.length; i++) {
      const prevValue = portfolioHistory[i - 1].totalValue;
      const currValue = portfolioHistory[i].totalValue;
      const dailyReturn = (currValue - prevValue) / prevValue;
      returns.push(dailyReturn);
    }
    
    // Calculate volatility
    const volatility = this.calculateVolatility(returns);
    
    // Calculate drawdown metrics
    const drawdownMetrics = this.calculateFinalDrawdownMetrics(portfolioHistory);
    
    // Calculate distribution metrics
    const distributionMetrics = this.calculateDistributionMetrics(returns);
    
    // Calculate VaR metrics
    const varMetrics = this.calculateFinalVarMetrics(returns);
    
    return {
      volatility: volatility * Math.sqrt(252) * 100, // Annualized
      ...drawdownMetrics,
      ...distributionMetrics,
      ...varMetrics
    };
  }

  /**
   * Calculate volatility from returns
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate final drawdown metrics
   */
  private calculateFinalDrawdownMetrics(portfolioHistory: BacktestPortfolioSnapshot[]): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
    maxDrawdownDuration: number;
  } {
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let maxDrawdownDuration = 0;
    
    let peak = portfolioHistory[0].totalValue;
    let peakIndex = 0;
    let inDrawdown = false;
    
    for (let i = 0; i < portfolioHistory.length; i++) {
      const currentValue = portfolioHistory[i].totalValue;
      
      if (currentValue > peak) {
        if (inDrawdown) {
          const duration = i - peakIndex;
          maxDrawdownDuration = Math.max(maxDrawdownDuration, duration);
          inDrawdown = false;
        }
        peak = currentValue;
        peakIndex = i;
      } else {
        if (!inDrawdown) {
          inDrawdown = true;
        }
        
        const drawdown = peak - currentValue;
        const drawdownPercent = (drawdown / peak) * 100;
        
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
      }
    }
    
    // Handle case where we end in drawdown
    if (inDrawdown) {
      const duration = portfolioHistory.length - 1 - peakIndex;
      maxDrawdownDuration = Math.max(maxDrawdownDuration, duration);
    }
    
    return { maxDrawdown, maxDrawdownPercent, maxDrawdownDuration };
  }

  /**
   * Calculate distribution metrics (skewness and kurtosis)
   */
  private calculateDistributionMetrics(returns: number[]): {
    skewness: number;
    kurtosis: number;
  } {
    if (returns.length < 3) {
      return { skewness: 0, kurtosis: 0 };
    }
    
    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    
    // Calculate moments
    let m2 = 0, m3 = 0, m4 = 0;
    for (const r of returns) {
      const deviation = r - mean;
      const deviation2 = deviation * deviation;
      const deviation3 = deviation2 * deviation;
      const deviation4 = deviation2 * deviation2;
      
      m2 += deviation2;
      m3 += deviation3;
      m4 += deviation4;
    }
    
    m2 /= n;
    m3 /= n;
    m4 /= n;
    
    // Calculate skewness and kurtosis
    const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
    const kurtosis = m2 > 0 ? (m4 / (m2 * m2)) - 3 : 0; // Excess kurtosis
    
    return { skewness, kurtosis };
  }

  /**
   * Calculate final VaR metrics
   */
  private calculateFinalVarMetrics(returns: number[]): {
    var95: number;
    cvar95: number;
  } {
    if (returns.length < 30) {
      return { var95: 0, cvar95: 0 };
    }
    
    const sortedReturns = returns.slice().sort((a, b) => a - b);
    const varIndex = Math.floor(0.05 * sortedReturns.length);
    
    const var95 = Math.abs(sortedReturns[varIndex] || 0) * 100;
    
    const tailReturns = sortedReturns.slice(0, varIndex + 1);
    const cvar95 = tailReturns.length > 0 ? 
      Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length) * 100 : 0;
    
    return { var95, cvar95 };
  }

  /**
   * Utility methods
   */

  /**
   * Get asset sector (simplified categorization)
   */
  private getAssetSector(symbol: string): string {
    if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL')) {
      return 'Crypto';
    }
    if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP')) {
      return 'Forex';
    }
    return 'Other';
  }

  /**
   * Get asset volatility
   */
  private getAssetVolatility(symbol: string): number {
    const data = this.marketHistory.get(symbol) || [];
    if (data.length < 30) return 20; // Default 20% volatility
    
    const returns = [];
    for (let i = 1; i < Math.min(data.length, 30); i++) {
      const ret = (data[i].close - data[i-1].close) / data[i-1].close;
      returns.push(ret);
    }
    
    return this.calculateVolatility(returns) * Math.sqrt(252) * 100;
  }

  /**
   * Trim historical data to lookback window
   */
  private trimHistory(): void {
    const maxHistory = this.config.lookbackDays;
    
    if (this.portfolioHistory.length > maxHistory) {
      this.portfolioHistory = this.portfolioHistory.slice(-maxHistory);
    }
    
    if (this.returnHistory.length > maxHistory) {
      this.returnHistory = this.returnHistory.slice(-maxHistory);
    }
    
    // Trim market history
    for (const [symbol, data] of this.marketHistory) {
      if (data.length > maxHistory) {
        this.marketHistory.set(symbol, data.slice(-maxHistory));
      }
    }
  }

  /**
   * Get current risk assessment
   */
  getCurrentRisk(): RiskAssessment | null {
    return this.currentRisk;
  }

  /**
   * Get risk configuration
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Check if analyzer is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset analyzer state
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.portfolioHistory = [];
    this.marketHistory.clear();
    this.returnHistory = [];
    this.drawdownHistory = [];
    this.correlationMatrix.clear();
    this.volatilities.clear();
    this.currentRisk = null;
    this.riskAlerts = [];
  }
}

export default RiskAnalyzer;