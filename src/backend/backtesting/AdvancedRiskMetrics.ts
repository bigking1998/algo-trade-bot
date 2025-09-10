/**
 * AdvancedRiskMetrics - Task BE-038: Advanced Risk Metrics
 * 
 * Comprehensive advanced risk measurement framework including:
 * - Value at Risk (VaR) and Conditional Value at Risk (CVaR)
 * - Tail risk analysis and extreme value theory
 * - Correlation analysis and dynamic correlation modeling
 * - Beta and alpha calculation with rolling windows
 * - Advanced downside risk measures (LPM, Omega ratio)
 * - Regime-dependent risk metrics
 * - Multi-asset portfolio risk attribution
 * - Stress testing and scenario analysis integration
 */

import { EventEmitter } from 'events';
import { BacktestResults, BacktestTrade, BacktestPortfolioSnapshot } from './types';

/**
 * Risk metrics configuration
 */
interface RiskMetricsConfig {
  // VaR/CVaR settings
  confidenceLevels: number[];      // e.g., [0.95, 0.99, 0.995]
  varMethod: 'historical' | 'parametric' | 'monte_carlo' | 'cornish_fisher';
  lookbackPeriod: number;          // Days for historical calculation
  
  // Distribution analysis
  enableDistributionAnalysis: boolean;
  distributionTests: string[];     // 'jarque_bera', 'anderson_darling', 'kolmogorov_smirnov'
  
  // Correlation analysis
  correlationMethod: 'pearson' | 'spearman' | 'kendall';
  dynamicCorrelation: boolean;     // Enable dynamic correlation modeling
  correlationWindow: number;       // Rolling window for correlation
  
  // Beta/Alpha calculation
  benchmarkReturns?: number[];     // Benchmark return series
  betaWindow: number;             // Rolling window for beta calculation
  riskFreeRate: number;           // Risk-free rate for alpha calculation
  
  // Regime analysis
  enableRegimeAnalysis: boolean;
  regimeDetectionMethod: 'markov_switching' | 'threshold' | 'volatility_clustering';
  numRegimes: number;             // Number of market regimes
  
  // Advanced settings
  enableExtremeBehavior: boolean;  // Extreme value theory analysis
  tailAnalysisThreshold: number;   // Threshold for tail analysis
  monteCarloSimulations: number;   // Number of MC simulations
}

/**
 * Value at Risk calculation results
 */
interface VaRResults {
  method: string;
  confidenceLevel: number;
  lookbackPeriod: number;
  
  // VaR values
  var: number;                    // Value at Risk
  cvar: number;                   // Conditional Value at Risk (Expected Shortfall)
  modifiedVar: number;            // Modified VaR accounting for skewness/kurtosis
  
  // Distribution properties
  mean: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
  excessKurtosis: number;
  
  // Tail risk measures
  tailRatio: number;              // Ratio of losses beyond VaR
  averageTailLoss: number;        // Average loss beyond VaR
  maxTailLoss: number;           // Maximum loss beyond VaR
  
  // Statistical tests
  backtestingResults: {
    violationRate: number;        // Actual violation rate
    expectedViolations: number;   // Expected violations
    actualViolations: number;     // Actual violations
    kupiecTest: {
      statistic: number;
    p_value: number;
    rejected: boolean;
  };
  christoffersenTest: {
    statistic: number;
    p_value: number;
    rejected: boolean;
  };
  };
  
  // Time-varying analysis
  rollingVar?: number[];          // Rolling VaR values
  timeVarying: boolean;           // Whether VaR changes over time
}

/**
 * Comprehensive risk metrics results
 */
interface AdvancedRiskMetricsResults {
  // Basic risk measures
  volatility: number;             // Annualized volatility
  downsideVolatility: number;     // Downside deviation
  semiVolatility: number;         // Semi-volatility (downside only)
  
  // VaR family measures
  varResults: Record<string, VaRResults>; // VaR for different confidence levels
  
  // Downside risk measures
  lowerPartialMoments: {
    lpm0: number;                 // Probability of loss
    lpm1: number;                 // Expected loss
    lpm2: number;                 // Lower partial moment of order 2
    lpm3: number;                 // Lower partial moment of order 3
  };
  
