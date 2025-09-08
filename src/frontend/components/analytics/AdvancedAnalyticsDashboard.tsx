/**
 * Advanced Analytics Dashboard
 * 
 * Comprehensive advanced analytics dashboard integrating ML models, risk systems,
 * and performance analytics into a professional-grade analytical interface.
 * Features real-time analytics, predictive displays, market regime detection,
 * and advanced visualization capabilities.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { 
  Brain, 
  BarChart3, 
  Shield, 
  TrendingUp, 
  Activity, 
  Target,
  AlertCircle,
  RefreshCw,
  Download,
  Settings,
  Maximize2,
  Minimize2,
  Zap,
  Eye,
  EyeOff,
  Network,
  Gauge,
  Globe,
  LineChart,
  PieChart,
  Layers,
  Clock,
  Filter
} from 'lucide-react';

// Import our specialized analytics components
import { RiskAnalyticsPanel } from './RiskAnalyticsPanel';
import { PredictiveModelDisplay } from './PredictiveModelDisplay';
import { MarketRegimeIndicator } from './MarketRegimeIndicator';
import { CorrelationHeatMap } from './CorrelationHeatMap';
import { PerformanceAnalyticsDashboard } from './PerformanceAnalyticsDashboard';
import { RiskMetrics } from './RiskMetrics';

// Import hooks
import { useMLPredictions, useMLModels, useMLStatistics } from '../../hooks/useMLPredictions';
import { useRiskData, useRiskMetrics, useExposureMatrix } from '../../hooks/useRiskData';
import { usePerformanceData } from '../../hooks/usePerformanceData';

interface AdvancedAnalyticsDashboardProps {
  className?: string;
}

// Dashboard layout configurations for different user types
const LAYOUT_PRESETS = {
  quantitative: {
    name: 'Quantitative Analyst',
    tabs: ['overview', 'ml-predictions', 'risk-analytics', 'correlations', 'regime-analysis'],
    defaultTab: 'ml-predictions',
    features: ['advanced-models', 'risk-decomposition', 'regime-detection', 'correlation-analysis']
  },
  trader: {
    name: 'Active Trader',
    tabs: ['overview', 'ml-predictions', 'market-regime', 'risk-analytics'],
    defaultTab: 'overview',
    features: ['real-time-predictions', 'regime-alerts', 'risk-monitoring']
  },
  riskManager: {
    name: 'Risk Manager',
    tabs: ['overview', 'risk-analytics', 'correlations', 'exposure-analysis'],
    defaultTab: 'risk-analytics',
    features: ['risk-decomposition', 'correlation-analysis', 'exposure-monitoring', 'stress-testing']
  },
  portfolioManager: {
    name: 'Portfolio Manager',
    tabs: ['overview', 'performance', 'risk-analytics', 'correlations', 'ml-predictions'],
    defaultTab: 'overview',
    features: ['portfolio-optimization', 'performance-attribution', 'risk-budgeting']
  },
  researcher: {
    name: 'Research Analyst',
    tabs: ['ml-predictions', 'regime-analysis', 'correlations', 'model-performance'],
    defaultTab: 'ml-predictions',
    features: ['model-comparison', 'regime-research', 'factor-analysis', 'backtesting']
  }
};

// Real-time update intervals for different data types
const UPDATE_INTERVALS = {
  predictions: 3000,    // 3 seconds for ML predictions
  risk: 5000,          // 5 seconds for risk metrics
  regime: 10000,       // 10 seconds for regime detection
  correlations: 30000   // 30 seconds for correlations (slower changing)
};

export const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  className
}) => {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [layoutPreset, setLayoutPreset] = useState<keyof typeof LAYOUT_PRESETS>('quantitative');
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');
  const [symbol, setSymbol] = useState('BTC-USD');
  const [selectedModels, setSelectedModels] = useState<string[]>(['price-prediction', 'volatility-forecast', 'regime-detection']);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Current layout configuration
  const currentLayout = LAYOUT_PRESETS[layoutPreset];

  // Data hooks - ML Infrastructure
  const { data: mlModels, isLoading: modelsLoading } = useMLModels();
  const { data: mlStats } = useMLStatistics();

  // Risk data hooks
  const { data: riskMetrics, isLoading: riskLoading, error: riskError } = useRiskMetrics();
  const { data: exposureMatrix, isLoading: exposureLoading } = useExposureMatrix();

  // Performance data hooks
  const {
    performanceOverview,
    isLoading: performanceLoading,
    refreshAllData
  } = usePerformanceData({
    timeframe,
    enableRealTime: realTimeUpdates,
    refreshInterval: UPDATE_INTERVALS.predictions
  });

  // Derived analytics data
  const analyticsOverview = useMemo(() => {
    if (!riskMetrics || !performanceOverview || !mlStats) return null;

    const activeModelsCount = mlModels?.filter(m => m.isLoaded).length || 0;
    const predictionAccuracy = 0.72; // Would be calculated from model performance
    const riskScore = Math.round(100 - (Math.abs(riskMetrics.maxDrawdown) * 2 + riskMetrics.volatility));
    const mlPerformanceScore = predictionAccuracy * 100;

    return {
      totalModels: mlModels?.length || 0,
      activeModels: activeModelsCount,
      predictionAccuracy,
      riskScore,
      mlPerformanceScore,
      regimeConfidence: 0.85, // Would come from regime model
      correlationRisk: exposureMatrix?.concentrationRisk || 0
    };
  }, [riskMetrics, performanceOverview, mlStats, mlModels, exposureMatrix]);

  // Handle model selection
  const handleModelSelection = useCallback((models: string[]) => {
    setSelectedModels(models);
  }, []);

  // Handle real-time toggle
  const handleRealTimeToggle = useCallback((enabled: boolean) => {
    setRealTimeUpdates(enabled);
  }, []);

  // Handle refresh all data
  const handleRefreshAll = useCallback(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Error state
  const hasError = riskError || performanceLoading === false && !performanceOverview;
  const isLoading = modelsLoading || riskLoading || performanceLoading;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 ${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ML-powered trading analytics and risk management
                </p>
              </div>
            </div>

            {analyticsOverview && (
              <div className="flex items-center space-x-6 ml-8 px-4 border-l border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Network className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{analyticsOverview.activeModels}/{analyticsOverview.totalModels}</span>
                  </div>
                  <span className="text-xs text-gray-500">models active</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">{(analyticsOverview.predictionAccuracy * 100).toFixed(1)}%</span>
                  </div>
                  <span className="text-xs text-gray-500">accuracy</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Shield className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">{analyticsOverview.riskScore}/100</span>
                  </div>
                  <span className="text-xs text-gray-500">risk score</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Layout Preset Selector */}
            <Select value={layoutPreset} onValueChange={(value) => setLayoutPreset(value as any)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYOUT_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Symbol Selector */}
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                <SelectItem value="AVAX-USD">AVAX-USD</SelectItem>
              </SelectContent>
            </Select>

            {/* Timeframe Selector */}
            <Select value={timeframe} onValueChange={(value) => setTimeframe(value as any)}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1D">1D</SelectItem>
                <SelectItem value="1W">1W</SelectItem>
                <SelectItem value="1M">1M</SelectItem>
                <SelectItem value="3M">3M</SelectItem>
                <SelectItem value="1Y">1Y</SelectItem>
              </SelectContent>
            </Select>

            {/* Real-time Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={realTimeUpdates}
                onCheckedChange={handleRealTimeToggle}
                id="realtime"
              />
              <Label htmlFor="realtime" className="text-xs">
                Live
              </Label>
            </div>

            {/* Advanced Mode Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={advancedMode}
                onCheckedChange={setAdvancedMode}
                id="advanced"
              />
              <Label htmlFor="advanced" className="text-xs">
                Advanced
              </Label>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {hasError && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center space-y-2">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Analytics Data Error</h3>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Unable to load analytics data. Please check connections and try again.
                </p>
                <Button onClick={handleRefreshAll} variant="outline" size="sm" className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-5">
            {currentLayout.tabs.includes('overview') && (
              <TabsTrigger value="overview" className="flex items-center">
                <BarChart3 className="h-4 w-4 mr-1" />
                Overview
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('ml-predictions') && (
              <TabsTrigger value="ml-predictions" className="flex items-center">
                <Brain className="h-4 w-4 mr-1" />
                ML Models
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('risk-analytics') && (
              <TabsTrigger value="risk-analytics" className="flex items-center">
                <Shield className="h-4 w-4 mr-1" />
                Risk Analytics
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('market-regime') && (
              <TabsTrigger value="market-regime" className="flex items-center">
                <Globe className="h-4 w-4 mr-1" />
                Market Regime
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('correlations') && (
              <TabsTrigger value="correlations" className="flex items-center">
                <Network className="h-4 w-4 mr-1" />
                Correlations
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          {currentLayout.tabs.includes('overview') && (
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Analytics Summary Cards */}
                <div className="lg:col-span-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active ML Models</CardTitle>
                        <Brain className="h-4 w-4 text-blue-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {analyticsOverview?.activeModels || 0}/{analyticsOverview?.totalModels || 0}
                        </div>
                        <Badge variant="secondary" className="mt-2">
                          {analyticsOverview?.activeModels ? 'ACTIVE' : 'LOADING'}
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Prediction Accuracy</CardTitle>
                        <Target className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {analyticsOverview ? `${(analyticsOverview.predictionAccuracy * 100).toFixed(1)}%` : '--'}
                        </div>
                        <Badge variant="default" className="mt-2">
                          GOOD
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                        <Shield className="h-4 w-4 text-orange-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          {analyticsOverview?.riskScore || '--'}/100
                        </div>
                        <Badge variant="secondary" className="mt-2">
                          MODERATE
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Regime Confidence</CardTitle>
                        <Gauge className="h-4 w-4 text-purple-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                          {analyticsOverview ? `${(analyticsOverview.regimeConfidence * 100).toFixed(0)}%` : '--'}
                        </div>
                        <Badge variant="default" className="mt-2">
                          HIGH
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Integrated Components Preview */}
                <div className="lg:col-span-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Brain className="h-5 w-5 mr-2" />
                        ML Predictions Preview
                      </CardTitle>
                      <CardDescription>
                        Latest predictions from active models
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PredictiveModelDisplay
                        symbol={symbol}
                        models={selectedModels}
                        compact={true}
                        realTime={realTimeUpdates}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Globe className="h-5 w-5 mr-2" />
                        Market Regime Status
                      </CardTitle>
                      <CardDescription>
                        Current market conditions and regime detection
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MarketRegimeIndicator
                        symbol={symbol}
                        compact={true}
                        showTransitions={false}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-12">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Shield className="h-5 w-5 mr-2" />
                        Risk Analytics Summary
                      </CardTitle>
                      <CardDescription>
                        Key risk metrics and exposure analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RiskAnalyticsPanel
                        timeframe={timeframe}
                        compact={true}
                        showAdvanced={advancedMode}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ML Predictions Tab */}
          {currentLayout.tabs.includes('ml-predictions') && (
            <TabsContent value="ml-predictions" className="space-y-6">
              <PredictiveModelDisplay
                symbol={symbol}
                models={selectedModels}
                onModelSelectionChange={handleModelSelection}
                realTime={realTimeUpdates}
                timeframe={timeframe}
                showAdvanced={advancedMode}
              />
            </TabsContent>
          )}

          {/* Risk Analytics Tab */}
          {currentLayout.tabs.includes('risk-analytics') && (
            <TabsContent value="risk-analytics" className="space-y-6">
              <RiskAnalyticsPanel
                timeframe={timeframe}
                symbol={symbol}
                showAdvanced={advancedMode}
                realTime={realTimeUpdates}
              />
            </TabsContent>
          )}

          {/* Market Regime Tab */}
          {currentLayout.tabs.includes('market-regime') && (
            <TabsContent value="market-regime" className="space-y-6">
              <MarketRegimeIndicator
                symbol={symbol}
                timeframe={timeframe}
                showTransitions={true}
                showProbabilities={true}
                advanced={advancedMode}
              />
            </TabsContent>
          )}

          {/* Correlations Tab */}
          {currentLayout.tabs.includes('correlations') && (
            <TabsContent value="correlations" className="space-y-6">
              <CorrelationHeatMap
                symbols={['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'ATOM-USD']}
                timeframe={timeframe}
                showAdvanced={advancedMode}
                realTime={realTimeUpdates}
              />
            </TabsContent>
          )}

          {/* Performance Tab (when included) */}
          {currentLayout.tabs.includes('performance') && (
            <TabsContent value="performance" className="space-y-6">
              <PerformanceAnalyticsDashboard />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${
                isLoading ? 'bg-yellow-400' : hasError ? 'bg-red-400' : 'bg-green-400'
              }`} />
              {isLoading ? 'Loading...' : hasError ? 'Error' : 'Connected'}
            </span>
            {realTimeUpdates && (
              <span className="flex items-center">
                <Zap className="h-3 w-3 mr-1" />
                Live updates: ON
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {analyticsOverview && (
              <span>{analyticsOverview.activeModels} models active</span>
            )}
            <span>Layout: {currentLayout.name}</span>
            <span>Symbol: {symbol}</span>
            <span>Timeframe: {timeframe}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;