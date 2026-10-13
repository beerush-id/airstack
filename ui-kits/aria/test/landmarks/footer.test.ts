import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FooterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Footer - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Landmark Scoping & Contentinfo Invariant', () => {
    it('names the document footer as a contentinfo landmark for assistive technology', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FooterProps>({});
          const footer = aria('footer', props, { native: true });
          const el = bind(document.createElement('footer'), footer);
          document.body.appendChild(el);

          expect(footer.attributes.role).toBeUndefined();
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-label')).toBe(false);

          props.label = 'Site information';
          expect(el.getAttribute('aria-label')).toBe('Site information');

          props.label = undefined;
          expect(el.hasAttribute('aria-label')).toBe(false);

          footer.destroy();
          el.remove();
        });
      }));

    it('carries the landmark through a labelledby reference instead of a string', () =>
      scope.run(() => {
        component().run(() => {
          const heading = document.createElement('h2');
          heading.id = 'footer-heading';
          heading.textContent = 'Contact and legal';
          document.body.appendChild(heading);

          const footer = aria('footer', { labelledby: 'footer-heading' }, { native: true });
          const el = bind(document.createElement('footer'), footer);
          document.body.appendChild(el);

          expect(footer.attributes['aria-labelledby']).toBe('footer-heading');
          expect(el.getAttribute('aria-labelledby')).toBe('footer-heading');
          expect(el.hasAttribute('aria-label')).toBe(false);
          expect(document.getElementById('footer-heading')).toBe(heading);

          footer.destroy();
          el.remove();
          heading.remove();
        });
      }));
  });

  describe('Native vs Custom Host Parity Invariant', () => {
    it('compiles the role only where the element cannot carry it', () =>
      scope.run(() => {
        component().run(() => {
          const native = aria('footer', {}, { native: true });
          const nativeEl = bind(document.createElement('footer'), native);
          document.body.appendChild(nativeEl);

          const custom = aria('footer', {}, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(custom.attributes.role).toBe('contentinfo');
          expect(customEl.getAttribute('role')).toBe('contentinfo');
          expect(nativeEl.hasAttribute('role')).toBe(false);

          for (const el of [nativeEl, customEl]) {
            expect(el.hasAttribute('tabindex')).toBe(false);
            expect(el.hasAttribute('aria-live')).toBe(false);

            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true,
            });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));
  });
});
