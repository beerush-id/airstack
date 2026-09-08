# Region Landmark Specification

A region landmark is a generic landmark containing an important, self-contained section of content that the author considers significant enough to be listed in a summary table of contents.

- **Role**: `region`
- **WAI-ARIA Role**: `region`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Section** | Native `<section>` element. | `role="region"`. In HTML-to-ARIA mapping, `<section>` only functions as a landmark if it has an accessible name. | Generic landmark controller. Compiles `aria-label` or `aria-labelledby`. |
| **Custom Region** | Non-semantic element (`<div>`). | `role="region"`, `aria-label` / `aria-labelledby`. | Compiles `role="region"` and accessible label. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface RegionLandmarkOptions {
  /** Whether bound to native <section> (default: true) */
  native?: boolean;
}

export interface RegionLandmarkProps {
  /** Accessible label (MANDATORY for landmark exposure) */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

---

## State & Lifecycle Rules

1. **Mandatory Accessible Name**:
   - A `region` MUST have an accessible name (`label` or `labelledby`) to be computed as a landmark. Without a label, it is treated as a generic structural container.
   - Without a label, the controller compiles no `role`.

### 2. Overload Contract

```ts
// Region: Named generic landmark (requires a label)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'region',
  props?: RegionLandmarkProps,
  options?: RegionLandmarkOptions
): RegionAria<E>;
```
