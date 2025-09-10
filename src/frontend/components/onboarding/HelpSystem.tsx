/**
 * Help System - Part of FE-024 User Onboarding System
 * 
 * Comprehensive help system with:
 * - Interactive tutorials
 * - Contextual help
 * - Knowledge base
 * - Video guides
 * - Live chat support
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import {
  HelpCircle,
  Search,
  BookOpen,
  Video,
  MessageCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  Play,
  Clock,
  Star,
  Users,
  Lightbulb,
  Settings,
  BarChart3,
  TrendingUp,
  Shield,
  Bot,
  Zap,
  Target,
  Activity,
  Eye,
  Code,
  Layers,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
  readTime: number;
  popularity: number;
  tags: string[];
  updatedAt: Date;
}

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  views: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpfulCount: number;
}

// Sample help articles
const helpArticles: HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with AlgoTrader Pro',
    description: 'Complete guide to setting up your first trading strategy',
    category: 'Getting Started',
    content: `
# Getting Started with AlgoTrader Pro

Welcome to AlgoTrader Pro! This comprehensive guide will help you set up your first automated trading strategy.

## Prerequisites
- Basic understanding of trading concepts
- Initial trading capital (minimum $100 recommended for paper trading)
- Completed account verification

## Step 1: Account Setup
1. Complete the onboarding flow
2. Set up your trading preferences
3. Configure risk management settings

## Step 2: Create Your First Strategy
1. Navigate to the Strategy Builder
2. Choose from pre-built templates or create custom strategy
3. Configure parameters and risk settings
4. Enable paper trading for testing

## Step 3: Monitor and Optimize
- Use the dashboard to track performance
- Analyze results with built-in analytics
- Adjust parameters based on performance data

## Next Steps
Once comfortable with paper trading, you can:
- Switch to live trading with real funds
- Create more advanced strategies
- Explore social trading features
    `,
    readTime: 8,
    popularity: 95,
    tags: ['beginner', 'setup', 'strategy'],
    updatedAt: new Date('2024-09-01')
  },
  {
    id: 'strategy-builder',
    title: 'Visual Strategy Builder Guide',
    description: 'Learn to use the drag-and-drop strategy builder',
    category: 'Strategy Creation',
    content: `
# Visual Strategy Builder Guide

The Visual Strategy Builder allows you to create sophisticated trading strategies using a drag-and-drop interface.

## Key Components

### Indicator Nodes
- SMA, EMA, RSI, MACD, Bollinger Bands
- Drag from palette and connect to create calculations

### Condition Nodes
- Price comparisons, crossovers, threshold checks
- Combine multiple conditions with logic gates

### Signal Nodes
- Entry and exit signal generation
- Configure position sizing and timing

### Risk Management Nodes
- Stop-loss, take-profit controls
- Portfolio allocation rules

## Building Your First Strategy

1. **Start with Data Input**: Add price/volume input nodes
2. **Add Indicators**: Drag indicator nodes and configure parameters
3. **Create Conditions**: Use condition nodes to define entry/exit rules
4. **Generate Signals**: Connect conditions to signal nodes
5. **Add Risk Controls**: Include stop-loss and position sizing
6. **Validate**: Use built-in validation to check for errors

## Best Practices
- Start simple and add complexity gradually
- Test thoroughly with backtesting
- Always include risk management
- Document your strategy logic
    `,
    readTime: 12,
    popularity: 87,
    tags: ['strategy', 'builder', 'visual', 'intermediate'],
    updatedAt: new Date('2024-08-28')
  },
  {
    id: 'risk-management',
    title: 'Risk Management Best Practices',
    description: 'Essential risk management techniques for algorithmic trading',
    category: 'Risk Management',
    content: `
# Risk Management Best Practices

Effective risk management is crucial for long-term trading success.

## Position Sizing
- Never risk more than 1-2% of capital per trade
- Use the Kelly Criterion for optimal position sizing
- Adjust position size based on volatility

## Stop-Loss Guidelines
- Set stop-loss at logical technical levels
- Avoid setting stops too tight (< 1% for crypto)
- Consider using trailing stops for trend-following strategies

## Portfolio-Level Risk
- Diversify across different strategies
- Limit correlation between strategies
- Monitor total portfolio exposure

## Drawdown Management
- Set maximum acceptable drawdown (typically 10-20%)
- Implement cooling-off periods after significant losses
- Use position size scaling during drawdown periods

## Risk Metrics to Monitor
- Sharpe Ratio (risk-adjusted returns)
- Maximum Drawdown
- Win Rate and Profit Factor
- Value at Risk (VaR)
    `,
    readTime: 10,
    popularity: 92,
    tags: ['risk', 'management', 'advanced', 'portfolio'],
    updatedAt: new Date('2024-09-05')
  }
];

// Sample video tutorials
const videoTutorials: VideoTutorial[] = [
  {
    id: 'intro-video',
    title: 'AlgoTrader Pro Introduction',
    description: 'Overview of the platform and key features',
    thumbnail: '/api/placeholder/320/180',
    duration: 420, // 7 minutes
    difficulty: 'beginner',
    category: 'Getting Started',
    views: 15420
  },
  {
    id: 'first-strategy',
    title: 'Creating Your First Strategy',
    description: 'Step-by-step guide to building a simple EMA crossover strategy',
    thumbnail: '/api/placeholder/320/180',
    duration: 960, // 16 minutes
    difficulty: 'beginner',
    category: 'Strategy Creation',
    views: 12340
  },
  {
    id: 'backtesting',
    title: 'Backtesting and Optimization',
    description: 'Learn to test and optimize your trading strategies',
    thumbnail: '/api/placeholder/320/180',
    duration: 1200, // 20 minutes
    difficulty: 'intermediate',
    category: 'Analytics',
    views: 8750
  }
];

// Sample FAQs
const faqs: FAQ[] = [
  {
    id: 'faq-1',
    question: 'How much money do I need to start?',
    answer: 'You can start with paper trading (virtual money) immediately. For live trading, we recommend starting with at least $500-1000 to allow for proper position sizing and risk management.',
    category: 'Getting Started',
    helpfulCount: 234
  },
  {
    id: 'faq-2',
    question: 'Is my trading data secure?',
    answer: 'Yes, we use enterprise-grade encryption and security measures. Your API keys are encrypted and stored securely. We never have access to withdraw funds from your exchange accounts.',
    category: 'Security',
    helpfulCount: 189
  },
  {
    id: 'faq-3',
    question: 'Can I run multiple strategies simultaneously?',
    answer: 'Absolutely! You can run multiple strategies on different assets or timeframes. Our portfolio management system helps you monitor overall risk and performance across all strategies.',
    category: 'Strategy Management',
    helpfulCount: 156
  },
  {
    id: 'faq-4',
    question: 'What exchanges are supported?',
    answer: 'We currently support major exchanges including Binance, Coinbase Pro, Kraken, and dYdX. We\'re continuously adding support for more exchanges.',
    category: 'Exchanges',
    helpfulCount: 143
  }
];

export const HelpSystem: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  context?: string;
}> = ({ isOpen, onClose, initialQuery = '', context = '' }) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('articles');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [filteredArticles, setFilteredArticles] = useState(helpArticles);
  const [filteredVideos, setFilteredVideos] = useState(videoTutorials);
  const [filteredFAQs, setFilteredFAQs] = useState(faqs);

  // Search functionality
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    
    setFilteredArticles(
      helpArticles.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.description.toLowerCase().includes(query) ||
        article.tags.some(tag => tag.toLowerCase().includes(query))
      )
    );

    setFilteredVideos(
      videoTutorials.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.description.toLowerCase().includes(query)
      )
    );

    setFilteredFAQs(
      faqs.filter(faq =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
      )
    );
  }, [searchQuery]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getDifficultyBadgeColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HelpCircle className="h-6 w-6 text-blue-600" />
              <CardTitle>Help Center</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help articles, tutorials, or FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="articles" className="flex items-center">
                <BookOpen className="h-4 w-4 mr-1" />
                Articles
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex items-center">
                <Video className="h-4 w-4 mr-1" />
                Videos
              </TabsTrigger>
              <TabsTrigger value="faqs" className="flex items-center">
                <HelpCircle className="h-4 w-4 mr-1" />
                FAQs
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center">
                <MessageCircle className="h-4 w-4 mr-1" />
                Contact
              </TabsTrigger>
            </TabsList>

            {/* Articles Tab */}
            <TabsContent value="articles" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {filteredArticles.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                      <p className="text-muted-foreground">Try adjusting your search terms</p>
                    </div>
                  ) : (
                    filteredArticles.map((article) => (
                      <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold mb-1">{article.title}</h3>
                              <p className="text-muted-foreground text-sm mb-2">{article.description}</p>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {article.readTime} min read
                                </span>
                                <span className="flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  {article.popularity}% helpful
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {article.category}
                                </Badge>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {article.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Videos Tab */}
            <TabsContent value="videos" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVideos.length === 0 ? (
                    <div className="col-span-2 text-center py-8">
                      <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No videos found</h3>
                      <p className="text-muted-foreground">Try adjusting your search terms</p>
                    </div>
                  ) : (
                    filteredVideos.map((video) => (
                      <Card key={video.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-0">
                          <div className="relative">
                            <div className="aspect-video bg-gray-200 rounded-t-lg flex items-center justify-center">
                              <Play className="h-12 w-12 text-gray-600" />
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                              {formatDuration(video.duration)}
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-semibold mb-1">{video.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{video.description}</p>
                            <div className="flex items-center justify-between">
                              <Badge className={getDifficultyBadgeColor(video.difficulty)}>
                                {video.difficulty}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {video.views.toLocaleString()} views
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* FAQs Tab */}
            <TabsContent value="faqs" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-2">
                  {filteredFAQs.length === 0 ? (
                    <div className="text-center py-8">
                      <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No FAQs found</h3>
                      <p className="text-muted-foreground">Try adjusting your search terms</p>
                    </div>
                  ) : (
                    filteredFAQs.map((faq) => (
                      <Card key={faq.id} className="border">
                        <CardContent className="p-0">
                          <button
                            className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50"
                            onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                          >
                            <h3 className="font-semibold pr-4">{faq.question}</h3>
                            {expandedFAQ === faq.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          
                          {expandedFAQ === faq.id && (
                            <div className="px-4 pb-4">
                              <Separator className="mb-3" />
                              <p className="text-muted-foreground mb-3">{faq.answer}</p>
                              <div className="flex items-center justify-between text-sm">
                                <Badge variant="outline">{faq.category}</Badge>
                                <span className="text-muted-foreground">
                                  {faq.helpfulCount} people found this helpful
                                </span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="flex-1">
              <div className="space-y-6">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-semibold mb-2">Need more help?</h3>
                  <p className="text-muted-foreground">
                    Our support team is here to help you succeed with algorithmic trading.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <MessageCircle className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                      <h4 className="font-semibold mb-2">Live Chat</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Chat with our support team in real-time
                      </p>
                      <Button className="w-full">Start Chat</Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Average response time: 2 minutes
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6 text-center">
                      <FileText className="h-8 w-8 mx-auto mb-3 text-green-600" />
                      <h4 className="font-semibold mb-2">Submit Ticket</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Submit a detailed support request
                      </p>
                      <Button variant="outline" className="w-full">Create Ticket</Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Average response time: 4 hours
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">Quick Links</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Button variant="ghost" className="justify-start">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Documentation
                      </Button>
                      <Button variant="ghost" className="justify-start">
                        <Video className="h-4 w-4 mr-2" />
                        Video Tutorials
                      </Button>
                      <Button variant="ghost" className="justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        Community Forum
                      </Button>
                      <Button variant="ghost" className="justify-start">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        API Documentation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpSystem;