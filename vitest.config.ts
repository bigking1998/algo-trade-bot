import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/globalSetup.ts'],
    
    // Coverage configuration for comprehensive testing
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './test-results/coverage',
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/build/**'
      ],
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 80,
        statements: 85,
      },
      all: true,
      clean: true,
    },
    
    // Performance and reliability settings
    testTimeout: 60000,      // 60 seconds for individual tests
    hookTimeout: 30000,      // 30 seconds for hooks
    teardownTimeout: 30000,  // 30 seconds for teardown
    
    // Parallel execution configuration
    maxConcurrency: 4,
    minThreads: 1,
    maxThreads: 4,
    
    // Reporter configuration
    reporter: process.env.CI ? ['verbose', 'json', 'junit'] : ['verbose'],
    outputFile: {
      json: './test-results/test-results.json',
      junit: './test-results/junit.xml'
    },
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'src/test/**/*.test.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'src/test/config/**',
      'src/test/utils/**'
    ],
    
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITE_APP_ENV: 'test'
    },
    
    // Mock configuration  
    server: {
      deps: {
        external: ['@tensorflow/tfjs']
      }
    },
    
    // Test sequencing - run tests in specific order for dependencies
    sequence: {
      hooks: 'stack',
      setupFiles: 'list'
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/backend': path.resolve(__dirname, './src/backend'),
      '@/frontend': path.resolve(__dirname, './src/frontend'),
      '@/test': path.resolve(__dirname, './src/test'),
    },
  },
  
  // Vite configuration for testing
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  
  // Build configuration for test assets
  build: {
    sourcemap: true,
    minify: false,
  }
})
