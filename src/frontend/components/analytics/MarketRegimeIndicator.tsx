/**
 * Market Regime Indicator
 * 
 * Advanced market regime detection and visualization component featuring
 * real-time regime classification, transition probabilities, historical
 * regime analysis, and ML-powered regime prediction capabilities.
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
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Eye,
  BarChart3,
  Gauge,
  Clock,
  Target,
  Zap,
  RefreshCw,
  Filter,
  Brain,
  Network,
  Layers,
  Calendar,
  Settings
} from 'lucide-react';

// Import hooks (these would be implemented)
// import { useMarketRegime, useRegimeTransitions, useRegimePredictions } from '../../hooks/useMarketRegime';

interface MarketRegimeIndicatorProps {
  className?: string;
  symbol: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y';
  compact?: boolean;
  showTransitions?: boolean;
  showProbabilities?: boolean;
  advanced?: boolean;
}

// Market regime definitions
const MARKET_REGIMES = {
  bullish: {
    name: 'Bullish Trend',
    color: '#10B981', // Green
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'Strong upward momentum with low volatility'
  },
  bearish: {
    name: 'Bearish Trend',
    color: '#EF4444', // Red
    icon: <TrendingDown className="h-4 w-4" />,
    description: 'Downward trend with increasing selling pressure'
  },
  sideways: {
    name: 'Sideways/Range',
    color: '#F59E0B', // Yellow
    icon: <Activity className="h-4 w-4" />,
    description: 'Consolidation phase with no clear direction'
  },
  volatile: {
    name: 'High Volatility',
    color: '#8B5CF6', // Purple
    icon: <Zap className="h-4 w-4" />,
    description: 'Increased volatility with uncertain direction'
  },
  accumulation: {
    name: 'Accumulation',
    color: '#06B6D4', // Cyan
    icon: <Target className="h-4 w-4" />,
    description: 'Smart money accumulation phase'
  },
  distribution: {
    name: 'Distribution',
    color: '#F97316', // Orange
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Smart money distribution phase'
  }
} as const;

type RegimeType = keyof typeof MARKET_REGIMES;

// Mock data generator for regime detection
const generateRegimeData = (symbol: string, timeframe: string) => {
  const current = Date.now();
  const regimes: RegimeType[] = ['bullish', 'bearish', 'sideways', 'volatile', 'accumulation', 'distribution'];
  
  // Current regime detection (mock)
  const currentRegime = regimes[Math.floor(Math.random() * regimes.length)];
  const confidence = 0.6 + Math.random() * 0.3;
  
  // Regime probabilities (mock)
  const probabilities = regimes.reduce((acc, regime) => {
    acc[regime] = regime === currentRegime ? confidence : (1 - confidence) / (regimes.length - 1);
    return acc;
  }, {} as Record<RegimeType, number>);
  
  // Historical regime data
  const history = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(current - i * 24 * 60 * 60 * 1000);
    const regime = regimes[Math.floor(Math.sin(i / 10) * 2 + Math.random()) % regimes.length];
    history.push({
      date: date.toISOString().split('T')[0],
      regime,
      confidence: 0.5 + Math.random() * 0.4,
      volatility: 15 + Math.sin(i / 5) * 10 + Math.random() * 5,
      momentum: Math.sin(i / 7) * 50 + Math.random() * 20 - 10,
      volume: 1000000 + Math.random() * 500000
    });
  }
  
  // Transition matrix (mock)
  const transitions = regimes.map(from => ({
    from,
    transitions: regimes.map(to => ({
      to,
      probability: from === to ? 0.7 : (0.3 / (regimes.length - 1))
    }))
  }));
  
  return {
    current: {
      regime: currentRegime,
      confidence,
      duration: Math.floor(Math.random() * 10) + 1, // days
      strength: Math.random() * 100,
      lastChange: new Date(current - Math.random() * 7 * 24 * 60 * 60 * 1000)
    },
    probabilities,
    history,
    transitions,
    indicators: {
      trendStrength: Math.random() * 100,
      volatilityIndex: 15 + Math.random() * 25,
      momentumScore: Math.random() * 100,
      volumeProfile: Math.random() * 100
    }
  };
};

// Regime Probability Display
const RegimeProbabilities: React.FC<{
  probabilities: Record<RegimeType, number>;
  compact?: boolean;
}> = ({ probabilities, compact = false }) => {
  const sortedRegimes = Object.entries(probabilities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, compact ? 3 : 6);

  return (
    <div className="space-y-3">
      {sortedRegimes.map(([regime, probability]) => {
        const regimeInfo = MARKET_REGIMES[regime as RegimeType];
        return (
          <div key={regime} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div style={{ color: regimeInfo.color }}>
                  {regimeInfo.icon}
                </div>
                <span className="text-sm font-medium">{regimeInfo.name}</span>
              </div>
              <span className="text-sm font-medium" style={{ color: regimeInfo.color }}>
                {(probability * 100).toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={probability * 100} 
              className="h-2"
              style={{ backgroundColor: `${regimeInfo.color}20` }}
            />
          </div>
        );
      })}
    </div>
  );
};

// Regime Transition Chart
const RegimeTransitions: React.FC<{
  transitions: any[];
  compact?: boolean;
}> = ({ transitions, compact = false }) => {
  const transitionData = useMemo(() => {
    return transitions.flatMap(({ from, transitions: trans }) =>
      trans.map(({ to, probability }) => ({
        from,
        to,
        probability,
        fromColor: MARKET_REGIMES[from as RegimeType].color,
        toColor: MARKET_REGIMES[to as RegimeType].color
      }))
    ).filter(t => t.probability > 0.1); // Only show significant transitions
  }, [transitions]);

  if (compact) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Top Transitions</h4>
        {transitionData.slice(0, 3).map((transition, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <span>{MARKET_REGIMES[transition.from as RegimeType].name}</span>
              <span>→</span>
              <span>{MARKET_REGIMES[transition.to as RegimeType].name}</span>
            </div>
            <span className="font-medium">{(transition.probability * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={transitionData.slice(0, 10)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="from" />
          <YAxis />
          <Tooltip 
            formatter={(value: any) => [`${(value * 100).toFixed(1)}%`, 'Probability']}
            labelFormatter={(label) => `From ${label}`}
          />
          <Bar dataKey="probability" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MarketRegimeIndicator: React.FC<MarketRegimeIndicatorProps> = ({
  className,
  symbol,
  timeframe = '1M',
  compact = false,
  showTransitions = true,
  showProbabilities = true,
  advanced = true
}) => {
  const [activeTab, setActiveTab] = useState('current');
  const [detectionModel, setDetectionModel] = useState('ensemble');
  const [refreshInterval, setRefreshInterval] = useState('real-time');

  // Generate mock regime data
  const regimeData = useMemo(() => generateRegimeData(symbol, timeframe), [symbol, timeframe]);
  
  const currentRegimeInfo = MARKET_REGIMES[regimeData.current.regime];

  if (compact) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Current Regime Display */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border">
          <div className="flex items-center space-x-3">
            <div 
              className="p-2 rounded-full"
              style={{ backgroundColor: `${currentRegimeInfo.color}20`, color: currentRegimeInfo.color }}
            >
              {currentRegimeInfo.icon}
            </div>
            <div>
              <div className="font-semibold text-lg">{currentRegimeInfo.name}</div>
              <div className="text-sm text-muted-foreground">{currentRegimeInfo.description}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: currentRegimeInfo.color }}>
              {(regimeData.current.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Confidence</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold">{regimeData.current.duration}d</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{regimeData.current.strength.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Strength</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{regimeData.indicators.volatilityIndex.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Volatility</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Market Regime Analysis</h2>
          <p className="text-muted-foreground">
            AI-powered market regime detection for {symbol}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={detectionModel} onValueChange={setDetectionModel}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ensemble">Ensemble</SelectItem>
              <SelectItem value="ml-enhanced">ML Enhanced</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="fundamental">Fundamental</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={refreshInterval} onValueChange={setRefreshInterval}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="real-time">Real-time</SelectItem>
              <SelectItem value="1m">1 minute</SelectItem>
              <SelectItem value="5m">5 minutes</SelectItem>
              <SelectItem value="15m">15 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current Regime Status */}
      <Card className="border-2" style={{ borderColor: `${currentRegimeInfo.color}40` }}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="p-4 rounded-full"
                style={{ backgroundColor: `${currentRegimeInfo.color}20`, color: currentRegimeInfo.color }}
              >
                <Globe className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold" style={{ color: currentRegimeInfo.color }}>
                  {currentRegimeInfo.name}
                </h3>
                <p className="text-muted-foreground mt-1">{currentRegimeInfo.description}</p>
                <div className="flex items-center space-x-4 mt-2">
                  <Badge variant="secondary">
                    Duration: {regimeData.current.duration} days
                  </Badge>
                  <Badge variant="outline">
                    Last changed: {regimeData.current.lastChange.toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-4xl font-bold" style={{ color: currentRegimeInfo.color }}>
                {(regimeData.current.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Confidence</div>
              <Progress 
                value={regimeData.current.confidence * 100} 
                className="w-24 h-2 mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend Strength</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regimeData.indicators.trendStrength.toFixed(0)}</div>
            <Progress value={regimeData.indicators.trendStrength} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volatility Index</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regimeData.indicators.volatilityIndex.toFixed(1)}%</div>
            <Progress value={regimeData.indicators.volatilityIndex * 2} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Momentum Score</CardTitle>
            <Zap className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regimeData.indicators.momentumScore.toFixed(0)}</div>
            <Progress value={regimeData.indicators.momentumScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume Profile</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regimeData.indicators.volumeProfile.toFixed(0)}</div>
            <Progress value={regimeData.indicators.volumeProfile} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current">Current Status</TabsTrigger>
          <TabsTrigger value="probabilities">Probabilities</TabsTrigger>
          <TabsTrigger value="history">Historical</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gauge className="h-5 w-5 mr-2" />
                  Regime Strength Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={[
                    {
                      metric: 'Trend Strength',
                      value: regimeData.indicators.trendStrength,
                      fullMark: 100
                    },
                    {
                      metric: 'Momentum',
                      value: regimeData.indicators.momentumScore,
                      fullMark: 100
                    },
                    {
                      metric: 'Volume Confirmation',
                      value: regimeData.indicators.volumeProfile,
                      fullMark: 100
                    },
                    {
                      metric: 'Volatility Control',
                      value: 100 - regimeData.indicators.volatilityIndex * 2,
                      fullMark: 100
                    },
                    {
                      metric: 'Confidence',
                      value: regimeData.current.confidence * 100,
                      fullMark: 100
                    }
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={18} domain={[0, 100]} />
                    <Radar
                      name="Current Regime"
                      dataKey="value"
                      stroke={currentRegimeInfo.color}
                      fill={currentRegimeInfo.color}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Regime Characteristics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Primary Signal</span>
                    <Badge style={{ backgroundColor: currentRegimeInfo.color, color: 'white' }}>
                      {currentRegimeInfo.name}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Signal Strength</span>
                    <span className="font-medium">{regimeData.current.strength.toFixed(0)}/100</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Regime Duration</span>
                    <span className="font-medium">{regimeData.current.duration} days</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Expected Duration</span>
                    <span className="font-medium">5-15 days</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Transition Risk</span>
                    <Badge variant={regimeData.current.confidence > 0.7 ? 'default' : 'destructive'}>
                      {regimeData.current.confidence > 0.7 ? 'Low' : 'Medium'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="probabilities" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  Regime Probabilities
                </CardTitle>
                <CardDescription>
                  ML-calculated probability for each market regime
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RegimeProbabilities probabilities={regimeData.probabilities} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers className="h-5 w-5 mr-2" />
                  Probability Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(regimeData.probabilities).map(([regime, prob]) => ({
                        name: MARKET_REGIMES[regime as RegimeType].name,
                        value: prob,
                        color: MARKET_REGIMES[regime as RegimeType].color
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {Object.entries(regimeData.probabilities).map(([regime, prob], index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={MARKET_REGIMES[regime as RegimeType].color} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Regime Evolution
              </CardTitle>
              <CardDescription>
                Historical regime changes and market conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={regimeData.history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="volatility"
                    fill="#8884d8"
                    stroke="#8884d8"
                    fillOpacity={0.3}
                    name="Volatility %"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="momentum"
                    stroke="#82ca9d"
                    name="Momentum"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="confidence"
                    fill="#ffc658"
                    name="Confidence"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transitions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="h-5 w-5 mr-2" />
                Regime Transition Analysis
              </CardTitle>
              <CardDescription>
                Probability matrix for regime transitions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegimeTransitions transitions={regimeData.transitions} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketRegimeIndicator;