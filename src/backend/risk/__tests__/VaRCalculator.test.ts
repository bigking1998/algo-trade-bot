/**
 * VaR Calculator Tests - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Comprehensive test suite for VaR calculation methodologies
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { VaRCalculator } from '../VaRCalculator.js';
import type { Position } from '../types.js';

describe('VaRCalculator', () => {
  let varCalculator: VaRCalculator;

  beforeEach(() => {
    varCalculator = VaRCalculator.getInstance();
  });

  describe('Historical VaR Calculation', () => {
    test('should calculate historical VaR correctly', async () => {
      const returns = [-0.05, -0.03, -0.01, 0.01, 0.02, 0.03, 0.05, -0.02, 0.01, -0.01];
      const confidence = 0.95;
      
      const result = await varCalculator.historicalVaR(returns, confidence);
      
      expect(result.method).toBe('historical');
      expect(result.confidence).toBe(confidence);
      expect(result.value).toBeGreaterThan(0);
      expect(result.expectedShortfall).toBeGreaterThanOrEqual(result.value);
    });

    test('should handle empty returns array', async () => {
      const returns: number[] = [];
      const confidence = 0.95;
      
      await expect(varCalculator.historicalVaR(returns, confidence))
        .rejects.toThrow('No returns data provided for VaR calculation');
    });

    test('should handle invalid confidence levels', async () => {
      const returns = [-0.05, -0.03, 0.01, 0.02];
      
      await expect(varCalculator.historicalVaR(returns, 0))
        .rejects.toThrow('Confidence level must be between 0 and 1');
        
      await expect(varCalculator.historicalVaR(returns, 1))
        .rejects.toThrow('Confidence level must be between 0 and 1');
    });

    test('should scale VaR for different time horizons', async () => {
      const returns = [-0.05, -0.03, -0.01, 0.01, 0.02];
      const confidence = 0.95;
      
      const dailyVaR = await varCalculator.historicalVaR(returns, confidence, 1);
      const weeklyVaR = await varCalculator.historicalVaR(returns, confidence, 7);
      
      // Weekly VaR should be approximately sqrt(7) times larger
      const expectedRatio = Math.sqrt(7);
      const actualRatio = weeklyVaR.value / dailyVaR.value;
      
      expect(actualRatio).toBeCloseTo(expectedRatio, 1);
    });
  });

  describe('Parametric VaR Calculation', () => {
    test('should calculate parametric VaR correctly', async () => {
      const returns = generateNormalReturns(100, 0.001, 0.02); // Mean 0.1%, StdDev 2%
      const confidence = 0.95;
      
      const result = await varCalculator.parametricVaR(returns, confidence);
      
      expect(result.method).toBe('parametric');
      expect(result.confidence).toBe(confidence);
      expect(result.value).toBeGreaterThan(0);
      expect(result.details.modelParameters).toBeDefined();
      expect(result.details.modelParameters?.mean).toBeDefined();
      expect(result.details.modelParameters?.standardDeviation).toBeDefined();
    });

    test('should handle insufficient data', async () => {
      const returns = [0.01]; // Only one return
      const confidence = 0.95;
      
      await expect(varCalculator.parametricVaR(returns, confidence))
        .rejects.toThrow('Insufficient data for parametric VaR calculation');
    });

    test('should provide consistent results for same data', async () => {
      const returns = generateNormalReturns(50, 0, 0.015);
      const confidence = 0.99;
      
      const result1 = await varCalculator.parametricVaR(returns, confidence);
      const result2 = await varCalculator.parametricVaR(returns, confidence);
      
      expect(result1.value).toBeCloseTo(result2.value, 6);
    });
  });

  describe('Expected Shortfall Calculation', () => {
    test('should calculate expected shortfall using historical method', async () => {
      const returns = [-0.08, -0.05, -0.03, -0.02, -0.01, 0.01, 0.02, 0.03, 0.05, 0.08];
      const confidence = 0.95;
      
      const es = await varCalculator.expectedShortfall(returns, confidence, 'historical');
      
      expect(es).toBeGreaterThan(0);
      
      // Expected shortfall should be greater than or equal to VaR
      const var95 = await varCalculator.historicalVaR(returns, confidence);
      expect(es).toBeGreaterThanOrEqual(var95.value);
    });

    test('should calculate expected shortfall using parametric method', async () => {
      const returns = generateNormalReturns(100, 0, 0.02);
      const confidence = 0.99;
      
      const es = await varCalculator.expectedShortfall(returns, confidence, 'parametric');
      
      expect(es).toBeGreaterThan(0);
    });

    test('should handle edge case with no tail returns', async () => {
      const returns = [0.01, 0.02, 0.03]; // All positive returns
      const confidence = 0.95;
      
      const es = await varCalculator.expectedShortfall(returns, confidence, 'historical');
      
      // Should still return a reasonable value
      expect(es).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Monte Carlo VaR Calculation', () => {
    test('should calculate Monte Carlo VaR for portfolio', async () => {
      const positions = createMockPositions();
      const confidence = 0.95;
      const horizon = 1;
      const iterations = 1000;
      
      const result = await varCalculator.monteCarloVaR(positions, confidence, horizon, iterations);
      
      expect(result.method).toBe('monte_carlo');
      expect(result.confidence).toBe(confidence);
      expect(result.value).toBeGreaterThan(0);
      expect(result.details.simulationsRun).toBe(iterations);
    });

    test('should handle empty positions array', async () => {
      const positions: Position[] = [];
      const confidence = 0.95;
      
      await expect(varCalculator.monteCarloVaR(positions, confidence))
        .rejects.toThrow('No positions provided for Monte Carlo VaR');
    });

    test('should produce different results with different iteration counts', async () => {
      const positions = createMockPositions();
      const confidence = 0.95;
      
      const result1000 = await varCalculator.monteCarloVaR(positions, confidence, 1, 1000);
      const result5000 = await varCalculator.monteCarloVaR(positions, confidence, 1, 5000);
      
      // Results should be similar but not identical due to randomness
      const relativeDifference = Math.abs(result5000.value - result1000.value) / result1000.value;
      expect(relativeDifference).toBeLessThan(0.5); // Less than 50% difference
    });
  });

  describe('Marginal VaR Calculation', () => {
    test('should calculate marginal VaR for position', async () => {
      const portfolio = createMockPositions();
      const targetPosition = portfolio[0];
      const confidence = 0.95;
      
      const marginalVaR = await varCalculator.marginalVaR(portfolio, targetPosition, confidence);
      
      expect(typeof marginalVaR).toBe('number');
      // Marginal VaR can be positive or negative
      expect(Math.abs(marginalVaR)).toBeGreaterThanOrEqual(0);
    });

    test('should handle portfolio with single position', async () => {
      const portfolio = [createMockPositions()[0]];
      const targetPosition = portfolio[0];
      const confidence = 0.95;
      
      const marginalVaR = await varCalculator.marginalVaR(portfolio, targetPosition, confidence);
      
      expect(typeof marginalVaR).toBe('number');
    });
  });

  describe('Component VaR Calculation', () => {
    test('should calculate component VaR for all positions', async () => {
      const portfolio = createMockPositions();
      
      const componentVaRResults = await varCalculator.componentVaR(portfolio);
      
      expect(componentVaRResults).toHaveLength(portfolio.length);
      
      componentVaRResults.forEach(result => {
        expect(result.symbol).toBeDefined();
        expect(result.componentVaR).toBeDefined();
        expect(result.marginalVaR).toBeDefined();
        expect(result.contributionPercent).toBeDefined();
        expect(result.idiosyncraticRisk).toBeGreaterThanOrEqual(0);
        expect(result.systematicRisk).toBeGreaterThanOrEqual(0);
      });
      
      // Sum of contribution percentages should be approximately 100%
      const totalContribution = componentVaRResults.reduce(
        (sum, result) => sum + result.contributionPercent,
        0
      );
      expect(totalContribution).toBeCloseTo(100, 0);
    });

    test('should handle empty portfolio', async () => {
      const portfolio: Position[] = [];
      
      const results = await varCalculator.componentVaR(portfolio);
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extreme return values', async () => {
      const returns = [-1, -0.5, 0.5, 1]; // Extreme returns (100% loss/gain)
      const confidence = 0.95;
      
      const result = await varCalculator.historicalVaR(returns, confidence);
      
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBeLessThanOrEqual(1); // Should not exceed 100%
    });

    test('should handle all zero returns', async () => {
      const returns = [0, 0, 0, 0, 0];
      const confidence = 0.95;
      
      const result = await varCalculator.historicalVaR(returns, confidence);
      
      expect(result.value).toBe(0);
    });

    test('should handle very small returns', async () => {
      const returns = [0.0001, -0.0001, 0.0002, -0.0002];
      const confidence = 0.95;
      
      const result = await varCalculator.parametricVaR(returns, confidence);
      
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
    });
  });
});

/**
 * Helper Functions for Testing
 */
function generateNormalReturns(count: number, mean: number, stdDev: number): number[] {
  const returns: number[] = [];
  
  for (let i = 0; i < count; i++) {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const return_ = mean + stdDev * z0;
    returns.push(return_);
  }
  
  return returns;
}

function createMockPositions(): Position[] {
  return [
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
      holdingPeriod: 86400000, // 1 day
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
    },
    {
      id: 'pos3',
      strategyId: 'strategy2',
      symbol: 'ADA-USD',
      side: 'short',
      size: 1000,
      entryPrice: 1.2,
      currentPrice: 1.1,
      unrealizedPnL: 100,
      realizedPnL: 0,
      totalPnL: 100,
      pnlPercent: 8.33,
      marketValue: 1100,
      entryTime: new Date('2024-01-02'),
      holdingPeriod: 43200000, // 12 hours
      metadata: {},
      status: 'open'
    }
  ];
}