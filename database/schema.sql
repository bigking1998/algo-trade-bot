-- Trading Bot Database Schema (Task DB-002)
-- Complete schema creation with TimescaleDB hypertables
-- PostgreSQL 15+ with TimescaleDB extension required

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create database schema for trading platform
CREATE SCHEMA IF NOT EXISTS trading;
SET search_path TO trading, public;

-- ==================================================
-- STRATEGIES TABLE
-- ==================================================
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('technical', 'fundamental', 'ml', 'hybrid')),
    status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'paused', 'archived')),
    parameters JSONB NOT NULL DEFAULT '{}',
    risk_profile JSONB NOT NULL DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for strategies
CREATE INDEX idx_strategies_status ON strategies(status) WHERE NOT is_deleted;
CREATE INDEX idx_strategies_type ON strategies(type) WHERE NOT is_deleted;
CREATE INDEX idx_strategies_created_at ON strategies(created_at);
CREATE INDEX idx_strategies_performance ON strategies USING GIN(performance_metrics);

-- ==================================================
-- MARKET_DATA TABLE (TimescaleDB Hypertable)
-- ==================================================
CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(20) NOT NULL DEFAULT 'dydx',
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL DEFAULT 0,
    quote_volume DECIMAL(20,8) DEFAULT 0,
    trades_count INTEGER DEFAULT 0,
    timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')),
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('market_data', 'time', chunk_time_interval => INTERVAL '1 day');

-- Indexes for market_data (optimized for time-series queries)
CREATE INDEX idx_market_data_symbol_time ON market_data(symbol, time DESC);
CREATE INDEX idx_market_data_timeframe_time ON market_data(timeframe, time DESC);
CREATE INDEX idx_market_data_symbol_timeframe ON market_data(symbol, timeframe, time DESC);

-- ==================================================
-- TRADES TABLE (TimescaleDB Hypertable)
-- ==================================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell', 'long', 'short')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    executed_price DECIMAL(20,8),
    executed_quantity DECIMAL(20,8) DEFAULT 0,
    remaining_quantity DECIMAL(20,8) DEFAULT 0,
    fees DECIMAL(20,8) DEFAULT 0,
    pnl DECIMAL(20,8) DEFAULT 0,
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ,
    stop_loss DECIMAL(20,8),
    take_profit DECIMAL(20,8),
    order_id VARCHAR(255),
    exchange_order_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('trades', 'time', chunk_time_interval => INTERVAL '7 days');

-- Indexes for trades
CREATE INDEX idx_trades_strategy_time ON trades(strategy_id, time DESC);
CREATE INDEX idx_trades_symbol_time ON trades(symbol, time DESC);
CREATE INDEX idx_trades_status ON trades(status, time DESC) WHERE status IN ('pending', 'partial');
CREATE INDEX idx_trades_open_positions ON trades(strategy_id, symbol) WHERE status IN ('filled', 'partial') AND exit_time IS NULL;

-- ==================================================
-- ORDERS TABLE
-- ==================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trades(id),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected', 'expired')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    executed_quantity DECIMAL(20,8) DEFAULT 0,
    remaining_quantity DECIMAL(20,8) DEFAULT 0,
    average_price DECIMAL(20,8),
    fees DECIMAL(20,8) DEFAULT 0,
    order_id VARCHAR(255) UNIQUE,
    exchange_order_id VARCHAR(255),
    parent_order_id UUID REFERENCES orders(id),
    time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTT')),
    expire_time TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX idx_orders_strategy_status ON orders(strategy_id, status);
CREATE INDEX idx_orders_symbol_status ON orders(symbol, status);
CREATE INDEX idx_orders_trade_id ON orders(trade_id);
CREATE INDEX idx_orders_parent_order ON orders(parent_order_id) WHERE parent_order_id IS NOT NULL;

