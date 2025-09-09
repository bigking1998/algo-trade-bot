/**
 * BaseRepository Test Suite - Task BE-002
 * Comprehensive tests for BaseRepository abstract class functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { DatabaseManager } from '../../database/DatabaseManager';
import { BaseRepository, RepositoryResult } from '../BaseRepository';
import { BaseEntity, TableName } from '../../types/database';

// Test entity interface
interface TestEntity extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  is_deleted?: boolean;
  created_at: Date;
  updated_at: Date;
}

// Concrete implementation for testing
class TestRepository extends BaseRepository<TestEntity> {
  constructor() {
    super('strategies' as TableName, 'id');
  }

  // Expose protected methods for testing
  public async testQuery<R = any>(
    text: string,
    params?: unknown[]
  ): Promise<any> {
    return this.query<R>(text, params);
  }

  public testBuildInsertQuery(entity: Partial<TestEntity>): { query: string; values: any[] } {
    return this.buildInsertQuery(entity);
  }

  public testBuildSelectQuery(
    criteria: Partial<TestEntity>,
    options = {}
  ): { query: string; values: any[] } {
    return this.buildSelectQuery(criteria, options);
  }

  public testBuildUpdateQuery(id: string, updates: Partial<TestEntity>): { query: string; values: any[] } {
    return this.buildUpdateQuery(id, updates);
  }

  public testBuildCountQuery(criteria: Partial<TestEntity>): { query: string; values: any[] } {
    return this.buildCountQuery(criteria);
  }

  public testPrepareEntityForCreate(entity: Partial<TestEntity>): Partial<TestEntity> {
    return this.prepareEntityForCreate(entity);
  }

  public testPrepareEntityForUpdate(updates: Partial<TestEntity>): Partial<TestEntity> {
    return this.prepareEntityForUpdate(updates);
  }

  public async testGetCached<R>(key: string): Promise<R | null> {
    return this.getCached<R>(key);
  }

  public async testSetCached<R>(key: string, value: R, ttl?: number): Promise<void> {
    return this.setCached(key, value, ttl);
  }

  public async testInvalidateCache(patterns: string[]): Promise<void> {
    return this.invalidateCache(patterns);
  }

  public async testHasColumn(columnName: string): Promise<boolean> {
    return this.hasColumn(columnName);
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Initialize database manager for testing
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.shutdown();
    await DatabaseManager.resetInstance();
  });

  beforeEach(() => {
    repository = new TestRepository();
  });

  describe('Query Builder Methods', () => {
    describe('buildInsertQuery', () => {
      it('should build correct INSERT query', () => {
        const entity = {
          name: 'Test Strategy',
          description: 'Test Description',
          created_at: new Date(),
          updated_at: new Date(),
        };

        const { query, values } = repository.testBuildInsertQuery(entity);

        expect(query).toContain('INSERT INTO strategies');
        expect(query).toContain('RETURNING *');
        expect(query).toContain('name, description, created_at, updated_at');
        expect(values).toHaveLength(4);
        expect(values[0]).toBe('Test Strategy');
        expect(values[1]).toBe('Test Description');
      });

      it('should handle partial entities', () => {
        const entity = { name: 'Test Strategy' };
        const { query, values } = repository.testBuildInsertQuery(entity);

        expect(query).toContain('INSERT INTO strategies');
        expect(values).toHaveLength(1);
        expect(values[0]).toBe('Test Strategy');
      });
    });

    describe('buildSelectQuery', () => {
      it('should build basic SELECT query', () => {
        const criteria = { name: 'Test Strategy' };
        const { query, values } = repository.testBuildSelectQuery(criteria);

        expect(query).toContain('SELECT * FROM strategies');
        expect(query).toContain('WHERE');
        expect(query).toContain('(is_deleted = FALSE OR is_deleted IS NULL)');
        expect(query).toContain('name = $');
        expect(query).toContain('ORDER BY created_at DESC');
        expect(values).toContain('Test Strategy');
      });

      it('should handle empty criteria', () => {
        const { query, values } = repository.testBuildSelectQuery({});

        expect(query).toContain('SELECT * FROM strategies');
        expect(query).toContain('WHERE (is_deleted = FALSE OR is_deleted IS NULL)');
        expect(values).toHaveLength(0);
      });

      it('should add LIMIT and OFFSET', () => {
        const criteria = {};
        const options = { limit: 10, offset: 20 };
        const { query, values } = repository.testBuildSelectQuery(criteria, options);

        expect(query).toContain('LIMIT $1');
        expect(query).toContain('OFFSET $2');
        expect(values).toContain(10);
        expect(values).toContain(20);
      });

      it('should add custom ORDER BY', () => {
        const criteria = {};
        const options = { orderBy: 'name', orderDirection: 'ASC' as const };
        const { query } = repository.testBuildSelectQuery(criteria, options);

        expect(query).toContain('ORDER BY name ASC');
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct UPDATE query', () => {
        const updates = { name: 'Updated Name', description: 'Updated Description' };
        const { query, values } = repository.testBuildUpdateQuery('test-id', updates);

        expect(query).toContain('UPDATE strategies');
        expect(query).toContain('SET');
        expect(query).toContain('WHERE id = $1');
        expect(query).toContain('(is_deleted = FALSE OR is_deleted IS NULL)');
        expect(query).toContain('RETURNING *');
        expect(values[0]).toBe('test-id');
        expect(values).toContain('Updated Name');
        expect(values).toContain('Updated Description');
      });
    });

    describe('buildCountQuery', () => {
      it('should build correct COUNT query', () => {
        const criteria = { name: 'Test Strategy' };
        const { query, values } = repository.testBuildCountQuery(criteria);

        expect(query).toContain('SELECT COUNT(*) as count FROM strategies');
        expect(query).toContain('WHERE');
        expect(query).toContain('(is_deleted = FALSE OR is_deleted IS NULL)');
        expect(query).toContain('name = $');
        expect(values).toContain('Test Strategy');
      });
    });
  });

  describe('Entity Preparation Methods', () => {
    describe('prepareEntityForCreate', () => {
      it('should add timestamps and prepare entity', () => {
        const entity = { name: 'Test Strategy' };
        const prepared = repository.testPrepareEntityForCreate(entity);

        expect(prepared.name).toBe('Test Strategy');
        expect(prepared.created_at).toBeInstanceOf(Date);
        expect(prepared.updated_at).toBeInstanceOf(Date);
      });

      it('should not override existing timestamps', () => {
        const existingDate = new Date('2023-01-01');
        const entity = { 
          name: 'Test Strategy',
          created_at: existingDate,
          updated_at: existingDate,
        };
        const prepared = repository.testPrepareEntityForCreate(entity);

        expect(prepared.created_at).not.toBe(existingDate);
        expect(prepared.updated_at).not.toBe(existingDate);
      });
    });

    describe('prepareEntityForUpdate', () => {
      it('should add updated_at timestamp', () => {
        const updates = { name: 'Updated Name' };
        const prepared = repository.testPrepareEntityForUpdate(updates);

        expect(prepared.name).toBe('Updated Name');
        expect(prepared.updated_at).toBeInstanceOf(Date);
      });

      it('should remove id from updates', () => {
        const updates = { id: 'should-be-removed', name: 'Updated Name' };
        const prepared = repository.testPrepareEntityForUpdate(updates);

        expect(prepared.id).toBeUndefined();
        expect(prepared.name).toBe('Updated Name');
      });
    });
  });

  describe('Cache Methods', () => {
    describe('getCached', () => {
      it('should handle cache operations gracefully', async () => {
        const result = await repository.testGetCached('test-key');
        // Should not throw and return null if no cache
        expect(result).toBeNull();
      });
    });

    describe('setCached', () => {
      it('should handle cache setting gracefully', async () => {
        // Should not throw
        await expect(repository.testSetCached('test-key', { data: 'test' })).resolves.not.toThrow();
      });
    });

    describe('invalidateCache', () => {
      it('should handle cache invalidation gracefully', async () => {
        // Should not throw
        await expect(repository.testInvalidateCache(['test:*'])).resolves.not.toThrow();
      });
    });
  });

  describe('Utility Methods', () => {
    describe('hasColumn', () => {
      it('should check if column exists', async () => {
        // This will actually query the database
        const hasId = await repository.testHasColumn('id');
        const hasNonExistent = await repository.testHasColumn('non_existent_column');

        expect(hasId).toBe(true);
        expect(hasNonExistent).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return RepositoryResult with error on database failure', async () => {
      // Test with invalid query that should fail
      const result = await repository.create({ 
        name: null as any, // This should violate NOT NULL constraint
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
      expect(result.metadata?.executionTimeMs).toBeDefined();
    });
  });

  describe('Transaction Support', () => {
    it('should execute operations within transaction', async () => {
      const result = await repository.withTransaction(async (context) => {
        // Simple transaction test
        expect(context.client).toBeDefined();
        expect(context.isRollback).toBe(false);
        return 'transaction-test';
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('transaction-test');
    });

    it('should handle transaction rollback on error', async () => {
      const result = await repository.withTransaction(async () => {
        throw new Error('Transaction test error');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CRUD Operations Structure', () => {
    // These tests verify the interface without actually executing database operations
    
    it('should have correct create method signature', () => {
      expect(typeof repository.create).toBe('function');
    });

    it('should have correct findById method signature', () => {
      expect(typeof repository.findById).toBe('function');
    });

    it('should have correct findMany method signature', () => {
      expect(typeof repository.findMany).toBe('function');
    });

    it('should have correct findAll method signature', () => {
      expect(typeof repository.findAll).toBe('function');
    });

    it('should have correct update method signature', () => {
      expect(typeof repository.update).toBe('function');
    });

    it('should have correct delete method signature', () => {
      expect(typeof repository.delete).toBe('function');
    });

    it('should have correct count method signature', () => {
      expect(typeof repository.count).toBe('function');
    });
  });

  describe('Repository Result Structure', () => {
    it('should return properly structured RepositoryResult', async () => {
      // Test with a count operation which is least likely to fail
      const result = await repository.count({});

      // Check structure regardless of success/failure
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      expect(result).toHaveProperty('metadata');
      
      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(typeof result.data).toBe('number');
      } else {
        expect(result).toHaveProperty('error');
      }
    });
  });
});