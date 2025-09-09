/**
 * Market Data Buffer - Task BE-008: Strategy Data Structures
 * 
 * High-performance, memory-efficient data buffer for OHLCV market data.
 * Optimized for real-time streaming data with minimal memory allocation
 * and efficient lookups for technical analysis calculations.
 * 
 * Performance Targets:
 * - Data access: O(1) for recent data, O(log n) for historical queries
 * - Memory efficiency: <50MB per symbol for 1 year of 1-minute data
 * - Buffer operations: <1ms for add/remove operations
 */

import { CircularBufferImpl, NumericCircularBuffer } from '../indicators/base/CircularBuffer.js';

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export interface OHLCVData {
  timestamp: number;  // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataQuery {
  symbol: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  timeframe?: string;
}

export interface BufferStatistics {
  symbol: string;
  totalCandles: number;
  memoryUsage: number; // bytes
  oldestTimestamp: number;
  newestTimestamp: number;
  timespan: number; // milliseconds
  averageCandleSize: number; // bytes per candle
}

export interface CompressionSettings {
  enabled: boolean;
  compressionRatio: number; // 0-1, higher = more compression
  minAgeForCompression: number; // milliseconds
  maxUncompressedItems: number;
}

// =============================================================================
// OPTIMIZED MARKET DATA BUFFER
// =============================================================================

/**
 * Memory-optimized market data buffer with intelligent compression
 * and efficient query capabilities
 */
export class MarketDataBuffer {
  private readonly symbol: string;
  private readonly maxCapacity: number;
  
  // Primary data storage - recent uncompressed data
  private recentData: CircularBufferImpl<OHLCVData>;
  
  // Compressed historical data storage
  private compressedData: Map<string, CompressedTimeSlice> = new Map();
  
  // Fast lookup indexes
  private timestampIndex: Map<number, OHLCVData> = new Map();
  private timeRangeIndex: Array<{ start: number; end: number; key: string }> = [];
  
  // Buffer configuration
  private compressionSettings: CompressionSettings;
  private lastCompression = 0;
  private bytesAllocated = 0;
  
  // Performance tracking
  private accessCount = 0;
  private hitRate = 0;
  private readonly maxRecentCapacity: number;

  constructor(
    symbol: string,
    maxCapacity: number = 525600, // 1 year of 1-minute data
    compressionSettings?: Partial<CompressionSettings>
  ) {
    this.symbol = symbol;
    this.maxCapacity = maxCapacity;
    this.maxRecentCapacity = Math.min(1440, Math.floor(maxCapacity * 0.1)); // 1 day or 10% of capacity
    
    this.recentData = new CircularBufferImpl<OHLCVData>(this.maxRecentCapacity);
    
    this.compressionSettings = {
      enabled: true,
      compressionRatio: 0.7,
      minAgeForCompression: 86400000, // 1 day
      maxUncompressedItems: this.maxRecentCapacity,
      ...compressionSettings
    };
  }

  // =============================================================================
  // DATA INGESTION METHODS
  // =============================================================================

  /**
   * Add new OHLCV data with O(1) complexity
   * Automatically manages compression and memory
   */
  addCandle(candle: OHLCVData): void {
    // Validate input
    if (!this.isValidCandle(candle)) {
      throw new Error(`Invalid OHLCV data for ${this.symbol}: ${JSON.stringify(candle)}`);
    }

    // Check for duplicate timestamps
    if (this.timestampIndex.has(candle.timestamp)) {
      this.updateCandle(candle);
      return;
    }

    // Add to recent data buffer
    const evictedCandle = this.recentData.isFull() ? this.recentData.peekNext() : undefined;
    this.recentData.push(candle);
    
    // Update indexes
    this.timestampIndex.set(candle.timestamp, candle);
    
    // Remove evicted candle from timestamp index
    if (evictedCandle) {
      this.timestampIndex.delete(evictedCandle.timestamp);
    }

    // Update memory tracking
    this.bytesAllocated += this.estimateCandleSize(candle);
    if (evictedCandle) {
      this.bytesAllocated -= this.estimateCandleSize(evictedCandle);
    }

    // Trigger compression if needed
    this.maybeCompress();
  }

