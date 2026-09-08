# Menu Specification

A menu is a widget that offers a list of choices to the user, such as an application action menu, context menu, or menubar. ARIA menus are for application commands and actions, not standard website navigation (which uses `<nav>` and links).

### Composite Parts
- **`Menubar`**: WAI-ARIA `menubar`
- **`Menu`**: WAI-ARIA `menu`
- **`MenuItem`**: WAI-ARIA `menuitem`
- **`MenuGroup`**: WAI-ARIA `group`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`menubar`** | Layout bar (`<div>`). | `role="menubar"`, `aria-label` / `aria-labelledby`, `aria-orientation="horizontal"`. | Container group managing horizontal roving focus across top-level menus. |
| **`menu`** | Popup/dropdown wrapper (`<div>`). | `role="menu"`, `aria-label` / `aria-labelledby`, `aria-orientation="vertical"`. | Focus trap and vertical roving focus manager. Closes on Escape. |
| **`menuitem`** | Action trigger (`<button type="button">`). Space/Enter activates. | `role="menuitem"`, roving `tabindex`, `aria-haspopup` (if submenu). | Action invoker: triggers command or expands submenu. |
| **`menuitemcheckbox`** | Checkable item (`<button type="button">`). | `role="menuitemcheckbox"`, `aria-checked` (`"true"` \| `"false"` \| `"mixed"`). | Standalone toggle contract: keeps `checked` on its own props. Never bound to a group value. |
| **`menuitemradio`** | Radio item (`<button type="button">`). | `role="menuitemradio"`, `aria-checked` (`"true"` \| `"false"`). | Single-selection contract inside a `multiple: false` subgroup. Active: `this.group.value === this.props.value`. Activation: `this.group.value = this.props.value`. Always idempotent (never deselects). |
| **`group`** | Structural grouping (`<div>`). | `role="group"`, `aria-label` / `aria-labelledby`. | Subgroup container publishing an independent scoped selection value for its radio members; non-radio members are unaffected. Takes no `aria()` overload. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `MenuProps`
```ts
export interface MenuProps {
  /** Optional DOM element identifier */
  id?: string;
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
  /** Menu axis orientation (default: 'vertical' for menu, 'horizontal' for menubar) */
  orientation?: 'vertical' | 'horizontal';
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
// Menubar: Horizontal command bar
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menubar',
  props?: MenuProps
): MenubarAria<E>;

// Menu: Command menu / popup
export function aria<E extends BaseElement = HTMLElement>(
  role: 'menu',
  props?: MenuProps
): MenuAria<E>;

// MenuItem: Command action trigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item',
  props?: MenuItemProps,
  options?: MenuItemOptions
): MenuItemAria<E>;

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
   - The menu/menubar container holds the single tab stop and delegates `onkeydown` at the container level (roving `tabindex` across enabled items).
   - `ArrowDown` / `ArrowUp`: Navigates within vertical menu.
   - `ArrowRight`: Expands submenu or moves to next menubar item.
   - `ArrowLeft`: Collapses submenu or moves to previous menubar item.
   - `Escape`: Closes active popup menu and returns focus to trigger.
   - `Enter` / `Space`: Activates focused menuitem.
   - Menu declares no `manual` prop: arrows move focus only and never activate.

2. **State Projection**: `checked` reads own props (checkbox) or `this.group.value` membership (radio); setting it writes the same store. Props is the single source of state.

3. **Subgroup Radio Scoping**:
   - Menu subgroups render `<div role="group">` with an accessible label (`label` or `labelledby`).
   - When hosting `menu-item-radio` members, the subgroup publishes an independent ambient `selectionGroup` (`{ value: groupProps.value, multiple: false }`), scoping mutually exclusive radio selection strictly to that subgroup without affecting other menu items.
