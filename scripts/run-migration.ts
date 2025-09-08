#!/usr/bin/env ts-node

/**
 * Database Migration Runner - Task DB-002
 * 
 * Executes database migrations in the correct order with validation
 * and rollback capabilities.
 */

import { DatabaseSetup, getDefaultDatabaseConfig } from '../src/backend/database/DatabaseSetup.js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config();

interface Migration {
  version: string;
  filename: string;
  description: string;
  sql: string;
}

interface MigrationOptions {
  targetVersion?: string;
  dryRun?: boolean;
  validate?: boolean;
  force?: boolean;
  rollback?: boolean;
}

/**
 * Migration runner class
 */
class MigrationRunner {
  private dbSetup: DatabaseSetup;
  private migrationsDir: string;

  constructor() {
    const dbConfig = getDefaultDatabaseConfig();
    this.dbSetup = new DatabaseSetup(dbConfig);
    this.migrationsDir = path.join(__dirname, '../src/backend/database/migrations');
  }

  /**
   * Run migrations
   */
  async run(options: MigrationOptions = {}): Promise<void> {
    try {
      console.log('🚀 Starting Database Migration - Task DB-002');
      console.log('================================================');

      // Initialize database connection
      await this.dbSetup.initialize();
      const pool = await this.dbSetup.getConnection();

      // Setup migration tracking table
      await this.setupMigrationTracking(pool);

      // Get current version
      const currentVersion = await this.getCurrentVersion(pool);
      console.log(`📋 Current schema version: ${currentVersion || 'None'}`);

      // Load available migrations
      const migrations = await this.loadMigrations();
      console.log(`📦 Found ${migrations.length} migration(s)`);

      // Filter migrations to run
      const migrationsToRun = this.filterMigrations(
        migrations, 
        currentVersion, 
        options.targetVersion
      );

      if (migrationsToRun.length === 0) {
        console.log('✅ Database is up to date, no migrations needed');
        return;
      }

      console.log(`🔄 Planning to run ${migrationsToRun.length} migration(s):`);
      migrationsToRun.forEach(m => 
        console.log(`   - ${m.version}: ${m.description}`)
      );

      if (options.dryRun) {
        console.log('🏃 Dry run mode - no changes will be made');
        return;
      }

      // Execute migrations
      for (const migration of migrationsToRun) {
        await this.executeMigration(pool, migration, options.force);
      }

      // Validate schema if requested
      if (options.validate) {
        await this.validateSchema(pool);
      }

      console.log('🎉 All migrations completed successfully!');

    } catch (error) {
      console.error('💥 Migration failed:', (error as Error).message);
      throw error;
    } finally {
      await this.dbSetup.close();
    }
  }

  /**
   * Setup migration tracking table
   */
  private async setupMigrationTracking(pool: any): Promise<void> {
    const migrationTableSql = await fs.readFile(
      path.join(__dirname, '../src/backend/database/schema_migrations.sql'),
      'utf-8'
    );

    await pool.query(migrationTableSql);
    console.log('📊 Migration tracking table ready');
  }

