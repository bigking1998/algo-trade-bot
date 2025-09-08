/**
 * Execution Module - Task BE-020 (Enhanced)
 * 
 * Main export file for the strategy execution engine system.
 * Provides a unified interface for all execution-related components.
 */

export { 
  StrategyExecutionEngine,
  type ExecutionMode,
  type ExecutionPriority,
  type ExecutionStatus,
  type ExecutionRequest,
  type ExecutionResult,
  type ExecutionEngineConfig,
  type ExecutionEngineMetrics
} from './StrategyExecutionEngine.js';

export {
  ExecutionOrchestrator,
  type ExecutionPlan,
  type OrchestrationResult
} from './ExecutionOrchestrator.js';

export {
  OrderExecutor,
  type Order,
  type OrderStatus,
  type OrderType,
  type OrderSide,
  type TimeInForce,
  type OrderExecutionResult,
  type OrderExecutorConfig,
  type Fill
} from './OrderExecutor.js';

// Re-export common types
export type {
  StrategySignal,
  Position,
  MarketDataWindow
} from '../strategies/types.js';

export type {
  TradeDecision
} from '../engine/StrategyEngine.js';

export type {
  ProtectionDecision
} from '../engine/ProtectionMechanisms.js';