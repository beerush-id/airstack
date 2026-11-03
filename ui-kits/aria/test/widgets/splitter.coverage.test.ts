import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type SplitterEvent, type SplitterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

function pointer(el: HTMLElement, type: string, init: MouseEventInit = {}): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, buttons: 1, ...init }));
}

function area(el: HTMLElement, rect: { left: number; width: number; bottom: number; height: number }): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: rect.left,
    right: rect.left + rect.width,
    top: rect.bottom - rect.height,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.bottom - rect.height,
    toJSON: () => {},
  });
}

describe('Splitter - Coverage (props, drag, events & guards)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Step & Label Contract', () => {
    it('scales arrow travel by the step prop and names the handle', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100, step: 5, label: 'Sidebar' });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          el.focus();

          expect(el.getAttribute('aria-label')).toBe('Sidebar');

          press(el, 'ArrowRight');
          expect(props.value).toBe(55);

          press(el, 'ArrowLeft');
          press(el, 'ArrowLeft');
          expect(props.value).toBe(45);

          splitter.destroy();
        });
      }));
  });

  describe('Disabled Lockout Contract', () => {
    it('leaves the tab order, announces disabled, and refuses keys and drags', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100, disabled: true });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          document.body.appendChild(el);
          area(el, { left: 0, width: 200, bottom: 20, height: 20 });

          expect(splitter.attributes.tabindex).toBe(-1);
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(el.getAttribute('aria-disabled')).toBe('true');

          press(el, 'ArrowRight');
          expect(props.value).toBe(50);

          pointer(el, 'pointerdown', { clientY: 4 });
          pointer(el, 'pointermove', { clientY: 16 });
          expect(props.value).toBe(50);

          el.remove();
          splitter.destroy();
        });
      }));
  });

  describe('Interaction Events Contract', () => {
    it('dispatches input and change per keyboard commit carrying the partition', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 30, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          el.focus();

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          el.addEventListener('input', (event) => inputs.push((event as SplitterEvent).detail));
          el.addEventListener('change', (event) => changes.push((event as SplitterEvent).detail));

          press(el, 'ArrowRight');
          expect(inputs).toEqual([31]);
          expect(changes).toEqual([31]);

          splitter.destroy();
        });
      }));
  });

  describe('Pointer Drag Contract', () => {
    it('drags the partition along the parent area and commits change on release', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const host = document.createElement('div');
          const el = bind(document.createElement('div'), splitter);
          host.appendChild(el);
          document.body.appendChild(host);
          area(host, { left: 0, width: 200, bottom: 20, height: 20 });

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          el.addEventListener('input', (event) => inputs.push((event as SplitterEvent).detail));
          el.addEventListener('change', (event) => changes.push((event as SplitterEvent).detail));

          pointer(el, 'pointerdown', { clientY: 16 });
          expect(props.value).toBe(20);

          pointer(el, 'pointermove', { clientY: 10 });
          expect(props.value).toBe(50);
          expect(inputs).toEqual([20, 50]);

          pointer(el, 'pointermove', { clientY: 6 });
          expect(props.value).toBe(70);

          pointer(el, 'pointerup', { clientY: 6 });
          expect(changes).toEqual([70]);

          host.remove();
          splitter.destroy();
        });
      }));

    it('cancels without a change event and ends tracking on mid-drag disable', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const host = document.createElement('div');
          const el = bind(document.createElement('div'), splitter);
          host.appendChild(el);
          document.body.appendChild(host);
          area(host, { left: 0, width: 200, bottom: 20, height: 20 });

          const changes: unknown[] = [];
          el.addEventListener('change', (event) => changes.push((event as SplitterEvent).detail));

          pointer(el, 'pointerdown', { clientY: 16 });
          pointer(el, 'pointermove', { clientY: 10 });
          pointer(el, 'pointercancel');
          expect(props.value).toBe(50);
          expect(changes).toEqual([]);

          pointer(el, 'pointerdown', { clientY: 16 });
          expect(props.value).toBe(20);
          props.disabled = true;
          pointer(el, 'pointermove', { clientY: 10 });
          expect(props.value).toBe(20);
          expect(changes).toEqual([]);

          host.remove();
          splitter.destroy();
        });
      }));
  });

  describe('Drag Guard Contract', () => {
    it('drags along the width on a vertical axis', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100, orientation: 'vertical' });
          const splitter = aria('splitter', props);
          const host = document.createElement('div');
          const el = bind(document.createElement('div'), splitter);
          host.appendChild(el);
          document.body.appendChild(host);
          area(host, { left: 0, width: 200, bottom: 20, height: 20 });

          pointer(el, 'pointerdown', { clientX: 40 });
          expect(props.value).toBe(20);

          pointer(el, 'pointermove', { clientX: 100 });
          expect(props.value).toBe(50);

          host.remove();
          splitter.destroy();
        });
      }));

    it('ignores non-primary buttons, parentless handles, and released moves', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);

          pointer(el, 'pointerdown', { clientY: 4, button: 2 });
          expect(props.value).toBe(50);

          pointer(el, 'pointerdown', { clientY: 4 });
          expect(props.value).toBe(50);

          pointer(el, 'pointermove', { clientY: 16, buttons: 0 });
          expect(props.value).toBe(50);

          const pre = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
          pre.preventDefault();
          el.dispatchEvent(pre);
          expect(props.value).toBe(50);

          splitter.destroy();
        });
      }));

    it('commits nothing new when the press lands on the current partition', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 20, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const host = document.createElement('div');
          const el = bind(document.createElement('div'), splitter);
          host.appendChild(el);
          document.body.appendChild(host);
          area(host, { left: 0, width: 200, bottom: 20, height: 20 });

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          el.addEventListener('input', (event) => inputs.push((event as SplitterEvent).detail));
          el.addEventListener('change', (event) => changes.push((event as SplitterEvent).detail));

          pointer(el, 'pointerdown', { clientY: 16 });
          expect(props.value).toBe(20);
          expect(inputs).toEqual([]);

          pointer(el, 'pointerup', { clientY: 16 });
          expect(changes).toEqual([]);

          host.remove();
          splitter.destroy();
        });
      }));

    it('ignores void moves and stays silent when the drag returns to its start', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const host = document.createElement('div');
          const el = bind(document.createElement('div'), splitter);
          host.appendChild(el);
          document.body.appendChild(host);
          area(host, { left: 0, width: 200, bottom: 20, height: 20 });

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          el.addEventListener('input', (event) => inputs.push((event as SplitterEvent).detail));
          el.addEventListener('change', (event) => changes.push((event as SplitterEvent).detail));

          pointer(el, 'pointerdown', { clientY: 16 });
          expect(props.value).toBe(20);

          pointer(el, 'pointermove', { clientY: 16 });
          expect(inputs).toEqual([20]);

          const voided = new MouseEvent('pointermove', { bubbles: true, cancelable: true, buttons: 1 });
          voided.preventDefault();
          el.dispatchEvent(voided);
          expect(props.value).toBe(20);

          area(host, { left: 0, width: 0, bottom: 0, height: 0 });
          pointer(el, 'pointermove', { clientY: 10 });
          expect(props.value).toBe(20);

          area(host, { left: 0, width: 200, bottom: 20, height: 20 });
          pointer(el, 'pointermove', { clientY: 10 });
          expect(props.value).toBe(50);

          pointer(el, 'pointerup', { clientY: 10 });
          expect(changes).toEqual([]);

          host.remove();
          splitter.destroy();
        });
      }));

    it('ends the window session when destroyed mid-drag', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const host = document.createElement('div');
          const el = bind(document.createElement('div'), splitter);
          host.appendChild(el);
          document.body.appendChild(host);
          area(host, { left: 0, width: 200, bottom: 20, height: 20 });

          pointer(el, 'pointerdown', { clientY: 16 });
          expect(props.value).toBe(20);

          splitter.destroy();
          window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, cancelable: true, buttons: 1 }));
          expect(props.value).toBe(20);

          host.remove();
        });
      }));
  });

  describe('Position Offset Contract', () => {
    it('publishes the partition percent as a style variable', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { value: 40, min: 10, max: 90 });
          const el = bind(document.createElement('div'), splitter);

          expect(splitter.attributes.style).toEqual({ '--aria-splitter-offset': '37.5%' });
          expect(el.style.getPropertyValue('--aria-splitter-offset')).toBe('37.5%');

          splitter.destroy();

          const flat = aria('splitter', { value: 5, min: 5, max: 5 });
          expect(flat.attributes.style).toEqual({ '--aria-splitter-offset': '0%' });
          expect(flat.offset).toBe(0);
          flat.destroy();
        });
      }));
  });

  describe('Offset Getter Contract', () => {
    it('exposes the partition ratio as an offset getter for script usage', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 40, min: 10, max: 90 });
          const splitter = aria('splitter', props);

          expect(splitter.offset).toBe(37.5);

          props.value = 90;
          expect(splitter.offset).toBe(100);

          splitter.destroy();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const splitter = aria('splitter', {
            value: 30,
            min: 0,
            max: 100,
            step: 5,
            label: 'Panels',
            orientation: 'vertical',
          });

          for (const key of [
            'value',
            'min',
            'max',
            'step',
            'label',
            'aria-valuenow',
            'aria-valuemin',
            'aria-valuemax',
            'aria-label',
          ]) {
            expect(splitter.ownKeys).toContain(key);
          }

          splitter.destroy();
          expect(splitter.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('stops projecting the partition to a detached element after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 10, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);

          expect(splitter.current).toBe(el);

          splitter.destroy();
          expect(splitter.current).toBeNull();

          props.value = 80;
          expect(el.getAttribute('aria-valuenow')).toBe('10');
        });
      }));
  });
});
