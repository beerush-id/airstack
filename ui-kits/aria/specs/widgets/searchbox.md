# Searchbox Specification

A searchbox is a specialized type of textbox intended for entering search queries.

- **Role**: `searchbox`
- **WAI-ARIA Role**: `searchbox`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Search** | Native `<input type="search">`. Native clear button, Enter submission, and search event. | `role="searchbox"` (omitted if native). `aria-label` or `aria-labelledby`. | Public face over the shared textbox mid controller with `role: 'searchbox'` (see `textbox`). Handles live query synchronization. |
| **Custom Searchbox** | Non-native input container (`<div>`). | `role="searchbox"`, `aria-label` / `aria-labelledby`, `tabindex="0"`. | Polyfills text input behavior and search query dispatching. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SearchboxOptions`
```ts
export interface SearchboxOptions {
  /** Whether bound to native <input type="search"> (default: true) */
  native?: boolean;
}
```

#### `SearchboxProps`
```ts
export interface SearchboxProps {
  /** Current search query value */
  value?: string;
  /** Accessible label */
  label?: string;
  /** Placeholder hint */
  placeholder?: string;
  /** Disabled indicator */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Searchbox: Search-query face over the shared textbox mid controller
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'searchbox',
  props?: SearchboxProps,
  options?: SearchboxOptions
): SearchboxAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`value`)**:
   - String getter and setter for the active search query.
   - Updates propagate synchronously through the `value` setter; debouncing (if any) lives in consumer wrappers, never in the controller.
