/**
 * Cache Manager - Task BE-012
 * 
 * Advanced multi-level caching system for indicator results with compression,
 * persistence, and intelligent invalidation strategies. Optimized for
 * high-frequency trading data with configurable retention policies.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import * as zlib from 'zlib';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { OHLCV, IndicatorResult } from '../base/types.js';

// =============================================================================
// CACHE TYPES AND INTERFACES
// =============================================================================

export interface CacheConfiguration {
  enabled: boolean;
  maxCacheSize: number; // bytes
  ttlSeconds: number;
  compressionEnabled: boolean;
  persistToDisk: boolean;
  diskCachePath?: string;
  
  // Cache levels
  levels: {
    l1: CacheLevelConfig; // In-memory, fastest
    l2: CacheLevelConfig; // Compressed in-memory
    l3: CacheLevelConfig; // Disk-based
  };
  
  // Eviction policy
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  
  // Cache warming
  preloadEnabled: boolean;
  preloadPatterns: string[];
  
  // Performance monitoring
  monitoringEnabled: boolean;
}

export interface CacheLevelConfig {
  enabled: boolean;
  maxSize: number; // bytes or entries
  maxEntries?: number;
  compressionLevel?: number; // 0-9 for zlib
  ttlSeconds: number;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  compressedValue?: Buffer;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  size: number; // bytes
  level: 1 | 2 | 3;
  metadata: {
    indicatorId: string;
    dataHash: string;
    resultType: string;
    version: number;
  };
}

export interface CacheKey {
  indicatorId: string;
  dataHash: string;
  configHash: string;
  timestamp?: number;
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
  averageAccessTime: number;
  
  byLevel: {
    l1: LevelStatistics;
    l2: LevelStatistics;
    l3: LevelStatistics;
  };
  
  topIndicators: Array<{
    indicatorId: string;
    hitCount: number;
    missCount: number;
    hitRate: number;
  }>;
}

export interface LevelStatistics {
  entries: number;
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  averageAccessTime: number;
}

export interface CacheStatus {
  entryCount: number;
  memoryUsage: number;
  hitRate: number;
  compressionRatio: number;
  diskUsage?: number;
}

// =============================================================================
// CACHE MANAGER IMPLEMENTATION
// =============================================================================

export class CacheManager extends EventEmitter {
  private readonly config: CacheConfiguration;
  
  // Cache levels
  private readonly l1Cache: Map<string, CacheEntry> = new Map(); // Fast in-memory
  private readonly l2Cache: Map<string, CacheEntry> = new Map(); // Compressed in-memory
  private readonly l3Cache: Map<string, string> = new Map(); // File path references
  
  // Access tracking for LRU/LFU
  private readonly accessOrder: string[] = []; // For LRU
  private readonly accessFrequency: Map<string, number> = new Map(); // For LFU
  
  // Statistics tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0,
    decompressions: 0,
    diskReads: 0,
    diskWrites: 0
  };
  
  private readonly performanceMetrics: Array<{
    timestamp: number;
    operation: string;
    duration: number;
    level: number;
  }> = [];
  
  // Background tasks
  private maintenanceInterval?: NodeJS.Timeout;
  private preloadInterval?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfiguration> = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    
    if (this.config.enabled) {
      this.initializeCache();
      this.startMaintenanceTasks();
    }
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - CACHE OPERATIONS
  // =============================================================================

  /**
   * Get cached result for indicator
   */
  async getCachedResult<T = any>(
    indicatorId: string, 
    data: OHLCV[]
  ): Promise<IndicatorResult<T> | null> {
    if (!this.config.enabled) return null;
    
    const startTime = performance.now();
    const key = this.generateCacheKey(indicatorId, data);
    
    try {
      // Try L1 cache first (fastest)
      let entry = this.l1Cache.get(key);
      if (entry && this.isValidEntry(entry)) {
        this.recordAccess(key, 1, startTime);
        this.stats.hits++;
        return entry.value;
      }
      
      // Try L2 cache (compressed)
      entry = this.l2Cache.get(key);
      if (entry && this.isValidEntry(entry)) {
        const decompressed = await this.decompressEntry(entry);
        
        // Promote to L1 if there's space
        if (this.canPromoteToL1(decompressed)) {
          this.l1Cache.set(key, decompressed);
          this.enforceL1Limits();
        }
        
        this.recordAccess(key, 2, startTime);
        this.stats.hits++;
        return decompressed.value;
      }
      
      // Try L3 cache (disk)
      if (this.config.levels.l3.enabled) {
        const diskEntry = await this.readFromDisk(key);
        if (diskEntry && this.isValidEntry(diskEntry)) {
          // Promote through cache levels
          if (this.canPromoteToL2(diskEntry)) {
            const compressed = await this.compressEntry(diskEntry);
            this.l2Cache.set(key, compressed);
            this.enforceL2Limits();
          }
          
          if (this.canPromoteToL1(diskEntry)) {
            this.l1Cache.set(key, diskEntry);
            this.enforceL1Limits();
          }
          
          this.recordAccess(key, 3, startTime);
          this.stats.hits++;
          this.stats.diskReads++;
          return diskEntry.value;
        }
      }
      
      // Cache miss
      this.stats.misses++;
      this.recordAccess(key, 0, startTime); // 0 = miss
      return null;
      
    } catch (error) {
      this.emit('error', { operation: 'getCachedResult', key, error });
      return null;
    }
  }

  /**
   * Cache indicator result
   */
  async cacheResult<T = any>(
    indicatorId: string,
    data: OHLCV | OHLCV[],
    result: IndicatorResult<T>
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    
    const startTime = performance.now();
    const dataArray = Array.isArray(data) ? data : [data];
    const key = this.generateCacheKey(indicatorId, dataArray);
    
    try {
      const entry = this.createCacheEntry(key, indicatorId, result, dataArray);
      
      // Determine which cache level to use
      if (this.canStoreInL1(entry)) {
        this.l1Cache.set(key, entry);
        this.enforceL1Limits();
        this.recordCacheOperation('store', 1, startTime);
        
      } else if (this.canStoreInL2(entry)) {
        const compressed = await this.compressEntry(entry);
        this.l2Cache.set(key, compressed);
        this.enforceL2Limits();
        this.recordCacheOperation('store', 2, startTime);
        this.stats.compressions++;
        
      } else if (this.config.levels.l3.enabled) {
        await this.writeToDisk(key, entry);
        this.recordCacheOperation('store', 3, startTime);
        this.stats.diskWrites++;
      }
      
      this.emit('cached', { indicatorId, key, level: entry.level });
      return true;
      
    } catch (error) {
      this.emit('error', { operation: 'cacheResult', key, error });
      return false;
    }
  }

  /**
   * Invalidate cache entries for specific indicator
   */
  async clearIndicatorCache(indicatorId: string): Promise<number> {
    let clearedCount = 0;
    
    // Clear L1
    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.metadata.indicatorId === indicatorId) {
        this.l1Cache.delete(key);
        clearedCount++;
      }
    }
    
    // Clear L2
    for (const [key, entry] of this.l2Cache.entries()) {
      if (entry.metadata.indicatorId === indicatorId) {
        this.l2Cache.delete(key);
        clearedCount++;
      }
    }
    
    // Clear L3 (disk)
    if (this.config.levels.l3.enabled) {
      try {
        const diskCleared = await this.clearIndicatorFromDisk(indicatorId);
        clearedCount += diskCleared;
      } catch (error) {
        this.emit('error', { operation: 'clearIndicatorCache', indicatorId, error });
      }
    }
    
    // Clean up access tracking
    this.cleanupAccessTracking();
    
    this.emit('indicatorCacheCleared', { indicatorId, clearedCount });
    return clearedCount;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.l3Cache.clear();
    
    this.accessOrder.length = 0;
    this.accessFrequency.clear();
    
    if (this.config.levels.l3.enabled && this.config.diskCachePath) {
      try {
        await this.clearDiskCache();
      } catch (error) {
        this.emit('error', { operation: 'clearDiskCache', error });
      }
    }
    
    // Reset statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      diskReads: 0,
      diskWrites: 0
    };
    
    this.emit('cacheCleared');
  }

  /**
   * Preload cache with common patterns
   */
  async preloadCache(patterns: Array<{ indicatorId: string; dataSize: number }>): Promise<number> {
    if (!this.config.preloadEnabled) return 0;
    
    let preloadedCount = 0;
    
    for (const pattern of patterns) {
      try {
        // Generate sample data for preloading
        const sampleData = this.generateSampleData(pattern.dataSize);
        
        // This would typically involve running the indicator
        // For now, we'll just create placeholder entries
        const key = this.generateCacheKey(pattern.indicatorId, sampleData);
        
        // Skip if already cached
        if (this.l1Cache.has(key) || this.l2Cache.has(key)) {
          continue;
        }
        
        preloadedCount++;
        
      } catch (error) {
        this.emit('error', { operation: 'preloadCache', pattern, error });
      }
    }
    
    this.emit('preloadCompleted', { patterns: patterns.length, preloadedCount });
    return preloadedCount;
  }

  // =============================================================================
  // PUBLIC API - CACHE MANAGEMENT
  // =============================================================================

  /**
   * Force cache maintenance
   */
  async performMaintenance(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Remove expired entries
      await this.removeExpiredEntries();
      
      // Enforce size limits
      this.enforceAllLimits();
      
      // Compress eligible L1 entries to L2
      await this.promoteToL2();
      
      // Archive eligible L2 entries to L3
      if (this.config.levels.l3.enabled) {
        await this.promoteToL3();
      }
      
      // Clean up access tracking
      this.cleanupAccessTracking();
      
      const duration = performance.now() - startTime;
      this.emit('maintenanceCompleted', { duration });
      
    } catch (error) {
      this.emit('error', { operation: 'performMaintenance', error });
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const totalRequests = totalHits + totalMisses;
    
    const l1Stats = this.calculateLevelStatistics(this.l1Cache, 1);
    const l2Stats = this.calculateLevelStatistics(this.l2Cache, 2);
    const l3Stats = { entries: this.l3Cache.size, size: 0, hits: 0, misses: 0, evictions: 0, averageAccessTime: 0 };
    
    return {
      totalEntries: this.l1Cache.size + this.l2Cache.size + this.l3Cache.size,
      totalSize: l1Stats.size + l2Stats.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      missRate: totalRequests > 0 ? totalMisses / totalRequests : 0,
      evictionCount: this.stats.evictions,
      compressionRatio: this.calculateCompressionRatio(),
      averageAccessTime: this.calculateAverageAccessTime(),
      
      byLevel: {
        l1: l1Stats,
        l2: l2Stats,
        l3: l3Stats
      },
      
      topIndicators: this.getTopIndicators()
    };
  }

  /**
   * Get cache status
   */
  getStatus(): CacheStatus {
    const l1Size = this.calculateCacheSize(this.l1Cache);
    const l2Size = this.calculateCacheSize(this.l2Cache);
    
    return {
      entryCount: this.l1Cache.size + this.l2Cache.size + this.l3Cache.size,
      memoryUsage: l1Size + l2Size,
      hitRate: this.stats.hits / Math.max(this.stats.hits + this.stats.misses, 1),
      compressionRatio: this.calculateCompressionRatio(),
      diskUsage: this.config.levels.l3.enabled ? this.calculateDiskUsage() : undefined
    };
  }

  /**
   * Flush pending operations and close cache
   */
  async flush(): Promise<void> {
    // Stop maintenance tasks
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
    }
    
    // Flush pending disk operations
    if (this.config.levels.l3.enabled) {
      await this.flushDiskOperations();
    }
    
    this.emit('flushed');
  }

  // =============================================================================
  // PRIVATE METHODS - CACHE KEY GENERATION
  // =============================================================================

  private generateCacheKey(indicatorId: string, data: OHLCV[]): string {
    const dataHash = this.hashData(data);
    return `${indicatorId}:${dataHash}`;
  }

  private hashData(data: OHLCV[]): string {
    // Create a hash based on the data content
    const dataString = data.map(candle => 
      `${candle.timestamp}-${candle.open}-${candle.high}-${candle.low}-${candle.close}-${candle.volume}`
    ).join('|');
    
    return createHash('md5').update(dataString).digest('hex').substr(0, 16);
  }

  private createCacheEntry<T>(
    key: string,
    indicatorId: string,
    result: IndicatorResult<T>,
    data: OHLCV[]
  ): CacheEntry<T> {
    const timestamp = Date.now();
    const serialized = JSON.stringify(result);
    
    return {
      key,
      value: result,
      timestamp,
      accessCount: 0,
      lastAccessed: timestamp,
      ttl: this.config.ttlSeconds * 1000,
      size: Buffer.byteLength(serialized, 'utf8'),
      level: 1,
      metadata: {
        indicatorId,
        dataHash: this.hashData(data),
        resultType: typeof result.value,
        version: 1
      }
    };
  }

  // =============================================================================
  // PRIVATE METHODS - CACHE LEVEL MANAGEMENT
  // =============================================================================

  private canStoreInL1(entry: CacheEntry): boolean {
    if (!this.config.levels.l1.enabled) return false;
    
    const currentSize = this.calculateCacheSize(this.l1Cache);
    const wouldExceed = currentSize + entry.size > this.config.levels.l1.maxSize;
    
    return !wouldExceed || this.l1Cache.size < (this.config.levels.l1.maxEntries || 1000);
  }

  private canStoreInL2(entry: CacheEntry): boolean {
    if (!this.config.levels.l2.enabled) return false;
    
    const currentSize = this.calculateCacheSize(this.l2Cache);
    const estimatedCompressedSize = entry.size * 0.3; // Rough compression estimate
    
    return currentSize + estimatedCompressedSize <= this.config.levels.l2.maxSize;
  }

  private canPromoteToL1(entry: CacheEntry): boolean {
    return this.canStoreInL1(entry) && entry.accessCount > 1;
  }

  private canPromoteToL2(entry: CacheEntry): boolean {
    return this.canStoreInL2(entry);
  }

  private enforceL1Limits(): void {
    this.enforceCacheLimits(this.l1Cache, this.config.levels.l1);
  }

  private enforceL2Limits(): void {
    this.enforceCacheLimits(this.l2Cache, this.config.levels.l2);
  }

  private enforceAllLimits(): void {
    this.enforceL1Limits();
    this.enforceL2Limits();
  }

  private enforceCacheLimits(cache: Map<string, CacheEntry>, config: CacheLevelConfig): void {
    // Check size limit
    let currentSize = this.calculateCacheSize(cache);
    
    while (currentSize > config.maxSize && cache.size > 0) {
      const victimKey = this.selectEvictionVictim(cache);
      if (victimKey) {
        const entry = cache.get(victimKey);
        if (entry) {
          currentSize -= entry.size;
          cache.delete(victimKey);
          this.stats.evictions++;
          this.emit('cacheEviction', { key: victimKey, level: entry.level });
        }
      } else {
        break;
      }
    }
    
    // Check entry count limit
    if (config.maxEntries) {
      while (cache.size > config.maxEntries) {
        const victimKey = this.selectEvictionVictim(cache);
        if (victimKey) {
          cache.delete(victimKey);
          this.stats.evictions++;
        } else {
          break;
        }
      }
    }
  }

  private selectEvictionVictim(cache: Map<string, CacheEntry>): string | null {
    if (cache.size === 0) return null;
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.selectLRUVictim(cache);
      case 'lfu':
        return this.selectLFUVictim(cache);
      case 'fifo':
        return this.selectFIFOVictim(cache);
      case 'ttl':
        return this.selectTTLVictim(cache);
      default:
        return Array.from(cache.keys())[0];
    }
  }

  private selectLRUVictim(cache: Map<string, CacheEntry>): string | null {
    let oldestTime = Infinity;
    let victimKey: string | null = null;
    
    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        victimKey = key;
      }
    }
    
    return victimKey;
  }

  private selectLFUVictim(cache: Map<string, CacheEntry>): string | null {
    let lowestCount = Infinity;
    let victimKey: string | null = null;
    
    for (const [key, entry] of cache.entries()) {
      if (entry.accessCount < lowestCount) {
        lowestCount = entry.accessCount;
        victimKey = key;
      }
    }
    
    return victimKey;
  }

  private selectFIFOVictim(cache: Map<string, CacheEntry>): string | null {
    let oldestTime = Infinity;
    let victimKey: string | null = null;
    
    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        victimKey = key;
      }
    }
    
    return victimKey;
  }

  private selectTTLVictim(cache: Map<string, CacheEntry>): string | null {
    const now = Date.now();
    let shortestTTL = Infinity;
    let victimKey: string | null = null;
    
    for (const [key, entry] of cache.entries()) {
      const remainingTTL = (entry.timestamp + entry.ttl) - now;
      if (remainingTTL < shortestTTL) {
        shortestTTL = remainingTTL;
        victimKey = key;
      }
    }
    
    return victimKey;
  }

  // =============================================================================
  // PRIVATE METHODS - COMPRESSION AND SERIALIZATION
  // =============================================================================

  private async compressEntry(entry: CacheEntry): Promise<CacheEntry> {
    const serialized = JSON.stringify(entry.value);
    const compressed = await this.compressData(Buffer.from(serialized, 'utf8'));
    
    return {
      ...entry,
      compressedValue: compressed,
      level: 2,
      size: compressed.length
    };
  }

  private async decompressEntry(entry: CacheEntry): Promise<CacheEntry> {
    if (!entry.compressedValue) return entry;
    
    const decompressed = await this.decompressData(entry.compressedValue);
    const value = JSON.parse(decompressed.toString('utf8'));
    
    this.stats.decompressions++;
    
    return {
      ...entry,
      value,
      compressedValue: undefined,
      level: 1,
      size: decompressed.length
    };
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const level = this.config.levels.l2.compressionLevel || 6;
      zlib.deflate(data, { level }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.inflate(data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  // =============================================================================
  // PRIVATE METHODS - DISK OPERATIONS
  // =============================================================================

  private async writeToDisk(key: string, entry: CacheEntry): Promise<void> {
    if (!this.config.diskCachePath) return;
    
    const filepath = path.join(this.config.diskCachePath, `${key}.cache`);
    const serialized = JSON.stringify(entry);
    
    await fs.writeFile(filepath, serialized, 'utf8');
    this.l3Cache.set(key, filepath);
  }

  private async readFromDisk(key: string): Promise<CacheEntry | null> {
    const filepath = this.l3Cache.get(key);
    if (!filepath) return null;
    
    try {
      const data = await fs.readFile(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File might not exist or be corrupted
      this.l3Cache.delete(key);
      return null;
    }
  }

  private async clearIndicatorFromDisk(indicatorId: string): Promise<number> {
    if (!this.config.diskCachePath) return 0;
    
    let clearedCount = 0;
    const keysToRemove: string[] = [];
    
    for (const [key, filepath] of this.l3Cache.entries()) {
      try {
        const data = await fs.readFile(filepath, 'utf8');
        const entry: CacheEntry = JSON.parse(data);
        
        if (entry.metadata.indicatorId === indicatorId) {
          await fs.unlink(filepath);
          keysToRemove.push(key);
          clearedCount++;
        }
      } catch (error) {
        // File might not exist, remove from cache anyway
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.l3Cache.delete(key));
    return clearedCount;
  }

  private async clearDiskCache(): Promise<void> {
    if (!this.config.diskCachePath) return;
    
    for (const filepath of this.l3Cache.values()) {
      try {
        await fs.unlink(filepath);
      } catch (error) {
        // File might not exist
      }
    }
    
    this.l3Cache.clear();
  }

  private async flushDiskOperations(): Promise<void> {
    // Wait for any pending disk operations to complete
    // This is a placeholder for more sophisticated disk operation management
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // =============================================================================
  // PRIVATE METHODS - MAINTENANCE AND UTILITIES
  // =============================================================================

  private async removeExpiredEntries(): Promise<void> {
    const now = Date.now();
    
    // Remove expired L1 entries
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.l1Cache.delete(key);
      }
    }
    
    // Remove expired L2 entries
    for (const [key, entry] of this.l2Cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.l2Cache.delete(key);
      }
    }
  }

  private async promoteToL2(): Promise<void> {
    const candidates: string[] = [];
    
    // Find L1 entries that should be compressed to L2
    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.accessCount > 0 && this.shouldCompressToL2(entry)) {
        candidates.push(key);
      }
    }
    
    // Promote candidates
    for (const key of candidates.slice(0, 10)) { // Limit batch size
      const entry = this.l1Cache.get(key);
      if (entry && this.canStoreInL2(entry)) {
        const compressed = await this.compressEntry(entry);
        this.l2Cache.set(key, compressed);
        this.l1Cache.delete(key);
      }
    }
  }

  private async promoteToL3(): Promise<void> {
    const candidates: string[] = [];
    
    // Find L2 entries that should be archived to L3
    for (const [key, entry] of this.l2Cache.entries()) {
      if (this.shouldArchiveToL3(entry)) {
        candidates.push(key);
      }
    }
    
    // Archive candidates
    for (const key of candidates.slice(0, 5)) { // Limit batch size
      const entry = this.l2Cache.get(key);
      if (entry) {
        await this.writeToDisk(key, entry);
        this.l2Cache.delete(key);
      }
    }
  }

  private shouldCompressToL2(entry: CacheEntry): boolean {
    // Compress large entries or frequently accessed ones
    return entry.size > 10000 || entry.accessCount > 3;
  }

  private shouldArchiveToL3(entry: CacheEntry): boolean {
    const age = Date.now() - entry.lastAccessed;
    const hoursSinceAccess = age / (1000 * 60 * 60);
    
    return hoursSinceAccess > 1 && entry.accessCount < 2;
  }

  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    return now <= entry.timestamp + entry.ttl;
  }

  private recordAccess(key: string, level: number, startTime: number): void {
    const duration = performance.now() - startTime;
    
    // Update access tracking
    const entry = (level === 1 ? this.l1Cache : this.l2Cache).get(key);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }
    
    // Update LRU order
    const orderIndex = this.accessOrder.indexOf(key);
    if (orderIndex > -1) {
      this.accessOrder.splice(orderIndex, 1);
    }
    this.accessOrder.push(key);
    
    // Update LFU frequency
    this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    
    // Record performance
    this.performanceMetrics.push({
      timestamp: Date.now(),
      operation: 'access',
      duration,
      level
    });
    
    // Limit performance history
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics.splice(0, 100);
    }
  }

  private recordCacheOperation(operation: string, level: number, startTime: number): void {
    const duration = performance.now() - startTime;
    
    this.performanceMetrics.push({
      timestamp: Date.now(),
      operation,
      duration,
      level
    });
  }

  private cleanupAccessTracking(): void {
    // Remove tracking for entries that no longer exist
    const existingKeys = new Set([
      ...this.l1Cache.keys(),
      ...this.l2Cache.keys(),
      ...this.l3Cache.keys()
    ]);
    
    // Clean up access order
    this.accessOrder.splice(0, this.accessOrder.length, 
      ...this.accessOrder.filter(key => existingKeys.has(key))
    );
    
    // Clean up frequency tracking
    for (const key of this.accessFrequency.keys()) {
      if (!existingKeys.has(key)) {
        this.accessFrequency.delete(key);
      }
    }
  }

  // =============================================================================
  // PRIVATE METHODS - CALCULATIONS AND STATISTICS
  // =============================================================================

  private calculateCacheSize(cache: Map<string, CacheEntry>): number {
    let totalSize = 0;
    for (const entry of cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private calculateLevelStatistics(cache: Map<string, CacheEntry>, level: number): LevelStatistics {
    let totalSize = 0;
    let hits = 0;
    let misses = 0;
    let evictions = 0;
    let totalAccessTime = 0;
    let accessCount = 0;
    
    for (const entry of cache.values()) {
      totalSize += entry.size;
      hits += entry.accessCount;
    }
    
    // Calculate average access time from performance metrics
    const levelMetrics = this.performanceMetrics.filter(m => m.level === level);
    if (levelMetrics.length > 0) {
      totalAccessTime = levelMetrics.reduce((sum, m) => sum + m.duration, 0);
      accessCount = levelMetrics.length;
    }
    
    return {
      entries: cache.size,
      size: totalSize,
      hits,
      misses,
      evictions,
      averageAccessTime: accessCount > 0 ? totalAccessTime / accessCount : 0
    };
  }

  private calculateCompressionRatio(): number {
    let uncompressedSize = 0;
    let compressedSize = 0;
    
    for (const entry of this.l2Cache.values()) {
      if (entry.compressedValue) {
        // Estimate uncompressed size
        const estimated = entry.compressedValue.length * 3; // Rough estimate
        uncompressedSize += estimated;
        compressedSize += entry.compressedValue.length;
      }
    }
    
    return uncompressedSize > 0 ? uncompressedSize / compressedSize : 1;
  }

  private calculateAverageAccessTime(): number {
    if (this.performanceMetrics.length === 0) return 0;
    
    const accessMetrics = this.performanceMetrics.filter(m => m.operation === 'access');
    if (accessMetrics.length === 0) return 0;
    
    const totalTime = accessMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / accessMetrics.length;
  }

  private calculateDiskUsage(): number {
    // This would require actual file system inspection
    // For now, return estimate based on L3 cache size
    return this.l3Cache.size * 1000; // Rough estimate
  }

  private getTopIndicators(): Array<{
    indicatorId: string;
    hitCount: number;
    missCount: number;
    hitRate: number;
  }> {
    const indicatorStats = new Map<string, { hits: number; misses: number }>();
    
    // Aggregate stats by indicator ID
    for (const entry of this.l1Cache.values()) {
      const stats = indicatorStats.get(entry.metadata.indicatorId) || { hits: 0, misses: 0 };
      stats.hits += entry.accessCount;
      indicatorStats.set(entry.metadata.indicatorId, stats);
    }
    
    for (const entry of this.l2Cache.values()) {
      const stats = indicatorStats.get(entry.metadata.indicatorId) || { hits: 0, misses: 0 };
      stats.hits += entry.accessCount;
      indicatorStats.set(entry.metadata.indicatorId, stats);
    }
    
    // Convert to array and sort
    return Array.from(indicatorStats.entries())
      .map(([indicatorId, stats]) => ({
        indicatorId,
        hitCount: stats.hits,
        missCount: stats.misses,
        hitRate: stats.hits / Math.max(stats.hits + stats.misses, 1)
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10);
  }

  private generateSampleData(size: number): OHLCV[] {
    const data: OHLCV[] = [];
    const basePrice = 100;
    
    for (let i = 0; i < size; i++) {
      const price = basePrice + (Math.random() - 0.5) * 10;
      data.push({
        timestamp: new Date(Date.now() - (size - i) * 60000),
        open: price,
        high: price + Math.random() * 2,
        low: price - Math.random() * 2,
        close: price + (Math.random() - 0.5),
        volume: Math.random() * 1000000
      });
    }
    
    return data;
  }

  private mergeConfig(config: Partial<CacheConfiguration>): CacheConfiguration {
    return {
      enabled: config.enabled ?? true,
      maxCacheSize: config.maxCacheSize ?? 100 * 1024 * 1024, // 100MB
      ttlSeconds: config.ttlSeconds ?? 3600, // 1 hour
      compressionEnabled: config.compressionEnabled ?? true,
      persistToDisk: config.persistToDisk ?? false,
      diskCachePath: config.diskCachePath,
      
      levels: {
        l1: {
          enabled: config.levels?.l1?.enabled ?? true,
          maxSize: config.levels?.l1?.maxSize ?? 50 * 1024 * 1024, // 50MB
          maxEntries: config.levels?.l1?.maxEntries ?? 1000,
          ttlSeconds: config.levels?.l1?.ttlSeconds ?? 1800 // 30 minutes
        },
        l2: {
          enabled: config.levels?.l2?.enabled ?? true,
          maxSize: config.levels?.l2?.maxSize ?? 100 * 1024 * 1024, // 100MB
          compressionLevel: config.levels?.l2?.compressionLevel ?? 6,
          ttlSeconds: config.levels?.l2?.ttlSeconds ?? 3600 // 1 hour
        },
        l3: {
          enabled: config.levels?.l3?.enabled ?? false,
          maxSize: config.levels?.l3?.maxSize ?? 500 * 1024 * 1024, // 500MB
          ttlSeconds: config.levels?.l3?.ttlSeconds ?? 86400 // 24 hours
        }
      },
      
      evictionPolicy: config.evictionPolicy ?? 'lru',
      preloadEnabled: config.preloadEnabled ?? false,
      preloadPatterns: config.preloadPatterns ?? [],
      monitoringEnabled: config.monitoringEnabled ?? true
    };
  }

  private initializeCache(): void {
    // Create disk cache directory if needed
    if (this.config.levels.l3.enabled && this.config.diskCachePath) {
      fs.mkdir(this.config.diskCachePath, { recursive: true })
        .catch(error => this.emit('error', { operation: 'initializeDiskCache', error }));
    }
  }

  private startMaintenanceTasks(): void {
    // Start periodic maintenance
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance().catch(error => 
        this.emit('error', { operation: 'maintenance', error })
      );
    }, 60000); // Every minute
    
    // Start preload task if enabled
    if (this.config.preloadEnabled) {
      this.preloadInterval = setInterval(() => {
        // This would trigger preloading based on patterns
        // Implementation depends on usage patterns
      }, 300000); // Every 5 minutes
    }
  }
}

export default CacheManager;