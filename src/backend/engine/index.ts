/**
 * Strategy Engine Index - Task BE-016
 * 
 * Centralized exports for all strategy engine components including
 * the main orchestration engine, executors, processors, monitors,
 * risk controllers, and event management system.
 */

// Core engine components
export { StrategyEngine } from './StrategyEngine.js';
export type { 
  StrategyEngineState,
  StrategyEngineConfig,
  TradeDecision,
  StrategyResult,
  EngineMetrics
} from './StrategyEngine.js';

export { StrategyExecutor } from './StrategyExecutor.js';
export type {
  StrategyExecutorConfig
} from './StrategyExecutor.js';

// Signal processing
export { SignalProcessor } from './SignalProcessor.js';
export type {
  SignalConflictType,
  ConflictResolutionStrategy,
  SignalQualityMetrics,
  SignalConflict,
  ProcessedSignal,
  SignalProcessorConfig,
  SignalAggregationResult,
  ProcessingStatistics
} from './SignalProcessor.js';

// Performance monitoring
export { PerformanceMonitor } from './PerformanceMonitor.js';
export type {
  AlertLevel,
  PerformanceAlert,
  SystemMetrics,
  TradingMetrics,
  PerformanceBenchmark,
  PerformanceReport,
  PerformanceMonitorConfig
} from './PerformanceMonitor.js';

// Risk management
export { RiskController } from './RiskController.js';
export type {
  RiskSeverity,
  RiskCategory,
  RiskEvent,
  RiskProfile,
  RiskValidationResult,
  PortfolioRiskMetrics,
  RiskControllerConfig
} from './RiskController.js';

// Event management
export { EventManager } from './EventManager.js';
export type {
  EventPriority,
  EventCategory,
  EventStatus,
  EngineEvent,
  EventHandler,
  EventFilter,
  EventSubscription,
  EventStream,
  EventAnalytics,
  EventManagerConfig
} from './EventManager.js';

/**
 * Engine Factory for creating complete strategy engine instances
 */
export class EngineFactory {
  /**
   * Create a complete strategy engine with all components
   */
  static async createEngine(config: {
    engineConfig?: any;
    signalProcessorConfig?: any;
    performanceMonitorConfig?: any;
    riskControllerConfig?: any;
    eventManagerConfig?: any;
    dependencies: {
      marketDataRepository: any;
      strategyRepository: any;
      tradeRepository: any;
      databaseManager: any;
    };
  }): Promise<{
    engine: StrategyEngine;
    signalProcessor: SignalProcessor;
    performanceMonitor: PerformanceMonitor;
    riskController: RiskController;
    eventManager: EventManager;
  }> {
    
    // Create individual components
    const signalProcessor = new SignalProcessor(config.signalProcessorConfig);
    const performanceMonitor = new PerformanceMonitor(config.performanceMonitorConfig);
    const riskController = new RiskController(config.riskControllerConfig);
    const eventManager = new EventManager(config.eventManagerConfig);
    
    // Create main engine
    const engine = new StrategyEngine(
      config.engineConfig || {
        maxConcurrentStrategies: 10,
        maxSignalsPerSecond: 100,
        defaultExecutionTimeout: 30000,
        maxMemoryUsage: 1000,
        maxCpuUsage: 80,
        maxLatency: 1000,
        emergencyStopEnabled: true,
        maxPortfolioRisk: 15,
        correlationThreshold: 0.8,
        healthCheckInterval: 300,
        performanceReviewInterval: 60,
        metricsRetentionPeriod: 30,
        eventRetention: 10000,
        alertThresholds: {
          errorRate: 5,
          latency: 5000,
          drawdown: 10
        }
      },
      config.dependencies
    );
    
    // Initialize all components
    await Promise.all([
      engine.initialize(),
      signalProcessor.initialize(),
      performanceMonitor.initialize(),
      riskController.initialize(),
      eventManager.initialize()
    ]);
    
    return {
      engine,
      signalProcessor,
      performanceMonitor,
      riskController,
      eventManager
    };
  }

  /**
   * Create a minimal engine for development/testing
   */
  static async createMinimalEngine(dependencies: {
    marketDataRepository: any;
    strategyRepository: any;
    tradeRepository: any;
    databaseManager: any;
  }): Promise<StrategyEngine> {
    
    const { engine } = await this.createEngine({
      engineConfig: {
        maxConcurrentStrategies: 3,
        maxSignalsPerSecond: 10,
        defaultExecutionTimeout: 10000,
        maxMemoryUsage: 500,
        maxCpuUsage: 60,
        maxLatency: 2000,
        emergencyStopEnabled: true,
        maxPortfolioRisk: 10,
        correlationThreshold: 0.7,
        healthCheckInterval: 60,
        performanceReviewInterval: 30,
        metricsRetentionPeriod: 7,
        eventRetention: 1000,
        alertThresholds: {
          errorRate: 10,
          latency: 3000,
          drawdown: 5
        }
      },
      signalProcessorConfig: {
        aggregationWindow: 2000,
        maxSignalAge: 120000,
        processingBatchSize: 10,
        conflictResolutionStrategy: 'confidence_based' as const,
        minQualityScore: 0.4
      },
      performanceMonitorConfig: {
        metricsInterval: 30000,
        alertCheckInterval: 15000,
        reportInterval: 300000,
        enableReports: false
      },
      riskControllerConfig: {
        riskThresholds: {
          portfolio: 10,
          position: 3,
          correlation: 0.7,
          drawdown: 8,
          volatility: 40
        },
        maxPositionSize: 5,
        monitoringInterval: 15000
      },
      eventManagerConfig: {
        maxEvents: 1000,
        maxConcurrentHandlers: 3,
        batchSize: 10,
        enableAnalytics: false
      },
      dependencies
    });
    
    return engine;
  }
}

