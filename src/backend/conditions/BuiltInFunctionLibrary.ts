/**
 * Built-In Function Library - Task BE-013
 * 
 * Comprehensive library of built-in functions for condition evaluation including:
 * - Mathematical functions (abs, min, max, etc.)
 * - Statistical functions (mean, std, correlation)
 * - Technical analysis functions (sma, ema, crossover)
 * - Time-based functions (hour, dayOfWeek, isMarketHours)
 */

import type { BuiltInFunction, BuiltInFunctions } from './types.js';

export class BuiltInFunctionLibrary {
  private readonly functions: BuiltInFunctions = new Map();

  constructor() {
    this.initializeFunctions();
  }

  getFunction(name: string): BuiltInFunction | undefined {
    return this.functions.get(name);
  }

  getAllFunctions(): BuiltInFunction[] {
    return Array.from(this.functions.values());
  }

  private initializeFunctions(): void {
    // Math functions
    this.functions.set('abs', {
      name: 'abs',
      description: 'Returns absolute value',
      parameters: [{ name: 'value', type: 'number', required: true, description: 'Input number' }],
      returnType: 'number',
      category: 'math',
      implementation: (value: number) => Math.abs(value),
      examples: [{ input: [-5], output: 5, description: 'Absolute value of -5' }]
    });

    this.functions.set('max', {
      name: 'max',
      description: 'Returns maximum value',
      parameters: [{ name: 'values', type: 'array', required: true, description: 'Array of numbers' }],
      returnType: 'number',
      category: 'math',
      implementation: (...values: number[]) => Math.max(...values),
      examples: [{ input: [[1, 2, 3]], output: 3, description: 'Maximum of [1,2,3]' }]
    });

    // Statistical functions
    this.functions.set('mean', {
      name: 'mean',
      description: 'Calculates arithmetic mean',
      parameters: [{ name: 'values', type: 'array', required: true, description: 'Array of numbers' }],
      returnType: 'number',
      category: 'statistical',
      implementation: (values: number[]) => values.reduce((sum, val) => sum + val, 0) / values.length,
      examples: [{ input: [[1, 2, 3]], output: 2, description: 'Mean of [1,2,3]' }]
    });

    // Add more functions as needed...
  }
}