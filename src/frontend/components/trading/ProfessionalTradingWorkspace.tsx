import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs';
import { 
  Layout, 
  Grid, 
  Maximize2, 
  Minimize2, 
  Settings, 
  Save, 
  FolderOpen, 
  Monitor,
  PanelLeftOpen,
  PanelRightOpen,
  PanelTopOpen,
  PanelBottomOpen,
  Columns,
  Rows,
  Square,
  Zap
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select';
import { Badge } from '@/frontend/components/ui/badge';
import { Separator } from '@/frontend/components/ui/separator';

// Import professional trading components
import { AdvancedOrderEntry } from './AdvancedOrderEntry';
import { LevelIIOrderBook } from './LevelIIOrderBook';
import { MultiAssetPortfolio } from './MultiAssetPortfolio';
import { ProfessionalCharting } from './ProfessionalCharting';

// Import existing components
import { PositionManagement } from '@/frontend/components/positions/PositionManagement';
import RiskDashboard from '@/frontend/components/risk/RiskDashboard';
import MarketChart from '@/frontend/components/charts/MarketChart';

// Workspace management hook
import { useTradingWorkspace } from '@/frontend/hooks/useTradingWorkspace';

interface WorkspaceLayoutConfig {
  id: string;
  name: string;
  description: string;
  layout: {
    type: 'grid' | 'flex';
    columns: number;
    rows: number;
    areas: {
      component: string;
      area: string;
      size: { width: number; height: number };
      position: { x: number; y: number };
    }[];
  };
}

const DEFAULT_LAYOUTS: WorkspaceLayoutConfig[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Full institutional trading setup with all components',
    layout: {
      type: 'grid',
      columns: 4,
      rows: 3,
      areas: [
        { component: 'charts', area: 'main-chart', size: { width: 2, height: 2 }, position: { x: 0, y: 0 } },
        { component: 'orderbook', area: 'orderbook', size: { width: 1, height: 2 }, position: { x: 2, y: 0 } },
        { component: 'orderentry', area: 'orderentry', size: { width: 1, height: 1 }, position: { x: 3, y: 0 } },
        { component: 'portfolio', area: 'portfolio', size: { width: 1, height: 1 }, position: { x: 3, y: 1 } },
        { component: 'positions', area: 'positions', size: { width: 2, height: 1 }, position: { x: 0, y: 2 } },
        { component: 'risk', area: 'risk', size: { width: 2, height: 1 }, position: { x: 2, y: 2 } },
      ]
    }
  },
  {
    id: 'scalper',
    name: 'Scalper',
    description: 'Optimized for high-frequency trading with minimal latency',
    layout: {
      type: 'grid',
      columns: 3,
      rows: 2,
      areas: [
        { component: 'orderentry', area: 'orderentry', size: { width: 1, height: 1 }, position: { x: 0, y: 0 } },
        { component: 'orderbook', area: 'orderbook', size: { width: 1, height: 1 }, position: { x: 1, y: 0 } },
        { component: 'positions', area: 'positions', size: { width: 1, height: 1 }, position: { x: 2, y: 0 } },
        { component: 'charts', area: 'charts', size: { width: 3, height: 1 }, position: { x: 0, y: 1 } },
      ]
    }
  },
  {
    id: 'portfolio',
    name: 'Portfolio Manager',
    description: 'Focus on portfolio management and risk analysis',
    layout: {
      type: 'grid',
      columns: 2,
      rows: 2,
      areas: [
        { component: 'portfolio', area: 'portfolio', size: { width: 1, height: 1 }, position: { x: 0, y: 0 } },
        { component: 'risk', area: 'risk', size: { width: 1, height: 1 }, position: { x: 1, y: 0 } },
        { component: 'positions', area: 'positions', size: { width: 1, height: 1 }, position: { x: 0, y: 1 } },
        { component: 'charts', area: 'charts', size: { width: 1, height: 1 }, position: { x: 1, y: 1 } },
      ]
    }
  }
];

interface ProfessionalTradingWorkspaceProps {
  className?: string;
}

export const ProfessionalTradingWorkspace: React.FC<ProfessionalTradingWorkspaceProps> = ({
  className = '',
}) => {
  const [currentLayout, setCurrentLayout] = useState<WorkspaceLayoutConfig>(DEFAULT_LAYOUTS[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(true);
  const [lowLatencyMode, setLowLatencyMode] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Use workspace management hook
  const {
    layouts,
    saveLayout,
    loadLayout,
    resetToDefault,
    isLoading
  } = useTradingWorkspace();

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return;

    const handleKeydown = (event: KeyboardEvent) => {
      // Professional trading hotkeys
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setSelectedComponent('orderentry');
            break;
          case '2':
            event.preventDefault();
            setSelectedComponent('orderbook');
            break;
          case '3':
            event.preventDefault();
            setSelectedComponent('charts');
            break;
          case '4':
            event.preventDefault();
            setSelectedComponent('positions');
            break;
          case 's':
            event.preventDefault();
            handleSaveLayout();
            break;
          case 'f':
            event.preventDefault();
            toggleFullscreen();
            break;
        }
      }
      
      // Quick order shortcuts
      if (event.altKey) {
        switch (event.key) {
          case 'b':
            event.preventDefault();
            // Quick buy
            console.log('Quick buy triggered');
            break;
          case 's':
            event.preventDefault();
            // Quick sell
            console.log('Quick sell triggered');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [keyboardShortcuts]);

  // Performance optimization for low-latency mode
  useEffect(() => {
    if (lowLatencyMode) {
      // Enable hardware acceleration
      if (workspaceRef.current) {
        workspaceRef.current.style.willChange = 'transform';
        workspaceRef.current.style.transform = 'translateZ(0)';
      }
    }
  }, [lowLatencyMode]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && workspaceRef.current) {
      workspaceRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const handleSaveLayout = useCallback(() => {
    const layoutName = prompt('Enter layout name:');
    if (layoutName) {
      saveLayout(layoutName, currentLayout);
    }
  }, [currentLayout, saveLayout]);

  const handleLoadLayout = useCallback((layoutId: string) => {
    const layout = [...DEFAULT_LAYOUTS, ...layouts].find(l => l.id === layoutId);
    if (layout) {
      setCurrentLayout(layout);
      loadLayout(layoutId);
    }
  }, [layouts, loadLayout]);

  const renderComponent = (componentName: string) => {
    const commonProps = {
      className: selectedComponent === componentName ? 'ring-2 ring-blue-500' : '',
      onClick: () => setSelectedComponent(componentName)
    };

    switch (componentName) {
      case 'orderentry':
        return <AdvancedOrderEntry {...commonProps} />;
      case 'orderbook':
        return <LevelIIOrderBook {...commonProps} />;
      case 'portfolio':
        return <MultiAssetPortfolio {...commonProps} />;
      case 'charts':
        return <ProfessionalCharting {...commonProps} />;
      case 'positions':
        return <PositionManagement {...commonProps} />;
      case 'risk':
        return <RiskDashboard {...commonProps} />;
      default:
        return (
          <Card {...commonProps}>
            <CardContent className="p-4">
              <div className="text-center text-muted-foreground">
                Component: {componentName}
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${currentLayout.layout.columns}, 1fr)`,
    gridTemplateRows: `repeat(${currentLayout.layout.rows}, 1fr)`,
    gap: '4px',
    height: '100%',
    minHeight: '800px'
  };

  return (
    <div 
      ref={workspaceRef}
      className={`professional-trading-workspace ${className} ${isFullscreen ? 'fullscreen' : ''}`}
    >
      {/* Workspace Header */}
      <div className="flex items-center justify-between p-2 bg-muted/30 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            <span className="text-sm font-medium">Professional Trading Workspace</span>
          </div>
          
          <Badge variant={lowLatencyMode ? "default" : "outline"} className="gap-1">
            <Zap className="h-3 w-3" />
            {lowLatencyMode ? "Low Latency" : "Standard"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Selection */}
          <Select value={currentLayout.id} onValueChange={handleLoadLayout}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_LAYOUTS.map(layout => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                </SelectItem>
              ))}
              {layouts.map(layout => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name} (Custom)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />

          {/* Workspace Controls */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveLayout}
            className="gap-1"
          >
            <Save className="h-3 w-3" />
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLowLatencyMode(!lowLatencyMode)}
            className="gap-1"
          >
            <Zap className="h-3 w-3" />
            {lowLatencyMode ? "Standard" : "Low Latency"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="gap-1"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setKeyboardShortcuts(!keyboardShortcuts)}
            className="gap-1"
          >
            <Settings className="h-3 w-3" />
            Hotkeys
          </Button>
        </div>
      </div>

      {/* Main Trading Interface */}
      <div className="flex-1 p-2" style={{ height: 'calc(100vh - 140px)' }}>
        <div style={gridStyle}>
          {currentLayout.layout.areas.map((area, index) => (
            <div
              key={`${area.component}-${index}`}
              style={{
                gridColumn: `${area.position.x + 1} / span ${area.size.width}`,
                gridRow: `${area.position.y + 1} / span ${area.size.height}`,
              }}
              className="relative"
            >
              {renderComponent(area.component)}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-t text-xs">
        <div className="flex items-center gap-4">
          <span>Layout: {currentLayout.name}</span>
          <span>Components: {currentLayout.layout.areas.length}</span>
          {selectedComponent && <span>Selected: {selectedComponent}</span>}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Live Data</span>
          </div>
          <div className="flex items-center gap-1">
            <Monitor className="h-3 w-3" />
            <span>60 FPS</span>
          </div>
          {keyboardShortcuts && (
            <div className="text-muted-foreground">
              Ctrl+1-4: Select | Ctrl+S: Save | Ctrl+F: Fullscreen | Alt+B/S: Quick Trade
            </div>
          )}
        </div>
      </div>

      {/* Multi-monitor Support Indicator */}
      <div className="absolute top-2 right-2 z-50">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs opacity-50 hover:opacity-100"
          title="Detach to new window (Multi-monitor support)"
        >
          <Monitor className="h-3 w-3" />
          Multi-Monitor Ready
        </Button>
      </div>
    </div>
  );
};

export default ProfessionalTradingWorkspace;