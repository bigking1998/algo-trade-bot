# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
- `npm start` - Runs both backend and frontend concurrently using tsx and vite
- `npm run backend` - Start only the backend server (tsx watch src/backend/server.ts) 
- `npm run dev` - Start only the frontend development server (vite)

### Build & Quality
- `npm run build` - TypeScript compilation followed by Vite production build
- `npm run lint` - ESLint with TypeScript extensions, max warnings 0
- `npm run preview` - Preview production build locally

### Testing
- `npm test` - Run tests using Vitest
- `npm run test:ui` - Run tests with Vitest UI interface

## Architecture Overview

This is an algorithmic trading bot with a React frontend and Node.js backend, designed to integrate with dYdX v4 for live market data and trading.

### Project Structure
- **Frontend**: React + Vite + TypeScript + Tailwind + Shadcn UI components
  - `src/frontend/` - Main React application with dashboard views
  - `src/frontend/components/ui/` - Shadcn UI primitive components  
  - `src/frontend/hooks/` - React Query hooks for data fetching and WebSocket streams
  - `src/frontend/lib/api/` - API client wrappers
- **Backend**: Node.js HTTP server with dYdX integration
  - `src/backend/server.ts` - Main HTTP server with CORS and JSON handling
  - `src/backend/routes/` - API route handlers for dYdX data, orders, backtesting
  - `src/backend/dydx/` - dYdX Indexer client and WebSocket gateway
- **Shared**: Common types and utilities
  - `src/shared/types/trading.ts` - Comprehensive trading domain models and dYdX v4 types

### Key Technologies
- **UI Framework**: Shadcn components built on Radix UI primitives
- **Data Flow**: React Query for REST API calls, RxJS for WebSocket streams
- **Charting**: Lightweight Charts library loaded via CDN for candlestick visualization
- **Backend**: Plain Node.js HTTP server (no framework) proxying dYdX Indexer REST/WS
- **Testing**: Vitest with jsdom and Testing Library

### Backend API Structure
The backend serves as a proxy to dYdX v4 Indexer with these main endpoints:
- `/api/health` - Service health check
- `/api/dydx/markets` - Live market information
- `/api/dydx/candles` - Historical and live candlestick data
- `/api/dydx/oracle` - Oracle price feeds
- Future endpoints for wallet integration, order placement, and backtesting

### Frontend Data Architecture
- **State Management**: React Query for server state, local state for UI
- **Real-time Data**: RxJS observables for WebSocket streams
- **Chart Integration**: Direct lightweight-charts integration with dYdX candle data
- **Type Safety**: Comprehensive TypeScript types shared between frontend and backend

### Key Features Implemented
- Real-time market data from dYdX v4 Indexer
- Interactive candlestick charts with symbol/timeframe selection
- Markets table with live oracle prices and trading parameters
- Candle history table with filtering capabilities
- Strategy builder UI framework (backend strategy execution pending)
- Trading bot status monitoring with API connectivity indicators

### Development Notes
- Uses Vite proxy to route `/api/*` requests to backend at localhost:3001
- Backend uses plain HTTP server with manual CORS handling
- All data fetching goes through React Query hooks for caching and error handling
- Shadcn components should be added via CLI when new UI primitives are needed
- TypeScript strict mode enabled with path aliases configured