/**
 * Memory Manager - Task BE-012
 * 
 * Advanced memory management system for the indicator pipeline with
 * monitoring, garbage collection optimization, and memory leak detection.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// =============================================================================
// MEMORY MANAGEMENT TYPES AND INTERFACES
// =============================================================================

export interface MemoryConfig {
  maxHeapUsage: number; // bytes
  gcThreshold: number; // percentage
  autoCleanup: boolean;
  monitoringInterval: number; // milliseconds
  leakDetectionEnabled: boolean;
  emergencyCleanupThreshold: number; // percentage
}

export interface MemoryUsage {
  heap: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

export interface MemoryStats {
  current: MemoryUsage;
  peak: MemoryUsage;
  average: MemoryUsage;
  gcCount: number;
  gcTime: number;
  leakSuspects: MemoryLeak[];
  utilizationHistory: Array<{
    timestamp: Date;
    usage: MemoryUsage;
    utilization: number;
  }>;
}

export interface MemoryLeak {
  component: string;
  growthRate: number; // bytes per second
  suspicionLevel: 'low' | 'medium' | 'high' | 'critical';
  firstDetected: Date;
  lastUpdate: Date;
  samples: Array<{
    timestamp: Date;
    size: number;
  }>;
}

export interface MemoryAlert {
  type: 'threshold' | 'leak' | 'emergency' | 'gc';
  level: 'warning' | 'critical';
  message: string;
  usage?: MemoryUsage;
  leak?: MemoryLeak;
  timestamp: Date;
}

// =============================================================================
// MEMORY MANAGER IMPLEMENTATION
// =============================================================================

export class MemoryManager extends EventEmitter {
  private readonly config: MemoryConfig;
  private readonly stats: MemoryStats;
  private readonly componentTracking: Map<string, Array<{
    timestamp: Date;
    size: number;
  }>> = new Map();
  
  private monitoringInterval?: NodeJS.Timeout;
  private lastGCTime = 0;
  private gcCount = 0;
  private isEmergencyMode = false;

  constructor(config: Partial<MemoryConfig> = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    this.stats = this.initializeStats();
    
    if (this.config.autoCleanup) {
      this.startMonitoring();
    }
    
    this.setupGCMonitoring();
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - MEMORY MONITORING
  // =============================================================================

  /**
   * Get current memory usage
   */
  getCurrentUsage(): MemoryUsage {
    const memUsage = process.memoryUsage();
    
    return {
      heap: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      rss: memUsage.rss
    };
  }

  /**
   * Get comprehensive memory statistics
   */
  getStats(): MemoryStats {
    this.updateStats();
    return {
      ...this.stats,
      current: this.getCurrentUsage(),
      leakSuspects: [...this.stats.leakSuspects] // Copy array
    };
  }

  /**
   * Check if memory usage is within acceptable limits
   */
  isMemoryHealthy(): boolean {
    const usage = this.getCurrentUsage();
    const utilization = usage.heapUsed / this.config.maxHeapUsage;
    
    return utilization < (this.config.gcThreshold / 100) && !this.isEmergencyMode;
  }

  /**
   * Get memory utilization percentage
   */
  getMemoryUtilization(): number {
    const usage = this.getCurrentUsage();
    return (usage.heapUsed / this.config.maxHeapUsage) * 100;
  }

  /**
   * Register component for memory tracking
   */
  trackComponent(componentName: string, estimatedSize: number = 0): void {
    if (!this.componentTracking.has(componentName)) {
      this.componentTracking.set(componentName, []);
    }
    
    const samples = this.componentTracking.get(componentName)!;
    samples.push({
      timestamp: new Date(),
      size: estimatedSize
    });
    
    // Limit sample history
    if (samples.length > 100) {
      samples.splice(0, 10);
    }
    
    this.emit('componentTracked', { componentName, size: estimatedSize });
  }

  /**
   * Update component memory usage
   */
  updateComponentSize(componentName: string, newSize: number): void {
    this.trackComponent(componentName, newSize);
    
    if (this.config.leakDetectionEnabled) {
      this.checkForLeaks(componentName);
    }
  }

  /**
   * Untrack component
   */
  untrackComponent(componentName: string): boolean {
    const removed = this.componentTracking.delete(componentName);
    if (removed) {
      this.emit('componentUntracked', { componentName });
    }
    return removed;
  }

  // =============================================================================
  // PUBLIC API - MEMORY MANAGEMENT
  // =============================================================================

  /**
   * Perform maintenance operations
   */
  performMaintenance(): void {
    const startTime = performance.now();
    const beforeUsage = this.getCurrentUsage();
    
    try {
      // Clean up component tracking
      this.cleanupComponentTracking();
      
      // Check for memory leaks
      if (this.config.leakDetectionEnabled) {
        this.performLeakDetection();
      }
      
      // Check if GC is needed
      const utilization = this.getMemoryUtilization();
      if (utilization > this.config.gcThreshold) {
        this.triggerGarbageCollection();
      }
      
      // Emergency cleanup if needed
      if (utilization > this.config.emergencyCleanupThreshold) {
        this.performEmergencyCleanup();
      }
      
      const afterUsage = this.getCurrentUsage();
      const maintenanceTime = performance.now() - startTime;
      const memoryFreed = beforeUsage.heapUsed - afterUsage.heapUsed;
      
      this.emit('maintenanceCompleted', {
        duration: maintenanceTime,
        memoryFreed,
        beforeUsage,
        afterUsage
      });
      
    } catch (error) {
      this.emit('maintenanceError', { error });
    }
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      const beforeUsage = this.getCurrentUsage();
      const startTime = performance.now();
      
      try {
        global.gc();
        
        const afterUsage = this.getCurrentUsage();
        const gcTime = performance.now() - startTime;
        const memoryFreed = beforeUsage.heapUsed - afterUsage.heapUsed;
        
        this.gcCount++;
        this.lastGCTime = Date.now();
        this.stats.gcCount++;
        this.stats.gcTime += gcTime;
        
        this.emit('garbageCollected', {
          memoryFreed,
          gcTime,
          beforeUsage,
          afterUsage
        });
        
        return true;
      } catch (error) {
        this.emit('gcError', { error });
        return false;
      }
    }
    
    return false;
  }

  /**
   * Perform emergency cleanup
   */
  performEmergencyCleanup(): void {
    this.isEmergencyMode = true;
    
    const beforeUsage = this.getCurrentUsage();
    
    try {
      // Clear all component tracking history except recent
      this.componentTracking.forEach((samples, component) => {
        if (samples.length > 10) {
          const recent = samples.slice(-5);
          this.componentTracking.set(component, recent);
        }
      });
      
      // Clear utilization history
      if (this.stats.utilizationHistory.length > 50) {
        this.stats.utilizationHistory.splice(0, this.stats.utilizationHistory.length - 25);
      }
      
      // Force GC multiple times
      let gcAttempts = 0;
      while (gcAttempts < 3 && this.getMemoryUtilization() > this.config.gcThreshold) {
        this.forceGarbageCollection();
        gcAttempts++;
      }
      
      const afterUsage = this.getCurrentUsage();
      const memoryFreed = beforeUsage.heapUsed - afterUsage.heapUsed;
      
      this.emit('emergencyCleanup', {
        memoryFreed,
        gcAttempts,
        beforeUsage,
        afterUsage
      });
      
      // Check if still in emergency state
      if (this.getMemoryUtilization() < this.config.gcThreshold) {
        this.isEmergencyMode = false;
      }
      
    } catch (error) {
      this.emit('emergencyCleanupError', { error });
    }
  }

  /**
   * Clean up and stop memory manager
   */
  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    // Perform final maintenance
    this.performMaintenance();
    
    // Clear all tracking data
    this.componentTracking.clear();
    this.stats.leakSuspects.length = 0;
    this.stats.utilizationHistory.length = 0;
    
    this.emit('cleanup');
  }

  // =============================================================================
  // PRIVATE METHODS - MONITORING
  // =============================================================================

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle();
    }, this.config.monitoringInterval);
  }

  private performMonitoringCycle(): void {
    const usage = this.getCurrentUsage();
    const utilization = (usage.heapUsed / this.config.maxHeapUsage) * 100;
    
    // Update stats
    this.updateStats();
    
    // Record utilization history
    this.stats.utilizationHistory.push({
      timestamp: new Date(),
      usage: { ...usage },
      utilization
    });
    
    // Limit history size
    if (this.stats.utilizationHistory.length > 1000) {
      this.stats.utilizationHistory.splice(0, 100);
    }
    
    // Check thresholds and emit alerts
    this.checkMemoryThresholds(usage, utilization);
    
    // Perform leak detection
    if (this.config.leakDetectionEnabled) {
      this.performLeakDetection();
    }
    
    this.emit('monitoringCycle', { usage, utilization });
  }

  private checkMemoryThresholds(usage: MemoryUsage, utilization: number): void {
    // Warning threshold (80% of GC threshold)
    const warningThreshold = this.config.gcThreshold * 0.8;
    if (utilization > warningThreshold && utilization <= this.config.gcThreshold) {
      const alert: MemoryAlert = {
        type: 'threshold',
        level: 'warning',
        message: `Memory utilization at ${utilization.toFixed(1)}%`,
        usage,
        timestamp: new Date()
      };
      
      this.emit('memoryAlert', alert);
    }
    
    // Critical threshold (GC threshold)
    if (utilization > this.config.gcThreshold) {
      const alert: MemoryAlert = {
        type: 'threshold',
        level: 'critical',
        message: `Memory utilization exceeded threshold at ${utilization.toFixed(1)}%`,
        usage,
        timestamp: new Date()
      };
      
      this.emit('memoryAlert', alert);
      
      if (this.config.autoCleanup) {
        this.triggerGarbageCollection();
      }
    }
    
    // Emergency threshold
    if (utilization > this.config.emergencyCleanupThreshold) {
      const alert: MemoryAlert = {
        type: 'emergency',
        level: 'critical',
        message: `Emergency memory cleanup triggered at ${utilization.toFixed(1)}%`,
        usage,
        timestamp: new Date()
      };
      
      this.emit('memoryAlert', alert);
      this.performEmergencyCleanup();
    }
  }

  // =============================================================================
  // PRIVATE METHODS - LEAK DETECTION
  // =============================================================================

  private performLeakDetection(): void {
    this.componentTracking.forEach((samples, componentName) => {
      if (samples.length < 5) return; // Need enough samples
      
      const leak = this.analyzeComponentForLeaks(componentName, samples);
      if (leak) {
        this.handleDetectedLeak(leak);
      }
    });
  }

  private analyzeComponentForLeaks(
    componentName: string, 
    samples: Array<{ timestamp: Date; size: number }>
  ): MemoryLeak | null {
    // Calculate growth rate over recent samples
    const recentSamples = samples.slice(-10); // Last 10 samples
    if (recentSamples.length < 5) return null;
    
    const timeSpan = recentSamples[recentSamples.length - 1].timestamp.getTime() - 
                   recentSamples[0].timestamp.getTime();
    const sizeGrowth = recentSamples[recentSamples.length - 1].size - recentSamples[0].size;
    
    if (timeSpan <= 0) return null;
    
    const growthRate = (sizeGrowth / timeSpan) * 1000; // bytes per second
    
    // Determine suspicion level
    let suspicionLevel: MemoryLeak['suspicionLevel'] = 'low';
    if (growthRate > 1000000) { // 1MB/s
      suspicionLevel = 'critical';
    } else if (growthRate > 100000) { // 100KB/s
      suspicionLevel = 'high';
    } else if (growthRate > 10000) { // 10KB/s
      suspicionLevel = 'medium';
    }
    
    // Only report if there's significant growth
    if (growthRate < 1000) return null; // Less than 1KB/s
    
    // Check if this is a known leak or new
    const existingLeak = this.stats.leakSuspects.find(l => l.component === componentName);
    
    if (existingLeak) {
      existingLeak.growthRate = growthRate;
      existingLeak.suspicionLevel = suspicionLevel;
      existingLeak.lastUpdate = new Date();
      existingLeak.samples = [...recentSamples];
      return existingLeak;
    } else {
      return {
        component: componentName,
        growthRate,
        suspicionLevel,
        firstDetected: new Date(),
        lastUpdate: new Date(),
        samples: [...recentSamples]
      };
    }
  }

  private handleDetectedLeak(leak: MemoryLeak): void {
    // Add to leak suspects if new
    if (!this.stats.leakSuspects.find(l => l.component === leak.component)) {
      this.stats.leakSuspects.push(leak);
    }
    
    // Emit alert based on suspicion level
    if (leak.suspicionLevel === 'high' || leak.suspicionLevel === 'critical') {
      const alert: MemoryAlert = {
        type: 'leak',
        level: leak.suspicionLevel === 'critical' ? 'critical' : 'warning',
        message: `Memory leak detected in ${leak.component} (${(leak.growthRate / 1000).toFixed(1)} KB/s)`,
        leak,
        timestamp: new Date()
      };
      
      this.emit('memoryAlert', alert);
    }
    
    this.emit('leakDetected', { leak });
  }

  private checkForLeaks(componentName: string): void {
    const samples = this.componentTracking.get(componentName);
    if (!samples || samples.length < 5) return;
    
    const leak = this.analyzeComponentForLeaks(componentName, samples);
    if (leak) {
      this.handleDetectedLeak(leak);
    }
  }

  // =============================================================================
  // PRIVATE METHODS - GARBAGE COLLECTION
  // =============================================================================

  private setupGCMonitoring(): void {
    // Monitor GC events if available
    if (process.env.NODE_ENV === 'development' && global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        const startTime = performance.now();
        const beforeUsage = this.getCurrentUsage();
        
        originalGC();
        
        const afterUsage = this.getCurrentUsage();
        const gcTime = performance.now() - startTime;
        
        this.gcCount++;
        this.lastGCTime = Date.now();
        this.stats.gcCount++;
        this.stats.gcTime += gcTime;
        
        this.emit('gcCompleted', {
          gcTime,
          memoryFreed: beforeUsage.heapUsed - afterUsage.heapUsed,
          beforeUsage,
          afterUsage
        });
      };
    }
  }

  private triggerGarbageCollection(): void {
    if (Date.now() - this.lastGCTime < 5000) {
      // Don't GC too frequently
      return;
    }
    
    this.forceGarbageCollection();
  }

  // =============================================================================
  // PRIVATE METHODS - UTILITIES
  // =============================================================================

  private updateStats(): void {
    const currentUsage = this.getCurrentUsage();
    
    // Update peak usage
    if (currentUsage.heapUsed > this.stats.peak.heapUsed) {
      this.stats.peak = { ...currentUsage };
    }
    
    // Update average usage (simple moving average)
    const history = this.stats.utilizationHistory;
    if (history.length > 0) {
      const totalUsage = history.reduce((sum, h) => ({
        heap: sum.heap + h.usage.heap,
        heapTotal: sum.heapTotal + h.usage.heapTotal,
        heapUsed: sum.heapUsed + h.usage.heapUsed,
        external: sum.external + h.usage.external,
        arrayBuffers: sum.arrayBuffers + h.usage.arrayBuffers,
        rss: sum.rss + h.usage.rss
      }), { heap: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0, rss: 0 });
      
      const count = history.length;
      this.stats.average = {
        heap: totalUsage.heap / count,
        heapTotal: totalUsage.heapTotal / count,
        heapUsed: totalUsage.heapUsed / count,
        external: totalUsage.external / count,
        arrayBuffers: totalUsage.arrayBuffers / count,
        rss: totalUsage.rss / count
      };
    }
  }

  private cleanupComponentTracking(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    this.componentTracking.forEach((samples, component) => {
      const filteredSamples = samples.filter(s => s.timestamp.getTime() > cutoffTime);
      
      if (filteredSamples.length === 0) {
        this.componentTracking.delete(component);
      } else {
        this.componentTracking.set(component, filteredSamples);
      }
    });
    
    // Clean up old leak suspects
    this.stats.leakSuspects = this.stats.leakSuspects.filter(
      leak => leak.lastUpdate.getTime() > cutoffTime
    );
  }

  private initializeStats(): MemoryStats {
    const initialUsage = this.getCurrentUsage();
    
    return {
      current: initialUsage,
      peak: { ...initialUsage },
      average: { ...initialUsage },
      gcCount: 0,
      gcTime: 0,
      leakSuspects: [],
      utilizationHistory: []
    };
  }

  private mergeConfig(config: Partial<MemoryConfig>): MemoryConfig {
    return {
      maxHeapUsage: config.maxHeapUsage ?? 512 * 1024 * 1024, // 512MB
      gcThreshold: config.gcThreshold ?? 80, // 80%
      autoCleanup: config.autoCleanup ?? true,
      monitoringInterval: config.monitoringInterval ?? 30000, // 30 seconds
      leakDetectionEnabled: config.leakDetectionEnabled ?? true,
      emergencyCleanupThreshold: config.emergencyCleanupThreshold ?? 95 // 95%
    };
  }
}

export default MemoryManager;