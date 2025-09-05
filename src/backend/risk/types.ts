/**
 * Risk Assessment Types - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Comprehensive type definitions for the risk management system including
 * portfolio risk assessment, position risk analysis, VaR calculations, and risk controls.
 */

import type { Position, PortfolioSnapshot, Trade } from '../types/database.js';
import type { StrategySignal } from '../strategies/types.js';

/**
 * Core Risk Assessment Types
 */
export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'critical';

export interface PortfolioState {
  timestamp: Date;
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  unrealizedPnL: number;
  realizedPnL: number;
  availableMargin: number;
  usedMargin: number;
  marginRatio: number;
  leverage: number;
  
  // Additional context
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  
  // Market exposure
  longExposure: number;
  shortExposure: number;
  netExposure: number;
  grossExposure: number;
  
  // Concentration metrics
  largestPositionPercent: number;
  topConcentrations: Array<{
    symbol: string;
    percentage: number;
    value: number;
  }>;
}

/**
 * Portfolio Risk Assessment
 */
export interface PortfolioRiskAssessment {
  timestamp: Date;
  portfolioValue: number;
  
  // VaR metrics with multiple confidence levels
  dailyVaR95: number;
  dailyVaR99: number;
  weeklyVaR95: number;
  weeklyVaR99: number;
  monthlyVaR95: number;
  expectedShortfall95: number; // CVaR
  expectedShortfall99: number;
  
  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  
  // Market risk measures
  beta: number;
  alpha: number;
  correlation: number;
  volatility: number; // Annualized
  
  // Concentration and correlation risk
  concentrationRisk: ConcentrationRisk;
  correlationRisk: CorrelationRisk;
  
  // Liquidity and operational risk
  liquidityRisk: LiquidityRiskSummary;
  operationalRisk: OperationalRiskSummary;
  
  // Risk contribution analysis
  riskContribution: RiskContribution[];
  
  // Stress testing results
  stressTestResults?: StressTestResults;
  
  // Risk scoring
  overallRiskScore: number; // 0-100
  riskLevel: RiskLevel;
  
  // Alerts and warnings
  riskAlerts: RiskAlert[];
  riskLimitBreaches: RiskLimitBreach[];
  
  // Historical context
  riskTrend: 'increasing' | 'decreasing' | 'stable';
  riskVolatility: number; // Volatility of risk metrics
}

/**
 * Position Risk Assessment
 */
export interface PositionRiskAssessment {
  positionId: string;
  symbol: string;
  timestamp: Date;
  
  // Basic position metrics
  marketValue: number;
  portfolioPercentage: number;
  leverage: number;
  
  // VaR and risk metrics
  positionVaR95: number;
  positionVaR99: number;
  expectedShortfall: number;
  
  // Greeks (for derivatives)
  greeks?: Greeks;
  
  // Liquidity assessment
  liquidityRisk: LiquidityRiskMetrics;
  
  // Price risk
  priceRisk: PriceRiskMetrics;
  
  // Risk contribution to portfolio
  marginalVaR: number;
  componentVaR: number;
  riskContributionPercent: number;
  
  // Position-specific risk score
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  
  // Risk alerts
  alerts: string[];
  recommendations: string[];
}

/**
 * Trade Risk Assessment for Pre-Trade Analysis
 */
export interface TradeRiskAssessment {
  signalId: string;
  symbol: string;
  timestamp: Date;
  
  // Overall risk scoring
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  
  // Portfolio impact analysis
  portfolioImpact: number; // Percentage of portfolio
  marginRequirement: number;
  leverageImpact: number;
  concentrationImpact: number;
  
  // Price and market risk
  priceRisk: PriceRiskMetrics;
  marketRisk: MarketRiskMetrics;
  
  // Liquidity considerations
  liquidityRisk: LiquidityRiskMetrics;
  
  // Correlation and concentration impact
  correlationImpact: CorrelationImpact;
  concentrationIncrease: number;
  
  // Position sizing recommendations
  recommendedSize: number;
  maxRecommendedSize: number;
  minRecommendedSize: number;
  
  // Risk-adjusted sizing
  kellyRecommendation: number;
  volatilityAdjustedSize: number;
  
  // Warnings and constraints
  warnings: string[];
  constraints: string[];
  wouldBreachLimits: boolean;
  limitBreaches: string[];
  
  // Trade timing risk
  timingRisk: TimingRiskAssessment;
}

/**
 * Concentration Risk Analysis
 */
export interface ConcentrationRisk {
  timestamp: Date;
  
  // Single position concentration
  maxPositionPercent: number;
  positionsAboveThreshold: number; // Count of positions above concentration limit
  
  // Asset concentration
  assetConcentration: Array<{
    asset: string;
    percentage: number;
    riskScore: number;
  }>;
  
  // Sector/industry concentration (if applicable)
  sectorConcentration?: Array<{
    sector: string;
    percentage: number;
    positionCount: number;
    riskScore: number;
  }>;
  
  // Geographic concentration
  geographicConcentration?: Array<{
    region: string;
    percentage: number;
    riskScore: number;
  }>;
  
  // Time concentration (positions opened at similar times)
  temporalConcentration: {
    clusteredPositionsPercent: number;
    averageTimeSpread: number; // hours
    riskScore: number;
  };
  
  // Overall concentration metrics
  herfindahlIndex: number; // Portfolio concentration index
  effectivePositions: number; // Equivalent number of equally-weighted positions
  concentrationRiskScore: number; // 0-100
}

/**
 * Correlation Risk Analysis
 */
export interface CorrelationRisk {
  timestamp: Date;
  
  // Pairwise correlations
  correlationMatrix: CorrelationMatrix;
  averageCorrelation: number;
  maxCorrelation: number;
  
  // Cluster analysis
  clusters: Array<{
    assets: string[];
    avgCorrelation: number;
    totalExposure: number;
    riskScore: number;
  }>;
  
  // Systemic risk indicators
  systemicRisk: {
    marketBeta: number;
    correlationToMarket: number;
    tailCorrelation: number; // Correlation during extreme events
    contagionRisk: number;
  };
  
  // Diversification metrics
  diversificationRatio: number;
  effectiveBets: number;
  diversificationBenefit: number;
  
  correlationRiskScore: number; // 0-100
}

/**
 * Liquidity Risk Assessment
 */
export interface LiquidityRiskSummary {
  timestamp: Date;
  
  // Portfolio liquidity metrics
  averageLiquidity: number;
  liquidityScore: number; // 0-100 (higher is more liquid)
  
  // Time to liquidate estimates
  timeToLiquidate10Percent: number; // hours
  timeToLiquidate50Percent: number;
  timeToLiquidateAll: number;
  
  // Illiquid positions
  illiquidPositions: Array<{
    symbol: string;
    percentage: number;
    estimatedLiquidationTime: number;
    marketImpact: number;
  }>;
  
  // Market depth and impact
  averageMarketDepth: number;
  estimatedMarketImpact: number;
  
  liquidityRiskScore: number; // 0-100
}

export interface LiquidityRiskMetrics {
  symbol: string;
  
  // Market structure
  averageDailyVolume: number;
  bidAskSpread: number;
  marketDepth: number;
  
  // Liquidation estimates
  estimatedLiquidationTime: number; // hours
  marketImpact: number; // Estimated price impact %
  
  // Liquidity scoring
  liquidityScore: number; // 0-100
  liquidityRating: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Price Risk Metrics
 */
export interface PriceRiskMetrics {
  symbol: string;
  
  // Volatility measures
  historicalVolatility: number; // Annualized
  impliedVolatility?: number; // If available
  garchVolatility: number;
  
  // Price movement risk
  averageTrueRange: number;
  priceGapRisk: number; // Risk of price gaps
  
  // Tail risk
  skewness: number;
  kurtosis: number;
  tailRisk: number; // Probability of extreme moves
  
