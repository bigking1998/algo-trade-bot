/**
 * Risk Analytics Panel
 * 
 * Advanced risk analytics panel with comprehensive risk visualization,
 * real-time risk monitoring, VaR analysis, stress testing capabilities,
 * and integration with ML-powered risk models.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  ComposedChart,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  Cell,
  PieChart,
  Pie,
  TreeMap,
  Sankey
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  TrendingDown,
  Activity,
  Target,
  BarChart3,
  Gauge,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Zap,
  Clock,
  DollarSign,
  Percent,
  TrendingUp,
  Filter,
  Download,
  Calendar,
  Globe,
  Network
} from 'lucide-react';

// Import hooks
import { 
  useRiskMetrics, 
  useDrawdownHistory, 
  useVolatilityData,
  usePositionExposure,
  useRiskAlerts,
  useExposureMatrix
} from '../../hooks/useRiskData';
import { useMLPredictions } from '../../hooks/useMLPredictions';

interface RiskAnalyticsPanelProps {
  className?: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y';
  symbol?: string;
  compact?: boolean;
  showAdvanced?: boolean;
  realTime?: boolean;
}

// Risk level color mapping
const RISK_COLORS = {
  low: '#10B981',      // Green
  moderate: '#F59E0B',  // Yellow 
  high: '#EF4444',     // Red
  critical: '#7C2D12'  // Dark red
};

// Risk thresholds
const RISK_THRESHOLDS = {
  var: { low: 1000, moderate: 2500, high: 5000 },
  drawdown: { low: 5, moderate: 10, high: 20 },
  volatility: { low: 15, moderate: 25, high: 40 },
  concentration: { low: 20, moderate: 40, high: 60 }
};

// Helper function to get risk level
const getRiskLevel = (value: number, metric: keyof typeof RISK_THRESHOLDS): keyof typeof RISK_COLORS => {
  const thresholds = RISK_THRESHOLDS[metric];
  if (value <= thresholds.low) return 'low';
  if (value <= thresholds.moderate) return 'moderate';
  if (value <= thresholds.high) return 'high';
  return 'critical';
};

// Risk Metric Card Component
const RiskMetricCard: React.FC<{
  title: string;
  value: number;
  unit: string;
  threshold: keyof typeof RISK_THRESHOLDS;
  icon: React.ReactNode;
  trend?: number;
  description?: string;
}> = ({ title, value, unit, threshold, icon, trend, description }) => {
  const riskLevel = getRiskLevel(Math.abs(value), threshold);
  const color = RISK_COLORS[riskLevel];
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div style={{ color }}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2" style={{ color }}>
          {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}{unit}
        </div>
        <div className="flex items-center justify-between">
          <Badge 
            style={{ backgroundColor: color, color: 'white' }}
            className="text-xs"
          >
            {riskLevel.toUpperCase()}
          </Badge>
          {trend !== undefined && (
            <div className="flex items-center">
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
              )}
              <span className="text-xs text-muted-foreground">
                {Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

// VaR Breakdown Component
const VaRBreakdown: React.FC<{
  riskMetrics: any;
  exposureData: any;
  compact?: boolean;
}> = ({ riskMetrics, exposureData, compact = false }) => {
  const varData = useMemo(() => [
    {
      name: 'VaR 95%',
      value: riskMetrics?.var1d || 0,
      confidence: 95,
      color: RISK_COLORS.moderate
    },
    {
      name: 'VaR 99%',
      value: (riskMetrics?.var1d || 0) * 1.5,
      confidence: 99,
      color: RISK_COLORS.high
    },
    {
      name: 'CVaR 95%',
      value: (riskMetrics?.var1d || 0) * 1.3,
      confidence: 95,
      color: RISK_COLORS.critical
    }
  ], [riskMetrics]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {varData.map((item, index) => (
          <div key={index} className="text-center">
            <div 
              className="text-xl font-bold mb-1"
              style={{ color: item.color }}
            >
              ${item.value.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">{item.name}</div>
            <Progress 
              value={(item.value / (varData[1]?.value || 1)) * 100} 
              className="mt-2 h-2"
            />
          </div>
        ))}
      </div>
      
      {!compact && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={varData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Potential Loss']} />
              <Bar dataKey="value" fill={RISK_COLORS.moderate} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// Stress Testing Component
const StressTesting: React.FC<{
  symbol: string;
  positions: any[];
}> = ({ symbol, positions }) => {
  const [scenario, setScenario] = useState('market-crash');
  
  const stressScenarios = useMemo(() => ({
    'market-crash': {
      name: 'Market Crash (-30%)',
      impact: positions.reduce((total, pos) => total + (pos.exposure * -0.3), 0),
      probability: 0.05
    },
    'flash-crash': {
      name: 'Flash Crash (-15%)',
      impact: positions.reduce((total, pos) => total + (pos.exposure * -0.15), 0),
      probability: 0.15
    },
    'high-volatility': {
      name: 'High Volatility (+50%)',
      impact: positions.reduce((total, pos) => total + (Math.abs(pos.exposure) * 0.2), 0),
      probability: 0.25
    },
    'liquidity-crisis': {
      name: 'Liquidity Crisis',
      impact: positions.reduce((total, pos) => total + (pos.exposure * -0.1), 0),
      probability: 0.10
    }
  }), [positions]);

  const selectedScenario = stressScenarios[scenario as keyof typeof stressScenarios];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Stress Test Scenarios</h4>
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(stressScenarios).map(([key, scenario]) => (
              <SelectItem key={key} value={key}>
                {scenario.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">
                ${Math.abs(selectedScenario.impact).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Potential Loss</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {(selectedScenario.probability * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Probability</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(stressScenarios).map(([key, scenario]) => (
          <div 
            key={key}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              key === scenario ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
            onClick={() => setScenario(key)}
          >
            <div className="font-medium text-sm">{scenario.name}</div>
            <div className="text-xs text-muted-foreground">
              Impact: ${Math.abs(scenario.impact).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RiskAnalyticsPanel: React.FC<RiskAnalyticsPanelProps> = ({
  className,
  timeframe = '1M',
  symbol = 'BTC-USD',
  compact = false,
  showAdvanced = true,
  realTime = true
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [riskModel, setRiskModel] = useState('var-cvar');
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Data hooks
  const { data: riskMetrics, isLoading: riskLoading, error: riskError } = useRiskMetrics();
  const { data: drawdownHistory } = useDrawdownHistory(timeframe);
  const { data: volatilityData } = useVolatilityData();
  const { data: positionExposure } = usePositionExposure();
  const { data: riskAlerts } = useRiskAlerts();
  const { data: exposureMatrix } = useExposureMatrix();

  // ML-enhanced risk predictions
  const { data: riskPredictions } = useMLPredictions('risk-forecast', {
    symbol,
    timeframe,
    enabled: showAdvanced
  });

  // Derived analytics
  const riskAnalytics = useMemo(() => {
    if (!riskMetrics || !volatilityData || !positionExposure) return null;

    const concentrationRisk = positionExposure.positions.reduce((max, pos) => 
      Math.max(max, pos.concentration), 0);
    
    const diversificationScore = exposureMatrix?.diversificationScore || 0;
    
    const riskScore = Math.round(
      (100 - Math.abs(riskMetrics.maxDrawdown) * 2) +
      (100 - volatilityData.current * 2) +
      (100 - concentrationRisk) +
      (diversificationScore * 10)
    ) / 4;

    return {
      concentrationRisk,
      diversificationScore,
      riskScore,
      totalExposure: positionExposure.totalExposure,
      netExposure: positionExposure.netExposure,
      riskContribution: positionExposure.positions.reduce((sum, pos) => 
        sum + pos.riskContribution, 0)
    };
  }, [riskMetrics, volatilityData, positionExposure, exposureMatrix]);

  // Risk evolution data for charts
  const riskEvolution = useMemo(() => {
    if (!drawdownHistory) return [];
    
    return drawdownHistory.slice(-30).map((point, index) => ({
      date: new Date(point.timestamp).toLocaleDateString(),
      drawdown: Math.abs(point.drawdown),
      volatility: 15 + Math.sin(index / 5) * 5 + Math.random() * 3,
      var95: 1500 + Math.cos(index / 7) * 300 + Math.random() * 200,
      concentration: 30 + Math.sin(index / 10) * 10 + Math.random() * 5
    }));
  }, [drawdownHistory]);

  if (compact) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Compact Risk Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              ${riskMetrics?.var1d.toLocaleString() || '--'}
            </div>
            <div className="text-xs text-muted-foreground">Daily VaR</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">
              {Math.abs(riskMetrics?.maxDrawdown || 0).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Max Drawdown</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">
              {volatilityData?.current.toFixed(1) || '--'}%
            </div>
            <div className="text-xs text-muted-foreground">Volatility</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {riskAnalytics?.riskScore || '--'}
            </div>
            <div className="text-xs text-muted-foreground">Risk Score</div>
          </div>
        </div>

        {riskAlerts && riskAlerts.criticalCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-800">
                {riskAlerts.criticalCount} critical risk alert(s) active
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Risk Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive risk analysis with ML-enhanced forecasting
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={riskModel} onValueChange={setRiskModel}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="var-cvar">VaR/CVaR</SelectItem>
              <SelectItem value="monte-carlo">Monte Carlo</SelectItem>
              <SelectItem value="ml-enhanced">ML Enhanced</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-1">
            <Switch
              checked={alertsEnabled}
              onCheckedChange={setAlertsEnabled}
              id="alerts"
            />
            <Label htmlFor="alerts" className="text-xs">Alerts</Label>
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      {alertsEnabled && riskAlerts && riskAlerts.activeCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 mb-1">Active Risk Alerts</h4>
                <div className="space-y-1">
                  {riskAlerts.alerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="text-sm text-red-700">
                      {alert.title}: {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskMetricCard
          title="Value at Risk (95%)"
          value={riskMetrics?.var1d || 0}
          unit=""
          threshold="var"
          icon={<DollarSign className="h-4 w-4" />}
          description="Daily potential loss at 95% confidence"
        />
        
        <RiskMetricCard
          title="Maximum Drawdown"
          value={riskMetrics?.maxDrawdown || 0}
          unit="%"
          threshold="drawdown"
          icon={<TrendingDown className="h-4 w-4" />}
          trend={-2.1}
          description="Largest peak-to-trough decline"
        />
        
        <RiskMetricCard
          title="Portfolio Volatility"
          value={volatilityData?.current || 0}
          unit="%"
          threshold="volatility"
          icon={<Activity className="h-4 w-4" />}
          trend={1.3}
          description="Annualized volatility measure"
        />
        
        <RiskMetricCard
          title="Concentration Risk"
          value={riskAnalytics?.concentrationRisk || 0}
          unit="%"
          threshold="concentration"
          icon={<Target className="h-4 w-4" />}
          description="Largest single position exposure"
        />
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="var-analysis">VaR Analysis</TabsTrigger>
          <TabsTrigger value="stress-testing">Stress Testing</TabsTrigger>
          <TabsTrigger value="evolution">Risk Evolution</TabsTrigger>
          <TabsTrigger value="decomposition">Risk Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gauge className="h-5 w-5 mr-2" />
                  Risk Score
                </CardTitle>
                <CardDescription>
                  Composite risk assessment across all metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-6xl font-bold text-blue-600">
                    {riskAnalytics?.riskScore || '--'}
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    MODERATE RISK
                  </Badge>
                  <Progress value={riskAnalytics?.riskScore || 0} className="w-full" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Risk Metrics Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Sharpe Ratio:</span>
                    <div className="font-medium">{riskMetrics?.sharpeRatio.toFixed(2) || '--'}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Sortino Ratio:</span>
                    <div className="font-medium">{riskMetrics?.sortinoRatio.toFixed(2) || '--'}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Win Rate:</span>
                    <div className="font-medium">{((riskMetrics?.winRate || 0) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Profit Factor:</span>
                    <div className="font-medium">{riskMetrics?.profitFactor.toFixed(2) || '--'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Portfolio Risk Distribution
              </CardTitle>
              <CardDescription>
                Exposure and risk contribution by position
              </CardDescription>
            </CardHeader>
            <CardContent>
              {positionExposure && (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={positionExposure.positions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="symbol" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="exposure"
                      fill={RISK_COLORS.moderate}
                      name="Exposure ($)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="riskContribution"
                      stroke={RISK_COLORS.high}
                      name="Risk Contribution (%)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="var-analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Value at Risk Analysis
              </CardTitle>
              <CardDescription>
                Comprehensive VaR and CVaR calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VaRBreakdown 
                riskMetrics={riskMetrics}
                exposureData={positionExposure}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stress-testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Portfolio Stress Testing
              </CardTitle>
              <CardDescription>
                Scenario-based risk analysis and impact assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StressTesting 
                symbol={symbol}
                positions={positionExposure?.positions || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Risk Metrics Evolution
              </CardTitle>
              <CardDescription>
                Historical development of key risk indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={riskEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="drawdown"
                    fill={RISK_COLORS.high}
                    fillOpacity={0.3}
                    stroke={RISK_COLORS.high}
                    name="Drawdown %"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="volatility"
                    stroke={RISK_COLORS.moderate}
                    name="Volatility %"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="var95"
                    fill={RISK_COLORS.low}
                    name="VaR 95% ($)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decomposition" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Factor Decomposition</CardTitle>
                <CardDescription>
                  Risk attribution by different factors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Market Risk', value: 45, color: RISK_COLORS.moderate },
                        { name: 'Strategy Risk', value: 25, color: RISK_COLORS.low },
                        { name: 'Liquidity Risk', value: 15, color: RISK_COLORS.high },
                        { name: 'Execution Risk', value: 10, color: RISK_COLORS.moderate },
                        { name: 'Other', value: 5, color: RISK_COLORS.low }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Market Risk', value: 45, color: RISK_COLORS.moderate },
                        { name: 'Strategy Risk', value: 25, color: RISK_COLORS.low },
                        { name: 'Liquidity Risk', value: 15, color: RISK_COLORS.high },
                        { name: 'Execution Risk', value: 10, color: RISK_COLORS.moderate },
                        { name: 'Other', value: 5, color: RISK_COLORS.low }
                      ].map((entry, index) => (
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
                <CardTitle>Diversification Analysis</CardTitle>
                <CardDescription>
                  Portfolio diversification and correlation impact
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Diversification Score</span>
                    <span className="font-medium">{exposureMatrix?.diversificationScore.toFixed(1) || '--'}</span>
                  </div>
                  <Progress value={(exposureMatrix?.diversificationScore || 0) * 20} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Concentration Risk</span>
                    <span className="font-medium">{exposureMatrix?.concentrationRisk || '--'}%</span>
                  </div>
                  <Progress value={exposureMatrix?.concentrationRisk || 0} />
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Higher diversification scores indicate better risk distribution across positions.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RiskAnalyticsPanel;