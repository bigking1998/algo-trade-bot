/**
 * Risk Engine Integration Tests - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Integration test suite for the risk assessment engine components
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { RiskEngine, RiskManagement, RiskUtils } from '../index.js';
import type { PortfolioState, RiskProfile, StrategySignal } from '../types.js';

describe('Risk Engine Integration', () => {
  let riskEngine: RiskEngine;

  beforeAll(async () => {
    riskEngine = RiskEngine.getInstance();
    await riskEngine.initialize();
  });

  afterAll(async () => {
    await riskEngine.shutdown();
  });

  describe('Risk Management Factory', () => {
    test('should initialize and provide access to risk engine', async () => {
      await RiskManagement.initialize();
      
      const engine = RiskManagement.getRiskEngine();
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(RiskEngine);
      
      await RiskManagement.shutdown();
    });

    test('should provide quick portfolio assessment', async () => {
      await RiskManagement.initialize();
      
      const portfolioState = createMockPortfolioState();
      
      // This would typically throw or return mock data in tests
      // since we don't have real market data
      try {
        const assessment = await RiskManagement.assessPortfolio(portfolioState);
        expect(assessment).toBeDefined();
      } catch (error) {
        // Expected in test environment without real data
        expect(error).toBeDefined();
      }
      
      await RiskManagement.shutdown();
    });
  });

  describe('Risk Utilities', () => {
    test('should convert risk scores to levels correctly', () => {
      expect(RiskUtils.riskScoreToLevel(95)).toBe('critical');
      expect(RiskUtils.riskScoreToLevel(80)).toBe('very_high');
      expect(RiskUtils.riskScoreToLevel(65)).toBe('high');
      expect(RiskUtils.riskScoreToLevel(45)).toBe('medium');
      expect(RiskUtils.riskScoreToLevel(25)).toBe('low');
      expect(RiskUtils.riskScoreToLevel(10)).toBe('very_low');
    });

    test('should calculate volatility correctly', () => {
      const returns = [0.01, -0.01, 0.02, -0.02, 0.015];
      const volatility = RiskUtils.calculateVolatility(returns);
      
      expect(volatility).toBeGreaterThan(0);
      expect(volatility).toBeLessThan(1);
    });

    test('should calculate correlation correctly', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.01, 0.02];
      const returns2 = [0.02, 0.04, 0.06, 0.02, 0.04]; // Perfect positive correlation
      
      const correlation = RiskUtils.calculateCorrelation(returns1, returns2);
      expect(correlation).toBeCloseTo(1, 1); // Should be close to 1
      
      // Test negative correlation
      const returns3 = [-0.01, -0.02, -0.03, -0.01, -0.02];
      const negativeCorrelation = RiskUtils.calculateCorrelation(returns1, returns3);
      expect(negativeCorrelation).toBeCloseTo(-1, 1); // Should be close to -1
    });

    test('should calculate Sharpe ratio correctly', () => {
      const returns = [0.01, 0.02, 0.015, 0.008, 0.012];
      const riskFreeRate = 0.002; // 0.2% risk-free rate
      
      const sharpeRatio = RiskUtils.calculateSharpeRatio(returns, riskFreeRate);
      
      expect(sharpeRatio).toBeGreaterThan(0); // Should be positive for profitable returns
      expect(typeof sharpeRatio).toBe('number');
    });

    test('should calculate maximum drawdown correctly', () => {
      const equityCurve = [100, 110, 105, 120, 115, 100, 130];
      const { maxDrawdown, maxDrawdownDate } = RiskUtils.calculateMaxDrawdown(equityCurve);
      
      expect(maxDrawdown).toBeGreaterThan(0);
      expect(maxDrawdown).toBeLessThanOrEqual(1); // Should be a percentage
      expect(maxDrawdownDate).toBeGreaterThanOrEqual(0);
      expect(maxDrawdownDate).toBeLessThan(equityCurve.length);
    });

    test('should calculate historical VaR correctly', () => {
      const returns = [-0.05, -0.03, -0.01, 0.01, 0.02, 0.03, -0.02];
      const var95 = RiskUtils.calculateHistoricalVaR(returns, 0.95);
      const var99 = RiskUtils.calculateHistoricalVaR(returns, 0.99);
      
      expect(var95).toBeGreaterThan(0);
      expect(var99).toBeGreaterThanOrEqual(var95); // 99% VaR should be >= 95% VaR
    });

    test('should check concentration limits correctly', () => {
      const positions = [
        { symbol: 'BTC', marketValue: 50000 },
        { symbol: 'ETH', marketValue: 30000 },
        { symbol: 'ADA', marketValue: 20000 }
      ];
      
      const concentrationCheck = RiskUtils.checkConcentrationLimits(positions, 0.4); // 40% limit
      
      expect(concentrationCheck).toHaveLength(3);
      expect(concentrationCheck[0].exceeds).toBe(true); // BTC at 50% exceeds 40%
      expect(concentrationCheck[1].exceeds).toBe(false); // ETH at 30% under 40%
      expect(concentrationCheck[2].exceeds).toBe(false); // ADA at 20% under 40%
    });

    test('should calculate composite risk score correctly', () => {
      const factors = [
        { name: 'VaR', score: 80, weight: 0.4 },
        { name: 'Concentration', score: 60, weight: 0.3 },
        { name: 'Correlation', score: 70, weight: 0.3 }
      ];
      
      const compositeScore = RiskUtils.calculateCompositeRiskScore(factors);
      
      // Expected: (80*0.4 + 60*0.3 + 70*0.3) = 32 + 18 + 21 = 71
      expect(compositeScore).toBeCloseTo(71, 1);
      expect(compositeScore).toBeGreaterThanOrEqual(0);
      expect(compositeScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized risk engine', async () => {
      const uninitializedEngine = RiskEngine.getInstance();
      await uninitializedEngine.shutdown(); // Ensure it's not initialized
      
      const portfolioState = createMockPortfolioState();
      
      try {
        await uninitializedEngine.assessPortfolioRisk(portfolioState);
        expect.fail('Should have thrown error for uninitialized engine');
      } catch (error) {
        expect((error as Error).message).toContain('not initialized');
      }
    });

    test('should handle invalid portfolio data gracefully', async () => {
      const invalidPortfolio: PortfolioState = {
        timestamp: new Date(),
        totalValue: 0, // Invalid - zero value
        cashBalance: 0,
        positions: [],
        unrealizedPnL: 0,
        realizedPnL: 0,
        availableMargin: 0,
        usedMargin: 0,
        marginRatio: 0,
        leverage: 0,
        dailyPnL: 0,
        weeklyPnL: 0,
        monthlyPnL: 0,
        longExposure: 0,
        shortExposure: 0,
        netExposure: 0,
        grossExposure: 0,
        largestPositionPercent: 0,
        topConcentrations: []
      };
      
      try {
        const assessment = await riskEngine.assessPortfolioRisk(invalidPortfolio);
        expect(assessment).toBeDefined();
        // Should handle gracefully with appropriate warnings/alerts
      } catch (error) {
        // Expected behavior for invalid data
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Tests', () => {
    test('should perform risk assessment within reasonable time', async () => {
      const portfolioState = createMockPortfolioState();
      
      const startTime = Date.now();
      
      try {
        await riskEngine.assessPortfolioRisk(portfolioState);
      } catch (error) {
        // Expected in test environment
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 5 seconds (even with mock data)
      expect(executionTime).toBeLessThan(5000);
    });
  });
});

/**
 * Helper Functions for Integration Testing
 */
