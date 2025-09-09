-- Trading Bot Database Schema (Task DB-002) - Without TimescaleDB
-- Complete schema creation - will be converted to TimescaleDB hypertables later
-- PostgreSQL 15+ compatible version

-- Create database schema for trading platform
CREATE SCHEMA IF NOT EXISTS trading;
SET search_path TO trading, public;

-- ==================================================
-- STRATEGIES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS trading.strategies (
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
CREATE INDEX IF NOT EXISTS idx_strategies_status ON trading.strategies(status) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_strategies_type ON trading.strategies(type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_strategies_created_at ON trading.strategies(created_at);
CREATE INDEX IF NOT EXISTS idx_strategies_performance ON trading.strategies USING GIN(performance_metrics);

-- ==================================================
-- MARKET_DATA TABLE (Regular table - can be converted to hypertable later)
-- ==================================================
CREATE TABLE IF NOT EXISTS trading.market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes for market_data (optimized for time-series queries)
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time ON trading.market_data(symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_timeframe_time ON trading.market_data(timeframe, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timeframe ON trading.market_data(symbol, timeframe, time DESC);

-- ==================================================
-- TRADES TABLE (Regular table - can be converted to hypertable later)
-- ==================================================
CREATE TABLE IF NOT EXISTS trading.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    strategy_id UUID NOT NULL REFERENCES trading.strategies(id),
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

-- Indexes for trades
CREATE INDEX IF NOT EXISTS idx_trades_strategy_time ON trading.trades(strategy_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol_time ON trading.trades(symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trading.trades(status, time DESC) WHERE status IN ('pending', 'partial');
CREATE INDEX IF NOT EXISTS idx_trades_open_positions ON trading.trades(strategy_id, symbol) WHERE status IN ('filled', 'partial') AND exit_time IS NULL;

-- ==================================================
-- ORDERS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS trading.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trading.trades(id),
    strategy_id UUID NOT NULL REFERENCES trading.strategies(id),
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
    parent_order_id UUID REFERENCES trading.orders(id),
    time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTT')),
    expire_time TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_strategy_status ON trading.orders(strategy_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_symbol_status ON trading.orders(symbol, status);
CREATE INDEX IF NOT EXISTS idx_orders_trade_id ON trading.orders(trade_id);
CREATE INDEX IF NOT EXISTS idx_orders_parent_order ON trading.orders(parent_order_id) WHERE parent_order_id IS NOT NULL;

-- ==================================================
-- PORTFOLIO_SNAPSHOTS TABLE (Regular table - can be converted to hypertable later)
-- ==================================================
CREATE TABLE IF NOT EXISTS trading.portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    strategy_id UUID REFERENCES trading.strategies(id),
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

-- Indexes for portfolio_snapshots
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_strategy_time ON trading.portfolio_snapshots(strategy_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_time ON trading.portfolio_snapshots(time DESC);

-- ==================================================
-- SYSTEM_LOGS TABLE (Regular table - can be converted to hypertable later)
-- ==================================================
CREATE TABLE IF NOT EXISTS trading.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    component VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    strategy_id UUID REFERENCES trading.strategies(id),
    trade_id UUID REFERENCES trading.trades(id),
    error_code VARCHAR(50),
    stack_trace TEXT,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for system_logs
CREATE INDEX IF NOT EXISTS idx_system_logs_level_time ON trading.system_logs(level, time DESC) WHERE level IN ('ERROR', 'FATAL');
CREATE INDEX IF NOT EXISTS idx_system_logs_component_time ON trading.system_logs(component, time DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_strategy_time ON trading.system_logs(strategy_id, time DESC) WHERE strategy_id IS NOT NULL;

-- ==================================================
-- TRIGGERS FOR UPDATED_AT
-- ==================================================
CREATE OR REPLACE FUNCTION trading.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_strategies_updated_at ON trading.strategies;
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON trading.strategies FOR EACH ROW EXECUTE FUNCTION trading.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trades_updated_at ON trading.trades;
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trading.trades FOR EACH ROW EXECUTE FUNCTION trading.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON trading.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON trading.orders FOR EACH ROW EXECUTE FUNCTION trading.update_updated_at_column();

-- ==================================================
-- DATA VALIDATION FUNCTIONS
-- ==================================================
CREATE OR REPLACE FUNCTION trading.validate_trade_quantities()
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

DROP TRIGGER IF EXISTS validate_trade_quantities_trigger ON trading.trades;
CREATE TRIGGER validate_trade_quantities_trigger
    BEFORE INSERT OR UPDATE ON trading.trades
    FOR EACH ROW EXECUTE FUNCTION trading.validate_trade_quantities();

-- ==================================================
-- SAMPLE DATA FOR TESTING
-- ==================================================
INSERT INTO trading.strategies (name, description, type, status, parameters) VALUES 
('EMA Cross Strategy', 'Simple EMA crossover strategy for trending markets', 'technical', 'inactive', '{"ema_fast": 20, "ema_slow": 50}'),
('RSI Mean Reversion', 'RSI-based mean reversion strategy', 'technical', 'inactive', '{"rsi_period": 14, "oversold": 30, "overbought": 70}'),
('ML Price Prediction', 'Machine learning based price prediction model', 'ml', 'inactive', '{"model_type": "lstm", "lookback_period": 60}')
ON CONFLICT (name) DO NOTHING;

-- ==================================================
-- SCHEMA VALIDATION QUERIES
-- ==================================================
-- Verify tables
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'trading';

-- Verify indexes
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'trading';

-- Verify constraints
SELECT conname, contype, conrelid::regclass FROM pg_constraint WHERE connamespace = 'trading'::regnamespace;