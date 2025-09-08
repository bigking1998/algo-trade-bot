/**
 * Order Repository Implementation
 * Task BE-002: Base Repository Implementation - OrderRepository
 * 
 * Production-ready repository for order lifecycle management with comprehensive
 * order tracking, execution analytics, and exchange integration.
 */

import { BaseRepository, QueryOptions, PaginationResult } from '../BaseRepository';

// Order domain types based on database schema
export interface Order {
  id: string;
  time: Date;
  
  // Strategy reference
  strategy_id?: string;
  
  // Order details
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  
  // Quantities and pricing
  quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  price?: number;
  stop_price?: number;
  average_fill_price?: number;
  
  // Financial calculations
  total_value: number;
  total_fees: number;
  
  // Exchange integration
  exchange: string;
  exchange_order_id?: string;
  client_order_id?: string;
  
  // Order management
  time_in_force: string;
  expires_at?: Date;
  cancelled_at?: Date;
  filled_at?: Date;
  
  // Error handling
  reject_reason?: string;
  last_update_time: Date;
  created_at: Date;
  
  // Parent order relationship
  parent_order_id?: string;
}

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';

export interface OrderCreateData {
  strategy_id?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stop_price?: number;
  exchange?: string;
  client_order_id?: string;
  time_in_force?: string;
  expires_at?: Date;
  parent_order_id?: string;
}

export interface OrderUpdateData {
  status?: OrderStatus;
  filled_quantity?: number;
  average_fill_price?: number;
  total_value?: number;
  total_fees?: number;
  exchange_order_id?: string;
  reject_reason?: string;
  cancelled_at?: Date;
  filled_at?: Date;
}

export interface OrderFilters {
  strategy_id?: string;
  symbol?: string;
  side?: OrderSide;
  type?: OrderType;
  status?: OrderStatus;
  exchange?: string;
  date_from?: Date;
  date_to?: Date;
  min_quantity?: number;
  max_quantity?: number;
  min_price?: number;
  max_price?: number;
  filled_only?: boolean;
  active_only?: boolean;
  has_parent?: boolean;
}

export interface OrderExecutionAnalytics {
  total_orders: number;
  filled_orders: number;
  cancelled_orders: number;
  rejected_orders: number;
  expired_orders: number;
  fill_rate: number;
  average_fill_time: number;
  average_slippage: number;
  total_volume: number;
  total_fees: number;
  largest_order: number;
  smallest_order: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: Date;
  buy_orders: OrderSummary[];
  sell_orders: OrderSummary[];
  spread: number;
  total_buy_volume: number;
  total_sell_volume: number;
}

export interface OrderSummary {
  id: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  remaining_quantity: number;
  created_at: Date;
  time_in_force: string;
}

export interface OrderPerformanceMetrics {
  symbol: string;
  execution_success_rate: number;
  average_execution_time: number;
  average_slippage_bps: number;
  total_volume: number;
  order_count: number;
  rejected_count: number;
  cancelled_count: number;
}

export interface FillAnalysis {
  order_id: string;
  symbol: string;
  requested_quantity: number;
  filled_quantity: number;
  fill_percentage: number;
  average_price: number;
  slippage_bps: number;
  execution_time_ms: number;
  fees_paid: number;
  effective_spread_bps: number;
}

/**
 * Repository class for order lifecycle management and execution analytics
 */
export class OrderRepository extends BaseRepository<Order> {
  constructor() {
    super({
      tableName: 'orders',
      primaryKeyField: 'id',
      enableCaching: true,
      defaultCacheTTL: 120, // 2 minutes for order data
    });
  }

  /**
   * Create a new order with validation
   */
  public async createOrder(data: OrderCreateData): Promise<Order> {
    // Validate order data
    this.validateOrderData(data);

    const orderData = {
      ...data,
      time: new Date(),
      status: 'pending' as OrderStatus,
      filled_quantity: 0,
      remaining_quantity: data.quantity,
      total_value: 0,
      total_fees: 0,
      exchange: data.exchange || 'dydx_v4',
      time_in_force: data.time_in_force || 'GTC',
      last_update_time: new Date(),
    };

    const order = await this.create(orderData);

    // Invalidate active orders cache
    if (this.options.enableCaching) {
      await this.clearCache(`orders:active:*`);
      await this.clearCache(`orders:symbol:${data.symbol}:*`);
    }

    return order;
  }

  /**
   * Update order status and execution details
   */
  public async updateOrderExecution(
    id: string,
    updateData: OrderUpdateData
  ): Promise<Order | null> {
    const order = await this.findById(id);
    if (!order) {
      return null;
    }

    // Calculate remaining quantity if filled_quantity is updated
    let remaining_quantity = order.remaining_quantity;
    if (updateData.filled_quantity !== undefined) {
      remaining_quantity = order.quantity - updateData.filled_quantity;
    }

    // Auto-determine status based on fill
    let status = updateData.status || order.status;
    if (updateData.filled_quantity !== undefined) {
      if (updateData.filled_quantity >= order.quantity) {
        status = 'filled';
        updateData.filled_at = new Date();
      } else if (updateData.filled_quantity > 0) {
        status = 'partial';
      }
    }

    const finalUpdateData = {
      ...updateData,
      status,
      remaining_quantity,
      last_update_time: new Date(),
    };

    const updatedOrder = await this.updateById(id, finalUpdateData);

    // Invalidate caches
    if (this.options.enableCaching && updatedOrder) {
      await this.clearCache(`orders:active:*`);
      await this.clearCache(`orders:symbol:${updatedOrder.symbol}:*`);
    }

    return updatedOrder;
  }

  /**
   * Cancel an order
   */
  public async cancelOrder(
    id: string,
    reason?: string
  ): Promise<Order | null> {
    return await this.updateOrderExecution(id, {
      status: 'cancelled',
      cancelled_at: new Date(),
      reject_reason: reason,
    });
  }

  /**
   * Get active orders for trading
   */
  public async getActiveOrders(
    strategyId?: string,
    symbol?: string
  ): Promise<Order[]> {
    const criteria: Partial<Order> = { 
      status: 'pending' as OrderStatus 
    };

    if (strategyId) criteria.strategy_id = strategyId;
    if (symbol) criteria.symbol = symbol;

    return await this.findBy(criteria, {
      orderBy: 'time',
      orderDirection: 'DESC',
      cache: {
        key: `orders:active:${strategyId || 'all'}:${symbol || 'all'}`,
        ttl: 30, // 30 seconds for active orders
      },
    });
  }

  /**
   * Get orders by strategy
   */
  public async getOrdersByStrategy(
    strategyId: string,
    queryOptions?: QueryOptions
  ): Promise<Order[]> {
    return await this.findBy(
      { strategy_id: strategyId },
      {
        orderBy: 'time',
        orderDirection: 'DESC',
        ...queryOptions,
      }
    );
  }

  /**
   * Get orders by symbol
   */
  public async getOrdersBySymbol(
    symbol: string,
    queryOptions?: QueryOptions
  ): Promise<Order[]> {
    return await this.findBy(
      { symbol },
      {
        orderBy: 'time',
        orderDirection: 'DESC',
        ...queryOptions,
        cache: {
          key: `orders:symbol:${symbol}:${JSON.stringify(queryOptions)}`,
          ttl: 60,
        },
      }
    );
  }

  /**
   * Get recent orders with caching
   */
  public async getRecentOrders(limit = 50): Promise<Order[]> {
    return await this.findAll({
      orderBy: 'time',
      orderDirection: 'DESC',
      limit,
      cache: {
        key: 'orders:recent',
        ttl: 30, // 30 seconds cache
      },
    });
  }

