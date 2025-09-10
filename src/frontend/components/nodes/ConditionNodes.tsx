/**
 * Condition Node Components
 * 
 * Specialized node implementations for trading conditions including
 * comparisons, crossovers, range checks, and complex boolean logic.
 * Each node provides real-time evaluation and visual feedback.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  ArrowUp,
  ArrowDown,
  Target,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';

// Base interface for condition nodes
interface BaseConditionNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  selected: boolean;
  onParameterChange: (parameter: string, value: any) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

// Comparison Node Component (Greater Than, Less Than, Equal, etc.)
export const ComparisonNode: React.FC<BaseConditionNode & {
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold?: number;
  currentValue?: number;
}> = ({ 
  id, 
  operator = '>', 
  threshold = 50,
  currentValue = 45,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localOperator, setLocalOperator] = useState(operator);
  const [localThreshold, setLocalThreshold] = useState(threshold);
  
  // Calculate result based on current inputs
  const result = useMemo(() => {
    if (currentValue === undefined) return null;
    
    switch (localOperator) {
      case '>': return currentValue > localThreshold;
      case '<': return currentValue < localThreshold;
      case '>=': return currentValue >= localThreshold;
      case '<=': return currentValue <= localThreshold;
      case '==': return Math.abs(currentValue - localThreshold) < 0.01;
      case '!=': return Math.abs(currentValue - localThreshold) >= 0.01;
      default: return null;
    }
  }, [currentValue, localOperator, localThreshold]);

  const getOperatorSymbol = (op: string) => {
    const symbols = { '>': '>', '<': '<', '>=': '≥', '<=': '≤', '==': '=', '!=': '≠' };
    return symbols[op] || op;
  };

  const handleOperatorChange = (value: string) => {
    setLocalOperator(value as any);
    onParameterChange('operator', value);
  };

  const handleThresholdChange = (value: number) => {
    setLocalThreshold(value);
    onParameterChange('threshold', value);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-48 ${
      selected ? 'border-green-500 shadow-xl' : 'border-green-200'
    }`}>
      {/* Header */}
      <div className="px-3 py-2 bg-green-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          {localOperator.includes('>') ? <ArrowUp className="h-4 w-4 mr-2" /> : <ArrowDown className="h-4 w-4 mr-2" />}
          <span className="font-semibold">Compare</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Condition
        </Badge>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Result Display */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result === null ? (
              <AlertCircle className="h-8 w-8 text-gray-400" />
            ) : result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${
            result === null ? 'text-gray-500' : result ? 'text-green-600' : 'text-red-600'
          }`}>
            {result === null ? 'No Data' : result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        {/* Expression Display */}
        <div className="bg-gray-50 p-2 rounded text-center text-sm font-mono">
          {currentValue?.toFixed(2) ?? 'Input'} {getOperatorSymbol(localOperator)} {localThreshold}
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Operator</Label>
            <Select value={localOperator} onValueChange={handleOperatorChange}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=">">Greater than (&gt;)</SelectItem>
                <SelectItem value="<">Less than (&lt;)</SelectItem>
                <SelectItem value=">=">Greater or equal (≥)</SelectItem>
                <SelectItem value="<=">Less or equal (≤)</SelectItem>
                <SelectItem value="==">Equal to (=)</SelectItem>
                <SelectItem value="!=">Not equal (≠)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Threshold</Label>
            <Input
              type="number"
              value={localThreshold}
              onChange={(e) => handleThresholdChange(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm"
              step="any"
            />
          </div>
        </div>
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Value</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs">Result</span>
            <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Crossover Node Component
export const CrossoverNode: React.FC<BaseConditionNode & {
  crossoverType: 'above' | 'below' | 'both';
  sensitivity: number;
  valueA?: number;
  valueB?: number;
}> = ({ 
  id, 
  crossoverType = 'above', 
  sensitivity = 0.1,
  valueA = 52000,
  valueB = 51800,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localType, setLocalType] = useState(crossoverType);
  const [localSensitivity, setLocalSensitivity] = useState(sensitivity);
  
  // Calculate crossover condition
  const crossoverState = useMemo(() => {
    if (valueA === undefined || valueB === undefined) {
      return { triggered: false, direction: 'none', difference: 0 };
    }

    const difference = valueA - valueB;
    const triggered = Math.abs(difference) > localSensitivity;
    let direction: 'above' | 'below' | 'none' = 'none';
    
    if (triggered) {
      direction = difference > 0 ? 'above' : 'below';
    }

    const matches = localType === 'both' || localType === direction;

    return {
      triggered: triggered && matches,
      direction,
      difference,
      matches
    };
  }, [valueA, valueB, localType, localSensitivity]);

  const handleTypeChange = (value: string) => {
    setLocalType(value as any);
    onParameterChange('crossoverType', value);
  };

  const handleSensitivityChange = (value: number) => {
    setLocalSensitivity(value);
    onParameterChange('sensitivity', value);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-blue-500 shadow-xl' : 'border-blue-200'
    }`}>
      <div className="px-3 py-2 bg-blue-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Target className="h-4 w-4 mr-2" />
          <span className="font-semibold">Crossover</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Signal
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        {/* Status Display */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {crossoverState.triggered ? (
              <div className="flex items-center">
                {crossoverState.direction === 'above' ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingUp className="h-8 w-8 text-red-600 rotate-180" />
                )}
              </div>
            ) : (
              <Activity className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div className={`text-sm font-medium ${
            crossoverState.triggered ? 
              (crossoverState.direction === 'above' ? 'text-green-600' : 'text-red-600') :
              'text-gray-500'
          }`}>
            {crossoverState.triggered ? 
              `CROSS ${crossoverState.direction.toUpperCase()}` : 
              'WAITING'
            }
          </div>
        </div>

        {/* Values Display */}
        <div className="bg-gray-50 p-2 rounded space-y-1">
          <div className="flex justify-between text-sm">
            <span>Line A:</span>
            <span className="font-medium">{valueA?.toFixed(2) ?? '--'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Line B:</span>
            <span className="font-medium">{valueB?.toFixed(2) ?? '--'}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-1">
            <span>Difference:</span>
            <span className={`font-medium ${
              crossoverState.difference > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {crossoverState.difference.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Crossover Type</Label>
            <Select value={localType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Cross Above</SelectItem>
                <SelectItem value="below">Cross Below</SelectItem>
                <SelectItem value="both">Both Directions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Sensitivity</Label>
            <Input
              type="number"
              value={localSensitivity}
              onChange={(e) => handleSensitivityChange(parseFloat(e.target.value) || 0.1)}
              className="h-8 text-sm"
              min={0}
              step={0.01}
            />
          </div>
        </div>
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white mr-2" />
              <span className="text-xs">Line A</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-400 border-2 border-white mr-2" />
              <span className="text-xs">Line B</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Crossover</span>
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Range Check Node Component
export const RangeCheckNode: React.FC<BaseConditionNode & {
  minValue: number;
  maxValue: number;
  currentValue?: number;
  inclusive: boolean;
}> = ({ 
  id, 
  minValue = 30, 
  maxValue = 70,
  currentValue = 45,
  inclusive = true,
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);
  const [localInclusive, setLocalInclusive] = useState(inclusive);
  
  // Calculate if value is in range
  const inRange = useMemo(() => {
    if (currentValue === undefined) return null;
    
    if (localInclusive) {
      return currentValue >= localMin && currentValue <= localMax;
    } else {
      return currentValue > localMin && currentValue < localMax;
    }
  }, [currentValue, localMin, localMax, localInclusive]);

  // Calculate position within range for visualization
  const rangePosition = useMemo(() => {
    if (currentValue === undefined) return 50;
    return Math.max(0, Math.min(100, ((currentValue - localMin) / (localMax - localMin)) * 100));
  }, [currentValue, localMin, localMax]);

  const handleMinChange = (value: number) => {
    setLocalMin(value);
    onParameterChange('minValue', value);
  };

  const handleMaxChange = (value: number) => {
    setLocalMax(value);
    onParameterChange('maxValue', value);
  };

  const handleInclusiveChange = (value: boolean) => {
    setLocalInclusive(value);
    onParameterChange('inclusive', value);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-yellow-500 shadow-xl' : 'border-yellow-200'
    }`}>
      <div className="px-3 py-2 bg-yellow-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Filter className="h-4 w-4 mr-2" />
          <span className="font-semibold">Range Check</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Filter
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        {/* Result Display */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {inRange === null ? (
              <AlertCircle className="h-8 w-8 text-gray-400" />
            ) : inRange ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${
            inRange === null ? 'text-gray-500' : inRange ? 'text-green-600' : 'text-red-600'
          }`}>
            {inRange === null ? 'No Data' : inRange ? 'IN RANGE' : 'OUT OF RANGE'}
          </div>
        </div>

        {/* Range Visualization */}
        <div className="space-y-2">
          <div className="relative">
            <Progress value={rangePosition} className="h-3" />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{localMin}</span>
              <span className="font-medium">{currentValue?.toFixed(1) ?? '--'}</span>
              <span>{localMax}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500">
            Range: {localMin} {localInclusive ? '≤' : '<'} value {localInclusive ? '≤' : '<'} {localMax}
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Min Value</Label>
              <Input
                type="number"
                value={localMin}
                onChange={(e) => handleMinChange(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
                step="any"
              />
            </div>

            <div>
              <Label className="text-xs">Max Value</Label>
              <Input
                type="number"
                value={localMax}
                onChange={(e) => handleMaxChange(parseFloat(e.target.value) || 100)}
                className="h-8 text-sm"
                step="any"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={localInclusive}
              onChange={(e) => handleInclusiveChange(e.target.checked)}
              className="rounded"
            />
            <Label className="text-xs">Inclusive bounds</Label>
          </div>
        </div>
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Value</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs">In Range</span>
            <div className="w-3 h-3 rounded-full bg-yellow-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Multi-Condition Node Component
export const MultiConditionNode: React.FC<BaseConditionNode & {
  conditions: Array<{
    id: string;
    name: string;
    value: boolean;
  }>;
  operator: 'AND' | 'OR' | 'XOR';
}> = ({ 
  id, 
  conditions = [],
  operator = 'AND',
  selected, 
  onParameterChange, 
  onValidationChange 
}) => {
  const [localOperator, setLocalOperator] = useState(operator);
  
  // Calculate multi-condition result
  const result = useMemo(() => {
    if (conditions.length === 0) return null;
    
    switch (localOperator) {
      case 'AND':
        return conditions.every(c => c.value);
      case 'OR':
        return conditions.some(c => c.value);
      case 'XOR':
        const trueCount = conditions.filter(c => c.value).length;
        return trueCount === 1;
      default:
        return null;
    }
  }, [conditions, localOperator]);

  const handleOperatorChange = (value: string) => {
    setLocalOperator(value as any);
    onParameterChange('operator', value);
  };

  const trueCount = conditions.filter(c => c.value).length;
  const falseCount = conditions.length - trueCount;

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-52 ${
      selected ? 'border-purple-500 shadow-xl' : 'border-purple-200'
    }`}>
      <div className="px-3 py-2 bg-purple-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <MoreHorizontal className="h-4 w-4 mr-2" />
          <span className="font-semibold">Multi-Condition</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Logic
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        {/* Result Display */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result === null ? (
              <AlertCircle className="h-8 w-8 text-gray-400" />
            ) : result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${
            result === null ? 'text-gray-500' : result ? 'text-green-600' : 'text-red-600'
          }`}>
            {result === null ? 'No Data' : result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        {/* Conditions Summary */}
        <div className="bg-gray-50 p-2 rounded space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total Conditions:</span>
            <span className="font-medium">{conditions.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>True:</span>
            <span className="font-medium text-green-600">{trueCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>False:</span>
            <span className="font-medium text-red-600">{falseCount}</span>
          </div>
        </div>

        {/* Operator Selection */}
        <div>
          <Label className="text-xs">Logic Operator</Label>
          <Select value={localOperator} onValueChange={handleOperatorChange}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND (All must be true)</SelectItem>
              <SelectItem value="OR">OR (Any can be true)</SelectItem>
              <SelectItem value="XOR">XOR (Exactly one true)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Individual Conditions */}
        {conditions.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Condition States</Label>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex justify-between items-center text-xs">
                  <span className="truncate">{condition.name}</span>
                  <div className="flex items-center">
                    {condition.value ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="text-xs text-gray-500 mb-1">Inputs ({conditions.length})</div>
          {conditions.slice(0, 3).map((condition, index) => (
            <div key={condition.id} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
              <span className="text-xs truncate">{condition.name}</span>
            </div>
          ))}
          {conditions.length > 3 && (
            <div className="text-xs text-gray-400">...and {conditions.length - 3} more</div>
          )}
          <div className="flex justify-end items-center pt-2 border-t">
            <span className="text-xs">Result</span>
            <div className="w-3 h-3 rounded-full bg-purple-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all condition nodes
export const ConditionNodes = {
  Comparison: ComparisonNode,
  Crossover: CrossoverNode,
  RangeCheck: RangeCheckNode,
  MultiCondition: MultiConditionNode
};

export default ConditionNodes;