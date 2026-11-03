import worker from '../dist/server/worker.js';

Deno.serve({
  port: Deno.env.get('PORT') || 3000,
}, async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname.startsWith('/ws/')) {
    try {
      const resolver = await worker.upgrade(req);
      const { response, socket } = Deno.upgradeWebSocket(req);
      
      socket.addEventListener('message', async (event) => {
        await resolver(event.data, socket);
      });
      socket.addEventListener('close', () => {
        resolver.close?.(socket);
      });
      socket.addEventListener('error', () => {
        resolver.close?.(socket);
      });
      
      return response;
    } catch (e) {
      console.error('WebSocket upgrade failed:', e);
      return new Response(e.message, { status: 400 });
    }
  }
  
  return worker.fetch(req);
});
