# Side Effects & Dependency Tracking

Side effects bridge reactive state with outside systems—such as mutating the DOM, persisting data, syncing with third-party libraries, or scheduling timers. AirLib's effect engine executes code immediately and automatically tracks every reactive property accessed synchronously during execution.

---

## 1. Automatic Dynamic Tracking (`effect`)

`effect()` runs immediately on declaration and automatically subscribes to any reactive property read during synchronous execution. There are **no dependency arrays**:

```tsx
import { setup, mutable, effect } from '@airlib/react'; // or '@airlib/solid'

export const CounterLogger = setup(() => {
  const state = mutable({ count: 0 });

  effect(() => {
    console.log('Count updated:', state.count);
  });

  return () => (
    <button onClick={() => state.count++}>
      Increment ({state.count})
    </button>
  );
}, 'CounterLogger');
```

### Dynamic Branch Tracking
Unlike static dependency arrays, AirLib tracks dependencies **dynamically based on the current execution branch**:

```ts
import { mutable, effect } from '@airlib/react'; // or '@airlib/solid'

export const appState = mutable({
  showDetails: false,
  detailMessage: 'Detailed diagnostic info',
});

effect(() => {
  if (appState.showDetails) {
    // Only subscribed to detailMessage when showDetails is true
    console.log(appState.detailMessage);
  }
});

// Mutating detailMessage while showDetails is false will NOT trigger the effect
appState.detailMessage = 'Updated diagnostic info';

// Setting showDetails to true executes the branch and adds detailMessage to tracked dependencies
appState.showDetails = true;
```

---

## 2. Resource Cleanup

Effects can return a teardown function. The cleanup callback executes:
1. Immediately before the effect re-runs (due to a dependency change).
2. When the surrounding component or reactive scope unmounts.

```ts
import { mutable, effect } from '@airlib/react'; // or '@airlib/solid'

export const pollingState = mutable({ intervalMs: 1000 });

effect(() => {
  const timerId = setInterval(() => {
    console.log('Heartbeat ping');
  }, pollingState.intervalMs);

  return () => {
    clearInterval(timerId);
  };
});
```

---

## 3. Untracking Dependencies (`untrack`)

When you need to read reactive data inside an effect without subscribing to its future updates, wrap the read or execution in `untrack()`:

```ts
import { mutable, effect, untrack } from '@airlib/react'; // or '@airlib/solid'

export const documentState = mutable({ content: 'Initial text' });
export const authState = mutable({ token: 'bearer_123' });
export const endpointState = mutable({ url: '/api/save' });

effect(() => {
  // 1. Reactive trigger: re-run whenever content changes
  const body = documentState.content;

  // 2. Untracked read: fetch latest endpoint without subscribing
  const url = untrack(() => endpointState.url);

  // 3. Untracked execution: perform network call without subscribing to auth token
  untrack(() => {
    fetch(url, {
      method: 'POST',
      body: JSON.stringify({ body }),
      headers: { Authorization: authState.token },
    });
  });
});
```

---

## 4. Safe Serialization & Non-Reactive Snapshots

Because Anchor tracks every property accessed synchronously, calling `JSON.stringify(state)` or iterating through an entire object tree will subscribe the effect to every single property.

To avoid over-subscription during logging, debugging, or serialization:

### `stringify(state, replacer?, space?)`
Serializes reactive proxies directly by reading the underlying object, bypassing proxy traps completely without allocating deep clones:

```ts
import { mutable, effect, stringify } from '@airlib/react'; // or '@airlib/solid'

export const user = mutable({ name: 'Alex', settings: { theme: 'dark', sound: true } });

effect(() => {
  // Explicitly trigger only when user.name changes
  if (user.name) {
    // stringify bypasses proxy traps and does not subscribe to settings properties
    const json = stringify(user, null, 2);
    console.log('User snapshot:', json);
  }
});
```

### `snapshot(state, deep = true)`
Creates a detached, non-reactive plain JavaScript copy of the state. Useful when passing objects to third-party libraries:

```ts
import { mutable, effect, snapshot } from '@airlib/react'; // or '@airlib/solid'

export const formData = mutable({ step: 1, answers: { q1: 'yes', q2: 'no' } });

effect(() => {
  if (formData.step === 3) {
    // Detaches from reactivity system completely
    const submission = snapshot(formData.answers);
    externalAnalytics.track('FormComplete', submission);
  }
});
```

---

## 5. Client-Side Only Effects (`effect.client`)

To prevent hydration mismatches and avoid running DOM or browser APIs during Server-Side Rendering (SSR), use `effect.client()`. On the server, it evaluates as a no-op:

```ts
import { effect } from '@airlib/react'; // or '@airlib/solid'

/**
 * Attaches browser-specific window listeners safely.
 */
export function registerWindowResizeListener(onResize: () => void) {
  return effect.client(() => {
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  });
}
```

---

## 6. Async Effects (`effect.async` & `awaited`)

Standard JavaScript `async` functions pause execution at `await`, which severs the synchronous tracking context. Any reactive property accessed *after* an unwrapped `await` fails to register as a dependency.

Wrap promises with `awaited()` inside `effect.async` to restore tracking across asynchronous gaps:

```ts
import { mutable, effect, awaited } from '@airlib/react'; // or '@airlib/solid'

export const editorState = mutable({
  documentId: 'doc_1',
  theme: 'dark',
});

effect.async(async () => {
  const id = editorState.documentId; // Tracked

  // Wrap async gap with awaited() to preserve tracking context
  await awaited(fetchDocumentTheme(id));

  // Accessing editorState.theme here remains properly tracked
  console.log('Active theme:', editorState.theme);
});
```

---

## 7. Global Observability (`subscribe`)

When building persistence layers or devtools that need to detect mutations anywhere in a state tree without manually reading every key, use `subscribe`:

```ts
import { mutable, subscribe } from '@airlib/react'; // or '@airlib/solid'

export const settings = mutable({
  appearance: { theme: 'dark', fontSize: 14 },
});

// Subscribes recursively to all mutations on the settings tree
const unsubscribe = subscribe(settings, (currentValue, event) => {
  console.log('Mutation event:', event);
  localStorage.setItem('app_settings', JSON.stringify(currentValue));
});
```

---

## 8. Async and Timing Helpers

AirLib provides zero-dependency timing and execution scheduling primitives exported from `@airlib/react/utils` and `@airlib/solid/utils`:

### Delay (`sleep`)

Promise-based delay helper to pause execution in async functions, workflows, or test pipelines:

```typescript
import { sleep } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const delayOperation = async () => {
  console.log('Starting...');
  await sleep(1000); // Pause for 1 second
  console.log('Resumed!');
};
```

### Debouncer (`debouncer`)

Creates a `[schedule, cancel]` tuple to delay execution until a quiet period has elapsed:

#### React
```typescript
import { debouncer } from '@airlib/react/utils';

const [debounceSearch, cancelSearch] = debouncer(300);

const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  debounceSearch(() => {
    fetchResults(e.target.value);
  });
};
```

#### SolidJS
```typescript
import { debouncer } from '@airlib/solid/utils';

const [debounceSearch, cancelSearch] = debouncer(300);

const onInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
  debounceSearch(() => {
    fetchResults(e.currentTarget.value);
  });
};
```

### Microtask (`microtask`)

Batches multiple invocations within a window, executing only the final callback with initial and latest context:

```typescript
import { microtask } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const [scheduleTask, cancelTask] = microtask<number>(50);

// Executes once after timeout with (firstContext, lastContext)
scheduleTask((init, current) => {
  console.log(`Updated from ${init} to ${current}`);
}, count);
```

### Microbatch (`microbatch`)

Schedules multiple distinct functions within a timeframe into a unified batch:

```typescript
import { microbatch } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const [scheduleBatch, clearBatch] = microbatch(20);

scheduleBatch(() => syncUserMetrics());
scheduleBatch(() => syncActivityLog());
```

---

## 9. Effect Best Practices

1. **Keep effects isolated by concern**: Never lump unrelated state synchronizations into one monolithic effect.
2. **Avoid circular write cycles**: Never mutate a property inside an effect that directly or indirectly triggers that same effect.
3. **Use `derived` for computed values**: If your goal is calculating data from other data, use `derived` or `derived.as` rather than writing into a second `mutable` inside an `effect`.
