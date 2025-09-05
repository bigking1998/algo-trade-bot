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
  Order,
  OrderType,
  OrderSide,
  OrderStatus
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
        time: new Date(startTime.getTime() + i * intervalMs),
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
      
      return {
        id: `pos_${index + 1}`,
        symbol,
        side,
        size,
        entryPrice: price,
        currentPrice: price + (Math.random() - 0.5) * price * 0.05,
        unrealizedPnl,
        timestamp: new Date(),
        strategyId: `strategy_${index % 3 + 1}`
      };
    });

    return {
      totalValue,
      availableBalance,
      positions,
      timestamp: new Date(),
      dailyPnl: (Math.random() - 0.5) * totalValue * 0.02, // ±2% daily P&L
      totalPnl: (Math.random() - 0.3) * totalValue * 0.05, // -1.5% to +3.5% total P&L
      marginUsed: totalValue * (1 - availableBalanceRatio) * 0.1, // 10% margin usage
      marginAvailable: availableBalance * 0.8
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
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const isWin = Math.random() < winRate;
      
      // Generate realistic trade parameters
      const entryPrice = 50 + Math.random() * 950; // Price between 50-1000
      const size = 0.1 + Math.random() * 9.9; // Size between 0.1-10
      
      // Calculate exit price based on win/loss and average return
      const returnMultiplier = isWin ? 
        (1 + avgReturn + (Math.random() - 0.5) * avgReturn) :
        (1 - avgReturn - Math.random() * avgReturn);
      
      const exitPrice = entryPrice * returnMultiplier;
      const pnl = (exitPrice - entryPrice) * size * (side === 'sell' ? -1 : 1);
      
      const entryTime = new Date(startDate.getTime() + (timeSpan * i) / count);
      const exitTime = new Date(entryTime.getTime() + Math.random() * 3600000); // Exit within 1 hour
      
      trades.push({
        id: `trade_${i + 1}`,
        symbol,
        side,
        size,
        entryPrice,
        exitPrice,
        entryTime,
        exitTime,
        pnl,
        commission: size * entryPrice * 0.001, // 0.1% commission
        strategyId: `strategy_${(i % 3) + 1}`,
        status: 'closed'
      });
    }
    
    // Sort trades by entry time
    return trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  }

  /**
   * Generate strategy configuration
   */
  static generateStrategy(type: StrategyType): StrategyConfiguration {
    const baseConfig = {
      id: `strategy_${Date.now()}`,
      name: `${type}_strategy`,
      type,
      enabled: true,
      symbols: this.DEFAULT_SYMBOLS.slice(0, 3),
      timeframes: ['1m', '5m', '15m'],
      maxPositions: 3,
      riskPerTrade: 0.02,
      parameters: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    switch (type) {
      case 'trend_following':
        return {
          ...baseConfig,
          parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            minTrendStrength: 0.3,
            stopLossPercent: 0.02,
            takeProfitPercent: 0.04
          }
        };

      case 'mean_reversion':
        return {
          ...baseConfig,
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

      case 'momentum':
        return {
          ...baseConfig,
          parameters: {
            momentumPeriod: 10,
            minMomentum: 0.02,
            volumeThreshold: 1.5,
            breakoutConfirmation: 3,
            stopLossPercent: 0.025,
            takeProfitPercent: 0.05
          }
        };

      case 'arbitrage':
        return {
          ...baseConfig,
          parameters: {
            minSpread: 0.001,
            maxSlippage: 0.0005,
            minVolume: 1000,
            maxLatency: 100,
            exchanges: ['dydx', 'binance', 'coinbase']
          }
        };

      case 'ml_based':
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
  static generateOrders(
    count: number, 
    symbols: string[] = this.DEFAULT_SYMBOLS.slice(0, 5)
  ): Order[] {
    const orders: Order[] = [];
    const statuses: OrderStatus[] = ['pending', 'filled', 'cancelled', 'rejected'];
    const types: OrderType[] = ['market', 'limit', 'stop', 'stop_limit'];
    const sides: OrderSide[] = ['buy', 'sell'];
    
    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const price = 50 + Math.random() * 950;
      const size = 0.1 + Math.random() * 9.9;
      
      orders.push({
        id: `order_${i + 1}`,
        symbol,
        side,
        type,
        size,
        price: type === 'market' ? undefined : price,
        stopPrice: type.includes('stop') ? price * 0.95 : undefined,
        status,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Random time in last 24h
        strategyId: `strategy_${(i % 3) + 1}`,
        filledSize: status === 'filled' ? size : Math.random() * size,
        averageFillPrice: status === 'filled' ? price * (0.99 + Math.random() * 0.02) : undefined
      });
    }
    
    return orders.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    
    const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
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
      time: new Date(Date.now() + index * 60000),
      open,
      high,
      low,
      close,
      volume: Math.round(volume)
    };
  }
}

export default MockDataGenerator;