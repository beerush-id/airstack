import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type SearchInputProps, type TextInputProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('TextInput - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer change handler on a blur commit', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onchange = vi.fn();
        const input = aria('text-input', { value: 'same', onchange }, { native: false });
        const el = bind(document.createElement('input'), input);

        input.assign({ value: 'b' });
        el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<string>).detail).toBe('b');
        expect(el.onchange).toBeNull();

        input.destroy();
      });
    }));

  it('types the committed text for both faces without a cast', () => {
    const text: TextInputProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string>();
      },
    };

    const search: SearchInputProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string>();
      },
    };

    void text;
    void search;
  });
});
