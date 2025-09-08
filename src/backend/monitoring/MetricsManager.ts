import { register, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client';

/**
 * MetricsManager - Comprehensive metrics collection for trading bot
 * Provides performance monitoring, business metrics, and system health indicators
 */
class MetricsManager {
  private static instance: MetricsManager;
  
  // System Health Metrics
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsTotal: Counter<string>;
  public readonly activeConnections: Gauge<string>;
  public readonly dbConnectionsActive: Gauge<string>;
  public readonly dbConnectionsIdle: Gauge<string>;
  public readonly dbPoolSize: Gauge<string>;
  public readonly dbQueryDuration: Histogram<string>;
  
  // Trading Performance Metrics
  public readonly tradingBotTotalPnl: Gauge<string>;
  public readonly tradingBotDailyPnl: Gauge<string>;
  public readonly tradingBotWinRate: Gauge<string>;
  public readonly tradingBotSharpeRatio: Gauge<string>;
  public readonly tradingBotMaxDrawdown: Gauge<string>;
  public readonly tradingBotPositionSize: Gauge<string>;
  public readonly tradingBotStrategyPnl: Gauge<string>;
  public readonly tradingBotVolumeUsd: Gauge<string>;
  public readonly tradingBotTradesTotal: Counter<string>;
  public readonly tradingBotConsecutiveLosses: Counter<string>;
  
  // Order Execution Metrics
  public readonly tradingBotOrderLatency: Histogram<string>;
  public readonly tradingBotOrdersTotal: Counter<string>;
  public readonly tradingBotOrdersFailed: Counter<string>;
  public readonly tradingBotSlippagePercentage: Gauge<string>;
  
  // Exchange API Metrics
  public readonly tradingBotExchangeApiSuccessRate: Gauge<string>;
  public readonly tradingBotExchangeRateLimitRemaining: Gauge<string>;
  public readonly tradingBotNetworkLatency: Gauge<string>;
  
  // WebSocket Metrics
  public readonly tradingBotWebsocketConnections: Gauge<string>;
  public readonly tradingBotWebsocketMessages: Counter<string>;
  public readonly tradingBotLastMarketDataTimestamp: Gauge<string>;
  
  // ML Model Performance Metrics
  public readonly tradingBotMlModelAccuracy: Gauge<string>;
  public readonly tradingBotMlPredictionConfidence: Gauge<string>;
  public readonly tradingBotMlTrainingLoss: Gauge<string>;
  public readonly tradingBotMlFeatureImportance: Gauge<string>;
  public readonly tradingBotMlInferenceDuration: Histogram<string>;
  public readonly tradingBotMlDataDriftScore: Gauge<string>;
  public readonly tradingBotMlPredictionsTotal: Counter<string>;
  public readonly tradingBotMlPredictedValue: Gauge<string>;
  public readonly tradingBotMlActualValue: Gauge<string>;
  public readonly tradingBotMlModelVersion: Gauge<string>;
  public readonly tradingBotMlLastTrainingTimestamp: Gauge<string>;
  
  // Business Logic Metrics
  public readonly tradingBotRiskExposure: Gauge<string>;
  public readonly tradingBotLeverageRatio: Gauge<string>;
  public readonly tradingBotPortfolioValue: Gauge<string>;
  
  private constructor() {
    // Enable collection of default system metrics
    collectDefaultMetrics({ register });
    
    // System Health Metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register]
    });
    
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [register]
    });
    
    this.activeConnections = new Gauge({
      name: 'active_connections_total',
      help: 'Total number of active connections',
      registers: [register]
    });
    
    this.dbConnectionsActive = new Gauge({
      name: 'trading_bot_db_connections_active',
      help: 'Number of active database connections',
      registers: [register]
    });
    
    this.dbConnectionsIdle = new Gauge({
      name: 'trading_bot_db_connections_idle',
      help: 'Number of idle database connections',
      registers: [register]
    });
    
    this.dbPoolSize = new Gauge({
      name: 'trading_bot_db_pool_size',
      help: 'Database connection pool size',
      registers: [register]
    });
    
    this.dbQueryDuration = new Histogram({
      name: 'trading_bot_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [register]
    });
    
    // Trading Performance Metrics
    this.tradingBotTotalPnl = new Gauge({
      name: 'trading_bot_total_pnl',
      help: 'Total profit and loss in USD',
      registers: [register]
    });
    
    this.tradingBotDailyPnl = new Gauge({
      name: 'trading_bot_daily_pnl',
      help: 'Daily profit and loss in USD',
      registers: [register]
    });
    
    this.tradingBotWinRate = new Gauge({
      name: 'trading_bot_win_rate',
      help: 'Trading win rate (0-1)',
      registers: [register]
    });
    
    this.tradingBotSharpeRatio = new Gauge({
      name: 'trading_bot_sharpe_ratio',
      help: 'Sharpe ratio of trading performance',
      registers: [register]
    });
    
    this.tradingBotMaxDrawdown = new Gauge({
      name: 'trading_bot_max_drawdown',
      help: 'Maximum drawdown percentage (0-1)',
      registers: [register]
    });
    
    this.tradingBotPositionSize = new Gauge({
      name: 'trading_bot_position_size',
      help: 'Current position size in USD',
      labelNames: ['symbol', 'side'],
      registers: [register]
    });
    
    this.tradingBotStrategyPnl = new Gauge({
      name: 'trading_bot_strategy_pnl',
      help: 'Profit and loss by strategy',
      labelNames: ['strategy'],
      registers: [register]
    });
    
    this.tradingBotVolumeUsd = new Gauge({
      name: 'trading_bot_volume_usd',
      help: 'Trading volume in USD',
      registers: [register]
    });
    
    this.tradingBotTradesTotal = new Counter({
      name: 'trading_bot_trades_total',
      help: 'Total number of trades executed',
      labelNames: ['symbol', 'side', 'strategy'],
      registers: [register]
    });
    
    this.tradingBotConsecutiveLosses = new Counter({
      name: 'trading_bot_consecutive_losses',
      help: 'Number of consecutive losing trades',
      registers: [register]
    });
    
    // Order Execution Metrics
    this.tradingBotOrderLatency = new Histogram({
      name: 'trading_bot_order_latency_seconds',
      help: 'Order execution latency in seconds',
      labelNames: ['order_type', 'exchange'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
      registers: [register]
    });
    
    this.tradingBotOrdersTotal = new Counter({
      name: 'trading_bot_orders_total',
      help: 'Total number of orders placed',
      labelNames: ['order_type', 'status', 'exchange'],
      registers: [register]
    });
    
    this.tradingBotOrdersFailed = new Counter({
      name: 'trading_bot_orders_failed_total',
      help: 'Total number of failed orders',
      labelNames: ['reason', 'exchange'],
      registers: [register]
    });
    
    this.tradingBotSlippagePercentage = new Gauge({
      name: 'trading_bot_slippage_percentage',
      help: 'Average slippage percentage',
      labelNames: ['symbol'],
      registers: [register]
    });
    
    // Exchange API Metrics
    this.tradingBotExchangeApiSuccessRate = new Gauge({
      name: 'trading_bot_exchange_api_success_rate',
      help: 'Exchange API success rate (0-1)',
      labelNames: ['exchange'],
      registers: [register]
    });
    
    this.tradingBotExchangeRateLimitRemaining = new Gauge({
      name: 'trading_bot_exchange_rate_limit_remaining',
      help: 'Remaining API calls before rate limit',
      labelNames: ['exchange', 'endpoint'],
      registers: [register]
    });
    
    this.tradingBotNetworkLatency = new Gauge({
      name: 'trading_bot_network_latency_seconds',
      help: 'Network latency to exchange in seconds',
      labelNames: ['exchange'],
      registers: [register]
    });
    
    // WebSocket Metrics
    this.tradingBotWebsocketConnections = new Gauge({
      name: 'trading_bot_websocket_connections_active',
      help: 'Number of active WebSocket connections',
      labelNames: ['exchange', 'channel'],
      registers: [register]
    });
    
    this.tradingBotWebsocketMessages = new Counter({
      name: 'trading_bot_websocket_messages_total',
      help: 'Total WebSocket messages received',
      labelNames: ['exchange', 'channel', 'type'],
      registers: [register]
    });
    
    this.tradingBotLastMarketDataTimestamp = new Gauge({
      name: 'trading_bot_last_market_data_timestamp',
      help: 'Timestamp of last market data update',
      registers: [register]
    });
    
    // ML Model Performance Metrics
    this.tradingBotMlModelAccuracy = new Gauge({
      name: 'trading_bot_ml_model_accuracy',
      help: 'ML model accuracy (0-1)',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlPredictionConfidence = new Gauge({
      name: 'trading_bot_ml_prediction_confidence',
      help: 'ML prediction confidence score (0-1)',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlTrainingLoss = new Gauge({
      name: 'trading_bot_ml_training_loss',
      help: 'ML model training loss',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlFeatureImportance = new Gauge({
      name: 'trading_bot_ml_feature_importance',
      help: 'Feature importance scores for ML models',
      labelNames: ['feature_name', 'model'],
      registers: [register]
    });
    
    this.tradingBotMlInferenceDuration = new Histogram({
      name: 'trading_bot_ml_inference_duration_seconds',
      help: 'ML model inference duration in seconds',
      labelNames: ['model'],
      buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
      registers: [register]
    });
    
    this.tradingBotMlDataDriftScore = new Gauge({
      name: 'trading_bot_ml_data_drift_score',
      help: 'Data drift score for ML features (0-1)',
      labelNames: ['feature'],
      registers: [register]
    });
    
    this.tradingBotMlPredictionsTotal = new Counter({
      name: 'trading_bot_ml_predictions_total',
      help: 'Total ML predictions made',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlPredictedValue = new Gauge({
      name: 'trading_bot_ml_predicted_value',
      help: 'Latest ML predicted value',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlActualValue = new Gauge({
      name: 'trading_bot_ml_actual_value',
      help: 'Latest actual value for comparison',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlModelVersion = new Gauge({
      name: 'trading_bot_ml_model_version',
      help: 'Current ML model version',
      labelNames: ['model'],
      registers: [register]
    });
    
    this.tradingBotMlLastTrainingTimestamp = new Gauge({
      name: 'trading_bot_ml_last_training_timestamp',
      help: 'Timestamp of last model training',
      labelNames: ['model'],
      registers: [register]
    });
    
    // Business Logic Metrics
    this.tradingBotRiskExposure = new Gauge({
      name: 'trading_bot_risk_exposure',
      help: 'Current risk exposure in USD',
      labelNames: ['asset_class'],
      registers: [register]
    });
    
    this.tradingBotLeverageRatio = new Gauge({
      name: 'trading_bot_leverage_ratio',
      help: 'Current leverage ratio',
      registers: [register]
    });
    
    this.tradingBotPortfolioValue = new Gauge({
      name: 'trading_bot_portfolio_value',
      help: 'Total portfolio value in USD',
      registers: [register]
    });
  }
  
  public static getInstance(): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    return MetricsManager.instance;
  }
  
  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    const status = statusCode < 400 ? 'success' : 'error';
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }
  
  /**
   * Record database operation metrics
   */
  public recordDbQuery(queryType: string, table: string, duration: number) {
    this.dbQueryDuration.observe({ query_type: queryType, table }, duration);
  }
  
  /**
   * Update database connection pool metrics
   */
  public updateDbPoolMetrics(active: number, idle: number, total: number) {
    this.dbConnectionsActive.set(active);
    this.dbConnectionsIdle.set(idle);
    this.dbPoolSize.set(total);
  }
  
  /**
   * Record trading performance metrics
   */
  public updateTradingPerformance(data: {
    totalPnl?: number;
    dailyPnl?: number;
    winRate?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    portfolioValue?: number;
  }) {
    if (data.totalPnl !== undefined) this.tradingBotTotalPnl.set(data.totalPnl);
    if (data.dailyPnl !== undefined) this.tradingBotDailyPnl.set(data.dailyPnl);
    if (data.winRate !== undefined) this.tradingBotWinRate.set(data.winRate);
    if (data.sharpeRatio !== undefined) this.tradingBotSharpeRatio.set(data.sharpeRatio);
    if (data.maxDrawdown !== undefined) this.tradingBotMaxDrawdown.set(data.maxDrawdown);
    if (data.portfolioValue !== undefined) this.tradingBotPortfolioValue.set(data.portfolioValue);
  }
  
  /**
   * Record trade execution
   */
  public recordTrade(symbol: string, side: string, strategy: string, pnl?: number) {
    this.tradingBotTradesTotal.inc({ symbol, side, strategy });
    if (pnl !== undefined && pnl < 0) {
      this.tradingBotConsecutiveLosses.inc();
    }
  }
  
  /**
   * Record order execution metrics
   */
  public recordOrder(orderType: string, exchange: string, latency?: number, success: boolean = true, failureReason?: string) {
    const status = success ? 'filled' : 'failed';
    this.tradingBotOrdersTotal.inc({ order_type: orderType, status, exchange });
    
    if (latency !== undefined) {
      this.tradingBotOrderLatency.observe({ order_type: orderType, exchange }, latency);
    }
    
    if (!success && failureReason) {
      this.tradingBotOrdersFailed.inc({ reason: failureReason, exchange });
    }
  }
  
  /**
   * Record ML model performance
   */
  public updateMlModelMetrics(modelName: string, data: {
    accuracy?: number;
    confidence?: number;
    trainingLoss?: number;
    inferenceDuration?: number;
    predictedValue?: number;
    actualValue?: number;
  }) {
    if (data.accuracy !== undefined) {
      this.tradingBotMlModelAccuracy.set({ model: modelName }, data.accuracy);
    }
    if (data.confidence !== undefined) {
      this.tradingBotMlPredictionConfidence.set({ model: modelName }, data.confidence);
    }
    if (data.trainingLoss !== undefined) {
      this.tradingBotMlTrainingLoss.set({ model: modelName }, data.trainingLoss);
    }
    if (data.inferenceDuration !== undefined) {
      this.tradingBotMlInferenceDuration.observe({ model: modelName }, data.inferenceDuration);
    }
    if (data.predictedValue !== undefined) {
      this.tradingBotMlPredictedValue.set({ model: modelName }, data.predictedValue);
    }
    if (data.actualValue !== undefined) {
      this.tradingBotMlActualValue.set({ model: modelName }, data.actualValue);
    }
    
    this.tradingBotMlPredictionsTotal.inc({ model: modelName });
  }
  
  /**
   * Update exchange API metrics
   */
  public updateExchangeApiMetrics(exchange: string, successRate: number, rateLimitRemaining?: number, latency?: number) {
    this.tradingBotExchangeApiSuccessRate.set({ exchange }, successRate);
    if (rateLimitRemaining !== undefined) {
      this.tradingBotExchangeRateLimitRemaining.set({ exchange, endpoint: 'general' }, rateLimitRemaining);
    }
    if (latency !== undefined) {
      this.tradingBotNetworkLatency.set({ exchange }, latency);
    }
  }
  
  /**
   * Get metrics for Prometheus scraping
   */
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }
  
  /**
   * Reset all metrics (useful for testing)
   */
  public reset() {
    register.resetMetrics();
  }
}

export default MetricsManager;