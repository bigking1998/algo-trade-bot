/**
 * ML Model Nodes - FE-009
 * 
 * Advanced node types for machine learning model integration within the visual strategy builder.
 * Supports pre-trained models, custom training, and real-time prediction.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Brain, 
  Upload, 
  Download, 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp,
  Target,
  Settings,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { NodeComponentProps } from './types';

interface MLModelConfig {
  modelType: 'linear_regression' | 'neural_network' | 'random_forest' | 'svm' | 'lstm' | 'custom';
  inputFeatures: string[];
  outputTargets: string[];
  hyperparameters: Record<string, any>;
  trainingConfig: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    validationSplit: number;
    earlyStopping: boolean;
  };
}

interface ModelPerformance {
  accuracy: number;
  loss: number;
  mse: number;
  mae: number;
  r2Score: number;
  trainingProgress: number;
  isTraining: boolean;
  lastUpdated: Date;
}

// Neural Network Model Node
export const NeuralNetworkNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [modelConfig, setModelConfig] = useState<MLModelConfig>({
    modelType: 'neural_network',
    inputFeatures: ['price', 'volume', 'rsi', 'macd'],
    outputTargets: ['price_prediction'],
    hyperparameters: {
      hiddenLayers: [64, 32, 16],
      activation: 'relu',
      dropout: 0.3,
      optimizer: 'adam'
    },
    trainingConfig: {
      epochs: 100,
      batchSize: 32,
      learningRate: 0.001,
      validationSplit: 0.2,
      earlyStopping: true
    },
    ...data
  });

  const [performance, setPerformance] = useState<ModelPerformance>({
    accuracy: 0.85,
    loss: 0.15,
    mse: 0.02,
    mae: 0.08,
    r2Score: 0.78,
    trainingProgress: 100,
    isTraining: false,
    lastUpdated: new Date()
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState('config');

  const handleTraining = useCallback(async (action: 'start' | 'stop' | 'reset') => {
    switch (action) {
      case 'start':
        setPerformance(prev => ({ ...prev, isTraining: true, trainingProgress: 0 }));
        // Simulate training progress
        const interval = setInterval(() => {
          setPerformance(prev => {
            const newProgress = Math.min(prev.trainingProgress + 5, 100);
            if (newProgress >= 100) {
              clearInterval(interval);
              return {
                ...prev,
                isTraining: false,
                trainingProgress: 100,
                accuracy: 0.85 + Math.random() * 0.1,
                loss: Math.random() * 0.2,
                lastUpdated: new Date()
              };
            }
            return { ...prev, trainingProgress: newProgress };
          });
        }, 200);
        break;
      case 'stop':
        setPerformance(prev => ({ ...prev, isTraining: false }));
        break;
      case 'reset':
        setPerformance(prev => ({ 
          ...prev, 
          trainingProgress: 0, 
          isTraining: false,
          accuracy: 0,
          loss: 0
        }));
        break;
    }
  }, []);

  const updateHyperparameter = (key: string, value: any) => {
    const newConfig = {
      ...modelConfig,
      hyperparameters: {
        ...modelConfig.hyperparameters,
        [key]: value
      }
    };
    setModelConfig(newConfig);
    onDataChange?.(newConfig);
  };

  const updateTrainingConfig = (key: string, value: any) => {
    const newConfig = {
      ...modelConfig,
      trainingConfig: {
        ...modelConfig.trainingConfig,
        [key]: value
      }
    };
    setModelConfig(newConfig);
    onDataChange?.(newConfig);
  };

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4" />
            Neural Network
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={performance.accuracy > 0.8 ? "success" : "secondary"}>
              {performance.isTraining ? (
                <><RotateCcw className="h-3 w-3 mr-1 animate-spin" /> Training</>
              ) : (
                <><CheckCircle className="h-3 w-3 mr-1" /> Acc: {(performance.accuracy * 100).toFixed(1)}%</>
              )}
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
        {/* Performance Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Accuracy</Label>
            <div className="font-mono text-lg font-bold">
              {(performance.accuracy * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <Label className="text-xs">Loss</Label>
            <div className="font-mono text-lg font-bold">
              {performance.loss.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Training Progress */}
        {performance.isTraining && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-xs">Training Progress</Label>
              <span className="text-xs">{performance.trainingProgress}%</span>
            </div>
            <Progress value={performance.trainingProgress} />
          </div>
        )}

        {/* Expanded Configuration */}
        {isExpanded && (
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hidden Layers</Label>
                  <Input
                    value={modelConfig.hyperparameters.hiddenLayers.join(',')}
                    onChange={(e) => {
                      const layers = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                      updateHyperparameter('hiddenLayers', layers);
                    }}
                    placeholder="64,32,16"
                  />
                </div>
                <div>
                  <Label>Activation</Label>
                  <Select
                    value={modelConfig.hyperparameters.activation}
                    onValueChange={(value) => updateHyperparameter('activation', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relu">ReLU</SelectItem>
                      <SelectItem value="tanh">Tanh</SelectItem>
                      <SelectItem value="sigmoid">Sigmoid</SelectItem>
                      <SelectItem value="leaky_relu">Leaky ReLU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dropout Rate</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={modelConfig.hyperparameters.dropout}
                    onChange={(e) => updateHyperparameter('dropout', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Optimizer</Label>
                  <Select
                    value={modelConfig.hyperparameters.optimizer}
                    onValueChange={(value) => updateHyperparameter('optimizer', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adam">Adam</SelectItem>
                      <SelectItem value="sgd">SGD</SelectItem>
                      <SelectItem value="rmsprop">RMSprop</SelectItem>
                      <SelectItem value="adagrad">Adagrad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="training" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Epochs</Label>
                  <Input
                    type="number"
                    value={modelConfig.trainingConfig.epochs}
                    onChange={(e) => updateTrainingConfig('epochs', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={modelConfig.trainingConfig.batchSize}
                    onChange={(e) => updateTrainingConfig('batchSize', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Learning Rate</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={modelConfig.trainingConfig.learningRate}
                    onChange={(e) => updateTrainingConfig('learningRate', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Validation Split</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={modelConfig.trainingConfig.validationSplit}
                    onChange={(e) => updateTrainingConfig('validationSplit', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => handleTraining('start')}
                  disabled={performance.isTraining}
                  variant="default"
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Training
                </Button>
                <Button 
                  onClick={() => handleTraining('stop')}
                  disabled={!performance.isTraining}
                  variant="outline"
                  size="sm"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                <Button 
                  onClick={() => handleTraining('reset')}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mean Squared Error</Label>
                  <div className="font-mono text-sm">{performance.mse.toFixed(6)}</div>
                </div>
                <div>
                  <Label>Mean Absolute Error</Label>
                  <div className="font-mono text-sm">{performance.mae.toFixed(6)}</div>
                </div>
                <div>
                  <Label>R² Score</Label>
                  <div className="font-mono text-sm">{performance.r2Score.toFixed(4)}</div>
                </div>
                <div>
                  <Label>Last Updated</Label>
                  <div className="text-xs text-muted-foreground">
                    {performance.lastUpdated.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <div>
                <Label>Input Features</Label>
                <div className="flex flex-wrap gap-2">
                  {modelConfig.inputFeatures.map((feature, index) => (
                    <Badge key={index} variant="outline">{feature}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Output Targets</Label>
                <div className="flex flex-wrap gap-2">
                  {modelConfig.outputTargets.map((target, index) => (
                    <Badge key={index} variant="default">{target}</Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Load Model
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Connection Points */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            {modelConfig.inputFeatures.map((_, index) => (
              <div key={index} className="w-3 h-3 bg-blue-500 rounded-full"></div>
            ))}
          </div>
          <div className="flex gap-1">
            {modelConfig.outputTargets.map((_, index) => (
              <div key={index} className="w-3 h-3 bg-green-500 rounded-full"></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// LSTM Model Node for Time Series
export const LSTMModelNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [lstmConfig, setLstmConfig] = useState({
    sequenceLength: 60,
    units: [128, 64, 32],
    dropoutRate: 0.2,
    recurrentDropout: 0.2,
    returnSequences: false,
    stateful: false,
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
            <TrendingUp className="h-4 w-4" />
            LSTM Time Series
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <BarChart3 className="h-3 w-3 mr-1" />
              Seq: {lstmConfig.sequenceLength}
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Sequence Length</Label>
            <Input
              type="number"
              value={lstmConfig.sequenceLength}
              onChange={(e) => {
                const newConfig = { ...lstmConfig, sequenceLength: parseInt(e.target.value) };
                setLstmConfig(newConfig);
                onDataChange?.(newConfig);
              }}
            />
          </div>
          <div>
            <Label>LSTM Units</Label>
            <Input
              value={lstmConfig.units.join(',')}
              onChange={(e) => {
                const units = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                const newConfig = { ...lstmConfig, units };
                setLstmConfig(newConfig);
                onDataChange?.(newConfig);
              }}
              placeholder="128,64,32"
            />
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dropout Rate</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={lstmConfig.dropoutRate}
                  onChange={(e) => {
                    const newConfig = { ...lstmConfig, dropoutRate: parseFloat(e.target.value) };
                    setLstmConfig(newConfig);
                    onDataChange?.(newConfig);
                  }}
                />
              </div>
              <div>
                <Label>Recurrent Dropout</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={lstmConfig.recurrentDropout}
                  onChange={(e) => {
                    const newConfig = { ...lstmConfig, recurrentDropout: parseFloat(e.target.value) };
                    setLstmConfig(newConfig);
                    onDataChange?.(newConfig);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Random Forest Model Node
export const RandomForestNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [forestConfig, setForestConfig] = useState({
    nEstimators: 100,
    maxDepth: null as number | null,
    minSamplesSplit: 2,
    minSamplesLeaf: 1,
    maxFeatures: 'sqrt' as 'sqrt' | 'log2' | number,
    bootstrap: true,
    ...data
  });

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4" />
          Random Forest
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Estimators</Label>
            <Input
              type="number"
              value={forestConfig.nEstimators}
              onChange={(e) => {
                const newConfig = { ...forestConfig, nEstimators: parseInt(e.target.value) };
                setForestConfig(newConfig);
                onDataChange?.(newConfig);
              }}
            />
          </div>
          <div>
            <Label>Max Depth</Label>
            <Input
              type="number"
              value={forestConfig.maxDepth || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                const newConfig = { ...forestConfig, maxDepth: value };
                setForestConfig(newConfig);
                onDataChange?.(newConfig);
              }}
              placeholder="Auto"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );
};

// Model Ensemble Node
export const ModelEnsembleNode: React.FC<NodeComponentProps> = ({
  id,
  data,
  onDataChange,
  isSelected,
  onSelect
}) => {
  const [ensembleConfig, setEnsembleConfig] = useState({
    models: ['neural_network', 'random_forest', 'lstm'],
    weights: [0.4, 0.3, 0.3],
    votingMethod: 'soft' as 'hard' | 'soft',
    stackingMeta: 'linear_regression',
    ...data
  });

  return (
    <Card 
      className={`w-96 ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings className="h-4 w-4" />
          Model Ensemble
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Models</Label>
          <div className="space-y-2">
            {ensembleConfig.models.map((model, index) => (
              <div key={index} className="flex items-center gap-2">
                <Badge variant="outline">{model}</Badge>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={ensembleConfig.weights[index]}
                  onChange={(e) => {
                    const newWeights = [...ensembleConfig.weights];
                    newWeights[index] = parseFloat(e.target.value);
                    const newConfig = { ...ensembleConfig, weights: newWeights };
                    setEnsembleConfig(newConfig);
                    onDataChange?.(newConfig);
                  }}
                  className="w-20"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-1">
            {ensembleConfig.models.map((_, index) => (
              <div key={index} className="w-3 h-3 bg-blue-500 rounded-full"></div>
            ))}
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );
};