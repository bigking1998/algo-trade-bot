/**
 * Drift Detector - Task BE-027
 * 
 * Advanced statistical drift detection system for ML model monitoring.
 * Detects feature drift, label drift, and concept drift using multiple statistical tests.
 * Target: <100ms analysis time for real-time monitoring.
 * 
 * Features:
 * - Feature distribution drift using KS test, PSI, and Earth Mover's Distance
 * - Label drift detection with Chi-square and KL divergence
 * - Concept drift using performance-based detection
 * - Multi-variate drift analysis with correlation analysis
 * - Real-time drift scoring with configurable thresholds
 * - Statistical significance testing with p-values
 */

import { EventEmitter } from 'events';

export interface DriftDetectorConfig {
  windowSize: number;
  threshold: number;
  significanceLevel: number;
  methods: DriftDetectionMethod[];
  minSamples: number;
  maxHistorySize: number;
  enableRealtimeDetection: boolean;
}

export type DriftDetectionMethod = 
  | 'KOLMOGOROV_SMIRNOV' 
  | 'POPULATION_STABILITY_INDEX'
  | 'EARTH_MOVERS_DISTANCE' 
  | 'CHI_SQUARE'
  | 'KL_DIVERGENCE'
  | 'JENSEN_SHANNON'
  | 'ANDERSON_DARLING'
  | 'MANNWHITNEY_U';

export interface DriftAnalysisResult {
  overallDriftScore: number;
  featureDriftScores: number[];
  driftDetected: boolean;
  significantFeatures: number[];
  testResults: DriftTestResult[];
  timestamp: Date;
  analysisTime: number; // milliseconds
  
  // Statistical details
  pValues: number[];
  statisticalSignificance: boolean[];
  confidenceIntervals: Array<[number, number]>;
  effectSizes: number[];
  
  // Distribution analysis
  distributionChanges: DistributionChange[];
  correlationDrift: number;
  
  // Recommendations
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export interface DriftTestResult {
  method: DriftDetectionMethod;
  featureIndex: number;
  featureName?: string;
  statistic: number;
  pValue: number;
  threshold: number;
  isDrift: boolean;
  confidence: number;
  description: string;
}

export interface DistributionChange {
  featureIndex: number;
  featureName?: string;
  meanShift: number;
  varianceRatio: number;
  skewnessChange: number;
  kurtosisChange: number;
  quantileShifts: number[]; // [0.25, 0.5, 0.75] quantile changes
}

export interface HistoricalWindow {
  features: number[][];
  labels?: number[][];
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Statistical Drift Detection System with multiple test methods
 */
export class DriftDetector extends EventEmitter {
  private config: DriftDetectorConfig;
  private historicalWindows: HistoricalWindow[] = [];
  private featureStatistics: Map<number, FeatureStatistics> = new Map();
  private driftHistory: DriftAnalysisResult[] = [];
  
  // Statistical cache for performance
  private statisticsCache: Map<string, any> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  
  // Performance optimization
  private analysisCache: Map<string, DriftAnalysisResult> = new Map();

  constructor(config: Partial<DriftDetectorConfig> = {}) {
    super();
    
    this.config = {
      windowSize: config.windowSize || 1000,
      threshold: config.threshold || 0.1,
      significanceLevel: config.significanceLevel || 0.05,
      methods: config.methods || [
        'KOLMOGOROV_SMIRNOV',
        'POPULATION_STABILITY_INDEX',
        'EARTH_MOVERS_DISTANCE'
      ],
      minSamples: config.minSamples || 50,
      maxHistorySize: config.maxHistorySize || 10000,
      enableRealtimeDetection: config.enableRealtimeDetection ?? true
    };
    
    console.log('📊 Drift Detector initialized');
    console.log(`🔍 Methods: ${this.config.methods.join(', ')}`);
    console.log(`📏 Window size: ${this.config.windowSize}, Threshold: ${this.config.threshold}`);
  }

  /**
   * Detect feature drift between historical and recent data
   * Target: <100ms analysis time
   */
  async detectFeatureDrift(
    historicalFeatures: number[][],
    recentFeatures: number[][],
    featureNames?: string[]
  ): Promise<DriftAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      if (historicalFeatures.length < this.config.minSamples || 
          recentFeatures.length < this.config.minSamples) {
        throw new Error(`Insufficient samples for drift detection. Need at least ${this.config.minSamples} samples.`);
      }
      
