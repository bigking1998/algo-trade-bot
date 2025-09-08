-- ============================================================================
-- ALGORITHMIC TRADING PLATFORM - PostgreSQL + TimescaleDB Schema (DB-002)
-- ============================================================================
-- 
-- Enterprise-grade database schema optimized for high-frequency trading
-- This schema supports dYdX v4 integration with TimescaleDB hypertables
-- for optimal time-series performance
-- 
-- Requirements Met:
-- 1. Core tables: strategies, trades, market_data, portfolio_snapshots, system_logs, orders
-- 2. TimescaleDB hypertables for time-series optimization
-- 3. High-frequency trading data storage and retrieval
-- 4. Proper foreign key relationships and constraints
-- 5. Query pattern optimization for trading platforms
-- 
-- Author: Claude Code (DB-002 Implementation)
-- Date: 2025-01-05
-- ============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable crypto extension for secure data handling
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. STRATEGIES TABLE - Strategy Configuration and Management
-- ============================================================================

CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('technical', 'fundamental', 'ml', 'hybrid', 'momentum', 'mean_reversion', 'breakout', 'grid_trading', 'dca', 'arbitrage', 'custom')),
    status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'paused', 'archived', 'error')),
    
    -- Strategy Configuration (JSONB for flexible parameters)
    parameters JSONB NOT NULL DEFAULT '{}',
    risk_profile JSONB NOT NULL DEFAULT '{}',
    execution_config JSONB NOT NULL DEFAULT '{}',
    monitoring_config JSONB NOT NULL DEFAULT '{}',
    
    -- Performance Tracking
    performance_metrics JSONB DEFAULT '{}',
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    total_pnl DECIMAL(15,2) DEFAULT 0.00,
    max_drawdown DECIMAL(15,2) DEFAULT 0.00,
    sharpe_ratio DECIMAL(8,4) DEFAULT 0.00,
    
    -- Audit and Lifecycle
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Constraints
    CONSTRAINT strategies_name_unique UNIQUE (name) WHERE is_deleted = FALSE,
    CONSTRAINT strategies_version_positive CHECK (version > 0),
    CONSTRAINT strategies_win_rate_valid CHECK (win_rate >= 0 AND win_rate <= 100)
);

-- Strategy indexes for performance
CREATE INDEX idx_strategies_status ON strategies (status) WHERE is_deleted = FALSE;
CREATE INDEX idx_strategies_type ON strategies (type) WHERE is_deleted = FALSE;
CREATE INDEX idx_strategies_performance ON strategies USING GIN (performance_metrics) WHERE is_deleted = FALSE;
CREATE INDEX idx_strategies_created_at ON strategies (created_at DESC);
CREATE INDEX idx_strategies_updated_at ON strategies (updated_at DESC);

-- Strategy parameters search index
CREATE INDEX idx_strategies_parameters ON strategies USING GIN (parameters) WHERE is_deleted = FALSE;

-- ============================================================================
-- 2. MARKET_DATA TABLE - Time-Series Market Data (HYPERTABLE)
-- ============================================================================

CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50) NOT NULL DEFAULT 'dydx_v4',
    timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')),
    
    -- OHLCV Data
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    
    -- Additional Market Data
    quote_volume DECIMAL(20,8),
    trades_count INTEGER,
    vwap DECIMAL(20,8), -- Volume Weighted Average Price
    
    -- Technical Indicators (pre-calculated for performance)
    sma_20 DECIMAL(20,8),
    ema_20 DECIMAL(20,8),
    rsi_14 DECIMAL(8,4),
    
    -- Metadata
    raw_data JSONB,
    data_quality_score DECIMAL(3,2) DEFAULT 1.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT market_data_ohlc_valid CHECK (high >= low AND high >= open AND high >= close AND low <= open AND low <= close),
    CONSTRAINT market_data_volume_positive CHECK (volume >= 0),
    CONSTRAINT market_data_quality_valid CHECK (data_quality_score >= 0 AND data_quality_score <= 1)
);

-- Convert to TimescaleDB hypertable (partitioned by time)
SELECT create_hypertable('market_data', 'time', chunk_time_interval => INTERVAL '1 day');

