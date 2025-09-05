/**
 * Database Entity Types for BE-002: Base Repository Implementation
 * Type-safe interfaces for all database tables from DB-002 schema
 */

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  type: 'technical' | 'fundamental' | 'ml' | 'hybrid';
  status: 'active' | 'inactive' | 'paused' | 'archived';
  parameters: Record<string, unknown>;
  risk_profile: Record<string, unknown>;
  performance_metrics?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  version: number;
  is_deleted: boolean;
}

export interface MarketData {
  time: Date;
  symbol: string;
  exchange: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_volume?: number;
  trades_count?: number;
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  raw_data?: Record<string, unknown>;
  created_at: Date;
}

export interface Trade {
  id: string;
  time: Date;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  quantity: number;
  price?: number;
  executed_price?: number;
  executed_quantity: number;
  remaining_quantity: number;
  fees: number;
  pnl: number;
  entry_time?: Date;
  exit_time?: Date;
  stop_loss?: number;
  take_profit?: number;
  order_id?: string;
  exchange_order_id?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  trade_id?: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected' | 'expired';
  quantity: number;
  price?: number;
  executed_quantity: number;
  remaining_quantity: number;
  average_price?: number;
  fees: number;
  order_id?: string;
  exchange_order_id?: string;
  parent_order_id?: string;
  time_in_force: 'GTC' | 'IOC' | 'FOK' | 'GTT';
  expire_time?: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface PortfolioSnapshot {
  time: Date;
  strategy_id?: string;
  total_value: number;
  cash_balance: number;
  positions_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  drawdown?: number;
  positions: Record<string, unknown>;
  metrics: Record<string, unknown>;
  created_at: Date;
}

export interface SystemLog {
  time: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  component: string;
  message: string;
  details: Record<string, unknown>;
  strategy_id?: string;
  trade_id?: string;
  error_code?: string;
  stack_trace?: string;
  user_id?: string;
  session_id?: string;
  created_at: Date;
}

// Repository helper types
export type TableName = 'strategies' | 'market_data' | 'trades' | 'orders' | 'portfolio_snapshots' | 'system_logs';

export interface BaseEntity {
  id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface CacheConfig {
  key: string;
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for bulk invalidation
}

export interface TransactionContext {
  client: import('pg').PoolClient;
  isRollback: boolean;
}

// Database error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public constraint?: string,
    public table?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string, constraint?: string) {
    super(message);
    this.name = 'ConflictError';
    this.constraint = constraint;
  }
}