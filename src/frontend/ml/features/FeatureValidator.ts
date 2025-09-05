/**
 * Feature Validation and Quality Monitoring - Task ML-002
 * 
 * Comprehensive feature quality assessment, outlier detection,
 * and data validation for ML feature engineering pipeline.
 */

import { 
  FeatureVector, 
  QualityReport, 
  QualityIssue, 
  MissingValueReport, 
  OutlierReport, 
  CorrelationMatrix, 
  ImportanceScores 
} from './types';

/**
 * Validation options and thresholds
 */
interface ValidationOptions {
  outlier_method?: 'iqr' | 'zscore' | 'isolation_forest';
  outlier_threshold?: number;
  correlation_threshold?: number;
  missing_threshold?: number;
  quality_threshold?: number;
  max_features?: number;
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  outlier_method: 'zscore',
  outlier_threshold: 3.0,
  correlation_threshold: 0.95,
  missing_threshold: 0.1, // 10% missing values threshold
  quality_threshold: 0.7,
  max_features: 100
};

/**
 * Feature quality validation and monitoring system
 */
export class FeatureValidator {
  private options: ValidationOptions;
  private qualityHistory: Map<string, number[]> = new Map();

  constructor(options: Partial<ValidationOptions> = {}) {
    this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  }

  /**
   * Comprehensive data quality validation
   */
  validateDataQuality(features: FeatureVector): QualityReport {
    const issues: QualityIssue[] = [];
    const recommendations: string[] = [];
    
    try {
      // Extract numeric features
      const featureValues = this.extractNumericFeatures(features);
      const featureNames = Object.keys(featureValues);
      
      if (featureNames.length === 0) {
        return {
          overall_score: 0,
          issues: [{
            type: 'missing_values',
            severity: 'high',
            description: 'No valid features found',
            affected_features: [],
            suggested_action: 'Check feature computation pipeline'
          }],
          recommendations: ['Verify feature calculation methods'],
          data_coverage: 0,
          freshness_score: 0
        };
      }

      // Missing value analysis
      const missingValueReport = this.detectMissingValues(features);
      if (missingValueReport.missing_percentage > this.options.missing_threshold! * 100) {
        issues.push({
          type: 'missing_values',
          severity: 'high',
          description: `${missingValueReport.missing_percentage.toFixed(1)}% of features have missing values`,
          affected_features: missingValueReport.missing_features,
          suggested_action: 'Implement feature imputation or improve data collection'
        });
        recommendations.push('Consider using feature imputation methods');
      }

      // Outlier detection
      const outlierReport = this.detectOutliers(features);
      if (outlierReport.outlier_percentage > 0.1) {
        const severity = outlierReport.outlier_percentage > 0.3 ? 'high' : 'medium';
        issues.push({
          type: 'outliers',
          severity,
          description: `${(outlierReport.outlier_percentage * 100).toFixed(1)}% of feature values are outliers`,
          affected_features: outlierReport.outlier_features,
          suggested_action: 'Consider outlier treatment or feature normalization'
        });
        recommendations.push('Apply outlier detection and treatment');
      }

      // Data freshness check
      const freshness = this.calculateFreshness(features);
      if (freshness < 0.5) {
        issues.push({
          type: 'stale_data',
          severity: 'medium',
          description: 'Feature data may be stale or outdated',
          affected_features: ['timestamp'],
          suggested_action: 'Verify data pipeline and update frequency'
        });
      }

      // Feature distribution analysis
      const distributionIssues = this.analyzeFeatureDistributions(featureValues);
      issues.push(...distributionIssues);

      // Calculate overall quality score
      const overallScore = this.calculateOverallQuality(
        missingValueReport,
        outlierReport,
        freshness,
        issues
      );

      // Generate recommendations based on issues
      if (issues.length === 0) {
        recommendations.push('Feature quality is good - continue monitoring');
      }

      return {
        overall_score: overallScore,
        issues,
        recommendations,
        data_coverage: 1 - (missingValueReport.missing_percentage / 100),
        freshness_score: freshness
      };

    } catch (error) {
      console.error('[FeatureValidator] Error in quality validation:', error);
      return {
        overall_score: 0,
        issues: [{
          type: 'missing_values',
          severity: 'high',
          description: 'Validation process failed',
          affected_features: [],
          suggested_action: 'Check validation configuration and data format'
        }],
        recommendations: ['Debug validation process'],
        data_coverage: 0,
        freshness_score: 0
      };
    }
  }

  /**
   * Detect missing values in feature vector
   */
  detectMissingValues(features: FeatureVector): MissingValueReport {
    const allFeatures = this.extractNumericFeatures(features);
    const featureNames = Object.keys(allFeatures);
    const missingFeatures: string[] = [];
    let consecutiveMissing = 0;
    let currentConsecutive = 0;

    for (const name of featureNames) {
      const value = allFeatures[name];
      
      if (value === null || value === undefined || !isFinite(value)) {
        missingFeatures.push(name);
        currentConsecutive++;
      } else {
        consecutiveMissing = Math.max(consecutiveMissing, currentConsecutive);
        currentConsecutive = 0;
      }
    }

    consecutiveMissing = Math.max(consecutiveMissing, currentConsecutive);
    const missingPercentage = (missingFeatures.length / featureNames.length) * 100;
    
    let impact: 'low' | 'medium' | 'high';
    if (missingPercentage < 5) impact = 'low';
    else if (missingPercentage < 20) impact = 'medium';
    else impact = 'high';

    return {
      total_features: featureNames.length,
      missing_features: missingFeatures,
      missing_percentage: missingPercentage,
      consecutive_missing: consecutiveMissing,
      impact_assessment: impact
    };
  }

  /**
   * Detect outliers in feature values
   */
  detectOutliers(features: FeatureVector): OutlierReport {
    const featureValues = this.extractNumericFeatures(features);
    const featureNames = Object.keys(featureValues);
    const outlierFeatures: string[] = [];
    const outlierValues: Record<string, number[]> = {};
    const severityDistribution: Record<'low' | 'medium' | 'high', number> = {
      low: 0,
      medium: 0,
      high: 0
    };

    for (const name of featureNames) {
      const value = featureValues[name];
      
      if (!isFinite(value)) continue;

      // Get historical values for this feature
      const history = this.qualityHistory.get(name) || [];
      
      if (history.length < 10) {
        // Not enough history, add current value
        history.push(value);
        this.qualityHistory.set(name, history.slice(-50)); // Keep last 50 values
        continue;
      }

      const isOutlier = this.isOutlier(value, history, this.options.outlier_method!);
      
      if (isOutlier) {
        outlierFeatures.push(name);
        outlierValues[name] = [value];
        
        // Classify severity based on how extreme the outlier is
        const severity = this.classifyOutlierSeverity(value, history);
        severityDistribution[severity]++;
      }

      // Update history
      history.push(value);
      this.qualityHistory.set(name, history.slice(-50));
    }

    return {
      outlier_features: outlierFeatures,
      outlier_values: outlierValues,
      detection_method: this.options.outlier_method!,
      outlier_percentage: outlierFeatures.length / featureNames.length,
      severity_distribution: severityDistribution
    };
  }

  /**
   * Analyze correlations between features
   */
  analyzeCorrelations(features: FeatureVector[]): CorrelationMatrix {
    if (features.length < 10) {
      return {
        features: [],
        matrix: [],
        high_correlations: [],
        redundant_features: []
      };
    }

    // Extract feature matrices
    const featureMatrix = this.buildFeatureMatrix(features);
    const featureNames = Object.keys(featureMatrix);
    const correlationMatrix = this.calculateCorrelationMatrix(featureMatrix);
    
    // Find high correlations
    const highCorrelations: Array<{
      feature1: string;
      feature2: string;
      correlation: number;
      significance: number;
    }> = [];

    const redundantFeatures: string[] = [];
    const threshold = this.options.correlation_threshold || 0.95;

    for (let i = 0; i < featureNames.length; i++) {
      for (let j = i + 1; j < featureNames.length; j++) {
        const correlation = Math.abs(correlationMatrix[i][j]);
        
        if (correlation > threshold) {
          highCorrelations.push({
            feature1: featureNames[i],
            feature2: featureNames[j],
            correlation,
            significance: this.calculateCorrelationSignificance(correlation, features.length)
          });
          
          // Mark the second feature as potentially redundant
          if (!redundantFeatures.includes(featureNames[j])) {
            redundantFeatures.push(featureNames[j]);
          }
        }
      }
    }

    return {
      features: featureNames,
      matrix: correlationMatrix,
      high_correlations: highCorrelations,
      redundant_features: redundantFeatures
    };
  }

