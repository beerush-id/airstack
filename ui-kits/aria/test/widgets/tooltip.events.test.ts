import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type TooltipEvent, type TooltipProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Tooltip - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer change handler when the tooltip opens', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onchange = vi.fn();
        const tooltip = aria('tooltip', mutable<TooltipProps>({ open: false, onchange }));
        bind(document.createElement('div'), tooltip);

        tooltip.open = true;

        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(true);
        expect(tooltip.current!.onchange).toBeNull();

        tooltip.destroy();
      });
    }));

  it('names and types the visibility payload for consumers', () => {
    expectTypeOf<TooltipEvent>().not.toBeAny();
    expectTypeOf<TooltipEvent>().toEqualTypeOf<CustomEvent<boolean>>();

    const props: TooltipProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
