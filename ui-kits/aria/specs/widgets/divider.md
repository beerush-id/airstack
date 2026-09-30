# Divider Specification

A divider is a static line or boundary an author holds between sections of content or groups of menuitems. It is purely structural: it takes no focus and owns no value. Divider has **no native archetype** — it is never bound to `<hr>` and exposes no `native` option; it always compiles its own semantics onto a custom host.

- **Entity**: `divider`
- **WAI-ARIA Role**: `separator` (always compiled — there is no implicit host to inherit it from)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Divider** | Custom element (`<div>` / `<span>`), authored by the consumer. **Not `<hr>`.** | `role="separator"` (always), `aria-orientation="vertical"` when the divider departs from the horizontal default. | Static structural divider. Non-focusable (no `tabindex`), no value. |

---

## Architectural & Behavioral Contracts

### 1. Props Contract

```ts
export interface DividerProps {
  /** Divider axis (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
}
```

> There is no `DividerOptions` / `native` flag — a divider always uses the custom ARIA path. A horizontal rule is a `<div role="separator">` with no `aria-orientation`; a vertical one adds `aria-orientation="vertical"`, sized by the author's CSS.

### 2. Overload Contract

```ts
// Divider: Static structural divider (custom host only)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'divider',
  props?: DividerProps
): DividerAria<E>;
```

---

## State & Lifecycle Rules

1. **Static Only**:
   - A divider never takes a tab stop and never announces a value. For an interactive movable partition, see [splitter.md](splitter.md).
   - `aria-orientation` is emitted only when `orientation` departs from the horizontal default.
   - The controller never renders or binds to `<hr>`; the host element is the author's.
