import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/frontend/components/ui/select';
import { 
  LineChart, 
  TrendingUp, 
  TrendingDown,
  PieChart,
  DollarSign 
} from 'lucide-react';
import { Position } from '@/shared/types/trading';

interface PositionChartProps {
  positions: Position[];
  loading?: boolean;
}

interface ChartDataPoint {
  time: number;
  value: number;
  pnl: number;
  symbol: string;
}

export const PositionChart: React.FC<PositionChartProps> = ({
  positions,
  loading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<'pnl' | 'portfolio' | 'allocation'>('pnl');
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '1w' | '1m'>('1d');

  // Generate mock historical P&L data for visualization
  const generatePnLHistory = (positions: Position[]): ChartDataPoint[] => {
    const now = Date.now();
    const dataPoints: ChartDataPoint[] = [];
    const timeframes = {
      '1h': { points: 60, interval: 60 * 1000 },
      '1d': { points: 24, interval: 60 * 60 * 1000 },
      '1w': { points: 7, interval: 24 * 60 * 60 * 1000 },
      '1m': { points: 30, interval: 24 * 60 * 60 * 1000 },
    };

    const { points, interval } = timeframes[timeframe];

    for (let i = points; i >= 0; i--) {
      const time = now - (i * interval);
      let totalPnL = 0;
      let totalValue = 0;

      positions.forEach(position => {
        // Simulate historical price movement
        const priceVariation = (Math.random() - 0.5) * 0.1;
        const historicalPrice = position.currentPrice * (1 + priceVariation);
        const pnl = (historicalPrice - position.entryPrice) * position.quantity * (position.side === 'long' ? 1 : -1);
        
        totalPnL += pnl;
        totalValue += position.marketValue;
      });

      dataPoints.push({
        time,
        value: totalValue,
        pnl: totalPnL,
        symbol: 'PORTFOLIO',
      });
    }

    return dataPoints;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeframe === '1h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (timeframe === '1d') return date.toLocaleTimeString([], { hour: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const chartData = generatePnLHistory(positions);
  const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  // Portfolio allocation data
  const allocationData = positions.map(position => ({
    symbol: position.symbol,
    value: position.marketValue,
    percentage: totalValue > 0 ? (position.marketValue / totalValue) * 100 : 0,
    color: position.side === 'long' ? '#10B981' : '#EF4444',
    pnl: position.unrealizedPnL,
  }));

  const SimpleLineChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => {
    if (data.length === 0) return null;

    const maxValue = Math.max(...data.map(d => Math.abs(d.pnl)));
    const minValue = Math.min(...data.map(d => d.pnl));
    const range = maxValue - minValue || 1;

    return (
      <div className="relative h-64 w-full">
        <svg
          className="w-full h-full"
          viewBox="0 0 800 200"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="80" height="40" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="800" height="200" fill="url(#grid)" />
          
          {/* Zero line */}
          <line
            x1="0"
            y1={100}
            x2="800"
            y2={100}
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="4,4"
          />
          
          {/* P&L line */}
          <polyline
            fill="none"
            stroke={totalPnL >= 0 ? "#10B981" : "#EF4444"}
            strokeWidth="2"
            points={data.map((point, index) => {
              const x = (index / (data.length - 1)) * 800;
              const y = 200 - ((point.pnl - minValue) / range) * 200;
              return `${x},${y}`;
            }).join(' ')}
          />
          
          {/* Data points */}
          {data.map((point, index) => {
            const x = (index / (data.length - 1)) * 800;
            const y = 200 - ((point.pnl - minValue) / range) * 200;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill={point.pnl >= 0 ? "#10B981" : "#EF4444"}
                className="opacity-80 hover:opacity-100"
              >
                <title>
                  {formatTime(point.time)}: {formatCurrency(point.pnl)}
                </title>
              </circle>
            );
          })}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
          <span>{formatCurrency(maxValue)}</span>
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(minValue)}</span>
        </div>
      </div>
    );
  };

  const AllocationChart: React.FC<{ data: typeof allocationData }> = ({ data }) => {
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    
    let currentAngle = -90; // Start from top
    
    return (
      <div className="flex items-center gap-8">
        <div className="relative">
          <svg width="200" height="200" className="transform rotate-0">
            {data.map((item, index) => {
              const sliceAngle = (item.percentage / 100) * 360;
              const startAngle = (currentAngle * Math.PI) / 180;
              const endAngle = ((currentAngle + sliceAngle) * Math.PI) / 180;
              
              const x1 = centerX + radius * Math.cos(startAngle);
              const y1 = centerY + radius * Math.sin(startAngle);
              const x2 = centerX + radius * Math.cos(endAngle);
              const y2 = centerY + radius * Math.sin(endAngle);
              
              const largeArc = sliceAngle > 180 ? 1 : 0;
              
              const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                'Z'
              ].join(' ');
              
              currentAngle += sliceAngle;
              
              return (
                <path
                  key={index}
                  d={pathData}
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                  opacity="0.8"
                  className="hover:opacity-100"
                >
                  <title>
                    {item.symbol}: {item.percentage.toFixed(1)}% ({formatCurrency(item.value)})
                  </title>
                </path>
              );
            })}
          </svg>
        </div>
        
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3 text-sm">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-mono font-medium">{item.symbol}</span>
              <span className="text-muted-foreground">
                {item.percentage.toFixed(1)}%
              </span>
              <span className={item.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(item.pnl)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Position Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Position Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16 text-muted-foreground">
            <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            No positions to chart. Open some trades to see your performance visualization.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {chartType === 'pnl' && <LineChart className="h-5 w-5" />}
            {chartType === 'allocation' && <PieChart className="h-5 w-5" />}
            {chartType === 'portfolio' && <DollarSign className="h-5 w-5" />}
            Position {chartType === 'pnl' ? 'P&L' : chartType === 'allocation' ? 'Allocation' : 'Portfolio'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pnl">P&L Chart</SelectItem>
                <SelectItem value="allocation">Allocation</SelectItem>
                <SelectItem value="portfolio">Portfolio</SelectItem>
              </SelectContent>
            </Select>
            
            {chartType === 'pnl' && (
              <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1H</SelectItem>
                  <SelectItem value="1d">1D</SelectItem>
                  <SelectItem value="1w">1W</SelectItem>
                  <SelectItem value="1m">1M</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total Value</span>
              </div>
              <div className="text-xl font-bold">
                {formatCurrency(totalValue)}
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${totalPnL >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                {totalPnL >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                <span className="text-sm font-medium">Unrealized P&L</span>
              </div>
              <div className={`text-xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalPnL)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Positions</span>
              </div>
              <div className="text-xl font-bold">
                {positions.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {positions.filter(p => p.side === 'long').length}L / {positions.filter(p => p.side === 'short').length}S
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Content */}
        <div ref={chartRef}>
          {chartType === 'pnl' && (
            <SimpleLineChart data={chartData} />
          )}
          
          {chartType === 'allocation' && (
            <div className="flex justify-center py-8">
              <AllocationChart data={allocationData} />
            </div>
          )}
          
          {chartType === 'portfolio' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {positions.map((position, index) => (
                  <Card key={position.id} className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{position.symbol}</span>
                          <Badge 
                            variant={position.side === 'long' ? 'default' : 'secondary'}
                            className={position.side === 'long' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }
                          >
                            {position.side.toUpperCase()}
                          </Badge>
                        </div>
                        <div className={`text-sm font-medium ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(position.unrealizedPnL)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span>Quantity:</span>
                          <span className="ml-1 font-medium">{position.quantity.toFixed(6)}</span>
                        </div>
                        <div>
                          <span>Entry:</span>
                          <span className="ml-1 font-medium">{formatCurrency(position.entryPrice)}</span>
                        </div>
                        <div>
                          <span>Current:</span>
                          <span className="ml-1 font-medium">{formatCurrency(position.currentPrice)}</span>
                        </div>
                        <div>
                          <span>Value:</span>
                          <span className="ml-1 font-medium">{formatCurrency(position.marketValue)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};