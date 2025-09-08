-- ============================================================================
-- Schema Migrations Table
-- Tracks database schema versions and migration history
-- ============================================================================

-- Create schema_migrations table for version control
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(10) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    execution_time_ms INTEGER,
    applied_by VARCHAR(255) DEFAULT CURRENT_USER,
    rollback_sql TEXT,
    checksum VARCHAR(64),
    
    CONSTRAINT schema_migrations_version_format CHECK (version ~ '^[0-9]{3}$'),
    CONSTRAINT schema_migrations_completed_after_applied CHECK (
        completed_at IS NULL OR completed_at >= applied_at
    )
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status, applied_at);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);

-- Function to get current schema version
CREATE OR REPLACE FUNCTION get_current_schema_version()
RETURNS VARCHAR(10) AS $$
BEGIN
    RETURN (
        SELECT version 
        FROM schema_migrations 
        WHERE status = 'completed' 
        ORDER BY version DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- Function to validate schema integrity
CREATE OR REPLACE FUNCTION validate_schema_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check required tables exist
    RETURN QUERY
    SELECT 
        'required_tables'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 6 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        FORMAT('Found %s/6 required tables', COUNT(*))::TEXT as details
    FROM information_schema.tables 
    WHERE table_name IN ('strategies', 'market_data', 'trades', 'orders', 'portfolio_snapshots', 'system_logs')
    AND table_schema = 'public';
    
    -- Check hypertables are configured
    RETURN QUERY
    SELECT 
        'hypertables'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) >= 5 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT  
        END as status,
        FORMAT('Found %s hypertables configured', COUNT(*))::TEXT as details
    FROM timescaledb_information.hypertables;
    
    -- Check indexes are created
    RETURN QUERY
    SELECT 
        'indexes'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) >= 25 THEN 'PASS'::TEXT
            ELSE 'WARN'::TEXT
        END as status,
        FORMAT('Found %s indexes created', COUNT(*))::TEXT as details
    FROM pg_indexes 
    WHERE tablename IN ('strategies', 'market_data', 'trades', 'orders', 'portfolio_snapshots', 'system_logs');
    
END;
$$ LANGUAGE plpgsql;