import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type DialogProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Dialog - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer open handler when the dialog opens', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onopen = vi.fn();
        const props = mutable<DialogProps>({ open: false, onopen });
        const dialog = aria('dialog', props);
        const panel = dialog.panel();

        bind(document.createElement('div'), panel);

        expect(onopen).not.toHaveBeenCalled();

        props.open = true;

        expect(onopen).toHaveBeenCalledTimes(1);
        expect((onopen.mock.calls[0][0] as Event).type).toBe('open');

        panel.destroy();
        dialog.destroy();
      });
    }));

  it('calls the consumer close handler once per dismissal path', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onclose = vi.fn();
        const props = mutable<DialogProps>({ open: true, onclose });
        const dialog = aria('dialog', props);
        const panel = dialog.panel();
        const panelEl = bind(document.createElement('div'), panel);

        props.open = false;

        expect(onclose).toHaveBeenCalledTimes(1);
        expect((onclose.mock.calls[0][0] as Event).type).toBe('close');

        props.open = true;
        panelEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));

        expect(onclose).toHaveBeenCalledTimes(2);
        expect(panelEl.onclose).toBeNull();

        panel.destroy();
        dialog.destroy();
      });
    }));

  it('types the lifecycle payloads for consumers without a cast', () => {
    const props: DialogProps = {
      onopen: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<void>();
      },
      onclose: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<void>();
      },
    };

    void props;
  });
});