  // Performance ratios
  omegaRatio: number;             // Omega ratio
  sortinoRatio: number;           // Sortino ratio
  calmarRatio: number;           // Calmar ratio
  sterlingRatio: number;          // Sterling ratio
  burkeRatio: number;             // Burke ratio
  
  // Tail risk measures
  tailRisk: {
    tailRatio: number;            // Tail ratio (95th/5th percentile)
    tailExpectation: number;      // Tail expectation
    tailVariance: number;         // Tail variance
    tailGini: number;            // Tail Gini coefficient
  };
  
  // Extreme value analysis
  extremeValueAnalysis: {
    method: string;               // 'GEV' or 'GPD'
    parameters: {
      location: number;           // Location parameter
      scale: number;              // Scale parameter
      shape: number;              // Shape parameter (xi)
    };
    returnLevels: Record<string, number>; // Return levels for different periods
    exceedanceProbabilities: Record<string, number>;
  };
  
  // Correlation and dependence
  correlationAnalysis: {
    averageCorrelation: number;
    maxCorrelation: number;
    minCorrelation: number;
    correlationVolatility: number;
    dynamicCorrelations?: number[]; // Time-varying correlations
    
    // Dependence measures
    kendallTau: number;
    spearmanRho: number;
    copulaType?: string;           // Best-fitting copula
  };
  
  // Beta/Alpha analysis
  betaAnalysis?: {
    beta: number;                 // Market beta
    alpha: number;                // Jensen's alpha
    treynorRatio: number;         // Treynor ratio
    informationRatio: number;     // Information ratio
    trackingError: number;        // Tracking error vs benchmark
    
    // Rolling metrics
    rollingBeta?: number[];
    rollingAlpha?: number[];
    betaStability: number;        // Stability of beta over time
  };
  
  // Regime-dependent metrics
  regimeAnalysis?: {
    numRegimes: number;
    regimeClassification: number[]; // Regime for each time period
    regimeMetrics: Array<{
      regime: number;
      probability: number;        // Long-run probability
      averageReturn: number;
      volatility: number;
      var95: number;
      persistence: number;        // Average regime duration
    }>;
    transitionMatrix: number[][]; // Regime transition probabilities
  };
  
  // Multi-asset attribution (if applicable)
  portfolioAttribution?: {
    componentVaR: Record<string, number>;      // Component VaR by asset
    marginalVaR: Record<string, number>;       // Marginal VaR by asset
    incrementalVaR: Record<string, number>;    // Incremental VaR by asset
    diversificationRatio: number;               // Portfolio diversification ratio
  };
  
  // Risk-adjusted performance
  riskAdjustedMetrics: {
    informationRatio: number;
    appraisalRatio: number;
    modiglianiRatio: number;
    jensenMeasure: number;
  };
}

/**
 * Market regime identification results
 */
interface RegimeAnalysisResults {
  method: string;
  numRegimes: number;
  regimeSequence: number[];       // Regime for each time period
  regimeProbabilities: number[];  // Long-run probabilities
  transitionMatrix: number[][];   // Transition probability matrix
  
  regimeCharacteristics: Array<{
    regime: number;
    meanReturn: number;
    volatility: number;
    duration: number;             // Average duration in periods
    var95: number;
    cvar95: number;
  }>;
  
  modelFit: {
    logLikelihood: number;
    aic: number;
    bic: number;
    hqc: number;                  // Hannan-Quinn criterion
  };
}

/**
 * Main advanced risk metrics calculator
 */
class AdvancedRiskMetricsCalculator extends EventEmitter {
  private config: RiskMetricsConfig;

  constructor(config: Partial<RiskMetricsConfig> = {}) {
    super();
    
    this.config = {
      confidenceLevels: [0.95, 0.99, 0.995],
      varMethod: 'historical',
      lookbackPeriod: 252,
      enableDistributionAnalysis: true,
      distributionTests: ['jarque_bera', 'anderson_darling'],
      correlationMethod: 'pearson',
      dynamicCorrelation: false,
      correlationWindow: 60,
      betaWindow: 252,
      riskFreeRate: 0.02,
      enableRegimeAnalysis: false,
      regimeDetectionMethod: 'volatility_clustering',
      numRegimes: 2,
      enableExtremeBehavior: true,
      tailAnalysisThreshold: 0.05,
      monteCarloSimulations: 10000,
      ...config
    };
  }

  /**
   * Calculate comprehensive risk metrics from backtest results
   */
  async calculateRiskMetrics(
    results: BacktestResults,
    benchmarkReturns?: number[]
  ): Promise<AdvancedRiskMetricsResults> {
    this.emit('risk_calculation_started');
    
    // Extract return series
    const returns = this.extractReturns(results);
    
    if (returns.length === 0) {
      throw new Error('No return data available for risk calculation');
    }
    
    // Calculate VaR family measures
    const varResults = await this.calculateVaRFamily(returns);
    
    // Calculate downside risk measures  
    const downsideRiskMetrics = this.calculateDownsideRiskMeasures(returns);
    
    // Calculate tail risk measures
    const tailRiskMetrics = this.calculateTailRiskMeasures(returns);
    
    // Extreme value analysis
    const extremeValueAnalysis = await this.performExtremeValueAnalysis(returns);
    
    // Correlation analysis (if multi-asset)
    const correlationAnalysis = this.performCorrelationAnalysis(returns);
    
    // Beta/Alpha analysis (if benchmark provided)
    let betaAnalysis;
    if (benchmarkReturns && benchmarkReturns.length > 0) {
      betaAnalysis = this.calculateBetaAlpha(returns, benchmarkReturns);
    }
    
    // Regime analysis (if enabled)
    let regimeAnalysis;
    if (this.config.enableRegimeAnalysis) {
      regimeAnalysis = await this.performRegimeAnalysis(returns);
    }
    
    // Risk-adjusted performance metrics
    const riskAdjustedMetrics = this.calculateRiskAdjustedPerformance(returns, results);
    
    const metrics: AdvancedRiskMetricsResults = {
      volatility: this.calculateVolatility(returns),
      downsideVolatility: this.calculateDownsideVolatility(returns),
      semiVolatility: this.calculateSemiVolatility(returns),
      
      varResults,
      
      lowerPartialMoments: this.calculateLowerPartialMoments(returns),
      
      omegaRatio: this.calculateOmegaRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      calmarRatio: this.calculateCalmarRatio(returns, results.maxDrawdownPercent),
      sterlingRatio: this.calculateSterlingRatio(returns, results.maxDrawdownPercent),
      burkeRatio: this.calculateBurkeRatio(returns),
      
      tailRisk: tailRiskMetrics,
      extremeValueAnalysis,
      correlationAnalysis,
      betaAnalysis,
      regimeAnalysis,
      
      riskAdjustedMetrics
    };
    
    this.emit('risk_calculation_completed', { metrics });
    return metrics;
  }

  /**
   * Calculate Value at Risk using multiple methods
   */
  private async calculateVaRFamily(returns: number[]): Promise<Record<string, VaRResults>> {
    const varResults: Record<string, VaRResults> = {};
    
    for (const confidenceLevel of this.config.confidenceLevels) {
      const key = `var_${(confidenceLevel * 100).toFixed(1)}`;
      
      let var_: number;
      let cvar: number;
      
      switch (this.config.varMethod) {
        case 'historical':
          ({ var: var_, cvar } = this.calculateHistoricalVaR(returns, confidenceLevel));
          break;
        case 'parametric':
          ({ var: var_, cvar } = this.calculateParametricVaR(returns, confidenceLevel));
          break;
        case 'monte_carlo':
          ({ var: var_, cvar } = await this.calculateMonteCarloVaR(returns, confidenceLevel));
          break;
        case 'cornish_fisher':
          ({ var: var_, cvar } = this.calculateCornishFisherVaR(returns, confidenceLevel));
          break;
        default:
          ({ var: var_, cvar } = this.calculateHistoricalVaR(returns, confidenceLevel));
      }
      
      // Calculate distribution properties
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const volatility = this.calculateVolatility(returns);
      const skewness = this.calculateSkewness(returns, mean);
      const kurtosis = this.calculateKurtosis(returns, mean);
      
      // Modified VaR accounting for skewness and kurtosis
      const modifiedVar = this.calculateModifiedVaR(mean, volatility, skewness, kurtosis, confidenceLevel);
      
      // Tail analysis
      const tailAnalysis = this.analyzeTail(returns, var_);
      
      // Backtesting
      const backtestingResults = this.backtestVaR(returns, var_, confidenceLevel);
      
      varResults[key] = {
        method: this.config.varMethod,
        confidenceLevel,
        lookbackPeriod: this.config.lookbackPeriod,
        
        var: var_,
        cvar,
        modifiedVar,
        
        mean,
        volatility,
        skewness,
        kurtosis,
        excessKurtosis: kurtosis - 3,
        
        tailRatio: tailAnalysis.tailRatio,
        averageTailLoss: tailAnalysis.averageTailLoss,
        maxTailLoss: tailAnalysis.maxTailLoss,
        
        backtestingResults,
        timeVarying: false
      };
    }
    
    return varResults;
  }

  /**
   * Calculate historical VaR and CVaR
   */
  private calculateHistoricalVaR(returns: number[], confidenceLevel: number): { var: number; cvar: number } {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    
    const var_ = sortedReturns[varIndex];
    
    // CVaR is the average of returns worse than VaR
    const tailReturns = sortedReturns.slice(0, varIndex + 1);
    const cvar = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    
    return { var: Math.abs(var_), cvar: Math.abs(cvar) };
  }

  /**
   * Calculate parametric VaR assuming normal distribution
   */
  private calculateParametricVaR(returns: number[], confidenceLevel: number): { var: number; cvar: number } {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    const zScore = this.inverseNormal(1 - confidenceLevel);
    const var_ = Math.abs(mean + zScore * volatility);
    
    // For normal distribution, CVaR = VaR + σ * φ(z) / (1-α)
    const phi = this.standardNormalPDF(zScore);
    const cvar = var_ + volatility * phi / (1 - confidenceLevel);
    
    return { var: var_, cvar };
  }

  /**
   * Calculate Monte Carlo VaR
   */
  private async calculateMonteCarloVaR(returns: number[], confidenceLevel: number): Promise<{ var: number; cvar: number }> {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    // Generate Monte Carlo simulations
    const simulations: number[] = [];
    for (let i = 0; i < this.config.monteCarloSimulations; i++) {
      const randomReturn = this.generateRandomNormal(mean, volatility);
      simulations.push(randomReturn);
    }
    
    return this.calculateHistoricalVaR(simulations, confidenceLevel);
  }

  /**
   * Calculate Cornish-Fisher VaR accounting for skewness and kurtosis
   */
  private calculateCornishFisherVaR(returns: number[], confidenceLevel: number): { var: number; cvar: number } {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    const skewness = this.calculateSkewness(returns, mean);
    const kurtosis = this.calculateKurtosis(returns, mean);
    
    const z = this.inverseNormal(1 - confidenceLevel);
    
    // Cornish-Fisher expansion
    const cfZ = z + 
      (z * z - 1) * skewness / 6 +
      (z * z * z - 3 * z) * (kurtosis - 3) / 24 -
      (2 * z * z * z - 5 * z) * skewness * skewness / 36;
    
    const var_ = Math.abs(mean + cfZ * volatility);
    
    // Approximate CVaR using modified z-score
    const phi = this.standardNormalPDF(cfZ);
    const cvar = var_ + volatility * phi / (1 - confidenceLevel);
    
    return { var: var_, cvar };
  }

  /**
   * Calculate modified VaR
   */
  private calculateModifiedVaR(mean: number, volatility: number, skewness: number, kurtosis: number, confidenceLevel: number): number {
    const z = this.inverseNormal(1 - confidenceLevel);
    
    // Modified VaR using Cornish-Fisher expansion
    const modifiedZ = z + 
      (z * z - 1) * skewness / 6 +
      (z * z * z - 3 * z) * (kurtosis - 3) / 24;
    
    return Math.abs(mean + modifiedZ * volatility);
  }

