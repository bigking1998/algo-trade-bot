import * as http from 'http';
import MetricsManager from './MetricsManager';

/**
 * HTTP metrics middleware for capturing request performance
 */
export function metricsMiddleware(req: http.IncomingMessage, res: http.ServerResponse, next: () => void) {
  const startTime = process.hrtime.bigint();
  const metricsManager = MetricsManager.getInstance();
  
  // Extract route and method
  const method = req.method || 'UNKNOWN';
  const url = req.url || '/';
  const route = extractRoute(url);
  
  // Increment active connections
  metricsManager.activeConnections.inc();
  
  // Hook into response finish event
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9; // Convert to seconds
    const statusCode = res.statusCode || 500;
    
    // Record metrics
    metricsManager.recordHttpRequest(method, route, statusCode, duration);
    metricsManager.activeConnections.dec();
  });
  
  // Hook into response close event (for failed requests)
  res.on('close', () => {
    if (!res.finished) {
      metricsManager.activeConnections.dec();
    }
  });
  
  next();
}

/**
 * Extract normalized route from URL for better metric grouping
 */
function extractRoute(url: string): string {
  // Remove query parameters
  const path = url.split('?')[0];
  
  // Normalize common API patterns
  if (path.startsWith('/api/dydx/')) {
    if (path.includes('/candles/')) return '/api/dydx/candles/:symbol';
    if (path.includes('/markets/')) return '/api/dydx/markets/:symbol';
    if (path.includes('/orderbook/')) return '/api/dydx/orderbook/:symbol';
    return path;
  }
  
  if (path.startsWith('/api/backtesting/')) {
    if (path.includes('/run')) return '/api/backtesting/run';
    if (path.includes('/results/')) return '/api/backtesting/results/:id';
    return '/api/backtesting';
  }
  
  if (path.startsWith('/api/ml/')) {
    if (path.includes('/predict')) return '/api/ml/predict';
    if (path.includes('/train')) return '/api/ml/train';
    if (path.includes('/models/')) return '/api/ml/models/:id';
    return '/api/ml';
  }
  
  // Common API endpoints
  if (path === '/api/health') return '/api/health';
  if (path === '/api/metrics') return '/api/metrics';
  if (path === '/api/positions') return '/api/positions';
  if (path === '/api/trading/performance') return '/api/trading/performance';
  
  return path;
}

/**
 * Database query instrumentation wrapper
 */
export function instrumentDbQuery<T>(
  queryType: string,
  table: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();
  const metricsManager = MetricsManager.getInstance();
  
  return queryFn()
    .then(result => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      metricsManager.recordDbQuery(queryType, table, duration);
      return result;
    })
    .catch(error => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      metricsManager.recordDbQuery(queryType + '_error', table, duration);
      throw error;
    });
}

/**
 * ML model inference instrumentation wrapper
 */
export function instrumentMlInference<T>(
  modelName: string,
  inferenceFn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();
  const metricsManager = MetricsManager.getInstance();
  
  return inferenceFn()
    .then(result => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      metricsManager.updateMlModelMetrics(modelName, { inferenceDuration: duration });
      return result;
    })
    .catch(error => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      metricsManager.updateMlModelMetrics(modelName, { inferenceDuration: duration });
      throw error;
    });
}

/**
 * Trading operation instrumentation wrapper
 */
export function instrumentTradingOperation<T>(
  operationType: string,
  exchange: string,
  operationFn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();
  const metricsManager = MetricsManager.getInstance();
  
  return operationFn()
    .then(result => {
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1e9;
      
      if (operationType.includes('order')) {
        metricsManager.recordOrder(operationType, exchange, latency, true);
      }
      
      return result;
    })
    .catch(error => {
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1e9;
      
      if (operationType.includes('order')) {
        metricsManager.recordOrder(operationType, exchange, latency, false, error.message);
      }
      
      throw error;
    });
}

/**
 * Periodic metrics collector for system stats
 */
export class PeriodicMetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  private metricsManager: MetricsManager;
  
  constructor() {
    this.metricsManager = MetricsManager.getInstance();
  }
  
  start(intervalMs: number = 30000) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.intervalId = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
    
    // Collect initial metrics
    this.collectSystemMetrics();
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private collectSystemMetrics() {
    try {
      // Update market data timestamp
      this.metricsManager.tradingBotLastMarketDataTimestamp.set(Date.now() / 1000);
      
      // Simulate some trading metrics (replace with real data collection)
      this.collectTradingMetrics();
      this.collectSystemHealthMetrics();
    } catch (error) {
      console.error('Error collecting periodic metrics:', error);
    }
  }
  
  private collectTradingMetrics() {
    // This would be replaced with actual data collection from trading systems
    // For now, we'll set some mock values to demonstrate the metrics
    
    // Example: Portfolio value and PnL tracking
    const mockPortfolioValue = 100000; // $100k
    const mockDailyPnl = Math.random() * 2000 - 1000; // Random daily PnL
    const mockTotalPnl = Math.random() * 10000; // Random total PnL
    const mockWinRate = 0.65; // 65% win rate
    const mockSharpeRatio = 1.2;
    const mockMaxDrawdown = 0.05; // 5% max drawdown
    
    this.metricsManager.updateTradingPerformance({
      portfolioValue: mockPortfolioValue,
      dailyPnl: mockDailyPnl,
      totalPnl: mockTotalPnl,
      winRate: mockWinRate,
      sharpeRatio: mockSharpeRatio,
      maxDrawdown: mockMaxDrawdown
    });
  }
  
  private collectSystemHealthMetrics() {
    // Memory usage in MB
    const memUsage = process.memoryUsage();
    
    // WebSocket connections (mock)
    this.metricsManager.tradingBotWebsocketConnections.set({ exchange: 'dydx', channel: 'orderbook' }, 1);
    this.metricsManager.tradingBotWebsocketConnections.set({ exchange: 'dydx', channel: 'trades' }, 1);
    
    // Exchange API health (mock)
    this.metricsManager.updateExchangeApiMetrics('dydx', 0.99, 1000, 0.05);
  }
}