/**
 * Signal Generation System - Task BE-014: Signal Generation System
 * 
 * Main module exports for the enterprise-grade signal generation framework
 */

// Core signal generation
export { SignalGenerator } from './SignalGenerator.js';
export { SignalHistoryManager } from './SignalHistoryManager.js';
export { RealTimeSignalProcessor } from './RealTimeSignalProcessor.js';

// Types and interfaces
export type {
  // Core types
  ISignalGenerator,
  SignalGenerationConfig,
  SignalGenerationRequest,
  SignalGenerationResult,
  SignalHistoryEntry,
  SignalProcessingStats,
  ConfidenceScoringConfig,
  
  // Validation and enhancement
  SignalValidationRule,
  SignalConflictResolver,
  SignalEnhancementPlugin,
  
  // Events and processing
  SignalProcessingEvent,
  
  // Errors
  SignalGenerationError,
  SignalValidationError,
  SignalConflictError,
  SignalTimeoutError
} from './types.js';

// History management types
export type {
  SignalHistoryConfig,
  SignalHistoryQuery,
  SignalPerformanceMetrics
} from './SignalHistoryManager.js';

// Real-time processing types
export type {
  RealTimeProcessingConfig
} from './RealTimeSignalProcessor.js';

// Re-export strategy signal types for convenience
export type {
  StrategySignal,
  StrategySignalType,
  StrategyContext
} from '../strategies/types.js';

/**
 * Default configurations for different deployment scenarios
 */
export const DEFAULT_CONFIGS = {
  // Development configuration
  development: {
    signalGenerator: {
      enableRealTimeProcessing: true,
      processingInterval: 2000,
      batchSize: 5,
      maxConcurrency: 3,
      validation: {
        minConfidence: 50,
        maxSignalsPerInterval: 20,
        duplicateDetection: true,
        conflictResolution: 'highest_confidence' as const
      },
      persistence: {
        enableHistory: true,
        maxHistorySize: 1000,
        retentionPeriodDays: 7
      }
    },
    historyManager: {
      maxEntriesPerStrategy: 1000,
      retentionPeriodDays: 30,
      enableAnalytics: true,
      analyticsInterval: 60000
    },
    realTimeProcessor: {
      signalGenerationInterval: 1000,
      maxRequestsPerSecond: 50,
      maxConcurrentRequests: 5,
      batchSize: 3,
      enableBatching: true
    }
  },
  
  // Production configuration
  production: {
    signalGenerator: {
      enableRealTimeProcessing: true,
      processingInterval: 500,
      batchSize: 20,
      maxConcurrency: 15,
      validation: {
        minConfidence: 70,
        maxSignalsPerInterval: 500,
        duplicateDetection: true,
        conflictResolution: 'highest_confidence' as const
      },
      persistence: {
        enableHistory: true,
        maxHistorySize: 50000,
        retentionPeriodDays: 365,
        compressionEnabled: true
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 30000,
        alertThresholds: {
          lowConfidenceRate: 0.2,
          highLatency: 2000,
          errorRate: 0.05
        }
      }
    },
    historyManager: {
      maxEntriesPerStrategy: 100000,
      retentionPeriodDays: 730,
      archiveAfterDays: 90,
      enableCompression: true,
      enableAnalytics: true,
      analyticsInterval: 300000,
      cacheSize: 10000
    },
    realTimeProcessor: {
      signalGenerationInterval: 200,
      maxRequestsPerSecond: 1000,
      maxConcurrentRequests: 50,
      backpressureThreshold: 5000,
      batchSize: 25,
      enableBatching: true,
      priorityQueues: true,
      significantPriceChangeThreshold: 0.001,
      maxMemoryUsage: 2 * 1024 * 1024 * 1024 // 2GB
    }
  },
  
  // Testing configuration
  testing: {
    signalGenerator: {
      enableRealTimeProcessing: false,
      processingInterval: 100,
      batchSize: 1,
      maxConcurrency: 1,
      validation: {
        minConfidence: 0,
        maxSignalsPerInterval: 1000,
        duplicateDetection: false
      },
      persistence: {
        enableHistory: false
      }
    },
    historyManager: {
      maxEntriesPerStrategy: 100,
      retentionPeriodDays: 1,
      enableAnalytics: false
    },
    realTimeProcessor: {
      signalGenerationInterval: 100,
      maxRequestsPerSecond: 1000,
      maxConcurrentRequests: 1,
      enableBatching: false
    }
  }
};

/**
 * Signal system factory for easy initialization
 */
export class SignalSystemFactory {
  /**
   * Create a complete signal processing system
   */
  static createSystem(environment: 'development' | 'production' | 'testing' = 'development') {
    const configs = DEFAULT_CONFIGS[environment];
    
    const signalGenerator = new SignalGenerator(
      configs.signalGenerator as any,
      {
        method: 'weighted',
        weights: {
          conditionConfidence: 0.4,
          indicatorAlignment: 0.2,
          marketConditions: 0.15,
          historicalAccuracy: 0.15,
          timeframe: 0.05,
          volume: 0.03,
          volatility: 0.02
        },
        adjustments: {
          penalizeConflicts: true,
          rewardConsensus: true,
          timeDecay: false,
          marketRegimeAdjustment: true
        },
        normalization: {
          method: 'sigmoid',
          range: [0, 1]
        }
      }
    );
    
    const historyManager = new SignalHistoryManager(configs.historyManager as any);
    
    const realTimeProcessor = new RealTimeSignalProcessor(
      configs.realTimeProcessor as any,
      signalGenerator,
      historyManager
    );
    
    return {
      signalGenerator,
      historyManager,
      realTimeProcessor,
      
      // Convenience methods
      async start() {
        await realTimeProcessor.startProcessing();
      },
      
      async stop() {
        await realTimeProcessor.stopProcessing();
      },
      
      async cleanup() {
        await realTimeProcessor.cleanup();
        await historyManager.cleanup();
      }
    };
  }
  
  /**
   * Create a basic signal generator only
   */
  static createSignalGenerator(environment: 'development' | 'production' | 'testing' = 'development') {
    const config = DEFAULT_CONFIGS[environment].signalGenerator;
    return new SignalGenerator(config as any);
  }
  
  /**
   * Create a history manager only
   */
  static createHistoryManager(environment: 'development' | 'production' | 'testing' = 'development') {
    const config = DEFAULT_CONFIGS[environment].historyManager;
    return new SignalHistoryManager(config as any);
  }
}

/**
 * Utility functions for signal processing
 */
export const SignalUtils = {
  /**
   * Calculate signal strength from multiple factors
   */
  calculateSignalStrength(factors: {
    conditionConfidence: number;
    indicatorAlignment: number;
    volumeConfirmation: number;
    marketMomentum: number;
  }): number {
    const weights = {
      conditionConfidence: 0.4,
      indicatorAlignment: 0.3,
      volumeConfirmation: 0.2,
      marketMomentum: 0.1
    };
    
    return Object.entries(factors).reduce((strength, [key, value]) => {
      const weight = weights[key as keyof typeof weights] || 0;
      return strength + (value * weight);
    }, 0);
  },
  
  /**
   * Determine if two signals conflict
   */
  signalsConflict(signal1: StrategySignal, signal2: StrategySignal): boolean {
    // Same symbol and timeframe with opposite directions
    if (signal1.symbol === signal2.symbol && 
        signal1.timeframe === signal2.timeframe) {
      
      const oppositeTypes = [
        ['BUY', 'SELL'],
        ['CLOSE_LONG', 'CLOSE_SHORT']
      ];
      
      return oppositeTypes.some(([type1, type2]) =>
        (signal1.type === type1 && signal2.type === type2) ||
        (signal1.type === type2 && signal2.type === type1)
      );
    }
    
    return false;
  },
  
  /**
   * Merge compatible signals
   */
  mergeSignals(signals: StrategySignal[]): StrategySignal | null {
    if (signals.length === 0) return null;
    if (signals.length === 1) return signals[0];
    
    // Only merge if all signals are for same symbol, timeframe, and type
    const first = signals[0];
    const compatible = signals.every(signal =>
      signal.symbol === first.symbol &&
      signal.timeframe === first.timeframe &&
      signal.type === first.type
    );
    
    if (!compatible) return null;
    
    // Create merged signal
    const merged: StrategySignal = {
      ...first,
      id: `merged_${signals.map(s => s.id.split('_').pop()).join('_')}_${Date.now()}`,
      confidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
      strength: signals.reduce((sum, s) => sum + s.strength, 0) / signals.length,
      conditions: signals.flatMap(s => s.conditions || []),
      reasoning: `Merged signal from ${signals.length} compatible signals: ${signals.map(s => s.reasoning).join('; ')}`,
      metadata: {
        merged: true,
        originalSignals: signals.map(s => s.id),
        mergeTimestamp: new Date()
      }
    };
    
    return merged;
  }
};

export default {
  SignalGenerator,
  SignalHistoryManager,
  RealTimeSignalProcessor,
  SignalSystemFactory,
  SignalUtils,
  DEFAULT_CONFIGS
};