      if (historicalFeatures[0]?.length !== recentFeatures[0]?.length) {
        throw new Error('Feature dimensions mismatch between historical and recent data');
      }
      
      const numFeatures = historicalFeatures[0].length;
      console.log(`🔍 Analyzing drift for ${numFeatures} features`);
      console.log(`📊 Historical: ${historicalFeatures.length} samples, Recent: ${recentFeatures.length} samples`);
      
      // Initialize results
      const featureDriftScores: number[] = [];
      const testResults: DriftTestResult[] = [];
      const pValues: number[] = [];
      const statisticalSignificance: boolean[] = [];
      const confidenceIntervals: Array<[number, number]> = [];
      const effectSizes: number[] = [];
      const distributionChanges: DistributionChange[] = [];
      const significantFeatures: number[] = [];
      
      // Analyze each feature
      for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
        const historicalFeature = historicalFeatures.map(sample => sample[featureIdx]);
        const recentFeature = recentFeatures.map(sample => sample[featureIdx]);
        const featureName = featureNames?.[featureIdx] || `feature_${featureIdx}`;
        
        // Run multiple drift detection methods
        const featureTestResults = await this.analyzeFeatureDrift(
          historicalFeature,
          recentFeature,
          featureIdx,
          featureName
        );
        
        testResults.push(...featureTestResults);
        
        // Calculate combined drift score for this feature
        const driftScores = featureTestResults.map(r => r.isDrift ? r.statistic : 0);
        const combinedScore = this.combineTestResults(driftScores, featureTestResults);
        featureDriftScores.push(combinedScore);
        
        // Statistical analysis
        const bestResult = featureTestResults.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        pValues.push(bestResult.pValue);
        statisticalSignificance.push(bestResult.pValue < this.config.significanceLevel);
        confidenceIntervals.push(this.calculateConfidenceInterval(bestResult));
        effectSizes.push(this.calculateEffectSize(historicalFeature, recentFeature));
        
        // Distribution change analysis
        const distChange = this.analyzeDistributionChange(
          historicalFeature,
          recentFeature,
          featureIdx,
          featureName
        );
        distributionChanges.push(distChange);
        
        // Track significant features
        if (combinedScore > this.config.threshold) {
          significantFeatures.push(featureIdx);
        }
      }
      
      // Calculate overall drift score
      const overallDriftScore = this.calculateOverallDriftScore(featureDriftScores, significantFeatures);
      
      // Correlation drift analysis
      const correlationDrift = await this.analyzeCorrelationDrift(historicalFeatures, recentFeatures);
      
      // Determine severity and recommendations
      const severity = this.determineSeverity(overallDriftScore, significantFeatures.length, numFeatures);
      const recommendations = this.generateRecommendations(
        overallDriftScore,
        significantFeatures,
        distributionChanges,
        testResults
      );
      
      const analysisTime = Date.now() - startTime;
      
      const result: DriftAnalysisResult = {
        overallDriftScore,
        featureDriftScores,
        driftDetected: overallDriftScore > this.config.threshold,
        significantFeatures,
        testResults,
        timestamp: new Date(),
        analysisTime,
        pValues,
        statisticalSignificance,
        confidenceIntervals,
        effectSizes,
        distributionChanges,
        correlationDrift,
        severity,
        recommendations
      };
      
      // Store in history
      this.driftHistory.push(result);
      if (this.driftHistory.length > this.config.maxHistorySize) {
        this.driftHistory.shift();
      }
      
      // Emit events
      this.emit('driftAnalysisCompleted', result);
      if (result.driftDetected) {
        this.emit('driftDetected', result);
      }
      
      // Performance logging
      console.log(`⏱️  Drift analysis completed in ${analysisTime}ms`);
      console.log(`📊 Overall drift score: ${overallDriftScore.toFixed(4)}`);
      console.log(`🚨 Drift detected: ${result.driftDetected ? 'YES' : 'NO'}`);
      console.log(`📈 Significant features: ${significantFeatures.length}/${numFeatures}`);
      console.log(`⚠️  Severity: ${severity}`);
      
