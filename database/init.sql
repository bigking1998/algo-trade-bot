-- Database Initialization Script for Algorithmic Trading Bot
-- Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
-- Created: 2025-09-05

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

-- Install TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify TimescaleDB installation
SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'timescaledb';

-- Create basic logging table for system monitoring
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    service VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('system_logs', 'timestamp', if_not_exists => true);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_logs_level_timestamp 
ON system_logs (level, timestamp DESC);

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
               'active_connections', (SELECT count(*) FROM pg_stat_activity)
           );
           
    -- Check TimescaleDB extension
    RETURN QUERY
    SELECT 'timescaledb'::TEXT, 
           CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') 
                THEN 'healthy'::TEXT 
                ELSE 'unhealthy'::TEXT 
           END,
           jsonb_build_object(
               'extension_available', EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'),
               'version', (SELECT installed_version FROM pg_available_extensions WHERE name = 'timescaledb')
           );
END;
$$ LANGUAGE plpgsql;

-- Insert initial log entry
INSERT INTO system_logs (level, message, service, metadata)
VALUES ('INFO', 'Database initialized successfully', 'database', 
        jsonb_build_object(
            'task', 'DB-001',
            'postgresql_version', version(),
            'timescaledb_enabled', true
        ));

-- Display initialization results
SELECT 'Database initialization completed successfully' AS status;
SELECT * FROM check_database_health();