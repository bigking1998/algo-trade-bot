#!/usr/bin/env tsx
/**
 * Setup Database Health Check Function
 * Task BE-001: Database Connection Manager
 * 
 * This script adds the missing check_database_health function to the database
 * and tests the DatabaseManager functionality.
 */

import { getDatabaseManager } from '../src/backend/database/DatabaseManager';
import { Pool } from 'pg';

const healthCheckFunction = `
-- Function for comprehensive database health check
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(
    component TEXT,
    status TEXT,
    details JSONB,
    response_time_ms NUMERIC
) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    db_size TEXT;
    ts_version TEXT;
    active_connections INTEGER;
    table_count INTEGER;
    hypertable_count INTEGER;
BEGIN
    start_time := clock_timestamp();

    -- Check database size
    SELECT pg_size_pretty(pg_database_size(current_database())) INTO db_size;
    
    -- Check TimescaleDB version
    SELECT extversion INTO ts_version 
    FROM pg_extension 
    WHERE extname = 'timescaledb';
    
    -- Check active connections
    SELECT count(*) INTO active_connections 
    FROM pg_stat_activity 
    WHERE datname = current_database();
    
    -- Check table count
    SELECT count(*) INTO table_count 
    FROM pg_tables 
    WHERE schemaname = 'public';
    
    -- Check hypertable count
    SELECT count(*) INTO hypertable_count 
    FROM timescaledb_information.hypertables;
    
    end_time := clock_timestamp();
    
    -- Return database health status
    RETURN QUERY SELECT 
        'database_core'::TEXT,
        'healthy'::TEXT,
        jsonb_build_object(
            'database_size', db_size,
            'timescaledb_version', COALESCE(ts_version, 'not_installed'),
            'active_connections', active_connections,
            'table_count', table_count,
            'hypertable_count', hypertable_count,
            'timestamp', NOW()
        ),
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
END;
$$ LANGUAGE plpgsql;
`;

async function setupDatabaseHealth() {
  console.log('🔧 Setting up database health check function...');
  
  let dbManager = null;
  
  try {
    // Get database manager and initialize
    dbManager = getDatabaseManager({
      enableRedis: true,
      enableHealthMonitoring: true,
      healthCheckInterval: 30000,
    });
    
    console.log('🔄 Initializing database connection...');
    await dbManager.initialize();
    
    // Add health check function
    console.log('🔄 Creating health check function...');
    await dbManager.query(healthCheckFunction);
    console.log('✅ Health check function created successfully');
    
    // Test the function
    console.log('🔄 Testing health check function...');
    const result = await dbManager.query('SELECT * FROM check_database_health()');
    console.log('✅ Health check function test results:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Test connection pool status
    console.log('🔄 Testing connection pool status...');
    const poolStatus = dbManager.getPoolStatus();
    console.log('✅ Pool status:', poolStatus);
    
    // Test health monitoring
    console.log('🔄 Testing health monitoring...');
    const healthStatus = await dbManager.getHealthStatus();
    console.log('✅ Health monitoring results:');
    console.log(JSON.stringify(healthStatus, null, 2));
    
    // Test caching functionality
    console.log('🔄 Testing Redis caching...');
    const testQuery = 'SELECT version() as db_version, NOW() as current_time';
    
    // First query (should hit database)
    const start1 = Date.now();
    await dbManager.query(testQuery, [], { key: 'test_cache_key', ttl: 60 });
    const time1 = Date.now() - start1;
    console.log(`🔍 First query (database): ${time1}ms`);
    
    // Second query (should hit cache)
    const start2 = Date.now();
    await dbManager.query(testQuery, [], { key: 'test_cache_key', ttl: 60 });
    const time2 = Date.now() - start2;
    console.log(`🔍 Second query (cache): ${time2}ms`);
    
    if (time2 < 5) {
      console.log('✅ Cache performance target met (<5ms)');
    } else {
      console.log('⚠️  Cache performance target not met (>5ms)');
    }
    
    // Test concurrent connections
    console.log('🔄 Testing concurrent connections (10 simultaneous queries)...');
    const concurrentQueries = Array(10).fill(0).map(async (_, i) => {
      const start = Date.now();
      await dbManager!.query(`SELECT ${i} as query_id, pg_sleep(0.1)`);
      return Date.now() - start;
    });
    
    const concurrentResults = await Promise.all(concurrentQueries);
    const avgTime = concurrentResults.reduce((a, b) => a + b, 0) / concurrentResults.length;
    console.log(`✅ Concurrent queries completed, avg time: ${avgTime.toFixed(2)}ms`);
    
    console.log('\n🎉 Database health setup and testing completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Health monitoring: ✅ Enabled`);
    console.log(`- Redis caching: ✅ ${time2 < 5 ? 'Performance target met' : 'Performance needs optimization'}`);
    console.log(`- Connection pooling: ✅ Working (${poolStatus.totalCount} connections)`);
    console.log(`- Health checks: ✅ Working`);
    console.log(`- Concurrent connections: ✅ Working (avg ${avgTime.toFixed(2)}ms)`);
    
  } catch (error) {
    console.error('❌ Database health setup failed:', error);
    throw error;
  } finally {
    if (dbManager) {
      console.log('🔄 Shutting down database manager...');
      await dbManager.shutdown();
      console.log('✅ Database manager shutdown complete');
    }
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabaseHealth().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { setupDatabaseHealth };