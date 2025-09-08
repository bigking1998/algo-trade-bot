/**
 * Execution Orchestrator - Task BE-020 (Enhanced)
 * 
 * Sophisticated orchestration system that coordinates multi-strategy execution,
 * manages resource allocation, resolves signal conflicts, and ensures optimal
 * execution paths. Acts as the intelligent coordinator between strategy signals
 * and actual order execution.
 * 
 * Features:
 * - Multi-strategy signal coordination and conflict resolution
 * - Resource allocation and execution path optimization
 * - Risk validation and protection mechanism integration
 * - Execution plan generation with smart routing
 * - Performance-based execution prioritization
 * - Dynamic resource management and throttling
 */

import { EventEmitter } from 'events';
import type {
  StrategySignal,
  Position,
  MarketDataWindow
} from '../strategies/types.js';
import type { TradeDecision } from '../engine/StrategyEngine.js';
import type { RiskController } from '../engine/RiskController.js';
import type { ProtectionMechanisms, ProtectionDecision } from '../engine/ProtectionMechanisms.js';
import type { ExecutionMode, ExecutionPriority } from './StrategyExecutionEngine.js';

/**
 * Execution Plan
 */
export interface ExecutionPlan {
  id: string;
  tradeDecision: TradeDecision;
  executionStrategy: 'immediate' | 'twap' | 'vwap' | 'iceberg' | 'adaptive';
  executionPath: string[];
  resourceAllocation: {
    priority: number;
    maxLatency: number;
    reservedCapacity: number;
  };
  riskValidation: {
    passed: boolean;
    adjustments: any;
    conditions: string[];
  };
  protectionChecks: ProtectionDecision;
  orderSpecification: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
    price?: number;
    stopPrice?: number;
    timeInForce: 'IOC' | 'GTC' | 'FOK' | 'DAY';
    execution: {
      slices?: number;
      minSliceSize?: number;
      maxSliceSize?: number;
      sliceInterval?: number;
    };
  };
  metadata: {
    createdAt: Date;
    expectedDuration: number;
    confidence: number;
    complexity: number;
  };
}

/**
 * Orchestration Result
 */
export interface OrchestrationResult {
  approved: boolean;
  executionPlan?: ExecutionPlan;
  reasons: string[];
  alternativeActions: string[];
  resourceImpact: {
    estimatedLatency: number;
    requiredCapacity: number;
    memoryRequirement: number;
  };
  metadata: {
    processingTime: number;
    validationSteps: string[];
    timestamp: Date;
  };
}

/**
 * Resource Monitor
 */
class ResourceMonitor {
  private allocations: Map<string, {
    capacity: number;
    latency: number;
    allocatedAt: Date;
    expiresAt: Date;
  }> = new Map();
  
  private totalCapacity = 100;
  private availableCapacity = 100;
  
  reserveCapacity(id: string, required: number, duration: number): boolean {
    if (required > this.availableCapacity) {
      return false;
    }
    
    this.allocations.set(id, {
      capacity: required,
      latency: 0,
      allocatedAt: new Date(),
      expiresAt: new Date(Date.now() + duration)
    });
    
    this.availableCapacity -= required;
    return true;
  }
  
  releaseCapacity(id: string): void {
    const allocation = this.allocations.get(id);
    if (allocation) {
      this.availableCapacity += allocation.capacity;
      this.allocations.delete(id);
    }
  }
  
  getAvailableCapacity(): number {
    this.cleanupExpiredAllocations();
    return this.availableCapacity;
  }
  
  private cleanupExpiredAllocations(): void {
    const now = new Date();
    for (const [id, allocation] of this.allocations.entries()) {
      if (now > allocation.expiresAt) {
        this.releaseCapacity(id);
      }
    }
  }
}

/**
 * Signal Conflict Resolver
 */
class SignalConflictResolver {
  /**
   * Resolve conflicts between multiple signals for the same symbol
   */
  resolveConflicts(signals: StrategySignal[]): {
    primary: StrategySignal | null;
    conflicts: Array<{
      signal: StrategySignal;
      reason: string;
    }>;
    resolution: 'merge' | 'priority' | 'cancel' | 'defer';
  } {
    if (signals.length === 0) {
      return { primary: null, conflicts: [], resolution: 'cancel' };
    }
    
    if (signals.length === 1) {
      return { primary: signals[0], conflicts: [], resolution: 'priority' };
    }
    
    // Group signals by symbol
    const symbolGroups = new Map<string, StrategySignal[]>();
    for (const signal of signals) {
      const existing = symbolGroups.get(signal.symbol) || [];
      existing.push(signal);
      symbolGroups.set(signal.symbol, existing);
    }
    
    // Resolve each symbol group
    const conflicts: Array<{ signal: StrategySignal; reason: string; }> = [];
    let primarySignal: StrategySignal | null = null;
    let resolutionType: 'merge' | 'priority' | 'cancel' | 'defer' = 'priority';
    
    for (const [symbol, symbolSignals] of symbolGroups.entries()) {
      if (symbolSignals.length === 1) {
        if (!primarySignal || symbolSignals[0].confidence > primarySignal.confidence) {
          primarySignal = symbolSignals[0];
        }
        continue;
      }
      
      // Check for opposing signals
      const buySignals = symbolSignals.filter(s => s.type === 'BUY' || s.type === 'LONG');
      const sellSignals = symbolSignals.filter(s => s.type === 'SELL' || s.type === 'SHORT');
      
      if (buySignals.length > 0 && sellSignals.length > 0) {
        // Opposing signals - resolve by confidence and priority
        const allSignals = [...buySignals, ...sellSignals];
        allSignals.sort((a, b) => {
          if (a.priority !== b.priority) {
            return this.priorityToNumber(a.priority) - this.priorityToNumber(b.priority);
          }
          return b.confidence - a.confidence;
        });
        
        primarySignal = allSignals[0];
        conflicts.push(...allSignals.slice(1).map(signal => ({
          signal,
          reason: 'Opposing signal with lower priority/confidence'
        })));
        
        resolutionType = 'priority';
      } else {
        // Same direction signals - can potentially merge
        const sameDirectionSignals = buySignals.length > 0 ? buySignals : sellSignals;
        
        if (this.canMergeSignals(sameDirectionSignals)) {
          primarySignal = this.mergeSignals(sameDirectionSignals);
          resolutionType = 'merge';
        } else {
          // Use highest confidence signal
          sameDirectionSignals.sort((a, b) => b.confidence - a.confidence);
          primarySignal = sameDirectionSignals[0];
          conflicts.push(...sameDirectionSignals.slice(1).map(signal => ({
            signal,
            reason: 'Lower confidence signal in same direction'
          })));
          resolutionType = 'priority';
        }
      }
    }
    
    return {
      primary: primarySignal,
      conflicts,
      resolution: resolutionType
    };
  }
  
  private canMergeSignals(signals: StrategySignal[]): boolean {
    if (signals.length < 2) return false;
    
    // Signals can be merged if they have similar characteristics
    const firstSignal = signals[0];
    return signals.every(signal => 
      signal.type === firstSignal.type &&
      signal.symbol === firstSignal.symbol &&
      Math.abs(signal.confidence - firstSignal.confidence) <= 20
    );
  }
  
  private mergeSignals(signals: StrategySignal[]): StrategySignal {
    const firstSignal = signals[0];
    
    // Calculate weighted averages
    const totalWeight = signals.reduce((sum, s) => sum + s.confidence, 0);
    const weightedQuantity = signals.reduce((sum, s) => 
      sum + (s.quantity || 0) * s.confidence, 0) / totalWeight;
    const averageConfidence = totalWeight / signals.length;
    
    return {
      ...firstSignal,
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quantity: weightedQuantity,
      confidence: Math.min(100, averageConfidence),
      conditions: [
        ...(firstSignal.conditions || []),
        `Merged from ${signals.length} signals`
      ],
      metadata: {
        ...firstSignal.metadata,
        mergedFrom: signals.map(s => s.id),
        mergedAt: new Date()
      }
    };
  }
  
  private priorityToNumber(priority: string): number {
    const map: { [key: string]: number } = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    return map[priority] || 3;
  }
}

/**
 * Execution Strategy Selector
 */
class ExecutionStrategySelector {
  selectStrategy(
    tradeDecision: TradeDecision,
    marketConditions: any,
    resourceConstraints: any
  ): 'immediate' | 'twap' | 'vwap' | 'iceberg' | 'adaptive' {
    const quantity = Math.abs(tradeDecision.quantity);
    const confidence = tradeDecision.confidence;
    const priority = tradeDecision.priority;
    
    // High priority or urgent trades
    if (priority >= 3 || tradeDecision.expiresAt.getTime() - Date.now() < 60000) {
      return 'immediate';
    }
    
    // Large orders that could impact market
    if (quantity > 10000) { // Configurable threshold
      if (marketConditions?.liquidity === 'low') {
        return 'twap'; // Time-weighted average price
      } else {
        return 'vwap'; // Volume-weighted average price
      }
    }
    
    // Stealth execution for medium-large orders
    if (quantity > 1000 && marketConditions?.volatility !== 'high') {
      return 'iceberg';
    }
    
    // Adaptive strategy for uncertain conditions
    if (confidence < 70 || marketConditions?.volatility === 'high') {
      return 'adaptive';
    }
    
    // Default to immediate for small, confident trades
    return 'immediate';
  }
  
  calculateSlicing(
    strategy: string,
    quantity: number,
    marketConditions: any
  ): {
    slices: number;
    minSliceSize: number;
    maxSliceSize: number;
    sliceInterval: number;
  } {
    switch (strategy) {
      case 'twap':
        return {
          slices: Math.min(10, Math.max(2, Math.floor(quantity / 500))),
          minSliceSize: Math.floor(quantity * 0.05),
          maxSliceSize: Math.floor(quantity * 0.2),
          sliceInterval: 30000 // 30 seconds
        };
        
      case 'vwap':
        return {
          slices: Math.min(20, Math.max(3, Math.floor(quantity / 200))),
          minSliceSize: Math.floor(quantity * 0.02),
          maxSliceSize: Math.floor(quantity * 0.15),
          sliceInterval: 15000 // 15 seconds
        };
        
      case 'iceberg':
        return {
          slices: Math.min(50, Math.max(5, Math.floor(quantity / 100))),
          minSliceSize: Math.floor(quantity * 0.01),
          maxSliceSize: Math.floor(quantity * 0.05),
          sliceInterval: 5000 // 5 seconds
        };
        
      case 'adaptive':
        return {
          slices: Math.min(15, Math.max(2, Math.floor(quantity / 300))),
          minSliceSize: Math.floor(quantity * 0.03),
          maxSliceSize: Math.floor(quantity * 0.25),
          sliceInterval: 20000 // 20 seconds
        };
        
      default: // immediate
        return {
          slices: 1,
          minSliceSize: quantity,
          maxSliceSize: quantity,
          sliceInterval: 0
        };
    }
  }
}

/**
 * Main Execution Orchestrator
 */
export class ExecutionOrchestrator extends EventEmitter {
  private riskController: RiskController;
  private protectionMechanisms: ProtectionMechanisms;
  private resourceMonitor: ResourceMonitor;
  private conflictResolver: SignalConflictResolver;
  private strategySelector: ExecutionStrategySelector;
  
  // Configuration
  private config: {
    maxLatency: number;
    maxConcurrentExecutions: number;
    defaultMode: ExecutionMode;
  };
  
  // State tracking
  private activeOrchestrations: Map<string, {
    startTime: Date;
    tradeDecision: TradeDecision;
    status: 'validating' | 'planning' | 'completed' | 'failed';
  }> = new Map();

  constructor(
    config: any,
    dependencies: {
      riskController: RiskController;
      protectionMechanisms: ProtectionMechanisms;
    }
  ) {
    super();
    
    this.config = {
      maxLatency: config.maxLatency || 50,
      maxConcurrentExecutions: config.maxConcurrentExecutions || 10,
      defaultMode: config.defaultMode || 'paper'
    };
    
    this.riskController = dependencies.riskController;
    this.protectionMechanisms = dependencies.protectionMechanisms;
    this.resourceMonitor = new ResourceMonitor();
    this.conflictResolver = new SignalConflictResolver();
    this.strategySelector = new ExecutionStrategySelector();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    this.emit('initialized', {
      maxLatency: this.config.maxLatency,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions
    });
  }

