# DateRangePicker Specification

The date-interval entry unit. Coordinates two date endpoints and a shared popup calendar while keeping an incomplete
selection separate from the committed range.

- **Entity**: `date-range-picker`
- **WAI-ARIA Roles**: `combobox` (inputs), `dialog` (calendar), `grid` (month table)

### Composite Parts (Entity Tree)

- **`DateRangePicker`**: Container coordinator (hosts `value`, `draft`, `open`, `month`, `min`, `max`, `disabled`,
  `required`).
- **`DateRangePickerInput`**: Endpoint text input (`endpoint: 'start' | 'end'`).
- **`DateRangePickerTrigger`**: Button opening calendar popup.
- **`DateRangePickerCalendar`**: Shared popup calendar dialog.
- **`DateRangePickerDay`**: Day cell in month grid (`date: string`).

---

## The Three Semantic Layers

| Part / Role                   | HTML Semantic                                | WAI-ARIA Semantic                                           | Aria Package Semantic Contract                         |
|:------------------------------|:---------------------------------------------|:------------------------------------------------------------|:-------------------------------------------------------|
| **`DateRangePicker`**         | Logical container (`<div>`).                 | None (role omitted).                                        | Hosts interval state and coordinates draft resolution. |
| **`DateRangePickerInput`**    | Native `<input type="text">` or custom host. | `role="textbox"` on custom host, `aria-label`.              | Edits start or end draft endpoint.                     |
| **`DateRangePickerTrigger`**  | Native `<button type="button">`.             | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. | Toggles popup calendar.                                |
| **`DateRangePickerCalendar`** | Dialog popup (`<div>`).                      | `role="dialog"`, `aria-label="Choose date range"`.          | Houses month grid. Hidden when closed.                 |
| **`DateRangePickerDay`**      | Table cell or button.                        | `role="gridcell"`, `aria-selected`, `aria-disabled`.        | Roving tabindex grid member.                           |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DateRangePickerProps`

```ts
export interface DateRangePickerProps {
  /** Committed range as [start, end] formatted as YYYY-MM-DD */
  value?: [string, string] | null;
  /** Draft text entries */
  draft?: [string, string];
  /** Calendar visibility flag */
  open?: boolean;
  month?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
}
```

#### `DateRangePickerInputProps`

```ts
export interface DateRangePickerInputProps {
  endpoint: 'start' | 'end';
  label?: string;
}
```

#### `DateRangePickerDayProps`

```ts
export interface DateRangePickerDayProps {
  date: string;
}
```

### 2. Overload Contracts

```ts
// DateRangePicker: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'date-range-picker',
  props?: DateRangePickerProps
): DateRangePickerAria<E>;

// DateRangePickerInput: Endpoint input
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'date-range-picker-input',
  props: DateRangePickerInputProps
): DateRangePickerInputAria<E>;

// DateRangePickerTrigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'date-range-picker-trigger',
  props?: AriaProps
): DateRangePickerTriggerAria<E>;

// DateRangePickerCalendar
export function aria<E extends BaseElement = HTMLElement>(
  role: 'date-range-picker-calendar',
  props?: AriaProps
): DateRangePickerCalendarAria<E>;

// DateRangePickerDay
export function aria<E extends BaseElement = HTMLElement>(
  role: 'date-range-picker-day',
  props: DateRangePickerDayProps
): DateRangePickerDayAria<E>;
```

---

## State & Lifecycle Rules

1. **Keyboard** (`docs/date-range-picker.md:35`): the shared calendar inherits the **DatePicker day-grid movement
   contract** (`Left`/`Right` ±1 day, `Up`/`Down` ±1 week, `Home`/`End` week bounds, `PageUp`/`PageDown` months, `Enter`
   activates, `Escape` dismisses). Days are roving-tabindex grid members (`:68`). Month navigation changes `month`
   without committing a range.

2. **Two-step selection** (`:36-38`):
  - No valid pending start, or end entry nonempty → day activation starts a new draft `[day, ""]` and keeps the calendar
    open.
  - Valid pending start + empty end → the earlier date becomes `start`, later becomes `end`, commits `draft` + `value`,
    closes the calendar. Activation accepts pointer `click`, `Enter`, `Space` when not canceled; out-of-bounds dates
    cannot be activated.

3. **Draft lifecycle** (`:31-33,40-42`): `value` holds only complete, ordered, in-bounds ranges
   (`min <= start <= end <= max`); a single-day range is valid. `Escape`, trigger dismissal, or focus leaving without a
   valid completed edit **discards the uncommitted draft**, restoring `value` (or `["", "]`→`["", ""]` when empty).
   Committed `value` is always retained.

4. **Calendar modality** (`:63`): the calendar is a `role="dialog"` with `aria-label="Choose date range"`, hidden when
   closed — the source sets **no `aria-modal`**, so it is a **non-trapping** dialog (per `spec.md`, focus containment is
   conditioned on `aria-modal="true"`). The matrix's "Trap" invariant is misnamed for this unit.

5. **Endpoint labels** (`:23`): each input's `aria-label` defaults to `"Start date"` / `"End date"` by `endpoint`;
   custom hosts get `role="textbox"`, native `<input type="text">` gets none.

6. **Events** (`:46-47`): `input` on container after `draft` changes
   (`CustomEvent<[string,string]>{bubbles,detail:draft}`); `change` on container after a different complete range or
   `null` commits (`detail:value`). Month navigation and cancellation emit no `change`.
