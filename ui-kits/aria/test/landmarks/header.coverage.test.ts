import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type HeaderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Header - Coverage (name projections & teardown)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Accessible Name Projection Contract', () => {
    it('reads an unnamed landmark as unnamed on every projection', () =>
      scope.run(() => {
        component().run(() => {
          const header = aria('header');

          expect(header.label).toBeUndefined();
          expect(header.labelledby).toBeUndefined();
          expect(header.named).toBe(false);
          expect(header.attributes['aria-label']).toBeUndefined();
          expect(header.attributes['aria-labelledby']).toBeUndefined();

          header.destroy();
          expect(header.current).toBeNull();
        });
      }));

    it('tracks a string name and a reference name through the same projections', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<HeaderProps>({ label: 'Site identity' });
          const header = aria('header', props);

          expect(header.label).toBe('Site identity');
          expect(header.labelledby).toBeUndefined();
          expect(header.named).toBe(true);

          props.label = undefined;
          expect(header.label).toBeUndefined();
          expect(header.named).toBe(false);

          props.labelledby = 'site-title';
          expect(header.labelledby).toBe('site-title');
          expect(header.named).toBe(true);

          props.label = 'Fallback name';
          expect(header.named).toBe(true);
          expect(header.attributes['aria-label']).toBe('Fallback name');
          expect(header.attributes['aria-labelledby']).toBe('site-title');

          header.destroy();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('stops projecting the accessible name to a detached element after destroy', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<HeaderProps>({ label: 'Primary' });
          const header = aria('header', props);
          const el = bind(document.createElement('div'), header);
          document.body.appendChild(el);

          expect(header.current).toBe(el);
          expect(el.getAttribute('role')).toBe('banner');
          expect(el.getAttribute('aria-label')).toBe('Primary');

          header.destroy();
          expect(header.current).toBeNull();

          props.label = 'Renamed';
          expect(el.getAttribute('aria-label')).toBe('Primary');

          el.remove();
        });
      }));
  });
});