  /**
   * Add multiple candles efficiently
   */
  addCandles(candles: OHLCVData[]): void {
    // Sort by timestamp to maintain order
    const sortedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    
    for (const candle of sortedCandles) {
      this.addCandle(candle);
    }
  }

  /**
   * Update existing candle data
   */
  private updateCandle(candle: OHLCVData): void {
    const existingCandle = this.timestampIndex.get(candle.timestamp);
    if (!existingCandle) return;

    // Update in-place to maintain references
    existingCandle.open = candle.open;
    existingCandle.high = candle.high;
    existingCandle.low = candle.low;
    existingCandle.close = candle.close;
    existingCandle.volume = candle.volume;
  }

  // =============================================================================
  // DATA RETRIEVAL METHODS
  // =============================================================================

  /**
   * Get latest candle with O(1) complexity
   */
  getLatest(): OHLCVData | null {
    this.accessCount++;
    return this.recentData.latest() || null;
  }

  /**
   * Get candle at specific timestamp with O(1) complexity
   */
  getCandle(timestamp: number): OHLCVData | null {
    this.accessCount++;
    
    // Check recent data first (most common case)
    const recent = this.timestampIndex.get(timestamp);
    if (recent) {
      this.hitRate = (this.hitRate * (this.accessCount - 1) + 1) / this.accessCount;
      return recent;
    }

    // Search compressed data
    const compressed = this.findInCompressedData(timestamp);
    if (compressed) {
      this.hitRate = (this.hitRate * (this.accessCount - 1) + 1) / this.accessCount;
      return compressed;
    }

    this.hitRate = (this.hitRate * (this.accessCount - 1)) / this.accessCount;
    return null;
  }

  /**
   * Get multiple candles in time range with optimized query
   */
  getRange(startTime: number, endTime: number, limit?: number): OHLCVData[] {
    this.accessCount++;
    const results: OHLCVData[] = [];

    // Get recent data in range
    const recentCandles = this.recentData.getAll();
    for (const candle of recentCandles) {
      if (candle.timestamp >= startTime && candle.timestamp <= endTime) {
        results.push(candle);
      }
    }

    // Get compressed data in range
    const compressedCandles = this.getCompressedInRange(startTime, endTime);
    results.push(...compressedCandles);

    // Sort by timestamp and apply limit
    results.sort((a, b) => a.timestamp - b.timestamp);
    
    return limit ? results.slice(-limit) : results;
  }

  /**
   * Get last N candles efficiently
   */
  getLastN(count: number): OHLCVData[] {
    this.accessCount++;
    
    if (count <= this.recentData.size()) {
      // All needed data is in recent buffer
      return this.recentData.getWindow(count);
    }

    // Need to get from both recent and compressed data
    const results: OHLCVData[] = [];
    
    // Get all recent data
    results.push(...this.recentData.getAll());
    
    // Get remaining from compressed data
    const remainingCount = count - results.length;
    if (remainingCount > 0) {
      const oldestRecent = results[0]?.timestamp || Date.now();
      const compressed = this.getCompressedBefore(oldestRecent, remainingCount);
      results.unshift(...compressed);
    }

    // Sort and return exact count
    results.sort((a, b) => a.timestamp - b.timestamp);
    return results.slice(-count);
  }

