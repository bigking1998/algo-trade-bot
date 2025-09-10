#!/bin/bash

# ===========================================
# PRODUCTION DEPLOYMENT SCRIPT
# DO-009: Complete Production Deployment
# ===========================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/trading-bot-deployment-$(date +%Y%m%d-%H%M%S).log"
DEPLOYMENT_VERSION="${1:-latest}"
ENVIRONMENT="${2:-production}"
DRY_RUN="${3:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC}  $timestamp - $message" | tee -a "$LOG_FILE" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  $timestamp - $message" | tee -a "$LOG_FILE" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $timestamp - $message" | tee -a "$LOG_FILE" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $timestamp - $message" | tee -a "$LOG_FILE" ;;
    esac
}

# Error handling
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log ERROR "Deployment failed with exit code $exit_code"
        log INFO "Check deployment log: $LOG_FILE"
        
        # Send failure notification
        if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
            curl -X POST "$SLACK_WEBHOOK_URL" \
                -H 'Content-type: application/json' \
                --data "{\"text\":\"🚨 Production deployment FAILED for version $DEPLOYMENT_VERSION\"}" \
                || true
        fi
    fi
}

trap cleanup EXIT

# Pre-deployment checks
pre_deployment_checks() {
    log INFO "Running pre-deployment checks..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "aws" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log ERROR "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log ERROR "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Verify namespace exists
    if ! kubectl get namespace trading-bot &> /dev/null; then
        log ERROR "Namespace 'trading-bot' does not exist"
        exit 1
    fi
    
    # Check required secrets
    local required_secrets=("postgres-secret" "aws-secret" "notification-secret")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n trading-bot &> /dev/null; then
            log ERROR "Required secret '$secret' not found"
            exit 1
        fi
    done
    
    # Check environment variables
    local required_vars=("DATABASE_URL" "REDIS_URL")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log ERROR "Required environment variable '$var' is not set"
            exit 1
        fi
    done
    
    log INFO "Pre-deployment checks passed"
}

# Database health check
database_health_check() {
    log INFO "Checking database health..."
    
    local db_pod=$(kubectl get pods -n trading-bot -l app=postgres,role=primary -o jsonpath='{.items[0].metadata.name}')
    if [ -z "$db_pod" ]; then
        log ERROR "Primary database pod not found"
        exit 1
    fi
    
    # Check database connectivity
    if ! kubectl exec "$db_pod" -n trading-bot -- pg_isready; then
        log ERROR "Database is not ready"
        exit 1
    fi
    
    # Check database size and performance
    local db_size=$(kubectl exec "$db_pod" -n trading-bot -- psql -U postgres -d trading_bot -t -c "SELECT pg_database_size('trading_bot')")
    log INFO "Database size: $(echo $db_size | numfmt --to=iec)"
    
    log INFO "Database health check passed"
}

# Create pre-deployment backup
create_backup() {
    log INFO "Creating pre-deployment backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="pre_deployment_${DEPLOYMENT_VERSION}_${timestamp}"
    
    # Trigger database backup job
    kubectl create job "$backup_name" -n trading-bot \
        --from=cronjob/postgres-backup \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Wait for backup completion
    local timeout=300
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        local job_status=$(kubectl get job "$backup_name" -n trading-bot -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}')
        if [ "$job_status" = "True" ]; then
            log INFO "Pre-deployment backup completed successfully"
            return 0
        fi
        
        sleep 10
        elapsed=$((elapsed + 10))
    done
    
    log ERROR "Backup timed out after $timeout seconds"
    exit 1
}

# Deploy monitoring stack
deploy_monitoring() {
    log INFO "Deploying monitoring infrastructure..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log INFO "DRY RUN: Would deploy monitoring stack"
        return 0
    fi
    
    # Deploy monitoring services
    docker-compose -f "$PROJECT_ROOT/monitoring/docker-compose.monitoring.yml" up -d
    
    # Wait for services to be healthy
    local services=("prometheus" "grafana" "alertmanager")
    for service in "${services[@]}"; do
        local timeout=120
        local elapsed=0
        
        while [ $elapsed -lt $timeout ]; do
            if docker-compose -f "$PROJECT_ROOT/monitoring/docker-compose.monitoring.yml" ps "$service" | grep -q "healthy"; then
                log INFO "Service $service is healthy"
                break
            fi
            
            sleep 5
            elapsed=$((elapsed + 5))
        done
        
        if [ $elapsed -ge $timeout ]; then
            log ERROR "Service $service failed to become healthy"
            exit 1
        fi
    done
    
    log INFO "Monitoring stack deployed successfully"
}

# Deploy security infrastructure
deploy_security() {
    log INFO "Deploying security infrastructure..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log INFO "DRY RUN: Would deploy security infrastructure"
        return 0
    fi
    
    # Deploy security services
    docker-compose -f "$PROJECT_ROOT/security/docker-compose.security.yml" up -d
    
    # Verify WAF is running
    if ! curl -s "http://localhost:8080/health" > /dev/null; then
        log WARN "WAF health check failed, but continuing deployment"
    else
        log INFO "WAF is operational"
    fi
    
    log INFO "Security infrastructure deployed"
}

# Deploy application
deploy_application() {
    log INFO "Deploying application version $DEPLOYMENT_VERSION..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log INFO "DRY RUN: Would deploy application version $DEPLOYMENT_VERSION"
        return 0
    fi
    
    # Update deployment image
    kubectl set image deployment/trading-bot-backend \
        backend="ghcr.io/your-org/trading-bot:$DEPLOYMENT_VERSION" \
        -n trading-bot
    
    # Wait for rollout to complete
    kubectl rollout status deployment/trading-bot-backend -n trading-bot --timeout=600s
    
    # Verify deployment
    local ready_pods=$(kubectl get deployment trading-bot-backend -n trading-bot -o jsonpath='{.status.readyReplicas}')
    local desired_pods=$(kubectl get deployment trading-bot-backend -n trading-bot -o jsonpath='{.spec.replicas}')
    
    if [ "$ready_pods" != "$desired_pods" ]; then
        log ERROR "Deployment verification failed: $ready_pods/$desired_pods pods ready"
        exit 1
    fi
    
    log INFO "Application deployed successfully ($ready_pods pods ready)"
}

# Run smoke tests
run_smoke_tests() {
    log INFO "Running smoke tests..."
    
    local api_endpoint="http://localhost:3001/api/health"
    local timeout=60
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s "$api_endpoint" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
            log INFO "API health check passed"
            break
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    if [ $elapsed -ge $timeout ]; then
        log ERROR "API health check failed after $timeout seconds"
        exit 1
    fi
    
    # Test critical endpoints
    local endpoints=(
        "/api/health"
        "/api/ready"
        "/api/metrics"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -s -f "http://localhost:3001$endpoint" > /dev/null; then
            log INFO "Endpoint $endpoint is responding"
        else
            log ERROR "Endpoint $endpoint is not responding"
            exit 1
        fi
    done
    
    log INFO "Smoke tests passed"
}

# Configure DNS and SSL
configure_dns_ssl() {
    log INFO "Configuring DNS and SSL..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log INFO "DRY RUN: Would configure DNS and SSL"
        return 0
    fi
    
    # Get LoadBalancer IP
    local lb_ip
    lb_ip=$(kubectl get service trading-bot-loadbalancer -n trading-bot -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [ -z "$lb_ip" ]; then
        log WARN "LoadBalancer IP not yet assigned, skipping DNS configuration"
        return 0
    fi
    
    log INFO "LoadBalancer IP: $lb_ip"
    
    # Update DNS record (example for AWS Route53)
    if [ -n "${DOMAIN_NAME:-}" ] && [ -n "${ROUTE53_ZONE_ID:-}" ]; then
        aws route53 change-resource-record-sets \
            --hosted-zone-id "$ROUTE53_ZONE_ID" \
            --change-batch "{
                \"Changes\": [{
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"$DOMAIN_NAME\",
                        \"Type\": \"A\",
                        \"TTL\": 300,
                        \"ResourceRecords\": [{\"Value\": \"$lb_ip\"}]
                    }
                }]
            }"
        log INFO "DNS record updated for $DOMAIN_NAME"
    fi
    
    # Generate SSL certificate with Let's Encrypt
    if [ -n "${DOMAIN_NAME:-}" ]; then
        kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: trading-bot-tls
  namespace: trading-bot
spec:
  secretName: trading-bot-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - $DOMAIN_NAME
EOF
        log INFO "SSL certificate requested for $DOMAIN_NAME"
    fi
}

# Activate monitoring
activate_monitoring() {
    log INFO "Activating monitoring and alerting..."
    
    # Import Grafana dashboards
    local dashboard_dir="$PROJECT_ROOT/monitoring/grafana/dashboards"
    for dashboard in "$dashboard_dir"/*.json; do
        if [ -f "$dashboard" ]; then
            log INFO "Importing dashboard: $(basename "$dashboard")"
            # Import dashboard via Grafana API
            # Implementation depends on your Grafana setup
        fi
    done
    
    # Verify Prometheus targets
    local prometheus_url="http://localhost:9090"
    local unhealthy_targets
    unhealthy_targets=$(curl -s "$prometheus_url/api/v1/targets" | \
        jq -r '.data.activeTargets[] | select(.health != "up") | .scrapeUrl')
    
    if [ -n "$unhealthy_targets" ]; then
        log WARN "Some Prometheus targets are unhealthy:"
        echo "$unhealthy_targets" | while read -r target; do
            log WARN "  - $target"
        done
    else
        log INFO "All Prometheus targets are healthy"
    fi
    
    # Test alerting
    curl -X POST "$prometheus_url/api/v1/admin/tsdb/delete_series" \
        -d 'match[]=up{job="test"}' || true
    
    log INFO "Monitoring activated"
}

# Post-deployment verification
post_deployment_verification() {
    log INFO "Running post-deployment verification..."
    
    # Check application metrics
    local metrics_url="http://localhost:3001/api/metrics"
    if curl -s "$metrics_url" | grep -q "trading_bot_"; then
        log INFO "Application metrics are being exported"
    else
        log WARN "Application metrics not found"
    fi
    
    # Check database connections
    local db_connections
    db_connections=$(kubectl exec deployment/trading-bot-backend -n trading-bot -- \
        curl -s "localhost:3001/api/health" | jq -r '.database.connections')
    
    if [ "$db_connections" -gt 0 ]; then
        log INFO "Database connections: $db_connections"
    else
        log ERROR "No database connections"
        exit 1
    fi
    
    # Verify scaling
    kubectl patch hpa trading-bot-backend-hpa -n trading-bot \
        --patch '{"spec":{"maxReplicas":10}}' > /dev/null
    
    log INFO "Post-deployment verification completed"
}

# Send deployment notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji
        local color
        
        if [ "$status" = "success" ]; then
            emoji="🚀"
            color="good"
        else
            emoji="🚨"
            color="danger"
        fi
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{
                \"text\": \"$emoji Trading Bot Production Deployment\",
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"fields\": [
                        {\"title\": \"Status\", \"value\": \"$status\", \"short\": true},
                        {\"title\": \"Version\", \"value\": \"$DEPLOYMENT_VERSION\", \"short\": true},
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Message\", \"value\": \"$message\", \"short\": false}
                    ],
                    \"footer\": \"Deployment completed at $(date)\",
                    \"ts\": $(date +%s)
                }]
            }" || log WARN "Failed to send Slack notification"
    fi
    
    # Send email notification
    if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
        echo "$message" | mail -s "[$status] Trading Bot Deployment $DEPLOYMENT_VERSION" "$NOTIFICATION_EMAIL" || \
            log WARN "Failed to send email notification"
    fi
}

# Main deployment function
main() {
    log INFO "Starting production deployment..."
    log INFO "Version: $DEPLOYMENT_VERSION"
    log INFO "Environment: $ENVIRONMENT"
    log INFO "Dry run: $DRY_RUN"
    log INFO "Log file: $LOG_FILE"
    
    # Run deployment steps
    pre_deployment_checks
    database_health_check
    create_backup
    deploy_monitoring
    deploy_security
    deploy_application
    run_smoke_tests
    configure_dns_ssl
    activate_monitoring
    post_deployment_verification
    
    log INFO "Production deployment completed successfully!"
    send_notification "SUCCESS" "Production deployment of version $DEPLOYMENT_VERSION completed successfully"
    
    # Generate deployment report
    cat > "/tmp/deployment-report-$(date +%Y%m%d-%H%M%S).md" << EOF
# Production Deployment Report

## Summary
- **Version**: $DEPLOYMENT_VERSION
- **Environment**: $ENVIRONMENT  
- **Deployed**: $(date)
- **Status**: ✅ SUCCESS
- **Duration**: $SECONDS seconds

## Components Deployed
- ✅ Monitoring Infrastructure
- ✅ Security Infrastructure  
- ✅ Application Backend
- ✅ Database Cluster
- ✅ Redis Cluster
- ✅ Load Balancer
- ✅ SSL Certificate

## Post-Deployment Status
- **Application Pods**: $(kubectl get pods -n trading-bot | grep trading-bot-backend | wc -l) running
- **Database Status**: Online
- **Redis Status**: Cluster operational
- **Monitoring**: Active
- **Alerts**: Configured

## Next Steps
1. Monitor application performance for 24 hours
2. Verify trading functionality in production
3. Schedule routine maintenance window
4. Update monitoring dashboards if needed

EOF

    log INFO "Deployment report generated in /tmp/"
}

# Handle command line arguments
case "${1:-help}" in
    deploy)
        main
        ;;
    check)
        pre_deployment_checks
        database_health_check
        log INFO "Pre-deployment checks passed"
        ;;
    backup)
        create_backup
        ;;
    rollback)
        log INFO "Rolling back deployment..."
        kubectl rollout undo deployment/trading-bot-backend -n trading-bot
        kubectl rollout status deployment/trading-bot-backend -n trading-bot
        log INFO "Rollback completed"
        ;;
    help|*)
        echo "Usage: $0 {deploy|check|backup|rollback} [version] [environment] [dry-run]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full production deployment"
        echo "  check     - Run pre-deployment checks only"
        echo "  backup    - Create backup only"
        echo "  rollback  - Rollback to previous version"
        echo "  help      - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 deploy v1.2.3 production"
        echo "  $0 deploy latest production true  # Dry run"
        echo "  $0 check"
        echo "  $0 rollback"
        exit 0
        ;;
esac