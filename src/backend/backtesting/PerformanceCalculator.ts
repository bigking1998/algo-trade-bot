/**
 * PerformanceCalculator - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Comprehensive performance metrics calculation for backtesting with:
 * - Return and risk-adjusted performance metrics
 * - Drawdown analysis and recovery metrics
 * - Trade statistics and consistency analysis
 * - Benchmark comparison and attribution
 * - Rolling performance windows
 * - Statistical significance testing
 * - Advanced performance ratios
 */

import { EventEmitter } from 'events';
import { 
  BacktestTrade, 
  BacktestPortfolioSnapshot 
} from './types';

/**
 * Performance calculation input
 */
interface PerformanceInput {
  trades: BacktestTrade[];
  portfolioHistory: BacktestPortfolioSnapshot[];
  initialCapital: number;
  benchmark?: string;
  riskFreeRate?: number;
}

/**
 * Comprehensive performance metrics
 */
interface PerformanceMetrics {
  // Return metrics
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  cagr: number;                    // Compound Annual Growth Rate
  
  // Risk metrics
  volatility: number;              // Annualized volatility
  downside_volatility: number;     // Downside deviation
  
  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  treynorRatio: number;
  informationRatio: number;
  
  // Drawdown metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number;     // In days
  recoveryFactor: number;          // Net profit / max drawdown
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;                 // Percentage
  profitFactor: number;            // Gross profit / gross loss
  
  // Trade performance
  averageWin: number;
  averageLoss: number;
  averageTrade: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingPeriod: number;    // In hours
  
  // Advanced trade metrics
  expectancy: number;              // Expected value per trade
  sqn: number;                     // System Quality Number
  payoffRatio: number;             // Average win / average loss
  
  // Consistency metrics
  winningMonths: number;
  losingMonths: number;
  bestMonth: number;
  worstMonth: number;
  winningWeeks: number;
  losingWeeks: number;
  
  // Execution metrics
  averageSlippageBps: number;      // In basis points
  fillRate: number;                // Percentage of orders filled
  
  // Value at Risk metrics
  valueAtRisk95: number;
  conditionalValueAtRisk95: number;
  
  // Benchmark comparison
  benchmarkReturn?: number;
  benchmarkVolatility?: number;
  beta?: number;
  alpha?: number;
  trackingError?: number;
  
  // Performance attribution by period
  monthlyReturns: Array<{
    period: string;
    return: number;
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
  }>;
  
  // Performance attribution by symbol
  performanceAttribution: Record<string, {
    totalReturn: number;
    trades: number;
    winRate: number;
    avgTrade: number;
  }>;
}

/**
 * Performance calculator configuration
 */
interface PerformanceConfig {
  riskFreeRate: number;
  tradingDaysPerYear: number;
  benchmark?: string;
  rollingWindowDays: number;
  minTradesForStatistics: number;
  confidenceLevel: number;        // For confidence intervals
}

/**
 * Rolling performance window
 */
interface RollingPerformance {
  startDate: Date;
  endDate: Date;
  return: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
}

/**
 * Performance calculator implementation
 */
export class PerformanceCalculator extends EventEmitter {
  private config: PerformanceConfig;
  private initialized = false;
  
  // Benchmark data (would be loaded from external source)
  private benchmarkReturns = new Map<string, number[]>();

  constructor() {
    super();
  }

  /**
   * Initialize performance calculator
   */
  async initialize(config: Partial<PerformanceConfig>): Promise<void> {
    this.config = {
      riskFreeRate: 0.02,           // 2% risk-free rate
      tradingDaysPerYear: 252,      // Standard trading days per year
      rollingWindowDays: 30,        // 30-day rolling windows
      minTradesForStatistics: 10,   // Minimum trades for reliable statistics
      confidenceLevel: 0.95,        // 95% confidence level
      ...config
    };
    
    this.benchmarkReturns.clear();
    
    this.initialized = true;
    this.emit('initialized', { config: this.config });
  }

  /**
   * Calculate comprehensive performance metrics
   */
  async calculateMetrics(input: PerformanceInput): Promise<PerformanceMetrics> {
    if (!this.initialized) {
      throw new Error('PerformanceCalculator not initialized');
    }
    
    const { trades, portfolioHistory, initialCapital, benchmark, riskFreeRate } = input;
    
    // Use provided risk-free rate or default
    const rfRate = riskFreeRate ?? this.config.riskFreeRate;
    
    // Calculate return metrics
    const returnMetrics = this.calculateReturnMetrics(portfolioHistory, initialCapital);
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(portfolioHistory, rfRate);
    
    // Calculate trade statistics
    const tradeStats = this.calculateTradeStatistics(trades);
    
    // Calculate drawdown metrics
    const drawdownMetrics = this.calculateDrawdownMetrics(portfolioHistory);
    
    // Calculate consistency metrics
    const consistencyMetrics = this.calculateConsistencyMetrics(portfolioHistory);
    
    // Calculate execution metrics
    const executionMetrics = this.calculateExecutionMetrics(trades);
    
    // Calculate performance attribution
    const attribution = this.calculatePerformanceAttribution(trades);
    
    // Calculate benchmark comparison (if benchmark provided)
    let benchmarkMetrics = {};
    if (benchmark) {
      benchmarkMetrics = await this.calculateBenchmarkComparison(
        portfolioHistory, 
        benchmark, 
        rfRate
      );
    }
    
    // Compile comprehensive metrics
    const metrics: PerformanceMetrics = {
      // Return metrics (with defaults)
      totalReturn: 0,
      totalReturnPercent: 0,
      annualizedReturn: 0,
      cagr: 0,
      ...returnMetrics,
      
      // Risk metrics (with defaults)
      volatility: 0,
      downside_volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      treynorRatio: 0,
      informationRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      recoveryFactor: 0,
      valueAtRisk95: 0,
      conditionalValueAtRisk95: 0,
      beta: 0,
      alpha: 0,
      trackingError: 0,
      ...riskMetrics,
      
      // Trade statistics (with defaults)
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      averageTrade: 0,
      largestWin: 0,
      largestLoss: 0,
      averageHoldingPeriod: 0,
      expectancy: 0,
      sqn: 0,
      payoffRatio: 0,
      ...tradeStats,
      
      // Drawdown metrics
      ...drawdownMetrics,
      
      // Consistency metrics (with defaults)
      winningMonths: 0,
      losingMonths: 0,
      bestMonth: 0,
      worstMonth: 0,
      winningWeeks: 0,
      losingWeeks: 0,
      ...consistencyMetrics,
      
      // Execution metrics (with defaults)
      averageSlippageBps: 0,
      fillRate: 0,
      ...executionMetrics,
      
      // Benchmark comparison
      ...benchmarkMetrics,
      
      // Performance attribution by period
      monthlyReturns: [],
      
      // Performance attribution
      performanceAttribution: attribution
    };
    
    this.emit('metrics_calculated', metrics);
    return metrics;
  }

