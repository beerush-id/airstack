# DateRangePicker Specification

The date-interval entry unit. Coordinates two date endpoints and a shared popup calendar while keeping an incomplete selection separate from the committed range.

- **Entity**: `date-range-picker`
- **WAI-ARIA Roles**: `combobox` (inputs), `dialog` (calendar), `grid` (month table)

### Composite Parts (Entity Tree)
- **`DateRangePicker`**: Container coordinator (hosts `value`, `draft`, `open`, `month`, `min`, `max`, `disabled`, `required`).
- **`DateRangePickerInput`**: Endpoint text input (`endpoint: 'start' | 'end'`).
- **`DateRangePickerTrigger`**: Button opening calendar popup.
- **`DateRangePickerCalendar`**: Shared popup calendar dialog.
- **`DateRangePickerDay`**: Day cell in month grid (`date: string`).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`DateRangePicker`** | Logical container (`<div>`). | None (role omitted). | Hosts interval state and coordinates draft resolution. |
| **`DateRangePickerInput`** | Native `<input type="text">` or custom host. | `role="textbox"` on custom host, `aria-label`. | Edits start or end draft endpoint. |
| **`DateRangePickerTrigger`** | Native `<button type="button">`. | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. | Toggles popup calendar. |
| **`DateRangePickerCalendar`** | Dialog popup (`<div>`). | `role="dialog"`, `aria-label="Choose date range"`. | Houses month grid. Hidden when closed. |
| **`DateRangePickerDay`** | Table cell or button. | `role="gridcell"`, `aria-selected`, `aria-disabled`. | Roving tabindex grid member. |

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

1. **Two-Step Calendar Selection**:
   - First click: Sets start date draft `[day, ""]`, keeps calendar open.
   - Second click: Sets end date, normalizes earlier -> `start`, later -> `end`, commits `draft` and `value`, then closes calendar.

2. **Events**:
   - `input` — Dispatched on draft changes with `detail: draft`.
   - `change` — Dispatched after committed range changes with `detail: value`.
