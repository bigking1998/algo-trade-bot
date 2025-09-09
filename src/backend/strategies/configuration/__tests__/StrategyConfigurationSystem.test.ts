/**
 * Strategy Configuration System Test Suite - Task BE-009
 * 
 * Comprehensive testing suite for strategy configuration validation, optimization,
 * templates, versioning, and inheritance systems.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import StrategyConfigurationSystem from '../StrategyConfigurationSystem.js';
import ParameterOptimizationEngine from '../ParameterOptimizationEngine.js';
import StrategyTemplateManager from '../StrategyTemplates.js';
import ConfigurationVersioningManager from '../ConfigurationVersioning.js';
import ConfigurationInheritanceManager from '../ConfigurationInheritance.js';
import type { StrategyConfig, StrategyParameter } from '../../types.js';

// =============================================================================
// TEST UTILITIES AND HELPERS
// =============================================================================

/**
 * Create a test strategy configuration
 */
function createTestConfiguration(overrides?: Partial<StrategyConfig>): StrategyConfig {
  return {
    id: 'test_strategy_001',
    name: 'Test Strategy',
    description: 'A test strategy for validation',
    version: '1.0.0',
    type: 'trend_following',
    
    timeframes: ['1h', '4h'],
    symbols: ['BTC-USD', 'ETH-USD'],
    maxConcurrentPositions: 3,
    
    riskProfile: {
      maxRiskPerTrade: 2,
      maxPortfolioRisk: 10,
      stopLossType: 'trailing',
      takeProfitType: 'ratio',
      positionSizing: 'volatility'
    },
    
    parameters: {
      emaFast: {
        name: 'Fast EMA Period',
        type: 'number',
        value: 12,
        defaultValue: 12,
        required: true,
        min: 5,
        max: 50,
        description: 'Fast EMA period for crossover'
      },
      emaSlow: {
        name: 'Slow EMA Period',
        type: 'number',
        value: 26,
        defaultValue: 26,
        required: true,
        min: 15,
        max: 100,
        description: 'Slow EMA period for crossover'
      },
      rsiThreshold: {
        name: 'RSI Threshold',
        type: 'number',
        value: 70,
        defaultValue: 70,
        required: false,
        min: 0,
        max: 100,
        description: 'RSI overbought threshold'
      }
    },
    
    performance: {
      minWinRate: 0.45,
      maxDrawdown: 0.15,
      minSharpeRatio: 1.2
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
      performanceReviewInterval: 86400
    },
    
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    
    ...overrides
  };
}

/**
 * Create invalid configuration for testing error cases
 */
