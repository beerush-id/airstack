# Network Transports & Routers

A **transport** carries IRPC calls between caller and receiver. Because IRPC completely decouples signatures and handlers from the wire protocol, swapping transports requires zero changes to function declarations, component bindings, or server handlers.

---

## HTTP Transport (`@irpclib/http`)

The standard transport for full-stack applications. Uses standard HTTP POST requests with automatic microtask batching and chunked NDJSON streaming.

### Client Configuration

```typescript
import { createPackage } from '@irpclib/irpc';
import { HTTPTransport } from '@irpclib/http';

export const irpc = createPackage({ name: 'my-api', version: '1.0.0' });

export const transport = new HTTPTransport({
  endpoint: '/irpc',
  baseURL: 'https://api.example.com',
  timeout: 10000,
  debounce: 0,                   // Microtask batching window (ms)
  maxRetries: 3,
  retryMode: 'exponential',      // 'linear' | 'exponential'
  retryDelay: 1000,
  headers: {
    'x-client-platform': 'web',
  },
});

irpc.use(transport);
```

### Server Setup (`HTTPRouter`)

```typescript
// server.ts
import { HTTPRouter } from '@irpclib/http/router';
import { transport } from '@/src/api.js';

// Load all handler constructors
import '@/pages/users/constructor.js';

const router = new HTTPRouter(transport);

Bun.serve({
  port: 3000,
  fetch(req) {
    if (req.url.endsWith(transport.endpoint) && req.method === 'POST') {
      // Seed request context via tuple array
      return router.resolve(req, [
        ['token', req.headers.get('authorization')],
        ['userAgent', req.headers.get('user-agent')],
      ]);
    }
    return new Response('Not Found', { status: 404 });
  },
});
```

### Custom Response Builder

Override default HTTP response creation to append custom headers:

```typescript
return router.resolve(req, [], async (body, init) => {
  const headers = new Headers(init.headers);
  headers.set('x-processed-by', 'airlib-irpc');
  return new Response(body, { ...init, headers });
});
```

### Batching & Chunked Streaming

When multiple calls execute within the same microtask (`Promise.all([getUser('1'), getPosts('1')])`), `HTTPTransport` bundles them into a single HTTP POST request. Responses stream back over HTTP chunked transfer encoding as NDJSON packets:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Transfer-Encoding: chunked

{"id":"1","name":"getUser","type":"answer","status":"success","data":{"id":"1","name":"Alice"}}
{"id":"2","name":"getPosts","type":"answer","status":"success","data":[...]}
```

NOTE: Functions configured with `standalone: true` bypass microtask batching and dispatch as an independent HTTP request. Use this for operations that require an isolated request/response lifecycle, particularly authentication procedures like `login` and `logout` that receive or clear session cookies via `Set-Cookie` headers.

---

## WebSocket Transport (`@irpclib/ws`)

Provides a persistent bidirectional connection with low latency and automatic reconnection. Ideal for real-time applications and continuous reactive streams.

### Client Configuration

```typescript
import { createPackage } from '@irpclib/irpc';
import { WebSocketTransport } from '@irpclib/ws';

export const irpc = createPackage({ name: 'my-api', version: '1.0.0' });

export const transport = new WebSocketTransport({
  url: 'wss://api.example.com/ws',
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  connectionTimeout: 10000,
});

irpc.use(transport);
```

### Server Setup (`WebSocketRouter`)

In WebSocket architectures, authentication occurs during connection upgrade. The extracted identity is stored on `ws.data` and forwarded on each message:

```typescript
import { WebSocketRouter } from '@irpclib/ws/router';
import { transport } from '@/src/api.js';

const router = new WebSocketRouter(transport, {
  fileBufferTTL: 30000, // Clean up orphaned binary frames after 30s
});

Bun.serve({
  port: 8080,
  fetch(req, server) {
    const token = req.headers.get('authorization');
    // Upgrade HTTP request to WebSocket, storing credentials in socket data
    if (server.upgrade(req, { data: { token } })) return;
    return new Response('Upgrade failed', { status: 400 });
  },
  websocket: {
    async message(ws, message) {
      await router.resolve(message.toString(), ws, [
        ['token', ws.data.token],
      ]);
    },
    close(ws) {
      // Abort all active streams tied to this socket connection
      router.disconnect(ws);
    },
  },
});
```

WARNING: **Avoid Large File Uploads over WebSocket**: Binary frames block the persistent socket pipeline. Always route large file uploads through HTTP Transport to preserve real-time socket responsiveness.

---

## BroadcastChannel Transport (`@irpclib/broadcast`)

Enables zero-server RPC inside the browser across tabs, windows, iframes, and Web Workers.

### Main Thread Client Setup

```typescript
import { createPackage } from '@irpclib/irpc';
import { BroadcastTransport } from '@irpclib/broadcast';

