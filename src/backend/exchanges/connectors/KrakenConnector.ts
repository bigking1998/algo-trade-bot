/**
 * Kraken Exchange Connector - CCXT Integration
 * 
 * Production-grade connector for Kraken exchange featuring:
 * - CCXT library integration for unified API
 * - Advanced rate limiting with exchange-specific limits
 * - WebSocket streaming for real-time data
 * - Comprehensive order management and execution
 * - Error handling and reconnection logic
 * - Security best practices for API authentication
 * 
 * Performance Targets:
 * - Order execution latency < 200ms
 * - 99.9% uptime reliability
 * - Rate limit compliance (Kraken specific limits)
 * - Memory usage < 25MB
 */

import ccxt from 'ccxt';
import WebSocket from 'ws';
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
 * Kraken-specific Configuration
 */
interface KrakenConfig extends ExchangeConfig {
  ccxtConfig?: {
    rateLimit: number;
    enableRateLimit: boolean;
    sandbox: boolean;
    verbose: boolean;
  };
}

/**
 * Kraken Exchange Connector
 */
export class KrakenConnector extends BaseExchangeConnector {
  private ccxtExchange: ccxt.kraken;
  private wsConnection?: WebSocket;
  private subscriptions = new Set<string>();
  private reconnectTimer?: NodeJS.Timeout;
  
  // Market data cache
  private tickerCache = new Map<string, any>();
  private orderBookCache = new Map<string, any>();
  private lastPriceUpdate = new Map<string, number>();
  
  // Connection state
  private isConnected = false;
  private connectionPromise?: Promise<void>;

  constructor(config: KrakenConfig) {
    super(config);
    
    // Initialize CCXT Kraken instance
    this.ccxtExchange = new ccxt.kraken({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      sandbox: config.ccxtConfig?.sandbox || false,
      rateLimit: config.ccxtConfig?.rateLimit || 1000, // 1 request per second default
      enableRateLimit: config.ccxtConfig?.enableRateLimit || true,
      verbose: config.ccxtConfig?.verbose || false,
      ...config.ccxtConfig
    });
  }

  /**
   * Connect to Kraken exchange
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
        exchangeId: 'kraken',
        timestamp: new Date()
      });
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to Kraken: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Connect to Kraken WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket('wss://ws.kraken.com');
        
        this.wsConnection.on('open', () => {
          console.log('[Kraken] WebSocket connected');
          resolve();
        });
        
        this.wsConnection.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('[Kraken] WebSocket message parsing error:', error);
          }
        });
        
        this.wsConnection.on('error', (error) => {
          console.error('[Kraken] WebSocket error:', error);
          this.handleWebSocketError(error);
        });
        
        this.wsConnection.on('close', () => {
          console.log('[Kraken] WebSocket disconnected');
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
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    if (Array.isArray(message)) {
      // Handle ticker updates
      if (message[1] && typeof message[1] === 'object' && message[1].c) {
        const pair = message[3];
        const ticker = message[1];
        this.updateTickerCache(pair, ticker);
      }
      
      // Handle order book updates
      if (message[1] && typeof message[1] === 'object' && (message[1].b || message[1].a)) {
        const pair = message[3];
        const bookUpdate = message[1];
        this.updateOrderBookCache(pair, bookUpdate);
      }
    }
  }

  /**
   * Update ticker cache
   */
  private updateTickerCache(pair: string, ticker: any): void {
    this.tickerCache.set(pair, {
      ...ticker,
      timestamp: Date.now()
    });
    
    this.emit('ticker_update', {
      exchangeId: 'kraken',
      symbol: pair,
      data: ticker,
      timestamp: new Date()
    });
  }

