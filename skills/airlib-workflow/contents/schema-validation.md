# Workflow Schema Validation

This guide establishes how to enforce runtime data boundaries and infer strict TypeScript types across AirLib Workflows using Zod, Valibot, or duck-typed validators.

---

## Pipeline Boundary Validation

Provide `input` and `output` schemas to `plan()` to validate the entry and exit points of the entire pipeline. The input type is automatically inferred from the `input` schema, and schema transformations (such as `.default()`) are applied before the first step executes:

```typescript
import { plan } from '@irpclib/irpc';
import { z } from 'zod';

const userSchema = z.object({
  id: z.string(),
  isActive: z.boolean().default(true),
});

const createUserFlow = plan({
  input: userSchema,
  output: z.object({ success: z.boolean() }),
})
  .then((user) => {
    // `user` is strictly typed as { id: string; isActive: boolean }
    // Schema defaults are applied before execution
    return { success: true };
  });

irpc.construct(createUser, (id, isActive) => {
  return createUserFlow({ id, isActive });
});
```

#### React
```tsx
import { setup } from '@airlib/react';
import { createUser } from './function.js';

export const UserCreator = setup(() => {
  const task = createUser.later();

  return () => (
    <button
      onClick={() => task.dispatch('user_123', true)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Creating...' : 'Create User'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { createUser } from './function.js';

export const UserCreator = setup(() => {
  const task = createUser.later();

  return () => (
    <button
      onClick={() => task.dispatch('user_123', true)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Creating...' : 'Create User'}
    </button>
  );
});
```

---

## Step Boundary Validation

Enforce validation at individual step boundaries to guarantee intermediate operations have not corrupted or malformed the accumulated state:

```typescript
import { plan } from '@irpclib/irpc';
import { z } from 'zod';

const secureFlow = plan({ input: z.object({ query: z.string() }) })
  .then(
    async (input) => {
      const results = await db.search(input.query);
      return { ...input, results };
    },
    { output: z.object({ query: z.string(), results: z.array(z.any()).max(100) }) }
  );

irpc.construct(searchData, (query) => secureFlow({ query }));
```

#### React
```tsx
import { setup } from '@airlib/react';
import { searchData } from './function.js';

export const SearchBar = setup(() => {
  const task = searchData.later();

  return () => (
    <button
      onClick={() => task.dispatch('test query')}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Searching...' : 'Search'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { searchData } from './function.js';

export const SearchBar = setup(() => {
  const task = searchData.later();

  return () => (
    <button
      onClick={() => task.dispatch('test query')}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Searching...' : 'Search'}
    </button>
  );
});
```
