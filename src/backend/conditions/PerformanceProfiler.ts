/**
 * Performance Profiler - Task BE-013
 * 
 * Performance monitoring and profiling for condition evaluation with:
 * - Execution time tracking
 * - Memory usage monitoring
 * - Bottleneck identification
 * - Performance alerts
 */

import { EventEmitter } from 'events';

export interface PerformanceConfig {
  enableProfiling: boolean;
  slowExecutionThreshold: number;
  maxMemoryUsage: number;
}

export class PerformanceProfiler extends EventEmitter {
  private readonly config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    super();
    this.config = config;
  }

  profileExecution<T>(name: string, fn: () => T): T {
    if (!this.config.enableProfiling) {
      return fn();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = fn();
      const executionTime = performance.now() - startTime;

      if (executionTime > this.config.slowExecutionThreshold) {
        this.emit('slowExecution', {
          name,
          executionTime,
          threshold: this.config.slowExecutionThreshold
        });
      }

      return result;
    } finally {
      const endMemory = process.memoryUsage().heapUsed;
      const memoryDelta = endMemory - startMemory;
      
      if (memoryDelta > this.config.maxMemoryUsage * 0.1) {
        this.emit('highMemoryUsage', {
          name,
          memoryDelta,
          currentMemory: endMemory
        });
      }
    }
  }
}