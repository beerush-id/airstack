import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SidebarProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Sidebar - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Complementary Landmark Scoping Invariant', () => {
    it('lets the native aside carry the role and compiles it for a generic host', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SidebarProps>({ label: 'Related articles' });
          const native = aria('sidebar', props);
          const nativeEl = bind(document.createElement('aside'), native);
          document.body.appendChild(nativeEl);

          const custom = aria('sidebar', { label: 'Related articles' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(native.attributes.role).toBeUndefined();
          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(custom.attributes.role).toBe('complementary');
          expect(customEl.getAttribute('role')).toBe('complementary');
          expect(customEl.getAttribute('aria-label')).toBe('Related articles');

          props.label = undefined;
          expect(nativeEl.hasAttribute('aria-label')).toBe(false);

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));

    it('distinguishes two complementary regions by name rather than by position', () =>
      scope.run(() => {
        component().run(() => {
          const first = aria('sidebar');
          const firstEl = bind(document.createElement('div'), first);

          const second = aria('sidebar');
          const secondEl = bind(document.createElement('div'), second);

          document.body.append(firstEl, secondEl);

          expect(firstEl.getAttribute('role')).toBe('complementary');
          expect(secondEl.getAttribute('role')).toBe('complementary');
          expect(firstEl.hasAttribute('aria-label')).toBe(false);

          first.assign({ label: 'On this page' });
          second.assign({ label: 'Related links' });
          expect(firstEl.getAttribute('aria-label')).toBe('On this page');
          expect(secondEl.getAttribute('aria-label')).toBe('Related links');

          first.destroy();
          second.destroy();
          firstEl.remove();
          secondEl.remove();
        });
      }));
  });

  describe('Secondary Document Association Invariant', () => {
    it('associates with the main content without owning or hiding it', () =>
      scope.run(() => {
        component().run(() => {
          const main = aria('main');
          const mainEl = bind(document.createElement('main'), main);

          const sidebar = aria('sidebar', { label: 'Context' });
          const sidebarEl = bind(document.createElement('aside'), sidebar);

          document.body.append(mainEl, sidebarEl);

          const article = document.createElement('p');
          article.textContent = 'The document body';
          mainEl.appendChild(article);

          const note = document.createElement('p');
          note.textContent = 'A supporting note';
          sidebarEl.appendChild(note);

          // The sidebar points nowhere: association is by role, not by reference
          expect(sidebarEl.hasAttribute('aria-controls')).toBe(false);
          expect(sidebarEl.hasAttribute('aria-labelledby')).toBe(false);
          expect(sidebarEl.getAttribute('aria-label')).toBe('Context');

          // Content in main is untouched by the complementary region
          expect(mainEl.contains(article)).toBe(true);
          expect(sidebarEl.contains(article)).toBe(false);
          expect(mainEl.hasAttribute('aria-hidden')).toBe(false);
          expect(article.hasAttribute('aria-hidden')).toBe(false);

          main.destroy();
          sidebar.destroy();
          mainEl.remove();
          sidebarEl.remove();
        });
      }));

    it('takes no focus, no live semantics and no interaction state on either host', () =>
      scope.run(() => {
        component().run(() => {
          const custom = aria('sidebar', { label: 'Tools' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(customEl.hasAttribute('tabindex')).toBe(false);
          expect(customEl.hasAttribute('aria-live')).toBe(false);
          expect(customEl.hasAttribute('aria-expanded')).toBe(false);
          expect(customEl.hasAttribute('aria-orientation')).toBe(false);

          const event = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          customEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          const click = new MouseEvent('click', { bubbles: true, cancelable: true });
          customEl.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);

          custom.destroy();
          customEl.remove();
        });
      }));
  });
});
