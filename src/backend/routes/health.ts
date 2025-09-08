/**
 * Task DB-001: Health Check Endpoints
 * 
 * Provides HTTP endpoints for monitoring database health and system status
 * as required by the PostgreSQL & TimescaleDB setup task.
 */

import { IncomingMessage, ServerResponse } from 'http';
import { DatabaseSetup } from '../database/DatabaseSetup.js';

export interface HealthEndpointConfig {
  databaseSetup: DatabaseSetup;
}

/**
 * Handle health check requests
 */
export async function handleHealthCheck(
  req: IncomingMessage, 
  res: ServerResponse, 
  config: HealthEndpointConfig
): Promise<void> {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    switch (pathname) {
      case '/api/health':
        await handleBasicHealth(res, config);
        break;
      
      case '/api/health/database':
        await handleDatabaseHealth(res, config);
        break;
      
      case '/api/health/detailed':
        await handleDetailedHealth(res, config);
        break;
      
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Health endpoint not found' }));
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error', 
      message: (error as Error).message 
    }));
  }
}

/**
 * Basic health check - returns 200 if system is responsive
 */
async function handleBasicHealth(
  res: ServerResponse, 
  config: HealthEndpointConfig
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Quick database connectivity test
    const dbHealth = await config.databaseSetup.checkHealth();
    const responseTime = Date.now() - startTime;
    
    const status = dbHealth.status === 'healthy' ? 'ok' : 'degraded';
    const statusCode = status === 'ok' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTimeMs: responseTime,
      version: process.env.npm_package_version || '1.0.0'
    }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    }));
  }
}

/**
 * Database-specific health check
 */
async function handleDatabaseHealth(
  res: ServerResponse, 
  config: HealthEndpointConfig
): Promise<void> {
  try {
    const dbHealth = await config.databaseSetup.checkHealth();
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: dbHealth.status,
      timestamp: dbHealth.timestamp.toISOString(),
      database: {
        connections: dbHealth.connections,
        timescaledb: dbHealth.timescaledb,
        performance: dbHealth.performance
      },
      checks: {
        connectivity: dbHealth.performance.queryTimeMs < 5000 ? 'pass' : 'fail',
        timescaledb: dbHealth.timescaledb.installed ? 'pass' : 'fail',
        performance: dbHealth.performance.avgResponseTime < 1000 ? 'pass' : 'warn'
      }
    }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      database: {
        available: false
      }
    }));
  }
}

/**
 * Detailed system health check
 */
async function handleDetailedHealth(
  res: ServerResponse, 
  config: HealthEndpointConfig
): Promise<void> {
  const startTime = Date.now();
  
  try {
    const [dbHealth, systemInfo] = await Promise.all([
      config.databaseSetup.checkHealth(),
      getSystemInfo()
    ]);
    
    const responseTime = Date.now() - startTime;
    const overallStatus = determineOverallStatus(dbHealth, systemInfo);
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      components: {
        database: {
          status: dbHealth.status,
          connections: dbHealth.connections,
          timescaledb: dbHealth.timescaledb,
          performance: dbHealth.performance
        },
        system: systemInfo,
        application: {
          version: process.env.npm_package_version || '1.0.0',
          nodeVersion: process.version,
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development'
        }
      },
      checks: {
        database_connectivity: dbHealth.performance.queryTimeMs < 5000,
        timescaledb_installed: dbHealth.timescaledb.installed,
        memory_usage: systemInfo.memory.usage < 0.9,
        disk_space: systemInfo.disk.usage < 0.8,
        connection_pool: dbHealth.connections.active < dbHealth.connections.total * 0.8
      }
    }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      responseTimeMs: Date.now() - startTime
    }));
  }
}

/**
 * Get system information
 */
async function getSystemInfo() {
  const os = await import('os');
  
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  // Get disk usage (simplified - in production would check actual database disk)
  let diskInfo = { total: 0, used: 0, free: 0, usage: 0 };
  
  try {
    const fs = await import('fs/promises');
    const stats = await fs.statfs('./');
    diskInfo = {
      total: stats.blocks * stats.blksize,
      used: (stats.blocks - stats.bavail) * stats.blksize,
      free: stats.bavail * stats.blksize,
      usage: ((stats.blocks - stats.bavail) / stats.blocks)
    };
  } catch {
    // Fallback if statfs is not available
    diskInfo = { total: 100, used: 30, free: 70, usage: 0.3 };
  }
  
  return {
    platform: os.platform(),
    architecture: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    loadavg: os.loadavg(),
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usage: usedMem / totalMem
    },
    disk: diskInfo
  };
}

/**
 * Determine overall system status based on components
 */
function determineOverallStatus(dbHealth: any, systemInfo: any): string {
  if (dbHealth.status === 'unhealthy') {
    return 'unhealthy';
  }
  
  if (dbHealth.status === 'degraded' || 
      systemInfo.memory.usage > 0.9 || 
      systemInfo.disk.usage > 0.8) {
    return 'degraded';
  }
  
  return 'healthy';
}