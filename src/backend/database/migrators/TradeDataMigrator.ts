/**
 * Trade Data Migrator - Task BE-006: Data Migration from In-Memory Storage
 * 
 * Specialized migrator for trade data with:
 * - Integration with existing TradeHistoryService
 * - Advanced data validation and transformation
 * - Conflict resolution for duplicate trades
 * - Performance-optimized batch processing
 * - P&L recalculation and verification
 * - Trade relationships and position tracking
 */

import { EventEmitter } from 'events';
import { TradeRepository, Trade, TradeCreateData, TradeFilters } from '../repositories/TradeRepository';
import { tradeHistoryService } from '../../services/tradeHistory';
import type { 
  TradeHistoryEntry, 
  TradeStatistics,
  TradeFilters as TradeHistoryFilters 
} from '../../../shared/types/trading';

export interface TradeMigrationConfig {
  batchSize?: number;
  validatePnL?: boolean;
  recalculatePnL?: boolean;
  skipDuplicates?: boolean;
  conflictResolution?: ConflictResolution;
  includeClosed?: boolean;
  includeOpen?: boolean;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  strategyFilter?: string;
  symbolFilter?: string;
  dryRun?: boolean;
}

export interface TradeMigrationResult {
  migrationId: string;
  success: boolean;
  totalInMemoryTrades: number;
  totalProcessed: number;
  totalMigrated: number;
  totalSkipped: number;
  totalFailed: number;
  duplicatesFound: number;
  conflictsResolved: number;
  pnlRecalculated: number;
  executionTimeMs: number;
  throughputPerSecond: number;
  errors: TradeMigrationError[];
  statistics: {
    beforeMigration: TradeStatistics;
    afterMigration: TradeAnalytics;
    dataIntegrityScore: number;
  };
}

export interface TradeMigrationError {
  timestamp: Date;
  tradeId?: string;
  symbol?: string;
  errorType: string;
  message: string;
  originalTrade?: TradeHistoryEntry;
  context?: Record<string, any>;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
}

export interface TradeAnalytics {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalVolume: number;
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  avgTradeSize: number;
  symbolDistribution: Record<string, number>;
  strategyDistribution: Record<string, number>;
}

export interface ConflictResolution {
  onDuplicate: 'SKIP' | 'UPDATE' | 'CREATE_NEW';
  onPnLMismatch: 'TRUST_MEMORY' | 'RECALCULATE' | 'SKIP';
  onDataInconsistency: 'REPAIR' | 'SKIP' | 'FAIL';
}

export interface TradeValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
  dataQualityScore: number;
}

/**
 * Specialized migrator for trade data from in-memory storage to database
 */
export class TradeDataMigrator extends EventEmitter {
  private readonly tradeRepo: TradeRepository;
  private readonly defaultConfig: Required<TradeMigrationConfig>;
  
  constructor() {
    super();
    this.tradeRepo = new TradeRepository();
    
    this.defaultConfig = {
      batchSize: 500, // Smaller batches for trades to handle complex P&L calculations
      validatePnL: true,
      recalculatePnL: true,
      skipDuplicates: true,
      conflictResolution: {
        onDuplicate: 'SKIP',
        onPnLMismatch: 'RECALCULATE',
        onDataInconsistency: 'REPAIR',
      },
      includeClosed: true,
      includeOpen: true,
      dateRange: undefined,
      strategyFilter: undefined,
      symbolFilter: undefined,
      dryRun: false,
    };
  }

  /**
   * Main migration method - migrates all trade data from in-memory storage
   */
  public async migrateAllTrades(config: TradeMigrationConfig = {}): Promise<TradeMigrationResult> {
    const migrationConfig = { ...this.defaultConfig, ...config };
    const migrationId = this.generateMigrationId();
    const startTime = Date.now();

    try {
      this.emit('migration:started', { migrationId, config: migrationConfig });

      // Step 1: Get baseline statistics before migration
      const inMemoryStats = await this.getInMemoryTradeStatistics();
      
      // Step 2: Extract trade data from in-memory service
      const inMemoryTrades = await this.extractInMemoryTrades(migrationConfig);
      
      // Step 3: Validate and transform trade data
      const validatedTrades = await this.validateAndTransformTrades(
        inMemoryTrades, 
        migrationConfig
      );
      
      // Step 4: Process migration in batches
      const migrationResult = await this.processTradeBatches(
        migrationId,
        validatedTrades,
        migrationConfig
      );
      
      // Step 5: Post-migration validation and statistics
      const postMigrationStats = await this.getDatabaseTradeAnalytics();
      const dataIntegrityScore = await this.calculateDataIntegrityScore(
        inMemoryTrades,
        migrationResult
      );

      const finalResult: TradeMigrationResult = {
        migrationId,
        success: migrationResult.totalFailed === 0,
        totalInMemoryTrades: inMemoryTrades.length,
        totalProcessed: migrationResult.totalProcessed,
        totalMigrated: migrationResult.totalMigrated,
        totalSkipped: migrationResult.totalSkipped,
        totalFailed: migrationResult.totalFailed,
        duplicatesFound: migrationResult.duplicatesFound,
        conflictsResolved: migrationResult.conflictsResolved,
        pnlRecalculated: migrationResult.pnlRecalculated,
        executionTimeMs: Date.now() - startTime,
        throughputPerSecond: migrationResult.totalProcessed / ((Date.now() - startTime) / 1000),
        errors: migrationResult.errors,
        statistics: {
          beforeMigration: inMemoryStats,
          afterMigration: postMigrationStats,
          dataIntegrityScore,
        },
      };

      this.emit('migration:completed', finalResult);
      return finalResult;

    } catch (error) {
      const errorResult: TradeMigrationResult = {
        migrationId,
        success: false,
        totalInMemoryTrades: 0,
        totalProcessed: 0,
        totalMigrated: 0,
        totalSkipped: 0,
        totalFailed: 0,
        duplicatesFound: 0,
        conflictsResolved: 0,
        pnlRecalculated: 0,
        executionTimeMs: Date.now() - startTime,
        throughputPerSecond: 0,
        errors: [{
          timestamp: new Date(),
          errorType: 'MIGRATION_FAILURE',
          message: error instanceof Error ? error.message : String(error),
          severity: 'CRITICAL',
        }],
        statistics: {
          beforeMigration: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnl: 0,
            totalVolume: 0,
            avgTradeDuration: 0,
            bestTrade: 0,
            worstTrade: 0,
            profitFactor: 0,
            maxDrawdown: 0,
          },
          afterMigration: {
            totalTrades: 0,
            openTrades: 0,
            closedTrades: 0,
            totalVolume: 0,
            totalPnL: 0,
            winRate: 0,
            profitFactor: 0,
            avgTradeSize: 0,
            symbolDistribution: {},
            strategyDistribution: {},
          },
          dataIntegrityScore: 0,
        },
      };

      this.emit('migration:failed', errorResult);
      throw error;
    }
  }

  /**
   * Extract trade data from in-memory service with filtering
   */
  private async extractInMemoryTrades(config: Required<TradeMigrationConfig>): Promise<TradeHistoryEntry[]> {
    const filters: TradeHistoryFilters = {};
    
    // Apply filters based on config
    if (config.strategyFilter) {
      filters.strategy = config.strategyFilter;
    }
    
    if (config.symbolFilter) {
      filters.symbol = config.symbolFilter;
    }
    
    if (config.dateRange?.from) {
      filters.dateFrom = config.dateRange.from.toISOString();
    }
    
    if (config.dateRange?.to) {
      filters.dateTo = config.dateRange.to.toISOString();
    }
    
    // Filter by status if specified
    if (config.includeClosed && !config.includeOpen) {
      filters.status = 'closed';
    } else if (config.includeOpen && !config.includeClosed) {
      filters.status = 'open';
    }
    
    // Get all matching trades (large page size to get everything)
    const response = tradeHistoryService.getTradeHistory(filters, 1, 10000);
    
    return response.trades;
  }

  /**
   * Validate and transform trades from in-memory format to database format
   */
  private async validateAndTransformTrades(
    inMemoryTrades: TradeHistoryEntry[],
    config: Required<TradeMigrationConfig>
  ): Promise<Array<{ trade: TradeCreateData; validation: TradeValidationResult; original: TradeHistoryEntry }>> {
    const validatedTrades = [];
    
    for (const inMemoryTrade of inMemoryTrades) {
      try {
        // Validate the trade
        const validation = this.validateTrade(inMemoryTrade);
        
        // Transform to database format
        const dbTrade = await this.transformTradeToDbFormat(inMemoryTrade, config);
        
        validatedTrades.push({
          trade: dbTrade,
          validation,
          original: inMemoryTrade,
        });
        
      } catch (error) {
        // Create a failed validation entry
        validatedTrades.push({
          trade: {} as TradeCreateData, // Empty trade data
          validation: {
            isValid: false,
            warnings: [],
            errors: [error instanceof Error ? error.message : String(error)],
            suggestions: ['Check trade data format and required fields'],
            dataQualityScore: 0,
          },
          original: inMemoryTrade,
        });
      }
    }
    
    return validatedTrades;
  }

  /**
   * Validate individual trade data
   */
  private validateTrade(trade: TradeHistoryEntry): TradeValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];
    let qualityScore = 1.0;

    // Required field validation
    if (!trade.symbol) {
      errors.push('Symbol is required');
      qualityScore -= 0.3;
    }
    
    if (!trade.side) {
      errors.push('Side (BUY/SELL) is required');
      qualityScore -= 0.3;
    }
    
    if (!trade.entryPrice || trade.entryPrice <= 0) {
      errors.push('Valid entry price is required');
      qualityScore -= 0.3;
    }
    
    if (!trade.quantity || trade.quantity <= 0) {
      errors.push('Valid quantity is required');
      qualityScore -= 0.3;
    }

    // Data consistency checks
    if (trade.status === 'CLOSED') {
      if (!trade.exitPrice) {
        warnings.push('Closed trade missing exit price');
        qualityScore -= 0.1;
        suggestions.push('Consider marking as OPEN or providing exit price');
      }
      
      if (!trade.pnl && trade.exitPrice) {
        warnings.push('Closed trade missing P&L calculation');
        qualityScore -= 0.05;
        suggestions.push('P&L will be recalculated during migration');
      }
    }

    // P&L validation for closed trades
    if (trade.status === 'CLOSED' && trade.pnl !== undefined && trade.exitPrice) {
      const expectedPnL = this.calculateExpectedPnL(trade);
      const pnlDifference = Math.abs(trade.pnl - expectedPnL);
      const tolerance = Math.abs(expectedPnL * 0.01); // 1% tolerance
      
      if (pnlDifference > tolerance) {
        warnings.push(`P&L calculation appears incorrect. Expected: ${expectedPnL.toFixed(2)}, Got: ${trade.pnl.toFixed(2)}`);
        qualityScore -= 0.05;
        suggestions.push('P&L will be recalculated during migration');
      }
    }

    // Price reasonableness checks
    if (trade.entryPrice && trade.exitPrice) {
      const priceChange = Math.abs(trade.exitPrice - trade.entryPrice) / trade.entryPrice;
      if (priceChange > 0.5) { // 50% price change
        warnings.push('Unusually large price movement detected');
        qualityScore -= 0.02;
      }
    }

    // Fee validation
    if (trade.fees && trade.fees < 0) {
      warnings.push('Negative fees detected');
      qualityScore -= 0.05;
    }

    // Timestamp validation
    if (!trade.timestamp) {
      errors.push('Trade timestamp is required');
      qualityScore -= 0.2;
    } else {
      const tradeDate = new Date(trade.timestamp);
      if (tradeDate.getTime() > Date.now()) {
        warnings.push('Trade timestamp is in the future');
        qualityScore -= 0.1;
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      suggestions,
      dataQualityScore: Math.max(0, qualityScore),
    };
  }

  /**
   * Transform in-memory trade to database format
   */
  private async transformTradeToDbFormat(
    trade: TradeHistoryEntry,
    config: Required<TradeMigrationConfig>
  ): Promise<TradeCreateData> {
    const dbTrade: TradeCreateData = {
      symbol: trade.symbol,
      side: trade.side.toLowerCase() as 'buy' | 'sell',
      quantity: Number(trade.quantity),
      price: Number(trade.entryPrice),
      fee: Number(trade.fees) || 0,
      entry_price: Number(trade.entryPrice),
      exchange: 'dydx_v4', // Default exchange
    };

    // Add optional fields if present
    if (trade.exitPrice) {
      dbTrade.exit_price = Number(trade.exitPrice);
    }

    if (trade.strategy) {
      // Try to find matching strategy ID in database
      const strategy = await this.tradeRepo.findStrategyByName(trade.strategy);
      if (strategy) {
        dbTrade.strategy_id = strategy.id;
      }
    }

    // Calculate or validate P&L if needed
    if (config.recalculatePnL && trade.exitPrice) {
      const calculatedPnL = this.calculateExpectedPnL(trade);
      // The TradeRepository will handle P&L calculation, but we can provide hints
      dbTrade.market_conditions = {
        original_pnl: trade.pnl,
        calculated_pnl: calculatedPnL,
        recalculated: true,
      };
    }

    return dbTrade;
  }

  /**
   * Process trades in batches with comprehensive error handling
   */
  private async processTradeBatches(
    migrationId: string,
    validatedTrades: Array<{ trade: TradeCreateData; validation: TradeValidationResult; original: TradeHistoryEntry }>,
    config: Required<TradeMigrationConfig>
  ): Promise<{
    totalProcessed: number;
    totalMigrated: number;
    totalSkipped: number;
    totalFailed: number;
    duplicatesFound: number;
    conflictsResolved: number;
    pnlRecalculated: number;
    errors: TradeMigrationError[];
  }> {
    const result = {
      totalProcessed: 0,
      totalMigrated: 0,
      totalSkipped: 0,
      totalFailed: 0,
      duplicatesFound: 0,
      conflictsResolved: 0,
      pnlRecalculated: 0,
      errors: [] as TradeMigrationError[],
    };

    // Process in batches
    const batches = this.createBatches(validatedTrades, config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      this.emit('batch:started', {
        migrationId,
        batchIndex: i,
        batchSize: batch.length,
        totalBatches: batches.length,
      });

      for (const { trade, validation, original } of batch) {
        try {
          result.totalProcessed++;
          
          // Skip invalid trades unless we can repair them
          if (!validation.isValid) {
            if (config.conflictResolution.onDataInconsistency === 'SKIP') {
              result.totalSkipped++;
              result.errors.push({
                timestamp: new Date(),
                tradeId: original.id,
                symbol: original.symbol,
                errorType: 'VALIDATION_FAILED',
                message: validation.errors.join('; '),
                originalTrade: original,
                severity: 'WARNING',
              });
              continue;
            }
            // TODO: Implement repair logic for REPAIR option
          }

          if (config.dryRun) {
            result.totalMigrated++; // Count as migrated in dry run
            continue;
          }

          // Check for duplicates
          if (config.skipDuplicates) {
            const existingTrade = await this.findDuplicateTrade(trade);
            if (existingTrade) {
              result.duplicatesFound++;
              
              if (config.conflictResolution.onDuplicate === 'SKIP') {
                result.totalSkipped++;
                continue;
              } else if (config.conflictResolution.onDuplicate === 'UPDATE') {
                // Update existing trade
                await this.updateExistingTrade(existingTrade, trade, original);
                result.conflictsResolved++;
                result.totalMigrated++;
                continue;
              }
              // CREATE_NEW will fall through to create
            }
          }

          // Create new trade
          const createdTrade = await this.tradeRepo.createTrade(trade);
          result.totalMigrated++;
          
          // Track P&L recalculations
          if (config.recalculatePnL && trade.exit_price) {
            result.pnlRecalculated++;
          }

        } catch (error) {
          result.totalFailed++;
          result.errors.push({
            timestamp: new Date(),
            tradeId: original.id,
            symbol: original.symbol,
            errorType: 'MIGRATION_ERROR',
            message: error instanceof Error ? error.message : String(error),
            originalTrade: original,
            context: { trade },
            severity: 'ERROR',
          });
        }
      }

      this.emit('batch:completed', {
        migrationId,
        batchIndex: i,
        processed: result.totalProcessed,
        migrated: result.totalMigrated,
        failed: result.totalFailed,
      });
    }

    return result;
  }

  /**
   * Find potential duplicate trades in database
   */
  private async findDuplicateTrade(trade: TradeCreateData): Promise<Trade | null> {
    // Look for trades with same symbol, side, quantity, price, and timestamp within 1 second
    const results = await this.tradeRepo.findBy({
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
    }, { limit: 10 });

    // Additional time-based filtering would require more complex query
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Update existing trade with new data
   */
  private async updateExistingTrade(
    existing: Trade,
    newTrade: TradeCreateData,
    original: TradeHistoryEntry
  ): Promise<void> {
    const updates: Partial<Trade> = {};

    // Update exit information if available
    if (newTrade.exit_price && !existing.exit_price) {
      updates.exit_price = newTrade.exit_price;
    }

    // Update metadata
    if (newTrade.market_conditions) {
      updates.market_conditions = {
        ...existing.market_conditions,
        ...newTrade.market_conditions,
        updated_from_migration: true,
      };
    }

    if (Object.keys(updates).length > 0) {
      await this.tradeRepo.updateById(existing.id, updates);
    }
  }

  /**
   * Calculate expected P&L for validation
   */
  private calculateExpectedPnL(trade: TradeHistoryEntry): number {
    if (!trade.exitPrice || !trade.entryPrice) return 0;
    
    const priceDiff = trade.side === 'BUY' 
      ? trade.exitPrice - trade.entryPrice
      : trade.entryPrice - trade.exitPrice;
    
    const grossPnL = priceDiff * trade.quantity;
    return grossPnL - (trade.fees || 0);
  }

  /**
   * Get statistics from in-memory trade service
   */
  private async getInMemoryTradeStatistics(): Promise<TradeStatistics> {
    const response = tradeHistoryService.getTradeHistory({}, 1, 10000);
    return response.statistics;
  }

  /**
   * Get analytics from database after migration
   */
  private async getDatabaseTradeAnalytics(): Promise<TradeAnalytics> {
    const analytics = await this.tradeRepo.getTradeAnalytics();
    
    // Get additional metrics
    const symbolStats = await this.tradeRepo.getSymbolStats();
    const strategyStats = await this.tradeRepo.getStrategyStats();

    const symbolDistribution: Record<string, number> = {};
    symbolStats.forEach(row => {
      symbolDistribution[row.symbol] = Number(row.count);
    });

    const strategyDistribution: Record<string, number> = {};
    strategyStats.forEach(row => {
      strategyDistribution[row.strategy || 'Unknown'] = Number(row.count);
    });

    return {
      totalTrades: analytics.total_trades,
      openTrades: 0, // TODO: Calculate open trades
      closedTrades: analytics.total_trades, // TODO: Distinguish open/closed
      totalVolume: analytics.total_volume,
      totalPnL: analytics.net_profit,
      winRate: analytics.win_rate,
      profitFactor: analytics.profit_factor,
      avgTradeSize: analytics.total_volume / Math.max(analytics.total_trades, 1),
      symbolDistribution,
      strategyDistribution,
    };
  }

  /**
   * Calculate data integrity score comparing before/after migration
   */
  private async calculateDataIntegrityScore(
    originalTrades: TradeHistoryEntry[],
    migrationResult: any
  ): Promise<number> {
    if (originalTrades.length === 0) return 1.0;

    let score = 1.0;
    const totalOriginal = originalTrades.length;
    
    // Penalize for failed migrations
    const failureRate = migrationResult.totalFailed / totalOriginal;
    score -= failureRate * 0.5;
    
    // Penalize for skipped migrations
    const skipRate = migrationResult.totalSkipped / totalOriginal;
    score -= skipRate * 0.2;
    
    // Bonus for successful migration
    const successRate = migrationResult.totalMigrated / totalOriginal;
    score = Math.min(1.0, score + successRate * 0.1);
    
    return Math.max(0, score);
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate unique migration ID
   */
  private generateMigrationId(): string {
    return `TRADE_MIGRATION_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export default TradeDataMigrator;