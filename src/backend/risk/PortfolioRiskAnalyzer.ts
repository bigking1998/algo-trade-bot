/**
 * Portfolio Risk Analyzer - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Portfolio-level risk analysis including:
 * - Portfolio VaR calculations
 * - Concentration risk analysis
 * - Correlation risk assessment
 * - Drawdown analysis
 * - Stress testing and Monte Carlo simulation
 */

import type {
  PortfolioState,
  PortfolioRiskAssessment,
  Position,
  ConcentrationRisk,
  CorrelationRisk,
  CorrelationMatrix,
  StressScenario,
  StressTestResults,
  MonteCarloResults,
  DrawdownAnalysis,
  RiskContribution,
  VaRResult,
  RiskLevel,
  LiquidityRiskSummary,
  OperationalRiskSummary,
  RiskAlert,
  RiskLimitBreach
} from './types.js';
import type { Trade } from '../types/database.js';
import type { DydxCandle } from '../../shared/types/trading.js';
import { VaRCalculator } from './VaRCalculator.js';
import { PositionRiskCalculator } from './PositionRiskCalculator.js';

export class PortfolioRiskAnalyzer {
  private static instance: PortfolioRiskAnalyzer;
  private varCalculator: VaRCalculator;
  private positionRiskCalculator: PositionRiskCalculator;
  
  private constructor() {
    this.varCalculator = VaRCalculator.getInstance();
    this.positionRiskCalculator = PositionRiskCalculator.getInstance();
  }
  
  public static getInstance(): PortfolioRiskAnalyzer {
    if (!PortfolioRiskAnalyzer.instance) {
      PortfolioRiskAnalyzer.instance = new PortfolioRiskAnalyzer();
    }
    return PortfolioRiskAnalyzer.instance;
  }

  /**
   * Analyze comprehensive portfolio risk
   */
  async analyzePortfolioRisk(
    portfolioState: PortfolioState,
    marketData: Record<string, DydxCandle[]>,
    historicalTrades: Trade[]
  ): Promise<PortfolioRiskAssessment> {
    // Calculate VaR metrics at multiple confidence levels
    const dailyVaR95 = await this.calculatePortfolioVaR(portfolioState.positions, 0.95, 1, marketData);
    const dailyVaR99 = await this.calculatePortfolioVaR(portfolioState.positions, 0.99, 1, marketData);
    const weeklyVaR95 = await this.calculatePortfolioVaR(portfolioState.positions, 0.95, 7, marketData);
    const weeklyVaR99 = await this.calculatePortfolioVaR(portfolioState.positions, 0.99, 7, marketData);
    const monthlyVaR95 = await this.calculatePortfolioVaR(portfolioState.positions, 0.95, 30, marketData);
    
    // Calculate Expected Shortfall (CVaR)
    const expectedShortfall95 = await this.calculatePortfolioExpectedShortfall(portfolioState.positions, 0.95, marketData);
    const expectedShortfall99 = await this.calculatePortfolioExpectedShortfall(portfolioState.positions, 0.99, marketData);
    
    // Calculate risk-adjusted returns
    const { sharpeRatio, sortinoRatio, calmarRatio } = await this.calculateRiskAdjustedReturns(
      portfolioState, 
      historicalTrades
    );
    
    // Calculate market risk measures
    const { beta, alpha, correlation } = await this.calculateMarketRiskMeasures(
      portfolioState.positions, 
      marketData
    );
    
    // Calculate portfolio volatility
    const volatility = await this.calculatePortfolioVolatility(portfolioState.positions, marketData);
    
    // Analyze drawdown
    const drawdownAnalysis = await this.analyzeDrawdown(historicalTrades);
    
    // Analyze concentration risk
    const concentrationRisk = await this.analyzeConcentrationRisk(portfolioState.positions);
    
    // Analyze correlation risk
    const correlationRisk = await this.analyzeCorrelationRisk(portfolioState.positions, marketData);
    
    // Assess liquidity risk
    const liquidityRisk = await this.assessPortfolioLiquidityRisk(portfolioState.positions, marketData);
    
    // Assess operational risk
    const operationalRisk = await this.assessOperationalRisk(portfolioState);
    
    // Calculate risk contributions
    const riskContribution = await this.calculateRiskContributions(portfolioState.positions, marketData);
    
    // Run stress tests
    const stressTestResults = await this.runStressTests(portfolioState.positions, marketData);
    
    // Calculate overall risk score and level
    const overallRiskScore = this.calculateOverallRiskScore({
      dailyVaR95,
      concentrationRisk,
      correlationRisk,
      liquidityRisk,
      volatility,
      drawdown: drawdownAnalysis.currentDrawdown
    });
    
    const riskLevel = this.determineRiskLevel(overallRiskScore);
    
    // Generate risk alerts and limit breaches
    const { riskAlerts, riskLimitBreaches } = await this.generateRiskAlertsAndBreaches(
      portfolioState,
      {
        dailyVaR95,
        concentrationRisk,
        correlationRisk,
        liquidityRisk,
        overallRiskScore
      }
    );
    
    // Determine risk trend
    const riskTrend = await this.calculateRiskTrend(portfolioState);

    return {
      timestamp: new Date(),
      portfolioValue: portfolioState.totalValue,
      dailyVaR95,
      dailyVaR99,
      weeklyVaR95,
      weeklyVaR99,
      monthlyVaR95,
      expectedShortfall95,
      expectedShortfall99,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown: drawdownAnalysis.maxDrawdown,
      currentDrawdown: drawdownAnalysis.currentDrawdown,
      beta,
      alpha,
      correlation,
      volatility,
      concentrationRisk,
      correlationRisk,
      liquidityRisk,
      operationalRisk,
      riskContribution,
      stressTestResults,
      overallRiskScore,
      riskLevel,
      riskAlerts,
      riskLimitBreaches,
      riskTrend,
      riskVolatility: await this.calculateRiskVolatility(portfolioState)
    };
  }

