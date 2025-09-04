# Portfolio Management System

A comprehensive Portfolio Management system for the trading bot application with real-time balance tracking, asset allocation visualization, and multi-asset support.

## Features

### 🏦 Multi-Asset Balance Tracking
- **Real-time balances** for BTC, ETH, SOL, USDC, and more
- **Available vs. Locked** balance breakdown
- **24h P&L tracking** for each asset
- **USD valuation** for all holdings

### 📊 Portfolio Overview
- **Total portfolio value** in USD
- **24h portfolio change** with percentage
- **Asset count** and diversification metrics
- **Largest holding** identification

### 🥧 Asset Allocation
- **Interactive pie chart** showing portfolio distribution
- **Percentage and USD values** for each asset
- **Color-coded visualization** for easy identification
- **Responsive design** for all screen sizes

### ⚡ Real-Time Updates
- **15-second polling** for live data
- **Focus-based refresh** when returning to tab
- **Manual refresh** capability
- **Loading and error states**

## API Endpoints

### Portfolio Balances
```
GET /api/dydx/portfolio/balances
```
Returns detailed balance information for all assets.

**Response:**
```json
{
  "balances": [
    {
      "asset": "BTC",
      "balance": 0.156,
      "lockedBalance": 0.02,
      "availableBalance": 0.136,
      "usdValue": 10547.20,
      "change24h": -234.56,
      "change24hPercent": -2.18
    }
  ]
}
```

### Portfolio Summary
```
GET /api/dydx/portfolio/summary
```
Returns portfolio-wide metrics and allocation data.

**Response:**
```json
{
  "totalValue": 28421.42,
  "change24h": -176.00,
  "change24hPercent": -0.61,
  "totalAssets": 4,
  "allocation": [
    {
      "asset": "BTC",
      "percentage": 37.11,
      "value": 10547.20
    }
  ]
}
```

## Components

### PortfolioOverview
Main container component that renders the complete portfolio interface.

**Location:** `src/frontend/components/portfolio/PortfolioOverview.tsx`

**Features:**
- Portfolio summary header with total value and 24h change
- Grid of individual asset balance cards
- Asset allocation pie chart
- Loading states and error handling

### AssetBalanceCard
Individual asset balance display with detailed metrics.

**Location:** `src/frontend/components/portfolio/AssetBalanceCard.tsx`

**Features:**
- Asset icon and symbol
- USD value with 24h change indicator
- Available vs. locked balance breakdown
- Visual balance bar
- Color-coded status indicators

### AllocationChart
Interactive pie chart for portfolio asset allocation.

**Location:** `src/frontend/components/portfolio/AllocationChart.tsx`

**Features:**
- Responsive pie chart using Recharts
- Custom tooltips with detailed information
- Legend with percentages and USD values
- Color-coded asset identification

## Hooks

### usePortfolio
Custom hook for portfolio data management.

**Location:** `src/frontend/hooks/usePortfolio.ts`

**Features:**
- Automatic data fetching with 15-second polling
- Window focus-based refresh
- Error handling and loading states
- Manual refetch capability

**Usage:**
```typescript
const { balances, summary, loading, error, refetch } = usePortfolio();
```

## Integration

The Portfolio Management system is integrated into the main application via:

1. **Navigation Tab:** Added as "Portfolio" in the main tab navigation
2. **API Integration:** Connected to dYdX balance APIs (currently using mock data)
3. **Real-time Updates:** Automatic refresh every 15 seconds
4. **Responsive Design:** Works on desktop, tablet, and mobile

## Development Notes

### Current Implementation
- Uses **mock data** for demonstration purposes
- **Polling-based** real-time updates (15-second intervals)
- **REST API** endpoints for data fetching

### Future Enhancements
- **WebSocket integration** for real-time streaming updates
- **Real dYdX API integration** replacing mock data
- **Historical balance charts** and performance tracking
- **Portfolio rebalancing** recommendations
- **Export functionality** for portfolio reports

## File Structure

```
src/
├── backend/
│   └── routes/
│       └── dydx.ts                 # Portfolio API endpoints
├── frontend/
│   ├── components/
│   │   └── portfolio/
│   │       ├── PortfolioOverview.tsx
│   │       ├── AssetBalanceCard.tsx
│   │       ├── AllocationChart.tsx
│   │       └── index.ts
│   └── hooks/
│       └── usePortfolio.ts
└── shared/
    └── types/
        └── trading.ts              # Portfolio type definitions
```

## Usage

1. **Navigate to Portfolio tab** in the main application
2. **View portfolio overview** with total value and 24h change
3. **Check individual asset balances** in the asset cards grid
4. **Analyze allocation** using the interactive pie chart
5. **Refresh data** manually using the refresh button if needed

The system automatically updates every 15 seconds and when you return to the browser tab.