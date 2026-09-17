# Progress Specification

The task-completion status unit. Normalizes determinate and indeterminate progress reporting across native `<progress>` and custom elements.

- **Entity**: `progress` (or `progressbar`)
- **WAI-ARIA Role**: `progressbar` (on custom hosts; omitted on native `<progress>`)

### Parts
- **`Progress`**: Progress indicator element.

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native `<progress>`** | Native `<progress>` element. Native `max = max - min`, `value = clampedValue - min`. | Implicit `role="progressbar"`. Omitted on native progress. | Zero-based native progress interval mapping. |
| **Custom Element** | Visual progress element (`<div>`). | `role="progressbar"`, `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`. | Non-interactive indicator; compiles attributes. If `value` is null, renders as indeterminate (omits value attributes). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ProgressProps`
```ts
export interface ProgressProps {
  /** Current progress value (null indicates indeterminate) */
  value?: number | null;
  /** Lower bound (default: 0) */
  min?: number;
  /** Upper bound (default: 100) */
  max?: number;
  /** Accessible name */
  label: string;
  /** Human-readable string representation of progress */
  valuetext?: string;
}
```

#### `ProgressOptions`
```ts
export interface ProgressOptions {
  /** Whether bound to native <progress> (default: true) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// Progress: Indicator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'progress' | 'progressbar',
  props: ProgressProps,
  options?: ProgressOptions
): ProgressAria<E>;
```

---

## State & Lifecycle Rules

1. **Non-Interactive Widget**:
   - `progress` is read-only; it owns no focus or tab stops.
   - Determinate branch: measured relative to interval `(clampedValue - min) / (max - min)`.
   - Indeterminate branch (`value === null`): omits value attributes.
