# Toast Specification

The queued announcement unit. Coordinates timed visibility, hover/focus pause, close actions, and dismiss notifications.

- **Entity**: `toast`
- **Region WAI-ARIA Role**: `status` (`polite`) or `alert` (`assertive`)

### Composite Parts (Entity Tree)
- **`ToastRegion`**: Queue coordinator (`role="status" | "alert"`, `aria-live`, `aria-atomic="false"`).
- **`Toast`**: Individual toast item (`id: string`, `aria-labelledby`, `aria-describedby`).
- **`ToastTitle`**: Toast title text.
- **`ToastDescription`**: Toast description text.
- **`ToastClose`**: Close button (Button contract).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`ToastRegion`** | Live region container (`<section>` or `<div>`). | `role="status"` (`polite`) or `role="alert"` (`assertive`), `aria-live`, `aria-atomic="false"`. | Manages queue, default duration timer, and politeness. |
| **`Toast`** | Item container (`<div>`). | `aria-labelledby`, `aria-describedby`. | Individual toast item. Pauses timer on hover/focus. |
| **`ToastClose`** | Native `<button type="button">`. | Follows Button contract. | Commits toast removal. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ToastRegionProps`
```ts
export interface ToastRegionProps {
  /** Announcement urgency (default: 'polite') */
  politeness?: 'polite' | 'assertive';
  /** Default visible lifetime in milliseconds (default: 5000) */
  duration?: number;
}
```

#### `ToastProps`
```ts
export interface ToastProps {
  /** Unique toast identifier */
  id?: string;
  /** Custom lifetime override in milliseconds */
  duration?: number;
}
```

### 2. Overload Contracts

```ts
// ToastRegion: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toast-region',
  props?: ToastRegionProps
): ToastRegionAria<E>;

// Toast: Item
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toast',
  props?: ToastProps
): ToastAria<E>;

// ToastTitle
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toast-title',
  props?: AriaProps
): ToastTitleAria<E>;

// ToastDescription
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toast-description',
  props?: AriaProps
): ToastDescriptionAria<E>;

// ToastClose
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'toast-close',
  props?: AriaProps
): ToastCloseAria<E>;
```

---

## State & Lifecycle Rules

1. **Timer & Pause**:
   - Running timer pauses while pointer hovers over toast or while focus resides inside toast.
   - Resumes on leave or blur.
2. **Dismissal**:
   - Expiration or ToastClose click removes toast from queue.
   - Emits `CustomEvent<string>('dismiss', { bubbles: true, detail: id })` on ToastRegion.
