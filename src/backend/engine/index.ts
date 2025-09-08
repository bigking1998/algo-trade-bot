/**
 * Strategy Engine System - Complete Export Index
 * 
 * Main entry point for the Strategy Engine Core (BE-016) and related components
 */

// Core Strategy Engine (BE-016)
export { StrategyEngine } from './StrategyEngine.js';
export { StrategyExecutor } from './StrategyExecutor.js';
export { SignalProcessor } from './SignalProcessor.js';
export { PerformanceMonitor } from './PerformanceMonitor.js';
export { RiskController } from './RiskController.js';
export { EventManager } from './EventManager.js';

// Additional Strategy Components (BE-017)
export { StrategyLoader } from './StrategyLoader.js';
export { StrategyValidator } from './StrategyValidator.js';
export { RuntimeErrorMonitor } from './RuntimeErrorMonitor.js';
export { HotReloadManager } from './HotReloadManager.js';

// Export types from Core Engine (BE-016)
export type {
  StrategyEngineState,
  StrategyEngineConfig,
  TradeDecision,
  StrategyResult,
  EngineMetrics
} from './StrategyEngine.js';

export type {
  StrategyExecutorConfig
} from './StrategyExecutor.js';

// Export types from BE-017
export type {
  LoadingResult,
  ValidationResult,
  RuntimeError,
  ReloadResult,
  ReloadRequest
} from './StrategyLoader.js';

export type {
  ValidationRule,
  ValidationIssue,
  FullValidationResult
} from './StrategyValidator.js';

export type {
  ErrorType,
  ErrorSeverity,
  ErrorStatistics
} from './RuntimeErrorMonitor.js';

export type {
  ReloadOperation,
  ReloadStrategy,
  ReloadState
} from './HotReloadManager.js';