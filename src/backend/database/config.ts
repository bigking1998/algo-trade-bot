/**
 * Database Configuration for Algorithmic Trading Bot
 * Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
 * 
 * Provides production-ready database configuration with connection pooling,
 * SSL settings, and health monitoring for the trading platform.
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load database environment variables
config({ path: join(process.cwd(), '.env.database') });

export interface DatabaseConfig {
  // Connection Settings
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  
  // Pool Configuration (Max 20 connections as per requirements)
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  
  // SSL Configuration
  ssl: {
    mode: string;
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  
  // Health Check Settings
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
  };
  
  // Query Settings
  query: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  
  // TimescaleDB Settings
  timescaledb: {
    enabled: boolean;
    compressionEnabled: boolean;
    compressionPolicy: string;
    retentionPolicy: string;
  };
  
  // Development/Production flags
  debug: boolean;
  logLevel: string;
}

/**
 * Get database configuration from environment variables with secure defaults
 */
export function getDatabaseConfig(): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    // Connection Settings
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'algo_trading_bot',
    user: process.env.DB_USER || 'algo_trader',
    password: process.env.DB_PASSWORD || 'secure_trading_password_2025',
    
    // Pool Configuration (Max 20 connections per requirements)
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '60000', 10),
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 2000,
    },
    
    // SSL Configuration
    ssl: {
      mode: process.env.DB_SSL_MODE || (isProduction ? 'require' : 'prefer'),
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    },
    
    // Health Check Settings
    healthCheck: {
      enabled: process.env.DB_HEALTH_CHECK_ENABLED !== 'false',
      interval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000', 10),
      timeout: parseInt(process.env.DB_HEALTH_CHECK_TIMEOUT || '5000', 10),
      retries: 3,
    },
    
    // Query Settings
    query: {
      timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
      maxRetries: 3,
      retryDelay: 1000,
    },
    
    // TimescaleDB Settings
    timescaledb: {
      enabled: process.env.DB_ENABLE_TIMESCALEDB === 'true',
      compressionEnabled: true,
      compressionPolicy: '7 days',
      retentionPolicy: '1 year',
    },
    
    // Development/Production flags
    debug: !isProduction && process.env.DB_DEBUG === 'true',
    logLevel: process.env.DB_LOG_LEVEL || (isProduction ? 'warn' : 'info'),
  };
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.host) {
    throw new Error('Database host is required');
  }
  
  if (!config.database) {
    throw new Error('Database name is required');
  }
  
  if (!config.user) {
    throw new Error('Database user is required');
  }
  
  if (!config.password) {
    throw new Error('Database password is required');
  }
  
  if (config.pool.max < 1) {
    throw new Error('Pool max connections must be at least 1');
  }
  
  if (config.pool.min > config.pool.max) {
    throw new Error('Pool min connections cannot exceed max connections');
  }
  
  if (config.pool.max > 50) {
    console.warn('Pool max connections is very high, consider reducing for optimal performance');
  }
}

/**
 * Get PostgreSQL connection string from configuration
 */
export function getConnectionString(config: DatabaseConfig): string {
  const { host, port, database, user, password, ssl } = config;
  let connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  
  const params = [];
  
  // Add SSL parameters
  if (ssl.mode) {
    params.push(`sslmode=${ssl.mode}`);
  }
  
  if (ssl.rejectUnauthorized === false) {
    params.push('sslcert=');
    params.push('sslkey=');
    params.push('sslrootcert=');
  }
  
  // Add application name for connection identification
  params.push('application_name=algo_trading_bot');
  
  // Add connection timeout
  params.push(`connect_timeout=${Math.floor(config.pool.connectionTimeoutMillis / 1000)}`);
  
  if (params.length > 0) {
    connectionString += '?' + params.join('&');
  }
  
  return connectionString;
}

/**
 * Database configuration singleton
 */
let dbConfig: DatabaseConfig | null = null;

export function getSharedDatabaseConfig(): DatabaseConfig {
  if (!dbConfig) {
    dbConfig = getDatabaseConfig();
    validateDatabaseConfig(dbConfig);
  }
  return dbConfig;
}