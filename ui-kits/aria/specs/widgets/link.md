# Link Specification

A link is an interactive reference to an internal or external resource.

- **Role**: `link`
- **WAI-ARIA Role**: `link`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Link** | Native `<a href="...">`. Native navigation, download, and focus behavior. | Implicit `role="link"`. Omitted if native. | Pure attribute projection and event forwarding. |
| **Custom Link** | Non-native element (`<span>`, `<div>`). | `role="link"`, `tabindex="0"`. | Navigation trigger controller. Polyfills Enter key activation. |

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
  /** Target URL */
  href?: string;
  /** Target browsing context */
  target?: string;
  /** Disabled indicator */
  disabled?: boolean;
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

1. **Keyboard Polyfill (`!native`)**:
   - `Enter`: Triggers navigation action.
