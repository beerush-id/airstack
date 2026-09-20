# Validation & Cross-Field Matching

AirLib Form treats the Zod schema as the foundational validation contract. Validation runs continuously on every field mutation, driving reactive error collections, dirty tracking, and conditional cross-field matching without manual trigger functions.

---

## 1. Schema Validation & Error Collections

Every validation rule defined on a Zod property executes when the corresponding field value changes:

#### React & SolidJS
```typescript
import { z } from 'zod';

export const registrationSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  email: z.string().email('Enter a valid email address'),
});
```

### Error Arrays

When a field fails multiple rules, the engine collects all failure messages in an array:
- `field.error`: An array of error strings (`string[]`), or `undefined` if valid.
- Default `<Field>` rendering displays the primary error (`field.error[0]`).
- For custom multi-error presentation, use headless field rendering.

---

## 2. Interaction Signals: `touched` vs `changed`

AirLib Form maintains two granular interaction flags per field and at the root form level:

| Signal | Definition | Reversion Behavior | Typical Use Case |
|---|---|---|---|
| **`touched`** | True once a field value has been mutated by user interaction. | Stays `true` even if the user deletes the value back to initial. Resets only on form reset. | Delaying error messages until the user has actually edited a field. |
| **`changed`** | True when the current field value differs from its baseline initial value. | Automatically reverts to `false` if the user restores the exact initial value. | Enabling the "Save" or "Undo" button; generating diff payloads. |

### Idiomatic Error Display Pattern

Show error messages only after a field has been touched to avoid displaying red errors on pristine forms:

#### React
```tsx
<UserForm.Field name="email">
  {(field) => (
    <div className="field-group">
      <label htmlFor={field.name}>Email Address</label>
      <EmailInput />
      <Show when={() => field.touched && !field.valid}>
        <span className="field-error">{field.error?.[0]}</span>
      </Show>
    </div>
  )}
</UserForm.Field>
```

#### SolidJS
```tsx
<UserForm.Field name="email">
  {(field) => (
    <div class="field-group">
      <label for={field.name}>Email Address</label>
      <EmailInput />
      <Show when={field.touched && !field.valid}>
        <span class="field-error">{field.error?.[0]}</span>
      </Show>
    </div>
  )}
</UserForm.Field>
```

---

## 3. Cross-Field Matching (`match`)

Cross-field validation rules (such as confirming passwords or verifying date ranges) are handled using the `match` prop on `<Field>`.

### Equality Matching

Pass the target field name as a string:

#### React
```tsx
import { template } from '@airlib/react';
import { createForm, PasswordInput } from '@airlib/react-form';
import { z } from 'zod';
import { savePassword } from './function.js';

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const PasswordForm = createForm(passwordSchema);

export const ChangePassword = template(() => (
  <PasswordForm onSubmit={savePassword}>
    <PasswordForm.Field name="password" label="New Password">
      <PasswordInput />
    </PasswordForm.Field>

    <PasswordForm.Field
      name="confirmPassword"
      label="Confirm Password"
      match="password"
      mismatchLabel="Passwords do not match"
    >
      <PasswordInput />
    </PasswordForm.Field>

    <PasswordForm.Submit>Update Password</PasswordForm.Submit>
  </PasswordForm>
));
```

#### SolidJS
```tsx
import { template } from '@airlib/solid';
import { createForm, PasswordInput } from '@airlib/solid-form';
import { z } from 'zod';
import { savePassword } from './function.js';

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const PasswordForm = createForm(passwordSchema);

export const ChangePassword = template(() => (
  <PasswordForm onSubmit={savePassword}>
    <PasswordForm.Field name="password" label="New Password">
      <PasswordInput />
    </PasswordForm.Field>

    <PasswordForm.Field
      name="confirmPassword"
      label="Confirm Password"
      match="password"
      mismatchLabel="Passwords do not match"
    >
      <PasswordInput />
    </PasswordForm.Field>

    <PasswordForm.Submit>Update Password</PasswordForm.Submit>
  </PasswordForm>
));
```

### Custom Predicate Matching

For logic beyond strict equality, pass a predicate function. The function receives the `FormState` and returns a `boolean`:

#### React & SolidJS
```tsx
import { template } from '@airlib/react';
import { createForm, DatePicker } from '@airlib/react-form';
import { z } from 'zod';

const bookingSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

const BookingForm = createForm(bookingSchema);

export const DateSelector = template(() => (
  <BookingForm>
    <BookingForm.Field name="startDate" label="Check-In">
      <DatePicker />
    </BookingForm.Field>

    <BookingForm.Field
      name="endDate"
      label="Check-Out"
      match={(form) => form.fields['endDate'] > form.fields['startDate']}
      mismatchLabel="Check-out date must be after check-in date"
    >
      <DatePicker />
    </BookingForm.Field>
  </BookingForm>
));
```

The predicate function executes inside an Anchor reactive observer. When either `startDate` or `endDate` mutates, the match condition automatically re-evaluates.

### Signal Independence & Display Priority

`field.valid` and `field.matched` are decoupled signals:
- `valid`: Reflects schema validation alone.
- `matched`: Reflects the match condition alone.

The built-in `<Field>` handles display priority automatically:
1. If the field fails schema validation, the schema error displays first.
2. If the field passes schema validation but fails the match condition, `mismatchLabel` displays.

---

## 4. Asynchronous Validation & Form Blocking

When checking server-side uniqueness (e.g. username availability or organization domain checks), use `form.block()` and `form.unblock()` to coordinate submission gating:

#### React
```tsx
import { setup, effect } from '@airlib/react';
import { checkUsername } from './function.js';
import { UserForm } from './UserForm.js';

export const UsernameVerifier = setup(() => {
  const form = UserForm.get()!;
  const username = UserForm.field('username');

  effect(async () => {
    const value = username.value;
    if (!value || value.length < 3) return;

    // Block form submission while checking
    form.block('check-username');

    try {
      const available = await checkUsername(value);

      if (!available) {
        form.errors['username'] = ['Username is already taken'];
      }
    } finally {
      // Release submission block
      form.unblock('check-username');
    }
  });

  return () => null;
});
```

#### SolidJS
```tsx
import { setup, effect } from '@airlib/solid';
import { checkUsername } from './function.js';
import { UserForm } from './UserForm.js';

export const UsernameVerifier = setup(() => {
  const form = UserForm.get()!;
  const username = UserForm.field('username');

  effect(async () => {
    const value = username.value;
    if (!value || value.length < 3) return;

    form.block('check-username');

    try {
      const available = await checkUsername(value);

      if (!available) {
        form.errors['username'] = ['Username is already taken'];
      }
    } finally {
      form.unblock('check-username');
    }
  });

  return () => null;
});
```

While any key is registered via `form.block(key)`:
- `form.blocked` evaluates to `true`.
- `form.canSubmit` evaluates to `false`.
- `<UserForm.Submit>` disables automatically.
