# Composition & Custom Inputs

AirLib Form provides multiple composition patterns to adapt to any design system: headless render functions, named component slots, input wrappers using `for={props}`, custom input creation via `createInput()`, and automatic accessibility wiring.

---

## Named Field Slots (`<Component.Snippet>`)

Named field slots allow injecting custom elements or adornments into predefined layout regions while preserving the field's automated accessibility (`id`, `htmlFor`, `aria-invalid`, `aria-describedby`) and error container structure.

### Available Field Slots

| Slot Name | Parameter | Description |
|---|---|---|
| `prefix` | `field` | Content rendered immediately before the input control (e.g. icons, currency symbols). |
| `suffix` | `field` | Content rendered immediately after the input control (e.g. badges, action buttons). |
| `support` | `field` | Content below the input (defaults to error messages; can display helper text). |
| `label` | `field` | Replaces or decorates the label element. |

#### React
```tsx
import { EmailInput } from '@airlib/react-form';
import { UserForm } from './UserForm.js';

<UserForm.Field name="email" label="Work Email">
  <UserForm.Field.Snippet for="prefix">
    {() => <span className="icon-mail">✉️</span>}
  </UserForm.Field.Snippet>

  <EmailInput placeholder="name@company.com" />

  <UserForm.Field.Snippet for="suffix">
    {() => <span className="badge-verified">Verified</span>}
  </UserForm.Field.Snippet>

  <UserForm.Field.Snippet for="support">
    {(field) => (
      <small className="helper-text">
        {field.error?.[0] ?? 'We never share your email with third parties.'}
      </small>
    )}
  </UserForm.Field.Snippet>
</UserForm.Field>
```

#### SolidJS
```tsx
import { EmailInput } from '@airlib/solid-form';
import { UserForm } from './UserForm.js';

<UserForm.Field name="email" label="Work Email">
  <UserForm.Field.Snippet for="prefix">
    {() => <span class="icon-mail">✉️</span>}
  </UserForm.Field.Snippet>

  <EmailInput placeholder="name@company.com" />

  <UserForm.Field.Snippet for="suffix">
    {() => <span class="badge-verified">Verified</span>}
  </UserForm.Field.Snippet>

  <UserForm.Field.Snippet for="support">
    {(field) => (
      <small class="helper-text">
        {field.error?.[0] ?? 'We never share your email with third parties.'}
      </small>
    )}
  </UserForm.Field.Snippet>
</UserForm.Field>
```

---

## Headless Field Customization

When you need total control over the markup surrounding an input, pass a render function as `children` to `<UserForm.Field>`.

**Precedence**: When `children` is a render function, the field operates in headless mode. It bypasses the built-in layout entirely, meaning custom rendering takes complete precedence over any `<Snippet>` slots.

#### React
```tsx
import { Show } from '@airlib/react';
import { EmailInput } from '@airlib/react-form';
import { UserForm } from './UserForm.js';

<UserForm.Field name="email">
  {(field) => (
    <div className="custom-control-group">
      <div className="label-row">
        <label htmlFor={field.name}>Email Address</label>
        <Show when={() => field.changed}>
          <span className="pill-modified">Modified</span>
        </Show>
      </div>

      <EmailInput placeholder="name@domain.com" />

      <Show when={() => field.touched && !field.valid}>
        <p className="validation-alert" role="alert">
          {field.error?.[0]}
        </p>
      </Show>
    </div>
  )}
</UserForm.Field>
```

#### SolidJS
```tsx
import { Show } from '@airlib/solid';
import { EmailInput } from '@airlib/solid-form';
import { UserForm } from './UserForm.js';

<UserForm.Field name="email">
  {(field) => (
    <div class="custom-control-group">
      <div class="label-row">
        <label for={field.name}>Email Address</label>
        <Show when={field.changed}>
          <span class="pill-modified">Modified</span>
        </Show>
      </div>

      <EmailInput placeholder="name@domain.com" />

      <Show when={field.touched && !field.valid}>
        <p class="validation-alert" role="alert">
          {field.error?.[0]}
        </p>
      </Show>
    </div>
  )}
</UserForm.Field>
```

### Properties Exposed on `field`

| Property | Type | Description |
|---|---|---|
| `field.name` | `string` | Resolved dot-notation path of the field. |
| `field.value` | `T` | Current reactive value stored in form state. |
| `field.error` | `string[] \| undefined` | Array of active schema validation errors. |
| `field.valid` | `boolean` | True if the field currently passes schema validation. |
| `field.matched` | `boolean` | True if the field satisfies the `match` rule. |
| `field.touched` | `boolean` | True if the user has mutated this field at least once. |
| `field.changed` | `boolean` | True if the current value differs from baseline. |
| `field.disabled` | `boolean` | True when the form is currently in `pending` submission state. |
| `field.reset()` | `() => void` | Reverts this single field to its baseline value. |
| `field.clear()` | `() => void` | Clears this single field to an empty value. |

---

## Headless Input Customization

All built-in inputs accept a function as `children`. When provided, the input calculates all required HTML attributes, ARIA roles, and event listeners, yielding `(props, input)`:

#### React
```tsx
import { classx } from '@airlib/react';
import { Checkbox, TextInput } from '@airlib/react-form';

// Custom Search Box with Inner Clear Button
<TextInput placeholder="Search...">
  {(props, input) => (
    <div className="search-wrapper">
      <span className="search-icon">🔍</span>
      <input {...props} className="search-native-input" />
      {input.value && (
        <button type="button" onClick={() => (input.value = '')}>
          ✕
        </button>
      )}
    </div>
  )}
</TextInput>

// Custom Animated Toggle Switch
<Checkbox name="autoRenew">
  {(props, input) => (
    <label className={classx('toggle-switch', { checked: input.checked })}>
      <input {...props} className="sr-only" />
      <span className="slider-knob" />
    </label>
  )}
</Checkbox>
```

#### SolidJS
```tsx
import { classx } from '@airlib/solid';
import { Checkbox, TextInput } from '@airlib/solid-form';

// Custom Search Box with Inner Clear Button
<TextInput placeholder="Search...">
  {(props, input) => (
    <div class="search-wrapper">
      <span class="search-icon">🔍</span>
      <input {...props} class="search-native-input" />
      {input.value && (
        <button type="button" onClick={() => (input.value = '')}>
          ✕
        </button>
      )}
    </div>
  )}
</TextInput>

// Custom Animated Toggle Switch
<Checkbox name="autoRenew">
  {(props, input) => (
    <label class={classx('toggle-switch', { checked: input.checked })}>
      <input {...props} class="sr-only" />
      <span class="slider-knob" />
    </label>
  )}
</Checkbox>
```

---

## Reusable Input Wrappers (`for={props}`)

To create reusable design-system inputs without losing context wiring, forward incoming props through `for={props}`:

#### React
```tsx
import { setup, Show } from '@airlib/react';
import { TextInput, TextInputProps } from '@airlib/react-form';

export const LabeledSearchInput = setup<TextInputProps>((props) => {
  return () => (
    <TextInput for={props}>
      {(inputProps, input) => (
        <div className="search-box">
          <input {...inputProps} />
          <Show when={() => input.touched && input.error}>
            <span className="error-icon">⚠️</span>
          </Show>
        </div>
      )}
    </TextInput>
  );
});
```

#### SolidJS
```tsx
import { setup, Show } from '@airlib/solid';
import { TextInput, TextInputProps } from '@airlib/solid-form';

export const LabeledSearchInput = setup<TextInputProps>((props) => {
  return (
    <TextInput for={props}>
      {(inputProps, input) => (
        <div class="search-box">
          <input {...inputProps} />
          <Show when={input.touched && input.error}>
            <span class="error-icon">⚠️</span>
          </Show>
        </div>
      )}
    </TextInput>
  );
});
```

---

## Built-In Accessibility (a11y) Invariants

Every `<Field>` and input component adheres to accessibility specifications automatically:

- **Label Association**: The `<label>` element renders with `htmlFor="{fieldId}"`, pointing directly to the `<input id="{fieldId}">`.
- **Invalid State Indication**: When a field fails schema validation or cross-field matching, `aria-invalid="true"` is attached to the input element.
- **Error Identification**: The input receives `aria-describedby="{fieldId}-error"`. The accompanying error container renders with `id="{fieldId}-error"` and `role="alert"`.
- **Interaction Lockout**: When the parent form enters `pending` submission status, all inputs receive `disabled={true}`, preventing screen reader edits while network transactions are active.
