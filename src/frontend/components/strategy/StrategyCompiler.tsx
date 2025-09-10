/**
 * Strategy Compiler - FE-010
 * 
 * Advanced strategy compilation engine that converts visual node graphs
 * into executable trading strategy code with optimization and validation.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { NodeData, ConnectionData } from '../nodes/NodeCanvas';

export interface CompilerOptions {
  target: 'javascript' | 'typescript' | 'python';
  optimization: 'none' | 'basic' | 'aggressive';
  includeComments: boolean;
  validateCode: boolean;
  generateTests: boolean;
}

export interface CompilationContext {
  variables: Map<string, string>;
  functions: Map<string, string>;
  imports: Set<string>;
  dependencies: Set<string>;
}

export interface CompilerResult {
  success: boolean;
  code: string;
  sourceMap?: string;
  errors: CompilerError[];
  warnings: CompilerWarning[];
  metrics: CompilerMetrics;
}

export interface CompilerError {
  id: string;
  message: string;
  nodeId?: string;
  line?: number;
  column?: number;
  type: 'syntax' | 'semantic' | 'runtime' | 'optimization';
}

export interface CompilerWarning {
  id: string;
  message: string;
  nodeId?: string;
  suggestion?: string;
}

export interface CompilerMetrics {
  codeSize: number;
  complexity: number;
  estimatedPerformance: number;
  memoryUsage: number;
  compilationTime: number;
}

export class StrategyCompiler {
  private options: CompilerOptions;
  private context: CompilationContext;

  constructor(options: CompilerOptions = {
    target: 'javascript',
    optimization: 'basic',
    includeComments: true,
    validateCode: true,
    generateTests: false
  }) {
    this.options = options;
    this.context = {
      variables: new Map(),
      functions: new Map(),
      imports: new Set(),
      dependencies: new Set()
    };
  }

  async compile(nodes: NodeData[], connections: ConnectionData[]): Promise<CompilerResult> {
    const startTime = Date.now();
    
    try {
      // Reset context for new compilation
      this.resetContext();

      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(nodes, connections);
      
      // Validate graph structure
      const validationErrors = this.validateGraph(dependencyGraph);
      if (validationErrors.length > 0) {
        return {
          success: false,
          code: '',
          errors: validationErrors,
          warnings: [],
          metrics: this.getEmptyMetrics(Date.now() - startTime)
        };
      }

      // Generate code in topological order
      const code = this.generateCode(dependencyGraph);

      // Optimize if requested
      const optimizedCode = this.options.optimization !== 'none' 
        ? this.optimizeCode(code) 
        : code;

      // Validate generated code
      const codeValidation = this.options.validateCode 
        ? this.validateGeneratedCode(optimizedCode)
        : { errors: [], warnings: [] };

      const compilationTime = Date.now() - startTime;

      return {
        success: codeValidation.errors.length === 0,
        code: optimizedCode,
        errors: codeValidation.errors,
        warnings: codeValidation.warnings,
        metrics: {
          codeSize: optimizedCode.length,
          complexity: this.calculateComplexity(dependencyGraph),
          estimatedPerformance: this.estimatePerformance(dependencyGraph),
          memoryUsage: this.estimateMemoryUsage(nodes),
          compilationTime
        }
      };

    } catch (error) {
      return {
        success: false,
        code: '',
        errors: [{
          id: 'compilation-error',
          message: error instanceof Error ? error.message : 'Unknown compilation error',
          type: 'runtime'
        }],
        warnings: [],
        metrics: this.getEmptyMetrics(Date.now() - startTime)
      };
    }
  }

  private resetContext(): void {
    this.context.variables.clear();
    this.context.functions.clear();
    this.context.imports.clear();
    this.context.dependencies.clear();
  }

  private buildDependencyGraph(nodes: NodeData[], connections: ConnectionData[]): Map<string, NodeData & { dependencies: string[] }> {
    const graph = new Map<string, NodeData & { dependencies: string[] }>();
    
    // Initialize nodes in graph
    nodes.forEach(node => {
      graph.set(node.id, { ...node, dependencies: [] });
    });

    // Add dependencies based on connections
    connections.forEach(connection => {
      const targetNode = graph.get(connection.targetNodeId);
      if (targetNode) {
        targetNode.dependencies.push(connection.sourceNodeId);
      }
    });

    return graph;
  }

  private validateGraph(graph: Map<string, NodeData & { dependencies: string[] }>): CompilerError[] {
    const errors: CompilerError[] = [];

    // Check for cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = graph.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (detectCycle(dep)) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.keys()) {
      if (detectCycle(nodeId)) {
        errors.push({
          id: `cycle-${nodeId}`,
          message: `Circular dependency detected involving node ${nodeId}`,
          nodeId,
          type: 'semantic'
        });
      }
    }

    return errors;
  }

  private generateCode(graph: Map<string, NodeData & { dependencies: string[] }>): string {
    const sortedNodes = this.topologicalSort(graph);
    
    let code = this.generateHeader();
    code += this.generateImports();
    code += this.generateClassDefinition();
    code += this.generateConstructor(sortedNodes);
    code += this.generateInitMethod(sortedNodes);
    code += this.generateExecutionMethod(sortedNodes);
    code += this.generateHelperMethods(sortedNodes);
    code += this.generateFooter();

    return code;
  }

  private topologicalSort(graph: Map<string, NodeData & { dependencies: string[] }>): (NodeData & { dependencies: string[] })[] {
    const visited = new Set<string>();
    const result: (NodeData & { dependencies: string[] })[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = graph.get(nodeId);
      if (node) {
        node.dependencies.forEach(dep => visit(dep));
        result.push(node);
      }
    };

    graph.keys().forEach(nodeId => visit(nodeId));
    return result;
  }

  private generateHeader(): string {
    const timestamp = new Date().toISOString();
    return this.options.includeComments ? 
      `/**
 * Auto-generated Trading Strategy
 * Generated at: ${timestamp}
 * Compiler: StrategyCompiler v1.0
 * Target: ${this.options.target}
 * Optimization: ${this.options.optimization}
 */

` : '';
  }

  private generateImports(): string {
    const imports = Array.from(this.context.imports);
    if (imports.length === 0) return '';

    if (this.options.target === 'javascript') {
      return imports.map(imp => `const ${imp} = require('${imp}');`).join('\n') + '\n\n';
    } else if (this.options.target === 'typescript') {
      return imports.map(imp => `import * as ${imp} from '${imp}';`).join('\n') + '\n\n';
    }
    return '';
  }

  private generateClassDefinition(): string {
    return `class GeneratedTradingStrategy {
`;
  }

  private generateConstructor(nodes: (NodeData & { dependencies: string[] })[]): string {
    let code = `  constructor(config = {}) {
    this.name = config.name || 'Generated Strategy';
    this.version = '1.0.0';
    this.config = config;
    this.state = {};
    this.indicators = {};
    this.signals = {};
    
`;

    // Initialize node-specific variables
    nodes.forEach(node => {
      const varName = this.getVariableName(node);
      code += `    this.${varName} = null; // ${node.data.label}\n`;
    });

    code += `  }

`;
    return code;
  }

  private generateInitMethod(nodes: (NodeData & { dependencies: string[] })[]): string {
    let code = `  init() {
    ${this.options.includeComments ? '// Initialize indicators and components' : ''}
`;

    nodes.filter(node => node.type === 'indicator').forEach(node => {
      const varName = this.getVariableName(node);
      const params = JSON.stringify(node.data.parameters || {});
      code += `    this.indicators.${varName} = new ${this.getIndicatorClass(node)}(${params});
`;
    });

    code += `    
    console.log('Strategy initialized successfully');
  }

`;
    return code;
  }

  private generateExecutionMethod(nodes: (NodeData & { dependencies: string[] })[]): string {
    let code = `  execute(marketData) {
    ${this.options.includeComments ? '// Main strategy execution logic' : ''}
    const signals = [];
    
    try {
`;

    // Update indicators
    const indicators = nodes.filter(n => n.type === 'indicator');
    if (indicators.length > 0) {
      code += `      ${this.options.includeComments ? '// Update indicators' : ''}
`;
      indicators.forEach(node => {
        const varName = this.getVariableName(node);
        code += `      this.state.${varName} = this.indicators.${varName}.update(marketData);
`;
      });
    }

    // Process conditions
    const conditions = nodes.filter(n => n.type === 'condition');
    if (conditions.length > 0) {
      code += `
      ${this.options.includeComments ? '// Evaluate conditions' : ''}
`;
      conditions.forEach(node => {
        const varName = this.getVariableName(node);
        code += `      this.state.${varName} = this.evaluate${this.capitalize(varName)}(marketData);
`;
      });
    }

    // Generate signals
    const signalNodes = nodes.filter(n => n.type === 'signal');
    if (signalNodes.length > 0) {
      code += `
      ${this.options.includeComments ? '// Generate trading signals' : ''}
`;
      signalNodes.forEach(node => {
        const varName = this.getVariableName(node);
        code += `      const ${varName}Signal = this.generate${this.capitalize(varName)}(marketData);
      if (${varName}Signal) signals.push(${varName}Signal);
`;
      });
    }

    code += `
    } catch (error) {
      console.error('Strategy execution error:', error);
      return { signals: [], error: error.message };
    }
    
    return { signals, timestamp: marketData.timestamp };
  }

`;
    return code;
  }

  private generateHelperMethods(nodes: (NodeData & { dependencies: string[] })[]): string {
    let code = '';

    // Generate condition evaluation methods
    nodes.filter(n => n.type === 'condition').forEach(node => {
      const varName = this.getVariableName(node);
      code += `  evaluate${this.capitalize(varName)}(data) {
    ${this.options.includeComments ? `// Evaluate ${node.data.label} condition` : ''}
    // Implementation based on node configuration
    return ${this.generateConditionLogic(node)};
  }

`;
    });

    // Generate signal generation methods
    nodes.filter(n => n.type === 'signal').forEach(node => {
      const varName = this.getVariableName(node);
      code += `  generate${this.capitalize(varName)}(data) {
    ${this.options.includeComments ? `// Generate ${node.data.label} signal` : ''}
    // Implementation based on node configuration
    if (${this.generateSignalCondition(node)}) {
      return {
        type: '${node.type}',
        action: '${node.data.parameters?.action || 'buy'}',
        strength: ${node.data.parameters?.strength || 1.0},
        timestamp: data.timestamp
      };
    }
    return null;
  }

`;
    });

    return code;
  }

  private generateFooter(): string {
    return `}

module.exports = GeneratedTradingStrategy;
`;
  }

  private getVariableName(node: NodeData): string {
    return (node.data.label || node.id)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  private getIndicatorClass(node: NodeData): string {
    const typeMap: Record<string, string> = {
      'sma': 'SimpleMovingAverage',
      'ema': 'ExponentialMovingAverage',
      'rsi': 'RelativeStrengthIndex',
      'macd': 'MACD',
      'bollinger-bands': 'BollingerBands'
    };
    return typeMap[node.type] || 'BaseIndicator';
  }

  private generateConditionLogic(node: NodeData): string {
    // Generate condition logic based on node type and parameters
    switch (node.type) {
      case 'comparison':
        return `this.state.valueA ${node.data.parameters?.operator || '>'} this.state.valueB`;
      case 'crossover':
        return `this.checkCrossover(this.state.lineA, this.state.lineB)`;
      case 'range-check':
        const min = node.data.parameters?.minValue || 0;
        const max = node.data.parameters?.maxValue || 100;
        return `this.state.value >= ${min} && this.state.value <= ${max}`;
      default:
        return 'true';
    }
  }

  private generateSignalCondition(node: NodeData): string {
    // Generate signal condition based on connected inputs
    return 'this.state.condition === true';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private optimizeCode(code: string): string {
    if (this.options.optimization === 'none') return code;

    let optimized = code;

    if (this.options.optimization === 'basic' || this.options.optimization === 'aggressive') {
      // Remove unnecessary whitespace
      optimized = optimized.replace(/\n\s*\n/g, '\n');
      
      // Remove debug comments in production
      if (this.options.optimization === 'aggressive') {
        optimized = optimized.replace(/\/\/.*$/gm, '');
        optimized = optimized.replace(/\s+/g, ' ');
      }
    }

    return optimized;
  }

  private validateGeneratedCode(code: string): { errors: CompilerError[], warnings: CompilerWarning[] } {
    const errors: CompilerError[] = [];
    const warnings: CompilerWarning[] = [];

    // Basic syntax validation
    try {
      if (this.options.target === 'javascript') {
        new Function(code);
      }
    } catch (error) {
      errors.push({
        id: 'syntax-error',
        message: `Syntax error in generated code: ${error}`,
        type: 'syntax'
      });
    }

    // Check for potential issues
    if (code.includes('undefined')) {
      warnings.push({
        id: 'undefined-reference',
        message: 'Generated code contains undefined references',
        suggestion: 'Review node connections and configuration'
      });
    }

    return { errors, warnings };
  }

  private calculateComplexity(graph: Map<string, NodeData & { dependencies: string[] }>): number {
    // Calculate cyclomatic complexity
    let complexity = 1; // Base complexity
    
    graph.forEach(node => {
      switch (node.type) {
        case 'condition':
        case 'logic':
          complexity += 1;
          break;
        case 'signal':
          complexity += 2;
          break;
        default:
          complexity += 0.5;
      }
    });

    return Math.round(complexity);
  }

  private estimatePerformance(graph: Map<string, NodeData & { dependencies: string[] }>): number {
    // Estimate performance score (0-100)
    const nodeCount = graph.size;
    const indicatorCount = Array.from(graph.values()).filter(n => n.type === 'indicator').length;
    
    let score = 100;
    score -= nodeCount * 2; // Complexity penalty
    score -= indicatorCount * 5; // Indicator calculation penalty
    
    return Math.max(score, 10);
  }

  private estimateMemoryUsage(nodes: NodeData[]): number {
    // Estimate memory usage in MB
    let usage = 0.5; // Base usage
    
    nodes.forEach(node => {
      switch (node.type) {
        case 'indicator':
          usage += 0.1;
          break;
        case 'ml-model':
          usage += 2.0; // ML models use more memory
          break;
        default:
          usage += 0.05;
      }
    });

    return Math.round(usage * 100) / 100;
  }

  private getEmptyMetrics(compilationTime: number): CompilerMetrics {
    return {
      codeSize: 0,
      complexity: 0,
      estimatedPerformance: 0,
      memoryUsage: 0,
      compilationTime
    };
  }
}

export const useStrategyCompiler = (options?: CompilerOptions) => {
  const [compiler] = useState(() => new StrategyCompiler(options));
  
  const compile = useCallback(async (nodes: NodeData[], connections: ConnectionData[]) => {
    return compiler.compile(nodes, connections);
  }, [compiler]);

  return { compile };
};