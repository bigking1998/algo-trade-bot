/**
 * VaR Calculator - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Comprehensive Value at Risk calculation engine supporting multiple methodologies:
 * - Historical VaR
 * - Parametric VaR (Variance-Covariance)
 * - Monte Carlo VaR
 * - Expected Shortfall (CVaR)
 * - Component and Marginal VaR
 */

import type { 
  VaRResult, 
  MonteCarloResults, 
  ComponentVaRResult,
  CorrelationMatrix,
  Position 
} from './types.js';
import type { DydxCandle } from '../../shared/types/trading.js';

export class VaRCalculator {
  private static instance: VaRCalculator;
  
  public static getInstance(): VaRCalculator {
    if (!VaRCalculator.instance) {
      VaRCalculator.instance = new VaRCalculator();
    }
    return VaRCalculator.instance;
  }

  /**
   * Calculate Historical Value at Risk
   * Uses empirical distribution of historical returns
   */
  async historicalVaR(
    returns: number[], 
    confidence: number = 0.95,
    horizon: number = 1
  ): Promise<VaRResult> {
    if (returns.length === 0) {
      throw new Error('No returns data provided for VaR calculation');
    }

    if (confidence <= 0 || confidence >= 1) {
      throw new Error('Confidence level must be between 0 and 1');
    }

    // Sort returns in ascending order (worst to best)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    
    // Calculate percentile for VaR
    const percentile = 1 - confidence;
    const index = Math.ceil(percentile * sortedReturns.length) - 1;
    const historicalVaR = Math.abs(sortedReturns[Math.max(0, index)]);
    
    // Scale for time horizon (square root of time rule)
    const scaledVaR = historicalVaR * Math.sqrt(horizon);
    
    // Calculate Expected Shortfall (CVaR) - average of returns beyond VaR
    const tailReturns = sortedReturns.slice(0, index + 1);
    const expectedShortfall = tailReturns.length > 0 
      ? Math.abs(tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length)
      : scaledVaR;

    return {
      method: 'historical',
      confidence,
      horizon,
      value: scaledVaR,
      expectedShortfall: expectedShortfall * Math.sqrt(horizon),
      worstCase: Math.abs(sortedReturns[0]) * Math.sqrt(horizon),
      bestCase: Math.abs(sortedReturns[sortedReturns.length - 1]) * Math.sqrt(horizon),
      details: {
        observationsUsed: returns.length,
        convergence: true
      },
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate Parametric VaR using Variance-Covariance method
   * Assumes normal distribution of returns
   */
  async parametricVaR(
    returns: number[],
    confidence: number = 0.95,
    horizon: number = 1
  ): Promise<VaRResult> {
    if (returns.length < 2) {
      throw new Error('Insufficient data for parametric VaR calculation');
    }

    // Calculate mean and standard deviation
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    const standardDeviation = Math.sqrt(variance);
    
    // Get Z-score for confidence level (assuming normal distribution)
    const zScore = this.getZScore(confidence);
    
    // Calculate VaR: μ + z * σ (negative because we want loss)
    const parametricVaR = Math.abs(mean - zScore * standardDeviation);
    
    // Scale for time horizon
    const scaledVaR = parametricVaR * Math.sqrt(horizon);
    
    // Calculate Expected Shortfall for normal distribution
    const phi = this.standardNormalPDF(-zScore);
    const expectedShortfall = standardDeviation * phi / (1 - confidence);
    
    return {
      method: 'parametric',
      confidence,
      horizon,
      value: scaledVaR,
      expectedShortfall: expectedShortfall * Math.sqrt(horizon),
      worstCase: Math.abs(mean - 3 * standardDeviation) * Math.sqrt(horizon), // 3-sigma event
      bestCase: Math.abs(mean + 3 * standardDeviation) * Math.sqrt(horizon),
      details: {
        observationsUsed: returns.length,
        modelParameters: {
          mean,
          standardDeviation,
          variance,
          zScore
        },
        convergence: true
      },
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate VaR using Monte Carlo simulation
   */
  async monteCarloVaR(
    positions: Position[],
    confidence: number = 0.95,
    horizon: number = 1,
    iterations: number = 10000
  ): Promise<VaRResult> {
    if (positions.length === 0) {
      throw new Error('No positions provided for Monte Carlo VaR');
    }

    const results = await this.runMonteCarloSimulation(positions, confidence, horizon, iterations);
    
    return {
      method: 'monte_carlo',
      confidence,
      horizon,
      value: results.var95,
      expectedShortfall: results.expectedShortfall95,
      worstCase: results.percentiles[1] || results.var99,
      bestCase: results.percentiles[99] || results.mean + 2 * results.standardDeviation,
      details: {
        simulationsRun: iterations,
        convergence: results.converged,
        modelParameters: {
          mean: results.mean,
          standardDeviation: results.standardDeviation,
          skewness: results.skewness,
          kurtosis: results.kurtosis
        }
      },
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate Expected Shortfall (Conditional VaR)
   */
  async expectedShortfall(
    returns: number[],
    confidence: number = 0.95,
    method: 'historical' | 'parametric' = 'historical'
  ): Promise<number> {
    if (method === 'historical') {
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const percentile = 1 - confidence;
      const cutoffIndex = Math.ceil(percentile * sortedReturns.length) - 1;
      const tailReturns = sortedReturns.slice(0, cutoffIndex + 1);
      
      return tailReturns.length > 0 
        ? Math.abs(tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length)
        : 0;
    } else {
      // Parametric Expected Shortfall
      const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
      const standardDeviation = Math.sqrt(variance);
      
      const zScore = this.getZScore(confidence);
      const phi = this.standardNormalPDF(-zScore);
      
      return standardDeviation * phi / (1 - confidence);
    }
  }

  /**
   * Calculate Marginal VaR - change in portfolio VaR from small change in position
   */
  async marginalVaR(
    portfolio: Position[],
    targetPosition: Position,
    confidence: number = 0.95,
    deltaPercent: number = 0.01
  ): Promise<number> {
    // Calculate current portfolio VaR
    const currentVaR = await this.calculatePortfolioVaR(portfolio, confidence);
    
    // Create modified portfolio with small increase in target position
    const modifiedPortfolio = portfolio.map(pos => 
      pos.id === targetPosition.id 
        ? { ...pos, size: pos.size * (1 + deltaPercent) }
        : pos
    );
    
    // Calculate VaR with modified position
    const modifiedVaR = await this.calculatePortfolioVaR(modifiedPortfolio, confidence);
    
    // Marginal VaR = change in VaR / change in position size
    return (modifiedVaR - currentVaR) / (targetPosition.marketValue * deltaPercent);
  }

  /**
   * Calculate Component VaR for all positions in portfolio
   */
  async componentVaR(portfolio: Position[]): Promise<ComponentVaRResult[]> {
    if (portfolio.length === 0) {
      return [];
    }

    const results: ComponentVaRResult[] = [];
    
    // Calculate portfolio VaR
    const portfolioVaR = await this.calculatePortfolioVaR(portfolio, 0.95);
    
    for (const position of portfolio) {
      // Calculate marginal VaR for this position
      const marginalVaRValue = await this.marginalVaR(portfolio, position, 0.95);
      
      // Component VaR = Marginal VaR × Position Weight
      const positionWeight = position.marketValue / this.getTotalPortfolioValue(portfolio);
      const componentVaRValue = marginalVaRValue * positionWeight;
      const contributionPercent = (componentVaRValue / portfolioVaR) * 100;
      
      // Decompose into systematic and idiosyncratic risk
      const { systematicRisk, idiosyncraticRisk } = await this.decomposeRisk(position, portfolio);
      
      results.push({
        symbol: position.symbol,
        componentVaR: componentVaRValue,
        marginalVaR: marginalVaRValue,
        contributionPercent,
        idiosyncraticRisk,
        systematicRisk,
        priceRiskComponent: componentVaRValue * 0.7, // Rough estimation
        volatilityRiskComponent: componentVaRValue * 0.2,
        correlationRiskComponent: componentVaRValue * 0.1
      });
    }
    
    return results;
  }

  /**
   * Run Monte Carlo simulation for portfolio
   */
  private async runMonteCarloSimulation(
    positions: Position[],
    confidence: number,
    horizon: number,
    iterations: number
  ): Promise<MonteCarloResults> {
    const portfolioReturns: number[] = [];
    
    // Get historical data for all positions (simplified - in reality would fetch from database)
    const historicalReturns = await this.getHistoricalReturnsMatrix(positions);
    
    // Calculate correlation matrix
    const correlationMatrix = this.calculateCorrelationMatrix(historicalReturns);
    
    for (let i = 0; i < iterations; i++) {
      // Generate correlated random returns for each position
      const simulatedReturns = this.generateCorrelatedReturns(
        positions.map(p => p.symbol),
        correlationMatrix,
        historicalReturns
      );
      
      // Calculate portfolio return for this simulation
      let portfolioReturn = 0;
      let totalValue = this.getTotalPortfolioValue(positions);
      
      positions.forEach((position, index) => {
        const weight = position.marketValue / totalValue;
        portfolioReturn += weight * simulatedReturns[index];
      });
      
      portfolioReturns.push(portfolioReturn);
    }
    
    // Sort results and calculate statistics
    const sortedReturns = portfolioReturns.sort((a, b) => a - b);
    
    // Calculate VaR at different confidence levels
    const var95Index = Math.floor((1 - 0.95) * iterations);
    const var99Index = Math.floor((1 - 0.99) * iterations);
    
    const var95 = Math.abs(sortedReturns[var95Index]) * Math.sqrt(horizon);
    const var99 = Math.abs(sortedReturns[var99Index]) * Math.sqrt(horizon);
    
    // Calculate Expected Shortfall
    const tailReturns95 = sortedReturns.slice(0, var95Index + 1);
    const tailReturns99 = sortedReturns.slice(0, var99Index + 1);
    
    const expectedShortfall95 = Math.abs(
      tailReturns95.reduce((sum, ret) => sum + ret, 0) / tailReturns95.length
    ) * Math.sqrt(horizon);
    
    const expectedShortfall99 = Math.abs(
      tailReturns99.reduce((sum, ret) => sum + ret, 0) / tailReturns99.length
    ) * Math.sqrt(horizon);
    
    // Calculate distribution statistics
    const mean = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / iterations;
    const variance = portfolioReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / iterations;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate skewness and kurtosis
    const skewness = this.calculateSkewness(portfolioReturns, mean, standardDeviation);
    const kurtosis = this.calculateKurtosis(portfolioReturns, mean, standardDeviation);
    
    // Calculate percentiles
    const percentiles: Record<number, number> = {};
    [1, 5, 10, 25, 50, 75, 90, 95, 99].forEach(p => {
      const index = Math.floor((p / 100) * iterations);
      percentiles[p] = sortedReturns[index] * Math.sqrt(horizon);
    });
    
    return {
      iterations,
      confidence,
      horizon,
      var95,
      var99,
      expectedShortfall95,
      expectedShortfall99,
      mean: mean * Math.sqrt(horizon),
      standardDeviation: standardDeviation * Math.sqrt(horizon),
      skewness,
      kurtosis,
      percentiles,
      converged: this.checkConvergence(portfolioReturns, iterations),
      convergenceIteration: iterations,
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate portfolio VaR (simplified version for component calculations)
   */
  private async calculatePortfolioVaR(positions: Position[], confidence: number): Promise<number> {
    // This is a simplified calculation for demonstration
    // In practice, this would use the full VaR calculation methodology
    const portfolioValue = this.getTotalPortfolioValue(positions);
    const averageVolatility = 0.02; // 2% daily volatility assumption
    const zScore = this.getZScore(confidence);
    
    return portfolioValue * averageVolatility * zScore;
  }

  /**
   * Get total portfolio market value
   */
  private getTotalPortfolioValue(positions: Position[]): number {
    return positions.reduce((total, position) => total + position.marketValue, 0);
  }

  /**
   * Decompose risk into systematic and idiosyncratic components
   */
  private async decomposeRisk(position: Position, portfolio: Position[]): Promise<{
    systematicRisk: number;
    idiosyncraticRisk: number;
  }> {
    // Simplified risk decomposition
    // In practice, this would use factor models (CAPM, Fama-French, etc.)
    const totalRisk = position.marketValue * 0.02; // Assume 2% volatility
    const systematicRisk = totalRisk * 0.6; // 60% systematic
    const idiosyncraticRisk = totalRisk * 0.4; // 40% idiosyncratic
    
    return { systematicRisk, idiosyncraticRisk };
  }

  /**
   * Get historical returns matrix for positions (placeholder)
   */
  private async getHistoricalReturnsMatrix(positions: Position[]): Promise<Record<string, number[]>> {
    // Placeholder - in reality would fetch from database
    const returns: Record<string, number[]> = {};
    
    positions.forEach(position => {
      // Generate sample returns for demonstration
      returns[position.symbol] = Array.from({ length: 252 }, () => 
        (Math.random() - 0.5) * 0.04 // Random returns between -2% and +2%
      );
    });
    
    return returns;
  }

  /**
   * Calculate correlation matrix from historical returns
   */
  private calculateCorrelationMatrix(returns: Record<string, number[]>): CorrelationMatrix {
    const symbols = Object.keys(returns);
    const n = symbols.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.calculateCorrelation(returns[symbols[i]], returns[symbols[j]]);
        }
      }
    }
    
    // Calculate matrix statistics
    const correlations = matrix.flat().filter(corr => corr !== 1);
    const avgCorrelation = correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length;
    const minCorrelation = Math.min(...correlations);
    const maxCorrelation = Math.max(...correlations);
    
    return {
      symbols,
      matrix,
      averageCorrelation: avgCorrelation,
      minCorrelation,
      maxCorrelation,
      eigenvalues: this.calculateEigenvalues(matrix), // Simplified
      calculatedAt: new Date(),
      period: 252 // Assume 1 year of daily data
    };
  }

  /**
   * Calculate correlation between two return series
   */
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

  /**
   * Generate correlated random returns using Cholesky decomposition
   */
  private generateCorrelatedReturns(
    symbols: string[],
    correlationMatrix: CorrelationMatrix,
    historicalReturns: Record<string, number[]>
  ): number[] {
    const n = symbols.length;
    const independentReturns = Array(n).fill(0).map(() => this.generateRandomNormal(0, 1));
    
    // Apply Cholesky decomposition to generate correlated returns
    // Simplified version - in practice would use proper Cholesky decomposition
    const correlatedReturns: number[] = [];
    
    symbols.forEach((symbol, i) => {
      const returns = historicalReturns[symbol];
      const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const std = Math.sqrt(
        returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length
      );
      
      // Generate correlated return (simplified)
      correlatedReturns.push(mean + std * independentReturns[i]);
    });
    
    return correlatedReturns;
  }

  /**
   * Generate random normal distribution value (Box-Muller transform)
   */
  private generateRandomNormal(mean: number = 0, std: number = 1): number {
    let u1 = Math.random();
    let u2 = Math.random();
    
    // Ensure u1 is not zero
    while (u1 === 0) u1 = Math.random();
    
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * std + mean;
  }

  /**
   * Calculate skewness of return distribution
   */
  private calculateSkewness(returns: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    
    const n = returns.length;
    const sum = returns.reduce((acc, ret) => acc + Math.pow((ret - mean) / std, 3), 0);
    
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  /**
   * Calculate kurtosis of return distribution
   */
  private calculateKurtosis(returns: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    
    const n = returns.length;
    const sum = returns.reduce((acc, ret) => acc + Math.pow((ret - mean) / std, 4), 0);
    
    const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum;
    const adjustment = 3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3));
    
    return kurtosis - adjustment; // Excess kurtosis
  }

  /**
   * Check convergence of Monte Carlo simulation
   */
  private checkConvergence(returns: number[], iterations: number): boolean {
    // Simple convergence check - compare first half vs second half statistics
    if (iterations < 1000) return false;
    
    const midpoint = Math.floor(iterations / 2);
    const firstHalf = returns.slice(0, midpoint);
    const secondHalf = returns.slice(midpoint);
    
    const mean1 = firstHalf.reduce((sum, ret) => sum + ret, 0) / firstHalf.length;
    const mean2 = secondHalf.reduce((sum, ret) => sum + ret, 0) / secondHalf.length;
    
    const diff = Math.abs(mean1 - mean2);
    const threshold = 0.001; // 0.1% difference threshold
    
    return diff < threshold;
  }

  /**
   * Calculate eigenvalues of correlation matrix (simplified)
   */
  private calculateEigenvalues(matrix: number[][]): number[] {
    // Simplified eigenvalue calculation
    // In practice, would use proper linear algebra library
    const n = matrix.length;
    const eigenvalues: number[] = [];
    
    // Calculate trace (sum of diagonal elements)
    const trace = matrix.reduce((sum, row, i) => sum + row[i], 0);
    
    // Rough estimation - equal eigenvalues
    for (let i = 0; i < n; i++) {
      eigenvalues.push(trace / n);
    }
    
    return eigenvalues;
  }

  /**
   * Get Z-score for given confidence level
   */
  private getZScore(confidence: number): number {
    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.28,
      0.95: 1.645,
      0.975: 1.96,
      0.99: 2.33,
      0.995: 2.58,
      0.999: 3.09
    };
    
    if (zScores[confidence]) {
      return zScores[confidence];
    }
    
    // Approximation for other confidence levels using inverse normal
    return this.inverseNormal(confidence);
  }

  /**
   * Standard normal probability density function
   */
  private standardNormalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Inverse normal distribution (approximation)
   */
  private inverseNormal(p: number): number {
    // Beasley-Springer-Moro approximation for inverse normal
    const a0 = 2.50662823884;
    const a1 = -18.61500062529;
    const a2 = 41.39119773534;
    const a3 = -25.44106049637;
    
    const b1 = -8.47351093090;
    const b2 = 23.08336743743;
    const b3 = -21.06224101826;
    const b4 = 3.13082909833;
    
    const c0 = 0.3374754822726147;
    const c1 = 0.9761690190917186;
    const c2 = 0.1607979714918209;
    const c3 = 0.0276438810333863;
    const c4 = 0.0038405729373609;
    const c5 = 0.0003951896511919;
    const c6 = 0.0000321767881768;
    const c7 = 0.0000002888167364;
    const c8 = 0.0000003960315187;
    
    const y = p - 0.5;
    
    if (Math.abs(y) < 0.42) {
      const r = y * y;
      return y * (((a3 * r + a2) * r + a1) * r + a0) / 
             ((((b4 * r + b3) * r + b2) * r + b1) * r + 1);
    }
    
    let r = p;
    if (y > 0) r = 1 - p;
    r = Math.log(-Math.log(r));
    
    const x = c0 + r * (c1 + r * (c2 + r * (c3 + r * (c4 + r * (c5 + r * (c6 + r * (c7 + r * c8)))))));
    
    return y < 0 ? -x : x;
  }
}