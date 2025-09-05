/**
 * Database Connection Manager for Algorithmic Trading Bot
 * Task BE-001: Database Connection Manager
 * 
 * Production-ready database connection manager with PostgreSQL connection pooling,
 * Redis caching, health checks, error handling, and automatic reconnection logic.
 */

import { Pool, PoolClient, types } from 'pg';
import Redis, { RedisOptions } from 'ioredis';
import { getDatabaseConfig, getConnectionString, DatabaseConfig } from './config';
import { DatabaseHealthMonitor, HealthCheckResult, DatabaseHealthMetrics } from './health';

// Configure pg types to handle numeric as numbers instead of strings
types.setTypeParser(types.builtins.NUMERIC, (value: string) => parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value: string) => parseInt(value, 10));

export interface DatabaseManagerOptions {
  enableRedis?: boolean;
  redisUrl?: string;
  redisOptions?: RedisOptions;
  maxRetries?: number;
  retryDelay?: number;
  enableHealthMonitoring?: boolean;
  healthCheckInterval?: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key: string;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number | null;
  fields: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

export interface TransactionCallback<T> {
  (client: PoolClient): Promise<T>;
}

/**
 * Circuit breaker states for connection management
 */
enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open, rejecting requests
  HALF_OPEN = 'half-open' // Testing if service is back
}

