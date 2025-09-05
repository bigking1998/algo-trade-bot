-- Migration: 003_add_ml_strategy_fields.sql
-- Description: Add machine learning strategy fields and tables
-- Author: DatabaseAgent  
-- Created: 2025-01-05
-- Dependencies: 002_add_indexes.sql
-- Estimated execution time: 20-40 seconds
-- 
-- This migration adds ML-specific fields and tables to support
-- machine learning enhanced trading strategies (future ML implementation)

-- Migration metadata
-- Version: 003
-- Type: feature_enhancement
-- Rollback: 003_add_ml_strategy_fields_down.sql

BEGIN;

-- ==================================================
-- ADD ML FIELDS TO STRATEGIES TABLE
-- ==================================================

-- Add ML-specific configuration fields
ALTER TABLE strategies 
ADD COLUMN IF NOT EXISTS ml_model_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ml_model_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS ml_training_data_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ml_training_data_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ml_last_retrain_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ml_prediction_accuracy DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS ml_feature_importance JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ml_model_performance JSONB DEFAULT '{}';

-- ==================================================
-- CREATE ML MODELS TABLE
-- ==================================================

CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('lstm', 'cnn', 'transformer', 'ensemble', 'linear', 'tree_based')),
    status VARCHAR(20) NOT NULL DEFAULT 'training' CHECK (status IN ('training', 'active', 'deprecated', 'failed')),
    architecture JSONB NOT NULL DEFAULT '{}',
    hyperparameters JSONB NOT NULL DEFAULT '{}',
    training_config JSONB NOT NULL DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    feature_config JSONB DEFAULT '{}',
    model_file_path VARCHAR(500),
    training_started_at TIMESTAMPTZ,
    training_completed_at TIMESTAMPTZ,
    deployment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    UNIQUE(strategy_id, name, version)
);

-- Indexes for ML models
CREATE INDEX idx_ml_models_strategy ON ml_models(strategy_id, status);
CREATE INDEX idx_ml_models_type_status ON ml_models(model_type, status);
CREATE INDEX idx_ml_models_performance ON ml_models USING GIN(performance_metrics);

-- ==================================================
-- CREATE ML PREDICTIONS TABLE (TimescaleDB Hypertable)
-- ==================================================

