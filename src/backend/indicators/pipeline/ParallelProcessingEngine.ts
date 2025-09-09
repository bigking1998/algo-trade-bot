/**
 * Parallel Processing Engine - Task BE-012
 * 
 * Advanced parallel processing system for concurrent indicator calculations
 * with worker pool management, task scheduling, and performance optimization.
 */

import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import type { OHLCV, IndicatorResult } from '../base/types.js';

// =============================================================================
// PARALLEL PROCESSING TYPES AND INTERFACES
// =============================================================================

export interface ParallelProcessingConfig {
  maxConcurrency: number;
  enabled: boolean;
  workerTimeout: number; // milliseconds
  taskQueueLimit: number;
  enableTaskPriority: boolean;
  workerIdleTimeout: number; // milliseconds
}

export interface ProcessingTask {
  id: string;
  indicatorId: string;
  data: OHLCV[];
  spec: any; // PipelineIndicatorSpec
  priority: number; // 0-100, higher = more important
  useCache: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface ProcessingResult {
  taskId: string;
  indicatorId: string;
  success: boolean;
  value?: IndicatorResult<any>;
  error?: Error;
  fromCache: boolean;
  processingTime: number;
  workerId?: string;
}

export interface WorkerInfo {
  id: string;
  worker: Worker;
  isActive: boolean;
  currentTaskId?: string;
  tasksCompleted: number;
  totalProcessingTime: number;
  lastActivity: Date;
  errors: number;
}

export interface ProcessingStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
  workerUtilization: number;
  queueLength: number;
  throughput: number; // tasks per second
}

// =============================================================================
// PARALLEL PROCESSING ENGINE IMPLEMENTATION
// =============================================================================

export class ParallelProcessingEngine extends EventEmitter {
  private readonly config: ParallelProcessingConfig;
  private readonly workers: Map<string, WorkerInfo> = new Map();
  private readonly taskQueue: ProcessingTask[] = [];
  private readonly activeTasks: Map<string, ProcessingTask> = new Map();
  private readonly completedTasks: ProcessingResult[] = [];
  
