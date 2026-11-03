import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { type AnnouncerProps, aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Announcer - Live Region Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Politeness Queue & Dispatch Arbitration Invariant', () => {
    it('announces advisory messages as one polite unit by default', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<AnnouncerProps>({});
          const announcer = aria('announcer', props);
          const el = bind(document.createElement('div'), announcer);
          document.body.appendChild(el);

          expect(el.getAttribute('role')).toBe('status');
          expect(el.getAttribute('aria-live')).toBe('polite');
          expect(el.getAttribute('aria-atomic')).toBe('true');
          expect(el.hasAttribute('aria-busy')).toBe(false);

          props.politeness = 'assertive';
          expect(el.getAttribute('role')).toBe('alert');
          expect(el.getAttribute('aria-live')).toBe('assertive');
          expect(el.getAttribute('aria-atomic')).toBe('true');
          expect(el.hasAttribute('tabindex')).toBe(false);

          // Turning a region off keeps it identified and stops the narration
          props.politeness = 'off';
          expect(el.getAttribute('aria-live')).toBe('off');
          expect(el.getAttribute('role')).toBe('status');

          announcer.destroy();
          el.remove();
        });
      }));

    it('lets a stream region announce only what is appended', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<AnnouncerProps>({ atomic: false, relevant: 'additions text' });
          const announcer = aria('announcer', props);
          const el = bind(document.createElement('div'), announcer);
          document.body.appendChild(el);

          expect(el.getAttribute('aria-live')).toBe('polite');
          expect(el.getAttribute('aria-atomic')).toBe('false');
          expect(el.getAttribute('aria-relevant')).toBe('additions text');

          props.relevant = undefined;
          expect(el.hasAttribute('aria-relevant')).toBe(false);

          announcer.destroy();
          el.remove();
        });
      }));

    it('marks the region busy across a batch without ever moving focus', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<AnnouncerProps>({ busy: false });
          const announcer = aria('announcer', props);
          const el = bind(document.createElement('div'), announcer);
          document.body.appendChild(el);

          const outside = document.createElement('button');
          document.body.appendChild(outside);
          outside.focus();

          props.busy = true;
          expect(el.getAttribute('aria-busy')).toBe('true');

          const entry = document.createElement('p');
          entry.textContent = 'Build finished';
          el.appendChild(entry);
          expect(document.activeElement).toBe(outside);

          props.busy = false;
          expect(el.getAttribute('aria-busy')).toBe('false');

          const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
          });
          el.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(outside);

          announcer.destroy();
          el.remove();
          outside.remove();
        });
      }));
  });

  describe('Teardown & DOM Detachment Invariant', () => {
    it('leaves the native output element carrying its own role', () =>
      scope.run(() => {
        component().run(() => {
          const native = aria('announcer', { politeness: 'polite' }, { native: true });
          const nativeEl = bind(document.createElement('output'), native);
          document.body.appendChild(nativeEl);

          expect(native.attributes.role).toBeUndefined();
          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(nativeEl.getAttribute('aria-live')).toBe('polite');
          expect(nativeEl.getAttribute('aria-atomic')).toBe('true');

          const custom = aria('announcer', { politeness: 'assertive' });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(customEl.getAttribute('role')).toBe('alert');
          expect(customEl.getAttribute('aria-live')).toBe('assertive');

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));

    it('stops rewriting the live attributes once the region is destroyed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<AnnouncerProps>({ politeness: 'polite', busy: false });
          const announcer = aria('announcer', props);
          const el = bind(document.createElement('div'), announcer);
          document.body.appendChild(el);

          expect(el.getAttribute('aria-live')).toBe('polite');
          expect(el.getAttribute('aria-busy')).toBe('false');

          announcer.destroy();
          expect(announcer.current).toBeNull();

          props.politeness = 'assertive';
          props.busy = true;
          expect(el.getAttribute('aria-live')).toBe('polite');
          // No rewrite after destroy: the declared idle value lingers, never flips to busy
          expect(el.getAttribute('aria-busy')).toBe('false');

          el.remove();
        });
      }));

    it('survives a detach-and-reattach cycle with the same announcement contract', () =>
      scope.run(() => {
        component().run(() => {
          const announcer = aria('announcer', { politeness: 'assertive', atomic: false });

          const first = bind(document.createElement('div'), announcer);
          document.body.appendChild(first);
          expect(first.getAttribute('role')).toBe('alert');
          expect(first.getAttribute('aria-live')).toBe('assertive');
          expect(first.getAttribute('aria-atomic')).toBe('false');

          announcer.ref(null);
          expect(announcer.current).toBeNull();

          const second = document.createElement('div');
          announcer.ref(second);
          document.body.appendChild(second);

          expect(announcer.current).toBe(second);
          expect(second.getAttribute('role')).toBe('alert');
          expect(second.getAttribute('aria-live')).toBe('assertive');
          expect(second.getAttribute('aria-atomic')).toBe('false');

          announcer.destroy();
          first.remove();
          second.remove();
        });
      }));
  });
});

describe('Attribute Shielding Contract', () => {
  const shieldScope = createLifecycle();

  afterAll(() => {
    shieldScope.destroy();
  });

  it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
    shieldScope.run(() => {
      component().run(() => {
        const announcer = aria('announcer', {
          politeness: 'assertive',
          atomic: true,
          busy: false,
          relevant: 'additions',
        });

        for (const key of ['politeness', 'atomic', 'busy', 'relevant', 'aria-live', 'role']) {
          expect(announcer.ownKeys).toContain(key);
        }

        announcer.destroy();
        expect(announcer.current).toBeNull();
      });
    }));
});
