# Marquee Live Region Specification

A marquee is an area of rapidly changing content (e.g. stock ticker, sports scoreboard).

- **Role**: `marquee`
- **WAI-ARIA Role**: `marquee`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Marquee** | Ticker container (`<div>`). | `role="marquee"`. Implicit `aria-live="off"`. | Ticker controller. Prevents intrusive constant announcements and provides pause hooks. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface MarqueeProps {
  /** Politeness level (default: 'off') */
  politeness?: 'off' | 'polite' | 'assertive';
  /** Whether ticker animation/stream is currently paused */
  paused?: boolean;
}
```

### 2. Overload Contract

```ts
// Marquee: Rapidly changing ticker (announcements off by default)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'marquee',
  props?: MarqueeProps
): MarqueeAria<E>;
```