export const irpc = createPackage({ name: 'worker-api', version: '1.0.0' });

export const transport = new BroadcastTransport({
  channel: irpc.href, // Unique channel: 'worker-api/1.0.0'
  timeout: 30000,
});

irpc.use(transport);
```

### Web Worker Router Setup

```typescript
// worker.ts
import { BroadcastRouter } from '@irpclib/broadcast/router';
import { transport } from '@/src/api.js';

// Load worker handler implementations
import '@/pages/compute/constructor.js';

const router = new BroadcastRouter(transport);

self.addEventListener('unload', () => {
  router.disconnect();
});
```

---

## Transport Comparison Matrix

| Feature | HTTP (`@irpclib/http`) | WebSocket (`@irpclib/ws`) | BroadcastChannel (`@irpclib/broadcast`) |
|---|---|---|---|
| **Server Infrastructure** | Required | Required | None (Browser only) |
| **Connection Type** | Stateless request/response | Persistent bidirectional | In-memory message bus |
| **Latency** | Medium | Low | Lowest (Local thread) |
| **Auto Reconnection** | N/A | Supported (`autoReconnect`) | N/A |
| **Binary File Uploads** | Recommended (Non-blocking) | Supported (Blocks socket) | Supported (Structured clone) |
| **Cross-Tab / Worker** | No | No | Supported |
| **Primary Use Case** | Web applications, APIs | Real-time chat, telemetry | Worker compute, offline sync |

---

## Stream Cancellation & Lifecycles

All transports enforce stream teardown across four cancellation boundaries:

- **Client Close**: Calling `reader.close()` sends a cancel packet to the router. The server aborts the stream and invokes registered cleanup handlers.
- **AbortSignal**: Handlers listen to `getAbortSignal()` to terminate internal database watchers or child promises when client connection drops.
- **Stream TTL**: Functions declared with `ttl` (e.g. `ttl: 300000`) are automatically killed by the router if active longer than the duration.
- **Socket Disconnect**: When a socket terminates, `router.disconnect(ws)` fires `AbortController.abort()` across all active streams registered to that connection.

---

## Transport Credentials

Attach credentials to client transports and read them inside handlers:

### Client-Side `.sign()`
```typescript
// Static credentials
transport.sign({ API_KEY: 'token-value' });

// Dynamic credentials factory (evaluated per request batch)
transport.sign(() => ({
  SESSION_TOKEN: getStoredAuthToken(),
}));
```

### Server-Side `credential()`
```typescript
import { credential } from '@irpclib/irpc';

irpc.construct(getSecureProfile, async () => {
  const token = credential<string>('SESSION_TOKEN');
  return authService.validate(token);
});
```

---

## Custom Transports & The Transport Abstraction

All transports inherit from the abstract `IRPCTransport` class:

```typescript
abstract class IRPCTransport {
  abstract call(spec: IRPCSpec, args: IRPCData[], timeout?: number): Promise<IRPCData>;
  protected abstract dispatch(calls: IRPCCall[]): Promise<void>;
}
```

The base class manages batching, debouncing, and queuing. Custom transport subclasses handle wire serialization and transmission by implementing `dispatch()`:

```typescript
import {
  IRPCTransport,
  IRPC_PACKET_TYPE,
  IRPC_STATUS,
  type IRPCCall,
  type IRPCRequest,
} from '@irpclib/irpc';

export class CustomTransport extends IRPCTransport {
  protected async dispatch(calls: IRPCCall[]): Promise<void> {
    const requests: IRPCRequest[] = calls.map(({ id, payload }) => ({
      id,
      name: payload.name,
      args: payload.args,
    }));

    try {
      const response = await this.sendWire(requests);
      // Feed response packets back to matching calls
      for (const packet of response.packets) {
        const call = calls.find((c) => c.id === packet.id);
        call?.enqueue(packet);
      }
    } catch (error) {
      // Feed error packet to trigger retry or error status
      calls.forEach((call) => {
        call.enqueue({
          id: call.id,
          name: call.payload.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: { message: (error as Error).message },
          createdAt: Date.now(),
        });
      });
    }
  }

  private async sendWire(requests: IRPCRequest[]) {
    // Custom network transmission logic
    return { packets: [] };
  }
}
```
