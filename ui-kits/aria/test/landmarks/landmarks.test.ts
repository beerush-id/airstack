import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

const MAPPING = [
  { role: 'header', nativeTag: 'header', landmark: 'banner' },
  { role: 'footer', nativeTag: 'footer', landmark: 'contentinfo' },
  { role: 'main', nativeTag: 'main', landmark: 'main' },
  { role: 'navigation', nativeTag: 'nav', landmark: 'navigation' },
  { role: 'sidebar', nativeTag: 'aside', landmark: 'complementary' },
  { role: 'search', nativeTag: 'search', landmark: 'search' },
] as const;

describe('Landmarks - Registry & Boundary Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Landmark Registry & Uniqueness Invariant', () => {
    it('omits the role on the matching native tag and compiles it on a generic host', () =>
      scope.run(() => {
        for (const { role, nativeTag, landmark } of MAPPING) {
          component().run(() => {
            const native = aria(role, {}, { native: true });
            const nativeEl = bind(document.createElement(nativeTag), native);
            document.body.appendChild(nativeEl);

            const custom = aria(role, {}, { native: false });
            const customEl = bind(document.createElement('div'), custom);
            document.body.appendChild(customEl);

            expect(native.attributes.role).toBeUndefined();
            expect(nativeEl.hasAttribute('role')).toBe(false);

            expect(custom.attributes.role).toBe(landmark);
            expect(customEl.getAttribute('role')).toBe(landmark);

            native.destroy();
            custom.destroy();
            nativeEl.remove();
            customEl.remove();
          });
        }
      }));

    it('names the two conditional landmarks only once they carry an accessible name', () =>
      scope.run(() => {
        component().run(() => {
          const unnamedSection = aria('section');
          const unnamedSectionEl = bind(document.createElement('section'), unnamedSection);
          document.body.appendChild(unnamedSectionEl);

          const unnamedForm = aria('form');
          const unnamedFormEl = bind(document.createElement('form'), unnamedForm);
          document.body.appendChild(unnamedFormEl);

          expect(unnamedSection.attributes.role).toBeUndefined();
          expect(unnamedForm.attributes.role).toBeUndefined();
          expect(unnamedSectionEl.hasAttribute('role')).toBe(false);
          expect(unnamedFormEl.hasAttribute('role')).toBe(false);

          const namedSection = aria('section', { label: 'Shipping details' });
          const namedSectionEl = bind(document.createElement('section'), namedSection);
          document.body.appendChild(namedSectionEl);

          const namedForm = aria('form', { label: 'Checkout' });
          const namedFormEl = bind(document.createElement('form'), namedForm);
          document.body.appendChild(namedFormEl);

          expect(namedSection.attributes.role).toBe('region');
          expect(namedSectionEl.getAttribute('role')).toBe('region');
          expect(namedForm.attributes.role).toBe('form');
          expect(namedFormEl.getAttribute('role')).toBe('form');

          unnamedSection.destroy();
          unnamedForm.destroy();
          namedSection.destroy();
          namedForm.destroy();
          unnamedSectionEl.remove();
          unnamedFormEl.remove();
          namedSectionEl.remove();
          namedFormEl.remove();
        });
      }));

    it('declares no registry: a second instance of a unique landmark is compiled unchanged', () =>
      scope.run(() => {
        component().run(() => {
          const first = aria('main');
          const firstEl = bind(document.createElement('div'), first);

          const second = aria('main');
          const secondEl = bind(document.createElement('div'), second);

          document.body.append(firstEl, secondEl);

          expect(firstEl.getAttribute('role')).toBe('main');
          expect(secondEl.getAttribute('role')).toBe('main');

          const firstBanner = aria('header', {}, { native: false });
          const secondBanner = aria('header', {}, { native: false });
          expect(firstBanner.attributes.role).toBe('banner');
          expect(secondBanner.attributes.role).toBe('banner');

          first.destroy();
          second.destroy();
          firstBanner.destroy();
          secondBanner.destroy();
          firstEl.remove();
          secondEl.remove();
        });
      }));
  });

  describe('Primary Navigation & Complementary Boundary Invariant', () => {
    it('treats navigation and complementary as distinct roles that both need names when repeated', () =>
      scope.run(() => {
        component().run(() => {
          const primary = aria('navigation', {}, { native: false });
          const primaryEl = bind(document.createElement('div'), primary);

          const aside = aria('sidebar');
          const asideEl = bind(document.createElement('div'), aside);

          document.body.append(primaryEl, asideEl);

          expect(primaryEl.getAttribute('role')).toBe('navigation');
          expect(asideEl.getAttribute('role')).toBe('complementary');
          expect(primaryEl.hasAttribute('aria-label')).toBe(false);
          expect(asideEl.hasAttribute('aria-label')).toBe(false);

          primary.assign({ label: 'Primary' });
          aside.assign({ label: 'Related links' });
          expect(primaryEl.getAttribute('aria-label')).toBe('Primary');
          expect(asideEl.getAttribute('aria-label')).toBe('Related links');

          primary.destroy();
          aside.destroy();
          primaryEl.remove();
          asideEl.remove();
        });
      }));

    it('keeps a nested aside out of the complementary role while the generic host stays explicit', () =>
      scope.run(() => {
        component().run(() => {
          const article = document.createElement('article');
          document.body.appendChild(article);

          const nestedNative = aria('sidebar', {}, { native: true });
          const nestedNativeEl = bind(document.createElement('aside'), nestedNative);
          article.appendChild(nestedNativeEl);

          const nestedCustom = aria('sidebar', {}, { native: false });
          const nestedCustomEl = bind(document.createElement('div'), nestedCustom);
          article.appendChild(nestedCustomEl);

          expect(nestedNativeEl.hasAttribute('role')).toBe(false);

          expect(nestedCustomEl.getAttribute('role')).toBe('complementary');

          nestedNative.destroy();
          nestedCustom.destroy();
          article.remove();
        });
      }));
  });

  describe('Consumed Input Ownership Invariant', () => {
    it('owns the naming inputs so a wrapper omits only the keys it consumes itself', () =>
      scope.run(() => {
        component().run(() => {
          const header = aria('header', {
            label: 'Site header',
            labelledby: 'site-title',
            className: 'site-header',
          });

          expect(header.ownKeys).toContain('label');
          expect(header.ownKeys).toContain('labelledby');
          expect(header.ownKeys).toContain('aria-label');
          expect(header.ownKeys).toContain('aria-labelledby');

          const rest = header.restProps(['children']);
          expect(rest.label).toBeUndefined();
          expect(rest.labelledby).toBeUndefined();
          expect(rest.className).toBe('site-header');

          header.destroy();
        });
      }));

    it('owns the naming inputs on the conditional landmarks too', () =>
      scope.run(() => {
        component().run(() => {
          const form = aria('form', { label: 'Checkout' });
          const section = aria('section', { labelledby: 'pricing-heading' });

          expect(form.ownKeys).toContain('label');
          expect(form.ownKeys).toContain('labelledby');
          expect(section.ownKeys).toContain('label');
          expect(section.ownKeys).toContain('labelledby');

          expect(form.restProps(['children']).label).toBeUndefined();
          expect(section.restProps(['children']).labelledby).toBeUndefined();

          form.destroy();
          section.destroy();
        });
      }));
  });
});
