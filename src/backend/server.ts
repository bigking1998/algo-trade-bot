import * as http from 'http';
import { URL } from 'url';
import { handleDydxRoute } from './routes/dydx';

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

    // Health check endpoint
    if (pathname === '/api/health') {
      if (req.method !== 'GET') return methodNotAllowed(res);

      return sendJSON(res, 200, {
        status: 'ok',
        service: 'algo-trade-bot-backend',
        time: new Date().toISOString(),
        version: process.env.npm_package_version || 'dev',
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
process.on('SIGINT', () => {
  console.log('\n[backend] shutting down...');
  server.close(() => {
    console.log('[backend] server closed');
    process.exit(0);
  });
});
