/**
 * Mobile-First Design System - Task FE-017
 * 
 * Comprehensive mobile-first design system with:
 * - Responsive design implementation
 * - Touch-friendly interfaces
 * - Mobile navigation
 * - Performance optimization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer';
import {
  Menu,
  X,
  Home,
  TrendingUp,
  BarChart3,
  Settings,
  User,
  Bell,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Tablet,
  Monitor,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  Maximize2,
  Minimize2
} from 'lucide-react';

// Responsive breakpoint hook
export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setDimensions({ width, height });
      
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return {
    isMobile: screenSize === 'mobile',
    isTablet: screenSize === 'tablet',
    isDesktop: screenSize === 'desktop',
    screenSize,
    dimensions
  };
};

// Touch gesture hook
export const useTouchGestures = (
  elementRef: React.RefObject<HTMLElement>
) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const onTouchMove = (e: TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    return {
      isLeftSwipe,
      isRightSwipe,
      isUpSwipe,
      isDownSwipe,
      distanceX: Math.abs(distanceX),
      distanceY: Math.abs(distanceY)
    };
  }, [touchStart, touchEnd, minSwipeDistance]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [elementRef, onTouchEnd]);

  return { touchStart, touchEnd, onTouchEnd };
};

// Mobile Navigation Component
interface MobileNavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  tabs: {
    id: string;
    label: string;
    icon: React.ReactNode;
  }[];
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentTab,
  onTabChange,
  tabs
}) => {
  const { isMobile, isTablet } = useResponsive();

  // Mobile bottom navigation
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
        <div className="flex justify-around py-2">
          {tabs.slice(0, 5).map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center space-y-1 px-2 py-3 ${
                currentTab === tab.id 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600'
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Tablet side navigation
  if (isTablet) {
    return (
      <div className="fixed left-0 top-0 h-full w-16 bg-white border-r shadow-sm z-40">
        <div className="flex flex-col items-center py-4 space-y-4">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className={`w-10 h-10 p-0 ${
                currentTab === tab.id 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600'
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

// Mobile Header Component
interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showBack,
  onBack,
  rightAction,
  subtitle
}) => {
  const { isMobile } = useResponsive();

  if (!isMobile) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-3">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {rightAction}
      </div>
    </div>
  );
};

// Touch-friendly Card Component
interface TouchCardProps {
  children: React.ReactNode;
  onTap?: () => void;
  onLongPress?: () => void;
  className?: string;
  pressable?: boolean;
}

export const TouchCard: React.FC<TouchCardProps> = ({
  children,
  onTap,
  onLongPress,
  className = '',
  pressable = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    if (pressable) setIsPressed(true);
    
    if (onLongPress) {
      const timer = setTimeout(() => {
        onLongPress();
        setIsPressed(false);
      }, 500);
      setLongPressTimer(timer);
    }
  };

  const handleTouchEnd = () => {
    if (pressable) setIsPressed(false);
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (onTap) onTap();
  };

  return (
    <Card
      className={`
        transition-all duration-150 
        ${pressable ? 'active:scale-95 cursor-pointer' : ''}
        ${isPressed ? 'scale-95 bg-gray-50' : ''}
        ${className}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={pressable ? handleTouchStart : undefined}
      onMouseUp={pressable ? handleTouchEnd : undefined}
    >
      {children}
    </Card>
  );
};

// Mobile-optimized Table Component
interface MobileTableProps<T> {
  data: T[];
  columns: {
    key: keyof T;
    label: string;
    render?: (value: any, item: T) => React.ReactNode;
    mobile?: boolean; // Show on mobile
  }[];
  onRowClick?: (item: T) => void;
}

export function MobileTable<T>({ 
  data, 
  columns, 
  onRowClick 
}: MobileTableProps<T>) {
  const { isMobile } = useResponsive();

  if (isMobile) {
    // Mobile card view
    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <TouchCard
            key={index}
            pressable={!!onRowClick}
            onTap={() => onRowClick?.(item)}
            className="p-4"
          >
            <div className="space-y-2">
              {columns
                .filter(col => col.mobile !== false)
                .map((column) => {
                  const value = item[column.key];
                  return (
                    <div key={String(column.key)} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">
                        {column.label}
                      </span>
                      <span className="text-sm">
                        {column.render ? column.render(value, item) : String(value)}
                      </span>
                    </div>
                  );
                })}
            </div>
            {onRowClick && (
              <ChevronRight className="h-4 w-4 absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            )}
          </TouchCard>
        ))}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th key={String(column.key)} className="text-left py-3 px-4 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={index}
              className={`border-b ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => {
                const value = item[column.key];
                return (
                  <td key={String(column.key)} className="py-3 px-4">
                    {column.render ? column.render(value, item) : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mobile Modal/Drawer Component
interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export const MobileModal: React.FC<MobileModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  const { isMobile } = useResponsive();

  if (isMobile) {
    // Use drawer on mobile
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent>
          <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ScrollArea className="max-h-[70vh]">
              {children}
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Use regular modal/sheet on larger screens
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    full: 'max-w-full h-full'
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className={`${sizeClasses[size]} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="max-h-[calc(100vh-8rem)]">
          {children}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// Performance monitoring component
export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkStatus: 'online' as 'online' | 'offline',
    connectionType: 'unknown'
  });

  useEffect(() => {
    // Monitor performance metrics
    const updateMetrics = () => {
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        setMetrics(prev => ({
          ...prev,
          loadTime: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
          renderTime: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart)
        }));
      }

      // Memory usage (if available)
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024) // MB
        }));
      }

      // Network status
      setMetrics(prev => ({
        ...prev,
        networkStatus: navigator.onLine ? 'online' : 'offline',
        connectionType: (navigator as any).connection?.effectiveType || 'unknown'
      }));
    };

    updateMetrics();
    
    const interval = setInterval(updateMetrics, 5000);
    
    window.addEventListener('online', updateMetrics);
    window.addEventListener('offline', updateMetrics);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', updateMetrics);
      window.removeEventListener('offline', updateMetrics);
    };
  }, []);

  const { isMobile } = useResponsive();

  if (!isMobile) return null;

  return (
    <div className="fixed top-0 right-0 z-50 p-2">
      <div className="flex items-center space-x-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
        {metrics.networkStatus === 'online' ? (
          <Wifi className="h-3 w-3 text-green-400" />
        ) : (
          <WifiOff className="h-3 w-3 text-red-400" />
        )}
        <span>{metrics.connectionType}</span>
        <Battery className="h-3 w-3" />
        <span>{metrics.memoryUsage}MB</span>
      </div>
    </div>
  );
};

// Device Simulator (for development/testing)
export const DeviceSimulator: React.FC<{
  children: React.ReactNode;
  device: 'mobile' | 'tablet' | 'desktop';
}> = ({ children, device }) => {
  const deviceStyles = {
    mobile: 'max-w-sm mx-auto border-4 border-black rounded-3xl overflow-hidden',
    tablet: 'max-w-2xl mx-auto border-4 border-gray-800 rounded-2xl overflow-hidden',
    desktop: 'w-full'
  };

  const deviceIcons = {
    mobile: <Smartphone className="h-4 w-4" />,
    tablet: <Tablet className="h-4 w-4" />,
    desktop: <Monitor className="h-4 w-4" />
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-center mb-4">
        <Badge variant="outline" className="flex items-center space-x-1">
          {deviceIcons[device]}
          <span>{device.charAt(0).toUpperCase() + device.slice(1)}</span>
        </Badge>
      </div>
      <div className={deviceStyles[device]}>
        {children}
      </div>
    </div>
  );
};

export default {
  useResponsive,
  useTouchGestures,
  MobileNavigation,
  MobileHeader,
  TouchCard,
  MobileTable,
  MobileModal,
  PerformanceMonitor,
  DeviceSimulator
};