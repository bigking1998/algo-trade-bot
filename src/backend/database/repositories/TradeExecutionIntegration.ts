/**
 * Trade Execution Integration Service
 * Task BE-004: Trade Repository - Strategy Execution Integration
 * 
 * Provides integration hooks between TradeRepository and Strategy Execution System
 * for real-time performance monitoring, risk management, and trade execution feedback.
 */

import { TradeRepository, StrategyIntegration, TradeCreateData, TradeUpdateData } from './TradeRepository';
import { DatabaseManager } from '../DatabaseManager';

export interface TradeExecutionEvent {
  eventId: string;
  timestamp: Date;
  strategyId: string;
  eventType: 'STRATEGY_START' | 'STRATEGY_STOP' | 'TRADE_SIGNAL' | 'TRADE_EXECUTED' | 'RISK_BREACH' | 'PERFORMANCE_UPDATE';
  data: Record<string, any>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  source: 'STRATEGY_ENGINE' | 'RISK_MANAGER' | 'TRADE_EXECUTOR' | 'POSITION_MANAGER';
}

export interface StrategyPerformanceUpdate {
  strategyId: string;
  timestamp: Date;
  metricsSnapshot: {
    totalTrades: number;
    totalPnL: number;
    dailyPnL: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    riskScore: number;
  };
  recommendations: string[];
  alerts: StrategyAlert[];
}

export interface StrategyAlert {
  alertId: string;
  strategyId: string;
  type: 'RISK_LIMIT' | 'PERFORMANCE_DEGRADATION' | 'EXECUTION_ERROR' | 'POSITION_SIZE' | 'DRAWDOWN_LIMIT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Integration service that bridges TradeRepository with Strategy Execution System
 */
export class TradeExecutionIntegration {
  private tradeRepository: TradeRepository;
  private db: DatabaseManager;
  private eventHandlers: Map<string, Array<(event: TradeExecutionEvent) => Promise<void>>>;
  private performanceCache: Map<string, StrategyPerformanceUpdate>;

  constructor() {
    this.tradeRepository = new TradeRepository();
    this.db = DatabaseManager.getInstance();
    this.eventHandlers = new Map();
    this.performanceCache = new Map();
  }

  // ============================================================================
  // EVENT HANDLING AND INTEGRATION
  // ============================================================================

  /**
   * Register event handler for strategy execution events
   */
  public onEvent(
    eventType: TradeExecutionEvent['eventType'], 
    handler: (event: TradeExecutionEvent) => Promise<void>
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit event to all registered handlers
   */
  public async emitEvent(event: TradeExecutionEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.eventType) || [];
    
    await Promise.allSettled(
      handlers.map(handler => 
        handler(event).catch(error => 
          console.error(`[TradeExecutionIntegration] Event handler failed:`, error)
        )
      )
    );

    // Log event to database for audit trail
    await this.logExecutionEvent(event);
  }

  /**
   * Handle trade execution completion from strategy engine
   */
  public async onTradeExecuted(
    strategyId: string,
    tradeData: TradeCreateData,
    executionMetadata: {
      signalId?: string;
      executionLatencyMs: number;
      slippage?: number;
      orderType: string;
      marketConditions?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      // Create trade record with execution metadata
      const trade = await this.tradeRepository.createTrade({
        ...tradeData,
        strategy_id: strategyId,
        execution_latency_ms: executionMetadata.executionLatencyMs,
        slippage: executionMetadata.slippage,
        market_conditions: {
          ...tradeData.market_conditions,
          ...executionMetadata.marketConditions,
          orderType: executionMetadata.orderType,
          signalId: executionMetadata.signalId,
        },
      });

      // Emit trade executed event
      await this.emitEvent({
        eventId: `trade_executed_${trade.id}`,
        timestamp: new Date(),
        strategyId,
        eventType: 'TRADE_EXECUTED',
        data: {
          tradeId: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          pnl: trade.pnl,
          executionMetadata,
        },
        severity: 'INFO',
        source: 'TRADE_EXECUTOR',
      });

      // Update strategy performance cache
      await this.updateStrategyPerformance(strategyId);

      // Check for risk alerts
      await this.checkRiskAlerts(strategyId);

      return trade.id;
    } catch (error) {
      console.error(`[TradeExecutionIntegration] Failed to handle trade execution:`, error);
      
      await this.emitEvent({
        eventId: `trade_execution_error_${Date.now()}`,
        timestamp: new Date(),
        strategyId,
        eventType: 'TRADE_EXECUTED',
        data: {
          error: error instanceof Error ? error.message : String(error),
          tradeData,
          executionMetadata,
        },
        severity: 'ERROR',
        source: 'TRADE_EXECUTOR',
      });

      throw error;
    }
  }

  /**
   * Update trade when position is closed
   */
  public async onTradeExited(
    tradeId: string,
    exitData: {
      exitPrice: number;
      exitTime: Date;
      fee?: number;
      reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'STRATEGY_SIGNAL' | 'RISK_MANAGEMENT';
      executionLatencyMs: number;
    }
  ): Promise<void> {
    try {
      const updatedTrade = await this.tradeRepository.updateTradeExit(tradeId, {
        exit_price: exitData.exitPrice,
        fee: exitData.fee,
      });

      if (updatedTrade) {
        await this.emitEvent({
          eventId: `trade_exited_${tradeId}`,
          timestamp: new Date(),
          strategyId: updatedTrade.strategy_id || 'unknown',
          eventType: 'TRADE_EXECUTED',
          data: {
            tradeId,
            exitPrice: exitData.exitPrice,
            pnl: updatedTrade.pnl,
            reason: exitData.reason,
            executionLatencyMs: exitData.executionLatencyMs,
          },
          severity: 'INFO',
          source: 'POSITION_MANAGER',
        });

        // Update strategy performance
        if (updatedTrade.strategy_id) {
          await this.updateStrategyPerformance(updatedTrade.strategy_id);
        }
      }
    } catch (error) {
      console.error(`[TradeExecutionIntegration] Failed to handle trade exit:`, error);
      throw error;
    }
  }

  // ============================================================================
  // PERFORMANCE MONITORING AND ALERTS
  // ============================================================================

  /**
   * Get real-time strategy performance for strategy engine
   */
  public async getStrategyPerformanceSnapshot(strategyId: string): Promise<StrategyPerformanceUpdate | null> {
    // Check cache first
    const cached = this.performanceCache.get(strategyId);
    if (cached && (Date.now() - cached.timestamp.getTime()) < 60000) { // 1-minute cache
      return cached;
    }

    // Calculate fresh performance metrics
    const integration = await this.tradeRepository.getStrategyIntegrationSummary(strategyId);
    const strategyData = integration.find(s => s.strategyId === strategyId);
    
    if (!strategyData) {
      return null;
    }

    const analytics = await this.tradeRepository.getTradeAnalytics({ strategy_id: strategyId });
    
    const snapshot: StrategyPerformanceUpdate = {
      strategyId,
      timestamp: new Date(),
      metricsSnapshot: {
        totalTrades: strategyData.totalTrades,
        totalPnL: strategyData.totalPnL,
        dailyPnL: strategyData.todayPnL,
        winRate: analytics.win_rate,
        sharpeRatio: 0, // TODO: Calculate from performance metrics
        maxDrawdown: analytics.max_drawdown,
        riskScore: strategyData.riskScore,
      },
      recommendations: await this.generateStrategyRecommendations(strategyId),
      alerts: await this.getActiveAlerts(strategyId),
    };

    // Cache the result
    this.performanceCache.set(strategyId, snapshot);
    
    return snapshot;
  }

  /**
   * Check for risk alerts and generate warnings
   */
  private async checkRiskAlerts(strategyId: string): Promise<void> {
    const performance = await this.getStrategyPerformanceSnapshot(strategyId);
    if (!performance) return;

    const alerts: StrategyAlert[] = [];

    // Check drawdown limit
    if (performance.metricsSnapshot.maxDrawdown > 15) {
      alerts.push({
        alertId: `drawdown_${strategyId}_${Date.now()}`,
        strategyId,
        type: 'DRAWDOWN_LIMIT',
        severity: performance.metricsSnapshot.maxDrawdown > 25 ? 'CRITICAL' : 'HIGH',
        message: `Strategy drawdown (${performance.metricsSnapshot.maxDrawdown.toFixed(2)}%) exceeds safe limits`,
        threshold: 15,
        currentValue: performance.metricsSnapshot.maxDrawdown,
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Check daily P&L variance
    if (Math.abs(performance.metricsSnapshot.dailyPnL) > Math.abs(performance.metricsSnapshot.totalPnL) * 0.1) {
      alerts.push({
        alertId: `daily_pnl_${strategyId}_${Date.now()}`,
        strategyId,
        type: 'PERFORMANCE_DEGRADATION',
        severity: 'MEDIUM',
        message: `Daily P&L variance is unusually high`,
        threshold: Math.abs(performance.metricsSnapshot.totalPnL) * 0.1,
        currentValue: Math.abs(performance.metricsSnapshot.dailyPnL),
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Check win rate degradation
    if (performance.metricsSnapshot.winRate < 30) {
      alerts.push({
        alertId: `winrate_${strategyId}_${Date.now()}`,
        strategyId,
        type: 'PERFORMANCE_DEGRADATION',
        severity: performance.metricsSnapshot.winRate < 20 ? 'HIGH' : 'MEDIUM',
        message: `Win rate (${performance.metricsSnapshot.winRate.toFixed(1)}%) is below acceptable threshold`,
        threshold: 30,
        currentValue: performance.metricsSnapshot.winRate,
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Emit alert events
    for (const alert of alerts) {
      await this.emitEvent({
        eventId: alert.alertId,
        timestamp: new Date(),
        strategyId,
        eventType: 'RISK_BREACH',
        data: alert,
        severity: alert.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        source: 'RISK_MANAGER',
      });
    }
  }

  /**
   * Generate strategy-specific recommendations
   */
  private async generateStrategyRecommendations(strategyId: string): Promise<string[]> {
    const analytics = await this.tradeRepository.getAdvancedTradeAnalytics({ strategy_id: strategyId });
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (analytics.win_rate < 40) {
      recommendations.push('Consider tightening entry criteria to improve win rate');
    }

    if (analytics.profit_factor < 1.2) {
      recommendations.push('Review exit strategy - profit factor indicates poor risk/reward');
    }

    if (analytics.max_consecutive_losses > 5) {
      recommendations.push('Implement cooling-off period after consecutive losses');
    }

    if (analytics.kelly_criterion > 0.2) {
      recommendations.push('Kelly Criterion suggests reducing position size to avoid overleverage');
    } else if (analytics.kelly_criterion < 0) {
      recommendations.push('Negative Kelly Criterion - consider halting strategy');
    }

    return recommendations;
  }

  /**
   * Get active alerts for a strategy
   */
  private async getActiveAlerts(strategyId: string): Promise<StrategyAlert[]> {
    // In a full implementation, this would query an alerts table
    // For now, return empty array as alerts are generated in real-time
    return [];
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Log execution event to database for audit trail
   */
  private async logExecutionEvent(event: TradeExecutionEvent): Promise<void> {
    try {
      // In a full implementation, this would insert into strategy_execution_events table
      console.log(`[ExecutionEvent] ${event.eventType} - ${event.strategyId}:`, {
        eventId: event.eventId,
        severity: event.severity,
        source: event.source,
        data: event.data,
      });
    } catch (error) {
      console.error('[TradeExecutionIntegration] Failed to log execution event:', error);
    }
  }

  /**
   * Update strategy performance cache
   */
  private async updateStrategyPerformance(strategyId: string): Promise<void> {
    try {
      const performance = await this.getStrategyPerformanceSnapshot(strategyId);
      if (performance) {
        // Emit performance update event
        await this.emitEvent({
          eventId: `performance_update_${strategyId}_${Date.now()}`,
          timestamp: new Date(),
          strategyId,
          eventType: 'PERFORMANCE_UPDATE',
          data: performance,
          severity: 'INFO',
          source: 'STRATEGY_ENGINE',
        });
      }
    } catch (error) {
      console.error(`[TradeExecutionIntegration] Failed to update strategy performance:`, error);
    }
  }

  /**
   * Get integration health status
   */
  public async getHealthStatus(): Promise<{
    healthy: boolean;
    cachedStrategies: number;
    eventHandlers: number;
    lastUpdateTime: Date | null;
    errors?: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Test repository connection
      await this.tradeRepository.getHealthStatus();
    } catch (error) {
      errors.push(`Repository connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const totalHandlers = Array.from(this.eventHandlers.values())
      .reduce((sum, handlers) => sum + handlers.length, 0);

    return {
      healthy: errors.length === 0,
      cachedStrategies: this.performanceCache.size,
      eventHandlers: totalHandlers,
      lastUpdateTime: this.performanceCache.size > 0 
        ? new Date(Math.max(...Array.from(this.performanceCache.values()).map(p => p.timestamp.getTime())))
        : null,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Clear performance cache for a strategy or all strategies
   */
  public clearPerformanceCache(strategyId?: string): void {
    if (strategyId) {
      this.performanceCache.delete(strategyId);
    } else {
      this.performanceCache.clear();
    }
  }
}

export default TradeExecutionIntegration;