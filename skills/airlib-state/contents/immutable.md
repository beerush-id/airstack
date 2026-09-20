# Immutable State & Write Contracts

When sharing state across multiple modules, stores, or components, unrestricted mutable access leads to unpredictable mutations and difficult debugging. AirLib enforces **Read/Write Segregation**:
- **Public Interface**: Read-only via `immutable()`. Safe to share everywhere.
- **Private/Protected Interface**: Writable via `writable()`. Restricted to authorized modules.

---

## 1. Defining Read-Only State (`immutable`)

`immutable()` wraps an object or array in a read-only reactive proxy. Consumers can read properties normally to render UI or compute values, but direct property assignment is ignored and logs an error (it does not throw):

```ts
import { immutable } from '@airlib/react'; // or '@airlib/solid'

export const appConfig = immutable({
  apiUrl: 'https://api.example.com',
  features: {
    darkMode: true,
    betaFlag: false,
  },
});

// Reading is fully reactive and allowed
console.log(appConfig.apiUrl);

// Direct mutation is ignored (logs an error; does not throw)
appConfig.apiUrl = 'https://other.com';
```

---

## 2. Defining Write Contracts (`writable`)

Because the public state is immutable, write access must be explicitly granted via a **Write Contract** created with `writable()`. A write contract points to the exact same underlying proxy but enables mutation capabilities:

```ts
import { immutable, writable } from '@airlib/react'; // or '@airlib/solid'

// 1. Public Read-Only View (Exported to components)
export const sessionState = immutable({
  userId: 'user_123',
  activeToken: 'tok_abc',
  lastSeen: Date.now(),
});

// 2. Private Write Contract (Kept inside service or auth module)
const sessionControl = writable(sessionState);

export function updateLastSeen() {
  sessionControl.lastSeen = Date.now(); // Mutates sessionState safely
}
```

---

## 3. Least-Privilege Writers (Restricted Keys)

To prevent unintended modifications to critical properties, `writable(state, allowedKeys)` accepts an array of explicitly permitted property keys:

```ts
import { immutable, writable } from '@airlib/react'; // or '@airlib/solid'

export const userPreferences = immutable({
  theme: 'dark',
  notifications: true,
  accountId: 'acc_9999', // Critical property that should not be touched
});

// Grant write permission ONLY to 'theme'
export const themeController = writable(userPreferences, ['theme']);

// Allowed mutation
themeController.theme = 'light';

// Disallowed key mutation is ignored (logs an error)
themeController.accountId = 'acc_0000';
```

---

## 4. Hierarchical Configuration Layering (`inherit`)

`inherit` creates a deeply inherited proxy that layers multiple configuration sources from left to right. When accessing properties, it resolves from the rightmost defined override down to the leftmost default, recursively cascading through nested objects without cloning or mutating the original targets:

```ts
import { inherit } from '@airlib/react'; // or '@airlib/solid'

interface AppConfig {
  theme: { mode: string; color: string };
  api: { timeout: number; retries: number };
}

const defaults: AppConfig = {
  theme: { mode: 'system', color: '#fe7824' },
  api: { timeout: 5000, retries: 3 },
};

const userOverrides = {
  theme: { mode: 'dark' },
};

// Deeply merges overrides over defaults without mutation
export const config = inherit<AppConfig>(defaults, userOverrides);

console.log(config.theme.mode);  // 'dark' (from userOverrides)
console.log(config.theme.color); // '#fe7824' (inherited from defaults)
console.log(config.api.timeout); // 5000 (inherited from defaults)
```

- **Non-destructive & Lazy**: Does not clone or merge upfront; properties are evaluated dynamically via proxy traps.
- **Deep Recursive Cascade**: Nested objects (like `config.theme` and `config.api`) are automatically wrapped in nested `inherit` proxies on access.
- **Full Object Parity**: Supports `in` operators (`'mode' in config.theme`), `Object.keys(config)`, and native reflection.
- **Null-Safe**: Gracefully ignores `null`, `undefined`, and empty object layers.

---

## 5. Architectural Best Practices

### Prefer Restricted Access for Shared Stores
For stores exported across the app, prefer `immutable` over raw `mutable`. This guarantees one-way data flow: components cannot accidentally mutate store properties directly.

```ts
// store/auth.ts
import { immutable, writable } from '@airlib/react';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
}

// 1. Read-only state for UI rendering
export const authState = immutable<AuthState>({
  isAuthenticated: false,
  username: null,
});

// 2. Internal writer for actions
const authWriter = writable(authState);

export const authActions = {
  login(username: string) {
    authWriter.isAuthenticated = true;
    authWriter.username = username;
  },
  logout() {
    authWriter.isAuthenticated = false;
    authWriter.username = null;
  },
};
```
