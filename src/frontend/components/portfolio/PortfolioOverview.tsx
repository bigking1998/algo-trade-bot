import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, PieChart, Wallet, Download } from 'lucide-react';
import { AssetBalanceCard } from './AssetBalanceCard';
import { AllocationChart } from './AllocationChart';
import { usePortfolio } from '@/frontend/hooks/usePortfolio';

interface PortfolioOverviewProps {
  walletAddress?: string | null;
}

export function PortfolioOverview({ walletAddress }: PortfolioOverviewProps) {
  const { balances, summary, loading, error, refetch } = usePortfolio(walletAddress);

  const formatCurrency = (num: number) => {
    return `$${num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const handleExportPortfolio = () => {
    const link = document.createElement('a');
    link.href = '/api/dydx/export/portfolio';
    link.download = 'portfolio_balances.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        {/* Loading Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Portfolio Overview</CardTitle>
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error loading portfolio data: {error}</p>
            <Button variant="outline" onClick={refetch} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!walletAddress) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Connect Your Wallet</p>
            <p className="text-sm">Connect your Phantom wallet to view your portfolio and trading data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>No portfolio data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositiveChange = summary.change24h >= 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Portfolio Overview
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPortfolio}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refetch}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Total Value */}
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground mb-1">Total Portfolio Value</div>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(summary.totalValue)}
              </div>
              <div className={`text-sm flex items-center gap-1 mt-1 ${
                isPositiveChange ? 'text-green-600' : 'text-red-600'
              }`}>
                {isPositiveChange ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {isPositiveChange ? '+' : ''}{formatCurrency(summary.change24h)} (24h)
              </div>
            </div>

            {/* 24h Change */}
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground mb-1">24h Change</div>
              <div className="text-2xl font-bold">
                <Badge 
                  variant={isPositiveChange ? "default" : "destructive"}
                  className="text-lg px-3 py-1"
                >
                  {isPositiveChange ? '+' : ''}{summary.change24hPercent.toFixed(2)}%
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {isPositiveChange ? 'Gained' : 'Lost'} {formatCurrency(Math.abs(summary.change24h))}
              </div>
            </div>

            {/* Total Assets */}
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground mb-1">Total Assets</div>
              <div className="text-2xl font-bold text-foreground">
                {summary.totalAssets}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Different cryptocurrencies
              </div>
            </div>

            {/* Largest Holding */}
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground mb-1">Largest Holding</div>
              <div className="text-2xl font-bold text-foreground">
                {summary.allocation[0]?.asset || 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {summary.allocation[0]?.percentage.toFixed(1)}% of portfolio
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Balances Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Asset Balances</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {balances.map((balance) => (
            <AssetBalanceCard key={balance.asset} balance={balance} />
          ))}
        </div>
      </div>

      {/* Allocation Chart */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Asset Allocation</h2>
        </div>
        <AllocationChart data={summary.allocation} />
      </div>
    </div>
  );
}