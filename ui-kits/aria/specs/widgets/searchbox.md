# Searchbox Specification

A searchbox is a specialized type of textbox intended for entering search queries.

- **Role**: `searchbox`
- **WAI-ARIA Role**: `searchbox`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Search** | Native `<input type="search">`. Native clear button, Enter submission, and search event. | `role="searchbox"` (omitted if native). `aria-label`, `aria-invalid`, `aria-required`. | Headless search query controller with `role: 'searchbox'`. Handles live query synchronization and validity reflection. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SearchboxOptions`
```ts
export interface SearchboxOptions extends AriaOptions {}
```

#### `SearchboxProps`
```ts
export interface SearchboxProps extends AriaProps {
  /** Current search query value */
  value?: string;
  /** Accessible label */
  label?: string;
  /** Placeholder hint */
  placeholder?: string;
  /** Readonly indicator */
  readonly?: boolean;
  /** Disabled indicator */
  disabled?: boolean;
  /** Required validation indicator */
  required?: boolean;
  /** Invalid indicator compiled to aria-invalid */
  invalid?: boolean | 'grammar' | 'spelling';
}
```

### 2. Overload Contract

```ts
// Searchbox: Search input controller (dedicated SearchboxAria controller)
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
