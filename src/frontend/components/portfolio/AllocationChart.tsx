import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import type { AllocationItem } from '@/shared/types/trading';

interface AllocationChartProps {
  data: AllocationItem[];
}

const COLORS = [
  '#f97316', // BTC - Orange
  '#6366f1', // ETH - Indigo  
  '#8b5cf6', // SOL - Purple
  '#10b981', // USDC - Green
  '#ef4444', // Additional colors if needed
  '#f59e0b',
  '#3b82f6',
  '#ec4899'
];

export function AllocationChart({ data }: AllocationChartProps) {
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.asset}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)} ({formatPercentage(data.percentage)})
          </p>
        </div>
      );
    }
    return null;
  };

  /*
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm font-medium">{entry.payload.asset}</span>
            <span className="text-sm text-muted-foreground">
              {formatPercentage(entry.payload.percentage)}
            </span>
          </div>
        ))}
      </div>
    );
  };
  */

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ asset, percentage }) => `${asset} ${formatPercentage(percentage)}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="percentage"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Custom Legend with Values */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {data.map((item, index) => (
            <div key={item.asset} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium">{item.asset}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatPercentage(item.percentage)}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(item.value)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}