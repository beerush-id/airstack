import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import worker from '../dist/server/worker.js';

const port = process.env.PORT || 3000;

const server = serve({
  fetch: worker.fetch,
  port,
}, (info) => {
  console.log(`Node server running at http://localhost:${info.port}`);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  
  if (url.pathname.startsWith('/ws/')) {
    try {
      const headers = new Headers();
      for (let i = 0; i < request.rawHeaders.length; i += 2) {
        headers.append(request.rawHeaders[i], request.rawHeaders[i + 1]);
      }
      
      const req = new Request(url, { headers });
      const resolver = await worker.upgrade(req);
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.on('message', async (message, isBinary) => {
          const data = isBinary ? message : message.toString('utf-8');
          await resolver(data, ws);
        });
        ws.on('close', () => {
          resolver.close?.(ws);
        });
        ws.on('error', () => {
          resolver.close?.(ws);
        });
      });
    } catch (e) {
      console.error('WebSocket upgrade failed:', e);
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});
