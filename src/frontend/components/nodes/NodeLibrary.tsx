/**
 * Node Library - Complete Node Collection
 * 
 * Comprehensive library of all available node types for the visual strategy builder.
 * Provides node templates, factory functions, and component mappings.
 */

import React from 'react';
import { NodeData, NodePort } from './NodeCanvas';

// Import all node component collections
import { IndicatorNodes } from './IndicatorNodes';
import { ConditionNodes } from './ConditionNodes';
import { LogicNodes } from './LogicNodes';
import { SignalNodes } from './SignalNodes';
// Advanced node types (FE-009)
import {
  JavaScriptCodeNode,
  TypeScriptCodeNode,
  SQLQueryNode
} from './CustomCodeNodes';
import {
  NeuralNetworkNode,
  LSTMModelNode,
  RandomForestNode,
  ModelEnsembleNode
} from './MLModelNodes';
import {
  PositionSizingNode,
  StopLossNode,
  TakeProfitNode,
  PortfolioRiskMonitorNode,
  DynamicHedgingNode
} from './RiskManagementNodes';
import {
  PortfolioRebalancingNode,
  AssetAllocationOptimizerNode,
  MultiAssetPortfolioNode,
  PerformanceAttributionNode
} from './PortfolioManagementNodes';

// Icon imports for node templates
import {
  TrendingUp,
  Activity,
  BarChart3,
  LineChart,
  ArrowUp,
  ArrowDown,
  Target,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Circle,
  Square,
  Shield,
  DollarSign,
  Database,
  Wifi,
  Play,
  Settings,
  Code,
  Globe,
  Clock,
  Zap,
  Layers,
  Brain,
  PieChart,
  Balance,
  FileText,
  RefreshCw,
  Percent,
  Timer
} from 'lucide-react';

// Node category definitions
export enum NodeCategory {
  INPUTS = 'inputs',
  INDICATORS = 'indicators', 
  CONDITIONS = 'conditions',
  LOGIC = 'logic',
  SIGNALS = 'signals',
  RISK_MANAGEMENT = 'risk-management',
  PORTFOLIO_MANAGEMENT = 'portfolio-management',
  MACHINE_LEARNING = 'machine-learning',
  CUSTOM_CODE = 'custom-code',
  OUTPUTS = 'outputs',
  UTILITY = 'utility',
  CUSTOM = 'custom'
}

// Complete node template interface
export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  category: NodeCategory;
  type: string;
  icon: React.ReactNode;
  color: string;
  component?: React.ComponentType<any>;
  inputs: NodePort[];
  outputs: NodePort[];
  defaultData: {
    label: string;
    description?: string;
    parameters?: Record<string, any>;
    config?: Record<string, any>;
  };
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  documentation?: {
    usage: string;
    parameters: Record<string, string>;
    examples: string[];
  };
}

