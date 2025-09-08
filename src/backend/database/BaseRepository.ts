/**
 * Base Repository Implementation for Algorithmic Trading Bot
 * Task BE-002: Base Repository Implementation  
 * 
 * Production-ready abstract repository pattern with generic CRUD operations,
 * transaction support, error handling, and Redis caching integration.
 */

import { DatabaseManager, QueryResult, CacheOptions, TransactionCallback } from './DatabaseManager';

export interface RepositoryOptions {
  enableCaching?: boolean;
  defaultCacheTTL?: number;
  tableName: string;
  primaryKeyField?: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  cache?: CacheOptions;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BulkOperationResult {
  success: boolean;
  affectedRows: number;
  insertedIds?: string[];
  errors?: Error[];
}

export class RepositoryError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, any>;

  constructor(message: string, code = 'REPOSITORY_ERROR', statusCode = 500, context?: Record<string, any>) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

/**
 * Abstract base repository class providing generic database operations
 */
export abstract class BaseRepository<T extends Record<string, any>> {
  protected readonly db: DatabaseManager;
  protected readonly options: RepositoryOptions;
  protected readonly primaryKey: string;

  constructor(options: RepositoryOptions) {
    this.db = DatabaseManager.getInstance();
    this.options = {
      enableCaching: true,
      defaultCacheTTL: 300, // 5 minutes
      primaryKeyField: 'id',
      ...options,
    };
    this.primaryKey = this.options.primaryKeyField!;
  }

  /**
   * Find a single record by primary key
   */
  public async findById(id: string | number, queryOptions?: QueryOptions): Promise<T | null> {
    try {
      const cacheKey = this.buildCacheKey('findById', id);
      const cacheOptions = queryOptions?.cache || (this.options.enableCaching ? {
        key: cacheKey,
        ttl: this.options.defaultCacheTTL,
      } : undefined);

      const query = `SELECT * FROM ${this.options.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`;
      const result = await this.db.query<T>(query, [id], cacheOptions);

      return result.rows[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findById', { id, queryOptions });
    }
  }

  /**
   * Find records by specified criteria
   */
  public async findBy(
    criteria: Partial<T>,
    queryOptions?: QueryOptions
  ): Promise<T[]> {
    try {
      const { whereClause, values } = this.buildWhereClause(criteria);
      const { orderClause, limitClause } = this.buildQueryModifiers(queryOptions);
      
      const query = `SELECT * FROM ${this.options.tableName} ${whereClause} ${orderClause} ${limitClause}`;
      
      const cacheKey = this.buildCacheKey('findBy', { criteria, queryOptions });
      const cacheOptions = queryOptions?.cache || (this.options.enableCaching ? {
        key: cacheKey,
        ttl: this.options.defaultCacheTTL,
      } : undefined);

      const result = await this.db.query<T>(query, values, cacheOptions);
      return result.rows;
    } catch (error) {
      throw this.handleError(error, 'findBy', { criteria, queryOptions });
    }
  }

  /**
   * Find a single record by criteria
   */
  public async findOneBy(criteria: Partial<T>, queryOptions?: QueryOptions): Promise<T | null> {
    const results = await this.findBy(criteria, { ...queryOptions, limit: 1 });
    return results[0] || null;
  }

  /**
   * Get all records with optional pagination
   */
  public async findAll(queryOptions?: QueryOptions): Promise<T[]> {
    try {
      const { orderClause, limitClause } = this.buildQueryModifiers(queryOptions);
      const query = `SELECT * FROM ${this.options.tableName} ${orderClause} ${limitClause}`;
      
      const cacheKey = this.buildCacheKey('findAll', queryOptions);
      const cacheOptions = queryOptions?.cache || (this.options.enableCaching ? {
        key: cacheKey,
        ttl: this.options.defaultCacheTTL,
      } : undefined);

      const result = await this.db.query<T>(query, [], cacheOptions);
      return result.rows;
    } catch (error) {
      throw this.handleError(error, 'findAll', { queryOptions });
    }
  }

  /**
   * Get paginated results
   */
  public async findPaginated(
    criteria: Partial<T> = {},
    page = 1,
    pageSize = 20,
    queryOptions?: Omit<QueryOptions, 'limit' | 'offset'>
  ): Promise<PaginationResult<T>> {
    try {
      const offset = (page - 1) * pageSize;
      const { whereClause, values } = this.buildWhereClause(criteria);
      const { orderClause } = this.buildQueryModifiers(queryOptions);

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM ${this.options.tableName} ${whereClause}`;
      const countResult = await this.db.query<{ total: number }>(countQuery, values);
      const total = Number(countResult.rows[0]?.total || 0);

      // Get paginated data
      const dataQuery = `SELECT * FROM ${this.options.tableName} ${whereClause} ${orderClause} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      const dataResult = await this.db.query<T>(dataQuery, [...values, pageSize, offset]);

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
    } catch (error) {
      throw this.handleError(error, 'findPaginated', { criteria, page, pageSize, queryOptions });
    }
  }

  /**
   * Create a new record
   */
  public async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    try {
      const { fields, placeholders, values } = this.buildInsertQuery(data);
      const query = `
        INSERT INTO ${this.options.tableName} (${fields})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.db.query<T>(query, values);
      
      if (result.rows.length === 0) {
        throw new RepositoryError('Failed to create record', 'CREATE_FAILED');
      }

      const createdRecord = result.rows[0];
      
      // Invalidate related cache entries
      if (this.options.enableCaching) {
        await this.invalidateCache('create', createdRecord);
      }

      return createdRecord;
    } catch (error) {
      throw this.handleError(error, 'create', { data });
    }
  }

  /**
   * Create multiple records in a single transaction
   */
  public async createMany(records: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<BulkOperationResult> {
    if (records.length === 0) {
      return { success: true, affectedRows: 0, insertedIds: [] };
    }

    try {
      return await this.db.transaction<BulkOperationResult>(async (client) => {
        const insertedIds: string[] = [];
        const errors: Error[] = [];

        for (const record of records) {
          try {
            const { fields, placeholders, values } = this.buildInsertQuery(record);
            const query = `
              INSERT INTO ${this.options.tableName} (${fields})
              VALUES (${placeholders})
              RETURNING ${this.primaryKey}
            `;

            const result = await client.query<{ [key: string]: any }>(query, values);
            if (result.rows[0]) {
              insertedIds.push(result.rows[0][this.primaryKey]);
            }
          } catch (error) {
            errors.push(error instanceof Error ? error : new Error(String(error)));
          }
        }

        // Invalidate cache
        if (this.options.enableCaching) {
          await this.invalidateCache('createMany');
        }

        return {
          success: errors.length === 0,
          affectedRows: insertedIds.length,
          insertedIds,
          errors: errors.length > 0 ? errors : undefined,
        };
      });
    } catch (error) {
      throw this.handleError(error, 'createMany', { recordCount: records.length });
    }
  }

  /**
   * Update a record by primary key
   */
  public async updateById(
    id: string | number,
    data: Partial<Omit<T, 'id' | 'created_at'>>
  ): Promise<T | null> {
    try {
      // Add updated_at timestamp if the field exists
      const updateData = {
        ...data,
        ...(this.hasField('updated_at') ? { updated_at: new Date() } : {}),
      };

      const { setClause, values } = this.buildUpdateQuery(updateData);
      const query = `
        UPDATE ${this.options.tableName} 
        SET ${setClause}
        WHERE ${this.primaryKey} = $${values.length + 1}
        RETURNING *
      `;

      const result = await this.db.query<T>(query, [...values, id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const updatedRecord = result.rows[0];

      // Invalidate related cache entries
      if (this.options.enableCaching) {
        await this.invalidateCache('update', updatedRecord);
      }

      return updatedRecord;
    } catch (error) {
      throw this.handleError(error, 'updateById', { id, data });
    }
  }

  /**
   * Update records by criteria
   */
  public async updateBy(
    criteria: Partial<T>,
    data: Partial<Omit<T, 'id' | 'created_at'>>
  ): Promise<T[]> {
    try {
      const { whereClause, values: whereValues } = this.buildWhereClause(criteria);
      
      // Add updated_at timestamp if the field exists
      const updateData = {
        ...data,
        ...(this.hasField('updated_at') ? { updated_at: new Date() } : {}),
      };

      const { setClause, values: setValues } = this.buildUpdateQuery(updateData);
      const query = `
        UPDATE ${this.options.tableName} 
        SET ${setClause}
        ${whereClause}
        RETURNING *
      `;

      const result = await this.db.query<T>(query, [...setValues, ...whereValues]);

      // Invalidate cache
      if (this.options.enableCaching) {
        await this.invalidateCache('updateBy');
      }

      return result.rows;
    } catch (error) {
      throw this.handleError(error, 'updateBy', { criteria, data });
    }
  }

  /**
   * Delete a record by primary key
   */
  public async deleteById(id: string | number): Promise<boolean> {
    try {
      const query = `DELETE FROM ${this.options.tableName} WHERE ${this.primaryKey} = $1`;
      const result = await this.db.query(query, [id]);

      const deleted = (result.rowCount || 0) > 0;

      // Invalidate cache
      if (this.options.enableCaching && deleted) {
        await this.invalidateCache('delete', { [this.primaryKey]: id } as Partial<T>);
      }

      return deleted;
    } catch (error) {
      throw this.handleError(error, 'deleteById', { id });
    }
  }

  /**
   * Delete records by criteria
   */
  public async deleteBy(criteria: Partial<T>): Promise<number> {
    try {
      const { whereClause, values } = this.buildWhereClause(criteria);
      const query = `DELETE FROM ${this.options.tableName} ${whereClause}`;
      
      const result = await this.db.query(query, values);
      const deletedCount = result.rowCount || 0;

      // Invalidate cache
      if (this.options.enableCaching && deletedCount > 0) {
        await this.invalidateCache('deleteBy');
      }

      return deletedCount;
    } catch (error) {
      throw this.handleError(error, 'deleteBy', { criteria });
    }
  }

  /**
   * Check if a record exists by primary key
   */
  public async existsById(id: string | number): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM ${this.options.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`;
      const result = await this.db.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      throw this.handleError(error, 'existsById', { id });
    }
  }

