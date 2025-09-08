/**
 * Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
 * 
 * This module handles the initial setup and configuration of:
 * - PostgreSQL 15+ database instance
 * - TimescaleDB extension for time-series data
 * - Connection pooling with max 20 connections
 * - SSL configuration and security settings
 * - Health check endpoints
 * - Backup strategy implementation
 */

import { Pool, PoolConfig, Client } from 'pg';
import { EventEmitter } from 'events';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  connectionPool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  healthCheck: {
    intervalMs: number;
    timeoutMs: number;
  };
  backup: {
    enabled: boolean;
    intervalHours: number;
    retentionDays: number;
    location: string;
  };
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  timescaledb: {
    installed: boolean;
    version: string;
  };
  performance: {
    queryTimeMs: number;
    avgResponseTime: number;
  };
}

export class DatabaseSetup extends EventEmitter {
  private pool: Pool;
  private config: DatabaseConfig;
  private healthCheckInterval?: NodeJS.Timer;
  private isConnected = false;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
    this.pool = this.createConnectionPool();
    this.setupEventListeners();
  }

  /**
   * Initialize database connection and setup TimescaleDB
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing database connection...');
      
      // Test initial connection
      await this.testConnection();
      
      // Setup TimescaleDB extension
      await this.setupTimescaleDB();
      
      // Start health monitoring
      this.startHealthChecking();
      
      // Setup backup strategy
      if (this.config.backup.enabled) {
        await this.setupBackupStrategy();
      }
      
      this.isConnected = true;
      this.emit('connected');
      console.log('✅ Database setup completed successfully');
      
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create connection pool with security and performance settings
   */
  private createConnectionPool(): Pool {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      
      // Connection pooling settings (max 20 connections as per requirements)
      max: this.config.connectionPool.max,
      min: this.config.connectionPool.min,
      idleTimeoutMillis: this.config.connectionPool.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionPool.connectionTimeoutMillis,
      
      // SSL configuration for security
      ssl: this.config.ssl,
      
      // Additional security and performance settings
      statement_timeout: 30000, // 30 second query timeout
      idle_in_transaction_session_timeout: 300000, // 5 minute idle transaction timeout
    };

    return new Pool(poolConfig);
  }

  /**
   * Setup event listeners for connection pool
   */
  private setupEventListeners(): void {
    this.pool.on('connect', (client) => {
      console.log('📦 New client connected to database');
      this.emit('client_connected', client);
    });

    this.pool.on('acquire', (client) => {
      console.log('🔗 Client acquired from pool');
      this.emit('client_acquired', client);
    });

    this.pool.on('remove', (client) => {
      console.log('🗑️  Client removed from pool');
      this.emit('client_removed', client);
    });

    this.pool.on('error', (err, client) => {
      console.error('💥 Unexpected database error:', err);
      this.emit('pool_error', err, client);
    });
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT version()');
      const version = result.rows[0].version;
      console.log('📋 PostgreSQL version:', version);
      
      // Verify PostgreSQL version is 15+
      const versionMatch = version.match(/PostgreSQL (\d+)\./);
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1]);
        if (majorVersion < 15) {
          throw new Error(`PostgreSQL 15+ required, found version ${majorVersion}`);
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Setup TimescaleDB extension
   */
  private async setupTimescaleDB(): Promise<void> {
    const client = await this.pool.connect();
    try {
      console.log('🔄 Setting up TimescaleDB extension...');
      
      // Create TimescaleDB extension
      await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
      
      // Verify TimescaleDB installation
      const result = await client.query(`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'timescaledb'
      `);
      
      if (result.rows.length === 0) {
        throw new Error('TimescaleDB extension not found after installation');
      }
      
      const version = result.rows[0].extversion;
      console.log('✅ TimescaleDB installed, version:', version);
      
    } finally {
      client.release();
    }
  }

  /**
   * Start health checking with specified interval
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        this.emit('health_check', health);
        
        if (health.status !== 'healthy') {
          console.warn('⚠️  Database health degraded:', health);
        }
      } catch (error) {
        console.error('❌ Health check failed:', error);
        this.emit('health_check_error', error);
      }
    }, this.config.healthCheck.intervalMs);
  }

  /**
   * Perform comprehensive health check
   */
  public async checkHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    let timescaledbInfo = { installed: false, version: '' };
    let queryTime = 0;
    
    const client = await this.pool.connect();
    try {
      // Test basic connectivity with timing
      const queryStart = Date.now();
      await client.query('SELECT 1');
      queryTime = Date.now() - queryStart;
      
      // Check TimescaleDB status
      const tsResult = await client.query(`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'timescaledb'
      `);
      
      if (tsResult.rows.length > 0) {
        timescaledbInfo = {
          installed: true,
          version: tsResult.rows[0].extversion
        };
      }
      
      // Get pool connection statistics
      const poolStats = {
        total: this.pool.totalCount,
        active: this.pool.totalCount - this.pool.idleCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };
      
      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (queryTime > this.config.healthCheck.timeoutMs) {
        status = 'degraded';
      }
      
      if (!timescaledbInfo.installed) {
        status = 'unhealthy';
      }
      
      const totalTime = Date.now() - startTime;
      
      return {
        status,
        timestamp: new Date(),
        connections: poolStats,
        timescaledb: timescaledbInfo,
        performance: {
          queryTimeMs: queryTime,
          avgResponseTime: totalTime
        }
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Setup backup strategy
   */
  private async setupBackupStrategy(): Promise<void> {
    console.log('🔄 Setting up backup strategy...');
    
    // Create backup directory if it doesn't exist
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const backupDir = path.resolve(this.config.backup.location);
    
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
      console.log('📁 Created backup directory:', backupDir);
    }
    
    // Schedule regular backups
    setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        console.error('❌ Backup failed:', error);
        this.emit('backup_error', error);
      }
    }, this.config.backup.intervalHours * 60 * 60 * 1000);
    
    console.log('✅ Backup strategy configured');
  }

  /**
   * Perform database backup
   */
  public async performBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup-${timestamp}.sql`;
    const backupPath = `${this.config.backup.location}/${backupFile}`;
    
    console.log('🔄 Creating backup:', backupPath);
    
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        '-h', this.config.host,
        '-p', this.config.port.toString(),
        '-U', this.config.user,
        '-d', this.config.database,
        '-f', backupPath,
        '--verbose',
        '--no-password'
      ], {
        env: {
          ...process.env,
          PGPASSWORD: this.config.password
        }
      });
      
      pgDump.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Backup completed:', backupPath);
          this.emit('backup_completed', backupPath);
          resolve(backupPath);
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });
      
      pgDump.on('error', reject);
    });
  }

  /**
   * Cleanup old backups based on retention policy
   */
  public async cleanupOldBackups(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const backupDir = this.config.backup.location;
    const retentionMs = this.config.backup.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;
    
    try {
      const files = await fs.readdir(backupDir);
      
      for (const file of files) {
        if (file.startsWith('backup-') && file.endsWith('.sql')) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtimeMs < cutoffTime) {
            await fs.unlink(filePath);
            console.log('🗑️  Removed old backup:', file);
          }
        }
      }
    } catch (error) {
      console.error('❌ Backup cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get database connection for queries
   */
  public async getConnection(): Promise<Pool> {
    if (!this.isConnected) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Gracefully close all connections
   */
  public async close(): Promise<void> {
    console.log('🔄 Closing database connections...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    await this.pool.end();
    this.isConnected = false;
    this.emit('disconnected');
    
    console.log('✅ Database connections closed');
  }
}

/**
 * Default database configuration for development
 */
export const getDefaultDatabaseConfig = (): DatabaseConfig => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'algo_trading_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  connectionPool: {
    max: 20, // As per task requirements
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  },
  healthCheck: {
    intervalMs: 30000, // Check every 30 seconds
    timeoutMs: 5000    // Timeout after 5 seconds
  },
  backup: {
    enabled: process.env.NODE_ENV === 'production',
    intervalHours: 24,
    retentionDays: 7,
    location: './backups'
  }
});