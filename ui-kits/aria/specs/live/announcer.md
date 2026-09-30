# Announcer Specification

An announcer is the single live region an author holds for everything worth announcing: advisory results ("Draft
saved"), urgent interruptions ("Deployment failed"), append-only streams (chat, build output), and silent counters or
tickers that speak only at milestones. Urgency is carried by the `politeness` prop, never by a separate entity.

- **Entity**: `announcer`
- **WAI-ARIA Role**: `status` (compiled output)

---

## The Three Semantic Layers

| Context              | HTML Semantic                                      | WAI-ARIA Semantic                                                          | Aria Package Semantic Contract                              |
|:---------------------|:---------------------------------------------------|:---------------------------------------------------------------------------|:------------------------------------------------------------|
| **Native Output**    | Native `<output>` element. Implicit `status` role. | `role="status"` (omitted if `<output>`).                                   | Advisory announcement manager.                              |
| **Custom Announcer** | Non-semantic element (`<div>`).                    | `role="status"`, `aria-live`, `aria-atomic`, `aria-busy`, `aria-relevant`. | Compiles `role="status"` and the announcement tuning below. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface AnnouncerOptions {
  /** Whether bound to native <output> (default: false) */
  native?: boolean;
}

export interface AnnouncerProps {
  /** Announcement priority (default: 'polite') */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether the whole region is announced as one unit (default: true) */
  atomic?: boolean;
  /** Whether the region is actively busy updating */
  busy?: boolean;
  /** Relevant change kinds to monitor, compiled to aria-relevant */
  relevant?: string;
}
```

### 2. Overload Contract

```ts
// Announcer: Single live region with politeness variants
export function aria<E extends BaseElement = HTMLElement>(
  role: 'announcer',
  props?: AnnouncerProps,
  options?: AnnouncerOptions
): AnnouncerAria<E>;
```

---

## State & Lifecycle Rules

1. **Politeness Variants**:
  - **Advisory** (`politeness: 'polite'`, default): waits its turn and announces the whole message once. Atomic by
    default.
  - **Urgent** (`politeness: 'assertive'`): interrupts whatever is being read. Never moves focus.
  - **Stream** (`politeness: 'polite'`, `atomic: false`): announces an appended entry on its own, never the whole
    history.
  - **Silent** (`politeness: 'off'`): stays identified but narrates nothing; push milestones into a separate polite
    announcer. A ticking count or rotating ticker is rendered by the consumer and never compiled to an attribute.

2. **Pre-Rendered Container**:
  - The announcer container element should be present in the DOM prior to inserting dynamic message text so assistive
    technologies register the live observer before updates happen.
