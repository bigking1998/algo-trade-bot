import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Progress } from 'components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { Switch } from 'components/ui/switch';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Settings, 
  TrendingUp, TrendingDown, Activity, Target, Users,
  BarChart3, PieChart, Zap, Clock, AlertCircle, Eye,
  Download, RefreshCw, Filter, Search, Bell
} from 'lucide-react';

import {
  PortfolioRiskMetrics,
  ComplianceRule,
  ComplianceViolation,
  RiskAlert,
  AlertSeverity,
  Manager,
  Strategy,
  ScenarioTest,
  InstitutionalUser
} from '../../types/institutional';

interface RiskGovernanceProps {
  riskMetrics: PortfolioRiskMetrics;
  complianceRules: ComplianceRule[];
  violations: ComplianceViolation[];
  alerts: RiskAlert[];
  managers: Manager[];
  strategies: Strategy[];
  scenarioTests: ScenarioTest[];
  currentUser: InstitutionalUser;
  onUpdateRule: (ruleId: string, updates: Partial<ComplianceRule>) => Promise<void>;
  onAcknowledgeAlert: (alertId: string) => Promise<void>;
  onResolveViolation: (violationId: string, resolution: string) => Promise<void>;
  className?: string;
}

export const RiskGovernance: React.FC<RiskGovernanceProps> = ({
  riskMetrics,
  complianceRules,
  violations,
  alerts,
  managers,
  strategies,
  scenarioTests,
  currentUser,
  onUpdateRule,
  onAcknowledgeAlert,
  onResolveViolation,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Permission checks
  const canManageRules = currentUser.permissions.includes('manage_strategies') || 
                         currentUser.role === 'risk_officer' || 
                         currentUser.role === 'administrator';

  const canAcknowledgeAlerts = currentUser.permissions.includes('acknowledge_alerts') ||
                               currentUser.role === 'risk_officer' ||
                               currentUser.role === 'portfolio_manager';

  // Format utilities
  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

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

  const getSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getViolationIcon = (status: ComplianceViolation['status']) => {
    switch (status) {
      case 'active': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'waived': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  // Filter functions
  const filteredAlerts = alerts.filter(alert => {
    const matchesSeverity = filterSeverity === "all" || alert.severity === filterSeverity;
    const matchesSearch = searchTerm === "" || 
                         alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch && alert.status === 'active';
  });

  const activeViolations = violations.filter(v => v.status === 'active');
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status === 'active');
  const highRiskRules = complianceRules.filter(r => r.enabled && 
    violations.some(v => v.ruleId === r.id && v.status === 'active'));

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    if (!canManageRules) return;
    try {
      await onUpdateRule(ruleId, { enabled });
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const getRiskLevel = (value: number, thresholds: { low: number; medium: number; high: number }) => {
    if (Math.abs(value) <= thresholds.low) return { level: 'low', color: 'text-green-600' };
    if (Math.abs(value) <= thresholds.medium) return { level: 'medium', color: 'text-yellow-600' };
    if (Math.abs(value) <= thresholds.high) return { level: 'high', color: 'text-orange-600' };
    return { level: 'critical', color: 'text-red-600' };
  };

  const varRisk = getRiskLevel(riskMetrics.portfolioVaR, { low: 1, medium: 2, high: 3 });
  const leverageRisk = getRiskLevel(riskMetrics.leverageRatio, { low: 1.5, medium: 2.5, high: 4 });
  const concentrationRisk = getRiskLevel(riskMetrics.concentrationRisk, { low: 20, medium: 30, high: 40 });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Risk Governance</h1>
          <p className="text-muted-foreground">
            Risk monitoring, compliance tracking, and governance oversight
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[200px]"
            />
          </div>
          
          <Select value={filterSeverity} onValueChange={(value: AlertSeverity | "all") => setFilterSeverity(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio VaR (95%)</CardTitle>
            <Shield className={`h-4 w-4 ${varRisk.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${varRisk.color}`}>
              {formatPercent(riskMetrics.portfolioVaR)}
            </div>
            <p className="text-xs text-muted-foreground">
              1-day Value at Risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Violations</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${activeViolations.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeViolations.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {activeViolations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Compliance violations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leverage Ratio</CardTitle>
            <Activity className={`h-4 w-4 ${leverageRisk.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${leverageRisk.color}`}>
              {riskMetrics.leverageRatio.toFixed(2)}x
            </div>
            <p className="text-xs text-muted-foreground">
              Current portfolio leverage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <Bell className={`h-4 w-4 ${criticalAlerts.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${criticalAlerts.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {criticalAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="alerts">Risk Alerts</TabsTrigger>
          <TabsTrigger value="scenarios">Stress Tests</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Risk Metrics Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Metrics
                </CardTitle>
                <CardDescription>
                  Key portfolio risk indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Portfolio VaR</span>
                    <span className={`text-sm font-medium ${varRisk.color}`}>
                      {formatPercent(riskMetrics.portfolioVaR)}
                    </span>
                  </div>
                  <Progress value={Math.abs(riskMetrics.portfolioVaR) * 10} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Expected Shortfall</span>
                    <span className="text-sm font-medium">
                      {formatPercent(riskMetrics.expectedShortfall)}
                    </span>
                  </div>
                  <Progress value={Math.abs(riskMetrics.expectedShortfall) * 8} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Concentration Risk</span>
                    <span className={`text-sm font-medium ${concentrationRisk.color}`}>
                      {formatPercent(riskMetrics.concentrationRisk)}
                    </span>
                  </div>
                  <Progress value={riskMetrics.concentrationRisk} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Compliance Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Compliance Status
                </CardTitle>
                <CardDescription>
                  Regulatory and internal compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Rules</span>
                    <span className="text-sm font-medium">
                      {complianceRules.filter(r => r.enabled).length}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Violations</span>
                    <Badge className={activeViolations.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {activeViolations.length}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">High Risk Rules</span>
                    <Badge className={highRiskRules.length > 0 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>
                      {highRiskRules.length}
                    </Badge>
                  </div>
                  
                  <div className="pt-2">
                    <div className="text-sm text-muted-foreground mb-2">Compliance Score</div>
                    <div className="flex items-center gap-2">
                      <Progress value={85} className="h-2 flex-1" />
                      <span className="text-sm font-medium">85%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Alerts
                </CardTitle>
                <CardDescription>
                  Latest risk and compliance alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${getSeverityColor(alert.severity).split(' ')[0]}`} />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={getSeverityColor(alert.severity)} size="sm">
                            {alert.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Rules</CardTitle>
                <CardDescription>
                  {complianceRules.filter(r => r.enabled).length} active rules monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complianceRules.slice(0, 6).map((rule) => {
                    const hasViolation = violations.some(v => v.ruleId === rule.id && v.status === 'active');
                    return (
                      <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{rule.name}</h4>
                            {hasViolation && <XCircle className="h-4 w-4 text-red-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{rule.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{rule.category.replace('_', ' ')}</Badge>
                            <span>•</span>
                            <span>Threshold: {rule.threshold}</span>
                          </div>
                        </div>
                        
                        {canManageRules && (
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Active Violations</CardTitle>
                <CardDescription>
                  {activeViolations.length} violations requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeViolations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600 opacity-50" />
                      <p>No active violations</p>
                      <p className="text-sm">All compliance rules are being followed</p>
                    </div>
                  ) : (
                    activeViolations.slice(0, 5).map((violation) => {
                      const rule = complianceRules.find(r => r.id === violation.ruleId);
                      return (
                        <div key={violation.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getViolationIcon(violation.status)}
                              <h4 className="font-medium">{rule?.name}</h4>
                            </div>
                            <Badge className={getSeverityColor(violation.severity)}>
                              {violation.severity}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Current Value:</span>
                              <span className="font-medium text-red-600">
                                {violation.currentValue}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Limit:</span>
                              <span className="font-medium">{violation.limit}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Entity:</span>
                              <span className="font-medium">{violation.entity}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(violation.timestamp).toLocaleDateString()}
                            </span>
                            {canManageRules && (
                              <Button variant="outline" size="sm">
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Alerts</CardTitle>
              <CardDescription>
                {filteredAlerts.length} alerts match your current filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No alerts match your filters</p>
                    <p className="text-sm">Try adjusting your search or severity filters</p>
                  </div>
                ) : (
                  filteredAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${getSeverityColor(alert.severity).split(' ')[0]}`} />
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{alert.title}</h4>
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                          </div>
                          
                          {canAcknowledgeAlerts && alert.status === 'active' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => onAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{alert.affectedEntity}</span>
                          <span>•</span>
                          <span>{new Date(alert.timestamp).toLocaleString()}</span>
                          {alert.assignee && (
                            <>
                              <span>•</span>
                              <span>Assigned to: {alert.assignee}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stress Test Results</CardTitle>
                <CardDescription>Historical scenario analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="font-medium">2008 Financial Crisis</div>
                      <div className="text-sm text-muted-foreground">Lehman Brothers scenario</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {formatPercent(riskMetrics.stress_scenario_1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Projected loss</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="font-medium">COVID-19 March 2020</div>
                      <div className="text-sm text-muted-foreground">Market crash scenario</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {formatPercent(riskMetrics.stress_scenario_2)}
                      </div>
                      <div className="text-xs text-muted-foreground">Projected loss</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="font-medium">Custom Stress Test</div>
                      <div className="text-sm text-muted-foreground">Tailored scenario</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {formatPercent(riskMetrics.stress_scenario_3)}
                      </div>
                      <div className="text-xs text-muted-foreground">Projected loss</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Scenario Configuration</CardTitle>
                <CardDescription>Create and run custom stress tests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Scenario configuration interface will be implemented here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Limits Management</CardTitle>
              <CardDescription>Configure and monitor risk limits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Risk limits management interface will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Risk Monitoring</CardTitle>
              <CardDescription>Live risk metrics and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Real-time monitoring dashboard will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};