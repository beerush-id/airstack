# Guards & Authentication

Guards ensure components never mount in an unauthorized or invalid state. By evaluating conditions outside the UI render cycle, guards decouple business validation—such as user authentication, role permissions, and feature flags—from component render functions.

---

## 1. Declaring Route Guards

Attach one or more guards to a route using `.guard()`. A guard is a synchronous or asynchronous function that checks access conditions before the route can activate:

#### React
```typescript
// pages/dashboard/route.ts
import { redirect } from '@airlib/react';
import rootRoute from '../route.js';
import { loginRoute } from '../auth/route.js';

/** AirLib managed */
const route = rootRoute.route('/dashboard');
const indexRoute = route.route('/');
/** AirLib managed */

export const dashboardRoute = route.guard(async () => {
  const user = await getAuthenticatedUser();
  if (!user) {
    // Halts navigation and redirects to login
    throw redirect(loginRoute);
  }
});
export const dashboardIndexRoute = indexRoute;

export default dashboardRoute;
```

#### SolidJS
```typescript
// pages/dashboard/route.ts
import { redirect } from '@airlib/solid';
import rootRoute from '../route.js';
import { loginRoute } from '../auth/route.js';

/** AirLib managed */
const route = rootRoute.route('/dashboard');
const indexRoute = route.route('/');
/** AirLib managed */

export const dashboardRoute = route.guard(async () => {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw redirect(loginRoute);
  }
});
export const dashboardIndexRoute = indexRoute;

export default dashboardRoute;
```

If any guard throws a redirect or an error, navigation immediately halts. The component never mounts and child data providers never run.

---

## 2. Parallel Guard Execution

When multiple `.guard()` calls are registered on the same route segment, the router evaluates them concurrently using `Promise.all()`:

```typescript
// pages/admin/route.ts
import rootRoute from '../route.js';

/** AirLib managed */
const route = rootRoute.route('/admin');
const indexRoute = route.route('/');
/** AirLib managed */

export const adminRoute = route
  .guard(verifySession)       // Runs in parallel
  .guard(verifyAdminRole)     // Runs in parallel
  .guard(verifyActiveBilling); // Runs in parallel

export default adminRoute;
```

If any guard throws, navigation cancels immediately without waiting for remaining checks.

---

## 3. Hierarchical Protection

Guards automatically cascade down the route tree. A guard attached to a parent route in `pages/settings/route.ts` automatically protects all child routes under `pages/settings/`:

```typescript
// pages/settings/route.ts
import { redirect } from '@airlib/react'; // or '@airlib/solid'
import rootRoute from '../route.js';
import { loginRoute } from '../auth/route.js';

/** AirLib managed */
const route = rootRoute.route('/settings');
const indexRoute = route.route('/');
/** AirLib managed */

// Parent guard
export const settingsRoute = route.guard(async () => {
  if (!isAuthenticated()) throw redirect(loginRoute);
});

export default settingsRoute;
```

Child routes scaffolded in descendant directories (such as `pages/settings/billing/route.ts` and `pages/settings/security/route.ts`) import `settingsRoute` and automatically inherit its guard:

```typescript
// pages/settings/billing/route.ts
import settingsRoute from '../route.js';

/** AirLib managed */
const route = settingsRoute.route('/billing');
const indexRoute = route.route('/');
/** AirLib managed */

export const billingRoute = route;
export default billingRoute;
```

If the parent guard fails, the router never traverses into or evaluates child routes.

---

## 4. Reactive Interception

Guards execute within a reactive observer. If a guard reads an AirLib `mutable` or reactive signal, the router re-evaluates the guard whenever that state changes:

```typescript
// pages/app/route.ts
import { mutable, redirect } from '@airlib/react'; // or '@airlib/solid'
import rootRoute from '../route.js';
import { loginRoute } from '../auth/route.js';
import { offlineRoute } from '../offline/route.js';

export const authState = mutable({
  isAuthenticated: false,
  isMaintenance: false,
});

/** AirLib managed */
const route = rootRoute.route('/app');
const indexRoute = route.route('/');
/** AirLib managed */

export const appRoute = route.guard(() => {
  if (authState.isMaintenance) throw redirect(offlineRoute);
  if (!authState.isAuthenticated) throw redirect(loginRoute);
});

export default appRoute;
```

When `authState.isAuthenticated` changes from `true` to `false` (e.g. upon user logout or session expiration), the guard automatically re-triggers and redirects the user without manual polling or window listeners.

---

## 5. Redirecting Navigation (`redirect`)

To divert a user to another route, throw `redirect()`. It accepts route objects, route components, or string paths, alongside optional parameters:

```typescript
import { redirect } from '@airlib/react'; // or '@airlib/solid'

// Redirect to a route object
throw redirect(loginRoute);

// Redirect to a route component
throw redirect(LoginPage);

// Redirect to dynamic route with parameters
throw redirect(profileRoute, { user_id: '123' });

// Redirect with query string parameters
throw redirect(loginRoute, undefined, { returnTo: '/dashboard' });
```

---

## 6. Guard Errors & Fallback UI (`route.catch()`)

When a guard throws a standard `Error` (instead of `redirect()`), route activation halts immediately before normal components mount. The router catches the error and executes the route's `.catch()` fallback handler:

#### React
```tsx
// pages/admin/layout.tsx
import { page } from '@airlib/react';
import adminRoute from './route.js';

// Catch guard and activation errors for this route
adminRoute.catch((error) => (
  <div className="access-denied">
    <h2>Access Denied</h2>
    <p>{error.message}</p>
  </div>
));

export const AdminLayout = page(adminRoute).render(({ children }) => {
  return () => <main>{children}</main>;
});
```

#### SolidJS
```tsx
// pages/admin/layout.tsx
import { page } from '@airlib/solid';
import adminRoute from './route.js';

// Catch guard and activation errors for this route
adminRoute.catch((error) => (
  <div class="access-denied">
    <h2>Access Denied</h2>
    <p>{error.message}</p>
  </div>
));

export const AdminLayout = page(adminRoute).render(({ children }) => (
  <main>{children}</main>
));
```

If a route does not define its own `.catch()` handler, the error bubbles up to parent route boundaries or the global `router.catch()` handler.
