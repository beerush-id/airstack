import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type MainProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Main - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Single Primary Content Boundary Invariant', () => {
    it('marks the primary content region on a generic host and stays silent on <main>', () =>
      scope.run(() => {
        component().run(() => {
          const native = aria('main', {}, { native: true });
          const nativeEl = bind(document.createElement('main'), native);
          document.body.appendChild(nativeEl);

          const custom = aria('main', {}, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(customEl.getAttribute('role')).toBe('main');
          expect(custom.attributes.role).toBe('main');

          const second = aria('main', {}, { native: false });
          const secondEl = bind(document.createElement('div'), second);
          document.body.appendChild(secondEl);
          expect(secondEl.getAttribute('role')).toBe('main');

          native.destroy();
          custom.destroy();
          second.destroy();
          nativeEl.remove();
          customEl.remove();
          secondEl.remove();
        });
      }));

    it('names the primary region when the page carries repeated content of the same kind', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MainProps>({});
          const main = aria('main', props, { native: true });
          const el = bind(document.createElement('main'), main);
          document.body.appendChild(el);

          expect(el.hasAttribute('aria-label')).toBe(false);

          props.label = 'Article body';
          expect(el.getAttribute('aria-label')).toBe('Article body');
          expect(el.hasAttribute('role')).toBe(false);

          props.label = undefined;
          props.labelledby = 'content-title';
          expect(el.hasAttribute('aria-label')).toBe(false);
          expect(el.getAttribute('aria-labelledby')).toBe('content-title');

          main.destroy();
          el.remove();
        });
      }));
  });

  describe('Document Scope & Host Parity Invariant', () => {
    it('takes no focus, no live semantics and no interaction on either host', () =>
      scope.run(() => {
        component().run(() => {
          const native = aria('main', {}, { native: true });
          const nativeEl = bind(document.createElement('main'), native);

          const custom = aria('main', { label: 'Content' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);

          document.body.append(nativeEl, customEl);

          for (const el of [nativeEl, customEl]) {
            expect(el.hasAttribute('tabindex')).toBe(false);
            expect(el.hasAttribute('aria-live')).toBe(false);
            expect(el.hasAttribute('aria-busy')).toBe(false);
            expect(el.hasAttribute('aria-valuenow')).toBe(false);

            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true,
            });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          const heading = document.createElement('h1');
          heading.textContent = 'Chapter one';
          customEl.appendChild(heading);
          expect(customEl.querySelectorAll('h1')).toHaveLength(1);

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));
  });
});
