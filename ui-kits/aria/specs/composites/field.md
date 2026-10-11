# Field Specification

The form field association unit. Hosts ambient context with a guaranteed unique field ID, automatically wiring labels,
slotted controls, helper descriptions, and error messages without requiring manual author ID ceremony.

- **Entity**: `field`
- **WAI-ARIA Role**: none — the container compiles `id` only

### Composite Parts (Entity Tree)

- **`Field`**: Container coordinator hosting the ambient field ID, the value, and the `required` / `disabled` /
  `invalid` / `touched` validation state.
- **`FieldLabel`**: Label association member (`for` on `<label>`, or the `{id}-label` address referenced by
  `aria-labelledby`).
- **`FieldControl`**: Slotted control proxy reflecting `id`, `type`, `value`, `placeholder`, `disabled`, `required`,
  `aria-labelledby`, `aria-describedby`, `aria-invalid`, and `aria-errormessage`. Owns the `input` and `blur` listeners.
- **`FieldDescription`**: Helper text provider referenced via `aria-describedby` for the life of the field.
- **`FieldError`**: Failure text container with a polite live region, `hidden` until the field is touched and invalid,
  referenced through `aria-errormessage`.

---

## The Three Semantic Layers

| Part / Role            | HTML Semantic                                                         | WAI-ARIA Semantic                                                     | Aria Package Semantic Contract                                |
|:-----------------------|:----------------------------------------------------------------------|:----------------------------------------------------------------------|:--------------------------------------------------------------|
| **`Field`**            | Container (`<div>` or `<fieldset>`).                                  | None — compiles `id` only.                                            | Coordinator. Publishes `fieldCtx`. Props: `FieldProps`. Options: `FieldOptions`. |
| **`FieldLabel`**       | Native `<label>` or non-label element.                                | None (on `<label>`), or ID for `aria-labelledby` on custom element.   | Connects to control via `for` or ID association.              |
| **`FieldControl`**     | Native input (`<input>`, `<select>`, `<textarea>`) or custom control. | `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-errormessage`, `aria-required`, `aria-disabled`. | Propagates ambient state and owns the `input` and `blur` listeners. |
| **`FieldDescription`** | Text container (`<span>` / `<p>`).                                    | None (ID referenced by control).                                      | Helper text container.                                        |
| **`FieldError`**       | Text container (`<span>` / `<p>`).                                    | `aria-live="polite"`, `hidden` until visible.                         | Failure announcer referenced by `aria-errormessage`.          |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `FieldProps`

```ts
export interface FieldProps extends AriaProps {
  /** Explicit field namespace ID. */
  id?: string;
  /** Requirement flag. */
  required?: boolean;
  /** Disabled flag inherited by controls. */
  disabled?: boolean;
  /** Input type. */
  type?: string;
  /** Input value. */
  value?: string | number;
  /** Input placeholder. */
  placeholder?: string;
  /** Whether the field is invalid. */
  invalid?: boolean;
  /** Invalid messages. */
  invalidMessages?: string | string[];
  /** Whether the field has been touched. */
  touched?: boolean;
  /** Input event handler. */
  oninput?: EventHandler<InputEvent, HTMLInputElement>;
}
```

#### `FieldOptions`

```ts
export interface FieldOptions extends AriaOptions {
  validate?: (value?: string | number) => string | string[] | void;
  labelled?: boolean;
  described?: boolean;
}
```

#### Attribute Contracts

```ts
export interface FieldAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}

export interface FieldLabelAttributes<E extends BaseElement = HTMLLabelElement> extends AriaAttributes<E> {
  id: string;
  for?: string;
}

export interface FieldControlAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  disabled?: boolean;
  required?: boolean;
  'aria-invalid'?: 'true';
  'aria-disabled'?: 'true' | 'false';
  'aria-required'?: 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
}

export interface FieldDescriptionAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}

export interface FieldErrorAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  hidden?: boolean;
  'aria-live': 'polite';
}
```

### 2. Overload Contracts

```ts
// Field: Root coordinator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'field',
  props?: FieldProps,
  options?: FieldOptions
): FieldAria<E>;

// FieldLabel
export function aria<E extends BaseElement = HTMLLabelElement>(
  role: 'field-label',
  props?: AriaProps,
  options?: AriaOptions
): FieldLabelAria<E>;

// FieldControl
export function aria<E extends BaseElement = HTMLElement>(
  role: 'field-control',
  props?: AriaProps,
  options?: AriaOptions
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
  - `Field` publishes itself through `fieldCtx`; every part discovers it at construction and compiles nothing without it.
  - `Field` generates an ambient ID (`field-${uIndex(FIELD_INDEX, true)}`) if none declared.
  - Derived IDs: `${fieldId}-label`, `${fieldId}-control`, `${fieldId}-desc`, `${fieldId}-error`.

2. **Control State Reflection**:
  - Native controls receive `type`, `value`, `placeholder`, `disabled`, and `required` as properties.
  - Custom controls receive `aria-disabled` and `aria-required` instead — explicit `"false"` until set, explicit `"true"` after.
  - `aria-labelledby` is `${fieldId}-label` unless the field declares `labelled: false`, and is emitted beside `for` on a native label.
  - `aria-describedby` is `${fieldId}-desc` unless the field declares `described: false`, and never carries the error ID.
  - `aria-invalid="true"` and `aria-errormessage="${fieldId}-error"` are emitted only while `touched && invalid`, and withdraw together the moment the value validates.

3. **Value & Validation**:
  - The control listens for `input`: it writes the element's value into `field.value`, validates, then re-dispatches the event.
  - With `options.validate`, its return is the failure — a non-empty string or list sets `invalid` and fills `invalidMessages`, an empty return clears both.
  - Without `options.validate`, the field falls back to the control's native `checkValidity()`, so `type` alone drives the rule.
  - `invalidMessages` is writable for failures the field cannot compute, and never flips `invalid` on its own.

4. **Touched Gate**:
  - The control listens for `blur` and sets `field.touched = true`.
  - No failure is projected before that, matching native constraint validation: a required field never opens red.

5. **Error Part**:
  - Carries `${fieldId}-error` with `aria-live="polite"` for the life of the field.
  - `hidden` is `!visible`, where `visible` is `field.touched && field.invalid`.
  - Publishes `visible` and `message`; the failure copy is the consumer's to render.

6. **Public State**:
  - `FieldAria`: `id`, `type` (default `text`), `value`, `placeholder` (default `''`), `required`, `disabled`, `invalid`, `touched`, `invalidMessages`, `canValidate`, `validate(value)`. `value`, `invalid`, `touched`, and `invalidMessages` are writable.
  - `FieldControlAria`: `type`, `value`, `invalid`, `disabled`, `required`, each falling back when no field is present.
  - `FieldErrorAria`: `visible`, `message`.

7. **Teardown**:
  - Destroying the field detaches every part; parts freeze at their last compiled state instead of following dead state.
