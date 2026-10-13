# Toast Specification

The one-shot announcement unit. The toast itself is the live region: it announces once on mount, stays visible for a timed lifetime, then commits a single removal. There is no `ToastRegion` — the toast is the region itself. There are no `ToastTitle`/`ToastDescription` parts — content structure is user land. What matters is the toast's state and role, so consuming components react to it (e.g. `!item.complete && <Toast .../>`).

- **Entity**: `toast`
- **Region WAI-ARIA Role**: `status` (`polite`) or `alert` (`assertive`)

### Composite Parts (Entity Tree)

- **`Toast`**: The live region item (`role="status" | "alert"`, `aria-live`, `aria-atomic="false"`). Owns its visibility timer.
- **`ToastClose`**: Close button (Button contract). Commits toast removal.

---

## The Three Semantic Layers

| Part / Role      | HTML Semantic                    | WAI-ARIA Semantic                                                                                | Aria Package Semantic Contract          |
|:-----------------|:---------------------------------|:-------------------------------------------------------------------------------------------------|:----------------------------------------|
| **`Toast`**      | Live region item (`<div>`).      | `role="status"` (`polite`) or `role="alert"` (`assertive`), `aria-live`, `aria-atomic="false"`.  | One-shot announcement, timed lifetime.  |
| **`ToastClose`** | Native `<button type="button">`. | Follows Button contract.                                                                         | Commits toast removal.                  |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ToastProps`

```ts
export interface ToastProps {
  /** Critical urgency (default: false) — `true` interrupts (`alert`), `false` waits its turn (`status`) */
  critical?: boolean;
  /** Visible lifetime in milliseconds. No timer arms unless given */
  duration?: number;
  /** Called after toast removal commits */
  ondismiss?: AriaEventHandler<ToastEvent>;
}
```

### 2. Overload Contracts

```ts
// Toast: one-shot live region
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toast',
  props?: ToastProps
): ToastAria<E>;

// ToastClose: removal button
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'toast-close',
  props?: AriaProps
): ToastCloseAria<E>;
```

---

## State & Lifecycle Rules

1. **One-shot lifetime**:
   - A toast announces once on mount and never re-announces.
   - The visibility timer starts when the instance is created and is cancelled on cleanup.
   - When `duration` is given, it stays visible for that lifetime; when time is up the controller sets its internal `state.dismissed = true`. Without `duration` no timer arms and the toast lives until dismissed. A toast is always born alive.
   - `dismissed` is instance-local lifecycle state exposed through a getter; `dismiss()` commits removal early through the same exactly-once path. Removal fires exactly once — expiry, close, and `dismiss()` can never double-commit, and a dismissed toast never re-arms.
2. **Pause**:
   - The running timer pauses while the pointer hovers over the toast or while focus resides inside it; resumes on leave/blur.
   - (The only keyboard path inside a toast is `ToastClose`, which is also its removal control.)
3. **Dismissal**:
   - Expiration, ToastClose activation, or `dismiss()` commits toast **removal**: the controller emits
     `dismiss` (`{ bubbles: true }`, no detail) on the toast element and invokes `ondismiss`; the element itself (`event.target`) identifies the dismissed instance — the toast carries no id.
   - The controller emits `dismiss` but does not detach the DOM node; removal from the rendered tree is the consumer's reaction to `dismiss`.
4. **Region semantics**: `role="status"` + `aria-live="polite"` by default, `role="alert"` +
   `aria-live="assertive"` when `critical`, and `aria-atomic="false"` always (partial updates announce).
