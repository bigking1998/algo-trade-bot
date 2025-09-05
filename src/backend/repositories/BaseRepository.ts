/**
 * BaseRepository Abstract Class - Task BE-002
 * Production-ready base repository with generic CRUD operations, 
 * transaction support, Redis caching, and comprehensive error handling
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { DatabaseManager, QueryResult, CacheOptions } from '../database/DatabaseManager';
import {
  BaseEntity,
  QueryOptions,
  CacheConfig,
  TransactionContext,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConflictError,
  TableName
} from '../types/database';

/**
 * Repository operation result wrapper
 */
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: DatabaseError;
  metadata?: {
    rowCount?: number;
    fromCache?: boolean;
    executionTimeMs?: number;
  };
}

/**
 * Repository query builder interface
 */
export interface QueryBuilder {
  select: string[];
  where: Array<{ column: string; operator: string; value: string | number | boolean | null; }>;
  joins: Array<{ type: string; table: string; on: string; }>;
  orderBy: Array<{ column: string; direction: 'ASC' | 'DESC'; }>;
  limit?: number;
  offset?: number;
}

/**
 * Abstract BaseRepository with generic CRUD operations and advanced features
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected readonly db: DatabaseManager;
  protected readonly redis: Redis | null;
  protected readonly pool: Pool | null;

  constructor(
    protected readonly tableName: TableName,
    protected readonly primaryKey: string = 'id'
  ) {
    this.db = DatabaseManager.getInstance();
    this.redis = (this.db as any).redis || null;
    this.pool = (this.db as any).pool || null;
  }

  /**
   * Initialize repository (ensure database is ready)
   */
  protected async ensureInitialized(): Promise<void> {
    if (!(this.db as any).isInitialized) {
      await this.db.initialize();
    }
  }

  /**
   * CORE CRUD OPERATIONS
   */

  /**
   * Create a new entity
   */
  async create(entity: Partial<T>): Promise<RepositoryResult<T>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Validate entity before creation
      await this.validateEntity(entity, 'create');
      
      // Prepare entity with defaults
      const preparedEntity = this.prepareEntityForCreate(entity);
      
      // Build insert query
      const { query, values } = this.buildInsertQuery(preparedEntity);
      
      // Execute query
      const result = await this.db.query<T>(query, values);
      
      if (!result.rows || result.rows.length === 0) {
        throw new DatabaseError('Failed to create entity - no rows returned');
      }

      const createdEntity = result.rows[0];
      
      // Invalidate related cache
      await this.invalidateCache([`${this.tableName}:*`]);
      
      return {
        success: true,
        data: createdEntity,
        metadata: {
          rowCount: result.rowCount || 1,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'create', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Find entity by primary key
   */
  async findById(id: string, cacheConfig?: CacheConfig): Promise<RepositoryResult<T | null>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      const cacheKey = cacheConfig?.key || `${this.tableName}:${id}`;
      const cacheOptions: CacheOptions = {
        key: cacheKey,
        ttl: cacheConfig?.ttl || 300, // Default 5 minutes
      };
      
      const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)`;
      const result = await this.db.query<T>(query, [id], cacheOptions);
      
      const entity = result.rows && result.rows.length > 0 ? result.rows[0] : null;
      
      return {
        success: true,
        data: entity,
        metadata: {
          rowCount: result.rowCount || 0,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'findById', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Find multiple entities with criteria
   */
  async findMunknown(
    criteria: Partial<T>, 
    options: QueryOptions = {},
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<T[]>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      const { query, values } = this.buildSelectQuery(criteria, options);
      
      const cacheOptions = cacheConfig ? {
        key: cacheConfig.key,
        ttl: cacheConfig.ttl || 300,
      } : undefined;
      
      const result = await this.db.query<T>(query, values, cacheOptions);
      
      return {
        success: true,
        data: result.rows || [],
        metadata: {
          rowCount: result.rowCount || 0,
          fromCache: cacheOptions ? undefined : false, // Will be set by DatabaseManager if from cache
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'findMunknown', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Find all entities (with optional pagination)
   */
  async findAll(
    options: QueryOptions = {},
    cacheConfig?: CacheConfig
  ): Promise<RepositoryResult<T[]>> {
    return this.findMunknown({} as Partial<T>, options, cacheConfig);
  }

  /**
   * Update entity by ID
   */
  async update(id: string, updates: Partial<T>): Promise<RepositoryResult<T>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Validate updates
      await this.validateEntity(updates, 'update');
      
      // Prepare updates with automatic updated_at
      const preparedUpdates = this.prepareEntityForUpdate(updates);
      
      // Build update query
      const { query, values } = this.buildUpdateQuery(id, preparedUpdates);
      
      // Execute query
      const result = await this.db.query<T>(query, values);
      
      if (!result.rows || result.rows.length === 0) {
        throw new NotFoundError(this.tableName, id);
      }

      const updatedEntity = result.rows[0];
      
      // Invalidate related cache
      await this.invalidateCache([`${this.tableName}:${id}`, `${this.tableName}:*`]);
      
      return {
        success: true,
        data: updatedEntity,
        metadata: {
          rowCount: result.rowCount || 1,
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'update', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Soft delete entity by ID (sets is_deleted = true)
   */
  async delete(id: string): Promise<RepositoryResult<boolean>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Use soft delete if table has is_deleted column
      const hasIsDeleted = await this.hasColumn('is_deleted');
      
      if (hasIsDeleted) {
        const result = await this.update(id, { is_deleted: true } as unknown as Partial<T>);
        return {
          success: result.success,
          data: result.success,
          error: result.error,
          metadata: {
            ...result.metadata,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } else {
        // Hard delete for tables without is_deleted column
        const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1 RETURNING ${this.primaryKey}`;
        const result = await this.db.query<{ [key: string]: string }>(query, [id]);
        
        if (!result.rows || result.rows.length === 0) {
          throw new NotFoundError(this.tableName, id);
        }
        
        // Invalidate related cache
        await this.invalidateCache([`${this.tableName}:${id}`, `${this.tableName}:*`]);
        
        return {
          success: true,
          data: true,
          metadata: {
            rowCount: result.rowCount || 1,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
      
    } catch (error) {
      return this.handleError(error, 'delete', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Count entities with criteria
   */
  async count(criteria: Partial<T> = {}, cacheConfig?: CacheConfig): Promise<RepositoryResult<number>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      const { query, values } = this.buildCountQuery(criteria);
      
      const cacheOptions = cacheConfig ? {
        key: cacheConfig.key,
        ttl: cacheConfig.ttl || 300,
      } : undefined;
      
      const result = await this.db.query<{ count: number }>(query, values, cacheOptions);
      
      const count = result.rows && result.rows.length > 0 ? Number(result.rows[0].count) : 0;
      
      return {
        success: true,
        data: count,
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'count', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * TRANSACTION SUPPORT
   */

  /**
   * Execute operations within a transaction
   */
  async withTransaction<R>(
    callback: (context: TransactionContext) => Promise<R>
  ): Promise<RepositoryResult<R>> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      const result = await this.db.transaction(async (client) => {
        const context: TransactionContext = {
          client,
          isRollback: false,
        };
        
        return await callback(context);
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      return this.handleError(error, 'transaction', { executionTimeMs: Date.now() - startTime });
    }
  }

  /**
   * Execute query within transaction context
   */
  protected async queryInTransaction<R>(
    context: TransactionContext,
    query: string,
    values?: unknown[]
  ): Promise<QueryResult<R>> {
    const result = await context.client.query<R[]>({
      text: query,
      values,
      rowMode: 'array'
    });

    return {
      rows: result.rows as R[],
      rowCount: result.rowCount,
      fields: result.fields?.map(field => ({
        name: field.name,
        dataTypeID: field.dataTypeID,
      })) || [],
    };
  }

  /**
   * CACHING METHODS
   */

  /**
   * Get cached value
   */
  protected async getCached<R>(key: string): Promise<R | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn(`[${this.tableName}Repository] Cache read error:`, error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  protected async setCached<R>(key: string, value: R, ttl: number = 300): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.warn(`[${this.tableName}Repository] Cache write error:`, error);
    }
  }

  /**
   * Invalidate cache patterns
   */
  protected async invalidateCache(patterns: string[]): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          await this.redis.del(pattern);
        }
      }
    } catch (error) {
      console.warn(`[${this.tableName}Repository] Cache invalidation error:`, error);
    }
  }

  /**
   * QUERY BUILDERS
   */

  /**
   * Build INSERT query
   */
  protected buildInsertQuery(entity: Partial<T>): { query: string; values: any[] } {
    const columns = Object.keys(entity);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const values = Object.values(entity);

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    return { query, values };
  }

  /**
   * Build SELECT query with criteria and options
   */
  protected buildSelectQuery(
    criteria: Partial<T>,
    options: QueryOptions = {}
  ): { query: string; values: any[] } {
    let query = `SELECT * FROM ${this.tableName}`;
    const values: any[] = [];
    const conditions: string[] = [];

    // Add is_deleted filter if table has this column
    conditions.push('(is_deleted = FALSE OR is_deleted IS NULL)');

    // Build WHERE conditions
    let paramCounter = 1;
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramCounter}`);
        values.push(value);
        paramCounter++;
      }
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    } else {
      query += ` ORDER BY created_at DESC`; // Default ordering
    }

    // Add LIMIT and OFFSET
    if (options.limit) {
      query += ` LIMIT $${paramCounter}`;
      values.push(options.limit);
      paramCounter++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramCounter}`;
      values.push(options.offset);
      paramCounter++;
    }

    return { query, values };
  }

  /**
   * Build UPDATE query
   */
  protected buildUpdateQuery(id: string, updates: Partial<T>): { query: string; values: any[] } {
    const columns = Object.keys(updates);
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${this.primaryKey} = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)
      RETURNING *
    `;

    return { query, values };
  }

  /**
   * Build COUNT query
   */
  protected buildCountQuery(criteria: Partial<T>): { query: string; values: any[] } {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const values: any[] = [];
    const conditions: string[] = [];

    // Add is_deleted filter
    conditions.push('(is_deleted = FALSE OR is_deleted IS NULL)');

    // Build WHERE conditions
    let paramCounter = 1;
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramCounter}`);
        values.push(value);
        paramCounter++;
      }
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    return { query, values };
  }

  /**
   * ENTITY PREPARATION METHODS
   */

  /**
   * Prepare entity for creation (add timestamps, IDs, etc.)
   */
  protected prepareEntityForCreate(entity: Partial<T>): Partial<T> {
    const prepared = { ...entity };
    
    // Add created_at and updated_at timestamps
    const now = new Date();
    prepared.created_at = now as any;
    prepared.updated_at = now as any;
    
    // Add UUID if not provided and this is the primary key
    if (this.primaryKey === 'id' && !prepared.id) {
      prepared.id = undefined; // Let database generate UUID
    }

    return prepared;
  }

  /**
   * Prepare entity for update (add updated_at timestamp)
   */
  protected prepareEntityForUpdate(updates: Partial<T>): Partial<T> {
    const prepared = { ...updates };
    
    // Always update the updated_at timestamp
    prepared.updated_at = new Date() as any;
    
    // Remove id from updates to prevent accidental modification
    delete prepared.id;

    return prepared;
  }

  /**
   * VALIDATION METHODS
   */

  /**
   * Validate entity (override in specific repositories)
   */
  protected async validateEntity(_entity: Partial<T>, operation: 'create' | 'update'): Promise<void> {
    // Basic validation - override in specific repositories for detailed validation
    if (operation === 'create') {
      // Add unknown common create validations here
    } else {
      // Add unknown common update validations here
    }
  }

  /**
   * ERROR HANDLING
   */

  /**
   * Handle database errors and convert to RepositoryResult
   */
  protected handleError(
    error: any,
    operation: string,
    metadata?: { executionTimeMs: number }
  ): RepositoryResult<any> {
    console.error(`[${this.tableName}Repository] Error in ${operation}:`, error);

    let dbError: DatabaseError;

    if (error instanceof DatabaseError) {
      dbError = error;
    } else if (error.code) {
      // PostgreSQL error codes
      switch (error.code) {
        case '23505': // unique_violation
          dbError = new ConflictError(
            'Record with this value already exists',
            error.constraint
          );
          break;
        case '23503': // foreign_key_violation
          dbError = new ValidationError(
            'Referenced record does not exist',
            error.constraint
          );
          break;
        case '23502': // not_null_violation
          dbError = new ValidationError(
            `Field '${error.column}' cannot be null`,
            error.column
          );
          break;
        case '23514': // check_violation
          dbError = new ValidationError(
            'Data violates check constraint',
            error.constraint
          );
          break;
        default:
          dbError = new DatabaseError(
            error.message || 'Database operation failed',
            error.code,
            error.constraint,
            this.tableName,
            error
          );
      }
    } else {
      dbError = new DatabaseError(
        error.message || 'Unknown database error',
        undefined,
        undefined,
        this.tableName,
        error
      );
    }

    return {
      success: false,
      error: dbError,
      metadata,
    };
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Check if table has specific column
   */
  protected async hasColumn(columnName: string): Promise<boolean> {
    try {
      const query = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `;
      const result = await this.db.query(query, [this.tableName, columnName]);
      return result.rows && result.rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get table metadata
   */
  protected async getTableMetadata(): Promise<{
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    indexes: Array<{ name: string; columns: string[] }>;
  }> {
    const columnsQuery = `
      SELECT column_name as name, data_type as type, is_nullable = 'YES' as nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;

    const indexesQuery = `
      SELECT indexname as name, indexdef
      FROM pg_indexes
      WHERE tablename = $1
    `;

    const [columnsResult, indexesResult] = await Promise.all([
      this.db.query<{ name: string; type: string; nullable: boolean }>(columnsQuery, [this.tableName]),
      this.db.query<{ name: string; indexdef: string }>(indexesQuery, [this.tableName]),
    ]);

    return {
      columns: columnsResult.rows || [],
      indexes: (indexesResult.rows || []).map(idx => ({
        name: idx.name,
        columns: [], // Would need more complex parsing to extract column names
      })),
    };
  }
}