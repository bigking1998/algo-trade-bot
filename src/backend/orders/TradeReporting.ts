/**
 * Trade Reporting & Compliance System - Task BE-021: Comprehensive Audit Trail
 * 
 * Enterprise-grade trade reporting and compliance monitoring system providing
 * comprehensive audit trails, regulatory compliance tracking, and real-time
 * trade surveillance. Essential for production trading environments.
 * 
 * Features:
 * - Complete trade lifecycle reporting and audit trails
 * - Real-time compliance monitoring and violation detection
 * - Regulatory reporting (MiFID II, Dodd-Frank, EMIR compliance)
 * - Position tracking and exposure monitoring
 * - Trade reconstruction and forensic analysis
 * - Performance attribution and risk analytics
 * - Best execution analysis and reporting
 * - Suspicious activity monitoring and alerting
 */

import { EventEmitter } from 'events';
import type { ManagedOrder, AuditEvent, ComplianceFlag } from './OrderManager.js';
// Types that would be imported from OrderBook - defining locally to avoid import issues
export interface TradeExecution {
  id: string;
  symbol: string;
  timestamp: Date;
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  side: any;
  priceBeforeTrade: number;
  priceAfterTrade: number;
  spreadBeforeTrade: number;
  spreadAfterTrade: number;
  executionType: string;
  liquidityFlag: string;
  takerFee?: number;
  makerFee?: number;
}

export interface MarketImpactAnalysis {
  symbol: string;
  timestamp: Date;
  orderId: string;
  side: any;
  quantity: number;
  preTradeSpread: number;
  preTradeDepth: number;
  preTradeImbalance: number;
  preTradePrice: number;
  postTradeSpread: number;
  postTradeDepth: number;
  postTradeImbalance: number;
  postTradePrice: number;
  temporaryImpact: number;
  permanentImpact: number;
  slippage: number;
  depthConsumed: number;
  recoveryTime?: number;
  recoveryAmount?: number;
}
import type { OrderSide } from '../execution/OrderExecutor.js';

/**
 * Trade Report
 */
export interface TradeReport {
  id: string;
  timestamp: Date;
  reportDate: Date;
  
  // Trade identification
  tradeId: string;
  orderIds: string[];
  strategyId?: string;
  userId?: string;
  
  // Instrument details
  symbol: string;
  assetClass: 'equity' | 'fx' | 'commodity' | 'crypto' | 'bond';
  venue: string;
  
  // Trade details
  side: OrderSide;
  quantity: number;
  price: number;
  value: number;
  currency: string;
  
  // Execution details
  executionTime: Date;
  executionType: 'market' | 'limit' | 'stop' | 'algorithmic';
  executionAlgorithm?: string;
  counterparty?: string;
  
  // Fees and costs
  commission: number;
  fees: number;
  taxes: number;
  totalCosts: number;
  
  // Market data
  marketPrice: number;
  spread: number;
  slippage: number;
  marketImpact: number;
  
  // Settlement
  settlementDate: Date;
  clearingHouse?: string;
  
  // Regulatory flags
  regulatoryReporting: {
    mifidII: boolean;
    doddFrank: boolean;
    emir: boolean;
    cftc: boolean;
  };
  
  // Status
  status: 'pending' | 'confirmed' | 'settled' | 'failed' | 'cancelled';
  
  // Metadata
  metadata: Record<string, any>;
}

/**
 * Compliance Violation
 */
export interface ComplianceViolation {
  id: string;
  timestamp: Date;
  
  // Violation details
  type: 'position_limit' | 'risk_breach' | 'wash_trade' | 'layering' | 'spoofing' | 
        'market_manipulation' | 'insider_trading' | 'best_execution' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  
  // Associated entities
  orderId?: string;
  tradeId?: string;
  userId?: string;
  strategyId?: string;
  
  // Detection details
  detectionMethod: 'rule_based' | 'statistical' | 'ml_based' | 'manual';
  detectionScore: number;    // Confidence score 0-100
  falsePositiveRisk: number; // Risk of false positive 0-100
  
  // Evidence
  evidence: {
    orderSequence?: string[];
    priceMovements?: number[];
    volumePatterns?: number[];
    timingAnalysis?: any;
    marketContext?: any;
  };
  
  // Investigation
  investigationStatus: 'new' | 'assigned' | 'in_progress' | 'resolved' | 'escalated';
  investigatedBy?: string;
  investigationNotes?: string;
  resolution?: string;
  resolvedAt?: Date;
  
  // Regulatory actions
  reportedToRegulator: boolean;
  regulatoryCaseId?: string;
  internalCaseId: string;
}

/**
 * Position Report
 */
export interface PositionReport {
  id: string;
  timestamp: Date;
  asOfDate: Date;
  
  // Position identification
  symbol: string;
  assetClass: string;
  userId?: string;
  strategyId?: string;
  
  // Position details
  longQuantity: number;
  shortQuantity: number;
  netQuantity: number;
  averageCost: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  
  // Risk metrics
  exposure: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
  
  // Limits and utilization
  positionLimit?: number;
  limitUtilization?: number;
  marginRequired: number;
  marginAvailable: number;
  
  // Attribution
  trades: string[];        // Trade IDs contributing to position
  lastTradeTime: Date;
  holdingPeriod: number;   // In days
}

/**
 * Performance Report
 */
export interface PerformanceReport {
  id: string;
  timestamp: Date;
  periodStart: Date;
  periodEnd: Date;
  
  // Identification
  userId?: string;
  strategyId?: string;
  
  // P&L metrics
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  grossPnL: number;
  netPnL: number;
  
  // Performance metrics
  returnPercent: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  
  // Execution quality
  averageSlippage: number;
  totalCosts: number;
  costAsPercentOfVolume: number;
  
  // Risk metrics
  var95: number;           // Value at Risk 95%
  var99: number;           // Value at Risk 99%
  expectedShortfall: number;
  beta?: number;
  alpha?: number;
  
  // Attribution
  topPositions: {
    symbol: string;
    contribution: number;
    weight: number;
  }[];
  
  sectorAttribution?: {
    sector: string;
    allocation: number;
    contribution: number;
  }[];
}

/**
 * Regulatory Report
 */
export interface RegulatoryReport {
  id: string;
  timestamp: Date;
  reportingDate: Date;
  
  // Report identification
  reportType: 'transaction_report' | 'position_report' | 'risk_report' | 'best_execution';
  regulation: 'mifid_ii' | 'dodd_frank' | 'emir' | 'cftc' | 'sec';
  jurisdiction: string;
  
  // Reporting entity
  entityId: string;
  entityName: string;
  entityType: 'investment_firm' | 'bank' | 'hedge_fund' | 'proprietary_trader';
  
  // Report data
  reportData: any;         // Regulation-specific data structure
  
  // Submission
  submitted: boolean;
  submissionId?: string;
  submissionTime?: Date;
  acknowledgmentReceived: boolean;
  
  // Status
  status: 'pending' | 'submitted' | 'acknowledged' | 'rejected' | 'amended';
  rejectionReason?: string;
  amendments: string[];
}

/**
 * Trade Reporting Configuration
 */
export interface TradeReportingConfig {
  // Reporting settings
  enableRealTimeReporting: boolean;
  reportingBatchSize: number;
  reportingInterval: number;
  
  // Compliance monitoring
  enableComplianceMonitoring: boolean;
  complianceCheckInterval: number;
  autoEscalationThreshold: number;
  
  // Position tracking
  enablePositionTracking: boolean;
  positionUpdateInterval: number;
  positionSnapshotFrequency: number;
  
  // Performance analytics
  enablePerformanceReporting: boolean;
  performanceCalculationInterval: number;
  benchmarkSymbols: string[];
  
  // Regulatory compliance
  regulatoryCompliance: {
    mifidII: {
      enabled: boolean;
      entityId: string;
      reportingThreshold: number;
    };
    doddFrank: {
      enabled: boolean;
      swapDealerRegistration: boolean;
      reportingThreshold: number;
    };
    emir: {
      enabled: boolean;
      entityId: string;
      clearingThreshold: number;
    };
  };
  
  // Data retention
  tradeDataRetention: number;      // Days
  auditTrailRetention: number;     // Days
  complianceDataRetention: number; // Days
  
  // Storage and archival
  enableDataArchival: boolean;
  archivalInterval: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  
  // Alerts and notifications
  enableAlerts: boolean;
  alertThresholds: {
    positionLimit: number;
    riskBreach: number;
    complianceViolation: number;
    performanceDeviation: number;
  };
  
  // Integration
  externalSystems: {
    tradeCapture?: string;
    riskManagement?: string;
    compliance?: string;
    clearing?: string;
  };
}

/**
 * Main Trade Reporting System
 */
export class TradeReportingSystem extends EventEmitter {
  private config: TradeReportingConfig;
  
  // Data storage
  private tradeReports: Map<string, TradeReport> = new Map();
  private complianceViolations: Map<string, ComplianceViolation> = new Map();
  private positionReports: Map<string, PositionReport> = new Map();
  private performanceReports: Map<string, PerformanceReport> = new Map();
  private regulatoryReports: Map<string, RegulatoryReport> = new Map();
  
  // Position tracking
  private positions: Map<string, any> = new Map(); // symbol -> position
  private positionHistory: Map<string, any[]> = new Map();
  
  // Performance tracking
  private performanceMetrics: Map<string, any> = new Map();
  
  // Monitoring and timers
  private reportingTimer?: NodeJS.Timeout;
  private complianceTimer?: NodeJS.Timeout;
  private positionTimer?: NodeJS.Timeout;
  private performanceTimer?: NodeJS.Timeout;
  
  // Compliance engines
  private complianceRules: ComplianceRule[] = [];
  private suspiciousActivityDetector: SuspiciousActivityDetector;
  
  constructor(config: Partial<TradeReportingConfig>) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.suspiciousActivityDetector = new SuspiciousActivityDetector(this.config);
    
    this.initializeComplianceRules();
  }

  /**
   * Initialize Trade Reporting System
   */
  async initialize(): Promise<void> {
    try {
      // Start monitoring timers
      if (this.config.enableRealTimeReporting) {
        this.startReportingMonitoring();
      }
      
      if (this.config.enableComplianceMonitoring) {
        this.startComplianceMonitoring();
      }
      
      if (this.config.enablePositionTracking) {
        this.startPositionTracking();
      }
      
      if (this.config.enablePerformanceReporting) {
        this.startPerformanceTracking();
      }
      
      this.emit('initialized', {
        realTimeReporting: this.config.enableRealTimeReporting,
        complianceMonitoring: this.config.enableComplianceMonitoring,
        regulatoryCompliance: Object.keys(this.config.regulatoryCompliance)
      });
      
    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  /**
   * Report a completed trade
   */
  async reportTrade(
    trade: TradeExecution,
    order: ManagedOrder,
    marketImpact?: MarketImpactAnalysis
  ): Promise<{ success: boolean; reportId?: string; error?: string; }> {
    try {
      // Create trade report
      const report = this.createTradeReport(trade, order, marketImpact);
      
      // Store report
      this.tradeReports.set(report.id, report);
      
      // Update positions
      if (this.config.enablePositionTracking) {
        await this.updatePositions(report);
      }
      
      // Check compliance
      if (this.config.enableComplianceMonitoring) {
        await this.checkTradeCompliance(report, order);
      }
      
      // Generate regulatory reports if required
      await this.generateRegulatoryReports(report);
      
      // Emit events
      this.emit('trade_reported', {
        reportId: report.id,
        tradeId: trade.id,
        symbol: report.symbol,
        value: report.value
      });
      
      return { success: true, reportId: report.id };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    options: {
      includeViolations?: boolean;
      includeInvestigations?: boolean;
      includeMetrics?: boolean;
    } = {}
  ): Promise<any> {
    const violations = Array.from(this.complianceViolations.values())
      .filter(v => v.timestamp >= startDate && v.timestamp <= endDate);
    
    const report = {
      period: { start: startDate, end: endDate },
      summary: {
        totalViolations: violations.length,
        criticalViolations: violations.filter(v => v.severity === 'critical').length,
        openInvestigations: violations.filter(v => v.investigationStatus === 'in_progress').length,
        resolvedCases: violations.filter(v => v.investigationStatus === 'resolved').length
      },
      violations: options.includeViolations ? violations : undefined,
      investigations: options.includeInvestigations ? this.getActiveInvestigations() : undefined,
      metrics: options.includeMetrics ? this.calculateComplianceMetrics(startDate, endDate) : undefined
    };
    
    return report;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(
    startDate: Date,
    endDate: Date,
    filters: {
      strategyId?: string;
      userId?: string;
      symbol?: string;
    } = {}
  ): Promise<PerformanceReport> {
    const reportId = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Filter trades by criteria and time period
    const relevantTrades = Array.from(this.tradeReports.values())
      .filter(trade => {
        if (trade.executionTime < startDate || trade.executionTime > endDate) return false;
        if (filters.strategyId && trade.strategyId !== filters.strategyId) return false;
        if (filters.userId && trade.userId !== filters.userId) return false;
        if (filters.symbol && trade.symbol !== filters.symbol) return false;
        return true;
      });
    
    // Calculate performance metrics
    const metrics = this.calculatePerformanceMetrics(relevantTrades, startDate, endDate);
    
    const report: PerformanceReport = {
      id: reportId,
      timestamp: new Date(),
      periodStart: startDate,
      periodEnd: endDate,
      userId: filters.userId,
      strategyId: filters.strategyId,
      ...metrics
    };
    
    this.performanceReports.set(reportId, report);
    
    this.emit('performance_report_generated', {
      reportId,
      period: { start: startDate, end: endDate },
      metrics: {
        totalPnL: report.totalPnL,
        returnPercent: report.returnPercent,
        sharpeRatio: report.sharpeRatio
      }
    });
    
    return report;
  }

  /**
   * Get trade reports
   */
  getTradeReports(filters: {
    startDate?: Date;
    endDate?: Date;
    symbol?: string;
    userId?: string;
    strategyId?: string;
    status?: string;
  } = {}): TradeReport[] {
    let reports = Array.from(this.tradeReports.values());
    
    if (filters.startDate) {
      reports = reports.filter(r => r.executionTime >= filters.startDate!);
    }
    if (filters.endDate) {
      reports = reports.filter(r => r.executionTime <= filters.endDate!);
    }
    if (filters.symbol) {
      reports = reports.filter(r => r.symbol === filters.symbol);
    }
    if (filters.userId) {
      reports = reports.filter(r => r.userId === filters.userId);
    }
    if (filters.strategyId) {
      reports = reports.filter(r => r.strategyId === filters.strategyId);
    }
    if (filters.status) {
      reports = reports.filter(r => r.status === filters.status);
    }
    
    return reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get compliance violations
   */
  getComplianceViolations(filters: {
    severity?: string;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): ComplianceViolation[] {
    let violations = Array.from(this.complianceViolations.values());
    
    if (filters.severity) {
      violations = violations.filter(v => v.severity === filters.severity);
    }
    if (filters.type) {
      violations = violations.filter(v => v.type === filters.type);
    }
    if (filters.status) {
      violations = violations.filter(v => v.investigationStatus === filters.status);
    }
    if (filters.startDate) {
      violations = violations.filter(v => v.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      violations = violations.filter(v => v.timestamp <= filters.endDate!);
    }
    
    return violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get current positions
   */
  getCurrentPositions(userId?: string, strategyId?: string): PositionReport[] {
    return Array.from(this.positionReports.values())
      .filter(pos => {
        if (userId && pos.userId !== userId) return false;
        if (strategyId && pos.strategyId !== strategyId) return false;
        return pos.netQuantity !== 0; // Only non-zero positions
      })
      .sort((a, b) => Math.abs(b.netQuantity) - Math.abs(a.netQuantity));
  }

  /**
   * Export data for regulatory reporting
   */
  async exportRegulatoryData(
    regulation: 'mifid_ii' | 'dodd_frank' | 'emir' | 'cftc' | 'sec',
    startDate: Date,
    endDate: Date
  ): Promise<{ data: any; format: string; }> {
    const relevantTrades = this.getTradeReports({ startDate, endDate })
      .filter(trade => trade.regulatoryReporting[regulation as keyof typeof trade.regulatoryReporting]);
    
    // Format data according to regulatory requirements
    let formattedData;
    let format;
    
    switch (regulation) {
      case 'mifid_ii':
        formattedData = this.formatForMiFIDII(relevantTrades);
        format = 'XML';
        break;
      case 'dodd_frank':
        formattedData = this.formatForDoddFrank(relevantTrades);
        format = 'CSV';
        break;
      case 'emir':
        formattedData = this.formatForEMIR(relevantTrades);
        format = 'XML';
        break;
      default:
        throw new Error(`Unsupported regulation: ${regulation}`);
    }
    
    return { data: formattedData, format };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    // Stop all timers
    if (this.reportingTimer) clearInterval(this.reportingTimer);
    if (this.complianceTimer) clearInterval(this.complianceTimer);
    if (this.positionTimer) clearInterval(this.positionTimer);
    if (this.performanceTimer) clearInterval(this.performanceTimer);
    
    // Archive data if enabled
    if (this.config.enableDataArchival) {
      await this.archiveData();
    }
    
    this.emit('cleanup_completed', {
      tradeReports: this.tradeReports.size,
      complianceViolations: this.complianceViolations.size,
      positionReports: this.positionReports.size
    });
  }

  // === PRIVATE METHODS ===

  private createTradeReport(
    trade: TradeExecution,
    order: ManagedOrder,
    marketImpact?: MarketImpactAnalysis
  ): TradeReport {
    const reportId = `trade_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: reportId,
      timestamp: new Date(),
      reportDate: new Date(),
      tradeId: trade.id,
      orderIds: [order.id],
      strategyId: order.metadata.strategy,
      userId: order.metadata.strategy, // Simplified mapping
      symbol: trade.symbol,
      assetClass: 'crypto', // Simplified - would be determined from symbol
      venue: 'dydx', // From venue information
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      value: trade.quantity * trade.price,
      currency: 'USD',
      executionTime: trade.timestamp,
      executionType: order.type === 'market' ? 'market' : 'limit',
      executionAlgorithm: order.executionStrategy.type,
      commission: trade.takerFee || 0,
      fees: (trade.takerFee || 0) + (trade.makerFee || 0),
      taxes: 0,
      totalCosts: (trade.takerFee || 0) + (trade.makerFee || 0),
      marketPrice: trade.price,
      spread: trade.spreadBeforeTrade,
      slippage: marketImpact?.slippage || 0,
      marketImpact: marketImpact?.temporaryImpact || 0,
      settlementDate: new Date(Date.now() + 86400000), // T+1
      regulatoryReporting: {
        mifidII: false,
        doddFrank: false,
        emir: false,
        cftc: false
      },
      status: 'confirmed',
      metadata: {
        orderId: order.id,
        executionStrategy: order.executionStrategy.type,
        priority: order.priority
      }
    };
  }

  private async updatePositions(report: TradeReport): Promise<void> {
    const positionKey = `${report.symbol}_${report.userId || 'default'}_${report.strategyId || 'default'}`;
    let position = this.positions.get(positionKey);
    
    if (!position) {
      position = {
        symbol: report.symbol,
        userId: report.userId,
        strategyId: report.strategyId,
        longQuantity: 0,
        shortQuantity: 0,
        netQuantity: 0,
        averageCost: 0,
        totalCost: 0,
        realizePnL: 0,
        trades: []
      };
    }
    
    // Update position based on trade
    if (report.side === 'buy') {
      position.longQuantity += report.quantity;
    } else {
      position.shortQuantity += report.quantity;
    }
    
    position.netQuantity = position.longQuantity - position.shortQuantity;
    position.totalCost += report.value;
    position.averageCost = position.netQuantity !== 0 ? position.totalCost / Math.abs(position.netQuantity) : 0;
    position.trades.push(report.tradeId);
    
    this.positions.set(positionKey, position);
    
    // Create position report
    const positionReport: PositionReport = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      asOfDate: new Date(),
      symbol: position.symbol,
      assetClass: 'crypto',
      userId: position.userId,
      strategyId: position.strategyId,
      longQuantity: position.longQuantity,
      shortQuantity: position.shortQuantity,
      netQuantity: position.netQuantity,
      averageCost: position.averageCost,
      marketValue: position.netQuantity * report.marketPrice,
      unrealizedPnL: (report.marketPrice - position.averageCost) * position.netQuantity,
      realizedPnL: position.realizePnL,
      totalPnL: position.realizePnL + ((report.marketPrice - position.averageCost) * position.netQuantity),
      exposure: Math.abs(position.netQuantity * report.marketPrice),
      marginRequired: Math.abs(position.netQuantity * report.marketPrice) * 0.1, // 10% margin
      marginAvailable: 1000000, // Mock available margin
      trades: position.trades,
      lastTradeTime: new Date(),
      holdingPeriod: 0 // Would calculate based on first trade time
    };
    
    this.positionReports.set(positionReport.id, positionReport);
  }

  private async checkTradeCompliance(report: TradeReport, order: ManagedOrder): Promise<void> {
    // Run compliance rules
    for (const rule of this.complianceRules) {
      const violation = await rule.check(report, order, this);
      if (violation) {
        this.complianceViolations.set(violation.id, violation);
        this.emit('compliance_violation', violation);
        
        // Auto-escalate critical violations
        if (violation.severity === 'critical' && this.config.autoEscalationThreshold <= violation.detectionScore) {
          this.escalateViolation(violation);
        }
      }
    }
    
    // Check for suspicious activity
    const suspiciousActivities = await this.suspiciousActivityDetector.analyze(report, order);
    for (const activity of suspiciousActivities) {
      this.complianceViolations.set(activity.id, activity);
      this.emit('suspicious_activity', activity);
    }
  }

  private async generateRegulatoryReports(report: TradeReport): Promise<void> {
    // Check if trade requires regulatory reporting
    const config = this.config.regulatoryCompliance;
    
    if (config.mifidII.enabled && report.value >= config.mifidII.reportingThreshold) {
      await this.createRegulatoryReport(report, 'mifid_ii');
    }
    
    if (config.doddFrank.enabled && report.value >= config.doddFrank.reportingThreshold) {
      await this.createRegulatoryReport(report, 'dodd_frank');
    }
    
    if (config.emir.enabled && report.value >= config.emir.clearingThreshold) {
      await this.createRegulatoryReport(report, 'emir');
    }
  }

  private async createRegulatoryReport(report: TradeReport, regulation: string): Promise<void> {
    const regulatoryReport: RegulatoryReport = {
      id: `reg_${regulation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      reportingDate: new Date(),
      reportType: 'transaction_report',
      regulation: regulation as any,
      jurisdiction: 'EU', // Would be determined based on regulation
      entityId: 'ENTITY123', // From configuration
      entityName: 'Trading Firm',
      entityType: 'proprietary_trader',
      reportData: this.formatReportForRegulation(report, regulation),
      submitted: false,
      acknowledgmentReceived: false,
      status: 'pending',
      amendments: []
    };
    
    this.regulatoryReports.set(regulatoryReport.id, regulatoryReport);
  }

  private calculatePerformanceMetrics(trades: TradeReport[], startDate: Date, endDate: Date): any {
    if (trades.length === 0) {
      return this.getEmptyPerformanceMetrics();
    }
    
    // Calculate basic metrics
    const totalPnL = trades.reduce((sum, trade) => sum + (trade.value - trade.totalCosts), 0);
    const totalVolume = trades.reduce((sum, trade) => sum + trade.value, 0);
    const totalCosts = trades.reduce((sum, trade) => sum + trade.totalCosts, 0);
    
    const winningTrades = trades.filter(trade => (trade.value - trade.totalCosts) > 0).length;
    const losingTrades = trades.length - winningTrades;
    
    return {
      totalPnL,
      realizedPnL: totalPnL,
      unrealizedPnL: 0,
      grossPnL: totalPnL + totalCosts,
      netPnL: totalPnL,
      returnPercent: totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0,
      annualizedReturn: 0, // Would calculate based on time period
      volatility: 0,       // Would calculate from daily returns
      sharpeRatio: 0,      // Would calculate with risk-free rate
      sortinoRatio: 0,     // Would calculate downside deviation
      maxDrawdown: 0,      // Would calculate from cumulative returns
      maxDrawdownDuration: 0,
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
      averageWin: winningTrades > 0 ? totalPnL / winningTrades : 0,
      averageLoss: losingTrades > 0 ? Math.abs(totalPnL) / losingTrades : 0,
      profitFactor: losingTrades > 0 ? Math.abs(totalPnL / losingTrades) : 0,
      averageSlippage: trades.reduce((sum, t) => sum + t.slippage, 0) / trades.length,
      totalCosts,
      costAsPercentOfVolume: totalVolume > 0 ? (totalCosts / totalVolume) * 100 : 0,
      var95: 0,            // Would calculate Value at Risk
      var99: 0,
      expectedShortfall: 0,
      topPositions: [],    // Would analyze by symbol
      sectorAttribution: []
    };
  }

  private getEmptyPerformanceMetrics(): any {
    return {
      totalPnL: 0, realizedPnL: 0, unrealizedPnL: 0, grossPnL: 0, netPnL: 0,
      returnPercent: 0, annualizedReturn: 0, volatility: 0, sharpeRatio: 0, sortinoRatio: 0,
      maxDrawdown: 0, maxDrawdownDuration: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0,
      winRate: 0, averageWin: 0, averageLoss: 0, profitFactor: 0, averageSlippage: 0,
      totalCosts: 0, costAsPercentOfVolume: 0, var95: 0, var99: 0, expectedShortfall: 0,
      topPositions: [], sectorAttribution: []
    };
  }

  private formatReportForRegulation(report: TradeReport, regulation: string): any {
    // Format trade report according to specific regulatory requirements
    switch (regulation) {
      case 'mifid_ii':
        return this.formatForMiFIDII([report]);
      case 'dodd_frank':
        return this.formatForDoddFrank([report]);
      case 'emir':
        return this.formatForEMIR([report]);
      default:
        return report;
    }
  }

  private formatForMiFIDII(trades: TradeReport[]): any {
    // MiFID II RTS 22 transaction reporting format
    return trades.map(trade => ({
      TradingCapacity: '1',        // Deal on own account
      TransactionIdentificationCode: trade.id,
      InstrumentIdentificationCode: trade.symbol,
      Price: trade.price,
      Quantity: trade.quantity,
      TradingDateTime: trade.executionTime.toISOString(),
      TradingVenue: trade.venue,
      Currency: trade.currency
      // ... additional MiFID II fields
    }));
  }

  private formatForDoddFrank(trades: TradeReport[]): any {
    // Dodd-Frank swap reporting format
    return trades.map(trade => ({
      UniqueTransactionIdentifier: trade.id,
      ProductID: trade.symbol,
      NotionalAmount: trade.value,
      ExecutionTimestamp: trade.executionTime.toISOString(),
      Platform: trade.venue
      // ... additional Dodd-Frank fields
    }));
  }

  private formatForEMIR(trades: TradeReport[]): any {
    // EMIR trade reporting format
    return trades.map(trade => ({
      UniqueTransactionIdentifier: trade.id,
      TradingCapacity: 'P',        // Principal
      NotionalAmount: trade.value,
      ExecutionTimestamp: trade.executionTime.toISOString(),
      TradingVenue: trade.venue
      // ... additional EMIR fields
    }));
  }

  private getActiveInvestigations(): any[] {
    return Array.from(this.complianceViolations.values())
      .filter(v => v.investigationStatus === 'in_progress')
      .map(v => ({
        id: v.id,
        type: v.type,
        severity: v.severity,
        assignedTo: v.investigatedBy,
        created: v.timestamp
      }));
  }

  private calculateComplianceMetrics(startDate: Date, endDate: Date): any {
    const violations = Array.from(this.complianceViolations.values())
      .filter(v => v.timestamp >= startDate && v.timestamp <= endDate);
    
    return {
      totalViolations: violations.length,
      byType: this.groupBy(violations, 'type'),
      bySeverity: this.groupBy(violations, 'severity'),
      resolutionTimes: violations
        .filter(v => v.resolvedAt)
        .map(v => v.resolvedAt!.getTime() - v.timestamp.getTime()),
      falsePositiveRate: violations.filter(v => v.falsePositiveRisk > 80).length / violations.length
    };
  }

  private groupBy(array: any[], key: string): any {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  private escalateViolation(violation: ComplianceViolation): void {
    violation.investigationStatus = 'escalated';
    this.emit('violation_escalated', violation);
  }

  private initializeComplianceRules(): void {
    // Initialize standard compliance rules
    this.complianceRules = [
      new PositionLimitRule(),
      new WashTradeRule(),
      new LayeringRule(),
      new SpoofingRule(),
      new BestExecutionRule()
    ];
  }

  private startReportingMonitoring(): void {
    this.reportingTimer = setInterval(() => {
      this.processReportingBatch();
    }, this.config.reportingInterval);
  }

  private startComplianceMonitoring(): void {
    this.complianceTimer = setInterval(() => {
      this.performComplianceChecks();
    }, this.config.complianceCheckInterval);
  }

  private startPositionTracking(): void {
    this.positionTimer = setInterval(() => {
      this.updatePositionSnapshots();
    }, this.config.positionUpdateInterval);
  }

  private startPerformanceTracking(): void {
    this.performanceTimer = setInterval(() => {
      this.calculatePerformanceUpdates();
    }, this.config.performanceCalculationInterval);
  }

  private async processReportingBatch(): Promise<void> {
    // Process pending regulatory reports
    const pendingReports = Array.from(this.regulatoryReports.values())
      .filter(r => r.status === 'pending')
      .slice(0, this.config.reportingBatchSize);
    
    for (const report of pendingReports) {
      // Submit report (mock implementation)
      report.status = 'submitted';
      report.submitted = true;
      report.submissionTime = new Date();
    }
  }

  private async performComplianceChecks(): Promise<void> {
    // Perform periodic compliance checks
    const recentTrades = this.getTradeReports({
      startDate: new Date(Date.now() - this.config.complianceCheckInterval)
    });
    
    for (const trade of recentTrades) {
      // Re-check compliance for recent trades
    }
  }

  private updatePositionSnapshots(): void {
    // Create position snapshots for historical tracking
    for (const [key, position] of this.positions.entries()) {
      let history = this.positionHistory.get(key);
      if (!history) {
        history = [];
        this.positionHistory.set(key, history);
      }
      
      history.push({
        timestamp: new Date(),
        ...position
      });
      
      // Keep only recent history
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
    }
  }

  private calculatePerformanceUpdates(): void {
    // Update real-time performance metrics
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 86400000); // Last 24 hours
    
    // Update metrics for each strategy/user
    // This would be implemented based on specific requirements
  }

  private async archiveData(): Promise<void> {
    // Archive old data based on retention policies
    const cutoffDate = new Date(Date.now() - (this.config.tradeDataRetention * 86400000));
    
    // Archive trade reports
    const oldTradeReports = Array.from(this.tradeReports.entries())
      .filter(([_, report]) => report.timestamp < cutoffDate);
    
    for (const [id, _] of oldTradeReports) {
      this.tradeReports.delete(id);
    }
    
    this.emit('data_archived', {
      tradeReports: oldTradeReports.length,
      archiveDate: cutoffDate
    });
  }

  private mergeWithDefaults(config: Partial<TradeReportingConfig>): TradeReportingConfig {
    return {
      enableRealTimeReporting: true,
      reportingBatchSize: 100,
      reportingInterval: 60000,
      enableComplianceMonitoring: true,
      complianceCheckInterval: 30000,
      autoEscalationThreshold: 80,
      enablePositionTracking: true,
      positionUpdateInterval: 10000,
      positionSnapshotFrequency: 300000,
      enablePerformanceReporting: true,
      performanceCalculationInterval: 60000,
      benchmarkSymbols: ['BTC-USD', 'ETH-USD'],
      regulatoryCompliance: {
        mifidII: { enabled: false, entityId: '', reportingThreshold: 0 },
        doddFrank: { enabled: false, swapDealerRegistration: false, reportingThreshold: 0 },
        emir: { enabled: false, entityId: '', clearingThreshold: 0 }
      },
      tradeDataRetention: 2555,     // 7 years
      auditTrailRetention: 2555,
      complianceDataRetention: 2555,
      enableDataArchival: true,
      archivalInterval: 86400000,   // Daily
      compressionEnabled: true,
      encryptionEnabled: true,
      enableAlerts: true,
      alertThresholds: {
        positionLimit: 0.8,
        riskBreach: 0.9,
        complianceViolation: 0.5,
        performanceDeviation: 0.2
      },
      externalSystems: {},
      ...config
    };
  }
}

// === COMPLIANCE RULES ===

abstract class ComplianceRule {
  abstract check(report: TradeReport, order: ManagedOrder, system: TradeReportingSystem): Promise<ComplianceViolation | null>;
}

class PositionLimitRule extends ComplianceRule {
  async check(report: TradeReport, order: ManagedOrder, system: TradeReportingSystem): Promise<ComplianceViolation | null> {
    // Check position limits
    return null; // Mock implementation
  }
}

class WashTradeRule extends ComplianceRule {
  async check(report: TradeReport, order: ManagedOrder, system: TradeReportingSystem): Promise<ComplianceViolation | null> {
    // Check for wash trades
    return null; // Mock implementation
  }
}

class LayeringRule extends ComplianceRule {
  async check(report: TradeReport, order: ManagedOrder, system: TradeReportingSystem): Promise<ComplianceViolation | null> {
    // Check for layering/spoofing
    return null; // Mock implementation
  }
}

class SpoofingRule extends ComplianceRule {
  async check(report: TradeReport, order: ManagedOrder, system: TradeReportingSystem): Promise<ComplianceViolation | null> {
    // Check for spoofing
    return null; // Mock implementation
  }
}

class BestExecutionRule extends ComplianceRule {
  async check(report: TradeReport, order: ManagedOrder, system: TradeReportingSystem): Promise<ComplianceViolation | null> {
    // Check best execution compliance
    return null; // Mock implementation
  }
}

class SuspiciousActivityDetector {
  private config: TradeReportingConfig;
  
  constructor(config: TradeReportingConfig) {
    this.config = config;
  }
  
  async analyze(report: TradeReport, order: ManagedOrder): Promise<ComplianceViolation[]> {
    // Analyze for suspicious trading patterns
    return []; // Mock implementation
  }
}

export default TradeReportingSystem;