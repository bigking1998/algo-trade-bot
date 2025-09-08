import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select';
import { Switch } from '@/frontend/components/ui/switch';
import { Label } from '@/frontend/components/ui/label';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Crosshair,
  Ruler,
  PenTool,
  Square,
  Circle,
  Triangle,
  Minus,
  Type,
  MousePointer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  FolderOpen,
  Settings,
  Layers,
  Eye,
  EyeOff,
  Activity,
  Volume2
} from 'lucide-react';

// Types for chart data and tools
interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicator {
  id: string;
  name: string;
  type: 'overlay' | 'oscillator';
  visible: boolean;
  settings: Record<string, any>;
  color: string;
}

interface DrawingTool {
  id: string;
  type: 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'circle' | 'text' | 'fibonacci';
  name: string;
  active: boolean;
}

interface ProfessionalChartingProps {
  className?: string;
  onClick?: () => void;
  symbol?: string;
  height?: number;
}

export const ProfessionalCharting: React.FC<ProfessionalChartingProps> = ({
  className = '',
  onClick,
  symbol = 'BTC-USD',
  height = 500
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [activeTool, setActiveTool] = useState<string>('cursor');
  const [showVolume, setShowVolume] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [autoScale, setAutoScale] = useState(true);
  
  // Technical indicators
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([
    { id: 'ma20', name: 'MA(20)', type: 'overlay', visible: true, settings: { period: 20 }, color: '#3b82f6' },
    { id: 'ma50', name: 'MA(50)', type: 'overlay', visible: true, settings: { period: 50 }, color: '#ef4444' },
    { id: 'bb', name: 'Bollinger Bands', type: 'overlay', visible: false, settings: { period: 20, std: 2 }, color: '#8b5cf6' },
    { id: 'rsi', name: 'RSI(14)', type: 'oscillator', visible: false, settings: { period: 14 }, color: '#f59e0b' },
    { id: 'macd', name: 'MACD', type: 'oscillator', visible: false, settings: { fast: 12, slow: 26, signal: 9 }, color: '#10b981' },
    { id: 'stoch', name: 'Stochastic', type: 'oscillator', visible: false, settings: { k: 14, d: 3 }, color: '#ec4899' }
  ]);

  // Drawing tools
  const drawingTools: DrawingTool[] = [
    { id: 'cursor', type: 'trendline', name: 'Cursor', active: true },
    { id: 'trendline', type: 'trendline', name: 'Trend Line', active: false },
    { id: 'horizontal', type: 'horizontal', name: 'Horizontal Line', active: false },
    { id: 'vertical', type: 'vertical', name: 'Vertical Line', active: false },
    { id: 'rectangle', type: 'rectangle', name: 'Rectangle', active: false },
    { id: 'circle', type: 'circle', name: 'Circle', active: false },
    { id: 'fibonacci', type: 'fibonacci', name: 'Fibonacci', active: false },
    { id: 'text', type: 'text', name: 'Text', active: false }
  ];

  // Mock candlestick data generation
  const generateMockData = useCallback((basePrice: number, days: number): CandlestickData[] => {
    const data: CandlestickData[] = [];
    let currentPrice = basePrice;
    const now = Date.now();
    
    for (let i = days; i >= 0; i--) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000);
      
      // Generate realistic OHLCV data
      const open = currentPrice;
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * volatility * currentPrice;
      const close = Math.max(open + change, 0);
      
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000000 + 100000;
      
      data.push({ timestamp, open, high, low, close, volume });
      currentPrice = close;
    }
    
    return data;
  }, []);

  const [chartData, setChartData] = useState<CandlestickData[]>(() => 
    generateMockData(65432, 100)
  );

  // Real-time chart updates
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData(prev => {
        const newData = [...prev];
        const last = newData[newData.length - 1];
        const volatility = 0.005;
        const change = (Math.random() - 0.5) * volatility * last.close;
        
        // Update last candle or add new one
        const now = Date.now();
        const timeDiff = now - last.timestamp;
        
        if (timeDiff > 60000) { // New candle every minute for demo
          newData.push({
            timestamp: now,
            open: last.close,
            high: last.close * (1 + Math.random() * 0.01),
            low: last.close * (1 - Math.random() * 0.01),
            close: Math.max(last.close + change, 0),
            volume: Math.random() * 1000000 + 100000
          });
          
          // Keep only last 100 candles
          if (newData.length > 100) {
            newData.shift();
          }
        } else {
          // Update current candle
          const updated = { ...last };
          updated.close = Math.max(last.close + change, 0);
          updated.high = Math.max(updated.high, updated.close);
          updated.low = Math.min(updated.low, updated.close);
          updated.volume += Math.random() * 10000;
          newData[newData.length - 1] = updated;
        }
        
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle tool selection
  const handleToolSelect = useCallback((toolId: string) => {
    setActiveTool(toolId);
    console.log(`Selected tool: ${toolId}`);
  }, []);

  // Handle indicator toggle
  const handleIndicatorToggle = useCallback((indicatorId: string) => {
    setIndicators(prev => prev.map(ind => 
      ind.id === indicatorId ? { ...ind, visible: !ind.visible } : ind
    ));
  }, []);

  // Handle chart save/load
  const handleSaveChart = useCallback(() => {
    const chartState = {
      symbol,
      timeframe,
      chartType,
      indicators: indicators.filter(ind => ind.visible),
      drawings: [], // Would contain drawing objects
    };
    
    console.log('Saving chart state:', chartState);
    localStorage.setItem(`chart-${symbol}-${timeframe}`, JSON.stringify(chartState));
  }, [symbol, timeframe, chartType, indicators]);

  const handleLoadChart = useCallback(() => {
    const saved = localStorage.getItem(`chart-${symbol}-${timeframe}`);
    if (saved) {
      const chartState = JSON.parse(saved);
      setChartType(chartState.chartType);
      setIndicators(prev => prev.map(ind => ({
        ...ind,
        visible: chartState.indicators.some((saved: any) => saved.id === ind.id)
      })));
      console.log('Loaded chart state:', chartState);
    }
  }, [symbol, timeframe]);

  // Render mock chart (in production this would use a real charting library)
  const renderChart = () => {
    const latestPrice = chartData[chartData.length - 1]?.close || 0;
    const priceChange = chartData.length > 1 
      ? latestPrice - chartData[chartData.length - 2].close 
      : 0;
    const priceChangePercent = ((priceChange / latestPrice) * 100);

    return (
      <div 
        ref={chartContainerRef}
        className="relative bg-white dark:bg-gray-900 border rounded"
        style={{ height: `${height}px` }}
      >
        {/* Chart Content - This would be replaced with actual charting library */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{symbol}</div>
                <div className="text-sm text-muted-foreground">{timeframe} • {chartType}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-xl font-mono">${latestPrice.toFixed(2)}</div>
                <div className={`text-sm ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </div>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Professional charting with TradingView integration would be implemented here
            </div>
            
            {/* Active Indicators */}
            {indicators.filter(ind => ind.visible).length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center">
                {indicators.filter(ind => ind.visible).map(indicator => (
                  <Badge key={indicator.id} variant="outline" className="text-xs">
                    {indicator.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Crosshair */}
        {crosshairEnabled && (
          <div className="absolute top-2 left-2 text-xs font-mono bg-background/80 p-1 rounded">
            O: {latestPrice.toFixed(2)} H: {latestPrice.toFixed(2)} L: {latestPrice.toFixed(2)} C: {latestPrice.toFixed(2)}
          </div>
        )}

        {/* Active Tool Indicator */}
        {activeTool !== 'cursor' && (
          <div className="absolute top-2 right-2 text-xs bg-blue-100 dark:bg-blue-900 p-1 rounded">
            Tool: {drawingTools.find(t => t.id === activeTool)?.name || activeTool}
          </div>
        )}
      </div>
    );
  };

  const currentPrice = chartData[chartData.length - 1]?.close || 0;

  return (
    <Card className={`professional-charting ${className}`} onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Professional Charts - {symbol}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
            <Badge variant="secondary" className="text-xs">
              ${currentPrice.toFixed(2)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Chart Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/20 border-b">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            {/* Timeframe */}
            <div className="flex items-center gap-1">
              {['1m', '5m', '15m', '1h', '4h', '1d', '1w'].map(tf => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                  className="text-xs h-6 px-2"
                >
                  {tf}
                </Button>
              ))}
            </div>

            {/* Chart Type */}
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-24 h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="candlestick">Candles</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="area">Area</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveChart}
              className="gap-1 h-6"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadChart}
              className="gap-1 h-6"
            >
              <FolderOpen className="h-3 w-3" />
              Load
            </Button>
          </div>
        </div>

        {/* Drawing Tools */}
        <div className="flex items-center gap-1 p-2 bg-muted/10 border-b overflow-x-auto">
          {drawingTools.map(tool => {
            const IconComponent = {
              cursor: MousePointer,
              trendline: Minus,
              horizontal: Minus,
              vertical: Minus,
              rectangle: Square,
              circle: Circle,
              fibonacci: Triangle,
              text: Type
            }[tool.id as keyof typeof drawingTools] || MousePointer;

            return (
              <Button
                key={tool.id}
                variant={activeTool === tool.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleToolSelect(tool.id)}
                className="gap-1 h-7 px-2"
                title={tool.name}
              >
                <IconComponent className="h-3 w-3" />
              </Button>
            );
          })}
          
          {/* Tool Options */}
          <div className="flex items-center gap-2 ml-4 text-xs">
            <Label className="flex items-center gap-1">
              <Switch 
                checked={crosshairEnabled} 
                onCheckedChange={setCrosshairEnabled}
                className="scale-75"
              />
              Crosshair
            </Label>
            
            <Label className="flex items-center gap-1">
              <Switch 
                checked={showGrid} 
                onCheckedChange={setShowGrid}
                className="scale-75"
              />
              Grid
            </Label>
            
            <Label className="flex items-center gap-1">
              <Switch 
                checked={autoScale} 
                onCheckedChange={setAutoScale}
                className="scale-75"
              />
              Auto Scale
            </Label>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="p-2">
          {renderChart()}
        </div>

        {/* Volume Chart */}
        {showVolume && (
          <div className="h-16 mx-2 mb-2 bg-muted/20 rounded flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Volume2 className="h-3 w-3" />
              Volume: {chartData[chartData.length - 1]?.volume.toLocaleString() || 0}
            </div>
          </div>
        )}

        {/* Technical Indicators Panel */}
        <Tabs defaultValue="indicators" className="border-t">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="indicators">Indicators</TabsTrigger>
            <TabsTrigger value="drawings">Drawings</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="indicators" className="p-2">
            <div className="grid grid-cols-2 gap-2">
              {indicators.map(indicator => (
                <div key={indicator.id} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={indicator.visible}
                      onCheckedChange={() => handleIndicatorToggle(indicator.id)}
                      className="scale-75"
                    />
                    <span className="text-xs">{indicator.name}</span>
                  </div>
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: indicator.color }}
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="drawings" className="p-2">
            <div className="text-center text-xs text-muted-foreground">
              No drawings on chart. Use drawing tools above to add annotations.
            </div>
          </TabsContent>

          <TabsContent value="settings" className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Volume</Label>
              <Switch checked={showVolume} onCheckedChange={setShowVolume} className="scale-75" />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Grid</Label>
              <Switch checked={showGrid} onCheckedChange={setShowGrid} className="scale-75" />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto Scale</Label>
              <Switch checked={autoScale} onCheckedChange={setAutoScale} className="scale-75" />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ProfessionalCharting;