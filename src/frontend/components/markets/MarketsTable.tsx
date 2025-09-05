import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useMarkets } from "@/frontend/hooks/useDydxData";
import type { DydxMarket } from "@/shared/types/trading";

// Default symbols for market data
const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD"];

/**
 * Markets Table Component
 * Displays real market data from dYdX v4 Indexer including symbol, status,
 * oracle prices, price steps, size steps, and minimum order sizes
 */
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

export default MarketsTable;