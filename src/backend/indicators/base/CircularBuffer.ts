/**
 * CircularBuffer Implementation - Task BE-010
 * 
 * High-performance circular buffer implementation for efficient memory management
 * in streaming technical indicator calculations. Optimized for real-time trading
 * applications with minimal memory allocation and garbage collection overhead.
 */

import { CircularBuffer } from './types.js';

/**
 * Efficient circular buffer implementation with O(1) operations
 * Uses fixed-size array with head/tail pointers for optimal performance
 */
export class CircularBufferImpl<T> implements CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;        // Points to the next write position
  private tail = 0;        // Points to the oldest element
  protected count = 0;       // Current number of elements
  private readonly maxSize: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Circular buffer capacity must be positive');
    }
    
    this.maxSize = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add new value to buffer with O(1) complexity
   * Overwrites oldest value when buffer is full
   */
  push(value: T): void {
    this.buffer[this.head] = value;
    
    if (this.count < this.maxSize) {
      this.count++;
    } else {
      // Buffer is full, advance tail to maintain window size
      this.tail = (this.tail + 1) % this.maxSize;
    }
    
    this.head = (this.head + 1) % this.maxSize;
  }

  /**
   * Get value at specific index with O(1) complexity
   * Index 0 = most recent, index (size-1) = oldest
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined;
    }
    
    // Calculate actual buffer position
    // Most recent is at (head - 1), oldest at tail
    const actualIndex = (this.head - 1 - index + this.maxSize) % this.maxSize;
    return this.buffer[actualIndex];
  }

  /**
   * Get all values in chronological order (oldest to newest)
   * Returns new array to prevent external mutation
   */
  getAll(): T[] {
    if (this.count === 0) {
      return [];
    }
    
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.tail + i) % this.maxSize;
      const value = this.buffer[index];
      if (value !== undefined) {
        result.push(value);
      }
    }
    
    return result;
  }

  /**
   * Get values in reverse chronological order (newest to oldest)
   * Optimized for indicator calculations that process recent data first
   */
  getAllReversed(): T[] {
    if (this.count === 0) {
      return [];
    }
    
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const value = this.buffer[index];
      if (value !== undefined) {
        result.push(value);
      }
    }
    
    return result;
  }

  /**
   * Get sliding window of specified size starting from most recent
   * Returns empty array if not enough data
   */
  getWindow(windowSize: number): T[] {
    if (windowSize <= 0 || windowSize > this.count) {
      return [];
    }
    
    const result: T[] = [];
    for (let i = 0; i < windowSize; i++) {
      const index = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const value = this.buffer[index];
      if (value !== undefined) {
        result.unshift(value); // Build in chronological order
      }
    }
    
    return result;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.count;
  }

  /**
   * Get maximum buffer capacity
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Clear all values and reset pointers
   */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Check if buffer has reached maximum capacity
   */
  isFull(): boolean {
    return this.count === this.maxSize;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Get the most recent value (index 0)
   */
  latest(): T | undefined {
    return this.get(0);
  }

  /**
   * Get the oldest value in the buffer
   */
  oldest(): T | undefined {
    return this.get(this.count - 1);
  }

  /**
   * Peek at the next value that would be overwritten
   * Useful for delta calculations in streaming updates
   */
  peekNext(): T | undefined {
    if (!this.isFull()) {
      return undefined;
    }
    return this.buffer[this.head];
  }

  /**
   * Get buffer utilization as percentage (0-1)
   */
  utilization(): number {
    return this.count / this.maxSize;
  }

  /**
   * Create a new buffer with the same data but different capacity
   * Preserves most recent values if new capacity is smaller
   */
  resize(newCapacity: number): CircularBufferImpl<T> {
    if (newCapacity <= 0) {
      throw new Error('New capacity must be positive');
    }
    
    const newBuffer = new CircularBufferImpl<T>(newCapacity);
    const values = this.getAllReversed(); // Most recent first
    
    // Add values starting with most recent, up to new capacity
    const valuesToCopy = Math.min(values.length, newCapacity);
    for (let i = valuesToCopy - 1; i >= 0; i--) {
      newBuffer.push(values[i]);
    }
    
    return newBuffer;
  }

  /**
   * Create a snapshot of the current buffer state
   * Useful for debugging and testing
   */
  snapshot(): {
    buffer: (T | undefined)[];
    head: number;
    tail: number;
    count: number;
    capacity: number;
  } {
    return {
      buffer: [...this.buffer],
      head: this.head,
      tail: this.tail,
      count: this.count,
      capacity: this.maxSize
    };
  }

  /**
   * Apply a function to each value in the buffer
   * Processes values in chronological order (oldest to newest)
   */
  forEach(callback: (value: T, index: number) => void): void {
    for (let i = 0; i < this.count; i++) {
      const bufferIndex = (this.tail + i) % this.maxSize;
      const value = this.buffer[bufferIndex];
      if (value !== undefined) {
        callback(value, i);
      }
    }
  }

  /**
   * Map function over all values in the buffer
   * Returns new array with transformed values
   */
  map<U>(callback: (value: T, index: number) => U): U[] {
    const result: U[] = [];
    this.forEach((value, index) => {
      result.push(callback(value, index));
    });
    return result;
  }

  /**
   * Reduce all values in the buffer to a single value
   * Processes values in chronological order
   */
  reduce<U>(callback: (accumulator: U, value: T, index: number) => U, initialValue: U): U {
    let accumulator = initialValue;
    this.forEach((value, index) => {
      accumulator = callback(accumulator, value, index);
    });
    return accumulator;
  }

  /**
   * Find first value matching predicate
   */
  find(predicate: (value: T, index: number) => boolean): T | undefined {
    for (let i = 0; i < this.count; i++) {
      const bufferIndex = (this.tail + i) % this.maxSize;
      const value = this.buffer[bufferIndex];
      if (value !== undefined && predicate(value, i)) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Check if any value matches predicate
   */
  some(predicate: (value: T, index: number) => boolean): boolean {
    return this.find(predicate) !== undefined;
  }

  /**
   * Check if all values match predicate
   */
  every(predicate: (value: T, index: number) => boolean): boolean {
    for (let i = 0; i < this.count; i++) {
      const bufferIndex = (this.tail + i) % this.maxSize;
      const value = this.buffer[bufferIndex];
      if (value !== undefined && !predicate(value, i)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Convert buffer to string for debugging
   */
  toString(): string {
    const values = this.getAll();
    return `CircularBuffer(${this.count}/${this.maxSize}): [${values.join(', ')}]`;
  }
}

/**
 * Factory function to create typed circular buffers
 */
export function createCircularBuffer<T>(capacity: number): CircularBuffer<T> {
  return new CircularBufferImpl<T>(capacity);
}

/**
 * Specialized circular buffer for numeric values with built-in math operations
 */
export class NumericCircularBuffer extends CircularBufferImpl<number> {
  /**
   * Calculate sum of all values in buffer
   */
  sum(): number {
    return this.reduce((acc, value) => acc + value, 0);
  }

  /**
   * Calculate arithmetic mean of all values
   */
  mean(): number {
    return this.count > 0 ? this.sum() / this.count : 0;
  }

  /**
   * Find minimum value in buffer
   */
  min(): number | undefined {
    if (this.count === 0) return undefined;
    
    let min = this.get(0)!;
    for (let i = 1; i < this.count; i++) {
      const value = this.get(i)!;
      if (value < min) {
        min = value;
      }
    }
    return min;
  }

  /**
   * Find maximum value in buffer
   */
  max(): number | undefined {
    if (this.count === 0) return undefined;
    
    let max = this.get(0)!;
    for (let i = 1; i < this.count; i++) {
      const value = this.get(i)!;
      if (value > max) {
        max = value;
      }
    }
    return max;
  }

  /**
   * Calculate standard deviation
   */
  standardDeviation(): number {
    if (this.count < 2) return 0;
    
    const mean = this.mean();
    const squaredDeviations = this.map(value => Math.pow(value - mean, 2));
    const variance = squaredDeviations.reduce((acc, val) => acc + val, 0) / (this.count - 1);
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate simple moving average for the current window
   */
  sma(): number {
    return this.mean();
  }

  /**
   * Calculate exponential moving average with specified smoothing factor
   */
  ema(smoothingFactor?: number): number {
    if (this.count === 0) return 0;
    if (this.count === 1) return this.get(0)!;
    
    const alpha = smoothingFactor ?? (2 / (this.count + 1));
    const values = this.getAll();
    
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }
    
    return ema;
  }
}