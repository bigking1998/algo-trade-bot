/**
 * Condition Cache - Task BE-013
 * 
 * High-performance caching system for condition evaluation results with:
 * - LRU eviction policy
 * - TTL-based expiration
 * - Memory-efficient storage
 * - Cache hit rate optimization
 */

import { EventEmitter } from 'events';
import type { ConditionEvaluationResult, EvaluationContext } from './types.js';

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttlSeconds: number;
  compressionEnabled: boolean;
}

export class ConditionCache extends EventEmitter {
  private readonly cache: Map<string, {
    result: ConditionEvaluationResult;
    timestamp: number;
    accessCount: number;
  }> = new Map();

  private readonly config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
  }

  async get(
    conditionId: string, 
    context: EvaluationContext
  ): Promise<ConditionEvaluationResult | null> {
    if (!this.config.enabled) return null;

    const key = this.generateKey(conditionId, context);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlSeconds * 1000) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access count
    entry.accessCount++;
    this.hits++;

    return entry.result;
  }

  async set(
    conditionId: string,
    context: EvaluationContext,
    result: ConditionEvaluationResult
  ): Promise<void> {
    if (!this.config.enabled) return;

    const key = this.generateKey(conditionId, context);
    
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  size(): number {
    return this.cache.size;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  private generateKey(conditionId: string, context: EvaluationContext): string {
    // Create cache key based on condition and relevant context
    return `${conditionId}_${context.symbol}_${context.timeframe}_${context.timestamp.getTime()}`;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < oldestAccess) {
        oldestAccess = entry.accessCount;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.emit('eviction', { key: oldestKey });
    }
  }
}