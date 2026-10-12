# Menu Specification

A menu is a widget that offers a list of choices to the user, such as an application action menu, context menu, or
menubar. ARIA menus are for application commands and actions, not standard website navigation (which uses `<nav>` and
links).

### Composite Parts (Entity Tree)

- **`Menu`**: Root orchestrator (publishes ambient props context hosting `open` and `disabled` state).
- **`MenuTrigger`**: Menu trigger button (compiles `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`). Claims itself as anchor via `this.markActionable()`.
- **`MenuPanel`**: Popup menu container (compiles `role="menu"`, inherits from `Listbox`, always vertical, owns its popup instance — an internal `PopoverAria` proxying `open`, `onopen`, and `onclose` to ambient props). The popover owns light dismissal and focus return; it never mounts, hides, or positions DOM.
- **`MenuItem`**: Command action item (compiles `role="menuitem"`, inherits action activation).
- **`MenuItemCheckbox`**: Checkable menu item (compiles `role="menuitemcheckbox"`, inherits checkbox state projection).
- **`MenuItemRadio`**: Radio item (compiles `role="menuitemradio"`, inherits radio selection projection).
- **`MenuItemGroup`**: Structural section (compiles `role="group"`, publishes its own `selectionGroup` context).
- **`Menubar`**: Horizontal command bar (compiles `role="menubar"`).

### Entity Hierarchy

`Menubar` hosts menus. A menu hosts exactly one trigger and one panel. A panel hosts items, optionally wrapped in
groups:

```
Menubar
└─ Menu (root orchestrator)
   ├─ MenuTrigger (opens/closes, aria-haspopup="menu", aria-expanded)
   └─ MenuPanel (role="menu", single tab-stop)
      ├─ MenuItem (action)
      ├─ MenuItemCheckbox (toggle)
      ├─ MenuItemRadio (radio)
      └─ MenuItemGroup (role="group", scopes radio selection)
```

---

## The Three Semantic Layers

| Part / Role            | HTML Semantic                                     | WAI-ARIA Semantic                                                                              | Aria Package Semantic Contract                                                                                                    |
|:-----------------------|:--------------------------------------------------|:-----------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------|
| **`menu`**             | Non-semantic container (`<div>` or fragment).      | None (role omitted).                                                                           | Root orchestrator owning `open` state. Publishes ambient host context; coordinates trigger and panel.                             |
| **`menubar`**          | Layout bar (`<div>`).                             | `role="menubar"`, `aria-label` / `aria-labelledby`, `aria-orientation="horizontal"`.           | Container group managing horizontal roving focus across top-level menus.                                                          |
| **`menu-panel`**       | Popup/dropdown wrapper (`<div>`).                 | `role="menu"`, `aria-label` / `aria-labelledby`, `aria-orientation="vertical"`.                | Popup panel. Inherits `Listbox`, always vertical; owns its popup instance (internal Popover proxying `open`, `onopen`, and `onclose`), which owns dismissal and focus return. |
| **`menu-button`**      | Native `<button type="button">` or custom.        | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` to the panel.                         | Claims anchor via `this.markActionable()`. Flips root `open` on activation; inert without a root. |
| **`menu-item`**        | Action trigger (`<button type="button">`).        | `role="menuitem"`, roving `tabindex`.                            | Action invoker: triggers the command. Inherits action activation.                                                  |
| **`menu-item-checkbox`**| Checkable item (`<button type="button">`).       | `role="menuitemcheckbox"`, `aria-checked` (`"true"` \| `"false"` \| `"mixed"`).                | Inherits `checkbox` state projection; keeps `checked` on its own props.                                                           |
| **`menu-item-radio`**  | Radio item (`<button type="button">`).            | `role="menuitemradio"`, `aria-checked` (`"true"` \| `"false"`).                                | Inherits `radio` selection projection inside enclosing group; active when `group.value === props.value`.                          |
| **`menu-item-group`**  | Structural grouping (`<div>`).                    | `role="group"`, `aria-label` / `aria-labelledby`.                                              | Subgroup container publishing its own `selectionGroup` context for child radio items.                                        |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `MenuProps`

```ts
export interface MenuProps {
  id?: string;
  /** Root popup visibility (default: false) */
  open?: boolean;
  onopen?: AriaEventHandler<MenuEvent>;
  onclose?: AriaEventHandler<MenuEvent>;
  /** Root-level command listener; item `command` events bubble here */
  oncommand?: AriaEventHandler<MenuEvent>;
  /** Interaction flag inherited by the whole menu tree (default: false) */
  disabled?: boolean;
  /** Pointer-hover transition delay in ms (default: 150) */
  delay?: number;
}
```

#### `MenubarProps`

```ts
export interface MenubarProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

#### `MenuPanelProps`

```ts
export interface MenuPanelProps {
  /** Optional DOM element identifier */
  id?: string;
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

#### `MenuItemGroupProps<T extends Primitive = Primitive>`

```ts
export interface MenuItemGroupProps<T extends Primitive = Primitive> {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
  /** Scoped radio value for child menu-item-radio elements */
  value?: T;
}
```

#### `MenuTriggerProps`

```ts
export interface MenuTriggerProps {
  id?: string;
  disabled?: boolean;
}
```

#### `MenuItemProps`

```ts
export interface MenuItemProps {
  /** Semantic identifier carried as the event detail */
  name?: string;
  disabled?: boolean;
  oncommand?: AriaEventHandler<MenuEvent>;
}
```

#### `MenuItemCheckboxProps`

```ts
export interface MenuItemCheckboxProps extends Omit<MenuItemProps, 'oncommand'> {
  checked?: boolean | 'mixed';
  onchange?: AriaEventHandler<MenuEvent>;
}
```

#### `MenuItemRadioProps<T extends Primitive = Primitive>`

```ts
export interface MenuItemRadioProps<T extends Primitive = Primitive> extends Omit<MenuItemProps, 'oncommand'> {
  /** Choice candidate value matching enclosing subgroup value */
  value: T;
  onchange?: AriaEventHandler<MenuEvent>;
}
```

#### `MenuTriggerOptions`

```ts
export interface MenuTriggerOptions extends AriaOptions {
  /** Native `<button>` hosts activate on click alone; custom hosts get Space and Enter (default: true) */
  native?: boolean;
}
```

#### `MenuItemOptions`

```ts
export interface MenuItemOptions extends AriaOptions {
  /** Native `<button>` hosts activate on click alone; custom hosts get Space and Enter (default: true) */
  native?: boolean;
}
```

`MenuEvent` carries the acting item's `name` as its detail, so a consumer reads `event.detail` and never casts.

### 2. Overload Contracts

```ts
// Menu: Root orchestrator hosting ambient context
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu',
  props?: MenuProps
): MenuAria<E>;

// MenuTrigger: Popup trigger button
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-button',
  props?: MenuTriggerProps,
  options?: MenuTriggerOptions
): MenuTriggerAria<E>;

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

// MenuItem: Command action trigger compiling role="menuitem"
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item',
  props?: MenuItemProps,
  options?: MenuItemOptions
): MenuItemAria<E>;

// MenuItemCheckbox: Checkable command item compiling role="menuitemcheckbox"
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item-checkbox',
  props?: MenuItemCheckboxProps,
  options?: MenuItemOptions
): MenuItemCheckboxAria<E>;

// MenuItemRadio: Mutually exclusive radio item compiling role="menuitemradio"
export function aria<E extends BaseElement = HTMLButtonElement, T extends Primitive = Primitive>(
  role: 'menu-item-radio',
  props: MenuItemRadioProps<T>,
  options?: MenuItemOptions
): MenuItemRadioAria<E>;