  /**
   * Get record count by criteria
   */
  public async count(criteria: Partial<T> = {}): Promise<number> {
    try {
      const { whereClause, values } = this.buildWhereClause(criteria);
      const query = `SELECT COUNT(*) as count FROM ${this.options.tableName} ${whereClause}`;
      
      const cacheKey = this.buildCacheKey('count', criteria);
      const cacheOptions = this.options.enableCaching ? {
        key: cacheKey,
        ttl: this.options.defaultCacheTTL,
      } : undefined;

      const result = await this.db.query<{ count: number }>(query, values, cacheOptions);
      return Number(result.rows[0]?.count || 0);
    } catch (error) {
      throw this.handleError(error, 'count', { criteria });
    }
  }

  /**
   * Execute a transaction with multiple operations
   */
  public async transaction<R>(callback: TransactionCallback<R>): Promise<R> {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      throw this.handleError(error, 'transaction');
    }
  }

  /**
   * Execute a raw query with optional caching
   */
  protected async query<R = any>(
    text: string,
    params?: any[],
    cacheOptions?: CacheOptions
  ): Promise<QueryResult<R>> {
    try {
      return await this.db.query<R>(text, params, cacheOptions);
    } catch (error) {
      throw this.handleError(error, 'query', { text, params });
    }
  }

