# Advanced Backtesting Engine Architecture
## Historical Strategy Validation & Optimization System

*High-Performance Event-Driven Backtesting with Comprehensive Analytics*

---

## Overview

This document outlines the architecture for our advanced backtesting engine, designed to provide accurate historical strategy validation with realistic market conditions, comprehensive performance analytics, and sophisticated optimization capabilities.

## Core Design Principles

### 1. Event-Driven Architecture
- **Time-ordered processing**: Strict chronological event processing to prevent lookahead bias
- **Realistic execution simulation**: Account for slippage, fees, and market impact
- **Multi-timeframe support**: Handle strategies using multiple timeframes simultaneously
- **Memory efficiency**: Stream processing for large datasets without memory overflow

### 2. Statistical Rigor
- **Out-of-sample testing**: Automatic train/validation/test splits
- **Walk-forward analysis**: Dynamic optimization with rolling windows
- **Monte Carlo simulation**: Statistical confidence intervals for results
- **Bootstrap analysis**: Robustness testing across different market periods

### 3. Performance Focus
- **Vectorized calculations**: Leverage efficient array operations
- **Parallel processing**: Multi-threaded execution for parameter optimization
- **Incremental updates**: Efficient indicator recalculation
- **Result caching**: Avoid redundant computations

---

## Architecture Components

### 1. Core Backtesting Engine

```typescript
// Main Backtesting Engine
class BacktestingEngine {
  private portfolio: BacktestPortfolio;
  private broker: BacktestBroker;
  private dataProvider: HistoricalDataProvider;
  private metricsCalculator: PerformanceMetricsCalculator;
  private eventProcessor: EventProcessor;
  
  constructor(config: BacktestConfig) {
    this.portfolio = new BacktestPortfolio(config.initialCapital);
    this.broker = new BacktestBroker(config.commission, config.slippage);
    this.dataProvider = new HistoricalDataProvider();
    this.metricsCalculator = new PerformanceMetricsCalculator();
    this.eventProcessor = new EventProcessor();
  }
  
  async runBacktest(strategy: BaseStrategy, config: BacktestConfig): Promise<BacktestResult> {
    // Initialize backtest
    await this.initialize(strategy, config);
    
    // Load historical data
    const marketData = await this.loadHistoricalData(config);
    
    // Generate event timeline
    const events = this.generateEventTimeline(marketData);
    
    // Process events chronologically
    const results = await this.processEvents(strategy, events);
    
    // Calculate comprehensive metrics
    const metrics = await this.calculateMetrics(results);
    
    // Generate detailed analysis
    const analysis = await this.generateAnalysis(results, metrics);
    
    return {
      config,
      results,
      metrics,
      analysis,
      executionTime: Date.now() - this.startTime
    };
  }
  
  private async processEvents(
    strategy: BaseStrategy, 
    events: BacktestEvent[]
  ): Promise<BacktestResults> {
    const trades: Trade[] = [];
    const portfolioHistory: PortfolioSnapshot[] = [];
    const signals: SignalEvent[] = [];
    
    let warmupComplete = false;
    const warmupPeriod = this.getWarmupPeriod(strategy);
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const currentTime = new Date(event.timestamp);
      
      // Check if warmup period is complete
      if (!warmupComplete && i >= warmupPeriod) {
        warmupComplete = true;
      }
      
      try {
        // Update market data
        await this.updateMarketData(event);
        
        // Execute strategy
        if (warmupComplete) {
          const strategySignals = await this.executeStrategy(strategy, event);
          signals.push(...strategySignals);
          
          // Process trading signals
          for (const signal of strategySignals) {
            const trade = await this.processSignal(signal, currentTime);
            if (trade) trades.push(trade);
          }
        }
        
        // Update portfolio
        await this.updatePortfolio(currentTime);
        
        // Take portfolio snapshot (configurable frequency)
        if (this.shouldTakeSnapshot(i)) {
          portfolioHistory.push(this.portfolio.getSnapshot());
        }
        
        // Update progress (for UI)
        this.updateProgress(i, events.length);
        
      } catch (error) {
        console.error(`Backtest error at ${currentTime}:`, error);
        // Continue processing or fail based on configuration
        if (this.config.stopOnError) throw error;
      }
    }
    
    return {
      trades,
      portfolioHistory,
      signals,
      finalPortfolioValue: this.portfolio.getTotalValue(),
      totalBars: events.length,
      warmupBars: warmupPeriod
    };
  }
  
  private async executeStrategy(
    strategy: BaseStrategy, 
    event: BacktestEvent
  ): Promise<SignalEvent[]> {
    // Get current market data window
    const dataWindow = this.getDataWindow(event.symbol, strategy.timeframe);
    
    if (!dataWindow || dataWindow.length < this.getMinimumBars(strategy)) {
      return [];
    }
    
    // Convert to strategy data format
    const dataframe = this.createDataFrame(dataWindow);
    
    // Execute strategy pipeline
    const indicatorDataframe = await strategy.populateIndicators(dataframe);
    const entryDataframe = await strategy.populateEntryTrend(indicatorDataframe);
    const signalDataframe = await strategy.populateExitTrend(entryDataframe);
    
    // Extract signals
    return this.extractSignals(signalDataframe, event.timestamp, strategy.name);
  }
  
  private async processSignal(signal: SignalEvent, currentTime: Date): Promise<Trade | null> {
    // Validate signal
    if (!this.isValidSignal(signal)) return null;
    
    // Check risk management
    if (!this.riskManager.approveSignal(signal, this.portfolio)) return null;
    
    // Calculate position size
    const positionSize = this.calculatePositionSize(signal);
    if (positionSize <= 0) return null;
    
    // Create order
    const order: BacktestOrder = {
      id: this.generateOrderId(),
      symbol: signal.symbol,
      side: signal.side,
      type: signal.orderType || 'MARKET',
      quantity: positionSize,
      price: signal.price,
      timestamp: currentTime,
      strategy: signal.strategy
    };
    
    // Execute order through broker
    const execution = await this.broker.executeOrder(order, this.getMarketPrice(signal.symbol));
    
    if (execution.status === 'FILLED') {
      // Create trade record
      const trade = this.createTrade(execution, signal);
      
      // Update portfolio
      this.portfolio.addTrade(trade);
      
      return trade;
    }
    
    return null;
  }
}

// Backtest Configuration
interface BacktestConfig {
  // Strategy Configuration
  strategyConfig: StrategyConfig;
  
  // Market Data
  symbol: string;
  timeframe: Timeframe;
  startDate: Date;
  endDate: Date;
  
  // Capital & Risk
  initialCapital: number;
  
  // Trading Costs
  commission: number; // 0.001 = 0.1%
  slippage: number;   // 0.0005 = 0.05%
  
  // Execution Settings
  orderType: 'MARKET' | 'LIMIT';
  fillMode: 'NEXT_BAR' | 'SAME_BAR' | 'REALISTIC';
  
  // Advanced Settings
  enableSlippage: boolean;
  enableCommission: boolean;
  
  // Data Quality
  minimumVolume: number;
  maxGapPercent: number;
  
  // Processing Options
  warmupBars: number;
  maxMemoryUsage: number; // MB
  stopOnError: boolean;
  
  // Output Options
  saveTradeDetails: boolean;
  savePortfolioSnapshots: boolean;
  generateReports: boolean;
}
```

### 2. Historical Data Management

```typescript
// Historical Data Provider
class HistoricalDataProvider {
  private cache = new Map<string, CachedData>();
  private db = DatabaseManager.getInstance();
  
  async loadData(config: BacktestConfig): Promise<MarketData> {
    const cacheKey = this.getCacheKey(config);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (this.isCacheValid(cached, config)) {
        return cached.data;
      }
    }
    
    // Load from database
    let data = await this.loadFromDatabase(config);
    
    // If insufficient data, fetch from external sources
    if (this.isDataIncomplete(data, config)) {
      data = await this.supplementData(data, config);
    }
    
    // Validate and clean data
    data = this.validateAndCleanData(data, config);
    
    // Cache the data
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      config
    });
    
    return data;
  }
  
  private async loadFromDatabase(config: BacktestConfig): Promise<MarketData> {
    const repository = new MarketDataRepository();
    
    const candles = await repository.getHistoricalData(
      config.symbol,
      config.timeframe,
      config.startDate,
      config.endDate,
      10000 // Large limit for backtesting
    );
    
    return {
      symbol: config.symbol,
      timeframe: config.timeframe,
      candles,
      startDate: config.startDate,
      endDate: config.endDate
    };
  }
  
  private async supplementData(
    existingData: MarketData,
    config: BacktestConfig
  ): Promise<MarketData> {
    // Find gaps in data
    const gaps = this.findDataGaps(existingData.candles, config);
    
    // Fetch missing data from external sources
    const supplementalData: DydxCandle[] = [];
    
    for (const gap of gaps) {
      try {
        // Try dYdX first, then fallback to Binance/OKX
        const gapData = await this.fetchExternalData(
          config.symbol,
          config.timeframe,
          gap.start,
          gap.end
        );
        supplementalData.push(...gapData);
      } catch (error) {
        console.warn(`Failed to fetch data for gap ${gap.start} - ${gap.end}:`, error);
      }
    }
    
    // Merge and sort data
    const allCandles = [...existingData.candles, ...supplementalData]
      .sort((a, b) => a.time - b.time);
    
    // Store supplemental data for future use
    if (supplementalData.length > 0) {
      await new MarketDataRepository().storeCandles(
        config.symbol,
        config.timeframe,
        supplementalData
      );
    }
    
    return {
      ...existingData,
      candles: allCandles
    };
  }
  
  private validateAndCleanData(data: MarketData, config: BacktestConfig): MarketData {
    const cleanCandles = data.candles.filter(candle => {
      // Remove invalid candles
      if (candle.high < candle.low) return false;
      if (candle.open <= 0 || candle.close <= 0) return false;
      if (candle.high <= 0 || candle.low <= 0) return false;
      
      // Check volume threshold
      if (config.minimumVolume && candle.volume < config.minimumVolume) return false;
      
      return true;
    });
    
    // Detect and handle gaps
    const processedCandles = this.handleDataGaps(cleanCandles, config);
    
    return {
      ...data,
      candles: processedCandles
    };
  }
  
  private handleDataGaps(candles: DydxCandle[], config: BacktestConfig): DydxCandle[] {
    if (candles.length <= 1) return candles;
    
    const result: DydxCandle[] = [candles[0]];
    const timeframeMs = this.getTimeframeMilliseconds(config.timeframe);
    
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const current = candles[i];
      const gap = current.time - prev.time;
      
      // If gap is larger than expected timeframe
      if (gap > timeframeMs * 1.5) {
        const gapPercent = Math.abs(current.open - prev.close) / prev.close;
        
        // If gap is significant, may indicate data issue
        if (gapPercent > config.maxGapPercent) {
          console.warn(`Large price gap detected: ${gapPercent * 100}% at ${new Date(current.time)}`);
        }
        
        // Option: Fill gaps with synthetic data or mark them
        // For now, we'll keep the gap but flag it
        current.metadata = { ...current.metadata, afterGap: true };
      }
      
      result.push(current);
    }
    
    return result;
  }
}

// Event Processing System
class EventProcessor {
  generateEventTimeline(marketData: MarketData): BacktestEvent[] {
    const events: BacktestEvent[] = [];
    
    // Create market data events
    for (const candle of marketData.candles) {
      events.push({
        type: 'MARKET_DATA',
        timestamp: candle.time,
        symbol: marketData.symbol,
        data: candle
      });
    }
    
    // Sort events chronologically
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    return events;
  }
}

interface BacktestEvent {
  type: 'MARKET_DATA' | 'ORDER_FILL' | 'STRATEGY_SIGNAL';
  timestamp: number;
  symbol: string;
  data: any;
}
```

### 3. Portfolio & Broker Simulation

```typescript
// Backtest Portfolio Management
class BacktestPortfolio {
  private cash: number;
  private positions = new Map<string, Position>();
  private trades: Trade[] = [];
  private snapshots: PortfolioSnapshot[] = [];
  
  constructor(private initialCapital: number) {
    this.cash = initialCapital;
  }
  
  getTotalValue(): number {
    let totalValue = this.cash;
    
    for (const [symbol, position] of this.positions) {
      const marketPrice = this.getMarketPrice(symbol);
      totalValue += position.quantity * marketPrice;
    }
    
    return totalValue;
  }
  
  addTrade(trade: Trade): void {
    this.trades.push(trade);
    
    // Update position
    const existing = this.positions.get(trade.symbol);
    
    if (existing) {
      // Update existing position
      const newQuantity = trade.side === 'BUY' 
        ? existing.quantity + trade.quantity
        : existing.quantity - trade.quantity;
      
      if (Math.abs(newQuantity) < 1e-8) {
        // Position closed
        this.positions.delete(trade.symbol);
      } else {
        existing.quantity = newQuantity;
        existing.avgPrice = this.calculateNewAvgPrice(existing, trade);
        existing.lastUpdate = new Date(trade.entryTime);
      }
    } else {
      // New position
      this.positions.set(trade.symbol, {
        symbol: trade.symbol,
        quantity: trade.side === 'BUY' ? trade.quantity : -trade.quantity,
        avgPrice: trade.entryPrice,
        marketPrice: trade.entryPrice,
        unrealizedPnl: 0,
        lastUpdate: new Date(trade.entryTime)
      });
    }
    
    // Update cash
    const tradeValue = trade.quantity * trade.entryPrice;
    this.cash += trade.side === 'BUY' ? -tradeValue - trade.fees : tradeValue - trade.fees;
  }
  
  getSnapshot(): PortfolioSnapshot {
    const totalValue = this.getTotalValue();
    const positions = Array.from(this.positions.values());
    
    return {
      timestamp: Date.now(),
      totalValue,
      cash: this.cash,
      positions: positions.map(pos => ({ ...pos })),
      unrealizedPnl: this.calculateUnrealizedPnl(),
      realizedPnl: this.calculateRealizedPnl(),
      drawdown: this.calculateDrawdown(totalValue)
    };
  }
  
  private calculateUnrealizedPnl(): number {
    let unrealized = 0;
    
    for (const [symbol, position] of this.positions) {
      const marketPrice = this.getMarketPrice(symbol);
      const pnl = (marketPrice - position.avgPrice) * position.quantity;
      unrealized += pnl;
    }
    
    return unrealized;
  }
  
  private calculateRealizedPnl(): number {
    return this.trades
      .filter(trade => trade.pnl !== undefined)
      .reduce((sum, trade) => sum + trade.pnl!, 0);
  }
  
  private calculateDrawdown(currentValue: number): number {
    // Calculate running maximum and drawdown
    const snapshots = this.snapshots;
    if (snapshots.length === 0) return 0;
    
    const peak = Math.max(...snapshots.map(s => s.totalValue), currentValue);
    return (peak - currentValue) / peak;
  }
}

// Broker Simulation (Order Execution)
class BacktestBroker {
  private orderHistory: OrderExecution[] = [];
  
  constructor(
    private commission: number,
    private slippage: number
  ) {}
  
  async executeOrder(order: BacktestOrder, marketPrice: number): Promise<OrderExecution> {
    // Calculate execution price with slippage
    const slippageAmount = this.calculateSlippage(order, marketPrice);
    const executionPrice = order.side === 'BUY' 
      ? marketPrice + slippageAmount
      : marketPrice - slippageAmount;
    
    // Calculate fees
    const fees = this.calculateFees(order.quantity, executionPrice);
    
    // Simulate order execution
    const execution: OrderExecution = {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: executionPrice,
      fees,
      timestamp: order.timestamp,
      status: 'FILLED',
      fillTime: order.timestamp // Assume immediate fill for backtesting
    };
    
    this.orderHistory.push(execution);
    
    return execution;
  }
  
  private calculateSlippage(order: BacktestOrder, marketPrice: number): number {
    // Simple slippage model - could be enhanced with volume-based slippage
    const baseSlippage = marketPrice * this.slippage;
    
    // Increase slippage for larger orders (simplified market impact)
    const sizeMultiplier = Math.log10(order.quantity * marketPrice / 10000 + 1);
    
    return baseSlippage * sizeMultiplier;
  }
  
  private calculateFees(quantity: number, price: number): number {
    return quantity * price * this.commission;
  }
}

interface BacktestOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  timestamp: number;
  strategy: string;
}

interface OrderExecution {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees: number;
  timestamp: number;
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED';
  fillTime: number;
}
```

