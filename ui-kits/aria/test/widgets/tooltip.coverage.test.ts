import { createLifecycle } from '@airlib/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aria, tooltip, TooltipAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Tooltip Widget (Coverage & Edge Cases)', () => {
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

  it('exposes tooltip factory function and instantiates correctly', () => {
    const tip = tooltip({ id: 'custom-tip', open: true, delay: 500 });
    expect(tip).toBeInstanceOf(TooltipAria);
    expect(tip.id).toBe('custom-tip');
    expect(tip.open).toBe(true);
    expect(tip.delay).toBe(500);
    tip.destroy();
  });

  it('supports delay getter and setter with fallback to default 300ms', () => {
    const tip = new TooltipAria();
    expect(tip.delay).toBe(300);
    tip.delay = 150;
    expect(tip.delay).toBe(150);
    tip.destroy();
  });

  it('supports open getter, setter, and toggle method', () => {
    const tip = new TooltipAria();
    expect(tip.open).toBe(false);

    tip.toggle();
    expect(tip.open).toBe(true);

    tip.toggle();
    expect(tip.open).toBe(false);

    tip.open = true;
    expect(tip.open).toBe(true);

    tip.close();
    expect(tip.open).toBe(false);

    tip.show();
    expect(tip.open).toBe(true);

    tip.destroy();
  });

  it('compiles data-tooltip-x and data-tooltip-y attributes when provided', () => {
    const tip = new TooltipAria({
      open: true,
      xDir: 'after',
      yDir: 'top',
    });

    expect(tip.attributes['data-tooltip-x']).toBe('after');
    expect(tip.attributes['data-tooltip-y']).toBe('top');
    expect(tip.attributes.style).toEqual({
      positionAnchor: `--tooltip-anchor-${tip.id}`,
    });

    tip.destroy();
  });

  it('handles cancelOpen safely when no timer is active', () => {
    const tip = new TooltipAria();
    tip.cancelOpen();
    tip.destroy();
  });

  it('handles escape and pointerleave on candidate trigger', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button');
        const btnEl = document.createElement('button');
        document.body.appendChild(btnEl);
        bind(btnEl, btn);

        const tip = aria('tooltip', { delay: 100 });
        const tipEl = document.createElement('div');
        document.body.appendChild(tipEl);
        bind(tipEl, tip);

        // Escape when closed does nothing
        const nonEscape = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        btnEl.dispatchEvent(nonEscape);
        expect(tip.open).toBe(false);

        const escapeClosed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
        btnEl.dispatchEvent(escapeClosed);
        expect(tip.open).toBe(false);

        // Open via focus
        btnEl.focus();
        expect(tip.open).toBe(true);

        // Pointerleave from btn to tipEl does not close
        const toPanel = new PointerEvent('pointerleave', { relatedTarget: tipEl });
        btnEl.dispatchEvent(toPanel);
        expect(tip.open).toBe(true);

        // Pointerleave to outside closes
        const toOutside = new PointerEvent('pointerleave', { relatedTarget: document.body });
        btnEl.dispatchEvent(toOutside);
        expect(tip.open).toBe(false);

        // Open via pointerenter
        btnEl.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(100);
        expect(tip.open).toBe(true);

        // Escape when open closes
        const escapeOpen = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
        btnEl.dispatchEvent(escapeOpen);
        expect(tip.open).toBe(false);

        tip.destroy();
        btn.destroy();
        document.body.removeChild(btnEl);
        document.body.removeChild(tipEl);
      });
    }));

  it('handles pointer events and escape keydown across trigger and panel', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button');
        const btnEl = document.createElement('button');
        document.body.appendChild(btnEl);
        bind(btnEl, btn);

        const tip = aria('tooltip', { delay: 200 });
        const tipEl = document.createElement('div');
        document.body.appendChild(tipEl);
        bind(tipEl, tip);

        // 1. Leaving trigger before delay cancels pending open
        btnEl.dispatchEvent(new PointerEvent('pointerenter'));
        btnEl.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
        vi.advanceTimersByTime(300);
        expect(tip.open).toBe(false);

        // 2. Hovering trigger opens tooltip after delay
        btnEl.dispatchEvent(new PointerEvent('pointerenter'));
        vi.advanceTimersByTime(200);
        expect(tip.open).toBe(true);

        // 3. Non-escape key on trigger does not close
        btnEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(tip.open).toBe(true);

        // 4. Moving from trigger to panel preserves open state
        btnEl.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: tipEl }));
        tipEl.dispatchEvent(new PointerEvent('pointerenter', { relatedTarget: btnEl }));
        expect(tip.open).toBe(true);

        // 5. Returning from panel to trigger preserves open state
        tipEl.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: btnEl }));
        btnEl.dispatchEvent(new PointerEvent('pointerenter', { relatedTarget: tipEl }));
        expect(tip.open).toBe(true);

        // 6. Leaving trigger to outside closes after delay
        btnEl.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
        vi.advanceTimersByTime(200);
        expect(tip.open).toBe(false);

        // 7. Escape key closes tooltip immediately
        tip.show();
        expect(tip.open).toBe(true);
        btnEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(tip.open).toBe(false);

        tip.destroy();
        btn.destroy();
        document.body.removeChild(btnEl);
        document.body.removeChild(tipEl);
      });
    }));

  it('handles fallback host DOM parent pointerleave to panel and keydown non-escape', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);

        const panelEl = document.createElement('div');
        parent.appendChild(panelEl);

        const tip = aria<HTMLDivElement>('tooltip', { open: true });
        tip.ref(panelEl);

        // Fallback host already had aria-describedby because open: true
        expect(parent.getAttribute('aria-describedby')).toBe(tip.id);

        // Non-escape keydown on parent does not close
        parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
        expect(tip.open).toBe(true);

        // Pointerleave from parent to panelEl does not close
        parent.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: panelEl }));
        expect(tip.open).toBe(true);

        // Pointerleave to outside closes
        parent.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
        expect(tip.open).toBe(false);

        tip.destroy();
        document.body.removeChild(parent);
      });
    }));

  it('operates safely when mounted without any parent host element', () => {
    const tip = aria<HTMLDivElement>('tooltip', { open: false });
    const detachedEl = document.createElement('div');
    tip.ref(detachedEl);

    expect(detachedEl.getAttribute('role')).toBe('tooltip');
    expect(detachedEl.hidden).toBe(true);

    tip.show();
    expect(detachedEl.hidden).toBe(false);
    expect(detachedEl.style.getPropertyValue('position-anchor')).toBe(`--tooltip-anchor-${tip.id}`);

    tip.close();
    expect(detachedEl.hidden).toBe(true);
    expect(detachedEl.style.getPropertyValue('position-anchor')).toBe('');

    tip.destroy();
  });

  it('supports mode override to disable focus trigger while preserving hover', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button');
        const btnEl = document.createElement('button');
        document.body.appendChild(btnEl);
        bind(btnEl, btn);

        const tip = aria('tooltip', { mode: ['hover'], delay: 100 });
        const tipEl = document.createElement('div');
        document.body.appendChild(tipEl);
        bind(tipEl, tip);

        // Focusing does NOT open tooltip when mode is ['hover']
        btnEl.focus();
        expect(tip.open).toBe(false);

        // Hover still opens after delay
        btnEl.dispatchEvent(new Event('pointerenter'));
        expect(tip.open).toBe(false);
        vi.advanceTimersByTime(100);
        expect(tip.open).toBe(true);

        tip.destroy();
        btn.destroy();
        document.body.removeChild(btnEl);
        document.body.removeChild(tipEl);
      });
    }));

  it('supports click trigger mode on tooltip', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button');
        const btnEl = document.createElement('button');
        document.body.appendChild(btnEl);
        bind(btnEl, btn);

        const tip = aria('tooltip', { mode: ['click'] });
        const tipEl = document.createElement('div');
        document.body.appendChild(tipEl);
        bind(tipEl, tip);

        // Clicking opens and toggles
        btnEl.click();
        expect(tip.open).toBe(true);

        btnEl.click();
        expect(tip.open).toBe(false);

        tip.destroy();
        btn.destroy();
        document.body.removeChild(btnEl);
        document.body.removeChild(tipEl);
      });
    }));
});
