/**
 * Strategy Validator - Task BE-017 Component
 * 
 * Comprehensive validation system for trading strategies including
 * configuration validation, code analysis, security checks, and
 * performance validation.
 */

import { BaseStrategy } from '../strategies/BaseStrategy.js';
import type { StrategyConfig, RiskProfile, StrategyParameters } from '../strategies/types.js';

/**
 * Validation Rule Definition
 */
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'syntax' | 'logic' | 'security' | 'performance' | 'business';
  severity: 'info' | 'warning' | 'error' | 'critical';
  validate: (context: ValidationContext) => Promise<ValidationIssue[]>;
}

/**
 * Validation Context
 */
export interface ValidationContext {
  strategyConfig?: StrategyConfig;
  strategyCode?: string;
  filePath?: string;
  metadata?: any;
  dependencies?: string[];
  environment?: 'development' | 'testing' | 'production';
}

/**
 * Validation Issue
 */
export interface ValidationIssue {
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  description?: string;
  location?: {
    file: string;
    line: number;
    column: number;
    length?: number;
  };
  suggestion?: string;
  fix?: {
    description: string;
    autoFixable: boolean;
    replacement?: string;
  };
}

/**
 * Comprehensive Validation Result
 */
export interface FullValidationResult {
  isValid: boolean;
  overallScore: number; // 0-100
  issues: ValidationIssue[];
  summary: {
    critical: number;
    errors: number;
    warnings: number;
    info: number;
  };
  categories: {
    [category: string]: {
      score: number;
      issues: number;
      passed: boolean;
    };
  };
  recommendations: string[];
  metrics: {
    complexity: number;
    maintainability: number;
    security: number;
    performance: number;
    reliability: number;
  };
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Validation Configuration
 */
export interface ValidatorConfig {
  strictMode: boolean;
  securityLevel: 'low' | 'medium' | 'high';
  performanceThresholds: {
    maxComplexity: number;
    maxMemoryUsage: number;
    maxExecutionTime: number;
  };
  enabledRules: string[];
  disabledRules: string[];
  customRules: ValidationRule[];
}

/**
 * Strategy Validator Class
 */
export class StrategyValidator {
  private config: ValidatorConfig;
  private validationRules: Map<string, ValidationRule> = new Map();

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = {
      strictMode: true,
      securityLevel: 'high',
      performanceThresholds: {
        maxComplexity: 15,
        maxMemoryUsage: 100, // MB
        maxExecutionTime: 5000 // ms
      },
      enabledRules: [],
      disabledRules: [],
      customRules: [],
      ...config
    };

    this.initializeDefaultRules();
    this.loadCustomRules();
  }

  /**
   * Validate strategy configuration
   */
  async validateConfig(config: StrategyConfig): Promise<FullValidationResult> {
    const context: ValidationContext = {
      strategyConfig: config,
      environment: 'production'
    };

    return await this.runFullValidation(context);
  }

  /**
   * Validate strategy code file
   */
  async validateFile(filePath: string, code: string): Promise<FullValidationResult> {
    const context: ValidationContext = {
      strategyCode: code,
      filePath,
      environment: 'development'
    };

    return await this.runFullValidation(context);
  }

  /**
   * Validate complete strategy (config + code)
   */
  async validateStrategy(
    config: StrategyConfig,
    code: string,
    filePath?: string
  ): Promise<FullValidationResult> {
    const context: ValidationContext = {
      strategyConfig: config,
      strategyCode: code,
      filePath,
      environment: 'production'
    };

    return await this.runFullValidation(context);
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);
  }

  /**
   * Remove validation rule
   */
  removeRule(ruleId: string): void {
    this.validationRules.delete(ruleId);
  }

  /**
   * Update validator configuration
   */
  updateConfig(newConfig: Partial<ValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.loadCustomRules();
  }

  // === PRIVATE METHODS ===

  /**
   * Run full validation with all enabled rules
   */
  private async runFullValidation(context: ValidationContext): Promise<FullValidationResult> {
    const allIssues: ValidationIssue[] = [];
    const categoryScores: { [category: string]: { issues: ValidationIssue[]; total: number; } } = {};

    // Run all validation rules
    for (const rule of this.validationRules.values()) {
      if (this.isRuleEnabled(rule)) {
        try {
          const ruleIssues = await rule.validate(context);
          allIssues.push(...ruleIssues);

          // Categorize issues
          if (!categoryScores[rule.category]) {
            categoryScores[rule.category] = { issues: [], total: 0 };
          }
          categoryScores[rule.category].issues.push(...ruleIssues);
          categoryScores[rule.category].total++;

        } catch (error) {
          console.error(`Validation rule ${rule.id} failed:`, error);
          allIssues.push({
            ruleId: 'validator_error',
            severity: 'error',
            message: `Validation rule ${rule.id} failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    }

    // Calculate scores and metrics
    const summary = this.calculateSummary(allIssues);
    const overallScore = this.calculateOverallScore(summary);
    const categories = this.calculateCategoryScores(categoryScores);
    const metrics = this.calculateMetrics(context, allIssues);
    const estimatedRisk = this.estimateRisk(summary, metrics);
    const recommendations = this.generateRecommendations(allIssues, metrics);

    return {
      isValid: summary.critical === 0 && summary.errors === 0,
      overallScore,
      issues: allIssues,
      summary,
      categories,
      recommendations,
      metrics,
      estimatedRisk
    };
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Configuration Validation Rules
    this.validationRules.set('config_required_fields', {
      id: 'config_required_fields',
      name: 'Required Configuration Fields',
      description: 'Validates that all required configuration fields are present',
      category: 'logic',
      severity: 'critical',
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const config = context.strategyConfig;

        if (!config) return issues;

        const requiredFields = ['id', 'name', 'type'];
        for (const field of requiredFields) {
          if (!(config as any)[field]) {
            issues.push({
              ruleId: 'config_required_fields',
              severity: 'critical',
              message: `Required configuration field missing: ${field}`,
              suggestion: `Add ${field} to strategy configuration`
            });
          }
        }

        return issues;
      }
    });

    this.validationRules.set('risk_profile_validation', {
      id: 'risk_profile_validation',
      name: 'Risk Profile Validation',
      description: 'Validates risk profile parameters are within acceptable ranges',
      category: 'business',
      severity: 'error',
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const config = context.strategyConfig;

        if (!config?.riskProfile) return issues;

        const risk = config.riskProfile;

        if (risk.maxRiskPerTrade > 100) {
          issues.push({
            ruleId: 'risk_profile_validation',
            severity: 'critical',
            message: 'Max risk per trade cannot exceed 100%',
            suggestion: 'Set maxRiskPerTrade to a value between 0.1 and 10'
          });
        }

        if (risk.maxRiskPerTrade > 20) {
          issues.push({
            ruleId: 'risk_profile_validation',
            severity: 'warning',
            message: 'Max risk per trade is very high (>20%)',
            suggestion: 'Consider reducing maxRiskPerTrade for better risk management'
          });
        }

        if (risk.maxDailyLoss && risk.maxDailyLoss > 50) {
          issues.push({
            ruleId: 'risk_profile_validation',
            severity: 'error',
            message: 'Max daily loss is excessive (>50%)',
            suggestion: 'Set maxDailyLoss to a more conservative value'
          });
        }

        return issues;
      }
    });

    // Code Quality Rules
    this.validationRules.set('class_structure', {
      id: 'class_structure',
      name: 'Strategy Class Structure',
      description: 'Validates that strategy class follows required structure',
      category: 'syntax',
      severity: 'critical',
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const code = context.strategyCode;

        if (!code) return issues;

        // Check for class declaration
        if (!code.includes('export class') && !code.includes('class')) {
          issues.push({
            ruleId: 'class_structure',
            severity: 'critical',
            message: 'No strategy class found',
            suggestion: 'Define a strategy class that extends BaseStrategy'
          });
        }

        // Check for BaseStrategy extension
        if (!code.includes('extends BaseStrategy')) {
          issues.push({
            ruleId: 'class_structure',
            severity: 'critical',
            message: 'Strategy class must extend BaseStrategy',
            suggestion: 'Change class declaration to extend BaseStrategy'
          });
        }

        // Check for required methods
        const requiredMethods = ['generateSignal'];
        for (const method of requiredMethods) {
          if (!code.includes(method)) {
            issues.push({
              ruleId: 'class_structure',
              severity: 'error',
              message: `Required method missing: ${method}`,
              suggestion: `Implement the ${method} method`
            });
          }
        }

        return issues;
      }
    });

    // Security Rules
    this.validationRules.set('dangerous_code', {
      id: 'dangerous_code',
      name: 'Dangerous Code Patterns',
      description: 'Detects potentially dangerous code patterns',
      category: 'security',
      severity: 'critical',
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const code = context.strategyCode;

        if (!code) return issues;

        const dangerousPatterns = [
          { pattern: /eval\s*\(/, message: 'Use of eval() is dangerous and not allowed' },
          { pattern: /Function\s*\(/, message: 'Dynamic function creation is not allowed' },
          { pattern: /require\s*\(\s*['"]child_process['"]/, message: 'Child process usage is not allowed' },
          { pattern: /require\s*\(\s*['"]fs['"]/, message: 'File system access is not allowed in strategies' },
          { pattern: /require\s*\(\s*['"]http['"]/, message: 'HTTP requests should use approved APIs only' },
          { pattern: /process\.(exit|abort)/, message: 'Process control is not allowed' }
        ];

        for (const { pattern, message } of dangerousPatterns) {
          if (pattern.test(code)) {
            const match = code.match(pattern);
            const lines = code.substring(0, code.indexOf(match![0])).split('\n');
            
            issues.push({
              ruleId: 'dangerous_code',
              severity: 'critical',
              message,
              location: {
                file: context.filePath || 'unknown',
                line: lines.length,
                column: lines[lines.length - 1].length + 1
              },
              suggestion: 'Remove or replace with approved alternatives'
            });
          }
        }

        return issues;
      }
    });

    // Performance Rules
    this.validationRules.set('complexity_check', {
      id: 'complexity_check',
      name: 'Code Complexity Check',
      description: 'Analyzes code complexity for performance optimization',
      category: 'performance',
      severity: 'warning',
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const code = context.strategyCode;

        if (!code) return issues;

        // Simple complexity calculation
        const complexity = this.calculateCyclomaticComplexity(code);

        if (complexity > this.config.performanceThresholds.maxComplexity) {
          issues.push({
            ruleId: 'complexity_check',
            severity: complexity > this.config.performanceThresholds.maxComplexity * 1.5 ? 'error' : 'warning',
            message: `Code complexity is high (${complexity}), consider refactoring`,
            suggestion: 'Break down complex methods into smaller functions'
          });
        }

        return issues;
      }
    });

    // Business Logic Rules
    this.validationRules.set('indicator_validation', {
      id: 'indicator_validation',
      name: 'Indicator Usage Validation',
      description: 'Validates proper usage of technical indicators',
      category: 'business',
      severity: 'warning',
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const code = context.strategyCode;

        if (!code) return issues;

        // Check for proper indicator initialization
        if (code.includes('SMA') || code.includes('EMA')) {
          if (!code.includes('period') && !code.includes('length')) {
            issues.push({
              ruleId: 'indicator_validation',
              severity: 'warning',
              message: 'Moving averages should specify period parameter',
              suggestion: 'Add period parameter to indicator configuration'
            });
          }
        }

        // Check for RSI bounds checking
        if (code.includes('RSI')) {
          if (!code.includes('70') && !code.includes('30')) {
            issues.push({
              ruleId: 'indicator_validation',
              severity: 'info',
              message: 'RSI strategy should consider overbought/oversold levels',
              suggestion: 'Add RSI threshold checks (typically 70/30 or 80/20)'
            });
          }
        }

        return issues;
      }
    });
  }

  /**
   * Load custom validation rules
   */
  private loadCustomRules(): void {
    for (const rule of this.config.customRules) {
      this.validationRules.set(rule.id, rule);
    }
  }

  /**
   * Check if validation rule is enabled
   */
  private isRuleEnabled(rule: ValidationRule): boolean {
    // Check if explicitly disabled
    if (this.config.disabledRules.includes(rule.id)) {
      return false;
    }

    // Check if only specific rules are enabled
    if (this.config.enabledRules.length > 0) {
      return this.config.enabledRules.includes(rule.id);
    }

    // Enabled by default
    return true;
  }

  /**
   * Calculate validation summary
   */
  private calculateSummary(issues: ValidationIssue[]) {
    return {
      critical: issues.filter(i => i.severity === 'critical').length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length
    };
  }

  /**
   * Calculate overall validation score
   */
  private calculateOverallScore(summary: ReturnType<typeof this.calculateSummary>): number {
    let score = 100;
    
    score -= summary.critical * 25;
    score -= summary.errors * 10;
    score -= summary.warnings * 3;
    score -= summary.info * 1;
    
    return Math.max(0, score);
  }

  /**
   * Calculate category-specific scores
   */
  private calculateCategoryScores(categoryScores: any) {
    const categories: any = {};
    
    for (const [category, data] of Object.entries(categoryScores)) {
      const issues = (data as any).issues;
      const total = (data as any).total;
      
      let categoryScore = 100;
      categoryScore -= issues.filter((i: ValidationIssue) => i.severity === 'critical').length * 30;
      categoryScore -= issues.filter((i: ValidationIssue) => i.severity === 'error').length * 15;
      categoryScore -= issues.filter((i: ValidationIssue) => i.severity === 'warning').length * 5;
      
      categories[category] = {
        score: Math.max(0, categoryScore),
        issues: issues.length,
        passed: issues.filter((i: ValidationIssue) => i.severity === 'critical' || i.severity === 'error').length === 0
      };
    }
    
    return categories;
  }

  /**
   * Calculate quality metrics
   */
  private calculateMetrics(context: ValidationContext, issues: ValidationIssue[]) {
    const securityIssues = issues.filter(i => i.ruleId.includes('security') || i.ruleId === 'dangerous_code');
    const performanceIssues = issues.filter(i => i.ruleId.includes('performance') || i.ruleId === 'complexity_check');
    
    return {
      complexity: context.strategyCode ? this.calculateCyclomaticComplexity(context.strategyCode) : 1,
      maintainability: Math.max(0, 100 - issues.filter(i => i.severity === 'error').length * 10),
      security: Math.max(0, 100 - securityIssues.length * 20),
      performance: Math.max(0, 100 - performanceIssues.length * 15),
      reliability: Math.max(0, 100 - issues.filter(i => i.severity === 'critical').length * 30)
    };
  }

  /**
   * Estimate overall risk level
   */
  private estimateRisk(summary: any, metrics: any): 'low' | 'medium' | 'high' | 'critical' {
    if (summary.critical > 0 || metrics.security < 50) return 'critical';
    if (summary.errors > 3 || metrics.reliability < 60) return 'high';
    if (summary.warnings > 5 || metrics.maintainability < 70) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(issues: ValidationIssue[], metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.complexity > 15) {
      recommendations.push('Consider refactoring complex methods to improve maintainability');
    }
    
    if (metrics.security < 80) {
      recommendations.push('Review and address security-related issues');
    }
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Critical issues must be resolved before deployment');
    }
    
    const performanceIssues = issues.filter(i => i.ruleId.includes('performance'));
    if (performanceIssues.length > 2) {
      recommendations.push('Optimize strategy performance for better execution speed');
    }
    
    return recommendations;
  }

  /**
   * Simple cyclomatic complexity calculation
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity
    
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /catch\s*\(/g,
      /case\s+/g,
      /\?\s*:/g, // Ternary operators
      /&&/g,
      /\|\|/g
    ];
    
    for (const pattern of complexityPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }
}

export default StrategyValidator;