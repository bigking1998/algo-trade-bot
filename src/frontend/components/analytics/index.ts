/**
 * Performance Analytics Components Export
 * 
 * Centralized export for all performance analytics components
 * to enable easy importing across the application.
 */

export { default as PerformanceOverview } from './PerformanceOverview';
export { default as StrategyComparison } from './StrategyComparison';
export { default as DrawdownChart } from './DrawdownChart';
export { default as RiskMetrics } from './RiskMetrics';
export { default as PerformanceAnalyticsDashboard } from './PerformanceAnalyticsDashboard';

// Re-export hook for convenience
export { usePerformanceData, usePerformanceAlerts, usePerformanceReports } from '../../hooks/usePerformanceData';

// Export types for external use
export type {
  PerformanceMetrics,
  StrategyPerformance,
  DrawdownMetrics,
  PerformanceBenchmark,
  PerformanceExportData
} from '../../hooks/usePerformanceData';