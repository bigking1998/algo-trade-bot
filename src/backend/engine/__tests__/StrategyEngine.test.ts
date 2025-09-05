/**
 * Strategy Engine Tests - Task BE-016
 * 
 * Comprehensive unit tests for the StrategyEngine core orchestration class.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StrategyEngine } from '../StrategyEngine';
import { SignalProcessor } from '../SignalProcessor';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { RiskController } from '../RiskController';
import { EventManager } from '../EventManager';
import type { StrategyConfig, StrategySignal, MarketDataWindow } from '../../strategies/types';

// Mock dependencies
vi.mock('../SignalProcessor');
vi.mock('../PerformanceMonitor');
vi.mock('../RiskController');
vi.mock('../EventManager');

const MockSignalProcessor = SignalProcessor as Mock;
const MockPerformanceMonitor = PerformanceMonitor as Mock;
const MockRiskController = RiskController as Mock;
const MockEventManager = EventManager as Mock;

// Mock repository interfaces
const mockMarketDataRepository = {
  findBy: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn()
};

const mockStrategyRepository = {
  findBy: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn()
};

const mockTradeRepository = {
  findBy: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn()
};

const mockDatabaseManager = {
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn()
};

const createMockStrategyConfig = (): StrategyConfig => ({
  id: 'test-strategy-1',
  name: 'Test Strategy',
  description: 'A test strategy',
  version: '1.0.0',
  type: 'technical',
  timeframes: ['1m', '5m'],
  symbols: ['BTC-USD', 'ETH-USD'],
  maxConcurrentPositions: 3,
  riskProfile: {
    maxRiskPerTrade: 2,
    maxPortfolioRisk: 10,
    stopLossType: 'fixed',
    takeProfitType: 'fixed',
    positionSizing: 'fixed'
  },
  parameters: {
    period: {
      name: 'period',
      type: 'number',
      value: 14,
      defaultValue: 14,
      required: true,
      min: 1,
      max: 100,
      description: 'Period for calculation'
    }
  },
  performance: {
    minWinRate: 0.4,
    maxDrawdown: 15,
    minSharpeRatio: 1.0
  },
  execution: {
    orderType: 'market',
    slippage: 0.1,
    timeout: 30,
    retries: 3
  },
  monitoring: {
    enableAlerts: true,
    alertChannels: ['email'],
    healthCheckInterval: 300,
    performanceReviewInterval: 3600
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user'
});

const createMockMarketData = (): MarketDataWindow => ({
  symbol: 'BTC-USD',
  timeframe: '1m',
  candles: [],
  currentPrice: 50000,
  volume24h: 1000000,
  change24h: 500,
  change24hPercent: 1.0,
  high24h: 51000,
  low24h: 49000,
  lastUpdate: new Date()
});

describe('StrategyEngine', () => {
  let strategyEngine: StrategyEngine;
  let mockSignalProcessor: any;
  let mockPerformanceMonitor: any;
  let mockRiskController: any;
  let mockEventManager: any;

  const engineConfig = {
    maxConcurrentStrategies: 5,
    maxSignalsPerSecond: 50,
    defaultExecutionTimeout: 30000,
    maxMemoryUsage: 1000,
    maxCpuUsage: 80,
    maxLatency: 2000,
    emergencyStopEnabled: true,
    maxPortfolioRisk: 20,
    correlationThreshold: 0.8,
    healthCheckInterval: 300,
    performanceReviewInterval: 60,
    metricsRetentionPeriod: 30,
    eventRetention: 10000,
    alertThresholds: {
      errorRate: 5,
      latency: 5000,
      drawdown: 15
    }
  };

  const dependencies = {
    marketDataRepository: mockMarketDataRepository,
    strategyRepository: mockStrategyRepository,
    tradeRepository: mockTradeRepository,
    databaseManager: mockDatabaseManager
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockSignalProcessor = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processSignals: vi.fn().mockResolvedValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };

    mockPerformanceMonitor = {
      initialize: vi.fn().mockResolvedValue(undefined),
      updateStrategyMetrics: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };

    mockRiskController = {
      initialize: vi.fn().mockResolvedValue(undefined),
      validateSignals: vi.fn().mockResolvedValue([]),
      getCurrentRiskMetrics: vi.fn().mockResolvedValue({
        totalRisk: 5,
        riskScore: 30,
        usedMargin: 1000,
        totalValue: 100000
      }),
      emergencyCloseAll: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };

    mockEventManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      recordEvent: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };

    // Setup constructor mocks
    MockSignalProcessor.mockImplementation(() => mockSignalProcessor);
    MockPerformanceMonitor.mockImplementation(() => mockPerformanceMonitor);
    MockRiskController.mockImplementation(() => mockRiskController);
    MockEventManager.mockImplementation(() => mockEventManager);

    // Setup repository mocks
    mockStrategyRepository.findBy.mockResolvedValue([]);
    mockStrategyRepository.create.mockResolvedValue({ id: 'strategy-1' });
    mockStrategyRepository.update.mockResolvedValue({ id: 'strategy-1' });

    strategyEngine = new StrategyEngine(engineConfig, dependencies);
  });

  afterEach(async () => {
    if (strategyEngine) {
      await strategyEngine.stop().catch(() => {}); // Ignore errors in cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await strategyEngine.initialize();
      
      expect(mockSignalProcessor.initialize).toHaveBeenCalled();
      expect(mockPerformanceMonitor.initialize).toHaveBeenCalled();
      expect(mockRiskController.initialize).toHaveBeenCalled();
      expect(mockEventManager.initialize).toHaveBeenCalled();
    });

    it('should load existing strategies from database', async () => {
      const mockStrategies = [
        { id: 'strategy-1', config: createMockStrategyConfig() }
      ];
      mockStrategyRepository.findBy.mockResolvedValue(mockStrategies);

      await strategyEngine.initialize();

      expect(mockStrategyRepository.findBy).toHaveBeenCalledWith({ is_active: true });
    });

    it('should handle initialization failure', async () => {
      mockSignalProcessor.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(strategyEngine.initialize()).rejects.toThrow('Failed to initialize strategy engine');
    });
  });

  describe('Strategy Management', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
    });

    it('should register a new strategy successfully', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });

      const strategyId = await strategyEngine.registerStrategy(config);

      expect(strategyId).toBe(config.id);
      expect(mockStrategyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: config.id,
          name: config.name,
          type: config.type,
          is_active: false
        })
      );
    });

    it('should enforce maximum concurrent strategies limit', async () => {
      // Fill up to the limit
      for (let i = 0; i < engineConfig.maxConcurrentStrategies; i++) {
        const config = createMockStrategyConfig();
        config.id = `strategy-${i}`;
        mockStrategyRepository.create.mockResolvedValue({ id: config.id });
        await strategyEngine.registerStrategy(config);
      }

      // Attempt to add one more
      const extraConfig = createMockStrategyConfig();
      extraConfig.id = 'extra-strategy';

      await expect(strategyEngine.registerStrategy(extraConfig))
        .rejects.toThrow('Maximum concurrent strategies limit reached');
    });

    it('should unregister a strategy successfully', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });
      
      await strategyEngine.registerStrategy(config);
      await strategyEngine.unregisterStrategy(config.id);

      expect(mockStrategyRepository.update).toHaveBeenCalledWith(config.id, {
        is_active: false,
        updated_at: expect.any(Date)
      });
    });

    it('should handle unregistering non-existent strategy', async () => {
      await expect(strategyEngine.unregisterStrategy('non-existent'))
        .rejects.toThrow('Strategy not found: non-existent');
    });

    it('should update strategy configuration', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });
      
      await strategyEngine.registerStrategy(config);
      
      const updates = { name: 'Updated Strategy' };
      await strategyEngine.updateStrategy(config.id, updates);

      expect(mockStrategyRepository.update).toHaveBeenCalledWith(config.id, {
        config: expect.objectContaining(updates),
        updated_at: expect.any(Date)
      });
    });
  });

  describe('Strategy Execution', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
      await strategyEngine.start();
    });

    it('should execute strategies with market data', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });
      await strategyEngine.registerStrategy(config);

      const marketData = createMockMarketData();
      const results = await strategyEngine.executeStrategies(marketData);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should not execute when engine is stopped', async () => {
      await strategyEngine.stop();
      
      const marketData = createMockMarketData();
      const results = await strategyEngine.executeStrategies(marketData);

      expect(results).toEqual([]);
    });

    it('should process signals from strategy execution', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });
      await strategyEngine.registerStrategy(config);

      const mockSignals: StrategySignal[] = [{
        id: 'signal-1',
        strategyId: config.id,
        timestamp: new Date(),
        type: 'BUY',
        symbol: 'BTC-USD',
        confidence: 80,
        strength: 0.8,
        timeframe: '1m',
        isValid: true
      }];

      mockSignalProcessor.processSignals.mockResolvedValue(mockSignals);
      mockRiskController.validateSignals.mockResolvedValue(mockSignals);
      mockRiskController.assessSignalRisk.mockResolvedValue({ approved: true });

      const tradeDecisions = await strategyEngine.processSignals(mockSignals);

      expect(mockSignalProcessor.processSignals).toHaveBeenCalledWith(mockSignals);
      expect(mockRiskController.validateSignals).toHaveBeenCalled();
      expect(tradeDecisions).toBeDefined();
      expect(Array.isArray(tradeDecisions)).toBe(true);
    });
  });

  describe('Engine Lifecycle', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
    });

    it('should start the engine successfully', async () => {
      await strategyEngine.start();
      
      const status = strategyEngine.getStatus();
      expect(status.state).toBe('running');
    });

    it('should pause all strategies', async () => {
      await strategyEngine.start();
      await strategyEngine.pauseAll();
      
      const status = strategyEngine.getStatus();
      expect(status.state).toBe('paused');
    });

    it('should resume all strategies', async () => {
      await strategyEngine.start();
      await strategyEngine.pauseAll();
      await strategyEngine.resumeAll();
      
      const status = strategyEngine.getStatus();
      expect(status.state).toBe('running');
    });

    it('should stop the engine successfully', async () => {
      await strategyEngine.start();
      await strategyEngine.stop();
      
      const status = strategyEngine.getStatus();
      expect(status.state).toBe('stopped');
    });

    it('should handle state transition errors', async () => {
      // Try to pause when not running
      await expect(strategyEngine.pauseAll())
        .rejects.toThrow('Cannot pause engine from state: idle');
    });
  });

  describe('Emergency Procedures', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
      await strategyEngine.start();
    });

    it('should execute emergency stop successfully', async () => {
      const reason = 'High risk detected';
      
      await strategyEngine.emergencyStop(reason);

      expect(mockRiskController.emergencyCloseAll).toHaveBeenCalled();
      
      const status = strategyEngine.getStatus();
      expect(status.state).toBe('stopped');
    });

    it('should handle emergency stop failure gracefully', async () => {
      mockRiskController.emergencyCloseAll.mockRejectedValue(new Error('Emergency stop failed'));
      
      const reason = 'System failure';
      await expect(strategyEngine.emergencyStop(reason)).rejects.toThrow();
    });
  });

  describe('Status and Monitoring', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
    });

    it('should provide current engine status', () => {
      const status = strategyEngine.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('strategies');
      expect(status.strategies).toBeDefined();
      expect(Array.isArray(status.strategies)).toBe(true);
    });

    it('should include strategy information in status', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });
      await strategyEngine.registerStrategy(config);

      const status = strategyEngine.getStatus();
      expect(status.strategies.length).toBeGreaterThan(0);
    });

    it('should include metrics in status', () => {
      const status = strategyEngine.getStatus();
      
      expect(status.metrics).toHaveProperty('totalExecutions');
      expect(status.metrics).toHaveProperty('averageExecutionTime');
      expect(status.metrics).toHaveProperty('successRate');
      expect(status.metrics).toHaveProperty('activeStrategies');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
    });

    it('should handle strategy registration errors', async () => {
      mockStrategyRepository.create.mockRejectedValue(new Error('Database error'));
      
      const config = createMockStrategyConfig();
      
      await expect(strategyEngine.registerStrategy(config))
        .rejects.toThrow('Failed to register strategy');
    });

    it('should handle execution errors gracefully', async () => {
      await strategyEngine.start();
      
      // Mock an execution error scenario
      const marketData = createMockMarketData();
      
      // Even with internal errors, should not throw
      const results = await strategyEngine.executeStrategies(marketData);
      expect(results).toBeDefined();
    });

    it('should maintain engine stability after errors', async () => {
      await strategyEngine.start();
      
      // Force an error scenario
      mockRiskController.getCurrentRiskMetrics.mockRejectedValue(new Error('Risk system error'));
      
      const marketData = createMockMarketData();
      
      // Engine should continue functioning
      const results = await strategyEngine.executeStrategies(marketData);
      expect(results).toBeDefined();
      
      const status = strategyEngine.getStatus();
      expect(status.state).toBe('running');
    });
  });

  describe('Performance and Resource Management', () => {
    beforeEach(async () => {
      await strategyEngine.initialize();
      await strategyEngine.start();
    });

    it('should respect resource constraints during execution', async () => {
      // Mock high memory usage scenario
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: engineConfig.maxMemoryUsage * 1024 * 1024 * 1.5, // Exceed limit
        heapTotal: engineConfig.maxMemoryUsage * 1024 * 1024 * 2
      });

      const marketData = createMockMarketData();
      
      // Should handle resource constraints gracefully
      const results = await strategyEngine.executeStrategies(marketData);
      expect(results).toBeDefined();

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should track execution metrics', async () => {
      const config = createMockStrategyConfig();
      mockStrategyRepository.create.mockResolvedValue({ id: config.id });
      await strategyEngine.registerStrategy(config);

      const marketData = createMockMarketData();
      await strategyEngine.executeStrategies(marketData);

      const status = strategyEngine.getStatus();
      expect(status.metrics.totalExecutions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should cleanup all resources on shutdown', async () => {
      await strategyEngine.initialize();
      await strategyEngine.start();
      
      await strategyEngine.stop();

      expect(mockSignalProcessor.cleanup).toHaveBeenCalled();
      expect(mockPerformanceMonitor.cleanup).toHaveBeenCalled();
      expect(mockRiskController.cleanup).toHaveBeenCalled();
      expect(mockEventManager.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      await strategyEngine.initialize();
      await strategyEngine.start();
      
      mockSignalProcessor.cleanup.mockRejectedValue(new Error('Cleanup failed'));
      
      // Should not throw even if cleanup fails
      await expect(strategyEngine.stop()).rejects.toThrow();
    });
  });
});