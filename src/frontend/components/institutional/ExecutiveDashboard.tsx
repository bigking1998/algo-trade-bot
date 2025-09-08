import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Progress } from 'components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import {
  TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, 
  Shield, BarChart3, PieChart, Activity, ArrowUpRight, ArrowDownRight,
  Calendar, Clock, Settings, Download, Maximize2, Minimize2, RotateCw
} from 'lucide-react';

import { 
  PortfolioOverview, 
  PerformanceMetrics, 
  RiskAlert,
  AlertSeverity,
  DateRange,
  Manager,
  Strategy
} from '../../types/institutional';

interface ExecutiveDashboardProps {
  portfolioData: PortfolioOverview;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  portfolioData,
  dateRange,
  onDateRangeChange,
  className = ""
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(dateRange.period);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Format large numbers for display
  const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getAlertSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period as DateRange['period']);
    onDateRangeChange({
      ...dateRange,
      period: period as DateRange['period']
    });
  };

  const riskMetrics = portfolioData.riskMetrics;
  const activeAlerts = portfolioData.alerts.filter(alert => alert.status === 'active');
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4 overflow-auto' : ''} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground">
            Portfolio overview and key performance indicators
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">Month to Date</SelectItem>
              <SelectItem value="qtd">Quarter to Date</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
              <SelectItem value="3y">3 Years</SelectItem>
              <SelectItem value="5y">5 Years</SelectItem>
              <SelectItem value="inception">Since Inception</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assets Under Management</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolioData.totalAUM)}</div>
            <p className="text-xs text-muted-foreground">
              Portfolio value as of {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {portfolioData.totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioData.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(portfolioData.totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPercent(portfolioData.totalPnLPercent)} for selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolioData.strategiesCount}</div>
            <p className="text-xs text-muted-foreground">
              Across {portfolioData.managersCount} managers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Alerts</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${criticalAlerts.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${criticalAlerts.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {activeAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {criticalAlerts.length} critical alerts
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Portfolio Risk Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Overview
                </CardTitle>
                <CardDescription>
                  Key risk metrics for the portfolio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Portfolio VaR (95%)</span>
                    <span className="text-sm font-medium">{formatPercent(riskMetrics.portfolioVaR)}</span>
                  </div>
                  <Progress value={Math.abs(riskMetrics.portfolioVaR) * 10} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Leverage Ratio</span>
                    <span className="text-sm font-medium">{riskMetrics.leverageRatio.toFixed(2)}x</span>
                  </div>
                  <Progress value={riskMetrics.leverageRatio * 25} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Concentration Risk</span>
                    <span className="text-sm font-medium">{formatPercent(riskMetrics.concentrationRisk)}</span>
                  </div>
                  <Progress value={riskMetrics.concentrationRisk} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Performers
                </CardTitle>
                <CardDescription>
                  Best performing strategies this period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {portfolioData.topPerformers.slice(0, 3).map((strategy) => (
                    <div key={strategy.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{strategy.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(strategy.allocation)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          {formatPercent(strategy.performance.ytd)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bottom Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Bottom Performers
                </CardTitle>
                <CardDescription>
                  Strategies requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {portfolioData.bottomPerformers.slice(0, 3).map((strategy) => (
                    <div key={strategy.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{strategy.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(strategy.allocation)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3 text-red-600" />
                        <span className="text-sm font-medium text-red-600">
                          {formatPercent(strategy.performance.ytd)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Attribution</CardTitle>
                <CardDescription>Contribution analysis by asset class</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Performance attribution chart will be implemented here
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Rolling Returns</CardTitle>
                <CardDescription>12-month rolling performance history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Rolling returns chart will be implemented here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stress Test Results</CardTitle>
                <CardDescription>Portfolio performance under stress scenarios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">2008 Financial Crisis</span>
                    <span className="text-sm font-medium text-red-600">
                      {formatPercent(riskMetrics.stress_scenario_1)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(riskMetrics.stress_scenario_1)} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">COVID-19 March 2020</span>
                    <span className="text-sm font-medium text-red-600">
                      {formatPercent(riskMetrics.stress_scenario_2)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(riskMetrics.stress_scenario_2)} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Custom Stress Test</span>
                    <span className="text-sm font-medium text-red-600">
                      {formatPercent(riskMetrics.stress_scenario_3)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(riskMetrics.stress_scenario_3)} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Risk Heatmap</CardTitle>
                <CardDescription>Risk exposure across strategies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Risk heatmap visualization will be implemented here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Asset Allocation</CardTitle>
                <CardDescription>Current vs target allocation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {portfolioData.allocations.map((allocation) => (
                    <div key={allocation.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{allocation.name}</span>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatPercent(allocation.allocation)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Target: {formatPercent(allocation.targetAllocation)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Progress value={allocation.allocation} className="h-2 flex-1" />
                        <Progress 
                          value={allocation.targetAllocation} 
                          className="h-2 flex-1 opacity-50" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Manager Allocation</CardTitle>
                <CardDescription>Assets under management by manager</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Manager allocation pie chart will be implemented here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Risk Alerts</CardTitle>
              <CardDescription>
                {activeAlerts.length} active alerts require attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active alerts</p>
                    <p className="text-sm">Your portfolio is operating within normal parameters</p>
                  </div>
                ) : (
                  activeAlerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-600' : 
                        alert.severity === 'high' ? 'text-orange-600' :
                        alert.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                      }`} />
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge className={getAlertSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{alert.affectedEntity}</span>
                          <span>•</span>
                          <span>{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm">
                        Acknowledge
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};