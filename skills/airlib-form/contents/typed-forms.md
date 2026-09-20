# Typed Forms

AirLib Form provides schema-driven reactive form management. By defining a Zod schema once, the engine autonomously derives runtime validation, change tracking, fine-grained reactivity, and submission state machines.

---

## Defining the Zod Schema

The Zod schema acts as the single source of truth for field paths, data types, constraints, and error messages:

#### React & SolidJS
```typescript
import { z } from 'zod';

export const userProfileSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email address'),
  age: z.number().min(18, 'Must be at least 18 years old'),
  bio: z.string().max(160, 'Bio cannot exceed 160 characters').optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
```

Every property in the schema maps directly to a form field path. Validation runs on every mutation without manual trigger calls.

---

## Generating a Typed Form Component

Pass the schema to `createForm()` to produce a type-safe form component bundle:

#### React
```tsx
import { createForm } from '@airlib/react-form';
import { userProfileSchema } from './schema.js';

export const UserForm = createForm(userProfileSchema);
```

#### SolidJS
```tsx
import { createForm } from '@airlib/solid-form';
import { userProfileSchema } from './schema.js';

export const UserForm = createForm(userProfileSchema);
```

The returned `UserForm` is both a component and a namespace providing colocated, typed subcomponents:
- `<UserForm>`: The root form wrapper establishing context.
- `<UserForm.Field>`: Typed field wrapper enforcing schema keys (`name="typo"` produces a compile-time error).
- `<UserForm.FieldList>`: Typed array manager for repeatable items.
- `<UserForm.Submit>`: Self-governing submit button bound to form validity and dirty states.
- `<UserForm.Reset>`: Self-governing reset button reverting changes.
- `UserForm.get()`: Context accessor returning the active `FormState`.
- `UserForm.field('name')`: Context accessor returning a typed `FormField` signal.

---

## Building and Binding a Form

Bind an initial state object using an AirLib `mutable` store and attach an `onSubmit` handler:

#### React
```tsx
import { mutable, setup } from '@airlib/react';
import { EmailInput, NumberInput, Textarea, TextInput } from '@airlib/react-form';
import { updateProfile } from './function.js';
import { UserForm } from './UserForm.js';

export const ProfileEditor = setup(() => {
  const profile = mutable({
    name: '',
    email: '',
    age: 18,
    bio: '',
  });

  const handleSave = async (data: typeof profile, changes: Partial<typeof profile>) => {
    await updateProfile(changes);
  };

  return () => (
    <UserForm value={profile} onSubmit={handleSave}>
      <UserForm.Field name="name" label="Full Name">
        <TextInput placeholder="Jane Doe" />
      </UserForm.Field>

      <UserForm.Field name="email" label="Email Address">
        <EmailInput placeholder="jane@example.com" />
      </UserForm.Field>

      <UserForm.Field name="age" label="Age">
        <NumberInput min={18} max={120} />
      </UserForm.Field>

      <UserForm.Field name="bio" label="Biography">
        <Textarea placeholder="Tell us about yourself" rows={3} />
      </UserForm.Field>

      <div className="form-actions">
        <UserForm.Reset>Undo Changes</UserForm.Reset>
        <UserForm.Submit>Save Profile</UserForm.Submit>
      </div>
    </UserForm>
  );
});
```

#### SolidJS
```tsx
import { mutable, setup } from '@airlib/solid';
import { EmailInput, NumberInput, Textarea, TextInput } from '@airlib/solid-form';
import { updateProfile } from './function.js';
import { UserForm } from './UserForm.js';

export const ProfileEditor = setup(() => {
  const profile = mutable({
    name: '',
    email: '',
    age: 18,
    bio: '',
  });

  const handleSave = async (data: typeof profile, changes: Partial<typeof profile>) => {
    await updateProfile(changes);
  };

  return (
    <UserForm value={profile} onSubmit={handleSave}>
      <UserForm.Field name="name" label="Full Name">
        <TextInput placeholder="Jane Doe" />
      </UserForm.Field>

      <UserForm.Field name="email" label="Email Address">
        <EmailInput placeholder="jane@example.com" />
      </UserForm.Field>

      <UserForm.Field name="age" label="Age">
        <NumberInput min={18} max={120} />
      </UserForm.Field>

      <UserForm.Field name="bio" label="Biography">
        <Textarea placeholder="Tell us about yourself" rows={3} />
      </UserForm.Field>

      <div class="form-actions">
        <UserForm.Reset>Undo Changes</UserForm.Reset>
        <UserForm.Submit>Save Profile</UserForm.Submit>
      </div>
    </UserForm>
  );
});
```

---

## Submission Lifecycle & Handlers

The `onSubmit` callback receives three arguments:

```typescript
onSubmit?: (
  data: OutputType,          // Complete validated form payload
  changes: Partial<OutputType>, // Object containing ONLY modified fields
  event: SubmitEvent         // Native DOM form submission event
) => Promise<void> | void;
```

### Lifecycle Progression

1. **Validation Check**: Schema validation runs on all fields. If any field fails, submission halts and errors display.
2. **Pending Transition**: `form.status` moves to `'pending'`, and `form.pending` becomes `true`.
3. **Automatic Input Locking**: All inputs, selects, and textareas within the form automatically receive `disabled={true}`, preventing user edits during network transmission.
4. **Concurrency Blocking**: Concurrent clicks or submissions are rejected while the active submission promise resolves.
5. **Success Resolution**: On completion, `form.status` transitions to `'success'`. The submitted payload becomes the new baseline, resetting `form.changed` to `false`.
6. **Error Capture**: If the promise rejects or throws, `form.status` transitions to `'error'`, and the caught error is stored on `form.error`.

