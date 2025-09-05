-- Rollback Migration: 002_add_indexes_down.sql
-- Description: Rollback performance optimization indexes
-- Author: DatabaseAgent
-- Created: 2025-01-05
-- Rollback for: 002_add_indexes.sql
-- 
-- This rollback migration removes all performance indexes added in migration 002

-- Migration metadata
-- Version: 002_down
-- Type: performance_rollback
-- Forward migration: 002_add_indexes.sql

BEGIN;

-- ==================================================
-- DROP PERFORMANCE INDEXES
-- ==================================================

-- Drop market data performance indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_market_data_symbol_tf_time_opt;
DROP INDEX CONCURRENTLY IF EXISTS idx_market_data_recent_volume;
DROP INDEX CONCURRENTLY IF EXISTS idx_market_data_ohlc_analysis;

-- Drop trades performance indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_trades_active_positions;
DROP INDEX CONCURRENTLY IF EXISTS idx_trades_pnl_analysis;
DROP INDEX CONCURRENTLY IF EXISTS idx_trades_execution_performance;

-- Drop orders performance indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_orderbook;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_execution_tracking;

-- Drop portfolio performance indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_portfolio_performance;
DROP INDEX CONCURRENTLY IF EXISTS idx_portfolio_drawdown_analysis;

-- Drop system logs performance indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_system_logs_error_monitoring;
DROP INDEX CONCURRENTLY IF EXISTS idx_system_logs_strategy_debug;

-- Drop strategies performance indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_strategies_performance_analysis;
DROP INDEX CONCURRENTLY IF EXISTS idx_strategies_parameter_optimization;

-- ==================================================
-- ROLLBACK VALIDATION
-- ==================================================

-- Verify indexes were dropped
DO $$
DECLARE
    remaining_indexes TEXT[] := ARRAY[
        'idx_market_data_symbol_tf_time_opt',
        'idx_market_data_recent_volume', 
        'idx_market_data_ohlc_analysis',
        'idx_trades_active_positions',
        'idx_trades_pnl_analysis',
        'idx_trades_execution_performance',
        'idx_orders_orderbook',
        'idx_orders_execution_tracking',
        'idx_portfolio_performance',
        'idx_portfolio_drawdown_analysis',
        'idx_system_logs_error_monitoring',
        'idx_system_logs_strategy_debug',
        'idx_strategies_performance_analysis',
        'idx_strategies_parameter_optimization'
    ];
    existing_indexes TEXT[];
BEGIN
    -- Check for any remaining indexes that should have been dropped
    SELECT ARRAY(
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'trading' 
        AND indexname = ANY(remaining_indexes)
    ) INTO existing_indexes;
    
    IF array_length(existing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Rollback incomplete: remaining indexes: %', array_to_string(existing_indexes, ', ');
    END IF;
    
    RAISE NOTICE 'Rollback validation: All performance indexes removed successfully';
END $$;

COMMIT;

-- ==================================================
-- ROLLBACK COMPLETION LOG
-- ==================================================
SELECT 
    'Rollback 002_add_indexes_down completed successfully' as status,
    NOW() as completed_at,
    'Removed all performance optimization indexes from trading platform' as description;