# Menu Specification

A menu is a widget that offers a list of choices to the user, such as an application action menu, context menu, or
menubar. ARIA menus are for application commands and actions, not standard website navigation (which uses `<nav>` and
links).

### Composite Parts

- **`Menu`** (`aria('menu')`): Root orchestrator pairing one trigger with one popup panel. Owns `open`, the root-level
  `submenu` id, `disabled`, and `hoverDelay`; renders un-roled.
- **`Menubar`**: WAI-ARIA `menubar` *(addition not present in `docs/menu.md`, which has no menubar term — retained as a
  documented extension, not a source translation)*
- **Menu button** (`aria('menu-button')`): Menu trigger button (`aria-haspopup="menu"`)
- **Menu panel** (`aria('menu-panel')`): WAI-ARIA `menu` popup
- **`MenuItem`**: WAI-ARIA `menuitem`
- **`MenuGroup`**: WAI-ARIA `group`
- **`MenuSub` / `MenuSubTrigger` / `MenuSubPopup`**: A nested branch — the child group coordinator (`submenu` id,
  `disabled`, derived `open`), its `role="menuitem"` trigger carrying `aria-haspopup="menu"` + `aria-expanded`, and its
  `role="menu"` popup (`aria-labelledby` → trigger id). Per `docs/menu.md:5,16-22,106-123`.

### Entity Hierarchy

`Menubar` hosts menus. A menu hosts exactly one trigger and one panel. A panel hosts items, optionally wrapped in
groups:

```
Menubar
└─ Menu (trigger + popup pair)
   ├─ Menu button (opens/closes, aria-expanded)
   └─ Menu panel (role="menu")
      ├─ MenuItem (menuitem / checkbox / radio)
      └─ MenuGroup (role="group", optional)
         └─ MenuItem
```

---

## The Three Semantic Layers

| Part / Role            | HTML Semantic                                                     | WAI-ARIA Semantic                                                                             | Aria Package Semantic Contract                                                                                                                                                                          |
|:-----------------------|:------------------------------------------------------------------|:----------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`menu`**             | Un-roled wrapper (`<div>`).                                       | No role; projects `id` namespace only.                                                        | Pair orchestrator owning `open` state. Publishes ambient `menuCtx`; spawns trigger and panel.                                                                                                           |
| **`menubar`**          | Layout bar (`<div>`).                                             | `role="menubar"`, `aria-label` / `aria-labelledby`, `aria-orientation="horizontal"`.          | Container group managing horizontal roving focus across top-level menus.                                                                                                                                |
| **menu panel**         | Popup/dropdown wrapper (`<div>`).                                 | `role="menu"`, `aria-label` / `aria-labelledby`, `aria-orientation="vertical"`.               | Focus trap and vertical roving focus manager. Closes paired root on Escape.                                                                                                                             |
| **menu button**        | Trigger (`<button type="button">`).                               | No `role` when native; `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` to the panel. | Flips root `open` on activation; inert without a root.                                                                                                                                                  |
| **`menuitem`**         | Action trigger (`<button type="button">`). Space/Enter activates. | `role="menuitem"`, roving `tabindex`, `aria-haspopup` (if submenu).                           | Action invoker: triggers command or expands submenu.                                                                                                                                                    |
| **`menuitemcheckbox`** | Checkable item (`<button type="button">`).                        | `role="menuitemcheckbox"`, `aria-checked` (`"true"` \| `"false"` \| `"mixed"`).               | Standalone toggle contract: keeps `checked` on its own props. Never bound to a group value.                                                                                                             |
| **`menuitemradio`**    | Radio item (`<button type="button">`).                            | `role="menuitemradio"`, `aria-checked` (`"true"` \| `"false"`).                               | Single-selection contract inside a `multiple: false` subgroup. Active: `this.group.value === this.props.value`. Activation: `this.group.value = this.props.value`. Always idempotent (never deselects). |
| **`group`**            | Structural grouping (`<div>`).                                    | `role="group"`, `aria-label` / `aria-labelledby`.                                             | Subgroup container publishing an independent scoped selection value for its radio members; non-radio members are unaffected. Constructs via `aria('menu-group', props)` or `new MenuGroupAria()`.       |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `MenuProps`

```ts
export interface MenuProps {
  /** Root popup visibility (default: false) */
  open?: boolean;
  /** ID of the root level's open child MenuSub (default: null) */
  submenu?: string | null;
  /** Interaction flag inherited by the whole menu tree (default: false) */
  disabled?: boolean;
  /** Pointer-hover submenu transition delay in ms (default: 150) */
  hoverDelay?: number;
}
```

#### `MenubarProps`

```ts
export interface MenubarProps {
  /** Accessible label */
  label?: string;
  /** Bar axis orientation (default: 'horizontal') */
  orientation?: 'vertical' | 'horizontal';
}
```

#### `MenuPanelProps`

