import type { 
  TradeHistoryEntry, 
  TradeStatistics, 
  TradeFilters, 
  TradeHistoryResponse
} from '@/shared/types/trading';

// In-memory storage for demonstration - in production, use a database
class TradeHistoryService {
  private trades: TradeHistoryEntry[] = [];
  private nextId = 1;

  constructor() {
    // Initialize with some sample data for demonstration
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleTrades: Omit<TradeHistoryEntry, 'id'>[] = [
      {
        timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
        symbol: 'BTC-USD',
        side: 'BUY',
        entryPrice: 42000,
        exitPrice: 43500,
        quantity: 0.1,
        pnl: 150,
        pnlPercent: 3.57,
        fees: 12.5,
        strategy: 'EMA Crossover',
        duration: 3600000 * 4, // 4 hours
        status: 'CLOSED',
        exitTimestamp: new Date(Date.now() - 86400000 * 6 - 3600000 * 20).toISOString(),
        notes: 'Golden cross signal'
      },
      {
        timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
        symbol: 'ETH-USD',
        side: 'BUY',
        entryPrice: 2800,
        exitPrice: 2750,
        quantity: 1.5,
        pnl: -75,
        pnlPercent: -1.79,
        fees: 8.25,
        strategy: 'RSI Oversold',
        duration: 3600000 * 2, // 2 hours
        status: 'CLOSED',
        exitTimestamp: new Date(Date.now() - 86400000 * 5 + 3600000 * 2).toISOString(),
        notes: 'Stop loss triggered'
      },
      {
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
        symbol: 'BTC-USD',
        side: 'SELL',
        entryPrice: 41500,
        exitPrice: 40800,
        quantity: 0.2,
        pnl: 140,
        pnlPercent: 1.69,
        fees: 16.6,
        strategy: 'Mean Reversion',
        duration: 3600000 * 6, // 6 hours
        status: 'CLOSED',
        exitTimestamp: new Date(Date.now() - 86400000 * 3 + 3600000 * 6).toISOString(),
        notes: 'Target reached'
      },
      {
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
        symbol: 'ETH-USD',
        side: 'BUY',
        entryPrice: 2900,
        quantity: 2.0,
        fees: 11.6,
        strategy: 'Breakout',
        status: 'OPEN',
        notes: 'Resistance breakout'
      },
      {
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        symbol: 'BTC-USD',
        side: 'BUY',
        entryPrice: 43200,
        quantity: 0.15,
        fees: 12.96,
        strategy: 'DCA',
        status: 'OPEN',
        notes: 'Dollar cost averaging entry'
      }
    ];

    sampleTrades.forEach(trade => {
      this.trades.push({ ...trade, id: (this.nextId++).toString() });
    });
  }

  addTrade(trade: Omit<TradeHistoryEntry, 'id'>): TradeHistoryEntry {
    const newTrade: TradeHistoryEntry = {
      ...trade,
      id: (this.nextId++).toString()
    };
    this.trades.push(newTrade);
    return newTrade;
  }

  updateTrade(id: string, updates: Partial<TradeHistoryEntry>): TradeHistoryEntry | null {
    const index = this.trades.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    this.trades[index] = { ...this.trades[index], ...updates };
    return this.trades[index];
  }

  closeTrade(id: string, exitPrice: number, exitTimestamp: string): TradeHistoryEntry | null {
    const trade = this.trades.find(t => t.id === id);
    if (!trade || trade.status === 'CLOSED') return null;

    const pnl = trade.side === 'BUY' 
      ? (exitPrice - trade.entryPrice) * trade.quantity - trade.fees
      : (trade.entryPrice - exitPrice) * trade.quantity - trade.fees;
    
    const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
    const duration = new Date(exitTimestamp).getTime() - new Date(trade.timestamp).getTime();

    return this.updateTrade(id, {
      exitPrice,
      exitTimestamp,
      pnl,
      pnlPercent,
      duration,
      status: 'CLOSED'
    });
  }

