-- ============================================================================
-- TRADING PLATFORM DATABASE OPTIMIZATION QUERIES
-- ============================================================================
-- 
-- Performance optimization and analysis queries for the algorithmic trading
-- platform PostgreSQL + TimescaleDB schema (DB-002)
-- 
-- These queries are designed to monitor, analyze, and optimize database
-- performance for high-frequency trading operations
-- ============================================================================

-- ============================================================================
-- 1. HYPERTABLE PERFORMANCE ANALYSIS
-- ============================================================================

-- Monitor hypertable chunk distribution
SELECT 
    ht.hypertable_name,
    ht.num_chunks,
    ht.compression_enabled,
    pg_size_pretty(
        (SELECT SUM(pg_total_relation_size('"' || chunk_schema || '"."' || chunk_name || '"'))
         FROM timescaledb_information.chunks c 
         WHERE c.hypertable_name = ht.hypertable_name)
    ) as total_size
FROM timescaledb_information.hypertables ht
ORDER BY ht.hypertable_name;

-- Analyze chunk compression effectiveness
SELECT 
    hypertable_name,
    COUNT(*) as total_chunks,
    SUM(CASE WHEN is_compressed THEN 1 ELSE 0 END) as compressed_chunks,
    ROUND(
        SUM(CASE WHEN is_compressed THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100, 
        2
    ) as compression_percentage,
    pg_size_pretty(SUM(chunk_size)) as total_chunk_size
FROM timescaledb_information.chunks
GROUP BY hypertable_name
ORDER BY hypertable_name;

-- Monitor compression ratios by hypertable
SELECT 
    cs.hypertable_name,
    COUNT(*) as compressed_chunks,
    pg_size_pretty(SUM(cs.uncompressed_bytes)) as uncompressed_size,
    pg_size_pretty(SUM(cs.compressed_bytes)) as compressed_size,
    ROUND(
        (SUM(cs.uncompressed_bytes)::NUMERIC - SUM(cs.compressed_bytes)) / 
        SUM(cs.uncompressed_bytes) * 100, 2
    ) as compression_ratio_percent,
    ROUND(
        SUM(cs.uncompressed_bytes)::NUMERIC / SUM(cs.compressed_bytes), 2
    ) as compression_factor
FROM timescaledb_information.compressed_chunk_stats cs
GROUP BY cs.hypertable_name
ORDER BY compression_ratio_percent DESC;

-- ============================================================================
-- 2. INDEX USAGE AND PERFORMANCE ANALYSIS  
-- ============================================================================

-- Analyze index usage effectiveness
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW USAGE'
        WHEN idx_scan < 1000 THEN 'MODERATE USAGE'
        ELSE 'HIGH USAGE'
    END as usage_category,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE tablename IN ('market_data', 'trades', 'orders', 'strategies', 'portfolio_snapshots', 'system_logs')
ORDER BY tablename, idx_scan DESC;

-- Identify potentially unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    'Consider dropping - unused index' as recommendation
FROM pg_stat_user_indexes 
WHERE tablename IN ('market_data', 'trades', 'orders', 'strategies', 'portfolio_snapshots', 'system_logs')
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'  -- Don't suggest dropping primary keys
ORDER BY pg_relation_size(indexrelid) DESC;

-- Analyze table scan vs index scan ratios
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    ROUND(
        CASE 
            WHEN (seq_scan + idx_scan) = 0 THEN 0
            ELSE idx_scan::NUMERIC / (seq_scan + idx_scan) * 100
        END, 2
    ) as index_usage_percent,
    CASE 
        WHEN (seq_scan + idx_scan) = 0 THEN 'NO ACTIVITY'
        WHEN idx_scan::NUMERIC / (seq_scan + idx_scan) > 0.95 THEN 'EXCELLENT'
        WHEN idx_scan::NUMERIC / (seq_scan + idx_scan) > 0.80 THEN 'GOOD'
        WHEN idx_scan::NUMERIC / (seq_scan + idx_scan) > 0.50 THEN 'FAIR'
        ELSE 'POOR - NEEDS OPTIMIZATION'
    END as performance_rating
FROM pg_stat_user_tables 
WHERE relname IN ('market_data', 'trades', 'orders', 'strategies', 'portfolio_snapshots', 'system_logs')
ORDER BY index_usage_percent ASC;

-- ============================================================================
-- 3. QUERY PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Most expensive queries by total time
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    ROUND(total_time / SUM(total_time) OVER() * 100, 2) as percentage_total_time,
    rows_,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE query ILIKE '%market_data%' OR query ILIKE '%trades%' OR query ILIKE '%orders%'
ORDER BY total_time DESC
LIMIT 20;

-- Slow queries analysis (requires pg_stat_statements)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    min_time,
    max_time,
    'SLOW QUERY - INVESTIGATE' as recommendation
FROM pg_stat_statements 
WHERE mean_time > 1000  -- Queries averaging more than 1 second
  AND calls > 10        -- Called more than 10 times
ORDER BY mean_time DESC
LIMIT 10;

-- ============================================================================
-- 4. HIGH-FREQUENCY TRADING SPECIFIC OPTIMIZATIONS
-- ============================================================================

-- Market data ingestion performance analysis
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as records_inserted,
    COUNT(DISTINCT symbol) as unique_symbols,
    AVG(EXTRACT(EPOCH FROM (created_at - time))) as avg_ingestion_delay_seconds,
    MAX(EXTRACT(EPOCH FROM (created_at - time))) as max_ingestion_delay_seconds
FROM market_data 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Trade execution latency analysis
SELECT 
    DATE_TRUNC('hour', time) as hour,
    COUNT(*) as total_trades,
    AVG(duration_ms) as avg_execution_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as median_execution_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_execution_time_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_execution_time_ms,
    MAX(duration_ms) as max_execution_time_ms
FROM trades 
WHERE time >= NOW() - INTERVAL '24 hours'
  AND duration_ms IS NOT NULL
GROUP BY DATE_TRUNC('hour', time)
ORDER BY hour DESC;

-- Order book depth analysis for performance
SELECT 
    symbol,
    COUNT(*) as active_orders,
    COUNT(CASE WHEN side = 'buy' THEN 1 END) as buy_orders,
    COUNT(CASE WHEN side = 'sell' THEN 1 END) as sell_orders,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_order_age_seconds,
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at))) as max_order_age_seconds
FROM orders 
WHERE status IN ('pending', 'partial')
GROUP BY symbol
ORDER BY active_orders DESC
LIMIT 20;

-- ============================================================================
-- 5. STORAGE AND COMPRESSION OPTIMIZATION
-- ============================================================================

-- Analyze table sizes and growth rates
WITH table_sizes AS (
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('market_data', 'trades', 'orders', 'strategies', 'portfolio_snapshots', 'system_logs')
)
SELECT 
    tablename,
    size,
    ROUND(size_bytes::NUMERIC / (1024*1024*1024), 2) as size_gb,
    ROUND(size_bytes::NUMERIC / SUM(size_bytes) OVER() * 100, 2) as percentage_of_total
FROM table_sizes
ORDER BY size_bytes DESC;

-- Monitor compression candidates (chunks ready for compression)
SELECT 
    hypertable_name,
    chunk_name,
    range_start,
    range_end,
    is_compressed,
    pg_size_pretty(chunk_size) as chunk_size,
    CASE 
        WHEN NOT is_compressed AND range_end < NOW() - INTERVAL '7 days' THEN 'READY FOR COMPRESSION'
        WHEN NOT is_compressed AND range_end < NOW() - INTERVAL '3 days' THEN 'COMPRESSION CANDIDATE'
        ELSE 'OK'
    END as compression_status
FROM timescaledb_information.chunks
WHERE hypertable_name IN ('market_data', 'trades', 'portfolio_snapshots', 'system_logs')
  AND NOT is_compressed
ORDER BY range_end ASC;

-- Analyze JSONB field usage for optimization
SELECT 
    'strategies' as table_name,
    'parameters' as jsonb_column,
    jsonb_object_keys(parameters) as json_key,
    COUNT(*) as usage_count
FROM strategies 
WHERE parameters != '{}'
GROUP BY jsonb_object_keys(parameters)
UNION ALL
SELECT 
    'trades' as table_name,
    'metadata' as jsonb_column,
    jsonb_object_keys(metadata) as json_key,
    COUNT(*) as usage_count
FROM trades 
WHERE metadata != '{}'
GROUP BY jsonb_object_keys(metadata)
ORDER BY table_name, usage_count DESC;

-- ============================================================================
-- 6. REAL-TIME MONITORING QUERIES
-- ============================================================================

-- Current system performance metrics
SELECT 
    'Database Connections' as metric,
    COUNT(*) as value,
    'connections' as unit
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'Cache Hit Ratio' as metric,
    ROUND(
        100 * SUM(blks_hit) / (SUM(blks_hit) + SUM(blks_read)), 2
    ) as value,
    'percent' as unit
