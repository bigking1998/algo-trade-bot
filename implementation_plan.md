# Implementation Plan

[Overview]
Build a Shadcn-based React dashboard (Vite + Tailwind) for the algorithmic trading bot, using MCP-assisted Shadcn component generation and typed shared models, providing real-time portfolio, strategy management, and trade history views that align with the bot’s architecture.

The current repository includes Vite/Tailwind/Shadcn configuration but is missing the actual frontend and backend source files referenced in the initial plan. This implementation will create the full frontend structure under src/frontend and shared domain types under src/shared/types, leveraging Shadcn components and React Query/RxJS for data flows. The dashboard will be composed of modular views (Portfolio, Strategy Builder, Trade History, Status/Controls) and will use the Vite dev proxy to talk to a backend at /api (mocked initially if needed).

This frontend provides visibility and control over the trading system: it renders live market/position data, exposes risk/strategy parameters, shows P&L and trade logs, and offers start/stop controls. It is designed to integrate with an eventual Node/TS backend that handles TradingView (data/signals), DYDX (execution), risk management, and backtesting, as described in the original plan.

[Types]
Defines shared trading domain models in src/shared/types/trading.ts to ensure strict typing across UI and (future) backend services.

- Enums
  - enum Side = 'long' | 'short'
  - enum OrderType = 'market' | 'limit'
  - enum Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
  - enum SignalType = 'entry' | 'exit'
  - enum TradeStatus = 'open' | 'closed' | 'canceled' | 'rejected'
- Interfaces
  - Strategy
    - id: string (uuid)
    - name: string (1..100)
    - description?: string (0..500)
    - parameters: Record<string, number | string | boolean> (validated by schema)
    - entryConditions: string[] (DSL or descriptors)
    - exitConditions: string[]
    - risk: {
      maxPositionSizePct: number (0..100)
      stopLossPct?: number (0..100)
      takeProfitPct?: number (0..100)
      maxConcurrentPositions?: number (0..50)
    }
    - enabled: boolean
    - createdAt: string (ISO)
    - updatedAt: string (ISO)
  - Trade
    - id: string (uuid)
    - symbol: string (^[A-Z0-9:\-_/]{1,32}$)
    - side: Side
    - size: number (>0)
    - orderType: OrderType
    - entryPrice: number (>0)
    - exitPrice?: number (>0)
    - pnl?: number
    - timestamp: string (ISO)
    - status: TradeStatus
    - strategyId?: string
    - notes?: string
  - MarketData
    - symbol: string
    - price: number
    - volume?: number
    - bid?: number
    - ask?: number
    - timeframe?: Timeframe
    - timestamp: string (ISO)
    - indicators?: Record<string, number>
  - Position
    - symbol: string
    - size: number
    - entryPrice: number
    - currentPrice: number
    - unrealizedPnl: number
    - liquidationPrice?: number
    - leverage?: number
    - strategyId?: string
    - updatedAt: string (ISO)
  - Signal
    - type: SignalType
    - strength?: number (0..100)
    - confidence?: number (0..100)
    - timestamp: string (ISO)
    - strategyId?: string
  - Wallet
    - address: string (0x…)
    - balances: Record<string, number>
    - allowances?: Record<string, number>
    - network?: 'mainnet' | 'testnet'
  - Order
    - symbol: string
    - side: Side
    - size: number
    - type: OrderType
    - price?: number
    - clientId?: string
    - reduceOnly?: boolean
  - OrderResponse
    - id: string
    - accepted: boolean
    - reason?: string
  - TradeResult
    - trade: Trade
    - message?: string
  - BacktestResult
    - strategyId: string
    - trades: Trade[]
    - metrics: {
      totalPnl: number
      winRate: number (0..1)
      maxDrawdown: number
      sharpe?: number
    }
  - ValidationResult
    - valid: boolean
    - errors?: string[]
- Validation Rules
  - Use zod schemas (optional) in src/shared/types/trading.ts to enforce constraints and perform runtime validation (especially for user-supplied strategy parameters).

[Files]
Creates all missing frontend, shared types, and support modules; updates config minimally to wire the UI.

- New files to be created
  - Frontend entry & app shell
    - src/frontend/main.tsx — Mounts React App, sets up React Query, imports Tailwind CSS, and theme.
    - src/frontend/App.tsx — Routes/layout shell with header/nav (Shadcn), Toaster, and top-level providers.
    - src/frontend/index.css — Tailwind base/components/utilities + CSS variables for Shadcn themes.
  - Views & components
    - src/frontend/components/Dashboard.tsx — Wrapper page composing sections below.
    - src/frontend/components/PortfolioDashboard.tsx — Summary cards (equity, P&L, exposure), positions table, small chart.
    - src/frontend/components/TradeHistory.tsx — Table with filters (date, symbol, side), pagination.
    - src/frontend/components/StrategyBuilder.tsx — Form to create/edit strategies, validation, preview.
    - src/frontend/components/StatusBar.tsx — WebSocket/API status, last update, environment, latency.
    - src/frontend/components/controls/TradeControls.tsx — Start/Stop, flat positions, risk presets (confirmation dialogs).
    - src/frontend/components/ui/* — Shadcn primitives added via CLI/MCP:
      - accordion, alert, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, skeleton, table, tabs, textarea, toast, toggle, tooltip
  - Hooks & libs
    - src/frontend/hooks/useTradingData.ts — React Query + RxJS streams for market data, positions, trades, strategies.
    - src/frontend/hooks/useWebSocketStatus.ts — Derive connection status/latency from stream heartbeats.
    - src/frontend/hooks/useStrategies.ts — CRUD for strategies with optimistic updates.
    - src/frontend/lib/api.ts — REST/WebSocket client wrappers for /api endpoints and streams.
    - src/frontend/lib/chart.ts — Lightweight-charts setup helpers (create candlestick/line series, resize).
  - Shared & config
    - src/shared/types/trading.ts — All types above (and optional zod schemas).
    - src/shared/utils/indicators.ts — Client-side indicators (SMA/EMA/RSI) for preview/backtests.
    - src/config/tradingview.ts — TV symbols/timeframes defaults (used for UI dropdowns).
    - src/config/dydx.ts — Network/markets mapping and precision rules (used to format sizes/prices).
  - Tests
    - tests/unit/components/PortfolioDashboard.test.tsx
    - tests/unit/components/TradeHistory.test.tsx
    - tests/unit/components/StrategyBuilder.test.tsx
    - tests/integration/dashboard-data-flow.test.ts
- Existing files to be modified
  - package.json
    - Add deps: @tanstack/react-query, rxjs, zod (optional), lightweight-charts, dayjs
    - Add shadcn component deps as needed (toast or sonner if used by examples)
    - Ensure tools used in scripts exist: concurrently, tsx (devDependencies)
  - tsconfig.json
    - Add "types": ["vite/client"] if missing.
  - vite.config.ts
    - Keep aliases as configured; proxy /api to 3001 is fine.
  - tailwind.config.js
    - Content already includes './src/**/*.{ts,tsx}' and plugin 'tailwindcss-animate' — OK.
  - postcss.config.js
    - Already using "@tailwindcss/postcss" — OK.
  - components.json
    - Points css to "src/frontend/index.css" — ensure file exists and is imported in main.tsx.
  - index.html
    - No change necessary; script points to /src/frontend/main.tsx.

[Functions]
Implements UI data, interactions, and support functions as typed, with precise signatures.

- New functions/hooks
  - src/frontend/hooks/useTradingData.ts
    - export function useTradingData() : {
        market$: Observable<MarketData>,
        positionsQuery: UseQueryResult<Position[], Error>,
        tradesQuery: UseQueryResult<Trade[], Error>,
        strategiesQuery: UseQueryResult<Strategy[], Error>,
        placeOrder: (o: Order) => Promise<OrderResponse>,
        refreshAll: () => Promise<void>
      }
  - src/frontend/hooks/useWebSocketStatus.ts
    - export function useWebSocketStatus(source$: Observable<unknown>) : { status: 'connected'|'connecting'|'disconnected', latencyMs?: number, lastMessageAt?: number }
  - src/frontend/hooks/useStrategies.ts
    - export function useStrategies() : {
        list: Strategy[],
        create: (s: Strategy) => Promise<Strategy>,
        update: (s: Strategy) => Promise<Strategy>,
        remove: (id: string) => Promise<void>
      }
  - src/frontend/lib/api.ts
    - export async function getMarketData(symbol: string, tf?: Timeframe) : Promise<MarketData[]>
    - export function streamMarketData(symbol: string, tf?: Timeframe) : Observable<MarketData>
    - export async function getPositions() : Promise<Position[]>
    - export async function getTrades(params?: { symbol?: string, status?: TradeStatus, from?: string, to?: string }) : Promise<Trade[]>
    - export async function saveStrategy(s: Strategy) : Promise<Strategy>
    - export async function placeOrder(o: Order) : Promise<OrderResponse>
  - src/shared/utils/indicators.ts
    - export function sma(values: number[], period: number) : number[]
    - export function ema(values: number[], period: number) : number[]
    - export function rsi(values: number[], period?: number) : number[]
  - src/frontend/lib/chart.ts
    - export class ChartManager { constructor(el: HTMLElement); setData(data: MarketData[]): void; resize(): void; destroy(): void }
- Modified functions
  - None (all new)
- Removed functions
  - None

[Classes]
Introduces a lightweight chart manager; most UI uses functional components and hooks.

- New classes
  - src/frontend/lib/chart.ts
    - class ChartManager
      - Manages a lightweight-charts instance, creates series (line/candlestick), updates on new MarketData.
      - Methods: setData, resize, destroy.
- Modified classes
  - None (backend classes from the earlier plan remain planned but are out of scope for this dashboard milestone).
- Removed classes
  - None

[Dependencies]
Adds only the minimum required packages to implement the described UI and data flows.

- Runtime
  - @tanstack/react-query: ^5
  - rxjs: ^7
  - lightweight-charts: ^4
  - zod: ^3 (optional but recommended for validating Strategy forms)
  - dayjs: ^1 (timestamp formatting)
  - shadcn components are codegen; no extra runtime deps beyond radix primitives already present.
- Dev
  - concurrently: ^9 (used by "start" script)
  - tsx: ^4 (used by "backend" script, if/when backend is added)
  - eslint and configs if lint script will be used (optional in this milestone)

[Testing]
Uses Vitest and Testing Library to validate UI and data hooks; integration tests assert wiring between hooks and components.

- Unit tests: component rendering, props/state changes, form validation (StrategyBuilder).
- Hook tests: useTradingData (query keys, staleTime, error states), useWebSocketStatus (status transitions).
- Integration tests: Dashboard composes sections, shows live updates via mocked Observables/QueryClient.
- Optional MSW setup: to mock /api endpoints consistently across tests.

[Implementation Order]
Sequence ensures primitives and data flows exist before composing complex pages to reduce churn and risk.

1. Initialize frontend skeleton:
   - Create src/frontend/{main.tsx, App.tsx, index.css} and wire Tailwind + Shadcn variables.
   - Import index.css in main.tsx and mount <App /> to #root.
2. Add Shadcn primitives via MCP (shadcn server):
   - Use get_add_command_for_items for: accordion, alert, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, skeleton, table, tabs, textarea, toast, toggle, tooltip.
   - Generate to src/frontend/components/ui per components.json aliases.
3. Implement hooks/libs:
   - src/frontend/lib/api.ts with stubs hitting /api (or mock data if backend unavailable).
   - src/frontend/hooks/{useTradingData,useWebSocketStatus,useStrategies}.ts with types.
   - src/frontend/lib/chart.ts wrapping lightweight-charts.
4. Build feature views:
   - PortfolioDashboard: KPIs (Cards), Positions (Table), Mini Chart (ChartManager).
   - TradeHistory: Filter controls (Select/Input/Date), Table, Pagination.
   - StrategyBuilder: Form with zod validation, parameters editor, save/update.
   - StatusBar + TradeControls: Connection status, controls with confirmation dialogs.
5. Compose Dashboard.tsx and route/layout in App.tsx:
   - Tabs for "Portfolio", "Trade History", "Strategies".
   - Toaster and top navigation (Theme toggle optional).
6. Tests:
   - Unit tests for the three main components and hooks.
   - Integration test for overall Dashboard data flow (mock API and Observables).
7. Wire to backend (when available):
   - Confirm Vite proxy to /api works; toggle mock/live via env.
   - Verify streaming updates via WebSocket/RxJS and latency in StatusBar.
