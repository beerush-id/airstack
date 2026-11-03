import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type MeterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Meter - Coverage (guards & reconciliation)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Reading Defaults & Committed Clamp Guards', () => {
    it('falls back to the minimum reading over the default range', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const meter = aria<HTMLDivElement>('meter', { label: 'Fuel' }, { native: false });

          expect(meter.value).toBe(0);
          expect(meter.min).toBe(0);
          expect(meter.max).toBe(100);
          expect(meter.attributes['aria-valuenow']).toBe(0);
          expect(meter.attributes['aria-valuemin']).toBe(0);
          expect(meter.attributes['aria-valuemax']).toBe(100);

          const floored = aria<HTMLDivElement>('meter', { min: 7, label: 'Floor' }, { native: false });
          expect(floored.value).toBe(7);

          const bare = aria<HTMLDivElement>('meter', undefined as unknown as MeterProps, {
            native: false,
          });
          expect(bare.value).toBe(0);
          expect(bare.attributes['aria-valuenow']).toBe(0);
          expect(bare.attributes['aria-label']).toBeUndefined();

          meter.destroy();
          floored.destroy();
          bare.destroy();
          expect(meter.current).toBeNull();
          expect(floored.current).toBeNull();
          expect(bare.current).toBeNull();
        });
      }));

    it('commits clamped writes into the stored input', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<MeterProps>({ value: 30, min: 20, max: 60, label: 'Temperature' });
          const meter = aria<HTMLDivElement>('meter', props, { native: false });
          const el = bind(document.createElement('div'), meter);

          meter.value = 150;
          expect(props.value).toBe(60);
          expect(el.getAttribute('aria-valuenow')).toBe('60');

          meter.value = -5;
          expect(props.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));
  });

  describe('Completion Offset Contract', () => {
    it('publishes the reading percent as a style variable on custom hosts only', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const meter = aria<HTMLDivElement>(
            'meter',
            { value: 45, min: 10, max: 90, label: 'Battery' },
            { native: false }
          );
          const el = bind(document.createElement('div'), meter);

          expect(meter.attributes.style).toEqual({ '--aria-meter-offset': '43.75%' });
          expect(el.style.getPropertyValue('--aria-meter-offset')).toBe('43.75%');

          const nativeMeter = aria<HTMLMeterElement>(
            'meter',
            { value: 45, min: 10, max: 90, label: 'Battery' },
            { native: true }
          );
          expect(nativeMeter.attributes.style).toBeUndefined();

          meter.destroy();
          nativeMeter.destroy();
        });
      }));

    it('guards a zero span at zero percent', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const flat = aria<HTMLDivElement>('meter', { value: 5, min: 5, max: 5, label: 'Flat' }, { native: false });
          expect(flat.attributes.style).toEqual({ '--aria-meter-offset': '0%' });
          flat.destroy();
        });
      }));
  });

  describe('Offset Getter Contract', () => {
    it('exposes the reading percent for script usage', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const meter = aria<HTMLDivElement>(
            'meter',
            { value: 45, min: 10, max: 90, label: 'Battery' },
            { native: false }
          );
          expect(meter.offset).toBe(43.75);
          meter.destroy();

          const flat = aria<HTMLDivElement>('meter', { value: 5, min: 5, max: 5, label: 'Flat' }, { native: false });
          expect(flat.offset).toBe(0);
          flat.destroy();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const meter = aria<HTMLDivElement>(
            'meter',
            { value: 30, min: 0, max: 100, label: 'Sync', valuetext: '30 percent' },
            { native: false }
          );

          for (const key of [
            'value',
            'min',
            'max',
            'label',
            'aria-valuenow',
            'aria-valuemin',
            'aria-valuemax',
            'aria-valuetext',
            'aria-label',
          ]) {
            expect(meter.ownKeys).toContain(key);
          }

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('stops projecting readings to a detached element after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<MeterProps>({ value: 10, label: 'Cache' });
          const meter = aria<HTMLDivElement>('meter', props, { native: false });
          const el = bind(document.createElement('div'), meter);

          expect(meter.current).toBe(el);

          meter.destroy();
          expect(meter.current).toBeNull();

          props.value = 80;
          expect(el.getAttribute('aria-valuenow')).toBe('10');
        });
      }));
  });
});
