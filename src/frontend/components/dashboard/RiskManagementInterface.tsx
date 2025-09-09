import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Alert, AlertDescription } from "../ui/alert";
import { 
  AlertTriangle, 
  Shield,
  TrendingDown,
  TrendingUp,
  Activity,
  Settings,
  Eye,
  EyeOff,
  Bell,
  BellRing,
  Zap,
  Target,
  BarChart3,
  DollarSign,
  Percent,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Gauge,
  Lock,
  Unlock
} from "lucide-react";

// Types
interface RiskLimit {
  id: string;
  name: string;
  type: 'var' | 'drawdown' | 'exposure' | 'concentration' | 'leverage';
  currentValue: number;
  limitValue: number;
  warningLevel: number;
  enabled: boolean;
  breached: boolean;
  lastUpdated: Date;
}

interface RiskAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  status: 'active' | 'acknowledged' | 'resolved';
  actions?: string[];
}

interface PortfolioExposure {
  asset: string;
  exposure: number;
  percentage: number;
  limit: number;
  risk: 'low' | 'medium' | 'high';
}

interface RiskMetrics {
  portfolioVar1d: number;
  portfolioVar5d: number;
  maxDrawdown: number;
  currentDrawdown: number;
  volatility: number;
  beta: number;
  sharpeRatio: number;
  riskScore: number;
  leverage: number;
  marginUtilization: number;
}

/**
 * Enhanced Risk Management Interface - Task FE-004
 * 
 * Comprehensive risk monitoring with:
 * - Real-time risk limit monitoring
 * - Dynamic risk alerts and notifications
 * - Position-level risk analysis
 * - Portfolio risk controls
 * - Automated risk management actions
 * - VaR and stress testing
 */
const RiskManagementInterface: React.FC = () => {
  const [riskLimits, setRiskLimits] = useState<RiskLimit[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [portfolioExposure, setPortfolioExposure] = useState<PortfolioExposure[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [autoRiskManagement, setAutoRiskManagement] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    initializeRiskData();
    const interval = setInterval(updateRiskData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const initializeRiskData = () => {
    // Mock risk limits
    const limits: RiskLimit[] = [
      {
        id: 'var_1d',
        name: 'Daily VaR',
        type: 'var',
        currentValue: 2850,
        limitValue: 5000,
        warningLevel: 4000,
        enabled: true,
        breached: false,
        lastUpdated: new Date()
      },
      {
        id: 'max_drawdown',
        name: 'Maximum Drawdown',
        type: 'drawdown',
        currentValue: 8.5,
        limitValue: 15.0,
        warningLevel: 12.0,
        enabled: true,
        breached: false,
        lastUpdated: new Date()
      },
      {
        id: 'position_concentration',
        name: 'Position Concentration',
        type: 'concentration',
        currentValue: 35.2,
        limitValue: 40.0,
        warningLevel: 35.0,
        enabled: true,
        breached: false,
        lastUpdated: new Date()
      },
      {
        id: 'leverage',
        name: 'Portfolio Leverage',
        type: 'leverage',
        currentValue: 2.3,
        limitValue: 3.0,
        warningLevel: 2.8,
        enabled: true,
        breached: false,
        lastUpdated: new Date()
      },
      {
        id: 'exposure_btc',
        name: 'BTC Exposure',
        type: 'exposure',
        currentValue: 45000,
        limitValue: 100000,
        warningLevel: 80000,
        enabled: true,
        breached: false,
        lastUpdated: new Date()
      }
    ];
    setRiskLimits(limits);

    // Mock risk alerts
    const alerts: RiskAlert[] = [
      {
        id: 'alert_001',
        severity: 'medium',
        type: 'Concentration Risk',
        message: 'BTC position exceeds 35% of portfolio. Consider rebalancing.',
        timestamp: new Date(Date.now() - 300000),
        status: 'active',
        actions: ['Reduce position', 'Hedge exposure', 'Ignore']
      },
      {
        id: 'alert_002',
        severity: 'high',
        type: 'Drawdown Warning',
        message: 'Current drawdown approaching warning level at 8.5%.',
        timestamp: new Date(Date.now() - 120000),
        status: 'active',
        actions: ['Pause strategies', 'Reduce position sizes', 'Emergency stop']
      },
      {
        id: 'alert_003',
        severity: 'low',
        type: 'Volatility Spike',
        message: 'Market volatility increased by 25% in the last hour.',
        timestamp: new Date(Date.now() - 60000),
        status: 'acknowledged'
      }
    ];
    setRiskAlerts(alerts);

    // Mock portfolio exposure
    const exposure: PortfolioExposure[] = [
      { asset: 'BTC-USD', exposure: 45000, percentage: 35.2, limit: 40.0, risk: 'medium' },
      { asset: 'ETH-USD', exposure: 32000, percentage: 25.0, limit: 30.0, risk: 'low' },
      { asset: 'SOL-USD', exposure: 18000, percentage: 14.1, limit: 20.0, risk: 'low' },
      { asset: 'AVAX-USD', exposure: 15000, percentage: 11.7, limit: 15.0, risk: 'medium' },
      { asset: 'MATIC-USD', exposure: 12000, percentage: 9.4, limit: 15.0, risk: 'low' },
      { asset: 'Cash', exposure: 6000, percentage: 4.6, limit: 10.0, risk: 'low' }
    ];
    setPortfolioExposure(exposure);

    // Mock risk metrics
    setRiskMetrics({
      portfolioVar1d: 2850,
      portfolioVar5d: 8950,
      maxDrawdown: 12.3,
      currentDrawdown: 8.5,
      volatility: 18.5,
      beta: 1.15,
      sharpeRatio: 1.42,
      riskScore: 6.8,
      leverage: 2.3,
      marginUtilization: 45.2
    });
  };

  const updateRiskData = () => {
    // Simulate real-time updates
    setRiskLimits(prev => prev.map(limit => {
      let newValue = limit.currentValue;
      
      // Add some realistic fluctuation
      switch (limit.type) {
        case 'var':
          newValue += (Math.random() - 0.5) * 200;
          break;
        case 'drawdown':
          newValue += (Math.random() - 0.5) * 0.5;
          break;
        case 'concentration':
          newValue += (Math.random() - 0.5) * 1.0;
          break;
        case 'leverage':
          newValue += (Math.random() - 0.5) * 0.1;
          break;
        case 'exposure':
          newValue += (Math.random() - 0.5) * 1000;
          break;
      }
      
      const breached = newValue > limit.limitValue;
      
      return {
        ...limit,
        currentValue: Math.max(0, newValue),
        breached,
        lastUpdated: new Date()
      };
    }));

    // Update risk metrics
    if (riskMetrics) {
      setRiskMetrics(prev => prev ? {
        ...prev,
        portfolioVar1d: prev.portfolioVar1d + (Math.random() - 0.5) * 200,
        currentDrawdown: Math.max(0, prev.currentDrawdown + (Math.random() - 0.5) * 0.3),
        volatility: Math.max(5, prev.volatility + (Math.random() - 0.5) * 1.0),
        riskScore: Math.max(1, Math.min(10, prev.riskScore + (Math.random() - 0.5) * 0.5)),
        marginUtilization: Math.max(0, Math.min(100, prev.marginUtilization + (Math.random() - 0.5) * 2))
      } : null);
    }
  };

  const handleLimitUpdate = (limitId: string, newValue: number) => {
    setRiskLimits(prev => prev.map(limit => 
      limit.id === limitId ? { ...limit, limitValue: newValue } : limit
    ));
  };

  const toggleLimitEnabled = (limitId: string) => {
    setRiskLimits(prev => prev.map(limit => 
      limit.id === limitId ? { ...limit, enabled: !limit.enabled } : limit
    ));
  };

  const acknowledgeAlert = (alertId: string) => {
    setRiskAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, status: 'acknowledged' as const } : alert
    ));
  };

  const resolveAlert = (alertId: string) => {
    setRiskAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, status: 'resolved' as const } : alert
    ));
  };

  const executeRiskAction = async (action: string) => {
    // Simulate risk management action
    console.log(`Executing risk action: ${action}`);
    // In real implementation, this would call backend APIs
  };

  const getAlertIcon = (severity: RiskAlert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'low': return <Eye className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusIcon = (status: RiskAlert['status']) => {
    switch (status) {
      case 'active': return <Bell className="h-4 w-4 text-red-500" />;
      case 'acknowledged': return <Eye className="h-4 w-4 text-yellow-500" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number, decimals: number = 1) => {
    return `${value.toFixed(decimals)}%`;
  };

  const getRiskScore = () => {
    if (!riskMetrics) return 0;
    return riskMetrics.riskScore;
  };

  const getRiskScoreColor = (score: number) => {
    if (score <= 3) return 'text-green-600';
    if (score <= 6) return 'text-yellow-600';
    if (score <= 8) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Risk Management</h2>
          <p className="text-muted-foreground">Real-time portfolio risk monitoring and control</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={isMonitoring ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {isMonitoring ? 'Monitoring' : 'Paused'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Risk Score & Key Metrics */}
      {riskMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="md:col-span-1">
            <CardContent className="p-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getRiskScoreColor(getRiskScore())}`}>
                  {getRiskScore().toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Risk Score</div>
                <div className="mt-2">
                  <Progress value={getRiskScore() * 10} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Portfolio VaR (1d)</p>
                  <p className="text-2xl font-bold">{formatCurrency(riskMetrics.portfolioVar1d)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Current Drawdown</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{formatPercent(riskMetrics.currentDrawdown)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Volatility</p>
                  <p className="text-2xl font-bold">{formatPercent(riskMetrics.volatility)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Leverage</p>
                  <p className="text-2xl font-bold">{riskMetrics.leverage.toFixed(2)}x</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Alerts */}
      {riskAlerts.filter(alert => alert.status === 'active').length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{riskAlerts.filter(alert => alert.status === 'active').length} active risk alerts</strong> requiring attention.
            Review the alerts below and take appropriate action.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="limits" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="limits">Risk Limits</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="exposure">Exposure</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Risk Limits Tab */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Limit Monitoring</CardTitle>
              <CardDescription>Real-time monitoring of risk thresholds and limits</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk Metric</TableHead>
                    <TableHead>Current Value</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskLimits.map((limit) => {
                    const utilization = (limit.currentValue / limit.limitValue) * 100;
                    const isNearLimit = utilization >= (limit.warningLevel / limit.limitValue) * 100;
                    
                    return (
                      <TableRow key={limit.id}>
                        <TableCell className="font-medium">{limit.name}</TableCell>
                        <TableCell>
                          {limit.type === 'var' || limit.type === 'exposure' 
                            ? formatCurrency(limit.currentValue)
                            : limit.type === 'leverage'
                            ? `${limit.currentValue.toFixed(2)}x`
                            : formatPercent(limit.currentValue)
                          }
                        </TableCell>
                        <TableCell>
                          {limit.type === 'var' || limit.type === 'exposure' 
                            ? formatCurrency(limit.limitValue)
                            : limit.type === 'leverage'
                            ? `${limit.limitValue.toFixed(2)}x`
                            : formatPercent(limit.limitValue)
                          }
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress 
                              value={Math.min(utilization, 100)} 
                              className={`h-2 ${
                                utilization >= 100 ? 'bg-red-100' :
                                isNearLimit ? 'bg-yellow-100' : 'bg-green-100'
                              }`}
                            />
                            <div className="text-xs text-muted-foreground">
                              {utilization.toFixed(1)}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {limit.breached ? (
                            <Badge className="bg-red-100 text-red-800">Breached</Badge>
                          ) : isNearLimit ? (
                            <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch 
                            checked={limit.enabled} 
                            onCheckedChange={() => toggleLimitEnabled(limit.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {/* Open edit dialog */}}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={alertsEnabled} 
                onCheckedChange={setAlertsEnabled}
              />
              <Label>Enable Risk Alerts</Label>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Alert Settings
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Risk Alerts</CardTitle>
              <CardDescription>Active and recent risk alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {riskAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      {getAlertIcon(alert.severity)}
                      {getStatusIcon(alert.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">{alert.type}</h4>
                        <Badge className={`text-xs ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.severity}
                        </Badge>
                        <Badge className={`text-xs ${
                          alert.status === 'active' ? 'bg-red-100 text-red-800' :
                          alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {alert.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.timestamp.toLocaleString()}
                      </p>
                      {alert.actions && alert.status === 'active' && (
                        <div className="flex space-x-2 mt-2">
                          {alert.actions.map((action, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              onClick={() => executeRiskAction(action)}
                            >
                              {action}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      {alert.status === 'active' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exposure Tab */}
        <TabsContent value="exposure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Exposure</CardTitle>
              <CardDescription>Asset allocation and concentration risk</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Exposure</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Allocation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolioExposure.map((exposure) => (
                    <TableRow key={exposure.asset}>
                      <TableCell className="font-medium">{exposure.asset}</TableCell>
                      <TableCell>{formatCurrency(exposure.exposure)}</TableCell>
                      <TableCell>{formatPercent(exposure.percentage)}</TableCell>
                      <TableCell>{formatPercent(exposure.limit)}</TableCell>
                      <TableCell>
                        <Badge className={getRiskColor(exposure.risk)}>
                          {exposure.risk}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Progress value={exposure.percentage} className="h-2 w-20" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Controls Tab */}
        <TabsContent value="controls" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Management Controls</CardTitle>
                <CardDescription>Automated risk management settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-risk">Automatic Risk Management</Label>
                  <Switch 
                    id="auto-risk"
                    checked={autoRiskManagement} 
                    onCheckedChange={setAutoRiskManagement}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="emergency-stop">Emergency Stop Enabled</Label>
                  <Switch id="emergency-stop" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="position-limits">Position Size Limits</Label>
                  <Switch id="position-limits" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="correlation-limits">Correlation Limits</Label>
                  <Switch id="correlation-limits" defaultChecked />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-positions">Maximum Open Positions</Label>
                  <Input id="max-positions" type="number" defaultValue="10" />
                </div>
                
                <Button className="w-full bg-red-600 hover:bg-red-700">
                  <Shield className="h-4 w-4 mr-2" />
                  Emergency Stop All Strategies
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Scenarios</CardTitle>
                <CardDescription>Stress testing and scenario analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Market Crash Scenario (-20%)</Label>
                  <div className="text-sm text-muted-foreground">
                    Estimated Loss: {formatCurrency(8500)}
                  </div>
                  <Progress value={15} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <Label>High Volatility Scenario (+50% vol)</Label>
                  <div className="text-sm text-muted-foreground">
                    Estimated VaR: {formatCurrency(4200)}
                  </div>
                  <Progress value={25} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <Label>Liquidity Crisis Scenario</Label>
                  <div className="text-sm text-muted-foreground">
                    Exit Time: 3.2 hours
                  </div>
                  <Progress value={35} className="h-2" />
                </div>
                
                <Button variant="outline" className="w-full">
                  <Target className="h-4 w-4 mr-2" />
                  Run Stress Test
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Reports</CardTitle>
              <CardDescription>Historical risk analysis and reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Daily Risk Report
                </Button>
                <Button variant="outline">
                  <Activity className="h-4 w-4 mr-2" />
                  VaR Backtesting
                </Button>
                <Button variant="outline">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Drawdown Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RiskManagementInterface;