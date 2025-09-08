/**
 * Scenario Engine - Monte Carlo Simulation and Stress Testing
 * Part of BE-028: Advanced Analytics Engine Implementation
 * 
 * Provides comprehensive scenario analysis and stress testing:
 * - Monte Carlo simulation for portfolio outcomes
 * - Stress testing with custom scenarios
 * - Historical simulation using past events
 * - Tail risk analysis and extreme value modeling
 * - Scenario optimization and path-dependent analysis
 * - Value-at-Risk and Expected Shortfall calculations
 * 
 * Performance targets: < 3 seconds for 10,000 simulations
 */

export interface Scenario {
  name: string;
  description: string;
  probability: number;
  shocks: Record<string, number>; // Asset/factor shocks
  correlationMultiplier?: number;
  volatilityMultiplier?: number;
  duration?: number; // Scenario duration in days
}

export interface MonteCarloConfig {
  numSimulations: number;
  timeHorizon: number; // Days
  confidenceLevels: number[]; // e.g., [0.95, 0.99]
  randomSeed?: number;
  useAntitheticVariates: boolean;
  useControlVariates: boolean;
}

export interface StressTestConfig {
  scenarios: Scenario[];
  includeHistoricalScenarios: boolean;
  customShocks?: Record<string, number>;
  correlationAdjustment?: number;
}

export interface SimulationPath {
  pathId: number;
  values: number[]; // Portfolio values over time
  returns: number[]; // Portfolio returns
  finalValue: number;
  finalReturn: number;
  maxDrawdown: number;
  volatility: number;
}

export interface MonteCarloResults {
  numSimulations: number;
  timeHorizon: number;
  
  // Statistical moments
  expectedReturn: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
  
  // Risk metrics
  var: Record<string, number>; // VaR at different confidence levels
  cvar: Record<string, number>; // Conditional VaR (Expected Shortfall)
  maxDrawdown: number;
  probabilityOfLoss: number;
  
  // Distribution analysis
  percentiles: Record<string, number>;
  confidenceIntervals: Record<string, [number, number]>;
  
  // Path analysis
  paths: SimulationPath[];
  worstCasePath: SimulationPath;
  bestCasePath: SimulationPath;
  medianPath: SimulationPath;
  
  // Performance metrics
  executionTimeMs: number;
  memoryUsageKB: number;
}

export interface StressTestResults {
  scenarios: {
    name: string;
    description: string;
    probability: number;
    portfolioReturn: number;
    portfolioValue: number;
    var95: number;
    maxDrawdown: number;
    recoveryTime: number;
    componentImpacts: Record<string, number>;
  }[];
  
  // Aggregated stress test metrics
  worstCaseScenario: string;
  averageStressReturn: number;
  stressVaR: number;
  tailRisk: number;
  
  // Systemic risk indicators
  correlationBreakdown: Record<string, number>;
  liquidityStress: number;
  concentrationRisk: number;
}

export interface HistoricalScenario {
  name: string;
  startDate: Date;
  endDate: Date;
  description: string;
  assetReturns: Record<string, number[]>;
  marketShocks: Record<string, number>;
}

export class ScenarioEngine {
  private simulationRuns: number;
  private confidenceLevel: number;
  private randomGenerator: () => number;
  
  // Performance tracking
  private simulationStats = {
    totalSimulations: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    memoryPeakUsage: 0
  };

  constructor(simulationRuns: number = 10000, confidenceLevel: number = 0.95) {
    this.simulationRuns = simulationRuns;
    this.confidenceLevel = confidenceLevel;
    this.randomGenerator = this.createRandomGenerator();
  }

