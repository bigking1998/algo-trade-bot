#!/bin/bash

# ===========================================
# Trading Bot Incident Response Automation
# Automated recovery and incident handling
# ===========================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_DIR}/logs/incident-response.log"
INCIDENT_LOG="${PROJECT_DIR}/logs/incidents.log"

# Alert thresholds
MAX_MEMORY_USAGE=85
MAX_DISK_USAGE=90
MAX_CPU_USAGE=80
MAX_RESPONSE_TIME=5
MAX_CONSECUTIVE_FAILURES=5

# Recovery actions attempted
declare -A RECOVERY_ACTIONS
RECOVERY_ACTIONS["service_restart"]=0
RECOVERY_ACTIONS["container_restart"]=0
RECOVERY_ACTIONS["system_cleanup"]=0
RECOVERY_ACTIONS["database_reconnect"]=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create logs directory if it doesn't exist
mkdir -p "${PROJECT_DIR}/logs"

# Logging function
log() {
    local level="$1"
    local message="$2"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$LOG_FILE"
}

# Log incident
log_incident() {
    local incident_type="$1"
    local severity="$2"
    local description="$3"
    local action_taken="$4"
    
    cat >> "$INCIDENT_LOG" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "incident_type": "$incident_type",
  "severity": "$severity",
  "description": "$description",
  "action_taken": "$action_taken",
  "resolved": true
}
EOF
}

# Send alert notification
send_alert() {
    local severity="$1"
    local title="$2"
    local message="$3"
    
    log "INFO" "ALERT [$severity]: $title - $message"
    
    # Send Slack notification if webhook is configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="warning"
        case "$severity" in
            "CRITICAL") color="danger" ;;
            "HIGH") color="warning" ;;
            "MEDIUM") color="good" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Trading Bot Incident\",\"attachments\":[{\"color\":\"$color\",\"title\":\"$title\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    # Send email notification if configured
    if command -v mail > /dev/null && [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "$message" | mail -s "[$severity] Trading Bot: $title" "$ALERT_EMAIL" || true
    fi
}

# Check and restart service if needed
restart_service() {
    local service_name="$1"
    local port="$2"
    local start_command="$3"
    
    log "INFO" "Checking service: $service_name on port $port"
    
    if ! lsof -Pi :$port -sTCP:LISTEN -t > /dev/null; then
        log "WARN" "Service $service_name is not running on port $port"
        
        # Check if we've already tried restarting this service too many times
        if [[ ${RECOVERY_ACTIONS["service_restart"]} -ge $MAX_CONSECUTIVE_FAILURES ]]; then
            log "ERROR" "Maximum restart attempts reached for $service_name"
            send_alert "CRITICAL" "Service Recovery Failed" "Maximum restart attempts reached for $service_name"
            return 1
        fi
        
        log "INFO" "Attempting to restart $service_name"
        ((RECOVERY_ACTIONS["service_restart"]++))
        
        # Kill any existing processes on the port
        local pids=$(lsof -ti :$port || true)
        if [[ -n "$pids" ]]; then
            echo "$pids" | xargs kill -9 > /dev/null 2>&1 || true
            sleep 2
        fi
        
        # Start the service
        cd "$PROJECT_DIR"
        nohup $start_command > /dev/null 2>&1 &
        sleep 5
        
        # Verify service started
        if lsof -Pi :$port -sTCP:LISTEN -t > /dev/null; then
            log "INFO" "Successfully restarted $service_name"
            log_incident "service_failure" "high" "$service_name was down" "automated_restart"
            send_alert "HIGH" "Service Restarted" "$service_name has been automatically restarted"
            return 0
        else
            log "ERROR" "Failed to restart $service_name"
            send_alert "CRITICAL" "Service Restart Failed" "Failed to restart $service_name"
            return 1
        fi
    fi
    
    return 0
}

