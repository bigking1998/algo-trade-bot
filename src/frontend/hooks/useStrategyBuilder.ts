import { useState, useCallback, useReducer, useEffect } from 'react';
import {
  StrategyBuilderState,
  VisualStrategyDefinition,
  StrategyNode,
  StrategyConnection,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PreviewData,
} from '../types/strategy';

// Action types for the strategy builder reducer
type StrategyBuilderAction =
  | { type: 'LOAD_STRATEGY'; payload: VisualStrategyDefinition }
  | { type: 'UPDATE_NODES'; payload: StrategyNode[] }
  | { type: 'UPDATE_CONNECTIONS'; payload: StrategyConnection[] }
  | { type: 'SELECT_NODES'; payload: string[] }
  | { type: 'SELECT_CONNECTIONS'; payload: string[] }
  | { type: 'SET_VALIDATION'; payload: ValidationResult }
  | { type: 'SET_PREVIEW'; payload: { isRunning: boolean; data?: PreviewData; error?: string } }
  | { type: 'SET_MODE'; payload: 'visual' | 'code' | 'hybrid' }
  | { type: 'COPY_SELECTION'; payload: { nodes: StrategyNode[]; connections: StrategyConnection[] } }
  | { type: 'PASTE_SELECTION' }
  | { type: 'SAVE_HISTORY'; payload: VisualStrategyDefinition }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' };

const initialState: StrategyBuilderState = {
  nodes: [],
  connections: [],
  selectedNodes: [],
  selectedConnections: [],
  history: {
    past: [],
    future: [],
  },
  validation: {
    isValid: true,
    errors: [],
    warnings: [],
  },
  preview: {
    isRunning: false,
  },
  mode: 'visual',
};

function strategyBuilderReducer(
  state: StrategyBuilderState,
  action: StrategyBuilderAction
): StrategyBuilderState {
  switch (action.type) {
    case 'LOAD_STRATEGY':
      return {
        ...state,
        currentStrategy: action.payload,
        nodes: action.payload.nodes,
        connections: action.payload.connections,
        selectedNodes: [],
        selectedConnections: [],
      };

    case 'UPDATE_NODES':
      return {
        ...state,
        nodes: action.payload,
      };

    case 'UPDATE_CONNECTIONS':
      return {
        ...state,
        connections: action.payload,
      };

    case 'SELECT_NODES':
      return {
        ...state,
        selectedNodes: action.payload,
      };

    case 'SELECT_CONNECTIONS':
      return {
        ...state,
        selectedConnections: action.payload,
      };

    case 'SET_VALIDATION':
      return {
        ...state,
        validation: action.payload,
      };

    case 'SET_PREVIEW':
      return {
        ...state,
        preview: action.payload,
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
      };

    case 'COPY_SELECTION':
      return {
        ...state,
        clipboard: action.payload,
      };

    case 'PASTE_SELECTION':
      if (!state.clipboard) return state;
      
      // Generate new IDs for pasted nodes and connections
      const idMap = new Map<string, string>();
      const newNodes = state.clipboard.nodes.map(node => {
        const newId = `${node.id}-${Date.now()}-${Math.random()}`;
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          position: {
            x: node.position.x + 20,
            y: node.position.y + 20,
          },
        };
      });

      const newConnections = state.clipboard.connections
        .map(connection => {
          const newSourceId = idMap.get(connection.sourceNodeId);
          const newTargetId = idMap.get(connection.targetNodeId);
          
          if (!newSourceId || !newTargetId) return null;
          
          return {
            ...connection,
            id: `${connection.id}-${Date.now()}-${Math.random()}`,
            sourceNodeId: newSourceId,
            targetNodeId: newTargetId,
          };
        })
        .filter(Boolean) as StrategyConnection[];

      return {
        ...state,
        nodes: [...state.nodes, ...newNodes],
        connections: [...state.connections, ...newConnections],
        selectedNodes: newNodes.map(node => node.id),
        selectedConnections: newConnections.map(conn => conn.id),
      };

    case 'SAVE_HISTORY':
      return {
        ...state,
        history: {
          past: [action.payload, ...state.history.past.slice(0, 49)], // Keep last 50 states
          future: [], // Clear future when new action is performed
        },
      };

    case 'UNDO':
      if (state.history.past.length === 0) return state;
      
      const previousState = state.history.past[0];
      const newPast = state.history.past.slice(1);
      
      return {
        ...state,
        currentStrategy: previousState,
        nodes: previousState.nodes,
        connections: previousState.connections,
        history: {
          past: newPast,
          future: state.currentStrategy 
            ? [state.currentStrategy, ...state.history.future]
            : state.history.future,
        },
      };

    case 'REDO':
      if (state.history.future.length === 0) return state;
      
      const nextState = state.history.future[0];
      const newFuture = state.history.future.slice(1);
      
      return {
        ...state,
        currentStrategy: nextState,
        nodes: nextState.nodes,
        connections: nextState.connections,
        history: {
          past: state.currentStrategy
            ? [state.currentStrategy, ...state.history.past]
            : state.history.past,
          future: newFuture,
        },
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: {
          past: [],
          future: [],
        },
      };

    default:
      return state;
  }
}

