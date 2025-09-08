#!/bin/bash

# Database Backup Script for Trading Bot
# Usage: ./scripts/backup.sh [retention_days]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RETENTION_DAYS="${1:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/database/backups"
LOG_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting database backup..."

# Load environment variables
if [[ -f "$PROJECT_DIR/.env.production" ]]; then
    set -a
    source "$PROJECT_DIR/.env.production"
    set +a
    CONTAINER_NAME="trading-bot-postgres-prod"
elif [[ -f "$PROJECT_DIR/.env.development" ]]; then
    set -a
    source "$PROJECT_DIR/.env.development"
    set +a
    CONTAINER_NAME="trading-bot-postgres-dev"
else
    error "No environment file found"
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    error "Database container $CONTAINER_NAME is not running"
fi

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/trading_bot_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"

log "Creating database backup: $BACKUP_FILE"

# Create database dump
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --verbose --clean --no-owner --no-privileges > "$BACKUP_FILE"; then
    success "Database backup created successfully"
else
    error "Database backup failed"
fi

# Compress backup
log "Compressing backup..."
if gzip "$BACKUP_FILE"; then
    success "Backup compressed: $COMPRESSED_FILE"
else
    error "Backup compression failed"
fi

# Verify compressed backup
if [[ -f "$COMPRESSED_FILE" ]] && [[ -s "$COMPRESSED_FILE" ]]; then
    BACKUP_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    success "Backup verification passed. Size: $BACKUP_SIZE"
else
    error "Backup verification failed"
fi

# Clean old backups
log "Cleaning old backups (retention: $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "trading_bot_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
OLD_LOGS_DELETED=$(find "$BACKUP_DIR" -name "backup_*.log" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
success "Cleaned $OLD_LOGS_DELETED old backup logs"

# Optional: Upload to S3 (uncomment and configure as needed)
# if [[ -n "$AWS_ACCESS_KEY_ID" && -n "$BACKUP_S3_BUCKET" ]]; then
#     log "Uploading backup to S3..."
#     aws s3 cp "$COMPRESSED_FILE" "s3://$BACKUP_S3_BUCKET/database-backups/" --storage-class STANDARD_IA
#     success "Backup uploaded to S3"
# fi

# Generate backup report
REPORT_FILE="$BACKUP_DIR/backup_report_${TIMESTAMP}.json"
cat > "$REPORT_FILE" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "backup_file": "$COMPRESSED_FILE",
    "size_bytes": $(stat -c%s "$COMPRESSED_FILE"),
    "size_human": "$BACKUP_SIZE",
    "database": "$DB_NAME",
    "container": "$CONTAINER_NAME",
    "retention_days": $RETENTION_DAYS,
    "status": "success"
}
EOF

success "Backup completed successfully!"
log "Backup file: $COMPRESSED_FILE"
log "Backup size: $BACKUP_SIZE"
log "Log file: $LOG_FILE"
log "Report file: $REPORT_FILE"