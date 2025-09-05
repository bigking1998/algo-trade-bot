-- Rollback Migration: 003_add_ml_strategy_fields_down.sql
-- Description: Rollback machine learning strategy fields and tables
-- Author: DatabaseAgent
-- Created: 2025-01-05
-- Rollback for: 003_add_ml_strategy_fields.sql
-- 
-- This rollback migration removes all ML-specific fields and tables
-- added in migration 003

-- Migration metadata
-- Version: 003_down
-- Type: feature_rollback
-- Forward migration: 003_add_ml_strategy_fields.sql

BEGIN;

-- ==================================================
-- REMOVE TIMESCALEDB POLICIES FOR ML TABLES
-- ==================================================

-- Remove compression policy for ml_predictions
SELECT remove_compression_policy('ml_predictions', if_exists => true);

-- ==================================================
-- DROP ML VIEWS
-- ==================================================

DROP VIEW IF EXISTS active_ml_models CASCADE;
DROP VIEW IF EXISTS ml_model_performance_summary CASCADE;

-- ==================================================
-- DROP ML TRIGGERS
-- ==================================================

DROP TRIGGER IF EXISTS update_ml_models_updated_at ON ml_models;
DROP TRIGGER IF EXISTS update_ml_features_updated_at ON ml_features;

-- ==================================================
-- DROP ML TABLES (in reverse dependency order)
-- ==================================================

-- Drop tables that reference other ML tables first
DROP TABLE IF EXISTS ml_training_history CASCADE;
DROP TABLE IF EXISTS ml_predictions CASCADE;
DROP TABLE IF EXISTS ml_models CASCADE;
DROP TABLE IF EXISTS ml_features CASCADE;

-- ==================================================
-- REMOVE ML FIELDS FROM STRATEGIES TABLE
-- ==================================================

-- Remove ML-specific columns from strategies table
ALTER TABLE strategies 
DROP COLUMN IF EXISTS ml_model_config,
DROP COLUMN IF EXISTS ml_model_version,
DROP COLUMN IF EXISTS ml_training_data_start,
DROP COLUMN IF EXISTS ml_training_data_end,
DROP COLUMN IF EXISTS ml_last_retrain_at,
DROP COLUMN IF EXISTS ml_prediction_accuracy,
DROP COLUMN IF EXISTS ml_feature_importance,
DROP COLUMN IF EXISTS ml_model_performance;

-- ==================================================
-- ROLLBACK VALIDATION
-- ==================================================

-- Verify ML fields were removed from strategies
DO $$
DECLARE
    remaining_columns TEXT[];
    ml_columns TEXT[] := ARRAY[
        'ml_model_config', 'ml_model_version', 'ml_training_data_start',
        'ml_training_data_end', 'ml_last_retrain_at', 'ml_prediction_accuracy',
        'ml_feature_importance', 'ml_model_performance'
    ];
BEGIN
    SELECT ARRAY(
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'trading' 
        AND table_name = 'strategies'
        AND column_name = ANY(ml_columns)
    ) INTO remaining_columns;
    
    IF array_length(remaining_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Rollback incomplete: remaining ML columns in strategies: %', 
                       array_to_string(remaining_columns, ', ');
    END IF;
    
    RAISE NOTICE 'Rollback validation: All ML fields removed from strategies table';
END $$;

-- Verify ML tables were dropped
DO $$
DECLARE
    remaining_tables TEXT[];
    ml_tables TEXT[] := ARRAY['ml_models', 'ml_predictions', 'ml_training_history', 'ml_features'];
BEGIN
    SELECT ARRAY(
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'trading' 
        AND table_name = ANY(ml_tables)
    ) INTO remaining_tables;
    
    IF array_length(remaining_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Rollback incomplete: remaining ML tables: %', 
                       array_to_string(remaining_tables, ', ');
    END IF;
    
    RAISE NOTICE 'Rollback validation: All ML tables dropped successfully';
END $$;

-- Verify ML hypertables were removed
DO $$
DECLARE
    remaining_hypertables INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_hypertables
    FROM timescaledb_information.hypertables 
    WHERE hypertable_name IN ('ml_predictions');
    
    IF remaining_hypertables > 0 THEN
        RAISE EXCEPTION 'Rollback incomplete: % ML hypertables still exist', remaining_hypertables;
    END IF;
    
    RAISE NOTICE 'Rollback validation: All ML hypertables removed successfully';
END $$;

COMMIT;

-- ==================================================
-- ROLLBACK COMPLETION LOG
-- ==================================================
SELECT 
    'Rollback 003_add_ml_strategy_fields_down completed successfully' as status,
    NOW() as completed_at,
    'Removed all ML strategy fields, tables, and configurations' as description;