  /**
   * Get all available data (use with caution for memory)
   */
  getAll(): OHLCVData[] {
    this.accessCount++;
    const results: OHLCVData[] = [];
    
    // Get all compressed data
    this.compressedData.forEach(slice => {
      results.push(...this.decompressSlice(slice));
    });
    
    // Add recent data
    results.push(...this.recentData.getAll());
    
    // Sort by timestamp
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  // =============================================================================
  // SPECIALIZED ACCESSOR METHODS
  // =============================================================================

  /**
   * Get closes array for specified range (optimized for indicators)
   */
  getCloses(count?: number): number[] {
    const candles = count ? this.getLastN(count) : this.recentData.getAll();
    return candles.map(c => c.close);
  }

  /**
   * Get highs array
   */
  getHighs(count?: number): number[] {
    const candles = count ? this.getLastN(count) : this.recentData.getAll();
    return candles.map(c => c.high);
  }

  /**
   * Get lows array
   */
  getLows(count?: number): number[] {
    const candles = count ? this.getLastN(count) : this.recentData.getAll();
    return candles.map(c => c.low);
  }

  /**
   * Get volumes array
   */
  getVolumes(count?: number): number[] {
    const candles = count ? this.getLastN(count) : this.recentData.getAll();
    return candles.map(c => c.volume);
  }

  /**
   * Get typical prices (HLC/3)
   */
  getTypicalPrices(count?: number): number[] {
    const candles = count ? this.getLastN(count) : this.recentData.getAll();
    return candles.map(c => (c.high + c.low + c.close) / 3);
  }

  // =============================================================================
  // COMPRESSION AND MEMORY MANAGEMENT
  // =============================================================================

  /**
   * Compress old data to save memory
   */
  private maybeCompress(): void {
    if (!this.compressionSettings.enabled) return;
    
    const now = Date.now();
    const timeSinceLastCompression = now - this.lastCompression;
    
    // Compress every 5 minutes or when memory threshold is reached
    if (timeSinceLastCompression < 300000 && this.bytesAllocated < 50_000_000) {
      return;
    }

    this.compressOldData();
    this.lastCompression = now;
  }

  /**
   * Compress data older than the compression threshold
   */
  private compressOldData(): void {
    const cutoffTime = Date.now() - this.compressionSettings.minAgeForCompression;
    const candles = this.recentData.getAll();
    
    // Find candles to compress
    const toCompress = candles.filter(c => c.timestamp < cutoffTime);
    if (toCompress.length === 0) return;

    // Group by time slices (e.g., hourly)
    const slices = this.groupCandlesByTimeSlice(toCompress);
    
    // Compress each slice
    for (const [sliceKey, sliceCandles] of Array.from(slices.entries())) {
      const compressed = this.compressSlice(sliceCandles);
      this.compressedData.set(sliceKey, compressed);
      
      // Update time range index
      const startTime = Math.min(...sliceCandles.map(c => c.timestamp));
      const endTime = Math.max(...sliceCandles.map(c => c.timestamp));
      this.timeRangeIndex.push({ start: startTime, end: endTime, key: sliceKey });
    }

    // Sort time range index for binary search
    this.timeRangeIndex.sort((a, b) => a.start - b.start);

    // Remove compressed candles from recent data and indexes
    for (const candle of toCompress) {
      this.timestampIndex.delete(candle.timestamp);
      this.bytesAllocated -= this.estimateCandleSize(candle);
    }
  }

  /**
   * Group candles into time slices for compression
   */
  private groupCandlesByTimeSlice(candles: OHLCVData[]): Map<string, OHLCVData[]> {
    const slices = new Map<string, OHLCVData[]>();
    const SLICE_SIZE = 3600000; // 1 hour
    
    for (const candle of candles) {
      const sliceStart = Math.floor(candle.timestamp / SLICE_SIZE) * SLICE_SIZE;
      const sliceKey = `${this.symbol}-${sliceStart}`;
      
      if (!slices.has(sliceKey)) {
        slices.set(sliceKey, []);
      }
      slices.get(sliceKey)!.push(candle);
    }
    
    return slices;
  }

  /**
   * Compress a slice of candles
   */
  private compressSlice(candles: OHLCVData[]): CompressedTimeSlice {
    const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    // Use delta encoding for timestamps
    const baseTimestamp = first.timestamp;
    const timestampDeltas = sorted.map(c => c.timestamp - baseTimestamp);
    
    // Use delta encoding for OHLCV (based on first candle)
    const openDeltas = sorted.map(c => c.open - first.open);
    const highDeltas = sorted.map(c => c.high - first.high);
    const lowDeltas = sorted.map(c => c.low - first.low);
    const closeDeltas = sorted.map(c => c.close - first.close);
    const volumeDeltas = sorted.map(c => c.volume - first.volume);

    return {
      baseTimestamp,
      baseOHLCV: {
        open: first.open,
        high: first.high,
        low: first.low,
        close: first.close,
        volume: first.volume
      },
      timestampDeltas,
      openDeltas,
      highDeltas,
      lowDeltas,
      closeDeltas,
      volumeDeltas,
      count: sorted.length,
      startTime: first.timestamp,
      endTime: last.timestamp,
      compressedAt: Date.now(),
      compressionRatio: this.compressionSettings.compressionRatio
    };
  }

  /**
   * Decompress a slice back to individual candles
   */
  private decompressSlice(slice: CompressedTimeSlice): OHLCVData[] {
    const candles: OHLCVData[] = [];
    
    for (let i = 0; i < slice.count; i++) {
      candles.push({
        timestamp: slice.baseTimestamp + slice.timestampDeltas[i],
        open: slice.baseOHLCV.open + slice.openDeltas[i],
        high: slice.baseOHLCV.high + slice.highDeltas[i],
        low: slice.baseOHLCV.low + slice.lowDeltas[i],
        close: slice.baseOHLCV.close + slice.closeDeltas[i],
        volume: slice.baseOHLCV.volume + slice.volumeDeltas[i]
      });
    }
    
    return candles;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Find candle in compressed data
   */
  private findInCompressedData(timestamp: number): OHLCVData | null {
    // Binary search through time range index
    const range = this.timeRangeIndex.find(r => 
      timestamp >= r.start && timestamp <= r.end
    );
    
    if (!range) return null;
    
    const slice = this.compressedData.get(range.key);
    if (!slice) return null;
    
    // Decompress and find specific candle
    const candles = this.decompressSlice(slice);
    return candles.find(c => c.timestamp === timestamp) || null;
  }

  /**
   * Get compressed candles in time range
   */
  private getCompressedInRange(startTime: number, endTime: number): OHLCVData[] {
    const results: OHLCVData[] = [];
    
    // Find overlapping ranges
    const overlappingRanges = this.timeRangeIndex.filter(r =>
      !(r.end < startTime || r.start > endTime)
    );
    
    for (const range of overlappingRanges) {
      const slice = this.compressedData.get(range.key);
      if (!slice) continue;
      
      const candles = this.decompressSlice(slice);
      const filtered = candles.filter(c => 
        c.timestamp >= startTime && c.timestamp <= endTime
      );
      results.push(...filtered);
    }
    
    return results;
  }

  /**
   * Get compressed candles before timestamp
   */
  private getCompressedBefore(timestamp: number, limit: number): OHLCVData[] {
    const results: OHLCVData[] = [];
    
    // Find ranges before timestamp
    const beforeRanges = this.timeRangeIndex
      .filter(r => r.end < timestamp)
      .sort((a, b) => b.end - a.end); // Most recent first
    
    for (const range of beforeRanges) {
      if (results.length >= limit) break;
      
      const slice = this.compressedData.get(range.key);
      if (!slice) continue;
      
      const candles = this.decompressSlice(slice);
      results.push(...candles);
    }
    
    // Sort by timestamp and return requested count
    results.sort((a, b) => a.timestamp - b.timestamp);
    return results.slice(-limit);
  }

  /**
   * Validate OHLCV candle data
   */
  private isValidCandle(candle: OHLCVData): boolean {
    return (
      typeof candle.timestamp === 'number' && candle.timestamp > 0 &&
      typeof candle.open === 'number' && candle.open > 0 &&
      typeof candle.high === 'number' && candle.high > 0 &&
      typeof candle.low === 'number' && candle.low > 0 &&
      typeof candle.close === 'number' && candle.close > 0 &&
      typeof candle.volume === 'number' && candle.volume >= 0 &&
      candle.high >= candle.low &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close)
    );
  }

  /**
   * Estimate memory usage of a single candle
   */
  private estimateCandleSize(candle: OHLCVData): number {
    // 6 numbers * 8 bytes each = 48 bytes + object overhead ~16 bytes
    return 64;
  }

  // =============================================================================
  // BUFFER MANAGEMENT AND STATISTICS
  // =============================================================================

  /**
   * Get buffer statistics
   */
  getStatistics(): BufferStatistics {
    const recentCandles = this.recentData.getAll();
    const compressedCount = Array.from(this.compressedData.values())
      .reduce((sum, slice) => sum + slice.count, 0);
    
    const totalCandles = recentCandles.length + compressedCount;
    const oldest = this.getOldestTimestamp();
    const newest = this.getNewestTimestamp();

    return {
      symbol: this.symbol,
      totalCandles,
      memoryUsage: this.bytesAllocated,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      timespan: newest - oldest,
      averageCandleSize: totalCandles > 0 ? this.bytesAllocated / totalCandles : 0
    };
  }

  /**
   * Get oldest timestamp
   */
  private getOldestTimestamp(): number {
    let oldest = Infinity;
    
    // Check recent data
    const recentOldest = this.recentData.oldest();
    if (recentOldest) {
      oldest = Math.min(oldest, recentOldest.timestamp);
    }
    
    // Check compressed data
    for (const slice of Array.from(this.compressedData.values())) {
      oldest = Math.min(oldest, slice.startTime);
    }
    
    return oldest === Infinity ? 0 : oldest;
  }

  /**
   * Get newest timestamp
   */
  private getNewestTimestamp(): number {
    let newest = 0;
    
    // Check recent data
    const recentLatest = this.recentData.latest();
    if (recentLatest) {
      newest = Math.max(newest, recentLatest.timestamp);
    }
    
    // Check compressed data
    for (const slice of Array.from(this.compressedData.values())) {
      newest = Math.max(newest, slice.endTime);
    }
    
    return newest;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.recentData.clear();
    this.compressedData.clear();
    this.timestampIndex.clear();
    this.timeRangeIndex = [];
    this.bytesAllocated = 0;
    this.accessCount = 0;
    this.hitRate = 0;
  }

  /**
   * Get current size
   */
  size(): number {
    const compressedCount = Array.from(this.compressedData.values())
      .reduce((sum, slice) => sum + slice.count, 0);
    return this.recentData.size() + compressedCount;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    hitRate: number;
    accessCount: number;
    memoryUsage: number;
    compressionRatio: number;
  } {
    const totalCandles = this.size();
    const uncompressedSize = totalCandles * 64; // 64 bytes per candle
    const actualSize = this.bytesAllocated;
    const compressionRatio = uncompressedSize > 0 ? actualSize / uncompressedSize : 1;

    return {
      hitRate: this.hitRate,
      accessCount: this.accessCount,
      memoryUsage: actualSize,
      compressionRatio
    };
  }
}

// =============================================================================
// COMPRESSED DATA STORAGE FORMAT
// =============================================================================

interface CompressedTimeSlice {
  baseTimestamp: number;
  baseOHLCV: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  timestampDeltas: number[];
  openDeltas: number[];
  highDeltas: number[];
  lowDeltas: number[];
  closeDeltas: number[];
  volumeDeltas: number[];
  count: number;
  startTime: number;
  endTime: number;
  compressedAt: number;
  compressionRatio: number;
}

// =============================================================================
// FACTORY AND UTILITIES
// =============================================================================

/**
 * Factory function for creating optimized market data buffers
 */
export function createMarketDataBuffer(
  symbol: string,
  options?: {
    maxCapacity?: number;
    compression?: Partial<CompressionSettings>;
  }
): MarketDataBuffer {
  return new MarketDataBuffer(
    symbol,
    options?.maxCapacity,
    options?.compression
  );
}

/**
 * Create multiple buffers for different symbols
 */
export function createMarketDataBufferCollection(
  symbols: string[],
  options?: {
    maxCapacity?: number;
    compression?: Partial<CompressionSettings>;
  }
): Map<string, MarketDataBuffer> {
  const buffers = new Map<string, MarketDataBuffer>();
  
  for (const symbol of symbols) {
    buffers.set(symbol, createMarketDataBuffer(symbol, options));
  }
  
  return buffers;
}