# Database Migration System

**Task DB-003: Database Migration System Implementation**

A comprehensive, production-ready database migration system for the Algorithmic Trading Bot platform with version control, rollback capability, validation, and comprehensive safety features.

## 🎯 Overview

This migration system provides a robust foundation for evolving the trading platform's database schema over time with confidence and safety. It supports both command-line and programmatic interfaces, includes comprehensive validation, and integrates seamlessly with the existing DatabaseManager.

### ✨ Key Features

- **Version-Controlled Migrations**: Timestamp-based versioning with dependency tracking
- **Atomic Operations**: Each migration runs in a transaction for data integrity
- **Rollback Capability**: Complete rollback system with dependency checking
- **Migration Validation**: Checksum validation and integrity checking
- **Safety Features**: Dry-run mode, locking mechanism, backup integration
- **TypeScript Integration**: Full integration with existing DatabaseManager
- **Comprehensive Testing**: Complete test suite with validation

## 📁 Directory Structure

```
database/
├── migrate.js                    # Main migration runner (Node.js)
├── migration_tracker.sql         # Migration tracking table schema
├── migrations/                   # Forward migrations
│   ├── 001_initial_schema.sql           # Complete DB-002 schema
│   ├── 002_add_indexes.sql              # Performance optimizations
│   ├── 003_add_ml_strategy_fields.sql   # Future ML enhancements
│   └── rollbacks/                       # Rollback migrations
│       ├── 001_initial_schema_down.sql
│       ├── 002_add_indexes_down.sql
│       └── 003_add_ml_strategy_fields_down.sql
└── README.md                     # This documentation
```

## 🚀 Quick Start

### 1. Initialize Migration System

First, ensure the migration tracking table exists:

```bash
# Apply the migration tracker
psql -d algo_trading_bot -f database/migration_tracker.sql
```

### 2. Check Migration Status

```bash
# View current migration status
node database/migrate.js status
```

### 3. Apply Migrations

```bash
# Dry-run to preview changes
node database/migrate.js migrate --dry-run

# Apply all pending migrations
node database/migrate.js migrate

# Apply migrations up to specific version
node database/migrate.js migrate 002
```

### 4. Rollback if Needed

```bash
# Rollback last migration
node database/migrate.js rollback --count 1

# Rollback to specific version
node database/migrate.js rollback --to 001

# Dry-run rollback
node database/migrate.js rollback --count 1 --dry-run
```

## 📋 Command Reference

### Migration Commands

| Command | Description | Options |
|---------|-------------|---------|
| `migrate [version]` | Apply all pending migrations or up to specific version | `--dry-run`, `--force`, `--quiet` |
| `rollback` | Rollback migrations | `--to <version>`, `--count <n>`, `--dry-run`, `--force` |
| `status` | Show migration status and history | |
| `create <name>` | Create new migration files | |

### Command Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without applying them |
| `--force` | Force execution even if integrity checks fail |
| `--quiet` | Suppress verbose logging |
| `--to <version>` | Target version for rollback |
| `--count <n>` | Number of migrations to rollback |

### Examples

```bash
# Get detailed migration status
node database/migrate.js status

# Preview all pending migrations
node database/migrate.js migrate --dry-run

# Apply all migrations with verbose output
node database/migrate.js migrate

# Apply migrations up to version 002
node database/migrate.js migrate 002

# Create new migration
node database/migrate.js create "add user authentication"

# Rollback last 2 migrations
node database/migrate.js rollback --count 2

# Rollback to specific version
node database/migrate.js rollback --to 001

# Force migration despite integrity check failures
node database/migrate.js migrate --force
```

## 🔧 TypeScript Integration

### Basic Usage

```typescript
import { getMigrationManager } from './src/backend/database/MigrationManager';

const migrationManager = getMigrationManager();

// Check migration status
const status = await migrationManager.getStatus();
console.log(`Applied: ${status.appliedMigrations}, Pending: ${status.pendingMigrations}`);

// Apply migrations
const result = await migrationManager.migrate({ dryRun: false });
if (result.success) {
  console.log(`Applied ${result.migrationsApplied} migrations`);
} else {
  console.error('Migration failed:', result.error);
}

// Get migration history
const history = await migrationManager.getHistory();
```

### Integration with DatabaseManager

```typescript
import { DatabaseManager } from './src/backend/database/DatabaseManager';
import { MigrationManager } from './src/backend/database/MigrationManager';

const dbManager = DatabaseManager.getInstance();
const migrationManager = new MigrationManager(dbManager);

// Validate system before migrations
const validation = await migrationManager.isSetupValid();
if (!validation.valid) {
  console.error('Migration setup issues:', validation.errors);
  return;
}

// Create backup before major changes
const backup = await migrationManager.createBackup();
if (!backup.success) {
  console.error('Backup failed:', backup.error);
  return;
}

// Apply migrations
const result = await migrationManager.migrate();
```

## 📝 Creating New Migrations

### Using the CLI

```bash
# Create new migration with descriptive name
node database/migrate.js create "add portfolio rebalancing tables"
```

This creates two files:
- `migrations/YYYYMMDDHHMMSS_add_portfolio_rebalancing_tables.sql` (forward migration)
- `migrations/rollbacks/YYYYMMDDHHMMSS_add_portfolio_rebalancing_tables_down.sql` (rollback)

### Migration File Template

```sql
-- Migration: 004_your_migration_name.sql
-- Description: Brief description of what this migration does
-- Author: Your Name
-- Created: 2025-01-05
-- Dependencies: 003_previous_migration.sql
-- Estimated execution time: X-Y seconds

-- Migration metadata
-- Version: 004
-- Type: your_migration_type (schema_change, data_migration, performance, etc.)
-- Rollback: 004_your_migration_name_down.sql

BEGIN;

-- ==================================================
-- YOUR MIGRATION CODE HERE
-- ==================================================

-- Add your tables, indexes, data changes, etc.
CREATE TABLE example_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- MIGRATION VALIDATION
-- ==================================================

-- Add validation to ensure migration succeeded
DO $$
BEGIN
    -- Your validation logic here
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'example_table') THEN
        RAISE EXCEPTION 'Migration validation failed: example_table not created';
    END IF;
    
    RAISE NOTICE 'Migration 004 validation completed successfully';
END $$;

COMMIT;

-- Migration completion log
SELECT 'Migration 004 completed successfully' as status;
```

### Rollback File Template

```sql
-- Rollback Migration: 004_your_migration_name_down.sql
-- Description: Rollback your migration
-- Author: Your Name
-- Created: 2025-01-05
-- Rollback for: 004_your_migration_name.sql

BEGIN;

-- ==================================================
-- YOUR ROLLBACK CODE HERE
-- ==================================================

-- Reverse the changes made in forward migration
DROP TABLE IF EXISTS example_table CASCADE;

-- ==================================================
-- ROLLBACK VALIDATION
-- ==================================================

DO $$
BEGIN
    -- Validate rollback succeeded
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'example_table') THEN
        RAISE EXCEPTION 'Rollback validation failed: example_table still exists';
    END IF;
    
    RAISE NOTICE 'Rollback 004 validation completed successfully';
END $$;

COMMIT;

-- Rollback completion log
SELECT 'Rollback 004 completed successfully' as status;
```

## 🔒 Safety Features

### Migration Locking

The system uses PostgreSQL advisory locks to prevent concurrent migrations:

```sql
SELECT pg_try_advisory_lock(12345);
-- Migration runs here
SELECT pg_advisory_unlock(12345);
```

### Checksum Validation

Each migration's checksum is calculated and stored to detect file modifications:

```javascript
const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');
```

### Transaction Safety

All migrations run within transactions for atomicity:

```sql
BEGIN;
-- Migration code
-- If anything fails, entire migration rolls back
COMMIT;
```

### Dry-Run Mode

Preview migrations without applying them:

```bash
node database/migrate.js migrate --dry-run
```

### Backup Integration

Automatic backup creation before major operations:

```typescript
const backup = await migrationManager.createBackup();
```

## 📊 Migration Tracking

### Schema Migrations Table

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    execution_time_ms INTEGER,
    rolled_back_at TIMESTAMPTZ,
    rollback_reason TEXT,
    migration_type VARCHAR(20) NOT NULL DEFAULT 'up',
    file_path VARCHAR(500) NOT NULL
);
```

### Migration Status Queries

```sql
-- Get migration summary
SELECT * FROM get_migration_status();

-- View recent migrations
SELECT * FROM migration_status_view;

-- Check for failed migrations
SELECT * FROM schema_migrations WHERE success = FALSE;

-- View rollback history
SELECT * FROM schema_migrations WHERE rolled_back_at IS NOT NULL;
```

## ⚡ Performance Considerations

### TimescaleDB Optimization

For large datasets, migrations leverage TimescaleDB features:

```sql
-- Create hypertable for time-series data
SELECT create_hypertable('new_table', 'time_column');

