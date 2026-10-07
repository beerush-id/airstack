import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type SplitterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Splitter - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer input and change handlers per keyboard commit', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const onchange = vi.fn();
        const props = mutable<SplitterProps>({ value: 30, min: 0, max: 100, oninput, onchange });
        const splitter = aria('splitter', props);
        const el = bind(document.createElement('div'), splitter);
        el.focus();

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as CustomEvent<number>).detail).toBe(31);
        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<number>).detail).toBe(31);
        expect(el.oninput).toBeNull();

        splitter.destroy();
      });
    }));

  it('types the committed partition for consumers without a cast', () => {
    const props: SplitterProps = {
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number>();
      },
    };

    void props;
  });
});
