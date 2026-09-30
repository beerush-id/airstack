# Toolbar Specification

A toolbar is a container for grouping a set of interactive controls, such as buttons, checkboxes, dropdowns, and
toggles. It manages a single tab-stop for the entire toolbar, using arrow keys to navigate between controls.

### Composite Parts

- **`Toolbar`**: WAI-ARIA `toolbar` (stateless focus manager; members are native controls, not entities)

---

## The Three Semantic Layers

| Part / Role                                              | HTML Semantic                                                    | WAI-ARIA Semantic                                                                                    | Aria Package Semantic Contract                                                                                                                                                                                                              |
|:---------------------------------------------------------|:-----------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`toolbar`**                                            | Layout container (`<div>` or `<nav>`).                           | `role="toolbar"`, `aria-label` / `aria-labelledby`, `aria-orientation` (`horizontal` default).       | Stateless focus manager. Props: `ToolbarProps` (no `value`, no `manual`). Owns the single tab stop and arrow travel across all descendants.                                                                                                 |
| **Controls** (`button`, `toggle`, `checkbox`, `link`, …) | Native controls with their own semantics and form participation. | Each compiles its own role (`button`, `checkbox`, `link`, …) with toolbar-managed roving `tabindex`. | No member entity: controls keep their own props and projections (`pressed`, `checked`). Inner selection groups keep value semantics but surrender roving handlers when scoped inside a toolbar; inner grouping collapses to `role="group"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ToolbarProps`

```ts
export interface ToolbarProps {
  /** Focus movement axis and aria-orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Accessible name for the toolbar landmark */
  label?: string;
}
```

### 2. Overload Contracts

```ts
// Toolbar: Stateless focus-manager container (no options)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toolbar',
  props?: ToolbarProps
): ToolbarAria<E>;
```

Members are native controls (`button`, `toggle`, `checkbox`, `link`, …) with their own `aria()` roles. No `toolbar-item`
role exists.

---

## State & Lifecycle Rules

1. **Stateless Focus Management**:
  - Toolbar holds no selection value. Active state lives on each control's own props (`pressed`, `checked`).
  - Single tab stop for the toolbar container: the active control (or the first enabled control initially) receives
    `tabindex="0"`, all other controls receive `tabindex="-1"`. Disabled controls have `tabindex` removed.
  - Arrow keys (`ArrowLeft` / `ArrowRight`, or `ArrowDown` / `ArrowUp` when vertical) move focus among enabled controls
    with circular wrap. Arrows never activate; `Enter`/`Space` activates the focused control.
  - Toolbar declares no `manual` prop.

2. **Roving Takeover**: Inner selection groups keep their value semantics but surrender roving handlers when scoped
   inside a toolbar. Detection runs over the ambient scope chain: a group whose `this.scope` chain contains a toolbar
   controller skips its own roving handler and compiles its container role as `role="group"` (label preserved). Toolbar
   roves across all focusable descendants regardless of inner grouping.
