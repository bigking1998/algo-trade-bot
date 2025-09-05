/**
 * Event Manager - Task BE-016
 * 
 * Central event management system for the strategy engine that provides
 * event-driven architecture with comprehensive event handling, persistence,
 * routing, and analytics.
 * 
 * Features:
 * - Centralized event bus for all engine components
 * - Event persistence and replay capabilities
 * - Event filtering and routing
 * - Real-time event streaming
 * - Event analytics and pattern detection
 * - Dead letter queue for failed event processing
 */

import { EventEmitter } from 'events';

/**
 * Event Priority Levels
 */
export type EventPriority = 'low' | 'normal' | 'high' | 'critical' | 'emergency';

/**
 * Event Categories
 */
export type EventCategory = 
  | 'engine'          // Engine lifecycle events
  | 'strategy'        // Strategy execution events
  | 'signal'          // Signal generation and processing
  | 'trade'           // Trade execution events
  | 'risk'            // Risk management events
  | 'performance'     // Performance monitoring events
  | 'system'          // System and infrastructure events
  | 'error'           // Error and exception events
  | 'audit';          // Audit and compliance events

/**
 * Event Status
 */
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying' | 'dead_letter';

/**
 * Engine Event Interface
 */
export interface EngineEvent {
  // Event identification
  id: string;
  type: string;
  category: EventCategory;
  source: string;              // Component that generated the event
  
  // Event metadata
  timestamp: Date;
  priority: EventPriority;
  status: EventStatus;
  version: string;             // Event schema version
  
  // Event payload
  data: Record<string, any>;
  
  // Processing metadata
  correlationId?: string;      // For tracking related events
  causationId?: string;        // Event that caused this event
  tenantId?: string;           // Multi-tenancy support
  userId?: string;             // User context
  
  // Retry and failure handling
  retryCount: number;
  maxRetries: number;
  failureReason?: string;
  deadLetterAt?: Date;
  
  // Routing and filtering
  tags: string[];              // Tags for filtering and routing
  metadata: Record<string, any>; // Additional metadata
}

/**
 * Event Handler Interface
 */
export interface EventHandler {
  name: string;
  eventTypes: string[];       // Event types this handler processes
  categories: EventCategory[]; // Event categories this handler processes
  priority: number;           // Handler priority (lower = higher priority)
  
  // Handler configuration
  config: {
    concurrent: boolean;      // Can process events concurrently
    maxConcurrency: number;   // Maximum concurrent events
    timeout: number;          // Processing timeout in ms
    retryOnError: boolean;    // Retry failed events
    deadLetterQueue: boolean; // Send failed events to DLQ
  };
  
  // Handler function
  handle(event: EngineEvent): Promise<void>;
  
  // Optional lifecycle hooks
  onStart?(): Promise<void>;
  onStop?(): Promise<void>;
  onError?(error: Error, event: EngineEvent): Promise<void>;
}

/**
 * Event Filter Interface
 */
export interface EventFilter {
  name: string;
  condition: (event: EngineEvent) => boolean;
  action: 'allow' | 'deny' | 'transform';
  transform?: (event: EngineEvent) => EngineEvent;
  priority: number;
}

/**
 * Event Subscription
 */
export interface EventSubscription {
  id: string;
  subscriberId: string;
  eventTypes: string[];
  categories: EventCategory[];
  filters: EventFilter[];
  callback: (event: EngineEvent) => Promise<void>;
  config: {
    persistent: boolean;      // Survive system restart
    replay: boolean;          // Replay missed events
    batchSize?: number;       // Batch events for processing
    batchTimeout?: number;    // Maximum time to wait for batch
  };
  createdAt: Date;
  isActive: boolean;
}

/**
 * Event Stream
 */
export interface EventStream {
  id: string;
  name: string;
  events: EngineEvent[];
  filters: EventFilter[];
  maxSize: number;
  retention: number;          // Retention period in ms
  createdAt: Date;
  lastEventAt?: Date;
}

/**
 * Event Analytics
 */
export interface EventAnalytics {
  // Volume metrics
  totalEvents: number;
  eventsPerSecond: number;
  eventsPerMinute: number;
  eventsPerHour: number;
  
  // Processing metrics
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  retryRate: number;
  deadLetterRate: number;
  
  // Category breakdown
  eventsByCategory: Record<EventCategory, number>;
  eventsByType: Record<string, number>;
  eventsByPriority: Record<EventPriority, number>;
  
  // Performance metrics
  peakEventsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  
  // Time-based metrics
  hourlyVolume: number[];
  dailyVolume: number[];
  
  lastUpdated: Date;
}

/**
 * Event Manager Configuration
 */
export interface EventManagerConfig {
  // Storage configuration
  enablePersistence: boolean;
  persistenceProvider: 'memory' | 'file' | 'database';
  maxEvents: number;          // Maximum events in memory
  
  // Processing configuration
  maxConcurrentHandlers: number;
  defaultTimeout: number;     // Default handler timeout
  maxRetries: number;         // Default max retries
  retryDelay: number;         // Base retry delay
  enableDeadLetterQueue: boolean;
  
  // Performance configuration
  batchSize: number;          // Event processing batch size
  flushInterval: number;      // Batch flush interval
  compressionEnabled: boolean; // Event compression
  
  // Monitoring configuration
  enableAnalytics: boolean;
  analyticsInterval: number;  // Analytics update interval
  enableHealthCheck: boolean;
  healthCheckInterval: number;
  
  // Stream configuration
  maxStreams: number;
  defaultStreamSize: number;
  defaultRetention: number;
}

/**
 * Event Manager Implementation
 */
export class EventManager extends EventEmitter {
  private config: EventManagerConfig;
  
  // Event storage
  private events: Map<string, EngineEvent> = new Map();
  private eventStreams: Map<string, EventStream> = new Map();
  private deadLetterQueue: EngineEvent[] = [];
  
  // Handler management
  private handlers: Map<string, EventHandler> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private processingQueue: EngineEvent[] = [];
  
  // Analytics and monitoring
  private analytics: EventAnalytics;
  private processingMetrics: Map<string, { start: number; end?: number; success?: boolean; }> = new Map();
  
  // Timers and intervals
  private processingTimer?: NodeJS.Timeout;
  private analyticsTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  // State tracking
  private isRunning = false;
  private activeHandlers: Map<string, number> = new Map();