```ts
export interface MenuPanelProps extends MenubarProps {
  /** Optional DOM element identifier */
  id?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

#### `MenuGroupProps<T extends Primitive = Primitive>`

```ts
export interface MenuGroupProps<T extends Primitive = Primitive> {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
  /** Scoped radio value for child menu-item-radio elements */
  value?: T;
}
```

#### `MenuItemOptions`

```ts
export interface MenuItemOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `MenuItemProps`

```ts
export interface MenuItemProps {
  /** Optional semantic identifier or action name */
  name?: string;
  disabled?: boolean;
}
```

#### `MenuItemCheckboxProps`

```ts
export interface MenuItemCheckboxProps extends MenuItemProps {
  checked?: boolean | 'mixed';
}
```

#### `MenuItemRadioProps<T extends Primitive = Primitive>`

```ts
export interface MenuItemRadioProps<T extends Primitive = Primitive> extends MenuItemProps {
  /** Choice candidate value matching enclosing subgroup value */
  value: T;
}
```

### 2. Overload Contracts

```ts
// Menu: Trigger + popup pair orchestrator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu',
  props?: MenuProps
): MenuAria<E>;

// MenuPanel: Popup panel compiling role="menu"
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu-panel',
  props?: MenuPanelProps
): MenuPanelAria<E>;

// Menubar: Horizontal command bar
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu-bar',
  props?: MenubarProps
): MenubarAria<E>;

// MenuItem: Command action trigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item',
  props?: MenuItemProps,
  options?: MenuItemOptions
): MenuItemAria<E>;

// MenuButton: Popup trigger toggling root open state
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-button',
  props?: MenuButtonProps,
  options?: MenuItemOptions
): MenuButtonAria<E>;

// MenuGroup: Labelled section scoping radio selection
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu-group',
  props?: MenuGroupProps
): MenuGroupAria<E>;

// MenuItemCheckbox: Checkable command item
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item-checkbox',
  props: MenuItemCheckboxProps,
  options?: MenuItemOptions
): MenuItemCheckboxAria<E>;

// MenuItemRadio: Mutually exclusive radio item
export function aria<E extends BaseElement = HTMLButtonElement, T extends Primitive = Primitive>(
  role: 'menu-item-radio',
  props: MenuItemRadioProps<T>,
  options?: MenuItemOptions
): MenuItemRadioAria<E>;
```

---

## State & Lifecycle Rules

1. **Keyboard Navigation**:
  - The menu/menubar container holds the single tab stop and delegates `onkeydown` at the container level (roving
    `tabindex` across enabled items).
  - `ArrowDown` / `ArrowUp`: Navigates within vertical menu.
  - `ArrowRight`: Expands submenu or moves to next menubar item.
  - `ArrowLeft`: Collapses submenu or moves to previous menubar item.
  - `Escape`: Closes active popup menu and returns focus to trigger.
  - `Enter` / `Space`: Activates focused menuitem.
  - Menu declares no `manual` prop: arrows move focus only and never activate.

2. **State Projection**: `checked` reads own props (checkbox) or `this.group.value` membership (radio); setting it
   writes the same store. Props is the single source of state.

3. **Subgroup Radio Scoping**:
  - Menu subgroups render `<div role="group">` with an accessible label (`label` or `labelledby`).
  - When hosting `menu-item-radio` members, the subgroup publishes an independent ambient `selectionGroup`
    (`{ value: groupProps.value, multiple: false }`), scoping mutually exclusive radio selection strictly to that
    subgroup without affecting other menu items.

4. **Pair Linkage & Open State**:
  - The root owns `open` (default `false`) and the pair id namespace (`props.id`, generated `menu-*` fallback).
  - The panel projects `id` as `props.id`, else `<root-id>-menu` when paired, else absent standalone.
  - The trigger projects `aria-haspopup="menu"`, `aria-expanded` from root `open`, and `aria-controls` to the derived
    panel id; activation flips root `open`. Without a root the trigger stays closed and inert.
  - `Escape` inside a paired panel sets root `open` to `false` (state only); DOM dismissal and focus-return stay with
    the trigger/popover layer.

5. **Submenu Cascade** (`docs/menu.md:47-67`):
  - Each open level hosts at most one open child: opening a sibling replaces `parent.submenu`; a closed level clears its
    own `submenu` and pending hover transitions, and descendants close via ambient visibility (no stale chain on
    reopen).
  - MenuSubTrigger activation commits `parent.submenu = sub.id` (not a leaf action, does not close the root); `Right`
    (LTR; `Left` in RTL) opens-and-enters the child, the opposite direction is the child-return key. Pointer hover opens
    after `hoverDelay` without moving focus; leaving before the delay cancels it. The trigger and its popup form one
    pointer region (gap traversal must not prematurely close).
  - `Escape` / return-key inside a child closes that child + descendants and restores focus to its MenuSubTrigger; the
    handled key does not also dismiss an ancestor. The existing `defaultPrevented: true` proof is compatible; a nested
    popup must not bubble its Escape to the parent handler.
