/**
 * Risk Management Nodes - FE-009
 * 
 * Advanced node types for comprehensive risk management within the visual strategy builder.
 * Supports position sizing, stop-loss, take-profit, and portfolio-level risk controls.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Shield, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Percent,
  AlertTriangle,
  Target,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
  Activity,
  Zap,
  Timer
} from 'lucide-react';
import { NodeComponentProps } from './types';

interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  volatility: number;
  valueAtRisk: number;
  expectedShortfall: number;
  maxPositionSize: number;
  portfolioRisk: number;
}

// Position Sizing Node
export const PositionSizingNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [sizingConfig, setSizingConfig] = useState({
    method: 'fixed_percent' as 'fixed_percent' | 'kelly' | 'volatility_adjusted' | 'risk_parity',
    riskPerTrade: 2, // percentage
    maxPositionSize: 10, // percentage of portfolio
    volatilityLookback: 20,
    confidence: 0.95,
    enableDynamicSizing: true,
    portfolioHeatLimit: 20, // maximum total risk exposure
    ...data
  });

  const [currentMetrics, setCurrentMetrics] = useState<RiskMetrics>({
    maxDrawdown: 8.5,
    sharpeRatio: 1.25,
    sortinoRatio: 1.68,
    volatility: 15.2,
    valueAtRisk: 3.2,
    expectedShortfall: 4.8,
    maxPositionSize: 8.5,
    portfolioRisk: 12.3
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const calculatePositionSize = useCallback(() => {
    // Mock calculation based on Kelly criterion or other methods
    let positionSize = 0;
    switch (sizingConfig.method) {
      case 'fixed_percent':
        positionSize = sizingConfig.riskPerTrade;
        break;
      case 'kelly':
        // Kelly criterion calculation
        const winRate = 0.55;
        const avgWin = 0.12;
        const avgLoss = 0.08;
        const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
        positionSize = Math.min(kellyFraction * 100, sizingConfig.maxPositionSize);
        break;
      case 'volatility_adjusted':
        const targetVolatility = 0.02;
        const currentVolatility = currentMetrics.volatility / 100;
        positionSize = (targetVolatility / currentVolatility) * sizingConfig.riskPerTrade;
        break;
      default:
        positionSize = sizingConfig.riskPerTrade;
    }
    
    return Math.min(positionSize, sizingConfig.maxPositionSize);
  }, [sizingConfig, currentMetrics.volatility]);

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...sizingConfig, [key]: value };
    setSizingConfig(newConfig);
    onDataChange?.(newConfig);
  };

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4" />
            Position Sizing
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Percent className="h-3 w-3 mr-1" />
              {calculatePositionSize().toFixed(1)}%
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Sizing Method</Label>
          <Select
            value={sizingConfig.method}
            onValueChange={(value) => updateConfig('method', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed_percent">Fixed Percent</SelectItem>
              <SelectItem value="kelly">Kelly Criterion</SelectItem>
              <SelectItem value="volatility_adjusted">Volatility Adjusted</SelectItem>
              <SelectItem value="risk_parity">Risk Parity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Risk Per Trade (%)</Label>
            <div className="px-2">
              <Slider
                value={[sizingConfig.riskPerTrade]}
                onValueChange={(value) => updateConfig('riskPerTrade', value[0])}
                max={10}
                min={0.5}
                step={0.1}
                className="w-full"
              />
              <div className="text-center text-sm text-muted-foreground mt-1">
                {sizingConfig.riskPerTrade}%
              </div>
            </div>
          </div>
          <div>
            <Label>Max Position (%)</Label>
            <div className="px-2">
              <Slider
                value={[sizingConfig.maxPositionSize]}
                onValueChange={(value) => updateConfig('maxPositionSize', value[0])}
                max={25}
                min={1}
                step={0.5}
                className="w-full"
              />
              <div className="text-center text-sm text-muted-foreground mt-1">
                {sizingConfig.maxPositionSize}%
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <Tabs defaultValue="settings">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="metrics">Risk Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Volatility Lookback</Label>
                  <Input
                    type="number"
                    value={sizingConfig.volatilityLookback}
                    onChange={(e) => updateConfig('volatilityLookback', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Confidence Level</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.9"
                    max="0.99"
                    value={sizingConfig.confidence}
                    onChange={(e) => updateConfig('confidence', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Dynamic Sizing</Label>
                <Switch
                  checked={sizingConfig.enableDynamicSizing}
                  onCheckedChange={(checked) => updateConfig('enableDynamicSizing', checked)}
                />
              </div>

              <div>
                <Label>Portfolio Heat Limit (%)</Label>
                <Slider
                  value={[sizingConfig.portfolioHeatLimit]}
                  onValueChange={(value) => updateConfig('portfolioHeatLimit', value[0])}
                  max={50}
                  min={5}
                  step={1}
                />
                <div className="text-center text-sm text-muted-foreground mt-1">
                  {sizingConfig.portfolioHeatLimit}%
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Current Volatility</Label>
                  <div className="font-mono">{currentMetrics.volatility.toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Value at Risk</Label>
                  <div className="font-mono">{currentMetrics.valueAtRisk.toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Sharpe Ratio</Label>
                  <div className="font-mono">{currentMetrics.sharpeRatio.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Max Drawdown</Label>
                  <div className="font-mono">{currentMetrics.maxDrawdown.toFixed(1)}%</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Price Signal"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Volatility"></div>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full" title="Position Size"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Stop Loss Node
export const StopLossNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [stopConfig, setStopConfig] = useState({
    type: 'percentage' as 'percentage' | 'atr' | 'trailing' | 'volatility_based',
    percentage: 2.0,
    atrMultiplier: 2.0,
    atrPeriod: 14,
    trailingDistance: 1.5,
    enableBreakeven: true,
    breakEvenTrigger: 1.0,
    ...data
  });

  const [isActive, setIsActive] = useState(true);
  const [currentStopPrice, setCurrentStopPrice] = useState(0);

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...stopConfig, [key]: value };
    setStopConfig(newConfig);
    onDataChange?.(newConfig);
  };

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingDown className="h-4 w-4" />
            Stop Loss
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? "destructive" : "secondary"}>
              <Shield className="h-3 w-3 mr-1" />
              {stopConfig.percentage}%
            </Badge>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Stop Loss Type</Label>
          <Select
            value={stopConfig.type}
            onValueChange={(value) => updateConfig('type', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Fixed Percentage</SelectItem>
              <SelectItem value="atr">ATR Based</SelectItem>
              <SelectItem value="trailing">Trailing Stop</SelectItem>
              <SelectItem value="volatility_based">Volatility Based</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stopConfig.type === 'percentage' && (
          <div>
            <Label>Stop Loss Percentage (%)</Label>
            <Slider
              value={[stopConfig.percentage]}
              onValueChange={(value) => updateConfig('percentage', value[0])}
              max={10}
              min={0.5}
              step={0.1}
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {stopConfig.percentage}%
            </div>
          </div>
        )}

        {stopConfig.type === 'atr' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ATR Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                value={stopConfig.atrMultiplier}
                onChange={(e) => updateConfig('atrMultiplier', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>ATR Period</Label>
              <Input
                type="number"
                value={stopConfig.atrPeriod}
                onChange={(e) => updateConfig('atrPeriod', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        {stopConfig.type === 'trailing' && (
          <div>
            <Label>Trailing Distance (%)</Label>
            <Slider
              value={[stopConfig.trailingDistance]}
              onValueChange={(value) => updateConfig('trailingDistance', value[0])}
              max={5}
              min={0.5}
              step={0.1}
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {stopConfig.trailingDistance}%
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label>Break-Even Stop</Label>
          <Switch
            checked={stopConfig.enableBreakeven}
            onCheckedChange={(checked) => updateConfig('enableBreakeven', checked)}
          />
        </div>

        {stopConfig.enableBreakeven && (
          <div>
            <Label>Break-Even Trigger (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={stopConfig.breakEvenTrigger}
              onChange={(e) => updateConfig('breakEvenTrigger', parseFloat(e.target.value))}
            />
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Entry Price"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Current Price"></div>
          </div>
          <div className="w-3 h-3 bg-red-500 rounded-full" title="Stop Signal"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Take Profit Node
export const TakeProfitNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [profitConfig, setProfitConfig] = useState({
    type: 'percentage' as 'percentage' | 'ratio' | 'scaled' | 'fibonacci',
    percentage: 4.0,
    riskRewardRatio: 2.0,
    scalingLevels: [2.0, 4.0, 6.0],
    scalingWeights: [50, 30, 20],
    fibonacciLevels: [1.618, 2.618, 4.236],
    ...data
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...profitConfig, [key]: value };
    setProfitConfig(newConfig);
    onDataChange?.(newConfig);
  };

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Take Profit
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <Target className="h-3 w-3 mr-1" />
              {profitConfig.percentage}%
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Take Profit Type</Label>
          <Select
            value={profitConfig.type}
            onValueChange={(value) => updateConfig('type', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Fixed Percentage</SelectItem>
              <SelectItem value="ratio">Risk/Reward Ratio</SelectItem>
              <SelectItem value="scaled">Scaled Exit</SelectItem>
              <SelectItem value="fibonacci">Fibonacci Levels</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {profitConfig.type === 'percentage' && (
          <div>
            <Label>Take Profit Percentage (%)</Label>
            <Slider
              value={[profitConfig.percentage]}
              onValueChange={(value) => updateConfig('percentage', value[0])}
              max={20}
              min={1}
              step={0.5}
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {profitConfig.percentage}%
            </div>
          </div>
        )}

        {profitConfig.type === 'ratio' && (
          <div>
            <Label>Risk/Reward Ratio</Label>
            <Slider
              value={[profitConfig.riskRewardRatio]}
              onValueChange={(value) => updateConfig('riskRewardRatio', value[0])}
              max={5}
              min={1}
              step={0.1}
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              1:{profitConfig.riskRewardRatio}
            </div>
          </div>
        )}

        {profitConfig.type === 'scaled' && isExpanded && (
          <div className="space-y-4">
            <div>
              <Label>Scaling Levels (%)</Label>
              <Input
                value={profitConfig.scalingLevels.join(',')}
                onChange={(e) => {
                  const levels = e.target.value.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                  updateConfig('scalingLevels', levels);
                }}
                placeholder="2.0,4.0,6.0"
              />
            </div>
            <div>
              <Label>Position Weights (%)</Label>
              <Input
                value={profitConfig.scalingWeights.join(',')}
                onChange={(e) => {
                  const weights = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                  updateConfig('scalingWeights', weights);
                }}
                placeholder="50,30,20"
              />
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Entry Price"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Current Price"></div>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full" title="Profit Signal"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Portfolio Risk Monitor Node
export const PortfolioRiskMonitorNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [riskConfig, setRiskConfig] = useState({
    maxDrawdown: 15.0,
    maxVolatility: 20.0,
    concentrationLimit: 25.0, // max % in single position
    correlationLimit: 0.7,
    leverageLimit: 2.0,
    enableRealTimeMonitoring: true,
    alertThresholds: {
      drawdown: 10.0,
      volatility: 18.0,
      concentration: 20.0
    },
    ...data
  });

  const [currentRisk, setCurrentRisk] = useState({
    currentDrawdown: 8.5,
    currentVolatility: 15.2,
    maxConcentration: 18.3,
    avgCorrelation: 0.45,
    currentLeverage: 1.2,
    riskScore: 72 // out of 100
  });

  const [alerts, setAlerts] = useState<string[]>([]);

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Low', color: 'success' };
    if (score >= 60) return { level: 'Medium', color: 'warning' };
    return { level: 'High', color: 'destructive' };
  };

  const riskLevel = getRiskLevel(currentRisk.riskScore);

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Portfolio Risk Monitor
          </CardTitle>
          <Badge variant={riskLevel.color as any}>
            <Activity className="h-3 w-3 mr-1" />
            {riskLevel.level}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Drawdown</Label>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm">{currentRisk.currentDrawdown.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">/{riskConfig.maxDrawdown}%</div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Volatility</Label>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm">{currentRisk.currentVolatility.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">/{riskConfig.maxVolatility}%</div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Max Position</Label>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm">{currentRisk.maxConcentration.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">/{riskConfig.concentrationLimit}%</div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Risk Score</Label>
            <div className="font-mono text-sm">{currentRisk.riskScore}/100</div>
          </div>
        </div>

        {alerts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {alerts.map((alert, index) => (
                  <div key={index} className="text-xs">{alert}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="limits">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="limits">Limits</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="limits" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Drawdown (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={riskConfig.maxDrawdown}
                  onChange={(e) => {
                    const newConfig = { ...riskConfig, maxDrawdown: parseFloat(e.target.value) };
                    setRiskConfig(newConfig);
                    onDataChange?.(newConfig);
                  }}
                />
              </div>
              <div>
                <Label>Max Volatility (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={riskConfig.maxVolatility}
                  onChange={(e) => {
                    const newConfig = { ...riskConfig, maxVolatility: parseFloat(e.target.value) };
                    setRiskConfig(newConfig);
                    onDataChange?.(newConfig);
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Real-time Monitoring</Label>
              <Switch
                checked={riskConfig.enableRealTimeMonitoring}
                onCheckedChange={(checked) => {
                  const newConfig = { ...riskConfig, enableRealTimeMonitoring: checked };
                  setRiskConfig(newConfig);
                  onDataChange?.(newConfig);
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Portfolio Data"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Market Data"></div>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" title="Risk Alerts"></div>
            <div className="w-3 h-3 bg-red-500 rounded-full" title="Emergency Stop"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Dynamic Hedging Node
export const DynamicHedgingNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [hedgeConfig, setHedgeConfig] = useState({
    strategy: 'delta_neutral' as 'delta_neutral' | 'beta_hedge' | 'pairs_trading' | 'volatility_hedge',
    triggerCondition: 'drawdown' as 'drawdown' | 'volatility' | 'correlation' | 'manual',
    threshold: 5.0,
    hedgeRatio: 0.5,
    rebalanceFrequency: 'daily' as 'hourly' | 'daily' | 'weekly',
    enableAutomaticHedge: false,
    maxHedgeSize: 50, // percentage of portfolio
    ...data
  });

  const [isHedgeActive, setIsHedgeActive] = useState(false);

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4" />
            Dynamic Hedging
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isHedgeActive ? "success" : "secondary"}>
              <Timer className="h-3 w-3 mr-1" />
              {isHedgeActive ? 'Active' : 'Inactive'}
            </Badge>
            <Switch checked={isHedgeActive} onCheckedChange={setIsHedgeActive} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Hedging Strategy</Label>
          <Select
            value={hedgeConfig.strategy}
            onValueChange={(value) => {
              const newConfig = { ...hedgeConfig, strategy: value as any };
              setHedgeConfig(newConfig);
              onDataChange?.(newConfig);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delta_neutral">Delta Neutral</SelectItem>
              <SelectItem value="beta_hedge">Beta Hedge</SelectItem>
              <SelectItem value="pairs_trading">Pairs Trading</SelectItem>
              <SelectItem value="volatility_hedge">Volatility Hedge</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Trigger Threshold</Label>
            <Input
              type="number"
              step="0.5"
              value={hedgeConfig.threshold}
              onChange={(e) => {
                const newConfig = { ...hedgeConfig, threshold: parseFloat(e.target.value) };
                setHedgeConfig(newConfig);
                onDataChange?.(newConfig);
              }}
            />
          </div>
          <div>
            <Label>Hedge Ratio</Label>
            <Slider
              value={[hedgeConfig.hedgeRatio]}
              onValueChange={(value) => {
                const newConfig = { ...hedgeConfig, hedgeRatio: value[0] };
                setHedgeConfig(newConfig);
                onDataChange?.(newConfig);
              }}
              max={1}
              min={0.1}
              step={0.1}
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {hedgeConfig.hedgeRatio.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Portfolio Delta"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Market Data"></div>
          </div>
          <div className="w-3 h-3 bg-purple-500 rounded-full" title="Hedge Signal"></div>
        </div>
      </CardContent>
    </Card>
  );
};