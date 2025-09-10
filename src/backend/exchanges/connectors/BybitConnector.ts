/**
 * Bybit Exchange Connector - CCXT Integration
 * 
 * Production-grade connector for Bybit exchange featuring:
 * - CCXT library integration for unified API
 * - Advanced rate limiting with exchange-specific limits
 * - WebSocket streaming for real-time data
 * - Support for spot and derivatives trading
 * - Comprehensive order management and execution
 * - Error handling and reconnection logic
 * 
 * Performance Targets:
 * - Order execution latency < 100ms (co-located servers)
 * - 99.9% uptime reliability
 * - Rate limit compliance (Bybit specific limits)
 * - Memory usage < 25MB
 */

import ccxt from 'ccxt';
import WebSocket from 'ws';
import crypto from 'crypto';
import { BaseExchangeConnector } from '../BaseExchangeConnector.js';
import type {
  ExchangeConfig,
  ExchangeOrder,
  ExchangeBalance,
  ExchangeTradingFees,
  UnifiedMarketData,
  UnifiedOrderBook,
  OrderBookEntry
} from '../types.js';
import type { Order, OrderExecutionResult, OrderStatus } from '../../execution/OrderExecutor.js';

/**
 * Bybit-specific Configuration
 */
interface BybitConfig extends ExchangeConfig {
  ccxtConfig?: {
    rateLimit: number;
    enableRateLimit: boolean;
    sandbox: boolean;
    verbose: boolean;
  };
  tradingMode?: 'spot' | 'linear' | 'inverse' | 'option';
}

/**
 * Bybit WebSocket Message Types
 */
interface BybitWebSocketMessage {
  topic: string;
  type: string;
  data: any;
  ts: number;
}

/**
 * Bybit Exchange Connector
 */
export class BybitConnector extends BaseExchangeConnector {
  private ccxtExchange: ccxt.bybit;
  private wsConnection?: WebSocket;
  private subscriptions = new Set<string>();
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  
  // Market data cache
  private tickerCache = new Map<string, any>();
  private orderBookCache = new Map<string, any>();
  private tradesCache = new Map<string, any[]>();
  
  // Connection state
  private isConnected = false;
  private connectionPromise?: Promise<void>;
  private tradingMode: string;

  constructor(config: BybitConfig) {
    super(config);
    
    this.tradingMode = config.tradingMode || 'spot';
    
    // Initialize CCXT Bybit instance
    this.ccxtExchange = new ccxt.bybit({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      sandbox: config.ccxtConfig?.sandbox || false,
      rateLimit: config.ccxtConfig?.rateLimit || 120, // 50 requests per second for REST API
      enableRateLimit: config.ccxtConfig?.enableRateLimit || true,
      verbose: config.ccxtConfig?.verbose || false,
      options: {
        defaultType: this.tradingMode // 'spot', 'linear', 'inverse', 'option'
      },
      ...config.ccxtConfig
    });
  }

