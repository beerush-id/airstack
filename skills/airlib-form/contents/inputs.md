# Form Inputs

AirLib Form ships with 14 pre-built input components covering standard HTML input types. These components require zero manual glue code: no manual `value` binding, no `onChange` handlers, and no boilerplate state machines.

---

## Context-Aware Input Architecture

AirLib inputs are self-driven components capable of operating across three distinct contexts:

### Inside a `<Field>` (Recommended)
When rendered inside a `<Field>`, the input automatically:
- Connects to the nearest `FieldContext` to discover its field name.
- Subscribes to the reactive field value in the form store.
- Adopts the field's generated DOM `id` for automatic `<label htmlFor="...">` pairing.
- Toggles `aria-invalid="true"` when validation or cross-field matching fails.
- Sets `aria-describedby` pointing to the field's validation error container.
- Automatically receives `disabled={true}` whenever the parent form enters `pending` status.

#### React & SolidJS
```tsx
<UserForm.Field name="email" label="Email Address">
  <EmailInput placeholder="user@domain.com" />
</UserForm.Field>
```

### Directly Inside `<Form>` (Without `<Field>`)
When placed inside a `<Form>` without a wrapping `<Field>`, provide the `name` prop explicitly. The input connects to form validation and change tracking, omitting the outer label and error container layout:

#### React & SolidJS
```tsx
<UserForm>
  <TextInput name="search" placeholder="Quick search..." />
</UserForm>
```

### Standalone (Outside Any Form)
Inputs can be used outside any form container. They provide automatic data parsing, type conversion, and state buffering:

#### React & SolidJS
```tsx
<NumberInput name="quantity" min={1} max={99} />
```

---

## Standard Input Components

### Textual Inputs

Buffer input values as standard strings and pair with `z.string()` schemas:

#### React
```tsx
<UserForm.Field name="username" label="Username">
  <TextInput placeholder="johndoe" />
</UserForm.Field>

<UserForm.Field name="email" label="Email">
  <EmailInput placeholder="john@example.com" />
</UserForm.Field>

<UserForm.Field name="password" label="Password">
  <PasswordInput placeholder="Enter password" />
</UserForm.Field>

<UserForm.Field name="bio" label="About You">
  <Textarea placeholder="Short bio..." rows={4} />
</UserForm.Field>
```

#### SolidJS
```tsx
<UserForm.Field name="username" label="Username">
  <TextInput placeholder="johndoe" />
</UserForm.Field>

<UserForm.Field name="email" label="Email">
  <EmailInput placeholder="john@example.com" />
</UserForm.Field>

<UserForm.Field name="password" label="Password">
  <PasswordInput placeholder="Enter password" />
</UserForm.Field>

<UserForm.Field name="bio" label="About You">
  <Textarea placeholder="Short bio..." rows={4} />
</UserForm.Field>
```

---

### Numeric Inputs

`NumberInput` and `Slider` handle the bridge between string keystrokes and parsed JavaScript `number` primitives. Keystrokes are buffered so intermediate states (such as typing decimal `"42."` or a minus sign `"-"`) do not jump the cursor or reset to zero, while syncing a valid `number` to the schema:

#### React & SolidJS
```tsx
<UserForm.Field name="age" label="Age">
  <NumberInput min={0} max={120} step={1} />
</UserForm.Field>

<UserForm.Field name="volume" label="Volume Level">
  <Slider min={0} max={100} step={5} />
</UserForm.Field>
```

---

### Date & Time Inputs

Sync temporal data formatted according to HTML standards (`YYYY-MM-DD` for dates, `HH:mm` for times):

#### React & SolidJS
```tsx
<UserForm.Field name="birthday" label="Date of Birth">
  <DatePicker />
</UserForm.Field>

<UserForm.Field name="reminderTime" label="Daily Reminder">
  <TimePicker />
</UserForm.Field>

<UserForm.Field name="appointment" label="Appointment">
  <DateTimePicker />
</UserForm.Field>
```

---