  // Performance tracking
  private stats: ProcessingStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageProcessingTime: 0,
    workerUtilization: 0,
    queueLength: 0,
    throughput: 0
  };
  
  private isShuttingDown = false;
  private workerCleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<ParallelProcessingConfig> = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    
    if (this.config.enabled) {
      this.initializeWorkerPool();
      this.startWorkerManagement();
    }
    
    this.emit('initialized', { config: this.config });
  }

  // =============================================================================
  // PUBLIC API - TASK PROCESSING
  // =============================================================================

  /**
   * Process batch of indicators in parallel
   */
  async processBatch(tasks: Array<{
    id: string;
    spec: any;
    data: OHLCV[];
    useCache: boolean;
  }>): Promise<Map<string, ProcessingResult>> {
    if (!this.config.enabled) {
      return this.processBatchSequentially(tasks);
    }

    const startTime = performance.now();
    const results = new Map<string, ProcessingResult>();
    
    try {
      // Convert to processing tasks
      const processingTasks: ProcessingTask[] = tasks.map((task, index) => ({
        id: `batch_${Date.now()}_${index}`,
        indicatorId: task.id,
        data: task.data,
        spec: task.spec,
        priority: task.spec.priority || 50,
        useCache: task.useCache,
        timeout: this.config.workerTimeout
      }));
      
      // Queue tasks
      processingTasks.forEach(task => this.queueTask(task));
      
      // Wait for all tasks to complete
      const taskPromises = processingTasks.map(task => 
        this.waitForTaskCompletion(task.id)
      );
      
      const taskResults = await Promise.allSettled(taskPromises);
      
      // Collect results
      taskResults.forEach((result, index) => {
        const indicatorId = processingTasks[index].indicatorId;
        
        if (result.status === 'fulfilled') {
          results.set(indicatorId, result.value);
        } else {
          results.set(indicatorId, {
            taskId: processingTasks[index].id,
            indicatorId,
            success: false,
            error: new Error(result.reason),
            fromCache: false,
            processingTime: 0
          });
        }
      });
      
      const batchTime = performance.now() - startTime;
      this.updateStats(batchTime, tasks.length);
      
      this.emit('batchCompleted', { 
        taskCount: tasks.length, 
        successCount: Array.from(results.values()).filter(r => r.success).length,
        processingTime: batchTime 
      });
      
      return results;
      
    } catch (error) {
      this.emit('batchError', { error, taskCount: tasks.length });
      throw error;
    }
  }

  /**
   * Process single task
   */
  async processTask(task: ProcessingTask): Promise<ProcessingResult> {
    if (!this.config.enabled) {
      return this.processTaskDirectly(task);
    }

    this.queueTask(task);
    return this.waitForTaskCompletion(task.id);
  }

  /**
   * Get current processing statistics
   */
  getStats(): ProcessingStats {
    this.updateUtilizationStats();
    return { ...this.stats };
  }

  /**
   * Get worker information
   */
  getWorkerInfo(): WorkerInfo[] {
    return Array.from(this.workers.values()).map(worker => ({
      ...worker,
      worker: undefined as any // Don't expose worker instance
    }));
  }

  /**
   * Scale worker pool
   */
  async scaleWorkers(targetCount: number): Promise<void> {
    const currentCount = this.workers.size;
    
    if (targetCount > currentCount) {
      // Add workers
      for (let i = currentCount; i < targetCount && i < this.config.maxConcurrency; i++) {
        await this.createWorker();
      }
    } else if (targetCount < currentCount) {
      // Remove workers (gracefully)
      const workersToRemove = currentCount - targetCount;
      const idleWorkers = Array.from(this.workers.values())
        .filter(w => !w.isActive)
        .slice(0, workersToRemove);
      
      for (const workerInfo of idleWorkers) {
        await this.terminateWorker(workerInfo.id);
      }
    }
    
    this.emit('workersScaled', { from: currentCount, to: this.workers.size });
  }

  /**
   * Shutdown parallel processing engine
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Clear worker cleanup interval
    if (this.workerCleanupInterval) {
      clearInterval(this.workerCleanupInterval);
    }
    
    // Wait for active tasks to complete or timeout
    const activeTaskPromises = Array.from(this.activeTasks.keys()).map(taskId =>
      this.waitForTaskCompletion(taskId, 5000).catch(() => null) // 5s timeout
    );
    
    await Promise.allSettled(activeTaskPromises);
    
    // Terminate all workers
    const terminationPromises = Array.from(this.workers.keys()).map(workerId =>
      this.terminateWorker(workerId)
    );
    
    await Promise.allSettled(terminationPromises);
    
    this.emit('shutdown');
  }

  // =============================================================================
  // PRIVATE METHODS - WORKER MANAGEMENT
  // =============================================================================

  private initializeWorkerPool(): void {
    const initialWorkerCount = Math.min(2, this.config.maxConcurrency);
    
    for (let i = 0; i < initialWorkerCount; i++) {
      this.createWorker().catch(error => {
        this.emit('workerCreationError', { error });
      });
    }
  }

  private async createWorker(): Promise<string> {
    if (this.workers.size >= this.config.maxConcurrency) {
      throw new Error('Maximum worker count reached');
    }

    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
      // Create worker with indicator processing code
      const worker = new Worker(__filename, {
        workerData: {
          workerId,
          isWorker: true
        }
      });
      
      const workerInfo: WorkerInfo = {
        id: workerId,
        worker,
        isActive: false,
        tasksCompleted: 0,
        totalProcessingTime: 0,
        lastActivity: new Date(),
        errors: 0
      };
      
      // Set up worker event handlers
      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });
      
      worker.on('error', (error) => {
        this.handleWorkerError(workerId, error);
      });
      
      worker.on('exit', (code) => {
        this.handleWorkerExit(workerId, code);
      });
      
      this.workers.set(workerId, workerInfo);
      
      this.emit('workerCreated', { workerId });
      
      return workerId;
      
    } catch (error) {
      this.emit('workerCreationError', { workerId, error });
      throw error;
    }
  }

  private async terminateWorker(workerId: string): Promise<void> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    try {
      // Graceful shutdown
      workerInfo.worker.postMessage({ type: 'shutdown' });
      
      // Wait briefly for graceful shutdown, then force terminate
      setTimeout(() => {
        if (this.workers.has(workerId)) {
          workerInfo.worker.terminate();
        }
      }, 1000);
      
    } catch (error) {
      this.emit('workerTerminationError', { workerId, error });
    } finally {
      this.workers.delete(workerId);
      this.emit('workerTerminated', { workerId });
    }
  }

  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    workerInfo.lastActivity = new Date();
    
    switch (message.type) {
      case 'taskCompleted':
        this.handleTaskCompleted(workerId, message);
        break;
        
      case 'taskError':
        this.handleTaskError(workerId, message);
        break;
        
      case 'ready':
        this.assignNextTask(workerId);
        break;
        
      default:
        this.emit('unknownWorkerMessage', { workerId, message });
    }
  }

  private handleWorkerError(workerId: string, error: Error): void {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.errors++;
      
      // If current task exists, mark it as failed
      if (workerInfo.currentTaskId) {
        const task = this.activeTasks.get(workerInfo.currentTaskId);
        if (task) {
          this.completeTask(workerInfo.currentTaskId, {
            taskId: workerInfo.currentTaskId,
            indicatorId: task.indicatorId,
            success: false,
            error,
            fromCache: false,
            processingTime: 0,
            workerId
          });
        }
      }
    }
    
    this.emit('workerError', { workerId, error });
    
    // Consider recreating worker if error rate is high
    if (workerInfo && workerInfo.errors > 5) {
      this.terminateWorker(workerId).then(() => {
        if (!this.isShuttingDown) {
          this.createWorker().catch(err => 
            this.emit('workerRecreationError', { workerId, error: err })
          );
        }
      });
    }
  }

  private handleWorkerExit(workerId: string, code: number): void {
    this.workers.delete(workerId);
    this.emit('workerExit', { workerId, code });
    
    // Recreate worker if not shutting down and exit was unexpected
    if (!this.isShuttingDown && code !== 0) {
      this.createWorker().catch(error => 
        this.emit('workerRecreationError', { workerId, error })
      );
    }
  }

  // =============================================================================
  // PRIVATE METHODS - TASK MANAGEMENT
  // =============================================================================

  private queueTask(task: ProcessingTask): void {
    if (this.taskQueue.length >= this.config.taskQueueLimit) {
      throw new Error('Task queue limit exceeded');
    }
    
    this.stats.totalTasks++;
    
    if (this.config.enableTaskPriority) {
      // Insert task in priority order
      const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }
    } else {
      this.taskQueue.push(task);
    }
    
    this.stats.queueLength = this.taskQueue.length;
    
    // Try to assign task immediately to available worker
    this.tryAssignTasks();
    
    this.emit('taskQueued', { taskId: task.id, queueLength: this.taskQueue.length });
  }

  private tryAssignTasks(): void {
    const availableWorkers = Array.from(this.workers.values())
      .filter(w => !w.isActive);
    
    while (this.taskQueue.length > 0 && availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!;
      const worker = availableWorkers.shift()!;
      
      this.assignTaskToWorker(task, worker);
    }
    
    this.stats.queueLength = this.taskQueue.length;
  }

  private assignNextTask(workerId: string): void {
    if (this.taskQueue.length === 0) return;
    
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo || workerInfo.isActive) return;
    
    const task = this.taskQueue.shift()!;
    this.assignTaskToWorker(task, workerInfo);
  }

  private assignTaskToWorker(task: ProcessingTask, workerInfo: WorkerInfo): void {
    workerInfo.isActive = true;
    workerInfo.currentTaskId = task.id;
    workerInfo.lastActivity = new Date();
    
    this.activeTasks.set(task.id, task);
    
    // Send task to worker
    workerInfo.worker.postMessage({
      type: 'processTask',
      task: {
        ...task,
        // Don't send the actual spec object, just the necessary data
        spec: {
          id: task.spec.id,
          name: task.spec.name,
          config: task.spec.config
        }
      }
    });
    
    this.emit('taskAssigned', { taskId: task.id, workerId: workerInfo.id });
    
    // Set timeout for task
    const timeout = task.timeout || this.config.workerTimeout;
    setTimeout(() => {
      if (this.activeTasks.has(task.id)) {
        this.handleTaskTimeout(task.id, workerInfo.id);
      }
    }, timeout);
  }

  private handleTaskCompleted(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    const result: ProcessingResult = message.result;
    
    workerInfo.isActive = false;
    workerInfo.currentTaskId = undefined;
    workerInfo.tasksCompleted++;
    workerInfo.totalProcessingTime += result.processingTime;
    
    this.completeTask(result.taskId, result);
    
    // Try to assign next task
    this.assignNextTask(workerId);
  }

  private handleTaskError(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    const result: ProcessingResult = message.result;
    
    workerInfo.isActive = false;
    workerInfo.currentTaskId = undefined;
    workerInfo.errors++;
    
    this.completeTask(result.taskId, result);
    
    // Try to assign next task
    this.assignNextTask(workerId);
  }

  private handleTaskTimeout(taskId: string, workerId: string): void {
    const task = this.activeTasks.get(taskId);
    const workerInfo = this.workers.get(workerId);
    
    if (task && workerInfo) {
      const result: ProcessingResult = {
        taskId,
        indicatorId: task.indicatorId,
        success: false,
        error: new Error('Task timeout'),
        fromCache: false,
        processingTime: task.timeout || this.config.workerTimeout,
        workerId
      };
      
      this.completeTask(taskId, result);
      
      // Reset worker state
      workerInfo.isActive = false;
      workerInfo.currentTaskId = undefined;
      
      this.emit('taskTimeout', { taskId, workerId });
    }
  }

  private completeTask(taskId: string, result: ProcessingResult): void {
    this.activeTasks.delete(taskId);
    this.completedTasks.push(result);
    
    // Limit completed tasks history
    if (this.completedTasks.length > 1000) {
      this.completedTasks.splice(0, 100);
    }
    
    if (result.success) {
      this.stats.completedTasks++;
    } else {
      this.stats.failedTasks++;
    }
    
    this.emit('taskCompleted', { result });
  }

  private waitForTaskCompletion(taskId: string, timeout?: number): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.config.workerTimeout * 2;
      let timeoutHandle: NodeJS.Timeout;
      
      const checkCompletion = () => {
        const result = this.completedTasks.find(r => r.taskId === taskId);
        if (result) {
          clearTimeout(timeoutHandle);
          resolve(result);
          return;
        }
        
        // Check again in a bit
        setTimeout(checkCompletion, 50);
      };
      
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Task ${taskId} completion timeout`));
      }, timeoutMs);
      
      checkCompletion();
    });
  }

  // =============================================================================
  // PRIVATE METHODS - FALLBACK PROCESSING
  // =============================================================================

  private async processBatchSequentially(
    tasks: Array<{ id: string; spec: any; data: OHLCV[]; useCache: boolean }>
  ): Promise<Map<string, ProcessingResult>> {
    const results = new Map<string, ProcessingResult>();
    
    for (const task of tasks) {
      try {
        const startTime = performance.now();
        
        // Direct indicator calculation
        const indicator = task.spec.instance;
        const value = indicator.calculate(task.data);
        
        const processingTime = performance.now() - startTime;
        
        results.set(task.id, {
          taskId: task.id,
          indicatorId: task.id,
          success: true,
          value,
          fromCache: false,
          processingTime
        });
        
      } catch (error) {
        results.set(task.id, {
          taskId: task.id,
          indicatorId: task.id,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          fromCache: false,
          processingTime: 0
        });
      }
    }
    
    return results;
  }

  private async processTaskDirectly(task: ProcessingTask): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Direct calculation
      const indicator = task.spec.instance;
      const value = indicator.calculate(task.data);
      
      const processingTime = performance.now() - startTime;
      
      return {
        taskId: task.id,
        indicatorId: task.indicatorId,
        success: true,
        value,
        fromCache: false,
        processingTime
      };
      
    } catch (error) {
      return {
        taskId: task.id,
        indicatorId: task.indicatorId,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
        processingTime: performance.now() - startTime
      };
    }
  }

  // =============================================================================
  // PRIVATE METHODS - UTILITIES
  // =============================================================================

  private startWorkerManagement(): void {
    // Periodic worker cleanup and management
    this.workerCleanupInterval = setInterval(() => {
      this.performWorkerMaintenance();
    }, 60000); // Every minute
  }

  private performWorkerMaintenance(): void {
    const now = Date.now();
    const idleTimeout = this.config.workerIdleTimeout;
    
    // Remove idle workers if we have more than minimum
    const minWorkers = Math.min(1, this.config.maxConcurrency);
    const idleWorkers = Array.from(this.workers.values())
      .filter(w => !w.isActive && (now - w.lastActivity.getTime()) > idleTimeout);
    
    if (this.workers.size > minWorkers && idleWorkers.length > 0) {
      const workersToRemove = Math.min(
        idleWorkers.length,
        this.workers.size - minWorkers
      );
      
      for (let i = 0; i < workersToRemove; i++) {
        this.terminateWorker(idleWorkers[i].id);
      }
    }
    
    // Scale up if queue is getting large
    if (this.taskQueue.length > this.workers.size && this.workers.size < this.config.maxConcurrency) {
      this.createWorker().catch(error => 
        this.emit('workerCreationError', { error })
      );
    }
  }

  private updateStats(processingTime: number, taskCount: number): void {
    const totalTime = this.stats.averageProcessingTime * this.stats.completedTasks + processingTime;
    this.stats.averageProcessingTime = totalTime / (this.stats.completedTasks + taskCount);
    
    // Update throughput (simple moving average)
    const completedInLastMinute = this.completedTasks.filter(
      r => Date.now() - new Date(r.processingTime).getTime() < 60000
    ).length;
    this.stats.throughput = completedInLastMinute / 60; // per second
  }

  private updateUtilizationStats(): void {
    const activeWorkers = Array.from(this.workers.values()).filter(w => w.isActive).length;
    this.stats.workerUtilization = this.workers.size > 0 ? activeWorkers / this.workers.size : 0;
  }

  private mergeConfig(config: Partial<ParallelProcessingConfig>): ParallelProcessingConfig {
    return {
      maxConcurrency: config.maxConcurrency ?? 4,
      enabled: config.enabled ?? true,
      workerTimeout: config.workerTimeout ?? 30000, // 30 seconds
      taskQueueLimit: config.taskQueueLimit ?? 1000,
      enableTaskPriority: config.enableTaskPriority ?? true,
      workerIdleTimeout: config.workerIdleTimeout ?? 300000 // 5 minutes
    };
  }
}

// =============================================================================
// WORKER THREAD CODE
// =============================================================================

// This section runs in worker threads
if (!isMainThread && parentPort && workerData?.isWorker) {
  const workerId = workerData.workerId;
  
  parentPort.on('message', async (message) => {
    switch (message.type) {
      case 'processTask':
        await processTaskInWorker(message.task);
        break;
        
      case 'shutdown':
        process.exit(0);
        break;
    }
  });
  
  async function processTaskInWorker(task: ProcessingTask) {
    const startTime = performance.now();
    
    try {
      // In a real implementation, this would load and execute the indicator
      // For now, we'll simulate processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 10));
      
      const processingTime = performance.now() - startTime;
      
      const result: ProcessingResult = {
        taskId: task.id,
        indicatorId: task.indicatorId,
        success: true,
        value: {
          value: Math.random() * 100, // Simulated result
          timestamp: new Date(),
          isValid: true,
          confidence: 0.8
        },
        fromCache: false,
        processingTime,
        workerId
      };
      
      parentPort!.postMessage({
        type: 'taskCompleted',
        result
      });
      
    } catch (error) {
      const result: ProcessingResult = {
        taskId: task.id,
        indicatorId: task.indicatorId,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
        processingTime: performance.now() - startTime,
        workerId
      };
      
      parentPort!.postMessage({
        type: 'taskError',
        result
      });
    }
  }
  
  // Signal worker is ready
  parentPort.postMessage({ type: 'ready' });
}

export default ParallelProcessingEngine;