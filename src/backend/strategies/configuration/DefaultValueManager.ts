// =============================================================================
// DEFAULT VALUE MANAGER - BE-009 Implementation
// =============================================================================
// Advanced default value management system with inheritance chains,
// strategy-specific rules, and environment-aware configuration.
//
// Key Features:
// - Inheritance-based default value resolution
// - Strategy-specific configuration rules
// - Environment-based configuration overrides
// - Rule-based default value computation
// - Comprehensive validation and confidence scoring
// =============================================================================

export interface DefaultValueRule {
  id: string;
  name: string;
  description?: string;
  priority: number; // Higher priority = applied first
  conditions: {
    parameterName?: string | RegExp;
    parameterType?: string[];
    strategyType?: string[];
    environment?: string[];
    context?: Record<string, unknown>;
  };
  defaultValue: unknown | ((context: DefaultValueContext) => unknown);
  validation?: {
    validator?: (value: unknown, context: DefaultValueContext) => boolean;
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
    range?: { min?: number; max?: number };
    pattern?: RegExp;
  };
  inheritance?: {
    inheritable: boolean;
    overridable: boolean;
  };
  metadata?: {
    category: string;
    author?: string;
    version?: string;
    documentation?: string;
    description?: string;
  };
}

export interface DefaultValueContext {
  parameterName: string;
  parameterType: string;
  strategyType: string;
  environment: 'development' | 'testing' | 'production';
  parentStrategy?: string; // For inheritance
  allParameters?: Record<string, unknown>;
  userDefaults?: Record<string, unknown>;
  systemDefaults?: Record<string, unknown>;
  depth: number;
}

export interface DefaultValueResult {
  value: unknown;
  source: 'user' | 'strategy' | 'system' | 'computed' | 'inherited';
  appliedRules: string[];
  warnings: string[];
  confidence: number; // 0-1
  metadata?: Record<string, unknown>;
}

export interface InheritanceChain {
  strategyType: string;
  parent?: InheritanceChain;
  defaults: Record<string, unknown>;
  rules: DefaultValueRule[];
}

// =============================================================================
// DEFAULT VALUE MANAGER
// =============================================================================

/**
 * Advanced default value management system with inheritance
 */
export class DefaultValueManager {
  private rules: DefaultValueRule[] = [];
  private inheritanceChains: Map<string, InheritanceChain> = new Map();
  private systemDefaults: Record<string, unknown> = {};
  private environmentDefaults: Map<string, Record<string, unknown>> = new Map();

  constructor() {
    this.initializeSystemDefaults();
    this.initializeBuiltInRules();
    this.initializeInheritanceChains();
  }

  /**
   * Get default value for a parameter with full inheritance resolution
   */
  async getDefaultValue(
    parameterName: string,
    context: Omit<DefaultValueContext, 'depth'>
  ): Promise<DefaultValueResult> {
    const fullContext: DefaultValueContext = {
      ...context,
      depth: 0
    };

    return this.resolveDefaultValue(parameterName, fullContext);
  }