export function useStrategyBuilder() {
  const [state, dispatch] = useReducer(strategyBuilderReducer, initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-validation when nodes or connections change
  useEffect(() => {
    const validateStrategy = () => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Validate nodes
      state.nodes.forEach(node => {
        // Check for unconnected required inputs
        node.data.inputs.forEach(input => {
          if (input.required) {
            const hasConnection = state.connections.some(
              conn => conn.targetNodeId === node.id && conn.targetPortId === input.id
            );
            if (!hasConnection) {
              errors.push({
                nodeId: node.id,
                type: 'connection',
                message: `Required input '${input.name}' is not connected`,
                severity: 'error',
              });
            }
          }
        });

        // Check for invalid parameters
        if (node.type === 'indicator') {
          const period = node.data.parameters.period;
          if (!period || period < 1) {
            errors.push({
              nodeId: node.id,
              type: 'parameter',
              message: 'Period must be greater than 0',
              severity: 'error',
            });
          } else if (period > 1000) {
            warnings.push({
              nodeId: node.id,
              type: 'performance',
              message: 'Large period values may impact performance',
              suggestion: 'Consider using a smaller period for better performance',
            });
          }
        }
      });

      // Check for cycles in connections
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        recursionStack.add(nodeId);

        const outgoingConnections = state.connections.filter(
          conn => conn.sourceNodeId === nodeId
        );

        for (const connection of outgoingConnections) {
          if (hasCycle(connection.targetNodeId)) return true;
        }

        recursionStack.delete(nodeId);
        return false;
      };

      state.nodes.forEach(node => {
        if (!visited.has(node.id) && hasCycle(node.id)) {
          errors.push({
            type: 'logic',
            message: 'Strategy contains circular dependencies',
            severity: 'error',
          });
        }
      });

      // Check for isolated nodes (no connections)
      state.nodes.forEach(node => {
        const hasConnections = state.connections.some(
          conn => conn.sourceNodeId === node.id || conn.targetNodeId === node.id
        );
        if (!hasConnections && state.nodes.length > 1) {
          warnings.push({
            nodeId: node.id,
            type: 'optimization',
            message: 'Node is not connected to any other nodes',
            suggestion: 'Connect this node or remove it from the strategy',
          });
        }
      });

      // Check for missing entry/exit signals
      const hasEntrySignals = state.nodes.some(
        node => node.type === 'signal' && (
          node.name.toLowerCase().includes('buy') || 
          node.name.toLowerCase().includes('entry')
        )
      );
      const hasExitSignals = state.nodes.some(
        node => node.type === 'signal' && (
          node.name.toLowerCase().includes('sell') || 
          node.name.toLowerCase().includes('exit')
        )
      );

      if (!hasEntrySignals && state.nodes.length > 0) {
        warnings.push({
          type: 'logic',
          message: 'Strategy has no entry signals',
          suggestion: 'Add entry signal nodes to generate trading signals',
        });
      }

      if (!hasExitSignals && state.nodes.length > 0) {
        warnings.push({
          type: 'logic',
          message: 'Strategy has no exit signals',
          suggestion: 'Add exit signal nodes to close positions',
        });
      }

      dispatch({
        type: 'SET_VALIDATION',
        payload: {
          isValid: errors.length === 0,
          errors,
          warnings,
        },
      });
    };

    validateStrategy();
  }, [state.nodes, state.connections]);

  const createNewStrategy = useCallback(() => {
    const newStrategy: VisualStrategyDefinition = {
      id: `strategy-${Date.now()}`,
      name: 'New Strategy',
      description: 'A new trading strategy',
      nodes: [],
      connections: [],
      config: {
        name: 'New Strategy',
        description: 'A new trading strategy',
        version: '1.0.0',
        author: 'User',
        timeframe: '1h',
        indicators: {},
        entryConditions: { long: [], short: [] },
        exitConditions: { long: [], short: [] },
        riskManagement: {},
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        author: 'User',
        tags: [],
      },
    };

    dispatch({ type: 'CLEAR_HISTORY' });
    dispatch({ type: 'LOAD_STRATEGY', payload: newStrategy });
  }, []);

  const loadStrategy = useCallback((strategy: VisualStrategyDefinition) => {
    // Save current state to history before loading new strategy
    if (state.currentStrategy) {
      dispatch({ type: 'SAVE_HISTORY', payload: state.currentStrategy });
    }
    dispatch({ type: 'LOAD_STRATEGY', payload: strategy });
  }, [state.currentStrategy]);

  const saveStrategy = useCallback(async (strategy: VisualStrategyDefinition) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call to save strategy
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedStrategy = {
        ...strategy,
        metadata: {
          ...strategy.metadata,
          updatedAt: new Date(),
        },
      };

      dispatch({ type: 'LOAD_STRATEGY', payload: updatedStrategy });
      
      // In real implementation, this would make an API call
      console.log('Strategy saved:', updatedStrategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save strategy');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateStrategy = useCallback((strategy: VisualStrategyDefinition) => {
    // Validation is automatic based on useEffect, but this can trigger manual validation
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Additional manual validation logic can be added here
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, []);

  const previewStrategy = useCallback(async () => {
    if (!state.currentStrategy) return;

    dispatch({ type: 'SET_PREVIEW', payload: { isRunning: true } });

    try {
      // Simulate strategy preview
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockPreviewData: PreviewData = {
        indicators: {
          'SMA_20': [100, 101, 102, 103, 104],
          'RSI_14': [45, 50, 55, 60, 65],
        },
        signals: [
          {
            id: 'signal-1',
            timestamp: Date.now(),
            type: 'entry',
            side: 'long',
            price: 45000,
            confidence: 0.85,
            reason: 'SMA crossover',
          },
        ],
        performance: {
          value: 10500,
          change: 500,
          changePercent: 5.0,
        },
      };

      dispatch({
        type: 'SET_PREVIEW',
        payload: {
          isRunning: false,
          data: mockPreviewData,
        },
      });
    } catch (err) {
      dispatch({
        type: 'SET_PREVIEW',
        payload: {
          isRunning: false,
          error: err instanceof Error ? err.message : 'Preview failed',
        },
      });
    }
  }, [state.currentStrategy]);

  const exportStrategy = useCallback(() => {
    if (!state.currentStrategy) return;

    const dataStr = JSON.stringify(state.currentStrategy, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.currentStrategy.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.currentStrategy]);

  const importStrategy = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const strategy = JSON.parse(e.target?.result as string) as VisualStrategyDefinition;
        
        // Validate imported strategy structure
        if (!strategy.id || !strategy.name || !strategy.nodes || !strategy.connections) {
          throw new Error('Invalid strategy file format');
        }

        dispatch({ type: 'LOAD_STRATEGY', payload: strategy });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import strategy');
      }
    };
    reader.readAsText(file);
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const copySelection = useCallback(() => {
    const selectedNodeObjects = state.nodes.filter(node => 
      state.selectedNodes.includes(node.id)
    );
    const selectedConnectionObjects = state.connections.filter(conn => 
      state.selectedConnections.includes(conn.id)
    );

    dispatch({
      type: 'COPY_SELECTION',
      payload: {
        nodes: selectedNodeObjects,
        connections: selectedConnectionObjects,
      },
    });
  }, [state.nodes, state.connections, state.selectedNodes, state.selectedConnections]);

  const pasteSelection = useCallback(() => {
    dispatch({ type: 'PASTE_SELECTION' });
  }, []);

  return {
    state,
    isLoading,
    error,
    actions: {
      createNewStrategy,
      loadStrategy,
      saveStrategy,
      validateStrategy,
      previewStrategy,
      exportStrategy,
      importStrategy,
      undo,
      redo,
      copySelection,
      pasteSelection,
    },
  };
}