"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  DollarSign,
  Activity,
  Download,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "components/ui/card";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "components/ui/tabs";
import { Input } from "components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "components/ui/table";
import { Label } from "components/ui/label";
import { Textarea } from "components/ui/textarea";
import { Separator } from "components/ui/separator";
import { Progress } from "components/ui/progress";

import { useMarkets, useOracle, useApiHealth, useCandles } from "@/frontend/hooks/useDydxData";
import type { Timeframe, DydxCandle, DydxMarket } from "@/shared/types/trading";

// Shared
const TF_OPTIONS: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD"];

// KPI Cards (now using REAL oracle data)
const KPICards: React.FC = () => {
  const oracle = useOracle();
  const updatedAt = new Date().toLocaleTimeString();

  const priceBTC = oracle.data?.["BTC-USD"];
  const priceETH = oracle.data?.["ETH-USD"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">BTC-USD Oracle</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {priceBTC !== undefined ? `$${priceBTC.toLocaleString()}` : "—"}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Updated {updatedAt}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">ETH-USD Oracle</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {priceETH !== undefined ? `$${priceETH.toLocaleString()}` : "—"}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Updated {updatedAt}</span>
          </div>
        </CardContent>
      </Card>

      <ApiStatusCard />
    </div>
  );
};

// API/Backend Status
const ApiStatusCard: React.FC = () => {
  const health = useApiHealth();

  const isUp = health.data?.status === "ok";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Backend/API</CardTitle>
        <Activity className={`h-4 w-4 ${isUp ? "text-green-500" : "text-red-500"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{isUp ? "Connected" : "Disconnected"}</div>
        <div className="flex items-center text-xs text-muted-foreground">
          <span>{isUp ? `v${health.data?.version ?? "dev"}` : "Waiting for /api/health..."}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Markets Table (REAL markets data)
const MarketsTable: React.FC = () => {
  const { data, isLoading, isError } = useMarkets(DEFAULT_SYMBOLS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Markets</CardTitle>
        <CardDescription>dYdX v4 Indexer market information</CardDescription>
      </CardHeader>
      <CardContent>
        {isError && (
          <div className="text-sm text-red-500">Failed to load markets.</div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Oracle</TableHead>
              <TableHead>Price Step</TableHead>
              <TableHead>Size Step</TableHead>
              <TableHead>Min Order Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">Loading...</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                  </TableRow>
                ))
              : (data ?? []).map((m: DydxMarket) => (
                  <TableRow key={m.symbol}>
                    <TableCell className="font-medium">{m.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.oraclePrice ? `$${m.oraclePrice.toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>{m.priceStep}</TableCell>
                    <TableCell>{m.sizeStep}</TableCell>
                    <TableCell>{m.minOrderSize}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

/**
 * MarketChart renders true candlesticks using lightweight-charts.
 * It consumes useChartCandles which sources real data (dYdX first; otherwise a real exchange).
 * No other components' data sources are modified by this change.
 */
const MarketChart: React.FC = () => {
  const [symbol, setSymbol] = useState<string>("BTC-USD");
  const [tf, setTf] = useState<Timeframe>("1h");
  const { data, isLoading, isError } = useCandles(symbol, tf);
  const [chartReady, setChartReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // Initialize chart once using CDN (avoids bundler ESM interop issues)
  useEffect(() => {
    let mounted = true;
    if (!containerRef.current || chartRef.current) return;

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js";
    script.async = true;

    script.onload = () => {
      if (!mounted || !containerRef.current) return;
      const lwc = (window as any).LightweightCharts;
      if (!lwc || typeof lwc.createChart !== "function") {
        console.error("LightweightCharts global not available");
        return;
      }

      const chart = lwc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 300,
        layout: { background: { color: "transparent" }, textColor: "#cbd5e1" },
        grid: {
          vertLines: { color: "rgba(120,120,120,0.2)" },
          horzLines: { color: "rgba(120,120,120,0.2)" },
        },
        timeScale: { borderColor: "rgba(120,120,120,0.2)" },
        rightPriceScale: { borderColor: "rgba(120,120,120,0.2)" },
        crosshair: { mode: 1 },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#16a34a",
        downColor: "#ef4444",
        borderUpColor: "#16a34a",
        borderDownColor: "#ef4444",
        wickUpColor: "#16a34a",
        wickDownColor: "#ef4444",
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);

      const ro = new ResizeObserver((entries) => {
        const cr = entries[0]?.contentRect;
        if (cr && cr.width > 0) chart.applyOptions({ width: Math.floor(cr.width) });
      });
      ro.observe(containerRef.current);
      resizeObsRef.current = ro;
    };

    document.head.appendChild(script);

    return () => {
      mounted = false;
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      try {
        document.head.removeChild(script);
      } catch {}
    };
  }, []);

  // Update series when data changes
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !chartReady) return;
    const src: DydxCandle[] = (data as DydxCandle[] | undefined) ?? [];
    const candles = src.map((c: DydxCandle) => ({
      time: Math.floor(c.time / 1000), // seconds since epoch
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    // eslint-disable-next-line no-console
    console.log("MarketChart setData length:", candles.length, "sample:", candles[0]);
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [data, chartReady]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Chart</CardTitle>
        <CardDescription>Live candles for {symbol}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <div className="w-[180px]">
            <Label className="text-xs mb-1 block">Symbol</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <Label className="text-xs mb-1 block">Timeframe</Label>
            <Select value={tf} onValueChange={(val) => setTf(val as Timeframe)}>
              <SelectTrigger>
                <SelectValue placeholder="TF" />
              </SelectTrigger>
              <SelectContent>
                {TF_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError && <div className="text-sm text-red-500">Failed to load candles.</div>}
        <div ref={containerRef} className="h-[300px] w-full rounded-md border" />

        <div className="mt-2 text-xs text-muted-foreground">
          {isLoading
            ? "Loading candles..."
            : `Showing ${((data as DydxCandle[] | undefined)?.length ?? 0)} candles (${symbol}, ${tf})`}
        </div>
      </CardContent>
    </Card>
  );
};

// Simple Candle Table (REAL data) replacing mock trade history
const CandleHistory: React.FC = () => {
  const [symbol, setSymbol] = useState<string>("BTC-USD");
  const [tf, setTf] = useState<Timeframe>("1h");
  const { data, isLoading, isError } = useCandles(symbol, tf);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-[180px]">
          <Label className="text-xs mb-1 block">Symbol</Label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger>
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_SYMBOLS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label className="text-xs mb-1 block">Timeframe</Label>
          <Select value={tf} onValueChange={(val) => setTf(val as Timeframe)}>
            <SelectTrigger>
              <SelectValue placeholder="TF" />
            </SelectTrigger>
            <SelectContent>
              {TF_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs mb-1 block">Search</Label>
          <Input placeholder="Filter by time..." />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{symbol} Candle History</CardTitle>
          <CardDescription>Most recent candles from dYdX Indexer</CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="text-sm text-red-500">Failed to load candles.</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>High</TableHead>
                <TableHead>Low</TableHead>
                <TableHead>Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>Loading...</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                    </TableRow>
                  ))
                : ((data as DydxCandle[] | undefined) ?? [])
                    .slice()
                    .reverse()
                    .slice(0, 50)
                    .map((c: DydxCandle) => (
                      <TableRow key={c.time}>
                        <TableCell>{new Date(c.time).toLocaleString()}</TableCell>
                        <TableCell>{c.open}</TableCell>
                        <TableCell>{c.high}</TableCell>
                        <TableCell>{c.low}</TableCell>
                        <TableCell className="font-medium">{c.close}</TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Strategy Builder (keep UI, remove mock list to avoid mock data)
const StrategyBuilder: React.FC = () => {
  const [strategyName, setStrategyName] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Strategy Builder</CardTitle>
          <CardDescription>Create and manage your trading strategies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="strategy-name">Strategy Name</Label>
              <Input
                id="strategy-name"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="Enter strategy name"
              />
            </div>
            <div>
              <Label htmlFor="strategy-type">Strategy Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="momentum">Momentum</SelectItem>
                  <SelectItem value="mean-reversion">Mean Reversion</SelectItem>
                  <SelectItem value="grid">Grid Trading</SelectItem>
                  <SelectItem value="arbitrage">Arbitrage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="strategy-description">Description</Label>
            <Textarea
              id="strategy-description"
              value={strategyDescription}
              onChange={(e) => setStrategyDescription(e.target.value)}
              placeholder="Describe your strategy..."
              rows={3}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                <Input id="stop-loss" type="number" placeholder="2.5" />
              </div>
              <div>
                <Label htmlFor="take-profit">Take Profit (%)</Label>
                <Input id="take-profit" type="number" placeholder="5.0" />
              </div>
              <div>
                <Label htmlFor="position-size">Position Size (%)</Label>
                <Input id="position-size" type="number" placeholder="10" />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button>Save Strategy</Button>
            <Button variant="outline">Test Backtest</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Strategies</CardTitle>
          <CardDescription>
            No active strategies configured yet. Configure strategies to enable backtesting and trading.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

// Status Bar (shows internal state + API connectivity)
const StatusBar: React.FC = () => {
  const health = useApiHealth();
  const isUp = health.data?.status === "ok";
  const [botStatus, setBotStatus] = useState<"running" | "paused" | "stopped">("running");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Bot Status</CardTitle>
        <CardDescription>Monitor and control your trading bot</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  botStatus === "running" ? "bg-green-500" : botStatus === "paused" ? "bg-yellow-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm font-medium">
                Bot Status: {botStatus.charAt(0).toUpperCase() + botStatus.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isUp ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm font-medium">API: {isUp ? "Connected" : "Disconnected"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={botStatus === "running" ? "secondary" : "default"}
              size="sm"
              onClick={() => setBotStatus(botStatus === "running" ? "paused" : "running")}
            >
              {botStatus === "running" ? "Pause" : "Start"}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBotStatus("stopped")}>
              Stop
            </Button>
            <Button variant="outline" size="sm">Refresh</Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>CPU Usage</span>
            <span>—</span>
          </div>
          <Progress value={15} className="h-2" />

          <div className="flex justify-between text-sm">
            <span>Memory Usage</span>
            <span>—</span>
          </div>
          <Progress value={30} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
};

// Main Dashboard Component
const TradingBotDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trading Bot Dashboard</h1>
            <p className="text-muted-foreground">Monitor and use real market data from dYdX v4</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Reports
            </Button>
          </div>
        </div>

        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="portfolio">Markets</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="space-y-6">
            <KPICards />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <MarketsTable />
                <StatusBar />
              </div>
              <MarketChart />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <CandleHistory />
          </TabsContent>

          <TabsContent value="strategies">
            <StrategyBuilder />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TradingBotDashboard;
