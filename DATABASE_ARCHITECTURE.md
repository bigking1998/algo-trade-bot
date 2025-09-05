# Database Architecture & Data Persistence Layer
## Production-Ready Trading Data Management

*Optimized for High-Frequency Trading Data & Analytics*

---

## Overview

This document outlines the complete database architecture for our algorithmic trading platform. The design prioritizes performance, scalability, and data integrity while supporting real-time trading operations and comprehensive historical analysis.

## Database Technology Selection

### Primary Database: PostgreSQL
**Rationale:**
- ACID compliance for trading data integrity
- Advanced indexing (B-tree, Hash, GIN, GiST)
- JSON/JSONB support for flexible configuration storage
- Time-series optimizations with partitioning
- Concurrent read/write performance
- Mature ecosystem and tooling

### Cache Layer: Redis
**Purpose:**
- Real-time market data caching
- Strategy state management
- Session management
- Rate limiting and throttling
- Pub/sub for real-time notifications

### Time-Series Data: TimescaleDB Extension
**Benefits:**
- Automatic partitioning by time
- Optimized for time-series queries
- Compression for historical data
- Continuous aggregates for analytics
- Native PostgreSQL compatibility

---

## Database Schema Design

### 1. Core Trading Tables

```sql
-- ============================================================================
-- STRATEGIES TABLE
-- ============================================================================
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    author VARCHAR(100),
    
    -- Strategy Configuration (JSONB for flexibility)
    config JSONB NOT NULL,
    
    -- Strategy Metadata
    timeframe VARCHAR(5) NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d')),
    symbols TEXT[] NOT NULL,
    
    -- Status & Control
    is_active BOOLEAN DEFAULT FALSE,
    is_paper_trading BOOLEAN DEFAULT TRUE,
    
    -- Performance Tracking
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    total_pnl DECIMAL(18, 8) DEFAULT 0,
    max_drawdown DECIMAL(8, 4) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_config CHECK (jsonb_typeof(config) = 'object'),
    CONSTRAINT valid_symbols CHECK (array_length(symbols, 1) > 0)
);

-- Indexes for strategies
CREATE INDEX idx_strategies_active ON strategies (is_active, is_paper_trading);
CREATE INDEX idx_strategies_symbols ON strategies USING GIN (symbols);
CREATE INDEX idx_strategies_timeframe ON strategies (timeframe);
CREATE INDEX idx_strategies_performance ON strategies (total_pnl DESC, max_drawdown ASC);

-- ============================================================================
-- TRADES TABLE (Core trading records)
-- ============================================================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Trade Identification
    external_order_id VARCHAR(100), -- Exchange order ID
    symbol VARCHAR(20) NOT NULL,
    
    -- Trade Details
    side VARCHAR(5) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type VARCHAR(20) DEFAULT 'MARKET' CHECK (type IN ('MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT')),
    
    -- Pricing & Quantity
    entry_price DECIMAL(18, 8) NOT NULL,
    exit_price DECIMAL(18, 8),
    quantity DECIMAL(18, 8) NOT NULL CHECK (quantity > 0),
    filled_quantity DECIMAL(18, 8) DEFAULT 0,
    
    -- Timing
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMP WITH TIME ZONE,
    
    -- P&L Calculations
    pnl DECIMAL(18, 8),
    pnl_percent DECIMAL(8, 4),
    fees DECIMAL(18, 8) DEFAULT 0,
    
    -- Trade Management
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED', 'PARTIALLY_FILLED')),
    exit_reason VARCHAR(50), -- 'TAKE_PROFIT', 'STOP_LOSS', 'TIME_EXIT', 'MANUAL', 'SIGNAL'
    
    -- Signal Context
    entry_signal JSONB,
    exit_signal JSONB,
    entry_tag VARCHAR(100),
    exit_tag VARCHAR(100),
    
    -- Risk Management
    stop_loss_price DECIMAL(18, 8),
    take_profit_price DECIMAL(18, 8),
    
    -- Additional Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trades (optimized for common queries)
CREATE INDEX idx_trades_strategy_symbol ON trades (strategy_id, symbol);
CREATE INDEX idx_trades_symbol_time ON trades (symbol, entry_time DESC);
CREATE INDEX idx_trades_status ON trades (status) WHERE status IN ('OPEN', 'PARTIALLY_FILLED');
CREATE INDEX idx_trades_pnl ON trades (pnl DESC) WHERE pnl IS NOT NULL;
CREATE INDEX idx_trades_entry_time ON trades (entry_time DESC);
CREATE INDEX idx_trades_strategy_performance ON trades (strategy_id, pnl) WHERE pnl IS NOT NULL;

-- Partial index for active trades (hot data)
CREATE INDEX idx_trades_active ON trades (symbol, entry_time) 
WHERE status IN ('OPEN', 'PARTIALLY_FILLED');

-- ============================================================================
-- MARKET DATA TABLE (Time-Series Optimized)
-- ============================================================================
CREATE TABLE market_data (
    id BIGSERIAL,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(5) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- OHLCV Data
    open DECIMAL(18, 8) NOT NULL,
    high DECIMAL(18, 8) NOT NULL,
    low DECIMAL(18, 8) NOT NULL,
    close DECIMAL(18, 8) NOT NULL,
    volume DECIMAL(18, 8) NOT NULL,
    
    -- Additional Market Data
    trades_count INTEGER,
    vwap DECIMAL(18, 8), -- Volume Weighted Average Price
    
    -- Data Quality
    data_source VARCHAR(20) DEFAULT 'dydx',
    data_quality_score SMALLINT DEFAULT 100 CHECK (data_quality_score BETWEEN 0 AND 100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_ohlc CHECK (high >= low AND high >= open AND high >= close AND low <= open AND low <= close),
    CONSTRAINT valid_volume CHECK (volume >= 0),
    
    PRIMARY KEY (symbol, timeframe, timestamp)
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('market_data', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Indexes for market data
CREATE INDEX idx_market_data_symbol_tf_time ON market_data (symbol, timeframe, timestamp DESC);
CREATE INDEX idx_market_data_time ON market_data (timestamp DESC);
CREATE INDEX idx_market_data_volume ON market_data (symbol, volume DESC) WHERE volume > 0;

-- ============================================================================
-- STRATEGY PERFORMANCE METRICS (Daily Aggregates)
-- ============================================================================
CREATE TABLE strategy_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Trading Statistics
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    
    -- P&L Metrics
    total_pnl DECIMAL(18, 8) DEFAULT 0,
    gross_profit DECIMAL(18, 8) DEFAULT 0,
    gross_loss DECIMAL(18, 8) DEFAULT 0,
    
    -- Performance Ratios
    win_rate DECIMAL(5, 4) DEFAULT 0 CHECK (win_rate BETWEEN 0 AND 1),
    profit_factor DECIMAL(8, 4) DEFAULT 0,
    
    -- Risk Metrics
    max_drawdown DECIMAL(8, 4) DEFAULT 0,
    max_drawdown_duration INTEGER DEFAULT 0, -- in minutes
    
    -- Advanced Metrics
    sharpe_ratio DECIMAL(8, 4),
    sortino_ratio DECIMAL(8, 4),
    calmar_ratio DECIMAL(8, 4),
    
    -- Trading Patterns
    avg_trade_duration INTEGER, -- in minutes
    max_trade_duration INTEGER, -- in minutes
    avg_win DECIMAL(18, 8),
    avg_loss DECIMAL(18, 8),
    largest_win DECIMAL(18, 8),
    largest_loss DECIMAL(18, 8),
    
    -- Risk Analysis
    var_95 DECIMAL(18, 8), -- Value at Risk (95%)
    cvar_95 DECIMAL(18, 8), -- Conditional Value at Risk (95%)
    
    -- Market Correlation
    market_correlation DECIMAL(5, 4), -- Correlation with benchmark
    beta DECIMAL(8, 4), -- Market beta
    alpha DECIMAL(8, 4), -- Excess return
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(strategy_id, date)
);

-- Indexes for strategy metrics
CREATE INDEX idx_strategy_metrics_strategy_date ON strategy_metrics (strategy_id, date DESC);
CREATE INDEX idx_strategy_metrics_performance ON strategy_metrics (total_pnl DESC, sharpe_ratio DESC);
CREATE INDEX idx_strategy_metrics_risk ON strategy_metrics (max_drawdown ASC, var_95 ASC);

-- ============================================================================
-- ORDERS TABLE (Order Management System)
-- ============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Order Identification
    external_order_id VARCHAR(100) UNIQUE,
    client_order_id VARCHAR(100),
    
    -- Order Details
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(5) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT', 'STOP_LIMIT')),
    
    -- Pricing & Quantity
    quantity DECIMAL(18, 8) NOT NULL CHECK (quantity > 0),
    price DECIMAL(18, 8),
    stop_price DECIMAL(18, 8),
    filled_quantity DECIMAL(18, 8) DEFAULT 0,
    remaining_quantity DECIMAL(18, 8),
    
    -- Order Management
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED', 'REJECTED')),
    time_in_force VARCHAR(5) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK')),
    reduce_only BOOLEAN DEFAULT FALSE,
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    filled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Execution Details
    avg_fill_price DECIMAL(18, 8),
    fees DECIMAL(18, 8) DEFAULT 0,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Additional Data
    metadata JSONB DEFAULT '{}'
);

-- Indexes for orders
CREATE INDEX idx_orders_strategy_symbol ON orders (strategy_id, symbol);
CREATE INDEX idx_orders_status ON orders (status, created_at DESC);
CREATE INDEX idx_orders_external_id ON orders (external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX idx_orders_pending ON orders (created_at ASC) WHERE status = 'PENDING';

-- ============================================================================
-- PORTFOLIO SNAPSHOTS (Point-in-time portfolio states)
-- ============================================================================
CREATE TABLE portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Snapshot Time
    snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Portfolio Value
    total_value DECIMAL(18, 8) NOT NULL,
    cash_balance DECIMAL(18, 8) NOT NULL,
    unrealized_pnl DECIMAL(18, 8) DEFAULT 0,
    realized_pnl DECIMAL(18, 8) DEFAULT 0,
    
    -- Position Summary
    positions JSONB NOT NULL DEFAULT '[]',
    open_orders_count INTEGER DEFAULT 0,
    
    -- Risk Metrics
    total_exposure DECIMAL(18, 8) DEFAULT 0,
    leverage DECIMAL(8, 4) DEFAULT 0,
    
    -- Performance Metrics
    daily_pnl DECIMAL(18, 8),
    daily_pnl_percent DECIMAL(8, 4),
    
    -- Additional Data
    metadata JSONB DEFAULT '{}'
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('portfolio_snapshots', 'snapshot_time', chunk_time_interval => INTERVAL '7 days');

-- Indexes for portfolio snapshots
CREATE INDEX idx_portfolio_snapshots_strategy_time ON portfolio_snapshots (strategy_id, snapshot_time DESC);
CREATE INDEX idx_portfolio_snapshots_time ON portfolio_snapshots (snapshot_time DESC);

-- ============================================================================
-- BACKTESTS TABLE (Backtest Results Storage)
-- ============================================================================
CREATE TABLE backtests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    
    -- Backtest Configuration
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Test Parameters
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(5) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    initial_capital DECIMAL(18, 8) NOT NULL,
    
    -- Backtest Settings
    commission DECIMAL(8, 6) DEFAULT 0,
    slippage DECIMAL(8, 6) DEFAULT 0,
    
    -- Results Summary
    total_return DECIMAL(8, 4),
    annualized_return DECIMAL(8, 4),
    volatility DECIMAL(8, 4),
    max_drawdown DECIMAL(8, 4),
    sharpe_ratio DECIMAL(8, 4),
    
    -- Trading Statistics
    total_trades INTEGER,
    winning_trades INTEGER,
    win_rate DECIMAL(5, 4),
    profit_factor DECIMAL(8, 4),
    
    -- Detailed Results (JSON storage)
    detailed_results JSONB,
    equity_curve JSONB,
    trade_list JSONB,
    
    -- Execution Info
    execution_time_ms INTEGER,
    data_points_processed INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for backtests
CREATE INDEX idx_backtests_strategy ON backtests (strategy_id, created_at DESC);
CREATE INDEX idx_backtests_performance ON backtests (sharpe_ratio DESC, total_return DESC) WHERE status = 'COMPLETED';
CREATE INDEX idx_backtests_symbol_timeframe ON backtests (symbol, timeframe);

-- ============================================================================
-- SYSTEM LOGS (Application Logging)
-- ============================================================================
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Log Classification
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    category VARCHAR(50) NOT NULL, -- 'STRATEGY', 'ORDER', 'RISK', 'DATA', etc.
    
    -- Context
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Message
    message TEXT NOT NULL,
    details JSONB,
    
    -- Additional Context
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT
);

-- Convert to TimescaleDB hypertable for log retention
SELECT create_hypertable('system_logs', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Indexes for system logs
CREATE INDEX idx_system_logs_level_time ON system_logs (level, timestamp DESC);
CREATE INDEX idx_system_logs_category ON system_logs (category, timestamp DESC);
CREATE INDEX idx_system_logs_strategy ON system_logs (strategy_id, timestamp DESC) WHERE strategy_id IS NOT NULL;

-- ============================================================================
-- CONFIGURATION TABLE (System Configuration)
-- ============================================================================
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    
    -- Validation
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'object', 'array')),
    is_sensitive BOOLEAN DEFAULT FALSE,
    
    -- Change Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- Index for configuration
CREATE INDEX idx_system_config_category ON system_config (category);
```

---

## Data Access Layer Architecture

### 1. Connection Management

```typescript
// Database Connection Pool
import { Pool, PoolConfig } from 'pg';
import Redis from 'ioredis';

class DatabaseManager {
  private static instance: DatabaseManager;
  private pgPool: Pool;
  private redis: Redis;
  
  private constructor() {
    // PostgreSQL connection pool
    this.pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'trading_bot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      
      // Pool configuration
      max: 20, // Maximum pool size
      min: 2,  // Minimum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      
      // Performance optimization
      statement_timeout: 30000,
      query_timeout: 30000,
      
      // Connection security
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      
      // Connection pool
      lazyConnect: true,
      keepAlive: 30000,
      
      // Performance
      commandTimeout: 5000,
      enableOfflineQueue: false
    });
  }
  
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }
  
  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }
  
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  getRedis(): Redis {
    return this.redis;
  }
  
  async healthCheck(): Promise<{ postgresql: boolean; redis: boolean }> {
    try {
      const [pgResult, redisResult] = await Promise.allSettled([
        this.query('SELECT 1 as health'),
        this.redis.ping()
      ]);
      
      return {
        postgresql: pgResult.status === 'fulfilled',
        redis: redisResult.status === 'fulfilled' && redisResult.value === 'PONG'
      };
    } catch {
      return { postgresql: false, redis: false };
    }
  }
  
  async close(): Promise<void> {
    await Promise.all([
      this.pgPool.end(),
      this.redis.quit()
    ]);
  }
}

export const db = DatabaseManager.getInstance();
```

### 2. Repository Pattern Implementation

```typescript
// Base Repository
abstract class BaseRepository<T> {
  protected db = DatabaseManager.getInstance();
  protected redis = this.db.getRedis();
  
  abstract readonly tableName: string;
  
  async findById(id: string): Promise<T | null> {
    const cacheKey = `${this.tableName}:${id}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Query database
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const entity = result.rows[0];
    
    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(entity));
    
    return entity as T;
  }
  
  async create(data: Partial<T>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    
    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    const result = await this.db.query(query, values);
    return result.rows[0] as T;
  }
  
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.db.query(query, [id, ...values]);
    
    if (result.rows.length === 0) return null;
    
    const entity = result.rows[0];
    
    // Invalidate cache
    await this.redis.del(`${this.tableName}:${id}`);
    
    return entity as T;
  }
  
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    
    if (result.rowCount > 0) {
      // Invalidate cache
      await this.redis.del(`${this.tableName}:${id}`);
      return true;
    }
    
    return false;
  }
}

// Strategy Repository
class StrategyRepository extends BaseRepository<Strategy> {
  readonly tableName = 'strategies';
  
  async findActiveStrategies(): Promise<Strategy[]> {
    const cacheKey = 'strategies:active';
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const result = await this.db.query(`
      SELECT * FROM strategies 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);
    
    // Cache for 1 minute (active strategies change frequently)
    await this.redis.setex(cacheKey, 60, JSON.stringify(result.rows));
    
    return result.rows as Strategy[];
  }
  
  async updatePerformanceMetrics(
    strategyId: string, 
    metrics: Partial<StrategyPerformanceMetrics>
  ): Promise<void> {
    await this.db.query(`
      UPDATE strategies 
      SET 
        total_trades = $2,
        winning_trades = $3,
        total_pnl = $4,
        max_drawdown = $5,
        updated_at = NOW()
      WHERE id = $1
    `, [
      strategyId,
      metrics.totalTrades,
      metrics.winningTrades,
      metrics.totalPnl,
      metrics.maxDrawdown
    ]);
    
    // Invalidate cache
    await this.redis.del(`strategies:${strategyId}`);
    await this.redis.del('strategies:active');
  }
  
  async getStrategyPerformance(
    strategyId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<StrategyPerformance> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(pnl) as total_pnl,
        AVG(pnl) as avg_pnl,
        STDDEV(pnl) as pnl_stddev,
        MIN(pnl) as worst_trade,
        MAX(pnl) as best_trade,
        AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))/60) as avg_duration_minutes
      FROM trades 
      WHERE strategy_id = $1 
        AND status = 'CLOSED'
        AND ($2::timestamp IS NULL OR entry_time >= $2)
        AND ($3::timestamp IS NULL OR entry_time <= $3)
    `, [strategyId, dateFrom, dateTo]);
    
    return result.rows[0] as StrategyPerformance;
  }
}

