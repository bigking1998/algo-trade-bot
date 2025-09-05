import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useCandles } from "@/frontend/hooks/useDydxData";
import type { Timeframe, DydxCandle } from "@/shared/types/trading";

// Shared constants
const TF_OPTIONS: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD"];

/**
 * Market Chart Component
 * Renders true candlesticks using lightweight-charts library.
 * Displays real-time market data from dYdX with interactive chart controls.
 */
const MarketChart: React.FC = () => {
  const [symbol, setSymbol] = useState<string>("BTC-USD");
  const [tf, setTf] = useState<Timeframe>("1m");
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
        timeScale: { 
          borderColor: "rgba(120,120,120,0.2)",
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 5,
          barSpacing: 8,
          minBarSpacing: 4
        },
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
    const candles = src
      .map((c: DydxCandle) => ({
        time: Math.floor(c.time / 1000), // seconds since epoch
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .sort((a, b) => a.time - b.time); // Ensure proper time ordering
    
    // eslint-disable-next-line no-console
    console.log("MarketChart setData length:", candles.length, "latest:", candles[candles.length - 1]);
    
    seriesRef.current.setData(candles);
    
    // For 1m timeframe, zoom to show last 2 hours for better detail
    if (tf === '1m' && candles.length > 0) {
      const latest = candles[candles.length - 1].time;
      const twoHoursAgo = latest - (2 * 60 * 60); // 2 hours in seconds
      chartRef.current?.timeScale().setVisibleRange({
        from: twoHoursAgo,
        to: latest + 300 // Add 5 minutes padding to the right
      });
    } else {
      chartRef.current?.timeScale().fitContent();
    }
  }, [data, chartReady, tf]);

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

        <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
          <span>
            {isLoading
              ? "Loading candles..."
              : `Showing ${((data as DydxCandle[] | undefined)?.length ?? 0)} candles (${symbol}, ${tf})`}
          </span>
          {tf === '1m' && (
            <div className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
              <span>Live updates every 1s</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketChart;