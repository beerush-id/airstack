# Text-Input Specification

A text-input is the single-line or multiline text field an author holds for entering and editing text across native
`<input>`, `<textarea>`, and custom textboxes.

- **Entity**: `text-input`
- **WAI-ARIA Role**: `searchbox` (when `kind: 'search'` on custom host), `textbox` (on custom host), none on native
  `<input>`/`<textarea>`.

---

## The Three Semantic Layers

| Part / Role                         | HTML Semantic                                                                                                           | WAI-ARIA Semantic                                                                                                                                                                                                                                                              | Aria Package Semantic Contract                                                                                                                                                          |
|:------------------------------------|:------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Native `<input>` / `<textarea>`** | Native input or textarea. Handles text entry, selection, native form participation, `disabled`, `readonly`, `required`. | No role compiled. `aria-invalid="true"` only when invalid (derived from Field).                                                                                                                                                                                                | `type` reflects `kind`; `disabled`, `readOnly`, `required`, `placeholder` sync native properties. No ARIA mirror for readonly/required. Browser `input`/`change` are not re-dispatched. |
| **Custom Textbox**                  | Custom element (`<div>`).                                                                                               | `role="searchbox"` when `kind: 'search'`, else `role="textbox"`; `aria-multiline="true"` when `multiline`; `aria-readonly`/`aria-disabled`/`aria-required` reflect state; `aria-invalid` always explicit; `tabindex` (`0` enabled, `-1` disabled, numbers). | Polyfills the tab stop; dispatches `change` (on blur following edits).                                                               |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TextInputOptions`

```ts
export interface TextInputOptions {
  /** Whether bound to native <input> or <textarea> (default: true) */
  native?: boolean;
}
```

#### `TextInputProps`

```ts
export interface TextInputProps {
  /** Live text value (default: ""; read/write) */
  value?: string;
  /** Text input kind (default: 'text'); 'search' selects the searchbox role and Escape-revert behavior */
  kind?: 'text' | 'password' | 'search' | 'email' | 'tel' | 'url';
  /** Multiline flag (default: false); native multiline host is a <textarea> */
  multiline?: boolean;
  /** Read-only flag blocking edits while keeping focusability (default: false) */
  readonly?: boolean;
  /** Disabled indicator (default: false) */
  disabled?: boolean;
  /** Requirement flag (default: false) */
  required?: boolean;
  /** Placeholder hint */
  placeholder?: string;
}
```

> Accessible name and invalidity are direct inputs: `label` compiles to `aria-label` and `invalid` to `aria-invalid`
> (always explicit, defaulting to `"false"`). A Field may forward these, but the controller owns the projection.
> Amended 2026-10-06 (tests win): the prior revision routed both exclusively through Field.

### 2. Overload Contract

```ts
// Text-Input: Text input controller
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'text-input',
  props?: TextInputProps,
  options?: TextInputOptions
): TextInputAria<E>;
```

---

## State & Lifecycle Rules

1. **Editing & Blocking**:
  - Typing commits edits to reactive `value` unless blocked by `disabled` or `readonly` (`docs/text-input.md:21`).
    `readonly` keeps focusability; `disabled` parks the tab stop at `-1` (tests + selection-family parity win over
    any "removed" wording).
  - `type` is emitted only when defined (`search-input` face); an explicit `undefined` is never compiled, since
    getter-only hosts (e.g. `<textarea>`) throw on assignment.
  - Deferred, not contracted: `Escape`-revert under `kind: 'search'` and per-edit synthetic `input` on custom
    hosts have no test coverage yet — the only custom commit signal is `change` on blur following edits.
2. **Host-Aware Role Emission**:
  - Native `<input>` and `<textarea>` emit no role.
  - Non-input hosts emit `role="searchbox"` when `kind: 'search'`, otherwise `role="textbox"`.
  - `multiline: true` compiles `aria-multiline="true"` on custom hosts; the native multiline host is a `<textarea>`
    (implicit, so no `aria-multiline` mirror).
3. **Events**:
  - Native elements: browser `input` and `change` pass through (not re-dispatched).
  - Custom hosts: dispatches `CustomEvent<string>('change', { bubbles: true, detail: value })` on blur following
    committed edits. Blurs with no diff stay silent; blurs while disabled track the value but withhold the event
    until an enabled blur observes it. Teardown removes the blur listener.

4. **Value plane** (`spec.md`): `aria-*` states are explicit strings; `readonly` / `disabled` / `required` are
  logical booleans; `defaultValue` carries the SSR snapshot while `value` never enters the compiled dictionary.
