import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ProgressbarProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Progressbar - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Determinate Progress Contract', () => {
    it('announces position, range, and readable text across SSR -> Mount -> parent update', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressbarProps>({ value: 40, min: 0, max: 200, valuetext: 'Step 2 of 5' });
          const bar = aria('progressbar', props);

          // 1. SSR Phase: pre-mount deterministic compilation
          expect(bar.current).toBeNull();
          expect(bar.attributes.role).toBe('progressbar');
          expect(bar.attributes['aria-valuenow']).toBe(40);
          expect(bar.attributes['aria-valuemin']).toBe(0);
          expect(bar.attributes['aria-valuemax']).toBe(200);
          expect(bar.attributes['aria-valuetext']).toBe('Step 2 of 5');

          // 2. Mount Phase: framework element binding
          const el = bind(document.createElement('div'), bar);
          expect(bar.current).toBe(el);
          expect(el.getAttribute('role')).toBe('progressbar');
          expect(el.getAttribute('aria-valuenow')).toBe('40');
          expect(el.getAttribute('aria-valuemax')).toBe('200');
          expect(el.getAttribute('aria-valuetext')).toBe('Step 2 of 5');

          // 3. Interaction Phase: task reports new progress -> announcement follows
          props.value = 150;
          expect(bar.value).toBe(150);
          expect(el.getAttribute('aria-valuenow')).toBe('150');
        });
      }));
  });

  describe('Indeterminate Progress Contract', () => {
    it('withholds aria-valuenow while progress is unmeasurable and announces it once a value arrives', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressbarProps>({ value: null });
          const bar = aria('progressbar', props);

          // 1. SSR Phase: the range is still announced, the position is not
          expect(bar.indeterminate).toBe(true);
          expect(bar.attributes['aria-valuenow']).toBeUndefined();
          expect(bar.attributes['aria-valuemin']).toBe(0);
          expect(bar.attributes['aria-valuemax']).toBe(100);

          // 2. Mount Phase
          const el = bind(document.createElement('div'), bar);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);

          // 3. Interaction Phase: task becomes measurable
          props.value = 25;
          expect(bar.indeterminate).toBe(false);
          expect(el.getAttribute('aria-valuenow')).toBe('25');

          // Task returns to an unmeasurable state -> the claim is withdrawn
          props.value = null;
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));
  });

  describe('Native Progress Equivalence Contract', () => {
    it('projects onto native <progress> without a redundant role and drops value when indeterminate', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria<HTMLProgressElement>('progressbar', { value: 30, max: 60 }, { native: true });

          // 1. SSR Phase: <progress> carries the progressbar role implicitly
          expect(bar.attributes.role).toBeUndefined();
          expect(bar.attributes['aria-valuenow']).toBeUndefined();
          expect(bar.attributes.value).toBe(30);
          expect(bar.attributes.max).toBe(60);

          // 2. Mount Phase
          const el = bind(document.createElement('progress'), bar);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('value')).toBe('30');
          expect(el.getAttribute('max')).toBe('60');

          // 3. Interaction Phase: value withdrawn -> native indeterminate rendering
          bar.value = null;
          expect(el.hasAttribute('value')).toBe(false);
          expect(el.getAttribute('max')).toBe('60');
        });
      }));
  });

  describe('Non-Interactive Contract', () => {
    it('stays out of the tab order and ignores keyboard and pointer input as a read-only indicator', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria('progressbar', { value: 10 });

          // 1. SSR Phase: no tab stop is compiled
          expect(bar.attributes.tabindex).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('div'), bar);
          expect(el.hasAttribute('tabindex')).toBe(false);

          // 3. Interaction Phase: input neither claims the keystroke nor moves the value
          const keydown = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
          el.dispatchEvent(keydown);
          expect(keydown.defaultPrevented).toBe(false);

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);
          expect(el.getAttribute('aria-valuenow')).toBe('10');
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('stops announcing progress to a detached element after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria('progressbar', { value: 10 });
          const el = bind(document.createElement('div'), bar);

          expect(bar.current).toBe(el);

          bar.destroy();
          expect(bar.current).toBeNull();

          bar.value = 80;
          expect(el.getAttribute('aria-valuenow')).toBe('10');
        });
      }));
  });

  describe('Determinate Range & Progression Projection Invariant', () => {
    it('announces the declared range defaults and follows every progression step', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria('progressbar', { value: 0 });

          // 1. Creation & SSR: the range is always announced when a position is
          expect(bar.current).toBeNull();
          expect(bar.indeterminate).toBe(false);
          expect(bar.attributes['aria-valuemin']).toBe(0);
          expect(bar.attributes['aria-valuemax']).toBe(100);
          expect(bar.attributes['aria-valuenow']).toBe(0);

          // 2. DOM Binding
          const el = bind(document.createElement('div'), bar);
          expect(bar.current).toBe(el);
          expect(el.getAttribute('aria-valuemin')).toBe('0');
          expect(el.getAttribute('aria-valuemax')).toBe('100');

          // 3/5. The task reports progress; the announcement moves with it
          bar.assign({ value: 55 });
          expect(el.getAttribute('aria-valuenow')).toBe('55');

          bar.assign({ min: -20, max: 20, value: -20 });
          expect(el.getAttribute('aria-valuemin')).toBe('-20');
          expect(el.getAttribute('aria-valuemax')).toBe('20');
          expect(el.getAttribute('aria-valuenow')).toBe('-20');

          // 6. Teardown
          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));

    it('adds and withdraws readable value text without disturbing the numeric claim', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressbarProps>({ value: 3, min: 0, max: 5 });
          const bar = aria('progressbar', props);
          const el = bind(document.createElement('div'), bar);

          expect(el.hasAttribute('aria-valuetext')).toBe(false);
          expect(el.getAttribute('aria-valuenow')).toBe('3');

          props.valuetext = 'Uploading third of five files';
          expect(el.getAttribute('aria-valuetext')).toBe('Uploading third of five files');
          expect(el.getAttribute('aria-valuenow')).toBe('3');

          // Progress continues underneath the override
          props.value = 4;
          expect(el.getAttribute('aria-valuenow')).toBe('4');
          expect(el.getAttribute('aria-valuetext')).toBe('Uploading third of five files');

          // Withdrawing the override leaves the numeric announcement intact
          props.valuetext = undefined;
          expect(el.hasAttribute('aria-valuetext')).toBe(false);
          expect(el.getAttribute('aria-valuenow')).toBe('4');

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));
  });

  describe('Indeterminate State Invariant', () => {
    it('treats an absent value exactly like a null one and re-enters indeterminate from either', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressbarProps>({});
          const bar = aria('progressbar', props);

          // 1. Creation & SSR: no value at all is indeterminate, not zero
          expect(bar.indeterminate).toBe(true);
          expect(bar.attributes['aria-valuenow']).toBeUndefined();
          expect(bar.attributes['aria-valuemin']).toBe(0);
          expect(bar.attributes['aria-valuemax']).toBe(100);

          // 2. DOM Binding
          const el = bind(document.createElement('div'), bar);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
          expect(el.getAttribute('role')).toBe('progressbar');

          // 3/5. A measurable task supplies the claim
          props.value = 70;
          expect(bar.indeterminate).toBe(false);
          expect(el.getAttribute('aria-valuenow')).toBe('70');

          // Both withdrawal shapes return to the same branch
          props.value = null;
          expect(bar.indeterminate).toBe(true);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);

          props.value = 10;
          expect(el.getAttribute('aria-valuenow')).toBe('10');

          delete props.value;
          expect(bar.indeterminate).toBe(true);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);

          // 6. Teardown: a detached bar stops taking positions
          bar.destroy();
          props.value = 90;
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));

    it('keeps a native progress element indeterminate by withdrawing value while the scale stays', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria<HTMLProgressElement>(
            'progressbar',
            { value: 25, min: 0, max: 50 },
            { native: true },
          );

          // 1. Creation & SSR
          expect(bar.indeterminate).toBe(false);
          expect(bar.attributes.value).toBe(25);
          expect(bar.attributes.max).toBe(50);

          // 2. DOM Binding
          const el = bind(document.createElement('progress'), bar);
          expect(el.value).toBe(25);
          expect(el.max).toBe(50);

          // 3/5. Null value removes the attribute; the scale declaration survives
          bar.assign({ value: null });
          expect(bar.indeterminate).toBe(true);
          expect(el.hasAttribute('value')).toBe(false);
          expect(el.max).toBe(50);

          // Returning to a measured value re-announces through the property
          bar.assign({ value: 40 });
          expect(el.hasAttribute('value')).toBe(true);
          expect(el.value).toBe(40);

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Presentation Invariant', () => {
    it('carries the same progress through HTML attributes or ARIA attributes, never both', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const range = { value: 30, min: 0, max: 60, valuetext: '30 of 60' };

          const nativeBar = aria<HTMLProgressElement>('progressbar', range, { native: true });
          const customBar = aria<HTMLDivElement>('progressbar', range);

          const nativeEl = bind(document.createElement('progress'), nativeBar);
          const customEl = bind(document.createElement('div'), customBar);

          // Same state on both hosts
          expect(nativeBar.value).toBe(30);
          expect(customBar.value).toBe(30);
          expect(nativeBar.indeterminate).toBe(false);
          expect(customBar.indeterminate).toBe(false);

          // Native host: HTML only, no ARIA mirrors and no redundant role
          expect(nativeEl.getAttribute('role')).toBeNull();
          expect(nativeEl.getAttribute('aria-valuenow')).toBeNull();
          expect(nativeEl.getAttribute('aria-valuemin')).toBeNull();
          expect(nativeEl.getAttribute('aria-valuemax')).toBeNull();

          // Custom host: ARIA only, and the native scale keys never appear
          expect(customEl.getAttribute('role')).toBe('progressbar');
          expect(customEl.getAttribute('aria-valuenow')).toBe('30');
          expect(customEl.getAttribute('aria-valuemax')).toBe('60');
          expect(customBar.attributes.value).toBeUndefined();
          expect(customBar.attributes.max).toBeUndefined();
          expect(customBar.attributes.min).toBeUndefined();

          nativeBar.destroy();
          customBar.destroy();
        });
      }));

    it('keeps both hosts out of the tab order and out of the interaction path', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBar = aria<HTMLProgressElement>('progressbar', { value: 1 }, { native: true });
          const customBar = aria<HTMLDivElement>('progressbar', { value: 1 });

          const nativeEl = bind(document.createElement('progress'), nativeBar);
          const customEl = bind(document.createElement('div'), customBar);

          expect(nativeEl.hasAttribute('tabindex')).toBe(false);
          expect(customEl.hasAttribute('tabindex')).toBe(false);

          for (const el of [nativeEl, customEl]) {
            const keydown = new KeyboardEvent('keydown', {
              key: 'ArrowRight',
              cancelable: true,
              bubbles: true,
            });
            el.dispatchEvent(keydown);

            const click = new MouseEvent('click', { cancelable: true, bubbles: true });
            el.dispatchEvent(click);

            expect(keydown.defaultPrevented).toBe(false);
            expect(click.defaultPrevented).toBe(false);
          }

          expect(nativeBar.value).toBe(1);
          expect(customBar.value).toBe(1);

          nativeBar.destroy();
          customBar.destroy();
          expect(nativeBar.current).toBeNull();
          expect(customBar.current).toBeNull();
        });
      }));
  });
});
