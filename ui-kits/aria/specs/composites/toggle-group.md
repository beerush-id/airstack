# Toggle Group Specification

A toggle group is a composite widget containing a set of related toggle buttons that are pressed independently
(multiple) or mutually exclusively (single). Per `docs/toggle-group.md` the container is always `role="group"` — there
is no radiogroup swap, no `required`, no `manual`, and no `orientation` prop.

### Composite Parts

- **`ToggleGroup`**: WAI-ARIA `group` (always).
- **`Toggle`**: WAI-ARIA `button` (with `aria-pressed`); group member with candidate `value`.

---

## The Three Semantic Layers

| Part / Role              | HTML Semantic                                | WAI-ARIA Semantic                                                                                                                                                                                    | Aria Package Semantic Contract                                                                                                                                                   |
|:-------------------------|:---------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`ToggleGroup` (Root)** | Structural container (`<div>`).              | `role="group"` (always; never `radiogroup`), `aria-disabled="true"` when group disabled (`docs/toggle-group.md:38-40`).                                                                              | Container group. Publishes ambient value; no member registry. Props: `ToggleGroupProps`.                                                                                         |
| **`Toggle` (Member)**    | Native `<button type="button">` (or custom). | `role="button"` with `aria-pressed`; roving `tabindex="0"` on the active item **or the first enabled item if none active** (`:43`), siblings `-1`; all `tabindex` removed under declared `disabled`. | Member token `value`. **Single**: `group.value === value`. **Multiple**: `group.value.includes(value)`. Keeps `aria-pressed` (not `aria-checked`) — it is a button, not a radio. |

---

## Architectural & Behavioral Contracts

### 1. Props Contracts

```ts
export interface SingleToggleGroupProps<T extends Primitive = Primitive> {
  multiple?: false;
  id?: string;
  /** Active item identifier (default: null) */
  value?: T;
  disabled?: boolean;
}

export interface MultipleToggleGroupProps<T extends Primitive = Primitive> {
  multiple: true;
  id?: string;
  /** Array of active item identifiers (default: []) */
  value?: T[];
  disabled?: boolean;
}

export type ToggleGroupProps<T extends Primitive = Primitive> =
  | SingleToggleGroupProps<T>
  | MultipleToggleGroupProps<T>;
```

> The group carries only `value`, `multiple`, `disabled` (`docs/toggle-group.md:11-13`); arrows move focus only.
> Members are `toggle` controllers with a `value` (see [toggle.md](../widgets/toggle.md)) — there is no `toggle-item` entity.

### 2. Overload Contract

```ts
// ToggleGroup
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'toggle-group',
  props?: ToggleGroupProps<T>
): ToggleGroupAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`pressed`)** (`docs/toggle-group.md:20,29`):
  - Single: `group.value === props.value`. Multiple: `Boolean(group.value?.includes(props.value))`.

2. **Activation** (`docs/toggle-group.md:30`):
  - Single: activating an inactive item sets `group.value = item.value`; **activating the active item deselects it (
    `group.value = null`)** — unconditionally, there is no `required` refusal.
  - Multiple: toggles membership in `group.value`.

3. **Keyboard Navigation** (`docs/toggle-group.md:25-28`):
  - `Left` / `Up` → previous enabled item; `Right` / `Down` → next enabled item; `Home` / `End` → first / last enabled.
    Wraps and skips disabled.
  - **Focus movement touches no pressed state** (`:27`) — arrows never select; activation is pointer `click` or `Enter`/
    `Space` on the focused item. There is no `manual` toggle.

4. **Tab stop** (`docs/toggle-group.md:43`): `tabindex="0"` on the active item, or the first enabled item when none is
   active; siblings `-1`; all removed under `disabled`.

5. **Events** (`docs/toggle-group.md:34`): `change` on the container after group `value` commits,
   `CustomEvent<string | null | string[]>('change', { bubbles: true, detail: group.value })`.
