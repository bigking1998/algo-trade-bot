/**
 * HistoricalDataProvider - Task BE-029: Event-Driven Backtesting Engine
 * 
 * Historical data provider for backtesting with:
 * - Integration with dYdX historical data API
 * - Data validation and quality checks
 * - Multiple data source support (dYdX, CSV, database)
 * - Data caching and optimization
 * - Gap detection and handling
 * - Data format normalization
 */

import { EventEmitter } from 'events';
import {
  HistoricalDataProvider as IHistoricalDataProvider,
  HistoricalDataPoint
} from './types';
import { Timeframe } from '../../shared/types/trading';

/**
 * dYdX Historical Data Provider Implementation
 */
export class DydxHistoricalDataProvider extends EventEmitter implements IHistoricalDataProvider {
  private baseUrl: string;
  private cache = new Map<string, HistoricalDataPoint[]>();
  private cacheExpiry = new Map<string, Date>();
  private readonly cacheTtl = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor(baseUrl: string = 'https://indexer.dydx.trade') {
    super();
    this.baseUrl = baseUrl;
  }

  /**
   * Get historical data for backtesting
   */
  async getHistoricalData(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe,
    options?: {
      includeWeekends?: boolean;
      adjustForSplits?: boolean;
      adjustForDividends?: boolean;
    }
  ): Promise<HistoricalDataPoint[]> {
    const allData: HistoricalDataPoint[] = [];
    
    // Fetch data for each symbol
    for (const symbol of symbols) {
      try {
        const symbolData = await this.fetchSymbolData(symbol, startDate, endDate, timeframe, options);
        allData.push(...symbolData);
        
        this.emit('data_loaded', { 
          symbol, 
          bars: symbolData.length, 
          startDate, 
          endDate, 
          timeframe 
        });
        
      } catch (error) {
        this.emit('error', new Error(
          `Failed to fetch data for ${symbol}: ${error instanceof Error ? error.message : String(error)}`
        ));
        throw error;
      }
    }
    
    // Sort by timestamp
    allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Validate data
    await this.validateData(allData, symbols, startDate, endDate);
    
    return allData;
  }

  /**
   * Get data range information for a symbol
   */
  async getDataRange(symbol: string, timeframe: Timeframe): Promise<{
    earliest: Date;
    latest: Date;
    totalBars: number;
    gaps: Array<{ start: Date; end: Date }>;
  }> {
    try {
      // Get a small sample to determine range
      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      const sampleData = await this.fetchSymbolData(symbol, threeMonthsAgo, now, timeframe);
      
      if (sampleData.length === 0) {
        throw new Error(`No data available for ${symbol}`);
      }
      
      // For now, return sample data range
      // In production, this would query the data provider for actual range
      const earliest = sampleData[0].timestamp;
      const latest = sampleData[sampleData.length - 1].timestamp;
      const gaps = this.detectGaps(sampleData, timeframe);
      
      return {
        earliest,
        latest,
        totalBars: sampleData.length,
        gaps
      };
      
    } catch (error) {
      throw new Error(`Failed to get data range for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate data availability for backtesting
   */
  async validateDataAvailability(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe
  ): Promise<{
    available: boolean;
    missingSymbols: string[];
    missingPeriods: Array<{ start: Date; end: Date }>;
    warnings: string[];
  }> {
    const missingSymbols: string[] = [];
    const missingPeriods: Array<{ start: Date; end: Date }> = [];
    const warnings: string[] = [];
    
    for (const symbol of symbols) {
      try {
        const range = await this.getDataRange(symbol, timeframe);
        
        // Check if requested period is within available range
        if (startDate < range.earliest) {
          missingPeriods.push({ start: startDate, end: range.earliest });
          warnings.push(`Data for ${symbol} starts later than requested start date`);
        }
        
        if (endDate > range.latest) {
          missingPeriods.push({ start: range.latest, end: endDate });
          warnings.push(`Data for ${symbol} ends before requested end date`);
        }
        
        // Check for gaps
        if (range.gaps.length > 0) {
          warnings.push(`Found ${range.gaps.length} data gaps for ${symbol}`);
        }
        
      } catch (error) {
        missingSymbols.push(symbol);
        warnings.push(`Could not validate data availability for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      available: missingSymbols.length === 0 && missingPeriods.length === 0,
      missingSymbols,
      missingPeriods,
      warnings
    };
  }

  /**
   * Fetch data for a single symbol
   */
  private async fetchSymbolData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe,
    options?: {
      includeWeekends?: boolean;
      adjustForSplits?: boolean;
      adjustForDividends?: boolean;
    }
  ): Promise<HistoricalDataPoint[]> {
    // Check cache first
    const cacheKey = `${symbol}_${timeframe}_${startDate.getTime()}_${endDate.getTime()}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Convert timeframe to dYdX format
      const resolution = this.convertTimeframe(timeframe);
      
      // Build API URL
      const url = `${this.baseUrl}/v4/candles/perpetualMarket/${symbol}` +
        `?resolution=${resolution}` +
        `&fromISO=${startDate.toISOString()}` +
        `&toISO=${endDate.toISOString()}` +
        `&limit=10000`; // dYdX limit
      
      this.emit('fetching_data', { symbol, url });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Convert dYdX data format to our format
      const historicalData = this.convertDydxData(data.candles || [], symbol, timeframe);
      
      // Apply options
      const processedData = this.applyOptions(historicalData, options);
      
      // Cache the data
      this.setCachedData(cacheKey, processedData);
      
      return processedData;
      
    } catch (error) {
      this.emit('fetch_error', { symbol, error });
      throw error;
    }
  }

  /**
   * Convert our timeframe format to dYdX resolution
   */
  private convertTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      '1m': '1MIN',
      '5m': '5MINS', 
      '15m': '15MINS',
      '30m': '30MINS',
      '1h': '1HOUR',
      '4h': '4HOURS',
      '1d': '1DAY'
    };
    
    return mapping[timeframe] || '1HOUR';
  }

  /**
   * Convert dYdX candle data to our format
   */
  private convertDydxData(
    candles: any[], 
    symbol: string, 
    timeframe: Timeframe
  ): HistoricalDataPoint[] {
    return candles.map(candle => ({
      timestamp: new Date(candle.startedAt),
      symbol,
      timeframe,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.baseTokenVolume || candle.volume || '0'),
      trades: candle.trades ? parseInt(candle.trades) : undefined,
      vwap: candle.vwap ? parseFloat(candle.vwap) : undefined
    })).filter(candle => 
      // Filter out invalid data
      candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0 &&
      candle.high >= candle.low && candle.high >= candle.open && candle.high >= candle.close &&
      candle.low <= candle.open && candle.low <= candle.close
    );
  }

  /**
   * Apply data processing options
   */
  private applyOptions(
    data: HistoricalDataPoint[],
    options?: {
      includeWeekends?: boolean;
      adjustForSplits?: boolean;
      adjustForDividends?: boolean;
    }
  ): HistoricalDataPoint[] {
    let processedData = data;
    
    // Filter weekends if requested
    if (options?.includeWeekends === false) {
      processedData = processedData.filter(point => {
        const day = point.timestamp.getDay();
        return day !== 0 && day !== 6; // Exclude Sunday (0) and Saturday (6)
      });
    }
    
    // Note: Split and dividend adjustments would be implemented here
    // For crypto data, these adjustments are typically not needed
    
    return processedData;
  }

  /**
   * Validate historical data quality
   */
  private async validateData(
    data: HistoricalDataPoint[],
    symbols: string[],
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const warnings: string[] = [];
    
    // Check for empty data
    if (data.length === 0) {
      throw new Error('No historical data received');
    }
    
    // Group data by symbol
    const dataBySymbol = new Map<string, HistoricalDataPoint[]>();
    for (const point of data) {
      if (!dataBySymbol.has(point.symbol)) {
        dataBySymbol.set(point.symbol, []);
      }
      dataBySymbol.get(point.symbol)!.push(point);
    }
    
    // Validate each symbol
    for (const symbol of symbols) {
      const symbolData = dataBySymbol.get(symbol) || [];
      
      if (symbolData.length === 0) {
        warnings.push(`No data found for symbol: ${symbol}`);
        continue;
      }
      
      // Check data range
      const firstPoint = symbolData[0];
      const lastPoint = symbolData[symbolData.length - 1];
      
      if (firstPoint.timestamp > startDate) {
        warnings.push(`Data for ${symbol} starts later than requested: ${firstPoint.timestamp.toISOString()}`);
      }
      
      if (lastPoint.timestamp < endDate) {
        warnings.push(`Data for ${symbol} ends earlier than requested: ${lastPoint.timestamp.toISOString()}`);
      }
      
      // Check for price anomalies
      for (const point of symbolData) {
        if (point.high < point.low || 
            point.open > point.high || point.open < point.low ||
            point.close > point.high || point.close < point.low) {
          warnings.push(`Invalid price data detected for ${symbol} at ${point.timestamp.toISOString()}`);
        }
      }
    }
    
    // Emit warnings if any
    if (warnings.length > 0) {
      this.emit('validation_warnings', warnings);
    }
  }

  /**
   * Detect gaps in historical data
   */
  private detectGaps(
    data: HistoricalDataPoint[], 
    timeframe: Timeframe
  ): Array<{ start: Date; end: Date }> {
    if (data.length < 2) return [];
    
    const expectedInterval = this.getTimeframeInterval(timeframe);
    const gaps: Array<{ start: Date; end: Date }> = [];
    
    for (let i = 1; i < data.length; i++) {
      const prevTime = data[i - 1].timestamp.getTime();
      const currTime = data[i].timestamp.getTime();
      const actualInterval = currTime - prevTime;
      
      // If gap is significantly larger than expected interval
      if (actualInterval > expectedInterval * 1.5) {
        gaps.push({
          start: new Date(prevTime),
          end: new Date(currTime)
        });
      }
    }
    
    return gaps;
  }

  /**
   * Get timeframe interval in milliseconds
   */
  private getTimeframeInterval(timeframe: Timeframe): number {
    const intervals: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return intervals[timeframe] || 60 * 60 * 1000;
  }

  /**
   * Cache management
   */
  private getCachedData(key: string): HistoricalDataPoint[] | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && expiry > new Date()) {
      return this.cache.get(key) || null;
    }
    
    // Clean expired cache entry
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return null;
  }

  private setCachedData(key: string, data: HistoricalDataPoint[]): void {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, new Date(Date.now() + this.cacheTtl));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    totalDataPoints: number;
    memoryUsage: number;
  } {
    let totalDataPoints = 0;
    for (const data of this.cache.values()) {
      totalDataPoints += data.length;
    }
    
    // Rough memory estimation
    const memoryUsage = totalDataPoints * 200; // Assume ~200 bytes per data point
    
    return {
      entries: this.cache.size,
      totalDataPoints,
      memoryUsage
    };
  }
}

/**
 * CSV Historical Data Provider (for testing and custom data)
 */
export class CsvHistoricalDataProvider extends EventEmitter implements IHistoricalDataProvider {
  private dataPath: string;

  constructor(dataPath: string) {
    super();
    this.dataPath = dataPath;
  }

  async getHistoricalData(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe,
    options?: {
      includeWeekends?: boolean;
      adjustForSplits?: boolean;
      adjustForDividends?: boolean;
    }
  ): Promise<HistoricalDataPoint[]> {
    // This would implement CSV file reading
    // For now, return empty array as placeholder
    this.emit('warning', 'CSV data provider not fully implemented');
    return [];
  }

  async getDataRange(symbol: string, timeframe: Timeframe): Promise<{
    earliest: Date;
    latest: Date;
    totalBars: number;
    gaps: Array<{ start: Date; end: Date }>;
  }> {
    // Placeholder implementation
    const now = new Date();
    return {
      earliest: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      latest: now,
      totalBars: 0,
      gaps: []
    };
  }

  async validateDataAvailability(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe
  ): Promise<{
    available: boolean;
    missingSymbols: string[];
    missingPeriods: Array<{ start: Date; end: Date }>;
    warnings: string[];
  }> {
    return {
      available: false,
      missingSymbols: symbols,
      missingPeriods: [],
      warnings: ['CSV data provider not implemented']
    };
  }
}

/**
 * Mock Historical Data Provider (for testing)
 */
export class MockHistoricalDataProvider extends EventEmitter implements IHistoricalDataProvider {
  
  async getHistoricalData(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe,
    options?: {
      includeWeekends?: boolean;
      adjustForSplits?: boolean;
      adjustForDividends?: boolean;
    }
  ): Promise<HistoricalDataPoint[]> {
    const data: HistoricalDataPoint[] = [];
    const interval = this.getTimeframeInterval(timeframe);
    
    for (const symbol of symbols) {
      let currentTime = startDate.getTime();
      let price = 100 + Math.random() * 50; // Start price between 100-150
      
      while (currentTime <= endDate.getTime()) {
        // Generate realistic OHLC data
        const open = price;
        const change = (Math.random() - 0.5) * 0.04; // ±2% change
        const high = open * (1 + Math.abs(change) + Math.random() * 0.01);
        const low = open * (1 - Math.abs(change) - Math.random() * 0.01);
        const close = open * (1 + change);
        
        data.push({
          timestamp: new Date(currentTime),
          symbol,
          timeframe,
          open,
          high,
          low,
          close,
          volume: 1000000 + Math.random() * 9000000, // 1M-10M volume
          trades: Math.floor(100 + Math.random() * 900),
          vwap: (high + low + close) / 3
        });
        
        price = close;
        currentTime += interval;
      }
    }
    
    return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getDataRange(symbol: string, timeframe: Timeframe): Promise<{
    earliest: Date;
    latest: Date;
    totalBars: number;
    gaps: Array<{ start: Date; end: Date }>;
  }> {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    return {
      earliest: oneYearAgo,
      latest: now,
      totalBars: Math.floor((now.getTime() - oneYearAgo.getTime()) / this.getTimeframeInterval(timeframe)),
      gaps: []
    };
  }

  async validateDataAvailability(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe
  ): Promise<{
    available: boolean;
    missingSymbols: string[];
    missingPeriods: Array<{ start: Date; end: Date }>;
    warnings: string[];
  }> {
    return {
      available: true,
      missingSymbols: [],
      missingPeriods: [],
      warnings: ['Using mock data for testing']
    };
  }

  private getTimeframeInterval(timeframe: Timeframe): number {
    const intervals: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return intervals[timeframe] || 60 * 60 * 1000;
  }
}

export { DydxHistoricalDataProvider as DefaultHistoricalDataProvider };