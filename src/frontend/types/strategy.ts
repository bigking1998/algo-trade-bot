// Advanced Strategy Builder Types
import { Timeframe } from '../../shared/types/trading';

// Visual Strategy Node Types
export type StrategyNodeType = 
  | 'indicator' 
  | 'condition' 
  | 'signal' 
  | 'logic' 
  | 'risk' 
  | 'entry' 
  | 'exit'
  | 'custom';

export interface StrategyNode {
  id: string;
  type: StrategyNodeType;
  category: string;
  name: string;
  description: string;
  position: { x: number; y: number };
  data: {
    label: string;
    parameters: Record<string, any>;
    inputs: StrategyNodePort[];
    outputs: StrategyNodePort[];
    validation?: ValidationResult;
    preview?: PreviewData;
  };
}

export interface StrategyNodePort {
  id: string;
  name: string;
  type: 'number' | 'boolean' | 'array' | 'signal';
  required: boolean;
  connected?: boolean;
}

export interface StrategyConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

// Indicator Types
export type IndicatorType = 
  | 'SMA' 
  | 'EMA' 
  | 'RSI' 
  | 'MACD' 
  | 'BB' 
  | 'ATR' 
  | 'STOCH' 
  | 'ADX' 
  | 'OBV' 
  | 'VWAP'
  | 'CCI'
  | 'WILLIAMS_R'
  | 'MFI'
  | 'AROON'
  | 'TRIX';

export interface IndicatorConfig {
  type: IndicatorType;
  name: string;
  period?: number;
  source: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
  params?: Record<string, any>;
}

// Condition Types
export type ConditionOperator = 
  | '>' 
  | '<' 
  | '>=' 
  | '<=' 
  | '==' 
  | '!=' 
  | 'crosses_above' 
  | 'crosses_below'
  | 'rising'
  | 'falling';

export interface TradingCondition {
  id: string;
  name: string;
  indicator1: string;
  operator: ConditionOperator;
  indicator2: string | number;
  lookback?: number;
}

export interface LogicCondition {
  type: 'AND' | 'OR' | 'NOT';
  conditions: (TradingCondition | LogicCondition)[];
}

// Signal Types
export interface TradingSignal {
  id: string;
  timestamp: number;
  type: 'entry' | 'exit';
  side: 'long' | 'short';
  price: number;
  confidence: number;
  reason: string;
  tags?: string[];
}

// Strategy Configuration
export interface StrategyConfig {
  name: string;
  description: string;
  version: string;
  author: string;
  timeframe: Timeframe;
  indicators: Record<string, IndicatorConfig>;
  entryConditions: {
    long: TradingCondition[];
    short: TradingCondition[];
  };
  exitConditions: {
    long: TradingCondition[];
    short: TradingCondition[];
  };
  riskManagement: {
    stopLoss?: number;
    takeProfit?: number;
    maxPositionSize?: number;
    maxDrawdown?: number;
    cooldownPeriod?: number;
  };
  advanced?: {
    customStakeAmount?: boolean;
    customEntryPrice?: boolean;
    customExitPrice?: boolean;
    informativePairs?: string[];
  };
}

// Visual Strategy Definition
export interface VisualStrategyDefinition {
  id: string;
  name: string;
  description: string;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
  config: StrategyConfig;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    author: string;
    tags: string[];
  };
}

// Template Types
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'mean_reversion' | 'momentum' | 'breakout' | 'scalping' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  definition: VisualStrategyDefinition;
  performance?: {
    backtestResults?: BacktestResults;
    rating: number;
    downloads: number;
  };
  author: string;
  createdAt: Date;
  isPublic: boolean;
}

// Backtest Types
export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  timeframe: Timeframe;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number;
  slippage: number;
}

