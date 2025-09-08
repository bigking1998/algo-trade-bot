/**
 * Order Management Integration Layer - Task BE-021
 * 
 * Integration layer that connects the new Order Management System
 * with the existing Strategy Execution Engine and Risk Controller,
 * providing seamless workflow integration and unified trading operations.
 * 
 * Features:
 * - Seamless integration with existing StrategyEngine and RiskController
 * - Unified order workflow from signal generation to trade reporting
 * - Real-time coordination between risk management and order execution
 * - Performance monitoring and optimization feedback loops
 * - Complete audit trail across all system components
 */

import { EventEmitter } from 'events';
import { OrderManager, type ManagedOrder, type OrderExecutionStrategy } from './OrderManager.js';
import { OrderRouter, type RoutingDecision } from './OrderRouter.js';
import { ExecutionEngine } from './ExecutionEngine.js';
import { OrderBook } from './OrderBook.js';
import { TradeReportingSystem } from './TradeReporting.js';
import type { StrategySignal } from '../strategies/types.js';
import type { TradeDecision } from '../engine/StrategyEngine.js';
import type { ProtectionDecision } from '../engine/ProtectionMechanisms.js';

/**
 * Integration Configuration
 */
export interface OrderManagementIntegrationConfig {
  // Component enablement
  enableAdvancedOrders: boolean;
  enableSmartRouting: boolean;
  enableOrderBookSimulation: boolean;
  enableTradeReporting: boolean;
  enableRealTimeRiskChecks: boolean;
  
  // Integration settings
  strategyEngineIntegration: boolean;
  riskControllerIntegration: boolean;
  performanceMonitoringIntegration: boolean;
  
  // Execution flow settings
  defaultExecutionStrategy: 'standard' | 'twap' | 'vwap' | 'iceberg';
  riskCheckFrequency: number;
  performanceReviewInterval: number;
  
  // Event routing
  enableEventForwarding: boolean;
  eventBufferSize: number;
  
  // Performance targets
  maxOrderProcessingLatency: number;
  maxSystemLatency: number;
  targetOrderAccuracy: number;
}

/**
 * Integrated Order Flow Status
 */
export interface IntegratedOrderFlow {
  id: string;
  timestamp: Date;
  
  // Source information
  strategyId: string;
  signal: StrategySignal;
  tradeDecision: TradeDecision;
  
  // Order management
  orderId?: string;
  routingDecision?: RoutingDecision;
  executionId?: string;
  
  // Status tracking
  stage: 'signal_generated' | 'risk_checked' | 'order_created' | 'order_routed' | 
         'order_submitted' | 'execution_started' | 'execution_completed' | 'trade_reported';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  
  // Performance metrics
  latencies: {
    riskCheck?: number;
    orderCreation?: number;
    routing?: number;
    execution?: number;
    reporting?: number;
    total?: number;
  };
  
  // Results
  executionResult?: any;
  tradeReport?: any;
  
  // Errors and issues
  errors: string[];
  warnings: string[];
}

/**
 * Integration Performance Metrics
 */
interface IntegrationMetrics {
  // Flow statistics
  totalFlows: number;
  completedFlows: number;
  failedFlows: number;
  averageFlowLatency: number;
  
  // Component performance
  componentLatencies: {
    riskController: number;
    orderManager: number;
    orderRouter: number;
    executionEngine: number;
    tradeReporting: number;
  };
  
  // System health
  systemHealthScore: number;
  componentHealthScores: {
    [component: string]: number;
  };
  
  // Error rates
  errorRates: {
    riskRejections: number;
    orderFailures: number;
    routingFailures: number;
    executionFailures: number;
    reportingFailures: number;
  };
}

/**
 * Main Integration Class
 */
export class OrderManagementIntegration extends EventEmitter {
  private config: OrderManagementIntegrationConfig;
  
  // Core components
  private orderManager: OrderManager;
  private orderRouter: OrderRouter;
  private executionEngine: ExecutionEngine;
  private orderBook: OrderBook;
  private tradeReporting: TradeReportingSystem;
  
  // External integrations (injected)
  private strategyEngine?: any;
  private riskController?: any;
  private performanceMonitor?: any;
  
  // Flow tracking
  private activeFlows: Map<string, IntegratedOrderFlow> = new Map();
  private completedFlows: Map<string, IntegratedOrderFlow> = new Map();
  
  // Metrics and monitoring
  private metrics: IntegrationMetrics;
  private metricsTimer?: NodeJS.Timeout;
  
  constructor(config: Partial<OrderManagementIntegrationConfig>) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.metrics = this.initializeMetrics();
    
    // Initialize core components
    this.orderManager = new OrderManager({
      maxLatencyMs: this.config.maxOrderProcessingLatency,
      enableRiskChecks: this.config.enableRealTimeRiskChecks,
      enableAdvancedOrderTypes: this.config.enableAdvancedOrders
    });
    
    this.orderRouter = new OrderRouter({
      enableSmartRouting: this.config.enableSmartRouting
    });
    
    this.executionEngine = new ExecutionEngine({
      maxExecutionLatency: this.config.maxOrderProcessingLatency
    });
    
    // Initialize order book for simulation if enabled
    if (this.config.enableOrderBookSimulation) {
      this.orderBook = new OrderBook('DEFAULT', {
        enableMatching: true,
        enableImpactAnalysis: true
      });
    }
    
    // Initialize trade reporting if enabled
    if (this.config.enableTradeReporting) {
      this.tradeReporting = new TradeReportingSystem({
        enableRealTimeReporting: true,
        enableComplianceMonitoring: true
      });
    }
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the integrated system
   */
  async initialize(): Promise<void> {
    try {
      // Initialize core components
      await Promise.all([
        this.orderManager.initialize(),
        this.orderRouter.initialize(),
        this.executionEngine.initialize(),
        this.orderBook?.initialize(),
        this.tradeReporting?.initialize()
      ].filter(Boolean));
      
      // Start metrics collection
      this.startMetricsCollection();
      
      this.emit('integration_initialized', {
        componentsInitialized: this.getInitializedComponents(),
        config: this.config
      });
      
    } catch (error) {
      this.emit('integration_initialization_error', error);
      throw error;
    }
  }

  /**
   * Inject external system dependencies
   */
  setExternalSystems(systems: {
    strategyEngine?: any;
    riskController?: any;
    performanceMonitor?: any;
  }): void {
    this.strategyEngine = systems.strategyEngine;
    this.riskController = systems.riskController;
    this.performanceMonitor = systems.performanceMonitor;
    
    // Set up cross-system event forwarding if enabled
    if (this.config.enableEventForwarding) {
      this.setupEventForwarding();
    }
  }

  /**
   * Process a trading signal through the complete order management workflow
   */
  async processTradeSignal(
    signal: StrategySignal,
    tradeDecision: TradeDecision,
    options: {
      executionStrategy?: OrderExecutionStrategy;
      riskOverride?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    } = {}
  ): Promise<{ success: boolean; flowId?: string; error?: string; }> {
    const startTime = performance.now();
    
    try {
      // Create integrated flow
      const flow = this.createIntegratedFlow(signal, tradeDecision);
      this.activeFlows.set(flow.id, flow);
      
      this.emit('flow_started', {
        flowId: flow.id,
        strategyId: flow.strategyId,
        signal: signal.action,
        symbol: signal.symbol
      });
      
      // Step 1: Risk Assessment (if enabled and not overridden)
      if (this.config.enableRealTimeRiskChecks && !options.riskOverride && this.riskController) {
        const riskStartTime = performance.now();
        
        const riskAssessment = await this.performRiskAssessment(signal, tradeDecision);
        
        flow.latencies.riskCheck = performance.now() - riskStartTime;
        flow.stage = 'risk_checked';
        
        if (!riskAssessment.approved) {
          flow.status = 'failed';
          flow.errors.push(`Risk check failed: ${riskAssessment.reason}`);
          
          this.moveFlowToCompleted(flow);
          
          return {
            success: false,
            flowId: flow.id,
            error: `Risk assessment failed: ${riskAssessment.reason}`
          };
        }
      }
      
      // Step 2: Create Order
      const orderStartTime = performance.now();
      
      const executionStrategy = options.executionStrategy || this.getDefaultExecutionStrategy(signal);
      
      const orderResult = await this.orderManager.createOrder(signal, executionStrategy, {
        priority: options.priority || 'normal',
        riskOverride: options.riskOverride
      });
      
      flow.latencies.orderCreation = performance.now() - orderStartTime;
      flow.stage = 'order_created';
      
      if (!orderResult.success) {
        flow.status = 'failed';
        flow.errors.push(orderResult.error || 'Order creation failed');
        
        this.moveFlowToCompleted(flow);
        
        return {
          success: false,
          flowId: flow.id,
          error: orderResult.error
        };
      }
      
      flow.orderId = orderResult.orderId!;
      const order = this.orderManager.getOrder(flow.orderId!)!;
      
      // Step 3: Order Routing (if enabled)
      if (this.config.enableSmartRouting) {
        const routingStartTime = performance.now();
        
        const routingDecision = await this.orderRouter.routeOrder(order);
        
        flow.latencies.routing = performance.now() - routingStartTime;
        flow.routingDecision = routingDecision;
        flow.stage = 'order_routed';
      }
      
      // Step 4: Submit Order for Execution
      const submissionResult = await this.orderManager.submitOrder(flow.orderId!);
      
      if (!submissionResult.success) {
        flow.status = 'failed';
        flow.errors.push(submissionResult.error || 'Order submission failed');
        
        this.moveFlowToCompleted(flow);
        
        return {
          success: false,
          flowId: flow.id,
          error: submissionResult.error
        };
      }
      
      flow.stage = 'order_submitted';
      
      // Step 5: Execute Order
      const executionStartTime = performance.now();
      
      let executionResult;
      if (this.config.enableAdvancedOrders && this.executionEngine) {
        // Use advanced execution engine
        const venue = flow.routingDecision?.primaryVenue || this.getDefaultVenue();
        const marketCondition = await this.getMarketCondition(signal.symbol);
        
        executionResult = await this.executionEngine.executeOrder(order, venue, marketCondition);
        
        if (executionResult.success) {
          flow.executionId = executionResult.executionId;
        }
      } else {
        // Use standard execution
        executionResult = { success: true }; // Mock for now
      }
      
      flow.latencies.execution = performance.now() - executionStartTime;
      flow.executionResult = executionResult;
      
      if (executionResult.success) {
        flow.stage = 'execution_completed';
        flow.status = 'completed';
      } else {
        flow.status = 'failed';
        flow.errors.push(executionResult.error || 'Execution failed');
      }
      
      // Step 6: Trade Reporting (if enabled and execution successful)
      if (this.config.enableTradeReporting && executionResult.success && this.tradeReporting) {
        const reportingStartTime = performance.now();
        
        // Mock trade execution for reporting
        const tradeExecution = this.createMockTradeExecution(order, signal);
        
        const reportResult = await this.tradeReporting.reportTrade(tradeExecution, order);
        
        flow.latencies.reporting = performance.now() - reportingStartTime;
        
        if (reportResult.success) {
          flow.stage = 'trade_reported';
          flow.tradeReport = { reportId: reportResult.reportId };
        } else {
          flow.warnings.push(`Trade reporting failed: ${reportResult.error}`);
        }
      }
      
      // Calculate total latency
      flow.latencies.total = performance.now() - startTime;
      
      // Move to completed flows
      this.moveFlowToCompleted(flow);
      
      // Update metrics
      this.updateMetrics(flow);
      
      // Emit completion event
      this.emit('flow_completed', {
        flowId: flow.id,
        status: flow.status,
        totalLatency: flow.latencies.total,
        stage: flow.stage
      });
      
      return {
        success: flow.status === 'completed',
        flowId: flow.id,
        error: flow.errors.length > 0 ? flow.errors[0] : undefined
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get active order flows
   */
  getActiveFlows(): IntegratedOrderFlow[] {
    return Array.from(this.activeFlows.values());
  }

  /**
   * Get completed order flows
   */
  getCompletedFlows(limit: number = 100): IntegratedOrderFlow[] {
    return Array.from(this.completedFlows.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get integration performance metrics
   */
  getIntegrationMetrics(): IntegrationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get order manager instance
   */
  getOrderManager(): OrderManager {
    return this.orderManager;
  }

  /**
   * Get order router instance
   */
  getOrderRouter(): OrderRouter {
    return this.orderRouter;
  }

  /**
   * Get execution engine instance
   */
  getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Get trade reporting system instance
   */
  getTradeReporting(): TradeReportingSystem | undefined {
    return this.tradeReporting;
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    // Stop metrics collection
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    // Cleanup components
    await Promise.all([
      this.orderManager.cleanup(),
      this.orderRouter.cleanup(),
      this.executionEngine.cleanup(),
      this.orderBook?.cleanup(),
      this.tradeReporting?.cleanup()
    ].filter(Boolean));
    
    this.emit('integration_cleanup_completed', {
      activeFlows: this.activeFlows.size,
      completedFlows: this.completedFlows.size,
      totalLatency: this.metrics.averageFlowLatency
    });
  }

  // === PRIVATE METHODS ===

  private createIntegratedFlow(signal: StrategySignal, tradeDecision: TradeDecision): IntegratedOrderFlow {
    return {
      id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      strategyId: signal.strategyId || 'unknown',
      signal,
      tradeDecision,
      stage: 'signal_generated',
      status: 'pending',
      latencies: {},
      errors: [],
      warnings: []
    };
  }

  private async performRiskAssessment(signal: StrategySignal, tradeDecision: TradeDecision): Promise<{
    approved: boolean;
    reason?: string;
  }> {
    if (this.riskController && typeof this.riskController.assessTrade === 'function') {
      return await this.riskController.assessTrade(signal, tradeDecision);
    }
    
    // Mock risk assessment if no risk controller available
    return { approved: true };
  }

  private getDefaultExecutionStrategy(signal: StrategySignal): OrderExecutionStrategy {
    switch (this.config.defaultExecutionStrategy) {
      case 'twap':
        return {
          type: 'twap',
          twap: {
            duration: 300000, // 5 minutes
            sliceCount: 10,
            randomizeStart: false
          }
        };
      case 'vwap':
        return {
          type: 'vwap',
          vwap: {
            lookbackPeriod: 60,
            participationRate: 0.1,
            startTime: new Date(),
            endTime: new Date(Date.now() + 600000) // 10 minutes
          }
        };
      case 'iceberg':
        return {
          type: 'iceberg',
          iceberg: {
            visibleSize: signal.quantity ? signal.quantity * 0.1 : 100,
            totalSize: signal.quantity || 1000,
            randomizeRefills: true
          }
        };
      default:
        return {
          type: signal.type === 'market' ? 'market' : 'limit'
        };
    }
  }

  private getDefaultVenue(): any {
    return {
      id: 'dydx',
      name: 'dYdX',
      type: 'exchange' as const,
      status: 'active' as const,
      averageSpread: 0.001,
      averageSize: 10000,
      volumeShare: 0.3,
      fillRate: 0.95,
      averageLatency: 100,
      rejectionRate: 0.02,
      partialFillRate: 0.1,
      takerFee: 0.001,
      makerFee: 0.0005,
      fixedFee: 0,
      minOrderSize: 1,
      maxOrderSize: 1000000,
      supportedOrderTypes: ['market', 'limit', 'stop', 'stop_limit'] as any[],
      supportsPostOnly: true,
      supportsIcebergOrders: false,
      supportsStopOrders: true,
      apiEndpoint: 'https://api.dydx.exchange',
      connectivityScore: 95,
      regulatoryTier: 'tier1' as const,
      jurisdictions: ['US']
    };
  }

  private async getMarketCondition(symbol: string): Promise<any> {
    // Mock market condition - would integrate with market data feeds
    return {
      symbol,
      timestamp: new Date(),
      volatility: 0.02,
      volatilityTrend: 'stable' as const,
      totalVolume: 1000000,
      averageSpread: 0.001,
      orderBookDepth: 500000,
      priceDirection: 'sideways' as const,
      momentum: 0,
      marketHours: true,
      sessionType: 'regular' as const,
      buyPressure: 50,
      sellPressure: 50,
      newsImpact: 'low' as const,
      economicEvents: [],
      technicalLevels: {
        support: [],
        resistance: []
      }
    };
  }

  private createMockTradeExecution(order: ManagedOrder, signal: StrategySignal): any {
    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: signal.symbol,
      timestamp: new Date(),
      buyOrderId: order.side === 'buy' ? order.id : 'market',
      sellOrderId: order.side === 'sell' ? order.id : 'market',
      price: signal.price || 100,
      quantity: signal.quantity || 1000,
      side: order.side,
      priceBeforeTrade: signal.price || 100,
      priceAfterTrade: signal.price || 100,
      spreadBeforeTrade: 0.001,
      spreadAfterTrade: 0.001,
      executionType: 'market_crossing' as const,
      liquidityFlag: 'removed' as const,
      takerFee: (signal.quantity || 1000) * (signal.price || 100) * 0.001
    };
  }

  private moveFlowToCompleted(flow: IntegratedOrderFlow): void {
    this.activeFlows.delete(flow.id);
    this.completedFlows.set(flow.id, flow);
    
    // Limit completed flows to prevent memory issues
    if (this.completedFlows.size > 10000) {
      const oldestFlows = Array.from(this.completedFlows.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())
        .slice(0, this.completedFlows.size - 5000);
      
      for (const [id] of oldestFlows) {
        this.completedFlows.delete(id);
      }
    }
  }

  private updateMetrics(flow: IntegratedOrderFlow): void {
    this.metrics.totalFlows++;
    
    if (flow.status === 'completed') {
      this.metrics.completedFlows++;
    } else {
      this.metrics.failedFlows++;
    }
    
    if (flow.latencies.total) {
      // Update average flow latency
      const totalLatency = (this.metrics.averageFlowLatency * (this.metrics.totalFlows - 1)) + flow.latencies.total;
      this.metrics.averageFlowLatency = totalLatency / this.metrics.totalFlows;
      
      // Update component latencies
      if (flow.latencies.riskCheck) {
        this.updateComponentLatency('riskController', flow.latencies.riskCheck);
      }
      if (flow.latencies.orderCreation) {
        this.updateComponentLatency('orderManager', flow.latencies.orderCreation);
      }
      if (flow.latencies.routing) {
        this.updateComponentLatency('orderRouter', flow.latencies.routing);
      }
      if (flow.latencies.execution) {
        this.updateComponentLatency('executionEngine', flow.latencies.execution);
      }
      if (flow.latencies.reporting) {
        this.updateComponentLatency('tradeReporting', flow.latencies.reporting);
      }
    }
    
    // Update error rates
    if (flow.errors.length > 0) {
      // Categorize errors and update rates
      this.categorizeAndUpdateErrors(flow.errors);
    }
  }

  private updateComponentLatency(component: keyof IntegrationMetrics['componentLatencies'], latency: number): void {
    const currentLatency = this.metrics.componentLatencies[component];
    // Simple exponential moving average
    this.metrics.componentLatencies[component] = (currentLatency * 0.9) + (latency * 0.1);
  }

  private categorizeAndUpdateErrors(errors: string[]): void {
    for (const error of errors) {
      if (error.includes('risk') || error.includes('Risk')) {
        this.metrics.errorRates.riskRejections++;
      } else if (error.includes('order') || error.includes('Order')) {
        this.metrics.errorRates.orderFailures++;
      } else if (error.includes('routing') || error.includes('Routing')) {
        this.metrics.errorRates.routingFailures++;
      } else if (error.includes('execution') || error.includes('Execution')) {
        this.metrics.errorRates.executionFailures++;
      } else if (error.includes('reporting') || error.includes('Reporting')) {
        this.metrics.errorRates.reportingFailures++;
      }
    }
  }

  private setupEventHandlers(): void {
    // Set up event forwarding between components
    this.orderManager.on('order_created', (event) => {
      this.emit('integrated_order_created', event);
    });
    
    this.orderManager.on('order_filled', (event) => {
      this.emit('integrated_order_filled', event);
    });
    
    this.orderRouter.on('order_routed', (event) => {
      this.emit('integrated_order_routed', event);
    });
    
    this.executionEngine.on('execution_completed', (event) => {
      this.emit('integrated_execution_completed', event);
    });
    
    if (this.tradeReporting) {
      this.tradeReporting.on('trade_reported', (event) => {
        this.emit('integrated_trade_reported', event);
      });
    }
  }

  private setupEventForwarding(): void {
    // Forward events to external systems if available
    if (this.strategyEngine) {
      this.on('integrated_order_filled', (event) => {
        this.strategyEngine.emit('order_filled', event);
      });
    }
    
    if (this.performanceMonitor) {
      this.on('flow_completed', (event) => {
        this.performanceMonitor.recordFlowMetrics(event);
      });
    }
  }

  private getInitializedComponents(): string[] {
    const components = ['orderManager', 'orderRouter', 'executionEngine'];
    
    if (this.orderBook) components.push('orderBook');
    if (this.tradeReporting) components.push('tradeReporting');
    
    return components;
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.calculateSystemHealth();
      this.emit('integration_metrics_updated', this.metrics);
    }, this.config.performanceReviewInterval);
  }

  private calculateSystemHealth(): void {
    // Calculate overall system health score
    const componentScores = Object.values(this.metrics.componentHealthScores);
    this.metrics.systemHealthScore = componentScores.length > 0 ? 
      componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length : 100;
    
    // Update component health scores based on latencies and error rates
    for (const [component, latency] of Object.entries(this.metrics.componentLatencies)) {
      const maxLatency = this.config.maxOrderProcessingLatency;
      const healthScore = Math.max(0, 100 - (latency / maxLatency) * 100);
      this.metrics.componentHealthScores[component] = healthScore;
    }
  }

  private initializeMetrics(): IntegrationMetrics {
    return {
      totalFlows: 0,
      completedFlows: 0,
      failedFlows: 0,
      averageFlowLatency: 0,
      componentLatencies: {
        riskController: 0,
        orderManager: 0,
        orderRouter: 0,
        executionEngine: 0,
        tradeReporting: 0
      },
      systemHealthScore: 100,
      componentHealthScores: {},
      errorRates: {
        riskRejections: 0,
        orderFailures: 0,
        routingFailures: 0,
        executionFailures: 0,
        reportingFailures: 0
      }
    };
  }

  private mergeWithDefaults(config: Partial<OrderManagementIntegrationConfig>): OrderManagementIntegrationConfig {
    return {
      enableAdvancedOrders: true,
      enableSmartRouting: true,
      enableOrderBookSimulation: false,
      enableTradeReporting: true,
      enableRealTimeRiskChecks: true,
      strategyEngineIntegration: true,
      riskControllerIntegration: true,
      performanceMonitoringIntegration: true,
      defaultExecutionStrategy: 'standard',
      riskCheckFrequency: 1000,
      performanceReviewInterval: 30000,
      enableEventForwarding: true,
      eventBufferSize: 1000,
      maxOrderProcessingLatency: 10,
      maxSystemLatency: 50,
      targetOrderAccuracy: 99.99,
      ...config
    };
  }
}

export default OrderManagementIntegration;