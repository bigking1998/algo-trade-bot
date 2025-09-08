#!/bin/bash

# ===========================================
# Trading Bot Log Analysis & Anomaly Detection
# Automated log parsing and pattern recognition
# ===========================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${PROJECT_DIR}/logs"
ANALYSIS_OUTPUT="${LOG_DIR}/log-analysis.json"
ANOMALY_REPORT="${LOG_DIR}/anomaly-report.json"

# Analysis parameters
LOOKBACK_HOURS=${1:-24}
ERROR_THRESHOLD=10
WARNING_THRESHOLD=5
RESPONSE_TIME_THRESHOLD=2000  # milliseconds
MEMORY_THRESHOLD=80  # percentage

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/log-analyzer.log"
}

# Analyze application logs for errors and patterns
analyze_application_logs() {
    log "Analyzing application logs for the last $LOOKBACK_HOURS hours"
    
    local cutoff_time=$(date -d "$LOOKBACK_HOURS hours ago" '+%Y-%m-%d %H:%M:%S')
    local error_count=0
    local warning_count=0
    local critical_count=0
    local trading_errors=0
    local database_errors=0
    local api_errors=0
    
    # Find all log files modified in the last lookback period
    local log_files=()
    while IFS= read -r -d '' file; do
        log_files+=("$file")
    done < <(find "$LOG_DIR" -name "*.log" -newermt "$cutoff_time" -print0 2>/dev/null)
    
    if [[ ${#log_files[@]} -eq 0 ]]; then
        log "No recent log files found"
        return 0
    fi
    
    # Analysis arrays
    declare -A error_patterns
    declare -A warning_patterns
    declare -A performance_issues
    declare -A trading_anomalies
    
    # Analyze each log file
    for log_file in "${log_files[@]}"; do
        log "Analyzing: $log_file"
        
        # Count error levels
        local file_errors=$(grep -c '\[ERROR\]' "$log_file" 2>/dev/null || echo "0")
        local file_warnings=$(grep -c '\[WARN\]' "$log_file" 2>/dev/null || echo "0")
        local file_critical=$(grep -c '\[CRITICAL\]' "$log_file" 2>/dev/null || echo "0")
        
        error_count=$((error_count + file_errors))
        warning_count=$((warning_count + file_warnings))
        critical_count=$((critical_count + file_critical))
        
        # Analyze specific error patterns
        while IFS= read -r line; do
            if [[ $line =~ \[ERROR\].*trading ]]; then
                ((trading_errors++))
                error_patterns["trading_error"]="${error_patterns["trading_error"]:-0} + 1"
            elif [[ $line =~ \[ERROR\].*database ]]; then
                ((database_errors++))
                error_patterns["database_error"]="${error_patterns["database_error"]:-0} + 1"
            elif [[ $line =~ \[ERROR\].*api ]]; then
                ((api_errors++))
                error_patterns["api_error"]="${error_patterns["api_error"]:-0} + 1"
            fi
        done < <(grep '\[ERROR\]' "$log_file" 2>/dev/null || true)
        
        # Analyze performance issues
        while IFS= read -r line; do
            if [[ $line =~ response.*time.*([0-9]+)ms ]]; then
                local response_time="${BASH_REMATCH[1]}"
                if [[ $response_time -gt $RESPONSE_TIME_THRESHOLD ]]; then
                    performance_issues["slow_response"]="${performance_issues["slow_response"]:-0} + 1"
                fi
            fi
            
            if [[ $line =~ memory.*usage.*([0-9]+)% ]]; then
                local memory_usage="${BASH_REMATCH[1]}"
                if [[ $memory_usage -gt $MEMORY_THRESHOLD ]]; then
                    performance_issues["high_memory"]="${performance_issues["high_memory"]:-0} + 1"
                fi
            fi
        done < <(cat "$log_file" 2>/dev/null || true)
        
        # Analyze trading anomalies
        while IFS= read -r line; do
            if [[ $line =~ order.*failed ]]; then
                trading_anomalies["failed_orders"]="${trading_anomalies["failed_orders"]:-0} + 1"
            elif [[ $line =~ slippage.*([0-9]+\.[0-9]+)% ]]; then
                local slippage="${BASH_REMATCH[1]}"
                if (( $(echo "$slippage > 1.0" | bc -l) )); then
                    trading_anomalies["high_slippage"]="${trading_anomalies["high_slippage"]:-0} + 1"
                fi
            elif [[ $line =~ websocket.*disconnected ]]; then
                trading_anomalies["ws_disconnects"]="${trading_anomalies["ws_disconnects"]:-0} + 1"
            fi
        done < <(cat "$log_file" 2>/dev/null || true)
    done
    
    # Generate analysis report
    cat > "$ANALYSIS_OUTPUT" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "analysis_period_hours": $LOOKBACK_HOURS,
  "summary": {
    "total_errors": $error_count,
    "total_warnings": $warning_count,
    "critical_issues": $critical_count,
    "trading_errors": $trading_errors,
    "database_errors": $database_errors,
    "api_errors": $api_errors
  },
  "error_patterns": $(printf '%s\n' "${!error_patterns[@]}" | jq -R . | jq -s 'map(split(" ")) | map({(.[0]): (.[1:] | join(" ") | tonumber)}) | add // {}'),
  "performance_issues": $(printf '%s\n' "${!performance_issues[@]}" | jq -R . | jq -s 'map(split(" ")) | map({(.[0]): (.[1:] | join(" ") | tonumber)}) | add // {}'),
  "trading_anomalies": $(printf '%s\n' "${!trading_anomalies[@]}" | jq -R . | jq -s 'map(split(" ")) | map({(.[0]): (.[1:] | join(" ") | tonumber)}) | add // {}')
}
EOF
    
    # Print summary
    echo -e "\n${BLUE}📊 Log Analysis Summary (Last $LOOKBACK_HOURS hours)${NC}"
    echo "================================================"
    echo "📋 Total Errors: $error_count"
    echo "⚠️  Total Warnings: $warning_count"
    echo "🚨 Critical Issues: $critical_count"
    echo "💰 Trading Errors: $trading_errors"
    echo "🗄️  Database Errors: $database_errors"
    echo "🌐 API Errors: $api_errors"
    
    # Alert on high error rates
    if [[ $error_count -gt $ERROR_THRESHOLD ]]; then
        echo -e "\n${RED}🚨 HIGH ERROR RATE DETECTED: $error_count errors (threshold: $ERROR_THRESHOLD)${NC}"
        return 1
    elif [[ $warning_count -gt $WARNING_THRESHOLD ]]; then
        echo -e "\n${YELLOW}⚠️ ELEVATED WARNING RATE: $warning_count warnings (threshold: $WARNING_THRESHOLD)${NC}"
        return 1
    else
        echo -e "\n${GREEN}✅ Log analysis completed - no critical issues detected${NC}"
        return 0
    fi
}

# Detect anomalies using statistical analysis
detect_anomalies() {
    log "Running anomaly detection analysis"
    
    declare -A anomaly_scores
    declare -A anomalies_detected
    
    # Analyze error rate trends
    local current_hour_errors=$(grep '\[ERROR\]' "$LOG_DIR"/*.log 2>/dev/null | grep "$(date '+%Y-%m-%d %H')" | wc -l || echo "0")
    local avg_hourly_errors=$(find "$LOG_DIR" -name "*.log" -mtime -7 -exec grep '\[ERROR\]' {} \; 2>/dev/null | wc -l || echo "0")
    avg_hourly_errors=$((avg_hourly_errors / 168))  # Average over 7 days * 24 hours
    
    if [[ $avg_hourly_errors -gt 0 && $current_hour_errors -gt $((avg_hourly_errors * 3)) ]]; then
        anomalies_detected["error_spike"]="Current hour errors ($current_hour_errors) are 3x higher than average ($avg_hourly_errors)"
        anomaly_scores["error_spike"]=8
    fi
    
    # Analyze response time patterns
    local slow_responses=$(grep 'response.*time' "$LOG_DIR"/*.log 2>/dev/null | grep -o '[0-9]\+ms' | sed 's/ms//' | awk -v threshold=$RESPONSE_TIME_THRESHOLD '$1 > threshold' | wc -l || echo "0")
    local total_responses=$(grep 'response.*time' "$LOG_DIR"/*.log 2>/dev/null | wc -l || echo "1")
    local slow_response_rate=$((slow_responses * 100 / total_responses))
    
    if [[ $slow_response_rate -gt 10 ]]; then
        anomalies_detected["slow_response_rate"]="$slow_response_rate% of responses are slow (>${RESPONSE_TIME_THRESHOLD}ms)"
        anomaly_scores["slow_response_rate"]=6
    fi
    
    # Analyze trading patterns
    local failed_orders=$(grep 'order.*failed\|order.*rejected' "$LOG_DIR"/*.log 2>/dev/null | wc -l || echo "0")
    local total_orders=$(grep 'order.*placed\|order.*executed' "$LOG_DIR"/*.log 2>/dev/null | wc -l || echo "1")
    local failure_rate=$((failed_orders * 100 / total_orders))
    
    if [[ $failure_rate -gt 5 ]]; then
        anomalies_detected["high_order_failure_rate"]="Order failure rate is $failure_rate% (threshold: 5%)"
        anomaly_scores["high_order_failure_rate"]=7
    fi
    
    # Analyze WebSocket disconnections
    local ws_disconnects=$(grep -i 'websocket.*disconnect\|ws.*disconnect\|connection.*lost' "$LOG_DIR"/*.log 2>/dev/null | wc -l || echo "0")
    if [[ $ws_disconnects -gt 10 ]]; then
        anomalies_detected["frequent_disconnects"]="$ws_disconnects WebSocket disconnections detected"
        anomaly_scores["frequent_disconnects"]=5
    fi
    
    # Analyze memory usage patterns
    local high_memory_events=$(grep 'memory.*usage' "$LOG_DIR"/*.log 2>/dev/null | grep -o '[0-9]\+%' | sed 's/%//' | awk -v threshold=$MEMORY_THRESHOLD '$1 > threshold' | wc -l || echo "0")
    if [[ $high_memory_events -gt 5 ]]; then
        anomalies_detected["memory_pressure"]="$high_memory_events instances of high memory usage (>$MEMORY_THRESHOLD%)"
        anomaly_scores["memory_pressure"]=6
    fi
    
    # Generate anomaly report
    local total_anomalies=${#anomalies_detected[@]}
    local max_severity=0
    
    for score in "${anomaly_scores[@]}"; do
        if [[ $score -gt $max_severity ]]; then
            max_severity=$score
        fi
    done
    
    cat > "$ANOMALY_REPORT" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "analysis_period_hours": $LOOKBACK_HOURS,
  "total_anomalies": $total_anomalies,
  "max_severity_score": $max_severity,
  "anomalies": $(printf '%s\n' "${!anomalies_detected[@]}" | jq -R . | jq -s 'map(.) | map({
    "type": .,
    "description": ("${anomalies_detected[" + . + "]}"),
    "severity_score": ("${anomaly_scores[" + . + "]}" | tonumber)
  })'),
  "recommendations": []
}
EOF
    
    # Print anomaly summary
    echo -e "\n${BLUE}🔍 Anomaly Detection Summary${NC}"
    echo "================================"
    echo "Total Anomalies: $total_anomalies"
    echo "Max Severity: $max_severity/10"
    
    if [[ $total_anomalies -eq 0 ]]; then
        echo -e "${GREEN}✅ No anomalies detected${NC}"
        return 0
    else
        echo -e "\n${YELLOW}Anomalies Detected:${NC}"
        for anomaly in "${!anomalies_detected[@]}"; do
            echo "• $anomaly: ${anomalies_detected[$anomaly]} (Severity: ${anomaly_scores[$anomaly]}/10)"
        done
        
        if [[ $max_severity -gt 7 ]]; then
            echo -e "\n${RED}🚨 HIGH SEVERITY ANOMALIES DETECTED${NC}"
            return 2
        else
            echo -e "\n${YELLOW}⚠️ MODERATE ANOMALIES DETECTED${NC}"
            return 1
        fi
    fi
}

# Generate trending analysis
analyze_trends() {
    log "Analyzing trends over the last $LOOKBACK_HOURS hours"
    
    # Create hourly buckets for trend analysis
    declare -A hourly_errors
    declare -A hourly_warnings
    declare -A hourly_responses
    
    for hour in $(seq 0 $((LOOKBACK_HOURS - 1))); do
        local hour_pattern=$(date -d "$hour hours ago" '+%Y-%m-%d %H')
        
        hourly_errors[$hour]=$(grep '\[ERROR\]' "$LOG_DIR"/*.log 2>/dev/null | grep "$hour_pattern" | wc -l || echo "0")
        hourly_warnings[$hour]=$(grep '\[WARN\]' "$LOG_DIR"/*.log 2>/dev/null | grep "$hour_pattern" | wc -l || echo "0")
        hourly_responses[$hour]=$(grep 'response.*time' "$LOG_DIR"/*.log 2>/dev/null | grep "$hour_pattern" | wc -l || echo "0")
    done
    
    echo -e "\n${BLUE}📈 Trend Analysis (Last $LOOKBACK_HOURS hours)${NC}"
    echo "============================================"
    
    # Calculate trends
    local error_trend=0
    local warning_trend=0
    local recent_errors=0
    local old_errors=0
    
    # Compare first half vs second half
    local half_hours=$((LOOKBACK_HOURS / 2))
    
    for hour in $(seq 0 $((half_hours - 1))); do
        recent_errors=$((recent_errors + hourly_errors[$hour]))
    done
    
    for hour in $(seq $half_hours $((LOOKBACK_HOURS - 1))); do
        old_errors=$((old_errors + hourly_errors[$hour]))
    done
    
    if [[ $old_errors -gt 0 ]]; then
        error_trend=$(( (recent_errors - old_errors) * 100 / old_errors ))
    fi
    
    if [[ $error_trend -gt 20 ]]; then
        echo -e "${RED}📈 Error Rate Trending UP: +$error_trend%${NC}"
    elif [[ $error_trend -lt -20 ]]; then
        echo -e "${GREEN}📉 Error Rate Trending DOWN: $error_trend%${NC}"
    else
        echo -e "${BLUE}📊 Error Rate Stable: $error_trend%${NC}"
    fi
    
    return 0
}

# Send alert if anomalies are detected
send_anomaly_alert() {
    local severity="$1"
    local anomaly_count="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="warning"
        case "$severity" in
            "high") color="danger" ;;
            "critical") color="danger" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔍 Trading Bot Log Analysis Alert\",\"attachments\":[{\"color\":\"$color\",\"title\":\"Anomalies Detected\",\"text\":\"$anomaly_count anomalies detected in logs. Severity: $severity\"}]}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
}

# Main function
main() {
    log "=== Starting log analysis and anomaly detection ==="
    
    echo -e "${BLUE}🔍 Trading Bot Log Analysis${NC}"
    echo "================================="
    
    local analysis_result=0
    local anomaly_result=0
    
    # Run log analysis
    if ! analyze_application_logs; then
        analysis_result=$?
    fi
    
    # Run anomaly detection
    if ! detect_anomalies; then
        anomaly_result=$?
    fi
    
    # Run trend analysis
    analyze_trends
    
    # Determine overall result
    local max_result=$analysis_result
    if [[ $anomaly_result -gt $max_result ]]; then
        max_result=$anomaly_result
    fi
    
    # Send alerts if needed
    case $max_result in
        1)
            send_anomaly_alert "medium" "Some issues detected"
            echo -e "\n${YELLOW}⚠️ Analysis completed with warnings${NC}"
            ;;
        2)
            send_anomaly_alert "high" "Critical issues detected"
            echo -e "\n${RED}🚨 Analysis completed with critical issues${NC}"
            ;;
        *)
            echo -e "\n${GREEN}✅ Analysis completed successfully${NC}"
            ;;
    esac
    
    log "Log analysis and anomaly detection completed"
    
    echo -e "\nReports generated:"
    echo "• Log Analysis: $ANALYSIS_OUTPUT"
    echo "• Anomaly Report: $ANOMALY_REPORT"
    
    exit $max_result
}

# Run main function
main "$@"