### Selection Inputs

#### Checkbox
Binds directly to boolean schema fields (`z.boolean()`):

```tsx
<UserForm.Field name="termsAccepted" label="I accept the Terms of Service">
  <Checkbox />
</UserForm.Field>
```

#### Select
Accepts native `<option>` child elements. Pairs with `z.string()` or `z.enum()`:

```tsx
<UserForm.Field name="role" label="Account Role">
  <Select>
    <option value="">Select a role...</option>
    <option value="admin">Administrator</option>
    <option value="editor">Editor</option>
    <option value="viewer">Viewer</option>
  </Select>
</UserForm.Field>
```

#### Radio
Radios automatically share their `name` attribute from the enclosing `FieldContext`, ensuring correct mutual exclusion grouping without manual group identifiers:

#### React
```tsx
<UserForm.Field name="subscriptionTier" label="Select Plan">
  {(field) => (
    <div className="radio-group">
      <label>
        <Radio value="starter" /> Starter ($9/mo)
      </label>
      <label>
        <Radio value="pro" /> Pro ($29/mo)
      </label>
      <label>
        <Radio value="enterprise" /> Enterprise ($99/mo)
      </label>
    </div>
  )}
</UserForm.Field>
```

#### SolidJS
```tsx
<UserForm.Field name="subscriptionTier" label="Select Plan">
  {(field) => (
    <div class="radio-group">
      <label>
        <Radio value="starter" /> Starter ($9/mo)
      </label>
      <label>
        <Radio value="pro" /> Pro ($29/mo)
      </label>
      <label>
        <Radio value="enterprise" /> Enterprise ($99/mo)
      </label>
    </div>
  )}
</UserForm.Field>
```

---

### Specialized Inputs

- `ColorPicker`: Native hex color picker (`#RRGGBB`).
- `FilePicker`: File upload selection forwarding `accept`, `multiple`, and file list data.

```tsx
<UserForm.Field name="accentColor" label="Theme Accent">
  <ColorPicker />
</UserForm.Field>

<UserForm.Field name="documents" label="Supporting Documents">
  <FilePicker accept=".pdf,.png,.jpg" multiple />
</UserForm.Field>
```

---

## Prop Forwarding

All input components forward unknown properties directly to the underlying HTML DOM element. You can pass arbitrary CSS classes, placeholders, data attributes, or event listeners:

#### React
```tsx
<UserForm.Field name="username" label="Username">
  <TextInput
    placeholder="e.g. alex2026"
    className="custom-input-box"
    autoComplete="username"
    data-testid="input-username"
    onFocus={(e) => console.log('Focused')}
  />
</UserForm.Field>
```

#### SolidJS
```tsx
<UserForm.Field name="username" label="Username">
  <TextInput
    placeholder="e.g. alex2026"
    class="custom-input-box"
    autoComplete="username"
    data-testid="input-username"
    onFocus={(e) => console.log('Focused')}
  />
</UserForm.Field>
```

---

## Building Custom Inputs with `createInput()`

When building custom input controls that bridge between custom display formats and stored schema data (e.g., currency masks or specialized numbers), use `createInput()`:

#### React
```tsx
import { createInput } from '@airlib/react-form';

export const CurrencyInput = createInput<number>('text', {
  parse: (display: string) => {
    const cleaned = display.replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  },
  stringify: (value: number) => {
    return typeof value === 'number' && !isNaN(value) ? `$${value.toFixed(2)}` : '';
  },
});
```

#### SolidJS
```tsx
import { createInput } from '@airlib/solid-form';

export const CurrencyInput = createInput<number>('text', {
  parse: (display: string) => {
    const cleaned = display.replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  },
  stringify: (value: number) => {
    return typeof value === 'number' && !isNaN(value) ? `$${value.toFixed(2)}` : '';
  },
});
```

The resulting `CurrencyInput` component functions identically to standard built-in inputs: it auto-wires inside `<Field>`, buffers typing, and converts stored numbers to formatted currency strings.
