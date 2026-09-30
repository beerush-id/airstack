# Link Specification

A link is an interactive reference to an internal or external resource.

- **Role**: `link`
- **WAI-ARIA Role**: `link`

---

## The Three Semantic Layers

| Context         | HTML Semantic                                                             | WAI-ARIA Semantic                                                                                                                                                                 | Aria Package Semantic Contract                                                                                                                                                                           |
|:----------------|:--------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Native Link** | Native `<a href="...">`. Native navigation, download, and focus behavior. | Implicit `role="link"`. Omitted on native. `aria-disabled="true"` + `tabindex="-1"` when `disabled`. `aria-current="page"` when active.                                           | Navigation trigger. When `disabled`, intercepts pointer/keyboard activation with `event.preventDefault()` to suppress navigation — **`href` is kept** so the link stays discoverable. No `role` emitted. |
| **Custom Link** | Non-native element (`<span>`, `<div>`).                                   | `role="link"` (when `href` declared), `aria-disabled="true"` when `disabled`, `aria-current="page"` when active; `tabindex="0"` when enabled, `tabindex` removed when `disabled`. | Navigation trigger controller. Polyfills Enter-key activation (synthesized bubbling, cancelable `click`). `Space` commits nothing and preserves scrolling.                                               |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `LinkOptions`

```ts
export interface LinkOptions {
  /** Whether bound to native <a> (default: true) */
  native?: boolean;
}
```

#### `LinkProps`

```ts
export interface LinkProps {
  /** Target destination URL */
  href?: string;
  /** Target browsing context (author-bound HTML pass-through) */
  target?: string;
  /** Interaction flag blocking navigation (default: false) */
  disabled?: boolean;
  /** Current-page override; defaults to matching href against ambient linkCtx */
  current?: boolean;
}
```

### 2. Overload Contract

```ts
// Link: Navigation trigger
export function aria<E extends BaseElement = HTMLAnchorElement>(
  role: 'link',
  props?: LinkProps,
  options?: LinkOptions
): LinkAria<E>;
```

---

## State & Lifecycle Rules

1. **Disabled Navigation Lockout**:
  - When `disabled: true`, pointer clicks and keyboard activation are intercepted with `event.preventDefault()` to
    suppress native navigation. `href` is **kept** (the link stays focusable-by-AT and announced as `aria-disabled`, not
    withdrawn).
  - Native host: `aria-disabled="true"` + `tabindex="-1"`. Custom host: `aria-disabled="true"` and `tabindex` removed.

2. **Current-Page Activation** (`docs/link.md:17,36,42`):
  - Observes ambient `linkCtx` (root-provided reactive URL); when it matches declared `href`, emits
    `aria-current="page"`. An explicit `current: true` overrides the ambient match.

3. **Keyboard Polyfill (`!native`)**:
  - `Enter`: synthesizes a bubbling, cancelable `click` when `!event.defaultPrevented`; canceled trigger commits no
    navigation.
  - `Space`: commits nothing and preserves native viewport scrolling.
