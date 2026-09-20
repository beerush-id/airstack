# Components & Views

This guide explains how to construct user interface elements in AirLib based on their required level of autonomy and reactivity.

---

## 1. UI Hierarchy: Choosing the Right Level

AirLib divides UI into three architectural tiers to prevent premature abstraction and unnecessary component overhead:

| Tier | When to Use | Reactivity | Mechanism |
|---|---|---|---|
| **Static UI** | Content never changes or browser handles behavior natively (e.g. `<details>`, `<dialog>`) | None | Plain HTML elements |
| **Reactive UI (View)** | Presenting external data or wrapping reactive children without owning internal state, lifecycle, or context setup | Read-only | `template()` / `$use()` (React) or standard function (SolidJS) |
| **Autonomous Component** | Self-governing unit owning its own state (`mutable`), lifecycle hooks (`onMount`), context setup (`ctx.set`), or state contracts (`$bind`) | Read & Write | `setup()` / `$bind()` |

---

## 2. Static UI

Use plain HTML elements inline whenever the interface does not depend on reactive state:

```tsx
export const Header = () => (
  <header className="header">
    <h1>Dashboard</h1>
    <details>
      <summary>Help</summary>
      <p>Click items to inspect metrics.</p>
    </details>
  </header>
);
```

Native HTML elements manage their own presentation and open/close states without JavaScript wrappers.

---

## 3. Reactive UI (`template`)

A Reactive UI presents external reactive data without owning it. It reads from a source (a prop, store, or state) and updates when that data changes, without maintaining its own internal state or lifecycle.

### React Pattern

```tsx
import { template, mutable, $use } from '@airlib/react';

// Reusable reactive label presentation
const StatusLabel = template<{ text: string }>(({ text }) => (
  <span className="status-label">{text}</span>
), 'StatusLabel');

// Shared external state
const appState = mutable({ status: 'Connecting...' });

export const StatusBar = () => (
  <div className="status-bar">
    {/* $use binds the reactive property to the template prop */}
    <StatusLabel text={$use(appState, 'status')} />
  </div>
);
```

### Child Wrapper Views (e.g., `TabList`, `Card`, `Badge`)

Views that simply present props or wrap reactive children without internal state, lifecycle hooks, or context configuration MUST use `template()`, NEVER `setup()`:

```tsx
import { template } from '@airlib/react';
import type { ReactNode } from 'react';

// React: use template() for reactive presentation wrappers
export const TabList = template<{ children?: ReactNode }>(({ children }) => (
  <div className="tab-list" role="tablist">
    {children}
  </div>
), 'TabList');
```

```tsx
import type { JSX } from 'solid-js';

// SolidJS: plain function component is already fine-grained
export const TabList = (props: { children?: JSX.Element }) => (
  <div class="tab-list" role="tablist">
    {props.children}
  </div>
);
```

WARNING: **Never use `setup()` for pure views or child wrappers!**
Do NOT write `const TabList = setup(() => { return ({ children }) => ... })`.
If a component does not maintain internal state (`mutable`), register lifecycle hooks (`onMount`), or configure ambient context (`ctx.set()`), it is a **View** and MUST use `template()`. Using `setup()` for a pure view creates empty initialization closures and violates tier boundaries.


---

## 4. Autonomous Components (`setup`)

An autonomous component is a self-governing unit that owns its own state, behavior, and lifecycle.

### Core Structure: Initializer Runs Once

`setup()` executes the outer function **once on initialization**. The returned inner function is the render function that re-executes when reactive dependencies update.

```tsx
import { setup, mutable } from '@airlib/react'; // or '@airlib/solid'

export const Counter = setup(() => {
  // Local state initialized ONCE
  const state = mutable({ count: 0 });

  const increment = () => {
    state.count++;
  };

  // Render function
  return () => (
    <button className="counter-btn" onClick={increment}>
      Clicks: {state.count}
    </button>
  );
}, 'Counter');
```

### Reactive Boundary Rules in Components

Understanding where reactive reads occur is critical for performance and correctness:

WARNING: **1. The Setup Body is Static — Direct Reads are Prohibited**
The outer `setup()` function runs **once on initialization**. Reading a reactive property directly in the setup body (e.g., `if (props.value)` or `const x = state.count`) is **prohibited** and will trigger a runtime warning. Any reactive logic in the setup body must be encapsulated inside `derived(() => ...)` or `effect(() => ...)`.

