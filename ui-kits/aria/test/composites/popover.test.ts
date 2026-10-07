import { type AnyType, withContext } from '@airlib/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PopoverAria, PopoverPanelAria, PopoverTriggerAria, popover } from '../../src/composites/popover.js';

describe('Popover Composite (DX Usage)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Initialization & State Defaults', () => {
    it('creates coordinator with default state', () => {
      withContext(() => {
        const root = popover();
        expect(root).toBeInstanceOf(PopoverAria);
        expect(root.open).toBe(false);
        expect(root.dismissable).toBe(true);
        expect(root.popupRole).toBe('dialog');
      });
    });

    it('respects initial open and custom options', () => {
      withContext(() => {
        const root = popover(
          { id: 'custom-pop', open: true, dismissable: false, xDir: 'right', yDir: 'below' },
          { popupRole: 'menu' }
        );
        expect(root.id).toBe('custom-pop');
        expect(root.open).toBe(true);
        expect(root.dismissable).toBe(false);
        expect(root.popupRole).toBe('menu');
      });
    });

    it('spawns coordinated trigger and panel parts', () => {
      withContext(() => {
        const root = popover({ id: 'pop-1' });
        const trigger = root.trigger();
        const panel = root.panel();

        expect(trigger).toBeInstanceOf(PopoverTriggerAria);
        expect(panel).toBeInstanceOf(PopoverPanelAria);
        expect(trigger.popover).toBe(root);
        expect(panel.popover).toBe(root);
      });
    });
  });

  describe('Attributes Compilation', () => {
    it('compiles trigger attributes for native button', () => {
      withContext(() => {
        const root = popover({ id: 'test-pop' });
        const trigger = root.trigger();

        expect(trigger.attributes['aria-controls']).toBe('test-pop-panel');
        expect(trigger.attributes['aria-haspopup']).toBe('dialog');
        expect(trigger.attributes['aria-expanded']).toBe('false');
        expect(trigger.attributes.disabled).toBe(false);
      });
    });

    it('compiles trigger attributes for custom element host', () => {
      withContext(() => {
        const root = popover({ id: 'test-pop' }, { popupRole: 'menu' });
        const trigger = root.trigger({}, { native: false });

        expect(trigger.attributes.role).toBe('button');
        expect(trigger.attributes.tabindex).toBe(0);
        expect(trigger.attributes['aria-haspopup']).toBe('menu');
        expect(trigger.attributes['aria-controls']).toBe('test-pop-panel');
      });
    });

    it('compiles panel attributes, data placement selectors, and css anchor variables', () => {
      withContext(() => {
        const root = popover({ id: 'test-pop', xDir: 'left', yDir: 'above' });
        const trigger = root.trigger();
        const panel = root.panel();

        expect(trigger.attributes.style).toBeUndefined();
        expect(panel.attributes.id).toBe('test-pop-panel');
        expect(panel.attributes.role).toBe('dialog');
        expect(panel.attributes.hidden).toBe(true);
        expect(panel.attributes['data-popover-x']).toBe('left');
        expect(panel.attributes['data-popover-y']).toBe('above');
        expect(panel.attributes.style).toEqual({
          '--popover-anchor-name': '--popover-anchor-test-pop',
        });

        root.open = true;
        const openTrigger = root.trigger();
        expect(openTrigger.attributes.style).toEqual({
          '--popover-anchor-name': '--popover-anchor-test-pop',
        });
      });
    });

    it('attaches and detaches native anchor-name and position-anchor via DOM styles', () => {
      withContext(() => {
        const root = popover({ id: 'dom-anchor', open: false });
        const trigger = root.trigger();
        const panel = root.panel();

        const triggerEl = document.createElement('button');
        const panelEl = document.createElement('div');
        document.body.appendChild(triggerEl);
        document.body.appendChild(panelEl);

        trigger.ref(triggerEl);
        panel.ref(panelEl);

        expect(panelEl.style.getPropertyValue('position-anchor')).toBe('--popover-anchor-dom-anchor');
        expect(triggerEl.style.getPropertyValue('anchor-name')).toBe('');

        root.open = true;
        expect(triggerEl.style.getPropertyValue('anchor-name')).toBe('--popover-anchor-dom-anchor');

        root.open = false;
        expect(triggerEl.style.getPropertyValue('anchor-name')).toBe('');

        trigger.ref(null);
        panel.ref(null);
        document.body.removeChild(triggerEl);
        document.body.removeChild(panelEl);
      });
    });

    it('unhides panel when open is true', () => {
      withContext(() => {
        const root = popover({ id: 'test-pop', open: true });
        const panel = root.panel();

        expect(panel.attributes.hidden).toBe(false);
      });
    });
  });

  describe('Interactions & Toggling', () => {
    it('toggles open state upon trigger click', () => {
      withContext(() => {
        const root = popover({ id: 'toggle-pop' });
        const trigger = root.trigger();
        const panel = root.panel();

        const triggerEl = document.createElement('button');
        const panelEl = document.createElement('div');
        document.body.appendChild(triggerEl);
        document.body.appendChild(panelEl);

        trigger.ref(triggerEl);
        panel.ref(panelEl);

        expect(root.open).toBe(false);
        expect(trigger.attributes['aria-expanded']).toBe('false');

        triggerEl.click();

        expect(root.open).toBe(true);
        expect(trigger.attributes['aria-expanded']).toBe('true');
        expect(panel.attributes.hidden).toBe(false);

        triggerEl.click();

        expect(root.open).toBe(false);
        expect(trigger.attributes['aria-expanded']).toBe('false');

        trigger.ref(null);
        panel.ref(null);
      });
    });

    it('dispatches custom toggle event on panel', () => {
      withContext(() => {
        const root = popover({ id: 'event-pop' });
        const panel = root.panel();

        const panelEl = document.createElement('div');
        document.body.appendChild(panelEl);
        panel.ref(panelEl);

        const events: boolean[] = [];
        panelEl.addEventListener('toggle', (e) => {
          events.push((e as AnyType).detail);
        });

        root.open = true;
        expect(events).toEqual([true]);

        root.open = false;
        expect(events).toEqual([true, false]);

        panel.ref(null);
      });
    });
  });

  describe('Light Dismissal', () => {
    it('dismisses on outside click when dismissable is true', () => {
      withContext(() => {
        const root = popover({ id: 'dismiss-pop', open: true, dismissable: true });
        const trigger = root.trigger();
        const panel = root.panel();

        const triggerEl = document.createElement('button');
        const panelEl = document.createElement('div');
        const outsideEl = document.createElement('div');
        document.body.appendChild(triggerEl);
        document.body.appendChild(panelEl);
        document.body.appendChild(outsideEl);

        trigger.ref(triggerEl);
        panel.ref(panelEl);

        expect(root.open).toBe(true);

        outsideEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

        expect(root.open).toBe(false);

        trigger.ref(null);
        panel.ref(null);
      });
    });

    it('dismisses on Escape key when dismissable is true', () => {
      withContext(() => {
        const root = popover({ id: 'escape-pop', open: true, dismissable: true });
        const panel = root.panel();

        const panelEl = document.createElement('div');
        document.body.appendChild(panelEl);
        panel.ref(panelEl);

        expect(root.open).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(root.open).toBe(false);

        panel.ref(null);
      });
    });

    it('does not dismiss on outside click or Escape when dismissable is false', () => {
      withContext(() => {
        const root = popover({ id: 'locked-pop', open: true, dismissable: false });
        const panel = root.panel();

        const panelEl = document.createElement('div');
        const outsideEl = document.createElement('div');
        document.body.appendChild(panelEl);
        document.body.appendChild(outsideEl);

        panel.ref(panelEl);

        outsideEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        expect(root.open).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(root.open).toBe(true);

        panel.ref(null);
      });
    });
  });

  describe('Focus Management', () => {
    it('restores focus to trigger on popover close', () => {
      withContext(() => {
        const root = popover({ id: 'focus-pop' });
        const trigger = root.trigger();
        const panel = root.panel();

        const triggerEl = document.createElement('button');
        const panelEl = document.createElement('div');
        const closeBtn = document.createElement('button');
        panelEl.appendChild(closeBtn);
        document.body.appendChild(triggerEl);
        document.body.appendChild(panelEl);

        trigger.ref(triggerEl);
        panel.ref(panelEl);

        triggerEl.focus();
        expect(document.activeElement).toBe(triggerEl);

        root.open = true;

        closeBtn.focus();
        expect(document.activeElement).toBe(closeBtn);

        root.open = false;

        expect(document.activeElement).toBe(triggerEl);

        trigger.ref(null);
        panel.ref(null);
      });
    });
  });
});
