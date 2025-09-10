/**
 * Portfolio Management Nodes - FE-009
 * 
 * Advanced node types for comprehensive portfolio management within the visual strategy builder.
 * Supports rebalancing, allocation optimization, and multi-asset portfolio management.
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
import { Progress } from '../ui/progress';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  Balance,
  Target,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  DollarSign,
  Percent,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { NodeComponentProps } from './types';

interface AssetAllocation {
  symbol: string;
  targetWeight: number;
  currentWeight: number;
  deviation: number;
}

interface PortfolioMetrics {
  totalValue: number;
  totalReturn: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  lastRebalance: Date;
}

// Portfolio Rebalancing Node
export const PortfolioRebalancingNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [rebalanceConfig, setRebalanceConfig] = useState({
    method: 'threshold' as 'threshold' | 'calendar' | 'volatility' | 'momentum',
    threshold: 5.0, // percentage deviation
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly',
    minRebalanceAmount: 1000,
    transactionCosts: 0.1, // percentage
    enableTaxOptimization: false,
    allowableDeviation: 2.0,
    ...data
  });

  const [allocations, setAllocations] = useState<AssetAllocation[]>([
    { symbol: 'BTC', targetWeight: 40, currentWeight: 45, deviation: 5 },
    { symbol: 'ETH', targetWeight: 30, currentWeight: 28, deviation: -2 },
    { symbol: 'SOL', targetWeight: 20, currentWeight: 18, deviation: -2 },
    { symbol: 'CASH', targetWeight: 10, currentWeight: 9, deviation: -1 }
  ]);

  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics>({
    totalValue: 125000,
    totalReturn: 12.5,
    sharpeRatio: 1.35,
    volatility: 18.2,
    maxDrawdown: 8.5,
    lastRebalance: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);

  const needsRebalancing = allocations.some(asset => 
    Math.abs(asset.deviation) > rebalanceConfig.threshold
  );

  const executeRebalancing = useCallback(async () => {
    setIsRebalancing(true);
    // Simulate rebalancing process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update allocations to match targets
    const newAllocations = allocations.map(asset => ({
      ...asset,
      currentWeight: asset.targetWeight + (Math.random() - 0.5) * 0.5,
      deviation: (Math.random() - 0.5) * 0.5
    }));
    
    setAllocations(newAllocations);
    setPortfolioMetrics(prev => ({ ...prev, lastRebalance: new Date() }));
    setIsRebalancing(false);
  }, [allocations]);

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...rebalanceConfig, [key]: value };
    setRebalanceConfig(newConfig);
    onDataChange?.(newConfig);
  };

  const updateAllocation = (index: number, field: keyof AssetAllocation, value: number) => {
    const newAllocations = [...allocations];
    (newAllocations[index] as any)[field] = value;
    setAllocations(newAllocations);
  };

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Balance className="h-4 w-4" />
            Portfolio Rebalancing
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={needsRebalancing ? "destructive" : "success"}>
              <RefreshCw className={`h-3 w-3 mr-1 ${isRebalancing ? 'animate-spin' : ''}`} />
              {needsRebalancing ? 'Needs Rebalance' : 'Balanced'}
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
        {/* Current Allocations */}
        <div>
          <Label className="text-xs mb-2 block">Current vs Target Allocation</Label>
          <div className="space-y-2">
            {allocations.map((asset, index) => (
              <div key={asset.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-12 text-xs">{asset.symbol}</Badge>
                  <div className="text-sm">
                    {asset.currentWeight.toFixed(1)}% / {asset.targetWeight}%
                  </div>
                </div>
                <div className={`text-sm font-mono ${
                  asset.deviation > 0 ? 'text-red-500' : asset.deviation < 0 ? 'text-blue-500' : 'text-green-500'
                }`}>
                  {asset.deviation > 0 ? '+' : ''}{asset.deviation.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rebalancing Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Method</Label>
            <Select
              value={rebalanceConfig.method}
              onValueChange={(value) => updateConfig('method', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="threshold">Threshold</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
                <SelectItem value="volatility">Volatility</SelectItem>
                <SelectItem value="momentum">Momentum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Threshold (%)</Label>
            <Input
              type="number"
              step="0.5"
              value={rebalanceConfig.threshold}
              onChange={(e) => updateConfig('threshold', parseFloat(e.target.value))}
            />
          </div>
        </div>

        {/* Expanded Configuration */}
        {isExpanded && (
          <Tabs defaultValue="settings">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="targets">Targets</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequency</Label>
                  <Select
                    value={rebalanceConfig.frequency}
                    onValueChange={(value) => updateConfig('frequency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Min Amount ($)</Label>
                  <Input
                    type="number"
                    value={rebalanceConfig.minRebalanceAmount}
                    onChange={(e) => updateConfig('minRebalanceAmount', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Transaction Costs (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rebalanceConfig.transactionCosts}
                    onChange={(e) => updateConfig('transactionCosts', parseFloat(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between col-span-2">
                  <Label>Tax Optimization</Label>
                  <Switch
                    checked={rebalanceConfig.enableTaxOptimization}
                    onCheckedChange={(checked) => updateConfig('enableTaxOptimization', checked)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="targets" className="space-y-4">
              <div>
                <Label>Asset Target Allocations</Label>
                <div className="space-y-3">
                  {allocations.map((asset, index) => (
                    <div key={asset.symbol} className="grid grid-cols-3 gap-2 items-center">
                      <Badge variant="outline">{asset.symbol}</Badge>
                      <div className="px-2">
                        <Slider
                          value={[asset.targetWeight]}
                          onValueChange={(value) => updateAllocation(index, 'targetWeight', value[0])}
                          max={50}
                          min={0}
                          step={1}
                        />
                      </div>
                      <div className="text-sm text-center">{asset.targetWeight}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Portfolio Value</Label>
                  <div className="font-mono">${portfolioMetrics.totalValue.toLocaleString()}</div>
                </div>
                <div>
                  <Label>Total Return</Label>
                  <div className="font-mono">{portfolioMetrics.totalReturn.toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Sharpe Ratio</Label>
                  <div className="font-mono">{portfolioMetrics.sharpeRatio.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Volatility</Label>
                  <div className="font-mono">{portfolioMetrics.volatility.toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Max Drawdown</Label>
                  <div className="font-mono">{portfolioMetrics.maxDrawdown.toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Last Rebalance</Label>
                  <div className="text-xs">{portfolioMetrics.lastRebalance.toLocaleDateString()}</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Rebalance Button */}
        <Button 
          onClick={executeRebalancing}
          disabled={isRebalancing || !needsRebalancing}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRebalancing ? 'animate-spin' : ''}`} />
          {isRebalancing ? 'Rebalancing...' : 'Execute Rebalance'}
        </Button>

        {/* Connection Points */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Portfolio Data"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Price Feed"></div>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full" title="Trade Orders"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full" title="Rebalance Signal"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Asset Allocation Optimizer Node
export const AssetAllocationOptimizerNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [optimizerConfig, setOptimizerConfig] = useState({
    objective: 'max_sharpe' as 'max_sharpe' | 'min_volatility' | 'max_return' | 'efficient_frontier',
    constraints: {
      minWeight: 0.05,
      maxWeight: 0.4,
      targetReturn: 0.12,
      maxVolatility: 0.20
    },
    lookbackPeriod: 252, // days
    rebalanceFrequency: 'monthly',
    transactionCosts: 0.1,
    ...data
  });

  const [optimizationResults, setOptimizationResults] = useState({
    expectedReturn: 0.125,
    expectedVolatility: 0.165,
    sharpeRatio: 0.758,
    weights: [0.35, 0.25, 0.20, 0.20],
    assets: ['BTC', 'ETH', 'SOL', 'CASH']
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const runOptimization = useCallback(async () => {
    setIsOptimizing(true);
    // Simulate optimization process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock optimization results
    const newWeights = Array.from({ length: 4 }, () => Math.random()).map(w => w / 4);
    const normalizedWeights = newWeights.map(w => w / newWeights.reduce((sum, weight) => sum + weight, 0));
    
    setOptimizationResults(prev => ({
      ...prev,
      weights: normalizedWeights,
      expectedReturn: 0.10 + Math.random() * 0.10,
      expectedVolatility: 0.12 + Math.random() * 0.08,
      sharpeRatio: 0.6 + Math.random() * 0.4
    }));
    
    setIsOptimizing(false);
  }, []);

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4" />
            Asset Allocation Optimizer
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <TrendingUp className="h-3 w-3 mr-1" />
              Sharpe: {optimizationResults.sharpeRatio.toFixed(2)}
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
          <Label>Optimization Objective</Label>
          <Select
            value={optimizerConfig.objective}
            onValueChange={(value) => {
              const newConfig = { ...optimizerConfig, objective: value as any };
              setOptimizerConfig(newConfig);
              onDataChange?.(newConfig);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="max_sharpe">Maximize Sharpe Ratio</SelectItem>
              <SelectItem value="min_volatility">Minimize Volatility</SelectItem>
              <SelectItem value="max_return">Maximize Return</SelectItem>
              <SelectItem value="efficient_frontier">Efficient Frontier</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Optimization Results */}
        <div>
          <Label className="text-xs mb-2 block">Optimal Allocation</Label>
          <div className="space-y-2">
            {optimizationResults.assets.map((asset, index) => (
              <div key={asset} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-12 text-xs">{asset}</Badge>
                  <Progress 
                    value={optimizationResults.weights[index] * 100} 
                    className="w-24 h-2"
                  />
                </div>
                <div className="text-sm font-mono">
                  {(optimizationResults.weights[index] * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {isExpanded && (
          <Tabs defaultValue="constraints">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="constraints">Constraints</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="constraints" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Weight (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={optimizerConfig.constraints.minWeight}
                    onChange={(e) => {
                      const newConfig = {
                        ...optimizerConfig,
                        constraints: {
                          ...optimizerConfig.constraints,
                          minWeight: parseFloat(e.target.value)
                        }
                      };
                      setOptimizerConfig(newConfig);
                      onDataChange?.(newConfig);
                    }}
                  />
                </div>
                <div>
                  <Label>Max Weight (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={optimizerConfig.constraints.maxWeight}
                    onChange={(e) => {
                      const newConfig = {
                        ...optimizerConfig,
                        constraints: {
                          ...optimizerConfig.constraints,
                          maxWeight: parseFloat(e.target.value)
                        }
                      };
                      setOptimizerConfig(newConfig);
                      onDataChange?.(newConfig);
                    }}
                  />
                </div>
                <div>
                  <Label>Target Return</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={optimizerConfig.constraints.targetReturn}
                    onChange={(e) => {
                      const newConfig = {
                        ...optimizerConfig,
                        constraints: {
                          ...optimizerConfig.constraints,
                          targetReturn: parseFloat(e.target.value)
                        }
                      };
                      setOptimizerConfig(newConfig);
                      onDataChange?.(newConfig);
                    }}
                  />
                </div>
                <div>
                  <Label>Max Volatility</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={optimizerConfig.constraints.maxVolatility}
                    onChange={(e) => {
                      const newConfig = {
                        ...optimizerConfig,
                        constraints: {
                          ...optimizerConfig.constraints,
                          maxVolatility: parseFloat(e.target.value)
                        }
                      };
                      setOptimizerConfig(newConfig);
                      onDataChange?.(newConfig);
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Expected Return</Label>
                  <div className="font-mono">{(optimizationResults.expectedReturn * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Expected Volatility</Label>
                  <div className="font-mono">{(optimizationResults.expectedVolatility * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <Label>Sharpe Ratio</Label>
                  <div className="font-mono">{optimizationResults.sharpeRatio.toFixed(3)}</div>
                </div>
                <div>
                  <Label>Lookback Period</Label>
                  <div className="text-xs">{optimizerConfig.lookbackPeriod} days</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <Button 
          onClick={runOptimization}
          disabled={isOptimizing}
          className="w-full"
        >
          <Target className={`h-4 w-4 mr-2 ${isOptimizing ? 'animate-spin' : ''}`} />
          {isOptimizing ? 'Optimizing...' : 'Run Optimization'}
        </Button>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Historical Data"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Risk Preferences"></div>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full" title="Optimal Weights"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Multi-Asset Portfolio Node
export const MultiAssetPortfolioNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [portfolioConfig, setPortfolioConfig] = useState({
    assets: ['BTC', 'ETH', 'SOL', 'LINK', 'DOT'],
    assetClasses: ['crypto', 'crypto', 'crypto', 'crypto', 'crypto'],
    correlationThreshold: 0.8,
    diversificationTarget: 'optimal' as 'equal_weight' | 'market_cap' | 'risk_parity' | 'optimal',
    rebalanceThreshold: 5.0,
    enableCurrencyHedging: false,
    ...data
  });

  const [portfolioAnalysis, setPortfolioAnalysis] = useState({
    diversificationRatio: 0.82,
    concentrationRisk: 0.35,
    correlationRisk: 0.42,
    totalAssets: 5,
    effectiveAssets: 4.1
  });

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PieChart className="h-4 w-4" />
            Multi-Asset Portfolio
          </CardTitle>
          <Badge variant="outline">
            <BarChart3 className="h-3 w-3 mr-1" />
            {portfolioAnalysis.totalAssets} Assets
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Diversification Strategy</Label>
          <Select
            value={portfolioConfig.diversificationTarget}
            onValueChange={(value) => {
              const newConfig = { ...portfolioConfig, diversificationTarget: value as any };
              setPortfolioConfig(newConfig);
              onDataChange?.(newConfig);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equal_weight">Equal Weight</SelectItem>
              <SelectItem value="market_cap">Market Cap Weighted</SelectItem>
              <SelectItem value="risk_parity">Risk Parity</SelectItem>
              <SelectItem value="optimal">Optimal Diversification</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Diversification Ratio</Label>
            <div className="font-mono text-lg">{portfolioAnalysis.diversificationRatio.toFixed(2)}</div>
          </div>
          <div>
            <Label className="text-xs">Effective Assets</Label>
            <div className="font-mono text-lg">{portfolioAnalysis.effectiveAssets.toFixed(1)}</div>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Asset Distribution</Label>
          <div className="flex flex-wrap gap-1">
            {portfolioConfig.assets.map((asset, index) => (
              <Badge key={asset} variant="outline" className="text-xs">
                {asset}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Asset Prices"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Correlation Matrix"></div>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full" title="Portfolio Signal"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Performance Attribution Node
export const PerformanceAttributionNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [attributionData, setAttributionData] = useState({
    totalReturn: 12.5,
    benchmarkReturn: 8.3,
    activeReturn: 4.2,
    attribution: {
      assetAllocation: 1.8,
      securitySelection: 2.1,
      interaction: 0.3
    },
    contributions: [
      { asset: 'BTC', contribution: 6.2 },
      { asset: 'ETH', contribution: 3.1 },
      { asset: 'SOL', contribution: 2.4 },
      { asset: 'LINK', contribution: 0.8 }
    ]
  });

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4" />
          Performance Attribution
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Total Return</Label>
            <div className="font-mono text-lg">{attributionData.totalReturn.toFixed(1)}%</div>
          </div>
          <div>
            <Label className="text-xs">Active Return</Label>
            <div className="font-mono text-lg">{attributionData.activeReturn.toFixed(1)}%</div>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Attribution Breakdown</Label>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Asset Allocation</span>
              <span className="font-mono text-sm">{attributionData.attribution.assetAllocation.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Security Selection</span>
              <span className="font-mono text-sm">{attributionData.attribution.securitySelection.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Interaction Effect</span>
              <span className="font-mono text-sm">{attributionData.attribution.interaction.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Asset Contributions</Label>
          <div className="space-y-1">
            {attributionData.contributions.map((item) => (
              <div key={item.asset} className="flex items-center justify-between">
                <Badge variant="outline" className="w-12 text-xs">{item.asset}</Badge>
                <div className="flex items-center gap-2 flex-1 ml-2">
                  <Progress value={Math.abs(item.contribution) * 10} className="flex-1 h-2" />
                  <span className="font-mono text-xs w-12 text-right">
                    {item.contribution.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="w-3 h-3 bg-blue-500 rounded-full" title="Portfolio Performance"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full" title="Attribution Report"></div>
        </div>
      </CardContent>
    </Card>
  );
};