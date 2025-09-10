/**
 * Multi-Exchange Interface - Task FE-021
 * 
 * Comprehensive multi-exchange interface with:
 * - Exchange selection interface
 * - Multi-exchange portfolio view
 * - Arbitrage opportunity display
 * - Exchange status monitoring
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Globe,
  DollarSign,
  BarChart3,
  RefreshCw,
  Settings,
  PlusCircle,
  MinusCircle,
  ArrowUpDown,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
  Info,
  Star,
  Shield,
  Target,
  Eye,
  EyeOff
} from 'lucide-react';

// Exchange data types
interface Exchange {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  status: 'connected' | 'disconnected' | 'error' | 'maintenance';
  isEnabled: boolean;
  tradingFees: {
    maker: number;
    taker: number;
  };
  withdrawalFees: Record<string, number>;
  supportedAssets: string[];
  apiLimits: {
    rateLimit: number;
    dailyLimit: number;
    used: number;
  };
  lastUpdate: Date;
  latency: number; // ms
  uptime: number; // percentage
}

interface ExchangeBalance {
  exchange: string;
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
}

interface ArbitrageOpportunity {
  id: string;
  asset: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  potentialProfit: number;
  volume24h: number;
  lastUpdate: Date;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ExchangeStats {
  exchange: string;
  volume24h: number;
  trades24h: number;
  avgSpread: number;
  topAssets: { asset: string; volume: number }[];
}

// Sample data
const exchanges: Exchange[] = [
  {
    id: 'binance',
    name: 'binance',
    displayName: 'Binance',
    logo: '/api/exchanges/binance/logo',
    status: 'connected',
    isEnabled: true,
    tradingFees: { maker: 0.1, taker: 0.1 },
    withdrawalFees: { BTC: 0.0005, ETH: 0.005, USDT: 1.0 },
    supportedAssets: ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'MATIC', 'DOT', 'AVAX'],
    apiLimits: { rateLimit: 1200, dailyLimit: 100000, used: 1580 },
    lastUpdate: new Date(),
    latency: 45,
    uptime: 99.8
  },
  {
    id: 'coinbase',
    name: 'coinbase-pro',
    displayName: 'Coinbase Pro',
    logo: '/api/exchanges/coinbase/logo',
    status: 'connected',
    isEnabled: true,
    tradingFees: { maker: 0.5, taker: 0.5 },
    withdrawalFees: { BTC: 0.0005, ETH: 0.0035, USDC: 0.0 },
    supportedAssets: ['BTC', 'ETH', 'LTC', 'BCH', 'LINK', 'USDC'],
    apiLimits: { rateLimit: 10, dailyLimit: 10000, used: 234 },
    lastUpdate: new Date(),
    latency: 78,
    uptime: 99.5
  },
  {
    id: 'kraken',
    name: 'kraken',
    displayName: 'Kraken',
    logo: '/api/exchanges/kraken/logo',
    status: 'connected',
    isEnabled: false,
    tradingFees: { maker: 0.16, taker: 0.26 },
    withdrawalFees: { BTC: 0.00015, ETH: 0.0025, USDT: 20.0 },
    supportedAssets: ['BTC', 'ETH', 'XRP', 'ADA', 'DOT', 'ALGO'],
    apiLimits: { rateLimit: 15, dailyLimit: 5000, used: 45 },
    lastUpdate: new Date(Date.now() - 5 * 60000),
    latency: 120,
    uptime: 98.9
  },
  {
    id: 'okx',
    name: 'okx',
    displayName: 'OKX',
    logo: '/api/exchanges/okx/logo',
    status: 'error',
    isEnabled: true,
    tradingFees: { maker: 0.08, taker: 0.1 },
    withdrawalFees: { BTC: 0.0004, ETH: 0.003, USDT: 1.0 },
    supportedAssets: ['BTC', 'ETH', 'OKB', 'LTC', 'DOT', 'FIL'],
    apiLimits: { rateLimit: 20, dailyLimit: 20000, used: 0 },
    lastUpdate: new Date(Date.now() - 15 * 60000),
    latency: 0,
    uptime: 95.2
  },
  {
    id: 'dydx',
    name: 'dydx',
    displayName: 'dYdX',
    logo: '/api/exchanges/dydx/logo',
    status: 'connected',
    isEnabled: true,
    tradingFees: { maker: 0.02, taker: 0.05 },
    withdrawalFees: { BTC: 0.0, ETH: 0.0, USDC: 0.0 },
    supportedAssets: ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK'],
    apiLimits: { rateLimit: 175, dailyLimit: 50000, used: 892 },
    lastUpdate: new Date(),
    latency: 32,
    uptime: 99.9
  }
];

const sampleBalances: ExchangeBalance[] = [
  { exchange: 'binance', asset: 'BTC', free: 0.5, locked: 0.1, total: 0.6, usdValue: 42000 },
  { exchange: 'binance', asset: 'ETH', free: 5.2, locked: 0.8, total: 6.0, usdValue: 15600 },
  { exchange: 'binance', asset: 'USDT', free: 10000, locked: 2000, total: 12000, usdValue: 12000 },
  { exchange: 'coinbase', asset: 'BTC', free: 0.3, locked: 0.0, total: 0.3, usdValue: 21000 },
  { exchange: 'coinbase', asset: 'ETH', free: 3.1, locked: 0.0, total: 3.1, usdValue: 8060 },
  { exchange: 'dydx', asset: 'BTC', free: 0.2, locked: 0.05, total: 0.25, usdValue: 17500 },
  { exchange: 'dydx', asset: 'ETH', free: 2.8, locked: 0.2, total: 3.0, usdValue: 7800 }
];

const arbitrageOpportunities: ArbitrageOpportunity[] = [
  {
    id: 'arb_1',
    asset: 'BTC',
    buyExchange: 'coinbase',
    sellExchange: 'binance',
    buyPrice: 69800,
    sellPrice: 70150,
    spread: 350,
    spreadPercent: 0.5,
    potentialProfit: 340,
    volume24h: 15.6,
    lastUpdate: new Date(),
    riskLevel: 'low'
  },
  {
    id: 'arb_2',
    asset: 'ETH',
    buyExchange: 'kraken',
    sellExchange: 'dydx',
    buyPrice: 2580,
    sellPrice: 2595,
    spread: 15,
    spreadPercent: 0.58,
    potentialProfit: 14.2,
    volume24h: 85.2,
    lastUpdate: new Date(),
    riskLevel: 'medium'
  }
];

export const MultiExchangeInterface: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [balances, setBalances] = useState<ExchangeBalance[]>([]);
  const [arbitrageOps, setArbitrageOps] = useState<ArbitrageOpportunity[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load data on component mount
  useEffect(() => {
    loadExchangeData();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadExchangeData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadExchangeData = async () => {
    setIsRefreshing(true);
    try {
      // In real implementation, these would be API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      setExchanges([...exchanges]); // Use the sample data
      setBalances([...sampleBalances]);
      setArbitrageOps([...arbitrageOpportunities]);
    } catch (error) {
      console.error('Failed to load exchange data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExchangeToggle = (exchangeId: string, enabled: boolean) => {
    setExchanges(prev =>
      prev.map(exchange =>
        exchange.id === exchangeId
          ? { ...exchange, isEnabled: enabled }
          : exchange
      )
    );
  };

  const getStatusIcon = (status: Exchange['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Exchange['status']) => {
    const colors = {
      connected: 'bg-green-100 text-green-800',
      disconnected: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate portfolio totals
  const portfolioTotals = balances.reduce((acc, balance) => {
    acc.totalValue += balance.usdValue;
    if (!acc.byAsset[balance.asset]) {
      acc.byAsset[balance.asset] = { total: 0, value: 0, exchanges: 0 };
    }
    acc.byAsset[balance.asset].total += balance.total;
    acc.byAsset[balance.asset].value += balance.usdValue;
    acc.byAsset[balance.asset].exchanges += 1;
    return acc;
  }, { totalValue: 0, byAsset: {} as Record<string, { total: number; value: number; exchanges: number }> });

  const connectedExchanges = exchanges.filter(e => e.status === 'connected').length;
  const enabledExchanges = exchanges.filter(e => e.isEnabled).length;
  const totalArbitrageValue = arbitrageOps.reduce((sum, op) => sum + op.potentialProfit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Multi-Exchange Trading</h2>
          <p className="text-muted-foreground">
            Manage multiple exchange connections and monitor arbitrage opportunities
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label className="text-sm">Auto-refresh</Label>
          </div>
          <Button
            onClick={loadExchangeData}
            disabled={isRefreshing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Connected Exchanges</p>
                <p className="text-2xl font-bold">{connectedExchanges}/{exchanges.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Portfolio</p>
                <p className="text-2xl font-bold">${portfolioTotals.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Arbitrage Ops</p>
                <p className="text-2xl font-bold">{arbitrageOps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Potential Profit</p>
                <p className="text-2xl font-bold text-green-600">${totalArbitrageValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exchanges">Exchanges</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exchange Status */}
            <Card>
              <CardHeader>
                <CardTitle>Exchange Status</CardTitle>
                <CardDescription>Real-time status of connected exchanges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {exchanges.slice(0, 5).map((exchange) => (
                    <div key={exchange.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(exchange.status)}
                        <div>
                          <h4 className="font-medium">{exchange.displayName}</h4>
                          <p className="text-sm text-muted-foreground">
                            Latency: {exchange.latency}ms | Uptime: {exchange.uptime}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(exchange.status)}
                        <Switch
                          checked={exchange.isEnabled}
                          onCheckedChange={(enabled) => handleExchangeToggle(exchange.id, enabled)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Distribution</CardTitle>
                <CardDescription>Asset distribution across exchanges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(portfolioTotals.byAsset).map(([asset, data]) => (
                    <div key={asset} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{asset}</span>
                          <Badge variant="outline" className="text-xs">
                            {data.exchanges} exchanges
                          </Badge>
                        </div>
                        <span className="text-sm font-medium">
                          ${data.value.toLocaleString()}
                        </span>
                      </div>
                      <Progress
                        value={(data.value / portfolioTotals.totalValue) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Arbitrage Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Arbitrage Opportunities</CardTitle>
              <CardDescription>Latest profitable opportunities detected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {arbitrageOps.slice(0, 3).map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="font-medium">{op.asset}</div>
                      <div className="text-sm text-muted-foreground">
                        Buy: {op.buyExchange} → Sell: {op.sellExchange}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        +${op.potentialProfit.toFixed(2)} ({op.spreadPercent.toFixed(2)}%)
                      </div>
                      <Badge className={getRiskBadgeColor(op.riskLevel)}>
                        {op.riskLevel} risk
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exchanges Tab */}
        <TabsContent value="exchanges" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exchange Management</CardTitle>
              <CardDescription>Configure and monitor exchange connections</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exchange</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>API Usage</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchanges.map((exchange) => (
                    <TableRow key={exchange.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Globe className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{exchange.displayName}</div>
                            <div className="text-sm text-muted-foreground">
                              {exchange.supportedAssets.length} assets
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(exchange.status)}
                          {getStatusBadge(exchange.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Maker: {exchange.tradingFees.maker}%</div>
                          <div>Taker: {exchange.tradingFees.taker}%</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{exchange.apiLimits.used}/{exchange.apiLimits.rateLimit}</div>
                          <Progress
                            value={(exchange.apiLimits.used / exchange.apiLimits.rateLimit) * 100}
                            className="h-1 w-16"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{exchange.latency}ms</div>
                          <div className="text-muted-foreground">{exchange.uptime}% uptime</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={exchange.isEnabled}
                          onCheckedChange={(enabled) => handleExchangeToggle(exchange.id, enabled)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Exchange Portfolio</CardTitle>
              <CardDescription>Your assets across all connected exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exchange</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Free</TableHead>
                    <TableHead>Locked</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>USD Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{balance.exchange}</TableCell>
                      <TableCell>{balance.asset}</TableCell>
                      <TableCell>{balance.free.toFixed(6)}</TableCell>
                      <TableCell>{balance.locked.toFixed(6)}</TableCell>
                      <TableCell className="font-medium">{balance.total.toFixed(6)}</TableCell>
                      <TableCell className="font-medium">
                        ${balance.usdValue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Arbitrage Tab */}
        <TabsContent value="arbitrage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Arbitrage Opportunities</CardTitle>
              <CardDescription>Profit from price differences across exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Buy Exchange</TableHead>
                    <TableHead>Sell Exchange</TableHead>
                    <TableHead>Spread</TableHead>
                    <TableHead>Potential Profit</TableHead>
                    <TableHead>Volume 24h</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arbitrageOps.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-medium">{op.asset}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{op.buyExchange}</div>
                          <div className="text-muted-foreground">${op.buyPrice.toLocaleString()}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{op.sellExchange}</div>
                          <div className="text-muted-foreground">${op.sellPrice.toLocaleString()}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">${op.spread.toFixed(2)}</div>
                          <div className="text-green-600">{op.spreadPercent.toFixed(2)}%</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-green-600">
                          ${op.potentialProfit.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>{op.volume24h.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getRiskBadgeColor(op.riskLevel)}>
                          {op.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          Execute
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Arbitrage Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Arbitrage Settings</CardTitle>
              <CardDescription>Configure arbitrage detection and execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="min-spread">Minimum Spread (%)</Label>
                    <Input id="min-spread" type="number" placeholder="0.1" step="0.01" />
                  </div>
                  <div>
                    <Label htmlFor="max-risk">Maximum Risk Level</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Risk Only</SelectItem>
                        <SelectItem value="medium">Medium Risk or Lower</SelectItem>
                        <SelectItem value="high">All Risk Levels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="min-volume">Minimum Volume (24h)</Label>
                    <Input id="min-volume" type="number" placeholder="1.0" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-execute" />
                    <Label htmlFor="auto-execute">Auto-execute opportunities</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MultiExchangeInterface;