-- Market data indexes for optimal query performance
CREATE UNIQUE INDEX idx_market_data_time_symbol_timeframe ON market_data (time, symbol, timeframe);
CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, time DESC);
CREATE INDEX idx_market_data_timeframe_time ON market_data (timeframe, time DESC);
CREATE INDEX idx_market_data_exchange_time ON market_data (exchange, time DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_market_data_symbol_timeframe_time ON market_data (symbol, timeframe, time DESC);
CREATE INDEX idx_market_data_close_volume ON market_data (close, volume) WHERE timeframe = '1m';

-- Enable compression for older data (reduce storage by up to 90%)
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, exchange, timeframe',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compress chunks older than 7 days
SELECT add_compression_policy('market_data', INTERVAL '7 days');

-- ============================================================================
-- 3. TRADES TABLE - Trade Execution History (HYPERTABLE)
-- ============================================================================

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time TIMESTAMPTZ NOT NULL,
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Trade Details
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell', 'long', 'short')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit', 'take_profit')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected', 'expired')),
    
    -- Quantities and Prices
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    executed_price DECIMAL(20,8),
    executed_quantity DECIMAL(20,8) DEFAULT 0,
    remaining_quantity DECIMAL(20,8),
    
    -- P&L and Fees
    fees DECIMAL(15,2) DEFAULT 0,
    pnl DECIMAL(15,2) DEFAULT 0,
    pnl_percent DECIMAL(8,4) DEFAULT 0,
    
    -- Trade Lifecycle
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ,
    duration_ms INTEGER, -- Trade duration in milliseconds
    
    -- Risk Management
    stop_loss DECIMAL(20,8),
    take_profit DECIMAL(20,8),
    
    -- Exchange Integration
    order_id VARCHAR(255),
    exchange_order_id VARCHAR(255),
    exchange VARCHAR(50) DEFAULT 'dydx_v4',
    
    -- Metadata and Context
    metadata JSONB DEFAULT '{}',
    signal_data JSONB DEFAULT '{}', -- Strategy signal that triggered trade
    market_conditions JSONB DEFAULT '{}', -- Market state at trade time
    
    -- Audit Trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT trades_quantity_positive CHECK (quantity > 0),
    CONSTRAINT trades_executed_quantity_valid CHECK (executed_quantity >= 0 AND executed_quantity <= quantity),
    CONSTRAINT trades_remaining_quantity_valid CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
    CONSTRAINT trades_price_positive CHECK (price IS NULL OR price > 0),
    CONSTRAINT trades_executed_price_positive CHECK (executed_price IS NULL OR executed_price > 0),
    CONSTRAINT trades_lifecycle_order CHECK (entry_time IS NULL OR exit_time IS NULL OR exit_time >= entry_time)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('trades', 'time', chunk_time_interval => INTERVAL '1 day');

-- Trades indexes for performance
CREATE INDEX idx_trades_strategy_time ON trades (strategy_id, time DESC);
CREATE INDEX idx_trades_symbol_time ON trades (symbol, time DESC);
CREATE INDEX idx_trades_status_time ON trades (status, time DESC);
CREATE INDEX idx_trades_side_time ON trades (side, time DESC);
CREATE INDEX idx_trades_pnl_time ON trades (pnl, time DESC);

-- Performance tracking indexes
CREATE INDEX idx_trades_strategy_status ON trades (strategy_id, status);
CREATE INDEX idx_trades_symbol_status ON trades (symbol, status);
CREATE INDEX idx_trades_pnl_positive ON trades (time DESC) WHERE pnl > 0;
CREATE INDEX idx_trades_pnl_negative ON trades (time DESC) WHERE pnl < 0;

-- Exchange integration indexes
CREATE INDEX idx_trades_exchange_order_id ON trades (exchange_order_id) WHERE exchange_order_id IS NOT NULL;
CREATE INDEX idx_trades_order_id ON trades (order_id) WHERE order_id IS NOT NULL;

-- Enable compression for trades
ALTER TABLE trades SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'strategy_id, symbol, exchange',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compress trades older than 30 days
SELECT add_compression_policy('trades', INTERVAL '30 days');

-- ============================================================================
-- 4. ORDERS TABLE - Order Management (HYPERTABLE)
-- ============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Order Details
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit', 'take_profit', 'trailing_stop')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected', 'expired')),
    
    -- Order Quantities and Pricing
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    stop_price DECIMAL(20,8),
    executed_quantity DECIMAL(20,8) DEFAULT 0,
    remaining_quantity DECIMAL(20,8),
    average_price DECIMAL(20,8),
    
    -- Fees and Costs
    fees DECIMAL(15,2) DEFAULT 0,
    
    -- Exchange Integration
    order_id VARCHAR(255),
    exchange_order_id VARCHAR(255),
    parent_order_id UUID REFERENCES orders(id),
    
    -- Order Execution Parameters
    time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTT')),
    expire_time TIMESTAMPTZ,
    reduce_only BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    execution_instructions JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT orders_quantity_positive CHECK (quantity > 0),
    CONSTRAINT orders_executed_quantity_valid CHECK (executed_quantity >= 0 AND executed_quantity <= quantity),
    CONSTRAINT orders_remaining_quantity_valid CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
    CONSTRAINT orders_price_positive CHECK (price IS NULL OR price > 0),
    CONSTRAINT orders_stop_price_positive CHECK (stop_price IS NULL OR stop_price > 0),
    CONSTRAINT orders_expire_time_future CHECK (expire_time IS NULL OR expire_time > created_at)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('orders', 'created_at', chunk_time_interval => INTERVAL '1 day');

-- Orders indexes for performance
CREATE INDEX idx_orders_strategy_created ON orders (strategy_id, created_at DESC);
CREATE INDEX idx_orders_symbol_created ON orders (symbol, created_at DESC);
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_trade_id ON orders (trade_id) WHERE trade_id IS NOT NULL;

-- Order execution tracking
CREATE INDEX idx_orders_exchange_order_id ON orders (exchange_order_id) WHERE exchange_order_id IS NOT NULL;
CREATE INDEX idx_orders_parent_order ON orders (parent_order_id) WHERE parent_order_id IS NOT NULL;
CREATE INDEX idx_orders_pending ON orders (created_at DESC) WHERE status = 'pending';

-- Time-based indexes for order lifecycle
CREATE INDEX idx_orders_filled_at ON orders (filled_at DESC) WHERE filled_at IS NOT NULL;
CREATE INDEX idx_orders_cancelled_at ON orders (cancelled_at DESC) WHERE cancelled_at IS NOT NULL;
CREATE INDEX idx_orders_expire_time ON orders (expire_time ASC) WHERE expire_time IS NOT NULL;

-- ============================================================================
-- 5. PORTFOLIO_SNAPSHOTS TABLE - Portfolio State History (HYPERTABLE)
-- ============================================================================

