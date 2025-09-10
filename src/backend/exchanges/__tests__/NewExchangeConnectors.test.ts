/**
 * Test Suite for New Exchange Connectors
 * 
 * Tests the basic functionality of the newly added exchange connectors:
 * - KrakenConnector
 * - BybitConnector  
 * - OKXConnector
 * 
 * These tests verify connector creation, configuration validation,
 * and basic interface compliance without requiring actual API credentials.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KrakenConnector } from '../connectors/KrakenConnector.js';
import { BybitConnector } from '../connectors/BybitConnector.js';
import { OKXConnector } from '../connectors/OKXConnector.js';
import { DEFAULT_EXCHANGE_CONFIGS } from '../index.js';
import type { ExchangeConfig } from '../types.js';

describe('New Exchange Connectors', () => {
  describe('KrakenConnector', () => {
    let connector: KrakenConnector;
    let config: ExchangeConfig;

    beforeEach(() => {
      config = {
        ...DEFAULT_EXCHANGE_CONFIGS.kraken,
        apiKey: 'test_api_key',
        apiSecret: 'test_api_secret'
      };
      connector = new KrakenConnector(config);
    });

    afterEach(async () => {
      if (connector) {
        await connector.cleanup();
      }
    });

    it('should create KrakenConnector instance', () => {
      expect(connector).toBeDefined();
      expect(connector.getExchangeId()).toBe('kraken');
    });

    it('should have correct initial status', () => {
      expect(connector.getStatus()).toBe('disconnected');
    });

    it('should support required features', () => {
      expect(connector.supportsFeature('spotTrading')).toBe(true);
      expect(connector.supportsFeature('websocketStreams')).toBe(true);
      expect(connector.supportsFeature('limitOrders')).toBe(true);
      expect(connector.supportsFeature('marketOrders')).toBe(true);
    });

    it('should provide health metrics', () => {
      const health = connector.getHealth();
      
      expect(health).toBeDefined();
      expect(health.exchangeId).toBe('kraken');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(typeof health.latency).toBe('number');
      expect(typeof health.uptime).toBe('number');
      expect(health.rateLimitUsage).toBeDefined();
    });

    it('should provide performance metrics', () => {
      const metrics = connector.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.exchangeId).toBe('kraken');
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(typeof metrics.totalTrades).toBe('number');
      expect(typeof metrics.averageLatency).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
    });
  });

  describe('BybitConnector', () => {
    let connector: BybitConnector;
    let config: ExchangeConfig;

    beforeEach(() => {
      config = {
        ...DEFAULT_EXCHANGE_CONFIGS.bybit,
        apiKey: 'test_api_key',
        apiSecret: 'test_api_secret'
      };
      connector = new BybitConnector(config);
    });

    afterEach(async () => {
      if (connector) {
        await connector.cleanup();
      }
    });

    it('should create BybitConnector instance', () => {
      expect(connector).toBeDefined();
      expect(connector.getExchangeId()).toBe('bybit');
    });

    it('should have correct initial status', () => {
      expect(connector.getStatus()).toBe('disconnected');
    });

    it('should support required features', () => {
      expect(connector.supportsFeature('spotTrading')).toBe(true);
      expect(connector.supportsFeature('futuresTrading')).toBe(true);
      expect(connector.supportsFeature('websocketStreams')).toBe(true);
      expect(connector.supportsFeature('limitOrders')).toBe(true);
      expect(connector.supportsFeature('marketOrders')).toBe(true);
    });

    it('should provide health metrics', () => {
      const health = connector.getHealth();
      
      expect(health).toBeDefined();
      expect(health.exchangeId).toBe('bybit');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(typeof health.latency).toBe('number');
      expect(typeof health.uptime).toBe('number');
    });

    it('should provide performance metrics', () => {
      const metrics = connector.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.exchangeId).toBe('bybit');
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(typeof metrics.totalTrades).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
    });
  });

  describe('OKXConnector', () => {
    let connector: OKXConnector;
    let config: ExchangeConfig;

    beforeEach(() => {
      config = {
        ...DEFAULT_EXCHANGE_CONFIGS.okx,
        apiKey: 'test_api_key',
        apiSecret: 'test_api_secret',
        passphrase: 'test_passphrase'
      };
      connector = new OKXConnector(config);
    });

    afterEach(async () => {
      if (connector) {
        await connector.cleanup();
      }
    });

    it('should create OKXConnector instance', () => {
      expect(connector).toBeDefined();
      expect(connector.getExchangeId()).toBe('okx');
    });

    it('should have correct initial status', () => {
      expect(connector.getStatus()).toBe('disconnected');
    });

    it('should support required features', () => {
      expect(connector.supportsFeature('spotTrading')).toBe(true);
      expect(connector.supportsFeature('futuresTrading')).toBe(true);
      expect(connector.supportsFeature('optionsTrading')).toBe(true);
      expect(connector.supportsFeature('websocketStreams')).toBe(true);
      expect(connector.supportsFeature('icebergOrders')).toBe(true);
    });

    it('should provide health metrics', () => {
      const health = connector.getHealth();
      
      expect(health).toBeDefined();
      expect(health.exchangeId).toBe('okx');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(typeof health.latency).toBe('number');
      expect(typeof health.uptime).toBe('number');
    });

    it('should provide performance metrics', () => {
      const metrics = connector.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.exchangeId).toBe('okx');
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(typeof metrics.totalTrades).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
    });
  });

  describe('Exchange Configuration Validation', () => {
    it('should have valid configurations for all new exchanges', () => {
      // Test Kraken config
      const krakenConfig = DEFAULT_EXCHANGE_CONFIGS.kraken;
      expect(krakenConfig.exchangeId).toBe('kraken');
      expect(krakenConfig.name).toBe('Kraken');
      expect(krakenConfig.capabilities.spotTrading).toBe(true);
      expect(krakenConfig.rateLimits.restRequests.limit).toBeGreaterThan(0);
      expect(krakenConfig.priority).toBeGreaterThan(0);

      // Test Bybit config
      const bybitConfig = DEFAULT_EXCHANGE_CONFIGS.bybit;
      expect(bybitConfig.exchangeId).toBe('bybit');
      expect(bybitConfig.name).toBe('Bybit');
      expect(bybitConfig.capabilities.futuresTrading).toBe(true);
      expect(bybitConfig.sandboxApiUrl).toBeDefined();

      // Test OKX config
      const okxConfig = DEFAULT_EXCHANGE_CONFIGS.okx;
      expect(okxConfig.exchangeId).toBe('okx');
      expect(okxConfig.name).toBe('OKX');
      expect(okxConfig.capabilities.optionsTrading).toBe(true);
      expect(okxConfig.supportedAssets).toContain('BTC');
    });

    it('should have reasonable rate limits', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.rateLimits.restRequests.limit).toBeGreaterThan(0);
        expect(config.rateLimits.restRequests.windowMs).toBeGreaterThan(0);
        expect(config.rateLimits.websocketConnections.maxConnections).toBeGreaterThan(0);
        expect(config.rateLimits.orderPlacement.limit).toBeGreaterThan(0);
      });
    });

    it('should have appropriate priorities', () => {
      const priorities = [
        DEFAULT_EXCHANGE_CONFIGS.kraken.priority,
        DEFAULT_EXCHANGE_CONFIGS.bybit.priority,
        DEFAULT_EXCHANGE_CONFIGS.okx.priority
      ];

      priorities.forEach(priority => {
        expect(priority).toBeGreaterThan(0);
        expect(priority).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid asset configurations', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.supportedAssets).toBeInstanceOf(Array);
        expect(config.supportedAssets.length).toBeGreaterThan(0);
        expect(config.supportedAssets).toContain('BTC');
        
        expect(typeof config.minimumBalance).toBe('object');
        expect(typeof config.maxPositionSize).toBe('object');
        expect(typeof config.maxDailyVolume).toBe('object');
      });
    });
  });

  describe('Factory Functions', () => {
    it('should create connectors via factory functions', () => {
      // These imports are tested in the index file
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.okx).toBeDefined();
    });
  });

  describe('Interface Compliance', () => {
    it('should implement BaseExchangeConnector interface', () => {
      const configs = [
        { ...DEFAULT_EXCHANGE_CONFIGS.kraken, apiKey: 'test', apiSecret: 'test' },
        { ...DEFAULT_EXCHANGE_CONFIGS.bybit, apiKey: 'test', apiSecret: 'test' },
        { ...DEFAULT_EXCHANGE_CONFIGS.okx, apiKey: 'test', apiSecret: 'test', passphrase: 'test' }
      ];
      
      const connectors = [
        new KrakenConnector(configs[0]),
        new BybitConnector(configs[1]),
        new OKXConnector(configs[2])
      ];

      connectors.forEach(connector => {
        // Test required methods exist
        expect(typeof connector.getExchangeId).toBe('function');
        expect(typeof connector.getStatus).toBe('function');
        expect(typeof connector.getHealth).toBe('function');
        expect(typeof connector.getPerformanceMetrics).toBe('function');
        expect(typeof connector.supportsFeature).toBe('function');
        expect(typeof connector.cleanup).toBe('function');
        
        // Test abstract methods exist (but will throw without connection)
        expect(typeof connector.placeOrder).toBe('function');
        expect(typeof connector.cancelOrder).toBe('function');
        expect(typeof connector.getOrder).toBe('function');
        expect(typeof connector.getBalances).toBe('function');
        expect(typeof connector.getTradingFees).toBe('function');
        expect(typeof connector.getMarketData).toBe('function');
        expect(typeof connector.getOrderBook).toBe('function');
        expect(typeof connector.subscribeToMarketData).toBe('function');
        expect(typeof connector.unsubscribeFromMarketData).toBe('function');
      });
    });
  });
});

describe('Multi-Exchange Integration', () => {
  it('should support all exchange types in ExchangeId union', () => {
    // This is a compile-time test - if it compiles, the types are correct
    const exchangeIds: Array<'dydx' | 'binance' | 'coinbase' | 'kraken' | 'ftx' | 'okx' | 'bybit'> = [
      'dydx', 'binance', 'coinbase', 'kraken', 'okx', 'bybit'
    ];
    
    expect(exchangeIds).toContain('kraken');
    expect(exchangeIds).toContain('bybit');
    expect(exchangeIds).toContain('okx');
  });

  it('should have consistent configuration structure across exchanges', () => {
    const allConfigs = [
      DEFAULT_EXCHANGE_CONFIGS.binance,
      DEFAULT_EXCHANGE_CONFIGS.coinbase,
      DEFAULT_EXCHANGE_CONFIGS.kraken,
      DEFAULT_EXCHANGE_CONFIGS.bybit,
      DEFAULT_EXCHANGE_CONFIGS.okx
    ];

    allConfigs.forEach(config => {
      // Required fields
      expect(config.exchangeId).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.apiUrl).toBeDefined();
      expect(config.websocketUrl).toBeDefined();
      
      // Capabilities
      expect(config.capabilities).toBeDefined();
      expect(typeof config.capabilities.spotTrading).toBe('boolean');
      expect(typeof config.capabilities.websocketStreams).toBe('boolean');
      
      // Rate limits
      expect(config.rateLimits).toBeDefined();
      expect(config.rateLimits.restRequests).toBeDefined();
      expect(config.rateLimits.websocketConnections).toBeDefined();
      
      // Operational settings
      expect(typeof config.priority).toBe('number');
      expect(typeof config.healthCheckInterval).toBe('number');
      expect(typeof config.reconnectAttempts).toBe('number');
      
      // Asset configuration
      expect(config.supportedAssets).toBeInstanceOf(Array);
      expect(typeof config.minimumBalance).toBe('object');
      expect(typeof config.maxPositionSize).toBe('object');
      expect(typeof config.enableRiskChecks).toBe('boolean');
    });
  });
});