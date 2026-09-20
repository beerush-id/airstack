# Fine-Grained & Isolated Rendering

AirLib provides dedicated control flow and fine-grained rendering primitives that isolate DOM updates. In AirLib, **you must use AirLib's control flow primitives over legacy React patterns**.

---

## AirLib Primitives vs React Habits

Dragging standard React habits into AirLib degrades fine-grained reactivity and causes unnecessary parent component re-renders:

| React Habit (Anti-Pattern) | AirLib Primitive (Required) | Why It Matters |
|---|---|---|
| `{condition && <Component />}` | `<Show when={() => condition}>` | React inline short-circuiting forces the parent component to re-render whenever the condition flips. `<Show>` isolates branch changes to its own DOM node. |
| `{condition ? <A /> : <B />}` | `<Show when={() => condition} fallback={() => <B />}>` | Declarative branches manage node mounting/unmounting without parent re-renders. |
| `{items.map((item) => <Item key={...} />)}` | `<For each={() => items}>` | `.map()` creates a brand-new array of VDOM elements on every render. `<For>` provides fine-grained list reconciliation. |
| Destructuring fast-changing props at root | `<Snippet data={() => prop}>` | Destructuring at component root causes the entire returned JSX block to re-render. `<Snippet>` isolates reads to an inline DOM leaf. |

---

## Conditional Rendering (`<Show>`)

`<Show>` provides declarative conditional rendering that manages DOM nodes with fine-grained reactivity.

### Syntax & Payload Unwrapping
When the `when` accessor returns a truthy value, `<Show>` passes that truthy value directly to the child render callback. You can pass payload objects through `when` using `&&` so the renderer can destructure properties directly:

```tsx
import { setup, Show } from '@airlib/react'; // or '@airlib/solid'
import { getUser } from './function.js';

export const UserCard = setup<{ id: string }>((props) => {
  // Direct reactive binding to colocated IRPC function
  const user = getUser.with(() => [props.id]);

  return () => (
    <div className="user-card-container">
      {/* 1. Pending branch */}
      <Show when={() => user.status === 'pending'}>
        {() => <div className="spinner">Loading user profile...</div>}
      </Show>

      {/* 2. Error branch: passes error object so renderer can destructure message */}
      <Show when={() => user.status === 'error' && user.error}>
        {({ message }) => <p className="error-badge">{message}</p>}
      </Show>

      {/* 3. Success branch: passes user.data so renderer can destructure fields */}
      <Show
        when={() => user.status === 'success' && user.data}
        fallback={() => <p className="empty-state">No profile found.</p>}
      >
        {({ name, email }) => (
          <div className="profile-details">
            <h2>{name}</h2>
            <p>{email}</p>
          </div>
        )}
      </Show>
    </div>
  );
}, 'UserCard');
```

---

## List Iteration (`<For>`)

Never use `{items.map(...)}` in AirLib. Use `<For each={() => items}>` to ensure fine-grained list reconciliation:

```tsx
import { setup, For, Show, mutable } from '@airlib/react'; // or '@airlib/solid'

export interface Task {
  id: string;
  title: string;
  done: boolean;
}

export const TaskList = setup(() => {
  const tasks = mutable<Task[]>([
    { id: '1', title: 'Design component API', done: true },
    { id: '2', title: 'Write fine-grained tests', done: false },
  ]);

  return () => (
    <ul className="task-list">
      <For each={() => tasks}>
        {(task) => (
          <li className={task.done ? 'completed' : ''}>
            <span>{task.title}</span>
            <Show when={() => task.done}>
              {() => <span className="badge">Done</span>}
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}, 'TaskList');
```

---

## Isolated Leaf Updates with `<Snippet>`

`<Snippet>` isolates a reactive read to a single DOM fragment without re-rendering the surrounding component:

```tsx
import { template, Snippet } from '@airlib/react'; // or '@airlib/solid'

export const ServerMetrics = template<{ metrics: ServerMetricsStore }>(({ metrics }) => (
  <div className="metrics-card">
    <h2>Server Status</h2>
    <p className="static-desc">Real-time telemetry stream</p>

    {/* Only this span updates when CPU changes; parent card never re-renders */}
    <Snippet data={() => metrics.cpu}>
      {(cpu) => <span className="metric-badge">CPU: {cpu}%</span>}
    </Snippet>

    {/* Only this span updates when memory changes */}
    <Snippet data={() => metrics.memory}>
      {(memory) => <span className="metric-badge">RAM: {memory}MB</span>}
    </Snippet>
  </div>
), 'ServerMetrics');
```

### Passing Objects to `<Snippet>`
You can pass an entire object or getter function to `<Snippet>` to destructure reactive values in an isolated scope:

```tsx
<Snippet data={() => user}>
  {({ name, email, role }) => (
    <div className="user-info">
      <span>{name ?? 'Loading...'}</span>
      <span>{email}</span>
      <span>{role}</span>
    </div>
  )}
</Snippet>
```

---

## Semantic Boundaries (`snippet()`)

When an isolated UI piece represents a distinct concept or is rendered multiple times, use the `snippet()` factory:

```tsx
import { setup, snippet } from '@airlib/react'; // or '@airlib/solid'

export const TelemetryDashboard = setup(() => {
  const metrics = getMetricsStore();

  // Named semantic boundary — re-renders independently when metrics.cpu changes
  const CpuMeter = snippet(() => (
    <div className="cpu-meter">CPU: {metrics.cpu}%</div>
  ), 'CpuMeter');

  // Named semantic boundary — re-renders independently when metrics.ram changes
  const RamMeter = snippet(() => (
    <div className="ram-meter">RAM: {metrics.ram}GB</div>
  ), 'RamMeter');

  return () => (
    <div className="dashboard-grid">
      <h2>System Telemetry</h2>
      <CpuMeter />
      <RamMeter />
    </div>
  );
}, 'TelemetryDashboard');
```

### When to Use `<Snippet>` vs `snippet()`:
- **Use `<Snippet>`**: For tiny, localized inline updates (e.g. single badge, live count, ticker) without creating extra helper variables.
- **Use `snippet()`**: When the isolated UI represents a distinct semantic section or needs to be rendered multiple times in the component.

---

## Reactive Boundary Rules & Fragmentation Heuristics

- **Setup Body is Static (Prohibited Reads)**:
   The outer `setup()` body executes **only once**. Any reactive read directly in the setup body is prohibited. To compute or react inside `setup()`, wrap logic in `derived(() => ...)` or `effect(() => ...)`.

- **Root Render Reads Re-render the Entire Block**:
   When you read or destructure a property inside `return () => (...)` (e.g. `return ({ frequentProp }) => ...`), the **entire returned JSX block will re-render** on every mutation.
   - In small components (buttons, badges), re-rendering the full block is cheap and fine.
   - In heavy views (dashboards, tables), delegate localized reads to `<Snippet>`, `<Show>`, or `<For>`.
   - `({ children })` at the component root is safe because children rarely change.

- **View Size Heuristic (When to Fragment)**:
   - **Small views**: Simple buttons, badges, or toggles don't need excessive fragmentation.
   - **Large views**: Always isolate fast-updating pieces with `<Show>`, `<For>`, or `<Snippet>` to protect the surrounding layout from re-rendering.
