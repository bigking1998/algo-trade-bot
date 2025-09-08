/**
 * MarketDataBuffer - Task BE-017: Real-time Data Processing Engine
 * 
 * High-performance circular buffer for efficient market data streaming
 * Designed for ultra-low latency and memory-optimized data processing
 * Supports multiple timeframes and optimized batch operations.
 */

import { MarketData } from '../types/database.js';
import { DydxCandle } from '../../shared/types/trading.js';
import { EventEmitter } from 'events';
import { CircularBufferImpl } from '../indicators/base/CircularBuffer.js';

export interface BufferConfig {
  maxSize: number;
  symbols: string[];
  timeframes: string[];
  enableTimeOrdering: boolean;
  enableDuplicateDetection: boolean;
  flushThreshold: number; // Auto-flush when buffer reaches this percentage
  flushIntervalMs: number; // Auto-flush every N milliseconds
}

export interface BufferStats {
  totalReceived: number;
  totalFlushed: number;
  totalDropped: number;
  duplicatesDetected: number;
  averageLatencyMs: number;
  bufferUtilization: number;
  memoryUsageMB: number;
  lastUpdate: Date;
}

export interface BufferedDataPoint {
  data: MarketData;
  timestamp: number; // High-resolution timestamp for latency tracking
  processed: boolean;
  source: 'websocket' | 'rest' | 'synthetic';
  priority: number; // Higher priority = processed first
}

/**
 * High-performance market data buffer with advanced streaming capabilities
 */
export class MarketDataBuffer extends EventEmitter {
  private buffers: Map<string, CircularBufferImpl<BufferedDataPoint>>; // symbol+timeframe -> buffer
  private config: BufferConfig;
  private stats: BufferStats;
  private flushTimer: NodeJS.Timeout | null = null;
  private duplicateCache: Set<string>; // For duplicate detection
  private readonly maxDuplicateCacheSize = 10000;
  private isStarted = false;
  
  constructor(config: BufferConfig) {
    super();
    this.config = {
      maxSize: config.maxSize || 10000,
      symbols: config.symbols || [],
      timeframes: config.timeframes || [],
      enableTimeOrdering: config.enableTimeOrdering ?? true,
      enableDuplicateDetection: config.enableDuplicateDetection ?? true,
      flushThreshold: config.flushThreshold ?? 0.8, // 80%
      flushIntervalMs: config.flushIntervalMs ?? 1000, // 1 second
    };
    
    this.buffers = new Map();
    this.duplicateCache = new Set();
    this.stats = {
      totalReceived: 0,
      totalFlushed: 0,
      totalDropped: 0,
      duplicatesDetected: 0,
      averageLatencyMs: 0,
      bufferUtilization: 0,
      memoryUsageMB: 0,
      lastUpdate: new Date()
    };
    
    this.initializeBuffers();
  }

  /**
   * CORE BUFFER OPERATIONS
   */

  /**
   * Start the buffer with auto-flush capabilities
   */
  start(): void {
    if (this.isStarted) return;
    
    this.isStarted = true;
    this.startAutoFlush();
    
    console.log(`[MarketDataBuffer] Started with ${this.buffers.size} symbol/timeframe buffers`);
    this.emit('started');
  }

