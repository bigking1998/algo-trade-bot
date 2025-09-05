#!/usr/bin/env node

/**
 * Database Migration Runner for Algorithmic Trading Bot
 * Task DB-003: Database Migration System Implementation
 * 
 * Production-ready migration system with version control, rollback capability,
 * validation, and comprehensive safety features.
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

// Configuration
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const ROLLBACKS_DIR = path.join(MIGRATIONS_DIR, 'rollbacks');
const MIGRATION_TABLE = 'schema_migrations';

/**
 * Migration Runner Class
 */
class MigrationRunner {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      verbose: true,
      force: false,
      timeout: 300000, // 5 minutes default
      ...options
    };
    
    this.pool = null;
    this.lockAcquired = false;
    this.currentMigration = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    const connectionString = this.getConnectionString();
    
    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      this.log(`Connected to database: ${result.rows[0].now}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get database connection string from environment or config
   */
  getConnectionString() {
    return process.env.DATABASE_URL || 
           `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'algo_trading_bot'}`;
  }

  /**
   * Ensure migration tracking table exists
   */
  async ensureMigrationTable() {
    const client = await this.pool.connect();
    
    try {
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [MIGRATION_TABLE]);

      if (!tableCheck.rows[0].exists) {
        this.log('Creating schema_migrations table...');
        
        if (!this.options.dryRun) {
          await client.query(`
            CREATE TABLE ${MIGRATION_TABLE} (
              id SERIAL PRIMARY KEY,
              version VARCHAR(50) UNIQUE NOT NULL,
              name VARCHAR(255) NOT NULL,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              checksum VARCHAR(64) NOT NULL,
              success BOOLEAN NOT NULL DEFAULT TRUE,
              execution_time_ms INTEGER,
              rolled_back_at TIMESTAMPTZ,
              rollback_reason TEXT,
              migration_type VARCHAR(20) NOT NULL DEFAULT 'up' CHECK (migration_type IN ('up', 'down')),
              file_path VARCHAR(500) NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `);
          
          // Create indexes
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON ${MIGRATION_TABLE}(version);
            CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON ${MIGRATION_TABLE}(applied_at);
            CREATE INDEX IF NOT EXISTS idx_schema_migrations_success ON ${MIGRATION_TABLE}(success) WHERE success = FALSE;
          `);
        }
        
        this.log('Schema migrations table created');
      }
    } finally {
      client.release();
    }
  }

  /**
   * Acquire migration lock to prevent concurrent migrations
   */
  async acquireLock() {
    const client = await this.pool.connect();
    
    try {
      // Use PostgreSQL advisory locks
      const lockId = 12345; // Unique ID for migration lock
      const result = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);
      
      if (result.rows[0].pg_try_advisory_lock) {
        this.lockAcquired = true;
        this.log('Migration lock acquired');
        return client; // Return client to keep lock
      } else {
        throw new Error('Another migration is already running. Please wait and try again.');
      }
    } catch (error) {
      client.release();
      throw error;
    }
  }

  /**
   * Release migration lock
   */
  async releaseLock(client) {
    if (this.lockAcquired && client) {
      try {
        const lockId = 12345;
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
        this.lockAcquired = false;
        this.log('Migration lock released');
      } finally {
        client.release();
      }
    }
  }

  /**
   * Get all migration files
   */
  async getMigrationFiles() {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter(file => file.endsWith('.sql') && !file.startsWith('.'))
      .sort()
      .map(file => ({
        version: file.split('_')[0],
        name: file.replace(/^\d+_/, '').replace(/\.sql$/, ''),
        filename: file,
        filepath: path.join(MIGRATIONS_DIR, file)
      }));
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT version, name, applied_at, checksum, success, rolled_back_at
        FROM ${MIGRATION_TABLE}
        WHERE success = TRUE AND rolled_back_at IS NULL
        ORDER BY applied_at ASC
      `);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate migration file checksum
   */
  async calculateChecksum(filepath) {
    const content = await fs.readFile(filepath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute migration file
   */
  async executeMigration(migration, type = 'up') {
    const startTime = Date.now();
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const filepath = type === 'up' ? migration.filepath : 
                      path.join(ROLLBACKS_DIR, migration.filename.replace('.sql', '_down.sql'));
      
      // Check if file exists
      try {
        await fs.access(filepath);
      } catch (error) {
        throw new Error(`Migration file not found: ${filepath}`);
      }

      const sql = await fs.readFile(filepath, 'utf8');
      const checksum = await this.calculateChecksum(filepath);
      
      this.log(`${type === 'up' ? 'Applying' : 'Rolling back'} migration: ${migration.version} - ${migration.name}`);
      
      if (this.options.dryRun) {
        this.log('DRY RUN - Migration SQL:');
        this.log(sql);
        await client.query('ROLLBACK');
        return { success: true, executionTime: 0, checksum };
      }
      
      // Execute migration with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Migration timeout')), this.options.timeout);
      });
      
      const migrationPromise = client.query(sql);
      await Promise.race([migrationPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      
      // Record migration in tracking table
      await client.query(`
        INSERT INTO ${MIGRATION_TABLE} (
          version, name, checksum, success, execution_time_ms, 
          migration_type, file_path, ${type === 'down' ? 'rolled_back_at,' : ''} rollback_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7${type === 'down' ? ', NOW(), $8' : ', $8'})
      `, type === 'down' 
        ? [migration.version, migration.name, checksum, true, executionTime, type, filepath, 'Manual rollback']
        : [migration.version, migration.name, checksum, true, executionTime, type, filepath, null]
      );

      await client.query('COMMIT');
      
      this.log(`Migration ${migration.version} ${type === 'up' ? 'applied' : 'rolled back'} successfully in ${executionTime}ms`);
      
      return { success: true, executionTime, checksum };
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Record failed migration
      if (!this.options.dryRun) {
        try {
          await client.query(`
            INSERT INTO ${MIGRATION_TABLE} (
              version, name, checksum, success, execution_time_ms, 
              migration_type, file_path, rollback_reason
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [migration.version, migration.name, 'error', false, Date.now() - startTime, type, migration.filepath, error.message]);
        } catch (recordError) {
          this.log('Failed to record migration error:', recordError.message);
        }
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Migrate to latest or specific version
   */
  async migrate(targetVersion = null) {
    await this.initialize();
    await this.ensureMigrationTable();
    
    const lockClient = await this.acquireLock();
    
    try {
      const migrationFiles = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      
      // Validate existing migrations integrity
      await this.validateMigrationIntegrity(appliedMigrations);
      
      // Filter pending migrations
      let pendingMigrations = migrationFiles.filter(m => !appliedVersions.has(m.version));
      
      if (targetVersion) {
        pendingMigrations = pendingMigrations.filter(m => m.version <= targetVersion);
      }
      
      if (pendingMigrations.length === 0) {
        this.log('No pending migrations to apply');
        return;
      }
      
      this.log(`Found ${pendingMigrations.length} pending migrations`);
      
      // Apply migrations
      for (const migration of pendingMigrations) {
        this.currentMigration = migration;
        await this.executeMigration(migration, 'up');
      }
      
      this.log(`Successfully applied ${pendingMigrations.length} migrations`);
      
    } finally {
      await this.releaseLock(lockClient);
    }
  }

  /**
   * Rollback to specific version
   */
  async rollback(targetVersion = null, count = 1) {
    await this.initialize();
    await this.ensureMigrationTable();
    
    const lockClient = await this.acquireLock();
    
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (appliedMigrations.length === 0) {
        this.log('No migrations to rollback');
        return;
      }
      
      let migrationsToRollback;
      
      if (targetVersion) {
        // Rollback to specific version
        migrationsToRollback = appliedMigrations
          .filter(m => m.version > targetVersion)
          .reverse();
      } else {
        // Rollback specified count
        migrationsToRollback = appliedMigrations
          .slice(-count)
          .reverse();
      }
      
      if (migrationsToRollback.length === 0) {
        this.log('No migrations to rollback');
        return;
      }
      
      this.log(`Rolling back ${migrationsToRollback.length} migrations`);
      
      for (const migration of migrationsToRollback) {
        this.currentMigration = migration;
        await this.executeMigration(migration, 'down');
      }
      
      this.log(`Successfully rolled back ${migrationsToRollback.length} migrations`);
      
    } finally {
      await this.releaseLock(lockClient);
    }
  }

  /**
   * Get migration status
   */
  async status() {
    await this.initialize();
    await this.ensureMigrationTable();
    
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    console.log('\n=== Migration Status ===\n');
    console.log(`Total migration files: ${migrationFiles.length}`);
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    console.log(`Pending migrations: ${migrationFiles.length - appliedMigrations.length}\n`);
    
    console.log('Migration Details:');
    console.log('Status | Version | Name | Applied At');
    console.log('-------|---------|------|------------');
    
    for (const file of migrationFiles) {
      const isApplied = appliedVersions.has(file.version);
      const appliedMig = appliedMigrations.find(m => m.version === file.version);
      const status = isApplied ? '✓ APPLIED' : '○ PENDING';
      const appliedAt = appliedMig ? appliedMig.applied_at.toISOString() : 'N/A';
      
      console.log(`${status} | ${file.version} | ${file.name} | ${appliedAt}`);
    }
    
    console.log('\n');
    
    return {
      totalMigrations: migrationFiles.length,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations: migrationFiles.length - appliedMigrations.length,
      migrations: migrationFiles.map(file => ({
        ...file,
        applied: appliedVersions.has(file.version),
        appliedAt: appliedVersions.has(file.version) 
          ? appliedMigrations.find(m => m.version === file.version)?.applied_at 
          : null
      }))
    };
  }

  /**
   * Create new migration file
   */
  async create(name) {
    if (!name) {
      throw new Error('Migration name is required');
    }
    
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const version = timestamp.slice(0, 8) + timestamp.slice(8, 14);
    const filename = `${version}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.sql`;
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const rollbackFilename = `${version}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_down.sql`;
    const rollbackFilepath = path.join(ROLLBACKS_DIR, rollbackFilename);
    
    const migrationTemplate = `-- Migration: ${filename}
-- Description: ${name}
-- Author: Generated by migration system
-- Created: ${new Date().toISOString()}
-- Dependencies: Previous migrations
-- Estimated execution time: TBD
-- 
-- Add your migration description and implementation details here

-- Migration metadata
-- Version: ${version}
-- Type: your_migration_type
-- Rollback: ${rollbackFilename}

BEGIN;

-- ==================================================
-- YOUR MIGRATION CODE HERE
-- ==================================================

-- Example:
-- CREATE TABLE example_table (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- CREATE INDEX idx_example_table_name ON example_table(name);

-- ==================================================
-- MIGRATION VALIDATION
-- ==================================================

-- Add validation queries to ensure migration succeeded
-- Example:
-- DO $$
-- BEGIN
--     -- Validate your changes here
--     RAISE NOTICE 'Migration ${version} validation completed';
-- END $$;

COMMIT;

-- ==================================================
-- MIGRATION COMPLETION LOG
-- ==================================================
SELECT 
    'Migration ${version} completed successfully' as status,
    NOW() as completed_at,
    '${name}' as description;
`;

    const rollbackTemplate = `-- Rollback Migration: ${rollbackFilename}
-- Description: Rollback ${name}
-- Author: Generated by migration system
-- Created: ${new Date().toISOString()}
-- Rollback for: ${filename}
-- 
-- Add your rollback description and implementation details here

-- Migration metadata
-- Version: ${version}_down
-- Type: rollback
-- Forward migration: ${filename}

BEGIN;

-- ==================================================
-- YOUR ROLLBACK CODE HERE
-- ==================================================

-- Example (reverse of forward migration):
-- DROP TABLE IF EXISTS example_table CASCADE;

-- ==================================================
-- ROLLBACK VALIDATION
-- ==================================================

-- Add validation queries to ensure rollback succeeded
-- DO $$
-- BEGIN
--     -- Validate your rollback here
--     RAISE NOTICE 'Rollback ${version} validation completed';
-- END $$;

COMMIT;

-- ==================================================
-- ROLLBACK COMPLETION LOG
-- ==================================================
SELECT 
    'Rollback ${version} completed successfully' as status,
    NOW() as completed_at,
    'Rollback of ${name}' as description;
`;

    await fs.writeFile(filepath, migrationTemplate);
    await fs.writeFile(rollbackFilepath, rollbackTemplate);
    
    this.log(`Created migration files:`);
    this.log(`  Forward:  ${filepath}`);
    this.log(`  Rollback: ${rollbackFilepath}`);
    
    return { version, filepath, rollbackFilepath };
  }

  /**
   * Validate migration integrity
   */
  async validateMigrationIntegrity(appliedMigrations) {
    this.log('Validating migration integrity...');
    
    for (const migration of appliedMigrations) {
      try {
        const migrationFile = await this.getMigrationFiles();
        const file = migrationFile.find(f => f.version === migration.version);
        
        if (file) {
          const currentChecksum = await this.calculateChecksum(file.filepath);
          if (currentChecksum !== migration.checksum) {
            console.warn(`WARNING: Checksum mismatch for migration ${migration.version}`);
            console.warn(`  Expected: ${migration.checksum}`);
            console.warn(`  Current:  ${currentChecksum}`);
            
            if (!this.options.force) {
              throw new Error(`Migration integrity check failed for ${migration.version}. Use --force to override.`);
            }
          }
        }
      } catch (error) {
        if (!this.options.force) {
          throw error;
        }
        console.warn(`Warning: ${error.message}`);
      }
    }
    
    this.log('Migration integrity validation completed');
  }

  /**
   * Backup database before major operations
   */
  async createBackup() {
    this.log('Creating database backup...');
    
    // This would integrate with the existing backup system
    // For now, just log the intent
    this.log('Backup creation would be implemented here');
    
    return true;
  }

  /**
   * Log message with timestamp
   */
  log(message, ...args) {
    if (this.options.verbose) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [MIGRATE] ${message}`, ...args);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: !args.includes('--quiet'),
    force: args.includes('--force'),
  };
  
  const runner = new MigrationRunner(options);
  
  try {
    switch (command) {
      case 'migrate':
        await runner.migrate(args[1]);
        break;
        
      case 'rollback':
        const target = args.includes('--to') ? args[args.indexOf('--to') + 1] : null;
        const count = args.includes('--count') ? parseInt(args[args.indexOf('--count') + 1]) : 1;
        await runner.rollback(target, count);
        break;
        
      case 'status':
        await runner.status();
        break;
        
      case 'create':
        if (!args[1]) {
          throw new Error('Migration name is required');
        }
        await runner.create(args[1]);
        break;
        
      default:
        console.log(`
Migration Runner for Algorithmic Trading Bot

Usage:
  node migrate.js <command> [options]

Commands:
  migrate [version]    Apply all pending migrations or up to specific version
  rollback [--to <version> | --count <n>]  Rollback migrations
  status               Show migration status
  create <name>        Create new migration files

Options:
  --dry-run           Show what would be executed without making changes
  --force             Force execution even if integrity checks fail
  --quiet             Suppress verbose logging

Examples:
  node migrate.js migrate              # Apply all pending migrations
  node migrate.js migrate 001          # Apply migrations up to version 001
  node migrate.js rollback --count 2   # Rollback last 2 migrations
  node migrate.js rollback --to 001    # Rollback to version 001
  node migrate.js status               # Show current migration status
  node migrate.js create "add indexes" # Create new migration
  node migrate.js migrate --dry-run    # Preview migrations without applying
`);
        break;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Export for programmatic use
module.exports = { MigrationRunner };

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}