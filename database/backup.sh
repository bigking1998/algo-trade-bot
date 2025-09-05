#!/bin/bash

# Automated Database Backup Script for Algorithmic Trading Bot
# Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
# 
# This script provides comprehensive backup functionality with retention policies,
# compression, and validation for production trading platform data.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$SCRIPT_DIR/backups"
CONFIG_FILE="$PROJECT_ROOT/.env.database"

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-algo_trading_bot}"
DB_USER="${DB_USER:-algo_trader}"
BACKUP_RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-30}"

# Load configuration if available
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE" 2>/dev/null || true
fi

# PostgreSQL path
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Logging
LOG_FILE="$BACKUP_DIR/backup.log"
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

# Check if PostgreSQL is available
check_postgresql() {
    if ! command -v pg_dump >/dev/null 2>&1; then
        error "pg_dump not found. Please ensure PostgreSQL is installed and in PATH."
        exit 1
    fi
    
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" >/dev/null 2>&1; then
        error "PostgreSQL is not ready or connection parameters are incorrect."
        exit 1
    fi
    
    log "PostgreSQL connectivity verified"
}

# Create backup
create_backup() {
    local backup_type="$1"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_name="${DB_NAME}_${backup_type}_${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.sql"
    local compressed_file="$BACKUP_DIR/${backup_name}.sql.gz"
    
    log "Starting $backup_type backup: $backup_name"
    
    case "$backup_type" in
        "full")
            # Full database backup with all data and schema
            if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --verbose --format=custom --compress=9 \
                --file="$backup_file" 2>>"$LOG_FILE"; then
                error "Full backup failed"
                return 1
            fi
            ;;
        "schema")
            # Schema-only backup
            if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --schema-only --verbose --format=custom \
                --file="$backup_file" 2>>"$LOG_FILE"; then
                error "Schema backup failed"
                return 1
            fi
            ;;
        "data")
            # Data-only backup
            if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --data-only --verbose --format=custom --compress=9 \
                --file="$backup_file" 2>>"$LOG_FILE"; then
                error "Data backup failed"
                return 1
            fi
            ;;
        *)
            error "Unknown backup type: $backup_type"
            return 1
            ;;
    esac
    
    # Verify backup file was created and has content
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        error "Backup file was not created or is empty: $backup_file"
        return 1
    fi
    
    # Get backup file size
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log "$backup_type backup completed successfully: $backup_file ($backup_size)"
    
    # Create checksum for integrity verification
    local checksum_file="$backup_file.sha256"
    if sha256sum "$backup_file" > "$checksum_file" 2>>"$LOG_FILE"; then
        log "Checksum created: $checksum_file"
    else
        error "Failed to create checksum"
    fi
    
    echo "$backup_file"
}

# Validate backup
validate_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Validating backup: $backup_file"
    
    # Verify checksum if available
    local checksum_file="$backup_file.sha256"
    if [[ -f "$checksum_file" ]]; then
        if sha256sum -c "$checksum_file" >/dev/null 2>&1; then
            log "Checksum validation passed"
        else
            error "Checksum validation failed"
            return 1
        fi
    fi
    
    # Test restore capability (dry run)
    local temp_db="temp_restore_test_$(date +%s)"
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$temp_db" 2>/dev/null; then
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$temp_db" \
            --verbose "$backup_file" >/dev/null 2>&1; then
            log "Backup restore test passed"
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$temp_db" 2>/dev/null || true
        else
            error "Backup restore test failed"
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$temp_db" 2>/dev/null || true
            return 1
        fi
    else
        log "Warning: Could not create test database for restore validation"
    fi
    
    log "Backup validation completed successfully"
    return 0
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $BACKUP_RETENTION_DAYS days"
    
    # Find and remove old backup files
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        rm -f "$file.sha256" 2>/dev/null || true
        ((deleted_count++))
        log "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "*.sql" -type f -mtime +$BACKUP_RETENTION_DAYS -print0 2>/dev/null)
    
    log "Cleanup completed. Deleted $deleted_count old backups"
}

# Get backup statistics
backup_stats() {
    local total_backups=$(find "$BACKUP_DIR" -name "*.sql" -type f | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "Unknown")
    local oldest_backup=$(find "$BACKUP_DIR" -name "*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | head -1 | cut -d' ' -f2- || echo "None")
    local newest_backup=$(find "$BACKUP_DIR" -name "*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || echo "None")
    
    log "Backup Statistics:"
    log "  Total backups: $total_backups"
    log "  Total size: $total_size"
    log "  Oldest backup: $(basename "$oldest_backup" 2>/dev/null || echo "None")"
    log "  Newest backup: $(basename "$newest_backup" 2>/dev/null || echo "None")"
}

# Main backup routine
main() {
    local backup_type="${1:-full}"
    
    log "Starting backup routine - Type: $backup_type"
    log "Configuration: Host=$DB_HOST, Port=$DB_PORT, Database=$DB_NAME, User=$DB_USER"
    
    # Check prerequisites
    check_postgresql
    
    # Create backup
    local backup_file
    if backup_file=$(create_backup "$backup_type"); then
        log "Backup created successfully: $backup_file"
        
        # Validate backup
        if validate_backup "$backup_file"; then
            log "Backup validation successful"
        else
            error "Backup validation failed"
            exit 1
        fi
    else
        error "Backup creation failed"
        exit 1
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Show statistics
    backup_stats
    
    log "Backup routine completed successfully"
}

# Help function
show_help() {
    echo "Usage: $0 [backup_type]"
    echo ""
    echo "Backup types:"
    echo "  full    - Complete database backup (default)"
    echo "  schema  - Schema-only backup"
    echo "  data    - Data-only backup"
    echo ""
    echo "Environment variables:"
    echo "  DB_HOST                    - Database host (default: localhost)"
    echo "  DB_PORT                    - Database port (default: 5432)"
    echo "  DB_NAME                    - Database name (default: algo_trading_bot)"
    echo "  DB_USER                    - Database user (default: algo_trader)"
    echo "  DB_BACKUP_RETENTION_DAYS   - Backup retention in days (default: 30)"
    echo ""
    echo "Examples:"
    echo "  $0                         # Create full backup"
    echo "  $0 schema                  # Create schema-only backup"
    echo "  $0 data                    # Create data-only backup"
}

# Command line handling
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    ""|full|schema|data)
        main "${1:-full}"
        ;;
    *)
        error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac