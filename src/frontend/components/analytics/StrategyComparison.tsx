/**
 * Strategy Comparison Component
 * 
 * Advanced multi-strategy performance analysis with detailed comparisons,
 * rankings, correlations, and statistical metrics. Provides comprehensive
 * insights into strategy performance across different time periods and markets.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity, 
  BarChart3,
  Eye,
  EyeOff,
  ArrowUpDown,
  Filter,
  Settings,
  Zap,
  Shield,
  Clock,
  Percent,
  DollarSign
} from 'lucide-react';
import { usePerformanceData, StrategyPerformance } from '../../hooks/usePerformanceData';

interface StrategyComparisonProps {
  className?: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  selectedStrategies?: string[];
  onStrategySelectionChange?: (strategies: string[]) => void;
}

// Sorting options for strategy comparison
type SortOption = 'totalReturn' | 'sharpeRatio' | 'maxDrawdown' | 'winRate' | 'volatility' | 'profitFactor';

// Chart colors for different strategies
const STRATEGY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

// Format utility functions
const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const formatPercentage = (value: number, decimals = 2): string => `${value.toFixed(decimals)}%`;

// Strategy ranking badge component
const RankingBadge: React.FC<{ rank: number; total: number }> = ({ rank, total }) => {
  const getVariant = () => {
    if (rank === 1) return 'default';
    if (rank <= Math.ceil(total * 0.3)) return 'secondary';
    if (rank <= Math.ceil(total * 0.7)) return 'outline';
    return 'destructive';
  };

  const getIcon = () => {
    if (rank === 1) return <Trophy className="h-3 w-3" />;
    if (rank <= 3) return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  return (
    <Badge variant={getVariant()} className="flex items-center space-x-1">
      {getIcon()}
      <span>#{rank}</span>
    </Badge>
  );
};

// Performance indicator cell component
const PerformanceCell: React.FC<{
  value: number;
  format: 'currency' | 'percentage' | 'ratio' | 'number';
  benchmark?: number;
  invert?: boolean;
}> = ({ value, format, benchmark, invert = false }) => {
  const formatValue = () => {
    switch (format) {
      case 'currency': return formatCurrency(value);
      case 'percentage': return formatPercentage(value);
      case 'ratio': return value.toFixed(2);
      case 'number': return value.toLocaleString();
      default: return value.toString();
    }
  };

  const getColor = () => {
    if (benchmark === undefined) return '';
    
    const isGood = invert ? value < benchmark : value > benchmark;
    return isGood ? 'text-green-600' : 'text-red-600';
  };

  return (
    <span className={`font-mono ${getColor()}`}>
      {formatValue()}
    </span>
  );
};

export const StrategyComparison: React.FC<StrategyComparisonProps> = ({
  className,
  timeframe = '1M',
  selectedStrategies = [],
  onStrategySelectionChange
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('totalReturn');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibleStrategies, setVisibleStrategies] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  const {
    strategyPerformance,
    isLoading: strategiesLoading,
    hasError: strategiesError
  } = usePerformanceData({
    timeframe,
    strategyIds: selectedStrategies,
    includeInactive: showInactive,
    enableRealTime: true
  });

  // Sort strategies based on selected criteria
  const sortedStrategies = useMemo(() => {
    if (!strategyPerformance?.length) return [];
    
    const sorted = [...strategyPerformance].sort((a, b) => {
      let valueA: number, valueB: number;
      
      switch (sortBy) {
        case 'totalReturn': valueA = a.totalReturn; valueB = b.totalReturn; break;
        case 'sharpeRatio': valueA = a.sharpeRatio; valueB = b.sharpeRatio; break;
        case 'maxDrawdown': valueA = Math.abs(a.maxDrawdown); valueB = Math.abs(b.maxDrawdown); break;
        case 'winRate': valueA = a.winRate; valueB = b.winRate; break;
        case 'volatility': valueA = a.volatility; valueB = b.volatility; break;
        case 'profitFactor': valueA = a.profitFactor; valueB = b.profitFactor; break;
        default: valueA = a.totalReturn; valueB = b.totalReturn;
      }
      
      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });
    
    return sorted;
  }, [strategyPerformance, sortBy, sortOrder]);

  // Initialize visible strategies
  React.useEffect(() => {
    if (sortedStrategies.length && visibleStrategies.length === 0) {
      setVisibleStrategies(sortedStrategies.slice(0, 5).map(s => s.strategyId));
    }
  }, [sortedStrategies, visibleStrategies.length]);

  // Filter strategies for visualization
  const visibleStrategyData = useMemo(() => {
    return sortedStrategies.filter(s => visibleStrategies.includes(s.strategyId));
  }, [sortedStrategies, visibleStrategies]);

  // Prepare equity curve data for comparison chart
  const equityCurveData = useMemo(() => {
    if (!visibleStrategyData.length) return [];
    
    // Get all unique timestamps
    const allTimestamps = new Set<string>();
    visibleStrategyData.forEach(strategy => {
      strategy.equityCurve.forEach(point => {
        allTimestamps.add(point.timestamp.toISOString());
      });
    });
    
    const timestamps = Array.from(allTimestamps).sort();
    
    return timestamps.map(timestamp => {
      const dataPoint: any = { timestamp: new Date(timestamp).toLocaleDateString() };
      
      visibleStrategyData.forEach((strategy, index) => {
        const point = strategy.equityCurve.find(p => p.timestamp.toISOString() === timestamp);
        dataPoint[`strategy_${index}`] = point?.value || null;
        dataPoint[`strategy_${index}_name`] = strategy.strategyName;
      });
      
      return dataPoint;
    });
  }, [visibleStrategyData]);

  // Prepare radar chart data for multi-dimensional comparison
  const radarData = useMemo(() => {
    const metrics = [
      'Total Return',
      'Sharpe Ratio',
      'Win Rate',
      'Profit Factor',
      'Low Drawdown',
      'Low Volatility'
    ];
    
    return metrics.map(metric => {
      const dataPoint: any = { metric };
      
      visibleStrategyData.forEach((strategy, index) => {
        let value: number;
        switch (metric) {
          case 'Total Return': 
            value = Math.max(0, Math.min(100, (strategy.totalReturn + 50))); // Normalize to 0-100
            break;
          case 'Sharpe Ratio': 
            value = Math.max(0, Math.min(100, strategy.sharpeRatio * 25)); // Scale to 0-100
            break;
          case 'Win Rate': 
            value = strategy.winRate;
            break;
          case 'Profit Factor': 
            value = Math.max(0, Math.min(100, strategy.profitFactor * 20)); // Scale to 0-100
            break;
          case 'Low Drawdown': 
            value = Math.max(0, 100 - Math.abs(strategy.maxDrawdown) * 5); // Invert and scale
            break;
          case 'Low Volatility': 
            value = Math.max(0, 100 - strategy.volatility * 2); // Invert and scale
            break;
          default: 
            value = 50;
        }
        dataPoint[`strategy_${index}`] = value;
      });
      
      return dataPoint;
    });
  }, [visibleStrategyData]);

  // Risk-return scatter plot data
  const scatterData = useMemo(() => {
    return sortedStrategies.map((strategy, index) => ({
      x: strategy.volatility,
      y: strategy.totalReturn,
      name: strategy.strategyName,
      color: STRATEGY_COLORS[index % STRATEGY_COLORS.length],
      sharpe: strategy.sharpeRatio
    }));
  }, [sortedStrategies]);

  // Toggle strategy visibility
  const toggleStrategyVisibility = (strategyId: string) => {
    setVisibleStrategies(prev => 
      prev.includes(strategyId) 
        ? prev.filter(id => id !== strategyId)
        : [...prev, strategyId]
    );
  };

  // Handle sorting
  const handleSort = (column: SortOption) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (strategiesLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (strategiesError || !strategyPerformance?.length) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <Activity className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="text-lg font-semibold">No Strategy Data Available</h3>
            <p className="text-sm text-muted-foreground">
              No strategies found for the selected timeframe.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with controls */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Strategy Comparison</h2>
          <p className="text-muted-foreground">
            Compare and analyze multiple trading strategies across key performance metrics
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="totalReturn">Total Return</SelectItem>
              <SelectItem value="sharpeRatio">Sharpe Ratio</SelectItem>
              <SelectItem value="maxDrawdown">Max Drawdown</SelectItem>
              <SelectItem value="winRate">Win Rate</SelectItem>
              <SelectItem value="volatility">Volatility</SelectItem>
              <SelectItem value="profitFactor">Profit Factor</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          
          <Button
            variant={showInactive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showInactive ? 'All' : 'Active'}
          </Button>
        </div>
      </div>

      {/* Strategy Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Strategy Rankings
          </CardTitle>
          <CardDescription>
            Performance metrics and rankings for all strategies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('totalReturn')}>
                    Total Return {sortBy === 'totalReturn' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('sharpeRatio')}>
                    Sharpe {sortBy === 'sharpeRatio' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('maxDrawdown')}>
                    Max DD {sortBy === 'maxDrawdown' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('winRate')}>
                    Win Rate {sortBy === 'winRate' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('profitFactor')}>
                    Profit Factor {sortBy === 'profitFactor' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="w-[80px]">Visible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStrategies.map((strategy, index) => (
                  <TableRow 
                    key={strategy.strategyId}
                    className={!strategy.isActive ? 'opacity-60' : ''}
                  >
                    <TableCell>
                      <RankingBadge rank={index + 1} total={sortedStrategies.length} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: STRATEGY_COLORS[index % STRATEGY_COLORS.length] }}
                          />
                          <div>
                            <div className="font-medium">{strategy.strategyName}</div>
                            <div className="text-xs text-muted-foreground">
                              {strategy.isActive ? 'Active' : 'Inactive'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <PerformanceCell 
                        value={strategy.totalReturn} 
                        format="percentage"
                        benchmark={0}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <PerformanceCell 
                        value={strategy.sharpeRatio} 
                        format="ratio"
                        benchmark={1}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <PerformanceCell 
                        value={Math.abs(strategy.maxDrawdown)} 
                        format="percentage"
                        benchmark={10}
                        invert={true}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <PerformanceCell 
                        value={strategy.winRate} 
                        format="percentage"
                        benchmark={50}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <PerformanceCell 
                        value={strategy.profitFactor} 
                        format="ratio"
                        benchmark={1}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {strategy.totalTrades.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStrategyVisibility(strategy.strategyId)}
                      >
                        {visibleStrategies.includes(strategy.strategyId) ? 
                          <Eye className="h-4 w-4" /> : 
                          <EyeOff className="h-4 w-4" />
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Visual Comparisons */}
      <Tabs defaultValue="equity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="equity">Equity Curves</TabsTrigger>
          <TabsTrigger value="radar">Multi-Metric</TabsTrigger>
          <TabsTrigger value="scatter">Risk-Return</TabsTrigger>
          <TabsTrigger value="correlation">Correlation</TabsTrigger>
        </TabsList>

        <TabsContent value="equity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Equity Curve Comparison
              </CardTitle>
              <CardDescription>
                Compare strategy performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={equityCurveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatCurrency(value), 
                      name.replace(/strategy_\d+_name/, '')
                    ]}
                  />
                  <Legend />
                  {visibleStrategyData.map((strategy, index) => (
                    <Line
                      key={strategy.strategyId}
                      type="monotone"
                      dataKey={`strategy_${index}`}
                      stroke={STRATEGY_COLORS[index]}
                      strokeWidth={2}
                      name={strategy.strategyName}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="radar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Multi-Dimensional Analysis
              </CardTitle>
              <CardDescription>
                Compare strategies across multiple performance dimensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  {visibleStrategyData.map((strategy, index) => (
                    <Radar
                      key={strategy.strategyId}
                      name={strategy.strategyName}
                      dataKey={`strategy_${index}`}
                      stroke={STRATEGY_COLORS[index]}
                      fill={STRATEGY_COLORS[index]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scatter">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Risk-Return Scatter
              </CardTitle>
              <CardDescription>
                Visualize the risk-return profile of each strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Volatility"
                    unit="%"
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Return"
                    unit="%"
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value: number, name: string, props: any) => [
                      name === 'Return' ? `${value.toFixed(2)}%` : `${value.toFixed(2)}%`,
                      name === 'Return' ? 'Total Return' : 'Volatility'
                    ]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload.name || ''}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded shadow">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm">Return: {data.y.toFixed(2)}%</p>
                            <p className="text-sm">Volatility: {data.x.toFixed(2)}%</p>
                            <p className="text-sm">Sharpe: {data.sharpe.toFixed(2)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    name="Strategies" 
                    data={scatterData}
                    fill="#3B82F6"
                  >
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Strategy Correlation Analysis
              </CardTitle>
              <CardDescription>
                Understanding diversification benefits between strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Correlation Matrix</h3>
                <p className="text-sm text-muted-foreground">
                  Advanced correlation analysis would be implemented here with actual strategy return data.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              Best Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedStrategies.slice(0, 3).map((strategy, index) => (
              <div key={strategy.strategyId} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RankingBadge rank={index + 1} total={3} />
                  <span className="text-sm font-medium">{strategy.strategyName}</span>
                </div>
                <span className="text-sm font-mono">
                  {formatPercentage(strategy.totalReturn)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Risk Leaders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...sortedStrategies]
              .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
              .slice(0, 3)
              .map((strategy, index) => (
                <div key={strategy.strategyId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    <span className="text-sm font-medium">{strategy.strategyName}</span>
                  </div>
                  <span className="text-sm font-mono">
                    {strategy.sharpeRatio.toFixed(2)}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Percent className="h-5 w-5 mr-2" />
              Consistency Champions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...sortedStrategies]
              .sort((a, b) => b.winRate - a.winRate)
              .slice(0, 3)
              .map((strategy, index) => (
                <div key={strategy.strategyId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="text-sm font-medium">{strategy.strategyName}</span>
                  </div>
                  <span className="text-sm font-mono">
                    {formatPercentage(strategy.winRate)}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StrategyComparison;