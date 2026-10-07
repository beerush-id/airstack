import { withContext } from '@airlib/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PopoverPanelAria, PopoverTriggerAria, popover, popoverCtx } from '../../src/composites/popover.js';

describe('Popover Composite Coverage & Edge Cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('provides show() and close() methods on coordinator', () => {
    withContext(() => {
      const root = popover();
      expect(root.open).toBe(false);
      root.show();
      expect(root.open).toBe(true);
      root.close();
      expect(root.open).toBe(false);
    });
  });

  it('prevents click toggle when trigger is disabled or event defaultPrevented', () => {
    withContext(() => {
      const root = popover({ id: 'disabled-pop' });
      const trigger = root.trigger({ disabled: true });
      const triggerEl = document.createElement('button');
      document.body.appendChild(triggerEl);
      trigger.ref(triggerEl);

      const evt = new MouseEvent('click', { cancelable: true });
      triggerEl.dispatchEvent(evt);
      expect(root.open).toBe(false);

      const trigger2 = root.trigger({ disabled: false });
      const triggerEl2 = document.createElement('button');
      document.body.appendChild(triggerEl2);
      trigger2.ref(triggerEl2);

      const preventedEvt = new MouseEvent('click', { cancelable: true });
      preventedEvt.preventDefault();
      triggerEl2.dispatchEvent(preventedEvt);
      expect(root.open).toBe(false);

      trigger.ref(null);
      trigger2.ref(null);
    });
  });

  it('compiles native popover attributes on panel with native option', () => {
    withContext(() => {
      const rootAuto = popover({ id: 'native-pop-auto', dismissable: true });
      const panelAuto = rootAuto.panel({}, { native: true });
      expect(panelAuto.attributes.popover).toBe('auto');

      const rootManual = popover({ id: 'native-pop-manual', dismissable: false });
      const panelManual = rootManual.panel({}, { native: true });
      expect(panelManual.attributes.popover).toBe('manual');
    });
  });

  it('focuses panel itself when it has tabindex and no focusable children', () => {
    withContext(() => {
      const root = popover({ id: 'panel-focus-pop' });
      const panel = root.panel();

      const panelEl = document.createElement('div');
      panelEl.tabIndex = 0;
      document.body.appendChild(panelEl);
      panel.ref(panelEl);

      root.open = true;
      expect(document.activeElement).toBe(panelEl);

      panel.ref(null);
    });
  });

  it('ignores outside dismiss when clicking directly on trigger element or inside panel', () => {
    withContext(() => {
      const root = popover({ id: 'click-pop', open: true, dismissable: true });
      const trigger = root.trigger();
      const panel = root.panel();

      const triggerEl = document.createElement('button');
      const panelEl = document.createElement('div');
      const innerEl = document.createElement('span');
      panelEl.appendChild(innerEl);
      document.body.appendChild(triggerEl);
      document.body.appendChild(panelEl);

      trigger.ref(triggerEl);
      panel.ref(panelEl);

      // Click on trigger
      triggerEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(root.open).toBe(true);

      // Click inside panel
      innerEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(root.open).toBe(true);

      // Non-Escape key while open
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(root.open).toBe(true);

      trigger.ref(null);
      panel.ref(null);
    });
  });

  it('handles early return in pointerdown and keydown handlers when closed', () => {
    withContext(() => {
      const root = popover({ id: 'closed-pop', open: false, dismissable: true });
      const panel = root.panel();
      const panelEl = document.createElement('div');
      document.body.appendChild(panelEl);
      panel.ref(panelEl);

      // pointerdown and keydown when closed do nothing
      document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(root.open).toBe(false);

      panel.ref(null);
    });
  });

  it('handles detached previous focused element on close', () => {
    withContext(() => {
      const root = popover({ id: 'detached-focus-pop' });
      const panel = root.panel();
      const tempBtn = document.createElement('button');
      const panelEl = document.createElement('div');
      document.body.appendChild(tempBtn);
      document.body.appendChild(panelEl);

      panel.ref(panelEl);

      tempBtn.focus();
      root.open = true;

      // Detach tempBtn before close
      tempBtn.remove();
      root.open = false;

      panel.ref(null);
    });
  });

  it('handles standalone parts when ambient context is absent', () => {
    withContext(() => {
      popoverCtx.set(undefined as never);
      const standaloneTrigger = new PopoverTriggerAria();
      const standalonePanel = new PopoverPanelAria();

      expect(standaloneTrigger.attributes['aria-controls']).toBe('popover-panel');
      expect(standalonePanel.attributes.id).toBe('popover-panel');

      // Standalone trigger click
      const fakeEl = document.createElement('button');
      standaloneTrigger.ref(fakeEl);
      fakeEl.click();
      standaloneTrigger.ref(null);
    });
  });

  it('cleans up event listeners and effects upon unmount', () => {
    withContext(() => {
      const root = popover({ id: 'cleanup-pop' });
      const panel = root.panel();
      const panelEl = document.createElement('div');
      document.body.appendChild(panelEl);

      panel.ref(panelEl);
      panel.ref(null);

      // Verify no throw on window escape after detach
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(root.open).toBe(false);
    });
  });
});