/**
 * Singleton Database Manager with connection pooling, caching, and monitoring
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  
  private pool: Pool | null = null;
  private redis: Redis | null = null;
  private config: DatabaseConfig;
  private options: DatabaseManagerOptions;
  private healthMonitor: DatabaseHealthMonitor | null = null;
  
  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private circuitFailureCount = 0;
  private circuitLastFailureTime = 0;
  private readonly circuitFailureThreshold = 5;
  private readonly circuitTimeout = 60000; // 1 minute
  
  // Reconnection state
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private readonly maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Connection state
  private isInitialized = false;
  private isShuttingDown = false;

  private constructor(options: DatabaseManagerOptions = {}) {
    this.options = {
      enableRedis: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableHealthMonitoring: true,
      healthCheckInterval: 30000,
      ...options,
    };
    this.config = getDatabaseConfig();
  }

  /**
   * Get singleton instance of DatabaseManager
   */
  public static getInstance(options?: DatabaseManagerOptions): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(options);
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database connection pool and Redis cache
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[DatabaseManager] Initializing connection pool and cache...');
      
      await this.initializePostgreSQL();
      
      if (this.options.enableRedis) {
        await this.initializeRedis();
      }
      
      // Initialize health monitoring
      if (this.options.enableHealthMonitoring && this.pool) {
        this.healthMonitor = new DatabaseHealthMonitor(this.pool);
        this.healthMonitor.startMonitoring(this.options.healthCheckInterval);
      }
      
      this.isInitialized = true;
      this.circuitState = CircuitState.CLOSED;
      this.reconnectAttempts = 0;
      
      console.log('[DatabaseManager] Successfully initialized');
      console.log(`[DatabaseManager] PostgreSQL pool: min=${this.config.pool.min}, max=${this.config.pool.max}`);
      if (this.redis) {
        console.log('[DatabaseManager] Redis cache: enabled');
      }
      
    } catch (error) {
      console.error('[DatabaseManager] Initialization failed:', error);
      await this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private async initializePostgreSQL(): Promise<void> {
    const connectionString = getConnectionString(this.config);
    
    this.pool = new Pool({
      connectionString,
      min: this.config.pool.min,
      max: this.config.pool.max,
      idleTimeoutMillis: this.config.pool.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.pool.connectionTimeoutMillis,
      ssl: this.config.ssl.mode === 'disable' ? false : {
        rejectUnauthorized: this.config.ssl.rejectUnauthorized,
        ca: this.config.ssl.ca,
        cert: this.config.ssl.cert,
        key: this.config.ssl.key,
      },
    });

    // Set up pool event handlers
    this.pool.on('connect', () => {
      console.log('[DatabaseManager] New client connected');
      this.handleSuccessfulConnection();
    });

    this.pool.on('error', (err) => {
      console.error('[DatabaseManager] Pool error:', err);
      this.handleConnectionError(err);
    });

    this.pool.on('remove', () => {
      console.log('[DatabaseManager] Client removed from pool');
    });

    // Test the connection
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      console.log('[DatabaseManager] Database connection test successful');
      console.log(`[DatabaseManager] Connected to: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    } finally {
      client.release();
    }
  }

  /**
   * Initialize Redis cache connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisOptions: RedisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        ...this.options.redisOptions,
      };

      this.redis = new Redis(redisOptions);

      this.redis.on('connect', () => {
        console.log('[DatabaseManager] Redis connected successfully');
      });

      this.redis.on('error', (err) => {
        console.error('[DatabaseManager] Redis connection error:', err);
        // Redis errors should not break the database functionality
        this.redis = null;
      });

      this.redis.on('close', () => {
        console.log('[DatabaseManager] Redis connection closed');
      });

      // Test Redis connection
      await this.redis.connect();
      await this.redis.ping();
      
    } catch (error) {
      console.warn('[DatabaseManager] Redis initialization failed, continuing without cache:', error);
      this.redis = null;
    }
  }

  /**
   * Execute a query with optional caching
   */
  public async query<T = unknown>(
    text: string,
    params?: unknown[],
    cacheOptions?: CacheOptions
  ): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.circuitState === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.circuitLastFailureTime;
      if (timeSinceLastFailure < this.circuitTimeout) {
        throw new Error('Circuit breaker is OPEN - database unavailable');
      } else {
        this.circuitState = CircuitState.HALF_OPEN;
        console.log('[DatabaseManager] Circuit breaker moved to HALF_OPEN state');
      }
    }

    // Check cache first if enabled and this is a read operation
    if (cacheOptions && this.redis && text.trim().toLowerCase().startsWith('select')) {
      try {
        const cached = await this.redis.get(cacheOptions.key);
        if (cached) {
          console.log(`[DatabaseManager] Cache hit for key: ${cacheOptions.key}`);
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        console.warn('[DatabaseManager] Cache read error:', cacheError);
      }
    }

    let retries = 0;
    while (retries <= (this.options.maxRetries || 3)) {
      try {
        if (!this.pool) {
          throw new Error('Database pool not initialized');
        }

        const startTime = Date.now();
        const client = await this.pool.connect();
        
        try {
          const result = await client.query({
            text,
            values: params,
            rowMode: 'array' // For better performance with large datasets
          });
          
          const queryTime = Date.now() - startTime;
          
          if (this.config.debug) {
            console.log(`[DatabaseManager] Query executed in ${queryTime}ms: ${text}`);
          }

          // Handle successful query for circuit breaker
          this.handleSuccessfulQuery();

          // Transform result to match our interface
          const transformedResult: QueryResult<T> = {
            rows: result.rows as T[],
            rowCount: result.rowCount,
            fields: result.fields?.map(field => ({
              name: field.name,
              dataTypeID: field.dataTypeID,
            })) || [],
          };

          // Cache the result if enabled
          if (cacheOptions && this.redis && text.trim().toLowerCase().startsWith('select')) {
            try {
              const ttl = cacheOptions.ttl || 300; // Default 5 minutes
              await this.redis.setex(cacheOptions.key, ttl, JSON.stringify(transformedResult));
            } catch (cacheError) {
              console.warn('[DatabaseManager] Cache write error:', cacheError);
            }
          }

          return transformedResult;
          
        } finally {
          client.release();
        }

      } catch (error) {
        retries++;
        console.error(`[DatabaseManager] Query attempt ${retries} failed:`, error);
        
        if (retries > (this.options.maxRetries || 3)) {
          this.handleConnectionError(error);
          throw error;
        }
        
        // Exponential backoff for retries
        const delay = (this.options.retryDelay || 1000) * Math.pow(2, retries - 1);
        await this.sleep(delay);
      }
    }

    throw new Error('Max query retries exceeded');
  }

  /**
   * Execute multiple queries in a transaction
   */
  public async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    if (this.circuitState === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN - database unavailable');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      this.handleSuccessfulQuery();
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      this.handleConnectionError(error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database health check results
   */
  public async getHealthStatus(): Promise<{
    database: HealthCheckResult[];
    metrics: DatabaseHealthMetrics;
    redis: { connected: boolean; error?: string };
    circuitBreaker: {
      state: CircuitState;
      failureCount: number;
      lastFailureTime: number;
    };
  }> {
    if (!this.healthMonitor) {
      throw new Error('Health monitoring not enabled');
    }

    const [healthResults, metrics] = await Promise.all([
      this.healthMonitor.performHealthCheck(),
      this.healthMonitor.getMetrics(),
    ]);

    return {
      database: healthResults,
      metrics,
      redis: {
        connected: !!this.redis && this.redis.status === 'ready',
        error: this.redis?.status !== 'ready' && this.redis?.status !== 'connecting' ? 'Connection error' : undefined,
      },
      circuitBreaker: {
        state: this.circuitState,
        failureCount: this.circuitFailureCount,
        lastFailureTime: this.circuitLastFailureTime,
      },
    };
  }

  /**
   * Get connection pool status
   */
  public getPoolStatus() {
    if (!this.pool) {
      return { connected: false };
    }

    return {
      connected: true,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.pool.options.max,
      minConnections: this.pool.options.min,
    };
  }

  /**
   * Clear cache by pattern or key
   */
  public async clearCache(pattern: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      if (pattern.includes('*')) {
        // Pattern-based deletion
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          return await this.redis.del(...keys);
        }
        return 0;
      } else {
        // Single key deletion
        return await this.redis.del(pattern);
      }
    } catch (error) {
      console.error('[DatabaseManager] Cache clear error:', error);
      return 0;
    }
  }

  /**
   * Graceful shutdown of all connections
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('[DatabaseManager] Initiating graceful shutdown...');

    // Stop health monitoring
    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring();
    }

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close Redis connection
    if (this.redis) {
      try {
        await this.redis.quit();
        console.log('[DatabaseManager] Redis connection closed');
      } catch (error) {
        console.error('[DatabaseManager] Error closing Redis:', error);
      }
    }

    // Close PostgreSQL pool
    if (this.pool) {
      try {
        await this.pool.end();
        console.log('[DatabaseManager] PostgreSQL pool closed');
      } catch (error) {
        console.error('[DatabaseManager] Error closing PostgreSQL pool:', error);
      }
    }

    this.isInitialized = false;
    console.log('[DatabaseManager] Shutdown complete');
  }

  /**
   * Handle successful database operations
   */
  private handleSuccessfulQuery(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.CLOSED;
      this.circuitFailureCount = 0;
      console.log('[DatabaseManager] Circuit breaker CLOSED - service recovered');
    }
  }

  /**
   * Handle successful connections
   */
  private handleSuccessfulConnection(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000; // Reset delay
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Handle connection errors with circuit breaker logic
   */
  private async handleConnectionError(_error: unknown): Promise<void> {
    this.circuitFailureCount++;
    this.circuitLastFailureTime = Date.now();

    if (this.circuitFailureCount >= this.circuitFailureThreshold) {
      this.circuitState = CircuitState.OPEN;
      console.error(`[DatabaseManager] Circuit breaker OPENED after ${this.circuitFailureCount} failures`);
    }

    // Attempt reconnection if not shutting down
    if (!this.isShuttingDown && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnection();
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[DatabaseManager] Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        console.log(`[DatabaseManager] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        // Reinitialize connections
        this.isInitialized = false;
        await this.initialize();
        
        console.log('[DatabaseManager] Reconnection successful');
        
      } catch (error) {
        console.error(`[DatabaseManager] Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnection();
        } else {
          console.error('[DatabaseManager] Max reconnection attempts reached - manual intervention required');
        }
      }
    }, delay);
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static async resetInstance(): Promise<void> {
    if (DatabaseManager.instance) {
      await DatabaseManager.instance.shutdown();
      DatabaseManager.instance = null;
    }
  }
}

// Export singleton access function
export const getDatabaseManager = (options?: DatabaseManagerOptions): DatabaseManager => {
  return DatabaseManager.getInstance(options);
};

// Export default instance
export default DatabaseManager;