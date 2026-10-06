import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type FilePickerEvent, type FilePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function picker(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('input[type="file"]');
}

describe('FilePicker - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Hidden Host Bridge & Activation Invariant', () => {
    it('publishes the selection constraints onto the hidden input it bridges to', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<FilePickerProps>({
            accept: 'image/png,image/jpeg',
            multiple: true,
            capture: 'environment',
          });
          const trigger = aria('file-picker', props);

          // 1. Creation & SSR: the trigger is a button, and never a form field
          expect(trigger.current).toBeNull();
          expect(trigger.attributes.role).toBeUndefined();
          expect(trigger.attributes.accept).toBeUndefined();
          expect(trigger.attributes.multiple).toBeUndefined();
          expect(trigger.attributes.capture).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('button'), trigger);
          expect(el.getAttribute('type')).toBe('button');

          // The internal host exists once the controller is attached, and carries the filters
          const hidden = picker();
          expect(hidden).not.toBeNull();
          expect(hidden?.accept).toBe('image/png,image/jpeg');
          expect(hidden?.multiple).toBe(true);
          expect(hidden?.getAttribute('capture')).toBe('environment');

          trigger.destroy();
          expect(trigger.current).toBeNull();

          // Teardown takes the internal host with it
          expect(picker()).toBeNull();
        });
      }));

    it('opens the picker once per activation across click, Enter, and Space', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const trigger = aria('file-picker', { accept: 'text/csv' });
          const el = bind(document.createElement('button'), trigger);

          const hidden = picker();
          expect(hidden).not.toBeNull();

          const opened = vi.fn();
          hidden?.addEventListener('click', opened);

          el.click();
          expect(opened).toHaveBeenCalledTimes(1);

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(opened).toHaveBeenCalledTimes(2);

          el.click();
          el.click();
          expect(opened).toHaveBeenCalledTimes(4);

          trigger.destroy();
        });
      }));
  });

  describe('File Selection Event Forwarding Invariant', () => {
    it('forwards a bubbling change CustomEvent carrying the selected files', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const trigger = aria('file-picker', { multiple: true });
          const el = bind(document.createElement('button'), trigger);

          const hidden = picker();
          expect(hidden).not.toBeNull();

          const changes: Array<{ detail: unknown; bubbles: boolean; kind: string }> = [];
          el.addEventListener('change', (event) => {
            changes.push({
              detail: (event as FilePickerEvent).detail,
              bubbles: event.bubbles,
              kind: event.constructor.name,
            });
          });

          // The system picker reports through the hidden input
          hidden?.dispatchEvent(new Event('change'));

          expect(changes).toHaveLength(1);
          expect(changes[0].kind).toBe('CustomEvent');
          expect(changes[0].bubbles).toBe(true);
          expect(Array.isArray(changes[0].detail)).toBe(true);
          expect(changes[0].detail).toHaveLength(0);

          trigger.destroy();
        });
      }));

    it('keeps the forwarded change announcement out of the picker element itself', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const trigger = aria('file-picker');
          const el = bind(document.createElement('button'), trigger);
          document.body.appendChild(el);
          const hidden = picker();
          expect(hidden).not.toBeNull();

          const nativeChanges = vi.fn();
          document.addEventListener('change', nativeChanges);

          hidden?.dispatchEvent(new Event('change'));

          // One announcement reaches the page: the controller's, not a second native replay
          expect(nativeChanges).toHaveBeenCalledTimes(1);

          document.removeEventListener('change', nativeChanges);
          trigger.destroy();
          el.remove();
        });
      }));
  });

  describe('Inertness & Cancellation Invariant', () => {
    it('does not open the picker while disabled or when a consumer cancels the activation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<FilePickerProps>({ disabled: true });
          const trigger = aria('file-picker', props);
          const el = bind(document.createElement('button'), trigger);

          expect(el.getAttribute('type')).toBe('button');
          expect(el.disabled).toBe(true);

          const hidden = picker();
          expect(hidden).not.toBeNull();

          const opened = vi.fn();
          hidden?.addEventListener('click', opened);

          el.click();
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(opened).not.toHaveBeenCalled();

          // Releasing the guard lets the same activation through
          props.disabled = false;
          expect(el.disabled).toBe(false);
          el.click();
          expect(opened).toHaveBeenCalledTimes(1);

          // A consumer that cancels the click keeps the picker closed
          const veto = (event: Event) => event.preventDefault();
          el.addEventListener('click', veto, { capture: true });
          el.click();
          expect(opened).toHaveBeenCalledTimes(1);

          el.removeEventListener('click', veto, { capture: true });
          el.click();
          expect(opened).toHaveBeenCalledTimes(2);

          trigger.destroy();
        });
      }));

    it('gives a custom host the button mechanics the bridge depends on', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const trigger = aria<HTMLDivElement>(
            'file-picker',
            { accept: 'application/pdf' },
            { native: false },
          );

          // 1. Creation & SSR
          expect(trigger.attributes.role).toBe('button');
          expect(trigger.attributes.tabindex).toBe(0);
          expect(trigger.attributes['aria-disabled']).toBe('false');
          expect(trigger.attributes.type).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), trigger);
          expect(el.getAttribute('role')).toBe('button');
          expect(el.getAttribute('tabindex')).toBe('0');

          const hidden = picker();
          expect(hidden).not.toBeNull();

          const opened = vi.fn();
          hidden?.addEventListener('click', opened);

          // 3/4. Space is suppressed and bridges; Enter bridges immediately
          const space = new KeyboardEvent('keydown', {
            key: ' ',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(space);
          expect(space.defaultPrevented).toBe(true);

          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(opened).toHaveBeenCalledTimes(2);

          // 5. Disablement announces on the ARIA plane and stops the bridge
          trigger.assign({ disabled: true });
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          const openedBefore = opened.mock.calls.length;
          el.click();
          expect(opened).toHaveBeenCalledTimes(openedBefore);

          trigger.destroy();
          expect(trigger.current).toBeNull();
        });
      }));
  });
});
