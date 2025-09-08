import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select';
import { Progress } from '@/frontend/components/ui/progress';
import { 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  Shield,
  Zap,
  BarChart3,
  Grid3X3,
  Filter,
  RefreshCw,
  Eye,
  Settings,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity
} from 'lucide-react';

// Types for portfolio data
interface AssetHolding {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  price: number;
  change24h: number;
  changePercent24h: number;
  allocation: number;
  avgBuyPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  marketCap: number;
  volume24h: number;
  riskScore: number;
  correlationBTC: number;
}

interface PortfolioStats {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  diversificationScore: number;
}

interface MultiAssetPortfolioProps {
  className?: string;
  onClick?: () => void;
}

export const MultiAssetPortfolio: React.FC<MultiAssetPortfolioProps> = ({
  className = '',
  onClick
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'heatmap' | 'list'>('heatmap');
  const [sortBy, setSortBy] = useState<'value' | 'allocation' | 'pnl' | 'change'>('allocation');
  const [filterBy, setFilterBy] = useState<'all' | 'profitable' | 'losing' | 'major'>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // Mock portfolio data (would come from real API)
  const [holdings, setHoldings] = useState<AssetHolding[]>([
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      balance: 0.5432,
      value: 35541.20,
      price: 65432.10,
      change24h: 1532.45,
      changePercent24h: 2.4,
      allocation: 45.2,
      avgBuyPrice: 62000.00,
      unrealizedPnL: 1864.54,
      unrealizedPnLPercent: 5.5,
      marketCap: 1280000000000,
      volume24h: 32000000000,
      riskScore: 6.5,
      correlationBTC: 1.0
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: 8.234,
      value: 22156.78,
      price: 2689.45,
      change24h: -89.23,
      changePercent24h: -3.2,
      allocation: 28.1,
      avgBuyPrice: 2800.00,
      unrealizedPnL: -909.88,
      unrealizedPnLPercent: -3.9,
      marketCap: 323000000000,
      volume24h: 15000000000,
      riskScore: 7.2,
      correlationBTC: 0.83
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      balance: 45.67,
      value: 8234.56,
      price: 180.34,
      change24h: 12.45,
      changePercent24h: 7.4,
      allocation: 10.5,
      avgBuyPrice: 165.00,
      unrealizedPnL: 700.21,
      unrealizedPnLPercent: 9.3,
      marketCap: 82000000000,
      volume24h: 2500000000,
      riskScore: 8.1,
      correlationBTC: 0.67
    },
    {
      symbol: 'AVAX',
      name: 'Avalanche',
      balance: 123.45,
      value: 4567.89,
      price: 37.00,
      change24h: 1.85,
      changePercent24h: 5.3,
      allocation: 5.8,
      avgBuyPrice: 38.50,
      unrealizedPnL: -185.18,
      unrealizedPnLPercent: -3.9,
      marketCap: 14500000000,
      volume24h: 450000000,
      riskScore: 8.7,
      correlationBTC: 0.72
    },
    {
      symbol: 'LINK',
      name: 'Chainlink',
      balance: 234.56,
      value: 3456.78,
      price: 14.73,
      change24h: 0.45,
      changePercent24h: 3.1,
      allocation: 4.4,
      avgBuyPrice: 15.20,
      unrealizedPnL: -110.23,
      unrealizedPnLPercent: -3.1,
      marketCap: 8900000000,
      volume24h: 380000000,
      riskScore: 7.8,
      correlationBTC: 0.78
    },
    {
      symbol: 'DOT',
      name: 'Polkadot',
      balance: 345.67,
      value: 2345.67,
      price: 6.79,
      change24h: -0.23,
      changePercent24h: -3.3,
      allocation: 3.0,
      avgBuyPrice: 7.20,
      unrealizedPnL: -141.72,
      unrealizedPnLPercent: -5.7,
      marketCap: 9200000000,
      volume24h: 210000000,
      riskScore: 8.3,
      correlationBTC: 0.75
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      balance: 2500.00,
      value: 2500.00,
      price: 1.00,
      change24h: 0.00,
      changePercent24h: 0.0,
      allocation: 3.2,
      avgBuyPrice: 1.00,
      unrealizedPnL: 0.00,
      unrealizedPnLPercent: 0.0,
      marketCap: 55000000000,
      volume24h: 5500000000,
      riskScore: 1.0,
      correlationBTC: 0.05
    }
  ]);

  // Calculate portfolio statistics
  const portfolioStats = useMemo((): PortfolioStats => {
    const totalValue = holdings.reduce((sum, asset) => sum + asset.value, 0);
    const totalPnL = holdings.reduce((sum, asset) => sum + asset.unrealizedPnL, 0);
    const totalPnLPercent = (totalPnL / (totalValue - totalPnL)) * 100;
    const dayChange = holdings.reduce((sum, asset) => sum + asset.change24h * asset.balance, 0);
    const dayChangePercent = (dayChange / totalValue) * 100;

    // Calculate diversification score (1 - Herfindahl index)
    const herfindahl = holdings.reduce((sum, asset) => {
      const weight = asset.allocation / 100;
      return sum + (weight * weight);
    }, 0);
    const diversificationScore = (1 - herfindahl) * 100;

    return {
      totalValue,
      totalPnL,
      totalPnLPercent,
      dayChange,
      dayChangePercent,
      sharpeRatio: 1.45, // Mock calculation
      maxDrawdown: -12.5, // Mock calculation  
      volatility: 25.3, // Mock calculation
      diversificationScore
    };
  }, [holdings]);

  // Filter and sort holdings
  const filteredAndSortedHoldings = useMemo(() => {
    let filtered = holdings;

    // Apply filters
    switch (filterBy) {
      case 'profitable':
        filtered = filtered.filter(asset => asset.unrealizedPnL > 0);
        break;
      case 'losing':
        filtered = filtered.filter(asset => asset.unrealizedPnL < 0);
        break;
      case 'major':
        filtered = filtered.filter(asset => asset.allocation > 5);
        break;
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return b.value - a.value;
        case 'allocation':
          return b.allocation - a.allocation;
        case 'pnl':
          return b.unrealizedPnL - a.unrealizedPnL;
        case 'change':
          return b.changePercent24h - a.changePercent24h;
        default:
          return 0;
      }
    });
  }, [holdings, filterBy, sortBy]);

  // Real-time updates simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setHoldings(prev => prev.map(asset => ({
        ...asset,
        price: asset.price * (1 + (Math.random() - 0.5) * 0.01),
        change24h: asset.change24h + (Math.random() - 0.5) * 10,
        changePercent24h: asset.changePercent24h + (Math.random() - 0.5) * 0.5,
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Render asset in heatmap
  const renderHeatmapCell = (asset: AssetHolding) => {
    const size = Math.sqrt(asset.allocation) * 8; // Size based on allocation
    const intensity = Math.abs(asset.changePercent24h) / 10; // Color intensity based on change
    const isPositive = asset.changePercent24h >= 0;

    return (
      <div
        key={asset.symbol}
        className={`
          relative rounded cursor-pointer transition-all duration-200 hover:scale-105
          ${isPositive ? 'bg-green-500' : 'bg-red-500'}
          flex flex-col items-center justify-center text-white p-2 min-h-16
        `}
        style={{
          flex: `0 0 ${Math.max(120, size * 2)}px`,
          opacity: 0.3 + intensity,
          minWidth: '80px',
          height: `${Math.max(60, size)}px`
        }}
        title={`${asset.name}: ${asset.changePercent24h.toFixed(2)}%`}
      >
        <div className="text-xs font-bold">{asset.symbol}</div>
        <div className="text-xs">{asset.allocation.toFixed(1)}%</div>
        <div className="text-xs font-mono">
          {asset.changePercent24h > 0 ? '+' : ''}{asset.changePercent24h.toFixed(1)}%
        </div>
      </div>
    );
  };

  // Render asset in list view
  const renderListItem = (asset: AssetHolding) => (
    <div key={asset.symbol} className="grid grid-cols-8 gap-2 p-2 hover:bg-muted/50 cursor-pointer text-sm">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs text-white font-bold">
          {asset.symbol[0]}
        </div>
        <div>
          <div className="font-medium">{asset.symbol}</div>
          <div className="text-xs text-muted-foreground">{asset.name}</div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="font-mono">{asset.balance.toFixed(4)}</div>
        <div className="text-xs text-muted-foreground">${asset.price.toFixed(2)}</div>
      </div>
      
      <div className="text-right">
        <div className="font-mono">${asset.value.toFixed(2)}</div>
        <div className="text-xs text-muted-foreground">{asset.allocation.toFixed(1)}%</div>
      </div>
      
      <div className="text-right">
        <div className={`font-mono ${asset.changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {asset.changePercent24h > 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
        </div>
        <div className="text-xs text-muted-foreground">
          ${Math.abs(asset.change24h).toFixed(2)}
        </div>
      </div>
      
      <div className="text-right">
        <div className={`font-mono ${asset.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {asset.unrealizedPnL > 0 ? '+' : ''}${asset.unrealizedPnL.toFixed(2)}
        </div>
        <div className={`text-xs ${asset.unrealizedPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {asset.unrealizedPnLPercent > 0 ? '+' : ''}{asset.unrealizedPnLPercent.toFixed(2)}%
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-xs">Risk: {asset.riskScore.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">β: {asset.correlationBTC.toFixed(2)}</div>
      </div>
      
      <div className="text-right">
        <Progress value={asset.allocation} max={50} className="h-1" />
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button variant="outline" size="sm" className="h-6 px-2">
          <Target className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className={`multi-asset-portfolio ${className}`} onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Multi-Asset Portfolio
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
            <Badge 
              variant={portfolioStats.totalPnL >= 0 ? "default" : "destructive"} 
              className="text-xs"
            >
              {portfolioStats.totalPnL >= 0 ? '+' : ''}${portfolioStats.totalPnL.toFixed(2)}
            </Badge>
          </div>
        </div>
        
        {/* Portfolio Summary */}
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div className="text-center p-2 bg-muted/30 rounded">
            <div className="text-muted-foreground">Total Value</div>
            <div className="font-mono font-bold">${portfolioStats.totalValue.toFixed(2)}</div>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <div className="text-muted-foreground">24h Change</div>
            <div className={`font-mono font-bold ${portfolioStats.dayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioStats.dayChangePercent > 0 ? '+' : ''}{portfolioStats.dayChangePercent.toFixed(2)}%
            </div>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <div className="text-muted-foreground">Sharpe Ratio</div>
            <div className="font-mono font-bold">{portfolioStats.sharpeRatio.toFixed(2)}</div>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <div className="text-muted-foreground">Diversification</div>
            <div className="font-mono font-bold">{portfolioStats.diversificationScore.toFixed(1)}%</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-2">
        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heatmap">Heatmap</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allocation">Allocation</SelectItem>
                <SelectItem value="value">Value</SelectItem>
                <SelectItem value="pnl">P&L</SelectItem>
                <SelectItem value="change">Change</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
              <SelectTrigger className="w-20 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="profitable">Profitable</SelectItem>
                <SelectItem value="losing">Losing</SelectItem>
                <SelectItem value="major">Major</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1 h-7"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Portfolio Visualization */}
        <div className="space-y-3">
          {viewMode === 'heatmap' && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/20 rounded">
              {filteredAndSortedHoldings.map(renderHeatmapCell)}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-0">
              {/* Header */}
              <div className="grid grid-cols-8 gap-2 p-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
                <div>Asset</div>
                <div className="text-right">Holdings</div>
                <div className="text-right">Value</div>
                <div className="text-right">24h Change</div>
                <div className="text-right">Unrealized P&L</div>
                <div className="text-right">Risk/Beta</div>
                <div className="text-right">Allocation</div>
                <div className="text-right">Actions</div>
              </div>
              
              {/* Assets */}
              <div className="max-h-80 overflow-y-auto">
                {filteredAndSortedHoldings.map(renderListItem)}
              </div>
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAndSortedHoldings.map(asset => (
                <Card key={asset.symbol} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs text-white font-bold">
                        {asset.symbol[0]}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{asset.symbol}</div>
                        <div className="text-xs text-muted-foreground">{asset.allocation.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${asset.changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {asset.changePercent24h > 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="font-mono">${asset.value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={`font-mono ${asset.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {asset.unrealizedPnL > 0 ? '+' : ''}${asset.unrealizedPnL.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
          <span>Assets: {filteredAndSortedHoldings.length} / {holdings.length}</span>
          <span>Updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiAssetPortfolio;