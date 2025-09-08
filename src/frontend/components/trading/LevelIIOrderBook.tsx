import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Progress } from '@/frontend/components/ui/progress';
import { Separator } from '@/frontend/components/ui/separator';
import { 
  Book, 
  TrendingUp, 
  TrendingDown,
  Layers,
  Zap,
  Eye,
  EyeOff,
  Filter,
  Settings,
  Volume2,
  Activity,
  Clock,
  DollarSign
} from 'lucide-react';

// Types for order book data
interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  count: number;
  timestamp: number;
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  lastUpdate: number;
}

interface LevelIIOrderBookProps {
  className?: string;
  onClick?: () => void;
  symbol?: string;
  precision?: number;
  showMarketDepth?: boolean;
}

export const LevelIIOrderBook: React.FC<LevelIIOrderBookProps> = ({
  className = '',
  onClick,
  symbol = 'BTC-USD',
  precision = 2,
  showMarketDepth = true
}) => {
  const [orderBook, setOrderBook] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: 0,
    spreadPercent: 0,
    lastUpdate: Date.now()
  });
  
  const [displayDepth, setDisplayDepth] = useState(20);
  const [showSizeAsBars, setShowSizeAsBars] = useState(true);
  const [showCumulativeSize, setShowCumulativeSize] = useState(true);
  const [showOrderCount, setShowOrderCount] = useState(false);
  const [groupingLevel, setGroupingLevel] = useState(0.01);
  const [highlightLargeOrders, setHighlightLargeOrders] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  // Generate realistic order book data
  const generateOrderBookData = useCallback((basePrice: number): OrderBookData => {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    let cumulativeBidSize = 0;
    let cumulativeAskSize = 0;

    // Generate bid levels (below market price)
    for (let i = 0; i < displayDepth; i++) {
      const price = basePrice - (i * groupingLevel);
      const size = Math.random() * 10 + 0.1;
      cumulativeBidSize += size;
      const count = Math.floor(Math.random() * 20) + 1;
      
      bids.push({
        price,
        size,
        total: cumulativeBidSize,
        count,
        timestamp: Date.now() - Math.random() * 5000
      });
    }

    // Generate ask levels (above market price)
    for (let i = 0; i < displayDepth; i++) {
      const price = basePrice + ((i + 1) * groupingLevel);
      const size = Math.random() * 10 + 0.1;
      cumulativeAskSize += size;
      const count = Math.floor(Math.random() * 20) + 1;
      
      asks.push({
        price,
        size,
        total: cumulativeAskSize,
        count,
        timestamp: Date.now() - Math.random() * 5000
      });
    }

    const spread = asks[0].price - bids[0].price;
    const spreadPercent = (spread / basePrice) * 100;

    return {
      bids,
      asks,
      spread,
      spreadPercent,
      lastUpdate: Date.now()
    };
  }, [displayDepth, groupingLevel]);

  // Real-time order book updates
  useEffect(() => {
    const basePrice = 65432.50; // Base BTC price
    setOrderBook(generateOrderBookData(basePrice));

    const interval = setInterval(() => {
      // Simulate price movement
      const priceChange = (Math.random() - 0.5) * 50;
      const newBasePrice = basePrice + priceChange;
      setOrderBook(generateOrderBookData(newBasePrice));
    }, 100); // 100ms updates for high-frequency data

    return () => clearInterval(interval);
  }, [generateOrderBookData]);

  // Measure container height for virtualization
  useEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver(entries => {
        const height = entries[0].contentRect.height;
        setContainerHeight(height - 120); // Account for header and controls
      });
      
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Calculate maximum sizes for bar rendering
  const maxBidSize = useMemo(() => 
    Math.max(...orderBook.bids.map(level => level.size), 0.1)
  , [orderBook.bids]);
  
  const maxAskSize = useMemo(() => 
    Math.max(...orderBook.asks.map(level => level.size), 0.1)
  , [orderBook.asks]);

  // Handle order book row click for quick trading
  const handlePriceClick = useCallback((price: number, side: 'bid' | 'ask') => {
    console.log(`Price clicked: ${price} (${side})`);
    // This would integrate with the order entry component
  }, []);

  // Render order book level
  const renderOrderBookLevel = (level: OrderBookLevel, side: 'bid' | 'ask', maxSize: number) => {
    const sizePercent = (level.size / maxSize) * 100;
    const isLargeOrder = level.size > maxSize * 0.7;
    const ageMs = Date.now() - level.timestamp;
    const isRecent = ageMs < 1000;

    return (
      <div
        key={`${side}-${level.price}`}
        className={`
          relative grid grid-cols-3 gap-1 py-0.5 px-1 text-xs cursor-pointer transition-colors
          hover:bg-muted/50 ${isRecent ? 'bg-blue-50 dark:bg-blue-950' : ''}
          ${highlightLargeOrders && isLargeOrder ? 'font-semibold border-l-2 border-orange-400' : ''}
        `}
        onClick={() => handlePriceClick(level.price, side)}
      >
        {/* Background bar showing size */}
        {showSizeAsBars && (
          <div
            className={`
              absolute inset-0 ${side === 'bid' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}
              opacity-30
            `}
            style={{
              width: `${sizePercent}%`,
              right: side === 'ask' ? 0 : 'auto',
              left: side === 'bid' ? 0 : 'auto'
            }}
          />
        )}

        {/* Price */}
        <div className={`relative font-mono ${side === 'bid' ? 'text-green-600' : 'text-red-600'}`}>
          {level.price.toFixed(precision)}
        </div>

        {/* Size */}
        <div className="relative font-mono text-right">
          {level.size.toFixed(4)}
        </div>

        {/* Total/Count */}
        <div className="relative font-mono text-right text-muted-foreground">
          {showCumulativeSize ? level.total.toFixed(2) : showOrderCount ? level.count : ''}
        </div>
      </div>
    );
  };

  const midPrice = orderBook.bids[0] && orderBook.asks[0] 
    ? (orderBook.bids[0].price + orderBook.asks[0].price) / 2 
    : 0;

  return (
    <Card ref={containerRef} className={`level2-orderbook ${className}`} onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            Order Book - {symbol}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Depth: {displayDepth}
            </Badge>
          </div>
        </div>
        
        {/* Market Spread Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Spread: ${orderBook.spread.toFixed(precision)} ({orderBook.spreadPercent.toFixed(3)}%)</span>
          <span>Mid: ${midPrice.toFixed(precision)}</span>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Controls */}
        <div className="flex items-center justify-between p-2 bg-muted/20 border-y">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayDepth(displayDepth === 10 ? 20 : displayDepth === 20 ? 50 : 10)}
              className="text-xs h-6"
            >
              <Layers className="h-3 w-3 mr-1" />
              {displayDepth}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupingLevel(groupingLevel === 0.01 ? 0.1 : groupingLevel === 0.1 ? 1 : 0.01)}
              className="text-xs h-6"
            >
              <Filter className="h-3 w-3 mr-1" />
              ${groupingLevel}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={showSizeAsBars ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSizeAsBars(!showSizeAsBars)}
              className="text-xs h-6 px-2"
            >
              <Volume2 className="h-3 w-3" />
            </Button>
            
            <Button
              variant={showCumulativeSize ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCumulativeSize(!showCumulativeSize)}
              className="text-xs h-6 px-2"
            >
              Σ
            </Button>
            
            <Button
              variant={highlightLargeOrders ? "default" : "outline"}
              size="sm"
              onClick={() => setHighlightLargeOrders(!highlightLargeOrders)}
              className="text-xs h-6 px-2"
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Order Book Header */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
          <div>Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">
            {showCumulativeSize ? 'Total' : showOrderCount ? 'Orders' : 'Sum'}
          </div>
        </div>

        {/* Order Book Data */}
        <div style={{ height: `${containerHeight}px`, overflow: 'hidden' }}>
          <div className="divide-y divide-border/50">
            {/* Asks (sells) - shown in reverse order */}
            <div className="max-h-1/2 overflow-hidden">
              {orderBook.asks.slice(0, Math.floor(displayDepth / 2))
                .reverse()
                .map(level => renderOrderBookLevel(level, 'ask', maxAskSize))}
            </div>

            {/* Spread indicator */}
            <div className="flex items-center justify-center py-1 bg-muted/40 text-xs font-medium">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-red-500" />
                <span className="font-mono">${orderBook.spread.toFixed(precision)}</span>
                <span className="text-muted-foreground">({orderBook.spreadPercent.toFixed(3)}%)</span>
                <TrendingDown className="h-3 w-3 text-green-500" />
              </div>
            </div>

            {/* Bids (buys) */}
            <div className="max-h-1/2 overflow-hidden">
              {orderBook.bids.slice(0, Math.floor(displayDepth / 2))
                .map(level => renderOrderBookLevel(level, 'bid', maxBidSize))}
            </div>
          </div>
        </div>

        {/* Market Depth Visualization */}
        {showMarketDepth && (
          <div className="p-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">Market Depth</span>
              <Badge variant="outline" className="text-xs">
                Cumulative Volume
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-green-600">
                  <span>Bids</span>
                  <span>{orderBook.bids.slice(0, 10).reduce((sum, level) => sum + level.size, 0).toFixed(2)}</span>
                </div>
                <Progress 
                  value={orderBook.bids.slice(0, 10).reduce((sum, level) => sum + level.size, 0)} 
                  max={200} 
                  className="h-1" 
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-red-600">
                  <span>Asks</span>
                  <span>{orderBook.asks.slice(0, 10).reduce((sum, level) => sum + level.size, 0).toFixed(2)}</span>
                </div>
                <Progress 
                  value={orderBook.asks.slice(0, 10).reduce((sum, level) => sum + level.size, 0)} 
                  max={200} 
                  className="h-1" 
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Stats */}
        <div className="flex items-center justify-between p-2 bg-muted/20 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Updates: {((Date.now() - orderBook.lastUpdate) / 1000).toFixed(1)}s ago</span>
            <span>Levels: {orderBook.bids.length + orderBook.asks.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Real-time</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LevelIIOrderBook;