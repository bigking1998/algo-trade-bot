/**
 * Valuation Engine - Real-time Portfolio Valuation
 * Part of Task BE-022: Position Manager Implementation
 * 
 * High-performance portfolio valuation system with:
 * - Sub-20ms valuation latency
 * - Multi-asset class support
 * - Currency conversion
 * - Mark-to-market pricing
 * - Caching and optimization
 * 
 * Performance targets: < 20ms valuation, 1000+ positions support
 */

import { EventEmitter } from 'events';
import type { PortfolioManager } from './PortfolioManager.js';

export interface AssetPrice {
  symbol: string;
  price: number;
  timestamp: Date;
  source: 'market' | 'oracle' | 'calculated' | 'cached';
  confidence: number; // 0-100
}

export interface ValuationConfig {
  // Pricing sources
  primaryPriceSource: 'dydx' | 'oracle' | 'external';
  fallbackPriceSources: string[];
  
  // Caching
  enablePriceCache: boolean;
  priceCacheExpiryMs: number; // Default: 5000ms (5 seconds)
  maxCacheSize: number; // Default: 10000 entries
  
  // Performance
  batchValuationSize: number; // Default: 100
  enableParallelValuation: boolean;
  valuationTimeoutMs: number; // Default: 15000ms
  
  // Currency
  baseCurrency: string; // Default: 'USD'
  supportedCurrencies: string[];
  
  // Precision
  pricePrecision: number; // Default: 8 decimal places
  valuationPrecision: number; // Default: 2 decimal places
}

export interface ValuationResult {
  totalValue: number;
  assetValues: Map<string, number>;
  pricesUsed: Map<string, AssetPrice>;
  calculationTime: number;
  timestamp: Date;
  confidence: number; // Overall confidence score
}

export interface PriceSource {
  name: string;
  priority: number;
  isActive: boolean;
  getPrice(symbol: string): Promise<AssetPrice | null>;
  getPrices(symbols: string[]): Promise<Map<string, AssetPrice>>;
}

/**
 * High-Performance Valuation Engine
 */
export class ValuationEngine extends EventEmitter {
  private portfolioManager: PortfolioManager;
  private config: ValuationConfig;
  
  // Price cache for performance
  private priceCache: Map<string, { price: AssetPrice; expiry: number }> = new Map();
  private priceSources: Map<string, PriceSource> = new Map();
  
  // Performance tracking
  private metrics = {
    valuationCount: 0,
    totalValuationTime: 0,
    avgValuationTime: 0,
    maxValuationTime: 0,
    minValuationTime: Infinity,
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    lastValuation: new Date()
  };
  
  // Currency conversion rates cache
  private exchangeRates: Map<string, { rate: number; timestamp: Date }> = new Map();
  
  constructor(portfolioManager: PortfolioManager, config: Partial<ValuationConfig> = {}) {
    super();
    
    this.portfolioManager = portfolioManager;
    this.config = {
      primaryPriceSource: 'dydx',
      fallbackPriceSources: ['oracle', 'external'],
      enablePriceCache: true,
      priceCacheExpiryMs: 5000,
      maxCacheSize: 10000,
      batchValuationSize: 100,
      enableParallelValuation: true,
      valuationTimeoutMs: 15000,
      baseCurrency: 'USD',
      supportedCurrencies: ['USD', 'USDT', 'USDC', 'BTC', 'ETH'],
      pricePrecision: 8,
      valuationPrecision: 2,
      ...config
    };
  }
  
  /**
   * Initialize valuation engine
   */
  async initialize(): Promise<void> {
    console.log('Initializing Valuation Engine...');
    
    // Initialize price sources
    await this.initializePriceSources();
    
    // Load initial exchange rates
    await this.loadExchangeRates();
    
    console.log(`Valuation Engine initialized with ${this.priceSources.size} price sources`);
  }
  
  /**
   * Calculate total portfolio value
   */
  async calculatePortfolioValue(): Promise<number> {
    const startTime = Date.now();
    
    try {
      const result = await this.performValuation();
      
      const calculationTime = Date.now() - startTime;
      this.updateMetrics(calculationTime);
      
      // Emit valuation event
      this.emit('valuation_completed', {
        totalValue: result.totalValue,
        calculationTime,
        confidence: result.confidence,
        assetCount: result.assetValues.size
      });
      
      return this.roundToPrecision(result.totalValue, this.config.valuationPrecision);
      
    } catch (error) {
      this.metrics.errorCount++;
      console.error('Portfolio valuation failed:', error);
      throw new Error(`Valuation failed: ${error.message}`);
    }
  }
  
