# Live Regions Overview

Live regions allow assistive technologies to automatically announce dynamic content updates without requiring the user
to shift focus away from their current interaction point. The package holds a single announcer entity; urgency travels
in the `politeness` prop, never in a separate role.

---

## The Three Semantic Layers

| Entity                                      | HTML Semantic                                           | WAI-ARIA Semantic                                                      | Aria Package Semantic Contract                                                       |
|:--------------------------------------------|:--------------------------------------------------------|:-----------------------------------------------------------------------|:-------------------------------------------------------------------------------------|
| **`announcer`**                             | Advisory message (`<output>` has implicit status role). | `role="status"` (omitted if `<output>`). Polite and atomic by default. | Advisory announcement manager (e.g. "Saved").                                        |
| **`announcer`** (`politeness: 'assertive'`) | High-priority dynamic message container (`<div>`).      | `role="status"`, `aria-live="assertive"`.                              | Urgent notification manager. Pushes high-priority announcement without moving focus. |
| **`announcer`** (`atomic: false`)           | Append-only sequential update stream (`<div>`).         | `role="status"`, `aria-live="polite"`, `aria-atomic="false"`.          | Sequential history manager (chat logs, audit feeds).                                 |
| **`announcer`** (`politeness: 'off'`)       | Counter, countdown, or ticker (`<div>` or `<time>`).    | `role="status"`, `aria-live="off"`.                                    | Silent holder; milestones announced selectively rather than continuously.            |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `LiveRegionProps`

```ts
export interface LiveRegionProps {
  /** Politeness level for announcements */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether the entire region should be announced as an atomic whole */
  atomic?: boolean;
  /** Whether region is currently busy loading/updating */
  busy?: boolean;
  /** Relevant changes to monitor ('additions' | 'removals' | 'text' | 'all') */
  relevant?: string;
}
```

The announcer takes `AnnouncerOptions` (`{ native?: boolean }`) for binding to native `<output>`; announcement tuning is
otherwise author-set props. See `announcer` for the canonical entity spec.

---

## State & Lifecycle Rules

1. **Politeness Defaults**:
  - Announcer defaults to `politeness: 'polite'`, `atomic: true`.
  - `politeness: 'assertive'` interrupts for urgent messages.
  - `atomic: false` announces a stream entry on its own.
  - `politeness: 'off'` keeps counters and tickers silent.

2. **DOM Presence**:
  - Live regions should exist in the DOM prior to content insertion so screen readers can register the region before
    text mutations occur.
