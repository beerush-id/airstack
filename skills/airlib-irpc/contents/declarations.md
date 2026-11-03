# IRPC Declarations & Client Execution

In the **AirLib** architecture, Isomorphic RPC (IRPC) decouples function signatures from implementations and network transports. Declarations define the type-safe contract that both client and server share.

---

## Declaring Function Stubs

Use `irpc.declare()` to register a function signature into an IRPC package. This produces an `IRPCStub`:

```typescript
// pages/users/function.ts
import { irpc } from '@/src/api.js';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export type GetUserFn = (id: string) => Promise<User>;

/**
 * Stub declaration for fetching a user by ID.
 * Returns an IRPCStub with reactive and imperative call methods.
 */
export const getUser = irpc.declare<GetUserFn>('user.get', {
  seed: () => ({
    id: '',
    name: '',
    email: '',
    role: 'member',
  }),
});
```

### The `IRPCStub` Interface

`irpc.declare()` returns an `IRPCStub` that extends `Promise`:

```typescript
interface IRPCStub<Fn extends (...args: any[]) => any> {
  (...args: Parameters<Fn>): IRPCReader<ReturnType<Fn>>;
  once(...args: Parameters<Fn>): IRPCReader<ReturnType<Fn>>;
  with(factory: () => Parameters<Fn>, debounce?: number): IRPCReader<ReturnType<Fn>>;
  when(factory: () => Parameters<Fn>, debounce?: number): IRPCReader<ReturnType<Fn>>;
  later(debounce?: number): IRPCReader<ReturnType<Fn>> & { dispatch: (...args: Parameters<Fn>) => void };
}
```

---

## Argument Patterns

Arguments are serialized to JSON over the wire and must be serializable.

### Single, Positional, and Object Arguments

```typescript
// Single argument
export type GetUserFn = (id: string) => Promise<User>;
export const getUser = irpc.declare<GetUserFn>('user.get', {
  seed: () => ({ id: '', name: '', email: '', role: 'member' }),
});

// Multiple positional arguments
export type UpdateRoleFn = (id: string, role: 'admin' | 'member') => Promise<User>;
export const updateRole = irpc.declare<UpdateRoleFn>('user.updateRole', {
  seed: () => ({ id: '', name: '', email: '', role: 'member' }),
});

// Structured object argument (scales for complex queries)
export interface SearchQuery {
  term: string;
  role?: 'admin' | 'member';
  limit?: number;
}
export type SearchUsersFn = (query: SearchQuery) => Promise<User[]>;
export const searchUsers = irpc.declare<SearchUsersFn>('user.search', {
  seed: () => [],
});

// Zero arguments
export type GetCurrentUserFn = () => Promise<User>;
export const getCurrentUser = irpc.declare<GetCurrentUserFn>('user.me', {
  seed: () => ({ id: '', name: '', email: '', role: 'member' }),
});
```

### Binary File Uploads (`IRPCFile`)

Pass binary files directly or nested inside objects using `IRPCFile`:

```typescript
import { irpc } from '@/src/api.js';
import { type IRPCFile } from '@irpclib/irpc';

export type UploadAvatarFn = (payload: { userId: string; avatar: IRPCFile }) => Promise<string>;
export const uploadAvatar = irpc.declare<UploadAvatarFn>('user.uploadAvatar', {
  seed: () => '',
});

// Client usage:
const file = fileInputElement.files?.[0];
if (file) {
  const payload = new IRPCFile({ name: file.name, size: file.size, type: file.type }, file);
  await uploadAvatar({ userId: 'user-123', avatar: payload });
}
```

TIP: Use **HTTP Transport** for file uploads. Browsers offload HTTP uploads to background threads, whereas large binary frames over WebSocket block concurrent socket traffic.

### Deferred File Downloads (`IRPCBlob`)

Handlers can return an `IRPCBlob` wrapper pointing to a URL or file resource. The client can await the payload or defer the binary download:

```typescript
import { irpc } from '@/src/api.js';
import { type IRPCBlob } from '@irpclib/irpc';

export type GetReportFn = (reportId: string) => Promise<IRPCBlob | undefined>;
export const getReport = irpc.declare<GetReportFn>('report.get');
```

An `IRPCBlob` is a pointer: the server never holds the binary, only the caller loads it. Give it a URL the caller can reach (a temporary signed URL, for example). Where it is made, it can't be awaited: a handler, `async` or not, returns it as is, and awaiting it on the server gives the blob back without loading anything. It becomes awaitable when it reaches the caller, remotely or in a local call, so `await getReport(id)` on the caller loads the content.

---

## Return Types & Initial Seed Data

IRPC declarations support three return structures:

```typescript
import type { RemoteState } from '@irpclib/irpc';

// Primitive synchronous value
export type GetVersionFn = () => string;

// Promise (standard unary remote call)
export type GetUserFn = (id: string) => Promise<User>;

// RemoteState (continuous reactive stream)
export type WatchPricesFn = (ticker: string) => RemoteState<number>;
export const watchPrices = irpc.declare<WatchPricesFn>('market.prices', {
  stream: true,
  seed: () => 0,
});
```

