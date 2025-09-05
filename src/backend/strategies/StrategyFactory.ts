/**
 * Strategy Factory - Task BE-007: Base Strategy Interface Design
 * 
 * Factory class for creating and managing strategy instances.
 * Provides type-safe strategy creation, validation, and registry management.
 */

import { BaseStrategy } from './BaseStrategy.js';
import { SimpleMovingAverageCrossStrategy } from './examples/SimpleMovingAverageCrossStrategy.js';
import type { StrategyConfig } from './types.js';
import type { Strategy } from '../types/database.js';

/**
 * Strategy type registry mapping
 */
export type StrategyType = 'sma_cross' | 'rsi_divergence' | 'macd_signal' | 'ml_prediction' | 'hybrid_ensemble';

/**
 * Strategy constructor interface
 */
interface StrategyConstructor<T extends BaseStrategy = BaseStrategy> {
  new(config: StrategyConfig): T;
  createDefaultConfig?(overrides?: Partial<StrategyConfig>): StrategyConfig;
}

/**
 * Strategy registry entry
 */
interface StrategyRegistryEntry {
  name: string;
  description: string;
  type: Strategy['type'];
  constructor: StrategyConstructor;
  defaultConfig: () => StrategyConfig;
  supportedTimeframes: string[];
  supportedAssets: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: 'trend_following' | 'mean_reversion' | 'momentum' | 'arbitrage' | 'ml' | 'hybrid';
}

/**
 * Strategy Factory for creating and managing trading strategies
 */
export class StrategyFactory {
  private static instance: StrategyFactory;
  private readonly registry = new Map<StrategyType, StrategyRegistryEntry>();

  private constructor() {
    this.initializeRegistry();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): StrategyFactory {
    if (!StrategyFactory.instance) {
      StrategyFactory.instance = new StrategyFactory();
    }
    return StrategyFactory.instance;
  }

  /**
   * Initialize the strategy registry with available strategies
   */
  private initializeRegistry(): void {
    // Register Simple Moving Average Cross Strategy
    this.registry.set('sma_cross', {
      name: 'Simple Moving Average Cross',
      description: 'Classic trend-following strategy based on moving average crossovers',
      type: 'technical',
      constructor: SimpleMovingAverageCrossStrategy,
      defaultConfig: () => SimpleMovingAverageCrossStrategy.createDefaultConfig(),
      supportedTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d'],
      supportedAssets: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD'],
      complexity: 'beginner',
      category: 'trend_following'
    });

    // TODO: Register other strategies as they are implemented
    // this.registry.set('rsi_divergence', { ... });
    // this.registry.set('macd_signal', { ... });
    // this.registry.set('ml_prediction', { ... });
    // this.registry.set('hybrid_ensemble', { ... });
  }

  /**
   * Create a strategy instance from configuration
   */
  public createStrategy(config: StrategyConfig): BaseStrategy {
    // Try to determine strategy type from configuration
    const strategyType = this.determineStrategyType(config);
    
    if (!strategyType) {
      throw new Error(`Cannot determine strategy type from configuration: ${config.name}`);
    }

    return this.createStrategyByType(strategyType, config);
  }

  /**
   * Create a strategy instance by type
   */
  public createStrategyByType(type: StrategyType, config?: StrategyConfig): BaseStrategy {
    const entry = this.registry.get(type);
    
    if (!entry) {
      throw new Error(`Strategy type '${type}' is not registered`);
    }

    // Use provided config or create default
    const strategyConfig = config || entry.defaultConfig();
    
    // Validate configuration matches strategy requirements
    this.validateConfigurationForType(type, strategyConfig);

    // Create strategy instance
    return new entry.constructor(strategyConfig);
  }

  /**
   * Create a strategy with default configuration
   */
  public createDefaultStrategy(type: StrategyType, overrides: Partial<StrategyConfig> = {}): BaseStrategy {
    const entry = this.registry.get(type);
    
    if (!entry) {
      throw new Error(`Strategy type '${type}' is not registered`);
    }

    // Get default config and apply overrides
    const defaultConfig = entry.defaultConfig();
    const config: StrategyConfig = {
      ...defaultConfig,
      ...overrides,
      parameters: {
        ...defaultConfig.parameters,
        ...overrides.parameters
      },
      riskProfile: {
        ...defaultConfig.riskProfile,
        ...overrides.riskProfile
      },
      execution: {
        ...defaultConfig.execution,
        ...overrides.execution
      },
      monitoring: {
        ...defaultConfig.monitoring,
        ...overrides.monitoring
      }
    };

    return new entry.constructor(config);
  }

  /**
   * Get available strategy types
   */
  public getAvailableStrategyTypes(): StrategyType[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get strategy registry information
   */
  public getStrategyInfo(type: StrategyType): StrategyRegistryEntry | undefined {
    return this.registry.get(type);
  }

  /**
   * Get all strategy registry entries
   */
  public getAllStrategyInfo(): Map<StrategyType, StrategyRegistryEntry> {
    return new Map(this.registry);
  }

  /**
   * Get strategies by category
   */
  public getStrategiesByCategory(category: StrategyRegistryEntry['category']): StrategyType[] {
    return Array.from(this.registry.entries())
      .filter(([_, entry]) => entry.category === category)
      .map(([type]) => type);
  }

  /**
   * Get strategies by complexity level
   */
  public getStrategiesByComplexity(complexity: StrategyRegistryEntry['complexity']): StrategyType[] {
    return Array.from(this.registry.entries())
      .filter(([_, entry]) => entry.complexity === complexity)
      .map(([type]) => type);
  }

  /**
   * Get strategies supporting specific timeframe
   */
  public getStrategiesForTimeframe(timeframe: string): StrategyType[] {
    return Array.from(this.registry.entries())
      .filter(([_, entry]) => entry.supportedTimeframes.includes(timeframe))
      .map(([type]) => type);
  }

  /**
   * Get strategies supporting specific asset
   */
  public getStrategiesForAsset(asset: string): StrategyType[] {
    return Array.from(this.registry.entries())
      .filter(([_, entry]) => 
        entry.supportedAssets.includes(asset) || 
        entry.supportedAssets.includes('*') // Universal support
      )
      .map(([type]) => type);
  }

  /**
   * Validate if a strategy supports given parameters
   */
  public validateStrategySupport(type: StrategyType, timeframes: string[], assets: string[]): {
    isSupported: boolean;
    unsupportedTimeframes: string[];
    unsupportedAssets: string[];
  } {
    const entry = this.registry.get(type);
    
    if (!entry) {
      return {
        isSupported: false,
        unsupportedTimeframes: timeframes,
        unsupportedAssets: assets
      };
    }

    const unsupportedTimeframes = timeframes.filter(tf => 
      !entry.supportedTimeframes.includes(tf)
    );

    const unsupportedAssets = assets.filter(asset => 
      !entry.supportedAssets.includes(asset) && 
      !entry.supportedAssets.includes('*')
    );

    return {
      isSupported: unsupportedTimeframes.length === 0 && unsupportedAssets.length === 0,
      unsupportedTimeframes,
      unsupportedAssets
    };
  }

  /**
   * Register a new strategy type
   */
  public registerStrategy(type: StrategyType, entry: StrategyRegistryEntry): void {
    if (this.registry.has(type)) {
      throw new Error(`Strategy type '${type}' is already registered`);
    }

    this.registry.set(type, entry);
  }

  /**
   * Unregister a strategy type
   */
  public unregisterStrategy(type: StrategyType): boolean {
    return this.registry.delete(type);
  }

  /**
   * PRIVATE HELPER METHODS
   */

  /**
   * Determine strategy type from configuration
   */
  private determineStrategyType(config: StrategyConfig): StrategyType | null {
    // Check if config has explicit type information
    if ('strategyType' in config && typeof config.strategyType === 'string') {
      return config.strategyType as StrategyType;
    }

    // Try to infer from strategy name or other properties
    const name = config.name.toLowerCase();
    
    if (name.includes('sma') || name.includes('moving average') || name.includes('ma cross')) {
      return 'sma_cross';
    }
    
    if (name.includes('rsi') || name.includes('divergence')) {
      return 'rsi_divergence';
    }
    
    if (name.includes('macd')) {
      return 'macd_signal';
    }
    
    if (name.includes('ml') || name.includes('machine learning') || name.includes('prediction')) {
      return 'ml_prediction';
    }
    
    if (name.includes('hybrid') || name.includes('ensemble')) {
      return 'hybrid_ensemble';
    }

    return null;
  }

  /**
   * Validate configuration for specific strategy type
   */
  private validateConfigurationForType(type: StrategyType, config: StrategyConfig): void {
    const entry = this.registry.get(type);
    
    if (!entry) {
      return;
    }

    // Validate timeframes
    const unsupportedTimeframes = config.timeframes.filter(tf => 
      !entry.supportedTimeframes.includes(tf)
    );
    if (unsupportedTimeframes.length > 0) {
      throw new Error(
        `Strategy '${type}' does not support timeframes: ${unsupportedTimeframes.join(', ')}`
      );
    }

    // Validate assets
    const unsupportedAssets = config.symbols.filter(symbol => 
      !entry.supportedAssets.includes(symbol) && 
      !entry.supportedAssets.includes('*')
    );
    if (unsupportedAssets.length > 0) {
      throw new Error(
        `Strategy '${type}' does not support assets: ${unsupportedAssets.join(', ')}`
      );
    }

    // Validate strategy type matches
    if (config.type !== entry.type) {
      console.warn(
        `Configuration type '${config.type}' does not match registry type '${entry.type}' for strategy '${type}'`
      );
    }
  }
}

/**
 * Convenience function to create strategy factory instance
 */
export const createStrategyFactory = (): StrategyFactory => {
  return StrategyFactory.getInstance();
};

/**
 * Convenience function to create a strategy by type
 */
export const createStrategy = (type: StrategyType, config?: StrategyConfig): BaseStrategy => {
  return StrategyFactory.getInstance().createStrategyByType(type, config);
};

export default StrategyFactory;