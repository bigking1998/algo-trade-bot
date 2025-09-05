import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/frontend/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { 
  MoreHorizontal, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Edit,
  AlertTriangle 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/frontend/components/ui/dropdown-menu';
import { Position } from '@/shared/types/trading';
import { useClosePosition } from '@/frontend/hooks/usePositions';

interface PositionsTableProps {
  positions: Position[];
  loading?: boolean;
  onModifyPosition?: (position: Position) => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  loading = false,
  onModifyPosition,
}) => {
  const [sortField, setSortField] = useState<keyof Position>('unrealizedPnL');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const closePositionMutation = useClosePosition();

  const handleSort = (field: keyof Position) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPositions = [...positions].sort((a, b) => {
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

  const formatDuration = (openedAt: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - openedAt.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    }
    return `${diffHours}h`;
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getPnLIcon = (pnl: number) => {
    if (pnl > 0) return <TrendingUp className="h-4 w-4" />;
    if (pnl < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const handleClosePosition = (positionId: string) => {
    if (confirm('Are you sure you want to close this position?')) {
      closePositionMutation.mutate(positionId);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
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
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No active positions found. Your positions will appear here once you open trades.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Active Positions
          <Badge variant="secondary">{positions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
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
                onClick={() => handleSort('quantity')}
              >
                Quantity
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('entryPrice')}
              >
                Entry Price
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('currentPrice')}
              >
                Current Price
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('unrealizedPnL')}
              >
                Unrealized P&L
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('marketValue')}
              >
                Market Value
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('openedAt')}
              >
                Duration
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPositions.map((position) => (
              <TableRow key={position.id} className="hover:bg-muted/50">
                <TableCell className="font-mono font-medium">
                  {position.symbol}
                  {position.strategyId && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {position.strategyId.slice(0, 8)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={position.side === 'long' ? 'default' : 'secondary'}
                    className={position.side === 'long' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }
                  >
                    {position.side.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {position.quantity.toFixed(6)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(position.entryPrice)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(position.currentPrice)}
                  {position.liquidationPrice && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      Liq: {formatCurrency(position.liquidationPrice)}
                    </div>
                  )}
                </TableCell>
                <TableCell className={`text-right font-mono ${getPnLColor(position.unrealizedPnL)}`}>
                  <div className="flex items-center justify-end gap-1">
                    {getPnLIcon(position.unrealizedPnL)}
                    <div>
                      {formatCurrency(position.unrealizedPnL)}
                      <div className="text-xs">
                        {formatPercent(position.unrealizedPnLPercent)}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(position.marketValue)}
                  {position.leverage && position.leverage > 1 && (
                    <div className="text-xs text-muted-foreground">
                      {position.leverage}x leverage
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDuration(position.openedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {onModifyPosition && (
                        <DropdownMenuItem 
                          onClick={() => onModifyPosition(position)}
                          className="flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Modify Position
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleClosePosition(position.id)}
                        className="flex items-center gap-2 text-red-600 dark:text-red-400"
                        disabled={closePositionMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                        {closePositionMutation.isPending ? 'Closing...' : 'Close Position'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};