import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  aria,
  MenubarAria,
  MenuGroupAria,
  MenuItemCheckboxAria,
  MenuItemRadioAria,
  MenuPanelAria,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Menu - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Semantics & Attributes', () => {
    it('renders role="menu" and defaults to vertical orientation', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel');
          expect(menu.attributes.role).toBe('menu');
          expect(menu.attributes['aria-orientation']).toBe('vertical');

          delete (menu.properties as Record<string, unknown>).orientation;
          expect(menu.orientation).toBe('vertical');

          const defaultMenu = new MenuPanelAria();
          expect(defaultMenu.orientation).toBe('vertical');
        });
      }));

    it('renders role="menubar" and defaults to horizontal orientation', () =>
      scope.run(() => {
        component().run(() => {
          const menubar = aria('menu-bar');
          expect(menubar.attributes.role).toBe('menubar');
          expect(menubar.attributes['aria-orientation']).toBe('horizontal');

          const defaultBar = new MenubarAria();
          expect(defaultBar.orientation).toBe('horizontal');
        });
      }));

    it('projects accessible labels onto menu containers', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel', { label: 'Actions' });
          expect(menu.attributes['aria-label']).toBe('Actions');

          const menubar = aria('menu-bar', { label: 'Bar' });
          expect(menubar.attributes['aria-label']).toBe('Bar');

          const labelled = aria('menu-panel', { labelledby: 'panel-label' });
          expect(labelled.attributes['aria-labelledby']).toBe('panel-label');
        });
      }));

    it('renders menu-item as a native button trigger', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item', { name: 'save' });
          expect(item.attributes.role).toBe('menuitem');
          expect(item.attributes.type).toBe('button');
          expect(item.attributes.disabled).toBe(false);

          const disabled = aria('menu-item', { disabled: true });
          expect(disabled.attributes.disabled).toBe(true);
        });
      }));

    it('activates non-native menu-items with Space and Enter', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item', {}, { native: false });
          expect(item.attributes.role).toBe('menuitem');
          expect(item.attributes.tabindex).toBe(0);

          let activated = 0;
          const el = bind(document.createElement('div'), item);
          el.addEventListener('click', () => {
            activated++;
          });

          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
          expect(activated).toBe(1);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          expect(activated).toBe(2);
        });
      }));

    it('ignores keyboard activation on disabled non-native menu-items', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item', { disabled: true }, { native: false });
          expect(item.attributes.tabindex).toBe(-1);

          let activated = 0;
          const el = bind(document.createElement('div'), item);
          el.addEventListener('click', () => {
            activated++;
          });

          const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
          el.dispatchEvent(space);
          const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
          el.dispatchEvent(enter);
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));

          expect(activated).toBe(0);
          expect(space.defaultPrevented).toBe(false);
          expect(enter.defaultPrevented).toBe(false);
        });
      }));

    it('prevents default on Space keydown without activating non-native menu-items', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item', {}, { native: false });

          let activated = 0;
          const el = bind(document.createElement('div'), item);
          el.addEventListener('click', () => {
            activated++;
          });

          const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
          el.dispatchEvent(event);

          expect(event.defaultPrevented).toBe(true);
          expect(activated).toBe(0);
        });
      }));

    it('toggles menu-item-checkbox state standalone on click', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item-checkbox', { checked: false });
          expect(item.attributes.role).toBe('menuitemcheckbox');
          expect(item.attributes['aria-checked']).toBe('false');

          const el = bind(document.createElement('button'), item);
          el.click();
          expect(item.checked).toBe(true);
          expect(item.attributes['aria-checked']).toBe('true');

          el.click();
          expect(item.checked).toBe(false);
          expect(item.attributes['aria-checked']).toBe('false');
        });
      }));

    it('assigns menu-item-checkbox state through the checked setter', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item-checkbox', { checked: false });

          item.checked = true;
          expect(item.checked).toBe(true);
          expect(item.attributes['aria-checked']).toBe('true');

          item.checked = false;
          expect(item.checked).toBe(false);
          expect(item.attributes['aria-checked']).toBe('false');
        });
      }));

    it('resolves mixed menu-item-checkbox state on toggle', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item-checkbox', { checked: 'mixed' });

          const el = bind(document.createElement('button'), item);
          el.click();

          expect(item.checked).toBe(true);
          expect(item.attributes['aria-checked']).toBe('true');
        });
      }));

    it('blocks menu-item-checkbox toggle while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item-checkbox', { disabled: true });

          item.toggle();
          expect(item.checked).toBe(false);
          expect(item.attributes['aria-checked']).toBe('false');
        });
      }));

    it('projects mixed state on menu-item-checkbox', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item-checkbox', { checked: 'mixed' });
          expect(item.attributes['aria-checked']).toBe('mixed');
        });
      }));

    it('renders non-native menu-item-checkbox attributes', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item-checkbox', { checked: true }, { native: false });
          expect(item.attributes.role).toBe('menuitemcheckbox');
          expect(item.attributes['aria-checked']).toBe('true');

          const unchecked = aria('menu-item-checkbox', { checked: false }, { native: false });
          expect(unchecked.attributes['aria-checked']).toBe('false');
        });
      }));

    it('scopes menu-item-radio selection to its enclosing group value', () =>
      scope.run(() => {
        component().run(() => {
          const group = new MenuGroupAria({ label: 'Alignment', value: 'center' });
          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-label']).toBe('Alignment');

          const left = aria('menu-item-radio', { value: 'left' });
          const center = aria('menu-item-radio', { value: 'center' });

          expect(left.attributes.role).toBe('menuitemradio');
          expect(center.attributes['aria-checked']).toBe('true');
          expect(left.attributes['aria-checked']).toBe('false');

          const leftEl = bind(document.createElement('button'), left);
          leftEl.click();

          expect(left.attributes['aria-checked']).toBe('true');
          expect(center.attributes['aria-checked']).toBe('false');

          // Idempotent: activating the active radio never deselects it
          leftEl.click();
          expect(left.attributes['aria-checked']).toBe('true');
        });
      }));

    it('assigns menu-item-radio state through the checked setter', () =>
      scope.run(() => {
        component().run(() => {
          const radio = aria('menu-item-radio', { value: 'solo' });

          radio.checked = true;
          expect(radio.checked).toBe(true);
          expect(radio.attributes['aria-checked']).toBe('true');
        });
      }));

    it('renders non-native menu-item-radio attributes with group-aware tabindex', () =>
      scope.run(() => {
        component().run(() => {
          const solo = aria('menu-item-radio', { value: 'solo' }, { native: false });
          expect(solo.attributes.role).toBe('menuitemradio');
          expect(solo.attributes.tabindex).toBe(0);

          const locked = aria('menu-item-radio', { value: 'locked', disabled: true }, { native: false });
          expect(locked.attributes.tabindex).toBe(-1);

          new MenuGroupAria({ label: 'Alignment', value: 'center' });
          const center = aria('menu-item-radio', { value: 'center' }, { native: false });
          const left = aria('menu-item-radio', { value: 'left' }, { native: false });
          expect(center.attributes.tabindex).toBe(0);
          expect(left.attributes.tabindex).toBe(-1);
          expect(center.attributes['aria-checked']).toBe('true');
          expect(left.attributes['aria-checked']).toBe('false');
        });
      }));

    it('respects explicit orientation props on menu containers', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel', { orientation: 'horizontal' });
          expect(menu.attributes['aria-orientation']).toBe('horizontal');
          expect(menu.orientation).toBe('horizontal');

          const bar = aria('menu-bar', { orientation: 'vertical' });
          expect(bar.attributes['aria-orientation']).toBe('vertical');
          expect(bar.orientation).toBe('vertical');
        });
      }));

    it('supports bare construction with default props', () =>
      scope.run(() => {
        component().run(() => {
          const checkbox = new MenuItemCheckboxAria();
          expect(checkbox.attributes.role).toBe('menuitemcheckbox');
          expect(checkbox.attributes['aria-checked']).toBe('false');

          const radio = new MenuItemRadioAria();
          expect(radio.attributes.role).toBe('menuitemradio');
          expect(radio.attributes['aria-checked']).toBe('false');

          const group = new MenuGroupAria();
          expect(group.attributes.role).toBe('group');
        });
      }));

    it('coordinates radios through a factory-created group', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('menu-group', { label: 'Alignment', value: 'center' });
          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-label']).toBe('Alignment');

          const center = aria('menu-item-radio', { value: 'center' });
          const left = aria('menu-item-radio', { value: 'left' });
          expect(center.attributes['aria-checked']).toBe('true');
          expect(left.attributes['aria-checked']).toBe('false');
        });
      }));
  });

  describe('Keyboard Navigation & Roving Focus', () => {
    it('roves focus with ArrowDown / ArrowUp inside vertical menus', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel');
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const cut = bind(document.createElement('button'), aria('menu-item'));
          const copy = bind(document.createElement('button'), aria('menu-item'));
          const paste = bind(document.createElement('button'), aria('menu-item'));

          menuEl.appendChild(cut);
          menuEl.appendChild(copy);
          menuEl.appendChild(paste);

          cut.focus();
          expect(document.activeElement).toBe(cut);

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(copy);

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(paste);

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(cut);

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
          expect(document.activeElement).toBe(paste);

          menuEl.remove();
        });
      }));

    it('roves focus with ArrowRight / ArrowLeft and Home / End inside menubars', () =>
      scope.run(() => {
        component().run(() => {
          const menubar = aria('menu-bar');
          const barEl = bind(document.createElement('div'), menubar);
          document.body.appendChild(barEl);

          const file = bind(document.createElement('button'), aria('menu-item'));
          const edit = bind(document.createElement('button'), aria('menu-item'));
          const view = bind(document.createElement('button'), aria('menu-item'));

          barEl.appendChild(file);
          barEl.appendChild(edit);
          barEl.appendChild(view);

          file.focus();

          barEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(edit);

          barEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
          expect(document.activeElement).toBe(view);

          barEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
          expect(document.activeElement).toBe(file);

          barEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(view);

          barEl.remove();
        });
      }));

    it('claims the Escape keystroke for popup dismissal wiring', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel');
          const menuEl = bind(document.createElement('div'), menu);

          const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
          menuEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(true);
        });
      }));

    it('defers key handling to the outer rover when nested', () =>
      scope.run(() => {
        component().run(() => {
          aria('menu-bar');
          const menu = aria('menu-panel');
          const menuEl = bind(document.createElement('div'), menu);

          const before = document.createElement('button');
          document.body.appendChild(before);
          before.focus();

          const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          menuEl.dispatchEvent(event);

          expect(event.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(before);

          before.remove();
        });
      }));

    it('ignores unhandled keys on non-native menu-items', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('menu-item', {}, { native: false });

          let activated = 0;
          const el = bind(document.createElement('div'), item);
          el.addEventListener('click', () => {
            activated++;
          });

          const down = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
          el.dispatchEvent(down);
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

          expect(activated).toBe(0);
          expect(down.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Menu Pair: Root Orchestrator & Trigger', () => {
    it('projects a generated id and starts closed', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu');
          expect(typeof root.attributes.id).toBe('string');
          expect(root.attributes.id).toMatch(/^menu-/);
          expect(root.open).toBe(false);
        });
      }));

    it('honors explicit id and open props with a working open setter', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu', { id: 'file-menu', open: true });
          expect(root.attributes.id).toBe('file-menu');
          expect(root.open).toBe(true);

          root.open = false;
          expect(root.open).toBe(false);
        });
      }));

    it('wires trigger and panel through the root pair', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu', { id: 'file' });
          const trigger = root.button();
          const panel = root.panel({ label: 'File' });

          expect(trigger.attributes['aria-haspopup']).toBe('menu');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe('file-menu');
          expect(panel.attributes.id).toBe('file-menu');
          expect(panel.attributes.role).toBe('menu');

          const triggerEl = bind(document.createElement('button'), trigger);
          triggerEl.click();
          expect(root.open).toBe(true);
          expect(trigger.attributes['aria-expanded']).toBe('true');

          trigger.open = false;
          expect(root.open).toBe(false);
          expect(trigger.attributes['aria-expanded']).toBe('false');

          triggerEl.click();
          expect(root.open).toBe(true);
        });
      }));

    it('lets panels override the derived pair id', () =>
      scope.run(() => {
        component().run(() => {
          aria('menu', { id: 'file' });
          const panel = aria('menu-panel', { id: 'custom-panel' });
          expect(panel.attributes.id).toBe('custom-panel');

          const solo = aria('menu-panel', { id: 'solo-panel' });
          expect(solo.attributes.id).toBe('solo-panel');
        });
      }));

    it('leaves standalone triggers closed and inert', () =>
      scope.run(() => {
        component().run(() => {
          const trigger = aria('menu-button');
          expect(trigger.open).toBe(false);
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBeUndefined();

          const triggerEl = bind(document.createElement('button'), trigger);
          triggerEl.click();
          expect(trigger.open).toBe(false);

          trigger.open = true;
          expect(trigger.open).toBe(false);

          const lonePoly = aria('menu-button', {}, { native: false });
          expect(lonePoly.attributes['aria-controls']).toBeUndefined();
          const lonePolyEl = bind(document.createElement('div'), lonePoly);
          lonePolyEl.click();
          expect(lonePoly.open).toBe(false);
        });
      }));

    it('closes the paired root on Escape', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu', { id: 'file', open: true });
          const panel = root.panel();
          const panelEl = bind(document.createElement('div'), panel);

          const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
          panelEl.dispatchEvent(event);

          expect(event.defaultPrevented).toBe(true);
          expect(root.open).toBe(false);
        });
      }));

    it('ignores activation on disabled menu-buttons', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu', { id: 'file' });
          const trigger = root.button({ disabled: true });
          expect(trigger.attributes.disabled).toBe(true);

          const triggerEl = bind(document.createElement('button'), trigger);
          triggerEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          expect(root.open).toBe(false);

          const polyfill = aria('menu-button', { disabled: true }, { native: false });
          const polyfillEl = bind(document.createElement('div'), polyfill);
          polyfillEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
          polyfillEl.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
          polyfillEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          expect(root.open).toBe(false);
        });
      }));

    it('activates non-native menu-buttons with Space and Enter', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu', { id: 'file' });
          const trigger = aria('menu-button', {}, { native: false });
          expect(trigger.attributes.role).toBe('button');
          expect(trigger.attributes.tabindex).toBe(0);

          const triggerEl = bind(document.createElement('div'), trigger);

          const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
          triggerEl.dispatchEvent(space);
          expect(space.defaultPrevented).toBe(true);
          expect(root.open).toBe(false);

          triggerEl.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
          expect(root.open).toBe(true);

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          expect(root.open).toBe(false);

          const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
          triggerEl.dispatchEvent(other);
          triggerEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
          expect(root.open).toBe(false);
          expect(other.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Hierarchical Traversal & Selection Invariant', () => {
    it('moves focus across items without ever activating or selecting on the way', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel');
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const group = aria('menu-group', { label: 'Alignment', value: 'left' });
          const groupEl = bind(document.createElement('div'), group);
          menuEl.appendChild(groupEl);

          const left = bind(document.createElement('button'), aria('menu-item-radio', { value: 'left' }));
          const center = bind(document.createElement('button'), aria('menu-item-radio', { value: 'center' }));
          const right = bind(document.createElement('button'), aria('menu-item-radio', { value: 'right' }));
          groupEl.append(left, center, right);

          const activated: string[] = [];
          for (const [label, el] of [
            ['left', left],
            ['center', center],
            ['right', right],
          ] as const) {
            el.addEventListener('click', () => activated.push(label));
          }

          left.focus();

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(center);
          expect(activated).toEqual([]);
          expect(group.value).toBe('left');

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(right);
          expect(activated).toEqual([]);
          expect(group.value).toBe('left');

          // The focused-but-unselected radio stays unchecked until it is actually activated
          expect(right.getAttribute('aria-checked')).toBe('false');
          expect(left.getAttribute('aria-checked')).toBe('true');

          right.click();
          expect(activated).toEqual(['right']);
          expect(group.value).toBe('right');
          expect(right.getAttribute('aria-checked')).toBe('true');
          expect(left.getAttribute('aria-checked')).toBe('false');

          menuEl.remove();
        });
      }));

    it('keeps a checkable item independent of the traversal and of any group value', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel');
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const bold = aria('menu-item-checkbox', { checked: false });
          const italic = aria('menu-item-checkbox', { checked: 'mixed' });
          const boldEl = bind(document.createElement('button'), bold);
          const italicEl = bind(document.createElement('button'), italic);
          menuEl.append(boldEl, italicEl);

          const group = aria('menu-group', { label: 'Alignment', value: 'left' });
          bind(document.createElement('div'), group);

          // Roving past a checkbox item never toggles it, and never lands on the group value
          boldEl.focus();
          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(italicEl);
          expect(bold.checked).toBe(false);
          expect(italic.checked).toBe('mixed');
          expect(group.value).toBe('left');

          // Its own activation advances mixed to checked, independent of everything else
          italicEl.click();
          expect(italic.checked).toBe(true);
          expect(bold.checked).toBe(false);
          expect(group.value).toBe('left');

          menuEl.remove();
        });
      }));
  });

  describe('Submenu Cascade & Focus Scope Invariant', () => {
    it('keeps each paired root open state and popup address separate inside a menubar', () =>
      scope.run(() => {
        component().run(() => {
          const menubar = aria('menu-bar');
          const barEl = bind(document.createElement('div'), menubar);
          document.body.appendChild(barEl);

          const file = aria('menu', { id: 'file' });
          const fileTrigger = bind(document.createElement('button'), file.button());
          const filePanel = bind(document.createElement('div'), file.panel());
          filePanel.appendChild(bind(document.createElement('button'), aria('menu-item')));

          const edit = aria('menu', { id: 'edit' });
          const editTrigger = bind(document.createElement('button'), edit.button());
          const editPanel = bind(document.createElement('div'), edit.panel());
          editPanel.appendChild(bind(document.createElement('button'), aria('menu-item')));

          barEl.append(fileTrigger, filePanel, editTrigger, editPanel);

          expect(fileTrigger.getAttribute('aria-controls')).toBe('file-menu');
          expect(editTrigger.getAttribute('aria-controls')).toBe('edit-menu');
          expect(fileTrigger.getAttribute('aria-expanded')).toBe('false');
          expect(editTrigger.getAttribute('aria-expanded')).toBe('false');

          // Opening one pair leaves its sibling closed
          fileTrigger.click();
          expect(file.open).toBe(true);
          expect(edit.open).toBe(false);
          expect(fileTrigger.getAttribute('aria-expanded')).toBe('true');
          expect(editTrigger.getAttribute('aria-expanded')).toBe('false');

          // Escape inside the open popup closes that root and leaves its sibling alone
          filePanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          expect(file.open).toBe(false);
          expect(edit.open).toBe(false);
          expect(fileTrigger.getAttribute('aria-expanded')).toBe('false');

          // Opening the sibling afterwards is an independent pair transition
          editTrigger.click();
          expect(edit.open).toBe(true);
          expect(file.open).toBe(false);
          expect(editTrigger.getAttribute('aria-expanded')).toBe('true');

          barEl.remove();
        });
      }));

    it('defers popup dismissal to the pair the keystroke came from', () =>
      scope.run(() => {
        component().run(() => {
          const outer = aria('menu', { id: 'outer', open: true });
          const outerPanel = bind(document.createElement('div'), outer.panel());
          document.body.appendChild(outerPanel);

          const inner = aria('menu', { id: 'inner', open: true });
          const innerPanel = bind(document.createElement('div'), inner.panel());
          document.body.appendChild(innerPanel);

          expect(outer.open).toBe(true);
          expect(inner.open).toBe(true);

          innerPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

          expect(inner.open).toBe(false);
          expect(outer.open).toBe(true);

          outerPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          expect(outer.open).toBe(false);

          outerPanel.remove();
          innerPanel.remove();
        });
      }));
  });

  describe('Dismissal & Teardown Invariant', () => {
    it('clears the trigger announcement when the paired root is torn down while open', () =>
      scope.run(() => {
        component().run(() => {
          const root = aria('menu', { id: 'file' });
          const trigger = root.button();
          const panel = root.panel();

          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);

          triggerEl.click();
          expect(root.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          root.destroy();

          // No live root means no live expansion claim
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          // The trigger keeps its address but has nothing left to open
          expect(trigger.attributes['aria-controls']).toBe('file-menu');
          triggerEl.click();
          expect(panelEl.getAttribute('aria-orientation')).toBe('vertical');

          trigger.destroy();
          panel.destroy();
        });
      }));

    it('releases the roving tab stop when a popup is torn down with focus inside it', () =>
      scope.run(() => {
        component().run(() => {
          const menu = aria('menu-panel');
          const menuEl = bind(document.createElement('div'), menu);
          document.body.appendChild(menuEl);

          const first = bind(document.createElement('button'), aria('menu-item'));
          const second = bind(document.createElement('button'), aria('menu-item'));
          menuEl.append(first, second);

          menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(second);

          const outside = document.createElement('button');
          document.body.appendChild(outside);
          outside.focus();

          menu.destroy();
          first.destroy();
          second.destroy();

          // A destroyed popup takes no further claim on focus or keystrokes
          const event = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          menuEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(outside);

          menuEl.remove();
          outside.remove();
        });
      }));
  });
});
