# Standardized CRUD & Driver Adapters

Writing repetitive remote functions for database entities (`get`, `create`, `update`, `delete`) introduces unnecessary boilerplate. IRPC provides a specialized **CRUD module** that declares all four operations simultaneously and connects them to database drivers using a Chain of Responsibility adapter.

---

## 1. Declaring CRUD Entities

Use `irpc.crud<T>()` to declare an entity. This generates four typed stubs (`get`, `create`, `update`, `delete`) sharing a common wire prefix:

```typescript
// pages/users/function.ts
import { irpc } from '@/src/api.js';

export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Declares CRUD stubs:
 * - users.get: (id: string) => Promise<User>
 * - users.create: (data: Partial<User>) => Promise<User>
 * - users.update: (id: string, data: Partial<User>) => Promise<User>
 * - users.delete: (id: string) => Promise<void>
 */
export const users = irpc.crud<User>('users', () => ({
  id: '',
  name: '',
  email: '',
}), {
  maxAge: 60000,            // Cache duration applied specifically to get operations
  coalesce: true,           // Deduplicate concurrent get calls
  standalone: false,        // Dispatch operations as standalone requests if set to true
  timeout: 10000,           // Request timeout in milliseconds
  maxRetries: 3,            // Retry attempts on network/transient failures
  retryMode: 'exponential', // 'linear' | 'exponential' backoff
  retryDelay: 1000,         // Base retry interval in milliseconds
  schema: {
    create: { input: [UserCreateSchema] },
    update: { input: [UserUpdateSchema] },
  },
});
```

### Primary Key Identifier (`key`)

By default, CRUD operations use `'id'` as the primary key property. When working with databases or entities that use an alternative identifier (such as `'uuid'`, `'slug'`, or `'_id'`), define `key` in the package configuration:

```typescript
export const irpc = irpcPackage({
  name: 'store',
  version: '1.0.0',
  key: '_id', // Primary key field name across all CRUD entities in this package
});
```

The resolved `meta.key` is passed down to all driver adapter methods (`get`, `update`, `delete`) to construct SQL queries or database lookups dynamically.

### Excluding Operations

When an entity should be read-only or restricted, wrap the declaration with `irpc.exclude()` to drop unneeded operations:

```typescript
// pages/audit/function.ts
import { irpc } from '@/src/api.js';

export interface AuditLog {
  id: string;
  action: string;
  timestamp: number;
}

// Drops update and delete stubs from the exported object
export const auditLogs = irpc.exclude(
  irpc.crud<AuditLog>('auditLogs', () => ({ id: '', action: '', timestamp: 0 })),
  ['update', 'delete']
);
```

### Spec Hooks on CRUD Entities

Attach isomorphic hooks to the entire entity group or to specific stubs:

```typescript
// pages/users/function.ts
import { irpc } from '@/src/api.js';
import { getContext } from '@irpclib/irpc';

// Hook applied to all operations (get, create, update, delete)
irpc.hook(users, async () => {
  const token = getContext<string>('token');
  if (!token) throw new Error('Unauthorized');
});

// Hook applied exclusively to the delete operation
irpc.hook(users.delete, async () => {
  const user = getContext<User>('user');
  if (user?.role !== 'admin') throw new Error('Forbidden: Admin access required');
});
```

---

## 2. Client Consumption

Because the generated operations are standard `IRPCStub`s, they support the exact same reactive bindings:

```tsx
// pages/users/page.tsx
import { setup, Show } from '@airlib/react';
import { users, type User } from './function.js';

export const UserProfile = setup<{ id: string }>((props) => {
  // Reactive fetch binding
  const user = users.get.with(() => [props.id]);

  const handleUpdate = async (newName: string) => {
    // Direct imperative mutation
    await users.update(props.id, { name: newName });
  };

  return () => (
    <Show when={() => user.status === 'success' && user.data} fallback={() => <div>Loading...</div>}>
      {({ name, email }) => (
        <div>
          <h1>{name}</h1>
          <p>{email}</p>
          <button onClick={() => handleUpdate('New Name')}>Update Name</button>
        </div>
      )}
    </Show>
  );
}, 'UserProfile');
```

---

## 3. The Driver Contract (`IRPCCrudDriver`)

A driver implements generic persistence logic. Every driver method receives an `IRPCCrudMeta` descriptor identifying the target entity:

```typescript
// src/drivers/database.ts
import { IRPCCrudDriver, type IRPCCrudMeta } from '@irpclib/irpc';
import { db } from '@/src/lib/database.js';

export class PostgresCrudDriver extends IRPCCrudDriver {
  async get(meta: IRPCCrudMeta, id: string) {
    return db.query(`SELECT * FROM ${meta.name} WHERE ${meta.key} = $1`, [id]);
  }

  async create(meta: IRPCCrudMeta, data: unknown) {
    return db.insert(meta.name, data);
  }

  async update(meta: IRPCCrudMeta, id: string, data: unknown) {
    return db.update(meta.name, id, data);
  }

  async delete(meta: IRPCCrudMeta, id: string) {
    return db.delete(meta.name, id);
  }
}
```

### The `IRPCCrudMeta` Object

| Field | Type | Description |
|---|---|---|
| `name` | `string` | The entity name provided in `irpc.crud()` (e.g. `'users'`). |
| `key` | `string` | Primary key identifier (defaults to `'id'`). |
| `description` | `string \| undefined` | Resolved description for this method. |
| `schema` | `object \| undefined` | Resolved input/output validation schema for this method. |
| `maxAge` | `number \| undefined` | Cache duration in milliseconds (applied to `get`). |
| `coalesce` | `boolean \| undefined` | Request deduplication setting. |
| `timeout` | `number \| undefined` | Call timeout in milliseconds. |
| `maxRetries` | `number \| undefined` | Maximum retry attempts. |
| `retryMode` | `'linear' \| 'exponential' \| undefined` | Backoff strategy. |
| `retryDelay` | `number \| undefined` | Base retry delay in milliseconds. |
| `standalone` | `boolean \| undefined` | Standalone request dispatch flag. |

---

## 4. Wiring the Adapter (`IRPCCrudAdapter`)

In your server constructor setup, instantiate an `IRPCCrudAdapter`, register drivers, and attach entities:

```typescript
// pages/users/constructor.ts
import { IRPCCrudAdapter } from '@irpclib/irpc';
import { irpc } from '@/src/api.js';
import { users } from './function.js';
import { PostgresCrudDriver } from '@/src/drivers/database.js';

const adapter = new IRPCCrudAdapter(irpc);

// 1. Register generic driver
adapter.use(new PostgresCrudDriver());

// 2. Attach entity — connects get, create, update, delete automatically
adapter.attach(users);
```

### Granular Attachment

Route specific operations to specialized drivers (e.g. read replica vs primary database):

```typescript
const readAdapter = new IRPCCrudAdapter(irpc);
readAdapter.use(new ReadReplicaDriver());
readAdapter.attach({ get: users.get });

const writeAdapter = new IRPCCrudAdapter(irpc);
writeAdapter.use(new PrimaryWriterDriver());
writeAdapter.attach({ create: users.create, update: users.update, delete: users.delete });
```

---

## 5. Chain of Responsibility & Caching

The adapter evaluates registered drivers sequentially. A driver can either return the result or throw `IRPCCrudAdapter.next()` to pass execution to the next driver in the chain:

```typescript
// src/drivers/cache.ts
import { IRPCCrudAdapter, IRPCCrudDriver, type IRPCCrudMeta } from '@irpclib/irpc';
import { redis } from '@/src/lib/redis.js';

export class RedisCacheDriver extends IRPCCrudDriver {
  // Only override the methods you care to intercept
  async get(meta: IRPCCrudMeta, id: string) {
    const cached = await redis.get(`${meta.name}:${id}`);
    if (cached) {
      return JSON.parse(cached); // Cache hit terminates the chain
    }

    // Cache miss: delegate to the next registered driver
    throw IRPCCrudAdapter.next();
  }
}
```

```typescript
// pages/users/constructor.ts
const adapter = new IRPCCrudAdapter(irpc);

// Redis evaluates first; falls back to Postgres on cache miss
adapter.use(new RedisCacheDriver());
adapter.use(new PostgresCrudDriver());

adapter.attach(users);
```

---

## 6. Extending Adapter & Driver with Custom Methods

To add operations beyond standard CRUD (e.g., `list` with filtering), extend both driver and adapter:

### 1. Add Method to Driver

```typescript
export class PostgresCrudDriver extends IRPCCrudDriver {
  async list(meta: IRPCCrudMeta, filter: { status?: string }) {
    return db.query(`SELECT * FROM ${meta.name} WHERE status = $1`, [filter.status]);
  }
}
```

### 2. Extend Adapter

```typescript
import { IRPCCrudAdapter, type IRPCCrudMeta } from '@irpclib/irpc';

export class ExtendedAdapter extends IRPCCrudAdapter {
  async list(meta: IRPCCrudMeta, filter: unknown) {
    return this.dispatch('list', meta, filter);
  }
}
```

### 3. Declare and Attach Stub

```typescript
// pages/users/function.ts
export const users = {
  ...irpc.crud<User>('users', () => ({ id: '', name: '', email: '' })),
  list: irpc.declare<(filter: { status?: string }) => Promise<User[]>>('users.list', {
    seed: () => [],
  }),
};
```

```typescript
// pages/users/constructor.ts
const adapter = new ExtendedAdapter(irpc);
adapter.use(new PostgresCrudDriver());

// Attach CRUD group
adapter.attach(users);

// Attach custom list stub specifically to the 'list' driver method
adapter.attach(users.list, 'list');
```

---

## 7. Manual Construction Fallback

When an operation requires custom logic that does not fit generic driver operations, construct that stub directly using `irpc.construct()`:

```typescript
// pages/users/constructor.ts
import { irpc } from '@/src/api.js';
import { users } from './function.js';
import { db } from '@/src/lib/database.js';

// Manually override the get operation
irpc.construct(users.get, async (id: string) => {
  return db.query('SELECT * FROM users WHERE id = $1 AND is_deleted = false', [id]);
});
```
