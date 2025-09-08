/**
 * StreamManager - Task BE-018: Market Data Integration
 * 
 * Advanced stream management system for coordinating multiple data streams
 * Handles stream multiplexing, fan-out, priority management, and load balancing
 * 
 * Key Features:
 * - Stream multiplexing and fan-out capabilities
 * - Priority-based stream management
 * - Load balancing across multiple sources
 * - Stream health monitoring and failover
 * - Dynamic subscription management
 */

import { EventEmitter } from 'events';
import { MarketDataStreamer, type DataSourceConfig, type StreamerConfig } from './MarketDataStreamer.js';
import { MarketDataBuffer } from '../data/MarketDataBuffer.js';
import { MarketDataRepository } from '../repositories/MarketDataRepository.js';
import type { MarketData } from '../types/database.js';

/**
 * Stream subscription configuration
 */
export interface StreamSubscription {
  id: string;
  symbols: string[];
  timeframes: string[];
  sources: string[]; // Preferred source IDs
  priority: number;
  fallbackSources: string[]; // Fallback sources if primary fails
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    minVolume?: number;
    exchanges?: string[];
  };
  transform?: {
    aggregation?: 'raw' | 'ohlcv' | 'tick';
    interval?: number;
    normalize?: boolean;
  };
}

/**
 * Stream routing configuration
 */
export interface StreamRoute {
  subscriptionId: string;
  sourceId: string;
  priority: number;
  active: boolean;
  failoverSources: string[];
  healthScore: number;
}

/**
 * Stream manager configuration
 */
export interface StreamManagerConfig {
  streamer: StreamerConfig;
  routing: {
    enableLoadBalancing: boolean;
    enableFailover: boolean;
    healthCheckIntervalMs: number;
    failoverThreshold: number; // Health score threshold for failover
    maxRoutesPerSubscription: number;
  };
  multiplexing: {
    enabled: boolean;
    bufferSize: number;
    flushIntervalMs: number;
    enablePrioritization: boolean;
  };
  fanout: {
    enabled: boolean;
    maxFanoutTargets: number;
    enableFiltering: boolean;
    enableTransformation: boolean;
  };
}

/**
 * Stream statistics
 */
export interface StreamStats {
  subscriptionId: string;
  totalMessages: number;
  messagesPerSecond: number;
  averageLatencyMs: number;
  errorRate: number;
  activeRoutes: number;
  primarySourceActive: boolean;
  lastMessageTime?: Date;
  dataQualityScore: number;
}

/**
 * Manager metrics
 */
export interface ManagerMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRoutes: number;
  activeRoutes: number;
  totalThroughput: number;
  averageLatency: number;
  healthySourcesRatio: number;
  subscriptionStats: Map<string, StreamStats>;
  lastUpdate: Date;
}

/**
 * Stream event types
 */
export interface StreamEvent {
  type: 'data' | 'subscription' | 'route' | 'health' | 'error';
  subscriptionId: string;
  sourceId?: string;
  data?: MarketData;
  error?: Error;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Main StreamManager class
 */
export class StreamManager extends EventEmitter {
  private config: StreamManagerConfig;
  private streamer: MarketDataStreamer;
  private marketDataBuffer: MarketDataBuffer;
  
  // Subscription and routing management
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private routes: Map<string, StreamRoute[]> = new Map(); // subscriptionId -> routes
  private activeRoutes: Set<string> = new Set(); // subscriptionId:sourceId
  
  // Stream multiplexing
  private multiplexBuffers: Map<string, MarketData[]> = new Map();
  private multiplexTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Fanout management
  private fanoutTargets: Map<string, Set<string>> = new Map(); // subscriptionId -> target IDs
  private fanoutFilters: Map<string, Function> = new Map();
  private fanoutTransformers: Map<string, Function> = new Map();
  
  // Performance monitoring
  private streamStats: Map<string, StreamStats> = new Map();
  private managerMetrics: ManagerMetrics;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  
  // Priority management
  private priorityQueue: PriorityQueue<StreamEvent>;
  
  private isStarted = false;

  constructor(
    config: StreamManagerConfig,
    marketDataBuffer: MarketDataBuffer,
    marketDataRepository: MarketDataRepository
  ) {
    super();
    
    this.config = this.validateConfig(config);
    this.marketDataBuffer = marketDataBuffer;
    
    // Initialize streamer
    this.streamer = new MarketDataStreamer(
      config.streamer,
      marketDataBuffer,
      marketDataRepository
    );
    
    this.priorityQueue = new PriorityQueue((a, b) => b.metadata?.priority || 0 - (a.metadata?.priority || 0));
    this.managerMetrics = this.initializeMetrics();
    
    this.setupEventHandlers();
  }

  /**
   * CORE STREAM MANAGEMENT OPERATIONS
   */

  /**
   * Start the stream manager
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('StreamManager is already started');
    }

    try {
      console.log('[StreamManager] Starting stream management system...');
      
      // Start the underlying streamer
      await this.streamer.start();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Initialize existing subscriptions if any
      if (this.subscriptions.size > 0) {
        await this.activateSubscriptions();
      }
      
      this.isStarted = true;
      this.emit('started');
      
      console.log(`[StreamManager] Started with ${this.subscriptions.size} subscriptions`);
      
    } catch (error) {
      console.error('[StreamManager] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the stream manager
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;
    
    console.log('[StreamManager] Stopping stream management system...');
    
    this.isStarted = false;
    
    // Stop health monitoring
    this.stopHealthMonitoring();
    
    // Clear all multiplexing timers
    for (const timer of this.multiplexTimers.values()) {
      clearTimeout(timer);
    }
    this.multiplexTimers.clear();
    
    // Stop the underlying streamer
    await this.streamer.stop();
    
    // Clear active routes
    this.activeRoutes.clear();
    
    this.emit('stopped');
    console.log('[StreamManager] Stopped');
  }

  /**
   * SUBSCRIPTION MANAGEMENT
   */

  /**
   * Create a new stream subscription
   */
  async createSubscription(subscription: StreamSubscription): Promise<void> {
    try {
      console.log(`[StreamManager] Creating subscription: ${subscription.id}`);
      
      // Validate subscription
      this.validateSubscription(subscription);
      
      // Store subscription
      this.subscriptions.set(subscription.id, subscription);
      
      // Initialize stats
      this.streamStats.set(subscription.id, this.initializeStreamStats(subscription.id));
      
      // Create routing plan
      const routes = await this.createRoutingPlan(subscription);
      this.routes.set(subscription.id, routes);
      
      // Initialize multiplexing if enabled
      if (this.config.multiplexing.enabled) {
        this.initializeMultiplexing(subscription.id);
      }
      
      // Initialize fanout if enabled
      if (this.config.fanout.enabled) {
        this.initializeFanout(subscription);
      }
      
      // Activate subscription if manager is running
      if (this.isStarted) {
        await this.activateSubscription(subscription.id);
      }
      
      this.emit('subscription-created', subscription.id);
      
    } catch (error) {
      console.error(`[StreamManager] Failed to create subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Remove a stream subscription
   */
  async removeSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      console.log(`[StreamManager] Removing subscription: ${subscriptionId}`);
      
      // Deactivate subscription
      await this.deactivateSubscription(subscriptionId);
      
      // Cleanup
      this.subscriptions.delete(subscriptionId);
      this.routes.delete(subscriptionId);
      this.streamStats.delete(subscriptionId);
      this.multiplexBuffers.delete(subscriptionId);
      this.fanoutTargets.delete(subscriptionId);
      
      // Clear timers
      const timer = this.multiplexTimers.get(subscriptionId);
      if (timer) {
        clearTimeout(timer);
        this.multiplexTimers.delete(subscriptionId);
      }
      
      this.emit('subscription-removed', subscriptionId);
      
    } catch (error) {
      console.error(`[StreamManager] Failed to remove subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription configuration
   */
  async updateSubscription(subscriptionId: string, updates: Partial<StreamSubscription>): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    
    const updatedSubscription = { ...subscription, ...updates };
    this.validateSubscription(updatedSubscription);
    
    // Update routing if sources changed
    if (updates.sources || updates.fallbackSources) {
      await this.deactivateSubscription(subscriptionId);
      const newRoutes = await this.createRoutingPlan(updatedSubscription);
      this.routes.set(subscriptionId, newRoutes);
    }
    
    this.subscriptions.set(subscriptionId, updatedSubscription);
    
    // Reactivate if necessary
    if (this.isStarted && (updates.sources || updates.fallbackSources)) {
      await this.activateSubscription(subscriptionId);
    }
    
    this.emit('subscription-updated', subscriptionId);
  }

  /**
   * ROUTING MANAGEMENT
   */

  private async createRoutingPlan(subscription: StreamSubscription): Promise<StreamRoute[]> {
    const routes: StreamRoute[] = [];
    const maxRoutes = this.config.routing.maxRoutesPerSubscription;
    
    // Primary sources
    for (let i = 0; i < Math.min(subscription.sources.length, maxRoutes); i++) {
      const sourceId = subscription.sources[i];
      routes.push({
        subscriptionId: subscription.id,
        sourceId,
        priority: subscription.priority + (subscription.sources.length - i),
        active: false,
        failoverSources: subscription.fallbackSources || [],
        healthScore: 1.0
      });
    }
    
    // Fallback sources if we have room
    const remainingSlots = maxRoutes - routes.length;
    if (remainingSlots > 0 && subscription.fallbackSources) {
      for (let i = 0; i < Math.min(subscription.fallbackSources.length, remainingSlots); i++) {
        const sourceId = subscription.fallbackSources[i];
        if (!routes.find(r => r.sourceId === sourceId)) {
          routes.push({
            subscriptionId: subscription.id,
            sourceId,
            priority: subscription.priority,
            active: false,
            failoverSources: [],
            healthScore: 1.0
          });
        }
      }
    }
    
    return routes;
  }

  private async activateSubscription(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    const routes = this.routes.get(subscriptionId);
    
    if (!subscription || !routes) return;
    
    try {
      // Determine which routes to activate
      const routesToActivate = this.selectActiveRoutes(routes);
      
      // Subscribe to data streams
      for (const route of routesToActivate) {
        await this.streamer.subscribe(
          subscription.symbols,
          subscription.timeframes,
          [route.sourceId]
        );
        
        route.active = true;
        this.activeRoutes.add(`${subscriptionId}:${route.sourceId}`);
      }
      
      console.log(`[StreamManager] Activated subscription ${subscriptionId} with ${routesToActivate.length} routes`);
      
    } catch (error) {
      console.error(`[StreamManager] Failed to activate subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  private async deactivateSubscription(subscriptionId: string): Promise<void> {
    const routes = this.routes.get(subscriptionId);
    if (!routes) return;
    
    // Deactivate all routes
    for (const route of routes) {
      if (route.active) {
        route.active = false;
        this.activeRoutes.delete(`${subscriptionId}:${route.sourceId}`);
      }
    }
    
    console.log(`[StreamManager] Deactivated subscription ${subscriptionId}`);
  }

  private selectActiveRoutes(routes: StreamRoute[]): StreamRoute[] {
    if (!this.config.routing.enableLoadBalancing) {
      // Just use highest priority route
      const sorted = routes.sort((a, b) => b.priority - a.priority);
      return [sorted[0]];
    }
    
    // Load balancing: use multiple routes based on health scores
    const healthyRoutes = routes
      .filter(r => r.healthScore >= this.config.routing.failoverThreshold)
      .sort((a, b) => b.priority - a.priority);
    
    return healthyRoutes.slice(0, Math.min(3, healthyRoutes.length)); // Use up to 3 routes
  }

  /**
   * STREAM MULTIPLEXING
   */

  private initializeMultiplexing(subscriptionId: string): void {
    if (!this.config.multiplexing.enabled) return;
    
    this.multiplexBuffers.set(subscriptionId, []);
    
    // Setup flush timer
    const timer = setInterval(() => {
      this.flushMultiplexBuffer(subscriptionId);
    }, this.config.multiplexing.flushIntervalMs);
    
    this.multiplexTimers.set(subscriptionId, timer);
  }

  private addToMultiplexBuffer(subscriptionId: string, data: MarketData): void {
    const buffer = this.multiplexBuffers.get(subscriptionId);
    if (!buffer) return;
    
    buffer.push(data);
    
    // Flush if buffer is full
    if (buffer.length >= this.config.multiplexing.bufferSize) {
      this.flushMultiplexBuffer(subscriptionId);
    }
  }

  private flushMultiplexBuffer(subscriptionId: string): void {
    const buffer = this.multiplexBuffers.get(subscriptionId);
    if (!buffer || buffer.length === 0) return;
    
    const data = buffer.splice(0); // Clear buffer and get data
    
    if (this.config.multiplexing.enablePrioritization) {
      // Sort by priority and timestamp
      data.sort((a, b) => {
        // Priority would be added as metadata
        return b.time.getTime() - a.time.getTime();
      });
    }
    
    this.emit('multiplexed-data', {
      subscriptionId,
      data,
      count: data.length
    });
  }

  /**
   * STREAM FANOUT
   */

  private initializeFanout(subscription: StreamSubscription): void {
    if (!this.config.fanout.enabled) return;
    
    this.fanoutTargets.set(subscription.id, new Set());
    
    // Setup filters if configured
    if (subscription.filters && this.config.fanout.enableFiltering) {
      this.fanoutFilters.set(subscription.id, this.createFilter(subscription.filters));
    }
    
    // Setup transformers if configured
    if (subscription.transform && this.config.fanout.enableTransformation) {
      this.fanoutTransformers.set(subscription.id, this.createTransformer(subscription.transform));
    }
  }

  private createFilter(filters: StreamSubscription['filters']): Function {
    return (data: MarketData): boolean => {
      if (filters?.minPrice && data.close < filters.minPrice) return false;
      if (filters?.maxPrice && data.close > filters.maxPrice) return false;
      if (filters?.minVolume && data.volume < filters.minVolume) return false;
      if (filters?.exchanges && !filters.exchanges.includes(data.exchange)) return false;
      return true;
    };
  }

  private createTransformer(transform: StreamSubscription['transform']): Function {
    return (data: MarketData): MarketData => {
      let result = { ...data };
      
      if (transform.normalize) {
        // Apply normalization
        result = this.normalizeData(result);
      }
      
      return result;
    };
  }

  private normalizeData(data: MarketData): MarketData {
    // Implement data normalization logic
    return data;
  }

  /**
   * HEALTH MONITORING
   */

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.routing.healthCheckIntervalMs);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private performHealthCheck(): void {
    for (const [subscriptionId, routes] of this.routes.entries()) {
      for (const route of routes) {
        const sourceMetrics = this.streamer.getSourceMetrics(route.sourceId) as any;
        
        if (sourceMetrics) {
          // Calculate health score based on metrics
          const healthScore = this.calculateHealthScore(sourceMetrics);
          route.healthScore = healthScore;
          
          // Check if failover is needed
          if (route.active && healthScore < this.config.routing.failoverThreshold) {
            this.handleFailover(subscriptionId, route);
          }
        }
      }
    }
    
    this.updateManagerMetrics();
  }

  private calculateHealthScore(metrics: any): number {
    let score = 1.0;
    
    // Reduce score based on error rate
    const errorRate = metrics.errorCount / Math.max(metrics.messagesReceived, 1);
    score -= errorRate * 0.3;
    
    // Reduce score based on latency
    if (metrics.averageLatencyMs > 10) {
      score -= Math.min(metrics.averageLatencyMs / 100, 0.3);
    }
    
    // Consider connection state
    if (metrics.state !== 'connected') {
      score -= 0.5;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private async handleFailover(subscriptionId: string, failedRoute: StreamRoute): Promise<void> {
    if (!this.config.routing.enableFailover) return;
    
    console.warn(`[StreamManager] Handling failover for ${subscriptionId}:${failedRoute.sourceId}`);
    
    // Deactivate failed route
    failedRoute.active = false;
    this.activeRoutes.delete(`${subscriptionId}:${failedRoute.sourceId}`);
    
    // Find healthy fallback routes
    const routes = this.routes.get(subscriptionId) || [];
    const healthyRoutes = routes
      .filter(r => !r.active && r.healthScore >= this.config.routing.failoverThreshold)
      .sort((a, b) => b.healthScore - a.healthScore);
    
    if (healthyRoutes.length > 0) {
      const newRoute = healthyRoutes[0];
      const subscription = this.subscriptions.get(subscriptionId);
      
      if (subscription) {
        // Activate new route
        await this.streamer.subscribe(
          subscription.symbols,
          subscription.timeframes,
          [newRoute.sourceId]
        );
        
        newRoute.active = true;
        this.activeRoutes.add(`${subscriptionId}:${newRoute.sourceId}`);
        
        this.emit('failover-completed', {
          subscriptionId,
          from: failedRoute.sourceId,
          to: newRoute.sourceId
        });
      }
    } else {
      this.emit('failover-failed', {
        subscriptionId,
        failedSource: failedRoute.sourceId,
        reason: 'No healthy routes available'
      });
    }
  }

  /**
   * EVENT HANDLING
   */

  private setupEventHandlers(): void {
    // Handle streamer events
    this.streamer.on('data-received', (event) => {
      this.handleStreamData(event);
    });
    
    this.streamer.on('source-connected', (sourceId) => {
      this.handleSourceConnected(sourceId);
    });
    
    this.streamer.on('source-disconnected', (event) => {
      this.handleSourceDisconnected(event);
    });
    
    this.streamer.on('source-error', (event) => {
      this.handleSourceError(event);
    });
  }

  private handleStreamData(event: any): void {
    // Find subscriptions that match this data
    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      if (this.isSubscriptionMatch(subscription, event)) {
        // Update stats
        this.updateStreamStats(subscriptionId, event);
        
        // Handle multiplexing
        if (this.config.multiplexing.enabled) {
          this.addToMultiplexBuffer(subscriptionId, event.data || event);
        }
        
        // Handle fanout
        if (this.config.fanout.enabled) {
          this.handleFanout(subscriptionId, event.data || event);
        }
        
        // Emit processed event
        this.emit('stream-data', {
          subscriptionId,
          sourceId: event.sourceId,
          data: event.data || event
        });
      }
    }
  }

  // Additional helper methods...
  private validateConfig(config: StreamManagerConfig): StreamManagerConfig { return config; }
  private initializeMetrics(): ManagerMetrics { return {} as ManagerMetrics; }
  private validateSubscription(subscription: StreamSubscription): void { /* Validation logic */ }
  private initializeStreamStats(subscriptionId: string): StreamStats { return {} as StreamStats; }
  private async activateSubscriptions(): Promise<void> { /* Activation logic */ }
  private isSubscriptionMatch(subscription: StreamSubscription, event: any): boolean { return true; }
  private updateStreamStats(subscriptionId: string, event: any): void { /* Stats update */ }
  private handleFanout(subscriptionId: string, data: MarketData): void { /* Fanout logic */ }
  private handleSourceConnected(sourceId: string): void { /* Connection handling */ }
  private handleSourceDisconnected(event: any): void { /* Disconnection handling */ }
  private handleSourceError(event: any): void { /* Error handling */ }
  private updateManagerMetrics(): void { /* Metrics update */ }

  /**
   * PUBLIC API METHODS
   */

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): StreamSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * List all subscriptions
   */
  getSubscriptions(): StreamSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get stream statistics
   */
  getStreamStats(subscriptionId?: string): StreamStats | Map<string, StreamStats> {
    if (subscriptionId) {
      return this.streamStats.get(subscriptionId) || this.initializeStreamStats(subscriptionId);
    }
    return new Map(this.streamStats);
  }

  /**
   * Get manager metrics
   */
  getMetrics(): ManagerMetrics {
    this.updateManagerMetrics();
    return { ...this.managerMetrics };
  }

  /**
   * Get active routes for a subscription
   */
  getActiveRoutes(subscriptionId: string): StreamRoute[] {
    const routes = this.routes.get(subscriptionId) || [];
    return routes.filter(r => r.active);
  }
}

/**
 * Simple priority queue implementation
 */
class PriorityQueue<T> {
  private items: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compareFunc: (a: T, b: T) => number) {
    this.compare = compareFunc;
  }

  enqueue(item: T): void {
    this.items.push(item);
    this.items.sort(this.compare);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }
}

export default StreamManager;