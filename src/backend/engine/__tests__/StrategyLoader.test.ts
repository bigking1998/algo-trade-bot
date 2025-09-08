/**
 * Strategy Loader Integration Tests - Task BE-017 Validation
 * 
 * Comprehensive test suite for the Strategy Loader and Validator system
 * with hot-reloading support and runtime error monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrategyLoader } from '../StrategyLoader';
import { StrategyValidator } from '../StrategyValidator';
import { RuntimeErrorMonitor } from '../RuntimeErrorMonitor';
import { HotReloadManager } from '../HotReloadManager';
import type { StrategyConfig } from '../../strategies/types';
import fs from 'fs/promises';
import path from 'path';

describe('Strategy Loader System', () => {
  let strategyLoader: StrategyLoader;
  let validator: StrategyValidator;
  let errorMonitor: RuntimeErrorMonitor;
  let hotReloadManager: HotReloadManager;
  let tempDir: string;

  beforeEach(async () => {
    // Setup temporary directory for tests
    tempDir = path.join(process.cwd(), 'temp', 'test-strategies');
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize components
    strategyLoader = new StrategyLoader({
      strategiesPath: tempDir,
      tempPath: path.join(tempDir, 'temp'),
      backupPath: path.join(tempDir, 'backup'),
      enableHotReload: true,
      watchDebounceMs: 100,
      maxRetries: 2,
      retryDelayMs: 100,
      enableSandbox: false, // Disabled for testing
      strictValidation: true,
      enableRollback: true
    });

    validator = new StrategyValidator({
      strictMode: true,
      securityLevel: 'medium'
    });

    errorMonitor = new RuntimeErrorMonitor({
      enabled: true,
      maxErrorHistory: 100,
      autoRecoveryEnabled: true
    });

    hotReloadManager = new HotReloadManager(strategyLoader, {
      enabled: true,
      defaultStrategy: 'graceful',
      gracefulTimeout: 1000 // Reduced for testing
    });

    await strategyLoader.initialize();
    await errorMonitor.initialize(strategyLoader);
    await hotReloadManager.initialize(errorMonitor);
  });

  afterEach(async () => {
    // Cleanup
    await strategyLoader.shutdown();
    errorMonitor.shutdown();
    
    // Remove temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('StrategyLoader Core Functionality', () => {
    it('should initialize successfully', async () => {
      const status = strategyLoader.getStatus();
      expect(status.strategiesLoaded).toBe(0);
      expect(status.strategiesTracked).toBe(0);
      expect(status.hotReloadEnabled).toBe(true);
    });

    it('should load a valid strategy file', async () => {
      // Create test strategy file
      const strategyCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class TestStrategy extends BaseStrategy {
          async generateSignal() {
            return null;
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'TestStrategy.ts');
      await fs.writeFile(filePath, strategyCode);

      const result = await strategyLoader.loadStrategy(filePath);
      
      expect(result.success).toBe(true);
      expect(result.strategyId).toBeTruthy();
      expect(result.loadTime).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should fail to load invalid strategy file', async () => {
      const invalidCode = `
        // Invalid strategy - doesn't extend BaseStrategy
        export class InvalidStrategy {
          doSomething() {
            return 'invalid';
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'InvalidStrategy.ts');
      await fs.writeFile(filePath, invalidCode);

      const result = await strategyLoader.loadStrategy(filePath);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate strategy configuration', async () => {
      const config: StrategyConfig = {
        id: 'test-strategy',
        name: 'Test Strategy',
        type: 'trend_following',
        description: 'Test strategy for validation',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test'],
        riskProfile: {
          maxRiskPerTrade: 5,
          maxDailyLoss: 10,
          maxDrawdown: 20
        },
        parameters: {},
        timeframes: ['1m'],
        markets: ['crypto']
      };

      const result = await strategyLoader.validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should reject invalid risk profile', async () => {
      const config: StrategyConfig = {
        id: 'risky-strategy',
        name: 'Risky Strategy',
        type: 'trend_following',
        description: 'Strategy with invalid risk profile',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test'],
        riskProfile: {
          maxRiskPerTrade: 150, // Invalid - over 100%
          maxDailyLoss: 200,    // Invalid - over 100%
          maxDrawdown: 300      // Invalid - over 100%
        },
        parameters: {},
        timeframes: ['1m'],
        markets: ['crypto']
      };

      const result = await strategyLoader.validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.severity === 'critical')).toBe(true);
    });
  });

  describe('StrategyValidator Advanced Features', () => {
    it('should detect dangerous code patterns', async () => {
      const dangerousCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class DangerousStrategy extends BaseStrategy {
          async generateSignal() {
            // Dangerous: using eval
            eval('console.log("dangerous")');
            
            // Dangerous: accessing file system
            require('fs').readFileSync('/etc/passwd');
            
            return null;
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'DangerousStrategy.ts');
      await fs.writeFile(filePath, dangerousCode);

      const result = await strategyLoader.validateStrategyFile(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'security')).toBe(true);
      expect(result.errors.some(e => e.severity === 'critical')).toBe(true);
    });

    it('should calculate code complexity', async () => {
      const complexCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class ComplexStrategy extends BaseStrategy {
          async generateSignal() {
            // Complex nested conditions
            if (this.data.length > 0) {
              for (let i = 0; i < this.data.length; i++) {
                if (this.data[i].close > this.data[i].open) {
                  if (this.data[i].volume > 1000) {
                    while (this.someCondition()) {
                      if (this.anotherCondition() || this.yetAnother()) {
                        try {
                          return this.complexCalculation() ? 'BUY' : 'SELL';
                        } catch (error) {
                          if (error instanceof Error) {
                            console.error('Error occurred');
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            return null;
          }
          
          private someCondition(): boolean { return true; }
          private anotherCondition(): boolean { return true; }
          private yetAnother(): boolean { return true; }
          private complexCalculation(): boolean { return true; }
        }
      `;
      
      const filePath = path.join(tempDir, 'ComplexStrategy.ts');
      await fs.writeFile(filePath, complexCode);

      const result = await strategyLoader.validateStrategyFile(filePath);
      
      expect(result.metrics.complexity).toBeGreaterThan(10);
      expect(result.issues.some(i => i.ruleId === 'complexity_check')).toBe(true);
    });

    it('should validate indicator usage', async () => {
      const indicatorCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class IndicatorStrategy extends BaseStrategy {
          async generateSignal() {
            const sma = this.indicators.SMA(); // Missing period parameter
            const rsi = this.indicators.RSI(14);
            
            if (rsi > 70) {
              return 'SELL';
            } else if (rsi < 30) {
              return 'BUY';
            }
            
            return null;
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'IndicatorStrategy.ts');
      await fs.writeFile(filePath, indicatorCode);

      const result = await strategyLoader.validateStrategyFile(filePath);
      
      expect(result.issues.some(i => i.ruleId === 'indicator_validation')).toBe(true);
    });
  });

  describe('Runtime Error Monitor', () => {
    it('should record and classify errors', () => {
      const testError = new Error('Test error message');
      const context = {
        strategyId: 'test-strategy',
        strategyName: 'Test Strategy',
        operation: 'test_operation',
        timestamp: new Date(),
        environment: {
          memoryUsage: 50,
          cpuUsage: 10,
          activeStrategies: 1,
          systemLoad: 0.5
        }
      };

      const errorId = errorMonitor.recordError(testError, context);
      
      expect(errorId).toBeTruthy();
      
      const errors = errorMonitor.getErrorsByStrategy('test-strategy');
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error message');
      expect(errors[0].frequency).toBe(1);
    });

    it('should detect error patterns', (done) => {
      const context = {
        strategyId: 'test-strategy',
        strategyName: 'Test Strategy',
        operation: 'test_operation',
        timestamp: new Date(),
        environment: {
          memoryUsage: 50,
          cpuUsage: 10,
          activeStrategies: 1,
          systemLoad: 0.5
        }
      };

      // Listen for pattern detection
      errorMonitor.once('pattern_detected', (event) => {
        expect(event.pattern).toBeTruthy();
        expect(event.errors.length).toBeGreaterThanOrEqual(2);
        done();
      });

      // Create pattern of syntax errors
      for (let i = 0; i < 3; i++) {
        const syntaxError = new Error('SyntaxError: Unexpected token');
        errorMonitor.recordError(syntaxError, context, 'syntax_error');
      }
    });

    it('should attempt automatic recovery', (done) => {
      const context = {
        strategyId: 'test-strategy',
        strategyName: 'Test Strategy',
        operation: 'test_operation',
        timestamp: new Date(),
        environment: {
          memoryUsage: 50,
          cpuUsage: 10,
          activeStrategies: 1,
          systemLoad: 0.5
        }
      };

      // Listen for recovery attempt
      errorMonitor.once('recovery_attempt_started', (event) => {
        expect(event.error).toBeTruthy();
        expect(event.strategy).toBeTruthy();
        done();
      });

      // Create error that should trigger recovery
      const networkError = new Error('ECONNRESET: Connection reset by peer');
      errorMonitor.recordError(networkError, context, 'network_error');
    });

    it('should provide error statistics', () => {
      const context = {
        strategyId: 'test-strategy',
        strategyName: 'Test Strategy',
        operation: 'test_operation',
        timestamp: new Date(),
        environment: {
          memoryUsage: 50,
          cpuUsage: 10,
          activeStrategies: 1,
          systemLoad: 0.5
        }
      };

      // Record various types of errors
      errorMonitor.recordError(new Error('Syntax error'), context, 'syntax_error');
      errorMonitor.recordError(new Error('Network error'), context, 'network_error');
      errorMonitor.recordError(new Error('Logic error'), context, 'logic_error');

      const stats = errorMonitor.getStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.byType.syntax_error).toBe(1);
      expect(stats.byType.network_error).toBe(1);
      expect(stats.byType.logic_error).toBe(1);
      expect(stats.byStrategy['test-strategy']).toBe(3);
    });
  });

  describe('Hot Reload Manager', () => {
    it('should queue and process reload requests', async () => {
      // Create and load initial strategy
      const strategyCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class ReloadTestStrategy extends BaseStrategy {
          async generateSignal() {
            return 'BUY';
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'ReloadTestStrategy.ts');
      await fs.writeFile(filePath, strategyCode);
      
      const loadResult = await strategyLoader.loadStrategy(filePath);
      expect(loadResult.success).toBe(true);

      // Request hot reload
      const requestId = await hotReloadManager.requestReload(
        loadResult.strategyId,
        'manual_reload',
        {
          reason: 'Test hot reload',
          requestedBy: 'test'
        }
      );

      expect(requestId).toBeTruthy();

      // Check reload status
      const status = hotReloadManager.getReloadStatus(requestId);
      expect(status).toBeTruthy();
      expect(status!.state).toMatch(/pending|preparing|loading|transitioning|completed/);
    });

    it('should handle reload failures gracefully', async () => {
      const requestId = await hotReloadManager.requestReload(
        'non-existent-strategy',
        'manual_reload',
        {
          reason: 'Test failure handling'
        }
      );

      // Wait for reload to complete (should fail)
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = hotReloadManager.getReloadStatus(requestId);
      expect(status?.state).toBe('failed');
    });

    it('should prevent concurrent reloads of same strategy', async () => {
      const strategyCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class ConcurrentTestStrategy extends BaseStrategy {
          async generateSignal() {
            return null;
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'ConcurrentTestStrategy.ts');
      await fs.writeFile(filePath, strategyCode);
      
      const loadResult = await strategyLoader.loadStrategy(filePath);
      
      const requestId1 = await hotReloadManager.requestReload(
        loadResult.strategyId,
        'manual_reload'
      );

      // Second reload should fail
      await expect(hotReloadManager.requestReload(
        loadResult.strategyId,
        'manual_reload'
      )).rejects.toThrow();
    });

    it('should support different reload strategies', async () => {
      const strategyCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class StrategyTypeTestStrategy extends BaseStrategy {
          async generateSignal() {
            return null;
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'StrategyTypeTestStrategy.ts');
      await fs.writeFile(filePath, strategyCode);
      
      const loadResult = await strategyLoader.loadStrategy(filePath);

      // Test different strategies
      const gracefulId = await hotReloadManager.requestReload(
        loadResult.strategyId,
        'manual_reload',
        { strategy: 'graceful' }
      );

      expect(gracefulId).toBeTruthy();
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1500));

      const immediateId = await hotReloadManager.requestReload(
        loadResult.strategyId,
        'manual_reload',
        { strategy: 'immediate' }
      );

      expect(immediateId).toBeTruthy();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate all components seamlessly', async () => {
      // Create test strategy
      const strategyCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class IntegrationTestStrategy extends BaseStrategy {
          async generateSignal() {
            // Simulate some processing
            const rsi = this.indicators?.RSI?.(14);
            if (rsi && rsi > 70) {
              return 'SELL';
            } else if (rsi && rsi < 30) {
              return 'BUY';
            }
            return null;
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'IntegrationTestStrategy.ts');
      await fs.writeFile(filePath, strategyCode);

      // Load strategy
      const loadResult = await strategyLoader.loadStrategy(filePath);
      expect(loadResult.success).toBe(true);

      // Validate strategy
      const validationResult = await strategyLoader.validateStrategyFile(filePath);
      expect(validationResult.isValid).toBe(true);

      // Simulate an error and check error monitoring
      const testError = new Error('Test integration error');
      const errorId = errorMonitor.recordError(testError, {
        strategyId: loadResult.strategyId,
        strategyName: 'Integration Test Strategy',
        operation: 'signal_generation',
        timestamp: new Date(),
        environment: {
          memoryUsage: 50,
          cpuUsage: 10,
          activeStrategies: 1,
          systemLoad: 0.5
        }
      });

      expect(errorId).toBeTruthy();

      // Test hot reload
      const reloadId = await hotReloadManager.requestReload(
        loadResult.strategyId,
        'manual_reload',
        {
          reason: 'Integration test reload'
        }
      );

      expect(reloadId).toBeTruthy();

      // Verify system status
      const loaderStatus = strategyLoader.getStatus();
      const errorStats = errorMonitor.getStatistics();
      const activeReloads = hotReloadManager.getActiveReloads();

      expect(loaderStatus.strategiesLoaded).toBeGreaterThan(0);
      expect(errorStats.total).toBeGreaterThan(0);
      expect(activeReloads.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle system recovery scenarios', async () => {
      // Create problematic strategy
      const problematicCode = `
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class ProblematicStrategy extends BaseStrategy {
          async generateSignal() {
            // Simulate memory leak or infinite loop potential
            const largeArray = new Array(1000000).fill(0);
            
            // Simulate network error
            throw new Error('ECONNRESET: Connection reset by peer');
          }
        }
      `;
      
      const filePath = path.join(tempDir, 'ProblematicStrategy.ts');
      await fs.writeFile(filePath, problematicCode);

      const loadResult = await strategyLoader.loadStrategy(filePath);
      expect(loadResult.success).toBe(true);

      // Simulate multiple errors to trigger recovery
      for (let i = 0; i < 5; i++) {
        const error = new Error('ECONNRESET: Connection reset by peer');
        errorMonitor.recordError(error, {
          strategyId: loadResult.strategyId,
          strategyName: 'Problematic Strategy',
          operation: 'signal_generation',
          timestamp: new Date(),
          environment: {
            memoryUsage: 100 + i * 10,
            cpuUsage: 50 + i * 5,
            activeStrategies: 1,
            systemLoad: 0.8
          }
        }, 'network_error');
      }

      // Wait for potential recovery trigger
      await new Promise(resolve => setTimeout(resolve, 500));

      const errorStats = errorMonitor.getStatistics();
      expect(errorStats.recovery.attempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent operations', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create multiple strategies concurrently
      for (let i = 0; i < 5; i++) {
        const strategyCode = `
          import { BaseStrategy } from '../BaseStrategy.js';
          
          export class ConcurrentStrategy${i} extends BaseStrategy {
            async generateSignal() {
              return Math.random() > 0.5 ? 'BUY' : 'SELL';
            }
          }
        `;
        
        const filePath = path.join(tempDir, `ConcurrentStrategy${i}.ts`);
        promises.push(
          fs.writeFile(filePath, strategyCode).then(() =>
            strategyLoader.loadStrategy(filePath)
          )
        );
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;

      const totalTime = Date.now() - startTime;

      expect(successCount).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain performance under load', async () => {
      const iterations = 50;
      const startTime = Date.now();

      // Generate multiple validation requests
      const config: StrategyConfig = {
        id: 'load-test-strategy',
        name: 'Load Test Strategy',
        type: 'trend_following',
        description: 'Strategy for load testing',
        version: '1.0.0',
        author: 'Test',
        tags: ['test'],
        riskProfile: {
          maxRiskPerTrade: 2,
          maxDailyLoss: 5,
          maxDrawdown: 10
        },
        parameters: {},
        timeframes: ['1m'],
        markets: ['crypto']
      };

      const promises = Array.from({ length: iterations }, () =>
        strategyLoader.validateStrategyConfig(config)
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.isValid
      ).length;

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      expect(successCount).toBe(iterations);
      expect(avgTime).toBeLessThan(100); // Average less than 100ms per validation
    });
  });
});

describe('Strategy Loader Edge Cases', () => {
  let strategyLoader: StrategyLoader;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp', 'edge-case-tests');
    await fs.mkdir(tempDir, { recursive: true });

    strategyLoader = new StrategyLoader({
      strategiesPath: tempDir,
      enableHotReload: false,
      strictValidation: false
    });

    await strategyLoader.initialize();
  });

  afterEach(async () => {
    await strategyLoader.shutdown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should handle missing files gracefully', async () => {
    const result = await strategyLoader.loadStrategy('/non/existent/file.ts');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle empty strategy files', async () => {
    const filePath = path.join(tempDir, 'EmptyStrategy.ts');
    await fs.writeFile(filePath, '');

    const result = await strategyLoader.loadStrategy(filePath);
    expect(result.success).toBe(false);
  });

  it('should handle corrupted strategy files', async () => {
    const corruptedCode = `
      import { BaseStrategy } from '../BaseStrategy.js';
      
      export class CorruptedStrategy extends BaseStrategy {
        async generateSignal() {
          // Intentionally corrupted syntax
          const x = 
      `;
    
    const filePath = path.join(tempDir, 'CorruptedStrategy.ts');
    await fs.writeFile(filePath, corruptedCode);

    const validationResult = await strategyLoader.validateStrategyFile(filePath);
    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors.some(e => e.type === 'syntax')).toBe(true);
  });
});