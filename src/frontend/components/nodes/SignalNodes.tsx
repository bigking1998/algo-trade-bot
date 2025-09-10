/**
 * Signal Node Components
 * 
 * Trading signal generation nodes including buy/sell signals, position
 * sizing, stop-loss/take-profit levels, and advanced signal combinations.
 */

import React, { useState, useMemo } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import {
  ArrowUp,
  ArrowDown,
  Square,
  Target,
  Shield,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Clock
} from 'lucide-react';

// Base interface for signal nodes
interface BaseSignalNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  selected: boolean;
  onParameterChange: (parameter: string, value: any) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

// Buy Signal Node
export const BuySignalNode: React.FC<BaseSignalNode & {
  condition?: boolean;
  strength: number;
  maxPositionSize?: number;
  priceLevel?: number;
}> = ({ 
  id, 
  selected, 
  condition = false,
  strength = 1.0,
  maxPositionSize = 100,
  priceLevel = 50000,
  onParameterChange, 
  onValidationChange 
}) => {
  const [localStrength, setLocalStrength] = useState(strength);
  const [localMaxSize, setLocalMaxSize] = useState(maxPositionSize);
  
  const isTriggered = condition;
  const signalStrength = isTriggered ? localStrength : 0;

  const handleStrengthChange = (value: number) => {
    setLocalStrength(value);
    onParameterChange('strength', value);
  };

  const handleMaxSizeChange = (value: number) => {
    setLocalMaxSize(value);
    onParameterChange('maxPositionSize', value);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-48 ${
      selected ? 'border-green-500 shadow-xl' : 'border-green-200'
    }`}>
      {/* Header */}
      <div className="px-3 py-2 bg-green-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <ArrowUp className="h-4 w-4 mr-2" />
          <span className="font-semibold">BUY</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Signal
        </Badge>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Signal Status */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {isTriggered ? (
              <div className="relative">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="absolute inset-0 animate-ping">
                  <CheckCircle className="h-8 w-8 text-green-600 opacity-75" />
                </div>
              </div>
            ) : (
              <XCircle className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div className={`text-sm font-medium ${isTriggered ? 'text-green-600' : 'text-gray-500'}`}>
            {isTriggered ? 'TRIGGERED' : 'WAITING'}
          </div>
          {isTriggered && (
            <div className="text-xs text-gray-500 mt-1">
              Signal active at ${priceLevel?.toFixed(2)}
            </div>
          )}
        </div>

        {/* Signal Strength */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Signal Strength:</span>
            <span className="font-medium">{(signalStrength * 100).toFixed(0)}%</span>
          </div>
          <Progress value={signalStrength * 100} className="h-2" />
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Base Strength</Label>
            <Input
              type="number"
              value={localStrength}
              onChange={(e) => handleStrengthChange(parseFloat(e.target.value) || 1)}
              className="h-8 text-sm"
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          <div>
            <Label className="text-xs">Max Position Size (%)</Label>
            <Input
              type="number"
              value={localMaxSize}
              onChange={(e) => handleMaxSizeChange(parseFloat(e.target.value) || 100)}
              className="h-8 text-sm"
              min={1}
              max={100}
            />
          </div>
        </div>

        {/* Trade Sizing Preview */}
        {isTriggered && (
          <div className="bg-green-50 p-2 rounded">
            <div className="text-xs font-medium text-green-800 mb-1">Trade Preview</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Direction:</span>
                <span className="font-medium text-green-600">LONG</span>
              </div>
              <div className="flex justify-between">
                <span>Size:</span>
                <span className="font-medium">{(localMaxSize * localStrength).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Entry:</span>
                <span className="font-medium">${priceLevel?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Condition</span>
          </div>
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Buy Signal</span>
            <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Sell Signal Node
export const SellSignalNode: React.FC<BaseSignalNode & {
  condition?: boolean;
  strength: number;
  maxPositionSize?: number;
  priceLevel?: number;
}> = ({ 
  id, 
  selected, 
  condition = false,
  strength = 1.0,
  maxPositionSize = 100,
  priceLevel = 49800,
  onParameterChange, 
  onValidationChange 
}) => {
  const [localStrength, setLocalStrength] = useState(strength);
  const [localMaxSize, setLocalMaxSize] = useState(maxPositionSize);
  
  const isTriggered = condition;
  const signalStrength = isTriggered ? localStrength : 0;

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-48 ${
      selected ? 'border-red-500 shadow-xl' : 'border-red-200'
    }`}>
      <div className="px-3 py-2 bg-red-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <ArrowDown className="h-4 w-4 mr-2" />
          <span className="font-semibold">SELL</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Signal
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {isTriggered ? (
              <div className="relative">
                <CheckCircle className="h-8 w-8 text-red-600" />
                <div className="absolute inset-0 animate-ping">
                  <CheckCircle className="h-8 w-8 text-red-600 opacity-75" />
                </div>
              </div>
            ) : (
              <XCircle className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div className={`text-sm font-medium ${isTriggered ? 'text-red-600' : 'text-gray-500'}`}>
            {isTriggered ? 'TRIGGERED' : 'WAITING'}
          </div>
          {isTriggered && (
            <div className="text-xs text-gray-500 mt-1">
              Signal active at ${priceLevel?.toFixed(2)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Signal Strength:</span>
            <span className="font-medium">{(signalStrength * 100).toFixed(0)}%</span>
          </div>
          <Progress value={signalStrength * 100} className="h-2" />
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Base Strength</Label>
            <Input
              type="number"
              value={localStrength}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1;
                setLocalStrength(val);
                onParameterChange('strength', val);
              }}
              className="h-8 text-sm"
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          <div>
            <Label className="text-xs">Max Position Size (%)</Label>
            <Input
              type="number"
              value={localMaxSize}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 100;
                setLocalMaxSize(val);
                onParameterChange('maxPositionSize', val);
              }}
              className="h-8 text-sm"
              min={1}
              max={100}
            />
          </div>
        </div>

        {isTriggered && (
          <div className="bg-red-50 p-2 rounded">
            <div className="text-xs font-medium text-red-800 mb-1">Trade Preview</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Direction:</span>
                <span className="font-medium text-red-600">SHORT</span>
              </div>
              <div className="flex justify-between">
                <span>Size:</span>
                <span className="font-medium">{(localMaxSize * localStrength).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Entry:</span>
                <span className="font-medium">${priceLevel?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Condition</span>
          </div>
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Sell Signal</span>
            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Stop Loss Node
export const StopLossNode: React.FC<BaseSignalNode & {
  stopType: 'fixed' | 'trailing' | 'atr';
  stopValue: number;
  currentPrice?: number;
  entryPrice?: number;
}> = ({ 
  id, 
  selected, 
  stopType = 'fixed',
  stopValue = 2.0,
  currentPrice = 50000,
  entryPrice = 50500,
  onParameterChange, 
  onValidationChange 
}) => {
  const [localType, setLocalType] = useState(stopType);
  const [localValue, setLocalValue] = useState(stopValue);
  
  const stopPrice = useMemo(() => {
    if (!entryPrice) return 0;
    
    switch (localType) {
      case 'fixed':
        return entryPrice * (1 - localValue / 100);
      case 'trailing':
        if (!currentPrice) return entryPrice * (1 - localValue / 100);
        return Math.max(entryPrice * (1 - localValue / 100), currentPrice * (1 - localValue / 100));
      case 'atr':
        // Simplified ATR calculation
        const atr = entryPrice * 0.02; // Mock 2% ATR
        return entryPrice - (atr * localValue);
      default:
        return entryPrice * (1 - localValue / 100);
    }
  }, [localType, localValue, entryPrice, currentPrice]);

  const isTriggered = currentPrice ? currentPrice <= stopPrice : false;
  const distanceToStop = currentPrice ? ((currentPrice - stopPrice) / currentPrice) * 100 : 0;

  const handleTypeChange = (value: string) => {
    setLocalType(value as any);
    onParameterChange('stopType', value);
  };

  const handleValueChange = (value: number) => {
    setLocalValue(value);
    onParameterChange('stopValue', value);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-red-500 shadow-xl' : 'border-red-200'
    }`}>
      <div className="px-3 py-2 bg-red-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Shield className="h-4 w-4 mr-2" />
          <span className="font-semibold">Stop Loss</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Risk Mgmt
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {isTriggered ? (
              <AlertTriangle className="h-8 w-8 text-red-600 animate-pulse" />
            ) : (
              <Shield className="h-8 w-8 text-green-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${isTriggered ? 'text-red-600' : 'text-green-600'}`}>
            {isTriggered ? 'TRIGGERED' : 'ACTIVE'}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded space-y-1">
          <div className="flex justify-between text-sm">
            <span>Stop Price:</span>
            <span className="font-medium">${stopPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Current:</span>
            <span className="font-medium">${currentPrice?.toFixed(2) || '--'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Distance:</span>
            <span className={`font-medium ${distanceToStop > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {distanceToStop.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Stop Type</Label>
            <Select value={localType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed %</SelectItem>
                <SelectItem value="trailing">Trailing %</SelectItem>
                <SelectItem value="atr">ATR Multiple</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              {localType === 'fixed' ? 'Stop Loss %' : 
               localType === 'trailing' ? 'Trailing %' : 'ATR Multiple'}
            </Label>
            <Input
              type="number"
              value={localValue}
              onChange={(e) => handleValueChange(parseFloat(e.target.value) || 2)}
              className="h-8 text-sm"
              min={0.1}
              max={localType === 'atr' ? 5 : 20}
              step={localType === 'atr' ? 0.1 : 0.5}
            />
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white mr-2" />
            <span className="text-xs">Entry Price</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Current Price</span>
          </div>
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Stop Signal</span>
            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Take Profit Node
export const TakeProfitNode: React.FC<BaseSignalNode & {
  targetType: 'fixed' | 'risk-reward' | 'fibonacci';
  targetValue: number;
  currentPrice?: number;
  entryPrice?: number;
  riskAmount?: number;
}> = ({ 
  id, 
  selected, 
  targetType = 'fixed',
  targetValue = 5.0,
  currentPrice = 50000,
  entryPrice = 49500,
  riskAmount = 1000,
  onParameterChange, 
  onValidationChange 
}) => {
  const [localType, setLocalType] = useState(targetType);
  const [localValue, setLocalValue] = useState(targetValue);
  
  const targetPrice = useMemo(() => {
    if (!entryPrice) return 0;
    
    switch (localType) {
      case 'fixed':
        return entryPrice * (1 + localValue / 100);
      case 'risk-reward':
        if (!riskAmount) return entryPrice * (1 + localValue / 100);
        return entryPrice + (riskAmount * localValue);
      case 'fibonacci':
        // Simplified fibonacci extension
        const fibLevels = [1.618, 2.618, 4.236];
        const level = fibLevels[Math.floor(localValue) - 1] || 1.618;
        return entryPrice + ((entryPrice * 0.02) * level); // Mock calculation
      default:
        return entryPrice * (1 + localValue / 100);
    }
  }, [localType, localValue, entryPrice, riskAmount]);

  const isTriggered = currentPrice ? currentPrice >= targetPrice : false;
  const distanceToTarget = currentPrice ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-green-500 shadow-xl' : 'border-green-200'
    }`}>
      <div className="px-3 py-2 bg-green-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Target className="h-4 w-4 mr-2" />
          <span className="font-semibold">Take Profit</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Target
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {isTriggered ? (
              <CheckCircle className="h-8 w-8 text-green-600 animate-pulse" />
            ) : (
              <Target className="h-8 w-8 text-orange-500" />
            )}
          </div>
          <div className={`text-sm font-medium ${isTriggered ? 'text-green-600' : 'text-orange-500'}`}>
            {isTriggered ? 'TARGET HIT' : 'WAITING'}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded space-y-1">
          <div className="flex justify-between text-sm">
            <span>Target Price:</span>
            <span className="font-medium">${targetPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Current:</span>
            <span className="font-medium">${currentPrice?.toFixed(2) || '--'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Distance:</span>
            <span className={`font-medium ${distanceToTarget > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {Math.abs(distanceToTarget).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Target Type</Label>
            <Select value={localType} onValueChange={(value) => {
              setLocalType(value as any);
              onParameterChange('targetType', value);
            }}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed %</SelectItem>
                <SelectItem value="risk-reward">Risk:Reward</SelectItem>
                <SelectItem value="fibonacci">Fibonacci</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              {localType === 'fixed' ? 'Target %' : 
               localType === 'risk-reward' ? 'R:R Ratio' : 'Fib Level'}
            </Label>
            <Input
              type="number"
              value={localValue}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || (localType === 'risk-reward' ? 2 : 5);
                setLocalValue(val);
                onParameterChange('targetValue', val);
              }}
              className="h-8 text-sm"
              min={0.1}
              max={localType === 'fibonacci' ? 3 : 50}
              step={localType === 'risk-reward' ? 0.1 : 0.5}
            />
          </div>
        </div>

        {/* Profit Preview */}
        {entryPrice && currentPrice && (
          <div className="bg-green-50 p-2 rounded">
            <div className="text-xs font-medium text-green-800 mb-1">Profit Preview</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Entry:</span>
                <span className="font-medium">${entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Target:</span>
                <span className="font-medium">${targetPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Profit:</span>
                <span className="font-medium text-green-600">
                  ${(targetPrice - entryPrice).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-400 border-2 border-white mr-2" />
            <span className="text-xs">Entry Price</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Current Price</span>
          </div>
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Target Hit</span>
            <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Position Size Calculator Node
export const PositionSizeNode: React.FC<BaseSignalNode & {
  riskPercent: number;
  accountBalance?: number;
  entryPrice?: number;
  stopPrice?: number;
}> = ({ 
  id, 
  selected, 
  riskPercent = 1.0,
  accountBalance = 10000,
  entryPrice = 50000,
  stopPrice = 49000,
  onParameterChange, 
  onValidationChange 
}) => {
  const [localRisk, setLocalRisk] = useState(riskPercent);
  
  const positionSize = useMemo(() => {
    if (!accountBalance || !entryPrice || !stopPrice) return { dollars: 0, units: 0 };
    
    const riskAmount = accountBalance * (localRisk / 100);
    const riskPerUnit = Math.abs(entryPrice - stopPrice);
    const units = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
    const dollars = units * entryPrice;
    
    return { dollars, units, riskAmount };
  }, [accountBalance, entryPrice, stopPrice, localRisk]);

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-blue-500 shadow-xl' : 'border-blue-200'
    }`}>
      <div className="px-3 py-2 bg-blue-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 mr-2" />
          <span className="font-semibold">Position Size</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Calculator
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="bg-blue-50 p-2 rounded">
          <div className="text-xs font-medium text-blue-800 mb-2">Calculated Size</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Position Value:</span>
              <span className="font-medium">${positionSize.dollars.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Units:</span>
              <span className="font-medium">{positionSize.units.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Amount:</span>
              <span className="font-medium text-red-600">${positionSize.riskAmount?.toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs">Risk Percentage</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={localRisk}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1;
                setLocalRisk(val);
                onParameterChange('riskPercent', val);
              }}
              className="h-8 text-sm"
              min={0.1}
              max={10}
              step={0.1}
            />
            <Percent className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Account:</span>
            <span>${accountBalance?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Entry:</span>
            <span>${entryPrice?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Stop:</span>
            <span>${stopPrice?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Risk/Unit:</span>
            <span>${Math.abs((entryPrice || 0) - (stopPrice || 0)).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white mr-2" />
            <span className="text-xs">Entry Price</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-400 border-2 border-white mr-2" />
            <span className="text-xs">Stop Price</span>
          </div>
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Position Size</span>
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all signal nodes
export const SignalNodes = {
  Buy: BuySignalNode,
  Sell: SellSignalNode,
  StopLoss: StopLossNode,
  TakeProfit: TakeProfitNode,
  PositionSize: PositionSizeNode
};

export default SignalNodes;