### 4. Performance Metrics Calculator

```typescript
// Comprehensive Performance Metrics
class PerformanceMetricsCalculator {
  calculateMetrics(
    trades: Trade[],
    portfolioHistory: PortfolioSnapshot[],
    initialCapital: number,
    benchmarkReturns?: number[]
  ): PerformanceMetrics {
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    
    if (closedTrades.length === 0) {
      return this.getEmptyMetrics(initialCapital);
    }
    
    return {
      // Basic Metrics
      totalTrades: trades.length,
      winningTrades: closedTrades.filter(t => t.pnl! > 0).length,
      losingTrades: closedTrades.filter(t => t.pnl! <= 0).length,
      winRate: this.calculateWinRate(closedTrades),
      
      // Return Metrics
      totalReturn: this.calculateTotalReturn(portfolioHistory, initialCapital),
      annualizedReturn: this.calculateAnnualizedReturn(portfolioHistory, initialCapital),
      volatility: this.calculateVolatility(portfolioHistory),
      
      // Risk Metrics
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      maxDrawdownDuration: this.calculateMaxDrawdownDuration(portfolioHistory),
      sharpeRatio: this.calculateSharpeRatio(portfolioHistory),
      sortinoRatio: this.calculateSortinoRatio(portfolioHistory),
      calmarRatio: this.calculateCalmarRatio(portfolioHistory),
      
      // Trading Statistics
      profitFactor: this.calculateProfitFactor(closedTrades),
      averageWin: this.calculateAverageWin(closedTrades),
      averageLoss: this.calculateAverageLoss(closedTrades),
      largestWin: Math.max(...closedTrades.map(t => t.pnl!)),
      largestLoss: Math.min(...closedTrades.map(t => t.pnl!)),
      
      // Advanced Risk Metrics
      var95: this.calculateVaR(portfolioHistory, 0.95),
      cvar95: this.calculateCVaR(portfolioHistory, 0.95),
      
      // Market Correlation (if benchmark provided)
      beta: benchmarkReturns ? this.calculateBeta(portfolioHistory, benchmarkReturns) : undefined,
      alpha: benchmarkReturns ? this.calculateAlpha(portfolioHistory, benchmarkReturns) : undefined,
      correlation: benchmarkReturns ? this.calculateCorrelation(portfolioHistory, benchmarkReturns) : undefined,
      
      // Trade Duration Analysis
      avgTradeDuration: this.calculateAvgTradeDuration(closedTrades),
      maxTradeDuration: this.calculateMaxTradeDuration(closedTrades),
      
      // Additional Metrics
      recovery: this.calculateRecovery(portfolioHistory),
      stability: this.calculateStability(portfolioHistory),
      consistency: this.calculateConsistency(portfolioHistory)
    };
  }
  
  private calculateSharpeRatio(portfolioHistory: PortfolioSnapshot[]): number {
    const returns = this.calculateReturns(portfolioHistory);
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = this.calculateStdDev(returns);
    
    // Assuming risk-free rate of 2% annually, converted to period return
    const riskFreeRate = 0.02 / 252; // Daily risk-free rate
    
    return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
  }
  
  private calculateSortinoRatio(portfolioHistory: PortfolioSnapshot[]): number {
    const returns = this.calculateReturns(portfolioHistory);
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downside = returns.filter(r => r < 0);
    
    if (downside.length === 0) return Infinity;
    
    const downsideDeviation = Math.sqrt(
      downside.reduce((sum, r) => sum + r * r, 0) / downside.length
    );
    
    const riskFreeRate = 0.02 / 252;
    return (avgReturn - riskFreeRate) / downsideDeviation;
  }
  
  private calculateMaxDrawdown(portfolioHistory: PortfolioSnapshot[]): number {
    if (portfolioHistory.length === 0) return 0;
    
    let maxDrawdown = 0;
    let peak = portfolioHistory[0].totalValue;
    
    for (const snapshot of portfolioHistory) {
      if (snapshot.totalValue > peak) {
        peak = snapshot.totalValue;
      }
      
      const drawdown = (peak - snapshot.totalValue) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }
  
  private calculateVaR(portfolioHistory: PortfolioSnapshot[], confidence: number): number {
    const returns = this.calculateReturns(portfolioHistory);
    if (returns.length === 0) return 0;
    
    returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * returns.length);
    
    return returns[index] || 0;
  }
  
  private calculateCVaR(portfolioHistory: PortfolioSnapshot[], confidence: number): number {
    const returns = this.calculateReturns(portfolioHistory);
    if (returns.length === 0) return 0;
    
    returns.sort((a, b) => a - b);
    const cutoff = Math.floor((1 - confidence) * returns.length);
    const tailReturns = returns.slice(0, cutoff);
    
    return tailReturns.length > 0 
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
      : 0;
  }
  
  private calculateBeta(
    portfolioHistory: PortfolioSnapshot[],
    benchmarkReturns: number[]
  ): number {
    const portfolioReturns = this.calculateReturns(portfolioHistory);
    
    if (portfolioReturns.length !== benchmarkReturns.length) {
      throw new Error('Portfolio and benchmark returns must have same length');
    }
    
    const avgPortfolio = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const avgBenchmark = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
    
    let covariance = 0;
    let variance = 0;
    
    for (let i = 0; i < portfolioReturns.length; i++) {
      const portfolioDiff = portfolioReturns[i] - avgPortfolio;
      const benchmarkDiff = benchmarkReturns[i] - avgBenchmark;
      
      covariance += portfolioDiff * benchmarkDiff;
      variance += benchmarkDiff * benchmarkDiff;
    }
    
    return variance === 0 ? 0 : covariance / variance;
  }
  
  private calculateReturns(portfolioHistory: PortfolioSnapshot[]): number[] {
    if (portfolioHistory.length <= 1) return [];
    
    const returns: number[] = [];
    
    for (let i = 1; i < portfolioHistory.length; i++) {
      const prevValue = portfolioHistory[i - 1].totalValue;
      const currentValue = portfolioHistory[i].totalValue;
      
      const return_ = (currentValue - prevValue) / prevValue;
      returns.push(return_);
    }
    
    return returns;
  }
  
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }
}

interface PerformanceMetrics {
  // Basic Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Return Metrics
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  
  // Risk Metrics
  maxDrawdown: number;
  maxDrawdownDuration: number; // in days
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Trading Performance
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  
  // Advanced Risk
  var95: number; // Value at Risk 95%
  cvar95: number; // Conditional Value at Risk 95%
  
  // Market Correlation
  beta?: number;
  alpha?: number;
  correlation?: number;
  
  // Trade Analysis
  avgTradeDuration: number; // in hours
  maxTradeDuration: number; // in hours
  
  // Stability Metrics
  recovery: number; // Recovery factor
  stability: number; // R² of equity curve
  consistency: number; // Percentage of profitable months
}
```

### 5. Optimization Engine

```typescript
// Parameter Optimization System
class ParameterOptimizer {
  private results = new Map<string, OptimizationResult>();
  
  async optimize(
    strategy: BaseStrategy,
    parameterRanges: ParameterRange[],
    backtestConfig: BacktestConfig,
    optimizationConfig: OptimizationConfig
  ): Promise<OptimizationResults> {
    const startTime = Date.now();
    
    // Generate parameter combinations
    const parameterSets = this.generateParameterCombinations(parameterRanges);
    
    console.log(`Starting optimization with ${parameterSets.length} parameter combinations`);
    
    // Run backtests in parallel
    const results = await this.runParallelBacktests(
      strategy,
      parameterSets,
      backtestConfig,
      optimizationConfig
    );
    
    // Analyze results
    const analysis = this.analyzeOptimizationResults(results, optimizationConfig);
    
    return {
      totalCombinations: parameterSets.length,
      results,
      bestParameters: analysis.bestParameters,
      bestMetrics: analysis.bestMetrics,
      optimizationTime: Date.now() - startTime,
      analysis
    };
  }
  
  private async runParallelBacktests(
    strategy: BaseStrategy,
    parameterSets: ParameterSet[],
    backtestConfig: BacktestConfig,
    optimizationConfig: OptimizationConfig
  ): Promise<OptimizationResult[]> {
    const batchSize = optimizationConfig.maxConcurrency || 4;
    const results: OptimizationResult[] = [];
    
    // Process in batches to control resource usage
    for (let i = 0; i < parameterSets.length; i += batchSize) {
      const batch = parameterSets.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (params) => {
        try {
          // Create strategy with optimized parameters
          const optimizedStrategy = this.createOptimizedStrategy(strategy, params);
          
          // Run backtest
          const engine = new BacktestingEngine();
          const result = await engine.runBacktest(optimizedStrategy, backtestConfig);
          
          return {
            parameters: params,
            metrics: result.metrics,
            trades: result.results.trades,
            finalValue: result.results.finalPortfolioValue,
            objectiveValue: this.calculateObjectiveValue(result.metrics, optimizationConfig)
          };
        } catch (error) {
          console.error(`Backtest failed for parameters ${JSON.stringify(params)}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null) as OptimizationResult[]);
      
      // Progress update
      console.log(`Completed ${Math.min(i + batchSize, parameterSets.length)}/${parameterSets.length} backtests`);
    }
    
    return results;
  }
  
  private calculateObjectiveValue(
    metrics: PerformanceMetrics,
    config: OptimizationConfig
  ): number {
    switch (config.objective) {
      case 'SHARPE_RATIO':
        return metrics.sharpeRatio;
      case 'CALMAR_RATIO':
        return metrics.calmarRatio;
      case 'TOTAL_RETURN':
        return metrics.totalReturn;
      case 'PROFIT_FACTOR':
        return metrics.profitFactor;
      case 'CUSTOM':
        // Custom objective function
        return this.calculateCustomObjective(metrics, config.customWeights!);
      default:
        return metrics.sharpeRatio;
    }
  }
  
  private calculateCustomObjective(
    metrics: PerformanceMetrics,
    weights: ObjectiveWeights
  ): number {
    let score = 0;
    
    if (weights.sharpeRatio) score += metrics.sharpeRatio * weights.sharpeRatio;
    if (weights.totalReturn) score += metrics.totalReturn * weights.totalReturn;
    if (weights.maxDrawdown) score -= metrics.maxDrawdown * weights.maxDrawdown; // Negative because lower is better
    if (weights.winRate) score += metrics.winRate * weights.winRate;
    if (weights.profitFactor) score += metrics.profitFactor * weights.profitFactor;
    
    return score;
  }
  
  // Walk-Forward Analysis
  async walkForwardAnalysis(
    strategy: BaseStrategy,
    config: WalkForwardConfig
  ): Promise<WalkForwardResults> {
    const periods = this.generateWalkForwardPeriods(config);
    const results: WalkForwardPeriodResult[] = [];
    
    for (const period of periods) {
      // Optimization phase
      const optimizationResult = await this.optimize(
        strategy,
        config.parameterRanges,
        {
          ...config.backtestConfig,
          startDate: period.optimizationStart,
          endDate: period.optimizationEnd
        },
        config.optimizationConfig
      );
      
      // Out-of-sample testing phase
      const testEngine = new BacktestingEngine();
      const testResult = await testEngine.runBacktest(
        this.createOptimizedStrategy(strategy, optimizationResult.bestParameters),
        {
          ...config.backtestConfig,
          startDate: period.testStart,
          endDate: period.testEnd
        }
      );
      
      results.push({
        period: period,
        optimizationResult: optimizationResult.bestMetrics,
        testResult: testResult.metrics,
        parameters: optimizationResult.bestParameters
      });
    }
    
    return {
      periods: results,
      aggregatedMetrics: this.aggregateWalkForwardResults(results),
      stability: this.calculateWalkForwardStability(results)
    };
  }
}

