/**
 * Visual Strategy Builder
 * 
 * Complete visual strategy building interface combining node canvas,
 * palette, property panels, and real-time validation. Enables users
 * to create complex trading strategies through drag-and-drop visual
 * programming without writing code.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  Play,
  Square,
  Save,
  Upload,
  Download,
  Settings,
  Eye,
  EyeOff,
  Code,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  BarChart3,
  Activity,
  Layers,
  Grid3X3,
  Maximize2,
  Minimize2
} from 'lucide-react';

import { NodeCanvas, NodeData, Connection } from './NodeCanvas';
import { NodePalette } from './NodePalette';

interface VisualStrategyBuilderProps {
  className?: string;
  strategy?: {
    id: string;
    name: string;
    description: string;
    nodes: NodeData[];
    connections: Connection[];
    settings: any;
  };
  onStrategyChange?: (strategy: any) => void;
  onSave?: (strategy: any) => void;
  onRun?: (strategy: any) => void;
  readonly?: boolean;
}

interface ValidationError {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  connectionId?: string;
}

export const VisualStrategyBuilder: React.FC<VisualStrategyBuilderProps> = ({
  className,
  strategy,
  onStrategyChange,
  onSave,
  onRun,
  readonly = false
}) => {
  // Core state
  const [nodes, setNodes] = useState<NodeData[]>(strategy?.nodes || []);
  const [connections, setConnections] = useState<Connection[]>(strategy?.connections || []);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [strategyName, setStrategyName] = useState(strategy?.name || 'Untitled Strategy');
  const [strategyDescription, setStrategyDescription] = useState(strategy?.description || '');
  
  // UI state
  const [activeTab, setActiveTab] = useState('design');
  const [showValidation, setShowValidation] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Property panel state
  const [selectedNodeForProps, setSelectedNodeForProps] = useState<string | null>(null);

  // Canvas reference
  const canvasRef = useRef<HTMLDivElement>(null);

  // Strategy validation
  const validationErrors = useMemo(() => {
    const errors: ValidationError[] = [];
    
    // Check for disconnected input/output nodes
    const inputNodes = nodes.filter(node => node.type === 'input');
    const outputNodes = nodes.filter(node => node.type === 'output');
    
    if (inputNodes.length === 0) {
      errors.push({
        id: 'no-inputs',
        type: 'error',
        message: 'Strategy must have at least one input node'
      });
    }
    
    if (outputNodes.length === 0) {
      errors.push({
        id: 'no-outputs',
        type: 'error',
        message: 'Strategy must have at least one output node'
      });
    }

    // Check for disconnected required inputs
    nodes.forEach(node => {
      if (node.inputs) {
        node.inputs.forEach(input => {
          if (input.required) {
            const hasConnection = connections.some(
              conn => conn.targetNodeId === node.id && conn.targetPortId === input.id
            );
            if (!hasConnection) {
              errors.push({
                id: `missing-input-${node.id}-${input.id}`,
                type: 'warning',
                message: `Required input "${input.name}" on node "${node.data.label}" is not connected`,
                nodeId: node.id
              });
            }
          }
        });
      }
    });

    // Check for unused output connections
    connections.forEach(conn => {
      const targetConnections = connections.filter(c => 
        c.sourceNodeId === conn.targetNodeId
      );
      if (targetConnections.length === 0) {
        const targetNode = nodes.find(n => n.id === conn.targetNodeId);
        if (targetNode && targetNode.type !== 'output') {
          errors.push({
            id: `unused-output-${conn.id}`,
            type: 'info',
            message: `Output from "${targetNode.data.label}" is not being used`,
            connectionId: conn.id
          });
        }
      }
    });

    return errors;
  }, [nodes, connections]);

  // Node creation from palette
  const handleNodeCreate = useCallback((template: any) => {
    if (readonly) return;

    const newNode: NodeData = {
      id: `node_${Date.now()}`,
      type: template.type,
      position: { 
        x: Math.random() * 400 + 100, 
        y: Math.random() * 300 + 100 
      },
      data: {
        ...template.defaultData,
        label: template.name
      },
      inputs: template.inputs.map((input: any) => ({
        ...input,
        connected: false
      })),
      outputs: template.outputs.map((output: any) => ({
        ...output,
        connected: false
      }))
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setSelectedNodes([newNode.id]);
    setSelectedNodeForProps(newNode.id);

    // Notify parent of changes
    onStrategyChange?.({
      ...strategy,
      nodes: newNodes,
      connections
    });
  }, [nodes, connections, strategy, onStrategyChange, readonly]);

  // Node selection handler
  const handleNodeSelect = useCallback((nodeIds: string[]) => {
    setSelectedNodes(nodeIds);
    setSelectedNodeForProps(nodeIds.length === 1 ? nodeIds[0] : null);
  }, []);

  // Node updates
  const handleNodesChange = useCallback((updatedNodes: NodeData[]) => {
    setNodes(updatedNodes);
    onStrategyChange?.({
      ...strategy,
      nodes: updatedNodes,
      connections
    });
  }, [connections, strategy, onStrategyChange]);

  // Connection updates
  const handleConnectionsChange = useCallback((updatedConnections: Connection[]) => {
    setConnections(updatedConnections);
    onStrategyChange?.({
      ...strategy,
      nodes,
      connections: updatedConnections
    });
  }, [nodes, strategy, onStrategyChange]);

  // Property updates for selected node
  const handleNodePropertyChange = useCallback((property: string, value: any) => {
    if (!selectedNodeForProps || readonly) return;

    const updatedNodes = nodes.map(node => {
      if (node.id === selectedNodeForProps) {
        return {
          ...node,
          data: {
            ...node.data,
            parameters: {
              ...node.data.parameters,
              [property]: value
            }
          }
        };
      }
      return node;
    });

    setNodes(updatedNodes);
    onStrategyChange?.({
      ...strategy,
      nodes: updatedNodes,
      connections
    });
  }, [selectedNodeForProps, nodes, connections, strategy, onStrategyChange, readonly]);

  // Strategy operations
  const handleSaveStrategy = useCallback(() => {
    const strategyData = {
      id: strategy?.id || `strategy_${Date.now()}`,
      name: strategyName,
      description: strategyDescription,
      nodes,
      connections,
      settings: {
        showGrid,
        showMinimap,
        validation: showValidation
      },
      lastModified: new Date(),
      validationErrors: validationErrors.filter(err => err.type === 'error')
    };

    onSave?.(strategyData);
    setLastSaved(new Date());
  }, [strategy?.id, strategyName, strategyDescription, nodes, connections, showGrid, showMinimap, showValidation, validationErrors, onSave]);

  const handleRunStrategy = useCallback(async () => {
    if (validationErrors.some(err => err.type === 'error')) {
      return; // Cannot run with errors
    }

    setIsRunning(true);
    try {
      const strategyData = {
        id: strategy?.id,
        name: strategyName,
        description: strategyDescription,
        nodes,
        connections
      };

      await onRun?.(strategyData);
    } finally {
      setIsRunning(false);
    }
  }, [validationErrors, strategy?.id, strategyName, strategyDescription, nodes, connections, onRun]);

  // Get selected node for property panel
  const selectedNode = selectedNodeForProps ? nodes.find(n => n.id === selectedNodeForProps) : null;

  // Generate strategy code preview
  const generateCodePreview = useCallback(() => {
    const codeLines = [
      '// Generated Strategy Code',
      `// Name: ${strategyName}`,
      `// Description: ${strategyDescription}`,
      '',
      'export class GeneratedStrategy extends BaseStrategy {',
      '  constructor() {',
      '    super({',
      `      name: "${strategyName}",`,
      `      description: "${strategyDescription}"`,
      '    });',
      '  }',
      '',
      '  async execute(data: MarketDataFrame): Promise<Signal[]> {',
      '    const signals: Signal[] = [];',
      '',
      '    // Strategy logic based on visual nodes',
      nodes.map(node => {
        if (node.type === 'indicator') {
          return `    const ${node.id} = this.calculate${node.data.label?.replace(/\s+/g, '')}(data, ${JSON.stringify(node.data.parameters)});`;
        }
        if (node.type === 'condition') {
          return `    const ${node.id} = this.evaluate${node.data.label?.replace(/\s+/g, '')}(data);`;
        }
        if (node.type === 'signal') {
          return `    if (${node.id}) signals.push(new ${node.data.label?.replace(/\s+/g, '')}Signal());`;
        }
        return `    // ${node.data.label}: ${node.type}`;
      }).join('\n'),
      '',
      '    return signals;',
      '  }',
      '}'
    ];

    return codeLines.join('\n');
  }, [strategyName, strategyDescription, nodes]);

  const hasErrors = validationErrors.some(err => err.type === 'error');
  const hasWarnings = validationErrors.some(err => err.type === 'warning');

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <Input
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                className="text-xl font-semibold border-none p-0 bg-transparent"
                placeholder="Strategy Name"
                disabled={readonly}
              />
              <Input
                value={strategyDescription}
                onChange={(e) => setStrategyDescription(e.target.value)}
                className="text-sm text-gray-600 border-none p-0 bg-transparent mt-1"
                placeholder="Strategy Description"
                disabled={readonly}
              />
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center space-x-2">
              <Badge variant={hasErrors ? 'destructive' : hasWarnings ? 'secondary' : 'default'}>
                {hasErrors ? (
                  <><AlertTriangle className="h-3 w-3 mr-1" />Errors</>
                ) : hasWarnings ? (
                  <><Clock className="h-3 w-3 mr-1" />Warnings</>
                ) : (
                  <><CheckCircle className="h-3 w-3 mr-1" />Valid</>
                )}
              </Badge>
              
              <Badge variant="outline">
                {nodes.length} nodes
              </Badge>
              
              <Badge variant="outline">
                {connections.length} connections
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {lastSaved && (
              <span className="text-sm text-gray-500">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            
            {!readonly && (
              <>
                <Button variant="outline" onClick={handleSaveStrategy}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                
                <Button 
                  onClick={handleRunStrategy}
                  disabled={hasErrors || isRunning}
                  className={isRunning ? 'animate-pulse' : ''}
                >
                  {isRunning ? (
                    <><Square className="h-4 w-4 mr-2" />Stop</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" />Run</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Node Palette */}
        <div className="w-80 bg-white border-r flex-shrink-0 overflow-hidden">
          <NodePalette onNodeCreate={handleNodeCreate} />
        </div>

        {/* Center - Canvas and tabs */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-white border-b">
              <TabsList className="grid w-fit grid-cols-4">
                <TabsTrigger value="design" className="flex items-center">
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="code" className="flex items-center">
                  <Code className="h-4 w-4 mr-1" />
                  Code
                </TabsTrigger>
                <TabsTrigger value="validation" className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Validation
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center">
                  <Settings className="h-4 w-4 mr-1" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="design" className="flex-1 m-0 p-0">
              <NodeCanvas
                nodes={nodes}
                connections={connections}
                onNodesChange={handleNodesChange}
                onConnectionsChange={handleConnectionsChange}
                onNodeSelect={handleNodeSelect}
                readonly={readonly}
                className="w-full h-full"
              />
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0 p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Code className="h-5 w-5 mr-2" />
                    Generated Strategy Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto h-96 text-sm">
                    <code>{generateCodePreview()}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="flex-1 m-0 p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Strategy Validation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {validationErrors.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                        <h3 className="font-semibold">Strategy is valid!</h3>
                        <p className="text-sm text-gray-600">No errors or warnings found.</p>
                      </div>
                    ) : (
                      validationErrors.map(error => (
                        <div
                          key={error.id}
                          className={`p-3 rounded-lg border-l-4 ${
                            error.type === 'error' 
                              ? 'bg-red-50 border-red-400' 
                              : error.type === 'warning'
                              ? 'bg-yellow-50 border-yellow-400'
                              : 'bg-blue-50 border-blue-400'
                          }`}
                        >
                          <div className="flex items-start">
                            {error.type === 'error' ? (
                              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                            ) : error.type === 'warning' ? (
                              <Clock className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{error.message}</p>
                              {error.nodeId && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Node ID: {error.nodeId}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0 p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Canvas Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-grid">Show Grid</Label>
                      <Switch
                        id="show-grid"
                        checked={showGrid}
                        onCheckedChange={setShowGrid}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-minimap">Show Minimap</Label>
                      <Switch
                        id="show-minimap"
                        checked={showMinimap}
                        onCheckedChange={setShowMinimap}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-validation">Show Validation</Label>
                      <Switch
                        id="show-validation"
                        checked={showValidation}
                        onCheckedChange={setShowValidation}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Export Options</h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export JSON
                      </Button>
                      
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Export Code
                      </Button>
                      
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Import Strategy
                      </Button>
                      
                      <Button variant="outline" size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Save Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar - Properties panel */}
        {selectedNode && !readonly && (
          <div className="w-80 bg-white border-l flex-shrink-0 p-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedNode.data.label}
                </CardTitle>
                <Badge variant="secondary">{selectedNode.type}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedNode.data.parameters && Object.entries(selectedNode.data.parameters).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="text-sm font-medium">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Label>
                    {typeof value === 'number' ? (
                      <Input
                        id={key}
                        type="number"
                        value={value}
                        onChange={(e) => handleNodePropertyChange(key, parseFloat(e.target.value))}
                      />
                    ) : typeof value === 'boolean' ? (
                      <Switch
                        checked={value}
                        onCheckedChange={(checked) => handleNodePropertyChange(key, checked)}
                      />
                    ) : (
                      <Input
                        id={key}
                        value={String(value)}
                        onChange={(e) => handleNodePropertyChange(key, e.target.value)}
                      />
                    )}
                  </div>
                ))}

                {selectedNode.data.description && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedNode.data.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualStrategyBuilder;