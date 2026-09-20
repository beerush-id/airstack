# Workflow Error Handling & Recovery

This guide establishes how to handle exceptions, recover pipeline state with fallback data, and run guaranteed cleanup actions in AirLib Workflows.

---

## Sequential Halting and Error Trapping

When an error is thrown inside any step of a workflow:
1. Sequential execution halts immediately.
2. The engine skips all subsequent `.then()` steps until it finds a `.catch()` block.
3. If no `.catch()` block is found, the workflow rejects its execution promise.

---

## Recovering Pipeline State (`.catch`)

A `.catch()` block intercepts step failures and receives both the thrown `error` and the `originalInput` provided when the workflow was started.

When a `.catch()` block returns a fallback value, the workflow exits the error state and resumes normal sequential execution for any remaining downstream `.then()` steps:

```typescript
import { plan } from '@irpclib/irpc';

const resilientFlow = plan<{ id: string }>()
  .then((input) => fetchExternalData(input.id))
  .catch((err, originalInput) => {
    console.error('Fetch failed, using cache:', err);
    // Return fallback data to resume the pipeline
    return getCachedData(originalInput.id);
  })
  .then((data) => processData(data)); // Resumes using the recovered cache data

irpc.construct(getData, (id) => resilientFlow({ id }));
```

#### React
```tsx
import { setup } from '@airlib/react';
import { getData } from './function.js';

export const DataView = setup((props: { id: string }) => {
  const task = getData.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.id)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Loading...' : 'Load Data'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { getData } from './function.js';

export const DataView = setup((props: { id: string }) => {
  const task = getData.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.id)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Loading...' : 'Load Data'}
    </button>
  );
});
```

---

## Guaranteed Cleanup (`.finally`)

Use `.finally()` to run teardown or resource-releasing logic (such as releasing mutexes, unlocking files, or closing handles).

- `.finally()` executes regardless of whether the pipeline completed successfully or threw an error.
- `.finally()` does not mutate the pipeline's output value.

```typescript
import { plan } from '@irpclib/irpc';

const resourceFlow = plan<{ fileId: string }>()
  .then((input) => lockFile(input.fileId))
  .then((input) => processFile(input.fileId))
  .finally((input, error) => {
    unlockFile(input.fileId); // Always executes, even if processFile throws
  });

irpc.construct(processItem, (fileId) => resourceFlow({ fileId }));
```

#### React
```tsx
import { setup } from '@airlib/react';
import { processItem } from './function.js';

export const FileProcessor = setup((props: { fileId: string }) => {
  const task = processItem.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.fileId)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Processing...' : 'Process File'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { processItem } from './function.js';

export const FileProcessor = setup((props: { fileId: string }) => {
  const task = processItem.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.fileId)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Processing...' : 'Process File'}
    </button>
  );
});
```
