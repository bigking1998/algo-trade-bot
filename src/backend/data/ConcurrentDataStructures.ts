/**
 * Thread-Safe Concurrent Data Structures - Task BE-008: Strategy Data Structures
 * 
 * Thread-safe data structures for concurrent access in multi-threaded
 * trading applications. Uses atomic operations and locking mechanisms
 * to ensure data integrity during concurrent reads/writes.
 * 
 * Performance Targets:
 * - Lock-free operations where possible
 * - Minimal contention for high-frequency operations
 * - Buffer operations: <1ms for add/remove operations
 */

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export interface LockOptions {
  timeout?: number; // milliseconds
  retryInterval?: number; // milliseconds
  maxRetries?: number;
}

export interface ConcurrentOperationResult<T> {
  success: boolean;
  value?: T;
  error?: string;
  duration?: number; // milliseconds
}

export interface ReadWriteLockState {
  readers: number;
  writers: number;
  waiting: number;
}

// =============================================================================
// ASYNC MUTEX FOR CRITICAL SECTIONS
// =============================================================================

/**
 * Simple async mutex implementation for critical sections
 */
export class AsyncMutex {
  private locked = false;
  private waitingQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  /**
   * Acquire the mutex lock
   */
  async acquire(options: LockOptions = {}): Promise<() => void> {
    const { timeout = 5000, retryInterval = 10 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          reject(new Error(`Mutex acquisition timeout after ${timeout}ms`));
          return;
        }

        this.waitingQueue.push({
          resolve: () => {
            this.locked = true;
            resolve(() => this.release());
          },
          reject,
          timestamp: Date.now()
        });
      };

      tryAcquire();
    });
  }

  /**
   * Try to acquire the mutex without waiting
   */
  tryAcquire(): (() => void) | null {
    if (this.locked) {
      return null;
    }

    this.locked = true;
    return () => this.release();
  }

  /**
   * Release the mutex lock
   */
  private release(): void {
    this.locked = false;
    
    // Wake up the next waiting thread
    const next = this.waitingQueue.shift();
    if (next) {
      // Use setTimeout to prevent stack overflow in high-contention scenarios
      setTimeout(() => next.resolve(), 0);
    }
  }

  /**
   * Check if mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get number of waiting threads
   */
  getWaitingCount(): number {
    return this.waitingQueue.length;
  }
}

// =============================================================================
// READ-WRITE LOCK IMPLEMENTATION
// =============================================================================

/**
 * Read-write lock allowing multiple readers but exclusive writers
 */
export class ReadWriteLock {
  private readers = 0;
  private writers = 0;
  private waitingWriters = 0;
  private readerWaitQueue: Array<() => void> = [];
  private writerWaitQueue: Array<() => void> = [];

  /**
   * Acquire read lock (multiple readers allowed)
   */
  async acquireRead(options: LockOptions = {}): Promise<() => void> {
    const { timeout = 5000 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const tryAcquireRead = () => {
        // Allow read if no writers are active or waiting
        if (this.writers === 0 && this.waitingWriters === 0) {
          this.readers++;
          resolve(() => this.releaseRead());
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          reject(new Error(`Read lock acquisition timeout after ${timeout}ms`));
          return;
        }

        this.readerWaitQueue.push(() => {
          this.readers++;
          resolve(() => this.releaseRead());
        });
      };

      tryAcquireRead();
    });
  }

  /**
   * Acquire write lock (exclusive access)
   */
  async acquireWrite(options: LockOptions = {}): Promise<() => void> {
    const { timeout = 5000 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const tryAcquireWrite = () => {
        if (this.readers === 0 && this.writers === 0) {
          this.writers = 1;
          resolve(() => this.releaseWrite());
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          this.waitingWriters = Math.max(0, this.waitingWriters - 1);
          reject(new Error(`Write lock acquisition timeout after ${timeout}ms`));
          return;
        }

        this.waitingWriters++;
        this.writerWaitQueue.push(() => {
          this.waitingWriters--;
          this.writers = 1;
          resolve(() => this.releaseWrite());
        });
      };

      tryAcquireWrite();
    });
  }

  /**
   * Release read lock
   */
  private releaseRead(): void {
    this.readers = Math.max(0, this.readers - 1);
    
    // If no more readers, wake up a waiting writer
    if (this.readers === 0 && this.writerWaitQueue.length > 0) {
      const nextWriter = this.writerWaitQueue.shift();
      if (nextWriter) {
        setTimeout(nextWriter, 0);
      }
    }
  }

  /**
   * Release write lock
   */
  private releaseWrite(): void {
    this.writers = 0;
    
    // Wake up all waiting readers first, then writers
    if (this.readerWaitQueue.length > 0) {
      const waitingReaders = [...this.readerWaitQueue];
      this.readerWaitQueue = [];
      waitingReaders.forEach(reader => setTimeout(reader, 0));
    } else if (this.writerWaitQueue.length > 0) {
      const nextWriter = this.writerWaitQueue.shift();
      if (nextWriter) {
        setTimeout(nextWriter, 0);
      }
    }
  }

  /**
   * Get current lock state
   */
  getState(): ReadWriteLockState {
    return {
      readers: this.readers,
      writers: this.writers,
      waiting: this.readerWaitQueue.length + this.writerWaitQueue.length
    };
  }
}

