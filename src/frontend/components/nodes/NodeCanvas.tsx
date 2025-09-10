/**
 * Node Canvas - Core Component
 * 
 * Advanced node-based visual programming interface featuring drag-and-drop
 * nodes, connection system, zoom/pan capabilities, and real-time validation.
 * Built for creating visual trading strategies and data flow graphs.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  Plus,
  Minus,
  Move,
  Trash2,
  Copy,
  Save,
  Upload,
  Download,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Square,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  MousePointer,
  Hand,
  Target
} from 'lucide-react';

// Types for the node system
export interface NodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  inputs?: NodePort[];
  outputs?: NodePort[];
  selected?: boolean;
  dragging?: boolean;
}

export interface NodePort {
  id: string;
  name: string;
  type: string;
  dataType: 'number' | 'string' | 'boolean' | 'signal' | 'data' | 'any';
  required?: boolean;
  connected?: boolean;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  animated?: boolean;
  color?: string;
}

export interface CanvasState {
  nodes: NodeData[];
  connections: Connection[];
  zoom: number;
  pan: { x: number; y: number };
  selectedNodes: string[];
  dragState: {
    isDragging: boolean;
    dragType: 'node' | 'canvas' | 'selection' | 'connection' | null;
    startPos?: { x: number; y: number };
    currentPos?: { x: number; y: number };
    dragData?: any;
  };
  tool: 'select' | 'pan' | 'connect';
  grid: boolean;
  snapToGrid: boolean;
}

interface NodeCanvasProps {
  className?: string;
  nodes: NodeData[];
  connections: Connection[];
  onNodesChange: (nodes: NodeData[]) => void;
  onConnectionsChange: (connections: Connection[]) => void;
  onNodeSelect?: (nodeIds: string[]) => void;
  readonly?: boolean;
}

// Port Component
const NodePort: React.FC<{
  port: NodePort;
  isOutput?: boolean;
  nodeId: string;
  onConnectionStart?: (nodeId: string, portId: string, isOutput: boolean) => void;
  onConnectionEnd?: (nodeId: string, portId: string, isOutput: boolean) => void;
  connecting?: boolean;
}> = ({ port, isOutput = false, nodeId, onConnectionStart, onConnectionEnd, connecting }) => {
  const getPortColor = (dataType: string, connected: boolean) => {
    const colors = {
      number: connected ? '#3B82F6' : '#93C5FD',      // Blue
      string: connected ? '#10B981' : '#6EE7B7',       // Green  
      boolean: connected ? '#F59E0B' : '#FCD34D',      // Yellow
      signal: connected ? '#EF4444' : '#F87171',       // Red
      data: connected ? '#8B5CF6' : '#C4B5FD',         // Purple
      any: connected ? '#6B7280' : '#9CA3AF'           // Gray
    };
    return colors[dataType] || colors.any;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConnectionStart) {
      onConnectionStart(nodeId, port.id, isOutput);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConnectionEnd) {
      onConnectionEnd(nodeId, port.id, isOutput);
    }
  };

  return (
    <div
      className={`flex items-center space-x-2 py-1 ${isOutput ? 'flex-row-reverse space-x-reverse' : ''}`}
    >
      <div
        className={`w-3 h-3 rounded-full border-2 border-white cursor-pointer transition-all hover:scale-110 ${
          connecting ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: getPortColor(port.dataType, port.connected || false) }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        title={`${port.name} (${port.dataType})`}
      />
      <span className={`text-xs font-medium ${isOutput ? 'text-right' : ''}`}>
        {port.name}
      </span>
      {port.required && (
        <span className="text-xs text-red-500">*</span>
      )}
    </div>
  );
};

// Node Component
const VisualNode: React.FC<{
  node: NodeData;
  selected: boolean;
  onSelect: (nodeId: string, multiSelect?: boolean) => void;
  onDragStart: (nodeId: string, startPos: { x: number; y: number }) => void;
  onConnectionStart?: (nodeId: string, portId: string, isOutput: boolean) => void;
  onConnectionEnd?: (nodeId: string, portId: string, isOutput: boolean) => void;
  connecting?: boolean;
}> = ({ node, selected, onSelect, onDragStart, onConnectionStart, onConnectionEnd, connecting }) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      const rect = nodeRef.current?.getBoundingClientRect();
      if (rect) {
        const startPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        onDragStart(node.id, startPos);
        onSelect(node.id, e.ctrlKey || e.metaKey);
      }
    }
  };

  const getNodeColor = (type: string) => {
    const colors = {
      'indicator': '#3B82F6',      // Blue
      'condition': '#10B981',      // Green
      'signal': '#EF4444',         // Red
      'logic': '#F59E0B',          // Yellow
      'input': '#8B5CF6',          // Purple
      'output': '#EC4899',         // Pink
      'math': '#06B6D4',           // Cyan
      'custom': '#6B7280'          // Gray
    };
    return colors[type] || colors.custom;
  };

  return (
    <div
      ref={nodeRef}
      className={`absolute bg-white rounded-lg shadow-lg border-2 transition-all cursor-move select-none min-w-48 ${
        selected ? 'border-blue-500 shadow-xl' : 'border-gray-200 hover:border-gray-300'
      } ${node.dragging ? 'shadow-2xl opacity-90' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        zIndex: selected ? 1000 : 100
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Node Header */}
      <div
        className="px-3 py-2 rounded-t-lg text-white font-semibold text-sm flex items-center justify-between"
        style={{ backgroundColor: getNodeColor(node.type) }}
      >
        <span>{node.data.label || node.type}</span>
        <Badge variant="secondary" className="text-xs bg-white bg-opacity-20">
          {node.type}
        </Badge>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2">
        {/* Node specific content based on type */}
        {node.data.description && (
          <p className="text-xs text-gray-600 mb-2">{node.data.description}</p>
        )}
        
        {/* Parameters/Settings preview */}
        {node.data.parameters && Object.keys(node.data.parameters).length > 0 && (
          <div className="mb-2 space-y-1">
            {Object.entries(node.data.parameters).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-gray-500">{key}:</span>
                <span className="font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Ports */}
      {node.inputs && node.inputs.length > 0 && (
        <div className="px-3 pb-2 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-500 mb-1">Inputs</div>
          {node.inputs.map(port => (
            <NodePort
              key={port.id}
              port={port}
              nodeId={node.id}
              onConnectionStart={onConnectionStart}
              onConnectionEnd={onConnectionEnd}
              connecting={connecting}
            />
          ))}
        </div>
      )}

      {/* Output Ports */}
      {node.outputs && node.outputs.length > 0 && (
        <div className="px-3 pb-2 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-500 mb-1 text-right">Outputs</div>
          {node.outputs.map(port => (
            <NodePort
              key={port.id}
              port={port}
              isOutput={true}
              nodeId={node.id}
              onConnectionStart={onConnectionStart}
              onConnectionEnd={onConnectionEnd}
              connecting={connecting}
            />
          ))}
        </div>
      )}

      {/* Selection indicator */}
      {selected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
};

// Connection Component
const ConnectionLine: React.FC<{
  connection: Connection;
  nodes: NodeData[];
  selected?: boolean;
  onSelect?: (connectionId: string) => void;
}> = ({ connection, nodes, selected, onSelect }) => {
  const sourceNode = nodes.find(n => n.id === connection.sourceNodeId);
  const targetNode = nodes.find(n => n.id === connection.targetNodeId);
  
  if (!sourceNode || !targetNode) return null;

  const sourcePort = sourceNode.outputs?.find(p => p.id === connection.sourcePortId);
  const targetPort = targetNode.inputs?.find(p => p.id === connection.targetPortId);
  
  if (!sourcePort || !targetPort) return null;

  // Calculate port positions (simplified)
  const sourcePos = {
    x: sourceNode.position.x + 192, // Node width
    y: sourceNode.position.y + 60   // Approximate port position
  };
  
  const targetPos = {
    x: targetNode.position.x,
    y: targetNode.position.y + 60
  };

  const midX = (sourcePos.x + targetPos.x) / 2;
  const offsetX = Math.abs(sourcePos.x - targetPos.x) * 0.5;

  const path = `M ${sourcePos.x} ${sourcePos.y} 
                C ${sourcePos.x + offsetX} ${sourcePos.y},
                  ${targetPos.x - offsetX} ${targetPos.y},
                  ${targetPos.x} ${targetPos.y}`;

  return (
    <g>
      <path
        d={path}
        stroke={connection.color || '#6B7280'}
        strokeWidth={selected ? 3 : 2}
        fill="none"
        className={`cursor-pointer transition-all ${
          connection.animated ? 'animate-pulse' : ''
        } ${selected ? 'stroke-blue-500' : 'hover:stroke-gray-800'}`}
        onClick={() => onSelect?.(connection.id)}
        markerEnd="url(#arrowhead)"
      />
      
      {/* Connection label */}
      <text
        x={midX}
        y={sourcePos.y + (targetPos.y - sourcePos.y) / 2 - 5}
        textAnchor="middle"
        className="text-xs fill-gray-500 font-medium pointer-events-none"
      >
        {sourcePort.dataType}
      </text>
    </g>
  );
};

// Main Node Canvas Component
export const NodeCanvas: React.FC<NodeCanvasProps> = ({
  className,
  nodes,
  connections,
  onNodesChange,
  onConnectionsChange,
  onNodeSelect,
  readonly = false
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    nodes: [],
    connections: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedNodes: [],
    dragState: {
      isDragging: false,
      dragType: null
    },
    tool: 'select',
    grid: true,
    snapToGrid: false
  });

  const [connecting, setConnecting] = useState<{
    sourceNodeId: string;
    sourcePortId: string;
    isOutput: boolean;
  } | null>(null);

  // Zoom controls
  const handleZoomIn = () => {
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, 3)
    }));
  };

  const handleZoomOut = () => {
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, 0.1)
    }));
  };

  const handleResetView = () => {
    setCanvasState(prev => ({
      ...prev,
      zoom: 1,
      pan: { x: 0, y: 0 }
    }));
  };

  // Node selection
  const handleNodeSelect = useCallback((nodeId: string, multiSelect: boolean = false) => {
    setCanvasState(prev => {
      let newSelected: string[];
      if (multiSelect) {
        newSelected = prev.selectedNodes.includes(nodeId)
          ? prev.selectedNodes.filter(id => id !== nodeId)
          : [...prev.selectedNodes, nodeId];
      } else {
        newSelected = [nodeId];
      }
      
      onNodeSelect?.(newSelected);
      return { ...prev, selectedNodes: newSelected };
    });
  }, [onNodeSelect]);

  // Drag handling
  const handleDragStart = useCallback((nodeId: string, startPos: { x: number; y: number }) => {
    if (readonly) return;
    
    setCanvasState(prev => ({
      ...prev,
      dragState: {
        isDragging: true,
        dragType: 'node',
        startPos,
        dragData: { nodeId }
      }
    }));

    const updatedNodes = nodes.map(node => 
      node.id === nodeId ? { ...node, dragging: true } : node
    );
    onNodesChange(updatedNodes);
  }, [nodes, onNodesChange, readonly]);

  // Connection handling
  const handleConnectionStart = useCallback((nodeId: string, portId: string, isOutput: boolean) => {
    if (readonly) return;
    setConnecting({ sourceNodeId: nodeId, sourcePortId: portId, isOutput });
  }, [readonly]);

  const handleConnectionEnd = useCallback((nodeId: string, portId: string, isOutput: boolean) => {
    if (readonly || !connecting) return;

    // Only allow connections from output to input
    if (connecting.isOutput && !isOutput) {
      const newConnection: Connection = {
        id: `conn_${Date.now()}`,
        sourceNodeId: connecting.sourceNodeId,
        sourcePortId: connecting.sourcePortId,
        targetNodeId: nodeId,
        targetPortId: portId,
        animated: true,
        color: '#3B82F6'
      };

      onConnectionsChange([...connections, newConnection]);
    }
    
    setConnecting(null);
  }, [connecting, connections, onConnectionsChange, readonly]);

  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasState.dragState.isDragging || readonly) return;

      if (canvasState.dragState.dragType === 'node' && canvasState.dragState.dragData?.nodeId) {
        const nodeId = canvasState.dragState.dragData.nodeId;
        const deltaX = e.movementX / canvasState.zoom;
        const deltaY = e.movementY / canvasState.zoom;

        const updatedNodes = nodes.map(node => {
          if (node.id === nodeId || canvasState.selectedNodes.includes(node.id)) {
            let newX = node.position.x + deltaX;
            let newY = node.position.y + deltaY;

            // Snap to grid if enabled
            if (canvasState.snapToGrid) {
              const gridSize = 20;
              newX = Math.round(newX / gridSize) * gridSize;
              newY = Math.round(newY / gridSize) * gridSize;
            }

            return {
              ...node,
              position: { x: newX, y: newY }
            };
          }
          return node;
        });
        
        onNodesChange(updatedNodes);
      }
    };

    const handleMouseUp = () => {
      if (canvasState.dragState.isDragging) {
        setCanvasState(prev => ({
          ...prev,
          dragState: {
            isDragging: false,
            dragType: null,
            dragData: null
          }
        }));

        const updatedNodes = nodes.map(node => ({ ...node, dragging: false }));
        onNodesChange(updatedNodes);
      }
      setConnecting(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [canvasState, nodes, onNodesChange, readonly]);

  // Canvas click handler
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setCanvasState(prev => ({ ...prev, selectedNodes: [] }));
      onNodeSelect?.([]);
    }
  };

  return (
    <div className={`relative w-full h-full bg-gray-50 overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border p-2 flex items-center space-x-2">
        <Button
          variant={canvasState.tool === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCanvasState(prev => ({ ...prev, tool: 'select' }))}
        >
          <MousePointer className="h-4 w-4" />
        </Button>
        
        <Button
          variant={canvasState.tool === 'pan' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCanvasState(prev => ({ ...prev, tool: 'pan' }))}
        >
          <Hand className="h-4 w-4" />
        </Button>
        
        <Button
          variant={canvasState.tool === 'connect' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCanvasState(prev => ({ ...prev, tool: 'connect' }))}
        >
          <Target className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300" />

        <Button variant="outline" size="sm" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        
        <span className="text-sm font-medium px-2">
          {Math.round(canvasState.zoom * 100)}%
        </span>
        
        <Button variant="outline" size="sm" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <Button variant="outline" size="sm" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex items-center space-x-1">
          <Switch
            checked={canvasState.grid}
            onCheckedChange={(checked) => 
              setCanvasState(prev => ({ ...prev, grid: checked }))
            }
            id="grid"
          />
          <Label htmlFor="grid" className="text-xs">Grid</Label>
        </div>

        <div className="flex items-center space-x-1">
          <Switch
            checked={canvasState.snapToGrid}
            onCheckedChange={(checked) => 
              setCanvasState(prev => ({ ...prev, snapToGrid: checked }))
            }
            id="snap"
          />
          <Label htmlFor="snap" className="text-xs">Snap</Label>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className="w-full h-full cursor-default"
        style={{
          transform: `scale(${canvasState.zoom}) translate(${canvasState.pan.x}px, ${canvasState.pan.y}px)`,
          transformOrigin: 'top left'
        }}
        onClick={handleCanvasClick}
      >
        {/* Grid Background */}
        {canvasState.grid && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
        )}

        {/* Connections SVG Layer */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6B7280"
              />
            </marker>
          </defs>
          
          {connections.map(connection => (
            <ConnectionLine
              key={connection.id}
              connection={connection}
              nodes={nodes}
            />
          ))}
        </svg>

        {/* Nodes Layer */}
        <div className="relative w-full h-full" style={{ zIndex: 10 }}>
          {nodes.map(node => (
            <VisualNode
              key={node.id}
              node={node}
              selected={canvasState.selectedNodes.includes(node.id)}
              onSelect={handleNodeSelect}
              onDragStart={handleDragStart}
              onConnectionStart={handleConnectionStart}
              onConnectionEnd={handleConnectionEnd}
              connecting={!!connecting}
            />
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border px-3 py-2 flex items-center space-x-4 text-sm">
        <span>Nodes: {nodes.length}</span>
        <span>Connections: {connections.length}</span>
        <span>Selected: {canvasState.selectedNodes.length}</span>
        <Badge variant="outline" className="text-xs">
          {canvasState.tool}
        </Badge>
      </div>
    </div>
  );
};

export default NodeCanvas;