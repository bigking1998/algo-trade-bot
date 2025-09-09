/**
 * Simple Integration Test for Condition Evaluation Engine
 * Task BE-013: Quick validation test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ConditionEvaluationEngine from '../ConditionEvaluationEngine.js';
import type { 
  ComparisonCondition, 
  LogicalCondition,
  EvaluationContext 
} from '../types.js';
import { ComparisonOperator, LogicalOperator } from '../types.js';

describe('ConditionEvaluationEngine - Basic Integration', () => {
  let engine: ConditionEvaluationEngine;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    engine = new ConditionEvaluationEngine({
      execution: { 
        defaultTimeout: 1000,
        maxConcurrency: 2,
        enableShortCircuit: true,
        enableCaching: false // Disable caching for tests
      },
      validation: {
        strictTypeChecking: false,
        allowedFunctions: [],
        maxNestingDepth: 5,
        maxComplexity: 50
      }
    });

    mockContext = {
      symbol: 'BTC-USD',
      timeframe: '1m',
      timestamp: new Date(),
      marketData: {
        current: { open: 50000, high: 50100, low: 49900, close: 50050, volume: 1000000 },
        history: [],
        windowSize: 0
      },
      indicators: new Map([
        ['sma_20', {
          value: 50250,
          timestamp: new Date(),
          isValid: true,
          metadata: { periods: 20 }
        }]
      ]),
      variables: new Map(),
      sessionData: new Map(),
      strategyData: new Map(),
      executionId: 'test_execution',
      strategyId: 'test_strategy',
      startTime: Date.now(),
      maxExecutionTime: 5000
    };

    engine.start();
  });

  afterEach(() => {
    engine.stop();
  });

  it('should evaluate simple comparison condition', async () => {
    const condition: ComparisonCondition = {
      id: 'test_comparison',
      name: 'Test Comparison',
      type: 'comparison',
      operator: ComparisonOperator.GREATER_THAN,
      enabled: true,
      weight: 1,
      tags: [],
      metadata: {},
      created: new Date(),
      updated: new Date(),
      left: { 
        type: 'literal', 
        value: 100,
        dataType: 'number'
      },
      right: { 
        type: 'literal', 
        value: 50,
        dataType: 'number' 
      }
    };

    const result = await engine.evaluateCondition(condition, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    expect(result.conditionId).toBe('test_comparison');
  });

  it('should evaluate simple logical AND condition', async () => {
    const subCondition1: ComparisonCondition = {
      id: 'sub_condition_1',
      name: 'Sub Condition 1',
      type: 'comparison',
      operator: ComparisonOperator.GREATER_THAN,
      enabled: true,
      weight: 1,
      tags: [],
      metadata: {},
      created: new Date(),
      updated: new Date(),
      left: { type: 'literal', value: 100, dataType: 'number' },
      right: { type: 'literal', value: 50, dataType: 'number' }
    };

    const subCondition2: ComparisonCondition = {
      id: 'sub_condition_2', 
      name: 'Sub Condition 2',
      type: 'comparison',
      operator: ComparisonOperator.LESS_THAN,
      enabled: true,
      weight: 1,
      tags: [],
      metadata: {},
      created: new Date(),
      updated: new Date(),
      left: { type: 'literal', value: 25, dataType: 'number' },
      right: { type: 'literal', value: 50, dataType: 'number' }
    };

    const logicalCondition: LogicalCondition = {
      id: 'test_logical_and',
      name: 'Test Logical AND',
      type: 'logical',
      operator: LogicalOperator.AND,
      conditions: [subCondition1, subCondition2],
      shortCircuit: true,
      enabled: true,
      weight: 1,
      tags: [],
      metadata: {},
      created: new Date(),
      updated: new Date()
    };

    const result = await engine.evaluateCondition(logicalCondition, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
  });

  it('should handle indicator-based conditions', async () => {
    const condition: ComparisonCondition = {
      id: 'indicator_comparison',
      name: 'Indicator Comparison',
      type: 'comparison',
      operator: ComparisonOperator.GREATER_THAN,
      enabled: true,
      weight: 1,
      tags: [],
      metadata: {},
      created: new Date(),
      updated: new Date(),
      left: { 
        type: 'indicator',
        indicatorId: 'sma_20',
        field: 'value',
        offset: 0
      },
      right: { 
        type: 'literal', 
        value: 50000,
        dataType: 'number'
      }
    };

    const result = await engine.evaluateCondition(condition, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
  });

  it('should return performance metrics', () => {
    const snapshot = engine.getPerformanceSnapshot();
    
    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot).toHaveProperty('totalConditions');
    expect(snapshot).toHaveProperty('performance');
    expect(snapshot).toHaveProperty('resource');
    expect(snapshot).toHaveProperty('errors');
  });
});