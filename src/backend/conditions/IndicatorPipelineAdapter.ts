/**
 * Indicator Pipeline Adapter - Task BE-013
 * 
 * Integration adapter between Condition Evaluation Engine and Indicator Pipeline System
 * Provides seamless data access and real-time indicator updates for condition evaluation
 */

import type { IndicatorPipeline } from '../indicators/pipeline/IndicatorPipeline.js';
import type { IndicatorResult } from '../indicators/base/types.js';
import type { EvaluationContext } from './types.js';
import { ConditionEvaluationEngine } from './ConditionEvaluationEngine.js';

export interface PipelineIntegrationConfig {
  enableRealTimeUpdates: boolean;
  maxCacheSize: number;
  updateThrottleMs: number;
}

/**
 * IndicatorPipelineAdapter - Bridges condition engine with indicator pipeline
 */
export class IndicatorPipelineAdapter {
  private readonly indicatorPipeline: IndicatorPipeline;
  private readonly conditionEngine: ConditionEvaluationEngine;
  private readonly config: PipelineIntegrationConfig;

  // Cache for indicator results
  private readonly indicatorCache: Map<string, {
    result: IndicatorResult<any>;
    timestamp: number;
  }> = new Map();

  private lastUpdateTime = 0;

  constructor(
    indicatorPipeline: IndicatorPipeline,
    conditionEngine: ConditionEvaluationEngine,
    config: Partial<PipelineIntegrationConfig> = {}
  ) {
    this.indicatorPipeline = indicatorPipeline;
    this.conditionEngine = conditionEngine;
    this.config = {
      enableRealTimeUpdates: config.enableRealTimeUpdates ?? true,
      maxCacheSize: config.maxCacheSize ?? 1000,
      updateThrottleMs: config.updateThrottleMs ?? 100
    };

    this.setupEventHandlers();
  }

  /**
   * Create evaluation context with indicator data from pipeline
   */
  async createEvaluationContext(
    symbol: string,
    timeframe: string,
    timestamp: Date,
    strategyId: string,
    executionId: string,
    requiredIndicators: string[]
  ): Promise<EvaluationContext> {
    
    // Get indicator results from pipeline
    const indicatorResults = await this.getIndicatorResults(requiredIndicators);
    
    // Get market data (would integrate with existing market data system)
    const marketData = await this.getMarketData(symbol, timeframe, timestamp);
    
    return {
      symbol,
      timeframe,
      timestamp,
      marketData,
      indicators: indicatorResults,
      variables: new Map(),
      sessionData: new Map(),
      strategyData: new Map(),
      executionId,
      strategyId,
      startTime: Date.now(),
      maxExecutionTime: 10000 // 10 seconds default
    };
  }

  /**
   * Get indicator results from pipeline with caching
   */
  private async getIndicatorResults(indicatorIds: string[]): Promise<Map<string, IndicatorResult<any>>> {
    const results = new Map<string, IndicatorResult<any>>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const id of indicatorIds) {
      const cached = this.indicatorCache.get(id);
      if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache
        results.set(id, cached.result);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached indicators from pipeline
    if (uncachedIds.length > 0) {
      try {
        const pipelineStatus = this.indicatorPipeline.getStatus();
        
        // Use pipeline to get indicator results
        // This would need to be adapted based on the actual pipeline API
        for (const id of uncachedIds) {
          const indicator = this.indicatorPipeline.getIndicator(id);
          if (indicator && indicator.enabled) {
            // Simulate getting indicator result - actual implementation would call pipeline
            const result = await this.getIndicatorFromPipeline(id);
            if (result) {
              results.set(id, result);
              
              // Cache result
              this.indicatorCache.set(id, {
                result,
                timestamp: Date.now()
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching indicators from pipeline:', error);
      }
    }

    return results;
  }

  /**
   * Get indicator result from pipeline (placeholder implementation)
   */
  private async getIndicatorFromPipeline(indicatorId: string): Promise<IndicatorResult<any> | null> {
    try {
      // This would integrate with the actual indicator pipeline
      // For now, return a placeholder result
      
      const indicator = this.indicatorPipeline.getIndicator(indicatorId);
      if (!indicator) return null;

      // Simulate indicator calculation result
      return {
        value: [{ value: 50, signal: 0, timestamp: new Date() }],
        timestamp: new Date(),
        isValid: true,
        metadata: {
          periods: 20,
          lastCalculated: new Date(),
          dataPoints: 100
        }
      };
    } catch (error) {
      console.error(`Error getting indicator ${indicatorId}:`, error);
      return null;
    }
  }

  /**
   * Get market data for evaluation context
   */
  private async getMarketData(
    symbol: string, 
    timeframe: string, 
    timestamp: Date
  ): Promise<EvaluationContext['marketData']> {
    
    // This would integrate with existing market data system
    // For now, return placeholder data
    
    const basePrice = 50000; // Placeholder price
    
    return {
      current: {
        open: basePrice * 0.999,
        high: basePrice * 1.002,
        low: basePrice * 0.998,
        close: basePrice,
        volume: 1000000
      },
      history: Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(timestamp.getTime() - (99 - i) * 60000),
        open: basePrice * (0.99 + Math.random() * 0.02),
        high: basePrice * (1.0 + Math.random() * 0.02),
        low: basePrice * (0.99 - Math.random() * 0.02),
        close: basePrice * (0.995 + Math.random() * 0.01),
        volume: 800000 + Math.random() * 400000
      })),
      windowSize: 100
    };
  }

  /**
   * Set up event handlers for real-time updates
   */
  private setupEventHandlers(): void {
    if (!this.config.enableRealTimeUpdates) return;

    // Listen for indicator pipeline updates
    this.indicatorPipeline.on('streamingUpdateCompleted', (data) => {
      this.handleIndicatorUpdate(data);
    });

    // Listen for condition engine performance issues
    this.conditionEngine.on('slowExecution', (data) => {
      console.warn('Slow condition execution detected:', data);
    });

    this.conditionEngine.on('evaluationError', (data) => {
      console.error('Condition evaluation error:', data);
    });
  }

  /**
   * Handle real-time indicator updates
   */
  private handleIndicatorUpdate(data: any): void {
    const now = Date.now();
    
    // Throttle updates to prevent excessive processing
    if (now - this.lastUpdateTime < this.config.updateThrottleMs) {
      return;
    }
    
    this.lastUpdateTime = now;

    // Update cached indicator results
    if (data.results) {
      data.results.forEach((result: any, indicatorId: string) => {
        this.indicatorCache.set(indicatorId, {
          result,
          timestamp: now
        });
      });

      // Evict old cache entries if over limit
      if (this.indicatorCache.size > this.config.maxCacheSize) {
        this.evictOldCacheEntries();
      }
    }

    // Emit update event for condition engine
    this.conditionEngine.emit('indicatorUpdate', {
      indicatorIds: Array.from(data.results?.keys() || []),
      timestamp: new Date(now)
    });
  }

  /**
   * Evict old cache entries using LRU policy
   */
  private evictOldCacheEntries(): void {
    const entries = Array.from(this.indicatorCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);
    toRemove.forEach(([key]) => {
      this.indicatorCache.delete(key);
    });
  }

  /**
   * Clear indicator cache
   */
  clearCache(): void {
    this.indicatorCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.indicatorCache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0, // Would track this in production
      lastUpdateTime: this.lastUpdateTime
    };
  }

  /**
   * Validate indicator dependencies for conditions
   */
  async validateIndicatorDependencies(indicatorIds: string[]): Promise<{
    valid: string[];
    invalid: string[];
    disabled: string[];
  }> {
    const valid: string[] = [];
    const invalid: string[] = [];
    const disabled: string[] = [];

    for (const id of indicatorIds) {
      const indicator = this.indicatorPipeline.getIndicator(id);
      
      if (!indicator) {
        invalid.push(id);
      } else if (!indicator.enabled) {
        disabled.push(id);
      } else {
        valid.push(id);
      }
    }

    return { valid, invalid, disabled };
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus() {
    return this.indicatorPipeline.getStatus();
  }

  /**
   * Get available indicators
   */
  getAvailableIndicators() {
    return this.indicatorPipeline.getRegisteredIndicators();
  }
}

export default IndicatorPipelineAdapter;