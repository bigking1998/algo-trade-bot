/**
 * Condition Validator - Task BE-013
 * 
 * Comprehensive validation system for condition expressions with:
 * - Type safety validation
 * - Dependency cycle detection  
 * - Complexity analysis
 * - Security validation for custom conditions
 * - Performance impact assessment
 */

import type { 
  ConditionExpression,
  ValueExpression,
  LogicalCondition,
  ComparisonCondition,
  MathematicalCondition,
  CrossOverCondition,
  PatternCondition,
  TimeBasedCondition,
  CustomCondition
} from './types.js';
import {
  LogicalOperator,
  ComparisonOperator,
  MathematicalOperator
} from './types.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  complexity: number; // 0-100 complexity score
  estimatedLatency: number; // estimated ms
  securityRisk: 'low' | 'medium' | 'high';
  dependencies: string[]; // List of required indicators/variables
}

export interface ValidationConfig {
  strictTypeChecking: boolean;
  allowedFunctions: string[];
  maxNestingDepth: number;
  maxComplexity: number;
}

/**
 * ConditionValidator - Validates condition expressions for safety and correctness
 */
export class ConditionValidator {
  private readonly config: ValidationConfig;
  private readonly builtInFunctions = new Set([
    // Math functions
    'abs', 'ceil', 'floor', 'round', 'max', 'min', 'pow', 'sqrt', 'log',
    // Statistical functions  
    'mean', 'median', 'std', 'variance', 'correlation', 'sma', 'ema',
    // Array functions
    'sum', 'count', 'first', 'last', 'slice', 'sort',
    // Time functions
    'hour', 'minute', 'dayOfWeek', 'isWeekend', 'isMarketHours',
    // Technical functions
    'highest', 'lowest', 'crossover', 'crossunder', 'change', 'percentChange'
  ]);

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  /**
   * Validate complete condition expression
   */
  async validateCondition(condition: ConditionExpression): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      complexity: 0,
      estimatedLatency: 0,
      securityRisk: 'low',
      dependencies: []
    };

    try {
      // Basic structure validation
      this.validateBasicStructure(condition, result);
      
      // Type-specific validation
      await this.validateByType(condition, result, 0);
      
      // Dependency analysis
      this.analyzeDependencies(condition, result);
      
      // Complexity analysis
      this.analyzeComplexity(condition, result);
      
      // Security analysis
      this.analyzeSecurityRisks(condition, result);
      
      // Performance estimation
      this.estimatePerformance(condition, result);
      
      // Final validation
      result.isValid = result.errors.length === 0;
      
      return result;

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Validate basic condition structure
   */
  private validateBasicStructure(condition: ConditionExpression, result: ValidationResult): void {
    // Required fields
    if (!condition.id || condition.id.trim() === '') {
      result.errors.push('Condition ID is required');
    }

    if (!condition.name || condition.name.trim() === '') {
      result.errors.push('Condition name is required');
    }

    if (!condition.type) {
      result.errors.push('Condition type is required');
    }

    if (typeof condition.enabled !== 'boolean') {
      result.errors.push('Condition enabled flag must be boolean');
    }

    if (typeof condition.weight !== 'number' || condition.weight < 0 || condition.weight > 1) {
      result.errors.push('Condition weight must be a number between 0 and 1');
    }

    // Validate metadata
    if (condition.metadata && typeof condition.metadata !== 'object') {
      result.errors.push('Condition metadata must be an object');
    }

    // Validate timestamps
    if (!(condition.created instanceof Date)) {
      result.errors.push('Condition created timestamp must be a Date');
    }

    if (!(condition.updated instanceof Date)) {
      result.errors.push('Condition updated timestamp must be a Date');
    }
  }

  /**
   * Validate condition by specific type
   */
  private async validateByType(
    condition: ConditionExpression, 
    result: ValidationResult, 
    depth: number
  ): Promise<void> {
    
    // Check nesting depth
    if (depth > this.config.maxNestingDepth) {
      result.errors.push(`Maximum nesting depth ${this.config.maxNestingDepth} exceeded`);
      return;
    }

    switch (condition.type) {
      case 'logical':
        this.validateLogicalCondition(condition, result, depth);
        break;
        
      case 'comparison':
        await this.validateComparisonCondition(condition, result, depth);
        break;
        
      case 'mathematical':
        await this.validateMathematicalCondition(condition, result, depth);
        break;
        
      case 'crossover':
        await this.validateCrossOverCondition(condition, result, depth);
        break;
        
      case 'pattern':
        this.validatePatternCondition(condition, result, depth);
        break;
        
      case 'time':
        await this.validateTimeBasedCondition(condition, result, depth);
        break;
        
      case 'custom':
        this.validateCustomCondition(condition, result, depth);
        break;
        
      default:
        result.errors.push(`Unknown condition type: ${(condition as any).type}`);
    }
  }

  /**
   * Validate logical condition
   */
  private validateLogicalCondition(
    condition: LogicalCondition, 
    result: ValidationResult, 
    depth: number
  ): void {
    
    // Validate operator
    if (!Object.values(LogicalOperator).includes(condition.operator)) {
      result.errors.push(`Invalid logical operator: ${condition.operator}`);
    }

    // Validate conditions array
    if (!Array.isArray(condition.conditions)) {
      result.errors.push('Logical condition must have conditions array');
      return;
    }

    if (condition.conditions.length === 0) {
      result.errors.push('Logical condition must have at least one sub-condition');
      return;
    }

    // Operator-specific validation
    switch (condition.operator) {
      case LogicalOperator.NOT:
        if (condition.conditions.length !== 1) {
          result.errors.push('NOT operator requires exactly one condition');
        }
        break;
        
      case LogicalOperator.XOR:
        if (condition.conditions.length !== 2) {
          result.errors.push('XOR operator requires exactly two conditions');
        }
        break;
        
      case LogicalOperator.AND:
      case LogicalOperator.OR:
        if (condition.conditions.length < 2) {
          result.errors.push(`${condition.operator} operator requires at least two conditions`);
        }
        break;
    }

    // Recursively validate sub-conditions
    condition.conditions.forEach(async (subCondition) => {
      await this.validateByType(subCondition, result, depth + 1);
    });

    // Check for potential circular references
    this.checkCircularReferences(condition, result, new Set([condition.id]));
  }

  /**
   * Validate comparison condition
   */
  private async validateComparisonCondition(
    condition: ComparisonCondition, 
    result: ValidationResult, 
    depth: number
  ): Promise<void> {
    
    // Validate operator
    if (!Object.values(ComparisonOperator).includes(condition.operator)) {
      result.errors.push(`Invalid comparison operator: ${condition.operator}`);
    }

    // Validate operands
    if (!condition.left) {
      result.errors.push('Comparison condition missing left operand');
    } else {
      await this.validateValueExpression(condition.left, result, depth + 1);
    }

    if (!condition.right) {
      result.errors.push('Comparison condition missing right operand');
    } else {
      await this.validateValueExpression(condition.right, result, depth + 1);
    }

    // Validate tolerance if specified
    if (condition.tolerance !== undefined) {
      if (typeof condition.tolerance !== 'number' || condition.tolerance < 0) {
        result.errors.push('Comparison tolerance must be a non-negative number');
      }
    }

    // Type compatibility warning
    if (this.config.strictTypeChecking && condition.left && condition.right) {
      const leftType = this.inferValueExpressionType(condition.left);
      const rightType = this.inferValueExpressionType(condition.right);
      
      if (leftType !== rightType && leftType !== 'unknown' && rightType !== 'unknown') {
        result.warnings.push(
          `Type mismatch in comparison: ${leftType} vs ${rightType}. ` +
          'Consider explicit type conversion.'
        );
      }
    }
  }

  /**
   * Validate mathematical condition
   */
  private async validateMathematicalCondition(
    condition: MathematicalCondition, 
    result: ValidationResult, 
    depth: number
  ): Promise<void> {
    
    // Validate operator
    if (!Object.values(MathematicalOperator).includes(condition.operator)) {
      result.errors.push(`Invalid mathematical operator: ${condition.operator}`);
    }

    // Validate operands
    if (!Array.isArray(condition.operands) || condition.operands.length === 0) {
      result.errors.push('Mathematical condition must have operands array with at least one operand');
      return;
    }

    // Operator-specific validation
    switch (condition.operator) {
      case MathematicalOperator.DIVIDE:
      case MathematicalOperator.MODULO:
        if (condition.operands.length < 2) {
          result.errors.push(`${condition.operator} operator requires at least 2 operands`);
        }
        // Check for potential division by zero in literal values
        if (condition.operands.length >= 2) {
          const divisor = condition.operands[1];
          if (divisor.type === 'literal' && Number(divisor.value) === 0) {
            result.errors.push(`Division by zero detected in ${condition.operator} operation`);
          }
        }
        break;
        
      case MathematicalOperator.POWER:
        if (condition.operands.length !== 2) {
          result.errors.push('POWER operator requires exactly 2 operands');
        }
        break;
        
      case MathematicalOperator.ADD:
      case MathematicalOperator.SUBTRACT:
      case MathematicalOperator.MULTIPLY:
        if (condition.operands.length < 2) {
          result.errors.push(`${condition.operator} operator requires at least 2 operands`);
        }
        break;
    }

    // Validate each operand
    for (const operand of condition.operands) {
      await this.validateValueExpression(operand, result, depth + 1);
      
      // Ensure operands can be converted to numbers
      const operandType = this.inferValueExpressionType(operand);
      if (operandType !== 'number' && operandType !== 'unknown') {
        result.warnings.push(
          `Mathematical operand has type ${operandType}, will be coerced to number`
        );
      }
    }

    // Validate result variable name if specified
    if (condition.resultVariable) {
      if (typeof condition.resultVariable !== 'string' || 
          !condition.resultVariable.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        result.errors.push('Result variable name must be a valid identifier');
      }
    }
  }

  /**
   * Validate crossover condition
   */
  private async validateCrossOverCondition(
    condition: CrossOverCondition, 
    result: ValidationResult, 
    depth: number
  ): Promise<void> {
    
    // Validate crossover type
    const validTypes = ['GOLDEN_CROSS', 'DEATH_CROSS', 'PRICE_ABOVE', 'PRICE_BELOW', 
                       'INDICATOR_CROSS_UP', 'INDICATOR_CROSS_DOWN', 'BREAKOUT_UP', 'BREAKOUT_DOWN'];
    
    if (!validTypes.includes(condition.crossOverType)) {
      result.errors.push(`Invalid crossover type: ${condition.crossOverType}`);
    }

    // Validate source and reference
    if (!condition.source) {
      result.errors.push('CrossOver condition missing source expression');
    } else {
      await this.validateValueExpression(condition.source, result, depth + 1);
    }

    if (!condition.reference) {
      result.errors.push('CrossOver condition missing reference expression');
    } else {
      await this.validateValueExpression(condition.reference, result, depth + 1);
    }

    // Validate numeric parameters
    if (typeof condition.lookbackPeriods !== 'number' || condition.lookbackPeriods < 1) {
      result.errors.push('Lookback periods must be a positive number');
    } else if (condition.lookbackPeriods > 500) {
      result.warnings.push('Very large lookback period may impact performance');
    }

    if (typeof condition.confirmationPeriods !== 'number' || condition.confirmationPeriods < 0) {
      result.errors.push('Confirmation periods must be a non-negative number');
    }

    if (condition.minimumThreshold !== undefined) {
      if (typeof condition.minimumThreshold !== 'number' || condition.minimumThreshold < 0) {
        result.errors.push('Minimum threshold must be a non-negative number');
      }
    }

    // Performance warnings
    if (condition.lookbackPeriods > 100) {
      result.warnings.push('Large lookback period may increase computation time');
    }
  }

  /**
   * Validate pattern condition
   */
  private validatePatternCondition(
    condition: PatternCondition, 
    result: ValidationResult, 
    depth: number
  ): void {
    
    // Validate pattern type
    const validPatterns = ['HIGHER_HIGHS', 'LOWER_LOWS', 'DOUBLE_TOP', 'DOUBLE_BOTTOM',
                          'HEAD_SHOULDERS', 'INVERSE_HEAD_SHOULDERS', 'ASCENDING_TRIANGLE',
                          'DESCENDING_TRIANGLE', 'SYMMETRICAL_TRIANGLE'];
    
    if (!validPatterns.includes(condition.patternType)) {
      result.errors.push(`Invalid pattern type: ${condition.patternType}`);
    }

    // Validate source
    if (!condition.source) {
      result.errors.push('Pattern condition missing source expression');
    } else {
      this.validateValueExpression(condition.source, result, depth + 1);
    }

    // Validate numeric parameters
    if (typeof condition.lookbackPeriods !== 'number' || condition.lookbackPeriods < 5) {
      result.errors.push('Pattern lookback periods must be at least 5');
    } else if (condition.lookbackPeriods > 200) {
      result.warnings.push('Very large lookback period may impact performance');
    }

    if (typeof condition.confidence !== 'number' || condition.confidence < 0 || condition.confidence > 1) {
      result.errors.push('Pattern confidence must be between 0 and 1');
    }

    // Validate parameters object
    if (condition.parameters && typeof condition.parameters !== 'object') {
      result.errors.push('Pattern parameters must be an object');
    }
  }

  /**
   * Validate time-based condition
   */
  private async validateTimeBasedCondition(
    condition: TimeBasedCondition, 
    result: ValidationResult, 
    depth: number
  ): Promise<void> {
    
    // Validate timeframe
    if (typeof condition.timeframe !== 'string' || !condition.timeframe.match(/^\d+[smhd]$/)) {
      result.errors.push('Invalid timeframe format. Use format like "1m", "5m", "1h", "1d"');
    }

    // Validate time range
    if (condition.startTime && !condition.startTime.match(/^\d{2}:\d{2}$/)) {
      result.errors.push('Start time must be in HH:MM format');
    }

    if (condition.endTime && !condition.endTime.match(/^\d{2}:\d{2}$/)) {
      result.errors.push('End time must be in HH:MM format');
    }

    // Validate days of week
    if (condition.daysOfWeek && Array.isArray(condition.daysOfWeek)) {
      for (const day of condition.daysOfWeek) {
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          result.errors.push('Days of week must be integers 0-6 (Sunday=0)');
          break;
        }
      }
    }

    // Validate timezone
    if (!condition.timezone || typeof condition.timezone !== 'string') {
      result.errors.push('Timezone is required and must be a string');
    }

    // Validate nested condition
    if (!condition.condition) {
      result.errors.push('Time-based condition missing nested condition');
    } else {
      await this.validateByType(condition.condition, result, depth + 1);
    }
  }

  /**
   * Validate custom condition
   */
  private validateCustomCondition(
    condition: CustomCondition, 
    result: ValidationResult, 
    depth: number
  ): void {
    
    // Validate function code
    if (!condition.functionCode || typeof condition.functionCode !== 'string') {
      result.errors.push('Custom condition must have function code');
      return;
    }

    // Basic syntax validation
    try {
      new Function('parameters', 'context', condition.functionCode);
    } catch (error) {
      result.errors.push(`Custom condition has invalid JavaScript syntax: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Security analysis
    result.securityRisk = 'high'; // Custom code is always high risk
    
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /process\./,
      /global\./,
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout/,
      /setInterval/,
      /fetch\s*\(/,
      /XMLHttpRequest/,
      /localStorage/,
      /sessionStorage/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(condition.functionCode)) {
        result.errors.push('Custom condition contains potentially dangerous code patterns');
        break;
      }
    }

    // Validate parameters
    if (condition.parameters && typeof condition.parameters !== 'object') {
      result.errors.push('Custom condition parameters must be an object');
    }

    // Validate timeout
    if (typeof condition.timeout !== 'number' || condition.timeout < 100 || condition.timeout > 10000) {
      result.errors.push('Custom condition timeout must be between 100 and 10000 ms');
    }

    // Validate sandbox setting
    if (typeof condition.sandbox !== 'boolean') {
      result.errors.push('Custom condition sandbox flag must be boolean');
    }

    if (!condition.sandbox) {
      result.warnings.push('Custom condition not sandboxed - security risk');
    }
  }

  /**
   * Validate value expression
   */
  private async validateValueExpression(
    expression: ValueExpression, 
    result: ValidationResult, 
    depth: number
  ): Promise<void> {
    
    if (depth > this.config.maxNestingDepth) {
      result.errors.push(`Value expression nesting depth ${this.config.maxNestingDepth} exceeded`);
      return;
    }

    switch (expression.type) {
      case 'literal':
        this.validateLiteralValue(expression, result);
        break;
        
      case 'indicator':
        this.validateIndicatorValue(expression, result);
        break;
        
      case 'market':
        this.validateMarketValue(expression, result);
        break;
        
      case 'calculated':
        await this.validateMathematicalCondition(expression.expression, result, depth + 1);
        break;
        
      case 'variable':
        this.validateVariableValue(expression, result);
        break;
        
      case 'function':
        this.validateFunctionValue(expression, result, depth);
        break;
        
      default:
        result.errors.push(`Unknown value expression type: ${(expression as any).type}`);
    }
  }

  private validateLiteralValue(expression: any, result: ValidationResult): void {
    if (expression.value === undefined || expression.value === null) {
      result.warnings.push('Literal value is null or undefined');
    }

    const validTypes = ['number', 'string', 'boolean'];
    if (!validTypes.includes(expression.dataType)) {
      result.errors.push(`Invalid literal data type: ${expression.dataType}`);
    }
  }

  private validateIndicatorValue(expression: any, result: ValidationResult): void {
    if (!expression.indicatorId || typeof expression.indicatorId !== 'string') {
      result.errors.push('Indicator value must have valid indicator ID');
    } else {
      result.dependencies.push(expression.indicatorId);
    }

    if (!expression.field || typeof expression.field !== 'string') {
      result.errors.push('Indicator value must specify field');
    }

    if (typeof expression.offset !== 'number' || expression.offset < 0) {
      result.errors.push('Indicator offset must be non-negative number');
    } else if (expression.offset > 1000) {
      result.warnings.push('Very large indicator offset may impact performance');
    }

    if (expression.aggregation) {
      const validAggregations = ['avg', 'max', 'min', 'sum', 'first', 'last'];
      if (!validAggregations.includes(expression.aggregation)) {
        result.errors.push(`Invalid aggregation method: ${expression.aggregation}`);
      }

      if (typeof expression.aggregationPeriods !== 'number' || expression.aggregationPeriods < 1) {
        result.errors.push('Aggregation periods must be positive number');
      }
    }
  }

  private validateMarketValue(expression: any, result: ValidationResult): void {
    const validFields = ['open', 'high', 'low', 'close', 'volume'];
    if (!validFields.includes(expression.field)) {
      result.errors.push(`Invalid market data field: ${expression.field}`);
    }

    if (typeof expression.offset !== 'number' || expression.offset < 0) {
      result.errors.push('Market data offset must be non-negative number');
    }

    if (expression.symbol && typeof expression.symbol !== 'string') {
      result.errors.push('Market data symbol must be string');
    }

    if (expression.timeframe && !expression.timeframe.match(/^\d+[smhd]$/)) {
      result.errors.push('Invalid market data timeframe format');
    }
  }

  private validateVariableValue(expression: any, result: ValidationResult): void {
    if (!expression.name || typeof expression.name !== 'string') {
      result.errors.push('Variable value must have name');
    }

    const validScopes = ['session', 'strategy', 'global'];
    if (!validScopes.includes(expression.scope)) {
      result.errors.push(`Invalid variable scope: ${expression.scope}`);
    }
  }

  private validateFunctionValue(expression: any, result: ValidationResult, depth: number): void {
    if (!expression.name || typeof expression.name !== 'string') {
      result.errors.push('Function value must have name');
      return;
    }

    // Check if function is allowed
    const isBuiltIn = this.builtInFunctions.has(expression.name);
    const isAllowed = this.config.allowedFunctions.includes(expression.name);
    
    if (!isBuiltIn && !isAllowed) {
      result.errors.push(`Function '${expression.name}' is not allowed or unknown`);
    }

    if (!Array.isArray(expression.parameters)) {
      result.errors.push('Function parameters must be array');
      return;
    }

    // Recursively validate parameters
    expression.parameters.forEach(async (param: ValueExpression) => {
      await this.validateValueExpression(param, result, depth + 1);
    });

    const validReturnTypes = ['number', 'string', 'boolean', 'array'];
    if (!validReturnTypes.includes(expression.returnType)) {
      result.errors.push(`Invalid function return type: ${expression.returnType}`);
    }
  }

  /**
   * Analyze condition dependencies
   */
  private analyzeDependencies(condition: ConditionExpression, result: ValidationResult): void {
    // Dependencies are collected during validation
    result.dependencies = [...new Set(result.dependencies)]; // Remove duplicates
  }

  /**
   * Analyze condition complexity
   */
  private analyzeComplexity(condition: ConditionExpression, result: ValidationResult): void {
    let complexity = this.calculateConditionComplexity(condition);
    
    result.complexity = Math.min(100, complexity);
    
    if (complexity > this.config.maxComplexity) {
      result.errors.push(`Condition complexity ${complexity} exceeds maximum ${this.config.maxComplexity}`);
    } else if (complexity > this.config.maxComplexity * 0.8) {
      result.warnings.push('High condition complexity may impact performance');
    }
  }

  private calculateConditionComplexity(condition: ConditionExpression): number {
    let complexity = 1; // Base complexity

    switch (condition.type) {
      case 'logical':
        const logicalCondition = condition as LogicalCondition;
        complexity += logicalCondition.conditions.length * 2;
        logicalCondition.conditions.forEach(subCondition => {
          complexity += this.calculateConditionComplexity(subCondition);
        });
        break;

      case 'comparison':
        complexity += 3;
        break;

      case 'mathematical':
        const mathCondition = condition as MathematicalCondition;
        complexity += mathCondition.operands.length;
        break;

      case 'crossover':
        const crossCondition = condition as CrossOverCondition;
        complexity += 5 + (crossCondition.lookbackPeriods / 10);
        break;

      case 'pattern':
        const patternCondition = condition as PatternCondition;
        complexity += 8 + (patternCondition.lookbackPeriods / 5);
        break;

      case 'time':
        complexity += 2;
        const timeCondition = condition as TimeBasedCondition;
        complexity += this.calculateConditionComplexity(timeCondition.condition);
        break;

      case 'custom':
        complexity += 15; // Custom conditions are inherently complex
        break;
    }

    return complexity;
  }

  /**
   * Analyze security risks
   */
  private analyzeSecurityRisks(condition: ConditionExpression, result: ValidationResult): void {
    if (condition.type === 'custom') {
      result.securityRisk = 'high';
      return;
    }

    // Check for potential security issues in other condition types
    let riskLevel = 0;

    if (condition.type === 'time' && (condition as TimeBasedCondition).condition.type === 'custom') {
      riskLevel += 3;
    }

    // Add more security risk analysis as needed
    
    result.securityRisk = riskLevel >= 3 ? 'high' : riskLevel >= 1 ? 'medium' : 'low';
  }

  /**
   * Estimate condition performance impact
   */
  private estimatePerformance(condition: ConditionExpression, result: ValidationResult): void {
    let latency = 0; // Base latency in ms

    switch (condition.type) {
      case 'logical':
        const logicalCondition = condition as LogicalCondition;
        latency += logicalCondition.conditions.length * 0.1;
        break;

      case 'comparison':
        latency += 0.05;
        break;

      case 'mathematical':
        const mathCondition = condition as MathematicalCondition;
        latency += mathCondition.operands.length * 0.02;
        break;

      case 'crossover':
        const crossCondition = condition as CrossOverCondition;
        latency += 0.5 + (crossCondition.lookbackPeriods * 0.01);
        break;

      case 'pattern':
        const patternCondition = condition as PatternCondition;
        latency += 2 + (patternCondition.lookbackPeriods * 0.02);
        break;

      case 'time':
        latency += 0.1;
        break;

      case 'custom':
        latency += 5; // Custom conditions are slow
        break;
    }

    result.estimatedLatency = latency;

    if (latency > 10) {
      result.warnings.push('Condition may have significant performance impact');
    }
  }

  /**
   * Infer value expression type
   */
  private inferValueExpressionType(expression: ValueExpression): string {
    switch (expression.type) {
      case 'literal':
        return (expression as any).dataType;
      case 'indicator':
      case 'market':
        return 'number';
      case 'calculated':
        return 'number';
      case 'variable':
        return 'unknown';
      case 'function':
        return (expression as any).returnType;
      default:
        return 'unknown';
    }
  }

  /**
   * Check for circular references in logical conditions
   */
  private checkCircularReferences(
    condition: LogicalCondition, 
    result: ValidationResult, 
    visitedIds: Set<string>
  ): void {
    
    for (const subCondition of condition.conditions) {
      if (visitedIds.has(subCondition.id)) {
        result.errors.push(`Circular reference detected involving condition: ${subCondition.id}`);
        return;
      }

      if (subCondition.type === 'logical') {
        const newVisited = new Set(visitedIds);
        newVisited.add(subCondition.id);
        this.checkCircularReferences(subCondition as LogicalCondition, result, newVisited);
      }
    }
  }
}

export default ConditionValidator;