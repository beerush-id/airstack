# Live Regions Overview

Live regions allow assistive technologies to automatically announce dynamic content updates without requiring the user to shift focus away from their current interaction point.

---

## The Three Semantic Layers

| Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`alert`** | High-priority dynamic message container (`<div>`). | `role="alert"`. Implicit `aria-live="assertive"`, `aria-atomic="true"`. | Urgent notification manager. Pushes high-priority announcement. |
| **`status`** | Advisory status message (`<output>` has implicit status role). | `role="status"`. Implicit `aria-live="polite"`, `aria-atomic="true"`. | Non-intrusive status notification (e.g. "Saved"). |
| **`log`** | Append-only sequential update stream (`<div>`). | `role="log"`. Implicit `aria-live="polite"`. | Sequential history manager (chat logs, audit feeds). |
| **`timer`** | Counter or countdown clock (`<div>`). | `role="timer"`. `aria-live="off"`. | Milestones announced selectively rather than continuously. |
| **`marquee`** | Rapidly updating text stream (`<div>`). | `role="marquee"`. `aria-live="off"`. | Non-urgent ticker; announcements suppressed by default. |

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

Live regions take no options (announcement tuning is author-set props), with the exception of `status`, which accepts `StatusOptions` (`{ native?: boolean }`) for binding to native `<output>`.

---

## State & Lifecycle Rules

1. **Politeness Defaults**:
   - `alert`: Defaults to `politeness: 'assertive'`, `atomic: true`.
   - `status`: Defaults to `politeness: 'polite'`, `atomic: true`.
   - `log`: Defaults to `politeness: 'polite'`, `atomic: false`.
   - `timer` & `marquee`: Default to `politeness: 'off'`.

2. **DOM Presence**:
   - Live regions should exist in the DOM prior to content insertion so screen readers can register the region before text mutations occur.
