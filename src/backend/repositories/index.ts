/**
 * Repository Module Exports - Task BE-002
 * Centralized exports for all repository classes and types
 */

// Base repository
export { BaseRepository } from './BaseRepository';
export type { RepositoryResult, QueryBuilder } from './BaseRepository';

// Specific repositories - Task BE-003, BE-004, BE-005
export { StrategyRepository } from './StrategyRepository';
export { TradeRepository } from './TradeRepository';
export type { 
  TradeQueryFilters, 
  PortfolioMetrics, 
  PositionSummary, 
  TradeClosureResult 
} from './TradeRepository';

// Market Data Repository - Task BE-005
export { MarketDataRepository } from './MarketDataRepository';
export type {
  MarketDataFilters,
  BulkInsertOptions,
  MarketDataAggregation,
  VolatilityMetrics,
  DataGap,
  CorrelationResult
} from './MarketDataRepository';

// Database entity types
export * from '../types/database';

// Re-export commonly used types from database manager
export type { 
  QueryResult, 
  CacheOptions, 
  TransactionCallback 
} from '../database/DatabaseManager';

/**
 * Repository factory function for creating type-safe repositories
 * This will be extended in future tasks (BE-003, BE-004, BE-005)
 */
export class RepositoryFactory {
  private static repositories: Map<string, any> = new Map();

  /**
   * Get or create repository instance
   * This is a placeholder that will be extended with specific repository classes
   */
  static getRepository<T>(repositoryType: string): T {
    if (!this.repositories.has(repositoryType)) {
      throw new Error(`Repository type '${repositoryType}' not registered. Available in BE-003+`);
    }
    return this.repositories.get(repositoryType) as T;
  }

  /**
   * Register repository implementation
   * This will be used by specific repositories in future tasks
   */
  static registerRepository(type: string, repository: any): void {
    this.repositories.set(type, repository);
  }
}

/**
 * Repository constants
 */
export const REPOSITORY_CONSTANTS = {
  DEFAULT_CACHE_TTL: 300, // 5 minutes
  MAX_QUERY_RESULTS: 1000,
  DEFAULT_PAGE_SIZE: 50,
  TRANSACTION_TIMEOUT: 30000, // 30 seconds
} as const;

/**
 * Common query patterns that can be reused across repositories
 */
export const COMMON_QUERIES = {
  SOFT_DELETE_FILTER: '(is_deleted = FALSE OR is_deleted IS NULL)',
  DEFAULT_ORDER: 'created_at DESC',
  ACTIVE_STATUS_FILTER: "status = 'active'",
} as const;