import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ProgressProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Progress - Coverage (guards & reconciliation)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Range Defaults & Clamping Guards', () => {
    it('defaults to an indeterminate bar over [0, 100] with no props', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBar = aria<HTMLProgressElement>('progress', { label: 'Loading' });
          expect(nativeBar.value).toBeNull();
          expect(nativeBar.indeterminate).toBe(true);
          expect(nativeBar.min).toBe(0);
          expect(nativeBar.max).toBe(100);
          expect(nativeBar.attributes.value).toBeUndefined();
          expect(nativeBar.attributes.max).toBe(100);

          const customBar = aria<HTMLDivElement>('progress', { label: 'Loading' }, { native: false });
          expect(customBar.value).toBeNull();
          expect(customBar.attributes['aria-valuenow']).toBeUndefined();
          expect(customBar.attributes['aria-valuemin']).toBe(0);
          expect(customBar.attributes['aria-valuemax']).toBe(100);

          nativeBar.destroy();
          customBar.destroy();
          expect(nativeBar.current).toBeNull();
          expect(customBar.current).toBeNull();
        });
      }));

    it('constructs bare as an indeterminate bar over the default range', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria('progress');
          expect(bar.value).toBeNull();
          expect(bar.indeterminate).toBe(true);
          expect(bar.min).toBe(0);
          expect(bar.max).toBe(100);
          expect(bar.attributes.value).toBeUndefined();
          expect(bar.attributes.max).toBe(100);
          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));

    it('clamps out-of-range reads without rewriting the consumed input', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressProps>({ value: 500, min: 20, max: 60, label: 'Upload' });
          const nativeBar = aria<HTMLProgressElement>('progress', props);
          const customBar = aria<HTMLDivElement>('progress', props, { native: false });
          const progressEl = bind(document.createElement('progress'), nativeBar);
          const divEl = bind(document.createElement('div'), customBar);

          expect(nativeBar.value).toBe(60);
          expect(customBar.value).toBe(60);
          expect(props.value).toBe(500);
          expect(progressEl.value).toBe(40);
          expect(divEl.getAttribute('aria-valuenow')).toBe('60');

          props.value = -500;
          expect(nativeBar.value).toBe(20);
          expect(customBar.value).toBe(20);
          expect(props.value).toBe(-500);
          expect(progressEl.value).toBe(0);
          expect(divEl.getAttribute('aria-valuenow')).toBe('20');

          nativeBar.destroy();
          customBar.destroy();
        });
      }));

    it('rounds a set value through the clamp on the next read', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria<HTMLProgressElement>('progress', { value: 10, label: 'Cache' });
          const el = bind(document.createElement('progress'), bar);

          bar.value = 250;
          expect(bar.value).toBe(100);
          expect(el.value).toBe(100);

          bar.value = null;
          expect(bar.indeterminate).toBe(true);
          expect(el.hasAttribute('value')).toBe(false);

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));
  });

  describe('Completion Offset Contract', () => {
    it('publishes the completion percent as a style variable on custom hosts', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria<HTMLDivElement>(
            'progress',
            { value: 30, min: 20, max: 60, label: 'Upload' },
            { native: false }
          );
          const el = bind(document.createElement('div'), bar);

          expect(bar.attributes.style).toEqual({ '--aria-progress-offset': '25%' });
          expect(el.style.getPropertyValue('--aria-progress-offset')).toBe('25%');

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));

    it('withholds the offset while indeterminate and guards a zero span', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const idle = aria<HTMLDivElement>('progress', { value: null, label: 'Sync' }, { native: false });
          expect(idle.attributes.style).toBeUndefined();
          idle.destroy();

          const flat = aria<HTMLDivElement>('progress', { value: 5, min: 5, max: 5, label: 'Flat' }, { native: false });
          expect(flat.attributes.style).toEqual({ '--aria-progress-offset': '0%' });
          flat.destroy();
        });
      }));
  });

  describe('Offset Getter Contract', () => {
    it('exposes the completion percent for script usage, null while indeterminate', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bar = aria<HTMLDivElement>(
            'progress',
            { value: 30, min: 20, max: 60, label: 'Upload' },
            { native: false }
          );
          expect(bar.offset).toBe(25);

          bar.value = null;
          expect(bar.offset).toBeNull();

          bar.destroy();

          const flat = aria<HTMLDivElement>('progress', { value: 5, min: 5, max: 5, label: 'Flat' }, { native: false });
          expect(flat.offset).toBe(0);
          flat.destroy();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const bar = aria<HTMLDivElement>(
            'progress',
            { value: 30, min: 0, max: 100, label: 'Sync', valuetext: '30 percent' },
            { native: false }
          );

          for (const key of [
            'value',
            'max',
            'label',
            'aria-valuenow',
            'aria-valuemin',
            'aria-valuemax',
            'aria-valuetext',
            'aria-label',
          ]) {
            expect(bar.ownKeys).toContain(key);
          }

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('stops projecting progress to a detached element after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressProps>({ value: 10, label: 'Cache' });
          const bar = aria<HTMLDivElement>('progress', props, { native: false });
          const el = bind(document.createElement('div'), bar);

          expect(bar.current).toBe(el);

          bar.destroy();
          expect(bar.current).toBeNull();

          props.value = 80;
          expect(el.getAttribute('aria-valuenow')).toBe('10');
        });
      }));
  });
});
