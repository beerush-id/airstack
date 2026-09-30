import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ContextMenuProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildArea(props: Partial<ContextMenuProps>) {
  const menu = aria('context-menu', props as ContextMenuProps);
  const trigger = aria('context-menu-trigger');

  const area = document.createElement('div');
  const triggerEl = bind(area, trigger);
  document.body.appendChild(triggerEl);

  const popup = aria('menu-panel', { label: 'Canvas' });
  const popupEl = bind(document.createElement('div'), popup);
  document.body.appendChild(popupEl);

  const cut = bind(document.createElement('button'), aria('menu-item'));
  const copy = bind(document.createElement('button'), aria('menu-item'));
  popupEl.append(cut, copy);

  const cleanup = () => {
    popup.destroy();
    trigger.destroy();
    menu.destroy();
    triggerEl.remove();
    popupEl.remove();
  };

  return { menu, trigger, popup, popupEl, triggerEl, cut, copy, cleanup };
}

function secondaryClick(el: HTMLElement) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 120,
    clientY: 240,
  });
  el.dispatchEvent(event);
  return event;
}

function press(el: HTMLElement, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('ContextMenu - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Pointer Coordinate Anchor Invariant', () => {
    it('opens on a secondary pointer click and refuses the browser default menu', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { triggerEl, popupEl, cleanup } = buildArea(props);

          expect(popupEl.getAttribute('role')).toBe('menu');

          const event = secondaryClick(triggerEl);
          expect(event.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('leaves the trigger element semantics untouched and compiles no popup wiring', () =>
      scope.run(() => {
        component().run(() => {
          const { trigger, triggerEl, menu, cleanup } = buildArea({ open: false });

          // The area keeps whatever it already is: no role is layered on
          expect(trigger.attributes.role).toBeUndefined();
          expect(triggerEl.hasAttribute('role')).toBe(false);
          expect(triggerEl.hasAttribute('tabindex')).toBe(false);

          // A context menu has no trigger-side announcement
          expect(trigger.attributes['aria-haspopup']).toBeUndefined();
          expect(trigger.attributes['aria-expanded']).toBeUndefined();
          expect(trigger.attributes['aria-controls']).toBeUndefined();

          // The container coordinates without taking a role itself
          expect(menu.attributes.role).toBeUndefined();

          cleanup();
        });
      }));

    it('ignores primary pointer interaction and stays closed when disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { triggerEl, cleanup } = buildArea(props);

          triggerEl.click();
          expect(props.open).toBe(false);

          triggerEl.dispatchEvent(
            new MouseEvent('dblclick', { bubbles: true, cancelable: true, button: 2 }),
          );
          expect(props.open).toBe(false);

          props.disabled = true;
          const blocked = secondaryClick(triggerEl);
          expect(props.open).toBe(false);
          expect(blocked.defaultPrevented).toBe(false);

          props.disabled = false;
          secondaryClick(triggerEl);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Shortcut Trigger & Focus Capture Invariant', () => {
    it('opens on Shift+F10 and on the Context Menu key, and on nothing else', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { triggerEl, cleanup } = buildArea(props);

          triggerEl.focus();

          const plain = press(triggerEl, 'F10');
          expect(plain.defaultPrevented).toBe(false);
          expect(props.open).toBe(false);

          const shortcut = press(triggerEl, 'F10', true);
          expect(shortcut.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          props.open = false;
          const menuKey = press(triggerEl, 'ContextMenu');
          expect(menuKey.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('keeps keyboard invocation available on an unfocusable area', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { triggerEl, cleanup } = buildArea(props);

          // The shortcut is heard through the container, so the area needs no tab stop
          expect(triggerEl.hasAttribute('tabindex')).toBe(false);

          const parent = document.createElement('button');
          triggerEl.appendChild(parent);
          parent.focus();

          press(parent, 'F10', true);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Menu Inheritance & Dismissal Invariant', () => {
    it('roves focus across items and dismisses on Escape through the menu contract', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: true });
          const { popupEl, cut, copy, cleanup } = buildArea(props);

          cut.focus();

          popupEl.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
          );
          expect(document.activeElement).toBe(copy);

          copy.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
          );
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('dismisses on outside interaction and stops listening once destroyed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: true });
          const { popupEl, triggerEl, cleanup } = buildArea(props);

          const outside = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
          document.body.dispatchEvent(outside);
          expect(props.open).toBe(false);

          // Reopening through the inherited path still works
          secondaryClick(triggerEl);
          expect(props.open).toBe(true);

          cleanup();

          // A destroyed context menu no longer answers the pointer
          const afterClose = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
          document.body.dispatchEvent(afterClose);
          expect(props.open).toBe(true);
          expect(popupEl.isConnected).toBe(false);
        });
      }));
  });
});
