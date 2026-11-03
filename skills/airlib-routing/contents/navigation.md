# Navigation

AirLib supports two navigation patterns: declarative linking via the `<Link>` component in templates, and programmatic navigation via `navigate()` in JavaScript/TypeScript code.

---

## The `<Link>` Component

Use `<Link>` for client-side declarative navigation. It computes destination URLs dynamically, injects active state classes, and pre-fetches route assets:

```tsx
// components/NavMenu.tsx
import { template, Link } from '@airlib/react'; // or '@airlib/solid'
import usersRoute from '@/pages/users/route.js';
import profileRoute from '@/pages/users/[user_id]/route.js';

export const NavMenu = template(() => (
  <nav className="nav-menu">
    {/* 1. Route object: preferred for refactoring resilience */}
    <Link to={usersRoute} activeClass="active">
      Users
    </Link>

    {/* 2. Parameterized route with hover preloading */}
    <Link to={profileRoute} params={{ user_id: '42' }} preload="hover">
      View Profile
    </Link>

    {/* 3. Query string parameters */}
    <Link to={usersRoute} query={{ page: 2, sort: 'name' }}>
      Page 2
    </Link>

    {/* 4. External URL via href */}
    <Link href="https://example.com" target="_blank">
      Docs
    </Link>
  </nav>
));
```

### Destination Targets (`to` vs `href`)

- **Route Objects (`to={usersRoute}`)**: **Preferred.** Fully typed and refactor-safe. Parameter names and route paths are verified at compile-time; renaming or moving routes updates all references automatically without broken links.
- **Path Strings (`to="/users"`)**: Supported, but untyped. Renaming paths requires manual string search-and-replace across the codebase.
- **Page Components (`to={ProfilePage}`)**: Supported when referencing a route page component directly.
- **External URLs (`href="https://..."`)**: Used for links outside the router tree.

---

## Active Link Styling

When a route is active, `<Link>` automatically receives `aria-current="page"` and appends `activeClass`.

### Hierarchical Matching & `fullMatch`

By default, parent routes remain active while viewing nested child routes (e.g. `/users` stays active when viewing `/users/42`).

For index routes, matching is strict by default. To keep an index link active when child routes are visited (such as keeping a top-level tab highlighted), set `fullMatch={false}`:

```tsx
<Link to={usersRoute} fullMatch={false} activeClass="active">
  Users Tab
</Link>
```

---

## Link Preloading (`preload`)

To eliminate navigation latency, configure links to pre-fetch route data on user interaction via `preload="hover"` (as shown in `NavMenu` above). When the user hovers over the link, the router runs the target route's guards and data providers in the background.

You can also configure default preloading at the route definition level:

```typescript
// pages/users/[user_id]/route.ts
export const profileRoute = usersRoute.route('/:user_id', {
  preloadMode: 'hover',
});
```

---

## Programmatic Navigation (`navigate`)

Use `navigate()` inside event handlers, form actions, or async callbacks:

```tsx
// pages/users/page.tsx
import { page, navigate } from '@airlib/react'; // or '@airlib/solid'
import usersRoute from './route.js';
import profileRoute from '@/pages/users/[user_id]/route.js';

export default page(usersRoute).render(() => {
  const handleSelectUser = (userId: string) => {
    // Navigate via route object (preferred)
    navigate(profileRoute, { params: { user_id: userId } });
  };

  const handlePaginate = (pageNumber: number) => {
    // Navigate with query parameters
    navigate(usersRoute, { query: { page: pageNumber } });
  };

  const handleRedirect = (userId: string) => {
    // Replace current history entry instead of pushing
    navigate(profileRoute, { params: { user_id: userId }, replace: true });
  };

  return () => (
    <div>
      <button onClick={() => handleSelectUser('42')}>Select User (Route)</button>
      <button onClick={() => handlePaginate(2)}>Next Page (Query)</button>
      <button onClick={() => handleRedirect('42')}>Replace View</button>
    </div>
  );
});
```

---

## URL Generation (`route.url`)

Generate a valid URL string from a route definition without triggering navigation (useful for clipboard copy, sharing, or analytics):

```typescript
import profileRoute from '@/pages/users/[user_id]/route.js';

const profileUrl = profileRoute.url(
  { user_id: '42' },
  { tab: 'activity' }
);
// Result: '/users/42?tab=activity'
```

---

## Global Navigation Progress

The router tracks in-flight navigation progress on `router.state`. Use this to display a top-level loading progress bar:

#### React
```tsx
// components/NavigationProgressBar.tsx
import { template, Show } from '@airlib/react';
import { router } from '@/src/router.js';

export const NavigationProgressBar = template(() => (
  <Show when={() => router.state.activating}>
    <div className="progress-container">
      <div 
        className="progress-bar"
        style={{ 
          width: `${(router.state.progress / router.state.steps) * 100}%` 
        }}
      />
    </div>
  </Show>
));
```

#### SolidJS
```tsx
// components/NavigationProgressBar.tsx
import { template, Show } from '@airlib/solid';
import { router } from '@/src/router.js';

export const NavigationProgressBar = template(() => (
  <Show when={router.state.activating}>
    <div class="progress-container">
      <div 
        class="progress-bar"
        style={{ 
          width: `${(router.state.progress / router.state.steps) * 100}%` 
        }}
      />
    </div>
  </Show>
));
```

| Property | Type | Description |
|---|---|---|
| `router.state.activating` | `boolean` | `true` while guards and data providers are resolving. |
| `router.state.steps` | `number` | Total number of asynchronous tasks required to activate the route. |
| `router.state.progress` | `number` | Number of completed asynchronous tasks. |
