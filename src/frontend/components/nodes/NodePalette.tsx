/**
 * Node Palette Component
 * 
 * Comprehensive palette of available nodes organized by categories.
 * Supports drag-and-drop node creation, search/filter functionality,
 * and custom node templates for visual strategy building.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calculator,
  Zap,
  Target,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
  Signal,
  Play,
  Square,
  CircleDot,
  Triangle,
  Diamond,
  Plus,
  Minus,
  X,
  Divide,
  Percent,
  RotateCw,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Search,
  Star,
  Bookmark,
  Code,
  Database,
  Wifi,
  Globe,
  Clock,
  Bell,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { NodeData, NodePort } from './NodeCanvas';

// Node templates with predefined configurations
interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  inputs: NodePort[];
  outputs: NodePort[];
  defaultData: any;
  tags: string[];
}

// Comprehensive node template library
const nodeTemplates: NodeTemplate[] = [
  // Technical Indicators
  {
    id: 'sma',
    name: 'Simple Moving Average',
    description: 'Calculate simple moving average over specified period',
    category: 'indicators',
    type: 'indicator',
    icon: <TrendingUp className="h-4 w-4" />,
    color: '#3B82F6',
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true },
      { id: 'period', name: 'Period', type: 'parameter', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'value', name: 'SMA Value', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'SMA',
      parameters: { period: 20 }
    },
    tags: ['moving average', 'trend', 'smoothing']
  },
  {
    id: 'ema',
    name: 'Exponential Moving Average',
    description: 'Calculate exponential moving average with configurable smoothing',
    category: 'indicators',
    type: 'indicator',
    icon: <Activity className="h-4 w-4" />,
    color: '#3B82F6',
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true },
      { id: 'period', name: 'Period', type: 'parameter', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'value', name: 'EMA Value', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'EMA',
      parameters: { period: 12 }
    },
    tags: ['moving average', 'exponential', 'trend']
  },
  {
    id: 'rsi',
    name: 'Relative Strength Index',
    description: 'RSI oscillator for identifying overbought/oversold conditions',
    category: 'indicators',
    type: 'indicator',
    icon: <BarChart3 className="h-4 w-4" />,
    color: '#3B82F6',
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true },
      { id: 'period', name: 'Period', type: 'parameter', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'value', name: 'RSI Value', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'RSI',
      parameters: { period: 14 }
    },
    tags: ['oscillator', 'momentum', 'rsi']
  },
  {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence indicator',
    category: 'indicators',
    type: 'indicator',
    icon: <LineChart className="h-4 w-4" />,
    color: '#3B82F6',
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'macd', name: 'MACD Line', type: 'indicator', dataType: 'number' },
      { id: 'signal', name: 'Signal Line', type: 'indicator', dataType: 'number' },
      { id: 'histogram', name: 'Histogram', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'MACD',
      parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
    },
    tags: ['macd', 'convergence', 'divergence']
  },

  // Conditions
  {
    id: 'greater_than',
    name: 'Greater Than',
    description: 'Check if first input is greater than second input',
    category: 'conditions',
    type: 'condition',
    icon: <ArrowUp className="h-4 w-4" />,
    color: '#10B981',
    inputs: [
      { id: 'a', name: 'Value A', type: 'value', dataType: 'number', required: true },
      { id: 'b', name: 'Value B', type: 'value', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'A > B'
    },
    tags: ['comparison', 'condition', 'boolean']
  },
  {
    id: 'crossover',
    name: 'Crossover',
    description: 'Detect when line A crosses above line B',
    category: 'conditions',
    type: 'condition',
    icon: <Target className="h-4 w-4" />,
    color: '#10B981',
    inputs: [
      { id: 'a', name: 'Line A', type: 'value', dataType: 'number', required: true },
      { id: 'b', name: 'Line B', type: 'value', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'signal', name: 'Crossover Signal', type: 'signal', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Crossover'
    },
    tags: ['crossover', 'signal', 'intersection']
  },
  {
    id: 'range_check',
    name: 'Range Check',
    description: 'Check if value is within specified range',
    category: 'conditions',
    type: 'condition',
    icon: <Filter className="h-4 w-4" />,
    color: '#10B981',
    inputs: [
      { id: 'value', name: 'Value', type: 'value', dataType: 'number', required: true },
      { id: 'min', name: 'Min', type: 'parameter', dataType: 'number', required: true },
      { id: 'max', name: 'Max', type: 'parameter', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'result', name: 'In Range', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Range Check',
      parameters: { min: 30, max: 70 }
    },
    tags: ['range', 'bounds', 'filter']
  },

  // Logic Gates
  {
    id: 'and_gate',
    name: 'AND Gate',
    description: 'Logical AND operation - true if all inputs are true',
    category: 'logic',
    type: 'logic',
    icon: <CheckCircle className="h-4 w-4" />,
    color: '#F59E0B',
    inputs: [
      { id: 'a', name: 'Input A', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'b', name: 'Input B', type: 'boolean', dataType: 'boolean', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Output', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'AND'
    },
    tags: ['logic', 'and', 'boolean']
  },
  {
    id: 'or_gate',
    name: 'OR Gate',
    description: 'Logical OR operation - true if any input is true',
    category: 'logic',
    type: 'logic',
    icon: <CircleDot className="h-4 w-4" />,
    color: '#F59E0B',
    inputs: [
      { id: 'a', name: 'Input A', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'b', name: 'Input B', type: 'boolean', dataType: 'boolean', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Output', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'OR'
    },
    tags: ['logic', 'or', 'boolean']
  },
  {
    id: 'not_gate',
    name: 'NOT Gate',
    description: 'Logical NOT operation - inverts the input',
    category: 'logic',
    type: 'logic',
    icon: <X className="h-4 w-4" />,
    color: '#F59E0B',
    inputs: [
      { id: 'input', name: 'Input', type: 'boolean', dataType: 'boolean', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Output', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'NOT'
    },
    tags: ['logic', 'not', 'invert']
  },

  // Mathematical Operations
  {
    id: 'add',
    name: 'Addition',
    description: 'Add two numeric values',
    category: 'math',
    type: 'math',
    icon: <Plus className="h-4 w-4" />,
    color: '#06B6D4',
    inputs: [
      { id: 'a', name: 'A', type: 'number', dataType: 'number', required: true },
      { id: 'b', name: 'B', type: 'number', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'A + B'
    },
    tags: ['math', 'addition', 'arithmetic']
  },
  {
    id: 'multiply',
    name: 'Multiplication',
    description: 'Multiply two numeric values',
    category: 'math',
    type: 'math',
    icon: <X className="h-4 w-4" />,
    color: '#06B6D4',
    inputs: [
      { id: 'a', name: 'A', type: 'number', dataType: 'number', required: true },
      { id: 'b', name: 'B', type: 'number', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'A × B'
    },
    tags: ['math', 'multiplication', 'arithmetic']
  },
  {
    id: 'percentage',
    name: 'Percentage',
    description: 'Calculate percentage change between two values',
    category: 'math',
    type: 'math',
    icon: <Percent className="h-4 w-4" />,
    color: '#06B6D4',
    inputs: [
      { id: 'current', name: 'Current', type: 'number', dataType: 'number', required: true },
      { id: 'previous', name: 'Previous', type: 'number', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Percentage', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: '% Change'
    },
    tags: ['math', 'percentage', 'change']
  },

  // Signal Generation
  {
    id: 'buy_signal',
    name: 'Buy Signal',
    description: 'Generate buy signal based on condition',
    category: 'signals',
    type: 'signal',
    icon: <ArrowUp className="h-4 w-4" />,
    color: '#EF4444',
    inputs: [
      { id: 'condition', name: 'Condition', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'strength', name: 'Strength', type: 'number', dataType: 'number' }
    ],
    outputs: [
      { id: 'signal', name: 'Buy Signal', type: 'signal', dataType: 'signal' }
    ],
    defaultData: {
      label: 'Buy Signal',
      parameters: { strength: 1.0 }
    },
    tags: ['signal', 'buy', 'entry']
  },
  {
    id: 'sell_signal',
    name: 'Sell Signal',
    description: 'Generate sell signal based on condition',
    category: 'signals',
    type: 'signal',
    icon: <ArrowDown className="h-4 w-4" />,
    color: '#EF4444',
    inputs: [
      { id: 'condition', name: 'Condition', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'strength', name: 'Strength', type: 'number', dataType: 'number' }
    ],
    outputs: [
      { id: 'signal', name: 'Sell Signal', type: 'signal', dataType: 'signal' }
    ],
    defaultData: {
      label: 'Sell Signal',
      parameters: { strength: 1.0 }
    },
    tags: ['signal', 'sell', 'exit']
  },

  // Input/Output Nodes
  {
    id: 'price_input',
    name: 'Price Input',
    description: 'Input for price data (OHLC)',
    category: 'inputs',
    type: 'input',
    icon: <Database className="h-4 w-4" />,
    color: '#8B5CF6',
    inputs: [],
    outputs: [
      { id: 'open', name: 'Open', type: 'price', dataType: 'number' },
      { id: 'high', name: 'High', type: 'price', dataType: 'number' },
      { id: 'low', name: 'Low', type: 'price', dataType: 'number' },
      { id: 'close', name: 'Close', type: 'price', dataType: 'number' }
    ],
    defaultData: {
      label: 'Price Data',
      parameters: { symbol: 'BTC-USD', timeframe: '1H' }
    },
    tags: ['input', 'price', 'ohlc']
  },
  {
    id: 'volume_input',
    name: 'Volume Input',
    description: 'Input for volume data',
    category: 'inputs',
    type: 'input',
    icon: <BarChart3 className="h-4 w-4" />,
    color: '#8B5CF6',
    inputs: [],
    outputs: [
      { id: 'volume', name: 'Volume', type: 'volume', dataType: 'number' }
    ],
    defaultData: {
      label: 'Volume',
      parameters: { symbol: 'BTC-USD', timeframe: '1H' }
    },
    tags: ['input', 'volume', 'data']
  },
  {
    id: 'strategy_output',
    name: 'Strategy Output',
    description: 'Final strategy signal output',
    category: 'outputs',
    type: 'output',
    icon: <Target className="h-4 w-4" />,
    color: '#EC4899',
    inputs: [
      { id: 'signal', name: 'Signal', type: 'signal', dataType: 'signal', required: true }
    ],
    outputs: [],
    defaultData: {
      label: 'Strategy Output'
    },
    tags: ['output', 'strategy', 'final']
  }
];

// Node categories for organization
const categories = [
  { id: 'all', name: 'All Nodes', icon: <Star className="h-4 w-4" /> },
  { id: 'inputs', name: 'Inputs', icon: <Database className="h-4 w-4" /> },
  { id: 'indicators', name: 'Indicators', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'conditions', name: 'Conditions', icon: <Filter className="h-4 w-4" /> },
  { id: 'logic', name: 'Logic', icon: <CircleDot className="h-4 w-4" /> },
  { id: 'math', name: 'Math', icon: <Calculator className="h-4 w-4" /> },
  { id: 'signals', name: 'Signals', icon: <Signal className="h-4 w-4" /> },
  { id: 'outputs', name: 'Outputs', icon: <Target className="h-4 w-4" /> },
  { id: 'custom', name: 'Custom', icon: <Code className="h-4 w-4" /> }
];

interface NodePaletteProps {
  className?: string;
  onNodeCreate: (template: NodeTemplate) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Node Template Card Component
const NodeTemplateCard: React.FC<{
  template: NodeTemplate;
  onDragStart: (template: NodeTemplate) => void;
  onClick: (template: NodeTemplate) => void;
}> = ({ template, onDragStart, onClick }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    onDragStart(template);
  };

  return (
    <div
      className="border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:border-gray-400 bg-white"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(template)}
    >
      <div className="flex items-start space-x-3">
        <div
          className="p-2 rounded-md text-white flex-shrink-0"
          style={{ backgroundColor: template.color }}
        >
          {template.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 truncate">
            {template.name}
          </h4>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {template.description}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className="text-xs">
              {template.type}
            </Badge>
            
            <div className="flex items-center space-x-1 text-xs text-gray-400">
              <span>{template.inputs.length}→{template.outputs.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NodePalette: React.FC<NodePaletteProps> = ({
  className,
  onNodeCreate,
  searchQuery = '',
  onSearchChange
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
  
  // Use external search query if provided, otherwise use internal
  const currentSearchQuery = searchQuery || internalSearchQuery;
  
  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearchQuery(value);
    }
  };

  // Filter nodes based on category and search
  const filteredTemplates = useMemo(() => {
    let filtered = nodeTemplates;

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(template => template.category === activeCategory);
    }

    // Filter by search query
    if (currentSearchQuery) {
      const query = currentSearchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [activeCategory, currentSearchQuery]);

  const handleNodeDragStart = (template: NodeTemplate) => {
    // Optional: Add visual feedback for drag start
    console.log('Drag started for:', template.name);
  };

  const handleNodeClick = (template: NodeTemplate) => {
    onNodeCreate(template);
  };

  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Bookmark className="h-5 w-5 mr-2" />
          Node Palette
        </CardTitle>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search nodes..."
            value={currentSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <div className="px-4 pb-3">
            <TabsList className="grid w-full grid-cols-4 mb-3">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="indicators" className="text-xs">Indicators</TabsTrigger>
              <TabsTrigger value="conditions" className="text-xs">Conditions</TabsTrigger>
              <TabsTrigger value="logic" className="text-xs">Logic</TabsTrigger>
            </TabsList>
            
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="math" className="text-xs">Math</TabsTrigger>
              <TabsTrigger value="signals" className="text-xs">Signals</TabsTrigger>
              <TabsTrigger value="inputs" className="text-xs">Inputs</TabsTrigger>
              <TabsTrigger value="outputs" className="text-xs">Outputs</TabsTrigger>
            </TabsList>
          </div>

          {/* Node Templates */}
          <ScrollArea className="h-96">
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {filteredTemplates.length > 0 ? (
                  filteredTemplates.map(template => (
                    <NodeTemplateCard
                      key={template.id}
                      template={template}
                      onDragStart={handleNodeDragStart}
                      onClick={handleNodeClick}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No nodes found</p>
                    <p className="text-xs">Try adjusting your search or category</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </Tabs>

        {/* Stats Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500 flex justify-between">
          <span>Total: {nodeTemplates.length} nodes</span>
          <span>Showing: {filteredTemplates.length}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default NodePalette;