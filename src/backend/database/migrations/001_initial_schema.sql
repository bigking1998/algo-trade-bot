-- ============================================================================
-- Migration 001: Initial Trading Platform Schema
-- Task DB-002: Database Schema Implementation
-- ============================================================================
--
-- This migration creates the complete trading platform schema including:
-- - Core strategy management tables
-- - Time-series tables for market data, trades, orders
-- - Portfolio tracking and system logging
-- - All required indexes, constraints, and TimescaleDB optimizations
--
-- Dependencies: 
-- - PostgreSQL 15+
-- - TimescaleDB extension (installed in DB-001)
-- ============================================================================

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) VALUES 
('001', 'Initial trading platform schema with TimescaleDB', NOW());

-- Execute the main schema
\i ../schema.sql

-- Migration complete
UPDATE schema_migrations 
SET completed_at = NOW(), 
    status = 'completed'
WHERE version = '001';