# Timer Live Region Specification

A timer is a numerical counter indicating an amount of elapsed time or time remaining (e.g. stopwatch, countdown).

- **Role**: `timer`
- **WAI-ARIA Role**: `timer`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Timer** | Numerical display (`<div>` or `<time>`). | `role="timer"`. Implicit `aria-live="off"`. | Counter controller. Prevents intrusive per-second announcements. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface TimerProps {
  /** Politeness level (default: 'off') */
  politeness?: 'off' | 'polite' | 'assertive';
  /** Current elapsed or remaining time value */
  value?: number | string;
}
```

### 2. Overload Contract

```ts
// Timer: Counter announcing at milestones, never per tick
export function aria<E extends BaseElement = HTMLElement>(
  role: 'timer',
  props?: TimerProps
): TimerAria<E>;
```

---

## State & Lifecycle Rules

1. **Announcement Frequency**:
   - `timer` has default `aria-live="off"`. Assistive technologies should not announce every ticking second. Announcements should be pushed at meaningful milestones (e.g. every minute or upon expiration).
