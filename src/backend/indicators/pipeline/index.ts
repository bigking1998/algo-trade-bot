/**
 * Indicator Pipeline System - Task BE-012
 * 
 * Comprehensive indicator pipeline system for batch processing, dependency resolution,
 * caching mechanisms, and lazy evaluation optimization. Provides enterprise-grade
 * performance and scalability for real-time trading operations.
 * 
 * Main exports for the indicator pipeline system.
 */

// Main pipeline class
export { IndicatorPipeline } from './IndicatorPipeline.js';
export type { 
  PipelineConfiguration,
  PipelineIndicatorSpec,
  BatchProcessingRequest,
  BatchProcessingResult,
  StreamingUpdateRequest,
  PipelineStatus
} from './IndicatorPipeline.js';

// Dependency resolution
export { IndicatorDependencyResolver } from './IndicatorDependencyResolver.js';
export type {
  DependencyNode,
  DependencyValidationResult,
  ExecutionPlan,
  DependencyAnalysis
} from './IndicatorDependencyResolver.js';

// Cache management
export { CacheManager } from './CacheManager.js';
export type {
  CacheConfiguration,
  CacheEntry,
  CacheStatistics,
  CacheStatus
} from './CacheManager.js';

// Lazy evaluation
export { LazyEvaluationEngine } from './LazyEvaluationEngine.js';
export type {
  LazyEvaluationConfig,
  LazyIndicatorNode,
  EvaluationPlan,
  EvaluationResult
} from './LazyEvaluationEngine.js';

// Indicator composition
export { IndicatorComposer } from './IndicatorComposer.js';
export type {
  CompositeIndicatorSpec,
  ChainedIndicatorSpec,
  CompositionContext,
  TransformFunction
} from './IndicatorComposer.js';
export { BuiltInTransforms, BuiltInCombinations } from './IndicatorComposer.js';

// Parallel processing
export { ParallelProcessingEngine } from './ParallelProcessingEngine.js';
export type {
  ParallelProcessingConfig,
  ProcessingTask,
  ProcessingResult,
  ProcessingStats
} from './ParallelProcessingEngine.js';

// Memory management
export { MemoryManager } from './MemoryManager.js';
export type {
  MemoryConfig,
  MemoryUsage,
  MemoryStats,
  MemoryAlert
} from './MemoryManager.js';

// Metrics and monitoring
export { PipelineMetrics } from './PipelineMetrics.js';
export type {
  MetricsConfig,
  MetricEvent,
  PerformanceSnapshot,
  DetailedMetrics,
  ReportData
} from './PipelineMetrics.js';

// Default export - main pipeline class
export { IndicatorPipeline as default } from './IndicatorPipeline.js';