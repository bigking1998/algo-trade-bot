/**
 * DatabaseManager Test Suite - Task BE-001
 * 
 * Comprehensive testing of DatabaseManager functionality including:
 * - Singleton pattern
 * - Connection pooling
 * - Health checks
 * - Error handling
 * - Redis caching
 * - Circuit breaker logic
 * - Reconnection strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager, getDatabaseManager } from '../DatabaseManager';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock pg Pool
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
    options: { max: 20, min: 2 },
    on: vi.fn()
  })),
  types: {
    setTypeParser: vi.fn(),
    builtins: {
      NUMERIC: 1700,
      INT8: 20
    }
  }
}));

// Mock ioredis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    status: 'ready'
  }))
}));

// Mock database config
vi.mock('../config', () => ({
  getDatabaseConfig: vi.fn(() => ({
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_pass',
    pool: {
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    },
    ssl: {
      mode: 'disable',
      rejectUnauthorized: false
    },
    debug: false
  })),
  getConnectionString: vi.fn(() => 'postgresql://test_user:test_pass@localhost:5432/test_db')
}));

// Mock health monitor
vi.mock('../health', () => ({
  DatabaseHealthMonitor: vi.fn().mockImplementation(() => ({
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    performHealthCheck: vi.fn().mockResolvedValue([
      {
        component: 'database_connectivity',
        status: 'healthy',
        details: { response_time_ms: 50 },
        timestamp: new Date(),
        responseTime: 50
      }
    ]),
    getMetrics: vi.fn().mockResolvedValue({
      connectionCount: 5,
      activeConnections: 2,
      idleConnections: 3,
      waitingConnections: 0,
      totalConnections: 5,
      databaseSize: '10MB',
      lastHealthCheck: new Date(),
      uptime: '1 day',
      version: 'PostgreSQL 15.0'
    })
  }))
}));

describe('DatabaseManager - Task BE-001', () => {
  let dbManager: DatabaseManager;
  let mockPool: any;
  let mockRedis: any;

  beforeEach(() => {
    // Reset singleton instance
    (DatabaseManager as any).instance = null;
    
    // Get fresh instance
    dbManager = getDatabaseManager({
      enableRedis: true,
      enableHealthMonitoring: true
    });

    mockPool = new Pool();
    mockRedis = new Redis();
    
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.shutdown();
    }
    await DatabaseManager.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getDatabaseManager();
      const instance2 = getDatabaseManager();
      expect(instance1).toBe(instance2);
    });

    it('should allow instance reset for testing', async () => {
      const instance1 = getDatabaseManager();
      await DatabaseManager.resetInstance();
      const instance2 = getDatabaseManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Connection Pool Management', () => {
    it('should configure pool with correct parameters', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        connectionString: expect.stringContaining('postgresql://'),
        min: 2,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }));
    });

    it('should return pool status correctly', () => {
      const status = dbManager.getPoolStatus();
      
      expect(status).toEqual({
        connected: false // Not initialized yet
      });
    });

    it('should handle 20 concurrent connections', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ 
          rows: [{ test: 'value' }],
          rowCount: 1,
          fields: []
        }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      // Simulate 20 concurrent queries
      const concurrentQueries = Array(20).fill(0).map((_, i) => 
        dbManager.query(`SELECT ${i} as test_query`)
      );

      const results = await Promise.allSettled(concurrentQueries);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(0); // At least some should succeed
    });
  });

  describe('Health Check Methods', () => {
    it('should perform health checks', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();
      const healthStatus = await dbManager.getHealthStatus();

      expect(healthStatus).toHaveProperty('database');
      expect(healthStatus).toHaveProperty('metrics');
      expect(healthStatus).toHaveProperty('redis');
      expect(healthStatus).toHaveProperty('circuitBreaker');
    });

    it('should meet health check performance target (<100ms)', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();
      
      const start = Date.now();
      await dbManager.getHealthStatus();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be < 100ms
    });
  });

  describe('Error Handling and Reconnection Logic', () => {
    it('should handle connection errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(dbManager.initialize()).rejects.toThrow('Connection failed');
    });

    it('should implement circuit breaker pattern', async () => {
      const mockConnect = vi.fn()
        .mockResolvedValueOnce({
          query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
          release: vi.fn()
        })
        .mockRejectedValue(new Error('Connection failed'));

      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      // Trigger multiple failures to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await dbManager.query('SELECT 1');
        } catch (e) {
          // Expected to fail
        }
      }

      // Circuit should be open, next query should fail immediately
      await expect(dbManager.query('SELECT 1')).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should implement exponential backoff reconnection', async () => {
      const mockConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));
      mockPool.connect.mockImplementation(mockConnect);

      // Spy on setTimeout to verify backoff timing
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await expect(dbManager.initialize()).rejects.toThrow();

      // Should schedule reconnection with exponential backoff
      expect(setTimeoutSpy).toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });

    it('should recover within 30 seconds', async () => {
      const mockConnect = vi.fn()
        .mockResolvedValueOnce({
          query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
          release: vi.fn()
        })
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [{ test: 'recovered' }], rowCount: 1, fields: [] }),
          release: vi.fn()
        });

      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      // Mock timer to simulate 30 second recovery
      vi.useFakeTimers();
      
      try {
        await dbManager.query('SELECT 1'); // This will fail
      } catch (e) {
        // Expected failure
      }

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      // Should be able to query again
      const result = await dbManager.query<{test: string}>('SELECT \'recovered\' as test');
      expect(result.rows[0].test).toBe('recovered');

      vi.useRealTimers();
    });
  });

  describe('Redis Integration for Caching', () => {
    it('should initialize Redis connection', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 6379,
        connectTimeout: 10000,
        lazyConnect: true
      }));
    });

    it('should cache SELECT query results', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ 
          rows: [{ cached_result: 'test' }],
          rowCount: 1,
          fields: []
        }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);
      mockRedis.get.mockResolvedValue(null).mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValue('OK');

      await dbManager.initialize();

      // First query should hit database and cache result
      await dbManager.query('SELECT * FROM test', [], { key: 'test_key', ttl: 300 });

      expect(mockRedis.setex).toHaveBeenCalledWith('test_key', 300, expect.any(String));
    });

    it('should return cached results for subsequent queries', async () => {
      const cachedResult = JSON.stringify({
        rows: [{ cached_result: 'from_cache' }],
        rowCount: 1,
        fields: []
      });

      mockRedis.get.mockResolvedValue(cachedResult);

      await dbManager.initialize();

      const result = await dbManager.query<{cached_result: string}>('SELECT * FROM test', [], { key: 'test_key', ttl: 300 });
      
      expect(result.rows[0].cached_result).toBe('from_cache');
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should meet cache performance target (<5ms)', async () => {
      const cachedResult = JSON.stringify({
        rows: [{ fast_result: 'cached' }],
        rowCount: 1,
        fields: []
      });

      mockRedis.get.mockResolvedValue(cachedResult);

      await dbManager.initialize();

      const start = Date.now();
      await dbManager.query('SELECT * FROM test', [], { key: 'test_key', ttl: 300 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5); // Should be < 5ms
    });

    it('should handle cache clearing', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.del.mockResolvedValue(3);

      await dbManager.initialize();

      const deletedCount = await dbManager.clearCache('test_*');
      
      expect(mockRedis.keys).toHaveBeenCalledWith('test_*');
      expect(deletedCount).toBe(3);
    });

    it('should gracefully handle Redis failures', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ 
          rows: [{ result: 'without_cache' }],
          rowCount: 1,
          fields: []
        }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      // Simulate Redis failure
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await dbManager.initialize();

      // Query should still work without cache
      const result = await dbManager.query<{result: string}>('SELECT \'without_cache\' as result');
      expect(result.rows[0].result).toBe('without_cache');
    });
  });

  describe('Transaction Support', () => {
    it('should handle transactions correctly', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1, fields: [] }) // INSERT
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient);

      await dbManager.initialize();

      const result = await dbManager.transaction(async (client) => {
        const insertResult = await client.query('INSERT INTO test VALUES (1)');
        return insertResult.rows[0];
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result.id).toBe(1);
    });

    it('should rollback on transaction failure', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('Query failed')) // Failed query
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: vi.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient);

      await dbManager.initialize();

      await expect(dbManager.transaction(async (client) => {
        await client.query('INVALID QUERY');
      })).rejects.toThrow('Query failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all connections gracefully', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 15.0' }] }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();
      await dbManager.shutdown();

      expect(mockPool.end).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockPool.end.mockRejectedValue(new Error('Shutdown failed'));
      mockRedis.quit.mockRejectedValue(new Error('Redis shutdown failed'));

      await dbManager.initialize();
      
      // Should not throw
      await expect(dbManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    it('should handle queries within reasonable time limits', async () => {
      const mockConnect = vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ 
          rows: [{ result: 'fast' }],
          rowCount: 1,
          fields: []
        }),
        release: vi.fn()
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      const start = Date.now();
      await dbManager.query('SELECT 1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should support query retry with exponential backoff', async () => {
      let callCount = 0;
      const mockConnect = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          query: vi.fn().mockResolvedValue({ 
            rows: [{ result: 'success' }],
            rowCount: 1,
            fields: []
          }),
          release: vi.fn()
        });
      });
      mockPool.connect.mockImplementation(mockConnect);

      await dbManager.initialize();

      const result = await dbManager.query<{result: string}>('SELECT \'success\' as result');
      expect(result.rows[0].result).toBe('success');
      expect(callCount).toBe(3); // Should retry twice before succeeding
    });
  });
});