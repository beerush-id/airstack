import worker from '../dist/server/worker.js';

const port = process.env.PORT || 3000;

Bun.serve({
  port,
  // Long-lived IRPC streams go idle between packets; Bun's 10s default
  // would close them. The router's heartbeat probes dead connections.
  idleTimeout: 0,
  async fetch(req, server) {
    const url = new URL(req.url);
    
    // Intercept WebSocket upgrade requests
    if (url.pathname.startsWith('/ws/')) {
      try {
        const resolver = await worker.upgrade(req);
        if (server.upgrade(req, { data: { resolver } })) {
          return;
        }
      } catch (e) {
        console.error('WebSocket upgrade failed:', e);
        return new Response(e.message, { status: 400 });
      }
    }
    
    // Route all standard HTTP requests to the worker
    return worker.fetch(req);
  },
  websocket: {
    async message(ws, message) {
      if (ws.data?.resolver) {
        await ws.data.resolver(message, ws);
      }
    },
    close(ws) {
      ws.data?.resolver?.close?.(ws);
    },
  },
});

console.log(`Bun server running at http://localhost:${port}`);
