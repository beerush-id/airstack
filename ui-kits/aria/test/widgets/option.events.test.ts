import { describe, expectTypeOf, it } from 'vitest';
import type { OptionProps } from '../../src/index.js';

describe('Option - Consumer Event Contract', () => {
  it('types the selected state for consumers without a cast', () => {
    const props: OptionProps = {
      value: 'option',
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
