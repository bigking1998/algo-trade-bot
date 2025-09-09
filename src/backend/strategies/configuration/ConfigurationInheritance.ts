/**
 * Configuration Inheritance and Composition System - Task BE-009
 * 
 * Advanced configuration inheritance and composition utilities for trading strategies.
 * Provides hierarchical configuration management, template inheritance, parameter
 * composition, and modular strategy building capabilities.
 */

import type {
  StrategyConfigurationTemplate,
  EnhancedStrategyParameter,
  EnvironmentConfiguration,
  ValidationResult
} from './StrategyConfigurationSystem.js';
import type { StrategyConfig } from '../types.js';

// =============================================================================
// INHERITANCE TYPES
// =============================================================================

/**
 * Configuration inheritance hierarchy
 */
export interface InheritanceHierarchy {
  id: string;
  name: string;
  description: string;
  
  // Hierarchy structure
  parent?: string; // Parent configuration ID
  children: string[]; // Child configuration IDs
  level: number; // Depth in hierarchy (0 = root)
  
  // Inheritance rules
  inheritanceRules: InheritanceRule[];
  overrideRules: OverrideRule[];
  compositionRules: CompositionRule[];
  
  // Metadata
  version: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  tags: string[];
}

/**
 * Inheritance rule definition
 */
export interface InheritanceRule {
  id: string;
  name: string;
  description: string;
  
  // Rule configuration
  source: 'parent' | 'template' | 'environment' | 'default';
  target: 'parameters' | 'riskProfile' | 'execution' | 'monitoring' | 'performance';
  
  // Inheritance behavior
  behavior: 'inherit' | 'override' | 'merge' | 'compose' | 'conditional';
  condition?: InheritanceCondition;
  
  // Merge strategy (for merge behavior)
  mergeStrategy?: 'deep' | 'shallow' | 'additive' | 'selective';
  selectiveFields?: string[]; // For selective merge
  
  // Priority and ordering
  priority: number; // Higher numbers execute first
  enabled: boolean;
  
  // Validation
  validateAfterInheritance: boolean;
  validationRules?: string[];
}

/**
 * Override rule for specific conditions
 */
export interface OverrideRule {
  id: string;
  name: string;
  description: string;
  
  // Conditions for override
  conditions: Array<{
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'contains';
    value: unknown;
    source: 'environment' | 'parent' | 'template' | 'runtime';
  }>;
  
  // Override actions
  actions: Array<{
    target: string; // Field path (e.g., 'parameters.rsiPeriod.value')
    action: 'set' | 'multiply' | 'add' | 'append' | 'remove';
    value: unknown;
    condition?: string; // Additional condition
  }>;
  
  // Execution settings
  priority: number;
  enabled: boolean;
  applyOnce: boolean; // Apply only once per inheritance chain
}

/**
 * Composition rule for building configurations from modules
 */
export interface CompositionRule {
  id: string;
  name: string;
  description: string;
  
  // Composition strategy
  strategy: 'layered' | 'modular' | 'template_based' | 'dynamic';
  
  // Component sources
  components: Array<{
    id: string;
    source: 'template' | 'module' | 'library' | 'external';
    reference: string; // Template ID, module path, etc.
    order: number; // Composition order
    
    // Component configuration
    enabled: boolean;
    weight?: number; // For weighted composition
    constraints?: ComponentConstraint[];
    transformations?: ComponentTransformation[];
  }>;
  
  // Conflict resolution
  conflictResolution: {
    strategy: 'first_wins' | 'last_wins' | 'highest_priority' | 'merge' | 'error';
    customResolver?: string; // Function name for custom resolution
  };
  
  // Validation settings
  validateComponents: boolean;
  validateComposition: boolean;
  allowPartialComposition: boolean;
}

/**
 * Inheritance condition
 */
export interface InheritanceCondition {
  type: 'environment' | 'parameter_value' | 'runtime' | 'performance' | 'market_condition';
  
  // Condition specification
  field?: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value?: unknown;
  
  // Logical operators
  and?: InheritanceCondition[];
  or?: InheritanceCondition[];
  not?: InheritanceCondition;
}

/**
 * Component constraint
 */
export interface ComponentConstraint {
  type: 'dependency' | 'conflict' | 'requirement' | 'compatibility';
  target: string; // Component or parameter reference
  condition: string; // Constraint condition
  message?: string; // Error message if constraint fails
}

/**
 * Component transformation
 */
export interface ComponentTransformation {
  type: 'parameter_mapping' | 'value_transform' | 'structure_change' | 'validation_adjust';
  source: string; // Source field path
  target: string; // Target field path
  transform?: string; // Transformation function name
  parameters?: Record<string, unknown>; // Transformation parameters
}

/**
 * Configuration module definition
 */
export interface ConfigurationModule {
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Module type and category
  type: 'parameter_set' | 'indicator_config' | 'risk_profile' | 'execution_settings' | 'composite';
  category: string;
  
  // Module content
  parameters?: Record<string, EnhancedStrategyParameter>;
  riskProfile?: Partial<StrategyConfig['riskProfile']>;
  execution?: Partial<StrategyConfig['execution']>;
  monitoring?: Partial<StrategyConfig['monitoring']>;
  performance?: Partial<StrategyConfig['performance']>;
  
  // Dependencies and compatibility
  dependencies: string[]; // Required modules
  conflicts: string[]; // Conflicting modules
  compatibleWith: string[]; // Compatible strategy types
  
  // Usage and validation
  validationRules: ModuleValidationRule[];
  usageConstraints: ModuleUsageConstraint[];
  
  // Metadata
  author: string;
  tags: string[];
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
 * Module validation rule
 */
export interface ModuleValidationRule {
  id: string;
  type: 'parameter_check' | 'dependency_check' | 'conflict_check' | 'compatibility_check';
  condition: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Module usage constraint
 */
export interface ModuleUsageConstraint {
  type: 'environment' | 'strategy_type' | 'market_condition' | 'performance_requirement';
  condition: string;
  message?: string;
}

/**
 * Composition result
 */
export interface CompositionResult {
  success: boolean;
  configuration: StrategyConfig;
  
  // Composition metadata
  appliedComponents: Array<{
    id: string;
    source: string;
    order: number;
    conflicts?: string[];
    transformations?: string[];
  }>;
  
  // Resolution details
  conflicts: Array<{
    field: string;
    components: string[];
    resolution: string;
    resolvedValue: unknown;
  }>;
  
  // Validation results
  validation: ValidationResult;
  warnings: string[];
  
  // Performance information
  compositionTime: number;
  complexity: 'low' | 'medium' | 'high';
}

// =============================================================================
// CONFIGURATION INHERITANCE MANAGER
// =============================================================================

/**
 * Configuration Inheritance and Composition Manager
 * 
 * Manages hierarchical configuration inheritance, template composition,
 * and modular strategy building with enterprise-grade capabilities.
 * Performance target: <100ms for configuration loading with complex inheritance.
 */
export class ConfigurationInheritanceManager {
  private hierarchies: Map<string, InheritanceHierarchy> = new Map();
  private modules: Map<string, ConfigurationModule> = new Map();
  private templates: Map<string, StrategyConfigurationTemplate> = new Map();
  private inheritanceCache: Map<string, StrategyConfig> = new Map();
  
  // Performance tracking
  private inheritanceMetrics = {
    totalInheritances: 0,
    cacheHits: 0,
    averageInheritanceTime: 0,
    complexityDistribution: { low: 0, medium: 0, high: 0 },
    errorRate: 0
  };

  constructor() {
    this.initializeBuiltInModules();
  }

  /**
   * Create configuration through inheritance
   * Performance target: <100ms for large strategy sets
   */
  async createInheritedConfiguration(
    baseConfigurationId: string,
    hierarchyId: string,
    environment: string = 'production',
    overrides?: Partial<StrategyConfig>
  ): Promise<CompositionResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(baseConfigurationId, hierarchyId, environment);
      let baseConfig = this.inheritanceCache.get(cacheKey);
      
      if (!baseConfig) {
        // Get hierarchy and base configuration
        const hierarchy = this.hierarchies.get(hierarchyId);
        if (!hierarchy) {
          throw new Error(`Hierarchy '${hierarchyId}' not found`);
        }
        
        // Build configuration through inheritance chain
        baseConfig = await this.buildInheritanceChain(baseConfigurationId, hierarchy, environment);
        
        // Cache result
        this.inheritanceCache.set(cacheKey, baseConfig);
      } else {
        this.inheritanceMetrics.cacheHits++;
      }
      
      // Apply overrides if provided
      let finalConfig = baseConfig;
      if (overrides) {
        finalConfig = this.applyOverrides(baseConfig, overrides);
      }
      
      // Create composition result
      const result: CompositionResult = {
        success: true,
        configuration: finalConfig,
        appliedComponents: [], // Would be populated with actual components
        conflicts: [],
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
          validationTime: 0,
          validatedAt: new Date(),
          parameterResults: {},
          healthScore: 100,
          recommendations: []
        },
        warnings: [],
        compositionTime: Date.now() - startTime,
        complexity: this.assessConfigurationComplexity(finalConfig)
      };
      
      // Update metrics
      this.updateInheritanceMetrics(Date.now() - startTime, true, result.complexity);
      
      return result;
      
    } catch (error) {
      this.updateInheritanceMetrics(Date.now() - startTime, false, 'low');
      
      return {
        success: false,
        configuration: {} as StrategyConfig,
        appliedComponents: [],
        conflicts: [],
        validation: {
          isValid: false,
          errors: [{
            path: 'inheritance',
            message: error instanceof Error ? error.message : String(error),
            code: 'INHERITANCE_ERROR',
            severity: 'error'
          }],
          warnings: [],
          validationTime: 0,
          validatedAt: new Date(),
          parameterResults: {},
          healthScore: 0,
          recommendations: []
        },
        warnings: [],
        compositionTime: Date.now() - startTime,
        complexity: 'low'
      };
    }
  }

  /**
   * Compose configuration from modules
   */
  async composeConfiguration(
    compositionRules: CompositionRule[],
    baseTemplate?: string,
    environment: string = 'production'
  ): Promise<CompositionResult> {
    const startTime = Date.now();
    
    try {
      let baseConfig: Partial<StrategyConfig> = {};
      
      // Start with base template if provided
      if (baseTemplate) {
        const template = this.templates.get(baseTemplate);
        if (!template) {
          throw new Error(`Base template '${baseTemplate}' not found`);
        }
        baseConfig = this.templateToConfig(template);
      }
      
      // Apply composition rules in order
      const appliedComponents: CompositionResult['appliedComponents'] = [];
      const conflicts: CompositionResult['conflicts'] = [];
      
      for (const rule of compositionRules.sort((a, b) => a.components[0]?.order - b.components[0]?.order)) {
        const ruleResult = await this.applyCompositionRule(baseConfig, rule, environment);
        
        baseConfig = ruleResult.configuration;
        appliedComponents.push(...ruleResult.appliedComponents);
        conflicts.push(...ruleResult.conflicts);
      }
      
      // Validate final configuration
      const validation = await this.validateComposedConfiguration(baseConfig as StrategyConfig);
      
      const result: CompositionResult = {
        success: validation.isValid,
        configuration: baseConfig as StrategyConfig,
        appliedComponents,
        conflicts,
        validation,
        warnings: validation.warnings.map(w => w.message),
        compositionTime: Date.now() - startTime,
        complexity: this.assessConfigurationComplexity(baseConfig as StrategyConfig)
      };
      
      this.updateInheritanceMetrics(Date.now() - startTime, result.success, result.complexity);
      
      return result;
      
    } catch (error) {
      this.updateInheritanceMetrics(Date.now() - startTime, false, 'low');
      
      return {
        success: false,
        configuration: {} as StrategyConfig,
        appliedComponents: [],
        conflicts: [],
        validation: {
          isValid: false,
          errors: [{
            path: 'composition',
            message: error instanceof Error ? error.message : String(error),
            code: 'COMPOSITION_ERROR',
            severity: 'error'
          }],
          warnings: [],
          validationTime: 0,
          validatedAt: new Date(),
          parameterResults: {},
          healthScore: 0,
          recommendations: []
        },
        warnings: [],
        compositionTime: Date.now() - startTime,
        complexity: 'low'
      };
    }
  }

  /**
   * Register configuration module
   */
  public registerModule(module: ConfigurationModule): void {
    // Validate module
    this.validateModule(module);
    
    // Store module
    this.modules.set(module.id, module);
    
    // Initialize usage stats if not present
    if (!module.usageStats) {
      module.usageStats = {
        timesUsed: 0,
        avgPerformance: 0,
        lastUsed: new Date()
      };
    }
  }

  /**
   * Register inheritance hierarchy
   */
  public registerHierarchy(hierarchy: InheritanceHierarchy): void {
    this.hierarchies.set(hierarchy.id, hierarchy);
    
    // Clear cache for affected configurations
    this.clearHierarchyCache(hierarchy.id);
  }

  /**
   * Register strategy template
   */
  public registerTemplate(template: StrategyConfigurationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get available modules by category
   */
  public getModulesByCategory(category: string): ConfigurationModule[] {
    return Array.from(this.modules.values())
      .filter(module => module.category === category);
  }

  /**
   * Get available modules by type
   */
  public getModulesByType(type: ConfigurationModule['type']): ConfigurationModule[] {
    return Array.from(this.modules.values())
      .filter(module => module.type === type);
  }

  /**
   * Get module dependencies
   */
  public getModuleDependencies(moduleId: string): string[] {
    const module = this.modules.get(moduleId);
    return module ? module.dependencies : [];
  }

  /**
   * Check module compatibility
   */
  public checkModuleCompatibility(
    moduleIds: string[],
    strategyType?: string
  ): { compatible: boolean; conflicts: string[]; warnings: string[] } {
    const conflicts: string[] = [];
    const warnings: string[] = [];
    
    // Check for direct conflicts
    for (let i = 0; i < moduleIds.length; i++) {
      const moduleA = this.modules.get(moduleIds[i]);
      if (!moduleA) continue;
      
      for (let j = i + 1; j < moduleIds.length; j++) {
        const moduleB = this.modules.get(moduleIds[j]);
        if (!moduleB) continue;
        
        if (moduleA.conflicts.includes(moduleB.id) || moduleB.conflicts.includes(moduleA.id)) {
          conflicts.push(`Modules ${moduleA.name} and ${moduleB.name} are incompatible`);
        }
      }
      
      // Check strategy type compatibility
      if (strategyType && moduleA.compatibleWith.length > 0 && !moduleA.compatibleWith.includes(strategyType)) {
        warnings.push(`Module ${moduleA.name} may not be optimal for ${strategyType} strategies`);
      }
    }
    
    return {
      compatible: conflicts.length === 0,
      conflicts,
      warnings
    };
  }

  /**
   * Get inheritance metrics
   */
  public getInheritanceMetrics() {
    return { ...this.inheritanceMetrics };
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Build configuration through inheritance chain
   */
  private async buildInheritanceChain(
    configurationId: string,
    hierarchy: InheritanceHierarchy,
    environment: string
  ): Promise<StrategyConfig> {
    // Start with base configuration
    let config: Partial<StrategyConfig> = {};
    
    // Apply inheritance rules in priority order
    const sortedRules = hierarchy.inheritanceRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (this.evaluateInheritanceCondition(rule.condition, environment)) {
        config = await this.applyInheritanceRule(config, rule, environment);
      }
    }
    
    // Apply override rules
    const sortedOverrides = hierarchy.overrideRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const override of sortedOverrides) {
      if (this.evaluateOverrideConditions(override.conditions, config, environment)) {
        config = this.applyOverrideRule(config, override);
      }
    }
    
    return config as StrategyConfig;
  }

  /**
   * Apply inheritance rule
   */
  private async applyInheritanceRule(
    config: Partial<StrategyConfig>,
    rule: InheritanceRule,
    environment: string
  ): Promise<Partial<StrategyConfig>> {
    // Implementation would depend on rule behavior
    switch (rule.behavior) {
      case 'inherit':
        return this.applyInheritBehavior(config, rule, environment);
      case 'override':
        return this.applyOverrideBehavior(config, rule, environment);
      case 'merge':
        return this.applyMergeBehavior(config, rule, environment);
      case 'compose':
        return this.applyComposeBehavior(config, rule, environment);
      case 'conditional':
        return this.applyConditionalBehavior(config, rule, environment);
      default:
        return config;
    }
  }

  /**
   * Apply composition rule
   */
  private async applyCompositionRule(
    config: Partial<StrategyConfig>,
    rule: CompositionRule,
    environment: string
  ): Promise<{
    configuration: Partial<StrategyConfig>;
    appliedComponents: CompositionResult['appliedComponents'];
    conflicts: CompositionResult['conflicts'];
  }> {
    const appliedComponents: CompositionResult['appliedComponents'] = [];
    const conflicts: CompositionResult['conflicts'] = [];
    
    // Sort components by order
    const sortedComponents = rule.components
      .filter(comp => comp.enabled)
      .sort((a, b) => a.order - b.order);
    
    for (const component of sortedComponents) {
      try {
        const module = this.modules.get(component.reference);
        if (!module) {
          continue;
        }
        
        // Apply component transformations
        let componentConfig = this.moduleToConfig(module);
        if (component.transformations) {
          componentConfig = this.applyTransformations(componentConfig, component.transformations);
        }
        
        // Merge with existing configuration
        const mergeResult = this.mergeConfigurations(config, componentConfig, rule.conflictResolution);
        config = mergeResult.configuration;
        conflicts.push(...mergeResult.conflicts);
        
        appliedComponents.push({
          id: component.id,
          source: component.source,
          order: component.order,
          conflicts: mergeResult.conflicts.map(c => c.field),
          transformations: component.transformations?.map(t => t.type) || []
        });
        
      } catch (error) {
        // Log error but continue with other components
        console.warn(`Failed to apply component ${component.id}:`, error);
      }
    }
    
    return {
      configuration: config,
      appliedComponents,
      conflicts
    };
  }

  /**
   * Apply inheritance behaviors (stubs for now)
   */
  private async applyInheritBehavior(config: Partial<StrategyConfig>, rule: InheritanceRule, environment: string): Promise<Partial<StrategyConfig>> {
    // Implementation stub
    return config;
  }

  private async applyOverrideBehavior(config: Partial<StrategyConfig>, rule: InheritanceRule, environment: string): Promise<Partial<StrategyConfig>> {
    // Implementation stub
    return config;
  }

  private async applyMergeBehavior(config: Partial<StrategyConfig>, rule: InheritanceRule, environment: string): Promise<Partial<StrategyConfig>> {
    // Implementation stub
    return config;
  }

  private async applyComposeBehavior(config: Partial<StrategyConfig>, rule: InheritanceRule, environment: string): Promise<Partial<StrategyConfig>> {
    // Implementation stub
    return config;
  }

  private async applyConditionalBehavior(config: Partial<StrategyConfig>, rule: InheritanceRule, environment: string): Promise<Partial<StrategyConfig>> {
    // Implementation stub
    return config;
  }

  /**
   * Evaluate inheritance condition
   */
  private evaluateInheritanceCondition(condition: InheritanceCondition | undefined, environment: string): boolean {
    if (!condition) return true;
    
    // Implementation would evaluate condition based on type
    switch (condition.type) {
      case 'environment':
        return condition.value === environment;
      default:
        return true;
    }
  }

  /**
   * Evaluate override conditions
   */
  private evaluateOverrideConditions(
    conditions: OverrideRule['conditions'],
    config: Partial<StrategyConfig>,
    environment: string
  ): boolean {
    return conditions.every(condition => {
      // Implementation would evaluate each condition
      return true; // Stub
    });
  }

  /**
   * Apply override rule
   */
  private applyOverrideRule(config: Partial<StrategyConfig>, override: OverrideRule): Partial<StrategyConfig> {
    const newConfig = { ...config };
    
    for (const action of override.actions) {
      // Implementation would apply the action to the config
      // This is a simplified version
      this.setNestedProperty(newConfig, action.target, action.value);
    }
    
    return newConfig;
  }

  /**
   * Merge configurations with conflict resolution
   */
  private mergeConfigurations(
    base: Partial<StrategyConfig>,
    overlay: Partial<StrategyConfig>,
    conflictResolution: CompositionRule['conflictResolution']
  ): {
    configuration: Partial<StrategyConfig>;
    conflicts: CompositionResult['conflicts'];
  } {
    const merged = { ...base };
    const conflicts: CompositionResult['conflicts'] = [];
    
    // Implementation would perform deep merge with conflict detection
    Object.assign(merged, overlay);
    
    return {
      configuration: merged,
      conflicts
    };
  }

  /**
   * Apply transformations to configuration
   */
  private applyTransformations(
    config: Partial<StrategyConfig>,
    transformations: ComponentTransformation[]
  ): Partial<StrategyConfig> {
    let transformed = { ...config };
    
    for (const transform of transformations) {
      // Implementation would apply transformation based on type
      transformed = this.applyTransformation(transformed, transform);
    }
    
    return transformed;
  }

  /**
   * Apply single transformation
   */
  private applyTransformation(
    config: Partial<StrategyConfig>,
    transform: ComponentTransformation
  ): Partial<StrategyConfig> {
    // Implementation stub
    return config;
  }

  /**
   * Convert template to config
   */
  private templateToConfig(template: StrategyConfigurationTemplate): Partial<StrategyConfig> {
    return {
      name: template.name,
      description: template.description,
      type: template.strategyType as any,
      riskProfile: template.riskProfile,
      execution: template.execution,
      monitoring: template.monitoring,
      performance: template.performance
    };
  }

  /**
   * Convert module to config
   */
  private moduleToConfig(module: ConfigurationModule): Partial<StrategyConfig> {
    return {
      parameters: module.parameters as any,
      riskProfile: module.riskProfile as any,
      execution: module.execution as any,
      monitoring: module.monitoring as any,
      performance: module.performance
    };
  }

  /**
   * Apply overrides to configuration
   */
  private applyOverrides(base: StrategyConfig, overrides: Partial<StrategyConfig>): StrategyConfig {
    return { ...base, ...overrides };
  }

  /**
   * Validate composed configuration
   */
  private async validateComposedConfiguration(config: StrategyConfig): Promise<ValidationResult> {
    // Implementation would perform comprehensive validation
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validationTime: 0,
      validatedAt: new Date(),
      parameterResults: {},
      healthScore: 100,
      recommendations: []
    };
  }

  /**
   * Validate module
   */
  private validateModule(module: ConfigurationModule): void {
    if (!module.id || !module.name) {
      throw new Error('Module must have id and name');
    }
    
    if (this.modules.has(module.id)) {
      throw new Error(`Module with id '${module.id}' already exists`);
    }
  }

  /**
   * Assess configuration complexity
   */
  private assessConfigurationComplexity(config: StrategyConfig): 'low' | 'medium' | 'high' {
    let complexity = 0;
    
    // Count parameters
    if (config.parameters) {
      complexity += Object.keys(config.parameters).length;
    }
    
    // Add complexity for advanced features
    if (config.riskProfile?.positionSizing === 'kelly') complexity += 5;
    if (config.execution?.orderType === 'stop_limit') complexity += 3;
    
    if (complexity < 10) return 'low';
    if (complexity < 20) return 'medium';
    return 'high';
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(configId: string, hierarchyId: string, environment: string): string {
    return `${configId}_${hierarchyId}_${environment}`;
  }

  /**
   * Clear hierarchy cache
   */
  private clearHierarchyCache(hierarchyId: string): void {
    const keysToDelete = Array.from(this.inheritanceCache.keys())
      .filter(key => key.includes(hierarchyId));
    
    keysToDelete.forEach(key => this.inheritanceCache.delete(key));
  }

  /**
   * Set nested property using path
   */
  private setNestedProperty(obj: any, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Update inheritance metrics
   */
  private updateInheritanceMetrics(
    executionTime: number,
    success: boolean,
    complexity: 'low' | 'medium' | 'high'
  ): void {
    this.inheritanceMetrics.totalInheritances++;
    this.inheritanceMetrics.complexityDistribution[complexity]++;
    
    if (!success) {
      this.inheritanceMetrics.errorRate = 
        (this.inheritanceMetrics.errorRate * (this.inheritanceMetrics.totalInheritances - 1) + 1) / 
        this.inheritanceMetrics.totalInheritances;
    } else {
      this.inheritanceMetrics.errorRate = 
        (this.inheritanceMetrics.errorRate * (this.inheritanceMetrics.totalInheritances - 1)) / 
        this.inheritanceMetrics.totalInheritances;
    }
    
    const totalTime = this.inheritanceMetrics.averageInheritanceTime * (this.inheritanceMetrics.totalInheritances - 1) + executionTime;
    this.inheritanceMetrics.averageInheritanceTime = totalTime / this.inheritanceMetrics.totalInheritances;
  }

  /**
   * Initialize built-in modules
   */
  private initializeBuiltInModules(): void {
    // Conservative risk profile module
    this.registerModule({
      id: 'conservative_risk',
      name: 'Conservative Risk Profile',
      description: 'Low-risk trading configuration for conservative strategies',
      version: '1.0.0',
      type: 'risk_profile',
      category: 'risk_management',
      riskProfile: {
        maxRiskPerTrade: 1,
        maxPortfolioRisk: 5,
        stopLossType: 'trailing',
        takeProfitType: 'fixed',
        positionSizing: 'fixed'
      },
      dependencies: [],
      conflicts: ['aggressive_risk'],
      compatibleWith: ['trend_following', 'mean_reversion'],
      validationRules: [],
      usageConstraints: [],
      author: 'System',
      tags: ['conservative', 'low-risk'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Aggressive risk profile module
    this.registerModule({
      id: 'aggressive_risk',
      name: 'Aggressive Risk Profile',
      description: 'High-risk trading configuration for aggressive strategies',
      version: '1.0.0',
      type: 'risk_profile',
      category: 'risk_management',
      riskProfile: {
        maxRiskPerTrade: 5,
        maxPortfolioRisk: 20,
        stopLossType: 'atr',
        takeProfitType: 'trailing',
        positionSizing: 'kelly'
      },
      dependencies: [],
      conflicts: ['conservative_risk'],
      compatibleWith: ['momentum', 'breakout'],
      validationRules: [],
      usageConstraints: [],
      author: 'System',
      tags: ['aggressive', 'high-risk'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}

export default ConfigurationInheritanceManager;