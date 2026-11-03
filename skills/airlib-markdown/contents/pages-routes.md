# MDX Pages & Route Integration

AirLib compiles `.page.mdx` files through the universal file-based router pipeline. Every MDX page functions as both human-readable prose and a fully reactive component tree with direct access to route state and layout metadata.

---

## File Naming & Routing Conventions

AirLib differentiates between route pages and reusable markdown components by file suffix:

| File Pattern | Routing Behavior | Best Use Case |
|---|---|---|
| `pages/**/page.mdx` | Mounted at folder URL path | Documentation sections, guides, blogs |
| `pages/**/name.page.mdx` | Mounted at `/name` | Standalone content pages (e.g. `pages/faq.page.mdx`) |
| `*.mdx` (no `.page`) | Not routed; imported as component | Reusable snippets, product blurbs, modals |

MDX pages are detected automatically by `airPages()`. They participate in Universal SSR, static pre-rendering (SSG), and code splitting alongside `.tsx` pages.

---

## YAML Frontmatter

Every MDX page begins with a YAML frontmatter block that defines metadata for navigation, document head tags, and search indexing:

```yaml
---
title: "Extended Markdown"
description: "Write rich documentation pages with admonitions, tabbed code blocks, and interactive live demos."
nav: "Extended Markdown"
nav-icon: "markdown"
nav-priority: 40
keywords:
  - AirLib markdown
  - MDX documentation
  - interactive demos
---
```

### Metadata Exposure

Any custom key added to frontmatter (e.g. `author`, `category`, `publishedAt`) attaches to the route's configuration and becomes accessible to layout shells, navigation sidebars, and document head tags.

---

## Reserved Scope Identifiers

AirLib automatically injects three reactive context variables into the template scope of every MDX page:

| Identifier | Type | Description |
|---|---|---|
| `$state` | `RouteState` | The active route's reactive state (`$state.data`, `$state.params`, `$state.query`, `$state.error`). |
| `$context` | `RouteContext` | Route runtime context providing `$context.url` (`pathname`, `search`, `hash`). |
| `$children` | `JSX.Element` | Nested child outlet elements when the MDX file functions as a section layout. |

### Accessing Route State

When an MDX page is colocated with a data provider (e.g. `./route.js`), provider data binds directly to `$state`:

```mdx
---
title: "User Profile"
---

# Welcome, {$state.data?.user?.name}!

Your account plan is **{$state.data?.user?.plan}**.
```

NOTE: Do not declare top-level variables named `$state`, `$context`, or `$children` in MDX scripts or code blocks, as they are reserved for route bindings.

---

## Embedding JSX & AirLib Primitives

MDX pages can import and render any React or SolidJS component. Imports are placed at the top of the file directly following the YAML frontmatter:

#### React
```mdx
---
title: "Interactive Guide"
---

import { mutable, Show } from '@airlib/react';
import { Badge } from '@airlib/react/mdx';

export const counter = mutable(0);

# Reactive Guide <Badge variant="info" text="Live" />

Current count: {counter.value}

<button onClick={() => counter.value++}>
  Increment
</button>

<Show when={() => counter.value > 5}>
  <p>Goal reached!</p>
</Show>
```

#### SolidJS
```mdx
---
title: "Interactive Guide"
---

import { mutable, Show } from '@airlib/solid';
import { Badge } from '@airlib/solid/mdx';

export const counter = mutable(0);

# Reactive Guide <Badge variant="info" text="Live" />

Current count: {counter.value}

<button onClick={() => counter.value++}>
  Increment
</button>

<Show when={counter.value > 5}>
  <p>Goal reached!</p>
</Show>
```

---

## Importing MDX Files as Components

To embed formatted documentation or prose inside an existing JSX page or layout, import a plain `.mdx` file directly:

```tsx
// pages/overview/page.tsx
import { page } from '@airlib/react';
import ChangelogSnippet from '@/src/components/changelog.mdx';
import { overviewRoute } from './route.js';

export default page(overviewRoute).render(() => (
  <div className="overview-container">
    <h1>Product Overview</h1>
    <ChangelogSnippet />
  </div>
));
```

Imported MDX compiles at build time into an optimized component with zero runtime parser overhead.
