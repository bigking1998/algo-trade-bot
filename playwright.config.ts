import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for TE-011: End-to-End Testing Suite
 * 
 * Configures cross-browser testing, mobile testing, and other E2E test settings
 * for comprehensive test coverage across different environments.
 */
export default defineConfig({
  // Test directory
  testDir: './src/test/__tests__',
  
  // Test file pattern
  testMatch: /TE-011-EndToEndTestingSuite\.test\.ts/,
  
  // Timeout settings
  timeout: 30000,
  expect: { timeout: 10000 },
  
  // Global test setup
  globalSetup: require.resolve('./src/test/setup/global-setup.ts'),
  globalTeardown: require.resolve('./src/test/setup/global-teardown.ts'),
  
  // Test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }]
  ],
  
  // Global test settings
  use: {
    // Base URL for tests
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    
    // Browser settings
    headless: !!process.env.CI,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Screenshots and videos
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Test artifacts
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Browser configurations for cross-browser testing
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet devices
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },

    // High DPI displays
    {
      name: 'High DPI',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 2,
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // Development server configuration
  webServer: [
    {
      command: 'npm run backend',
      port: 3001,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      port: 5173,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],

  // Output directories
  outputDir: 'test-results/e2e-artifacts',
  
  // Test metadata
  metadata: {
    testSuite: 'TE-011: End-to-End Testing Suite',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'test',
  },
});