  /**
   * Calculate detailed valuation result
   */
  async getDetailedValuation(): Promise<ValuationResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.performValuation();
      result.calculationTime = Date.now() - startTime;
      result.timestamp = new Date();
      
      return result;
      
    } catch (error) {
      this.metrics.errorCount++;
      throw error;
    }
  }
  
  /**
   * Get cached price for symbol
   */
  getCachedPrice(symbol: string): AssetPrice | null {
    if (!this.config.enablePriceCache) return null;
    
    const cached = this.priceCache.get(symbol);
    if (!cached || Date.now() > cached.expiry) {
      return null;
    }
    
    this.metrics.cacheHits++;
    return cached.price;
  }
  
  /**
   * Get real-time price for symbol
   */
  async getPrice(symbol: string): Promise<AssetPrice> {
    // Check cache first
    const cachedPrice = this.getCachedPrice(symbol);
    if (cachedPrice) {
      return cachedPrice;
    }
    
    this.metrics.cacheMisses++;
    
    // Try price sources in priority order
    const sources = this.getPrioritizedSources();
    
    for (const source of sources) {
      try {
        const price = await source.getPrice(symbol);
        if (price && price.price > 0) {
          this.cachePrice(symbol, price);
          return price;
        }
      } catch (error) {
        console.warn(`Price source ${source.name} failed for ${symbol}:`, error.message);
      }
    }
    
    throw new Error(`No price available for ${symbol}`);
  }
  
  /**
   * Get prices for multiple symbols
   */
  async getPrices(symbols: string[]): Promise<Map<string, AssetPrice>> {
    const prices = new Map<string, AssetPrice>();
    const uncachedSymbols: string[] = [];
    
    // Check cache for each symbol
    for (const symbol of symbols) {
      const cachedPrice = this.getCachedPrice(symbol);
      if (cachedPrice) {
        prices.set(symbol, cachedPrice);
      } else {
        uncachedSymbols.push(symbol);
      }
    }
    
    // Fetch uncached prices
    if (uncachedSymbols.length > 0) {
      const fetchedPrices = await this.fetchPricesFromSources(uncachedSymbols);
      
      for (const [symbol, price] of fetchedPrices) {
        prices.set(symbol, price);
        this.cachePrice(symbol, price);
      }
    }
    
    return prices;
  }
  
  /**
   * Convert value between currencies
   */
  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
  }
  
  /**
   * Get valuation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0 ?
        (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0,
      cacheSize: this.priceCache.size,
      activeSources: Array.from(this.priceSources.values()).filter(s => s.isActive).length
    };
  }
  
  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    console.log('Price cache cleared');
  }
  
  // Private methods
  
  private async performValuation(): Promise<ValuationResult> {
    const state = this.portfolioManager.getState();
    const positions = Array.from(state.positions.values()).filter(pos => pos.quantity > 0);
    
    if (positions.length === 0) {
      return {
        totalValue: 0,
        assetValues: new Map(),
        pricesUsed: new Map(),
        calculationTime: 0,
        timestamp: new Date(),
        confidence: 100
      };
    }
    
    // Get unique symbols
    const symbols = [...new Set(positions.map(pos => pos.symbol))];
    
    // Fetch prices for all symbols
    const prices = await this.getPrices(symbols);
    
    // Calculate individual asset values
    const assetValues = new Map<string, number>();
    let totalValue = 0;
    let totalConfidence = 0;
    
    for (const position of positions) {
      const price = prices.get(position.symbol);
      if (price) {
        const value = position.quantity * price.price;
        const convertedValue = await this.convertCurrency(value, 'USD', this.config.baseCurrency);
        
        assetValues.set(position.symbol, convertedValue);
        totalValue += convertedValue;
        totalConfidence += price.confidence;
      } else {
        console.warn(`No price available for position ${position.symbol}`);
      }
    }
    
    // Add cash balances
    for (const [currency, balance] of state.balances) {
      if (balance > 0) {
        const convertedValue = await this.convertCurrency(balance, currency, this.config.baseCurrency);
        const existing = assetValues.get(currency) || 0;
        assetValues.set(currency, existing + convertedValue);
        totalValue += convertedValue;
        totalConfidence += 100; // Cash has 100% confidence
      }
    }
    
    const avgConfidence = prices.size > 0 ? totalConfidence / prices.size : 0;
    
    return {
      totalValue,
      assetValues,
      pricesUsed: prices,
      calculationTime: 0, // Will be set by caller
      timestamp: new Date(),
      confidence: Math.min(100, Math.max(0, avgConfidence))
    };
  }
  
  private async fetchPricesFromSources(symbols: string[]): Promise<Map<string, AssetPrice>> {
    const prices = new Map<string, AssetPrice>();
    const sources = this.getPrioritizedSources();
    
    if (this.config.enableParallelValuation) {
      // Try all sources in parallel for better performance
      const promises = sources.map(async source => {
        try {
          return await source.getPrices(symbols);
        } catch (error) {
          console.warn(`Price source ${source.name} failed:`, error.message);
          return new Map<string, AssetPrice>();
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      // Merge results, prioritizing by source order
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          const sourcePrices = (results[i] as PromiseFulfilledResult<Map<string, AssetPrice>>).value;
          
          for (const [symbol, price] of sourcePrices) {
            if (!prices.has(symbol) && price.price > 0) {
              prices.set(symbol, price);
            }
          }
        }
      }
    } else {
      // Sequential fallback approach
      for (const source of sources) {
        const remainingSymbols = symbols.filter(s => !prices.has(s));
        if (remainingSymbols.length === 0) break;
        
        try {
          const sourcePrices = await source.getPrices(remainingSymbols);
          for (const [symbol, price] of sourcePrices) {
            if (price.price > 0) {
              prices.set(symbol, price);
            }
          }
        } catch (error) {
          console.warn(`Price source ${source.name} failed:`, error.message);
        }
      }
    }
    
    return prices;
  }
  
  private getPrioritizedSources(): PriceSource[] {
    return Array.from(this.priceSources.values())
      .filter(source => source.isActive)
      .sort((a, b) => a.priority - b.priority);
  }
  
  private cachePrice(symbol: string, price: AssetPrice): void {
    if (!this.config.enablePriceCache) return;
    
    // Implement LRU cache eviction if needed
    if (this.priceCache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      const oldest = Array.from(this.priceCache.entries())
        .reduce((min, [key, value]) => value.expiry < min[1].expiry ? [key, value] : min);
      this.priceCache.delete(oldest[0]);
    }
    
    this.priceCache.set(symbol, {
      price: { ...price, source: 'cached' },
      expiry: Date.now() + this.config.priceCacheExpiryMs
    });
  }
  
  private async initializePriceSources(): Promise<void> {
    // Initialize dYdX price source
    this.priceSources.set('dydx', {
      name: 'dYdX',
      priority: 1,
      isActive: true,
      getPrice: async (symbol: string) => {
        // Implementation would fetch from dYdX API
        return {
          symbol,
          price: 0, // Placeholder
          timestamp: new Date(),
          source: 'market',
          confidence: 95
        };
      },
      getPrices: async (symbols: string[]) => {
        // Batch price fetch implementation
        return new Map();
      }
    });
    
    // Initialize oracle price source
    this.priceSources.set('oracle', {
      name: 'Oracle',
      priority: 2,
      isActive: true,
      getPrice: async (symbol: string) => {
        // Implementation would fetch from oracle
        return null;
      },
      getPrices: async (symbols: string[]) => {
        return new Map();
      }
    });
  }
  
  private async loadExchangeRates(): Promise<void> {
    // Load USD exchange rates for supported currencies
    // In real implementation, this would fetch from external API
    this.exchangeRates.set('USD', { rate: 1.0, timestamp: new Date() });
    this.exchangeRates.set('USDT', { rate: 1.0, timestamp: new Date() });
    this.exchangeRates.set('USDC', { rate: 1.0, timestamp: new Date() });
  }
  
  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1.0;
    
    // Simple implementation - in production would use real exchange rates
    const fromRate = this.exchangeRates.get(fromCurrency)?.rate || 1.0;
    const toRate = this.exchangeRates.get(toCurrency)?.rate || 1.0;
    
    return fromRate / toRate;
  }
  
  private updateMetrics(calculationTime: number): void {
    this.metrics.valuationCount++;
    this.metrics.totalValuationTime += calculationTime;
    this.metrics.lastValuation = new Date();
    
    // Update rolling averages
    this.metrics.avgValuationTime = this.metrics.totalValuationTime / this.metrics.valuationCount;
    this.metrics.maxValuationTime = Math.max(this.metrics.maxValuationTime, calculationTime);
    this.metrics.minValuationTime = Math.min(this.metrics.minValuationTime, calculationTime);
  }
  
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
  
  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.priceCache.clear();
    this.exchangeRates.clear();
    this.priceSources.clear();
    this.removeAllListeners();
  }
}

export default ValuationEngine;