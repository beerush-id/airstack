import { createLifecycle } from '@airlib/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aria, popover } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Popover - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    scope.destroy();
  });

  it('provides show(), close(), and toggle() methods on instance', () =>
    scope.run(() => {
      const p = popover();
      expect(p.open).toBe(false);

      p.show();
      expect(p.open).toBe(true);

      p.close();
      expect(p.open).toBe(false);

      p.toggle();
      expect(p.open).toBe(true);
      p.toggle();
      expect(p.open).toBe(false);
    }));

  it('compiles native HTML popover attributes when options.native is true', () =>
    scope.run(() => {
      const auto = popover({ dismissable: true }, { native: true });
      expect(auto.attributes.popover).toBe('auto');

      const el = document.createElement('div');
      auto.ref(el);
      expect(el.hidden).toBe(true);
      auto.destroy();

      const manual = popover({ dismissable: false }, { native: true });
      expect(manual.attributes.popover).toBe('manual');
    }));

  it('moves focus into panel when opened with focusable children or tabindex', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const host = aria('button');
        const hostEl = bind(document.createElement('button'), host);
        document.body.appendChild(hostEl);

        const pop = aria('popover');
        const popEl = document.createElement('div');
        const buttonChild = document.createElement('button');
        popEl.appendChild(buttonChild);
        document.body.appendChild(popEl);
        pop.ref(popEl);

        hostEl.click();
        expect(pop.open).toBe(true);
        expect(document.activeElement).toBe(buttonChild);

        pop.close();
        expect(pop.open).toBe(false);

        // Panel itself has tabindex without focusable children
        popEl.removeChild(buttonChild);
        popEl.tabIndex = 0;

        pop.open = true;
        expect(document.activeElement).toBe(popEl);

        pop.destroy();
        host.destroy();
        document.body.removeChild(hostEl);
        document.body.removeChild(popEl);
      });
    }));

  it('handles Escape and outside clicks cleanly when closed or not dismissable', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const host = aria('button');
        const hostEl = bind(document.createElement('button'), host);
        document.body.appendChild(hostEl);

        const pop = aria('popover', { open: false, dismissable: false });
        const popEl = document.createElement('div');
        document.body.appendChild(popEl);
        pop.ref(popEl);

        // Pressing Escape while closed does nothing
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
        expect(pop.open).toBe(false);

        // Pressing non-Escape while open does nothing
        pop.open = true;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true }));
        expect(pop.open).toBe(true);

        // Outside click while dismissable: false does not close
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
        expect(pop.open).toBe(true);

        pop.destroy();
        host.destroy();
        document.body.removeChild(hostEl);
        document.body.removeChild(popEl);
      });
    }));

  it('handles attachment and teardown with detached element lacking host', () =>
    scope.run(() => {
      const pop = aria('popover');
      const el = document.createElement('div');
      pop.ref(el);

      expect(pop.current).toBe(el);

      pop.destroy();
      expect(pop.current).toBeNull();
    }));

  it('initializes parent element aria-expanded to true when initially open', () =>
    scope.run(() => {
      const parent = document.createElement('button');
      const popEl = document.createElement('div');
      parent.appendChild(popEl);
      document.body.appendChild(parent);

      const pop = aria('popover', { open: true });
      pop.ref(popEl);

      expect(parent.getAttribute('aria-expanded')).toBe('true');

      pop.destroy();
      document.body.removeChild(parent);
    }));

  it('ignores clicks on host element when default is prevented', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const host = aria('button');
        const hostEl = bind(document.createElement('button'), host);
        document.body.appendChild(hostEl);

        const pop = aria('popover', { open: false });
        const popEl = document.createElement('div');
        document.body.appendChild(popEl);
        pop.ref(popEl);

        hostEl.addEventListener('click', (e) => e.preventDefault(), { capture: true });
        hostEl.click();

        expect(pop.open).toBe(false);

        pop.destroy();
        host.destroy();
        document.body.removeChild(hostEl);
        document.body.removeChild(popEl);
      });
    }));

  it('ignores clicks on parent element fallback when default is prevented', () =>
    scope.run(() => {
      const parent = document.createElement('button');
      const popEl = document.createElement('div');
      parent.appendChild(popEl);
      document.body.appendChild(parent);

      const pop = aria('popover', { open: false });
      pop.ref(popEl);

      parent.addEventListener('click', (e) => e.preventDefault(), { capture: true });
      parent.click();

      expect(pop.open).toBe(false);

      pop.destroy();
      document.body.removeChild(parent);
    }));

  it('does not toggle popover when click bubbles from inside the panel to scoped host', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const host = aria('button');
        const hostEl = bind(document.createElement('button'), host);
        document.body.appendChild(hostEl);

        const pop = aria('popover', { open: true });
        const popEl = document.createElement('div');
        const inside = document.createElement('span');
        popEl.appendChild(inside);
        hostEl.appendChild(popEl);
        pop.ref(popEl);

        inside.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(pop.open).toBe(true);

        pop.destroy();
        host.destroy();
        document.body.removeChild(hostEl);
      });
    }));

  it('does not toggle popover when click bubbles from inside panel in parent fallback', () =>
    scope.run(() => {
      const parent = document.createElement('button');
      const popEl = document.createElement('div');
      const inside = document.createElement('span');
      popEl.appendChild(inside);
      parent.appendChild(popEl);
      document.body.appendChild(parent);

      const pop = aria('popover', { open: true });
      pop.ref(popEl);

      inside.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(pop.open).toBe(true);

      pop.destroy();
      document.body.removeChild(parent);
    }));

  it('compiles data-popover-x and data-popover-y attributes when xDir and yDir are provided', () =>
    scope.run(() => {
      const pop = popover({ xDir: 'left', yDir: 'below' });
      expect(pop.attributes['data-popover-x']).toBe('left');
      expect(pop.attributes['data-popover-y']).toBe('below');
    }));

  it('supports delay getter and setter, and immediate open via scheduleOpen when delay is 0', () =>
    scope.run(() => {
      const pop = popover();
      expect(pop.delay).toBe(0);
      pop.delay = 100;
      expect(pop.delay).toBe(100);

      pop.delay = 0;
      pop.scheduleOpen();
      expect(pop.open).toBe(true);
      pop.destroy();
    }));

  it('supports hover and focus trigger modes on Popover', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const host = aria('button');
        const hostEl = bind(document.createElement('button'), host);
        document.body.appendChild(hostEl);

        const pop = aria('popover', { mode: ['hover', 'focus'], delay: 100 });
        const popEl = document.createElement('div');
        document.body.appendChild(popEl);
        pop.ref(popEl);

        // Hover opens after delay
        hostEl.dispatchEvent(new Event('pointerenter'));
        expect(pop.open).toBe(false);
        vi.advanceTimersByTime(100);
        expect(pop.open).toBe(true);

        // Pointer leave to outside closes
        hostEl.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
        expect(pop.open).toBe(false);

        // Focus opens immediately
        hostEl.focus();
        expect(pop.open).toBe(true);

        // Blur closes
        hostEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(pop.open).toBe(false);

        pop.destroy();
        host.destroy();
        document.body.removeChild(hostEl);
        document.body.removeChild(popEl);
      });
    }));

  it('supports hover and focus trigger modes on fallback host', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parent = document.createElement('button');
        const popEl = document.createElement('div');
        parent.appendChild(popEl);
        document.body.appendChild(parent);

        const pop = aria('popover', { mode: ['hover', 'focus'], delay: 50 });
        pop.ref(popEl);

        // Hover on parent
        parent.dispatchEvent(new Event('pointerenter'));
        expect(pop.open).toBe(false);
        vi.advanceTimersByTime(50);
        expect(pop.open).toBe(true);

        // Leave parent
        parent.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
        expect(pop.open).toBe(false);

        // Focus parent
        parent.focus();
        expect(pop.open).toBe(true);

        parent.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(pop.open).toBe(false);

        pop.destroy();
        document.body.removeChild(parent);
      });
    }));
});
