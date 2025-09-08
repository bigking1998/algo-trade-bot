#!/bin/bash

# ===========================================
# Trading Bot Health Check Script
# Comprehensive system health monitoring
# ===========================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_DIR}/logs/health-check.log"
HEALTH_STATUS_FILE="${PROJECT_DIR}/logs/health-status.json"

# Health check endpoints
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:5173"
PROMETHEUS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create logs directory if it doesn't exist
mkdir -p "${PROJECT_DIR}/logs"

# Initialize health status
OVERALL_HEALTH="healthy"
declare -A HEALTH_CHECKS
declare -A SERVICE_STATUSES

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Print colored status
print_status() {
    local service="$1"
    local status="$2"
    local message="$3"
    
    case "$status" in
        "healthy")
            echo -e "${GREEN}✓ $service: $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠ $service: $message${NC}"
            ;;
        "critical")
            echo -e "${RED}✗ $service: $message${NC}"
            OVERALL_HEALTH="critical"
            ;;
    esac
}

# Check if service is running
check_service_running() {
    local service_name="$1"
    local port="$2"
    
    if lsof -Pi :$port -sTCP:LISTEN -t > /dev/null; then
        SERVICE_STATUSES["$service_name"]="running"
        return 0
    else
        SERVICE_STATUSES["$service_name"]="stopped"
        return 1
    fi
}

# HTTP health check
check_http_endpoint() {
    local name="$1"
    local url="$2"
    local timeout="${3:-10}"
    
    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time "$timeout" "$url" 2>/dev/null || echo "timeout")
    
    if [[ "$response_time" == "timeout" ]]; then
        HEALTH_CHECKS["$name"]="critical"
        print_status "$name" "critical" "HTTP endpoint unreachable"
        return 1
    elif (( $(echo "$response_time > 2.0" | bc -l) )); then
        HEALTH_CHECKS["$name"]="warning"
        print_status "$name" "warning" "Slow response time: ${response_time}s"
        return 1
    else
        HEALTH_CHECKS["$name"]="healthy"
        print_status "$name" "healthy" "Response time: ${response_time}s"
        return 0
    fi
}

# Database connectivity check
check_database() {
    log "Checking database connectivity..."
    
    if command -v psql > /dev/null; then
        local db_host="${DB_HOST:-localhost}"
        local db_port="${DB_PORT:-5432}"
        local db_name="${DB_NAME:-trading_bot_dev}"
        local db_user="${DB_USER:-postgres}"
        
        if PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
            HEALTH_CHECKS["database"]="healthy"
            print_status "Database" "healthy" "PostgreSQL connection successful"
            
            # Check database performance
            local query_time
            query_time=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT pg_sleep(0);" -t | tail -n 1 | xargs)
            
            return 0
        else
            HEALTH_CHECKS["database"]="critical"
            print_status "Database" "critical" "Cannot connect to PostgreSQL"
            return 1
        fi
    else
        HEALTH_CHECKS["database"]="warning"
        print_status "Database" "warning" "psql not available for database check"
        return 1
    fi
}

# Redis connectivity check
check_redis() {
    log "Checking Redis connectivity..."
    
    if command -v redis-cli > /dev/null; then
        local redis_host="${REDIS_HOST:-localhost}"
        local redis_port="${REDIS_PORT:-6379}"
        
        if redis-cli -h "$redis_host" -p "$redis_port" ping > /dev/null 2>&1; then
            HEALTH_CHECKS["redis"]="healthy"
            print_status "Redis" "healthy" "Redis connection successful"
            return 0
        else
            HEALTH_CHECKS["redis"]="critical"
            print_status "Redis" "critical" "Cannot connect to Redis"
            return 1
        fi
    else
        HEALTH_CHECKS["redis"]="warning"
        print_status "Redis" "warning" "redis-cli not available for Redis check"
        return 1
    fi
}

# Docker services check
check_docker_services() {
    log "Checking Docker services..."
    
    if ! command -v docker > /dev/null; then
        HEALTH_CHECKS["docker"]="warning"
        print_status "Docker" "warning" "Docker not available"
        return 1
    fi
    
    local services=("trading-bot-postgres-dev" "trading-bot-redis-dev" "trading-bot-backend-dev")
    local unhealthy_services=()
    
    for service in "${services[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "^$service$"; then
            local health_status
            health_status=$(docker inspect --format="{{if .Config.Healthcheck}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" "$service" 2>/dev/null || echo "not-running")
            
            case "$health_status" in
                "healthy")
                    print_status "$service" "healthy" "Container healthy"
                    ;;
                "unhealthy")
                    unhealthy_services+=("$service")
                    print_status "$service" "critical" "Container unhealthy"
                    ;;
                "no-healthcheck")
                    print_status "$service" "warning" "Container running (no health check)"
                    ;;
                *)
                    unhealthy_services+=("$service")
                    print_status "$service" "critical" "Container not running"
                    ;;
            esac
        else
            unhealthy_services+=("$service")
            print_status "$service" "critical" "Container not found"
        fi
    done
    
    if [[ ${#unhealthy_services[@]} -eq 0 ]]; then
        HEALTH_CHECKS["docker"]="healthy"
        return 0
    else
        HEALTH_CHECKS["docker"]="critical"
        return 1
    fi
}

# Disk space check
check_disk_space() {
    log "Checking disk space..."
    
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ $disk_usage -gt 90 ]]; then
        HEALTH_CHECKS["disk_space"]="critical"
        print_status "Disk Space" "critical" "Disk usage at ${disk_usage}%"
        return 1
    elif [[ $disk_usage -gt 80 ]]; then
        HEALTH_CHECKS["disk_space"]="warning"
        print_status "Disk Space" "warning" "Disk usage at ${disk_usage}%"
        return 1
    else
        HEALTH_CHECKS["disk_space"]="healthy"
        print_status "Disk Space" "healthy" "Disk usage at ${disk_usage}%"
        return 0
    fi
}

# Memory usage check
check_memory() {
    log "Checking memory usage..."
    
    if command -v free > /dev/null; then
        local memory_usage
        memory_usage=$(free | grep '^Mem' | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [[ $memory_usage -gt 90 ]]; then
            HEALTH_CHECKS["memory"]="critical"
            print_status "Memory" "critical" "Memory usage at ${memory_usage}%"
            return 1
        elif [[ $memory_usage -gt 80 ]]; then
            HEALTH_CHECKS["memory"]="warning"
            print_status "Memory" "warning" "Memory usage at ${memory_usage}%"
            return 1
        else
            HEALTH_CHECKS["memory"]="healthy"
            print_status "Memory" "healthy" "Memory usage at ${memory_usage}%"
            return 0
        fi
    else
        HEALTH_CHECKS["memory"]="warning"
        print_status "Memory" "warning" "Cannot check memory usage"
        return 1
    fi
}

# Process check
check_processes() {
    log "Checking critical processes..."
    
    local processes=("node" "postgres" "redis-server")
    local missing_processes=()
    
    for process in "${processes[@]}"; do
        if pgrep -f "$process" > /dev/null; then
            print_status "Process $process" "healthy" "Process running"
        else
            missing_processes+=("$process")
            print_status "Process $process" "warning" "Process not found"
        fi
    done
    
    if [[ ${#missing_processes[@]} -eq 0 ]]; then
        HEALTH_CHECKS["processes"]="healthy"
        return 0
    else
        HEALTH_CHECKS["processes"]="warning"
        return 1
    fi
}

# Network connectivity check
check_network() {
    log "Checking network connectivity..."
    
    # Check internet connectivity
    if ping -c 1 google.com > /dev/null 2>&1; then
        HEALTH_CHECKS["network"]="healthy"
        print_status "Network" "healthy" "Internet connectivity OK"
        return 0
    else
        HEALTH_CHECKS["network"]="critical"
        print_status "Network" "critical" "No internet connectivity"
        return 1
    fi
}

# Exchange API connectivity check
check_exchange_api() {
    log "Checking exchange API connectivity..."
    
    # Check dYdX API
    if curl -s --max-time 10 "https://indexer.dydx.trade/v4/height" > /dev/null 2>&1; then
        HEALTH_CHECKS["exchange_api"]="healthy"
        print_status "Exchange API" "healthy" "dYdX API accessible"
        return 0
    else
        HEALTH_CHECKS["exchange_api"]="warning"
        print_status "Exchange API" "warning" "dYdX API unreachable"
        return 1
    fi
}

# Generate health status report
generate_health_report() {
    log "Generating health status report..."
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local healthy_count=0
    local warning_count=0
    local critical_count=0
    
    # Count health statuses
    for status in "${HEALTH_CHECKS[@]}"; do
        case "$status" in
            "healthy") ((healthy_count++)) ;;
            "warning") ((warning_count++)) ;;
            "critical") ((critical_count++)) ;;
        esac
    done
    
    # Generate JSON report
    cat > "$HEALTH_STATUS_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "overall_status": "$OVERALL_HEALTH",
  "summary": {
    "healthy": $healthy_count,
    "warning": $warning_count,
    "critical": $critical_count,
    "total": ${#HEALTH_CHECKS[@]}
  },
  "checks": $(printf '%s\n' "${HEALTH_CHECKS[@]}" | jq -R . | jq -s 'to_entries | map({(.key | tostring): .value}) | add'),
  "services": $(printf '%s\n' "${SERVICE_STATUSES[@]}" | jq -R . | jq -s 'to_entries | map({(.key | tostring): .value}) | add')
}
EOF
}

# Main health check function
main() {
    log "=== Starting comprehensive health check ==="
    
    echo -e "${BLUE}🏥 Trading Bot Health Check${NC}"
    echo "==============================="
    
    # Core service checks
    echo -e "\n${BLUE}📊 Service Status${NC}"
    check_service_running "Backend" 3001
    check_service_running "Frontend" 5173
    check_service_running "Prometheus" 9090
    check_service_running "Grafana" 3000
    
    # HTTP endpoint checks
    echo -e "\n${BLUE}🌐 HTTP Endpoints${NC}"
    check_http_endpoint "Backend Health" "$BACKEND_URL/api/health"
    check_http_endpoint "Backend Metrics" "$BACKEND_URL/api/metrics"
    check_http_endpoint "Frontend" "$FRONTEND_URL"
    
    # Infrastructure checks
    echo -e "\n${BLUE}🗄️ Infrastructure${NC}"
    check_database
    check_redis
    check_docker_services
    
    # System resource checks
    echo -e "\n${BLUE}💻 System Resources${NC}"
    check_disk_space
    check_memory
    check_processes
    
    # External connectivity checks
    echo -e "\n${BLUE}🌍 External Connectivity${NC}"
    check_network
    check_exchange_api
    
    # Generate report
    generate_health_report
    
    # Summary
    echo -e "\n${BLUE}📋 Health Check Summary${NC}"
    echo "================================="
    
    local healthy_count=0
    local warning_count=0
    local critical_count=0
    
    for status in "${HEALTH_CHECKS[@]}"; do
        case "$status" in
            "healthy") ((healthy_count++)) ;;
            "warning") ((warning_count++)) ;;
            "critical") ((critical_count++)) ;;
        esac
    done
    
    echo "✅ Healthy: $healthy_count"
    echo "⚠️  Warning: $warning_count"
    echo "❌ Critical: $critical_count"
    echo "📊 Total Checks: ${#HEALTH_CHECKS[@]}"
    
    case "$OVERALL_HEALTH" in
        "healthy")
            echo -e "\n${GREEN}🎉 Overall Status: HEALTHY${NC}"
            log "Health check completed successfully - system healthy"
            exit 0
            ;;
        "warning")
            echo -e "\n${YELLOW}⚠️ Overall Status: WARNING - Some issues detected${NC}"
            log "Health check completed with warnings"
            exit 1
            ;;
        "critical")
            echo -e "\n${RED}🚨 Overall Status: CRITICAL - Immediate attention required${NC}"
            log "Health check failed - critical issues detected"
            exit 2
            ;;
    esac
}

# Run main function
main "$@"