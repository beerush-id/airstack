# ContextMenu Specification

The pointer- and keyboard-anchored menu unit. Opens at secondary pointer coordinates or keyboard shortcut position over
a declared area. Composes the Menu specification.

- **Entity**: `context-menu`
- **WAI-ARIA Role**: `menu` (panel)

### Composite Parts (Entity Tree)

- **`ContextMenu`**: Host surface & coordinator (listens to `contextmenu` and `Shift + F10`, hosts `open`, anchor coordinates, inherits Menu coordinator contracts).
- **`ContextMenuPanel`**: Anchored menu panel (inherits `MenuPanel`).
- Slotted items follow `MenuItem`, `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemGroup` contracts.

---

## Semantic Layers

| Part / Role            | HTML Semantic                         | WAI-ARIA Semantic    | Aria Package Semantic Contract                                                                          |
|:-----------------------|:--------------------------------------|:---------------------|:--------------------------------------------------------------------------------------------------------|
| **`ContextMenu`**      | Preserves existing element semantics. | None (role omitted). | Host surface. Listens to `contextmenu` and `Shift + F10` to open panel at target coords. Coordinates state. |
| **`ContextMenuPanel`** | Dropdown container.                   | `role="menu"`.       | Inherits MenuPanel (`role="menu"`, listbox behavior, internal popover).                                 |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ContextMenuProps`

```ts
export interface ContextMenuProps {
  id?: string;
  /** Panel visibility flag (default: false) */
  open?: boolean;
  /** Interaction flag inherited by the whole menu tree (default: false) */
  disabled?: boolean;
  onopen?: AriaEventHandler<MenuEvent>;
  onclose?: AriaEventHandler<MenuEvent>;
  /** Root-level command listener; item `command` events bubble here */
  oncommand?: AriaEventHandler<MenuEvent>;
}
```

#### `ContextMenuPanelProps`

```ts
export interface ContextMenuPanelProps extends MenuPanelProps {}
```

### 2. Overload Contracts

```ts
// ContextMenu: Host surface & coordinator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'context-menu',
  props?: ContextMenuProps
): ContextMenuAria<E>;

// ContextMenuPanel: Anchored menu panel (inherits MenuPanelAria)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'context-menu-panel',
  props?: ContextMenuPanelProps
): ContextMenuPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Invocation**:
  - Secondary pointer click (`contextmenu` event): Prevents default (`preventDefault()`), sets `open = true`, and captures the pointer coordinates into the panel's `--anchor-x` / `--anchor-y` custom properties.
  - Keyboard (`Shift + F10` or Context Menu key): Sets `open = true`, anchoring to the focused element's anchor identifier.

2. **Delegation to the Menu contract** (`docs/context-menu.md:7,24`): open-panel navigation, item activation, roving focus,
   typeahead, dismissal, and **focus capture** (opening moves focus to the first enabled item, per Menu) are all
   delegated — the context-menu adds only the invocation paths and ambient open/disabled state on the host surface.
   Nested submenus compose as nested `Menu` instances.

3. **Events**:
  - `open` / `close`: authored by ContextMenu on the visibility edge, invoking `onopen` / `onclose`.
  - `command`: authored by `menu-item` on invoke, bubbling to the ContextMenu root and invoking `oncommand`.
  - `change`: authored by checkable or radio items per Menu contract.

4. **Anchoring & placement (CSS-only, same rule as popover):** the controller's geometry job is to **generate the pair identifiers** and to set the anchor coordinates — pointer coordinates as `--anchor-x` / `--anchor-y`, or the focused element's `anchor-name` — **only**. There is no JavaScript positioning (no coordinate math, no rect reads, no scroll/resize listeners); the browser's CSS anchor-positioning (`position-anchor`/`position-area`/`position-try`) resolves the box, and `xDir`/`yDir` placement tokens translate to the same custom properties used by the popover.
