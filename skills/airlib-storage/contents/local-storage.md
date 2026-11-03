# Persistent Storage (Local Storage)

This guide establishes the conventions for persisting reactive state across browser sessions and tabs using `persistent()` from `@airlib/storage`.

---

## Two-Way Reactive Persistence

The `persistent()` function creates a reactive object synchronized with `localStorage`. Changes made to the object are saved to storage immediately, and changes originating from other open browser tabs update the reactive object automatically:

```typescript
import { persistent } from '@airlib/storage';

export const userPrefs = persistent('user-preferences', {
  theme: 'light',
  language: 'en',
  notifications: true,
});

// Access and mutate directly—no manual save or getItem/setItem calls needed
userPrefs.theme = 'dark';
userPrefs.language = 'fr';
```

---

## Naming Conventions & Schema Versioning

Pass a version string to manage schema changes and clean up stale data from prior releases:

```typescript
// Simple unversioned key
const settings = persistent('user-settings', { theme: 'light' });

// Versioned key
const settingsV1 = persistent('user-settings@1.0.0', { theme: 'light' });

// Versioned with automatic cleanup of previous version
const settingsV2 = persistent('user-settings@2.0.0:1.0.0', {
  ui: { theme: 'light' },
});
```

When specifying `@currentVersion:previousVersion`, the storage engine automatically removes the previous version key from `localStorage` upon initialization.

---

## UI Component Integration

Use persistent stores directly inside components. Mutations automatically trigger UI updates and disk persistence:

#### React
```tsx
import { setup } from '@airlib/react';
import { persistent } from '@airlib/storage';

const themeStore = persistent('app-theme@1.0.0', { mode: 'system' });

export const ThemeToggle = setup(() => {
  const toggle = () => {
    themeStore.mode = themeStore.mode === 'dark' ? 'light' : 'dark';
  };

  return () => (
    <button type="button" onClick={toggle}>
      Active Theme: {themeStore.mode}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { persistent } from '@airlib/storage';

const themeStore = persistent('app-theme@1.0.0', { mode: 'system' });

export const ThemeToggle = setup(() => {
  const toggle = () => {
    themeStore.mode = themeStore.mode === 'dark' ? 'light' : 'dark';
  };

  return () => (
    <button type="button" onClick={toggle}>
      Active Theme: {themeStore.mode}
    </button>
  );
});
```

---

## Lifecycle & Teardown (`persistent.leave`)

When a persistent state instance is scoped to a temporary screen or unmounted component, disconnect its storage event listeners to avoid memory leaks:

```typescript
import { persistent } from '@airlib/storage';

const draftStore = persistent('temporary-draft', { content: '' });

// When no longer needed
persistent.leave(draftStore);
```

---

## Architectural Considerations

- **Storage Limits**: `localStorage` is limited to ~5–10MB per origin. Store only essential user preferences, flags, or small tokens. For large datasets, use [IndexedDB Tables](./indexed-tables.md).
- **Non-Sensitive Data**: Never store sensitive credentials, plaintext tokens, or private secrets in `localStorage`.
- **SSR Graceful Fallback**: In non-browser environments or when storage is restricted, `persistent()` falls back to in-memory reactive state.
