/**
 * Monitoring Dashboard - Task FE-022
 * 
 * Comprehensive system monitoring dashboard with:
 * - Real-time monitoring UI
 * - System status displays
 * - Alert notifications
 * - Performance metrics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Database,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
  WifiOff,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Settings,
  Bell,
  BellOff,
  AlertCircle,
  Info,
  Shield,
  Globe,
  BarChart3,
  LineChart,
  PieChart,
  Target
} from 'lucide-react';

// Monitoring data types
interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  trend: 'up' | 'down' | 'stable';
  lastUpdate: Date;
}

interface ServiceStatus {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  responseTime: number;
  lastCheck: Date;
  version: string;
  dependencies: string[];
}

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
  source: string;
  tags: string[];
}

interface PerformanceLog {
  id: string;
  timestamp: Date;
  service: string;
  operation: string;
  duration: number;
  status: 'success' | 'error';
  details?: string;
}

// Sample data
const systemMetrics: SystemMetric[] = [
  {
    id: 'cpu_usage',
    name: 'CPU Usage',
    value: 45.2,
    unit: '%',
    status: 'normal',
    threshold: { warning: 70, critical: 90 },
    trend: 'stable',
    lastUpdate: new Date()
  },
  {
    id: 'memory_usage',
    name: 'Memory Usage',
    value: 68.5,
    unit: '%',
    status: 'normal',
    threshold: { warning: 80, critical: 95 },
    trend: 'up',
    lastUpdate: new Date()
  },
  {
    id: 'disk_usage',
    name: 'Disk Usage',
    value: 82.1,
    unit: '%',
    status: 'warning',
    threshold: { warning: 80, critical: 95 },
    trend: 'up',
    lastUpdate: new Date()
  },
  {
    id: 'network_latency',
    name: 'Network Latency',
    value: 45,
    unit: 'ms',
    status: 'normal',
    threshold: { warning: 100, critical: 200 },
    trend: 'stable',
    lastUpdate: new Date()
  },
  {
    id: 'database_connections',
    name: 'DB Connections',
    value: 15,
    unit: 'active',
    status: 'normal',
    threshold: { warning: 18, critical: 20 },
    trend: 'stable',
    lastUpdate: new Date()
  }
];

const services: ServiceStatus[] = [
  {
    id: 'api_server',
    name: 'API Server',
    status: 'healthy',
    uptime: 99.8,
    responseTime: 45,
    lastCheck: new Date(),
    version: '1.2.3',
    dependencies: ['database', 'cache']
  },
  {
    id: 'strategy_engine',
    name: 'Strategy Engine',
    status: 'healthy',
    uptime: 99.9,
    responseTime: 12,
    lastCheck: new Date(),
    version: '2.1.0',
    dependencies: ['api_server', 'database']
  },
  {
    id: 'market_data_feed',
    name: 'Market Data Feed',
    status: 'degraded',
    uptime: 98.5,
    responseTime: 156,
    lastCheck: new Date(),
    version: '1.0.8',
    dependencies: ['external_apis']
  },
  {
    id: 'risk_manager',
    name: 'Risk Manager',
    status: 'healthy',
    uptime: 99.7,
    responseTime: 23,
    lastCheck: new Date(),
    version: '1.1.2',
    dependencies: ['api_server', 'portfolio_manager']
  },
  {
    id: 'notification_service',
    name: 'Notification Service',
    status: 'maintenance',
    uptime: 95.2,
    responseTime: 0,
    lastCheck: new Date(Date.now() - 300000),
    version: '0.9.1',
    dependencies: ['email_provider', 'sms_provider']
  }
];

const alerts: Alert[] = [
  {
    id: 'alert_1',
    title: 'High Disk Usage Warning',
    description: 'System disk usage has exceeded 80% threshold',
    severity: 'warning',
    timestamp: new Date(Date.now() - 300000),
    acknowledged: false,
    source: 'system_monitor',
    tags: ['disk', 'storage']
  },
  {
    id: 'alert_2',
    title: 'Market Data Feed Degraded',
    description: 'Response times increased by 200% in the last 5 minutes',
    severity: 'warning',
    timestamp: new Date(Date.now() - 180000),
    acknowledged: false,
    source: 'market_data_feed',
    tags: ['performance', 'market_data']
  },
  {
    id: 'alert_3',
    title: 'Notification Service Maintenance',
    description: 'Scheduled maintenance window started',
    severity: 'info',
    timestamp: new Date(Date.now() - 600000),
    acknowledged: true,
    source: 'notification_service',
    tags: ['maintenance']
  }
];

const performanceLogs: PerformanceLog[] = [
  {
    id: 'log_1',
    timestamp: new Date(Date.now() - 60000),
    service: 'strategy_engine',
    operation: 'signal_generation',
    duration: 45,
    status: 'success'
  },
  {
    id: 'log_2',
    timestamp: new Date(Date.now() - 120000),
    service: 'api_server',
    operation: 'portfolio_update',
    duration: 123,
    status: 'success'
  },
  {
    id: 'log_3',
    timestamp: new Date(Date.now() - 180000),
    service: 'market_data_feed',
    operation: 'price_fetch',
    duration: 2340,
    status: 'error',
    details: 'Timeout exceeded'
  }
];

export const MonitoringDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<SystemMetric[]>(systemMetrics);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>(services);
  const [alertList, setAlertList] = useState<Alert[]>(alerts);
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>(performanceLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Auto-refresh monitoring data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshMonitoringData();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const refreshMonitoringData = async () => {
    setIsRefreshing(true);
    try {
      // In real implementation, these would be API calls
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update metrics with slight variations
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: metric.value + (Math.random() - 0.5) * 5,
        lastUpdate: new Date()
      })));
      
      // Update service response times
      setServiceStatuses(prev => prev.map(service => ({
        ...service,
        responseTime: Math.max(10, service.responseTime + (Math.random() - 0.5) * 20),
        lastCheck: new Date()
      })));
      
    } catch (error) {
      console.error('Failed to refresh monitoring data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlertList(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'normal':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'down':
      case 'critical':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      healthy: 'bg-green-100 text-green-800',
      normal: 'bg-green-100 text-green-800',
      degraded: 'bg-yellow-100 text-yellow-800',
      warning: 'bg-yellow-100 text-yellow-800',
      down: 'bg-red-100 text-red-800',
      critical: 'bg-red-100 text-red-800',
      error: 'bg-red-100 text-red-800',
      maintenance: 'bg-blue-100 text-blue-800',
      info: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {status}
    </Badge>;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const healthyServices = serviceStatuses.filter(s => s.status === 'healthy').length;
  const criticalAlerts = alertList.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const unacknowledgedAlerts = alertList.filter(a => !a.acknowledged).length;
  const averageResponseTime = serviceStatuses.reduce((sum, s) => sum + s.responseTime, 0) / serviceStatuses.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of system performance and health
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Switch
              checked={alertsEnabled}
              onCheckedChange={setAlertsEnabled}
            />
            <Label className="text-sm">Alerts</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label className="text-sm">Auto-refresh</Label>
          </div>
          <Button
            onClick={refreshMonitoringData}
            disabled={isRefreshing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Healthy Services</p>
                <p className="text-2xl font-bold">{healthyServices}/{serviceStatuses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-600">{criticalAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-blue-500" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{Math.round(averageResponseTime)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bell className="h-4 w-4 text-yellow-500" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Unread Alerts</p>
                <p className="text-2xl font-bold text-yellow-600">{unacknowledgedAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
                <CardDescription>Core system performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(metric.status)}
                          <span className="font-medium">{metric.name}</span>
                          {getTrendIcon(metric.trend)}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {metric.value.toFixed(1)}{metric.unit}
                          </span>
                          {getStatusBadge(metric.status)}
                        </div>
                      </div>
                      <Progress
                        value={Math.min(100, (metric.value / metric.threshold.critical) * 100)}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Service Status */}
            <Card>
              <CardHeader>
                <CardTitle>Service Status</CardTitle>
                <CardDescription>Status of all running services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {serviceStatuses.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(service.status)}
                        <div>
                          <h4 className="font-medium">{service.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {service.responseTime}ms • {service.uptime}% uptime
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(service.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Latest system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertList.slice(0, 5).map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      alert.acknowledged ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <h4 className="font-medium">{alert.title}</h4>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.timestamp.toLocaleString()} • {alert.source}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(alert.severity)}
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
              <CardDescription>Detailed status and configuration of all services</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead>Dependencies</TableHead>
                    <TableHead>Last Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceStatuses.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(service.status)}
                          <span className="font-medium">{service.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(service.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{service.version}</Badge>
                      </TableCell>
                      <TableCell>{service.uptime}%</TableCell>
                      <TableCell>{service.responseTime}ms</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {service.dependencies.map((dep) => (
                            <Badge key={dep} variant="secondary" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {service.lastCheck.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Alerts</CardTitle>
                  <CardDescription>Manage and respond to system alerts</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    Mark All Read
                  </Button>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Alerts</SelectItem>
                      <SelectItem value="unread">Unread Only</SelectItem>
                      <SelectItem value="critical">Critical Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {alertList.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-4 border rounded-lg ${
                        alert.acknowledged ? 'bg-gray-50' : 'bg-white'
                      } ${!alert.acknowledged && alert.severity === 'critical' ? 'border-red-200' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getSeverityIcon(alert.severity)}
                          <div className="flex-1">
                            <h4 className={`font-medium ${
                              alert.acknowledged ? 'text-gray-600' : 'text-gray-900'
                            }`}>
                              {alert.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.description}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                              <span>{alert.timestamp.toLocaleString()}</span>
                              <span>Source: {alert.source}</span>
                              <div className="flex space-x-1">
                                {alert.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(alert.severity)}
                          {!alert.acknowledged ? (
                            <Button
                              size="sm"
                              onClick={() => acknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          ) : (
                            <Badge variant="outline">Acknowledged</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Logs</CardTitle>
              <CardDescription>Recent system performance and operation logs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perfLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {log.timestamp.toLocaleString()}
                      </TableCell>
                      <TableCell>{log.service}</TableCell>
                      <TableCell>{log.operation}</TableCell>
                      <TableCell>
                        <span className={log.duration > 1000 ? 'text-red-600' : ''}>
                          {log.duration}ms
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.details || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;