  constructor(config: Partial<EventManagerConfig> = {}) {
    super();
    
    this.config = {
      enablePersistence: true,
      persistenceProvider: 'memory',
      maxEvents: 10000,
      maxConcurrentHandlers: 10,
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      enableDeadLetterQueue: true,
      batchSize: 100,
      flushInterval: 1000,
      compressionEnabled: false,
      enableAnalytics: true,
      analyticsInterval: 60000,
      enableHealthCheck: true,
      healthCheckInterval: 30000,
      maxStreams: 100,
      defaultStreamSize: 1000,
      defaultRetention: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
    
    this.analytics = this.initializeAnalytics();
  }

  /**
   * Initialize the event manager
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Start processing loop
      this.startProcessingLoop();
      
      // Start analytics collection
      if (this.config.enableAnalytics) {
        this.startAnalytics();
      }
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      this.isRunning = true;
      this.emit('initialized');

    } catch (error) {
      throw new Error(`Failed to initialize event manager: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Emit an event
   */
  async emitEvent(
    type: string,
    category: EventCategory,
    source: string,
    data: Record<string, any>,
    options: Partial<{
      priority: EventPriority;
      correlationId: string;
      causationId: string;
      tags: string[];
      metadata: Record<string, any>;
    }> = {}
  ): Promise<string> {
    const event: EngineEvent = {
      id: this.generateEventId(),
      type,
      category,
      source,
      timestamp: new Date(),
      priority: options.priority || 'normal',
      status: 'pending',
      version: '1.0',
      data,
      correlationId: options.correlationId,
      causationId: options.causationId,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      tags: options.tags || [],
      metadata: options.metadata || {}
    };
    
    // Store event
    await this.storeEvent(event);
    
    // Add to processing queue
    this.processingQueue.push(event);
    
    // Update analytics
    this.updateEventAnalytics(event);
    
    // Notify subscribers immediately for high priority events
    if (event.priority === 'critical' || event.priority === 'emergency') {
      await this.processEventImmediately(event);
    }
    
    return event.id;
  }

  /**
   * Register an event handler
   */
  registerHandler(handler: EventHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Handler ${handler.name} already registered`);
    }
    
    this.handlers.set(handler.name, handler);
    
    // Initialize handler if event manager is running
    if (this.isRunning && handler.onStart) {
      handler.onStart().catch(error => {
        this.emit('handler_start_error', { handler: handler.name, error });
      });
    }
    
    this.emit('handler_registered', { handler: handler.name });
  }

  /**
   * Unregister an event handler
   */
  async unregisterHandler(handlerName: string): Promise<void> {
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      return;
    }
    
    // Stop handler
    if (handler.onStop) {
      await handler.onStop();
    }
    
    this.handlers.delete(handlerName);
    this.emit('handler_unregistered', { handler: handlerName });
  }

  /**
   * Subscribe to events
   */
  subscribe(subscription: Omit<EventSubscription, 'id' | 'createdAt' | 'isActive'>): string {
    const sub: EventSubscription = {
      ...subscription,
      id: this.generateEventId(),
      createdAt: new Date(),
      isActive: true
    };
    
    this.subscriptions.set(sub.id, sub);
    
    // Replay events if requested
    if (sub.config.replay) {
      this.replayEventsForSubscription(sub);
    }
    
    this.emit('subscription_created', { subscriptionId: sub.id });
    return sub.id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);
      this.emit('subscription_removed', { subscriptionId });
      return true;
    }
    return false;
  }

  /**
   * Create an event stream
   */
  createStream(
    name: string,
    filters: EventFilter[] = [],
    maxSize: number = this.config.defaultStreamSize,
    retention: number = this.config.defaultRetention
  ): string {
    const stream: EventStream = {
      id: this.generateEventId(),
      name,
      events: [],
      filters,
      maxSize,
      retention,
      createdAt: new Date()
    };
    
    this.eventStreams.set(stream.id, stream);
    this.emit('stream_created', { streamId: stream.id, name });
    
    return stream.id;
  }

  /**
   * Get events from a stream
   */
  getStreamEvents(streamId: string, limit?: number): EngineEvent[] {
    const stream = this.eventStreams.get(streamId);
    if (!stream) {
      return [];
    }
    
    const events = [...stream.events];
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): EngineEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get events by filter
   */
  getEvents(filter: {
    types?: string[];
    categories?: EventCategory[];
    source?: string;
    priority?: EventPriority;
    status?: EventStatus;
    fromTimestamp?: Date;
    toTimestamp?: Date;
    tags?: string[];
    limit?: number;
  }): EngineEvent[] {
    let events = Array.from(this.events.values());
    
    // Apply filters
    if (filter.types) {
      events = events.filter(e => filter.types!.includes(e.type));
    }
    
    if (filter.categories) {
      events = events.filter(e => filter.categories!.includes(e.category));
    }
    
    if (filter.source) {
      events = events.filter(e => e.source === filter.source);
    }
    
    if (filter.priority) {
      events = events.filter(e => e.priority === filter.priority);
    }
    
    if (filter.status) {
      events = events.filter(e => e.status === filter.status);
    }
    
    if (filter.fromTimestamp) {
      events = events.filter(e => e.timestamp >= filter.fromTimestamp!);
    }
    
    if (filter.toTimestamp) {
      events = events.filter(e => e.timestamp <= filter.toTimestamp!);
    }
    
    if (filter.tags && filter.tags.length > 0) {
      events = events.filter(e => 
        filter.tags!.some(tag => e.tags.includes(tag))
      );
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply limit
    if (filter.limit) {
      events = events.slice(0, filter.limit);
    }
    
    return events;
  }

  /**
   * Get current analytics
   */
  getAnalytics(): EventAnalytics {
    return { ...this.analytics };
  }

  /**
   * Get dead letter queue events
   */
  getDeadLetterQueue(): EngineEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry dead letter events
   */
  async retryDeadLetterEvents(eventIds?: string[]): Promise<void> {
    const eventsToRetry = eventIds 
      ? this.deadLetterQueue.filter(e => eventIds.includes(e.id))
      : [...this.deadLetterQueue];
    
    for (const event of eventsToRetry) {
      event.status = 'pending';
      event.retryCount = 0;
      event.deadLetterAt = undefined;
      event.failureReason = undefined;
      
      this.processingQueue.push(event);
      
      // Remove from dead letter queue
      const index = this.deadLetterQueue.indexOf(event);
      if (index >= 0) {
        this.deadLetterQueue.splice(index, 1);
      }
    }
    
    this.emit('dead_letter_retry', { count: eventsToRetry.length });
  }

  /**
   * Record event for persistence and analysis
   */
  recordEvent(type: string, data: any): void {
    this.emitEvent(type, 'system', 'event_manager', data).catch(error => {
      console.error('Failed to record event:', error);
    });
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    metrics: {
      queueSize: number;
      activeHandlers: number;
      errorRate: number;
      avgProcessingTime: number;
    };
  } {
    const issues = [];
    const metrics = {
      queueSize: this.processingQueue.length,
      activeHandlers: this.activeHandlers.size,
      errorRate: this.analytics.errorRate,
      avgProcessingTime: this.analytics.averageProcessingTime
    };
    
    // Check for issues
    if (metrics.queueSize > 1000) {
      issues.push('High queue size - processing may be lagging');
    }
    
    if (metrics.errorRate > 5) {
      issues.push('High error rate detected');
    }
    
    if (metrics.avgProcessingTime > 5000) {
      issues.push('High average processing time');
    }
    
    if (this.deadLetterQueue.length > 100) {
      issues.push('High number of dead letter events');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      metrics
    };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.isRunning = false;
    
    // Clear timers
    if (this.processingTimer) clearInterval(this.processingTimer);
    if (this.analyticsTimer) clearInterval(this.analyticsTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    // Stop all handlers
    const stopPromises = Array.from(this.handlers.values()).map(handler =>
      handler.onStop ? handler.onStop() : Promise.resolve()
    );
    
    await Promise.allSettled(stopPromises);
    
    // Process remaining events
    await this.processRemainingEvents();
    
    this.emit('cleanup_completed');
  }

  // === PRIVATE METHODS ===

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeEvent(event: EngineEvent): Promise<void> {
    this.events.set(event.id, event);
    
    // Maintain size limit
    if (this.events.size > this.config.maxEvents) {
      const oldestEvent = Array.from(this.events.values())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      
      if (oldestEvent) {
        this.events.delete(oldestEvent.id);
      }
    }
    
    // Add to relevant streams
    for (const stream of this.eventStreams.values()) {
      if (this.eventMatchesFilters(event, stream.filters)) {
        stream.events.push(event);
        stream.lastEventAt = new Date();
        
        // Maintain stream size
        if (stream.events.length > stream.maxSize) {
          stream.events = stream.events.slice(-stream.maxSize);
        }
      }
    }
  }

  private startProcessingLoop(): void {
    this.processingTimer = setInterval(async () => {
      await this.processEventBatch();
    }, this.config.flushInterval);
  }

  private async processEventBatch(): Promise<void> {
    if (this.processingQueue.length === 0) {
      return;
    }
    
    const batchSize = Math.min(this.config.batchSize, this.processingQueue.length);
    const batch = this.processingQueue.splice(0, batchSize);
    
    // Process events in parallel with concurrency limit
    const processingPromises = batch.map(event => this.processEvent(event));
    await Promise.allSettled(processingPromises);
  }

  private async processEventImmediately(event: EngineEvent): Promise<void> {
    await this.processEvent(event);
  }

  private async processEvent(event: EngineEvent): Promise<void> {
    const processingId = `${event.id}_${Date.now()}`;
    this.processingMetrics.set(processingId, { start: Date.now() });
    
    try {
      event.status = 'processing';
      
      // Find matching handlers
      const matchingHandlers = this.findMatchingHandlers(event);
      
      // Process with each handler
      const handlerPromises = matchingHandlers.map(handler => 
        this.executeHandler(handler, event)
      );
      
      const results = await Promise.allSettled(handlerPromises);
      
      // Process subscriptions
      await this.processSubscriptions(event);
      
      // Check if all handlers succeeded
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length === 0) {
        event.status = 'completed';
        this.processingMetrics.get(processingId)!.success = true;
      } else {
        await this.handleEventFailure(event, failures[0] as PromiseRejectedResult);
        this.processingMetrics.get(processingId)!.success = false;
      }
      
    } catch (error) {
      await this.handleEventFailure(event, { reason: error });
      this.processingMetrics.get(processingId)!.success = false;
    } finally {
      this.processingMetrics.get(processingId)!.end = Date.now();
    }
  }

  private findMatchingHandlers(event: EngineEvent): EventHandler[] {
    return Array.from(this.handlers.values()).filter(handler =>
      (handler.eventTypes.length === 0 || handler.eventTypes.includes(event.type)) &&
      (handler.categories.length === 0 || handler.categories.includes(event.category))
    ).sort((a, b) => a.priority - b.priority);
  }

  private async executeHandler(handler: EventHandler, event: EngineEvent): Promise<void> {
    try {
      // Check concurrency limits
      const currentConcurrency = this.activeHandlers.get(handler.name) || 0;
      if (!handler.config.concurrent && currentConcurrency > 0) {
        throw new Error(`Handler ${handler.name} is already processing an event`);
      }
      
      if (currentConcurrency >= handler.config.maxConcurrency) {
        throw new Error(`Handler ${handler.name} has reached max concurrency limit`);
      }
      
      // Update active count
      this.activeHandlers.set(handler.name, currentConcurrency + 1);
      
      // Execute with timeout
      const timeout = handler.config.timeout || this.config.defaultTimeout;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Handler timeout')), timeout)
      );
      
      await Promise.race([handler.handle(event), timeoutPromise]);
      
    } catch (error) {
      // Call handler error hook
      if (handler.onError) {
        try {
          await handler.onError(error as Error, event);
        } catch (hookError) {
          console.error('Handler error hook failed:', hookError);
        }
      }
      throw error;
    } finally {
      // Update active count
      const currentConcurrency = this.activeHandlers.get(handler.name) || 0;
      this.activeHandlers.set(handler.name, Math.max(0, currentConcurrency - 1));
    }
  }

  private async processSubscriptions(event: EngineEvent): Promise<void> {
    const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(sub =>
      sub.isActive &&
      (sub.eventTypes.length === 0 || sub.eventTypes.includes(event.type)) &&
      (sub.categories.length === 0 || sub.categories.includes(event.category)) &&
      this.eventMatchesFilters(event, sub.filters)
    );
    
    // Process subscriptions
    for (const subscription of matchingSubscriptions) {
      try {
        await subscription.callback(event);
      } catch (error) {
        this.emit('subscription_error', {
          subscriptionId: subscription.id,
          event: event.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async handleEventFailure(event: EngineEvent, failure: PromiseRejectedResult | { reason: any }): Promise<void> {
    event.failureReason = failure.reason instanceof Error ? failure.reason.message : String(failure.reason);
    event.retryCount++;
    
    if (event.retryCount < event.maxRetries) {
      // Retry with exponential backoff
      event.status = 'retrying';
      const delay = this.config.retryDelay * Math.pow(2, event.retryCount - 1);
      
      setTimeout(() => {
        event.status = 'pending';
        this.processingQueue.push(event);
      }, delay);
      
    } else {
      // Move to dead letter queue
      event.status = 'dead_letter';
      event.deadLetterAt = new Date();
      
      if (this.config.enableDeadLetterQueue) {
        this.deadLetterQueue.push(event);
        
        // Maintain dead letter queue size
        if (this.deadLetterQueue.length > 1000) {
          this.deadLetterQueue = this.deadLetterQueue.slice(-500);
        }
      }
      
      this.emit('event_dead_letter', { event: event.id, reason: event.failureReason });
    }
  }

  private eventMatchesFilters(event: EngineEvent, filters: EventFilter[]): boolean {
    if (filters.length === 0) {
      return true;
    }
    
    // Apply filters in priority order
    const sortedFilters = [...filters].sort((a, b) => a.priority - b.priority);
    
    for (const filter of sortedFilters) {
      const matches = filter.condition(event);
      
      if (filter.action === 'deny' && matches) {
        return false;
      }
      
      if (filter.action === 'allow' && matches) {
        return true;
      }
    }
    
    return true; // Default allow if no deny filters matched
  }

  private async replayEventsForSubscription(subscription: EventSubscription): Promise<void> {
    const relevantEvents = this.getEvents({
      types: subscription.eventTypes.length > 0 ? subscription.eventTypes : undefined,
      categories: subscription.categories.length > 0 ? subscription.categories : undefined,
      limit: 100 // Limit replay events
    });
    
    for (const event of relevantEvents.reverse()) {
      try {
        await subscription.callback(event);
      } catch (error) {
        this.emit('replay_error', {
          subscriptionId: subscription.id,
          event: event.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private updateEventAnalytics(event: EngineEvent): void {
    this.analytics.totalEvents++;
    
    // Update category counts
    if (this.analytics.eventsByCategory[event.category]) {
      this.analytics.eventsByCategory[event.category]++;
    } else {
      this.analytics.eventsByCategory[event.category] = 1;
    }
    
    // Update type counts
    if (this.analytics.eventsByType[event.type]) {
      this.analytics.eventsByType[event.type]++;
    } else {
      this.analytics.eventsByType[event.type] = 1;
    }
    
    // Update priority counts
    if (this.analytics.eventsByPriority[event.priority]) {
      this.analytics.eventsByPriority[event.priority]++;
    } else {
      this.analytics.eventsByPriority[event.priority] = 1;
    }
  }

  private startAnalytics(): void {
    this.analyticsTimer = setInterval(() => {
      this.updateAnalytics();
    }, this.config.analyticsInterval);
  }

  private updateAnalytics(): void {
    const now = Date.now();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    
    // Calculate rates
    const recentEvents = Array.from(this.events.values())
      .filter(e => now - e.timestamp.getTime() <= minute);
    
    this.analytics.eventsPerSecond = recentEvents.length / 60;
    this.analytics.eventsPerMinute = recentEvents.length;
    
    const hourlyEvents = Array.from(this.events.values())
      .filter(e => now - e.timestamp.getTime() <= hour);
    
    this.analytics.eventsPerHour = hourlyEvents.length;
    
    // Calculate processing metrics
    const completedMetrics = Array.from(this.processingMetrics.values())
      .filter(m => m.end !== undefined);
    
    if (completedMetrics.length > 0) {
      const processingTimes = completedMetrics.map(m => m.end! - m.start);
      this.analytics.averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      
      const successful = completedMetrics.filter(m => m.success).length;
      this.analytics.successRate = (successful / completedMetrics.length) * 100;
      this.analytics.errorRate = ((completedMetrics.length - successful) / completedMetrics.length) * 100;
    }
    
    // Calculate retry and dead letter rates
    const totalWithRetries = Array.from(this.events.values()).filter(e => e.retryCount > 0).length;
    this.analytics.retryRate = this.analytics.totalEvents > 0 ? (totalWithRetries / this.analytics.totalEvents) * 100 : 0;
    this.analytics.deadLetterRate = this.analytics.totalEvents > 0 ? (this.deadLetterQueue.length / this.analytics.totalEvents) * 100 : 0;
    
    this.analytics.lastUpdated = new Date();
  }

  private startCleanupTasks(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  private performCleanup(): void {
    const now = Date.now();
    
    // Clean old processing metrics
    for (const [key, metric] of this.processingMetrics.entries()) {
      if (now - metric.start > 3600000) { // 1 hour
        this.processingMetrics.delete(key);
      }
    }
    
    // Clean old stream events
    for (const stream of this.eventStreams.values()) {
      stream.events = stream.events.filter(e => 
        now - e.timestamp.getTime() <= stream.retention
      );
    }
  }

  private async processRemainingEvents(): Promise<void> {
    // Process any remaining events in queue
    if (this.processingQueue.length > 0) {
      console.log(`Processing ${this.processingQueue.length} remaining events...`);
      await this.processEventBatch();
    }
  }

  private initializeAnalytics(): EventAnalytics {
    return {
      totalEvents: 0,
      eventsPerSecond: 0,
      eventsPerMinute: 0,
      eventsPerHour: 0,
      averageProcessingTime: 0,
      successRate: 100,
      errorRate: 0,
      retryRate: 0,
      deadLetterRate: 0,
      eventsByCategory: {} as Record<EventCategory, number>,
      eventsByType: {},
      eventsByPriority: {} as Record<EventPriority, number>,
      peakEventsPerSecond: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      hourlyVolume: [],
      dailyVolume: [],
      lastUpdated: new Date()
    };
  }
}

export default EventManager;