  /**
   * Resolve default value through inheritance chain
   */
  private async resolveDefaultValue(
    parameterName: string,
    context: DefaultValueContext
  ): Promise<DefaultValueResult> {
    const result: DefaultValueResult = {
      value: undefined,
      source: 'system',
      appliedRules: [],
      warnings: [],
      confidence: 0
    };

    // Prevent infinite recursion
    if (context.depth > 10) {
      result.warnings.push('Maximum inheritance depth exceeded');
      return result;
    }

    // 1. Check user-provided defaults first
    if (context.userDefaults && context.userDefaults[parameterName] !== undefined) {
      result.value = context.userDefaults[parameterName];
      result.source = 'user';
      result.confidence = 1.0;
      return result;
    }

    // 2. Apply matching rules in priority order
    const matchingRules = this.findMatchingRules(parameterName, context);
    matchingRules.sort((a, b) => b.priority - a.priority);

    for (const rule of matchingRules) {
      const ruleResult = await this.applyRule(rule, parameterName, context);
      if (ruleResult.value !== undefined) {
        result.value = ruleResult.value;
        result.source = ruleResult.source;
        result.confidence = Math.max(result.confidence, ruleResult.confidence);
        result.appliedRules.push(rule.id);
        result.warnings.push(...ruleResult.warnings);

        // If rule is not overridable, stop here
        if (rule.inheritance?.overridable === false) {
          break;
        }
      }
    }

    // 3. Check inheritance chain if no value found
    if (result.value === undefined && context.parentStrategy) {
      const inheritedResult = await this.resolveInheritedValue(parameterName, context);
      if (inheritedResult.value !== undefined) {
        result.value = inheritedResult.value;
        result.source = 'inherited';
        result.confidence = inheritedResult.confidence * 0.8; // Slightly lower confidence for inherited values
        result.warnings.push(...inheritedResult.warnings);
        result.appliedRules.push(...inheritedResult.appliedRules);
      }
    }

    // 4. Environment-specific defaults
    if (result.value === undefined) {
      const envDefaults = this.environmentDefaults.get(context.environment);
      if (envDefaults && envDefaults[parameterName] !== undefined) {
        result.value = envDefaults[parameterName];
        result.source = 'system';
        result.confidence = 0.7;
      }
    }

    // 5. System defaults as final fallback
    if (result.value === undefined && this.systemDefaults[parameterName] !== undefined) {
      result.value = this.systemDefaults[parameterName];
      result.source = 'system';
      result.confidence = 0.5;
    }

    // 6. Parameter type-specific defaults
    if (result.value === undefined) {
      result.value = this.getTypeSpecificDefault(context.parameterType);
      if (result.value !== undefined) {
        result.source = 'computed';
        result.confidence = 0.3;
        result.warnings.push('Using type-specific default value');
      }
    }

    return result;
  }

