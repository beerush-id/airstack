# Distribution, Monitoring & Durable State

Distribution governs how IRPC functions reach production — how they are packaged, versioned, routed across microservices, published to NPM registries, swapped dynamically between edge and cloud, and persisted in serverless runtimes.

---

## 1. The Package System

Every IRPC function belongs to an `IRPCPackage`:

```typescript
import { createPackage } from '@irpclib/irpc';
import { HTTPTransport } from '@irpclib/http';

// Shared transport serving the application's RPC endpoint
export const transport = new HTTPTransport({
  endpoint: '/irpc',
});

// Domain packages share the same transport
export const authApi = createPackage({ name: 'auth', version: '1.0.0' });
export const billingApi = createPackage({ name: 'billing', version: '1.0.0' });

authApi.use(transport);
billingApi.use(transport);
```

### Package Identity & Version Safety

- `irpc.href` produces a composite identifier (`name/version`) that acts as the routing key on the wire.
- Multiple packages can share a single transport; the wire protocol automatically routes calls by package identity.
- If a client using `1.0.0` stubs communicates with a server running `2.0.0` handlers, the call fails immediately with a routing error rather than silently failing with subtle data-shape discrepancies.

---

## 2. Microservice Routing Without API Gateways

Because each package binds independently to its own transport instance, you can route functions across different backend microservices without an external API gateway:

```typescript
import { createPackage } from '@irpclib/irpc';
import { HTTPTransport } from '@irpclib/http';
import { WebSocketTransport } from '@irpclib/ws';

// User service routed to Server A via HTTP
export const userService = createPackage({ name: 'users', version: '1.0.0' });
userService.use(new HTTPTransport({
  baseURL: 'https://users.internal',
  endpoint: '/irpc',
}));

// Telemetry service routed to Server B via WebSocket
export const telemetryService = createPackage({ name: 'telemetry', version: '1.0.0' });
telemetryService.use(new WebSocketTransport({ url: 'wss://telemetry.internal/ws' }));

// Functions declared on their respective packages
export const getUser = userService.declare<GetUserFn>('user.get', {
  seed: () => ({}),
});
export const watchMetrics = telemetryService.declare<WatchMetricsFn>('telemetry.watch', {
  stream: true,
  seed: () => ({}),
});
```

Consumers call `await getUser()` and `watchMetrics.with(...)` identically. IRPC routes each call to the appropriate microservice and protocol transparently.

---

## 3. NPM Package Separation

In full-stack applications, stubs and constructors are colocated directly alongside routes as `function.ts` and `constructor.ts` inside `pages/`. 

When building a **standalone remote API package** published to an NPM registry, separating declarations (`index.ts` / `function.ts`) and implementations (`constructor.ts`) allows publishing client stubs while excluding server-side logic from the package bundle.

### Directory Structure (Standalone Package)

```
my-api/
├── lib/
│   └── module.ts          # Package definition & transport
├── src/
│   ├── users/
│   │   ├── index.ts       # Type stubs & contracts (published)
│   │   └── constructor.ts # Server handlers (excluded)
│   └── billing/
│       ├── index.ts       # Type stubs (published)
│       └── constructor.ts # Server handlers (excluded)
├── server.ts              # Server entry point (excluded)
├── package.json
└── .npmignore
```

### `.npmignore` Configuration

```
# Exclude server-side files from published NPM bundle
**/constructor.ts
**/constructor.js
server.ts
server.js
.env
```

Consumer applications install the published package for typed RPC contracts without including server-side dependencies:

```typescript
import { getUser } from 'my-api/users';

const user = await getUser('user-123');
```

---

## 4. Dynamic Runtime Transport Switching

Transports can be reassigned dynamically at runtime without modifying function call sites or component bindings:

```typescript
import { createPackage } from '@irpclib/irpc';
import { HTTPTransport } from '@irpclib/http';
import { BroadcastTransport } from '@irpclib/broadcast';

export const irpc = createPackage({ name: 'compute-engine', version: '1.0.0' });

export function switchExecutionTarget(target: 'remote' | 'local') {
  if (target === 'remote') {
    // Route execution to remote HTTP server
    irpc.use(new HTTPTransport({
      baseURL: 'https://api.example.com',
      endpoint: '/irpc',
    }));
  } else {
    // Route execution to browser Web Worker via BroadcastChannel
    irpc.use(new BroadcastTransport({
      channel: irpc.href,
    }));
  }
}
```

Caller functions invoke stubs identically regardless of whether execution resolves on a remote server or local Web Worker.

---

## 5. Live Observability with `IRPC_STORE`

IRPC provides a global reactive store (`IRPC_STORE`) to inspect in-flight calls, registered routers, and system packages in real time:

```typescript
import { IRPC_STORE } from '@irpclib/irpc';

// Real-time call tracking
const unsubscribe = IRPC_STORE.subscribe((event) => {
  switch (event.type) {
    case 'queue':
      console.log(`[IRPC In-Flight Start] ${event.detail.payload.name}`);
      break;
    case 'dequeue':
      console.log(`[IRPC Call Completed] ${event.detail.payload.name}`);
      break;
    case 'route':
      console.log(`[IRPC Batch Routing]`, event.detail);
      break;
  }
});
```

---

## 6. Durable State in Serverless Runtimes

In serverless and edge environments (like Cloudflare Workers), runtime instances are stateless and ephemeral. The `Durable` abstraction connects short-lived worker requests to a single persistent reactive state object (e.g. Cloudflare Durable Objects).

### 1. The Persistent Class

```typescript
// src/visitors.ts
import { Durable } from '@irpclib/irpc';
import type { StateChange } from '@airlib/core';

export interface Visitor {
  id: string;
  name: string;
}

export class Visitors {
  state = new Durable<Record<string, Visitor>>({});

  async replay(event: StateChange, emitter: string) {
    this.state.replay(event, emitter);
  }

  async subscribe(id: string) {
    return this.state.subscribe(id);
  }
}
```

### 2. Platform Adapter Registration

```typescript
// src/worker.ts
import { durable } from '@irpclib/irpc';

durable.use({
  get(namespace, bindingKey) {
    const ns = env[bindingKey ?? 'VISITORS'] as DurableObjectNamespace;
    return {
      async replay(event, emitter) {
        const stub = ns.get(namespace);
        await stub.replay(event, emitter);
      },
      async subscribe(id) {
        const stub = ns.get(namespace);
        return stub.subscribe(id);
      },
    };
  },
});
```

### 3. Synchronized Stream Constructor

```typescript
// pages/visitors/constructor.ts
import { durable, stream, irpc } from '@irpclib/irpc';
import { joinVisitor } from './function.js';

irpc.construct(joinVisitor, (user) =>
  stream(async (state) => {
    // Connect to the shared durable state object
    const { data } = await durable.get<Record<string, Visitor>>(user.id, 'visitors');

    // Mutating data updates the persistent object and all connected clients
    data[user.id] = user;
    state.data = data;

    // Automatic presence teardown when client disconnects
    return () => {
      delete data[user.id];
    };
  })
);
```
