/**
 * Risk Management Module Entry Point - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Main entry point for the comprehensive risk management system.
 * Exports all risk assessment components and provides a unified API.
 */

// Main Risk Engine
export { RiskEngine } from './RiskEngine.js';

// Core Risk Assessment Components
export { VaRCalculator } from './VaRCalculator.js';
export { PositionRiskCalculator } from './PositionRiskCalculator.js';
export { PortfolioRiskAnalyzer } from './PortfolioRiskAnalyzer.js';
export { RiskMonitor } from './RiskMonitor.js';

// Type Definitions
export type {
  // Core Types
  RiskLevel,
  PortfolioState,
  Position,
  ProposedTrade,
  RiskProfile,
  RiskEngineConfig,
  
  // Assessment Results
  PortfolioRiskAssessment,
  PositionRiskAssessment,
  TradeRiskAssessment,
  RiskValidationResult,
  PositionSizeRecommendation,
  
  // Risk Metrics
  VaRResult,
  MonteCarloResults,
  ConcentrationRisk,
  CorrelationRisk,
  CorrelationMatrix,
  LiquidityRiskSummary,
  LiquidityRiskMetrics,
  PriceRiskMetrics,
  MarketRiskMetrics,
  OperationalRiskSummary,
  DrawdownAnalysis,
  
  // Risk Controls
  RiskLimits,
  RiskLimitStatus,
  RiskLimitBreach,
  CircuitBreaker,
  CircuitBreakerStatus,
  
  // Stress Testing
  StressScenario,
  StressTestResults,
  
  // Risk Monitoring
  RiskAlert,
  RiskTrend,
  RiskContribution,
  
  // Advanced Risk Types
  Greeks,
  ComponentVaRResult,
  CorrelationImpact,
  TimingRiskAssessment
} from './types.js';

/**
 * Risk Management Factory
 * Provides convenient access to all risk management components
 */
export class RiskManagement {
  private static riskEngine: RiskEngine | null = null;
  
  /**
   * Get the singleton Risk Engine instance
   */
  static getRiskEngine(): RiskEngine {
    if (!this.riskEngine) {
      this.riskEngine = RiskEngine.getInstance();
    }
    return this.riskEngine;
  }
  
  /**
   * Initialize the risk management system
   */
  static async initialize(config?: Partial<import('./types.js').RiskEngineConfig>): Promise<void> {
    const riskEngine = this.getRiskEngine();
    await riskEngine.initialize(config);
  }
  
  /**
   * Shutdown the risk management system
   */
  static async shutdown(): Promise<void> {
    if (this.riskEngine) {
      await this.riskEngine.shutdown();
      this.riskEngine = null;
    }
  }
  
  /**
   * Quick portfolio risk assessment
   */
  static async assessPortfolio(portfolioState: import('./types.js').PortfolioState) {
    const riskEngine = this.getRiskEngine();
    return await riskEngine.assessPortfolioRisk(portfolioState);
  }
  
  /**
   * Quick trade validation
   */
  static async validateTrade(trade: import('./types.js').ProposedTrade) {
    const riskEngine = this.getRiskEngine();
    return await riskEngine.validateTrade(trade);
  }
  
  /**
   * Quick position size calculation
   */
  static async calculatePositionSize(
    signal: import('../strategies/types.js').StrategySignal,
    riskProfile: import('./types.js').RiskProfile
  ) {
    const riskEngine = this.getRiskEngine();
    return await riskEngine.calculateOptimalPositionSize(signal, riskProfile);
  }
}

/**
 * Risk Utility Functions
 */
export class RiskUtils {
  /**
   * Convert risk score to risk level
   */
  static riskScoreToLevel(score: number): RiskLevel {
    if (score >= 90) return 'critical';
    if (score >= 75) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'very_low';
  }
  
