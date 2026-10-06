# Progress Specification

The task-completion status unit. Normalizes determinate and indeterminate progress reporting across native `<progress>`
and custom elements.

- **Entity**: `progress`
- **WAI-ARIA Role**: `progressbar` (on custom hosts; omitted on native `<progress>`)

### Parts

- **`Progress`**: Progress indicator element.

---

## The Three Semantic Layers

| Context                 | HTML Semantic                                                                        | WAI-ARIA Semantic                                                                                                                                                                  | Aria Package Semantic Contract                                                                                                   |
|:------------------------|:-------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------|
| **Native `<progress>`** | Native `<progress>` element. Native `max = max - min`, `value = clampedValue - min`. | Implicit `role="progressbar"`. Omitted on native progress.                                                                                                                         | Zero-based native progress interval mapping. Native `value` attribute is removed for indeterminate progress.                     |
| **Custom Element**      | Visual progress element (`<div>`).                                                   | `role="progressbar"`, `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (value attributes in declared units; omitted on the indeterminate branch). | Non-interactive indicator; compiles attributes. If `value` is absent or null, renders as indeterminate (omits value attributes). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ProgressProps`

```ts
export interface ProgressProps {
  /** Completion number (null/absent selects indeterminate; default: null) */
  value?: number | null;
  /** Lower bound (default: 0) */
  min?: number;
  /** Upper bound, strictly greater than min (default: 100) */
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
  /** Whether bound to native <progress> (default unstated by the source — see spec.md Default Options) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// Progress: Indicator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'progress',
  props: ProgressProps,
  options?: ProgressOptions
): ProgressAria<E>;
```

---

## State & Lifecycle Rules

1. **Non-Interactive Widget**:
  - `progress` is read-only; it owns no focus or tab stops. Updates expose current completion without moving DOM focus.
  - Determinate branch: `value` is clamped to `[min, max]` for reporting **without rewriting the consumed input**;
    completion is measured `(clampedValue - min) / (max - min)`, and native and custom hosts report the same completion
    fraction.
  - Indeterminate branch (absent or `null` `value`): omits value attributes; on a native host the `value` attribute is
    removed.
  - Native host maps the declared interval onto the zero-based native range (`max = max - min`,
    `value = clampedValue - min`); the ARIA host keeps declared units (`aria-valuenow` reflects the clamped value in
    original units).
  - Events: none.
