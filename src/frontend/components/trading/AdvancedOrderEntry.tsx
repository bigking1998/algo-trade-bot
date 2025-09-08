import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card';
import { Button } from '@/frontend/components/ui/button';
import { Input } from '@/frontend/components/ui/input';
import { Label } from '@/frontend/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select';
import { Switch } from '@/frontend/components/ui/switch';
import { Badge } from '@/frontend/components/ui/badge';
import { Separator } from '@/frontend/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown,
  Zap,
  Target,
  Shield,
  Clock,
  DollarSign,
  Percent,
  Calculator,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Bookmark,
  Play,
  Pause,
  Square
} from 'lucide-react';

// Types for advanced order management
interface OrderTemplate {
  id: string;
  name: string;
  description: string;
  orderType: string;
  side: 'buy' | 'sell';
  priceType: 'market' | 'limit' | 'stop' | 'stop-limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  postOnly: boolean;
  reduceOnly: boolean;
}

interface AdvancedOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop-limit' | 'trailing-stop' | 'iceberg' | 'twap' | 'bracket';
  quantity: number;
  price?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  trailingAmount?: number;
  icebergQty?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  postOnly: boolean;
  reduceOnly: boolean;
  leverage?: number;
}

interface AdvancedOrderEntryProps {
  className?: string;
  onClick?: () => void;
}