IMPORTANT: **2. Render Function Reads Re-render the Whole Block**
The returned function `return () => (...)` is the reactive view. Any reactive property read or destructured at this root level (e.g. `return ({ frequentProp }) => ...`) causes the **entire component block to re-render** when that property mutates.
- **Cost scales with view size**: In small components (buttons, badges, toggles), re-rendering the full block is cheap and completely fine. In large/heavy views, it is expensive and should be avoided.
- **When to delegate**: In larger views, only read/destructure at the root if the value genuinely affects the overall layout; otherwise, delegate localized reads to `<Snippet>`.
- **Children are safe**: Destructuring `({ children })` at the root is safe because children rarely change.

TIP: **3. View Size Heuristic: When to Fragment**
- **Small views**: If the whole component is small (e.g. a simple button, badge, or toggle), a full re-render is cheap and completely fine. Do not prematurely fragment tiny components.
- **Large views**: If the component has heavy markup or complex children (e.g. hero sections, dashboards, cards), always fragment fast-updating pieces into `<Snippet>` or semantic `snippet()` to protect the parent layout.

---

## 5. Two-Way State Binding (`$bind` and `Bindable<T>`)

### The Problem: Parent Micromanagement
In traditional one-way data flow, a parent often ends up micromanaging every child (e.g. tracking `isActive` for 10 buttons, passing 10 `onClick` callbacks).

### The AirLib Solution: Two-Way State Contracts
1. The child component declares `value?: Bindable<T>`.
2. The child determines its own active state and updates `props.value` directly.
3. The parent connects state using `$bind(state, 'property')`. Updates propagate bidirectionally with zero callback plumbing.
4. `onClick` is reserved strictly for **side effects** (e.g., analytics, closing a menu), not state control.

### Example: Standalone Autonomous Toggle

```tsx
import { setup, derived, type Bindable } from '@airlib/react'; // or '@airlib/solid'

interface ToggleProps {
  label: string;
  value?: Bindable<boolean>;
  onChange?: (val: boolean) => void; // Strictly for side effects
}

export const Toggle = setup<ToggleProps>((props) => {
  const isChecked = derived(() => Boolean(props.value));

  const toggle = () => {
    props.value = !isChecked.value;
    props.onChange?.(props.value);
  };

  return () => (
    <button
      className={isChecked.value ? 'toggle-btn active' : 'toggle-btn'}
      onClick={toggle}
      role="switch"
      aria-checked={isChecked.value}
    >
      {props.label}: {isChecked.value ? 'ON' : 'OFF'}
    </button>
  );
}, 'Toggle');
```

### Standalone Controls vs. Compound Groups

IMPORTANT:
- **Standalone Controls** (e.g. `<Toggle value={$bind(state, 'darkMode')} />`, `<TextInput value={$bind(state, 'email')} />`): Direct binding on the component is the standard, ergonomic pattern.
- **Compound Groups / Collections** (e.g. `<Accordion>`, `<Tabs>`, `<RadioGroup>`, `<Select>`): For coordinated groups, prefer binding on the container (`<Accordion value={$bind(state, 'activeTab')}>`), which exposes ambient context via module-level `const ctx = createContext<T>()` and `ctx.set(state)` for items to read automatically via `ctx.get()`.
- **Dual-Mode Capability**: Well-designed collection items can support both! When inside a group, they read and coordinate through ambient context; when used standalone or given an explicit override binding (`open={$bind(state, 'isOpen')}`), their local prop takes precedence. See [Section 8](#8-ambient-context--compound-components-createcontext).

---

## 6. Lifecycle Hooks (`onMount`, `onCleanup`)

AirLib components support standard lifecycle hooks for managing setup and teardown:

- **`onMount(() => { ... return () => { /* cleanup */ } })`**: Runs once after the component mounts into the DOM. If it returns a function, that function is executed when the component unmounts.
- **`onCleanup(() => { ... })`**: Registered in the component `setup()` body. Executes when the component unmounts.

### Example: Mount with Return Teardown

```tsx
import { setup, mutable, onMount } from '@airlib/react'; // or '@airlib/solid'

export const WindowTracker = setup(() => {
  const state = mutable({ width: 0 });

  onMount(() => {
    const handleResize = () => {
      state.width = window.innerWidth;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Teardown for onMount is returned directly from the handler
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  return () => <div>Window Width: {state.width}px</div>;
}, 'WindowTracker');
```

### Example: Component Teardown (`onCleanup`)

```tsx
import { setup, onCleanup } from '@airlib/react'; // or '@airlib/solid'

export const PollingWidget = setup(() => {
  const timer = setInterval(() => {
    // Periodic synchronization
  }, 5000);

  // Cleans up resources when the component unmounts
  onCleanup(() => {
    clearInterval(timer);
  });

  return () => <div>Polling Active</div>;
}, 'PollingWidget');
```


---

## 7. Rendering Children: Direct `{children}` vs. `renderDynamic`

### The Golden Rule
IMPORTANT:
- **Standard Children (`ReactNode` / `JSXElement`)**: Render directly as `{children}` or `{props.children}`. Destructuring `({ children })` in the render function is safe and idiomatic. **NEVER** wrap standard JSX children in `renderDynamic`.
- **Render Props / Polymorphic Callables**: Use `renderDynamic(props.children, ...args)` **ONLY** when the prop is explicitly typed to accept a render function or accessor (e.g. `children?: ReactNode | ((status: string) => ReactNode)`).

#### Standard Children in Presentational Views (`template`):

```tsx
import { template } from '@airlib/react';
import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  children?: ReactNode;
}

// Presentational View: uses template()
export const Card = template<CardProps>(({ title, children }) => (
  <div className="card">
    <h3>{title}</h3>
    <div className="card-body">{children}</div>
  </div>
), 'Card');
```


#### Polymorphic / Render Prop Children (When accepting either JSX or an accessor function):
```tsx
import { template, renderDynamic, type Bindable } from '@airlib/react';

interface StatusCardProps {
  loading?: Bindable<boolean>;
  children?: JSX.Element | ((status: string) => JSX.Element);
}

// Presentational View: uses template()
export const StatusCard = template<StatusCardProps>(({ loading, children }) => {
  if (loading) {
    return <div className="card loading"><p>Loading details...</p></div>;
  }

  return (
    <div className="card active">
      {renderDynamic(children, 'Ready')}
    </div>
  );
}, 'StatusCard');
```

---
## 8. Ambient Context & Compound Components (`createContext`)

When building collection-based UI (e.g., `Accordion`, `Tabs`, `RadioGroup`, `Select`, `Breadcrumbs`), the parent container coordinates state and distributes it via ambient context.

TIP: **Prefer Module-Level `createContext<T>()`**
Always define `const ctx = createContext<T>()` at the module level.
In the container's `setup()` body, call `ctx.set(state)`.
In the member's `setup()` body, call `const state = ctx.get()`.
This pattern is strongly preferred over bare `setContext` / `getContext` with manual symbol keys because it provides automatic type safety and clean ergonomics.

### Architectural Rule: Container Coordinates, Members Consume
1. **Container (`<Accordion value={$bind(state, 'active')}>`)**:
   - Accepts the state contract (`value?: Bindable<string>`).
   - In its `setup()` body, establishes ambient context via `accordionCtx.set(...)`.
   - Directly renders `{children}` — no cloning, no prop hijacking.
2. **Member (`<Accordion.Item value="section-1">`)**:
   - Accepts its own identifier (`value: string`) and display content.
   - Retrieves ambient context via `accordionCtx.get()`.
   - Uses `derived()` to compute its active status (`derived(() => ctx?.value === props.value)`).
   - Calls `ctx?.select(props.value)` on interaction.
3. **Consumer DX**: The caller binds once on the root container, avoiding redundant boilerplate across items.

### Example: Accordion Compound Component

#### 1. Context Definition (`accordion.context.ts`)
```ts
import { createContext, type Bindable } from '@airlib/react'; // or '@airlib/solid'

export interface AccordionState {
  value?: Bindable<string>;
  select: (val: string) => void;
}

// Module-level typed context handle
export const accordionCtx = createContext<AccordionState>();
```

#### 2. Container (`Accordion.tsx`)
```tsx
import { setup, type Bindable } from '@airlib/react'; // or '@airlib/solid'
import type { ReactNode } from 'react';
import { accordionCtx } from './accordion.context.js';

interface AccordionProps {
  value?: Bindable<string>;
  children?: ReactNode;
}

export const Accordion = setup<AccordionProps>((props) => {
  // Set ambient context in setup body
  accordionCtx.set({
    get value() {
      return props.value;
    },
    select(itemValue: string) {
      props.value = itemValue;
    },
  });

  // Direct children rendering
  return ({ children }) => (
    <div className="accordion-group">
      {children}
    </div>
  );
}, 'Accordion');
```

#### 3. Dual-Mode Member Item (`AccordionItem.tsx`)
```tsx
import { setup, derived, type Bindable } from '@airlib/react'; // or '@airlib/solid'
import type { ReactNode } from 'react';
import { accordionCtx } from './accordion.context.js';

interface AccordionItemProps {
  value?: string;
  open?: Bindable<boolean>; // Allows standalone usage or explicit item-level override
  title: string;
  children?: ReactNode;
}

export const AccordionItem = setup<AccordionItemProps>((props) => {
  const ctx = accordionCtx.get();

  // Dual-mode: Explicit local prop binding takes precedence; otherwise fall back to ambient context
  const isOpen = derived(() => {
    if (props.open !== undefined) {
      return Boolean(props.open);
    }
    return ctx && props.value !== undefined ? ctx.value === props.value : false;
  });

  const toggle = () => {
    if (props.open !== undefined) {
      props.open = !isOpen.value;
    } else if (ctx && props.value !== undefined) {
      ctx.select(isOpen.value ? '' : props.value);
    }
  };

  return ({ children }) => (
    <div className={`accordion-item ${isOpen.value ? 'open' : ''}`}>
      <button className="accordion-trigger" onClick={toggle}>
        {props.title}
      </button>
      {isOpen.value && (
        <div className="accordion-body">
          {children}
        </div>
      )}
    </div>
  );
}, 'AccordionItem');
```

#### 4. Clean Caller Usage

```tsx
import { setup, mutable, $bind } from '@airlib/react'; // or '@airlib/solid'
import { Accordion } from './Accordion.js';
import { AccordionItem } from './AccordionItem.js';

export const FAQ = setup(() => {
  const state = mutable({
    activeSection: 'faq-1',
    standaloneOpen: false,
  });

  return () => (
    <div className="faq-page">
      {/* 1. Group Usage: Container coordinates state via ambient context */}
      <Accordion value={$bind(state, 'activeSection')}>
        <AccordionItem value="faq-1" title="What is AirLib?">
          AirLib is a high-performance reactive fullstack toolkit.
        </AccordionItem>
        <AccordionItem value="faq-2" title="How does compound context work?">
          Ambient context allows member components to read and write without prop drilling.
        </AccordionItem>
      </Accordion>

      {/* 2. Standalone / Override Usage: Item accepts its own direct binding */}
      <AccordionItem
        open={$bind(state, 'standaloneOpen')}
        title="Can an item be used standalone?"
      >
        Yes! Dual-mode components support direct binding when used outside a group.
      </AccordionItem>
    </div>
  );
}, 'FAQ');
```

---

## 9. Dependency Injection & Global Services (`createContext`)

Similarly, for global services or shared application state, define a typed context handle at module level:

```tsx
import { setup, createContext } from '@airlib/react'; // or '@airlib/solid'
import type { AuthService } from './services/auth.js';

export const authCtx = createContext<AuthService>();

export const UserMenu = setup(() => {
  const auth = authCtx.get();

  return () => (
    <div className="user-menu">
      <span>{auth?.user?.name ?? 'Guest'}</span>
    </div>
  );
}, 'UserMenu');
```

NOTE: Bare `setContext(key, value)` and `getContext(key)` exist as lower-level engine primitives, but `const ctx = createContext<T>()` with `ctx.set()` and `ctx.get()` is the standard, strongly-typed API for application and component code.

---

## 10. Unique Identifiers & Scoped Counters (`uuid`, `shortId`, `uIndex`)

When generating stable DOM IDs, accessibility pairings, keys, or compound component indexes, use AirLib's built-in identifier utilities from `@airlib/react/utils` or `@airlib/solid/utils`:

### `uuid()`
Generates a standard random UUID v4 string (with native `crypto.randomUUID()` fallback):

```ts
import { uuid } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const id = uuid();
// e.g. "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
```

### `shortId()`
Generates a URL-friendly, compact identifier combining timestamps and random entropy:

```ts
import { shortId } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const id = shortId();
// e.g. "m1k8s000a1b2"
```

### `uIndex(symbol, scoped?)`
Generates auto-incrementing integers keyed by a `symbol`. By default, `uIndex` increments within the current active context (such as the current component closure when called inside `setup()`):

```tsx
import { setup } from '@airlib/react'; // or '@airlib/solid'
import { uIndex } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const ITEM_INDEX = Symbol('item-index');

export const ItemList = setup(() => {
  // Scoped to this component instance
  const firstId = uIndex(ITEM_INDEX); // 1
  const secondId = uIndex(ITEM_INDEX); // 2

  return <div id={`item-${firstId}`} />;
});
```

Passing `scoped: true` creates or reads a shared counter container across child scopes (useful for compound components like tabs or code groups):

```typescript
import { uIndex } from '@airlib/react/utils'; // or '@airlib/solid/utils'

const GROUP_INDEX = Symbol('group-index');

// Shares an index sequence with nested child scopes
const groupId = uIndex(GROUP_INDEX, true);
```