  // Support/resistance levels
  supportLevels: number[];
  resistanceLevels: number[];
  technicalRiskScore: number;
  
  priceRiskScore: number; // 0-100
}

/**
 * Market Risk Metrics
 */
export interface MarketRiskMetrics {
  timestamp: Date;
  
  // Market conditions
  marketVolatility: number;
  marketTrend: 'bull' | 'bear' | 'sideways';
  volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  
  // Systemic risk indicators
  vixLevel?: number; // If available
  marketBreadth: number;
  sectorRotation: number;
  
  // Economic environment
  interestRateRisk: number;
  inflationRisk: number;
  currencyRisk: number;
  
  // Market microstructure
  orderFlowImbalance: number;
  marketLiquidity: number;
  
  marketRiskScore: number; // 0-100
}

/**
 * Greeks for Derivatives
 */
export interface Greeks {
  delta: number; // Price sensitivity
  gamma: number; // Delta sensitivity
  theta: number; // Time decay
  vega: number; // Volatility sensitivity
  rho: number; // Interest rate sensitivity
  
  // Second-order Greeks
  charm: number; // Delta decay over time
  vanna: number; // Vega sensitivity to spot
  volga: number; // Vega sensitivity to volatility
}

/**
 * VaR Calculation Results
 */
export interface VaRResult {
  method: 'historical' | 'parametric' | 'monte_carlo';
  confidence: number; // 0.95, 0.99, etc.
  horizon: number; // Days
  value: number;
  
  // Additional metrics
  expectedShortfall: number; // CVaR
  worstCase: number;
  bestCase: number;
  
  // Method-specific details
  details: {
    observationsUsed?: number;
    simulationsRun?: number;
    modelParameters?: Record<string, number>;
    convergence?: boolean;
  };
  
  calculatedAt: Date;
}

/**
 * Monte Carlo Simulation Results
 */
export interface MonteCarloResults {
  iterations: number;
  confidence: number;
  horizon: number;
  
  // Results
  var95: number;
  var99: number;
  expectedShortfall95: number;
  expectedShortfall99: number;
  
  // Distribution statistics
  mean: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  
  // Percentiles
  percentiles: Record<number, number>; // e.g., {1: -0.05, 5: -0.03, ...}
  
  // Convergence metrics
  converged: boolean;
  convergenceIteration?: number;
  
  calculatedAt: Date;
}

/**
 * Stress Testing
 */
export interface StressScenario {
  name: string;
  description: string;
  shocks: Array<{
    asset: string;
    priceShock: number; // Percentage change
    volatilityMultiplier?: number;
  }>;
  correlationShock?: number; // Increase in correlations
  liquidityShock?: number; // Reduction in liquidity
}

export interface StressTestResults {
  scenarios: Array<{
    scenario: StressScenario;
    portfolioImpact: number; // Dollar impact
    portfolioImpactPercent: number;
    worstPosition: {
      symbol: string;
      impact: number;
      impactPercent: number;
    };
    breachedLimits: string[];
  }>;
  
  // Aggregate stress metrics
  maxLoss: number;
  maxLossPercent: number;
  averageLoss: number;
  
  // Tail risk measures
  tail1Percent: number; // 1% worst case
  tail5Percent: number; // 5% worst case
  
  calculatedAt: Date;
}

/**
 * Risk Contribution Analysis
 */
export interface RiskContribution {
  symbol: string;
  positionValue: number;
  portfolioPercent: number;
  
  // VaR contribution
  marginalVaR: number; // Change in portfolio VaR from small position change
  componentVaR: number; // Position's contribution to portfolio VaR
  riskContributionPercent: number; // Percent of total portfolio risk
  
  // Other risk contributions
  volatilityContribution: number;
  correlationContribution: number;
  concentrationContribution: number;
  
  // Risk-adjusted metrics
  riskAdjustedReturn: number;
  sharpeContribution: number;
  
  // Ranking
  riskRank: number; // 1 = highest risk contributor
}

/**
 * Component VaR Results
 */
export interface ComponentVaRResult {
  symbol: string;
  componentVaR: number;
  marginalVaR: number;
  contributionPercent: number;
  
  // Decomposition
  idiosyncraticRisk: number; // Asset-specific risk
  systematicRisk: number; // Market risk
  
  // Risk attribution
  priceRiskComponent: number;
  volatilityRiskComponent: number;
  correlationRiskComponent: number;
}

/**
 * Correlation Matrix
 */
export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // Correlation coefficients
  
  // Matrix properties
  averageCorrelation: number;
  minCorrelation: number;
  maxCorrelation: number;
  eigenvalues: number[];
  
  calculatedAt: Date;
  period: number; // Days of data used
}

/**
 * Correlation Impact Assessment
 */
export interface CorrelationImpact {
  // Existing correlations with portfolio
  highlyCorrelatedPositions: Array<{
    symbol: string;
    correlation: number;
    combinedExposure: number;
  }>;
  
  // Impact of adding new position
  averageCorrelationIncrease: number;
  maxCorrelationIncrease: number;
  diversificationImpact: number; // Positive = improves diversification
  
  // Cluster risk
  wouldJoinCluster: boolean;
  clusterExposure?: number;
  clusterRiskIncrease?: number;
}

/**
 * Timing Risk Assessment
 */
export interface TimingRiskAssessment {
  // Market timing factors
  marketCondition: 'favorable' | 'neutral' | 'unfavorable';
  volatilityTiming: 'low_vol' | 'normal_vol' | 'high_vol';
  trendAlignment: 'with_trend' | 'against_trend' | 'no_trend';
  
  // Session and time factors
  tradingSession: 'asian' | 'european' | 'american' | 'overlap';
  liquidityLevel: 'low' | 'medium' | 'high';
  
  // News and event risk
  upcomingEvents: Array<{
    event: string;
    impact: 'low' | 'medium' | 'high';
    timeUntil: number; // hours
  }>;
  
  // Overall timing score
  timingScore: number; // 0-100 (higher is better timing)
  recommendation: 'proceed' | 'wait' | 'avoid';
}

/**
 * Operational Risk Summary
 */
export interface OperationalRiskSummary {
  timestamp: Date;
  
  // System and technology risk
  systemUptime: number;
  latencyRisk: number;
  dataQualityRisk: number;
  
  // Execution risk
  slippageRisk: number;
  partialFillRisk: number;
  orderRejectionRisk: number;
  
  // Model and algorithm risk
  modelRisk: number;
  parameterDrift: number;
  backtestOverfitting: number;
  
  operationalRiskScore: number; // 0-100
}

/**
 * Drawdown Analysis
 */
export interface DrawdownAnalysis {
  currentDrawdown: number;
  maxDrawdown: number;
  maxDrawdownDate: Date;
  
  // Drawdown characteristics
  averageDrawdown: number;
  drawdownFrequency: number; // Drawdowns per year
  averageRecoveryTime: number; // Days
  maxRecoveryTime: number;
  
  // Current drawdown details
  drawdownStart?: Date;
  drawdownDuration?: number; // Days
  isInDrawdown: boolean;
  
  // Risk metrics
  ulcerIndex: number; // Downside deviation measure
  painIndex: number; // Severity-duration measure
  calmarRatio: number; // Return/Max Drawdown
}

/**
 * Risk Limits and Controls
 */
export interface RiskLimits {
  // Portfolio-level limits
  maxPortfolioVaR: number; // Dollar amount
  maxPortfolioVaRPercent: number; // Percentage of portfolio
  maxDrawdown: number; // Percentage
  maxLeverage: number; // Ratio
  maxGrossExposure: number; // Dollar amount
  maxNetExposure: number; // Dollar amount
  
  // Position-level limits
  maxPositionSize: number; // Percentage of portfolio
  maxPositionVaR: number; // Dollar amount
  maxConcentration: number; // Percentage in single asset
  
