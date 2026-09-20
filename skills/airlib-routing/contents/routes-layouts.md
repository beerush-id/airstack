# Routes & Layouts

In AirLib, routes define URL hierarchy and navigation lifecycles, while `page()` attaches view rendering. Layouts, pages, stubs, and handlers are colocated directly inside the `pages/` directory:

- **`page.tsx` / `layout.tsx`**: UI view layer rendered by `page(route).render()`.
- **`route.ts`**: Route lifecycle, guards, data providers, and options (managed by `airPages()`).
- **`function.ts`**: Colocated client-safe IRPC procedure stubs (`irpc.declare()`).
- **`constructor.ts`**: Colocated server implementation handlers (`irpc.construct()`).

---

## 1. Layouts & Pages

### Layout Routes (Persistent Shells)

Layouts wrap child views and remain mounted during navigation between nested routes. Project child views using `{ children }`:

#### React
```tsx
// pages/users/layout.tsx
import { page } from '@airlib/react';
import route from './route.js';

export default page(route).render(({ children }) => {
  return () => (
    <div className="users-shell">
      <nav className="users-nav">
        <a href="/users">All Users</a>
        <a href="/users/new">Create User</a>
      </nav>
      <main>{children}</main>
    </div>
  );
});
```

#### SolidJS
```tsx
// pages/users/layout.tsx
import { page } from '@airlib/solid';
import route from './route.js';

export default page(route).render(({ children }) => (
  <div class="users-shell">
    <nav class="users-nav">
      <a href="/users">All Users</a>
      <a href="/users/new">Create User</a>
    </nav>
    <main>{children}</main>
  </div>
));
```

When navigating between child routes under `/users` (e.g. `/users` to `/users/42`), the `UsersLayout` stays mounted. Only the child view inside `{ children }` updates, preventing layout flashes and preserving scroll position or component state.

### Leaf Pages (Terminal Views)

Leaf pages sit at the end of a path branch and render the specific view content:

#### React
```tsx
// pages/users/page.tsx (Index page for /users)
import { Head, page } from '@airlib/react';
import route from './route.js';

export default page(route).render(() => {
  return () => (
    <>
      <Head meta={{ title: 'Users | AirLib' }} />
      <h1>User Directory</h1>
    </>
  );
});
```

#### SolidJS
```tsx
// pages/users/page.tsx (Index page for /users)
import { Head, page } from '@airlib/solid';
import route from './route.js';

export default page(route).render(() => (
  <>
    <Head meta={{ title: 'Users | AirLib' }} />
    <h1>User Directory</h1>
  </>
));
```

---

## 2. Accessing Route State & Parameters

The `.render()` callback receives three arguments:

```typescript
page(route).render(({ state, context, children }) => {
  // Setup logic (runs once on mount)
});
```

| Parameter | Type | Description |
|---|---|---|
| `context.params` | `Record<string, string>` | Dynamic route parameters extracted from the URL path (e.g. `context.params.user_id`). |
| `context.query` | `Record<string, string>` | Current URL search query parameters (e.g. `context.query.sort`). |
| `state.resolving` | `Set<string>` | Set of provider keys currently resolving in the background (e.g. `state.resolving.has('profile')`). |
| `state.data` | `Record<string, any>` | Data resolved by data providers declared on this route via `.provide()`. |
| `state.error` | `Error \| undefined` | Active error if a guard or data provider fails. |
| `children` | `Node` | Rendered output of child routes (available in layouts). |

### Reactivity Model: React vs SolidJS

- **React:** `.render()` follows AirLib's two-phase `setup` architecture. The outer callback is the setup phase, which runs only once when the route mounts. You **must return a render function** (`return () => (...)`). Reading `context.params`, `context.query`, or `state` inside this render closure registers a reactive dependency so the view re-renders whenever parameters or data change.
- **SolidJS:** Solid's JSX compiler wraps expressions in reactive computations automatically, so the callback returns JSX directly without a secondary closure.

### Reading Dynamic Parameters

For parameterized routes (e.g. `pages/users/[user_id]/page.tsx` matching `/users/:user_id`):

#### React
```tsx
// pages/users/[user_id]/page.tsx
import { page } from '@airlib/react';
import route from './route.js';

export default page(route).render(({ context }) => {
  return () => (
    <div>
      <h1>User Profile: {context.params.user_id}</h1>
    </div>
  );
});
```

#### SolidJS
```tsx
// pages/users/[user_id]/page.tsx
import { page } from '@airlib/solid';
import route from './route.js';

export default page(route).render(({ context }) => (
  <div>
    <h1>User Profile: {context.params.user_id}</h1>
  </div>
));
```

---

## 3. Modal Routes (`modal()`)

When a route should render as an overlay floating on top of the current page rather than swapping out page content, wrap the route with `modal()` instead of `page()`:

```typescript
// pages/users/invite/route.ts
import usersRoute from '../route.js';

/** AirLib managed */
const route = usersRoute.route('/invite');
const indexRoute = route.route('/');
/** AirLib managed */

export const userInviteRoute = route;
export const userInviteIndexRoute = indexRoute;

export default userInviteRoute;
```

#### React
```tsx
// pages/users/invite/page.tsx
import { modal, navigate } from '@airlib/react';
import userInviteRoute from './route.js';
import usersRoute from '../route.js';

export const UserInviteModal = modal(userInviteRoute).render(() => {
  const handleClose = () => navigate(usersRoute);

  return () => (
    <dialog open className="modal-backdrop">
      <div className="modal-content">
        <h2>Invite Team Member</h2>
        <button onClick={handleClose}>Close</button>
      </div>
    </dialog>
  );
});

export default UserInviteModal;
```