  /**
   * Calculate feature importance scores
   */
  calculateFeatureImportance(features: FeatureVector[], targets: number[]): ImportanceScores {
    if (features.length !== targets.length || features.length < 10) {
      return {
        features: [],
        scores: [],
        ranking: [],
        method: 'correlation'
      };
    }

    const featureMatrix = this.buildFeatureMatrix(features);
    const featureNames = Object.keys(featureMatrix);
    const scores: number[] = [];

    // Calculate correlation-based importance
    for (const featureName of featureNames) {
      const featureValues = featureMatrix[featureName];
      const correlation = this.calculateCorrelation(featureValues, targets);
      scores.push(Math.abs(correlation));
    }

    // Create ranking
    const ranking = featureNames
      .map((name, index) => ({ feature: name, score: scores[index], rank: 0 }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      features: featureNames,
      scores,
      ranking,
      method: 'correlation'
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private extractNumericFeatures(features: FeatureVector): Record<string, number> {
    const numericFeatures: Record<string, number> = {};
    
    // Extract from technical features
    if (features.technical) {
      for (const [key, value] of Object.entries(features.technical)) {
        if (typeof value === 'number') {
          numericFeatures[`tech_${key}`] = value;
        }
      }
    }
    
    // Extract from price features
    if (features.price) {
      for (const [key, value] of Object.entries(features.price)) {
        if (typeof value === 'number') {
          numericFeatures[`price_${key}`] = value;
        }
      }
    }
    
    // Extract from volume features
    if (features.volume) {
      for (const [key, value] of Object.entries(features.volume)) {
        if (typeof value === 'number') {
          numericFeatures[`volume_${key}`] = value;
        }
      }
    }
    
    // Extract from market structure features
    if (features.market_structure) {
      for (const [key, value] of Object.entries(features.market_structure)) {
        if (typeof value === 'number') {
          numericFeatures[`market_${key}`] = value;
        }
      }
    }
    
    return numericFeatures;
  }

  private isOutlier(value: number, history: number[], method: 'iqr' | 'zscore' | 'isolation_forest'): boolean {
    switch (method) {
      case 'zscore':
        return this.isZScoreOutlier(value, history);
      case 'iqr':
        return this.isIQROutlier(value, history);
      case 'isolation_forest':
        // Simplified isolation forest - in practice would use proper implementation
        return this.isZScoreOutlier(value, history); 
      default:
        return false;
    }
  }

  private isZScoreOutlier(value: number, history: number[]): boolean {
    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const std = Math.sqrt(history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length);
    
    if (std === 0) return false;
    
    const zScore = Math.abs(value - mean) / std;
    return zScore > (this.options.outlier_threshold || 3.0);
  }

  private isIQROutlier(value: number, history: number[]): boolean {
    const sorted = [...history].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return value < lowerBound || value > upperBound;
  }

  private classifyOutlierSeverity(value: number, history: number[]): 'low' | 'medium' | 'high' {
    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const std = Math.sqrt(history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length);
    
    if (std === 0) return 'low';
    
    const zScore = Math.abs(value - mean) / std;
    
    if (zScore > 5) return 'high';
    if (zScore > 3.5) return 'medium';
    return 'low';
  }

  private calculateFreshness(features: FeatureVector): number {
    const now = new Date();
    const featureTime = new Date(features.timestamp);
    const ageMinutes = (now.getTime() - featureTime.getTime()) / (1000 * 60);
    
    // Freshness score decreases with age
    if (ageMinutes < 5) return 1.0;      // Very fresh
    if (ageMinutes < 15) return 0.8;     // Fresh  
    if (ageMinutes < 60) return 0.6;     // Acceptable
    if (ageMinutes < 240) return 0.4;    // Getting stale
    return 0.2; // Stale
  }

  private analyzeFeatureDistributions(featureValues: Record<string, number>): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    for (const [name, value] of Object.entries(featureValues)) {
      // Check for extreme values
      if (!isFinite(value)) {
        issues.push({
          type: 'distribution',
          severity: 'high',
          description: `Feature ${name} has non-finite value`,
          affected_features: [name],
          suggested_action: 'Check feature calculation and handle edge cases'
        });
      }
      
      // Check for constant features (if we had history)
      const history = this.qualityHistory.get(name);
      if (history && history.length > 10) {
        const variance = this.calculateVariance(history);
        if (variance < 1e-10) {
          issues.push({
            type: 'distribution',
            severity: 'medium',
            description: `Feature ${name} shows no variation`,
            affected_features: [name],
            suggested_action: 'Consider removing constant features'
          });
        }
      }
    }
    
    return issues;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private calculateOverallQuality(
    missingReport: MissingValueReport,
    outlierReport: OutlierReport,
    freshness: number,
    issues: QualityIssue[]
  ): number {
    // Weighted quality score
    const completeness = 1 - (missingReport.missing_percentage / 100);
    const outlierScore = 1 - outlierReport.outlier_percentage;
    const issueScore = Math.max(0, 1 - (issues.length * 0.1));
    
    return (completeness * 0.3 + outlierScore * 0.3 + freshness * 0.2 + issueScore * 0.2);
  }

  private buildFeatureMatrix(features: FeatureVector[]): Record<string, number[]> {
    const matrix: Record<string, number[]> = {};
    
    for (const feature of features) {
      const numericFeatures = this.extractNumericFeatures(feature);
      
      for (const [name, value] of Object.entries(numericFeatures)) {
        if (!matrix[name]) {
          matrix[name] = [];
        }
        matrix[name].push(value);
      }
    }
    
    return matrix;
  }

  private calculateCorrelationMatrix(featureMatrix: Record<string, number[]>): number[][] {
    const featureNames = Object.keys(featureMatrix);
    const n = featureNames.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.calculateCorrelation(
            featureMatrix[featureNames[i]],
            featureMatrix[featureNames[j]]
          );
        }
      }
    }
    
    return matrix;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateCorrelationSignificance(correlation: number, sampleSize: number): number {
    // Simplified significance test
    if (sampleSize < 3) return 0;
    
    const t = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    // Return normalized significance (0-1)
    return Math.min(1, Math.abs(t) / 10);
  }
}