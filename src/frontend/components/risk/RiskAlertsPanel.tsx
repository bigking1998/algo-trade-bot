import React, { useState } from "react";
import { AlertTriangle, Bell, CheckCircle, Clock, X, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { useRiskAlerts } from "@/frontend/hooks/useRiskData";

interface RiskAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'drawdown' | 'volatility' | 'exposure' | 'var' | 'correlation';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  threshold?: number;
  currentValue?: number;
  symbol?: string;
}

interface AlertSettings {
  enabled: boolean;
  maxDrawdown: number;
  maxVolatility: number;
  maxVaR: number;
  positionConcentration: number;
  correlationThreshold: number;
}

/**
 * Individual Alert Item Component
 */
const AlertItem: React.FC<{
  alert: RiskAlert;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}> = ({ alert, onAcknowledge, onDismiss }) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20';
      case 'warning': return 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20';
      default: return 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20';
    }
  };

  const timeAgo = new Date(Date.now() - new Date(alert.timestamp).getTime()).getMinutes();

  return (
    <div className={`p-3 border rounded-lg ${getAlertColor(alert.type)} ${
      alert.acknowledged ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {alert.acknowledged ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            getAlertIcon(alert.type)
          )}
        </div>
        
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{alert.title}</span>
            <Badge variant="outline" className="text-xs">
              {alert.category}
            </Badge>
            {alert.symbol && (
              <Badge variant="secondary" className="text-xs">
                {alert.symbol}
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            {alert.message}
          </p>
          
          {alert.threshold && alert.currentValue && (
            <div className="text-xs text-muted-foreground">
              Current: {alert.currentValue.toFixed(2)} | Threshold: {alert.threshold.toFixed(2)}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}m ago</span>
            </div>
            
            <div className="flex items-center gap-1">
              {!alert.acknowledged && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-xs h-6 px-2"
                  onClick={() => onAcknowledge(alert.id)}
                >
                  Acknowledge
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-xs h-6 px-1"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Alert Settings Panel
 */
const AlertSettingsPanel: React.FC<{
  settings: AlertSettings;
  onSettingsChange: (settings: AlertSettings) => void;
  isVisible: boolean;
  onClose: () => void;
}> = ({ settings, onSettingsChange, isVisible, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  if (!isVisible) return null;

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  return (
    <div className="absolute top-full left-0 right-0 z-10 mt-2 p-4 bg-background border rounded-lg shadow-lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Alert Settings</h4>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Enable Alerts</span>
            <Switch 
              checked={localSettings.enabled} 
              onCheckedChange={(checked) => 
                setLocalSettings({ ...localSettings, enabled: checked })
              }
            />
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Max Drawdown (%)</label>
              <input 
                type="number" 
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                value={localSettings.maxDrawdown}
                onChange={(e) => 
                  setLocalSettings({ ...localSettings, maxDrawdown: Number(e.target.value) })
                }
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Max Volatility (%)</label>
              <input 
                type="number" 
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                value={localSettings.maxVolatility}
                onChange={(e) => 
                  setLocalSettings({ ...localSettings, maxVolatility: Number(e.target.value) })
                }
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Max VaR ($)</label>
              <input 
                type="number" 
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                value={localSettings.maxVaR}
                onChange={(e) => 
                  setLocalSettings({ ...localSettings, maxVaR: Number(e.target.value) })
                }
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Position Concentration (%)</label>
              <input 
                type="number" 
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                value={localSettings.positionConcentration}
                onChange={(e) => 
                  setLocalSettings({ ...localSettings, positionConcentration: Number(e.target.value) })
                }
              />
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Risk Alerts Panel Component
 * Displays real-time risk threshold alerts and notifications
 */
const RiskAlertsPanel: React.FC = () => {
  const { data: alertsData, isLoading } = useRiskAlerts();
  const [showSettings, setShowSettings] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    enabled: true,
    maxDrawdown: 10,
    maxVolatility: 25,
    maxVaR: 5000,
    positionConcentration: 30,
    correlationThreshold: 0.8
  });

  // Mock alerts for demonstration
  const mockAlerts: RiskAlert[] = [
    {
      id: '1',
      type: 'critical',
      category: 'drawdown',
      title: 'Maximum Drawdown Exceeded',
      message: 'Portfolio drawdown has exceeded the 10% threshold',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      acknowledged: false,
      threshold: 10,
      currentValue: 12.5
    },
    {
      id: '2',
      type: 'warning',
      category: 'volatility',
      title: 'High Volatility Alert',
      message: 'BTC-USD position showing increased volatility',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      acknowledged: false,
      threshold: 25,
      currentValue: 28.3,
      symbol: 'BTC-USD'
    },
    {
      id: '3',
      type: 'warning',
      category: 'exposure',
      title: 'Position Concentration Risk',
      message: 'BTC exposure exceeds 40% of total portfolio',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      acknowledged: true,
      threshold: 30,
      currentValue: 42,
      symbol: 'BTC-USD'
    },
    {
      id: '4',
      type: 'info',
      category: 'var',
      title: 'VaR Approaching Limit',
      message: 'Daily VaR is approaching the $5000 threshold',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      acknowledged: false,
      threshold: 5000,
      currentValue: 4750
    }
  ];

  const alerts = alertsData?.alerts || mockAlerts;
  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const criticalAlerts = activeAlerts.filter(alert => alert.type === 'critical');

  const handleAcknowledge = (alertId: string) => {
    // In real implementation, this would call an API
    console.log('Acknowledging alert:', alertId);
  };

  const handleDismiss = (alertId: string) => {
    // In real implementation, this would call an API
    console.log('Dismissing alert:', alertId);
  };

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={`h-5 w-5 ${criticalAlerts.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            <span>Risk Alerts</span>
            {activeAlerts.length > 0 && (
              <Badge variant={criticalAlerts.length > 0 ? "destructive" : "secondary"}>
                {activeAlerts.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isLoading && <Badge variant="outline">Loading...</Badge>}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Alert Summary */}
        {activeAlerts.length > 0 && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span>Active Alerts</span>
              <div className="flex items-center gap-2">
                {criticalAlerts.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {criticalAlerts.length} Critical
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {activeAlerts.length} Total
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alerts.length > 0 ? (
            alerts.map(alert => (
              <AlertItem 
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onDismiss={handleDismiss}
              />
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <div className="text-sm">No active alerts</div>
              <div className="text-xs">All risk metrics are within acceptable ranges</div>
            </div>
          )}
        </div>

        {/* Alert Settings Panel */}
        <AlertSettingsPanel
          settings={alertSettings}
          onSettingsChange={setAlertSettings}
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </CardContent>
    </Card>
  );
};

export default RiskAlertsPanel;