---

## Submit & Reset Button Behavior

### `<Form.Submit>` Readiness Rules

`<Form.Submit>` automatically governs its disabled state. It disables itself when:
- The form is currently submitting (`form.pending === true`).
- Any field violates schema rules (`form.valid === false`).
- No fields have been modified from their initial values (`form.changed === false`).
- Submission is manually halted via `form.block()` (`form.blocked === true`).

### Accessing Submit State in Children

Pass a render function as `children` to access the underlying `FormState` for custom spinner animations:

#### React
```tsx
<UserForm.Submit className="btn-primary">
  {(form) => (
    <>
      <Show when={() => form?.pending}>
        <span className="spinner" />
      </Show>
      <span>{form?.pending ? 'Saving...' : 'Save Profile'}</span>
    </>
  )}
</UserForm.Submit>
```

#### SolidJS
```tsx
<UserForm.Submit class="btn-primary">
  {(form) => (
    <>
      <Show when={form?.pending}>
        <span class="spinner" />
      </Show>
      <span>{form?.pending ? 'Saving...' : 'Save Profile'}</span>
    </>
  )}
</UserForm.Submit>
```

### `<Form.Reset>` Modes

`<Form.Reset>` reverts all fields to baseline initial values, clears touched states, and resets status to `'idle'`. It disables itself when `form.changed === false`.

To completely empty all fields instead of reverting to initial baseline values, pass `clear={true}`:

```tsx
<UserForm.Reset clear={true}>Clear All Fields</UserForm.Reset>
```

---

## Nested Object Structures

Define nested schemas using standard Zod object composition. Form fields address nested properties using dot-notation string paths (`parent.child.property`):

#### React
```tsx
import { z } from 'zod';
import { createForm, TextInput } from '@airlib/react-form';
import { setup } from '@airlib/react';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    zipCode: z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP code'),
  }),
});

export const CompanyForm = createForm(companySchema);

export const CompanyProfile = setup(() => {
  return () => (
    <CompanyForm onSubmit={(data) => console.log('Saved company:', data)}>
      <CompanyForm.Field name="name" label="Company Name">
        <TextInput />
      </CompanyForm.Field>

      <fieldset className="address-section">
        <legend>Headquarters Address</legend>
        <CompanyForm.Field name="address.street" label="Street Address">
          <TextInput />
        </CompanyForm.Field>
        <CompanyForm.Field name="address.city" label="City">
          <TextInput />
        </CompanyForm.Field>
        <CompanyForm.Field name="address.zipCode" label="ZIP Code">
          <TextInput />
        </CompanyForm.Field>
      </fieldset>

      <CompanyForm.Submit>Save Company</CompanyForm.Submit>
    </CompanyForm>
  );
});
```

Compile-time type checking verifies the dot-notation paths against the schema. Typing `name="address.nonexistent"` results in a TypeScript compiler error.

---

## Dynamic Repeatable Collections (`<FieldList>`)

When forms require repeatable rows—such as adding multiple team members, contacts, or line items—use `<Form.FieldList>`:

#### React
```tsx
import { For, setup } from '@airlib/react';
import { createForm, EmailInput, TextInput } from '@airlib/react-form';
import { z } from 'zod';

const teamSchema = z.object({
  teamName: z.string().min(2, 'Team name is required'),
  members: z
    .array(
      z.object({
        name: z.string().min(1, 'Member name is required'),
        email: z.string().email('Invalid email address'),
      })
    )
    .min(1, 'Add at least one member'),
});

const TeamForm = createForm(teamSchema);

export const TeamManager = setup(() => {
  const initialData = {
    teamName: '',
    members: [{ name: '', email: '' }],
  };

  return () => (
    <TeamForm value={initialData} onSubmit={(data) => console.log('Saved team:', data)}>
      <TeamForm.Field name="teamName" label="Team Name">
        <TextInput />
      </TeamForm.Field>

      <TeamForm.FieldList name="members">
        {(members) => (
          <div className="members-list">
            <h3>Team Members</h3>

            <For each={() => members}>
              {(member, index) => (
                <div key={index} className="member-row">
                  <TeamForm.Field name={`members.${index}.name`} label="Full Name">
                    <TextInput />
                  </TeamForm.Field>

                  <TeamForm.Field name={`members.${index}.email`} label="Email">
                    <EmailInput />
                  </TeamForm.Field>

                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => members.splice(index, 1)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </For>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => members.push({ name: '', email: '' })}
            >
              Add Member
            </button>
          </div>
        )}
      </TeamForm.FieldList>

      <TeamForm.Submit>Save Team</TeamForm.Submit>
    </TeamForm>
  );
});
```

### Reactive Array Mutations & Reordering

The parameter passed to `<FieldList>` children is a reactive array (`push`, `splice`, `pop`, etc.). Mutations automatically trigger schema re-validation and dirty tracking.

Individual items also expose helper methods on `FormField`:

```typescript
const field = form.field('members.0');

field.moveUp();    // Swaps item with the preceding item (index - 1)
field.moveDown();  // Swaps item with the succeeding item (index + 1)
field.remove();    // Removes this item from the parent array
```
