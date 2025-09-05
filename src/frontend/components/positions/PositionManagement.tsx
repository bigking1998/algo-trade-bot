import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs';
import { Badge } from '@/frontend/components/ui/badge';
import { Button } from '@/frontend/components/ui/button';
import { 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Activity,
  AlertTriangle,
  Target,
  Clock,
  BarChart3 
} from 'lucide-react';

// Import all position management components
import { PositionsTable } from './PositionsTable';
import { OrderBookPanel } from './OrderBookPanel';
import { PositionSizeCalculator } from './PositionSizeCalculator';
import { TradeHistoryPanel } from './TradeHistoryPanel';
import { PositionChart } from './PositionChart';

// Import hooks
import { 
  usePositions,
  usePositionSummary,
  useActiveOrders,
  useRiskMetrics,
} from '@/frontend/hooks/usePositions';

import { Position, PositionSizeCalculation } from '@/shared/types/trading';

interface PositionManagementProps {
  strategyId?: string;
  className?: string;
}

export const PositionManagement: React.FC<PositionManagementProps> = ({
  strategyId,
  className = '',
}) => {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all position-related data
  const { data: positions = [], isLoading: positionsLoading, refetch: refetchPositions } = usePositions(strategyId);
  const { data: positionSummary, isLoading: summaryLoading } = usePositionSummary();
  const { data: activeOrders = [], isLoading: ordersLoading } = useActiveOrders(strategyId);
  const { data: riskMetrics, isLoading: riskLoading } = useRiskMetrics();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetchPositions();
  };

  const handleModifyPosition = (position: Position) => {
    setSelectedPosition(position);
    // This would typically open a position modification dialog
    console.log('Modify position:', position);
  };

  const handlePositionSizeCalculated = (calculation: PositionSizeCalculation) => {
    console.log('Position size calculated:', calculation);
    // This could automatically populate the order placement form
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const isLoading = positionsLoading || summaryLoading || ordersLoading || riskLoading;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Position Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Positions */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Active Positions
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {positionSummary?.totalPositions || positions.length}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {positionSummary?.longPositions || 0}L
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {positionSummary?.shortPositions || 0}S
                  </Badge>
                </div>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Unrealized P&L */}
        <Card className={`${(positionSummary?.totalUnrealizedPnL || 0) >= 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${(positionSummary?.totalUnrealizedPnL || 0) >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  Unrealized P&L
                </p>
                <p className={`text-2xl font-bold ${(positionSummary?.totalUnrealizedPnL || 0) >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                  {formatCurrency(positionSummary?.totalUnrealizedPnL || 0)}
                </p>
                <p className={`text-xs ${(positionSummary?.totalUnrealizedPnL || 0) >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {formatPercent(positionSummary?.totalUnrealizedPnLPercent || 0)}
                </p>
              </div>
              {(positionSummary?.totalUnrealizedPnL || 0) >= 0 ? 
                <TrendingUp className="h-8 w-8 text-green-600" /> : 
                <TrendingDown className="h-8 w-8 text-red-600" />
              }
            </div>
          </CardContent>
        </Card>

        {/* Total Market Value */}
        <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Market Value
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatCurrency(positionSummary?.totalMarketValue || 0)}
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Total exposure
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Risk Exposure */}
        <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Risk Exposure
                </p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {(riskMetrics?.portfolioHeat || 65.5).toFixed(1)}%
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Portfolio heat
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="positions" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <PositionsTable 
                positions={positions}
                loading={positionsLoading}
                onModifyPosition={handleModifyPosition}
              />
            </div>
            <div className="space-y-6">
              <PositionChart 
                positions={positions}
                loading={positionsLoading}
              />
            </div>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <OrderBookPanel 
              orders={activeOrders}
              loading={ordersLoading}
            />
            <PositionSizeCalculator 
              onCalculationComplete={handlePositionSizeCalculated}
            />
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <TradeHistoryPanel />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Metrics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Risk Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {riskMetrics ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Portfolio Heat</div>
                      <div className="text-lg font-bold">{riskMetrics.portfolioHeat.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Max Risk/Trade</div>
                      <div className="text-lg font-bold">{riskMetrics.maxRiskPerTrade.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Available Balance</div>
                      <div className="text-lg font-bold">{formatCurrency(riskMetrics.availableBalance)}</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Margin Utilization</div>
                      <div className="text-lg font-bold">{riskMetrics.marginUtilization.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                      <div className="text-lg font-bold">{riskMetrics.sharpeRatio.toFixed(2)}</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Max Drawdown</div>
                      <div className="text-lg font-bold">{riskMetrics.maxDrawdown.toFixed(1)}%</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Risk metrics will appear here once you have active positions.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Metrics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Largest Position</span>
                    <span className="font-medium">{positionSummary?.largestPosition || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Total Exposure</span>
                    <span className="font-medium">{formatCurrency(riskMetrics?.totalExposure || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Risk/Reward Ratio</span>
                    <span className="font-medium">{riskMetrics?.riskRewardRatio.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full-width chart for analytics */}
          <PositionChart 
            positions={positions}
            loading={positionsLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};