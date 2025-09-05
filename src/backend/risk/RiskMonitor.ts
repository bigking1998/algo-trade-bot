/**
 * Risk Monitor - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Real-time risk monitoring system including:
 * - Continuous risk limit monitoring
 * - Drawdown tracking
 * - Concentration monitoring
 * - Circuit breaker management
 * - Risk alert generation
 * - Historical risk tracking
 */

import type {
  PortfolioState,
  Position,
  RiskLimits,
  RiskLimitStatus,
  RiskAlert,
  RiskLimitBreach,
  CircuitBreaker,
  CircuitBreakerStatus,
  DrawdownStatus,
  ConcentrationAlert,
  RiskTrend,
  PortfolioRiskAssessment,
  RiskLevel
} from './types.js';
import type { Trade } from '../types/database.js';
import { PortfolioRiskAnalyzer } from './PortfolioRiskAnalyzer.js';

export class RiskMonitor {
  private static instance: RiskMonitor;
  private portfolioRiskAnalyzer: PortfolioRiskAnalyzer;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private riskHistory: PortfolioRiskAssessment[] = [];
  private activeAlerts: Map<string, RiskAlert> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private isMonitoring: boolean = false;
  
  private constructor() {
    this.portfolioRiskAnalyzer = PortfolioRiskAnalyzer.getInstance();
    this.initializeDefaultCircuitBreakers();
  }
  
  public static getInstance(): RiskMonitor {
    if (!RiskMonitor.instance) {
      RiskMonitor.instance = new RiskMonitor();
    }
    return RiskMonitor.instance;
  }

  /**
   * Start real-time risk monitoring
   */
  async startMonitoring(intervalMs: number = 10000): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Risk monitoring is already active');
      return;
    }
    
    console.log(`Starting risk monitoring with ${intervalMs}ms interval`);
    this.isMonitoring = true;
    
    // Initial check
    await this.performRiskCheck();
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performRiskCheck();
      } catch (error) {
        console.error('Error in risk monitoring cycle:', error);
        await this.generateSystemAlert('Risk monitoring error', error as Error);
      }
    }, intervalMs);
  }

  /**
   * Stop risk monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('Risk monitoring stopped');
  }

  /**
   * Monitor risk limits against current portfolio state
   */
  async monitorRiskLimits(
    portfolioState: PortfolioState,
    riskLimits: RiskLimits
  ): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    
    // Check portfolio VaR limits
    const portfolioVaR = await this.estimatePortfolioVaR(portfolioState.positions);
    const varUtilization = (portfolioVaR / riskLimits.maxPortfolioVaR) * 100;
    
    if (varUtilization > 90) {
      alerts.push(await this.createRiskAlert(
        'critical',
        'limit_breach',
        'Portfolio VaR Limit Critical',
        `Portfolio VaR at ${varUtilization.toFixed(1)}% of limit`,
        { portfolioVaR, limit: riskLimits.maxPortfolioVaR },
        ['Reduce position sizes', 'Close high-risk positions']
      ));
    } else if (varUtilization > 75) {
      alerts.push(await this.createRiskAlert(
        'warning',
        'limit_breach',
        'Portfolio VaR Limit Warning',
        `Portfolio VaR at ${varUtilization.toFixed(1)}% of limit`,
        { portfolioVaR, limit: riskLimits.maxPortfolioVaR },
        ['Monitor closely', 'Consider position reduction']
      ));
    }
    
    // Check drawdown limits
    const currentDrawdown = Math.abs(portfolioState.unrealizedPnL) / portfolioState.totalValue * 100;
    if (currentDrawdown > riskLimits.maxDrawdown) {
      alerts.push(await this.createRiskAlert(
        'critical',
        'limit_breach',
        'Drawdown Limit Breach',
        `Current drawdown ${currentDrawdown.toFixed(2)}% exceeds limit of ${riskLimits.maxDrawdown}%`,
        { currentDrawdown, limit: riskLimits.maxDrawdown },
        ['Immediate position review', 'Consider portfolio liquidation']
      ));
    }
    
    // Check leverage limits
    if (portfolioState.leverage > riskLimits.maxLeverage) {
      alerts.push(await this.createRiskAlert(
        'critical',
        'limit_breach',
        'Leverage Limit Breach',
        `Current leverage ${portfolioState.leverage.toFixed(2)}x exceeds limit of ${riskLimits.maxLeverage}x`,
        { currentLeverage: portfolioState.leverage, limit: riskLimits.maxLeverage },
        ['Reduce leverage immediately', 'Close leveraged positions']
      ));
    }
    
    // Check position concentration limits
    const concentrationAlerts = await this.checkConcentrationLimits(
      portfolioState.positions,
      riskLimits
    );
    alerts.push(...concentrationAlerts);
    
    // Check exposure limits
    if (portfolioState.grossExposure > riskLimits.maxGrossExposure) {
      alerts.push(await this.createRiskAlert(
        'warning',
        'limit_breach',
        'Gross Exposure Limit Breach',
        `Gross exposure $${portfolioState.grossExposure.toLocaleString()} exceeds limit`,
        { currentExposure: portfolioState.grossExposure, limit: riskLimits.maxGrossExposure },
        ['Reduce overall position sizes']
      ));
    }
    
    return alerts;
  }

  /**
   * Track portfolio drawdown in real-time
   */
  async trackDrawdown(portfolioState: PortfolioState): Promise<DrawdownStatus> {
    const currentValue = portfolioState.totalValue;
    const unrealizedPnL = portfolioState.unrealizedPnL;
    const realizedPnL = portfolioState.realizedPnL;
    
    // Calculate current drawdown from high watermark
    const highWaterMark = await this.getHighWaterMark();
    const currentDrawdown = Math.max(0, (highWaterMark - currentValue) / highWaterMark * 100);
    
    // Update high water mark if needed
    if (currentValue > highWaterMark) {
      await this.updateHighWaterMark(currentValue);
    }
    
    // Calculate daily P&L
    const dailyPnL = portfolioState.dailyPnL;
    const dailyDrawdown = dailyPnL < 0 ? Math.abs(dailyPnL) / currentValue * 100 : 0;
    
    // Determine drawdown severity
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (currentDrawdown < 2) severity = 'low';
    else if (currentDrawdown < 5) severity = 'medium';
    else if (currentDrawdown < 10) severity = 'high';
    else severity = 'critical';
    
    // Calculate recovery metrics
    const { daysInDrawdown, estimatedRecoveryTime } = await this.calculateRecoveryMetrics(
      currentDrawdown,
      portfolioState
    );
    
    return {
      timestamp: new Date(),
      currentDrawdown,
      dailyDrawdown,
      maxDrawdown: await this.getMaxHistoricalDrawdown(),
      highWaterMark,
      daysInDrawdown,
      estimatedRecoveryTime,
      severity,
      isInDrawdown: currentDrawdown > 0.5, // Consider >0.5% as drawdown
      drawdownTrend: await this.calculateDrawdownTrend(),
      alerts: await this.generateDrawdownAlerts(currentDrawdown, severity)
    };
  }

  /**
   * Monitor portfolio concentration risk
   */
  async monitorConcentration(positions: Position[]): Promise<ConcentrationAlert[]> {
    if (positions.length === 0) return [];
    
    const alerts: ConcentrationAlert[] = [];
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    // Check individual position concentration
    const concentrationThreshold = 15; // 15% concentration threshold
    const highConcentrationThreshold = 25; // 25% high concentration
    
    for (const position of positions) {
      const concentration = (position.marketValue / totalValue) * 100;
      
      if (concentration > highConcentrationThreshold) {
        alerts.push({
          id: `concentration_${position.symbol}_${Date.now()}`,
          timestamp: new Date(),
          type: 'position_concentration',
          severity: 'high',
          symbol: position.symbol,
          currentConcentration: concentration,
          threshold: highConcentrationThreshold,
          message: `High concentration in ${position.symbol}: ${concentration.toFixed(1)}%`,
          recommendation: 'Consider reducing position size to improve diversification',
          portfolioImpact: concentration,
          riskScore: Math.min(100, concentration * 2)
        });
      } else if (concentration > concentrationThreshold) {
        alerts.push({
          id: `concentration_${position.symbol}_${Date.now()}`,
          timestamp: new Date(),
          type: 'position_concentration',
          severity: 'medium',
          symbol: position.symbol,
          currentConcentration: concentration,
          threshold: concentrationThreshold,
          message: `Elevated concentration in ${position.symbol}: ${concentration.toFixed(1)}%`,
          recommendation: 'Monitor position size and consider gradual reduction',
          portfolioImpact: concentration,
          riskScore: concentration * 1.5
        });
      }
    }
    
    // Check for sector concentration (simplified - would require sector mapping)
    const sectorAlerts = await this.checkSectorConcentration(positions);
    alerts.push(...sectorAlerts);
    
    // Check for correlation concentration
    const correlationAlerts = await this.checkCorrelationConcentration(positions);
    alerts.push(...correlationAlerts);
    
    return alerts;
  }

  /**
   * Generate risk alerts based on assessment
   */
  async generateRiskAlerts(riskAssessment: PortfolioRiskAssessment): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    
    // VaR-based alerts
    if (riskAssessment.dailyVaR95 / riskAssessment.portfolioValue > 0.05) { // >5% daily VaR
      alerts.push(await this.createRiskAlert(
        'warning',
        'market',
        'High Portfolio VaR',
        `Daily VaR at ${(riskAssessment.dailyVaR95 / riskAssessment.portfolioValue * 100).toFixed(2)}% of portfolio`,
        { var: riskAssessment.dailyVaR95, portfolioValue: riskAssessment.portfolioValue },
        ['Review position sizing', 'Consider reducing exposure']
      ));
    }
    
    // Concentration alerts
    if (riskAssessment.concentrationRisk.concentrationRiskScore > 70) {
      alerts.push(await this.createRiskAlert(
        'warning',
        'concentration',
        'High Concentration Risk',
        'Portfolio shows high concentration in few positions',
        { score: riskAssessment.concentrationRisk.concentrationRiskScore },
        ['Diversify portfolio', 'Reduce large positions']
      ));
    }
    
    // Correlation alerts
    if (riskAssessment.correlationRisk.averageCorrelation > 0.7) {
      alerts.push(await this.createRiskAlert(
        'warning',
        'correlation',
        'High Correlation Risk',
        `High average correlation: ${(riskAssessment.correlationRisk.averageCorrelation * 100).toFixed(1)}%`,
        { correlation: riskAssessment.correlationRisk.averageCorrelation },
        ['Add uncorrelated assets', 'Review diversification strategy']
      ));
    }
    
    // Liquidity alerts
    if (riskAssessment.liquidityRisk.liquidityScore < 40) {
      alerts.push(await this.createRiskAlert(
        'warning',
        'liquidity',
        'Low Portfolio Liquidity',
        'Portfolio has low overall liquidity',
        { score: riskAssessment.liquidityRisk.liquidityScore },
        ['Increase liquid positions', 'Review illiquid holdings']
      ));
    }
    
    // Drawdown alerts
    if (riskAssessment.currentDrawdown > 10) {
      alerts.push(await this.createRiskAlert(
        'critical',
        'market',
        'Significant Drawdown',
        `Current drawdown: ${riskAssessment.currentDrawdown.toFixed(2)}%`,
        { drawdown: riskAssessment.currentDrawdown },
        ['Review all positions', 'Consider risk reduction']
      ));
    }
    
    return alerts;
  }

  /**
   * Check circuit breaker status and trigger if needed
   */
  async checkCircuitBreakers(portfolioState: PortfolioState): Promise<CircuitBreakerStatus> {
    const breakerStatuses = [];
    let anyTriggered = false;
    let tradingPaused = false;
    const activeBreakers: string[] = [];
    const recentTriggers = await this.getRecentCircuitBreakerTriggers();
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      if (!breaker.enabled) continue;
      
      const currentValue = await this.getMetricValue(portfolioState, breaker.metric);
      const distanceToTrigger = breaker.threshold - currentValue;
      const shouldTrigger = this.shouldTriggerCircuitBreaker(breaker, currentValue);
      
      let status: 'safe' | 'warning' | 'triggered' = 'safe';
      
      if (shouldTrigger && !breaker.isTriggered) {
        // Trigger circuit breaker
        status = 'triggered';
        breaker.isTriggered = true;
        breaker.lastTriggered = new Date();
        breaker.triggerCount++;
        anyTriggered = true;
        activeBreakers.push(name);
        
        await this.executeCircuitBreakerAction(breaker, portfolioState);
        
        if (breaker.action === 'pause_trading') {
          tradingPaused = true;
        }
        
        // Log trigger
        recentTriggers.push({
          breakerName: name,
          triggeredAt: new Date(),
          reason: `${breaker.metric} reached ${currentValue} (threshold: ${breaker.threshold})`,
          actionTaken: breaker.action,
          resolved: false
        });
        
      } else if (Math.abs(distanceToTrigger) / breaker.threshold < 0.1) {
        status = 'warning';
      }
      
      breakerStatuses.push({
        breaker,
        currentValue,
        distanceToTrigger,
        status
      });
    }
    
    return {
      timestamp: new Date(),
      breakers: breakerStatuses,
      anyTriggered,
      activeBreakers,
      tradingPaused,
      recentTriggers
    };
  }

  /**
   * Update risk history tracking
   */
  async updateRiskHistory(assessment: PortfolioRiskAssessment): Promise<void> {
    // Add to history
    this.riskHistory.push(assessment);
    
    // Keep only last 1000 assessments (or implement database storage)
    if (this.riskHistory.length > 1000) {
      this.riskHistory = this.riskHistory.slice(-1000);
    }
    
    // Store in database (would be implemented with actual database)
    await this.storeRiskAssessment(assessment);
  }

  /**
   * Get risk trends over specified period
   */
  async getRiskTrends(periodHours: number): Promise<RiskTrend[]> {
    const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    const recentAssessments = this.riskHistory.filter(
      assessment => assessment.timestamp >= cutoffTime
    );
    
    if (recentAssessments.length < 2) {
      return [];
    }
    
    const trends: RiskTrend[] = [];
    
    // Analyze VaR trend
    const varTrend = this.calculateMetricTrend(
      recentAssessments.map(a => ({
        timestamp: a.timestamp,
        value: a.dailyVaR95
      })),
      'Daily VaR 95%'
    );
    trends.push(varTrend);
    
    // Analyze drawdown trend
    const drawdownTrend = this.calculateMetricTrend(
      recentAssessments.map(a => ({
        timestamp: a.timestamp,
        value: a.currentDrawdown
      })),
      'Current Drawdown'
    );
    trends.push(drawdownTrend);
    
    // Analyze concentration trend
    const concentrationTrend = this.calculateMetricTrend(
      recentAssessments.map(a => ({
        timestamp: a.timestamp,
        value: a.concentrationRisk.concentrationRiskScore
      })),
      'Concentration Risk Score'
    );
    trends.push(concentrationTrend);
    
    return trends;
  }

  /**
   * Private helper methods
   */
  private async performRiskCheck(): Promise<void> {
    try {
      // Get current portfolio state (would come from portfolio manager)
      const portfolioState = await this.getCurrentPortfolioState();
      
      if (!portfolioState || portfolioState.positions.length === 0) {
        return; // No positions to monitor
      }
      
      // Get risk limits (would come from configuration)
      const riskLimits = await this.getRiskLimits();
      
      // Monitor risk limits
      const limitAlerts = await this.monitorRiskLimits(portfolioState, riskLimits);
      
      // Track drawdown
      const drawdownStatus = await this.trackDrawdown(portfolioState);
      
      // Monitor concentration
      const concentrationAlerts = await this.monitorConcentration(portfolioState.positions);
      
      // Check circuit breakers
      const circuitBreakerStatus = await this.checkCircuitBreakers(portfolioState);
      
      // Process all alerts
      const allAlerts = [...limitAlerts, ...concentrationAlerts];
      await this.processAlerts(allAlerts);
      
      // Log monitoring cycle completion
      console.log(`Risk monitoring cycle completed - ${allAlerts.length} alerts generated`);
      
    } catch (error) {
      console.error('Error in risk check:', error);
    }
  }

  private initializeDefaultCircuitBreakers(): void {
    // Daily loss circuit breaker
    this.circuitBreakers.set('daily_loss', {
      name: 'Daily Loss Limit',
      description: 'Triggers when daily loss exceeds threshold',
      threshold: -0.05, // -5% daily loss
      thresholdType: 'percentage',
      metric: 'dailyPnLPercent',
      action: 'pause_trading',
      severity: 'high',
      enabled: true,
      cooldownPeriod: 60, // 1 hour cooldown
      maxTriggersPerDay: 3,
      isTriggered: false,
      triggerCount: 0
    });
    
    // Portfolio drawdown circuit breaker
    this.circuitBreakers.set('drawdown', {
      name: 'Portfolio Drawdown',
      description: 'Triggers when drawdown exceeds threshold',
      threshold: 15, // 15% drawdown
      thresholdType: 'percentage',
      metric: 'drawdownPercent',
      action: 'reduce_positions',
      severity: 'critical',
      enabled: true,
      cooldownPeriod: 120, // 2 hours cooldown
      maxTriggersPerDay: 2,
      isTriggered: false,
      triggerCount: 0
    });
    
    // VaR circuit breaker
    this.circuitBreakers.set('var_breach', {
      name: 'VaR Breach',
      description: 'Triggers when VaR exceeds acceptable levels',
      threshold: 0.08, // 8% of portfolio
      thresholdType: 'percentage',
      metric: 'varPercent',
      action: 'alert_only',
      severity: 'medium',
      enabled: true,
      cooldownPeriod: 30, // 30 minutes cooldown
      maxTriggersPerDay: 10,
      isTriggered: false,
      triggerCount: 0
    });
  }

  private async createRiskAlert(
    level: 'info' | 'warning' | 'critical' | 'emergency',
    category: 'limit_breach' | 'concentration' | 'correlation' | 'liquidity' | 'market' | 'operational',
    title: string,
    message: string,
    details: Record<string, unknown>,
    actions: string[]
  ): Promise<RiskAlert> {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      title,
      message,
      details,
      affectedSymbols: [],
      affectedStrategies: [],
      recommendedActions: actions,
      urgency: level === 'emergency' ? 'immediate' : level === 'critical' ? 'high' : 'medium',
      acknowledged: false,
      resolved: false,
      autoResolved: false
    };
  }

  private calculateMetricTrend(
    values: Array<{ timestamp: Date; value: number }>,
    metricName: string
  ): RiskTrend {
    if (values.length < 2) {
      return {
        metric: metricName,
        values,
        trend: 'stable',
        trendStrength: 0,
        volatility: 0,
        mean: 0,
        standardDeviation: 0,
        minimum: 0,
        maximum: 0,
        shortTermForecast: 0,
        confidence: 0,
        calculatedAt: new Date()
      };
    }
    
    // Calculate basic statistics
    const numericValues = values.map(v => v.value);
    const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
    const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length;
    const standardDeviation = Math.sqrt(variance);
    const minimum = Math.min(...numericValues);
    const maximum = Math.max(...numericValues);
    
    // Calculate trend using linear regression
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    values.forEach((point, index) => {
      const x = index;
      const y = point.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const trend = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable';
    const trendStrength = Math.min(1, Math.abs(slope) * 100);
    
    // Simple forecast (linear extrapolation)
    const shortTermForecast = numericValues[numericValues.length - 1] + slope;
    
    return {
      metric: metricName,
      values,
      trend,
      trendStrength,
      volatility: standardDeviation,
      mean,
      standardDeviation,
      minimum,
      maximum,
      shortTermForecast,
      confidence: Math.max(0.1, Math.min(0.9, n / 100)), // Simple confidence based on data points
      calculatedAt: new Date()
    };
  }

  // Placeholder methods (would be implemented with actual data sources)
  private async getCurrentPortfolioState(): Promise<PortfolioState | null> {
    // Would get from portfolio manager
    return null;
  }

  private async getRiskLimits(): Promise<RiskLimits> {
    // Would get from configuration service
    return {} as RiskLimits;
  }

  private async estimatePortfolioVaR(positions: Position[]): Promise<number> {
    // Simplified VaR calculation
    return 0;
  }

  private async processAlerts(alerts: RiskAlert[]): Promise<void> {
    // Process and store alerts
    for (const alert of alerts) {
      this.activeAlerts.set(alert.id, alert);
      console.log(`Risk Alert: ${alert.title} - ${alert.message}`);
    }
  }

  // Additional placeholder methods...
  private async checkConcentrationLimits(positions: Position[], riskLimits: RiskLimits): Promise<RiskAlert[]> { return []; }
  private async checkSectorConcentration(positions: Position[]): Promise<ConcentrationAlert[]> { return []; }
  private async checkCorrelationConcentration(positions: Position[]): Promise<ConcentrationAlert[]> { return []; }
  private async getHighWaterMark(): Promise<number> { return 0; }
  private async updateHighWaterMark(value: number): Promise<void> { }
  private async getMaxHistoricalDrawdown(): Promise<number> { return 0; }
  private async calculateRecoveryMetrics(drawdown: number, portfolioState: PortfolioState): Promise<{ daysInDrawdown: number; estimatedRecoveryTime: number }> { return { daysInDrawdown: 0, estimatedRecoveryTime: 0 }; }
  private async calculateDrawdownTrend(): Promise<'increasing' | 'decreasing' | 'stable'> { return 'stable'; }
  private async generateDrawdownAlerts(drawdown: number, severity: string): Promise<RiskAlert[]> { return []; }
  private async generateSystemAlert(message: string, error: Error): Promise<void> { }
  private async getMetricValue(portfolioState: PortfolioState, metric: string): Promise<number> { return 0; }
  private shouldTriggerCircuitBreaker(breaker: CircuitBreaker, currentValue: number): boolean { return false; }
  private async executeCircuitBreakerAction(breaker: CircuitBreaker, portfolioState: PortfolioState): Promise<void> { }
  private async getRecentCircuitBreakerTriggers(): Promise<any[]> { return []; }
  private async storeRiskAssessment(assessment: PortfolioRiskAssessment): Promise<void> { }
}

// Additional interfaces for DrawdownStatus and ConcentrationAlert
interface DrawdownStatus {
  timestamp: Date;
  currentDrawdown: number;
  dailyDrawdown: number;
  maxDrawdown: number;
  highWaterMark: number;
  daysInDrawdown: number;
  estimatedRecoveryTime: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isInDrawdown: boolean;
  drawdownTrend: 'increasing' | 'decreasing' | 'stable';
  alerts: RiskAlert[];
}

interface ConcentrationAlert {
  id: string;
  timestamp: Date;
  type: 'position_concentration' | 'sector_concentration' | 'correlation_concentration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  symbol: string;
  currentConcentration: number;
  threshold: number;
  message: string;
  recommendation: string;
  portfolioImpact: number;
  riskScore: number;
}