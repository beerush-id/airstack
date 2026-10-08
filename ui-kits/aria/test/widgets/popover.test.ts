import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type PopoverProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Popover - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Floating Anchor & Spatial Alignment Invariant', () => {
    it('synthesizes no geometry and anchors through the host linkage alone', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = aria('button');
          const hostEl = bind(document.createElement('button'), host);

          const props = mutable<PopoverProps>({ open: false });
          const popover = aria('popover', props);
          const popoverEl = bind(document.createElement('div'), popover);
          hostEl.appendChild(popoverEl);

          // Nothing about placement, offset, or collision is compiled
          for (const key of ['style', 'class', 'className', 'inset', 'position', 'data-placement']) {
            expect(popover.attributes[key]).toBeUndefined();
            expect(popoverEl.hasAttribute(key)).toBe(false);
          }

          // The only anchor contract is the addressable relationship to the host
          expect(hostEl.getAttribute('aria-controls')).toBe(popoverEl.id);
          expect(popoverEl.hasAttribute('aria-owns')).toBe(false);

          popover.destroy();
          host.destroy();
          expect(popover.current).toBeNull();
        });
      }));

    it('falls back to the parent element and withdraws the injection on teardown', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const parentButton = document.createElement('button');
          document.body.appendChild(parentButton);

          const popoverEl = document.createElement('div');
          parentButton.appendChild(popoverEl);

          const popover = aria<HTMLDivElement>('popover', { open: false });
          popover.ref(popoverEl);

          // With no enclosing controller, the DOM parent is wired directly
          expect(parentButton.getAttribute('aria-haspopup')).toBe('dialog');
          expect(parentButton.getAttribute('aria-expanded')).toBe('false');
          expect(parentButton.getAttribute('aria-controls')).toBe(popoverEl.id);

          parentButton.click();
          expect(popover.open).toBe(true);
          expect(parentButton.getAttribute('aria-expanded')).toBe('true');

          // Teardown removes the injected attributes and the listeners with them
          popover.destroy();
          expect(parentButton.hasAttribute('aria-haspopup')).toBe(false);
          expect(parentButton.hasAttribute('aria-expanded')).toBe(false);
          expect(parentButton.hasAttribute('aria-controls')).toBe(false);

          parentButton.click();
          expect(popover.open).toBe(true);

          document.body.removeChild(parentButton);
        });
      }));
  });

  describe('Light Dismissal & Boundary Invariant', () => {
    it('closes on a pointer outside the overlay and keeps it open when that behavior is off', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = aria('button');
          const _hostEl = bind(document.createElement('button'), host);

          const props = mutable<PopoverProps>({ open: true });
          const popover = aria('popover', props);
          const popoverEl = document.createElement('div');
          document.body.appendChild(popoverEl);
          popover.ref(popoverEl);

          const inside = document.createElement('input');
          popoverEl.appendChild(inside);

          const outside = document.createElement('p');
          document.body.appendChild(outside);

          // Interaction inside the overlay is not a dismissal signal
          inside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
          expect(props.open).toBe(true);

          // Pointer down anywhere else dismisses it
          outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
          expect(props.open).toBe(false);

          // Reopening, then opting out of light dismissal
          props.open = true;
          props.dismissable = false;

          outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
          expect(props.open).toBe(true);

          // Escape is a separate duty and still closes it
          popoverEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
          expect(props.open).toBe(false);

          popover.destroy();
          host.destroy();
          document.body.removeChild(popoverEl);
        });
      }));

    it('returns focus to the host on dismissal and on unmount while open', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = aria('button');
          const hostEl = bind(document.createElement('button'), host);
          document.body.appendChild(hostEl);

          const props = mutable<PopoverProps>({ open: false });
          const popover = aria('popover', props);
          const popoverEl = document.createElement('div');
          document.body.appendChild(popoverEl);
          popover.ref(popoverEl);

          const field = document.createElement('input');
          popoverEl.appendChild(field);

          hostEl.focus();
          hostEl.click();
          expect(props.open).toBe(true);

          // Focus moves into the overlay work surface
          field.focus();
          expect(document.activeElement).toBe(field);

          // Escape hands it back
          field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
          expect(props.open).toBe(false);
          expect(document.activeElement).toBe(hostEl);

          // Destroying while open restores focus the same way
          hostEl.click();
          expect(props.open).toBe(true);
          field.focus();

          popover.destroy();
          expect(document.activeElement).toBe(hostEl);

          host.destroy();
          document.body.removeChild(hostEl);
          document.body.removeChild(popoverEl);
        });
      }));
  });

  describe('Trigger Association & Expansion Invariant', () => {
    it('wires the scoped host toggle and keeps the expansion announcement in step', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = aria('button');
          const hostEl = bind(document.createElement('button'), host);

          const props = mutable<PopoverProps>({ id: 'filter-panel', open: false });
          const popover = aria('popover', props);
          const popoverEl = bind(document.createElement('div'), popover);
          hostEl.appendChild(popoverEl);

          // 1. Creation & SSR: the host carries the linkage before anything is clicked
          expect(host.attributes['aria-haspopup']).toBe('dialog');
          expect(host.attributes['aria-expanded']).toBe('false');
          expect(host.attributes['aria-controls']).toBe('filter-panel');

          // 2. DOM Binding
          expect(hostEl.getAttribute('aria-expanded')).toBe('false');
          expect(popoverEl.id).toBe('filter-panel');

          // 3. The host click opens; the same click closes
          hostEl.click();
          expect(props.open).toBe(true);
          expect(hostEl.getAttribute('aria-expanded')).toBe('true');
          expect(popoverEl.getAttribute('role')).toBe('dialog');

          hostEl.click();
          expect(props.open).toBe(false);
          expect(hostEl.getAttribute('aria-expanded')).toBe('false');

          // 5. An externally driven open still announces through the host
          props.open = true;
          expect(hostEl.getAttribute('aria-expanded')).toBe('true');

          popover.destroy();
          host.destroy();
          expect(popover.current).toBeNull();
        });
      }));

    it('compiles the popup role the content needs without changing the linkage', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const menuHost = aria('button');
          const menuHostEl = bind(document.createElement('button'), menuHost);

          const menu = aria('popover', { open: true }, { popupRole: 'menu' });
          const menuEl = bind(document.createElement('div'), menu);
          menuHostEl.appendChild(menuEl);

          expect(menuEl.getAttribute('role')).toBe('menu');
          expect(menuHost.attributes['aria-haspopup']).toBe('dialog');
          expect(menuHost.attributes['aria-expanded']).toBe('true');
          expect(menuHost.attributes['aria-controls']).toBe(menuEl.id);

          const defaultHost = aria('button');
          const defaultHostEl = bind(document.createElement('button'), defaultHost);

          const dialog = aria('popover', { open: true });
          const dialogEl = bind(document.createElement('div'), dialog);
          defaultHostEl.appendChild(dialogEl);

          expect(dialogEl.getAttribute('role')).toBe('dialog');

          menu.destroy();
          menuHost.destroy();
          dialog.destroy();
          defaultHost.destroy();
        });
      }));
  });
});