// MenuItemGroup: Labelled section scoping radio selection
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu-item-group',
  props?: MenuItemGroupProps
): MenuItemGroupAria<E>;
```

The root also spawns its pair directly, for consumers who prefer instances over ambient discovery:

```ts
menu.button(props?: MenuTriggerProps, options?: MenuTriggerOptions): MenuTriggerAria
menu.panel(props?: MenuPanelProps): MenuPanelAria
```

---

## State & Lifecycle Rules

1. **Keyboard Navigation & Single Tab Stop**:
  - `MenuPanel` holds a single tab stop in sequential navigation, managing roving focus across enabled items. It is always vertical.
  - `ArrowDown` / `ArrowUp`: Navigates within the menu.
  - `ArrowRight`: Moves to next menubar item.
  - `ArrowLeft`: Moves to previous menubar item.
  - `Home` / `End`: Moves to first / last enabled menu item.
  - Typeahead: Printable characters match an item's rendered text to move focus (500ms window).
  - `Escape`: Closes the active popup menu and returns focus to its button, both owned by the panel's internal popover.
  - `Enter` / `Space`: Activates focused menu item.
  - Arrows move focus only and never activate.

2. **State Projection**: `checked` reads own props (checkbox) or `this.group.value` membership (radio); setting it
   writes the same store. Props is the single source of state.

3. **Subgroup Radio Scoping**:
  - Only `MenuItemGroup` publishes its own `selectionGroup` context; `Menu` publishes none since it owns no `value`.
  - Menu item subgroups render `<div role="group">` with an accessible label (`label` or `labelledby`).
  - When hosting `menu-item-radio` members, the subgroup publishes an independent ambient `selectionGroup`
    (`{ value: groupProps.value, multiple: false }`), scoping mutually exclusive radio selection strictly to that
    subgroup without affecting other menu items.

4. **Pair Linkage & Open State**:
  - The root owns `open` (default `false`) and the pair id namespace (`props.id`, generated `menu-*` fallback).
  - The panel projects `id` as `props.id`, else `<root-id>-menu` when paired, else absent standalone.
  - The button projects `aria-haspopup="menu"`, `aria-expanded` from root `open`, and `aria-controls` to the derived panel id; claims itself as anchor via `this.markActionable()`; activation flips root `open`. Without a root the button stays closed and inert.
  - The pair is reachable two ways: ambient discovery inside the root's setup scope, or `menu.button()` / `menu.panel()`.
  - `Escape` inside a paired panel sets root `open` to `false`, and the panel's internal popover owns DOM dismissal and focus return to the button. Mounting, hiding, and positioning the panel stay with the consumer.
  - `disabled` composes as root `disabled` OR member `disabled`; an effectively disabled item is locked out of activation and skipped by roving.
  - `isSubmenu` getter returns `true` when the menu was created inside another ambient menu, else `false`.

5. **Events**:
  - Every dispatching part declares its handler prop, dispatches its alias built on `AriaEvent`, invokes the handler,
    and pushes the key into `omittedAttrs`. No consumer casts.
  - The payload follows the part: a command `menu-item` reports `MenuEvent` whose detail is its `name`; a
    `menu-item-checkbox` reports the committed boolean, inheriting the `checkbox` payload; a `menu-item-radio`
    reports the group value it commits, inheriting the `radio` payload. A checkable or selectable item never reports a
    name in place of the state it inherits.
  - `input`: authored by the item that takes the cursor, and forwarded by the panel. Traversal commits nothing else.
  - `command`: authored by `menu-item` on invoke, carrying its `name`. It bubbles to the root, invoking root `oncommand`, so consumers may listen on the item, the menu, or both.
  - `change`: authored by `menu-item-checkbox` on toggle and `menu-item-radio` on select, inheriting the `checkbox` / `radio` payloads.
  - `open` / `close`: authored by the root on the visibility edge, invoking `onopen` / `onclose`.
