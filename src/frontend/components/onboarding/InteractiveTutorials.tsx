/**
 * Interactive Tutorials - Part of FE-024 User Onboarding System
 * 
 * Interactive guided tutorials that overlay the actual application
 * interface to teach users how to use specific features.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle,
  Circle,
  Lightbulb,
  Target,
  MousePointer,
  Eye,
  Zap,
  Clock,
  Star
} from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetElement?: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'input' | 'wait';
  actionText?: string;
  highlight?: boolean;
  screenshot?: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  prerequisites?: string[];
  steps: TutorialStep[];
  completionReward?: {
    type: 'badge' | 'points' | 'feature';
    value: string;
  };
}

// Sample tutorials
const tutorials: Tutorial[] = [
  {
    id: 'dashboard-tour',
    title: 'Dashboard Overview',
    description: 'Learn to navigate the main dashboard and understand key metrics',
    category: 'Getting Started',
    difficulty: 'beginner',
    estimatedTime: 5,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Your Dashboard',
        content: 'This is your trading command center. Here you can monitor all your strategies, track performance, and manage your portfolio.',
        position: 'center'
      },
      {
        id: 'kpi-cards',
        title: 'Key Performance Indicators',
        content: 'These cards show real-time market data and your portfolio status. They update automatically to give you instant insights.',
        targetElement: '[data-testid="kpi-cards"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'navigation',
        title: 'Main Navigation',
        content: 'Use these tabs to navigate between different sections of the platform. Each tab contains specialized tools for different aspects of trading.',
        targetElement: '[role="tablist"]',
        position: 'bottom',
        highlight: true
      },
      {
        id: 'strategy-status',
        title: 'Strategy Status Monitor',
        content: 'This section shows the status of your active trading strategies. Green indicates running strategies, while red shows stopped ones.',
        targetElement: '[data-testid="strategy-status"]',
        position: 'left',
        highlight: true
      }
    ],
    completionReward: {
      type: 'badge',
      value: 'Dashboard Explorer'
    }
  },
  {
    id: 'first-strategy',
    title: 'Create Your First Strategy',
    description: 'Step-by-step guide to building and deploying your first trading strategy',
    category: 'Strategy Creation',
    difficulty: 'beginner',
    estimatedTime: 12,
    steps: [
      {
        id: 'navigate-strategies',
        title: 'Navigate to Strategies',
        content: 'Let\'s start by going to the Strategies tab where you can create and manage your trading strategies.',
        targetElement: '[data-value="strategies"]',
        position: 'bottom',
        action: 'click',
        actionText: 'Click the Strategies tab',
        highlight: true
      },
      {
        id: 'strategy-builder',
        title: 'Open Strategy Builder',
        content: 'The Strategy Builder tab allows you to create new strategies using our visual interface or templates.',
        targetElement: '[data-value="builder"]',
        position: 'bottom',
        action: 'click',
        actionText: 'Click the Strategy Builder tab',
        highlight: true
      },
      {
        id: 'choose-template',
        title: 'Choose a Template',
        content: 'Templates provide pre-configured strategies that you can customize. Let\'s start with the EMA Crossover template - it\'s perfect for beginners.',
        targetElement: '[data-testid="ema-template"]',
        position: 'right',
        action: 'click',
        actionText: 'Click on EMA Crossover template',
        highlight: true
      },
      {
        id: 'configure-parameters',
        title: 'Configure Parameters',
        content: 'Now you can adjust the strategy parameters. The Fast Period (10) and Slow Period (20) are good defaults for beginners.',
        targetElement: '[data-testid="parameters-section"]',
        position: 'left',
        highlight: true
      },
      {
        id: 'set-risk-management',
        title: 'Set Risk Management',
        content: 'Always configure risk management! Set a stop-loss to limit losses and take-profit to secure gains.',
        targetElement: '[data-testid="risk-section"]',
        position: 'top',
        highlight: true
      },
      {
        id: 'enable-paper-trading',
        title: 'Enable Paper Trading',
        content: 'Start with paper trading to test your strategy without risking real money. You can switch to live trading later.',
        targetElement: '[data-testid="paper-trading-toggle"]',
        position: 'top',
        action: 'click',
        actionText: 'Enable paper trading',
        highlight: true
      },
      {
        id: 'deploy-strategy',
        title: 'Deploy Your Strategy',
        content: 'Great! Now click the Deploy button to activate your strategy. It will start analyzing the market and generating signals.',
        targetElement: '[data-testid="deploy-button"]',
        position: 'top',
        action: 'click',
        actionText: 'Click Deploy Strategy',
        highlight: true
      }
    ],
    completionReward: {
      type: 'badge',
      value: 'Strategy Creator'
    }
  },
  {
    id: 'visual-builder',
    title: 'Visual Strategy Builder Mastery',
    description: 'Learn to use the advanced drag-and-drop visual strategy builder',
    category: 'Advanced Features',
    difficulty: 'intermediate',
    estimatedTime: 20,
    prerequisites: ['first-strategy'],
    steps: [
      {
        id: 'open-visual-builder',
        title: 'Open Visual Builder',
        content: 'The visual builder allows you to create complex strategies by connecting nodes. It\'s like programming, but visual!',
        targetElement: '[data-testid="visual-builder-button"]',
        position: 'bottom',
        action: 'click',
        actionText: 'Click Visual Builder',
        highlight: true
      },
      {
        id: 'node-palette',
        title: 'Node Palette',
        content: 'The palette contains all available nodes: indicators, conditions, logic gates, and output nodes. Drag them to the canvas to use.',
        targetElement: '[data-testid="node-palette"]',
        position: 'right',
        highlight: true
      },
      {
        id: 'add-data-input',
        title: 'Add Data Input',
        content: 'Every strategy needs data. Drag the Price Data node to the canvas - this provides the price information for calculations.',
        targetElement: '[data-testid="price-data-node"]',
        position: 'right',
        action: 'click',
        actionText: 'Drag Price Data to canvas',
        highlight: true
      },
      {
        id: 'add-indicators',
        title: 'Add Technical Indicators',
        content: 'Now add some indicators. Drag an EMA node to calculate moving averages. You can add multiple EMAs with different periods.',
        targetElement: '[data-testid="ema-node"]',
        position: 'right',
        action: 'click',
        actionText: 'Drag EMA node to canvas',
        highlight: true
      },
      {
        id: 'connect-nodes',
        title: 'Connect Nodes',
        content: 'Connect the Price Data output to the EMA input by clicking and dragging between the connection points.',
        position: 'center',
        action: 'click',
        actionText: 'Connect the nodes',
        highlight: true
      },
      {
        id: 'add-condition',
        title: 'Add Trading Condition',
        content: 'Add a Crossover condition node to detect when the fast EMA crosses above the slow EMA - this creates our entry signal.',
        targetElement: '[data-testid="crossover-node"]',
        position: 'right',
        action: 'click',
        actionText: 'Add Crossover condition',
        highlight: true
      },
      {
        id: 'validate-strategy',
        title: 'Validate Your Strategy',
        content: 'The validation panel shows any errors or warnings. Make sure all nodes are connected properly before deployment.',
        targetElement: '[data-testid="validation-panel"]',
        position: 'left',
        highlight: true
      }
    ],
    completionReward: {
      type: 'badge',
      value: 'Visual Strategy Master'
    }
  }
];

interface TutorialOverlayProps {
  tutorial: Tutorial;
  isActive: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  tutorial,
  isActive,
  onComplete,
  onClose
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = tutorial.steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / tutorial.steps.length) * 100;

  // Handle element highlighting
  useEffect(() => {
    if (!isActive || !currentStep.targetElement) return;

    const element = document.querySelector(currentStep.targetElement) as HTMLElement;
    if (element) {
      setHighlightedElement(element);
      
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight classes
      element.classList.add('tutorial-highlight');
      
      return () => {
        element.classList.remove('tutorial-highlight');
      };
    }
  }, [currentStep, isActive]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (currentStepIndex < tutorial.steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        setIsPlaying(false);
        onComplete();
      }
    }, 4000); // 4 seconds per step

    return () => clearTimeout(timer);
  }, [currentStepIndex, isPlaying, tutorial.steps.length, onComplete]);

  // Position tooltip relative to target element
  useEffect(() => {
    if (!highlightedElement || !tooltipRef.current) return;

    const rect = highlightedElement.getBoundingClientRect();
    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (currentStep.position) {
      case 'top':
        top = rect.top - tooltipRect.height - 10;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.left - tooltipRect.width - 10;
        break;
      case 'right':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.right + 10;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
        break;
    }

    // Ensure tooltip stays within viewport
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }, [highlightedElement, currentStep.position]);

  const handleNext = () => {
    if (currentStepIndex < tutorial.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    setCurrentStepIndex(tutorial.steps.length - 1);
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  if (!isActive) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Tutorial tooltip */}
      <Card
        ref={tooltipRef}
        className="fixed z-50 max-w-sm shadow-lg border-2 border-blue-500"
        style={{ position: 'fixed' }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm">{currentStep.title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {currentStepIndex + 1} of {tutorial.steps.length}</span>
            <Badge variant="outline" className="text-xs">
              {tutorial.difficulty}
            </Badge>
          </div>
          
          <Progress value={progress} className="h-1" />
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-sm mb-4">{currentStep.content}</p>

          {currentStep.action && (
            <div className="flex items-center space-x-2 mb-4 p-2 bg-blue-50 rounded-lg">
              <MousePointer className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {currentStep.actionText || `${currentStep.action} the highlighted element`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 w-8"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRestart}
                className="h-8 w-8"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                className="h-8 w-8"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {currentStepIndex === tutorial.steps.length - 1 ? 'Finish' : 'Next'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Highlight styles */}
      <style jsx global>{`
        .tutorial-highlight {
          position: relative;
          z-index: 41;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          animation: tutorial-pulse 2s infinite;
        }
        
        @keyframes tutorial-pulse {
          0% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.2);
          }
          100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          }
        }
      `}</style>
    </>
  );
};

// Tutorial Selection Component
export const InteractiveTutorials: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial: (tutorial: Tutorial) => void;
  completedTutorials?: string[];
}> = ({ isOpen, onClose, onStartTutorial, completedTutorials = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(tutorials.map(t => t.category))];
  const filteredTutorials = selectedCategory 
    ? tutorials.filter(t => t.category === selectedCategory)
    : tutorials;

  const getDifficultyColor = (difficulty: string) => {
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
              <Lightbulb className="h-6 w-6 text-blue-600" />
              <CardTitle>Interactive Tutorials</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Learn by doing with step-by-step guided tutorials
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <div className="flex space-x-6 h-full">
            {/* Categories Sidebar */}
            <div className="w-48 space-y-2">
              <h3 className="font-semibold text-sm mb-2">Categories</h3>
              <Button
                variant={selectedCategory === null ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start"
                onClick={() => setSelectedCategory(null)}
              >
                All Tutorials
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>

            <Separator orientation="vertical" />

            {/* Tutorials List */}
            <div className="flex-1 space-y-4 overflow-auto">
              {filteredTutorials.map((tutorial) => {
                const isCompleted = completedTutorials.includes(tutorial.id);
                const canStart = !tutorial.prerequisites || 
                  tutorial.prerequisites.every(prereq => completedTutorials.includes(prereq));

                return (
                  <Card key={tutorial.id} className={`relative ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-400" />
                            )}
                            <h3 className="font-semibold">{tutorial.title}</h3>
                            <Badge className={getDifficultyColor(tutorial.difficulty)}>
                              {tutorial.difficulty}
                            </Badge>
                          </div>
                          
                          <p className="text-muted-foreground text-sm mb-3">
                            {tutorial.description}
                          </p>

                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-3">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {tutorial.estimatedTime} min
                            </span>
                            <span className="flex items-center">
                              <Target className="h-3 w-3 mr-1" />
                              {tutorial.steps.length} steps
                            </span>
                            {tutorial.completionReward && (
                              <span className="flex items-center">
                                <Star className="h-3 w-3 mr-1" />
                                Earn "{tutorial.completionReward.value}"
                              </span>
                            )}
                          </div>

                          {tutorial.prerequisites && tutorial.prerequisites.length > 0 && (
                            <div className="mb-3">
                              <span className="text-xs text-muted-foreground">Prerequisites: </span>
                              {tutorial.prerequisites.map((prereq, index) => (
                                <Badge key={prereq} variant="outline" className="text-xs mr-1">
                                  {tutorials.find(t => t.id === prereq)?.title || prereq}
                                  {completedTutorials.includes(prereq) ? ' ✓' : ''}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="ml-4">
                          <Button
                            onClick={() => onStartTutorial(tutorial)}
                            disabled={!canStart}
                            size="sm"
                            className={isCompleted ? 'bg-green-600 hover:bg-green-700' : ''}
                          >
                            {isCompleted ? (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Replay
                              </>
                            ) : canStart ? (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Start
                              </>
                            ) : (
                              'Prerequisites Required'
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { tutorials };
export default InteractiveTutorials;