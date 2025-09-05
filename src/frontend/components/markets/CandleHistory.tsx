import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useCandles } from "@/frontend/hooks/useDydxData";
import type { Timeframe, DydxCandle } from "@/shared/types/trading";

// Shared constants
const TF_OPTIONS: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD"];

/**
 * Candle History Component
 * Displays a table of recent candlestick data from dYdX Indexer
 * with filtering and search capabilities
 */
const CandleHistory: React.FC = () => {
  const [symbol, setSymbol] = useState<string>("BTC-USD");
  const [tf, setTf] = useState<Timeframe>("1m");
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

export default CandleHistory;