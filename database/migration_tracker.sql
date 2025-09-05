-- Migration Tracking System for Trading Bot Database
-- Task DB-003: Database Migration System Implementation
-- 
-- This file creates the migration tracking table that monitors
-- the state of all applied migrations and rollbacks

-- Create schema_migrations table for tracking applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    execution_time_ms INTEGER,
    rolled_back_at TIMESTAMPTZ,
    rollback_reason TEXT,
    migration_type VARCHAR(20) NOT NULL DEFAULT 'up' CHECK (migration_type IN ('up', 'down')),
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_success ON schema_migrations(success) WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS idx_schema_migrations_rolled_back ON schema_migrations(rolled_back_at) WHERE rolled_back_at IS NOT NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schema_migrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_schema_migrations_updated_at_trigger ON schema_migrations;
CREATE TRIGGER update_schema_migrations_updated_at_trigger
    BEFORE UPDATE ON schema_migrations
    FOR EACH ROW
    EXECUTE FUNCTION update_schema_migrations_updated_at();

-- Create function to get migration status
CREATE OR REPLACE FUNCTION get_migration_status()
RETURNS TABLE (
    total_migrations BIGINT,
    applied_migrations BIGINT,
    failed_migrations BIGINT,
    rolled_back_migrations BIGINT,
    latest_migration VARCHAR(50),
    latest_applied_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_migrations,
        COUNT(*) FILTER (WHERE success = TRUE AND rolled_back_at IS NULL)::BIGINT as applied_migrations,
        COUNT(*) FILTER (WHERE success = FALSE)::BIGINT as failed_migrations,
        COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::BIGINT as rolled_back_migrations,
        (SELECT version FROM schema_migrations WHERE success = TRUE AND rolled_back_at IS NULL ORDER BY applied_at DESC LIMIT 1) as latest_migration,
        (SELECT applied_at FROM schema_migrations WHERE success = TRUE AND rolled_back_at IS NULL ORDER BY applied_at DESC LIMIT 1) as latest_applied_at
    FROM schema_migrations;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate migration integrity
CREATE OR REPLACE FUNCTION validate_migration_integrity()
RETURNS TABLE (
    version VARCHAR(50),
    expected_checksum VARCHAR(64),
    actual_checksum VARCHAR(64),
    is_valid BOOLEAN
) AS $$
BEGIN
    -- This function would validate migration checksums
    -- Implementation depends on specific checksum generation logic
    RETURN QUERY SELECT 
        ''::VARCHAR(50) as version, 
        ''::VARCHAR(64) as expected_checksum, 
        ''::VARCHAR(64) as actual_checksum, 
        TRUE as is_valid 
    WHERE FALSE; -- Placeholder - to be implemented
END;
$$ LANGUAGE plpgsql;

-- Create view for easy migration monitoring
CREATE OR REPLACE VIEW migration_status_view AS
SELECT 
    id,
    version,
    name,
    applied_at,
    success,
    execution_time_ms,
    CASE 
        WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
        WHEN success = TRUE THEN 'applied'
        ELSE 'failed'
    END as status,
    rolled_back_at,
    rollback_reason,
    migration_type,
    file_path
FROM schema_migrations
ORDER BY applied_at DESC;

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON TABLE schema_migrations TO trading_bot_user;
-- GRANT ALL PRIVILEGES ON SEQUENCE schema_migrations_id_seq TO trading_bot_user;

-- Insert initial migration tracking record for the base schema (DB-002)
-- This represents the state after DB-002 completion
INSERT INTO schema_migrations (
    version, 
    name, 
    checksum, 
    success, 
    execution_time_ms, 
    migration_type, 
    file_path
) VALUES (
    '000_initial_state',
    'Initial database state after DB-002 completion',
    'baseline_schema_checksum',
    TRUE,
    0,
    'up',
    'database/schema.sql'
) ON CONFLICT (version) DO NOTHING;

-- Validate the migration tracker setup
SELECT 'Migration tracking system initialized successfully' as status;
SELECT * FROM get_migration_status();