# Alert Live Region Specification

An alert is a dynamic message with important, usually time-sensitive information, requiring immediate notification without stealing focus.

- **Role**: `alert`
- **WAI-ARIA Role**: `alert`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Alert** | Dynamic message container (`<div>`). | `role="alert"`. Implicit `aria-live="assertive"`, `aria-atomic="true"`. | Urgent live notification manager. Compiles assertive live region attributes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface AlertProps {
  /** Politeness level (default: 'assertive') */
  politeness?: 'assertive' | 'polite' | 'off';
  /** Whether the entire element is presented as an atomic whole (default: true) */
  atomic?: boolean;
  /** Whether the region is actively busy updating */
  busy?: boolean;
}
```

### 2. Overload Contract

```ts
// Alert: Urgent live notification (assertive by default)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'alert',
  props?: AlertProps
): AlertAria<E>;
```

---

## State & Lifecycle Rules

1. **Pre-Rendered Container**:
   - The alert container element should be present in the DOM prior to inserting dynamic message text so assistive technologies register the live observer before updates happen.
