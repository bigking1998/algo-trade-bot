import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/postcss'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // Force Tailwind v4 plugin to handle `@import "tailwindcss"` before any other import plugins
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/backend': path.resolve(__dirname, './src/backend'),
      '@/frontend': path.resolve(__dirname, './src/frontend'),
      'components': path.resolve(__dirname, './src/frontend/components'),
      'lib': path.resolve(__dirname, './src/frontend/lib'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  
  // Test configuration for Vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/test/**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    teardownTimeout: 30000,
    // Performance and memory settings for integration tests
    maxConcurrency: 4,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
      ],
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 80,
        statements: 85
      }
    },
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/results.json'
    }
  }
})