WARNING: **Always specify `{ stream: true }` when returning `RemoteState<T>`.**
Because TypeScript types are erased at runtime, `{ stream: true }` instructs the transport engine to allocate an independent streaming connection rather than batching the call into a shared unary request.

### Initial Seed Data

Pass `seed` in the options object to seed `reader.data` synchronously before the server responds:

```typescript
export const getUser = irpc.declare<GetUserFn>('user.get', {
  seed: () => ({
    id: '',
    name: 'Loading...',
    email: '',
    role: 'member',
  }),
});
```

#### Seed Requirement Rule (`IRPCSeedRequired`)

TypeScript checks the return type to determine if `seed` is required:
- **Required**: When the return type is defined and non-nullable (`Promise<User>`, `RemoteState<number>`).
- **Optional**: When the return type allows `undefined` or `void` (`Promise<User | undefined>`, `Promise<void>`, `Promise<IRPCBlob | undefined>`).

---

## Client Execution Bindings

Calling a stub directly outside of components executes the call immediately as a `Promise`:

```typescript
// Direct invocation returns IRPCReader (which extends Promise)
const user = await getUser('user-123');
```

Inside component `setup()` functions, use reactive lifecycle bindings:

### `.once(...args)`
Fires **exactly once** during component initialization on the browser. Does not track reactive dependencies.

```tsx
import { setup, Show } from '@airlib/react';
import { getAppConfig } from './function.js';

export const ConfigWidget = setup(() => {
  const config = getAppConfig.once('web');

  return () => (
    <Show when={() => config.status === 'success' && config.data} fallback={() => <div>Loading...</div>}>
      {({ version, env }) => (
        <section>
          <h2>Version: {version}</h2>
          <p>Environment: {env}</p>
        </section>
      )}
    </Show>
  );
}, 'ConfigWidget');
```

### `.with(() => args, debounce?)`
Creates an **eager reactive call**. Executes immediately and tracks any reactive signals accessed inside the arguments factory. Re-executes automatically when dependencies mutate.

```tsx
import { setup, Show } from '@airlib/react';
import { getUser } from './function.js';

export const LiveProfile = setup<{ userId: string }>((props) => {
  // Automatically re-fetches whenever props.userId changes
  const user = getUser.with(() => [props.userId], 100);

  return () => (
    <Show when={() => user.status === 'success' && user.data} fallback={() => <div>Loading profile...</div>}>
      {({ name, role }) => (
        <div>
          <h3>{name}</h3>
          <span>{role}</span>
        </div>
      )}
    </Show>
  );
}, 'LiveProfile');
```

### `.when(() => args, debounce?)`
Creates a **lazy reactive call**. Skips the initial execution on mount and executes only *after* a tracked dependency changes from its initial value.

```tsx
import { setup, mutable, $bind, Show, For } from '@airlib/react';
import { searchUsers, type User } from './function.js';

export const UserSearch = setup(() => {
  const form = mutable({ query: '' });
  // Waits until form.query changes, debouncing by 300ms
  const search = searchUsers.when(() => [{ term: form.query }], 300);

  return () => (
    <div>
      <input value={$bind(form, 'query')} placeholder="Search members..." />
      <Show when={() => search.status === 'pending'}>
        {() => <p>Searching...</p>}
      </Show>
      <Show when={() => search.status === 'success' && search.data}>
        {(users) => (
          <ul>
            <For each={() => users}>
              {(user) => <li key={user.id}>{user.name}</li>}
            </For>
          </ul>
        )}
      </Show>
    </div>
  );
}, 'UserSearch');
```

### `.later(debounce?)`
Creates a manual trigger binding. Returns an `IRPCReader` augmented with `.dispatch(...args)`. Ideal for form submissions and button clicks:

```tsx
import { setup, mutable, $bind, Show } from '@airlib/react';
import { uploadAvatar } from './function.js';
import { IRPCFile } from '@irpclib/irpc';

export const AvatarUpload = setup<{ userId: string }>((props) => {
  const uploader = uploadAvatar.later(200);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const payload = new IRPCFile({ name: file.name, size: file.size, type: file.type }, file);
      uploader.dispatch({ userId: props.userId, avatar: payload });
    }
  };

  return () => (
    <div>
      <input type="file" onChange={handleFileChange} />
      <Show when={() => uploader.status === 'pending'}>
        {() => <span>Uploading avatar...</span>}
      </Show>
      <Show when={() => uploader.status === 'success'}>
        {() => <span>Upload complete!</span>}
      </Show>
    </div>
  );
}, 'AvatarUpload');
```

---

## `IRPCReader` State & Lifecycle

Every RPC call yields an `IRPCReader<T>`, which acts as a reactive proxy with live properties:

| Property | Type | Description |
|---|---|---|
| `data` | `T` | Current reactive payload (initialized via declaration seed). |
| `status` | `'idle' \| 'pending' \| 'success' \| 'error'` | Current lifecycle stage. |
| `error` | `IRPCError \| undefined` | Populated with `type`, `code`, and `message` when `status === 'error'`. |

### Subscriptions & Cleanup

```typescript
const reader = getUser('user-123');

// Programmatic subscription
const unsubscribe = reader.subscribe((state) => {
  if (state.status === 'success') {
    console.log('User loaded:', state.data);
  }
});

// Explicit cancellation (sends cancel packet to server)
reader.close();
```

NOTE: When components unmount, any `IRPCReader` instances bound inside their `setup()` context are closed automatically.

---

## Caching, Coalescing & Resilience

Configure function options in the options object of `irpc.declare()`:

```typescript
import { z } from 'zod';

export const getUser = irpc.declare<GetUserFn>('user.get', {
  seed: () => ({ id: '', name: '', email: '', role: 'member' }),
  description: 'Fetches user details by unique identifier',
  maxAge: 60000,            // Cache responses for 60 seconds (by identical arguments)
  coalesce: true,           // Combine concurrent in-flight calls into a single execution
  standalone: false,        // If true, bypasses batching and dispatches as an independent HTTP request
  bypassLocal: false,       // If true, bypasses local handler execution and dispatches via transport
  timeout: 10000,           // Abort call if it exceeds 10 seconds
  maxRetries: 3,            // Retry attempts for transient transport failures
  retryMode: 'exponential', // 'linear' | 'exponential' backoff
  retryDelay: 1000,         // Base delay in milliseconds
  ttl: 300000,              // Maximum stream duration in milliseconds
  keepAlive: false,         // If true, stream continues indefinitely with no timeout
  schema: {                 // Runtime input and output validation
    input: [z.string().uuid()],
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['admin', 'member']),
    }),
  },
});
```

### Standalone Requests (`standalone: true`)

By default, IRPC calls initiated within the same microtask are automatically batched into a single transport request. However, operations that manage authentication or session state—such as `login` and `logout`—require an isolated HTTP request/response lifecycle so that `Set-Cookie` response headers or session cookies are applied immediately and independently of any other concurrent calls.

Setting `standalone: true` causes the stub to bypass the microtask batching window and dispatch as an individual HTTP request:

```typescript
export type LoginFn = (creds: { email: string; password: string }) => Promise<{ success: boolean; user?: { id: string; name: string } }>;
export type LogoutFn = () => Promise<void>;

// Login: standalone ensures Set-Cookie headers attach directly to this isolated response
export const login = irpc.declare<LoginFn>('auth.login', {
  standalone: true,
  seed: () => ({ success: false }),
});

// Logout: standalone ensures session clearance cookies execute immediately in an isolated request
export const logout = irpc.declare<LogoutFn>('auth.logout', {
  standalone: true,
});
```

TIP: See [Server Handlers: Reactive Cookies in Handlers](./handlers.md#reactive-cookies-in-handlers) for how the corresponding server constructor (`irpc.construct`) sets and clears cookies via `cookies()`.

### Keep-Alive Streams (`keepAlive: true`)

For persistent real-time connections (e.g. presence, rooms, or chat) that should remain open indefinitely without being terminated by default idle timeouts, set `keepAlive: true`:

```typescript
import type { RemoteState } from '@irpclib/irpc';

export type RoomPresenceFn = (roomId: string) => RemoteState<{ activeUsers: string[] }>;

// Persistent stream: keepAlive prevents idle timeout termination
export const watchPresence = irpc.declare<RoomPresenceFn>('room.presence', {
  keepAlive: true,
  seed: () => ({ activeUsers: [] }),
});
```

### Cache Invalidation

```typescript
// Invalidate a specific entry by arguments
irpc.invalidate(getUser, 'user-123');

// Invalidate all cached entries for this function
irpc.invalidate(getUser);
```

### Bypassing Local Execution (`bypassLocal: true`)

When a procedure declaration and its server constructor reside in the same runtime process (such as full-stack SSR or unit tests), IRPC executes the local handler directly in memory by default.

Setting `bypassLocal: true` forces the stub to dispatch through the configured network transport instead of invoking the local handler directly:

```typescript
export const checkout = irpc.declare<CheckoutFn>('checkout', {
  bypassLocal: true, // Forces execution through the transport (HTTP/Worker fetch)
});
```

This is particularly useful when testing complete HTTP serialization pipelines against worker instances, routing through an API gateway, or dynamically delegating execution to remote instances. Note that `bypassLocal` can also be configured globally across an entire package via `package.configure({ bypassLocal: true })` (see [Distribution](./distribution.md#the-package-system)).

---

## Naming & Organization Conventions

- **Wire Identifier**: Use dotted namespacing (`user.get`, `billing.invoice.create`). The wire name is the network protocol key and does not need to match the TypeScript export.
- **Type Naming**: `PascalCase` suffixed with `Fn` (`GetUserFn`, `WatchPricesFn`).
- **File Structure**:
  - `pages/**/function.ts`: Declarations, shared interfaces, and client-safe public stubs (`irpc.declare`).
  - `pages/**/constructor.ts`: Colocated server-only implementation handlers (`irpc.construct`).
