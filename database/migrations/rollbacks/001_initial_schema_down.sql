-- Rollback Migration: 001_initial_schema_down.sql
-- Description: Rollback complete trading platform schema
-- Author: DatabaseAgent
-- Created: 2025-01-05
-- Rollback for: 001_initial_schema.sql
-- 
-- This rollback migration removes all tables, indexes, triggers,
-- and TimescaleDB configurations created by the initial schema migration.
-- 
-- WARNING: This will destroy all trading data in the database!

-- Migration metadata
-- Version: 001_down
-- Type: schema_destruction
-- Forward migration: 001_initial_schema.sql

BEGIN;

-- ==================================================
-- REMOVE TIMESCALEDB POLICIES
-- ==================================================

-- Remove compression policies
SELECT remove_compression_policy('market_data', if_exists => true);
SELECT remove_compression_policy('portfolio_snapshots', if_exists => true);
SELECT remove_compression_policy('system_logs', if_exists => true);

-- Remove retention policies
SELECT remove_retention_policy('system_logs', if_exists => true);

-- ==================================================
-- DROP TRIGGERS
-- ==================================================

DROP TRIGGER IF EXISTS update_strategies_updated_at ON strategies;
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS validate_trade_quantities_trigger ON trades;

-- ==================================================
-- DROP FUNCTIONS
-- ==================================================

DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS validate_trade_quantities();

-- ==================================================
-- DROP TABLES (in reverse dependency order)
-- ==================================================

-- Drop tables that reference other tables first
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS portfolio_snapshots CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS market_data CASCADE;

-- Drop main tables
DROP TABLE IF EXISTS strategies CASCADE;

-- ==================================================
-- CLEAN UP SCHEMA
-- ==================================================

-- Reset search path to default
SET search_path TO public;

-- Drop trading schema if it exists and is empty
DROP SCHEMA IF EXISTS trading CASCADE;

-- ==================================================
-- ROLLBACK VALIDATION
-- ==================================================

-- Verify all tables were dropped
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'trading';
    
    IF table_count > 0 THEN
        RAISE EXCEPTION 'Rollback failed: % tables still exist in trading schema', table_count;
    END IF;
    
    RAISE NOTICE 'Rollback validation: All tables dropped successfully';
END $$;

-- Verify hypertables were removed
DO $$
DECLARE
    hypertable_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO hypertable_count 
    FROM timescaledb_information.hypertables 
    WHERE hypertable_schema = 'trading';
    
    IF hypertable_count > 0 THEN
        RAISE EXCEPTION 'Rollback failed: % hypertables still exist', hypertable_count;
    END IF;
    
    RAISE NOTICE 'Rollback validation: All hypertables removed successfully';
END $$;

COMMIT;

-- ==================================================
-- ROLLBACK COMPLETION LOG
-- ==================================================
SELECT 
    'Rollback 001_initial_schema_down completed successfully' as status,
    NOW() as completed_at,
    'Removed complete trading platform schema and all data' as description;

-- ==================================================
-- WARNING MESSAGE
-- ==================================================
RAISE NOTICE '================================================';
RAISE NOTICE 'WARNING: All trading platform data has been destroyed!';
RAISE NOTICE 'Database has been reset to pre-DB-002 state.';
RAISE NOTICE 'You will need to re-run the initial schema migration';
RAISE NOTICE 'to restore the trading platform functionality.';
RAISE NOTICE '================================================';