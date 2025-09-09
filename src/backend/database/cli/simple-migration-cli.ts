#!/usr/bin/env node
/**
 * Simple Migration CLI Tool - Task BE-006: Data Migration from In-Memory Storage
 * 
 * Command-line interface for executing data migrations with comprehensive
 * monitoring, validation, and rollback capabilities.
 * 
 * Usage:
 *   npm run migrate:memory              # Run full migration from in-memory data
 *   npm run migrate:memory:dry-run      # Test migration without changes
 *   npm run migrate:memory:validate     # Validate migrated data only
 *   npm run migrate:memory:extract      # Extract in-memory data summary
 */

import chalk from 'chalk';
import ora from 'ora';
import { InMemoryDataExtractor } from '../migrators/InMemoryDataExtractor.js';
import { ZeroDowntimeMigrationOrchestrator } from '../migrators/ZeroDowntimeMigrationOrchestrator.js';
import { DataIntegrityValidator } from '../migrators/DataIntegrityValidator.js';
import { DataMigrationService } from '../DataMigrationService.js';

// =============================================================================
// SIMPLE CLI IMPLEMENTATION
// =============================================================================

class SimpleMemoryMigrationCLI {
  private readonly orchestrator: ZeroDowntimeMigrationOrchestrator;
  private readonly migrationService: DataMigrationService;
  private readonly validator: DataIntegrityValidator;
  private readonly extractor: InMemoryDataExtractor;

  constructor() {
    this.orchestrator = new ZeroDowntimeMigrationOrchestrator();
    this.migrationService = new DataMigrationService();
    this.validator = new DataIntegrityValidator();
    this.extractor = new InMemoryDataExtractor();
  }

