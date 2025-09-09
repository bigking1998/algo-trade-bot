import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Progress } from "../ui/progress";
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  DollarSign,
  Target,
  Award,
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  ArrowUpDown,
  Percent,
  Clock,
  Users
} from "lucide-react";

// Types
interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  expectancy: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
}

interface StrategyPerformance {
  name: string;
  type: string;
  period: string;
  metrics: PerformanceMetrics;
  monthlyReturns: { month: string; return: number }[];
}

interface EquityCurvePoint {
  date: Date;
  equity: number;
  drawdown: number;
  benchmark?: number;
}

interface RiskMetrics {
  valueAtRisk95: number;
  conditionalVaR95: number;
  skewness: number;
  kurtosis: number;
  downsideDeviation: number;
  maximumConsecutiveLosses: number;
  largestLoss: number;
  recoveryFactor: number;
}

/**
 * Performance Analytics Dashboard - Task FE-003 (Enhanced)
 * 
 * Comprehensive performance analysis with:
 * - Advanced risk-adjusted metrics
 * - Strategy comparison and attribution
 * - Equity curve visualization
 * - Drawdown analysis
 * - Risk metrics and VaR calculations
 * - Monte Carlo simulation results
 */
const PerformanceAnalyticsDashboard: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [selectedStrategy, setSelectedStrategy] = useState('all');
  const [performanceData, setPerformanceData] = useState<StrategyPerformance[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPerformanceData();
  }, [selectedPeriod, selectedStrategy]);

  const loadPerformanceData = async () => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock performance data
    const mockStrategies: StrategyPerformance[] = [
      {
        name: 'BTC EMA Crossover',
        type: 'Trend Following',
        period: selectedPeriod,
        metrics: {
          totalReturn: 23.45,
          annualizedReturn: 31.2,
          sharpeRatio: 1.42,
          sortinoRatio: 1.85,
          maxDrawdown: 12.3,
          calmarRatio: 2.54,
          winRate: 68.2,
          profitFactor: 1.85,
          averageWin: 3.2,
          averageLoss: -1.8,
          totalTrades: 145,
          winningTrades: 99,
          losingTrades: 46,
          expectancy: 1.65,
          volatility: 18.5,
          beta: 1.15,
          alpha: 5.8,
          informationRatio: 0.85
        },
        monthlyReturns: [
          { month: '2024-01', return: 4.2 },
          { month: '2024-02', return: -2.1 },
          { month: '2024-03', return: 6.8 },
          { month: '2024-04', return: 3.5 },
          { month: '2024-05', return: 2.9 },
          { month: '2024-06', return: 5.1 },
          { month: '2024-07', return: -1.4 },
          { month: '2024-08', return: 4.7 },
          { month: '2024-09', return: 2.3 }
        ]
      },
      {
        name: 'ETH RSI Mean Reversion',
        type: 'Mean Reversion',
        period: selectedPeriod,
        metrics: {
          totalReturn: 18.7,
          annualizedReturn: 24.8,
          sharpeRatio: 1.28,
          sortinoRatio: 1.65,
          maxDrawdown: 8.9,
          calmarRatio: 2.78,
          winRate: 72.4,
          profitFactor: 2.12,
          averageWin: 2.8,
          averageLoss: -1.5,
          totalTrades: 89,
          winningTrades: 64,
          losingTrades: 25,
          expectancy: 2.1,
          volatility: 15.2,
          beta: 0.85,
          alpha: 8.2,
          informationRatio: 1.12
        },
        monthlyReturns: [
          { month: '2024-01', return: 2.8 },
          { month: '2024-02', return: 3.2 },
          { month: '2024-03', return: 1.9 },
          { month: '2024-04', return: 4.1 },
          { month: '2024-05', return: 2.6 },
          { month: '2024-06', return: 1.8 },
          { month: '2024-07', return: 3.5 },
          { month: '2024-08', return: -1.2 },
          { month: '2024-09', return: 2.9 }
        ]
      },
      {
        name: 'Multi-Asset MACD',
        type: 'Momentum',
        period: selectedPeriod,
        metrics: {
          totalReturn: 15.3,
          annualizedReturn: 20.1,
          sharpeRatio: 1.15,
          sortinoRatio: 1.48,
          maxDrawdown: 15.2,
          calmarRatio: 1.32,
          winRate: 64.8,
          profitFactor: 1.65,
          averageWin: 2.1,
          averageLoss: -1.3,
          totalTrades: 203,
          winningTrades: 132,
          losingTrades: 71,
          expectancy: 0.75,
          volatility: 20.8,
          beta: 1.35,
          alpha: 2.1,
          informationRatio: 0.65
        },
        monthlyReturns: [
          { month: '2024-01', return: 1.5 },
          { month: '2024-02', return: 2.8 },
          { month: '2024-03', return: 3.2 },
          { month: '2024-04', return: -2.1 },
          { month: '2024-05', return: 1.9 },
          { month: '2024-06', return: 2.4 },
          { month: '2024-07', return: 3.8 },
          { month: '2024-08', return: 1.2 },
          { month: '2024-09', return: 1.6 }
        ]
      }
    ];

    setPerformanceData(mockStrategies);

    // Generate equity curve
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    const equityCurveData: EquityCurvePoint[] = [];
    let currentEquity = 10000;
    let maxEquity = currentEquity;

    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Simulate daily returns with trend and volatility
      const dailyReturn = (Math.random() - 0.45) * 0.02; // Slight positive bias
      currentEquity *= (1 + dailyReturn);
      maxEquity = Math.max(maxEquity, currentEquity);
      
      const drawdown = (currentEquity - maxEquity) / maxEquity * 100;
      
      equityCurveData.push({
        date,
        equity: currentEquity,
        drawdown,
        benchmark: 10000 * Math.pow(1.08, i / 365) // 8% annual benchmark
      });
    }

    setEquityCurve(equityCurveData);

    // Risk metrics
    setRiskMetrics({
      valueAtRisk95: 3.2,
      conditionalVaR95: 4.8,
      skewness: 0.15,
      kurtosis: 2.8,
      downsideDeviation: 12.5,
      maximumConsecutiveLosses: 4,
      largestLoss: -5.8,
      recoveryFactor: 2.1
    });

    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number, decimals: number = 2) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  };

  const getPerformanceColor = (value: number, threshold: number = 0) => {
    return value >= threshold ? 'text-green-600' : 'text-red-600';
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
    }
  };

  const calculateOverallMetrics = () => {
    if (performanceData.length === 0) return null;
    
    const totalReturn = performanceData.reduce((sum, s) => sum + s.metrics.totalReturn, 0) / performanceData.length;
    const sharpeRatio = performanceData.reduce((sum, s) => sum + s.metrics.sharpeRatio, 0) / performanceData.length;
    const maxDrawdown = Math.max(...performanceData.map(s => s.metrics.maxDrawdown));
    const winRate = performanceData.reduce((sum, s) => sum + s.metrics.winRate, 0) / performanceData.length;
    
    return { totalReturn, sharpeRatio, maxDrawdown, winRate };
  };

  const overallMetrics = calculateOverallMetrics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Analytics</h2>
          <p className="text-muted-foreground">Comprehensive performance analysis and risk metrics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1M">1M</SelectItem>
              <SelectItem value="3M">3M</SelectItem>
              <SelectItem value="6M">6M</SelectItem>
              <SelectItem value="1Y">1Y</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Performance KPIs */}
      {overallMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Avg Total Return</p>
                  <p className={`text-2xl font-bold ${getPerformanceColor(overallMetrics.totalReturn)}`}>
                    {formatPercent(overallMetrics.totalReturn)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Avg Sharpe Ratio</p>
                  <p className="text-2xl font-bold">{overallMetrics.sharpeRatio.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{overallMetrics.maxDrawdown.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Award className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Avg Win Rate</p>
                  <p className="text-2xl font-bold">{overallMetrics.winRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="equity">Equity Curve</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Key performance metrics across all strategies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.map((strategy, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{strategy.name}</h4>
                        <p className="text-sm text-muted-foreground">{strategy.type}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${getPerformanceColor(strategy.metrics.totalReturn)}`}>
                          {formatPercent(strategy.metrics.totalReturn)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sharpe: {strategy.metrics.sharpeRatio.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk-Adjusted Returns</CardTitle>
                <CardDescription>Risk metrics and efficiency ratios</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.map((strategy, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{strategy.name}</span>
                        <span className="text-sm">Calmar: {strategy.metrics.calmarRatio.toFixed(2)}</span>
                      </div>
                      <div className="flex space-x-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">Return</div>
                          <Progress value={Math.min(strategy.metrics.totalReturn * 2, 100)} className="h-2" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">Risk</div>
                          <Progress value={strategy.metrics.volatility * 3} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Performance Comparison</CardTitle>
              <CardDescription>Detailed metrics for all trading strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Annualized</TableHead>
                    <TableHead>Sharpe</TableHead>
                    <TableHead>Sortino</TableHead>
                    <TableHead>Max DD</TableHead>
                    <TableHead>Win Rate</TableHead>
                    <TableHead>Profit Factor</TableHead>
                    <TableHead>Trades</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.map((strategy, index) => {
                    const riskLevel = strategy.metrics.maxDrawdown > 15 ? 'high' : 
                                    strategy.metrics.maxDrawdown > 10 ? 'medium' : 'low';
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{strategy.name}</div>
                            <div className="text-xs text-muted-foreground">{strategy.type}</div>
                          </div>
                        </TableCell>
                        <TableCell className={getPerformanceColor(strategy.metrics.totalReturn)}>
                          {formatPercent(strategy.metrics.totalReturn)}
                        </TableCell>
                        <TableCell className={getPerformanceColor(strategy.metrics.annualizedReturn)}>
                          {formatPercent(strategy.metrics.annualizedReturn)}
                        </TableCell>
                        <TableCell>{strategy.metrics.sharpeRatio.toFixed(2)}</TableCell>
                        <TableCell>{strategy.metrics.sortinoRatio.toFixed(2)}</TableCell>
                        <TableCell className="text-red-600">
                          -{strategy.metrics.maxDrawdown.toFixed(1)}%
                        </TableCell>
                        <TableCell>{strategy.metrics.winRate.toFixed(1)}%</TableCell>
                        <TableCell>{strategy.metrics.profitFactor.toFixed(2)}</TableCell>
                        <TableCell>{strategy.metrics.totalTrades}</TableCell>
                        <TableCell>
                          <Badge className={getRiskColor(riskLevel)}>
                            {riskLevel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equity Curve Tab */}
        <TabsContent value="equity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equity Curve Analysis</CardTitle>
              <CardDescription>Portfolio value over time vs benchmark</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border rounded-lg">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                  <p>Equity Curve Chart</p>
                  <p className="text-sm">Chart integration with Chart.js or Lightweight Charts</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(equityCurve[equityCurve.length - 1]?.equity || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Value</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(equityCurve[equityCurve.length - 1]?.benchmark || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Benchmark Value</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatPercent(((equityCurve[equityCurve.length - 1]?.equity || 10000) / 10000 - 1) * 100)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Return</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Analysis Tab */}
        <TabsContent value="risk" className="space-y-4">
          {riskMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Value at Risk Analysis</CardTitle>
                  <CardDescription>Downside risk measurements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Value at Risk (95%)</span>
                      <span className="text-red-600">{riskMetrics.valueAtRisk95.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Conditional VaR (95%)</span>
                      <span className="text-red-600">{riskMetrics.conditionalVaR95.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Downside Deviation</span>
                      <span className="text-red-600">{riskMetrics.downsideDeviation.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Largest Loss</span>
                      <span className="text-red-600">{formatPercent(riskMetrics.largestLoss)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribution Analysis</CardTitle>
                  <CardDescription>Return distribution characteristics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Skewness</span>
                      <span className={riskMetrics.skewness >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {riskMetrics.skewness.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Kurtosis</span>
                      <span>{riskMetrics.kurtosis.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Max Consecutive Losses</span>
                      <span className="text-red-600">{riskMetrics.maximumConsecutiveLosses}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Recovery Factor</span>
                      <span className="text-green-600">{riskMetrics.recoveryFactor.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Attribution Tab */}
        <TabsContent value="attribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Attribution</CardTitle>
              <CardDescription>Contribution breakdown by strategy and asset</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {performanceData.map((strategy, index) => (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{strategy.name}</h4>
                      <span className={`font-semibold ${getPerformanceColor(strategy.metrics.totalReturn)}`}>
                        {formatPercent(strategy.metrics.totalReturn)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Trades</div>
                        <div className="font-medium">{strategy.metrics.totalTrades}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Win Rate</div>
                        <div className="font-medium">{strategy.metrics.winRate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Win</div>
                        <div className="font-medium text-green-600">
                          {formatPercent(strategy.metrics.averageWin)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Loss</div>
                        <div className="font-medium text-red-600">
                          {formatPercent(strategy.metrics.averageLoss)}
                        </div>
                      </div>
                    </div>
                    <Progress value={strategy.metrics.totalReturn * 3} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drawdown Tab */}
        <TabsContent value="drawdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Drawdown Analysis</CardTitle>
              <CardDescription>Historical drawdown periods and recovery times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border rounded-lg mb-6">
                <div className="text-center text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-2" />
                  <p>Drawdown Chart</p>
                  <p className="text-sm">Underwater curve showing drawdown periods</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        -{Math.max(...performanceData.map(s => s.metrics.maxDrawdown)).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Maximum Drawdown</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">45</div>
                      <div className="text-sm text-muted-foreground">Recovery Days</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">3</div>
                      <div className="text-sm text-muted-foreground">Drawdown Periods</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceAnalyticsDashboard;