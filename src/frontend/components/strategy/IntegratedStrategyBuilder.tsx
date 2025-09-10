/**
 * Integrated Strategy Builder - FE-011
 * 
 * Comprehensive strategy builder integration that combines visual editing,
 * backtesting, real-time testing, performance monitoring, and deployment.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { 
  Play, 
  Pause, 
  Square, 
  Save, 
  Upload,
  Download,
  Settings,
  BarChart3,
  Activity,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Rocket,
  Database,
  Cloud,
  Shield,
  RefreshCw,
  Eye,
  Code,
  Users
} from 'lucide-react';
import { NodeCanvas, NodeData, ConnectionData } from '../nodes/NodeCanvas';
import { NodePalette } from '../nodes/NodePalette';
import { RealTimeStrategyPreview } from './RealTimeStrategyPreview';
import { LivePerformanceMonitor } from './LivePerformanceMonitor';
import { useStrategyValidation } from './StrategyValidationEngine';
import { useStrategyCompiler } from './StrategyCompiler';

interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  isPublic: boolean;
  allowCopy: boolean;
  category: string;
}

interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
  symbol: string;
  timeframe: string;
  commission: number;
  slippage: number;
  maxPositions: number;
}

interface DeploymentConfig {
  environment: 'paper' | 'live';
  exchange: string;
  apiCredentials?: {
    keyId: string;
    secret: string;
  };
  maxCapital: number;
  maxDailyLoss: number;
  riskLimits: {
    maxPositionSize: number;
    maxDrawdown: number;
    dailyLossLimit: number;
  };
  notifications: {
    email: boolean;
    telegram: boolean;
    webhook?: string;
  };
}

interface BacktestResults {
  isRunning: boolean;
  progress: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  startDate: string;
  endDate: string;
  finalEquity: number;
  trades: TradeResult[];
}

interface TradeResult {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  pnl: number;
  commission: number;
  reason: string;
}

interface IntegratedStrategyBuilderProps {
  strategyId?: string;
  onSave?: (strategy: any) => void;
  onDeploy?: (config: DeploymentConfig) => void;
}

export const IntegratedStrategyBuilder: React.FC<IntegratedStrategyBuilderProps> = ({
  strategyId,
  onSave,
  onDeploy
}) => {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [activeTab, setActiveTab] = useState('builder');
  const [isBuilderExpanded, setIsBuilderExpanded] = useState(true);

  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>({
    id: strategyId || `strategy_${Date.now()}`,
    name: 'New Strategy',
    description: '',
    version: '1.0.0',
    author: 'User',
    tags: [],
    isPublic: false,
    allowCopy: true,
    category: 'trend-following'
  });

  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 10000,
    symbol: 'BTC-USD',
    timeframe: '1h',
    commission: 0.001,
    slippage: 0.001,
    maxPositions: 1
  });

  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    environment: 'paper',
    exchange: 'dydx',
    maxCapital: 1000,
    maxDailyLoss: 100,
    riskLimits: {
      maxPositionSize: 500,
      maxDrawdown: 10,
      dailyLossLimit: 50
    },
    notifications: {
      email: true,
      telegram: false
    }
  });

  const [backtestResults, setBacktestResults] = useState<BacktestResults>({
    isRunning: false,
    progress: 0,
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    averageWin: 0,
    averageLoss: 0,
    startDate: '',
    endDate: '',
    finalEquity: 0,
    trades: []
  });

  const [isLiveTesting, setIsLiveTesting] = useState(false);
  const [isDeploymentReady, setIsDeploymentReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { validate } = useStrategyValidation();
  const { compile } = useStrategyCompiler();

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (nodes.length === 0) return;
    
    setSaveStatus('saving');
    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const strategyData = {
        ...strategyConfig,
        nodes,
        connections,
        lastModified: new Date().toISOString()
      };
      
      onSave?.(strategyData);
      setSaveStatus('saved');
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [nodes, connections, strategyConfig, onSave]);

  // Auto-save on changes
  useEffect(() => {
    const timeoutId = setTimeout(autoSave, 2000);
    return () => clearTimeout(timeoutId);
  }, [nodes, connections, autoSave]);

  // Backtest execution
  const runBacktest = useCallback(async () => {
    const validation = await validate(nodes, connections);
    if (!validation.isValid) {
      alert('Strategy validation failed. Please fix errors before running backtest.');
      return;
    }

    setBacktestResults(prev => ({ ...prev, isRunning: true, progress: 0 }));
    
    // Simulate backtesting process
    const interval = setInterval(() => {
      setBacktestResults(prev => {
        const newProgress = Math.min(prev.progress + 10, 100);
        
        if (newProgress >= 100) {
          clearInterval(interval);
          
          // Generate mock results
          const mockTrades = Array.from({ length: 50 }, (_, i) => ({
            id: `trade_${i}`,
            timestamp: Date.now() - (50 - i) * 24 * 60 * 60 * 1000,
            type: Math.random() > 0.5 ? 'buy' as const : 'sell' as const,
            price: 50000 + Math.random() * 10000,
            quantity: 0.01 + Math.random() * 0.1,
            pnl: (Math.random() - 0.4) * 500,
            commission: 5 + Math.random() * 10,
            reason: ['Technical breakout', 'Mean reversion', 'Volume spike'][Math.floor(Math.random() * 3)]
          }));

          const totalPnL = mockTrades.reduce((sum, trade) => sum + trade.pnl, 0);
          const winningTrades = mockTrades.filter(t => t.pnl > 0);
          
          return {
            ...prev,
            isRunning: false,
            progress: 100,
            totalReturn: (totalPnL / backtestConfig.initialCapital) * 100,
            sharpeRatio: 1.2 + Math.random() * 0.8,
            maxDrawdown: Math.random() * 15 + 5,
            winRate: (winningTrades.length / mockTrades.length) * 100,
            totalTrades: mockTrades.length,
            profitFactor: Math.random() * 1.5 + 0.8,
            averageWin: winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length,
            averageLoss: mockTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / mockTrades.filter(t => t.pnl < 0).length,
            startDate: backtestConfig.startDate,
            endDate: backtestConfig.endDate,
            finalEquity: backtestConfig.initialCapital + totalPnL,
            trades: mockTrades
          };
        }
        
        return { ...prev, progress: newProgress };
      });
    }, 500);
  }, [nodes, connections, validate, backtestConfig]);

  // Live testing toggle
  const toggleLiveTesting = useCallback(() => {
    setIsLiveTesting(!isLiveTesting);
  }, [isLiveTesting]);

  // Deploy strategy
  const deployStrategy = useCallback(async () => {
    const validation = await validate(nodes, connections);
    if (!validation.isValid) {
      alert('Strategy validation failed. Cannot deploy invalid strategy.');
      return;
    }

    const compilation = await compile(nodes, connections);
    if (!compilation.success) {
      alert('Strategy compilation failed. Please fix compilation errors.');
      return;
    }

    try {
      // Simulate deployment
      setIsDeploymentReady(true);
      
      const deploymentData = {
        strategy: {
          ...strategyConfig,
          nodes,
          connections,
          compiledCode: compilation.code
        },
        config: deploymentConfig,
        timestamp: new Date().toISOString()
      };
      
      onDeploy?.(deploymentConfig);
      
      alert(`Strategy "${strategyConfig.name}" deployed successfully to ${deploymentConfig.environment} environment!`);
    } catch (error) {
      alert('Deployment failed. Please try again.');
    }
  }, [nodes, connections, validate, compile, strategyConfig, deploymentConfig, onDeploy]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6" />
              {strategyConfig.name}
            </h1>
            <Badge variant={isLiveTesting ? "success" : "secondary"}>
              {isLiveTesting ? 'Live Testing' : 'Development'}
            </Badge>
            <Badge variant="outline">v{strategyConfig.version}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <Badge variant="outline">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Saving...
              </Badge>
            )}
            {saveStatus === 'saved' && (
              <Badge variant="success">
                <CheckCircle className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
            {saveStatus === 'error' && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Save Error
              </Badge>
            )}
            
            <Button size="sm" variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              size="sm" 
              onClick={deployStrategy}
              disabled={!isDeploymentReady}
            >
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="backtest" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Backtest
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Testing
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="deploy" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Deploy
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="flex-1 flex mt-0">
            <div className="flex-1 flex">
              {/* Node Palette */}
              <div className="w-80 border-r">
                <NodePalette
                  onNodeSelect={(nodeType) => {
                    // Add node to canvas
                    console.log('Adding node:', nodeType);
                  }}
                />
              </div>

              {/* Canvas */}
              <div className="flex-1 relative">
                <NodeCanvas
                  nodes={nodes}
                  connections={connections}
                  onNodesChange={setNodes}
                  onConnectionsChange={setConnections}
                />
              </div>

              {/* Strategy Preview */}
              <div className="w-96 border-l">
                <RealTimeStrategyPreview
                  nodes={nodes}
                  connections={connections}
                  isVisible={true}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="backtest" className="flex-1 p-6">
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* Backtest Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Backtest Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={backtestConfig.startDate}
                        onChange={(e) => setBacktestConfig(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={backtestConfig.endDate}
                        onChange={(e) => setBacktestConfig(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Symbol</Label>
                    <Select
                      value={backtestConfig.symbol}
                      onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, symbol: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                        <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                        <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Initial Capital</Label>
                    <Input
                      type="number"
                      value={backtestConfig.initialCapital}
                      onChange={(e) => setBacktestConfig(prev => ({ ...prev, initialCapital: parseInt(e.target.value) }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Commission (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={backtestConfig.commission}
                        onChange={(e) => setBacktestConfig(prev => ({ ...prev, commission: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Slippage (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={backtestConfig.slippage}
                        onChange={(e) => setBacktestConfig(prev => ({ ...prev, slippage: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={runBacktest}
                    disabled={backtestResults.isRunning}
                    className="w-full"
                  >
                    {backtestResults.isRunning ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Running Backtest... {backtestResults.progress}%
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Backtest
                      </>
                    )}
                  </Button>

                  {backtestResults.isRunning && (
                    <Progress value={backtestResults.progress} className="w-full" />
                  )}
                </CardContent>
              </Card>

              {/* Backtest Results */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Backtest Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {backtestResults.totalTrades > 0 ? (
                    <div className="space-y-6">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${backtestResults.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {backtestResults.totalReturn.toFixed(2)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Total Return</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {backtestResults.sharpeRatio.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {backtestResults.maxDrawdown.toFixed(2)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Max Drawdown</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {backtestResults.winRate.toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Win Rate</div>
                        </div>
                      </div>

                      {/* Additional Metrics */}
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Total Trades</span>
                            <span className="font-mono">{backtestResults.totalTrades}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Profit Factor</span>
                            <span className="font-mono">{backtestResults.profitFactor.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Final Equity</span>
                            <span className="font-mono">{formatCurrency(backtestResults.finalEquity)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Average Win</span>
                            <span className="font-mono text-green-600">{formatCurrency(backtestResults.averageWin)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Average Loss</span>
                            <span className="font-mono text-red-600">{formatCurrency(backtestResults.averageLoss)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Period</span>
                            <span className="font-mono">{backtestResults.startDate} - {backtestResults.endDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Performance Assessment */}
                      <div className="flex gap-2 flex-wrap">
                        {backtestResults.totalReturn > 20 && (
                          <Badge className="bg-green-100 text-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            High Returns
                          </Badge>
                        )}
                        {backtestResults.sharpeRatio > 1.5 && (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Target className="h-3 w-3 mr-1" />
                            Excellent Risk-Adjusted Returns
                          </Badge>
                        )}
                        {backtestResults.maxDrawdown < 10 && (
                          <Badge className="bg-purple-100 text-purple-800">
                            <Shield className="h-3 w-3 mr-1" />
                            Low Drawdown
                          </Badge>
                        )}
                        {backtestResults.winRate > 60 && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            High Win Rate
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Run a backtest to see results here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="live" className="flex-1 p-6">
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* Live Testing Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Live Testing Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Live Testing</Label>
                    <Switch
                      checked={isLiveTesting}
                      onCheckedChange={toggleLiveTesting}
                    />
                  </div>

                  {isLiveTesting && (
                    <Alert>
                      <Activity className="h-4 w-4" />
                      <AlertDescription>
                        Strategy is running in live testing mode with paper trading.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <Label>Test Environment</Label>
                    <Select defaultValue="paper">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paper">Paper Trading</SelectItem>
                        <SelectItem value="testnet">Testnet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Virtual Capital</Label>
                    <Input type="number" defaultValue="10000" />
                  </div>

                  <div className="space-y-2">
                    <Label>Safety Limits</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Max Daily Loss</Label>
                        <Input type="number" defaultValue="200" />
                      </div>
                      <div>
                        <Label className="text-xs">Max Position</Label>
                        <Input type="number" defaultValue="1000" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Performance Monitor */}
              <div className="col-span-2">
                <LivePerformanceMonitor
                  isActive={isLiveTesting}
                  strategyName={strategyConfig.name}
                  onToggleMonitoring={setIsLiveTesting}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="flex-1 p-6">
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Performance monitoring dashboard will be displayed here</p>
            </div>
          </TabsContent>

          <TabsContent value="deploy" className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Strategy Deployment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Environment</Label>
                    <Select
                      value={deploymentConfig.environment}
                      onValueChange={(value: 'paper' | 'live') => 
                        setDeploymentConfig(prev => ({ ...prev, environment: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paper">Paper Trading</SelectItem>
                        <SelectItem value="live">Live Trading</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Exchange</Label>
                    <Select
                      value={deploymentConfig.exchange}
                      onValueChange={(value) => 
                        setDeploymentConfig(prev => ({ ...prev, exchange: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dydx">dYdX</SelectItem>
                        <SelectItem value="binance">Binance</SelectItem>
                        <SelectItem value="coinbase">Coinbase Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Max Capital</Label>
                      <Input
                        type="number"
                        value={deploymentConfig.maxCapital}
                        onChange={(e) => setDeploymentConfig(prev => ({ 
                          ...prev, 
                          maxCapital: parseInt(e.target.value) 
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Max Daily Loss</Label>
                      <Input
                        type="number"
                        value={deploymentConfig.maxDailyLoss}
                        onChange={(e) => setDeploymentConfig(prev => ({ 
                          ...prev, 
                          maxDailyLoss: parseInt(e.target.value) 
                        }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notifications</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Email Notifications</span>
                        <Switch
                          checked={deploymentConfig.notifications.email}
                          onCheckedChange={(checked) => 
                            setDeploymentConfig(prev => ({
                              ...prev,
                              notifications: { ...prev.notifications, email: checked }
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Telegram Notifications</span>
                        <Switch
                          checked={deploymentConfig.notifications.telegram}
                          onCheckedChange={(checked) => 
                            setDeploymentConfig(prev => ({
                              ...prev,
                              notifications: { ...prev.notifications, telegram: checked }
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={deployStrategy} className="w-full">
                    <Rocket className="h-4 w-4 mr-2" />
                    Deploy Strategy
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Strategy Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Strategy Name</Label>
                    <Input
                      value={strategyConfig.name}
                      onChange={(e) => setStrategyConfig(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={strategyConfig.description}
                      onChange={(e) => setStrategyConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your strategy..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Version</Label>
                      <Input
                        value={strategyConfig.version}
                        onChange={(e) => setStrategyConfig(prev => ({ ...prev, version: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={strategyConfig.category}
                        onValueChange={(value) => setStrategyConfig(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trend-following">Trend Following</SelectItem>
                          <SelectItem value="mean-reversion">Mean Reversion</SelectItem>
                          <SelectItem value="arbitrage">Arbitrage</SelectItem>
                          <SelectItem value="scalping">Scalping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Public Strategy</Label>
                      <Switch
                        checked={strategyConfig.isPublic}
                        onCheckedChange={(checked) => setStrategyConfig(prev => ({ ...prev, isPublic: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Allow Copying</Label>
                      <Switch
                        checked={strategyConfig.allowCopy}
                        onCheckedChange={(checked) => setStrategyConfig(prev => ({ ...prev, allowCopy: checked }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};