  getTradeHistory(
    filters: TradeFilters = {},
    page: number = 1,
    pageSize: number = 50
  ): TradeHistoryResponse {
    let filteredTrades = [...this.trades];

    // Apply filters
    if (filters.symbol) {
      filteredTrades = filteredTrades.filter(t => t.symbol === filters.symbol);
    }
    if (filters.strategy) {
      filteredTrades = filteredTrades.filter(t => t.strategy === filters.strategy);
    }
    if (filters.side) {
      filteredTrades = filteredTrades.filter(t => t.side === filters.side);
    }
    if (filters.status && filters.status !== 'all') {
      const statusUpper = filters.status.toUpperCase() as 'OPEN' | 'CLOSED';
      filteredTrades = filteredTrades.filter(t => t.status === statusUpper);
    }
    if (filters.profitLoss && filters.profitLoss !== 'all') {
      if (filters.profitLoss === 'profit') {
        filteredTrades = filteredTrades.filter(t => t.pnl && t.pnl > 0);
      } else if (filters.profitLoss === 'loss') {
        filteredTrades = filteredTrades.filter(t => t.pnl && t.pnl < 0);
      }
    }
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredTrades = filteredTrades.filter(t => new Date(t.timestamp) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filteredTrades = filteredTrades.filter(t => new Date(t.timestamp) <= toDate);
    }

    // Sort by timestamp (newest first)
    filteredTrades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Pagination
    const total = filteredTrades.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedTrades = filteredTrades.slice(startIndex, startIndex + pageSize);

    return {
      trades: paginatedTrades,
      statistics: this.calculateStatistics(filteredTrades),
      total,
      page,
      pageSize
    };
  }

  private calculateStatistics(trades: TradeHistoryEntry[]): TradeStatistics {
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    
    if (closedTrades.length === 0) {
      return {
        totalTrades: trades.length,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        totalVolume: 0,
        avgTradeDuration: 0,
        bestTrade: 0,
        worstTrade: 0,
        profitFactor: 0,
        maxDrawdown: 0
      };
    }

    const winningTrades = closedTrades.filter(t => t.pnl! > 0);
    const losingTrades = closedTrades.filter(t => t.pnl! <= 0);
    
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalVolume = trades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0);
    
    const durations = closedTrades.filter(t => t.duration).map(t => t.duration!);
    const avgTradeDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const pnls = closedTrades.map(t => t.pnl!);
    const bestTrade = Math.max(...pnls, 0);
    const worstTrade = Math.min(...pnls, 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl!, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl!, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Simple max drawdown calculation (running cumulative PnL)
    let maxDrawdown = 0;
    let peak = 0;
    let cumPnl = 0;
    
    const sortedTrades = closedTrades.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    for (const trade of sortedTrades) {
      cumPnl += trade.pnl!;
      if (cumPnl > peak) peak = cumPnl;
      const drawdown = peak - cumPnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
      totalPnl,
      totalVolume,
      avgTradeDuration,
      bestTrade,
      worstTrade,
      profitFactor,
      maxDrawdown
    };
  }

  exportToCSV(filters: TradeFilters = {}): string {
    const { trades } = this.getTradeHistory(filters, 1, 10000); // Get all trades
    
    const headers = [
      'ID', 'Timestamp', 'Symbol', 'Side', 'Entry Price', 'Exit Price', 
      'Quantity', 'PnL', 'PnL %', 'Fees', 'Strategy', 'Duration (hours)', 
      'Status', 'Exit Timestamp', 'Notes'
    ];

    const csvRows = [
      headers.join(','),
      ...trades.map(trade => [
        trade.id,
        trade.timestamp,
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice || '',
        trade.quantity,
        trade.pnl || '',
        trade.pnlPercent ? `${trade.pnlPercent.toFixed(2)}%` : '',
        trade.fees,
        trade.strategy,
        trade.duration ? (trade.duration / 3600000).toFixed(2) : '',
        trade.status,
        trade.exitTimestamp || '',
        `"${trade.notes || ''}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }
}

export const tradeHistoryService = new TradeHistoryService();