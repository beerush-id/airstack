import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type PopoverEvent, type PopoverProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Popover - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer toggle handler when the popover opens', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const ontoggle = vi.fn();
        const popover = aria('popover', mutable<PopoverProps>({ open: false, ontoggle }));
        bind(document.createElement('div'), popover);

        popover.open = true;

        expect(ontoggle).toHaveBeenCalledTimes(1);
        expect((ontoggle.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(true);

        popover.destroy();
      });
    }));

  it('names and types the visibility payload for consumers', () => {
    const props: PopoverProps = {
      ontoggle: (event) => {
        expectTypeOf(event).toEqualTypeOf<PopoverEvent>();
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
