import React from "react";
import { Network, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useExposureMatrix } from "@/frontend/hooks/useRiskData";

interface ExposureData {
  symbol: string;
  exposure: number;
  percentage: number;
  correlation: { [key: string]: number };
  sector?: string;
  strategy?: string;
}

interface CorrelationMatrix {
  [symbol: string]: { [otherSymbol: string]: number };
}

/**
 * Correlation Matrix Heatmap Component
 */
const CorrelationHeatmap: React.FC<{ 
  correlations: CorrelationMatrix;
  symbols: string[];
}> = ({ correlations, symbols }) => {
  const getCorrelationColor = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr > 0.8) return correlation > 0 ? 'bg-red-500' : 'bg-blue-500';
    if (absCorr > 0.6) return correlation > 0 ? 'bg-red-400' : 'bg-blue-400';
    if (absCorr > 0.4) return correlation > 0 ? 'bg-red-300' : 'bg-blue-300';
    if (absCorr > 0.2) return correlation > 0 ? 'bg-red-200' : 'bg-blue-200';
    return 'bg-gray-100 dark:bg-gray-800';
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Correlation Matrix</h4>
      <div className="overflow-x-auto">
        <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${symbols.length}, 1fr)` }}>
          {/* Header row */}
          <div></div>
          {symbols.map(symbol => (
            <div key={symbol} className="text-xs font-medium text-center py-1">
              {symbol.split('-')[0]}
            </div>
          ))}
          
          {/* Matrix rows */}
          {symbols.map(rowSymbol => (
            <React.Fragment key={rowSymbol}>
              <div className="text-xs font-medium py-2 pr-2 text-right">
                {rowSymbol.split('-')[0]}
              </div>
              {symbols.map(colSymbol => {
                const correlation = correlations[rowSymbol]?.[colSymbol] ?? 
                                  (rowSymbol === colSymbol ? 1 : 0);
                const isHighCorrelation = Math.abs(correlation) > 0.7 && rowSymbol !== colSymbol;
                
                return (
                  <div 
                    key={colSymbol}
                    className={`h-8 flex items-center justify-center rounded text-xs font-medium text-white relative ${getCorrelationColor(correlation)}`}
                    title={`${rowSymbol} vs ${colSymbol}: ${correlation.toFixed(2)}`}
                  >
                    {rowSymbol === colSymbol ? '1.0' : correlation.toFixed(1)}
                    {isHighCorrelation && (
                      <AlertCircle className="h-3 w-3 absolute -top-1 -right-1 text-yellow-400" />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>High Positive</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>High Negative</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <span>Low</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Position Concentration Chart
 */
const ConcentrationChart: React.FC<{ exposures: ExposureData[] }> = ({ exposures }) => {
  const totalExposure = exposures.reduce((sum, exp) => sum + Math.abs(exp.exposure), 0);
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Position Concentration</h4>
      <div className="space-y-2">
        {exposures.map((exposure) => {
          const percentage = totalExposure > 0 ? (Math.abs(exposure.exposure) / totalExposure) * 100 : 0;
          const isHighConcentration = percentage > 25;
          const isLong = exposure.exposure > 0;
          
          return (
            <div key={exposure.symbol} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{exposure.symbol}</span>
                  <Badge variant={isLong ? "default" : "secondary"} className="text-xs">
                    {isLong ? 'LONG' : 'SHORT'}
                  </Badge>
                  {exposure.sector && (
                    <Badge variant="outline" className="text-xs">
                      {exposure.sector}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>${Math.abs(exposure.exposure).toLocaleString()}</span>
                  <span className="text-muted-foreground">({percentage.toFixed(1)}%)</span>
                  {isHighConcentration && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              <Progress 
                value={percentage} 
                className={`h-2 ${isHighConcentration ? 'bg-red-100 dark:bg-red-900/20' : ''}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Sector Allocation Component
 */
