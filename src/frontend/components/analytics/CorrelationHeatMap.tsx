/**
 * Correlation Heat Map
 * 
 * Advanced correlation analysis and visualization component featuring
 * real-time correlation matrix, hierarchical clustering, portfolio risk
 * analysis, and time-series correlation evolution tracking.
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
import { Slider } from '../ui/slider';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  Bar,
  BarChart
} from 'recharts';
import {
  Network,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  EyeOff,
  Filter,
  Download,
  RefreshCw,
  Settings,
  Layers,
  BarChart3,
  Clock,
  Zap,
  Globe,
  Shield
} from 'lucide-react';

interface CorrelationHeatMapProps {
  className?: string;
  symbols: string[];
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y';
  showAdvanced?: boolean;
  realTime?: boolean;
}

// Color scheme for correlation values
const getCorrelationColor = (correlation: number): string => {
  const abs = Math.abs(correlation);
  if (abs >= 0.8) return correlation > 0 ? '#DC2626' : '#1D4ED8'; // Strong positive/negative
  if (abs >= 0.6) return correlation > 0 ? '#EA580C' : '#2563EB'; // Moderate positive/negative
  if (abs >= 0.4) return correlation > 0 ? '#F59E0B' : '#3B82F6'; // Weak positive/negative
  if (abs >= 0.2) return correlation > 0 ? '#FDE047' : '#93C5FD'; // Very weak positive/negative
  return '#6B7280'; // No correlation
};

// Get correlation level description
const getCorrelationLevel = (correlation: number): { level: string; risk: string } => {
  const abs = Math.abs(correlation);
  if (abs >= 0.8) return { level: 'Very Strong', risk: 'High Risk' };
  if (abs >= 0.6) return { level: 'Strong', risk: 'Medium Risk' };
  if (abs >= 0.4) return { level: 'Moderate', risk: 'Low Risk' };
  if (abs >= 0.2) return { level: 'Weak', risk: 'Very Low Risk' };
  return { level: 'None', risk: 'No Risk' };
};

// Generate mock correlation data
const generateCorrelationData = (symbols: string[], timeframe: string) => {
  const n = symbols.length;
  const correlationMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
  
  // Generate symmetric correlation matrix
  for (let i = 0; i < n; i++) {
    correlationMatrix[i][i] = 1; // Perfect self-correlation
    for (let j = i + 1; j < n; j++) {
      // Create more realistic correlations based on asset types
      let baseCorrel = 0;
      if (symbols[i].includes('BTC') && symbols[j].includes('ETH')) baseCorrel = 0.7;
      else if (symbols[i].includes('BTC') || symbols[j].includes('BTC')) baseCorrel = 0.4;
      else if (symbols[i].includes('USD') && symbols[j].includes('USD')) baseCorrel = 0.3;
      
      const correlation = baseCorrel + (Math.random() - 0.5) * 0.4;
      const clampedCorrel = Math.max(-0.95, Math.min(0.95, correlation));
      
      correlationMatrix[i][j] = clampedCorrel;
      correlationMatrix[j][i] = clampedCorrel;
    }
  }

  // Historical correlation data
  const history = [];
  for (let days = 30; days >= 0; days--) {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const point: any = {
      date: date.toISOString().split('T')[0],
      timestamp: date.getTime()
    };
    
    // Add correlation evolution for key pairs
    for (let i = 0; i < Math.min(symbols.length, 3); i++) {
      for (let j = i + 1; j < Math.min(symbols.length, 3); j++) {
        const pairKey = `${symbols[i]}_${symbols[j]}`;
        const baseCorrel = correlationMatrix[i][j];
        const noise = Math.sin(days / 10) * 0.1 + (Math.random() - 0.5) * 0.05;
        point[pairKey] = Math.max(-1, Math.min(1, baseCorrel + noise));
      }
    }
    
    history.push(point);
  }

  // Risk metrics
  const avgCorrelation = correlationMatrix.flat().reduce((sum, val, idx) => {
    if (idx % (n + 1) === 0) return sum; // Skip diagonal
    return sum + Math.abs(val);
  }, 0) / (n * n - n);

  const maxCorrelation = Math.max(...correlationMatrix.flat().filter((_, idx) => idx % (n + 1) !== 0));
  const minCorrelation = Math.min(...correlationMatrix.flat().filter((_, idx) => idx % (n + 1) !== 0));

  // Portfolio diversification score
  const diversificationScore = Math.max(0, 1 - avgCorrelation);

  return {
    matrix: correlationMatrix,
    symbols,
    avgCorrelation,
    maxCorrelation,
    minCorrelation,
    diversificationScore,
    history,
    riskMetrics: {
      concentrationRisk: maxCorrelation * 100,
      diversificationBenefit: diversificationScore * 100,
      correlationStability: 85 + Math.random() * 10,
      timeVaryingRisk: avgCorrelation > 0.6 ? 'High' : avgCorrelation > 0.3 ? 'Medium' : 'Low'
    }
  };
};

// Heatmap Cell Component
const HeatmapCell: React.FC<{
  correlation: number;
  symbolX: string;
  symbolY: string;
  size: number;
}> = ({ correlation, symbolX, symbolY, size }) => {
  const color = getCorrelationColor(correlation);
  const { level } = getCorrelationLevel(correlation);
  
  return (
    <div
      className="flex items-center justify-center text-white font-semibold text-xs cursor-pointer transition-all hover:scale-105"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size < 40 ? '10px' : '12px'
      }}
      title={`${symbolX} vs ${symbolY}: ${correlation.toFixed(3)} (${level})`}
    >
      {correlation === 1 ? '1.00' : correlation.toFixed(2)}
    </div>
  );
};

// Correlation Matrix Heatmap
const CorrelationMatrix: React.FC<{
  correlationData: any;
  compact?: boolean;
}> = ({ correlationData, compact = false }) => {
  const { matrix, symbols } = correlationData;
  const cellSize = compact ? 30 : 50;
  
  return (
    <div className="space-y-4">
      <div className="overflow-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex">
            <div style={{ width: cellSize, height: cellSize }} className="border border-gray-200" />
            {symbols.map(symbol => (
              <div
                key={symbol}
                className="flex items-center justify-center bg-gray-100 border border-gray-200 text-xs font-semibold"
                style={{ width: cellSize, height: cellSize, fontSize: cellSize < 40 ? '8px' : '10px' }}
              >
                {symbol.replace('-USD', '').substring(0, 4)}
              </div>
            ))}
          </div>
          
          {/* Data rows */}
          {symbols.map((symbolY, i) => (
            <div key={symbolY} className="flex">
              <div
                className="flex items-center justify-center bg-gray-100 border border-gray-200 text-xs font-semibold"
                style={{ width: cellSize, height: cellSize, fontSize: cellSize < 40 ? '8px' : '10px' }}
              >
                {symbolY.replace('-USD', '').substring(0, 4)}
              </div>
              {symbols.map((symbolX, j) => (
                <HeatmapCell
                  key={`${symbolX}-${symbolY}`}
                  correlation={matrix[i][j]}
                  symbolX={symbolX}
                  symbolY={symbolY}
                  size={cellSize}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Color Legend */}
      <div className="flex items-center justify-center space-x-4 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-blue-600" />
          <span>Strong Negative</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-blue-300" />
          <span>Weak Negative</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-gray-400" />
          <span>No Correlation</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-yellow-400" />
          <span>Weak Positive</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 bg-red-600" />
          <span>Strong Positive</span>
        </div>
      </div>
    </div>
  );
};

// Correlation Statistics Component
const CorrelationStats: React.FC<{
  correlationData: any;
}> = ({ correlationData }) => {
  const { avgCorrelation, maxCorrelation, minCorrelation, riskMetrics } = correlationData;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Average Correlation:</span>
            <span className="font-medium">{avgCorrelation.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Highest Correlation:</span>
            <span className="font-medium text-red-600">{maxCorrelation.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Lowest Correlation:</span>
            <span className="font-medium text-blue-600">{minCorrelation.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Diversification Score:</span>
            <span className="font-medium text-green-600">
              {(correlationData.diversificationScore * 100).toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Indicators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Concentration Risk:</span>
            <Badge variant={riskMetrics.concentrationRisk > 60 ? 'destructive' : 'secondary'}>
              {riskMetrics.concentrationRisk.toFixed(0)}%
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Diversification Benefit:</span>
            <Badge variant="default">
              {riskMetrics.diversificationBenefit.toFixed(0)}%
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Stability:</span>
            <Badge variant="secondary">
              {riskMetrics.correlationStability.toFixed(0)}%
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Time-Varying Risk:</span>
            <Badge variant={
              riskMetrics.timeVaryingRisk === 'High' ? 'destructive' :
              riskMetrics.timeVaryingRisk === 'Medium' ? 'secondary' : 'default'
            }>
              {riskMetrics.timeVaryingRisk}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const CorrelationHeatMap: React.FC<CorrelationHeatMapProps> = ({
  className,
  symbols,
  timeframe = '1M',
  showAdvanced = true,
  realTime = true
}) => {
  const [activeTab, setActiveTab] = useState('matrix');
  const [correlationPeriod, setCorrelationPeriod] = useState('30');
  const [showLabels, setShowLabels] = useState(true);
  const [filterThreshold, setFilterThreshold] = useState([0]);

  // Generate correlation data
  const correlationData = useMemo(() => generateCorrelationData(symbols, timeframe), [symbols, timeframe]);

  // Filtered correlations for analysis
  const significantCorrelations = useMemo(() => {
    const threshold = filterThreshold[0] / 100;
    const correlations = [];
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const correlation = correlationData.matrix[i][j];
        if (Math.abs(correlation) >= threshold) {
          const { level, risk } = getCorrelationLevel(correlation);
          correlations.push({
            pair: `${symbols[i]} / ${symbols[j]}`,
            correlation,
            level,
            risk,
            color: getCorrelationColor(correlation)
          });
        }
      }
    }
    
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [correlationData, filterThreshold, symbols]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Correlation Analysis</h2>
          <p className="text-muted-foreground">
            Portfolio correlation matrix and risk analysis for {symbols.length} assets
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={correlationPeriod} onValueChange={setCorrelationPeriod}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7d</SelectItem>
              <SelectItem value="14">14d</SelectItem>
              <SelectItem value="30">30d</SelectItem>
              <SelectItem value="60">60d</SelectItem>
              <SelectItem value="90">90d</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-1">
            <Switch
              checked={showLabels}
              onCheckedChange={setShowLabels}
              id="labels"
            />
            <Label htmlFor="labels" className="text-xs">Labels</Label>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Correlation</CardTitle>
            <Network className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {correlationData.avgCorrelation.toFixed(3)}
            </div>
            <Badge variant="secondary" className="mt-1">
              {getCorrelationLevel(correlationData.avgCorrelation).level}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Correlation</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {correlationData.maxCorrelation.toFixed(3)}
            </div>
            <Badge variant="destructive" className="mt-1">
              {getCorrelationLevel(correlationData.maxCorrelation).risk}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diversification</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(correlationData.diversificationScore * 100).toFixed(0)}%
            </div>
            <Badge variant="default" className="mt-1">GOOD</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {correlationData.riskMetrics.timeVaryingRisk}
            </div>
            <Badge variant="secondary" className="mt-1">
              {correlationData.riskMetrics.correlationStability.toFixed(0)}% Stable
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="matrix">Correlation Matrix</TabsTrigger>
          <TabsTrigger value="analysis">Risk Analysis</TabsTrigger>
          <TabsTrigger value="evolution">Time Evolution</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="h-5 w-5 mr-2" />
                Correlation Matrix Heatmap
              </CardTitle>
              <CardDescription>
                {correlationPeriod}-day rolling correlation between assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CorrelationMatrix correlationData={correlationData} />
            </CardContent>
          </Card>

          <CorrelationStats correlationData={correlationData} />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Significant Correlations
                  </CardTitle>
                  <CardDescription>
                    Asset pairs with notable correlations
                  </CardDescription>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="threshold" className="text-xs">
                    Min Threshold: {filterThreshold[0]}%
                  </Label>
                  <Slider
                    id="threshold"
                    min={0}
                    max={80}
                    step={5}
                    value={filterThreshold}
                    onValueChange={setFilterThreshold}
                    className="w-32"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {significantCorrelations.slice(0, 10).map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <div className="font-medium">{item.pair}</div>
                        <div className="text-xs text-muted-foreground">{item.level} Correlation</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{item.correlation.toFixed(3)}</div>
                      <Badge 
                        variant={
                          item.risk === 'High Risk' ? 'destructive' :
                          item.risk === 'Medium Risk' ? 'secondary' : 'default'
                        }
                        className="text-xs"
                      >
                        {item.risk}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Correlation Evolution
              </CardTitle>
              <CardDescription>
                How correlations have changed over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={correlationData.history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[-1, 1]} />
                  <Tooltip />
                  <Legend />
                  {Object.keys(correlationData.history[0] || {})
                    .filter(key => key !== 'date' && key !== 'timestamp')
                    .slice(0, 5)
                    .map((key, index) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'][index]}
                        strokeWidth={2}
                        name={key.replace('_', ' vs ')}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                Asset Clustering
              </CardTitle>
              <CardDescription>
                Assets grouped by correlation similarity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Mock clusters based on correlation patterns */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-600">Crypto Majors</h4>
                  <div className="space-y-1">
                    {symbols.filter(s => s.includes('BTC') || s.includes('ETH')).map(symbol => (
                      <div key={symbol} className="text-sm p-2 bg-blue-50 rounded">
                        {symbol}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Avg correlation: 0.72
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 text-green-600">Altcoins</h4>
                  <div className="space-y-1">
                    {symbols.filter(s => !s.includes('BTC') && !s.includes('ETH')).slice(0, 3).map(symbol => (
                      <div key={symbol} className="text-sm p-2 bg-green-50 rounded">
                        {symbol}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Avg correlation: 0.45
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 text-orange-600">Independent</h4>
                  <div className="space-y-1">
                    {symbols.slice(-2).map(symbol => (
                      <div key={symbol} className="text-sm p-2 bg-orange-50 rounded">
                        {symbol}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Avg correlation: 0.21
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CorrelationHeatMap;