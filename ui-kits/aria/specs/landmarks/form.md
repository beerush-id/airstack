# Form Landmark Specification

A form landmark designates a region that contains a collection of items and objects that, as a whole, combine to create a form when that form requires identification as a landmark.

- **Role**: `form`
- **WAI-ARIA Role**: `form`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Form** | Native `<form>` element. | `role="form"`. In HTML-to-ARIA mapping, a `<form>` is only exposed as a landmark if it has an accessible name. | Form landmark controller. Compiles `aria-label` or `aria-labelledby`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface FormLandmarkOptions {
  /** Whether bound to native <form> (default: true) */
  native?: boolean;
}

export interface FormLandmarkProps {
  /** Accessible label (required for landmark exposure) */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

---

## State & Lifecycle Rules

1. **Mandatory Accessible Name**:
   - In accordance with WAI-ARIA 1.2, `<form>` only functions as a navigable landmark when given an accessible label via `label` or `labelledby`.
   - Without a label, the controller compiles no `role` and renders a structural container.

### 2. Overload Contract

```ts
// Form: Significant form-area landmark (requires a label)
export function aria<E extends BaseElement = HTMLFormElement>(
  role: 'form',
  props?: FormLandmarkProps,
  options?: FormLandmarkOptions
): FormAria<E>;
```
