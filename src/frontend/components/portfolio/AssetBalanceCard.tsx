import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Badge } from "components/ui/badge";
import { TrendingUp, TrendingDown, Lock, Wallet } from 'lucide-react';
import type { AssetBalance } from '@/shared/types/trading';

interface AssetBalanceCardProps {
  balance: AssetBalance;
}

export function AssetBalanceCard({ balance }: AssetBalanceCardProps) {
  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  const formatCurrency = (num: number) => {
    return `$${formatNumber(num, 2)}`;
  };

  const getAssetIcon = (asset: string) => {
    // Simple asset icon logic - in production you'd use actual crypto icons
    const icons: Record<string, string> = {
      BTC: '₿',
      ETH: 'Ξ',
      SOL: '◎',
      USDC: '$'
    };
    return icons[asset] || '●';
  };

  const isPositiveChange = balance.change24h >= 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getAssetIcon(balance.asset)}</span>
            <span>{balance.asset}</span>
          </div>
          <Badge 
            variant={isPositiveChange ? "default" : "destructive"}
            className="flex items-center gap-1"
          >
            {isPositiveChange ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isPositiveChange ? '+' : ''}{balance.change24hPercent.toFixed(2)}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* USD Value */}
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(balance.usdValue)}
          </div>
          <div className={`text-sm ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
            {isPositiveChange ? '+' : ''}{formatCurrency(balance.change24h)} (24h)
          </div>
        </div>

        {/* Balance Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total Balance</span>
            </div>
            <span className="font-medium">
              {formatNumber(balance.balance, balance.asset === 'USDC' ? 2 : 6)} {balance.asset}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <span className="font-medium text-green-600">
              {formatNumber(balance.availableBalance, balance.asset === 'USDC' ? 2 : 6)} {balance.asset}
            </span>
          </div>

          {balance.lockedBalance > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">Locked</span>
              </div>
              <span className="font-medium text-orange-600">
                {formatNumber(balance.lockedBalance, balance.asset === 'USDC' ? 2 : 6)} {balance.asset}
              </span>
            </div>
          )}
        </div>

        {/* Balance Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Available</span>
            <span>Locked</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-green-500 transition-all"
                style={{ width: `${(balance.availableBalance / balance.balance) * 100}%` }}
              />
              <div 
                className="bg-orange-500 transition-all"
                style={{ width: `${(balance.lockedBalance / balance.balance) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}