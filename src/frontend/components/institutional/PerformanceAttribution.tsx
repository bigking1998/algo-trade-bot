import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Progress } from 'components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import {
  TrendingUp, TrendingDown, BarChart3, PieChart, Target, Users, 
  Activity, Award, DollarSign, Percent, ArrowUpRight, ArrowDownRight,
  Calendar, Download, RefreshCw, Filter, Layers, MapPin
} from 'lucide-react';

import {
  PerformanceAttribution as PerfAttribution,
  ManagerContribution,
  SectorContribution,
  Manager,
  Strategy,
  AssetClass,
  DateRange,
  PerformanceMetrics,
  BenchmarkData
} from '../../types/institutional';

interface PerformanceAttributionProps {
  attribution: PerfAttribution;
  managers: Manager[];
  strategies: Strategy[];
  assetClasses: AssetClass[];
  benchmarks: BenchmarkData[];
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onExportData: () => Promise<void>;
  className?: string;
}

export const PerformanceAttribution: React.FC<PerformanceAttributionProps> = ({
  attribution,
  managers,
  strategies,
  assetClasses,
  benchmarks,
  dateRange,
  onDateRangeChange,
  onExportData,
  className = ""
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(attribution.period);
  const [selectedBenchmark, setSelectedBenchmark] = useState(benchmarks[0]?.id || '');
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'contribution' | 'excess' | 'allocation'>('contribution');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Format utilities
  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatBps = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(0)} bps`;
  };

  const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const getPerformanceColor = (value: number): string => {
    if (value > 0.5) return 'text-green-600';
    if (value > 0) return 'text-green-500';
    if (value > -0.5) return 'text-red-500';
    return 'text-red-600';
  };

  const getContributionIcon = (value: number) => {
    return value >= 0 ? (
      <ArrowUpRight className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDownRight className="h-4 w-4 text-red-600" />
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period as PerfAttribution['period']);
    onDateRangeChange({
      ...dateRange,
      period: period as DateRange['period']
    });
  };

  // Sort functions
  const sortedManagerContributions = [...attribution.managerContributions].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'managerName') {
      aValue = a.managerName;
      bValue = b.managerName;
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : -1;
    } else {
      return aValue > bValue ? 1 : -1;
    }
  });

  const sortedSectorContributions = [...attribution.sectorContributions].sort((a, b) => {
    const aValue = a[sortBy] || a.contribution;
    const bValue = b[sortBy] || b.contribution;
    
    if (sortOrder === 'desc') {
      return bValue - aValue;
    } else {
      return aValue - bValue;
    }
  });

  // Calculate contribution statistics
  const totalPositiveContribution = attribution.managerContributions
    .filter(m => m.contribution > 0)
    .reduce((sum, m) => sum + m.contribution, 0);

  const totalNegativeContribution = attribution.managerContributions
    .filter(m => m.contribution < 0)
    .reduce((sum, m) => sum + m.contribution, 0);

  const topPerformer = sortedManagerContributions[0];
  const worstPerformer = sortedManagerContributions[sortedManagerContributions.length - 1];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Performance Attribution</h1>
          <p className="text-muted-foreground">
            Detailed analysis of portfolio performance by manager, strategy, and asset class
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select benchmark" />
            </SelectTrigger>
            <SelectContent>
              {benchmarks.map(benchmark => (
                <SelectItem key={benchmark.id} value={benchmark.id}>
                  {benchmark.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={onExportData}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            <TrendingUp className={`h-4 w-4 ${getPerformanceColor(attribution.totalReturn)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(attribution.totalReturn)}`}>
              {formatPercent(attribution.totalReturn)}
            </div>
            <p className="text-xs text-muted-foreground">
              Portfolio performance for period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Excess Return</CardTitle>
            <Target className={`h-4 w-4 ${getPerformanceColor(attribution.excessReturn)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(attribution.excessReturn)}`}>
              {formatPercent(attribution.excessReturn)}
            </div>
            <p className="text-xs text-muted-foreground">
              vs. Benchmark ({formatPercent(attribution.benchmark)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asset Allocation</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(attribution.attributionBreakdown.assetAllocation)}`}>
              {formatBps(attribution.attributionBreakdown.assetAllocation)}
            </div>
            <p className="text-xs text-muted-foreground">
              Attribution from allocation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Selection</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(attribution.attributionBreakdown.securitySelection)}`}>
              {formatBps(attribution.attributionBreakdown.securitySelection)}
            </div>
            <p className="text-xs text-muted-foreground">
              Attribution from selection
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="breakdown">Attribution Breakdown</TabsTrigger>
          <TabsTrigger value="managers">Manager Analysis</TabsTrigger>
          <TabsTrigger value="strategies">Strategy Analysis</TabsTrigger>
          <TabsTrigger value="sectors">Sector Analysis</TabsTrigger>
          <TabsTrigger value="timeline">Performance Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attribution Analysis</CardTitle>
                <CardDescription>
                  Breakdown of performance sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-sm">Asset Allocation</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${getPerformanceColor(attribution.attributionBreakdown.assetAllocation)}`}>
                        {formatBps(attribution.attributionBreakdown.assetAllocation)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Security Selection</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${getPerformanceColor(attribution.attributionBreakdown.securitySelection)}`}>
                        {formatBps(attribution.attributionBreakdown.securitySelection)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-purple-500 rounded"></div>
                      <span className="text-sm">Interaction Effect</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${getPerformanceColor(attribution.attributionBreakdown.interaction)}`}>
                        {formatBps(attribution.attributionBreakdown.interaction)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span className="text-sm">Currency Effect</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${getPerformanceColor(attribution.attributionBreakdown.currency)}`}>
                        {formatBps(attribution.attributionBreakdown.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm">Costs</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${getPerformanceColor(attribution.attributionBreakdown.costs)}`}>
                        {formatBps(attribution.attributionBreakdown.costs)}
                      </div>
                    </div>
                  </div>

                  <hr />

                  <div className="flex items-center justify-between font-semibold">
                    <span>Total Attribution</span>
                    <span className={getPerformanceColor(attribution.excessReturn)}>
                      {formatBps(attribution.excessReturn)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>
                  Best and worst performing managers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-green-600 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Top Performer
                    </h4>
                    {topPerformer && (
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <div>
                          <div className="font-medium">{topPerformer.managerName}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatPercent(topPerformer.allocation)} allocation
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-600 font-bold">
                            {formatBps(topPerformer.contribution)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBps(topPerformer.excess)} excess
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-red-600 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      Needs Attention
                    </h4>
                    {worstPerformer && (
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div>
                          <div className="font-medium">{worstPerformer.managerName}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatPercent(worstPerformer.allocation)} allocation
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-red-600 font-bold">
                            {formatBps(worstPerformer.contribution)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBps(worstPerformer.excess)} excess
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="managers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manager Performance Attribution</CardTitle>
              <CardDescription>
                Detailed analysis by investment manager
              </CardDescription>
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="text-sm">Sort by:</Label>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contribution">Contribution</SelectItem>
                    <SelectItem value="excess">Excess Return</SelectItem>
                    <SelectItem value="allocation">Allocation</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                >
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Allocation</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead className="text-right">Excess Return</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedManagerContributions.map((manager) => (
                    <TableRow key={manager.managerId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getContributionIcon(manager.contribution)}
                          <span className="font-medium">{manager.managerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(manager.allocation)}
                      </TableCell>
                      <TableCell className={`text-right ${getPerformanceColor(manager.contribution)}`}>
                        {formatBps(manager.contribution)}
                      </TableCell>
                      <TableCell className={`text-right ${getPerformanceColor(manager.excess)}`}>
                        {formatBps(manager.excess)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={manager.contribution > 0 ? 
                          'bg-green-100 text-green-800' : 
                          'bg-red-100 text-red-800'}>
                          {manager.contribution > 0 ? 'Positive' : 'Negative'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Strategy Performance</CardTitle>
                <CardDescription>Performance by strategy type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {strategies.slice(0, 8).map((strategy) => (
                    <div key={strategy.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{strategy.name}</div>
                          <Badge variant="outline">{strategy.category.replace('_', ' ')}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(strategy.allocation)} allocated
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${getPerformanceColor(strategy.performance.ytd)}`}>
                          {formatPercent(strategy.performance.ytd)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          YTD Return
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strategy Allocation</CardTitle>
                <CardDescription>Distribution across strategy types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Strategy allocation chart will be implemented here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sector Attribution</CardTitle>
              <CardDescription>
                Performance contribution by sector
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Allocation</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead className="text-right">Excess Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSectorContributions.map((sector, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getContributionIcon(sector.contribution)}
                          <span className="font-medium">{sector.sector}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(sector.allocation)}
                      </TableCell>
                      <TableCell className={`text-right ${getPerformanceColor(sector.contribution)}`}>
                        {formatBps(sector.contribution)}
                      </TableCell>
                      <TableCell className={`text-right ${getPerformanceColor(sector.excess)}`}>
                        {formatBps(sector.excess)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Timeline</CardTitle>
              <CardDescription>Historical attribution over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Performance timeline chart will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};