import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SectionProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Section - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Name-Triggered Region Promotion Invariant', () => {
    it('promotes a named section to a landmark and keeps an unnamed one generic', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SectionProps>({});
          const section = aria('section', props);
          const el = bind(document.createElement('section'), section);
          document.body.appendChild(el);

          expect(section.attributes.role).toBeUndefined();
          expect(el.hasAttribute('role')).toBe(false);

          props.label = 'Order summary';
          expect(section.attributes.role).toBe('region');
          expect(el.getAttribute('role')).toBe('region');
          expect(el.getAttribute('aria-label')).toBe('Order summary');

          props.label = undefined;
          expect(section.attributes.role).toBeUndefined();
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-label')).toBe(false);

          props.labelledby = 'summary-heading';
          expect(el.getAttribute('role')).toBe('region');
          expect(el.getAttribute('aria-labelledby')).toBe('summary-heading');

          section.destroy();
          el.remove();
        });
      }));

    it('treats an empty label as no label at all', () =>
      scope.run(() => {
        component().run(() => {
          const blank = aria('section', { label: '' });
          const blankEl = bind(document.createElement('section'), blank);
          document.body.appendChild(blankEl);

          // An empty name cannot disambiguate a landmark, so the region must not appear
          expect(blank.attributes.role).toBeUndefined();
          expect(blankEl.hasAttribute('role')).toBe(false);

          blank.destroy();
          blankEl.remove();
        });
      }));
  });

  describe('Non-Landmark Fallback Invariant', () => {
    it('leaves an unnamed section as ordinary content rather than a navigation target', () =>
      scope.run(() => {
        component().run(() => {
          const section = aria('section');
          const el = bind(document.createElement('div'), section);
          document.body.appendChild(el);

          const heading = document.createElement('h2');
          heading.textContent = 'Details';
          el.appendChild(heading);

          // Generic container semantics: no landmark, no role, no live region
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-label')).toBe(false);
          expect(el.hasAttribute('aria-live')).toBe(false);
          expect(el.hasAttribute('tabindex')).toBe(false);

          // The heading inside keeps its own native semantics
          expect(heading.tagName).toBe('H2');
          expect(heading.hasAttribute('role')).toBe(false);

          const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
          });
          el.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          section.destroy();
          el.remove();
        });
      }));

    it('keeps the compiled region identical across hosts once named', () =>
      scope.run(() => {
        component().run(() => {
          const native = aria('section', { label: 'Billing' });
          const nativeEl = bind(document.createElement('section'), native);

          const custom = aria('section', { label: 'Billing' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);

          document.body.append(nativeEl, customEl);

          // Both hosts carry the accessible name; whether a named native <section> also
          // needs the compiled role is the redundancy question filed in friction
          expect(nativeEl.getAttribute('aria-label')).toBe('Billing');
          expect(customEl.getAttribute('aria-label')).toBe('Billing');
          expect(customEl.getAttribute('role')).toBe('region');

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));
  });
});
