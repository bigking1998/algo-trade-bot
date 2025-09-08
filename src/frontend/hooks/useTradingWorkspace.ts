import { useState, useCallback, useEffect } from 'react';

// Types for workspace management
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
  created: number;
  modified: number;
}

interface WorkspaceSettings {
  keyboardShortcuts: boolean;
  lowLatencyMode: boolean;
  autoSaveInterval: number;
  theme: 'light' | 'dark' | 'system';
  performanceMode: 'standard' | 'high' | 'ultra';
}

interface TradingWorkspaceHook {
  // Layout management
  layouts: WorkspaceLayoutConfig[];
  currentLayout: WorkspaceLayoutConfig | null;
  saveLayout: (name: string, layout: WorkspaceLayoutConfig) => Promise<void>;
  loadLayout: (id: string) => Promise<void>;
  deleteLayout: (id: string) => Promise<void>;
  duplicateLayout: (id: string, newName: string) => Promise<void>;
  resetToDefault: () => void;
  
  // Settings
  settings: WorkspaceSettings;
  updateSettings: (settings: Partial<WorkspaceSettings>) => void;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Performance monitoring
  performanceMetrics: {
    renderTime: number;
    memoryUsage: number;
    updateFrequency: number;
  };
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  keyboardShortcuts: true,
  lowLatencyMode: false,
  autoSaveInterval: 30000, // 30 seconds
  theme: 'system',
  performanceMode: 'standard'
};

const STORAGE_KEYS = {
  LAYOUTS: 'trading-workspace-layouts',
  SETTINGS: 'trading-workspace-settings',
  CURRENT_LAYOUT: 'trading-workspace-current'
};

export const useTradingWorkspace = (): TradingWorkspaceHook => {
  const [layouts, setLayouts] = useState<WorkspaceLayoutConfig[]>([]);
  const [currentLayout, setCurrentLayout] = useState<WorkspaceLayoutConfig | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderTime: 0,
    memoryUsage: 0,
    updateFrequency: 0
  });

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      setIsLoading(true);
      
      // Load layouts
      const savedLayouts = localStorage.getItem(STORAGE_KEYS.LAYOUTS);
      if (savedLayouts) {
        setLayouts(JSON.parse(savedLayouts));
      }
      
      // Load settings
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }
      
      // Load current layout
      const savedCurrentLayout = localStorage.getItem(STORAGE_KEYS.CURRENT_LAYOUT);
      if (savedCurrentLayout) {
        setCurrentLayout(JSON.parse(savedCurrentLayout));
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save current layout
  useEffect(() => {
    if (!settings.autoSaveInterval || !currentLayout) return;
    
    const interval = setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_LAYOUT, JSON.stringify(currentLayout));
      } catch (err) {
        console.warn('Failed to auto-save current layout:', err);
      }
    }, settings.autoSaveInterval);
    
    return () => clearInterval(interval);
  }, [currentLayout, settings.autoSaveInterval]);

  // Performance monitoring
  useEffect(() => {
    if (!settings.lowLatencyMode) return;
    
    const startTime = performance.now();
    let frameCount = 0;
    
    const measurePerformance = () => {
      frameCount++;
      const currentTime = performance.now();
      const renderTime = currentTime - startTime;
      
      // Update metrics every second
      if (renderTime >= 1000) {
        setPerformanceMetrics({
          renderTime: renderTime / frameCount,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          updateFrequency: frameCount
        });
        frameCount = 0;
      }
      
      if (settings.lowLatencyMode) {
        requestAnimationFrame(measurePerformance);
      }
    };
    
    requestAnimationFrame(measurePerformance);
  }, [settings.lowLatencyMode]);

  // Save layout to localStorage and state
  const saveLayout = useCallback(async (name: string, layout: WorkspaceLayoutConfig) => {
    try {
      setIsLoading(true);
      
      const newLayout: WorkspaceLayoutConfig = {
        ...layout,
        id: `custom-${Date.now()}`,
        name,
        created: Date.now(),
        modified: Date.now()
      };
      
      const updatedLayouts = [...layouts, newLayout];
      setLayouts(updatedLayouts);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(updatedLayouts));
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save layout');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [layouts]);

  // Load layout by ID
  const loadLayout = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      
      const layout = layouts.find(l => l.id === id);
      if (!layout) {
        throw new Error(`Layout with ID ${id} not found`);
      }
      
      setCurrentLayout(layout);
      localStorage.setItem(STORAGE_KEYS.CURRENT_LAYOUT, JSON.stringify(layout));
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load layout');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [layouts]);

  // Delete layout
  const deleteLayout = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      
      const updatedLayouts = layouts.filter(l => l.id !== id);
      setLayouts(updatedLayouts);
      
      // If deleting current layout, reset to null
      if (currentLayout?.id === id) {
        setCurrentLayout(null);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_LAYOUT);
      }
      
      localStorage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(updatedLayouts));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete layout');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [layouts, currentLayout]);

  // Duplicate layout
  const duplicateLayout = useCallback(async (id: string, newName: string) => {
    try {
      setIsLoading(true);
      
      const originalLayout = layouts.find(l => l.id === id);
      if (!originalLayout) {
        throw new Error(`Layout with ID ${id} not found`);
      }
      
      const duplicatedLayout: WorkspaceLayoutConfig = {
        ...originalLayout,
        id: `custom-${Date.now()}`,
        name: newName,
        created: Date.now(),
        modified: Date.now()
      };
      
      const updatedLayouts = [...layouts, duplicatedLayout];
      setLayouts(updatedLayouts);
      
      localStorage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(updatedLayouts));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate layout');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [layouts]);

  // Reset to default layout
  const resetToDefault = useCallback(() => {
    setCurrentLayout(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_LAYOUT);
    setError(null);
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<WorkspaceSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }, [settings]);

  return {
    // Layout management
    layouts,
    currentLayout,
    saveLayout,
    loadLayout,
    deleteLayout,
    duplicateLayout,
    resetToDefault,
    
    // Settings
    settings,
    updateSettings,
    
    // State
    isLoading,
    error,
    
    // Performance monitoring
    performanceMetrics
  };
};