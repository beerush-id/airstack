# IndexedDB Key-Value Store

This guide establishes the conventions for managing key-value storage backed by IndexedDB using `createKVStore` and `kv` from `@airlib/storage/db`.

---

## 1. Overview & Comparison

When storing datasets larger than `localStorage`'s 5–10MB limit or requiring structured asynchronous persistence, use AirLib's IndexedDB Key-Value store. It provides:
- **In-memory speed**: State reads and writes update reactive proxy objects immediately.
- **Background synchronization**: Operations flush to IndexedDB asynchronously without blocking the UI.
- **Optimistic concurrency control**: Automatic conflict resolution for concurrent writes.

---

## 2. Using the Global Default Store (`kv`)

For general-purpose key-value pairs, use the built-in `kv` store:

```typescript
import { kv } from '@airlib/storage/db';

// Access or initialize a key-value record
const settings = kv('user-settings', { theme: 'system', zoom: 100 });

// Mutate properties directly via .data
settings.data.theme = 'dark';
settings.data.zoom = 120;

// Remove a key from the database
kv.remove('user-settings');
```

---

## 3. Creating Isolated Named Stores (`createKVStore`)

When isolating domain data into separate IndexedDB object stores or seeding default records, use `createKVStore`:

```typescript
import { createKVStore } from '@airlib/storage/db';

type AppConfig = {
  theme: string;
  locale: string;
  volume: number;
};

// Create a typed store with optional seeds
export const configStore = createKVStore<AppConfig>('app-config', 1, 'app-db', [
  ['default-config', { theme: 'light', locale: 'en', volume: 80 }],
]);

// Access records
const currentConfig = configStore('default-config');
currentConfig.data.volume = 90;

// Wait for all queued background flushes to complete
await configStore.ready();
```

---

## 4. UI Component Integration

Access reactive KV state directly inside components:

#### React
```tsx
import { setup } from '@airlib/react';
import { kv } from '@airlib/storage/db';

const editorState = kv('editor-session', { activeTab: 'main.ts' });

export const TabBar = setup(() => {
  const switchTab = (tab: string) => {
    editorState.data.activeTab = tab;
  };

  return () => (
    <div className="tabs">
      <button
        type="button"
        className={editorState.data.activeTab === 'main.ts' ? 'active' : ''}
        onClick={() => switchTab('main.ts')}
      >
        main.ts
      </button>
      <button
        type="button"
        className={editorState.data.activeTab === 'styles.css' ? 'active' : ''}
        onClick={() => switchTab('styles.css')}
      >
        styles.css
      </button>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { kv } from '@airlib/storage/db';

const editorState = kv('editor-session', { activeTab: 'main.ts' });

export const TabBar = setup(() => {
  const switchTab = (tab: string) => {
    editorState.data.activeTab = tab;
  };

  return () => (
    <div class="tabs">
      <button
        type="button"
        class={editorState.data.activeTab === 'main.ts' ? 'active' : ''}
        onClick={() => switchTab('main.ts')}
      >
        main.ts
      </button>
      <button
        type="button"
        class={editorState.data.activeTab === 'styles.css' ? 'active' : ''}
        onClick={() => switchTab('styles.css')}
      >
        styles.css
      </button>
    </div>
  );
});
```

---

## 5. Underlying Store Access & Subscriptions

To access the underlying `IndexedKv` instance or subscribe to raw events:

```typescript
const unsubscribe = configStore.store().subscribe((event) => {
  console.log(`KV Event: ${event.type}`, event.key, event.value);
});
```

---

## 6. Lifecycle & Teardown (`store.leave`)

When a state instance is no longer needed, disconnect it from the store:

```typescript
configStore.leave(currentConfig);
```
