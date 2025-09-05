import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { useApiHealth } from "@/frontend/hooks/useDydxData";

/**
 * Status Bar Component
 * Displays trading bot status, API connection status, and system metrics
 */
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

export default StatusBar;