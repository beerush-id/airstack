import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type FilePickerCancelEvent, type FilePickerEvent, type FilePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function picker(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('input[type="file"]');
}

describe('FilePicker - Coverage (cancel contract, constraint sync & key guards)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('forwards picker dismissal as a non-bubbling cancel CustomEvent', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const trigger = aria('file-picker');
        const el = bind(document.createElement('button'), trigger);
        const hidden = picker();
        expect(hidden).not.toBeNull();

        const cancels: Array<{ bubbles: boolean; kind: string; detail: unknown }> = [];
        el.addEventListener('cancel', (event) =>
          cancels.push({
            bubbles: event.bubbles,
            kind: event.constructor.name,
            detail: (event as FilePickerCancelEvent).detail,
          }),
        );

        hidden?.dispatchEvent(new Event('cancel'));

        expect(cancels).toHaveLength(1);
        expect(cancels[0].kind).toBe('CustomEvent');
        expect(cancels[0].bubbles).toBe(false);
        expect(cancels[0].detail).toBeNull();

        trigger.destroy();
        expect(picker()).toBeNull();
      });
    }));

  it('carries selected files through the forwarded change detail', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const trigger = aria('file-picker', { multiple: true });
        const el = bind(document.createElement('button'), trigger);
        const hidden = picker();
        expect(hidden).not.toBeNull();

        const details: unknown[] = [];
        el.addEventListener('change', (event) => details.push((event as FilePickerEvent).detail));

        Object.defineProperty(hidden, 'files', {
          value: [new File(['row'], 'sheet.csv', { type: 'text/csv' })],
        });
        hidden?.dispatchEvent(new Event('change'));

        expect(details).toHaveLength(1);
        const files = details[0] as File[];
        expect(files).toHaveLength(1);
        expect(files[0]).toBeInstanceOf(File);
        expect(files[0].name).toBe('sheet.csv');

        trigger.destroy();
      });
    }));

  it('syncs selection constraints reactively onto the hidden input', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<FilePickerProps>({ accept: 'image/*', multiple: true });
        const trigger = aria('file-picker', props);
        bind(document.createElement('button'), trigger);

        const hidden = picker();
        expect(hidden?.accept).toBe('image/*');
        expect(hidden?.multiple).toBe(true);
        expect(hidden?.getAttribute('capture')).toBeNull();

        props.accept = undefined;
        props.multiple = false;
        props.capture = 'user';
        expect(hidden?.getAttribute('accept')).toBeNull();
        expect(hidden?.multiple).toBe(false);
        expect(hidden?.getAttribute('capture')).toBe('user');

        props.capture = undefined;
        expect(hidden?.getAttribute('capture')).toBeNull();

        trigger.destroy();
      });
    }));

  it('leaves platform-owned native keystrokes alone', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const trigger = aria('file-picker');
        const el = bind(document.createElement('button'), trigger);
        const hidden = picker();
        const opened = vi.fn();
        hidden?.addEventListener('click', opened);

        const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
        el.dispatchEvent(space);
        expect(space.defaultPrevented).toBe(false);

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));

        const vetoed = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
        vetoed.preventDefault();
        el.dispatchEvent(vetoed);

        expect(opened).not.toHaveBeenCalled();

        trigger.destroy();
      });
    }));

  it('withholds the custom bridge for prevented, unarmed, or disabled keystrokes', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const trigger = aria<HTMLDivElement>('file-picker', {}, { native: false });
        const el = bind(document.createElement('div'), trigger);
        const hidden = picker();
        const opened = vi.fn();
        hidden?.addEventListener('click', opened);

        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', cancelable: true, bubbles: true }));

        const vetoedSpace = new KeyboardEvent('keydown', {
          key: ' ',
          cancelable: true,
          bubbles: true,
        });
        vetoedSpace.preventDefault();
        el.dispatchEvent(vetoedSpace);
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));

        const vetoedEnter = new KeyboardEvent('keydown', {
          key: 'Enter',
          cancelable: true,
          bubbles: true,
        });
        vetoedEnter.preventDefault();
        el.dispatchEvent(vetoedEnter);

        expect(opened).not.toHaveBeenCalled();

        trigger.assign({ disabled: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));

        expect(opened).not.toHaveBeenCalled();

        trigger.destroy();
      });
    }));
});

  describe('Attribute Shielding Contract', () => {
    const shieldScope = createLifecycle();

    afterAll(() => {
      shieldScope.destroy();
    });

    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      shieldScope.run(() => {
        component().run(() => {
          const trigger = aria<HTMLDivElement>(
            'file-picker',
            { accept: 'image/*', multiple: true, disabled: false },
            { native: false },
          );

          for (const key of ['accept', 'multiple', 'capture', 'disabled', 'role', 'tabindex']) {
            expect(trigger.ownKeys).toContain(key);
          }

          trigger.destroy();
          expect(trigger.current).toBeNull();
        });
      }));
  });
