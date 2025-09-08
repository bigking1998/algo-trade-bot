#!/bin/bash

# Production Deployment Script for Trading Bot
# Usage: ./scripts/deploy.sh [environment] [version]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
VERSION="${2:-latest}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$PROJECT_DIR/logs/deploy_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

log "Starting deployment for environment: $ENVIRONMENT, version: $VERSION"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production."
fi

# Check if required files exist
if [[ ! -f "$PROJECT_DIR/.env.$ENVIRONMENT" ]]; then
    error "Environment file .env.$ENVIRONMENT not found. Please create it from the template."
fi

if [[ ! -f "$PROJECT_DIR/docker-compose.yml" ]] && [[ "$ENVIRONMENT" == "development" ]]; then
    error "docker-compose.yml not found for development environment."
fi

if [[ ! -f "$PROJECT_DIR/docker-compose.prod.yml" ]] && [[ "$ENVIRONMENT" == "production" ]]; then
    error "docker-compose.prod.yml not found for production environment."
fi

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed or not in PATH"
fi

if ! docker info &> /dev/null; then
    error "Docker daemon is not running"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed or not in PATH"
fi

# Check available disk space (minimum 5GB)
AVAILABLE_SPACE=$(df "$PROJECT_DIR" | awk 'NR==2{print $4}')
MIN_SPACE=5242880  # 5GB in KB
if [[ $AVAILABLE_SPACE -lt $MIN_SPACE ]]; then
    error "Insufficient disk space. Available: $(($AVAILABLE_SPACE/1024/1024))GB, Required: 5GB"
fi

success "Pre-deployment checks passed"

# Backup current deployment if this is production
if [[ "$ENVIRONMENT" == "production" ]]; then
    log "Creating backup of current deployment..."
    
    # Create backup directory
    BACKUP_DIR="$PROJECT_DIR/backups/deployment_$TIMESTAMP"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database if running
    if docker ps --format '{{.Names}}' | grep -q "trading-bot-postgres-prod"; then
        log "Backing up database..."
        docker exec trading-bot-postgres-prod pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/database_backup.sql" || warning "Database backup failed"
    fi
    
    # Backup environment files
    cp "$PROJECT_DIR/.env.$ENVIRONMENT" "$BACKUP_DIR/" 2>/dev/null || warning "Could not backup environment file"
    
    success "Backup completed: $BACKUP_DIR"
fi

# Load environment variables
log "Loading environment variables..."
set -a
source "$PROJECT_DIR/.env.$ENVIRONMENT"
set +a
success "Environment variables loaded"

# Build images
log "Building Docker images..."

if [[ "$ENVIRONMENT" == "production" ]]; then
    docker-compose -f docker-compose.prod.yml build --no-cache
else
    docker-compose build --no-cache
fi

success "Docker images built successfully"

# Stop existing services
log "Stopping existing services..."

if [[ "$ENVIRONMENT" == "production" ]]; then
    docker-compose -f docker-compose.prod.yml down --remove-orphans || warning "Some services were not running"
else
    docker-compose down --remove-orphans || warning "Some services were not running"
fi

# Clean up unused Docker resources
log "Cleaning up Docker resources..."
docker system prune -f
docker volume prune -f

# Start services
log "Starting services..."

if [[ "$ENVIRONMENT" == "production" ]]; then
    # Production deployment with health checks
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be healthy
    log "Waiting for services to become healthy..."
    sleep 30
    
    # Check service health
    services=("postgres" "redis" "backend" "frontend" "nginx")
    for service in "${services[@]}"; do
        log "Checking health of $service..."
        
        max_attempts=30
        attempt=1
        
        while [[ $attempt -le $max_attempts ]]; do
            if docker-compose -f docker-compose.prod.yml ps "$service" | grep -q "healthy\|Up"; then
                success "$service is healthy"
                break
            fi
            
            if [[ $attempt -eq $max_attempts ]]; then
                error "$service failed to become healthy within timeout"
            fi
            
            log "Waiting for $service to become healthy... (attempt $attempt/$max_attempts)"
            sleep 10
            ((attempt++))
        done
    done
    
else
    # Development deployment
    docker-compose up -d
    
    # Wait for services
    log "Waiting for services to start..."
    sleep 20
fi

success "Services started successfully"

# Run database migrations if needed
if [[ -f "$PROJECT_DIR/database/migrate.js" ]]; then
    log "Running database migrations..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker exec trading-bot-backend-prod node database/migrate.js || error "Database migration failed"
    else
        docker exec trading-bot-backend-dev node database/migrate.js || error "Database migration failed"
    fi
    
    success "Database migrations completed"
fi

# Post-deployment tests
log "Running post-deployment tests..."

# Test API health endpoint
API_URL="http://localhost:3001/api/health"
if [[ "$ENVIRONMENT" == "production" ]]; then
    API_URL="https://$DOMAIN/api/health"
fi

max_attempts=10
attempt=1

while [[ $attempt -le $max_attempts ]]; do
    if curl -f -s "$API_URL" > /dev/null; then
        success "API health check passed"
        break
    fi
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "API health check failed after $max_attempts attempts"
    fi
    
    log "API not ready yet... (attempt $attempt/$max_attempts)"
    sleep 10
    ((attempt++))
done

# Test frontend
if [[ "$ENVIRONMENT" == "production" ]]; then
    FRONTEND_URL="https://$DOMAIN/health"
else
    FRONTEND_URL="http://localhost/health"
fi

if curl -f -s "$FRONTEND_URL" > /dev/null; then
    success "Frontend health check passed"
else
    warning "Frontend health check failed"
fi

# Display deployment summary
log "Deployment Summary:"
log "===================="
log "Environment: $ENVIRONMENT"
log "Version: $VERSION"
log "Timestamp: $TIMESTAMP"
log "Log file: $LOG_FILE"

if [[ "$ENVIRONMENT" == "production" ]]; then
    log "Production URLs:"
    log "  Frontend: https://$DOMAIN"
    log "  API: https://$DOMAIN/api"
    log "  Health: https://$DOMAIN/health"
fi

log "Docker services:"
if [[ "$ENVIRONMENT" == "production" ]]; then
    docker-compose -f docker-compose.prod.yml ps
else
    docker-compose ps
fi

success "Deployment completed successfully!"

# Optional: Send notification (uncomment and configure as needed)
# if [[ "$ENVIRONMENT" == "production" ]]; then
#     curl -X POST -H 'Content-type: application/json' \
#         --data '{"text":"🚀 Trading Bot deployed successfully to production!"}' \
#         YOUR_SLACK_WEBHOOK_URL
# fi