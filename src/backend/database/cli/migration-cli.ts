#!/usr/bin/env tsx
/**
 * Enhanced Migration CLI - Task DB-003: Database Migration System Implementation
 * 
 * Production-ready command-line interface for comprehensive database migration management
 * with validation, rollbacks, and comprehensive safety features.
 */

import { MigrationManager, getMigrationManager } from '../MigrationManager';
import { DatabaseManager } from '../DatabaseManager';

interface MigrationCliOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  timeout?: number;
  backup?: boolean;
  validate?: boolean;
}

/**
 * Enhanced Migration CLI Class
 */
class MigrationCli {
  private migrationManager: MigrationManager;
  private databaseManager: DatabaseManager;
  private options: MigrationCliOptions;

  constructor(options: MigrationCliOptions = {}) {
    this.options = {
      verbose: true,
      backup: false,
      validate: true,
      timeout: 300000, // 5 minutes
      ...options
    };
    
    this.databaseManager = DatabaseManager.getInstance();
    this.migrationManager = getMigrationManager(this.databaseManager);
  }

  /**
   * Log message with optional quiet mode
   */
  private log(message: string, ...args: any[]): void {
    if (!this.options.quiet) {
      console.log(`[${new Date().toISOString()}] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   */
  private error(message: string, ...args: any[]): void {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
  }

  /**
   * Initialize CLI components
   */
  async initialize(): Promise<void> {
    try {
      this.log('🔧 Initializing migration CLI...');
      await this.databaseManager.initialize();
      
      // Validate database connection
      const healthStatus = await this.databaseManager.getHealthStatus();
      const healthyChecks = healthStatus.database.filter(check => check.status === 'healthy');
      
      if (healthyChecks.length === 0) {
        throw new Error('Database health checks failed - cannot proceed with migration');
      }
      
      this.log(`✅ CLI initialized successfully (${healthyChecks.length}/${healthStatus.database.length} health checks passed)`);
    } catch (error) {
      this.error('Failed to initialize CLI:', error);
      throw error;
    }
  }

  /**
   * Run migration command
   */
  async migrate(targetVersion?: string): Promise<void> {
    this.log('🚀 Starting database migration...');
    
    try {
      // Validate setup
      if (this.options.validate) {
        this.log('🔍 Validating migration setup...');
        const setupValidation = await this.migrationManager.isSetupValid();
        if (!setupValidation.valid && !this.options.force) {
          throw new Error(`Migration setup invalid: ${setupValidation.errors.join(', ')}`);
        }
        
        if (!setupValidation.valid) {
          this.log('⚠️ Setup validation issues (continuing with --force):');
          setupValidation.errors.forEach(error => this.log(`  • ${error}`));
        }
      }
      
      // Create backup if requested
      if (this.options.backup || (!this.options.dryRun && !this.options.force)) {
        this.log('📦 Creating database backup...');
        const backup = await this.migrationManager.createBackup();
        if (!backup.success && !this.options.force) {
          throw new Error(`Backup creation failed: ${backup.error}`);
        }
        if (backup.success) {
          this.log(`✅ Backup created: ${backup.backupPath}`);
        }
      }
      
      // Get status before migration
      const preMigrationStatus = await this.migrationManager.getStatus();
      this.log(`📊 Current status: ${preMigrationStatus.appliedMigrations}/${preMigrationStatus.totalMigrations} migrations applied`);
      
      if (preMigrationStatus.pendingMigrations === 0 && !targetVersion) {
        this.log('✅ No pending migrations to apply');
        return;
      }
      
      // Apply migrations
      const result = await this.migrationManager.migrate({
        dryRun: this.options.dryRun,
        force: this.options.force,
        verbose: this.options.verbose,
        timeout: this.options.timeout,
        createBackup: this.options.backup,
        performanceTarget: 30000 // 30 seconds target
      });
      
      if (result.success) {
        this.log(`✅ Migration completed successfully in ${result.executionTime}ms`);
        if (result.migrationsApplied) {
          this.log(`📈 Applied ${result.migrationsApplied} migrations`);
        }
        
        // Show post-migration status
        const postMigrationStatus = await this.migrationManager.getStatus();
        this.log(`📊 Final status: ${postMigrationStatus.appliedMigrations}/${postMigrationStatus.totalMigrations} migrations applied`);
        
      } else {
        throw new Error(`Migration failed: ${result.error}`);
      }
      
    } catch (error) {
      this.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Run rollback command
   */
  async rollback(options: { toVersion?: string; count?: number } = {}): Promise<void> {
    this.log('⏪ Starting database rollback...');
    
    try {
      // Validate setup
      if (this.options.validate) {
        this.log('🔍 Validating rollback setup...');
        const integrity = await this.migrationManager.validateIntegrity();
        if (!integrity.valid && !this.options.force) {
          throw new Error(`Rollback integrity check failed: ${integrity.issues.join(', ')}`);
        }
        
        if (!integrity.valid) {
          this.log('⚠️ Integrity issues detected (continuing with --force):');
          integrity.issues.forEach(issue => this.log(`  • ${issue}`));
        }
      }
      
      // Create backup before rollback
      if (this.options.backup || (!this.options.dryRun && !this.options.force)) {
        this.log('📦 Creating pre-rollback backup...');
        const backup = await this.migrationManager.createBackup();
        if (!backup.success && !this.options.force) {
          throw new Error(`Pre-rollback backup failed: ${backup.error}`);
        }
        if (backup.success) {
          this.log(`✅ Pre-rollback backup created: ${backup.backupPath}`);
        }
      }
      
      // Execute rollback
      const result = await this.migrationManager.rollback({
        dryRun: this.options.dryRun,
        force: this.options.force,
        verbose: this.options.verbose,
        timeout: this.options.timeout,
        createBackup: false, // Already created above
        toVersion: options.toVersion,
        count: options.count || 1
      });
      
      if (result.success) {
        this.log(`✅ Rollback completed successfully in ${result.executionTime}ms`);
        
        // Show post-rollback status
        const postRollbackStatus = await this.migrationManager.getStatus();
        this.log(`📊 Final status: ${postRollbackStatus.appliedMigrations}/${postRollbackStatus.totalMigrations} migrations applied`);
        
      } else {
        throw new Error(`Rollback failed: ${result.error}`);
      }
      
    } catch (error) {
      this.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    this.log('📊 Retrieving migration status...');
    
    try {
      const status = await this.migrationManager.getStatus();
      
      console.log('\n=== MIGRATION STATUS ===\n');
      console.log(`📁 Total migration files: ${status.totalMigrations}`);
      console.log(`✅ Applied migrations: ${status.appliedMigrations}`);
      console.log(`⏳ Pending migrations: ${status.pendingMigrations}`);
      
      if (status.lastMigration) {
        console.log(`🏁 Last migration: ${status.lastMigration.version} - ${status.lastMigration.name}`);
        console.log(`📅 Applied at: ${status.lastMigration.appliedAt.toISOString()}`);
      }
      
      console.log('\n=== MIGRATION DETAILS ===\n');
      console.log('Status     | Version | Name                     | Applied At');
      console.log('-----------|---------|--------------------------|---------------------------');
      
      for (const migration of status.migrations) {
        const statusIcon = migration.applied ? '✅ APPLIED' : '⏳ PENDING';
        const appliedAt = migration.appliedAt 
          ? migration.appliedAt.toISOString().slice(0, 19).replace('T', ' ')
          : 'N/A';
        
        console.log(`${statusIcon.padEnd(10)} | ${migration.version.padEnd(7)} | ${migration.name.padEnd(24)} | ${appliedAt}`);
      }
      
      console.log('\n');
      
    } catch (error) {
      this.error('Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Show migration history
   */
  async history(limit = 20): Promise<void> {
    this.log(`📜 Retrieving migration history (last ${limit} entries)...`);
    
    try {
      const history = await this.migrationManager.getHistory(limit);
      
      if (history.length === 0) {
        this.log('📋 No migration history found');
        return;
      }
      
      console.log('\n=== MIGRATION HISTORY ===\n');
      console.log('Version | Name                     | Type | Status | Applied At           | Time (ms)');
      console.log('--------|--------------------------|------|--------|---------------------|----------');
      
      for (const entry of history) {
        const status = entry.success ? '✅ OK' : '❌ FAIL';
        const appliedAt = entry.appliedAt.toISOString().slice(0, 19).replace('T', ' ');
        const executionTime = entry.executionTime.toString().padStart(6);
        
        console.log(
          `${entry.version.padEnd(7)} | ` +
          `${entry.name.padEnd(24)} | ` +
          `${entry.migrationType.padEnd(4)} | ` +
          `${status.padEnd(6)} | ` +
          `${appliedAt} | ` +
          `${executionTime}`
        );
      }
      
      console.log('\n');
      
    } catch (error) {
      this.error('Failed to get migration history:', error);
      // Don't throw - this is informational
      this.log('ℹ️ Migration history may not be available if schema_migrations table does not exist');
    }
  }

  /**
   * Create new migration files
   */
  async create(name: string): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new Error('Migration name is required');
    }
    
    this.log(`📝 Creating new migration: ${name}`);
    
    try {
      const result = await this.migrationManager.createMigration(name);
      
      this.log(`✅ Migration files created successfully:`);
      this.log(`📄 Migration:  ${result.files.migration}`);
      this.log(`📄 Rollback:   ${result.files.rollback}`);
      this.log(`🔢 Version:    ${result.version}`);
      this.log('');
      this.log('📋 Next steps:');
      this.log('  1. Edit the migration file to add your changes');
      this.log('  2. Edit the rollback file to reverse those changes');
      this.log('  3. Test with --dry-run before applying');
      
    } catch (error) {
      this.error('Failed to create migration:', error);
      throw error;
    }
  }

  /**
   * Validate migration system
   */
  async validate(): Promise<void> {
    this.log('🔍 Validating migration system...');
    
    try {
      // Setup validation
      const setupValidation = await this.migrationManager.isSetupValid();
      console.log('\n=== SETUP VALIDATION ===\n');
      if (setupValidation.valid) {
        console.log('✅ Setup validation: PASSED');
      } else {
        console.log('❌ Setup validation: FAILED');
        setupValidation.errors.forEach(error => console.log(`  • ${error}`));
      }
      
      // Dependencies validation
      const depValidation = await this.migrationManager.validateDependencies();
      console.log('\n=== DEPENDENCY VALIDATION ===\n');
      if (depValidation.valid) {
        console.log('✅ Dependency validation: PASSED');
      } else {
        console.log('⚠️ Dependency validation: ISSUES FOUND');
        depValidation.issues.forEach(issue => console.log(`  • ${issue}`));
      }
      
      // Integrity validation
      const integrity = await this.migrationManager.validateIntegrity();
      console.log('\n=== INTEGRITY VALIDATION ===\n');
      if (integrity.valid) {
        console.log('✅ Integrity validation: PASSED');
      } else {
        console.log('⚠️ Integrity validation: ISSUES FOUND');
        integrity.issues.forEach(issue => console.log(`  • ${issue}`));
      }
      
      // Overall status
      const allValid = setupValidation.valid && depValidation.valid && integrity.valid;
      console.log('\n=== OVERALL STATUS ===\n');
      if (allValid) {
        console.log('✅ Migration system is ready for use');
      } else {
        console.log('⚠️ Migration system has issues that should be addressed');
      }
      
    } catch (error) {
      this.error('Validation failed:', error);
      throw error;
    }
  }

  /**
   * Display help information
   */
  displayHelp(): void {
    console.log(`
Enhanced Migration CLI v1.0.0 - Task DB-003

Usage:
  tsx migration-cli.ts <command> [options]

Commands:
  migrate [version]    Apply all pending migrations or up to specific version
  rollback [options]   Rollback migrations
  status              Show current migration status
  history [limit]     Show migration history (default: 20 entries)
  create <name>       Create new migration files
  validate            Validate migration system integrity
  help                Show this help message

Migration Options:
  --dry-run           Preview changes without applying them
  --force             Force execution even if validation fails
  --quiet             Suppress verbose output
  --timeout <ms>      Set operation timeout (default: 300000ms)
  --backup            Create backup before operations
  --no-validate       Skip validation steps

Rollback Options:
  --to <version>      Rollback to specific version
  --count <number>    Number of migrations to rollback (default: 1)

Examples:
  # Apply all pending migrations
  tsx migration-cli.ts migrate

  # Apply migrations up to version 003
  tsx migration-cli.ts migrate 003

  # Dry run migration to see what would happen
  tsx migration-cli.ts migrate --dry-run

  # Create a new migration
  tsx migration-cli.ts create "add user preferences table"

  # Rollback last migration
  tsx migration-cli.ts rollback

  # Rollback last 2 migrations
  tsx migration-cli.ts rollback --count 2

  # Rollback to specific version
  tsx migration-cli.ts rollback --to 001

  # Show migration status
  tsx migration-cli.ts status

  # Show migration history
  tsx migration-cli.ts history

  # Validate system integrity
  tsx migration-cli.ts validate

Safety Features:
  - Automatic backup creation (unless disabled)
  - Transaction-based operations with rollback on failure
  - Integrity validation before operations
  - Concurrent migration protection with advisory locks
  - Performance monitoring and timeout protection
  - Comprehensive error handling and recovery

For more information, see the Task DB-003 documentation.
`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.databaseManager) {
        await this.databaseManager.shutdown();
      }
    } catch (error) {
      this.log('Warning during cleanup:', error);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; args: string[]; options: MigrationCliOptions } {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const remainingArgs = args.slice(1);
  
  const options: MigrationCliOptions = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    verbose: !args.includes('--quiet'),
    quiet: args.includes('--quiet'),
    backup: args.includes('--backup'),
    validate: !args.includes('--no-validate'),
  };
  
  // Parse timeout
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    options.timeout = parseInt(args[timeoutIndex + 1]);
  }
  
  return { command, args: remainingArgs, options };
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const { command, args, options } = parseArgs();
  const cli = new MigrationCli(options);
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    console.log('\n🛑 Migration interrupted by user');
    await cli.cleanup();
    process.exit(1);
  });
  
  // Handle unhandled rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    await cli.cleanup();
    process.exit(1);
  });
  
  try {
    switch (command) {
      case 'migrate':
        await cli.initialize();
        await cli.migrate(args[0]);
        break;
        
      case 'rollback':
        await cli.initialize();
        const rollbackOptions: { toVersion?: string; count?: number } = {};
        
        const toIndex = args.indexOf('--to');
        if (toIndex !== -1 && args[toIndex + 1]) {
          rollbackOptions.toVersion = args[toIndex + 1];
        }
        
        const countIndex = args.indexOf('--count');
        if (countIndex !== -1 && args[countIndex + 1]) {
          rollbackOptions.count = parseInt(args[countIndex + 1]);
        }
        
        await cli.rollback(rollbackOptions);
        break;
        
      case 'status':
        await cli.initialize();
        await cli.status();
        break;
        
      case 'history':
        await cli.initialize();
        const limit = args[0] ? parseInt(args[0]) : 20;
        await cli.history(limit);
        break;
        
      case 'create':
        await cli.initialize();
        if (!args[0]) {
          throw new Error('Migration name is required for create command');
        }
        await cli.create(args[0]);
        break;
        
      case 'validate':
        await cli.initialize();
        await cli.validate();
        break;
        
      case 'help':
      case '--help':
      case '-h':
        cli.displayHelp();
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Use "tsx migration-cli.ts help" for usage information.');
        process.exit(1);
    }
    
    console.log('✅ Operation completed successfully');
    
  } catch (error) {
    console.error(`❌ Operation failed: ${error instanceof Error ? error.message : error}`);
    
    if (options.verbose && error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    await cli.cleanup();
  }
}

// Run the CLI
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MigrationCli };