import React, { useEffect, useRef } from "react";
import { Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { useVolatilityData } from "@/frontend/hooks/useRiskData";

interface VolatilityMetrics {
  current: number;
  daily: number;
  weekly: number;
  monthly: number;
  percentile: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Circular Gauge Component using Canvas
 */
const CircularGauge: React.FC<{ 
  value: number; 
  max: number; 
  label: string;
  color?: string;
}> = ({ value, max, label, color = '#3b82f6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 120;
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 40;
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;
    const valueAngle = startAngle + (endAngle - startAngle) * (value / max);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw background arc
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();

    // Draw value arc
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, valueAngle);
    ctx.stroke();

    // Draw center circle
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw value text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${value.toFixed(1)}%`, centerX, centerY + 5);

  }, [value, max, color]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="w-30 h-30" />
      <div className="text-xs text-muted-foreground mt-2 text-center">{label}</div>
    </div>
  );
};

/**
 * Volatility Trend Indicator
 */
const VolatilityTrend: React.FC<{ metrics: VolatilityMetrics }> = ({ metrics }) => {
  const TrendIcon = metrics.trend === 'increasing' ? TrendingUp : 
                   metrics.trend === 'decreasing' ? Activity : Activity;
  
  const trendColor = metrics.trend === 'increasing' ? 'text-red-500' : 
                    metrics.trend === 'decreasing' ? 'text-green-500' : 'text-yellow-500';

  return (
    <div className="flex items-center gap-2">
      <TrendIcon className={`h-4 w-4 ${trendColor}`} />
      <span className="text-sm capitalize">{metrics.trend}</span>
      <Badge variant="outline" className="text-xs">
        {metrics.percentile}th percentile
      </Badge>
    </div>
  );
};

/**
 * Volatility Breakdown Component
 */
const VolatilityBreakdown: React.FC<{ metrics: VolatilityMetrics }> = ({ metrics }) => {
  const periods = [
    { label: 'Daily', value: metrics.daily, max: 10 },
    { label: 'Weekly', value: metrics.weekly, max: 25 },
    { label: 'Monthly', value: metrics.monthly, max: 50 }
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Volatility Breakdown</h4>
      {periods.map(period => {
        const percentage = Math.min((period.value / period.max) * 100, 100);
        const isHigh = percentage > 75;
        const isMedium = percentage > 50;
        
        return (
          <div key={period.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{period.label}</span>
              <div className="flex items-center gap-2">
                <span>{period.value.toFixed(1)}%</span>
                {isHigh && <AlertTriangle className="h-3 w-3 text-red-500" />}
              </div>
            </div>
            <Progress 
              value={percentage} 
              className={`h-2 ${isHigh ? 'bg-red-100' : isMedium ? 'bg-yellow-100' : ''}`}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Volatility Risk Assessment
 */
const VolatilityRiskAssessment: React.FC<{ metrics: VolatilityMetrics }> = ({ metrics }) => {
  const getRiskLevel = (volatility: number) => {
    if (volatility > 40) return { level: 'Very High', color: 'destructive', score: 90 };
    if (volatility > 25) return { level: 'High', color: 'destructive', score: 75 };
    if (volatility > 15) return { level: 'Medium', color: 'secondary', score: 50 };
    if (volatility > 8) return { level: 'Low', color: 'default', score: 25 };
    return { level: 'Very Low', color: 'default', score: 10 };
  };

  const risk = getRiskLevel(metrics.current);

  const recommendations = [
    metrics.current > 30 && "Consider reducing position sizes",
    metrics.trend === 'increasing' && metrics.current > 20 && "Volatility is trending up - monitor closely",
    metrics.percentile > 90 && "Current volatility is in top 10% historically",
    metrics.current < 10 && "Low volatility may indicate range-bound markets"
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Risk Assessment</span>
        <Badge variant={risk.color as any}>{risk.level}</Badge>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Risk Score</span>
          <span>{risk.score}/100</span>
        </div>
        <Progress value={risk.score} className="h-2" />
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recommendations</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Volatility Gauge Component
 * Real-time portfolio volatility monitoring with visual gauge and breakdown
 */
const VolatilityGauge: React.FC = () => {
  const { data: volatilityData, isLoading } = useVolatilityData();

  // Mock volatility metrics for demonstration
  const mockMetrics: VolatilityMetrics = {
    current: 22.5,
    daily: 3.2,
    weekly: 12.8,
    monthly: 22.5,
    percentile: 78,
    trend: 'increasing' as const
  };

  const metrics = volatilityData || mockMetrics;
  
  const gaugeColor = metrics.current > 25 ? '#ef4444' : 
                    metrics.current > 15 ? '#f59e0b' : '#10b981';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${
              metrics.current > 25 ? 'text-red-500' : 
              metrics.current > 15 ? 'text-yellow-500' : 'text-green-500'
            }`} />
            <span>Portfolio Volatility</span>
          </div>
          {isLoading && <Badge variant="outline">Loading...</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Gauge */}
        <div className="flex justify-center">
          <CircularGauge 
            value={metrics.current}
            max={50}
            label="30-Day Volatility"
            color={gaugeColor}
          />
        </div>

        {/* Trend Indicator */}
        <div className="flex justify-center">
          <VolatilityTrend metrics={metrics} />
        </div>

        {/* Volatility Breakdown */}
        <VolatilityBreakdown metrics={metrics} />

        {/* Risk Assessment */}
        <VolatilityRiskAssessment metrics={metrics} />

        {/* High Volatility Warning */}
        {metrics.current > 30 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">High Volatility Alert</span>
            </div>
            <div className="text-xs text-red-600 dark:text-red-300 mt-1">
              Portfolio volatility exceeds 30%. Consider reducing exposure or implementing hedging strategies.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VolatilityGauge;