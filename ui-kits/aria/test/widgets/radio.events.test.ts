import { describe, expectTypeOf, it } from 'vitest';
import type { RadioProps } from '../../src/index.js';

describe('Radio - Consumer Event Contract', () => {
  it('types the selected state for consumers without a cast', () => {
    const props: RadioProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
