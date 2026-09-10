# Search-Input Specification

A search-input is the query field an author holds for entering search queries.

- **Entity**: `search-input`
- **WAI-ARIA Role**: none (native input with `type="search"`; no role compiled)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Search** | Native `<input type="search">`. Native clear button, Enter submission, and search event. | No role compiled (native). `type="search"`, `aria-label`, `aria-invalid`, `aria-required`. | Headless search query controller with `role: 'search-input'`. Handles live query synchronization and validity reflection. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SearchInputOptions`
```ts
export interface SearchInputOptions extends AriaOptions {}
```

#### `SearchInputProps`
```ts
export interface SearchInputProps extends AriaProps {
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
// Search-Input: Search input controller (dedicated SearchInputAria controller)
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'search-input',
  props?: SearchInputProps,
  options?: SearchInputOptions
): SearchInputAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`value`)**:
   - String getter and setter for the active search query.
   - Updates propagate synchronously through the `value` setter; debouncing (if any) lives in consumer wrappers, never in the controller.
