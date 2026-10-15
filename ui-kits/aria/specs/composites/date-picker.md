# DatePicker Specification

The calendar date unit. Coordinates ISO date text editing, popup calendar toggling, month navigation, and day-grid traversal with focus restoration.

- **Entity**: `date-picker`
- **Input WAI-ARIA Role**: `combobox`
- **Calendar WAI-ARIA Role**: `dialog`
- **Day Grid WAI-ARIA Role**: `grid`

### Composite Parts (Entity Tree)
- **`DatePicker`**: Root container coordinator (hosts `value`, `month`, `open`, `min`, `max`, `disabled`, `required`).
- **`DatePickerInput`**: Text input for direct ISO date entry. Always shows the committed `value`; typed text stays put until a day commits.
- **`DatePickerTrigger`**: Button opening the calendar popup (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`).
- **`DatePickerCalendar`**: Calendar dialog popup (`role="dialog"`, `aria-label="Calendar"`).
- **`DatePickerPrevMonth` / `DatePickerNextMonth`**: Month navigation buttons.
- **`DatePickerDay`**: Day grid cells (`role="gridcell"`, `aria-selected`, `aria-disabled`).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`DatePicker`** | Logical container (`<div>`). | None (role omitted). | Hosts state: `value`, `open`, bounds. Publishes `datePickerCtx`. |
| **`DatePickerInput`** | Native `<input type="date">` or text `<input>`. | `role="combobox"` on custom/text host, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. | Direct text entry and synchronization. |
| **`DatePickerTrigger`** | Native `<button type="button">`. | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. | Toggles calendar popup. |
| **`DatePickerCalendar`** | Dialog popup (`<div>`); inner month grid. | `role="dialog"`, `aria-label="Calendar"`; the month grid `role="grid"`, day rows `role="row"`. | Hosts month grid; on open focus moves into the grid to the current/selected day (`docs/date-picker.md:21`). |
| **`DatePickerDay`** | Table cell or button (`<td>` / `<button>`). | `role="gridcell"`, `aria-selected` (active date), `aria-disabled="true"` outside `min`/`max`; **roving `tabindex="0"` on the focused day, `-1` on others** (shared grid contract, `docs/date-range-picker.md:68`). | Day cell in month grid. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DatePickerProps`
```ts
export interface DatePickerProps {
  /** Committed date formatted as YYYY-MM-DD */
  value?: string;
  /** Shown month formatted as YYYY-MM; seeds from `value`, otherwise today */
  month?: string;
  /** Calendar visibility flag */
  open?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
}
```

#### `DatePickerDayProps`
```ts
export interface DatePickerDayProps {
  /** Represented date formatted as YYYY-MM-DD */
  date: string;
}
```

### 2. Overload Contracts

```ts
// DatePicker: Root container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'date-picker',
  props?: DatePickerProps
): DatePickerAria<E>;

// DatePickerInput
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'date-picker-input',
  props?: AriaProps
): DatePickerInputAria<E>;

// DatePickerTrigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'date-picker-trigger',
  props?: AriaProps
): DatePickerTriggerAria<E>;

// DatePickerCalendar
export function aria<E extends BaseElement = HTMLElement>(
  role: 'date-picker-calendar',
  props?: AriaProps
): DatePickerCalendarAria<E>;

// DatePickerDay
export function aria<E extends BaseElement = HTMLElement>(
  role: 'date-picker-day',
  props: DatePickerDayProps
): DatePickerDayAria<E>;

// DatePickerPrevMonth / DatePickerNextMonth (Button contract; navigate the displayed month without committing value — docs/date-picker.md:30)
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'date-picker-prev-month' | 'date-picker-next-month',
  props?: AriaProps
): DatePickerMonthNavAria<E>;
```


---

## State & Lifecycle Rules

1. **Grid Navigation**:
   - `Left` / `Right`: +/- 1 day.
   - `Up` / `Down`: +/- 1 week.
   - `Home` / `End`: Start / end of week.
   - `PageUp` / `PageDown`: Prev / next month.
   - `Enter`: Commits focused day to `value` and closes calendar.
   - `Escape`: Closes calendar without committing.
   - Focus restores to opening trigger or input on close.

2. **Events**:
   - `input`: Dispatched on text edit with `detail: text`.
   - `change`: Dispatched on container after date commits with `detail: value`.

3. **Field synchronization**: the input shows the committed `value` on bind and after every commit. Typing announces `input` without committing and never gets clobbered — typed text survives opening, travel, and dismissal, and is replaced only by the next commit (or a `value` set from code).

4. **Shown month**: `month` seeds from the committed `value`, otherwise today; an invalid `value` falls back to today. `DatePickerPrevMonth` / `DatePickerNextMonth` click steps `month` back/forward without committing; an invalid or cleared `month` holds still. `PageUp` / `PageDown` in the grid steps `month` and moves focus into the stepped month.