  /**
   * Calculate Portfolio VaR
   */
  async calculatePortfolioVaR(
    positions: Position[],
    confidence: number,
    horizon: number,
    marketData: Record<string, DydxCandle[]>
  ): Promise<number> {
    if (positions.length === 0) return 0;
    
    // If single position, calculate directly
    if (positions.length === 1) {
      const position = positions[0];
      const candles = marketData[position.symbol] || [];
      return await this.positionRiskCalculator.calculatePositionVaR(position, confidence, candles) * Math.sqrt(horizon);
    }
    
    // For multiple positions, consider correlations
    return await this.calculateCorrelatedPortfolioVaR(positions, confidence, horizon, marketData);
  }

  /**
   * Calculate Portfolio Expected Shortfall
   */
  async calculatePortfolioExpectedShortfall(
    positions: Position[],
    confidence: number,
    marketData: Record<string, DydxCandle[]>
  ): Promise<number> {
    if (positions.length === 0) return 0;
    
    // Simplified calculation - in practice would use full correlation matrix
    let totalExpectedShortfall = 0;
    
    for (const position of positions) {
      const candles = marketData[position.symbol] || [];
      if (candles.length > 0) {
        const returns = this.calculateReturnsFromCandles(candles);
        const positionES = await this.varCalculator.expectedShortfall(returns, confidence);
        totalExpectedShortfall += positionES * position.marketValue;
      }
    }
    
    // Apply diversification benefit (simplified)
    const diversificationBenefit = await this.calculateDiversificationBenefit(positions, marketData);
    return totalExpectedShortfall * (1 - diversificationBenefit);
  }

