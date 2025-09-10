/**
 * Live Performance Monitor - FE-010
 * 
 * Real-time performance monitoring and visualization for strategy preview.
 * Provides live metrics, charts, and performance analytics.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  DollarSign,
  Target,
  AlertTriangle,
  Zap,
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface PerformanceData {
  timestamp: number;
  equity: number;
  drawdown: number;
  trades: number;
  winRate: number;
  profitLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  volatility: number;
}

interface TradeSignal {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  confidence: number;
  reason: string;
}

interface LiveMetrics {
  currentEquity: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  unrealizedPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

interface LivePerformanceMonitorProps {
  isActive: boolean;
  strategyName: string;
  onToggleMonitoring?: (active: boolean) => void;
  updateInterval?: number;
}

export const LivePerformanceMonitor: React.FC<LivePerformanceMonitorProps> = ({
  isActive,
  strategyName,
  onToggleMonitoring,
  updateInterval = 1000
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<LiveMetrics>({
    currentEquity: 10000,
    dailyPnL: 0,
    dailyPnLPercent: 0,
    unrealizedPnL: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    currentDrawdown: 0,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  });

  const [recentSignals, setRecentSignals] = useState<TradeSignal[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('5m');

  // Simulate live data updates
  const generateMockData = useCallback(() => {
    const now = Date.now();
    const volatility = 0.02;
    const drift = 0.0001;
    
    // Generate price movement
    const randomChange = (Math.random() - 0.5) * volatility + drift;
    const newEquity = currentMetrics.currentEquity * (1 + randomChange);
    
    // Occasionally generate trades
    const shouldGenerateTrade = Math.random() < 0.1; // 10% chance per update
    let newSignals = [...recentSignals];
    
    if (shouldGenerateTrade && isActive) {
      const signal: TradeSignal = {
        id: `signal_${now}`,
        timestamp: now,
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        price: 50000 + Math.random() * 10000,
        quantity: Math.random() * 0.1,
        confidence: 0.6 + Math.random() * 0.4,
        reason: ['Technical breakout', 'Mean reversion', 'Momentum signal', 'Volume spike'][Math.floor(Math.random() * 4)]
      };
      
      newSignals = [signal, ...newSignals.slice(0, 9)]; // Keep last 10 signals
      setRecentSignals(newSignals);
    }

    // Update performance data
    const newDataPoint: PerformanceData = {
      timestamp: now,
      equity: newEquity,
      drawdown: Math.max(0, (currentMetrics.currentEquity - newEquity) / currentMetrics.currentEquity * 100),
      trades: currentMetrics.totalTrades + (shouldGenerateTrade ? 1 : 0),
      winRate: Math.random() * 0.4 + 0.4, // 40-80% win rate
      profitLoss: newEquity - 10000,
      sharpeRatio: Math.random() * 1.5 + 0.5,
      maxDrawdown: Math.max(currentMetrics.maxDrawdown, (currentMetrics.currentEquity - newEquity) / currentMetrics.currentEquity * 100),
      totalReturn: (newEquity - 10000) / 10000 * 100,
      volatility: Math.random() * 0.1 + 0.05
    };

    setPerformanceData(prev => [...prev.slice(-100), newDataPoint]); // Keep last 100 points

    // Update current metrics
    const dailyPnL = newEquity - currentMetrics.currentEquity;
    setCurrentMetrics(prev => ({
      ...prev,
      currentEquity: newEquity,
      dailyPnL,
      dailyPnLPercent: (dailyPnL / prev.currentEquity) * 100,
      totalTrades: prev.totalTrades + (shouldGenerateTrade ? 1 : 0),
      winRate: newDataPoint.winRate * 100,
      profitFactor: Math.random() * 1.5 + 0.8,
      sharpeRatio: newDataPoint.sharpeRatio,
      maxDrawdown: newDataPoint.maxDrawdown,
      currentDrawdown: newDataPoint.drawdown,
      unrealizedPnL: Math.random() * 200 - 100
    }));
  }, [currentMetrics, recentSignals, isActive]);

  // Auto-update when monitoring is active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(generateMockData, updateInterval);
    return () => clearInterval(interval);
  }, [isActive, updateInterval, generateMockData]);

  // Calculate performance indicators
  const performanceIndicators = useMemo(() => {
    const indicators = [];
    
    if (currentMetrics.dailyPnLPercent > 2) {
      indicators.push({ type: 'success', text: 'Strong Performance', icon: TrendingUp });
    } else if (currentMetrics.dailyPnLPercent < -2) {
      indicators.push({ type: 'danger', text: 'Underperforming', icon: TrendingDown });
    }

    if (currentMetrics.currentDrawdown > 5) {
      indicators.push({ type: 'warning', text: 'High Drawdown', icon: AlertTriangle });
    }

    if (currentMetrics.winRate > 70) {
      indicators.push({ type: 'success', text: 'High Win Rate', icon: Target });
    }

    return indicators;
  }, [currentMetrics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <Card className={`transition-all duration-300 ${isExpanded ? 'col-span-2' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className={`h-5 w-5 ${isActive ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
              Live Performance
            </CardTitle>
            <Badge variant={isActive ? "success" : "secondary"}>
              {isActive ? 'LIVE' : 'PAUSED'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {performanceIndicators.map((indicator, index) => (
              <Badge key={index} variant={indicator.type as any}>
                <indicator.icon className="h-3 w-3 mr-1" />
                {indicator.text}
              </Badge>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!isExpanded ? (
          // Compact view
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(currentMetrics.currentEquity)}
              </div>
              <div className="text-xs text-muted-foreground">Current Equity</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${currentMetrics.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(currentMetrics.dailyPnLPercent)}
              </div>
              <div className="text-xs text-muted-foreground">Daily P&L</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {currentMetrics.winRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {currentMetrics.totalTrades}
              </div>
              <div className="text-xs text-muted-foreground">Total Trades</div>
            </div>
          </div>
        ) : (
          // Expanded view
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trades">Trades</TabsTrigger>
              <TabsTrigger value="risk">Risk</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Equity</span>
                    <span className="font-mono text-lg font-bold">
                      {formatCurrency(currentMetrics.currentEquity)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Daily P&L</span>
                    <span className={`font-mono ${currentMetrics.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(currentMetrics.dailyPnL)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Daily P&L %</span>
                    <span className={`font-mono ${currentMetrics.dailyPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(currentMetrics.dailyPnLPercent)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Trades</span>
                    <span className="font-mono">{currentMetrics.totalTrades}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Win Rate</span>
                    <span className="font-mono">{currentMetrics.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Profit Factor</span>
                    <span className="font-mono">{currentMetrics.profitFactor.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                    <span className="font-mono">{currentMetrics.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Max Drawdown</span>
                    <span className="font-mono text-red-600">{currentMetrics.maxDrawdown.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current DD</span>
                    <span className="font-mono text-red-600">{currentMetrics.currentDrawdown.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Unrealized P&L</span>
                    <span className={`font-mono ${currentMetrics.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(currentMetrics.unrealizedPnL)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Consecutive Wins</span>
                    <span className="font-mono">{currentMetrics.consecutiveWins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Consecutive Losses</span>
                    <span className="font-mono">{currentMetrics.consecutiveLosses}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Drawdown Progress</span>
                  <span className="text-sm">{currentMetrics.currentDrawdown.toFixed(1)}%</span>
                </div>
                <Progress value={currentMetrics.currentDrawdown} className="h-2" />
              </div>
            </TabsContent>

            <TabsContent value="trades" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{currentMetrics.winningTrades}</div>
                  <div className="text-xs text-muted-foreground">Winning Trades</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{currentMetrics.losingTrades}</div>
                  <div className="text-xs text-muted-foreground">Losing Trades</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{currentMetrics.totalTrades}</div>
                  <div className="text-xs text-muted-foreground">Total Trades</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Average Win</span>
                    <span className="font-mono text-green-600">{formatCurrency(currentMetrics.averageWin)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Largest Win</span>
                    <span className="font-mono text-green-600">{formatCurrency(currentMetrics.largestWin)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Average Loss</span>
                    <span className="font-mono text-red-600">{formatCurrency(currentMetrics.averageLoss)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Largest Loss</span>
                    <span className="font-mono text-red-600">{formatCurrency(currentMetrics.largestLoss)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="risk" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Risk Metrics</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Value at Risk (1%)</span>
                      <span className="font-mono">-2.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Shortfall</span>
                      <span className="font-mono">-3.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Beta</span>
                      <span className="font-mono">1.15</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Correlation to Market</span>
                      <span className="font-mono">0.72</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Position Sizing</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Current Position</span>
                      <span className="font-mono">$2,500</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Position Size</span>
                      <span className="font-mono">$5,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk per Trade</span>
                      <span className="font-mono">2.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Portfolio Utilization</span>
                      <span className="font-mono">50%</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signals" className="space-y-4">
              <div className="text-sm font-medium mb-2">Recent Trading Signals</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={signal.type === 'buy' ? 'success' : 'destructive'}>
                        {signal.type.toUpperCase()}
                      </Badge>
                      <div>
                        <div className="font-mono text-sm">{formatCurrency(signal.price)}</div>
                        <div className="text-xs text-muted-foreground">{signal.reason}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{signal.quantity.toFixed(4)}</div>
                      <div className="text-xs text-muted-foreground">
                        {(signal.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
                {recentSignals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent signals
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <Button 
            size="sm"
            onClick={() => onToggleMonitoring?.(!isActive)}
            variant={isActive ? "destructive" : "default"}
          >
            {isActive ? (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Monitoring
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};