  /**
   * Orchestrate execution for a trade decision
   */
  async orchestrateExecution(
    tradeDecision: TradeDecision,
    options: {
      mode?: ExecutionMode;
      maxLatency?: number;
      priority?: ExecutionPriority;
    } = {}
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const orchestrationId = `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Track orchestration
    this.activeOrchestrations.set(orchestrationId, {
      startTime: new Date(),
      tradeDecision,
      status: 'validating'
    });
    
    try {
      const validationSteps: string[] = [];
      
      // Step 1: Resource availability check
      validationSteps.push('resource_check');
      const requiredCapacity = this.estimateResourceRequirement(tradeDecision);
      const availableCapacity = this.resourceMonitor.getAvailableCapacity();
      
      if (requiredCapacity > availableCapacity) {
        return this.createRejectionResult(
          ['Insufficient execution capacity'],
          ['Retry later', 'Reduce position size'],
          startTime,
          validationSteps
        );
      }
      
      // Step 2: Risk validation
      validationSteps.push('risk_validation');
      const riskValidation = await this.validateRisk(tradeDecision);
      
      if (!riskValidation.passed) {
        return this.createRejectionResult(
          ['Risk validation failed', ...riskValidation.conditions],
          ['Reduce position size', 'Improve signal confidence'],
          startTime,
          validationSteps
        );
      }
      
      // Step 3: Protection mechanisms check
      validationSteps.push('protection_check');
      const protectionResult = await this.checkProtectionMechanisms(tradeDecision);
      
      if (!protectionResult.allowed) {
        return this.createRejectionResult(
          ['Protection mechanisms blocked execution', ...protectionResult.reasons],
          ['Wait for protection recovery', 'Adjust strategy parameters'],
          startTime,
          validationSteps
        );
      }
      
      // Step 4: Signal conflict resolution
      validationSteps.push('conflict_resolution');
      const conflictResolution = this.resolveSignalConflicts(tradeDecision.signals);
      
      if (!conflictResolution.primary) {
        return this.createRejectionResult(
          ['No viable signal after conflict resolution'],
          ['Review signal generation logic'],
          startTime,
          validationSteps
        );
      }
      
      // Step 5: Execution strategy selection
      validationSteps.push('strategy_selection');
      const executionStrategy = this.selectExecutionStrategy(
        tradeDecision,
        await this.getMarketConditions(tradeDecision.symbol)
      );
      
      // Step 6: Generate execution plan
      validationSteps.push('plan_generation');
      const executionPlan = this.generateExecutionPlan(
        tradeDecision,
        executionStrategy,
        riskValidation,
        protectionResult,
        options
      );
      
      // Reserve resources
      const resourceReserved = this.resourceMonitor.reserveCapacity(
        orchestrationId,
        requiredCapacity,
        executionPlan.metadata.expectedDuration
      );
      
      if (!resourceReserved) {
        return this.createRejectionResult(
          ['Failed to reserve execution resources'],
          ['Retry with lower priority'],
          startTime,
          validationSteps
        );
      }
      
      // Update orchestration status
      const orchestration = this.activeOrchestrations.get(orchestrationId);
      if (orchestration) {
        orchestration.status = 'completed';
      }
      
      this.emit('execution_prepared', {
        orchestrationId,
        executionPlan,
        processingTime: Date.now() - startTime
      });
      
      return {
        approved: true,
        executionPlan,
        reasons: ['Execution approved'],
        alternativeActions: [],
        resourceImpact: {
          estimatedLatency: executionPlan.resourceAllocation.maxLatency,
          requiredCapacity,
          memoryRequirement: this.estimateMemoryRequirement(executionPlan)
        },
        metadata: {
          processingTime: Date.now() - startTime,
          validationSteps,
          timestamp: new Date()
        }
      };
      
    } catch (error) {
      // Update orchestration status
      const orchestration = this.activeOrchestrations.get(orchestrationId);
      if (orchestration) {
        orchestration.status = 'failed';
      }
      
      this.emit('orchestration_error', {
        orchestrationId,
        error: error instanceof Error ? error.message : String(error),
        tradeDecision
      });
      
      return this.createRejectionResult(
        ['Orchestration error occurred'],
        ['Review system logs', 'Check system health'],
        startTime,
        ['error_handling']
      );
      
    } finally {
      // Cleanup orchestration tracking after some time
      setTimeout(() => {
        this.activeOrchestrations.delete(orchestrationId);
      }, 60000); // Keep for 1 minute
    }
  }

  /**
   * Get orchestration status
   */
  getOrchestrationStatus(): {
    activeOrchestrations: number;
    availableCapacity: number;
    totalProcessed: number;
  } {
    return {
      activeOrchestrations: this.activeOrchestrations.size,
      availableCapacity: this.resourceMonitor.getAvailableCapacity(),
      totalProcessed: 0 // Would track historical data
    };
  }

  // === PRIVATE METHODS ===

  private setupEventHandlers(): void {
    // Risk Controller events
    this.riskController.on('risk_threshold_exceeded', (event) => {
      this.emit('risk_alert', event);
    });

    // Protection Mechanisms events
    this.protectionMechanisms.on('trading_suspended', (event) => {
      this.emit('execution_suspended', event);
    });
  }

  private async validateRisk(tradeDecision: TradeDecision): Promise<{
    passed: boolean;
    adjustments: any;
    conditions: string[];
  }> {
    try {
      // This would integrate with the actual risk controller
      const riskMetrics = await this.riskController.getCurrentRiskMetrics();
      const positionRisk = await this.riskController.calculatePositionRisk({
        symbol: tradeDecision.symbol,
        quantity: tradeDecision.quantity,
        entryPrice: 0 // Would use current market price
      });
      
      const passed = positionRisk.riskScore <= 80; // 80% risk threshold
      
      return {
        passed,
        adjustments: passed ? {} : { 
          suggestedQuantity: tradeDecision.quantity * 0.5 
        },
        conditions: passed ? [] : [
          `Position risk too high: ${positionRisk.riskScore}%`
        ]
      };
      
    } catch (error) {
      return {
        passed: false,
        adjustments: {},
        conditions: ['Risk validation failed']
      };
    }
  }

  private async checkProtectionMechanisms(tradeDecision: TradeDecision): Promise<ProtectionDecision> {
    try {
      // Create a mock context for protection evaluation
      const context = {
        marketData: {} as MarketDataWindow,
        indicators: { lastCalculated: new Date() },
        portfolio: {} as any,
        riskMetrics: await this.riskController.getCurrentRiskMetrics(),
        recentSignals: [],
        recentTrades: [],
        timestamp: new Date(),
        executionId: `protection_${Date.now()}`,
        strategyId: tradeDecision.signals[0]?.strategyId || 'unknown',
        marketConditions: {
          trend: 'sideways' as const,
          volatility: 'medium' as const,
          liquidity: 'high' as const,
          session: 'american' as const
        }
      };
      
      // Convert TradeDecision to StrategySignal for protection evaluation
      const signal: StrategySignal = {
        id: `signal_${Date.now()}`,
        strategyId: tradeDecision.signals[0]?.strategyId || 'unknown',
        symbol: tradeDecision.symbol,
        type: tradeDecision.action === 'buy' ? 'BUY' : 'SELL',
        confidence: tradeDecision.confidence,
        strength: tradeDecision.confidence / 100,
        timestamp: new Date(),
        timeframe: '1m',
        quantity: Math.abs(tradeDecision.quantity),
        entryPrice: 0, // Would use current market price
        conditions: tradeDecision.reasoning,
        isValid: true,
        metadata: {}
      };
      
      return await this.protectionMechanisms.evaluateSignal(signal, context);
      
    } catch (error) {
      return {
        allowed: false,
        reasons: ['Protection mechanism check failed'],
        adjustments: {},
        protectionLevel: 'standard',
        timestamp: new Date()
      };
    }
  }

  private resolveSignalConflicts(signals: StrategySignal[]): {
    primary: StrategySignal | null;
    conflicts: Array<{ signal: StrategySignal; reason: string; }>;
    resolution: string;
  } {
    return this.conflictResolver.resolveConflicts(signals);
  }

  private selectExecutionStrategy(
    tradeDecision: TradeDecision,
    marketConditions: any
  ): 'immediate' | 'twap' | 'vwap' | 'iceberg' | 'adaptive' {
    return this.strategySelector.selectStrategy(
      tradeDecision,
      marketConditions,
      { availableCapacity: this.resourceMonitor.getAvailableCapacity() }
    );
  }

  private generateExecutionPlan(
    tradeDecision: TradeDecision,
    executionStrategy: string,
    riskValidation: any,
    protectionResult: ProtectionDecision,
    options: any
  ): ExecutionPlan {
    const slicing = this.strategySelector.calculateSlicing(
      executionStrategy,
      Math.abs(tradeDecision.quantity),
      {} // market conditions
    );
    
    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tradeDecision,
      executionStrategy: executionStrategy as any,
      executionPath: ['orchestrator', 'validator', 'executor'],
      resourceAllocation: {
        priority: tradeDecision.priority,
        maxLatency: options.maxLatency || this.config.maxLatency,
        reservedCapacity: this.estimateResourceRequirement(tradeDecision)
      },
      riskValidation,
      protectionChecks: protectionResult,
      orderSpecification: {
        symbol: tradeDecision.symbol,
        side: tradeDecision.action === 'buy' ? 'buy' : 'sell',
        quantity: Math.abs(tradeDecision.quantity),
        orderType: this.determineOrderType(tradeDecision, executionStrategy),
        timeInForce: this.determineTimeInForce(tradeDecision, executionStrategy),
        execution: slicing
      },
      metadata: {
        createdAt: new Date(),
        expectedDuration: this.estimateExecutionDuration(executionStrategy, slicing),
        confidence: tradeDecision.confidence,
        complexity: this.calculateComplexity(executionStrategy, slicing)
      }
    };
    
    return plan;
  }

  private async getMarketConditions(symbol: string): Promise<any> {
    // This would integrate with market data services
    return {
      volatility: 'medium',
      liquidity: 'high',
      spread: 0.001,
      volume: 1000000
    };
  }

  private estimateResourceRequirement(tradeDecision: TradeDecision): number {
    // Estimate based on quantity, complexity, and priority
    const baseRequirement = 10;
    const quantityFactor = Math.min(50, Math.abs(tradeDecision.quantity) / 100);
    const priorityFactor = tradeDecision.priority * 5;
    
    return Math.ceil(baseRequirement + quantityFactor + priorityFactor);
  }

  private estimateMemoryRequirement(plan: ExecutionPlan): number {
    // Estimate memory requirement in MB
    const baseMemory = 1;
    const complexityFactor = plan.metadata.complexity * 0.5;
    const slicesFactor = (plan.orderSpecification.execution.slices || 1) * 0.1;
    
    return Math.ceil(baseMemory + complexityFactor + slicesFactor);
  }

  private determineOrderType(
    tradeDecision: TradeDecision,
    strategy: string
  ): 'market' | 'limit' | 'stop' | 'stop_limit' {
    switch (strategy) {
      case 'immediate':
        return 'market';
      case 'twap':
      case 'vwap':
        return 'limit';
      case 'iceberg':
        return 'limit';
      case 'adaptive':
        return tradeDecision.priority >= 3 ? 'market' : 'limit';
      default:
        return 'market';
    }
  }

  private determineTimeInForce(
    tradeDecision: TradeDecision,
    strategy: string
  ): 'IOC' | 'GTC' | 'FOK' | 'DAY' {
    const timeToExpiry = tradeDecision.expiresAt.getTime() - Date.now();
    
    if (timeToExpiry < 60000) { // Less than 1 minute
      return 'IOC'; // Immediate or Cancel
    }
    
    if (strategy === 'immediate') {
      return 'FOK'; // Fill or Kill
    }
    
    if (timeToExpiry < 3600000) { // Less than 1 hour
      return 'IOC';
    }
    
    return 'GTC'; // Good Till Cancelled
  }

  private estimateExecutionDuration(strategy: string, slicing: any): number {
    switch (strategy) {
      case 'immediate':
        return 5000; // 5 seconds
      case 'twap':
        return slicing.slices * slicing.sliceInterval;
      case 'vwap':
        return slicing.slices * slicing.sliceInterval * 0.8;
      case 'iceberg':
        return slicing.slices * slicing.sliceInterval;
      case 'adaptive':
        return slicing.slices * slicing.sliceInterval * 1.2;
      default:
        return 10000; // 10 seconds
    }
  }

  private calculateComplexity(strategy: string, slicing: any): number {
    const strategyComplexity = {
      immediate: 1,
      twap: 3,
      vwap: 4,
      iceberg: 5,
      adaptive: 6
    };
    
    const sliceComplexity = Math.min(10, (slicing.slices || 1) / 5);
    
    return (strategyComplexity[strategy] || 1) + sliceComplexity;
  }

  private createRejectionResult(
    reasons: string[],
    alternatives: string[],
    startTime: number,
    validationSteps: string[]
  ): OrchestrationResult {
    return {
      approved: false,
      reasons,
      alternativeActions: alternatives,
      resourceImpact: {
        estimatedLatency: 0,
        requiredCapacity: 0,
        memoryRequirement: 0
      },
      metadata: {
        processingTime: Date.now() - startTime,
        validationSteps,
        timestamp: new Date()
      }
    };
  }
}

export default ExecutionOrchestrator;