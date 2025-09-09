"use client";

import React, { useState } from "react";
import { Moon, Sun, BarChart3 } from "lucide-react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

// Extracted Components
import KPICards from "./components/dashboard/KPICards";
import StatusBar from "./components/dashboard/StatusBar";
import MarketsTable from "./components/markets/MarketsTable";
import MarketChart from "./components/charts/MarketChart";
import StrategyBuilder from "./components/trading/StrategyBuilder";
import RiskDashboard from "./components/risk/RiskDashboard";
import { PositionManagement } from "./components/positions";
import { ProfessionalTradingWorkspace } from "./components/trading/ProfessionalTradingWorkspace";
import { InstitutionalDashboard } from "./components/institutional";

// Hooks
import { usePhantomWallet } from "@/frontend/hooks/usePhantomWallet";

// Placeholder components for the remaining functionality (to be extracted later)
const AutoTradingDashboard: React.FC<any> = () => (
  <div className="p-6 text-center text-muted-foreground">
    Auto Trading Dashboard - To be refactored
  </div>
);

const AdvancedTradingInterface: React.FC = () => (
  <ProfessionalTradingWorkspace />
);

const ActiveOrdersTab: React.FC = () => (
  <PositionManagement />
);

const OrderBook: React.FC = () => (
  <PositionManagement />
);

const TradeHistoryTab: React.FC = () => (
  <PositionManagement />
);


const AdvancedAnalytics: React.FC = () => (
  <div className="p-6 text-center text-muted-foreground">
    Advanced Analytics - To be refactored
  </div>
);

const PaperTradingDashboard: React.FC<{ darkMode: boolean }> = () => (
  <div className="p-6 text-center text-muted-foreground">
    Paper Trading Dashboard - To be refactored
  </div>
);

const PortfolioOverview: React.FC = () => (
  <div className="p-6 text-center text-muted-foreground">
    Portfolio Overview - To be refactored
  </div>
);

const MarketStatistics: React.FC = () => (
  <div className="p-6 text-center text-muted-foreground">
    Market Statistics - To be refactored
  </div>
);

const BacktestEngine: React.FC = () => (
  <div className="p-6 text-center text-muted-foreground">
    Backtest Engine - To be refactored
  </div>
);

const StrategyPerformance: React.FC = () => (
  <div className="p-6 text-center text-muted-foreground">
    Strategy Performance - To be refactored
  </div>
);

const StrategyLibrary: React.FC = () => (
  <div className="p-6 text-center text-muted-foreground">
    Strategy Library - To be refactored
  </div>
);

/**
 * Main Trading Bot Dashboard Component
 * Orchestrates all trading functionality with tabbed interface
 */
const TradingBotDashboard: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const wallet = usePhantomWallet();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark", !darkMode);
  };

  return (
    <div className={`min-h-screen transition-colors ${darkMode ? "dark bg-gray-900 text-white" : "bg-white text-black"}`}>
      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold">Algorithmic Trading Bot</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Wallet Connection */}
            <Button
              onClick={wallet.connected ? wallet.disconnect : wallet.connect}
              variant={wallet.connected ? "secondary" : "default"}
              disabled={wallet.connecting || !wallet.isPhantomInstalled}
            >
              {wallet.connecting
                ? "Connecting..."
                : wallet.connected
                ? `Connected: ${wallet.publicKey?.slice(0, 8)}...`
                : wallet.isPhantomInstalled
                ? "Connect Phantom"
                : "Install Phantom"}
            </Button>

            {/* Dark Mode Toggle */}
            <Button variant="outline" size="icon" onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="auto-trading" className="space-y-4">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="auto-trading">Auto Trading</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="institutional">Institutional</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="paper-trading">Paper Trading</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="markets">Markets</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Auto Trading Tab */}
          <TabsContent value="auto-trading" className="space-y-6">
            <KPICards />
            <AutoTradingDashboard {...wallet} />
          </TabsContent>

          {/* Professional Trading Tab */}
          <TabsContent value="professional" className="h-full">
            <ProfessionalTradingWorkspace />
          </TabsContent>

          {/* Institutional Dashboard Tab */}
          <TabsContent value="institutional" className="h-full">
            <InstitutionalDashboard />
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-6">
            <PositionManagement />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="trade">Advanced Trade</TabsTrigger>
                <TabsTrigger value="orders">Active Orders</TabsTrigger>
                <TabsTrigger value="book">Order Book</TabsTrigger>
                <TabsTrigger value="history">Trade History</TabsTrigger>
                <TabsTrigger value="risk">Risk Mgmt</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <KPICards />
              </TabsContent>

              <TabsContent value="trade">
                <AdvancedTradingInterface />
              </TabsContent>

              <TabsContent value="orders">
                <ActiveOrdersTab />
              </TabsContent>

              <TabsContent value="book">
                <OrderBook />
              </TabsContent>

              <TabsContent value="history">
                <TradeHistoryTab />
              </TabsContent>

              <TabsContent value="risk">
                <RiskDashboard />
              </TabsContent>

              <TabsContent value="analytics">
                <AdvancedAnalytics />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Paper Trading Tab */}
          <TabsContent value="paper-trading" className="space-y-6">
            <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="trade">Advanced Trade</TabsTrigger>
                <TabsTrigger value="orders">Active Orders</TabsTrigger>
                <TabsTrigger value="book">Order Book</TabsTrigger>
                <TabsTrigger value="history">Trade History</TabsTrigger>
                <TabsTrigger value="risk">Risk Mgmt</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <PaperTradingDashboard darkMode={darkMode} />
              </TabsContent>

              <TabsContent value="trade">
                <AdvancedTradingInterface />
              </TabsContent>

              <TabsContent value="orders">
                <ActiveOrdersTab />
              </TabsContent>

              <TabsContent value="book">
                <OrderBook />
              </TabsContent>

              <TabsContent value="history">
                <TradeHistoryTab />
              </TabsContent>

              <TabsContent value="risk">
                <RiskDashboard />
              </TabsContent>

              <TabsContent value="analytics">
                <AdvancedAnalytics />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            <PortfolioOverview />
          </TabsContent>

          {/* Markets Tab */}
          <TabsContent value="markets" className="space-y-6">
            <KPICards />
            <MarketStatistics />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <MarketsTable />
                <StatusBar />
              </div>
              <MarketChart />
            </div>
          </TabsContent>

          {/* Strategies Tab */}
          <TabsContent value="strategies" className="space-y-6">
            <Tabs defaultValue="builder" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="builder">Strategy Builder</TabsTrigger>
                <TabsTrigger value="backtest">Backtest</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="library">Strategy Library</TabsTrigger>
              </TabsList>

              <TabsContent value="builder">
                <StrategyBuilder />
              </TabsContent>

              <TabsContent value="backtest">
                <BacktestEngine />
              </TabsContent>

              <TabsContent value="performance">
                <StrategyPerformance />
              </TabsContent>

              <TabsContent value="library">
                <StrategyLibrary />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TradingBotDashboard;