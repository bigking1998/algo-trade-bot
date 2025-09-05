-- Database Initialization Script for Algorithmic Trading Bot (Basic Setup)
-- Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
-- Created: 2025-09-05
-- This script sets up the basic database without TimescaleDB initially

-- Create database user for the trading bot
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'algo_trader') THEN
      CREATE ROLE algo_trader WITH LOGIN PASSWORD 'secure_trading_password_2025';
   END IF;
END
$do$;

-- Create the main database
SELECT 'CREATE DATABASE algo_trading_bot OWNER algo_trader'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'algo_trading_bot')\gexec

-- Connect to the new database
\c algo_trading_bot;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE algo_trading_bot TO algo_trader;
GRANT ALL ON SCHEMA public TO algo_trader;

-- Create extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create basic logging table for system monitoring
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    service VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_logs_level_timestamp 
ON system_logs (level, timestamp DESC);

-- Create index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp 
ON system_logs (timestamp DESC);

-- Create health check function
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(component TEXT, status TEXT, details JSONB) AS $$
BEGIN
    -- Check basic connectivity
    RETURN QUERY
    SELECT 'database'::TEXT, 'healthy'::TEXT, 
           jsonb_build_object(
               'version', version(),
               'current_time', NOW(),
               'active_connections', (SELECT count(*) FROM pg_stat_activity),
               'database_size', pg_size_pretty(pg_database_size(current_database()))
           );
           
    -- Check if we can write to the database
    BEGIN
        INSERT INTO system_logs (level, message, service) 
        VALUES ('DEBUG', 'Health check test', 'health_check');
        
        RETURN QUERY
        SELECT 'write_access'::TEXT, 'healthy'::TEXT,
               jsonb_build_object('test_write', true, 'timestamp', NOW());
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY
        SELECT 'write_access'::TEXT, 'unhealthy'::TEXT,
               jsonb_build_object('error', SQLERRM, 'test_write', false);
    END;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE(
    table_name TEXT, 
    row_count BIGINT, 
    table_size TEXT, 
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins - n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert initial log entry
INSERT INTO system_logs (level, message, service, metadata)
VALUES ('INFO', 'Database initialized successfully (basic setup)', 'database', 
        jsonb_build_object(
            'task', 'DB-001',
            'postgresql_version', version(),
            'timescaledb_enabled', false,
            'setup_type', 'basic'
        ));

-- Display initialization results
SELECT 'Basic database initialization completed successfully' AS status;
SELECT * FROM check_database_health();