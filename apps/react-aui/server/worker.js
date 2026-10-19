import worker from '../dist/server/worker.js';

export class AirDurableLink {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    try {
      const resolver = await worker.upgrade(req, this.env);

      // Create a WebSocketPair for Cloudflare Workers
      const [client, server] = Object.values(new WebSocketPair());

      server.accept();
      server.addEventListener('message', async (event) => {
        await resolver(event.data, server);
      });
      server.addEventListener('close', () => {
        resolver.close?.(server);
      });
      server.addEventListener('error', () => {
        resolver.close?.(server);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (e) {
      console.error('WebSocket upgrade failed:', e);
      return new Response(e.message, { status: 400 });
    }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (env.DURABLE_LINK && url.pathname.startsWith('/ws/')) {
      const id = env.DURABLE_LINK.idFromName('global-link');
      return env.DURABLE_LINK.get(id).fetch(req);
    }

    // Use the explicit signal since Cloudflare uses request level signal
    // to handle client abort instead of on the readble stream's signal.
    return worker.fetch(req, env, req.signal);
  },
};
