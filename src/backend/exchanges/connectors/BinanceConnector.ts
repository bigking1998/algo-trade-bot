/**
 * Binance Exchange Connector
 * 
 * Production-grade connector for Binance exchange featuring:
 * - Advanced rate limiting with weight-based system
 * - WebSocket streaming for real-time data
 * - Comprehensive order management
 * - Error handling and reconnection logic
 * - Security best practices for API authentication
 * 
 * Performance Targets:
 * - Order execution latency < 150ms
 * - 99.9% uptime reliability
 * - Rate limit compliance (1200 requests/minute)
 * - Memory usage < 25MB
 */

import crypto from 'crypto';
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
 * Binance API Response Types
 */
interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

interface BinanceTickerResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

interface BinanceOrderBookResponse {
  lastUpdateId: number;
  bids: string[][];
  asks: string[][];
}

interface BinanceBalanceResponse {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceAccountResponse {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: BinanceBalanceResponse[];
}

/**
 * Binance Exchange Connector Implementation
 */
export class BinanceConnector extends BaseExchangeConnector {
  private baseUrl: string;
  private wsBaseUrl: string;
  private recvWindow: number = 5000;
  
  // WebSocket connections
  private ws?: WebSocket;
  private wsSubscriptions = new Set<string>();
  private wsReconnectAttempts = 0;
  private maxWsReconnectAttempts = 10;
  
  // API key and signature handling
  private apiKey?: string;
  private apiSecret?: string;
  
  constructor(config: ExchangeConfig) {
    super(config);
    
    this.baseUrl = config.sandboxApiUrl || config.apiUrl;
    this.wsBaseUrl = config.sandboxWebsocketUrl || config.websocketUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }
  
  /**
   * Connect to Binance API
   */
  protected async connect(): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Binance API key and secret are required');
    }
    
    // Test connectivity
    await this.testConnectivity();
    
