/**
 * Performance Analytics Dashboard
 * 
 * Comprehensive performance analytics dashboard integrating all analytics components
 * with advanced export functionality, custom date ranges, real-time updates,
 * and customizable layouts for professional-grade performance reporting.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { 
  Download, 
  RefreshCw, 
  Settings, 
  Calendar,
  FileText,
  BarChart3,
  TrendingUp,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Filter,
  Clock,
  Zap
} from 'lucide-react';

// Import our analytics components
import { PerformanceOverview } from './PerformanceOverview';
import { StrategyComparison } from './StrategyComparison';
import { DrawdownChart } from './DrawdownChart';
import { RiskMetrics } from './RiskMetrics';
import { usePerformanceData, usePerformanceReports, usePerformanceAlerts } from '../../hooks/usePerformanceData';

interface PerformanceAnalyticsDashboardProps {
  className?: string;
}

// Dashboard layout configurations
const LAYOUT_PRESETS = {
  executive: {
    name: 'Executive View',
    tabs: ['overview', 'risk'],
    defaultTab: 'overview'
  },
  analyst: {
    name: 'Analyst View', 
    tabs: ['overview', 'strategies', 'risk', 'drawdown'],
    defaultTab: 'strategies'
  },
  trader: {
    name: 'Trader View',
    tabs: ['overview', 'drawdown', 'risk'],
    defaultTab: 'drawdown'
  },
  full: {
    name: 'Complete Analysis',
    tabs: ['overview', 'strategies', 'drawdown', 'risk'],
    defaultTab: 'overview'
  }
};

// Export format options
const EXPORT_FORMATS = [
  { value: 'PDF', label: 'PDF Report', icon: FileText },
  { value: 'CSV', label: 'CSV Data', icon: BarChart3 },
  { value: 'JSON', label: 'JSON Export', icon: Settings }
];

// Performance alert component
const AlertBanner: React.FC<{
  alerts: any[];
  onDismiss: (alertId: string) => void;
}> = ({ alerts, onDismiss }) => {
  if (!alerts.length) return null;

  const criticalAlerts = alerts.filter(a => a.level === 'critical' || a.level === 'emergency');
  const warningAlerts = alerts.filter(a => a.level === 'warning');

  return (
    <div className="space-y-2">
      {criticalAlerts.map(alert => (
        <div key={alert.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-800">{alert.title}</span>
              <Badge variant="destructive" className="text-xs">
                {alert.level.toUpperCase()}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(alert.id)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </Button>
          </div>
          <p className="text-xs text-red-700 mt-1">{alert.message}</p>
        </div>
      ))}
      
      {warningAlerts.slice(0, 2).map(alert => (
        <div key={alert.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-800">{alert.title}</span>
              <Badge variant="secondary" className="text-xs">
                {alert.level.toUpperCase()}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(alert.id)}
              className="text-yellow-500 hover:text-yellow-700"
            >
              ×
            </Button>
          </div>
          <p className="text-xs text-yellow-700 mt-1">{alert.message}</p>
        </div>
      ))}
    </div>
  );
};

export const PerformanceAnalyticsDashboard: React.FC<PerformanceAnalyticsDashboardProps> = ({
  className
}) => {
  // State management
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');
  const [layoutPreset, setLayoutPreset] = useState<keyof typeof LAYOUT_PRESETS>('full');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds
  const [isExporting, setIsExporting] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{start: string; end: string}>({
    start: '',
    end: ''
  });
  const [showAlerts, setShowAlerts] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Hooks for data fetching
  const {
    performanceOverview,
    strategyPerformance,
    drawdownMetrics,
    isLoading,
    hasError,
    refreshAllData,
    exportPerformanceData
  } = usePerformanceData({
    timeframe,
    strategyIds: selectedStrategies,
    enableRealTime: autoRefresh,
    refreshInterval: refreshInterval * 1000
  });

  const { generateReport, reportHistory } = usePerformanceReports();
  const { alerts, dismissAlert } = usePerformanceAlerts();

  // Current layout configuration
  const currentLayout = LAYOUT_PRESETS[layoutPreset];

  // Export functionality
  const handleExport = useCallback(async (format: 'PDF' | 'CSV' | 'JSON') => {
    setIsExporting(true);
    try {
      let customRange;
      if (customDateRange.start && customDateRange.end) {
        customRange = {
          start: new Date(customDateRange.start),
          end: new Date(customDateRange.end)
        };
      }

      await exportPerformanceData(format, 'full', customRange);
      
      // Show success notification (could be enhanced with toast)
      console.log(`Successfully exported ${format} report`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [customDateRange, exportPerformanceData]);

  // Generate comprehensive report
  const generateComprehensiveReport = useCallback(async (period: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
    try {
      const report = await generateReport(period, 'PDF');
      console.log('Report generated:', report);
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  }, [generateReport]);

  // Performance summary for header
  const performanceSummary = useMemo(() => {
    if (!performanceOverview) return null;

    const getTrendIcon = (value: number) => {
      if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
      return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
    };

    return {
      totalPnL: performanceOverview.totalPnL,
      dailyPnL: performanceOverview.dailyPnL,
      sharpeRatio: performanceOverview.sharpeRatio,
      maxDrawdown: performanceOverview.maxDrawdown,
      getTrendIcon
    };
  }, [performanceOverview]);

  // Handle strategy selection
  const handleStrategySelection = useCallback((strategies: string[]) => {
    setSelectedStrategies(strategies);
  }, []);

  // Handle alert dismissal
  const handleAlertDismiss = useCallback((alertId: string) => {
    dismissAlert(alertId);
  }, [dismissAlert]);

  return (
    <div className={`min-h-screen bg-gray-50 ${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
              <p className="text-sm text-gray-500">
                Comprehensive trading performance analysis and reporting
              </p>
            </div>
            
            {performanceSummary && (
              <div className="flex items-center space-x-6 ml-8">
                <div className="flex items-center space-x-1">
                  {performanceSummary.getTrendIcon(performanceSummary.dailyPnL)}
                  <span className="text-sm font-medium">
                    ${performanceSummary.dailyPnL.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">today</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">Sharpe:</span>
                  <span className="text-sm font-medium">
                    {performanceSummary.sharpeRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">Max DD:</span>
                  <span className="text-sm font-medium text-red-600">
                    {Math.abs(performanceSummary.maxDrawdown).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Layout Preset Selector */}
            <Select value={layoutPreset} onValueChange={(value) => setLayoutPreset(value as any)}>
              <SelectTrigger className="w-36">
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
                <SelectItem value="ALL">ALL</SelectItem>
              </SelectContent>
            </Select>

            {/* Auto Refresh Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                id="auto-refresh"
              />
              <Label htmlFor="auto-refresh" className="text-xs">
                Auto
              </Label>
            </div>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAllData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Export Menu */}
            <div className="flex items-center">
              {EXPORT_FORMATS.map(format => (
                <Button
                  key={format.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(format.value as any)}
                  disabled={isExporting}
                  className="mr-1 last:mr-0"
                >
                  <format.icon className="h-4 w-4 mr-1" />
                  {format.label}
                </Button>
              ))}
            </div>

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

      {/* Alerts Section */}
      {showAlerts && alerts.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Performance Alerts</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlerts(false)}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
          <AlertBanner alerts={alerts} onDismiss={handleAlertDismiss} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 px-6 py-6">
        {hasError && (
          <Card className="mb-6">
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-semibold">Unable to Load Performance Data</h3>
                <p className="text-sm text-gray-500">
                  There was an error loading the performance data. Please try refreshing.
                </p>
                <Button onClick={refreshAllData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            {currentLayout.tabs.includes('overview') && (
              <TabsTrigger value="overview" className="flex items-center">
                <BarChart3 className="h-4 w-4 mr-1" />
                Overview
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('strategies') && (
              <TabsTrigger value="strategies" className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                Strategies
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('drawdown') && (
              <TabsTrigger value="drawdown" className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-1 rotate-180" />
                Drawdown
              </TabsTrigger>
            )}
            {currentLayout.tabs.includes('risk') && (
              <TabsTrigger value="risk" className="flex items-center">
                <Shield className="h-4 w-4 mr-1" />
                Risk
              </TabsTrigger>
            )}
          </TabsList>

          {/* Performance Overview Tab */}
          {currentLayout.tabs.includes('overview') && (
            <TabsContent value="overview">
              <PerformanceOverview
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
            </TabsContent>
          )}

          {/* Strategy Comparison Tab */}
          {currentLayout.tabs.includes('strategies') && (
            <TabsContent value="strategies">
              <StrategyComparison
                timeframe={timeframe}
                selectedStrategies={selectedStrategies}
                onStrategySelectionChange={handleStrategySelection}
              />
            </TabsContent>
          )}

          {/* Drawdown Analysis Tab */}
          {currentLayout.tabs.includes('drawdown') && (
            <TabsContent value="drawdown">
              <DrawdownChart
                timeframe={timeframe}
                strategyId={selectedStrategies[0]}
                showRecovery={true}
              />
            </TabsContent>
          )}

          {/* Risk Metrics Tab */}
          {currentLayout.tabs.includes('risk') && (
            <TabsContent value="risk">
              <RiskMetrics
                timeframe={timeframe}
                strategyId={selectedStrategies[0]}
                benchmarkIndex="SPY"
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Footer with Status */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${
                isLoading ? 'bg-yellow-400' : hasError ? 'bg-red-400' : 'bg-green-400'
              }`} />
              {isLoading ? 'Loading...' : hasError ? 'Error' : 'Connected'}
            </span>
            {autoRefresh && (
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Refresh: {refreshInterval}s
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {strategyPerformance && (
              <span>{strategyPerformance.length} strategies monitored</span>
            )}
            {alerts.length > 0 && (
              <span className="text-orange-600">
                {alerts.length} active alerts
              </span>
            )}
            <span>Layout: {currentLayout.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalyticsDashboard;