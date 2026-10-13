const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseISO(date: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_RE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function isValidISO(date: string): boolean {
  return parseISO(date) !== null;
}

export function compareISO(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isOutOfBounds(date: string, min?: string, max?: string): boolean {
  if (min && isValidISO(min) && compareISO(date, min) < 0) return true;
  if (max && isValidISO(max) && compareISO(date, max) > 0) return true;
  return false;
}

export function addDaysISO(date: string, delta: number): string | null {
  const parts = parseISO(date);
  if (!parts) return null;
  const time = Date.UTC(parts.year, parts.month - 1, parts.day + delta);
  const next = new Date(time);
  return formatISO(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsISO(date: string, delta: number): string | null {
  const parts = parseISO(date);
  if (!parts) return null;
  const total = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  const day = Math.min(parts.day, daysInMonth(year, month));
  return formatISO(year, month, day);
}

export function monthIdFromISO(date: string): string | null {
  const parts = parseISO(date);
  if (!parts) return null;
  return `${parts.year}-${pad2(parts.month)}`;
}

export function parseMonthId(month: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  return { year, month: mon };
}

export function addMonthsId(month: string, delta: number): string | null {
  const parts = parseMonthId(month);
  if (!parts) return null;
  const total = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(total / 12);
  const mon = (((total % 12) + 12) % 12) + 1;
  return `${year}-${pad2(mon)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function weekdayISO(date: string): number | null {
  const parts = parseISO(date);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function startOfWeekISO(date: string, weekStart = 0): string | null {
  const weekday = weekdayISO(date);
  if (weekday === null) return null;
  return addDaysISO(date, -((weekday - weekStart + 7) % 7));
}

export function endOfWeekISO(date: string, weekStart = 0): string | null {
  const start = startOfWeekISO(date, weekStart);
  if (!start) return null;
  return addDaysISO(start, 6);
}

export function buildMonthCells(month: string, weekStart = 0): string[] {
  const parts = parseMonthId(month);
  if (!parts) return [];
  const first = formatISO(parts.year, parts.month, 1);
  const start = startOfWeekISO(first, weekStart);
  if (!start) return [];
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const cell = addDaysISO(start, i);
    if (cell) cells.push(cell);
  }
  return cells;
}

export function buildMonthWeeks(month: string, weekStart = 0): string[][] {
  const cells = buildMonthCells(month, weekStart);
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
