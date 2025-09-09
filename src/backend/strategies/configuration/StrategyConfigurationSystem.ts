/**
 * Strategy Configuration System - Task BE-009
 * 
 * Comprehensive strategy parameter validation, optimization, and management system.
 * Provides JSON schema validation, parameter optimization, auto-tuning capabilities,
 * configuration templates, environment-specific configurations, versioning,
 * and inheritance mechanisms for trading strategies.
 */

import { EventEmitter } from 'events';
import type { 
  StrategyConfig, 
  StrategyParameter,
  StrategyValidationError,
  StrategyError,
  StrategyLifecycleEvent 
} from '../types.js';

// =============================================================================
// CORE CONFIGURATION TYPES
// =============================================================================

/**
 * Enhanced parameter definition with optimization support
 */
export interface EnhancedStrategyParameter extends StrategyParameter {
  // Optimization settings
  optimization?: {
    enabled: boolean;
    method: 'grid' | 'random' | 'bayesian' | 'genetic' | 'pso';
    range?: [number, number]; // For numeric parameters
    step?: number; // Step size for grid search
    suggestions?: unknown[]; // Suggested values to test
    priority: 'low' | 'medium' | 'high'; // Optimization priority
  };
  
  // Auto-tuning configuration
  autoTune?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'on_performance_drop';
    metric: 'sharpe' | 'return' | 'win_rate' | 'profit_factor' | 'custom';
    threshold?: number; // Performance threshold for triggering auto-tune
    constraints?: {
      maxChange: number; // Maximum percentage change per tuning
      minTrades: number; // Minimum trades before tuning
    };
  };
  
  // Dynamic adjustment settings
  dynamic?: {
    enabled: boolean;
    adaptationRate: number; // 0-1, how quickly to adapt
    marketConditions: string[]; // Conditions that trigger adjustments
    rules: ParameterRule[];
  };
  
  // Historical tracking
  history?: ParameterHistory[];
  
  // Validation metadata
  lastValidated?: Date;
  validationErrors?: string[];
  performanceImpact?: number; // -1 to 1, impact on strategy performance
}

/**
 * Parameter adjustment rule
 */
export interface ParameterRule {
  id: string;
  name: string;
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
    value: number;
    period?: number; // Time period in hours for evaluation
  };
  action: {
    type: 'multiply' | 'add' | 'set' | 'adjust_by_percent';
    value: number;
    limits?: [number, number]; // Min/max bounds for the result
  };
  enabled: boolean;
  priority: number; // Higher priority rules execute first
  cooldown?: number; // Hours before rule can trigger again
  lastTriggered?: Date;
}

/**
 * Parameter change history
 */
export interface ParameterHistory {
  timestamp: Date;
  oldValue: unknown;
  newValue: unknown;
  reason: 'manual' | 'optimization' | 'auto_tune' | 'dynamic_adjustment' | 'rollback';
  performance: {
    before: PerformanceSnapshot;
    after?: PerformanceSnapshot;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Performance snapshot for comparison
 */
export interface PerformanceSnapshot {
  timestamp: Date;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    trades: number;
  };
  marketConditions?: {
    volatility: number;
    trend: string;
    volume: number;
  };
}

/**
 * Configuration template
 */
export interface StrategyConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  strategyType: string;
  version: string;
  
  // Template parameters with defaults
  parameters: Record<string, EnhancedStrategyParameter>;
  
  // Risk management defaults
  riskProfile: StrategyConfig['riskProfile'];
  
  // Performance requirements
  performance: StrategyConfig['performance'];
  
  // Execution settings
  execution: StrategyConfig['execution'];
  
  // Monitoring configuration
  monitoring: StrategyConfig['monitoring'];
  
  // Template metadata
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Usage statistics
  usageStats?: {
    timesUsed: number;
    avgPerformance: number;
    lastUsed: Date;
  };
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfiguration {
  environment: 'development' | 'testing' | 'staging' | 'production';
  
  // Environment-specific overrides
  overrides: {
    parameters?: Partial<Record<string, unknown>>;
    riskProfile?: Partial<StrategyConfig['riskProfile']>;
    execution?: Partial<StrategyConfig['execution']>;
    monitoring?: Partial<StrategyConfig['monitoring']>;
  };
  
  // Resource limits for this environment
  limits: {
    maxConcurrentStrategies: number;
    maxPositionSize: number;
    maxDailyTrades: number;
    memoryLimit: number; // MB
    cpuLimit: number; // percentage
  };
  
  // Data sources and external services
  dataSources: {
    market: string[];
    news?: string[];
    social?: string[];
  };
  
  // Notification settings
  notifications: {
    enabled: boolean;
    channels: string[];
    alertThresholds: Record<string, number>;
  };
  
  // Security settings
  security: {
    apiKeyRotation: boolean;
    encryptionLevel: 'basic' | 'standard' | 'high';
    auditLogging: boolean;
  };
}

/**
 * Configuration version control
 */
export interface ConfigurationVersion {
  id: string;
  version: string;
  configurationId: string;
  
  // Configuration snapshot
  configuration: StrategyConfig;
  parameters: Record<string, EnhancedStrategyParameter>;
  
  // Version metadata
  timestamp: Date;
  author: string;
  description: string;
  tags: string[];
  
  // Performance data (if deployed)
  performance?: {
    deployedAt?: Date;
    metricsStart?: Date;
    metricsEnd?: Date;
    results?: PerformanceSnapshot;
  };
  
  // Validation results
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validatedAt: Date;
  };
  
  // Dependencies
  dependencies?: {
    templates: string[];
    libraries: string[];
    dataFeeds: string[];
  };
}

// =============================================================================
// VALIDATION SCHEMA TYPES
// =============================================================================

/**
 * JSON Schema for parameter validation
 */
export interface ParameterSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, ParameterSchema>;
  items?: ParameterSchema;
  
  // Validation constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  
  enum?: unknown[];
  const?: unknown;
  
  // Custom validation
  custom?: {
    validator: string; // Function name or expression
    message?: string;
    async?: boolean;
  };
  
  // Dependencies
  dependencies?: Record<string, ParameterSchema | string[]>;
  
  // Conditional validation
  if?: ParameterSchema;
  then?: ParameterSchema;
  else?: ParameterSchema;
  
  // Composition
  allOf?: ParameterSchema[];
  anyOf?: ParameterSchema[];
  oneOf?: ParameterSchema[];
  not?: ParameterSchema;
  
  // Metadata
  title?: string;
  description?: string;
  examples?: unknown[];
  default?: unknown;
  
  // Strategy-specific extensions
  strategyExtensions?: {
    riskImpact?: 'low' | 'medium' | 'high';
    performanceImpact?: 'low' | 'medium' | 'high';
    complexity?: 'simple' | 'moderate' | 'complex';
    category?: string;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  
  // Performance metrics
  validationTime: number; // milliseconds
  validatedAt: Date;
  
  // Detailed results by parameter
  parameterResults: Record<string, ParameterValidationResult>;
  
  // Overall health score
  healthScore: number; // 0-100
  
  // Recommendations
  recommendations: ValidationRecommendation[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  value?: unknown;
  constraint?: unknown;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning extends ValidationError {
  suggestion?: string;
  impact?: 'low' | 'medium' | 'high';
}

export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  value: unknown;
  normalizedValue?: unknown;
  confidence: number; // 0-1
}

export interface ValidationRecommendation {
  type: 'optimization' | 'performance' | 'risk' | 'stability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  action?: string;
  estimatedImpact?: string;
}

// =============================================================================
// OPTIMIZATION TYPES
// =============================================================================

/**
 * Parameter optimization configuration
 */
export interface OptimizationConfiguration {
  // Optimization method
  method: 'grid_search' | 'random_search' | 'bayesian' | 'genetic' | 'particle_swarm' | 'differential_evolution';
  
  // Target metrics
  objectives: OptimizationObjective[];
  
  // Constraints
  constraints: OptimizationConstraint[];
  
  // Search space
  searchSpace: Record<string, ParameterSpace>;
  
  // Optimization settings
  settings: {
    maxIterations: number;
    maxTime: number; // seconds
    populationSize?: number; // For population-based methods
    convergenceThreshold?: number;
    parallelEvaluations?: number;
    
    // Early stopping
    earlyStopping?: {
      enabled: boolean;
      patience: number; // iterations without improvement
      minImprovement: number; // minimum improvement threshold
    };
  };
  
  // Cross-validation
  crossValidation?: {
    method: 'time_series' | 'walk_forward' | 'purged' | 'combinatorial';
    folds: number;
    testSize: number; // percentage or absolute
    gap?: number; // gap between train and test sets
  };
  
  // Resource limits
  resources: {
    maxMemory: number; // MB
    maxCpuCores: number;
    timeout: number; // seconds per evaluation
  };
}

export interface OptimizationObjective {
  name: string;
  metric: string; // sharpe_ratio, total_return, win_rate, etc.
  direction: 'maximize' | 'minimize';
  weight: number; // 0-1, for multi-objective optimization
  constraint?: {
    min?: number;
    max?: number;
  };
}

export interface OptimizationConstraint {
  name: string;
  expression: string; // Mathematical expression
  type: 'hard' | 'soft'; // Hard constraints must be satisfied
  penalty?: number; // Penalty weight for soft constraints
}

export interface ParameterSpace {
  type: 'continuous' | 'discrete' | 'categorical';
  
  // For continuous parameters
  min?: number;
  max?: number;
  distribution?: 'uniform' | 'normal' | 'log_uniform' | 'log_normal';
  
  // For discrete parameters
  values?: unknown[];
  step?: number;
  
  // Sampling preferences
  prior?: 'uniform' | 'normal' | 'beta' | 'gamma';
  priorParams?: number[];
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  success: boolean;
  bestParameters: Record<string, unknown>;
  bestScore: number;
  bestMetrics: Record<string, number>;
  
  // Optimization history
  history: OptimizationIteration[];
  
  // Statistics
  totalIterations: number;
  totalTime: number; // seconds
  convergenceReached: boolean;
  
  // Parameter importance
  importance: Record<string, number>; // 0-1
  
  // Sensitivity analysis
  sensitivity: Record<string, SensitivityAnalysis>;
  
  // Recommendations
  recommendations: string[];
  
  // Validation results
  crossValidationResults?: CrossValidationResult;
}

export interface OptimizationIteration {
  iteration: number;
  parameters: Record<string, unknown>;
  score: number;
  metrics: Record<string, number>;
  time: number; // seconds
  isValid: boolean;
  error?: string;
}

export interface SensitivityAnalysis {
  parameter: string;
  impact: number; // -1 to 1
  confidence: number; // 0-1
  optimalRange?: [number, number];
  interactions?: Record<string, number>; // Interaction with other parameters
}

export interface CrossValidationResult {
  method: string;
  folds: number;
  scores: number[];
  meanScore: number;
  stdScore: number;
  foldResults: FoldResult[];
}

export interface FoldResult {
  fold: number;
  trainPeriod: { start: Date; end: Date };
  testPeriod: { start: Date; end: Date };
  score: number;
  metrics: Record<string, number>;
}

// =============================================================================
// MAIN CONFIGURATION SYSTEM CLASS
// =============================================================================

/**
 * Comprehensive Strategy Configuration System
 * 
 * Provides advanced parameter validation, optimization, auto-tuning,
 * configuration management, versioning, and environment-specific handling
 * for trading strategies with enterprise-grade capabilities.
 */
export class StrategyConfigurationSystem extends EventEmitter {
  private templates: Map<string, StrategyConfigurationTemplate> = new Map();
  private schemas: Map<string, ParameterSchema> = new Map();
  private versions: Map<string, ConfigurationVersion[]> = new Map();
  private environments: Map<string, EnvironmentConfiguration> = new Map();
  private optimizers: Map<string, ParameterOptimizer> = new Map();
  private validators: Map<string, ParameterValidator> = new Map();
  
  // Performance tracking
  private validationMetrics = {
    totalValidations: 0,
    avgValidationTime: 0,
    successRate: 0,
    lastResetTime: new Date()
  };

  constructor() {
    super();
    this.initializeDefaults();
  }

  /**
   * Initialize default schemas, templates, and environments
   */
  private initializeDefaults(): void {
    // Initialize built-in parameter validators
    this.registerValidator('number_range', new NumberRangeValidator());
    this.registerValidator('string_pattern', new StringPatternValidator());
    this.registerValidator('array_length', new ArrayLengthValidator());
    this.registerValidator('object_properties', new ObjectPropertiesValidator());
    this.registerValidator('dependency_check', new DependencyValidator());
    this.registerValidator('risk_impact', new RiskImpactValidator());
    
    // Initialize optimization algorithms
    this.registerOptimizer('grid_search', new GridSearchOptimizer());
    this.registerOptimizer('random_search', new RandomSearchOptimizer());
    this.registerOptimizer('bayesian', new BayesianOptimizer());
    this.registerOptimizer('genetic', new GeneticAlgorithmOptimizer());
    this.registerOptimizer('particle_swarm', new ParticleSwarmOptimizer());
    
    // Initialize default environments
    this.createDefaultEnvironments();
    
    // Initialize default templates
    this.createDefaultTemplates();
  }

  // =============================================================================
  // CONFIGURATION VALIDATION
  // =============================================================================

  /**
   * Validate complete strategy configuration
   * Performance target: <10ms for complex configurations
   */
  async validateConfiguration(
    config: StrategyConfig, 
    environmentId: string = 'production'
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Get environment-specific configuration
      const envConfig = this.environments.get(environmentId);
      if (!envConfig) {
        throw new Error(`Environment ${environmentId} not found`);
      }

      // Apply environment overrides
      const mergedConfig = this.applyEnvironmentOverrides(config, envConfig);
      
      // Validate basic configuration structure
      const structureValidation = await this.validateConfigurationStructure(mergedConfig);
      
      // Validate individual parameters
      const parameterValidations = await this.validateParameters(
        mergedConfig.parameters, 
        envConfig
      );
      
      // Validate parameter dependencies
      const dependencyValidation = await this.validateParameterDependencies(mergedConfig.parameters);
      
      // Validate risk profile consistency
      const riskValidation = await this.validateRiskProfile(mergedConfig);
      
      // Validate execution settings
      const executionValidation = await this.validateExecutionSettings(mergedConfig);
      
      // Combine all validation results
      const result = this.combineValidationResults([
        structureValidation,
        parameterValidations,
        dependencyValidation,
        riskValidation,
        executionValidation
      ]);
      
      // Calculate health score
      result.healthScore = this.calculateHealthScore(result);
      
      // Generate recommendations
      result.recommendations = this.generateRecommendations(result, mergedConfig);
      
      // Update metrics
      const validationTime = Date.now() - startTime;
      result.validationTime = validationTime;
      result.validatedAt = new Date();
      
      this.updateValidationMetrics(validationTime, result.isValid);
      
      // Emit validation event
      this.emit('configuration_validated', {
        configurationId: config.id,
        isValid: result.isValid,
        validationTime,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        healthScore: result.healthScore
      });
      
      return result;
      
    } catch (error) {
      const validationTime = Date.now() - startTime;
      this.updateValidationMetrics(validationTime, false);
      
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate configuration structure against schema
   */
  private async validateConfigurationStructure(config: StrategyConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    const requiredFields = ['id', 'name', 'type', 'timeframes', 'symbols'];
    for (const field of requiredFields) {
      if (!config[field as keyof StrategyConfig]) {
        errors.push({
          path: field,
          message: `Required field '${field}' is missing`,
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error'
        });
      }
    }

    // Validate timeframes
    if (config.timeframes && config.timeframes.length === 0) {
      errors.push({
        path: 'timeframes',
        message: 'At least one timeframe must be specified',
        code: 'EMPTY_TIMEFRAMES',
        severity: 'error'
      });
    }

    // Validate symbols
    if (config.symbols && config.symbols.length === 0) {
      errors.push({
        path: 'symbols',
        message: 'At least one symbol must be specified',
        code: 'EMPTY_SYMBOLS',
        severity: 'error'
      });
    }

    // Check for potential conflicts
    if (config.maxConcurrentPositions > config.symbols.length * 2) {
      warnings.push({
        path: 'maxConcurrentPositions',
        message: 'Max concurrent positions seems high relative to number of symbols',
        code: 'HIGH_POSITION_LIMIT',
        severity: 'warning',
        suggestion: 'Consider reducing maxConcurrentPositions or adding more symbols'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults: {},
      healthScore: 0,
      recommendations: []
    };
  }

  /**
   * Validate individual parameters
   */
  private async validateParameters(
    parameters: Record<string, StrategyParameter>,
    envConfig: EnvironmentConfiguration
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const parameterResults: Record<string, ParameterValidationResult> = {};

    for (const [key, param] of Object.entries(parameters)) {
      try {
        const result = await this.validateSingleParameter(key, param, envConfig);
        parameterResults[key] = result;
        
        if (!result.isValid) {
          result.errors.forEach(error => {
            errors.push({
              path: `parameters.${key}`,
              message: error,
              code: 'PARAMETER_VALIDATION_ERROR',
              value: param.value,
              severity: 'error'
            });
          });
        }
        
        result.warnings.forEach(warning => {
          warnings.push({
            path: `parameters.${key}`,
            message: warning,
            code: 'PARAMETER_VALIDATION_WARNING',
            value: param.value,
            severity: 'warning'
          });
        });
        
      } catch (error) {
        errors.push({
          path: `parameters.${key}`,
          message: `Parameter validation failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'VALIDATION_EXCEPTION',
          severity: 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults,
      healthScore: 0,
      recommendations: []
    };
  }

  /**
   * Validate single parameter against its definition and constraints
   */
  private async validateSingleParameter(
    key: string,
    param: StrategyParameter,
    envConfig: EnvironmentConfiguration
  ): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Type validation
    const actualType = typeof param.value;
    if (param.value !== undefined && actualType !== param.type && param.type !== 'array' && param.type !== 'object') {
      errors.push(`Expected type '${param.type}' but got '${actualType}'`);
      confidence *= 0.5;
    }

    // Required validation
    if (param.required && (param.value === undefined || param.value === null)) {
      errors.push('Parameter is required but not provided');
      confidence = 0;
    }

    // Range validation for numbers
    if (param.type === 'number' && typeof param.value === 'number') {
      if (param.min !== undefined && param.value < param.min) {
        errors.push(`Value ${param.value} is below minimum ${param.min}`);
        confidence *= 0.7;
      }
      if (param.max !== undefined && param.value > param.max) {
        errors.push(`Value ${param.value} exceeds maximum ${param.max}`);
        confidence *= 0.7;
      }
    }

    // Options validation
    if (param.options && param.options.length > 0) {
      if (!param.options.includes(param.value)) {
        errors.push(`Value '${param.value}' is not in allowed options: ${param.options.join(', ')}`);
        confidence *= 0.3;
      }
    }

    // Pattern validation for strings
    if (param.type === 'string' && param.pattern && typeof param.value === 'string') {
      const regex = new RegExp(param.pattern);
      if (!regex.test(param.value)) {
        errors.push(`Value '${param.value}' does not match required pattern`);
        confidence *= 0.5;
      }
    }

    // Environment-specific validation
    if (envConfig.limits) {
      // Add environment-specific validations here
      if (key === 'maxPositionSize' && typeof param.value === 'number') {
        if (param.value > envConfig.limits.maxPositionSize) {
          warnings.push(`Position size exceeds environment limit of ${envConfig.limits.maxPositionSize}`);
          confidence *= 0.8;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: param.value,
      normalizedValue: this.normalizeParameterValue(param.value, param.type),
      confidence
    };
  }

  /**
   * Validate parameter dependencies
   */
  private async validateParameterDependencies(
    parameters: Record<string, StrategyParameter>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [key, param] of Object.entries(parameters)) {
      if (param.dependencies) {
        for (const depKey of param.dependencies) {
          if (!parameters[depKey]) {
            errors.push({
              path: `parameters.${key}`,
              message: `Depends on parameter '${depKey}' which is not defined`,
              code: 'MISSING_DEPENDENCY',
              severity: 'error'
            });
          }
        }
      }

      if (param.conditions) {
        for (const condition of param.conditions) {
          const depParam = parameters[condition.parameter];
          if (!depParam) {
            errors.push({
              path: `parameters.${key}`,
              message: `Condition references undefined parameter '${condition.parameter}'`,
              code: 'UNDEFINED_CONDITION_PARAMETER',
              severity: 'error'
            });
            continue;
          }

          // Evaluate condition
          const conditionMet = this.evaluateCondition(depParam.value, condition.operator, condition.value);
          if (!conditionMet && param.required) {
            warnings.push({
              path: `parameters.${key}`,
              message: `Condition not met: ${condition.parameter} ${condition.operator} ${condition.value}`,
              code: 'CONDITION_NOT_MET',
              severity: 'warning'
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults: {},
      healthScore: 0,
      recommendations: []
    };
  }

  /**
   * Validate risk profile settings
   */
  private async validateRiskProfile(config: StrategyConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (config.riskProfile) {
      const riskProfile = config.riskProfile;

      // Validate risk percentages
      if (riskProfile.maxRiskPerTrade <= 0 || riskProfile.maxRiskPerTrade > 100) {
        errors.push({
          path: 'riskProfile.maxRiskPerTrade',
          message: 'Maximum risk per trade must be between 0 and 100 percent',
          code: 'INVALID_RISK_PERCENTAGE',
          severity: 'error'
        });
      }

      if (riskProfile.maxPortfolioRisk <= 0 || riskProfile.maxPortfolioRisk > 100) {
        errors.push({
          path: 'riskProfile.maxPortfolioRisk',
          message: 'Maximum portfolio risk must be between 0 and 100 percent',
          code: 'INVALID_PORTFOLIO_RISK',
          severity: 'error'
        });
      }

      // Risk consistency checks
      if (riskProfile.maxRiskPerTrade > riskProfile.maxPortfolioRisk) {
        warnings.push({
          path: 'riskProfile',
          message: 'Max risk per trade exceeds max portfolio risk',
          code: 'INCONSISTENT_RISK_LIMITS',
          severity: 'warning',
          suggestion: 'Consider aligning risk limits for consistency'
        });
      }

      // Conservative risk warnings
      if (riskProfile.maxRiskPerTrade > 10) {
        warnings.push({
          path: 'riskProfile.maxRiskPerTrade',
          message: 'Risk per trade above 10% is considered aggressive',
          code: 'HIGH_RISK_WARNING',
          severity: 'warning',
          impact: 'high'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults: {},
      healthScore: 0,
      recommendations: []
    };
  }

  /**
   * Validate execution settings
   */
  private async validateExecutionSettings(config: StrategyConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (config.execution) {
      const execution = config.execution;

      // Validate timeout
      if (execution.timeout <= 0) {
        errors.push({
          path: 'execution.timeout',
          message: 'Execution timeout must be positive',
          code: 'INVALID_TIMEOUT',
          severity: 'error'
        });
      }

      // Validate slippage
      if (execution.slippage < 0 || execution.slippage > 100) {
        errors.push({
          path: 'execution.slippage',
          message: 'Slippage must be between 0 and 100 percent',
          code: 'INVALID_SLIPPAGE',
          severity: 'error'
        });
      }

      // Validate retries
      if (execution.retries < 0 || execution.retries > 10) {
        warnings.push({
          path: 'execution.retries',
          message: 'Retry count outside recommended range (0-10)',
          code: 'UNUSUAL_RETRY_COUNT',
          severity: 'warning'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults: {},
      healthScore: 0,
      recommendations: []
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Apply environment-specific overrides to configuration
   */
  private applyEnvironmentOverrides(
    config: StrategyConfig,
    envConfig: EnvironmentConfiguration
  ): StrategyConfig {
    const mergedConfig = { ...config };

    if (envConfig.overrides.parameters) {
      for (const [key, value] of Object.entries(envConfig.overrides.parameters)) {
        if (mergedConfig.parameters[key]) {
          mergedConfig.parameters[key] = {
            ...mergedConfig.parameters[key],
            value
          };
        }
      }
    }

    if (envConfig.overrides.riskProfile) {
      mergedConfig.riskProfile = {
        ...mergedConfig.riskProfile,
        ...envConfig.overrides.riskProfile
      };
    }

    if (envConfig.overrides.execution) {
      mergedConfig.execution = {
        ...mergedConfig.execution,
        ...envConfig.overrides.execution
      };
    }

    if (envConfig.overrides.monitoring) {
      mergedConfig.monitoring = {
        ...mergedConfig.monitoring,
        ...envConfig.overrides.monitoring
      };
    }

    return mergedConfig;
  }

  /**
   * Combine multiple validation results
   */
  private combineValidationResults(results: ValidationResult[]): ValidationResult {
    const combined: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults: {},
      healthScore: 0,
      recommendations: []
    };

    for (const result of results) {
      combined.isValid = combined.isValid && result.isValid;
      combined.errors.push(...result.errors);
      combined.warnings.push(...result.warnings);
      combined.validationTime += result.validationTime;
      Object.assign(combined.parameterResults, result.parameterResults);
      combined.recommendations.push(...result.recommendations);
    }

    return combined;
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(result: ValidationResult): number {
    let score = 100;

    // Deduct points for errors and warnings
    score -= result.errors.length * 10;
    score -= result.warnings.length * 5;

    // Bonus for parameter confidence
    const paramConfidences = Object.values(result.parameterResults)
      .map(r => r.confidence)
      .filter(c => !isNaN(c));
    
    if (paramConfidences.length > 0) {
      const avgConfidence = paramConfidences.reduce((a, b) => a + b, 0) / paramConfidences.length;
      score = score * avgConfidence;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate validation recommendations
   */
  private generateRecommendations(
    result: ValidationResult,
    config: StrategyConfig
  ): ValidationRecommendation[] {
    const recommendations: ValidationRecommendation[] = [];

    // Check for optimization opportunities
    if (result.healthScore < 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        message: 'Configuration health score is below optimal. Consider parameter optimization.',
        action: 'Run parameter optimization',
        estimatedImpact: 'Medium performance improvement'
      });
    }

    // Check for risk management
    if (result.errors.some(e => e.path.includes('riskProfile'))) {
      recommendations.push({
        type: 'risk',
        priority: 'high',
        message: 'Risk profile has validation errors that could impact trading safety.',
        action: 'Review and fix risk management settings',
        estimatedImpact: 'Critical for safe trading'
      });
    }

    // Performance recommendations
    const performanceWarnings = result.warnings.filter(w => w.impact === 'high');
    if (performanceWarnings.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'High-impact warnings detected that may affect strategy performance.',
        action: 'Address high-impact warnings',
        estimatedImpact: 'Improved strategy performance'
      });
    }

    return recommendations;
  }

  /**
   * Evaluate conditional expression
   */
  private evaluateCondition(value: unknown, operator: string, target: unknown): boolean {
    switch (operator) {
      case '=': return value === target;
      case '!=': return value !== target;
      case '>': return Number(value) > Number(target);
      case '<': return Number(value) < Number(target);
      case '>=': return Number(value) >= Number(target);
      case '<=': return Number(value) <= Number(target);
      default: return false;
    }
  }

  /**
   * Normalize parameter value based on type
   */
  private normalizeParameterValue(value: unknown, type: string): unknown {
    switch (type) {
      case 'number':
        return typeof value === 'string' ? parseFloat(value) : value;
      case 'boolean':
        return typeof value === 'string' ? value.toLowerCase() === 'true' : Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }

  /**
   * Update validation performance metrics
   */
  private updateValidationMetrics(validationTime: number, success: boolean): void {
    this.validationMetrics.totalValidations++;
    
    const totalTime = this.validationMetrics.avgValidationTime * (this.validationMetrics.totalValidations - 1) + validationTime;
    this.validationMetrics.avgValidationTime = totalTime / this.validationMetrics.totalValidations;
    
    if (success) {
      const successCount = this.validationMetrics.successRate * (this.validationMetrics.totalValidations - 1) + 1;
      this.validationMetrics.successRate = successCount / this.validationMetrics.totalValidations;
    } else {
      const successCount = this.validationMetrics.successRate * (this.validationMetrics.totalValidations - 1);
      this.validationMetrics.successRate = successCount / this.validationMetrics.totalValidations;
    }
  }

  /**
   * Register custom parameter validator
   */
  public registerValidator(name: string, validator: ParameterValidator): void {
    this.validators.set(name, validator);
  }

  /**
   * Register parameter optimizer
   */
  public registerOptimizer(name: string, optimizer: ParameterOptimizer): void {
    this.optimizers.set(name, optimizer);
  }

  /**
   * Create default environments
   */
  private createDefaultEnvironments(): void {
    // Development environment
    this.environments.set('development', {
      environment: 'development',
      overrides: {
        parameters: {
          maxPositionSize: 100 // Lower position sizes for dev
        },
        riskProfile: {
          maxRiskPerTrade: 1, // Very conservative for dev
          maxPortfolioRisk: 5
        },
        execution: {
          timeout: 30, // Longer timeout for debugging
          retries: 3
        }
      },
      limits: {
        maxConcurrentStrategies: 5,
        maxPositionSize: 1000,
        maxDailyTrades: 50,
        memoryLimit: 512,
        cpuLimit: 50
      },
      dataSources: {
        market: ['mock', 'dydx_testnet']
      },
      notifications: {
        enabled: true,
        channels: ['console'],
        alertThresholds: { loss: 100 }
      },
      security: {
        apiKeyRotation: false,
        encryptionLevel: 'basic',
        auditLogging: true
      }
    });

    // Production environment
    this.environments.set('production', {
      environment: 'production',
      overrides: {},
      limits: {
        maxConcurrentStrategies: 50,
        maxPositionSize: 100000,
        maxDailyTrades: 1000,
        memoryLimit: 4096,
        cpuLimit: 80
      },
      dataSources: {
        market: ['dydx', 'binance', 'coinbase']
      },
      notifications: {
        enabled: true,
        channels: ['email', 'webhook', 'sms'],
        alertThresholds: { 
          loss: 1000, 
          drawdown: 10, 
          error_rate: 5 
        }
      },
      security: {
        apiKeyRotation: true,
        encryptionLevel: 'high',
        auditLogging: true
      }
    });
  }

  /**
   * Create default configuration templates
   */
  private createDefaultTemplates(): void {
    // Basic trend following template will be created in next implementation phase
  }

  /**
   * Get validation performance metrics
   */
  public getValidationMetrics() {
    return { ...this.validationMetrics };
  }
}

// =============================================================================
// PARAMETER VALIDATORS (Interface definitions for now)
// =============================================================================

export interface ParameterValidator {
  validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult>;
}

export interface ParameterOptimizer {
  optimize(
    config: OptimizationConfiguration,
    evaluator: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult>;
}

// =============================================================================
// ENHANCED PARAMETER VALIDATORS - Task BE-009: JSON Schema Validation
// =============================================================================

/**
 * Advanced number range validator with comprehensive validation
 */
class NumberRangeValidator implements ParameterValidator {
  async validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;
    
    // Type validation
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push('Value must be a finite number');
      confidence = 0;
      return { isValid: false, errors, warnings, value, confidence };
    }
    
    const numValue = value as number;
    
    // Range validation
    if (schema.minimum !== undefined) {
      if (schema.exclusiveMinimum && numValue <= schema.minimum) {
        errors.push(`Value ${numValue} must be greater than ${schema.minimum}`);
        confidence *= 0.5;
      } else if (!schema.exclusiveMinimum && numValue < schema.minimum) {
        errors.push(`Value ${numValue} must be greater than or equal to ${schema.minimum}`);
        confidence *= 0.5;
      }
    }
    
    if (schema.maximum !== undefined) {
      if (schema.exclusiveMaximum && numValue >= schema.maximum) {
        errors.push(`Value ${numValue} must be less than ${schema.maximum}`);
        confidence *= 0.5;
      } else if (!schema.exclusiveMaximum && numValue > schema.maximum) {
        errors.push(`Value ${numValue} must be less than or equal to ${schema.maximum}`);
        confidence *= 0.5;
      }
    }
    
    // Multiple validation
    if (schema.multipleOf !== undefined && numValue % schema.multipleOf !== 0) {
      errors.push(`Value ${numValue} must be a multiple of ${schema.multipleOf}`);
      confidence *= 0.7;
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(numValue)) {
      errors.push(`Value ${numValue} is not in allowed values: [${schema.enum.join(', ')}]`);
      confidence *= 0.3;
    }
    
    // Strategy-specific validation
    if (schema.strategyExtensions) {
      if (schema.strategyExtensions.riskImpact === 'high' && Math.abs(numValue) > 100) {
        warnings.push('High risk impact parameter with large value detected');
        confidence *= 0.9;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: numValue,
      normalizedValue: numValue,
      confidence
    };
  }
}

/**
 * Advanced string pattern validator with regex and format checking
 */
class StringPatternValidator implements ParameterValidator {
  private static readonly FORMATS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    uri: /^https?:\/\/.+$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    symbol: /^[A-Z]{3,6}(-[A-Z]{3,6})?$/,
    timeframe: /^(1|5|15|30)m$|^(1|2|4|6|8|12)h$|^1d$|^1w$/,
    datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
  };
  
  async validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;
    
    // Type validation
    if (typeof value !== 'string') {
      errors.push('Value must be a string');
      confidence = 0;
      return { isValid: false, errors, warnings, value, confidence };
    }
    
    const strValue = value as string;
    
    // Length validation
    if (schema.minLength !== undefined && strValue.length < schema.minLength) {
      errors.push(`String length ${strValue.length} is less than minimum ${schema.minLength}`);
      confidence *= 0.5;
    }
    
    if (schema.maxLength !== undefined && strValue.length > schema.maxLength) {
      errors.push(`String length ${strValue.length} exceeds maximum ${schema.maxLength}`);
      confidence *= 0.5;
    }
    
    // Pattern validation
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(strValue)) {
        errors.push(`String '${strValue}' does not match required pattern`);
        confidence *= 0.3;
      }
    }
    
    // Format validation
    if (schema.format && StringPatternValidator.FORMATS[schema.format as keyof typeof StringPatternValidator.FORMATS]) {
      const formatRegex = StringPatternValidator.FORMATS[schema.format as keyof typeof StringPatternValidator.FORMATS];
      if (!formatRegex.test(strValue)) {
        errors.push(`String '${strValue}' does not match required format '${schema.format}'`);
        confidence *= 0.4;
      }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(strValue)) {
      errors.push(`String '${strValue}' is not in allowed values: [${schema.enum.map(v => `'${v}'`).join(', ')}]`);
      confidence *= 0.3;
    }
    
    // Strategy-specific validation
    if (schema.strategyExtensions) {
      if (schema.strategyExtensions.category === 'sensitive' && strValue.includes('password')) {
        warnings.push('Potential sensitive data detected in configuration');
        confidence *= 0.8;
      }
    }
    
    // Normalization
    let normalizedValue = strValue;
    if (schema.format === 'symbol') {
      normalizedValue = strValue.toUpperCase();
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: strValue,
      normalizedValue,
      confidence
    };
  }
}

/**
 * Advanced array validator with length, uniqueness, and item validation
 */
class ArrayLengthValidator implements ParameterValidator {
  async validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;
    
    // Type validation
    if (!Array.isArray(value)) {
      errors.push('Value must be an array');
      confidence = 0;
      return { isValid: false, errors, warnings, value, confidence };
    }
    
    const arrayValue = value as unknown[];
    
    // Length validation
    if (schema.minItems !== undefined && arrayValue.length < schema.minItems) {
      errors.push(`Array length ${arrayValue.length} is less than minimum ${schema.minItems}`);
      confidence *= 0.5;
    }
    
    if (schema.maxItems !== undefined && arrayValue.length > schema.maxItems) {
      errors.push(`Array length ${arrayValue.length} exceeds maximum ${schema.maxItems}`);
      confidence *= 0.5;
    }
    
    // Uniqueness validation
    if (schema.uniqueItems) {
      const uniqueValues = new Set(arrayValue.map(item => JSON.stringify(item)));
      if (uniqueValues.size !== arrayValue.length) {
        errors.push('Array contains duplicate items but uniqueItems is required');
        confidence *= 0.6;
      }
    }
    
    // Item validation
    if (schema.items) {
      for (let i = 0; i < arrayValue.length; i++) {
        const item = arrayValue[i];
        
        // Basic type checking for items
        if (schema.items.type) {
          const expectedType = schema.items.type;
          const actualType = Array.isArray(item) ? 'array' : typeof item;
          
          if (actualType !== expectedType) {
            errors.push(`Array item at index ${i} has type '${actualType}' but expected '${expectedType}'`);
            confidence *= 0.7;
          }
        }
        
        // Recursive validation for complex items (simplified)
        if (schema.items.enum && !schema.items.enum.includes(item)) {
          errors.push(`Array item at index ${i} with value '${item}' is not in allowed values`);
          confidence *= 0.4;
        }
      }
    }
    
    // Strategy-specific validation
    if (schema.strategyExtensions?.category === 'timeframes' && arrayValue.length === 0) {
      warnings.push('Empty timeframes array may cause strategy execution issues');
      confidence *= 0.8;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: arrayValue,
      normalizedValue: arrayValue,
      confidence
    };
  }
}

/**
 * Advanced object properties validator with nested validation
 */
class ObjectPropertiesValidator implements ParameterValidator {
  async validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;
    
    // Type validation
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push('Value must be an object');
      confidence = 0;
      return { isValid: false, errors, warnings, value, confidence };
    }
    
    const objValue = value as Record<string, unknown>;
    const normalizedValue: Record<string, unknown> = {};
    
    // Property validation
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propValue = objValue[propName];
        
        // Required property check would be handled separately
        if (propValue !== undefined) {
          // Basic type validation for properties
          const expectedType = propSchema.type;
          const actualType = Array.isArray(propValue) ? 'array' : typeof propValue;
          
          if (expectedType && actualType !== expectedType) {
            errors.push(`Property '${propName}' has type '${actualType}' but expected '${expectedType}'`);
            confidence *= 0.7;
          } else {
            normalizedValue[propName] = propValue;
          }
          
          // Nested validation for complex properties
          if (propSchema.properties) {
            // Simplified nested validation
            if (typeof propValue === 'object' && propValue !== null && !Array.isArray(propValue)) {
              const nestedObj = propValue as Record<string, unknown>;
              for (const [nestedProp, nestedPropSchema] of Object.entries(propSchema.properties)) {
                const nestedValue = nestedObj[nestedProp];
                if (nestedValue !== undefined && nestedPropSchema.type) {
                  const nestedActualType = Array.isArray(nestedValue) ? 'array' : typeof nestedValue;
                  if (nestedActualType !== nestedPropSchema.type) {
                    errors.push(`Nested property '${propName}.${nestedProp}' has type '${nestedActualType}' but expected '${nestedPropSchema.type}'`);
                    confidence *= 0.8;
                  }
                }
              }
            }
          }
          
          // Enum validation for properties
          if (propSchema.enum && !propSchema.enum.includes(propValue)) {
            errors.push(`Property '${propName}' value '${propValue}' is not in allowed values`);
            confidence *= 0.4;
          }
        }
      }
    }
    
    // Additional properties check (simplified)
    const allowedProps = schema.properties ? Object.keys(schema.properties) : [];
    const actualProps = Object.keys(objValue);
    const extraProps = actualProps.filter(prop => !allowedProps.includes(prop));
    
    if (extraProps.length > 0) {
      warnings.push(`Object contains additional properties: [${extraProps.join(', ')}]`);
      confidence *= 0.9;
      
      // Include extra properties in normalized value
      extraProps.forEach(prop => {
        normalizedValue[prop] = objValue[prop];
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: objValue,
      normalizedValue: Object.keys(normalizedValue).length > 0 ? normalizedValue : objValue,
      confidence
    };
  }
}

/**
 * Advanced dependency validator for parameter relationships
 */
class DependencyValidator implements ParameterValidator {
  async validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;
    
    // Context is required for dependency validation
    if (!context || !context.allParameters) {
      warnings.push('Cannot validate dependencies without context');
      return {
        isValid: true, // Assume valid if we can't check
        errors,
        warnings,
        value,
        confidence: 0.5
      };
    }
    
    const allParams = context.allParameters as Record<string, unknown>;
    
    // Schema dependencies validation
    if (schema.dependencies) {
      for (const [depKey, depValue] of Object.entries(schema.dependencies)) {
        if (Array.isArray(depValue)) {
          // Property dependencies
          const requiredProps = depValue as string[];
          for (const requiredProp of requiredProps) {
            if (allParams[requiredProp] === undefined) {
              errors.push(`Property '${depKey}' requires '${requiredProp}' to be defined`);
              confidence *= 0.6;
            }
          }
        } else {
          // Schema dependencies (simplified)
          const depSchema = depValue as ParameterSchema;
          if (allParams[depKey] !== undefined) {
            // The dependent property exists, so we need to validate according to the schema
            // This is a simplified check - in a full implementation, we'd recursively validate
            if (depSchema.type) {
              const depParamValue = allParams[depKey];
              const actualType = Array.isArray(depParamValue) ? 'array' : typeof depParamValue;
              if (actualType !== depSchema.type) {
                errors.push(`Dependent property '${depKey}' has wrong type due to dependency`);
                confidence *= 0.7;
              }
            }
          }
        }
      }
    }
    
    // Conditional validation (if/then/else)
    if (schema.if && schema.then) {
      const conditionMet = this.evaluateCondition(value, schema.if, allParams);
      if (conditionMet && schema.then) {
        // Apply then schema validation (simplified)
        if (schema.then.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== schema.then.type) {
            errors.push(`Conditional validation failed: expected '${schema.then.type}' but got '${actualType}'`);
            confidence *= 0.6;
          }
        }
      } else if (!conditionMet && schema.else) {
        // Apply else schema validation (simplified)
        if (schema.else.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== schema.else.type) {
            errors.push(`Conditional validation failed: expected '${schema.else.type}' but got '${actualType}'`);
            confidence *= 0.6;
          }
        }
      }
    }
    
    // Custom dependency logic for trading strategies
    if (context.strategyType) {
      this.validateStrategySpecificDependencies(value, context, errors, warnings);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value,
      confidence
    };
  }
  
  private evaluateCondition(value: unknown, condition: ParameterSchema, allParams: Record<string, unknown>): boolean {
    // Simplified condition evaluation
    if (condition.const !== undefined) {
      return value === condition.const;
    }
    
    if (condition.enum) {
      return condition.enum.includes(value);
    }
    
    if (condition.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      return actualType === condition.type;
    }
    
    return true;
  }
  
  private validateStrategySpecificDependencies(
    value: unknown,
    context: any,
    errors: string[],
    warnings: string[]
  ): void {
    const allParams = context.allParameters as Record<string, unknown>;
    
    // Example: If stop loss is enabled, take profit should also be configured
    if (context.parameterName === 'stopLoss' && value && typeof value === 'object') {
      const stopLossConfig = value as any;
      if (stopLossConfig.enabled && !allParams.takeProfit) {
        warnings.push('Stop loss is enabled but take profit is not configured - consider risk management');
      }
    }
    
    // Example: Timeframe dependencies
    if (context.parameterName === 'timeframes' && Array.isArray(value)) {
      const timeframes = value as string[];
      if (timeframes.includes('1m') && !allParams.highFrequency) {
        warnings.push('1-minute timeframe detected but high frequency mode not enabled');
      }
    }
  }
}

/**
 * Risk impact validator for trading strategy parameters
 */
class RiskImpactValidator implements ParameterValidator {
  private static readonly HIGH_RISK_THRESHOLDS = {
    leverage: 10,
    positionSize: 50, // percentage
    maxDrawdown: 20, // percentage
    riskPerTrade: 5 // percentage
  };
  
  async validate(value: unknown, schema: ParameterSchema, context?: any): Promise<ParameterValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;
    
    // Only validate if schema indicates risk impact
    if (!schema.strategyExtensions?.riskImpact) {
      return {
        isValid: true,
        errors,
        warnings,
        value,
        confidence
      };
    }
    
    const riskLevel = schema.strategyExtensions.riskImpact;
    const paramName = context?.parameterName || 'unknown';
    
    // Risk level validation based on parameter type and value
    if (typeof value === 'number') {
      const numValue = value as number;
      
      switch (riskLevel) {
        case 'high':
          if (paramName.toLowerCase().includes('leverage') && numValue > RiskImpactValidator.HIGH_RISK_THRESHOLDS.leverage) {
            errors.push(`High leverage ${numValue}x exceeds recommended maximum of ${RiskImpactValidator.HIGH_RISK_THRESHOLDS.leverage}x`);
            confidence *= 0.3;
          }
          
          if (paramName.toLowerCase().includes('position') && numValue > RiskImpactValidator.HIGH_RISK_THRESHOLDS.positionSize) {
            errors.push(`Position size ${numValue}% exceeds recommended maximum of ${RiskImpactValidator.HIGH_RISK_THRESHOLDS.positionSize}%`);
            confidence *= 0.4;
          }
          
          if (paramName.toLowerCase().includes('drawdown') && numValue > RiskImpactValidator.HIGH_RISK_THRESHOLDS.maxDrawdown) {
            warnings.push(`Maximum drawdown ${numValue}% is quite high - consider reducing to below ${RiskImpactValidator.HIGH_RISK_THRESHOLDS.maxDrawdown}%`);
            confidence *= 0.7;
          }
          
          if (paramName.toLowerCase().includes('risk') && numValue > RiskImpactValidator.HIGH_RISK_THRESHOLDS.riskPerTrade) {
            warnings.push(`Risk per trade ${numValue}% exceeds conservative threshold of ${RiskImpactValidator.HIGH_RISK_THRESHOLDS.riskPerTrade}%`);
            confidence *= 0.6;
          }
          break;
          
        case 'medium':
          if (typeof numValue === 'number' && numValue > 100) {
            warnings.push(`Medium risk parameter has unusually high value: ${numValue}`);
            confidence *= 0.8;
          }
          break;
          
        case 'low':
          // Low risk parameters are generally safe, but check for unreasonable values
          if (numValue < 0 && !paramName.toLowerCase().includes('fee')) {
            warnings.push(`Low risk parameter has negative value: ${numValue}`);
            confidence *= 0.9;
          }
          break;
      }
    }
    
    // Additional risk validation for complex objects
    if (typeof value === 'object' && value !== null) {
      const objValue = value as Record<string, unknown>;
      
      // Validate risk management objects
      if (paramName.toLowerCase().includes('risk')) {
        if (objValue.enabled === true && !objValue.limits) {
          warnings.push('Risk management is enabled but no limits are defined');
          confidence *= 0.7;
        }
        
        if (objValue.maxLoss && typeof objValue.maxLoss === 'number' && objValue.maxLoss > 50) {
          errors.push(`Maximum loss ${objValue.maxLoss}% is extremely high`);
          confidence *= 0.3;
        }
      }
    }
    
    // Strategy-specific risk validation
    if (context?.strategyType) {
      this.validateStrategyRisk(value, context, riskLevel, errors, warnings);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value,
      confidence
    };
  }
  
  private validateStrategyRisk(
    value: unknown,
    context: any,
    riskLevel: string,
    errors: string[],
    warnings: string[]
  ): void {
    const strategyType = context.strategyType as string;
    const paramName = context.parameterName as string;
    
    // High-frequency trading specific risks
    if (strategyType.toLowerCase().includes('scalping') || strategyType.toLowerCase().includes('hft')) {
      if (paramName.includes('slippage') && typeof value === 'number' && value > 0.1) {
        warnings.push('High slippage tolerance may significantly impact scalping strategy profitability');
      }
    }
    
    // Trend following strategy risks
    if (strategyType.toLowerCase().includes('trend')) {
      if (paramName.includes('stopLoss') && typeof value === 'object') {
        const stopLoss = value as any;
        if (stopLoss.type === 'fixed' && stopLoss.value > 5) {
          warnings.push('Fixed stop loss > 5% may be too wide for trend following strategies');
        }
      }
    }
    
    // Mean reversion strategy risks
    if (strategyType.toLowerCase().includes('reversion')) {
      if (paramName.includes('holdingPeriod') && typeof value === 'number' && value > 24) {
        warnings.push('Long holding periods may not be suitable for mean reversion strategies');
      }
    }
  }
}

// Basic optimizer implementations (stubs for now)
class GridSearchOptimizer implements ParameterOptimizer {
  async optimize(
    config: OptimizationConfiguration,
    evaluator: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult> {
    // Implementation stub
    return {
      success: false,
      bestParameters: {},
      bestScore: 0,
      bestMetrics: {},
      history: [],
      totalIterations: 0,
      totalTime: 0,
      convergenceReached: false,
      importance: {},
      sensitivity: {},
      recommendations: []
    };
  }
}

class RandomSearchOptimizer implements ParameterOptimizer {
  async optimize(
    config: OptimizationConfiguration,
    evaluator: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult> {
    // Implementation stub
    return {
      success: false,
      bestParameters: {},
      bestScore: 0,
      bestMetrics: {},
      history: [],
      totalIterations: 0,
      totalTime: 0,
      convergenceReached: false,
      importance: {},
      sensitivity: {},
      recommendations: []
    };
  }
}

class BayesianOptimizer implements ParameterOptimizer {
  async optimize(
    config: OptimizationConfiguration,
    evaluator: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult> {
    // Implementation stub
    return {
      success: false,
      bestParameters: {},
      bestScore: 0,
      bestMetrics: {},
      history: [],
      totalIterations: 0,
      totalTime: 0,
      convergenceReached: false,
      importance: {},
      sensitivity: {},
      recommendations: []
    };
  }
}

class GeneticAlgorithmOptimizer implements ParameterOptimizer {
  async optimize(
    config: OptimizationConfiguration,
    evaluator: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult> {
    // Implementation stub
    return {
      success: false,
      bestParameters: {},
      bestScore: 0,
      bestMetrics: {},
      history: [],
      totalIterations: 0,
      totalTime: 0,
      convergenceReached: false,
      importance: {},
      sensitivity: {},
      recommendations: []
    };
  }
}

class ParticleSwarmOptimizer implements ParameterOptimizer {
  async optimize(
    config: OptimizationConfiguration,
    evaluator: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult> {
    // Implementation stub
    return {
      success: false,
      bestParameters: {},
      bestScore: 0,
      bestMetrics: {},
      history: [],
      totalIterations: 0,
      totalTime: 0,
      convergenceReached: false,
      importance: {},
      sensitivity: {},
      recommendations: []
    };
  }
}

export default StrategyConfigurationSystem;