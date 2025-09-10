/**
 * Technical Indicator Node Components
 * 
 * Specialized node implementations for technical indicators including
 * SMA, EMA, RSI, MACD, Bollinger Bands, and other common indicators.
 * Each node provides real-time calculation and visualization capabilities.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import {
  TrendingUp,
  Activity,
  BarChart3,
  LineChart,
  Signal,
  Zap,
  Settings,
  Info,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

// Base interface for all indicator nodes
interface BaseIndicatorNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  selected: boolean;
  onParameterChange: (parameter: string, value: any) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

// SMA Node Component
export const SMANode: React.FC<BaseIndicatorNode & {
  period: number;
  priceInput: 'open' | 'high' | 'low' | 'close' | 'hlc3' | 'ohlc4';
}> = ({ 
  id, 
  period = 20, 
  priceInput = 'close',
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localPeriod, setLocalPeriod] = useState(period);
  const [isValid, setIsValid] = useState(true);
  
  // Validation
  useEffect(() => {
    const errors = [];
    let valid = true;
    
    if (localPeriod < 2) {
      errors.push('Period must be at least 2');
      valid = false;
    }
    
    if (localPeriod > 1000) {
      errors.push('Period should not exceed 1000');
      valid = false;
    }
    
    setIsValid(valid);
    onValidationChange(valid, errors);
  }, [localPeriod, onValidationChange]);

  // Mock calculation for preview
  const smaValue = useMemo(() => {
    return 50000 + Math.sin(Date.now() / 10000) * 2000; // Mock SMA value
  }, []);

  const handlePeriodChange = (value: number) => {
    setLocalPeriod(value);
    onParameterChange('period', value);
  };

  const handlePriceInputChange = (value: string) => {
    onParameterChange('priceInput', value);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-48 ${
      selected ? 'border-blue-500 shadow-xl' : 'border-blue-200'
    }`}>
      {/* Header */}
      <div className="px-3 py-2 bg-blue-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <TrendingUp className="h-4 w-4 mr-2" />
          <span className="font-semibold">SMA</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Indicator
        </Badge>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Current Value Display */}
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">
            ${smaValue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Current SMA</div>
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Period</Label>
            <Input
              type="number"
              value={localPeriod}
              onChange={(e) => handlePeriodChange(parseInt(e.target.value) || 20)}
              className={`h-8 text-sm ${!isValid ? 'border-red-500' : ''}`}
              min={2}
              max={1000}
            />
          </div>

          <div>
            <Label className="text-xs">Price Input</Label>
            <select
              value={priceInput}
              onChange={(e) => handlePriceInputChange(e.target.value)}
              className="w-full h-8 text-sm border border-gray-300 rounded-md px-2"
            >
              <option value="close">Close</option>
              <option value="open">Open</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="hlc3">HLC3</option>
              <option value="ohlc4">OHLC4</option>
            </select>
          </div>
        </div>

        {/* Validation Status */}
        <div className="flex items-center text-xs">
          {isValid ? (
            <><CheckCircle className="h-3 w-3 text-green-500 mr-1" />Valid</>
          ) : (
            <><AlertCircle className="h-3 w-3 text-red-500 mr-1" />Invalid</>
          )}
        </div>
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Price</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs">SMA</span>
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// EMA Node Component
export const EMANode: React.FC<BaseIndicatorNode & {
  period: number;
  smoothing: number;
}> = ({ 
  id, 
  period = 12, 
  smoothing = 2,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localPeriod, setLocalPeriod] = useState(period);
  const [localSmoothing, setLocalSmoothing] = useState(smoothing);
  
  const emaValue = useMemo(() => {
    return 51000 + Math.sin(Date.now() / 8000) * 3000; // Mock EMA value
  }, []);

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-48 ${
      selected ? 'border-green-500 shadow-xl' : 'border-green-200'
    }`}>
      <div className="px-3 py-2 bg-green-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Activity className="h-4 w-4 mr-2" />
          <span className="font-semibold">EMA</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Indicator
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">
            ${emaValue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Current EMA</div>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Period</Label>
            <Input
              type="number"
              value={localPeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 12;
                setLocalPeriod(val);
                onParameterChange('period', val);
              }}
              className="h-8 text-sm"
              min={2}
            />
          </div>

          <div>
            <Label className="text-xs">Smoothing Factor</Label>
            <Input
              type="number"
              value={localSmoothing}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 2;
                setLocalSmoothing(val);
                onParameterChange('smoothing', val);
              }}
              className="h-8 text-sm"
              min={1}
              max={10}
              step={0.1}
            />
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white mr-2" />
            <span className="text-xs">Price</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs">EMA</span>
            <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// RSI Node Component
export const RSINode: React.FC<BaseIndicatorNode & {
  period: number;
  overbought: number;
  oversold: number;
}> = ({ 
  id, 
  period = 14, 
  overbought = 70,
  oversold = 30,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localPeriod, setLocalPeriod] = useState(period);
  const [localOverbought, setLocalOverbought] = useState(overbought);
  const [localOversold, setLocalOversold] = useState(oversold);
  
  const rsiValue = useMemo(() => {
    return 50 + Math.sin(Date.now() / 15000) * 30; // Mock RSI value
  }, []);

  const getRSIColor = (value: number) => {
    if (value >= localOverbought) return 'text-red-600';
    if (value <= localOversold) return 'text-green-600';
    return 'text-blue-600';
  };

  const getRSIStatus = (value: number) => {
    if (value >= localOverbought) return 'Overbought';
    if (value <= localOversold) return 'Oversold';
    return 'Neutral';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-48 ${
      selected ? 'border-purple-500 shadow-xl' : 'border-purple-200'
    }`}>
      <div className="px-3 py-2 bg-purple-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <BarChart3 className="h-4 w-4 mr-2" />
          <span className="font-semibold">RSI</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Oscillator
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className={`text-lg font-bold ${getRSIColor(rsiValue)}`}>
            {rsiValue.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">{getRSIStatus(rsiValue)}</div>
          
          {/* RSI Visual Gauge */}
          <div className="mt-2">
            <Progress value={rsiValue} className="h-2" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{localOversold}</span>
              <span>50</span>
              <span>{localOverbought}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Period</Label>
            <Input
              type="number"
              value={localPeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 14;
                setLocalPeriod(val);
                onParameterChange('period', val);
              }}
              className="h-8 text-sm"
              min={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Overbought</Label>
              <Input
                type="number"
                value={localOverbought}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 70;
                  setLocalOverbought(val);
                  onParameterChange('overbought', val);
                }}
                className="h-8 text-sm"
                min={50}
                max={100}
              />
            </div>

            <div>
              <Label className="text-xs">Oversold</Label>
              <Input
                type="number"
                value={localOversold}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 30;
                  setLocalOversold(val);
                  onParameterChange('oversold', val);
                }}
                className="h-8 text-sm"
                min={0}
                max={50}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-400 border-2 border-white mr-2" />
            <span className="text-xs">Price</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs">RSI</span>
            <div className="w-3 h-3 rounded-full bg-purple-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// MACD Node Component
export const MACDNode: React.FC<BaseIndicatorNode & {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}> = ({ 
  id, 
  fastPeriod = 12, 
  slowPeriod = 26,
  signalPeriod = 9,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localFast, setLocalFast] = useState(fastPeriod);
  const [localSlow, setLocalSlow] = useState(slowPeriod);
  const [localSignal, setLocalSignal] = useState(signalPeriod);
  
  const macdData = useMemo(() => ({
    macd: Math.sin(Date.now() / 12000) * 100,
    signal: Math.sin(Date.now() / 12000 + 1) * 80,
    histogram: Math.sin(Date.now() / 12000) * 20
  }), []);

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-orange-500 shadow-xl' : 'border-orange-200'
    }`}>
      <div className="px-3 py-2 bg-orange-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <LineChart className="h-4 w-4 mr-2" />
          <span className="font-semibold">MACD</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Momentum
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>MACD:</span>
            <span className={`font-medium ${macdData.macd > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {macdData.macd.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Signal:</span>
            <span className="font-medium text-blue-600">
              {macdData.signal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Histogram:</span>
            <span className={`font-medium ${macdData.histogram > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {macdData.histogram.toFixed(2)}
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fast</Label>
              <Input
                type="number"
                value={localFast}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 12;
                  setLocalFast(val);
                  onParameterChange('fastPeriod', val);
                }}
                className="h-8 text-sm"
                min={1}
              />
            </div>

            <div>
              <Label className="text-xs">Slow</Label>
              <Input
                type="number"
                value={localSlow}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 26;
                  setLocalSlow(val);
                  onParameterChange('slowPeriod', val);
                }}
                className="h-8 text-sm"
                min={1}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Signal Period</Label>
            <Input
              type="number"
              value={localSignal}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 9;
                setLocalSignal(val);
                onParameterChange('signalPeriod', val);
              }}
              className="h-8 text-sm"
              min={1}
            />
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-orange-400 border-2 border-white mr-2" />
              <span className="text-xs">Price</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">MACD</span>
            <div className="w-3 h-3 rounded-full bg-orange-600 border-2 border-white" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Signal</span>
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Histogram</span>
            <div className="w-3 h-3 rounded-full bg-gray-600 border-2 border-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Bollinger Bands Node Component
export const BollingerBandsNode: React.FC<BaseIndicatorNode & {
  period: number;
  stdDev: number;
}> = ({ 
  id, 
  period = 20, 
  stdDev = 2,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localPeriod, setLocalPeriod] = useState(period);
  const [localStdDev, setLocalStdDev] = useState(stdDev);
  
  const bbData = useMemo(() => {
    const middle = 50000;
    const deviation = 1000 * localStdDev;
    return {
      upper: middle + deviation,
      middle: middle,
      lower: middle - deviation,
      price: middle + Math.sin(Date.now() / 10000) * deviation * 0.8
    };
  }, [localStdDev]);

  const getBBPosition = () => {
    const position = ((bbData.price - bbData.lower) / (bbData.upper - bbData.lower)) * 100;
    if (position > 80) return { status: 'Near Upper', color: 'text-red-600' };
    if (position < 20) return { status: 'Near Lower', color: 'text-green-600' };
    return { status: 'Middle Zone', color: 'text-blue-600' };
  };

  const position = getBBPosition();

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-indigo-500 shadow-xl' : 'border-indigo-200'
    }`}>
      <div className="px-3 py-2 bg-indigo-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Activity className="h-4 w-4 mr-2" />
          <span className="font-semibold">BB</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Volatility
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Upper:</span>
            <span className="font-medium text-red-600">
              ${bbData.upper.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Middle:</span>
            <span className="font-medium text-blue-600">
              ${bbData.middle.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Lower:</span>
            <span className="font-medium text-green-600">
              ${bbData.lower.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t pt-1">
            <span>Position:</span>
            <span className={`font-medium ${position.color}`}>
              {position.status}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Period</Label>
            <Input
              type="number"
              value={localPeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 20;
                setLocalPeriod(val);
                onParameterChange('period', val);
              }}
              className="h-8 text-sm"
              min={2}
            />
          </div>

          <div>
            <Label className="text-xs">Std Deviation</Label>
            <Input
              type="number"
              value={localStdDev}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 2;
                setLocalStdDev(val);
                onParameterChange('stdDev', val);
              }}
              className="h-8 text-sm"
              min={0.1}
              max={5}
              step={0.1}
            />
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-indigo-400 border-2 border-white mr-2" />
              <span className="text-xs">Price</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Upper</span>
            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Middle</span>
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Lower</span>
            <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all indicator nodes
export const IndicatorNodes = {
  SMA: SMANode,
  EMA: EMANode,
  RSI: RSINode,
  MACD: MACDNode,
  BollingerBands: BollingerBandsNode
};

export default IndicatorNodes;