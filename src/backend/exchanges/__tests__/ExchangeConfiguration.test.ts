/**
 * Exchange Configuration Tests
 * 
 * Tests configuration validation and basic setup for all exchange connectors
 * without requiring actual CCXT initialization or API calls.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_EXCHANGE_CONFIGS } from '../index.js';

describe('Exchange Configurations', () => {
  describe('Default Exchange Configurations', () => {
    it('should have configurations for all supported exchanges', () => {
      expect(DEFAULT_EXCHANGE_CONFIGS.binance).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.coinbase).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit).toBeDefined();
      expect(DEFAULT_EXCHANGE_CONFIGS.okx).toBeDefined();
    });

    it('should have correct exchange IDs', () => {
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.exchangeId).toBe('binance');
      expect(DEFAULT_EXCHANGE_CONFIGS.coinbase.exchangeId).toBe('coinbase');
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.exchangeId).toBe('kraken');
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.exchangeId).toBe('bybit');
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.exchangeId).toBe('okx');
    });

    it('should have proper API URLs for all exchanges', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.apiUrl).toBeDefined();
        expect(config.apiUrl).toMatch(/^https?:\/\//);
        expect(config.websocketUrl).toBeDefined();
        expect(config.websocketUrl).toMatch(/^wss?:\/\//);
      });
    });

    it('should have valid rate limits', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.rateLimits.restRequests.limit).toBeGreaterThan(0);
        expect(config.rateLimits.restRequests.windowMs).toBeGreaterThan(0);
        expect(config.rateLimits.websocketConnections.maxConnections).toBeGreaterThan(0);
        expect(config.rateLimits.orderPlacement.limit).toBeGreaterThan(0);
        expect(config.rateLimits.marketData.limit).toBeGreaterThan(0);
      });
    });
  });

  describe('New Exchange Configurations', () => {
    describe('Kraken Configuration', () => {
      const config = DEFAULT_EXCHANGE_CONFIGS.kraken;

      it('should have proper Kraken-specific settings', () => {
        expect(config.name).toBe('Kraken');
        expect(config.apiUrl).toBe('https://api.kraken.com');
        expect(config.websocketUrl).toBe('wss://ws.kraken.com');
        expect(config.defaultTradingPair).toBe('BTC/USD');
      });

      it('should support required trading features', () => {
        expect(config.capabilities.spotTrading).toBe(true);
        expect(config.capabilities.marginTrading).toBe(true);
        expect(config.capabilities.futuresTrading).toBe(true);
        expect(config.capabilities.marketOrders).toBe(true);
        expect(config.capabilities.limitOrders).toBe(true);
        expect(config.capabilities.stopOrders).toBe(true);
        expect(config.capabilities.websocketStreams).toBe(true);
      });

      it('should have conservative rate limits', () => {
        // Kraken has stricter rate limits
        expect(config.rateLimits.restRequests.limit).toBe(15);
        expect(config.rateLimits.websocketConnections.maxConnections).toBe(2);
        expect(config.rateLimits.orderPlacement.limit).toBe(60);
        expect(config.rateLimits.marketData.limit).toBe(1);
      });

      it('should have appropriate asset configuration', () => {
        expect(config.supportedAssets).toContain('BTC');
        expect(config.supportedAssets).toContain('ETH');
        expect(config.supportedAssets).toContain('USD');
        expect(config.minimumBalance.BTC).toBe(0.0005);
        expect(config.maxPositionSize.BTC).toBe(100);
      });
    });

    describe('Bybit Configuration', () => {
      const config = DEFAULT_EXCHANGE_CONFIGS.bybit;

      it('should have proper Bybit-specific settings', () => {
        expect(config.name).toBe('Bybit');
        expect(config.apiUrl).toBe('https://api.bybit.com');
        expect(config.websocketUrl).toBe('wss://stream.bybit.com');
        expect(config.sandboxApiUrl).toBe('https://api-testnet.bybit.com');
        expect(config.defaultTradingPair).toBe('BTCUSDT');
      });

      it('should support derivatives trading', () => {
        expect(config.capabilities.spotTrading).toBe(true);
        expect(config.capabilities.futuresTrading).toBe(true);
        expect(config.capabilities.optionsTrading).toBe(true);
        expect(config.capabilities.marginTrading).toBe(true);
        expect(config.capabilities.sandboxMode).toBe(true);
        expect(config.capabilities.testnetSupport).toBe(true);
      });

      it('should have higher throughput limits', () => {
        expect(config.rateLimits.restRequests.limit).toBe(600);
        expect(config.rateLimits.websocketConnections.maxConnections).toBe(10);
        expect(config.rateLimits.orderPlacement.limit).toBe(100);
        expect(config.capabilities.maxOrdersPerSecond).toBe(50);
      });

      it('should support modern assets', () => {
        expect(config.supportedAssets).toContain('BTC');
        expect(config.supportedAssets).toContain('ETH');
        expect(config.supportedAssets).toContain('SOL');
        expect(config.supportedAssets).toContain('USDT');
        expect(config.supportedAssets).toContain('USDC');
      });
    });

    describe('OKX Configuration', () => {
      const config = DEFAULT_EXCHANGE_CONFIGS.okx;

      it('should have proper OKX-specific settings', () => {
        expect(config.name).toBe('OKX');
        expect(config.apiUrl).toBe('https://www.okx.com');
        expect(config.websocketUrl).toBe('wss://ws.okx.com:8443');
        expect(config.defaultTradingPair).toBe('BTC-USDT');
      });

      it('should support comprehensive trading features', () => {
        expect(config.capabilities.spotTrading).toBe(true);
        expect(config.capabilities.futuresTrading).toBe(true);
        expect(config.capabilities.optionsTrading).toBe(true);
        expect(config.capabilities.marginTrading).toBe(true);
        expect(config.capabilities.icebergOrders).toBe(true);
        expect(config.capabilities.postOnlyOrders).toBe(true);
      });

      it('should have high performance limits', () => {
        expect(config.rateLimits.restRequests.limit).toBe(1200);
        expect(config.rateLimits.websocketConnections.maxConnections).toBe(5);
        expect(config.rateLimits.orderPlacement.limit).toBe(300);
        expect(config.capabilities.maxOrderSize).toBe(10000000);
      });

      it('should have high priority', () => {
        expect(config.priority).toBe(88);
        expect(config.priority).toBeGreaterThan(DEFAULT_EXCHANGE_CONFIGS.kraken.priority);
      });
    });
  });

  describe('Exchange Priority Ranking', () => {
    it('should have consistent priority ordering', () => {
      const priorities = [
        { name: 'Binance', priority: DEFAULT_EXCHANGE_CONFIGS.binance.priority },
        { name: 'Coinbase', priority: DEFAULT_EXCHANGE_CONFIGS.coinbase.priority },
        { name: 'Kraken', priority: DEFAULT_EXCHANGE_CONFIGS.kraken.priority },
        { name: 'Bybit', priority: DEFAULT_EXCHANGE_CONFIGS.bybit.priority },
        { name: 'OKX', priority: DEFAULT_EXCHANGE_CONFIGS.okx.priority }
      ];

      // Check that all priorities are within valid range
      priorities.forEach(({ name, priority }) => {
        expect(priority).toBeGreaterThan(0);
        expect(priority).toBeLessThanOrEqual(100);
      });

      // Binance should have highest priority
      expect(DEFAULT_EXCHANGE_CONFIGS.binance.priority).toBe(90);
      
      // OKX should have second highest priority
      expect(DEFAULT_EXCHANGE_CONFIGS.okx.priority).toBe(88);
      
      // Bybit should have good priority
      expect(DEFAULT_EXCHANGE_CONFIGS.bybit.priority).toBe(85);
      
      // Coinbase should have moderate priority
      expect(DEFAULT_EXCHANGE_CONFIGS.coinbase.priority).toBe(85);
      
      // Kraken should have lower priority due to rate limits
      expect(DEFAULT_EXCHANGE_CONFIGS.kraken.priority).toBe(80);
    });
  });

  describe('Asset Configuration Consistency', () => {
    it('should have BTC configuration across all exchanges', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.supportedAssets).toContain('BTC');
        expect(config.minimumBalance.BTC).toBeGreaterThan(0);
        expect(config.maxPositionSize.BTC).toBeGreaterThan(0);
        expect(config.maxDailyVolume.BTC).toBeGreaterThan(0);
      });
    });

    it('should have ETH configuration across all exchanges', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.supportedAssets).toContain('ETH');
        expect(config.minimumBalance.ETH).toBeGreaterThan(0);
        expect(config.maxPositionSize.ETH).toBeGreaterThan(0);
      });
    });

    it('should have stablecoin support', () => {
      // USD/USDT/USDC should be supported across exchanges
      const usdAssets = ['USD', 'USDT', 'USDC'];
      
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        const hasUsdAsset = usdAssets.some(asset => config.supportedAssets.includes(asset));
        expect(hasUsdAsset).toBe(true);
      });
    });
  });

  describe('Risk Management Configuration', () => {
    it('should have risk checks enabled for all exchanges', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.enableRiskChecks).toBe(true);
      });
    });

    it('should have reasonable position size limits', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        // BTC position sizes should be reasonable (1-10000 BTC)
        expect(config.maxPositionSize.BTC).toBeGreaterThanOrEqual(50);
        expect(config.maxPositionSize.BTC).toBeLessThanOrEqual(10000);
        
        // Daily volumes should be larger than position sizes
        expect(config.maxDailyVolume.BTC).toBeGreaterThan(config.maxPositionSize.BTC);
      });
    });

    it('should have appropriate reconnection settings', () => {
      const configs = [
        DEFAULT_EXCHANGE_CONFIGS.binance,
        DEFAULT_EXCHANGE_CONFIGS.coinbase,
        DEFAULT_EXCHANGE_CONFIGS.kraken,
        DEFAULT_EXCHANGE_CONFIGS.bybit,
        DEFAULT_EXCHANGE_CONFIGS.okx
      ];

      configs.forEach(config => {
        expect(config.reconnectAttempts).toBeGreaterThanOrEqual(3);
        expect(config.reconnectAttempts).toBeLessThanOrEqual(5);
        expect(config.reconnectDelayMs).toBeGreaterThanOrEqual(1000);
        expect(config.healthCheckInterval).toBe(30000); // 30 seconds
      });
    });
  });
});