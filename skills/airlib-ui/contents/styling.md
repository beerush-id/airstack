# Component Styling & Dynamic Classes

This guide establishes the styling progression and conventions in AirLib—from inline classes to reactive class utilities (`classx`).

---

## The Styling Progression

AirLib recommends graduating styles according to their actual scope of reuse:

| Scope | Approach | Example |
|---|---|---|
| **Used once** | Inline classes | `<h1 className="text-2xl font-bold">...</h1>` |
| **Repeated on same page** | Local variable string | `const badgeClass = "px-2 py-1 rounded text-xs";` |
| **Conditional logic on same page** | Local factory function or `classx` | `classx('card', { 'card-active': isActive })` |
| **Repeated across entire app** | Composed utility class in global CSS | `@utility btn-primary { ... }` or `.btn-primary { ... }` |

TIP: Do not create a framework component just to reuse a string of CSS classes. Extract a local variable or utility class instead.

---

## Dynamic Classes with `classx`

AirLib includes a zero-dependency class name merging utility that understands strings, arrays, conditionals, and object keys. It is exported from `@airlib/react/utils` and `@airlib/solid/utils`.

### In-Template Usage

#### React
```tsx
import { template } from '@airlib/react';
import { classx } from '@airlib/react/utils';

export const Button = template<{ isActive?: boolean; isDisabled?: boolean }>(({ isActive, isDisabled }) => (
  <button
    type="button"
    className={classx(
      'btn font-medium',
      { 'btn-active bg-primary': isActive },
      isDisabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    Action
  </button>
), 'Button');
```

#### SolidJS
```tsx
import { template } from '@airlib/solid';
import { classx } from '@airlib/solid/utils';

export const Button = template<{ isActive?: boolean; isDisabled?: boolean }>((props) => (
  <button
    type="button"
    class={classx(
      'btn font-medium',
      { 'btn-active bg-primary': props.isActive },
      props.isDisabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    Action
  </button>
), 'Button');
```

---

## Theming Tokens

### Runtime Dynamic Themes (CSS Variables)
Use CSS Custom Properties for values that change at runtime (light/dark themes, tenant branding):

```css
:root {
  --color-surface: #ffffff;
  --color-text: #09090b;
}

[data-theme="dark"] {
  --color-surface: #09090b;
  --color-text: #f4f4f5;
}
```

### Static Design Tokens (JS/TS Constants)
Use plain TypeScript constants for system tokens that never change at runtime (e.g. z-index layers, base spacing):

```ts
export const Tokens = {
  zIndex: {
    dropdown: 100,
    modal: 500,
    toast: 1000,
  },
} as const;
```

---

## Style Object Composition with `stylex`

`stylex` merges inline style objects directly in element templates, filtering out `undefined` or `null` values:

#### React
```tsx
import { stylex } from '@airlib/react/utils';

<div
  style={stylex(
    { display: 'flex', gap: '1rem' },
    isExpanded && { height: 'auto', opacity: 1 },
    customStyle
  )}
/>
```

#### SolidJS
```tsx
import { stylex } from '@airlib/solid/utils';

<div
  style={stylex(
    { display: 'flex', gap: '1rem' },
    props.isExpanded && { height: 'auto', opacity: 1 },
    props.customStyle
  )}
/>
```