// Trade Repository  
class TradeRepository extends BaseRepository<Trade> {
  readonly tableName = 'trades';
  
  async findOpenTrades(strategyId?: string): Promise<Trade[]> {
    let query = `
      SELECT * FROM trades 
      WHERE status IN ('OPEN', 'PARTIALLY_FILLED')
      ORDER BY entry_time DESC
    `;
    const params: any[] = [];
    
    if (strategyId) {
      query = `
        SELECT * FROM trades 
        WHERE strategy_id = $1 AND status IN ('OPEN', 'PARTIALLY_FILLED')
        ORDER BY entry_time DESC
      `;
      params.push(strategyId);
    }
    
    const result = await this.db.query(query, params);
    return result.rows as Trade[];
  }
  
  async closeTrade(
    tradeId: string,
    exitPrice: number,
    exitReason: string,
    exitSignal?: any
  ): Promise<Trade | null> {
    const trade = await this.findById(tradeId);
    if (!trade || trade.status === 'CLOSED') return null;
    
    // Calculate P&L
    const pnl = trade.side === 'BUY' 
      ? (exitPrice - trade.entry_price) * trade.quantity - trade.fees
      : (trade.entry_price - exitPrice) * trade.quantity - trade.fees;
    
    const pnlPercent = (pnl / (trade.entry_price * trade.quantity)) * 100;
    
    const result = await this.db.query(`
      UPDATE trades 
      SET 
        exit_price = $2,
        exit_time = NOW(),
        pnl = $3,
        pnl_percent = $4,
        status = 'CLOSED',
        exit_reason = $5,
        exit_signal = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [tradeId, exitPrice, pnl, pnlPercent, exitReason, JSON.stringify(exitSignal)]);
    
    return result.rows[0] as Trade;
  }
  
  async getTradeHistory(
    filters: TradeFilters,
    page = 1,
    pageSize = 50
  ): Promise<{ trades: Trade[]; total: number }> {
    let whereClause = '1 = 1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filters.strategyId) {
      whereClause += ` AND strategy_id = $${paramIndex++}`;
      params.push(filters.strategyId);
    }
    
    if (filters.symbol) {
      whereClause += ` AND symbol = $${paramIndex++}`;
      params.push(filters.symbol);
    }
    
    if (filters.status && filters.status !== 'all') {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(filters.status.toUpperCase());
    }
    
    if (filters.dateFrom) {
      whereClause += ` AND entry_time >= $${paramIndex++}`;
      params.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      whereClause += ` AND entry_time <= $${paramIndex++}`;
      params.push(filters.dateTo);
    }
    
    // Count query
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM trades WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    // Data query with pagination
    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    
    const dataResult = await this.db.query(`
      SELECT * FROM trades 
      WHERE ${whereClause}
      ORDER BY entry_time DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, params);
    
    return {
      trades: dataResult.rows as Trade[],
      total
    };
  }
}

// Market Data Repository (Time-Series Optimized)
class MarketDataRepository {
  private db = DatabaseManager.getInstance();
  private redis = this.db.getRedis();
  
  async storeCandles(symbol: string, timeframe: string, candles: DydxCandle[]): Promise<void> {
    if (candles.length === 0) return;
    
    const values = candles.map((candle, index) => {
      const baseIndex = index * 8;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
    }).join(', ');
    
    const params = candles.flatMap(candle => [
      symbol,
      timeframe,
      new Date(candle.time),
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume
    ]);
    
    await this.db.query(`
      INSERT INTO market_data (symbol, timeframe, timestamp, open, high, low, close, volume)
      VALUES ${values}
      ON CONFLICT (symbol, timeframe, timestamp) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume
    `, params);
  }
  
  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date,
    limit = 1000
  ): Promise<DydxCandle[]> {
    const cacheKey = `market_data:${symbol}:${timeframe}:${startTime.getTime()}:${endTime.getTime()}:${limit}`;
    
    // Try cache for frequently accessed historical data
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const result = await this.db.query(`
      SELECT timestamp, open, high, low, close, volume
      FROM market_data
      WHERE symbol = $1 AND timeframe = $2 AND timestamp BETWEEN $3 AND $4
      ORDER BY timestamp ASC
      LIMIT $5
    `, [symbol, timeframe, startTime, endTime, limit]);
    
    const candles = result.rows.map(row => ({
      time: new Date(row.timestamp).getTime(),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
      timeframe: timeframe as Timeframe,
      symbol
    }));
    
    // Cache for 1 hour (historical data doesn't change)
    await this.redis.setex(cacheKey, 3600, JSON.stringify(candles));
    
    return candles;
  }
  
  async getLatestCandles(
    symbol: string,
    timeframe: string,
    limit = 100
  ): Promise<DydxCandle[]> {
    const result = await this.db.query(`
      SELECT timestamp, open, high, low, close, volume
      FROM market_data
      WHERE symbol = $1 AND timeframe = $2
      ORDER BY timestamp DESC
      LIMIT $3
    `, [symbol, timeframe, limit]);
    
    return result.rows.reverse().map(row => ({
      time: new Date(row.timestamp).getTime(),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
      timeframe: timeframe as Timeframe,
      symbol
    }));
  }
}
```

---

## Migration System

```typescript
// Database Migration Manager
class MigrationManager {
  private db = DatabaseManager.getInstance();
  
  async runMigrations(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.createMigrationsTable();
    
    // Get all available migrations
    const availableMigrations = await this.getAvailableMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    
    // Find pending migrations
    const pendingMigrations = availableMigrations.filter(
      migration => !executedMigrations.includes(migration.name)
    );
    
    // Execute pending migrations
    for (const migration of pendingMigrations) {
      console.log(`Executing migration: ${migration.name}`);
      await this.executeMigration(migration);
      console.log(`Completed migration: ${migration.name}`);
    }
  }
  
  private async createMigrationsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }
  
  private async getAvailableMigrations(): Promise<Migration[]> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const migrationDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationDir);
    
    return files
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file => ({
        name: file,
        path: path.join(migrationDir, file)
      }));
  }
  
  private async getExecutedMigrations(): Promise<string[]> {
    const result = await this.db.query(
      'SELECT migration_name FROM schema_migrations ORDER BY id'
    );
    return result.rows.map(row => row.migration_name);
  }
  
  private async executeMigration(migration: Migration): Promise<void> {
    const fs = require('fs').promises;
    const sql = await fs.readFile(migration.path, 'utf8');
    
    await this.db.transaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        [migration.name]
      );
    });
  }
}

interface Migration {
  name: string;
  path: string;
}
```

---

## Performance Optimization

### 1. Indexing Strategy
- **B-tree indexes**: Standard lookups (id, timestamps)
- **Partial indexes**: Filtered data (active trades, pending orders)
- **Composite indexes**: Multi-column queries (strategy + symbol)
- **GIN indexes**: JSON data and arrays

### 2. Query Optimization
- **Prepared statements**: Reduce parsing overhead
- **Connection pooling**: Manage database connections efficiently
- **Query caching**: Redis cache for frequent queries
- **Batch operations**: Bulk inserts and updates

### 3. Data Partitioning
- **Time-based partitioning**: Market data by date ranges
- **Hash partitioning**: Distribute load across shards
- **List partitioning**: Separate by symbol or strategy

### 4. Caching Strategy
- **L1 Cache**: In-memory application cache
- **L2 Cache**: Redis distributed cache
- **L3 Cache**: Database query cache
- **Cache invalidation**: Event-driven cache updates

---

## Data Retention & Archival

```sql
-- Data retention policies
-- Archive trades older than 2 years to separate table
CREATE TABLE trades_archive (LIKE trades INCLUDING ALL);

-- Move old data (run monthly)
WITH moved_trades AS (
  DELETE FROM trades 
  WHERE entry_time < NOW() - INTERVAL '2 years'
  RETURNING *
)
INSERT INTO trades_archive SELECT * FROM moved_trades;

-- Market data compression (TimescaleDB)
SELECT add_compression_policy('market_data', INTERVAL '7 days');

-- Log retention (keep 30 days)
SELECT add_retention_policy('system_logs', INTERVAL '30 days');
```

---

## Monitoring & Observability

### 1. Database Metrics
```typescript
class DatabaseMetrics {
  async collectMetrics(): Promise<DatabaseHealthMetrics> {
    const [connectionStats, queryStats, tableStats] = await Promise.all([
      this.getConnectionStats(),
      this.getQueryStats(),
      this.getTableStats()
    ]);
    
    return {
      connections: connectionStats,
      queries: queryStats,
      tables: tableStats,
      timestamp: new Date()
    };
  }
  
  private async getConnectionStats() {
    const result = await this.db.query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state
    `);
    
    return result.rows.reduce((acc, row) => {
      acc[row.state] = parseInt(row.count);
      return acc;
    }, {});
  }
  
  private async getQueryStats() {
    const result = await this.db.query(`
      SELECT 
        calls,
        total_exec_time,
        mean_exec_time,
        query
      FROM pg_stat_statements 
      ORDER BY total_exec_time DESC 
      LIMIT 10
    `);
    
    return result.rows;
  }
}
```

### 2. Alert Thresholds
- **Connection pool exhaustion**: >90% pool utilization
- **Slow queries**: >1 second execution time
- **Lock contention**: Lock wait time >100ms
- **Disk space**: >85% database disk usage
- **Replication lag**: >1 minute delay

---

This database architecture provides a robust, scalable foundation for our algorithmic trading platform, optimized for both operational efficiency and analytical capabilities while maintaining data integrity and performance under high-frequency trading loads.