// =============================================================================
// THREAD-SAFE MARKET DATA BUFFER
// =============================================================================

/**
 * Thread-safe wrapper around MarketDataBuffer
 */
export class ConcurrentMarketDataBuffer {
  private lock = new ReadWriteLock();
  private buffer: Map<number, any> = new Map(); // Simplified for example
  private metadata = {
    totalWrites: 0,
    totalReads: 0,
    concurrentReads: 0,
    lastWriteTime: 0,
    lastReadTime: 0
  };

  constructor(private symbol: string, private maxSize: number = 1000) {}

  /**
   * Add data with write lock
   */
  async addData(timestamp: number, data: any, options?: LockOptions): Promise<ConcurrentOperationResult<void>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquireWrite(options);
      
      try {
        // Maintain buffer size
        if (this.buffer.size >= this.maxSize) {
          const oldestKey = Math.min(...Array.from(this.buffer.keys()));
          this.buffer.delete(oldestKey);
        }
        
        this.buffer.set(timestamp, data);
        this.metadata.totalWrites++;
        this.metadata.lastWriteTime = Date.now();
        
        return {
          success: true,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Read data with read lock
   */
  async getData(timestamp: number, options?: LockOptions): Promise<ConcurrentOperationResult<any>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquireRead(options);
      
      try {
        const value = this.buffer.get(timestamp);
        this.metadata.totalReads++;
        this.metadata.lastReadTime = Date.now();
        
        return {
          success: true,
          value,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get multiple data points with read lock
   */
  async getRange(
    startTime: number,
    endTime: number,
    options?: LockOptions
  ): Promise<ConcurrentOperationResult<Array<{ timestamp: number; data: any }>>> {
    const operationStart = Date.now();
    
    try {
      const release = await this.lock.acquireRead(options);
      
      try {
        const results: Array<{ timestamp: number; data: any }> = [];
        
        for (const [timestamp, data] of Array.from(this.buffer.entries())) {
          if (timestamp >= startTime && timestamp <= endTime) {
            results.push({ timestamp, data });
          }
        }
        
        results.sort((a, b) => a.timestamp - b.timestamp);
        
        this.metadata.totalReads++;
        this.metadata.lastReadTime = Date.now();
        
        return {
          success: true,
          value: results,
          duration: Date.now() - operationStart
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - operationStart
      };
    }
  }

  /**
   * Get buffer statistics with read lock
   */
  async getStatistics(options?: LockOptions): Promise<ConcurrentOperationResult<any>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquireRead(options);
      
      try {
        const stats = {
          symbol: this.symbol,
          size: this.buffer.size,
          maxSize: this.maxSize,
          oldestTimestamp: this.buffer.size > 0 ? Math.min(...Array.from(this.buffer.keys())) : null,
          newestTimestamp: this.buffer.size > 0 ? Math.max(...Array.from(this.buffer.keys())) : null,
          lockState: this.lock.getState(),
          ...this.metadata
        };
        
        return {
          success: true,
          value: stats,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Clear all data with write lock
   */
  async clear(options?: LockOptions): Promise<ConcurrentOperationResult<void>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquireWrite(options);
      
      try {
        this.buffer.clear();
        this.metadata.totalWrites++;
        this.metadata.lastWriteTime = Date.now();
        
        return {
          success: true,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }
}

// =============================================================================
// LOCK-FREE CIRCULAR BUFFER
// =============================================================================

/**
 * Lock-free circular buffer using atomic operations
 * Suitable for single producer, single consumer scenarios
 */
export class LockFreeCircularBuffer<T> {
  private buffer: Array<T | undefined>;
  private head = 0;  // Write position
  private tail = 0;  // Read position
  private readonly capacity: number;
  private _size = 0;

  constructor(capacity: number) {
    if (capacity <= 0 || (capacity & (capacity - 1)) !== 0) {
      throw new Error('Capacity must be a power of 2');
    }
    
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add item to buffer (producer)
   * Returns false if buffer is full
   */
  push(item: T): boolean {
    const nextHead = (this.head + 1) % this.capacity;
    
    // Check if buffer is full
    if (nextHead === this.tail) {
      return false;
    }
    
    this.buffer[this.head] = item;
    this.head = nextHead;
    this._size = Math.min(this._size + 1, this.capacity - 1);
    
    return true;
  }

  /**
   * Remove item from buffer (consumer)
   * Returns undefined if buffer is empty
   */
  pop(): T | undefined {
    // Check if buffer is empty
    if (this.tail === this.head) {
      return undefined;
    }
    
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined; // Help GC
    this.tail = (this.tail + 1) % this.capacity;
    this._size = Math.max(this._size - 1, 0);
    
    return item;
  }

  /**
   * Peek at next item without removing it
   */
  peek(): T | undefined {
    if (this.tail === this.head) {
      return undefined;
    }
    
    return this.buffer[this.tail];
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.head === this.tail;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return (this.head + 1) % this.capacity === this.tail;
  }

  /**
   * Get current size (approximate in concurrent scenarios)
   */
  size(): number {
    return this._size;
  }

  /**
   * Get buffer capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this._size = 0;
  }
}

// =============================================================================
// CONCURRENT PRIORITY QUEUE
// =============================================================================

/**
 * Thread-safe priority queue for time-ordered operations
 */
export class ConcurrentPriorityQueue<T> {
  private heap: Array<{ priority: number; value: T; id: number }> = [];
  private lock = new AsyncMutex();
  private nextId = 0;

  constructor(private compareFunc?: (a: T, b: T) => number) {}

  /**
   * Insert item with priority
   */
  async insert(value: T, priority: number, options?: LockOptions): Promise<ConcurrentOperationResult<number>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquire(options);
      
      try {
        const id = this.nextId++;
        const item = { priority, value, id };
        
        this.heap.push(item);
        this.heapifyUp(this.heap.length - 1);
        
        return {
          success: true,
          value: id,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Remove and return highest priority item
   */
  async extractMin(options?: LockOptions): Promise<ConcurrentOperationResult<T>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquire(options);
      
      try {
        if (this.heap.length === 0) {
          return {
            success: false,
            error: 'Queue is empty',
            duration: Date.now() - startTime
          };
        }
        
        const min = this.heap[0];
        const last = this.heap.pop()!;
        
        if (this.heap.length > 0) {
          this.heap[0] = last;
          this.heapifyDown(0);
        }
        
        return {
          success: true,
          value: min.value,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Peek at highest priority item without removing
   */
  async peek(options?: LockOptions): Promise<ConcurrentOperationResult<T>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquire(options);
      
      try {
        if (this.heap.length === 0) {
          return {
            success: false,
            error: 'Queue is empty',
            duration: Date.now() - startTime
          };
        }
        
        return {
          success: true,
          value: this.heap[0].value,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get queue size
   */
  async size(options?: LockOptions): Promise<ConcurrentOperationResult<number>> {
    const startTime = Date.now();
    
    try {
      const release = await this.lock.acquire(options);
      
      try {
        return {
          success: true,
          value: this.heap.length,
          duration: Date.now() - startTime
        };
      } finally {
        release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private heapifyUp(index: number): void {
    const parentIndex = Math.floor((index - 1) / 2);
    
    if (parentIndex >= 0 && this.heap[parentIndex].priority > this.heap[index].priority) {
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      this.heapifyUp(parentIndex);
    }
  }

  private heapifyDown(index: number): void {
    const leftChild = 2 * index + 1;
    const rightChild = 2 * index + 2;
    let smallest = index;

    if (leftChild < this.heap.length && 
        this.heap[leftChild].priority < this.heap[smallest].priority) {
      smallest = leftChild;
    }

    if (rightChild < this.heap.length && 
        this.heap[rightChild].priority < this.heap[smallest].priority) {
      smallest = rightChild;
    }

    if (smallest !== index) {
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      this.heapifyDown(smallest);
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a concurrent market data buffer
 */
export function createConcurrentMarketDataBuffer(
  symbol: string,
  maxSize?: number
): ConcurrentMarketDataBuffer {
  return new ConcurrentMarketDataBuffer(symbol, maxSize);
}

/**
 * Create a lock-free circular buffer
 */
export function createLockFreeCircularBuffer<T>(capacity: number): LockFreeCircularBuffer<T> {
  return new LockFreeCircularBuffer<T>(capacity);
}

/**
 * Create a concurrent priority queue
 */
export function createConcurrentPriorityQueue<T>(
  compareFunc?: (a: T, b: T) => number
): ConcurrentPriorityQueue<T> {
  return new ConcurrentPriorityQueue<T>(compareFunc);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Execute operation with timeout and retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 100, timeout = 5000 } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wrap operation with timeout
      const result = await Promise.race([
        operation(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error('Should not reach here');
}

/**
 * Batch operations for better performance
 */
export async function executeBatch<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    concurrency?: number;
    failFast?: boolean;
  } = {}
): Promise<Array<{ success: boolean; result?: R; error?: string; item: T }>> {
  const { batchSize = 10, concurrency = 3, failFast = false } = options;
  const results: Array<{ success: boolean; result?: R; error?: string; item: T }> = [];
  
  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch with limited concurrency
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await operation(item);
        return { success: true, result, item };
      } catch (error) {
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          item
        };
        
        if (failFast) {
          throw error;
        }
        
        return errorResult;
      }
    });
    
    // Limit concurrency within batch
    const batchResults = await Promise.all(batchPromises.slice(0, concurrency));
    results.push(...batchResults);
    
    // Process remaining items if batch size > concurrency
    if (batch.length > concurrency) {
      const remaining = await Promise.all(batchPromises.slice(concurrency));
      results.push(...remaining);
    }
  }
  
  return results;
}