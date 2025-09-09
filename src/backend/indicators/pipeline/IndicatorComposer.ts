/**
 * Indicator Composer - Task BE-012
 * 
 * Advanced indicator composition system for creating complex indicators
 * from simpler components. Supports mathematical operations, chaining,
 * and custom transformation functions.
 */

import { EventEmitter } from 'events';
import type { OHLCV, IndicatorResult } from '../base/types.js';
import type { TechnicalIndicator } from '../base/TechnicalIndicator.js';

// =============================================================================
// COMPOSITION TYPES AND INTERFACES
// =============================================================================

export interface CompositeIndicatorSpec {
  id: string;
  name: string;
  components: CompositeComponent[];
  combineFunction: (values: number[], context?: CompositionContext) => number;
  metadata: {
    description: string;
    formula: string;
    tags: string[];
  };
}

export interface CompositeComponent {
  indicatorId: string;
  weight?: number;
  transform?: TransformFunction;
  alias?: string;
  enabled: boolean;
}

export interface ChainedIndicatorSpec {
  id: string;
  name: string;
  chain: ChainLink[];
  metadata: {
    description: string;
    stages: string[];
    tags: string[];
  };
}

export interface ChainLink {
  indicatorId: string;
  transform?: TransformFunction;
  passThrough?: boolean; // Pass original data or transformed result to next stage
}

export interface CompositionContext {
  timestamp: Date;
  symbol?: string;
  metadata: Record<string, any>;
}

export type TransformFunction = (input: any, context?: CompositionContext) => any;

// =============================================================================
// BUILT-IN TRANSFORM FUNCTIONS
// =============================================================================

