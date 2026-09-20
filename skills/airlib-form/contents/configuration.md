# Global Configuration

AirLib Form provides a global configuration API through `configureForm`. Calling this once at application bootstrap applies consistent design system styling, CSS utility classes, validation labels, and behavior defaults to all forms, fields, and inputs across your project.

---

## 1. Setting Up `configureForm()`

Call `configureForm()` at the root entry point of your application (e.g. `main.tsx` or `client.tsx`):

#### React
```tsx
// main.tsx
import { configureForm } from '@airlib/react-form';

configureForm({
  form: {
    class: 'space-y-4',
    errorClass: 'form-has-error',
    strict: true,
  },
  field: {
    class: 'flex flex-col gap-1.5',
    labelClass: 'text-sm font-medium text-slate-700',
    errorClass: 'text-xs text-red-600',
    requiredLabel: '*',
    requiredClass: 'text-red-500 ml-0.5',
    mismatchLabel: 'Values do not match',
  },
  input: {
    class: 'w-full px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
    errorClass: 'border-red-500 bg-red-50/50 text-red-900',
  },
  submit: {
    class: 'inline-flex items-center justify-center px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
    pendingClass: 'animate-pulse',
  },
  reset: {
    class: 'inline-flex items-center justify-center px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed',
    dirtyClass: 'border border-slate-300',
  },
});
```

#### SolidJS
```tsx
// client.tsx
import { configureForm } from '@airlib/solid-form';

configureForm({
  form: {
    class: 'space-y-4',
    errorClass: 'form-has-error',
    strict: true,
  },
  field: {
    class: 'flex flex-col gap-1.5',
    labelClass: 'text-sm font-medium text-slate-700',
    errorClass: 'text-xs text-red-600',
    requiredLabel: '*',
    requiredClass: 'text-red-500 ml-0.5',
    mismatchLabel: 'Values do not match',
  },
  input: {
    class: 'w-full px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
    errorClass: 'border-red-500 bg-red-50/50 text-red-900',
  },
  submit: {
    class: 'inline-flex items-center justify-center px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
    pendingClass: 'animate-pulse',
  },
  reset: {
    class: 'inline-flex items-center justify-center px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed',
    dirtyClass: 'border border-slate-300',
  },
});
```

---

## 2. Granular Input Type Customization

Different input controls often demand specialized styling (e.g. checkboxes and file pickers differ fundamentally from text inputs). Specific input keys merge on top of the base `input` defaults:

#### React & SolidJS
```tsx
configureForm({
  // Base fallback for all inputs
  input: {
    class: 'border rounded px-3 py-2',
    errorClass: 'border-red-500',
  },

  // Overrides applied specifically to <Checkbox>
  checkbox: {
    class: 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500',
    errorClass: 'border-red-500',
  },

  // Overrides applied specifically to <Textarea>
  textarea: {
    class: 'w-full px-3 py-2 border rounded resize-y min-h-[100px]',
  },

  // Overrides applied specifically to <FilePicker>
  file: {
    class: 'file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100',
  },
});
```

---

## 3. Configuration Reference Table

### Structural Components

| Key | Options | Description |
|---|---|---|
| `form` | `class`, `errorClass`, `pendingClass`, `strict`, `validateOnInit`, `settleOnSubmit` | Root `<Form>` container defaults. |
| `field` | `class`, `labelClass`, `controlClass`, `supportClass`, `errorClass`, `requiredLabel`, `requiredClass`, `mismatchLabel` | Layout, label, and error styling for `<Field>`. |

### Action Buttons

| Key | Options | Description |
|---|---|---|
| `submit` | `class`, `pendingClass` | Default classes and in-flight animations for `<FormSubmit>` / `<Form.Submit>`. |
| `reset` | `class`, `dirtyClass` | Default classes and dirty indicators for `<FormReset>` / `<Form.Reset>`. |

### Specific Input Keys

Each input accepts `{ class?: string, errorClass?: string }`:

| Key | Target Component |
|---|---|
| `input` | Base fallback for all input components |
| `textInput` | `<TextInput>` |
| `emailInput` | `<EmailInput>` |
| `passwordInput` | `<PasswordInput>` |
| `numberInput` | `<NumberInput>` |
| `textarea` | `<Textarea>` |
| `checkbox` | `<Checkbox>` |
| `radio` | `<Radio>` |
| `select` | `<Select>` |
| `file` | `<FilePicker>` |
| `datePicker` | `<DatePicker>` |
| `timePicker` | `<TimePicker>` |
| `dateTimePicker` | `<DateTimePicker>` |
| `colorPicker` | `<ColorPicker>` |
| `slider` | `<Slider>` |

---

## 4. Local Instance Overrides

Global settings establish the baseline. Any property passed directly to a component instance overrides the global default:

#### React
```tsx
<UserForm.Field
  name="notes"
  label="Additional Notes"
  className="custom-field-wrapper"
  errorClass="text-amber-600"
>
  <Textarea className="min-h-[250px]" />
</UserForm.Field>
```

#### SolidJS
```tsx
<UserForm.Field
  name="notes"
  label="Additional Notes"
  class="custom-field-wrapper"
  errorClass="text-amber-600"
>
  <Textarea class="min-h-[250px]" />
</UserForm.Field>
```

When an error or pending state occurs, the dynamic state classes (`errorClass`, `pendingClass`) are appended automatically, preserving design consistency even on overridden components.
