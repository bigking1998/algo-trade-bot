/**
 * Performance Overview Component
 * 
 * Comprehensive performance dashboard displaying key performance indicators,
 * portfolio metrics, and real-time performance monitoring with advanced
 * analytics and interactive visualizations.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity, 
  DollarSign, 
  BarChart3, 
  AlertTriangle,
  Info,
  Download,
  RefreshCw,
  Clock,
  Shield
} from 'lucide-react';
import { usePerformanceData } from '../../hooks/usePerformanceData';

interface PerformanceOverviewProps {
  className?: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  onTimeframeChange?: (timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL') => void;
}

// Color palette for charts
const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  neutral: '#6B7280',
  gradient: ['#3B82F6', '#1E40AF']
};

// Format currency values
const formatCurrency = (value: number, compact = true): string => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
};

// Format percentage values
const formatPercentage = (value: number, decimals = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

// Performance indicator component
const PerformanceIndicator: React.FC<{
  title: string;
  value: string | number;
  change?: number;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ title, value, change, prefix = '', suffix = '', trend = 'neutral', description, size = 'md' }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {getTrendIcon()}
      </CardHeader>
      <CardContent>
        <div className={`font-bold ${sizeClasses[size]}`}>
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </div>
        {change !== undefined && (
          <p className={`text-xs ${getTrendColor()}`}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}% from last period
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({
  className,
  timeframe: initialTimeframe = '1M',
  onTimeframeChange
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>(initialTimeframe);
  const [activeTab, setActiveTab] = useState('overview');

  const {
    performanceOverview,
    strategyPerformance,
    drawdownMetrics,
    computedMetrics,
    isLoading,
    hasError,
    refreshAllData,
    exportPerformanceData
  } = usePerformanceData({
    timeframe: selectedTimeframe,
    enableRealTime: true
  });

  // Handle timeframe changes
  const handleTimeframeChange = (newTimeframe: string) => {
    const tf = newTimeframe as '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
    setSelectedTimeframe(tf);
    onTimeframeChange?.(tf);
  };

  // Export functionality
  const handleExport = async (format: 'PDF' | 'CSV' | 'JSON') => {
    try {
      await exportPerformanceData(format, 'overview');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Generate sample equity curve data for demonstration
  const equityCurveData = useMemo(() => {
    if (!performanceOverview) return [];
    
    const data = [];
    const startValue = 100000;
    let currentValue = startValue;
    
    for (let i = 0; i < 30; i++) {
      const change = (Math.random() - 0.48) * 1000; // Slight upward bias
      currentValue += change;
      data.push({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        value: currentValue,
        change: (currentValue - startValue) / startValue * 100
      });
    }
    
    return data;
  }, [performanceOverview]);

  // Risk metrics data for pie chart
  const riskMetricsData = useMemo(() => {
    if (!performanceOverview) return [];
    
    return [
      { name: 'Sharpe Ratio', value: Math.max(0, performanceOverview.sharpeRatio * 20) },
      { name: 'Sortino Ratio', value: Math.max(0, performanceOverview.sortinoRatio * 20) },
      { name: 'Max Drawdown', value: Math.abs(performanceOverview.maxDrawdown) },
      { name: 'Volatility', value: performanceOverview.volatility }
    ];
  }, [performanceOverview]);

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading performance data...</span>
        </div>
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (hasError || !performanceOverview) {
    return (
      <Card className={`${className}`}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h3 className="text-lg font-semibold">Unable to Load Performance Data</h3>
            <p className="text-sm text-muted-foreground">
              Please check your connection and try again.
            </p>
            <Button onClick={refreshAllData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
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
          <h2 className="text-3xl font-bold tracking-tight">Performance Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive portfolio and strategy performance overview
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={selectedTimeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1D">1D</SelectItem>
              <SelectItem value="1W">1W</SelectItem>
              <SelectItem value="1M">1M</SelectItem>
              <SelectItem value="3M">3M</SelectItem>
              <SelectItem value="1Y">1Y</SelectItem>
              <SelectItem value="ALL">ALL</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={refreshAllData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button onClick={() => handleExport('PDF')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerformanceIndicator
          title="Total P&L"
          value={formatCurrency(performanceOverview.totalPnL)}
          change={performanceOverview.dailyPnL / Math.abs(performanceOverview.totalPnL) * 100}
          trend={performanceOverview.totalPnL >= 0 ? 'up' : 'down'}
          description="Total profit/loss"
        />
        
        <PerformanceIndicator
          title="Daily P&L"
          value={formatCurrency(performanceOverview.dailyPnL)}
          change={performanceOverview.performanceToday}
          trend={performanceOverview.dailyPnL >= 0 ? 'up' : 'down'}
          description="Today's performance"
        />
        
        <PerformanceIndicator
          title="Sharpe Ratio"
          value={performanceOverview.sharpeRatio.toFixed(2)}
          change={0} // Would come from historical comparison
          trend={performanceOverview.sharpeRatio >= 1.5 ? 'up' : performanceOverview.sharpeRatio >= 1 ? 'neutral' : 'down'}
          description="Risk-adjusted returns"
        />
        
        <PerformanceIndicator
          title="Win Rate"
          value={formatPercentage(performanceOverview.winRate)}
          change={0} // Would come from historical comparison
          trend={performanceOverview.winRate >= 60 ? 'up' : performanceOverview.winRate >= 50 ? 'neutral' : 'down'}
          description="Winning trades percentage"
        />
        
        <PerformanceIndicator
          title="Max Drawdown"
          value={formatPercentage(Math.abs(performanceOverview.maxDrawdown))}
          change={0}
          trend={Math.abs(performanceOverview.maxDrawdown) <= 5 ? 'up' : Math.abs(performanceOverview.maxDrawdown) <= 10 ? 'neutral' : 'down'}
          description="Maximum portfolio decline"
        />
        
        <PerformanceIndicator
          title="Total Trades"
          value={performanceOverview.totalTrades.toLocaleString()}
          change={0}
          description="Total executed trades"
        />
        
        <PerformanceIndicator
          title="Profit Factor"
          value={performanceOverview.profitFactor.toFixed(2)}
          change={0}
          trend={performanceOverview.profitFactor >= 1.5 ? 'up' : performanceOverview.profitFactor >= 1 ? 'neutral' : 'down'}
          description="Gross profit / Gross loss"
        />
        
        <PerformanceIndicator
          title="Sortino Ratio"
          value={performanceOverview.sortinoRatio.toFixed(2)}
          change={0}
          trend={performanceOverview.sortinoRatio >= 1.5 ? 'up' : performanceOverview.sortinoRatio >= 1 ? 'neutral' : 'down'}
          description="Downside risk adjusted"
        />
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="equity">Equity Curve</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Portfolio Performance
                </CardTitle>
                <CardDescription>Performance across different time periods</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { period: 'Today', value: performanceOverview.performanceToday },
                    { period: 'Week', value: performanceOverview.performanceWeek },
                    { period: 'Month', value: performanceOverview.performanceMonth },
                    { period: 'Quarter', value: performanceOverview.performanceQuarter || 0 },
                    { period: 'Year', value: performanceOverview.performanceYear || 0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Performance']} />
                    <Bar dataKey="value" fill={CHART_COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Current Status
                </CardTitle>
                <CardDescription>Real-time portfolio status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Portfolio Value</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(performanceOverview.totalValue)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Unrealized P&L</span>
                  <span className={`text-lg font-bold ${performanceOverview.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(performanceOverview.unrealizedPnL)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Current Drawdown</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-red-600">
                      {formatPercentage(Math.abs(performanceOverview.currentDrawdown))}
                    </span>
                    <Progress 
                      value={Math.abs(performanceOverview.currentDrawdown)} 
                      max={Math.abs(performanceOverview.maxDrawdown)}
                      className="w-24 h-2 mt-1"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Execution Success</span>
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      {formatPercentage(performanceOverview.executionSuccessRate)}
                    </span>
                    <Progress 
                      value={performanceOverview.executionSuccessRate} 
                      className="w-24 h-2 mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Equity Curve
              </CardTitle>
              <CardDescription>Portfolio value over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={equityCurveData}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'value' ? formatCurrency(value) : `${value.toFixed(2)}%`,
                      name === 'value' ? 'Portfolio Value' : 'Return %'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS.primary}
                    fillOpacity={1}
                    fill="url(#equityGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Risk Metrics
                </CardTitle>
                <CardDescription>Portfolio risk analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskMetricsData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill={CHART_COLORS.primary}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}`}
                    >
                      {riskMetricsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Risk-Adjusted Performance</CardTitle>
                <CardDescription>Key risk metrics and ratios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Volatility</span>
                    <span className="font-mono">{formatPercentage(performanceOverview.volatility)}</span>
                  </div>
                  <Progress value={performanceOverview.volatility} max={30} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Sharpe Ratio</span>
                    <Badge variant={performanceOverview.sharpeRatio >= 1.5 ? 'default' : performanceOverview.sharpeRatio >= 1 ? 'secondary' : 'destructive'}>
                      {performanceOverview.sharpeRatio.toFixed(2)}
                    </Badge>
                  </div>
                  <Progress value={Math.min(performanceOverview.sharpeRatio * 33.33, 100)} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Sortino Ratio</span>
                    <Badge variant={performanceOverview.sortinoRatio >= 1.5 ? 'default' : performanceOverview.sortinoRatio >= 1 ? 'secondary' : 'destructive'}>
                      {performanceOverview.sortinoRatio.toFixed(2)}
                    </Badge>
                  </div>
                  <Progress value={Math.min(performanceOverview.sortinoRatio * 33.33, 100)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Execution Speed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {performanceOverview.avgFillTime.toFixed(0)}ms
                </div>
                <p className="text-sm text-muted-foreground">Average fill time</p>
                <Progress value={100 - (performanceOverview.avgFillTime / 1000 * 100)} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Slippage Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {formatPercentage(performanceOverview.slippageRate, 3)}
                </div>
                <p className="text-sm text-muted-foreground">Average slippage</p>
                <Progress value={Math.max(0, 100 - performanceOverview.slippageRate * 1000)} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {formatPercentage(performanceOverview.executionSuccessRate)}
                </div>
                <p className="text-sm text-muted-foreground">Execution success</p>
                <Progress value={performanceOverview.executionSuccessRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Performance Summary
          </CardTitle>
          <CardDescription>
            Last updated: {new Date(performanceOverview.timestamp).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            {computedMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Portfolio Health:</strong> 
                  <Badge className="ml-2" variant={
                    computedMetrics.riskAdjustedScore >= 1.5 ? 'default' : 
                    computedMetrics.riskAdjustedScore >= 1 ? 'secondary' : 'destructive'
                  }>
                    {computedMetrics.riskAdjustedScore >= 1.5 ? 'Excellent' : 
                     computedMetrics.riskAdjustedScore >= 1 ? 'Good' : 'Needs Attention'}
                  </Badge>
                </div>
                <div>
                  <strong>Active Strategies:</strong> {computedMetrics.activeStrategies} of {computedMetrics.totalStrategies}
                </div>
                <div>
                  <strong>Best Performer:</strong> {computedMetrics.bestPerformingStrategy?.strategyName || 'N/A'}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceOverview;