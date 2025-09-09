-- Schema Migration for Task DB-002
-- Update existing tables to match complete specification

-- Set search path
SET search_path TO trading, public;

-- ==================================================
-- UPDATE STRATEGIES TABLE
-- ==================================================
ALTER TABLE trading.strategies 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'technical' CHECK (type IN ('technical', 'fundamental', 'ml', 'hybrid')),
ADD COLUMN IF NOT EXISTS parameters JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_profile JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Update status constraint to include all required values
ALTER TABLE trading.strategies DROP CONSTRAINT IF EXISTS strategies_status_check;
ALTER TABLE trading.strategies ADD CONSTRAINT strategies_status_check 
CHECK (status IN ('active', 'inactive', 'paused', 'archived'));

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_strategies_status ON trading.strategies(status) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_strategies_type ON trading.strategies(type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_strategies_performance ON trading.strategies USING GIN(performance_metrics);

-- ==================================================
-- UPDATE MARKET_DATA TABLE STRUCTURE
-- ==================================================
ALTER TABLE trading.market_data 
ADD COLUMN IF NOT EXISTS exchange VARCHAR(20) NOT NULL DEFAULT 'dydx',
ADD COLUMN IF NOT EXISTS open DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS high DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS low DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS close DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS volume DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_volume DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS trades_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')),
ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- ==================================================
-- UPDATE TRADES TABLE STRUCTURE  
-- ==================================================
ALTER TABLE trading.trades
ADD COLUMN IF NOT EXISTS side VARCHAR(10) CHECK (side IN ('buy', 'sell', 'long', 'short')),
ADD COLUMN IF NOT EXISTS type VARCHAR(20) CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected')),
ADD COLUMN IF NOT EXISTS quantity DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS price DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS executed_price DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS executed_quantity DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_quantity DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fees DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pnl DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS take_profit DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS exchange_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ==================================================
-- UPDATE ORDERS TABLE STRUCTURE
-- ==================================================
ALTER TABLE trading.orders
ADD COLUMN IF NOT EXISTS side VARCHAR(10) CHECK (side IN ('buy', 'sell')),
ADD COLUMN IF NOT EXISTS type VARCHAR(20) CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected', 'expired')),
ADD COLUMN IF NOT EXISTS quantity DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS price DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS executed_quantity DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_quantity DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_price DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS fees DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS exchange_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES trading.orders(id),
ADD COLUMN IF NOT EXISTS time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTT')),
ADD COLUMN IF NOT EXISTS expire_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ==================================================
-- UPDATE PORTFOLIO_SNAPSHOTS TABLE
-- ==================================================
ALTER TABLE trading.portfolio_snapshots
ADD COLUMN IF NOT EXISTS total_value DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS cash_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS positions_value DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS unrealized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS drawdown DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS positions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}';

-- ==================================================
-- UPDATE SYSTEM_LOGS TABLE
-- ==================================================
ALTER TABLE trading.system_logs
ADD COLUMN IF NOT EXISTS level VARCHAR(10) CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
ADD COLUMN IF NOT EXISTS component VARCHAR(50),
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS error_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS stack_trace TEXT,
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- ==================================================
-- ADD MISSING CONSTRAINTS
-- ==================================================

-- Market data constraints
ALTER TABLE trading.market_data 
ALTER COLUMN open SET NOT NULL,
ALTER COLUMN high SET NOT NULL,
ALTER COLUMN low SET NOT NULL,
ALTER COLUMN close SET NOT NULL;

-- Trades constraints  
ALTER TABLE trading.trades 
ALTER COLUMN quantity SET NOT NULL;

-- Orders constraints
ALTER TABLE trading.orders
ALTER COLUMN quantity SET NOT NULL;

-- Portfolio snapshots constraints
ALTER TABLE trading.portfolio_snapshots
ALTER COLUMN total_value SET NOT NULL;

-- System logs constraints
ALTER TABLE trading.system_logs
ALTER COLUMN level SET NOT NULL,
ALTER COLUMN component SET NOT NULL,
ALTER COLUMN message SET NOT NULL;

-- ==================================================
-- VALIDATION QUERY
-- ==================================================
SELECT 'Schema migration completed successfully' as result;