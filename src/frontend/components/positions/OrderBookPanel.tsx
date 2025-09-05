import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/frontend/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/frontend/components/ui/table';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Input } from '@/frontend/components/ui/input';
import { Label } from '@/frontend/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/frontend/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/frontend/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/frontend/components/ui/dropdown-menu';
import { 
  Plus, 
  Edit, 
  X, 
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import { 
  ActiveOrder, 
  OrderPlacementRequest 
} from '@/shared/types/trading';
import { 
  usePlaceOrder, 
  useModifyOrder, 
  useCancelOrder 
} from '@/frontend/hooks/usePositions';

interface OrderBookPanelProps {
  orders: ActiveOrder[];
  loading?: boolean;
}

export const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
  orders,
  loading = false,
}) => {
  const [isPlaceOrderOpen, setIsPlaceOrderOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ActiveOrder | null>(null);
  
  const placeOrderMutation = usePlaceOrder();
  const modifyOrderMutation = useModifyOrder();
  const cancelOrderMutation = useCancelOrder();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusIcon = (status: ActiveOrder['status']) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'PARTIAL_FILLED':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'FILLED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: ActiveOrder['status']) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'PARTIAL_FILLED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'FILLED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleCancelOrder = (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  const OrderForm: React.FC<{ 
    order?: ActiveOrder; 
    onSubmit: (data: any) => void; 
    onClose: () => void;
  }> = ({ order, onSubmit, onClose }) => {
    const [formData, setFormData] = useState({
      symbol: order?.symbol || 'BTC-USD',
      side: order?.side || 'BUY' as 'BUY' | 'SELL',
      type: order?.type || 'LIMIT' as 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT',
      quantity: order?.quantity?.toString() || '',
      price: order?.price?.toString() || '',
      stopPrice: order?.stopPrice?.toString() || '',
      timeInForce: order?.timeInForce || 'GTC' as 'GTC' | 'IOC' | 'FOK',
      reduceOnly: order?.reduceOnly || false,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const orderData: OrderPlacementRequest = {
        symbol: formData.symbol,
        side: formData.side,
        type: formData.type,
        quantity: parseFloat(formData.quantity),
        price: formData.price ? parseFloat(formData.price) : undefined,
        stopPrice: formData.stopPrice ? parseFloat(formData.stopPrice) : undefined,
        timeInForce: formData.timeInForce,
        reduceOnly: formData.reduceOnly,
      };
      onSubmit(orderData);
      onClose();
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Select value={formData.symbol} onValueChange={(value) => setFormData({...formData, symbol: value})}>
              <SelectTrigger>
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
            <Label htmlFor="side">Side</Label>
            <Select value={formData.side} onValueChange={(value) => setFormData({...formData, side: value as 'BUY' | 'SELL'})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Order Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as any})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKET">Market</SelectItem>
                <SelectItem value="LIMIT">Limit</SelectItem>
                <SelectItem value="STOP_LOSS">Stop Loss</SelectItem>
                <SelectItem value="TAKE_PROFIT">Take Profit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.000001"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              placeholder="0.001"
              required
            />
          </div>
        </div>

        {(formData.type === 'LIMIT' || formData.type === 'TAKE_PROFIT') && (
          <div>
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              placeholder="65000"
              required
            />
          </div>
        )}

        {(formData.type === 'STOP_LOSS') && (
          <div>
            <Label htmlFor="stopPrice">Stop Price</Label>
            <Input
              id="stopPrice"
              type="number"
              step="0.01"
              value={formData.stopPrice}
              onChange={(e) => setFormData({...formData, stopPrice: e.target.value})}
              placeholder="62000"
              required
            />
          </div>
        )}

        <div>
          <Label htmlFor="timeInForce">Time in Force</Label>
          <Select value={formData.timeInForce} onValueChange={(value) => setFormData({...formData, timeInForce: value as any})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GTC">Good Till Cancelled</SelectItem>
              <SelectItem value="IOC">Immediate or Cancel</SelectItem>
              <SelectItem value="FOK">Fill or Kill</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={placeOrderMutation.isPending || modifyOrderMutation.isPending}
          >
            {order ? 'Update Order' : 'Place Order'}
          </Button>
        </div>
      </form>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Active Orders
            <Badge variant="secondary">{orders.length}</Badge>
          </CardTitle>
          <Dialog open={isPlaceOrderOpen} onOpenChange={setIsPlaceOrderOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Place New Order</DialogTitle>
              </DialogHeader>
              <OrderForm 
                onSubmit={(data) => placeOrderMutation.mutate(data)}
                onClose={() => setIsPlaceOrderOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active orders. Place your first order to start trading.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono font-medium">
                    {order.symbol}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {order.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={order.side === 'BUY' ? 'default' : 'secondary'}
                      className={order.side === 'BUY' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }
                    >
                      {order.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {order.quantity.toFixed(6)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {order.price ? formatCurrency(order.price) : 'Market'}
                    {order.stopPrice && (
                      <div className="text-xs text-muted-foreground">
                        Stop: {formatCurrency(order.stopPrice)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm">
                      {order.filledQuantity.toFixed(6)} / {order.quantity.toFixed(6)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {((order.filledQuantity / order.quantity) * 100).toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTime(order.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                          onClick={() => setEditingOrder(order)}
                          className="flex items-center gap-2"
                          disabled={order.status === 'FILLED' || order.status === 'CANCELLED'}
                        >
                          <Edit className="h-4 w-4" />
                          Modify Order
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleCancelOrder(order.id)}
                          className="flex items-center gap-2 text-red-600 dark:text-red-400"
                          disabled={order.status === 'FILLED' || order.status === 'CANCELLED' || cancelOrderMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                          {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Order</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <OrderForm 
              order={editingOrder}
              onSubmit={(data) => modifyOrderMutation.mutate({orderId: editingOrder.id, ...data})}
              onClose={() => setEditingOrder(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};