export const BuiltInTransforms = {
  // Mathematical operations
  abs: (value: number) => Math.abs(value),
  log: (value: number) => Math.log(value),
  sqrt: (value: number) => Math.sqrt(Math.abs(value)),
  square: (value: number) => value * value,
  
  // Normalization
  normalize: (value: number, min: number = 0, max: number = 100) => {
    return ((value - min) / (max - min)) * 100;
  },
  
  // Smoothing
  ema: (values: number[], period: number = 14) => {
    if (values.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  },
  
  // Statistical operations
  percentile: (values: number[], percentile: number = 50) => {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    return sorted[Math.round(index)];
  },
  
  // Signal processing
  diff: (current: number, previous: number = 0) => current - previous,
  rate: (current: number, previous: number = 1) => (current - previous) / previous,
  
  // Array operations
  arrayToValue: (arr: number[]) => arr[arr.length - 1], // Latest value
  arrayToAvg: (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / arr.length,
  arrayToMax: (arr: number[]) => Math.max(...arr),
  arrayToMin: (arr: number[]) => Math.min(...arr)
};

// =============================================================================
// BUILT-IN COMBINATION FUNCTIONS
// =============================================================================

export const BuiltInCombinations = {
  // Arithmetic operations
  sum: (values: number[]) => values.reduce((sum, v) => sum + v, 0),
  average: (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length,
  weightedAverage: (values: number[], weights: number[] = []) => {
    if (weights.length === 0) return BuiltInCombinations.average(values);
    const weightedSum = values.reduce((sum, v, i) => sum + v * (weights[i] || 1), 0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    return weightedSum / totalWeight;
  },
  
  // Statistical combinations
  median: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  },
  
  max: (values: number[]) => Math.max(...values),
  min: (values: number[]) => Math.min(...values),
  
  // Signal combinations
  consensus: (values: number[], threshold: number = 0.6) => {
    const positive = values.filter(v => v > 0).length;
    const negative = values.filter(v => v < 0).length;
    const total = positive + negative;
    
    if (total === 0) return 0;
    const consensus = Math.max(positive, negative) / total;
    return consensus >= threshold ? (positive > negative ? 1 : -1) : 0;
  },
  
  // Custom oscillator
  oscillator: (values: number[], centerValue: number = 0) => {
    const avg = BuiltInCombinations.average(values);
    return avg - centerValue;
  }
};

// =============================================================================
// INDICATOR COMPOSER IMPLEMENTATION
// =============================================================================

export class IndicatorComposer extends EventEmitter {
  private readonly compositeIndicators: Map<string, CompositeIndicatorSpec> = new Map();
  private readonly chainedIndicators: Map<string, ChainedIndicatorSpec> = new Map();
  private readonly registeredIndicators: Map<string, TechnicalIndicator> = new Map();
  
  // Evaluation cache for composite indicators
  private readonly evaluationCache: Map<string, {
    result: IndicatorResult<any>;
    timestamp: Date;
    dependencies: string[];
  }> = new Map();
  
  constructor() {
    super();
  }

  // =============================================================================
  // PUBLIC API - INDICATOR REGISTRATION
  // =============================================================================

  /**
   * Register base indicator for composition
   */
  registerIndicator(id: string, indicator: TechnicalIndicator): void {
    this.registeredIndicators.set(id, indicator);
    this.emit('indicatorRegistered', { id });
  }

  /**
   * Unregister indicator
   */
  unregisterIndicator(id: string): boolean {
    const removed = this.registeredIndicators.delete(id);
    if (removed) {
      this.emit('indicatorUnregistered', { id });
    }
    return removed;
  }

  // =============================================================================
  // PUBLIC API - COMPOSITE INDICATORS
  // =============================================================================

  /**
   * Create composite indicator from multiple components
   */
  async createComposite(
    name: string,
    components: Array<{
      indicatorId: string;
      weight?: number;
      transform?: (value: any) => number;
    }>,
    combineFunction: (values: number[]) => number
  ): Promise<string> {
    const id = this.generateCompositeId(name);
    
    // Validate components
    for (const component of components) {
      if (!this.registeredIndicators.has(component.indicatorId)) {
        throw new Error(`Indicator ${component.indicatorId} not registered`);
      }
    }
    
    const spec: CompositeIndicatorSpec = {
      id,
      name,
      components: components.map(c => ({
        indicatorId: c.indicatorId,
        weight: c.weight || 1,
        transform: c.transform,
        enabled: true
      })),
      combineFunction,
      metadata: {
        description: `Composite indicator: ${name}`,
        formula: this.generateCompositeFormula(components, combineFunction),
        tags: ['composite', 'custom']
      }
    };
    
    this.compositeIndicators.set(id, spec);
    this.emit('compositeCreated', { id, spec });
    
    return id;
  }

  /**
   * Evaluate composite indicator
   */
  async evaluateComposite(
    compositeId: string,
    data: OHLCV[],
    context?: CompositionContext
  ): Promise<IndicatorResult<number>> {
    const spec = this.compositeIndicators.get(compositeId);
    if (!spec) {
      throw new Error(`Composite indicator ${compositeId} not found`);
    }
    
    const startTime = performance.now();
    
    try {
      // Evaluate all component indicators
      const componentResults: number[] = [];
      const dependencies: string[] = [];
      
      for (const component of spec.components) {
        if (!component.enabled) continue;
        
        const indicator = this.registeredIndicators.get(component.indicatorId);
        if (!indicator) {
          throw new Error(`Component indicator ${component.indicatorId} not found`);
        }
        
        // Calculate indicator result
        const result = indicator.calculate(data);
        let value: number;
        
        // Extract numeric value from result
        if (typeof result.value === 'number') {
          value = result.value;
        } else if (Array.isArray(result.value)) {
          value = result.value[result.value.length - 1]; // Use latest value
        } else {
          throw new Error(`Cannot extract numeric value from ${component.indicatorId}`);
        }
        
        // Apply transform if specified
        if (component.transform) {
          value = component.transform(value, context);
        }
        
        // Apply weight
        value *= component.weight || 1;
        
        componentResults.push(value);
        dependencies.push(component.indicatorId);
      }
      
      if (componentResults.length === 0) {
        throw new Error(`No enabled components in composite ${compositeId}`);
      }
      
      // Combine component results
      const combinedValue = spec.combineFunction(componentResults, context);
      
      const evaluationTime = performance.now() - startTime;
      
      const compositeResult: IndicatorResult<number> = {
        value: combinedValue,
        timestamp: data[data.length - 1]?.timestamp || new Date(),
        isValid: !isNaN(combinedValue) && isFinite(combinedValue),
        confidence: this.calculateCompositeConfidence(componentResults),
        metadata: {
          compositeId,
          components: dependencies,
          evaluationTime,
          componentValues: componentResults
        }
      };
      
      // Cache result
      this.cacheEvaluation(compositeId, compositeResult, dependencies);
      
      this.emit('compositeEvaluated', { compositeId, result: compositeResult });
      
      return compositeResult;
      
    } catch (error) {
      this.emit('compositeEvaluationError', { compositeId, error });
      throw error;
    }
  }

  // =============================================================================
  // PUBLIC API - CHAINED INDICATORS
  // =============================================================================

  /**
   * Create chained indicator (output of one feeds into another)
   */
  async createChain(
    name: string,
    chain: Array<{
      indicatorId: string;
      transform?: (input: any) => any;
    }>
  ): Promise<string> {
    const id = this.generateChainId(name);
    
    // Validate chain
    for (const link of chain) {
      if (!this.registeredIndicators.has(link.indicatorId)) {
        throw new Error(`Indicator ${link.indicatorId} not registered`);
      }
    }
    
    if (chain.length < 2) {
      throw new Error('Chain must have at least 2 indicators');
    }
    
    const spec: ChainedIndicatorSpec = {
      id,
      name,
      chain: chain.map(link => ({
        indicatorId: link.indicatorId,
        transform: link.transform
      })),
      metadata: {
        description: `Chained indicator: ${name}`,
        stages: chain.map(link => link.indicatorId),
        tags: ['chained', 'custom']
      }
    };
    
    this.chainedIndicators.set(id, spec);
    this.emit('chainCreated', { id, spec });
    
    return id;
  }

  /**
   * Evaluate chained indicator
   */
  async evaluateChain(
    chainId: string,
    data: OHLCV[],
    context?: CompositionContext
  ): Promise<IndicatorResult<any>> {
    const spec = this.chainedIndicators.get(chainId);
    if (!spec) {
      throw new Error(`Chained indicator ${chainId} not found`);
    }
    
    const startTime = performance.now();
    
    try {
      let currentData = data;
      let currentResult: IndicatorResult<any>;
      const stageResults: Array<{ stage: string; result: any }> = [];
      
      // Execute chain stages
      for (let i = 0; i < spec.chain.length; i++) {
        const link = spec.chain[i];
        const indicator = this.registeredIndicators.get(link.indicatorId);
        
        if (!indicator) {
          throw new Error(`Chain stage indicator ${link.indicatorId} not found`);
        }
        
        // Calculate current stage
        currentResult = indicator.calculate(currentData);
        
        stageResults.push({
          stage: link.indicatorId,
          result: currentResult.value
        });
        
        // Apply transform if specified
        if (link.transform) {
          currentResult.value = link.transform(currentResult.value, context);
        }
        
        // Prepare data for next stage (if not last stage)
        if (i < spec.chain.length - 1) {
          currentData = this.prepareDataForNextStage(currentData, currentResult);
        }
      }
      
      const evaluationTime = performance.now() - startTime;
      
      // Enhance result with chain metadata
      const chainResult: IndicatorResult<any> = {
        ...currentResult,
        metadata: {
          ...currentResult.metadata,
          chainId,
          stages: spec.chain.map(link => link.indicatorId),
          stageResults,
          evaluationTime
        }
      };
      
      // Cache result
      this.cacheEvaluation(chainId, chainResult, spec.chain.map(link => link.indicatorId));
      
      this.emit('chainEvaluated', { chainId, result: chainResult });
      
      return chainResult;
      
    } catch (error) {
      this.emit('chainEvaluationError', { chainId, error });
      throw error;
    }
  }

  // =============================================================================
  // PUBLIC API - MANAGEMENT
  // =============================================================================

  /**
   * Get composite indicator specification
   */
  getCompositeSpec(id: string): CompositeIndicatorSpec | undefined {
    return this.compositeIndicators.get(id);
  }

  /**
   * Get chained indicator specification
   */
  getChainSpec(id: string): ChainedIndicatorSpec | undefined {
    return this.chainedIndicators.get(id);
  }

  /**
   * Update composite component
   */
  updateCompositeComponent(
    compositeId: string,
    componentId: string,
    updates: Partial<CompositeComponent>
  ): boolean {
    const spec = this.compositeIndicators.get(compositeId);
    if (!spec) return false;
    
    const component = spec.components.find(c => c.indicatorId === componentId);
    if (!component) return false;
    
    Object.assign(component, updates);
    
    // Clear cache for this composite
    this.clearEvaluationCache(compositeId);
    
    this.emit('compositeUpdated', { compositeId, componentId, updates });
    return true;
  }

  /**
   * Remove composite indicator
   */
  removeComposite(id: string): boolean {
    const removed = this.compositeIndicators.delete(id);
    if (removed) {
      this.clearEvaluationCache(id);
      this.emit('compositeRemoved', { id });
    }
    return removed;
  }

  /**
   * Remove chained indicator
   */
  removeChain(id: string): boolean {
    const removed = this.chainedIndicators.delete(id);
    if (removed) {
      this.clearEvaluationCache(id);
      this.emit('chainRemoved', { id });
    }
    return removed;
  }

  /**
   * Get all registered composite indicators
   */
  getCompositeIndicators(): CompositeIndicatorSpec[] {
    return Array.from(this.compositeIndicators.values());
  }

  /**
   * Get all registered chained indicators
   */
  getChainedIndicators(): ChainedIndicatorSpec[] {
    return Array.from(this.chainedIndicators.values());
  }

  /**
   * Clear all evaluation caches
   */
  clearCache(): void {
    this.evaluationCache.clear();
    this.emit('cacheCleared');
  }

  // =============================================================================
  // PRIVATE METHODS - UTILITIES
  // =============================================================================

  private generateCompositeId(name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `composite_${name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${random}`;
  }

  private generateChainId(name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `chain_${name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${random}`;
  }

  private generateCompositeFormula(
    components: Array<{ indicatorId: string; weight?: number }>,
    combineFunction: Function
  ): string {
    const componentStr = components
      .map(c => `${c.weight || 1} * ${c.indicatorId}`)
      .join(' + ');
    return `${combineFunction.name || 'combine'}(${componentStr})`;
  }

  private calculateCompositeConfidence(componentValues: number[]): number {
    // Calculate confidence based on component value consistency
    if (componentValues.length <= 1) return 1;
    
    const mean = componentValues.reduce((sum, v) => sum + v, 0) / componentValues.length;
    const variance = componentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / componentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    const normalizedStdDev = Math.min(stdDev / Math.abs(mean || 1), 1);
    return Math.max(0, 1 - normalizedStdDev);
  }

  private prepareDataForNextStage(
    originalData: OHLCV[],
    stageResult: IndicatorResult<any>
  ): OHLCV[] {
    // For chained indicators, we might need to modify the data based on the stage result
    // This is a simplified implementation - in practice, this would depend on the specific indicators
    
    if (typeof stageResult.value === 'number') {
      // Create modified data where close prices are adjusted by the indicator result
      return originalData.map((candle, index) => {
        if (index === originalData.length - 1) {
          return {
            ...candle,
            close: stageResult.value as number
          };
        }
        return candle;
      });
    }
    
    // If result is not a simple number, pass through original data
    return originalData;
  }

  private cacheEvaluation(
    indicatorId: string,
    result: IndicatorResult<any>,
    dependencies: string[]
  ): void {
    this.evaluationCache.set(indicatorId, {
      result,
      timestamp: new Date(),
      dependencies
    });
    
    // Limit cache size
    if (this.evaluationCache.size > 100) {
      const oldestKey = this.evaluationCache.keys().next().value;
      this.evaluationCache.delete(oldestKey);
    }
  }

  private clearEvaluationCache(indicatorId: string): void {
    this.evaluationCache.delete(indicatorId);
  }

  /**
   * Create pre-built composite indicators
   */
  static createPreBuiltComposites() {
    return {
      /**
       * Momentum composite (RSI + MACD + Stochastic)
       */
      momentumComposite: {
        name: 'Momentum Composite',
        components: [
          { indicatorId: 'rsi', weight: 0.4, transform: (v: number) => (v - 50) / 50 },
          { indicatorId: 'macd', weight: 0.3 },
          { indicatorId: 'stochastic', weight: 0.3, transform: (v: number) => (v - 50) / 50 }
        ],
        combineFunction: BuiltInCombinations.weightedAverage
      },
      
      /**
       * Trend strength composite
       */
      trendStrengthComposite: {
        name: 'Trend Strength',
        components: [
          { indicatorId: 'adx', weight: 0.5 },
          { indicatorId: 'psar', weight: 0.3, transform: BuiltInTransforms.abs },
          { indicatorId: 'ema_slope', weight: 0.2 }
        ],
        combineFunction: BuiltInCombinations.average
      },
      
      /**
       * Volatility composite
       */
      volatilityComposite: {
        name: 'Volatility Index',
        components: [
          { indicatorId: 'atr', weight: 0.4 },
          { indicatorId: 'bb_width', weight: 0.3 },
          { indicatorId: 'stddev', weight: 0.3 }
        ],
        combineFunction: BuiltInCombinations.average
      }
    };
  }
}

export default IndicatorComposer;