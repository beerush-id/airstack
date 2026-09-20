# Code Blocks & Interactive Demos

AirLib Extended Markdown features tabbed code groups, inline executable code blocks, and self-contained interactive component playgrounds.

---

## 1. Fenced Code Blocks & Titles

Standard fenced blocks include automatic syntax highlighting, top-right language labels, and hover-triggered copy buttons:

````mdx
```typescript [src/router.ts]
import { createRouter } from '@airlib/react';

export const router = createRouter();
```
````

Placing bracketed text `[filename.ext]` immediately following the language identifier renders a persistent floating title label.

---

## 2. Executable Code Blocks

Add execution attributes to fenced code blocks to run logic directly within the page context:

````mdx
```tsx executable
// Variables declared here are accessible in subsequent JSX
const pageVersion = '2.1.0';
```

```tsx executable="hidden"
// Runs logic but hides the code block from page view
const initialCount = 10;
```

```tsx module
// Evaluates at module scope for file-level exports
export const metadata = { category: 'guide' };
```
````

| Attribute | Behavior |
|---|---|
| `executable` | Executes in the page body; declared bindings are exposed to markdown JSX below it. |
| `executable="hidden"` | Executes in the page body without displaying the code fence in the rendered document. |
| `module` | Executes at module scope, allowing top-level exports or global constants. |

---

## 3. Tabbed Code Groups (`:::code-group`)

Use `:::code-group` to compare identical implementations across frameworks (React vs SolidJS) or package managers in a tabbed interface:

````mdx
:::code-group

```tsx [React]
import { setup } from '@airlib/react';

export const Counter = setup(() => {
  return () => <span>React Counter</span>;
});
```

```tsx [SolidJS]
import { setup } from '@airlib/solid';

export const Counter = setup(() => {
  return <span>Solid Counter</span>;
});
```

:::
````

Tabs automatically support keyboard navigation (Left/Right arrow keys switch tabs; Home/End jump to ends).

---

## 4. Interactive Demos (`:::interactive`)

Interactive demos embed live, runnable components directly inside documentation pages. Readers can interact with the rendered UI while viewing the component's implementation.

### Anatomy of an Interactive Block

An `:::interactive` block contains three parts in top-down order:
1. **Component Code Block (`tsx`)**: The component definition compiled and mounted in the page.
2. **Usage Code Block (Markup)**: A code fence showing how the component is consumed.
3. **Live JSX**: The interactive component rendered directly.

````mdx
:::interactive[Live Counter Demo]

**1. Define the Component:**

```tsx
import { mutable, setup } from '@airlib/react';

const ClickCounter = setup<{ start?: number }>((props) => {
  const count = mutable(props.start ?? 0);

  return () => (
    <button type="button" onClick={() => count.value++}>
      Count: {count.value}
    </button>
  );
}, 'ClickCounter');
```

**2. Use the Component:**

```html
<ClickCounter start={5} />
```

**3. Live Preview:**

<ClickCounter start={5} />

:::
````

### Standalone Demos

To execute demo components without showing code fences, add the `{standalone}` attribute:

````mdx
:::interactive[Live Preview]{standalone}

```tsx
const AlertBox = () => <div className="alert">Live System Notification</div>;
```

<AlertBox />

:::
````

### Best Practices for Demos
- Keep demo components self-contained—depend only on `@airlib/react` or `@airlib/solid`.
- Rely on `setup()` and `template()` to create clean reactive boundaries.
- Avoid asynchronous network requests in demos; use static mock stores instead.
