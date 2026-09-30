import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type DividerProps, type SplitterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Divider - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Static Divider Contract', () => {
    it('renders a native <hr> divider with no redundant role, tab stop, or value claim', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');

          // 1. SSR Phase: <hr> carries the separator role implicitly
          expect(divider.current).toBeNull();
          expect(divider.attributes.role).toBeUndefined();
          expect(divider.attributes.tabindex).toBeUndefined();
          expect(divider.attributes['aria-valuenow']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('hr'), divider);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));

    it('declares role="separator" on custom dividers while keeping them unfocusable and value-less', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria<HTMLDivElement>('divider', {}, { native: false });

          // 1. SSR Phase
          expect(divider.attributes.role).toBe('separator');
          expect(divider.attributes.tabindex).toBeUndefined();
          expect(divider.attributes['aria-valuemin']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('div'), divider);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.hasAttribute('tabindex')).toBe(false);
        });
      }));

    it('leaves arrow keys to the browser on static dividers', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');
          const el = bind(document.createElement('hr'), divider);

          const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
          el.dispatchEvent(arrow);

          expect(arrow.defaultPrevented).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));
  });

  describe('Orientation Contract', () => {
    it('announces aria-orientation only when the divider departs from the horizontal default', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const horizontal = aria('divider', { orientation: 'horizontal' });
          const vertical = aria('divider', { orientation: 'vertical' });

          // 1. SSR Phase: horizontal is the default and stays unannounced
          expect(horizontal.orientation).toBe('horizontal');
          expect(horizontal.attributes['aria-orientation']).toBeUndefined();
          expect(vertical.attributes['aria-orientation']).toBe('vertical');

          // 2. Mount Phase
          const horizontalEl = bind(document.createElement('hr'), horizontal);
          const verticalEl = bind(document.createElement('hr'), vertical);
          expect(horizontalEl.hasAttribute('aria-orientation')).toBe(false);
          expect(verticalEl.getAttribute('aria-orientation')).toBe('vertical');
        });
      }));
  });

  describe('Movable Splitter Contract', () => {
    it('becomes a focusable range widget announcing its partition across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 30, min: 0, max: 100 });
          const splitter = aria('splitter', props);

          // 1. SSR Phase
          expect(splitter.attributes.role).toBe('separator');
          expect(splitter.attributes.tabindex).toBe(0);
          expect(splitter.attributes['aria-valuenow']).toBe(30);
          expect(splitter.attributes['aria-valuemin']).toBe(0);
          expect(splitter.attributes['aria-valuemax']).toBe(100);

          // 2. Mount Phase
          const el = bind(document.createElement('div'), splitter);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-valuenow')).toBe('30');

          // 3. Interaction Phase: arrows move the partition and the announcement follows
          const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
          el.dispatchEvent(right);
          expect(right.defaultPrevented).toBe(true);
          expect(splitter.value).toBe(31);
          expect(el.getAttribute('aria-valuenow')).toBe('31');

          // Down advances and Up retreats on any axis
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(32);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(31);
          expect(el.getAttribute('aria-valuenow')).toBe('31');

          // Parent repositions the partition directly
          props.value = 70;
          expect(el.getAttribute('aria-valuenow')).toBe('70');
        });
      }));

    it('holds the partition at the range boundaries when arrows or assignments overshoot', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { value: 100, min: 20, max: 100 });
          const el = bind(document.createElement('div'), splitter);

          // 1. Already at the upper boundary: advancing changes nothing
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(100);
          expect(el.getAttribute('aria-valuenow')).toBe('100');

          // 2. Out-of-range assignment is pulled back into range
          splitter.value = 250;
          expect(splitter.value).toBe(100);

          splitter.value = -250;
          expect(splitter.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');

          // 3. At the lower boundary: retreating changes nothing
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');
        });
      }));

    it('announces a vertical splitter axis alongside its partition', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { orientation: 'vertical', value: 40 });
          const el = bind(document.createElement('div'), splitter);

          expect(el.getAttribute('aria-orientation')).toBe('vertical');
          expect(el.getAttribute('aria-valuenow')).toBe('40');

          // Right and Left still advance and retreat a vertical partition
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(41);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(40);
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('stops moving a detached splitter after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { value: 30 });
          const el = bind(document.createElement('div'), splitter);

          expect(splitter.current).toBe(el);

          splitter.destroy();
          expect(splitter.current).toBeNull();

          splitter.value = 80;
          expect(el.getAttribute('aria-valuenow')).toBe('30');
        });
      }));
  });

  describe('Structural Demarcation & Semantic Role Invariant', () => {
    it('holds a custom divider as a value-less, focus-less boundary across its full lifecycle', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria<HTMLDivElement>('divider', {}, { native: false });

          // 1. Creation & SSR: separator role and nothing else
          expect(divider.current).toBeNull();
          expect(divider.attributes.role).toBe('separator');
          expect(
            Object.keys(divider.attributes).filter((key) => key.startsWith('on')),
          ).toEqual([]);
          expect(
            Object.keys(divider.attributes).filter((key) => key.startsWith('aria-value')),
          ).toEqual([]);

          // 2. DOM Binding
          const el = bind(document.createElement('div'), divider);
          expect(divider.current).toBe(el);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.hasAttribute('tabindex')).toBe(false);

          // 3/4. Interaction: a static boundary claims no stimulus and prevents no default
          const stimuli: Event[] = [
            new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }),
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          ];

          for (const event of stimuli) {
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          el.click();

          // 5. Reconciliation: no value or tab stop appears as a side effect of interaction
          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
          expect(el.getAttribute('role')).toBe('separator');

          // 6. Teardown
          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));

    it('holds a native hr divider to an implicit role with no compiled separator or tab stop', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');

          // 1. Creation & SSR
          expect(divider.attributes.role).toBeUndefined();
          expect(divider.attributes.tabindex).toBeUndefined();
          expect(divider.attributes['aria-orientation']).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('hr'), divider);
          expect(divider.current).toBe(el);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.hasAttribute('tabindex')).toBe(false);

          // 3/4. Pointer and keyboard stimuli stay with the browser
          const arrow = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(arrow);
          el.click();
          expect(arrow.defaultPrevented).toBe(false);

          // 5. Reconciliation: still value-less and unfocusable
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
          expect(el.hasAttribute('tabindex')).toBe(false);

          // 6. Teardown
          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Presentation Invariant', () => {
    it('diverges between hosts only in how the separator role is carried', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeDivider = aria('divider', { orientation: 'vertical' });
          const customDivider = aria<HTMLDivElement>(
            'divider',
            { orientation: 'vertical' },
            { native: false },
          );

          // 1. Creation & SSR: the role is the sole compile-time difference
          expect(nativeDivider.attributes.role).toBeUndefined();
          expect(customDivider.attributes.role).toBe('separator');

          const nativeAttrs = { ...nativeDivider.attributes };
          delete nativeAttrs.role;

          const customAttrs = { ...customDivider.attributes };
          delete customAttrs.role;

          expect(customAttrs).toEqual(nativeAttrs);

          // 2. DOM Binding: both nodes announce the same boundary to assistive technology
          const hr = bind(document.createElement('hr'), nativeDivider);
          const div = bind(document.createElement('div'), customDivider);

          expect(hr.getAttribute('aria-orientation')).toBe('vertical');
          expect(div.getAttribute('aria-orientation')).toBe('vertical');
          expect(hr.getAttribute('role')).toBeNull();
          expect(div.getAttribute('role')).toBe('separator');

          // 3/5. Neither host gains a tab stop or a range value from either mechanism
          hr.click();
          div.click();
          expect(hr.hasAttribute('tabindex')).toBe(false);
          expect(div.hasAttribute('tabindex')).toBe(false);
          expect(hr.hasAttribute('aria-valuenow')).toBe(false);
          expect(div.hasAttribute('aria-valuenow')).toBe(false);

          // 6. Teardown
          nativeDivider.destroy();
          customDivider.destroy();
          expect(nativeDivider.current).toBeNull();
          expect(customDivider.current).toBeNull();
        });
      }));

    it('re-establishes identical presentation when the same controller reattaches', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria<HTMLDivElement>('divider', {}, { native: false });
          const el = bind(document.createElement('div'), divider);

          expect(divider.current).toBe(el);
          expect(el.getAttribute('role')).toBe('separator');

          // Framework unmount: ref(null) releases the node
          divider.ref(null);
          expect(divider.current).toBeNull();

          // Remount on a fresh node: same deterministic output, no residue on the old one
          const replacement = document.createElement('div');
          divider.ref(replacement);
          expect(divider.current).toBe(replacement);
          expect(replacement.getAttribute('role')).toBe('separator');
          expect(replacement.hasAttribute('tabindex')).toBe(false);

          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));
  });

  describe('Spatial Orientation Invariant', () => {
    it('adds the axis on departure from horizontal and removes it on return', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria<HTMLDivElement>(
            'divider',
            { orientation: 'horizontal' },
            { native: false },
          );

          // 1. Creation & SSR: the default axis is never announced
          expect(divider.orientation).toBe('horizontal');
          expect(divider.attributes['aria-orientation']).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), divider);
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          // 3/5. Departing from the default announces the axis live
          divider.assign({ orientation: 'vertical' });
          expect(divider.orientation).toBe('vertical');
          expect(divider.attributes['aria-orientation']).toBe('vertical');
          expect(el.getAttribute('aria-orientation')).toBe('vertical');

          // Returning to the default withdraws the announcement instead of asserting it
          divider.assign({ orientation: 'horizontal' });
          expect(divider.attributes['aria-orientation']).toBeUndefined();
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          // 4. Announcing a vertical axis never makes the boundary focusable
          divider.assign({ orientation: 'vertical' });
          const arrow = new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(arrow);
          expect(arrow.defaultPrevented).toBe(false);
          expect(el.hasAttribute('tabindex')).toBe(false);

          // 6. Teardown
          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));

    it('tracks an externally owned orientation source through mount and withdrawal', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DividerProps>({ orientation: 'horizontal' });
          const divider = aria<HTMLDivElement>('divider', props, { native: false });

          // 1/2. Creation & DOM Binding
          const el = bind(document.createElement('div'), divider);
          expect(divider.current).toBe(el);
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          // 3/5. The forwarded source owns the axis
          props.orientation = 'vertical';
          expect(divider.orientation).toBe('vertical');
          expect(el.getAttribute('aria-orientation')).toBe('vertical');
          expect(el.getAttribute('role')).toBe('separator');

          // Clearing the source withdraws the announcement without rebinding
          props.orientation = undefined;
          expect(divider.attributes['aria-orientation']).toBeUndefined();
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          // 6. Teardown: a detached node stops following the source
          divider.destroy();
          props.orientation = 'vertical';
          expect(el.hasAttribute('aria-orientation')).toBe(false);
        });
      }));
  });
});