// Comprehensive node template library
export const NODE_TEMPLATES: NodeTemplate[] = [
  // Input Nodes
  {
    id: 'price-input',
    name: 'Price Data',
    description: 'OHLC price data input for candlestick analysis',
    category: NodeCategory.INPUTS,
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
    tags: ['input', 'price', 'ohlc', 'market-data'],
    complexity: 'beginner'
  },
  
  {
    id: 'volume-input', 
    name: 'Volume Data',
    description: 'Trading volume data input',
    category: NodeCategory.INPUTS,
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
    tags: ['input', 'volume', 'market-data'],
    complexity: 'beginner'
  },

  {
    id: 'constant-input',
    name: 'Constant Value',
    description: 'Fixed numeric constant for calculations',
    category: NodeCategory.INPUTS,
    type: 'input',
    icon: <Circle className="h-4 w-4" />,
    color: '#6B7280',
    inputs: [],
    outputs: [
      { id: 'value', name: 'Value', type: 'constant', dataType: 'number' }
    ],
    defaultData: {
      label: 'Constant',
      parameters: { value: 100 }
    },
    tags: ['input', 'constant', 'number'],
    complexity: 'beginner'
  },

  // Technical Indicator Nodes
  {
    id: 'sma',
    name: 'Simple Moving Average',
    description: 'Calculate simple moving average over specified period',
    category: NodeCategory.INDICATORS,
    type: 'indicator',
    icon: <TrendingUp className="h-4 w-4" />,
    color: '#3B82F6',
    component: IndicatorNodes.SMA,
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'sma', name: 'SMA', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'SMA',
      parameters: { period: 20, priceInput: 'close' }
    },
    tags: ['indicator', 'sma', 'moving-average', 'trend'],
    complexity: 'beginner',
    documentation: {
      usage: 'Simple moving average smooths price data over a specified period',
      parameters: {
        period: 'Number of periods for averaging (default: 20)',
        priceInput: 'Price type to use: open, high, low, close, hlc3, ohlc4'
      },
      examples: [
        'SMA(20) for 20-period moving average',
        'Use SMA crossovers for trend detection'
      ]
    }
  },

  {
    id: 'ema',
    name: 'Exponential Moving Average',
    description: 'Exponential moving average with configurable smoothing factor',
    category: NodeCategory.INDICATORS,
    type: 'indicator',
    icon: <Activity className="h-4 w-4" />,
    color: '#3B82F6',
    component: IndicatorNodes.EMA,
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'ema', name: 'EMA', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'EMA',
      parameters: { period: 12, smoothing: 2 }
    },
    tags: ['indicator', 'ema', 'moving-average', 'trend', 'exponential'],
    complexity: 'beginner'
  },

  {
    id: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index oscillator for momentum analysis',
    category: NodeCategory.INDICATORS,
    type: 'indicator',
    icon: <BarChart3 className="h-4 w-4" />,
    color: '#8B5CF6',
    component: IndicatorNodes.RSI,
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'rsi', name: 'RSI', type: 'oscillator', dataType: 'number' }
    ],
    defaultData: {
      label: 'RSI',
      parameters: { period: 14, overbought: 70, oversold: 30 }
    },
    tags: ['indicator', 'rsi', 'oscillator', 'momentum', 'overbought', 'oversold'],
    complexity: 'intermediate'
  },

  {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence momentum indicator',
    category: NodeCategory.INDICATORS,
    type: 'indicator',
    icon: <LineChart className="h-4 w-4" />,
    color: '#F97316',
    component: IndicatorNodes.MACD,
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'macd', name: 'MACD', type: 'indicator', dataType: 'number' },
      { id: 'signal', name: 'Signal', type: 'indicator', dataType: 'number' },
      { id: 'histogram', name: 'Histogram', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'MACD',
      parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
    },
    tags: ['indicator', 'macd', 'momentum', 'convergence', 'divergence'],
    complexity: 'intermediate'
  },

  {
    id: 'bollinger-bands',
    name: 'Bollinger Bands',
    description: 'Volatility bands around moving average',
    category: NodeCategory.INDICATORS,
    type: 'indicator',
    icon: <Activity className="h-4 w-4" />,
    color: '#6366F1',
    component: IndicatorNodes.BollingerBands,
    inputs: [
      { id: 'price', name: 'Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'upper', name: 'Upper Band', type: 'indicator', dataType: 'number' },
      { id: 'middle', name: 'Middle Band', type: 'indicator', dataType: 'number' },
      { id: 'lower', name: 'Lower Band', type: 'indicator', dataType: 'number' }
    ],
    defaultData: {
      label: 'BB',
      parameters: { period: 20, stdDev: 2 }
    },
    tags: ['indicator', 'bollinger', 'volatility', 'bands'],
    complexity: 'intermediate'
  },

  // Condition Nodes
  {
    id: 'comparison',
    name: 'Comparison',
    description: 'Compare two values with various operators',
    category: NodeCategory.CONDITIONS,
    type: 'condition',
    icon: <ArrowUp className="h-4 w-4" />,
    color: '#10B981',
    component: ConditionNodes.Comparison,
    inputs: [
      { id: 'a', name: 'Value A', type: 'value', dataType: 'number', required: true },
      { id: 'b', name: 'Value B', type: 'value', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Result', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Compare',
      parameters: { operator: '>', threshold: 50 }
    },
    tags: ['condition', 'comparison', 'greater', 'less', 'equal'],
    complexity: 'beginner'
  },

  {
    id: 'crossover',
    name: 'Crossover',
    description: 'Detect when one line crosses above or below another',
    category: NodeCategory.CONDITIONS,
    type: 'condition',
    icon: <Target className="h-4 w-4" />,
    color: '#3B82F6',
    component: ConditionNodes.Crossover,
    inputs: [
      { id: 'lineA', name: 'Line A', type: 'value', dataType: 'number', required: true },
      { id: 'lineB', name: 'Line B', type: 'value', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'crossover', name: 'Crossover', type: 'signal', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Crossover',
      parameters: { crossoverType: 'above', sensitivity: 0.1 }
    },
    tags: ['condition', 'crossover', 'signal', 'intersection'],
    complexity: 'intermediate'
  },

  {
    id: 'range-check',
    name: 'Range Check',
    description: 'Check if value falls within specified range',
    category: NodeCategory.CONDITIONS,
    type: 'condition',
    icon: <Filter className="h-4 w-4" />,
    color: '#F59E0B',
    component: ConditionNodes.RangeCheck,
    inputs: [
      { id: 'value', name: 'Value', type: 'value', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'inRange', name: 'In Range', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Range Check',
      parameters: { minValue: 30, maxValue: 70, inclusive: true }
    },
    tags: ['condition', 'range', 'bounds', 'filter'],
    complexity: 'beginner'
  },

  // Logic Nodes
  {
    id: 'and-gate',
    name: 'AND Gate',
    description: 'Logical AND - true when all inputs are true',
    category: NodeCategory.LOGIC,
    type: 'logic',
    icon: <CheckCircle className="h-4 w-4" />,
    color: '#F97316',
    component: LogicNodes.AND,
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
    tags: ['logic', 'and', 'boolean', 'gate'],
    complexity: 'beginner'
  },

  {
    id: 'or-gate',
    name: 'OR Gate',
    description: 'Logical OR - true when any input is true',
    category: NodeCategory.LOGIC,
    type: 'logic',
    icon: <Circle className="h-4 w-4" />,
    color: '#EAB308',
    component: LogicNodes.OR,
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
    tags: ['logic', 'or', 'boolean', 'gate'],
    complexity: 'beginner'
  },

  {
    id: 'not-gate',
    name: 'NOT Gate',
    description: 'Logical NOT - inverts the input',
    category: NodeCategory.LOGIC,
    type: 'logic',
    icon: <XCircle className="h-4 w-4" />,
    color: '#EF4444',
    component: LogicNodes.NOT,
    inputs: [
      { id: 'input', name: 'Input', type: 'boolean', dataType: 'boolean', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Output', type: 'boolean', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'NOT'
    },
    tags: ['logic', 'not', 'boolean', 'invert'],
    complexity: 'beginner'
  },

  // Signal Nodes
  {
    id: 'buy-signal',
    name: 'Buy Signal',
    description: 'Generate buy/long signal based on condition',
    category: NodeCategory.SIGNALS,
    type: 'signal',
    icon: <ArrowUp className="h-4 w-4" />,
    color: '#10B981',
    component: SignalNodes.Buy,
    inputs: [
      { id: 'condition', name: 'Condition', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'strength', name: 'Strength', type: 'number', dataType: 'number' }
    ],
    outputs: [
      { id: 'signal', name: 'Buy Signal', type: 'signal', dataType: 'signal' }
    ],
    defaultData: {
      label: 'Buy Signal',
      parameters: { strength: 1.0, maxPositionSize: 100 }
    },
    tags: ['signal', 'buy', 'long', 'entry'],
    complexity: 'intermediate'
  },

  {
    id: 'sell-signal',
    name: 'Sell Signal', 
    description: 'Generate sell/short signal based on condition',
    category: NodeCategory.SIGNALS,
    type: 'signal',
    icon: <ArrowDown className="h-4 w-4" />,
    color: '#EF4444',
    component: SignalNodes.Sell,
    inputs: [
      { id: 'condition', name: 'Condition', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'strength', name: 'Strength', type: 'number', dataType: 'number' }
    ],
    outputs: [
      { id: 'signal', name: 'Sell Signal', type: 'signal', dataType: 'signal' }
    ],
    defaultData: {
      label: 'Sell Signal',
      parameters: { strength: 1.0, maxPositionSize: 100 }
    },
    tags: ['signal', 'sell', 'short', 'entry'],
    complexity: 'intermediate'
  },

  // Risk Management Nodes
  {
    id: 'stop-loss',
    name: 'Stop Loss',
    description: 'Risk management stop loss with multiple types',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'risk',
    icon: <Shield className="h-4 w-4" />,
    color: '#DC2626',
    component: SignalNodes.StopLoss,
    inputs: [
      { id: 'entryPrice', name: 'Entry Price', type: 'price', dataType: 'number', required: true },
      { id: 'currentPrice', name: 'Current Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'stopSignal', name: 'Stop Signal', type: 'signal', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Stop Loss',
      parameters: { stopType: 'fixed', stopValue: 2.0 }
    },
    tags: ['risk', 'stop-loss', 'protection', 'exit'],
    complexity: 'intermediate'
  },

  {
    id: 'take-profit',
    name: 'Take Profit',
    description: 'Take profit target with various calculation methods',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'risk',
    icon: <Target className="h-4 w-4" />,
    color: '#059669',
    component: SignalNodes.TakeProfit,
    inputs: [
      { id: 'entryPrice', name: 'Entry Price', type: 'price', dataType: 'number', required: true },
      { id: 'currentPrice', name: 'Current Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'targetHit', name: 'Target Hit', type: 'signal', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Take Profit',
      parameters: { targetType: 'fixed', targetValue: 5.0 }
    },
    tags: ['risk', 'take-profit', 'target', 'exit'],
    complexity: 'intermediate'
  },

  {
    id: 'position-size',
    name: 'Position Size',
    description: 'Calculate position size based on risk parameters',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'calculator',
    icon: <DollarSign className="h-4 w-4" />,
    color: '#2563EB',
    component: SignalNodes.PositionSize,
    inputs: [
      { id: 'entryPrice', name: 'Entry Price', type: 'price', dataType: 'number', required: true },
      { id: 'stopPrice', name: 'Stop Price', type: 'price', dataType: 'number', required: true }
    ],
    outputs: [
      { id: 'positionSize', name: 'Position Size', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'Position Size',
      parameters: { riskPercent: 1.0, accountBalance: 10000 }
    },
    tags: ['risk', 'position-size', 'calculator', 'money-management'],
    complexity: 'advanced'
  },

  // Output Nodes
  {
    id: 'strategy-output',
    name: 'Strategy Output',
    description: 'Final strategy signal output for execution',
    category: NodeCategory.OUTPUTS,
    type: 'output',
    icon: <Play className="h-4 w-4" />,
    color: '#DC2626',
    inputs: [
      { id: 'signal', name: 'Signal', type: 'signal', dataType: 'signal', required: true }
    ],
    outputs: [],
    defaultData: {
      label: 'Strategy Output'
    },
    tags: ['output', 'strategy', 'execution', 'final'],
    complexity: 'beginner'
  },

  {
    id: 'chart-output',
    name: 'Chart Output',
    description: 'Display data on chart for visualization',
    category: NodeCategory.OUTPUTS,
    type: 'output',
    icon: <LineChart className="h-4 w-4" />,
    color: '#7C3AED',
    inputs: [
      { id: 'data', name: 'Data', type: 'any', dataType: 'any', required: true }
    ],
    outputs: [],
    defaultData: {
      label: 'Chart Output',
      parameters: { color: '#3B82F6', style: 'line' }
    },
    tags: ['output', 'chart', 'visualization', 'display'],
    complexity: 'beginner'
  },

  // Utility Nodes
  {
    id: 'delay',
    name: 'Delay',
    description: 'Add time delay to signals',
    category: NodeCategory.UTILITY,
    type: 'utility',
    icon: <Clock className="h-4 w-4" />,
    color: '#6B7280',
    inputs: [
      { id: 'input', name: 'Input', type: 'any', dataType: 'any', required: true }
    ],
    outputs: [
      { id: 'output', name: 'Output', type: 'any', dataType: 'any' }
    ],
    defaultData: {
      label: 'Delay',
      parameters: { delayPeriods: 1 }
    },
    tags: ['utility', 'delay', 'timing', 'offset'],
    complexity: 'intermediate'
  },

  {
    id: 'switch',
    name: 'Switch',
    description: 'Route signal based on condition',
    category: NodeCategory.UTILITY,
    type: 'utility',
    icon: <Layers className="h-4 w-4" />,
    color: '#8B5CF6',
    inputs: [
      { id: 'condition', name: 'Condition', type: 'boolean', dataType: 'boolean', required: true },
      { id: 'trueInput', name: 'True Path', type: 'any', dataType: 'any', required: true },
      { id: 'falseInput', name: 'False Path', type: 'any', dataType: 'any', required: true }
    ],
    outputs: [
      { id: 'output', name: 'Output', type: 'any', dataType: 'any' }
    ],
    defaultData: {
      label: 'Switch'
    },
    tags: ['utility', 'switch', 'condition', 'router'],
    complexity: 'intermediate'
  },

  // Custom Code Nodes (FE-009)
  {
    id: 'javascript-code',
    name: 'JavaScript Code',
    description: 'Custom JavaScript code execution node',
    category: NodeCategory.CUSTOM_CODE,
    type: 'custom-code',
    icon: <Code className="h-4 w-4" />,
    color: '#F7DF1E',
    component: JavaScriptCodeNode,
    inputs: [
      { id: 'input', name: 'Input', type: 'any', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Output', type: 'any', dataType: 'any' }
    ],
    defaultData: {
      label: 'JavaScript',
      parameters: { code: 'function processData(input) { return input; }' }
    },
    tags: ['custom', 'javascript', 'code', 'programmable'],
    complexity: 'advanced'
  },

  {
    id: 'sql-query',
    name: 'SQL Query',
    description: 'Execute SQL queries on market data',
    category: NodeCategory.CUSTOM_CODE,
    type: 'custom-code',
    icon: <FileText className="h-4 w-4" />,
    color: '#336791',
    component: SQLQueryNode,
    inputs: [
      { id: 'parameters', name: 'Parameters', type: 'object', dataType: 'object' }
    ],
    outputs: [
      { id: 'result', name: 'Query Result', type: 'dataset', dataType: 'array' }
    ],
    defaultData: {
      label: 'SQL Query',
      parameters: { query: 'SELECT * FROM market_data WHERE symbol = ?', timeout: 5000 }
    },
    tags: ['sql', 'query', 'database', 'data'],
    complexity: 'advanced'
  },

  // Machine Learning Nodes (FE-009)
  {
    id: 'neural-network',
    name: 'Neural Network',
    description: 'Configurable neural network model for predictions',
    category: NodeCategory.MACHINE_LEARNING,
    type: 'ml-model',
    icon: <Brain className="h-4 w-4" />,
    color: '#FF6B6B',
    component: NeuralNetworkNode,
    inputs: [
      { id: 'features', name: 'Features', type: 'array', dataType: 'array', required: true }
    ],
    outputs: [
      { id: 'prediction', name: 'Prediction', type: 'number', dataType: 'number' },
      { id: 'confidence', name: 'Confidence', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'Neural Network',
      parameters: { hiddenLayers: [64, 32, 16], activation: 'relu', epochs: 100 }
    },
    tags: ['ml', 'neural-network', 'prediction', 'deep-learning'],
    complexity: 'advanced'
  },

  {
    id: 'lstm-model',
    name: 'LSTM Model',
    description: 'Long Short-Term Memory model for time series prediction',
    category: NodeCategory.MACHINE_LEARNING,
    type: 'ml-model',
    icon: <TrendingUp className="h-4 w-4" />,
    color: '#4ECDC4',
    component: LSTMModelNode,
    inputs: [
      { id: 'timeSeries', name: 'Time Series', type: 'array', dataType: 'array', required: true }
    ],
    outputs: [
      { id: 'forecast', name: 'Forecast', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'LSTM',
      parameters: { sequenceLength: 60, units: [128, 64, 32] }
    },
    tags: ['ml', 'lstm', 'time-series', 'forecasting'],
    complexity: 'advanced'
  },

  {
    id: 'random-forest',
    name: 'Random Forest',
    description: 'Ensemble learning method using multiple decision trees',
    category: NodeCategory.MACHINE_LEARNING,
    type: 'ml-model',
    icon: <Target className="h-4 w-4" />,
    color: '#45B7D1',
    component: RandomForestNode,
    inputs: [
      { id: 'features', name: 'Features', type: 'array', dataType: 'array', required: true }
    ],
    outputs: [
      { id: 'prediction', name: 'Prediction', type: 'number', dataType: 'number' },
      { id: 'importance', name: 'Feature Importance', type: 'array', dataType: 'array' }
    ],
    defaultData: {
      label: 'Random Forest',
      parameters: { nEstimators: 100, maxDepth: null }
    },
    tags: ['ml', 'random-forest', 'ensemble', 'classification'],
    complexity: 'advanced'
  },

  {
    id: 'model-ensemble',
    name: 'Model Ensemble',
    description: 'Combine multiple ML models for improved predictions',
    category: NodeCategory.MACHINE_LEARNING,
    type: 'ml-model',
    icon: <Settings className="h-4 w-4" />,
    color: '#96CEB4',
    component: ModelEnsembleNode,
    inputs: [
      { id: 'model1', name: 'Model 1', type: 'prediction', dataType: 'number', required: true },
      { id: 'model2', name: 'Model 2', type: 'prediction', dataType: 'number', required: true },
      { id: 'model3', name: 'Model 3', type: 'prediction', dataType: 'number' }
    ],
    outputs: [
      { id: 'ensemble', name: 'Ensemble Prediction', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'Ensemble',
      parameters: { weights: [0.4, 0.3, 0.3], method: 'weighted_average' }
    },
    tags: ['ml', 'ensemble', 'meta-learning', 'combination'],
    complexity: 'advanced'
  },

  // Advanced Risk Management Nodes (FE-009)
  {
    id: 'advanced-position-sizing',
    name: 'Advanced Position Sizing',
    description: 'Sophisticated position sizing with multiple algorithms',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'risk-advanced',
    icon: <DollarSign className="h-4 w-4" />,
    color: '#FF9F43',
    component: PositionSizingNode,
    inputs: [
      { id: 'signal', name: 'Trading Signal', type: 'signal', dataType: 'signal', required: true },
      { id: 'volatility', name: 'Volatility', type: 'number', dataType: 'number' }
    ],
    outputs: [
      { id: 'positionSize', name: 'Position Size', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'Advanced Position Sizing',
      parameters: { method: 'kelly', riskPerTrade: 2.0, maxPosition: 10.0 }
    },
    tags: ['risk', 'position-sizing', 'kelly', 'volatility-adjusted'],
    complexity: 'advanced'
  },

  {
    id: 'advanced-stop-loss',
    name: 'Advanced Stop Loss',
    description: 'Dynamic stop loss with multiple types and trailing',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'risk-advanced',
    icon: <Shield className="h-4 w-4" />,
    color: '#FF6B6B',
    component: StopLossNode,
    inputs: [
      { id: 'entryPrice', name: 'Entry Price', type: 'price', dataType: 'number', required: true },
      { id: 'currentPrice', name: 'Current Price', type: 'price', dataType: 'number', required: true },
      { id: 'atr', name: 'ATR', type: 'indicator', dataType: 'number' }
    ],
    outputs: [
      { id: 'stopPrice', name: 'Stop Price', type: 'price', dataType: 'number' },
      { id: 'stopSignal', name: 'Stop Signal', type: 'signal', dataType: 'boolean' }
    ],
    defaultData: {
      label: 'Advanced Stop Loss',
      parameters: { type: 'trailing', distance: 2.0, atrMultiplier: 2.5 }
    },
    tags: ['risk', 'stop-loss', 'trailing', 'atr', 'dynamic'],
    complexity: 'advanced'
  },

  {
    id: 'portfolio-risk-monitor',
    name: 'Portfolio Risk Monitor',
    description: 'Real-time portfolio risk monitoring and alerts',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'risk-monitor',
    icon: <BarChart3 className="h-4 w-4" />,
    color: '#F39C12',
    component: PortfolioRiskMonitorNode,
    inputs: [
      { id: 'portfolio', name: 'Portfolio Data', type: 'portfolio', dataType: 'object', required: true }
    ],
    outputs: [
      { id: 'riskScore', name: 'Risk Score', type: 'number', dataType: 'number' },
      { id: 'alerts', name: 'Risk Alerts', type: 'array', dataType: 'array' }
    ],
    defaultData: {
      label: 'Risk Monitor',
      parameters: { maxDrawdown: 15.0, maxVolatility: 20.0, realTimeMonitoring: true }
    },
    tags: ['risk', 'monitoring', 'portfolio', 'alerts', 'real-time'],
    complexity: 'advanced'
  },

  {
    id: 'dynamic-hedging',
    name: 'Dynamic Hedging',
    description: 'Automated portfolio hedging strategies',
    category: NodeCategory.RISK_MANAGEMENT,
    type: 'risk-hedge',
    icon: <Zap className="h-4 w-4" />,
    color: '#9B59B6',
    component: DynamicHedgingNode,
    inputs: [
      { id: 'portfolio', name: 'Portfolio', type: 'portfolio', dataType: 'object', required: true },
      { id: 'marketData', name: 'Market Data', type: 'market', dataType: 'object' }
    ],
    outputs: [
      { id: 'hedgeSignal', name: 'Hedge Signal', type: 'signal', dataType: 'signal' },
      { id: 'hedgeRatio', name: 'Hedge Ratio', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'Dynamic Hedging',
      parameters: { strategy: 'delta_neutral', threshold: 5.0, automatic: false }
    },
    tags: ['risk', 'hedging', 'delta-neutral', 'dynamic'],
    complexity: 'advanced'
  },

  // Portfolio Management Nodes (FE-009)
  {
    id: 'portfolio-rebalancing',
    name: 'Portfolio Rebalancing',
    description: 'Automated portfolio rebalancing with multiple triggers',
    category: NodeCategory.PORTFOLIO_MANAGEMENT,
    type: 'portfolio',
    icon: <Balance className="h-4 w-4" />,
    color: '#3498DB',
    component: PortfolioRebalancingNode,
    inputs: [
      { id: 'portfolio', name: 'Portfolio', type: 'portfolio', dataType: 'object', required: true },
      { id: 'targets', name: 'Target Allocation', type: 'object', dataType: 'object' }
    ],
    outputs: [
      { id: 'rebalanceSignal', name: 'Rebalance Signal', type: 'signal', dataType: 'boolean' },
      { id: 'trades', name: 'Rebalance Trades', type: 'array', dataType: 'array' }
    ],
    defaultData: {
      label: 'Portfolio Rebalancing',
      parameters: { method: 'threshold', threshold: 5.0, frequency: 'monthly' }
    },
    tags: ['portfolio', 'rebalancing', 'allocation', 'automation'],
    complexity: 'advanced'
  },

  {
    id: 'asset-allocation-optimizer',
    name: 'Asset Allocation Optimizer',
    description: 'Modern portfolio theory optimization engine',
    category: NodeCategory.PORTFOLIO_MANAGEMENT,
    type: 'portfolio',
    icon: <Target className="h-4 w-4" />,
    color: '#E74C3C',
    component: AssetAllocationOptimizerNode,
    inputs: [
      { id: 'returns', name: 'Return Data', type: 'array', dataType: 'array', required: true },
      { id: 'constraints', name: 'Constraints', type: 'object', dataType: 'object' }
    ],
    outputs: [
      { id: 'weights', name: 'Optimal Weights', type: 'array', dataType: 'array' },
      { id: 'expectedReturn', name: 'Expected Return', type: 'number', dataType: 'number' },
      { id: 'expectedRisk', name: 'Expected Risk', type: 'number', dataType: 'number' }
    ],
    defaultData: {
      label: 'Asset Optimizer',
      parameters: { objective: 'max_sharpe', lookbackPeriod: 252 }
    },
    tags: ['portfolio', 'optimization', 'sharpe', 'efficient-frontier'],
    complexity: 'advanced'
  },

  {
    id: 'multi-asset-portfolio',
    name: 'Multi-Asset Portfolio',
    description: 'Diversified multi-asset portfolio management',
    category: NodeCategory.PORTFOLIO_MANAGEMENT,
    type: 'portfolio',
    icon: <PieChart className="h-4 w-4" />,
    color: '#2ECC71',
    component: MultiAssetPortfolioNode,
    inputs: [
      { id: 'assets', name: 'Asset Universe', type: 'array', dataType: 'array', required: true }
    ],
    outputs: [
      { id: 'portfolio', name: 'Portfolio', type: 'portfolio', dataType: 'object' },
      { id: 'diversification', name: 'Diversification Metrics', type: 'object', dataType: 'object' }
    ],
    defaultData: {
      label: 'Multi-Asset Portfolio',
      parameters: { strategy: 'risk_parity', correlationThreshold: 0.8 }
    },
    tags: ['portfolio', 'multi-asset', 'diversification', 'correlation'],
    complexity: 'advanced'
  },

  {
    id: 'performance-attribution',
    name: 'Performance Attribution',
    description: 'Analyze portfolio performance attribution and contributions',
    category: NodeCategory.PORTFOLIO_MANAGEMENT,
    type: 'analysis',
    icon: <BarChart3 className="h-4 w-4" />,
    color: '#1ABC9C',
    component: PerformanceAttributionNode,
    inputs: [
      { id: 'portfolio', name: 'Portfolio Performance', type: 'object', dataType: 'object', required: true },
      { id: 'benchmark', name: 'Benchmark', type: 'object', dataType: 'object' }
    ],
    outputs: [
      { id: 'attribution', name: 'Attribution Analysis', type: 'object', dataType: 'object' },
      { id: 'contributions', name: 'Asset Contributions', type: 'array', dataType: 'array' }
    ],
    defaultData: {
      label: 'Performance Attribution',
      parameters: { method: 'brinson', period: 'monthly' }
    },
    tags: ['performance', 'attribution', 'analysis', 'contribution'],
    complexity: 'advanced'
  }
];

// Node factory functions
export class NodeFactory {
  static createNode(templateId: string, position: { x: number; y: number }): NodeData | null {
    const template = NODE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return null;

    return {
      id: `${templateId}_${Date.now()}`,
      type: template.type,
      position,
      data: {
        ...template.defaultData,
        templateId: template.id,
        category: template.category
      },
      inputs: template.inputs.map(input => ({
        ...input,
        connected: false
      })),
      outputs: template.outputs.map(output => ({
        ...output,
        connected: false
      }))
    };
  }

  static getTemplatesByCategory(category: NodeCategory): NodeTemplate[] {
    return NODE_TEMPLATES.filter(template => template.category === category);
  }

  static getTemplateById(id: string): NodeTemplate | null {
    return NODE_TEMPLATES.find(template => template.id === id) || null;
  }

  static searchTemplates(query: string): NodeTemplate[] {
    const searchTerm = query.toLowerCase();
    return NODE_TEMPLATES.filter(template =>
      template.name.toLowerCase().includes(searchTerm) ||
      template.description.toLowerCase().includes(searchTerm) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  static getTemplatesByComplexity(complexity: 'beginner' | 'intermediate' | 'advanced'): NodeTemplate[] {
    return NODE_TEMPLATES.filter(template => template.complexity === complexity);
  }
}

// Component mapping for rendering nodes
export const NodeComponents: Record<string, React.ComponentType<any>> = {
  // Indicators
  sma: IndicatorNodes.SMA,
  ema: IndicatorNodes.EMA,
  rsi: IndicatorNodes.RSI,
  macd: IndicatorNodes.MACD,
  'bollinger-bands': IndicatorNodes.BollingerBands,

  // Conditions
  comparison: ConditionNodes.Comparison,
  crossover: ConditionNodes.Crossover,
  'range-check': ConditionNodes.RangeCheck,
  'multi-condition': ConditionNodes.MultiCondition,

  // Logic
  'and-gate': LogicNodes.AND,
  'or-gate': LogicNodes.OR,
  'not-gate': LogicNodes.NOT,
  'xor-gate': LogicNodes.XOR,
  'nand-gate': LogicNodes.NAND,
  'variable-gate': LogicNodes.Variable,

  // Signals
  'buy-signal': SignalNodes.Buy,
  'sell-signal': SignalNodes.Sell,
  'stop-loss': SignalNodes.StopLoss,
  'take-profit': SignalNodes.TakeProfit,
  'position-size': SignalNodes.PositionSize,

  // Advanced Custom Code Nodes (FE-009)
  'javascript-code': JavaScriptCodeNode,
  'typescript-code': TypeScriptCodeNode,
  'sql-query': SQLQueryNode,

  // Machine Learning Nodes (FE-009)
  'neural-network': NeuralNetworkNode,
  'lstm-model': LSTMModelNode,
  'random-forest': RandomForestNode,
  'model-ensemble': ModelEnsembleNode,

  // Advanced Risk Management Nodes (FE-009)
  'advanced-position-sizing': PositionSizingNode,
  'advanced-stop-loss': StopLossNode,
  'advanced-take-profit': TakeProfitNode,
  'portfolio-risk-monitor': PortfolioRiskMonitorNode,
  'dynamic-hedging': DynamicHedgingNode,

  // Portfolio Management Nodes (FE-009)
  'portfolio-rebalancing': PortfolioRebalancingNode,
  'asset-allocation-optimizer': AssetAllocationOptimizerNode,
  'multi-asset-portfolio': MultiAssetPortfolioNode,
  'performance-attribution': PerformanceAttributionNode
};

// Export everything
export {
  IndicatorNodes,
  ConditionNodes, 
  LogicNodes,
  SignalNodes,
  // Advanced node types (FE-009)
  JavaScriptCodeNode,
  TypeScriptCodeNode,
  SQLQueryNode,
  NeuralNetworkNode,
  LSTMModelNode,
  RandomForestNode,
  ModelEnsembleNode,
  PositionSizingNode,
  StopLossNode,
  TakeProfitNode,
  PortfolioRiskMonitorNode,
  DynamicHedgingNode,
  PortfolioRebalancingNode,
  AssetAllocationOptimizerNode,
  MultiAssetPortfolioNode,
  PerformanceAttributionNode
};

export default {
  templates: NODE_TEMPLATES,
  factory: NodeFactory,
  components: NodeComponents,
  categories: NodeCategory
};