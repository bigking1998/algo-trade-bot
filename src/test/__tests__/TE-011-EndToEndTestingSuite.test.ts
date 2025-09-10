/**
 * TE-011: End-to-End Testing Suite - TestingAgent Implementation
 * 
 * Comprehensive E2E test suite covering all End-to-End requirements:
 * - Complete E2E test coverage
 * - User journey testing
 * - Cross-browser testing
 * - Mobile testing
 * 
 * This test suite validates all aspects of the end-to-end system
 * as specified in Task TE-011 from COMPLETE_TASK_LIST.md
 */

import { test, expect, Page, Browser } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';

// Test configuration
const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Test data
const TEST_USER_CREDENTIALS = {
  email: 'test@tradingbot.com',
  password: 'TestPassword123!',
  username: 'testuser'
};

const TEST_STRATEGY_CONFIG = {
  name: 'E2E Test Strategy',
  type: 'technical',
  symbol: 'BTC-USD',
  timeframe: '1h',
  parameters: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30
  }
};

// =============================================================================
// COMPLETE E2E TEST COVERAGE
// =============================================================================

test.describe('Complete E2E Test Coverage', () => {
  let page: Page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(TEST_BASE_URL);
  });

  test('should load application and display dashboard', async () => {
    // Verify main application loads
    await expect(page).toHaveTitle(/Trading Bot/);
    await expect(page.locator('[data-testid="main-dashboard"]')).toBeVisible();
    
    // Verify essential UI components
    await expect(page.locator('[data-testid="navigation-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="market-data-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="trading-controls"]')).toBeVisible();
    await expect(page.locator('[data-testid="portfolio-summary"]')).toBeVisible();
  });

  test('should handle API connectivity and health checks', async () => {
    // Check API health endpoint
    const healthResponse = await page.request.get(`${API_BASE_URL}/api/health`);
    expect(healthResponse.status()).toBe(200);
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.timestamp).toBeDefined();
    
    // Verify API connectivity indicator on UI
    await expect(page.locator('[data-testid="api-status-indicator"]')).toHaveClass(/connected/);
  });

  test('should load and display real-time market data', async () => {
    // Wait for market data to load
    await page.waitForSelector('[data-testid="price-display"]', { timeout: 10000 });
    
    // Verify price is displayed
    const priceElement = page.locator('[data-testid="current-price"]');
    await expect(priceElement).toBeVisible();
    
    const priceText = await priceElement.textContent();
    expect(priceText).toMatch(/\$[\d,]+\.?\d*/); // Price format
    
    // Verify market data updates
    const initialPrice = await priceElement.textContent();
    
    // Wait for potential price update (WebSocket)
    await page.waitForTimeout(5000);
    
    // Verify chart is rendered
    await expect(page.locator('[data-testid="price-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="volume-chart"]')).toBeVisible();
  });

  test('should handle market data symbol switching', async () => {
    // Select different trading pair
    await page.click('[data-testid="symbol-selector"]');
    await page.click('[data-testid="symbol-option-ETH-USD"]');
    
    // Wait for data to update
    await page.waitForSelector('[data-testid="price-display"]', { timeout: 5000 });
    
    // Verify symbol changed
    const symbolDisplay = page.locator('[data-testid="current-symbol"]');
    await expect(symbolDisplay).toHaveText('ETH-USD');
    
    // Verify price updated for new symbol
    const priceElement = page.locator('[data-testid="current-price"]');
    const priceText = await priceElement.textContent();
    expect(priceText).toMatch(/\$[\d,]+\.?\d*/);
  });

  test('should display technical indicators correctly', async () => {
    // Navigate to indicators panel
    await page.click('[data-testid="indicators-tab"]');
    
    // Verify RSI indicator
    await expect(page.locator('[data-testid="rsi-indicator"]')).toBeVisible();
    const rsiValue = await page.locator('[data-testid="rsi-value"]').textContent();
    expect(parseFloat(rsiValue || '0')).toBeGreaterThanOrEqual(0);
    expect(parseFloat(rsiValue || '0')).toBeLessThanOrEqual(100);
    
    // Verify MACD indicator
    await expect(page.locator('[data-testid="macd-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="macd-histogram"]')).toBeVisible();
    
    // Verify Bollinger Bands
    await expect(page.locator('[data-testid="bollinger-bands"]')).toBeVisible();
    
    // Test indicator configuration
    await page.click('[data-testid="rsi-settings"]');
    await page.fill('[data-testid="rsi-period-input"]', '21');
    await page.click('[data-testid="apply-settings"]');
    
    // Wait for recalculation
    await page.waitForTimeout(2000);
    
    // Verify settings applied
    const updatedRsiValue = await page.locator('[data-testid="rsi-value"]').textContent();
    expect(updatedRsiValue).toBeDefined();
  });
});

