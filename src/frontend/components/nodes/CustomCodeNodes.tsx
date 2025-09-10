/**
 * Custom Code Nodes - FE-009
 * 
 * Advanced node types that allow custom code execution within the visual strategy builder.
 * Supports JavaScript/TypeScript code editing, validation, and execution.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Code, 
  Play, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';
import { NodeComponentProps } from './types';

interface CodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface CustomCodeNodeData {
  code: string;
  language: 'javascript' | 'typescript';
  inputVariables: { name: string; type: string; description: string }[];
  outputVariables: { name: string; type: string; description: string }[];
  dependencies: string[];
  isAsync: boolean;
  timeout: number;
}

// JavaScript Code Node
export const JavaScriptCodeNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [codeData, setCodeData] = useState<CustomCodeNodeData>({
    code: '// Custom JavaScript Code\nfunction processData(input) {\n  // Your logic here\n  return input;\n}',
    language: 'javascript',
    inputVariables: [{ name: 'input', type: 'number', description: 'Input value' }],
    outputVariables: [{ name: 'output', type: 'number', description: 'Processed value' }],
    dependencies: [],
    isAsync: false,
    timeout: 5000,
    ...data
  });

  const [validation, setValidation] = useState<CodeValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const validateCode = useCallback((code: string) => {
    try {
      // Basic syntax validation
      new Function(code);
      setValidation({
        isValid: true,
        errors: [],
        warnings: []
      });
    } catch (error) {
      setValidation({
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Syntax error'],
        warnings: []
      });
    }
  }, []);

  useEffect(() => {
    validateCode(codeData.code);
  }, [codeData.code, validateCode]);

  const handleCodeChange = (code: string) => {
    const newData = { ...codeData, code };
    setCodeData(newData);
    onDataChange?.(newData);
  };

  const executeCode = async () => {
    if (!validation.isValid) return;
    
    setIsExecuting(true);
    try {
      // Simulate code execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Code executed successfully');
    } catch (error) {
      console.error('Code execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const addInputVariable = () => {
    const newVars = [...codeData.inputVariables, { name: '', type: 'number', description: '' }];
    const newData = { ...codeData, inputVariables: newVars };
    setCodeData(newData);
    onDataChange?.(newData);
  };

  const addOutputVariable = () => {
    const newVars = [...codeData.outputVariables, { name: '', type: 'number', description: '' }];
    const newData = { ...codeData, outputVariables: newVars };
    setCodeData(newData);
    onDataChange?.(newData);
  };

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Code className="h-4 w-4" />
            JavaScript Node
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={validation.isValid ? "success" : "destructive"}>
              {validation.isValid ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
              {validation.isValid ? 'Valid' : 'Error'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Code Editor */}
        <div>
          <Label>JavaScript Code</Label>
          <Textarea
            value={codeData.code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="font-mono text-sm min-h-32"
            placeholder="Enter your JavaScript code here..."
          />
        </div>

        {/* Validation Results */}
        {!validation.isValid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {validation.errors.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Expanded Configuration */}
        {isExpanded && (
          <Tabs defaultValue="variables">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="variables">Variables</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="execution">Execution</TabsTrigger>
            </TabsList>

            <TabsContent value="variables" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Input Variables</Label>
                  <Button size="sm" onClick={addInputVariable}>Add Input</Button>
                </div>
                {codeData.inputVariables.map((variable, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Name"
                      value={variable.name}
                      onChange={(e) => {
                        const newVars = [...codeData.inputVariables];
                        newVars[index].name = e.target.value;
                        const newData = { ...codeData, inputVariables: newVars };
                        setCodeData(newData);
                        onDataChange?.(newData);
                      }}
                    />
                    <Select
                      value={variable.type}
                      onValueChange={(value) => {
                        const newVars = [...codeData.inputVariables];
                        newVars[index].type = value;
                        const newData = { ...codeData, inputVariables: newVars };
                        setCodeData(newData);
                        onDataChange?.(newData);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="array">Array</SelectItem>
                        <SelectItem value="object">Object</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description"
                      value={variable.description}
                      onChange={(e) => {
                        const newVars = [...codeData.inputVariables];
                        newVars[index].description = e.target.value;
                        const newData = { ...codeData, inputVariables: newVars };
                        setCodeData(newData);
                        onDataChange?.(newData);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Output Variables</Label>
                  <Button size="sm" onClick={addOutputVariable}>Add Output</Button>
                </div>
                {codeData.outputVariables.map((variable, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Name"
                      value={variable.name}
                      onChange={(e) => {
                        const newVars = [...codeData.outputVariables];
                        newVars[index].name = e.target.value;
                        const newData = { ...codeData, outputVariables: newVars };
                        setCodeData(newData);
                        onDataChange?.(newData);
                      }}
                    />
                    <Select
                      value={variable.type}
                      onValueChange={(value) => {
                        const newVars = [...codeData.outputVariables];
                        newVars[index].type = value;
                        const newData = { ...codeData, outputVariables: newVars };
                        setCodeData(newData);
                        onDataChange?.(newData);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="array">Array</SelectItem>
                        <SelectItem value="object">Object</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description"
                      value={variable.description}
                      onChange={(e) => {
                        const newVars = [...codeData.outputVariables];
                        newVars[index].description = e.target.value;
                        const newData = { ...codeData, outputVariables: newVars };
                        setCodeData(newData);
                        onDataChange?.(newData);
                      }}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Language</Label>
                  <Select
                    value={codeData.language}
                    onValueChange={(value: 'javascript' | 'typescript') => {
                      const newData = { ...codeData, language: value };
                      setCodeData(newData);
                      onDataChange?.(newData);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={codeData.timeout}
                    onChange={(e) => {
                      const newData = { ...codeData, timeout: parseInt(e.target.value) };
                      setCodeData(newData);
                      onDataChange?.(newData);
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="execution" className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={executeCode} 
                  disabled={!validation.isValid || isExecuting}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isExecuting ? 'Executing...' : 'Test Execute'}
                </Button>
                <Button variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Connection Points */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            {codeData.inputVariables.map((_, index) => (
              <div key={index} className="w-3 h-3 bg-blue-500 rounded-full"></div>
            ))}
          </div>
          <div className="flex gap-1">
            {codeData.outputVariables.map((_, index) => (
              <div key={index} className="w-3 h-3 bg-green-500 rounded-full"></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// TypeScript Code Node
export const TypeScriptCodeNode: React.FC<NodeComponentProps> = (props) => {
  // Similar implementation to JavaScript node but with TypeScript-specific features
  return <JavaScriptCodeNode {...props} />;
};

// SQL Query Node
export const SQLQueryNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [queryData, setQueryData] = useState({
    query: 'SELECT * FROM market_data WHERE symbol = ? AND timestamp > ?',
    parameters: [{ name: 'symbol', type: 'string' }, { name: 'timestamp', type: 'datetime' }],
    outputSchema: [{ name: 'price', type: 'number' }, { name: 'volume', type: 'number' }],
    ...data
  });

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            SQL Query Node
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>SQL Query</Label>
          <Textarea
            value={queryData.query}
            onChange={(e) => {
              const newData = { ...queryData, query: e.target.value };
              setQueryData(newData);
              onDataChange?.(newData);
            }}
            className="font-mono text-sm"
            placeholder="SELECT * FROM table WHERE condition"
          />
        </div>

        {isExpanded && (
          <Tabs defaultValue="parameters">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
              <TabsTrigger value="schema">Output Schema</TabsTrigger>
            </TabsList>

            <TabsContent value="parameters">
              <div className="space-y-2">
                <Label>Query Parameters</Label>
                {queryData.parameters.map((param, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2">
                    <Input placeholder="Parameter name" value={param.name} />
                    <Select value={param.type}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="datetime">DateTime</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="schema">
              <div className="space-y-2">
                <Label>Output Schema</Label>
                {queryData.outputSchema.map((field, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2">
                    <Input placeholder="Field name" value={field.name} />
                    <Select value={field.type}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="datetime">DateTime</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            {queryData.parameters.map((_, index) => (
              <div key={index} className="w-3 h-3 bg-blue-500 rounded-full"></div>
            ))}
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );
};