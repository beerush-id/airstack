import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ContextMenuProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildContextMenu(props: ContextMenuProps = {}) {
  const menu = aria('context-menu', props as never);
  const hostEl = bind(document.createElement('div'), menu);
  document.body.appendChild(hostEl);

  const panel = aria('context-menu-panel', { label: 'Context Actions' } as never);
  const panelEl = bind(document.createElement('div'), panel);
  document.body.appendChild(panelEl);

  const cut = bind(document.createElement('button'), aria('menu-item', { name: 'cut' } as never));
  cut.textContent = 'Cut';

  const copy = bind(document.createElement('button'), aria('menu-item', { name: 'copy' } as never));
  copy.textContent = 'Copy';

  const paste = bind(document.createElement('button'), aria('menu-item', { name: 'paste', disabled: true } as never));
  paste.textContent = 'Paste';

  panelEl.append(cut, copy, paste);

  const cleanup = () => {
    paste.remove();
    copy.remove();
    cut.remove();
    panel.destroy();
    menu.destroy();
    panelEl.remove();
    hostEl.remove();
  };

  return { menu, hostEl, panel, panelEl, cut, copy, paste, cleanup };
}

function secondaryClick(el: HTMLElement, clientX = 120, clientY = 240) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX,
    clientY,
  });
  el.dispatchEvent(event);
  return event;
}

function pressKey(el: HTMLElement, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
}

describe('ContextMenu - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Semantic Layers & Architecture Invariant', () => {
    it('preserves host element semantics and compiles no trigger attributes', () =>
      scope.run(() => {
        component().run(() => {
          const { menu, hostEl, panel, panelEl, cleanup } = buildContextMenu({ open: false });

          expect(menu.attributes.role).toBeUndefined();
          expect(hostEl.hasAttribute('role')).toBe(false);
          expect(hostEl.hasAttribute('tabindex')).toBe(false);

          expect(hostEl.hasAttribute('aria-haspopup')).toBe(false);
          expect(hostEl.hasAttribute('aria-expanded')).toBe(false);
          expect(hostEl.hasAttribute('aria-controls')).toBe(false);

          expect(panel.attributes.role).toBe('menu');
          expect(panel.attributes['aria-orientation']).toBe('vertical');
          expect(panelEl.getAttribute('role')).toBe('menu');
          expect(panelEl.getAttribute('aria-orientation')).toBe('vertical');

          cleanup();
        });
      }));

    it('defaults to closed state with namespaced IDs', () =>
      scope.run(() => {
        component().run(() => {
          const { menu, panel, cleanup } = buildContextMenu();

          expect(menu.open).toBe(false);
          expect(menu.id).toBeDefined();
          expect(panel.id).toBeDefined();

          cleanup();
        });
      }));

    it('supports custom panel props for id, label, and labelledby', () =>
      scope.run(() => {
        component().run(() => {
          const panel = aria('context-menu-panel', {
            id: 'custom-panel-id',
            label: 'Custom Actions',
          } as never);
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          expect(panel.id).toBe('custom-panel-id');
          expect(panel.attributes['aria-label']).toBe('Custom Actions');
          expect(panelEl.getAttribute('id')).toBe('custom-panel-id');
          expect(panelEl.getAttribute('aria-label')).toBe('Custom Actions');

          panel.destroy();
          panelEl.remove();
        });
      }));
  });

  describe('Pointer Coordinates & Secondary Click Invocation Invariant', () => {
    it('opens on secondary pointer click, cancels default browser menu, and captures anchor coordinates', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, panelEl, cleanup } = buildContextMenu(props);

          const event = secondaryClick(hostEl, 150, 320);

          expect(event.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          expect(panelEl.style.getPropertyValue('--anchor-x')).toBe('150px');
          expect(panelEl.style.getPropertyValue('--anchor-y')).toBe('320px');

          cleanup();
        });
      }));

    it('bubbles secondary pointer clicks from child elements to open and capture coordinates', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, panelEl, cleanup } = buildContextMenu(props);

          const child = document.createElement('span');
          child.textContent = 'Target Area';
          hostEl.appendChild(child);

          const event = secondaryClick(child, 80, 190);

          expect(event.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);
          expect(panelEl.style.getPropertyValue('--anchor-x')).toBe('80px');
          expect(panelEl.style.getPropertyValue('--anchor-y')).toBe('190px');

          cleanup();
        });
      }));

    it('ignores primary pointer clicks, double clicks, and middle clicks', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, cleanup } = buildContextMenu(props);

          hostEl.click();
          expect(props.open).toBe(false);

          hostEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, button: 0 }));
          expect(props.open).toBe(false);

          hostEl.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
          expect(props.open).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Keyboard Shortcut Invocation Invariant', () => {
    it('opens on Shift+F10 and on ContextMenu key with default prevention', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, cleanup } = buildContextMenu(props);

          const plainF10 = pressKey(hostEl, 'F10', false);
          expect(plainF10.defaultPrevented).toBe(false);
          expect(props.open).toBe(false);

          const shortcut = pressKey(hostEl, 'F10', true);
          expect(shortcut.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          props.open = false;

          const menuKey = pressKey(hostEl, 'ContextMenu');
          expect(menuKey.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('opens via keyboard shortcut from a focused descendant element', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, cleanup } = buildContextMenu(props);

          const innerBtn = document.createElement('button');
          hostEl.appendChild(innerBtn);
          innerBtn.focus();

          const event = pressKey(innerBtn, 'F10', true);
          expect(event.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Disabled Lockout Invariant', () => {
    it('locks out pointer and keyboard invocations when disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false, disabled: true });
          const { hostEl, cleanup } = buildContextMenu(props);

          const clickEvent = secondaryClick(hostEl);
          expect(clickEvent.defaultPrevented).toBe(false);
          expect(props.open).toBe(false);

          const keyEvent = pressKey(hostEl, 'F10', true);
          expect(keyEvent.defaultPrevented).toBe(false);
          expect(props.open).toBe(false);

          props.disabled = false;

          const activeClick = secondaryClick(hostEl);
          expect(activeClick.defaultPrevented).toBe(true);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Menu Contract Delegation & Focus Invariant', () => {
    it('moves focus to the first enabled item when opened', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, cut, cleanup } = buildContextMenu(props);

          secondaryClick(hostEl);
          expect(props.open).toBe(true);
          expect(document.activeElement).toBe(cut);

          cleanup();
        });
      }));

    it('roves focus across items with arrow keys and wraps navigation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: true });
          const { panelEl, cut, copy, cleanup } = buildContextMenu(props);

          cut.focus();

          pressKey(panelEl, 'ArrowDown');
          expect(document.activeElement).toBe(copy);

          pressKey(panelEl, 'ArrowDown');
          expect(document.activeElement).toBe(cut);

          pressKey(panelEl, 'ArrowUp');
          expect(document.activeElement).toBe(copy);

          cleanup();
        });
      }));

    it('dismisses on Escape and returns focus to the host context', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { hostEl, panelEl, cut, cleanup } = buildContextMenu(props);

          const innerBtn = document.createElement('button');
          hostEl.appendChild(innerBtn);
          innerBtn.focus();

          pressKey(innerBtn, 'F10', true);
          expect(props.open).toBe(true);
          expect(document.activeElement).toBe(cut);

          pressKey(panelEl, 'Escape');
          expect(props.open).toBe(false);
          expect(document.activeElement).toBe(innerBtn);

          cleanup();
        });
      }));

    it('dismisses on pointer interaction outside host and panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: true });
          const { cleanup } = buildContextMenu(props);

          document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('supports checkable items inside panel inheriting menu item contracts', () =>
      scope.run(() => {
        component().run(() => {
          const { panelEl, cleanup } = buildContextMenu({ open: true });

          const checkboxItem = bind(
            document.createElement('button'),
            aria('menu-item-checkbox', { name: 'wrap', checked: false } as never)
          );
          checkboxItem.textContent = 'Word Wrap';
          panelEl.appendChild(checkboxItem);

          expect(checkboxItem.getAttribute('role')).toBe('menuitemcheckbox');
          expect(checkboxItem.getAttribute('aria-checked')).toBe('false');

          checkboxItem.click();
          expect(checkboxItem.getAttribute('aria-checked')).toBe('true');

          checkboxItem.remove();
          cleanup();
        });
      }));
  });

  describe('Lifecycle, Events, & Teardown Invariant', () => {
    it('invokes onopen and onclose lifecycle callbacks on visibility changes', () =>
      scope.run(() => {
        component().run(() => {
          let openCalled = false;
          let closeCalled = false;

          const props = mutable<ContextMenuProps>({
            open: false,
            onopen: () => {
              openCalled = true;
            },
            onclose: () => {
              closeCalled = true;
            },
          });

          const { hostEl, panelEl, cleanup } = buildContextMenu(props);

          secondaryClick(hostEl);
          expect(props.open).toBe(true);
          expect(openCalled).toBe(true);

          pressKey(panelEl, 'Escape');
          expect(props.open).toBe(false);
          expect(closeCalled).toBe(true);

          cleanup();
        });
      }));

    it('bubbles item command events to oncommand handler on root context-menu', () =>
      scope.run(() => {
        component().run(() => {
          let commandedName = '';

          const props = mutable<ContextMenuProps>({
            open: true,
            oncommand: (event: Event) => {
              const custom = event as CustomEvent<string>;
              commandedName =
                typeof custom.detail === 'string' ? custom.detail : ((custom.detail as { name?: string })?.name ?? '');
            },
          });

          const { cut, cleanup } = buildContextMenu(props);

          cut.click();
          expect(commandedName).toBe('cut');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('stops listening to events and unbinds once destroyed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ContextMenuProps>({ open: false });
          const { menu, hostEl, cleanup } = buildContextMenu(props);

          menu.destroy();

          const event = secondaryClick(hostEl);
          expect(event.defaultPrevented).toBe(false);
          expect(props.open).toBe(false);

          cleanup();
        });
      }));
  });
});
