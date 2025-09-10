/**
 * User Onboarding System - Task FE-024
 * 
 * Comprehensive onboarding flow for new users including:
 * - Guided onboarding flow
 * - Interactive tutorials
 * - Help system integration
 * - Getting started guides
 * - Progress tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  ChevronRight,
  ChevronLeft,
  Play,
  BookOpen,
  Target,
  Settings,
  TrendingUp,
  Shield,
  Users,
  User,
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  Star,
  Clock,
  BarChart3,
  DollarSign,
  Activity,
  Bot,
  Layers,
  Eye,
  Download,
  FileText,
  Video,
  ExternalLink,
  X
} from 'lucide-react';

// Onboarding step types
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  completed: boolean;
  optional: boolean;
  estimatedTime: number; // minutes
}

interface OnboardingStepProps {
  onNext: () => void;
  onPrev: () => void;
  onComplete: (data: any) => void;
  stepData: any;
  isFirst: boolean;
  isLast: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  tradingGoals: string[];
  riskTolerance: 'low' | 'medium' | 'high';
  initialCapital: number;
  preferredAssets: string[];
}

// Welcome Step Component
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  return (
    <div className="text-center space-y-6">
      <div className="mb-8">
        <Bot className="h-16 w-16 mx-auto mb-4 text-blue-600" />
        <h1 className="text-4xl font-bold mb-2">Welcome to AlgoTrader Pro</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Your journey to automated trading success starts here. We'll guide you through setting up 
          your first strategy and help you understand our powerful trading platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <Card>
          <CardContent className="p-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold mb-1">Automated Trading</h3>
            <p className="text-sm text-muted-foreground">
              Create and deploy sophisticated trading strategies
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Shield className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold mb-1">Risk Management</h3>
            <p className="text-sm text-muted-foreground">
              Advanced risk controls keep your capital safe
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <h3 className="font-semibold mb-1">Analytics & Insights</h3>
            <p className="text-sm text-muted-foreground">
              Real-time performance monitoring and analytics
            </p>
          </CardContent>
        </Card>
      </div>

      <Button onClick={onNext} size="lg" className="bg-blue-600 hover:bg-blue-700">
        Get Started <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

// Profile Setup Step
const ProfileStep: React.FC<OnboardingStepProps> = ({ onNext, onComplete, stepData }) => {
  const [profile, setProfile] = useState<UserProfile>({
    name: stepData?.name || '',
    email: stepData?.email || '',
    experience: stepData?.experience || 'beginner',
    tradingGoals: stepData?.tradingGoals || [],
    riskTolerance: stepData?.riskTolerance || 'medium',
    initialCapital: stepData?.initialCapital || 10000,
    preferredAssets: stepData?.preferredAssets || ['BTC-USD']
  });

  const tradingGoalOptions = [
    'Generate passive income',
    'Portfolio diversification', 
    'Learn algorithmic trading',
    'Professional trading career',
    'Hedge existing positions',
    'Capitalize on market volatility'
  ];

  const assetOptions = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD',
    'ADA-USD', 'DOT-USD', 'LINK-USD', 'UNI-USD', 'AAVE-USD'
  ];

  const handleGoalToggle = (goal: string) => {
    setProfile(prev => ({
      ...prev,
      tradingGoals: prev.tradingGoals.includes(goal)
        ? prev.tradingGoals.filter(g => g !== goal)
        : [...prev.tradingGoals, goal]
    }));
  };

  const handleAssetToggle = (asset: string) => {
    setProfile(prev => ({
      ...prev,
      preferredAssets: prev.preferredAssets.includes(asset)
        ? prev.preferredAssets.filter(a => a !== asset)
        : [...prev.preferredAssets, asset]
    }));
  };

  const handleNext = () => {
    onComplete(profile);
    onNext();
  };

  const isValid = profile.name && profile.email && profile.tradingGoals.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <User className="h-12 w-12 mx-auto mb-2 text-blue-600" />
        <h2 className="text-2xl font-bold">Tell us about yourself</h2>
        <p className="text-muted-foreground">
          We'll customize your experience based on your profile and goals
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={profile.name}
            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter your full name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
            placeholder="Enter your email"
          />
        </div>
      </div>

      <div>
        <Label>Trading Experience</Label>
        <Select value={profile.experience} onValueChange={(value: any) => setProfile(prev => ({ ...prev, experience: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner (New to trading)</SelectItem>
            <SelectItem value="intermediate">Intermediate (Some trading experience)</SelectItem>
            <SelectItem value="advanced">Advanced (Experienced trader)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Trading Goals (Select all that apply) *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {tradingGoalOptions.map((goal) => (
            <div key={goal} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={goal}
                checked={profile.tradingGoals.includes(goal)}
                onChange={() => handleGoalToggle(goal)}
                className="rounded"
              />
              <label htmlFor={goal} className="text-sm">{goal}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Risk Tolerance</Label>
          <Select value={profile.riskTolerance} onValueChange={(value: any) => setProfile(prev => ({ ...prev, riskTolerance: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Conservative (Low risk)</SelectItem>
              <SelectItem value="medium">Balanced (Medium risk)</SelectItem>
              <SelectItem value="high">Aggressive (High risk)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="capital">Initial Trading Capital ($)</Label>
          <Input
            id="capital"
            type="number"
            value={profile.initialCapital}
            onChange={(e) => setProfile(prev => ({ ...prev, initialCapital: Number(e.target.value) }))}
            min="100"
            step="100"
          />
        </div>
      </div>

      <div>
        <Label>Preferred Trading Assets</Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
          {assetOptions.map((asset) => (
            <Button
              key={asset}
              variant={profile.preferredAssets.includes(asset) ? "default" : "outline"}
              size="sm"
              onClick={() => handleAssetToggle(asset)}
              className="text-xs"
            >
              {asset.replace('-USD', '')}
            </Button>
          ))}
        </div>
      </div>

      <Button 
        onClick={handleNext} 
        disabled={!isValid}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        Continue <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

// Platform Overview Step
const PlatformTourStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  const [currentFeature, setCurrentFeature] = useState(0);

  const features = [
    {
      title: "Dashboard Overview",
      description: "Your command center for monitoring all trading activities, portfolio performance, and system health.",
      icon: <Activity className="h-8 w-8 text-blue-600" />,
      highlights: ["Real-time P&L tracking", "Active strategy monitoring", "System status indicators"]
    },
    {
      title: "Strategy Builder", 
      description: "Create sophisticated trading strategies using our visual drag-and-drop interface or code editor.",
      icon: <Layers className="h-8 w-8 text-green-600" />,
      highlights: ["Visual node-based editor", "Pre-built strategy templates", "Real-time validation"]
    },
    {
      title: "Risk Management",
      description: "Advanced risk controls and position sizing to protect your capital and optimize returns.",
      icon: <Shield className="h-8 w-8 text-red-600" />,
      highlights: ["Stop-loss automation", "Position sizing rules", "Drawdown protection"]
    },
    {
      title: "Analytics & Backtesting",
      description: "Comprehensive performance analytics and historical strategy testing capabilities.",
      icon: <BarChart3 className="h-8 w-8 text-purple-600" />,
      highlights: ["Historical backtesting", "Performance metrics", "Risk analysis"]
    }
  ];

  const currentFeatureData = features[currentFeature];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <Eye className="h-12 w-12 mx-auto mb-2 text-blue-600" />
        <h2 className="text-2xl font-bold">Platform Overview</h2>
        <p className="text-muted-foreground">
          Let's explore the key features that make AlgoTrader Pro powerful
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="flex items-center mb-6">
            {currentFeatureData.icon}
            <div className="ml-4">
              <h3 className="text-xl font-semibold">{currentFeatureData.title}</h3>
              <p className="text-muted-foreground">{currentFeatureData.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {currentFeatureData.highlights.map((highlight, index) => (
              <div key={index} className="flex items-center p-3 bg-muted rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm">{highlight}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setCurrentFeature(Math.max(0, currentFeature - 1))}
              disabled={currentFeature === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex space-x-2">
              {features.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full ${index === currentFeature ? 'bg-blue-600' : 'bg-gray-300'}`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentFeature(Math.min(features.length - 1, currentFeature + 1))}
              disabled={currentFeature === features.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-700">
          Continue to Strategy Setup <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// First Strategy Setup Step
const FirstStrategyStep: React.FC<OnboardingStepProps> = ({ onNext, onComplete }) => {
  const [strategyConfig, setStrategyConfig] = useState({
    name: 'My First Strategy',
    type: 'EMAcrossover',
    symbol: 'BTC-USD',
    timeframe: '1h',
    fastPeriod: 10,
    slowPeriod: 20,
    stopLoss: 2.5,
    takeProfit: 5.0,
    positionSize: 10,
    enabled: false
  });

  const [currentStep, setCurrentStep] = useState(0);

  const setupSteps = [
    {
      title: "Choose Strategy Type",
      description: "Select a pre-built strategy template to get started quickly",
      component: "strategy-type"
    },
    {
      title: "Configure Parameters", 
      description: "Customize the strategy parameters for your trading style",
      component: "parameters"
    },
    {
      title: "Set Risk Management",
      description: "Define stop-loss, take-profit, and position sizing rules",
      component: "risk-management"
    },
    {
      title: "Review & Deploy",
      description: "Review your strategy configuration and deploy for paper trading",
      component: "review"
    }
  ];

  const handleNext = () => {
    if (currentStep < setupSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(strategyConfig);
      onNext();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (setupSteps[currentStep].component) {
      case 'strategy-type':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`cursor-pointer transition-colors ${strategyConfig.type === 'EMAcrossover' ? 'ring-2 ring-blue-600' : ''}`}
                onClick={() => setStrategyConfig(prev => ({ ...prev, type: 'EMAcrossover' }))}>
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
                    <h4 className="font-semibold">EMA Crossover</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trend-following strategy using exponential moving averages
                  </p>
                  <Badge variant="secondary" className="mt-2">Beginner Friendly</Badge>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer transition-colors ${strategyConfig.type === 'RSIMeanReversion' ? 'ring-2 ring-blue-600' : ''}`}
                onClick={() => setStrategyConfig(prev => ({ ...prev, type: 'RSIMeanReversion' }))}>
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <Target className="h-6 w-6 text-blue-600 mr-2" />
                    <h4 className="font-semibold">RSI Mean Reversion</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Counter-trend strategy using RSI oscillator signals
                  </p>
                  <Badge variant="secondary" className="mt-2">Intermediate</Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'parameters':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="symbol">Trading Symbol</Label>
                <Select value={strategyConfig.symbol} onValueChange={(value) => setStrategyConfig(prev => ({ ...prev, symbol: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                    <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                    <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="timeframe">Timeframe</Label>
                <Select value={strategyConfig.timeframe} onValueChange={(value) => setStrategyConfig(prev => ({ ...prev, timeframe: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15m">15 minutes</SelectItem>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="4h">4 hours</SelectItem>
                    <SelectItem value="1d">1 day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {strategyConfig.type === 'EMAcrossover' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fast-period">Fast EMA Period</Label>
                  <Input
                    id="fast-period"
                    type="number"
                    value={strategyConfig.fastPeriod}
                    onChange={(e) => setStrategyConfig(prev => ({ ...prev, fastPeriod: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="slow-period">Slow EMA Period</Label>
                  <Input
                    id="slow-period"
                    type="number"
                    value={strategyConfig.slowPeriod}
                    onChange={(e) => setStrategyConfig(prev => ({ ...prev, slowPeriod: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'risk-management':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                <Input
                  id="stop-loss"
                  type="number"
                  value={strategyConfig.stopLoss}
                  onChange={(e) => setStrategyConfig(prev => ({ ...prev, stopLoss: Number(e.target.value) }))}
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="take-profit">Take Profit (%)</Label>
                <Input
                  id="take-profit"
                  type="number"
                  value={strategyConfig.takeProfit}
                  onChange={(e) => setStrategyConfig(prev => ({ ...prev, takeProfit: Number(e.target.value) }))}
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="position-size">Position Size (%)</Label>
                <Input
                  id="position-size"
                  type="number"
                  value={strategyConfig.positionSize}
                  onChange={(e) => setStrategyConfig(prev => ({ ...prev, positionSize: Number(e.target.value) }))}
                  step="0.1"
                />
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <h5 className="font-medium text-yellow-800">Risk Management Tips</h5>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Keep position sizes small (2-5% per trade) when starting</li>
                <li>• Set stop-loss to limit downside risk</li>
                <li>• Use take-profit to lock in gains</li>
                <li>• Start with paper trading to test your strategy</li>
              </ul>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="p-6 bg-muted rounded-lg">
              <h4 className="font-semibold mb-4">Strategy Configuration</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Name: {strategyConfig.name}</div>
                <div>Type: {strategyConfig.type}</div>
                <div>Symbol: {strategyConfig.symbol}</div>
                <div>Timeframe: {strategyConfig.timeframe}</div>
                <div>Stop Loss: {strategyConfig.stopLoss}%</div>
                <div>Take Profit: {strategyConfig.takeProfit}%</div>
                <div>Position Size: {strategyConfig.positionSize}%</div>
                <div>Status: Paper Trading</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center">
                <Switch
                  checked={strategyConfig.enabled}
                  onCheckedChange={(checked) => setStrategyConfig(prev => ({ ...prev, enabled: checked }))}
                />
                <div className="ml-3">
                  <Label>Enable Paper Trading</Label>
                  <p className="text-xs text-muted-foreground">
                    Start with simulated trading to test your strategy
                  </p>
                </div>
              </div>
              <Badge variant={strategyConfig.enabled ? "default" : "secondary"}>
                {strategyConfig.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <Settings className="h-12 w-12 mx-auto mb-2 text-blue-600" />
        <h2 className="text-2xl font-bold">Create Your First Strategy</h2>
        <p className="text-muted-foreground">
          Let's set up a simple trading strategy to get you started
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-between mb-4">
          {setupSteps.map((step, index) => (
            <div
              key={index}
              className={`flex-1 text-center ${index === currentStep ? 'text-blue-600' : 'text-muted-foreground'}`}
            >
              <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-medium
                ${index === currentStep ? 'bg-blue-600 text-white' : 
                  index < currentStep ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
              >
                {index < currentStep ? <CheckCircle className="h-4 w-4" /> : index + 1}
              </div>
              <div className="text-xs font-medium">{step.title}</div>
            </div>
          ))}
        </div>
        <Progress value={(currentStep + 1) / setupSteps.length * 100} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{setupSteps[currentStep].title}</CardTitle>
          <CardDescription>{setupSteps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <Button
          onClick={handleNext}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {currentStep === setupSteps.length - 1 ? 'Create Strategy' : 'Next Step'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// Completion Step
const CompletionStep: React.FC<OnboardingStepProps> = ({ stepData }) => {
  const [showNextSteps, setShowNextSteps] = useState(false);

  return (
    <div className="text-center max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
        <h1 className="text-4xl font-bold mb-2">Welcome Aboard!</h1>
        <p className="text-lg text-muted-foreground">
          Your AlgoTrader Pro account is now set up and ready for action.
        </p>
      </div>

      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">Onboarding Complete</h3>
        <div className="text-sm text-green-700 space-y-1">
          <p>✓ Profile created and configured</p>
          <p>✓ Platform overview completed</p>
          <p>✓ First strategy "{stepData?.strategy?.name || 'My First Strategy'}" created</p>
          <p>✓ Paper trading enabled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Play className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <h4 className="font-semibold mb-1">Start Paper Trading</h4>
            <p className="text-sm text-muted-foreground">
              Test your strategy with simulated funds
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <h4 className="font-semibold mb-1">Explore Tutorials</h4>
            <p className="text-sm text-muted-foreground">
              Learn advanced features and techniques
            </p>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => setShowNextSteps(!showNextSteps)}
        variant="outline"
        className="mb-4"
      >
        {showNextSteps ? 'Hide' : 'Show'} Next Steps
        <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showNextSteps ? 'rotate-90' : ''}`} />
      </Button>

      {showNextSteps && (
        <Card>
          <CardContent className="p-6 text-left">
            <h4 className="font-semibold mb-4">Recommended Next Steps:</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center mt-0.5">1</div>
                <div>
                  <h5 className="font-medium">Monitor Your Strategy</h5>
                  <p className="text-sm text-muted-foreground">Check the dashboard regularly to see how your strategy performs</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center mt-0.5">2</div>
                <div>
                  <h5 className="font-medium">Learn from Analytics</h5>
                  <p className="text-sm text-muted-foreground">Use the analytics dashboard to understand your strategy's strengths and weaknesses</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center mt-0.5">3</div>
                <div>
                  <h5 className="font-medium">Optimize Parameters</h5>
                  <p className="text-sm text-muted-foreground">Use backtesting to fine-tune your strategy parameters</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center mt-0.5">4</div>
                <div>
                  <h5 className="font-medium">Go Live</h5>
                  <p className="text-sm text-muted-foreground">When confident, switch from paper trading to live trading</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
        Enter Dashboard
      </Button>
    </div>
  );
};

// Main Onboarding Flow Component
export const OnboardingFlow: React.FC<{
  onComplete: (userData: any) => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [stepData, setStepData] = useState<any>({});

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Welcome to AlgoTrader Pro',
      component: WelcomeStep,
      completed: false,
      optional: false,
      estimatedTime: 2
    },
    {
      id: 'profile',
      title: 'Profile Setup',
      description: 'Tell us about yourself',
      component: ProfileStep,
      completed: false,
      optional: false,
      estimatedTime: 5
    },
    {
      id: 'platform-tour',
      title: 'Platform Tour',
      description: 'Explore key features',
      component: PlatformTourStep,
      completed: false,
      optional: false,
      estimatedTime: 8
    },
    {
      id: 'first-strategy',
      title: 'First Strategy',
      description: 'Create your first strategy',
      component: FirstStrategyStep,
      completed: false,
      optional: false,
      estimatedTime: 10
    },
    {
      id: 'completion',
      title: 'Complete',
      description: 'You\'re all set!',
      component: CompletionStep,
      completed: false,
      optional: false,
      estimatedTime: 3
    }
  ];

  const currentStep = steps[currentStepIndex];
  const totalTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
  const completedTime = steps.slice(0, currentStepIndex).reduce((sum, step) => sum + step.estimatedTime, 0);
  const progress = (completedTime / totalTime) * 100;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCompletedSteps(prev => new Set([...prev, currentStep.id]));
    } else {
      onComplete(stepData);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleStepComplete = (data: any) => {
    setStepData(prev => ({ ...prev, [currentStep.id]: data }));
  };

  const CurrentStepComponent = currentStep.component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Bot className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold">AlgoTrader Pro Setup</h1>
              <p className="text-sm text-muted-foreground">Step {currentStepIndex + 1} of {steps.length}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium">{Math.round(progress)}% Complete</div>
              <div className="text-xs text-muted-foreground">~{Math.max(0, totalTime - completedTime)} min remaining</div>
            </div>
            <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
              Skip Setup
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <CurrentStepComponent
            onNext={handleNext}
            onPrev={handlePrev}
            onComplete={handleStepComplete}
            stepData={stepData[currentStep.id]}
            isFirst={currentStepIndex === 0}
            isLast={currentStepIndex === steps.length - 1}
          />
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;