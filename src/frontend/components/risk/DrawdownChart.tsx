import React, { useEffect, useRef } from "react";
import { TrendingDown, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useDrawdownHistory } from "@/frontend/hooks/useRiskData";

interface DrawdownDataPoint {
  timestamp: string;
  drawdown: number;
  equity: number;
  peak: number;
}

/**
 * Drawdown Statistics Component
 */
const DrawdownStats: React.FC<{ data: DrawdownDataPoint[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const currentDrawdown = data[data.length - 1]?.drawdown || 0;
  const maxDrawdown = Math.min(...data.map(d => d.drawdown));
  const avgDrawdown = data.reduce((sum, d) => sum + d.drawdown, 0) / data.length;
  
  // Calculate recovery time (days since last peak)
  const lastPeakIndex = data.findIndex(d => d.drawdown === 0);
  const daysSincePeak = lastPeakIndex >= 0 ? data.length - lastPeakIndex - 1 : data.length;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Current Drawdown</div>
        <div className={`text-sm font-bold ${currentDrawdown < -5 ? 'text-red-500' : 'text-yellow-500'}`}>
          {currentDrawdown.toFixed(2)}%
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Max Drawdown</div>
        <div className="text-sm font-bold text-red-500">
          {maxDrawdown.toFixed(2)}%
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Avg Drawdown</div>
        <div className="text-sm font-bold">
          {avgDrawdown.toFixed(2)}%
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Days Since Peak</div>
        <div className={`text-sm font-bold ${daysSincePeak > 30 ? 'text-red-500' : ''}`}>
          {daysSincePeak}
        </div>
      </div>
    </div>
  );
};

/**
 * Simple Line Chart Component using Canvas
 */
const DrawdownLineChart: React.FC<{ data: DrawdownDataPoint[]; timeframe: string }> = ({ 
  data, 
  timeframe 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const minDrawdown = Math.min(...data.map(d => d.drawdown), -1);
    const maxDrawdown = Math.max(...data.map(d => d.drawdown), 0);
    const drawdownRange = maxDrawdown - minDrawdown;

    const xScale = (width - padding.left - padding.right) / (data.length - 1);
    const yScale = (height - padding.top - padding.bottom) / drawdownRange;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * (height - padding.top - padding.bottom);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const gridCount = Math.min(data.length, 10);
    for (let i = 0; i <= gridCount; i++) {
      const x = padding.left + (i / gridCount) * (width - padding.left - padding.right);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Draw zero line
    const zeroY = padding.top + (maxDrawdown - 0) * yScale;
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();

    // Draw drawdown area
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);

    data.forEach((point, index) => {
      const x = padding.left + index * xScale;
      const y = padding.top + (maxDrawdown - point.drawdown) * yScale;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(padding.left + (data.length - 1) * xScale, zeroY);
    ctx.closePath();
    ctx.fill();

    // Draw drawdown line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding.left + index * xScale;
      const y = padding.top + (maxDrawdown - point.drawdown) * yScale;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
      const value = maxDrawdown - (i / 5) * drawdownRange;
      const y = padding.top + (i / 5) * (height - padding.top - padding.bottom);
      ctx.fillText(`${value.toFixed(1)}%`, padding.left - 5, y + 4);
    }

  }, [data, timeframe]);

  // Generate mock data if no real data available
  const mockData: DrawdownDataPoint[] = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (30 - i));
    
    // Simulate realistic drawdown pattern
    let drawdown = 0;
    if (i > 10 && i < 20) {
      drawdown = -((i - 10) / 10) * 8; // Gradual drawdown
    } else if (i >= 20 && i < 25) {
      drawdown = -8 + ((i - 20) / 5) * 3; // Recovery
    } else if (i >= 25) {
      drawdown = -5 + ((i - 25) / 5) * 2; // Further recovery
    }

    return {
      timestamp: date.toISOString(),
      drawdown,
      equity: 10000 * (1 + drawdown / 100),
      peak: 10000
    };
  });

  // const chartData = data && data.length > 0 ? data : mockData;

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-48" 
      style={{ width: '100%', height: '192px' }}
    />
  );
};

/**
 * Drawdown Chart Component
 * Real-time visualization of portfolio drawdown with historical data
 */
const DrawdownChart: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState("30d");
  const { data: drawdownData, isLoading } = useDrawdownHistory(timeframe);

  const currentDrawdown = drawdownData?.[drawdownData.length - 1]?.drawdown || 0;
  const isHighDrawdown = currentDrawdown < -10;
  const isMediumDrawdown = currentDrawdown < -5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className={`h-5 w-5 ${
              isHighDrawdown ? 'text-red-500' : 
              isMediumDrawdown ? 'text-yellow-500' : 'text-green-500'
            }`} />
            <span>Drawdown Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Badge variant="outline">Loading...</Badge>}
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7D</SelectItem>
                <SelectItem value="30d">30D</SelectItem>
                <SelectItem value="90d">90D</SelectItem>
                <SelectItem value="1y">1Y</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Current Drawdown</span>
          </div>
          <Badge variant={
            isHighDrawdown ? "destructive" : 
            isMediumDrawdown ? "secondary" : "default"
          }>
            {currentDrawdown.toFixed(2)}%
          </Badge>
        </div>

        {/* Chart */}
        <div className="relative">
          <DrawdownLineChart data={drawdownData || mockData} timeframe={timeframe} />
        </div>

        {/* Statistics */}
        <DrawdownStats data={drawdownData || mockData} />

        {/* Warning */}
        {isHighDrawdown && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">High Drawdown Alert</span>
            </div>
            <div className="text-xs text-red-600 dark:text-red-300 mt-1">
              Portfolio is experiencing significant losses. Consider risk reduction measures.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DrawdownChart;