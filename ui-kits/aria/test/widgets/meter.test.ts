import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type MeterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Meter - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Scalar Range & Optimum Segment Projection Invariant', () => {
    it('announces the measurement against its declared range and default bounds', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<MeterProps>({ value: 72, label: 'Disk usage' });
          const meter = aria('meter', props);

          // 1. Creation & SSR: default interval is 0..100 in original units
          expect(meter.current).toBeNull();
          expect(meter.attributes.role).toBe('meter');
          expect(meter.attributes['aria-valuemin']).toBe(0);
          expect(meter.attributes['aria-valuemax']).toBe(100);
          expect(meter.attributes['aria-valuenow']).toBe(72);
          expect(meter.attributes['aria-label']).toBe('Disk usage');
          expect(meter.attributes['aria-valuetext']).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), meter);
          expect(el.getAttribute('aria-valuenow')).toBe('72');
          expect(el.getAttribute('aria-valuemin')).toBe('0');
          expect(el.getAttribute('aria-valuemax')).toBe('100');

          // 3/5. A new reading re-projects without rebinding
          props.value = 91;
          expect(el.getAttribute('aria-valuenow')).toBe('91');

          props.valuetext = '91 percent full';
          expect(el.getAttribute('aria-valuetext')).toBe('91 percent full');
          expect(el.getAttribute('aria-valuenow')).toBe('91');

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));

    it('clamps every write into the declared interval and re-clamps when the interval moves', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<MeterProps>({ value: 30, min: 20, max: 60, label: 'Temperature' });
          const meter = aria('meter', props);
          const el = bind(document.createElement('div'), meter);

          expect(el.getAttribute('aria-valuenow')).toBe('30');

          meter.value = 150;
          expect(meter.value).toBe(60);
          expect(el.getAttribute('aria-valuenow')).toBe('60');

          meter.value = -5;
          expect(meter.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');

          // The interval itself moves: the reading follows the nearer bound
          props.min = 0;
          props.max = 10;
          expect(meter.value).toBe(10);
          expect(el.getAttribute('aria-valuenow')).toBe('10');
          expect(el.getAttribute('aria-valuemin')).toBe('0');
          expect(el.getAttribute('aria-valuemax')).toBe('10');

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Unit Normalization Invariant', () => {
    it('keeps native meter values in original units with no zero-offset mapping', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const meter = aria<HTMLMeterElement>(
            'meter',
            { value: 30, min: 20, max: 60, label: 'Load' },
            { native: true },
          );

          // 1. Creation & SSR: the native element carries the range directly
          expect(meter.attributes.role).toBeUndefined();
          expect(meter.attributes['aria-valuenow']).toBeUndefined();
          expect(meter.attributes['aria-valuemin']).toBeUndefined();
          expect(meter.attributes['aria-valuemax']).toBeUndefined();
          expect(meter.attributes.min).toBe(20);
          expect(meter.attributes.max).toBe(60);
          expect(meter.attributes.value).toBe(30);

          // 2. DOM Binding
          const el = bind(document.createElement('meter'), meter);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.min).toBe(20);
          expect(el.max).toBe(60);
          expect(el.value).toBe(30);

          // 3/5. A clamped write stays in the original interval, not a 0-based one
          meter.value = 200;
          expect(meter.value).toBe(60);
          expect(el.value).toBe(60);
          expect(el.min).toBe(20);

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));

    it('reports the same reading through HTML attributes or ARIA attributes by host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const range = { value: 45, min: 10, max: 90, label: 'Battery' };

          const nativeMeter = aria<HTMLMeterElement>('meter', range, { native: true });
          const customMeter = aria<HTMLDivElement>('meter', range, { native: false });

          const meterEl = bind(document.createElement('meter'), nativeMeter);
          const divEl = bind(document.createElement('div'), customMeter);

          expect(nativeMeter.value).toBe(45);
          expect(customMeter.value).toBe(45);

          // Native: HTML attributes, implicit role, no ARIA mirrors
          expect(meterEl.hasAttribute('aria-valuenow')).toBe(false);
          expect(meterEl.hasAttribute('role')).toBe(false);

          // Custom: ARIA attributes in the same original units, and no native range keys
          expect(divEl.getAttribute('role')).toBe('meter');
          expect(divEl.getAttribute('aria-valuenow')).toBe('45');
          expect(divEl.getAttribute('aria-valuemin')).toBe('10');
          expect(divEl.getAttribute('aria-valuemax')).toBe('90');
          expect(customMeter.attributes.min).toBeUndefined();
          expect(customMeter.attributes.max).toBeUndefined();
          expect(customMeter.attributes.value).toBeUndefined();

          // The accessible name is ARIA on both hosts: <meter> has no naming attribute
          expect(meterEl.getAttribute('aria-label')).toBe('Battery');
          expect(divEl.getAttribute('aria-label')).toBe('Battery');

          nativeMeter.destroy();
          customMeter.destroy();
        });
      }));
  });

  describe('Non-Interactive Presentation Invariant', () => {
    it('takes no tab stop and claims no key across the whole range', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const meter = aria<HTMLDivElement>(
            'meter',
            { value: 30, min: 0, max: 100, label: 'Signal' },
            { native: false },
          );
          const el = bind(document.createElement('div'), meter);

          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(meter.attributes.tabindex).toBeUndefined();

          // Nothing steps a gauge: it reports, it is not operated
          for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'Enter', ' ']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(meter.value).toBe(30);
          expect(el.getAttribute('aria-valuenow')).toBe('30');

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));

    it('changes its reading only when the measured value changes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<MeterProps>({ value: 12, min: 0, max: 24, label: 'Hours' });
          const meter = aria('meter', props);
          const el = bind(document.createElement('div'), meter);

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);
          expect(meter.value).toBe(12);

          // An author write is the only source of a new reading
          props.value = 23;
          expect(meter.value).toBe(23);
          expect(el.getAttribute('aria-valuenow')).toBe('23');

          // And the announcement stays a projection, never a control state
          expect(el.hasAttribute('aria-pressed')).toBe(false);
          expect(el.hasAttribute('aria-checked')).toBe(false);
          expect(el.hasAttribute('aria-expanded')).toBe(false);
          expect(el.hasAttribute('aria-disabled')).toBe(false);

          meter.destroy();
          expect(meter.current).toBeNull();
        });
      }));
  });
});
