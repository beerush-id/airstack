import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type AlertProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Alert - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Live Announcement Politeness Invariant', () => {
    it('announces assertively by default, interrupting speech with an atomic region', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const alert = aria('alert', { message: 'Payment failed' });

          // 1. Creation & SSR: the region contract compiles before any DOM exists
          expect(alert.current).toBeNull();
          expect(alert.attributes.role).toBe('alert');
          expect(alert.attributes['aria-live']).toBe('assertive');
          expect(alert.attributes['aria-atomic']).toBe('true');

          // 2. DOM Binding
          const el = bind(document.createElement('div'), alert);
          expect(alert.current).toBe(el);
          expect(el.getAttribute('role')).toBe('alert');
          expect(el.getAttribute('aria-live')).toBe('assertive');
          expect(el.getAttribute('aria-atomic')).toBe('true');

          // 6. Teardown
          alert.destroy();
          expect(alert.current).toBeNull();
        });
      }));

    it('compiles a polite status region instead of an alert when urgency is lowered', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const alert = aria('alert', { politeness: 'polite', message: 'Draft saved' });

          // 1. Creation & SSR
          expect(alert.attributes.role).toBe('status');
          expect(alert.attributes['aria-live']).toBe('polite');
          expect(alert.attributes['aria-atomic']).toBe('true');

          // 2. DOM Binding
          const el = bind(document.createElement('p'), alert);
          expect(el.getAttribute('role')).toBe('status');
          expect(el.getAttribute('aria-live')).toBe('polite');

          // 6. Teardown
          alert.destroy();
          expect(alert.current).toBeNull();
        });
      }));

    it('swaps the announced role in place when politeness changes on a live region', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<AlertProps>({ message: 'Upload started' });
          const alert = aria('alert', props);
          const el = bind(document.createElement('div'), alert);

          expect(el.getAttribute('role')).toBe('alert');

          // 3/5. The role and the live politeness move together; one region, never two
          props.politeness = 'polite';
          expect(el.getAttribute('role')).toBe('status');
          expect(el.getAttribute('aria-live')).toBe('polite');
          expect(el.getAttribute('aria-atomic')).toBe('true');
          expect(el.getAttributeNames().filter((name) => name.startsWith('aria-live'))).toEqual([
            'aria-live',
          ]);

          props.politeness = 'assertive';
          expect(el.getAttribute('role')).toBe('alert');
          expect(el.getAttribute('aria-live')).toBe('assertive');

          // 6. Teardown
          alert.destroy();
          expect(alert.current).toBeNull();
        });
      }));
  });

  describe('Non-Interactive Semantic Invariant', () => {
    it('takes no tab stop, claims no keystroke, and never moves focus', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const holder = document.createElement('div');
          const field = document.createElement('input');
          holder.appendChild(field);
          document.body.appendChild(holder);
          field.focus();
          expect(document.activeElement).toBe(field);

          const alert = aria('alert', { message: 'Session expired' });

          // 1. Creation & SSR: an announcement is not a control
          expect(alert.attributes.tabindex).toBeUndefined();
          expect(alert.attributes.role).toBe('alert');

          // 2. DOM Binding inside the focused document
          const el = document.createElement('div');
          holder.appendChild(el);
          alert.ref(el);
          expect(alert.current).toBe(el);

          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(document.activeElement).toBe(field);

          // 3/4. Stimuli are neither claimed nor answered
          for (const key of ['Enter', 'Escape', 'ArrowDown']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);

          // A new message never steals the caret
          alert.assign({ message: 'Session expired again' });
          expect(document.activeElement).toBe(field);
          expect(el.hasAttribute('tabindex')).toBe(false);

          alert.destroy();
          document.body.removeChild(holder);
          expect(alert.current).toBeNull();
        });
      }));

    it('announces through live-region metadata only and exposes no control state', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const alert = aria('alert', { politeness: 'polite' });
          const el = bind(document.createElement('div'), alert);

          expect(el.getAttribute('role')).toBe('status');
          expect(el.getAttribute('aria-live')).toBe('polite');
          expect(el.getAttribute('aria-atomic')).toBe('true');

          // Nothing an assistive technology could mistake for an actionable widget
          for (const key of [
            'tabindex',
            'disabled',
            'aria-disabled',
            'aria-pressed',
            'aria-checked',
            'aria-expanded',
            'aria-controls',
            'aria-activedescendant',
          ]) {
            expect(alert.attributes[key]).toBeUndefined();
            expect(el.hasAttribute(key)).toBe(false);
          }

          alert.destroy();
          expect(alert.current).toBeNull();
        });
      }));
  });

  describe('Teardown & Buffer Clearing Invariant', () => {
    it('stops projecting announcements to the node once destroyed and leaves no live region behind', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<AlertProps>({ message: 'First' });
          const alert = aria('alert', props);
          const el = bind(document.createElement('div'), alert);

          expect(el.getAttribute('role')).toBe('alert');

          alert.destroy();
          expect(alert.current).toBeNull();

          // Mutations after disposal cause zero DOM side effects
          props.message = 'Second';
          props.politeness = 'polite';
          expect(el.getAttribute('role')).toBe('alert');
          expect(el.getAttribute('aria-live')).toBe('assertive');

          alert.destroy();
        });
      }));

    it('reattaches cleanly after a ref(null) detach without duplicating the region', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const container = document.createElement('div');
          document.body.appendChild(container);

          const first = document.createElement('div');
          container.appendChild(first);

          const alert = aria('alert', { message: 'Retried' });
          alert.ref(first);
          expect(alert.current).toBe(first);
          expect(container.querySelectorAll('[aria-live]').length).toBe(1);

          // Framework unmount
          alert.ref(null);
          expect(alert.current).toBeNull();

          // Remount on a replacement node: the region follows the controller, not the old node
          const second = document.createElement('div');
          container.appendChild(second);
          alert.ref(second);

          expect(alert.current).toBe(second);
          expect(second.getAttribute('aria-live')).toBe('assertive');
          expect(second.getAttribute('role')).toBe('alert');

          alert.destroy();
          document.body.removeChild(container);
          expect(alert.current).toBeNull();
        });
      }));
  });
});
