import { describe, expectTypeOf, it } from 'vitest';
import type { ToggleProps } from '../../src/index.js';

describe('Toggle - Consumer Event Contract', () => {
  it('types the pressed state for consumers without a cast', () => {
    const props: ToggleProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
