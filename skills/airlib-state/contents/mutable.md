# Mutable State & Deep Reactivity

AirLib uses transparent JavaScript Proxies to upgrade plain objects and primitives into reactive state containers. You read properties naturally and assign values directly—no `setState`, no spread operators (`...state`), and no copy-on-write overhead.

---

## 1. Creating Reactive State (`mutable`)

### Objects & Arrays
Wrapping an object or array creates a deeply reactive Proxy. Any property read inside a reactive context (`template`, `effect`, `derived`, or component render function) is automatically tracked.

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export const userState = mutable({
  name: 'Alex',
  role: 'Developer',
  profile: {
    avatar: '/alex.png',
    theme: 'dark',
  },
  tags: ['frontend', 'react'],
});
```

### Primitives
Because JavaScript passes primitive values (numbers, strings, booleans) by value, primitives are wrapped in a reference object with a `.value` accessor:

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export const count = mutable(0);

console.log(count.value); // 0
count.value++;            // Mutates state and notifies observers
```

---

## 2. In-Place Direct Mutation

Update state using standard assignment operators. The proxy intercepts the mutation and schedules fine-grained UI updates:

```ts
// Property mutation
userState.name = 'Alexandra';
userState.profile.theme = 'light';

// Array mutation using native mutating methods
userState.tags.push('solidjs');
userState.tags.splice(0, 1);
```

---

## 3. Inline Computed Getters

You can embed derived logic directly within your state object using standard **JavaScript Getters**. Getters automatically track their underlying properties and re-evaluate when dependencies change:

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export const cart = mutable({
  price: 25,
  quantity: 2,

  // Automatically reactive; re-evaluates when price or quantity updates
  get total() {
    return this.price * this.quantity;
  },
});

console.log(cart.total); // 50
cart.quantity = 3;
console.log(cart.total); // 75
```

---

## 4. Encapsulation & Headless Stores

Group state and domain methods together using plain object methods or TypeScript classes. Methods modify state directly via `this`:

### Factory Function Pattern
```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export function createCounterStore(initial = 0) {
  return mutable({
    count: initial,
    increment() {
      this.count++;
    },
    decrement() {
      this.count--;
    },
    reset() {
      this.count = initial;
    },
  });
}
```

### Class Pattern
For complex domain logic, pass a class instance to `mutable()`. The proxy tracks property mutations, even when called through class methods:

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

export class TaskManager {
  public tasks: string[] = [];

  constructor(initialTasks: string[] = []) {
    this.tasks = initialTasks;
  }

  public addTask(task: string) {
    this.tasks.push(task);
  }

  public removeTask(index: number) {
    this.tasks.splice(index, 1);
  }
}

export function createTaskManager(initial?: string[]) {
  return mutable(new TaskManager(initial));
}
```

---

## 5. Performance & Reactivity Depth (`recursive`)

By default, `mutable()` deeply wraps all nested objects and arrays in reactive proxies. For large collections, you can optimize memory and proxy allocation via the `recursive` option:

- `recursive: true` (Default): Deeply reactive. All nested objects and arrays are reactive proxies.
- `recursive: false`: Shallow reactivity. Only top-level property assignments trigger updates.
- `recursive: 'flat'`: Array structure tracking only. Modifying array length, pushing, or sorting triggers updates, but individual item properties remain passive.

```ts
import { mutable } from '@airlib/react'; // or '@airlib/solid'

// Flat tracking for large datasets to avoid proxy overhead
export const dataset = mutable(largeArrayOfObjects, { recursive: 'flat' });
```

---

## 6. Advanced: Runtime Schema Validation (Optional)

NOTE: Standard application state should rely on standard TypeScript interfaces. Runtime schema validation inside `mutable` is reserved strictly for complex domain boundaries or untrusted external inputs.

For complex domains requiring strict runtime validation, `mutable()` can validate mutations against a schema:

```ts
import { mutable } from '@airlib/react';
import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3),
  age: z.number().min(0),
});

export const account = mutable(
  { username: 'john', age: 25 },
  { schema: userSchema }
);

account.age = 26;    // OK
// account.age = -1; // Throws ZodError
```
