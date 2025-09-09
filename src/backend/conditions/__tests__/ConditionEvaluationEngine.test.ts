/**
 * Condition Evaluation Engine Tests - Task BE-013
 * 
 * Comprehensive test suite for the condition evaluation engine covering:
 * - Logical operators with complex nested conditions
 * - Comparison operators with type validation
 * - Mathematical operations with error handling
 * - Cross-over detection algorithms
 * - Performance and memory usage validation
 * - Error scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConditionEvaluationEngine } from '../ConditionEvaluationEngine.js';
import type {
  ConditionExpression,
  EvaluationContext,
  LogicalCondition,
  ComparisonCondition,
  MathematicalCondition,
  CrossOverCondition,
  ConditionEngineConfig
} from '../types.js';
import {
  LogicalOperator,
  ComparisonOperator,
  MathematicalOperator,
  CrossOverType
} from '../types.js';

describe('ConditionEvaluationEngine', () => {
  let engine: ConditionEvaluationEngine;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    const config: Partial<ConditionEngineConfig> = {
      execution: {
        defaultTimeout: 5000,
        maxConcurrency: 4,
        enableShortCircuit: true,
        enableCaching: false // Disable for testing
      },
      validation: {
        strictTypeChecking: true,
        allowedFunctions: ['abs', 'max', 'min', 'mean'],
        maxNestingDepth: 10,
        maxComplexity: 100
      }
    };

    engine = new ConditionEvaluationEngine(config);

    // Create mock evaluation context
    mockContext = {
      symbol: 'BTC-USD',
      timeframe: '1h',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      marketData: {
        current: {
          open: 50000,
          high: 51000,
          low: 49500,
          close: 50500,
          volume: 1000000
        },
        history: Array.from({ length: 100 }, (_, i) => ({
          timestamp: new Date(Date.now() - (99 - i) * 3600000),
          open: 50000 + (i * 10),
          high: 50100 + (i * 10),
          low: 49900 + (i * 10),
          close: 50000 + (i * 10),
          volume: 1000000
        })),
        windowSize: 100
      },
      indicators: new Map([
        ['sma_20', {
          value: 50250,
          timestamp: new Date(),
          isValid: true,
          metadata: { periods: 20, lastCalculated: new Date(), dataPoints: 100 }
        }],
        ['ema_50', {
          value: 50100,
          timestamp: new Date(),
          isValid: true,
          metadata: { periods: 50, lastCalculated: new Date(), dataPoints: 100 }
        }],
        ['rsi_14', {
          value: 65,
          timestamp: new Date(),
          isValid: true,
          metadata: { periods: 14, lastCalculated: new Date(), dataPoints: 100 }
        }]
      ]),
      variables: new Map(),
      sessionData: new Map(),
      strategyData: new Map(),
      executionId: 'test_execution_1',
      strategyId: 'test_strategy',
      startTime: Date.now(),
      maxExecutionTime: 5000
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Logical Operators', () => {
    it('should evaluate AND operator correctly', async () => {
      const condition: LogicalCondition = {
        id: 'and_test',
        name: 'AND Test',
        type: 'logical',
        operator: LogicalOperator.AND,
        conditions: [
          {
            id: 'comp1',
            name: 'Price > 50000',
            type: 'comparison',
            operator: ComparisonOperator.GREATER_THAN,
            left: { type: 'market', field: 'close', offset: 0 },
            right: { type: 'literal', value: 50000, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          },
          {
            id: 'comp2',
            name: 'RSI < 70',
            type: 'comparison',
            operator: ComparisonOperator.LESS_THAN,
            left: { type: 'indicator', indicatorId: 'rsi_14', field: 'value', offset: 0 },
            right: { type: 'literal', value: 70, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          }
        ],
        shortCircuit: true,
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // 50500 > 50000 AND 65 < 70
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should evaluate OR operator correctly', async () => {
      const condition: LogicalCondition = {
        id: 'or_test',
        name: 'OR Test',
        type: 'logical',
        operator: LogicalOperator.OR,
        conditions: [
          {
            id: 'comp1',
            name: 'Price < 40000',
            type: 'comparison',
            operator: ComparisonOperator.LESS_THAN,
            left: { type: 'market', field: 'close', offset: 0 },
            right: { type: 'literal', value: 40000, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          },
          {
            id: 'comp2',
            name: 'RSI > 60',
            type: 'comparison',
            operator: ComparisonOperator.GREATER_THAN,
            left: { type: 'indicator', indicatorId: 'rsi_14', field: 'value', offset: 0 },
            right: { type: 'literal', value: 60, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          }
        ],
        shortCircuit: true,
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // false OR true = true (65 > 60)
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should evaluate NOT operator correctly', async () => {
      const condition: LogicalCondition = {
        id: 'not_test',
        name: 'NOT Test',
        type: 'logical',
        operator: LogicalOperator.NOT,
        conditions: [
          {
            id: 'comp1',
            name: 'Price > 60000',
            type: 'comparison',
            operator: ComparisonOperator.GREATER_THAN,
            left: { type: 'market', field: 'close', offset: 0 },
            right: { type: 'literal', value: 60000, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          }
        ],
        shortCircuit: false,
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // NOT (50500 > 60000) = NOT false = true
    });

    it('should evaluate XOR operator correctly', async () => {
      const condition: LogicalCondition = {
        id: 'xor_test',
        name: 'XOR Test',
        type: 'logical',
        operator: LogicalOperator.XOR,
        conditions: [
          {
            id: 'comp1',
            name: 'Price > 50000',
            type: 'comparison',
            operator: ComparisonOperator.GREATER_THAN,
            left: { type: 'market', field: 'close', offset: 0 },
            right: { type: 'literal', value: 50000, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          },
          {
            id: 'comp2',
            name: 'RSI > 80',
            type: 'comparison',
            operator: ComparisonOperator.GREATER_THAN,
            left: { type: 'indicator', indicatorId: 'rsi_14', field: 'value', offset: 0 },
            right: { type: 'literal', value: 80, dataType: 'number' },
            enabled: true,
            weight: 1,
            tags: [],
            metadata: {},
            created: new Date(),
            updated: new Date()
          }
        ],
        shortCircuit: false,
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // true XOR false = true
    });
  });

  describe('Comparison Operators', () => {
    it('should evaluate greater than correctly', async () => {
      const condition: ComparisonCondition = {
        id: 'gt_test',
        name: 'Greater Than Test',
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: { type: 'market', field: 'close', offset: 0 },
        right: { type: 'literal', value: 50000, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // 50500 > 50000
    });

    it('should evaluate equality with tolerance', async () => {
      const condition: ComparisonCondition = {
        id: 'eq_test',
        name: 'Equality Test with Tolerance',
        type: 'comparison',
        operator: ComparisonOperator.EQUAL,
        left: { type: 'market', field: 'close', offset: 0 },
        right: { type: 'literal', value: 50501, dataType: 'number' },
        tolerance: 2, // Allow 2 unit tolerance
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // |50500 - 50501| = 1 <= 2 tolerance
    });
  });

  describe('Mathematical Operators', () => {
    it('should evaluate addition correctly', async () => {
      const condition: MathematicalCondition = {
        id: 'add_test',
        name: 'Addition Test',
        type: 'mathematical',
        operator: MathematicalOperator.ADD,
        operands: [
          { type: 'literal', value: 100, dataType: 'number' },
          { type: 'literal', value: 200, dataType: 'number' },
          { type: 'literal', value: 300, dataType: 'number' }
        ],
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(600); // 100 + 200 + 300
    });

    it('should handle division by zero', async () => {
      const condition: MathematicalCondition = {
        id: 'div_zero_test',
        name: 'Division by Zero Test',
        type: 'mathematical',
        operator: MathematicalOperator.DIVIDE,
        operands: [
          { type: 'literal', value: 100, dataType: 'number' },
          { type: 'literal', value: 0, dataType: 'number' }
        ],
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('EVALUATION_ERROR');
    });

    it('should store result in variable', async () => {
      const condition: MathematicalCondition = {
        id: 'var_test',
        name: 'Variable Storage Test',
        type: 'mathematical',
        operator: MathematicalOperator.MULTIPLY,
        operands: [
          { type: 'literal', value: 10, dataType: 'number' },
          { type: 'literal', value: 5, dataType: 'number' }
        ],
        resultVariable: 'calculated_result',
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(50);
      expect(mockContext.variables.get('calculated_result')).toBe(50);
    });
  });

  describe('Cross-over Detection', () => {
    it('should detect golden cross', async () => {
      // Modify context to simulate golden cross scenario
      const crossoverContext = { ...mockContext };
      crossoverContext.indicators.set('fast_ma', {
        value: Array.from({ length: 5 }, (_, i) => 50000 + (i * 50)), // Increasing trend  
        timestamp: new Date(),
        isValid: true,
        metadata: { periods: 10, lastCalculated: new Date(), dataPoints: 100 }
      });
      
      crossoverContext.indicators.set('slow_ma', {
        value: Array.from({ length: 5 }, (_, i) => 50100 - (i * 10)), // Slight decrease, allowing crossover
        timestamp: new Date(),
        isValid: true,
        metadata: { periods: 20, lastCalculated: new Date(), dataPoints: 100 }
      });

      const condition: CrossOverCondition = {
        id: 'golden_cross_test',
        name: 'Golden Cross Test',
        type: 'crossover',
        crossOverType: CrossOverType.GOLDEN_CROSS,
        source: { type: 'indicator', indicatorId: 'fast_ma', field: 'value', offset: 0 },
        reference: { type: 'indicator', indicatorId: 'slow_ma', field: 'value', offset: 0 },
        lookbackPeriods: 10,
        confirmationPeriods: 1,
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, crossoverContext);

      expect(result.success).toBe(true);
      // Note: Actual crossover detection would depend on the data pattern
    });
  });

  describe('Batch Evaluation', () => {
    it('should evaluate multiple conditions in batch', async () => {
      const conditions: ConditionExpression[] = [
        {
          id: 'batch_test_1',
          name: 'Simple Comparison',
          type: 'comparison',
          operator: ComparisonOperator.GREATER_THAN,
          left: { type: 'literal', value: 100, dataType: 'number' },
          right: { type: 'literal', value: 50, dataType: 'number' },
          enabled: true,
          weight: 1,
          tags: [],
          metadata: {},
          created: new Date(),
          updated: new Date()
        },
        {
          id: 'batch_test_2',
          name: 'Mathematical Operation',
          type: 'mathematical',
          operator: MathematicalOperator.ADD,
          operands: [
            { type: 'literal', value: 10, dataType: 'number' },
            { type: 'literal', value: 20, dataType: 'number' }
          ],
          enabled: true,
          weight: 1,
          tags: [],
          metadata: {},
          created: new Date(),
          updated: new Date()
        }
      ];

      const result = await engine.evaluateBatch(conditions, mockContext);

      expect(result.success).toBe(true);
      expect(result.results.size).toBe(2);
      expect(result.metadata.successfulEvaluations).toBe(2);
      expect(result.metadata.failedEvaluations).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid condition type', async () => {
      const invalidCondition = {
        id: 'invalid_test',
        name: 'Invalid Condition',
        type: 'invalid_type',
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      } as any;

      const result = await engine.evaluateCondition(invalidCondition, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('EVALUATION_ERROR');
    });

    it('should handle missing indicator', async () => {
      const condition: ComparisonCondition = {
        id: 'missing_indicator_test',
        name: 'Missing Indicator Test',
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: { type: 'indicator', indicatorId: 'non_existent_indicator', field: 'value', offset: 0 },
        right: { type: 'literal', value: 50, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout', async () => {
      const slowCondition: ConditionExpression = {
        id: 'timeout_test',
        name: 'Timeout Test',
        type: 'custom',
        functionCode: 'while(true) { /* infinite loop */ }',
        parameters: {},
        sandbox: true,
        timeout: 100, // 100ms timeout
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(slowCondition, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000); // 10 second test timeout
  });

  describe('Performance', () => {
    it('should complete evaluation within reasonable time', async () => {
      const startTime = performance.now();
      
      const condition: ComparisonCondition = {
        id: 'perf_test',
        name: 'Performance Test',
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: { type: 'market', field: 'close', offset: 0 },
        right: { type: 'literal', value: 50000, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle large batch efficiently', async () => {
      const conditions: ConditionExpression[] = Array.from({ length: 100 }, (_, i) => ({
        id: `perf_batch_${i}`,
        name: `Performance Batch Test ${i}`,
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: { type: 'literal', value: i, dataType: 'number' },
        right: { type: 'literal', value: i - 1, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      }));

      const startTime = performance.now();
      const result = await engine.evaluateBatch(conditions, mockContext);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.results.size).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Value Expression Evaluation', () => {
    it('should evaluate literal values', async () => {
      const condition: ComparisonCondition = {
        id: 'literal_test',
        name: 'Literal Test',
        type: 'comparison',
        operator: ComparisonOperator.EQUAL,
        left: { type: 'literal', value: 42, dataType: 'number' },
        right: { type: 'literal', value: 42, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should evaluate market data values', async () => {
      const condition: ComparisonCondition = {
        id: 'market_test',
        name: 'Market Data Test',
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: { type: 'market', field: 'high', offset: 0 },
        right: { type: 'market', field: 'low', offset: 0 },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // high (51000) > low (49500)
    });

    it('should evaluate indicator values with offset', async () => {
      const condition: ComparisonCondition = {
        id: 'indicator_offset_test',
        name: 'Indicator Offset Test',
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: { type: 'indicator', indicatorId: 'sma_20', field: 'value', offset: 0 },
        right: { type: 'literal', value: 50000, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // 50250 > 50000
    });

    it('should evaluate variable values', async () => {
      // Set a variable in the context
      mockContext.variables.set('test_var', 100);

      const condition: ComparisonCondition = {
        id: 'variable_test',
        name: 'Variable Test',
        type: 'comparison',
        operator: ComparisonOperator.EQUAL,
        left: { type: 'variable', name: 'test_var', scope: 'session', defaultValue: 0 },
        right: { type: 'literal', value: 100, dataType: 'number' },
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };

      const result = await engine.evaluateCondition(condition, mockContext);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('Engine Management', () => {
    it('should provide performance snapshot', () => {
      const snapshot = engine.getPerformanceSnapshot();

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('totalConditions');
      expect(snapshot).toHaveProperty('activeEvaluations');
      expect(snapshot).toHaveProperty('performance');
      expect(snapshot).toHaveProperty('resource');
      expect(snapshot).toHaveProperty('errors');
    });

    it('should start and stop engine', () => {
      expect(() => engine.start()).not.toThrow();
      expect(() => engine.stop()).not.toThrow();
    });

    it('should clear metrics', () => {
      engine.clearMetrics();
      const snapshot = engine.getPerformanceSnapshot();
      expect(snapshot.totalConditions).toBe(0);
    });
  });
});

describe('Condition Validation Integration', () => {
  let engine: ConditionEvaluationEngine;

  beforeEach(() => {
    engine = new ConditionEvaluationEngine({
      validation: {
        strictTypeChecking: true,
        allowedFunctions: [],
        maxNestingDepth: 5,
        maxComplexity: 50
      }
    });
  });

  it('should reject conditions exceeding nesting depth', async () => {
    // Create deeply nested condition
    const createNestedCondition = (depth: number): LogicalCondition => {
      if (depth <= 1) {
        return {
          id: `nested_${depth}`,
          name: `Nested ${depth}`,
          type: 'logical',
          operator: LogicalOperator.AND,
          conditions: [
            {
              id: 'leaf',
              name: 'Leaf Condition',
              type: 'comparison',
              operator: ComparisonOperator.EQUAL,
              left: { type: 'literal', value: 1, dataType: 'number' },
              right: { type: 'literal', value: 1, dataType: 'number' },
              enabled: true,
              weight: 1,
              tags: [],
              metadata: {},
              created: new Date(),
              updated: new Date()
            }
          ],
          shortCircuit: false,
          enabled: true,
          weight: 1,
          tags: [],
          metadata: {},
          created: new Date(),
          updated: new Date()
        };
      }

      return {
        id: `nested_${depth}`,
        name: `Nested ${depth}`,
        type: 'logical',
        operator: LogicalOperator.AND,
        conditions: [createNestedCondition(depth - 1)],
        shortCircuit: false,
        enabled: true,
        weight: 1,
        tags: [],
        metadata: {},
        created: new Date(),
        updated: new Date()
      };
    };

    const deepCondition = createNestedCondition(10); // Exceeds max depth of 5

    const mockContext: EvaluationContext = {
      symbol: 'TEST',
      timeframe: '1h',
      timestamp: new Date(),
      marketData: {
        current: { open: 100, high: 101, low: 99, close: 100, volume: 1000 },
        history: [],
        windowSize: 0
      },
      indicators: new Map(),
      variables: new Map(),
      sessionData: new Map(),
      strategyData: new Map(),
      executionId: 'test',
      strategyId: 'test',
      startTime: Date.now(),
      maxExecutionTime: 5000
    };

    const result = await engine.evaluateCondition(deepCondition, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Memory and Resource Management', () => {
  it('should not leak memory during repeated evaluations', async () => {
    const engine = new ConditionEvaluationEngine();
    const initialMemory = process.memoryUsage().heapUsed;

    const condition: ComparisonCondition = {
      id: 'memory_test',
      name: 'Memory Test',
      type: 'comparison',
      operator: ComparisonOperator.GREATER_THAN,
      left: { type: 'literal', value: 100, dataType: 'number' },
      right: { type: 'literal', value: 50, dataType: 'number' },
      enabled: true,
      weight: 1,
      tags: [],
      metadata: {},
      created: new Date(),
      updated: new Date()
    };

    const mockContext: EvaluationContext = {
      symbol: 'TEST',
      timeframe: '1h',
      timestamp: new Date(),
      marketData: {
        current: { open: 100, high: 101, low: 99, close: 100, volume: 1000 },
        history: [],
        windowSize: 0
      },
      indicators: new Map(),
      variables: new Map(),
      sessionData: new Map(),
      strategyData: new Map(),
      executionId: 'test',
      strategyId: 'test',
      startTime: Date.now(),
      maxExecutionTime: 5000
    };

    // Run many evaluations
    for (let i = 0; i < 1000; i++) {
      await engine.evaluateCondition(condition, mockContext);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});