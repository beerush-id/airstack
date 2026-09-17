# ContextMenu Specification

The pointer- and keyboard-anchored menu unit. Opens at secondary pointer coordinates or keyboard shortcut position over a declared area. Composes the Menu specification.

- **Entity**: `context-menu`
- **WAI-ARIA Role**: `menu` (popup)

### Composite Parts (Entity Tree)
- **`ContextMenu`**: Container coordinator (hosts `open`, `submenu`, anchor coordinates).
- **`ContextMenuTrigger`**: Trigger area listening for `contextmenu` pointer clicks and `Shift + F10`.
- **`ContextMenuPopup`**: Anchored menu popup (follows `MenuPopup` contract).
- Slotted items follow `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuSub` contracts.

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`ContextMenu`** | Container (`<div>`). | None (role omitted). | Hosts open and anchor state. Inherits Menu coordinator contracts. |
| **`ContextMenuTrigger`** | Preserves existing element semantics. | None (receives no conflicting role). | Listens to `contextmenu` and `Shift + F10` to open popup at target coords. |
| **`ContextMenuPopup`** | Dropdown container. | `role="menu"`. | Follows MenuPopup contract. |

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
   - Secondary pointer click (`contextmenu` event): Prevents default (`preventDefault()`), sets `open = true`, anchors at pointer coordinates.
   - Keyboard (`Shift + F10` or Context Menu key): Sets `open = true`, anchors at focused element.
2. **Behavior & Dismissal**:
   - Follows Menu contract for roving focus, typeahead, submenus, Escape, and outside click dismissal.