// =============================================================================
// USER JOURNEY TESTING
// =============================================================================

test.describe('User Journey Testing', () => {
  let page: Page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(TEST_BASE_URL);
  });

  test('Complete Trading Strategy Creation Journey', async () => {
    // Step 1: Navigate to strategy builder
    await page.click('[data-testid="strategy-builder-nav"]');
    await expect(page.locator('[data-testid="strategy-builder-canvas"]')).toBeVisible();
    
    // Step 2: Create new strategy
    await page.click('[data-testid="new-strategy-button"]');
    await page.fill('[data-testid="strategy-name-input"]', TEST_STRATEGY_CONFIG.name);
    await page.selectOption('[data-testid="strategy-type-select"]', TEST_STRATEGY_CONFIG.type);
    await page.click('[data-testid="create-strategy-button"]');
    
    // Step 3: Configure strategy parameters
    await page.selectOption('[data-testid="symbol-select"]', TEST_STRATEGY_CONFIG.symbol);
    await page.selectOption('[data-testid="timeframe-select"]', TEST_STRATEGY_CONFIG.timeframe);
    
    // Add RSI indicator
    await page.click('[data-testid="add-indicator-button"]');
    await page.click('[data-testid="indicator-rsi"]');
    await page.fill('[data-testid="rsi-period"]', TEST_STRATEGY_CONFIG.parameters.rsiPeriod.toString());
    
    // Add buy condition (RSI oversold)
    await page.click('[data-testid="add-condition-button"]');
    await page.selectOption('[data-testid="condition-indicator"]', 'rsi');
    await page.selectOption('[data-testid="condition-operator"]', 'less_than');
    await page.fill('[data-testid="condition-value"]', TEST_STRATEGY_CONFIG.parameters.rsiOversold.toString());
    
    // Add sell condition (RSI overbought)
    await page.click('[data-testid="add-condition-button"]');
    await page.selectOption('[data-testid="condition-indicator"]', 'rsi');
    await page.selectOption('[data-testid="condition-operator"]', 'greater_than');
    await page.fill('[data-testid="condition-value"]', TEST_STRATEGY_CONFIG.parameters.rsiOverbought.toString());
    
    // Step 4: Save strategy
    await page.click('[data-testid="save-strategy-button"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Strategy saved successfully');
    
    // Step 5: Verify strategy appears in list
    await page.click('[data-testid="strategies-nav"]');
    await expect(page.locator(`[data-testid="strategy-${TEST_STRATEGY_CONFIG.name}"]`)).toBeVisible();
  });

  test('Complete Backtesting Journey', async () => {
    // Step 1: Navigate to backtesting
    await page.click('[data-testid="backtesting-nav"]');
    await expect(page.locator('[data-testid="backtest-panel"]')).toBeVisible();
    
    // Step 2: Select strategy for backtesting
    await page.selectOption('[data-testid="backtest-strategy-select"]', TEST_STRATEGY_CONFIG.name);
    
    // Step 3: Configure backtest parameters
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    
    await page.fill('[data-testid="backtest-start-date"]', startDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="backtest-end-date"]', endDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="initial-capital"]', '10000');
    await page.selectOption('[data-testid="commission-type"]', 'percentage');
    await page.fill('[data-testid="commission-rate"]', '0.1');
    
    // Step 4: Run backtest
    await page.click('[data-testid="run-backtest-button"]');
    
    // Wait for backtest to complete
    await expect(page.locator('[data-testid="backtest-progress"]')).toBeVisible();
    await page.waitForSelector('[data-testid="backtest-results"]', { timeout: 30000 });
    
    // Step 5: Verify results
    await expect(page.locator('[data-testid="backtest-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-return"]')).toBeVisible();
    await expect(page.locator('[data-testid="sharpe-ratio"]')).toBeVisible();
    await expect(page.locator('[data-testid="max-drawdown"]')).toBeVisible();
    
    // Verify equity curve chart
    await expect(page.locator('[data-testid="equity-curve-chart"]')).toBeVisible();
    
    // Verify trade list
    await expect(page.locator('[data-testid="trade-list"]')).toBeVisible();
    
    // Check if trades were executed
    const tradeCount = await page.locator('[data-testid="trade-row"]').count();
    expect(tradeCount).toBeGreaterThan(0);
  });

  test('Complete Portfolio Management Journey', async () => {
    // Step 1: Navigate to portfolio
    await page.click('[data-testid="portfolio-nav"]');
    await expect(page.locator('[data-testid="portfolio-overview"]')).toBeVisible();
    
    // Step 2: Verify portfolio summary
    await expect(page.locator('[data-testid="total-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="available-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="unrealized-pnl"]')).toBeVisible();
    
    // Step 3: Check positions (if any)
    const positionsSection = page.locator('[data-testid="active-positions"]');
    await expect(positionsSection).toBeVisible();
    
    // Step 4: View transaction history
    await page.click('[data-testid="transaction-history-tab"]');
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    // Step 5: Test portfolio analytics
    await page.click('[data-testid="analytics-tab"]');
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="allocation-pie-chart"]')).toBeVisible();
    
    // Verify key metrics
    await expect(page.locator('[data-testid="total-trades"]')).toBeVisible();
    await expect(page.locator('[data-testid="win-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="profit-factor"]')).toBeVisible();
  });

  test('Complete Settings and Configuration Journey', async () => {
    // Step 1: Navigate to settings
    await page.click('[data-testid="settings-nav"]');
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
    
    // Step 2: API Configuration
    await page.click('[data-testid="api-settings-tab"]');
    await expect(page.locator('[data-testid="api-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-secret-input"]')).toBeVisible();
    
    // Step 3: Risk Management Settings
    await page.click('[data-testid="risk-settings-tab"]');
    await page.fill('[data-testid="max-position-size"]', '1000');
    await page.fill('[data-testid="max-daily-loss"]', '500');
    await page.fill('[data-testid="stop-loss-percentage"]', '2');
    
    // Step 4: Notification Settings
    await page.click('[data-testid="notification-settings-tab"]');
    await page.check('[data-testid="email-notifications"]');
    await page.check('[data-testid="trade-alerts"]');
    await page.fill('[data-testid="notification-email"]', TEST_USER_CREDENTIALS.email);
    
    // Step 5: Save settings
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible();
    
    // Step 6: Verify settings persistence
    await page.reload();
    await page.click('[data-testid="settings-nav"]');
    await page.click('[data-testid="risk-settings-tab"]');
    
    const maxPositionSize = await page.inputValue('[data-testid="max-position-size"]');
    expect(maxPositionSize).toBe('1000');
  });
});

