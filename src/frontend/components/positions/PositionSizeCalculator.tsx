import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Input } from '@/frontend/components/ui/input';
import { Label } from '@/frontend/components/ui/label';
import { Badge } from '@/frontend/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/frontend/components/ui/select';
import { Separator } from '@/frontend/components/ui/separator';
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  Info 
} from 'lucide-react';
import { usePositionSizeCalculator } from '@/frontend/hooks/usePositions';
import { PositionSizeCalculation } from '@/shared/types/trading';

interface PositionSizeCalculatorProps {
  onCalculationComplete?: (calculation: PositionSizeCalculation) => void;
  initialSymbol?: string;
  accountBalance?: number;
}

export const PositionSizeCalculator: React.FC<PositionSizeCalculatorProps> = ({
  onCalculationComplete,
  initialSymbol = 'BTC-USD',
  accountBalance = 10000,
}) => {
  const [formData, setFormData] = useState({
    symbol: initialSymbol,
    accountBalance: accountBalance.toString(),
    riskPercent: '2',
    entryPrice: '',
    stopLoss: '',
  });

  const [calculation, setCalculation] = useState<PositionSizeCalculation | null>(null);
  const positionSizeCalculator = usePositionSizeCalculator();

  const handleCalculate = async () => {
    if (!formData.entryPrice || !formData.stopLoss) {
      return;
    }

    const params = {
      symbol: formData.symbol,
      riskPercent: parseFloat(formData.riskPercent),
      entryPrice: parseFloat(formData.entryPrice),
      stopLoss: parseFloat(formData.stopLoss),
      accountBalance: parseFloat(formData.accountBalance),
    };

    try {
      const result = await positionSizeCalculator.mutateAsync(params);
      setCalculation(result);
      onCalculationComplete?.(result);
    } catch (error) {
      console.error('Position size calculation error:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(2)}%`;
  };

  const getRiskLevel = (riskPercent: number) => {
    if (riskPercent <= 1) return { level: 'Conservative', color: 'bg-green-100 text-green-800' };
    if (riskPercent <= 2) return { level: 'Moderate', color: 'bg-yellow-100 text-yellow-800' };
    if (riskPercent <= 3) return { level: 'Aggressive', color: 'bg-orange-100 text-orange-800' };
    return { level: 'Very High Risk', color: 'bg-red-100 text-red-800' };
  };

  const riskAssessment = getRiskLevel(parseFloat(formData.riskPercent));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Position Size Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="symbol">Trading Pair</Label>
            <Select value={formData.symbol} onValueChange={(value) => setFormData({...formData, symbol: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                <SelectItem value="ADA-USD">ADA-USD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accountBalance">Account Balance</Label>
            <Input
              id="accountBalance"
              type="number"
              step="0.01"
              value={formData.accountBalance}
              onChange={(e) => setFormData({...formData, accountBalance: e.target.value})}
              placeholder="10000"
            />
          </div>

          <div>
            <Label htmlFor="riskPercent" className="flex items-center gap-2">
              Risk Percentage
              <Badge className={riskAssessment.color}>
                {riskAssessment.level}
              </Badge>
            </Label>
            <Input
              id="riskPercent"
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={formData.riskPercent}
              onChange={(e) => setFormData({...formData, riskPercent: e.target.value})}
              placeholder="2.0"
            />
          </div>

          <div>
            <Label htmlFor="entryPrice">Entry Price</Label>
            <Input
              id="entryPrice"
              type="number"
              step="0.01"
              value={formData.entryPrice}
              onChange={(e) => setFormData({...formData, entryPrice: e.target.value})}
              placeholder="65000"
            />
          </div>

          <div>
            <Label htmlFor="stopLoss">Stop Loss Price</Label>
            <Input
              id="stopLoss"
              type="number"
              step="0.01"
              value={formData.stopLoss}
              onChange={(e) => setFormData({...formData, stopLoss: e.target.value})}
              placeholder="62000"
            />
          </div>

          <div className="flex items-end">
            <Button 
              onClick={handleCalculate}
              disabled={!formData.entryPrice || !formData.stopLoss || positionSizeCalculator.isPending}
              className="w-full"
            >
              {positionSizeCalculator.isPending ? 'Calculating...' : 'Calculate Position Size'}
            </Button>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Risk Assessment</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Risk Amount:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(parseFloat(formData.accountBalance || '0') * parseFloat(formData.riskPercent || '0') / 100)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Risk Level:</span>
              <Badge className={`ml-2 ${riskAssessment.color}`}>
                {riskAssessment.level}
              </Badge>
            </div>
          </div>
        </div>

        {/* Calculation Results */}
        {calculation && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <h3 className="text-lg font-semibold">Position Sizing Results</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Recommended Position Size */}
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Recommended Size
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {calculation.recommendedQuantity.toFixed(6)}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      {formData.symbol.split('-')[0]}
                    </div>
                  </CardContent>
                </Card>

                {/* Position Value */}
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Position Value
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(calculation.positionValue)}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      Total exposure
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Amount */}
                <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Risk Amount
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {formatCurrency(calculation.riskAmount)}
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">
                      {formatPercent(calculation.riskPercent)} of account
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Position Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Entry Price:</span>
                    <span className="font-medium">{formatCurrency(calculation.entryPrice)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Stop Loss:</span>
                    <span className="font-medium">{formatCurrency(calculation.stopLoss)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Price Risk:</span>
                    <span className="font-medium">
                      {formatCurrency(Math.abs(calculation.entryPrice - calculation.stopLoss))}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Max Quantity:</span>
                    <span className="font-medium">{calculation.maxQuantity.toFixed(6)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-center">
                <Button 
                  onClick={() => {
                    // This would open the order placement dialog with pre-filled values
                    console.log('Use calculated position size for order placement');
                  }}
                  className="w-full md:w-auto"
                >
                  Use This Position Size
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};