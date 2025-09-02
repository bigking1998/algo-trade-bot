# Implementation Plan

[Overview]
Integrate dYdX v4 mainnet live market data, wallet connectivity, backtesting, and in-app order placement into the existing Shadcn-based React frontend while preserving current UI patterns and components. A minimal Node backend (served at /api via Vite proxy) will proxy Indexer REST/WS and expose order/backtest endpoints. Phantom wallet will be supported for identity and exchange deep-links; Keplr will be added for Cosmos-based signing required by dYdX v4 on mainnet. Initial scope covers BTC-USD and ETH-USD with timeframes 1d, 4h, 1h, 30m, 15m, 5m, 1m.

This implementation keeps the frontend intact, uses Shadcn MCP guidance before any new primitives, and focuses on functionality: real historical/live data for backtesting, wallet connection, and in-app order placement (with appropriate signing flow for v4).

[Types]  
Introduce v4-specific market, candle, wallet, and order models while preserving existing shared types.

- Enums
  - enum Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'
  - enum DydxNetwork = 'mainnet' | 'testnet'
  - enum OrderSide = 'BUY' | 'SELL'
  - enum OrderType = 'market' | 'limit'
  - enum TimeInForce = 'GTC' | 'IOC' | 'FOK'
  - enum OrderStatus = 'accepted' | 'rejected' | 'filled' | 'partially_filled' | 'canceled'
- Interfaces (append to src/shared/types/trading.ts without breaking existing)
  - DydxMarket
    - symbol: string (e.g., 'BTC-USD')
    - status: 'ACTIVE' | 'PAUSED'
    - oraclePrice: number
    - priceStep: number
    - sizeStep: number
    - minOrderSize: number
  - DydxCandle
    - time: number (epoch ms)
    - open: number
    - high: number
    - low: number
    - close: number
    - volume?: number
    - timeframe: Timeframe
    - symbol: string
  - WalletInfo
    - address: string
    - network: DydxNetwork
    - balances: Record<string, number>
    - connected: boolean
    - provider: 'phantom' | 'keplr'
  - OrderRequest
    - symbol: string
    - side: OrderSide
    - type: OrderType
    - size: number (> 0)
    - price?: number (> 0 when type='limit')
    - tif?: TimeInForce (default 'GTC')
    - clientId?: string
  - OrderResponse
    - id: string
    - status: OrderStatus
    - reason?: string
  - BacktestRequest
    - symbol: string ('BTC-USD' | 'ETH-USD')
    - timeframe: Timeframe
    - from: string (ISO)
    - to: string (ISO)
    - strategyId: string
    - params: Record<string, number | string | boolean>
  - BacktestResult
    - trades: Trade[]
    - metrics: { totalPnl: number; winRate: number; maxDrawdown: number; sharpe?: number }
- Validation Rules
  - Optional zod schemas for OrderRequest, BacktestRequest, Strategy: enforce size/price > 0, timeframe whitelist, symbol whitelist, and parameter constraints.
  - Timeframe mapping to dYdX Indexer resolutions:
    - 1m: '1MIN', 5m: '5MIN', 15m: '15MIN', 30m: '30MIN', 1h: '1HOUR', 4h: '4HOUR', 1d: '1DAY'

[Files]
Create backend proxies/gateways and minimal frontend data/wallet layers. Preserve existing Shadcn components; consult Shadcn MCP before adding new primitives.

- New backend files
  - src/backend/server.ts — App bootstrap (Hono or Express), CORS, JSON, mounts routes, WS bridge
  - src/backend/dydx/indexerClient.ts — REST wrappers:
    - export async function getMarkets(): Promise<DydxMarket[]>
    - export async function getCandles(symbol: string, tf: Timeframe, params?: { from?: string; to?: string }): Promise<DydxCandle[]>
    - export async function getOraclePrices(): Promise<Record<string, number>>
  - src/backend/dydx/wsGateway.ts — WebSocket proxy to wss://indexer.dydx.trade/v4/ws
    - export class DydxWsGateway { connect(); subscribeCandles(symbol: string, tf: Timeframe); subscribeMarkets(symbols: string[]); broadcast(); }
  - src/backend/routes/dydx.ts — REST routes:
    - GET /api/dydx/markets
    - GET /api/dydx/candles?symbol=BTC-USD&tf=1m&from=...&to=...
    - GET /api/dydx/oracle
  - src/backend/routes/wallet.ts — Wallet helpers (balance lookup via Indexer account endpoints as available)
    - GET /api/wallet/:address
  - src/backend/routes/orders.ts — Order placement (server orchestrates building tx payloads; signs client-side via Keplr flow; backend forwards signed tx)
    - POST /api/orders (body: OrderRequest + signed payload metadata)
  - src/backend/routes/backtest.ts — POST /api/backtest (fetch candles + run strategy; returns BacktestResult)
  - src/backend/strategies/emaCross.ts — reference strategy (SMA/EMA/RSI helpers)
  - src/backend/util/timeframe.ts — mapping between Timeframe and Indexer resolution constants
- New frontend files
  - src/frontend/lib/api/dydx.ts — REST client wrappers calling /api:
    - getMarkets, getCandles, getOraclePrices, submitOrder, getWallet
  - src/frontend/hooks/useDydxData.ts — React Query hooks + RxJS stream integration for candles/markets
  - src/frontend/wallet/phantom.ts — connect Phantom (identity/deeplink to https://dydx.trade/trade/{symbol})
  - src/frontend/wallet/keplr.ts — connect Keplr (Cosmos signing for v4), expose signAndBroadcast helper
  - src/frontend/components/wallet/ConnectWalletButton.tsx — Shadcn button + status (uses existing Shadcn primitives; consult MCP)
  - src/frontend/components/BacktestPanel.tsx — Shadcn form for BacktestRequest; results table
  - src/frontend/components/OrderTicket.tsx — Shadcn form for OrderRequest (symbol/side/size/price/tif)
- Existing files to be modified (minimal)
  - src/shared/types/trading.ts — append types listed in [Types] section (keep existing interfaces intact)
  - src/frontend/components/PortfolioDashboard.tsx — show oracle price and wallet equity (non-invasive)
  - src/frontend/components/TradeHistory.tsx — optionally render backtest trades when no live trades
  - src/frontend/components/StrategyBuilder.tsx — add BacktestPanel integration point via tabs/section
  - components.json — keep as-is; ensure "hooks": "@/frontend/hooks" path exists
  - tsconfig.json — already includes "types": ["vite/client"] and path aliases OK
  - vite.config.ts — keep existing /api proxy to http://localhost:3001
- No files deleted/moved

[Functions]
Add precise functions across backend/frontend to support data, streaming, wallet, backtesting, and orders.

- Backend (new)
  - getMarkets(): Promise<DydxMarket[]> — src/backend/dydx/indexerClient.ts
  - getCandles(symbol: string, tf: Timeframe, params): Promise<DydxCandle[]> — same file
  - getOraclePrices(): Promise<Record<string, number>> — same file
  - runBacktest(req: BacktestRequest): Promise<BacktestResult> — src/backend/routes/backtest.ts
  - submitOrder(req: OrderRequest, signed: unknown): Promise<OrderResponse> — src/backend/routes/orders.ts
  - DydxWsGateway.subscribeCandles(symbol: string, tf: Timeframe): void — src/backend/dydx/wsGateway.ts
  - DydxWsGateway.subscribeMarkets(symbols: string[]): void — same
- Frontend (new)
  - getMarkets(): Promise<DydxMarket[]> — src/frontend/lib/api/dydx.ts
  - getCandles(symbol: string, tf: Timeframe, range): Promise<DydxCandle[]> — same
  - getOraclePrices(): Promise<Record<string, number>> — same
  - submitOrder(order: OrderRequest, signer?: (bytes: Uint8Array) => Promise<Uint8Array>): Promise<OrderResponse> — same
  - connectPhantom(): Promise<WalletInfo> — src/frontend/wallet/phantom.ts
  - connectKeplr(): Promise<WalletInfo> and signAndBroadcast(msgs, fee): Promise<{ txHash: string }> — src/frontend/wallet/keplr.ts
  - useDydxData()
    - marketsQuery: UseQueryResult<DydxMarket[], Error>
    - candlesQuery: UseQueryResult<DydxCandle[], Error>
    - stream$: Observable<{ channel: 'markets' | 'candles'; symbol: string; payload: unknown }>

[Classes]
Encapsulate Indexer WS proxy server-side; keep frontend functional.

- New classes
  - src/backend/dydx/wsGateway.ts
    - class DydxWsGateway { constructor(url = 'wss://indexer.dydx.trade/v4/ws'); connect(): void; subscribeCandles(symbol, tf): void; subscribeMarkets(symbols): void; broadcast(msg): void; close(): void }
- Modified classes
  - None (reuse any existing ChartManager in src/frontend/components/ui/chart.tsx or wrap data into current chart component)

[Dependencies]
Add minimal new packages; keep Shadcn setup intact.

- Backend (runtime)
  - hono (or express) and ws
  - undici (or axios) for REST calls
  - zod (optional validation)
  - dayjs (time utilities)
- Frontend (runtime)
  - @tanstack/react-query (already present)
  - rxjs (already present)
  - zod (already present)
  - dayjs (already present)
  - @keplr-wallet/types (types-only for Keplr integration)
- Dev
  - none beyond existing (tsx, concurrently). Ensure backend script points to src/backend/server.ts (already set).

[Testing]
Cover data formatting, WS flows, wallet connection, and end-to-end backtesting.

- Unit tests (backend)
  - indexerClient: markets/candles shape from Indexer responses
  - timeframe mapping utility
  - backtest strategy metrics consistency (fixtures)
- Unit tests (frontend)
  - useDydxData query keys/caching and error states (mock /api)
  - wallet connectors (phantom/keplr) stubs
  - OrderTicket form validation
- Integration tests
  - /api/dydx endpoints with mocked network
  - POST /api/backtest end-to-end returning BacktestResult
  - WS gateway broadcast to a client and UI subscription updates
- UI tests
  - ConnectWalletButton (connected/disconnected)
  - BacktestPanel submission and result rendering
  - OrderTicket submit happy/error paths

[Implementation Order]
Sequence to deliver real data quickly, then wallet and orders, without disrupting existing UI.

1) Backend scaffolding
   - server.ts with /api health check
   - indexerClient.ts: getMarkets/getCandles/getOraclePrices
   - routes/dydx.ts wiring and timeframe mapping utility
2) Frontend data layer
   - lib/api/dydx.ts and hooks/useDydxData.ts
   - Non-invasive UI wiring: show oracle prices and latest candles in PortfolioDashboard
3) Wallet connectivity
   - phantom.ts (identity + deep link), keplr.ts (signing for orders on v4)
   - ConnectWalletButton using Shadcn components (consult Shadcn MCP)
4) Streaming
   - wsGateway for markets/candles; client subscribe in useDydxData; StatusBar latency via useWebSocketStatus
5) Backtesting
   - POST /api/backtest with emaCross; BacktestPanel UI in Strategies/Builder area
6) Order placement
   - OrderTicket UI (Shadcn), submitOrder flow: build order, client-side sign with Keplr, submit to /api/orders
   - Feature flag for live trading on mainnet; safeguards (min size, confirm dialogs)
7) Hardening & tests
   - zod validations, retries, error handling
   - Unit/integration/UI tests as listed
