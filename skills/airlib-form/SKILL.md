---
name: airlib-form
description: Use when building forms, connecting inputs to state, validating with Zod schemas, handling cross-field matching, managing dynamic arrays, tracking dirty/touched states, or configuring form submission lifecycles in an AirLib project
---

# AirLib Form Router

The form management guide for applications built with **@airlib/form**, **@airlib/react-form**, and **@airlib/solid-form** in AirLib.

IMPORTANT: Read only what you need. Match your problem or goal to the matrix below, then read only the corresponding topic document in `contents/`. Do not load all files into context.

---

## Form Decision Matrix: What are you building?

| What question are you trying to answer? | Topic Guide to Read |
|---|---|
| **"How do I define a schema-driven form, bind nested objects, manage dynamic arrays (<FieldList>), or handle submission?"** | [contents/typed-forms.md](./contents/typed-forms.md) |
| **"How do I use standard inputs (text, numbers, dates, dropdowns, checkboxes, radios) with zero glue code?"** | [contents/inputs.md](./contents/inputs.md) |
| **"How do I validate fields, display errors, match passwords/dates, or track touched and changed states?"** | [contents/validation-matching.md](./contents/validation-matching.md) |
| **"How do I customize field layouts, use named slots, build custom input controls, or ensure accessibility?"** | [contents/composition-custom-inputs.md](./contents/composition-custom-inputs.md) |
| **"How do I apply global styling, default classes, or design-system tokens across all forms in my app?"** | [contents/configuration.md](./contents/configuration.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or component in existing code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `createForm`, `<Form.Field>`, `<Form.FieldList>`, `<Form.Submit>`, `<Form.Reset>`, `name="address.city"`, `field.moveUp()`, `field.remove()`, `form.status`, `form.pending`, `form.error`, `form.canSubmit` | [contents/typed-forms.md](./contents/typed-forms.md) |
| `TextInput`, `EmailInput`, `PasswordInput`, `NumberInput`, `Textarea`, `Checkbox`, `Radio`, `Select`, `DatePicker`, `TimePicker`, `DateTimePicker`, `ColorPicker`, `FilePicker`, `Slider` | [contents/inputs.md](./contents/inputs.md) |
| `field.error`, `field.touched`, `field.changed`, `match`, `mismatchLabel`, `field.matched`, `form.block()`, `form.unblock()` | [contents/validation-matching.md](./contents/validation-matching.md) |
| `<UserForm.Field.Snippet>`, `for="prefix"`, `for="suffix"`, `for="support"`, `children={(field) => ...}`, `for={props}`, `aria-invalid` | [contents/composition-custom-inputs.md](./contents/composition-custom-inputs.md) |
| `configureForm()`, `FIELD_OPTIONS`, `SUBMIT_OPTIONS`, `errorClass`, `pendingClass`, `dirtyClass` | [contents/configuration.md](./contents/configuration.md) |

---

## Questions & Tasks Covered by Each Topic

### 1. [Typed Forms](./contents/typed-forms.md)
Load this topic when you need to answer:
- How do I create a type-safe form component from a Zod schema?
- How do I bind initial form data using an AirLib `mutable` store?
- How do I handle form submission and access both the full validated payload and the modified diff fields?
- What are the form submission lifecycle states (`idle`, `pending`, `success`, `error`)?
- How do I bind form fields to deeply nested object structures using dot-notation paths (`address.city`)?
- How do I build dynamic repeatable item lists (`<Form.FieldList>`) and reorder/remove items?

### 2. [Form Inputs](./contents/inputs.md)
Load this topic when you need to answer:
- Which 14 HTML input types are provided out-of-the-box by AirLib Form?
- How do inputs automatically discover their field names and bind values inside a `<Field>` wrapper?
- How do I use inputs directly inside a `<Form>` without `<Field>`, or standalone outside any form?
- How do number inputs buffer typing so decimals and minus signs don't jump the cursor?
- How do date and time inputs format and sync values?
- How do radio buttons automatically form mutual exclusion groups without manual name attributes?
- How do I pass custom HTML attributes, styling classes, and event listeners to inputs?

### 3. [Validation & Cross-Field Matching](./contents/validation-matching.md)
Load this topic when you need to answer:
- When does schema validation run and how are error messages collected into arrays?
- What is the difference between `touched` (interacted with) and `changed` (differs from baseline)?
- How do I show error messages only after a field has been touched by the user?
- How do I validate that two fields match (e.g. password confirmation)?
- How do I write custom cross-field validation rules (e.g. end date must be after start date)?
- Why are `valid` and `matched` independent signals and which error displays first?
- How do I temporarily block form submission during asynchronous background verification (e.g. checking username availability)?

### 4. [Composition & Custom Inputs](./contents/composition-custom-inputs.md)
Load this topic when you need to answer:
- How do I use named slots (`<UserForm.Field.Snippet>`) to inject leading icons, badges, or custom support text into fields?
- How do I render fields headlessly using a function as child (`children={(field) => ...}`) and why does custom override slotted?
- How do I build headless custom inputs using the `(props, input)` callback pattern?
- How do I create reusable design-system input components using `for={props}`?
- How do I construct custom input components with string/value conversion using `createInput()`?
- How does AirLib Form automatically handle accessibility (`id`, `htmlFor`, `aria-invalid`, `aria-describedby`, and input locking)?

### 5. [Global Configuration](./contents/configuration.md)
Load this topic when you need to answer:
- How do I configure global default CSS classes and styles for all forms across my application?
- How do I set default error classes and pending animation classes globally?
- How do I customize styles for specific input types (e.g. checkboxes, textareas, file pickers) on top of base input defaults?
- How do local props on individual fields or inputs override global configuration defaults?
