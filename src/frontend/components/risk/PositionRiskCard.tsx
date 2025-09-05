import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { usePositionExposure } from "@/frontend/hooks/useRiskData";

interface Position {
  symbol: string;
  strategy: string;
  exposure: number;
  unrealizedPnL: number;
  riskContribution: number;
  concentration: number;
  side: 'long' | 'short';
}

/**
 * Individual Position Row Component
 */
const PositionRow: React.FC<{ position: Position }> = ({ position }) => {
  const pnlColor = position.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500";
  const PnlIcon = position.unrealizedPnL >= 0 ? TrendingUp : TrendingDown;
  
  const riskLevel = position.riskContribution > 30 ? "high" : 
                   position.riskContribution > 15 ? "medium" : "low";
  
  const riskColor = riskLevel === "high" ? "destructive" : 
                   riskLevel === "medium" ? "secondary" : "default";

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{position.symbol}</span>
          <Badge variant="outline" className="text-xs">
            {position.side}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {position.strategy}
        </div>
      </div>
      
      <div className="flex flex-col items-end space-y-1">
        <div className={`flex items-center gap-1 text-sm font-medium ${pnlColor}`}>
          <PnlIcon className="h-3 w-3" />
          ${Math.abs(position.unrealizedPnL).toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={riskColor} className="text-xs">
            {position.riskContribution.toFixed(1)}% risk
          </Badge>
        </div>
      </div>
    </div>
  );
};

/**
 * Position Concentration Chart Component
 */
const ConcentrationChart: React.FC<{ positions: Position[] }> = ({ positions }) => {
  // Group positions by symbol and calculate total exposure
  const symbolExposure = positions.reduce((acc, pos) => {
    acc[pos.symbol] = (acc[pos.symbol] || 0) + Math.abs(pos.exposure);
    return acc;
  }, {} as Record<string, number>);

  const totalExposure = Object.values(symbolExposure).reduce((sum, exp) => sum + exp, 0);
  
  // Get top 5 most concentrated positions
  const topSymbols = Object.entries(symbolExposure)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Position Concentration</h4>
      {topSymbols.map(([symbol, exposure]) => {
        const percentage = totalExposure > 0 ? (exposure / totalExposure) * 100 : 0;
        const isHighConcentration = percentage > 25;
        
        return (
          <div key={symbol} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{symbol}</span>
              <div className="flex items-center gap-1">
                <span>{percentage.toFixed(1)}%</span>
                {isHighConcentration && (
                  <Badge variant="destructive" className="text-xs">HIGH</Badge>
                )}
              </div>
            </div>
            <Progress 
              value={percentage} 
              className={`h-2 ${isHighConcentration ? 'bg-red-100' : ''}`} 
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Position Risk Card Component
 * Displays current position exposure, P&L, and risk contribution by symbol/strategy
 */
const PositionRiskCard: React.FC = () => {
  const { data: positionData, isLoading } = usePositionExposure();

  // Mock positions data for demonstration (replace with real data)
  const mockPositions: Position[] = [
    {
      symbol: "BTC-USD",
      strategy: "Mean Reversion",
      exposure: 25000,
      unrealizedPnL: 1250,
      riskContribution: 35,
      concentration: 40,
      side: 'long'
    },
    {
      symbol: "ETH-USD", 
      strategy: "Trend Following",
      exposure: -15000,
      unrealizedPnL: -780,
      riskContribution: 22,
      concentration: 25,
      side: 'short'
    },
    {
      symbol: "SOL-USD",
      strategy: "Scalping",
      exposure: 8000,
      unrealizedPnL: 340,
      riskContribution: 12,
      concentration: 15,
      side: 'long'
    },
    {
      symbol: "AVAX-USD",
      strategy: "Arbitrage",
      exposure: 5000,
      unrealizedPnL: 125,
      riskContribution: 8,
      concentration: 10,
      side: 'long'
    }
  ];

  const positions = positionData?.positions || mockPositions;
  
  // Calculate totals
  const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.exposure), 0);
  const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalRisk = positions.reduce((sum, pos) => sum + pos.riskContribution, 0);
  
  const pnlColor = totalPnL >= 0 ? "text-green-500" : "text-red-500";
  const PnlIcon = totalPnL >= 0 ? TrendingUp : totalPnL < 0 ? TrendingDown : Minus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Position Risk Exposure</span>
          {isLoading && <Badge variant="outline">Loading...</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Exposure</div>
            <div className="font-bold">${totalExposure.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Unrealized P&L</div>
            <div className={`font-bold flex items-center justify-center gap-1 ${pnlColor}`}>
              <PnlIcon className="h-4 w-4" />
              ${Math.abs(totalPnL).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Active Positions</div>
            <div className="font-bold">{positions.length}</div>
          </div>
        </div>

        {/* Position List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Current Positions</h4>
          <div className="max-h-48 overflow-y-auto">
            {positions.length > 0 ? (
              positions.map((position, index) => (
                <PositionRow key={`${position.symbol}-${index}`} position={position} />
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No active positions
              </div>
            )}
          </div>
        </div>

        {/* Concentration Analysis */}
        {positions.length > 0 && <ConcentrationChart positions={positions} />}
        
        {/* Risk Warnings */}
        {totalRisk > 80 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">High Risk Alert</span>
            </div>
            <div className="text-xs text-red-600 dark:text-red-300 mt-1">
              Total risk contribution exceeds 80%. Consider reducing position sizes.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PositionRiskCard;