interface OptimizationConfig {
  objective: 'SHARPE_RATIO' | 'CALMAR_RATIO' | 'TOTAL_RETURN' | 'PROFIT_FACTOR' | 'CUSTOM';
  customWeights?: ObjectiveWeights;
  maxConcurrency: number;
  minTrades: number;
  maxDrawdownThreshold: number;
}

interface ParameterRange {
  name: string;
  type: 'INTEGER' | 'FLOAT' | 'CHOICE';
  min?: number;
  max?: number;
  step?: number;
  choices?: (string | number)[];
}

interface WalkForwardConfig {
  backtestConfig: BacktestConfig;
  optimizationConfig: OptimizationConfig;
  parameterRanges: ParameterRange[];
  
  // Walk-forward settings
  optimizationPeriodDays: number;
  testPeriodDays: number;
  stepDays: number;
}
```

### 6. Monte Carlo Analysis

```typescript
// Monte Carlo Simulation for robustness testing
class MonteCarloAnalyzer {
  async runMonteCarlo(
    strategy: BaseStrategy,
    backtestConfig: BacktestConfig,
    monteCarloConfig: MonteCarloConfig
  ): Promise<MonteCarloResults> {
    const simulations: MonteCarloSimulation[] = [];
    
    for (let i = 0; i < monteCarloConfig.simulations; i++) {
      // Generate randomized market data
      const randomizedData = this.randomizeMarketData(
        await this.loadOriginalData(backtestConfig),
        monteCarloConfig.method
      );
      
      // Run backtest with randomized data
      const engine = new BacktestingEngine();
      const result = await engine.runBacktest(strategy, {
        ...backtestConfig,
        marketData: randomizedData
      });
      
      simulations.push({
        simulationId: i,
        metrics: result.metrics,
        finalValue: result.results.finalPortfolioValue
      });
    }
    
    return {
      simulations,
      statistics: this.calculateMonteCarloStatistics(simulations),
      confidenceIntervals: this.calculateConfidenceIntervals(simulations),
      robustnessScore: this.calculateRobustnessScore(simulations)
    };
  }
  
  private randomizeMarketData(
    originalData: MarketData,
    method: 'BOOTSTRAP' | 'PARAMETRIC' | 'BLOCK_BOOTSTRAP'
  ): MarketData {
    switch (method) {
      case 'BOOTSTRAP':
        return this.bootstrapResample(originalData);
      case 'PARAMETRIC':
        return this.parametricResample(originalData);
      case 'BLOCK_BOOTSTRAP':
        return this.blockBootstrapResample(originalData);
      default:
        return originalData;
    }
  }
  
  private bootstrapResample(originalData: MarketData): MarketData {
    const candles = [...originalData.candles];
    const resampled: DydxCandle[] = [];
    
    // Simple bootstrap resampling
    for (let i = 0; i < candles.length; i++) {
      const randomIndex = Math.floor(Math.random() * candles.length);
      resampled.push({ ...candles[randomIndex] });
    }
    
    return {
      ...originalData,
      candles: resampled
    };
  }
  
  private calculateConfidenceIntervals(
    simulations: MonteCarloSimulation[]
  ): ConfidenceIntervals {
    const returns = simulations.map(s => s.metrics.totalReturn).sort((a, b) => a - b);
    const sharpes = simulations.map(s => s.metrics.sharpeRatio).sort((a, b) => a - b);
    const drawdowns = simulations.map(s => s.metrics.maxDrawdown).sort((a, b) => a - b);
    
    return {
      totalReturn: {
        confidence95: [
          returns[Math.floor(returns.length * 0.025)],
          returns[Math.floor(returns.length * 0.975)]
        ],
        confidence90: [
          returns[Math.floor(returns.length * 0.05)],
          returns[Math.floor(returns.length * 0.95)]
        ]
      },
      sharpeRatio: {
        confidence95: [
          sharpes[Math.floor(sharpes.length * 0.025)],
          sharpes[Math.floor(sharpes.length * 0.975)]
        ],
        confidence90: [
          sharpes[Math.floor(sharpes.length * 0.05)],
          sharpes[Math.floor(sharpes.length * 0.95)]
        ]
      },
      maxDrawdown: {
        confidence95: [
          drawdowns[Math.floor(drawdowns.length * 0.025)],
          drawdowns[Math.floor(drawdowns.length * 0.975)]
        ],
        confidence90: [
          drawdowns[Math.floor(drawdowns.length * 0.05)],
          drawdowns[Math.floor(drawdowns.length * 0.95)]
        ]
      }
    };
  }
}
```

---

## Integration with Strategy Engine

```typescript
// Integrated Backtesting Service
class BacktestingService {
  private engine = new BacktestingEngine();
  private optimizer = new ParameterOptimizer();
  private monteCarloAnalyzer = new MonteCarloAnalyzer();
  private repository = new BacktestRepository();
  
  async runFullAnalysis(
    strategy: BaseStrategy,
    config: FullAnalysisConfig
  ): Promise<FullAnalysisResults> {
    // 1. Basic backtest
    const backtestResult = await this.engine.runBacktest(strategy, config.backtestConfig);
    
    // 2. Parameter optimization
    let optimizationResult: OptimizationResults | undefined;
    if (config.runOptimization) {
      optimizationResult = await this.optimizer.optimize(
        strategy,
        config.parameterRanges,
        config.backtestConfig,
        config.optimizationConfig
      );
    }
    
    // 3. Walk-forward analysis
    let walkForwardResult: WalkForwardResults | undefined;
    if (config.runWalkForward) {
      walkForwardResult = await this.optimizer.walkForwardAnalysis(
        strategy,
        config.walkForwardConfig
      );
    }
    
    // 4. Monte Carlo analysis
    let monteCarloResult: MonteCarloResults | undefined;
    if (config.runMonteCarlo) {
      monteCarloResult = await this.monteCarloAnalyzer.runMonteCarlo(
        strategy,
        config.backtestConfig,
        config.monteCarloConfig
      );
    }
    
    // 5. Save results to database
    const savedResult = await this.repository.saveFullAnalysis({
      strategyId: strategy.id,
      backtestResult,
      optimizationResult,
      walkForwardResult,
      monteCarloResult,
      config
    });
    
    return {
      id: savedResult.id,
      backtest: backtestResult,
      optimization: optimizationResult,
      walkForward: walkForwardResult,
      monteCarlo: monteCarloResult,
      overallAssessment: this.generateOverallAssessment(
        backtestResult,
        optimizationResult,
        walkForwardResult,
        monteCarloResult
      )
    };
  }
  
  private generateOverallAssessment(
    backtest: BacktestResult,
    optimization?: OptimizationResults,
    walkForward?: WalkForwardResults,
    monteCarlo?: MonteCarloResults
  ): StrategyAssessment {
    const scores = {
      profitability: this.scoreProfitability(backtest.metrics),
      consistency: this.scoreConsistency(backtest.metrics, walkForward),
      robustness: this.scoreRobustness(optimization, monteCarlo),
      riskManagement: this.scoreRiskManagement(backtest.metrics)
    };
    
    const overallScore = (
      scores.profitability * 0.3 +
      scores.consistency * 0.25 +
      scores.robustness * 0.25 +
      scores.riskManagement * 0.2
    );
    
    return {
      overallScore,
      scores,
      recommendation: this.generateRecommendation(overallScore, scores),
      keyInsights: this.generateKeyInsights(backtest, optimization, walkForward, monteCarlo)
    };
  }
}
```

This comprehensive backtesting architecture provides the foundation for rigorous strategy validation, optimization, and risk assessment. The system combines event-driven simulation, statistical analysis, and advanced optimization techniques to ensure strategies are thoroughly tested before live deployment.