  /**
   * Execute full migration with all features
   */
  async executeMigration(dryRun = false): Promise<void> {
    const spinner = ora('Initializing migration...').start();
    
    try {
      console.log(chalk.blue('\n🚀 BE-006: Data Migration from In-Memory Storage\n'));

      if (dryRun) {
        console.log(chalk.yellow('⚠️  DRY RUN MODE - No actual changes will be made\n'));
      }

      // Step 1: Extract current in-memory data
      spinner.text = 'Extracting in-memory data...';
      const extractionResult = await this.extractor.extractAllData({
        validateData: true,
        dryRun,
      });

      if (!extractionResult.success) {
        spinner.fail('Data extraction failed');
        console.error(chalk.red('\n❌ Extraction errors:'));
        extractionResult.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
        process.exit(1);
      }

      spinner.succeed(`Data extracted: ${extractionResult.stats.marketDataPoints + extractionResult.stats.strategyExecutions} items`);

      if (extractionResult.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Extraction warnings:'));
        extractionResult.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
      }

      // Step 2: Execute migration
      spinner.start('Executing migration...');
      
      const migrationResult = await this.migrationService.migrateAllData({
        dryRun,
        validateIntegrity: true,
        batchSize: 1000,
        maxConcurrency: 4,
        enableRollback: true,
        enableAuditLogging: true,
        progressCallback: (progress) => {
          spinner.text = `Migrating data... ${progress.progressPercent.toFixed(1)}% (${progress.processedItems}/${progress.totalItems})`;
        }
      });

      if (migrationResult.success) {
        spinner.succeed(`Migration completed: ${migrationResult.totalProcessed} items processed`);
        this.displayMigrationResults(migrationResult);
      } else {
        spinner.fail('Migration failed');
        console.error(chalk.red('\n❌ Migration errors:'));
        migrationResult.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
        process.exit(1);
      }

      // Step 3: Validate migrated data
      if (!dryRun) {
        spinner.start('Validating migrated data...');
        
        const validationResult = await this.validator.validateMigratedData({
          maxAllowedErrors: 100,
          maxAllowedWarnings: 1000,
          minDataQualityScore: 0.95,
        });

        if (validationResult.success) {
          spinner.succeed(`Data validation passed (score: ${validationResult.overallScore.toFixed(3)})`);
        } else {
          spinner.warn(`Data validation completed with issues (score: ${validationResult.overallScore.toFixed(3)})`);
          this.displayValidationSummary(validationResult);
        }
      }

      console.log(chalk.green('\n✅ Migration completed successfully!\n'));

    } catch (error) {
      spinner.fail('Migration failed with unexpected error');
      console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  }

  /**
   * Execute zero-downtime migration
   */
  async executeZeroDowntimeMigration(): Promise<void> {
    const spinner = ora('Initializing zero-downtime migration...').start();
    
    try {
      console.log(chalk.blue('\n🚀 BE-006: Zero-Downtime Migration from In-Memory Storage\n'));

      const migrationResult = await this.orchestrator.executeMigration({
        dryRun: false,
        validateIntegrity: true,
        enableRollback: true,
        maxDowntimeMs: 1000, // 1 second max
        enableRealTimeSync: true,
        syncInterval: 5000,
      });

      if (migrationResult.success) {
        spinner.succeed(`Zero-downtime migration completed (${migrationResult.actualDowntime}ms downtime)`);
        this.displayZeroDowntimeResults(migrationResult);
      } else {
        spinner.fail('Zero-downtime migration failed');
        console.error(chalk.red('\n❌ Migration errors:'));
        migrationResult.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
        process.exit(1);
      }

      console.log(chalk.green('\n✅ Zero-downtime migration completed successfully!\n'));

    } catch (error) {
      spinner.fail('Zero-downtime migration failed');
      console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  }

  /**
   * Run data validation only
   */
  async validateOnly(): Promise<void> {
    const spinner = ora('Running data validation...').start();
    
    try {
      console.log(chalk.blue('\n🔍 BE-006: Data Validation\n'));
      
      const validationResult = await this.validator.validateMigratedData({
        maxAllowedErrors: 100,
        maxAllowedWarnings: 1000,
        minDataQualityScore: 0.95,
      });

      if (validationResult.success) {
        spinner.succeed(`Validation passed (score: ${validationResult.overallScore.toFixed(3)})`);
      } else {
        spinner.warn(`Validation completed with issues (score: ${validationResult.overallScore.toFixed(3)})`);
      }

      this.displayValidationResults(validationResult);

      console.log(validationResult.success ? 
        chalk.green('\n✅ Data validation completed successfully!\n') :
        chalk.yellow('\n⚠️  Data validation completed with issues!\n')
      );

    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  }

  /**
   * Extract and display in-memory data summary
   */
  async extractOnly(): Promise<void> {
    const spinner = ora('Extracting in-memory data...').start();
    
    try {
      console.log(chalk.blue('\n📊 BE-006: In-Memory Data Extraction\n'));
      
      const extractionResult = await this.extractor.extractAllData({
        validateData: true,
        dryRun: true,
      });

      if (extractionResult.success && extractionResult.snapshot) {
        spinner.succeed('Data extraction completed');
        this.displayExtractionResults(extractionResult);
      } else {
        spinner.fail('Data extraction failed');
        console.error(chalk.red('\n❌ Extraction errors:'));
        extractionResult.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
        process.exit(1);
      }

      console.log(chalk.green('\n✅ Data extraction completed!\n'));

    } catch (error) {
      spinner.fail('Extraction failed');
      console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  }

  // =============================================================================
  // DISPLAY METHODS
  // =============================================================================

  /**
   * Display migration results
   */
  private displayMigrationResults(result: any): void {
    console.log(chalk.cyan('\n📈 Migration Results:'));
    console.log(`  • Total Processed: ${result.totalProcessed.toLocaleString()}`);
    console.log(`  • Success Rate: ${((result.totalSuccess / result.totalProcessed) * 100).toFixed(1)}%`);
    console.log(`  • Execution Time: ${(result.executionTimeMs / 1000).toFixed(1)}s`);
    console.log(`  • Throughput: ${Math.round(result.throughputPerSecond).toLocaleString()} items/s`);
    console.log(`  • Peak Memory: ${result.peakMemoryUsageMB.toFixed(1)}MB`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(chalk.yellow(`  • Errors: ${result.errors.length}`));
    }
    
    console.log('');
  }

  /**
   * Display zero-downtime migration results
   */
  private displayZeroDowntimeResults(result: any): void {
    console.log(chalk.cyan('\n📈 Zero-Downtime Migration Results:'));
    console.log(`  • Total Processed: ${result.totalProcessed.toLocaleString()}`);
    console.log(`  • Success Rate: ${((result.totalSuccess / result.totalProcessed) * 100).toFixed(1)}%`);
    console.log(`  • Execution Time: ${(result.executionTimeMs / 1000).toFixed(1)}s`);
    console.log(`  • Actual Downtime: ${result.actualDowntime}ms`);
    console.log(`  • Peak Throughput: ${Math.round(result.performanceMetrics.peakThroughput).toLocaleString()} items/s`);
    console.log(`  • Real-time Updates: ${result.syncStatistics.realTimeUpdates.toLocaleString()}`);
    console.log(`  • Sync Conflicts: ${result.syncStatistics.syncConflicts}`);
    
    console.log(chalk.cyan('\n📊 Phase Results:'));
    result.phaseResults.forEach((phase: any) => {
      const status = phase.success ? chalk.green('✅') : chalk.red('❌');
      console.log(`  ${status} ${phase.phase}: ${phase.duration}ms`);
    });
    
    console.log('');
  }

  /**
   * Display validation results
   */
  private displayValidationResults(result: any): void {
    console.log(chalk.cyan('\n🔍 Validation Results:'));
    console.log(`  • Overall Score: ${(result.overallScore * 100).toFixed(1)}%`);
    console.log(`  • Items Validated: ${result.totalItemsValidated.toLocaleString()}`);
    console.log(`  • Validation Time: ${(result.validationTimeMs / 1000).toFixed(1)}s`);
    
    if (result.criticalIssues && result.criticalIssues.length > 0) {
      console.log(chalk.red(`  • Critical Issues: ${result.criticalIssues.length}`));
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(chalk.red(`  • Errors: ${result.errors.length}`));
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow(`  • Warnings: ${result.warnings.length}`));
    }

    // Display category scores
    console.log(chalk.cyan('\n📊 Category Scores:'));
    if (result.syntaxValidation?.enabled) {
      console.log(`  • Syntax: ${(result.syntaxValidation.score * 100).toFixed(1)}%`);
    }
    if (result.semanticValidation?.enabled) {
      console.log(`  • Semantics: ${(result.semanticValidation.score * 100).toFixed(1)}%`);
    }
    if (result.businessLogicValidation?.enabled) {
      console.log(`  • Business Logic: ${(result.businessLogicValidation.score * 100).toFixed(1)}%`);
    }
    
    // Show top issues if any
    if (result.criticalIssues && result.criticalIssues.length > 0) {
      console.log(chalk.red('\n🚨 Critical Issues:'));
      result.criticalIssues.slice(0, 5).forEach((issue: any, index: number) => {
        console.log(chalk.red(`  ${index + 1}. ${issue.message}`));
      });
      if (result.criticalIssues.length > 5) {
        console.log(chalk.red(`     ... and ${result.criticalIssues.length - 5} more issues`));
      }
    }
    
    console.log('');
  }

  /**
   * Display validation summary (less verbose)
   */
  private displayValidationSummary(result: any): void {
    console.log(chalk.cyan('\n🔍 Validation Summary:'));
    console.log(`  • Score: ${(result.overallScore * 100).toFixed(1)}%`);
    console.log(`  • Issues: ${result.totalErrors} errors, ${result.totalWarnings} warnings`);
    
    if (result.criticalIssues && result.criticalIssues.length > 0) {
      console.log(chalk.red(`  • Critical Issues: ${result.criticalIssues.length} (requires attention)`));
    }
    
    console.log('');
  }

  /**
   * Display extraction results
   */
  private displayExtractionResults(result: any): void {
    if (!result.snapshot) return;

    console.log(chalk.cyan('\n📊 In-Memory Data Summary:'));
    console.log(`  • Market Data Points: ${result.stats.marketDataPoints.toLocaleString()}`);
    console.log(`  • Strategy Executions: ${result.stats.strategyExecutions.toLocaleString()}`);
    console.log(`  • Trade Records: ${result.stats.tradeRecords.toLocaleString()}`);
    console.log(`  • Portfolio Snapshots: ${result.stats.portfolioSnapshots.toLocaleString()}`);
    console.log(`  • Total Memory Usage: ${(result.snapshot.metadata.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  • Data Quality Score: ${(result.snapshot.metadata.dataQualityScore * 100).toFixed(1)}%`);
    console.log('');

    // Display symbol breakdown
    if (result.snapshot.marketData && result.snapshot.marketData.size > 0) {
      console.log(chalk.cyan('📈 Market Data by Symbol:'));
      const sortedSymbols = Array.from(result.snapshot.marketData.keys()).sort();
      sortedSymbols.slice(0, 5).forEach(symbol => {
        const count = result.snapshot.marketData.get(symbol)?.length || 0;
        console.log(`  • ${symbol}: ${count.toLocaleString()} candles`);
      });
      if (sortedSymbols.length > 5) {
        console.log(chalk.gray(`  ... and ${sortedSymbols.length - 5} more symbols`));
      }
      console.log('');
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Extraction Warnings:'));
      result.warnings.slice(0, 3).forEach((warning: string) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
      if (result.warnings.length > 3) {
        console.log(chalk.yellow(`  ... and ${result.warnings.length - 3} more warnings`));
      }
      console.log('');
    }
  }

  /**
   * Display help
   */
  displayHelp(): void {
    console.log(`
${chalk.blue('BE-006: Data Migration from In-Memory Storage CLI')}

${chalk.yellow('Commands:')}
  migrate            Execute full migration from in-memory storage
  migrate:dry        Test migration without making changes
  migrate:zero       Execute zero-downtime migration strategy
  validate           Validate migrated data integrity
  extract            Extract and display in-memory data summary
  help               Show this help message

${chalk.yellow('Examples:')}
  node simple-migration-cli.js migrate
  node simple-migration-cli.js migrate:dry
  node simple-migration-cli.js migrate:zero
  node simple-migration-cli.js validate
  node simple-migration-cli.js extract

${chalk.yellow('Description:')}
This CLI tool implements Task BE-006 requirements:
- ✅ Migration of existing trade history
- ✅ Data validation and integrity checks
- ✅ Zero downtime migration strategy
- ✅ Rollback procedures
- ✅ Comprehensive error handling and logging
- ✅ Performance optimization for large data transfers

${chalk.green('System Requirements:')}
- PostgreSQL database with TimescaleDB
- Active trading bot with in-memory data
- Sufficient memory for migration process

For detailed documentation, see Task BE-006 specification.
`);
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const command = process.argv[2] || 'help';
  const cli = new SimpleMemoryMigrationCLI();

  try {
    switch (command) {
      case 'migrate':
        await cli.executeMigration(false);
        break;
      
      case 'migrate:dry':
        await cli.executeMigration(true);
        break;
      
      case 'migrate:zero':
        await cli.executeZeroDowntimeMigration();
        break;
      
      case 'validate':
        await cli.validateOnly();
        break;
      
      case 'extract':
        await cli.extractOnly();
        break;
      
      case 'help':
      case '--help':
      case '-h':
      default:
        cli.displayHelp();
        break;
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ CLI Error: ${error instanceof Error ? error.message : String(error)}\n`));
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

export default SimpleMemoryMigrationCLI;