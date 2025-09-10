/**
 * Strategy Validation Engine - FE-010
 * 
 * Comprehensive validation engine for trading strategies with real-time feedback,
 * dependency analysis, and performance validation.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeData, ConnectionData } from '../nodes/NodeCanvas';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'structure' | 'logic' | 'performance' | 'risk' | 'compliance';
  severity: 'error' | 'warning' | 'info';
  validator: (nodes: NodeData[], connections: ConnectionData[]) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  nodeIds?: string[];
  connectionIds?: string[];
  suggestion?: string;
  metadata?: Record<string, any>;
}

export interface StrategyValidationReport {
  isValid: boolean;
  score: number; // 0-100
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
  performance: PerformanceValidation;
  structure: StructureValidation;
  dependencies: DependencyValidation[];
}

export interface ValidationError {
  id: string;
  ruleId: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  nodeIds: string[];
  suggestions: string[];
  fixable: boolean;
}

export interface ValidationWarning {
  id: string;
  ruleId: string;
  message: string;
  nodeIds: string[];
  impact: 'high' | 'medium' | 'low';
  suggestions: string[];
}

export interface ValidationInfo {
  id: string;
  ruleId: string;
  message: string;
  category: string;
  details: Record<string, any>;
}

export interface PerformanceValidation {
  estimatedLatency: number;
  memoryUsage: number;
  complexity: number;
  scalability: 'excellent' | 'good' | 'fair' | 'poor';
  bottlenecks: string[];
}

export interface StructureValidation {
  hasInputs: boolean;
  hasOutputs: boolean;
  hasSignals: boolean;
  isConnected: boolean;
  cyclesFree: boolean;
  depthScore: number;
  breadthScore: number;
}

export interface DependencyValidation {
  nodeId: string;
  dependencies: string[];
  isResolved: boolean;
  missingDependencies: string[];
  circularDependencies: string[];
}

export class StrategyValidationEngine {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Structure validation rules
    this.rules.push({
      id: 'has-input-nodes',
      name: 'Input Nodes Required',
      description: 'Strategy must have at least one input node (data source)',
      category: 'structure',
      severity: 'error',
      validator: (nodes) => ({
        isValid: nodes.some(n => n.type === 'input'),
        message: nodes.some(n => n.type === 'input') 
          ? 'Strategy has input nodes' 
          : 'Strategy must have at least one input node for market data',
        suggestion: 'Add a price data or volume input node to provide market data'
      })
    });

    this.rules.push({
      id: 'has-output-nodes',
      name: 'Output Nodes Required',
      description: 'Strategy must have output or signal nodes',
      category: 'structure',
      severity: 'error',
      validator: (nodes) => {
        const hasOutputs = nodes.some(n => n.type === 'output' || n.type === 'signal');
        return {
          isValid: hasOutputs,
          message: hasOutputs 
            ? 'Strategy has output/signal nodes' 
            : 'Strategy must have at least one output or signal node',
          suggestion: 'Add a buy/sell signal node or strategy output node'
        };
      }
    });

    this.rules.push({
      id: 'no-disconnected-nodes',
      name: 'All Nodes Connected',
      description: 'All nodes should be connected to the strategy flow',
      category: 'structure',
      severity: 'warning',
      validator: (nodes, connections) => {
        const connectedNodes = new Set<string>();
        connections.forEach(conn => {
          connectedNodes.add(conn.sourceNodeId);
          connectedNodes.add(conn.targetNodeId);
        });
        
        const disconnectedNodes = nodes.filter(n => !connectedNodes.has(n.id) && n.type !== 'input');
        return {
          isValid: disconnectedNodes.length === 0,
          message: disconnectedNodes.length === 0 
            ? 'All nodes are properly connected' 
            : `${disconnectedNodes.length} nodes are disconnected`,
          nodeIds: disconnectedNodes.map(n => n.id),
          suggestion: 'Connect all nodes to the strategy flow or remove unused nodes'
        };
      }
    });

    // Logic validation rules
    this.rules.push({
      id: 'no-circular-dependencies',
      name: 'No Circular Dependencies',
      description: 'Strategy should not have circular dependencies between nodes',
      category: 'logic',
      severity: 'error',
      validator: (nodes, connections) => {
        const graph = this.buildDependencyGraph(nodes, connections);
        const cycles = this.detectCycles(graph);
        
        return {
          isValid: cycles.length === 0,
          message: cycles.length === 0 
            ? 'No circular dependencies detected' 
            : `${cycles.length} circular dependencies found`,
          nodeIds: cycles.flat(),
          suggestion: 'Remove circular connections between nodes'
        };
      }
    });

    this.rules.push({
      id: 'required-inputs-connected',
      name: 'Required Inputs Connected',
      description: 'All required node inputs must be connected',
      category: 'logic',
      severity: 'error',
      validator: (nodes) => {
        const unconnectedRequired: string[] = [];
        
        nodes.forEach(node => {
          node.inputs?.forEach(input => {
            if (input.required && !input.connected) {
              unconnectedRequired.push(`${node.data.label || node.id}.${input.name}`);
            }
          });
        });

        return {
          isValid: unconnectedRequired.length === 0,
          message: unconnectedRequired.length === 0 
            ? 'All required inputs are connected' 
            : `${unconnectedRequired.length} required inputs not connected`,
          suggestion: `Connect these required inputs: ${unconnectedRequired.join(', ')}`
        };
      }
    });

    // Performance validation rules
    this.rules.push({
      id: 'complexity-check',
      name: 'Strategy Complexity',
      description: 'Strategy complexity should be manageable',
      category: 'performance',
      severity: 'warning',
      validator: (nodes) => {
        const complexity = this.calculateComplexity(nodes);
        const isValid = complexity < 50;
        
        return {
          isValid,
          message: isValid 
            ? `Strategy complexity is acceptable (${complexity})` 
            : `Strategy complexity is high (${complexity})`,
          suggestion: isValid ? undefined : 'Consider simplifying the strategy or breaking it into modules',
          metadata: { complexity }
        };
      }
    });

    // Risk validation rules  
    this.rules.push({
      id: 'has-risk-management',
      name: 'Risk Management Present',
      description: 'Strategy should include risk management nodes',
      category: 'risk',
      severity: 'warning',
      validator: (nodes) => {
        const hasRiskNodes = nodes.some(n => 
          n.type === 'stop-loss' || 
          n.type === 'position-size' || 
          n.category === 'risk-management'
        );
        
        return {
          isValid: hasRiskNodes,
          message: hasRiskNodes 
            ? 'Strategy includes risk management' 
            : 'Strategy lacks explicit risk management nodes',
          suggestion: 'Add stop-loss, position sizing, or other risk management nodes'
        };
      }
    });

    this.rules.push({
      id: 'position-sizing-present',
      name: 'Position Sizing Logic',
      description: 'Strategy should include position sizing logic',
      category: 'risk',
      severity: 'info',
      validator: (nodes) => {
        const hasPositionSizing = nodes.some(n => 
          n.type === 'position-size' || 
          n.data.parameters?.positionSizing
        );
        
        return {
          isValid: hasPositionSizing,
          message: hasPositionSizing 
            ? 'Strategy includes position sizing logic' 
            : 'Strategy may benefit from explicit position sizing',
          suggestion: 'Add position sizing node to optimize trade sizes'
        };
      }
    });
  }

  async validate(nodes: NodeData[], connections: ConnectionData[]): Promise<StrategyValidationReport> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // Run all validation rules
    for (const rule of this.rules) {
      try {
        const result = rule.validator(nodes, connections);
        
        if (!result.isValid) {
          const item = {
            id: `${rule.id}-${Date.now()}`,
            ruleId: rule.id,
            message: result.message,
            nodeIds: result.nodeIds || [],
            suggestions: result.suggestion ? [result.suggestion] : [],
            fixable: false // TODO: implement auto-fix capabilities
          };

          if (rule.severity === 'error') {
            errors.push({
              ...item,
              severity: 'major' as const
            });
          } else if (rule.severity === 'warning') {
            warnings.push({
              ...item,
              impact: 'medium' as const
            });
          }
        } else if (rule.severity === 'info') {
          info.push({
            id: `${rule.id}-${Date.now()}`,
            ruleId: rule.id,
            message: result.message,
            category: rule.category,
            details: result.metadata || {}
          });
        }
      } catch (error) {
        console.error(`Validation rule ${rule.id} failed:`, error);
      }
    }

    // Calculate performance metrics
    const performance = this.validatePerformance(nodes, connections);
    
    // Analyze structure
    const structure = this.validateStructure(nodes, connections);
    
    // Check dependencies
    const dependencies = this.validateDependencies(nodes, connections);

    // Calculate overall score
    const score = this.calculateScore(errors, warnings, performance, structure);

    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      info,
      performance,
      structure,
      dependencies
    };
  }

  private buildDependencyGraph(nodes: NodeData[], connections: ConnectionData[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Initialize all nodes
    nodes.forEach(node => {
      graph.set(node.id, []);
    });

    // Add dependencies
    connections.forEach(connection => {
      const deps = graph.get(connection.targetNodeId) || [];
      deps.push(connection.sourceNodeId);
      graph.set(connection.targetNodeId, deps);
    });

    return graph;
  }

  private detectCycles(graph: Map<string, string[]>): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];
    
    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart));
        return true;
      }
      
      if (visited.has(nodeId)) return false;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const deps = graph.get(nodeId) || [];
      for (const dep of deps) {
        if (dfs(dep, [...path])) return true;
      }
      
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  private calculateComplexity(nodes: NodeData[]): number {
    let complexity = 0;
    
    nodes.forEach(node => {
      switch (node.type) {
        case 'input':
        case 'output':
          complexity += 1;
          break;
        case 'indicator':
          complexity += 2;
          break;
        case 'condition':
        case 'logic':
          complexity += 3;
          break;
        case 'signal':
          complexity += 4;
          break;
        case 'ml-model':
          complexity += 8;
          break;
        case 'custom-code':
          complexity += 6;
          break;
        default:
          complexity += 2;
      }
    });

    return complexity;
  }

  private validatePerformance(nodes: NodeData[], connections: ConnectionData[]): PerformanceValidation {
    const complexity = this.calculateComplexity(nodes);
    const nodeCount = nodes.length;
    
    // Estimate latency based on node types
    let estimatedLatency = 0;
    nodes.forEach(node => {
      switch (node.type) {
        case 'ml-model':
          estimatedLatency += 50; // ML models are slower
          break;
        case 'indicator':
          estimatedLatency += 5;
          break;
        case 'custom-code':
          estimatedLatency += 20;
          break;
        default:
          estimatedLatency += 1;
      }
    });

    // Estimate memory usage
    const memoryUsage = nodeCount * 0.1 + nodes.filter(n => n.type === 'ml-model').length * 5;

    // Determine scalability
    let scalability: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (complexity > 80) scalability = 'poor';
    else if (complexity > 60) scalability = 'fair';
    else if (complexity > 40) scalability = 'good';

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    if (nodes.filter(n => n.type === 'ml-model').length > 3) {
      bottlenecks.push('Multiple ML models may cause performance issues');
    }
    if (estimatedLatency > 100) {
      bottlenecks.push('High estimated latency');
    }

    return {
      estimatedLatency,
      memoryUsage,
      complexity,
      scalability,
      bottlenecks
    };
  }

  private validateStructure(nodes: NodeData[], connections: ConnectionData[]): StructureValidation {
    const hasInputs = nodes.some(n => n.type === 'input');
    const hasOutputs = nodes.some(n => n.type === 'output' || n.type === 'signal');
    const hasSignals = nodes.some(n => n.type === 'signal');
    
    // Check if all nodes are connected
    const connectedNodes = new Set<string>();
    connections.forEach(conn => {
      connectedNodes.add(conn.sourceNodeId);
      connectedNodes.add(conn.targetNodeId);
    });
    const isConnected = nodes.every(n => connectedNodes.has(n.id) || n.type === 'input');

    // Check for cycles
    const graph = this.buildDependencyGraph(nodes, connections);
    const cycles = this.detectCycles(graph);
    const cyclesFree = cycles.length === 0;

    // Calculate depth and breadth scores
    const depthScore = this.calculateDepthScore(nodes, connections);
    const breadthScore = this.calculateBreadthScore(nodes);

    return {
      hasInputs,
      hasOutputs, 
      hasSignals,
      isConnected,
      cyclesFree,
      depthScore,
      breadthScore
    };
  }

  private validateDependencies(nodes: NodeData[], connections: ConnectionData[]): DependencyValidation[] {
    const graph = this.buildDependencyGraph(nodes, connections);
    const cycles = this.detectCycles(graph);
    
    return nodes.map(node => {
      const dependencies = graph.get(node.id) || [];
      const circularDeps = cycles.find(cycle => cycle.includes(node.id)) || [];
      const missingDeps = dependencies.filter(depId => !nodes.find(n => n.id === depId));
      
      return {
        nodeId: node.id,
        dependencies,
        isResolved: missingDeps.length === 0 && circularDeps.length === 0,
        missingDependencies: missingDeps,
        circularDependencies: circularDeps
      };
    });
  }

  private calculateDepthScore(nodes: NodeData[], connections: ConnectionData[]): number {
    // Calculate the maximum depth of the strategy graph
    const graph = this.buildDependencyGraph(nodes, connections);
    const depths = new Map<string, number>();
    
    const calculateDepth = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return 0; // Avoid cycles
      if (depths.has(nodeId)) return depths.get(nodeId)!;
      
      visited.add(nodeId);
      const deps = graph.get(nodeId) || [];
      const maxDepDepth = Math.max(0, ...deps.map(dep => calculateDepth(dep, new Set(visited))));
      const depth = maxDepDepth + 1;
      
      depths.set(nodeId, depth);
      return depth;
    };

    const allDepths = nodes.map(node => calculateDepth(node.id, new Set()));
    return Math.max(...allDepths, 1);
  }

  private calculateBreadthScore(nodes: NodeData[]): number {
    // Count nodes by type to measure breadth
    const typeCount = new Map<string, number>();
    nodes.forEach(node => {
      typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1);
    });
    
    return typeCount.size; // Number of different node types
  }

  private calculateScore(
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    performance: PerformanceValidation, 
    structure: StructureValidation
  ): number {
    let score = 100;
    
    // Deduct for errors
    score -= errors.length * 15;
    
    // Deduct for warnings
    score -= warnings.length * 5;
    
    // Performance factor
    if (performance.scalability === 'poor') score -= 20;
    else if (performance.scalability === 'fair') score -= 10;
    else if (performance.scalability === 'good') score -= 5;
    
    // Structure bonuses
    if (structure.hasInputs && structure.hasOutputs) score += 10;
    if (structure.isConnected) score += 10;
    if (structure.cyclesFree) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  public addCustomRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  public removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  public getRules(): ValidationRule[] {
    return [...this.rules];
  }
}

// Hook for using the validation engine
export const useStrategyValidation = () => {
  const [engine] = useState(() => new StrategyValidationEngine());
  
  const validate = useCallback(async (nodes: NodeData[], connections: ConnectionData[]) => {
    return engine.validate(nodes, connections);
  }, [engine]);

  const addCustomRule = useCallback((rule: ValidationRule) => {
    engine.addCustomRule(rule);
  }, [engine]);

  return {
    validate,
    addCustomRule,
    engine
  };
};