/**
 * Migration Manager Integration for DatabaseManager
 * Task DB-003: Database Migration System Implementation
 * 
 * TypeScript wrapper for the Node.js migration system that integrates
 * with the existing DatabaseManager for programmatic migration control.
 */

import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { DatabaseManager } from './DatabaseManager';

export interface MigrationStatus {
  version: string;
  name: string;
  applied: boolean;
  appliedAt: Date | null;
  checksum?: string;
  executionTime?: number;
}

export interface MigrationSummary {
  totalMigrations: number;
  appliedMigrations: number;
  pendingMigrations: number;
  migrations: MigrationStatus[];
  lastMigration?: {
    version: string;
    name: string;
    appliedAt: Date;
  };
}

export interface MigrationResult {
  success: boolean;
  output: string;
  error?: string;
  migrationsApplied?: number;
  executionTime?: number;
}

export interface MigrationOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  timeout?: number;
  performanceTarget?: number; // Target execution time in ms (default: 30000)
  checkDependencies?: boolean; // Enable dependency validation
  createBackup?: boolean; // Create backup before migration
}

/**
 * Migration Manager for programmatic migration control
 */
export class MigrationManager {
  private readonly migrationScriptPath: string;
  private readonly databaseManager: DatabaseManager;

  constructor(databaseManager?: DatabaseManager) {
    this.migrationScriptPath = path.join(process.cwd(), 'database', 'migrate.js');
    this.databaseManager = databaseManager || DatabaseManager.getInstance();
  }

  /**
   * Check if migration system is properly set up
   */
  async isSetupValid(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if migration script exists
      await fs.access(this.migrationScriptPath);
    } catch (error) {
      errors.push(`Migration script not found: ${this.migrationScriptPath}`);
    }

    try {
      // Check if migrations directory exists
      const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
      await fs.access(migrationsDir);
    } catch (error) {
      errors.push('Migrations directory not found');
    }

    try {
      // Check if rollbacks directory exists
      const rollbacksDir = path.join(process.cwd(), 'database', 'migrations', 'rollbacks');
      await fs.access(rollbacksDir);
    } catch (error) {
      errors.push('Rollbacks directory not found');
    }

    // Check database connection
    try {
      await this.databaseManager.initialize();
      const healthStatus = await this.databaseManager.getHealthStatus();
      if (healthStatus.database.some(check => check.status !== 'healthy')) {
        errors.push('Database health check failed');
      }
    } catch (error) {
      errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get current migration status
   */
  async getStatus(): Promise<MigrationSummary> {
    const result = await this.runMigrationCommand(['status'], { verbose: false });
    
    if (!result.success) {
      throw new Error(`Failed to get migration status: ${result.error}`);
    }

    // Parse the output to extract migration information
    // This is a simplified parser - in production, you might want to enhance this
    const lines = result.output.split('\n');
    const migrations: MigrationStatus[] = [];
    let totalMigrations = 0;
    let appliedMigrations = 0;
    let pendingMigrations = 0;

    for (const line of lines) {
      if (line.includes('Total migration files:')) {
        totalMigrations = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Applied migrations:')) {
        appliedMigrations = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Pending migrations:')) {
        pendingMigrations = parseInt(line.split(':')[1].trim());
      } else if (line.includes('|') && (line.includes('✓ APPLIED') || line.includes('○ PENDING'))) {
        const parts = line.split('|').map(part => part.trim());
        if (parts.length >= 4) {
          const applied = parts[0].includes('✓ APPLIED');
          const version = parts[1];
          const name = parts[2];
          const appliedAt = parts[3] !== 'N/A' ? new Date(parts[3]) : null;

          migrations.push({
            version,
            name,
            applied,
            appliedAt
          });
        }
      }
    }

    const lastMigration = migrations.find(m => m.applied);

    return {
      totalMigrations,
      appliedMigrations,
      pendingMigrations,
      migrations,
      lastMigration: lastMigration ? {
        version: lastMigration.version,
        name: lastMigration.name,
        appliedAt: lastMigration.appliedAt!
      } : undefined
    };
  }

  /**
   * Apply all pending migrations
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    // Set performance target default
    const performanceTarget = options.performanceTarget || 30000; // 30 seconds
    
    // Validate setup first
    const setupValidation = await this.isSetupValid();
    if (!setupValidation.valid && !options.force) {
      throw new Error(`Migration setup invalid: ${setupValidation.errors.join(', ')}`);
    }

    // Check dependencies if enabled
    if (options.checkDependencies !== false) {
      const depCheck = await this.validateDependencies();
      if (!depCheck.valid && !options.force) {
        throw new Error(`Dependency validation failed: ${depCheck.issues.join(', ')}`);
      }
    }

    // Create backup if requested
    if (options.createBackup) {
      const backup = await this.createBackup();
      if (!backup.success && !options.force) {
        throw new Error(`Backup creation failed: ${backup.error}`);
      }
    }

    const args = ['migrate'];
    
    if (options.dryRun) args.push('--dry-run');
    if (options.force) args.push('--force');
    if (!options.verbose) args.push('--quiet');

    // Set timeout based on performance target
    const migrationOptions = {
      ...options,
      timeout: Math.max(options.timeout || 0, performanceTarget)
    };

    const result = await this.runMigrationCommand(args, migrationOptions);
    
    // Validate performance target
    if (result.executionTime && result.executionTime > performanceTarget) {
      console.warn(`⚠️ Migration exceeded performance target: ${result.executionTime}ms > ${performanceTarget}ms`);
    }

    return result;
  }

  /**
   * Apply migrations up to a specific version
   */
  async migrateToVersion(version: string, options: MigrationOptions = {}): Promise<MigrationResult> {
    const args = ['migrate', version];
    
    if (options.dryRun) args.push('--dry-run');
    if (options.force) args.push('--force');
    if (!options.verbose) args.push('--quiet');

    return this.runMigrationCommand(args, options);
  }

  /**
   * Rollback migrations with enhanced safety and data integrity
   */
  async rollback(options: MigrationOptions & { count?: number; toVersion?: string } = {}): Promise<MigrationResult> {
    // Set rollback target (default: 15 seconds)
    const rollbackTarget = 15000; 
    
    // Validate setup first
    const setupValidation = await this.isSetupValid();
    if (!setupValidation.valid && !options.force) {
      throw new Error(`Migration setup invalid: ${setupValidation.errors.join(', ')}`);
    }

    // Create backup before rollback if requested
    if (options.createBackup) {
      const backup = await this.createBackup();
      if (!backup.success && !options.force) {
        throw new Error(`Pre-rollback backup failed: ${backup.error}`);
      }
    }

    // Validate rollback integrity
    if (!options.dryRun) {
      const integrity = await this.validateIntegrity();
      if (!integrity.valid && !options.force) {
        throw new Error(`Rollback integrity check failed: ${integrity.issues.join(', ')}`);
      }
    }

    const args = ['rollback'];
    
    if (options.toVersion) {
      args.push('--to', options.toVersion);
    } else if (options.count) {
      args.push('--count', options.count.toString());
    }

    if (options.dryRun) args.push('--dry-run');
    if (options.force) args.push('--force');
    if (!options.verbose) args.push('--quiet');

    // Set timeout for rollback operations
    const rollbackOptions = {
      ...options,
      timeout: Math.max(options.timeout || 0, rollbackTarget)
    };

    const result = await this.runMigrationCommand(args, rollbackOptions);
    
    // Validate rollback performance target
    if (result.executionTime && result.executionTime > rollbackTarget) {
      console.warn(`⚠️ Rollback exceeded performance target: ${result.executionTime}ms > ${rollbackTarget}ms`);
    }

    // Post-rollback validation
    if (result.success && !options.dryRun) {
      try {
        const postRollbackIntegrity = await this.validateIntegrity();
        if (!postRollbackIntegrity.valid && !options.force) {
          console.warn('⚠️ Post-rollback integrity issues detected:', postRollbackIntegrity.issues);
        }
      } catch (error) {
        console.warn('⚠️ Post-rollback validation failed:', error);
      }
    }

    return result;
  }

  /**
   * Create a new migration
   */
  async createMigration(name: string): Promise<{ version: string; files: { migration: string; rollback: string } }> {
    const result = await this.runMigrationCommand(['create', name], { verbose: true });
    
    if (!result.success) {
      throw new Error(`Failed to create migration: ${result.error}`);
    }

    // Parse the output to extract file paths
    const lines = result.output.split('\n');
    let version = '';
    let migrationPath = '';
    let rollbackPath = '';

    for (const line of lines) {
      if (line.includes('Created migration files:')) {
        // Extract version from the next few lines
        const versionMatch = line.match(/(\d{14})/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      } else if (line.includes('Forward:')) {
        migrationPath = line.split('Forward:')[1].trim();
      } else if (line.includes('Rollback:')) {
        rollbackPath = line.split('Rollback:')[1].trim();
      }
    }

    return {
      version,
      files: {
        migration: migrationPath,
        rollback: rollbackPath
      }
    };
  }

  /**
   * Validate migration integrity
   */
  async validateIntegrity(_options: MigrationOptions = {}): Promise<{ valid: boolean; issues: string[] }> {
    // Get current status
    const status = await this.getStatus();
    const issues: string[] = [];

    // Check for missing rollback files
    for (const migration of status.migrations) {
      if (migration.applied) {
        const rollbackPath = path.join(
          process.cwd(), 
          'database', 
          'migrations', 
          'rollbacks', 
          `${migration.version}_${migration.name}_down.sql`
        );

        try {
          await fs.access(rollbackPath);
        } catch (error) {
          issues.push(`Missing rollback file for migration ${migration.version}: ${migration.name}`);
        }
      }
    }

    // Check database connection
    try {
      const healthStatus = await this.databaseManager.getHealthStatus();
      if (healthStatus.database.some(check => check.status !== 'healthy')) {
        issues.push('Database health check failed');
      }
    } catch (error) {
      issues.push(`Database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get migration history from database
   */
  async getHistory(limit = 50): Promise<Array<{
    version: string;
    name: string;
    appliedAt: Date;
    success: boolean;
    executionTime: number;
    migrationType: 'up' | 'down';
    rolledBackAt?: Date;
  }>> {
    try {
      await this.databaseManager.initialize();
      
      const result = await this.databaseManager.query(`
        SELECT 
          version,
          name,
          applied_at,
          success,
          execution_time_ms,
          migration_type,
          rolled_back_at
        FROM schema_migrations
        ORDER BY applied_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map((row: any) => ({
        version: row.version,
        name: row.name,
        appliedAt: new Date(row.applied_at),
        success: row.success,
        executionTime: row.execution_time_ms || 0,
        migrationType: row.migration_type as 'up' | 'down',
        rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at) : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to get migration history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate migration dependencies
   */
  async validateDependencies(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const status = await this.getStatus();
      const migrations = status.migrations;
      
      // Check for gaps in migration sequence
      const appliedVersions = migrations
        .filter(m => m.applied)
        .map(m => parseInt(m.version))
        .sort((a, b) => a - b);
      
      for (let i = 1; i < appliedVersions.length; i++) {
        if (appliedVersions[i] !== appliedVersions[i - 1] + 1) {
          issues.push(`Gap in migration sequence: ${appliedVersions[i - 1]} -> ${appliedVersions[i]}`);
        }
      }
      
      // Check for missing migrations that should exist
      const allVersions = migrations.map(m => parseInt(m.version)).sort((a, b) => a - b);
      const maxVersion = Math.max(...allVersions);
      
      for (let v = 1; v <= maxVersion; v++) {
        const versionStr = String(v).padStart(3, '0');
        if (!migrations.find(m => m.version === versionStr)) {
          issues.push(`Missing migration file for version ${versionStr}`);
        }
      }
      
      // Check rollback file dependencies for applied migrations
      for (const migration of migrations.filter(m => m.applied)) {
        const rollbackPath = path.join(
          process.cwd(), 
          'database', 
          'migrations', 
          'rollbacks', 
          `${migration.version}_${migration.name}_down.sql`
        );
        
        try {
          await fs.access(rollbackPath);
        } catch (error) {
          issues.push(`Missing rollback file for applied migration ${migration.version}: ${migration.name}`);
        }
      }
      
    } catch (error) {
      issues.push(`Dependency validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Create database backup before migration
   */
  async createBackup(): Promise<{ success: boolean; backupPath?: string; error?: string }> {
    try {
      // Import DatabaseSetup for backup functionality
      const { DatabaseSetup, getDefaultDatabaseConfig } = await import('./DatabaseSetup.js');
      
      const dbSetup = new DatabaseSetup(getDefaultDatabaseConfig());
      await dbSetup.initialize();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(process.cwd(), 'database', 'backups', `pre_migration_${timestamp}.sql`);
      
      // Use the existing backup system from DB-001
      const backupResult = await dbSetup.performBackup();
      await dbSetup.close();
      
      console.log(`[MigrationManager] Backup created successfully: ${backupResult}`);
      return {
        success: true,
        backupPath: backupResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown backup error'
      };
    }
  }

  /**
   * Run migration command and capture output
   */
  private async runMigrationCommand(args: string[], options: MigrationOptions = {}): Promise<MigrationResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let output = '';
      let errorOutput = '';

      const spawnOptions: SpawnOptions = {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      };

      // Set timeout if specified
      const timeout = options.timeout || 300000; // 5 minutes default

      const child = spawn('node', [this.migrationScriptPath, ...args], spawnOptions);

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: output,
          error: 'Migration timeout exceeded',
          executionTime: Date.now() - startTime
        });
      }, timeout);

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        const executionTime = Date.now() - startTime;
        const success = code === 0;
        
        // Count migrations applied (simple heuristic)
        const migrationsApplied = output.split('Migration').length - 1;

        resolve({
          success,
          output: output || errorOutput,
          error: success ? undefined : errorOutput || 'Migration failed',
          migrationsApplied: success ? migrationsApplied : undefined,
          executionTime
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: output,
          error: error.message,
          executionTime: Date.now() - startTime
        });
      });
    });
  }
}

// Export singleton instance
let migrationManagerInstance: MigrationManager | null = null;

export const getMigrationManager = (databaseManager?: DatabaseManager): MigrationManager => {
  if (!migrationManagerInstance) {
    migrationManagerInstance = new MigrationManager(databaseManager);
  }
  return migrationManagerInstance;
};

export default MigrationManager;