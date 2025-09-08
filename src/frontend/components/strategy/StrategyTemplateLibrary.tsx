import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  BookOpen,
  TrendingUp,
  RotateCcw,
  Zap,
  Target,
  Star,
  Eye,
  Download,
  Clock,
  User,
  Search,
  Filter,
  BarChart3,
  Play,
  Award,
} from "lucide-react";

import { StrategyTemplate, VisualStrategyDefinition } from "../../types/strategy";

// Mock template data
const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'ema-crossover',
    name: 'EMA Crossover',
    description: 'Classic exponential moving average crossover strategy for trend following',
    category: 'trend',
    difficulty: 'beginner',
    tags: ['EMA', 'crossover', 'trend', 'beginner-friendly'],
    definition: {
      id: 'ema-crossover-def',
      name: 'EMA Crossover',
      description: 'Classic exponential moving average crossover strategy for trend following',
      nodes: [],
      connections: [],
      config: {
        name: 'EMA Crossover',
        description: 'Classic exponential moving average crossover strategy for trend following',
        version: '1.0.0',
        author: 'Strategy Library',
        timeframe: '1h',
        indicators: {},
        entryConditions: { long: [], short: [] },
        exitConditions: { long: [], short: [] },
        riskManagement: { stopLoss: 2, takeProfit: 4 },
      },
      metadata: {
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        version: '1.0.0',
        author: 'Strategy Library',
        tags: ['EMA', 'crossover', 'trend'],
      },
    },
    performance: {
      backtestResults: {
        id: 'bt-1',
        strategyId: 'ema-crossover',
        config: {
          strategyId: 'ema-crossover',
          symbol: 'BTC-USD',
          timeframe: '1h',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2024-01-01'),
          initialCapital: 10000,
          commission: 0.001,
          slippage: 0.001,
        },
        performance: {
          totalReturn: 2345.67,
          totalReturnPercent: 23.46,
          annualizedReturn: 23.46,
          sharpeRatio: 1.23,
          sortinoRatio: 1.45,
          maxDrawdown: -876.54,
          maxDrawdownPercent: -12.3,
          calmarRatio: 1.9,
          volatility: 18.5,
          skewness: 0.23,
          kurtosis: 2.1,
        },
        trades: {
          total: 142,
          winning: 89,
          losing: 53,
          winRate: 62.7,
          profitFactor: 1.85,
          avgWin: 45.2,
          avgLoss: -28.3,
          avgTradeDuration: 18.5,
          largestWin: 234.5,
          largestLoss: -123.4,
        },
        periods: {
          totalDays: 365,
          tradingDays: 260,
          bestMonth: 15.6,
          worstMonth: -8.9,
          winningMonths: 8,
          losingMonths: 4,
        },
        equity: [],
        trades_detail: [],
        runTime: 1234,
        completedAt: new Date('2024-01-02'),
      },
      rating: 4.2,
      downloads: 1234,
    },
    author: 'Strategy Library',
    createdAt: new Date('2024-01-01'),
    isPublic: true,
  },
  {
    id: 'rsi-mean-reversion',
    name: 'RSI Mean Reversion',
    description: 'Buy oversold and sell overbought based on RSI levels',
    category: 'mean_reversion',
    difficulty: 'beginner',
    tags: ['RSI', 'mean-reversion', 'overbought', 'oversold'],
    definition: {
      id: 'rsi-mean-reversion-def',
      name: 'RSI Mean Reversion',
      description: 'Buy oversold and sell overbought based on RSI levels',
      nodes: [],
      connections: [],
      config: {
        name: 'RSI Mean Reversion',
        description: 'Buy oversold and sell overbought based on RSI levels',
        version: '1.0.0',
        author: 'Strategy Library',
        timeframe: '15m',
        indicators: {},
        entryConditions: { long: [], short: [] },
        exitConditions: { long: [], short: [] },
        riskManagement: { stopLoss: 3, takeProfit: 2 },
      },
      metadata: {
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-05'),
        version: '1.0.0',
        author: 'Strategy Library',
        tags: ['RSI', 'mean-reversion'],
      },
    },
    performance: {
      rating: 3.8,
      downloads: 891,
    },
    author: 'Strategy Library',
    createdAt: new Date('2024-01-05'),
    isPublic: true,
  },
  {
    id: 'bollinger-breakout',
    name: 'Bollinger Band Breakout',
    description: 'Trade breakouts from Bollinger Band squeeze patterns',
    category: 'breakout',
    difficulty: 'intermediate',
    tags: ['Bollinger Bands', 'breakout', 'volatility', 'squeeze'],
    definition: {
      id: 'bollinger-breakout-def',
      name: 'Bollinger Band Breakout',
      description: 'Trade breakouts from Bollinger Band squeeze patterns',
      nodes: [],
      connections: [],
      config: {
        name: 'Bollinger Band Breakout',
        description: 'Trade breakouts from Bollinger Band squeeze patterns',
        version: '1.0.0',
        author: 'Strategy Library',
        timeframe: '30m',
        indicators: {},
        entryConditions: { long: [], short: [] },
        exitConditions: { long: [], short: [] },
        riskManagement: { stopLoss: 2.5, takeProfit: 5 },
      },
      metadata: {
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10'),
        version: '1.0.0',
        author: 'Strategy Library',
        tags: ['Bollinger Bands', 'breakout', 'volatility'],
      },
    },
    performance: {
      rating: 4.0,
      downloads: 567,
    },
    author: 'Strategy Library',
    createdAt: new Date('2024-01-10'),
    isPublic: true,
  },
  {
    id: 'macd-momentum',
    name: 'MACD Momentum',
    description: 'Follow momentum signals from MACD histogram and signal line',
    category: 'momentum',
    difficulty: 'intermediate',
    tags: ['MACD', 'momentum', 'histogram', 'signal'],
    definition: {
      id: 'macd-momentum-def',
      name: 'MACD Momentum',
      description: 'Follow momentum signals from MACD histogram and signal line',
      nodes: [],
      connections: [],
      config: {
        name: 'MACD Momentum',
        description: 'Follow momentum signals from MACD histogram and signal line',
        version: '1.0.0',
        author: 'Strategy Library',
        timeframe: '1h',
        indicators: {},
        entryConditions: { long: [], short: [] },
        exitConditions: { long: [], short: [] },
        riskManagement: { stopLoss: 3, takeProfit: 6 },
      },
      metadata: {
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        version: '1.0.0',
        author: 'Strategy Library',
        tags: ['MACD', 'momentum'],
      },
    },
    performance: {
      rating: 3.9,
      downloads: 723,
    },
    author: 'Strategy Library',
    createdAt: new Date('2024-01-15'),
    isPublic: true,
  },
  {
    id: 'scalping-ema',
    name: 'Scalping EMA',
    description: 'High-frequency scalping strategy using multiple EMA timeframes',
    category: 'scalping',
    difficulty: 'advanced',
    tags: ['scalping', 'EMA', 'multi-timeframe', 'high-frequency'],
    definition: {
      id: 'scalping-ema-def',
      name: 'Scalping EMA',
      description: 'High-frequency scalping strategy using multiple EMA timeframes',
      nodes: [],
      connections: [],
      config: {
        name: 'Scalping EMA',
        description: 'High-frequency scalping strategy using multiple EMA timeframes',
        version: '1.0.0',
        author: 'Strategy Library',
        timeframe: '1m',
        indicators: {},
        entryConditions: { long: [], short: [] },
        exitConditions: { long: [], short: [] },
        riskManagement: { stopLoss: 0.5, takeProfit: 1 },
      },
      metadata: {
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20'),
        version: '1.0.0',
        author: 'Strategy Library',
        tags: ['scalping', 'EMA', 'multi-timeframe'],
      },
    },
    performance: {
      rating: 4.5,
      downloads: 445,
    },
    author: 'Strategy Library',
    createdAt: new Date('2024-01-20'),
    isPublic: true,
  },
];

interface StrategyTemplateLibraryProps {
  onTemplateSelect: (template: VisualStrategyDefinition) => void;
  currentStrategy?: VisualStrategyDefinition;
}

const StrategyTemplateLibrary: React.FC<StrategyTemplateLibraryProps> = ({
  onTemplateSelect,
  currentStrategy,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('rating');
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);

  const filteredTemplates = useMemo(() => {
    let filtered = STRATEGY_TEMPLATES.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    });

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.performance?.rating || 0) - (a.performance?.rating || 0);
        case 'downloads':
          return (b.performance?.downloads || 0) - (a.performance?.downloads || 0);
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchTerm, selectedCategory, selectedDifficulty, sortBy]);

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'trend', label: 'Trend Following' },
    { value: 'mean_reversion', label: 'Mean Reversion' },
    { value: 'momentum', label: 'Momentum' },
    { value: 'breakout', label: 'Breakout' },
    { value: 'scalping', label: 'Scalping' },
  ];

  const difficultyOptions = [
    { value: 'all', label: 'All Levels' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  const sortOptions = [
    { value: 'rating', label: 'Highest Rated' },
    { value: 'downloads', label: 'Most Popular' },
    { value: 'newest', label: 'Newest First' },
    { value: 'name', label: 'Name A-Z' },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trend': return <TrendingUp className="h-4 w-4" />;
      case 'mean_reversion': return <RotateCcw className="h-4 w-4" />;
      case 'momentum': return <Zap className="h-4 w-4" />;
      case 'breakout': return <Target className="h-4 w-4" />;
      case 'scalping': return <Clock className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header with Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Strategy Template Library
              </CardTitle>
              <CardDescription>
                Choose from pre-built strategies or get inspired for your own
              </CardDescription>
            </div>
            
            <Badge variant="outline" className="gap-1">
              <Award className="h-3 w-3" />
              {filteredTemplates.length} strategies
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search strategies by name, description, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficultyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Templates Grid */}
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="h-fit hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(template.category)}
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      <CardDescription className="text-sm line-clamp-2">
                        {template.description}
                      </CardDescription>
                    </div>
                    
                    {template.performance && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">
                          {template.performance.rating?.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Tags and Difficulty */}
                  <div className="flex flex-wrap gap-1">
                    <Badge className={`text-xs ${getDifficultyColor(template.difficulty)}`}>
                      {template.difficulty}
                    </Badge>
                    {template.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Performance Metrics */}
                  {template.performance?.backtestResults && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <div className="font-medium text-green-600">
                          +{template.performance.backtestResults.performance.totalReturnPercent.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">Return</div>
                      </div>
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <div className="font-medium">
                          {template.performance.backtestResults.trades.winRate.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">Win Rate</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {formatNumber(template.performance?.downloads || 0)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {template.author}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-1"
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {getCategoryIcon(template.category)}
                            {template.name}
                          </DialogTitle>
                          <DialogDescription>
                            {template.description}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <Tabs defaultValue="overview">
                            <TabsList>
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="performance">Performance</TabsTrigger>
                              <TabsTrigger value="details">Details</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="overview" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium mb-2">Strategy Info</h4>
                                  <div className="space-y-1 text-sm">
                                    <div>Category: {template.category}</div>
                                    <div>Difficulty: {template.difficulty}</div>
                                    <div>Author: {template.author}</div>
                                    <div>Created: {template.createdAt.toLocaleDateString()}</div>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-medium mb-2">Tags</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {template.tags.map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="performance">
                              {template.performance?.backtestResults ? (
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="text-center p-3 border rounded">
                                    <div className="text-2xl font-bold text-green-600">
                                      +{template.performance.backtestResults.performance.totalReturnPercent.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-muted-foreground">Total Return</div>
                                  </div>
                                  <div className="text-center p-3 border rounded">
                                    <div className="text-2xl font-bold">
                                      {template.performance.backtestResults.trades.winRate.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-muted-foreground">Win Rate</div>
                                  </div>
                                  <div className="text-center p-3 border rounded">
                                    <div className="text-2xl font-bold">
                                      {template.performance.backtestResults.performance.sharpeRatio.toFixed(2)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-muted-foreground py-8">
                                  No performance data available
                                </div>
                              )}
                            </TabsContent>
                            
                            <TabsContent value="details">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2">Risk Management</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>Stop Loss: {template.definition.config.riskManagement.stopLoss}%</div>
                                    <div>Take Profit: {template.definition.config.riskManagement.takeProfit}%</div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-2">Configuration</h4>
                                  <div className="text-sm space-y-1">
                                    <div>Timeframe: {template.definition.config.timeframe}</div>
                                    <div>Version: {template.definition.config.version}</div>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                        
                        <div className="flex gap-2 justify-end">
                          <Button
                            onClick={() => onTemplateSelect(template.definition)}
                            className="gap-1"
                          >
                            <Play className="h-4 w-4" />
                            Use This Template
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => onTemplateSelect(template.definition)}
                    >
                      <Play className="h-4 w-4" />
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No strategies found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms or filters
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default StrategyTemplateLibrary;