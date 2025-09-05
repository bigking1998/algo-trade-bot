-- Migration: 002_add_indexes.sql
-- Description: Performance optimization indexes for trading platform
-- Author: DatabaseAgent
-- Created: 2025-01-05
-- Dependencies: 001_initial_schema.sql
-- Estimated execution time: 15-30 seconds
-- 
-- This migration adds performance-critical indexes for the trading platform
-- based on expected query patterns and performance analysis

-- Migration metadata
-- Version: 002
-- Type: performance_optimization
-- Rollback: 002_add_indexes_down.sql

BEGIN;

-- ==================================================
-- MARKET DATA PERFORMANCE INDEXES
-- ==================================================

-- Composite index for symbol-timeframe-time queries (most common pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_symbol_tf_time_opt 
ON market_data(symbol, timeframe, time DESC) 
WHERE time >= NOW() - INTERVAL '30 days';

-- Partial index for recent high-volume data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_recent_volume 
ON market_data(symbol, time DESC, volume) 
WHERE time >= NOW() - INTERVAL '7 days' AND volume > 0;

-- Index for OHLC queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_ohlc_analysis 
ON market_data(symbol, timeframe, time) 
INCLUDE (open, high, low, close, volume);

-- ==================================================
-- TRADES PERFORMANCE INDEXES
-- ==================================================

-- Composite index for active positions queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_active_positions 
ON trades(strategy_id, symbol, status, time DESC) 
WHERE status IN ('filled', 'partial') AND exit_time IS NULL;

-- Index for P&L analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_pnl_analysis 
ON trades(strategy_id, time DESC) 
INCLUDE (pnl, fees, executed_quantity) 
WHERE pnl IS NOT NULL;

-- Index for trade execution analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_execution_performance 
ON trades(symbol, side, type, time DESC) 
WHERE status = 'filled' AND time >= NOW() - INTERVAL '30 days';

-- ==================================================
-- ORDERS PERFORMANCE INDEXES
-- ==================================================

-- Index for order book management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_orderbook 
ON orders(symbol, side, status, price) 
WHERE status IN ('pending', 'partial');

-- Index for order execution tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_execution_tracking 
ON orders(strategy_id, created_at DESC) 
INCLUDE (symbol, side, quantity, executed_quantity, average_price) 
WHERE status IN ('filled', 'partial', 'cancelled');

-- ==================================================
-- PORTFOLIO PERFORMANCE INDEXES
-- ==================================================

-- Index for portfolio performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_performance 
ON portfolio_snapshots(strategy_id, time DESC) 
INCLUDE (total_value, unrealized_pnl, realized_pnl, drawdown);

-- Index for drawdown analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_drawdown_analysis 
ON portfolio_snapshots(time DESC, drawdown) 
WHERE drawdown > 0.05; -- Focus on significant drawdowns

-- ==================================================
-- SYSTEM LOGS PERFORMANCE INDEXES
-- ==================================================

-- Index for error monitoring and debugging
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_error_monitoring 
ON system_logs(level, component, time DESC) 
WHERE level IN ('ERROR', 'FATAL') AND time >= NOW() - INTERVAL '7 days';

-- Index for strategy-specific logging
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_strategy_debug 
ON system_logs(strategy_id, time DESC) 
INCLUDE (level, component, message) 
WHERE strategy_id IS NOT NULL;

-- ==================================================
-- STRATEGIES PERFORMANCE INDEXES
-- ==================================================

-- Index for strategy performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategies_performance_analysis 
ON strategies USING GIN(performance_metrics) 
WHERE NOT is_deleted AND status = 'active';

-- Index for strategy parameter optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategies_parameter_optimization 
ON strategies(type, status) 
INCLUDE (parameters, performance_metrics) 
WHERE NOT is_deleted;

-- ==================================================
-- VALIDATION QUERIES
-- ==================================================

-- Verify indexes were created
DO $$
DECLARE
    new_index_count INTEGER;
    expected_indexes TEXT[] := ARRAY[
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
    missing_indexes TEXT[];
BEGIN
    -- Check for missing indexes
    SELECT ARRAY(
        SELECT unnest(expected_indexes)
        EXCEPT
        SELECT indexname FROM pg_indexes WHERE schemaname = 'trading'
    ) INTO missing_indexes;
    
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Missing indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
    
    SELECT COUNT(*) INTO new_index_count 
    FROM pg_indexes 
    WHERE schemaname = 'trading' 
    AND indexname = ANY(expected_indexes);
    
    RAISE NOTICE 'Migration validation: % performance indexes created successfully', new_index_count;
END $$;

-- Performance impact assessment
DO $$
DECLARE
    table_sizes RECORD;
BEGIN
    FOR table_sizes IN 
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'trading'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LOOP
        RAISE NOTICE 'Table %: %', table_sizes.tablename, table_sizes.size;
    END LOOP;
END $$;

COMMIT;

-- ==================================================
-- MIGRATION COMPLETION LOG
-- ==================================================
SELECT 
    'Migration 002_add_indexes completed successfully' as status,
    NOW() as completed_at,
    'Added 14 performance optimization indexes for trading platform' as description;