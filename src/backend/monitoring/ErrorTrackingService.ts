/**
 * Error Tracking and Alerting Service
 * Centralized error handling, tracking, and alerting system
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface ErrorEvent {
  id: string;
  timestamp: number;
  level: 'error' | 'warning' | 'critical' | 'fatal';
  component: string;
  message: string;
  error?: Error;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
  tradeId?: string;
  strategyId?: string;
  stackTrace?: string;
  fingerprint: string; // For deduplication
  count: number; // How many times this error occurred
  firstSeen: number;
  lastSeen: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    errorCount?: number;
    timeWindow?: number; // minutes
    levels?: ErrorEvent['level'][];
    components?: string[];
    pattern?: RegExp;
  };
  actions: {
    slack?: { webhookUrl: string; channel: string };
    email?: { to: string[]; subject: string };
    webhook?: { url: string; method: 'POST' | 'GET'; headers?: Record<string, string> };
    pagerduty?: { serviceKey: string; severity: string };
  };
  cooldownMinutes: number; // Prevent spam
  enabled: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsByHour: Record<string, number>;
  topErrors: { fingerprint: string; count: number; message: string }[];
  recentErrors: ErrorEvent[];
}

class ErrorTrackingService extends EventEmitter {
  private static instance: ErrorTrackingService;
  private errors: Map<string, ErrorEvent> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private logDirectory: string;
  private maxErrorsInMemory = 10000;
  private cleanupIntervalMs = 60 * 60 * 1000; // 1 hour

  private constructor() {
    super();
    this.logDirectory = path.join(process.cwd(), 'logs', 'errors');
    this.ensureLogDirectory();
    this.setupDefaultAlertRules();
    this.startCleanupProcess();
  }

  public static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create error log directory:', error);
    }
  }

  private setupDefaultAlertRules(): void {
    // Critical error immediate alert
    this.addAlertRule({
      id: 'critical-errors',
      name: 'Critical Error Alert',
      condition: {
        levels: ['critical', 'fatal'],
        errorCount: 1,
        timeWindow: 1
      },
      actions: {
        slack: {
          webhookUrl: process.env.SLACK_ERROR_WEBHOOK || '',
          channel: '#trading-alerts'
        },
        email: {
          to: ['admin@tradingbot.com'],
          subject: 'CRITICAL: Trading Bot Error'
        }
      },
      cooldownMinutes: 0, // No cooldown for critical errors
      enabled: true
    });

    // High error rate alert
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate Alert',
      condition: {
        levels: ['error', 'critical', 'fatal'],
        errorCount: 10,
        timeWindow: 5
      },
      actions: {
        slack: {
          webhookUrl: process.env.SLACK_ERROR_WEBHOOK || '',
          channel: '#trading-alerts'
        }
      },
      cooldownMinutes: 15,
      enabled: true
    });

    // Trading component errors
    this.addAlertRule({
      id: 'trading-errors',
      name: 'Trading Component Errors',
      condition: {
        components: ['trading', 'strategy', 'order', 'portfolio'],
        levels: ['error', 'critical'],
        errorCount: 3,
        timeWindow: 10
      },
      actions: {
        slack: {
          webhookUrl: process.env.SLACK_TRADING_WEBHOOK || '',
          channel: '#trading-errors'
        }
      },
      cooldownMinutes: 10,
      enabled: true
    });

    // Exchange connectivity issues
    this.addAlertRule({
      id: 'exchange-errors',
      name: 'Exchange Connectivity Issues',
      condition: {
        components: ['exchange'],
        pattern: /(connection|timeout|rate.limit)/i,
        errorCount: 5,
        timeWindow: 5
      },
      actions: {
        slack: {
          webhookUrl: process.env.SLACK_INFRA_WEBHOOK || '',
          channel: '#infrastructure'
        }
      },
      cooldownMinutes: 5,
      enabled: true
    });
  }

  private startCleanupProcess(): void {
    setInterval(() => {
      this.cleanupOldErrors();
    }, this.cleanupIntervalMs);
  }

  private cleanupOldErrors(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const errorsToDelete: string[] = [];

    for (const [fingerprint, error] of this.errors) {
      if (error.lastSeen < cutoffTime) {
        errorsToDelete.push(fingerprint);
      }
    }

    errorsToDelete.forEach(fingerprint => {
      this.errors.delete(fingerprint);
    });

    // If still too many errors, remove oldest ones
    if (this.errors.size > this.maxErrorsInMemory) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.lastSeen - b.lastSeen);
      
      const toRemove = sortedErrors.slice(0, this.errors.size - this.maxErrorsInMemory);
      toRemove.forEach(([fingerprint]) => {
        this.errors.delete(fingerprint);
      });
    }

    console.log(`[ErrorTracking] Cleaned up ${errorsToDelete.length} old errors. Total errors: ${this.errors.size}`);
  }

  /**
   * Generate a fingerprint for error deduplication
   */
  private generateFingerprint(
    component: string,
    message: string,
    stackTrace?: string
  ): string {
    // Create a simplified stack trace for fingerprinting
    let fingerprintData = `${component}:${message}`;
    
    if (stackTrace) {
      // Extract just the function names and line numbers, ignore file paths
      const stackLines = stackTrace.split('\n')
        .slice(0, 3) // Take first 3 stack frames
        .map(line => line.replace(/\s*at\s+/, '').replace(/\([^)]*\)/, ''))
        .filter(line => line.trim() && !line.includes('node_modules'))
        .join('|');
      
      fingerprintData += `:${stackLines}`;
    }

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Track an error event
   */
  public trackError(
    level: ErrorEvent['level'],
    component: string,
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): string {
    const timestamp = Date.now();
    const stackTrace = error?.stack;
    const fingerprint = this.generateFingerprint(component, message, stackTrace);
    const errorId = `${fingerprint}-${timestamp}`;

    // Check if this error already exists (deduplication)
    const existingError = this.errors.get(fingerprint);
    
    if (existingError) {
      // Update existing error
      existingError.count++;
      existingError.lastSeen = timestamp;
      existingError.context = { ...existingError.context, ...context };
    } else {
      // Create new error record
      const errorEvent: ErrorEvent = {
        id: errorId,
        timestamp,
        level,
        component,
        message,
        error,
        context,
        stackTrace,
        fingerprint,
        count: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
        userId: context?.userId,
        requestId: context?.requestId,
        tradeId: context?.tradeId,
        strategyId: context?.strategyId
      };
      
      this.errors.set(fingerprint, errorEvent);
    }

    const currentError = this.errors.get(fingerprint)!;

    // Emit error event
    this.emit('error', currentError);

    // Log error to file
    this.logErrorToFile(currentError);

    // Check alert rules
    this.checkAlertRules(currentError);

    return errorId;
  }

  private async logErrorToFile(errorEvent: ErrorEvent): Promise<void> {
    const logFileName = `${new Date().toISOString().split('T')[0]}.log`;
    const logFilePath = path.join(this.logDirectory, logFileName);
    
    const logEntry = {
      timestamp: new Date(errorEvent.timestamp).toISOString(),
      level: errorEvent.level,
      component: errorEvent.component,
      message: errorEvent.message,
      fingerprint: errorEvent.fingerprint,
      count: errorEvent.count,
      context: errorEvent.context,
      stackTrace: errorEvent.stackTrace
    };

    try {
      await fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write error log:', error);
    }
  }

  private checkAlertRules(errorEvent: ErrorEvent): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      if (this.shouldTriggerAlert(rule, errorEvent)) {
        this.triggerAlert(rule, errorEvent);
      }
    }
  }

  private shouldTriggerAlert(rule: AlertRule, errorEvent: ErrorEvent): boolean {
    // Check cooldown period
    const lastAlertTime = this.lastAlertTimes.get(rule.id) || 0;
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    
    if (Date.now() - lastAlertTime < cooldownMs) {
      return false;
    }

    // Check level filter
    if (rule.condition.levels && !rule.condition.levels.includes(errorEvent.level)) {
      return false;
    }

    // Check component filter
    if (rule.condition.components && !rule.condition.components.includes(errorEvent.component)) {
      return false;
    }

    // Check pattern match
    if (rule.condition.pattern && !rule.condition.pattern.test(errorEvent.message)) {
      return false;
    }

    // Check error count in time window
    if (rule.condition.errorCount && rule.condition.timeWindow) {
      const windowStart = Date.now() - (rule.condition.timeWindow * 60 * 1000);
      const matchingErrors = Array.from(this.errors.values()).filter(err => {
        return err.lastSeen >= windowStart &&
               (!rule.condition.levels || rule.condition.levels.includes(err.level)) &&
               (!rule.condition.components || rule.condition.components.includes(err.component)) &&
               (!rule.condition.pattern || rule.condition.pattern.test(err.message));
      });

      const totalCount = matchingErrors.reduce((sum, err) => sum + err.count, 0);
      
      if (totalCount < rule.condition.errorCount) {
        return false;
      }
    }

    return true;
  }

  private async triggerAlert(rule: AlertRule, errorEvent: ErrorEvent): Promise<void> {
    this.lastAlertTimes.set(rule.id, Date.now());

    console.log(`[ErrorTracking] Triggering alert: ${rule.name} for error: ${errorEvent.message}`);

    // Slack notification
    if (rule.actions.slack?.webhookUrl) {
      await this.sendSlackAlert(rule.actions.slack, rule, errorEvent);
    }

    // Email notification
    if (rule.actions.email) {
      await this.sendEmailAlert(rule.actions.email, rule, errorEvent);
    }

    // Webhook notification
    if (rule.actions.webhook) {
      await this.sendWebhookAlert(rule.actions.webhook, rule, errorEvent);
    }

    // PagerDuty notification
    if (rule.actions.pagerduty) {
      await this.sendPagerDutyAlert(rule.actions.pagerduty, rule, errorEvent);
    }

    this.emit('alert', { rule, errorEvent });
  }

  private async sendSlackAlert(
    slackConfig: NonNullable<AlertRule['actions']['slack']>,
    rule: AlertRule,
    errorEvent: ErrorEvent
  ): Promise<void> {
    if (!slackConfig.webhookUrl) return;

    const color = {
      warning: '#ff9900',
      error: '#ff0000',
      critical: '#990000',
      fatal: '#000000'
    }[errorEvent.level] || '#cccccc';

    const payload = {
      channel: slackConfig.channel,
      username: 'Trading Bot Error Monitor',
      icon_emoji: ':warning:',
      attachments: [{
        color,
        title: `${rule.name} - ${errorEvent.level.toUpperCase()}`,
        text: errorEvent.message,
        fields: [
          { title: 'Component', value: errorEvent.component, short: true },
          { title: 'Count', value: errorEvent.count.toString(), short: true },
          { title: 'First Seen', value: new Date(errorEvent.firstSeen).toISOString(), short: true },
          { title: 'Last Seen', value: new Date(errorEvent.lastSeen).toISOString(), short: true }
        ],
        footer: 'Trading Bot Error Tracking',
        ts: Math.floor(errorEvent.timestamp / 1000)
      }]
    };

    try {
      const response = await fetch(slackConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  private async sendEmailAlert(
    emailConfig: NonNullable<AlertRule['actions']['email']>,
    rule: AlertRule,
    errorEvent: ErrorEvent
  ): Promise<void> {
    // This would typically integrate with an email service like SendGrid, SES, etc.
    console.log(`[EmailAlert] ${rule.name}: ${errorEvent.message}`);
    console.log(`Recipients: ${emailConfig.to.join(', ')}`);
    console.log(`Subject: ${emailConfig.subject}`);
  }

  private async sendWebhookAlert(
    webhookConfig: NonNullable<AlertRule['actions']['webhook']>,
    rule: AlertRule,
    errorEvent: ErrorEvent
  ): Promise<void> {
    const payload = {
      alert: rule.name,
      error: {
        id: errorEvent.id,
        level: errorEvent.level,
        component: errorEvent.component,
        message: errorEvent.message,
        count: errorEvent.count,
        timestamp: errorEvent.timestamp
      }
    };

    try {
      const response = await fetch(webhookConfig.url, {
        method: webhookConfig.method,
        headers: {
          'Content-Type': 'application/json',
          ...webhookConfig.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  private async sendPagerDutyAlert(
    pagerdutyConfig: NonNullable<AlertRule['actions']['pagerduty']>,
    rule: AlertRule,
    errorEvent: ErrorEvent
  ): Promise<void> {
    const payload = {
      service_key: pagerdutyConfig.serviceKey,
      event_type: 'trigger',
      description: `${rule.name}: ${errorEvent.message}`,
      severity: pagerdutyConfig.severity,
      details: {
        component: errorEvent.component,
        level: errorEvent.level,
        count: errorEvent.count,
        fingerprint: errorEvent.fingerprint
      }
    };

    try {
      const response = await fetch('https://events.pagerduty.com/generic/2010-04-15/create_event.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send PagerDuty alert:', error);
    }
  }

  /**
   * Add or update an alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  public removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get error statistics
   */
  public getErrorStats(hours = 24): ErrorStats {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentErrors = Array.from(this.errors.values())
      .filter(error => error.lastSeen > cutoffTime);

    const totalErrors = recentErrors.reduce((sum, error) => sum + error.count, 0);

    const errorsByLevel = recentErrors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    const errorsByComponent = recentErrors.reduce((acc, error) => {
      acc[error.component] = (acc[error.component] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    const errorsByHour = recentErrors.reduce((acc, error) => {
      const hour = new Date(error.lastSeen).getHours().toString();
      acc[hour] = (acc[hour] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    const topErrors = recentErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(error => ({
        fingerprint: error.fingerprint,
        count: error.count,
        message: error.message
      }));

    return {
      totalErrors,
      errorsByLevel,
      errorsByComponent,
      errorsByHour,
      topErrors,
      recentErrors: recentErrors.slice(0, 50) // Return latest 50 errors
    };
  }

  /**
   * Get specific error by fingerprint
   */
  public getError(fingerprint: string): ErrorEvent | undefined {
    return this.errors.get(fingerprint);
  }

  /**
   * Search errors by criteria
   */
  public searchErrors(criteria: {
    component?: string;
    level?: ErrorEvent['level'];
    message?: string;
    since?: number;
    limit?: number;
  }): ErrorEvent[] {
    let results = Array.from(this.errors.values());

    if (criteria.component) {
      results = results.filter(error => error.component === criteria.component);
    }

    if (criteria.level) {
      results = results.filter(error => error.level === criteria.level);
    }

    if (criteria.message) {
      const searchTerm = criteria.message.toLowerCase();
      results = results.filter(error => error.message.toLowerCase().includes(searchTerm));
    }

    if (criteria.since) {
      results = results.filter(error => error.lastSeen > criteria.since);
    }

    // Sort by most recent first
    results.sort((a, b) => b.lastSeen - a.lastSeen);

    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Clear all errors (useful for testing)
   */
  public clearErrors(): void {
    this.errors.clear();
  }

  /**
   * Get error tracking service health
   */
  public getServiceHealth(): {
    status: 'healthy' | 'degraded';
    errorCount: number;
    memoryUsage: number;
    alertRuleCount: number;
  } {
    const errorCount = this.errors.size;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const status = errorCount > this.maxErrorsInMemory * 0.8 ? 'degraded' : 'healthy';

    return {
      status,
      errorCount,
      memoryUsage,
      alertRuleCount: this.alertRules.size
    };
  }
}

export default ErrorTrackingService;