export interface BacktestResults {
  id: string;
  strategyId: string;
  config: BacktestConfig;
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    volatility: number;
    skewness: number;
    kurtosis: number;
  };
  trades: {
    total: number;
    winning: number;
    losing: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    avgTradeDuration: number;
    largestWin: number;
    largestLoss: number;
  };
  periods: {
    totalDays: number;
    tradingDays: number;
    bestMonth: number;
    worstMonth: number;
    winningMonths: number;
    losingMonths: number;
  };
  equity: Array<{
    date: Date;
    value: number;
    drawdown: number;
  }>;
  trades_detail: Array<{
    entryTime: Date;
    exitTime: Date;
    side: 'long' | 'short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    duration: number;
    reason: string;
  }>;
  runTime: number;
  completedAt: Date;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  nodeId?: string;
  type: 'connection' | 'parameter' | 'logic' | 'performance';
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  nodeId?: string;
  type: 'optimization' | 'compatibility' | 'performance' | 'logic';
  message: string;
  suggestion?: string;
}

// Preview Types
export interface PreviewData {
  indicators?: Record<string, number[]>;
  signals?: TradingSignal[];
  performance?: {
    value: number;
    change: number;
    changePercent: number;
  };
}

// Code Editor Types
export interface CustomStrategyCode {
  typescript: string;
  python?: string;
  compiled?: string;
}

export interface StrategyVersion {
  version: string;
  description: string;
  changes: string[];
  createdAt: Date;
  definition: VisualStrategyDefinition;
  code?: CustomStrategyCode;
}

// Deployment Types
export interface DeploymentConfig {
  environment: 'paper' | 'live';
  exchanges: string[];
  symbols: string[];
  allocation: number;
  riskLimits: {
    maxPositionSize: number;
    maxDrawdown: number;
    dailyLossLimit: number;
  };
  notifications: {
    trades: boolean;
    errors: boolean;
    performance: boolean;
    channels: ('email' | 'webhook' | 'app')[];
  };
}

export interface StrategyDeployment {
  id: string;
  strategyId: string;
  config: DeploymentConfig;
  status: 'pending' | 'active' | 'paused' | 'stopped' | 'error';
  startedAt?: Date;
  stoppedAt?: Date;
  performance: {
    totalPnL: number;
    totalTrades: number;
    runningTime: number;
    lastUpdate: Date;
  };
  errors?: Array<{
    timestamp: Date;
    error: string;
    resolved: boolean;
  }>;
}

// ML Integration Types
export interface MLModelConfig {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'reinforcement';
  version: string;
  features: string[];
  target: string;
  hyperparameters: Record<string, any>;
  performance: {
    accuracy?: number;
    mse?: number;
    r2?: number;
    confusionMatrix?: number[][];
  };
}

export interface MLEnhancedStrategy extends StrategyConfig {
  mlModels: MLModelConfig[];
  featureEngineering: {
    windowSizes: number[];
    features: string[];
    scaling: 'standard' | 'minmax' | 'robust';
  };
}

// Node Templates
export interface NodeTemplate {
  id: string;
  type: StrategyNodeType;
  category: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultData: {
    parameters: Record<string, any>;
    inputs: StrategyNodePort[];
    outputs: StrategyNodePort[];
  };
  documentation: {
    description: string;
    parameters: Record<string, {
      type: string;
      description: string;
      default?: any;
      min?: number;
      max?: number;
      options?: any[];
    }>;
    examples: Array<{
      title: string;
      description: string;
      parameters: Record<string, any>;
    }>;
  };
}

// Builder State
export interface StrategyBuilderState {
  currentStrategy?: VisualStrategyDefinition;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
  selectedNodes: string[];
  selectedConnections: string[];
  clipboard?: {
    nodes: StrategyNode[];
    connections: StrategyConnection[];
  };
  history: {
    past: VisualStrategyDefinition[];
    future: VisualStrategyDefinition[];
  };
  validation: ValidationResult;
  preview: {
    isRunning: boolean;
    data?: PreviewData;
    error?: string;
  };
  mode: 'visual' | 'code' | 'hybrid';
}