/**
 * Engine utilities for common operations
 */
export class EngineUtils {
  /**
   * Validate engine configuration
   */
  static validateEngineConfig(config: any): { valid: boolean; errors: string[]; } {
    const errors: string[] = [];
    
    // Validate basic configuration
    if (!config.maxConcurrentStrategies || config.maxConcurrentStrategies < 1) {
      errors.push('maxConcurrentStrategies must be at least 1');
    }
    
    if (!config.maxSignalsPerSecond || config.maxSignalsPerSecond < 1) {
      errors.push('maxSignalsPerSecond must be at least 1');
    }
    
    if (!config.defaultExecutionTimeout || config.defaultExecutionTimeout < 1000) {
      errors.push('defaultExecutionTimeout must be at least 1000ms');
    }
    
    // Validate thresholds
    if (config.alertThresholds) {
      if (config.alertThresholds.errorRate < 0 || config.alertThresholds.errorRate > 100) {
        errors.push('alertThresholds.errorRate must be between 0 and 100');
      }
    }
    
    // Validate risk settings
    if (config.maxPortfolioRisk && (config.maxPortfolioRisk < 1 || config.maxPortfolioRisk > 100)) {
      errors.push('maxPortfolioRisk must be between 1 and 100');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get default engine configuration
   */
  static getDefaultConfig(): any {
    return {
      maxConcurrentStrategies: 10,
      maxSignalsPerSecond: 50,
      defaultExecutionTimeout: 30000,
      maxMemoryUsage: 1000,
      maxCpuUsage: 80,
      maxLatency: 2000,
      emergencyStopEnabled: true,
      maxPortfolioRisk: 20,
      correlationThreshold: 0.8,
      healthCheckInterval: 300,
      performanceReviewInterval: 60,
      metricsRetentionPeriod: 30,
      eventRetention: 10000,
      alertThresholds: {
        errorRate: 5,
        latency: 5000,
        drawdown: 15
      }
    };
  }
  
  /**
   * Create engine health checker
   */
  static createHealthChecker(engine: StrategyEngine) {
    return {
      async checkHealth(): Promise<{
        healthy: boolean;
        issues: string[];
        metrics: any;
        recommendations: string[];
      }> {
        const status = engine.getStatus();
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        // Check engine state
        if (status.state === 'error') {
          issues.push('Engine is in error state');
          recommendations.push('Restart the engine');
        }
        
        // Check strategy states
        const errorStrategies = status.strategies.filter(s => s.state === 'error').length;
        if (errorStrategies > 0) {
          issues.push(`${errorStrategies} strategies are in error state`);
          recommendations.push('Review strategy configurations and logs');
        }
        
        // Check resource usage
        if (status.metrics.memoryUsage > 800) {
          issues.push('High memory usage detected');
          recommendations.push('Monitor memory usage and optimize strategies');
        }
        
        // Check alert count
        const criticalAlerts = status.alerts.filter(a => 
          a.level === 'critical' || a.level === 'emergency'
        ).length;
        
        if (criticalAlerts > 0) {
          issues.push(`${criticalAlerts} critical alerts require attention`);
          recommendations.push('Review and resolve critical alerts');
        }
        
        return {
          healthy: issues.length === 0,
          issues,
          metrics: status.metrics,
          recommendations
        };
      }
    };
  }
}

/**
 * Strategy Engine Constants
 */
export const ENGINE_CONSTANTS = {
  // Default timeouts
  DEFAULT_EXECUTION_TIMEOUT: 30000,
  DEFAULT_SIGNAL_TIMEOUT: 5000,
  DEFAULT_HEALTH_CHECK_INTERVAL: 300000,
  
  // Limits
  MAX_CONCURRENT_STRATEGIES: 100,
  MAX_SIGNALS_PER_SECOND: 1000,
  MAX_EVENTS_IN_MEMORY: 50000,
  
  // Risk defaults
  DEFAULT_MAX_PORTFOLIO_RISK: 20,
  DEFAULT_MAX_POSITION_RISK: 5,
  DEFAULT_CORRELATION_THRESHOLD: 0.8,
  
  // Performance thresholds
  PERFORMANCE_WARNING_THRESHOLD: 5000, // 5 seconds
  MEMORY_WARNING_THRESHOLD: 1000,      // 1 GB
  ERROR_RATE_WARNING_THRESHOLD: 5,     // 5%
  
  // Event priorities
  EVENT_PRIORITIES: {
    LOW: 'low' as const,
    NORMAL: 'normal' as const,
    HIGH: 'high' as const,
    CRITICAL: 'critical' as const,
    EMERGENCY: 'emergency' as const
  }
} as const;

export default StrategyEngine;