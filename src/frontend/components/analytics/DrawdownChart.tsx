/**
 * Drawdown Chart Component
 * 
 * Advanced drawdown visualization and recovery tracking with detailed
 * analysis of portfolio decline periods, recovery times, and risk metrics.
 * Provides comprehensive insights into downside risk management.
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
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  Shield,
  Clock,
  Target,
  Activity,
  Calendar,
  BarChart3,
  Eye,
  Zap,
  RefreshCw,
  Info
} from 'lucide-react';
import { usePerformanceData, DrawdownMetrics } from '../../hooks/usePerformanceData';

interface DrawdownChartProps {
  className?: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  strategyId?: string;
  showRecovery?: boolean;
}

// Drawdown severity levels
const DRAWDOWN_LEVELS = {
  MINOR: { threshold: 2, color: '#10B981', label: 'Minor' },
  MODERATE: { threshold: 5, color: '#F59E0B', label: 'Moderate' },
  SEVERE: { threshold: 10, color: '#EF4444', label: 'Severe' },
  EXTREME: { threshold: 20, color: '#7C2D12', label: 'Extreme' }
};

// Format utility functions
const formatPercentage = (value: number, decimals = 2): string => `${value.toFixed(decimals)}%`;
const formatDays = (days: number): string => `${Math.round(days)} days`;

// Get drawdown severity level
const getDrawdownSeverity = (drawdown: number) => {
  const absDrawdown = Math.abs(drawdown);
  if (absDrawdown >= DRAWDOWN_LEVELS.EXTREME.threshold) return DRAWDOWN_LEVELS.EXTREME;
  if (absDrawdown >= DRAWDOWN_LEVELS.SEVERE.threshold) return DRAWDOWN_LEVELS.SEVERE;
  if (absDrawdown >= DRAWDOWN_LEVELS.MODERATE.threshold) return DRAWDOWN_LEVELS.MODERATE;
  return DRAWDOWN_LEVELS.MINOR;
};

// Drawdown period card component
const DrawdownPeriodCard: React.FC<{
  period: DrawdownMetrics['periods'][0];
  rank: number;
}> = ({ period, rank }) => {
  const severity = getDrawdownSeverity(period.drawdown);
  const isOngoing = !period.end;
  const duration = period.duration;
  
  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant={rank <= 3 ? 'destructive' : 'secondary'}>
            #{rank} Drawdown
          </Badge>
          <Badge style={{ backgroundColor: severity.color, color: 'white' }}>
            {severity.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Start:</span>
            <div className="font-mono">{period.start.toLocaleDateString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">End:</span>
            <div className="font-mono">
              {period.end ? period.end.toLocaleDateString() : 'Ongoing'}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Drawdown:</span>
            <div className="font-mono text-red-600 font-bold">
              {formatPercentage(Math.abs(period.drawdown))}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <div className="font-mono">{formatDays(duration)}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Peak:</span>
            <div className="font-mono">${period.peak.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Trough:</span>
            <div className="font-mono">${period.trough.toLocaleString()}</div>
          </div>
        </div>
        
        {period.recovery && (
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm">Recovered in {formatDays(period.recovery)}</span>
            </div>
          </div>
        )}
        
        {isOngoing && (
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-yellow-600">Currently in drawdown</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const DrawdownChart: React.FC<DrawdownChartProps> = ({
  className,
  timeframe = '1M',
  strategyId,
  showRecovery = true
}) => {
  const [chartType, setChartType] = useState<'area' | 'line' | 'bar'>('area');
  const [showPeaks, setShowPeaks] = useState(true);
  const [showTroughs, setShowTroughs] = useState(true);

  const {
    drawdownMetrics,
    performanceOverview,
    isLoading: drawdownLoading,
    hasError: drawdownError,
    refetchDrawdown
  } = usePerformanceData({
    timeframe,
    strategyIds: strategyId ? [strategyId] : [],
    enableRealTime: true
  });

  // Generate sample drawdown data for demonstration
  const drawdownChartData = useMemo(() => {
    if (!drawdownMetrics && !performanceOverview) return [];
    
    const data = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // 90 days of data
    
    let portfolioValue = 100000;
    let peak = portfolioValue;
    let currentDrawdown = 0;
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Simulate some volatility with occasional drawdowns
      const dailyReturn = (Math.random() - 0.48) * 0.02; // Slight positive bias
      portfolioValue *= (1 + dailyReturn);
      
      // Update peak and calculate drawdown
      if (portfolioValue > peak) {
        peak = portfolioValue;
        currentDrawdown = 0;
      } else {
        currentDrawdown = ((portfolioValue - peak) / peak) * 100;
      }
      
      data.push({
        date: date.toLocaleDateString(),
        portfolioValue,
        peak,
        drawdown: currentDrawdown,
        underwaterCurve: Math.min(0, currentDrawdown)
      });
    }
    
    return data;
  }, [drawdownMetrics, performanceOverview]);

  // Recovery analysis data
  const recoveryData = useMemo(() => {
    if (!drawdownMetrics?.periods) return [];
    
    return drawdownMetrics.periods
      .filter(p => p.recovery !== null)
      .map((period, index) => ({
        period: `Period ${index + 1}`,
        drawdown: Math.abs(period.drawdown),
        recovery: period.recovery,
        duration: period.duration,
        severity: getDrawdownSeverity(period.drawdown).label
      }));
  }, [drawdownMetrics]);

  // Drawdown statistics
  const drawdownStats = useMemo(() => {
    if (!drawdownMetrics) return null;
    
    const periods = drawdownMetrics.periods;
    const recoveredPeriods = periods.filter(p => p.recovery !== null);
    
    return {
      totalDrawdowns: periods.length,
      currentDrawdown: drawdownMetrics.currentDrawdown,
      maxDrawdown: drawdownMetrics.maxDrawdown,
      avgDrawdown: drawdownMetrics.avgDrawdown,
      avgDuration: drawdownMetrics.avgDrawdownDuration,
      avgRecovery: drawdownMetrics.avgRecoveryTime,
      recoveryRate: (recoveredPeriods.length / periods.length) * 100,
      drawdownFrequency: drawdownMetrics.drawdownFrequency
    };
  }, [drawdownMetrics]);

  if (drawdownLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading drawdown analysis...</span>
        </div>
        <div className="h-96 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  if (drawdownError) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h3 className="text-lg font-semibold">Unable to Load Drawdown Data</h3>
            <p className="text-sm text-muted-foreground">
              Please check your connection and try again.
            </p>
            <Button onClick={refetchDrawdown} variant="outline" size="sm">
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
          <h2 className="text-3xl font-bold tracking-tight">Drawdown Analysis</h2>
          <p className="text-muted-foreground">
            Portfolio decline periods, recovery tracking, and risk assessment
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={chartType} onValueChange={(value) => setChartType(value as any)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area">Area</SelectItem>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={showPeaks ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowPeaks(!showPeaks)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Peaks
          </Button>
          
          <Button
            variant={showTroughs ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTroughs(!showTroughs)}
          >
            <TrendingDown className="h-4 w-4 mr-1" />
            Troughs
          </Button>
        </div>
      </div>

      {/* Current Status Cards */}
      {drawdownStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Drawdown</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatPercentage(Math.abs(drawdownStats.currentDrawdown.drawdown))}
              </div>
              <p className="text-xs text-muted-foreground">
                {drawdownStats.currentDrawdown.duration} days from peak
              </p>
              <Progress 
                value={Math.abs(drawdownStats.currentDrawdown.drawdown)} 
                max={Math.abs(drawdownStats.maxDrawdown)}
                className="mt-2"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPercentage(Math.abs(drawdownStats.maxDrawdown))}
              </div>
              <p className="text-xs text-muted-foreground">
                Historical maximum
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Recovery</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDays(drawdownStats.avgRecovery)}
              </div>
              <p className="text-xs text-muted-foreground">
                Average time to recover
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
              <Shield className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPercentage(drawdownStats.recoveryRate, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {drawdownStats.totalDrawdowns} total periods
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Drawdown Timeline
          </CardTitle>
          <CardDescription>
            Portfolio value and drawdown periods over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="underwater" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="underwater">Underwater Curve</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio Value</TabsTrigger>
              <TabsTrigger value="combined">Combined View</TabsTrigger>
            </TabsList>

            <TabsContent value="underwater">
              <ResponsiveContainer width="100%" height={400}>
                {chartType === 'area' ? (
                  <AreaChart data={drawdownChartData}>
                    <defs>
                      <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      domain={['dataMin', 0]}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <ReferenceLine y={0} stroke="#10B981" strokeDasharray="2 2" />
                    <Area
                      type="monotone"
                      dataKey="underwaterCurve"
                      stroke="#EF4444"
                      fill="url(#drawdownGradient)"
                    />
                  </AreaChart>
                ) : chartType === 'line' ? (
                  <LineChart data={drawdownChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      domain={['dataMin', 0]}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                    />
                    <ReferenceLine y={0} stroke="#10B981" strokeDasharray="2 2" />
                    <Line
                      type="monotone"
                      dataKey="underwaterCurve"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={drawdownChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      domain={['dataMin', 0]}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                    />
                    <Bar dataKey="underwaterCurve" fill="#EF4444" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="portfolio">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={drawdownChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `$${value.toLocaleString()}`,
                      name === 'portfolioValue' ? 'Portfolio Value' : 'Peak Value'
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolioValue"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Portfolio Value"
                    dot={false}
                  />
                  {showPeaks && (
                    <Line
                      type="monotone"
                      dataKey="peak"
                      stroke="#10B981"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      name="Peak Value"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="combined">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={drawdownChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={['dataMin', 0]}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'portfolioValue') return [`$${value.toLocaleString()}`, 'Portfolio Value'];
                      if (name === 'underwaterCurve') return [`${value.toFixed(2)}%`, 'Drawdown'];
                      return [value, name];
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="portfolioValue"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Portfolio Value"
                    dot={false}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="underwaterCurve"
                    stroke="#EF4444"
                    fill="#EF4444"
                    fillOpacity={0.3}
                    name="Drawdown"
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recovery Analysis */}
        {showRecovery && recoveryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Recovery Analysis
              </CardTitle>
              <CardDescription>
                Drawdown to recovery time relationship
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={recoveryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `${value} days`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'drawdown' ? `${value.toFixed(1)}%` : `${value} days`,
                      name === 'drawdown' ? 'Max Drawdown' : 'Recovery Time'
                    ]}
                  />
                  <Bar dataKey="recovery" fill="#10B981" opacity={0.7} />
                  <Line 
                    type="monotone" 
                    dataKey="drawdown" 
                    stroke="#EF4444" 
                    strokeWidth={2}
                    name="Drawdown %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Statistics Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Drawdown Statistics
            </CardTitle>
            <CardDescription>
              Key metrics and historical analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drawdownStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Max Drawdown:</span>
                      <span className="font-mono text-red-600">
                        {formatPercentage(Math.abs(drawdownStats.maxDrawdown))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Drawdown:</span>
                      <span className="font-mono">
                        {formatPercentage(Math.abs(drawdownStats.avgDrawdown))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Drawdown:</span>
                      <span className="font-mono text-red-600">
                        {formatPercentage(Math.abs(drawdownStats.currentDrawdown.drawdown))}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Avg Duration:</span>
                      <span className="font-mono">{formatDays(drawdownStats.avgDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Recovery:</span>
                      <span className="font-mono">{formatDays(drawdownStats.avgRecovery)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Frequency:</span>
                      <span className="font-mono">{drawdownStats.drawdownFrequency.toFixed(1)}/year</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Recovery Rate:</span>
                    <div className="text-right">
                      <span className="font-mono">{formatPercentage(drawdownStats.recoveryRate, 0)}</span>
                      <Progress 
                        value={drawdownStats.recoveryRate} 
                        className="w-16 h-2 mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Drawdown Periods */}
      {drawdownMetrics?.periods && drawdownMetrics.periods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Historical Drawdown Periods
            </CardTitle>
            <CardDescription>
              Detailed analysis of significant portfolio declines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drawdownMetrics.periods
                .sort((a, b) => Math.abs(b.drawdown) - Math.abs(a.drawdown))
                .slice(0, 6)
                .map((period, index) => (
                  <DrawdownPeriodCard 
                    key={`${period.start.toISOString()}-${index}`}
                    period={period}
                    rank={index + 1}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Risk Assessment
          </CardTitle>
          <CardDescription>
            Portfolio downside risk evaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {drawdownStats && (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2">
                    {getDrawdownSeverity(drawdownStats.maxDrawdown).label}
                  </div>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <div 
                    className="w-full h-2 rounded mt-2"
                    style={{ 
                      backgroundColor: getDrawdownSeverity(drawdownStats.maxDrawdown).color,
                      opacity: 0.7
                    }}
                  />
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2">
                    {drawdownStats.currentDrawdown.isRecovering ? 'Recovering' : 'Stable'}
                  </div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <div className="flex justify-center mt-2">
                    {drawdownStats.currentDrawdown.isRecovering ? 
                      <TrendingUp className="h-6 w-6 text-green-500" /> :
                      <Activity className="h-6 w-6 text-blue-500" />
                    }
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2">
                    {formatPercentage(drawdownStats.recoveryRate, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Recovery Success</p>
                  <Progress 
                    value={drawdownStats.recoveryRate} 
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrawdownChart;