/**
 * Indicator Dependency Resolver - Task BE-012
 * 
 * Advanced dependency resolution system for technical indicators.
 * Handles complex dependency graphs, circular dependency detection,
 * and optimal execution ordering for maximum performance.
 */

import { EventEmitter } from 'events';

// =============================================================================
// DEPENDENCY TYPES AND INTERFACES
// =============================================================================

export interface DependencyNode {
  id: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  metadata: {
    priority: number;
    estimatedProcessingTime: number;
    memoryUsage: number;
    tags: string[];
  };
}

export interface DependencyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: string[][];
}

export interface ExecutionPlan {
  levels: string[][]; // Indicators grouped by dependency level
  totalLevels: number;
  parallelizable: boolean;
  estimatedExecutionTime: number;
  criticalPath: string[];
  metadata: {
    totalIndicators: number;
    maxConcurrency: number;
    memoryRequired: number;
  };
}

export interface DependencyAnalysis {
  graph: Map<string, DependencyNode>;
  stronglyConnectedComponents: string[][];
  topologicalOrder: string[];
  criticalPath: string[];
  bottlenecks: string[];
  parallelizationOpportunities: Array<{
    level: number;
    indicators: string[];
    estimatedSpeedup: number;
  }>;
}

// =============================================================================
// DEPENDENCY RESOLVER IMPLEMENTATION
// =============================================================================

export class IndicatorDependencyResolver extends EventEmitter {
  private readonly dependencyGraph: Map<string, DependencyNode> = new Map();
  private readonly executionCache: Map<string, ExecutionPlan> = new Map();
  private readonly analysisCache: Map<string, DependencyAnalysis> = new Map();
  
  // Configuration
  private readonly maxDepth = 10;
  private readonly maxNodes = 1000;

  constructor() {
    super();
  }

  // =============================================================================
  // PUBLIC API - DEPENDENCY MANAGEMENT
  // =============================================================================

  /**
   * Add indicator to dependency graph
   */
  addIndicator(
    id: string, 
    dependencies: string[], 
    metadata: Partial<DependencyNode['metadata']> = {}
  ): void {
    if (this.dependencyGraph.has(id)) {
      throw new Error(`Indicator ${id} already exists in dependency graph`);
    }

    const node: DependencyNode = {
      id,
      dependencies: new Set(dependencies),
      dependents: new Set(),
      metadata: {
        priority: metadata.priority ?? 50,
        estimatedProcessingTime: metadata.estimatedProcessingTime ?? 10,
        memoryUsage: metadata.memoryUsage ?? 1024 * 1024, // 1MB default
        tags: metadata.tags ?? []
      }
    };

    this.dependencyGraph.set(id, node);

    // Update dependents for existing nodes
    dependencies.forEach(depId => {
      const depNode = this.dependencyGraph.get(depId);
      if (depNode) {
        depNode.dependents.add(id);
      }
    });

    // Clear caches as graph has changed
    this.clearCaches();

    this.emit('indicatorAdded', { id, dependencies, metadata: node.metadata });
  }

  /**
   * Remove indicator from dependency graph
   */
  removeIndicator(id: string): boolean {
    const node = this.dependencyGraph.get(id);
    if (!node) return false;

    // Remove from dependencies of dependent nodes
    node.dependents.forEach(dependentId => {
      const dependentNode = this.dependencyGraph.get(dependentId);
      if (dependentNode) {
        dependentNode.dependencies.delete(id);
      }
    });

    // Remove from dependents of dependency nodes
    node.dependencies.forEach(depId => {
      const depNode = this.dependencyGraph.get(depId);
      if (depNode) {
        depNode.dependents.delete(id);
      }
    });

    this.dependencyGraph.delete(id);
    this.clearCaches();

    this.emit('indicatorRemoved', { id });

    return true;
  }

  /**
   * Update indicator dependencies
   */
  updateDependencies(id: string, newDependencies: string[]): boolean {
    const node = this.dependencyGraph.get(id);
    if (!node) return false;

    const oldDependencies = Array.from(node.dependencies);

    // Remove from old dependencies' dependents
    oldDependencies.forEach(depId => {
      const depNode = this.dependencyGraph.get(depId);
      if (depNode) {
        depNode.dependents.delete(id);
      }
    });

    // Update dependencies
    node.dependencies = new Set(newDependencies);

    // Add to new dependencies' dependents
    newDependencies.forEach(depId => {
      const depNode = this.dependencyGraph.get(depId);
      if (depNode) {
        depNode.dependents.add(id);
      }
    });

    this.clearCaches();

    this.emit('dependenciesUpdated', { id, oldDependencies, newDependencies });

    return true;
  }

  // =============================================================================
  // PUBLIC API - VALIDATION AND ANALYSIS
  // =============================================================================

  /**
   * Validate dependencies for a set of indicators
   */
  validateDependencies(indicatorId: string, dependencies: string[]): DependencyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if dependencies exist
    dependencies.forEach(depId => {
      if (!this.dependencyGraph.has(depId)) {
        errors.push(`Dependency ${depId} does not exist`);
      }
    });

    // Create temporary node to check for circular dependencies
    const tempNode: DependencyNode = {
      id: indicatorId,
      dependencies: new Set(dependencies),
      dependents: new Set(),
      metadata: {
        priority: 50,
        estimatedProcessingTime: 10,
        memoryUsage: 1024 * 1024,
        tags: []
      }
    };

    // Temporarily add to graph for circular dependency check
    this.dependencyGraph.set(indicatorId, tempNode);
    
    const circularDependencies = this.detectCircularDependencies();
    const hasCircular = circularDependencies.length > 0;

    // Remove temporary node
    this.dependencyGraph.delete(indicatorId);

    if (hasCircular) {
      errors.push(`Circular dependencies detected: ${JSON.stringify(circularDependencies)}`);
    }

    // Check depth
    if (dependencies.length > 0) {
      const maxDepth = this.calculateMaxDepth(indicatorId, dependencies);
      if (maxDepth > this.maxDepth) {
        warnings.push(`Dependency depth (${maxDepth}) exceeds recommended maximum (${this.maxDepth})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      circularDependencies: hasCircular ? circularDependencies : []
    };
  }

  /**
   * Analyze entire dependency graph
   */
  analyzeDependencyGraph(): DependencyAnalysis {
    const cacheKey = this.generateGraphHash();
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    const analysis: DependencyAnalysis = {
      graph: new Map(this.dependencyGraph),
      stronglyConnectedComponents: this.findStronglyConnectedComponents(),
      topologicalOrder: this.topologicalSort(),
      criticalPath: this.findCriticalPath(),
      bottlenecks: this.identifyBottlenecks(),
      parallelizationOpportunities: this.findParallelizationOpportunities()
    };

    this.analysisCache.set(cacheKey, analysis);

    return analysis;
  }

  /**
   * Resolve execution order for given indicators
   */
  resolveExecutionOrder(indicatorIds: string[]): string[][] {
    const cacheKey = `execution_${indicatorIds.sort().join(',')}`;
    
    const cached = this.executionCache.get(cacheKey);
    if (cached) {
      return cached.levels;
    }

    const plan = this.createExecutionPlan(indicatorIds);
    this.executionCache.set(cacheKey, plan);

    return plan.levels;
  }

  /**
   * Create detailed execution plan
   */
  createExecutionPlan(indicatorIds: string[]): ExecutionPlan {
    // Validate all indicators exist
    const missingIndicators = indicatorIds.filter(id => !this.dependencyGraph.has(id));
    if (missingIndicators.length > 0) {
      throw new Error(`Missing indicators: ${missingIndicators.join(', ')}`);
    }

    // Get subgraph for requested indicators and their dependencies
    const relevantNodes = this.getRelevantNodes(indicatorIds);
    const subgraph = this.createSubgraph(relevantNodes);

    // Perform topological sort on subgraph
    const sortedNodes = this.topologicalSortSubgraph(subgraph);

    // Group into execution levels
    const levels = this.groupIntoLevels(sortedNodes, subgraph);

    // Calculate execution metadata
    const totalProcessingTime = this.calculateTotalProcessingTime(relevantNodes);
    const criticalPath = this.findCriticalPathInSubgraph(subgraph);
    const parallelProcessingTime = this.calculateParallelProcessingTime(levels);

    const plan: ExecutionPlan = {
      levels,
      totalLevels: levels.length,
      parallelizable: levels.some(level => level.length > 1),
      estimatedExecutionTime: parallelProcessingTime,
      criticalPath,
      metadata: {
        totalIndicators: relevantNodes.length,
        maxConcurrency: Math.max(...levels.map(level => level.length)),
        memoryRequired: this.calculateMemoryRequirement(relevantNodes)
      }
    };

    return plan;
  }

  // =============================================================================
  // PUBLIC API - GRAPH QUERIES
  // =============================================================================

  /**
   * Get direct dependencies of an indicator
   */
  getDependencies(indicatorId: string): string[] {
    const node = this.dependencyGraph.get(indicatorId);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Get direct dependents of an indicator
   */
  getDependents(indicatorId: string): string[] {
    const node = this.dependencyGraph.get(indicatorId);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Get all transitive dependencies (dependencies of dependencies)
   */
  getAllDependencies(indicatorId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.dependencyGraph.get(id);
      if (!node) return;

      node.dependencies.forEach(depId => {
        if (!visited.has(depId)) {
          result.push(depId);
          traverse(depId);
        }
      });
    };

    traverse(indicatorId);
    return result;
  }

  /**
   * Get all transitive dependents
   */
  getAllDependents(indicatorId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.dependencyGraph.get(id);
      if (!node) return;

      node.dependents.forEach(depId => {
        if (!visited.has(depId)) {
          result.push(depId);
          traverse(depId);
        }
      });
    };

    traverse(indicatorId);
    return result;
  }

  /**
   * Check if one indicator depends on another
   */
  dependsOn(indicatorId: string, dependencyId: string): boolean {
    const allDeps = this.getAllDependencies(indicatorId);
    return allDeps.includes(dependencyId);
  }

  /**
   * Get graph statistics
   */
  getGraphStatistics() {
    const nodes = Array.from(this.dependencyGraph.values());
    
    return {
      totalNodes: nodes.length,
      totalEdges: nodes.reduce((sum, node) => sum + node.dependencies.size, 0),
      averageDependencies: nodes.length > 0 ? 
        nodes.reduce((sum, node) => sum + node.dependencies.size, 0) / nodes.length : 0,
      maxDependencies: Math.max(...nodes.map(node => node.dependencies.size), 0),
      isolatedNodes: nodes.filter(node => 
        node.dependencies.size === 0 && node.dependents.size === 0
      ).length,
      leafNodes: nodes.filter(node => node.dependents.size === 0).length,
      rootNodes: nodes.filter(node => node.dependencies.size === 0).length
    };
  }

  // =============================================================================
  // PRIVATE METHODS - GRAPH ALGORITHMS
  // =============================================================================

  private detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart).concat(nodeId));
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.dependencyGraph.get(nodeId);
      if (node) {
        node.dependencies.forEach(depId => {
          dfs(depId, [...path, nodeId]);
        });
      }

      recursionStack.delete(nodeId);
    };

    this.dependencyGraph.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    });

    return cycles;
  }

  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degree count
    this.dependencyGraph.forEach((node, id) => {
      inDegree.set(id, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const node = this.dependencyGraph.get(nodeId);
      if (node) {
        node.dependents.forEach(dependentId => {
          const currentInDegree = inDegree.get(dependentId)! - 1;
          inDegree.set(dependentId, currentInDegree);

          if (currentInDegree === 0) {
            queue.push(dependentId);
          }
        });
      }
    }

    // Check if all nodes were processed (no cycles)
    if (result.length !== this.dependencyGraph.size) {
      throw new Error('Circular dependency detected in graph');
    }

    return result;
  }

  private findStronglyConnectedComponents(): string[][] {
    const stack: string[] = [];
    const visited = new Set<string>();
    const onStack = new Set<string>();
    const components: string[][] = [];
    const ids = new Map<string, number>();
    const lowLinks = new Map<string, number>();
    let id = 0;

    const tarjan = (nodeId: string): void => {
      stack.push(nodeId);
      onStack.add(nodeId);
      ids.set(nodeId, id);
      lowLinks.set(nodeId, id);
      id++;

      const node = this.dependencyGraph.get(nodeId);
      if (node) {
        node.dependencies.forEach(depId => {
          if (!ids.has(depId)) {
            tarjan(depId);
            lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(depId)!));
          } else if (onStack.has(depId)) {
            lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, ids.get(depId)!));
          }
        });
      }

      if (ids.get(nodeId) === lowLinks.get(nodeId)) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== nodeId);
        components.push(component);
      }
    };

    this.dependencyGraph.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        tarjan(nodeId);
      }
    });

    return components;
  }

  private findCriticalPath(): string[] {
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string | null>();

    // Initialize distances
    this.dependencyGraph.forEach((node, id) => {
      distances.set(id, node.metadata.estimatedProcessingTime);
      predecessors.set(id, null);
    });

    // Relax edges (longest path version of Bellman-Ford)
    const topOrder = this.topologicalSort();
    
    topOrder.forEach(nodeId => {
      const node = this.dependencyGraph.get(nodeId);
      if (!node) return;

      node.dependents.forEach(dependentId => {
        const currentDistance = distances.get(nodeId)! + 
          this.dependencyGraph.get(dependentId)!.metadata.estimatedProcessingTime;
        
        if (currentDistance > distances.get(dependentId)!) {
          distances.set(dependentId, currentDistance);
          predecessors.set(dependentId, nodeId);
        }
      });
    });

    // Find the node with maximum distance (end of critical path)
    let maxDistance = 0;
    let endNode = '';
    distances.forEach((distance, nodeId) => {
      if (distance > maxDistance) {
        maxDistance = distance;
        endNode = nodeId;
      }
    });

    // Reconstruct critical path
    const criticalPath: string[] = [];
    let current: string | null = endNode;
    
    while (current !== null) {
      criticalPath.unshift(current);
      current = predecessors.get(current) || null;
    }

    return criticalPath;
  }

  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    this.dependencyGraph.forEach((node, id) => {
      // A node is a bottleneck if it has many dependents
      // or high processing time relative to its dependencies
      const dependentCount = node.dependents.size;
      const processingTime = node.metadata.estimatedProcessingTime;

      if (dependentCount > 3 || processingTime > 100) { // Thresholds
        bottlenecks.push(id);
      }
    });

    return bottlenecks;
  }

  private findParallelizationOpportunities(): Array<{
    level: number;
    indicators: string[];
    estimatedSpeedup: number;
  }> {
    const opportunities: Array<{
      level: number;
      indicators: string[];
      estimatedSpeedup: number;
    }> = [];

    // Get execution levels for all indicators
    const allIndicators = Array.from(this.dependencyGraph.keys());
    const levels = this.resolveExecutionOrder(allIndicators);

    levels.forEach((levelIndicators, levelIndex) => {
      if (levelIndicators.length > 1) {
        // Calculate potential speedup
        const sequentialTime = levelIndicators.reduce((sum, id) => {
          const node = this.dependencyGraph.get(id);
          return sum + (node?.metadata.estimatedProcessingTime || 0);
        }, 0);

        const parallelTime = Math.max(...levelIndicators.map(id => {
          const node = this.dependencyGraph.get(id);
          return node?.metadata.estimatedProcessingTime || 0;
        }));

        const estimatedSpeedup = sequentialTime / parallelTime;

        opportunities.push({
          level: levelIndex,
          indicators: levelIndicators,
          estimatedSpeedup
        });
      }
    });

    return opportunities;
  }

  private getRelevantNodes(indicatorIds: string[]): string[] {
    const relevant = new Set<string>();

    const addDependencies = (id: string) => {
      if (relevant.has(id)) return;
      relevant.add(id);

      const node = this.dependencyGraph.get(id);
      if (node) {
        node.dependencies.forEach(depId => addDependencies(depId));
      }
    };

    indicatorIds.forEach(id => addDependencies(id));
    return Array.from(relevant);
  }

  private createSubgraph(nodeIds: string[]): Map<string, DependencyNode> {
    const subgraph = new Map<string, DependencyNode>();

    nodeIds.forEach(id => {
      const node = this.dependencyGraph.get(id);
      if (node) {
        const subNode: DependencyNode = {
          ...node,
          dependencies: new Set(
            Array.from(node.dependencies).filter(depId => nodeIds.includes(depId))
          ),
          dependents: new Set(
            Array.from(node.dependents).filter(depId => nodeIds.includes(depId))
          )
        };
        subgraph.set(id, subNode);
      }
    });

    return subgraph;
  }

  private topologicalSortSubgraph(subgraph: Map<string, DependencyNode>): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    subgraph.forEach((node, id) => {
      inDegree.set(id, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const node = subgraph.get(nodeId);
      if (node) {
        node.dependents.forEach(dependentId => {
          const currentInDegree = inDegree.get(dependentId)! - 1;
          inDegree.set(dependentId, currentInDegree);

          if (currentInDegree === 0) {
            queue.push(dependentId);
          }
        });
      }
    }

    return result;
  }

  private groupIntoLevels(sortedNodes: string[], subgraph: Map<string, DependencyNode>): string[][] {
    const levels: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < sortedNodes.length) {
      const currentLevel: string[] = [];

      sortedNodes.forEach(nodeId => {
        if (processed.has(nodeId)) return;

        const node = subgraph.get(nodeId);
        if (!node) return;

        // Check if all dependencies are processed
        const allDepsProcessed = Array.from(node.dependencies).every(depId => 
          processed.has(depId)
        );

        if (allDepsProcessed) {
          currentLevel.push(nodeId);
        }
      });

      currentLevel.forEach(nodeId => processed.add(nodeId));
      levels.push(currentLevel);
    }

    return levels;
  }

  private calculateMaxDepth(indicatorId: string, dependencies: string[]): number {
    const visited = new Set<string>();
    
    const dfs = (id: string): number => {
      if (visited.has(id)) return 0;
      visited.add(id);

      const node = this.dependencyGraph.get(id);
      if (!node || node.dependencies.size === 0) return 1;

      const maxDepth = Math.max(...Array.from(node.dependencies).map(depId => dfs(depId)));
      return maxDepth + 1;
    };

    return Math.max(...dependencies.map(depId => dfs(depId)));
  }

  private calculateTotalProcessingTime(nodeIds: string[]): number {
    return nodeIds.reduce((sum, id) => {
      const node = this.dependencyGraph.get(id);
      return sum + (node?.metadata.estimatedProcessingTime || 0);
    }, 0);
  }

  private calculateParallelProcessingTime(levels: string[][]): number {
    return levels.reduce((sum, level) => {
      const levelTime = Math.max(...level.map(id => {
        const node = this.dependencyGraph.get(id);
        return node?.metadata.estimatedProcessingTime || 0;
      }));
      return sum + levelTime;
    }, 0);
  }

  private calculateMemoryRequirement(nodeIds: string[]): number {
    return nodeIds.reduce((sum, id) => {
      const node = this.dependencyGraph.get(id);
      return sum + (node?.metadata.memoryUsage || 0);
    }, 0);
  }

  private findCriticalPathInSubgraph(subgraph: Map<string, DependencyNode>): string[] {
    // Simplified critical path for subgraph
    return this.findCriticalPath().filter(id => subgraph.has(id));
  }

  private generateGraphHash(): string {
    const graphData = Array.from(this.dependencyGraph.entries())
      .map(([id, node]) => ({
        id,
        deps: Array.from(node.dependencies).sort(),
        metadata: node.metadata
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return JSON.stringify(graphData);
  }

  private clearCaches(): void {
    this.executionCache.clear();
    this.analysisCache.clear();
  }
}

export default IndicatorDependencyResolver;