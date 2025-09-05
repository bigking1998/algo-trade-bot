/**
 * Global Test Setup - Task TE-001
 * 
 * Global setup for comprehensive testing framework.
 * This file is loaded before any test files and sets up the testing environment.
 */

import { TestSuiteConfiguration, globalTestHooks } from './config/TestConfiguration';

// Global setup before all tests
async function setup() {
  console.log('🚀 Initializing Comprehensive Testing Framework...');
  
  try {
    await globalTestHooks.beforeAll();
    console.log('✅ Testing framework initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize testing framework:', error);
    throw error;
  }
}

// Global teardown after all tests
async function teardown() {
  console.log('🧹 Cleaning up testing framework...');
  
  try {
    await globalTestHooks.afterAll();
    console.log('✅ Testing framework cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup testing framework:', error);
    // Don't throw here to avoid masking test results
  }
}

// Export setup/teardown functions for vitest
export { setup, teardown };

// Configure global test hooks for vitest
if (typeof globalThis !== 'undefined') {
  // Store original test function to wrap it
  const originalTest = globalThis.test;
  
  if (originalTest) {
    globalThis.test = function(name: string, fn: Function, timeout?: number) {
      return originalTest(name, async function(this: any) {
        await globalTestHooks.beforeEach(name);
        
        let result: 'passed' | 'failed' | 'skipped' = 'passed';
        
        try {
          const fnResult = fn.call(this);
          if (fnResult && typeof fnResult.then === 'function') {
            await fnResult;
          }
        } catch (error) {
          result = 'failed';
          throw error;
        } finally {
          await globalTestHooks.afterEach(name, result);
        }
      }, timeout);
    };
    
    // Copy properties from original test function
    Object.setPrototypeOf(globalThis.test, originalTest);
    Object.defineProperty(globalThis.test, 'skip', { value: originalTest.skip });
    Object.defineProperty(globalThis.test, 'only', { value: originalTest.only });
    Object.defineProperty(globalThis.test, 'todo', { value: originalTest.todo });
    Object.defineProperty(globalThis.test, 'each', { value: originalTest.each });
  }
}

// Initialize immediately when module is loaded
setup().catch(error => {
  console.error('Failed to setup testing framework:', error);
  process.exit(1);
});

// Setup cleanup on process exit
process.on('exit', () => {
  teardown().catch(() => {
    // Ignore cleanup errors on exit
  });
});

process.on('SIGTERM', async () => {
  await teardown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await teardown();
  process.exit(0);
});