#### SolidJS
```tsx
// pages/users/invite/page.tsx
import { modal, navigate } from '@airlib/solid';
import userInviteRoute from './route.js';
import usersRoute from '../route.js';

export const UserInviteModal = modal(userInviteRoute).render(() => {
  const handleClose = () => navigate(usersRoute);

  return (
    <dialog open class="modal-backdrop">
      <div class="modal-content">
        <h2>Invite Team Member</h2>
        <button onClick={handleClose}>Close</button>
      </div>
    </dialog>
  );
});

export default UserInviteModal;
```

- **DOM Preservation:** The underlying page and its layout remain mounted in the DOM without unmounting or resetting local state.
- **Top-Level Reactive Stack:** `<UIRouter>` mounts the modal into an isolated top-level overlay stack above the main application tree.
- **Full Route Capabilities:** Like `page()` routes, modal routes support shareable URLs, browser back/forward history, guards, and data providers.

---

## 4. Independent Route Trees (Group Routes)

When a section of the application requires an isolated layout shell that should not inherit the root layout or root guards (e.g. authentication screens, marketing landing pages, or documentation):

### Using Group Folders (`pages/(group)/`)

Group folders (names wrapped in parentheses, like `pages/(docs)/` or `pages/(auth)/`) define independent route trees:
- `pages/(docs)/layout.tsx` wraps only routes within `(docs)/`.
- Routes inside `(docs)/` do not inherit or render inside the root `pages/layout.tsx` shell.
- The URL path retains the segment without parentheses: `pages/(docs)/routing/page.tsx` maps to `/docs/routing`.

---

## 5. Route Options & Behavioral Flags

Attach configuration options to a route definition to control its caching, preloading, and lifecycle behavior:

```typescript
// Attached to route definitions
export const profileRoute = usersRoute.route('/:user_id', {
  keepAlive: true,          // Retain route state in memory when navigating away
  preloadMode: 'hover',     // Preload data providers when user hovers a <Link>
  maxAge: 60000,            // Cache data provider results for 60 seconds
});
```

### State Retention (`keepAlive`)

Setting `keepAlive: true` preserves the route's in-memory reactive state and provider data when navigating away. When the user returns to the route, state is retained rather than re-initializing from scratch.

---

## 6. Static Pre-Rendering (SSG) & Incremental Regeneration (ISR)

Routes can be pre-rendered to static HTML instead of rendering dynamically on each request:

### Build-Time Static Generation (SSG)

For static pages known at build time (e.g. documentation, marketing pages), mark the route `static` in its generated `route.ts`:

```typescript
// pages/docs/route.ts
export const docsRoute = route.config({ static: true });
```

To pre-render all discoverable static routes across the entire application, set `static: true` on the router:

```typescript
// src/router.ts
export const router = createRouter<ReactNode>({
  static: true,
});
```

### On-Demand Pre-Rendering & ISR

Dynamic routes (e.g. `/products/:id`) cannot be enumerated at build time. Marking a dynamic route `static` pre-renders each URL on its first request and caches the rendered HTML:

```typescript
// pages/products/[id]/route.ts
export const productsDynamicRoute = route.config({
  static: { maxAge: 3600 }, // Revalidate after 3600 seconds
});
```

- **First request**: Renders HTML on the initial hit and caches it. Subsequent requests are served directly from cache without re-rendering.
- **Cache revalidation (`maxAge`)**: When requests arrive after `maxAge` seconds, the cached HTML is served while re-rendering in the background.

---

## 7. Zero-JavaScript Output (`noscript`)

To eliminate client JavaScript bundles and hydration scripts, enable `noscript` per-route or site-wide:

### Per-Route Zero-JS

To ship pure static HTML for a specific page without client hydration scripts, set `noscript: true` in its `route.ts`:

```typescript
// pages/about/route.ts
export const aboutRoute = route.config({ noscript: true });
```

### Site-Wide Zero-JS

For entirely static documentation portals or marketing sites, enable `noscript` globally in `vite.config.ts`:

```typescript
// vite.config.ts
import { airPages } from '@airlib/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [airPages({ noscript: true })],
});
```

---

## 8. Error Boundaries

### Per-Route Error Boundary

Catch errors within a specific route subtree without unmounting parent layouts:

```tsx
// Catch errors on a specific route
usersRoute.catch((error) => (
  <div className="users-error">
    <h2>Failed to load users section</h2>
    <p>{error.message}</p>
  </div>
));
```

### Global Error Boundary

Handle 404 unmatched URLs and unhandled exceptions globally via `router.catch()`:

```tsx
import { router } from '../src/router.js';

router.catch(() => (
  <div className="error-page">
    <h1>404 - Not Found</h1>
    <p>The requested page does not exist.</p>
  </div>
));
```

---

## 9. Low-Level Router Initialization (`src/router.ts`)

In an AirLib application, router initialization is pre-configured in `src/router.ts` and mounted automatically in `src/app.tsx`. Global options can be adjusted here:

```typescript
// src/router.ts
import { createRouter } from '@airlib/react'; // or '@airlib/solid'
import type { ReactNode } from 'react';

export const router = createRouter<ReactNode>({
  static: true,  // Pre-render entire site at build time (SSG)
  maxAge: 60000, // Default provider cache time in ms
});

export default router;
```
