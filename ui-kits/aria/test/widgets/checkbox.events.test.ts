import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type CheckboxProps } from '../../src/index.js';
import { component } from '../utils.js';

describe('Checkbox - Consumer Event Contract', () => {
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
        const props = mutable<CheckboxProps>({ checked: false, oninput, onchange });
        const checkbox = aria<HTMLButtonElement>('checkbox', props, { native: false });
        const host = document.createElement('button');

        Object.assign(host, checkbox.props);
        checkbox.ref(host);

        host.click();

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(true);
        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(true);
        expect(host.onchange).toBeNull();

        checkbox.destroy();
      });
    }));

  it('types the committed state for consumers without a cast', () => {
    const props: CheckboxProps = {
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
