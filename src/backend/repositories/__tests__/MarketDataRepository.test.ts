/**
 * MarketDataRepository Tests - Task BE-005
 * 
 * Comprehensive test suite for MarketDataRepository implementation
 * Tests time-series optimization, data compression, real-time integration, and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarketDataRepository, MarketDataInsert, CandleData } from '../MarketDataRepository';
import { MarketData, ValidationError } from '../../types/database';
import { DatabaseManager } from '../../database/DatabaseManager';

// Mock DatabaseManager
vi.mock('../../database/DatabaseManager', () => ({
  DatabaseManager: {
    getInstance: vi.fn(() => ({
      query: vi.fn(),
      transaction: vi.fn(),
      clearCache: vi.fn(),
    })),
  },
}));

describe('MarketDataRepository', () => {
  let repository: MarketDataRepository;
  let mockDbManager: any;

  const sampleMarketData: MarketData = {
    id: '1',
    time: new Date('2023-01-01T10:00:00Z'),
    symbol: 'BTC-USD',
    exchange: 'dydx',
    open: 50000,
    high: 51000,
    low: 49500,
    close: 50500,
    volume: 1000,
    quote_volume: 50500000,
    trades_count: 100,
    timeframe: '1h',
    raw_data: { test: 'data' },
    created_at: new Date('2023-01-01T10:00:00Z'),
    updated_at: new Date('2023-01-01T10:00:00Z'),
  };

  const sampleMarketDataInsert: MarketDataInsert = {
    time: new Date('2023-01-01T10:00:00Z'),
    symbol: 'BTC-USD',
    exchange: 'dydx',
    open: 50000,
    high: 51000,
    low: 49500,
    close: 50500,
    volume: 1000,
    quote_volume: 50500000,
    trades_count: 100,
    timeframe: '1h',
    raw_data: { test: 'data' },
  };

  beforeEach(() => {
    mockDbManager = {
      query: vi.fn(),
      transaction: vi.fn(),
      clearCache: vi.fn(),
    };
    
    // Mock DatabaseManager.getInstance to return our mock
    (DatabaseManager.getInstance as any).mockReturnValue(mockDbManager);
    
    repository = new MarketDataRepository();
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct table name and primary key', () => {
      expect(repository).toBeInstanceOf(MarketDataRepository);
      expect((repository as any).tableName).toBe('market_data');
      expect((repository as any).primaryKey).toBe('time');
    });
  });

  describe('insertMarketData', () => {
    it('should insert market data successfully', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [sampleMarketData],
        rowCount: 1,
      });

      const result = await repository.insertMarketData(sampleMarketDataInsert);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleMarketData);
      expect(result.metadata?.rowCount).toBe(1);
      expect(mockDbManager.query).toHaveBeenCalledTimes(1);
    });

    it('should validate OHLCV data before insertion', async () => {
      const invalidData: MarketDataInsert = {
        ...sampleMarketDataInsert,
        high: 49000, // High less than open/close
      };

      const result = await repository.insertMarketData(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('High price cannot be less than');
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });

    it('should handle negative volume validation', async () => {
      const invalidData: MarketDataInsert = {
        ...sampleMarketDataInsert,
        volume: -100,
      };

      const result = await repository.insertMarketData(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Volume cannot be negative');
    });

    it('should handle invalid timeframe validation', async () => {
      const invalidData: MarketDataInsert = {
        ...sampleMarketDataInsert,
        timeframe: 'invalid' as any,
      };

      const result = await repository.insertMarketData(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid timeframe');
    });

    it('should handle database errors gracefully', async () => {
      mockDbManager.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await repository.insertMarketData(sampleMarketDataInsert);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Database connection failed');
    });
  });

  describe('bulkInsertMarketData', () => {
    it('should handle empty data array', async () => {
      const result = await repository.bulkInsertMarketData([]);

      expect(result.success).toBe(true);
      expect(result.data?.inserted).toBe(0);
      expect(result.data?.processing_time_ms).toBe(0);
    });

    it('should process valid bulk data successfully', async () => {
      const bulkData = [sampleMarketDataInsert, { ...sampleMarketDataInsert, symbol: 'ETH-USD' }];

      mockDbManager.transaction.mockImplementation(async (callback) => {
        const mockClient = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
        return await callback({ client: mockClient });
      });

      const result = await repository.bulkInsertMarketData(bulkData);

      expect(result.success).toBe(true);
      expect(result.data?.inserted).toBeGreaterThan(0);
      expect(mockDbManager.transaction).toHaveBeenCalledTimes(1);
    });

    it('should validate bulk data when validation is enabled', async () => {
      const bulkData = [
        sampleMarketDataInsert,
        { ...sampleMarketDataInsert, volume: -100 }, // Invalid volume
      ];

      const result = await repository.bulkInsertMarketData(bulkData, { validate_ohlcv: true });

      expect(result.success).toBe(true);
      expect(result.data?.failed).toBe(1);
    });

    it('should handle batch processing options', async () => {
      const bulkData = Array(2500).fill(null).map((_, i) => ({
        ...sampleMarketDataInsert,
        symbol: `TEST-${i}`,
      }));

      mockDbManager.transaction.mockImplementation(async (callback) => {
        const mockClient = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
        return await callback({ client: mockClient });
      });

      const result = await repository.bulkInsertMarketData(bulkData, {
        batch_size: 1000,
        parallel_processing: false,
      });

      expect(result.success).toBe(true);
      expect(mockDbManager.transaction).toHaveBeenCalled();
    });
  });

  describe('getOHLCVData', () => {
    const sampleCandleData: CandleData[] = [
      {
        time: 1672574400000, // 2023-01-01T10:00:00Z in milliseconds
        open: 50000,
        high: 51000,
        low: 49500,
        close: 50500,
        volume: 1000,
      },
    ];

    it('should retrieve OHLCV data successfully', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: sampleCandleData,
        rowCount: 1,
      });

      const result = await repository.getOHLCVData(
        'BTC-USD',
        '1h',
        new Date('2023-01-01T00:00:00Z'),
        new Date('2023-01-01T23:59:59Z')
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleCandleData);
      expect(result.metadata?.rowCount).toBe(1);
      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['BTC-USD', '1h']),
        expect.objectContaining({ key: expect.any(String), ttl: expect.any(Number) })
      );
    });

    it('should handle limit parameter correctly', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: sampleCandleData,
        rowCount: 1,
      });

      await repository.getOHLCVData(
        'BTC-USD',
        '1h',
        new Date('2023-01-01T00:00:00Z'),
        new Date('2023-01-01T23:59:59Z'),
        100
      );

      const lastCall = mockDbManager.query.mock.calls[0];
      expect(lastCall[1]).toHaveLength(5); // Should include limit parameter
      expect(lastCall[1][4]).toBe(100);
    });

    it('should handle database errors in OHLCV retrieval', async () => {
      mockDbManager.query.mockRejectedValue(new Error('Query timeout'));

      const result = await repository.getOHLCVData(
        'BTC-USD',
        '1h',
        new Date('2023-01-01T00:00:00Z'),
        new Date('2023-01-01T23:59:59Z')
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Query timeout');
    });
  });

  describe('getLatestMarketData', () => {
    it('should retrieve latest market data for multiple symbols', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [sampleMarketData],
        rowCount: 1,
      });

      const result = await repository.getLatestMarketData(['BTC-USD', 'ETH-USD'], '1h');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([sampleMarketData]);
      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT ON'),
        expect.arrayContaining([['BTC-USD', 'ETH-USD'], '1h']),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });

    it('should handle empty symbols array', async () => {
      const result = await repository.getLatestMarketData([], '1h');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata?.rowCount).toBe(0);
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });

    it('should use default timeframe when not specified', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [sampleMarketData],
        rowCount: 1,
      });

      await repository.getLatestMarketData(['BTC-USD']);

      const lastCall = mockDbManager.query.mock.calls[0];
      expect(lastCall[1][1]).toBe('1h'); // Default timeframe
    });
  });

  describe('searchMarketData', () => {
    const mockFilters = {
      symbol: 'BTC-USD',
      start_time: new Date('2023-01-01T00:00:00Z'),
      end_time: new Date('2023-01-01T23:59:59Z'),
      min_volume: 100,
    };

    it('should search market data with filters', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Count query
        .mockResolvedValueOnce({ rows: [sampleMarketData] }); // Data query

      const result = await repository.searchMarketData(mockFilters, { limit: 50, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.data?.data).toEqual([sampleMarketData]);
      expect(result.data?.total).toBe(10);
      expect(result.data?.page).toBe(1);
      expect(result.data?.pageSize).toBe(50);
      expect(mockDbManager.query).toHaveBeenCalledTimes(2); // Count + data queries
    });

    it('should handle multiple symbols filter', async () => {
      const filtersWithSymbols = {
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframes: ['1h' as const, '4h' as const],
      };

      mockDbManager.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [sampleMarketData] });

      await repository.searchMarketData(filtersWithSymbols);

      // Verify that both queries contain the symbols array parameter
      expect(mockDbManager.query).toHaveBeenCalledTimes(2);
      const calls = mockDbManager.query.mock.calls;
      calls.forEach(call => {
        expect(call[1]).toContain(filtersWithSymbols.symbols);
        expect(call[1]).toContain(filtersWithSymbols.timeframes);
      });
    });
  });

  describe('getAggregatedData', () => {
    it('should get aggregated time-series data', async () => {
      const mockAggregatedData = {
        period: '2023-01-01 10:00:00+00',
        open: 50000,
        high: 51000,
        low: 49500,
        close: 50500,
        volume: 1000,
        vwap: 50250,
        trades_count: 100,
        timeframe: '1h',
      };

      mockDbManager.query.mockResolvedValue({
        rows: [mockAggregatedData],
        rowCount: 1,
      });

      const result = await repository.getAggregatedData(
        'BTC-USD',
        '1h',
        '4 hours',
        new Date('2023-01-01T00:00:00Z'),
        new Date('2023-01-01T23:59:59Z')
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockAggregatedData]);
      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('time_bucket'),
        expect.arrayContaining(['BTC-USD', '1h']),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });
  });

  describe('compressHistoricalData', () => {
    it('should compress historical data successfully', async () => {
      const mockCompressionResult = {
        rows: [{ compress_chunk: 'chunk_1' }, { compress_chunk: 'chunk_2' }],
      };
      const mockStatsResult = {
        rows: [{
          total_chunks: 2,
          before_bytes: 10000000,
          after_bytes: 3000000,
          avg_ratio: 3.33,
        }],
      };

      mockDbManager.query
        .mockResolvedValueOnce(mockCompressionResult)
        .mockResolvedValueOnce(mockStatsResult);

      const result = await repository.compressHistoricalData('BTC-USD', 30);

      expect(result.success).toBe(true);
      expect(result.data?.chunks_compressed).toBe(2);
      expect(result.data?.compression_ratio).toBe(3.33);
      expect(result.data?.space_saved_mb).toBeGreaterThan(0);
      expect(mockDbManager.query).toHaveBeenCalledTimes(2);
    });

    it('should compress all symbols when no symbol specified', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ avg_ratio: 1 }] });

      const result = await repository.compressHistoricalData(undefined, 7);

      expect(result.success).toBe(true);
      
      // Verify compression query doesn't include symbol filter
      const compressionQuery = mockDbManager.query.mock.calls[0][0];
      expect(compressionQuery).not.toContain('range_start_value LIKE');
    });
  });

  describe('validateDataQuality', () => {
    it('should generate data quality report', async () => {
      const mockQualityStats = {
        total_records: 1000,
        duplicate_count: 5,
        gap_count: 2,
        price_anomalies: 1,
        volume_anomalies: 0,
        data_coverage_percent: 98.5,
      };

      mockDbManager.query.mockResolvedValue({
        rows: [mockQualityStats],
      });

      const result = await repository.validateDataQuality(
        'BTC-USD',
        '1h',
        new Date('2023-01-01T00:00:00Z'),
        new Date('2023-01-01T23:59:59Z')
      );

      expect(result.success).toBe(true);
      expect(result.data?.total_records).toBe(1000);
      expect(result.data?.duplicate_count).toBe(5);
      expect(result.data?.gap_count).toBe(2);
      expect(result.data?.price_anomalies).toBe(1);
      expect(result.data?.volume_anomalies).toBe(0);
      expect(result.data?.data_coverage_percent).toBe(98.5);
    });

    it('should handle quality analysis without filters', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [{}] });

      const result = await repository.validateDataQuality();

      expect(result.success).toBe(true);
      
      // Verify query doesn't have WHERE clause when no filters
      const query = mockDbManager.query.mock.calls[0][0];
      const whereCount = (query.match(/WHERE/gi) || []).length;
      expect(whereCount).toBeLessThanOrEqual(2); // Only in subqueries, not main query
    });
  });

  describe('streamMarketData', () => {
    it('should return stream configuration', async () => {
      const result = await repository.streamMarketData(
        ['BTC-USD', 'ETH-USD'],
        ['1h', '4h'],
        vi.fn(),
        vi.fn()
      );

      expect(result.success).toBe(true);
      expect(result.data?.stream_id).toMatch(/^stream_\d+_\w+$/);
      expect(result.data?.status).toBe('active');
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Entity Validation', () => {
    it('should validate required fields for create operation', async () => {
      const invalidEntity: Partial<MarketData> = {
        symbol: 'BTC-USD',
        // Missing required fields like time, timeframe, OHLC prices
      };

      try {
        await (repository as any).validateEntity(invalidEntity, 'create');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
      }
    });

    it('should validate positive prices', async () => {
      const invalidEntity: Partial<MarketData> = {
        time: new Date(),
        symbol: 'BTC-USD',
        timeframe: '1h',
        open: -100, // Invalid negative price
        high: 51000,
        low: 49500,
        close: 50500,
        volume: 1000,
      };

      try {
        await (repository as any).validateEntity(invalidEntity, 'create');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('must be positive');
      }
    });

    it('should allow valid entity for update operation', async () => {
      const validEntity: Partial<MarketData> = {
        volume: 1200,
        close: 50600,
      };

      // Should not throw
      await expect(
        (repository as any).validateEntity(validEntity, 'update')
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache after insert operations', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [sampleMarketData],
        rowCount: 1,
      });

      await repository.insertMarketData(sampleMarketDataInsert);

      // Verify cache invalidation was called
      expect(mockDbManager.clearCache).toHaveBeenCalled();
      
      // Check that cache patterns include symbol-specific entries
      const cacheCallArgs = mockDbManager.clearCache.mock.calls;
      expect(cacheCallArgs.length).toBeGreaterThan(0);
      const hasSymbolPattern = cacheCallArgs.some(call => 
        Array.isArray(call[0]) && call[0].some((pattern: string) => pattern.includes('BTC-USD'))
      );
      expect(hasSymbolPattern).toBe(true);
    });

    it('should use caching for read operations', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [sampleMarketData],
        rowCount: 1,
      });

      await repository.getLatestMarketData(['BTC-USD'], '1h');

      // Verify query was called with cache options
      const queryCall = mockDbManager.query.mock.calls[0];
      expect(queryCall[2]).toHaveProperty('key');
      expect(queryCall[2]).toHaveProperty('ttl');
    });
  });

  describe('Error Handling', () => {
    it('should handle and wrap database connection errors', async () => {
      const dbError = new Error('Connection refused');
      dbError.name = 'ConnectionError';
      mockDbManager.query.mockRejectedValue(dbError);

      const result = await repository.getLatestMarketData(['BTC-USD']);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Connection refused');
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle transaction rollbacks gracefully', async () => {
      mockDbManager.transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await repository.bulkInsertMarketData([sampleMarketDataInsert]);

      expect(result.success).toBe(true);
      expect(result.data?.failed).toBeGreaterThan(0);
    });
  });

  describe('Performance and Optimization', () => {
    it('should track execution time for operations', async () => {
      mockDbManager.query.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ rows: [sampleMarketData], rowCount: 1 }), 50)
        )
      );

      const result = await repository.insertMarketData(sampleMarketDataInsert);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(50);
    });

    it('should use appropriate cache TTL for different data types', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [sampleMarketData] });

      // Test real-time data cache (short TTL)
      await repository.getLatestMarketData(['BTC-USD']);
      expect(mockDbManager.query.mock.calls[0][2].ttl).toBe(30);

      mockDbManager.query.mockClear();

      // Test historical data cache (medium TTL)
      await repository.getOHLCVData('BTC-USD', '1h', new Date(), new Date());
      expect(mockDbManager.query.mock.calls[0][2].ttl).toBe(300);
    });
  });
});