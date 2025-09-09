import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { 
  TrendingUp, 
  TrendingDown,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  DollarSign,
  BarChart3,
  Zap,
  Eye,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";

// Types
interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: Date;
  status: 'filled' | 'partial' | 'pending' | 'cancelled';
  strategy: string;
  pnl?: number;
}

interface Signal {
  id: string;
  symbol: string;
  type: 'entry' | 'exit';
  direction: 'long' | 'short';
  strategy: string;
  confidence: number;
  timestamp: Date;
  status: 'active' | 'executed' | 'expired';
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  timestamp: Date;
}

/**
 * Real-time Trading Dashboard - Task FE-002
 * 
 * Live trading interface with:
 * - Real-time market data streams
 * - Live position monitoring
 * - Trading signal displays
 * - Execution monitoring
 * - Performance tracking
 */
const RealtimeTradingDashboard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Simulate real-time connection
  useEffect(() => {
    // Initialize connection
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
      initializeMockData();
    }, 1000);

    // Setup real-time data updates
    const updateInterval = setInterval(() => {
      updateMarketData();
      updateTradingData();
      setLastUpdate(new Date());
    }, 2000);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(updateInterval);
    };
  }, []);

  const initializeMockData = () => {
    // Mock market data
    const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD'];
    const mockMarketData: MarketData[] = symbols.map(symbol => ({
      symbol,
      price: Math.random() * 1000 + 1000,
      change24h: (Math.random() - 0.5) * 20,
      volume24h: Math.random() * 1000000,
      high24h: Math.random() * 1000 + 1100,
      low24h: Math.random() * 1000 + 900,
      lastUpdated: new Date()
    }));
    setMarketData(mockMarketData);

    // Mock trades
    const mockTrades: Trade[] = [
      {
        id: 'trade_001',
        symbol: 'BTC-USD',
        side: 'buy',
        quantity: 0.1,
        price: 43250.50,
        timestamp: new Date(Date.now() - 300000),
        status: 'filled',
        strategy: 'EMA Crossover',
        pnl: 145.50
      },
      {
        id: 'trade_002',
        symbol: 'ETH-USD',
        side: 'sell',
        quantity: 2.5,
        price: 2650.75,
        timestamp: new Date(Date.now() - 180000),
        status: 'filled',
        strategy: 'RSI Mean Reversion',
        pnl: -23.40
      },
      {
        id: 'trade_003',
        symbol: 'SOL-USD',
        side: 'buy',
        quantity: 50,
        price: 98.25,
        timestamp: new Date(Date.now() - 60000),
        status: 'partial',
        strategy: 'Breakout',
        pnl: 0
      }
    ];
    setTrades(mockTrades);

    // Mock signals
    const mockSignals: Signal[] = [
      {
        id: 'signal_001',
        symbol: 'BTC-USD',
        type: 'entry',
        direction: 'long',
        strategy: 'MACD Trend',
        confidence: 0.85,
        timestamp: new Date(Date.now() - 30000),
        status: 'active'
      },
      {
        id: 'signal_002',
        symbol: 'ETH-USD',
        type: 'exit',
        direction: 'short',
        strategy: 'RSI Mean Reversion',
        confidence: 0.72,
        timestamp: new Date(Date.now() - 45000),
        status: 'executed'
      }
    ];
    setSignals(mockSignals);

    // Mock positions
    const mockPositions: Position[] = [
      {
        symbol: 'BTC-USD',
        side: 'long',
        size: 0.25,
        entryPrice: 43180.00,
        currentPrice: 43250.50,
        unrealizedPnl: 17.63,
        realizedPnl: 145.50,
        timestamp: new Date(Date.now() - 600000)
      },
      {
        symbol: 'ETH-USD',
        side: 'short',
        size: 1.8,
        entryPrice: 2675.30,
        currentPrice: 2650.75,
        unrealizedPnl: 44.19,
        realizedPnl: -23.40,
        timestamp: new Date(Date.now() - 900000)
      }
    ];
    setPositions(mockPositions);

    // Calculate PnL
    const totalUnrealized = mockPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    const totalRealized = mockPositions.reduce((sum, pos) => sum + pos.realizedPnl, 0);
    setTotalPnL(totalUnrealized + totalRealized);
    setDailyPnL(totalRealized);
    setTotalVolume(450000);
  };

  const updateMarketData = () => {
    setMarketData(prev => prev.map(data => ({
      ...data,
      price: data.price + (Math.random() - 0.5) * data.price * 0.001,
      change24h: data.change24h + (Math.random() - 0.5) * 0.5,
      volume24h: data.volume24h + (Math.random() - 0.5) * data.volume24h * 0.01,
      lastUpdated: new Date()
    })));
  };

  const updateTradingData = () => {
    // Update positions with new prices
    setPositions(prev => prev.map(position => {
      const newPrice = position.currentPrice + (Math.random() - 0.5) * position.currentPrice * 0.001;
      const priceDiff = newPrice - position.entryPrice;
      const unrealizedPnl = position.side === 'long' 
        ? priceDiff * position.size
        : -priceDiff * position.size;
      
      return {
        ...position,
        currentPrice: newPrice,
        unrealizedPnl
      };
    }));

    // Occasionally add new signals
    if (Math.random() < 0.1) {
      const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
      const newSignal: Signal = {
        id: `signal_${Date.now()}`,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        type: Math.random() > 0.5 ? 'entry' : 'exit',
        direction: Math.random() > 0.5 ? 'long' : 'short',
        strategy: ['EMA Crossover', 'RSI Mean Reversion', 'MACD Trend'][Math.floor(Math.random() * 3)],
        confidence: Math.random() * 0.3 + 0.7,
        timestamp: new Date(),
        status: 'active'
      };
      
      setSignals(prev => [newSignal, ...prev.slice(0, 9)]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled':
      case 'executed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
      case 'active':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'cancelled':
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Real-time Trading</h2>
          <p className="text-muted-foreground">Monitor live trading activity and market conditions</p>
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Connecting...</span>
            </>
          )}
          <span className="text-xs text-muted-foreground ml-4">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total P&L</p>
                <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalPnL)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Daily P&L</p>
                <p className={`text-2xl font-bold ${dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(dailyPnL)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">24h Volume</p>
                <p className="text-2xl font-bold">{formatCurrency(totalVolume)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Active Positions</p>
                <p className="text-2xl font-bold">{positions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="market" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="market">Market Data</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="trades">Trade History</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        {/* Market Data Tab */}
        <TabsContent value="market" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Market Data</CardTitle>
              <CardDescription>Real-time price feeds from dYdX</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>24h Change</TableHead>
                    <TableHead>24h Volume</TableHead>
                    <TableHead>24h High</TableHead>
                    <TableHead>24h Low</TableHead>
                    <TableHead>Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketData.map((data) => (
                    <TableRow key={data.symbol}>
                      <TableCell className="font-medium">{data.symbol}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(data.price)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center ${data.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.change24h >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(data.volume24h)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(data.high24h)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(data.low24h)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {data.lastUpdated.toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
              <CardDescription>Current trading positions and unrealized P&L</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Unrealized P&L</TableHead>
                    <TableHead>Realized P&L</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={`${position.symbol}-${position.side}`}>
                      <TableCell className="font-medium">{position.symbol}</TableCell>
                      <TableCell>
                        <Badge className={position.side === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {position.side}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNumber(position.size, 4)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(position.entryPrice)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(position.currentPrice)}</TableCell>
                      <TableCell className={position.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(position.unrealizedPnl)}
                      </TableCell>
                      <TableCell className={position.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(position.realizedPnl)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {Math.round((Date.now() - position.timestamp.getTime()) / 60000)}m
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signals Tab */}
        <TabsContent value="signals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trading Signals</CardTitle>
              <CardDescription>Live signals generated by active strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {signals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(signal.status)}
                      <div>
                        <h4 className="font-medium">
                          {signal.type.toUpperCase()} {signal.direction.toUpperCase()} - {signal.symbol}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {signal.strategy} • {signal.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">Confidence</div>
                        <Progress value={signal.confidence * 100} className="w-20 h-2" />
                        <div className="text-xs text-muted-foreground">{(signal.confidence * 100).toFixed(1)}%</div>
                      </div>
                      <Badge className={
                        signal.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        signal.status === 'executed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {signal.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trade History Tab */}
        <TabsContent value="trades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
              <CardDescription>Latest trading activity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="text-xs">{trade.timestamp.toLocaleTimeString()}</TableCell>
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge className={trade.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNumber(trade.quantity, 4)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(trade.price)}</TableCell>
                      <TableCell className="text-sm">{trade.strategy}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(trade.status)}
                          <span className="text-xs">{trade.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className={trade.pnl && trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {trade.pnl ? formatCurrency(trade.pnl) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Real-time system monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Data Feed Connection</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Strategy Engine</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Running</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Order Management</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Risk Management</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Monitoring</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Real-time performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Data Latency</span>
                      <span>12ms</span>
                    </div>
                    <Progress value={85} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Order Fill Rate</span>
                      <span>98.5%</span>
                    </div>
                    <Progress value={98.5} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Strategy Accuracy</span>
                      <span>72.3%</span>
                    </div>
                    <Progress value={72.3} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Risk Utilization</span>
                      <span>45.2%</span>
                    </div>
                    <Progress value={45.2} className="h-2 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RealtimeTradingDashboard;