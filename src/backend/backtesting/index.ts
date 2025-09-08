/**
 * Backtesting Module Index - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Central export point for all backtesting components
 */

// Core backtesting engine
export { default as BacktestEngine } from './BacktestEngine';

// Portfolio simulation
export { default as PortfolioSimulator } from './PortfolioSimulator';

// Execution simulation
export { default as ExecutionSimulator } from './ExecutionSimulator';

// Performance calculation
export { default as PerformanceCalculator } from './PerformanceCalculator';

// Risk analysis
export { default as RiskAnalyzer } from './RiskAnalyzer';

// Historical data providers
export {
  DydxHistoricalDataProvider,
  CsvHistoricalDataProvider,
  MockHistoricalDataProvider,
  DefaultHistoricalDataProvider
} from './HistoricalDataProvider';

// Types and interfaces
export * from './types';

// API routes
export { handleBacktestingRoute } from '../routes/backtesting';