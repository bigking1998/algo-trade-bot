import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  ConnectionMode,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  TrendingUp,
  Activity,
  Target,
  Shuffle,
  Shield,
  Code,
  AlertCircle,
  Eye,
  Plus,
  Search,
} from "lucide-react";

import {
  VisualStrategyDefinition,
  StrategyNode,
  StrategyConnection,
  ValidationResult,
  PreviewData,
  NodeTemplate,
  StrategyNodeType,
} from "../../types/strategy";

// Custom Node Components
const IndicatorNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-blue-50 border-2 border-blue-200 min-w-[150px]">
    <div className="flex items-center gap-2 mb-1">
      <TrendingUp className="h-4 w-4 text-blue-600" />
      <div className="font-medium text-blue-900">{data.label}</div>
    </div>
    {data.validation?.errors.length > 0 && (
      <AlertCircle className="h-3 w-3 text-red-500" />
    )}
    <div className="text-xs text-blue-700">{data.description}</div>
  </div>
);

const ConditionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-green-50 border-2 border-green-200 min-w-[150px]">
    <div className="flex items-center gap-2 mb-1">
      <Activity className="h-4 w-4 text-green-600" />
      <div className="font-medium text-green-900">{data.label}</div>
    </div>
    {data.validation?.errors.length > 0 && (
      <AlertCircle className="h-3 w-3 text-red-500" />
    )}
    <div className="text-xs text-green-700">{data.description}</div>
  </div>
);

const SignalNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-purple-50 border-2 border-purple-200 min-w-[150px]">
    <div className="flex items-center gap-2 mb-1">
      <Target className="h-4 w-4 text-purple-600" />
      <div className="font-medium text-purple-900">{data.label}</div>
    </div>
    {data.validation?.errors.length > 0 && (
      <AlertCircle className="h-3 w-3 text-red-500" />
    )}
    <div className="text-xs text-purple-700">{data.description}</div>
  </div>
);

const LogicNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-orange-50 border-2 border-orange-200 min-w-[150px]">
    <div className="flex items-center gap-2 mb-1">
      <Shuffle className="h-4 w-4 text-orange-600" />
      <div className="font-medium text-orange-900">{data.label}</div>
    </div>
    {data.validation?.errors.length > 0 && (
      <AlertCircle className="h-3 w-3 text-red-500" />
    )}
    <div className="text-xs text-orange-700">{data.description}</div>
  </div>
);

const RiskNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-red-50 border-2 border-red-200 min-w-[150px]">
    <div className="flex items-center gap-2 mb-1">
      <Shield className="h-4 w-4 text-red-600" />
      <div className="font-medium text-red-900">{data.label}</div>
    </div>
    {data.validation?.errors.length > 0 && (
      <AlertCircle className="h-3 w-3 text-red-500" />
    )}
    <div className="text-xs text-red-700">{data.description}</div>
  </div>
);

const CustomNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-gray-50 border-2 border-gray-200 min-w-[150px]">
    <div className="flex items-center gap-2 mb-1">
      <Code className="h-4 w-4 text-gray-600" />
      <div className="font-medium text-gray-900">{data.label}</div>
    </div>
    {data.validation?.errors.length > 0 && (
      <AlertCircle className="h-3 w-3 text-red-500" />
    )}
    <div className="text-xs text-gray-700">{data.description}</div>
  </div>
);

const nodeTypes: NodeTypes = {
  indicator: IndicatorNode,
  condition: ConditionNode,
  signal: SignalNode,
  logic: LogicNode,
  risk: RiskNode,
  custom: CustomNode,
};

// Node Templates
const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: 'sma',
    type: 'indicator',
    category: 'Moving Averages',
    name: 'Simple Moving Average',
    description: 'Calculate simple moving average',
    icon: 'TrendingUp',
    color: '#3b82f6',
    defaultData: {
      parameters: { period: 20, source: 'close' },
      inputs: [],
      outputs: [{ id: 'output', name: 'SMA', type: 'number', required: false }],
    },
    documentation: {
      description: 'Simple Moving Average calculates the average price over a specified period.',
      parameters: {
        period: { type: 'number', description: 'Number of periods', default: 20, min: 1, max: 1000 },
        source: { type: 'string', description: 'Price source', default: 'close', options: ['open', 'high', 'low', 'close'] },
      },
      examples: [],
    },
  },
  {
    id: 'ema',
    type: 'indicator',
    category: 'Moving Averages',
    name: 'Exponential Moving Average',
    description: 'Calculate exponential moving average',
    icon: 'TrendingUp',
    color: '#3b82f6',
    defaultData: {
      parameters: { period: 20, source: 'close' },
      inputs: [],
      outputs: [{ id: 'output', name: 'EMA', type: 'number', required: false }],
    },
    documentation: {
      description: 'Exponential Moving Average gives more weight to recent prices.',
      parameters: {
        period: { type: 'number', description: 'Number of periods', default: 20, min: 1, max: 1000 },
        source: { type: 'string', description: 'Price source', default: 'close', options: ['open', 'high', 'low', 'close'] },
      },
      examples: [],
    },
  },
  {
    id: 'rsi',
    type: 'indicator',
    category: 'Momentum',
    name: 'RSI',
    description: 'Relative Strength Index',
    icon: 'Activity',
    color: '#3b82f6',
    defaultData: {
      parameters: { period: 14, source: 'close' },
      inputs: [],
      outputs: [{ id: 'output', name: 'RSI', type: 'number', required: false }],
    },
    documentation: {
      description: 'RSI measures the magnitude of price changes to evaluate overbought/oversold conditions.',
      parameters: {
        period: { type: 'number', description: 'Number of periods', default: 14, min: 1, max: 100 },
        source: { type: 'string', description: 'Price source', default: 'close', options: ['open', 'high', 'low', 'close'] },
      },
      examples: [],
    },
  },
  {
    id: 'cross_above',
    type: 'condition',
    category: 'Comparisons',
    name: 'Cross Above',
    description: 'Value crosses above another',
    icon: 'Activity',
    color: '#10b981',
    defaultData: {
      parameters: {},
      inputs: [
        { id: 'input1', name: 'Value 1', type: 'number', required: true },
        { id: 'input2', name: 'Value 2', type: 'number', required: true },
      ],
      outputs: [{ id: 'output', name: 'Signal', type: 'boolean', required: false }],
    },
    documentation: {
      description: 'Triggers when value 1 crosses above value 2.',
      parameters: {},
      examples: [],
    },
  },
  {
    id: 'greater_than',
    type: 'condition',
    category: 'Comparisons',
    name: 'Greater Than',
    description: 'Value is greater than threshold',
    icon: 'Activity',
    color: '#10b981',
    defaultData: {
      parameters: { threshold: 70 },
      inputs: [{ id: 'input', name: 'Value', type: 'number', required: true }],
      outputs: [{ id: 'output', name: 'Signal', type: 'boolean', required: false }],
    },
    documentation: {
      description: 'Checks if input value is greater than threshold.',
      parameters: {
        threshold: { type: 'number', description: 'Comparison threshold', default: 70 },
      },
      examples: [],
    },
  },
  {
    id: 'and',
    type: 'logic',
    category: 'Logic Gates',
    name: 'AND',
    description: 'Logical AND operation',
    icon: 'Shuffle',
    color: '#f59e0b',
    defaultData: {
      parameters: {},
      inputs: [
        { id: 'input1', name: 'Condition 1', type: 'boolean', required: true },
        { id: 'input2', name: 'Condition 2', type: 'boolean', required: true },
      ],
      outputs: [{ id: 'output', name: 'Result', type: 'boolean', required: false }],
    },
    documentation: {
      description: 'Returns true only when both inputs are true.',
      parameters: {},
      examples: [],
    },
  },
  {
    id: 'buy_signal',
    type: 'signal',
    category: 'Entry Signals',
    name: 'Buy Signal',
    description: 'Long entry signal',
    icon: 'Target',
    color: '#8b5cf6',
    defaultData: {
      parameters: {},
      inputs: [{ id: 'condition', name: 'Condition', type: 'boolean', required: true }],
      outputs: [],
    },
    documentation: {
      description: 'Generates a buy signal when condition is true.',
      parameters: {},
      examples: [],
    },
  },
];

interface VisualStrategyEditorProps {
  strategy?: VisualStrategyDefinition;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
  selectedNodes: string[];
  validation: ValidationResult;
  preview: { isRunning: boolean; data?: PreviewData; error?: string };
  onStrategyChange: (strategy: VisualStrategyDefinition) => void;
  onValidationChange: (validation: ValidationResult) => void;
}

const VisualStrategyEditor: React.FC<VisualStrategyEditorProps> = ({
  strategy,
  nodes: strategyNodes,
  connections: strategyConnections,
  validation,
  preview,
  onStrategyChange,
  onValidationChange,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Convert strategy nodes to ReactFlow nodes
  const reactFlowNodes: Node[] = useMemo(() => {
    return strategyNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.name,
        description: node.description,
        parameters: node.data.parameters,
        validation: node.data.validation,
        preview: node.data.preview,
      },
    }));
  }, [strategyNodes]);

  // Convert strategy connections to ReactFlow edges
  const reactFlowEdges: Edge[] = useMemo(() => {
    return strategyConnections.map(connection => ({
      id: connection.id,
      source: connection.sourceNodeId,
      target: connection.targetNodeId,
      sourceHandle: connection.sourcePortId,
      targetHandle: connection.targetPortId,
      type: 'default',
    }));
  }, [strategyConnections]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `${params.source}-${params.target}`,
        type: 'default',
      };
      setEdges((eds) => addEdge(newEdge as Edge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const templateId = event.dataTransfer.getData('application/reactflow');
      if (!templateId) return;

      const template = NODE_TEMPLATES.find(t => t.id === templateId);
      if (!template) return;

      const position = {
        x: event.clientX - 200,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `${template.id}-${Date.now()}`,
        type: template.type,
        position,
        data: {
          label: template.name,
          description: template.description,
          parameters: template.defaultData.parameters,
          validation: { isValid: true, errors: [], warnings: [] },
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const filteredTemplates = useMemo(() => {
    return NODE_TEMPLATES.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const cats = NODE_TEMPLATES.reduce((acc, template) => {
      if (!acc.includes(template.category)) {
        acc.push(template.category);
      }
      return acc;
    }, [] as string[]);
    return ['all', ...cats];
  }, []);

  const onDragStart = (event: React.DragEvent, templateId: string) => {
    event.dataTransfer.setData('application/reactflow', templateId);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-full gap-4">
      {/* Node Palette */}
      <Card className="w-80 flex-shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Node Library
          </CardTitle>
          
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Moving Averages">MA</TabsTrigger>
                <TabsTrigger value="Momentum">Mom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="p-4 space-y-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg cursor-grab hover:bg-muted/50 transition-colors"
                  draggable
                  onDragStart={(e) => onDragStart(e, template.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: template.color }}
                    />
                    <span className="font-medium text-sm">{template.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {template.category}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          
          {/* Canvas Overlay Panel */}
          <Panel position="top-right">
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 border">
              {validation.errors.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
                </Badge>
              )}
              
              {preview.isRunning && (
                <div className="flex items-center gap-1">
                  <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs text-blue-700">Preview Running</span>
                </div>
              )}
              
              <Button size="sm" variant="outline" className="text-xs gap-1">
                <Eye className="h-3 w-3" />
                Preview
              </Button>
            </div>
          </Panel>
          
          {/* Empty State */}
          {reactFlowNodes.length === 0 && (
            <Panel position="center">
              <div className="text-center p-8 bg-background/80 backdrop-blur-sm rounded-lg border">
                <div className="text-muted-foreground mb-2">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                </div>
                <h3 className="font-medium mb-1">Start Building Your Strategy</h3>
                <p className="text-sm text-muted-foreground">
                  Drag nodes from the library to create your trading strategy
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Properties Panel */}
      <Card className="w-80 flex-shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Properties
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {selectedNodes.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              Select a node to view properties
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Node Configuration</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure the selected node parameters
                </p>
              </div>
              
              {/* Node properties would be rendered here based on selected node */}
              <div className="text-sm text-muted-foreground">
                Properties panel implementation coming soon...
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VisualStrategyEditor;