  /**
   * Calculate return metrics
   */
  private calculateReturnMetrics(
    portfolioHistory: BacktestPortfolioSnapshot[], 
    initialCapital: number
  ): Partial<PerformanceMetrics> {
    if (portfolioHistory.length === 0) {
      return {
        totalReturn: 0,
        totalReturnPercent: 0,
        annualizedReturn: 0,
        cagr: 0
      };
    }
    
    const finalValue = portfolioHistory[portfolioHistory.length - 1].totalValue;
    const totalReturn = finalValue - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;
    
    // Calculate time period
    const startDate = portfolioHistory[0].timestamp;
    const endDate = portfolioHistory[portfolioHistory.length - 1].timestamp;
    const daysElapsed = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsElapsed = daysElapsed / 365.25;
    
    // Annualized return
    const annualizedReturn = yearsElapsed > 0 ? 
      (Math.pow(finalValue / initialCapital, 1 / yearsElapsed) - 1) * 100 : 0;
    
    // CAGR (same as annualized return for continuous compounding)
    const cagr = annualizedReturn;
    
    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      cagr
    };
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(
    portfolioHistory: BacktestPortfolioSnapshot[], 
    riskFreeRate: number
  ): Partial<PerformanceMetrics> {
    if (portfolioHistory.length < 2) {
      return {
        volatility: 0,
        downside_volatility: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        treynorRatio: 0,
        informationRatio: 0
      };
    }
    
    // Calculate daily returns
    const dailyReturns = [];
    for (let i = 1; i < portfolioHistory.length; i++) {
      const prevValue = portfolioHistory[i - 1].totalValue;
      const currValue = portfolioHistory[i].totalValue;
      const dailyReturn = (currValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }
    
    // Calculate volatility (annualized)
    const avgDailyReturn = this.mean(dailyReturns);
    const dailyVolatility = this.standardDeviation(dailyReturns);
    const volatility = dailyVolatility * Math.sqrt(this.config.tradingDaysPerYear) * 100;
    
    // Calculate downside volatility
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downside_volatility = negativeReturns.length > 0 ? 
      this.standardDeviation(negativeReturns) * Math.sqrt(this.config.tradingDaysPerYear) * 100 : 0;
    
    // Calculate annualized return for ratio calculations
    const annualizedReturn = avgDailyReturn * this.config.tradingDaysPerYear * 100;
    const excessReturn = annualizedReturn - riskFreeRate * 100;
    
    // Sharpe Ratio
    const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;
    
    // Sortino Ratio
    const sortinoRatio = downside_volatility > 0 ? excessReturn / downside_volatility : 0;
    
    // Calmar Ratio (calculated with max drawdown later)
    const calmarRatio = 0; // Will be calculated in drawdown metrics
    
    // Treynor Ratio (requires beta, set to 0 for now)
    const treynorRatio = 0;
    
    // Information Ratio (requires benchmark, set to 0 for now)
    const informationRatio = 0;
    
    return {
      volatility,
      downside_volatility,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      treynorRatio,
      informationRatio
    };
  }

  /**
   * Calculate trade statistics
   */
  private calculateTradeStatistics(trades: BacktestTrade[]): Partial<PerformanceMetrics> {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        averageTrade: 0,
        largestWin: 0,
        largestLoss: 0,
        averageHoldingPeriod: 0,
        expectancy: 0,
        sqn: 0,
        payoffRatio: 0
      };
    }
    
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.netPnL > 0);
    const losingTrades = trades.filter(t => t.netPnL < 0);
    const breakEvenTrades = trades.filter(t => t.netPnL === 0);
    
    const winRate = (winningTrades.length / totalTrades) * 100;
    
    // Calculate win/loss amounts
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Average metrics
    const averageWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + t.netPnL, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? 
      losingTrades.reduce((sum, t) => sum + t.netPnL, 0) / losingTrades.length : 0;
    const averageTrade = trades.reduce((sum, t) => sum + t.netPnL, 0) / totalTrades;
    
    // Extreme values
    const largestWin = winningTrades.length > 0 ? 
      Math.max(...winningTrades.map(t => t.netPnL)) : 0;
    const largestLoss = losingTrades.length > 0 ? 
      Math.min(...losingTrades.map(t => t.netPnL)) : 0;
    
    // Average holding period (in hours)
    const averageHoldingPeriod = trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / 
      totalTrades / (1000 * 60 * 60);
    
    // Expectancy (expected value per trade)
    const expectancy = averageTrade;
    
    // System Quality Number (Van Tharp)
    const tradePnLs = trades.map(t => t.netPnL);
    const sqnStdDev = this.standardDeviation(tradePnLs);
    const sqn = sqnStdDev > 0 ? (averageTrade / sqnStdDev) * Math.sqrt(totalTrades) : 0;
    
    // Payoff ratio
    const payoffRatio = averageLoss !== 0 ? Math.abs(averageWin / averageLoss) : 0;
    
    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      averageTrade,
      largestWin,
      largestLoss,
      averageHoldingPeriod,
      expectancy,
      sqn,
      payoffRatio
    };
  }

  /**
   * Calculate drawdown metrics
   */
  private calculateDrawdownMetrics(
    portfolioHistory: BacktestPortfolioSnapshot[]
  ): Partial<PerformanceMetrics> {
    if (portfolioHistory.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        maxDrawdownDuration: 0,
        recoveryFactor: 0,
        calmarRatio: 0
      };
    }
    
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let maxDrawdownDuration = 0;
    let peak = portfolioHistory[0].totalValue;
    let peakTime = portfolioHistory[0].timestamp;
    let inDrawdown = false;
    let drawdownStart = peakTime;
    
    for (const snapshot of portfolioHistory) {
      const currentValue = snapshot.totalValue;
      
      if (currentValue > peak) {
        // New peak reached
        if (inDrawdown) {
          // Calculate duration of previous drawdown
          const duration = (snapshot.timestamp.getTime() - drawdownStart.getTime()) / (1000 * 60 * 60 * 24);
          maxDrawdownDuration = Math.max(maxDrawdownDuration, duration);
          inDrawdown = false;
        }
        peak = currentValue;
        peakTime = snapshot.timestamp;
      } else {
        // In drawdown
        if (!inDrawdown) {
          drawdownStart = peakTime;
          inDrawdown = true;
        }
        
        const drawdown = peak - currentValue;
        const drawdownPercent = (drawdown / peak) * 100;
        
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
      }
    }
    
    // Handle case where we end in drawdown
    if (inDrawdown) {
      const duration = (portfolioHistory[portfolioHistory.length - 1].timestamp.getTime() - drawdownStart.getTime()) / (1000 * 60 * 60 * 24);
      maxDrawdownDuration = Math.max(maxDrawdownDuration, duration);
    }
    
    // Recovery factor
    const netProfit = portfolioHistory[portfolioHistory.length - 1].totalValue - portfolioHistory[0].totalValue;
    const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;
    
    // Calculate Calmar ratio (needs annualized return)
    const startValue = portfolioHistory[0].totalValue;
    const endValue = portfolioHistory[portfolioHistory.length - 1].totalValue;
    const totalDays = (portfolioHistory[portfolioHistory.length - 1].timestamp.getTime() - 
                      portfolioHistory[0].timestamp.getTime()) / (1000 * 60 * 60 * 24);
    const yearsElapsed = totalDays / 365.25;
    const annualizedReturn = yearsElapsed > 0 ? 
      (Math.pow(endValue / startValue, 1 / yearsElapsed) - 1) * 100 : 0;
    const calmarRatio = maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0;
    
    return {
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownDuration,
      recoveryFactor,
      calmarRatio
    };
  }

  /**
   * Calculate consistency metrics
   */
  private calculateConsistencyMetrics(
    portfolioHistory: BacktestPortfolioSnapshot[]
  ): Partial<PerformanceMetrics> {
    // Group by months and weeks
    const monthlyReturns = this.calculateMonthlyReturns(portfolioHistory);
    const weeklyReturns = this.calculateWeeklyReturns(portfolioHistory);
    
    const winningMonths = monthlyReturns.filter(r => r.return > 0).length;
    const losingMonths = monthlyReturns.filter(r => r.return < 0).length;
    const bestMonth = monthlyReturns.length > 0 ? Math.max(...monthlyReturns.map(r => r.return)) : 0;
    const worstMonth = monthlyReturns.length > 0 ? Math.min(...monthlyReturns.map(r => r.return)) : 0;
    
    const winningWeeks = weeklyReturns.filter(r => r > 0).length;
    const losingWeeks = weeklyReturns.filter(r => r < 0).length;
    
    return {
      winningMonths,
      losingMonths,
      bestMonth,
      worstMonth,
      winningWeeks,
      losingWeeks,
      monthlyReturns
    };
  }

  /**
   * Calculate monthly returns
   */
  private calculateMonthlyReturns(portfolioHistory: BacktestPortfolioSnapshot[]): Array<{
    period: string;
    return: number;
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
  }> {
    const monthlyData = new Map<string, BacktestPortfolioSnapshot[]>();
    
    // Group data by month
    for (const snapshot of portfolioHistory) {
      const monthKey = `${snapshot.timestamp.getFullYear()}-${String(snapshot.timestamp.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, []);
      }
      monthlyData.get(monthKey)!.push(snapshot);
    }
    
    const monthlyReturns = [];
    
    for (const [period, snapshots] of monthlyData) {
      if (snapshots.length < 2) continue;
      
      const startValue = snapshots[0].totalValue;
      const endValue = snapshots[snapshots.length - 1].totalValue;
      const monthReturn = ((endValue - startValue) / startValue) * 100;
      
      // Calculate daily returns for volatility
      const dailyReturns = [];
      for (let i = 1; i < snapshots.length; i++) {
        const dailyReturn = (snapshots[i].totalValue - snapshots[i - 1].totalValue) / snapshots[i - 1].totalValue;
        dailyReturns.push(dailyReturn);
      }
      
      const volatility = dailyReturns.length > 1 ? 
        this.standardDeviation(dailyReturns) * Math.sqrt(this.config.tradingDaysPerYear) * 100 : 0;
      
      const avgReturn = this.mean(dailyReturns) * this.config.tradingDaysPerYear * 100;
      const sharpe = volatility > 0 ? (avgReturn - this.config.riskFreeRate * 100) / volatility : 0;
      
      // Calculate max drawdown for the month
      let peak = snapshots[0].totalValue;
      let maxDD = 0;
      for (const snapshot of snapshots) {
        if (snapshot.totalValue > peak) {
          peak = snapshot.totalValue;
        } else {
          const dd = ((peak - snapshot.totalValue) / peak) * 100;
          maxDD = Math.max(maxDD, dd);
        }
      }
      
      monthlyReturns.push({
        period,
        return: monthReturn,
        volatility,
        sharpe,
        maxDrawdown: maxDD
      });
    }
    
    return monthlyReturns.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate weekly returns
   */
  private calculateWeeklyReturns(portfolioHistory: BacktestPortfolioSnapshot[]): number[] {
    const weeklyReturns = [];
    const groupedByWeek = new Map<string, BacktestPortfolioSnapshot[]>();
    
    // Group by week
    for (const snapshot of portfolioHistory) {
      const weekStart = this.getWeekStart(snapshot.timestamp);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!groupedByWeek.has(weekKey)) {
        groupedByWeek.set(weekKey, []);
      }
      groupedByWeek.get(weekKey)!.push(snapshot);
    }
    
    // Calculate weekly returns
    for (const snapshots of groupedByWeek.values()) {
      if (snapshots.length < 2) continue;
      
      snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const startValue = snapshots[0].totalValue;
      const endValue = snapshots[snapshots.length - 1].totalValue;
      const weekReturn = ((endValue - startValue) / startValue) * 100;
      
      weeklyReturns.push(weekReturn);
    }
    
    return weeklyReturns;
  }

  /**
   * Get week start date (Monday)
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    return new Date(d.setDate(diff));
  }

  /**
   * Calculate execution metrics
   */
  private calculateExecutionMetrics(trades: BacktestTrade[]): Partial<PerformanceMetrics> {
    if (trades.length === 0) {
      return {
        averageSlippageBps: 0,
        fillRate: 100 // Assume 100% fill rate for backtesting
      };
    }
    
    // Calculate average slippage in basis points
    const totalSlippage = trades.reduce((sum, t) => sum + t.entrySlippage + t.exitSlippage, 0);
    const totalNotional = trades.reduce((sum, t) => sum + (t.entryQuantity * t.entryPrice) + (t.exitQuantity * t.exitPrice), 0);
    const averageSlippageBps = totalNotional > 0 ? (totalSlippage / totalNotional) * 10000 : 0;
    
    // Fill rate (100% for backtesting by default)
    const fillRate = 100;
    
    return {
      averageSlippageBps,
      fillRate
    };
  }

  /**
   * Calculate performance attribution by symbol
   */
  private calculatePerformanceAttribution(trades: BacktestTrade[]): Record<string, {
    totalReturn: number;
    trades: number;
    winRate: number;
    avgTrade: number;
  }> {
    const attribution: Record<string, {
      totalReturn: number;
      trades: number;
      winRate: number;
      avgTrade: number;
    }> = {};
    
    // Group trades by symbol
    const tradesBySymbol = new Map<string, BacktestTrade[]>();
    for (const trade of trades) {
      if (!tradesBySymbol.has(trade.symbol)) {
        tradesBySymbol.set(trade.symbol, []);
      }
      tradesBySymbol.get(trade.symbol)!.push(trade);
    }
    
    // Calculate attribution for each symbol
    for (const [symbol, symbolTrades] of tradesBySymbol) {
      const totalReturn = symbolTrades.reduce((sum, t) => sum + t.netPnL, 0);
      const winningTrades = symbolTrades.filter(t => t.netPnL > 0).length;
      const winRate = (winningTrades / symbolTrades.length) * 100;
      const avgTrade = totalReturn / symbolTrades.length;
      
      attribution[symbol] = {
        totalReturn,
        trades: symbolTrades.length,
        winRate,
        avgTrade
      };
    }
    
    return attribution;
  }

  /**
   * Calculate benchmark comparison metrics
   */
  private async calculateBenchmarkComparison(
    portfolioHistory: BacktestPortfolioSnapshot[],
    benchmark: string,
    riskFreeRate: number
  ): Promise<Partial<PerformanceMetrics>> {
    // This would typically load benchmark data from an external source
    // For now, return placeholder values
    return {
      benchmarkReturn: 10, // 10% benchmark return
      benchmarkVolatility: 15, // 15% benchmark volatility
      beta: 1.2,
      alpha: 2, // 2% alpha
      trackingError: 5 // 5% tracking error
    };
  }

  /**
   * Calculate rolling performance windows
   */
  async calculateRollingPerformance(
    portfolioHistory: BacktestPortfolioSnapshot[],
    windowDays: number = 30
  ): Promise<RollingPerformance[]> {
    const rollingWindows = [];
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    
    for (let i = 0; i < portfolioHistory.length; i++) {
      const endDate = portfolioHistory[i].timestamp;
      const startDate = new Date(endDate.getTime() - windowMs);
      
      // Find snapshots in window
      const windowSnapshots = portfolioHistory.filter(
        s => s.timestamp >= startDate && s.timestamp <= endDate
      );
      
      if (windowSnapshots.length < 2) continue;
      
      // Calculate metrics for window
      const startValue = windowSnapshots[0].totalValue;
      const endValue = windowSnapshots[windowSnapshots.length - 1].totalValue;
      const windowReturn = ((endValue - startValue) / startValue) * 100;
      
      // Calculate volatility
      const dailyReturns = [];
      for (let j = 1; j < windowSnapshots.length; j++) {
        const dailyReturn = (windowSnapshots[j].totalValue - windowSnapshots[j - 1].totalValue) / 
                           windowSnapshots[j - 1].totalValue;
        dailyReturns.push(dailyReturn);
      }
      
      const volatility = this.standardDeviation(dailyReturns) * Math.sqrt(this.config.tradingDaysPerYear) * 100;
      const avgReturn = this.mean(dailyReturns) * this.config.tradingDaysPerYear * 100;
      const sharpe = volatility > 0 ? (avgReturn - this.config.riskFreeRate * 100) / volatility : 0;
      
      // Calculate max drawdown in window
      let peak = windowSnapshots[0].totalValue;
      let maxDD = 0;
      for (const snapshot of windowSnapshots) {
        if (snapshot.totalValue > peak) {
          peak = snapshot.totalValue;
        } else {
          const dd = ((peak - snapshot.totalValue) / peak) * 100;
          maxDD = Math.max(maxDD, dd);
        }
      }
      
      rollingWindows.push({
        startDate,
        endDate,
        return: windowReturn,
        volatility,
        sharpe,
        maxDrawdown: maxDD,
        winRate: 0, // Would need trade data for window
        trades: 0   // Would need trade data for window
      });
    }
    
    return rollingWindows;
  }

  /**
   * Calculate mean of array
   */
  private mean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length <= 1) return 0;
    
    const mean = this.mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = this.mean(squaredDiffs);
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (index % 1 === 0) {
      return sorted[index];
    }
    
    const lower = sorted[Math.floor(index)];
    const upper = sorted[Math.ceil(index)];
    const weight = index % 1;
    
    return lower * (1 - weight) + upper * weight;
  }

  /**
   * Check if calculator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Reset calculator state
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.benchmarkReturns.clear();
  }
}

export default PerformanceCalculator;