function createInvalidConfiguration(): StrategyConfig {
  return {
    id: '',
    name: '',
    description: '',
    version: '1.0.0',
    type: 'trend_following',
    
    timeframes: [],
    symbols: [],
    maxConcurrentPositions: -1,
    
    riskProfile: {
      maxRiskPerTrade: 150, // Invalid: over 100%
      maxPortfolioRisk: -5, // Invalid: negative
      stopLossType: 'trailing',
      takeProfitType: 'ratio',
      positionSizing: 'volatility'
    },
    
    parameters: {
      invalidParam: {
        name: 'Invalid Parameter',
        type: 'number',
        value: 'not a number', // Type mismatch
        defaultValue: 10,
        required: true,
        min: 5,
        max: 50,
        description: 'Invalid parameter for testing'
      }
    },
    
    performance: {},
    execution: {
      orderType: 'market',
      slippage: -0.1, // Invalid: negative slippage
      timeout: 0, // Invalid: zero timeout
      retries: -1 // Invalid: negative retries
    },
    
    monitoring: {
      enableAlerts: true,
      alertChannels: [],
      healthCheckInterval: 300,
      performanceReviewInterval: 86400
    },
    
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// =============================================================================
// STRATEGY CONFIGURATION SYSTEM TESTS
// =============================================================================

describe('StrategyConfigurationSystem', () => {
  let configSystem: StrategyConfigurationSystem;
  
  beforeEach(() => {
    configSystem = new StrategyConfigurationSystem();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration successfully', async () => {
      const config = createTestConfiguration();
      
      const result = await configSystem.validateConfiguration(config, 'development');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.healthScore).toBeGreaterThan(80);
      expect(result.validationTime).toBeLessThan(10); // Performance requirement: <10ms
    });
    
    test('should detect configuration errors', async () => {
      const config = createInvalidConfiguration();
      
      const result = await configSystem.validateConfiguration(config, 'production');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.healthScore).toBeLessThan(50);
      
      // Check specific errors
      const errorMessages = result.errors.map(e => e.message);
      expect(errorMessages.some(msg => msg.includes('required'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('timeframes'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('symbols'))).toBe(true);
    });
    
    test('should validate parameter types correctly', async () => {
      const config = createTestConfiguration({
        parameters: {
          stringParam: {
            name: 'String Parameter',
            type: 'string',
            value: 'valid string',
            defaultValue: 'default',
            required: true,
            description: 'String parameter'
          },
          numberParam: {
            name: 'Number Parameter',
            type: 'number',
            value: 42,
            defaultValue: 0,
            required: true,
            min: 0,
            max: 100,
            description: 'Number parameter'
          },
          booleanParam: {
            name: 'Boolean Parameter',
            type: 'boolean',
            value: true,
            defaultValue: false,
            required: false,
            description: 'Boolean parameter'
          }
        }
      });
      
      const result = await configSystem.validateConfiguration(config);
      
      expect(result.isValid).toBe(true);
      expect(result.parameterResults.stringParam.isValid).toBe(true);
      expect(result.parameterResults.numberParam.isValid).toBe(true);
      expect(result.parameterResults.booleanParam.isValid).toBe(true);
    });
    
    test('should validate parameter ranges', async () => {
      const config = createTestConfiguration({
        parameters: {
          outOfRange: {
            name: 'Out of Range Parameter',
            type: 'number',
            value: 200, // Exceeds max of 100
            defaultValue: 50,
            required: true,
            min: 0,
            max: 100,
            description: 'Parameter that exceeds maximum'
          }
        }
      });
      
      const result = await configSystem.validateConfiguration(config);
      
      expect(result.parameterResults.outOfRange.isValid).toBe(false);
      expect(result.parameterResults.outOfRange.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });
    
    test('should validate parameter dependencies', async () => {
      const config = createTestConfiguration({
        parameters: {
          dependentParam: {
            name: 'Dependent Parameter',
            type: 'number',
            value: 10,
            defaultValue: 10,
            required: true,
            dependencies: ['nonExistentParam'],
            description: 'Parameter with missing dependency'
          }
        }
      });
      
      const result = await configSystem.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('nonExistentParam'))).toBe(true);
    });
    
    test('should handle environment-specific validation', async () => {
      const config = createTestConfiguration();
      
      const devResult = await configSystem.validateConfiguration(config, 'development');
      const prodResult = await configSystem.validateConfiguration(config, 'production');
      
      expect(devResult.isValid).toBe(true);
      expect(prodResult.isValid).toBe(true);
      
      // Development environment should have different validation rules
      expect(devResult.warnings.length).toBeGreaterThanOrEqual(prodResult.warnings.length);
    });
    
    test('should generate meaningful recommendations', async () => {
      const config = createTestConfiguration({
        riskProfile: {
          maxRiskPerTrade: 5, // High risk
          maxPortfolioRisk: 25, // Very high portfolio risk
          stopLossType: 'trailing',
          takeProfitType: 'ratio',
          positionSizing: 'volatility'
        }
      });
      
      const result = await configSystem.validateConfiguration(config);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.type === 'risk')).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    test('should meet validation performance target', async () => {
      const config = createTestConfiguration();
      const startTime = Date.now();
      
      await configSystem.validateConfiguration(config);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(10); // <10ms requirement
    });
    
    test('should handle large configuration sets efficiently', async () => {
      // Create configuration with many parameters
      const parameters: Record<string, StrategyParameter> = {};
      for (let i = 0; i < 100; i++) {
        parameters[`param${i}`] = {
          name: `Parameter ${i}`,
          type: 'number',
          value: i,
          defaultValue: i,
          required: false,
          min: 0,
          max: 1000,
          description: `Generated parameter ${i}`
        };
      }
      
      const config = createTestConfiguration({ parameters });
      const startTime = Date.now();
      
      const result = await configSystem.validateConfiguration(config);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100); // Performance target for large configs
      expect(result.isValid).toBe(true);
    });
  });

  describe('Validation Metrics', () => {
    test('should track validation performance metrics', async () => {
      const config = createTestConfiguration();
      
      // Perform multiple validations
      for (let i = 0; i < 5; i++) {
        await configSystem.validateConfiguration(config);
      }
      
      const metrics = configSystem.getValidationMetrics();
      
      expect(metrics.totalValidations).toBe(5);
      expect(metrics.avgValidationTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBe(1.0);
    });
    
    test('should track validation failure rate', async () => {
      const validConfig = createTestConfiguration();
      const invalidConfig = createInvalidConfiguration();
      
      await configSystem.validateConfiguration(validConfig);
      await configSystem.validateConfiguration(invalidConfig);
      
      const metrics = configSystem.getValidationMetrics();
      
      expect(metrics.totalValidations).toBe(2);
      expect(metrics.successRate).toBe(0.5);
    });
  });
});

// =============================================================================
// PARAMETER OPTIMIZATION ENGINE TESTS
// =============================================================================

describe('ParameterOptimizationEngine', () => {
  let optimizationEngine: ParameterOptimizationEngine;
  
  beforeEach(() => {
    optimizationEngine = new ParameterOptimizationEngine();
  });

  describe('Algorithm Registration', () => {
    test('should have built-in optimization algorithms', () => {
      const algorithms = optimizationEngine.getAvailableAlgorithms();
      
      expect(algorithms).toContain('bayesian');
      expect(algorithms).toContain('genetic');
      expect(algorithms).toContain('grid_search');
      expect(algorithms).toContain('random_search');
      expect(algorithms.length).toBeGreaterThan(4);
    });
    
    test('should provide algorithm information', () => {
      const bayesianInfo = optimizationEngine.getAlgorithmInfo('bayesian');
      
      expect(bayesianInfo).toBeDefined();
      expect(bayesianInfo?.name).toBe('bayesian');
      expect(bayesianInfo?.supportsConstraints).toBeDefined();
      expect(bayesianInfo?.convergenceRate).toBeDefined();
    });
  });

  describe('Optimization Configuration Validation', () => {
    test('should validate optimization configuration', async () => {
      const mockEvaluator = {
        evaluate: vi.fn().mockResolvedValue({ score: 1.5, metrics: {}, isValid: true, evaluationTime: 10, timestamp: new Date() }),
        getEvaluationCount: vi.fn().mockReturnValue(0),
        getAverageEvaluationTime: vi.fn().mockReturnValue(0),
        getBestScore: vi.fn().mockReturnValue(0),
        getBestParameters: vi.fn().mockReturnValue({})
      };
      
      const config = {
        method: 'grid_search' as const,
        objectives: [{
          name: 'sharpe_ratio',
          metric: 'sharpe_ratio',
          direction: 'maximize' as const,
          weight: 1.0
        }],
        constraints: [],
        searchSpace: {
          emaFast: {
            type: 'continuous' as const,
            min: 5,
            max: 20
          }
        },
        settings: {
          maxIterations: 10,
          maxTime: 60,
          convergenceThreshold: 0.001
        },
        resources: {
          maxMemory: 1024,
          maxCpuCores: 2,
          timeout: 30
        }
      };
      
      // This would normally throw for invalid configurations
      await expect(
        optimizationEngine.optimizeParameters('test_strategy', config, mockEvaluator)
      ).resolves.toBeDefined();
    });
  });

  describe('Sensitivity Analysis', () => {
    test('should perform sensitivity analysis on parameters', async () => {
      const mockEvaluator = {
        evaluate: vi.fn()
          .mockResolvedValueOnce({ score: 1.0, metrics: {}, isValid: true, evaluationTime: 10, timestamp: new Date() }) // baseline
          .mockResolvedValueOnce({ score: 1.2, metrics: {}, isValid: true, evaluationTime: 10, timestamp: new Date() }) // positive
          .mockResolvedValueOnce({ score: 0.8, metrics: {}, isValid: true, evaluationTime: 10, timestamp: new Date() }), // negative
        getEvaluationCount: vi.fn().mockReturnValue(0),
        getAverageEvaluationTime: vi.fn().mockReturnValue(0),
        getBestScore: vi.fn().mockReturnValue(0),
        getBestParameters: vi.fn().mockReturnValue({})
      };
      
      const parameters = {
        emaFast: 12,
        emaSlow: 26
      };
      
      const sensitivity = await optimizationEngine.performSensitivityAnalysis(
        parameters,
        mockEvaluator,
        0.1
      );
      
      expect(sensitivity.emaFast).toBeDefined();
      expect(sensitivity.emaFast.impact).toBeDefined();
      expect(sensitivity.emaFast.confidence).toBeGreaterThanOrEqual(0);
      expect(sensitivity.emaFast.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Auto-tuning', () => {
    test('should start and stop auto-tuning', async () => {
      const parameters = {
        emaFast: {
          name: 'Fast EMA',
          type: 'number' as const,
          value: 12,
          defaultValue: 12,
          required: true,
          description: 'Fast EMA period',
          autoTune: {
            enabled: true,
            frequency: 'weekly' as const,
            metric: 'sharpe' as const
          }
        }
      };
      
      const config = {
        enabled: true,
        triggers: {
          performanceThreshold: 0.1,
          timeInterval: 168,
          tradeCountThreshold: 100,
          drawdownThreshold: 0.1,
          marketRegimeChange: true
        },
        optimization: {
          algorithm: 'bayesian',
          maxIterations: 50,
          maxTime: 300,
          convergenceThreshold: 0.01,
          parametersToOptimize: ['emaFast'],
          optimizationScope: 'all' as const
        },
        safety: {
          maxParameterChange: 0.2,
          minValidationPeriod: 24,
          rollbackThreshold: 0.05,
          maxTuningFrequency: 1
        },
        validation: {
          method: 'walk_forward' as const,
          testSize: 0.2,
          minPerformanceImprovement: 0.02
        }
      };
      
      await optimizationEngine.startAutoTuning('test_strategy', parameters, config);
      
      const status = optimizationEngine.getAutoTuningStatus();
      expect(status.some(s => s.strategyId === 'test_strategy' && s.isActive)).toBe(true);
      
      await optimizationEngine.stopAutoTuning('test_strategy');
      
      const statusAfterStop = optimizationEngine.getAutoTuningStatus();
      expect(statusAfterStop.some(s => s.strategyId === 'test_strategy' && s.isActive)).toBe(false);
    });
  });
});

// =============================================================================
// STRATEGY TEMPLATE MANAGER TESTS
// =============================================================================

describe('StrategyTemplateManager', () => {
  let templateManager: StrategyTemplateManager;
  
  beforeEach(() => {
    templateManager = new StrategyTemplateManager();
  });

  describe('Template Management', () => {
    test('should provide built-in templates', () => {
      const templates = templateManager.getTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'ema_golden_cross')).toBe(true);
      expect(templates.some(t => t.id === 'rsi_mean_reversion')).toBe(true);
    });
    
    test('should filter templates by category', () => {
      const trendTemplates = templateManager.getTemplates({ category: 'trend_following' });
      const meanRevTemplates = templateManager.getTemplates({ category: 'mean_reversion' });
      
      expect(trendTemplates.every(t => t.category === 'trend_following')).toBe(true);
      expect(meanRevTemplates.every(t => t.category === 'mean_reversion')).toBe(true);
      expect(trendTemplates.length).toBeGreaterThan(0);
      expect(meanRevTemplates.length).toBeGreaterThan(0);
    });
    
    test('should filter templates by difficulty', () => {
      const beginnerTemplates = templateManager.getTemplates({ difficulty: 'beginner' });
      const expertTemplates = templateManager.getTemplates({ difficulty: 'expert' });
      
      expect(beginnerTemplates.every(t => t.difficulty === 'beginner')).toBe(true);
      expect(expertTemplates.every(t => t.difficulty === 'expert')).toBe(true);
    });
  });

  describe('Configuration Creation', () => {
    test('should create configuration from template', () => {
      const config = templateManager.createConfigurationFromTemplate(
        'ema_golden_cross',
        {
          id: 'my_ema_strategy',
          name: 'My EMA Strategy',
          symbols: ['BTC-USD']
        }
      );
      
      expect(config.id).toBe('my_ema_strategy');
      expect(config.name).toBe('My EMA Strategy');
      expect(config.symbols).toEqual(['BTC-USD']);
      expect(config.parameters.fastEMA).toBeDefined();
      expect(config.parameters.slowEMA).toBeDefined();
    });
    
    test('should handle template not found', () => {
      expect(() => {
        templateManager.createConfigurationFromTemplate('non_existent_template');
      }).toThrow('Template \'non_existent_template\' not found');
    });
  });

  describe('Template Recommendations', () => {
    test('should recommend templates based on market conditions', () => {
      const recommendations = templateManager.getRecommendedTemplates(
        {
          trend: 'bull',
          volatility: 'medium',
          volume: 'high'
        },
        'moderate'
      );
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      // Should favor trend following in bull markets
      expect(recommendations.some(t => t.category === 'trend_following')).toBe(true);
    });
    
    test('should recommend mean reversion for sideways markets', () => {
      const recommendations = templateManager.getRecommendedTemplates(
        {
          trend: 'sideways',
          volatility: 'low',
          volume: 'medium'
        },
        'conservative'
      );
      
      expect(recommendations.some(t => t.category === 'mean_reversion')).toBe(true);
    });
  });

  describe('Template Categories', () => {
    test('should provide all available categories', () => {
      const categories = templateManager.getCategories();
      
      expect(categories).toContain('trend_following');
      expect(categories).toContain('mean_reversion');
      expect(categories).toContain('momentum');
      expect(categories).toContain('breakout');
      expect(categories).toContain('ml_enhanced');
    });
  });
});

// =============================================================================
// CONFIGURATION VERSIONING TESTS
// =============================================================================

describe('ConfigurationVersioningManager', () => {
  let versioningManager: ConfigurationVersioningManager;
  
  beforeEach(() => {
    versioningManager = new ConfigurationVersioningManager();
  });

  describe('Version Creation', () => {
    test('should create new version successfully', async () => {
      const config = createTestConfiguration();
      const parameters = config.parameters;
      
      const versionId = await versioningManager.createVersion(
        'test_config',
        config,
        parameters,
        {
          author: 'test_user',
          changeDescription: 'Initial version',
          changeType: 'creation',
          environment: 'development'
        }
      );
      
      expect(versionId).toBeDefined();
      expect(versionId).toContain('test_config');
    });
    
    test('should track version history', async () => {
      const config = createTestConfiguration();
      const parameters = config.parameters;
      
      // Create multiple versions
      await versioningManager.createVersion('test_config', config, parameters, {
        author: 'user1',
        changeDescription: 'Version 1'
      });
      
      await versioningManager.createVersion('test_config', config, parameters, {
        author: 'user2',
        changeDescription: 'Version 2'
      });
      
      const history = versioningManager.getVersionHistory('test_config');
      
      expect(history.length).toBe(2);
      expect(history[0].author).toBe('user2'); // Latest first
      expect(history[1].author).toBe('user1');
    });
  });

  describe('Version Deployment', () => {
    test('should deploy version successfully', async () => {
      const config = createTestConfiguration();
      const parameters = config.parameters;
      
      const versionId = await versioningManager.createVersion('test_config', config, parameters, {
        approvalStatus: 'approved'
      });
      
      await versioningManager.deployVersion(versionId);
      
      const activeVersion = versioningManager.getActiveVersion('test_config');
      expect(activeVersion?.id).toBe(versionId);
    });
    
    test('should prevent deployment of unapproved versions', async () => {
      const config = createTestConfiguration();
      const parameters = config.parameters;
      
      const versionId = await versioningManager.createVersion('test_config', config, parameters, {
        approvalStatus: 'pending'
      });
      
      await expect(versioningManager.deployVersion(versionId)).rejects.toThrow('requires approval');
    });
  });

  describe('Version Rollback', () => {
    test('should rollback to previous version', async () => {
      const config = createTestConfiguration();
      const parameters = config.parameters;
      
      // Create and deploy first version
      const version1 = await versioningManager.createVersion('test_config', config, parameters, {
        approvalStatus: 'approved'
      });
      await versioningManager.deployVersion(version1);
      
      // Create and deploy second version
      const version2 = await versioningManager.createVersion('test_config', config, parameters, {
        approvalStatus: 'approved'
      });
      await versioningManager.deployVersion(version2);
      
      // Rollback to first version
      await versioningManager.rollbackVersion('test_config', {
        reason: 'Performance degradation'
      });
      
      const activeVersion = versioningManager.getActiveVersion('test_config');
      expect(activeVersion?.id).toBe(version1);
    });
  });

  describe('Version Comparison', () => {
    test('should generate version diff', async () => {
      const config1 = createTestConfiguration();
      const config2 = createTestConfiguration({
        parameters: {
          ...config1.parameters,
          emaFast: {
            ...config1.parameters.emaFast,
            value: 15 // Changed from 12
          }
        }
      });
      
      const version1 = await versioningManager.createVersion('test_config', config1, config1.parameters, {});
      const version2 = await versioningManager.createVersion('test_config', config2, config2.parameters, {});
      
      const diff = versioningManager.getVersionDiff(version1, version2);
      
      expect(diff.changeTracker.parameterChanges.length).toBeGreaterThan(0);
      expect(diff.changeTracker.parameterChanges[0].parameter).toBe('emaFast');
      expect(diff.changeTracker.parameterChanges[0].oldValue).toBe(12);
      expect(diff.changeTracker.parameterChanges[0].newValue).toBe(15);
    });
  });
});

// =============================================================================
// CONFIGURATION INHERITANCE TESTS
// =============================================================================

describe('ConfigurationInheritanceManager', () => {
  let inheritanceManager: ConfigurationInheritanceManager;
  
  beforeEach(() => {
    inheritanceManager = new ConfigurationInheritanceManager();
  });

  describe('Module Management', () => {
    test('should have built-in modules', () => {
      const conservativeModules = inheritanceManager.getModulesByType('risk_profile');
      
      expect(conservativeModules.length).toBeGreaterThan(0);
      expect(conservativeModules.some(m => m.id === 'conservative_risk')).toBe(true);
      expect(conservativeModules.some(m => m.id === 'aggressive_risk')).toBe(true);
    });
    
    test('should register custom module', () => {
      const customModule = {
        id: 'custom_indicators',
        name: 'Custom Indicators Module',
        description: 'Custom technical indicators',
        version: '1.0.0',
        type: 'parameter_set' as const,
        category: 'indicators',
        parameters: {
          customRSI: {
            name: 'Custom RSI',
            type: 'number' as const,
            value: 21,
            defaultValue: 21,
            required: true,
            description: 'Custom RSI period'
          }
        },
        dependencies: [],
        conflicts: [],
        compatibleWith: ['trend_following'],
        validationRules: [],
        usageConstraints: [],
        author: 'test_user',
        tags: ['custom'],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      inheritanceManager.registerModule(customModule);
      
      const modules = inheritanceManager.getModulesByCategory('indicators');
      expect(modules.some(m => m.id === 'custom_indicators')).toBe(true);
    });
  });

  describe('Module Compatibility', () => {
    test('should check module compatibility', () => {
      const compatibility = inheritanceManager.checkModuleCompatibility([
        'conservative_risk',
        'aggressive_risk' // These should conflict
      ]);
      
      expect(compatibility.compatible).toBe(false);
      expect(compatibility.conflicts.length).toBeGreaterThan(0);
    });
    
    test('should check compatible modules', () => {
      const compatibility = inheritanceManager.checkModuleCompatibility([
        'conservative_risk'
      ], 'trend_following');
      
      expect(compatibility.compatible).toBe(true);
      expect(compatibility.conflicts.length).toBe(0);
    });
  });

  describe('Configuration Composition', () => {
    test('should compose configuration from modules', async () => {
      const compositionRule = {
        id: 'test_composition',
        name: 'Test Composition',
        description: 'Test composition rule',
        strategy: 'modular' as const,
        components: [{
          id: 'risk_component',
          source: 'module' as const,
          reference: 'conservative_risk',
          order: 1,
          enabled: true,
          constraints: [],
          transformations: []
        }],
        conflictResolution: {
          strategy: 'last_wins' as const
        },
        validateComponents: true,
        validateComposition: true,
        allowPartialComposition: false
      };
      
      const result = await inheritanceManager.composeConfiguration([compositionRule]);
      
      expect(result.success).toBe(true);
      expect(result.appliedComponents.length).toBe(1);
      expect(result.configuration.riskProfile).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    test('should meet inheritance performance target', async () => {
      const startTime = Date.now();
      
      const result = await inheritanceManager.createInheritedConfiguration(
        'test_config',
        'test_hierarchy',
        'production'
      );
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100); // <100ms requirement
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Configuration System Integration', () => {
  let configSystem: StrategyConfigurationSystem;
  let templateManager: StrategyTemplateManager;
  let versioningManager: ConfigurationVersioningManager;
  
  beforeEach(() => {
    configSystem = new StrategyConfigurationSystem();
    templateManager = new StrategyTemplateManager();
    versioningManager = new ConfigurationVersioningManager();
  });

  test('should integrate template creation with validation', async () => {
    // Create configuration from template
    const config = templateManager.createConfigurationFromTemplate('ema_golden_cross');
    
    // Validate the generated configuration
    const validation = await configSystem.validateConfiguration(config);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
    expect(validation.healthScore).toBeGreaterThan(80);
  });
  
  test('should integrate versioning with validation', async () => {
    const config = createTestConfiguration();
    
    // Validate configuration first
    const validation = await configSystem.validateConfiguration(config);
    expect(validation.isValid).toBe(true);
    
    // Create version with validation result
    const versionId = await versioningManager.createVersion(
      'test_config',
      config,
      config.parameters,
      {
        validation,
        author: 'integration_test',
        changeDescription: 'Integration test version'
      }
    );
    
    expect(versionId).toBeDefined();
    
    const version = versioningManager.getVersionHistory('test_config')[0];
    expect(version.validation.isValid).toBe(true);
  });
  
  test('should handle end-to-end configuration lifecycle', async () => {
    // 1. Create configuration from template
    const config = templateManager.createConfigurationFromTemplate(
      'rsi_mean_reversion',
      {
        id: 'e2e_test_strategy',
        name: 'End-to-End Test Strategy',
        symbols: ['ETH-USD']
      }
    );
    
    // 2. Validate configuration
    const validation = await configSystem.validateConfiguration(config);
    expect(validation.isValid).toBe(true);
    
    // 3. Create initial version
    const version1 = await versioningManager.createVersion(
      'e2e_test_strategy',
      config,
      config.parameters,
      {
        validation,
        author: 'e2e_test',
        changeDescription: 'Initial version from template',
        approvalStatus: 'approved'
      }
    );
    
    // 4. Deploy version
    await versioningManager.deployVersion(version1);
    
    // 5. Modify configuration
    const modifiedConfig = {
      ...config,
      parameters: {
        ...config.parameters,
        rsiPeriod: {
          ...config.parameters.rsiPeriod,
          value: 21 // Changed from default
        }
      }
    };
    
    // 6. Validate modified configuration
    const modifiedValidation = await configSystem.validateConfiguration(modifiedConfig);
    expect(modifiedValidation.isValid).toBe(true);
    
    // 7. Create new version
    const version2 = await versioningManager.createVersion(
      'e2e_test_strategy',
      modifiedConfig,
      modifiedConfig.parameters,
      {
        validation: modifiedValidation,
        author: 'e2e_test',
        changeDescription: 'Updated RSI period',
        changeType: 'parameter_update',
        approvalStatus: 'approved'
      }
    );
    
    // 8. Compare versions
    const diff = versioningManager.getVersionDiff(version1, version2);
    expect(diff.changeTracker.parameterChanges.length).toBe(1);
    expect(diff.changeTracker.parameterChanges[0].parameter).toBe('rsiPeriod');
    
    // 9. Deploy new version
    await versioningManager.deployVersion(version2);
    
    // 10. Verify active version
    const activeVersion = versioningManager.getActiveVersion('e2e_test_strategy');
    expect(activeVersion?.id).toBe(version2);
    
    // 11. Test rollback
    await versioningManager.rollbackVersion('e2e_test_strategy', {
      reason: 'Testing rollback functionality'
    });
    
    const rolledBackVersion = versioningManager.getActiveVersion('e2e_test_strategy');
    expect(rolledBackVersion?.id).toBe(version1);
  });
});

// =============================================================================
// PERFORMANCE AND STRESS TESTS
// =============================================================================

describe('Performance and Stress Tests', () => {
  test('should handle concurrent validations', async () => {
    const configSystem = new StrategyConfigurationSystem();
    const configs = Array.from({ length: 10 }, (_, i) => 
      createTestConfiguration({ id: `concurrent_test_${i}` })
    );
    
    const startTime = Date.now();
    
    const validationPromises = configs.map(config => 
      configSystem.validateConfiguration(config)
    );
    
    const results = await Promise.all(validationPromises);
    
    const totalTime = Date.now() - startTime;
    
    expect(results.every(r => r.isValid)).toBe(true);
    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
  });
  
  test('should handle memory usage efficiently', async () => {
    const configSystem = new StrategyConfigurationSystem();
    
    // Create many large configurations
    const largeConfigs = Array.from({ length: 100 }, (_, i) => {
      const parameters: Record<string, StrategyParameter> = {};
      for (let j = 0; j < 50; j++) {
        parameters[`param_${j}`] = {
          name: `Parameter ${j}`,
          type: 'number',
          value: Math.random() * 100,
          defaultValue: 50,
          required: false,
          description: `Auto-generated parameter ${j}`
        };
      }
      
      return createTestConfiguration({
        id: `memory_test_${i}`,
        parameters
      });
    });
    
    // Memory usage should stay within limits
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (const config of largeConfigs) {
      await configSystem.validateConfiguration(config);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    expect(memoryIncrease).toBeLessThan(100); // Should use less than 100MB
  });
});