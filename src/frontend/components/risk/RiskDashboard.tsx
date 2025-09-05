import React from "react";
import { AlertTriangle, TrendingDown, Activity, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { useRiskMetrics } from "@/frontend/hooks/useRiskData";
import PositionRiskCard from "./PositionRiskCard";
import DrawdownChart from "./DrawdownChart";
import VolatilityGauge from "./VolatilityGauge";
import RiskAlertsPanel from "./RiskAlertsPanel";
import ExposureMatrix from "./ExposureMatrix";

/**
 * Risk Overview Cards Component
 * Shows high-level risk metrics in KPI card format
 */
const RiskOverviewCards: React.FC = () => {
  const { data: riskMetrics } = useRiskMetrics();
  const updatedAt = new Date().toLocaleTimeString();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Portfolio VaR */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio VaR (1d)</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${
            (riskMetrics?.var1d || 0) > 5000 ? "text-red-500" : 
            (riskMetrics?.var1d || 0) > 2000 ? "text-yellow-500" : "text-green-500"
          }`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${riskMetrics?.var1d?.toLocaleString() || "—"}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>95% confidence • {updatedAt}</span>
          </div>
        </CardContent>
      </Card>

      {/* Maximum Drawdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
          <TrendingDown className={`h-4 w-4 ${
            (riskMetrics?.maxDrawdown || 0) > 10 ? "text-red-500" : 
            (riskMetrics?.maxDrawdown || 0) > 5 ? "text-yellow-500" : "text-green-500"
          }`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {riskMetrics?.maxDrawdown !== undefined ? `${riskMetrics.maxDrawdown.toFixed(1)}%` : "—"}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Historical peak-to-trough</span>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Volatility */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Volatility</CardTitle>
          <Activity className={`h-4 w-4 ${
            (riskMetrics?.volatility || 0) > 30 ? "text-red-500" : 
            (riskMetrics?.volatility || 0) > 20 ? "text-yellow-500" : "text-green-500"
          }`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {riskMetrics?.volatility !== undefined ? `${riskMetrics.volatility.toFixed(1)}%` : "—"}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>30-day annualized</span>
          </div>
        </CardContent>
      </Card>

      {/* Sharpe Ratio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
          <Shield className={`h-4 w-4 ${
            (riskMetrics?.sharpeRatio || 0) > 1.5 ? "text-green-500" : 
            (riskMetrics?.sharpeRatio || 0) > 0.5 ? "text-yellow-500" : "text-red-500"
          }`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {riskMetrics?.sharpeRatio !== undefined ? riskMetrics.sharpeRatio.toFixed(2) : "—"}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Risk-adjusted return</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Current Risk Status Component
 * Shows overall risk level and key warnings
 */
const RiskStatusPanel: React.FC = () => {
  const { data: riskMetrics } = useRiskMetrics();
  
  // Calculate overall risk level
  const calculateRiskLevel = () => {
    if (!riskMetrics) return { level: "unknown", color: "gray", percentage: 0 };
    
    let riskScore = 0;
    
    // VaR contribution (0-40 points)
    if (riskMetrics.var1d > 5000) riskScore += 40;
    else if (riskMetrics.var1d > 2000) riskScore += 25;
    else riskScore += 10;
    
    // Drawdown contribution (0-30 points)
    if (riskMetrics.maxDrawdown > 10) riskScore += 30;
    else if (riskMetrics.maxDrawdown > 5) riskScore += 15;
    else riskScore += 5;
    
    // Volatility contribution (0-30 points)
    if (riskMetrics.volatility > 30) riskScore += 30;
    else if (riskMetrics.volatility > 20) riskScore += 15;
    else riskScore += 5;
    
    if (riskScore >= 70) return { level: "high", color: "red", percentage: riskScore };
    if (riskScore >= 40) return { level: "medium", color: "yellow", percentage: riskScore };
    return { level: "low", color: "green", percentage: riskScore };
  };
  
  const riskStatus = calculateRiskLevel();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className={`h-5 w-5 text-${riskStatus.color}-500`} />
          Current Risk Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Risk Level</span>
          <Badge variant={riskStatus.color === "red" ? "destructive" : 
                         riskStatus.color === "yellow" ? "secondary" : "default"}>
            {riskStatus.level.toUpperCase()}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Risk Score</span>
            <span>{riskStatus.percentage}/100</span>
          </div>
          <Progress value={riskStatus.percentage} className="h-2" />
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Risk Factors</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            {riskMetrics?.var1d && riskMetrics.var1d > 2000 && (
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full bg-${riskMetrics.var1d > 5000 ? 'red' : 'yellow'}-500`} />
                High Value at Risk
              </div>
            )}
            {riskMetrics?.maxDrawdown && riskMetrics.maxDrawdown > 5 && (
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full bg-${riskMetrics.maxDrawdown > 10 ? 'red' : 'yellow'}-500`} />
                Elevated Drawdown
              </div>
            )}
            {riskMetrics?.volatility && riskMetrics.volatility > 20 && (
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full bg-${riskMetrics.volatility > 30 ? 'red' : 'yellow'}-500`} />
                High Volatility
              </div>
            )}
            {(!riskMetrics?.var1d || riskMetrics.var1d <= 2000) && 
             (!riskMetrics?.maxDrawdown || riskMetrics.maxDrawdown <= 5) && 
             (!riskMetrics?.volatility || riskMetrics.volatility <= 20) && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                All metrics within acceptable range
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Main Risk Management Dashboard Component
 * Orchestrates all risk monitoring components with responsive layout
 */
const RiskDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Risk Overview Cards */}
      <RiskOverviewCards />
      
      {/* Current Risk Status */}
      <RiskStatusPanel />
      
      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DrawdownChart />
        <VolatilityGauge />
      </div>
      
      {/* Position Risk and Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PositionRiskCard />
        <RiskAlertsPanel />
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sortino Ratio</span>
                <span className="font-medium">1.23</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Calmar Ratio</span>
                <span className="font-medium">0.89</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Consecutive Losses</span>
                <span className="font-medium">3</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Win Rate</span>
                <span className="font-medium">67%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Exposure Matrix */}
      <ExposureMatrix />
    </div>
  );
};

export default RiskDashboard;
export { RiskOverviewCards, RiskStatusPanel };