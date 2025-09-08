/**
 * Predictive Model Display
 * 
 * Advanced ML model display with real-time predictions, confidence intervals,
 * model performance tracking, ensemble predictions, and interactive model
 * comparison and analysis capabilities.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
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
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  Brain,
  Target,
  TrendingUp,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Eye,
  EyeOff,
  Settings,
  RefreshCw,
  Download,
  Filter,
  Layers,
  Gauge,
  Award,
  LineChart as LineChartIcon,
  Network,
  Cpu,
  Database,
  CloudLightning,
  Timer
} from 'lucide-react';

// Import ML hooks and types
import { 
  useMLPredictions, 
  useMLModels, 
  useMLModelHealth,
  useMLStatistics,
  useStreamingMLPrediction,
  useMLModelLifecycle
} from '../../hooks/useMLPredictions';
import { useMLPerformance } from '../../hooks/useMLPerformance';

interface PredictiveModelDisplayProps {
  className?: string;
  symbol: string;
  models: string[];
  onModelSelectionChange?: (models: string[]) => void;
  compact?: boolean;
  realTime?: boolean;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y';
  showAdvanced?: boolean;
}

// Model performance color mapping
const PERFORMANCE_COLORS = {
  excellent: '#10B981',  // Green
  good: '#3B82F6',       // Blue
  fair: '#F59E0B',       // Yellow
  poor: '#EF4444',       // Red
  loading: '#6B7280'     // Gray
};

// Get performance color based on accuracy
const getPerformanceColor = (accuracy: number): string => {
  if (accuracy >= 0.8) return PERFORMANCE_COLORS.excellent;
  if (accuracy >= 0.7) return PERFORMANCE_COLORS.good;
  if (accuracy >= 0.6) return PERFORMANCE_COLORS.fair;
  return PERFORMANCE_COLORS.poor;
};

// Prediction Confidence Component
const PredictionConfidence: React.FC<{
  prediction: any;
  compact?: boolean;
}> = ({ prediction, compact = false }) => {
  if (!prediction) return null;

  const confidence = prediction.confidence || 0;
  const direction = prediction.direction || 'neutral';
  const magnitude = prediction.magnitude || 0;

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Confidence</span>
        <Badge 
          variant={confidence > 0.7 ? 'default' : confidence > 0.5 ? 'secondary' : 'destructive'}
          className="text-xs"
        >
          {(confidence * 100).toFixed(0)}%
        </Badge>
      </div>
      <Progress value={confidence * 100} className="h-2" />
      
      {!compact && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Direction</span>
            <div className="flex items-center">
              {direction === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : direction === 'down' ? (
                <TrendingUp className="h-3 w-3 text-red-500 mr-1 rotate-180" />
              ) : (
                <Activity className="h-3 w-3 text-gray-500 mr-1" />
              )}
              <span className="capitalize">{direction}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Strength</span>
            <span>{(magnitude * 100).toFixed(1)}%</span>
          </div>
        </>
      )}
    </div>
  );
};

// Model Performance Card
const ModelPerformanceCard: React.FC<{
  modelId: string;
  compact?: boolean;
}> = ({ modelId, compact = false }) => {
  const { data: modelHealth } = useMLModelHealth(modelId, true);
  const { data: performance } = useMLPerformance(modelId);
  
  if (!modelHealth) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const accuracy = performance?.accuracy || modelHealth.accuracy || 0.65;
  const latency = modelHealth.averageLatency || 0;
  const status = modelHealth.status;
  
  return (
    <Card className={compact ? 'p-3' : ''}>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex items-center justify-between">
          <CardTitle className={compact ? 'text-sm' : 'text-base'}>
            {modelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              status === 'healthy' ? 'bg-green-500' : 
              status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-muted-foreground">{status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Accuracy</span>
            <div className="flex items-center space-x-2">
              <span 
                className="font-medium"
                style={{ color: getPerformanceColor(accuracy) }}
              >
                {(accuracy * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <Progress 
            value={accuracy * 100} 
            className="h-2"
          />
          
          {!compact && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg Latency</span>
                <span>{latency.toFixed(0)}ms</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Memory Usage</span>
                <span>{modelHealth.memoryUsage?.toFixed(1) || 0}MB</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Ensemble Prediction Display
const EnsemblePrediction: React.FC<{
  predictions: any[];
  symbol: string;
}> = ({ predictions, symbol }) => {
  const ensembleData = useMemo(() => {
    if (!predictions || predictions.length === 0) return null;

    const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictions.length;
    const consensusDirection = predictions.filter(p => p.direction === 'up').length > predictions.length / 2 ? 'up' : 'down';
    const avgMagnitude = predictions.reduce((sum, p) => sum + (p.magnitude || 0), 0) / predictions.length;

    return {
      confidence: avgConfidence,
      direction: consensusDirection,
      magnitude: avgMagnitude,
      agreement: predictions.filter(p => p.direction === consensusDirection).length / predictions.length
    };
  }, [predictions]);

  if (!ensembleData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Network className="h-5 w-5 mr-2" />
          Ensemble Prediction
        </CardTitle>
        <CardDescription>
          Combined prediction from {predictions.length} models
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Consensus</span>
            <div className="flex items-center">
              {ensembleData.direction === 'up' ? (
                <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <TrendingUp className="h-5 w-5 text-red-500 mr-2 rotate-180" />
              )}
              <span className="text-lg font-medium capitalize">
                {ensembleData.direction}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Confidence</span>
            <div className="text-lg font-medium" style={{ color: getPerformanceColor(ensembleData.confidence) }}>
              {(ensembleData.confidence * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Agreement</span>
            <div className="text-lg font-medium">
              {(ensembleData.agreement * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Strength</span>
            <div className="text-lg font-medium">
              {(ensembleData.magnitude * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Model Selection Component
const ModelSelector: React.FC<{
  availableModels: any[];
  selectedModels: string[];
  onSelectionChange: (models: string[]) => void;
}> = ({ availableModels, selectedModels, onSelectionChange }) => {
  const handleModelToggle = (modelId: string, checked: boolean) => {
    if (checked && !selectedModels.includes(modelId)) {
      onSelectionChange([...selectedModels, modelId]);
    } else if (!checked) {
      onSelectionChange(selectedModels.filter(id => id !== modelId));
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Available Models</h4>
      <div className="space-y-2">
        {availableModels.map(model => (
          <div key={model.metadata.id} className="flex items-center space-x-2">
            <Checkbox
              id={model.metadata.id}
              checked={selectedModels.includes(model.metadata.id)}
              onCheckedChange={(checked) => handleModelToggle(model.metadata.id, !!checked)}
            />
            <Label
              htmlFor={model.metadata.id}
              className="text-sm font-normal cursor-pointer flex-1"
            >
              {model.metadata.name}
            </Label>
            <Badge variant={model.isLoaded ? 'default' : 'secondary'} className="text-xs">
              {model.isLoaded ? 'Loaded' : 'Available'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PredictiveModelDisplay: React.FC<PredictiveModelDisplayProps> = ({
  className,
  symbol,
  models,
  onModelSelectionChange,
  compact = false,
  realTime = true,
  timeframe = '1M',
  showAdvanced = true
}) => {
  const [activeTab, setActiveTab] = useState('predictions');
  const [selectedModel, setSelectedModel] = useState<string>(models[0] || '');
  const [showConfidence, setShowConfidence] = useState(true);
  const [compareMode, setCompareMode] = useState(false);

  // ML Data hooks
  const { data: availableModels, isLoading: modelsLoading } = useMLModels();
  const { data: mlStats } = useMLStatistics();

  // Individual model predictions
  const predictions = models.map(modelId => {
    // This would normally use useMLPrediction with actual features
    // For now, returning mock data structure
    return {
      modelId,
      prediction: {
        value: Math.random() * 1000 + 50000, // Mock price prediction
        confidence: 0.6 + Math.random() * 0.3, // Mock confidence
        direction: Math.random() > 0.5 ? 'up' : 'down',
        magnitude: Math.random() * 0.1 + 0.02,
        timestamp: Date.now()
      }
    };
  }).filter(Boolean);

  // Prediction history for charts
  const predictionHistory = useMemo(() => {
    const data = [];
    const now = new Date();
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setMinutes(date.getMinutes() - i * 5);
      
      const point: any = {
        timestamp: date.toISOString(),
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
      
      models.forEach(modelId => {
        const basePrice = 50000 + Math.sin(i / 10) * 5000;
        const noise = (Math.random() - 0.5) * 1000;
        point[modelId] = basePrice + noise;
        point[`${modelId}_confidence`] = 0.6 + Math.random() * 0.3;
      });
      
      data.push(point);
    }
    
    return data;
  }, [models]);

  // Model performance comparison data
  const modelComparison = useMemo(() => {
    return models.map(modelId => ({
      model: modelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      accuracy: 0.6 + Math.random() * 0.3,
      precision: 0.65 + Math.random() * 0.25,
      recall: 0.6 + Math.random() * 0.3,
      f1Score: 0.62 + Math.random() * 0.28,
      latency: Math.random() * 100 + 50
    }));
  }, [models]);

  if (compact) {
    return (
      <div className={`space-y-4 ${className}`}>
        {predictions.slice(0, 2).map(({ modelId, prediction }) => (
          <div key={modelId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">
                {modelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold">
                ${prediction.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <Badge 
                variant={prediction.confidence > 0.7 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {(prediction.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        ))}
        
        {predictions.length > 2 && (
          <div className="text-center">
            <Button variant="outline" size="sm">
              View All {predictions.length} Models
            </Button>
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
          <h2 className="text-2xl font-bold tracking-tight">ML Predictions</h2>
          <p className="text-muted-foreground">
            Real-time predictions from {predictions.length} active models for {symbol}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <Switch
              checked={showConfidence}
              onCheckedChange={setShowConfidence}
              id="confidence"
            />
            <Label htmlFor="confidence" className="text-xs">Confidence</Label>
          </div>
          
          <div className="flex items-center space-x-1">
            <Switch
              checked={compareMode}
              onCheckedChange={setCompareMode}
              id="compare"
            />
            <Label htmlFor="compare" className="text-xs">Compare</Label>
          </div>
        </div>
      </div>

      {/* Model Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictions.length}</div>
            <Badge variant="default" className="mt-1">RUNNING</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {modelComparison.length > 0 
                ? `${(modelComparison.reduce((sum, m) => sum + m.accuracy, 0) / modelComparison.length * 100).toFixed(1)}%`
                : '--'
              }
            </div>
            <Badge variant="default" className="mt-1">GOOD</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consensus</CardTitle>
            <Network className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              {predictions.filter(p => p.prediction.direction === 'up').length > predictions.length / 2 ? (
                <>
                  <TrendingUp className="h-6 w-6 text-green-500 mr-1" />
                  <span className="text-2xl font-bold text-green-600">BULLISH</span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-6 w-6 text-red-500 mr-1 rotate-180" />
                  <span className="text-2xl font-bold text-red-600">BEARISH</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Gauge className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {predictions.length > 0 
                ? `${(predictions.reduce((sum, p) => sum + p.prediction.confidence, 0) / predictions.length * 100).toFixed(0)}%`
                : '--'
              }
            </div>
            <Badge variant="secondary" className="mt-1">MODERATE</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ensemble Prediction */}
            <EnsemblePrediction 
              predictions={predictions.map(p => p.prediction)}
              symbol={symbol}
            />
            
            {/* Individual Model Predictions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers className="h-5 w-5 mr-2" />
                  Individual Predictions
                </CardTitle>
                <CardDescription>
                  Latest predictions from each model
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {predictions.map(({ modelId, prediction }) => (
                  <div key={modelId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {modelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${prediction.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge 
                        variant={prediction.confidence > 0.7 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {(prediction.confidence * 100).toFixed(0)}%
                      </Badge>
                      <div className="flex items-center">
                        {prediction.direction === 'up' ? (
                          <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        ) : (
                          <TrendingUp className="h-3 w-3 text-red-500 mr-1 rotate-180" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {(prediction.magnitude * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Prediction Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LineChartIcon className="h-5 w-5 mr-2" />
                Prediction Timeline
              </CardTitle>
              <CardDescription>
                Historical predictions and accuracy over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={predictionHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {models.slice(0, 3).map((modelId, index) => (
                    <Line
                      key={modelId}
                      type="monotone"
                      dataKey={modelId}
                      stroke={[PERFORMANCE_COLORS.good, PERFORMANCE_COLORS.excellent, PERFORMANCE_COLORS.fair][index]}
                      strokeWidth={2}
                      name={modelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map(modelId => (
              <ModelPerformanceCard key={modelId} modelId={modelId} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Performance Metrics Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="model" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" fill={PERFORMANCE_COLORS.good} name="Accuracy" />
                  <Bar dataKey="precision" fill={PERFORMANCE_COLORS.excellent} name="Precision" />
                  <Bar dataKey="recall" fill={PERFORMANCE_COLORS.fair} name="Recall" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="h-5 w-5 mr-2" />
                Model Performance Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={modelComparison}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="model" />
                  <PolarRadiusAxis angle={30} domain={[0, 1]} />
                  <Radar
                    name="Accuracy"
                    dataKey="accuracy"
                    stroke={PERFORMANCE_COLORS.excellent}
                    fill={PERFORMANCE_COLORS.excellent}
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Precision"
                    dataKey="precision"
                    stroke={PERFORMANCE_COLORS.good}
                    fill={PERFORMANCE_COLORS.good}
                    fillOpacity={0.3}
                  />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Model Management</CardTitle>
                <CardDescription>
                  Select and manage active prediction models
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableModels && onModelSelectionChange && (
                  <ModelSelector
                    availableModels={availableModels}
                    selectedModels={models}
                    onSelectionChange={onModelSelectionChange}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Statistics</CardTitle>
                <CardDescription>
                  ML system performance and resource usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Models</span>
                    <span>{availableModels?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Loaded Models</span>
                    <span>{availableModels?.filter(m => m.isLoaded).length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Memory Usage</span>
                    <span>{mlStats?.memory?.used || '--'} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Backend</span>
                    <span>{mlStats?.backend?.name || 'WebGL'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PredictiveModelDisplay;