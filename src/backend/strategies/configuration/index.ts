/**
 * Strategy Configuration System - Task BE-009
 * 
 * Main exports for the comprehensive strategy configuration system including
 * validation, optimization, templates, versioning, and inheritance.
 */

// Core configuration system
import StrategyConfigurationSystemClass from './StrategyConfigurationSystem.js';
export { default as StrategyConfigurationSystem } from './StrategyConfigurationSystem.js';
export * from './StrategyConfigurationSystem.js';

// Parameter optimization and auto-tuning
import ParameterOptimizationEngineClass from './ParameterOptimizationEngine.js';
export { default as ParameterOptimizationEngine } from './ParameterOptimizationEngine.js';
export * from './ParameterOptimizationEngine.js';

// Configuration templates
import StrategyTemplateManagerClass from './StrategyTemplates.js';
export { default as StrategyTemplateManager } from './StrategyTemplates.js';
export * from './StrategyTemplates.js';

// Versioning and rollback
import ConfigurationVersioningManagerClass from './ConfigurationVersioning.js';
export { default as ConfigurationVersioningManager } from './ConfigurationVersioning.js';
export * from './ConfigurationVersioning.js';

// Inheritance and composition
import ConfigurationInheritanceManagerClass from './ConfigurationInheritance.js';
export { default as ConfigurationInheritanceManager } from './ConfigurationInheritance.js';
export * from './ConfigurationInheritance.js';

// Unified configuration manager combining all systems
export class UnifiedConfigurationManager {
  public readonly configSystem: StrategyConfigurationSystemClass;
  public readonly optimizationEngine: ParameterOptimizationEngineClass;
  public readonly templateManager: StrategyTemplateManagerClass;
  public readonly versioningManager: ConfigurationVersioningManagerClass;
  public readonly inheritanceManager: ConfigurationInheritanceManagerClass;

  constructor() {
    this.configSystem = new StrategyConfigurationSystemClass();
    this.optimizationEngine = new ParameterOptimizationEngineClass();
    this.templateManager = new StrategyTemplateManagerClass();
    this.versioningManager = new ConfigurationVersioningManagerClass();
    this.inheritanceManager = new ConfigurationInheritanceManagerClass();
  }

  /**
   * Get comprehensive system metrics
   */
  public getSystemMetrics() {
    return {
      validation: this.configSystem.getValidationMetrics(),
      optimization: this.optimizationEngine.getOptimizationMetrics(),
      versioning: this.versioningManager.getVersioningMetrics(),
      inheritance: this.inheritanceManager.getInheritanceMetrics()
    };
  }

  /**
   * Initialize all subsystems
   */
  public async initialize(): Promise<void> {
    // Initialize any required setup for subsystems
    // Currently all systems are self-initializing
  }

  /**
   * Cleanup all subsystems
   */
  public async cleanup(): Promise<void> {
    // Cleanup any resources
    // Stop auto-tuning processes, clear caches, etc.
  }
}

// Default export is the unified manager
export default UnifiedConfigurationManager;