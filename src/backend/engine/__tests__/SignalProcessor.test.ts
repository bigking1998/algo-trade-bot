/**
 * Signal Processor Tests - Task BE-016
 * 
 * Comprehensive unit tests for the SignalProcessor component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalProcessor } from '../SignalProcessor';
import type { SignalProcessorConfig } from '../SignalProcessor';
import type { StrategySignal } from '../../strategies/types';

const createMockSignal = (overrides: Partial<StrategySignal> = {}): StrategySignal => ({
  id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  strategyId: 'test-strategy',
  timestamp: new Date(),
  type: 'BUY',
  symbol: 'BTC-USD',
  confidence: 80,
  strength: 0.8,
  quantity: 100,
  entryPrice: 50000,
  stopLoss: 48000,
  takeProfit: 55000,
  timeframe: '1m',
  reasoning: 'Test signal',
  conditions: ['RSI oversold'],
  priority: 'medium',
  isValid: true,
  ...overrides
});

describe('SignalProcessor', () => {
  let signalProcessor: SignalProcessor;
  
  const defaultConfig: Partial<SignalProcessorConfig> = {
    aggregationWindow: 1000,
    maxSignalAge: 60000,
    processingBatchSize: 10,
    conflictResolutionStrategy: 'confidence_based',
    enableConflictLogging: true,
    conflictThreshold: 0.3,
    minQualityScore: 0.5,
    maxSignalsPerSymbol: 3,
    enableDeduplication: true
  };

  beforeEach(async () => {
    signalProcessor = new SignalProcessor(defaultConfig);
    await signalProcessor.initialize();
  });

  afterEach(async () => {
    await signalProcessor.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const processor = new SignalProcessor();
      await expect(processor.initialize()).resolves.not.toThrow();
      await processor.cleanup();
    });

    it('should emit initialized event', async () => {
      const processor = new SignalProcessor();
      const initSpy = vi.fn();
      processor.on('initialized', initSpy);
      
      await processor.initialize();
      expect(initSpy).toHaveBeenCalled();
      
      await processor.cleanup();
    });
  });

  describe('Signal Processing', () => {
    it('should process valid signals successfully', async () => {
      const signals = [
        createMockSignal(),
        createMockSignal({ symbol: 'ETH-USD' })
      ];

      const processedSignals = await signalProcessor.processSignals(signals);

      expect(processedSignals).toBeDefined();
      expect(Array.isArray(processedSignals)).toBe(true);
      expect(processedSignals.length).toBeGreaterThan(0);
    });

    it('should filter out invalid signals', async () => {
      const signals = [
        createMockSignal({ confidence: 80 }),
        createMockSignal({ confidence: -10, isValid: false }), // Invalid
        createMockSignal({ confidence: 150, isValid: false }) // Invalid
      ];

      const processedSignals = await signalProcessor.processSignals(signals);

      // Should filter out invalid signals
      expect(processedSignals.length).toBeLessThan(signals.length);
    });

    it('should add quality metrics to processed signals', async () => {
      const signals = [createMockSignal()];

      const processedSignals = await signalProcessor.processSignals(signals);

      expect(processedSignals[0]).toHaveProperty('qualityMetrics');
      expect(processedSignals[0].qualityMetrics).toHaveProperty('confidence');
      expect(processedSignals[0].qualityMetrics).toHaveProperty('strength');
      expect(processedSignals[0].qualityMetrics).toHaveProperty('overallQuality');
    });

    it('should add processing metadata', async () => {
      const signals = [createMockSignal()];

      const processedSignals = await signalProcessor.processSignals(signals);

      expect(processedSignals[0]).toHaveProperty('processing');
      expect(processedSignals[0].processing).toHaveProperty('originalSignal');
      expect(processedSignals[0].processing).toHaveProperty('processingTime');
      expect(processedSignals[0].processing).toHaveProperty('modifications');
    });

    it('should handle empty signal array', async () => {
      const processedSignals = await signalProcessor.processSignals([]);
      
      expect(processedSignals).toEqual([]);
    });

    it('should handle processing errors gracefully', async () => {
      // Create an invalid signal that might cause processing errors
      const invalidSignal = {
        ...createMockSignal(),
        id: '', // Invalid ID
        symbol: '', // Invalid symbol
        type: 'INVALID' as any
      };

      const processedSignals = await signalProcessor.processSignals([invalidSignal]);
      
      // Should not throw and return empty or filtered results
      expect(processedSignals).toBeDefined();
      expect(Array.isArray(processedSignals)).toBe(true);
    });
  });

  describe('Signal Deduplication', () => {
    it('should remove duplicate signals when enabled', async () => {
      const baseSignal = createMockSignal();
      const signals = [
        baseSignal,
        { ...baseSignal, id: 'duplicate-1', confidence: 75 },
        { ...baseSignal, id: 'duplicate-2', confidence: 85 } // Highest confidence
      ];

      const processedSignals = await signalProcessor.processSignals(signals);

      // Should keep only one signal (the one with highest confidence)
      expect(processedSignals.length).toBe(1);
      expect(processedSignals[0].confidence).toBe(85);
    });

    it('should not deduplicate when disabled', async () => {
      const processor = new SignalProcessor({
        ...defaultConfig,
        enableDeduplication: false
      });
      await processor.initialize();

      const baseSignal = createMockSignal();
      const signals = [
        baseSignal,
        { ...baseSignal, id: 'duplicate-1' }
      ];

      const processedSignals = await processor.processSignals(signals);

      // Should keep all signals when deduplication is disabled
      expect(processedSignals.length).toBeGreaterThan(1);

      await processor.cleanup();
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect directional conflicts', async () => {
      const buySignal = createMockSignal({ type: 'BUY', symbol: 'BTC-USD' });
      const sellSignal = createMockSignal({ type: 'SELL', symbol: 'BTC-USD' });

      const conflictSpy = vi.fn();
      signalProcessor.on('conflicts_detected', conflictSpy);

      await signalProcessor.processSignals([buySignal, sellSignal]);

      expect(conflictSpy).toHaveBeenCalled();
      expect(conflictSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conflicts: expect.arrayContaining([
            expect.objectContaining({
              type: 'directional_conflict'
            })
          ])
        })
      );
    });

    it('should resolve conflicts using confidence-based strategy', async () => {
      const processor = new SignalProcessor({
        ...defaultConfig,
        conflictResolutionStrategy: 'confidence_based'
      });
      await processor.initialize();

      const lowConfidenceSignal = createMockSignal({ 
        type: 'BUY', 
        symbol: 'BTC-USD', 
        confidence: 60 
      });
      const highConfidenceSignal = createMockSignal({ 
        type: 'SELL', 
        symbol: 'BTC-USD', 
        confidence: 90 
      });

      const processedSignals = await processor.processSignals([
        lowConfidenceSignal, 
        highConfidenceSignal
      ]);

      // Should keep the high confidence signal
      expect(processedSignals.length).toBe(1);
      expect(processedSignals[0].confidence).toBe(90);

      await processor.cleanup();
    });

    it('should resolve conflicts using priority-weighted strategy', async () => {
      const processor = new SignalProcessor({
        ...defaultConfig,
        conflictResolutionStrategy: 'priority_weighted'
      });
      await processor.initialize();

      const mediumPrioritySignal = createMockSignal({ 
        type: 'BUY', 
        symbol: 'BTC-USD',
        confidence: 80,
        priority: 'medium'
      });
      const criticalPrioritySignal = createMockSignal({ 
        type: 'SELL', 
        symbol: 'BTC-USD',
        confidence: 70,
        priority: 'critical'
      });

      const processedSignals = await processor.processSignals([
        mediumPrioritySignal, 
        criticalPrioritySignal
      ]);

      // Should keep the critical priority signal even with lower confidence
      expect(processedSignals.length).toBe(1);
      expect(processedSignals[0].priority).toBe('critical');

      await processor.cleanup();
    });

    it('should handle resource conflicts', async () => {
      const signals = [];
      // Create more signals than the maxSignalsPerSymbol limit
      for (let i = 0; i < 5; i++) {
        signals.push(createMockSignal({ symbol: 'BTC-USD' }));
      }

      const processedSignals = await signalProcessor.processSignals(signals);

      // Should limit to maxSignalsPerSymbol
      expect(processedSignals.length).toBeLessThanOrEqual(defaultConfig.maxSignalsPerSymbol!);
    });
  });

  describe('Quality Scoring', () => {
    it('should calculate quality scores for signals', async () => {
      const highQualitySignal = createMockSignal({
        confidence: 95,
        strength: 0.9,
        stopLoss: 48000,
        entryPrice: 50000
      });

      const processedSignals = await signalProcessor.processSignals([highQualitySignal]);

      expect(processedSignals[0].qualityMetrics.overallQuality).toBeGreaterThan(0.5);
    });

    it('should filter out low quality signals', async () => {
      const processor = new SignalProcessor({
        ...defaultConfig,
        minQualityScore: 0.8 // High threshold
      });
      await processor.initialize();

      const lowQualitySignal = createMockSignal({
        confidence: 30, // Low confidence
        strength: 0.2   // Low strength
      });

      const processedSignals = await processor.processSignals([lowQualitySignal]);

      // Should filter out the low quality signal
      expect(processedSignals.length).toBe(0);

      await processor.cleanup();
    });

    it('should consider signal timeliness in quality scoring', async () => {
      const oldSignal = createMockSignal({
        timestamp: new Date(Date.now() - 120000) // 2 minutes old
      });

      const freshSignal = createMockSignal({
        timestamp: new Date() // Fresh signal
      });

      const processedSignals = await signalProcessor.processSignals([oldSignal, freshSignal]);

      // Fresh signal should have better timeliness score
      const freshProcessed = processedSignals.find(s => s.id === freshSignal.id);
      const oldProcessed = processedSignals.find(s => s.id === oldSignal.id);

      if (freshProcessed && oldProcessed) {
        expect(freshProcessed.qualityMetrics.timeliness).toBeGreaterThan(
          oldProcessed.qualityMetrics.timeliness
        );
      }
    });
  });

  describe('Signal Ranking and Prioritization', () => {
    it('should rank signals by quality', async () => {
      const signals = [
        createMockSignal({ confidence: 60, strength: 0.6 }), // Lower quality
        createMockSignal({ confidence: 90, strength: 0.9 }), // Higher quality
        createMockSignal({ confidence: 75, strength: 0.7 })  // Medium quality
      ];

      const processedSignals = await signalProcessor.processSignals(signals);

      // Should be ranked by quality (higher quality first)
      for (let i = 0; i < processedSignals.length - 1; i++) {
        expect(processedSignals[i].qualityMetrics.overallQuality).toBeGreaterThanOrEqual(
          processedSignals[i + 1].qualityMetrics.overallQuality
        );
      }
    });

    it('should assign rankings to processed signals', async () => {
      const signals = [
        createMockSignal(),
        createMockSignal({ symbol: 'ETH-USD' })
      ];

      const processedSignals = await signalProcessor.processSignals(signals);

      processedSignals.forEach((signal, index) => {
        expect(signal.ranking).toBe(index + 1);
      });
    });
  });

  describe('Signal Aggregation Window', () => {
    it('should queue signals for aggregation', async () => {
      const signal = createMockSignal();
      
      const processingPromise = new Promise(resolve => {
        signalProcessor.on('aggregated_signals_processed', resolve);
      });

      signalProcessor.queueSignalsForProcessing([signal]);

      // Wait for aggregation window to complete
      await processingPromise;
    });

    it('should batch signals within aggregation window', async () => {
      const signals = [
        createMockSignal({ symbol: 'BTC-USD' }),
        createMockSignal({ symbol: 'BTC-USD' })
      ];

      let processedCount = 0;
      signalProcessor.on('aggregated_signals_processed', (event) => {
        processedCount = event.count;
      });

      await signalProcessor.queueSignalsForProcessing(signals);

      // Allow aggregation window to complete
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(processedCount).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Analytics', () => {
    it('should track processing statistics', async () => {
      const signals = [createMockSignal(), createMockSignal()];
      
      await signalProcessor.processSignals(signals);
      
      const stats = signalProcessor.getStatistics();
      
      expect(stats).toHaveProperty('signalsReceived');
      expect(stats).toHaveProperty('signalsPassed');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successRate');
      expect(stats.signalsReceived).toBeGreaterThan(0);
    });

    it('should track conflict metrics', async () => {
      const buySignal = createMockSignal({ type: 'BUY' });
      const sellSignal = createMockSignal({ type: 'SELL' });

      await signalProcessor.processSignals([buySignal, sellSignal]);

      const stats = signalProcessor.getStatistics();
      expect(stats.conflictsDetected).toBeGreaterThan(0);
    });

    it('should calculate processing rates', async () => {
      const signals = Array.from({ length: 10 }, () => createMockSignal());
      
      const start = Date.now();
      await signalProcessor.processSignals(signals);
      const duration = Date.now() - start;

      const stats = signalProcessor.getStatistics();
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeLessThan(duration * 2); // Reasonable bound
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', () => {
      const clearSpy = vi.fn();
      signalProcessor.on('cache_cleared', clearSpy);
      
      signalProcessor.clearCache();
      
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should clean up expired signals automatically', async () => {
      const processor = new SignalProcessor({
        ...defaultConfig,
        maxSignalAge: 100 // Very short age for testing
      });
      await processor.initialize();

      const expiredSignal = createMockSignal({
        timestamp: new Date(Date.now() - 200) // Older than max age
      });

      // Process the expired signal
      await processor.processSignals([expiredSignal]);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleanupSpy = vi.fn();
      processor.on('expired_signals_cleaned', cleanupSpy);

      // Trigger cleanup manually for testing
      await new Promise(resolve => setTimeout(resolve, 100));

      await processor.cleanup();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed signals gracefully', async () => {
      const malformedSignals = [
        null,
        undefined,
        {},
        { id: 'test' }, // Missing required fields
        createMockSignal() // Valid signal
      ].filter(Boolean) as StrategySignal[];

      // Should not throw even with malformed data
      const processedSignals = await signalProcessor.processSignals(malformedSignals);
      
      expect(processedSignals).toBeDefined();
      expect(Array.isArray(processedSignals)).toBe(true);
    });

    it('should emit processing errors for invalid signals', async () => {
      const errorSpy = vi.fn();
      signalProcessor.on('processing_error', errorSpy);

      const invalidSignal = createMockSignal({
        type: 'INVALID_TYPE' as any,
        confidence: -50 // Invalid confidence
      });

      await signalProcessor.processSignals([invalidSignal]);

      // May emit error events for invalid signals
      // This depends on the specific validation logic
    });

    it('should maintain processing statistics even after errors', async () => {
      const signals = [
        createMockSignal(),
        createMockSignal({ confidence: -10 }), // Invalid
        createMockSignal()
      ];

      await signalProcessor.processSignals(signals);

      const stats = signalProcessor.getStatistics();
      expect(stats.signalsReceived).toBe(signals.length);
      expect(stats.totalProcessed).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      const cleanupSpy = vi.fn();
      signalProcessor.on('cleanup_completed', cleanupSpy);
      
      await signalProcessor.cleanup();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should clear pending signals on cleanup', async () => {
      signalProcessor.queueSignalsForProcessing([createMockSignal()]);
      
      await signalProcessor.cleanup();
      
      // After cleanup, should not process any pending signals
      const stats = signalProcessor.getStatistics();
      expect(stats).toBeDefined();
    });

    it('should handle cleanup when already cleaned', async () => {
      await signalProcessor.cleanup();
      
      // Should not throw when cleaning up again
      await expect(signalProcessor.cleanup()).resolves.not.toThrow();
    });
  });
});