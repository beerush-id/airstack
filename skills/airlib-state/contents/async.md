# Asynchronous State & Queries

Handling asynchronous operations in state-driven applications typically requires manual juggling of loading flags, error objects, race conditions, and cancellation signals.

AirLib provides a single, unified primitive for asynchronous state: **`query()`**. It wraps any Promise-returning function (such as external `fetch` calls, third-party async SDKs, or browser Web APIs) into a deeply reactive container with built-in status tracking and automatic request cancellation.

NOTE: AirLib's IRPC stubs already provide built-in reactive bindings (`.with()`, `.when()`) and status tracking (`.status`, `.data`, `.error`). Do NOT wrap IRPC stubs in `query()`. Use `query()` specifically for non-IRPC asynchronous operations.

---

## Creating a Reactive Query (`query`)

`query(asyncFn, initialData, options?)` accepts an asynchronous executor receiving an `AbortSignal`, plus a structural initial data object:

```ts
import { query } from '@airlib/react'; // or '@airlib/solid'

export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Loads external user profile data with automatic reactive status tracking.
 */
export const userQuery = query(
  async (signal) => {
    const res = await fetch('https://api.example.com/user/me', { signal });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json() as Promise<User>;
  },
  { id: '', name: '', email: '' } // Structural initial shape
);
```

### Reactive Properties & Controls

| Property / Method | Type | Concern / Purpose |
|---|---|---|
| `query.data` | `T` | The reactive result. Mirrors `initialData` until resolved. |
| `query.status` | `'idle' \| 'pending' \| 'success' \| 'error'` | Reactive status enum for UI branching. |
| `query.error` | `Error \| undefined` | Populated when the operation fails or is aborted. |
| `query.promise` | `Promise<T>` | Active promise for sequential `await` or SSR route loaders. |
| `query.start(initial?)` | `() => Promise<T>` | Triggers execution; cancels any existing in-flight request. |
| `query.abort()` | `() => void` | Manually cancels in-flight operation via the `AbortSignal`. |

---

## Rendering Async UI by Status

Because `status` and `data` are reactive proxies, components re-render with fine granularity as network states transition:

```tsx
import { setup, Show, query } from '@airlib/react'; // or '@airlib/solid'

export const UserProfileView = setup(() => {
  const profile = query(
    async (signal) => {
      const res = await fetch('https://api.example.com/user', { signal });
      return res.json();
    },
    { name: '', email: '' }
  );

  return () => (
    <div className="profile-card">
      <Show when={() => profile.status === 'pending'}>
        {() => <p>Loading profile...</p>}
      </Show>
      <Show when={() => profile.status === 'error' && profile.error}>
        {({ message }) => <p className="error">{message}</p>}
      </Show>
      <Show when={() => profile.status === 'success' && profile.data}>
        {({ name, email }) => (
          <div>
            <h2>{name}</h2>
            <p>{email}</p>
          </div>
        )}
      </Show>
    </div>
  );
}, 'UserProfileView');
```

---

## Structural Initial Data (No Optional Chaining)

Always pass a structural initial data template that mirrors the resolved data shape. This guarantees that deep property access is always safe without repetitive optional chaining (`user?.profile?.name`):

```ts
// Structural initial shape guarantees safe access immediately
export const projectQuery = query(
  async (signal) => {
    const res = await fetch('/api/project', { signal });
    return res.json();
  },
  { title: '', members: [] as string[] }
);

// Safe to read synchronously in render functions
console.log(projectQuery.data.members.length); // 0 while pending, updates on success
```

---

## Deferred Execution & Manual Triggering

By default, queries run immediately when declared in the browser. To wait for user action (e.g. clicking a button or submitting a search), set `deferred: true`:

```ts
import { query } from '@airlib/react'; // or '@airlib/solid'

export const searchResults = query(
  async (signal) => {
    const res = await fetch(`/api/search?q=${searchFilter.query}`, { signal });
    return res.json();
  },
  [],
  { deferred: true }
);

// Triggers execution on demand
export function performSearch() {
  searchResults.start();
}
```

---

## Automatic Cancellation & Search-As-You-Type

Calling `start()` while a query is already in-flight automatically aborts the prior request via its `AbortSignal`. Combining a deferred query with `effect()` gives automatic search-as-you-type with zero race conditions:

```ts
import { mutable, query, effect } from '@airlib/react'; // or '@airlib/solid'

export const searchQuery = mutable('');

export const instantSearch = query(
  async (signal) => {
    const res = await fetch(`https://api.example.com/items?q=${encodeURIComponent(searchQuery.value)}`, { signal });
    return res.json();
  },
  [],
  { deferred: true }
);

// Automatically triggers search and cancels outdated in-flight requests
effect(() => {
  if (searchQuery.value.trim().length > 0) {
    instantSearch.start();
  }
});
```

---

## Optimistic Updates (`undoable`)

`undoable` creates an isolated transaction boundary around state mutations. When invoked, it takes an instant snapshot of the affected state and returns `[undo, commit]`:

- **Instant mutations**: The UI updates immediately without waiting for a server round-trip.
- **Rollback on failure**: Calling `undo()` rolls back the exact mutated state to its pre-transaction values.
- **Commit on success**: Calling `commit()` seals the change and discards the undo snapshot.

#### React
```tsx
import { mutable, setup, undoable } from '@airlib/react';

const LikeButton = setup(() => {
  const post = mutable({ id: '101', liked: false, likes: 42 });

  const handleLike = async () => {
    // 1. Optimistic snapshot and mutation
    const [undo, commit] = undoable(() => {
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
    });

    try {
      await api.likePost(post.id);
      commit();
    } catch (err) {
      // 2. Automatically restore pre-mutation state on failure
      undo();
    }
  };

  return (
    <button type="button" onClick={handleLike}>
      {post.liked ? '♥' : '♡'} {post.likes}
    </button>
  );
});
```

#### SolidJS
```tsx
import { mutable, setup, undoable } from '@airlib/solid';

const LikeButton = setup(() => {
  const post = mutable({ id: '101', liked: false, likes: 42 });

  const handleLike = async () => {
    const [undo, commit] = undoable(() => {
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
    });

    try {
      await api.likePost(post.id);
      commit();
    } catch (err) {
      undo();
    }
  };

  return (
    <button type="button" onClick={handleLike}>
      {post.liked ? '♥' : '♡'} {post.likes}
    </button>
  );
});
```

---

## SSR & Server-Side Integration (`query.promise`)

Queries only auto-start in the **browser**. During Server-Side Rendering (SSR), queries stay in the `'pending'` or `'idle'` state to avoid uncontrolled background promises and server memory leaks.

When data is required on the server (e.g., inside an IRPC route provider or server loader), await `query.promise`:

```ts
import { query } from '@airlib/react';

export async function preloadUser(userId: string) {
  const user = query(
    async (signal) => {
      const res = await fetch(`https://api.internal/users/${userId}`, { signal });
      return res.json();
    },
    { id: '', name: '' }
  );

  // Await the active promise during SSR before returning the rendered tree
  await user.promise;

  return user.data;
}
```