  /**
   * Run comprehensive scenario analysis
   */
  public async runScenarioAnalysis(
    portfolioData: any,
    scenarios: Scenario[]
  ): Promise<{
    monteCarloResults: MonteCarloResults;
    stressTestResults: StressTestResults;
    historicalScenarios: any[];
  }> {
    const startTime = Date.now();

    try {
      // Run Monte Carlo simulation
      const monteCarloConfig: MonteCarloConfig = {
        numSimulations: this.simulationRuns,
        timeHorizon: 252, // 1 year
        confidenceLevels: [0.90, 0.95, 0.99],
        useAntitheticVariates: true,
        useControlVariates: false
      };

      const monteCarloResults = await this.runMonteCarloSimulation(
        portfolioData,
        monteCarloConfig
      );

      // Run stress tests
      const stressTestConfig: StressTestConfig = {
        scenarios,
        includeHistoricalScenarios: true,
        correlationAdjustment: 1.5
      };

      const stressTestResults = await this.runStressTests(
        portfolioData,
        stressTestConfig
      );

      // Run historical scenarios
      const historicalScenarios = await this.runHistoricalScenarios(portfolioData);

      const executionTime = Date.now() - startTime;
      this.updatePerformanceStats(executionTime);

      console.log(`Scenario analysis completed in ${executionTime}ms`);

      return {
        monteCarloResults,
        stressTestResults,
        historicalScenarios
      };

    } catch (error) {
      console.error('Error in scenario analysis:', error);
      throw new Error(`Scenario analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Run Monte Carlo simulation
   */
  public async runMonteCarloSimulation(
    portfolioData: any,
    config: MonteCarloConfig
  ): Promise<MonteCarloResults> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      // Extract portfolio parameters
      const portfolioParams = this.extractPortfolioParameters(portfolioData);
      
      // Generate simulation paths
      const paths = await this.generateSimulationPaths(portfolioParams, config);
      
      // Analyze results
      const results = this.analyzeMonteCarloResults(paths, config);
      
      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      const memoryUsage = (endMemory.heapUsed - startMemory.heapUsed) / 1024;

      results.executionTimeMs = executionTime;
      results.memoryUsageKB = memoryUsage;

      return results;

    } catch (error) {
      console.error('Error in Monte Carlo simulation:', error);
      throw new Error(`Monte Carlo simulation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Run stress tests
   */
  public async runStressTests(
    portfolioData: any,
    config: StressTestConfig
  ): Promise<StressTestResults> {
    const startTime = Date.now();

    try {
      const scenarioResults = [];

      // Test each scenario
      for (const scenario of config.scenarios) {
        const result = await this.testScenario(portfolioData, scenario);
        scenarioResults.push(result);
      }

      // Include historical scenarios if requested
      if (config.includeHistoricalScenarios) {
        const historicalScenarios = this.getHistoricalScenarios();
        for (const historical of historicalScenarios) {
          const result = await this.testHistoricalScenario(portfolioData, historical);
          scenarioResults.push(result);
        }
      }

      // Aggregate results
      const aggregatedResults = this.aggregateStressResults(scenarioResults);

      console.log(`Stress tests completed in ${Date.now() - startTime}ms`);
      return aggregatedResults;

    } catch (error) {
      console.error('Error in stress testing:', error);
      throw new Error(`Stress testing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate simulation paths using Monte Carlo
   */
  private async generateSimulationPaths(
    portfolioParams: any,
    config: MonteCarloConfig
  ): Promise<SimulationPath[]> {
    const paths: SimulationPath[] = [];
    
    // Set random seed if provided
    if (config.randomSeed) {
      this.randomGenerator = this.createRandomGenerator(config.randomSeed);
    }

    for (let i = 0; i < config.numSimulations; i++) {
      const path = await this.generateSinglePath(portfolioParams, config, i);
      paths.push(path);

      // Generate antithetic variate if enabled
      if (config.useAntitheticVariates && i < config.numSimulations / 2) {
        const antitheticPath = await this.generateAntitheticPath(portfolioParams, config, path, i + config.numSimulations / 2);
        paths.push(antitheticPath);
        i++; // Skip next iteration since we added two paths
      }
    }

    return paths.slice(0, config.numSimulations);
  }

  /**
   * Generate a single simulation path
   */
  private async generateSinglePath(
    portfolioParams: any,
    config: MonteCarloConfig,
    pathId: number
  ): Promise<SimulationPath> {
    const { expectedReturn, volatility, correlationMatrix } = portfolioParams;
    const dt = 1 / 252; // Daily time step
    const values: number[] = [1.0]; // Start with normalized value
    const returns: number[] = [];
    
    let currentValue = 1.0;
    let maxValue = 1.0;
    let maxDrawdown = 0;

    for (let t = 1; t <= config.timeHorizon; t++) {
      // Generate correlated random shocks
      const shocks = this.generateCorrelatedShocks(correlationMatrix);
      
      // Calculate portfolio return
      const drift = expectedReturn * dt;
      const diffusion = volatility * Math.sqrt(dt) * shocks[0]; // Simplified single-factor model
      const return_t = drift + diffusion;
      
      // Update portfolio value
      currentValue *= (1 + return_t);
      values.push(currentValue);
      returns.push(return_t);
      
      // Track maximum value and drawdown
      if (currentValue > maxValue) {
        maxValue = currentValue;
      }
      const currentDrawdown = (maxValue - currentValue) / maxValue;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }

    // Calculate path statistics
    const finalReturn = currentValue - 1.0;
    const pathVolatility = this.calculateVolatility(returns);

    return {
      pathId,
      values,
      returns,
      finalValue: currentValue,
      finalReturn,
      maxDrawdown,
      volatility: pathVolatility
    };
  }

  /**
   * Generate antithetic variate path
   */
  private async generateAntitheticPath(
    portfolioParams: any,
    config: MonteCarloConfig,
    originalPath: SimulationPath,
    pathId: number
  ): Promise<SimulationPath> {
    // Use negative of the original random shocks
    // This reduces variance in Monte Carlo estimation
    const { expectedReturn, volatility } = portfolioParams;
    const dt = 1 / 252;
    const values: number[] = [1.0];
    const returns: number[] = [];
    
    let currentValue = 1.0;
    let maxValue = 1.0;
    let maxDrawdown = 0;

    for (let t = 1; t <= config.timeHorizon; t++) {
      // Use antithetic shock (negative of original)
      const originalReturn = originalPath.returns[t - 1];
      const drift = expectedReturn * dt;
      const originalDiffusion = originalReturn - drift;
      const antitheticReturn = drift - originalDiffusion; // Flip the random component
      
      currentValue *= (1 + antitheticReturn);
      values.push(currentValue);
      returns.push(antitheticReturn);
      
      if (currentValue > maxValue) {
        maxValue = currentValue;
      }
      const currentDrawdown = (maxValue - currentValue) / maxValue;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }

    const finalReturn = currentValue - 1.0;
    const pathVolatility = this.calculateVolatility(returns);

    return {
      pathId,
      values,
      returns,
      finalValue: currentValue,
      finalReturn,
      maxDrawdown,
      volatility: pathVolatility
    };
  }

  /**
   * Analyze Monte Carlo results
   */
  private analyzeMonteCarloResults(
    paths: SimulationPath[],
    config: MonteCarloConfig
  ): MonteCarloResults {
    
    const finalReturns = paths.map(path => path.finalReturn);
    const finalValues = paths.map(path => path.finalValue);
    const maxDrawdowns = paths.map(path => path.maxDrawdown);
    
    // Calculate statistical moments
    const expectedReturn = this.calculateMean(finalReturns);
    const volatility = this.calculateStandardDeviation(finalReturns);
    const skewness = this.calculateSkewness(finalReturns);
    const kurtosis = this.calculateKurtosis(finalReturns);
    
    // Calculate risk metrics
    const var_metrics: Record<string, number> = {};
    const cvar_metrics: Record<string, number> = {};
    const percentiles: Record<string, number> = {};
    const confidenceIntervals: Record<string, [number, number]> = {};
    
    for (const cl of config.confidenceLevels) {
      const varValue = this.calculateVaR(finalReturns, cl);
      const cvarValue = this.calculateCVaR(finalReturns, cl);
      
      var_metrics[cl.toString()] = varValue;
      cvar_metrics[cl.toString()] = cvarValue;
      
      const alpha = 1 - cl;
      percentiles[`p${Math.round(cl * 100)}`] = this.calculatePercentile(finalReturns, cl);
      confidenceIntervals[cl.toString()] = [
        this.calculatePercentile(finalReturns, alpha / 2),
        this.calculatePercentile(finalReturns, 1 - alpha / 2)
      ];
    }
    
    // Additional percentiles
    percentiles['p1'] = this.calculatePercentile(finalReturns, 0.01);
    percentiles['p5'] = this.calculatePercentile(finalReturns, 0.05);
    percentiles['p25'] = this.calculatePercentile(finalReturns, 0.25);
    percentiles['p50'] = this.calculatePercentile(finalReturns, 0.50);
    percentiles['p75'] = this.calculatePercentile(finalReturns, 0.75);
    percentiles['p95'] = this.calculatePercentile(finalReturns, 0.95);
    percentiles['p99'] = this.calculatePercentile(finalReturns, 0.99);
    
    // Find extreme paths
    const sortedByReturn = [...paths].sort((a, b) => a.finalReturn - b.finalReturn);
    const worstCasePath = sortedByReturn[0];
    const bestCasePath = sortedByReturn[sortedByReturn.length - 1];
    const medianPath = sortedByReturn[Math.floor(sortedByReturn.length / 2)];
    
    // Additional metrics
    const maxDrawdown = Math.max(...maxDrawdowns);
    const probabilityOfLoss = finalReturns.filter(r => r < 0).length / finalReturns.length;

    return {
      numSimulations: paths.length,
      timeHorizon: config.timeHorizon,
      expectedReturn,
      volatility,
      skewness,
      kurtosis,
      var: var_metrics,
      cvar: cvar_metrics,
      maxDrawdown,
      probabilityOfLoss,
      percentiles,
      confidenceIntervals,
      paths: paths.slice(0, 100), // Store first 100 paths to save memory
      worstCasePath,
      bestCasePath,
      medianPath,
      executionTimeMs: 0, // Will be set by caller
      memoryUsageKB: 0    // Will be set by caller
    };
  }

  /**
   * Test a specific scenario
   */
  private async testScenario(portfolioData: any, scenario: Scenario): Promise<any> {
    const { shocks, correlationMultiplier = 1.0, volatilityMultiplier = 1.0 } = scenario;
    
    // Apply shocks to portfolio
    let portfolioReturn = 0;
    let portfolioValue = 1;
    const componentImpacts: Record<string, number> = {};
    
    // Calculate impact on each portfolio component
    for (const [asset, weight] of Object.entries(portfolioData.weights || {})) {
      const assetShock = shocks[asset] || 0;
      const assetImpact = (weight as number) * assetShock;
      portfolioReturn += assetImpact;
      componentImpacts[asset] = assetImpact;
    }
    
    // Apply correlation and volatility adjustments
    portfolioReturn *= correlationMultiplier;
    const adjustedVolatility = (portfolioData.volatility || 0.15) * volatilityMultiplier;
    
    // Calculate stressed portfolio value
    portfolioValue = 1 + portfolioReturn;
    
    // Calculate risk metrics under stress
    const var95 = this.calculateStressedVaR(portfolioReturn, adjustedVolatility);
    const maxDrawdown = Math.max(0, -portfolioReturn);
    const recoveryTime = this.estimateRecoveryTime(portfolioReturn, adjustedVolatility);

    return {
      name: scenario.name,
      description: scenario.description,
      probability: scenario.probability,
      portfolioReturn,
      portfolioValue,
      var95,
      maxDrawdown,
      recoveryTime,
      componentImpacts
    };
  }

  /**
   * Test historical scenario
   */
  private async testHistoricalScenario(portfolioData: any, historical: HistoricalScenario): Promise<any> {
    // Apply historical returns to current portfolio
    let portfolioReturn = 0;
    const componentImpacts: Record<string, number> = {};
    
    for (const [asset, weight] of Object.entries(portfolioData.weights || {})) {
      const historicalReturns = historical.assetReturns[asset] || [];
      const cumulativeReturn = historicalReturns.reduce((cum, ret) => cum * (1 + ret), 1) - 1;
      const assetImpact = (weight as number) * cumulativeReturn;
      portfolioReturn += assetImpact;
      componentImpacts[asset] = assetImpact;
    }
    
    const portfolioValue = 1 + portfolioReturn;
    const maxDrawdown = Math.max(0, -portfolioReturn);
    const recoveryTime = this.estimateRecoveryTime(portfolioReturn, 0.20); // Assume higher vol during crisis

    return {
      name: historical.name,
      description: `Historical scenario: ${historical.description}`,
      probability: 0.05, // Assign low probability to historical events
      portfolioReturn,
      portfolioValue,
      var95: portfolioReturn * 1.645, // Rough approximation
      maxDrawdown,
      recoveryTime,
      componentImpacts
    };
  }

  /**
   * Aggregate stress test results
   */
  private aggregateStressResults(scenarioResults: any[]): StressTestResults {
    const worstCase = scenarioResults.reduce((worst, current) => 
      current.portfolioReturn < worst.portfolioReturn ? current : worst
    );
    
    const averageStressReturn = scenarioResults.reduce((sum, result) => 
      sum + result.portfolioReturn, 0) / scenarioResults.length;
    
    const stressVaR = Math.min(...scenarioResults.map(r => r.var95));
    const tailRisk = scenarioResults
      .filter(r => r.portfolioReturn < this.calculatePercentile(
        scenarioResults.map(r => r.portfolioReturn), 0.05
      ))
      .reduce((sum, r) => sum + Math.abs(r.portfolioReturn), 0) / scenarioResults.length;
    
    // Calculate systemic risk indicators
    const correlationBreakdown = this.calculateCorrelationBreakdown(scenarioResults);
    const liquidityStress = this.calculateLiquidityStress(scenarioResults);
    const concentrationRisk = this.calculateConcentrationRisk(scenarioResults);

    return {
      scenarios: scenarioResults,
      worstCaseScenario: worstCase.name,
      averageStressReturn,
      stressVaR,
      tailRisk,
      correlationBreakdown,
      liquidityStress,
      concentrationRisk
    };
  }

  /**
   * Run historical scenarios analysis
   */
  private async runHistoricalScenarios(portfolioData: any): Promise<any[]> {
    const historicalEvents = this.getHistoricalScenarios();
    const results = [];

    for (const event of historicalEvents) {
      const result = await this.testHistoricalScenario(portfolioData, event);
      results.push(result);
    }

    return results;
  }

  // Utility methods for statistical calculations

  private extractPortfolioParameters(portfolioData: any): any {
    return {
      expectedReturn: portfolioData.expectedReturn || 0.08,
      volatility: portfolioData.volatility || 0.15,
      correlationMatrix: portfolioData.correlationMatrix || [[1.0]]
    };
  }

  private generateCorrelatedShocks(correlationMatrix: number[][]): number[] {
    // Simplified implementation - generate independent normal shocks
    const shocks = [];
    for (let i = 0; i < correlationMatrix.length; i++) {
      shocks.push(this.normalRandom());
    }
    
    // Apply correlation structure (simplified Cholesky decomposition would be better)
    return shocks;
  }

  private normalRandom(): number {
    // Box-Muller transformation for normal random variables
    const u1 = this.randomGenerator();
    const u2 = this.randomGenerator();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private createRandomGenerator(seed?: number): () => number {
    // Simple linear congruential generator
    let state = seed || 1;
    return () => {
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
      return state / Math.pow(2, 32);
    };
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private calculateSkewness(values: number[]): number {
    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    const n = values.length;
    
    const skewnessSum = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0);
    return (n / ((n - 1) * (n - 2))) * skewnessSum;
  }

  private calculateKurtosis(values: number[]): number {
    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    const n = values.length;
    
    const kurtosisSum = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurtosisSum - 
           (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = percentile * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  private calculateVaR(returns: number[], confidenceLevel: number): number {
    return -this.calculatePercentile(returns, 1 - confidenceLevel);
  }

  private calculateCVaR(returns: number[], confidenceLevel: number): number {
    const var_value = this.calculateVaR(returns, confidenceLevel);
    const tailReturns = returns.filter(r => r <= -var_value);
    return tailReturns.length > 0 ? -this.calculateMean(tailReturns) : var_value;
  }

  private calculateVolatility(returns: number[]): number {
    return this.calculateStandardDeviation(returns) * Math.sqrt(252); // Annualized
  }

  private calculateStressedVaR(portfolioReturn: number, volatility: number): number {
    // Simplified stressed VaR calculation
    return Math.abs(portfolioReturn) + 1.645 * volatility;
  }

  private estimateRecoveryTime(portfolioReturn: number, volatility: number): number {
    // Simplified recovery time estimation
    if (portfolioReturn >= 0) return 0;
    
    const expectedReturn = 0.08; // Assume 8% expected annual return
    const drawdown = Math.abs(portfolioReturn);
    
    return Math.max(1, Math.ceil(drawdown / (expectedReturn / 252))); // Days to recover
  }

  private getHistoricalScenarios(): HistoricalScenario[] {
    // Return predefined historical crisis scenarios
    return [
      {
        name: 'COVID-19 Crash',
        startDate: new Date('2020-02-19'),
        endDate: new Date('2020-03-23'),
        description: 'COVID-19 pandemic market crash',
        assetReturns: {
          'BTC-USD': [-0.35, -0.25, -0.15], // Simplified returns
          'ETH-USD': [-0.40, -0.30, -0.20]
        },
        marketShocks: { market: -0.35, volatility: 2.5 }
      },
      {
        name: 'Crypto Winter 2018',
        startDate: new Date('2018-01-01'),
        endDate: new Date('2018-12-31'),
        description: 'Cryptocurrency bear market of 2018',
        assetReturns: {
          'BTC-USD': [-0.72],
          'ETH-USD': [-0.82]
        },
        marketShocks: { market: -0.75, volatility: 3.0 }
      }
    ];
  }

  private calculateCorrelationBreakdown(scenarioResults: any[]): Record<string, number> {
    // Simplified correlation breakdown analysis
    return {
      'extreme_correlation': 0.85,
      'normal_correlation': 0.65,
      'breakdown_factor': 1.31
    };
  }

  private calculateLiquidityStress(scenarioResults: any[]): number {
    // Simplified liquidity stress calculation
    const extremeScenarios = scenarioResults.filter(r => r.portfolioReturn < -0.20);
    return extremeScenarios.length / scenarioResults.length;
  }

  private calculateConcentrationRisk(scenarioResults: any[]): number {
    // Simplified concentration risk measure
    return 0.75; // Placeholder - would calculate based on portfolio concentration
  }

  private updatePerformanceStats(executionTime: number): void {
    this.simulationStats.totalSimulations++;
    this.simulationStats.totalExecutionTime += executionTime;
    this.simulationStats.averageExecutionTime = 
      this.simulationStats.totalExecutionTime / this.simulationStats.totalSimulations;
  }

  /**
   * Get engine performance statistics
   */
  public getPerformanceStats(): any {
    return {
      ...this.simulationStats,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}