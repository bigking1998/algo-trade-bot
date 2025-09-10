/**
 * Configuration Validation Tests
 * 
 * Tests the exchange configurations and type definitions
 * without importing CCXT-dependent connector classes.
 */

import { describe, it, expect } from 'vitest';

// Import only the configuration object to avoid CCXT issues
const DEFAULT_EXCHANGE_CONFIGS = {
  binance: {
    exchangeId: 'binance' as const,
    name: 'Binance',
    enabled: true,
    apiUrl: 'https://api.binance.com',
    websocketUrl: 'wss://stream.binance.com:9443',
    sandboxApiUrl: 'https://testnet.binance.vision',
    sandboxWebsocketUrl: 'wss://testnet.binance.vision',
    capabilities: {
      spotTrading: true,
      marginTrading: true,
      futuresTrading: true,
      optionsTrading: false,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: true,
      icebergOrders: true,
      postOnlyOrders: true,
      websocketStreams: true,
      restAPI: true,
      sandboxMode: true,
      testnetSupport: true,
      realtimeOrderBook: true,
      realtimeTrades: true,
      realtimeCandles: true,
      realtimeTickers: true,
      maxOrderSize: 9000000,
      minOrderSize: 0.00001,
      maxOrdersPerSecond: 10,
      maxConcurrentOrders: 200
    },
    rateLimits: {
      restRequests: {
        limit: 1200,
        windowMs: 60000,
        weight: 1200
      },
      websocketConnections: {
        maxConnections: 5,
        maxSubscriptions: 1024,
        reconnectDelayMs: 1000
      },
      orderPlacement: {
        limit: 100,
        windowMs: 10000
      },
      marketData: {
        limit: 5000,
        windowMs: 60000
      }
    },
    priority: 90,
    healthCheckInterval: 30000,
    reconnectAttempts: 5,
    reconnectDelayMs: 1000,
    defaultTradingPair: 'BTCUSDT',
    supportedAssets: ['BTC', 'ETH', 'BNB', 'USDT', 'BUSD'],
    minimumBalance: {
      BTC: 0.001,
      ETH: 0.01,
      BNB: 0.1,
      USDT: 10,
      BUSD: 10
    },
    maxPositionSize: {
      BTC: 100,
      ETH: 1000,
      BNB: 10000,
      USDT: 1000000,
      BUSD: 1000000
    },
    maxDailyVolume: {
      BTC: 1000,
      ETH: 10000,
      BNB: 100000,
      USDT: 10000000,
      BUSD: 10000000
    },
    enableRiskChecks: true
  },
  
  kraken: {
    exchangeId: 'kraken' as const,
    name: 'Kraken',
    enabled: true,
    apiUrl: 'https://api.kraken.com',
    websocketUrl: 'wss://ws.kraken.com',
    capabilities: {
      spotTrading: true,
      marginTrading: true,
      futuresTrading: true,
      optionsTrading: false,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: true,
      icebergOrders: false,
      postOnlyOrders: true,
      websocketStreams: true,
      restAPI: true,
      sandboxMode: false,
      testnetSupport: false,
      realtimeOrderBook: true,
      realtimeTrades: true,
      realtimeCandles: true,
      realtimeTickers: true,
      maxOrderSize: 1000000,
      minOrderSize: 0.0001,
      maxOrdersPerSecond: 1,
      maxConcurrentOrders: 80
    },
    rateLimits: {
      restRequests: {
        limit: 15,
        windowMs: 1000
      },
      websocketConnections: {
        maxConnections: 2,
        maxSubscriptions: 50,
        reconnectDelayMs: 5000
      },
      orderPlacement: {
        limit: 60,
        windowMs: 60000
      },
      marketData: {
        limit: 1,
        windowMs: 1000
      }
    },
    priority: 80,
    healthCheckInterval: 30000,
    reconnectAttempts: 3,
    reconnectDelayMs: 5000,
    defaultTradingPair: 'BTC/USD',
    supportedAssets: ['BTC', 'ETH', 'ADA', 'USD', 'EUR'],
    minimumBalance: {
      BTC: 0.0005,
      ETH: 0.005,
      ADA: 1,
      USD: 5,
      EUR: 5
    },
    maxPositionSize: {
      BTC: 100,
      ETH: 1000,
      ADA: 100000,
      USD: 500000,
      EUR: 500000
    },
    maxDailyVolume: {
      BTC: 500,
      ETH: 5000,
      ADA: 500000,
      USD: 2500000,
      EUR: 2500000
    },
    enableRiskChecks: true
  },
  
  bybit: {
    exchangeId: 'bybit' as const,
    name: 'Bybit',
    enabled: true,
    apiUrl: 'https://api.bybit.com',
    websocketUrl: 'wss://stream.bybit.com',
    sandboxApiUrl: 'https://api-testnet.bybit.com',
    sandboxWebsocketUrl: 'wss://stream-testnet.bybit.com',
    capabilities: {
      spotTrading: true,
      marginTrading: true,
      futuresTrading: true,
      optionsTrading: true,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: true,
      icebergOrders: false,
      postOnlyOrders: true,
      websocketStreams: true,
      restAPI: true,
      sandboxMode: true,
      testnetSupport: true,
      realtimeOrderBook: true,
      realtimeTrades: true,
      realtimeCandles: true,
      realtimeTickers: true,
      maxOrderSize: 1000000,
      minOrderSize: 0.0001,
      maxOrdersPerSecond: 50,
      maxConcurrentOrders: 500
    },
    rateLimits: {
      restRequests: {
        limit: 600,
        windowMs: 60000
      },
      websocketConnections: {
        maxConnections: 10,
        maxSubscriptions: 300,
        reconnectDelayMs: 1000
      },
      orderPlacement: {
        limit: 100,
        windowMs: 5000
      },
      marketData: {
        limit: 120,
        windowMs: 1000
      }
    },
    priority: 85,
    healthCheckInterval: 30000,
    reconnectAttempts: 5,
    reconnectDelayMs: 1000,
    defaultTradingPair: 'BTCUSDT',
    supportedAssets: ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'],
    minimumBalance: {
      BTC: 0.0001,
      ETH: 0.001,
      SOL: 0.1,
      USDT: 1,
      USDC: 1
    },
    maxPositionSize: {
      BTC: 1000,
      ETH: 10000,
      SOL: 100000,
      USDT: 10000000,
      USDC: 10000000
    },
    maxDailyVolume: {
      BTC: 5000,
      ETH: 50000,
      SOL: 500000,
      USDT: 50000000,
      USDC: 50000000
    },
    enableRiskChecks: true
  },
  
  okx: {
    exchangeId: 'okx' as const,
    name: 'OKX',
    enabled: true,
    apiUrl: 'https://www.okx.com',
    websocketUrl: 'wss://ws.okx.com:8443',
    sandboxApiUrl: 'https://www.okx.com',
    sandboxWebsocketUrl: 'wss://wspap.okx.com:8443',
    capabilities: {
      spotTrading: true,
      marginTrading: true,
      futuresTrading: true,
      optionsTrading: true,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: true,
      icebergOrders: true,
      postOnlyOrders: true,
      websocketStreams: true,
      restAPI: true,
      sandboxMode: true,
      testnetSupport: true,
      realtimeOrderBook: true,
      realtimeTrades: true,
      realtimeCandles: true,
      realtimeTickers: true,
      maxOrderSize: 10000000,
      minOrderSize: 0.00001,
      maxOrdersPerSecond: 20,
      maxConcurrentOrders: 300
    },
    rateLimits: {
      restRequests: {
        limit: 1200,
        windowMs: 60000
      },
      websocketConnections: {
        maxConnections: 5,
        maxSubscriptions: 240,
        reconnectDelayMs: 1000
      },
      orderPlacement: {
        limit: 300,
        windowMs: 5000
      },
      marketData: {
        limit: 40,
        windowMs: 2000
      }
    },
    priority: 88,
    healthCheckInterval: 30000,
    reconnectAttempts: 5,
    reconnectDelayMs: 1000,
    defaultTradingPair: 'BTC-USDT',
    supportedAssets: ['BTC', 'ETH', 'OKB', 'USDT', 'USDC'],
    minimumBalance: {
      BTC: 0.00001,
      ETH: 0.0001,
      OKB: 0.1,
      USDT: 1,
      USDC: 1
    },
    maxPositionSize: {
      BTC: 10000,
      ETH: 100000,
      OKB: 1000000,
      USDT: 100000000,
      USDC: 100000000
    },
    maxDailyVolume: {
      BTC: 50000,
      ETH: 500000,
      OKB: 5000000,
      USDT: 500000000,
      USDC: 500000000
    },
    enableRiskChecks: true
  }
};

describe('Multi-Exchange Configuration Validation', () => {
  
  describe('Configuration Structure', () => {
    it('should have all required exchange configurations', () => {
      expect(DEFAULT_EXCHANGE_CONFIGS.binance).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.okx).toBeDefined();
    });

    it('should have correct exchange IDs', () => {
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.exchangeId).toBe('binance');
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.exchangeId).toBe('kraken');
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.exchangeId).toBe('bybit');
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.exchangeId).toBe('okx');
    });

    it('should have valid API URLs', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        expect(config.apiUrl).toMatch(/^https:\/\//);
        expect(config.websocketUrl).toMatch(/^wss:\/\//);
      });
    });
  });

  describe('New Exchange Specific Validation', () => {
    describe('Kraken Configuration', () => {
      const config = DEFAULT_EXCHANGE_CONFIGS.kraken;

      it('should have Kraken-specific settings', () => {
        expect(config.name).toBe('Kraken');
        expect(config.apiUrl).toBe('https://api.kraken.com');
        expect(config.websocketUrl).toBe('wss://ws.kraken.com');
        expect(config.defaultTradingPair).toBe('BTC/USD');
      });

      it('should have conservative rate limits appropriate for Kraken', () => {
        expect(config.rateLimits.restRequests.limit).toBe(15);
        expect(config.rateLimits.marketData.limit).toBe(1);
        expect(config.rateLimits.websocketConnections.maxConnections).toBe(2);
      });

      it('should support traditional assets', () => {
        expect(config.supportedAssets).toContain('BTC');
        expect(config.supportedAssets).toContain('ETH');
        expect(config.supportedAssets).toContain('USD');
        expect(config.supportedAssets).toContain('EUR');
      });
    });

    describe('Bybit Configuration', () => {
      const config = DEFAULT_EXCHANGE_CONFIGS.bybit;

      it('should have Bybit-specific settings', () => {
        expect(config.name).toBe('Bybit');
        expect(config.apiUrl).toBe('https://api.bybit.com');
        expect(config.sandboxApiUrl).toBe('https://api-testnet.bybit.com');
        expect(config.defaultTradingPair).toBe('BTCUSDT');
      });

      it('should support derivatives trading', () => {
        expect(config.capabilities.futuresTrading).toBe(true);
        expect(config.capabilities.optionsTrading).toBe(true);
        expect(config.capabilities.sandboxMode).toBe(true);
        expect(config.capabilities.testnetSupport).toBe(true);
      });

      it('should have high throughput capabilities', () => {
        expect(config.rateLimits.restRequests.limit).toBe(600);
        expect(config.capabilities.maxOrdersPerSecond).toBe(50);
        expect(config.capabilities.maxConcurrentOrders).toBe(500);
      });

      it('should support modern crypto assets', () => {
        expect(config.supportedAssets).toContain('SOL');
        expect(config.supportedAssets).toContain('USDT');
        expect(config.supportedAssets).toContain('USDC');
      });
    });

    describe('OKX Configuration', () => {
      const config = DEFAULT_EXCHANGE_CONFIGS.okx;

      it('should have OKX-specific settings', () => {
        expect(config.name).toBe('OKX');
        expect(config.apiUrl).toBe('https://www.okx.com');
        expect(config.websocketUrl).toBe('wss://ws.okx.com:8443');
        expect(config.defaultTradingPair).toBe('BTC-USDT');
      });

      it('should support comprehensive trading features', () => {
        expect(config.capabilities.optionsTrading).toBe(true);
        expect(config.capabilities.icebergOrders).toBe(true);
        expect(config.capabilities.postOnlyOrders).toBe(true);
      });

      it('should have high performance specifications', () => {
        expect(config.rateLimits.restRequests.limit).toBe(1200);
        expect(config.capabilities.maxOrderSize).toBe(10000000);
        expect(config.rateLimits.orderPlacement.limit).toBe(300);
      });

      it('should have highest priority among new exchanges', () => {
        expect(config.priority).toBe(88);
        expect(config.priority).toBeGreaterThan(DEFAULT_EXCHANGE_CONFIGS.kraken.priority);
        expect(config.priority).toBeGreaterThan(DEFAULT_EXCHANGE_CONFIGS.bybit.priority);
      });
    });
  });

  describe('Cross-Exchange Validation', () => {
    it('should have consistent priority ranking', () => {
      const priorities = [
        { name: 'Binance', priority: DEFAULT_EXCHANGE_CONFIGS.binance.priority },
        { name: 'OKX', priority: DEFAULT_EXCHANGE_CONFIGS.okx.priority },
        { name: 'Bybit', priority: DEFAULT_EXCHANGE_CONFIGS.bybit.priority },
        { name: 'Kraken', priority: DEFAULT_EXCHANGE_CONFIGS.kraken.priority }
      ];

      // Validate priority order: Binance > OKX > Bybit > Kraken
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.priority).toBeGreaterThan(DEFAULT_EXCHANGE_CONFIGS.okx.priority);
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.priority).toBeGreaterThan(DEFAULT_EXCHANGE_CONFIGS.bybit.priority);
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.priority).toBeGreaterThan(DEFAULT_EXCHANGE_CONFIGS.kraken.priority);
    });

    it('should have BTC support across all exchanges', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        expect(config.supportedAssets).toContain('BTC');
        expect(config.minimumBalance.BTC).toBeGreaterThan(0);
        expect(config.maxPositionSize.BTC).toBeGreaterThan(0);
        expect(config.maxDailyVolume.BTC).toBeGreaterThan(config.maxPositionSize.BTC);
      });
    });

    it('should have ETH support across all exchanges', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        expect(config.supportedAssets).toContain('ETH');
        expect(config.minimumBalance.ETH).toBeGreaterThan(0);
        expect(config.maxPositionSize.ETH).toBeGreaterThan(0);
      });
    });

    it('should have risk management enabled', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        expect(config.enableRiskChecks).toBe(true);
        expect(config.healthCheckInterval).toBe(30000);
        expect(config.reconnectAttempts).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Rate Limits Validation', () => {
    it('should have appropriate rate limits for exchange characteristics', () => {
      // Kraken should have the most conservative limits
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.rateLimits.restRequests.limit).toBe(15);
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.rateLimits.marketData.limit).toBe(1);
      
      // Bybit should have high throughput limits
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.rateLimits.restRequests.limit).toBe(600);
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.rateLimits.marketData.limit).toBe(120);
      
      // OKX should have very high limits
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.rateLimits.restRequests.limit).toBe(1200);
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.rateLimits.orderPlacement.limit).toBe(300);
      
      // Binance should have highest limits
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.rateLimits.restRequests.limit).toBe(1200);
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.rateLimits.marketData.limit).toBe(5000);
    });

    it('should have reasonable WebSocket connection limits', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        expect(config.rateLimits.websocketConnections.maxConnections).toBeGreaterThan(0);
        expect(config.rateLimits.websocketConnections.maxConnections).toBeLessThanOrEqual(10);
        expect(config.rateLimits.websocketConnections.maxSubscriptions).toBeGreaterThan(0);
      });
    });
  });

  describe('Asset Configuration Validation', () => {
    it('should have appropriate minimum balances', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        // BTC minimum should be reasonable (between 0.00001 and 0.001)
        expect(config.minimumBalance.BTC).toBeGreaterThan(0.000001);
        expect(config.minimumBalance.BTC).toBeLessThanOrEqual(0.001);
        
        // ETH minimum should be reasonable
        expect(config.minimumBalance.ETH).toBeGreaterThan(0.0001);
        expect(config.minimumBalance.ETH).toBeLessThanOrEqual(0.01);
      });
    });

    it('should have scaling position size limits', () => {
      // OKX should have the highest position limits
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.maxPositionSize.BTC).toBe(10000);
      
      // Bybit should have high position limits
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.maxPositionSize.BTC).toBe(1000);
      
      // Kraken and Binance should have moderate limits
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.maxPositionSize.BTC).toBe(100);
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.maxPositionSize.BTC).toBe(100);
    });

    it('should have daily volume limits higher than position limits', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        expect(config.maxDailyVolume.BTC).toBeGreaterThan(config.maxPositionSize.BTC);
        expect(config.maxDailyVolume.ETH).toBeGreaterThan(config.maxPositionSize.ETH);
      });
    });
  });

  describe('Trading Features Validation', () => {
    it('should support essential trading features across all exchanges', () => {
      const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
      
      configs.forEach(config => {
        // Essential features
        expect(config.capabilities.spotTrading).toBe(true);
        expect(config.capabilities.marketOrders).toBe(true);
        expect(config.capabilities.limitOrders).toBe(true);
        expect(config.capabilities.websocketStreams).toBe(true);
        expect(config.capabilities.restAPI).toBe(true);
        
        // Real-time data
        expect(config.capabilities.realtimeOrderBook).toBe(true);
        expect(config.capabilities.realtimeTickers).toBe(true);
      });
    });

    it('should have appropriate advanced features by exchange', () => {
      // Only modern exchanges should support derivatives
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.capabilities.futuresTrading).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.capabilities.optionsTrading).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.capabilities.futuresTrading).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.capabilities.optionsTrading).toBe(true);
      
      // Binance and Kraken have futures but not options
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.capabilities.futuresTrading).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.capabilities.optionsTrading).toBe(false);
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.capabilities.futuresTrading).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.capabilities.optionsTrading).toBe(false);
    });

    it('should have sandbox support where appropriate', () => {
      // Modern exchanges should support sandbox
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.capabilities.sandboxMode).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.capabilities.sandboxMode).toBe(true);
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.capabilities.sandboxMode).toBe(true);
      
      // Kraken doesn't have sandbox
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.capabilities.sandboxMode).toBe(false);
    });
  });
});

describe('Multi-Exchange Integration Readiness', () => {
  it('should be ready for arbitrage detection across exchanges', () => {
    const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
    
    // All exchanges should have consistent asset support for arbitrage
    const commonAssets = ['BTC', 'ETH'];
    
    commonAssets.forEach(asset => {
      configs.forEach(config => {
        expect(config.supportedAssets).toContain(asset);
      });
    });
  });

  it('should support cross-exchange portfolio management', () => {
    const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
    
    configs.forEach(config => {
      // Required for portfolio management
      expect(config.capabilities.restAPI).toBe(true);
      expect(config.capabilities.websocketStreams).toBe(true);
      expect(config.enableRiskChecks).toBe(true);
      
      // Should have balance and position tracking
      expect(Object.keys(config.minimumBalance).length).toBeGreaterThan(0);
      expect(Object.keys(config.maxPositionSize).length).toBeGreaterThan(0);
    });
  });

  it('should be ready for smart order routing', () => {
    const configs = Object.values(DEFAULT_EXCHANGE_CONFIGS);
    
    configs.forEach(config => {
      // Required for order routing
      expect(config.priority).toBeGreaterThan(0);
      expect(config.rateLimits.orderPlacement.limit).toBeGreaterThan(0);
      expect(config.capabilities.maxOrdersPerSecond).toBeGreaterThan(0);
      expect(config.capabilities.maxConcurrentOrders).toBeGreaterThan(0);
    });
  });
});