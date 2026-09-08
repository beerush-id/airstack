import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type ButtonProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Button - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Action Trigger Contract', () => {
    it('follows SSR -> Mount -> Interaction lifecycle for standard action buttons', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. SSR Phase: native button defaults to type="button", disabled=false
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBeUndefined();
          expect(btn.attributes.type).toBe('button');
          expect(btn.attributes.tabindex).toBeUndefined();
          expect(btn.attributes.disabled).toBe(false);
          expect(btn.attributes['aria-disabled']).toBeUndefined();
          expect(btn.attributes['aria-pressed']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('tabindex')).toBeNull();
          expect(el.getAttribute('aria-pressed')).toBeNull();

          // 3. Interaction Phase: forwards click events
          const clickSpy = vi.fn();
          el.addEventListener('click', clickSpy);
          el.click();
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));
  });

  describe('Disabled State Contract', () => {
    it('follows SSR -> Mount -> Interaction lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button', { disabled: true });

          // 1. SSR Phase
          expect(btn.current).toBeNull();
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.disabled).toBe(true);
          expect(btn.attributes.type).toBe('button');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.disabled).toBe(true);
        });
      }));
  });

  describe('Native Form Equivalence Contract', () => {
    it('submits enclosing form via requestSubmit when non-native submit button is clicked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const submitSpy = vi.fn();
          form.requestSubmit = submitSpy;
          document.body.appendChild(form);

          const btn = aria<HTMLDivElement>('button', { type: 'submit' }, { native: false });

          // 1. SSR Phase: preserves submit type
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('submit');

          // 2. Mount Phase: mounts inside form
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click calls form.requestSubmit()
          div.click();
          expect(submitSpy).toHaveBeenCalledTimes(1);

          document.body.removeChild(form);
        });
      }));

    it('resets enclosing form when non-native reset button is clicked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const resetSpy = vi.fn();
          form.reset = resetSpy;
          document.body.appendChild(form);

          const btn = aria<HTMLDivElement>('button', { type: 'reset' }, { native: false });

          // 1. SSR Phase: preserves reset type
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('reset');

          // 2. Mount Phase: mounts inside form
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click calls form.reset()
          div.click();
          expect(resetSpy).toHaveBeenCalledTimes(1);

          document.body.removeChild(form);
        });
      }));
  });

  describe('Keyboard Activation Contract', () => {
    it('activates non-native element on Enter keydown and prevents default navigation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. SSR Phase: attributes omit event handlers
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);
          const clickSpy = vi.fn();
          div.addEventListener('click', clickSpy);

          // 3. Interaction Phase
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          div.dispatchEvent(enterDown);

          expect(enterDown.defaultPrevented).toBe(true);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('prevents default scroll on Space keydown and activates on Space keyup for non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. SSR Phase
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);
          const clickSpy = vi.fn();
          div.addEventListener('click', clickSpy);

          // 3. Interaction Phase
          // Space keydown: suppresses scroll without clicking
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(clickSpy).not.toHaveBeenCalled();

          // Space keyup: activates via click
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceUp);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('delegates keyboard navigation directly to the browser for native <button> elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. SSR Phase
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const button = bind(document.createElement('button'), btn);
          expect(btn.isNative).toBe(true);
          expect(btn.current).toBe(button);

          // 3. Interaction Phase: native buttons leave defaultPrevented to false
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          button.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);

          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          button.dispatchEvent(enterDown);
          expect(enterDown.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Accessibility Semantics Contract', () => {
    it('applies standard ARIA role, tabindex, and disabled states across native and custom elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBtn = aria('button');
          const buttonEl = bind(document.createElement('button'), nativeBtn);

          expect(buttonEl.getAttribute('role')).toBeNull();
          expect(buttonEl.getAttribute('tabindex')).toBeNull();
          expect(buttonEl.disabled).toBe(false);

          const customBtn = aria<HTMLDivElement>('button', {}, { native: false });
          const divEl = bind(document.createElement('div'), customBtn);

          expect(divEl.getAttribute('role')).toBe('button');
          expect(divEl.getAttribute('tabindex')).toBe('0');
          expect(divEl.getAttribute('aria-disabled')).toBe('false');
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('cleans up element bindings on destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ButtonProps>({ disabled: false });
          const btn = aria('button', props);
          const button = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(button);

          // Destruction releases element reference
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('detaches cleanly on ref(null)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');
          const el = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(el);
          btn.ref(null);
          expect(btn.current).toBeNull();
        });
      }));
  });
});