  /**
   * Calculate simple volatility from returns
   */
  static calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  }
  
  /**
   * Calculate correlation between two return series
   */
  static calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) {
      return 0;
    }
    
    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length;
    
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;
    
    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  /**
   * Calculate Sharpe ratio
   */
  static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const excessReturn = mean - riskFreeRate;
    const volatility = this.calculateVolatility(returns);
    
    return volatility === 0 ? 0 : excessReturn / volatility;
  }
  
  /**
   * Calculate maximum drawdown from equity curve
   */
  static calculateMaxDrawdown(equityCurve: number[]): { maxDrawdown: number; maxDrawdownDate: number } {
    if (equityCurve.length === 0) return { maxDrawdown: 0, maxDrawdownDate: 0 };
    
    let peak = equityCurve[0];
    let maxDrawdown = 0;
    let maxDrawdownDate = 0;
    
    for (let i = 1; i < equityCurve.length; i++) {
      if (equityCurve[i] > peak) {
        peak = equityCurve[i];
      } else {
        const drawdown = (peak - equityCurve[i]) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownDate = i;
        }
      }
    }
    
    return { maxDrawdown, maxDrawdownDate };
  }
  
  /**
   * Calculate Value at Risk using historical method
   */
  static calculateHistoricalVaR(returns: number[], confidence: number = 0.95): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const percentile = 1 - confidence;
    const index = Math.ceil(percentile * sortedReturns.length) - 1;
    
    return Math.abs(sortedReturns[Math.max(0, index)]);
  }
  
  /**
   * Check if portfolio exceeds concentration limits
   */
  static checkConcentrationLimits(
    positions: Array<{ symbol: string; marketValue: number }>,
    maxConcentration: number = 0.2 // 20% default
  ): { symbol: string; concentration: number; exceeds: boolean }[] {
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    return positions.map(position => {
      const concentration = position.marketValue / totalValue;
      return {
        symbol: position.symbol,
        concentration,
        exceeds: concentration > maxConcentration
      };
    });
  }
  
  /**
   * Generate risk score from multiple factors
   */
  static calculateCompositeRiskScore(factors: { name: string; score: number; weight: number }[]): number {
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    
    if (totalWeight === 0) return 0;
    
    const weightedScore = factors.reduce((sum, factor) => {
      return sum + (factor.score * factor.weight);
    }, 0);
    
    return Math.min(100, Math.max(0, weightedScore / totalWeight));
  }
}

/**
 * Default Risk Profiles
 */
export const DEFAULT_RISK_PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Low risk tolerance with capital preservation focus',
    riskTolerance: 'conservative' as const,
    maxDrawdown: 5, // 5%
    maxLeverage: 1, // No leverage
    maxConcentration: 10, // 10% per position
    defaultPositionSize: 5, // 5%
    maxPositionSize: 10, // 10%
    kellyMultiplier: 0.5,
    targetReturn: 8, // 8% annual
    maxVolatility: 12, // 12% annual
    minSharpeRatio: 1.0,
    investmentHorizon: 365, // 1 year
    rebalanceFrequency: 30, // Monthly
    allowedAssets: ['BTC', 'ETH', 'BNB'],
    forbiddenAssets: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  MODERATE: {
    name: 'Moderate',
    description: 'Balanced risk-return approach',
    riskTolerance: 'moderate' as const,
    maxDrawdown: 10, // 10%
    maxLeverage: 2, // 2x leverage
    maxConcentration: 15, // 15% per position
    defaultPositionSize: 8, // 8%
    maxPositionSize: 15, // 15%
    kellyMultiplier: 0.75,
    targetReturn: 15, // 15% annual
    maxVolatility: 20, // 20% annual
    minSharpeRatio: 0.75,
    investmentHorizon: 180, // 6 months
    rebalanceFrequency: 14, // Bi-weekly
    allowedAssets: [],
    forbiddenAssets: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'High risk tolerance seeking maximum returns',
    riskTolerance: 'aggressive' as const,
    maxDrawdown: 20, // 20%
    maxLeverage: 5, // 5x leverage
    maxConcentration: 25, // 25% per position
    defaultPositionSize: 12, // 12%
    maxPositionSize: 25, // 25%
    kellyMultiplier: 1.0,
    targetReturn: 30, // 30% annual
    maxVolatility: 35, // 35% annual
    minSharpeRatio: 0.5,
    investmentHorizon: 90, // 3 months
    rebalanceFrequency: 7, // Weekly
    allowedAssets: [],
    forbiddenAssets: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
} as const;

// Export individual component instances for direct access
export const riskEngine = RiskEngine.getInstance();
export const varCalculator = VaRCalculator.getInstance();
export const positionRiskCalculator = PositionRiskCalculator.getInstance();
export const portfolioRiskAnalyzer = PortfolioRiskAnalyzer.getInstance();
export const riskMonitor = RiskMonitor.getInstance();