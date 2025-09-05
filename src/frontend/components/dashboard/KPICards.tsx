import React from "react";
import { DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useOracle, useApiHealth } from "@/frontend/hooks/useDydxData";

/**
 * API Status Card Component
 * Shows the current status of the backend API connection
 */
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

/**
 * KPI Cards Component
 * Displays key performance indicators including real oracle data for BTC and ETH,
 * along with the API connection status
 */
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

export default KPICards;
export { ApiStatusCard };