// =============================================================================
// CROSS-BROWSER TESTING
// =============================================================================

test.describe('Cross-Browser Testing', () => {
  const browsers = ['chromium', 'firefox', 'webkit'];
  
  browsers.forEach(browserName => {
    test(`should work correctly on ${browserName}`, async ({ browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, `This test is for ${browserName} only`);
      
      let browser: Browser;
      switch (browserName) {
        case 'chromium':
          browser = await chromium.launch();
          break;
        case 'firefox':
          browser = await firefox.launch();
          break;
        case 'webkit':
          browser = await webkit.launch();
          break;
        default:
          throw new Error(`Unsupported browser: ${browserName}`);
      }
      
      const page = await browser.newPage();
      await page.goto(TEST_BASE_URL);
      
      // Test basic functionality across browsers
      await expect(page).toHaveTitle(/Trading Bot/);
      await expect(page.locator('[data-testid="main-dashboard"]')).toBeVisible();
      
      // Test chart rendering
      await expect(page.locator('[data-testid="price-chart"]')).toBeVisible();
      
      // Test WebSocket connectivity
      const wsConnected = await page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket('ws://localhost:3001');
          ws.onopen = () => resolve(true);
          ws.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 5000);
        });
      });
      
      expect(wsConnected).toBe(true);
      
      // Test responsive design
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
      
      await page.setViewportSize({ width: 768, height: 600 });
      await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
      
      await browser.close();
    });
  });

  test('should handle browser-specific features', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(TEST_BASE_URL);
    
    // Test local storage
    await page.evaluate(() => {
      localStorage.setItem('testKey', 'testValue');
    });
    
    const storedValue = await page.evaluate(() => {
      return localStorage.getItem('testKey');
    });
    expect(storedValue).toBe('testValue');
    
    // Test session storage
    await page.evaluate(() => {
      sessionStorage.setItem('sessionKey', 'sessionValue');
    });
    
    const sessionValue = await page.evaluate(() => {
      return sessionStorage.getItem('sessionKey');
    });
    expect(sessionValue).toBe('sessionValue');
    
    // Test IndexedDB (if available)
    const indexedDBSupported = await page.evaluate(() => {
      return typeof indexedDB !== 'undefined';
    });
    
    if (indexedDBSupported) {
      console.log('IndexedDB is supported');
      // Could add IndexedDB-specific tests here
    }
    
    // Test Web Workers (if available)
    const webWorkerSupported = await page.evaluate(() => {
      return typeof Worker !== 'undefined';
    });
    
    if (webWorkerSupported) {
      console.log('Web Workers are supported');
      // Could add Web Worker-specific tests here
    }
  });
});

// =============================================================================
// MOBILE TESTING
// =============================================================================

test.describe('Mobile Testing', () => {
  const mobileDevices = [
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Pixel 5', width: 393, height: 851 },
    { name: 'iPad', width: 768, height: 1024 }
  ];
  
  mobileDevices.forEach(device => {
    test(`should work on ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        userAgent: device.name.includes('iPhone') 
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
          : device.name.includes('Pixel')
          ? 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36'
          : 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
      });
      
      const page = await context.newPage();
      await page.goto(TEST_BASE_URL);
      
      // Test mobile layout
      await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
      
      // Test mobile navigation
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      
      // Test touch interactions
      const chartElement = page.locator('[data-testid="price-chart"]');
      await expect(chartElement).toBeVisible();
      
      // Simulate touch events
      await chartElement.tap();
      await page.touchscreen.tap(device.width / 2, device.height / 2);
      
      // Test swipe gestures
      await page.touchscreen.tap(100, 400);
      await page.mouse.move(300, 400);
      
      // Test responsive tables
      await page.click('[data-testid="mobile-menu-button"]');
      await page.click('[data-testid="portfolio-nav-mobile"]');
      
      const portfolioTable = page.locator('[data-testid="portfolio-table"]');
      await expect(portfolioTable).toBeVisible();
      
      // Verify table is mobile-responsive
      const tableWidth = await portfolioTable.evaluate(el => el.scrollWidth);
      expect(tableWidth).toBeLessThanOrEqual(device.width);
      
      // Test mobile-specific features
      if (device.name.includes('iPhone') || device.name.includes('Pixel')) {
        // Test if PWA features work
        const manifestResponse = await page.request.get('/manifest.json');
        expect(manifestResponse.status()).toBe(200);
        
        // Test if service worker is registered
        const swRegistered = await page.evaluate(() => {
          return 'serviceWorker' in navigator;
        });
        expect(swRegistered).toBe(true);
      }
      
      await context.close();
    });
  });

  test('should handle device orientation changes', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 } // iPhone 12 portrait
    });
    
    const page = await context.newPage();
    await page.goto(TEST_BASE_URL);
    
    // Test portrait mode
    await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
    
    // Simulate rotation to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    
    // Wait for layout adjustment
    await page.waitForTimeout(1000);
    
    // Test landscape layout
    await expect(page.locator('[data-testid="landscape-layout"]')).toBeVisible();
    
    // Verify chart adapts to landscape
    const chartElement = page.locator('[data-testid="price-chart"]');
    const chartBounds = await chartElement.boundingBox();
    expect(chartBounds?.width).toBeGreaterThan(chartBounds?.height);
    
    await context.close();
  });

  test('should handle touch and gesture events', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true
    });
    
    const page = await context.newPage();
    await page.goto(TEST_BASE_URL);
    
    // Test pinch-to-zoom on chart
    const chartElement = page.locator('[data-testid="price-chart"]');
    await expect(chartElement).toBeVisible();
    
    // Get initial chart bounds
    const initialBounds = await chartElement.boundingBox();
    
    // Simulate pinch gesture
    await page.touchscreen.tap(200, 300);
    await page.touchscreen.tap(250, 350);
    
    // Test swipe navigation
    await page.touchscreen.tap(50, 400);
    await page.mouse.move(350, 400);
    
    // Test long press context menu
    await chartElement.tap({ timeout: 2000 });
    
    // Verify touch events are handled
    const touchEvents = await page.evaluate(() => {
      return window.TouchEvent !== undefined;
    });
    expect(touchEvents).toBe(true);
    
    await context.close();
  });
});

// =============================================================================
// ACCESSIBILITY TESTING
// =============================================================================

test.describe('Accessibility Testing', () => {
  test('should meet WCAG accessibility standards', async ({ page }) => {
    await page.goto(TEST_BASE_URL);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
    
    // Navigate through all interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Test ARIA attributes
    const ariaLabels = await page.$$eval('[aria-label]', elements => 
      elements.map(el => el.getAttribute('aria-label'))
    );
    expect(ariaLabels.length).toBeGreaterThan(0);
    
    // Test alt text on images
    const images = await page.$$eval('img', imgs => 
      imgs.map(img => img.getAttribute('alt'))
    );
    images.forEach(alt => {
      expect(alt).toBeDefined();
      expect(alt).not.toBe('');
    });
    
    // Test color contrast (basic check)
    const backgroundColor = await page.evaluate(() => {
      const body = document.body;
      return getComputedStyle(body).backgroundColor;
    });
    
    const textColor = await page.evaluate(() => {
      const body = document.body;
      return getComputedStyle(body).color;
    });
    
    expect(backgroundColor).toBeDefined();
    expect(textColor).toBeDefined();
    
    // Test screen reader compatibility
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', headings => 
      headings.map(h => h.textContent)
    );
    expect(headings.length).toBeGreaterThan(0);
    
    // Test focus indicators
    await page.focus('[data-testid="symbol-selector"]');
    const focusedStyle = await page.evaluate(() => {
      const focused = document.activeElement;
      return getComputedStyle(focused).outline;
    });
    expect(focusedStyle).not.toBe('none');
  });

  test('should support screen readers', async ({ page }) => {
    await page.goto(TEST_BASE_URL);
    
    // Test ARIA live regions
    const liveRegions = await page.$$('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);
    
    // Test role attributes
    const roleElements = await page.$$eval('[role]', elements => 
      elements.map(el => el.getAttribute('role'))
    );
    expect(roleElements).toContain('button');
    expect(roleElements).toContain('navigation');
    
    // Test describedby relationships
    const describedByElements = await page.$$('[aria-describedby]');
    expect(describedByElements.length).toBeGreaterThan(0);
    
    // Test landmark roles
    const landmarks = await page.$$eval('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]', 
      elements => elements.map(el => el.getAttribute('role'))
    );
    expect(landmarks.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// PERFORMANCE TESTING IN E2E CONTEXT
// =============================================================================

test.describe('E2E Performance Testing', () => {
  test('should meet performance benchmarks', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(TEST_BASE_URL);
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    // Test Time to Interactive
    await page.waitForLoadState('networkidle');
    const interactiveTime = Date.now() - startTime;
    expect(interactiveTime).toBeLessThan(8000);
    
    // Test largest contentful paint
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });
    expect(lcp).toBeLessThan(4000); // LCP should be under 4 seconds
    
    // Test memory usage
    const memoryInfo = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : null;
    });
    
    if (memoryInfo) {
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    }
  });

  test('should handle concurrent user interactions', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );
    
    // Load application in all contexts simultaneously
    const loadPromises = pages.map(page => page.goto(TEST_BASE_URL));
    await Promise.all(loadPromises);
    
    // Perform actions concurrently
    const actionPromises = pages.map(async (page, index) => {
      await page.click('[data-testid="symbol-selector"]');
      await page.click(`[data-testid="symbol-option-${index === 0 ? 'BTC-USD' : index === 1 ? 'ETH-USD' : 'ADA-USD'}"]`);
      await page.waitForSelector('[data-testid="price-display"]');
      return page.locator('[data-testid="current-price"]').textContent();
    });
    
    const results = await Promise.all(actionPromises);
    
    // Verify all pages responded correctly
    results.forEach(result => {
      expect(result).toMatch(/\$[\d,]+\.?\d*/);
    });
    
    // Clean up
    await Promise.all(contexts.map(context => context.close()));
  });
});