-- ==================================================
-- PORTFOLIO_SNAPSHOTS TABLE (TimescaleDB Hypertable)
-- ==================================================
CREATE TABLE portfolio_snapshots (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    strategy_id UUID REFERENCES strategies(id),
    total_value DECIMAL(20,8) NOT NULL,
    cash_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    positions_value DECIMAL(20,8) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    drawdown DECIMAL(10,4) DEFAULT 0,
    positions JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('portfolio_snapshots', 'time', chunk_time_interval => INTERVAL '1 day');

-- Indexes for portfolio_snapshots
CREATE INDEX idx_portfolio_snapshots_strategy_time ON portfolio_snapshots(strategy_id, time DESC);
CREATE INDEX idx_portfolio_snapshots_time ON portfolio_snapshots(time DESC);

-- ==================================================
-- SYSTEM_LOGS TABLE (TimescaleDB Hypertable)
-- ==================================================
CREATE TABLE system_logs (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    component VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    strategy_id UUID REFERENCES strategies(id),
    trade_id UUID REFERENCES trades(id),
    error_code VARCHAR(50),
    stack_trace TEXT,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('system_logs', 'time', chunk_time_interval => INTERVAL '1 day');

-- Indexes for system_logs
CREATE INDEX idx_system_logs_level_time ON system_logs(level, time DESC) WHERE level IN ('ERROR', 'FATAL');
CREATE INDEX idx_system_logs_component_time ON system_logs(component, time DESC);
CREATE INDEX idx_system_logs_strategy_time ON system_logs(strategy_id, time DESC) WHERE strategy_id IS NOT NULL;

-- ==================================================
-- TRIGGERS FOR UPDATED_AT
-- ==================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================================================
-- DATA VALIDATION FUNCTIONS
-- ==================================================
CREATE OR REPLACE FUNCTION validate_trade_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate quantities are positive
    IF NEW.quantity <= 0 THEN
        RAISE EXCEPTION 'Trade quantity must be positive';
    END IF;
    
    -- Validate executed_quantity doesn't exceed quantity
    IF NEW.executed_quantity > NEW.quantity THEN
        RAISE EXCEPTION 'Executed quantity cannot exceed order quantity';
    END IF;
    
    -- Calculate remaining quantity
    NEW.remaining_quantity = NEW.quantity - NEW.executed_quantity;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_trade_quantities_trigger
    BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION validate_trade_quantities();

-- ==================================================
-- PERFORMANCE OPTIMIZATION
-- ==================================================

-- Compression for old market data (TimescaleDB feature)
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, timeframe',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compression for old portfolio snapshots
ALTER TABLE portfolio_snapshots SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'strategy_id',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compression for old system logs
ALTER TABLE system_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'component, level',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compression policy (compress chunks older than 7 days)
SELECT add_compression_policy('market_data', INTERVAL '7 days');
SELECT add_compression_policy('portfolio_snapshots', INTERVAL '7 days');
SELECT add_compression_policy('system_logs', INTERVAL '7 days');

-- Retention policy (drop chunks older than 1 year for logs)
SELECT add_retention_policy('system_logs', INTERVAL '1 year');

-- ==================================================
-- SAMPLE DATA FOR TESTING
-- ==================================================
INSERT INTO strategies (name, description, type, status, parameters) VALUES 
('EMA Cross Strategy', 'Simple EMA crossover strategy for trending markets', 'technical', 'inactive', '{"ema_fast": 20, "ema_slow": 50}'),
('RSI Mean Reversion', 'RSI-based mean reversion strategy', 'technical', 'inactive', '{"rsi_period": 14, "oversold": 30, "overbought": 70}'),
('ML Price Prediction', 'Machine learning based price prediction model', 'ml', 'inactive', '{"model_type": "lstm", "lookback_period": 60}');

-- ==================================================
-- SCHEMA VALIDATION QUERIES
-- ==================================================
-- Verify hypertables were created
SELECT hypertable_name, num_chunks FROM timescaledb_information.hypertables;

-- Verify indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'trading';

-- Verify constraints
SELECT conname, contype, conrelid::regclass FROM pg_constraint WHERE connamespace = 'trading'::regnamespace;

-- ==================================================
-- COMPLETION SUMMARY
-- ==================================================
-- Schema includes:
-- ✅ strategies - Strategy configuration and metadata
-- ✅ market_data - Time-series market data with TimescaleDB optimization
-- ✅ trades - Trading execution records with P&L tracking
-- ✅ orders - Order management with parent-child relationships
-- ✅ portfolio_snapshots - Portfolio performance over time
-- ✅ system_logs - Comprehensive system logging
-- ✅ Optimized indexes for query patterns
-- ✅ Data validation constraints and triggers
-- ✅ TimescaleDB compression and retention policies
-- ✅ Foreign key relationships for referential integrity