const SectorAllocation: React.FC<{ exposures: ExposureData[] }> = ({ exposures }) => {
  // Group exposures by sector
  const sectorExposures = exposures.reduce((acc, exp) => {
    const sector = exp.sector || 'Unknown';
    acc[sector] = (acc[sector] || 0) + Math.abs(exp.exposure);
    return acc;
  }, {} as Record<string, number>);

  const totalExposure = Object.values(sectorExposures).reduce((sum, exp) => sum + exp, 0);
  const sectors = Object.entries(sectorExposures)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8); // Top 8 sectors

  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Sector Allocation</h4>
      <div className="grid grid-cols-2 gap-2">
        {sectors.map(([sector, exposure], index) => {
          const percentage = totalExposure > 0 ? (exposure / totalExposure) * 100 : 0;
          const isOverAllocated = percentage > 40;
          
          return (
            <div key={sector} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`} />
              <div className="flex-1">
                <div className="flex justify-between text-xs">
                  <span>{sector}</span>
                  <span className={isOverAllocated ? 'text-red-500 font-medium' : ''}>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Risk Concentration Warnings
 */
const RiskWarnings: React.FC<{ 
  exposures: ExposureData[]; 
  correlations: CorrelationMatrix;
}> = ({ exposures, correlations }) => {
  const warnings: string[] = [];

  // Check for high concentration
  const totalExposure = exposures.reduce((sum, exp) => sum + Math.abs(exp.exposure), 0);
  exposures.forEach(exp => {
    const percentage = totalExposure > 0 ? (Math.abs(exp.exposure) / totalExposure) * 100 : 0;
    if (percentage > 30) {
      warnings.push(`High concentration in ${exp.symbol} (${percentage.toFixed(1)}%)`);
    }
  });

  // Check for high correlations
  exposures.forEach(exp1 => {
    exposures.forEach(exp2 => {
      if (exp1.symbol !== exp2.symbol) {
        const correlation = correlations[exp1.symbol]?.[exp2.symbol] || 0;
        if (Math.abs(correlation) > 0.8) {
          warnings.push(`High correlation between ${exp1.symbol} and ${exp2.symbol} (${correlation.toFixed(2)})`);
        }
      }
    });
  });

  // Remove duplicates
  const uniqueWarnings = [...new Set(warnings)];

  if (uniqueWarnings.length === 0) return null;

  return (
    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Risk Concentration Warnings</span>
      </div>
      <div className="space-y-1">
        {uniqueWarnings.slice(0, 3).map((warning, index) => (
          <div key={index} className="text-xs text-yellow-600 dark:text-yellow-300">
            • {warning}
          </div>
        ))}
        {uniqueWarnings.length > 3 && (
          <div className="text-xs text-yellow-600 dark:text-yellow-300">
            ... and {uniqueWarnings.length - 3} more warnings
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Exposure Matrix Component
 * Displays position correlation analysis and concentration risk monitoring
 */
const ExposureMatrix: React.FC = () => {
  const { data: matrixData, isLoading } = useExposureMatrix();

  // Mock data for demonstration
  const mockExposures: ExposureData[] = [
    {
      symbol: 'BTC-USD',
      exposure: 25000,
      percentage: 40,
      correlation: { 'ETH-USD': 0.82, 'SOL-USD': 0.65, 'AVAX-USD': 0.58 },
      sector: 'Cryptocurrency',
      strategy: 'Trend Following'
    },
    {
      symbol: 'ETH-USD',
      exposure: -15000,
      percentage: 25,
      correlation: { 'BTC-USD': 0.82, 'SOL-USD': 0.73, 'AVAX-USD': 0.68 },
      sector: 'Cryptocurrency',
      strategy: 'Mean Reversion'
    },
    {
      symbol: 'SOL-USD',
      exposure: 12000,
      percentage: 20,
      correlation: { 'BTC-USD': 0.65, 'ETH-USD': 0.73, 'AVAX-USD': 0.89 },
      sector: 'Cryptocurrency',
      strategy: 'Scalping'
    },
    {
      symbol: 'AVAX-USD',
      exposure: 8000,
      percentage: 15,
      correlation: { 'BTC-USD': 0.58, 'ETH-USD': 0.68, 'SOL-USD': 0.89 },
      sector: 'Cryptocurrency',
      strategy: 'Arbitrage'
    }
  ];

  const exposures = matrixData?.exposures || mockExposures;
  const symbols = exposures.map(exp => exp.symbol);
  
  // Build correlation matrix
  const correlations: CorrelationMatrix = {};
  exposures.forEach(exp => {
    correlations[exp.symbol] = {
      [exp.symbol]: 1,
      ...exp.correlation
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-muted-foreground" />
            <span>Exposure & Correlation Analysis</span>
          </div>
          {isLoading && <Badge variant="outline">Loading...</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="correlation" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
            <TabsTrigger value="concentration">Concentration</TabsTrigger>
            <TabsTrigger value="sectors">Sectors</TabsTrigger>
          </TabsList>

          <TabsContent value="correlation" className="space-y-4">
            <CorrelationHeatmap correlations={correlations} symbols={symbols} />
            <RiskWarnings exposures={exposures} correlations={correlations} />
          </TabsContent>

          <TabsContent value="concentration" className="space-y-4">
            <ConcentrationChart exposures={exposures} />
          </TabsContent>

          <TabsContent value="sectors" className="space-y-4">
            <SectorAllocation exposures={exposures} />
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Largest Position</div>
                <div className="font-medium">
                  {exposures[0]?.symbol} ({exposures[0]?.percentage}%)
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Diversification Score</div>
                <div className="font-medium">
                  {symbols.length > 5 ? 'Good' : symbols.length > 3 ? 'Fair' : 'Poor'}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ExposureMatrix;