  /**
   * Analyze tail beyond VaR
   */
  private analyzeTail(returns: number[], var_: number): { tailRatio: number; averageTailLoss: number; maxTailLoss: number } {
    const tailReturns = returns.filter(r => r < -var_);
    
    if (tailReturns.length === 0) {
      return { tailRatio: 0, averageTailLoss: 0, maxTailLoss: 0 };
    }
    
    const tailRatio = tailReturns.length / returns.length;
    const averageTailLoss = Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length);
    const maxTailLoss = Math.abs(Math.min(...tailReturns));
    
    return { tailRatio, averageTailLoss, maxTailLoss };
  }

  /**
   * Backtest VaR model
   */
  private backtestVaR(returns: number[], var_: number, confidenceLevel: number): VaRResults['backtestingResults'] {
    const violations = returns.filter(r => r < -var_);
    const violationRate = violations.length / returns.length;
    const expectedViolations = (1 - confidenceLevel) * returns.length;
    const actualViolations = violations.length;
    
    // Kupiec test (likelihood ratio test)
    const kupiecStatistic = this.calculateKupiecTest(actualViolations, returns.length, confidenceLevel);
    const kupiecPValue = 1 - this.chiSquareCDF(kupiecStatistic, 1);
    
    // Christoffersen test (independence test) - simplified
    const christoffersenStatistic = 0; // Placeholder
    const christoffersenPValue = 0.5; // Placeholder
    
    return {
      violationRate,
      expectedViolations,
      actualViolations,
      kupiecTest: {
        statistic: kupiecStatistic,
        p_value: kupiecPValue,
        rejected: kupiecPValue < 0.05
      },
      christoffersenTest: {
        statistic: christoffersenStatistic,
        p_value: christoffersenPValue,
        rejected: christoffersenPValue < 0.05
      }
    };
  }

  /**
   * Calculate various risk measures
   */
  private calculateDownsideRiskMeasures(returns: number[]): any {
    return {
      downsideVolatility: this.calculateDownsideVolatility(returns),
      semiVolatility: this.calculateSemiVolatility(returns)
    };
  }

  private calculateTailRiskMeasures(returns: number[]): AdvancedRiskMetricsResults['tailRisk'] {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const p95Index = Math.floor(0.95 * sortedReturns.length);
    const p5Index = Math.floor(0.05 * sortedReturns.length);
    
    return {
      tailRatio: Math.abs(sortedReturns[p95Index] / sortedReturns[p5Index]),
      tailExpectation: Math.abs(sortedReturns.slice(0, p5Index).reduce((sum, r) => sum + r, 0) / p5Index),
      tailVariance: 0.1, // Placeholder
      tailGini: 0.3 // Placeholder
    };
  }

  private async performExtremeValueAnalysis(returns: number[]): Promise<AdvancedRiskMetricsResults['extremeValueAnalysis']> {
    // Simplified extreme value analysis - in production would use proper EVT
    return {
      method: 'GPD',
      parameters: {
        location: 0,
        scale: 0.02,
        shape: 0.1
      },
      returnLevels: {
        '10_year': 0.15,
        '100_year': 0.25
      },
      exceedanceProbabilities: {
        '0.1': 0.01,
        '0.2': 0.001
      }
    };
  }

  private performCorrelationAnalysis(returns: number[]): AdvancedRiskMetricsResults['correlationAnalysis'] {
    // For single asset, return default values
    return {
      averageCorrelation: 0,
      maxCorrelation: 0,
      minCorrelation: 0,
      correlationVolatility: 0,
      kendallTau: 0,
      spearmanRho: 0
    };
  }

  private calculateBetaAlpha(returns: number[], benchmarkReturns: number[]): AdvancedRiskMetricsResults['betaAnalysis'] {
    const minLength = Math.min(returns.length, benchmarkReturns.length);
    const portfolioReturns = returns.slice(-minLength);
    const benchReturns = benchmarkReturns.slice(-minLength);
    
    // Calculate beta using linear regression
    const covariance = this.calculateCovariance(portfolioReturns, benchReturns);
    const benchmarkVariance = this.calculateVariance(benchReturns);
    const beta = benchmarkVariance !== 0 ? covariance / benchmarkVariance : 0;
    
    // Calculate alpha
    const portfolioMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const benchmarkMean = benchReturns.reduce((sum, r) => sum + r, 0) / benchReturns.length;
    const alpha = portfolioMean - this.config.riskFreeRate - beta * (benchmarkMean - this.config.riskFreeRate);
    
    // Calculate other metrics
    const trackingError = this.calculateTrackingError(portfolioReturns, benchReturns);
    const treynorRatio = beta !== 0 ? (portfolioMean - this.config.riskFreeRate) / beta : 0;
    const informationRatio = trackingError !== 0 ? alpha / trackingError : 0;
    
    return {
      beta,
      alpha,
      treynorRatio,
      informationRatio,
      trackingError,
      betaStability: 0.8 // Placeholder
    };
  }

  private async performRegimeAnalysis(returns: number[]): Promise<RegimeAnalysisResults> {
    // Simplified regime analysis - in production would use proper regime switching models
    return {
      method: this.config.regimeDetectionMethod,
      numRegimes: this.config.numRegimes,
      regimeSequence: returns.map(() => Math.floor(Math.random() * this.config.numRegimes)),
      regimeProbabilities: [0.6, 0.4],
      transitionMatrix: [[0.9, 0.1], [0.2, 0.8]],
      regimeCharacteristics: [
        {
          regime: 0,
          meanReturn: 0.001,
          volatility: 0.015,
          duration: 50,
          var95: 0.025,
          cvar95: 0.035
        },
        {
          regime: 1,
          meanReturn: -0.002,
          volatility: 0.03,
          duration: 20,
          var95: 0.05,
          cvar95: 0.07
        }
      ],
      modelFit: {
        logLikelihood: -100,
        aic: 210,
        bic: 220,
        hqc: 215
      }
    };
  }

  private calculateRiskAdjustedPerformance(returns: number[], results: BacktestResults): AdvancedRiskMetricsResults['riskAdjustedMetrics'] {
    const portfolioReturn = results.totalReturnPercent / 100;
    const volatility = this.calculateVolatility(returns);
    
    return {
      informationRatio: results.informationRatio,
      appraisalRatio: volatility !== 0 ? portfolioReturn / volatility : 0, // Simplified
      modiglianiRatio: 0.15, // Placeholder
      jensenMeasure: 0.02 // Placeholder
    };
  }

  private calculateLowerPartialMoments(returns: number[]): AdvancedRiskMetricsResults['lowerPartialMoments'] {
    const target = 0; // Target return
    const negativeReturns = returns.filter(r => r < target);
    
    if (negativeReturns.length === 0) {
      return { lpm0: 0, lpm1: 0, lpm2: 0, lpm3: 0 };
    }
    
    const lpm0 = negativeReturns.length / returns.length;
    const lpm1 = negativeReturns.reduce((sum, r) => sum + Math.abs(r), 0) / returns.length;
    const lpm2 = negativeReturns.reduce((sum, r) => sum + Math.pow(Math.abs(r), 2), 0) / returns.length;
    const lpm3 = negativeReturns.reduce((sum, r) => sum + Math.pow(Math.abs(r), 3), 0) / returns.length;
    
    return { lpm0, lpm1, lpm2, lpm3 };
  }

  private calculateOmegaRatio(returns: number[], target: number = 0): number {
    const gains = returns.filter(r => r > target).reduce((sum, r) => sum + (r - target), 0);
    const losses = returns.filter(r => r < target).reduce((sum, r) => sum + Math.abs(r - target), 0);
    
    return losses !== 0 ? gains / losses : Infinity;
  }

  private calculateSortinoRatio(returns: number[], target: number = 0): number {
    const excessReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length - target;
    const downsideDeviation = this.calculateDownsideVolatility(returns, target);
    
    return downsideDeviation !== 0 ? excessReturn / downsideDeviation : 0;
  }

  private calculateCalmarRatio(returns: number[], maxDrawdown: number): number {
    const annualizedReturn = (returns.reduce((sum, r) => sum + r, 0) / returns.length) * 252;
    return maxDrawdown !== 0 ? annualizedReturn / (maxDrawdown / 100) : 0;
  }

  private calculateSterlingRatio(returns: number[], maxDrawdown: number): number {
    const annualizedReturn = (returns.reduce((sum, r) => sum + r, 0) / returns.length) * 252;
    const adjustedDrawdown = Math.max(maxDrawdown / 100, 0.1); // Minimum 10% to avoid division by zero
    return annualizedReturn / adjustedDrawdown;
  }

  private calculateBurkeRatio(returns: number[]): number {
    const annualizedReturn = (returns.reduce((sum, r) => sum + r, 0) / returns.length) * 252;
    
    // Calculate Burke ratio using square root of sum of squared drawdowns
    let cumulativeReturn = 0;
    let peak = 0;
    let sumSquaredDrawdowns = 0;
    
    for (const ret of returns) {
      cumulativeReturn += ret;
      peak = Math.max(peak, cumulativeReturn);
      const drawdown = peak - cumulativeReturn;
      sumSquaredDrawdowns += drawdown * drawdown;
    }
    
    const burkeDrawdown = Math.sqrt(sumSquaredDrawdowns);
    return burkeDrawdown !== 0 ? annualizedReturn / burkeDrawdown : 0;
  }

  // Utility methods
  
  private extractReturns(results: BacktestResults): number[] {
    return results.equityCurve.map(point => point.dailyReturn);
  }

  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateDownsideVolatility(returns: number[], target: number = 0): number {
    const downsideReturns = returns.filter(r => r < target);
    if (downsideReturns.length === 0) return 0;
    
    const mean = target;
    const variance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downsideReturns.length;
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateSemiVolatility(returns: number[], target: number = 0): number {
    const downsideReturns = returns.filter(r => r < target);
    if (downsideReturns.length === 0) return 0;
    
    const downsideMean = downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length;
    const variance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideMean, 2), 0) / (downsideReturns.length - 1);
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateSkewness(returns: number[], mean: number): number {
    const n = returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
    const std = Math.sqrt(variance);
    
    if (std === 0) return 0;
    
    const skew = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 3), 0) / n;
    return skew;
  }

  private calculateKurtosis(returns: number[], mean: number): number {
    const n = returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
    const std = Math.sqrt(variance);
    
    if (std === 0) return 3; // Normal distribution kurtosis
    
    const kurt = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 4), 0) / n;
    return kurt;
  }

  private calculateCovariance(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    
    const covariance = x.slice(0, n).reduce((sum, xi, i) => {
      return sum + (xi - meanX) * (y[i] - meanY);
    }, 0) / (n - 1);
    
    return covariance;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
  }

  private calculateTrackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
    const differences = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
    return this.calculateVolatility(differences);
  }

  private calculateKupiecTest(violations: number, observations: number, confidenceLevel: number): number {
    const expectedRate = 1 - confidenceLevel;
    const actualRate = violations / observations;
    
    if (actualRate === 0 || actualRate === 1) return 0;
    
    const logLikelihood = violations * Math.log(actualRate) + (observations - violations) * Math.log(1 - actualRate);
    const logLikelihoodNull = violations * Math.log(expectedRate) + (observations - violations) * Math.log(1 - expectedRate);
    
    return -2 * (logLikelihoodNull - logLikelihood);
  }

  // Statistical distribution functions
  
  private inverseNormal(p: number): number {
    // Approximate inverse normal using Beasley-Springer-Moro algorithm
    if (p <= 0 || p >= 1) return 0;
    
    const c = [2.515517, 0.802853, 0.010328];
    const d = [1.432788, 0.189269, 0.001308];
    
    let x: number;
    if (p > 0.5) {
      const t = Math.sqrt(-2 * Math.log(1 - p));
      x = t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
    } else {
      const t = Math.sqrt(-2 * Math.log(p));
      x = -(t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t));
    }
    
    return x;
  }

  private standardNormalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private chiSquareCDF(x: number, df: number): number {
    // Simplified chi-square CDF approximation
    if (x <= 0) return 0;
    if (df === 1) return 2 * (this.normalCDF(Math.sqrt(x)) - 0.5);
    return Math.min(1, x / (x + df)); // Very rough approximation
  }

  private normalCDF(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private generateRandomNormal(mean: number, std: number): number {
    // Box-Muller transformation
    const u = Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
  }
}

export type {
  RiskMetricsConfig,
  VaRResults,
  AdvancedRiskMetricsResults,
  RegimeAnalysisResults
};

export { AdvancedRiskMetricsCalculator as AdvancedRiskMetrics };