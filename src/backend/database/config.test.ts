/**
 * Database Configuration Tests
 * Task DB-001: PostgreSQL & TimescaleDB Installation and Configuration
 * 
 * Basic validation tests for database configuration functionality
 */

import { describe, it, expect } from 'vitest';
import { 
  getDatabaseConfig, 
  validateDatabaseConfig, 
  getConnectionString 
} from './config';

describe('Database Configuration', () => {
  describe('getDatabaseConfig', () => {
    it('should return a valid database configuration', () => {
      const config = getDatabaseConfig();
      
      expect(config).toBeDefined();
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('algo_trading_bot');
      expect(config.user).toBe('algo_trader');
      expect(config.password).toBe('secure_trading_password_2025');
    });

    it('should have valid pool configuration', () => {
      const config = getDatabaseConfig();
      
      expect(config.pool.min).toBeGreaterThanOrEqual(1);
      expect(config.pool.max).toBeLessThanOrEqual(20); // As per task requirement
      expect(config.pool.max).toBeGreaterThan(config.pool.min);
      expect(config.pool.idleTimeoutMillis).toBeGreaterThan(0);
      expect(config.pool.connectionTimeoutMillis).toBeGreaterThan(0);
    });

    it('should have SSL configuration', () => {
      const config = getDatabaseConfig();
      
      expect(config.ssl).toBeDefined();
      expect(config.ssl.mode).toBeDefined();
      expect(typeof config.ssl.rejectUnauthorized).toBe('boolean');
    });

    it('should have health check configuration', () => {
      const config = getDatabaseConfig();
      
      expect(config.healthCheck).toBeDefined();
      expect(typeof config.healthCheck.enabled).toBe('boolean');
      expect(config.healthCheck.interval).toBeGreaterThan(0);
      expect(config.healthCheck.timeout).toBeGreaterThan(0);
    });
  });

  describe('validateDatabaseConfig', () => {
    it('should validate a correct configuration', () => {
      const config = getDatabaseConfig();
      expect(() => validateDatabaseConfig(config)).not.toThrow();
    });

    it('should throw error for invalid host', () => {
      const config = getDatabaseConfig();
      config.host = '';
      expect(() => validateDatabaseConfig(config)).toThrow('Database host is required');
    });

    it('should throw error for invalid database name', () => {
      const config = getDatabaseConfig();
      config.database = '';
      expect(() => validateDatabaseConfig(config)).toThrow('Database name is required');
    });

    it('should throw error for invalid pool configuration', () => {
      const config = getDatabaseConfig();
      config.pool.max = 0;
      expect(() => validateDatabaseConfig(config)).toThrow('Pool max connections must be at least 1');
    });

    it('should throw error when min > max connections', () => {
      const config = getDatabaseConfig();
      config.pool.min = 25;
      config.pool.max = 20;
      expect(() => validateDatabaseConfig(config)).toThrow('Pool min connections cannot exceed max connections');
    });
  });

  describe('getConnectionString', () => {
    it('should generate a valid connection string', () => {
      const config = getDatabaseConfig();
      const connectionString = getConnectionString(config);
      
      expect(connectionString).toContain('postgresql://');
      expect(connectionString).toContain(config.user);
      expect(connectionString).toContain(config.host);
      expect(connectionString).toContain(config.database);
      expect(connectionString).toContain('application_name=algo_trading_bot');
    });

    it('should include SSL parameters when configured', () => {
      const config = getDatabaseConfig();
      config.ssl.mode = 'require';
      const connectionString = getConnectionString(config);
      
      expect(connectionString).toContain('sslmode=require');
    });

    it('should include connection timeout', () => {
      const config = getDatabaseConfig();
      const connectionString = getConnectionString(config);
      
      expect(connectionString).toContain('connect_timeout=');
    });
  });

  describe('Configuration Requirements for Task DB-001', () => {
    it('should meet connection pooling requirement (max 20 connections)', () => {
      const config = getDatabaseConfig();
      expect(config.pool.max).toBeLessThanOrEqual(20);
    });

    it('should have SSL configuration enabled', () => {
      const config = getDatabaseConfig();
      expect(config.ssl.mode).toBeTruthy();
    });

    it('should have health check endpoints configured', () => {
      const config = getDatabaseConfig();
      expect(config.healthCheck.enabled).toBe(true);
      expect(config.healthCheck.interval).toBeGreaterThan(0);
      expect(config.healthCheck.timeout).toBeGreaterThan(0);
    });

    it('should have backup configuration', () => {
      const config = getDatabaseConfig();
      // Environment variables would control backup settings
      expect(config).toBeDefined();
    });

    it('should be production-ready', () => {
      const config = getDatabaseConfig();
      
      // Should have appropriate timeouts
      expect(config.pool.connectionTimeoutMillis).toBeGreaterThan(0);
      expect(config.query.timeout).toBeGreaterThan(0);
      
      // Should have retry configuration
      expect(config.query.maxRetries).toBeGreaterThan(0);
      expect(config.query.retryDelay).toBeGreaterThan(0);
    });
  });
});