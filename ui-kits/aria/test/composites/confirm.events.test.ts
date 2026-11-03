import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type ConfirmProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Confirm - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('inherits the dialog open and close handlers', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onopen = vi.fn();
        const onclose = vi.fn();
        const props = mutable<ConfirmProps>({ open: false, onopen, onclose });
        const confirm = aria('confirm', props);
        const panel = confirm.panel();

        bind(document.createElement('div'), panel);

        props.open = true;
        expect(onopen).toHaveBeenCalledTimes(1);

        props.open = false;
        expect(onclose).toHaveBeenCalledTimes(1);

        panel.destroy();
        confirm.destroy();
      });
    }));

  it('exposes single-case handler props with typed payloads', () => {
    const props: ConfirmProps = {
      onconfirm: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<void>();
      },
      oncancel: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<void>();
      },
      onclose: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<void>();
      },
    };

    void props;
  });
});
