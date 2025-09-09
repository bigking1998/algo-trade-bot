/**
 * Strategies Module Index - Task BE-007: Base Strategy Interface Design
 * 
 * Main export file for the trading strategy framework.
 * Provides unified access to all strategy components, types, and utilities.
 */

// Core strategy framework
export { BaseStrategy } from './BaseStrategy.js';
import { BaseStrategy } from './BaseStrategy.js';
export type { 
  RiskManager,
  TechnicalIndicatorCalculator,
  PortfolioManager,
  OrderManager
} from './BaseStrategy.js';

// Strategy factory and management
export { StrategyFactory, createStrategyFactory, createStrategy } from './StrategyFactory.js';
import { StrategyFactory } from './StrategyFactory.js';
export { StrategyManager } from './StrategyManager.js';
export { StrategyEngine } from './StrategyEngine.js';
import { StrategyEngine } from './StrategyEngine.js';
export { StrategyContextFactory } from './StrategyContext.js';
export type { StrategyType } from './StrategyFactory.js';
export type { StrategyExecution, StrategyManagerConfig } from './StrategyManager.js';
export type { 
  StrategyEngineConfig,
  EngineExecutionContext,
  EnginePerformanceMetrics,
  EngineExecutionResult
} from './StrategyEngine.js';

// Data frame classes - Task BE-007 deliverables
export { MarketDataFrame, IndicatorDataFrame, SignalDataFrame } from './DataStructures.js';
import { MarketDataFrame, IndicatorDataFrame, SignalDataFrame } from './DataStructures.js';

// Type definitions
export type {
  // Core types
  StrategyConfig,
  StrategyContext,
  StrategySignal,
  StrategySignalType,
  StrategyMetrics,
  StrategyParameter,
  StrategyExecutionOptions,
  
  // Market data and indicators
  MarketDataWindow,
  IndicatorValues,
  RiskAssessment,
  
  // Lifecycle and events
  StrategyLifecycleEvent,
  StrategyHealthCheck,
  
  // Position management
  Position,
  
  // Error types
  StrategyError,
  StrategyValidationError,
  StrategyExecutionError,
  StrategyTimeoutError
} from './types.js';

// Example strategy implementations
export { SimpleMovingAverageCrossStrategy } from './examples/SimpleMovingAverageCrossStrategy.js';

// Strategy execution state
export type { StrategyState } from './BaseStrategy.js';

/**
 * Default strategy factory instance for convenience
 */
export const strategyFactory = StrategyFactory.getInstance();

/**
 * Utility functions for strategy management
 */

/**
 * Create a simple moving average cross strategy with default configuration
 */
export const createSMAStrategy = (overrides: Partial<import('./types.js').StrategyConfig> = {}) => {
  return strategyFactory.createDefaultStrategy('sma_cross', overrides);
};

/**
 * Get available strategy types for UI selection
 */
export const getAvailableStrategies = () => {
  return strategyFactory.getAllStrategyInfo();
};

/**
 * Validate strategy configuration
 */
export const validateStrategyConfig = (config: import('./types.js').StrategyConfig): string[] => {
  const errors: string[] = [];
  
  // Basic validation
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Strategy name is required');
  }
  
  if (!config.symbols || config.symbols.length === 0) {
    errors.push('At least one symbol must be specified');
  }
  
  if (!config.timeframes || config.timeframes.length === 0) {
    errors.push('At least one timeframe must be specified');
  }
  
  if (!config.riskProfile) {
    errors.push('Risk profile is required');
  } else {
    if (config.riskProfile.maxRiskPerTrade <= 0 || config.riskProfile.maxRiskPerTrade > 100) {
      errors.push('Maximum risk per trade must be between 0 and 100 percent');
    }
    
    if (config.riskProfile.maxPortfolioRisk <= 0 || config.riskProfile.maxPortfolioRisk > 100) {
      errors.push('Maximum portfolio risk must be between 0 and 100 percent');
    }
  }
  
  return errors;
};

/**
 * Create strategy configuration template
 */
export const createStrategyConfigTemplate = (
  type: import('./StrategyFactory.js').StrategyType,
  overrides: Partial<import('./types.js').StrategyConfig> = {}
): import('./types.js').StrategyConfig => {
  return strategyFactory.createDefaultStrategy(type, overrides).getConfig();
};

/**
 * Strategy performance calculator utility
 */
export class StrategyPerformanceCalculator {
  /**
   * Calculate Sharpe ratio from returns array
   */
  static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    const standardDeviation = Math.sqrt(variance);
    
    if (standardDeviation === 0) return 0;
    
    return (meanReturn - riskFreeRate) / standardDeviation;
  }
  
  /**
   * Calculate maximum drawdown from equity curve
   */
  static calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length === 0) return 0;
    
    let maxDrawdown = 0;
    let peak = equityCurve[0];
    
    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return maxDrawdown;
  }
  
  /**
   * Calculate win rate from trade results
   */
  static calculateWinRate(trades: { pnl: number }[]): number {
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(trade => trade.pnl > 0).length;
    return winningTrades / trades.length;
  }
  
  /**
   * Calculate profit factor (gross profit / gross loss)
   */
  static calculateProfitFactor(trades: { pnl: number }[]): number {
    const grossProfit = trades
      .filter(trade => trade.pnl > 0)
      .reduce((sum, trade) => sum + trade.pnl, 0);
      
    const grossLoss = Math.abs(trades
      .filter(trade => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0));
    
    return grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  }
}

/**
 * Strategy validation utilities
 */
export class StrategyValidator {
  /**
   * Validate signal before execution
   */
  static validateSignal(signal: import('./types.js').StrategySignal): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!signal.id) errors.push('Signal ID is required');
    if (!signal.strategyId) errors.push('Strategy ID is required');
    if (!signal.symbol) errors.push('Symbol is required');
    if (!signal.type) errors.push('Signal type is required');
    if (signal.confidence < 0 || signal.confidence > 100) {
      errors.push('Confidence must be between 0 and 100');
    }
    if (signal.strength < 0 || signal.strength > 1) {
      errors.push('Signal strength must be between 0 and 1');
    }
    
    if (signal.entryPrice && signal.entryPrice <= 0) {
      errors.push('Entry price must be positive');
    }
    
    if (signal.stopLoss && signal.entryPrice) {
      const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
      const maxStopDistance = signal.entryPrice * 0.2; // 20% maximum
      if (stopDistance > maxStopDistance) {
        errors.push('Stop loss distance is too large (>20% of entry price)');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate risk management parameters
   */
  static validateRiskProfile(riskProfile: import('./types.js').StrategyConfig['riskProfile']): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (riskProfile.maxRiskPerTrade <= 0 || riskProfile.maxRiskPerTrade > 50) {
      errors.push('Max risk per trade must be between 0 and 50 percent');
    }
    
    if (riskProfile.maxPortfolioRisk <= 0 || riskProfile.maxPortfolioRisk > 100) {
      errors.push('Max portfolio risk must be between 0 and 100 percent');
    }
    
    if (riskProfile.maxRiskPerTrade > riskProfile.maxPortfolioRisk) {
      errors.push('Max risk per trade cannot exceed max portfolio risk');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Default export for main strategy functionality
 */
export default {
  BaseStrategy,
  StrategyFactory: StrategyFactory,
  StrategyEngine,
  strategyFactory,
  MarketDataFrame,
  IndicatorDataFrame, 
  SignalDataFrame,
  createSMAStrategy,
  getAvailableStrategies,
  validateStrategyConfig,
  createStrategyConfigTemplate,
  StrategyPerformanceCalculator,
  StrategyValidator
};