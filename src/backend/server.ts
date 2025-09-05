import * as http from 'http';
import { URL } from 'url';
import { handleDydxRoute } from './routes/dydx';
import { handleMLRoute } from './routes/ml';
import { getDatabaseManager } from './database/DatabaseManager';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const PORT = Number(process.env.PORT || 3001);

function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJSON(res: http.ServerResponse, statusCode: number, body: JsonValue) {
  setCors(res);
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function notFound(res: http.ServerResponse) {
  sendJSON(res, 404, { error: 'Not Found' });
}

function methodNotAllowed(res: http.ServerResponse) {
  sendJSON(res, 405, { error: 'Method Not Allowed' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      return notFound(res);
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      setCors(res);
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const { pathname } = url;

    // dYdX proxy routes
    if (await handleDydxRoute(req, res, url)) {
      return;
    }

    // ML routes
    if (await handleMLRoute(req, res, url)) {
      return;
    }

    // Health check endpoint
    if (pathname === '/api/health') {
      if (req.method !== 'GET') return methodNotAllowed(res);

      try {
        const dbManager = getDatabaseManager();
        let databaseHealth = null;
        
        try {
          // Get comprehensive database health status
          databaseHealth = await dbManager.getHealthStatus();
        } catch (dbError) {
          // Database not initialized or unavailable
          databaseHealth = {
            error: dbError instanceof Error ? dbError.message : 'Database unavailable',
            initialized: false
          };
        }

        const poolStatus = dbManager.getPoolStatus();
        
        // Determine overall status
        let overallStatus = 'ok';
        if (
          (databaseHealth && 'error' in databaseHealth && databaseHealth.error) || 
          !poolStatus.connected
        ) {
          overallStatus = 'degraded';
        }

        return sendJSON(res, 200, {
          status: overallStatus,
          service: 'algo-trade-bot-backend',
          time: new Date().toISOString(),
          version: process.env.npm_package_version || 'dev',
          database: databaseHealth,
          connectionPool: poolStatus,
        });
      } catch (healthError) {
        // Fallback to basic health check if database manager fails
        return sendJSON(res, 200, {
          status: 'degraded',
          service: 'algo-trade-bot-backend',
          time: new Date().toISOString(),
          version: process.env.npm_package_version || 'dev',
          error: 'Database manager unavailable',
        });
      }
    }

    // Mock positions endpoint
    if (pathname === '/api/positions') {
      if (req.method !== 'GET') return methodNotAllowed(res);
      return sendJSON(res, 200, []); // Return empty array for now
    }

    // Mock trading performance endpoint  
    if (pathname === '/api/trading/performance') {
      if (req.method !== 'GET') return methodNotAllowed(res);
      return sendJSON(res, 200, {
        dailyPnl: 0,
        winRate: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0
      });
    }

    // Placeholder root route
    if (pathname === '/api' || pathname === '/api/') {
      if (req.method !== 'GET') return methodNotAllowed(res);
      return sendJSON(res, 200, { status: 'ok', message: 'Backend API is running' });
    }

    // TODO: mount additional routes here (dydx, wallet, orders, backtest)
    return notFound(res);
  } catch (err) {
    console.error('Unhandled server error:', err);
    try {
      return sendJSON(res, 500, { error: 'Internal Server Error' });
    } catch {
      res.writeHead(500);
      return res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(`[backend] health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[backend] shutting down...');
  
  // Close HTTP server
  server.close(async () => {
    console.log('[backend] server closed');
    
    try {
      // Shutdown database manager
      const dbManager = getDatabaseManager();
      await dbManager.shutdown();
      console.log('[backend] database connections closed');
    } catch (error) {
      console.error('[backend] error during database shutdown:', error);
    }
    
    process.exit(0);
  });
});
