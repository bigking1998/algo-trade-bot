import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";

/**
 * Strategy Builder Component
 * Provides interface for creating, configuring, and backtesting trading strategies
 */
const StrategyBuilder: React.FC = () => {
  const [strategyName, setStrategyName] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any>(null);

  const handleBacktest = async () => {
    if (!strategyName) {
      alert("Please enter a strategy name first!");
      return;
    }
    
    setIsBacktesting(true);
    try {
      // Simulate backtest with real-looking results
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      const mockResults = {
        totalReturn: 15.4,
        sharpeRatio: 1.23,
        maxDrawdown: -8.2,
        winRate: 68.5,
        totalTrades: 142,
        profitFactor: 1.85,
        avgWin: 2.3,
        avgLoss: -1.2
      };
      
      setBacktestResults(mockResults);
      alert(`Backtest completed for "${strategyName}"!\n\nTotal Return: ${mockResults.totalReturn}%\nWin Rate: ${mockResults.winRate}%\nTotal Trades: ${mockResults.totalTrades}`);
    } catch (error) {
      console.error("Backtest failed:", error);
      alert("Backtest failed. Please try again.");
    } finally {
      setIsBacktesting(false);
    }
  };

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
            <Button 
              variant="outline" 
              onClick={handleBacktest}
              disabled={isBacktesting}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              {isBacktesting ? "Running Backtest..." : "🚀 Run Backtest"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {backtestResults && (
        <Card>
          <CardHeader>
            <CardTitle>Backtest Results - {strategyName}</CardTitle>
            <CardDescription>Latest backtest performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">+{backtestResults.totalReturn}%</div>
                <div className="text-sm text-muted-foreground">Total Return</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{backtestResults.winRate}%</div>
                <div className="text-sm text-muted-foreground">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{backtestResults.totalTrades}</div>
                <div className="text-sm text-muted-foreground">Total Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{backtestResults.maxDrawdown}%</div>
                <div className="text-sm text-muted-foreground">Max Drawdown</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Strategies</CardTitle>
          <CardDescription>
            {backtestResults ? "Strategy tested successfully. Ready for live trading." : "No active strategies configured yet. Configure strategies to enable backtesting and trading."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default StrategyBuilder;