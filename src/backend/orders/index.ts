/**
 * Order Management System - Main Export Module
 * Task BE-021: Order Management System Implementation
 * 
 * Comprehensive order management system providing enterprise-grade
 * order lifecycle management with advanced order types, smart routing,
 * and complete compliance tracking.
 */

// Core Order Management
export {
  OrderManager,
  type ManagedOrder,
  type AdvancedOrderType,
  type OrderPriority,
  type OrderExecutionStrategy,
  type OrderManagerConfig,
  type OrderPerformanceMetrics,
  type AuditEvent,
  type ComplianceFlag
} from './OrderManager.js';

// Smart Order Routing
export {
  OrderRouter,
  type TradingVenue,
  type MarketCondition,
  type RoutingDecision,
  type OrderRouterConfig
} from './OrderRouter.js';

// Advanced Execution Engine
export {
  ExecutionEngine,
  type ExecutionEngineConfig
} from './ExecutionEngine.js';

// Order Book Management
export {
  OrderBook,
  type OrderBookState,
  type OrderBookConfig
} from './OrderBook.js';

// Trade Reporting & Compliance
export {
  TradeReportingSystem,
  type TradeReport,
  type ComplianceViolation,
  type PositionReport,
  type PerformanceReport,
  type RegulatoryReport,
  type TradeReportingConfig
} from './TradeReporting.js';

// Re-export types from execution system for compatibility
export type {
  Order,
  OrderStatus,
  OrderType,
  OrderSide,
  TimeInForce,
  OrderExecutionResult,
  Fill
} from '../execution/OrderExecutor.js';