-- Add compression for old data
ALTER TABLE new_table SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'category_column'
);
```

### Index Creation

Use `CONCURRENTLY` for index creation to avoid blocking:

```sql
CREATE INDEX CONCURRENTLY idx_example ON table_name(column_name);
```

### Large Data Migrations

For large datasets, consider batch processing:

```sql
-- Process in batches of 10000 rows
UPDATE large_table 
SET new_column = calculated_value 
WHERE id BETWEEN 1 AND 10000;

-- Use cursor for memory efficiency
DECLARE migration_cursor CURSOR FOR SELECT * FROM large_table;
```

## 🧪 Testing

### Running Tests

```bash
# Run migration system tests
npm test -- MigrationManager

# Run with coverage
npm run test:coverage -- MigrationManager
```

### Test Database Setup

```bash
# Create test database
createdb algo_trading_bot_test

# Run tests with test database
NODE_ENV=test npm test -- MigrationManager
```

### Manual Integration Testing

```typescript
// For development/testing
const migrationManager = getMigrationManager();

// Test complete cycle
const initialStatus = await migrationManager.getStatus();
console.log('Initial:', initialStatus);

const migrateResult = await migrationManager.migrate({ dryRun: false });
console.log('Migrate:', migrateResult);

const finalStatus = await migrationManager.getStatus();
console.log('Final:', finalStatus);

// Test rollback
const rollbackResult = await migrationManager.rollback({ count: 1 });
console.log('Rollback:', rollbackResult);
```

## 🚨 Troubleshooting

### Common Issues

1. **Lock Timeout**: Another migration is running
   ```bash
   # Wait for current migration to complete or kill if stuck
   SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE '%pg_advisory_lock%';
   ```

2. **Checksum Mismatch**: Migration file was modified after application
   ```bash
   # Use --force to override (caution: only if you understand the implications)
   node database/migrate.js migrate --force
   ```

3. **Permission Denied**: Database user lacks necessary permissions
   ```sql
   -- Grant necessary permissions
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA trading TO your_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA trading TO your_user;
   ```

4. **Out of Disk Space**: Large migration fills disk
   ```bash
   # Check disk space before migrations
   df -h
   
   # Consider cleanup or migration splitting
   ```

### Recovery Procedures

1. **Failed Migration Recovery**:
   ```sql
   -- Check failed migrations
   SELECT * FROM schema_migrations WHERE success = FALSE;
   
   -- Manual cleanup if needed
   UPDATE schema_migrations SET success = TRUE WHERE version = 'failed_version';
   ```

2. **Corrupted Migration State**:
   ```bash
   # Reset migration state (DANGEROUS - backup first!)
   # This would require careful manual intervention
   ```

## 🔮 Future Enhancements

### Planned Features

1. **CI/CD Integration**: Automatic migration in deployment pipeline
2. **Migration Approval Workflow**: Review process for production migrations
3. **Performance Monitoring**: Track migration performance over time
4. **Cross-Database Support**: Support for multiple database types
5. **Migration Splitting**: Automatic splitting of large migrations
6. **Schema Drift Detection**: Detect manual schema changes

### Integration Roadmap

- **BE-001**: Full integration with DatabaseManager (✅ Complete)
- **ML-001**: ML model versioning with migrations
- **DO-005**: CI/CD pipeline integration
- **TE-001**: Enhanced testing framework integration

## 🤝 Contributing

### Migration Best Practices

1. **Always include rollback**: Every migration must have a rollback
2. **Test thoroughly**: Test both forward and rollback migrations
3. **Use transactions**: Wrap migrations in BEGIN/COMMIT
4. **Add validation**: Include validation queries
5. **Document changes**: Clear descriptions and comments
6. **Consider performance**: Large changes should be batched
7. **Backup before major changes**: Always backup production

### Code Review Checklist

- [ ] Migration has corresponding rollback
- [ ] Includes validation queries
- [ ] Uses transactions appropriately
- [ ] Performance impact considered
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] Security implications reviewed

## 📄 License

Part of the Algorithmic Trading Bot platform. See main project license.

## 📞 Support

For migration system issues:
1. Check this documentation
2. Review test files for examples
3. Check migration logs in `schema_migrations` table
4. Create issue with detailed error information

---

**Database Migration System - Task DB-003 Complete** ✅

*Production-ready migration system with comprehensive safety features, validation, and TypeScript integration.*