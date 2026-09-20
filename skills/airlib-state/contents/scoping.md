# State Scoping, Architecture & Cookies

Choosing the correct scope for state determines whether an application scales cleanly or suffers from cross-request data leaks, hydration mismatches, and difficult-to-test code.

AirLib categorizes state management into five architectural scopes, ordered from most localized and safest to widest:
1. **Local Component State**: Transient state initialized inside `setup()` and destroyed on unmount.
2. **Headless Stores**: Reusable, testable "Data + Behavior" models (factories or classes) decoupled from UI.
3. **Ambient Request Context**: Scoped to the active SSR request or component subtree via `createContext`.
4. **Reactive Cookies**: Isomorphic persistent state synchronized across SSR requests and browser sessions.
5. **Global Module State**: Top-level file variables (CSR-only or static constants; high risk in SSR).

---

## 1. Scope Comparison & Decision Matrix

| Scope Pattern | Lifecycle | SSR Safety | Recommended Use Case |
|---|---|---|---|
| **Local State** | Component instance lifetime | **Safe** (destroyed on unmount) | Form inputs, drawer open/close, hover/active UI flags. |
| **Headless Store** | Instance / Consumer lifetime | **Safe** when instantiated per request/component | Reusable business domains (Cart, Chat, TabManager, Auth). |
| **Ambient Context** | Request / Layout tree lifetime | **Safe** (isolated per request) | Authenticated user session, route data, compound component coordination. |
| **Reactive Cookies** | Browser session / Cookie TTL | **Safe** (bound to request scope) | Preferences, session tokens, localization. |
| **Global Module State** | Application process lifetime | **High Risk** (leaks across concurrent requests) | App-wide static constants or CSR-only singletons. Avoid in SSR. |

---

## 2. Local Component State (`setup`)

When state is strictly private to a single component instance, initialize it inside `setup()`. It is created when the component mounts and automatically garbage-collected when it unmounts:

```tsx
import { setup, mutable } from '@airlib/react'; // or '@airlib/solid'

export const Toggle = setup(() => {
  const state = mutable({ on: false });

  const toggle = () => {
    state.on = !state.on;
  };

  return () => (
    <button
      type="button"
      className={state.on ? 'active' : ''}
      onClick={toggle}
    >
      {state.on ? 'ON' : 'OFF'}
    </button>
  );
}, 'Toggle');
```

---

## 3. Headless Stores (Data + Behavior)

Headless state decouples business logic, data mutation, and validation rules from JSX presentation. Group state and domain methods together using standard JavaScript classes or factory functions:

### Factory Function Pattern
```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export interface CounterStore {
  count: number;
  increment: () => void;
  decrement: () => void;
}

/**
 * Creates an isolated counter domain store.
 */
export function createCounterStore(initial = 0): CounterStore {
  return mutable({
    count: initial,
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
  });
}
```

### Class Pattern
For complex enterprise domains, wrap class instances in `mutable()`. The proxy tracks property changes through method calls:

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export class TabManager {
  public activeTab: string;

  constructor(defaultTab = 'overview') {
    this.activeTab = defaultTab;
  }

  public selectTab(tabId: string) {
    this.activeTab = tabId;
  }
}

/**
 * Creates a reactive TabManager store.
 */
export function createTabManager(defaultTab?: string) {
  return mutable(new TabManager(defaultTab));
}
```

---

## 4. Ambient Request-Scoped State (`createContext`)

To share state across a layout or component tree safely during SSR without prop-drilling, use Anchor's context system. Each server request creates an isolated instance, eliminating cross-request data leaks:

```tsx
import { setup, createContext, mutable } from '@airlib/react'; // or '@airlib/solid'
import type { ReactNode } from 'react'; // or JSX.Element in SolidJS

export interface SessionData {
  userId: string;
  role: string;
}

export interface RootLayoutProps {
  children?: ReactNode;
}

export const sessionCtx = createContext<SessionData>();

/**
 * Root Layout providing request-isolated session state.
 */
export const RootLayout = setup<RootLayoutProps>(() => {
  // Instantiated freshly per SSR request or client mount
  const session = mutable<SessionData>({
    userId: 'user_123',
    role: 'member',
  });

  sessionCtx.set(session);

  return ({ children }) => (
    <div className="app-shell">
      {children}
    </div>
  );
}, 'RootLayout');
```

---

## 5. Reactive Cookies (`cookies`)

AirLib provides isomorphic reactive state backed by HTTP and browser cookies. Reading properties parses JSON payloads; mutating properties updates reactive observers and automatically serializes back into `document.cookie` (client) or emits `Set-Cookie` response headers (server).

Because `cookies()` accesses the active request scope during SSR, declare it inside `setup()` or route guards:

```tsx
import { setup, cookies } from '@airlib/react'; // or '@airlib/solid'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
}

export const PreferencesPanel = setup(() => {
  const preferences = cookies<UserPreferences>(
    'user-pref',
    { theme: 'system', fontSize: 16 },
    {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'Lax',
    }
  );

  const toggleTheme = () => {
    preferences.theme = preferences.theme === 'dark' ? 'light' : 'dark';
  };

  return () => (
    <div className="preferences">
      <p>Active Theme: {preferences.theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}, 'PreferencesPanel');
```

### Server Sync (`syncCookies`)
When a server action or Remote Function (IRPC) mutates cookies via `Set-Cookie` response headers, call `syncCookies()` to synchronize active client-side cookie stores without reloading the page:

```ts
import { syncCookies } from '@airlib/react'; // or '@airlib/solid'

export async function loginUser(credentials: LoginCredentials) {
  // Server sets session cookie in HTTP response
  await authRpc.login(credentials);

  // Sync active reactive cookie stores with newly written document.cookie
  syncCookies();
}
```

---

## 6. Static SSG Hydration Boundaries (`cookiePair`)

On pre-generated static pages (SSG) or CDN-cached HTML, initial HTML was compiled at build time using fallback default values. If client hydration eagerly reads local browser cookies, a hydration mismatch occurs.

`cookiePair()` provides a dual proxy interface: `[paired, stored]`:

```tsx
import { setup, cookiePair, effect, uiRouterCtx } from '@airlib/react'; // or '@airlib/solid'

export const ThemeSwitch = setup(() => {
  const ctx = uiRouterCtx.get();
  const isStatic = ctx?.router.activeRoute?.isStatic;

  // Render uses fallback on SSR/initial hydration, then syncs stored value on mount
  const [theme, stored] = cookiePair(
    'app-theme',
    { mode: 'system' as 'system' | 'light' | 'dark' },
    { deferred: isStatic }
  );

  // Client-only effect reads real persisted value without causing markup mismatch
  effect.client(() => {
    document.documentElement.dataset.theme = stored.mode;
  });

  return () => (
    <button onClick={() => (theme.mode = theme.mode === 'dark' ? 'light' : 'dark')}>
      Mode: {theme.mode}
    </button>
  );
}, 'ThemeSwitch');
```

- **`theme` (Paired)**: Safe for rendering JSX. On static pages with `deferred: true`, defers reading browser cookies until mount.
- **`stored`**: Direct access to real stored cookie values for client-only effects.
- **Bi-directional sync**: Mutating either updates `document.cookie` and keeps both proxies aligned.

---

## 7. Global Module State vs SSR Leak Risks (Caution)

Defining reactive state as a top-level module export is convenient, but in Server-Side Rendering (SSR) environments, module variables are shared across **all concurrent incoming requests**:

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

// DANGER in SSR: Shared across all server requests!
// If User A mutates this, User B sees User A's data.
export const dangerousGlobalState = mutable({
  userId: null as string | null,
  cartId: null as string | null,
});
```

WARNING: Never store user-specific, session-specific, or request-specific data in top-level module variables in SSR applications. Use **Ambient Context** (`createContext`), **Reactive Cookies** (`cookies`), or **Headless Stores** instantiated per component/request instead.
