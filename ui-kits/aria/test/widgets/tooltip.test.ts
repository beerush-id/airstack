import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aria, type TooltipProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Tooltip - Contract Specifications', () => {
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

  function buildTree(props: TooltipProps) {
    const tooltip = aria('tooltip', props);
    const trigger = aria('tooltip-trigger');
    const panel = aria('tooltip-panel');

    const anchor = document.createElement('button');
    const panelEl = document.createElement('div');
    anchor.textContent = 'Save draft';
    document.body.appendChild(anchor);
    document.body.appendChild(panelEl);

    const tooltipEl = document.createElement('span');
    document.body.appendChild(tooltipEl);

    bind(tooltipEl, tooltip);
    bind(anchor, trigger);
    bind(panelEl, panel);

    return { tooltip, trigger, panel, tooltipEl, anchor, panelEl };
  }

  describe('Transient Advisory Disclosure Invariant', () => {
    it('reveals on focus without waiting and withdraws on blur', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TooltipProps>({ id: 'save-hint', open: false, delay: 300 });
          const parts = buildTree(props);

          // 1. Creation & SSR: a closed tooltip is hidden and unlinked
          expect(parts.panelEl.getAttribute('role')).toBe('tooltip');
          expect(parts.panelEl.hidden).toBe(true);
          expect(parts.anchor.hasAttribute('aria-describedby')).toBe(false);

          // 2/3. Focus is an immediate claim on the user's attention
          parts.anchor.focus();
          expect(props.open).toBe(true);
          expect(parts.panelEl.hidden).toBe(false);
          expect(parts.anchor.getAttribute('aria-describedby')).toBe('save-hint');

          // The advisory never takes focus itself
          expect(parts.panelEl.hasAttribute('tabindex')).toBe(false);
          expect(document.activeElement).toBe(parts.anchor);

          // 5. Blur dismisses and unlinks
          parts.anchor.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(props.open).toBe(false);
          expect(parts.panelEl.hidden).toBe(true);
          expect(parts.anchor.hasAttribute('aria-describedby')).toBe(false);

          parts.tooltip.destroy();
          parts.trigger.destroy();
          parts.panel.destroy();
          document.body.removeChild(parts.anchor);
          document.body.removeChild(parts.panelEl);
          document.body.removeChild(parts.tooltipEl);
        });
      }));

    it('announces every visibility commit on the container', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TooltipProps>({ open: false });
          const parts = buildTree(props);

          const commits: Array<{ detail: unknown; bubbles: boolean; kind: string }> = [];
          parts.tooltipEl.addEventListener('change', (event) =>
            commits.push({
              detail: (event as CustomEvent).detail,
              bubbles: event.bubbles,
              kind: event.constructor.name,
            }),
          );

          parts.anchor.focus();
          parts.anchor.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          parts.anchor.focus();

          expect(commits.map((entry) => entry.detail)).toEqual([true, false, true]);
          expect(commits[0].bubbles).toBe(true);
          expect(commits[0].kind).toBe('CustomEvent');

          // An author write commits the same way as a focus gesture
          props.open = false;
          expect(commits.map((entry) => entry.detail)).toEqual([true, false, true, false]);

          parts.tooltip.destroy();
          parts.trigger.destroy();
          parts.panel.destroy();
          document.body.removeChild(parts.anchor);
          document.body.removeChild(parts.panelEl);
          document.body.removeChild(parts.tooltipEl);
        });
      }));
  });

  describe('Hover/Focus Synchronization & Delay Invariant', () => {
    it('holds a hover behind the declared delay and shows immediately for focus', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TooltipProps>({ open: false, delay: 500 });
          const parts = buildTree(props);

          parts.anchor.dispatchEvent(new Event('pointerenter'));

          expect(props.open).toBe(false);

          vi.advanceTimersByTime(499);
          expect(props.open).toBe(false);

          vi.advanceTimersByTime(1);
          expect(props.open).toBe(true);
          expect(parts.panelEl.hidden).toBe(false);

          // Leaving and re-hovering restarts the wait
          parts.anchor.dispatchEvent(new Event('pointerleave'));
          expect(props.open).toBe(false);

          parts.anchor.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(100);
          expect(props.open).toBe(false);

          // Focus does not queue behind a pending hover
          parts.anchor.focus();
          expect(props.open).toBe(true);

          vi.advanceTimersByTime(1000);
          expect(props.open).toBe(true);

          parts.tooltip.destroy();
          parts.trigger.destroy();
          parts.panel.destroy();
          document.body.removeChild(parts.anchor);
          document.body.removeChild(parts.panelEl);
          document.body.removeChild(parts.tooltipEl);
        });
      }));

    it('stays open while the pointer travels from the trigger onto the panel', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TooltipProps>({ open: false, delay: 100 });
          const parts = buildTree(props);

          parts.anchor.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(100);
          expect(props.open).toBe(true);

          // The pointer leaves the trigger but has not left the advisory
          parts.anchor.dispatchEvent(new Event('pointerleave'));
          parts.panelEl.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(1000);
          expect(props.open).toBe(true);

          // Only leaving both dismisses it
          parts.panelEl.dispatchEvent(new Event('pointerleave'));
          expect(props.open).toBe(false);

          parts.tooltip.destroy();
          parts.trigger.destroy();
          parts.panel.destroy();
          document.body.removeChild(parts.anchor);
          document.body.removeChild(parts.panelEl);
          document.body.removeChild(parts.tooltipEl);
        });
      }));
  });

  describe('Dismissal & Context Linkage Invariant', () => {
    it('hides on Escape and stops the key from reaching the page behind it', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TooltipProps>({ open: false });
          const parts = buildTree(props);

          const onDocument = vi.fn();
          document.addEventListener('keydown', onDocument);

          parts.anchor.focus();
          expect(props.open).toBe(true);

          const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
            bubbles: true,
          });
          parts.anchor.dispatchEvent(escape);

          expect(props.open).toBe(false);
          expect(parts.panelEl.hidden).toBe(true);
          expect(onDocument).not.toHaveBeenCalled();

          document.removeEventListener('keydown', onDocument);

          parts.tooltip.destroy();
          parts.trigger.destroy();
          parts.panel.destroy();
          document.body.removeChild(parts.anchor);
          document.body.removeChild(parts.panelEl);
          document.body.removeChild(parts.tooltipEl);
        });
      }));

    it('leaves no description linkage behind when the advisory is torn down while open', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TooltipProps>({ open: false });
          const parts = buildTree(props);

          parts.anchor.focus();
          expect(parts.anchor.getAttribute('aria-describedby')).toBe(parts.panelEl.id);

          // Tearing down the advisory while visible must purge the pointer to it
          parts.tooltip.destroy();
          expect(parts.anchor.hasAttribute('aria-describedby')).toBe(false);
          expect(props.open).toBe(false);

          parts.trigger.destroy();
          parts.panel.destroy();
          document.body.removeChild(parts.anchor);
          document.body.removeChild(parts.panelEl);
          document.body.removeChild(parts.tooltipEl);
        });
      }));
  });
});