# Check and restart Docker containers
restart_containers() {
    log "INFO" "Checking Docker containers health"
    
    if ! command -v docker > /dev/null; then
        log "WARN" "Docker not available"
        return 1
    fi
    
    local containers=("trading-bot-postgres-dev" "trading-bot-redis-dev" "trading-bot-backend-dev")
    local restarted_containers=()
    
    for container in "${containers[@]}"; do
        local health_status
        health_status=$(docker inspect --format="{{if .Config.Healthcheck}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" "$container" 2>/dev/null || echo "not-found")
        
        case "$health_status" in
            "unhealthy"|"exited"|"not-found")
                log "WARN" "Container $container is $health_status"
                
                # Check restart limit
                if [[ ${RECOVERY_ACTIONS["container_restart"]} -ge $MAX_CONSECUTIVE_FAILURES ]]; then
                    log "ERROR" "Maximum container restart attempts reached"
                    send_alert "CRITICAL" "Container Recovery Failed" "Maximum restart attempts reached for containers"
                    return 1
                fi
                
                log "INFO" "Restarting container $container"
                ((RECOVERY_ACTIONS["container_restart"]++))
                
                # Restart the container
                docker restart "$container" > /dev/null 2>&1 || {
                    log "ERROR" "Failed to restart container $container"
                    send_alert "CRITICAL" "Container Restart Failed" "Failed to restart container $container"
                    continue
                }
                
                restarted_containers+=("$container")
                sleep 10
                
                # Verify container is healthy
                local new_status
                new_status=$(docker inspect --format="{{if .Config.Healthcheck}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" "$container" 2>/dev/null || echo "unknown")
                
                if [[ "$new_status" == "healthy" || "$new_status" == "running" ]]; then
                    log "INFO" "Successfully restarted container $container"
                else
                    log "ERROR" "Container $container still unhealthy after restart: $new_status"
                fi
                ;;
            "healthy"|"running")
                log "INFO" "Container $container is $health_status"
                ;;
        esac
    done
    
    if [[ ${#restarted_containers[@]} -gt 0 ]]; then
        log_incident "container_failure" "high" "Containers unhealthy: ${restarted_containers[*]}" "automated_restart"
        send_alert "HIGH" "Containers Restarted" "Restarted containers: ${restarted_containers[*]}"
    fi
    
    return 0
}

# System cleanup and optimization
perform_system_cleanup() {
    log "INFO" "Performing system cleanup"
    
    # Check if cleanup was already attempted recently
    if [[ ${RECOVERY_ACTIONS["system_cleanup"]} -ge 2 ]]; then
        log "WARN" "System cleanup already attempted, skipping"
        return 0
    fi
    
    ((RECOVERY_ACTIONS["system_cleanup"]++))
    
    # Clear old log files
    find "$PROJECT_DIR/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Clear npm cache if space is low
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ $disk_usage -gt $MAX_DISK_USAGE ]]; then
        log "WARN" "High disk usage: ${disk_usage}%, clearing npm cache"
        npm cache clean --force > /dev/null 2>&1 || true
        
        # Clear node_modules if disk space is critically low
        if [[ $disk_usage -gt 95 ]]; then
            log "WARN" "Critical disk usage, clearing node_modules"
            rm -rf "$PROJECT_DIR/node_modules" 2>/dev/null || true
            send_alert "CRITICAL" "Disk Space Critical" "Disk usage at ${disk_usage}%, cleared node_modules"
        fi
    fi
    
    # Clear Docker images and containers if Docker is available
    if command -v docker > /dev/null; then
        docker system prune -f > /dev/null 2>&1 || true
    fi
    
    log "INFO" "System cleanup completed"
    log_incident "high_resource_usage" "medium" "System cleanup performed" "automated_cleanup"
}

# Database recovery
recover_database() {
    log "INFO" "Attempting database recovery"
    
    # Check recovery attempt limit
    if [[ ${RECOVERY_ACTIONS["database_reconnect"]} -ge $MAX_CONSECUTIVE_FAILURES ]]; then
        log "ERROR" "Maximum database recovery attempts reached"
        send_alert "CRITICAL" "Database Recovery Failed" "Maximum database recovery attempts reached"
        return 1
    fi
    
    ((RECOVERY_ACTIONS["database_reconnect"]++))
    
    # Try to restart PostgreSQL container
    if command -v docker > /dev/null; then
        log "INFO" "Restarting PostgreSQL container"
        docker restart trading-bot-postgres-dev > /dev/null 2>&1 || true
        sleep 10
    fi
    
    # Test database connectivity
    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local db_name="${DB_NAME:-trading_bot_dev}"
    local db_user="${DB_USER:-postgres}"
    
    if command -v psql > /dev/null; then
        if PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
            log "INFO" "Database recovery successful"
            log_incident "database_failure" "high" "Database connection lost" "automated_recovery"
            send_alert "HIGH" "Database Recovered" "Database connection has been restored"
            return 0
        else
            log "ERROR" "Database recovery failed"
            send_alert "CRITICAL" "Database Recovery Failed" "Unable to restore database connection"
            return 1
        fi
    else
        log "ERROR" "psql not available for database recovery"
        return 1
    fi
}

# Check system resources and take action
check_system_resources() {
    log "INFO" "Checking system resources"
    
    # Check memory usage
    if command -v free > /dev/null; then
        local memory_usage
        memory_usage=$(free | grep '^Mem' | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [[ $memory_usage -gt $MAX_MEMORY_USAGE ]]; then
            log "WARN" "High memory usage: ${memory_usage}%"
            send_alert "HIGH" "High Memory Usage" "Memory usage at ${memory_usage}%"
            
            # Try to restart services to free memory
            restart_containers
            
            log_incident "high_resource_usage" "high" "Memory usage at ${memory_usage}%" "container_restart"
        fi
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ $disk_usage -gt $MAX_DISK_USAGE ]]; then
        log "WARN" "High disk usage: ${disk_usage}%"
        send_alert "HIGH" "High Disk Usage" "Disk usage at ${disk_usage}%"
        perform_system_cleanup
    fi
}

# Monitor service health and respond to issues
monitor_and_respond() {
    log "INFO" "Starting incident monitoring and response"
    
    # Check core services
    restart_service "Backend" 3001 "npm run backend"
    restart_service "Frontend" 5173 "npm run dev"
    
    # Check infrastructure
    restart_containers
    
    # Check database connectivity
    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local db_name="${DB_NAME:-trading_bot_dev}"
    local db_user="${DB_USER:-postgres}"
    
    if command -v psql > /dev/null; then
        if ! PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
            log "WARN" "Database connection failed"
            recover_database
        fi
    fi
    
    # Check system resources
    check_system_resources
    
    log "INFO" "Incident monitoring cycle completed"
}

# Handle specific incident types
handle_incident() {
    local incident_type="$1"
    
    case "$incident_type" in
        "service_down")
            log "INFO" "Handling service down incident"
            restart_service "Backend" 3001 "npm run backend"
            restart_service "Frontend" 5173 "npm run dev"
            ;;
        "database_down")
            log "INFO" "Handling database down incident"
            recover_database
            ;;
        "high_memory")
            log "INFO" "Handling high memory usage incident"
            restart_containers
            perform_system_cleanup
            ;;
        "disk_full")
            log "INFO" "Handling disk full incident"
            perform_system_cleanup
            ;;
        "containers_unhealthy")
            log "INFO" "Handling unhealthy containers incident"
            restart_containers
            ;;
        *)
            log "WARN" "Unknown incident type: $incident_type"
            monitor_and_respond
            ;;
    esac
}

# Main function
main() {
    log "INFO" "=== Starting incident response system ==="
    
    # Parse command line arguments
    local incident_type="${1:-monitor}"
    
    case "$incident_type" in
        "monitor")
            echo -e "${BLUE}🚨 Trading Bot Incident Response Monitor${NC}"
            echo "=========================================="
            monitor_and_respond
            ;;
        "service_down"|"database_down"|"high_memory"|"disk_full"|"containers_unhealthy")
            echo -e "${YELLOW}⚡ Handling Incident: $incident_type${NC}"
            echo "=========================================="
            handle_incident "$incident_type"
            ;;
        "health")
            echo -e "${GREEN}🏥 Running Health Check${NC}"
            echo "========================"
            "$SCRIPT_DIR/health-check.sh"
            ;;
        *)
            echo "Usage: $0 [monitor|service_down|database_down|high_memory|disk_full|containers_unhealthy|health]"
            echo ""
            echo "monitor            - Run continuous monitoring and automated response"
            echo "service_down       - Handle service down incident"
            echo "database_down      - Handle database connectivity issue"
            echo "high_memory        - Handle high memory usage"
            echo "disk_full         - Handle disk space issue"
            echo "containers_unhealthy - Handle unhealthy Docker containers"
            echo "health            - Run comprehensive health check"
            exit 1
            ;;
    esac
    
    log "INFO" "Incident response completed successfully"
    echo -e "\n${GREEN}✅ Incident response completed${NC}"
}

# Run main function
main "$@"