FROM pg_stat_database
UNION ALL
SELECT 
    'Active Strategies' as metric,
    COUNT(*) as value,
    'strategies' as unit
FROM strategies 
WHERE status = 'active' AND is_deleted = FALSE
UNION ALL
SELECT 
    'Pending Orders' as metric,
    COUNT(*) as value,
    'orders' as unit
FROM orders 
WHERE status IN ('pending', 'partial');

-- Real-time trade volume analysis
SELECT 
    symbol,
    COUNT(*) as trades_last_hour,
    SUM(executed_quantity) as total_volume,
    AVG(executed_price) as avg_price,
    COUNT(CASE WHEN side = 'buy' THEN 1 END) as buy_trades,
    COUNT(CASE WHEN side = 'sell' THEN 1 END) as sell_trades
FROM trades 
WHERE time >= NOW() - INTERVAL '1 hour'
  AND status = 'filled'
GROUP BY symbol
ORDER BY trades_last_hour DESC
LIMIT 10;

-- System health check
SELECT 
    CASE 
        WHEN active_connections > 80 THEN 'HIGH CONNECTION LOAD'
        WHEN cache_hit_ratio < 95 THEN 'LOW CACHE PERFORMANCE'
        WHEN pending_orders > 10000 THEN 'HIGH ORDER BACKLOG'
        ELSE 'SYSTEM HEALTHY'
    END as health_status,
    active_connections,
    cache_hit_ratio,
    pending_orders
FROM (
    SELECT 
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT ROUND(100 * SUM(blks_hit) / (SUM(blks_hit) + SUM(blks_read)), 2) 
         FROM pg_stat_database) as cache_hit_ratio,
        (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'partial')) as pending_orders
) as metrics;

-- ============================================================================
-- 7. OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

-- Generate optimization recommendations
WITH recommendations AS (
    SELECT 
        'INDEX_OPTIMIZATION' as category,
        'Consider dropping unused index: ' || indexname as recommendation,
        'HIGH' as priority
    FROM pg_stat_user_indexes 
    WHERE tablename IN ('market_data', 'trades', 'orders')
      AND idx_scan = 0 
      AND indexname NOT LIKE '%_pkey'
    
    UNION ALL
    
    SELECT 
        'COMPRESSION_OPTIMIZATION' as category,
        'Compress chunk: ' || chunk_name as recommendation,
        'MEDIUM' as priority
    FROM timescaledb_information.chunks
    WHERE NOT is_compressed 
      AND range_end < NOW() - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
        'QUERY_OPTIMIZATION' as category,
        'Optimize slow query with mean_time: ' || ROUND(mean_time, 2) || 'ms' as recommendation,
        'HIGH' as priority
    FROM pg_stat_statements
    WHERE mean_time > 1000 AND calls > 10
    LIMIT 5
)
SELECT * FROM recommendations
ORDER BY priority DESC, category;

-- ============================================================================
-- SCHEMA VALIDATION AND INTEGRITY CHECKS
-- ============================================================================

-- Verify hypertable configuration
SELECT 
    ht.hypertable_name,
    ht.num_chunks,
    ht.compression_enabled,
    CASE WHEN jp.job_id IS NOT NULL THEN 'ENABLED' ELSE 'DISABLED' END as retention_policy,
    CASE WHEN jc.job_id IS NOT NULL THEN 'ENABLED' ELSE 'DISABLED' END as compression_policy
FROM timescaledb_information.hypertables ht
LEFT JOIN timescaledb_information.jobs jp ON jp.hypertable_name = ht.hypertable_name 
    AND jp.job_type = 'retention'
LEFT JOIN timescaledb_information.jobs jc ON jc.hypertable_name = ht.hypertable_name 
    AND jc.job_type = 'compression'
ORDER BY ht.hypertable_name;

-- Check referential integrity
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('trades', 'orders', 'portfolio_snapshots', 'system_logs')
ORDER BY tc.table_name, tc.constraint_name;

-- Final performance summary
SELECT 
    'DB-002 Schema Performance Analysis Complete' as status,
    NOW() as analysis_timestamp,
    (SELECT COUNT(*) FROM timescaledb_information.hypertables) as hypertables_configured,
    (SELECT COUNT(*) FROM pg_stat_user_indexes 
     WHERE tablename IN ('market_data', 'trades', 'orders', 'strategies', 'portfolio_snapshots', 'system_logs')
    ) as indexes_created,
    'Review recommendations above for optimization opportunities' as next_steps;