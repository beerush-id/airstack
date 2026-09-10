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
});
