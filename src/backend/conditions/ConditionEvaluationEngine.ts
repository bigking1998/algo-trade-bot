/**
 * Condition Evaluation Engine - Task BE-013
 * 
 * Comprehensive condition evaluation engine for trading signal generation with:
 * - High-performance real-time evaluation with minimal latency
 * - Support for complex logical, comparison, and mathematical operators
 * - Cross-over detection algorithms and pattern recognition
 * - Condition composition and template system
 * - Integration with indicator pipeline system
 * - Comprehensive error handling and validation
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type {
  ConditionExpression,
  EvaluationContext,
  ConditionEvaluationResult,
  BatchEvaluationResult,
  ConditionEngineConfig,
  ValueExpression,
  ConditionValue,
  LogicalCondition,
  ComparisonCondition,
  MathematicalCondition,
  CrossOverCondition,
  PatternCondition,
  TimeBasedCondition,
  CustomCondition,
  ConditionPerformanceMetrics,
  EnginePerformanceSnapshot
} from './types.js';
import {
  LogicalOperator,
  ComparisonOperator,
  MathematicalOperator
} from './types.js';
import {
  ConditionEvaluationError,
  ConditionValidationError,
  ConditionTimeoutError
} from './types.js';
import { ConditionValidator } from './ConditionValidator.js';
import { CrossOverDetector } from './CrossOverDetector.js';
import { PatternRecognizer } from './PatternRecognizer.js';
import { BuiltInFunctionLibrary } from './BuiltInFunctionLibrary.js';
import { ConditionCache } from './ConditionCache.js';
import { PerformanceProfiler } from './PerformanceProfiler.js';

// =============================================================================
// CONDITION EVALUATION ENGINE
// =============================================================================

export class ConditionEvaluationEngine extends EventEmitter {
  private readonly config: ConditionEngineConfig;
  private readonly validator: ConditionValidator;
  private readonly crossOverDetector: CrossOverDetector;
  private readonly patternRecognizer: PatternRecognizer;
  private readonly builtInFunctions: BuiltInFunctionLibrary;
  private readonly cache: ConditionCache;
  private readonly profiler: PerformanceProfiler;
  
  // Engine state
  private isRunning = false;
  private activeEvaluations = 0;
  private backgroundInterval?: NodeJS.Timeout;
  private evaluationQueue: Array<{
    conditions: ConditionExpression[];
    context: EvaluationContext;
    resolve: (result: BatchEvaluationResult) => void;
    reject: (error: Error) => void;
  }> = [];
  
  // Performance tracking
  private readonly performanceMetrics: Map<string, ConditionPerformanceMetrics> = new Map();
  private totalEvaluations = 0;
  private successfulEvaluations = 0;
  private failedEvaluations = 0;

  constructor(config: Partial<ConditionEngineConfig> = {}) {
    super();
    
    this.config = this.mergeDefaultConfig(config);
    
    // Initialize components
    this.validator = new ConditionValidator(this.config.validation);
    this.crossOverDetector = new CrossOverDetector(this.config.crossover);
    this.patternRecognizer = new PatternRecognizer(this.config.patterns);
    this.builtInFunctions = new BuiltInFunctionLibrary();
    this.cache = new ConditionCache(this.config.cache);
    this.profiler = new PerformanceProfiler(this.config.performance);
    
    this.setupEventHandlers();
    this.startBackgroundProcessing();
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - CONDITION EVALUATION
  // =============================================================================

  /**
   * Evaluate single condition with given context
   */
  async evaluateCondition(
    condition: ConditionExpression, 
    context: EvaluationContext
  ): Promise<ConditionEvaluationResult> {
    const startTime = performance.now();
    
    try {
      // Validate condition first
      const validationResult = await this.validator.validateCondition(condition);
      if (!validationResult.isValid) {
        throw new ConditionValidationError(
          'Condition validation failed',
          condition.id,
          validationResult.errors
        );
      }
      
      // Check cache if enabled
      if (this.config.execution.enableCaching) {
        const cached = await this.cache.get(condition.id, context);
        if (cached) {
          this.updatePerformanceMetrics(condition.id, performance.now() - startTime, true, true);
          return cached;
        }
      }
      
      // Set execution timeout
      const timeoutPromise = this.createTimeoutPromise(condition.id, this.config.execution.defaultTimeout);
      
      // Evaluate condition with timeout protection
      const evaluationPromise = this.doEvaluateCondition(condition, context);
      const result = await Promise.race([evaluationPromise, timeoutPromise]);
      
      // Cache result if enabled
      if (this.config.execution.enableCaching && result.success) {
        await this.cache.set(condition.id, context, result);
      }
      
      // Update performance metrics
      this.updatePerformanceMetrics(condition.id, performance.now() - startTime, result.success, false);
      
      return result;
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      this.updatePerformanceMetrics(condition.id, executionTime, false, false);
      
      const evaluationError = error instanceof ConditionEvaluationError 
        ? error 
        : new ConditionEvaluationError(
            `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            condition.id,
            'EVALUATION_ERROR',
            context,
            error instanceof Error ? error : undefined
          );
      
      const result: ConditionEvaluationResult = {
        conditionId: condition.id,
        success: false,
        value: false,
        confidence: 0,
        executionTime,
        error: evaluationError,
        details: {
          type: condition.type,
          intermediate: [],
          shortCircuited: false,
          fromCache: false
        },
        context: {
          timestamp: context.timestamp,
          symbol: context.symbol,
          timeframe: context.timeframe
        }
      };
      
      this.emit('evaluationError', { condition, context, error: evaluationError, result });
      
      return result;
    }
  }

  /**
   * Evaluate batch of conditions with given context
   */
  async evaluateBatch(
    conditions: ConditionExpression[], 
    context: EvaluationContext
  ): Promise<BatchEvaluationResult> {
    const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    this.activeEvaluations++;
    
    try {
      this.emit('batchStarted', { requestId, conditionCount: conditions.length });
      
      const results = new Map<string, ConditionEvaluationResult>();
      const errors = new Map<string, ConditionEvaluationError>();
      
      let successfulEvaluations = 0;
      let cacheHits = 0;
      let shortCircuits = 0;
      
      // Process conditions with concurrency limit
      const concurrencyLimit = Math.min(this.config.execution.maxConcurrency, conditions.length);
      const chunks = this.chunkArray(conditions, concurrencyLimit);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (condition) => {
          try {
            const result = await this.evaluateCondition(condition, context);
            results.set(condition.id, result);
            
            if (result.success) successfulEvaluations++;
            if (result.details.fromCache) cacheHits++;
            if (result.details.shortCircuited) shortCircuits++;
            
            return result;
            
          } catch (error) {
            const conditionError = error instanceof ConditionEvaluationError 
              ? error 
              : new ConditionEvaluationError(
                  `Batch evaluation failed for condition: ${error instanceof Error ? error.message : String(error)}`,
                  condition.id,
                  'BATCH_ERROR',
                  context,
                  error instanceof Error ? error : undefined
                );
            
            errors.set(condition.id, conditionError);
            throw conditionError;
          }
        });
        
        await Promise.allSettled(chunkPromises);
      }
      
      const totalExecutionTime = performance.now() - startTime;
      const averageExecutionTime = totalExecutionTime / conditions.length;
      
      const batchResult: BatchEvaluationResult = {
        requestId,
        success: errors.size === 0,
        results,
        errors,
        metadata: {
          totalConditions: conditions.length,
          successfulEvaluations,
          failedEvaluations: errors.size,
          totalExecutionTime,
          averageExecutionTime,
          cacheHits,
          shortCircuits
        }
      };
      
      // Update global metrics
      this.totalEvaluations += conditions.length;
      this.successfulEvaluations += successfulEvaluations;
      this.failedEvaluations += errors.size;
      
      this.emit('batchCompleted', { requestId, result: batchResult });
      
      return batchResult;
      
    } catch (error) {
      const batchResult: BatchEvaluationResult = {
        requestId,
        success: false,
        results: new Map(),
        errors: new Map([['batch', error instanceof ConditionEvaluationError ? error : 
          new ConditionEvaluationError(
            `Batch evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            'batch',
            'BATCH_ERROR',
            context,
            error instanceof Error ? error : undefined
          )
        ]]),
        metadata: {
          totalConditions: conditions.length,
          successfulEvaluations: 0,
          failedEvaluations: conditions.length,
          totalExecutionTime: performance.now() - startTime,
          averageExecutionTime: 0,
          cacheHits: 0,
          shortCircuits: 0
        }
      };
      
      this.emit('batchFailed', { requestId, error, result: batchResult });
      
      return batchResult;
      
    } finally {
      this.activeEvaluations--;
    }
  }

  // =============================================================================
  // PRIVATE METHODS - CORE EVALUATION LOGIC
  // =============================================================================

  private async doEvaluateCondition(
    condition: ConditionExpression,
    context: EvaluationContext
  ): Promise<ConditionEvaluationResult> {
    const startTime = performance.now();
    
    let result: ConditionValue;
    let confidence = 1.0;
    let shortCircuited = false;
    let intermediate: ConditionValue[] = [];
    
    try {
      switch (condition.type) {
        case 'logical': {
          const logicalResult = await this.evaluateLogicalCondition(condition, context);
          result = logicalResult.value;
          confidence = logicalResult.confidence;
          shortCircuited = logicalResult.shortCircuited;
          intermediate = logicalResult.intermediate;
          break;
        }
          
        case 'comparison': {
          const comparisonResult = await this.evaluateComparisonCondition(condition, context);
          result = comparisonResult.value;
          confidence = comparisonResult.confidence;
          intermediate = comparisonResult.intermediate;
          break;
        }
          
        case 'mathematical': {
          const mathResult = await this.evaluateMathematicalCondition(condition, context);
          result = mathResult.value;
          intermediate = mathResult.intermediate;
          break;
        }
          
        case 'crossover': {
          const crossoverResult = await this.evaluateCrossOverCondition(condition, context);
          result = crossoverResult.value;
          confidence = crossoverResult.confidence;
          break;
        }
          
        case 'pattern': {
          const patternResult = await this.evaluatePatternCondition(condition, context);
          result = patternResult.value;
          confidence = patternResult.confidence;
          break;
        }
          
        case 'time': {
          const timeResult = await this.evaluateTimeBasedCondition(condition, context);
          result = timeResult.value;
          confidence = timeResult.confidence;
          break;
        }
          
        case 'custom': {
          const customResult = await this.evaluateCustomCondition(condition, context);
          result = customResult.value;
          confidence = customResult.confidence;
          break;
        }
          
        default:
          throw new ConditionEvaluationError(
            `Unknown condition type: ${(condition as any).type}`,
            (condition as any).id || 'unknown',
            'UNKNOWN_TYPE',
            context
          );
      }
      
      const executionTime = performance.now() - startTime;
      
      return {
        conditionId: condition.id,
        success: true,
        value: result,
        confidence,
        executionTime,
        details: {
          type: condition.type,
          operator: 'operator' in condition ? condition.operator as string : undefined,
          operands: intermediate.length > 0 ? intermediate : undefined,
          intermediate,
          shortCircuited,
          fromCache: false
        },
        context: {
          timestamp: context.timestamp,
          symbol: context.symbol,
          timeframe: context.timeframe
        }
      };
      
    } catch (error) {
      throw new ConditionEvaluationError(
        `Failed to evaluate ${condition.type} condition: ${error instanceof Error ? error.message : String(error)}`,
        condition.id,
        'EVALUATION_ERROR',
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async evaluateLogicalCondition(
    condition: LogicalCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number; shortCircuited: boolean; intermediate: ConditionValue[] }> {
    const { operator, conditions, shortCircuit } = condition;
    const intermediate: ConditionValue[] = [];
    let shortCircuited = false;
    
    if (conditions.length === 0) {
      return { value: false, confidence: 0, shortCircuited: false, intermediate };
    }
    
    switch (operator) {
      case LogicalOperator.AND: {
        let overallConfidence = 1.0;
        
        for (const subCondition of conditions) {
          const result = await this.evaluateCondition(subCondition, context);
          intermediate.push(result.value);
          
          if (!result.success || !result.value) {
            if (shortCircuit && this.config.execution.enableShortCircuit) {
              shortCircuited = true;
              return { value: false, confidence: 0, shortCircuited, intermediate };
            }
            return { value: false, confidence: 0, shortCircuited, intermediate };
          }
          
          overallConfidence = Math.min(overallConfidence, result.confidence);
        }
        
        return { value: true, confidence: overallConfidence, shortCircuited, intermediate };
      }
      
      case LogicalOperator.OR: {
        let maxConfidence = 0;
        
        for (const subCondition of conditions) {
          const result = await this.evaluateCondition(subCondition, context);
          intermediate.push(result.value);
          
          if (result.success && result.value) {
            if (shortCircuit && this.config.execution.enableShortCircuit) {
              shortCircuited = true;
              return { value: true, confidence: result.confidence, shortCircuited, intermediate };
            }
            maxConfidence = Math.max(maxConfidence, result.confidence);
          }
        }
        
        return { value: maxConfidence > 0, confidence: maxConfidence, shortCircuited, intermediate };
      }
      
      case LogicalOperator.NOT: {
        if (conditions.length !== 1) {
          throw new ConditionEvaluationError(
            'NOT operator requires exactly one condition',
            condition.id,
            'INVALID_OPERAND_COUNT',
            context
          );
        }
        
        const result = await this.evaluateCondition(conditions[0], context);
        intermediate.push(result.value);
        
        return { 
          value: !result.value, 
          confidence: result.confidence, 
          shortCircuited: false, 
          intermediate 
        };
      }
      
      case LogicalOperator.XOR: {
        if (conditions.length !== 2) {
          throw new ConditionEvaluationError(
            'XOR operator requires exactly two conditions',
            condition.id,
            'INVALID_OPERAND_COUNT',
            context
          );
        }
        
        const result1 = await this.evaluateCondition(conditions[0], context);
        const result2 = await this.evaluateCondition(conditions[1], context);
        
        intermediate.push(result1.value, result2.value);
        
        const xorResult = (!!result1.value) !== (!!result2.value);
        const confidence = Math.min(result1.confidence, result2.confidence);
        
        return { value: xorResult, confidence, shortCircuited: false, intermediate };
      }
      
      default:
        throw new ConditionEvaluationError(
          `Unknown logical operator: ${operator}`,
          condition.id,
          'UNKNOWN_OPERATOR',
          context
        );
    }
  }

  private async evaluateComparisonCondition(
    condition: ComparisonCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number; intermediate: ConditionValue[] }> {
    const leftValue = await this.evaluateValueExpression(condition.left, context);
    const rightValue = await this.evaluateValueExpression(condition.right, context);
    
    const intermediate = [leftValue, rightValue];
    
    // Type validation if strict checking is enabled
    if (this.config.validation.strictTypeChecking) {
      if (typeof leftValue !== typeof rightValue && leftValue !== null && rightValue !== null) {
        throw new ConditionEvaluationError(
          `Type mismatch in comparison: ${typeof leftValue} vs ${typeof rightValue}`,
          condition.id,
          'TYPE_MISMATCH',
          context
        );
      }
    }
    
    let result: boolean;
    const tolerance = condition.tolerance || 0;
    
    switch (condition.operator) {
      case ComparisonOperator.GREATER_THAN:
        result = this.compareNumbers(leftValue as number, rightValue as number, tolerance) > 0;
        break;
        
      case ComparisonOperator.GREATER_THAN_EQUAL:
        result = this.compareNumbers(leftValue as number, rightValue as number, tolerance) >= 0;
        break;
        
      case ComparisonOperator.LESS_THAN:
        result = this.compareNumbers(leftValue as number, rightValue as number, tolerance) < 0;
        break;
        
      case ComparisonOperator.LESS_THAN_EQUAL:
        result = this.compareNumbers(leftValue as number, rightValue as number, tolerance) <= 0;
        break;
        
      case ComparisonOperator.EQUAL:
        result = this.isEqual(leftValue, rightValue, tolerance);
        break;
        
      case ComparisonOperator.NOT_EQUAL:
        result = !this.isEqual(leftValue, rightValue, tolerance);
        break;
        
      default:
        throw new ConditionEvaluationError(
          `Unknown comparison operator: ${condition.operator}`,
          condition.id,
          'UNKNOWN_OPERATOR',
          context
        );
    }
    
    return { value: result, confidence: 1.0, intermediate };
  }

  private async evaluateMathematicalCondition(
    condition: MathematicalCondition,
    context: EvaluationContext
  ): Promise<{ value: number; intermediate: ConditionValue[] }> {
    if (condition.operands.length < 2) {
      throw new ConditionEvaluationError(
        'Mathematical operations require at least 2 operands',
        condition.id,
        'INSUFFICIENT_OPERANDS',
        context
      );
    }
    
    const operandValues = await Promise.all(
      condition.operands.map(operand => this.evaluateValueExpression(operand, context))
    );
    
    // Validate all operands are numbers
    const numberOperands = operandValues.map((value, index) => {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new ConditionEvaluationError(
          `Operand ${index} is not a valid number: ${value}`,
          condition.id,
          'INVALID_OPERAND_TYPE',
          context
        );
      }
      return numValue;
    });
    
    let result: number;
    
    switch (condition.operator) {
      case MathematicalOperator.ADD:
        result = numberOperands.reduce((sum, value) => sum + value, 0);
        break;
        
      case MathematicalOperator.SUBTRACT:
        result = numberOperands.reduce((diff, value, index) => 
          index === 0 ? value : diff - value);
        break;
        
      case MathematicalOperator.MULTIPLY:
        result = numberOperands.reduce((product, value) => product * value, 1);
        break;
        
      case MathematicalOperator.DIVIDE:
        result = numberOperands.reduce((quotient, value, index) => {
          if (index > 0 && value === 0) {
            throw new ConditionEvaluationError(
              'Division by zero',
              condition.id,
              'DIVISION_BY_ZERO',
              context
            );
          }
          return index === 0 ? value : quotient / value;
        });
        break;
        
      case MathematicalOperator.MODULO:
        if (numberOperands.length !== 2) {
          throw new ConditionEvaluationError(
            'Modulo operation requires exactly 2 operands',
            condition.id,
            'INVALID_OPERAND_COUNT',
            context
          );
        }
        if (numberOperands[1] === 0) {
          throw new ConditionEvaluationError(
            'Modulo by zero',
            condition.id,
            'MODULO_BY_ZERO',
            context
          );
        }
        result = numberOperands[0] % numberOperands[1];
        break;
        
      case MathematicalOperator.POWER:
        if (numberOperands.length !== 2) {
          throw new ConditionEvaluationError(
            'Power operation requires exactly 2 operands',
            condition.id,
            'INVALID_OPERAND_COUNT',
            context
          );
        }
        result = Math.pow(numberOperands[0], numberOperands[1]);
        break;
        
      default:
        throw new ConditionEvaluationError(
          `Unknown mathematical operator: ${condition.operator}`,
          condition.id,
          'UNKNOWN_OPERATOR',
          context
        );
    }
    
    // Store result in variable if specified
    if (condition.resultVariable) {
      context.variables.set(condition.resultVariable, result);
    }
    
    return { value: result, intermediate: operandValues };
  }

  private async evaluateCrossOverCondition(
    condition: CrossOverCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number }> {
    return this.crossOverDetector.detectCrossOver(condition, context);
  }

  private async evaluatePatternCondition(
    condition: PatternCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number }> {
    return this.patternRecognizer.recognizePattern(condition, context);
  }

  private async evaluateTimeBasedCondition(
    condition: TimeBasedCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number }> {
    // Check time constraints
    const now = new Date(context.timestamp);
    
    // Check days of week
    if (condition.daysOfWeek && condition.daysOfWeek.length > 0) {
      const dayOfWeek = now.getDay();
      if (!condition.daysOfWeek.includes(dayOfWeek)) {
        return { value: false, confidence: 1.0 };
      }
    }
    
    // Check time range
    if (condition.startTime || condition.endTime) {
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        timeZone: condition.timezone 
      });
      
      if (condition.startTime && currentTime < condition.startTime) {
        return { value: false, confidence: 1.0 };
      }
      
      if (condition.endTime && currentTime > condition.endTime) {
        return { value: false, confidence: 1.0 };
      }
    }
    
    // Evaluate nested condition
    const nestedResult = await this.evaluateCondition(condition.condition, context);
    return { value: nestedResult.value as boolean, confidence: nestedResult.confidence };
  }

  private async evaluateCustomCondition(
    condition: CustomCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number }> {
    try {
      // Create sandboxed function if required
      let func: Function;
      
      if (condition.sandbox) {
        // Create sandboxed environment (simplified implementation)
        const sandbox = {
          Math,
          Date,
          console: { log: () => {} }, // Disable console for security
          parameters: condition.parameters,
          context: {
            symbol: context.symbol,
            timeframe: context.timeframe,
            timestamp: context.timestamp
          }
        };
        
        func = new Function('sandbox', `
          with (sandbox) {
            ${condition.functionCode}
          }
        `);
      } else {
        func = new Function('parameters', 'context', condition.functionCode);
      }
      
      // Execute with timeout
      const executePromise = condition.sandbox 
        ? func({ ...condition.parameters, context })
        : func(condition.parameters, context);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new ConditionTimeoutError(
          `Custom condition execution timed out after ${condition.timeout}ms`,
          condition.id,
          condition.timeout
        )), condition.timeout)
      );
      
      const result = await Promise.race([executePromise, timeoutPromise]);
      
      return {
        value: Boolean(result),
        confidence: typeof result === 'object' && result && 'confidence' in result 
          ? Number(result.confidence) || 1.0 
          : 1.0
      };
      
    } catch (error) {
      throw new ConditionEvaluationError(
        `Custom condition execution failed: ${error instanceof Error ? error.message : String(error)}`,
        condition.id,
        'CUSTOM_EXECUTION_ERROR',
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async evaluateValueExpression(
    expression: ValueExpression,
    context: EvaluationContext
  ): Promise<ConditionValue> {
    switch (expression.type) {
      case 'literal':
        return expression.value;
        
      case 'indicator': {
        const indicatorResult = context.indicators.get(expression.indicatorId);
        if (!indicatorResult) {
          throw new ConditionEvaluationError(
            `Indicator ${expression.indicatorId} not found in context`,
            'indicator_value',
            'MISSING_INDICATOR',
            context
          );
        }
        
        // Handle offset and field extraction
        const value = this.extractIndicatorValue(indicatorResult, expression.field, expression.offset);
        
        // Handle aggregation if specified
        if (expression.aggregation && expression.aggregationPeriods) {
          return this.applyAggregation(value, expression.aggregation, expression.aggregationPeriods);
        }
        
        return value;
      }
      
      case 'market': {
        const marketData = context.marketData;
        
        if (expression.offset === 0) {
          return marketData.current[expression.field];
        }
        
        if (expression.offset > 0 && expression.offset <= marketData.history.length) {
          const historicalIndex = marketData.history.length - expression.offset;
          return marketData.history[historicalIndex][expression.field];
        }
        
        throw new ConditionEvaluationError(
          `Market data offset ${expression.offset} is out of range`,
          'market_value',
          'INVALID_OFFSET',
          context
        );
      }
      
      case 'calculated': {
        const calculatedResult = await this.evaluateMathematicalCondition(expression.expression, context);
        return calculatedResult.value;
      }
      
      case 'variable': {
        const variableMap = expression.scope === 'session' ? context.sessionData :
          expression.scope === 'strategy' ? context.strategyData :
          context.variables;
        
        return variableMap.get(expression.name) ?? expression.defaultValue;
      }
      
      case 'function': {
        const func = this.builtInFunctions.getFunction(expression.name);
        if (!func) {
          throw new ConditionEvaluationError(
            `Unknown function: ${expression.name}`,
            'function_value',
            'UNKNOWN_FUNCTION',
            context
          );
        }
        
        const parameterValues = await Promise.all(
          expression.parameters.map(param => this.evaluateValueExpression(param, context))
        );
        
        return func.implementation(...parameterValues);
      }
      
      default:
        throw new ConditionEvaluationError(
          `Unknown value expression type: ${(expression as any).type}`,
          'value_expression',
          'UNKNOWN_EXPRESSION_TYPE',
          context
        );
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private compareNumbers(left: number, right: number, tolerance: number): number {
    if (Math.abs(left - right) <= tolerance) {
      return 0;
    }
    return left < right ? -1 : 1;
  }

  private isEqual(left: ConditionValue, right: ConditionValue, tolerance: number): boolean {
    if (left === right) return true;
    if (left === null || right === null || left === undefined || right === undefined) {
      return false;
    }
    
    if (typeof left === 'number' && typeof right === 'number') {
      return Math.abs(left - right) <= tolerance;
    }
    
    return String(left) === String(right);
  }

  private extractIndicatorValue(
    indicatorResult: any,
    field: string,
    offset: number
  ): ConditionValue {
    // Handle array-based results
    if (Array.isArray(indicatorResult.values)) {
      const index = Math.max(0, indicatorResult.values.length - 1 - offset);
      const value = indicatorResult.values[index];
      
      if (typeof value === 'object' && value && field in value) {
        return value[field];
      }
      
      return field === 'value' ? value : null;
    }
    
    // Handle object-based results
    if (typeof indicatorResult === 'object' && indicatorResult && field in indicatorResult) {
      return indicatorResult[field];
    }
    
    // Handle direct values
    return field === 'value' ? indicatorResult : null;
  }

  private applyAggregation(
    value: any,
    aggregation: string,
    periods: number
  ): number {
    if (!Array.isArray(value)) {
      return Number(value) || 0;
    }
    
    const data = value.slice(-periods).map(v => Number(v) || 0);
    
    switch (aggregation) {
      case 'avg':
        return data.reduce((sum, v) => sum + v, 0) / data.length;
      case 'max':
        return Math.max(...data);
      case 'min':
        return Math.min(...data);
      case 'sum':
        return data.reduce((sum, v) => sum + v, 0);
      case 'first':
        return data[0] || 0;
      case 'last':
        return data[data.length - 1] || 0;
      default:
        return Number(value) || 0;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private createTimeoutPromise(conditionId: string, timeoutMs: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new ConditionTimeoutError(
        `Condition evaluation timed out after ${timeoutMs}ms`,
        conditionId,
        timeoutMs
      )), timeoutMs)
    );
  }

  private updatePerformanceMetrics(
    conditionId: string,
    executionTime: number,
    success: boolean,
    fromCache: boolean
  ): void {
    let metrics = this.performanceMetrics.get(conditionId);
    
    if (!metrics) {
      metrics = {
        conditionId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: Infinity,
        cacheHitRate: 0,
        shortCircuitRate: 0,
        lastExecuted: new Date(),
        memoryUsage: 0
      };
      this.performanceMetrics.set(conditionId, metrics);
    }
    
    metrics.totalExecutions++;
    metrics.lastExecuted = new Date();
    
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }
    
    // Update execution time metrics
    const totalTime = metrics.averageExecutionTime * (metrics.totalExecutions - 1) + executionTime;
    metrics.averageExecutionTime = totalTime / metrics.totalExecutions;
    metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime);
    metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime);
    
    // Update cache hit rate (simplified)
    if (fromCache) {
      const cacheHits = metrics.cacheHitRate * metrics.totalExecutions + 1;
      metrics.cacheHitRate = cacheHits / (metrics.totalExecutions + 1);
    }
  }

  private mergeDefaultConfig(config: Partial<ConditionEngineConfig>): ConditionEngineConfig {
    return {
      execution: {
        defaultTimeout: config.execution?.defaultTimeout ?? 5000,
        maxConcurrency: config.execution?.maxConcurrency ?? 10,
        enableShortCircuit: config.execution?.enableShortCircuit ?? true,
        enableCaching: config.execution?.enableCaching ?? true
      },
      
      validation: {
        strictTypeChecking: config.validation?.strictTypeChecking ?? true,
        allowedFunctions: config.validation?.allowedFunctions ?? [],
        maxNestingDepth: config.validation?.maxNestingDepth ?? 10,
        maxComplexity: config.validation?.maxComplexity ?? 100
      },
      
      performance: {
        enableProfiling: config.performance?.enableProfiling ?? true,
        slowExecutionThreshold: config.performance?.slowExecutionThreshold ?? 1000,
        maxMemoryUsage: config.performance?.maxMemoryUsage ?? 256 * 1024 * 1024
      },
      
      crossover: {
        defaultLookbackPeriods: config.crossover?.defaultLookbackPeriods ?? 20,
        defaultConfirmationPeriods: config.crossover?.defaultConfirmationPeriods ?? 1,
        minimumDataPoints: config.crossover?.minimumDataPoints ?? 10,
        tolerancePercent: config.crossover?.tolerancePercent ?? 0.1
      },
      
      patterns: {
        enableAdvancedPatterns: config.patterns?.enableAdvancedPatterns ?? true,
        defaultConfidence: config.patterns?.defaultConfidence ?? 0.7,
        maxPatternLength: config.patterns?.maxPatternLength ?? 50
      },
      
      cache: {
        enabled: config.cache?.enabled ?? true,
        maxSize: config.cache?.maxSize ?? 1000,
        ttlSeconds: config.cache?.ttlSeconds ?? 300,
        compressionEnabled: config.cache?.compressionEnabled ?? false
      }
    };
  }

  private setupEventHandlers(): void {
    this.cache.on('eviction', (data) => {
      this.emit('cacheEviction', data);
    });
    
    this.profiler.on('slowExecution', (data) => {
      this.emit('slowExecution', data);
    });
  }

  private startBackgroundProcessing(): void {
    // Reduce frequency and only run when engine is active
    this.backgroundInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      // Only process queue if there are pending evaluations
      if (this.activeEvaluations === 0 && this.evaluationQueue.length > 0) {
        const batch = this.evaluationQueue.splice(0, Math.min(this.config.execution.maxConcurrency, 5));
        batch.forEach(async ({ conditions, context, resolve, reject }) => {
          try {
            const result = await this.evaluateBatch(conditions, context);
            resolve(result);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }
      
      // Cleanup old metrics less frequently
      if (Math.random() < 0.1) { // 10% chance each interval
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
        for (const [id, metrics] of this.performanceMetrics.entries()) {
          if (metrics.lastExecuted.getTime() < cutoffTime) {
            this.performanceMetrics.delete(id);
          }
        }
      }
    }, 5000); // Every 5 seconds instead of 1
  }

  // =============================================================================
  // PUBLIC API - ENGINE MANAGEMENT
  // =============================================================================

  /**
   * Get engine performance snapshot
   */
  getPerformanceSnapshot(): EnginePerformanceSnapshot {
    const now = new Date();
    const recentEvaluations = Array.from(this.performanceMetrics.values())
      .filter(m => now.getTime() - m.lastExecuted.getTime() < 60000); // Last minute
    
    const totalExecutions = recentEvaluations.reduce((sum, m) => sum + m.totalExecutions, 0);
    const successfulExecutions = recentEvaluations.reduce((sum, m) => sum + m.successfulExecutions, 0);
    const failedExecutions = recentEvaluations.reduce((sum, m) => sum + m.failedExecutions, 0);
    
    return {
      timestamp: now,
      totalConditions: this.performanceMetrics.size,
      activeEvaluations: this.activeEvaluations,
      queuedEvaluations: this.evaluationQueue.length,
      
      performance: {
        evaluationsPerSecond: totalExecutions / 60, // Rough estimate
        averageLatency: recentEvaluations.reduce((sum, m) => sum + m.averageExecutionTime, 0) / Math.max(recentEvaluations.length, 1),
        p95Latency: 0, // Would need proper histogram for accurate calculation
        p99Latency: 0,
        successRate: successfulExecutions / Math.max(totalExecutions, 1)
      },
      
      resource: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: 0, // Would need process monitoring
        cacheSize: this.cache.size(),
        cacheHitRate: this.cache.getHitRate()
      },
      
      errors: {
        totalErrors: failedExecutions,
        errorRate: failedExecutions / Math.max(totalExecutions, 1),
        commonErrors: [] // Would need error categorization
      }
    };
  }

  /**
   * Get condition performance metrics
   */
  getConditionMetrics(conditionId: string): ConditionPerformanceMetrics | undefined {
    return this.performanceMetrics.get(conditionId);
  }

  /**
   * Clear all performance metrics
   */
  clearMetrics(): void {
    this.performanceMetrics.clear();
    this.totalEvaluations = 0;
    this.successfulEvaluations = 0;
    this.failedEvaluations = 0;
  }

  /**
   * Start the evaluation engine
   */
  start(): void {
    this.isRunning = true;
    this.emit('started');
  }

  /**
   * Stop the evaluation engine
   */
  stop(): void {
    this.isRunning = false;
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = undefined;
    }
    this.emit('stopped');
  }
}

export default ConditionEvaluationEngine;