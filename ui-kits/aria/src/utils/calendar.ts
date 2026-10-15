const MS_PER_DAY = 86_400_000;
const FULL_TEXT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
const MONTH_LONG: Intl.DateTimeFormatOptions = { month: 'long', timeZone: 'UTC' };
const WEEKDAY_SHORT: Intl.DateTimeFormatOptions = { weekday: 'short', timeZone: 'UTC' };
const WEEKDAY_LONG: Intl.DateTimeFormatOptions = { weekday: 'long', timeZone: 'UTC' };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export interface ParsedDate {
  raw?: string;
  iso?: string;
  day?: string;
  text?: string;
  time?: number;
  date?: number;
  year?: number;
  month?: number;
  monthStr?: string;
}

/**
 * Describe one date for display: localized labels plus the ISO value those labels were built from.
 *
 * @param locales - Locale stack used to format every label.
 * @param value - Date to parse, in any form the `Date` constructor accepts.
 * @returns The display labels and the `YYYY-MM-DD` value read in the runtime's local timezone, or an empty
 *          object when the value is absent or unparseable.
 */
export function parseDate(locales: string[], value: string | Date) {
  if (!value) return {};
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return {};

  return {
    raw: date.toISOString(),
    iso: formatISO(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    day: date.toLocaleDateString(locales, { weekday: 'long' }),
    text: date.toLocaleDateString(locales, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.getTime(),
    date: date.getDate(),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    monthStr: date.toLocaleDateString(locales, { month: 'long' }),
  } as ParsedDate;
}

export interface DateGridOptions {
  /** Year to lay out, as `YYYY`. */
  year: number;
  /** Month to lay out, as `YYYY-MM`. */
  month: number;
  /** Locale stack used to format every label. */
  locales: string[];
  /** Weekday index rendered as the first column, 0 = Sunday through 6 = Saturday. */
  weekStart?: number;
  /** Drop rows holding no day of the target month. Keep the full six rows when false. */
  trimWeeks?: boolean;
}

export interface DateGrid {
  year: number;
  month: number;
  weeks: string[];
  dates: ParsedDate[];
}

/**
 * Build the display grid of one month: localized weekday column labels and the parsed cells laid out row by row.
 *
 * @param options - Grid settings: locales, target month, first weekday, and whether to trim empty rows.
 * @returns The seven column labels and every cell of the grid, each keyed by its ISO date, laid out left to right, row by row.
 */
export function dateGrids({ locales, year, month, weekStart = 0, trimWeeks = false }: DateGridOptions): DateGrid {
  const weekdayLong = getFormatter(locales, WEEKDAY_LONG);
  const weekdayShort = getFormatter(locales, WEEKDAY_SHORT);

  const weeks: string[] = [];
  const dayNames: string[] = [];

  if (!year || !month) return { weeks, year, month, dates: [] };

  const firstTime = Date.UTC(year, month - 1, 1);
  const gridStart = firstTime - ((new Date(firstTime).getUTCDay() - (((weekStart % 7) + 7) % 7) + 7) % 7) * MS_PER_DAY;
  const cells = trimWeeks ? Math.ceil(((firstTime - gridStart) / MS_PER_DAY + daysInMonth(year, month)) / 7) * 7 : 42;

  const cursor = new Date(gridStart);
  for (let column = 0; column < 7; column++) {
    cursor.setTime(gridStart + column * MS_PER_DAY);
    weeks.push(weekdayShort.format(cursor));
    dayNames.push(weekdayLong.format(cursor));
  }

  const monthFmt = getFormatter(locales, MONTH_LONG);
  const textFmt = getFormatter(locales, FULL_TEXT);
  const dates: ParsedDate[] = [];

  let monthId = '';
  let monthLabel = '';

  for (let index = 0; index < cells; index++) {
    cursor.setTime(gridStart + index * MS_PER_DAY);

    const cellYear = cursor.getUTCFullYear();
    const cellMonth = cursor.getUTCMonth() + 1;
    const cellDay = cursor.getUTCDate();
    const monthKey = `${cellYear}-${cellMonth}`;

    if (monthKey !== monthId) {
      monthId = monthKey;
      monthLabel = monthFmt.format(cursor);
    }

    dates.push({
      raw: cursor.toISOString(),
      iso: formatISO(cellYear, cellMonth, cellDay),
      day: dayNames[index % 7],
      text: textFmt.format(cursor),
      time: cursor.getTime(),
      date: cursor.getDate(),
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      monthStr: monthLabel,
    });
  }

  return { year, month, weeks, dates };
}

/**
 * Resolve an `Intl` formatter for a locale stack and option shape, reusing the instance across calls.
 * Constructing a formatter costs far more than formatting with it, so every cell must share one.
 *
 * @param locales - Locale stack to format with.
 * @param options - Fixed option shape, which must pin `timeZone: 'UTC'` so calendar days stay exact.
 * @returns A cached formatter for that locale stack and option shape.
 */
function getFormatter(locales: string[], options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locales.join(',')}${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat(locales, options);
  formatterCache.set(key, created);
  return created;
}

export function formatISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
