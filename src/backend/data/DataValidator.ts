/**
 * Data Validation and Integrity Utilities - Task BE-008: Strategy Data Structures
 * 
 * Comprehensive data validation, integrity checks, and quality assurance
 * utilities for market data and trading operations. Ensures data consistency
 * and catches corruption early in the pipeline.
 * 
 * Performance Targets:
 * - Validation speed: >100,000 records/second
 * - Memory efficiency: Streaming validation for large datasets
 * - Zero false positives for valid data
 */

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export interface ValidationRule<T> {
  name: string;
  description: string;
  validate: (value: T, context?: any) => ValidationResult;
  severity: 'error' | 'warning' | 'info';
  category: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, any>;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
  context?: any;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  value?: any;
  suggestion?: string;
}

export interface DataQualityReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  qualityScore: number; // 0-100
  errorSummary: Record<string, number>;
  warningSummary: Record<string, number>;
  fieldStatistics: Record<string, FieldStatistics>;
  recommendations: string[];
  executionTime: number;
}

export interface FieldStatistics {
  fieldName: string;
  totalValues: number;
  nullCount: number;
  uniqueCount: number;
  duplicateCount: number;
  minValue?: number;
  maxValue?: number;
  meanValue?: number;
  stdDeviation?: number;
  dataType: 'number' | 'string' | 'boolean' | 'date' | 'object' | 'array';
  pattern?: string;
  outliers: number[];
}

// =============================================================================
// CORE VALIDATION ENGINE
// =============================================================================

/**
 * High-performance data validation engine with rule-based validation
 */
export class DataValidationEngine<T> {
  private rules: Map<string, ValidationRule<T>> = new Map();
  private ruleCategories: Map<string, ValidationRule<T>[]> = new Map();
  private validationCache = new Map<string, ValidationResult>();
  private cacheEnabled = true;
  private maxCacheSize = 10000;

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Add validation rule
   */
  addRule(rule: ValidationRule<T>): void {
    this.rules.set(rule.name, rule);
    
    // Organize by category
    if (!this.ruleCategories.has(rule.category)) {
      this.ruleCategories.set(rule.category, []);
    }
    this.ruleCategories.get(rule.category)!.push(rule);
  }

  /**
   * Remove validation rule
   */
  removeRule(ruleName: string): boolean {
    const rule = this.rules.get(ruleName);
    if (!rule) return false;

    this.rules.delete(ruleName);
    
    // Remove from category
    const categoryRules = this.ruleCategories.get(rule.category);
    if (categoryRules) {
      const index = categoryRules.findIndex(r => r.name === ruleName);
      if (index >= 0) {
        categoryRules.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * Validate single value against all rules
   */
  validate(value: T, context?: any): ValidationResult {
    const cacheKey = this.cacheEnabled ? this.generateCacheKey(value, context) : null;
    
    // Check cache first
    if (cacheKey && this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        rulesApplied: [],
        executionTime: 0
      }
    };

    const startTime = Date.now();

    // Apply all rules
    for (const rule of Array.from(this.rules.values())) {
      try {
        const ruleResult = rule.validate(value, context);
        
        result.errors.push(...ruleResult.errors);
        result.warnings.push(...ruleResult.warnings);
        result.metadata!.rulesApplied.push(rule.name);
        
        if (!ruleResult.isValid && rule.severity === 'error') {
          result.isValid = false;
        }
      } catch (error) {
        result.errors.push({
          code: 'RULE_EXECUTION_ERROR',
          message: `Rule '${rule.name}' failed to execute: ${error}`,
          severity: 'error'
        });
        result.isValid = false;
      }
    }

    result.metadata!.executionTime = Date.now() - startTime;

    // Cache result
    if (cacheKey) {
      this.cacheResult(cacheKey, result);
    }

    return result;
  }

  /**
   * Validate array of values with streaming support
   */
  async validateBatch(
    values: T[],
    options: {
      batchSize?: number;
      parallel?: boolean;
      stopOnFirstError?: boolean;
      context?: any;
    } = {}
  ): Promise<{
    results: ValidationResult[];
    summary: DataQualityReport;
  }> {
    const { batchSize = 1000, parallel = false, stopOnFirstError = false, context } = options;
    const startTime = Date.now();
    
    const results: ValidationResult[] = [];
    const errorSummary: Record<string, number> = {};
    const warningSummary: Record<string, number> = {};
    
    let validCount = 0;
    let invalidCount = 0;

    if (parallel && values.length > batchSize) {
      // Process in parallel batches
      const batches: T[][] = [];
      for (let i = 0; i < values.length; i += batchSize) {
        batches.push(values.slice(i, i + batchSize));
      }

      const batchPromises = batches.map(batch =>
        Promise.all(batch.map(value => this.validate(value, context)))
      );

      const batchResults = await Promise.all(batchPromises);
      
      for (const batchResult of batchResults) {
        results.push(...batchResult);
        
        for (const result of batchResult) {
          if (result.isValid) {
            validCount++;
          } else {
            invalidCount++;
            if (stopOnFirstError) break;
          }
          
          // Count errors and warnings
          for (const error of result.errors) {
            errorSummary[error.code] = (errorSummary[error.code] || 0) + 1;
          }
          for (const warning of result.warnings) {
            warningSummary[warning.code] = (warningSummary[warning.code] || 0) + 1;
          }
        }
      }
    } else {
      // Sequential processing
      for (let i = 0; i < values.length; i++) {
        const result = this.validate(values[i], context);
        results.push(result);
        
        if (result.isValid) {
          validCount++;
        } else {
          invalidCount++;
          if (stopOnFirstError) break;
        }
        
        // Count errors and warnings
        for (const error of result.errors) {
          errorSummary[error.code] = (errorSummary[error.code] || 0) + 1;
        }
        for (const warning of result.warnings) {
          warningSummary[warning.code] = (warningSummary[warning.code] || 0) + 1;
        }
      }
    }

    const qualityScore = values.length > 0 ? (validCount / values.length) * 100 : 100;
    const executionTime = Date.now() - startTime;

    const summary: DataQualityReport = {
      totalRecords: values.length,
      validRecords: validCount,
      invalidRecords: invalidCount,
      qualityScore,
      errorSummary,
      warningSummary,
      fieldStatistics: {},
      recommendations: this.generateRecommendations(errorSummary, warningSummary),
      executionTime
    };

    return { results, summary };
  }

  /**
   * Validate specific category of rules only
   */
  validateCategory(value: T, category: string, context?: any): ValidationResult {
    const categoryRules = this.ruleCategories.get(category) || [];
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: { rulesApplied: [] }
    };

    for (const rule of categoryRules) {
      const ruleResult = rule.validate(value, context);
      
      result.errors.push(...ruleResult.errors);
      result.warnings.push(...ruleResult.warnings);
      result.metadata!.rulesApplied.push(rule.name);
      
      if (!ruleResult.isValid && rule.severity === 'error') {
        result.isValid = false;
      }
    }

    return result;
  }

  private setupDefaultRules(): void {
    // Add common validation rules that can be applied generically
  }

  private generateCacheKey(value: T, context?: any): string {
    try {
      const valueStr = JSON.stringify(value);
      const contextStr = context ? JSON.stringify(context) : '';
      return `${valueStr}:${contextStr}`;
    } catch {
      return Math.random().toString(36);
    }
  }

  private cacheResult(key: string, result: ValidationResult): void {
    if (this.validationCache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }
    
    this.validationCache.set(key, result);
  }

  private generateRecommendations(
    errorSummary: Record<string, number>,
    warningSummary: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on error patterns
    if (errorSummary['INVALID_PRICE']) {
      recommendations.push('Check price data sources for negative or zero values');
    }
    
    if (errorSummary['INVALID_TIMESTAMP']) {
      recommendations.push('Verify timestamp format and ensure chronological ordering');
    }

    if (errorSummary['MISSING_REQUIRED_FIELD']) {
      recommendations.push('Review data pipeline for missing required fields');
    }

    // Add general recommendations
    const totalErrors = Object.values(errorSummary).reduce((sum, count) => sum + count, 0);
    if (totalErrors > 100) {
      recommendations.push('High error count detected - consider reviewing data sources');
    }

    return recommendations;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get validation statistics
   */
  getStatistics(): {
    totalRules: number;
    ruleCategories: string[];
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      totalRules: this.rules.size,
      ruleCategories: Array.from(this.ruleCategories.keys()),
      cacheSize: this.validationCache.size,
      cacheHitRate: 0 // Would need to track hits/misses for accurate calculation
    };
  }
}

// =============================================================================
// MARKET DATA SPECIFIC VALIDATORS
// =============================================================================

/**
 * Specialized validator for OHLCV market data
 */
export class OHLCVDataValidator extends DataValidationEngine<{
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  constructor() {
    super();
    this.setupOHLCVRules();
  }

  private setupOHLCVRules(): void {
    // Price validation rules
    this.addRule({
      name: 'positive-prices',
      description: 'All OHLC prices must be positive',
      category: 'price',
      severity: 'error',
      validate: (candle) => {
        const errors: ValidationError[] = [];
        
        if (candle.open <= 0) {
          errors.push({
            code: 'INVALID_PRICE',
            message: 'Open price must be positive',
            field: 'open',
            value: candle.open,
            severity: 'error'
          });
        }
        
        if (candle.high <= 0) {
          errors.push({
            code: 'INVALID_PRICE',
            message: 'High price must be positive',
            field: 'high',
            value: candle.high,
            severity: 'error'
          });
        }
        
        if (candle.low <= 0) {
          errors.push({
            code: 'INVALID_PRICE',
            message: 'Low price must be positive',
            field: 'low',
            value: candle.low,
            severity: 'error'
          });
        }
        
        if (candle.close <= 0) {
          errors.push({
            code: 'INVALID_PRICE',
            message: 'Close price must be positive',
            field: 'close',
            value: candle.close,
            severity: 'error'
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: []
        };
      }
    });

    // OHLC relationship validation
    this.addRule({
      name: 'ohlc-relationships',
      description: 'High >= max(O,C) and Low <= min(O,C)',
      category: 'price',
      severity: 'error',
      validate: (candle) => {
        const errors: ValidationError[] = [];
        const maxOC = Math.max(candle.open, candle.close);
        const minOC = Math.min(candle.open, candle.close);
        
        if (candle.high < maxOC) {
          errors.push({
            code: 'INVALID_HIGH',
            message: `High (${candle.high}) must be >= max(open, close) (${maxOC})`,
            field: 'high',
            value: candle.high,
            severity: 'error'
          });
        }
        
        if (candle.low > minOC) {
          errors.push({
            code: 'INVALID_LOW',
            message: `Low (${candle.low}) must be <= min(open, close) (${minOC})`,
            field: 'low',
            value: candle.low,
            severity: 'error'
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: []
        };
      }
    });

    // Volume validation
    this.addRule({
      name: 'non-negative-volume',
      description: 'Volume must be non-negative',
      category: 'volume',
      severity: 'error',
      validate: (candle) => {
        const errors: ValidationError[] = [];
        
        if (candle.volume < 0) {
          errors.push({
            code: 'INVALID_VOLUME',
            message: 'Volume must be non-negative',
            field: 'volume',
            value: candle.volume,
            severity: 'error'
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: []
        };
      }
    });

    // Timestamp validation
    this.addRule({
      name: 'valid-timestamp',
      description: 'Timestamp must be a valid Unix timestamp',
      category: 'timestamp',
      severity: 'error',
      validate: (candle) => {
        const errors: ValidationError[] = [];
        
        if (!Number.isInteger(candle.timestamp) || candle.timestamp <= 0) {
          errors.push({
            code: 'INVALID_TIMESTAMP',
            message: 'Timestamp must be a positive integer',
            field: 'timestamp',
            value: candle.timestamp,
            severity: 'error'
          });
        }
        
        // Check if timestamp is reasonable (not too far in past/future)
        const now = Date.now();
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        
        if (candle.timestamp > now + oneYearMs) {
          errors.push({
            code: 'FUTURE_TIMESTAMP',
            message: 'Timestamp is too far in the future',
            field: 'timestamp',
            value: candle.timestamp,
            severity: 'error'
          });
        }
        
        if (candle.timestamp < now - 10 * oneYearMs) {
          errors.push({
            code: 'OLD_TIMESTAMP',
            message: 'Timestamp is too far in the past',
            field: 'timestamp',
            value: candle.timestamp,
            severity: 'error'
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: []
        };
      }
    });

    // Price spike detection
    this.addRule({
      name: 'price-spike-detection',
      description: 'Detect abnormal price spikes',
      category: 'anomaly',
      severity: 'warning',
      validate: (candle, context) => {
        const warnings: ValidationWarning[] = [];
        
        if (context && context.previousCandle) {
          const prev = context.previousCandle;
          const changePercent = Math.abs(candle.close - prev.close) / prev.close * 100;
          
          // Flag large price movements as potential anomalies
          if (changePercent > 20) {
            warnings.push({
              code: 'PRICE_SPIKE',
              message: `Large price movement detected: ${changePercent.toFixed(2)}%`,
              field: 'close',
              value: candle.close,
              suggestion: 'Verify data source for potential errors'
            });
          }
        }

        return {
          isValid: true,
          errors: [],
          warnings
        };
      }
    });
  }

  /**
   * Validate time series for chronological ordering and gaps
   */
  validateTimeSeries(
    candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>,
    expectedInterval?: number
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (candles.length === 0) {
      return { isValid: true, errors, warnings };
    }

    // Check chronological ordering
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].timestamp <= candles[i - 1].timestamp) {
        errors.push({
          code: 'CHRONOLOGICAL_ORDER',
          message: `Timestamp at index ${i} is not greater than previous`,
          field: 'timestamp',
          value: candles[i].timestamp,
          severity: 'error'
        });
      }
    }

    // Check for gaps if expected interval is provided
    if (expectedInterval) {
      for (let i = 1; i < candles.length; i++) {
        const actualInterval = candles[i].timestamp - candles[i - 1].timestamp;
        const tolerance = expectedInterval * 0.1; // 10% tolerance
        
        if (Math.abs(actualInterval - expectedInterval) > tolerance) {
          const gapType = actualInterval > expectedInterval ? 'GAP' : 'OVERLAP';
          
          warnings.push({
            code: `TIME_${gapType}`,
            message: `Time ${gapType.toLowerCase()} detected: expected ${expectedInterval}ms, got ${actualInterval}ms`,
            field: 'timestamp',
            value: candles[i].timestamp,
            suggestion: 'Check for missing data or duplicate entries'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// =============================================================================
// DATA INTEGRITY CHECKER
// =============================================================================

/**
 * Comprehensive data integrity checker with checksums and corruption detection
 */
export class DataIntegrityChecker {
  /**
   * Calculate checksum for data array
   */
  static calculateChecksum(data: any[]): string {
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Verify data integrity using checksum
   */
  static verifyIntegrity(data: any[], expectedChecksum: string): boolean {
    const actualChecksum = this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }

  /**
   * Detect potential data corruption patterns
   */
  static detectCorruption(data: number[]): {
    corrupted: boolean;
    issues: Array<{
      type: string;
      description: string;
      indices: number[];
      severity: 'low' | 'medium' | 'high';
    }>;
  } {
    const issues: Array<{
      type: string;
      description: string;
      indices: number[];
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check for NaN values
    const nanIndices = data
      .map((val, idx) => ({ val, idx }))
      .filter(item => isNaN(item.val))
      .map(item => item.idx);
    
    if (nanIndices.length > 0) {
      issues.push({
        type: 'NAN_VALUES',
        description: 'NaN values detected in data',
        indices: nanIndices,
        severity: 'high'
      });
    }

    // Check for infinite values
    const infiniteIndices = data
      .map((val, idx) => ({ val, idx }))
      .filter(item => !isFinite(item.val))
      .map(item => item.idx);
    
    if (infiniteIndices.length > 0) {
      issues.push({
        type: 'INFINITE_VALUES',
        description: 'Infinite values detected in data',
        indices: infiniteIndices,
        severity: 'high'
      });
    }

    // Check for repeated values (potential stuck sensor)
    const repeatedIndices: number[] = [];
    let consecutiveCount = 1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i] === data[i - 1]) {
        consecutiveCount++;
      } else {
        if (consecutiveCount >= 10) { // Flag 10+ consecutive identical values
          for (let j = i - consecutiveCount; j < i; j++) {
            repeatedIndices.push(j);
          }
        }
        consecutiveCount = 1;
      }
    }
    
    if (repeatedIndices.length > 0) {
      issues.push({
        type: 'REPEATED_VALUES',
        description: 'Long sequences of identical values detected',
        indices: repeatedIndices,
        severity: 'medium'
      });
    }

    // Check for extreme outliers (beyond 6 standard deviations)
    const validData = data.filter(val => isFinite(val));
    if (validData.length > 10) {
      const mean = validData.reduce((sum, val) => sum + val, 0) / validData.length;
      const variance = validData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validData.length;
      const stdDev = Math.sqrt(variance);
      
      const outlierIndices = data
        .map((val, idx) => ({ val, idx }))
        .filter(item => Math.abs(item.val - mean) > 6 * stdDev)
        .map(item => item.idx);
      
      if (outlierIndices.length > 0) {
        issues.push({
          type: 'EXTREME_OUTLIERS',
          description: 'Values beyond 6 standard deviations detected',
          indices: outlierIndices,
          severity: 'medium'
        });
      }
    }

    return {
      corrupted: issues.some(issue => issue.severity === 'high'),
      issues
    };
  }

  /**
   * Generate data quality report
   */
  static generateQualityReport(data: any[]): {
    score: number;
    metrics: {
      completeness: number;
      consistency: number;
      accuracy: number;
      validity: number;
    };
    issues: string[];
    recommendations: string[];
  } {
    let completeness = 100;
    let consistency = 100;
    let accuracy = 100;
    let validity = 100;
    
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check completeness (missing values)
    const nullCount = data.filter(val => val === null || val === undefined).length;
    if (nullCount > 0) {
      completeness = Math.max(0, 100 - (nullCount / data.length) * 100);
      issues.push(`${nullCount} missing values detected`);
      recommendations.push('Review data collection process for missing values');
    }

    // Check consistency (data type consistency)
    const types = new Set(data.map(val => typeof val));
    if (types.size > 2) { // Allow for numbers and one other type (like null)
      consistency = Math.max(0, 100 - (types.size - 1) * 10);
      issues.push(`Inconsistent data types: ${Array.from(types).join(', ')}`);
      recommendations.push('Standardize data types in collection pipeline');
    }

    // Calculate overall score
    const score = (completeness + consistency + accuracy + validity) / 4;

    return {
      score,
      metrics: { completeness, consistency, accuracy, validity },
      issues,
      recommendations
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create OHLCV data validator
 */
export function createOHLCVValidator(): OHLCVDataValidator {
  return new OHLCVDataValidator();
}

/**
 * Create generic data validation engine
 */
export function createDataValidationEngine<T>(): DataValidationEngine<T> {
  return new DataValidationEngine<T>();
}

/**
 * Quick validation for common data types
 */
export function validateNumber(
  value: any,
  constraints: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (typeof value !== 'number' || !isFinite(value)) {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Value must be a finite number',
      value,
      severity: 'error'
    });
    
    return { isValid: false, errors, warnings: [] };
  }

  if (constraints.integer && !Number.isInteger(value)) {
    errors.push({
      code: 'NOT_INTEGER',
      message: 'Value must be an integer',
      value,
      severity: 'error'
    });
  }

  if (constraints.positive && value <= 0) {
    errors.push({
      code: 'NOT_POSITIVE',
      message: 'Value must be positive',
      value,
      severity: 'error'
    });
  }

  if (constraints.min !== undefined && value < constraints.min) {
    errors.push({
      code: 'BELOW_MINIMUM',
      message: `Value ${value} is below minimum ${constraints.min}`,
      value,
      severity: 'error'
    });
  }

  if (constraints.max !== undefined && value > constraints.max) {
    errors.push({
      code: 'ABOVE_MAXIMUM',
      message: `Value ${value} is above maximum ${constraints.max}`,
      value,
      severity: 'error'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: []
  };
}