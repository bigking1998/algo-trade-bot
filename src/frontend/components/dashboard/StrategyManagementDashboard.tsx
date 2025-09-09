import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { 
  PlayCircle, 
  StopCircle, 
  Settings, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
  DollarSign,
  Users,
  Clock
} from "lucide-react";

// Types
interface Strategy {
  id: string;
  name: string;
  type: 'EMAcrossover' | 'RSIMeanReversion' | 'MACDTrend' | 'Breakout';
  status: 'active' | 'inactive' | 'paused' | 'error';
  performance: {
    totalReturn: number;
    winRate: number;
    trades: number;
    sharpe: number;
  };
  config: any;
  created: Date;
  lastUpdated: Date;
}

interface BacktestResult {
  backtestId: string;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
}

/**
 * Enhanced Strategy Management Dashboard - Task FE-001
 * 
 * Production-ready dashboard for managing trading strategies with:
 * - Real-time strategy monitoring
 * - Strategy performance analytics
 * - Integrated backtesting interface
 * - Strategy lifecycle management
 */
const StrategyManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [backtestResults, setBacktestResults] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState(0);

  // Form state for new strategy
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    type: 'EMAcrossover' as const,
    description: '',
    symbols: ['BTC-USD'],
    timeframe: '1h',
    stopLoss: 2.5,
    takeProfit: 5.0,
    positionSize: 10,
    // Strategy-specific parameters
    fastPeriod: 10,
    slowPeriod: 20,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30
  });

  // Load strategies on component mount
  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = () => {
    // Mock data - replace with actual API calls
    const mockStrategies: Strategy[] = [
      {
        id: 'strat_001',
        name: 'BTC EMA Crossover',
        type: 'EMAcrossover',
        status: 'active',
        performance: {
          totalReturn: 23.5,
          winRate: 68.2,
          trades: 145,
          sharpe: 1.42
        },
        config: {
          symbols: ['BTC-USD'],
          timeframe: '1h',
          fastPeriod: 10,
          slowPeriod: 20
        },
        created: new Date('2024-01-15'),
        lastUpdated: new Date('2024-09-09')
      },
      {
        id: 'strat_002',
        name: 'ETH RSI Mean Reversion',
        type: 'RSIMeanReversion',
        status: 'active',
        performance: {
          totalReturn: 18.7,
          winRate: 72.4,
          trades: 89,
          sharpe: 1.28
        },
        config: {
          symbols: ['ETH-USD'],
          timeframe: '4h',
          rsiPeriod: 14,
          rsiOverbought: 70,
          rsiOversold: 30
        },
        created: new Date('2024-02-20'),
        lastUpdated: new Date('2024-09-08')
      },
      {
        id: 'strat_003',
        name: 'Multi-Asset MACD',
        type: 'MACDTrend',
        status: 'paused',
        performance: {
          totalReturn: 12.3,
          winRate: 64.8,
          trades: 203,
          sharpe: 1.15
        },
        config: {
          symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
          timeframe: '1h'
        },
        created: new Date('2024-03-10'),
        lastUpdated: new Date('2024-09-07')
      }
    ];
    setStrategies(mockStrategies);
  };

  const handleCreateStrategy = async () => {
    setIsCreating(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const strategy: Strategy = {
        id: `strat_${Date.now()}`,
        name: newStrategy.name,
        type: newStrategy.type,
        status: 'inactive',
        performance: {
          totalReturn: 0,
          winRate: 0,
          trades: 0,
          sharpe: 0
        },
        config: newStrategy,
        created: new Date(),
        lastUpdated: new Date()
      };
      
      setStrategies(prev => [...prev, strategy]);
      setNewStrategy({
        name: '',
        type: 'EMAcrossover',
        description: '',
        symbols: ['BTC-USD'],
        timeframe: '1h',
        stopLoss: 2.5,
        takeProfit: 5.0,
        positionSize: 10,
        fastPeriod: 10,
        slowPeriod: 20,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30
      });
      setActiveTab('overview');
    } catch (error) {
      console.error('Failed to create strategy:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBacktest = async (strategy: Strategy) => {
    setIsBacktesting(true);
    setBacktestProgress(0);
    
    try {
      // Start backtest
      const response = await fetch('/api/backtesting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Backtest - ${strategy.name}`,
          symbols: strategy.config.symbols,
          timeframe: strategy.config.timeframe,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          initialCapital: 10000,
          strategyType: strategy.type.toLowerCase(),
          strategyConfig: strategy.config
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start backtest');
      }
      
      const { backtestId } = await response.json();
      
      // Poll for progress
      const pollProgress = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/backtesting/progress?backtestId=${backtestId}`);
          if (progressResponse.ok) {
            const progress = await progressResponse.json();
            setBacktestProgress(progress.progressPercent || 0);
            
            if (progress.progressPercent >= 100 || progress.state === 'completed') {
              clearInterval(pollProgress);
              
              // Get results (mock for now)
              const mockResults = await fetch('/api/backtesting/mock-results');
              const results = await mockResults.json();
              setBacktestResults(results);
              setIsBacktesting(false);
            }
          }
        } catch (error) {
          console.error('Error polling progress:', error);
        }
      }, 1000);
      
      // Cleanup after 30 seconds
      setTimeout(() => {
        clearInterval(pollProgress);
        if (isBacktesting) {
          setIsBacktesting(false);
          setBacktestProgress(0);
        }
      }, 30000);
      
    } catch (error) {
      console.error('Backtest failed:', error);
      setIsBacktesting(false);
      setBacktestProgress(0);
    }
  };

  const toggleStrategyStatus = async (strategyId: string) => {
    setStrategies(prev => 
      prev.map(s => 
        s.id === strategyId 
          ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' as any }
          : s
      )
    );
  };

  const getStatusIcon = (status: Strategy['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <StopCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Strategy['status']) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800', 
      paused: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  // Overview stats
  const totalStrategies = strategies.length;
  const activeStrategies = strategies.filter(s => s.status === 'active').length;
  const avgReturn = strategies.reduce((sum, s) => sum + s.performance.totalReturn, 0) / totalStrategies;
  const totalTrades = strategies.reduce((sum, s) => sum + s.performance.trades, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Strategy Management</h2>
          <p className="text-muted-foreground">Create, monitor, and optimize your trading strategies</p>
        </div>
        <Button onClick={() => setActiveTab('create')} className="bg-blue-600 hover:bg-blue-700">
          <Settings className="h-4 w-4 mr-2" />
          Create Strategy
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Strategies</p>
                <p className="text-2xl font-bold">{totalStrategies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Active Strategies</p>
                <p className="text-2xl font-bold text-green-600">{activeStrategies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Average Return</p>
                <p className="text-2xl font-bold text-green-600">+{avgReturn.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold">{totalTrades}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="create">Create Strategy</TabsTrigger>
          <TabsTrigger value="backtest">Backtesting</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Strategies</CardTitle>
              <CardDescription>Monitor and manage your trading strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Win Rate</TableHead>
                    <TableHead>Trades</TableHead>
                    <TableHead>Sharpe</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {strategies.map((strategy) => (
                    <TableRow key={strategy.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(strategy.status)}
                          <span>{strategy.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{strategy.type}</TableCell>
                      <TableCell>{getStatusBadge(strategy.status)}</TableCell>
                      <TableCell>
                        <span className={strategy.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {strategy.performance.totalReturn >= 0 ? '+' : ''}{strategy.performance.totalReturn.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>{strategy.performance.winRate.toFixed(1)}%</TableCell>
                      <TableCell>{strategy.performance.trades}</TableCell>
                      <TableCell>{strategy.performance.sharpe.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toggleStrategyStatus(strategy.id)}
                          >
                            {strategy.status === 'active' ? (
                              <StopCircle className="h-4 w-4" />
                            ) : (
                              <PlayCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleBacktest(strategy)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Strategy Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Strategy</CardTitle>
              <CardDescription>Configure a new trading strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="strategy-name">Strategy Name</Label>
                  <Input
                    id="strategy-name"
                    value={newStrategy.name}
                    onChange={(e) => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter strategy name"
                  />
                </div>
                <div>
                  <Label htmlFor="strategy-type">Strategy Type</Label>
                  <Select value={newStrategy.type} onValueChange={(value: any) => setNewStrategy(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAcrossover">EMA Crossover</SelectItem>
                      <SelectItem value="RSIMeanReversion">RSI Mean Reversion</SelectItem>
                      <SelectItem value="MACDTrend">MACD Trend</SelectItem>
                      <SelectItem value="Breakout">Breakout Strategy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newStrategy.description}
                  onChange={(e) => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your strategy..."
                  rows={3}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Risk Management</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                    <Input 
                      id="stop-loss" 
                      type="number" 
                      value={newStrategy.stopLoss}
                      onChange={(e) => setNewStrategy(prev => ({ ...prev, stopLoss: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="take-profit">Take Profit (%)</Label>
                    <Input 
                      id="take-profit" 
                      type="number" 
                      value={newStrategy.takeProfit}
                      onChange={(e) => setNewStrategy(prev => ({ ...prev, takeProfit: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="position-size">Position Size (%)</Label>
                    <Input 
                      id="position-size" 
                      type="number" 
                      value={newStrategy.positionSize}
                      onChange={(e) => setNewStrategy(prev => ({ ...prev, positionSize: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>

              {/* Strategy-specific parameters */}
              {newStrategy.type === 'EMAcrossover' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">EMA Parameters</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fast-period">Fast EMA Period</Label>
                      <Input 
                        id="fast-period" 
                        type="number" 
                        value={newStrategy.fastPeriod}
                        onChange={(e) => setNewStrategy(prev => ({ ...prev, fastPeriod: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="slow-period">Slow EMA Period</Label>
                      <Input 
                        id="slow-period" 
                        type="number" 
                        value={newStrategy.slowPeriod}
                        onChange={(e) => setNewStrategy(prev => ({ ...prev, slowPeriod: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {newStrategy.type === 'RSIMeanReversion' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">RSI Parameters</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="rsi-period">RSI Period</Label>
                      <Input 
                        id="rsi-period" 
                        type="number" 
                        value={newStrategy.rsiPeriod}
                        onChange={(e) => setNewStrategy(prev => ({ ...prev, rsiPeriod: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rsi-overbought">Overbought Level</Label>
                      <Input 
                        id="rsi-overbought" 
                        type="number" 
                        value={newStrategy.rsiOverbought}
                        onChange={(e) => setNewStrategy(prev => ({ ...prev, rsiOverbought: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rsi-oversold">Oversold Level</Label>
                      <Input 
                        id="rsi-oversold" 
                        type="number" 
                        value={newStrategy.rsiOversold}
                        onChange={(e) => setNewStrategy(prev => ({ ...prev, rsiOversold: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button 
                  onClick={handleCreateStrategy}
                  disabled={!newStrategy.name || isCreating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isCreating ? 'Creating...' : 'Create Strategy'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('overview')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backtesting Tab */}
        <TabsContent value="backtest" className="space-y-4">
          {isBacktesting && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Running Backtest...</h4>
                    <span className="text-sm text-muted-foreground">{backtestProgress.toFixed(1)}%</span>
                  </div>
                  <Progress value={backtestProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {backtestResults && (
            <Card>
              <CardHeader>
                <CardTitle>Latest Backtest Results</CardTitle>
                <CardDescription>Performance metrics from backtesting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      +{backtestResults.totalReturnPercent?.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Total Return</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {backtestResults.annualizedReturn?.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Annualized Return</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {backtestResults.winRate?.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {backtestResults.maxDrawdownPercent?.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Max Drawdown</div>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{backtestResults.totalTrades}</div>
                    <div className="text-sm text-muted-foreground">Total Trades</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{backtestResults.profitFactor?.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Profit Factor</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{backtestResults.sharpeRatio?.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{((backtestResults.volatility || 0) * 100).toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Volatility</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Performance Comparison</CardTitle>
              <CardDescription>Compare performance across all strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {strategies.map((strategy) => (
                  <div key={strategy.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(strategy.status)}
                      <div>
                        <h4 className="font-medium">{strategy.name}</h4>
                        <p className="text-sm text-muted-foreground">{strategy.type}</p>
                      </div>
                    </div>
                    <div className="flex space-x-8 text-center">
                      <div>
                        <div className={`text-lg font-semibold ${strategy.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {strategy.performance.totalReturn >= 0 ? '+' : ''}{strategy.performance.totalReturn.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Return</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{strategy.performance.winRate.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{strategy.performance.trades}</div>
                        <div className="text-xs text-muted-foreground">Trades</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{strategy.performance.sharpe.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Sharpe</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StrategyManagementDashboard;