  /**
   * Connect to Bybit exchange
   */
  protected async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  private async establishConnection(): Promise<void> {
    try {
      // Test REST API connection
      await this.ccxtExchange.loadMarkets();
      
      // Initialize WebSocket connection for real-time data
      await this.connectWebSocket();
      
      this.isConnected = true;
      this.emit('connected', {
        exchangeId: 'bybit',
        timestamp: new Date()
      });
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to Bybit: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Connect to Bybit WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use appropriate WebSocket URL based on trading mode
        let wsUrl = 'wss://stream.bybit.com/v5/public/spot';
        
        if (this.tradingMode === 'linear') {
          wsUrl = 'wss://stream.bybit.com/v5/public/linear';
        } else if (this.tradingMode === 'inverse') {
          wsUrl = 'wss://stream.bybit.com/v5/public/inverse';
        } else if (this.tradingMode === 'option') {
          wsUrl = 'wss://stream.bybit.com/v5/public/option';
        }
        
        this.wsConnection = new WebSocket(wsUrl);
        
        this.wsConnection.on('open', () => {
          console.log('[Bybit] WebSocket connected');
          this.startPingPong();
          resolve();
        });
        
        this.wsConnection.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as BybitWebSocketMessage;
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('[Bybit] WebSocket message parsing error:', error);
          }
        });
        
        this.wsConnection.on('error', (error) => {
          console.error('[Bybit] WebSocket error:', error);
          this.handleWebSocketError(error);
        });
        
        this.wsConnection.on('close', (code, reason) => {
          console.log(`[Bybit] WebSocket disconnected: ${code} - ${reason}`);
          this.handleWebSocketClose();
        });
        
        // Set connection timeout
        setTimeout(() => {
          if (this.wsConnection?.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start ping-pong to keep connection alive
   */
  private startPingPong(): void {
    this.pingTimer = setInterval(() => {
      if (this.wsConnection?.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000); // Ping every 20 seconds
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    // Handle pong responses
    if (message.op === 'pong') {
      return;
    }
    
    // Handle subscription confirmations
    if (message.success) {
      console.log('[Bybit] Subscription confirmed:', message.ret_msg);
      return;
    }
    
    // Handle data updates
    if (message.topic && message.data) {
      if (message.topic.includes('tickers')) {
        this.updateTickerCache(message.topic, message.data);
      } else if (message.topic.includes('orderbook')) {
        this.updateOrderBookCache(message.topic, message.data);
      } else if (message.topic.includes('publicTrade')) {
        this.updateTradesCache(message.topic, message.data);
      }
    }
  }

  /**
   * Update ticker cache
   */
  private updateTickerCache(topic: string, data: any): void {
    // Extract symbol from topic
    const symbolMatch = topic.match(/tickers\.(.+)/);
    if (!symbolMatch) return;
    
    const symbol = symbolMatch[1];
    
    this.tickerCache.set(symbol, {
      ...data,
      timestamp: Date.now()
    });
    
    this.emit('ticker_update', {
      exchangeId: 'bybit',
      symbol,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Update order book cache
   */
  private updateOrderBookCache(topic: string, data: any): void {
    const symbolMatch = topic.match(/orderbook\.(\d+)\.(.+)/);
    if (!symbolMatch) return;
    
    const symbol = symbolMatch[2];
    
    // Handle snapshot or delta updates
    if (data.s) { // Snapshot
      this.orderBookCache.set(symbol, {
        bids: data.b || [],
        asks: data.a || [],
        timestamp: Date.now()
      });
    } else { // Delta update
      const existingBook = this.orderBookCache.get(symbol);
      if (existingBook) {
        // Apply delta updates
        if (data.b) {
          existingBook.bids = this.applyOrderBookDeltas(existingBook.bids, data.b);
        }
        if (data.a) {
          existingBook.asks = this.applyOrderBookDeltas(existingBook.asks, data.a);
        }
        existingBook.timestamp = Date.now();
        
        this.orderBookCache.set(symbol, existingBook);
      }
    }
    
    this.emit('orderbook_update', {
      exchangeId: 'bybit',
      symbol,
      data: this.orderBookCache.get(symbol),
      timestamp: new Date()
    });
  }

  /**
   * Apply delta updates to order book
   */
  private applyOrderBookDeltas(existingOrders: any[], deltas: any[]): any[] {
    const orderMap = new Map(existingOrders.map(([price, qty]) => [price, qty]));
    
    for (const [price, qty] of deltas) {
      if (parseFloat(qty) === 0) {
        orderMap.delete(price);
      } else {
        orderMap.set(price, qty);
      }
    }
    
    return Array.from(orderMap.entries()).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  }

  /**
   * Update trades cache
   */
  private updateTradesCache(topic: string, data: any[]): void {
    const symbolMatch = topic.match(/publicTrade\.(.+)/);
    if (!symbolMatch) return;
    
    const symbol = symbolMatch[1];
    
    if (!this.tradesCache.has(symbol)) {
      this.tradesCache.set(symbol, []);
    }
    
    const trades = this.tradesCache.get(symbol)!;
    trades.push(...data);
    
    // Keep only last 100 trades
    if (trades.length > 100) {
      trades.splice(0, trades.length - 100);
    }
    
    this.emit('trades_update', {
      exchangeId: 'bybit',
      symbol,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: Error): void {
    console.error('[Bybit] WebSocket error:', error);
    this.isConnected = false;
    
    this.emit('websocket_error', {
      exchangeId: 'bybit',
      error: error.message,
      timestamp: new Date()
    });
    
    this.scheduleReconnection();
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(): void {
    this.isConnected = false;
    this.subscriptions.clear();
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    
    this.emit('websocket_closed', {
      exchangeId: 'bybit',
      timestamp: new Date()
    });
    
    this.scheduleReconnection();
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        console.log('[Bybit] Attempting WebSocket reconnection...');
        await this.connectWebSocket();
        
        // Re-subscribe to previous subscriptions
        for (const subscription of this.subscriptions) {
          await this.resubscribe(subscription);
        }
      } catch (error) {
        console.error('[Bybit] Reconnection failed:', error);
        this.scheduleReconnection();
      }
    }, 5000);
  }

  /**
   * Re-subscribe to WebSocket channels
   */
  private async resubscribe(subscription: string): Promise<void> {
    try {
      const subscribeMsg = {
        op: 'subscribe',
        args: [subscription]
      };
      
      if (this.wsConnection?.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify(subscribeMsg));
      }
    } catch (error) {
      console.error('[Bybit] Re-subscription failed:', error);
    }
  }

  /**
   * Disconnect from exchange
   */
  protected async disconnect(): Promise<void> {
    try {
      // Close WebSocket connection
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = undefined;
      }
      
      // Clear timers
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
      
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = undefined;
      }
      
      // Clear caches
      this.tickerCache.clear();
      this.orderBookCache.clear();
      this.tradesCache.clear();
      this.subscriptions.clear();
      
      this.isConnected = false;
      this.connectionPromise = undefined;
      
      console.log('[Bybit] Disconnected successfully');
    } catch (error) {
      console.error('[Bybit] Disconnect error:', error);
    }
  }

  /**
   * Test connection health
   */
  protected async testConnection(): Promise<void> {
    try {
      const serverTime = await this.ccxtExchange.fetchTime();
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - serverTime);
      
      if (timeDiff > 60000) {
        throw new Error(`Server time drift too large: ${timeDiff}ms`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform health check
   */
  protected async performHealthCheck(): Promise<void> {
    try {
      await this.ccxtExchange.fetchStatus();
      
      // Check WebSocket connection
      if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
        await this.connectWebSocket();
      }
    } catch (error) {
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Place an order
   */
  async placeOrder(order: Order): Promise<OrderExecutionResult> {
    try {
      const bybitSymbol = this.normalizeSymbol(order.symbol);
      const side = order.side === 'buy' ? 'buy' : 'sell';
      const type = order.type === 'market' ? 'market' : 'limit';
      
      const orderParams: any = {};
      
      // Add time in force
      if (order.timeInForce) {
        switch (order.timeInForce) {
          case 'IOC':
            orderParams.timeInForce = 'IOC';
            break;
          case 'FOK':
            orderParams.timeInForce = 'FOK';
            break;
          case 'GTC':
            orderParams.timeInForce = 'GTC';
            break;
        }
      }

      const result = await this.executeRequest(
        'placeOrder',
        () => this.ccxtExchange.createOrder(
          bybitSymbol,
          type,
          side,
          order.quantity,
          order.price,
          undefined,
          orderParams
        ),
        5 // Higher weight for order placement
      );

      return {
        orderId: result.id,
        clientOrderId: order.id,
        exchangeOrderId: result.id,
        status: this.mapOrderStatus(result.status),
        timestamp: new Date(result.timestamp),
        filledQuantity: result.filled || 0,
        remainingQuantity: result.remaining || 0,
        averagePrice: result.average,
        fees: result.fee ? {
          amount: result.fee.cost,
          currency: result.fee.currency
        } : undefined,
        exchangeData: result
      };

    } catch (error) {
      throw new Error(`Failed to place order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.executeRequest(
        'cancelOrder',
        () => this.ccxtExchange.cancelOrder(orderId),
        3
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to cancel order ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Get order status
   */
  async getOrder(orderId: string): Promise<ExchangeOrder | null> {
    try {
      const result = await this.executeRequest(
        'getOrder',
        () => this.ccxtExchange.fetchOrder(orderId),
        2
      );

      if (!result) return null;

      return {
        ...result,
        exchangeId: 'bybit',
        exchangeOrderId: result.id,
        originalClientOrderId: result.clientOrderId,
        exchangeSymbol: result.symbol,
        exchangeTimestamp: new Date(result.timestamp),
        status: this.mapOrderStatus(result.status),
        filledQuantity: result.filled || 0,
        createdAt: new Date(result.timestamp),
        updatedAt: new Date(),
        metadata: {
          strategy: 'bybit-connector',
          mode: 'live',
          childOrderIds: [],
          retryCount: 0,
          executionPath: ['bybit']
        }
      };

    } catch (error) {
      console.error(`Failed to get order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<ExchangeBalance[]> {
    try {
      const result = await this.executeRequest(
        'getBalances',
        () => this.ccxtExchange.fetchBalance(),
        2
      );

      const balances: ExchangeBalance[] = [];

      for (const [asset, balance] of Object.entries(result.total || {})) {
        if (typeof balance === 'number' && balance > 0) {
          balances.push({
            exchangeId: 'bybit',
            asset,
            free: result.free[asset] || 0,
            locked: result.used[asset] || 0,
            total: balance,
            timestamp: new Date(),
            accountType: this.tradingMode === 'spot' ? 'spot' : 'margin'
          });
        }
      }

      return balances;

    } catch (error) {
      throw new Error(`Failed to get balances: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get trading fees
   */
  async getTradingFees(symbol: string): Promise<ExchangeTradingFees> {
    try {
      const bybitSymbol = this.normalizeSymbol(symbol);
      const result = await this.executeRequest(
        'getTradingFees',
        () => this.ccxtExchange.fetchTradingFee(bybitSymbol),
        2
      );

      return {
        exchangeId: 'bybit',
        symbol,
        makerFee: result.maker || 0.001,
        takerFee: result.taker || 0.001,
        feeCurrency: 'USDT',
        timestamp: new Date()
      };

    } catch (error) {
      // Return default fees if API call fails
      return {
        exchangeId: 'bybit',
        symbol,
        makerFee: 0.001,
        takerFee: 0.001,
        feeCurrency: 'USDT',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get market data
   */
  async getMarketData(symbol: string): Promise<UnifiedMarketData> {
    try {
      const bybitSymbol = this.normalizeSymbol(symbol);
      
      // Try cache first
      const cached = this.tickerCache.get(bybitSymbol);
      if (cached && (Date.now() - cached.timestamp < 5000)) {
        return this.formatMarketData(symbol, cached);
      }

      const result = await this.executeRequest(
        'getMarketData',
        () => this.ccxtExchange.fetchTicker(bybitSymbol),
        1
      );

      // Update cache
      this.tickerCache.set(bybitSymbol, {
        ...result,
        timestamp: Date.now()
      });

      return this.formatMarketData(symbol, result);

    } catch (error) {
      throw new Error(`Failed to get market data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, depth: number = 10): Promise<UnifiedOrderBook> {
    try {
      const bybitSymbol = this.normalizeSymbol(symbol);
      
      // Try cache first
      const cached = this.orderBookCache.get(bybitSymbol);
      if (cached && (Date.now() - cached.timestamp < 2000)) {
        return this.formatOrderBook(symbol, cached, depth);
      }

      const result = await this.executeRequest(
        'getOrderBook',
        () => this.ccxtExchange.fetchOrderBook(bybitSymbol, depth),
        1
      );

      // Update cache
      this.orderBookCache.set(bybitSymbol, {
        ...result,
        timestamp: Date.now()
      });

      return this.formatOrderBook(symbol, result, depth);

    } catch (error) {
      throw new Error(`Failed to get order book: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Subscribe to real-time market data
   */
  async subscribeToMarketData(symbols: string[]): Promise<void> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }

    const subscriptions: string[] = [];
    
    for (const symbol of symbols) {
      const bybitSymbol = this.normalizeSymbol(symbol);
      
      // Subscribe to ticker
      subscriptions.push(`tickers.${bybitSymbol}`);
      // Subscribe to order book
      subscriptions.push(`orderbook.1.${bybitSymbol}`);
      // Subscribe to public trades
      subscriptions.push(`publicTrade.${bybitSymbol}`);
      
      this.subscriptions.add(bybitSymbol);
    }

    const subscribeMsg = {
      op: 'subscribe',
      args: subscriptions
    };

    this.wsConnection?.send(JSON.stringify(subscribeMsg));
  }

  /**
   * Unsubscribe from real-time market data
   */
  async unsubscribeFromMarketData(symbols: string[]): Promise<void> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscriptions: string[] = [];
    
    for (const symbol of symbols) {
      const bybitSymbol = this.normalizeSymbol(symbol);
      
      unsubscriptions.push(`tickers.${bybitSymbol}`);
      unsubscriptions.push(`orderbook.1.${bybitSymbol}`);
      unsubscriptions.push(`publicTrade.${bybitSymbol}`);
      
      this.subscriptions.delete(bybitSymbol);
    }

    const unsubscribeMsg = {
      op: 'unsubscribe',
      args: unsubscriptions
    };

    this.wsConnection?.send(JSON.stringify(unsubscribeMsg));
  }

  // === HELPER METHODS ===

  /**
   * Normalize symbol format for Bybit
   */
  private normalizeSymbol(symbol: string): string {
    // Convert standard format (BTC-USD) to Bybit format (BTCUSD)
    return symbol.replace('-', '');
  }

  /**
   * Map CCXT order status to internal format
   */
  private mapOrderStatus(ccxtStatus: string): OrderStatus {
    switch (ccxtStatus) {
      case 'open':
      case 'pending':
        return 'pending';
      case 'closed':
        return 'filled';
      case 'canceled':
        return 'cancelled';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /**
   * Format market data to unified format
   */
  private formatMarketData(symbol: string, data: any): UnifiedMarketData {
    return {
      exchangeId: 'bybit',
      symbol,
      timestamp: new Date(data.timestamp || Date.now()),
      price: data.last || data.close || 0,
      bid: data.bid || 0,
      ask: data.ask || 0,
      spread: (data.ask || 0) - (data.bid || 0),
      volume24h: data.baseVolume || 0,
      volumeQuote: data.quoteVolume || 0,
      high24h: data.high || 0,
      low24h: data.low || 0,
      change24h: data.change || 0,
      changePercent24h: data.percentage || 0,
      bidDepth: 1000, // Estimated
      askDepth: 1000, // Estimated
      lastUpdate: new Date(data.timestamp || Date.now()),
      quality: 'realtime'
    };
  }

  /**
   * Format order book to unified format
   */
  private formatOrderBook(symbol: string, data: any, depth: number): UnifiedOrderBook {
    const bids: OrderBookEntry[] = (data.bids || [])
      .slice(0, depth)
      .map(([price, quantity]: [number, number]) => ({
        price,
        quantity
      }));

    const asks: OrderBookEntry[] = (data.asks || [])
      .slice(0, depth)
      .map(([price, quantity]: [number, number]) => ({
        price,
        quantity
      }));

    const bidVolume = bids.reduce((sum, entry) => sum + (entry.price * entry.quantity), 0);
    const askVolume = asks.reduce((sum, entry) => sum + (entry.price * entry.quantity), 0);
    const midPrice = bids.length && asks.length ? (bids[0].price + asks[0].price) / 2 : 0;
    const spread = asks.length && bids.length ? asks[0].price - bids[0].price : 0;

    return {
      exchangeId: 'bybit',
      symbol,
      timestamp: new Date(data.timestamp || Date.now()),
      bids,
      asks,
      bidVolume,
      askVolume,
      spread,
      midPrice,
      depth: Math.min(depth, Math.max(bids.length, asks.length)),
      quality: 'full',
      lastUpdate: new Date(data.timestamp || Date.now())
    };
  }
}

export default BybitConnector;