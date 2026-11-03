import { describe, expectTypeOf, it } from 'vitest';
import type { OptionAria } from '../../src/index.js';

describe('Option state surface', () => {
  it('exposes the selected state to consumers', () => {
    const option = null as unknown as OptionAria;

    expectTypeOf(option.selected).toEqualTypeOf<boolean>();
  });
});
