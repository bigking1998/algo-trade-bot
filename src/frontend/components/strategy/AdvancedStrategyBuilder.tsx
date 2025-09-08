import React, { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { 
  Settings, 
  Play, 
  Save, 
  Download, 
  Upload, 
  History, 
  Code,
  Layers,
  BookOpen,
  TestTube,
  Rocket,
  AlertTriangle
} from "lucide-react";
import VisualStrategyEditor from "./VisualStrategyEditor";
import StrategyTemplateLibrary from "./StrategyTemplateLibrary";
import StrategyBacktester from "./StrategyBacktester";
import { StrategyBuilderState, VisualStrategyDefinition } from "../../types/strategy";
import { useStrategyBuilder } from "../../hooks/useStrategyBuilder";

/**
 * Advanced Strategy Builder Component
 * 
 * A comprehensive interface for creating, editing, and managing trading strategies
 * with visual drag-and-drop editing, template library, backtesting, and code generation.
 */
const AdvancedStrategyBuilder: React.FC = () => {
  const {
    state,
    actions: {
      createNewStrategy,
      loadStrategy,
      saveStrategy,
      validateStrategy,
      previewStrategy,
      exportStrategy,
      importStrategy,
      undo,
      redo
    },
    isLoading,
    error
  } = useStrategyBuilder();

  const [activeTab, setActiveTab] = useState<'visual' | 'templates' | 'backtest' | 'code'>('visual');

  const handleSaveStrategy = useCallback(async () => {
    if (!state.currentStrategy) return;
    
    try {
      await saveStrategy(state.currentStrategy);
    } catch (error) {
      console.error('Failed to save strategy:', error);
    }
  }, [state.currentStrategy, saveStrategy]);

  const handleTemplateSelect = useCallback((template: VisualStrategyDefinition) => {
    loadStrategy(template);
    setActiveTab('visual');
  }, [loadStrategy]);

  const getValidationBadge = () => {
    if (!state.validation) return null;
    
    const errorCount = state.validation.errors.length;
    const warningCount = state.validation.warnings.length;
    
    if (errorCount > 0) {
      return <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {errorCount} Error{errorCount !== 1 ? 's' : ''}
      </Badge>;
    }
    
    if (warningCount > 0) {
      return <Badge variant="secondary" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {warningCount} Warning{warningCount !== 1 ? 's' : ''}
      </Badge>;
    }
    
    return <Badge variant="default" className="gap-1 bg-green-100 text-green-800 border-green-300">
      ✓ Valid
    </Badge>;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Advanced Strategy Builder
              </CardTitle>
              <CardDescription>
                {state.currentStrategy 
                  ? `Editing: ${state.currentStrategy.name}` 
                  : 'Create and manage sophisticated trading strategies with visual tools'}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {getValidationBadge()}
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={state.history.past.length === 0}
                >
                  ↶
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={state.history.future.length === 0}
                >
                  ↷
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="ghost"
                size="sm"
                onClick={previewStrategy}
                disabled={!state.currentStrategy || state.preview.isRunning}
                className="gap-1"
              >
                <Play className="h-4 w-4" />
                {state.preview.isRunning ? 'Running...' : 'Preview'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveStrategy}
                disabled={!state.currentStrategy || isLoading}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>

              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportStrategy}
                  disabled={!state.currentStrategy}
                  className="gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  id="import-strategy"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      importStrategy(file);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById('import-strategy')?.click()}
                  className="gap-1"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="h-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-auto grid-cols-4">
              <TabsTrigger value="visual" className="gap-2">
                <Layers className="h-4 w-4" />
                Visual Builder
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="backtest" className="gap-2">
                <TestTube className="h-4 w-4" />
                Backtest
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-2">
                <Code className="h-4 w-4" />
                Code
              </TabsTrigger>
            </TabsList>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={createNewStrategy}
                className="gap-1"
              >
                <Settings className="h-4 w-4" />
                New Strategy
              </Button>
              
              {state.currentStrategy && (
                <Button
                  variant="default"
                  size="sm"
                  disabled={!state.validation?.isValid}
                  className="gap-1"
                >
                  <Rocket className="h-4 w-4" />
                  Deploy
                </Button>
              )}
            </div>
          </div>

          {/* Visual Builder Tab */}
          <TabsContent value="visual" className="h-full space-y-0">
            <VisualStrategyEditor
              strategy={state.currentStrategy}
              nodes={state.nodes}
              connections={state.connections}
              selectedNodes={state.selectedNodes}
              validation={state.validation}
              preview={state.preview}
              onStrategyChange={loadStrategy}
              onValidationChange={validateStrategy}
            />
          </TabsContent>

          {/* Templates Library Tab */}
          <TabsContent value="templates" className="h-full space-y-0">
            <StrategyTemplateLibrary
              onTemplateSelect={handleTemplateSelect}
              currentStrategy={state.currentStrategy}
            />
          </TabsContent>

          {/* Backtest Tab */}
          <TabsContent value="backtest" className="h-full space-y-0">
            <StrategyBacktester
              strategy={state.currentStrategy}
              onBacktestComplete={(results) => {
                // Handle backtest results
                console.log('Backtest completed:', results);
              }}
            />
          </TabsContent>

          {/* Code Editor Tab */}
          <TabsContent value="code" className="h-full space-y-0">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Generated Strategy Code
                </CardTitle>
                <CardDescription>
                  View and customize the generated TypeScript strategy code
                </CardDescription>
              </CardHeader>
              <CardContent className="h-full">
                <div className="text-sm text-muted-foreground text-center py-8">
                  Code editor implementation coming soon...
                  <br />
                  This will show the generated TypeScript code for the current strategy.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Status Bar */}
      {(state.preview.isRunning || error) && (
        <Card>
          <CardContent className="py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {state.preview.isRunning && (
                  <>
                    <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-700">Running strategy preview...</span>
                  </>
                )}
                
                {error && (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-red-700">Error: {error}</span>
                  </>
                )}
              </div>
              
              {state.currentStrategy && (
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>Nodes: {state.nodes.length}</span>
                  <span>Connections: {state.connections.length}</span>
                  <span>Version: {state.currentStrategy.metadata.version}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdvancedStrategyBuilder;