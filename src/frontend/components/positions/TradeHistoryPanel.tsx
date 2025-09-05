import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/frontend/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/frontend/components/ui/table';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Input } from '@/frontend/components/ui/input';
import { Label } from '@/frontend/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/frontend/components/ui/select';
import { Separator } from '@/frontend/components/ui/separator';
import { 
  Filter, 
  Download, 
  TrendingUp, 
  TrendingDown,
  Clock,
  DollarSign,
  Percent,
  BarChart3 
} from 'lucide-react';
import { 
  TradeHistoryEntry, 
  TradeFilters,
  TradeStatistics 
} from '@/shared/types/trading';
import { useTradeHistory } from '@/frontend/hooks/usePositions';

interface TradeHistoryPanelProps {
  trades?: TradeHistoryEntry[];
  loading?: boolean;
}

export const TradeHistoryPanel: React.FC<TradeHistoryPanelProps> = ({
  trades = [],
  loading = false,
}) => {
  const [filters, setFilters] = useState<TradeFilters>({
    dateFrom: '',
    dateTo: '',
    symbol: '',
    strategy: '',
    side: undefined,
    profitLoss: 'all',
    status: 'all',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<keyof TradeHistoryEntry>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: tradeHistory = [], isLoading } = useTradeHistory(filters);

  const handleSort = (field: keyof TradeHistoryEntry) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTrades = [...tradeHistory].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPnLColor = (pnl?: number) => {
    if (!pnl) return 'text-gray-600 dark:text-gray-400';
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getPnLIcon = (pnl?: number) => {
    if (!pnl) return null;
    if (pnl > 0) return <TrendingUp className="h-4 w-4" />;
    if (pnl < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  // Calculate trade statistics
  const calculateStats = (trades: TradeHistoryEntry[]): TradeStatistics => {
    const closedTrades = trades.filter(trade => trade.status === 'CLOSED' && trade.pnl !== undefined);
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0).length;
    
    const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalVolume = closedTrades.reduce((sum, trade) => sum + (trade.quantity * trade.entryPrice), 0);
    const avgDuration = closedTrades.reduce((sum, trade) => sum + (trade.duration || 0), 0) / totalTrades || 0;
    
    const pnls = closedTrades.map(trade => trade.pnl || 0);
    const bestTrade = Math.max(...pnls, 0);
    const worstTrade = Math.min(...pnls, 0);
    
    const grossProfit = closedTrades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      totalPnl,
      totalVolume,
      avgTradeDuration: avgDuration,
      bestTrade,
      worstTrade,
      profitFactor,
      maxDrawdown: 0, // Would need price history to calculate properly
    };
  };

  const stats = calculateStats(sortedTrades);

  const handleExportTrades = () => {
    const csvContent = [
      ['Date', 'Symbol', 'Side', 'Entry Price', 'Exit Price', 'Quantity', 'P&L', 'P&L %', 'Fees', 'Strategy', 'Duration'].join(','),
      ...sortedTrades.map(trade => [
        trade.timestamp,
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice || '',
        trade.quantity,
        trade.pnl || '',
        trade.pnlPercent || '',
        trade.fees,
        trade.strategy || '',
        trade.duration || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            Trade History
            <Badge variant="secondary">{sortedTrades.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportTrades}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trade Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Total Trades
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {stats.totalTrades}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {stats.winningTrades}W / {stats.losingTrades}L
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Win Rate
                </span>
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {stats.winRate.toFixed(1)}%
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                Success rate
              </div>
            </CardContent>
          </Card>

          <Card className={`${stats.totalPnl >= 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={`h-4 w-4 ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className={`text-sm font-medium ${stats.totalPnl >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  Total P&L
                </span>
              </div>
              <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                {formatCurrency(stats.totalPnl)}
              </div>
              <div className={`text-sm ${stats.totalPnl >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                Net profit/loss
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Avg Duration
                </span>
              </div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {formatDuration(stats.avgTradeDuration)}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">
                Per trade
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Select value={filters.symbol} onValueChange={(value) => setFilters({...filters, symbol: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All symbols" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Symbols</SelectItem>
                    <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                    <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                    <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="side">Side</Label>
                <Select value={filters.side} onValueChange={(value) => setFilters({...filters, side: value as any})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sides" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sides</SelectItem>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="profitLoss">P&L</Label>
                <Select value={filters.profitLoss} onValueChange={(value) => setFilters({...filters, profitLoss: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trades</SelectItem>
                    <SelectItem value="profit">Profitable Only</SelectItem>
                    <SelectItem value="loss">Losses Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open Only</SelectItem>
                    <SelectItem value="closed">Closed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* Trade Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('timestamp')}
                >
                  Date
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('symbol')}
                >
                  Symbol
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('side')}
                >
                  Side
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-right"
                  onClick={() => handleSort('entryPrice')}
                >
                  Entry
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-right"
                  onClick={() => handleSort('exitPrice')}
                >
                  Exit
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-right"
                  onClick={() => handleSort('quantity')}
                >
                  Quantity
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-right"
                  onClick={() => handleSort('pnl')}
                >
                  P&L
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('duration')}
                >
                  Duration
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('strategy')}
                >
                  Strategy
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No trade history found. Your completed trades will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                sortedTrades.map((trade) => (
                  <TableRow key={trade.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(trade.timestamp)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(trade.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {trade.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={trade.side === 'BUY' ? 'default' : 'secondary'}
                        className={trade.side === 'BUY' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }
                      >
                        {trade.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(trade.entryPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.quantity.toFixed(6)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${getPnLColor(trade.pnl)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getPnLIcon(trade.pnl)}
                        <div>
                          {trade.pnl ? formatCurrency(trade.pnl) : '-'}
                          {trade.pnlPercent && (
                            <div className="text-xs">
                              {formatPercent(trade.pnlPercent)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(trade.duration)}
                    </TableCell>
                    <TableCell>
                      {trade.strategy && (
                        <Badge variant="outline" className="text-xs">
                          {trade.strategy}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={trade.status === 'CLOSED' ? 'default' : 'secondary'}
                        className={trade.status === 'CLOSED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }
                      >
                        {trade.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};