  /**
   * Search orders with advanced filters
   */
  public async searchOrders(
    filters: OrderFilters,
    page = 1,
    pageSize = 50
  ): Promise<PaginationResult<Order>> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }

    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }

    if (filters.side) {
      whereConditions.push(`side = $${paramIndex++}`);
      params.push(filters.side);
    }

    if (filters.type) {
      whereConditions.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.exchange) {
      whereConditions.push(`exchange = $${paramIndex++}`);
      params.push(filters.exchange);
    }

    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    if (filters.min_quantity !== undefined) {
      whereConditions.push(`quantity >= $${paramIndex++}`);
      params.push(filters.min_quantity);
    }

    if (filters.max_quantity !== undefined) {
      whereConditions.push(`quantity <= $${paramIndex++}`);
      params.push(filters.max_quantity);
    }

    if (filters.min_price !== undefined) {
      whereConditions.push(`price >= $${paramIndex++}`);
      params.push(filters.min_price);
    }

    if (filters.max_price !== undefined) {
      whereConditions.push(`price <= $${paramIndex++}`);
      params.push(filters.max_price);
    }

    if (filters.filled_only) {
      whereConditions.push("status = 'filled'");
    }

    if (filters.active_only) {
      whereConditions.push("status IN ('pending', 'partial')");
    }

    if (filters.has_parent !== undefined) {
      whereConditions.push(filters.has_parent ? 
        'parent_order_id IS NOT NULL' : 
        'parent_order_id IS NULL'
      );
    }

    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM orders';
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    query += ' ORDER BY time DESC';

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const [countResult, dataResult] = await Promise.all([
      this.query<{ count: number }>(countQuery, params),
      this.query<Order>(query + ` LIMIT ${pageSize} OFFSET ${offset}`, params),
    ]);

    const total = Number(countResult.rows[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dataResult.rows,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get comprehensive order execution analytics
   */
  public async getExecutionAnalytics(
    filters: OrderFilters = {}
  ): Promise<OrderExecutionAnalytics> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Build where clause from filters
    if (filters.strategy_id) {
      whereConditions.push(`strategy_id = $${paramIndex++}`);
      params.push(filters.strategy_id);
    }

    if (filters.symbol) {
      whereConditions.push(`symbol = $${paramIndex++}`);
      params.push(filters.symbol);
    }

    if (filters.date_from) {
      whereConditions.push(`time >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions.push(`time <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    if (filters.exchange) {
      whereConditions.push(`exchange = $${paramIndex++}`);
      params.push(filters.exchange);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      WITH order_stats AS (
        SELECT 
          COUNT(*) as total_orders,
          COUNT(*) FILTER (WHERE status = 'filled') as filled_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_orders,
          COUNT(*) FILTER (WHERE status = 'expired') as expired_orders,
          AVG(
            EXTRACT(EPOCH FROM (
              COALESCE(filled_at, cancelled_at, last_update_time) - time
            )) * 1000
          ) FILTER (WHERE status IN ('filled', 'cancelled')) as avg_fill_time_ms,
          SUM(total_value) as total_volume,
          SUM(total_fees) as total_fees,
          MAX(quantity) as largest_order,
          MIN(quantity) as smallest_order
        FROM orders 
        ${whereClause}
      )
      SELECT 
        total_orders::INTEGER,
        filled_orders::INTEGER,
        cancelled_orders::INTEGER,
        rejected_orders::INTEGER,
        expired_orders::INTEGER,
        CASE 
          WHEN total_orders > 0 
          THEN (filled_orders::FLOAT / total_orders * 100)
          ELSE 0 
        END as fill_rate,
        COALESCE(avg_fill_time_ms, 0) as average_fill_time,
        0 as average_slippage, -- TODO: Calculate slippage from trade data
        COALESCE(total_volume, 0) as total_volume,
        COALESCE(total_fees, 0) as total_fees,
        COALESCE(largest_order, 0) as largest_order,
        COALESCE(smallest_order, 0) as smallest_order
      FROM order_stats
    `;

    const result = await this.query<OrderExecutionAnalytics>(query, params);
    return result.rows[0] || {
      total_orders: 0,
      filled_orders: 0,
      cancelled_orders: 0,
      rejected_orders: 0,
      expired_orders: 0,
      fill_rate: 0,
      average_fill_time: 0,
      average_slippage: 0,
      total_volume: 0,
      total_fees: 0,
      largest_order: 0,
      smallest_order: 0,
    };
  }

  /**
   * Get order book snapshot for active orders
   */
  public async getOrderBookSnapshot(symbol: string): Promise<OrderBookSnapshot | null> {
    const query = `
      WITH active_orders AS (
        SELECT 
          id,
          side,
          type,
          quantity,
          price,
          remaining_quantity,
          created_at,
          time_in_force
        FROM orders 
        WHERE symbol = $1 
          AND status IN ('pending', 'partial')
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY 
          CASE WHEN side = 'buy' THEN price END DESC,
          CASE WHEN side = 'sell' THEN price END ASC,
          created_at
      ),
      buy_orders AS (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'side', side,
            'type', type,
            'quantity', quantity,
            'price', price,
            'remaining_quantity', remaining_quantity,
            'created_at', created_at,
            'time_in_force', time_in_force
          ) ORDER BY price DESC, created_at
        ) as orders,
        SUM(remaining_quantity) as total_volume
        FROM active_orders 
        WHERE side = 'buy'
      ),
      sell_orders AS (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'side', side,
            'type', type,
            'quantity', quantity,
            'price', price,
            'remaining_quantity', remaining_quantity,
            'created_at', created_at,
            'time_in_force', time_in_force
          ) ORDER BY price ASC, created_at
        ) as orders,
        SUM(remaining_quantity) as total_volume
        FROM active_orders 
        WHERE side = 'sell'
      ),
      spread_calc AS (
        SELECT 
          (SELECT MIN(price) FROM active_orders WHERE side = 'sell' AND price IS NOT NULL) as min_ask,
          (SELECT MAX(price) FROM active_orders WHERE side = 'buy' AND price IS NOT NULL) as max_bid
      )
      SELECT 
        $1 as symbol,
        NOW() as timestamp,
        COALESCE(bo.orders, '[]'::json) as buy_orders,
        COALESCE(so.orders, '[]'::json) as sell_orders,
        COALESCE(sc.min_ask - sc.max_bid, 0) as spread,
        COALESCE(bo.total_volume, 0) as total_buy_volume,
        COALESCE(so.total_volume, 0) as total_sell_volume
      FROM buy_orders bo
      CROSS JOIN sell_orders so
      CROSS JOIN spread_calc sc
    `;

    const result = await this.query<{
      symbol: string;
      timestamp: Date;
      buy_orders: any;
      sell_orders: any;
      spread: number;
      total_buy_volume: number;
      total_sell_volume: number;
    }>(query, [symbol]);

    const row = result.rows[0];
    if (!row) return null;

    return {
      symbol: row.symbol,
      timestamp: row.timestamp,
      buy_orders: Array.isArray(row.buy_orders) ? row.buy_orders : [],
      sell_orders: Array.isArray(row.sell_orders) ? row.sell_orders : [],
      spread: row.spread,
      total_buy_volume: row.total_buy_volume,
      total_sell_volume: row.total_sell_volume,
    };
  }

  /**
   * Get order performance metrics by symbol
   */
  public async getOrderPerformanceBySymbol(): Promise<OrderPerformanceMetrics[]> {
    const query = `
      SELECT 
        symbol,
        COUNT(*) FILTER (WHERE status = 'filled')::FLOAT / COUNT(*) * 100 as execution_success_rate,
        AVG(
          EXTRACT(EPOCH FROM (
            COALESCE(filled_at, cancelled_at, last_update_time) - time
          )) * 1000
        ) FILTER (WHERE status = 'filled') as average_execution_time,
        0 as average_slippage_bps, -- TODO: Calculate from trade data
        SUM(total_value) as total_volume,
        COUNT(*) as order_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
      FROM orders
      WHERE time >= NOW() - INTERVAL '30 days'
      GROUP BY symbol
      HAVING COUNT(*) > 0
      ORDER BY total_volume DESC
    `;

    const result = await this.query<OrderPerformanceMetrics>(query);
    return result.rows;
  }

  /**
   * Get fill analysis for specific orders
   */
  public async getFillAnalysis(orderIds: string[]): Promise<FillAnalysis[]> {
    if (orderIds.length === 0) return [];

    const query = `
      SELECT 
        o.id as order_id,
        o.symbol,
        o.quantity as requested_quantity,
        o.filled_quantity,
        (o.filled_quantity / o.quantity * 100) as fill_percentage,
        o.average_fill_price as average_price,
        0 as slippage_bps, -- TODO: Calculate slippage
        COALESCE(
          EXTRACT(EPOCH FROM (o.filled_at - o.time)) * 1000, 0
        ) as execution_time_ms,
        o.total_fees as fees_paid,
        0 as effective_spread_bps -- TODO: Calculate effective spread
      FROM orders o
      WHERE o.id = ANY($1)
        AND o.status IN ('filled', 'partial')
      ORDER BY o.time DESC
    `;

    const result = await this.query<FillAnalysis>(query, [orderIds]);
    return result.rows;
  }

  /**
   * Get orders with parent-child relationships
   */
  public async getOrderHierarchy(parentOrderId: string): Promise<{
    parent: Order | null;
    children: Order[];
  }> {
    const [parent, children] = await Promise.all([
      this.findById(parentOrderId),
      this.findBy({ parent_order_id: parentOrderId }, {
        orderBy: 'time',
        orderDirection: 'ASC',
      }),
    ]);

    return { parent, children };
  }

  /**
   * Expire old orders
   */
  public async expireOldOrders(): Promise<number> {
    const query = `
      UPDATE orders 
      SET 
        status = 'expired',
        last_update_time = NOW()
      WHERE status IN ('pending', 'partial')
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
    `;

    const result = await this.query(query);
    const expiredCount = result.rowCount || 0;

    // Invalidate caches
    if (this.options.enableCaching && expiredCount > 0) {
      await this.clearCache('orders:active:*');
    }

    return expiredCount;
  }

  /**
   * Clean up old orders beyond retention period
   */
  public async cleanupOldOrders(retentionDays = 2555): Promise<number> { // ~7 years default
    const query = `
      DELETE FROM orders 
      WHERE time < NOW() - INTERVAL '${retentionDays} days'
        AND status IN ('filled', 'cancelled', 'rejected', 'expired')
    `;

    const result = await this.query(query);
    return result.rowCount || 0;
  }

  /**
   * Validate order data before creation
   */
  private validateOrderData(data: OrderCreateData): void {
    if (!data.symbol || data.symbol.trim().length === 0) {
      throw new Error('Symbol is required');
    }

    if (data.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (data.type === 'limit' && (!data.price || data.price <= 0)) {
      throw new Error('Limit orders require a positive price');
    }

    if (data.type === 'stop' && (!data.stop_price || data.stop_price <= 0)) {
      throw new Error('Stop orders require a positive stop price');
    }

    if (data.type === 'stop_limit') {
      if (!data.price || data.price <= 0) {
        throw new Error('Stop limit orders require a positive price');
      }
      if (!data.stop_price || data.stop_price <= 0) {
        throw new Error('Stop limit orders require a positive stop price');
      }
    }

    if (data.expires_at && data.expires_at <= new Date()) {
      throw new Error('Expiration time must be in the future');
    }

    const validSides: OrderSide[] = ['buy', 'sell'];
    if (!validSides.includes(data.side)) {
      throw new Error(`Invalid order side: ${data.side}`);
    }

    const validTypes: OrderType[] = ['market', 'limit', 'stop', 'stop_limit'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid order type: ${data.type}`);
    }

    const validTIF = ['GTC', 'IOC', 'FOK'];
    if (data.time_in_force && !validTIF.includes(data.time_in_force)) {
      throw new Error(`Invalid time in force: ${data.time_in_force}`);
    }
  }

  /**
   * Clear cache by pattern
   */
  private async clearCache(pattern: string): Promise<void> {
    try {
      await this.db.clearCache(pattern);
    } catch (error) {
      console.warn(`[OrderRepository] Cache clear failed for pattern ${pattern}:`, error);
    }
  }
}

export default OrderRepository;