export const AdvancedOrderEntry: React.FC<AdvancedOrderEntryProps> = ({
  className = '',
  onClick
}) => {
  // Order state
  const [symbol, setSymbol] = useState('BTC-USD');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<string>('limit');
  const [quantity, setQuantity] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [stopPrice, setStopPrice] = useState<number>(0);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(0);
  const [trailingAmount, setTrailingAmount] = useState<number>(0);
  const [timeInForce, setTimeInForce] = useState<string>('GTC');
  const [postOnly, setPostOnly] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [leverage, setLeverage] = useState<number>(1);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderStatus, setLastOrderStatus] = useState<'success' | 'error' | null>(null);
  const [orderTemplates, setOrderTemplates] = useState<OrderTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [oneClickEnabled, setOneClickEnabled] = useState(false);
  const [hotkeysEnabled, setHotkeysEnabled] = useState(true);
  
  // Performance refs
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  
  // Mock market data (would come from real feed)
  const [marketData, setMarketData] = useState({
    bid: 65432.10,
    ask: 65433.20,
    last: 65432.50,
    volume: 1234567,
    change24h: 2.34,
    spread: 1.10
  });

  // Real-time price updates simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(prev => ({
        ...prev,
        bid: prev.bid + (Math.random() - 0.5) * 10,
        ask: prev.ask + (Math.random() - 0.5) * 10,
        last: prev.last + (Math.random() - 0.5) * 10,
      }));
    }, 100); // 100ms updates for professional performance

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts for professional trading
  useEffect(() => {
    if (!hotkeysEnabled) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          setSide('buy');
          break;
        case 's':
          event.preventDefault();
          setSide('sell');
          break;
        case 'm':
          event.preventDefault();
          setOrderType('market');
          break;
        case 'l':
          event.preventDefault();
          setOrderType('limit');
          break;
        case 'enter':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleSubmitOrder();
          }
          break;
        case 'escape':
          event.preventDefault();
          handleCancelAllOrders();
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [hotkeysEnabled]);

  // Order submission with sub-100ms response time optimization
  const handleSubmitOrder = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setLastOrderStatus(null);

    try {
      // Simulate ultra-fast order submission
      const orderParams: AdvancedOrderParams = {
        symbol,
        side,
        orderType,
        quantity,
        price: orderType !== 'market' ? price : undefined,
        stopPrice: ['stop', 'stop-limit', 'trailing-stop'].includes(orderType) ? stopPrice : undefined,
        takeProfitPrice: orderType === 'bracket' ? takeProfitPrice : undefined,
        trailingAmount: orderType === 'trailing-stop' ? trailingAmount : undefined,
        timeInForce: timeInForce as any,
        postOnly,
        reduceOnly,
        leverage: leverage > 1 ? leverage : undefined,
      };

      // Simulate API call with minimal latency
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms simulated latency
      
      console.log('Order submitted:', orderParams);
      setLastOrderStatus('success');
      
      // Clear form if successful
      if (orderType === 'market') {
        setQuantity(0);
      }
      
    } catch (error) {
      console.error('Order submission failed:', error);
      setLastOrderStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [symbol, side, orderType, quantity, price, stopPrice, takeProfitPrice, trailingAmount, timeInForce, postOnly, reduceOnly, leverage, isSubmitting]);

  // One-click trading
  const handleOneClickTrade = useCallback((side: 'buy' | 'sell', marketOrder: boolean = true) => {
    if (!oneClickEnabled) return;
    
    setSide(side);
    setOrderType(marketOrder ? 'market' : 'limit');
    
    if (marketOrder && quantity > 0) {
      handleSubmitOrder();
    }
  }, [oneClickEnabled, quantity, handleSubmitOrder]);

  const handleCancelAllOrders = useCallback(() => {
    console.log('Cancel all orders triggered');
    // Implementation would cancel all open orders
  }, []);

  // Apply order template
  const applyTemplate = useCallback((templateId: string) => {
    const template = orderTemplates.find(t => t.id === templateId);
    if (template) {
      setSide(template.side);
      setOrderType(template.orderType);
      setQuantity(template.quantity);
      setPrice(template.price || 0);
      setTimeInForce(template.timeInForce);
      setPostOnly(template.postOnly);
      setReduceOnly(template.reduceOnly);
    }
  }, [orderTemplates]);

  // Calculate order value and margin
  const orderValue = quantity * (orderType === 'market' ? marketData.ask : price);
  const marginRequired = orderValue / leverage;
  const feeEstimate = orderValue * 0.001; // 0.1% fee estimate

  return (
    <Card className={`advanced-order-entry ${className}`} onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Advanced Order Entry
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={lastOrderStatus === 'success' ? 'default' : lastOrderStatus === 'error' ? 'destructive' : 'outline'}>
              {lastOrderStatus === 'success' ? (
                <><CheckCircle className="h-3 w-3 mr-1" />Success</>
              ) : lastOrderStatus === 'error' ? (
                <><XCircle className="h-3 w-3 mr-1" />Error</>
              ) : (
                <><Clock className="h-3 w-3 mr-1" />Ready</>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Market Data Strip */}
        <div className="grid grid-cols-4 gap-2 p-2 bg-muted/30 rounded text-xs">
          <div className="text-center">
            <div className="text-muted-foreground">Bid</div>
            <div className="font-mono font-medium text-green-600">
              ${marketData.bid.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Ask</div>
            <div className="font-mono font-medium text-red-600">
              ${marketData.ask.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Last</div>
            <div className="font-mono font-medium">
              ${marketData.last.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Spread</div>
            <div className="font-mono font-medium text-xs">
              ${marketData.spread.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Order Templates */}
        {orderTemplates.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Template:</Label>
            <Select value={selectedTemplate} onValueChange={(value) => {
              setSelectedTemplate(value);
              applyTemplate(value);
            }}>
              <SelectTrigger className="h-6 text-xs">
                <SelectValue placeholder="Quick setup" />
              </SelectTrigger>
              <SelectContent>
                {orderTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Tabs defaultValue="basic" className="space-y-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3">
            {/* Symbol and Side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Symbol</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                    <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                    <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Side</Label>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant={side === 'buy' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSide('buy')}
                    className={side === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Buy
                  </Button>
                  <Button
                    variant={side === 'sell' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSide('sell')}
                    className={side === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Sell
                  </Button>
                </div>
              </div>
            </div>

            {/* Order Type */}
            <div>
              <Label className="text-xs">Order Type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="limit">Limit</SelectItem>
                  <SelectItem value="stop">Stop Loss</SelectItem>
                  <SelectItem value="stop-limit">Stop Limit</SelectItem>
                  <SelectItem value="trailing-stop">Trailing Stop</SelectItem>
                  <SelectItem value="iceberg">Iceberg</SelectItem>
                  <SelectItem value="bracket">Bracket</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity and Price */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input
                  ref={quantityInputRef}
                  type="number"
                  step="0.01"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="h-8 font-mono"
                  placeholder="0.00"
                />
              </div>
              {orderType !== 'market' && (
                <div>
                  <Label className="text-xs">
                    {orderType === 'stop' || orderType === 'stop-limit' ? 'Stop Price' : 'Limit Price'}
                  </Label>
                  <Input
                    ref={priceInputRef}
                    type="number"
                    step="0.01"
                    value={price || ''}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-3">
            {/* Advanced Order Parameters */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Time in Force</Label>
                <Select value={timeInForce} onValueChange={setTimeInForce}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GTC">GTC (Good Till Cancel)</SelectItem>
                    <SelectItem value="IOC">IOC (Immediate or Cancel)</SelectItem>
                    <SelectItem value="FOK">FOK (Fill or Kill)</SelectItem>
                    <SelectItem value="DAY">DAY (Day Order)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Leverage</Label>
                <Select value={leverage.toString()} onValueChange={(v) => setLeverage(parseInt(v))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 10, 20].map(lev => (
                      <SelectItem key={lev} value={lev.toString()}>{lev}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Order Types Parameters */}
            {orderType === 'trailing-stop' && (
              <div>
                <Label className="text-xs">Trailing Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={trailingAmount || ''}
                  onChange={(e) => setTrailingAmount(parseFloat(e.target.value) || 0)}
                  className="h-8 font-mono"
                  placeholder="0.00"
                />
              </div>
            )}

            {orderType === 'bracket' && (
              <div>
                <Label className="text-xs">Take Profit Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={takeProfitPrice || ''}
                  onChange={(e) => setTakeProfitPrice(parseFloat(e.target.value) || 0)}
                  className="h-8 font-mono"
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Order Modifiers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Post Only</Label>
                <Switch checked={postOnly} onCheckedChange={setPostOnly} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Reduce Only</Label>
                <Switch checked={reduceOnly} onCheckedChange={setReduceOnly} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Order Summary */}
        <div className="p-2 bg-muted/20 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span>Order Value:</span>
            <span className="font-mono">${orderValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Margin Required:</span>
            <span className="font-mono">${marginRequired.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Est. Fee:</span>
            <span className="font-mono">${feeEstimate.toFixed(2)}</span>
          </div>
        </div>

        {/* One-Click Trading */}
        {oneClickEnabled && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => handleOneClickTrade('buy')}
              className="bg-green-600 hover:bg-green-700 gap-1"
            >
              <Zap className="h-3 w-3" />
              Quick Buy
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleOneClickTrade('sell')}
              className="bg-red-600 hover:bg-red-700 gap-1"
            >
              <Zap className="h-3 w-3" />
              Quick Sell
            </Button>
          </div>
        )}

        {/* Order Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            ref={submitButtonRef}
            onClick={handleSubmitOrder}
            disabled={isSubmitting || quantity <= 0}
            className={`gap-1 ${side === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            size="sm"
          >
            {isSubmitting ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
            ) : (
              <><Play className="h-3 w-3" />{side === 'buy' ? 'Buy' : 'Sell'} {symbol.split('-')[0]}</>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelAllOrders}
            className="gap-1"
          >
            <Square className="h-3 w-3" />
            Cancel All
          </Button>
        </div>

        {/* Settings */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">One-Click Trading</Label>
            <Switch checked={oneClickEnabled} onCheckedChange={setOneClickEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Keyboard Shortcuts</Label>
            <Switch checked={hotkeysEnabled} onCheckedChange={setHotkeysEnabled} />
          </div>
        </div>

        {hotkeysEnabled && (
          <div className="text-xs text-muted-foreground text-center">
            B: Buy | S: Sell | M: Market | L: Limit | Ctrl+Enter: Submit | Esc: Cancel All
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdvancedOrderEntry;