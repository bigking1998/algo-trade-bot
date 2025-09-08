import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  TestTube,
  Play,
  Square,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  Activity,
  Download,
} from "lucide-react";

import { VisualStrategyDefinition, BacktestConfig, BacktestResults } from "../../types/strategy";
import { Timeframe } from "../../../shared/types/trading";

interface StrategyBacktesterProps {
  strategy?: VisualStrategyDefinition;
  onBacktestComplete: (results: BacktestResults) => void;
}

const StrategyBacktester: React.FC<StrategyBacktesterProps> = ({
  strategy,
  onBacktestComplete,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentResults, setCurrentResults] = useState<BacktestResults | null>(null);
  
  // Backtest Configuration
  const [config, setConfig] = useState<Partial<BacktestConfig>>({
    symbol: 'BTC-USD',
    timeframe: '1h',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-01-01'),
    initialCapital: 10000,
    commission: 0.001,
    slippage: 0.001,
  });

  const handleRunBacktest = useCallback(async () => {
    if (!strategy) return;
    
    setIsRunning(true);
    setProgress(0);
    
    try {
      // Simulate backtest progress
      const totalSteps = 100;
      const stepDelay = 50; // ms per step
      
      for (let step = 0; step <= totalSteps; step++) {
        setProgress((step / totalSteps) * 100);
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }
      
      // Mock backtest results
      const mockResults: BacktestResults = {
        id: `bt-${Date.now()}`,
        strategyId: strategy.id,
        config: config as BacktestConfig,
        performance: {
          totalReturn: 2345.67,
          totalReturnPercent: 23.46,
          annualizedReturn: 23.46,
          sharpeRatio: 1.23,
          sortinoRatio: 1.45,
          maxDrawdown: -876.54,
          maxDrawdownPercent: -12.3,
          calmarRatio: 1.9,
          volatility: 18.5,
          skewness: 0.23,
          kurtosis: 2.1,
        },
        trades: {
          total: 142,
          winning: 89,
          losing: 53,
          winRate: 62.7,
          profitFactor: 1.85,
          avgWin: 45.2,
          avgLoss: -28.3,
          avgTradeDuration: 18.5,
          largestWin: 234.5,
          largestLoss: -123.4,
        },
        periods: {
          totalDays: 365,
          tradingDays: 260,
          bestMonth: 15.6,
          worstMonth: -8.9,
          winningMonths: 8,
          losingMonths: 4,
        },
        equity: Array.from({ length: 365 }, (_, i) => ({
          date: new Date(2023, 0, i + 1),
          value: 10000 + (Math.random() * 5000 - 2500) + (i * 6.4), // trending upward with noise
          drawdown: Math.random() * -15,
        })),
        trades_detail: [],
        runTime: 5000,
        completedAt: new Date(),
      };
      
      setCurrentResults(mockResults);
      onBacktestComplete(mockResults);
      
    } catch (error) {
      console.error('Backtest failed:', error);
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  }, [strategy, config, onBacktestComplete]);

  const handleStopBacktest = useCallback(() => {
    setIsRunning(false);
    setProgress(0);
  }, []);

  const getPerformanceColor = (value: number, isPositive: boolean = true) => {
    if (isPositive) {
      return value > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return value < 0 ? 'text-red-600' : 'text-green-600';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Strategy Backtesting
              </CardTitle>
              <CardDescription>
                {strategy ? `Testing: ${strategy.name}` : 'Select a strategy to run backtests'}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {currentResults && (
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  Export Results
                </Button>
              )}
              
              {!isRunning ? (
                <Button
                  onClick={handleRunBacktest}
                  disabled={!strategy}
                  className="gap-1"
                >
                  <Play className="h-4 w-4" />
                  Run Backtest
                </Button>
              ) : (
                <Button
                  onClick={handleStopBacktest}
                  variant="destructive"
                  className="gap-1"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="symbol" className="text-sm">Symbol</Label>
              <Select
                value={config.symbol}
                onValueChange={(value) => setConfig(prev => ({ ...prev, symbol: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                  <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                  <SelectItem value="ADA-USD">ADA-USD</SelectItem>
                  <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="timeframe" className="text-sm">Timeframe</Label>
              <Select
                value={config.timeframe}
                onValueChange={(value) => setConfig(prev => ({ ...prev, timeframe: value as Timeframe }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 Minute</SelectItem>
                  <SelectItem value="5m">5 Minutes</SelectItem>
                  <SelectItem value="15m">15 Minutes</SelectItem>
                  <SelectItem value="30m">30 Minutes</SelectItem>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="4h">4 Hours</SelectItem>
                  <SelectItem value="1d">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date" className="text-sm">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={config.startDate?.toISOString().split('T')[0]}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  startDate: new Date(e.target.value) 
                }))}
              />
            </div>

            <div>
              <Label htmlFor="end-date" className="text-sm">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={config.endDate?.toISOString().split('T')[0]}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  endDate: new Date(e.target.value) 
                }))}
              />
            </div>

            <div>
              <Label htmlFor="capital" className="text-sm">Initial Capital</Label>
              <Input
                id="capital"
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  initialCapital: parseFloat(e.target.value) 
                }))}
              />
            </div>

            <div>
              <Label htmlFor="commission" className="text-sm">Commission (%)</Label>
              <Input
                id="commission"
                type="number"
                step="0.001"
                value={(config.commission || 0) * 100}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  commission: parseFloat(e.target.value) / 100
                }))}
              />
            </div>

            <div>
              <Label htmlFor="slippage" className="text-sm">Slippage (%)</Label>
              <Input
                id="slippage"
                type="number"
                step="0.001"
                value={(config.slippage || 0) * 100}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  slippage: parseFloat(e.target.value) / 100
                }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="lg:col-span-3 space-y-4">
          {isRunning && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Running backtest...</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} />
                  <div className="text-xs text-muted-foreground">
                    Processing historical data and executing strategy signals
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentResults ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="trades">Trades</TabsTrigger>
                <TabsTrigger value="chart">Equity Chart</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getPerformanceColor(currentResults.performance.totalReturnPercent)}`}>
                          {formatPercent(currentResults.performance.totalReturnPercent)}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Return</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {currentResults.trades.winRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Win Rate</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {currentResults.performance.sharpeRatio.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getPerformanceColor(currentResults.performance.maxDrawdownPercent, false)}`}>
                          {formatPercent(currentResults.performance.maxDrawdownPercent)}
                        </div>
                        <div className="text-sm text-muted-foreground">Max Drawdown</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Performance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Returns</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Total Return:</span>
                            <span className={getPerformanceColor(currentResults.performance.totalReturn)}>
                              {formatCurrency(currentResults.performance.totalReturn)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Annualized Return:</span>
                            <span>{formatPercent(currentResults.performance.annualizedReturn)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Volatility:</span>
                            <span>{formatPercent(currentResults.performance.volatility)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Risk Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Sharpe Ratio:</span>
                            <span>{currentResults.performance.sharpeRatio.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sortino Ratio:</span>
                            <span>{currentResults.performance.sortinoRatio.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Calmar Ratio:</span>
                            <span>{currentResults.performance.calmarRatio.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Trade Statistics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Total Trades:</span>
                            <span>{currentResults.trades.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Profit Factor:</span>
                            <span>{currentResults.trades.profitFactor.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Trade Duration:</span>
                            <span>{currentResults.trades.avgTradeDuration.toFixed(1)}h</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium">Risk-Adjusted Returns</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Sharpe Ratio:</span>
                            <Badge variant={currentResults.performance.sharpeRatio > 1 ? "default" : "secondary"}>
                              {currentResults.performance.sharpeRatio.toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Sortino Ratio:</span>
                            <Badge variant={currentResults.performance.sortinoRatio > 1 ? "default" : "secondary"}>
                              {currentResults.performance.sortinoRatio.toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Calmar Ratio:</span>
                            <Badge variant={currentResults.performance.calmarRatio > 1 ? "default" : "secondary"}>
                              {currentResults.performance.calmarRatio.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium">Distribution Metrics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Skewness:</span>
                            <span>{currentResults.performance.skewness.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Kurtosis:</span>
                            <span>{currentResults.performance.kurtosis.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Volatility:</span>
                            <span>{formatPercent(currentResults.performance.volatility)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trades">
                <Card>
                  <CardHeader>
                    <CardTitle>Trade Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 border rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {currentResults.trades.winning}
                        </div>
                        <div className="text-sm text-muted-foreground">Winning Trades</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {currentResults.trades.losing}
                        </div>
                        <div className="text-sm text-muted-foreground">Losing Trades</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded">
                        <div className="text-2xl font-bold">
                          {formatCurrency(currentResults.trades.avgWin)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Win</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded">
                        <div className="text-2xl font-bold">
                          {formatCurrency(currentResults.trades.avgLoss)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Loss</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(currentResults.trades.largestWin)}
                        </div>
                        <div className="text-sm text-muted-foreground">Best Trade</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(currentResults.trades.largestLoss)}
                        </div>
                        <div className="text-sm text-muted-foreground">Worst Trade</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chart">
                <Card>
                  <CardHeader>
                    <CardTitle>Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                      <p>Equity curve chart will be displayed here</p>
                      <p className="text-sm">Integration with charting library required</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : !isRunning ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <TestTube className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to Backtest</h3>
                  <p className="mb-4">
                    Configure your backtest settings and click "Run Backtest" to evaluate your strategy
                  </p>
                  {!strategy && (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      No strategy selected
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StrategyBacktester;