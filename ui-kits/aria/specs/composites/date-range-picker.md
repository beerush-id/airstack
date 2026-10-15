# DateRangePicker Specification

The date-interval entry unit. Coordinates two date endpoints and a shared popup calendar while keeping an incomplete
selection separate from the committed range.

- **Entity**: `date-range-picker`
- **WAI-ARIA Roles**: `combobox` (inputs), `dialog` (calendar), `grid` (month table)

### Composite Parts (Entity Tree)

- **`DateRangePicker`**: Container coordinator (hosts `value`, `draft`, `open`, `month`, `min`, `max`, `disabled`,
  `required`).
- **`DateRangePickerInput`**: Endpoint text input (`endpoint: 'start' | 'end'`). Always shows the draft endpoint while drafting, otherwise the saved endpoint.
- **`DateRangePickerTrigger`**: Button opening calendar popup.
- **`DateRangePickerCalendar`**: Shared popup calendar dialog.
- **`DateRangePickerDay`**: Day cell in month grid (`date: string`).

---

## The Three Semantic Layers

| Part / Role                   | HTML Semantic                                | WAI-ARIA Semantic                                           | Aria Package Semantic Contract                         |
|:------------------------------|:---------------------------------------------|:------------------------------------------------------------|:-------------------------------------------------------|
| **`DateRangePicker`**         | Logical container (`<div>`).                 | None (role omitted).                                        | Hosts interval state and coordinates draft resolution. |
| **`DateRangePickerInput`**    | Native `<input type="text">` or custom host. | `role="textbox"` on custom host, `aria-label`.              | Edits start or end draft endpoint; displays the draft endpoint while drafting, else the saved endpoint. |
| **`DateRangePickerTrigger`**  | Native `<button type="button">`.             | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. | Toggles popup calendar.                                |
| **`DateRangePickerCalendar`** | Dialog popup (`<div>`).                      | `role="dialog"`, `aria-label="Choose date range"`.          | Houses month grid. Hidden when closed.                 |
| **`DateRangePickerDay`**      | Table cell or button.                        | `role="gridcell"`, `aria-selected`, `aria-disabled`.        | Roving tabindex grid member.                           |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DateRangePickerProps`

```ts
export interface DateRangePickerProps {
  /** Range as [start, end] formatted as YYYY-MM-DD; partial drafting is [start, undefined], empty is undefined */
  value?: [string | undefined, string | undefined] | undefined;
  /** Draft endpoints; always a fresh [start, end] tuple while drafting, [undefined, undefined] when idle */
  draft?: [string | undefined, string | undefined];
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
  - No valid pending start, or end entry nonempty → day activation starts a new fresh draft `[day, undefined]` and
    assigns `value` to `[day, undefined]` too, keeping the calendar open.
  - Valid pending start + empty end → the earlier date becomes `start`, later becomes `end`, commits `value`
    `[start, end]`, resets `draft` to `[undefined, undefined]`, closes the calendar. Activation accepts pointer `click`,
    `Enter`, `Space` when not canceled; out-of-bounds dates cannot be activated (click/Enter/Space muted) but remain
    rovable (`tabindex="-1"`, focusable).

3. **Draft lifecycle** (`:31-33,40-42`): `value` is `[start, undefined]` while drafting, `[start, end]` when finished
   (ordered, in-bounds, `min <= start <= end <= max`; a single-day range is valid as a value but re-activating the
   same day keeps drafting), `undefined` when empty. Drafting always assigns a fresh tuple to
   both `draft` and `value`. `Escape`, trigger dismissal, or focus leaving closes the calendar without emitting
   `change`, retaining the current partial `value`/`draft` — closing never clears a draft. Endpoint text input assigns the `value` slot directly on `blur`; typing an invalid date and blurring
   reverts the input to the current selected date or empty, leaving `value`/`draft` unchanged.

4. **Calendar modality** (`:63`): the calendar is a `role="dialog"` with `aria-label="Choose date range"`, hidden when
   closed — the source sets **no `aria-modal`**, so it is a **non-trapping** dialog (per `spec.md`, focus containment is
   conditioned on `aria-modal="true"`). The matrix's "Trap" invariant is misnamed for this unit.

5. **Endpoint labels** (`:23`): each input's `aria-label` defaults to `"Start date"` / `"End date"` by `endpoint`;
   custom hosts get `role="textbox"`, native `<input type="text">` gets none.

6. **Shown month**: `month` seeds from the draft start, otherwise the saved start, otherwise today; an invalid seed falls back to today. Month navigation changes `month` without committing a range; an invalid or cleared `month` holds still.

7. **Events** (`:46-47`): `input` on container carrying the single entered date text
   (`CustomEvent<string>{bubbles,detail:date}`); `change` on container after a different complete range or
   `null` commits (`detail:value`). Month navigation and cancellation emit no `change`.