  /**
   * Build WHERE clause from criteria object
   */
  protected buildWhereClause(criteria: Partial<T>): { whereClause: string; values: any[] } {
    const keys = Object.keys(criteria);
    
    if (keys.length === 0) {
      return { whereClause: '', values: [] };
    }

    const conditions: string[] = [];
    const values: any[] = [];

    keys.forEach((key, index) => {
      const value = criteria[key];
      const paramIndex = index + 1;

      if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        conditions.push(`${key} = ANY($${paramIndex})`);
        values.push(value);
      } else {
        conditions.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
    });

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      values,
    };
  }

  /**
   * Build INSERT query components
   */
  protected buildInsertQuery(data: Record<string, any>): {
    fields: string;
    placeholders: string;
    values: any[];
  } {
    const keys = Object.keys(data);
    const fields = keys.join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const values = keys.map(key => data[key]);

    return { fields, placeholders, values };
  }

  /**
   * Build UPDATE query SET clause
   */
  protected buildUpdateQuery(data: Record<string, any>): {
    setClause: string;
    values: any[];
  } {
    const keys = Object.keys(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = keys.map(key => data[key]);

    return { setClause, values };
  }

  /**
   * Build query modifiers (ORDER BY, LIMIT, OFFSET)
   */
  protected buildQueryModifiers(options?: QueryOptions): {
    orderClause: string;
    limitClause: string;
  } {
    let orderClause = '';
    let limitClause = '';

    if (options?.orderBy) {
      const direction = options.orderDirection || 'ASC';
      orderClause = `ORDER BY ${options.orderBy} ${direction}`;
    }

    if (options?.limit) {
      limitClause = `LIMIT ${options.limit}`;
      if (options.offset) {
        limitClause += ` OFFSET ${options.offset}`;
      }
    }

    return { orderClause, limitClause };
  }

  /**
   * Build cache key for operations
   */
  protected buildCacheKey(operation: string, params?: any): string {
    const baseKey = `${this.options.tableName}:${operation}`;
    if (!params) {
      return baseKey;
    }

    const paramString = typeof params === 'object' 
      ? JSON.stringify(params) 
      : String(params);
    
    return `${baseKey}:${Buffer.from(paramString).toString('base64')}`;
  }

  /**
   * Invalidate cache entries related to this repository
   */
  protected async invalidateCache(operation: string, record?: Partial<T>): Promise<void> {
    try {
      // Invalidate general patterns
      await this.db.clearCache(`${this.options.tableName}:findAll*`);
      await this.db.clearCache(`${this.options.tableName}:findBy*`);
      await this.db.clearCache(`${this.options.tableName}:count*`);

      // Invalidate specific record cache if available
      if (record && record[this.primaryKey]) {
        await this.db.clearCache(`${this.options.tableName}:findById:${record[this.primaryKey]}`);
      }
    } catch (error) {
      // Cache invalidation errors should not break the operation
      console.warn(`[${this.options.tableName}Repository] Cache invalidation failed:`, error);
    }
  }

  /**
   * Check if the table has a specific field
   */
  protected hasField(fieldName: string): boolean {
    // This is a basic implementation - could be enhanced with schema introspection
    const commonTimestampFields = ['created_at', 'updated_at', 'time'];
    return commonTimestampFields.includes(fieldName);
  }

  /**
   * Handle errors with consistent formatting and logging
   */
  protected handleError(error: any, operation: string, context?: Record<string, any>): RepositoryError {
    const message = error instanceof Error ? error.message : String(error);
    
    console.error(`[${this.options.tableName}Repository] ${operation} failed:`, {
      error: message,
      context,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Convert known database errors to repository errors
    if (error.code) {
      switch (error.code) {
        case '23505': // unique_violation
          return new RepositoryError('Record already exists', 'DUPLICATE_RECORD', 409, context);
        case '23503': // foreign_key_violation
          return new RepositoryError('Foreign key constraint violation', 'FOREIGN_KEY_VIOLATION', 409, context);
        case '23502': // not_null_violation
          return new RepositoryError('Required field is missing', 'REQUIRED_FIELD_MISSING', 400, context);
        case '42P01': // undefined_table
          return new RepositoryError('Table does not exist', 'TABLE_NOT_FOUND', 500, context);
        case '42703': // undefined_column
          return new RepositoryError('Column does not exist', 'COLUMN_NOT_FOUND', 500, context);
        default:
          return new RepositoryError(`Database error: ${message}`, 'DATABASE_ERROR', 500, context);
      }
    }

    if (error instanceof RepositoryError) {
      return error;
    }

    return new RepositoryError(
      `Repository operation failed: ${message}`,
      'REPOSITORY_ERROR',
      500,
      context
    );
  }

  /**
   * Get repository health status
   */
  public async getHealthStatus(): Promise<{
    table: string;
    accessible: boolean;
    recordCount?: number;
    lastError?: string;
  }> {
    try {
      const result = await this.db.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${this.options.tableName} LIMIT 1`);
      return {
        table: this.options.tableName,
        accessible: true,
        recordCount: Number(result.rows[0]?.count || 0),
      };
    } catch (error) {
      return {
        table: this.options.tableName,
        accessible: false,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export default BaseRepository;