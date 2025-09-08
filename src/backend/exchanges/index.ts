/**
 * Multi-Exchange Framework - Main Export Module
 * 
 * Comprehensive multi-exchange trading system providing:
 * - Unified exchange abstraction layer
 * - Cross-exchange arbitrage detection and execution
 * - Smart order routing and execution
 * - Real-time market data aggregation
 * - Cross-exchange portfolio management
 * - Advanced risk management and compliance
 */

// Core framework components
export { MultiExchangeFramework } from './MultiExchangeFramework.js';
export { BaseExchangeConnector } from './BaseExchangeConnector.js';
export { ArbitrageEngine } from './ArbitrageEngine.js';
export { ExchangeRouter } from './ExchangeRouter.js';

// Exchange connectors
export { BinanceConnector } from './connectors/BinanceConnector.js';
export { CoinbaseConnector } from './connectors/CoinbaseConnector.js';

// Type definitions
export type * from './types.js';

// Configuration presets
export const DEFAULT_EXCHANGE_CONFIGS = {
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
  
  coinbase: {
    exchangeId: 'coinbase' as const,
    name: 'Coinbase Pro',
    enabled: true,
    apiUrl: 'https://api.exchange.coinbase.com',
    websocketUrl: 'wss://ws-feed.exchange.coinbase.com',
    sandboxApiUrl: 'https://api-public.sandbox.exchange.coinbase.com',
    sandboxWebsocketUrl: 'wss://ws-feed-public.sandbox.exchange.coinbase.com',
    capabilities: {
      spotTrading: true,
      marginTrading: false,
      futuresTrading: false,
      optionsTrading: false,
      marketOrders: true,
      limitOrders: true,
      stopOrders: true,
      stopLimitOrders: false,
      icebergOrders: false,
      postOnlyOrders: true,
      websocketStreams: true,
      restAPI: true,
      sandboxMode: true,
      testnetSupport: true,
      realtimeOrderBook: true,
      realtimeTrades: true,
      realtimeCandles: false,
      realtimeTickers: true,
      maxOrderSize: 1000000,
      minOrderSize: 0.01,
      maxOrdersPerSecond: 10,
      maxConcurrentOrders: 100
    },
    rateLimits: {
      restRequests: {
        limit: 10,
        windowMs: 1000
      },
      websocketConnections: {
        maxConnections: 3,
        maxSubscriptions: 100,
        reconnectDelayMs: 2000
      },
      orderPlacement: {
        limit: 10,
        windowMs: 1000
      },
      marketData: {
        limit: 3,
        windowMs: 1000
      }
    },
    priority: 85,
    healthCheckInterval: 30000,
    reconnectAttempts: 3,
    reconnectDelayMs: 2000,
    defaultTradingPair: 'BTC-USD',
    supportedAssets: ['BTC', 'ETH', 'LTC', 'USD', 'USDC'],
    minimumBalance: {
      BTC: 0.001,
      ETH: 0.01,
      LTC: 0.1,
      USD: 10,
      USDC: 10
    },
    maxPositionSize: {
      BTC: 50,
      ETH: 500,
      LTC: 5000,
      USD: 500000,
      USDC: 500000
    },
    maxDailyVolume: {
      BTC: 500,
      ETH: 5000,
      LTC: 50000,
      USD: 5000000,
      USDC: 5000000
    },
    enableRiskChecks: true
  }
};

// Utility functions for framework setup
export function createMultiExchangeFramework(config?: any) {
  return new MultiExchangeFramework(config);
}

export function createBinanceConnector(config: any) {
  return new BinanceConnector({
    ...DEFAULT_EXCHANGE_CONFIGS.binance,
    ...config
  });
}

export function createCoinbaseConnector(config: any) {
  return new CoinbaseConnector({
    ...DEFAULT_EXCHANGE_CONFIGS.coinbase,
    ...config
  });
}

export function createArbitrageEngine(framework: MultiExchangeFramework, config?: any) {
  return new ArbitrageEngine(framework, config);
}

export function createExchangeRouter(framework: MultiExchangeFramework, config?: any) {
  return new ExchangeRouter(framework, config);
}

// Pre-configured setups
export async function setupBasicMultiExchange(exchangeConfigs: {
  binance?: any;
  coinbase?: any;
}) {
  const framework = createMultiExchangeFramework();
  await framework.initialize();
  
  if (exchangeConfigs.binance) {
    const binanceConnector = createBinanceConnector(exchangeConfigs.binance);
    await framework.registerExchange('binance', binanceConnector, {
      ...DEFAULT_EXCHANGE_CONFIGS.binance,
      ...exchangeConfigs.binance
    });
  }
  
  if (exchangeConfigs.coinbase) {
    const coinbaseConnector = createCoinbaseConnector(exchangeConfigs.coinbase);
    await framework.registerExchange('coinbase', coinbaseConnector, {
      ...DEFAULT_EXCHANGE_CONFIGS.coinbase,
      ...exchangeConfigs.coinbase
    });
  }
  
  return framework;
}

export async function setupArbitrageSystem(exchangeConfigs: any, arbitrageConfig?: any) {
  const framework = await setupBasicMultiExchange(exchangeConfigs);
  const arbitrageEngine = createArbitrageEngine(framework, arbitrageConfig);
  const router = createExchangeRouter(framework);
  
  await arbitrageEngine.start();
  
  return {
    framework,
    arbitrageEngine,
    router
  };
}

// Version and metadata
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

export default {
  MultiExchangeFramework,
  ArbitrageEngine,
  ExchangeRouter,
  BinanceConnector,
  CoinbaseConnector,
  DEFAULT_EXCHANGE_CONFIGS,
  setupBasicMultiExchange,
  setupArbitrageSystem,
  VERSION,
  BUILD_DATE
};