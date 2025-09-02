import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const UPSTREAM_URL = 'wss://indexer.dydx.trade/v4/ws';

type Client = WebSocket;

/**
 * A very thin WS proxy that:
 * - Accepts client connections at /api/dydx/ws
 * - For each client, opens an upstream connection to the dYdX Indexer WS
 * - Bi-directionally pipes messages as-is (so the client can send subscribe messages directly)
 * - Adds basic ping/pong heartbeat and cleans up on error/close
 *
 * NOTE: Since the public channel names and schemas are not documented on this host,
 * this proxy lets the frontend experiment and subscribe using whatever the upstream expects.
 */
export function attachDydxWsGateway(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  function heartbeat(this: WebSocket) {
    // @ts-ignore
    this.isAlive = true;
  }

  wss.on('connection', (client: Client) => {
    // @ts-ignore
    client.isAlive = true;
    client.on('pong', heartbeat);

    // Connect to upstream for this client
    const upstream = new WebSocket(UPSTREAM_URL);

    const closeBoth = (code?: number, reason?: string) => {
      try {
        client.close(code, reason);
      } catch {}
      try {
        upstream.close(code, reason);
      } catch {}
    };

    upstream.on('open', () => {
      // Forward an initial ping-like message to confirm connectivity if desired
      // client.send(JSON.stringify({ type: 'proxy_connected' }));
    });

    upstream.on('message', (data: WebSocket.Data) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });

    upstream.on('error', (err: Error) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'proxy_error', message: String(err?.message || err) }));
      }
      closeBoth();
    });

    upstream.on('close', () => {
      closeBoth();
    });

    // Forward client messages upstream
    client.on('message', (data: WebSocket.Data) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data);
      } else {
        // Buffering not implemented; drop with a notice
        // Client can retry a bit later when the upstream is open
      }
    });

    client.on('error', () => {
      closeBoth();
    });

    client.on('close', () => {
      closeBoth();
    });
  });

  // Handle upgrades for our endpoint
  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    if (!url.startsWith('/api/dydx/ws')) {
      return;
    }
    wss.handleUpgrade(request, socket as any, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  });

  // Heartbeat to terminate dead clients
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      // @ts-ignore
      if ((ws as any).isAlive === false) {
        return ws.terminate();
      }
      // @ts-ignore
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  // eslint-disable-next-line no-console
  console.log('[wsGateway] attached at ws://localhost:3001/api/dydx/ws ->', UPSTREAM_URL);
}
