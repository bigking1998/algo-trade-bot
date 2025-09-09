/**
 * Mock Data Generator - Task TE-001
 * 
 * Provides comprehensive test data generation for all trading entities.
 * Supports realistic market scenarios, portfolio states, trade histories,
 * and strategy configurations for testing purposes.
 */

import { 
  OHLCV, 
  PortfolioState, 
  Trade, 
  StrategyConfiguration, 
  StrategyType,
  Position,
  ActiveOrder
} from '@/shared/types/trading';

/**
 * Configuration for market data generation
 */
export interface MarketDataConfig {
  count: number;
  basePrice?: number;
  volatility?: number;
  trend?: 'up' | 'down' | 'sideways';
  startTime?: Date;
  intervalMs?: number;
}

/**
 * Configuration for portfolio generation
 */
export interface PortfolioConfig {
  totalValue: number;
  positionCount?: number;
  availableBalanceRatio?: number;
  symbols?: string[];
}

/**
 * Configuration for trade generation
 */
export interface TradeConfig {
  count: number;
  winRate?: number;
  avgReturn?: number;
  symbols?: string[];
  startDate?: Date;
  endDate?: Date;
}

/**
 * Mock data generator for comprehensive testing
 */
export class MockDataGenerator {
  private static readonly DEFAULT_SYMBOLS = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD',
    'ADA-USD', 'DOT-USD', 'LINK-USD', 'UNI-USD', 'ATOM-USD'
  ];

  /**
   * Generate realistic OHLCV market data
   */
  static generateOHLCV(config: MarketDataConfig): OHLCV[] {
    const {
      count,
      basePrice = 100,
      volatility = 0.02,
      trend = 'sideways',
      startTime = new Date(),
      intervalMs = 60000 // 1 minute
    } = config;

    const data: OHLCV[] = [];
    let currentPrice = basePrice;
    const trendMultiplier = trend === 'up' ? 0.0005 : trend === 'down' ? -0.0005 : 0;
    
    for (let i = 0; i < count; i++) {
      // Apply trend component
      const trendComponent = trendMultiplier * currentPrice;
      
      // Add random volatility
      const randomComponent = (Math.random() - 0.5) * 2 * volatility * currentPrice;
      
      // Calculate new close price
      const newClose = Math.max(0.01, currentPrice + trendComponent + randomComponent);
      
      // Generate realistic OHLC values
      const volatilityRange = volatility * currentPrice * 0.5;
      const high = Math.max(currentPrice, newClose) + Math.random() * volatilityRange;
      const low = Math.min(currentPrice, newClose) - Math.random() * volatilityRange;
      const open = currentPrice;
      
      // Ensure OHLC relationships are valid
      const validHigh = Math.max(open, newClose, high);
      const validLow = Math.min(open, newClose, Math.max(0.01, low));
      
      // Generate realistic volume
      const baseVolume = 100000;
      const volumeVariation = 0.5;
      const volume = baseVolume * (1 + (Math.random() - 0.5) * volumeVariation);
      
      data.push({
        timestamp: startTime.getTime() + i * intervalMs,
        open: open,
        high: validHigh,
        low: validLow,
        close: newClose,
        volume: Math.round(volume)
      });
      
      currentPrice = newClose;
    }
    
    return data;
  }

  /**
   * Generate market data with specific patterns
   */
  static generatePatternedOHLCV(
    pattern: 'bullish_breakout' | 'bearish_breakdown' | 'consolidation' | 'volatile',
    count: number,
    basePrice: number = 100
  ): OHLCV[] {
    switch (pattern) {
      case 'bullish_breakout':
        return this.generateBreakoutPattern(count, basePrice, 'bullish');
      case 'bearish_breakdown':
        return this.generateBreakoutPattern(count, basePrice, 'bearish');
      case 'consolidation':
        return this.generateConsolidationPattern(count, basePrice);
      case 'volatile':
        return this.generateOHLCV({
          count,
          basePrice,
          volatility: 0.05, // High volatility
          trend: 'sideways'
        });
      default:
        return this.generateOHLCV({ count, basePrice });
    }
  }

  /**
   * Generate portfolio state with realistic positions
   */
  static generatePortfolio(config: PortfolioConfig): PortfolioState {
    const {
      totalValue,
      positionCount = 5,
      availableBalanceRatio = 0.2,
      symbols = this.DEFAULT_SYMBOLS.slice(0, positionCount)
    } = config;

    const availableBalance = totalValue * availableBalanceRatio;
    const positionValue = (totalValue - availableBalance) / positionCount;
    
    const positions: Position[] = symbols.slice(0, positionCount).map((symbol, index) => {
      const price = 100 + Math.random() * 900; // Random price between 100-1000
      const size = positionValue / price;
      const side = Math.random() > 0.5 ? 'long' : 'short';
      const unrealizedPnl = (Math.random() - 0.5) * positionValue * 0.1; // ±10% unrealized P&L
      
      const currentPrice = price + (Math.random() - 0.5) * price * 0.05;
      const unrealizedPnL = (currentPrice - price) * size;
      const now = new Date();
      
      return {
        id: `pos_${index + 1}`,
        strategyId: `strategy_${index % 3 + 1}`,
        symbol,
        side,
        size,
        quantity: size, // Legacy compatibility
        entryPrice: price,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent: (unrealizedPnL / (price * size)) * 100,
        realizedPnL: 0,
        totalPnL: unrealizedPnL,
        pnlPercent: (unrealizedPnL / (price * size)) * 100,
        marketValue: currentPrice * size,
        openedAt: now, // Legacy compatibility
        entryTime: now, // BE-007 standard
        lastUpdatedAt: now,
        holdingPeriod: 0,
        metadata: {},
        status: 'open' as const
      };
    });

    return {
      totalValue,
      availableBalance,
      totalPnL: (Math.random() - 0.3) * totalValue * 0.05, // -1.5% to +3.5% total P&L
      totalPnLPercent: ((Math.random() - 0.3) * 0.05) * 100, // Convert to percentage
      positions,
      orders: [], // Empty active orders for mock data
      lastUpdated: new Date()
    };
  }

  /**
   * Generate trade history with specified characteristics
   */
  static generateTrades(config: TradeConfig): Trade[] {
    const {
      count,
      winRate = 0.6,
      avgReturn = 0.02,
      symbols = this.DEFAULT_SYMBOLS,
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date()
    } = config;

    const trades: Trade[] = [];
    const timeSpan = endDate.getTime() - startDate.getTime();
    
    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const isWin = Math.random() < winRate;
      
      // Generate realistic trade parameters
      const entryPrice = 50 + Math.random() * 950; // Price between 50-1000
      const size = 0.1 + Math.random() * 9.9; // Size between 0.1-10
      
      // Calculate exit price based on win/loss and average return
      const returnMultiplier = isWin ? 
        (1 + avgReturn + (Math.random() - 0.5) * avgReturn) :
        (1 - avgReturn - Math.random() * avgReturn);
      
      const exitPrice = entryPrice * returnMultiplier;
      const pnl = (exitPrice - entryPrice) * size * (side === 'SELL' ? -1 : 1);
      
      const entryTime = new Date(startDate.getTime() + (timeSpan * i) / count);
      const exitTime = new Date(entryTime.getTime() + Math.random() * 3600000); // Exit within 1 hour
      
      trades.push({
        id: `trade_${i + 1}`,
        symbol,
        side: side,
        type: 'MARKET',
        quantity: size,
        price: entryPrice,
        timestamp: entryTime,
        strategyId: `strategy_${(i % 3) + 1}`,
        orderId: `order_${i + 1}`,
        fees: size * entryPrice * 0.001, // 0.1% fees
        commission: size * entryPrice * 0.001 // 0.1% commission (legacy)
      });
    }
    
    // Sort trades by timestamp
    return trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate strategy configuration
   */
  static generateStrategy(type: StrategyType): StrategyConfiguration {
    const baseConfig = {
      id: `strategy_${Date.now()}`,
      name: `${type}_strategy`,
      type,
      parameters: {},
      riskConfig: {
        maxRiskPerTrade: 0.02,
        maxPortfolioRisk: 0.1,
        stopLossType: 'fixed' as const,
        takeProfitType: 'fixed' as const,
        positionSizing: 'fixed' as const
      },
      executionConfig: {
        orderType: 'MARKET' as OrderType,
        slippage: 0.001,
        timeout: 5000,
        retries: 3
      },
      monitoringConfig: {
        enableAlerts: true,
        alertChannels: ['email'],
        healthCheckInterval: 60000,
        performanceReviewInterval: 3600000
      }
    };

    switch (type) {
      case 'MOMENTUM':
        return {
          ...baseConfig,
          type: 'MOMENTUM' as StrategyType,
          parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            minTrendStrength: 0.3,
            stopLossPercent: 0.02,
            takeProfitPercent: 0.04
          }
        };

      case 'MEAN_REVERSION':
        return {
          ...baseConfig,
          type: 'MEAN_REVERSION' as StrategyType,
          parameters: {
            rsiPeriod: 14,
            overboughtLevel: 70,
            oversoldLevel: 30,
            bbPeriod: 20,
            bbStdDev: 2.0,
            stopLossPercent: 0.015,
            takeProfitPercent: 0.03
          }
        };

      case 'BREAKOUT':
        return {
          ...baseConfig,
          type: 'MOMENTUM' as StrategyType,
          parameters: {
            momentumPeriod: 10,
            minMomentum: 0.02,
            volumeThreshold: 1.5,
            breakoutConfirmation: 3,
            stopLossPercent: 0.025,
            takeProfitPercent: 0.05
          }
        };

      case 'ARBITRAGE':
        return {
          ...baseConfig,
          type: 'ARBITRAGE' as StrategyType,
          parameters: {
            minSpread: 0.001,
            maxSlippage: 0.0005,
            minVolume: 1000,
            maxLatency: 100,
            exchanges: ['dydx', 'binance', 'coinbase']
          }
        };

      case 'CUSTOM':
        return {
          ...baseConfig,
          parameters: {
            modelType: 'lstm',
            lookbackPeriod: 60,
            predictionHorizon: 5,
            confidenceThreshold: 0.7,
            featureCount: 20,
            retrainInterval: 24 * 60 * 60 * 1000 // 24 hours
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Generate orders for testing
   */
  static generateActiveOrders(
    count: number, 
    symbols: string[] = this.DEFAULT_SYMBOLS.slice(0, 5)
  ): ActiveOrder[] {
    const orders: ActiveOrder[] = [];
    const statuses = ['PENDING', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED'] as const;
    const types = ['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT', 'STOP_LIMIT'] as const;
    const sides = ['BUY', 'SELL'] as const;
    
    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const price = 50 + Math.random() * 950;
      const quantity = 0.1 + Math.random() * 9.9;
      const filledQuantity = status === 'FILLED' ? quantity : Math.random() * quantity;
      
      orders.push({
        id: `order_${i + 1}`,
        symbol,
        side,
        type,
        quantity,
        price: type === 'MARKET' ? undefined : price,
        stopPrice: type.includes('STOP') ? price * 0.95 : undefined,
        filledQuantity,
        remainingQuantity: quantity - filledQuantity,
        status,
        timeInForce: 'GTC' as const,
        createdAt: Date.now() - Math.random() * 24 * 60 * 60 * 1000, // Random time in last 24h
        updatedAt: Date.now() - Math.random() * 12 * 60 * 60 * 1000, // Updated within last 12h
        reduceOnly: Math.random() > 0.8
      });
    }
    
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Generate ML feature data for testing
   */
  static generateMLFeatures(count: number): {
    technical: Record<string, number>;
    fundamental: Record<string, number>;
    sentiment: Record<string, number>;
  }[] {
    const features = [];
    
    for (let i = 0; i < count; i++) {
      features.push({
        technical: {
          sma_20: 95 + Math.random() * 10,
          ema_12: 96 + Math.random() * 8,
          rsi_14: Math.random() * 100,
          macd: (Math.random() - 0.5) * 2,
          bb_upper: 105 + Math.random() * 5,
          bb_lower: 85 + Math.random() * 5,
          volume_ratio: 0.5 + Math.random(),
          volatility: Math.random() * 0.05
        },
        fundamental: {
          market_cap_rank: Math.floor(Math.random() * 100) + 1,
          trading_volume_24h: Math.random() * 1000000,
          price_change_24h: (Math.random() - 0.5) * 0.2,
          social_volume: Math.random() * 1000,
          developer_activity: Math.random() * 100
        },
        sentiment: {
          news_sentiment: (Math.random() - 0.5) * 2,
          social_sentiment: (Math.random() - 0.5) * 2,
          fear_greed_index: Math.random() * 100,
          funding_rate: (Math.random() - 0.5) * 0.001,
          open_interest_change: (Math.random() - 0.5) * 0.1
        }
      });
    }
    
    return features;
  }

  /**
   * Generate performance metrics for testing
   */
  static generatePerformanceMetrics(trades: Trade[]): {
    totalTrades: number;
    winRate: number;
    avgReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    totalPnl: number;
  } {
    const totalTrades = trades.length;
    // Calculate PnL for each trade (simple random calculation for testing)
    const tradesWithPnl = trades.map(t => ({
      ...t,
      pnl: (Math.random() - 0.5) * t.price * t.quantity * 0.1 // Random PnL for testing
    }));
    
    const winningTrades = tradesWithPnl.filter(t => t.pnl > 0);
    const losingTrades = tradesWithPnl.filter(t => t.pnl <= 0);
    
    const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
    const totalPnl = tradesWithPnl.reduce((sum, t) => sum + t.pnl, 0);
    const avgReturn = totalTrades > 0 ? totalPnl / totalTrades : 0;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    // Simulate other metrics
    const maxDrawdown = Math.random() * 0.2; // Up to 20% drawdown
    const sharpeRatio = 0.5 + Math.random() * 2; // Sharpe ratio between 0.5-2.5
    
    return {
      totalTrades,
      winRate,
      avgReturn,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      totalPnl
    };
  }

  // Private helper methods

  private static generateBreakoutPattern(
    count: number, 
    basePrice: number, 
    direction: 'bullish' | 'bearish'
  ): OHLCV[] {
    const data: OHLCV[] = [];
    let currentPrice = basePrice;
    const consolidationPeriod = Math.floor(count * 0.6);
    const breakoutPeriod = count - consolidationPeriod;
    
    // Consolidation phase
    for (let i = 0; i < consolidationPeriod; i++) {
      const volatility = 0.005; // Low volatility
      const change = (Math.random() - 0.5) * 2 * volatility * currentPrice;
      const newPrice = Math.max(0.01, currentPrice + change);
      
      data.push(this.createCandle(currentPrice, newPrice, i));
      currentPrice = newPrice;
    }
    
    // Breakout phase
    const breakoutMultiplier = direction === 'bullish' ? 0.003 : -0.003;
    for (let i = consolidationPeriod; i < count; i++) {
      const trendComponent = breakoutMultiplier * currentPrice;
      const volatility = 0.015; // Higher volatility during breakout
      const randomComponent = (Math.random() - 0.5) * 2 * volatility * currentPrice;
      const newPrice = Math.max(0.01, currentPrice + trendComponent + randomComponent);
      
      data.push(this.createCandle(currentPrice, newPrice, i));
      currentPrice = newPrice;
    }
    
    return data;
  }

  private static generateConsolidationPattern(count: number, basePrice: number): OHLCV[] {
    const data: OHLCV[] = [];
    let currentPrice = basePrice;
    const consolidationRange = basePrice * 0.05; // 5% range
    const midPoint = basePrice;
    
    for (let i = 0; i < count; i++) {
      // Keep price within consolidation range
      const targetPrice = midPoint + (Math.random() - 0.5) * consolidationRange;
      const pullTowardsTarget = (targetPrice - currentPrice) * 0.1;
      const randomComponent = (Math.random() - 0.5) * basePrice * 0.005;
      
      const newPrice = Math.max(0.01, currentPrice + pullTowardsTarget + randomComponent);
      
      data.push(this.createCandle(currentPrice, newPrice, i));
      currentPrice = newPrice;
    }
    
    return data;
  }

  private static createCandle(open: number, close: number, index: number): OHLCV {
    const high = Math.max(open, close) * (1 + Math.random() * 0.002);
    const low = Math.min(open, close) * (1 - Math.random() * 0.002);
    const volume = 50000 + Math.random() * 100000;
    
    return {
      timestamp: Date.now() + index * 60000,
      open,
      high,
      low,
      close,
      volume: Math.round(volume)
    };
  }

  // Additional methods for performance testing

  /**
   * Generate market tick data for real-time testing
   */
  static generateMarketTick(): any {
    const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    return {
      symbol,
      price: Math.random() * 50000 + 10000,
      volume: Math.random() * 10,
      timestamp: Date.now(),
      type: 'price_update'
    };
  }

  /**
   * Generate multiple market ticks
   */
  static generateMarketTicks(config: { count: number; symbols: string[] }): any[] {
    const ticks: any[] = [];
    
    for (let i = 0; i < config.count; i++) {
      const symbol = config.symbols[i % config.symbols.length];
      ticks.push({
        symbol,
        price: Math.random() * 50000 + 10000,
        volume: Math.random() * 10,
        timestamp: Date.now() + i,
        type: 'price_update'
      });
    }
    
    return ticks;
  }

  /**
   * Generate strategy context for testing
   */
  static generateStrategyContext(config: {
    complexity: string;
    indicatorCount: number;
    dataPoints: number;
  }): any {
    return {
      complexity: config.complexity,
      marketData: this.generateOHLCV({ count: config.dataPoints }),
      indicators: Array.from({ length: config.indicatorCount }, (_, i) => ({
        name: `indicator_${i}`,
        value: Math.random() * 100,
        isValid: true
      })),
      timestamp: new Date()
    };
  }

  /**
   * Generate database query for testing
   */
  static generateDatabaseQuery(queryType: string): any {
    return {
      type: queryType,
      sql: `SELECT * FROM ${queryType}_table WHERE id = ?`,
      params: [Math.floor(Math.random() * 1000)],
      expectedTime: Math.random() * 10 + 1
    };
  }

  /**
   * Generate WebSocket message for testing
   */
  static generateWebSocketMessage(messageType: string): any {
    return {
      type: messageType,
      data: {
        symbol: 'BTC-USD',
        price: Math.random() * 50000 + 10000,
        volume: Math.random() * 10,
        timestamp: Date.now()
      },
      id: `msg_${Date.now()}_${Math.random()}`
    };
  }

  /**
   * Generate ML feature vectors for testing
   */
  static generateMLFeatureVectors(config: { count: number; featureCount: number }): any[] {
    const features: any[] = [];
    
    for (let i = 0; i < config.count; i++) {
      const featureVector: any = {};
      
      for (let j = 0; j < config.featureCount; j++) {
        featureVector[`feature_${j}`] = Math.random() * 2 - 1; // -1 to 1
      }
      
      features.push(featureVector);
    }
    
    return features;
  }

  /**
   * Generate trading scenarios for testing
   */
  static generateTradingScenarios(config: { count: number; complexity: string }): any[] {
    const scenarios: any[] = [];
    
    for (let i = 0; i < config.count; i++) {
      scenarios.push({
        id: `scenario_${i}`,
        marketData: this.generateOHLCV({ count: 100 }),
        strategy: {
          name: `strategy_${i % 5}`,
          complexity: config.complexity,
          parameters: {
            period: Math.floor(Math.random() * 20) + 5,
            threshold: Math.random() * 0.1
          }
        },
        riskRules: {
          maxDrawdown: Math.random() * 0.1 + 0.05,
          positionSize: Math.random() * 0.2 + 0.1
        },
        executionSettings: {
          slippage: Math.random() * 0.001,
          latency: Math.random() * 10
        }
      });
    }
    
    return scenarios;
  }

  /**
   * Generate market update for UI testing
   */
  static generateMarketUpdate(): any {
    return {
      type: 'market_update',
      symbol: 'BTC-USD',
      price: Math.random() * 50000 + 10000,
      volume: Math.random() * 100,
      change24h: (Math.random() - 0.5) * 0.1,
      timestamp: Date.now(),
      orderBook: {
        bids: Array.from({ length: 5 }, () => [
          Math.random() * 50000,
          Math.random() * 10
        ]),
        asks: Array.from({ length: 5 }, () => [
          Math.random() * 50000,
          Math.random() * 10
        ])
      }
    };
  }

  /**
   * Generate single trade for testing
   */
  static generateTrade(): Trade {
    const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      strategyId: `strategy_${Math.floor(Math.random() * 5)}`,
      symbol,
      side: Math.random() > 0.5 ? 'BUY' : 'SELL',
      type: (Math.random() > 0.5 ? 'MARKET' : 'LIMIT') as OrderType,
      quantity: Math.random() * 10,
      price: Math.random() * 50000 + 10000,
      timestamp: new Date(),
      fees: Math.random() * 10,
      commission: Math.random() * 10,
    };
  }
}

export default MockDataGenerator;