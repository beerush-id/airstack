# IRPC Server Handlers & Reactive Streaming

Handlers implement the contracts declared by `irpc.declare()`. They reside in `constructor.ts` files and run strictly in the server environment.

---

## Constructing Handlers

Use `irpc.construct()` to bind logic to a declared stub. Types for parameters and return values are inferred automatically from the stub:

```typescript
// pages/users/constructor.ts
import { irpc } from '@/src/api.js';
import { getUser, type User } from './function.js';
import { db } from '@/src/lib/database.js';

/**
 * Server implementation for user.get.
 * Automatically type-checked against GetUserFn.
 */
irpc.construct(getUser, async (id: string): Promise<User> => {
  const user = await db.users.findById(id);
  if (!user) {
    throw new Error(`User with ID ${id} not found`);
  }
  return user;
});
```

### Server Entry Point Setup (Standalone APIs)

NOTE: In full-stack AirLib projects, the Vite plugin automatically handles constructor discovery and registration. Manual entry point wiring is only required when deploying as a standalone backend API service.

When deploying as a standalone server (Node.js, Bun), instantiate an `HTTPRouter` and import constructor files for registration:

```typescript
// server.ts (Standalone API only)
import { HTTPRouter } from '@irpclib/http/router';
import { transport } from '@/src/api.js';

// Import constructors for their registration side-effects
import '@/pages/users/constructor.js';
import '@/pages/market/constructor.js';

const router = new HTTPRouter(transport);
```

---

## In-Memory Function Composition

Because IRPC stubs extend `Promise`, handlers can call other stubs directly. If a called stub resides within the same package and process, IRPC routes execution directly in memory, bypassing network serialization:

```typescript
// pages/users/constructor.ts
import { irpc } from '@/src/api.js';
import { getUser, getPermissions, verifyAccess, type AccessCheck } from './function.js';

irpc.construct(verifyAccess, async ({ userId, requiredRole }: AccessCheck) => {
  // In-memory execution: zero network or HTTP overhead
  const [user, permissions] = await Promise.all([
    getUser(userId),
    getPermissions(userId),
  ]);

  if (!user.isActive || !permissions.includes(requiredRole)) {
    throw new Error('Forbidden: Insufficient permissions');
  }

  return { allowed: true, user };
});
```

---

## Reactive Streaming with `stream()`

For stubs declared with `{ stream: true }` returning `RemoteState<T>`, handlers use the `stream()` factory to push incremental updates:

```typescript
// pages/market/constructor.ts
import { irpc, stream } from '@irpclib/irpc';
import { watchPrices } from './function.js';
import { marketFeed } from '@/src/lib/market.js';

irpc.construct(watchPrices, (ticker: string) => {
  return stream<number>((state) => {
    const subscription = marketFeed.subscribe(ticker, (price) => {
      state.data = price;
    });

    // Return a cleanup callback guaranteed to fire on teardown
    return () => {
      subscription.unsubscribe();
    };
  }, 0);
});
```

### The `stream()` Factory Signature

```typescript
stream<T>(
  callback: (
    state: RemoteState<T>,
    resolve: () => void,
    reject: (error: Error) => void
  ) => Promise<(() => void) | void> | (() => void) | void,
  initialData?: T
): RemoteState<T>
```

- **`state`**: Live reactive proxy. Any mutation is serialized into an incremental mutation packet.
- **`resolve()`**: Signals stream completion and closes the client connection cleanly.
- **`reject(err)`**: Terminates the stream with an error packet.

### Checking Stream Status

Always inspect `state.status` before mutating state in async loops. When a client closes a reader or aborts, `state.status` transitions away from `'pending'`:

```typescript
for await (const chunk of aiStream) {
  if (state.status !== 'pending') break;
  state.data += chunk.text;
}
resolve();
```

---

## Progressive Data Hydration

Instead of executing async queries sequentially, progressive hydration yields fields into a single reactive object as each query resolves:

```typescript
// pages/dashboard/constructor.ts
import { irpc, stream } from '@irpclib/irpc';
import { getDashboard, type DashboardData } from './function.js';
import { db } from '@/src/lib/database.js';

irpc.construct(getDashboard, (userId: string) => {
  return stream<DashboardData>((state, resolve, reject) => {
    // Fire all three queries concurrently
    const userPromise = db.users.find(userId).then((user) => {
      state.data.user = user;
    });

    const salesPromise = db.sales.getSummary(userId).then((sales) => {
      state.data.sales = sales;
    });

    const metricsPromise = db.metrics.getRecent(userId).then((metrics) => {
      state.data.metrics = metrics;
    });

    // When all parallel queries complete, close the stream or propagate errors
    Promise.all([userPromise, salesPromise, metricsPromise]).then(resolve, reject);
  }, { user: null, sales: null, metrics: null });
});
```

### Client Consumption
The client's single `IRPCReader` proxy updates progressively as each field is populated:

```tsx
import { setup, Show } from '@airlib/react';
import { getDashboard } from './function.js';

export const DashboardWidget = setup<{ userId: string }>((props) => {
  const dashboard = getDashboard.with(() => [props.userId]);

  return () => (
    <div>
      <Show when={() => dashboard.data?.user}>
        {(user) => <h1>Welcome, {user.name}</h1>}
      </Show>
      <Show when={() => dashboard.data?.sales}>
        {(sales) => <div>Total Revenue: ${sales.total}</div>}
      </Show>
      <Show when={() => dashboard.data?.metrics}>
        {(metrics) => <div>Latency: {metrics.latency}ms</div>}
      </Show>
    </div>
  );
}, 'DashboardWidget');
```

---

## Stream Piping with `reader.pipe()`

When a handler acts as a proxy or decorator for another streaming function, return `reader.pipe()` to forward the stream directly without re-wrapping:

```typescript
// pages/chat/constructor.ts
import { irpc } from '@/src/api.js';
import { proxyChat, generateRawStream } from './function.js';

irpc.construct(proxyChat, async (prompt: string) => {
  const reader = generateRawStream(prompt);

  // Attach side-effect listener
  reader.then(() => {
    auditLog.record(prompt, reader.data);
  });

  // Forward live stream packets through to the client
  return reader.pipe();
});
```

---

## Resource Cleanup Guarantees

Returning a function from the `stream()` callback registers a lifecycle cleanup hook. The framework guarantees execution across all teardown scenarios:

| Scenario | Trigger |
|---|---|
| **Completion** | `resolve()` is invoked by handler code. |
| **Handler Error** | `reject()` is called or an error is thrown. |
| **Client Close** | Client calls `reader.close()` or unmounts component. |
| **TTL Timeout** | Function exceeds its declared `ttl` duration. |
| **Async Abort** | Network drops while asynchronous setup is pending. |

WARNING: Cleanup hooks are only registered **after** the setup function returns the cleanup callback. Always wrap potentially failing initializations in `try...catch` so resources can be released if an exception occurs before registration.

```typescript
irpc.construct(watchSensor, (sensorId: string) => {
  return stream(async (state) => {
    let socket;
    try {
      socket = await sensorService.connect(sensorId);
    } catch (error) {
      throw error; // Initial failure, no resources leaked yet
    }

    socket.on('reading', (val) => { state.data = val; });

    return () => {
      socket.disconnect();
    };
  });
});
```

---

## Request Context & Cookies

### Reading and Writing Context

Context is seeded during router resolution and isolated per request:

```typescript
import { getContext, setContext } from '@irpclib/irpc';

irpc.construct(getUserData, async () => {
  const user = getContext<User>('user');
  if (!user) {
    throw new Error('Unauthorized');
  }
  return db.userData.forUser(user.id);
});
```

Alternatively, define a typed context handle at module level using `createContext`:

