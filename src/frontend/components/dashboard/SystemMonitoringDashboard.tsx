import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription } from "../ui/alert";
import { 
  Server,
  Database,
  Wifi,
  WifiOff,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Users,
  BarChart3,
  Globe,
  Shield,
  RefreshCw,
  Settings,
  Eye,
  Download,
  ArrowUp,
  ArrowDown,
  Gauge
} from "lucide-react";

// Types
interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  threshold: number;
  trend: 'up' | 'down' | 'stable';
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting';
  uptime: string;
  version: string;
  lastRestart: Date;
  healthCheck: boolean;
  errorCount: number;
  responseTime: number;
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  details?: string;
}

interface PerformanceMetric {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  latency: number;
}

/**
 * System Monitoring Dashboard - Task FE-005
 * 
 * Comprehensive system health monitoring with:
 * - Real-time infrastructure metrics
 * - Service status monitoring
 * - Performance analytics
 * - System logs and alerts
 * - Network connectivity monitoring
 * - Database health tracking
 */
const SystemMonitoringDashboard: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetric[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  useEffect(() => {
    initializeSystemData();
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(updateSystemData, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const initializeSystemData = () => {
    // Mock system metrics
    const metrics: SystemMetric[] = [
      {
        name: 'CPU Usage',
        value: 23.5,
        unit: '%',
        status: 'healthy',
        threshold: 80,
        trend: 'stable'
      },
      {
        name: 'Memory Usage',
        value: 64.2,
        unit: '%',
        status: 'warning',
        threshold: 85,
        trend: 'up'
      },
      {
        name: 'Disk Usage',
        value: 42.8,
        unit: '%',
        status: 'healthy',
        threshold: 90,
        trend: 'stable'
      },
      {
        name: 'Network Latency',
        value: 12,
        unit: 'ms',
        status: 'healthy',
        threshold: 100,
        trend: 'down'
      },
      {
        name: 'Database Connections',
        value: 15,
        unit: 'active',
        status: 'healthy',
        threshold: 50,
        trend: 'stable'
      },
      {
        name: 'API Response Time',
        value: 85,
        unit: 'ms',
        status: 'healthy',
        threshold: 500,
        trend: 'stable'
      }
    ];
    setSystemMetrics(metrics);

    // Mock service statuses
    const services: ServiceStatus[] = [
      {
        name: 'Strategy Engine',
        status: 'running',
        uptime: '2d 14h 23m',
        version: '1.2.3',
        lastRestart: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
        healthCheck: true,
        errorCount: 0,
        responseTime: 45
      },
      {
        name: 'Market Data Service',
        status: 'running',
        uptime: '2d 14h 23m',
        version: '2.1.0',
        lastRestart: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
        healthCheck: true,
        errorCount: 2,
        responseTime: 28
      },
      {
        name: 'Risk Management',
        status: 'running',
        uptime: '2d 14h 23m',
        version: '1.5.1',
        lastRestart: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
        healthCheck: true,
        errorCount: 0,
        responseTime: 67
      },
      {
        name: 'Order Management',
        status: 'running',
        uptime: '1d 8h 12m',
        version: '1.8.2',
        lastRestart: new Date(Date.now() - 1.3 * 24 * 60 * 60 * 1000),
        healthCheck: true,
        errorCount: 1,
        responseTime: 92
      },
      {
        name: 'Database',
        status: 'running',
        uptime: '7d 2h 45m',
        version: '15.4',
        lastRestart: new Date(Date.now() - 7.1 * 24 * 60 * 60 * 1000),
        healthCheck: true,
        errorCount: 0,
        responseTime: 15
      },
      {
        name: 'Redis Cache',
        status: 'error',
        uptime: '0m',
        version: '7.0.5',
        lastRestart: new Date(),
        healthCheck: false,
        errorCount: 15,
        responseTime: 0
      }
    ];
    setServiceStatuses(services);

    // Mock log entries
    const logs: LogEntry[] = [
      {
        timestamp: new Date(Date.now() - 60000),
        level: 'error',
        service: 'Redis Cache',
        message: 'Connection failed: ECONNREFUSED 127.0.0.1:6379',
        details: 'Unable to connect to Redis server. Check if Redis is running.'
      },
      {
        timestamp: new Date(Date.now() - 120000),
        level: 'warn',
        service: 'Strategy Engine',
        message: 'High memory usage detected: 89.5%',
        details: 'Memory usage approaching threshold. Consider optimization.'
      },
      {
        timestamp: new Date(Date.now() - 180000),
        level: 'info',
        service: 'Market Data Service',
        message: 'Successfully reconnected to dYdX WebSocket',
        details: 'WebSocket connection restored after brief interruption.'
      },
      {
        timestamp: new Date(Date.now() - 240000),
        level: 'info',
        service: 'Order Management',
        message: 'Order executed successfully: BTC-USD buy 0.1',
        details: 'Order ID: ord_1234567890, Fill price: $43,250.50'
      },
      {
        timestamp: new Date(Date.now() - 300000),
        level: 'error',
        service: 'Market Data Service',
        message: 'WebSocket connection lost',
        details: 'Attempting to reconnect to dYdX WebSocket feed...'
      }
    ];
    setLogEntries(logs);

    // Generate performance history
    const history: PerformanceMetric[] = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      history.push({
        timestamp,
        cpu: 20 + Math.random() * 40,
        memory: 50 + Math.random() * 30,
        disk: 40 + Math.random() * 10,
        network: Math.random() * 100,
        latency: 10 + Math.random() * 20
      });
    }
    setPerformanceHistory(history);
  };

  const updateSystemData = () => {
    setLastUpdate(new Date());
    
    // Update system metrics with realistic changes
    setSystemMetrics(prev => prev.map(metric => {
      let newValue = metric.value;
      
      switch (metric.name) {
        case 'CPU Usage':
          newValue += (Math.random() - 0.5) * 5;
          break;
        case 'Memory Usage':
          newValue += (Math.random() - 0.5) * 2;
          break;
        case 'Disk Usage':
          newValue += (Math.random() - 0.5) * 0.1;
          break;
        case 'Network Latency':
          newValue += (Math.random() - 0.5) * 10;
          break;
        case 'Database Connections':
          newValue = Math.max(5, newValue + Math.floor((Math.random() - 0.5) * 4));
          break;
        case 'API Response Time':
          newValue += (Math.random() - 0.5) * 20;
          break;
      }
      
      newValue = Math.max(0, newValue);
      
      let status: SystemMetric['status'] = 'healthy';
      if (newValue > metric.threshold * 0.9) status = 'critical';
      else if (newValue > metric.threshold * 0.7) status = 'warning';
      
      const trend: SystemMetric['trend'] = 
        newValue > metric.value * 1.05 ? 'up' :
        newValue < metric.value * 0.95 ? 'down' : 'stable';
      
      return {
        ...metric,
        value: newValue,
        status,
        trend
      };
    }));

    // Occasionally add new log entries
    if (Math.random() < 0.3) {
      const newLog: LogEntry = {
        timestamp: new Date(),
        level: Math.random() < 0.1 ? 'error' : Math.random() < 0.3 ? 'warn' : 'info',
        service: ['Strategy Engine', 'Market Data Service', 'Risk Management', 'Order Management'][Math.floor(Math.random() * 4)],
        message: 'System monitoring update',
        details: 'Automated system health check completed successfully.'
      };
      
      setLogEntries(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50 logs
    }
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'stopped':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'starting':
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ServiceStatus['status']) => {
    const colors = {
      running: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
      starting: 'bg-yellow-100 text-yellow-800'
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  const getMetricStatusColor = (status: SystemMetric['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
    }
  };

  const getLogLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: SystemMetric['trend']) => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <ArrowDown className="h-3 w-3 text-green-500" />;
      case 'stable':
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const formatUptime = (uptime: string) => {
    return uptime;
  };

  const runningServices = serviceStatuses.filter(s => s.status === 'running').length;
  const totalServices = serviceStatuses.length;
  const systemHealth = (runningServices / totalServices) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Monitoring</h2>
          <p className="text-muted-foreground">Infrastructure health and performance monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">Disconnected</span>
              </>
            )}
          </div>
          <Badge className={autoRefresh ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {autoRefresh ? 'Auto Refresh' : 'Manual'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* System Health Alert */}
      {systemHealth < 100 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>System Health Warning:</strong> {totalServices - runningServices} service(s) not running properly. 
            Check the Services tab for details.
          </AlertDescription>
        </Alert>
      )}

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Server className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">System Health</p>
                <p className={`text-2xl font-bold ${systemHealth === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {systemHealth.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Running Services</p>
                <p className="text-2xl font-bold">{runningServices}/{totalServices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Avg CPU Usage</p>
                <p className={`text-2xl font-bold ${getMetricStatusColor(systemMetrics.find(m => m.name === 'CPU Usage')?.status || 'healthy')}`}>
                  {systemMetrics.find(m => m.name === 'CPU Usage')?.value.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">
                  {serviceStatuses.reduce((sum, s) => sum + s.responseTime, 0) / serviceStatuses.length | 0}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Monitoring Tabs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        {/* System Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systemMetrics.map((metric) => (
              <Card key={metric.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    {metric.name}
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(metric.trend)}
                      <Badge className={`text-xs ${
                        metric.status === 'healthy' ? 'bg-green-100 text-green-800' :
                        metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {metric.status}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className={`text-2xl font-bold ${getMetricStatusColor(metric.status)}`}>
                    {metric.value.toFixed(1)}{metric.unit}
                  </div>
                  <div className="mt-2">
                    <Progress 
                      value={Math.min((metric.value / metric.threshold) * 100, 100)} 
                      className="h-2"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Threshold: {metric.threshold}{metric.unit}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>Current status of all system services</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Health Check</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceStatuses.map((service) => (
                    <TableRow key={service.name}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(service.status)}
                          <span className="font-medium">{service.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(service.status)}</TableCell>
                      <TableCell className="text-sm">{service.uptime}</TableCell>
                      <TableCell className="text-sm">{service.version}</TableCell>
                      <TableCell>
                        {service.healthCheck ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className={service.errorCount > 0 ? 'text-red-600' : 'text-gray-600'}>
                        {service.errorCount}
                      </TableCell>
                      <TableCell className="text-sm">{service.responseTime}ms</TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance History</CardTitle>
              <CardDescription>24-hour system performance trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border rounded-lg">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                  <p>Performance Chart</p>
                  <p className="text-sm">Historical CPU, Memory, Disk, and Network metrics</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                {performanceHistory.length > 0 && (
                  <>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {performanceHistory[performanceHistory.length - 1].cpu.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Current CPU</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {performanceHistory[performanceHistory.length - 1].memory.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Current Memory</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {performanceHistory[performanceHistory.length - 1].disk.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Current Disk</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {performanceHistory[performanceHistory.length - 1].latency.toFixed(1)}ms
                      </div>
                      <div className="text-sm text-muted-foreground">Current Latency</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Logs</h3>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="space-y-0">
                {logEntries.map((log, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 border-b last:border-b-0 hover:bg-gray-50">
                    <div className="flex items-center space-x-2">
                      {getLogLevelIcon(log.level)}
                      <Badge className={`text-xs ${
                        log.level === 'error' ? 'bg-red-100 text-red-800' :
                        log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                        log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.level}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-sm">{log.service}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{log.message}</p>
                      {log.details && (
                        <p className="text-xs text-gray-600 mt-1">{log.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Network Connectivity</CardTitle>
                <CardDescription>External service connectivity status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">dYdX API</span>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Connected (15ms)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">dYdX WebSocket</span>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Connected (12ms)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database</span>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Connected (3ms)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Redis Cache</span>
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">Disconnected</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Statistics</CardTitle>
                <CardDescription>Network usage and performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Inbound Traffic</span>
                    <span>2.3 MB/s</span>
                  </div>
                  <Progress value={35} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Outbound Traffic</span>
                    <span>1.8 MB/s</span>
                  </div>
                  <Progress value={28} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Active Connections</span>
                    <span>47</span>
                  </div>
                  <Progress value={47} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Packet Loss</span>
                    <span>0.02%</span>
                  </div>
                  <Progress value={0.02} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemMonitoringDashboard;