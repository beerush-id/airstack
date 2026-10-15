import { describe, expect, it } from 'vitest';
import { dateGrids, parseDate } from '../src/utils/calendar.js';

describe('Calendar Utils - Coverage', () => {
  it('returns an empty object for an empty parse value', () => {
    expect(parseDate(['en-US'], '')).toEqual({});
  });

  it('keeps six fixed weeks when trimWeeks is omitted', () => {
    const grid = dateGrids({ locales: ['en-US'], year: 2026, month: 2 });

    expect(grid.weeks).toHaveLength(7);
    expect(grid.dates).toHaveLength(42);
  });

  it('returns an empty grid without a year', () => {
    expect(dateGrids({ locales: ['en-US'], year: 0, month: 2 })).toEqual({
      weeks: [],
      year: 0,
      month: 2,
      dates: [],
    });
  });

  it('returns an empty grid without a month', () => {
    expect(dateGrids({ locales: ['en-US'], year: 2026, month: 0 })).toEqual({
      weeks: [],
      year: 2026,
      month: 0,
      dates: [],
    });
  });
});