      if (analysisTime > 100) {
        console.warn(`⚠️  Analysis exceeded 100ms target: ${analysisTime}ms`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Feature drift detection failed:', error);
      throw error;
    }
  }

  /**
   * Detect label drift (for supervised learning)
   */
  async detectLabelDrift(
    historicalLabels: number[][],
    recentLabels: number[][]
  ): Promise<DriftAnalysisResult> {
    console.log('🏷️  Analyzing label drift...');
    
    // Use the same feature drift detection logic but for labels
    return this.detectFeatureDrift(historicalLabels, recentLabels, ['label']);
  }

  /**
   * Detect concept drift using performance-based approach
   */
  async detectConceptDrift(
    historicalPerformance: number[],
    recentPerformance: number[],
    performanceMetric: string = 'accuracy'
  ): Promise<{
    conceptDriftDetected: boolean;
    driftScore: number;
    pValue: number;
    performanceChange: number;
    trend: 'IMPROVING' | 'DEGRADING' | 'STABLE';
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`🧠 Analyzing concept drift using ${performanceMetric}`);
      
      if (historicalPerformance.length < this.config.minSamples || 
          recentPerformance.length < this.config.minSamples) {
        throw new Error('Insufficient performance data for concept drift detection');
      }
      
      // Statistical test for performance difference
      const testResult = await this.kolmogorovSmirnovTest(historicalPerformance, recentPerformance);
      
      // Calculate performance change
      const historicalMean = this.calculateMean(historicalPerformance);
      const recentMean = this.calculateMean(recentPerformance);
      const performanceChange = (recentMean - historicalMean) / historicalMean;
      
      // Determine trend
      let trend: 'IMPROVING' | 'DEGRADING' | 'STABLE' = 'STABLE';
      if (Math.abs(performanceChange) > 0.05) {
        trend = performanceChange > 0 ? 'IMPROVING' : 'DEGRADING';
      }
      
      const result = {
        conceptDriftDetected: testResult.pValue < this.config.significanceLevel && Math.abs(performanceChange) > 0.1,
        driftScore: testResult.statistic,
        pValue: testResult.pValue,
        performanceChange,
        trend
      };
      
      const analysisTime = Date.now() - startTime;
      console.log(`⏱️  Concept drift analysis completed in ${analysisTime}ms`);
      console.log(`📊 Performance change: ${(performanceChange * 100).toFixed(2)}%`);
      console.log(`📈 Trend: ${trend}`);
      console.log(`🚨 Concept drift detected: ${result.conceptDriftDetected ? 'YES' : 'NO'}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Concept drift detection failed:', error);
      throw error;
    }
  }

  /**
   * Get drift analysis history
   */
  getDriftHistory(): DriftAnalysisResult[] {
    return [...this.driftHistory];
  }

  /**
   * Get recent drift trend
   */
  getDriftTrend(lookbackCount: number = 10): {
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    averageDriftScore: number;
    volatility: number;
  } {
    const recentResults = this.driftHistory.slice(-lookbackCount);
    if (recentResults.length < 2) {
      return { trend: 'STABLE', averageDriftScore: 0, volatility: 0 };
    }
    
    const scores = recentResults.map(r => r.overallDriftScore);
    const averageDriftScore = this.calculateMean(scores);
    const volatility = this.calculateStandardDeviation(scores);
    
    // Calculate trend using linear regression
    const trend = this.calculateTrend(scores);
    
    return {
      trend: Math.abs(trend) < 0.001 ? 'STABLE' : (trend > 0 ? 'INCREASING' : 'DECREASING'),
      averageDriftScore,
      volatility
    };
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  private async analyzeFeatureDrift(
    historical: number[],
    recent: number[],
    featureIdx: number,
    featureName: string
  ): Promise<DriftTestResult[]> {
    const results: DriftTestResult[] = [];
    
    for (const method of this.config.methods) {
      try {
        const testResult = await this.runDriftTest(method, historical, recent);
        
        results.push({
          method,
          featureIndex: featureIdx,
          featureName,
          statistic: testResult.statistic,
          pValue: testResult.pValue,
          threshold: this.config.threshold,
          isDrift: testResult.pValue < this.config.significanceLevel,
          confidence: 1 - testResult.pValue,
          description: this.getTestDescription(method, testResult)
        });
        
      } catch (error) {
        console.warn(`⚠️  Drift test ${method} failed for feature ${featureName}:`, error);
      }
    }
    
    return results;
  }

  private async runDriftTest(
    method: DriftDetectionMethod,
    historical: number[],
    recent: number[]
  ): Promise<{ statistic: number; pValue: number }> {
    switch (method) {
      case 'KOLMOGOROV_SMIRNOV':
        return this.kolmogorovSmirnovTest(historical, recent);
        
      case 'POPULATION_STABILITY_INDEX':
        return this.populationStabilityIndex(historical, recent);
        
      case 'EARTH_MOVERS_DISTANCE':
        return this.earthMoversDistance(historical, recent);
        
      case 'CHI_SQUARE':
        return this.chiSquareTest(historical, recent);
        
      case 'KL_DIVERGENCE':
        return this.klDivergence(historical, recent);
        
      case 'JENSEN_SHANNON':
        return this.jensenShannonDivergence(historical, recent);
        
      case 'ANDERSON_DARLING':
        return this.andersonDarlingTest(historical, recent);
        
      case 'MANNWHITNEY_U':
        return this.mannWhitneyUTest(historical, recent);
        
      default:
        throw new Error(`Unknown drift detection method: ${method}`);
    }
  }

  private async kolmogorovSmirnovTest(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    // Sort samples
    const sorted1 = [...sample1].sort((a, b) => a - b);
    const sorted2 = [...sample2].sort((a, b) => a - b);
    
    const n1 = sorted1.length;
    const n2 = sorted2.length;
    
    // Calculate empirical CDFs and find maximum difference
    let maxDiff = 0;
    let i = 0, j = 0;
    
    while (i < n1 && j < n2) {
      const cdf1 = (i + 1) / n1;
      const cdf2 = (j + 1) / n2;
      
      maxDiff = Math.max(maxDiff, Math.abs(cdf1 - cdf2));
      
      if (sorted1[i] <= sorted2[j]) {
        i++;
      } else {
        j++;
      }
    }
    
    // Calculate KS statistic
    const ksStatistic = maxDiff;
    
    // Calculate p-value (approximation)
    const effectiveN = (n1 * n2) / (n1 + n2);
    const lambda = ksStatistic * Math.sqrt(effectiveN);
    const pValue = 2 * Math.exp(-2 * lambda * lambda);
    
    return { statistic: ksStatistic, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private async populationStabilityIndex(expected: number[], actual: number[]): Promise<{ statistic: number; pValue: number }> {
    const numBins = Math.min(10, Math.floor(Math.sqrt(Math.min(expected.length, actual.length))));
    
    // Calculate quantiles for binning
    const allValues = [...expected, ...actual].sort((a, b) => a - b);
    const quantiles = [];
    for (let i = 0; i <= numBins; i++) {
      const index = Math.floor((i / numBins) * (allValues.length - 1));
      quantiles.push(allValues[index]);
    }
    
    // Calculate bin counts
    const expectedCounts = this.binData(expected, quantiles);
    const actualCounts = this.binData(actual, quantiles);
    
    // Calculate PSI
    let psi = 0;
    for (let i = 0; i < numBins; i++) {
      const expectedPct = (expectedCounts[i] + 1e-6) / expected.length; // Add small constant to avoid log(0)
      const actualPct = (actualCounts[i] + 1e-6) / actual.length;
      
      psi += (actualPct - expectedPct) * Math.log(actualPct / expectedPct);
    }
    
    // Convert PSI to p-value (heuristic)
    const pValue = Math.exp(-psi);
    
    return { statistic: psi, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private async earthMoversDistance(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    // Sort samples
    const sorted1 = [...sample1].sort((a, b) => a - b);
    const sorted2 = [...sample2].sort((a, b) => a - b);
    
    const n1 = sorted1.length;
    const n2 = sorted2.length;
    
    // Calculate EMD using cumulative differences
    let emd = 0;
    let cdf1 = 0, cdf2 = 0;
    let i = 0, j = 0;
    
    while (i < n1 || j < n2) {
      const val1 = i < n1 ? sorted1[i] : Infinity;
      const val2 = j < n2 ? sorted2[j] : Infinity;
      
      if (val1 <= val2) {
        cdf1 += 1 / n1;
        i++;
      } else {
        cdf2 += 1 / n2;
        j++;
      }
      
      emd += Math.abs(cdf1 - cdf2);
    }
    
    // Normalize EMD
    const normalizedEMD = emd / Math.max(n1, n2);
    
    // Convert to p-value (heuristic based on distribution)
    const pValue = Math.exp(-normalizedEMD * 5);
    
    return { statistic: normalizedEMD, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private async chiSquareTest(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    const numBins = Math.min(10, Math.floor(Math.sqrt(Math.min(sample1.length, sample2.length))));
    
    // Calculate bin boundaries
    const allValues = [...sample1, ...sample2].sort((a, b) => a - b);
    const min = allValues[0];
    const max = allValues[allValues.length - 1];
    const binWidth = (max - min) / numBins;
    
    const bins = [];
    for (let i = 0; i <= numBins; i++) {
      bins.push(min + i * binWidth);
    }
    
    // Calculate observed and expected frequencies
    const observed1 = this.binData(sample1, bins);
    const observed2 = this.binData(sample2, bins);
    
    const total1 = sample1.length;
    const total2 = sample2.length;
    const totalCombined = total1 + total2;
    
    let chiSquare = 0;
    let degreesOfFreedom = 0;
    
    for (let i = 0; i < numBins; i++) {
      const expected1 = (observed1[i] + observed2[i]) * total1 / totalCombined;
      const expected2 = (observed1[i] + observed2[i]) * total2 / totalCombined;
      
      if (expected1 > 5 && expected2 > 5) { // Chi-square test validity condition
        chiSquare += Math.pow(observed1[i] - expected1, 2) / expected1;
        chiSquare += Math.pow(observed2[i] - expected2, 2) / expected2;
        degreesOfFreedom++;
      }
    }
    
    // Calculate p-value (approximation using chi-square distribution)
    const pValue = this.chiSquarePValue(chiSquare, degreesOfFreedom);
    
    return { statistic: chiSquare, pValue };
  }

  private async klDivergence(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    const numBins = 20;
    
    // Calculate histograms
    const allValues = [...sample1, ...sample2].sort((a, b) => a - b);
    const min = allValues[0];
    const max = allValues[allValues.length - 1];
    const binWidth = (max - min) / numBins;
    
    const bins = [];
    for (let i = 0; i <= numBins; i++) {
      bins.push(min + i * binWidth);
    }
    
    const counts1 = this.binData(sample1, bins);
    const counts2 = this.binData(sample2, bins);
    
    // Convert to probabilities
    const p = counts1.map(count => (count + 1e-10) / sample1.length); // Add small constant
    const q = counts2.map(count => (count + 1e-10) / sample2.length);
    
    // Calculate KL divergence
    let kl = 0;
    for (let i = 0; i < numBins; i++) {
      if (p[i] > 0 && q[i] > 0) {
        kl += p[i] * Math.log(p[i] / q[i]);
      }
    }
    
    // Convert to p-value (heuristic)
    const pValue = Math.exp(-kl);
    
    return { statistic: kl, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private async jensenShannonDivergence(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    // Calculate KL divergences
    const kl1 = await this.klDivergence(sample1, sample2);
    const kl2 = await this.klDivergence(sample2, sample1);
    
    // Jensen-Shannon divergence is symmetric
    const js = 0.5 * (kl1.statistic + kl2.statistic);
    const pValue = Math.exp(-js);
    
    return { statistic: js, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private async andersonDarlingTest(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    // Simplified Anderson-Darling test implementation
    // In practice, would use a proper statistical library
    const combined = [...sample1, ...sample2].sort((a, b) => a - b);
    const n1 = sample1.length;
    const n2 = sample2.length;
    const N = n1 + n2;
    
    let adStatistic = 0;
    
    for (let i = 0; i < N; i++) {
      const value = combined[i];
      const f1 = sample1.filter(x => x <= value).length / n1;
      const f2 = sample2.filter(x => x <= value).length / n2;
      
      if (f1 > 0 && f1 < 1 && f2 > 0 && f2 < 1) {
        adStatistic += Math.pow(f1 - f2, 2) / (f1 * (1 - f1) + f2 * (1 - f2));
      }
    }
    
    adStatistic *= (n1 * n2) / (n1 + n2);
    
    // Convert to p-value (approximation)
    const pValue = Math.exp(-adStatistic / 2);
    
    return { statistic: adStatistic, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private async mannWhitneyUTest(sample1: number[], sample2: number[]): Promise<{ statistic: number; pValue: number }> {
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    // Combine and rank all values
    const combined = [...sample1.map(x => ({value: x, group: 1})), ...sample2.map(x => ({value: x, group: 2}))];
    combined.sort((a, b) => a.value - b.value);
    
    // Assign ranks (handle ties by using average ranks)
    const ranks: number[] = [];
    let i = 0;
    while (i < combined.length) {
      let j = i;
      while (j < combined.length && combined[j].value === combined[i].value) {
        j++;
      }
      const averageRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) {
        ranks[k] = averageRank;
      }
      i = j;
    }
    
    // Calculate U statistic
    let r1 = 0;
    for (let k = 0; k < combined.length; k++) {
      if (combined[k].group === 1) {
        r1 += ranks[k];
      }
    }
    
    const u1 = r1 - (n1 * (n1 + 1)) / 2;
    const u2 = n1 * n2 - u1;
    const uStatistic = Math.min(u1, u2);
    
    // Calculate z-score and p-value
    const meanU = (n1 * n2) / 2;
    const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const zScore = (uStatistic - meanU) / stdU;
    
    // Two-tailed p-value
    const pValue = 2 * (1 - this.standardNormalCDF(Math.abs(zScore)));
    
    return { statistic: uStatistic, pValue: Math.max(0, Math.min(1, pValue)) };
  }

  private binData(data: number[], bins: number[]): number[] {
    const counts = new Array(bins.length - 1).fill(0);
    
    for (const value of data) {
      for (let i = 0; i < bins.length - 1; i++) {
        if (value >= bins[i] && value < bins[i + 1]) {
          counts[i]++;
          break;
        }
      }
    }
    
    return counts;
  }

  private combineTestResults(driftScores: number[], testResults: DriftTestResult[]): number {
    if (driftScores.length === 0) return 0;
    
    // Weighted average based on confidence levels
    const weights = testResults.map(r => r.confidence);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    if (totalWeight === 0) return Math.max(...driftScores);
    
    let weightedSum = 0;
    for (let i = 0; i < driftScores.length; i++) {
      weightedSum += driftScores[i] * weights[i];
    }
    
    return weightedSum / totalWeight;
  }

  private calculateOverallDriftScore(featureScores: number[], significantFeatures: number[]): number {
    if (featureScores.length === 0) return 0;
    
    // Weight significant features more heavily
    let totalScore = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < featureScores.length; i++) {
      const weight = significantFeatures.includes(i) ? 2.0 : 1.0;
      totalScore += featureScores[i] * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private async analyzeCorrelationDrift(historical: number[][], recent: number[][]): Promise<number> {
    if (historical[0].length < 2) return 0; // Need at least 2 features for correlation
    
    try {
      const historicalCorr = this.calculateCorrelationMatrix(historical);
      const recentCorr = this.calculateCorrelationMatrix(recent);
      
      // Calculate Frobenius norm of difference
      let sumSquaredDiff = 0;
      let count = 0;
      
      for (let i = 0; i < historicalCorr.length; i++) {
        for (let j = i + 1; j < historicalCorr[i].length; j++) {
          const diff = historicalCorr[i][j] - recentCorr[i][j];
          sumSquaredDiff += diff * diff;
          count++;
        }
      }
      
      return count > 0 ? Math.sqrt(sumSquaredDiff / count) : 0;
      
    } catch (error) {
      console.warn('⚠️  Correlation drift analysis failed:', error);
      return 0;
    }
  }

  private analyzeDistributionChange(
    historical: number[],
    recent: number[],
    featureIdx: number,
    featureName: string
  ): DistributionChange {
    const histMean = this.calculateMean(historical);
    const recentMean = this.calculateMean(recent);
    const meanShift = recentMean - histMean;
    
    const histVar = this.calculateVariance(historical);
    const recentVar = this.calculateVariance(recent);
    const varianceRatio = recentVar / (histVar || 1e-10);
    
    const histSkewness = this.calculateSkewness(historical);
    const recentSkewness = this.calculateSkewness(recent);
    const skewnessChange = recentSkewness - histSkewness;
    
    const histKurtosis = this.calculateKurtosis(historical);
    const recentKurtosis = this.calculateKurtosis(recent);
    const kurtosisChange = recentKurtosis - histKurtosis;
    
    // Calculate quantile shifts
    const quantiles = [0.25, 0.5, 0.75];
    const quantileShifts = quantiles.map(q => {
      const histQuantile = this.calculateQuantile(historical, q);
      const recentQuantile = this.calculateQuantile(recent, q);
      return recentQuantile - histQuantile;
    });
    
    return {
      featureIndex: featureIdx,
      featureName,
      meanShift,
      varianceRatio,
      skewnessChange,
      kurtosisChange,
      quantileShifts
    };
  }

  private determineSeverity(
    overallScore: number,
    significantFeaturesCount: number,
    totalFeatures: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const significantRatio = significantFeaturesCount / totalFeatures;
    
    if (overallScore > 0.5 || significantRatio > 0.5) {
      return 'CRITICAL';
    } else if (overallScore > 0.2 || significantRatio > 0.3) {
      return 'HIGH';
    } else if (overallScore > 0.1 || significantRatio > 0.1) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private generateRecommendations(
    overallScore: number,
    significantFeatures: number[],
    distributionChanges: DistributionChange[],
    testResults: DriftTestResult[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (overallScore > 0.2) {
      recommendations.push('Consider retraining the model with recent data');
    }
    
    if (significantFeatures.length > 0) {
      recommendations.push(`Focus on features: ${significantFeatures.slice(0, 5).join(', ')}`);
    }
    
    const largeMeanShifts = distributionChanges.filter(dc => Math.abs(dc.meanShift) > 2);
    if (largeMeanShifts.length > 0) {
      recommendations.push('Large mean shifts detected - check data preprocessing');
    }
    
    const largeVarianceChanges = distributionChanges.filter(dc => dc.varianceRatio > 2 || dc.varianceRatio < 0.5);
    if (largeVarianceChanges.length > 0) {
      recommendations.push('Significant variance changes detected - review data quality');
    }
    
    const failedTests = testResults.filter(tr => tr.isDrift);
    if (failedTests.length > testResults.length / 2) {
      recommendations.push('Multiple drift tests failed - investigate data source changes');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('No immediate action required - continue monitoring');
    }
    
    return recommendations;
  }

  // Statistical utility functions
  private calculateMean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  private calculateVariance(data: number[]): number {
    const mean = this.calculateMean(data);
    return data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (data.length - 1);
  }

  private calculateStandardDeviation(data: number[]): number {
    return Math.sqrt(this.calculateVariance(data));
  }

  private calculateSkewness(data: number[]): number {
    const mean = this.calculateMean(data);
    const std = this.calculateStandardDeviation(data);
    const n = data.length;
    
    const sumCubes = data.reduce((sum, x) => sum + Math.pow((x - mean) / std, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sumCubes;
  }

  private calculateKurtosis(data: number[]): number {
    const mean = this.calculateMean(data);
    const std = this.calculateStandardDeviation(data);
    const n = data.length;
    
    const sumFourths = data.reduce((sum, x) => sum + Math.pow((x - mean) / std, 4), 0);
    const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sumFourths;
    return kurtosis - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  }

  private calculateQuantile(data: number[], q: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (sorted.length - 1) * q;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  private calculateCorrelationMatrix(data: number[][]): number[][] {
    const numFeatures = data[0].length;
    const matrix: number[][] = [];
    
    for (let i = 0; i < numFeatures; i++) {
      matrix[i] = [];
      for (let j = 0; j < numFeatures; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const feature1 = data.map(row => row[i]);
          const feature2 = data.map(row => row[j]);
          matrix[i][j] = this.calculateCorrelation(feature1, feature2);
        }
      }
    }
    
    return matrix;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);
    
    let numerator = 0;
    let sumXX = 0;
    let sumYY = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumXX += dx * dx;
      sumYY += dy * dy;
    }
    
    const denominator = Math.sqrt(sumXX * sumYY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    
    const meanX = (n - 1) / 2;
    const meanY = this.calculateMean(values);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = i - meanX;
      const dy = values[i] - meanY;
      numerator += dx * dy;
      denominator += dx * dx;
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private standardNormalCDF(z: number): number {
    // Approximation of standard normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const polynomial = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + 1.330274429 * t))));
    const standardNormalDensity = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    
    if (z >= 0) {
      return 1 - standardNormalDensity * polynomial;
    } else {
      return standardNormalDensity * polynomial;
    }
  }

  private chiSquarePValue(chiSquare: number, df: number): number {
    // Simplified chi-square p-value calculation
    // In practice, would use a proper statistical library
    if (df <= 0) return 1;
    
    // Use gamma function approximation
    const gamma = this.gammaFunction(df / 2);
    const term1 = Math.pow(2, df / 2) * gamma;
    const term2 = Math.pow(chiSquare, df / 2 - 1) * Math.exp(-chiSquare / 2);
    
    return Math.max(0, Math.min(1, 1 - term2 / term1));
  }

  private gammaFunction(z: number): number {
    // Stirling's approximation for gamma function
    if (z < 1) return this.gammaFunction(z + 1) / z;
    
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
               771.32342877765313, -176.61502916214059, 12.507343278686905,
               -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (z + i);
    }
    
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  private calculateConfidenceInterval(testResult: DriftTestResult): [number, number] {
    // Calculate 95% confidence interval for the test statistic
    const margin = 1.96 * Math.sqrt(testResult.statistic * (1 - testResult.statistic) / 100); // Simplified
    return [
      Math.max(0, testResult.statistic - margin),
      Math.min(1, testResult.statistic + margin)
    ];
  }

  private calculateEffectSize(sample1: number[], sample2: number[]): number {
    // Cohen's d effect size
    const mean1 = this.calculateMean(sample1);
    const mean2 = this.calculateMean(sample2);
    const var1 = this.calculateVariance(sample1);
    const var2 = this.calculateVariance(sample2);
    
    const pooledStd = Math.sqrt(((sample1.length - 1) * var1 + (sample2.length - 1) * var2) / 
                               (sample1.length + sample2.length - 2));
    
    return pooledStd === 0 ? 0 : (mean2 - mean1) / pooledStd;
  }

  private getTestDescription(method: DriftDetectionMethod, result: { statistic: number; pValue: number }): string {
    const descriptions = {
      'KOLMOGOROV_SMIRNOV': `KS test: D=${result.statistic.toFixed(4)}, p=${result.pValue.toFixed(4)}`,
      'POPULATION_STABILITY_INDEX': `PSI: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`,
      'EARTH_MOVERS_DISTANCE': `EMD: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`,
      'CHI_SQUARE': `Chi-square: χ²=${result.statistic.toFixed(4)}, p=${result.pValue.toFixed(4)}`,
      'KL_DIVERGENCE': `KL divergence: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`,
      'JENSEN_SHANNON': `JS divergence: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`,
      'ANDERSON_DARLING': `AD test: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`,
      'MANNWHITNEY_U': `Mann-Whitney U: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`
    };
    
    return descriptions[method] || `${method}: ${result.statistic.toFixed(4)} (p=${result.pValue.toFixed(4)})`;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.historicalWindows.length = 0;
    this.featureStatistics.clear();
    this.driftHistory.length = 0;
    this.statisticsCache.clear();
    this.analysisCache.clear();
    
    console.log('🧹 Drift Detector disposed');
  }
}

// Helper interface for feature statistics
interface FeatureStatistics {
  mean: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  quantiles: number[];
  histogram: number[];
}

// Default configuration
export const DEFAULT_DRIFT_DETECTOR_CONFIG: DriftDetectorConfig = {
  windowSize: 1000,
  threshold: 0.1,
  significanceLevel: 0.05,
  methods: [
    'KOLMOGOROV_SMIRNOV',
    'POPULATION_STABILITY_INDEX',
    'EARTH_MOVERS_DISTANCE'
  ],
  minSamples: 50,
  maxHistorySize: 10000,
  enableRealtimeDetection: true
};