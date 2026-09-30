# ContextMenu Specification

The pointer- and keyboard-anchored menu unit. Opens at secondary pointer coordinates or keyboard shortcut position over
a declared area. Composes the Menu specification.

- **Entity**: `context-menu`
- **WAI-ARIA Role**: `menu` (popup)

### Composite Parts (Entity Tree)

- **`ContextMenu`**: Container coordinator (hosts `open`, `submenu`, anchor coordinates).
- **`ContextMenuTrigger`**: Trigger area listening for `contextmenu` pointer clicks and `Shift + F10`.
- **`ContextMenuPopup`**: Anchored menu popup (follows `MenuPopup` contract).
- Slotted items follow `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuSub` contracts.

---

## The Three Semantic Layers

| Part / Role              | HTML Semantic                         | WAI-ARIA Semantic                    | Aria Package Semantic Contract                                             |
|:-------------------------|:--------------------------------------|:-------------------------------------|:---------------------------------------------------------------------------|
| **`ContextMenu`**        | Container (`<div>`).                  | None (role omitted).                 | Hosts open and anchor state. Inherits Menu coordinator contracts.          |
| **`ContextMenuTrigger`** | Preserves existing element semantics. | None (receives no conflicting role). | Listens to `contextmenu` and `Shift + F10` to open popup at target coords. |
| **`ContextMenuPopup`**   | Dropdown container.                   | `role="menu"`.                       | Follows MenuPopup contract.                                                |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ContextMenuProps`

```ts
export interface ContextMenuProps {
  /** Popup visibility flag */
  open?: boolean;
  /** Submenu ID */
  submenu?: string | null;
  disabled?: boolean;
  hoverDelay?: number;
}
```

### 2. Overload Contracts

```ts
// ContextMenu: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'context-menu',
  props?: ContextMenuProps
): ContextMenuAria<E>;

// ContextMenuTrigger: Target area
export function aria<E extends BaseElement = HTMLElement>(
  role: 'context-menu-trigger',
  props?: AriaProps
): ContextMenuTriggerAria<E>;
```

---

## State & Lifecycle Rules

1. **Invocation**:
  - Secondary pointer click (`contextmenu` event): Prevents default (`preventDefault()`), sets `open = true`, and captures the pointer coordinates into the panel's `--anchor-x` / `--anchor-y` custom properties.
  - Keyboard (`Shift + F10` or Context Menu key): Sets `open = true`, anchoring to the focused element's anchor identifier.

2. **Delegation to the Menu contract** (`docs/context-menu.md:7,24`): open-popup navigation, item activation, typeahead,
   **submenu** opening (`submenu`/`hoverDelay` follow the Menu rules), dismissal, and **focus capture** (opening moves
   focus to the first enabled item, per Menu) are all delegated — the context-menu adds only the invocation paths and
   ambient open/disabled state. The trigger area is not itself a MenuTrigger.

3. **Events** (`docs/context-menu.md:28`): `change` on the ContextMenu container when `open` commits,
   `CustomEvent<boolean>('change', { bubbles: true, detail: open })`. Item `click` follows the Menu contract.

4. **Anchoring & placement (CSS-only, same rule as popover):** the controller's geometry job is to **generate the pair identifiers** and to set the anchor coordinates — pointer coordinates as `--anchor-x` / `--anchor-y`, or the focused element's `anchor-name` — **only**. There is no JavaScript positioning (no coordinate math, no rect reads, no scroll/resize listeners); the browser's CSS anchor-positioning (`position-anchor`/`position-area`/`position-try`) resolves the box, and `xDir`/`yDir` placement tokens translate to the same custom properties used by the popover.