  // Sector and geographic limits
  maxSectorExposure?: number; // Percentage per sector
  maxGeographicExposure?: number; // Percentage per region
  maxCurrencyExposure?: number; // Percentage per currency
  
  // Correlation and diversification limits
  maxCorrelation: number; // Maximum pairwise correlation
  maxClusterRisk: number; // Maximum correlated cluster exposure
  minDiversificationRatio: number; // Minimum diversification
  
  // Liquidity limits
  minLiquidityBuffer: number; // Percentage in liquid assets
  maxIlliquidPositions: number; // Percentage in illiquid positions
  maxTimeToLiquidate: number; // Hours
  
  // Operational limits
  maxDailyTrades: number;
  maxHourlyTrades: number;
  maxOrderSize: number;
  
  // Stop-loss and risk controls
  portfolioStopLoss: number; // Percentage loss limit
  dailyLossLimit: number; // Daily loss limit
  monthlyLossLimit: number; // Monthly loss limit
}

/**
 * Risk Limit Status and Monitoring
 */
export interface RiskLimitStatus {
  timestamp: Date;
  
  // Limit utilization
  limits: Array<{
    name: string;
    limit: number;
    current: number;
    utilization: number; // Percentage of limit used
    status: 'safe' | 'warning' | 'breach' | 'critical';
    timeToLimit?: number; // Estimated hours until limit reached
  }>;
  
  // Overall status
  overallStatus: 'healthy' | 'warning' | 'breach' | 'critical';
  breachedLimits: string[];
  warningLimits: string[];
  
  // Recommendations
  recommendations: string[];
  requiredActions: string[];
}

export interface RiskLimitBreach {
  limitName: string;
  limitValue: number;
  currentValue: number;
  breachAmount: number;
  breachPercent: number;
  severity: 'minor' | 'major' | 'critical';
  timestamp: Date;
  duration?: number; // Milliseconds since breach started
  resolved: boolean;
  
  // Context
  affectedPositions: string[];
  recommendedActions: string[];
}

/**
 * Circuit Breakers
 */
export interface CircuitBreaker {
  name: string;
  description: string;
  threshold: number;
  thresholdType: 'absolute' | 'percentage' | 'ratio';
  metric: string; // What metric to monitor
  
  // Actions
  action: 'pause_trading' | 'reduce_positions' | 'liquidate_positions' | 'alert_only';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Configuration
  enabled: boolean;
  cooldownPeriod: number; // Minutes before can trigger again
  maxTriggersPerDay: number;
  
  // State
  isTriggered: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  nextCooldownExpiry?: Date;
}

export interface CircuitBreakerStatus {
  timestamp: Date;
  
  breakers: Array<{
    breaker: CircuitBreaker;
    currentValue: number;
    distanceToTrigger: number;
    status: 'safe' | 'warning' | 'triggered';
  }>;
  
  // Overall status
  anyTriggered: boolean;
  activeBreakers: string[];
  tradingPaused: boolean;
  
  // Recent activity
  recentTriggers: Array<{
    breakerName: string;
    triggeredAt: Date;
    reason: string;
    actionTaken: string;
    resolved: boolean;
  }>;
}

/**
 * Risk Alerts and Notifications
 */
export interface RiskAlert {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'critical' | 'emergency';
  category: 'limit_breach' | 'concentration' | 'correlation' | 'liquidity' | 'market' | 'operational';
  
  title: string;
  message: string;
  details: Record<string, unknown>;
  
  // Context
  affectedSymbols: string[];
  affectedStrategies: string[];
  
  // Actions
  recommendedActions: string[];
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  
  // Lifecycle
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  autoResolved: boolean;
}

/**
 * Risk Trend Analysis
 */
export interface RiskTrend {
  metric: string;
  values: Array<{
    timestamp: Date;
    value: number;
  }>;
  
  // Trend analysis
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number; // 0-1
  volatility: number;
  
  // Statistical measures
  mean: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
  
  // Forecasting
  shortTermForecast: number; // Next period prediction
  confidence: number; // Forecast confidence 0-1
  
  calculatedAt: Date;
}

/**
 * Position Size Recommendation
 */
export interface PositionSizeRecommendation {
  symbol: string;
  signal: StrategySignal;
  
  // Size recommendations by method
  recommendations: {
    fixed: number;
    kelly: number;
    volatilityAdjusted: number;
    riskParity: number;
    maxSharpe: number;
  };
  
  // Final recommendation
  recommendedSize: number;
  recommendationReason: string;
  
  // Constraints and limits
  maxAllowedSize: number;
  minRecommendedSize: number;
  constraintReasons: string[];
  
  // Risk metrics for recommended size
  estimatedVaR: number;
  estimatedDrawdown: number;
  portfolioImpact: number;
  
  // Confidence and validation
  confidence: number; // 0-1
  warnings: string[];
}

/**
 * Risk Validation Result
 */
export interface RiskValidationResult {
  isValid: boolean;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  
  // Validation checks
  checks: Array<{
    name: string;
    passed: boolean;
    severity: 'info' | 'warning' | 'error';
    message: string;
    value?: number;
    threshold?: number;
  }>;
  
  // Overall assessment
  recommendation: 'approve' | 'approve_with_conditions' | 'reject' | 'defer';
  conditions?: string[];
  rejectionReasons?: string[];
  
  // Risk mitigation suggestions
  mitigationSuggestions: string[];
  alternativeApproaches: string[];
  
  validatedAt: Date;
}

/**
 * Risk Profile Configuration
 */
export interface RiskProfile {
  name: string;
  description: string;
  
  // Risk tolerance
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'speculative';
  
  // Portfolio limits
  maxDrawdown: number;
  maxLeverage: number;
  maxConcentration: number;
  
  // Position sizing parameters
  defaultPositionSize: number; // Percentage
  maxPositionSize: number;
  kellyMultiplier: number; // Multiplier for Kelly criterion
  
  // Risk-return targets
  targetReturn: number; // Annualized
  maxVolatility: number; // Annualized
  minSharpeRatio: number;
  
  // Time horizons
  investmentHorizon: number; // Days
  rebalanceFrequency: number; // Days
  
  // Constraints
  allowedAssets: string[];
  forbiddenAssets: string[];
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Proposed Trade for Risk Assessment
 */
export interface ProposedTrade {
  id: string;
  strategyId: string;
  signal: StrategySignal;
  
  // Trade details
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  quantity: number;
  estimatedPrice: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  maxSlippage: number;
  
  // Context
  currentPortfolio: PortfolioState;
  marketConditions: {
    volatility: number;
    liquidity: number;
    trend: string;
  };
  
  // Metadata
  proposedAt: Date;
  timeHorizon?: number; // Expected holding period in hours
  confidence: number; // Signal confidence 0-1
}

/**
 * Risk Engine Configuration
 */
export interface RiskEngineConfig {
  // Calculation parameters
  varConfidenceLevels: number[]; // e.g., [0.95, 0.99]
  varHorizons: number[]; // Days, e.g., [1, 7, 30]
  historicalDataPeriod: number; // Days of historical data to use
  monteCarloIterations: number;
  
  // Update frequencies
  portfolioAssessmentInterval: number; // Seconds
  positionAssessmentInterval: number; // Seconds
  varCalculationInterval: number; // Seconds
  
  // Risk limits and thresholds
  defaultRiskLimits: RiskLimits;
  alertThresholds: {
    warningLevel: number; // Risk score threshold for warnings
    criticalLevel: number; // Risk score threshold for critical alerts
    emergencyLevel: number; // Risk score threshold for emergency actions
  };
  
  // Performance and optimization
  enableCaching: boolean;
  cacheTimeout: number; // Seconds
  maxConcurrentCalculations: number;
  
  // Features
  enableStressTesting: boolean;
  enableMonteCarloVaR: boolean;
  enableCorrelationAnalysis: boolean;
  enableLiquidityRisk: boolean;
}