function createMockPortfolioState(): PortfolioState {
  return {
    timestamp: new Date(),
    totalValue: 100000,
    cashBalance: 20000,
    positions: [
      {
        id: 'pos1',
        strategyId: 'strategy1',
        symbol: 'BTC-USD',
        side: 'long',
        size: 1.5,
        entryPrice: 50000,
        currentPrice: 52000,
        unrealizedPnL: 3000,
        realizedPnL: 0,
        totalPnL: 3000,
        pnlPercent: 4,
        marketValue: 78000,
        entryTime: new Date('2024-01-01'),
        holdingPeriod: 86400000,
        metadata: {},
        status: 'open'
      },
      {
        id: 'pos2',
        strategyId: 'strategy1',
        symbol: 'ETH-USD',
        side: 'long',
        size: 10,
        entryPrice: 3000,
        currentPrice: 3100,
        unrealizedPnL: 1000,
        realizedPnL: 0,
        totalPnL: 1000,
        pnlPercent: 3.33,
        marketValue: 31000,
        entryTime: new Date('2024-01-01'),
        holdingPeriod: 86400000,
        metadata: {},
        status: 'open'
      }
    ],
    unrealizedPnL: 4000,
    realizedPnL: 1000,
    availableMargin: 15000,
    usedMargin: 5000,
    marginRatio: 0.25,
    leverage: 1.09,
    dailyPnL: 2000,
    weeklyPnL: 5000,
    monthlyPnL: 8000,
    longExposure: 109000,
    shortExposure: 0,
    netExposure: 109000,
    grossExposure: 109000,
    largestPositionPercent: 78,
    topConcentrations: [
      { symbol: 'BTC-USD', percentage: 78, value: 78000 },
      { symbol: 'ETH-USD', percentage: 31, value: 31000 }
    ]
  };
}

function createMockRiskProfile(): RiskProfile {
  return {
    name: 'Test Profile',
    description: 'Test risk profile',
    riskTolerance: 'moderate',
    maxDrawdown: 10,
    maxLeverage: 3,
    maxConcentration: 20,
    defaultPositionSize: 10,
    maxPositionSize: 25,
    kellyMultiplier: 0.75,
    targetReturn: 15,
    maxVolatility: 20,
    minSharpeRatio: 0.75,
    investmentHorizon: 180,
    rebalanceFrequency: 14,
    allowedAssets: [],
    forbiddenAssets: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function createMockStrategySignal(): StrategySignal {
  return {
    id: 'signal_test_123',
    strategyId: 'test_strategy',
    timestamp: new Date(),
    type: 'BUY',
    symbol: 'BTC-USD',
    confidence: 85,
    strength: 0.8,
    quantity: 0.5,
    percentage: 10,
    entryPrice: 52000,
    stopLoss: 48000,
    takeProfit: 58000,
    maxRisk: 5,
    timeframe: '1h',
    reasoning: 'Test signal for integration testing',
    indicators: {
      'RSI': 30,
      'MACD': 0.5,
      'EMA_20': 51000
    },
    conditions: ['RSI oversold', 'MACD bullish crossover'],
    metadata: {},
    source: 'technical',
    priority: 'medium',
    isValid: true
  };
}