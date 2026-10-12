import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  aria,
  MenuAria,
  MenubarAria,
  MenuButtonAria,
  MenuGroupAria,
  MenuItemAria,
  MenuItemCheckboxAria,
  MenuPanelAria,
  type MenuProps,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Menu - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Default Construction', () => {
    it('constructs every part with no arguments', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new MenuAria();
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const button = new MenuButtonAria();
          const buttonEl = bind(document.createElement('button'), button);
          menuEl.appendChild(buttonEl);

          const panel = new MenuPanelAria();
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const item = new MenuItemAria();
          const itemEl = bind(document.createElement('button'), item);
          panelEl.appendChild(itemEl);

          const check = new MenuItemCheckboxAria();
          const checkEl = bind(document.createElement('button'), check);
          panelEl.appendChild(checkEl);

          const group = new MenuGroupAria();
          const groupEl = bind(document.createElement('div'), group);
          panelEl.appendChild(groupEl);

          const bar = new MenubarAria();
          const barEl = bind(document.createElement('div'), bar);
          document.body.appendChild(barEl);

          expect(menu.open).toBe(false);
          expect(menu.isSubmenu()).toBe(false);
          expect(button.attributes['aria-haspopup']).toBe('menu');
          expect(panel.attributes.role).toBe('menu');
          expect(itemEl.getAttribute('role')).toBe('menuitem');
          expect(checkEl.getAttribute('role')).toBe('menuitemcheckbox');
          expect(groupEl.getAttribute('role')).toBe('group');
          expect(bar.orientation).toBe('horizontal');
          expect(barEl.getAttribute('role')).toBe('menubar');

          item.destroy();
          check.destroy();
          group.destroy();
          panel.destroy();
          button.destroy();
          menu.destroy();
          menuEl.remove();
          bar.destroy();
          barEl.remove();
        });
      }));

    it('spawns the pair with no arguments from the root', () =>
      scope.run(() => {
        component().run(() => {
          const menu = new MenuAria();
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const button = menu.button();
          const buttonEl = bind(document.createElement('button'), button);
          menuEl.appendChild(buttonEl);

          const panel = menu.panel();
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          expect(button.attributes['aria-controls']).toBe(panel.id);
          expect(panel.attributes.role).toBe('menu');

          button.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('passes explicit options through the button constructor', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria<HTMLElement>('menu', {});
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const button = aria<HTMLButtonElement>('menu-button', {}, { native: false });
          const buttonEl = bind(document.createElement('button'), button);
          menuEl.appendChild(buttonEl);

          expect(button.attributes['aria-haspopup']).toBe('menu');

          button.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));
  });

  describe('Standalone Panel Identity', () => {
    it('projects its own id without a root and undefined without one', () =>
      scope.run(() => {
        component().run(() => {
          const named = aria<HTMLElement>('menu-panel', { id: 'solo' });
          const namedEl = bind(document.createElement('div'), named);
          document.body.appendChild(namedEl);

          expect(named.id).toBe('solo');
          expect(namedEl.getAttribute('id')).toBe('solo');

          named.destroy();
          namedEl.remove();
        });
      }));

    it('reports closed state through the popover proxy', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {}) as unknown as MenuPanelAria;
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          expect(panel.open).toBe(false);

          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));
  });

  describe('Invoke Guards', () => {
    it('ignores activation on a rootless item', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria<HTMLButtonElement>('menu-item', { name: 'orphan' });
          const el = bind(document.createElement('button'), item);
          document.body.appendChild(el);

          const seen: unknown[] = [];
          el.addEventListener('command', (event) => seen.push((event as CustomEvent).detail));

          el.click();

          expect(seen).toEqual([]);

          item.destroy();
          el.remove();
        });
      }));

    it('ignores activation while effectively disabled at root level', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true, disabled: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const item = aria<HTMLButtonElement>('menu-item', { name: 'save' });
          const itemEl = bind(document.createElement('button'), item);
          panelEl.appendChild(itemEl);

          const seen: unknown[] = [];
          menuEl.addEventListener('command', (event) => seen.push((event as CustomEvent).detail));

          expect(item.disabled).toBe(true);

          itemEl.click();

          expect(seen).toEqual([]);
          expect(props.open).toBe(true);

          item.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('composes root disablement into checkbox and radio items', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true, disabled: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const check = aria<HTMLButtonElement>('menu-item-checkbox', { checked: false });
          const checkEl = bind(document.createElement('button'), check);
          panelEl.appendChild(checkEl);

          const group = aria<HTMLElement>('menu-item-group', { label: 'Theme', value: 'dark' });
          const groupEl = bind(document.createElement('div'), group);
          panelEl.appendChild(groupEl);

          const radio = aria<HTMLButtonElement>('menu-item-radio', { value: 'dark' });
          const radioEl = bind(document.createElement('button'), radio);
          groupEl.appendChild(radioEl);

          expect(check.disabled).toBe(true);
          expect(radio.disabled).toBe(true);

          check.destroy();
          radio.destroy();
          group.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));
  });

  describe('Hover Delay', () => {
    it('forwards the root delay to the panel popover', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ delay: 200 });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {}) as unknown as MenuPanelAria;
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          expect(panel.popup.delay).toBe(200);

          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('defaults the paired popover delay to 150ms', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria<HTMLElement>('menu', { delay: 150 });
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {}) as unknown as MenuPanelAria;
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          expect(panel.popup.delay).toBe(150);

          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));
  });
});