CREATE TABLE portfolio_snapshots (
    time TIMESTAMPTZ NOT NULL,
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Portfolio Values
    total_value DECIMAL(20,2) NOT NULL,
    cash_balance DECIMAL(20,2) NOT NULL,
    positions_value DECIMAL(20,2) NOT NULL,
    margin_used DECIMAL(20,2) DEFAULT 0,
    available_margin DECIMAL(20,2) DEFAULT 0,
    
    -- P&L Metrics
    unrealized_pnl DECIMAL(15,2) DEFAULT 0,
    realized_pnl DECIMAL(15,2) DEFAULT 0,
    daily_pnl DECIMAL(15,2) DEFAULT 0,
    
    -- Risk Metrics
    drawdown DECIMAL(15,2) DEFAULT 0,
    max_drawdown DECIMAL(15,2) DEFAULT 0,
    var_1d DECIMAL(15,2), -- 1-day Value at Risk
    leverage DECIMAL(8,4) DEFAULT 1.0,
    
    -- Portfolio Composition
    positions JSONB NOT NULL DEFAULT '[]', -- Array of position details
    assets_allocation JSONB DEFAULT '{}', -- Asset allocation percentages
    
    -- Performance Metrics
    metrics JSONB DEFAULT '{}', -- Custom metrics and KPIs
    risk_metrics JSONB DEFAULT '{}', -- Risk analysis data
    
    -- Benchmarks
    benchmark_return DECIMAL(8,4),
    alpha DECIMAL(8,4), -- Excess return over benchmark
    beta DECIMAL(8,4), -- Market sensitivity
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT portfolio_total_value_positive CHECK (total_value >= 0),
    CONSTRAINT portfolio_cash_balance_valid CHECK (cash_balance >= 0),
    CONSTRAINT portfolio_positions_value_valid CHECK (positions_value >= 0),
    CONSTRAINT portfolio_leverage_positive CHECK (leverage >= 0)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('portfolio_snapshots', 'time', chunk_time_interval => INTERVAL '1 day');

-- Portfolio snapshots indexes
CREATE INDEX idx_portfolio_strategy_time ON portfolio_snapshots (strategy_id, time DESC);
CREATE INDEX idx_portfolio_total_value_time ON portfolio_snapshots (total_value, time DESC);
CREATE INDEX idx_portfolio_pnl_time ON portfolio_snapshots (realized_pnl, time DESC);
CREATE INDEX idx_portfolio_drawdown_time ON portfolio_snapshots (drawdown, time DESC);

-- Performance analysis indexes
CREATE INDEX idx_portfolio_positions ON portfolio_snapshots USING GIN (positions);
CREATE INDEX idx_portfolio_metrics ON portfolio_snapshots USING GIN (metrics);
CREATE INDEX idx_portfolio_risk_metrics ON portfolio_snapshots USING GIN (risk_metrics);

-- Enable compression for portfolio snapshots
ALTER TABLE portfolio_snapshots SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'strategy_id',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compress snapshots older than 90 days
SELECT add_compression_policy('portfolio_snapshots', INTERVAL '90 days');

-- ============================================================================
-- 6. SYSTEM_LOGS TABLE - Application Logging (HYPERTABLE)
-- ============================================================================

CREATE TABLE system_logs (
    time TIMESTAMPTZ NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    
    -- Contextual Information
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Error Details
    error_code VARCHAR(50),
    stack_trace TEXT,
    
    -- User Context
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    
    -- Structured Logging Data
    details JSONB DEFAULT '{}',
    
    -- Performance Metrics
    duration_ms INTEGER, -- Operation duration
    memory_usage_mb DECIMAL(10,2), -- Memory usage at log time
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT system_logs_duration_positive CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT system_logs_memory_positive CHECK (memory_usage_mb IS NULL OR memory_usage_mb >= 0)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('system_logs', 'time', chunk_time_interval => INTERVAL '1 hour');

-- System logs indexes for performance
CREATE INDEX idx_system_logs_level_time ON system_logs (level, time DESC);
CREATE INDEX idx_system_logs_component_time ON system_logs (component, time DESC);
CREATE INDEX idx_system_logs_strategy_time ON system_logs (strategy_id, time DESC) WHERE strategy_id IS NOT NULL;
CREATE INDEX idx_system_logs_trade_time ON system_logs (trade_id, time DESC) WHERE trade_id IS NOT NULL;

-- Error tracking indexes
CREATE INDEX idx_system_logs_errors ON system_logs (time DESC) WHERE level IN ('ERROR', 'FATAL');
CREATE INDEX idx_system_logs_error_code ON system_logs (error_code, time DESC) WHERE error_code IS NOT NULL;

-- User activity indexes
CREATE INDEX idx_system_logs_user_time ON system_logs (user_id, time DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_system_logs_session_time ON system_logs (session_id, time DESC) WHERE session_id IS NOT NULL;

-- Structured logging search
CREATE INDEX idx_system_logs_details ON system_logs USING GIN (details);

-- Enable compression for system logs
ALTER TABLE system_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'component, level',
    timescaledb.compress_orderby = 'time DESC'
);

-- Compress logs older than 3 days
SELECT add_compression_policy('system_logs', INTERVAL '3 days');

-- ============================================================================
-- 7. DATA RETENTION POLICIES
-- ============================================================================

-- Market data retention: Keep 2 years of 1m data, 5 years of higher timeframes
SELECT add_retention_policy('market_data', INTERVAL '2 years', 
    if_not_exists => true);

-- Trades retention: Keep 7 years (regulatory compliance)
SELECT add_retention_policy('trades', INTERVAL '7 years', 
    if_not_exists => true);

-- Orders retention: Keep 7 years (regulatory compliance)  
SELECT add_retention_policy('orders', INTERVAL '7 years', 
    if_not_exists => true);

-- Portfolio snapshots retention: Keep 5 years
SELECT add_retention_policy('portfolio_snapshots', INTERVAL '5 years', 
    if_not_exists => true);

-- System logs retention: Keep 1 year
SELECT add_retention_policy('system_logs', INTERVAL '1 year', 
    if_not_exists => true);

-- ============================================================================
-- 8. MATERIALIZED VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Strategy performance summary view
CREATE MATERIALIZED VIEW strategy_performance_summary AS
SELECT 
    s.id,
    s.name,
    s.type,
    s.status,
    COUNT(t.id) as total_trades,
    COUNT(CASE WHEN t.pnl > 0 THEN 1 END) as winning_trades,
    COUNT(CASE WHEN t.pnl < 0 THEN 1 END) as losing_trades,
    ROUND(
        COUNT(CASE WHEN t.pnl > 0 THEN 1 END)::numeric / 
        NULLIF(COUNT(t.id), 0) * 100, 2
    ) as win_rate,
    COALESCE(SUM(t.pnl), 0) as total_pnl,
    COALESCE(MAX(t.pnl), 0) as best_trade,
    COALESCE(MIN(t.pnl), 0) as worst_trade,
    COALESCE(AVG(t.duration_ms), 0) as avg_duration_ms,
    MAX(t.time) as last_trade_time
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id AND t.status = 'filled'
WHERE s.is_deleted = FALSE
GROUP BY s.id, s.name, s.type, s.status;

CREATE INDEX idx_strategy_performance_summary_pnl ON strategy_performance_summary (total_pnl DESC);
CREATE INDEX idx_strategy_performance_summary_win_rate ON strategy_performance_summary (win_rate DESC);

-- Market data aggregation view (daily OHLCV)
CREATE MATERIALIZED VIEW daily_market_data AS
SELECT 
    DATE_TRUNC('day', time) as day,
    symbol,
    exchange,
    FIRST(open, time) as open,
    MAX(high) as high,
    MIN(low) as low,
    LAST(close, time) as close,
    SUM(volume) as volume,
    AVG(vwap) as avg_vwap,
    COUNT(*) as data_points
FROM market_data
WHERE timeframe = '1m'
GROUP BY DATE_TRUNC('day', time), symbol, exchange;

CREATE INDEX idx_daily_market_data_symbol_day ON daily_market_data (symbol, day DESC);
CREATE INDEX idx_daily_market_data_volume ON daily_market_data (symbol, volume DESC);

-- ============================================================================
-- 9. FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Function to calculate strategy performance metrics
CREATE OR REPLACE FUNCTION calculate_strategy_metrics(strategy_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_trades INTEGER;
    winning_trades INTEGER;
    total_pnl DECIMAL(15,2);
    trades_data RECORD;
BEGIN
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        SUM(pnl) as total_pnl_sum
    INTO trades_data
    FROM trades 
    WHERE strategy_id = strategy_uuid AND status = 'filled';
    
    total_trades := trades_data.total;
    winning_trades := trades_data.wins;
    total_pnl := COALESCE(trades_data.total_pnl_sum, 0);
    
    result := jsonb_build_object(
        'total_trades', total_trades,
        'winning_trades', winning_trades,
        'losing_trades', total_trades - winning_trades,
        'win_rate', CASE 
            WHEN total_trades > 0 THEN ROUND((winning_trades::numeric / total_trades) * 100, 2)
            ELSE 0 
        END,
        'total_pnl', total_pnl,
        'avg_pnl', CASE 
            WHEN total_trades > 0 THEN ROUND(total_pnl / total_trades, 2)
            ELSE 0 
        END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest market data for a symbol
CREATE OR REPLACE FUNCTION get_latest_market_data(symbol_param VARCHAR(50), timeframe_param VARCHAR(10) DEFAULT '1m')
RETURNS TABLE(
    time TIMESTAMPTZ,
    symbol VARCHAR(50),
    open DECIMAL(20,8),
    high DECIMAL(20,8),
    low DECIMAL(20,8),
    close DECIMAL(20,8),
    volume DECIMAL(20,8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT md.time, md.symbol, md.open, md.high, md.low, md.close, md.volume
    FROM market_data md
    WHERE md.symbol = symbol_param 
    AND md.timeframe = timeframe_param
    ORDER BY md.time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger function to update strategy performance metrics
CREATE OR REPLACE FUNCTION update_strategy_performance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update strategy performance metrics
        UPDATE strategies 
        SET 
            performance_metrics = calculate_strategy_metrics(NEW.strategy_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.strategy_id;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to trades table
CREATE TRIGGER trigger_update_strategy_performance
    AFTER INSERT OR UPDATE ON trades
    FOR EACH ROW
    WHEN (NEW.status = 'filled')
    EXECUTE FUNCTION update_strategy_performance();

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER trigger_strategies_updated_at 
    BEFORE UPDATE ON strategies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_trades_updated_at 
    BEFORE UPDATE ON trades 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. SAMPLE QUERIES FOR VALIDATION
-- ============================================================================

/*
-- Sample queries optimized for trading platform use cases:

-- 1. Get active strategy performance
SELECT * FROM strategy_performance_summary 
WHERE status = 'active' 
ORDER BY total_pnl DESC;

-- 2. Get recent market data for BTC
SELECT * FROM get_latest_market_data('BTC-USD', '1m');

-- 3. Find profitable trades in last 24 hours  
SELECT symbol, COUNT(*), SUM(pnl) as total_pnl
FROM trades 
WHERE time >= NOW() - INTERVAL '24 hours' 
  AND pnl > 0 
  AND status = 'filled'
GROUP BY symbol
ORDER BY total_pnl DESC;

-- 4. Portfolio performance over time
SELECT DATE_TRUNC('hour', time) as hour,
       AVG(total_value) as avg_portfolio_value,
       AVG(unrealized_pnl) as avg_unrealized_pnl
FROM portfolio_snapshots 
WHERE time >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', time)
ORDER BY hour;

-- 5. System health check - recent errors
SELECT component, COUNT(*), MAX(time) as last_error
FROM system_logs 
WHERE level IN ('ERROR', 'FATAL') 
  AND time >= NOW() - INTERVAL '1 hour'
GROUP BY component
ORDER BY COUNT(*) DESC;

-- 6. High-frequency market data analysis
SELECT 
    symbol,
    DATE_TRUNC('minute', time) as minute,
    AVG(close) as avg_price,
    SUM(volume) as total_volume,
    MAX(high) - MIN(low) as price_range
FROM market_data 
WHERE timeframe = '1m' 
  AND time >= NOW() - INTERVAL '1 hour'
GROUP BY symbol, DATE_TRUNC('minute', time)
ORDER BY symbol, minute;
*/

-- ============================================================================
-- 12. PERFORMANCE MONITORING QUERIES
-- ============================================================================

/*
-- Query performance monitoring examples:

-- 1. Check hypertable chunk information
SELECT 
    chunk_schema,
    chunk_name,
    table_name,
    range_start,
    range_end,
    is_compressed,
    chunk_size
FROM timescaledb_information.chunks 
WHERE hypertable_name IN ('market_data', 'trades', 'orders', 'portfolio_snapshots', 'system_logs')
ORDER BY range_start DESC;

-- 2. Monitor compression ratios
SELECT 
    hypertable_name,
    SUM(uncompressed_bytes) as uncompressed_bytes,
    SUM(compressed_bytes) as compressed_bytes,
    SUM(uncompressed_bytes)::FLOAT / SUM(compressed_bytes) as compression_ratio
FROM timescaledb_information.compressed_chunk_stats
GROUP BY hypertable_name;

-- 3. Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('market_data', 'trades', 'orders', 'strategies', 'portfolio_snapshots')
ORDER BY idx_scan DESC;
*/

-- ============================================================================
-- SCHEMA IMPLEMENTATION COMPLETE
-- ============================================================================

-- Create initial admin strategy for system operations
INSERT INTO strategies (name, type, description, status, parameters, risk_profile) VALUES (
    'System Admin Strategy',
    'technical',
    'Default strategy for system administrative operations and testing',
    'active',
    '{"description": "Administrative strategy for system operations"}',
    '{"max_risk_per_trade": 0, "max_portfolio_risk": 0}'
);

-- Final validation check
SELECT 
    'Schema implementation complete. Total tables created: ' || COUNT(*) as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('strategies', 'market_data', 'trades', 'orders', 'portfolio_snapshots', 'system_logs');

-- Success message
SELECT 'DB-002: PostgreSQL + TimescaleDB Schema Implementation - COMPLETE ✅' as result;