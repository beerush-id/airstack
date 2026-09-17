# Field Specification

The form field association unit. Hosts ambient context with a guaranteed unique field ID, automatically wiring labels, slotted controls, helper descriptions, and error messages without requiring manual author ID ceremony.

- **Entity**: `field`
- **WAI-ARIA Role**: `group` (when grouping multiple sub-controls, otherwise omitted)

### Composite Parts (Entity Tree)
- **`Field`**: Container coordinator hosting ambient field ID, `disabled`, `invalid`, and `required` state.
- **`FieldLabel`**: Label association member (`for` on `<label>`, or ID referenced by `aria-labelledby`).
- **`FieldControl`**: Slotted control proxy reflecting `id`, `disabled`, `required`, `aria-invalid`, and `aria-describedby`.
- **`FieldDescription`**: Helper text provider referenced via `aria-describedby`.
- **`FieldError`**: Error message provider with polite live region, appended to `aria-describedby` when `invalid: true`.

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Field`** | Container (`<div>` or `<fieldset>`). | `role="group"` (when multiple sub-controls, omitted on `<fieldset>`). | Group coordinator. Publishes `fieldCtx`. Props: `FieldProps`. |
| **`FieldLabel`** | Native `<label>` or non-label element. | None (on `<label>`), or ID for `aria-labelledby` on custom element. | Connects to control via `for` or ID association. |
| **`FieldControl`** | Native input (`<input>`, `<select>`, `<textarea>`) or custom control. | `aria-invalid`, `aria-describedby`, `aria-required`, `aria-disabled`. | Propagates ambient state to bound element. |
| **`FieldDescription`** | Text container (`<span>` / `<p>`). | None (ID referenced by control). | Helper text container. |
| **`FieldError`** | Text container (`<span>` / `<p>`). | `aria-live="polite"`. | Dynamic error announcer. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `FieldProps`
```ts
export interface FieldProps {
  /** Explicit field namespace ID */
  id?: string;
  /** Validation failure flag */
  invalid?: boolean;
  /** Requirement flag */
  required?: boolean;
  /** Disabled flag inherited by controls */
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Field: Root coordinator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'field',
  props?: FieldProps
): FieldAria<E>;

// FieldLabel
export function aria<E extends BaseElement = HTMLLabelElement>(
  role: 'field-label',
  props?: AriaProps
): FieldLabelAria<E>;

// FieldControl
export function aria<E extends BaseElement = HTMLElement>(
  role: 'field-control',
  props?: AriaProps
): FieldControlAria<E>;

// FieldDescription
export function aria<E extends BaseElement = HTMLElement>(
  role: 'field-description',
  props?: AriaProps
): FieldDescriptionAria<E>;

// FieldError
export function aria<E extends BaseElement = HTMLElement>(
  role: 'field-error',
  props?: AriaProps
): FieldErrorAria<E>;
```

---

## State & Lifecycle Rules

1. **Ambient Context ID**:
   - `Field` generates an ambient ID (`field-${uIndex(FIELD_INDEX, true)}`) if none declared.
   - Derived IDs: control ID (`${fieldId}-control`), description ID (`${fieldId}-desc`), error ID (`${fieldId}-error`).

2. **Control State Reflection**:
   - Native controls receive native `disabled` and `required`.
   - Custom controls receive `aria-disabled="true"` and `aria-required="true"`.
   - `aria-invalid="true"` set when `field.invalid: true`.
   - `aria-describedby` set to description ID, appending error ID when `invalid: true`.
