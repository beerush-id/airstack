import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type SwitchProps } from '../../src/index.js';
import { component } from '../utils.js';

describe('Switch - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer input and change handlers once per activation', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const onchange = vi.fn();
        const props = mutable<SwitchProps>({ checked: false, oninput, onchange });
        const swatch = aria('switch', props, { native: false });
        const host = document.createElement('div');

        Object.assign(host, swatch.props);
        swatch.ref(host);

        host.click();

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(true);
        expect(onchange).toHaveBeenCalledTimes(1);
        expect(host.oninput).toBeNull();

        swatch.destroy();
      });
    }));

  it('types the toggled state for consumers without a cast', () => {
    const props: SwitchProps = {
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
