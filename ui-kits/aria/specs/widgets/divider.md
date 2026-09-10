# Divider Specification

A divider is a static line or boundary an author holds between sections of content or groups of menuitems. It is purely structural: it takes no focus and owns no value.

- **Entity**: `divider`
- **WAI-ARIA Role**: `separator` (compiled output)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Divider** | Native `<hr>` (horizontal rule). | Implicit `role="separator"`. Explicit `role` omitted. | Static visual divider. Non-focusable (`tabindex` omitted). |
| **Custom Divider** | Non-semantic element (`<div>`). | `role="separator"`, `aria-orientation` (if vertical). | Compiles `role="separator"` only on custom hosts. Non-focusable. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DividerOptions`
```ts
export interface DividerOptions {
  /** Whether bound to native <hr> (default: true) */
  native?: boolean;
}
```

#### `DividerProps`
```ts
export interface DividerProps {
  /** Divider axis (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
}
```

### 2. Overload Contract

```ts
// Divider: Static structural divider
export function aria<E extends BaseElement = HTMLElement>(
  role: 'divider',
  props?: DividerProps,
  options?: DividerOptions
): DividerAria<E>;
```

---

## State & Lifecycle Rules

1. **Static Only**:
   - A divider never takes a tab stop and never announces a value. For an interactive movable partition, see `splitter`.
   - `aria-orientation` is announced only when the divider departs from the horizontal default.
