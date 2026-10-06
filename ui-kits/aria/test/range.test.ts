import { describe, expect, it } from 'vitest';
import { axisRatio } from '../src/utils/range.js';

describe('axisRatio', () => {
  it('resolves horizontal offsets from the left edge', () => {
    expect(
      axisRatio({ left: 10, bottom: 50, width: 200, height: 20 }, 'horizontal', 60, 40)
    ).toBe(0.25);
  });

  it('resolves vertical offsets from the bottom edge', () => {
    expect(
      axisRatio({ left: 10, bottom: 200, width: 20, height: 200 }, 'vertical', 15, 50)
    ).toBe(0.75);
  });

  it('withholds ratios on zero-size spans', () => {
    expect(axisRatio({ left: 0, bottom: 0, width: 0, height: 20 }, 'horizontal', 10, 10)).toBeNull();
    expect(axisRatio({ left: 0, bottom: 0, width: 20, height: 0 }, 'vertical', 10, 10)).toBeNull();
  });
});
