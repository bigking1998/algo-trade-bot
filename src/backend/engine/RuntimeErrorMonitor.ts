/**
 * Runtime Error Monitor - Task BE-017 Component
 * 
 * Comprehensive runtime error monitoring, analysis, and recovery system
 * for strategy execution with automatic recovery mechanisms.
 */

import { EventEmitter } from 'events';
import { StrategyLoader } from './StrategyLoader.js';

/**
 * Error Classification
 */
export type ErrorType = 
  | 'syntax_error'
  | 'runtime_error'
  | 'logic_error'
  | 'data_error'
  | 'network_error'
  | 'memory_error'
  | 'timeout_error'
  | 'dependency_error'
  | 'validation_error'
  | 'unknown_error';

/**
 * Error Severity Levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Recovery Action Types
 */
export type RecoveryAction = 
  | 'retry'
  | 'reload_strategy'
  | 'rollback_version'
  | 'restart_engine'
  | 'disable_strategy'
  | 'manual_intervention'
  | 'ignore';

/**
 * Error Context Information
 */
export interface ErrorContext {
  strategyId: string;
  strategyName: string;
  executionId?: string;
  operation: string;
  timestamp: Date;
  stackTrace?: string;
  environment: {
    memoryUsage: number;
    cpuUsage: number;
    activeStrategies: number;
    systemLoad: number;
  };
  marketConditions?: {
    symbol: string;
    price: number;
    volatility: number;
    volume: number;
  };
  additionalData?: Record<string, any>;
}

/**
 * Enhanced Runtime Error
 */
export interface RuntimeError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  error: Error;
  context: ErrorContext;
  frequency: number; // How many times this error occurred
  firstOccurrence: Date;
  lastOccurrence: Date;
  classification: {
    category: string;
    pattern: string;
    root_cause?: string;
    user_impact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  };
  recovery?: {
    attempted: boolean;
    successful: boolean;
    action: RecoveryAction;
    timestamp: Date;
    details: string;
  };
}

/**
 * Error Pattern Detection
 */
export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | ((error: RuntimeError) => boolean);
  threshold: {
    count: number;
    timeWindow: number; // milliseconds
  };
  severity: ErrorSeverity;
  suggestedRecovery: RecoveryAction[];
  autoRecover: boolean;
}

/**
 * Recovery Strategy
 */
export interface RecoveryStrategy {
  action: RecoveryAction;
  condition: (error: RuntimeError, history: RuntimeError[]) => boolean;
  execute: (error: RuntimeError, context: any) => Promise<boolean>;
  maxAttempts: number;
  cooldownPeriod: number; // milliseconds
  successRate: number; // 0-1, updated based on historical success
}

/**
 * Monitor Configuration
 */
export interface MonitorConfig {
  enabled: boolean;
  maxErrorHistory: number;
  errorRetention: number; // days
  patternDetectionWindow: number; // milliseconds
  autoRecoveryEnabled: boolean;
  maxRecoveryAttempts: number;
  recoveryTimeout: number; // milliseconds
  alertThresholds: {
    errorRate: number; // errors per minute
    criticalErrors: number; // count threshold
    memoryLeaks: number; // MB per hour
  };
  notificationChannels: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
}

/**
 * Error Statistics
 */
export interface ErrorStatistics {
  total: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byStrategy: Record<string, number>;
  patterns: Array<{
    pattern: string;
    count: number;
    frequency: number;
  }>;
  recovery: {
    attempts: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  trends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

/**
 * Runtime Error Monitor Class
 */
export class RuntimeErrorMonitor extends EventEmitter {
  private config: MonitorConfig;
  private errors: Map<string, RuntimeError> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private recoveryStrategies: Map<RecoveryAction, RecoveryStrategy> = new Map();
  private strategyLoader?: StrategyLoader;
  private monitoringInterval?: NodeJS.Timeout;
  private statistics: ErrorStatistics;
  private lastCleanup = Date.now();

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      maxErrorHistory: 1000,
      errorRetention: 7, // days
      patternDetectionWindow: 3600000, // 1 hour
      autoRecoveryEnabled: true,
      maxRecoveryAttempts: 3,
      recoveryTimeout: 30000, // 30 seconds
      alertThresholds: {
        errorRate: 10, // 10 errors per minute
        criticalErrors: 5,
        memoryLeaks: 50 // 50MB per hour
      },
      notificationChannels: {},
      ...config
    };

    this.statistics = this.initializeStatistics();
    this.initializeErrorPatterns();
    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize the error monitor
   */
  async initialize(strategyLoader?: StrategyLoader): Promise<void> {
    if (!this.config.enabled) return;

    this.strategyLoader = strategyLoader;
    
    // Start monitoring interval
    this.startMonitoring();
    
    // Setup process error handlers
    this.setupGlobalErrorHandlers();
    
    this.emit('monitor_initialized');
  }

  /**
   * Record a runtime error
   */
  recordError(
    error: Error,
    context: ErrorContext,
    type?: ErrorType,
    severity?: ErrorSeverity
  ): string {
    const errorId = this.generateErrorId(error, context);
    const classifiedType = type || this.classifyError(error);
    const classifiedSeverity = severity || this.assessSeverity(error, classifiedType);
    
    // Check if this is a recurring error
    const existingError = this.errors.get(errorId);
    
    if (existingError) {
      // Update existing error
      existingError.frequency++;
      existingError.lastOccurrence = new Date();
      this.emit('error_recurrence', existingError);
    } else {
      // Create new error record
      const runtimeError: RuntimeError = {
        id: errorId,
        type: classifiedType,
        severity: classifiedSeverity,
        message: error.message,
        error,
        context,
        frequency: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        classification: {
          category: this.categorizeError(error, classifiedType),
          pattern: this.identifyPattern(error, classifiedType),
          user_impact: this.assessUserImpact(classifiedSeverity, context)
        }
      };

      this.errors.set(errorId, runtimeError);
      this.updateStatistics(runtimeError);
      this.emit('error_recorded', runtimeError);
    }

    // Check for error patterns and trigger recovery if needed
    const currentError = this.errors.get(errorId)!;
    this.analyzePatterns(currentError);
    
    if (this.config.autoRecoveryEnabled) {
      this.attemptRecovery(currentError);
    }

    return errorId;
  }

  /**
   * Analyze error patterns and detect anomalies
   */
  analyzePatterns(error: RuntimeError): void {
    const recentErrors = this.getRecentErrors(this.config.patternDetectionWindow);
    
    for (const pattern of this.errorPatterns.values()) {
      const matchingErrors = recentErrors.filter(e => this.matchesPattern(e, pattern));
      
      if (matchingErrors.length >= pattern.threshold.count) {
        this.emit('pattern_detected', {
          pattern: pattern.name,
          errors: matchingErrors,
          severity: pattern.severity,
          suggestedRecovery: pattern.suggestedRecovery
        });

        if (pattern.autoRecover && this.config.autoRecoveryEnabled) {
          for (const recovery of pattern.suggestedRecovery) {
            this.executeRecovery(recovery, error);
          }
        }
      }
    }
  }

  /**
   * Attempt automatic recovery for an error
   */
  async attemptRecovery(error: RuntimeError): Promise<boolean> {
    if (error.recovery && error.recovery.attempted) {
      // Already attempted recovery for this error
      return false;
    }

    // Find appropriate recovery strategy
    const strategy = this.selectRecoveryStrategy(error);
    if (!strategy) return false;

    try {
      this.emit('recovery_attempt_started', { error, strategy: strategy.action });

      const success = await Promise.race([
        strategy.execute(error, { strategyLoader: this.strategyLoader }),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Recovery timeout')), this.config.recoveryTimeout)
        )
      ]);

      error.recovery = {
        attempted: true,
        successful: success,
        action: strategy.action,
        timestamp: new Date(),
        details: success ? 'Recovery completed successfully' : 'Recovery failed'
      };

      // Update strategy success rate
      strategy.successRate = (strategy.successRate * 0.9) + (success ? 0.1 : 0);

      this.emit('recovery_attempt_completed', { error, success });
      this.updateStatistics(error);

      return success;

    } catch (recoveryError) {
      error.recovery = {
        attempted: true,
        successful: false,
        action: strategy.action,
        timestamp: new Date(),
        details: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`
      };

      this.emit('recovery_attempt_failed', { error, recoveryError });
      return false;
    }
  }

  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    return { ...this.statistics };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(timeWindow: number = 3600000): RuntimeError[] {
    const cutoff = Date.now() - timeWindow;
    return Array.from(this.errors.values())
      .filter(error => error.lastOccurrence.getTime() > cutoff)
      .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());
  }

  /**
   * Get errors by strategy
   */
  getErrorsByStrategy(strategyId: string): RuntimeError[] {
    return Array.from(this.errors.values())
      .filter(error => error.context.strategyId === strategyId);
  }

  /**
   * Clear errors for a strategy
   */
  clearStrategyErrors(strategyId: string): void {
    const strategyErrors = Array.from(this.errors.entries())
      .filter(([_, error]) => error.context.strategyId === strategyId);
    
    for (const [errorId] of strategyErrors) {
      this.errors.delete(errorId);
    }

    this.emit('strategy_errors_cleared', { strategyId });
  }

  /**
   * Shutdown the monitor
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.removeGlobalErrorHandlers();
    this.emit('monitor_shutdown');
  }

  // === PRIVATE METHODS ===

  private initializeStatistics(): ErrorStatistics {
    return {
      total: 0,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byStrategy: {},
      patterns: [],
      recovery: {
        attempts: 0,
        successful: 0,
        failed: 0,
        successRate: 0
      },
      trends: {
        hourly: new Array(24).fill(0),
        daily: new Array(7).fill(0),
        weekly: new Array(52).fill(0)
      }
    };
  }

  private initializeErrorPatterns(): void {
    // Memory leak pattern
    this.errorPatterns.set('memory_leak', {
      id: 'memory_leak',
      name: 'Memory Leak Detection',
      description: 'Detects potential memory leaks in strategy execution',
      pattern: (error) => error.type === 'memory_error' || error.message.includes('memory'),
      threshold: { count: 3, timeWindow: 300000 }, // 3 errors in 5 minutes
      severity: 'high',
      suggestedRecovery: ['reload_strategy', 'restart_engine'],
      autoRecover: true
    });

    // Frequent syntax errors
    this.errorPatterns.set('syntax_errors', {
      id: 'syntax_errors',
      name: 'Frequent Syntax Errors',
      description: 'Detects strategies with frequent syntax errors',
      pattern: (error) => error.type === 'syntax_error',
      threshold: { count: 2, timeWindow: 60000 }, // 2 errors in 1 minute
      severity: 'medium',
      suggestedRecovery: ['disable_strategy', 'rollback_version'],
      autoRecover: true
    });

    // Data quality issues
    this.errorPatterns.set('data_quality', {
      id: 'data_quality',
      name: 'Data Quality Issues',
      description: 'Detects data-related errors that might indicate feed problems',
      pattern: (error) => error.type === 'data_error' || error.message.includes('NaN') || error.message.includes('undefined'),
      threshold: { count: 5, timeWindow: 600000 }, // 5 errors in 10 minutes
      severity: 'medium',
      suggestedRecovery: ['retry', 'manual_intervention'],
      autoRecover: false
    });

    // Network connectivity issues
    this.errorPatterns.set('network_issues', {
      id: 'network_issues',
      name: 'Network Connectivity Issues',
      description: 'Detects network-related errors',
      pattern: (error) => error.type === 'network_error' || error.message.includes('ECONNRESET') || error.message.includes('timeout'),
      threshold: { count: 3, timeWindow: 180000 }, // 3 errors in 3 minutes
      severity: 'high',
      suggestedRecovery: ['retry', 'restart_engine'],
      autoRecover: true
    });
  }

  private initializeRecoveryStrategies(): void {
    // Retry strategy
    this.recoveryStrategies.set('retry', {
      action: 'retry',
      condition: (error) => error.type === 'network_error' || error.type === 'timeout_error',
      execute: async (error) => {
        // Simple retry logic - would be more sophisticated in production
        await new Promise(resolve => setTimeout(resolve, 1000));
        return Math.random() > 0.3; // 70% success rate simulation
      },
      maxAttempts: 3,
      cooldownPeriod: 5000,
      successRate: 0.7
    });

    // Reload strategy
    this.recoveryStrategies.set('reload_strategy', {
      action: 'reload_strategy',
      condition: (error) => error.frequency >= 3 && error.type !== 'syntax_error',
      execute: async (error, context) => {
        if (context.strategyLoader) {
          try {
            const result = await context.strategyLoader.reloadStrategy(error.context.strategyId, true);
            return result.success;
          } catch (e) {
            return false;
          }
        }
        return false;
      },
      maxAttempts: 2,
      cooldownPeriod: 30000,
      successRate: 0.8
    });

    // Rollback version
    this.recoveryStrategies.set('rollback_version', {
      action: 'rollback_version',
      condition: (error) => error.type === 'syntax_error' || error.severity === 'critical',
      execute: async (error, context) => {
        if (context.strategyLoader) {
          try {
            await context.strategyLoader.rollbackStrategy(error.context.strategyId, 'error_recovery');
            return true;
          } catch (e) {
            return false;
          }
        }
        return false;
      },
      maxAttempts: 1,
      cooldownPeriod: 60000,
      successRate: 0.9
    });

    // Disable strategy
    this.recoveryStrategies.set('disable_strategy', {
      action: 'disable_strategy',
      condition: (error, history) => {
        const recentErrors = history.filter(e => 
          e.context.strategyId === error.context.strategyId &&
          Date.now() - e.lastOccurrence.getTime() < 300000 // 5 minutes
        );
        return recentErrors.length >= 5;
      },
      execute: async (error, context) => {
        // Would integrate with strategy engine to disable strategy
        this.emit('strategy_disabled', { strategyId: error.context.strategyId, reason: 'too_many_errors' });
        return true;
      },
      maxAttempts: 1,
      cooldownPeriod: 0,
      successRate: 1.0
    });
  }

  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('syntax') || message.includes('unexpected token')) return 'syntax_error';
    if (message.includes('network') || message.includes('econnreset')) return 'network_error';
    if (message.includes('timeout') || message.includes('timed out')) return 'timeout_error';
    if (message.includes('memory') || message.includes('heap')) return 'memory_error';
    if (message.includes('validation') || message.includes('invalid')) return 'validation_error';
    if (message.includes('nan') || message.includes('undefined') || message.includes('null')) return 'data_error';
    if (stack.includes('node_modules') && !stack.includes('strategy')) return 'dependency_error';
    if (error.name === 'TypeError' || error.name === 'ReferenceError') return 'logic_error';

    return 'runtime_error';
  }

  private assessSeverity(error: Error, type: ErrorType): ErrorSeverity {
    // Critical errors that stop execution
    if (type === 'syntax_error' || type === 'memory_error') return 'critical';
    
    // High severity for business logic issues
    if (type === 'logic_error' || type === 'validation_error') return 'high';
    
    // Medium severity for recoverable issues
    if (type === 'network_error' || type === 'timeout_error') return 'medium';
    
    return 'low';
  }

  private categorizeError(error: Error, type: ErrorType): string {
    const categories = {
      'syntax_error': 'Code Quality',
      'runtime_error': 'Execution',
      'logic_error': 'Business Logic',
      'data_error': 'Data Quality',
      'network_error': 'Infrastructure',
      'memory_error': 'Performance',
      'timeout_error': 'Performance',
      'dependency_error': 'Dependencies',
      'validation_error': 'Configuration',
      'unknown_error': 'Other'
    };
    
    return categories[type] || 'Other';
  }

  private identifyPattern(error: Error, type: ErrorType): string {
    // Simple pattern identification
    if (error.message.includes('Cannot read property')) return 'null_reference';
    if (error.message.includes('is not a function')) return 'undefined_function';
    if (error.message.includes('Maximum call stack')) return 'infinite_recursion';
    if (error.message.includes('out of memory')) return 'memory_exhaustion';
    
    return type;
  }

  private assessUserImpact(severity: ErrorSeverity, context: ErrorContext): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const impactMap = {
      'low': 'none',
      'medium': 'low',
      'high': 'medium',
      'critical': 'critical'
    } as const;
    
    return impactMap[severity];
  }

  private generateErrorId(error: Error, context: ErrorContext): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${context.strategyId}:${error.name}:${error.message}:${context.operation}`)
      .digest('hex')
      .substring(0, 8);
    
    return `error_${hash}`;
  }

  private matchesPattern(error: RuntimeError, pattern: ErrorPattern): boolean {
    if (typeof pattern.pattern === 'function') {
      return pattern.pattern(error);
    } else {
      return pattern.pattern.test(error.message) || pattern.pattern.test(error.error.stack || '');
    }
  }

  private selectRecoveryStrategy(error: RuntimeError): RecoveryStrategy | undefined {
    const recentErrors = this.getRecentErrors(600000); // 10 minutes
    
    for (const strategy of this.recoveryStrategies.values()) {
      if (strategy.condition(error, recentErrors)) {
        return strategy;
      }
    }
    
    return undefined;
  }

  private async executeRecovery(action: RecoveryAction, error: RuntimeError): Promise<void> {
    const strategy = this.recoveryStrategies.get(action);
    if (strategy) {
      await this.attemptRecovery(error);
    }
  }

  private updateStatistics(error: RuntimeError): void {
    this.statistics.total++;
    this.statistics.byType[error.type] = (this.statistics.byType[error.type] || 0) + 1;
    this.statistics.bySeverity[error.severity] = (this.statistics.bySeverity[error.severity] || 0) + 1;
    this.statistics.byStrategy[error.context.strategyId] = (this.statistics.byStrategy[error.context.strategyId] || 0) + 1;

    if (error.recovery?.attempted) {
      this.statistics.recovery.attempts++;
      if (error.recovery.successful) {
        this.statistics.recovery.successful++;
      } else {
        this.statistics.recovery.failed++;
      }
      this.statistics.recovery.successRate = this.statistics.recovery.successful / this.statistics.recovery.attempts;
    }

    // Update trends
    const now = new Date();
    this.statistics.trends.hourly[now.getHours()]++;
    this.statistics.trends.daily[now.getDay()]++;
    this.statistics.trends.weekly[Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000)) % 52]++;
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performMaintenanceTasks();
    }, 60000); // Run every minute
  }

  private performMaintenanceTasks(): void {
    const now = Date.now();
    
    // Cleanup old errors
    if (now - this.lastCleanup > 3600000) { // Every hour
      this.cleanupOldErrors();
      this.lastCleanup = now;
    }
    
    // Check alert thresholds
    this.checkAlertThresholds();
  }

  private cleanupOldErrors(): void {
    const cutoff = Date.now() - (this.config.errorRetention * 24 * 60 * 60 * 1000);
    const errorIds = Array.from(this.errors.keys());
    
    for (const errorId of errorIds) {
      const error = this.errors.get(errorId);
      if (error && error.firstOccurrence.getTime() < cutoff) {
        this.errors.delete(errorId);
      }
    }
    
    // Keep only recent errors in memory
    if (this.errors.size > this.config.maxErrorHistory) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort((a, b) => b[1].lastOccurrence.getTime() - a[1].lastOccurrence.getTime());
      
      const excessCount = this.errors.size - this.config.maxErrorHistory;
      for (let i = 0; i < excessCount; i++) {
        this.errors.delete(sortedErrors[sortedErrors.length - 1 - i][0]);
      }
    }
  }

  private checkAlertThresholds(): void {
    const recentErrors = this.getRecentErrors(60000); // Last minute
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
    
    if (recentErrors.length > this.config.alertThresholds.errorRate) {
      this.emit('alert', {
        type: 'high_error_rate',
        message: `High error rate detected: ${recentErrors.length} errors in the last minute`,
        severity: 'warning'
      });
    }
    
    if (criticalErrors.length >= this.config.alertThresholds.criticalErrors) {
      this.emit('alert', {
        type: 'critical_errors',
        message: `Multiple critical errors detected: ${criticalErrors.length}`,
        severity: 'critical'
      });
    }
  }

  private setupGlobalErrorHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.recordError(error, {
        strategyId: 'system',
        strategyName: 'System',
        operation: 'uncaught_exception',
        timestamp: new Date(),
        environment: {
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: process.cpuUsage().user / 1000000,
          activeStrategies: 0,
          systemLoad: 0
        }
      }, 'runtime_error', 'critical');
    });

    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.recordError(error, {
        strategyId: 'system',
        strategyName: 'System',
        operation: 'unhandled_rejection',
        timestamp: new Date(),
        environment: {
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: process.cpuUsage().user / 1000000,
          activeStrategies: 0,
          systemLoad: 0
        }
      }, 'runtime_error', 'high');
    });
  }

  private removeGlobalErrorHandlers(): void {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  }
}

export default RuntimeErrorMonitor;