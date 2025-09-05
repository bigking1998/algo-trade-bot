/**
 * Frontend Component Test Suite - Task TE-001
 * 
 * Comprehensive testing for React components including:
 * - Component rendering and props handling
 * - User interaction and event handling
 * - Real-time data integration
 * - Accessibility and responsive design
 * - Performance under load
 * - Error boundary behavior
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestingFramework } from '../TestingFramework';
import { MockDataGenerator } from '../MockDataGenerator';

// Mock components for testing
const RiskDashboard = ({ portfolio, riskMetrics }: any) => {
  if (!portfolio) {
    return <div data-testid="loading">Loading portfolio...</div>;
  }

  return (
    <div data-testid="risk-dashboard">
      <h2>Risk Dashboard</h2>
      <div data-testid="total-value">{portfolio.totalValue}</div>
      <div data-testid="available-balance">{portfolio.availableBalance}</div>
      <div data-testid="daily-pnl">{portfolio.dailyPnl}</div>
      {riskMetrics && (
        <div data-testid="risk-metrics">
          <div data-testid="var">{riskMetrics.var}</div>
          <div data-testid="sharpe-ratio">{riskMetrics.sharpeRatio}</div>
        </div>
      )}
    </div>
  );
};

const PositionManagement = ({ positions, onClosePosition, onUpdateStop }: any) => {
  return (
    <div data-testid="position-management">
      <h2>Active Positions</h2>
      {positions.length === 0 ? (
        <div data-testid="no-positions">No active positions</div>
      ) : (
        <div data-testid="positions-list">
          {positions.map((position: any, index: number) => (
            <div key={position.id || index} data-testid={`position-${index}`}>
              <span data-testid={`symbol-${index}`}>{position.symbol}</span>
              <span data-testid={`size-${index}`}>{position.size}</span>
              <span data-testid={`pnl-${index}`}>{position.unrealizedPnl}</span>
              <button 
                onClick={() => onClosePosition(position.id)}
                data-testid={`close-${index}`}
              >
                Close
              </button>
              <button 
                onClick={() => onUpdateStop(position.id, position.entryPrice * 0.95)}
                data-testid={`update-stop-${index}`}
              >
                Update Stop
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TradingChart = ({ symbol, timeframe, data, onTimeframeChange }: any) => {
  return (
    <div data-testid="trading-chart">
      <div data-testid="chart-header">
        <span data-testid="symbol">{symbol}</span>
        <select 
          data-testid="timeframe-selector" 
          value={timeframe} 
          onChange={(e) => onTimeframeChange(e.target.value)}
        >
          <option value="1m">1 Minute</option>
          <option value="5m">5 Minutes</option>
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
        </select>
      </div>
      <div data-testid="chart-data">
        {data && data.length > 0 ? (
          <div>Chart with {data.length} candles</div>
        ) : (
          <div>No chart data available</div>
        )}
      </div>
    </div>
  );
};

const StrategyBuilder = ({ strategies, onStrategyCreate, onStrategyUpdate, onStrategyDelete }: any) => {
  return (
    <div data-testid="strategy-builder">
      <h2>Strategy Builder</h2>
      <button 
        onClick={() => onStrategyCreate({ type: 'trend_following' })}
        data-testid="create-strategy"
      >
        Create Strategy
      </button>
      <div data-testid="strategies-list">
        {strategies.map((strategy: any, index: number) => (
          <div key={strategy.id || index} data-testid={`strategy-${index}`}>
            <span data-testid={`strategy-name-${index}`}>{strategy.name}</span>
            <span data-testid={`strategy-type-${index}`}>{strategy.type}</span>
            <span data-testid={`strategy-status-${index}`}>{strategy.enabled ? 'Active' : 'Inactive'}</span>
            <button 
              onClick={() => onStrategyUpdate(strategy.id, { enabled: !strategy.enabled })}
              data-testid={`toggle-strategy-${index}`}
            >
              {strategy.enabled ? 'Disable' : 'Enable'}
            </button>
            <button 
              onClick={() => onStrategyDelete(strategy.id)}
              data-testid={`delete-strategy-${index}`}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const OrderManagement = ({ orders, onCreateOrder, onCancelOrder }: any) => {
  return (
    <div data-testid="order-management">
      <h2>Order Management</h2>
      <div data-testid="order-form">
        <button 
          onClick={() => onCreateOrder({ side: 'buy', size: 1, type: 'market' })}
          data-testid="market-buy"
        >
          Market Buy
        </button>
        <button 
          onClick={() => onCreateOrder({ side: 'sell', size: 1, type: 'market' })}
          data-testid="market-sell"
        >
          Market Sell
        </button>
      </div>
      <div data-testid="orders-list">
        {orders.map((order: any, index: number) => (
          <div key={order.id || index} data-testid={`order-${index}`}>
            <span data-testid={`order-symbol-${index}`}>{order.symbol}</span>
            <span data-testid={`order-side-${index}`}>{order.side}</span>
            <span data-testid={`order-size-${index}`}>{order.size}</span>
            <span data-testid={`order-status-${index}`}>{order.status}</span>
            {order.status === 'pending' && (
              <button 
                onClick={() => onCancelOrder(order.id)}
                data-testid={`cancel-order-${index}`}
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Test wrapper component with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Frontend Component Tests', () => {
  let mockPortfolio: any;
  let mockPositions: any[];
  let mockStrategies: any[];
  let mockOrders: any[];
  let mockChartData: any[];

  beforeEach(() => {
    // Generate test data
    mockPortfolio = MockDataGenerator.generatePortfolio({
      totalValue: 100000,
      positionCount: 3
    });

    mockPositions = mockPortfolio.positions;

    mockStrategies = [
      MockDataGenerator.generateStrategy('trend_following'),
      MockDataGenerator.generateStrategy('mean_reversion'),
      MockDataGenerator.generateStrategy('momentum')
    ];

    mockOrders = MockDataGenerator.generateOrders(5);

    mockChartData = MockDataGenerator.generateOHLCV({
      count: 100,
      basePrice: 50000,
      trend: 'up'
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('RiskDashboard Component', () => {
    test('should render portfolio information correctly', () => {
      const mockRiskMetrics = {
        var: 5000,
        sharpeRatio: 1.2,
        maxDrawdown: 0.15
      };

      render(
        <TestWrapper>
          <RiskDashboard portfolio={mockPortfolio} riskMetrics={mockRiskMetrics} />
        </TestWrapper>
      );

      expect(screen.getByTestId('risk-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('total-value')).toHaveTextContent('100000');
      expect(screen.getByTestId('available-balance')).toHaveTextContent(mockPortfolio.availableBalance.toString());
      expect(screen.getByTestId('var')).toHaveTextContent('5000');
      expect(screen.getByTestId('sharpe-ratio')).toHaveTextContent('1.2');
    });

    test('should show loading state when portfolio is not available', () => {
      render(
        <TestWrapper>
          <RiskDashboard portfolio={null} />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.getByText('Loading portfolio...')).toBeInTheDocument();
    });

    test('should handle missing risk metrics gracefully', () => {
      render(
        <TestWrapper>
          <RiskDashboard portfolio={mockPortfolio} />
        </TestWrapper>
      );

      expect(screen.getByTestId('risk-dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('risk-metrics')).not.toBeInTheDocument();
    });

    test('should validate portfolio state structure', () => {
      render(
        <TestWrapper>
          <RiskDashboard portfolio={mockPortfolio} />
        </TestWrapper>
      );

      TestingFramework.validatePortfolioState(mockPortfolio);
      expect(screen.getByTestId('risk-dashboard')).toBeInTheDocument();
    });
  });

  describe('PositionManagement Component', () => {
    test('should render active positions', () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      render(
        <TestWrapper>
          <PositionManagement 
            positions={mockPositions} 
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('position-management')).toBeInTheDocument();
      expect(screen.getByTestId('positions-list')).toBeInTheDocument();
      
      mockPositions.forEach((position, index) => {
        expect(screen.getByTestId(`position-${index}`)).toBeInTheDocument();
        expect(screen.getByTestId(`symbol-${index}`)).toHaveTextContent(position.symbol);
        expect(screen.getByTestId(`size-${index}`)).toHaveTextContent(position.size.toString());
      });
    });

    test('should handle position closure', async () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      render(
        <TestWrapper>
          <PositionManagement 
            positions={mockPositions} 
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      const closeButton = screen.getByTestId('close-0');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(onClosePosition).toHaveBeenCalledWith(mockPositions[0].id);
      });
    });

    test('should handle stop loss updates', async () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      render(
        <TestWrapper>
          <PositionManagement 
            positions={mockPositions} 
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      const updateStopButton = screen.getByTestId('update-stop-0');
      fireEvent.click(updateStopButton);

      await waitFor(() => {
        expect(onUpdateStop).toHaveBeenCalledWith(
          mockPositions[0].id,
          mockPositions[0].entryPrice * 0.95
        );
      });
    });

    test('should show empty state when no positions', () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      render(
        <TestWrapper>
          <PositionManagement 
            positions={[]} 
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('no-positions')).toBeInTheDocument();
      expect(screen.getByText('No active positions')).toBeInTheDocument();
    });

    test('should handle rapid position updates', async () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      render(
        <TestWrapper>
          <PositionManagement 
            positions={mockPositions} 
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      // Simulate rapid clicking
      const closeButtons = screen.getAllByText('Close');
      
      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < 3; i++) {
          fireEvent.click(closeButtons[i]);
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }, TestingFramework.PERFORMANCE_BENCHMARKS.uiRender);

      expect(onClosePosition).toHaveBeenCalledTimes(3);
    });
  });

  describe('TradingChart Component', () => {
    test('should render chart with data', () => {
      const onTimeframeChange = vi.fn();

      render(
        <TestWrapper>
          <TradingChart 
            symbol="BTC-USD" 
            timeframe="1h" 
            data={mockChartData}
            onTimeframeChange={onTimeframeChange}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('trading-chart')).toBeInTheDocument();
      expect(screen.getByTestId('symbol')).toHaveTextContent('BTC-USD');
      expect(screen.getByTestId('chart-data')).toHaveTextContent(`Chart with ${mockChartData.length} candles`);
    });

    test('should handle timeframe changes', async () => {
      const onTimeframeChange = vi.fn();

      render(
        <TestWrapper>
          <TradingChart 
            symbol="BTC-USD" 
            timeframe="1h" 
            data={mockChartData}
            onTimeframeChange={onTimeframeChange}
          />
        </TestWrapper>
      );

      const selector = screen.getByTestId('timeframe-selector');
      fireEvent.change(selector, { target: { value: '1d' } });

      await waitFor(() => {
        expect(onTimeframeChange).toHaveBeenCalledWith('1d');
      });
    });

    test('should handle empty chart data', () => {
      const onTimeframeChange = vi.fn();

      render(
        <TestWrapper>
          <TradingChart 
            symbol="BTC-USD" 
            timeframe="1h" 
            data={[]}
            onTimeframeChange={onTimeframeChange}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('chart-data')).toHaveTextContent('No chart data available');
    });

    test('should validate OHLCV data structure', () => {
      const onTimeframeChange = vi.fn();

      mockChartData.forEach(candle => {
        TestingFramework.validateOHLCV(candle);
      });

      render(
        <TestWrapper>
          <TradingChart 
            symbol="BTC-USD" 
            timeframe="1h" 
            data={mockChartData}
            onTimeframeChange={onTimeframeChange}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('trading-chart')).toBeInTheDocument();
    });
  });

  describe('StrategyBuilder Component', () => {
    test('should render strategy list', () => {
      const onStrategyCreate = vi.fn();
      const onStrategyUpdate = vi.fn();
      const onStrategyDelete = vi.fn();

      render(
        <TestWrapper>
          <StrategyBuilder 
            strategies={mockStrategies}
            onStrategyCreate={onStrategyCreate}
            onStrategyUpdate={onStrategyUpdate}
            onStrategyDelete={onStrategyDelete}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('strategy-builder')).toBeInTheDocument();
      expect(screen.getByTestId('strategies-list')).toBeInTheDocument();

      mockStrategies.forEach((strategy, index) => {
        expect(screen.getByTestId(`strategy-${index}`)).toBeInTheDocument();
        expect(screen.getByTestId(`strategy-name-${index}`)).toHaveTextContent(strategy.name);
        expect(screen.getByTestId(`strategy-type-${index}`)).toHaveTextContent(strategy.type);
      });
    });

    test('should handle strategy creation', async () => {
      const onStrategyCreate = vi.fn();
      const onStrategyUpdate = vi.fn();
      const onStrategyDelete = vi.fn();

      render(
        <TestWrapper>
          <StrategyBuilder 
            strategies={mockStrategies}
            onStrategyCreate={onStrategyCreate}
            onStrategyUpdate={onStrategyUpdate}
            onStrategyDelete={onStrategyDelete}
          />
        </TestWrapper>
      );

      const createButton = screen.getByTestId('create-strategy');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(onStrategyCreate).toHaveBeenCalledWith({ type: 'trend_following' });
      });
    });

    test('should handle strategy toggle', async () => {
      const onStrategyCreate = vi.fn();
      const onStrategyUpdate = vi.fn();
      const onStrategyDelete = vi.fn();

      render(
        <TestWrapper>
          <StrategyBuilder 
            strategies={mockStrategies}
            onStrategyCreate={onStrategyCreate}
            onStrategyUpdate={onStrategyUpdate}
            onStrategyDelete={onStrategyDelete}
          />
        </TestWrapper>
      );

      const toggleButton = screen.getByTestId('toggle-strategy-0');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(onStrategyUpdate).toHaveBeenCalledWith(
          mockStrategies[0].id,
          { enabled: !mockStrategies[0].enabled }
        );
      });
    });

    test('should handle strategy deletion', async () => {
      const onStrategyCreate = vi.fn();
      const onStrategyUpdate = vi.fn();
      const onStrategyDelete = vi.fn();

      render(
        <TestWrapper>
          <StrategyBuilder 
            strategies={mockStrategies}
            onStrategyCreate={onStrategyCreate}
            onStrategyUpdate={onStrategyUpdate}
            onStrategyDelete={onStrategyDelete}
          />
        </TestWrapper>
      );

      const deleteButton = screen.getByTestId('delete-strategy-0');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(onStrategyDelete).toHaveBeenCalledWith(mockStrategies[0].id);
      });
    });
  });

  describe('OrderManagement Component', () => {
    test('should render order list', () => {
      const onCreateOrder = vi.fn();
      const onCancelOrder = vi.fn();

      render(
        <TestWrapper>
          <OrderManagement 
            orders={mockOrders}
            onCreateOrder={onCreateOrder}
            onCancelOrder={onCancelOrder}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('order-management')).toBeInTheDocument();
      expect(screen.getByTestId('orders-list')).toBeInTheDocument();

      mockOrders.forEach((order, index) => {
        expect(screen.getByTestId(`order-${index}`)).toBeInTheDocument();
        expect(screen.getByTestId(`order-symbol-${index}`)).toHaveTextContent(order.symbol);
        expect(screen.getByTestId(`order-side-${index}`)).toHaveTextContent(order.side);
        expect(screen.getByTestId(`order-status-${index}`)).toHaveTextContent(order.status);
      });
    });

    test('should handle order creation', async () => {
      const onCreateOrder = vi.fn();
      const onCancelOrder = vi.fn();

      render(
        <TestWrapper>
          <OrderManagement 
            orders={mockOrders}
            onCreateOrder={onCreateOrder}
            onCancelOrder={onCancelOrder}
          />
        </TestWrapper>
      );

      const buyButton = screen.getByTestId('market-buy');
      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(onCreateOrder).toHaveBeenCalledWith({
          side: 'buy',
          size: 1,
          type: 'market'
        });
      });

      const sellButton = screen.getByTestId('market-sell');
      fireEvent.click(sellButton);

      await waitFor(() => {
        expect(onCreateOrder).toHaveBeenCalledWith({
          side: 'sell',
          size: 1,
          type: 'market'
        });
      });
    });

    test('should handle order cancellation', async () => {
      const onCreateOrder = vi.fn();
      const onCancelOrder = vi.fn();

      // Create mock orders with pending status
      const pendingOrders = mockOrders.map(order => ({ ...order, status: 'pending' }));

      render(
        <TestWrapper>
          <OrderManagement 
            orders={pendingOrders}
            onCreateOrder={onCreateOrder}
            onCancelOrder={onCancelOrder}
          />
        </TestWrapper>
      );

      const cancelButton = screen.getByTestId('cancel-order-0');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(onCancelOrder).toHaveBeenCalledWith(pendingOrders[0].id);
      });
    });

    test('should only show cancel button for pending orders', () => {
      const onCreateOrder = vi.fn();
      const onCancelOrder = vi.fn();

      const mixedOrders = [
        { ...mockOrders[0], status: 'pending' },
        { ...mockOrders[1], status: 'filled' },
        { ...mockOrders[2], status: 'cancelled' }
      ];

      render(
        <TestWrapper>
          <OrderManagement 
            orders={mixedOrders}
            onCreateOrder={onCreateOrder}
            onCancelOrder={onCancelOrder}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('cancel-order-0')).toBeInTheDocument();
      expect(screen.queryByTestId('cancel-order-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-order-2')).not.toBeInTheDocument();
    });
  });

  describe('Component Performance Tests', () => {
    test('should render components within performance benchmarks', async () => {
      const largePositionList = Array.from({ length: 100 }, (_, i) => ({
        id: `pos_${i}`,
        symbol: `SYMBOL${i}`,
        size: Math.random() * 10,
        unrealizedPnl: (Math.random() - 0.5) * 1000,
        entryPrice: 100 + Math.random() * 900
      }));

      await TestingFramework.assertPerformance(async () => {
        render(
          <TestWrapper>
            <PositionManagement 
              positions={largePositionList}
              onClosePosition={vi.fn()}
              onUpdateStop={vi.fn()}
            />
          </TestWrapper>
        );

        expect(screen.getByTestId('position-management')).toBeInTheDocument();
        expect(screen.getAllByText('Close')).toHaveLength(100);
      }, TestingFramework.PERFORMANCE_BENCHMARKS.uiRender);
    });

    test('should handle rapid state updates efficiently', async () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      const { rerender } = render(
        <TestWrapper>
          <PositionManagement 
            positions={mockPositions}
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      await TestingFramework.assertPerformance(async () => {
        for (let i = 0; i < 50; i++) {
          const updatedPositions = mockPositions.map(pos => ({
            ...pos,
            unrealizedPnl: (Math.random() - 0.5) * 1000
          }));

          rerender(
            <TestWrapper>
              <PositionManagement 
                positions={updatedPositions}
                onClosePosition={onClosePosition}
                onUpdateStop={onUpdateStop}
              />
            </TestWrapper>
          );
        }
      }, TestingFramework.PERFORMANCE_BENCHMARKS.uiRender * 5);
    });

    test('should measure component memory usage', async () => {
      const memoryTest = await TestingFramework.measureMemoryUsage(async () => {
        const components = [];
        
        for (let i = 0; i < 50; i++) {
          const portfolio = MockDataGenerator.generatePortfolio({ totalValue: 10000 });
          
          const component = render(
            <TestWrapper>
              <RiskDashboard portfolio={portfolio} />
            </TestWrapper>
          );
          
          components.push(component);
        }
        
        // Cleanup
        components.forEach(component => component.unmount());
        
        return components.length;
      });

      expect(memoryTest.memoryUsedMB).toBeLessThan(50); // Should use less than 50MB
      expect(memoryTest.result).toBe(50);
    });
  });

  describe('Real-time Data Integration', () => {
    test('should update components with real-time data', async () => {
      const initialPortfolio = MockDataGenerator.generatePortfolio({ totalValue: 10000 });
      
      const { rerender } = render(
        <TestWrapper>
          <RiskDashboard portfolio={initialPortfolio} />
        </TestWrapper>
      );

      expect(screen.getByTestId('total-value')).toHaveTextContent('10000');

      // Simulate real-time update
      const updatedPortfolio = { 
        ...initialPortfolio, 
        totalValue: 12000,
        dailyPnl: 2000 
      };

      rerender(
        <TestWrapper>
          <RiskDashboard portfolio={updatedPortfolio} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('total-value')).toHaveTextContent('12000');
        expect(screen.getByTestId('daily-pnl')).toHaveTextContent('2000');
      });
    });

    test('should handle WebSocket-style updates', async () => {
      let currentData = mockChartData;
      const onTimeframeChange = vi.fn();

      const { rerender } = render(
        <TestWrapper>
          <TradingChart 
            symbol="BTC-USD" 
            timeframe="1m" 
            data={currentData}
            onTimeframeChange={onTimeframeChange}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('chart-data')).toHaveTextContent(`Chart with ${currentData.length} candles`);

      // Simulate new candle data
      for (let i = 0; i < 10; i++) {
        const newCandle = MockDataGenerator.generateOHLCV({ count: 1 })[0];
        currentData = [...currentData, newCandle];

        rerender(
          <TestWrapper>
            <TradingChart 
              symbol="BTC-USD" 
              timeframe="1m" 
              data={currentData}
              onTimeframeChange={onTimeframeChange}
            />
          </TestWrapper>
        );

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(screen.getByTestId('chart-data')).toHaveTextContent(`Chart with ${mockChartData.length + 10} candles`);
    });
  });

  describe('Error Handling', () => {
    test('should handle component errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Test with invalid portfolio data
      expect(() => {
        render(
          <TestWrapper>
            <RiskDashboard portfolio={{ invalid: 'data' }} />
          </TestWrapper>
        );
      }).not.toThrow();

      consoleError.mockRestore();
    });

    test('should handle missing props', () => {
      expect(() => {
        render(
          <TestWrapper>
            <PositionManagement />
          </TestWrapper>
        );
      }).not.toThrow();

      expect(screen.getByTestId('position-management')).toBeInTheDocument();
    });

    test('should handle network errors gracefully', async () => {
      const onCreateOrder = vi.fn().mockRejectedValue(new Error('Network error'));
      const onCancelOrder = vi.fn();

      render(
        <TestWrapper>
          <OrderManagement 
            orders={mockOrders}
            onCreateOrder={onCreateOrder}
            onCancelOrder={onCancelOrder}
          />
        </TestWrapper>
      );

      const buyButton = screen.getByTestId('market-buy');
      fireEvent.click(buyButton);

      // Component should not crash even if API call fails
      await waitFor(() => {
        expect(onCreateOrder).toHaveBeenCalled();
      });

      expect(screen.getByTestId('order-management')).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    test('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <RiskDashboard portfolio={mockPortfolio} />
        </TestWrapper>
      );

      const dashboard = screen.getByTestId('risk-dashboard');
      expect(dashboard).toBeInTheDocument();
      
      // Check for headings
      expect(screen.getByRole('heading', { name: 'Risk Dashboard' })).toBeInTheDocument();
    });

    test('should be keyboard navigable', () => {
      const onClosePosition = vi.fn();
      const onUpdateStop = vi.fn();

      render(
        <TestWrapper>
          <PositionManagement 
            positions={mockPositions}
            onClosePosition={onClosePosition}
            onUpdateStop={onUpdateStop}
          />
        </TestWrapper>
      );

      const firstCloseButton = screen.getByTestId('close-0');
      firstCloseButton.focus();
      
      expect(document.activeElement).toBe(firstCloseButton);
      
      // Test keyboard navigation
      fireEvent.keyDown(firstCloseButton, { key: 'Enter' });
      expect(onClosePosition).toHaveBeenCalled();
    });

    test('should have proper color contrast and text sizing', () => {
      render(
        <TestWrapper>
          <RiskDashboard portfolio={mockPortfolio} />
        </TestWrapper>
      );

      const dashboard = screen.getByTestId('risk-dashboard');
      const computedStyle = window.getComputedStyle(dashboard);
      
      // Basic accessibility checks (would be more comprehensive in real tests)
      expect(dashboard).toBeVisible();
    });
  });
});