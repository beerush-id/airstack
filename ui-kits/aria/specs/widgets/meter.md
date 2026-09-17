# Meter Specification

The bounded-gauge reporting unit. Reports a scalar measurement within a known range, distinct from Progress's task-completion semantics.

- **Entity**: `meter`
- **WAI-ARIA Role**: `meter` (on custom hosts; omitted on native `<meter>`)

### Parts
- **`Meter`**: Gauge reporting element.

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native `<meter>`** | Native `<meter>`. Uses `min`, `max`, and `value` directly in original units. | Implicit `role="meter"`. Role omitted. | Synchronizes clamped numeric value in original units without zero-offset mapping. |
| **Custom Host** | Custom element (`<div>`). | `role="meter"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`, `aria-valuetext`. | Compiles ARIA meter range semantics. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `MeterProps`
```ts
export interface MeterProps {
  /** Numeric measurement value */
  value?: number;
  /** Lower bound in original units (default: 0) */
  min?: number;
  /** Upper bound in original units (default: 100) */
  max?: number;
  /** Accessible name */
  label: string;
  /** Human-readable value label */
  valuetext?: string;
}
```

#### `MeterOptions`
```ts
export interface MeterOptions {
  /** Whether bound to native <meter> (default: true) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// Meter: Gauge
export function aria<E extends BaseElement = HTMLElement>(
  role: 'meter',
  props: MeterProps,
  options?: MeterOptions
): MeterAria<E>;
```

---

## State & Lifecycle Rules

1. **Original Units**:
   - Unlike `Progress`, `Meter` preserves original units and does **not** map bounds onto a zero-based interval.
   - `value` is clamped to `[min, max]`.
2. **No Interactive Controls**:
   - Meter owns no focus, tab stops, or keyboard stepping.
