# Progressbar Specification

A progressbar is an element that displays the progress status for tasks that take a long time or involve multiple steps.

- **Role**: `progressbar`
- **WAI-ARIA Role**: `progressbar`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Progress** | Native `<progress>` element with `value` and `max`. | Implicit `role="progressbar"`. Omitted if native. | Pure attribute projection onto native progress element. |
| **Custom Progressbar** | Custom visual bar (`<div>`). | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`. | Non-interactive indicator; compiles attributes. If `value` is omitted/null, renders as indeterminate (omits `aria-valuenow`). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ProgressbarOptions`
```ts
export interface ProgressbarOptions {
  /** Whether bound to native <progress> (default: false) */
  native?: boolean;
}
```

#### `ProgressbarProps`
```ts
export interface ProgressbarProps {
  /** Current progress value (null/undefined indicates indeterminate) */
  value?: number | null;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Human-readable string representation of progress */
  valuetext?: string;
}
```

### 2. Overload Contract

```ts
// Progressbar: Deterministic/indeterminate progress indicator (non-interactive)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'progressbar',
  props?: ProgressbarProps,
  options?: ProgressbarOptions
): ProgressbarAria<E>;
```

---

## State & Lifecycle Rules

1. **Non-Interactive Widget**:
   - `progressbar` is read-only; it does not receive keyboard focus and does not have a `tabindex`.
   - When `value` is `null` or `undefined`, the progressbar is in an indeterminate state and `aria-valuenow` is omitted.
