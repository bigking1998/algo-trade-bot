/**
 * Logic Node Components
 * 
 * Boolean logic gate implementations including AND, OR, NOT, XOR,
 * and advanced logic operations for building complex trading conditions.
 */

import React, { useState, useMemo } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  AlertCircle,
  Circle,
  Square
} from 'lucide-react';

// Base interface for logic nodes
interface BaseLogicNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  selected: boolean;
  inputs?: boolean[];
  onParameterChange: (parameter: string, value: any) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

// AND Gate Node
export const ANDGateNode: React.FC<BaseLogicNode> = ({ 
  id, 
  selected, 
  inputs = [false, false],
  onParameterChange, 
  onValidationChange 
}) => {
  const result = useMemo(() => inputs.every(input => input), [inputs]);
  
  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-40 ${
      selected ? 'border-orange-500 shadow-xl' : 'border-orange-200'
    }`}>
      {/* Header */}
      <div className="px-3 py-2 bg-orange-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Circle className="h-4 w-4 mr-2" />
          <span className="font-semibold">AND</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Logic
        </Badge>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Result Display */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${result ? 'text-green-600' : 'text-red-600'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        {/* Truth Table */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-2">AND Gate Logic</div>
          <div className="space-y-1 text-xs">
            {inputs.map((input, index) => (
              <div key={index} className="flex justify-between">
                <span>Input {index + 1}:</span>
                <span className={`font-medium ${input ? 'text-green-600' : 'text-red-600'}`}>
                  {input ? 'TRUE' : 'FALSE'}
                </span>
              </div>
            ))}
            <div className="border-t pt-1 flex justify-between font-medium">
              <span>Result:</span>
              <span className={result ? 'text-green-600' : 'text-red-600'}>
                {result ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ports */}
      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          {inputs.map((_, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
              <span className="text-xs">Input {index + 1}</span>
            </div>
          ))}
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Output</span>
            <div className="w-3 h-3 rounded-full bg-orange-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// OR Gate Node
export const ORGateNode: React.FC<BaseLogicNode> = ({ 
  id, 
  selected, 
  inputs = [false, false],
  onParameterChange, 
  onValidationChange 
}) => {
  const result = useMemo(() => inputs.some(input => input), [inputs]);
  
  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-40 ${
      selected ? 'border-yellow-500 shadow-xl' : 'border-yellow-200'
    }`}>
      <div className="px-3 py-2 bg-yellow-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Circle className="h-4 w-4 mr-2" />
          <span className="font-semibold">OR</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Logic
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${result ? 'text-green-600' : 'text-red-600'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-2">OR Gate Logic</div>
          <div className="space-y-1 text-xs">
            {inputs.map((input, index) => (
              <div key={index} className="flex justify-between">
                <span>Input {index + 1}:</span>
                <span className={`font-medium ${input ? 'text-green-600' : 'text-red-600'}`}>
                  {input ? 'TRUE' : 'FALSE'}
                </span>
              </div>
            ))}
            <div className="border-t pt-1 flex justify-between font-medium">
              <span>Result:</span>
              <span className={result ? 'text-green-600' : 'text-red-600'}>
                {result ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          {inputs.map((_, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
              <span className="text-xs">Input {index + 1}</span>
            </div>
          ))}
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Output</span>
            <div className="w-3 h-3 rounded-full bg-yellow-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// NOT Gate Node
export const NOTGateNode: React.FC<BaseLogicNode & {
  input?: boolean;
}> = ({ 
  id, 
  selected, 
  input = false,
  onParameterChange, 
  onValidationChange 
}) => {
  const result = useMemo(() => !input, [input]);
  
  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-40 ${
      selected ? 'border-red-500 shadow-xl' : 'border-red-200'
    }`}>
      <div className="px-3 py-2 bg-red-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Circle className="h-4 w-4 mr-2" />
          <span className="font-semibold">NOT</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Logic
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${result ? 'text-green-600' : 'text-red-600'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-2">NOT Gate Logic</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Input:</span>
              <span className={`font-medium ${input ? 'text-green-600' : 'text-red-600'}`}>
                {input ? 'TRUE' : 'FALSE'}
              </span>
            </div>
            <div className="border-t pt-1 flex justify-between font-medium">
              <span>Output (NOT):</span>
              <span className={result ? 'text-green-600' : 'text-red-600'}>
                {result ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
            <span className="text-xs">Input</span>
          </div>
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Output</span>
            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// XOR Gate Node
export const XORGateNode: React.FC<BaseLogicNode> = ({ 
  id, 
  selected, 
  inputs = [false, false],
  onParameterChange, 
  onValidationChange 
}) => {
  const result = useMemo(() => {
    const trueCount = inputs.filter(input => input).length;
    return trueCount === 1; // XOR is true if exactly one input is true
  }, [inputs]);
  
  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-40 ${
      selected ? 'border-purple-500 shadow-xl' : 'border-purple-200'
    }`}>
      <div className="px-3 py-2 bg-purple-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Circle className="h-4 w-4 mr-2" />
          <span className="font-semibold">XOR</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Logic
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${result ? 'text-green-600' : 'text-red-600'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-2">XOR Gate Logic</div>
          <div className="space-y-1 text-xs">
            {inputs.map((input, index) => (
              <div key={index} className="flex justify-between">
                <span>Input {index + 1}:</span>
                <span className={`font-medium ${input ? 'text-green-600' : 'text-red-600'}`}>
                  {input ? 'TRUE' : 'FALSE'}
                </span>
              </div>
            ))}
            <div className="border-t pt-1 flex justify-between font-medium">
              <span>Result (XOR):</span>
              <span className={result ? 'text-green-600' : 'text-red-600'}>
                {result ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            True when exactly one input is true
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          {inputs.map((_, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
              <span className="text-xs">Input {index + 1}</span>
            </div>
          ))}
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Output</span>
            <div className="w-3 h-3 rounded-full bg-purple-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// NAND Gate Node (NOT AND)
export const NANDGateNode: React.FC<BaseLogicNode> = ({ 
  id, 
  selected, 
  inputs = [false, false],
  onParameterChange, 
  onValidationChange 
}) => {
  const result = useMemo(() => !inputs.every(input => input), [inputs]);
  
  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-40 ${
      selected ? 'border-indigo-500 shadow-xl' : 'border-indigo-200'
    }`}>
      <div className="px-3 py-2 bg-indigo-500 text-white rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <Circle className="h-4 w-4 mr-2" />
          <span className="font-semibold">NAND</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Logic
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${result ? 'text-green-600' : 'text-red-600'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-2">NAND Gate Logic</div>
          <div className="space-y-1 text-xs">
            {inputs.map((input, index) => (
              <div key={index} className="flex justify-between">
                <span>Input {index + 1}:</span>
                <span className={`font-medium ${input ? 'text-green-600' : 'text-red-600'}`}>
                  {input ? 'TRUE' : 'FALSE'}
                </span>
              </div>
            ))}
            <div className="border-t pt-1 flex justify-between font-medium">
              <span>Result (NAND):</span>
              <span className={result ? 'text-green-600' : 'text-red-600'}>
                {result ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            NOT AND - False only when all inputs are true
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          {inputs.map((_, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
              <span className="text-xs">Input {index + 1}</span>
            </div>
          ))}
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Output</span>
            <div className="w-3 h-3 rounded-full bg-indigo-600 border-2 border-white ml-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Variable Input Gate (configurable number of inputs)
export const VariableGateNode: React.FC<BaseLogicNode & {
  gateType: 'AND' | 'OR' | 'XOR';
  inputCount: number;
}> = ({ 
  id, 
  selected, 
  gateType = 'AND',
  inputCount = 2,
  inputs = [],
  onParameterChange, 
  onValidationChange 
}) => {
  const [localInputCount, setLocalInputCount] = useState(inputCount);
  const [localGateType, setLocalGateType] = useState(gateType);
  
  // Pad or trim inputs to match inputCount
  const normalizedInputs = useMemo(() => {
    const result = [...inputs];
    while (result.length < localInputCount) {
      result.push(false);
    }
    return result.slice(0, localInputCount);
  }, [inputs, localInputCount]);

  const result = useMemo(() => {
    switch (localGateType) {
      case 'AND':
        return normalizedInputs.every(input => input);
      case 'OR':
        return normalizedInputs.some(input => input);
      case 'XOR':
        return normalizedInputs.filter(input => input).length === 1;
      default:
        return false;
    }
  }, [normalizedInputs, localGateType]);

  const handleInputCountChange = (newCount: number) => {
    const count = Math.max(2, Math.min(8, newCount));
    setLocalInputCount(count);
    onParameterChange('inputCount', count);
  };

  const handleGateTypeChange = (newType: string) => {
    setLocalGateType(newType as any);
    onParameterChange('gateType', newType);
  };

  const gateColors = {
    AND: 'orange',
    OR: 'yellow', 
    XOR: 'purple'
  };

  const color = gateColors[localGateType];

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 min-w-44 ${
      selected ? `border-${color}-500 shadow-xl` : `border-${color}-200`
    }`}>
      <div className={`px-3 py-2 bg-${color}-500 text-white rounded-t-lg flex items-center justify-between`}>
        <div className="flex items-center">
          <Square className="h-4 w-4 mr-2" />
          <span className="font-semibold">{localGateType}</span>
        </div>
        <Badge variant="secondary" className="bg-white bg-opacity-20 text-xs">
          Variable
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            {result ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <div className={`text-sm font-medium ${result ? 'text-green-600' : 'text-red-600'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Gate Type</Label>
            <select
              value={localGateType}
              onChange={(e) => handleGateTypeChange(e.target.value)}
              className="w-full h-8 text-sm border border-gray-300 rounded-md px-2"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
              <option value="XOR">XOR</option>
            </select>
          </div>

          <div>
            <Label className="text-xs">Input Count: {localInputCount}</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleInputCountChange(localInputCount - 1)}
                disabled={localInputCount <= 2}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium w-8 text-center">{localInputCount}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleInputCountChange(localInputCount + 1)}
                disabled={localInputCount >= 8}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Input Status */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-1">Input Status</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {normalizedInputs.map((input, index) => (
              <div key={index} className="flex justify-between">
                <span>#{index + 1}:</span>
                <span className={`font-medium ${input ? 'text-green-600' : 'text-red-600'}`}>
                  {input ? 'T' : 'F'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 border-t border-gray-100">
        <div className="space-y-1">
          <div className="text-xs text-gray-500 mb-1">Inputs ({localInputCount})</div>
          {normalizedInputs.slice(0, 4).map((_, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white mr-2" />
              <span className="text-xs">Input {index + 1}</span>
            </div>
          ))}
          {localInputCount > 4 && (
            <div className="text-xs text-gray-400">...and {localInputCount - 4} more</div>
          )}
          <div className="flex justify-end items-center pt-1 border-t">
            <span className="text-xs">Output</span>
            <div className={`w-3 h-3 rounded-full bg-${color}-600 border-2 border-white ml-2`} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all logic nodes
export const LogicNodes = {
  AND: ANDGateNode,
  OR: ORGateNode,
  NOT: NOTGateNode,
  XOR: XORGateNode,
  NAND: NANDGateNode,
  Variable: VariableGateNode
};

export default LogicNodes;