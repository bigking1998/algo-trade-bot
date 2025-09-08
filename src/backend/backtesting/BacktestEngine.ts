/**
 * BacktestEngine - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Core backtesting engine implementing comprehensive strategy validation with:
 * - Event-driven simulation architecture
 * - Realistic order execution modeling
 * - Portfolio simulation with position tracking
 * - Comprehensive performance analytics
 * - Risk metrics and drawdown analysis
 * - Multi-timeframe and multi-asset support
 * - Performance optimization for large datasets
 */

import { EventEmitter } from 'events';
import { 
  BacktestConfig, 
  BacktestResults, 
  BacktestProgress, 
  BacktestEvent,
  BacktestEventType,
  MarketDataEvent,
  SignalEvent,
  OrderEvent,
  HistoricalDataPoint,
  BacktestEngineConfig,
  HistoricalDataProvider
} from './types';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { PortfolioSimulator } from './PortfolioSimulator';
import { ExecutionSimulator } from './ExecutionSimulator';
import { PerformanceCalculator } from './PerformanceCalculator';
import { RiskAnalyzer } from './RiskAnalyzer';
import { Timeframe } from '../../shared/types/trading';

/**
 * Backtesting execution state
 */
type BacktestState = 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';

/**
 * Main backtesting engine class
 */
export class BacktestEngine extends EventEmitter {
  private state: BacktestState = 'idle';
  private config: BacktestEngineConfig;
  private currentBacktest?: {
    id: string;
    config: BacktestConfig;
    strategy: BaseStrategy;
    startTime: Date;
  };
  
  // Core components
  private portfolioSimulator: PortfolioSimulator;
  private executionSimulator: ExecutionSimulator;
  private performanceCalculator: PerformanceCalculator;
  private riskAnalyzer: RiskAnalyzer;
  private dataProvider: HistoricalDataProvider;
  
  // Progress tracking
  private progress!: BacktestProgress;
  private eventQueue: BacktestEvent[] = [];
  private currentBar = 0;
  private totalBars = 0;
  private lastProgressUpdate = Date.now();
  
  // Performance tracking
  private startTime!: Date;
  private processedBars = 0;
  private errorsCount = 0;
  private warningsCount = 0;
  private errors: Array<{ timestamp: Date; level: 'error' | 'warning' | 'info'; message: string; context?: any }> = [];
  
  // Data management
  private historicalData: Map<string, HistoricalDataPoint[]> = new Map();
  private currentDataIndex: Map<string, number> = new Map();
  private warmupComplete = false;
  
  // Cancellation support
  private cancelled = false;

  constructor(
    dataProvider: HistoricalDataProvider,
    config: Partial<BacktestEngineConfig> = {}
  ) {
    super();
    
    this.dataProvider = dataProvider;
    this.config = {
      dataBufferSize: 10000,
      preloadData: true,
      enableParallelProcessing: false, // Start with single-threaded
      maxWorkerThreads: 4,
      chunkSize: 1000,
      enableGarbageCollection: true,
      gcThreshold: 512, // MB
      enableValidation: true,
      strictMode: false,
      logLevel: 'info',
      enableProgressReporting: true,
      progressReportInterval: 5, // seconds
      continueOnError: true,
      maxErrors: 100,
      saveIntermediateResults: false,
      compressionLevel: 6,
      ...config
    };
    
    // Initialize components
    this.portfolioSimulator = new PortfolioSimulator();
    this.executionSimulator = new ExecutionSimulator();
    this.performanceCalculator = new PerformanceCalculator();
    this.riskAnalyzer = new RiskAnalyzer();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Run comprehensive backtest
   */
  async runBacktest(
    config: BacktestConfig,
    strategy: BaseStrategy
  ): Promise<BacktestResults> {
    try {
      // Validate inputs
      this.validateBacktestConfig(config);
      
      // Initialize backtest
      const backtestId = this.generateBacktestId();
      this.currentBacktest = {
        id: backtestId,
        config,
        strategy,
        startTime: new Date()
      };
      
      this.setState('initializing');
      this.log('info', 'Starting backtest initialization', { backtestId, strategy: strategy.constructor.name });
      
      // Initialize progress tracking
      this.initializeProgress(backtestId);
      
      // Prepare data
      await this.prepareHistoricalData(config);
      
      // Initialize components
      await this.initializeComponents(config);
      
      // Initialize strategy
      await this.initializeStrategy(strategy, config);
      
      // Run simulation
      this.setState('running');
      this.log('info', 'Starting backtest execution');
      
      await this.runSimulation();
      
      if (this.cancelled) {
        this.setState('cancelled');
        throw new Error('Backtest was cancelled');
      }
      
      // Calculate final results
      this.setState('completed');
      this.log('info', 'Backtest completed, calculating results');
      
      const results = await this.calculateFinalResults();
      
      this.emit('backtest_completed', { backtestId, results });
      return results;
      
    } catch (error) {
      this.setState('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', `Backtest failed: ${errorMessage}`, { error });
      
      this.emit('backtest_error', { 
        backtestId: this.currentBacktest?.id, 
        error: errorMessage 
      });
      
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cancel running backtest
   */
  async cancelBacktest(): Promise<void> {
    if (this.state !== 'running') {
      throw new Error('No backtest is currently running');
    }
    
    this.cancelled = true;
    this.log('info', 'Backtest cancellation requested');
    
    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.setState('cancelled');
    this.log('info', 'Backtest cancelled successfully');
  }

  /**
   * Get current backtest progress
   */
  getProgress(): BacktestProgress | null {
    return this.progress ? { ...this.progress } : null;
  }

  /**
   * Validate backtest configuration
   */
  private validateBacktestConfig(config: BacktestConfig): void {
    const errors: string[] = [];
    
    // Date validation
    if (config.startDate >= config.endDate) {
      errors.push('Start date must be before end date');
    }
    
    if (config.startDate > new Date()) {
      errors.push('Start date cannot be in the future');
    }
    
    // Portfolio validation
    if (config.initialCapital <= 0) {
      errors.push('Initial capital must be positive');
    }
    
    // Fee validation
    if (config.commission < 0 || config.commission > 1) {
      errors.push('Commission must be between 0 and 1');
    }
    
    if (config.slippage < 0 || config.slippage > 1) {
      errors.push('Slippage must be between 0 and 1');
    }
    
    // Symbols validation
    if (!config.symbols || config.symbols.length === 0) {
      errors.push('At least one symbol must be specified');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Prepare historical data for backtesting
   */
  private async prepareHistoricalData(config: BacktestConfig): Promise<void> {
    this.log('info', 'Loading historical data', {
      symbols: config.symbols,
      startDate: config.startDate,
      endDate: config.endDate,
      timeframe: config.timeframe
    });
    
    try {
      // Validate data availability
      const availability = await this.dataProvider.validateDataAvailability(
        config.symbols,
        config.startDate,
        config.endDate,
        config.timeframe
      );
      
      if (!availability.available) {
        throw new Error(`Historical data not available: ${availability.missingSymbols.join(', ')}`);
      }
      
      // Load historical data
      const data = await this.dataProvider.getHistoricalData(
        config.symbols,
        config.startDate,
        config.endDate,
        config.timeframe,
        {
          includeWeekends: config.includeWeekends,
          adjustForSplits: true,
          adjustForDividends: true
        }
      );
      
      // Organize data by symbol
      this.historicalData.clear();
      this.currentDataIndex.clear();
      
      for (const symbol of config.symbols) {
        const symbolData = data.filter(d => d.symbol === symbol).sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        
        this.historicalData.set(symbol, symbolData);
        this.currentDataIndex.set(symbol, 0);
      }
      
      // Calculate total bars
      this.totalBars = Math.max(...Array.from(this.historicalData.values()).map(d => d.length));
      
      this.log('info', 'Historical data loaded successfully', {
        totalBars: this.totalBars,
        symbols: config.symbols.length,
        dateRange: `${config.startDate.toISOString()} to ${config.endDate.toISOString()}`
      });
      
      // Validate data quality
      await this.validateDataQuality();
      
    } catch (error) {
      this.log('error', 'Failed to load historical data', { error });
      throw error;
    }
  }

  /**
   * Validate historical data quality
   */
  private async validateDataQuality(): Promise<void> {
    const warnings: string[] = [];
    
    for (const [symbol, data] of this.historicalData) {
      if (data.length === 0) {
        warnings.push(`No data available for ${symbol}`);
        continue;
      }
      
      // Check for gaps
      const gaps = [];
      for (let i = 1; i < data.length; i++) {
        const timeDiff = data[i].timestamp.getTime() - data[i-1].timestamp.getTime();
        const expectedDiff = this.getExpectedTimeDifference(data[i].timeframe);
        
        if (timeDiff > expectedDiff * 1.5) {
          gaps.push({
            from: data[i-1].timestamp,
            to: data[i].timestamp
          });
        }
      }
      
      if (gaps.length > 0) {
        warnings.push(`Found ${gaps.length} gaps in data for ${symbol}`);
      }
      
      // Check for invalid prices
      const invalidBars = data.filter(d => 
        d.open <= 0 || d.high <= 0 || d.low <= 0 || d.close <= 0 ||
        d.high < d.low || d.open > d.high || d.open < d.low ||
        d.close > d.high || d.close < d.low
      );
      
      if (invalidBars.length > 0) {
        warnings.push(`Found ${invalidBars.length} invalid price bars for ${symbol}`);
      }
    }
    
    // Log warnings
    for (const warning of warnings) {
      this.log('warn', warning);
    }
    
    if (warnings.length > 0) {
      this.emit('data_quality_warnings', warnings);
    }
  }

  /**
   * Get expected time difference between bars
   */
  private getExpectedTimeDifference(timeframe: Timeframe): number {
    const timeframes: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return timeframes[timeframe] || 60 * 1000;
  }

  /**
   * Initialize backtesting components
   */
  private async initializeComponents(config: BacktestConfig): Promise<void> {
    // Initialize portfolio simulator
    await this.portfolioSimulator.initialize({
      initialCapital: config.initialCapital,
      currency: config.currency,
      enableReinvestment: config.enableReinvestment,
      compoundReturns: config.compoundReturns
    });
    
    // Initialize execution simulator
    await this.executionSimulator.initialize({
      commission: config.commission,
      slippage: config.slippage,
      latency: config.latency,
      fillRatio: config.fillRatio
    });
    
    // Initialize performance calculator
    await this.performanceCalculator.initialize({
      riskFreeRate: config.riskFreeRate || 0.02,
      benchmark: config.benchmark
    });
    
    // Initialize risk analyzer
    await this.riskAnalyzer.initialize({
      maxDrawdown: config.maxDrawdown,
      maxPositionSize: config.maxPositionSize
    });
    
    this.log('info', 'All components initialized successfully');
  }

  /**
   * Initialize strategy for backtesting
   */
  private async initializeStrategy(strategy: BaseStrategy, config: BacktestConfig): Promise<void> {
    try {
      // Update strategy configuration for backtesting
      const backtestingConfig = {
        ...config.strategyConfig,
        symbols: config.symbols,
        timeframes: [config.timeframe],
        backtestMode: true
      };
      
      // Initialize strategy
      await strategy.initialize();
      
      this.log('info', 'Strategy initialized for backtesting', {
        strategyName: strategy.constructor.name
      });
      
    } catch (error) {
      this.log('error', 'Failed to initialize strategy', { error });
      throw error;
    }
  }

  /**
   * Run main simulation loop
   */
  private async runSimulation(): Promise<void> {
    this.startTime = new Date();
    this.currentBar = 0;
    this.processedBars = 0;
    this.warmupComplete = false;
    
    // Progress reporting timer
    const progressTimer = setInterval(() => {
      this.updateProgress();
      this.emit('progress_update', this.getProgress());
    }, this.config.progressReportInterval * 1000);
    
    try {
      // Main simulation loop
      while (this.currentBar < this.totalBars && !this.cancelled) {
        const currentTimestamp = await this.processNextBar();
        
        if (!currentTimestamp) {
          break; // No more data
        }
        
        // Check for warmup completion
        if (!this.warmupComplete && this.currentBar >= this.currentBacktest!.config.warmupPeriod) {
          this.warmupComplete = true;
          this.log('info', 'Warmup period completed, starting strategy execution');
        }
        
        // Process events for this timestamp
        await this.processEventsForTimestamp(currentTimestamp);
        
        this.currentBar++;
        this.processedBars++;
        
        // Garbage collection check
        if (this.config.enableGarbageCollection && 
            this.processedBars % 1000 === 0 && 
            process.memoryUsage().heapUsed > this.config.gcThreshold * 1024 * 1024) {
          if (global.gc) {
            global.gc();
          }
        }
        
        // Error threshold check
        if (this.errorsCount > this.config.maxErrors) {
          throw new Error(`Maximum error threshold exceeded (${this.config.maxErrors})`);
        }
      }
      
    } finally {
      clearInterval(progressTimer);
    }
    
    this.log('info', 'Simulation completed', {
      barsProcessed: this.processedBars,
      duration: Date.now() - this.startTime.getTime(),
      errorsCount: this.errorsCount,
      warningsCount: this.warningsCount
    });
  }

  /**
   * Process next bar of data
   */
  private async processNextBar(): Promise<Date | null> {
    const timestamps: Date[] = [];
    
    // Get next timestamp from each symbol
    for (const [symbol, data] of this.historicalData) {
      const index = this.currentDataIndex.get(symbol) || 0;
      if (index < data.length) {
        timestamps.push(data[index].timestamp);
      }
    }
    
    if (timestamps.length === 0) {
      return null; // No more data
    }
    
    // Find earliest timestamp
    const currentTimestamp = new Date(Math.min(...timestamps.map(t => t.getTime())));
    
    // Emit market data events for this timestamp
    for (const [symbol, data] of this.historicalData) {
      const index = this.currentDataIndex.get(symbol) || 0;
      if (index < data.length && data[index].timestamp.getTime() === currentTimestamp.getTime()) {
        const marketData = data[index];
        
        // Create market data event
        const event: MarketDataEvent = {
          id: this.generateEventId(),
          type: 'market_data',
          timestamp: currentTimestamp,
          symbol,
          data: marketData
        };
        
        this.eventQueue.push(event);
        this.currentDataIndex.set(symbol, index + 1);
      }
    }
    
    return currentTimestamp;
  }

  /**
   * Process all events for a specific timestamp
   */
  private async processEventsForTimestamp(timestamp: Date): Promise<void> {
    // Get events for this timestamp
    const events = this.eventQueue.filter(e => e.timestamp.getTime() === timestamp.getTime());
    this.eventQueue = this.eventQueue.filter(e => e.timestamp.getTime() > timestamp.getTime());
    
    // Sort events by priority (market data first, then signals, then orders)
    events.sort((a, b) => this.getEventPriority(a.type) - this.getEventPriority(b.type));
    
    // Process events
    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        this.handleEventProcessingError(event, error);
      }
    }
    
    // Update portfolio after processing all events
    await this.portfolioSimulator.updateTimestamp(timestamp);
    
    // Calculate risk metrics
    await this.riskAnalyzer.updateRisk(
      await this.portfolioSimulator.getSnapshot(),
      this.getMarketDataAtTimestamp(timestamp)
    );
  }

  /**
   * Get event processing priority
   */
  private getEventPriority(eventType: BacktestEventType): number {
    const priorities: Record<BacktestEventType, number> = {
      'market_data': 1,
      'signal_generated': 2,
      'order_placed': 3,
      'order_filled': 4,
      'order_cancelled': 5,
      'position_opened': 6,
      'position_closed': 7,
      'stop_loss_hit': 8,
      'take_profit_hit': 8,
      'margin_call': 9,
      'portfolio_update': 10,
      'risk_breach': 11,
      'backtest_start': 0,
      'backtest_end': 12,
      'error': 99
    };
    
    return priorities[eventType] || 50;
  }

  /**
   * Process individual event
   */
  private async processEvent(event: BacktestEvent): Promise<void> {
    switch (event.type) {
      case 'market_data':
        await this.processMarketDataEvent(event as MarketDataEvent);
        break;
        
      case 'signal_generated':
        await this.processSignalEvent(event as SignalEvent);
        break;
        
      case 'order_placed':
      case 'order_filled':
      case 'order_cancelled':
        await this.processOrderEvent(event as OrderEvent);
        break;
        
      default:
        this.log('warn', `Unhandled event type: ${event.type}`, { event });
    }
  }

  /**
   * Process market data event
   */
  private async processMarketDataEvent(event: MarketDataEvent): Promise<void> {
    const { symbol, data } = event;
    
    // Validate required data
    if (!symbol) {
      this.log('error', 'Symbol is required for market data event');
      return;
    }
    
    // Update portfolio simulator with new prices
    await this.portfolioSimulator.updateMarketData(symbol, {
      price: data.close,
      timestamp: data.timestamp,
      volume: data.volume
    });
    
    // Generate strategy signal if warmup is complete
    if (this.warmupComplete && this.currentBacktest?.strategy) {
      try {
        // Create strategy context
        const context = await this.createStrategyContext(symbol, data.timestamp);
        
        // Execute strategy
        const signal = await this.currentBacktest.strategy.executeStrategy(context);
        
        if (signal) {
          // Create signal event
          const signalEvent: SignalEvent = {
            id: this.generateEventId(),
            type: 'signal_generated',
            timestamp: data.timestamp,
            symbol,
            data: {
              signal: signal.type.toLowerCase() as 'buy' | 'sell' | 'hold',
              strength: signal.confidence,
              confidence: signal.confidence,
              entryPrice: signal.entryPrice || 0,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit,
              positionSize: signal.quantity,
              metadata: signal.metadata || {}
            }
          };
          
          this.eventQueue.push(signalEvent);
        }
        
      } catch (error) {
        this.log('error', `Strategy execution error for ${symbol}`, { error });
        this.errorsCount++;
      }
    }
  }

  /**
   * Process signal event
   */
  private async processSignalEvent(event: SignalEvent): Promise<void> {
    const { symbol, data } = event;
    
    // Validate required data
    if (!symbol) {
      this.log('error', 'Symbol is required for signal event');
      return;
    }
    
    try {
      // Validate signal
      if (!this.validateSignal(data)) {
        this.log('warn', 'Invalid signal generated', { symbol, signal: data });
        return;
      }
      
      // Check risk limits
      const riskCheck = await this.riskAnalyzer.checkTradeRisk({
        symbol,
        side: data.signal === 'buy' ? 'long' : 'short',
        quantity: data.positionSize || 0,
        price: data.entryPrice || 0
      });
      
      if (!riskCheck.approved) {
        this.log('warn', 'Signal rejected by risk management', { 
          symbol, 
          reason: riskCheck.reason 
        });
        return;
      }
      
      // Create order
      const order = {
        id: this.generateOrderId(),
        symbol,
        side: (data.signal === 'buy' ? 'buy' : 'sell') as 'buy' | 'sell',
        quantity: data.positionSize || 0,
        price: data.entryPrice || 0,
        orderType: 'market' as const,
        timeInForce: 'GTC' as const
      };
      
      // Submit order to execution simulator
      const execution = await this.executionSimulator.submitOrder(order, event.timestamp);
      
      // Create order event
      const orderEvent: OrderEvent = {
        id: this.generateEventId(),
        type: execution.filled ? 'order_filled' : 'order_placed',
        timestamp: event.timestamp,
        symbol,
        data: {
          orderId: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          orderType: order.orderType,
          timeInForce: order.timeInForce,
          fillPrice: execution.fillPrice,
          fillQuantity: execution.fillQuantity,
          commission: execution.commission,
          slippage: execution.slippage
        }
      };
      
      this.eventQueue.push(orderEvent);
      
    } catch (error) {
      this.log('error', `Failed to process signal for ${symbol}`, { error });
      this.errorsCount++;
    }
  }

  /**
   * Process order event
   */
  private async processOrderEvent(event: OrderEvent): Promise<void> {
    const { data } = event;
    
    if (event.type === 'order_filled') {
      // Update portfolio with filled order
      await this.portfolioSimulator.processOrderFill({
        symbol: data.symbol,
        side: data.side,
        quantity: data.fillQuantity || data.quantity,
        price: data.fillPrice || data.price,
        commission: data.commission || 0,
        timestamp: event.timestamp
      });
      
      this.log('debug', `Order filled: ${data.side} ${data.quantity} ${data.symbol} at ${data.fillPrice}`);
    }
  }

  /**
   * Create strategy context for execution
   */
  private async createStrategyContext(symbol: string, timestamp: Date): Promise<any> {
    // Get current market data window
    const marketData = this.getMarketDataWindow(symbol, timestamp, 100); // 100 bars lookback
    
    // Get current portfolio snapshot
    const portfolio = await this.portfolioSimulator.getSnapshot();
    
    // Get risk metrics
    const riskMetrics = await this.riskAnalyzer.getCurrentRisk();
    
    return {
      timestamp,
      marketData: {
        symbol,
        current: marketData[marketData.length - 1],
        history: marketData,
        indicators: {} // Would be calculated by indicator engine
      },
      portfolio,
      riskMetrics,
      positions: await this.portfolioSimulator.getPositions(),
      accountInfo: {
        balance: portfolio.totalValue,
        equity: portfolio.totalValue,
        margin: portfolio.usedMargin,
        freeMargin: portfolio.availableMargin
      }
    };
  }

  /**
   * Get market data window for a symbol
   */
  private getMarketDataWindow(symbol: string, timestamp: Date, lookback: number): HistoricalDataPoint[] {
    const data = this.historicalData.get(symbol) || [];
    const currentIndex = this.currentDataIndex.get(symbol) || 0;
    
    const startIndex = Math.max(0, currentIndex - lookback);
    const endIndex = Math.min(data.length, currentIndex + 1);
    
    return data.slice(startIndex, endIndex);
  }

  /**
   * Get market data at specific timestamp
   */
  private getMarketDataAtTimestamp(timestamp: Date): Map<string, HistoricalDataPoint> {
    const result = new Map<string, HistoricalDataPoint>();
    
    for (const [symbol, data] of this.historicalData) {
      const point = data.find(d => d.timestamp.getTime() === timestamp.getTime());
      if (point) {
        result.set(symbol, point);
      }
    }
    
    return result;
  }

  /**
   * Validate signal data
   */
  private validateSignal(signal: any): boolean {
    return (
      signal &&
      (signal.signal === 'buy' || signal.signal === 'sell' || signal.signal === 'hold') &&
      typeof signal.strength === 'number' &&
      typeof signal.confidence === 'number' &&
      signal.strength >= 0 && signal.strength <= 1 &&
      signal.confidence >= 0 && signal.confidence <= 1
    );
  }

  /**
   * Calculate final backtest results
   */
  private async calculateFinalResults(): Promise<BacktestResults> {
    if (!this.currentBacktest) {
      throw new Error('No current backtest to calculate results for');
    }
    
    const { id: backtestId, config, strategy, startTime } = this.currentBacktest;
    
    // Get final portfolio snapshot
    const finalPortfolio = await this.portfolioSimulator.getSnapshot();
    
    // Get all trades
    const trades = await this.portfolioSimulator.getAllTrades();
    
    // Get portfolio history
    const portfolioHistory = await this.portfolioSimulator.getPortfolioHistory();
    
    // Calculate performance metrics
    const performanceMetrics = await this.performanceCalculator.calculateMetrics({
      trades,
      portfolioHistory,
      initialCapital: config.initialCapital,
      benchmark: config.benchmark
    });
    
    // Calculate risk metrics
    const riskMetrics = await this.riskAnalyzer.calculateFinalRisk({
      portfolioHistory,
      trades
    });
    
    // Build comprehensive results
    const results: BacktestResults = {
      // Metadata
      backtestId,
      config,
      strategy: strategy.constructor.name,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      
      // Summary
      totalBars: this.totalBars,
      tradingDays: this.calculateTradingDays(config.startDate, config.endDate),
      
      // Portfolio performance
      initialValue: config.initialCapital,
      finalValue: finalPortfolio.totalValue,
      totalReturn: finalPortfolio.totalValue - config.initialCapital,
      totalReturnPercent: ((finalPortfolio.totalValue / config.initialCapital) - 1) * 100,
      annualizedReturn: performanceMetrics.annualizedReturn,
      compoundAnnualGrowthRate: performanceMetrics.cagr,
      
      // Risk metrics
      volatility: riskMetrics.volatility,
      maxDrawdown: riskMetrics.maxDrawdown,
      maxDrawdownPercent: riskMetrics.maxDrawdownPercent,
      maxDrawdownDuration: riskMetrics.maxDrawdownDuration,
      calmarRatio: performanceMetrics.calmarRatio,
      
      // Risk-adjusted returns
      sharpeRatio: performanceMetrics.sharpeRatio,
      sortinoRatio: performanceMetrics.sortinoRatio,
      informationRatio: performanceMetrics.informationRatio,
      treynorRatio: performanceMetrics.treynorRatio,
      
      // Distribution metrics
      skewness: riskMetrics.skewness,
      kurtosis: riskMetrics.kurtosis,
      valueAtRisk95: riskMetrics.var95,
      conditionalValueAtRisk95: riskMetrics.cvar95,
      
      // Trade statistics
      totalTrades: trades.length,
      winningTrades: trades.filter(t => t.netPnL > 0).length,
      losingTrades: trades.filter(t => t.netPnL < 0).length,
      winRate: trades.length > 0 ? (trades.filter(t => t.netPnL > 0).length / trades.length) * 100 : 0,
      profitFactor: performanceMetrics.profitFactor,
      
      // Trade performance
      averageWin: performanceMetrics.averageWin,
      averageLoss: performanceMetrics.averageLoss,
      averageTrade: performanceMetrics.averageTrade,
      largestWin: performanceMetrics.largestWin,
      largestLoss: performanceMetrics.largestLoss,
      averageHoldingPeriod: performanceMetrics.averageHoldingPeriod,
      
      // Advanced metrics
      expectancy: performanceMetrics.expectancy,
      systemQualityNumber: performanceMetrics.sqn,
      recoveryFactor: performanceMetrics.recoveryFactor,
      payoffRatio: performanceMetrics.payoffRatio,
      
      // Consistency metrics
      winningMonths: performanceMetrics.winningMonths,
      losingMonths: performanceMetrics.losingMonths,
      bestMonth: performanceMetrics.bestMonth,
      worstMonth: performanceMetrics.worstMonth,
      winningWeeks: performanceMetrics.winningWeeks,
      losingWeeks: performanceMetrics.losingWeeks,
      
      // Execution quality
      totalCommission: trades.reduce((sum, t) => sum + t.entryCommission + t.exitCommission, 0),
      totalSlippage: trades.reduce((sum, t) => sum + t.entrySlippage + t.exitSlippage, 0),
      averageSlippageBps: performanceMetrics.averageSlippageBps,
      fillRate: performanceMetrics.fillRate,
      
      // Benchmark comparison
      benchmarkReturn: performanceMetrics.benchmarkReturn,
      benchmarkVolatility: performanceMetrics.benchmarkVolatility,
      beta: performanceMetrics.beta,
      alpha: performanceMetrics.alpha,
      trackingError: performanceMetrics.trackingError,
      
      // Detailed data
      equityCurve: portfolioHistory.map(p => ({
        timestamp: p.timestamp,
        equity: p.totalValue,
        drawdown: p.drawdown,
        dailyReturn: p.dayReturn
      })),
      
      trades,
      portfolioSnapshots: portfolioHistory,
      
      // Monthly performance
      monthlyReturns: performanceMetrics.monthlyReturns,
      
      // Performance attribution
      performanceAttribution: performanceMetrics.performanceAttribution,
      
      // Errors and warnings
      errors: this.errors
    };
    
    return results;
  }

  /**
   * Calculate trading days between dates
   */
  private calculateTradingDays(startDate: Date, endDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
    
    // Rough approximation - excludes weekends
    return Math.floor(days * 5 / 7);
  }

  /**
   * Initialize progress tracking
   */
  private initializeProgress(backtestId: string): void {
    this.progress = {
      backtestId,
      status: 'initializing',
      currentBar: 0,
      totalBars: 0,
      progressPercent: 0,
      startTime: new Date(),
      processingSpeed: 0,
      currentDate: new Date(),
      currentSymbol: '',
      currentValue: 0,
      currentDrawdown: 0,
      tradesCompleted: 0,
      signalsGenerated: 0,
      ordersPlaced: 0,
      ordersFilled: 0,
      currentReturn: 0,
      currentSharpe: 0,
      winRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastUpdate: new Date()
    };
  }

  /**
   * Update progress tracking
   */
  private updateProgress(): void {
    if (!this.progress) return;
    
    const now = Date.now();
    const elapsed = now - this.lastProgressUpdate;
    
    // Calculate processing speed
    const barsProcessedSinceLastUpdate = this.currentBar - this.progress.currentBar;
    const processingSpeed = elapsed > 0 ? (barsProcessedSinceLastUpdate / elapsed) * 1000 : 0;
    
    // Estimate completion time
    const remainingBars = this.totalBars - this.currentBar;
    const estimatedCompletion = processingSpeed > 0 
      ? new Date(now + (remainingBars / processingSpeed) * 1000)
      : undefined;
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    
    this.progress = {
      ...this.progress,
      status: this.state as any,
      currentBar: this.currentBar,
      totalBars: this.totalBars,
      progressPercent: this.totalBars > 0 ? (this.currentBar / this.totalBars) * 100 : 0,
      estimatedCompletion,
      processingSpeed,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      lastUpdate: new Date()
    };
    
    this.lastProgressUpdate = now;
  }

  /**
   * Handle event processing errors
   */
  private handleEventProcessingError(event: BacktestEvent, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.log('error', `Event processing error: ${errorMessage}`, {
      eventType: event.type,
      eventId: event.id,
      error
    });
    
    this.errorsCount++;
    
    if (!this.config.continueOnError) {
      throw new Error(`Event processing failed: ${errorMessage}`);
    }
  }

  /**
   * Setup event listeners for components
   */
  private setupEventListeners(): void {
    // Portfolio simulator events
    this.portfolioSimulator.on('trade_completed', (trade) => {
      this.emit('trade_completed', trade);
    });
    
    this.portfolioSimulator.on('position_opened', (position) => {
      this.emit('position_opened', position);
    });
    
    this.portfolioSimulator.on('position_closed', (position) => {
      this.emit('position_closed', position);
    });
    
    // Risk analyzer events
    this.riskAnalyzer.on('risk_breach', (breach) => {
      this.log('warn', 'Risk breach detected', breach);
      this.emit('risk_breach', breach);
    });
    
    this.riskAnalyzer.on('margin_call', (call) => {
      this.log('warn', 'Margin call triggered', call);
      this.emit('margin_call', call);
    });
  }

  /**
   * Set engine state
   */
  private setState(newState: BacktestState): void {
    const oldState = this.state;
    this.state = newState;
    
    this.emit('state_changed', { from: oldState, to: newState });
    
    if (this.progress) {
      this.progress.status = newState as any;
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      // Clear data structures
      this.historicalData.clear();
      this.currentDataIndex.clear();
      this.eventQueue = [];
      
      // Reset state
      this.currentBacktest = undefined;
      this.currentBar = 0;
      this.totalBars = 0;
      this.cancelled = false;
      this.errorsCount = 0;
      this.warningsCount = 0;
      this.errors = [];
      
      this.log('info', 'Backtest cleanup completed');
      
    } catch (error) {
      this.log('error', 'Error during cleanup', { error });
    }
  }

  /**
   * Generate unique backtest ID
   */
  private generateBacktestId(): string {
    return `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Logging utility
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    };
    
    // Store errors and warnings
    if (level === 'error' || level === 'warn') {
      this.errors.push({
        ...logEntry,
        level: level === 'warn' ? 'warning' : level
      } as { timestamp: Date; level: 'error' | 'warning' | 'info'; message: string; context?: any });
      
      if (level === 'error') {
        this.errorsCount++;
      } else {
        this.warningsCount++;
      }
    }
    
    // Emit log event
    this.emit('log', logEntry);
    
    // Console logging based on config
    const shouldLog = this.shouldLog(level);
    if (shouldLog) {
      const logMethod = level === 'error' ? console.error : 
                      level === 'warn' ? console.warn : 
                      level === 'debug' ? console.debug : console.log;
      
      if (context) {
        logMethod(`[BacktestEngine] ${message}`, context);
      } else {
        logMethod(`[BacktestEngine] ${message}`);
      }
    }
  }

  /**
   * Check if message should be logged based on config
   */
  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel <= configLevel;
  }

  /**
   * Get current state
   */
  getState(): BacktestState {
    return this.state;
  }

  /**
   * Get engine configuration
   */
  getConfig(): BacktestEngineConfig {
    return { ...this.config };
  }
}

export default BacktestEngine;