  /**
   * Stop the buffer and flush remaining data
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;
    
    this.isStarted = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    await this.flushAll();
    
    console.log('[MarketDataBuffer] Stopped and flushed remaining data');
    this.emit('stopped');
  }

  /**
   * Add market data to buffer with high-performance processing
   */
  add(candle: DydxCandle | MarketData, source: 'websocket' | 'rest' | 'synthetic' = 'websocket', priority = 1): boolean {
    const startTime = performance.now();
    
    try {
      // Convert DydxCandle to MarketData format
      const marketData = this.normalizeCandle(candle);
      
      // Generate buffer key
      const bufferKey = this.getBufferKey(marketData.symbol, marketData.timeframe);
      
      // Check for duplicates if enabled
      if (this.config.enableDuplicateDetection && this.isDuplicate(marketData)) {
        this.stats.duplicatesDetected++;
        return false;
      }
      
      // Get or create buffer for this symbol/timeframe
      let buffer = this.buffers.get(bufferKey);
      if (!buffer) {
        buffer = new CircularBufferImpl<BufferedDataPoint>(this.config.maxSize);
        this.buffers.set(bufferKey, buffer);
      }
      
      // Create buffered data point
      const dataPoint: BufferedDataPoint = {
        data: marketData,
        timestamp: startTime,
        processed: false,
        source,
        priority
      };
      
      // Add to buffer (will overwrite oldest if full)
      const wasOverwritten = buffer.isFull();
      buffer.push(dataPoint);
      
      if (wasOverwritten) {
        this.stats.totalDropped++;
      }
      
      this.stats.totalReceived++;
      this.updateLatencyMetrics(performance.now() - startTime);
      
      // Check if we should auto-flush
      const utilization = this.getBufferUtilization();
      if (utilization >= this.config.flushThreshold) {
        this.emit('flush-threshold-reached', utilization);
        setImmediate(() => this.flushAll()); // Non-blocking flush
      }
      
      this.emit('data-added', { bufferKey, dataPoint, utilization });
      return true;
      
    } catch (error) {
      console.error('[MarketDataBuffer] Error adding data:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Batch add multiple data points with optimized processing
   */
  async addBatch(candles: (DydxCandle | MarketData)[], source: 'websocket' | 'rest' | 'synthetic' = 'websocket'): Promise<number> {
    const startTime = performance.now();
    let successCount = 0;
    
    try {
      // Process in chunks to avoid blocking
      const chunkSize = 100;
      for (let i = 0; i < candles.length; i += chunkSize) {
        const chunk = candles.slice(i, i + chunkSize);
        
        for (const candle of chunk) {
          if (this.add(candle, source)) {
            successCount++;
          }
        }
        
        // Yield to event loop every chunk
        if (i + chunkSize < candles.length) {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
      }
      
      const processingTime = performance.now() - startTime;
      console.log(`[MarketDataBuffer] Batch processed ${successCount}/${candles.length} items in ${processingTime.toFixed(2)}ms`);
      
      this.emit('batch-added', { 
        total: candles.length, 
        successful: successCount,
        processingTimeMs: processingTime
      });
      
      return successCount;
      
    } catch (error) {
      console.error('[MarketDataBuffer] Error in batch add:', error);
      this.emit('error', error);
      return successCount;
    }
  }

  /**
   * FLUSH OPERATIONS
   */

  /**
   * Flush all buffers and return data for persistence
   */
  async flushAll(): Promise<MarketData[]> {
    const startTime = performance.now();
    const allData: MarketData[] = [];
    
    try {
      for (const [bufferKey, buffer] of this.buffers.entries()) {
        const data = this.flushBuffer(buffer);
        allData.push(...data);
      }
      
      // Sort by timestamp if time ordering is enabled
      if (this.config.enableTimeOrdering && allData.length > 0) {
        allData.sort((a, b) => a.time.getTime() - b.time.getTime());
      }
      
      const processingTime = performance.now() - startTime;
      this.stats.totalFlushed += allData.length;
      this.stats.lastUpdate = new Date();
      
      console.log(`[MarketDataBuffer] Flushed ${allData.length} data points in ${processingTime.toFixed(2)}ms`);
      
      this.emit('data-flushed', {
        dataPoints: allData.length,
        processingTimeMs: processingTime,
        totalFlushed: this.stats.totalFlushed
      });
      
      return allData;
      
    } catch (error) {
      console.error('[MarketDataBuffer] Error during flush:', error);
      this.emit('error', error);
      return allData;
    }
  }

  /**
   * Flush specific symbol/timeframe buffer
   */
  flushSymbol(symbol: string, timeframe?: string): MarketData[] {
    const flushedData: MarketData[] = [];
    
    try {
      if (timeframe) {
        // Flush specific symbol+timeframe
        const bufferKey = this.getBufferKey(symbol, timeframe);
        const buffer = this.buffers.get(bufferKey);
        if (buffer) {
          const data = this.flushBuffer(buffer);
          flushedData.push(...data);
        }
      } else {
        // Flush all timeframes for symbol
        for (const [bufferKey, buffer] of this.buffers.entries()) {
          if (bufferKey.startsWith(symbol + ':')) {
            const data = this.flushBuffer(buffer);
            flushedData.push(...data);
          }
        }
      }
      
      this.stats.totalFlushed += flushedData.length;
      
      this.emit('symbol-flushed', {
        symbol,
        timeframe,
        dataPoints: flushedData.length
      });
      
      return flushedData;
      
    } catch (error) {
      console.error('[MarketDataBuffer] Error flushing symbol:', error);
      this.emit('error', error);
      return flushedData;
    }
  }

  /**
   * DATA RETRIEVAL OPERATIONS
   */

  /**
   * Get latest N data points for symbol/timeframe without flushing
   */
  getLatest(symbol: string, timeframe: string, count: number = 1): MarketData[] {
    try {
      const bufferKey = this.getBufferKey(symbol, timeframe);
      const buffer = this.buffers.get(bufferKey);
      
      if (!buffer || buffer.size() === 0) {
        return [];
      }
      
      const data: MarketData[] = [];
      const actualCount = Math.min(count, buffer.size());
      
      // Get latest items from circular buffer
      for (let i = 0; i < actualCount; i++) {
        const item = buffer.get(buffer.size() - 1 - i);
        if (item) {
          data.unshift(item.data); // Maintain chronological order
        }
      }
      
      return data;
      
    } catch (error) {
      console.error('[MarketDataBuffer] Error getting latest data:', error);
      return [];
    }
  }

  /**
   * Get buffer size for symbol/timeframe
   */
  getBufferSize(symbol: string, timeframe: string): number {
    const bufferKey = this.getBufferKey(symbol, timeframe);
    const buffer = this.buffers.get(bufferKey);
    return buffer?.size() || 0;
  }

  /**
   * Check if buffer exists for symbol/timeframe
   */
  hasBuffer(symbol: string, timeframe: string): boolean {
    const bufferKey = this.getBufferKey(symbol, timeframe);
    return this.buffers.has(bufferKey);
  }

  /**
   * STATISTICS AND MONITORING
   */

  /**
   * Get comprehensive buffer statistics
   */
  getStats(): BufferStats {
    const totalBuffered = Array.from(this.buffers.values())
      .reduce((sum, buffer) => sum + buffer.size(), 0);
    
    const totalCapacity = this.buffers.size * this.config.maxSize;
    
    this.stats.bufferUtilization = totalCapacity > 0 ? totalBuffered / totalCapacity : 0;
    this.stats.memoryUsageMB = this.calculateMemoryUsage();
    
    return { ...this.stats };
  }

  /**
   * Get buffer utilization as percentage
   */
  getBufferUtilization(): number {
    const totalBuffered = Array.from(this.buffers.values())
      .reduce((sum, buffer) => sum + buffer.size(), 0);
    
    const totalCapacity = this.buffers.size * this.config.maxSize;
    return totalCapacity > 0 ? totalBuffered / totalCapacity : 0;
  }

  /**
   * Get detailed buffer status for each symbol/timeframe
   */
  getDetailedStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [bufferKey, buffer] of this.buffers.entries()) {
      const [symbol, timeframe] = bufferKey.split(':');
      const latest = buffer.size() > 0 ? buffer.get(buffer.size() - 1) : null;
      
      status[bufferKey] = {
        symbol,
        timeframe,
        size: buffer.size(),
        capacity: this.config.maxSize,
        utilization: buffer.size() / this.config.maxSize,
        latestTimestamp: latest?.timestamp || null,
        latestData: latest?.data.time || null,
        processingLag: latest ? Date.now() - latest.timestamp : null
      };
    }
    
    return status;
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private initializeBuffers(): void {
    // Pre-create buffers for configured symbols and timeframes
    for (const symbol of this.config.symbols) {
      for (const timeframe of this.config.timeframes) {
        const bufferKey = this.getBufferKey(symbol, timeframe);
        this.buffers.set(bufferKey, new CircularBufferImpl<BufferedDataPoint>(this.config.maxSize));
      }
    }
    
    console.log(`[MarketDataBuffer] Initialized ${this.buffers.size} buffers for ${this.config.symbols.length} symbols and ${this.config.timeframes.length} timeframes`);
  }

  private startAutoFlush(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(async () => {
      try {
        const data = await this.flushAll();
        if (data.length > 0) {
          this.emit('auto-flush', { dataPoints: data.length });
        }
      } catch (error) {
        console.error('[MarketDataBuffer] Auto-flush error:', error);
        this.emit('error', error);
      }
    }, this.config.flushIntervalMs);
  }

  private flushBuffer(buffer: CircularBufferImpl<BufferedDataPoint>): MarketData[] {
    const data: MarketData[] = [];
    
    while (buffer.size() > 0) {
      const item = buffer.shift();
      if (item) {
        data.push(item.data);
      }
    }
    
    return data;
  }

  private normalizeCandle(candle: DydxCandle | MarketData): MarketData {
    // If already MarketData, return as-is
    if ('created_at' in candle) {
      return candle as MarketData;
    }
    
    // Convert DydxCandle to MarketData
    const dydxCandle = candle as DydxCandle;
    
    return {
      time: new Date(dydxCandle.time),
      symbol: dydxCandle.symbol || 'UNKNOWN',
      exchange: 'dydx',
      open: dydxCandle.open,
      high: dydxCandle.high,
      low: dydxCandle.low,
      close: dydxCandle.close,
      volume: dydxCandle.volume,
      timeframe: (dydxCandle.timeframe || '1m') as any,
      created_at: new Date()
    };
  }

  private isDuplicate(data: MarketData): boolean {
    const key = `${data.symbol}:${data.timeframe}:${data.time.getTime()}`;
    
    if (this.duplicateCache.has(key)) {
      return true;
    }
    
    // Add to cache and clean if too large
    this.duplicateCache.add(key);
    if (this.duplicateCache.size > this.maxDuplicateCacheSize) {
      // Remove oldest entries (simple cleanup - could be optimized)
      const entries = Array.from(this.duplicateCache);
      this.duplicateCache.clear();
      entries.slice(-this.maxDuplicateCacheSize * 0.8).forEach(entry => 
        this.duplicateCache.add(entry)
      );
    }
    
    return false;
  }

  private getBufferKey(symbol: string, timeframe: string): string {
    return `${symbol}:${timeframe}`;
  }

  private updateLatencyMetrics(latencyMs: number): void {
    // Simple moving average for latency tracking
    const alpha = 0.1; // Smoothing factor
    this.stats.averageLatencyMs = this.stats.averageLatencyMs * (1 - alpha) + latencyMs * alpha;
  }

  private calculateMemoryUsage(): number {
    // Rough estimation of memory usage
    const avgDataPointSize = 200; // bytes (rough estimate)
    const totalDataPoints = Array.from(this.buffers.values())
      .reduce((sum, buffer) => sum + buffer.size(), 0);
    
    return (totalDataPoints * avgDataPointSize) / (1024 * 1024); // MB
  }

  /**
   * CONFIGURATION MANAGEMENT
   */

  /**
   * Update buffer configuration
   */
  updateConfig(newConfig: Partial<BufferConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Handle symbol/timeframe changes
    if (newConfig.symbols || newConfig.timeframes) {
      this.initializeBuffers();
    }
    
    // Handle flush interval changes
    if (newConfig.flushIntervalMs && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.startAutoFlush();
    }
    
    console.log('[MarketDataBuffer] Configuration updated:', { oldConfig, newConfig: this.config });
    this.emit('config-updated', { oldConfig, newConfig: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): BufferConfig {
    return { ...this.config };
  }

  /**
   * Reset buffer statistics
   */
  resetStats(): void {
    this.stats = {
      totalReceived: 0,
      totalFlushed: 0,
      totalDropped: 0,
      duplicatesDetected: 0,
      averageLatencyMs: 0,
      bufferUtilization: 0,
      memoryUsageMB: 0,
      lastUpdate: new Date()
    };
    
    this.emit('stats-reset');
  }

  /**
   * Clear all buffers (destructive operation)
   */
  clearAll(): void {
    for (const buffer of this.buffers.values()) {
      while (buffer.size() > 0) {
        buffer.shift();
      }
    }
    
    this.duplicateCache.clear();
    this.resetStats();
    
    console.log('[MarketDataBuffer] All buffers cleared');
    this.emit('buffers-cleared');
  }
}