```typescript
import { createContext } from '@irpclib/irpc';

export const userCtx = createContext<User>();

irpc.construct(getUserData, async () => {
  const user = userCtx.get();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return db.userData.forUser(user.id);
});
```

### Executing in Isolated Context (`withContext`)

Use `withContext` to execute asynchronous operations within an isolated request scope:

```typescript
import { withContext } from '@irpclib/irpc';

await withContext(async () => {
  await processBatch();
});
```

To pre-populate the isolated context with initial values before execution, pass key-value seed tuples:

```typescript
import { withContext } from '@irpclib/irpc';
import { userCtx } from './context.js';

const result = await withContext([[userCtx.key, { id: 'usr-123', name: 'Alice' }]], async () => {
  return await getUserData();
});
```

### Runtime Environment Variables (`envCtx`, `getEnv`)

In serverless and edge environments (such as Cloudflare Workers or Bun), environment bindings are passed at runtime to the worker's `fetch(request, env)` handler. Rather than threading `env` through every function call, workers seed `envCtx` into the router:

```typescript
// worker.ts
import { envCtx } from '@irpclib/irpc';

export default {
  async fetch(req: Request, env: Env) {
    return router.resolve(req, [
      [envCtx.key, env],
    ]);
  },
};
```

Handlers, middleware, and backend drivers retrieve environment variables anywhere in the call stack using `getEnv<T>()`:

```typescript
import { getEnv } from '@irpclib/irpc';

export interface AppEnv {
  DATABASE_URL: string;
  KIE_API_KEY: string;
}

irpc.construct(generateAsset, async (prompt: string) => {
  // Reads from envCtx with optional fallback values
  const { KIE_API_KEY } = getEnv<AppEnv>({ KIE_API_KEY: 'default-dev-key' });
  const client = new VendorClient({ apiKey: KIE_API_KEY });
  return client.create(prompt);
});
```

### Reactive Cookies in Handlers

Handlers can directly mutate isomorphic reactive cookies from `@airlib/react` (or `@airlib/solid`). Cookie mutations inside a handler automatically configure `Set-Cookie` response headers on the HTTP transport.

IMPORTANT: Any procedure that mutates or clears cookies **must** be declared with `standalone: true` on the client stub (see [Declarations: Standalone Requests](./declarations.md#standalone-requests-standalone-true)). This bypasses the microtask batching window so the call dispatches as an isolated HTTP request whose `Set-Cookie` response headers are processed immediately by the browser.

```typescript
// pages/auth/constructor.ts
import { irpc } from '@/src/api.js';
import { login, logout, type SessionData } from './function.js';
import { cookies } from '@airlib/react'; // or '@airlib/solid'

// Login: sets authentication cookies on dedicated response
irpc.construct(login, async ({ email, password }) => {
  const user = await auth.verify(email, password);

  const session = cookies<SessionData>('session', { token: '', userId: '' }, {
    path: '/',
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  // Mutating cookie properties sets Set-Cookie headers automatically
  session.token = user.token;
  session.userId = user.id;

  return { success: true, user: { id: user.id, name: user.name } };
});

// Logout: expires and clears session cookies immediately
irpc.construct(logout, async () => {
  const session = cookies<SessionData>('session', { token: '', userId: '' }, {
    path: '/',
    secure: true,
    sameSite: 'Lax',
    maxAge: 0, // Clears cookie on the browser
  });

  session.token = '';
  session.userId = '';
});
```

---

## Handler Errors vs. Transport Errors

| Error Category | Source | Retry Behavior | Client Propagation |
|---|---|---|---|
| **Handler Error** | `throw new Error('Not found')` in constructor | **Never retried** | Rejects Promise; preserves message |
| **Transport Error** | Network dropped, DNS error, timeout | **Retried** according to `maxRetries` | Rejects Promise if retries exhausted |

Because handler errors represent business assertions, retrying them is invalid. Only transport errors are eligible for automatic retry.
