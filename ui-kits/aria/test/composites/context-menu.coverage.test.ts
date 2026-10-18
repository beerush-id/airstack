import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, ContextMenuAria, ContextMenuPanelAria, type ContextMenuProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('ContextMenu - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Coordinator Edge Cases & Guards', () => {
    it('returns early on contextmenu and keydown when disabled', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria({ disabled: true, open: false });
          const hostEl = bind(document.createElement('div'), menu);
          document.body.appendChild(hostEl);

          const contextEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
          });
          hostEl.dispatchEvent(contextEvent);
          expect(contextEvent.defaultPrevented).toBe(false);
          expect(menu.open).toBe(false);
          expect(menu.anchorX).toBeUndefined();
          expect(menu.anchorY).toBeUndefined();

          const keyEvent = new KeyboardEvent('keydown', {
            key: 'F10',
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          });
          hostEl.dispatchEvent(keyEvent);
          expect(keyEvent.defaultPrevented).toBe(false);
          expect(menu.open).toBe(false);

          menu.destroy();
          hostEl.remove();
        });
      }));

    it('ignores non-matching keydown events on host surface', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria({ open: false });
          const hostEl = bind(document.createElement('div'), menu);
          document.body.appendChild(hostEl);

          const plainF10 = new KeyboardEvent('keydown', {
            key: 'F10',
            shiftKey: false,
            bubbles: true,
            cancelable: true,
          });
          hostEl.dispatchEvent(plainF10);
          expect(plainF10.defaultPrevented).toBe(false);
          expect(menu.open).toBe(false);

          const arrowDown = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          hostEl.dispatchEvent(arrowDown);
          expect(arrowDown.defaultPrevented).toBe(false);
          expect(menu.open).toBe(false);

          menu.destroy();
          hostEl.remove();
        });
      }));

    it('opens on ContextMenu key without shift key requirement', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria({ open: false });
          const hostEl = bind(document.createElement('div'), menu);
          document.body.appendChild(hostEl);

          const menuKey = new KeyboardEvent('keydown', {
            key: 'ContextMenu',
            bubbles: true,
            cancelable: true,
          });
          hostEl.dispatchEvent(menuKey);
          expect(menuKey.defaultPrevented).toBe(true);
          expect(menu.open).toBe(true);

          menu.destroy();
          hostEl.remove();
        });
      }));

    it('compiles popup aria attributes only when open', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const menu = new ContextMenuAria(props);

          expect(menu.attributes['aria-haspopup']).toBeUndefined();
          expect(menu.attributes['aria-expanded']).toBeUndefined();
          expect(menu.attributes['aria-controls']).toBeUndefined();
          expect(menu.attributes.style).toEqual({
            anchorName: `--popover-anchor-${menu.id}`,
          });

          props.open = true;

          expect(menu.attributes['aria-haspopup']).toBe('menu');
          expect(menu.attributes['aria-expanded']).toBe('true');
          expect(menu.attributes['aria-controls']).toBe(menu.panelId);

          menu.destroy();
        });
      }));

    it('spawns paired panel instance via panel() method with or without props', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria();
          const defaultPanel = menu.panel();
          expect(defaultPanel).toBeInstanceOf(ContextMenuPanelAria);
          expect(defaultPanel.id).toBe(`${menu.id}`);

          const customPanel = menu.panel();
          expect(customPanel).toBeInstanceOf(ContextMenuPanelAria);
          expect(customPanel.host).toBe(menu);

          customPanel.destroy();
          defaultPanel.destroy();
          menu.destroy();
        });
      }));

    it('calculates relative anchor coordinates correctly on contextmenu', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria({ open: false });
          const hostEl = bind(document.createElement('div'), menu);
          document.body.appendChild(hostEl);

          hostEl.getBoundingClientRect = () =>
            ({
              top: 50,
              left: 100,
              bottom: 250,
              right: 300,
              width: 200,
              height: 200,
              x: 100,
              y: 50,
              toJSON: () => {},
            }) as DOMRect;

          const contextEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 180,
            clientY: 120,
          });
          hostEl.dispatchEvent(contextEvent);

          expect(menu.anchorX).toBe(80);
          expect(menu.anchorY).toBe(70);
          expect(menu.open).toBe(true);

          menu.destroy();
          hostEl.remove();
        });
      }));
  });

  describe('Panel Edge Cases & Rootless Behavior', () => {
    it('handles rootless panel without host, defaulting id to listbox namespace', () =>
      scope.run(() => {
        component().run(() => {
          const panel = new ContextMenuPanelAria();
          expect(panel.id).toMatch(/^listbox-/);
          expect(panel.host).toBeUndefined();

          const attrs = panel.attributes as AnyType;
          expect(attrs.role).toBe('menu');
          expect(attrs.style?.['--anchor-x']).toBeUndefined();
          expect(attrs.style?.['--anchor-y']).toBeUndefined();

          panel.destroy();
        });
      }));

    it('handles rootless panel with explicit id prop', () =>
      scope.run(() => {
        component().run(() => {
          const panel = new ContextMenuPanelAria({ id: 'standalone-panel' });
          expect(panel.id).toBe('standalone-panel');
          expect(panel.host).toBeUndefined();

          panel.destroy();
        });
      }));

    it('compiles --anchor-x and --anchor-y in initial createAttributes when host coordinates exist', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria();
          menu.anchorX = 42;
          menu.anchorY = 84;

          const panel = new ContextMenuPanelAria();
          expect((panel.attributes.style as AnyType)?.['--anchor-x']).toBe('42px');
          expect((panel.attributes.style as AnyType)?.['--anchor-y']).toBe('84px');

          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          expect(panelEl.style.getPropertyValue('--anchor-x')).toBe('42px');
          expect(panelEl.style.getPropertyValue('--anchor-y')).toBe('84px');

          panel.destroy();
          panelEl.remove();
          menu.destroy();
        });
      }));

    it('refines popup style when coordinates update on host', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new ContextMenuAria();
          const panel = new ContextMenuPanelAria();
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          menu.anchorX = 15;
          menu.anchorY = 30;

          (panel.popup as AnyType).update();

          expect((panel.popup.attributes.style as AnyType)?.['--anchor-x']).toBe('15px');
          expect((panel.popup.attributes.style as AnyType)?.['--anchor-y']).toBe('30px');

          panel.destroy();
          panelEl.remove();
          menu.destroy();
        });
      }));

    it('instantiates correctly via generic aria() overload helper', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('context-menu');
          const panel = aria('context-menu-panel');

          expect(menu).toBeInstanceOf(ContextMenuAria);
          expect(panel).toBeInstanceOf(ContextMenuPanelAria);

          panel.destroy();
          menu.destroy();
        });
      }));
  });
});
