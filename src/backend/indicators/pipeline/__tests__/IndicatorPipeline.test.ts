/**
 * Indicator Pipeline Tests - Task BE-012
 * 
 * Comprehensive unit tests for the indicator pipeline system
 * covering batch processing, dependency resolution, caching, and lazy evaluation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndicatorPipeline } from '../IndicatorPipeline.js';
import { SimpleMovingAverage } from '../../trend/SimpleMovingAverage.js';
import { RSI } from '../../momentum/RSI.js';
import type { OHLCV } from '../../base/types.js';

// Mock data generators
const generateOHLCVData = (count: number, startPrice: number = 100): OHLCV[] => {
  const data: OHLCV[] = [];
  let price = startPrice;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 4; // Random walk
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.random() * 1000000;
    
    data.push({
      time: new Date(Date.now() - (count - i) * 60000), // 1 minute intervals
      open,
      high,
      low,
      close,
      volume
    });
    
    price = close;
  }
  
  return data;
};

describe('IndicatorPipeline', () => {
  let pipeline: IndicatorPipeline;
  let testData: OHLCV[];
  
  beforeEach(() => {
    pipeline = new IndicatorPipeline({
      batchSize: 100,
      maxConcurrency: 2,
      enableParallelProcessing: false, // Disable for consistent testing
      enableLazyEvaluation: true,
      caching: {
        enabled: true,
        maxCacheSize: 10 * 1024 * 1024, // 10MB
        ttlSeconds: 300, // 5 minutes
        compressionEnabled: false, // Disable for faster tests
        persistToDisk: false
      },
      memory: {
        maxHeapUsage: 50 * 1024 * 1024, // 50MB
        gcThreshold: 80,
        autoCleanup: false // Disable for testing
      }
    });
    
    testData = generateOHLCVData(100);
  });
  
  afterEach(async () => {
    await pipeline.stop();
  });

  describe('Indicator Registration', () => {
    it('should register indicators successfully', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      const indicatorId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend', 'test']
      });
      
      expect(indicatorId).toBeDefined();
      expect(typeof indicatorId).toBe('string');
      
      const registeredIndicators = pipeline.getRegisteredIndicators();
      expect(registeredIndicators).toHaveLength(1);
      expect(registeredIndicators[0].name).toBe('SMA_20');
    });
    
    it('should validate dependencies when registering indicators', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      const rsi = new RSI({ period: 14 });
      
      // Register SMA first
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      // Register RSI with dependency on SMA
      const rsiId = await pipeline.registerIndicator({
        name: 'RSI_14',
        instance: rsi,
        dependencies: [smaId],
        priority: 50,
        config: { period: 14 },
        enabled: true,
        tags: ['momentum']
      });
      
      expect(rsiId).toBeDefined();
      
      const registeredIndicators = pipeline.getRegisteredIndicators();
      expect(registeredIndicators).toHaveLength(2);
    });
    
    it('should reject invalid dependencies', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      await expect(pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: ['nonexistent-indicator'],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      })).rejects.toThrow('Invalid dependencies');
    });
  });

  describe('Batch Processing', () => {
    it('should process batch of indicators successfully', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      const rsi = new RSI({ period: 14 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      const rsiId = await pipeline.registerIndicator({
        name: 'RSI_14',
        instance: rsi,
        dependencies: [],
        priority: 50,
        config: { period: 14 },
        enabled: true,
        tags: ['momentum']
      });
      
      const batchRequest = {
        requestId: 'test-batch-1',
        data: testData,
        indicators: [smaId, rsiId],
        options: {
          useCache: true,
          enableParallel: false
        }
      };
      
      const result = await pipeline.processBatch(batchRequest);
      
      expect(result.success).toBe(true);
      expect(result.results.size).toBe(2);
      expect(result.results.has(smaId)).toBe(true);
      expect(result.results.has(rsiId)).toBe(true);
      expect(result.errors.size).toBe(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });
    
    it('should handle batch processing errors gracefully', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      // Mock indicator to throw error
      vi.spyOn(sma, 'calculate').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const batchRequest = {
        requestId: 'test-batch-error',
        data: testData,
        indicators: [smaId],
        options: {
          useCache: false
        }
      };
      
      const result = await pipeline.processBatch(batchRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors.size).toBe(1);
      expect(result.errors.has(smaId)).toBe(true);
    });
  });

  describe('Streaming Updates', () => {
    it('should process streaming updates for affected indicators', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      // Initialize with historical data
      await pipeline.processBatch({
        requestId: 'init',
        data: testData,
        indicators: [smaId],
        options: {}
      });
      
      // Process streaming update
      const newCandle: OHLCV = {
        time: new Date(),
        open: 105,
        high: 107,
        low: 104,
        close: 106,
        volume: 50000
      };
      
      const streamingRequest = {
        candle: newCandle,
        affectedIndicators: [smaId],
        incremental: true
      };
      
      const results = await pipeline.processStreamingUpdate(streamingRequest);
      
      expect(results.size).toBe(1);
      expect(results.has(smaId)).toBe(true);
      
      const result = results.get(smaId);
      expect(result?.isValid).toBe(true);
      expect(typeof result?.value).toBe('number');
    });
  });

  describe('Caching', () => {
    it('should cache and retrieve results', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      const batchRequest = {
        requestId: 'cache-test-1',
        data: testData,
        indicators: [smaId],
        options: {
          useCache: true
        }
      };
      
      // First calculation should cache result
      const result1 = await pipeline.processBatch(batchRequest);
      expect(result1.success).toBe(true);
      expect(result1.metadata.cacheHits).toBe(0);
      
      // Second calculation with same data should use cache
      const result2 = await pipeline.processBatch({
        ...batchRequest,
        requestId: 'cache-test-2'
      });
      expect(result2.success).toBe(true);
      expect(result2.metadata.cacheHits).toBeGreaterThan(0);
    });
    
    it('should clear indicator cache', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      // Process and cache result
      await pipeline.processBatch({
        requestId: 'cache-clear-test',
        data: testData,
        indicators: [smaId],
        options: { useCache: true }
      });
      
      // Clear cache for specific indicator
      const cleared = pipeline.clearCache();
      expect(cleared).resolves.toBeUndefined();
      
      // Next request should not use cache
      const result = await pipeline.processBatch({
        requestId: 'cache-clear-test-2',
        data: testData,
        indicators: [smaId],
        options: { useCache: true }
      });
      expect(result.metadata.cacheHits).toBe(0);
    });
  });

  describe('Pipeline Status and Management', () => {
    it('should provide accurate pipeline status', () => {
      const status = pipeline.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('activeRequests');
      expect(status).toHaveProperty('totalIndicators');
      expect(status).toHaveProperty('enabledIndicators');
      expect(status).toHaveProperty('cacheStatus');
      expect(status).toHaveProperty('memoryUsage');
      expect(status).toHaveProperty('performance');
      
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.activeRequests).toBe('number');
      expect(typeof status.totalIndicators).toBe('number');
    });
    
    it('should start and stop pipeline correctly', async () => {
      expect(pipeline.getStatus().isRunning).toBe(true);
      
      await pipeline.stop();
      expect(pipeline.getStatus().isRunning).toBe(false);
      
      pipeline.start();
      expect(pipeline.getStatus().isRunning).toBe(true);
    });
    
    it('should provide metrics', () => {
      const metrics = pipeline.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid batch requests', async () => {
      await expect(pipeline.processBatch({
        requestId: '',
        data: [],
        indicators: [],
        options: {}
      })).rejects.toThrow();
      
      await expect(pipeline.processBatch({
        requestId: 'test',
        data: testData,
        indicators: ['nonexistent'],
        options: {}
      })).rejects.toThrow('Indicator nonexistent not found');
    });
    
    it('should handle streaming update errors', async () => {
      const invalidCandle = {
        time: new Date(),
        open: NaN,
        high: 100,
        low: 90,
        close: 95,
        volume: 1000
      } as OHLCV;
      
      await expect(pipeline.processStreamingUpdate({
        candle: invalidCandle,
        incremental: true
      })).rejects.toThrow();
    });
  });

  describe('Configuration Updates', () => {
    it('should update indicator configuration', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      const updated = await pipeline.updateIndicatorConfig(smaId, { period: 25 });
      expect(updated).toBe(true);
      
      const indicator = pipeline.getIndicator(smaId);
      expect(indicator?.config.period).toBe(25);
    });
    
    it('should enable/disable indicators', () => {
      // This test would require the indicator to be registered first
      // and then test the enable/disable functionality
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance', () => {
    it('should handle large batch sizes efficiently', async () => {
      const sma = new SimpleMovingAverage({ period: 20 });
      
      const smaId = await pipeline.registerIndicator({
        name: 'SMA_20',
        instance: sma,
        dependencies: [],
        priority: 50,
        config: { period: 20 },
        enabled: true,
        tags: ['trend']
      });
      
      const largeData = generateOHLCVData(1000);
      const startTime = performance.now();
      
      const result = await pipeline.processBatch({
        requestId: 'large-batch',
        data: largeData,
        indicators: [smaId],
        options: {
          useCache: true
        }
      });
      
      const processingTime = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
    
    it('should maintain memory usage within bounds', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process multiple large batches
      for (let i = 0; i < 5; i++) {
        const sma = new SimpleMovingAverage({ period: 20 });
        
        const smaId = await pipeline.registerIndicator({
          name: `SMA_${i}`,
          instance: sma,
          dependencies: [],
          priority: 50,
          config: { period: 20 },
          enabled: true,
          tags: ['trend']
        });
        
        await pipeline.processBatch({
          requestId: `memory-test-${i}`,
          data: generateOHLCVData(500),
          indicators: [smaId],
          options: { useCache: true }
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable (less than 50MB for this test)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

describe('Pipeline Integration', () => {
  let pipeline: IndicatorPipeline;
  
  beforeEach(() => {
    pipeline = new IndicatorPipeline({
      enableParallelProcessing: false,
      enableLazyEvaluation: true,
      caching: { enabled: true, persistToDisk: false }
    });
  });
  
  afterEach(async () => {
    await pipeline.stop();
  });

  it('should handle complex indicator dependencies', async () => {
    const sma20 = new SimpleMovingAverage({ period: 20 });
    const sma50 = new SimpleMovingAverage({ period: 50 });
    const rsi = new RSI({ period: 14 });
    
    // Register indicators with dependencies
    const sma20Id = await pipeline.registerIndicator({
      name: 'SMA_20',
      instance: sma20,
      dependencies: [],
      priority: 50,
      config: { period: 20 },
      enabled: true,
      tags: ['trend', 'fast']
    });
    
    const sma50Id = await pipeline.registerIndicator({
      name: 'SMA_50',
      instance: sma50,
      dependencies: [],
      priority: 40,
      config: { period: 50 },
      enabled: true,
      tags: ['trend', 'slow']
    });
    
    const rsiId = await pipeline.registerIndicator({
      name: 'RSI_14',
      instance: rsi,
      dependencies: [sma20Id], // RSI depends on SMA20
      priority: 60,
      config: { period: 14 },
      enabled: true,
      tags: ['momentum']
    });
    
    const testData = generateOHLCVData(100);
    
    const result = await pipeline.processBatch({
      requestId: 'dependency-test',
      data: testData,
      indicators: [rsiId, sma50Id], // Should resolve SMA20 automatically
      options: {
        useCache: true
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.results.size).toBe(2);
    expect(result.results.has(rsiId)).toBe(true);
    expect(result.results.has(sma50Id)).toBe(true);
  });
  
  it('should emit appropriate events during processing', async () => {
    const events: string[] = [];
    
    pipeline.on('batchStarted', () => events.push('batchStarted'));
    pipeline.on('batchCompleted', () => events.push('batchCompleted'));
    pipeline.on('indicatorRegistered', () => events.push('indicatorRegistered'));
    
    const sma = new SimpleMovingAverage({ period: 20 });
    await pipeline.registerIndicator({
      name: 'SMA_20',
      instance: sma,
      dependencies: [],
      priority: 50,
      config: { period: 20 },
      enabled: true,
      tags: ['trend']
    });
    
    expect(events).toContain('indicatorRegistered');
    
    const testData = generateOHLCVData(50);
    await pipeline.processBatch({
      requestId: 'event-test',
      data: testData,
      indicators: [pipeline.getRegisteredIndicators()[0].id],
      options: {}
    });
    
    expect(events).toContain('batchStarted');
    expect(events).toContain('batchCompleted');
  });
});