  /**
   * Get current schema version
   */
  private async getCurrentVersion(pool: any): Promise<string | null> {
    try {
      const result = await pool.query(
        'SELECT get_current_schema_version() as version'
      );
      return result.rows[0]?.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Load all migration files
   */
  private async loadMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];
    
    try {
      const files = await fs.readdir(this.migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

      for (const filename of sqlFiles) {
        const match = filename.match(/^(\d{3})_(.+)\.sql$/);
        if (match) {
          const version = match[1];
          const description = match[2].replace(/_/g, ' ');
          const filePath = path.join(this.migrationsDir, filename);
          const sql = await fs.readFile(filePath, 'utf-8');

          migrations.push({ version, filename, description, sql });
        }
      }
    } catch (error) {
      console.warn('⚠️  No migrations directory found, creating...');
      await fs.mkdir(this.migrationsDir, { recursive: true });
    }

    return migrations;
  }

  /**
   * Filter migrations based on current and target versions
   */
  private filterMigrations(
    migrations: Migration[],
    currentVersion: string | null,
    targetVersion?: string
  ): Migration[] {
    return migrations.filter(m => {
      if (currentVersion && m.version <= currentVersion) {
        return false;
      }
      if (targetVersion && m.version > targetVersion) {
        return false;
      }
      return true;
    });
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(
    pool: any,
    migration: Migration,
    force = false
  ): Promise<void> {
    console.log(`🔄 Running migration ${migration.version}: ${migration.description}`);
    
    const startTime = Date.now();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Record migration start
      await client.query(`
        INSERT INTO schema_migrations (version, description, status) 
        VALUES ($1, $2, 'running')
        ON CONFLICT (version) DO UPDATE SET 
          status = 'running', 
          applied_at = NOW()
      `, [migration.version, migration.description]);

      // Execute migration SQL
      await client.query(migration.sql);

      // Record migration completion
      const executionTime = Date.now() - startTime;
      await client.query(`
        UPDATE schema_migrations 
        SET status = 'completed', 
            completed_at = NOW(),
            execution_time_ms = $2
        WHERE version = $1
      `, [migration.version, executionTime]);

      await client.query('COMMIT');
      
      console.log(`✅ Migration ${migration.version} completed (${executionTime}ms)`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Record migration failure
      await client.query(`
        UPDATE schema_migrations 
        SET status = 'failed' 
        WHERE version = $1
      `, [migration.version]);

      console.error(`❌ Migration ${migration.version} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate schema integrity
   */
  private async validateSchema(pool: any): Promise<void> {
    console.log('🔍 Validating schema integrity...');
    
    try {
      const result = await pool.query('SELECT * FROM validate_schema_integrity()');
      
      console.log('📊 Schema Validation Results:');
      result.rows.forEach((row: any) => {
        const icon = row.status === 'PASS' ? '✅' : row.status === 'WARN' ? '⚠️' : '❌';
        console.log(`   ${icon} ${row.check_name}: ${row.details}`);
      });
      
      const failed = result.rows.filter((row: any) => row.status === 'FAIL');
      if (failed.length > 0) {
        throw new Error(`Schema validation failed: ${failed.length} checks failed`);
      }
      
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    try {
      await this.dbSetup.initialize();
      const pool = await this.dbSetup.getConnection();
      await this.setupMigrationTracking(pool);

      console.log('📊 Migration Status:');
      console.log('==================');

      const result = await pool.query(`
        SELECT version, description, status, applied_at, execution_time_ms
        FROM schema_migrations 
        ORDER BY version
      `);

      if (result.rows.length === 0) {
        console.log('No migrations found');
        return;
      }

      result.rows.forEach((row: any) => {
        const statusIcon = {
          'completed': '✅',
          'running': '🔄',
          'failed': '❌',
          'pending': '⏳'
        }[row.status] || '❓';

        const timeStr = row.execution_time_ms ? ` (${row.execution_time_ms}ms)` : '';
        console.log(`${statusIcon} ${row.version}: ${row.description} - ${row.status}${timeStr}`);
      });

    } finally {
      await this.dbSetup.close();
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; options: MigrationOptions } {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';
  const options: MigrationOptions = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--target':
        options.targetVersion = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--validate':
        options.validate = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--rollback':
        options.rollback = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Database Migration Tool - Task DB-002

Commands:
  migrate     Run pending migrations (default)
  status      Show migration status

Options:
  --target VERSION    Migrate to specific version
  --dry-run          Show what would be done without executing
  --validate         Validate schema integrity after migration
  --force            Force migration even if validation fails
  --rollback         Rollback to previous version (not implemented)
  --help, -h         Show this help

Examples:
  npm run migrate
  npm run migrate status
  npm run migrate -- --target 002 --validate
  npm run migrate -- --dry-run
        `);
        process.exit(0);
    }
  }

  return { command, options };
}

/**
 * Main execution
 */
async function main() {
  const { command, options } = parseArgs();
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'migrate':
        await runner.run(options);
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}