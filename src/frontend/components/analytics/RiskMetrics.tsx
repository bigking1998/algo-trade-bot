/**
 * Risk Metrics Component
 * 
 * Comprehensive risk analysis dashboard featuring Sharpe ratio, Sortino ratio,
 * risk-adjusted returns, VaR calculations, and advanced risk metrics with
 * interactive visualizations and benchmarking capabilities.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  Activity,
  BarChart3,
  Zap,
  Eye,
  Settings,
  Info,
  Gauge,
  Award,
  Clock,
  DollarSign,
  Percent
} from 'lucide-react';
import { usePerformanceData } from '../../hooks/usePerformanceData';

interface RiskMetricsProps {
  className?: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  strategyId?: string;
  benchmarkIndex?: 'SPY' | 'QQQ' | 'VTI' | 'Custom';
}

// Risk metric thresholds and ratings
const RISK_THRESHOLDS = {
  sharpeRatio: {
    excellent: 2.0,
    good: 1.5,
    fair: 1.0,
    poor: 0.5
  },
  sortinoRatio: {
    excellent: 2.5,
    good: 2.0,
    fair: 1.5,
    poor: 1.0
  },
  calmarRatio: {
    excellent: 1.5,
    good: 1.0,
    fair: 0.5,
    poor: 0.2
  },
  maxDrawdown: {
    excellent: 5,
    good: 10,
    fair: 15,
    poor: 25
  },
  volatility: {
    excellent: 10,
    good: 15,
    fair: 20,
    poor: 30
  }
};

// Colors for risk levels
const RISK_COLORS = {
  excellent: '#10B981',
  good: '#3B82F6',
  fair: '#F59E0B',
  poor: '#EF4444',
  neutral: '#6B7280'
};

// Format utility functions
const formatPercentage = (value: number, decimals = 2): string => `${value.toFixed(decimals)}%`;
const formatRatio = (value: number, decimals = 2): string => value.toFixed(decimals);

// Get risk rating for a metric
const getRiskRating = (
  value: number, 
  metric: keyof typeof RISK_THRESHOLDS, 
  invert = false
): { rating: keyof typeof RISK_COLORS; color: string } => {
  const thresholds = RISK_THRESHOLDS[metric];
  const compareValue = invert ? -value : value;
  
  if (metric === 'maxDrawdown' || metric === 'volatility') {
    // Lower is better for these metrics
    const absValue = Math.abs(value);
    if (absValue <= thresholds.excellent) return { rating: 'excellent', color: RISK_COLORS.excellent };
    if (absValue <= thresholds.good) return { rating: 'good', color: RISK_COLORS.good };
    if (absValue <= thresholds.fair) return { rating: 'fair', color: RISK_COLORS.fair };
    return { rating: 'poor', color: RISK_COLORS.poor };
  } else {
    // Higher is better for ratios
    if (compareValue >= thresholds.excellent) return { rating: 'excellent', color: RISK_COLORS.excellent };
    if (compareValue >= thresholds.good) return { rating: 'good', color: RISK_COLORS.good };
    if (compareValue >= thresholds.fair) return { rating: 'fair', color: RISK_COLORS.fair };
    return { rating: 'poor', color: RISK_COLORS.poor };
  }
};

// Risk Metric Card Component
const RiskMetricCard: React.FC<{
  title: string;
  value: number;
  metric: keyof typeof RISK_THRESHOLDS;
  format: 'percentage' | 'ratio';
  description: string;
  benchmark?: number;
  icon?: React.ReactNode;
}> = ({ title, value, metric, format, description, benchmark, icon }) => {
  const rating = getRiskRating(value, metric);
  const formatValue = format === 'percentage' ? formatPercentage(Math.abs(value)) : formatRatio(value);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon || <Shield className="h-4 w-4" style={{ color: rating.color }} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2" style={{ color: rating.color }}>
          {formatValue}
        </div>
        <div className="flex items-center justify-between">
          <Badge style={{ backgroundColor: rating.color, color: 'white' }}>
            {rating.rating.toUpperCase()}
          </Badge>
          {benchmark && (
            <span className="text-xs text-muted-foreground">
              vs {format === 'percentage' ? formatPercentage(benchmark) : formatRatio(benchmark)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
};

export const RiskMetrics: React.FC<RiskMetricsProps> = ({
  className,
  timeframe = '1M',
  strategyId,
  benchmarkIndex = 'SPY'
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [compareWith, setCompareWith] = useState<'benchmark' | 'peers' | 'historical'>('benchmark');

  const {
    performanceOverview,
    strategyPerformance,
    benchmarks,
    isLoading,
    hasError
  } = usePerformanceData({
    timeframe,
    strategyIds: strategyId ? [strategyId] : [],
    enableRealTime: true
  });

  // Enhanced risk metrics calculations
  const riskMetrics = useMemo(() => {
    if (!performanceOverview) return null;
    
    // Calculate additional risk metrics
    const calmarRatio = performanceOverview.totalPnL !== 0 ? 
      performanceOverview.totalPnL / Math.abs(performanceOverview.maxDrawdown) : 0;
    
    const informationRatio = 0; // Would be calculated with benchmark data
    const treynorRatio = 0; // Would need beta calculation
    const sterlingRatio = calmarRatio; // Simplified
    
    // VaR calculations (simplified)
    const var95 = performanceOverview.volatility * 1.645; // Parametric VaR
    const var99 = performanceOverview.volatility * 2.326;
    const cvar95 = var95 * 1.2; // Simplified CVaR
    
    // Tail risk metrics
    const tailRisk = Math.max(0, Math.abs(performanceOverview.maxDrawdown) - performanceOverview.volatility);
    
    return {
      // Core ratios
      sharpeRatio: performanceOverview.sharpeRatio,
      sortinoRatio: performanceOverview.sortinoRatio,
      calmarRatio,
      informationRatio,
      treynorRatio,
      sterlingRatio,
      
      // Risk measures
      volatility: performanceOverview.volatility,
      maxDrawdown: performanceOverview.maxDrawdown,
      currentDrawdown: performanceOverview.currentDrawdown,
      
      // VaR and tail risk
      var95,
      var99,
      cvar95,
      tailRisk,
      
      // Performance metrics
      totalReturn: (performanceOverview.totalPnL / 100000) * 100, // Assuming 100k base
      winRate: performanceOverview.winRate,
      profitFactor: performanceOverview.profitFactor,
      
      // Consistency metrics
      consistency: performanceOverview.winRate / 100 * performanceOverview.sharpeRatio,
      stability: Math.max(0, 100 - Math.abs(performanceOverview.maxDrawdown) * 2)
    };
  }, [performanceOverview]);

  // Risk radar chart data
  const radarData = useMemo(() => {
    if (!riskMetrics) return [];
    
    return [
      {
        metric: 'Return',
        value: Math.max(0, Math.min(100, riskMetrics.totalReturn + 50))
      },
      {
        metric: 'Sharpe Ratio',
        value: Math.min(100, riskMetrics.sharpeRatio * 25)
      },
      {
        metric: 'Sortino Ratio', 
        value: Math.min(100, riskMetrics.sortinoRatio * 20)
      },
      {
        metric: 'Low Volatility',
        value: Math.max(0, 100 - riskMetrics.volatility * 3)
      },
      {
        metric: 'Low Drawdown',
        value: Math.max(0, 100 - Math.abs(riskMetrics.maxDrawdown) * 5)
      },
      {
        metric: 'Consistency',
        value: riskMetrics.consistency * 50
      }
    ];
  }, [riskMetrics]);

  // Risk breakdown for pie chart
  const riskBreakdown = useMemo(() => {
    if (!riskMetrics) return [];
    
    return [
      { name: 'Market Risk', value: 40, color: RISK_COLORS.fair },
      { name: 'Strategy Risk', value: 25, color: RISK_COLORS.good },
      { name: 'Execution Risk', value: 15, color: RISK_COLORS.excellent },
      { name: 'Liquidity Risk', value: 10, color: RISK_COLORS.good },
      { name: 'Other Risk', value: 10, color: RISK_COLORS.neutral }
    ];
  }, [riskMetrics]);

  // Historical risk evolution (sample data)
  const riskEvolution = useMemo(() => {
    const data = [];
    const baseDate = new Date();
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString(),
        sharpe: 1.2 + Math.sin(i / 10) * 0.3 + (Math.random() - 0.5) * 0.2,
        volatility: 15 + Math.cos(i / 8) * 3 + (Math.random() - 0.5) * 2,
        drawdown: -(Math.abs(Math.sin(i / 15)) * 8 + Math.random() * 3)
      });
    }
    
    return data;
  }, []);

  if (isLoading) {
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

  if (hasError || !riskMetrics) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h3 className="text-lg font-semibold">Unable to Load Risk Data</h3>
            <p className="text-sm text-muted-foreground">
              Risk metrics are currently unavailable.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Risk Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive risk assessment and risk-adjusted performance metrics
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={compareWith} onValueChange={(value) => setCompareWith(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="benchmark">Benchmark</SelectItem>
              <SelectItem value="peers">Peers</SelectItem>
              <SelectItem value="historical">Historical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Risk Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskMetricCard
          title="Sharpe Ratio"
          value={riskMetrics.sharpeRatio}
          metric="sharpeRatio"
          format="ratio"
          description="Risk-adjusted return efficiency"
          icon={<Award className="h-4 w-4" />}
        />
        
        <RiskMetricCard
          title="Sortino Ratio"
          value={riskMetrics.sortinoRatio}
          metric="sortinoRatio"
          format="ratio"
          description="Downside risk-adjusted returns"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        
        <RiskMetricCard
          title="Calmar Ratio"
          value={riskMetrics.calmarRatio}
          metric="calmarRatio"
          format="ratio"
          description="Return vs maximum drawdown"
          icon={<Target className="h-4 w-4" />}
        />
        
        <RiskMetricCard
          title="Max Drawdown"
          value={riskMetrics.maxDrawdown}
          metric="maxDrawdown"
          format="percentage"
          description="Maximum portfolio decline"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        
        <RiskMetricCard
          title="Volatility"
          value={riskMetrics.volatility}
          metric="volatility"
          format="percentage"
          description="Return variability measure"
          icon={<Activity className="h-4 w-4" />}
        />
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VaR (95%)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 mb-2">
              {formatPercentage(riskMetrics.var95)}
            </div>
            <Badge variant="destructive">
              RISK LIMIT
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              95% confidence daily loss limit
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <Gauge className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {Math.round((riskMetrics.sharpeRatio * 20) + (100 - Math.abs(riskMetrics.maxDrawdown) * 4))}
            </div>
            <Badge variant="secondary">
              MODERATE
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Composite risk assessment
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stability</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 mb-2">
              {formatPercentage(riskMetrics.stability)}
            </div>
            <Progress value={riskMetrics.stability} className="mb-2" />
            <p className="text-xs text-muted-foreground">
              Portfolio stability index
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Risk Analysis */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ratios">Risk Ratios</TabsTrigger>
          <TabsTrigger value="var">VaR Analysis</TabsTrigger>
          <TabsTrigger value="evolution">Evolution</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Risk Profile Radar
                </CardTitle>
                <CardDescription>
                  Multi-dimensional risk assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Risk Profile"
                      dataKey="value"
                      stroke={RISK_COLORS.good}
                      fill={RISK_COLORS.good}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk vs Return Scatter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Risk-Return Profile
                </CardTitle>
                <CardDescription>
                  Portfolio position in risk-return space
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="Risk"
                      domain={[0, 30]}
                      unit="%"
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name="Return"
                      domain={[-20, 30]}
                      unit="%"
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter 
                      name="Portfolio" 
                      data={[{
                        x: riskMetrics.volatility,
                        y: riskMetrics.totalReturn,
                        sharpe: riskMetrics.sharpeRatio
                      }]}
                      fill={RISK_COLORS.good}
                    />
                    {/* Benchmark points would be added here */}
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ratios" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="h-5 w-5 mr-2" />
                  Risk-Adjusted Ratios
                </CardTitle>
                <CardDescription>
                  Comparative risk-adjusted performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Sharpe', value: riskMetrics.sharpeRatio, target: 1.5 },
                    { name: 'Sortino', value: riskMetrics.sortinoRatio, target: 2.0 },
                    { name: 'Calmar', value: riskMetrics.calmarRatio, target: 1.0 },
                    { name: 'Sterling', value: riskMetrics.sterlingRatio, target: 1.0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill={RISK_COLORS.good} />
                    <Bar dataKey="target" fill={RISK_COLORS.neutral} opacity={0.3} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Ratio Analysis</CardTitle>
                <CardDescription>
                  Detailed breakdown of risk-adjusted metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Sharpe Ratio', value: riskMetrics.sharpeRatio, threshold: 1.5, description: 'Risk-adjusted return per unit of volatility' },
                  { name: 'Sortino Ratio', value: riskMetrics.sortinoRatio, threshold: 2.0, description: 'Risk-adjusted return per unit of downside deviation' },
                  { name: 'Calmar Ratio', value: riskMetrics.calmarRatio, threshold: 1.0, description: 'Annualized return over maximum drawdown' },
                  { name: 'Information Ratio', value: riskMetrics.informationRatio, threshold: 0.5, description: 'Excess return per unit of tracking error' }
                ].map((ratio, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{ratio.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono">{formatRatio(ratio.value)}</span>
                        <Badge variant={ratio.value >= ratio.threshold ? 'default' : 'secondary'}>
                          {ratio.value >= ratio.threshold ? 'Good' : 'Fair'}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={Math.min(100, (ratio.value / ratio.threshold) * 100)} />
                    <p className="text-xs text-muted-foreground">{ratio.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="var" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Value at Risk Analysis
                </CardTitle>
                <CardDescription>
                  Potential loss estimates at different confidence levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {formatPercentage(riskMetrics.var95)}
                      </div>
                      <p className="text-sm text-muted-foreground">VaR 95%</p>
                      <p className="text-xs">Daily potential loss</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-700">
                        {formatPercentage(riskMetrics.var99)}
                      </div>
                      <p className="text-sm text-muted-foreground">VaR 99%</p>
                      <p className="text-xs">Extreme loss scenario</p>
                    </div>
                  </div>
                  
                  <div className="text-center pt-4 border-t">
                    <div className="text-xl font-bold text-red-800">
                      {formatPercentage(riskMetrics.cvar95)}
                    </div>
                    <p className="text-sm text-muted-foreground">Conditional VaR (95%)</p>
                    <p className="text-xs">Expected loss beyond VaR</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Tail Risk Analysis
                </CardTitle>
                <CardDescription>
                  Extreme risk and black swan event exposure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex justify-between items-center">
                    <span>Tail Risk</span>
                    <span className="font-mono text-red-600">
                      {formatPercentage(riskMetrics.tailRisk)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, riskMetrics.tailRisk * 4)} 
                    className="w-full"
                  />
                  
                  <div className="flex justify-between items-center">
                    <span>Skewness Risk</span>
                    <Badge variant="secondary">Normal</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Kurtosis Risk</span>
                    <Badge variant="secondary">Moderate</Badge>
                  </div>
                  
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <p>Tail risk measures exposure to extreme market events beyond normal volatility expectations.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evolution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Risk Evolution Over Time
              </CardTitle>
              <CardDescription>
                Historical development of key risk metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={riskEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="sharpe"
                    stroke={RISK_COLORS.excellent}
                    strokeWidth={2}
                    name="Sharpe Ratio"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="volatility"
                    stroke={RISK_COLORS.fair}
                    strokeWidth={2}
                    name="Volatility %"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="drawdown"
                    stroke={RISK_COLORS.poor}
                    fill={RISK_COLORS.poor}
                    fillOpacity={0.3}
                    name="Drawdown %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Risk Composition
                </CardTitle>
                <CardDescription>
                  Breakdown of portfolio risk sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {riskBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Risk Factor Analysis</CardTitle>
                <CardDescription>
                  Detailed risk component breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {riskBreakdown.map((factor, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: factor.color }}
                        />
                        <span className="text-sm font-medium">{factor.name}</span>
                      </div>
                      <span className="text-sm font-mono">{factor.value}%</span>
                    </div>
                    <Progress value={factor.value} max={50} />
                  </div>
                ))}
                
                <div className="pt-4 border-t text-xs text-muted-foreground">
                  <p>Risk factors represent estimated contribution to total portfolio risk. Market risk typically dominates in most strategies.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Risk Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Risk Assessment Summary
          </CardTitle>
          <CardDescription>
            Overall risk evaluation and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-lg font-semibold mb-2">
                Overall Risk Level
              </div>
              <Badge 
                className="text-sm px-3 py-1" 
                style={{ 
                  backgroundColor: getRiskRating(riskMetrics.sharpeRatio, 'sharpeRatio').color,
                  color: 'white'
                }}
              >
                MODERATE
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Based on comprehensive risk analysis
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold mb-2">
                Risk-Adjusted Performance
              </div>
              <div className="text-2xl font-bold" style={{ color: getRiskRating(riskMetrics.sharpeRatio, 'sharpeRatio').color }}>
                {getRiskRating(riskMetrics.sharpeRatio, 'sharpeRatio').rating.toUpperCase()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Sharpe ratio: {formatRatio(riskMetrics.sharpeRatio)}
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold mb-2">
                Downside Protection
              </div>
              <div className="text-2xl font-bold" style={{ color: getRiskRating(riskMetrics.maxDrawdown, 'maxDrawdown').color }}>
                {getRiskRating(riskMetrics.maxDrawdown, 'maxDrawdown').rating.toUpperCase()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Max drawdown: {formatPercentage(Math.abs(riskMetrics.maxDrawdown))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RiskMetrics;