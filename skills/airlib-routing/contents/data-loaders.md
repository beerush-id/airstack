# Data Loaders & Providers

Providers act as the data fetching and dependency injection layer for routes. They execute out-of-band during the navigation cycle—after guards pass, but before the UI component mounts. This eliminates render waterfalls and loading skeleton spin-cycles.

---

## 1. Declaring Data Providers (`.provide`)

Attach data fetchers to a route using `.provide()`. Each provider takes a unique property key and an asynchronous loader function.

### Preferred: Type-Safe IRPC Remote Functions

In AirLib applications, using IRPC remote functions is the preferred, type-safe pattern. Return types and parameters are automatically inferred across the client-server boundary without manual type annotations.

Procedure stubs sit in `function.ts` and can be placed at any directory level depending on scope:
- **Leaf Route**: Placed in the route folder (`pages/users/[user_id]/function.ts`), imported via `./function.js`.
- **Section-Shared**: Placed in a parent folder (e.g. `pages/users/function.ts`), imported by child routes via `../function.js`.
- **Global / App-Wide**: Placed at `pages/function.ts` (imported via `@/pages/function.js`) or `src/` (imported via `@/src/api.js`).

Server handlers are implemented in corresponding colocated `constructor.ts` files.

```typescript
// pages/users/[user_id]/route.ts
import { getUserProfile } from './function.js';
import usersRoute from '../route.js';

/** AirLib managed */
const route = usersRoute.route('/:user_id');
const indexRoute = route.route('/');
/** AirLib managed */

export const profileRoute = route.provide('profile', async ({ params }) => {
  return getUserProfile({ id: params.user_id });
});
export const profileIndexRoute = indexRoute;

export default profileRoute;
```

The resolved data is bound to `state.data.profile`, fully typed with end-to-end schema inference.

### External Fetch & Third-Party APIs

For external services or third-party APIs, standard `fetch()` is fully supported:

```typescript
export const weatherRoute = route.provide('weather', async ({ params }) => {
  const res = await fetch(`https://api.weather.com/v1/${params.city}`);
  if (!res.ok) throw new Error('Failed to fetch weather data');
  return res.json() as Promise<{ temp: number; condition: string }>;
});
```

---

## 2. Consuming Provider Data in UI

Because routes wait for providers to resolve before initial navigation completes, the page component never mounts in an unloaded state. When data reloads in the background (such as reactive re-evaluations or refetches), use `state.resolving.has('key')` to display non-blocking reloading feedback:

#### React
```tsx
// pages/users/[user_id]/page.tsx
import { page, Show } from '@airlib/react';
import profileRoute from './route.js';

export const ProfilePage = page(profileRoute).render(({ state }) => {
  return () => (
    <div>
      {/* Background reload indicator */}
      <Show when={() => state.resolving.has('profile')}>
        <div className="refresh-indicator">Updating profile...</div>
      </Show>

      <Show when={() => state.data.profile}>
        {({ name, email }) => (
          <article>
            <h1>{name}</h1>
            <p>{email}</p>
          </article>
        )}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
// pages/users/[user_id]/page.tsx
import { page, Show } from '@airlib/solid';
import profileRoute from './route.js';

export const ProfilePage = page(profileRoute).render(({ state }) => (
  <div>
    {/* Background reload indicator */}
    <Show when={state.resolving.has('profile')}>
      <div class="refresh-indicator">Updating profile...</div>
    </Show>

    <Show when={state.data.profile}>
      {(profile) => (
        <article>
          <h1>{profile.name}</h1>
          <p>{profile.email}</p>
        </article>
      )}
    </Show>
  </div>
));
```

---

## 3. Provider Context Arguments

The loader callback receives an activation context object:

| Property | Type | Description |
|---|---|---|
| `params` | `InferParams` | Parsed URL dynamic path parameters (e.g. `{ user_id: '42' }`). |
| `query` | `InferQuery` | Parsed URL query string parameters (e.g. `{ page: '1' }`). |
| `data` | `ProviderContext` | Data resolved by earlier providers in the current route chain. |
| `url` | `string` | The complete URL matching this route. |

---

## 4. Dependent Provider Chaining

Chain multiple `.provide()` calls sequentially on a route. Downstream providers receive the resolved results of upstream providers via the `data` parameter:

```typescript
// pages/users/[user_id]/route.ts
import { getUser, getUserOrders } from './function.js';

export const userDetailRoute = route
  // 1. First provider fetches the core user record
  .provide('user', async ({ params }) => {
    return getUser({ id: params.user_id });
  })
  // 2. Second provider consumes the upstream user result
  .provide('orders', async ({ data }) => {
    return getUserOrders({ customerId: data.user.customerId });
  });
```

Providers run in strict order of declaration. If an upstream provider fails or throws, downstream providers do not execute.

---

## 5. Reactive Re-evaluation

Providers run inside reactive observers. If a provider reads global reactive state (an AirLib `mutable` or signal), the router automatically re-executes the provider whenever that state mutates:

```typescript
// pages/products/route.ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'
import { getProducts } from './function.js';
import rootRoute from '../route.js';

export const filterState = mutable({
  category: 'all',
  sortBy: 'date',
});

/** AirLib managed */
const route = rootRoute.route('/products');
const indexRoute = route.route('/');
/** AirLib managed */

export const productsRoute = route.provide('products', async () => {
  // Automatically re-fetches when filterState.category or sortBy changes
  return getProducts({
    category: filterState.category,
    sort: filterState.sortBy,
  });
});

export default productsRoute;
```

---

## 6. Caching & Retries

### Cache Lifetime (`maxAge`)

Configure `maxAge` in `route.config()` to reuse provider data on subsequent visits with identical route parameters:

```typescript
// pages/analytics/route.ts
export const analyticsRoute = route.config({
  maxAge: 60000, // Cache for 60 seconds
});
```

Or set a global cache lifetime across all routes when creating the router:

```typescript
import { createRouter, MAX_AGE } from '@airlib/react'; // or '@airlib/solid'

export const router = createRouter({
  maxAge: MAX_AGE.DAY, // 24-hour cache duration
});
```

### Automatic Network Retries

Configure retry attempts and backoff delays for transient failures in `route.config()`:

```typescript
// pages/reports/[id]/route.ts
export const reportRoute = route.config({
  maxRetries: 3,            // Retry up to 3 times
  retryDelay: 1000,         // Wait 1 second before first retry
  retryMode: 'exponential', // Exponential backoff (1s, 2s, 4s)
});
```

---

## 7. `state.data` vs. `context.data`

Inside the `.render()` callback, data is available at two scopes:

1. **`state.data` (Route-Local):** Contains only data resolved by providers attached directly to *this specific route segment*.
2. **`context.data` (Tree-Merged):** Contains merged data resolved across all active parent layouts and descendant routes in the current route tree.

#### React
```tsx
export const ProfilePage = page(profileRoute).render(({ state, context }) => {
  return () => (
    <div>
      {/* Local provider data */}
      <h2>{state.data.profile?.name}</h2>

      {/* Parent layout provider data (e.g. workspace settings) */}
      <span>Workspace: {context.data.organization?.title}</span>
    </div>
  );
});
```

#### SolidJS
```tsx
export const ProfilePage = page(profileRoute).render(({ state, context }) => (
  <div>
    {/* Local provider data */}
    <h2>{state.data.profile?.name}</h2>

    {/* Parent layout provider data (e.g. workspace settings) */}
    <span>Workspace: {context.data.organization?.title}</span>
  </div>
));
```