  /**
   * Apply a specific rule to get default value
   */
  private async applyRule(
    rule: DefaultValueRule,
    parameterName: string,
    context: DefaultValueContext
  ): Promise<DefaultValueResult> {
    const result: DefaultValueResult = {
      value: undefined,
      source: 'system',
      appliedRules: [],
      warnings: [],
      confidence: 0.8
    };

    try {
      // Get value from rule
      let value: unknown;
      if (typeof rule.defaultValue === 'function') {
        value = (rule.defaultValue as (context: DefaultValueContext) => unknown)(context);
      } else {
        value = rule.defaultValue;
      }

      // Validate if validator is provided
      if (rule.validation?.validator) {
        if (!rule.validation.validator(value, context)) {
          result.warnings.push(`Rule ${rule.id} validation failed`);
          return result;
        }
      }

      // Type validation
      if (rule.validation?.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rule.validation.type) {
          result.warnings.push(`Rule ${rule.id} type mismatch: expected ${rule.validation.type}, got ${actualType}`);
          return result;
        }
      }

      result.value = value;
      result.source = 'strategy';

    } catch (error) {
      result.warnings.push(`Rule ${rule.id} execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Resolve inherited value from parent strategy
   */
  private async resolveInheritedValue(
    parameterName: string,
    context: DefaultValueContext
  ): Promise<DefaultValueResult> {
    const parentChain = this.inheritanceChains.get(context.parentStrategy!);
    if (!parentChain) {
      return {
        value: undefined,
        source: 'inherited',
        appliedRules: [],
        warnings: ['Parent strategy not found in inheritance chain'],
        confidence: 0
      };
    }

    // Check direct parent defaults first
    if (parentChain.defaults[parameterName] !== undefined) {
      return {
        value: parentChain.defaults[parameterName],
        source: 'inherited',
        appliedRules: [],
        warnings: [],
        confidence: 0.8
      };
    }

    // Recursively check parent's parent if exists
    if (parentChain.parent) {
      const grandParentContext: DefaultValueContext = {
        ...context,
        strategyType: parentChain.parent.strategyType,
        parentStrategy: parentChain.parent.parent?.strategyType,
        depth: context.depth + 1
      };

      return this.resolveDefaultValue(parameterName, grandParentContext);
    }

    return {
      value: undefined,
      source: 'inherited',
      appliedRules: [],
      warnings: [],
      confidence: 0
    };
  }

  /**
   * Find rules that match the current parameter and context
   */
  private findMatchingRules(parameterName: string, context: DefaultValueContext): DefaultValueRule[] {
    return this.rules.filter(rule => {
      // Parameter name matching
      if (rule.conditions.parameterName) {
        if (typeof rule.conditions.parameterName === 'string') {
          if (rule.conditions.parameterName !== parameterName) {
            return false;
          }
        } else if (rule.conditions.parameterName instanceof RegExp) {
          if (!rule.conditions.parameterName.test(parameterName)) {
            return false;
          }
        }
      }

      // Parameter type matching
      if (rule.conditions.parameterType && !rule.conditions.parameterType.includes(context.parameterType)) {
        return false;
      }

      // Strategy type matching
      if (rule.conditions.strategyType && !rule.conditions.strategyType.includes(context.strategyType)) {
        return false;
      }

      // Environment matching
      if (rule.conditions.environment && !rule.conditions.environment.includes(context.environment)) {
        return false;
      }

      // Context matching
      if (rule.conditions.context) {
        for (const [key, value] of Object.entries(rule.conditions.context)) {
          if (context.allParameters?.[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Get type-specific default value
   */
  private getTypeSpecificDefault(parameterType: string): unknown {
    const typeDefaults: Record<string, unknown> = {
      string: '',
      number: 0,
      boolean: false,
      array: [],
      object: {},
      percentage: 0,
      price: 0,
      symbol: 'BTC-USD',
      timeframe: '1h',
      exchange: 'dydx'
    };

    return typeDefaults[parameterType];
  }

  /**
   * Register a new default value rule
   */
  registerRule(rule: DefaultValueRule): void {
    // Validate rule
    if (!rule.id || !rule.name || rule.priority === undefined) {
      throw new Error('Rule must have id, name, and priority');
    }

    // Check for duplicate IDs
    const existingIndex = this.rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule; // Replace existing rule
    } else {
      this.rules.push(rule);
    }

    // Sort rules by priority
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register inheritance chain for strategy types
   */
  registerInheritanceChain(strategyType: string, chain: InheritanceChain): void {
    this.inheritanceChains.set(strategyType, chain);
  }

  /**
   * Set environment-specific defaults
   */
  setEnvironmentDefaults(environment: string, defaults: Record<string, unknown>): void {
    this.environmentDefaults.set(environment, defaults);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): DefaultValueRule[] {
    return [...this.rules];
  }

  /**
   * Get inheritance chain for strategy type
   */
  getInheritanceChain(strategyType: string): InheritanceChain | undefined {
    return this.inheritanceChains.get(strategyType);
  }

  /**
   * Initialize system-wide defaults
   */
  private initializeSystemDefaults(): void {
    this.systemDefaults = {
      // Risk management defaults
      maxRiskPerTrade: 2,
      maxPortfolioRisk: 10,
      maxDrawdown: 20,

      // Execution defaults
      timeout: 30,
      retries: 3,
      slippage: 0.1,

      // Trading defaults
      timeframes: ['1h'],
      symbols: ['BTC-USD'],
      exchanges: ['dydx'],

      // Position management
      maxConcurrentPositions: 5,
      positionSizing: 'percent_balance',

      // Technical indicators
      smaLength: 20,
      emaLength: 12,
      rsiLength: 14,

      // Strategy execution
      enabled: false,
      paperTrading: true,
      logLevel: 'info'
    };
  }

  /**
   * Initialize built-in default value rules
   */
  private initializeBuiltInRules(): void {
    // Risk management rules
    this.registerRule({
      id: 'conservative_risk',
      name: 'Conservative Risk Management',
      priority: 100,
      conditions: {
        parameterName: /.*[Rr]isk.*/,
        environment: ['production']
      },
      defaultValue: (context: DefaultValueContext) => {
        if (context.parameterName.includes('Trade')) return 1;
        if (context.parameterName.includes('Portfolio')) return 5;
        return 2;
      },
      inheritance: {
        inheritable: true,
        overridable: true
      },
      metadata: {
        description: 'Applies conservative risk values in production',
        category: 'risk_management'
      }
    });

    // Development environment rules
    this.registerRule({
      id: 'dev_paper_trading',
      name: 'Development Paper Trading',
      priority: 90,
      conditions: {
        parameterName: 'paperTrading',
        environment: ['development', 'testing']
      },
      defaultValue: true,
      inheritance: {
        inheritable: true,
        overridable: true
      },
      metadata: {
        description: 'Enables paper trading in non-production environments',
        category: 'safety'
      }
    });

    // Timeframe defaults based on strategy type
    this.registerRule({
      id: 'scalping_timeframes',
      name: 'Scalping Strategy Timeframes',
      priority: 80,
      conditions: {
        strategyType: ['scalping', 'hft'],
        parameterName: 'timeframes'
      },
      defaultValue: ['1m', '5m'],
      inheritance: {
        inheritable: true,
        overridable: true
      },
      metadata: {
        description: 'Short timeframes for scalping strategies',
        category: 'strategy_specific'
      }
    });

    this.registerRule({
      id: 'swing_timeframes',
      name: 'Swing Trading Timeframes',
      priority: 80,
      conditions: {
        strategyType: ['swing', 'position'],
        parameterName: 'timeframes'
      },
      defaultValue: ['4h', '1d'],
      inheritance: {
        inheritable: true,
        overridable: true
      },
      metadata: {
        description: 'Longer timeframes for swing trading',
        category: 'strategy_specific'
      }
    });

    // Indicator length defaults
    this.registerRule({
      id: 'indicator_lengths',
      name: 'Standard Indicator Lengths',
      priority: 70,
      conditions: {
        parameterName: /.*Length$/
      },
      defaultValue: (context: DefaultValueContext) => {
        const name = context.parameterName.toLowerCase();
        if (name.includes('sma')) return 20;
        if (name.includes('ema')) return 12;
        if (name.includes('rsi')) return 14;
        if (name.includes('macd')) return 26;
        return 14; // Default
      },
      inheritance: {
        inheritable: true,
        overridable: true
      },
      metadata: {
        description: 'Standard lengths for technical indicators',
        category: 'technical_analysis'
      }
    });
  }

  /**
   * Initialize strategy inheritance chains
   */
  private initializeInheritanceChains(): void {
    // Base strategy
    const baseStrategy: InheritanceChain = {
      strategyType: 'base',
      defaults: {
        enabled: false,
        paperTrading: true,
        maxRiskPerTrade: 2,
        timeout: 30
      },
      rules: []
    };

    // Trend following inherits from base
    const trendFollowing: InheritanceChain = {
      strategyType: 'trend_following',
      parent: baseStrategy,
      defaults: {
        timeframes: ['1h', '4h'],
        smaLength: 20,
        emaLength: 12,
        trendStrength: 0.7
      },
      rules: []
    };

    // Moving average crossover inherits from trend following
    const maCrossover: InheritanceChain = {
      strategyType: 'ma_crossover',
      parent: trendFollowing,
      defaults: {
        fastMaLength: 12,
        slowMaLength: 26,
        signalConfirmation: 2
      },
      rules: []
    };

    // Mean reversion inherits from base
    const meanReversion: InheritanceChain = {
      strategyType: 'mean_reversion',
      parent: baseStrategy,
      defaults: {
        timeframes: ['15m', '1h'],
        rsiLength: 14,
        oversoldLevel: 30,
        overboughtLevel: 70
      },
      rules: []
    };

    // Register all chains
    this.inheritanceChains.set('base', baseStrategy);
    this.inheritanceChains.set('trend_following', trendFollowing);
    this.inheritanceChains.set('ma_crossover', maCrossover);
    this.inheritanceChains.set('mean_reversion', meanReversion);
  }
}

// =============================================================================
// FACTORY FUNCTIONS AND UTILITIES
// =============================================================================

/**
 * Create a default value manager with standard configuration
 */
export function createDefaultValueManager(): DefaultValueManager {
  return new DefaultValueManager();
}

/**
 * Quick function to get a default value
 */
export async function getDefaultValue(
  parameterName: string,
  parameterType: string,
  strategyType: string,
  environment: 'development' | 'testing' | 'production' = 'development'
): Promise<unknown> {
  const manager = new DefaultValueManager();

  const result = await manager.getDefaultValue(parameterName, {
    parameterName,
    parameterType,
    strategyType,
    environment
  });

  return result.value;
}

/**
 * Merge user configuration with default values
 */
export async function mergeWithDefaults(
  userConfig: Record<string, unknown>,
  strategyType: string,
  environment: 'development' | 'testing' | 'production' = 'development'
): Promise<Record<string, unknown>> {
  const manager = new DefaultValueManager();
  const merged: Record<string, unknown> = { ...userConfig };

  // Get all possible parameter names from system defaults and user config
  const allParams = new Set([
    ...Object.keys(userConfig),
    ...Object.keys(manager['systemDefaults'])
  ]);

  for (const paramName of allParams) {
    if (merged[paramName] === undefined) {
      const result = await manager.getDefaultValue(paramName, {
        parameterName: paramName,
        parameterType: typeof merged[paramName] || 'unknown',
        strategyType,
        environment,
        userDefaults: userConfig
      });

      if (result.value !== undefined) {
        merged[paramName] = result.value;
      }
    }
  }

  return merged;
}