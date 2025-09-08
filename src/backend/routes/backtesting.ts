/**
 * Backtesting API Routes - Task BE-029: Event-Driven Backtesting Engine
 * 
 * RESTful API endpoints for backtesting functionality:
 * - Start/stop/cancel backtests
 * - Monitor backtest progress
 * - Retrieve backtest results
 * - Manage backtest configurations
 * - Historical data validation
 */

import * as http from 'http';
import { URL } from 'url';
import BacktestEngine from '../backtesting/BacktestEngine';
import { DydxHistoricalDataProvider, MockHistoricalDataProvider } from '../backtesting/HistoricalDataProvider';
import { BacktestConfig, BacktestResults, BacktestProgress } from '../backtesting/types';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { StrategyFactory } from '../strategies/StrategyFactory';

// Global backtest engine instance
let backtestEngine: BacktestEngine | null = null;
let runningBacktests = new Map<string, BacktestEngine>();

/**
 * Initialize backtesting system
 */
function initializeBacktesting(): void {
  if (!backtestEngine) {
    // Use mock data provider for testing, dYdX provider for production
    const dataProvider = process.env.NODE_ENV === 'production' 
      ? new DydxHistoricalDataProvider()
      : new MockHistoricalDataProvider();
    
    backtestEngine = new BacktestEngine(dataProvider, {
      logLevel: 'info',
      enableProgressReporting: true,
      progressReportInterval: 2,
      continueOnError: true,
      maxErrors: 50
    });
    
    // Setup event listeners
    backtestEngine.on('backtest_completed', (event) => {
      console.log(`[Backtesting] Completed backtest: ${event.backtestId}`);
    });
    
    backtestEngine.on('backtest_error', (event) => {
      console.error(`[Backtesting] Error in backtest ${event.backtestId}:`, event.error);
    });
    
    backtestEngine.on('progress_update', (progress) => {
      console.log(`[Backtesting] Progress: ${progress.progressPercent.toFixed(1)}% - ${progress.currentBar}/${progress.totalBars} bars`);
    });
  }
}

/**
 * Send JSON response
 */
function sendJSON(res: http.ServerResponse, statusCode: number, body: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

/**
 * Parse request body
 */
function parseRequestBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Validate backtest configuration
 */
function validateBacktestConfig(config: any): BacktestConfig {
  // Basic validation
  if (!config.symbols || !Array.isArray(config.symbols) || config.symbols.length === 0) {
    throw new Error('symbols array is required and must not be empty');
  }
  
  if (!config.timeframe) {
    throw new Error('timeframe is required');
  }
  
  if (!config.startDate || !config.endDate) {
    throw new Error('startDate and endDate are required');
  }
  
  if (typeof config.initialCapital !== 'number' || config.initialCapital <= 0) {
    throw new Error('initialCapital must be a positive number');
  }
  
  // Convert dates
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format for startDate or endDate');
  }
  
  if (startDate >= endDate) {
    throw new Error('startDate must be before endDate');
  }
  
  // Build validated config
  const validatedConfig: BacktestConfig = {
    id: config.id || `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: config.name || 'Untitled Backtest',
    description: config.description,
    startDate,
    endDate,
    timeframe: config.timeframe,
    symbols: config.symbols,
    dataSource: config.dataSource || 'dydx',
    initialCapital: config.initialCapital,
    currency: config.currency || 'USD',
    commission: typeof config.commission === 'number' ? config.commission : 0.001,
    slippage: typeof config.slippage === 'number' ? config.slippage : 0.001,
    latency: typeof config.latency === 'number' ? config.latency : 100,
    fillRatio: typeof config.fillRatio === 'number' ? config.fillRatio : 1.0,
    maxPositionSize: typeof config.maxPositionSize === 'number' ? config.maxPositionSize : 10,
    maxDrawdown: typeof config.maxDrawdown === 'number' ? config.maxDrawdown : 20,
    strategyConfig: config.strategyConfig || {},
    benchmark: config.benchmark,
    riskFreeRate: typeof config.riskFreeRate === 'number' ? config.riskFreeRate : 0.02,
    warmupPeriod: typeof config.warmupPeriod === 'number' ? config.warmupPeriod : 50,
    enableReinvestment: Boolean(config.enableReinvestment),
    compoundReturns: Boolean(config.compoundReturns),
    includeWeekends: Boolean(config.includeWeekends),
    created: new Date(),
    updated: new Date()
  };
  
  return validatedConfig;
}

/**
 * Handle backtesting routes
 */
export async function handleBacktestingRoute(
  req: http.IncomingMessage, 
  res: http.ServerResponse, 
  url: URL
): Promise<boolean> {
  const { pathname, searchParams } = url;
  
  // Initialize if needed
  initializeBacktesting();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, null);
    return true;
  }
  
  // Routes
  if (pathname === '/api/backtesting/health') {
    if (req.method === 'GET') {
      sendJSON(res, 200, {
        status: 'ok',
        engine: {
          initialized: backtestEngine !== null,
          state: backtestEngine?.getState() || 'idle',
          runningBacktests: runningBacktests.size
        },
        timestamp: new Date().toISOString()
      });
      return true;
    }
  }
  
  if (pathname === '/api/backtesting/start') {
    if (req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        
        // Validate configuration
        const config = validateBacktestConfig(body);
        
        // Create strategy instance
        let strategy: BaseStrategy;
        try {
          if (body.strategyType && body.strategyConfig) {
            strategy = StrategyFactory.createStrategy(body.strategyType, body.strategyConfig);
          } else {
            // Use a default strategy for testing
            strategy = StrategyFactory.createStrategy('simple_ma_cross', {
              fastPeriod: 10,
              slowPeriod: 20,
              symbols: config.symbols,
              timeframes: [config.timeframe]
            });
          }
        } catch (strategyError) {
          sendJSON(res, 400, {
            error: 'Failed to create strategy',
            details: strategyError instanceof Error ? strategyError.message : String(strategyError)
          });
          return true;
        }
        
        // Start backtest
        console.log('[Backtesting] Starting backtest:', config.id);
        
        // Run backtest asynchronously
        const backtestPromise = backtestEngine!.runBacktest(config, strategy);
        
        // Store the engine instance for this backtest
        runningBacktests.set(config.id, backtestEngine!);
        
        // Handle completion/errors
        backtestPromise
          .then((results) => {
            console.log(`[Backtesting] Completed: ${config.id}`);
            runningBacktests.delete(config.id);
          })
          .catch((error) => {
            console.error(`[Backtesting] Failed: ${config.id}:`, error);
            runningBacktests.delete(config.id);
          });
        
        sendJSON(res, 202, {
          message: 'Backtest started',
          backtestId: config.id,
          config: {
            symbols: config.symbols,
            timeframe: config.timeframe,
            startDate: config.startDate,
            endDate: config.endDate,
            initialCapital: config.initialCapital
          }
        });
        return true;
        
      } catch (error) {
        sendJSON(res, 400, {
          error: 'Failed to start backtest',
          details: error instanceof Error ? error.message : String(error)
        });
        return true;
      }
    }
  }
  
  if (pathname === '/api/backtesting/progress') {
    if (req.method === 'GET') {
      const backtestId = searchParams.get('backtestId');
      
      if (!backtestId) {
        sendJSON(res, 400, { error: 'backtestId parameter is required' });
        return true;
      }
      
      const engine = runningBacktests.get(backtestId);
      if (!engine) {
        sendJSON(res, 404, { error: 'Backtest not found or not running' });
        return true;
      }
      
      const progress = engine.getProgress();
      sendJSON(res, 200, progress);
      return true;
    }
  }
  
  if (pathname === '/api/backtesting/cancel') {
    if (req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        const backtestId = body.backtestId;
        
        if (!backtestId) {
          sendJSON(res, 400, { error: 'backtestId is required' });
          return true;
        }
        
        const engine = runningBacktests.get(backtestId);
        if (!engine) {
          sendJSON(res, 404, { error: 'Backtest not found or not running' });
          return true;
        }
        
        await engine.cancelBacktest();
        runningBacktests.delete(backtestId);
        
        sendJSON(res, 200, { message: 'Backtest cancelled', backtestId });
        return true;
        
      } catch (error) {
        sendJSON(res, 400, {
          error: 'Failed to cancel backtest',
          details: error instanceof Error ? error.message : String(error)
        });
        return true;
      }
    }
  }
  
  if (pathname === '/api/backtesting/status') {
    if (req.method === 'GET') {
      sendJSON(res, 200, {
        runningBacktests: Array.from(runningBacktests.keys()),
        engineState: backtestEngine?.getState() || 'idle',
        engineConfig: backtestEngine?.getConfig()
      });
      return true;
    }
  }
  
  if (pathname === '/api/backtesting/validate') {
    if (req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        
        // Validate configuration without starting backtest
        const config = validateBacktestConfig(body);
        
        // Validate data availability if data provider supports it
        const dataProvider = new MockHistoricalDataProvider(); // Use appropriate provider
        const availability = await dataProvider.validateDataAvailability(
          config.symbols,
          config.startDate,
          config.endDate,
          config.timeframe
        );
        
        sendJSON(res, 200, {
          valid: true,
          config: {
            symbols: config.symbols,
            timeframe: config.timeframe,
            startDate: config.startDate,
            endDate: config.endDate,
            duration: Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24))
          },
          dataAvailability: availability
        });
        return true;
        
      } catch (error) {
        sendJSON(res, 400, {
          valid: false,
          error: error instanceof Error ? error.message : String(error)
        });
        return true;
      }
    }
  }
  
  // Mock endpoint to simulate completed backtest results (for testing)
  if (pathname === '/api/backtesting/mock-results') {
    if (req.method === 'GET') {
      const mockResults: Partial<BacktestResults> = {
        backtestId: 'mock_' + Date.now(),
        startTime: new Date(Date.now() - 5000),
        endTime: new Date(),
        duration: 5000,
        totalBars: 1000,
        tradingDays: 250,
        initialValue: 10000,
        finalValue: 12345,
        totalReturn: 2345,
        totalReturnPercent: 23.45,
        annualizedReturn: 23.45,
        compoundAnnualGrowthRate: 22.8,
        volatility: 18.5,
        maxDrawdown: 876,
        maxDrawdownPercent: 12.3,
        maxDrawdownDuration: 45,
        calmarRatio: 1.9,
        sharpeRatio: 1.27,
        sortinoRatio: 1.45,
        informationRatio: 0.85,
        treynorRatio: 0.95,
        skewness: 0.23,
        kurtosis: 2.1,
        valueAtRisk95: 3.2,
        conditionalValueAtRisk95: 4.8,
        totalTrades: 142,
        winningTrades: 89,
        losingTrades: 53,
        winRate: 62.7,
        profitFactor: 1.85,
        averageWin: 45.2,
        averageLoss: -28.3,
        averageTrade: 16.5,
        largestWin: 234.5,
        largestLoss: -123.4,
        averageHoldingPeriod: 18.5,
        expectancy: 16.5,
        systemQualityNumber: 2.1,
        recoveryFactor: 2.7,
        payoffRatio: 1.6,
        winningMonths: 8,
        losingMonths: 4,
        bestMonth: 15.6,
        worstMonth: -8.9,
        winningWeeks: 32,
        losingWeeks: 20,
        totalCommission: 85.4,
        totalSlippage: 120.8,
        averageSlippageBps: 8.5,
        fillRate: 98.5,
        equityCurve: Array.from({ length: 12 }, (_, i) => ({
          timestamp: new Date(2023, i, 1),
          equity: 10000 + (i * 195) + (Math.random() * 500 - 250),
          drawdown: Math.random() * -10,
          dailyReturn: (Math.random() - 0.5) * 0.04
        })),
        trades: [],
        portfolioSnapshots: [],
        monthlyReturns: Array.from({ length: 12 }, (_, i) => ({
          period: `2023-${String(i + 1).padStart(2, '0')}`,
          return: (Math.random() - 0.3) * 20,
          volatility: 15 + Math.random() * 10,
          sharpe: Math.random() * 2,
          maxDrawdown: Math.random() * 15
        })),
        performanceAttribution: {
          'BTC-USD': { totalReturn: 1200, trades: 45, winRate: 64, avgTrade: 26.7 },
          'ETH-USD': { totalReturn: 980, trades: 38, winRate: 61, avgTrade: 25.8 },
          'SOL-USD': { totalReturn: 165, trades: 59, winRate: 59, avgTrade: 2.8 }
        },
        errors: []
      };
      
      sendJSON(res, 200, mockResults);
      return true;
    }
  }
  
  return false;
}

export default handleBacktestingRoute;