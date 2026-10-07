import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type FilePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('FilePicker - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer change and cancel handlers from the picker', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onchange = vi.fn();
        const oncancel = vi.fn();
        const picker = aria('file-picker', mutable<FilePickerProps>({ onchange, oncancel }));
        const el = bind(document.createElement('button'), picker);

        picker.ref(el);
        const hidden = document.querySelector<HTMLInputElement>('input[type="file"]');
        expect(hidden).not.toBeNull();

        hidden!.dispatchEvent(new Event('cancel'));
        expect(oncancel).toHaveBeenCalledTimes(1);

        Object.defineProperty(hidden, 'files', {
          value: [new File(['row'], 'sheet.csv', { type: 'text/csv' })],
        });
        hidden!.dispatchEvent(new Event('change'));

        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<File[]>).detail).toHaveLength(1);
        expect(el.onchange).toBeNull();

        picker.destroy();
      });
    }));

  it('types files and cancellation for consumers without a cast', () => {
    const props: FilePickerProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<File[]>();
      },
      oncancel: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<void>();
      },
    };

    void props;
  });
});
