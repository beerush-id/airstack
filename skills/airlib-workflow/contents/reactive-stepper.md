# Reactive Workflows & Steppers

This guide establishes how to bind workflows to reactive state, track real-time execution progress, implement wizard flows, and persist progress across page reloads in AirLib.

---

## 1. Real-Time Pipeline Progress Tracking

Executing an AirLib workflow returns a `WorkflowStepper`. Because this stepper is a reactive proxy, the UI tracks the exact status of the pipeline—down to the specific named step currently executing—without manual state management:

```typescript
import { plan } from '@airlib/core';

export const checkoutFlow = plan<{ cartId: string }>()
  .then(validateCart, { name: 'Validating Cart...' })
  .then(processPayment, { name: 'Processing Payment...' })
  .then(generateReceipt, { name: 'Finalizing Order...' });
```

#### React
```tsx
import { setup, Show } from '@airlib/react';
import { checkoutFlow } from './workflow.js';

export const Checkout = setup((props: { cartId: string }) => {
  const task = checkoutFlow.later();

  return () => (
    <div>
      <button
        onClick={() => task.dispatch({ cartId: props.cartId })}
        disabled={task.status === 'pending'}
      >
        {task.status === 'pending' ? 'Processing...' : 'Pay Now'}
      </button>

      <Show when={() => task.status === 'pending'}>
        {() => (
          <div className="flex items-center gap-2">
            <span>{task.current?.name ?? 'Please wait...'}</span>
            <span className="spinner"></span>
          </div>
        )}
      </Show>

      <Show when={() => task.status === 'success'}>
        {() => <div className="text-green-500">Checkout Complete!</div>}
      </Show>

      <Show when={() => task.status === 'error'}>
        {() => <div className="text-red-500">{task.error?.message}</div>}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, Show } from '@airlib/solid';
import { checkoutFlow } from './workflow.js';

export const Checkout = setup((props: { cartId: string }) => {
  const task = checkoutFlow.later();

  return () => (
    <div>
      <button
        onClick={() => task.dispatch({ cartId: props.cartId })}
        disabled={task.status === 'pending'}
      >
        {task.status === 'pending' ? 'Processing...' : 'Pay Now'}
      </button>

      <Show when={task.status === 'pending'}>
        {() => (
          <div class="flex items-center gap-2">
            <span>{task.current?.name ?? 'Please wait...'}</span>
            <span class="spinner"></span>
          </div>
        )}
      </Show>

      <Show when={task.status === 'success'}>
        {() => <div class="text-green-500">Checkout Complete!</div>}
      </Show>

      <Show when={task.status === 'error'}>
        {() => <div class="text-red-500">{task.error?.message}</div>}
      </Show>
    </div>
  );
});
```

---

## 2. Reactive Execution Bindings

Workflows can be wired directly to the reactive dependency graph using `.once()`, `.with()`, `.when()`, or `.later()`:

### `.once(input)`
Executes the workflow exactly once, deferring execution until the microtask queue flushes. Ideal for initial data fetching on component mount:

```typescript
const reader = fetchProfile.once({ userId: '123' });
```

### `.with(getter, debounce?)`
Executes automatically whenever any reactive state accessed inside the getter changes. An optional `debounce` (in milliseconds) coalesces rapid mutations:

```typescript
import { mutable } from '@airlib/core';

const search = mutable('AirLib framework');

// Re-executes automatically whenever `search.value` changes, debounced by 300ms
const reader = searchDocuments.with(() => ({
  query: search.value,
}), 300);
```

### `.when(getter, debounce?)`
Works identically to `.with()`, but **defers initial execution**. It only fires when a dependency updates after the initial evaluation. Ideal for waiting until a user interacts with a field:

```typescript
import { mutable } from '@airlib/core';

const query = mutable('');

// Does NOT execute immediately; runs only when `query.value` updates
const reader = searchDocuments.when(() => ({
  query: query.value,
}), 300);
```

### `.later(debounce?)`
Creates a deferred `WorkflowStepper` for manual invocation. Useful for binding to event handlers like `onClick` while retaining reactive telemetry:

```tsx
const task = checkoutFlow.later(150); // Optional 150ms debounce

return () => (
  <button onClick={() => task.dispatch({ cartId: '123' })}>
    Checkout
  </button>
);
```

---

## 3. Manual Stepping for Wizard Flows

For multi-step wizards or approval pipelines where each step requires user interaction before proceeding, control the `WorkflowStepper` imperatively:

| Method | Description |
|---|---|
| `step()` | Advance one step. Resolves when that step completes. |
| `step(path, input?)` | Jump to and execute a specific step by path. |
| `run(input)` | Run all remaining steps to completion. |
| `reset()` | Reset the stepper for re-execution. |
| `skip()` | Skip remaining steps and finalize. |

```typescript
import { plan } from '@airlib/core';

const onboardingFlow = plan<{ name: string }>()
  .then((input) => ({ ...input, profile: createProfile(input.name) }), { name: 'Creating Profile...' })
  .then((input) => ({ ...input, workspace: createWorkspace(input.profile) }), { name: 'Setting Up Workspace...' })
  .then((input) => ({ ...input, invite: sendWelcomeEmail(input.profile) }), { name: 'Sending Welcome Email...' });

const stepper = onboardingFlow({ name: 'Alice' });

// Advance one step at a time
await stepper.step(); // Creates profile
await stepper.step(); // Sets up workspace
await stepper.step(); // Sends welcome email

// Or run remaining steps at once
await stepper.run({ name: 'Alice' });
```

---

## 4. State Persistence (Browser & Server)

To safeguard long-running wizard flows against browser reloads, or to persist multi-stage background processes across server restarts, use `snapshot()` and `hydrate()`:

- `snapshot()` returns the full serializable state of every step (status, output, and active branches).
- `hydrate()` restores the stepper from that snapshot, automatically skipping already-completed steps so execution resumes from the next incomplete step.

### Client-Side Persistence (`localStorage`)

```typescript
import { plan } from '@airlib/core';

const onboardingFlow = plan<{ name: string }>()
  .then((input) => ({ ...input, profile: createProfile(input.name) }), { name: 'Creating Profile...' })
  .then((input) => ({ ...input, workspace: createWorkspace(input.profile) }), { name: 'Setting Up Workspace...' })
  .then((input) => ({ ...input, invite: sendWelcomeEmail(input.profile) }), { name: 'Sending Welcome Email...' });

const stepper = onboardingFlow({ name: 'Alice' });

// 1. Restore previous progress if available
const saved = localStorage.getItem('onboarding');
if (saved) {
  stepper.hydrate(JSON.parse(saved));
}

// 2. Synchronize progress on every subsequent state transition
stepper.subscribe(() => {
  localStorage.setItem('onboarding', JSON.stringify(stepper.snapshot()));
});

// Advance to the next incomplete step
await stepper.step();
```

### Server & Database Persistence (Postgres, D1, KV)

Because snapshots are plain serializable JSON objects, server background jobs, approval queues, or webhooks can persist state directly to a database:

```typescript
import { irpc, plan } from '@irpclib/irpc';
import { processNextOrderStep } from './function.js';

const fulfillmentFlow = plan<{ orderId: string }>()
  .then((input) => reserveInventory(input.orderId))
  .then((input) => chargeCustomer(input.orderId))
  .then((input) => shipOrder(input.orderId));

irpc.construct(processNextOrderStep, async (orderId) => {
  const order = await db.orders.findById(orderId);
  const stepper = fulfillmentFlow({ orderId });

  // 1. Restore previous progress from database if available
  if (order.workflowState) {
    stepper.hydrate(order.workflowState);
  }

  // 2. Advance step and persist updated snapshot
  const result = await stepper.step();
  await db.orders.update(orderId, { workflowState: stepper.snapshot() });

  return result;
});
```