  /**
   * Analyze concentration risk
   */
  async analyzeConcentrationRisk(positions: Position[]): Promise<ConcentrationRisk> {
    if (positions.length === 0) {
      return this.getEmptyConcentrationRisk();
    }
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    // Calculate position concentrations
    const positionConcentrations = positions.map(pos => ({
      symbol: pos.symbol,
      percentage: (pos.marketValue / totalValue) * 100,
      value: pos.marketValue
    })).sort((a, b) => b.percentage - a.percentage);
    
    const maxPositionPercent = positionConcentrations[0]?.percentage || 0;
    const concentrationThreshold = 10; // 10% threshold
    const positionsAboveThreshold = positionConcentrations.filter(
      pos => pos.percentage > concentrationThreshold
    ).length;
    
    // Calculate asset concentration (group by asset/symbol)
    const assetConcentration = positionConcentrations.map(pos => ({
      asset: pos.symbol,
      percentage: pos.percentage,
      riskScore: this.calculateAssetConcentrationRisk(pos.percentage)
    }));
    
    // Calculate temporal concentration (positions opened at similar times)
    const temporalConcentration = await this.analyzeTemporalConcentration(positions);
    
    // Calculate Herfindahl Index for overall concentration
    const herfindahlIndex = positionConcentrations.reduce(
      (sum, pos) => sum + Math.pow(pos.percentage / 100, 2), 0
    );
    
    // Calculate effective number of positions
    const effectivePositions = herfindahlIndex > 0 ? 1 / herfindahlIndex : 0;
    
    // Overall concentration risk score
    const concentrationRiskScore = this.calculateConcentrationRiskScore(
      maxPositionPercent,
      positionsAboveThreshold,
      herfindahlIndex
    );

    return {
      timestamp: new Date(),
      maxPositionPercent,
      positionsAboveThreshold,
      assetConcentration,
      temporalConcentration,
      herfindahlIndex,
      effectivePositions,
      concentrationRiskScore
    };
  }

  /**
   * Analyze correlation risk
   */
  async analyzeCorrelationRisk(
    positions: Position[],
    marketData: Record<string, DydxCandle[]>
  ): Promise<CorrelationRisk> {
    if (positions.length < 2) {
      return this.getEmptyCorrelationRisk();
    }
    
    // Build correlation matrix
    const correlationMatrix = await this.buildCorrelationMatrix(positions, marketData);
    
    // Identify clusters of highly correlated positions
    const clusters = await this.identifyCorrelationClusters(positions, correlationMatrix);
    
    // Calculate systemic risk indicators
    const systemicRisk = await this.calculateSystemicRiskIndicators(positions, marketData);
    
    // Calculate diversification metrics
    const diversificationRatio = await this.calculateDiversificationRatio(positions, correlationMatrix);
    const effectiveBets = await this.calculateEffectiveBets(positions, correlationMatrix);
    const diversificationBenefit = await this.calculateDiversificationBenefit(positions, marketData);
    
    // Overall correlation risk score
    const correlationRiskScore = this.calculateCorrelationRiskScore(
      correlationMatrix.averageCorrelation,
      clusters,
      systemicRisk.correlationToMarket
    );

    return {
      timestamp: new Date(),
      correlationMatrix,
      averageCorrelation: correlationMatrix.averageCorrelation,
      maxCorrelation: correlationMatrix.maxCorrelation,
      clusters,
      systemicRisk,
      diversificationRatio,
      effectiveBets,
      diversificationBenefit,
      correlationRiskScore
    };
  }