  /**
   * Update order book cache
   */
  private updateOrderBookCache(pair: string, bookUpdate: any): void {
    let book = this.orderBookCache.get(pair) || { bids: [], asks: [] };
    
    // Update bids
    if (bookUpdate.b) {
      book.bids = bookUpdate.b;
    }
    
    // Update asks
    if (bookUpdate.a) {
      book.asks = bookUpdate.a;
    }
    
    book.timestamp = Date.now();
    this.orderBookCache.set(pair, book);
    
    this.emit('orderbook_update', {
      exchangeId: 'kraken',
      symbol: pair,
      data: book,
      timestamp: new Date()
    });
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: Error): void {
    console.error('[Kraken] WebSocket error:', error);
    this.isConnected = false;
    
    this.emit('websocket_error', {
      exchangeId: 'kraken',
      error: error.message,
      timestamp: new Date()
    });
    
    // Attempt reconnection
    this.scheduleReconnection();
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(): void {
    this.isConnected = false;
    this.subscriptions.clear();
    
    this.emit('websocket_closed', {
      exchangeId: 'kraken',
      timestamp: new Date()
    });
    
    // Attempt reconnection
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
        console.log('[Kraken] Attempting WebSocket reconnection...');
        await this.connectWebSocket();
        
        // Re-subscribe to previous subscriptions
        for (const subscription of this.subscriptions) {
          await this.resubscribe(subscription);
        }
      } catch (error) {
        console.error('[Kraken] Reconnection failed:', error);
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
        event: 'subscribe',
        pair: [subscription],
        subscription: { name: 'ticker' }
      };
      
      if (this.wsConnection?.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify(subscribeMsg));
      }
    } catch (error) {
      console.error('[Kraken] Re-subscription failed:', error);
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
      
      // Clear reconnection timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
      
      // Clear caches
      this.tickerCache.clear();
      this.orderBookCache.clear();
      this.subscriptions.clear();
      
      this.isConnected = false;
      this.connectionPromise = undefined;
      
      console.log('[Kraken] Disconnected successfully');
    } catch (error) {
      console.error('[Kraken] Disconnect error:', error);
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
      
      if (timeDiff > 60000) { // 1 minute tolerance
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
      const krakenSymbol = this.normalizeSymbol(order.symbol);
      const side = order.side === 'buy' ? 'buy' : 'sell';
      const type = order.type === 'market' ? 'market' : 'limit';
      
      const orderParams: any = {
        symbol: krakenSymbol,
        type,
        side,
        amount: order.quantity,
        price: order.price
      };
      
      // Add time in force if specified
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
          krakenSymbol,
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
        remainingQuantity: (result.remaining || 0),
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
        exchangeId: 'kraken',
        exchangeOrderId: result.id,
        originalClientOrderId: result.clientOrderId,
        exchangeSymbol: result.symbol,
        exchangeTimestamp: new Date(result.timestamp),
        status: this.mapOrderStatus(result.status),
        filledQuantity: result.filled || 0,
        createdAt: new Date(result.timestamp),
        updatedAt: new Date(),
        metadata: {
          strategy: 'kraken-connector',
          mode: 'live',
          childOrderIds: [],
          retryCount: 0,
          executionPath: ['kraken']
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
            exchangeId: 'kraken',
            asset,
            free: result.free[asset] || 0,
            locked: result.used[asset] || 0,
            total: balance,
            timestamp: new Date(),
            accountType: 'spot'
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
      const krakenSymbol = this.normalizeSymbol(symbol);
      const result = await this.executeRequest(
        'getTradingFees',
        () => this.ccxtExchange.fetchTradingFee(krakenSymbol),
        2
      );

      return {
        exchangeId: 'kraken',
        symbol,
        makerFee: result.maker || 0.0016, // Default Kraken maker fee
        takerFee: result.taker || 0.0026, // Default Kraken taker fee
        feeCurrency: 'USD',
        timestamp: new Date()
      };

    } catch (error) {
      // Return default fees if API call fails
      return {
        exchangeId: 'kraken',
        symbol,
        makerFee: 0.0016,
        takerFee: 0.0026,
        feeCurrency: 'USD',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get market data
   */
  async getMarketData(symbol: string): Promise<UnifiedMarketData> {
    try {
      const krakenSymbol = this.normalizeSymbol(symbol);
      
      // Try to get from cache first
      const cached = this.tickerCache.get(krakenSymbol);
      if (cached && (Date.now() - cached.timestamp < 5000)) {
        return this.formatMarketData(symbol, cached);
      }

      // Fetch fresh data
      const result = await this.executeRequest(
        'getMarketData',
        () => this.ccxtExchange.fetchTicker(krakenSymbol),
        1
      );

      // Update cache
      this.tickerCache.set(krakenSymbol, {
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
      const krakenSymbol = this.normalizeSymbol(symbol);
      
      // Try cache first
      const cached = this.orderBookCache.get(krakenSymbol);
      if (cached && (Date.now() - cached.timestamp < 2000)) {
        return this.formatOrderBook(symbol, cached, depth);
      }

      const result = await this.executeRequest(
        'getOrderBook',
        () => this.ccxtExchange.fetchOrderBook(krakenSymbol, depth),
        1
      );

      // Update cache
      this.orderBookCache.set(krakenSymbol, {
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

    for (const symbol of symbols) {
      const krakenPair = this.normalizeSymbol(symbol);
      
      const subscribeMsg = {
        event: 'subscribe',
        pair: [krakenPair],
        subscription: { name: 'ticker' }
      };

      this.wsConnection?.send(JSON.stringify(subscribeMsg));
      this.subscriptions.add(krakenPair);
      
      // Also subscribe to order book
      const bookSubscribeMsg = {
        event: 'subscribe',
        pair: [krakenPair],
        subscription: { name: 'book', depth: 10 }
      };
      
      this.wsConnection?.send(JSON.stringify(bookSubscribeMsg));
    }
  }

  /**
   * Unsubscribe from real-time market data
   */
  async unsubscribeFromMarketData(symbols: string[]): Promise<void> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      return;
    }

    for (const symbol of symbols) {
      const krakenPair = this.normalizeSymbol(symbol);
      
      const unsubscribeMsg = {
        event: 'unsubscribe',
        pair: [krakenPair],
        subscription: { name: 'ticker' }
      };

      this.wsConnection?.send(JSON.stringify(unsubscribeMsg));
      this.subscriptions.delete(krakenPair);
    }
  }

  // === HELPER METHODS ===

  /**
   * Normalize symbol format for Kraken
   */
  private normalizeSymbol(symbol: string): string {
    // Convert standard format (BTC-USD) to Kraken format (BTC/USD)
    return symbol.replace('-', '/');
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
      exchangeId: 'kraken',
      symbol,
      timestamp: new Date(data.timestamp),
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
      bidDepth: data.bidVolume || 1000,
      askDepth: data.askVolume || 1000,
      lastUpdate: new Date(data.timestamp),
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
      exchangeId: 'kraken',
      symbol,
      timestamp: new Date(data.timestamp),
      bids,
      asks,
      bidVolume,
      askVolume,
      spread,
      midPrice,
      depth: Math.min(depth, Math.max(bids.length, asks.length)),
      quality: 'full',
      lastUpdate: new Date(data.timestamp)
    };
  }
}

export default KrakenConnector;