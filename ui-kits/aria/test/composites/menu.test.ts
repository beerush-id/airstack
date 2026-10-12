import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type MenuCommandEvent, type MenuProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildMenu(props: MenuProps, options: Array<{ name: string; text: string; disabled?: boolean }>) {
  const menu = aria<HTMLElement>('menu', props);
  const menuEl = bind(document.createElement('div'), menu);
  document.body.appendChild(menuEl);

  const trigger = aria<HTMLButtonElement>('menu-button', {});
  const triggerEl = bind(document.createElement('button'), trigger);
  menuEl.appendChild(triggerEl);

  const panel = aria<HTMLElement>('menu-panel', {});
  const panelEl = bind(document.createElement('div'), panel);
  menuEl.appendChild(panelEl);

  const members = options.map(({ name, text, disabled }) => {
    const item = aria<HTMLButtonElement>('menu-item', { name, disabled });
    const el = bind(document.createElement('button'), item);
    el.textContent = text;
    panelEl.appendChild(el);
    return { name, item, el };
  });

  const cleanup = () => {
    for (const { item } of members) item.destroy();
    panel.destroy();
    trigger.destroy();
    menu.destroy();
    menuEl.remove();
  };

  return { menu, menuEl, trigger, triggerEl, panel, panelEl, members, cleanup };
}

function press(el: HTMLElement, key: string): KeyboardEvent {
  const isPolyfill = el.tagName === 'BUTTON' && (key === 'Enter' || key === ' ');
  const event = new KeyboardEvent('keydown', { key, bubbles: !isPolyfill, cancelable: true });
  el.dispatchEvent(event);
  if (isPolyfill) el.click();
  return event;
}

describe('Menu - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Trigger Semantics Invariant', () => {
    it('compiles the menu trigger and points it at the menu panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const { menu, trigger, panel, triggerEl, panelEl, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          expect(menu.attributes.role).toBeUndefined();
          expect(menu.open).toBe(false);
          expect(trigger.attributes.role).toBeUndefined();
          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(panel.id);
          expect(panel.attributes.role).toBe('menu');
          expect(panel.attributes['aria-orientation']).toBe('vertical');

          expect(triggerEl.getAttribute('aria-haspopup')).toBe('menu');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');
          expect(panelEl.getAttribute('role')).toBe('menu');

          const controls = triggerEl.getAttribute('aria-controls');
          expect(controls).toBeTruthy();
          expect(document.getElementById(controls as string)).toBe(panelEl);

          cleanup();
        });
      }));

    it('owns closed open state by default and namespaces ids under menu-*', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({});
          const { menu, panel, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          expect(menu.open).toBe(false);
          expect(menu.id).toMatch(/^menu-/);
          expect(panel.id).toBe(`${menu.id}-menu`);

          cleanup();
        });
      }));

    it('spawns its trigger and panel pair directly from the root', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const menu = aria<HTMLElement>('menu', props) as unknown as {
            button: (p?: unknown, o?: unknown) => { attributes: Record<string, unknown>; destroy: () => void };
            panel: (p?: unknown) => { id: string; attributes: Record<string, unknown>; destroy: () => void };
            destroy: () => void;
          };
          const menuEl = bind(document.createElement('div'), menu as never);
          document.body.appendChild(menuEl);

          const trigger = menu.button({});
          const panel = menu.panel({});
          const triggerEl = bind(document.createElement('button'), trigger as never);
          const panelEl = bind(document.createElement('div'), panel as never);
          menuEl.appendChild(triggerEl);
          menuEl.appendChild(panelEl);

          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(panel.id);
          expect(panel.attributes.role).toBe('menu');

          trigger.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('keeps a rootless button closed and inert', () =>
      scope.run(() => {
        component().run(() => {
          const trigger = aria<HTMLButtonElement>('menu-button', {});
          const triggerEl = bind(document.createElement('button'), trigger);
          document.body.appendChild(triggerEl);

          expect(trigger.attributes['aria-expanded']).toBe('false');

          triggerEl.click();
          expect(trigger.attributes['aria-expanded']).toBe('false');

          press(triggerEl, 'Enter');
          expect(trigger.attributes['aria-expanded']).toBe('false');

          trigger.destroy();
          triggerEl.remove();
        });
      }));
  });

  describe('Trigger Toggling Invariant', () => {
    it('toggles open on click, Enter, and Space', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const { menu, trigger, triggerEl, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          expect(menu.attributes.role).toBeUndefined();
          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          triggerEl.click();
          expect(props.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          triggerEl.click();
          expect(props.open).toBe(false);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));

    it('flips open on Enter and Space key activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const { triggerEl, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          press(triggerEl, 'Enter');
          expect(props.open).toBe(true);

          press(triggerEl, 'Enter');
          expect(props.open).toBe(false);

          press(triggerEl, ' ');
          expect(props.open).toBe(true);

          press(triggerEl, ' ');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('closes on Escape without invoking and returns focus to the trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const { menuEl, triggerEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          const commands: unknown[] = [];
          menuEl.addEventListener('command', (event) => commands.push((event as MenuCommandEvent).detail));

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          members[1].el.focus();
          press(members[1].el, 'Escape');

          expect(props.open).toBe(false);
          expect(commands).toEqual([]);
          expect(document.activeElement).toBe(triggerEl);

          cleanup();
        });
      }));
  });

  describe('Roving & Keyboard Invariant', () => {
    it('moves focus with ArrowDown and ArrowUp without activating', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { menuEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
            { name: 'save', text: 'Save file' },
          ]);

          const commands: unknown[] = [];
          menuEl.addEventListener('command', (event) => commands.push((event as MenuCommandEvent).detail));

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[1].el);

          press(members[1].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[2].el);

          press(members[2].el, 'ArrowUp');
          expect(document.activeElement).toBe(members[1].el);

          expect(commands).toEqual([]);

          cleanup();
        });
      }));

    it('jumps to first and last enabled items on Home and End', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
            { name: 'save', text: 'Save file' },
          ]);

          members[1].el.focus();
          press(members[1].el, 'Home');
          expect(document.activeElement).toBe(members[0].el);

          press(members[0].el, 'End');
          expect(document.activeElement).toBe(members[2].el);

          cleanup();
        });
      }));

    it('skips disabled items while roving', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file', disabled: true },
            { name: 'save', text: 'Save file' },
          ]);

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[2].el);

          press(members[2].el, 'ArrowUp');
          expect(document.activeElement).toBe(members[0].el);

          cleanup();
        });
      }));

    it('activates the focused item on Enter and Space', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { menuEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          const commands: unknown[] = [];
          menuEl.addEventListener('command', (event) => commands.push((event as MenuCommandEvent).detail));

          members[1].el.focus();
          press(members[1].el, 'Enter');
          expect(commands).toEqual(['open']);

          press(members[1].el, ' ');
          expect(commands).toEqual(['open', 'open']);

          cleanup();
        });
      }));

    it('moves focus to the item matching typed text', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
            { name: 'save', text: 'Save file' },
          ]);

          members[0].el.focus();
          press(members[0].el, 's');
          expect(document.activeElement).toBe(members[2].el);

          cleanup();
        });
      }));

    it('holds a single tab stop across the panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { panelEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          const stops = [panelEl, ...members.map((m) => m.el)].filter(
            (el) => (el.getAttribute('tabindex') ?? '') === '0'
          );
          expect(stops.length).toBe(1);

          cleanup();
        });
      }));
  });

  describe('Composition & Commit Invariant', () => {
    it('invokes the item command with its name on click', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { trigger, panel, triggerEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(panel.attributes.role).toBe('menu');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          const seen: unknown[] = [];
          members[0].el.addEventListener('command', (event) => seen.push((event as MenuCommandEvent).detail));
          members[0].el.click();

          expect(seen).toEqual(['new']);

          cleanup();
        });
      }));

    it('invokes both the item oncommand and the root oncommand on invoke', () =>
      scope.run(() => {
        component().run(() => {
          let itemCalls = 0;
          let rootCalls = 0;
          let itemDetail: unknown;
          let rootDetail: unknown;
          const props = mutable<MenuProps>({
            open: true,
            oncommand: (event) => {
              rootCalls += 1;
              rootDetail = (event as MenuCommandEvent).detail;
            },
          });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const item = aria<HTMLButtonElement>('menu-item', {
            name: 'save',
            oncommand: (event) => {
              itemCalls += 1;
              itemDetail = (event as MenuCommandEvent).detail;
            },
          });
          const itemEl = bind(document.createElement('button'), item);
          itemEl.textContent = 'Save file';
          panelEl.appendChild(itemEl);

          itemEl.click();

          expect(itemCalls).toBe(1);
          expect(itemDetail).toBe('save');
          expect(rootCalls).toBe(1);
          expect(rootDetail).toBe('save');

          item.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('bubbles the item command to the root oncommand', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { menuEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          const rootCommands: unknown[] = [];
          menuEl.addEventListener('command', (event) => rootCommands.push((event as MenuCommandEvent).detail));

          members[1].el.click();

          expect(rootCommands).toEqual(['open']);

          cleanup();
        });
      }));

    it('toggles the checkbox item and commits change with the committed state', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const trigger = aria<HTMLButtonElement>('menu-button', {});
          const triggerEl = bind(document.createElement('button'), trigger);
          menuEl.appendChild(triggerEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const check = aria<HTMLButtonElement>('menu-item-checkbox', { name: 'wrap', checked: false });
          const checkEl = bind(document.createElement('button'), check);
          checkEl.textContent = 'Word wrap';
          panelEl.appendChild(checkEl);

          expect(checkEl.getAttribute('role')).toBe('menuitemcheckbox');
          expect(checkEl.getAttribute('aria-checked')).toBe('false');

          const changes: unknown[] = [];
          checkEl.addEventListener('change', (event) => changes.push((event as MenuCommandEvent).detail));

          checkEl.click();

          expect(props.open).toBe(true);
          expect(checkEl.getAttribute('aria-checked')).toBe('true');
          expect(changes).toEqual([true]);

          check.destroy();
          panel.destroy();
          trigger.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('keeps mixed checkbox state until its own activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const check = aria<HTMLButtonElement>('menu-item-checkbox', { name: 'wrap', indeterminate: true });
          const checkEl = bind(document.createElement('button'), check);
          checkEl.textContent = 'Word wrap';
          panelEl.appendChild(checkEl);

          expect(checkEl.getAttribute('aria-checked')).toBe('mixed');

          checkEl.click();

          expect(checkEl.getAttribute('aria-checked')).toBe('true');

          check.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('invokes checkbox onchange with the committed state', () =>
      scope.run(() => {
        component().run(() => {
          let calls = 0;
          let detail: unknown;
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const check = aria<HTMLButtonElement>('menu-item-checkbox', {
            name: 'wrap',
            checked: false,
            onchange: (event) => {
              calls += 1;
              detail = (event as AnyType).detail;
            },
          });
          const checkEl = bind(document.createElement('button'), check);
          checkEl.textContent = 'Word wrap';
          panelEl.appendChild(checkEl);

          checkEl.click();

          expect(calls).toBe(1);
          expect(detail).toBe(true);

          check.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('scopes radio selection to the enclosing group value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const group = aria<HTMLElement>('menu-item-group', { label: 'Theme', value: 'dark' });
          const groupEl = bind(document.createElement('div'), group);
          panelEl.appendChild(groupEl);

          const light = aria<HTMLButtonElement>('menu-item-radio', { value: 'light' });
          const lightEl = bind(document.createElement('button'), light);
          lightEl.textContent = 'Light';
          groupEl.appendChild(lightEl);

          const dark = aria<HTMLButtonElement>('menu-item-radio', { value: 'dark' });
          const darkEl = bind(document.createElement('button'), dark);
          darkEl.textContent = 'Dark';
          groupEl.appendChild(darkEl);

          expect(groupEl.getAttribute('role')).toBe('group');
          expect(lightEl.getAttribute('role')).toBe('menuitemradio');
          expect(lightEl.getAttribute('aria-checked')).toBe('false');
          expect(darkEl.getAttribute('aria-checked')).toBe('true');

          lightEl.click();

          expect(lightEl.getAttribute('aria-checked')).toBe('true');
          expect(darkEl.getAttribute('aria-checked')).toBe('false');

          light.destroy();
          dark.destroy();
          group.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('commits radio change with the group value it selects', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const group = aria<HTMLElement>('menu-item-group', { label: 'Theme', value: 'dark' });
          const groupEl = bind(document.createElement('div'), group);
          panelEl.appendChild(groupEl);

          const light = aria<HTMLButtonElement>('menu-item-radio', { value: 'light' });
          const lightEl = bind(document.createElement('button'), light);
          lightEl.textContent = 'Light';
          groupEl.appendChild(lightEl);

          const changes: unknown[] = [];
          lightEl.addEventListener('change', (event) => changes.push((event as AnyType).detail));

          lightEl.click();

          expect(changes).toEqual(['light']);

          light.destroy();
          group.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('keeps radio selection independent across sibling groups', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const theme = aria<HTMLElement>('menu-item-group', { label: 'Theme', value: 'dark' });
          const themeEl = bind(document.createElement('div'), theme);
          panelEl.appendChild(themeEl);

          const light = aria<HTMLButtonElement>('menu-item-radio', { value: 'light' });
          const lightEl = bind(document.createElement('button'), light);
          lightEl.textContent = 'Light';
          themeEl.appendChild(lightEl);

          const dark = aria<HTMLButtonElement>('menu-item-radio', { value: 'dark' });
          const darkEl = bind(document.createElement('button'), dark);
          darkEl.textContent = 'Dark';
          themeEl.appendChild(darkEl);

          const density = aria<HTMLElement>('menu-item-group', { label: 'Density', value: 'cozy' });
          const densityEl = bind(document.createElement('div'), density);
          panelEl.appendChild(densityEl);

          const cozy = aria<HTMLButtonElement>('menu-item-radio', { value: 'cozy' });
          const cozyEl = bind(document.createElement('button'), cozy);
          cozyEl.textContent = 'Cozy';
          densityEl.appendChild(cozyEl);

          const compact = aria<HTMLButtonElement>('menu-item-radio', { value: 'compact' });
          const compactEl = bind(document.createElement('button'), compact);
          compactEl.textContent = 'Compact';
          densityEl.appendChild(compactEl);

          lightEl.click();

          expect(lightEl.getAttribute('aria-checked')).toBe('true');
          expect(darkEl.getAttribute('aria-checked')).toBe('false');
          expect(cozyEl.getAttribute('aria-checked')).toBe('true');
          expect(compactEl.getAttribute('aria-checked')).toBe('false');

          light.destroy();
          dark.destroy();
          theme.destroy();
          cozy.destroy();
          compact.destroy();
          density.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));

    it('labels the group section with an accessible name', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const menu = aria<HTMLElement>('menu', props);
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const panel = aria<HTMLElement>('menu-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          menuEl.appendChild(panelEl);

          const group = aria<HTMLElement>('menu-item-group', { label: 'Theme' });
          const groupEl = bind(document.createElement('div'), group);
          panelEl.appendChild(groupEl);

          expect(groupEl.getAttribute('role')).toBe('group');
          expect(groupEl.getAttribute('aria-label')).toBe('Theme');

          group.destroy();
          panel.destroy();
          menu.destroy();
          menuEl.remove();
        });
      }));
  });

  describe('Menubar Invariant', () => {
    it('compiles the horizontal menubar with its accessible name', () =>
      scope.run(() => {
        component().run(() => {
          const bar = aria<HTMLElement>('menu-bar', { label: 'Application' });
          const barEl = bind(document.createElement('div'), bar);
          document.body.appendChild(barEl);

          expect(barEl.getAttribute('role')).toBe('menubar');
          expect(barEl.getAttribute('aria-label')).toBe('Application');
          expect(barEl.getAttribute('aria-orientation')).toBe('horizontal');

          bar.destroy();
          barEl.remove();
        });
      }));
  });

  describe('Announcement Invariant', () => {
    it('authors input on the item taking the cursor and forwards it from the panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({});
          const { triggerEl, panelEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          triggerEl.click();

          const itemInputs: unknown[] = [];
          const panelInputs: unknown[] = [];
          for (const { el } of members) {
            el.addEventListener('input', (event) => itemInputs.push((event as AnyType).detail));
          }
          panelEl.addEventListener('input', (event) => panelInputs.push((event as AnyType).detail));

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');

          expect(itemInputs).toEqual(['open']);
          expect(panelInputs).toEqual(['open']);

          cleanup();
        });
      }));

    it('refuses toggling and invoking while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false, disabled: true });
          const { trigger, triggerEl, menuEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file' },
          ]);

          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          const commands: unknown[] = [];
          menuEl.addEventListener('command', (event) => commands.push((event as MenuCommandEvent).detail));

          triggerEl.click();
          expect(props.open).toBe(false);

          press(triggerEl, 'Enter');
          expect(props.open).toBe(false);

          press(triggerEl, ' ');
          expect(props.open).toBe(false);

          members[0].el.click();
          expect(commands).toEqual([]);
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('locks a disabled member out of activation and roving', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { menuEl, members, cleanup } = buildMenu(props, [
            { name: 'new', text: 'New file' },
            { name: 'open', text: 'Open file', disabled: true },
          ]);

          const commands: unknown[] = [];
          menuEl.addEventListener('command', (event) => commands.push((event as MenuCommandEvent).detail));

          members[1].el.click();
          expect(commands).toEqual([]);

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).not.toBe(members[1].el);

          cleanup();
        });
      }));

    it('closes on outside click and emits close', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { trigger, triggerEl, menuEl, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          expect(trigger.attributes['aria-expanded']).toBe('true');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          const closed: unknown[] = [];
          menuEl.addEventListener('close', () => closed.push(true));

          const outside = document.createElement('div');
          document.body.appendChild(outside);
          outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

          expect(props.open).toBe(false);
          expect(closed).toEqual([true]);

          outside.remove();
          cleanup();
        });
      }));

    it('invokes onopen and onclose props across visibility flips', () =>
      scope.run(() => {
        component().run(() => {
          let opened = 0;
          let closed = 0;
          const props = mutable<MenuProps>({
            open: false,
            onopen: () => {
              opened += 1;
            },
            onclose: () => {
              closed += 1;
            },
          });
          const { trigger, triggerEl, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          triggerEl.click();
          expect(opened).toBe(1);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          press(triggerEl, 'Escape');
          expect(closed).toBe(1);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));

    it('emits open and close when the popup visibility flips', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: false });
          const { trigger, triggerEl, menuEl, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          const opened: unknown[] = [];
          const closed: unknown[] = [];
          menuEl.addEventListener('open', () => opened.push(true));
          menuEl.addEventListener('close', () => closed.push(true));

          triggerEl.click();
          expect(opened).toEqual([true]);

          press(triggerEl, 'Escape');
          expect(closed).toEqual([true]);

          cleanup();
        });
      }));
  });

  describe('Teardown Invariant', () => {
    it('detaches the menu tree without leaving it connected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<MenuProps>({ open: true });
          const { menuEl, triggerEl, cleanup } = buildMenu(props, [{ name: 'new', text: 'New file' }]);

          expect(menuEl.isConnected).toBe(true);

          cleanup();

          expect(menuEl.isConnected).toBe(false);
          expect(document.contains(triggerEl)).toBe(false);
        });
      }));
  });
});