CREATE TABLE ml_predictions (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_id UUID NOT NULL REFERENCES ml_models(id),
    symbol VARCHAR(20) NOT NULL,
    prediction_type VARCHAR(50) NOT NULL CHECK (prediction_type IN ('price', 'direction', 'volatility', 'signal', 'confidence')),
    prediction_value DECIMAL(20,8) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    features JSONB NOT NULL DEFAULT '{}',
    actual_value DECIMAL(20,8),
    prediction_error DECIMAL(20,8),
    horizon_minutes INTEGER NOT NULL DEFAULT 60,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('ml_predictions', 'time', chunk_time_interval => INTERVAL '1 day');

-- Indexes for ML predictions
CREATE INDEX idx_ml_predictions_model_time ON ml_predictions(model_id, time DESC);
CREATE INDEX idx_ml_predictions_symbol_time ON ml_predictions(symbol, prediction_type, time DESC);
CREATE INDEX idx_ml_predictions_confidence ON ml_predictions(confidence_score DESC, time DESC) WHERE confidence_score > 0.7;

-- ==================================================
-- CREATE ML TRAINING HISTORY TABLE
-- ==================================================

CREATE TABLE ml_training_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ml_models(id),
    training_session_id VARCHAR(100) NOT NULL,
    epoch INTEGER,
    batch_number INTEGER,
    loss DECIMAL(10,6),
    accuracy DECIMAL(5,4),
    validation_loss DECIMAL(10,6),
    validation_accuracy DECIMAL(5,4),
    learning_rate DECIMAL(10,8),
    training_time_ms INTEGER,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for training history
CREATE INDEX idx_ml_training_history_model ON ml_training_history(model_id, created_at DESC);
CREATE INDEX idx_ml_training_history_session ON ml_training_history(training_session_id, epoch);

-- ==================================================
-- CREATE FEATURE ENGINEERING TABLE
-- ==================================================

CREATE TABLE ml_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    feature_type VARCHAR(50) NOT NULL CHECK (feature_type IN ('technical', 'fundamental', 'sentiment', 'volume', 'price_action', 'derived')),
    calculation_method TEXT NOT NULL,
    dependencies JSONB DEFAULT '[]',
    parameters JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    compute_cost_ms INTEGER DEFAULT 0,
    importance_score DECIMAL(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for features
CREATE INDEX idx_ml_features_type_active ON ml_features(feature_type, is_active);
CREATE INDEX idx_ml_features_importance ON ml_features(importance_score DESC NULLS LAST) WHERE is_active = TRUE;

-- ==================================================
-- ADD TRIGGERS FOR UPDATED_AT
-- ==================================================

-- Update trigger for ml_models
CREATE TRIGGER update_ml_models_updated_at 
BEFORE UPDATE ON ml_models 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update trigger for ml_features
CREATE TRIGGER update_ml_features_updated_at 
BEFORE UPDATE ON ml_features 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================================================
-- CREATE ML-SPECIFIC VIEWS
-- ==================================================

-- View for active ML models with performance
CREATE OR REPLACE VIEW active_ml_models AS
SELECT 
    m.id,
    m.strategy_id,
    s.name as strategy_name,
    m.name as model_name,
    m.version,
    m.model_type,
    m.status,
    m.performance_metrics,
    m.deployment_at,
    EXTRACT(EPOCH FROM (NOW() - m.deployment_at))/3600 as hours_deployed,
    COUNT(p.id) as predictions_count,
    AVG(p.confidence_score) as avg_confidence
FROM ml_models m
JOIN strategies s ON m.strategy_id = s.id
LEFT JOIN ml_predictions p ON m.id = p.model_id 
    AND p.time >= NOW() - INTERVAL '24 hours'
WHERE m.status = 'active' AND s.status = 'active'
GROUP BY m.id, s.name, m.name, m.version, m.model_type, m.status, 
         m.performance_metrics, m.deployment_at;

-- View for ML model performance summary
CREATE OR REPLACE VIEW ml_model_performance_summary AS
SELECT 
    m.id,
    m.name,
    m.model_type,
    COUNT(p.id) as total_predictions,
    AVG(p.confidence_score) as avg_confidence,
    AVG(ABS(p.prediction_error)) as avg_abs_error,
    STDDEV(p.prediction_error) as error_stddev,
    COUNT(p.id) FILTER (WHERE p.prediction_error IS NOT NULL) as validated_predictions,
    AVG(p.confidence_score) FILTER (WHERE ABS(p.prediction_error) < 0.05) as accuracy_high_conf
FROM ml_models m
LEFT JOIN ml_predictions p ON m.id = p.model_id 
    AND p.time >= NOW() - INTERVAL '7 days'
GROUP BY m.id, m.name, m.model_type;

-- ==================================================
-- COMPRESSION POLICIES FOR ML TABLES
-- ==================================================

-- Compression for old predictions
ALTER TABLE ml_predictions SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'model_id, symbol, prediction_type',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compression policy (compress chunks older than 3 days for predictions)
SELECT add_compression_policy('ml_predictions', INTERVAL '3 days');

-- ==================================================
-- SAMPLE ML DATA FOR TESTING
-- ==================================================

-- Insert sample ML features
INSERT INTO ml_features (name, description, feature_type, calculation_method, parameters) VALUES
('sma_20', 'Simple Moving Average 20 periods', 'technical', 'rolling_mean(close, 20)', '{"period": 20}'),
('rsi_14', 'Relative Strength Index 14 periods', 'technical', 'rsi_calculation(close, 14)', '{"period": 14}'),
('volume_ratio', 'Volume ratio vs 20-day average', 'volume', 'volume / rolling_mean(volume, 20)', '{"period": 20}'),
('price_momentum', 'Price momentum over 5 periods', 'price_action', '(close / close.shift(5)) - 1', '{"lookback": 5}');

-- ==================================================
-- MIGRATION VALIDATION
-- ==================================================

-- Verify ML fields were added to strategies
DO $$
DECLARE
    missing_columns TEXT[];
    expected_columns TEXT[] := ARRAY[
        'ml_model_config', 'ml_model_version', 'ml_training_data_start',
        'ml_training_data_end', 'ml_last_retrain_at', 'ml_prediction_accuracy',
        'ml_feature_importance', 'ml_model_performance'
    ];
BEGIN
    SELECT ARRAY(
        SELECT unnest(expected_columns)
        EXCEPT 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'trading' AND table_name = 'strategies'
    ) INTO missing_columns;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Missing strategy columns: %', array_to_string(missing_columns, ', ');
    END IF;
    
    RAISE NOTICE 'Migration validation: All ML fields added to strategies table';
END $$;

-- Verify ML tables were created
DO $$
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY['ml_models', 'ml_predictions', 'ml_training_history', 'ml_features'];
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'trading' 
    AND table_name = ANY(expected_tables);
    
    IF table_count != array_length(expected_tables, 1) THEN
        RAISE EXCEPTION 'Expected % ML tables, found %', array_length(expected_tables, 1), table_count;
    END IF;
    
    RAISE NOTICE 'Migration validation: % ML tables created successfully', table_count;
END $$;

-- Verify hypertable for predictions
DO $$
DECLARE
    is_hypertable BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'ml_predictions'
    ) INTO is_hypertable;
    
    IF NOT is_hypertable THEN
        RAISE EXCEPTION 'ml_predictions hypertable not created';
    END IF;
    
    RAISE NOTICE 'Migration validation: ml_predictions hypertable created successfully';
END $$;

-- Verify sample features were inserted
DO $$
DECLARE
    feature_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO feature_count FROM ml_features;
    
    IF feature_count < 4 THEN
        RAISE EXCEPTION 'Expected at least 4 sample features, found %', feature_count;
    END IF;
    
    RAISE NOTICE 'Migration validation: % sample ML features inserted', feature_count;
END $$;

COMMIT;

-- ==================================================
-- MIGRATION COMPLETION LOG
-- ==================================================
SELECT 
    'Migration 003_add_ml_strategy_fields completed successfully' as status,
    NOW() as completed_at,
    'Added ML strategy fields, models, predictions, and feature engineering tables' as description;