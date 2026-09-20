# Derived State & Computed Values

Redundant state—manually updating computed values whenever dependencies change—is a primary source of synchronization bugs and performance bottlenecks.

Derived state only makes sense within a **reactive boundary** (such as a component render function, fine-grained control flow like `<For>` or `<Show>`, or an `effect()`). Outside a reactive boundary, standard JavaScript functions or getters should be used instead.

AirLib provides dedicated derivation primitives optimized for specific computational relationships:
- **Intrinsic Getters**: Computed properties on the same reactive object.
- **`derived()`**: Combining multiple independent state sources into a single reactive reference.
- **`derived.as()`**: Multi-property stable ViewModels without `.value` indirection for UI templates.
- **`derived.reduce()`**: Incremental $O(1)$ collection aggregations without full array re-scans.

---

## 1. Derivation Strategy Decision Matrix

| Developer Problem | Recommended Primitive | Reactive Boundary Consumption |
|---|---|---|
| Computing a property from data on the **same object** | **JavaScript Getter** | Render function, `<Snippet>`, or `template` |
| Combining **multiple independent state sources** | `derived(() => ...)` | `<For each={() => derivedList.value}>` or `<Show>` |
| Creating a **multi-property ViewModel** | `derived.as(() => ({ ... }))` | Component JSX template (direct property access, no `.value`) |
| Aggregating **large or fast-changing collections** | `derived.reduce(initial, list, fn)` | Real-time counters, summary cards, status badges |

---

## 2. Intrinsic Getters (Same Object)

When a computed property belongs logically to a state object, standard JavaScript getters encapsulate the calculation directly. The getter re-evaluates automatically whenever accessed reactive properties change inside a component or effect:

```tsx
import { setup, mutable } from '@airlib/react'; // or '@airlib/solid'

export const CartWidget = setup(() => {
  const cart = mutable({
    price: 25,
    quantity: 2,

    /**
     * Automatically reactive subtotal getter.
     */
    get subtotal() {
      return this.price * this.quantity;
    },
  });

  return () => (
    <div className="cart-widget">
      <p>Quantity: {cart.quantity}</p>
      <p>Subtotal: ${cart.subtotal}</p>
      <button onClick={() => cart.quantity++}>Add Item</button>
    </div>
  );
}, 'CartWidget');
```

---

## 3. Combining Independent Sources (`derived`)

When a computed value depends on multiple *separate* state sources that do not share a parent object (such as combining a data collection with an active search filter), `derived()` establishes automatic tracking across both dependencies.

Pass the `.value` accessor to `<For>` or `<Show>` to ensure fine-grained DOM reconciliation:

```tsx
import { setup, For, mutable, derived } from '@airlib/react'; // or '@airlib/solid'

export interface Product {
  id: string;
  title: string;
  inStock: boolean;
}

export const ProductCatalog = setup(() => {
  const products = mutable<Product[]>([
    { id: '1', title: 'Mechanical Keyboard', inStock: true },
    { id: '2', title: 'Wireless Mouse', inStock: false },
    { id: '3', title: 'USB-C Dock', inStock: true },
  ]);

  const filter = mutable({
    query: '',
    onlyInStock: false,
  });

  /**
   * Tracks both products and filter states reactively.
   */
  const visibleProducts = derived(() => {
    return products.filter((item) => {
      const matchesQuery = item.title.toLowerCase().includes(filter.query.toLowerCase());
      const matchesStock = !filter.onlyInStock || item.inStock;
      return matchesQuery && matchesStock;
    });
  });

  return () => (
    <div className="catalog">
      <input
        type="text"
        placeholder="Search products..."
        value={filter.query}
        onInput={(e) => (filter.query = (e.target as HTMLInputElement).value)}
      />
      <label>
        <input
          type="checkbox"
          checked={filter.onlyInStock}
          onChange={(e) => (filter.onlyInStock = (e.target as HTMLInputElement).checked)}
        />
        In stock only
      </label>

      <ul>
        <For each={() => visibleProducts.value}>
          {(product) => (
            <li>
              <span>{product.title}</span>
              <span>{product.inStock ? 'Available' : 'Out of Stock'}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}, 'ProductCatalog');
```

---

## 4. Stable Object Projections (`derived.as`)

When creating a multi-property ViewModel for a component template, wrapping results in standard `derived()` introduces `.value` indirection (`vm.value.fullName`). Re-creating plain objects also breaks reference identity and causes unnecessary template re-renders.

`derived.as()` returns a **stable object proxy** whose individual properties update in-place without replacing the top-level object reference. It is consumed directly in JSX templates without `.value`:

```tsx
import { setup, mutable, derived } from '@airlib/react'; // or '@airlib/solid'

export const UserCard = setup(() => {
  const user = mutable({
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'Staff Engineer',
    department: 'Platform Architecture',
  });

  /**
   * Stable ViewModel proxy for direct JSX consumption (no .value indirection).
   */
  const viewModel = derived.as(() => ({
    fullName: `${user.firstName} ${user.lastName}`,
    initials: `${user.firstName[0]}${user.lastName[0]}`,
    badgeText: `${user.role} · ${user.department}`,
  }));

  return () => (
    <div className="user-card">
      <div className="avatar-placeholder">{viewModel.initials}</div>
      <h2>{viewModel.fullName}</h2>
      <p className="role-badge">{viewModel.badgeText}</p>
      <button onClick={() => (user.firstName = 'Janet')}>Edit Name</button>
    </div>
  );
}, 'UserCard');
```

---

## 5. Incremental Collection Reduction (`derived.reduce`)

Standard `Array.prototype.reduce()` requires an $O(N)$ re-scan over the entire collection on every modification.

`derived.reduce()` maintains a continuous accumulated state by applying **incremental $O(1)$ delta updates** when items are added, modified, or removed, making it ideal for live counters and summary badges:

```tsx
import { setup, For, Show, mutable, derived } from '@airlib/react'; // or '@airlib/solid'

export interface TaskItem {
  id: number;
  title: string;
  done: boolean;
}

export const TaskTracker = setup(() => {
  const tasks = mutable<TaskItem[]>([
    { id: 1, title: 'Define route contracts', done: true },
    { id: 2, title: 'Implement fine-grained views', done: false },
    { id: 3, title: 'Write integration tests', done: false },
  ]);

  /**
   * Continuously aggregates total and completed counts in O(1) time.
   */
  const summary = derived.reduce(
    { total: 0, completed: 0 },
    tasks,
    (stats, task, remove) => {
      if (remove) {
        if (task.done) stats.completed--;
        stats.total--;
      } else {
        if (task.done) stats.completed++;
        stats.total++;
      }
    }
  );

  return () => (
    <div className="task-tracker">
      <header className="stats-header">
        <span>Completed: {summary.completed} / {summary.total}</span>
        <Show when={() => summary.completed === summary.total && summary.total > 0}>
          {() => <span className="celebration-pill">All done!</span>}
        </Show>
      </header>

      <ul>
        <For each={() => tasks}>
          {(task) => (
            <li>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => (task.done = !task.done)}
              />
              <span className={task.done ? 'completed' : ''}>{task.title}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}, 'TaskTracker');
```

---

## 6. Derived State in Side Effect Boundaries (`effect`)

Derived values can also drive side-effects (such as updating the document title or persisting computed metrics to analytics) within an `effect()` boundary:

```tsx
import { setup, mutable, derived, effect } from '@airlib/react'; // or '@airlib/solid'

export const NotificationMonitor = setup(() => {
  const notifications = mutable([
    { id: 'n1', read: false },
    { id: 'n2', read: false },
  ]);

  const unreadCount = derived.reduce(0, notifications, (count, item, remove) => {
    if (remove) {
      if (!item.read) count.value--;
    } else {
      if (!item.read) count.value++;
    }
  });

  // Client-only side effect: safe for browser document access during SSR
  effect.client(() => {
    document.title = unreadCount.value > 0
      ? `(${unreadCount.value}) New Notifications`
      : 'No Notifications';
  });

  return () => (
    <div>
      <button onClick={() => notifications.push({ id: `n${Date.now()}`, read: false })}>
        Receive Notification
      </button>
      <button onClick={() => notifications.forEach((n) => (n.read = true))}>
        Mark All Read
      </button>
    </div>
  );
}, 'NotificationMonitor');
```
