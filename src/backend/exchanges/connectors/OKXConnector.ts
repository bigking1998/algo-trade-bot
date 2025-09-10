/**
 * OKX Exchange Connector - CCXT Integration
 * 
 * Production-grade connector for OKX exchange featuring:
 * - CCXT library integration for unified API
 * - Advanced rate limiting with exchange-specific limits
 * - WebSocket streaming for real-time data
 * - Support for spot, futures, and options trading
 * - Comprehensive order management and execution
 * - Error handling and reconnection logic
 * 
 * Performance Targets:
 * - Order execution latency < 100ms
 * - 99.9% uptime reliability  
 * - Rate limit compliance (OKX specific limits)
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
 * OKX-specific Configuration
 */
interface OKXConfig extends ExchangeConfig {
  ccxtConfig?: {
    rateLimit: number;
    enableRateLimit: boolean;
    sandbox: boolean;
    verbose: boolean;
  };
  tradingMode?: 'spot' | 'swap' | 'futures' | 'option';
}

/**
 * OKX WebSocket Message Types
 */
interface OKXWebSocketMessage {
  arg: {
    channel: string;
    instId: string;
    instType?: string;
  };
  data: any[];
  event?: string;
}

/**
 * OKX Exchange Connector
 */
export class OKXConnector extends BaseExchangeConnector {
  private ccxtExchange: ccxt.okx;
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

  constructor(config: OKXConfig) {
    super(config);
    
    this.tradingMode = config.tradingMode || 'spot';
    
    // Initialize CCXT OKX instance
    this.ccxtExchange = new ccxt.okx({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      password: config.passphrase, // OKX uses passphrase
      sandbox: config.ccxtConfig?.sandbox || false,
      rateLimit: config.ccxtConfig?.rateLimit || 100, // 20 requests per second
      enableRateLimit: config.ccxtConfig?.enableRateLimit || true,
      verbose: config.ccxtConfig?.verbose || false,
      options: {
        defaultType: this.tradingMode // 'spot', 'swap', 'futures', 'option'
      },
      ...config.ccxtConfig
    });
  }

  /**
   * Connect to OKX exchange
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
        exchangeId: 'okx',
        timestamp: new Date()
      });
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to OKX: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Connect to OKX WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // OKX WebSocket URL
        const wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';
        
        this.wsConnection = new WebSocket(wsUrl);
        
        this.wsConnection.on('open', () => {
          console.log('[OKX] WebSocket connected');
          this.startPingPong();
          resolve();
        });
        
        this.wsConnection.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as OKXWebSocketMessage;
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('[OKX] WebSocket message parsing error:', error);
          }
        });
        
        this.wsConnection.on('error', (error) => {
          console.error('[OKX] WebSocket error:', error);
          this.handleWebSocketError(error);
        });
        
        this.wsConnection.on('close', (code, reason) => {
          console.log(`[OKX] WebSocket disconnected: ${code} - ${reason}`);
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
        this.wsConnection.send('ping');
      }
    }, 25000); // Ping every 25 seconds (OKX requirement: < 30s)
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    // Handle pong responses
    if (message === 'pong') {
      return;
    }
    
    // Handle subscription confirmations
    if (message.event === 'subscribe') {
      console.log('[OKX] Subscription confirmed:', message.arg);
      return;
    }
    
    // Handle error events
    if (message.event === 'error') {
      console.error('[OKX] WebSocket error:', message);
      return;
    }
    
    // Handle data updates
    if (message.arg && message.data) {
      const { channel, instId } = message.arg;
      
      switch (channel) {
        case 'tickers':
          this.updateTickerCache(instId, message.data[0]);
          break;
        case 'books':
        case 'books5':
          this.updateOrderBookCache(instId, message.data[0]);
          break;
        case 'trades':
          this.updateTradesCache(instId, message.data);
          break;
      }
    }
  }

  /**
   * Update ticker cache
   */
  private updateTickerCache(symbol: string, data: any): void {
    this.tickerCache.set(symbol, {
      ...data,
      timestamp: Date.now()
    });
    
    this.emit('ticker_update', {
      exchangeId: 'okx',
      symbol,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Update order book cache
   */
  private updateOrderBookCache(symbol: string, data: any): void {
    this.orderBookCache.set(symbol, {
      bids: data.bids || [],
      asks: data.asks || [],
      timestamp: Date.now()
    });
    
    this.emit('orderbook_update', {
      exchangeId: 'okx',
      symbol,
      data: this.orderBookCache.get(symbol),
      timestamp: new Date()
    });
  }

  /**
   * Update trades cache
   */
  private updateTradesCache(symbol: string, data: any[]): void {
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
      exchangeId: 'okx',
      symbol,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: Error): void {
    console.error('[OKX] WebSocket error:', error);
    this.isConnected = false;
    
    this.emit('websocket_error', {
      exchangeId: 'okx',
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
      exchangeId: 'okx',
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
        console.log('[OKX] Attempting WebSocket reconnection...');
        await this.connectWebSocket();
        
        // Re-subscribe to previous subscriptions
        for (const subscription of this.subscriptions) {
          await this.resubscribe(subscription);
        }
      } catch (error) {
        console.error('[OKX] Reconnection failed:', error);
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
        args: [{
          channel: 'tickers',
          instId: subscription
        }]
      };
      
      if (this.wsConnection?.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify(subscribeMsg));
      }
    } catch (error) {
      console.error('[OKX] Re-subscription failed:', error);
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
      
      console.log('[OKX] Disconnected successfully');
    } catch (error) {
      console.error('[OKX] Disconnect error:', error);
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
      const okxSymbol = this.normalizeSymbol(order.symbol);
      const side = order.side === 'buy' ? 'buy' : 'sell';
      const type = order.type === 'market' ? 'market' : 'limit';
      
      const orderParams: any = {};
      
      // Add time in force
      if (order.timeInForce) {
        switch (order.timeInForce) {
          case 'IOC':
            orderParams.timeInForce = 'ioc';
            break;
          case 'FOK':
            orderParams.timeInForce = 'fok';
            break;
          case 'GTC':
            orderParams.timeInForce = 'gtc';
            break;
        }
      }

      const result = await this.executeRequest(
        'placeOrder',
        () => this.ccxtExchange.createOrder(
          okxSymbol,
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
        exchangeId: 'okx',
        exchangeOrderId: result.id,
        originalClientOrderId: result.clientOrderId,
        exchangeSymbol: result.symbol,
        exchangeTimestamp: new Date(result.timestamp),
        status: this.mapOrderStatus(result.status),
        filledQuantity: result.filled || 0,
        createdAt: new Date(result.timestamp),
        updatedAt: new Date(),
        metadata: {
          strategy: 'okx-connector',
          mode: 'live',
          childOrderIds: [],
          retryCount: 0,
          executionPath: ['okx']
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
            exchangeId: 'okx',
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
      const okxSymbol = this.normalizeSymbol(symbol);
      const result = await this.executeRequest(
        'getTradingFees',
        () => this.ccxtExchange.fetchTradingFee(okxSymbol),
        2
      );

      return {
        exchangeId: 'okx',
        symbol,
        makerFee: result.maker || 0.0008,
        takerFee: result.taker || 0.001,
        feeCurrency: 'USDT',
        timestamp: new Date()
      };

    } catch (error) {
      // Return default fees if API call fails
      return {
        exchangeId: 'okx',
        symbol,
        makerFee: 0.0008,
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
      const okxSymbol = this.normalizeSymbol(symbol);
      
      // Try cache first
      const cached = this.tickerCache.get(okxSymbol);
      if (cached && (Date.now() - cached.timestamp < 5000)) {
        return this.formatMarketData(symbol, cached);
      }

      const result = await this.executeRequest(
        'getMarketData',
        () => this.ccxtExchange.fetchTicker(okxSymbol),
        1
      );

      // Update cache
      this.tickerCache.set(okxSymbol, {
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
      const okxSymbol = this.normalizeSymbol(symbol);
      
      // Try cache first
      const cached = this.orderBookCache.get(okxSymbol);
      if (cached && (Date.now() - cached.timestamp < 2000)) {
        return this.formatOrderBook(symbol, cached, depth);
      }

      const result = await this.executeRequest(
        'getOrderBook',
        () => this.ccxtExchange.fetchOrderBook(okxSymbol, depth),
        1
      );

      // Update cache
      this.orderBookCache.set(okxSymbol, {
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

    const subscriptionArgs = [];
    
    for (const symbol of symbols) {
      const okxSymbol = this.normalizeSymbol(symbol);
      
      // Subscribe to ticker
      subscriptionArgs.push({ channel: 'tickers', instId: okxSymbol });
      // Subscribe to order book (5 best levels)
      subscriptionArgs.push({ channel: 'books5', instId: okxSymbol });
      // Subscribe to public trades
      subscriptionArgs.push({ channel: 'trades', instId: okxSymbol });
      
      this.subscriptions.add(okxSymbol);
    }

    const subscribeMsg = {
      op: 'subscribe',
      args: subscriptionArgs
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

    const unsubscriptionArgs = [];
    
    for (const symbol of symbols) {
      const okxSymbol = this.normalizeSymbol(symbol);
      
      unsubscriptionArgs.push({ channel: 'tickers', instId: okxSymbol });
      unsubscriptionArgs.push({ channel: 'books5', instId: okxSymbol });
      unsubscriptionArgs.push({ channel: 'trades', instId: okxSymbol });
      
      this.subscriptions.delete(okxSymbol);
    }

    const unsubscribeMsg = {
      op: 'unsubscribe',
      args: unsubscriptionArgs
    };

    this.wsConnection?.send(JSON.stringify(unsubscribeMsg));
  }

  // === HELPER METHODS ===

  /**
   * Normalize symbol format for OKX
   */
  private normalizeSymbol(symbol: string): string {
    // Convert standard format (BTC-USD) to OKX format (BTC-USDT)
    return symbol.replace('USD', 'USDT');
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
      exchangeId: 'okx',
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
      exchangeId: 'okx',
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

export default OKXConnector;