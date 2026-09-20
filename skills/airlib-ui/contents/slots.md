# Component Slots

This guide covers AirLib's named component slot system—allowing components to define customizable layout regions with default fallback content, populated declaratively by consumers without prop drilling.

---

## 1. Why Named Slots?

Passing JSX elements as individual props (e.g. `sidebar={<Sidebar />} header={<Header />}`) causes awkward prop drilling, creates bloat in component signatures, and forces parent components to manage child layout rendering.

AirLib provides first-class named slots:
- **`setup<Props, Slots>()`**: Components declare typed slot signatures in their second generic argument and receive `snippets` as the second parameter.
- **`<Slot for={...}>`**: Renders the consumer's injected slot snippet, or falls back to default children.
- **`<Component.Snippet for="...">`**: Consumers populate specific slots declaratively as direct children.

---

## 2. Defining Slots in a Component

Declare the slot signatures as a type where each slot is a function returning a renderable node, and render them with `<Slot>`:

### React Example

```tsx
import { setup, Slot, Snippet } from '@airlib/react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar.js';
import { TableOfContent } from './TableOfContent.js';

export type LayoutProps = {
  children?: ReactNode;
};

// 1. Declare available slots
export type LayoutSlots = {
  sidebar?: () => ReactNode;
  toc?: () => ReactNode;
};

// 2. Pass Slots type as second generic argument and receive snippets
export const Layout = setup<LayoutProps, LayoutSlots>((props, snippets) => {
  return () => (
    <div className="layout">
      <aside className="layout-sidebar">
        {/* Render slot or fallback content */}
        <Slot for={() => snippets.sidebar?.()}>
          <Sidebar />
        </Slot>
      </aside>

      <main className="layout-content">
        <Snippet>{() => props.children}</Snippet>
      </main>

      <aside className="layout-toc">
        <Slot for={() => snippets.toc?.()}>
          <TableOfContent />
        </Slot>
      </aside>
    </div>
  );
}, 'Layout');
```

### SolidJS Example

```tsx
import { setup, Slot } from '@airlib/solid';
import type { JSX } from 'solid-js';
import { Sidebar } from './Sidebar.js';
import { TableOfContent } from './TableOfContent.js';

export type LayoutProps = {
  children?: JSX.Element;
};

export type LayoutSlots = {
  sidebar?: () => JSX.Element;
  toc?: () => JSX.Element;
};

export const Layout = setup<LayoutProps, LayoutSlots>((props, snippets) => {
  return (
    <div class="layout">
      <aside class="layout-sidebar">
        <Slot for={snippets.sidebar?.()}>
          <Sidebar />
        </Slot>
      </aside>

      <main class="layout-content">
        {props.children}
      </main>

      <aside class="layout-toc">
        <Slot for={snippets.toc?.()}>
          <TableOfContent />
        </Slot>
      </aside>
    </div>
  );
}, 'Layout');
```

---

## 3. Populating Slots as a Consumer

Consumers inject custom content into specific slots using `<Component.Snippet>` with the `for` attribute matching the slot name:

### React Example

```tsx
import { Layout } from './Layout.js';
import { CustomSidebar } from './CustomSidebar.js';

export function DocumentationPage({ children }) {
  return (
    <Layout>
      {/* Populates the 'sidebar' slot */}
      <Layout.Snippet for="sidebar">
        {() => <CustomSidebar collapsible />}
      </Layout.Snippet>

      {/* Default children render into layout-content */}
      {children}
    </Layout>
  );
}
```

### SolidJS Example

```tsx
import { Layout } from './Layout.js';
import { CustomSidebar } from './CustomSidebar.js';

export function DocumentationPage(props) {
  return (
    <Layout>
      <Layout.Snippet for="sidebar">
        {() => <CustomSidebar collapsible />}
      </Layout.Snippet>

      {props.children}
    </Layout>
  );
}
```

NOTE: `<Component.Snippet>` must be a direct child of `<Component>` (or inside a Fragment) so the parent component can automatically discover and collect the named slots.

---

## 4. Contextual Slots (Scoped Data)

Slots can pass runtime state and context to the consumer's snippet renderer:

### Component Definition Passing State

```tsx
import { setup, Slot, mutable } from '@airlib/react'; // or '@airlib/solid'
import type { ReactNode } from 'react';

export type CollapsibleProps = {
  title?: string;
  children?: ReactNode;
};

// Slot function accepts context argument
export type CollapsibleSlots = {
  header?: (context: { expanded: boolean; toggle: () => void }) => ReactNode;
};

export const Collapsible = setup<CollapsibleProps, CollapsibleSlots>((props, snippets) => {
  const state = mutable({ expanded: false });
  const toggle = () => { state.expanded = !state.expanded; };

  return () => (
    <div className="collapsible-box">
      {/* Passes state and actions into the slot */}
      <Slot for={() => snippets.header?.({ expanded: state.expanded, toggle })}>
        <button onClick={toggle}>
          {props.title ?? 'Toggle'} ({state.expanded ? '▲' : '▼'})
        </button>
      </Slot>

      {state.expanded && (
        <div className="collapsible-content">
          {props.children}
        </div>
      )}
    </div>
  );
}, 'Collapsible');
```

### Consumer Using Contextual Slot

```tsx
import { Collapsible } from './Collapsible.js';

export function CustomAccordion() {
  return (
    <Collapsible>
      {/* Consumer receives the scoped context from the component */}
      <Collapsible.Snippet for="header">
        {({ expanded, toggle }) => (
          <header className="custom-accordion-header" onClick={toggle}>
            <h3>Advanced Settings</h3>
            <span className="badge">{expanded ? 'Open' : 'Closed'}</span>
          </header>
        )}
      </Collapsible.Snippet>

      <p>Content inside the collapsible body.</p>
    </Collapsible>
  );
}
```