  /**
   * Assess portfolio liquidity risk
   */
  async assessPortfolioLiquidityRisk(
    positions: Position[],
    marketData: Record<string, DydxCandle[]>
  ): Promise<LiquidityRiskSummary> {
    if (positions.length === 0) {
      return this.getEmptyLiquidityRisk();
    }
    
    const liquidityAssessments: Array<{
      symbol: string;
      percentage: number;
      liquidityScore: number;
      estimatedLiquidationTime: number;
      marketImpact: number;
    }> = [];
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    for (const position of positions) {
      const candles = marketData[position.symbol] || [];
      const liquidityRisk = await this.positionRiskCalculator.assessLiquidityRisk(position, candles);
      
      liquidityAssessments.push({
        symbol: position.symbol,
        percentage: (position.marketValue / totalValue) * 100,
        liquidityScore: liquidityRisk.liquidityScore,
        estimatedLiquidationTime: liquidityRisk.estimatedLiquidationTime,
        marketImpact: liquidityRisk.marketImpact
      });
    }
    
    // Calculate portfolio-level metrics
    const averageLiquidity = liquidityAssessments.reduce(
      (sum, assessment) => sum + assessment.liquidityScore * (assessment.percentage / 100), 0
    );
    
    const liquidityScore = averageLiquidity;
    
    // Calculate time to liquidate percentages
    const sortedByLiquidity = [...liquidityAssessments].sort((a, b) => b.liquidityScore - a.liquidityScore);
    
    let timeToLiquidate10Percent = 0;
    let timeToLiquidate50Percent = 0;
    let timeToLiquidateAll = 0;
    let cumulativePercentage = 0;
    
    for (const assessment of sortedByLiquidity) {
      cumulativePercentage += assessment.percentage;
      timeToLiquidateAll = Math.max(timeToLiquidateAll, assessment.estimatedLiquidationTime);
      
      if (cumulativePercentage >= 10 && timeToLiquidate10Percent === 0) {
        timeToLiquidate10Percent = assessment.estimatedLiquidationTime;
      }
      if (cumulativePercentage >= 50 && timeToLiquidate50Percent === 0) {
        timeToLiquidate50Percent = assessment.estimatedLiquidationTime;
      }
    }
    
    // Identify illiquid positions (liquidity score < 30)
    const illiquidPositions = liquidityAssessments
      .filter(assessment => assessment.liquidityScore < 30)
      .map(assessment => ({
        symbol: assessment.symbol,
        percentage: assessment.percentage,
        estimatedLiquidationTime: assessment.estimatedLiquidationTime,
        marketImpact: assessment.marketImpact
      }));
    
    // Calculate portfolio-level market metrics
    const averageMarketDepth = liquidityAssessments.reduce(
      (sum, assessment) => sum + assessment.liquidityScore * 1000, 0 // Proxy calculation
    ) / liquidityAssessments.length;
    
    const estimatedMarketImpact = liquidityAssessments.reduce(
      (sum, assessment) => sum + assessment.marketImpact * (assessment.percentage / 100), 0
    );
    
    const liquidityRiskScore = 100 - averageLiquidity; // Invert score

    return {
      timestamp: new Date(),
      averageLiquidity,
      liquidityScore,
      timeToLiquidate10Percent,
      timeToLiquidate50Percent,
      timeToLiquidateAll,
      illiquidPositions,
      averageMarketDepth,
      estimatedMarketImpact,
      liquidityRiskScore
    };
  }

  /**
   * Run stress tests on portfolio
   */
  async runStressTests(
    positions: Position[],
    marketData: Record<string, DydxCandle[]>
  ): Promise<StressTestResults> {
    // Define stress test scenarios
    const scenarios: StressScenario[] = [
      {
        name: 'Market Crash',
        description: '20% market-wide decline',
        shocks: positions.map(pos => ({ asset: pos.symbol, priceShock: -0.20 }))
      },
      {
        name: 'Volatility Spike',
        description: '3x volatility increase',
        shocks: positions.map(pos => ({ asset: pos.symbol, priceShock: -0.10, volatilityMultiplier: 3 }))
      },
      {
        name: 'Liquidity Crisis',
        description: 'Severe liquidity reduction',
        shocks: positions.map(pos => ({ asset: pos.symbol, priceShock: -0.15 })),
        liquidityShock: 0.5
      },
      {
        name: 'Sector Rotation',
        description: 'Major sector rotation',
        shocks: positions.map(pos => ({ asset: pos.symbol, priceShock: -0.08 })),
        correlationShock: 0.3
      }
    ];
    
    const scenarioResults = [];
    let maxLoss = 0;
    let totalLoss = 0;
    
    for (const scenario of scenarios) {
      const result = await this.runSingleStressTest(positions, scenario);
      scenarioResults.push({
        scenario,
        portfolioImpact: result.portfolioImpact,
        portfolioImpactPercent: result.portfolioImpactPercent,
        worstPosition: result.worstPosition,
        breachedLimits: result.breachedLimits
      });
      
      maxLoss = Math.max(maxLoss, Math.abs(result.portfolioImpact));
      totalLoss += Math.abs(result.portfolioImpact);
    }
    
    const averageLoss = totalLoss / scenarios.length;
    const maxLossPercent = (maxLoss / positions.reduce((sum, pos) => sum + pos.marketValue, 0)) * 100;
    
    // Calculate tail risk measures
    const losses = scenarioResults.map(result => Math.abs(result.portfolioImpact)).sort((a, b) => b - a);
    const tail1Percent = losses[0] || 0;
    const tail5Percent = losses[Math.min(Math.floor(losses.length * 0.05), losses.length - 1)] || 0;

    return {
      scenarios: scenarioResults,
      maxLoss,
      maxLossPercent,
      averageLoss,
      tail1Percent,
      tail5Percent,
      calculatedAt: new Date()
    };
  }

  /**
   * Run Monte Carlo simulation for portfolio risk
   */
  async runMonteCarloSimulation(
    positions: Position[],
    confidence: number,
    horizon: number,
    iterations: number = 10000
  ): Promise<MonteCarloResults> {
    return await this.varCalculator.monteCarloVaR(positions, confidence, horizon, iterations) as MonteCarloResults;
  }

  /**
   * Calculate risk contributions for all positions
   */
  async calculateRiskContributions(
    positions: Position[],
    marketData: Record<string, DydxCandle[]>
  ): Promise<RiskContribution[]> {
    if (positions.length === 0) return [];
    
    const componentVaRResults = await this.varCalculator.componentVaR(positions);
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    return positions.map((position, index) => {
      const componentResult = componentVaRResults.find(result => result.symbol === position.symbol);
      const portfolioPercent = (position.marketValue / totalValue) * 100;
      
      return {
        symbol: position.symbol,
        positionValue: position.marketValue,
        portfolioPercent,
        marginalVaR: componentResult?.marginalVaR || 0,
        componentVaR: componentResult?.componentVaR || 0,
        riskContributionPercent: componentResult?.contributionPercent || 0,
        volatilityContribution: portfolioPercent * 0.5, // Simplified
        correlationContribution: portfolioPercent * 0.3,
        concentrationContribution: portfolioPercent * 0.2,
        riskAdjustedReturn: this.calculateRiskAdjustedReturn(position),
        sharpeContribution: this.calculateSharpeContribution(position),
        riskRank: index + 1 // Will be properly ranked later
      };
    }).sort((a, b) => b.riskContributionPercent - a.riskContributionPercent)
      .map((contribution, index) => ({ ...contribution, riskRank: index + 1 }));
  }

  /**
   * Helper methods for complex calculations
   */
  private async calculateCorrelatedPortfolioVaR(
    positions: Position[],
    confidence: number,
    horizon: number,
    marketData: Record<string, DydxCandle[]>
  ): Promise<number> {
    // Build correlation matrix
    const correlationMatrix = await this.buildCorrelationMatrix(positions, marketData);
    
    // Calculate individual position VaRs
    const positionVaRs: number[] = [];
    for (const position of positions) {
      const candles = marketData[position.symbol] || [];
      const positionVaR = await this.positionRiskCalculator.calculatePositionVaR(position, confidence, candles);
      positionVaRs.push(positionVaR);
    }
    
    // Apply correlation matrix to calculate portfolio VaR
    // Simplified: Portfolio VaR = sqrt(sum(wi²σi² + 2*sum(wi*wj*σi*σj*ρij)))
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    let portfolioVariance = 0;
    
    for (let i = 0; i < positions.length; i++) {
      const weight_i = positions[i].marketValue / totalValue;
      const var_i = positionVaRs[i];
      
      // Add individual variance terms
      portfolioVariance += Math.pow(weight_i * var_i, 2);
      
      // Add covariance terms
      for (let j = i + 1; j < positions.length; j++) {
        const weight_j = positions[j].marketValue / totalValue;
        const var_j = positionVaRs[j];
        const correlation = this.getCorrelationFromMatrix(correlationMatrix, i, j);
        
        portfolioVariance += 2 * weight_i * weight_j * var_i * var_j * correlation;
      }
    }
    
    return Math.sqrt(portfolioVariance) * Math.sqrt(horizon);
  }

  private async buildCorrelationMatrix(
    positions: Position[],
    marketData: Record<string, DydxCandle[]>
  ): Promise<CorrelationMatrix> {
    const symbols = positions.map(pos => pos.symbol);
    const n = symbols.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Build correlation matrix
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const returns1 = this.calculateReturnsFromCandles(marketData[symbols[i]] || []);
          const returns2 = this.calculateReturnsFromCandles(marketData[symbols[j]] || []);
          matrix[i][j] = this.calculateCorrelation(returns1, returns2);
        }
      }
    }
    
    // Calculate statistics
    const correlations = matrix.flat().filter(corr => corr !== 1);
    const avgCorrelation = correlations.length > 0 
      ? correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length 
      : 0;
    const minCorrelation = correlations.length > 0 ? Math.min(...correlations) : 0;
    const maxCorrelation = correlations.length > 0 ? Math.max(...correlations) : 0;
    
    return {
      symbols,
      matrix,
      averageCorrelation: avgCorrelation,
      minCorrelation,
      maxCorrelation,
      eigenvalues: this.calculateEigenvalues(matrix),
      calculatedAt: new Date(),
      period: 252 // Assume 1 year of data
    };
  }

  private calculateReturnsFromCandles(candles: DydxCandle[]): number[] {
    if (candles.length < 2) return [];
    
    const returns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const currentPrice = candles[i].close;
      const previousPrice = candles[i - 1].close;
      const return_ = (currentPrice - previousPrice) / previousPrice;
      returns.push(return_);
    }
    
    return returns;
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
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

  private async analyzeDrawdown(trades: Trade[]): Promise<DrawdownAnalysis> {
    if (trades.length === 0) {
      return {
        currentDrawdown: 0,
        maxDrawdown: 0,
        maxDrawdownDate: new Date(),
        averageDrawdown: 0,
        drawdownFrequency: 0,
        averageRecoveryTime: 0,
        maxRecoveryTime: 0,
        isInDrawdown: false,
        ulcerIndex: 0,
        painIndex: 0,
        calmarRatio: 0
      };
    }
    
    // Calculate running P&L
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    let runningPnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let maxDrawdownDate = new Date();
    let currentDrawdown = 0;
    let drawdowns: Array<{ start: Date; end?: Date; depth: number; duration?: number }> = [];
    let inDrawdown = false;
    let drawdownStart: Date | null = null;
    
    for (const trade of sortedTrades) {
      runningPnL += trade.pnl;
      
      // Update peak
      if (runningPnL > peak) {
        peak = runningPnL;
        
        // End current drawdown if we're in one
        if (inDrawdown && drawdownStart) {
          const currentDD = drawdowns[drawdowns.length - 1];
          if (currentDD) {
            currentDD.end = new Date(trade.time);
            currentDD.duration = currentDD.end.getTime() - currentDD.start.getTime();
          }
          inDrawdown = false;
          drawdownStart = null;
        }
      }
      
      // Calculate current drawdown
      const drawdown = peak - runningPnL;
      
      if (drawdown > 0) {
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStart = new Date(trade.time);
          drawdowns.push({ start: drawdownStart, depth: drawdown });
        } else {
          // Update current drawdown depth
          const currentDD = drawdowns[drawdowns.length - 1];
          if (currentDD) {
            currentDD.depth = drawdown;
          }
        }
        
        // Update max drawdown
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownDate = new Date(trade.time);
        }
        
        currentDrawdown = drawdown;
      }
    }
    
    // Calculate statistics
    const completedDrawdowns = drawdowns.filter(dd => dd.end && dd.duration);
    const averageDrawdown = completedDrawdowns.length > 0
      ? completedDrawdowns.reduce((sum, dd) => sum + dd.depth, 0) / completedDrawdowns.length
      : 0;
    
    const recoveryTimes = completedDrawdowns
      .map(dd => dd.duration || 0)
      .filter(duration => duration > 0);
    
    const averageRecoveryTime = recoveryTimes.length > 0
      ? recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;
    
    const maxRecoveryTime = recoveryTimes.length > 0
      ? Math.max(...recoveryTimes) / (1000 * 60 * 60 * 24) // Convert to days
      : 0;
    
    const drawdownFrequency = completedDrawdowns.length / (sortedTrades.length / 252); // Drawdowns per year
    
    // Calculate Ulcer Index and Pain Index
    const ulcerIndex = this.calculateUlcerIndex(drawdowns);
    const painIndex = this.calculatePainIndex(drawdowns);
    
    // Calculate Calmar Ratio (annualized return / max drawdown)
    const totalReturn = runningPnL;
    const annualizedReturn = totalReturn * (252 / sortedTrades.length); // Rough annualization
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    
    return {
      currentDrawdown,
      maxDrawdown,
      maxDrawdownDate,
      averageDrawdown,
      drawdownFrequency,
      averageRecoveryTime,
      maxRecoveryTime,
      drawdownStart,
      drawdownDuration: inDrawdown && drawdownStart 
        ? Date.now() - drawdownStart.getTime() 
        : undefined,
      isInDrawdown: inDrawdown,
      ulcerIndex,
      painIndex,
      calmarRatio
    };
  }

  /**
   * Additional helper methods
   */
  private getCorrelationFromMatrix(matrix: CorrelationMatrix, i: number, j: number): number {
    if (i < 0 || j < 0 || i >= matrix.matrix.length || j >= matrix.matrix[0].length) {
      return 0;
    }
    return matrix.matrix[i][j];
  }

  private calculateEigenvalues(matrix: number[][]): number[] {
    // Simplified eigenvalue calculation
    const n = matrix.length;
    const eigenvalues: number[] = [];
    
    for (let i = 0; i < n; i++) {
      eigenvalues.push(1 / n); // Rough approximation
    }
    
    return eigenvalues;
  }

  private calculateUlcerIndex(drawdowns: Array<{ depth: number; duration?: number }>): number {
    if (drawdowns.length === 0) return 0;
    
    const sumSquaredDrawdowns = drawdowns.reduce((sum, dd) => sum + Math.pow(dd.depth, 2), 0);
    return Math.sqrt(sumSquaredDrawdowns / drawdowns.length);
  }

  private calculatePainIndex(drawdowns: Array<{ depth: number; duration?: number }>): number {
    if (drawdowns.length === 0) return 0;
    
    const totalPain = drawdowns.reduce((sum, dd) => {
      const duration = (dd.duration || 0) / (1000 * 60 * 60 * 24); // Days
      return sum + (dd.depth * duration);
    }, 0);
    
    return totalPain / drawdowns.length;
  }

  // ... (Additional helper methods would continue here)
  
  private getEmptyConcentrationRisk(): ConcentrationRisk {
    return {
      timestamp: new Date(),
      maxPositionPercent: 0,
      positionsAboveThreshold: 0,
      assetConcentration: [],
      temporalConcentration: {
        clusteredPositionsPercent: 0,
        averageTimeSpread: 0,
        riskScore: 0
      },
      herfindahlIndex: 0,
      effectivePositions: 0,
      concentrationRiskScore: 0
    };
  }

  private getEmptyCorrelationRisk(): CorrelationRisk {
    return {
      timestamp: new Date(),
      correlationMatrix: {
        symbols: [],
        matrix: [],
        averageCorrelation: 0,
        minCorrelation: 0,
        maxCorrelation: 0,
        eigenvalues: [],
        calculatedAt: new Date(),
        period: 0
      },
      averageCorrelation: 0,
      maxCorrelation: 0,
      clusters: [],
      systemicRisk: {
        marketBeta: 0,
        correlationToMarket: 0,
        tailCorrelation: 0,
        contagionRisk: 0
      },
      diversificationRatio: 0,
      effectiveBets: 0,
      diversificationBenefit: 0,
      correlationRiskScore: 0
    };
  }

  private getEmptyLiquidityRisk(): LiquidityRiskSummary {
    return {
      timestamp: new Date(),
      averageLiquidity: 0,
      liquidityScore: 0,
      timeToLiquidate10Percent: 0,
      timeToLiquidate50Percent: 0,
      timeToLiquidateAll: 0,
      illiquidPositions: [],
      averageMarketDepth: 0,
      estimatedMarketImpact: 0,
      liquidityRiskScore: 0
    };
  }

  // Placeholder implementations for remaining methods
  private calculateOverallRiskScore(riskFactors: any): number {
    // Implement comprehensive risk scoring logic
    return 50; // Placeholder
  }

  private determineRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 90) return 'critical';
    if (riskScore >= 75) return 'very_high';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    if (riskScore >= 20) return 'low';
    return 'very_low';
  }

  private async generateRiskAlertsAndBreaches(portfolioState: PortfolioState, riskMetrics: any): Promise<{
    riskAlerts: RiskAlert[];
    riskLimitBreaches: RiskLimitBreach[];
  }> {
    return {
      riskAlerts: [],
      riskLimitBreaches: []
    };
  }

  // ... Additional placeholder methods would be implemented here
}