    // Initialize WebSocket connection if supported
    if (this.supportsFeature('websocketStreams')) {
      await this.initializeWebSocket();
    }
  }
  
  /**
   * Disconnect from Binance
   */
  protected async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    this.wsSubscriptions.clear();
  }
  
  /**
   * Test connection health
   */
  protected async testConnection(): Promise<void> {
    await this.testConnectivity();
  }
  
  /**
   * Perform health check
   */
  protected async performHealthCheck(): Promise<void> {
    try {
      await this.getServerTime();
    } catch (error) {
      throw new Error(`Binance health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Place an order on Binance
   */
  async placeOrder(order: Order): Promise<OrderExecutionResult> {
    try {
      const binanceOrder = this.convertToExchangeOrder(order);
      const response = await this.executeRequest(
        'order_placement',
        () => this.sendOrder(binanceOrder),
        10 // Weight for order placement
      );
      
      return this.convertToOrderExecutionResult(response, order);
      
    } catch (error) {
      throw new Error(`Binance order placement failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      // Extract symbol and order ID from internal format
      const [symbol, binanceOrderId] = this.parseInternalOrderId(orderId);
      
      const params = {
        symbol,
        orderId: parseInt(binanceOrderId),
        timestamp: Date.now()
      };
      
      await this.executeRequest(
        'order_cancel',
        () => this.signedRequest('DELETE', '/api/v3/order', params),
        1
      );
      
      return true;
      
    } catch (error) {
      this.handleError('Order cancellation failed', error);
      return false;
    }
  }
  
  /**
   * Get order status
   */
  async getOrder(orderId: string): Promise<ExchangeOrder | null> {
    try {
      const [symbol, binanceOrderId] = this.parseInternalOrderId(orderId);
      
      const params = {
        symbol,
        orderId: parseInt(binanceOrderId),
        timestamp: Date.now()
      };
      
      const response = await this.executeRequest(
        'order_query',
        () => this.signedRequest('GET', '/api/v3/order', params),
        2
      );
      
      return this.convertBinanceOrderToExchangeOrder(response);
      
    } catch (error) {
      this.handleError('Order query failed', error);
      return null;
    }
  }
  
  /**
   * Get account balances
   */
  async getBalances(): Promise<ExchangeBalance[]> {
    try {
      const params = {
        timestamp: Date.now(),
        recvWindow: this.recvWindow
      };
      
      const accountInfo: BinanceAccountResponse = await this.executeRequest(
        'account_info',
        () => this.signedRequest('GET', '/api/v3/account', params),
        10
      );
      
      return accountInfo.balances
        .filter(balance => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map(balance => this.convertBinanceBalanceToExchangeBalance(balance));
      
    } catch (error) {
      throw new Error(`Binance balance query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get trading fees
   */
  async getTradingFees(symbol: string): Promise<ExchangeTradingFees> {
    try {
      const params = {
        symbol,
        timestamp: Date.now()
      };
      
      const response = await this.executeRequest(
        'trading_fees',
        () => this.signedRequest('GET', '/api/v3/tradeFee', params),
        1
      );
      
      const feeData = Array.isArray(response) ? response[0] : response;
      
      return {
        exchangeId: 'binance',
        symbol,
        makerFee: parseFloat(feeData.makerCommission) / 10000,
        takerFee: parseFloat(feeData.takerCommission) / 10000,
        feeCurrency: 'BNB', // Binance Coin for fee discount
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new Error(`Binance trading fees query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get market data
   */
  async getMarketData(symbol: string): Promise<UnifiedMarketData> {
    try {
      const ticker: BinanceTickerResponse = await this.executeRequest(
        'market_data',
        () => this.publicRequest('GET', '/api/v3/ticker/24hr', { symbol }),
        1
      );
      
      return {
        exchangeId: 'binance',
        symbol,
        timestamp: new Date(),
        price: parseFloat(ticker.lastPrice),
        bid: parseFloat(ticker.bidPrice),
        ask: parseFloat(ticker.askPrice),
        spread: parseFloat(ticker.askPrice) - parseFloat(ticker.bidPrice),
        volume24h: parseFloat(ticker.volume),
        volumeQuote: parseFloat(ticker.quoteVolume),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        change24h: parseFloat(ticker.priceChange),
        changePercent24h: parseFloat(ticker.priceChangePercent),
        bidDepth: parseFloat(ticker.bidQty),
        askDepth: parseFloat(ticker.askQty),
        lastUpdate: new Date(ticker.closeTime),
        quality: 'realtime'
      };
      
    } catch (error) {
      throw new Error(`Binance market data query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get order book
   */
  async getOrderBook(symbol: string, depth: number = 100): Promise<UnifiedOrderBook> {
    try {
      const response: BinanceOrderBookResponse = await this.executeRequest(
        'order_book',
        () => this.publicRequest('GET', '/api/v3/depth', { symbol, limit: depth }),
        1
      );
      
      const bids: OrderBookEntry[] = response.bids.map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity)
      }));
      
      const asks: OrderBookEntry[] = response.asks.map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity)
      }));
      
      const bidVolume = bids.reduce((sum, entry) => sum + entry.quantity, 0);
      const askVolume = asks.reduce((sum, entry) => sum + entry.quantity, 0);
      const midPrice = bids.length > 0 && asks.length > 0 
        ? (bids[0].price + asks[0].price) / 2 
        : 0;
      
      return {
        exchangeId: 'binance',
        symbol,
        timestamp: new Date(),
        bids,
        asks,
        bidVolume,
        askVolume,
        spread: asks.length > 0 && bids.length > 0 ? asks[0].price - bids[0].price : 0,
        midPrice,
        depth: Math.min(bids.length, asks.length),
        quality: 'full',
        lastUpdate: new Date()
      };
      
    } catch (error) {
      throw new Error(`Binance order book query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Subscribe to real-time market data
   */
  async subscribeToMarketData(symbols: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.initializeWebSocket();
    }
    
    for (const symbol of symbols) {
      const stream = `${symbol.toLowerCase()}@ticker`;
      this.wsSubscriptions.add(stream);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: [stream],
          id: Date.now()
        }));
      }
    }
  }
  
  /**
   * Unsubscribe from real-time market data
   */
  async unsubscribeFromMarketData(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      const stream = `${symbol.toLowerCase()}@ticker`;
      this.wsSubscriptions.delete(stream);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: [stream],
          id: Date.now()
        }));
      }
    }
  }
  
  // === PRIVATE METHODS ===
  
  private async testConnectivity(): Promise<void> {
    await this.publicRequest('GET', '/api/v3/ping');
  }
  
  private async getServerTime(): Promise<number> {
    const response = await this.publicRequest('GET', '/api/v3/time');
    return response.serverTime;
  }
  
  private async initializeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.wsBaseUrl}/ws`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log(`[Binance] WebSocket connected to ${wsUrl}`);
        this.wsReconnectAttempts = 0;
        resolve();
      });
      
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.handleError('WebSocket message parsing failed', error);
        }
      });
      
      this.ws.on('error', (error) => {
        this.handleError('WebSocket error', error);
        reject(error);
      });
      
      this.ws.on('close', (code, reason) => {
        console.log(`[Binance] WebSocket closed: ${code} - ${reason}`);
        this.attemptWebSocketReconnection();
      });
      
      // Set connection timeout
      setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }
  
  private handleWebSocketMessage(message: any): void {
    if (message.stream && message.data) {
      const [symbol, dataType] = message.stream.split('@');
      
      switch (dataType) {
        case 'ticker':
          this.handleTickerUpdate(symbol.toUpperCase(), message.data);
          break;
        case 'depth':
          this.handleOrderBookUpdate(symbol.toUpperCase(), message.data);
          break;
        default:
          console.log(`[Binance] Unknown stream data type: ${dataType}`);
      }
    }
  }
  
  private handleTickerUpdate(symbol: string, data: any): void {
    const marketData: UnifiedMarketData = {
      exchangeId: 'binance',
      symbol,
      timestamp: new Date(),
      price: parseFloat(data.c),
      bid: parseFloat(data.b),
      ask: parseFloat(data.a),
      spread: parseFloat(data.a) - parseFloat(data.b),
      volume24h: parseFloat(data.v),
      volumeQuote: parseFloat(data.q),
      high24h: parseFloat(data.h),
      low24h: parseFloat(data.l),
      change24h: parseFloat(data.P),
      changePercent24h: parseFloat(data.P),
      bidDepth: parseFloat(data.B),
      askDepth: parseFloat(data.A),
      lastUpdate: new Date(data.E),
      quality: 'realtime'
    };
    
    this.emit('market_data_update', {
      exchangeId: 'binance',
      symbol,
      data: marketData,
      timestamp: new Date()
    });
  }
  
  private handleOrderBookUpdate(symbol: string, data: any): void {
    // Handle order book updates
    this.emit('order_book_update', {
      exchangeId: 'binance',
      symbol,
      data,
      timestamp: new Date()
    });
  }
  
  private async attemptWebSocketReconnection(): Promise<void> {
    if (this.wsReconnectAttempts >= this.maxWsReconnectAttempts) {
      this.handleError('WebSocket max reconnection attempts reached', new Error('Max reconnection attempts'));
      return;
    }
    
    this.wsReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
    
    setTimeout(async () => {
      try {
        await this.initializeWebSocket();
        
        // Resubscribe to all streams
        if (this.wsSubscriptions.size > 0) {
          const streams = Array.from(this.wsSubscriptions);
          this.ws?.send(JSON.stringify({
            method: 'SUBSCRIBE',
            params: streams,
            id: Date.now()
          }));
        }
      } catch (error) {
        this.handleError('WebSocket reconnection failed', error);
      }
    }, delay);
  }
  
  private async publicRequest(method: string, endpoint: string, params: any = {}): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);
    
    if (method === 'GET' && Object.keys(params).length > 0) {
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key].toString());
      });
    }
    
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return response.json();
  }
  
  private async signedRequest(method: string, endpoint: string, params: any = {}): Promise<any> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials required for signed requests');
    }
    
    // Add timestamp and signature
    params.timestamp = Date.now();
    params.recvWindow = this.recvWindow;
    
    const queryString = new URLSearchParams(params).toString();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
    
    const url = new URL(endpoint, this.baseUrl);
    url.search = `${queryString}&signature=${signature}`;
    
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': this.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response.json();
  }
  
  private async sendOrder(orderData: any): Promise<BinanceOrderResponse> {
    const params = {
      ...orderData,
      timestamp: Date.now(),
      recvWindow: this.recvWindow
    };
    
    return this.signedRequest('POST', '/api/v3/order', params);
  }
  
  private convertToExchangeOrder(order: Order): any {
    return {
      symbol: order.symbol.replace('-', ''), // Convert BTC-USDT to BTCUSDT
      side: order.side.toUpperCase(),
      type: this.convertOrderType(order.type),
      quantity: order.quantity.toString(),
      price: order.price?.toString(),
      timeInForce: this.convertTimeInForce(order.timeInForce || 'GTC'),
      newClientOrderId: order.id
    };
  }
  
  private convertOrderType(type: string): string {
    const typeMap: Record<string, string> = {
      'market': 'MARKET',
      'limit': 'LIMIT',
      'stop': 'STOP_LOSS',
      'stop_limit': 'STOP_LOSS_LIMIT'
    };
    
    return typeMap[type] || 'LIMIT';
  }
  
  private convertTimeInForce(tif: string): string {
    const tifMap: Record<string, string> = {
      'GTC': 'GTC',
      'IOC': 'IOC',
      'FOK': 'FOK'
    };
    
    return tifMap[tif] || 'GTC';
  }
  
  private convertBinanceStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'NEW': 'pending',
      'PARTIALLY_FILLED': 'partially_filled',
      'FILLED': 'filled',
      'CANCELED': 'cancelled',
      'PENDING_CANCEL': 'cancelling',
      'REJECTED': 'rejected',
      'EXPIRED': 'expired'
    };
    
    return statusMap[status] || 'pending';
  }
  
  private convertToOrderExecutionResult(response: BinanceOrderResponse, originalOrder: Order): OrderExecutionResult {
    const orderId = `${response.symbol}_${response.orderId}`;
    
    return {
      success: true,
      orderId,
      executionPrice: parseFloat(response.price) || 0,
      executedQuantity: parseFloat(response.executedQty),
      remainingQuantity: parseFloat(response.origQty) - parseFloat(response.executedQty),
      fees: response.fills.reduce((sum, fill) => sum + parseFloat(fill.commission), 0),
      timestamp: new Date(response.transactTime),
      exchangeOrderId: response.orderId.toString(),
      fills: response.fills.map(fill => ({
        price: parseFloat(fill.price),
        quantity: parseFloat(fill.qty),
        commission: parseFloat(fill.commission),
        commissionAsset: fill.commissionAsset,
        timestamp: new Date(response.transactTime)
      }))
    };
  }
  
  private convertBinanceOrderToExchangeOrder(response: any): ExchangeOrder {
    return {
      id: `${response.symbol}_${response.orderId}`,
      executionPlanId: `plan_${response.orderId}`,
      symbol: this.convertSymbolFromBinance(response.symbol),
      side: response.side.toLowerCase() as 'buy' | 'sell',
      type: this.convertOrderTypeFromBinance(response.type),
      quantity: parseFloat(response.origQty),
      price: parseFloat(response.price) || undefined,
      timeInForce: response.timeInForce as any,
      status: this.convertBinanceStatus(response.status),
      filledQuantity: parseFloat(response.executedQty),
      createdAt: new Date(response.time),
      updatedAt: new Date(response.updateTime),
      
      // Exchange-specific fields
      exchangeId: 'binance',
      exchangeOrderId: response.orderId.toString(),
      exchangeSymbol: response.symbol,
      exchangeTimestamp: new Date(response.time),
      
      // Additional metadata
      metadata: {
        strategy: 'unknown',
        mode: 'live',
        childOrderIds: [],
        retryCount: 0,
        executionPath: ['binance_connector']
      }
    };
  }
  
  private convertSymbolFromBinance(binanceSymbol: string): string {
    // Convert BTCUSDT to BTC-USDT
    // This is a simplified conversion - production code would need a proper mapping
    return binanceSymbol.replace(/USDT$/, '-USDT').replace(/BTC$/, '-BTC');
  }
  
  private convertOrderTypeFromBinance(binanceType: string): string {
    const typeMap: Record<string, string> = {
      'MARKET': 'market',
      'LIMIT': 'limit',
      'STOP_LOSS': 'stop',
      'STOP_LOSS_LIMIT': 'stop_limit'
    };
    
    return typeMap[binanceType] || 'limit';
  }
  
  private convertBinanceBalanceToExchangeBalance(balance: BinanceBalanceResponse): ExchangeBalance {
    const free = parseFloat(balance.free);
    const locked = parseFloat(balance.locked);
    
    return {
      exchangeId: 'binance',
      asset: balance.asset,
      free,
      locked,
      total: free + locked,
      timestamp: new Date(),
      accountType: 'spot'
    };
  }
  
  private parseInternalOrderId(orderId: string): [string, string] {
    // Parse internal format: SYMBOL_ORDERID
    const parts = orderId.split('_');
    if (parts.length !== 2) {
      throw new Error(`Invalid order ID format: ${orderId}`);
    }
    
    return [parts[0], parts[1]];
  }
}

export default BinanceConnector;