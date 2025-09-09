#!/usr/bin/env ts-node

/**
 * Task DB-001: Database Setup Script
 * 
 * This script handles the complete setup of PostgreSQL with TimescaleDB extension
 * according to the requirements in COMPLETE_TASK_LIST.md
 * 
 * Usage:
 *   npm run setup:database
 *   or
 *   npx ts-node scripts/setup-database.ts
 */

import { DatabaseSetup, getDefaultDatabaseConfig, DatabaseConfig } from '../src/backend/database/DatabaseSetup.js';
import { config } from 'dotenv';

// Load environment variables from .env.database file
config({ path: '.env.database' });

interface SetupOptions {
  skipBackup?: boolean;
  testConnection?: boolean;
  createDatabase?: boolean;
  verbose?: boolean;
}

/**
 * Main setup function
 */
async function setupDatabase(options: SetupOptions = {}) {
  console.log('🚀 Starting Database Setup - Task DB-001');
  console.log('================================================');
  
  try {
    // Get configuration
    const dbConfig = getDatabaseConfigFromEnv();
    
    if (options.verbose) {
      console.log('📋 Database Configuration:');
      console.log(`   Host: ${dbConfig.host}`);
      console.log(`   Port: ${dbConfig.port}`);
      console.log(`   Database: ${dbConfig.database}`);
      console.log(`   User: ${dbConfig.user}`);
      console.log(`   SSL: ${dbConfig.ssl ? 'enabled' : 'disabled'}`);
      console.log(`   Max Connections: ${dbConfig.connectionPool.max}`);
      console.log('');
    }
    
    // Create database if requested
    if (options.createDatabase) {
      await createDatabaseIfNotExists(dbConfig);
    }
    
    // Initialize database setup
    const dbSetup = new DatabaseSetup(dbConfig);
    
    // Set up event listeners for feedback
    dbSetup.on('connected', () => {
      console.log('✅ Database connected successfully');
    });
    
    dbSetup.on('health_check', (health) => {
      if (options.verbose) {
        console.log('💓 Health check:', health.status);
      }
    });
    
    dbSetup.on('backup_completed', (backupPath) => {
      console.log('💾 Backup completed:', backupPath);
    });
    
    dbSetup.on('error', (error) => {
      console.error('❌ Database error:', error.message);
    });
    
    // Initialize the database
    await dbSetup.initialize();
    
    // Test connection if requested
    if (options.testConnection) {
      console.log('🔄 Testing database connection...');
      const health = await dbSetup.checkHealth();
      
      console.log('📊 Database Health Report:');
      console.log(`   Status: ${health.status}`);
      console.log(`   Connections: ${health.connections.active}/${health.connections.total}`);
      console.log(`   TimescaleDB: ${health.timescaledb.installed ? 'installed' : 'not installed'}`);
      console.log(`   Query Time: ${health.performance.queryTimeMs}ms`);
      console.log(`   Response Time: ${health.performance.avgResponseTime}ms`);
    }
    
    // Perform initial backup if enabled and not skipped
    if (dbConfig.backup.enabled && !options.skipBackup) {
      console.log('🔄 Creating initial backup...');
      try {
        const backupPath = await dbSetup.performBackup();
        console.log('✅ Initial backup created:', backupPath);
      } catch (error) {
        console.warn('⚠️  Initial backup failed:', (error as Error).message);
        console.warn('   This is normal if pg_dump is not available in PATH');
      }
    }
    
    console.log('');
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run migrations: npm run migrate');
    console.log('  2. Start the application: npm start');
    console.log('  3. Check health: http://localhost:3001/api/health/database');
    
    // Close connection
    await dbSetup.close();
    
  } catch (error) {
    console.error('💥 Database setup failed:');
    console.error('   ', (error as Error).message);
    
    if (options.verbose && error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
    
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('  1. Ensure PostgreSQL 15+ is installed and running');
    console.log('  2. Verify database credentials in .env file');
    console.log('  3. Check if TimescaleDB extension is available');
    console.log('  4. Ensure database exists or use --create-database flag');
    
    process.exit(1);
  }
}

/**
 * Create database if it doesn't exist
 */
async function createDatabaseIfNotExists(config: DatabaseConfig): Promise<void> {
  console.log('🔄 Checking if database exists...');
  
  const { Client } = await import('pg');
  
  // Connect to postgres database to create the target database
  const client = new Client({
    host: config.host,
    port: config.port,
    database: 'postgres', // Connect to default postgres database
    user: config.user,
    password: config.password,
    ssl: config.ssl
  });
  
  try {
    await client.connect();
    
    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database]
    );
    
    if (result.rows.length === 0) {
      console.log(`🔄 Creating database: ${config.database}`);
      await client.query(`CREATE DATABASE "${config.database}"`);
      console.log('✅ Database created successfully');
    } else {
      console.log('✅ Database already exists');
    }
    
  } finally {
    await client.end();
  }
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfigFromEnv(): DatabaseConfig {
  const baseConfig = getDefaultDatabaseConfig();
  
  return {
    ...baseConfig,
    host: process.env.DB_HOST || baseConfig.host,
    port: parseInt(process.env.DB_PORT || baseConfig.port.toString()),
    database: process.env.DB_NAME || baseConfig.database,
    user: process.env.DB_USER || baseConfig.user,
    password: process.env.DB_PASSWORD || baseConfig.password,
    ssl: process.env.DB_SSL_ENABLED === 'true' ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_SSL_CA_PATH ? require('fs').readFileSync(process.env.DB_SSL_CA_PATH) : undefined,
      cert: process.env.DB_SSL_CERT_PATH ? require('fs').readFileSync(process.env.DB_SSL_CERT_PATH) : undefined,
      key: process.env.DB_SSL_KEY_PATH ? require('fs').readFileSync(process.env.DB_SSL_KEY_PATH) : undefined,
    } : false,
    connectionPool: {
      max: parseInt(process.env.DB_POOL_MAX || baseConfig.connectionPool.max.toString()),
      min: parseInt(process.env.DB_POOL_MIN || baseConfig.connectionPool.min.toString()),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || baseConfig.connectionPool.idleTimeoutMillis.toString()),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || baseConfig.connectionPool.connectionTimeoutMillis.toString())
    },
    healthCheck: {
      intervalMs: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || baseConfig.healthCheck.intervalMs.toString()),
      timeoutMs: parseInt(process.env.DB_HEALTH_CHECK_TIMEOUT || baseConfig.healthCheck.timeoutMs.toString())
    },
    backup: {
      enabled: process.env.BACKUP_ENABLED === 'true' || baseConfig.backup.enabled,
      intervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS || baseConfig.backup.intervalHours.toString()),
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || baseConfig.backup.retentionDays.toString()),
      location: process.env.BACKUP_LOCATION || baseConfig.backup.location
    }
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);
  const options: SetupOptions = {};
  
  for (const arg of args) {
    switch (arg) {
      case '--skip-backup':
        options.skipBackup = true;
        break;
      case '--test-connection':
        options.testConnection = true;
        break;
      case '--create-database':
        options.createDatabase = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log('Database Setup Script - Task DB-001');
        console.log('');
        console.log('Options:');
        console.log('  --skip-backup      Skip initial backup creation');
        console.log('  --test-connection  Test database connection after setup');
        console.log('  --create-database  Create database if it doesn\'t exist');
        console.log('  --verbose, -v      Show detailed output');
        console.log('  --help, -h         Show this help message');
        process.exit(0);
    }
  }
  
  return options;
}

// Run the setup if this script is executed directly
if (require.main === module) {
  const options = parseArgs();
  setupDatabase(options).catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}