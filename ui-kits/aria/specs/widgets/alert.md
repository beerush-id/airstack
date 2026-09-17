# Alert Specification

The urgent inline announcement unit. Communicates critical messages assertively or status messages politely to screen readers without moving DOM focus.

- **Entity**: `alert`
- **WAI-ARIA Role**: `alert` (when `politeness: 'assertive'`) or `status` (when `politeness: 'polite'`)

### Parts
- **`Alert`**: Announcement element.

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Assertive Alert** | Text container (`<div>` / `<p>`). | `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`. | Announces critical messages immediately, interrupting speech. |
| **Polite Status** | Text container (`<div>` / `<p>`). | `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. | Announces status politely after current speech completes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `AlertProps`
```ts
export interface AlertProps {
  /** Alert message string */
  message?: string;
  /** Announcement urgency (default: 'assertive') */
  politeness?: 'assertive' | 'polite';
}
```

### 2. Overload Contracts

```ts
// Alert: Announcement
export function aria<E extends BaseElement = HTMLElement>(
  role: 'alert',
  props?: AlertProps
): AlertAria<E>;
```

---

## State & Lifecycle Rules

1. **Live Region Semantics**:
   - Compiles `role="alert"` + `aria-live="assertive"` when `politeness: 'assertive'`.
   - Compiles `role="status"` + `aria-live="polite"` when `politeness: 'polite'`.
   - Always sets `aria-atomic="true"`.
   - Never moves DOM focus.
